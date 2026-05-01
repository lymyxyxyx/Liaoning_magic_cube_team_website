import { NextRequest, NextResponse } from "next/server";
import { enrichLocalProfiles, readLocalProfiles, writeLocalProfiles, type EnrichedLocalProfile } from "@/lib/local-profile-store";

export async function GET(request: NextRequest) {
  const wcaId = request.nextUrl.searchParams.get("wcaId")?.trim().toUpperCase();
  if (wcaId) {
    if (!/^[0-9]{4}[A-Z]{4}[0-9]{2}$/.test(wcaId)) {
      return NextResponse.json({ message: "Invalid WCA ID" }, { status: 400 });
    }
    const [profile] = await enrichLocalProfiles([
      {
        wcaId,
        province: "辽宁",
        city: "沈阳",
        visible: true
      }
    ]);
    return NextResponse.json({ profile });
  }

  const profiles = await readLocalProfiles();
  const enriched = await enrichLocalProfiles(profiles);
  return NextResponse.json({ profiles: enriched });
}

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as { profiles?: EnrichedLocalProfile[] };
  if (!Array.isArray(payload.profiles)) {
    return NextResponse.json({ message: "profiles must be an array" }, { status: 400 });
  }
  const saved = await writeLocalProfiles(payload.profiles);
  const enriched = await enrichLocalProfiles(saved);
  return NextResponse.json({ profiles: enriched });
}
