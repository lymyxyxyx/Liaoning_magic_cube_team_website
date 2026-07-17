export function isWeeklyCompetitionEnabled() {
  return process.env.WEEKLY_COMPETITION_ENABLED === "true";
}

export const WEEKLY_FOCUS_MEET_ID = "weekly-328";
export const WEEKLY_FOCUS_MEET_SLUG = "328";

export function isWeeklyFocusMeet(meet: { id?: string; slug?: string }) {
  return meet.id === WEEKLY_FOCUS_MEET_ID || meet.slug === WEEKLY_FOCUS_MEET_SLUG;
}
