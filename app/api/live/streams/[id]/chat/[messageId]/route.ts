import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; messageId: string }> },
) {
  const { id: streamId, messageId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    action?: 'pin' | 'unpin' | 'delete';
  };
  const action = body.action;
  if (!action) return NextResponse.json({ error: 'Missing action' }, { status: 400 });

  const { data: stream } = await supabase
    .from('live_streams')
    .select('id,user_id')
    .eq('id', streamId)
    .maybeSingle();
  if (!stream) return NextResponse.json({ error: 'Stream not found' }, { status: 404 });
  if (stream.user_id !== user.id) {
    return NextResponse.json({ error: 'Only the stream owner can moderate chat' }, { status: 403 });
  }

  const { data: msg } = await supabase
    .from('live_chat_messages')
    .select('id,stream_id')
    .eq('id', messageId)
    .eq('stream_id', streamId)
    .maybeSingle();
  if (!msg) return NextResponse.json({ error: 'Message not found' }, { status: 404 });

  if (action === 'pin') {
    // Best-effort: keep one pinned message at a time.
    await supabase.from('live_chat_messages').update({ pinned: false }).eq('stream_id', streamId).eq('pinned', true);
    const { error } = await supabase
      .from('live_chat_messages')
      .update({ pinned: true })
      .eq('id', messageId)
      .eq('stream_id', streamId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'unpin') {
    const { error } = await supabase
      .from('live_chat_messages')
      .update({ pinned: false })
      .eq('id', messageId)
      .eq('stream_id', streamId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'delete') {
    const { error } = await supabase
      .from('live_chat_messages')
      .update({
        pinned: false,
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
        content: '[deleted]',
      })
      .eq('id', messageId)
      .eq('stream_id', streamId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

