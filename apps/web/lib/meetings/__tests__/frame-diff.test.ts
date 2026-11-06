import { describe, it, expect } from "vitest";
import {
  thumbnailDiff,
  shouldSend,
  DIFF_THRESHOLD,
} from "@/lib/meetings/frame-diff";

const px = (v: number) => new Uint8Array(32 * 18).fill(v);

describe("thumbnailDiff", () => {
  it("is 0 for identical thumbnails", () =>
    expect(thumbnailDiff(px(90), px(90))).toBe(0));
  it("is ~1 for black vs white", () =>
    expect(thumbnailDiff(px(0), px(255))).toBeCloseTo(1, 5));
  it("scales with the mean difference", () => {
    expect(thumbnailDiff(px(0), px(51))).toBeCloseTo(0.2, 5);
    expect(thumbnailDiff(px(0), px(5))).toBeLessThan(DIFF_THRESHOLD);
  });
});

describe("shouldSend", () => {
  it("always sends the first frame", () =>
    expect(shouldSend({ changed: false, lastSentAt: null, now: 1 })).toBe(
      true,
    ));
  it("skips a change under 15 s", () =>
    expect(shouldSend({ changed: true, lastSentAt: 1000, now: 15999 })).toBe(
      false,
    ));
  it("sends a change at 15 s", () =>
    expect(shouldSend({ changed: true, lastSentAt: 1000, now: 16000 })).toBe(
      true,
    ));
  it("skips when unchanged", () =>
    expect(shouldSend({ changed: false, lastSentAt: 1000, now: 99999 })).toBe(
      false,
    ));
});
