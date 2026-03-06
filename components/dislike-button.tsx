'use client';

import { ThumbsDown } from 'lucide-react';
import { useState } from 'react';

export function DislikeButton({
  videoId,
  initiallyDisliked,
  initialCount,
}: {
  videoId: string;
  initiallyDisliked: boolean;
  initialCount: number;
}) {
  const [disliked, setDisliked] = useState(initiallyDisliked);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (loading) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/videos/${videoId}/dislike`, { method: 'POST' });
      const data = (await res.json()) as { disliked: boolean; count: number };
      setDisliked(data.disliked);
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
      <ThumbsDown className={`h-4 w-4 ${disliked ? 'fill-current' : ''}`} />
      {count}
    </button>
  );
}
