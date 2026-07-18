export function isWeeklyCompetitionEnabled() {
  return process.env.WEEKLY_COMPETITION_ENABLED === "true";
}

export function isWeeklyFocusMeet(_meet: { id?: string; slug?: string }) {
  return true;
}

export function isWeeklyMeetPubliclyVisible(meet: { status?: string | null; publishedAt?: string | null }) {
  if (!meet.status || meet.status === "draft") return false;
  if (meet.status === "archived" && !meet.publishedAt) return false;
  if (!meet.publishedAt) return true;
  const publishedAt = new Date(meet.publishedAt).getTime();
  return Number.isFinite(publishedAt) && publishedAt <= Date.now();
}

export function isWeeklyMeetCurrent(meet: { status?: string | null; startsAt?: string | null; endsAt?: string | null }) {
  if (meet.status !== "open") return false;
  const now = Date.now();
  const startsAt = meet.startsAt ? new Date(meet.startsAt).getTime() : null;
  const endsAt = meet.endsAt ? new Date(meet.endsAt).getTime() : null;
  return (startsAt === null || (Number.isFinite(startsAt) && startsAt <= now)) &&
    (endsAt === null || (Number.isFinite(endsAt) && endsAt >= now));
}
