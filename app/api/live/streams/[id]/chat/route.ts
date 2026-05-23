import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('live_chat_messages')
    .select(
      'id,stream_id,user_id,content,pinned,is_deleted,deleted_at,deleted_by,created_at,profiles:profiles!live_chat_messages_user_id_fkey(username,handle,avatar_url,verified,top_streamer,streak_champion)',
    )
    .eq('stream_id', id)
    .order('created_at', { ascending: true })
    .limit(150);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ messages: data || [] });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { content?: string };
  const content = String(body.content || '').trim().slice(0, 500);
  if (!content) return NextResponse.json({ error: 'Message is required' }, { status: 400 });

  const { data: stream } = await supabase
    .from('live_streams')
    .select('id,is_live,user_id,chat_enabled,chat_subscribers_only,chat_slow_mode_seconds')
    .eq('id', id)
    .maybeSingle();
  if (!stream || !stream.is_live) {
    return NextResponse.json({ error: 'Live stream is offline' }, { status: 400 });
  }
  if (stream.chat_enabled === false && user.id !== stream.user_id) {
    return NextResponse.json({ error: 'Chat is disabled for this live stream.' }, { status: 403 });
  }

  if (stream.chat_subscribers_only && user.id !== stream.user_id) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('subscriber_id', user.id)
      .eq('creator_id', stream.user_id)
      .maybeSingle();
    if (!sub) {
      return NextResponse.json(
        { error: 'Subscribers-only chat. Subscribe to chat in this live stream.' },
        { status: 403 },
      );
    }
  }

  const slowMode = Math.max(0, Math.min(120, Number(stream.chat_slow_mode_seconds) || 0));
  if (slowMode > 0 && user.id !== stream.user_id) {
    const { data: last } = await supabase
      .from('live_chat_messages')
      .select('created_at')
      .eq('stream_id', id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (last?.created_at) {
      const elapsed = (Date.now() - new Date(last.created_at).getTime()) / 1000;
      if (Number.isFinite(elapsed) && elapsed < slowMode) {
        const wait = Math.max(1, Math.ceil(slowMode - elapsed));
        return NextResponse.json(
          { error: `Slow mode is on. Wait ${wait}s before sending another message.` },
          { status: 429 },
        );
      }
    }
  }

  const { data, error } = await supabase
    .from('live_chat_messages')
    .insert({ stream_id: id, user_id: user.id, content })
    .select(
      'id,stream_id,user_id,content,pinned,is_deleted,deleted_at,deleted_by,created_at,profiles:profiles!live_chat_messages_user_id_fkey(username,handle,avatar_url,verified,top_streamer,streak_champion)',
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ message: data });
}
