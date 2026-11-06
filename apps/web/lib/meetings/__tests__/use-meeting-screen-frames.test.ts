import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useMeetingRoomStore } from "@/lib/store/meeting.store";
import {
  useMeetingScreenFrames,
  type ScreenFrameDeps,
} from "@/lib/meetings/use-meeting-screen-frames";

const px = (v: number) => new Uint8Array(32 * 18).fill(v);
const blob = new Blob(["x"], { type: "image/jpeg" });
const stream = { active: true } as unknown as MediaStream;

function setup(
  upload: ScreenFrameDeps["upload"] = vi.fn().mockResolvedValue(undefined),
) {
  let thumb: Uint8Array | null = px(10);
  const dispose = vi.fn();
  const deps: ScreenFrameDeps = {
    createCapture: vi.fn(() => ({
      thumbnail: () => thumb,
      frame: async () => blob,
      dispose,
    })),
    upload,
    now: () => Date.now(),
  };
  return { deps, upload, dispose, setThumb: (t: Uint8Array | null) => (thumb = t) };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
  useMeetingRoomStore.setState({ localScreen: stream });
});
afterEach(() => {
  vi.useRealTimers();
  useMeetingRoomStore.setState({ localScreen: null });
});

const flush = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
const tick = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

describe("useMeetingScreenFrames", () => {
  it("does not capture while inactive", async () => {
    const s = setup();
    renderHook(() => useMeetingScreenFrames("m1", false, s.deps));
    await tick(20000);
    expect(s.deps.createCapture).not.toHaveBeenCalled();
    expect(s.upload).not.toHaveBeenCalled();
  });

  it("does not capture without a meeting id or screen stream", async () => {
    const s = setup();
    renderHook(() => useMeetingScreenFrames(null, true, s.deps));
    useMeetingRoomStore.setState({ localScreen: null });
    renderHook(() => useMeetingScreenFrames("m1", true, s.deps));
    await tick(20000);
    expect(s.upload).not.toHaveBeenCalled();
  });

  it("uploads the first frame immediately when turned on", async () => {
    const s = setup();
    renderHook(() => useMeetingScreenFrames("m1", true, s.deps));
    await flush();
    expect(s.upload).toHaveBeenCalledTimes(1);
    expect(s.upload).toHaveBeenCalledWith("m1", blob, 1_000_000);
  });

  it("sends nothing more while the screen is unchanged", async () => {
    const s = setup();
    renderHook(() => useMeetingScreenFrames("m1", true, s.deps));
    await flush();
    await tick(60000);
    expect(s.upload).toHaveBeenCalledTimes(1);
  });

  it("sends again once the content changed and 15 s passed", async () => {
    const s = setup();
    renderHook(() => useMeetingScreenFrames("m1", true, s.deps));
    await flush();
    s.setThumb(px(200));
    await tick(5000); // changed, but only 5 s since the last send
    expect(s.upload).toHaveBeenCalledTimes(1);
    await tick(10000);
    expect(s.upload).toHaveBeenCalledTimes(2);
  });

  it("skips ticks while an upload is in flight", async () => {
    let release!: () => void;
    const upload = vi.fn(
      () =>
        new Promise<void>((r) => {
          release = r;
        }),
    );
    const s = setup(upload);
    renderHook(() => useMeetingScreenFrames("m1", true, s.deps));
    await flush();
    s.setThumb(px(200));
    await tick(30000);
    expect(upload).toHaveBeenCalledTimes(1);
    release();
    await tick(5000);
    expect(upload).toHaveBeenCalledTimes(2);
  });

  it("stops timers and releases the capture when turned off", async () => {
    const s = setup();
    const { rerender } = renderHook(
      ({ on }) => useMeetingScreenFrames("m1", on, s.deps),
      { initialProps: { on: true } },
    );
    await flush();
    rerender({ on: false });
    expect(s.dispose).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    s.setThumb(px(250));
    await tick(60000);
    expect(s.upload).toHaveBeenCalledTimes(1);
  });

  it("releases on unmount", async () => {
    const s = setup();
    const { unmount } = renderHook(() =>
      useMeetingScreenFrames("m1", true, s.deps),
    );
    await flush();
    unmount();
    expect(s.dispose).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    ["204 / success", () => Promise.resolve({ status: 204 })],
    ["429", () => Promise.reject({ response: { status: 429 } })],
    ["network error", () => Promise.reject(new Error("Network Error"))],
  ])("stays silent on %s", async (_n, impl) => {
    const s = setup(vi.fn(impl));
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    renderHook(() => useMeetingScreenFrames("m1", true, s.deps));
    await flush();
    s.setThumb(px(200));
    await tick(20000);
    process.off("unhandledRejection", unhandled);
    expect(s.upload).toHaveBeenCalledTimes(2);
    expect(unhandled).not.toHaveBeenCalled();
  });

  it("stops when the stream ends", async () => {
    const s = setup();
    renderHook(() => useMeetingScreenFrames("m1", true, s.deps));
    await flush();
    (stream as { active: boolean }).active = false;
    s.setThumb(px(200));
    await tick(20000);
    (stream as { active: boolean }).active = true;
    expect(s.upload).toHaveBeenCalledTimes(1);
    expect(s.dispose).toHaveBeenCalled();
  });

  it("a timed-out upload releases inFlight so the next tick can send", async () => {
    // Stands in for axios rejecting after its 15 s timeout.
    const upload = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 15000)),
      )
      .mockResolvedValue(undefined);
    const s = setup(upload);
    renderHook(() => useMeetingScreenFrames("m1", true, s.deps));
    await flush();
    s.setThumb(px(200));
    await tick(14000);
    expect(upload).toHaveBeenCalledTimes(1);
    await tick(6000);
    expect(upload).toHaveBeenCalledTimes(2);
  });

  describe("reading state", () => {
    it("is false until the first frame is readable, then true", async () => {
      const s = setup();
      s.setThumb(null);
      const { result } = renderHook(() =>
        useMeetingScreenFrames("m1", true, s.deps),
      );
      await flush();
      expect(result.current).toBe(false);
      s.setThumb(px(10));
      await tick(500);
      expect(result.current).toBe(true);
    });

    it("is false when inactive and after turning off", async () => {
      const s = setup();
      const { result, rerender } = renderHook(
        ({ on }) => useMeetingScreenFrames("m1", on, s.deps),
        { initialProps: { on: true } },
      );
      await flush();
      expect(result.current).toBe(true);
      rerender({ on: false });
      expect(result.current).toBe(false);
    });

    it("gives up after 20 warm-up retries: stops capture, reading stays false", async () => {
      const s = setup();
      s.setThumb(null);
      const { result } = renderHook(() =>
        useMeetingScreenFrames("m1", true, s.deps),
      );
      await flush();
      await tick(500 * 25);
      expect(result.current).toBe(false);
      expect(s.dispose).toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
      s.setThumb(px(10)); // too late for this share
      await tick(30000);
      expect(s.upload).not.toHaveBeenCalled();
    });

    it("a thumbnail arriving within the cap still works", async () => {
      const s = setup();
      s.setThumb(null);
      const { result } = renderHook(() =>
        useMeetingScreenFrames("m1", true, s.deps),
      );
      await flush();
      await tick(500 * 19);
      s.setThumb(px(10));
      await tick(500);
      expect(result.current).toBe(true);
      expect(s.upload).toHaveBeenCalledTimes(1);
    });

    it("is false once the stream ends", async () => {
      const s = setup();
      const { result } = renderHook(() =>
        useMeetingScreenFrames("m1", true, s.deps),
      );
      await flush();
      expect(result.current).toBe(true);
      (stream as { active: boolean }).active = false;
      await tick(6000);
      (stream as { active: boolean }).active = true;
      expect(result.current).toBe(false);
    });
  });
});
