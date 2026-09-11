type WeeklyHistoryCandidate = {
  id: string;
  dataVersion: number;
  endsAt?: string | null;
  startsAt?: string | null;
  status?: string | null;
  isPublic?: boolean;
};

/** A public v2 meet belongs in the guest history after its configured end. */
export function isGuestWeeklyHistoryMeet(meet: WeeklyHistoryCandidate, now = new Date()) {
  if (meet.id === "weekly-test-entry" || meet.dataVersion !== 2 || !meet.isPublic || !meet.endsAt) return false;
  const endsAt = new Date(meet.endsAt).getTime();
  return Number.isFinite(endsAt) && endsAt < now.getTime();
}

/** One source of truth for every guest-facing weekly read path. */
export function isWeeklyMeetVisibleToGuests(meet: WeeklyHistoryCandidate) {
  return meet.id !== "weekly-test-entry" && meet.isPublic === true;
}

/**
 * Proxy-level slug check: the middleware cannot query the database, so it
 * uses the naming convention only to avoid prompting for an invite code
 * before the detail route can perform its database-backed visibility check.
 */
export function isGuestWeeklyHistorySlug(slug: string) {
  return /^20\d{2}-week-\d{1,3}$/.test(slug);
}
