import fs from 'node:fs';
import path from 'node:path';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyIfExists(src, dest) {
  if (!fs.existsSync(src)) return false;
  fs.copyFileSync(src, dest);
  return true;
}

const projectRoot = process.cwd();
const srcDir = path.join(projectRoot, 'node_modules', '@ffmpeg', 'core', 'dist', 'umd');
const outDir = path.join(projectRoot, 'public', 'ffmpeg');

ensureDir(outDir);

const copiedJs = copyIfExists(path.join(srcDir, 'ffmpeg-core.js'), path.join(outDir, 'ffmpeg-core.js'));
const copiedWasm = copyIfExists(path.join(srcDir, 'ffmpeg-core.wasm'), path.join(outDir, 'ffmpeg-core.wasm'));

if (!copiedJs || !copiedWasm) {
  // Keep install from failing hard; compression will show a helpful error if assets are missing.
  // eslint-disable-next-line no-console
  console.warn('[viewtube] ffmpeg core assets not found; video compression may be unavailable.');
}

