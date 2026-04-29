import { promises as fs } from "node:fs";
import { localProfiles, type LocalProfile } from "@/lib/local-profiles";
import { getPostgresPool } from "@/lib/postgres";

const dataPath = `${process.cwd()}/data/local-profiles.json`;

export type EnrichedLocalProfile = LocalProfile & {
  name: string;
  country: string;
  existsInWca: boolean;
};

type WcaPersonRow = {
  wca_id: string;
  name: string;
  country_id: string;
};

export async function readLocalProfiles() {
  try {
    const payload = await fs.readFile(dataPath, "utf-8");
    const parsed = JSON.parse(payload) as LocalProfile[];
    return parsed.map(normalizeProfile).filter(Boolean) as LocalProfile[];
  } catch {
    return localProfiles;
  }
}

export async function writeLocalProfiles(profiles: LocalProfile[]) {
  await fs.mkdir(`${process.cwd()}/data`, { recursive: true });
  const normalized = profiles.map(normalizeProfile).filter(Boolean) as LocalProfile[];
  await fs.writeFile(dataPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf-8");
  return normalized;
}

export async function enrichLocalProfiles(profiles: LocalProfile[]) {
  const ids = profiles.map((profile) => profile.wcaId);
  if (ids.length === 0) return [];
  const { rows } = await getPostgresPool().query<WcaPersonRow>(
    "SELECT wca_id, name, country_id FROM wca_persons WHERE wca_id = ANY($1::text[]) AND sub_id = '1'",
    [ids]
  );
  const byId = new Map(rows.map((row) => [row.wca_id, row]));
  return profiles.map((profile) => {
    const person = byId.get(profile.wcaId);
    return {
      ...profile,
      name: person?.name || "",
      country: person?.country_id || "",
      existsInWca: Boolean(person)
    };
  });
}

function normalizeProfile(profile: Partial<LocalProfile>) {
  const wcaId = String(profile.wcaId || "").trim().toUpperCase();
  if (!/^[0-9]{4}[A-Z]{4}[0-9]{2}$/.test(wcaId)) return null;
  return {
    wcaId,
    province: String(profile.province || "辽宁").trim() || "辽宁",
    city: String(profile.city || "沈阳").trim() || "沈阳",
    visible: Boolean(profile.visible)
  };
}
