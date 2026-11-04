// CAT-1486: the dispatcher takes each repo's factory stage from the board
// (GET /api/factory/stages, CAT-1471) on every tick, caches the answer, and
// gives it to the reviewer's self-merge rule. A fake curl answers from a board
// file: JSON for a 200, or "down" (network error), "401", "503 <code>" or
// "500". git is stubbed: the repo's origin is .../my-repo.git and its default
// branch's CLAUDE.md is a file the test writes. systemd-run keeps each unit's
// arguments so the reviewer prompt can be read.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DISPATCH = join(ROOT, "factory", "bin", "claude-factory-dispatch");
const read = (f) => readFileSync(f, "utf8");
const URL = "http://board.test/api/factory/stages";

function rig() {
  const t = mkdtempSync(join(tmpdir(), "factory-stages-"));
  const home = join(t, "home"), bin = join(t, "bin"), state = join(home, ".local/state/claude-factory");
  const repo = join(t, "my-repo-folder"), other = join(t, "other-repo");
  for (const d of [bin, state, repo, other, join(home, ".config/claude-factory")]) mkdirSync(d, { recursive: true });
  const board = join(t, "board"), calls = join(t, "calls"), units = join(t, "units"), md = join(t, "CLAUDE.md"), prs = join(t, "prs.json");
  writeFileSync(calls, "");
  writeFileSync(units, "");
  writeFileSync(md, "# repo\n");
  writeFileSync(prs, "[]");
  writeFileSync(join(bin, "curl"), `#!/usr/bin/env bash
cfg=$(cat); out=
while [ $# -gt 0 ]; do case $1 in -o) out=$2; shift;; http*) url=$1;; esac; shift; done
case $cfg in *'Authorization: Bearer tok-secret'*) ;; *) echo "curl: no token on stdin" >>"${calls}"; printf 401; exit 0;; esac
echo "GET $url" >>"${calls}"
case $url in */stages) ;; *) echo '{"version":1}' >"$out"; printf 200; exit 0;; esac
b=$(cat "${board}")
case $b in
  down) printf 000; exit 7;;
  401|403) echo '{"code":"bad_token"}' >"$out"; printf '%s' "$b";;
  "503 "*) printf '{"code":"%s"}' "\${b#503 }" >"$out"; printf 503;;
  500) echo 'oops' >"$out"; printf 500;;
  *) printf '%s' "$b" >"$out"; printf 200;;
esac
`, { mode: 0o755 });
  writeFileSync(join(bin, "git"), `#!/usr/bin/env bash
[ "$1" = -C ] && { d=$2; shift 2; }
case "$*" in
  "remote get-url origin") [ "$d" = "${repo}" ] && { echo "git@github.com:Catalyst-Shift/My-Repo.git"; exit 0; }; exit 2;;
  "show origin/HEAD:CLAUDE.md") [ "$d" = "${repo}" ] && { cat "${md}"; exit 0; }; exit 128;;
  "show origin/main:CLAUDE.md") exit 128;;
  *"worktree add"*) mkdir -p "\${@: -2:1}";;
esac
exit 0
`, { mode: 0o755 });
  writeFileSync(join(bin, "gh"), `#!/usr/bin/env bash
[ "$1 $2" = "api user" ] && { echo kkreative; exit 0; }
sub="$1 $2"; shift 2; n=; h=; q=.
[ "$sub" = "pr view" ] && { n=$1; shift; }
while [ $# -gt 0 ]; do case $1 in --head) h=$2; shift;; --jq) q=$2; shift;; esac; shift; done
if [ -n "$n" ]; then jq -r ".[] | select(.number == $n) | $q" "${prs}"
elif [ -n "$h" ]; then jq -r "[.[] | select(.headRefName == \\"$h\\")] | $q" "${prs}"
else jq -r "$q" "${prs}"; fi
`, { mode: 0o755 });
  writeFileSync(join(bin, "systemd-run"), `#!/usr/bin/env bash
for a; do case $a in --unit=*) u=\${a#--unit=};; esac; done
echo "$u.service" >>"${units}"; printf '%s\\n' "$@" >"${units}.$u.args"
`, { mode: 0o755 });
  writeFileSync(join(bin, "systemctl"), `#!/usr/bin/env bash
case "$*" in
  *list-units*) cat "${units}";;
  *is-active*) grep -qxF "\${!#}" "${units}"; exit;;
esac
exit 0
`, { mode: 0o755 });
  writeFileSync(join(bin, "claude"), "#!/bin/sh\necho NONE\n", { mode: 0o755 });
  const conf = join(home, ".config/claude-factory/repos.conf");
  const setConf = (extra = "") => writeFileSync(conf, `label kevin-omarchy\n${extra}${repo} proj\n${other} proj2\n`);
  setConf();
  const set = (b) => writeFileSync(board, typeof b === "string" ? b : JSON.stringify(b));
  const stages = (...pairs) => set({ repos: pairs.map(([repo, stage]) => ({ repo, stage, cleanSince: "2026-10-23", stageSince: "2026-11-01T00:00:00Z" })) });
  const env = (extra = {}) => ({ HOME: home, PATH: `${bin}:/usr/bin:/bin`, CLAUDE_BIN: join(bin, "claude"), FACTORY_INGEST_TOKEN: "tok-secret",
    CLAUDE_FACTORY_CONTROL_URL: "http://board.test/api/machines", CLAUDE_FACTORY_STAGES_URL: URL, CLAUDE_FACTORY_NODE: "/nonexistent",
    CLAUDE_FACTORY_CAP: "9", CLAUDE_FACTORY_WAITING_CAP: "99", ...extra });
  const run = (args = [], extra = {}) => spawnSync("bash", [DISPATCH, ...args], { encoding: "utf8", env: env(extra) });
  const tick = (extra) => { const r = run([], extra); assert.equal(r.status, 0, r.stderr); return r; };
  const json = () => { const r = run(["status", "--json"]); assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout).stages; };
  const mine = () => json().repos.find((x) => x.repo === "My-Repo");
  const rule = (risk, repoArg = "my-repo") => run(["merge-rule", repoArg, risk, "--dry-run"]);
  const stageCalls = () => read(calls).split("\n").filter((l) => l.endsWith("/stages")).length;
  return { t, home, state, repo, other, md, prs, units, set, stages, setConf, tick, run, json, mine, rule, stageCalls };
}

