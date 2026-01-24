export function daysBetween(a: Date, b: Date) {
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function getWeekAndDay(startDateISO: string, today = new Date()) {
  // startDateISO like "2026-01-21"
  const start = new Date(startDateISO + "T00:00:00");
  const diffDays = daysBetween(start, today);

  const weekNumber = Math.floor(diffDays / 7) + 1;      // 1-based
  const dayNumber = (diffDays % 7) + 1;                 // 1..7

  return { weekNumber, dayNumber };
}
