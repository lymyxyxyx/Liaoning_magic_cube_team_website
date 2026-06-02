export const judgeEditPassword = "87654312";

export function canEditJudges(password: unknown) {
  return typeof password === "string" && password === judgeEditPassword;
}
