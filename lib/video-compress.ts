'use client';

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { formatUploadBytes } from '@/lib/upload-limits';

type CompressOptions = {
  maxBytes: number;
  onProgress?: (ratio: number) => void;
};

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoaded = false;
let progressCallback: ((ratio: number) => void) | null = null;

async function getVideoDurationSeconds(file: File): Promise<number> {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.src = objectUrl;
  video.muted = true;
  video.playsInline = true;

  try {
    const duration = await new Promise<number>((resolve, reject) => {
      video.onloadedmetadata = () => resolve(video.duration || 0);
      video.onerror = () => reject(new Error('Could not read video metadata.'));
    });
    return Number.isFinite(duration) ? duration : 0;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function ensureFfmpegLoaded() {
  if (ffmpegLoaded && ffmpegInstance) return ffmpegInstance;

  const ffmpeg = ffmpegInstance || new FFmpeg();
  ffmpegInstance = ffmpeg;

  // Load core from same-origin static assets to avoid adblock/CDN/network failures.
  // `scripts/copy-ffmpeg-core.mjs` copies these into `public/ffmpeg/` on install.
  const coreURL = await toBlobURL('/ffmpeg/ffmpeg-core.js', 'text/javascript');
  const wasmURL = await toBlobURL('/ffmpeg/ffmpeg-core.wasm', 'application/wasm');

  // Single progress listener; we swap the callback per job.
  ffmpeg.on('progress', (event) => {
    const payload = event as unknown as { progress?: number };
    progressCallback?.(payload.progress ?? 0);
  });

  await ffmpeg.load({ coreURL, wasmURL });
  ffmpegLoaded = true;
  return ffmpeg;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

async function transcodeAttempt(
  input: File,
  attempt: number,
  durationSec: number,
  opts: CompressOptions,
): Promise<File> {
  const ffmpeg = await ensureFfmpegLoaded();
  const inputName = `input-${attempt}.mp4`;
  const outputName = `output-${attempt}.mp4`;

  // Target bitrate: (maxBytes * 8) / duration, leave headroom.
  const totalTarget = Math.floor(((opts.maxBytes * 8) / Math.max(1, durationSec)) * 0.92);
  const audioBitrate = 64_000;
  const targetVideoBitrate = clamp(totalTarget - audioBitrate, 150_000, 4_000_000);
  const scaleWidth = attempt === 0 ? 854 : 640;

  // If we need to be extra aggressive, reduce bitrate further on later attempts.
  const videoBitrate = Math.floor(targetVideoBitrate * (attempt === 0 ? 1 : 0.78));

  progressCallback = opts.onProgress || null;

  await ffmpeg.writeFile(inputName, await fetchFile(input));

  const args = [
    '-hide_banner',
    '-i',
    inputName,
    '-vf',
    `scale='min(${scaleWidth},iw)':-2`,
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-b:v',
    String(videoBitrate),
    '-maxrate',
    String(videoBitrate),
    '-bufsize',
    String(videoBitrate * 2),
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    String(audioBitrate),
    '-movflags',
    '+faststart',
    outputName,
  ];

  await ffmpeg.exec(args);
  const data = await ffmpeg.readFile(outputName);

  // Cleanup best-effort to keep memory low.
  await ffmpeg.deleteFile(inputName).catch(() => null);
  await ffmpeg.deleteFile(outputName).catch(() => null);

  const blob = new Blob([data as unknown as BlobPart], { type: 'video/mp4' });
  return new File([blob], `viewtube-compressed-${Date.now()}.mp4`, { type: 'video/mp4' });
}

export async function compressVideoIfNeeded(input: File, opts: CompressOptions): Promise<File> {
  if (input.size <= opts.maxBytes) return input;

  const duration = await getVideoDurationSeconds(input);
  if (!duration || duration <= 0) {
    throw new Error('Could not determine video duration for compression.');
  }

  // If a long video needs to fit under the configured upload limit, quality can get extremely low.
  if (duration > 60 * 20) {
    throw new Error(`This video is too long to reliably compress under ${formatUploadBytes(opts.maxBytes)}. Please trim it shorter.`);
  }

  // Attempt 1–2 passes.
  let first: File;
  try {
    first = await transcodeAttempt(input, 0, duration, opts);
  } catch {
    throw new Error('Video compression failed to load. Please disable ad blockers or try again.');
  }
  if (first.size <= opts.maxBytes) return first;

  const second = await transcodeAttempt(first, 1, duration, opts);
  if (second.size <= opts.maxBytes) return second;

  throw new Error(`Could not compress this video under ${formatUploadBytes(opts.maxBytes)}. Try trimming the video or lowering resolution.`);
}
