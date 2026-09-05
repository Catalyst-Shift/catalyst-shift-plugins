// node --test catalyst-ops/tests — no dependencies.
// Builds a throwaway git repo per case and drives the hook the way Claude Code
// does: a PreToolUse JSON envelope on stdin, a decision envelope (or silence) on stdout.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HOOK = join(dirname(fileURLToPath(import.meta.url)), "..", "hooks", "verify-gate.mjs");

function repo({ governed = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "verify-gate-"));
  const git = (...a) => execFileSync("git", a, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  git("init", "-q");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "t");
  writeFileSync(join(dir, "CLAUDE.md"), governed ? "- **Verify before ship.** `/verify`: a fresh-context agent…\n" : "# nothing governed here\n");
  git("add", "-A");
  git("commit", "-q", "-m", "init");
  const head = git("rev-parse", "HEAD");
  return { dir, head, git };
}

function ledger(dir, entries) {
  mkdirSync(join(dir, ".gstack"), { recursive: true });
  writeFileSync(join(dir, ".gstack/verify.jsonl"), entries.map((e) => JSON.stringify(e)).join("\n") + "\n");
}

function run(dir, command, { env = {}, stdin, path } = {}) {
  const input = stdin ?? JSON.stringify({ tool_name: "Bash", tool_input: { command }, cwd: dir });
  const r = spawnSync(process.execPath, [HOOK], {
    input,
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, CS_LAND_UNVERIFIED: "", ...(path ? { PATH: `${path}:${process.env.PATH}` } : {}), ...env },
  });
  assert.equal(r.status, 0, `hook must always exit 0 (stderr: ${r.stderr})`);
  return r.stdout.trim() ? JSON.parse(r.stdout).hookSpecificOutput : null;
}

