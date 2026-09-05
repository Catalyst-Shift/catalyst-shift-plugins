#!/usr/bin/env node
// catalyst-ops · verify-gate — CAT-532 (decided 2026-09-05, option c).
//
// The Ways of Working block says a Normal PR "may auto-land once CI and the
// verifier pass". CI is a GitHub ruleset; the verifier's PASS is a Linear
// comment no ruleset can read. This PreToolUse hook is the missing half: it
// refuses the `gh pr merge` that /land-and-deploy runs unless /verify has
// recorded `VERDICT: PASS` for the exact commit being merged.
//
// Evidence: `.gstack/verify.jsonl` in the repo root — one JSON line per
// /verify run, `{issue, sha, base, checklist, verdict, ts}`, written by the
// /verify skill in the same step that posts the Linear comment (the comment
// stays the record of truth; the ledger is its machine-readable twin).
//
// Trust model, stated plainly: this is a discipline gate, not a security
// boundary. The session that built the PR could also forge a ledger line —
// the same session could equally skip /verify and post a fake comment. What
// the hook guarantees is that landing without a verify is never an ACCIDENT.
// The security boundary for Red paths is the agent-token separation
// (CAT-529): a human applies `red-approved` and merges.
//
// Scope: fires only in repos that carry the Ways of Working block (their
// root CLAUDE.md names `/verify`). Any other repo is untouched. Humans in a
// real terminal never pass through hooks — a founder's `gh pr merge` is
// unaffected, which is exactly the Red-tier contract.
//
// Escape hatch: CS_LAND_UNVERIFIED=1 allows the merge and appends a line to
// `.gstack/verify-bypass.log` so the bypass leaves a trace.
//
// Fail-open on anything that is not a recognisable `gh pr merge` from inside
// a git repo (malformed stdin, not a Bash call, no repo): the hook must never
// break unrelated Bash. Fail-CLOSED once it IS a merge in a governed repo and
// the evidence is missing — that is the whole point.

import { readFileSync, existsSync, appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const MERGE_RE = /(?:^|[\s;&|(])gh\s+pr\s+merge\b/;
const LEDGER = ".gstack/verify.jsonl";
const BYPASS_LOG = ".gstack/verify-bypass.log";

function allow() {
  process.exit(0);
}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    }) + "\n",
  );
  process.exit(0);
}

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

let input;
try {
  input = JSON.parse(readStdin());
} catch {
  allow();
}
if (!input || input.tool_name !== "Bash") allow();
const command = String(input.tool_input?.command ?? "");
if (!MERGE_RE.test(command)) allow();

const cwd = input.cwd || process.cwd();
let root;
try {
  root = git(["rev-parse", "--show-toplevel"], cwd);
} catch {
  allow(); // not a git repo — nothing to govern
}

// Opt-in: the repo carries the Ways of Working block (its CLAUDE.md names /verify).
let claudeMd = "";
try {
  claudeMd = readFileSync(join(root, "CLAUDE.md"), "utf8");
} catch {
  allow();
}
if (!claudeMd.includes("`/verify`")) allow();

// Which commit is being merged? A PR number/URL in the command wins; otherwise HEAD.
const ref = command.match(/gh\s+pr\s+merge\s+(?:(?:--?\S+(?:=\S+)?)\s+)*?(\d+|https?:\/\/\S+)/)?.[1];
let head;
try {
  head = ref
    ? execFileSync("gh", ["pr", "view", ref, "--json", "headRefOid", "-q", ".headRefOid"], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim()
    : git(["rev-parse", "HEAD"], root);
} catch {
  deny(
    `verify-gate: could not determine the commit being merged (${ref ? `gh pr view ${ref} failed` : "git rev-parse HEAD failed"}). ` +
      "Refusing to land unverified. Run /verify on the branch, then retry.",
  );
}
if (!/^[0-9a-f]{40}$/.test(head)) {
  deny(`verify-gate: unexpected head sha "${head}". Refusing to land unverified.`);
}

if (process.env.CS_LAND_UNVERIFIED === "1") {
  try {
    mkdirSync(join(root, ".gstack"), { recursive: true });
    if (!existsSync(join(root, ".gstack/.gitignore"))) writeFileSync(join(root, ".gstack/.gitignore"), "*\n");
    appendFileSync(
      join(root, BYPASS_LOG),
      JSON.stringify({ ts: new Date().toISOString(), sha: head, command, reason: "CS_LAND_UNVERIFIED=1" }) + "\n",
    );
  } catch {
    // the bypass still happens; the log is best-effort
  }
  allow();
}

let lines = [];
try {
  lines = readFileSync(join(root, LEDGER), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
} catch {
  // no ledger → no evidence
}

const forHead = lines.filter((e) => e && e.sha === head);
const latest = forHead.at(-1);
if (latest && latest.verdict === "PASS") allow();

const short = head.slice(0, 7);
if (!latest) {
  deny(
    `verify-gate: no /verify record for ${short} in ${LEDGER}. ` +
      "A Normal PR lands on CI green + verifier pass (HOW_WE_BUILD §5). Run /verify on this exact commit, then retry. " +
      "Deliberate override: CS_LAND_UNVERIFIED=1 (logged to .gstack/verify-bypass.log).",
  );
}
deny(
  `verify-gate: latest /verify for ${short} is VERDICT: ${latest.verdict} (${latest.issue ?? "?"} @ ${latest.ts ?? "?"}). ` +
    "Fix the failing lines, re-run /verify, then retry. Deliberate override: CS_LAND_UNVERIFIED=1 (logged).",
);
