const fallbackCountryZh: Record<string, string> = {
  China: "中国",
  "Hong Kong": "中国香港",
  Macau: "中国澳门",
  "Chinese Taipei": "中国台北",
  "United States": "美国",
  "United Kingdom": "英国",
  "South Korea": "韩国",
  "North Korea": "朝鲜"
};

const zhDisplayNames = new Intl.DisplayNames(["zh-CN"], { type: "region" });

export function formatCountryLabel(countryName: string, iso2?: string | null) {
  const normalizedIso2 = iso2?.trim().toUpperCase() || "";
  if (countryName === "Chinese Taipei" || normalizedIso2 === "TW") {
    return "Chinese Taipei（中国台北）";
  }
  const zhName =
    fallbackCountryZh[countryName] ||
    (/^[A-Z]{2}$/.test(normalizedIso2) ? zhDisplayNames.of(normalizedIso2) || "" : "") ||
    "";

  if (!zhName || zhName === countryName) return countryName;
  return `${countryName}（${zhName}）`;
}
