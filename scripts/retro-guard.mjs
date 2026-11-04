#!/usr/bin/env node
// Retros never add gates (CAT-1433). A `factory-reflect` or `/correct` PR may
// edit skills, CLAUDE.md sections outside the canon block, scripts and tests.
// It may not touch the rails: CI (.github/), rulesets, CODEOWNERS, the
// required-checks list (.github/ruleset-main.json), the hard-stop list (the
// Ways of Working block in CLAUDE.md and its generator, the ways-of-working
// skill), or this guard and the deep-path checker. CI runs this on branches
// named factory-reflect* and factory-correct* (validate.yml).
//
//   git diff -z --name-only origin/<base>...HEAD | node scripts/retro-guard.mjs --check --base origin/<base>
//
// Same fail-closed semantics as protected-paths.mjs: a C-quoted path is a hit,
// unreadable stdin exits 2. With --base, each changed CLAUDE.md must keep its
// "## Ways of Working" block (to the end of the file) byte-identical to the
// base's, read with `git show <base>:<path>`.

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

export const GUARDED = [
  { kind: "prefix", path: ".github/", why: "CI, rulesets, CODEOWNERS and the required-checks list: a retro never adds, loosens or removes a gate" },
  { kind: "basename", path: "CODEOWNERS", why: "CODEOWNERS: who must approve is not a retro's call" },
  { kind: "prefix", path: "catalyst-ops/skills/ways-of-working/", why: "the hard-stop list and the rest of the canon block's generator source" },
  { kind: "prefix", path: "scripts/protected-paths", why: "the deep-path list" },
  { kind: "prefix", path: "tests/protected-paths", why: "the deep-path list's tests" },
  { kind: "prefix", path: "scripts/retro-guard", why: "this guard" },
  { kind: "prefix", path: "tests/retro-guard", why: "this guard's tests" },
];

const CANON = "## Ways of Working";

export function matchGuarded(rel) {
  return GUARDED.find((g) => {
    const guarded = g.path.toLowerCase();
    if (g.kind === "basename") return rel === guarded || rel.endsWith("/" + guarded);
    return rel.startsWith(guarded);
  });
}

// The canon block as the byte-identity check reads it: from its heading to the end.
export function canonBlock(text) {
  const i = text.indexOf("\n" + CANON);
  const start = text.startsWith(CANON) ? 0 : i < 0 ? -1 : i + 1;
  return start < 0 ? null : text.slice(start);
}

export function check(raw, { baseText, headText } = {}) {
  const lines = (raw.includes("\0") ? raw.split("\0") : raw.split("\n")).map((l) => l.trim()).filter(Boolean);
  const hits = [];
  for (const line of lines) {
    if (line.startsWith('"')) {
      hits.push(`  ${line}  ← C-quoted path (core.quotePath) — cannot classify; feed \`git diff -z\` output`);
      continue;
    }
    const rel = line.split("\\").join("/").toLowerCase();
    const hit = matchGuarded(rel);
    if (hit) hits.push(`  ${line}  ← ${hit.why}`);
    else if ((rel === "claude.md" || rel.endsWith("/claude.md")) && baseText !== undefined && headText !== undefined) {
      if (canonBlock(baseText[line]) !== canonBlock(headText[line])) {
        hits.push(`  ${line}  ← the Ways of Working block (the hard-stop list lives in it) changed; sections outside it are fine`);
      }
    }
  }
  return hits;
}

if (process.argv.includes("--check")) {
  let raw;
  try {
    raw = readFileSync(0, "utf8");
  } catch (e) {
    process.stderr.write(`retro-guard --check: cannot read stdin (${e && e.code ? e.code : e})\n`);
    process.exit(2);
  }
  const bi = process.argv.indexOf("--base");
  const base = bi > 0 ? process.argv[bi + 1] : undefined;
  let extra = {};
  if (base) {
    const baseText = {}, headText = {};
    for (const name of (raw.includes("\0") ? raw.split("\0") : raw.split("\n")).map((l) => l.trim()).filter(Boolean)) {
      if (name.startsWith('"') || !/(^|\/)CLAUDE\.md$/i.test(name)) continue;
      try { baseText[name] = execFileSync("git", ["show", `${base}:${name}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { baseText[name] = ""; }
      try { headText[name] = readFileSync(name, "utf8"); } catch { headText[name] = ""; }
    }
    extra = { baseText, headText };
  }
  const hits = check(raw, extra);
  if (hits.length) {
    process.stdout.write(`RETRO PR TOUCHES A GATE (${hits.length}):\n${hits.join("\n")}\nA factory-reflect or /correct PR never changes these; open a governance PR instead.\n`);
    process.exit(1);
  }
  process.exit(0);
}
