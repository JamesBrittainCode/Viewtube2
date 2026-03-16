export async function getVideoDurationSeconds(file: File): Promise<number> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  try {
    const duration = await new Promise<number>((resolve, reject) => {
      video.onloadedmetadata = () => resolve(video.duration || 0);
      video.onerror = () => reject(new Error('Failed to read video metadata.'));
    });
    return Number.isFinite(duration) ? duration : 0;
  } finally {
    URL.revokeObjectURL(url);
  }
}

