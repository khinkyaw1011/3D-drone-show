import { BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH, WebMOutputFormat, getFirstEncodableVideoCodec } from 'mediabunny';
import type { ShowHandle } from '@/components/canvas/ShowCanvas';

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const safeFilename = (name: string) => name.trim().replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '') || 'skyloom-show';

const canvasBlob = (canvas: HTMLCanvasElement, type = 'image/png') =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read the canvas'))), type));

/** PNG of the current frame. `scale` 2 re-renders at twice the pixel ratio first. */
export async function capturePng(handle: ShowHandle, scale: 1 | 2 = 1): Promise<Blob> {
  const state = handle.getState();
  const dpr = state.viewport.dpr;
  if (scale > 1) state.setDpr(dpr * scale);
  try {
    // Render synchronously, then snapshot in the same task (a WebGPU canvas is only readable until it is presented).
    state.advance(state.clock.elapsedTime);
    return await canvasBlob(state.gl.domElement);
  } finally {
    if (scale > 1) state.setDpr(dpr);
  }
}

export interface VideoOptions {
  fps: 30 | 60;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/**
 * Frame-accurate video of the whole show via WebCodecs (mediabunny): MP4/H.264 when the
 * browser can encode it, otherwise WebM. The show is stepped at a fixed timestep, so the
 * result is smooth regardless of how fast this machine renders.
 */
export async function captureVideo(handle: ShowHandle, { fps, onProgress, signal }: VideoOptions): Promise<{ blob: Blob; extension: string }> {
  if (typeof VideoEncoder === 'undefined') throw new Error('This browser cannot encode video (WebCodecs is missing)');
  const state = handle.getState();
  const { player } = handle;
  const canvas = state.gl.domElement;
  const size = { width: canvas.width, height: canvas.height };

  const formats = [new Mp4OutputFormat(), new WebMOutputFormat()];
  let format = formats[0];
  let codec = null;
  for (const candidate of formats) {
    codec = await getFirstEncodableVideoCodec(candidate.getSupportedVideoCodecs(), size);
    if (codec) {
      format = candidate;
      break;
    }
  }
  if (!codec) throw new Error('No supported video encoder found in this browser');

  const output = new Output({ format, target: new BufferTarget() });
  const source = new CanvasSource(canvas, { codec, bitrate: QUALITY_HIGH });
  output.addVideoTrack(source, { frameRate: fps });

  const wasPlaying = player.playing;
  const resumeAt = player.time;
  const frames = Math.max(1, Math.ceil(player.duration * fps));
  const start = state.clock.elapsedTime;
  state.setFrameloop('never');
  try {
    await output.start();
    player.seek(0);
    for (let f = 0; f < frames; f++) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const t = f / fps;
      player.scrubTo(t);
      state.advance(start + t);
      await source.add(t, 1 / fps);
      onProgress?.((f + 1) / frames);
    }
    await output.finalize();
  } catch (error) {
    await output.cancel().catch(() => {});
    throw error;
  } finally {
    state.setFrameloop('always');
    player.seek(resumeAt);
    if (wasPlaying) player.play();
  }
  const buffer = (output.target as BufferTarget).buffer;
  if (!buffer) throw new Error('Video export produced no data');
  return { blob: new Blob([buffer], { type: format.mimeType }), extension: format.fileExtension.replace(/^\./, '') };
}
