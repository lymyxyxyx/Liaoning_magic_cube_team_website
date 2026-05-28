import cubingCompetitionNameZh from "../data/cubing-competition-name-zh.json";

const cubingCompetitionNameZhByUrl = cubingCompetitionNameZh as Record<string, string>;

function toKebabish(input: string) {
  return input
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Za-z])(\d)/g, "$1-$2")
    .replace(/(\d)([A-Za-z])/g, "$1-$2")
    .replace(/-+/g, "-");
}

function slugifyCompetitionName(name: string) {
  return name
    .replace(/&/g, " ")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildCandidates(wcaCompetitionId: string) {
  const candidates = new Set<string>();
  candidates.add(wcaCompetitionId);
  candidates.add(toKebabish(wcaCompetitionId));
  candidates.add(toKebabish(wcaCompetitionId).replace(/-(\d{4})$/, "-$1"));
  candidates.add(toKebabish(wcaCompetitionId).replace(/(\d{4})$/, "-$1"));
  return Array.from(candidates).filter(Boolean);
}

export function getCubingCompetitionNameZhByWcaId(wcaCompetitionId: string, competitionName?: string) {
  const candidates = new Set<string>();
  const trimmedId = wcaCompetitionId.trim();
  if (trimmedId) {
    for (const slug of buildCandidates(trimmedId)) candidates.add(slug);
  }
  const trimmedName = competitionName?.trim();
  if (trimmedName) {
    const fromName = slugifyCompetitionName(trimmedName);
    if (fromName) candidates.add(fromName);
  }

  for (const slug of candidates) {
    const url = `https://cubing.com/competition/${slug}`;
    const nameZh = cubingCompetitionNameZhByUrl[url];
    if (nameZh) return nameZh;
  }
  return null;
}
