import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import crypto from "node:crypto";
import net from "node:net";

const source = readFileSync(new URL("../lib/weekly-login-rate-limit.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const limiter = {};
new Function("require", "exports", compiled)((name) => ({"node:crypto": crypto, "node:net": net, "@/lib/postgres": { getPostgresPool() { throw new Error("database unavailable"); } }})[name], limiter);

test("only a configured trusted proxy's overwritten real IP separates login clients", () => {
  const original = process.env.WEEKLY_TRUST_PROXY;
  try {
    process.env.WEEKLY_TRUST_PROXY = "false";
    const request = (ip, forwarded = "") => ({ headers: new Headers({ "x-real-ip": ip, "x-forwarded-for": forwarded }) });
    const shared = limiter.getWeeklyLoginClientKey(request("192.0.2.1"));
    assert.equal(shared, limiter.getWeeklyLoginClientKey(request("192.0.2.2")));
    process.env.WEEKLY_TRUST_PROXY = "true";
    const first = limiter.getWeeklyLoginClientKey(request("192.0.2.1"));
    assert.notEqual(first, shared);
    assert.notEqual(first, limiter.getWeeklyLoginClientKey(request("192.0.2.2")));
    assert.equal(first, limiter.getWeeklyLoginClientKey(request("192.0.2.1", "spoofed-client")));
    assert.equal(shared, limiter.getWeeklyLoginClientKey(request("invalid")));
    assert.match(first, /^[a-f0-9]{64}$/);
  } finally {
    if (original === undefined) delete process.env.WEEKLY_TRUST_PROXY;
    else process.env.WEEKLY_TRUST_PROXY = original;
  }
});

test("login storage failures do not silently allow attempts", async () => {
  await assert.rejects(limiter.getWeeklyLoginRateLimit({ headers: new Headers() }), /database unavailable/);
});
