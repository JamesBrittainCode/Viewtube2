'use client';

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

type FingerprintProgress = (message: string) => void;

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoaded = false;

async function ensureFfmpegLoaded() {
  if (ffmpegLoaded && ffmpegInstance) return ffmpegInstance;

  const ffmpeg = ffmpegInstance || new FFmpeg();
  ffmpegInstance = ffmpeg;

  const coreURL = await toBlobURL('/ffmpeg/ffmpeg-core.js', 'text/javascript');
  const wasmURL = await toBlobURL('/ffmpeg/ffmpeg-core.wasm', 'application/wasm');

  await ffmpeg.load({ coreURL, wasmURL });
  ffmpegLoaded = true;
  return ffmpeg;
}

function toPlainArrayBuffer(u8: Uint8Array): ArrayBuffer {
  // Some environments type the underlying buffer as ArrayBuffer | SharedArrayBuffer.
  // Chromaprint expects a plain ArrayBuffer, so we copy.
  const copy = new Uint8Array(u8.byteLength);
  copy.set(u8);
  return copy.buffer;
}

export async function computeAcoustIdFingerprintFromVideo(input: {
  videoFile: File;
  durationSeconds: number;
  maxSampleSeconds?: number;
  onProgress?: FingerprintProgress;
}): Promise<{ fingerprint: string; durationSeconds: number }> {
  const maxSampleSeconds = Math.max(5, Math.min(90, Math.round(input.maxSampleSeconds ?? 30)));
  const durationSeconds = Math.max(1, Math.round(input.durationSeconds || 0));
  const sampleSeconds = Math.min(durationSeconds, maxSampleSeconds);

  input.onProgress?.('Loading analyzer…');
  const ffmpeg = await ensureFfmpegLoaded();

  const inputName = `fp-input-${crypto.randomUUID()}.mp4`;
  const outputName = `fp-output-${crypto.randomUUID()}.wav`;

  input.onProgress?.('Extracting audio…');
  await ffmpeg.writeFile(inputName, await fetchFile(input.videoFile));
  await ffmpeg.exec([
    '-hide_banner',
    '-i',
    inputName,
    '-t',
    String(sampleSeconds),
    '-vn',
    '-ac',
    '1',
    '-ar',
    '44100',
    '-f',
    'wav',
    outputName,
  ]);

  const wavBytes = await ffmpeg.readFile(outputName);

  // Cleanup best-effort to keep memory low.
  await ffmpeg.deleteFile(inputName).catch(() => null);
  await ffmpeg.deleteFile(outputName).catch(() => null);

  input.onProgress?.('Generating fingerprint…');
  const { processAudioFile, ChromaprintAlgorithm } = await import('@unimusic/chromaprint');

  const wavArrayBuffer = toPlainArrayBuffer(wavBytes as Uint8Array);
  let firstFingerprint: string | null = null;
  for await (const fp of processAudioFile(wavArrayBuffer, {
    maxDuration: sampleSeconds,
    chunkDuration: 0,
    algorithm: ChromaprintAlgorithm.Default,
    rawOutput: false,
    overlap: false,
  })) {
    firstFingerprint = fp;
    break;
  }

  if (!firstFingerprint) throw new Error('Could not generate an audio fingerprint.');
  return { fingerprint: firstFingerprint, durationSeconds: sampleSeconds };
}
