"use client";

import { Download } from "lucide-react";
import type { WeeklyAttempt, WeeklyMeet } from "@/lib/weekly";

type ExportMeet = Pick<WeeklyMeet, "title" | "dateLabel" | "weekNumber" | "yearWeek" | "results">;

export function WeeklyImageExportButton({ meet }: { meet: ExportMeet }) {
  function exportImage() {
    const canvas = document.createElement("canvas");
    const width = 1400;
    const rowHeight = 52;
    const headerHeight = 310;
    const footerHeight = 70;
    const rows = meet.results;
    const height = headerHeight + rowHeight * Math.max(rows.length, 1) + footerHeight;
    const scale = window.devicePixelRatio || 1;
    canvas.width = width * scale;
    canvas.height = height * scale;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(scale, scale);
    drawPoster(context, width, height, meet);

    const anchor = document.createElement("a");
    anchor.download = `weekly-${meet.weekNumber}-results.png`;
    anchor.href = canvas.toDataURL("image/png");
    anchor.click();
  }

  return (
    <button className="button" type="button" onClick={exportImage}>
      <Download size={16} />
      导出成绩图片
    </button>
  );
}

function drawPoster(context: CanvasRenderingContext2D, width: number, height: number, meet: ExportMeet) {
  const rows = meet.results;
  context.fillStyle = "#f8fafc";
  context.fillRect(0, 0, width, height);

  context.fillStyle = "#ffffff";
  roundRect(context, 44, 44, width - 88, height - 88, 22);
  context.fill();

  context.fillStyle = "#d94141";
  context.fillRect(44, 44, width - 88, 12);

  context.fillStyle = "#d94141";
  context.font = "700 28px Arial, sans-serif";
  context.fillText(`第${meet.weekNumber}周 · 第${meet.yearWeek}周`, 84, 112);

  context.fillStyle = "#18212f";
  context.font = "800 44px Arial, sans-serif";
  drawText(context, meet.title, 84, 172, width - 168, 54);

  context.fillStyle = "#667085";
  context.font = "700 22px Arial, sans-serif";
  context.fillText(`周赛周期：${meet.dateLabel || "-"}`, 84, 226);

  const champion = rows[0];
  const stats = [
    ["参赛选手", `${rows.length}`],
    ["冠军平均", champion ? champion.average.toFixed(2) : "-"],
    ["冠军最快", champion ? formatAttempt(getSingleBest(champion.attempts)) : "-"]
  ];
  stats.forEach(([label, value], index) => {
    const x = 84 + index * 230;
    context.fillStyle = "#eef4ff";
    roundRect(context, x, 250, 190, 84, 14);
    context.fill();
    context.fillStyle = "#667085";
    context.font = "700 18px Arial, sans-serif";
    context.fillText(label, x + 22, 282);
    context.fillStyle = "#18212f";
    context.font = "800 30px Arial, sans-serif";
    context.fillText(value, x + 22, 318);
  });

  const columns = [
    ["排名", 84, 70],
    ["姓名", 170, 180],
    ["性别", 360, 70],
    ["段位", 440, 90],
    ["等级", 540, 90],
    ["平均", 640, 90],
    ["最快", 750, 90],
    ["个人PB", 860, 100],
    ["T1", 980, 70],
    ["T2", 1060, 70],
    ["T3", 1140, 70],
    ["T4", 1220, 70],
    ["T5", 1300, 70]
  ] as const;
  const tableTop = 370;
  context.fillStyle = "#eef2f7";
  context.fillRect(64, tableTop, width - 128, 52);
  context.fillStyle = "#344054";
  context.font = "800 18px Arial, sans-serif";
  columns.forEach(([label, x]) => context.fillText(label, x, tableTop + 33));

  rows.forEach((row, rowIndex) => {
    const y = tableTop + 52 + rowIndex * 52;
    context.fillStyle = rowIndex % 2 === 0 ? "#ffffff" : "#f8fafc";
    context.fillRect(64, y, width - 128, 52);
    context.fillStyle = "#dce3ec";
    context.fillRect(64, y + 51, width - 128, 1);
    context.fillStyle = "#18212f";
    context.font = "700 19px Arial, sans-serif";
    const values = [
      String(row.rank),
      row.playerName,
      row.gender,
      row.level || "-",
      row.grade || "-",
      row.average.toFixed(2),
      formatAttempt(getSingleBest(row.attempts)),
      row.personalBest.toFixed(2),
      ...row.attempts.slice(0, 5).map(formatAttempt)
    ];
    columns.forEach(([, x, columnWidth], columnIndex) => {
      const text = values[columnIndex] || "-";
      if (columnIndex === 7 && row.pbRefreshed) {
        context.fillStyle = "#d94141";
      } else {
        context.fillStyle = columnIndex === 1 ? "#1f6feb" : "#18212f";
      }
      drawText(context, text, x, y + 33, columnWidth, 22);
    });
  });

  context.fillStyle = "#667085";
  context.font = "700 18px Arial, sans-serif";
  context.fillText("辽宁地区魔方信息查询网 · 自动生成周赛成绩图片", 84, height - 68);
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function drawText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  if (context.measureText(text).width <= maxWidth) {
    context.fillText(text, x, y);
    return;
  }
  let next = text;
  while (next.length > 1 && context.measureText(`${next}...`).width > maxWidth) {
    next = next.slice(0, -1);
  }
  context.fillText(`${next}...`, x, y);
}

function getSingleBest(attempts: WeeklyAttempt[]) {
  const numbers = attempts.filter((attempt): attempt is number => typeof attempt === "number");
  return numbers.length ? Math.min(...numbers) : "DNF";
}

function formatAttempt(value: WeeklyAttempt) {
  return typeof value === "number" ? value.toFixed(2) : value;
}
