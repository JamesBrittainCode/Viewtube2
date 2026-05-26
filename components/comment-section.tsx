'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MessageCircle, Pin, Reply, ThumbsUp, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { emitStreakEvent } from '@/lib/streak-events';
import { StreakFireBadge } from '@/components/streak-fire-badge';
import { VerifiedBadge } from '@/components/verified-badge';
import { TopStreamerBadge } from '@/components/top-streamer-badge';
import type { Comment } from '@/lib/types';

type FlatComment = Comment & {
  profiles?: {
    username: string;
    handle: string;
    avatar_url: string | null;
    verified: boolean;
    top_streamer?: boolean;
    streak_champion?: boolean;
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
        handle: item.profiles?.handle || '',
        avatar_url: item.profiles?.avatar_url || null,
        verified: item.profiles?.verified || false,
        top_streamer: Boolean(item.profiles?.top_streamer),
        streak_champion: Boolean(item.profiles?.streak_champion),
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

  roots.sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
  return roots;
}

function CommentItem({
  item,
  currentUserId,
  videoOwnerId,
  commentsEnabled,
  onReply,
  onDelete,
  onTogglePin,
  onToggleLike,
}: {
  item: Comment;
  currentUserId: string | null;
  videoOwnerId: string;
  commentsEnabled: boolean;
  onReply: (parentId: string, content: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onTogglePin: (commentId: string, pinned: boolean) => Promise<void>;
  onToggleLike: (commentId: string) => Promise<void>;
}) {
  const [showReply, setShowReply] = useState(false);
  const [value, setValue] = useState('');

  const canReply = commentsEnabled;
  const canDelete = Boolean(currentUserId && (currentUserId === item.user_id || currentUserId === videoOwnerId));
  const canPin = Boolean(currentUserId && currentUserId === videoOwnerId && !item.parent_id);

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!value.trim()) return;
    await onReply(item.id, value.trim());
    setValue('');
    setShowReply(false);
  }

  return (
    <article className={`rounded-2xl border bg-white p-3 shadow-sm dark:bg-zinc-900 ${item.pinned ? 'border-red-300 dark:border-red-800' : 'border-zinc-200 dark:border-zinc-800'}`}>
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
            <span className="inline-flex items-center gap-1">
              <Link href={`/channel/${item.profile?.handle || item.profile?.username}`} className="font-medium text-zinc-800 hover:underline dark:text-zinc-200">
                @{item.profile?.username}
              </Link>
              {item.profile?.streak_champion && <StreakFireBadge className="h-3.5 w-3.5" />}
              {item.profile?.verified && <VerifiedBadge className="h-3.5 w-3.5" />}
              {item.profile?.top_streamer && <TopStreamerBadge className="h-3.5 w-3.5" />}
            </span>{' '}
            • {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
            {item.pinned ? (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                <Pin className="h-3 w-3" />
                Pinned
              </span>
            ) : null}
          </div>
          <p className="mt-1.5 text-sm leading-relaxed">{item.content}</p>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
            <button
              type="button"
              onClick={() => void onToggleLike(item.id)}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 ${item.liked_by_me ? 'text-red-500' : ''}`}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
              {item.likes_count || 0}
            </button>

            {canReply && (
              <button
                type="button"
                onClick={() => setShowReply((state) => !state)}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <Reply className="h-3.5 w-3.5" />
                Reply
              </button>
            )}

            {canPin && (
              <button
                type="button"
                onClick={() => void onTogglePin(item.id, !item.pinned)}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <Pin className="h-3.5 w-3.5" />
                {item.pinned ? 'Unpin' : 'Pin'}
              </button>
            )}

            {canDelete && (
              <button
                type="button"
                onClick={() => void onDelete(item.id)}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            )}
          </div>

          {showReply && (
            <form onSubmit={submitReply} className="mt-2 flex gap-2">
              <input
                value={value}
                onChange={(event) => setValue(event.target.value)}
                className="h-9 flex-1 rounded-full border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                placeholder="Write a reply"
              />
              <button className="rounded-full bg-red-600 px-3 text-xs font-semibold text-white hover:bg-red-500">
                Post
              </button>
            </form>
          )}

          {!!item.replies?.length && (
            <div className="ml-4 mt-3 space-y-2 border-l border-zinc-200 pl-3 dark:border-zinc-800">
              {item.replies?.map((reply) => (
                <CommentItem
                  key={reply.id}
                  item={reply}
                  currentUserId={currentUserId}
                  videoOwnerId={videoOwnerId}
                  commentsEnabled={commentsEnabled}
                  onReply={onReply}
                  onDelete={onDelete}
                  onTogglePin={onTogglePin}
                  onToggleLike={onToggleLike}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export function CommentSection({
  videoId,
  commentsEnabled,
  currentUserId,
  videoOwnerId,
}: {
  videoId: string;
  commentsEnabled: boolean;
  currentUserId: string | null;
  videoOwnerId: string;
}) {
  const [comments, setComments] = useState<FlatComment[]>([]);
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [postError, setPostError] = useState<string | null>(null);

  async function loadComments() {
    const res = await fetch(`/api/videos/${videoId}/comments`, { cache: 'no-store' });
    const data = await res.json();
    setComments(data.comments || []);
    setLoading(false);
  }

  useEffect(() => {
    void loadComments();

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
          void loadComments();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [videoId]);

  async function postComment(parentId: string | null, content: string) {
    setPostError(null);
    const res = await fetch(`/api/videos/${videoId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId, content }),
    });

    if (res.ok) {
      const data = (await res.json().catch(() => null)) as { streak?: unknown } | null;
      emitStreakEvent(data?.streak);
      setValue('');
      await loadComments();
      return;
    }

    const text = await res.text();
    try {
      const parsed = JSON.parse(text) as { error?: string };
      setPostError(parsed.error || 'Failed to post comment.');
    } catch {
      setPostError(text || 'Failed to post comment.');
    }
  }

  async function deleteComment(commentId: string) {
    const confirmed = window.confirm('Delete this comment?');
    if (!confirmed) return;
    const res = await fetch(`/api/videos/${videoId}/comments`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentId }),
    });
    if (res.ok) await loadComments();
  }

  async function togglePin(commentId: string, pinned: boolean) {
    const res = await fetch(`/api/videos/${videoId}/comments`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentId, pinned }),
    });
    if (res.ok) await loadComments();
  }

  async function toggleLike(commentId: string) {
    const res = await fetch(`/api/videos/${videoId}/comments/${commentId}/like`, {
      method: 'POST',
    });
    if (res.ok) {
      const data = (await res.json().catch(() => null)) as { streak?: unknown } | null;
      emitStreakEvent(data?.streak);
      await loadComments();
    }
  }

  const tree = useMemo(() => nestComments(comments), [comments]);

  return (
    <section id="comments" className="mt-8 rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
      <h3 className="inline-flex items-center gap-2 text-lg font-semibold">
        <MessageCircle className="h-5 w-5 text-zinc-500" />
        Comments
      </h3>

      {commentsEnabled ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!value.trim()) return;
            void postComment(null, value.trim());
          }}
          className="mt-4 flex gap-2"
        >
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Add a comment"
            className="h-11 flex-1 rounded-full border border-zinc-300 bg-white px-4 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button className="rounded-full bg-red-600 px-5 text-sm font-medium text-white hover:bg-red-500">
            Comment
          </button>
        </form>
      ) : (
        <p className="mt-3 text-sm text-zinc-500">
          Comments are turned off for this video.
        </p>
      )}
      {postError ? <p className="mt-2 text-sm text-red-500">{postError}</p> : null}

      <div className="mt-5 space-y-3">
        {loading ? (
          <p className="text-sm text-zinc-500">Loading comments...</p>
        ) : tree.length ? (
          tree.map((comment) => (
            <CommentItem
              key={comment.id}
              item={comment}
              currentUserId={currentUserId}
              videoOwnerId={videoOwnerId}
              commentsEnabled={commentsEnabled}
              onReply={(parentId, content) => postComment(parentId, content)}
              onDelete={deleteComment}
              onTogglePin={togglePin}
              onToggleLike={toggleLike}
            />
          ))
        ) : (
          <p className="text-sm text-zinc-500">No comments yet.</p>
        )}
      </div>
    </section>
  );
}
