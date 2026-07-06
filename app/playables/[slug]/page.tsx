import { notFound, redirect } from 'next/navigation';
import { PlayablePlayer } from '@/components/playables/playable-player';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export const metadata = {
  title: 'Playable Game',
  description: 'Play a ViewTube playable game.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

const builtInGames = {
  tetris: {
    title: 'Tetris',
    slug: 'tetris',
    description: 'Stack falling blocks, clear rows, and chase a new high score.',
    game_url: '/playables/tetris/index.html',
    instructions:
      'Use the arrow keys to move and rotate blocks. Clear full rows to score. The game starts automatically in ViewTube Playables.',
  },
  'flappy-dunk': {
    title: 'Flappy Dunk',
    slug: 'flappy-dunk',
    description: 'Guide the winged basketball through hoops and keep your streak alive.',
    game_url: '/playables/flappy-dunk/index.html',
    instructions:
      'Tap or click to flap. Time your jumps to dunk through each hoop. Your launch is saved as a play; score syncing is available when the game posts ViewTube score messages.',
  },
} as const;

export default async function PlayableGamePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ from?: string; earn?: string }>;
}) {
  const { slug } = await params;
  const query = (await searchParams) || {};
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pointsEligible = slug === 'flappy-dunk' && (query.from === 'leaderboard' || query.earn === 'streak');
  const nextUrl = `/playables/${encodeURIComponent(slug)}${pointsEligible ? '?from=leaderboard' : ''}`;

  if (!user) redirect(`/sign-in?next=${encodeURIComponent(nextUrl)}`);

  const { data: game } = await supabase
    .from('playable_games')
    .select('title,slug,description,game_url,instructions')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  const playable = builtInGames[slug as keyof typeof builtInGames] || game || null;
  if (!playable) notFound();

  const { data: progress } = await supabase
    .from('playable_scores')
    .select('high_score,level,plays,last_score')
    .eq('user_id', user.id)
    .eq('game_key', slug)
    .maybeSingle();

  return <PlayablePlayer game={playable as never} progress={(progress || null) as never} pointsEligible={pointsEligible} />;
}
