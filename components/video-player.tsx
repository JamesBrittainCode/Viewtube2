'use client';

import { useEffect } from 'react';

type Props = {
  id: string;
  videoUrl: string;
};

export function VideoPlayer({ id, videoUrl }: Props) {
  useEffect(() => {
    const key = `viewed:${id}`;

    if (sessionStorage.getItem(key)) return;

    fetch(`/api/videos/${id}/view`, { method: 'POST' })
      .then(() => sessionStorage.setItem(key, '1'))
      .catch(() => null);
  }, [id]);

  return (
    <video
      src={videoUrl}
      controls
      preload="metadata"
      className="viewtube-player aspect-video w-full rounded-xl bg-black"
    />
  );
}
