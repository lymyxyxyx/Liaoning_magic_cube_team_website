export function isWeeklyCompetitionEnabled() {
  return process.env.WEEKLY_COMPETITION_ENABLED === "true";
}

export function isWeeklyFocusMeet(meet: { id?: string; slug?: string }) {
  void meet;
  return true;
}

export { isWeeklyMeetCurrent } from "@/lib/weekly-meet-status";
