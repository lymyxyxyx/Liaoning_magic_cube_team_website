type WeeklyHistoryCandidate = {
  id: string;
};

/** Every real weekly meet is guest-visible. Only the internal test meet is private. */
export function isGuestVisibleWeeklyMeet(meet: WeeklyHistoryCandidate) {
  return meet.id !== "weekly-test-entry";
}

/** One source of truth for every guest-facing weekly read path. */
export function isWeeklyMeetVisibleToGuests(meet: WeeklyHistoryCandidate) {
  return isGuestVisibleWeeklyMeet(meet);
}
