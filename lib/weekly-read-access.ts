export function canReadWeeklyMeet(input: {
  exists: boolean;
  isPublic: boolean;
  isWeeklyAdmin: boolean;
}) {
  return input.exists && (input.isPublic || input.isWeeklyAdmin);
}
