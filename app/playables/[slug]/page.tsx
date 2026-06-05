import { notFound, redirect } from 'next/navigation';
import { PlayablePlayer } from '@/components/playables/playable-player';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

const builtInGames = {
  'flappy-dunk': {
    title: 'Flappy Dunk',
    slug: 'flappy-dunk',
    description: 'Guide the winged basketball through hoops and keep your streak alive.',
    game_url: '/playables/flappy-dunk/index.html',
    instructions:
      'Tap or click to flap. Time your jumps to dunk through each hoop. Your launch is saved as a play; score syncing is available when the game posts ViewTube score messages.',
  },
} as const;

export default async function PlayableGamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/sign-in?next=/playables/${encodeURIComponent(slug)}`);

  const { data: game } = await supabase
    .from('playable_games')
    .select('title,slug,description,game_url,instructions')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  const playable = game || builtInGames[slug as keyof typeof builtInGames] || null;
  if (!playable) notFound();

  const { data: progress } = await supabase
    .from('playable_scores')
    .select('high_score,level,plays,last_score')
    .eq('user_id', user.id)
    .eq('game_key', slug)
    .maybeSingle();

  return <PlayablePlayer game={playable as never} progress={(progress || null) as never} />;
}