// A fake `gh` that answers `gh pr view <n> --json headRefOid -q .headRefOid` with
// whatever GH_STUB_HEAD holds, and records every invocation.
function ghStub(head) {
  const bin = mkdtempSync(join(tmpdir(), "gh-stub-"));
  const log = join(bin, "calls.log");
  writeFileSync(
    join(bin, "gh"),
    `#!/bin/sh\necho "$@" >> "${log}"\ncase "$*" in *"pr view"*) echo "${head}";; *) exit 1;; esac\n`,
  );
  chmodSync(join(bin, "gh"), 0o755);
  return { bin, calls: () => (existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").filter(Boolean) : []) };
}

test("a non-merge Bash command is never touched", () => {
  const { dir } = repo();
  assert.equal(run(dir, "gh pr view --json url"), null);
  assert.equal(run(dir, "git push -u origin HEAD"), null);
  assert.equal(run(dir, "ghp pr merge"), null); // a different binary
  assert.equal(run(dir, "gh prs merge"), null);
});

test("fail-open on malformed stdin, a non-Bash tool, and a directory that is not a git repo", () => {
  const { dir } = repo();
  assert.equal(run(dir, "", { stdin: "not json" }), null);
  assert.equal(run(dir, "", { stdin: JSON.stringify({ tool_name: "Write", tool_input: { file_path: "x" } }) }), null);
  const bare = mkdtempSync(join(tmpdir(), "not-a-repo-"));
  assert.equal(run(bare, "gh pr merge --squash"), null);
  rmSync(bare, { recursive: true, force: true });
});

test("a repo without the Ways of Working block is not governed", () => {
  const { dir } = repo({ governed: false });
  assert.equal(run(dir, "gh pr merge --squash --auto --delete-branch"), null);
});

test("governed repo, no ledger → deny, naming the ledger and the override", () => {
  const { dir, head } = repo();
  const out = run(dir, "gh pr merge --squash --auto --delete-branch");
  assert.equal(out?.permissionDecision, "deny");
  assert.match(out.permissionDecisionReason, /no \/verify record for/);
  assert.match(out.permissionDecisionReason, new RegExp(head.slice(0, 7)));
  assert.match(out.permissionDecisionReason, /\.gstack\/verify\.jsonl/);
  assert.match(out.permissionDecisionReason, /CS_LAND_UNVERIFIED=1/);
});

test("PASS recorded for HEAD → allow; PASS for a different sha → deny", () => {
  const { dir, head } = repo();
  ledger(dir, [{ issue: "CAT-1", sha: "0".repeat(40), verdict: "PASS", ts: "2026-09-05T00:00:00Z" }]);
  assert.equal(run(dir, "gh pr merge --squash")?.permissionDecision, "deny");
  ledger(dir, [{ issue: "CAT-1", sha: head, verdict: "PASS", ts: "2026-09-05T00:00:00Z" }]);
  assert.equal(run(dir, "gh pr merge --squash"), null);
});

test("the LATEST record for the sha wins: PASS then FAIL → deny; FAIL then PASS → allow", () => {
  const { dir, head } = repo();
  ledger(dir, [
    { issue: "CAT-1", sha: head, verdict: "PASS", ts: "1" },
    { issue: "CAT-1", sha: head, verdict: "FAIL (1 of 3)", ts: "2" },
  ]);
  const out = run(dir, "gh pr merge --squash");
  assert.equal(out?.permissionDecision, "deny");
  assert.match(out.permissionDecisionReason, /VERDICT: FAIL \(1 of 3\)/);
  ledger(dir, [
    { issue: "CAT-1", sha: head, verdict: "FAIL (1 of 3)", ts: "1" },
    { issue: "CAT-1", sha: head, verdict: "PASS", ts: "2" },
  ]);
  assert.equal(run(dir, "gh pr merge --squash"), null);
});

test("a malformed ledger line is skipped, not fatal", () => {
  const { dir, head } = repo();
  mkdirSync(join(dir, ".gstack"), { recursive: true });
  writeFileSync(join(dir, ".gstack/verify.jsonl"), `{oops\n${JSON.stringify({ sha: head, verdict: "PASS" })}\n`);
  assert.equal(run(dir, "gh pr merge --squash"), null);
});

test("a PR number in the command resolves the head via gh, not the local HEAD", () => {
  const { dir, head } = repo();
  const other = "a".repeat(40);
  const stub = ghStub(other);
  ledger(dir, [{ sha: head, verdict: "PASS" }]); // local HEAD is verified…
  const out = run(dir, "gh pr merge 42 --squash", { path: stub.bin }); // …but PR 42's head is not
  assert.equal(out?.permissionDecision, "deny");
  assert.match(out.permissionDecisionReason, new RegExp(other.slice(0, 7)));
  assert.ok(stub.calls().some((c) => c.includes("pr view 42")), "gh pr view 42 was consulted");
  ledger(dir, [{ sha: other, verdict: "PASS" }]);
  assert.equal(run(dir, "gh pr merge 42 --squash", { path: stub.bin }), null);
});

test("flags before the PR number do not swallow it; a URL is accepted as the ref", () => {
  const { dir } = repo();
  const other = "b".repeat(40);
  const stub = ghStub(other);
  ledger(dir, [{ sha: other, verdict: "PASS" }]);
  assert.equal(run(dir, "gh pr merge --squash --delete-branch 7", { path: stub.bin }), null);
  assert.equal(run(dir, "gh pr merge https://github.com/o/r/pull/7 --squash", { path: stub.bin }), null);
});

test("gh failure while resolving a PR ref → deny (fail closed), never allow", () => {
  const { dir } = repo();
  const bin = mkdtempSync(join(tmpdir(), "gh-broken-"));
  writeFileSync(join(bin, "gh"), "#!/bin/sh\nexit 1\n");
  chmodSync(join(bin, "gh"), 0o755);
  const out = run(dir, "gh pr merge 9", { path: bin });
  assert.equal(out?.permissionDecision, "deny");
  assert.match(out.permissionDecisionReason, /could not determine the commit/);
});

test("CS_LAND_UNVERIFIED=1 allows and leaves a trace; any other value does not", () => {
  const { dir, head } = repo();
  assert.equal(run(dir, "gh pr merge --squash", { env: { CS_LAND_UNVERIFIED: "true" } })?.permissionDecision, "deny");
  assert.equal(run(dir, "gh pr merge --squash", { env: { CS_LAND_UNVERIFIED: "1" } }), null);
  const log = readFileSync(join(dir, ".gstack/verify-bypass.log"), "utf8");
  assert.match(log, new RegExp(head));
  assert.equal(readFileSync(join(dir, ".gstack/.gitignore"), "utf8"), "*\n");
});

test("mutation guard: the gate is the ledger lookup — a merge with a PASS for a DIFFERENT commit must not pass on prefix", () => {
  const { dir, head } = repo();
  ledger(dir, [{ sha: head.slice(0, 7), verdict: "PASS" }]); // short sha is not full-sha equality
  assert.equal(run(dir, "gh pr merge --squash")?.permissionDecision, "deny");
});
