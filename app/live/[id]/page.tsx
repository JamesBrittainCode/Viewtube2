import { notFound, redirect } from 'next/navigation';
import { LiveStreamRoom } from '@/components/live-stream-room';
import { LivePolicyGate } from '@/components/live-policy-gate';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export default async function LiveStreamWatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const [{ data: stream }, { data: messages }, { data: profile }] = await Promise.all([
    supabase
      .from('live_streams')
      .select('id,user_id,title,description,thumbnail_url,is_live,viewer_count,started_at,chat_enabled,chat_subscribers_only,chat_slow_mode_seconds')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('live_chat_messages')
      .select(
        'id,stream_id,user_id,content,pinned,is_deleted,deleted_at,deleted_by,created_at,profiles:profiles!live_chat_messages_user_id_fkey(username,handle,avatar_url,verified)',
      )
      .eq('stream_id', id)
      .order('created_at', { ascending: true })
      .limit(150),
    supabase.from('profiles').select('id').eq('id', user.id).maybeSingle(),
  ]);

  if (!stream || (!stream.is_live && stream.user_id !== user.id)) {
    notFound();
  }
  if (!profile) redirect('/sign-in');

  return (
    <LivePolicyGate role={user.id === stream.user_id ? 'creator' : 'viewer'}>
      <LiveStreamRoom
        streamId={stream.id}
        ownerId={stream.user_id}
        initialTitle={stream.title}
        initialDescription={stream.description || ''}
        initialViewerCount={stream.viewer_count || 0}
        initialMessages={(messages || []) as never[]}
        userId={user.id}
        isOwner={user.id === stream.user_id}
        initialChatEnabled={stream.chat_enabled !== false}
        initialChatSubscribersOnly={Boolean(stream.chat_subscribers_only)}
        initialChatSlowModeSeconds={Number(stream.chat_slow_mode_seconds || 0)}
      />
    </LivePolicyGate>
  );
}
