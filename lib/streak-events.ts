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
  if (!streak.advanced) return;
  window.dispatchEvent(new CustomEvent('viewtube-streak', { detail: streak }));
}
