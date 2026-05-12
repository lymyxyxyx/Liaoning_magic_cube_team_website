function formatCentiseconds(value: number) {
  const minutes = Math.floor(value / 6000);
  const centiseconds = value % 6000;
  const seconds = centiseconds / 100;
  if (minutes > 0) return `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`;
  return seconds.toFixed(2);
}

function formatMultiBlindTime(totalSeconds: number) {
  if (totalSeconds === 99999) return "未知时间";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatMultiBlindResult(value: number) {
  const raw = String(value);

  if (raw.length === 10 && raw.startsWith("1")) {
    const solved = 99 - Number(raw.slice(1, 3));
    const attempted = Number(raw.slice(3, 5));
    const timeInSeconds = Number(raw.slice(5, 10));
    return `${solved}/${attempted} ${formatMultiBlindTime(timeInSeconds)}`;
  }

  const encoded = raw.padStart(9, "0");
  const difference = 99 - Number(encoded.slice(0, 2));
  const timeInSeconds = Number(encoded.slice(2, 7));
  const missed = Number(encoded.slice(7, 9));
  const solved = difference + missed;
  const attempted = solved + missed;
  return `${solved}/${attempted} ${formatMultiBlindTime(timeInSeconds)}`;
}

export function formatWcaResult(eventId: string, value: number) {
  if (value === -1) return "DNF";
  if (value === -2) return "DNS";
  if (value <= 0) return "-";
  if (eventId === "333fm") return String(value);
  if (eventId === "333mbf") return formatMultiBlindResult(value);
  return formatCentiseconds(value);
}
