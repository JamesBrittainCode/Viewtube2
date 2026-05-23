type StreakPayload = {
  advanced?: boolean;
  current_streak?: number;
  longest_streak?: number;
  points_total?: number;
  points_delta?: number;
  last_active_date?: string | null;
};

export function emitStreakEvent(payload: unknown) {
  if (typeof window === 'undefined') return;
  const streak = payload as StreakPayload | null;
  if (!streak || typeof streak.current_streak !== 'number') return;
  const pointsDelta = Number(streak.points_delta || 0);
  if (Number.isFinite(pointsDelta) && pointsDelta > 0) {
    window.dispatchEvent(new CustomEvent('viewtube-points', { detail: streak }));
  }
  if (streak.advanced) {
    window.dispatchEvent(new CustomEvent('viewtube-streak', { detail: streak }));
  }
}
