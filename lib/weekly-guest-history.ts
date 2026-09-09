const guestWeeklyHistorySlugPattern = /^2026-week-(?:2[7-9]|3[0-4])$/;

// These are the eight completed weekly v2 meets approved for guest read-only
// viewing. Keeping the list explicit prevents future private drafts from being
// exposed merely because they use the same naming convention.
export function isGuestWeeklyHistorySlug(slug: string) {
  return guestWeeklyHistorySlugPattern.test(slug);
}
