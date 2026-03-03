export function buildMonthlySeries(videos: Array<{ created_at: string; views: number }>) {
  const now = new Date();
  const labels: string[] = [];
  const values: number[] = [];

  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    labels.push(
      d.toLocaleString('en-US', {
        month: 'short',
      }),
    );

    const monthValue = videos.reduce((sum, video) => {
      const vd = new Date(video.created_at);
      if (vd.getFullYear() === year && vd.getMonth() === month) {
        return sum + (video.views || 0);
      }
      return sum;
    }, 0);

    values.push(monthValue);
  }

  return { labels, values };
}
