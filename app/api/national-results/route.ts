import { NextResponse } from "next/server";
import { nationalAllAroundResults, nationalRelayResults, nationalResults } from "@/lib/national-results";

const defaultStationName = "第一站 · 江苏盐城东台";
const stationParamMap = {
  first: defaultStationName,
  second: "第二站 · 湖南娄底"
} as const;

function getStation(row: { station?: string }) {
  return row.station || defaultStationName;
}

function pickStation(value: string | null) {
  if (!value) return null;
  return stationParamMap[value as keyof typeof stationParamMap] || null;
}

function jsonRows<T>(rows: T[], status = 200) {
  return NextResponse.json(
    { rows },
    {
      status,
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600"
      }
    }
  );
}

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const station = pickStation(searchParams.get("station"));
  const kind = searchParams.get("kind");
  const event = searchParams.get("event") || "";
  const group = searchParams.get("group") || "";

  if (!station || !kind || !group) {
    return jsonRows([], 400);
  }

  if (kind === "single") {
    return jsonRows(
      nationalResults.filter((row) => getStation(row) === station && row.event === event && row.group === group)
    );
  }

  if (kind === "all-around") {
    return jsonRows(
      nationalAllAroundResults.filter(
        (row) => getStation(row) === station && row.event === event && row.group === group
      )
    );
  }

  if (kind === "relay") {
    return jsonRows(nationalRelayResults.filter((row) => getStation(row) === station && row.group === group));
  }

  return jsonRows([], 400);
}
