import type { MetadataRoute } from "next";

const base = "https://lncubing.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/weekly", "/national-events"]
    },
    sitemap: `${base}/sitemap.xml`,
    host: base
  };
}
