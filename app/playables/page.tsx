import { redirect } from 'next/navigation';
import { PlayablesArcade } from '@/components/playables/playables-arcade';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export default async function PlayablesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in?next=/playables');

  const { data: progress } = await supabase
    .from('playable_scores')
    .select('game_key,high_score,level,plays,last_score,updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  return <PlayablesArcade initialProgress={(progress || []) as never[]} />;
}
