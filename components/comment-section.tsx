'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import type { Comment } from '@/lib/types';

type FlatComment = Comment & {
  profiles?: {
    username: string;
    avatar_url: string | null;
  };
};

function nestComments(comments: FlatComment[]): Comment[] {
  const map = new Map<string, Comment>();
  const roots: Comment[] = [];

  comments.forEach((item) => {
    map.set(item.id, {
      ...item,
      profile: {
        username: item.profiles?.username || 'unknown',
        avatar_url: item.profiles?.avatar_url || null,
      },
      replies: [],
    });
  });

  map.forEach((comment) => {
    if (comment.parent_id) {
      const parent = map.get(comment.parent_id);
      parent?.replies?.push(comment);
    } else {
      roots.push(comment);
    }
  });

  return roots;
}

function CommentItem({
  item,
  onReply,
}: {
  item: Comment;
  onReply: (parentId: string, content: string) => Promise<void>;
}) {
  const [showReply, setShowReply] = useState(false);
  const [value, setValue] = useState('');

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!value.trim()) return;
    await onReply(item.id, value.trim());
    setValue('');
    setShowReply(false);
  }

  return (
    <div className="py-3">
      <div className="flex gap-3">
        <Image
          src={item.profile?.avatar_url || '/avatar-placeholder.svg'}
          alt={item.profile?.username || 'User'}
          width={32}
          height={32}
          className="h-8 w-8 rounded-full object-cover"
        />
        <div className="flex-1">
          <div className="text-xs text-zinc-500">
            <Link href={`/channel/${item.profile?.username}`} className="font-medium text-zinc-700 dark:text-zinc-300">
              @{item.profile?.username}
            </Link>{' '}
            • {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
          </div>
          <p className="mt-1 text-sm">{item.content}</p>
          <button
            type="button"
            onClick={() => setShowReply((state) => !state)}
            className="mt-2 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Reply
          </button>

          {showReply && (
            <form onSubmit={submitReply} className="mt-2 flex gap-2">
              <input
                value={value}
                onChange={(event) => setValue(event.target.value)}
                className="h-9 flex-1 rounded-full border border-zinc-300 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                placeholder="Write a reply"
              />
              <button className="rounded-full bg-zinc-900 px-3 text-xs font-semibold text-white dark:bg-white dark:text-zinc-900">
                Post
              </button>
            </form>
          )}

          {!!item.replies?.length && (
            <div className="ml-6 mt-3 border-l border-zinc-200 pl-4 dark:border-zinc-800">
              {item.replies?.map((reply) => (
                <CommentItem key={reply.id} item={reply} onReply={onReply} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function CommentSection({ videoId }: { videoId: string }) {
  const [comments, setComments] = useState<FlatComment[]>([]);
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadComments() {
    const res = await fetch(`/api/videos/${videoId}/comments`, { cache: 'no-store' });
    const data = await res.json();
    setComments(data.comments || []);
    setLoading(false);
  }

  useEffect(() => {
    loadComments();

    const supabase = createClient();
    const channel = supabase
      .channel(`comments-${videoId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `video_id=eq.${videoId}`,
        },
        () => {
          loadComments();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [videoId]);

  async function postComment(parentId: string | null, content: string) {
    const res = await fetch(`/api/videos/${videoId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId, content }),
    });

    if (res.ok) {
      setValue('');
      await loadComments();
    }
  }

  const tree = useMemo(() => nestComments(comments), [comments]);

  return (
    <section className="mt-6">
      <h3 className="text-lg font-semibold">Comments</h3>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!value.trim()) return;
          postComment(null, value.trim());
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Add a comment"
          className="h-10 flex-1 rounded-full border border-zinc-300 px-4 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button className="rounded-full bg-zinc-900 px-4 text-sm font-medium text-white dark:bg-white dark:text-zinc-900">
          Comment
        </button>
      </form>

      <div className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
        {loading ? (
          <p className="text-sm text-zinc-500">Loading comments...</p>
        ) : (
          tree.map((comment) => (
            <CommentItem
              key={comment.id}
              item={comment}
              onReply={(parentId, content) => postComment(parentId, content)}
            />
          ))
        )}
      </div>
    </section>
  );
}
