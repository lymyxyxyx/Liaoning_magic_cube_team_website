type WeeklyHistoryCandidate = {
  id: string;
  dataVersion: number;
  endsAt?: string | null;
};

/**
 * A v2 meet becomes public history as soon as its configured end time has
 * passed. This deliberately uses the stored end time instead of a fixed slug
 * list, so new weeks do not need a code release to appear to visitors.
 */
export function isGuestWeeklyHistoryMeet(meet: WeeklyHistoryCandidate, now = new Date()) {
  if (meet.id === "weekly-test-entry" || meet.dataVersion !== 2 || !meet.endsAt) return false;
  const endsAt = new Date(meet.endsAt).getTime();
  return Number.isFinite(endsAt) && endsAt < now.getTime();
}

/**
 * Proxy-level slug check: the middleware cannot query the database, so it
 * uses the naming convention to decide whether a slug looks like a v2 meet
 * that should be publicly visible. The actual visibility gate is
 * `isGuestWeeklyHistoryMeet`, which checks the database end time.
 */
export function isGuestWeeklyHistorySlug(slug: string) {
  return /^20\d{2}-week-\d{1,3}$/.test(slug);
}
