export type LocalProfile = {
  wcaId?: string;
  localId?: string;
  name?: string;
  province: string;
  city: string;
  visible: boolean;
  sourceCompetition?: string;
  createdAt?: string;
  createdBy?: string;
  checkedAt?: string;
  checkedBy?: string;
};

export const localProfiles: LocalProfile[] = [
  { wcaId: "2009WANG43", province: "辽宁", city: "沈阳", visible: true },
  { wcaId: "2018WUYU03", province: "辽宁", city: "沈阳", visible: true },
  { wcaId: "2013WANG37", province: "辽宁", city: "沈阳", visible: true },
  { wcaId: "2024LIZI01", province: "辽宁", city: "沈阳", visible: true },
  { wcaId: "2024LIZH03", province: "辽宁", city: "沈阳", visible: true },
  { wcaId: "2009LIUY03", province: "辽宁", city: "沈阳", visible: true },
  { wcaId: "2023ZHAN23", province: "辽宁", city: "沈阳", visible: true },
  { wcaId: "2009ZHAN24", province: "辽宁", city: "沈阳", visible: true },
  { wcaId: "2024ZHAN94", province: "辽宁", city: "沈阳", visible: true },
  { wcaId: "2019FUHE01", province: "辽宁", city: "沈阳", visible: true },
  { wcaId: "2013SUHO01", province: "辽宁", city: "沈阳", visible: true },
  { wcaId: "2016CHEN73", province: "辽宁", city: "沈阳", visible: true },
  { wcaId: "2013LIYA01", province: "辽宁", city: "沈阳", visible: true },
  { wcaId: "2013LICH01", province: "辽宁", city: "沈阳", visible: true }
];

export function getLocalProvinces() {
  return Array.from(new Set(localProfiles.filter((profile) => profile.visible).map((profile) => profile.province)));
}

export function getLocalCities(province: string) {
  return Array.from(
    new Set(
      localProfiles
        .filter((profile) => profile.visible && profile.province === province)
        .map((profile) => profile.city)
    )
  );
}
