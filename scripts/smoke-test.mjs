#!/usr/bin/env node
// Smoke test for key routes/APIs against a running server.
//
// Usage:
//   BASE_URL=http://localhost:3000 node scripts/smoke-test.mjs
//
// Designed to pass WITHOUT a database (e.g. in CI): every checked route either
// renders from static/file data or degrades gracefully, and /api/health is
// allowed to report 503 when no DATABASE_URL is configured. It only fails on
// real regressions (5xx crashes, wrong content type, missing routes).

const baseUrl = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const startupTimeoutMs = Number(process.env.SMOKE_STARTUP_TIMEOUT_MS || 60000);

// path -> acceptable status codes
const checks = [
  { path: "/api/health", ok: [200, 503], type: "application/json" },
  { path: "/", ok: [200], type: "text/html" },
  { path: "/about", ok: [200], type: "text/html" },
  { path: "/liaoning-rankings", ok: [200], type: "text/html" },
  { path: "/liaoning-records", ok: [200], type: "text/html" },
  { path: "/liaoning-competitions", ok: [200], type: "text/html" },
  { path: "/rankings", ok: [200], type: "text/html" },
  { path: "/competitions", ok: [200], type: "text/html" },
  // Public weekly access may redirect to the invite-code screen when the feature is protected.
  { path: "/weekly", ok: [200, 307], type: "text/html" },
  { path: "/judges", ok: [200], type: "text/html" },
  { path: "/commercial-teams", ok: [200], type: "text/html" },
  { path: "/coaches", ok: [200], type: "text/html" },
  { path: "/athletes", ok: [200], type: "text/html" },
  { path: "/api/judges", ok: [200], type: "application/json" },
  // Weekly results are administrator-entered for now. Keep the public surface
  // read-only until a separately reviewed self-entry workflow is launched.
  { path: "/api/admin/weekly-competitions", ok: [401], type: "application/json" },
  { path: "/api/weekly-competitions/weekly-test-entry/results", method: "POST", body: "{}", ok: [401], type: "application/json" },
  { path: "/sitemap.xml", ok: [200], type: "xml" },
  { path: "/robots.txt", ok: [200], type: "text" }
];

async function waitForServer() {
  const deadline = Date.now() + startupTimeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(5000) });
      if (res.status > 0) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Server at ${baseUrl} did not become reachable within ${startupTimeoutMs}ms`);
}

async function run() {
  console.log(`[smoke] target: ${baseUrl}`);
  await waitForServer();

  const failures = [];
  for (const check of checks) {
    const url = `${baseUrl}${check.path}`;
    try {
      const res = await fetch(url, {
        method: check.method || "GET",
        body: check.body,
        headers: check.body ? { "Content-Type": "application/json" } : undefined,
        signal: AbortSignal.timeout(15000),
        redirect: "manual"
      });
      const contentType = res.headers.get("content-type") || "";
      const statusOk = check.ok.includes(res.status);
      const typeOk = !check.type || contentType.includes(check.type) || (res.status >= 300 && res.status < 400);
      if (!statusOk || !typeOk) {
        failures.push(`${check.path} -> HTTP ${res.status} (${contentType || "no content-type"})`);
        console.error(`[smoke] FAIL ${check.path} -> HTTP ${res.status} (${contentType})`);
      } else {
        console.log(`[smoke] ok   ${check.path} -> HTTP ${res.status}`);
      }
    } catch (error) {
      failures.push(`${check.path} -> ${error instanceof Error ? error.message : error}`);
      console.error(`[smoke] FAIL ${check.path} -> ${error instanceof Error ? error.message : error}`);
    }
  }

  if (failures.length > 0) {
    console.error(`\n[smoke] ${failures.length} check(s) failed:`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
  console.log(`\n[smoke] all ${checks.length} checks passed.`);
}

run().catch((error) => {
  console.error(`[smoke] aborted: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
