// CAT-1540: the GraphQL quota (5,000 points an hour, per user) ran out once the
// tick went to 2 minutes, because conflicts, ci_fixes and pr_reviews each
// listed every repo's open PRs. Now one tick lists each repo once, and a spent
// quota is one line naming the reset time.
// CAT-1545: that one list is a REST read with an ETag (state/etag/<repo>/list),
// and a 304 reuses the cached body, which GitHub doesn't count against the
// quota. Mergeability (only in one PR's own read) and a PR's required checks
// are read again only when its head, its updated_at or its base tip moved.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DISPATCH = join(ROOT, "factory", "bin", "claude-factory-dispatch");
const read = (f) => readFileSync(f, "utf8");
const sha = (c) => c.repeat(40);
const LIST = "repos/{owner}/{repo}/pulls?state=open&per_page=100";

// A temporary HOME with two repos in repos.conf. gh answers REST reads from
// the repo's fixture (prs.json, in gh pr list's field names; needs jq) with an
// ETag, and a 304 when If-None-Match matches it; it logs every call to calls
// and each REST answer ("<status> <path>") to answers. systemd-run and
// systemctl share a file of running units; git answers ls-remote from the
// repo's tips file; claude does nothing.
function machine(name, ghList) {
  const t = mkdtempSync(join(tmpdir(), `factory-${name}-`));
  const home = join(t, "home"), bin = join(t, "bin"), state = join(home, ".local/state/claude-factory");
  const units = join(t, "units"), calls = join(t, "calls"), answers = join(t, "answers");
  const repoA = join(t, "Repo_A"), repoB = join(t, "Repo_B");
  for (const d of [bin, state, repoA, repoB, join(home, ".config/claude-factory")]) mkdirSync(d, { recursive: true });
  const pr = (number, extra = {}) => ({
    number, headRefOid: sha(String(number % 10)), headRefName: `b/${number}`, baseRefName: "main", body: "",
    author: { login: "kkreative" }, isDraft: false, labels: [], mergeable: "MERGEABLE", isCrossRepository: false,
    updatedAt: "2026-11-05T10:00:00Z", ...extra,
  });
  // Repo A: PR #1 wants a review; PR #7 is this machine's card branch, red CI, labelled needs-ci-call.
  writeFileSync(join(repoA, "prs.json"), JSON.stringify([
    pr(1),
    pr(7, { headRefName: "b/cat-7-x", body: `Reviewed: ${sha("7")} — /review`, labels: [{ name: "needs-ci-call" }] }),
  ]));
  // Repo B: PR #2's mergeability isn't computed yet.
  writeFileSync(join(repoB, "prs.json"), JSON.stringify([pr(2, { mergeable: "UNKNOWN", body: `Reviewed: ${sha("2")} — /review` })]));
  for (const r of [repoA, repoB]) writeFileSync(join(r, "tips"), `${sha("a")}\trefs/heads/main\n`);
  writeFileSync(join(bin, "gh"), `#!/usr/bin/env bash
echo "$*" >>"${calls}"
[ "$1 $2" = "api user" ] && { echo kkreative; exit 0; }
[ "$1 $2" = "api rate_limit" ] && { [ -e "${t}/no-rate-limit" ] && exit 1; echo "$*" | grep -q core || exit 1; echo 1700000000; exit 0; }
if [ "$1 $2" = "api -i" ]; then
  shift 2; inm=
  [ "$1" = -H ] && { inm=\${2#If-None-Match: }; shift 2; }
  path=$1
  case $path in
    "repos/{owner}/{repo}/pulls?state=open&"*)
      ${ghList}
      body=$(jq -c '[.[] | {number, head: {sha: .headRefOid, ref: .headRefName, repo: {full_name: (if .isCrossRepository then "fork/r" else "o/r" end)}},
        base: {ref: .baseRefName, repo: {full_name: "o/r"}}, draft: .isDraft, user: {login: .author.login}, labels, body,
        html_url: "https://github.com/o/r/pull/\\(.number)", updated_at: .updatedAt}]' prs.json) ;;
    "repos/{owner}/{repo}/pulls?head="*)
      b=\${path#*head=\\{owner\\}:}; b=\${b%%&*}; b=$(printf '%b' "\${b//%/\\\\x}")
      body=$(jq -c --arg b "$b" '[.[] | select(.headRefName == $b) | {number, state: "open", head: {sha: .headRefOid}, body, html_url: "https://github.com/o/r/pull/\\(.number)"}]' prs.json) ;;
    "repos/{owner}/{repo}/pulls/"*)
      body=$(jq -c --argjson n "\${path##*/}" '.[] | select(.number == $n) | {number, head: {sha: .headRefOid},
        mergeable: (if .mergeable == "MERGEABLE" then true elif .mergeable == "CONFLICTING" then false else null end)}' prs.json) ;;
  esac
  etag="\\"$(md5sum <<<"$body" | cut -c1-32)\\""
  if [ "$inm" = "$etag" ]; then
    echo "304 $path" >>"${answers}"
    printf 'HTTP/2.0 304 Not Modified\\nEtag: %s\\n\\n' "$etag"; echo "gh: HTTP 304" >&2; exit 1
  fi
  echo "200 $path" >>"${answers}"
  printf 'HTTP/2.0 200 OK\\nEtag: %s\\n\\n%s\\n' "$etag" "$body"; exit 0
fi
sub="$1 $2"; shift 2; n=; h=; q=.
case $sub in "pr view"|"pr checks") n=$1; shift;; esac
while [ $# -gt 0 ]; do case $1 in --head) h=$2; shift;; --jq) q=$2; shift;; esac; shift; done
[ "$sub" = "pr checks" ] && { echo '[{"name":"test","bucket":"fail","link":"https://ci/1"}]' | jq -r "$q"; exit 0; }
if [ -n "$h" ]; then jq -r "[.[] | select(.headRefName == \\"$h\\")] | $q" prs.json
else jq -r "$q" prs.json; fi
`, { mode: 0o755 });
  writeFileSync(units, "");
  writeFileSync(answers, "");
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
case "$*" in
  *"ls-remote --heads origin") cat tips;;
  *"rev-parse refs/factory/pr/"*) n=\${!#}; n=\${n##*/}; printf "$((n % 10))%.0s" $(seq 40); echo;;
  *"worktree add"*) mkdir -p "\${@: -2:1}";;
