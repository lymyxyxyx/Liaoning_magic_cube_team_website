import { promises as fs } from "node:fs";
import { commercialTeams, type CommercialTeam } from "@/lib/commercial-teams";
import { type Person } from "@/lib/data";

const dataPath = `${process.cwd()}/data/commercial-teams.json`;

export type EditableCommercialTeam = Omit<CommercialTeam, "members"> & {
  members: Person[];
};

export async function readCommercialTeams(): Promise<EditableCommercialTeam[]> {
  try {
    const payload = await fs.readFile(dataPath, "utf-8");
    const parsed = JSON.parse(payload) as EditableCommercialTeam[];
    const normalized = normalizeTeams(parsed);
    return normalized.length > 0 ? normalized : cloneDefaultTeams();
  } catch {
    return cloneDefaultTeams();
  }
}

export async function writeCommercialTeams(teams: EditableCommercialTeam[]) {
  const normalized = normalizeTeams(teams);
  if (normalized.length === 0) {
    throw new Error("commercial teams cannot be empty");
  }
  await fs.mkdir(`${process.cwd()}/data`, { recursive: true });
  await fs.writeFile(dataPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf-8");
  return normalized;
}

function cloneDefaultTeams() {
  return commercialTeams.map((team) => ({
    ...team,
    members: team.members.map((member) => ({ ...member, roles: [...member.roles] }))
  }));
}

function normalizeTeams(teams: Partial<EditableCommercialTeam>[]) {
  if (!Array.isArray(teams)) return [];
  return teams
    .map((team) => {
      const id = String(team.id || "").trim();
      const name = String(team.name || "").trim();
      if (!id || !name || !Array.isArray(team.members)) return null;
      return {
        id,
        name,
        sponsor: cleanOptionalString(team.sponsor),
        brandUrl: cleanOptionalString(team.brandUrl),
        description: cleanOptionalString(team.description),
        members: team.members.map(normalizeMember).filter(Boolean) as Person[]
      };
    })
    .filter(Boolean) as EditableCommercialTeam[];
}

function normalizeMember(member: Partial<Person>) {
  const id = String(member.id || "").trim();
  const name = String(member.name || "").trim();
  if (!id || !name) return null;
  const wcaId = cleanOptionalString(member.wcaId)?.toUpperCase();
  return {
    id,
    slug: String(member.slug || id).trim(),
    name,
    avatar: String(member.avatar || "/visuals/avatar-default.svg").trim(),
    roles: Array.isArray(member.roles) && member.roles.length > 0 ? member.roles : ["运动员"],
    city: String(member.city || "沈阳").trim() || "沈阳",
    gender: member.gender === "女" ? "女" : member.gender === "男" ? "男" : undefined,
    bio: String(member.bio || ""),
    visible: member.visible !== false,
    mainEvent: cleanOptionalString(member.mainEvent),
    wcaId,
    wcaUrl: cleanOptionalString(member.wcaUrl),
    specialties: member.specialties,
    rankingNote: cleanOptionalString(member.rankingNote)
  };
}

function cleanOptionalString(value: unknown) {
  const cleaned = typeof value === "string" ? value.trim() : "";
  return cleaned || undefined;
}
