// CAT-1542: the board keeps every factory PR's state from GitHub's webhooks
// (CAT-1541, CAT-1560) and serves a repo's open PRs at
// GET /api/factory/prs?repo=<name>. The dispatcher reads that once per repo
// per tick with the machine token, in place of GitHub's list and per-PR
// mergeability reads, and reads GitHub (CAT-1540's one list per repo) only when
// the answer is stale, fails, trails origin, or there is no token. Writes and
// the merge rule's founder gate still go to GitHub.
//
// A fake curl answers the board from each repo's prs.json (in gh pr list's
// field names, turned into the board's wire shape) per the mode in the board
// file: fresh (the default), stale, down, or 503. A fake gh answers GitHub's
// REST reads from the same file and logs every call; git answers ls-remote
// from the repo's tips file and get-url as github.com:Catalyst-Shift/<folder> (or the folder's origin file).
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
const sha = (c) => c.repeat(40);
const LIST = "repos/{owner}/{repo}/pulls?state=open&per_page=100";
const PRS_URL = "http://board.test/api/factory/prs";

function machine(name) {
  const t = mkdtempSync(join(tmpdir(), `factory-board-${name}-`));
  const home = join(t, "home"), bin = join(t, "bin"), state = join(home, ".local/state/claude-factory");
  const units = join(t, "units"), calls = join(t, "calls"), curls = join(t, "curls"), board = join(t, "board");
  const repoA = join(t, "Repo_A"), repoB = join(t, "Repo_B");
  for (const d of [bin, state, repoA, repoB, join(home, ".config/claude-factory")]) mkdirSync(d, { recursive: true });
  const pr = (number, extra = {}) => ({
    number, headRefOid: sha(String(number % 10)), headRefName: `b/${number}`, baseRefName: "main", body: "",
    author: { login: "kkreative" }, isDraft: false, labels: [], mergeable: "MERGEABLE", isCrossRepository: false,
    updatedAt: "2026-11-05T10:00:00Z", checks: "red", ...extra,
  });
  // Repo A: PR #1 wants a review; PR #7 is this machine's card branch, red CI, labelled needs-ci-call.
  const setA = (prs) => writeFileSync(join(repoA, "prs.json"), JSON.stringify(prs));
  setA([pr(1), pr(7, { headRefName: "b/cat-7-x", body: `Reviewed: ${sha("7")} — /review`, labels: [{ name: "needs-ci-call" }] })]);
  // Repo B: PR #2's mergeability isn't computed yet.
  writeFileSync(join(repoB, "prs.json"), JSON.stringify([pr(2, { mergeable: "UNKNOWN", body: `Reviewed: ${sha("2")} — /review` })]));
  // Origin's branches: each PR's head is on origin at the sha the board has.
  const tips = (dir, extra = "") => writeFileSync(join(dir, "tips"),
    JSON.parse(read(join(dir, "prs.json"))).map((p) => `${p.headRefOid}\trefs/heads/${p.headRefName}\n`).join("") + `${sha("a")}\trefs/heads/main\n` + extra);
  tips(repoA); tips(repoB);
  writeFileSync(calls, ""); writeFileSync(curls, ""); writeFileSync(units, "");
  writeFileSync(join(bin, "curl"), `#!/usr/bin/env bash
cfg=$(cat); out=; url=
while [ $# -gt 0 ]; do case $1 in -o) out=$2; shift;; http*) url=$1;; esac; shift; done
case $cfg in *'Authorization: Bearer tok-secret'*) ;; *) echo "no token on stdin" >>"${curls}"; printf 401; exit 0;; esac
echo "GET $url" >>"${curls}"
case $url in ${PRS_URL}\\?repo=*) ;; *) echo '{"version":1}' >"$out"; printf 200; exit 0;; esac
r=\${url##*repo=}
mode=$(cat "${board}" 2>/dev/null || echo fresh)
case $mode in
  down) printf 000; exit 7;;
  503) echo '{"code":"read_failed"}' >"$out"; printf 503; exit 0;;
esac
stale=false; [ "$mode" = stale ] && stale=true
jq -c --arg r "$r" --argjson stale $stale '{repo: $r, fetchedAt: "2026-11-05T12:00:00Z", stale: $stale, prs: [.[] | .headRefOid as $s | {number,
  headSha: .headRefOid, headRef: .headRefName, baseRef: .baseRefName, draft: .isDraft, author: .author.login, labels: [.labels[].name],
  mergeable: (.mergeable | ascii_downcase), checks: {state: .checks, failing: []}, reviewedAtHead: ((.body // "") | startswith("Reviewed: " + $s)),
  qaAtHead: false, updatedAt: .updatedAt}]}' "${t}/$r/prs.json" >"$out"
# A test can bend the answer with a jq filter in the mutate file.
[ -s "${t}/mutate" ] && { jq -c "$(cat "${t}/mutate")" "$out" >"$out.m" && mv "$out.m" "$out"; }
printf 200
`, { mode: 0o755 });
  writeFileSync(join(bin, "gh"), `#!/usr/bin/env bash
echo "$*" >>"${calls}"
[ "$1 $2" = "api user" ] && { echo kkreative; exit 0; }
if [ "$1 $2" = "api -i" ]; then
  shift 2
  [ "$1" = -H ] && shift 2
  path=$1
  case $path in
    "repos/{owner}/{repo}/pulls?state=open&"*)
      body=$(jq -c '[.[] | {number, head: {sha: .headRefOid, ref: .headRefName, repo: {full_name: "o/r"}},
        base: {ref: .baseRefName, repo: {full_name: "o/r"}}, draft: .isDraft, user: {login: .author.login}, labels, body,
        html_url: "https://github.com/o/r/pull/\\(.number)", updated_at: .updatedAt}]' prs.json) ;;
    "repos/{owner}/{repo}/pulls/"*)
      body=$(jq -c --argjson n "\${path##*/}" '.[] | select(.number == $n) | {number, head: {sha: .headRefOid},
        mergeable: (if .mergeable == "MERGEABLE" then true elif .mergeable == "CONFLICTING" then false else null end)}' prs.json) ;;
    *) body='[]' ;;
  esac
  printf 'HTTP/2.0 200 OK\\nEtag: "x"\\n\\n%s\\n' "$body"; exit 0
fi
sub="$1 $2"; shift 2; q=.
while [ $# -gt 0 ]; do case $1 in --jq) q=$2; shift;; esac; shift; done
[ "$sub" = "pr checks" ] && { echo '[{"name":"test","bucket":"fail","link":"https://ci/1"}]' | jq -r "$q"; exit 0; }
echo '[]' | jq -r "$q"
`, { mode: 0o755 });
  writeFileSync(join(bin, "systemd-run"), `#!/usr/bin/env bash
for a; do case $a in --unit=*) echo "\${a#--unit=}.service" >>"${units}";; esac; done
`, { mode: 0o755 });
  writeFileSync(join(bin, "systemctl"), `#!/usr/bin/env bash
case "$*" in
  *list-units*) cat "${units}";;
  *is-active*) grep -qxF "\${!#}" "${units}";;
esac
`, { mode: 0o755 });
  writeFileSync(join(bin, "git"), `#!/usr/bin/env bash
d=$PWD; [ "$1" = -C ] && { d=$2; shift 2; }
case "$*" in
  "remote get-url origin") [ -e "$d/origin" ] && { cat "$d/origin"; exit 0; }; echo "git@github.com:Catalyst-Shift/\${d##*/}.git";;
  "ls-remote --heads origin") [ -e "$d/no-remote" ] && exit 128; cat "$d/tips";;
  "rev-parse refs/factory/pr/"*) n=\${!#}; n=\${n##*/}; printf "$((n % 10))%.0s" $(seq 40); echo;;
  *"worktree add"*) mkdir -p "\${@: -2:1}";;
esac
exit 0
`, { mode: 0o755 });
  writeFileSync(join(bin, "claude"), "#!/bin/sh\necho NONE\n", { mode: 0o755 });
  const conf = join(home, ".config/claude-factory/repos.conf");
  const setConf = (extra = "") => writeFileSync(conf, `label kevin-omarchy\n${extra}${repoA} proj\n${repoB} proj\n`);
  setConf();
  writeFileSync(join(state, "launched"), `${repoA} b/cat-7-x cat-7\n`);
  const tick = (extra = {}) => {
    const r = spawnSync("bash", [DISPATCH], {
      encoding: "utf8",
      env: { HOME: home, PATH: `${bin}:/usr/bin:/bin`, TZ: "UTC", CLAUDE_FACTORY_NO_KICK: "1", CLAUDE_BIN: join(bin, "claude"),
        CLAUDE_FACTORY_CAP: "5", CLAUDE_FACTORY_WAITING_CAP: "99", FACTORY_INGEST_TOKEN: "tok-secret", CLAUDE_FACTORY_NODE: "/nonexistent",
        CLAUDE_FACTORY_CONTROL_URL: "http://board.test/api/machines", CLAUDE_FACTORY_STAGES_URL: "http://board.test/api/factory/stages",
        CLAUDE_FACTORY_PRS_URL: PRS_URL, ...extra },
    });
    assert.equal(r.status, 0, r.stderr);
    return r;
  };
  const lines = (f) => read(f).split("\n").filter(Boolean);
  const ghCalls = () => lines(calls);
  const boardCalls = () => lines(curls).filter((l) => l.includes("/api/factory/prs"));
  // Every GitHub read of open PRs: the REST list and per-PR reads, and gh's GraphQL PR commands.
  const prReads = () => ghCalls().filter((l) => /^api -i .*pulls|^pr (list|view)/.test(l));
  const lists = () => ghCalls().filter((l) => l.startsWith("api -i") && l.endsWith(LIST));
  const started = () => lines(units);
  const clear = () => { writeFileSync(calls, ""); writeFileSync(curls, ""); writeFileSync(units, ""); };
  const setBoard = (mode) => writeFileSync(board, mode);
  const done = () => rmSync(t, { recursive: true, force: true });
  return { t, state, repoA, repoB, pr, setA, tips, setConf, setBoard, tick, ghCalls, boardCalls, prReads, lists, started, clear, done };
}

