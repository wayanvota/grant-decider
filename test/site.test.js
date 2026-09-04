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

test("the browser applies a restrictive content policy and referrer policy", async () => {
  const [home, about] = await Promise.all([read("index.html"), read("about.html")]);
  for (const content of [home, about]) {
    assert.match(content, /Content-Security-Policy/);
    assert.match(content, /object-src 'none'/);
    assert.match(content, /script-src 'self'/);
    assert.match(content, /name="referrer"/);
  }
  assert.match(home, /connect-src https:\/\/grant-fit-auditor\.onrender\.com/);
});

test("a claimed warm or current relationship requires a named route", async () => {
  const [home, app] = await Promise.all([read("index.html"), read("app.js")]);
  assert.match(home, /id="relationship-help"/);
  assert.match(app, /\["warm_path", "current_funder"\]\.includes/);
  assert.match(app, /knownPaths\.required = requiresPath/);
  assert.match(app, /knownPaths\.value\.trim\(\)\.length < 10/);
});

test("money, time, and EIN inputs have browser-side bounds", async () => {
  const home = await read("index.html");
  assert.match(home, /name="organizationEin"[^>]+pattern="\[0-9\]/);
  assert.match(home, /name="annualBudget"[^>]+max="1000000000000"/);
  assert.match(home, /name="researchHours"[^>]+max="10000"[^>]+required/);
  assert.match(home, /name="loadedHourlyCost"[^>]+max="100000"/);
});

test("downloaded Markdown sanitizes every generated link destination", async () => {
  const app = await read("app.js");
  assert.match(app, /markdownLink\(item\.source_title, item\.source_url\)/);
  assert.match(app, /markdownLink\("Source", link\)/);
  assert.match(app, /url\.replace\(\/\[\(\)<>/);
  assert.doesNotMatch(app, /\]\(\$\{item\.source_url\}\)/);
});
