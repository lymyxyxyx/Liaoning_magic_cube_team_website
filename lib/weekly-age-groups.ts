// Weekly competition groups use one adult group. O18/O30/O40 were legacy
// labels from an earlier player-library design and must not be generated.
export const weeklyAgeGroups = ["U6", "U8", "U10", "U12", "U18", "成人组"] as const;
export const weeklyRankingAgeGroups = ["U6", "U8", "U10", "U12", "U18", "成人组", "待补"] as const;

export function getWeeklyAgeGroup(birthDate: string, today = new Date()) {
  const age = getWeeklyAge(birthDate, today);
  if (age === null) return "";
    if (age < 6) return "U6";
    if (age < 8) return "U8";
    if (age < 10) return "U10";
    if (age < 12) return "U12";
  if (age < 18) return "U18";
  return "成人组";
}

export function getWeeklyRankingAgeGroup(birthDate: string, configuredAgeGroup = "", today = new Date()) {
  const calculated = getWeeklyAgeGroup(birthDate, today);
  if (calculated) {
    if (["U6", "U8", "U10", "U12", "U18"].includes(calculated)) return calculated;
    return "成人组";
  }
  if (["U6", "U8", "U10", "U12", "U18"].includes(configuredAgeGroup)) return configuredAgeGroup;
  if (["成人", "成人组", "O18", "O30", "O40"].includes(configuredAgeGroup)) return "成人组";
  return "待补";
}

export function getWeeklyRankingAgeGroupOrder(ageGroup: string) {
  const index = weeklyRankingAgeGroups.indexOf(ageGroup as (typeof weeklyRankingAgeGroups)[number]);
  return index === -1 ? weeklyRankingAgeGroups.length : index;
}

function getWeeklyAge(birthDate: string, today: Date) {
  const match = birthDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;

  let age = today.getFullYear() - year;
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();
  if (currentMonth < month || (currentMonth === month && currentDay < day)) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}
