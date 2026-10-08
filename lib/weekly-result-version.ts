export class WeeklyResultConflictError extends Error {
  constructor() {
    super("这条成绩已被其他管理员修改或删除，请刷新列表后重新操作。你的修改尚未保存。");
    this.name = "WeeklyResultConflictError";
  }
}

// Compare the opaque PostgreSQL timestamp text without dropping microseconds.
export function assertWeeklyResultVersion(currentVersion: string | null | undefined, expectedVersion: string) {
  if (!currentVersion || currentVersion !== expectedVersion) throw new WeeklyResultConflictError();
}
