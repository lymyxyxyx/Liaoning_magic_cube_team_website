import { NextRequest, NextResponse } from "next/server";
import { enrichLocalProfiles, readLocalProfiles } from "@/lib/local-profile-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const query = (params.get("q") || "").trim().toLocaleLowerCase();
  const province = params.get("province") || "辽宁";
  const city = params.get("city") || "沈阳";
  const scope = params.get("scope") === "city" ? "city" : "province";

  if (!query) return NextResponse.json({ players: [] });

  const profiles = await readLocalProfiles();
  const matchingProfiles = profiles.filter(
    (profile) =>
      profile.visible &&
      profile.wcaId &&
      profile.province === province &&
      (scope === "province" || profile.city === city)
  );
  const enriched = await enrichLocalProfiles(matchingProfiles);
  const players = enriched
    .filter((profile) => `${profile.name} ${profile.wcaId}`.toLocaleLowerCase().includes(query))
    .slice(0, 8)
    .map((profile) => ({
      wcaId: profile.wcaId as string,
      name: profile.name,
      province: profile.province,
      city: profile.city
    }));

  return NextResponse.json({ players });
}
