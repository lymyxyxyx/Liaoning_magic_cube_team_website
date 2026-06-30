"use client";

import { useEffect } from "react";

export function AnalyticsTracker() {
  useEffect(() => {
    const path = `${window.location.pathname}${window.location.search}`;
    if (
      path.startsWith("/admin") ||
      path.startsWith("/api") ||
      path.startsWith("/_next") ||
      path === "/robots.txt" ||
      path === "/sitemap.xml"
    ) {
      return;
    }

    const body = JSON.stringify({ path, referrer: document.referrer || "" });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics", new Blob([body], { type: "application/json" }));
      return;
    }

    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true
    }).catch(() => undefined);
  }, []);

  return null;
}
