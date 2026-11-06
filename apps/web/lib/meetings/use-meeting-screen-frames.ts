"use client";

import { useEffect, useState } from "react";
import { meetingsApi } from "@/lib/api/meetings";
import { useMeetingRoomStore } from "@/lib/store/meeting.store";
import {
  CHECK_MS,
  DIFF_THRESHOLD,
  shouldSend,
  thumbnailDiff,
} from "./frame-diff";
import { createDomScreenCapture, type ScreenCapture } from "./screen-capture";

export type { ScreenCapture };

export interface ScreenFrameDeps {
  createCapture(stream: MediaStream): ScreenCapture;
  upload(meetingId: string, frame: Blob, ts: number): Promise<unknown>;
  now(): number;
}

const defaultDeps: ScreenFrameDeps = {
  createCapture: createDomScreenCapture,
  upload: (id, frame, ts) => meetingsApi.uploadScreenFrame(id, frame, ts),
  now: () => Date.now(),
};

const WARMUP_RETRY_MS = 500;
/** ~10 s for the shared video to produce a frame; then give up for this share. */
const WARMUP_MAX_RETRIES = 20;

/**
 * While `active` (AI notes on and I'm sharing my screen), samples the shared screen every 5 s and
 * uploads a JPEG when it changed (>= 15 s apart; the first frame goes immediately). Fully silent:
 * any response or error is ignored. Reads my screen stream from the room store.
 * Returns `reading`: true only while frames are really being read (first frame readable, not
 * stopped, not given up) — drives the sharer chip.
 */
export function useMeetingScreenFrames(
  meetingId: string | null,
  active: boolean,
  deps: ScreenFrameDeps = defaultDeps,
): boolean {
  const stream = useMeetingRoomStore((s) => s.localScreen);
  const [reading, setReading] = useState(false);

  useEffect(() => {
    if (!active || !meetingId || !stream) return;
    const capture = deps.createCapture(stream);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let inFlight = false;
    let lastThumb: Uint8Array | null = null;
    let lastSentAt: number | null = null;
    let warmups = 0;

    const schedule = (ms: number) => {
      if (!stopped) timer = setTimeout(tick, ms);
    };
    const stop = () => {
      stopped = true;
      setReading(false);
      if (timer) clearTimeout(timer);
      capture.dispose();
    };

    async function tick() {
      if (stopped) return;
      if (stream!.active === false) return stop();
      if (inFlight) return schedule(CHECK_MS);
      const thumb = capture.thumbnail();
      if (!thumb) {
        if (++warmups > WARMUP_MAX_RETRIES) return stop();
        return schedule(WARMUP_RETRY_MS);
      }
      setReading(true);
      const now = deps.now();
      const changed =
        !lastThumb || thumbnailDiff(lastThumb, thumb) >= DIFF_THRESHOLD;
      if (shouldSend({ changed, lastSentAt, now })) {
        inFlight = true;
        try {
          const frame = await capture.frame();
          if (frame && !stopped) {
            lastThumb = thumb;
            lastSentAt = now;
            await deps.upload(meetingId!, frame, now);
          }
        } catch {
          // best effort: a failed frame is simply skipped
        } finally {
          inFlight = false;
        }
      }
      schedule(CHECK_MS);
    }

    void tick();
    return stop;
  }, [active, meetingId, stream, deps]);

  return reading && active && !!meetingId && !!stream;
}
