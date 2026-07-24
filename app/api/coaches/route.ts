import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/auth";
import { readCoaches, writeCoaches, type Coach } from "@/lib/coach-store";

const adminCookieName = "liaoning_admin_session";
const maxCoaches = 500;

async function hasAdminSession() {
  const token = (await cookies()).get(adminCookieName)?.value;
  return Boolean(token && (await verifySessionToken(token)));
}

function isValidCoach(value: unknown): value is Coach {
  if (!value || typeof value !== "object") return false;
  const coach = value as Partial<Coach>;
  const certifiedYear = coach.certifiedYear;
  return (
    typeof coach.id === "string" && coach.id.trim().length > 0 && coach.id.length <= 100 &&
    typeof coach.name === "string" && coach.name.trim().length > 0 && coach.name.length <= 80 &&
    (coach.number === undefined || (typeof coach.number === "string" && coach.number.length <= 40)) &&
    (coach.gender === "男" || coach.gender === "女") &&
    typeof coach.province === "string" && coach.province.length <= 40 &&
    typeof coach.city === "string" && coach.city.length <= 40 &&
    (coach.levelType === "初级" || coach.levelType === "中级" || coach.levelType === "高级" || coach.levelType === "国家级") &&
    typeof certifiedYear === "number" && Number.isInteger(certifiedYear) && certifiedYear >= 1900 && certifiedYear <= 2100 &&
    typeof coach.createdAt === "string" && coach.createdAt.length <= 80
  );
}

export async function GET() {
  const coaches = await readCoaches();
  return NextResponse.json({ coaches });
}

export async function POST(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as { coaches?: unknown } | null;
  if (!payload || !Array.isArray(payload.coaches) || payload.coaches.length > maxCoaches || !payload.coaches.every(isValidCoach)) {
    return NextResponse.json({ message: "coaches must be an array" }, { status: 400 });
  }

  try {
    const coaches = await writeCoaches(payload.coaches);
    return NextResponse.json({ coaches });
  } catch {
    return NextResponse.json({ message: "failed to save coaches" }, { status: 500 });
  }
}