test("a fresh board answer drives every sweep, once per repo, with no gh pr list and no GitHub PR read", () => {
  const m = machine("fresh");
  try {
    const r = m.tick();
    // One board read per repo, by GitHub repo name, with the token on curl's stdin (never in argv).
    assert.deepEqual(m.boardCalls(), [`GET ${PRS_URL}?repo=Repo_A`, `GET ${PRS_URL}?repo=Repo_B`]);
    assert.ok(!read(join(m.t, "curls")).includes("no token"));
    // No GitHub list, no per-PR mergeability read, no gh pr list or gh pr view at all.
    assert.deepEqual(m.prReads(), [], m.ghCalls().join("\n"));
    assert.deepEqual(m.ghCalls().filter((l) => l.startsWith("pr list")), []);
    assert.doesNotMatch(r.stdout, /come from GitHub/);
    // conflicts read Repo B's answer, ci_fixes and pr_reviews Repo A's.
    assert.match(r.stdout, /1 PR \(#2\) in .*Repo_B: mergeability not computed yet/);
    assert.match(r.stdout, /PR #7 in .*Repo_A fails CI \(test\); labelled needs-ci-call, so it waits for a person/);
    assert.ok(m.started().includes("factory-review-repo-a-pr-1.service"), m.started().join("\n"));
    // #2 and #7 are stamped at their heads on the board: no reviewer for either.
    assert.ok(!m.started().some((u) => /pr-2|cat-7/.test(u)), m.started().join("\n"));
    // The sweeps' list is in gh pr list's field names, with the board's stamp read and a PR link.
    const a = JSON.parse(read(join(m.state, "open-prs", "repo-a.json")));
    assert.deepEqual(a.map((p) => [p.number, p.reviewedAtHead, p.isCrossRepository, p.mergeable, p.url]), [
      [1, false, false, "MERGEABLE", "https://github.com/Catalyst-Shift/Repo_A/pull/1"],
      [7, true, false, "MERGEABLE", "https://github.com/Catalyst-Shift/Repo_A/pull/7"],
    ]);
  } finally { m.done(); }
});

test("a stale board answer reads GitHub's one shared list for that repo, with one line, and only for that repo", () => {
  const m = machine("stale");
  try {
    m.setBoard("stale");
    let r = m.tick();
    // Exactly one GitHub list read per repo, and still no GraphQL list.
    assert.equal(m.lists().length, 2, m.ghCalls().join("\n"));
    assert.deepEqual(m.ghCalls().filter((l) => l.startsWith("pr list")), []);
    const said = r.stdout.split("\n").filter((l) => /come from GitHub/.test(l));
    assert.equal(said.length, 2, r.stdout);
    assert.match(said[0], /^open PRs in .*Repo_A come from GitHub this tick: the board says its list is stale$/);
    // The fallback list still drives the sweeps.
    assert.match(r.stdout, /PR #7 in .*Repo_A fails CI \(test\); labelled needs-ci-call/);
    assert.match(r.stdout, /1 PR \(#2\) in .*Repo_B: mergeability not computed yet/);
    // Fresh again: no GitHub list.
    m.setBoard("fresh");
    m.clear();
    r = m.tick();
    assert.equal(m.lists().length, 0, m.ghCalls().join("\n"));
    assert.doesNotMatch(r.stdout, /come from GitHub/);
  } finally { m.done(); }
});

test("a board that can't be reached is asked once a tick; a 503 falls back per repo, naming why", () => {
  const m = machine("down");
  try {
    m.setBoard("down");
    let r = m.tick();
    assert.equal(m.lists().length, 2);
    // Each call can wait 20 seconds: after the first gets no answer, the rest of the tick reads GitHub.
    assert.equal(m.boardCalls().length, 1, m.boardCalls().join("\n"));
    assert.deepEqual(r.stdout.split("\n").filter((l) => /come from GitHub/.test(l)),
      [`open PRs in ${m.repoA} and the repos after it come from GitHub this tick: the board answered 000`]);
    m.setBoard("503");
    m.clear();
    r = m.tick();
    assert.equal(m.lists().length, 2);
    assert.match(r.stdout, /^open PRs in .*Repo_B come from GitHub this tick: the board answered 503 read_failed$/m);
  } finally { m.done(); }
});

test("no token, or 'prs github' in repos.conf, is one line for the tick and the board is never asked", () => {
  const m = machine("notoken");
  try {
    let r = m.tick({ FACTORY_INGEST_TOKEN: "" });
    assert.deepEqual(m.boardCalls(), []);
    assert.equal(m.lists().length, 2);
    assert.deepEqual(r.stdout.split("\n").filter((l) => /come from GitHub/.test(l)),
      ["open PRs come from GitHub this tick: no machine token for the board"]);
    m.setConf("prs github\n");
    m.clear();
    r = m.tick();
    assert.deepEqual(m.boardCalls(), []);
    assert.equal(m.lists().length, 2);
    assert.deepEqual(r.stdout.split("\n").filter((l) => /come from GitHub/.test(l)),
      ["open PRs come from GitHub this tick: 'prs github' in repos.conf"]);
    // The prs line is a setting, not a repo folder: no sweep names a repo called prs.
    assert.doesNotMatch(r.stdout, /in prs[ ;:]/);
  } finally { m.done(); }
});

test("a board answer that trails origin's branches is set aside for GitHub's list", () => {
  const m = machine("behind");
  try {
    // PR #1's branch moved on origin; the board still has the old head.
    m.tips(m.repoA);
    writeFileSync(join(m.repoA, "tips"), read(join(m.repoA, "tips")).replace(`${sha("1")}\trefs/heads/b/1`, `${sha("c")}\trefs/heads/b/1`));
    let r = m.tick();
    assert.match(r.stdout, /^open PRs in .*Repo_A come from GitHub this tick: the board is behind origin on #1$/m);
    assert.equal(m.lists().length, 1, "only Repo_A reads GitHub");
    // origin can't be read: the board can't be checked, so GitHub's list is read.
    writeFileSync(join(m.repoB, "no-remote"), "");
    m.clear();
    r = m.tick();
    assert.match(r.stdout, /^open PRs in .*Repo_B come from GitHub this tick: git ls-remote could not read origin's branches/m);
  } finally { m.done(); }
});

test("a PR whose branch isn't on origin counts as a fork, so the conflict and CI sweeps leave it alone", () => {
  const m = machine("fork");
  try {
    m.setA([m.pr(1), m.pr(7, { headRefName: "b/cat-7-x", labels: [{ name: "needs-ci-call" }] })]);
    writeFileSync(join(m.repoA, "tips"), `${sha("1")}\trefs/heads/b/1\n`);
    const r = m.tick();
    const a = JSON.parse(read(join(m.state, "open-prs", "repo-a.json")));
    assert.deepEqual(a.map((p) => [p.number, p.isCrossRepository]), [[1, false], [7, true]]);
    assert.doesNotMatch(r.stdout, /PR #7 in .*Repo_A fails CI/);
  } finally { m.done(); }
});

test("a PR the board shows all-green is not asked for its required checks; a pending one is", () => {
  const m = machine("green");
  try {
    m.setA([m.pr(1), m.pr(7, { headRefName: "b/cat-7-x", body: `Reviewed: ${sha("7")}`, checks: "green" })]);
    m.tips(m.repoA);
    let r = m.tick();
    assert.deepEqual(m.ghCalls().filter((l) => l.startsWith("pr checks 7 --required")), []);
    assert.doesNotMatch(r.stdout, /PR #7 in .*Repo_A fails CI/);
    // Pending is not proof of green (a row the board reconciled has no checks yet): GitHub is asked.
    m.setA([m.pr(1), m.pr(7, { headRefName: "b/cat-7-x", body: `Reviewed: ${sha("7")}`, checks: "pending", labels: [{ name: "needs-ci-call" }] })]);
    m.clear();
    r = m.tick();
    assert.equal(m.ghCalls().filter((l) => l.startsWith("pr checks 7 --required")).length, 1);
    assert.match(r.stdout, /PR #7 in .*Repo_A fails CI \(test\); labelled needs-ci-call/);
  } finally { m.done(); }
});

test("the board is never trusted for a merge decision: the merge rule reads the founder gate from GitHub", () => {
  const s = read(DISPATCH);
  const body = (name) => s.slice(s.indexOf(`\n${name}() {`), s.indexOf("\n}\n", s.indexOf(`\n${name}() {`)));
  for (const f of ["merge_rule", "founder_gate", "founder_gate_at"]) {
    assert.ok(body(f).length > 20, `${f} is in the dispatcher`);
    assert.doesNotMatch(body(f), /open_prs|PRS_URL|control_call/, `${f} reads only GitHub`);
  }
  assert.match(body("founder_gate"), /gh pr view "\$number" --json headRefOid,baseRefName/);
});

test("a board tick leaves no scratch file, and a closed PR's cached GitHub reads are pruned", () => {
  const m = machine("prune");
  try {
    m.setBoard("stale");
    m.tick();
    assert.ok(existsSync(join(m.state, "etag", "repo-a", "pr-1")));
    // #1 closes; the board's answer now drives Repo A and drops #1's cached read.
    m.setA([m.pr(7, { headRefName: "b/cat-7-x", body: `Reviewed: ${sha("7")}`, labels: [{ name: "needs-ci-call" }] })]);
    m.setBoard("fresh");
    m.tick();
    assert.ok(!existsSync(join(m.state, "etag", "repo-a", "pr-1")));
    assert.ok(existsSync(join(m.state, "etag", "repo-a", "pr-7")));
    assert.ok(!existsSync(join(m.state, "open-prs", "repo-a.json.board")));
  } finally { m.done(); }
});

test("an answer the dispatcher can't trust is set aside for GitHub's list, so no opt-out label is lost", () => {
  const m = machine("bad");
  try {
    const bad = {
      "another repo's answer": '.repo = "Other"',
      "a short head sha": '.prs[0].headSha = "abc"',
      "a number that isn't a whole number": ".prs[0].number = 1.5",
      "labels as objects, not names": '.prs[0].labels = [{name: "no-factory-review"}]',
      "an author that isn't a string": '.prs[0].author = {login: "x"}',
      "a ref with a space": '.prs[0].baseRef = "main x"',
      "a check state it doesn't know": '.prs[0].checks.state = "green x"',
      "an updatedAt with a newline": '.prs[0].updatedAt = "a\\nb"',
    };
    for (const [why, filter] of Object.entries(bad)) {
      writeFileSync(join(m.t, "mutate"), `if .repo == "Repo_A" then ${filter} else . end`);
      m.clear();
      const r = m.tick();
      assert.match(r.stdout, /^open PRs in .*Repo_A come from GitHub this tick: the board's answer could not be read$/m, why);
      assert.equal(m.lists().length, 1, `${why}: Repo_A reads GitHub, Repo_B keeps the board`);
    }
  } finally { m.done(); }
});

test("a repo whose origin isn't a Catalyst-Shift GitHub repo never asks the board", () => {
  const m = machine("origin");
  try {
    for (const origin of ["git@gitlab.com:Catalyst-Shift/Repo_A.git", "https://github.com/kkreative/Repo_A.git"]) {
      writeFileSync(join(m.repoA, "origin"), `${origin}\n`);
      m.clear();
      const r = m.tick();
      assert.match(r.stdout, /^open PRs in .*Repo_A come from GitHub this tick: its origin is not a Catalyst-Shift repo on GitHub$/m, origin);
      assert.deepEqual(m.boardCalls(), [`GET ${PRS_URL}?repo=Repo_B`]);
    }
    // The owner's case doesn't matter, as on GitHub.
    writeFileSync(join(m.repoA, "origin"), "https://github.com/catalyst-shift/Repo_A\n");
    m.clear();
    m.tick();
    assert.equal(m.boardCalls().length, 2);
  } finally { m.done(); }
});

test("a PR on a base other than the default branch sends its repo to GitHub, since the board doesn't follow that base's mergeability", () => {
  const m = machine("stacked");
  try {
    m.setA([m.pr(1, { baseRefName: "b/cat-7-x" }), m.pr(7, { headRefName: "b/cat-7-x", body: `Reviewed: ${sha("7")}` })]);
    m.tips(m.repoA);
    const r = m.tick();
    assert.match(r.stdout, /^open PRs in .*Repo_A come from GitHub this tick: #1 target a branch other than main, whose mergeability the board doesn't follow$/m);
    assert.equal(m.lists().length, 1);
  } finally { m.done(); }
});

test("an unknown 'prs' value is said on stderr and the board is still read", () => {
  const m = machine("bogus");
  try {
    m.setConf("prs bogus\n");
    const r = m.tick();
    assert.match(r.stderr, /ignoring 'prs bogus' in .*repos\.conf: it is board or github/);
    assert.equal(m.boardCalls().length, 2);
    assert.equal(m.lists().length, 0);
  } finally { m.done(); }
});
