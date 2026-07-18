export const judgeEditPassword = "87654312";

function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function canEditJudges(password: unknown) {
  return typeof password === "string" && timingSafeStringEqual(password, judgeEditPassword);
}
