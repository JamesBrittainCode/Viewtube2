export const MAX_UPLOAD_BYTES = 1024 * 1024 * 1024;

export function formatUploadBytes(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${Number.isInteger(gb) ? gb.toFixed(0) : gb.toFixed(1)}GB`;
  }
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${Number.isInteger(mb) ? mb.toFixed(0) : mb.toFixed(1)}MB`;
  }
  return `${bytes} bytes`;
}
