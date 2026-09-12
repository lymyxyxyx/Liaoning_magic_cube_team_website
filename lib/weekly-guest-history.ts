type WeeklyHistoryCandidate = {
  id: string;
  dataVersion: number;
  endsAt?: string | null;
  startsAt?: string | null;
  status?: string | null;
  isPublic?: boolean;
};

/** A v2 meet is always guest-visible; v1 meets still follow the public flag. */
export function isGuestVisibleWeeklyMeet(meet: WeeklyHistoryCandidate) {
  return meet.id !== "weekly-test-entry" && (meet.dataVersion === 2 || meet.isPublic === true);
}

/** A guest-visible meet belongs in the guest history after its configured end. */
export function isGuestWeeklyHistoryMeet(meet: WeeklyHistoryCandidate, now = new Date()) {
  if (!isGuestVisibleWeeklyMeet(meet) || !meet.endsAt) return false;
  const endsAt = new Date(meet.endsAt).getTime();
  return Number.isFinite(endsAt) && endsAt < now.getTime();
}

/** One source of truth for every guest-facing weekly read path. */
export function isWeeklyMeetVisibleToGuests(meet: WeeklyHistoryCandidate) {
  return isGuestVisibleWeeklyMeet(meet);
}

/**
 * Proxy-level slug check: the middleware cannot query the database, so it
 * uses the naming convention only to avoid prompting for an invite code
 * before the detail route can perform its database-backed visibility check.
 */
export function isGuestWeeklyHistorySlug(slug: string) {
  return /^(20\d{2}-week-\d{1,3}|weekly-\d{4}-\d{2}-\d{2}(-\d+)?)$/.test(slug);
}
