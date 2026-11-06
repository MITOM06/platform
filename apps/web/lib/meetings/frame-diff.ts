/** Shared-screen frame sampling rules. Flutter mirrors these names/values (frame_diff.dart). */
export const CHECK_MS = 5000;
export const MIN_GAP_MS = 15000;
export const DIFF_THRESHOLD = 0.06;
export const THUMB_W = 32;
export const THUMB_H = 18;
export const MAX_EDGE = 1280;
export const JPEG_QUALITY = 0.7;

/** Mean absolute difference of two grayscale thumbnails (bytes 0..255), normalized to 0..1. */
export function thumbnailDiff(a: Uint8Array, b: Uint8Array): number {
  const n = Math.min(a.length, b.length);
  if (n === 0 || a.length !== b.length) return a.length === b.length ? 0 : 1;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += Math.abs(a[i] - b[i]);
  return sum / (n * 255);
}

/** First frame (lastSentAt null) always goes; later ones need a change and a 15 s gap. */
export function shouldSend(p: {
  changed: boolean;
  lastSentAt: number | null;
  now: number;
}): boolean {
  if (p.lastSentAt === null) return true;
  return p.changed && p.now - p.lastSentAt >= MIN_GAP_MS;
}
