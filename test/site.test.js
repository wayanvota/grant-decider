import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("the renamed product covers the full pursuit decision", async () => {
  const [home, about, readme] = await Promise.all([read("index.html"), read("about.html"), read("README.md")]);
  for (const content of [home, about, readme]) assert.match(content, /Funder Pursuit Advisor/);
  assert.match(home, /research, cultivation, relationship-building, and proposal time/i);
  assert.match(home, /Grant Fit Auditor/);
  assert.doesNotMatch(home, /Open the auditor/);
});

test("the form collects the PRD hard-gate and staff-time inputs", async () => {
  const home = await read("index.html");
  for (const name of [
    "foundationName", "foundationWebsite", "foundationEin", "legalName", "mission",
    "programAreas", "populations", "geographies", "fundingNeed", "askMin", "askMax",
    "annualBudget", "is501c3", "structure", "relationshipStatus", "knownPaths",
    "researchHours", "cultivationHours", "applicationHours", "loadedHourlyCost"
  ]) assert.match(home, new RegExp(`name="${name}"`));
});

test("the client calls pursuit research and renders all four decision states", async () => {
  const [home, app] = await Promise.all([read("index.html"), read("app.js")]);
  assert.match(app, /\/pursuit/);
  assert.match(home, />Decline</);
  assert.match(home, />Park</);
  assert.match(home, />Pursue</);
  assert.match(app, /NEEDS HUMAN CHECK/);
  assert.match(app, /evidence_ledger/);
  assert.match(app, /Download Markdown/);
  assert.match(app, /Download JSON/);
});

test("profile persistence is optional, local, and clearable", async () => {
  const [home, app] = await Promise.all([read("index.html"), read("app.js")]);
  assert.match(home, /Save my nonprofit profile in this browser/);
  assert.match(home, /Clear saved profile/);
  assert.match(app, /localStorage\.setItem/);
  assert.match(app, /localStorage\.removeItem/);
});

test("unsafe source schemes cannot become result links", async () => {
  const app = await read("app.js");
  assert.match(app, /\["http:", "https:"\]\.includes\(url\.protocol\)/);
  assert.match(app, /escapeHtml\(url\)/);
  assert.match(app, /noopener noreferrer/);
});

test("Kindora structured grants are visible, attributed, and bounded", async () => {
  const [about, app, readme] = await Promise.all([read("about.html"), read("app.js"), read("README.md")]);
  assert.match(app, /kindora_research/);
  assert.match(app, /Structured grant evidence/);
  assert.match(app, /Data from Kindora/);
  assert.match(app, /cannot independently force a decline/);
  assert.match(about, /provider-derived/);
  assert.match(readme, /six-tool allowlist/);
});
