// CAT-1433 item 6: a factory-reflect or /correct PR never touches a gate.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { check, canonBlock } from "../scripts/retro-guard.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts", "retro-guard.mjs");
const run = (stdin, args = [], cwd = ROOT) => spawnSync(process.execPath, [SCRIPT, "--check", ...args], { input: stdin, encoding: "utf8", cwd });

const GATES = [
  ".github/workflows/validate.yml",
  ".github/workflows/review-stamp.yml",
  ".github/ruleset-main.json",
  ".github/CODEOWNERS",
  "docs/CODEOWNERS",
  "catalyst-ops/skills/ways-of-working/SKILL.md",
  "scripts/protected-paths.mjs",
  "tests/protected-paths.test.mjs",
  "scripts/retro-guard.mjs",
  "tests/retro-guard.test.mjs",
];
const FINE = [
  "catalyst-ops/skills/card/SKILL.md",
  "catalyst-ops/skills/reflect/SKILL.md",
  "catalyst-ops/CHANGELOG.md",
  "factory/bin/claude-factory-dispatch",
  "tests/factory.test.mjs",
  "scripts/other.mjs",
  "docs/github/x.md",
  ".githubish/x.yml",
];

test("every gate path is a hit, each naming its reason", () => {
  const r = run(GATES.join("\n") + "\n");
  assert.equal(r.status, 1);
  assert.match(r.stdout, new RegExp(`RETRO PR TOUCHES A GATE \\(${GATES.length}\\):`));
  for (const p of GATES) assert.ok(r.stdout.includes(`  ${p}  ← `), p);
});

test("skills, scripts, tests and the changelog are fine", () => {
  const r = run(FINE.join("\n") + "\n");
  assert.equal(r.status, 0, r.stdout);
  assert.equal(r.stdout, "");
});

test("NUL-separated names work and a C-quoted path fails closed", () => {
  assert.equal(run(".github/x.yml\0README.md\0").status, 1);
  const r = run('"caf\\303\\251.md"\n');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /C-quoted path/);
});

test("CLAUDE.md: edits outside the Ways of Working block pass; edits inside it fail", () => {
  const block = "## Ways of Working — Catalyst Shift\n\n- **Hard stops** (...)\n";
  const base = `# Title\n\nintro\n\n${block}`;
  assert.equal(canonBlock(base), block);
  const outside = { baseText: { "CLAUDE.md": base }, headText: { "CLAUDE.md": base.replace("intro", "intro\n\n## Rules and what enforces them\n\n| a | b | c |") } };
  assert.deepEqual(check("CLAUDE.md\n", outside), []);
  const inside = { baseText: { "CLAUDE.md": base }, headText: { "CLAUDE.md": base.replace("(...)", "(none)") } };
  const hits = check("CLAUDE.md\n", inside);
  assert.equal(hits.length, 1);
  assert.match(hits[0], /Ways of Working block/);
  // A CLAUDE.md that gains the block (or loses it) also fails.
  assert.equal(check("CLAUDE.md\n", { baseText: { "CLAUDE.md": "# t\n" }, headText: { "CLAUDE.md": base } }).length, 1);
});

test("--base compares the working copy with git show <base>:<path>", () => {
  const t = mkdtempSync(join(tmpdir(), "retro-guard-"));
  const sh = (c) => {
    const r = spawnSync("bash", ["-c", c], { cwd: t, encoding: "utf8", env: { PATH: process.env.PATH, HOME: t, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } });
    assert.equal(r.status, 0, r.stderr);
  };
  const block = "## Ways of Working — Catalyst Shift\n\n- hard stops\n";
  mkdirSync(join(t, "sub"));
  writeFileSync(join(t, "sub", "CLAUDE.md"), `# a\n\n${block}`);
  sh("git init -q && git add -A && git commit -q -m base && git tag base");
  writeFileSync(join(t, "sub", "CLAUDE.md"), `# a\n\n## Rules and what enforces them\n\n${block}`);
  assert.equal(run("sub/CLAUDE.md\n", ["--base", "base"], t).status, 0);
  writeFileSync(join(t, "sub", "CLAUDE.md"), `# a\n\n${block.replace("hard stops", "no hard stops")}`);
  const r = run("sub/CLAUDE.md\n", ["--base", "base"], t);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /sub\/CLAUDE\.md {2}← the Ways of Working block/);
});

test("validate.yml runs the guard on factory-reflect and factory-correct branches only, with the full history", () => {
  const y = readFileSync(join(ROOT, ".github", "workflows", "validate.yml"), "utf8");
  assert.match(y, /startsWith\(github\.head_ref, 'factory-reflect'\)/);
  assert.match(y, /startsWith\(github\.head_ref, 'factory-correct'\)/);
  assert.match(y, /retro-guard\.mjs --check --base "origin\/\$BASE"/);
  assert.match(y, /git fetch --no-tags --unshallow/);
});

test("CLAUDE.md has the rules table above the Ways of Working block, every row naming an enforcer and a card", () => {
  const md = readFileSync(join(ROOT, "CLAUDE.md"), "utf8");
  const table = md.indexOf("## Rules and what enforces them");
  const canon = md.indexOf("## Ways of Working");
  assert.ok(table > 0 && table < canon, "the table sits before the canon block (the byte-identity check reads from the block to the end)");
  const rows = md.slice(table, canon).split("\n").filter((l) => /^\| /.test(l)).slice(2);
  assert.ok(rows.length >= 5);
  for (const row of rows) {
    const cells = row.split("|").slice(1, -1).map((c) => c.trim());
    assert.equal(cells.length, 3, row);
    assert.ok(cells.every(Boolean), row);
    assert.match(cells[2], /^CAT-\d+$/, row);
  }
});
