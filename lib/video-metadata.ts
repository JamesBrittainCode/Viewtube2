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

export async function getVideoMetadata(file: File): Promise<{
  durationSeconds: number;
  width: number;
  height: number;
}> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  try {
    const meta = await new Promise<{ duration: number; width: number; height: number }>((resolve, reject) => {
      video.onloadedmetadata = () =>
        resolve({
          duration: video.duration || 0,
          width: video.videoWidth || 0,
          height: video.videoHeight || 0,
        });
      video.onerror = () => reject(new Error('Failed to read video metadata.'));
    });

    return {
      durationSeconds: Number.isFinite(meta.duration) ? meta.duration : 0,
      width: Number.isFinite(meta.width) ? meta.width : 0,
      height: Number.isFinite(meta.height) ? meta.height : 0,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
