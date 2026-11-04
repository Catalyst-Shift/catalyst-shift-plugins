// CAT-1495: design-skill speaks the way the site does. These are the card's checklist
// greps as a test, so a later change cannot quietly bring back the retired positioning,
// the coral register, the hex mark, or the old five-step spine.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PLUGIN = join(ROOT, "design-skill");
const SKILL = join(PLUGIN, "skills", "catalyst-shift-docs");
const TEMPLATES = join(SKILL, "templates");
const read = (p) => readFileSync(p, "utf8");

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const textFiles = walk(PLUGIN).filter((p) => /\.(md|html|css|json|py|svg)$/.test(p));

const SIX_SERVICES = [
  "Build software and AI applications",
  "Connect your company brain",
  "Set up Copilot and other AI platforms",
  "Get your people using AI",
  "Automate sales and marketing",
  "Automate operations",
];

test("no retired positioning, spine, offer or MSP module catalogue anywhere in design-skill", () => {
  const retired = /small businesses|cost nobody can match|Connect · Normalize|Workplace Readiness|M\.0[1-5]|Operator Brief|Halo|Dark-first/i;
  const hits = textFiles.flatMap((p) =>
    read(p).split("\n").map((line, i) => [p, i + 1, line]).filter(([, , line]) => retired.test(line)),
  );
  assert.deepEqual(hits.map(([p, n, l]) => `${relative(ROOT, p)}:${n}: ${l.trim()}`), []);
});

test("tokens: no coral or warm register, indigo only as ambient depth, teal accent, paper by default", () => {
  const css = read(join(SKILL, "assets", "colors_and_type.css"));
  assert.doesNotMatch(css, /#FF6F4D|--warm|--action/i);
  const indigo = css.split("\n").filter((l) => /#8B7CF6/i.test(l));
  assert.ok(indigo.length > 0 && indigo.every((l) => /ambient/i.test(l)), `indigo lines: ${indigo.join(" | ")}`);
  assert.match(css, /--signal:\s*#34E2C2/i);
  assert.match(css, /--signal-deep:\s*#0B7C6E/i);
  assert.match(css, /--bg:\s*var\(--paper\)/);
  // indigo is used only by the Ink passage glow, never by a template or the shell
  for (const p of [...walk(TEMPLATES), join(SKILL, "assets", "doc-shell.css")]) {
    assert.doesNotMatch(read(p), /var\(--accent\)|#8B7CF6|--warm|#FF6F4D/i, relative(ROOT, p));
  }
});

test("the positioning line is in SKILL.md, BRAND.md, README.md and the deck's lede", () => {
  const line = "AI integrators, management consultants and engineers";
  for (const f of ["SKILL.md", "BRAND.md", "README.md"]) assert.ok(read(join(SKILL, f)).includes(line), f);
  const ledes = read(join(TEMPLATES, "deck.html")).match(/<p class="lede">[\s\S]*?<\/p>/g) ?? [];
  assert.ok(ledes.some((l) => l.includes(line)), "deck lede");
});

test("proposal, SOW, deck and one-pager show the six services and Read → Build → Land → Stay", () => {
  for (const f of ["proposal.html", "sow.html", "deck.html", "one-pager.html"]) {
    const html = read(join(TEMPLATES, f));
    let at = -1;
    for (const s of SIX_SERVICES) {
      const i = html.indexOf(s);
      assert.ok(i > at, `${f}: "${s}" missing or out of order`);
      at = i;
    }
    assert.match(html, /class="step-rule"/, `${f}: step rule`);
    const steps = [...html.matchAll(/<span class="step">(\w+)<\/span>/g)].map((m) => m[1]);
    assert.deepEqual(steps, ["Read", "Build", "Land", "Stay"], f);
  }
});

test("plain wordmark only: no mark SVG in a template, and the hex mark files are gone", () => {
  for (const p of walk(TEMPLATES)) {
    const t = read(p);
    assert.doesNotMatch(t, /class="mark"/, relative(ROOT, p));
    assert.doesNotMatch(t, /mark(-dark|-light|-mono-white)?\.svg|logo-(inline|stacked)\.svg/, relative(ROOT, p));
  }
  for (const f of ["mark.svg", "mark-dark.svg", "mark-light.svg", "mark-mono-white.svg", "logo-inline.svg", "logo-stacked.svg"]) {
    assert.ok(!existsSync(join(SKILL, "assets", f)), `${f} still exists`);
  }
  for (const f of ["proposal.html", "sow.html", "deck.html", "one-pager.html"]) {
    assert.match(read(join(TEMPLATES, f)), /<span class="wordmark">Catalyst <span class="sh">Shift<\/span><\/span>/, f);
  }
});

test("INTAKE asks size, leadership and where it runs slower; no PSA/RMM or GCC questions; CMMC/CUI limits stay", () => {
  const intake = read(join(SKILL, "INTAKE.md"));
  assert.match(intake, /\*\*Size\*\*/);
  assert.match(intake, /\*\*Leadership\*\*/);
  assert.match(intake, /runs slower than it should/);
  assert.doesNotMatch(intake, /\bPSA\b|\bRMM\b|\bGCC\b/);
  assert.match(intake, /CMMC/);
  assert.match(intake, /CUI/);
});

test("BRAND.md 'What we don't do' carries the canon list", () => {
  const brand = read(join(SKILL, "BRAND.md"));
  const section = brand.split("## What we don't do")[1]?.split("\n## ")[0] ?? "";
  for (const s of ["Microsoft partner", "hours back", "time back", "free up time", "AI-powered", "leverage", "stakeholder", "ScalePad", "no cost", "CMMC", "CUI"]) {
    assert.ok(section.includes(s), `missing: ${s}`);
  }
});

test("design-skill plugin is at 5.0.0", () => {
  assert.equal(JSON.parse(read(join(PLUGIN, ".claude-plugin", "plugin.json"))).version, "5.0.0");
});
