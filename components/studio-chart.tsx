export function StudioChart({ labels, values }: { labels: string[]; values: number[] }) {
  const max = Math.max(...values, 1);

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-zinc-100">Views Trend (last 12 months)</h4>
        <span className="text-xs text-zinc-400">Estimated from uploaded video totals</span>
      </div>

      <div className="flex h-40 items-end gap-2">
        {values.map((value, idx) => {
          const height = Math.max(8, Math.round((value / max) * 140));
          return (
            <div key={`${labels[idx]}-${idx}`} className="group flex min-w-0 flex-1 flex-col items-center gap-2">
              <div
                className="w-full rounded-t-md bg-gradient-to-t from-red-600 to-red-400 transition-all duration-300 group-hover:from-red-500 group-hover:to-red-300"
                style={{ height: `${height}px` }}
                title={`${labels[idx]}: ${value.toLocaleString()} views`}
              />
              <span className="text-[10px] text-zinc-500">{labels[idx]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
