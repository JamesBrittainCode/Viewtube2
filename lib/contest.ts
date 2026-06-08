export const VIEWTUBE_CONTEST_END_ISO = '2026-06-08T18:15:00.000Z';
export const VIEWTUBE_CONTEST_END_LABEL = 'Monday, June 8, 2026 at 11:15 AM Pacific';
export const VIEWTUBE_CONTEST_SHORT_LABEL = 'June 8 at 11:15 AM Pacific';
export const VIEWTUBE_CONTEST_BLACKOUT_MINUTES = 30;

export const VIEWTUBE_CONTEST_END_MS = Date.parse(VIEWTUBE_CONTEST_END_ISO);
export const VIEWTUBE_CONTEST_BLACKOUT_START_MS =
  VIEWTUBE_CONTEST_END_MS - VIEWTUBE_CONTEST_BLACKOUT_MINUTES * 60 * 1000;

export function getContestVisibility(nowMs = Date.now(), isAdmin = false) {
  const ended = nowMs >= VIEWTUBE_CONTEST_END_MS;
  const inBlackout =
    nowMs >= VIEWTUBE_CONTEST_BLACKOUT_START_MS && nowMs < VIEWTUBE_CONTEST_END_MS;

  return {
    ended,
    inBlackout,
    resultsHidden: inBlackout && !isAdmin,
  };
}
