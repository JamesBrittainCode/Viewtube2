import { redirect } from 'next/navigation';
import { PlayablesArcade } from '@/components/playables/playables-arcade';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';
export const metadata = {
  title: 'Playables',
  description: 'Play small games on ViewTube and keep track of your scores.',
  robots: {
    index: false,
    follow: false,
  },
};

const builtInGames = [
  {
    id: 'built-in-tetris',
    title: 'Tetris',
    slug: 'tetris',
    description: 'Stack falling blocks, clear rows, and chase a new high score.',
    category: 'Puzzle',
    thumbnail_url: '/playables/tetris/thumbnail.png',
    game_url: '/playables/tetris/index.html',
    plays_count: 0,
    created_at: '2026-06-05T00:00:00.000Z',
  },
  {
    id: 'built-in-flappy-dunk',
    title: 'Flappy Dunk',
    slug: 'flappy-dunk',
    description: 'Guide the winged basketball through hoops and keep your streak alive.',
    category: 'Sports',
    thumbnail_url: '/playables/flappy-dunk/thumbnail.png',
    game_url: '/playables/flappy-dunk/index.html',
    plays_count: 0,
    created_at: '2026-06-04T00:00:00.000Z',
  },
];

export default async function PlayablesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in?next=/playables');

  const [{ data: games }, { data: progress }] = await Promise.all([
    supabase
      .from('playable_games')
      .select('id,title,slug,description,category,thumbnail_url,game_url,plays_count,created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false }),
    supabase
      .from('playable_scores')
      .select('game_key,high_score,level,plays,last_score,updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false }),
  ]);

  const uploadedGames = games || [];
  const builtInSlugs = new Set(builtInGames.map((game) => game.slug));
  const mergedGames = [...builtInGames, ...uploadedGames.filter((game) => !builtInSlugs.has(String(game.slug)))];

  return <PlayablesArcade games={mergedGames as never[]} initialProgress={(progress || []) as never[]} />;
}
