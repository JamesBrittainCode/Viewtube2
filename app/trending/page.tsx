import { getTrendingVideos } from '@/lib/data';
import { VideoGrid } from '@/components/video-grid';

export const runtime = 'edge';
export const metadata = {
  title: 'Trending Videos',
  description: 'Discover trending videos on ViewTube.',
  alternates: { canonical: '/trending' },
};

export default async function TrendingPage() {
  const videos = await getTrendingVideos();

  return (
    <section>
      <h1 className="mb-6 text-2xl font-bold">Trending in the last 24 hours</h1>
      <VideoGrid videos={videos as never[]} />
    </section>
  );
}
