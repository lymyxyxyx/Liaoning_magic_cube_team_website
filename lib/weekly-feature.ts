export function isWeeklyCompetitionEnabled() {
  return process.env.WEEKLY_COMPETITION_ENABLED === "true";
}

export function isWeeklyFocusMeet(_meet: { id?: string; slug?: string }) {
  return true;
}
