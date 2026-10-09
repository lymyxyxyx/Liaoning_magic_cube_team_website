export type ResultValue = number | "DNF" | "DNS";
export type WeeklyResultFormat = "avg5" | "best3" | "avg3" | "best1";

// Keep the existing scaled result representation; persisted values are the
// unscaled count, and no database conversion of historical results is needed.
export function parseCountResultInput(input: string): ResultValue {
  const clean = input.trim().toUpperCase();
  if (clean === "DNF" || clean === "DNS") return clean;
  if (!/^\d+$/.test(clean)) throw new Error("大堆成绩请输入非负整数数量（限时 1 小时）");
  const scaled = Number(clean) * 100;
  if (!Number.isSafeInteger(scaled) || scaled > 2147483647) throw new Error("大堆成绩数量过大");
  return scaled;
}

export function formatCountResult(value: ResultValue | null | undefined) {
  if (value === null || value === undefined) return "-";
  return typeof value === "number" ? String(value / 100) : value;
}

export function isBetterWeeklyResult(value: number, previous: number | null, higherIsBetter = false) {
  return value >= 0 && (previous === null || (higherIsBetter ? value > previous : value < previous));
}

export const weeklyResultFormats = [
  { id: "avg5", name: "五次取平均", attemptCount: 5 },
  { id: "best3", name: "三次取最快", attemptCount: 3 },
  { id: "avg3", name: "五次取平均（预留）", attemptCount: 5 },
  { id: "best1", name: "单次取最快", attemptCount: 1 }
] as const;

export function getWeeklyResultFormat(format: string | null | undefined) {
  return weeklyResultFormats.find((item) => item.id === format) || weeklyResultFormats[0];
}

export function parseResultInput(input: string): ResultValue {
  const clean = normalizeResultInput(input);
  if (clean === "DNF") return "DNF";
  if (clean === "DNS") return "DNS";
  if (!clean) throw new Error("成绩不能为空");

  const parts = clean.split(":");
  if (parts.length > 2) throw new Error("成绩格式不正确");

  const decimal = /^(?:\d+(?:\.\d+)?|\.\d+)$/;
  let seconds: number;
  if (parts.length === 2) {
    if (!/^\d+$/.test(parts[0]) || !decimal.test(parts[1])) throw new Error("成绩格式不正确");
    const minutes = Number(parts[0]);
    const rest = Number(parts[1]);
    if (!Number.isFinite(minutes) || !Number.isFinite(rest) || minutes < 0 || rest < 0 || rest >= 60) {
      throw new Error("成绩格式不正确");
    }
    seconds = minutes * 60 + rest;
  } else {
    if (!decimal.test(clean)) throw new Error("成绩格式不正确");
    seconds = Number(clean);
    if (!Number.isFinite(seconds) || seconds < 0) throw new Error("成绩格式不正确");
  }

  const scaled = Math.round(seconds * 100);
  if (!Number.isSafeInteger(scaled) || scaled > 2147483647) throw new Error("成绩数值过大");
  return scaled;
}

function normalizeResultInput(input: string) {
  const original = input.trim().toUpperCase().replace(/，/g, ".");
  if (original === "弃权" || original === "未完成") return "DNF";
  if (original === "未参赛" || original === "缺席") return "DNS";
  // Common chat-style inputs: 12秒34, 12.34秒, 1分02秒34.
  const chineseTime = original.match(/^(?:(\d+)分)?(\d+)(?:秒|S)(\d{1,2})?$/);
  if (chineseTime) {
    const minutes = Number(chineseTime[1] || 0);
    const seconds = Number(chineseTime[2]);
    const centiseconds = chineseTime[3] ? Number(chineseTime[3].padEnd(2, "0")) : 0;
    return `${minutes}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
  }
  return original.replace(/秒$/g, "").replace(/S$/g, "");
}

export function formatResult(value: ResultValue | null | undefined): string {
  if (value === null || value === undefined) return "-";
  if (value === "DNF" || value === "DNS") return value;

  const totalCentiseconds = Math.max(0, Math.round(value));
  const minutes = Math.floor(totalCentiseconds / 6000);
  const secondsCentiseconds = totalCentiseconds % 6000;
  const seconds = Math.floor(secondsCentiseconds / 100);
  const centiseconds = secondsCentiseconds % 100;

  if (minutes > 0) {
    return `${minutes}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
  }

  return `${seconds}.${String(centiseconds).padStart(2, "0")}`;
}

export function calculateAverage(attempts: ResultValue[]) {
  if (attempts.length !== 5) throw new Error("必须录入 5 次成绩");

  const valid = attempts.filter((attempt): attempt is number => typeof attempt === "number");
  const invalidCount = attempts.length - valid.length;
  const best: ResultValue = valid.length > 0 ? Math.min(...valid) : "DNF";
  const average: ResultValue =
    invalidCount >= 2 || valid.length < 3
      ? "DNF"
      : calculateTrimmedAverage(valid, invalidCount);

  return {
    best,
    average,
    detail: JSON.stringify({
      attempts: attempts.map((attempt) => (typeof attempt === "number" ? formatResult(attempt) : attempt)),
      best: formatResult(best),
      average: formatResult(average)
    })
  };
}

export function calculateResultByFormat(attempts: ResultValue[], format: WeeklyResultFormat) {
  const formatConfig = getWeeklyResultFormat(format);
  if (attempts.length !== formatConfig.attemptCount) throw new Error(`必须录入 ${formatConfig.attemptCount} 次成绩`);

  if (format === "avg5") return calculateAverage(attempts);

  const valid = attempts.filter((attempt): attempt is number => typeof attempt === "number");
  const best: ResultValue = valid.length > 0 ? Math.min(...valid) : "DNF";
  let average: ResultValue = best;

  if (format === "best3") {
    // best3 means the fastest valid attempt, not an average. DNF/DNS only
    // determine the final state when no valid attempt exists.
    average = best;
  } else if (format === "avg3") {
    average = valid.length === attempts.length ? Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length) : "DNF";
  }

  return {
    best,
    average,
    detail: JSON.stringify({
      format,
      attempts: attempts.map((attempt) => (typeof attempt === "number" ? formatResult(attempt) : attempt)),
      best: formatResult(best),
      average: formatResult(average)
    })
  };
}

export function resultValueToSeconds(value: ResultValue) {
  return typeof value === "number" ? value / 100 : -1;
}

export function secondsToResultValue(value: string | number | null): ResultValue {
  if (value === null) return "DNF";
  const numeric = typeof value === "number" ? value : Number(value);
  if (numeric < 0) return "DNF";
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : "DNF";
}

function calculateTrimmedAverage(valid: number[], invalidCount: number) {
  const sorted = [...valid].sort((a, b) => a - b);
  if (invalidCount === 1) {
    return Math.round(sorted.slice(1).reduce((sum, value) => sum + value, 0) / 3);
  }

  return Math.round(sorted.slice(1, 4).reduce((sum, value) => sum + value, 0) / 3);
}
