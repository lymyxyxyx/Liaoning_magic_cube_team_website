import type { ResultValue } from "@/lib/weekly-result-utils";

export type ShenyangGrade = {
  level: string;
  grade: string;
  label: string;
};

type Thresholds = Partial<Record<string, number[][]>>;

const standard: Thresholds = {
  "333": [
    [8, 9, 10, 12],
    [14, 16, 18, 20],
    [22, 25, 30, 35],
    [40, 45, 50, 55],
    [60, 70, 80, 120],
    [150, 180, 300, 600]
  ],
  "222": [
    [3, 4, 5, 6],
    [7, 8, 9, 10],
    [12, 14, 16, 18],
    [20, 21, 22, 23],
    [40, 50, 60, 70],
    [90, 120, 300, 600]
  ],
  pyram: [
    [3, 4, 5, 6],
    [7, 8, 9, 10],
    [12, 14, 16, 18],
    [20, 21, 22, 23],
    [40, 50, 60, 70],
    [90, 120, 300, 600]
  ],
  skewb: [
    [3, 5, 7, 9],
    [12, 14, 16, 18],
    [20, 25, 30, 40],
    [60, 70, 80, 90],
    [100, 120, 300, 600]
  ],
  "444": [[30, 32, 34, 38], [45, 48, 52, 55], [60, 120, 180, 240], [300, 400, 500, 600]],
  "555": [[60, 62, 65, 70], [75, 80, 85, 90], [150, 300, 400, 500], [600]],
  mirror: [[10, 12, 15, 18], [22, 26, 30, 35], [40, 50, 60, 70], [80, 100, 120, 150], [180, 200, 240, 300]],
  maple: [[2, 3, 4, 5], [6, 8, 10, 12], [15, 18, 20, 22], [25, 30, 35, 40], [50, 60, 90, 120]]
};

const levels = ["特级大师", "大师级", "专业级", "高手级", "中级", "初级"];

export function getShenyangAssociationGrade(eventId: string, average: ResultValue): ShenyangGrade {
  if (typeof average !== "number") return { level: "", grade: "", label: "-" };
  const thresholds = standard[eventId];
  if (!thresholds) return { level: "", grade: "", label: "暂无标准" };
  const seconds = average / 100;

  for (let levelIndex = 0; levelIndex < thresholds.length; levelIndex += 1) {
    const stars = thresholds[levelIndex];
    for (let starIndex = 0; starIndex < stars.length; starIndex += 1) {
      if (seconds < stars[starIndex]) {
        const grade = "★".repeat(4 - starIndex);
        return { level: levels[levelIndex], grade, label: `${levels[levelIndex]} · ${grade}` };
      }
    }
  }

  return { level: "", grade: "", label: "未达标" };
}
