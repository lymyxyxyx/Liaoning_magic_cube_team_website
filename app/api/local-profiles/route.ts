import { NextRequest, NextResponse } from "next/server";
import { enrichLocalProfiles, mergeLocalProfiles, readLocalProfiles, type EnrichedLocalProfile } from "@/lib/local-profile-store";

export async function GET() {
  const profiles = await readLocalProfiles();
  const enriched = await enrichLocalProfiles(profiles);
  return NextResponse.json({ profiles: enriched });
}

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as { profiles?: EnrichedLocalProfile[] };
  const saved = await mergeLocalProfiles(payload.profiles || []);
  const enriched = await enrichLocalProfiles(saved);
  return NextResponse.json({ profiles: enriched });
}
