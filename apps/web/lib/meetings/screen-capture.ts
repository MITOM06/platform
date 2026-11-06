import { JPEG_QUALITY, MAX_EDGE, THUMB_H, THUMB_W } from "./frame-diff";

/** What the screen-frame hook needs from a capture source (faked in tests). */
export interface ScreenCapture {
  /** 32x18 grayscale bytes of the current frame, or null while the video has no frame yet. */
  thumbnail(): Uint8Array | null;
  /** Current frame scaled to a long edge <= 1280 as JPEG q0.7, or null. */
  frame(): Promise<Blob | null>;
  dispose(): void;
}

/** Offscreen <video> + canvases over a screen-share MediaStream. */
export function createDomScreenCapture(stream: MediaStream): ScreenCapture {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  void video.play().catch(() => {});

  const ready = () =>
    video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0;
  return {
    thumbnail() {
      if (!ready()) return null;
      const canvas = document.createElement("canvas");
      canvas.width = THUMB_W;
      canvas.height = THUMB_H;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, THUMB_W, THUMB_H);
      const { data } = ctx.getImageData(0, 0, THUMB_W, THUMB_H);
      const gray = new Uint8Array(THUMB_W * THUMB_H);
      for (let i = 0; i < gray.length; i++) {
        gray[i] = Math.round(
          0.299 * data[i * 4] +
            0.587 * data[i * 4 + 1] +
            0.114 * data[i * 4 + 2],
        );
      }
      return gray;
    },
    frame() {
      if (!ready()) return Promise.resolve(null);
      const scale = Math.min(
        1,
        MAX_EDGE / Math.max(video.videoWidth, video.videoHeight),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return Promise.resolve(null);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
      );
    },
    dispose() {
      video.pause();
      video.srcObject = null;
    },
  };
}