test("each tick asks the board with the token on stdin, caches the answer, and status --json shows stage and source", () => {
  const { t, state, stages, tick, json, stageCalls } = rig();
  try {
    stages(["my-repo", 3]);
    tick();
    assert.equal(stageCalls(), 1);
    const cache = JSON.parse(read(join(state, "stages.json")));
    assert.deepEqual(cache.repos, [{ repo: "my-repo", stage: 3 }]);
    assert.equal(read(join(state, "stages-source")), "board\n");
    const s = json();
    assert.equal(s.mode, "board");
    assert.equal(s.boardAnsweredAt, cache.fetchedAt);
    // The board names repos by GitHub name; the match ignores case. A repo with no origin goes by its folder name.
    assert.deepEqual(s.repos, [{ repo: "My-Repo", stage: 3, source: "board" }, { repo: "other-repo", stage: 1, source: "board" }]);
  } finally { rmSync(t, { recursive: true, force: true }); }
});

test("the board's answer is read fail-safe: a repo it leaves out is stage 1, a duplicate takes the lower stage, 4.0 is 4", () => {
  const { t, md, set, stages, tick, mine } = rig();
  try {
    // Left out: stage 1, even with 'Factory stage: 2' in CLAUDE.md.
    writeFileSync(md, "Factory stage: 2\n");
    stages(["someone-else", 4]);
    tick();
    assert.deepEqual(mine(), { repo: "My-Repo", stage: 1, source: "board" });
    stages(["My-Repo", 4], ["my-repo", 2]);
    tick();
    assert.deepEqual(mine(), { repo: "My-Repo", stage: 2, source: "board" });
    set({ repos: [{ repo: "my-repo", stage: 4.0 }, { repo: "x", stage: "4" }, { repo: "y", stage: 5 }, "junk"] });
    tick();
    assert.deepEqual(mine(), { repo: "My-Repo", stage: 4, source: "board" });
    set('{"repos":[{"repo":"my-repo","stage":"4"}]}');
    tick();
    assert.deepEqual(mine(), { repo: "My-Repo", stage: 1, source: "board" });
  } finally { rmSync(t, { recursive: true, force: true }); }
});

