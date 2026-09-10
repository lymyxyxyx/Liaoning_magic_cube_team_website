const productionHostname = "lncubing.com";

export function getCanonicalAdminUrl(input: string | URL) {
  const url = new URL(input);
  url.protocol = "https:";
  url.hostname = productionHostname;
  url.port = "";
  return url;
}
