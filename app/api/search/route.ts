import { NextRequest, NextResponse } from "next/server";
import { competitions, getCompetitionDisplayName, people } from "@/lib/data";

export const dynamic = "force-dynamic";

function norm(value: string) {
  return value.toLowerCase().trim();
}

export async function GET(request: NextRequest) {
  const q = norm(request.nextUrl.searchParams.get("q") || "");
  if (!q) return NextResponse.json({ people: [], competitions: [] });

  const matchedPeople = people
    .filter((person) => person.visible)
    .filter((person) =>
      [person.name, person.wcaId, person.city, person.mainEvent, ...(person.specialties || [])]
        .filter(Boolean)
        .some((field) => norm(String(field)).includes(q))
    )
    .slice(0, 8)
    .map((person) => ({
      slug: person.slug,
      name: person.name,
      city: person.city,
      mainEvent: person.mainEvent,
      wcaId: person.wcaId,
      roles: person.roles
    }));

  const matchedCompetitions = competitions
    .filter((competition) => {
      const displayName = getCompetitionDisplayName(competition);
      return [displayName, competition.name, competition.nameZh, competition.city, competition.date]
        .filter(Boolean)
        .some((field) => norm(String(field)).includes(q));
    })
    .slice(0, 8)
    .map((competition) => ({
      slug: competition.slug,
      name: getCompetitionDisplayName(competition),
      city: competition.city,
      date: competition.date
    }));

  return NextResponse.json({ people: matchedPeople, competitions: matchedCompetitions });
}