test("503 read_failed, a network error or a bad answer keeps the cache", () => {
  const { t, set, stages, tick, mine } = rig();
  try {
    stages(["my-repo", 4]);
    tick();
    for (const b of ["503 read_failed", "down", "500", '{"nope":1}']) {
      set(b);
      const r = tick();
      assert.deepEqual(mine(), { repo: "My-Repo", stage: 4, source: "cache" }, b);
      assert.match(r.stdout, /the board's stages endpoint answered .*; using the last answer/, b);
    }
  } finally { rmSync(t, { recursive: true, force: true }); }
});

test("401 or 503 not_configured falls back to the CLAUDE.md line even with a cache", () => {
  const { t, md, set, stages, tick, mine } = rig();
  try {
    writeFileSync(md, "# repo\nFactory stage: 2\n");
    stages(["my-repo", 4]);
    tick();
    for (const b of ["401", "403", "503 not_configured"]) {
      set(b);
      const r = tick();
      assert.deepEqual(mine(), { repo: "My-Repo", stage: 2, source: "claude-md" }, b);
      assert.match(r.stdout, /using each repo's CLAUDE.md line/, b);
    }
    // The CLAUDE.md fallback knows only stage 2, as before: any other line is stage 1.
    writeFileSync(md, "Factory stage: 3\n");
    assert.deepEqual(mine(), { repo: "My-Repo", stage: 1, source: "claude-md" });
  } finally { rmSync(t, { recursive: true, force: true }); }
});

test("a cache over 24 hours old is not trusted: the CLAUDE.md line rules until the board answers again", () => {
  const { t, state, md, set, stages, tick, mine } = rig();
  try {
    writeFileSync(md, "Factory stage: 2\n");
    stages(["my-repo", 4]);
    tick();
    const f = join(state, "stages.json");
    const cache = JSON.parse(read(f));
    writeFileSync(f, JSON.stringify({ ...cache, fetchedAt: new Date(Date.now() - 25 * 3600e3).toISOString() }));
    set("503 read_failed");
    const r = tick();
    assert.match(r.stdout, /using each repo's CLAUDE.md line/);
    assert.deepEqual(mine(), { repo: "My-Repo", stage: 2, source: "claude-md" });
    // 23 hours old still counts.
    writeFileSync(f, JSON.stringify({ ...cache, fetchedAt: new Date(Date.now() - 23 * 3600e3).toISOString() }));
    tick();
    assert.deepEqual(mine(), { repo: "My-Repo", stage: 4, source: "cache" });
  } finally { rmSync(t, { recursive: true, force: true }); }
});

test("a failure with no cache falls back to the CLAUDE.md line", () => {
  const { t, md, set, tick, mine, state } = rig();
  try {
    writeFileSync(md, "Factory stage: 2\n");
    set("503 read_failed");
    tick();
    assert.ok(!existsSync(join(state, "stages.json")));
    assert.deepEqual(mine(), { repo: "My-Repo", stage: 2, source: "claude-md" });
  } finally { rmSync(t, { recursive: true, force: true }); }
});

test("no token, or 'stages claude-md' in repos.conf, never calls the board and uses the CLAUDE.md line", () => {
  const { t, md, stages, setConf, tick, json, mine, stageCalls } = rig();
  try {
    writeFileSync(md, "Factory stage: 2\n");
    stages(["my-repo", 4]);
    tick({ FACTORY_INGEST_TOKEN: "" });
    assert.equal(stageCalls(), 0);
    assert.deepEqual(mine(), { repo: "My-Repo", stage: 2, source: "claude-md" });
    // The rollback line: a good cache from an earlier tick is ignored too.
    tick();
    assert.equal(mine().source, "board");
    setConf("stages claude-md\n");
    tick();
    assert.equal(stageCalls(), 1);
    assert.equal(json().mode, "claude-md");
    assert.deepEqual(mine(), { repo: "My-Repo", stage: 2, source: "claude-md" });
  } finally { rmSync(t, { recursive: true, force: true }); }
});

test("merge-rule: stage 2 = Low, 3 = Low and Medium, 4 = any risk; stage 1 and an unclear risk never", () => {
  const { t, stages, tick, rule } = rig();
  try {
    const want = { 1: [], 2: ["Low"], 3: ["Low", "Medium"], 4: ["Low", "Medium", "High"] };
    for (const stage of [1, 2, 3, 4]) {
      stages(["my-repo", stage]);
      tick();
      for (const risk of ["Low", "medium", "HIGH", "unclear", "or"]) {
        const r = rule(risk);
        const norm = risk[0].toUpperCase() + risk.slice(1).toLowerCase();
        const ok = want[stage].includes(norm);
        assert.equal(r.status, ok ? 0 : 1, `${stage} ${risk}: ${r.stdout}${r.stderr}`);
        assert.match(r.stdout, ok ? /self-merge allowed/ : /no self-merge/, `${stage} ${risk}`);
        assert.match(r.stdout, new RegExp(`^My-Repo: stage ${stage} \\(from board\\)`));
      }
    }
    // Below stage 4 the code-owner rule stays; stage 4 High names the post-merge review day.
    stages(["my-repo", 3]);
    tick();
    assert.match(rule("Low").stdout, /and no code-owner paths/);
    stages(["my-repo", 4]);
    tick();
    assert.doesNotMatch(rule("Low").stdout, /code-owner|post-merge/);
    assert.match(rule("High").stdout, /, and a post-merge review due \d{4}-\d{2}-\d{2}$/m);
  } finally { rmSync(t, { recursive: true, force: true }); }
});

test("merge-rule finds a repo by folder or GitHub name, and refuses one that isn't in repos.conf", () => {
  const { t, repo, stages, tick, rule } = rig();
  try {
    stages(["my-repo", 2]);
    tick();
    assert.equal(rule("Low", "my-repo-folder").status, 0);
    assert.equal(rule("Low", repo).status, 0);
    const r = rule("Low", "nope");
    assert.equal(r.status, 2);
    assert.match(r.stderr, /nope is not a repo in/);
    // A directory outside repos.conf is refused too, even one that exists.
    assert.equal(rule("Low", t).status, 2);
  } finally { rmSync(t, { recursive: true, force: true }); }
});

test("a board veto is honoured on the next tick: the dry-run prints no self-merge", () => {
  const { t, stages, tick, rule } = rig();
  try {
    stages(["my-repo", 3]);
    tick();
    assert.equal(rule("Medium").status, 0);
    // A founder vetoes the move to 3: the board answers 2 again.
    stages(["my-repo", 2]);
    assert.equal(rule("Medium").status, 0, "nothing changes before the tick");
    tick();
    const r = rule("Medium");
    assert.equal(r.status, 1);
    assert.match(r.stdout, /^My-Repo: stage 2 \(from board\), risk Medium: no self-merge \(stage 2 allows Low\)$/m);
  } finally { rmSync(t, { recursive: true, force: true }); }
});

test("the reviewer prompt carries the stage, its source, the merge-rule check and, at stage 4, the post-merge review", () => {
  const { t, state, repo, prs, units, stages, tick } = rig();
  try {
    const sha = "9".repeat(40);
    writeFileSync(prs, JSON.stringify([{ number: 9, headRefOid: sha, headRefName: "b/cat-9-x", body: "", author: { login: "kkreative" },
      isDraft: false, labels: [], isCrossRepository: false, mergeable: "MERGEABLE", state: "OPEN", url: "u9" }]));
    writeFileSync(join(state, "launched"), `${repo} b/cat-9-x cat-9\n`);
    const prompt = () => { const a = read(`${units}.factory-review-cat-9.args`).split("\n"); return a.slice(a.indexOf("text") + 1).join("\n"); };

    stages(["my-repo", 3]);
    tick();
    assert.equal(read(units), "factory-review-cat-9.service\n");
    let p = prompt();
    assert.match(p, /this repo is at factory stage 3 \(from board; the dispatcher gives the stage/);
    assert.match(p, /Stage 3 lets you self-merge risk: Low or Medium\./);
    assert.match(p, /no file in gh pr diff 9 --name-only matches a path in the base branch's \.github\/CODEOWNERS/);
    assert.match(p, new RegExp(`${DISPATCH.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")} merge-rule My-Repo <that risk> --dry-run prints 'self-merge allowed'`));
    assert.doesNotMatch(p, /post-merge/);

    // A new head, the board at 4, a Friday: the review is due Monday.
    rmSync(join(repo, ".claude"), { recursive: true, force: true });
    writeFileSync(units, "");
    const sha2 = "8".repeat(40);
    writeFileSync(prs, read(prs).replace(sha, sha2));
    stages(["my-repo", 4]);
    tick({ CLAUDE_FACTORY_TODAY: "2026-11-06" });
    assert.equal(read(units), "factory-review-cat-9.service\n");
    p = prompt();
    assert.match(p, /Stage 4 lets you self-merge risk: Low, Medium or High\./);
    assert.match(p, /stage 4 allows code-owner paths/);
    assert.match(p, /\(f\) Stage 4 with Risk High: once \(a\) to \(e\) hold and before the gh pr merge, add the existing label 'post-merge-review' to the card \(keep all its other labels\) and comment on the card exactly 'post-merge review due 2026-11-09'; if either fails, never turn on auto-merge/);
    assert.match(p, /The card then stays In Review until a founder clears that label\./);
  } finally { rmSync(t, { recursive: true, force: true }); }
});
