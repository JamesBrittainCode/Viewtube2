import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('live_chat_messages')
    .select('id,stream_id,user_id,content,created_at,profiles:profiles!live_chat_messages_user_id_fkey(username,handle,avatar_url,verified)')
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
    .select('id,is_live')
    .eq('id', id)
    .maybeSingle();
  if (!stream || !stream.is_live) {
    return NextResponse.json({ error: 'Live stream is offline' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('live_chat_messages')
    .insert({ stream_id: id, user_id: user.id, content })
    .select('id,stream_id,user_id,content,created_at,profiles:profiles!live_chat_messages_user_id_fkey(username,handle,avatar_url,verified)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ message: data });
}
