const PACIFIC_OFFSET_MS = 8 * 60 * 60 * 1000;

export function nextMonday1amPst(from = new Date()) {
  const pstNow = new Date(from.getTime() - PACIFIC_OFFSET_MS);
  const day = pstNow.getUTCDay();
  let daysUntilMonday = (8 - day) % 7;
  if (daysUntilMonday === 0) daysUntilMonday = 7;

  pstNow.setUTCDate(pstNow.getUTCDate() + daysUntilMonday);
  pstNow.setUTCHours(1, 0, 0, 0);

  return new Date(pstNow.getTime() + PACIFIC_OFFSET_MS);
}
