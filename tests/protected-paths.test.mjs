import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts", "protected-paths.mjs");

function check(stdin) {
  return spawnSync(process.execPath, [SCRIPT, "--check"], { input: stdin, encoding: "utf8", cwd: ROOT });
}

const RED = [
  ".github/workflows/validate.yml",
  ".github/workflows/protected-paths.yml",
  ".github/ruleset-main.json",
  "CLAUDE.md",
  "catalyst-ops/CLAUDE.md",
  ".claude-plugin/marketplace.json",
  "catalyst-ops/.claude-plugin/plugin.json",
  "design-skill/.claude-plugin/plugin.json",
  "catalyst-ops/hooks/hooks.json",
  "catalyst-ops/hooks/verify-gate.mjs",
  "future-plugin/hooks/anything.sh",
  "catalyst-ops/skills/ways-of-working/SKILL.md",
  "catalyst-ops/skills/verify/SKILL.md",
  "scripts/protected-paths.mjs",
  "tests/protected-paths.test.mjs",
];
const NORMAL = [
  "README.md",
  "CONTRIBUTING.md",
  "catalyst-ops/README.md",
  "catalyst-ops/skills/decision-governance/SKILL.md",
  "design-skill/skills/catalyst-shift-docs/SKILL.md",
  "catalyst-ops/tests/verify-gate.test.mjs", // the hook's tests live under tests/, not hooks/
  "docs/NOT-CLAUDE.md",
  "docs/CLAUDE.md.bak",
  "hooks.md", // a FILE named hooks is not a hooks/ directory
  "catalyst-ops/hooksmith/x.mjs",
  ".claude-plugins/x.json", // one character outside the segment
  "scripts/protect.mjs",
  ".githubish/x.yml",
];

test("every Red sample is a hit, each naming its reason", () => {
  const r = check(RED.join("\n") + "\n");
  assert.equal(r.status, 1);
  assert.match(r.stdout, new RegExp(`PROTECTED PATHS TOUCHED \\(${RED.length}\\):`));
  for (const p of RED) assert.match(r.stdout, new RegExp(`  ${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}  ← `));
});

test("every Normal lookalike exits 0 silently", () => {
  const r = check(NORMAL.join("\n") + "\n");
  assert.equal(r.status, 0, r.stdout);
  assert.equal(r.stdout, "");
});

test("hits are counted, not lines — Normal siblings are not listed", () => {
  const r = check("README.md\ncatalyst-ops/hooks/verify-gate.mjs\nCONTRIBUTING.md\n");
  assert.equal(r.status, 1);
  assert.match(r.stdout, /TOUCHED \(1\):/);
  assert.doesNotMatch(r.stdout, /README|CONTRIBUTING/);
});

test("NUL-delimited input (git diff -z), case variants and backslashes", () => {
  const r = check("README.md\0Catalyst-Ops\\Hooks\\verify-gate.mjs\0.GitHub/x.yml\0");
  assert.equal(r.status, 1);
  assert.match(r.stdout, /TOUCHED \(2\):/);
  assert.match(r.stdout, /  Catalyst-Ops\\Hooks\\verify-gate\.mjs  ← /); // echoes git's original line
});

test("fails CLOSED on a C-quoted path, even an unprotected one", () => {
  const r = check('"docs/caf\\303\\251.md"\nREADME.md\n');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /C-quoted path/);
});

test("empty / whitespace / lone-NUL input exits 0 silently", () => {
  for (const s of ["", "\n", "  \n\n", "\0"]) {
    const r = check(s);
    assert.equal(r.status, 0);
    assert.equal(r.stdout, "");
  }
});

test("every exact/prefix entry still names something tracked — a stale rule guards nothing", async () => {
  const { PROTECTED } = await import(SCRIPT);
  const tracked = spawnSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" }).stdout.split("\0").filter(Boolean);
  for (const p of PROTECTED.filter((e) => e.kind === "exact" || e.kind === "prefix")) {
    const live = tracked.some((f) => (p.kind === "exact" ? f === p.path : f.startsWith(p.path)));
    assert.ok(live, `${p.kind} ${p.path} matches no tracked file`);
  }
  assert.ok(existsSync(join(ROOT, ".github")));
});