esac
exit 0
`, { mode: 0o755 });
  writeFileSync(join(bin, "claude"), "#!/bin/sh\necho NONE\n", { mode: 0o755 });
  writeFileSync(join(home, ".config/claude-factory/repos.conf"), `label kevin-omarchy\n${repoA} proj\n${repoB} proj\n`);
  writeFileSync(join(state, "launched"), `${repoA} b/cat-7-x cat-7\n`);
  const tick = (extra = {}) => spawnSync("bash", [DISPATCH], {
    encoding: "utf8",
    env: { HOME: home, PATH: `${bin}:/usr/bin:/bin`, TZ: "UTC", CLAUDE_FACTORY_NO_KICK: "1", CLAUDE_BIN: join(bin, "claude"), CLAUDE_FACTORY_CAP: "5", ...extra },
  });
  const calls_ = () => read(calls).split("\n").filter(Boolean);
  const lists = () => calls_().filter((l) => l.startsWith("api -i") && l.endsWith(LIST));
  const answers_ = () => read(answers).split("\n").filter(Boolean);
  const started = () => read(units).trim().split("\n").filter(Boolean);
  const clear = () => { writeFileSync(calls, ""); writeFileSync(answers, ""); };
  return { t, tick, lists, started, state, repoA, repoB, pr, calls: calls_, answers: answers_, clear };
}

// Every call that reads a PR: the REST reads and gh's GraphQL PR commands.
const prReads = (calls) => calls.filter((l) => /^api -i .*pulls|^pr (list|view|checks)/.test(l));

test("a tick over two repos reads each repo's open PRs once over REST, and all three sweeps read it", () => {
  const m = machine("open-prs", ":;");
  const r = m.tick();
  assert.equal(r.status, 0, r.stderr);
  const lists = m.lists();
  assert.equal(lists.length, 2, lists.join("\n"));
  // A fresh state has no ETag: the first tick does a plain read, and keeps one for the next.
  for (const l of lists) assert.equal(l, `api -i ${LIST}`);
  assert.ok(existsSync(join(m.state, "etag", "repo-a", "list")));
  assert.ok(existsSync(join(m.state, "etag", "repo-b", "list")));
  // No GraphQL open-PR list at all.
  assert.deepEqual(m.calls().filter((l) => l.startsWith("pr list --state open")), []);
  // conflicts read Repo B's list, ci_fixes and pr_reviews Repo A's.
  assert.match(r.stdout, /1 PR \(#2\) in .*Repo_B: mergeability not computed yet/);
  assert.match(r.stdout, /PR #7 in .*Repo_A fails CI \(test\); labelled needs-ci-call, so it waits for a person/);
  assert.ok(m.started().includes("factory-review-repo-a-pr-1.service"), m.started().join("\n"));
  assert.doesNotMatch(r.stdout, /listing open PRs failed|could not read the open PRs/);
  // The reviews sweep, the waiting count, merges and settle read the same list:
  // no PR call per launched branch, and no gh pr view for a body.
  assert.deepEqual(m.calls().filter((l) => /^pr (list|view)/.test(l)), []);
});

test("a second tick with an unchanged list sends If-None-Match, gets a 304, and makes no other PR read", () => {
  const m = machine("etag", ":;");
  // Every PR's mergeability is computed, so nothing is left to ask again.
  writeFileSync(join(m.repoB, "prs.json"), JSON.stringify([m.pr(2, { body: `Reviewed: ${sha("2")} — /review` })]));
  let r = m.tick();
  assert.equal(r.status, 0, r.stderr);
  // The first tick read each non-draft PR's mergeability and #7's required checks once.
  assert.deepEqual(m.answers().filter((a) => /pulls\/\d+$/.test(a)).sort(), [
    "200 repos/{owner}/{repo}/pulls/1", "200 repos/{owner}/{repo}/pulls/2", "200 repos/{owner}/{repo}/pulls/7",
  ]);
  assert.equal(m.calls().filter((l) => l.startsWith("pr checks 7 --required")).length, 1);
  m.clear();
  r = m.tick();
  assert.equal(r.status, 0, r.stderr);
  const lists = m.lists();
  assert.equal(lists.length, 2, lists.join("\n"));
  for (const l of lists) assert.match(l, /^api -i -H If-None-Match: "[0-9a-f]{32}" /);
  assert.deepEqual(m.answers(), [`304 ${LIST}`, `304 ${LIST}`]);
  assert.deepEqual(prReads(m.calls()), lists, "no PR read but the two lists");
  // The cached lists still drive the sweeps.
  assert.match(r.stdout, /PR #7 in .*Repo_A fails CI \(test\); labelled needs-ci-call, so it waits for a person/);
});

test("only a PR whose head, updated_at or base tip moved is read again, and a PR not yet computed is asked every tick", () => {
  const m = machine("detail", ":;");
  let r = m.tick();
  assert.equal(r.status, 0, r.stderr);
  const details = () => m.calls().filter((l) => /pulls\/\d+$/.test(l)).map((l) => l.replace(/.*pulls\//, "#")).sort();
  // #1's head moves; #2 is still UNKNOWN; #7 is unchanged.
  const fixtureA = JSON.parse(read(join(m.repoA, "prs.json")));
  fixtureA[0].headRefOid = sha("b");
  writeFileSync(join(m.repoA, "prs.json"), JSON.stringify(fixtureA));
  m.clear();
  r = m.tick();
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(details(), ["#1", "#2"]);
  // A detail read sends its ETag: #2 didn't change, so it is a 304.
  assert.ok(m.answers().includes("304 repos/{owner}/{repo}/pulls/2"), m.answers().join("\n"));
  // #7's head and updated_at are the same: its required checks are not asked again.
  assert.deepEqual(m.calls().filter((l) => l.startsWith("pr checks")), []);
  // A push to main moves mergeability without touching the PR: every PR on main is read again.
  writeFileSync(join(m.repoA, "tips"), `${sha("c")}\trefs/heads/main\n`);
  m.clear();
  r = m.tick();
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(details(), ["#1", "#2", "#7"]);
  // updated_at moved on #7 (a body edit, a stamp): its checks are asked again.
  const fixtureA2 = JSON.parse(read(join(m.repoA, "prs.json")));
  fixtureA2[1].updatedAt = "2026-11-05T11:00:00Z";
  writeFileSync(join(m.repoA, "prs.json"), JSON.stringify(fixtureA2));
  m.clear();
  r = m.tick();
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(details(), ["#2", "#7"]);
  assert.equal(m.calls().filter((l) => l.startsWith("pr checks 7 --required")).length, 1);
});

test("conflicts read mergeability from each PR's own REST read", () => {
  const m = machine("conflicting", ":;");
  writeFileSync(join(m.repoB, "prs.json"), JSON.stringify([m.pr(2, { mergeable: "CONFLICTING", author: { login: "someone" } })]));
  const r = m.tick();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /PR #2 in .*Repo_B conflicts; its author someone is not one of this machine's review authors/);
});

test("the waiting count reads launched branches' open PRs from the shared list, and a repo it lacks is asked per branch", () => {
  const m = machine("waiting", `[[ $PWD == *Repo_A ]] && [ -e fail ] && { echo "gh: HTTP 502" >&2; exit 1; };`);
  // Repo A's launched branch b/cat-7-x has open PR #7: one waiting, so a cap of 1 holds pickups.
  let r = m.tick({ CLAUDE_FACTORY_WAITING_CAP: "1" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^1 factory PRs waiting on review \(cap 1\); no new pickups$/m);
  // Repo A unlisted: the count falls back to asking for that branch, and still holds.
  writeFileSync(join(m.repoA, "fail"), "");
  r = m.tick({ CLAUDE_FACTORY_WAITING_CAP: "1" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^1 factory PRs waiting on review \(cap 1\); no new pickups$/m);
  assert.ok(m.calls().some((l) => l.startsWith("pr list --head b/cat-7-x --state open")), m.calls().join("\n"));
});

test("merges, retros and touches read an open PR from the list, a closed one over REST with its ETag, and an OLD one is not asked again for a day", () => {
  const m = machine("factory-pr", ":;");
  const lookups = () => m.calls().filter((l) => /pulls\?head=\{owner\}:b%2Fcat-7-x&state=all&per_page=1$/.test(l));
  // Open: answered from the tick's list, no lookup.
  let r = m.tick();
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(lookups(), []);
  // Gone from the open list: asked over REST once a tick (memoised across the sweeps), then with its ETag.
  writeFileSync(join(m.repoA, "prs.json"), JSON.stringify([m.pr(1)]));
  m.clear();
  r = m.tick();
  assert.equal(r.status, 0, r.stderr);
  assert.equal(lookups().length, 1);
  assert.doesNotMatch(lookups()[0], /If-None-Match/);
  m.clear();
  r = m.tick();
  assert.equal(lookups().length, 1);
  assert.match(lookups()[0], /If-None-Match/);
  assert.ok(m.answers().some((a) => a.startsWith("304 repos/{owner}/{repo}/pulls?head=")), m.answers().join("\n"));
});

test("launch() drops a branch's OLD answer, so a relaunched branch's new PR is seen at once", () => {
  assert.match(read(DISPATCH), /echo "\$dir \$branch \$key" >>"\$LAUNCHED"\n  rm -f "\$STATE\/pr-old\/\$\(pr_key "\$dir" "\$branch"\)"/);
});

test("a spent REST quota is one line naming the reset time, and the next repo is not asked", () => {
  const m = machine("quota", `echo "gh: API rate limit exceeded for user ID 1. (HTTP 403)" >&2; exit 1;`);
  const r = m.tick();
  assert.equal(r.status, 0, r.stderr);
  assert.equal(m.lists().length, 1);
  const lines = r.stdout.split("\n").filter((l) => /quota|listing open PRs failed|could not read the open PRs|no conflict|no CI|no reviews/.test(l));
  assert.deepEqual(lines, ["GitHub REST quota spent (resets at 2023-11-14T22:13:20+00:00); no conflict, CI or review sessions this tick"]);
  assert.deepEqual(m.started(), []);
  // The waiting count can't be read, so pickups hold, and it doesn't ask per branch on a spent quota.
  assert.match(r.stdout, /^GitHub is rate limiting, so the PRs waiting on review can't be counted; no new pickups$/m);
  assert.deepEqual(m.calls().filter((l) => /^pr list --head .*--state open/.test(l)), []);
  assert.match(read(join(m.state, "pass.json")), /"lastPassResult":"holding: GitHub rate limited"/);
  // rate_limit can't say either: the line still comes, with the reset unknown.
  writeFileSync(join(m.t, "no-rate-limit"), "");
  const again = m.tick();
  assert.match(again.stdout, /^GitHub REST quota spent \(resets at unknown\); no conflict, CI or review sessions this tick$/m);
});

test("any other list failure is one line per repo, and that repo gets no sweep, not even from the last tick's list", () => {
  const m = machine("listfail", `[ -e fail ] && { echo "gh: HTTP 502" >&2; exit 1; };`);
  // A good tick first, so a list from it is on disk.
  let r = m.tick();
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(join(m.state, "open-prs", "repo-a.json")));
  assert.match(r.stdout, /PR #7 in .*Repo_A fails CI/);
  writeFileSync(join(m.repoA, "fail"), "");
  writeFileSync(join(m.t, "units"), "");
  m.clear();
  r = m.tick();
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!existsSync(join(m.state, "open-prs", "repo-a.json")), "the last tick's list for Repo_A is gone");
  assert.doesNotMatch(r.stdout, /PR #7 in .*Repo_A/);
  assert.equal(m.lists().length, 2);
  const failed = r.stdout.split("\n").filter((l) => /listing open PRs failed|could not read the open PRs/.test(l));
  assert.equal(failed.length, 1, r.stdout);
  assert.match(failed[0], /^listing open PRs failed in .*Repo_A; no conflict, CI or review sessions there this tick: gh: HTTP 502$/);
  assert.deepEqual(m.started(), []);
  assert.match(r.stdout, /1 PR \(#2\) in .*Repo_B: mergeability not computed yet/);
});

test("a secondary rate limit is one line with no hourly reset time", () => {
  const m = machine("secondary", `echo "gh: You have exceeded a secondary rate limit. Please wait a few minutes. (HTTP 403)" >&2; exit 1;`);
  const r = m.tick();
  assert.equal(r.status, 0, r.stderr);
  assert.equal(m.lists().length, 1);
  const lines = r.stdout.split("\n").filter((l) => /rate limit|quota|listing open PRs failed/.test(l));
  assert.deepEqual(lines, [
    "GitHub secondary rate limit hit; no conflict, CI or review sessions this tick",
    "GitHub is rate limiting, so the PRs waiting on review can't be counted; no new pickups",
  ]);
});

test("a repo with 100 open PRs, the most one list reads, says so", () => {
  const m = machine("hundred", ":;");
  writeFileSync(join(m.repoB, "prs.json"), JSON.stringify(Array.from({ length: 100 }, (_, i) => m.pr(i + 100, { body: "Reviewed: x", isDraft: true }))));
  const r = m.tick();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^100 open PRs in .*Repo_B, the most one list reads: PRs past them get no conflict, CI or review session$/m);
  assert.doesNotMatch(r.stdout, /open PRs in .*Repo_A, the most/);
});

test("two repos with the same state name get no list, so neither reads the other's PRs", () => {
  const m = machine("slug", ":;");
  const twin = join(m.t, "twin", "repo-a");
  mkdirSync(twin, { recursive: true });
  writeFileSync(join(twin, "prs.json"), "[]");
  writeFileSync(join(m.t, "home/.config/claude-factory/repos.conf"), `label kevin-omarchy\n${m.repoA} proj\n${twin} proj\n${m.repoB} proj\n`);
  const r = m.tick();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /twin\/repo-a and .*Repo_A share the state name repo-a; no conflict, CI or review sessions in either this tick/);
  assert.ok(!existsSync(join(m.state, "open-prs", "repo-a.json")));
  assert.doesNotMatch(r.stdout, /PR #7 in .*Repo_A/);
  assert.ok(!m.started().includes("factory-review-repo-a-pr-1.service"), m.started().join("\n"));
  assert.match(r.stdout, /1 PR \(#2\) in .*Repo_B: mergeability not computed yet/);
});

test("no GraphQL open-PR list is left in the dispatcher", () => {
  assert.doesNotMatch(read(DISPATCH), /gh pr list --state open/);
});
