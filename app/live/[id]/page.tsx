import { notFound, redirect } from 'next/navigation';
import { LiveStreamRoom } from '@/components/live-stream-room';
import { LivePolicyGate } from '@/components/live-policy-gate';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/admin';
import { AdminLiveControls } from '@/components/admin-live-controls';

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
  const isAdmin = isAdminEmail(user.email);

  const [{ data: stream }, { data: messages }, { data: profile }] = await Promise.all([
    supabase
      .from('live_streams')
      .select('id,user_id,title,description,thumbnail_url,source,ingest_stream_name,is_live,is_paused,paused_reason,paused_at,paused_by,viewer_count,started_at,chat_enabled,chat_subscribers_only,chat_slow_mode_seconds')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('live_chat_messages')
      .select(
        'id,stream_id,user_id,content,pinned,is_deleted,deleted_at,deleted_by,created_at,profiles:profiles!live_chat_messages_user_id_fkey(username,handle,avatar_url,verified,is_admin,top_streamer,streak_champion)',
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

  const hlsBase = (process.env.NEXT_PUBLIC_HLS_BASE_URL || '').replace(/\/+$/, '');
  const ingestName =
    (stream as unknown as { ingest_stream_name?: string | null })?.ingest_stream_name ?? null;
  const source =
    (stream as unknown as { source?: 'webrtc' | 'obs' | null })?.source ?? null;
  const paused =
    Boolean((stream as unknown as { is_paused?: boolean | null })?.is_paused);
  const pauseReason =
    (stream as unknown as { paused_reason?: string | null })?.paused_reason ?? null;
  const hlsManifestUrl =
    source === 'obs' && hlsBase && ingestName
      ? `${hlsBase}/${encodeURIComponent(ingestName)}.m3u8`
      : null;

  return (
    <LivePolicyGate role={user.id === stream.user_id ? 'creator' : 'viewer'}>
      <div className="space-y-4">
        {isAdmin ? <AdminLiveControls streamId={stream.id} /> : null}
        <LiveStreamRoom
          streamId={stream.id}
          ownerId={stream.user_id}
          initialTitle={stream.title}
          initialDescription={stream.description || ''}
          initialSource={(source === 'obs' ? 'obs' : 'webrtc') as 'webrtc' | 'obs'}
          initialHlsManifestUrl={hlsManifestUrl}
          initialPosterUrl={stream.thumbnail_url ?? null}
          initialPaused={paused}
          initialPauseReason={pauseReason}
          initialViewerCount={stream.viewer_count || 0}
          initialStartedAt={stream.started_at}
          initialMessages={(messages || []) as never[]}
          userId={user.id}
          isOwner={user.id === stream.user_id}
          initialChatEnabled={stream.chat_enabled !== false}
          initialChatSubscribersOnly={Boolean(stream.chat_subscribers_only)}
          initialChatSlowModeSeconds={Number(stream.chat_slow_mode_seconds || 0)}
        />
      </div>
    </LivePolicyGate>
  );
}
