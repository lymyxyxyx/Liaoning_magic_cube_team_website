import assert from "node:assert/strict";
import test from "node:test";
import { getCanonicalAdminUrl } from "../lib/site-origin.ts";

test("admin canonical redirect never exposes the internal application port", () => {
  assert.equal(
    getCanonicalAdminUrl("https://www.lncubing.com:3000/admin/weekly/players?from=weekly").toString(),
    "https://lncubing.com/admin/weekly/players?from=weekly"
  );
});
