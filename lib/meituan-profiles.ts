export type MeituanProfile = {
  wcaId: string;
  status: "current" | "former";
};

export const meituanProfiles: MeituanProfile[] = [
  { wcaId: "2015WANG90", status: "current" },
  { wcaId: "2009LIUY03", status: "current" },
  { wcaId: "2015WUTE01", status: "current" },
  { wcaId: "2018ZHAN51", status: "current" },
  { wcaId: "2026SUNM03", status: "current" },
  { wcaId: "2021YANW01", status: "current" },
  { wcaId: "2015XIAJ01", status: "current" },
  { wcaId: "2019ZHAN99", status: "current" },
  { wcaId: "2015LIUT01", status: "current" },
  { wcaId: "2024WANH02", status: "current" },
  { wcaId: "2019SUNY09", status: "former" },
  { wcaId: "2014JIAJ01", status: "former" },
  { wcaId: "2010SHIF01", status: "former" },
  { wcaId: "2021TAND01", status: "former" },
  { wcaId: "2014ZHAN11", status: "former" },
  { wcaId: "2016CHEH02", status: "former" },
];

export function getVisibleMeituanProfiles(scope: "all" | "current" = "all") {
  const profiles = scope === "current" ? meituanProfiles.filter((profile) => profile.status === "current") : meituanProfiles;
  return profiles.map((profile) => ({ ...profile, wcaId: profile.wcaId.trim().toUpperCase() })).filter((profile) => profile.wcaId);
}
