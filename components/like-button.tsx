'use client';

import { ThumbsUp } from 'lucide-react';
import { useState } from 'react';

export function LikeButton({
  videoId,
  initiallyLiked,
  initialCount,
}: {
  videoId: string;
  initiallyLiked: boolean;
  initialCount: number;
}) {
  const [liked, setLiked] = useState(initiallyLiked);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (loading) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/videos/${videoId}/like`, { method: 'POST' });
      const data = await res.json();
      setLiked(data.liked);
      setCount(data.count);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-2 text-sm font-medium hover:bg-zinc-200 disabled:opacity-70 dark:bg-zinc-800 dark:hover:bg-zinc-700"
      disabled={loading}
    >
      <ThumbsUp className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />
      {count}
    </button>
  );
}
