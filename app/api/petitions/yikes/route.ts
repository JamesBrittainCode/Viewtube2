import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createPublicClient } from '@/lib/supabase/public';

export const runtime = 'edge';

const PETITION_KEY = 'yikes_x_viewtube';

export async function GET() {
  const publicClient = createPublicClient();
  const { count } = await publicClient
    .from('petition_votes')
    .select('*', { count: 'exact', head: true })
    .eq('petition_key', PETITION_KEY);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let voted = false;
  if (user) {
    const { data } = await supabase
      .from('petition_votes')
      .select('id')
      .eq('petition_key', PETITION_KEY)
      .eq('user_id', user.id)
      .maybeSingle();
    voted = Boolean(data);
  }

  return NextResponse.json({ petitionKey: PETITION_KEY, count: count || 0, voted });
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase.from('petition_votes').insert({
    petition_key: PETITION_KEY,
    user_id: user.id,
  });

  // Ignore unique-violation (already voted).
  if (error && error.code !== '23505') {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('petition_votes')
    .delete()
    .eq('petition_key', PETITION_KEY)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

