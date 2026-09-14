/** Short title for selectors and history drop-downs. Full archived titles stay unchanged. */
export function getWeeklyMeetMenuLabel(title: string) {
  return title.replace(/周赛总结/g, "周赛").replace(/\s{2,}/g, " ").trim();
}
