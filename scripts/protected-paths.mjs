#!/usr/bin/env node
// Red-path checker for catalyst-shift-plugins — CI twin of the platform's
// .claude/hooks/protected-paths.mjs --check (HOW_WE_BUILD.md §4/§6, CAT-537).
//
// This repo ships the rails other repos run on: the verify-gate hook, the
// Ways of Working canon block, plugin manifests, and its own CI. A Normal PR
// must not be able to change any of those on a green check alone. The
// `protected paths` workflow feeds this script the PR's changed file names
// (NUL-delimited, from the merge base, renames disabled) and fails the PR on
// any hit unless a named human applied `red-approved` to that exact head.
//
// Check-only — there is no PreToolUse mode here (nobody edits this repo from a
// Claude session with the repo as project root often enough to warrant one).
// Same fail-closed semantics as the platform: a C-quoted path is a hit in its
// own right, and unreadable stdin exits 2 (not a verdict).

import { readFileSync } from "node:fs";

// kind: "exact" (full relative path) | "prefix" (path starts with) |
//       "basename" (any depth) | "segment" (any directory segment equals)
export const PROTECTED = [
  { kind: "prefix", path: ".github/", why: "CI workflows and the ruleset payload — the rails; governance PR only" },
  { kind: "basename", path: "CLAUDE.md", why: "canon (the Ways of Working block) — governance PR only" },
  { kind: "segment", path: ".claude-plugin", why: "plugin / marketplace manifest — what every install picks up; governance PR only" },
  { kind: "segment", path: "hooks", why: "a plugin hook runs inside every Claude session that installs it (verify-gate) — governance PR only" },
  { kind: "prefix", path: "catalyst-ops/skills/ways-of-working/", why: "the canon block's generator source — a four-surface change, governance PR only" },
  { kind: "prefix", path: "catalyst-ops/skills/verify/", why: "the verifier the land gate trusts — governance PR only" },
  { kind: "prefix", path: "scripts/protected-paths", why: "this checker — governance PR only" },
  { kind: "prefix", path: "tests/protected-paths", why: "this checker's tests — governance PR only" },
];

export function matchProtected(rel) {
  const segments = rel.split("/");
  return PROTECTED.find((p) => {
    const guarded = p.path.toLowerCase();
    if (p.kind === "exact") return rel === guarded;
    if (p.kind === "basename") return rel === guarded || rel.endsWith("/" + guarded);
    if (p.kind === "segment") return segments.slice(0, -1).includes(guarded);
    return rel.startsWith(guarded);
  });
}

export function check(raw) {
  const lines = (raw.includes("\0") ? raw.split("\0") : raw.split("\n")).map((l) => l.trim()).filter(Boolean);
  const hits = [];
  for (const line of lines) {
    if (line.startsWith('"')) {
      hits.push(`  ${line}  ← C-quoted path (core.quotePath) — cannot classify; feed \`git diff -z\` output`);
      continue;
    }
    const rel = line.split("\\").join("/").toLowerCase();
    const hit = matchProtected(rel);
    if (hit) hits.push(`  ${line}  ← ${hit.why}`);
  }
  return hits;
}

if (process.argv.includes("--check")) {
  let raw;
  try {
    raw = readFileSync(0, "utf8");
  } catch (e) {
    process.stderr.write(`protected-paths --check: cannot read stdin (${e && e.code ? e.code : e})\n`);
    process.exit(2);
  }
  const hits = check(raw);
  if (hits.length) {
    process.stdout.write(`PROTECTED PATHS TOUCHED (${hits.length}):\n${hits.join("\n")}\n`);
    process.exit(1);
  }
  process.exit(0);
}
