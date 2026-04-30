import { promises as fs } from "node:fs";
import { localProfiles, type LocalProfile } from "@/lib/local-profiles";
import { getPostgresPool } from "@/lib/postgres";

const dataPath = `${process.cwd()}/data/local-profiles.json`;
const defaultCreatedBy = "刘一鸣";

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

export async function mergeLocalProfiles(profiles: LocalProfile[]) {
  const existingProfiles = await readLocalProfiles();
  const byId = new Map(existingProfiles.map((profile) => [getProfileKey(profile), profile]));
  const order = existingProfiles.map(getProfileKey);

  for (const profile of profiles) {
    const normalized = normalizeProfile(profile);
    if (!normalized) continue;
    const key = getProfileKey(normalized);
    if (!byId.has(key)) {
      order.unshift(key);
    }
    const existing = byId.get(key);
    const createdAt = normalized.createdAt || existing?.createdAt || (!existing ? new Date().toISOString() : undefined);
    const createdBy = normalized.createdBy || existing?.createdBy || (!existing ? defaultCreatedBy : undefined);
    byId.set(key, {
      ...existing,
      ...normalized,
      createdAt,
      createdBy,
      checkedAt: normalized.checkedAt || existing?.checkedAt,
      checkedBy: normalized.checkedBy || existing?.checkedBy
    });
  }

  const merged = order.map((key) => byId.get(key)).filter(Boolean) as LocalProfile[];
  await fs.mkdir(`${process.cwd()}/data`, { recursive: true });
  await fs.writeFile(dataPath, `${JSON.stringify(merged, null, 2)}\n`, "utf-8");
  return merged;
}

export async function enrichLocalProfiles(profiles: LocalProfile[]) {
  const ids = profiles.map((profile) => profile.wcaId).filter((id): id is string => Boolean(id));
  let byId = new Map<string, WcaPersonRow>();
  if (ids.length > 0) {
    try {
      const { rows } = await getPostgresPool().query<WcaPersonRow>(
        "SELECT wca_id, name, country_id FROM wca_persons WHERE wca_id = ANY($1::text[]) AND sub_id = '1'",
        [ids]
      );
      byId = new Map(rows.map((row) => [row.wca_id, row]));
    } catch {
      byId = new Map();
    }
  }
  return profiles.map((profile) => {
    const person = profile.wcaId ? byId.get(profile.wcaId) : undefined;
    return {
      ...profile,
      name: person?.name || profile.name || "",
      country: person?.country_id || "",
      existsInWca: Boolean(person)
    };
  });
}

function normalizeProfile(profile: Partial<LocalProfile>) {
  const wcaId = String(profile.wcaId || "").trim().toUpperCase();
  const validWcaId = /^[0-9]{4}[A-Z]{4}[0-9]{2}$/.test(wcaId) ? wcaId : "";
  const name = String(profile.name || "").trim();
  const sourceCompetition = String(profile.sourceCompetition || "").trim();
  const localId = String(profile.localId || "").trim();
  if (!validWcaId && (!name || !sourceCompetition)) return null;
  return {
    wcaId: validWcaId || undefined,
    localId: validWcaId ? undefined : localId || createLocalProfileId(name, sourceCompetition),
    name: validWcaId ? undefined : name,
    province: String(profile.province || "辽宁").trim() || "辽宁",
    city: String(profile.city || "沈阳").trim() || "沈阳",
    visible: Boolean(profile.visible),
    sourceCompetition: sourceCompetition || undefined,
    createdAt: typeof profile.createdAt === "string" && profile.createdAt.trim() ? profile.createdAt.trim() : undefined,
    createdBy: typeof profile.createdBy === "string" && profile.createdBy.trim() ? profile.createdBy.trim() : undefined,
    checkedAt: typeof profile.checkedAt === "string" && profile.checkedAt.trim() ? profile.checkedAt.trim() : undefined,
    checkedBy: typeof profile.checkedBy === "string" && profile.checkedBy.trim() ? profile.checkedBy.trim() : undefined
  };
}

function getProfileKey(profile: LocalProfile) {
  return profile.wcaId || profile.localId || createLocalProfileId(profile.name || "", profile.sourceCompetition || "");
}

function createLocalProfileId(name: string, sourceCompetition: string) {
  const seed = `${name}-${sourceCompetition}`.trim() || String(Date.now());
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return `LOCAL-${hash.toString(36).toUpperCase()}`;
}
