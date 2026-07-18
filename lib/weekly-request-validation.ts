import { getWeeklyResultFormat } from "@/lib/weekly-result-utils";

export function isBoundedString(value: unknown, maxLength: number, required = false): value is string {
  return typeof value === "string" && value.length <= maxLength && (!required || value.trim().length > 0);
}

export function isWeeklyDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function isWeeklyResultFormat(value: unknown): value is "avg5" | "best3" | "avg3" | "best1" {
  return typeof value === "string" && getWeeklyResultFormat(value).id === value;
}

export function isWeeklyAttempts(value: unknown, format: unknown) {
  if (!isWeeklyResultFormat(format) || !Array.isArray(value)) return false;
  const count = getWeeklyResultFormat(format).attemptCount;
  return value.length === count && value.every((attempt) => typeof attempt === "string" && attempt.length <= 32 && attempt.trim().length > 0);
}
