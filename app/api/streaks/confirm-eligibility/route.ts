import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('contest_disqualified_at')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.contest_disqualified_at) {
    return NextResponse.json(
      { error: 'You are no longer eligible for the ViewTube contest.' },
      { status: 403 },
    );
  }

  const { error } = await supabase
    .from('profiles')
    .update({ age_confirmed_16: true, age_confirmed_at: new Date().toISOString() })
    .eq('id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
