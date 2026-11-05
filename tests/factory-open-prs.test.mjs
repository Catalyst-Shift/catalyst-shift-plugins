// CAT-1540: the GraphQL quota (5,000 points an hour, per user) ran out once the
// tick went to 2 minutes, because conflicts, ci_fixes and pr_reviews each
// listed every repo's open PRs. Now one tick lists each repo once, with
// --limit 100 and only the fields the sweeps read, and a spent quota is one
// line naming the reset time.
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
const FIELDS = "number,headRefOid,headRefName,baseRefName,mergeable,isDraft,author,labels,isCrossRepository,body";

// A temporary HOME with two repos in repos.conf. gh logs every call and applies
// the dispatcher's --jq to the repo's fixture (needs jq); systemd-run and
// systemctl share a file of running units; git and claude do nothing.
function machine(name, ghPrList) {
  const t = mkdtempSync(join(tmpdir(), `factory-${name}-`));
  const home = join(t, "home"), bin = join(t, "bin"), state = join(home, ".local/state/claude-factory");
  const units = join(t, "units"), calls = join(t, "calls");
  const repoA = join(t, "Repo_A"), repoB = join(t, "Repo_B");
  for (const d of [bin, state, repoA, repoB, join(home, ".config/claude-factory")]) mkdirSync(d, { recursive: true });
  const pr = (number, extra = {}) => ({
    number, headRefOid: sha(String(number % 10)), headRefName: `b/${number}`, baseRefName: "main", body: "",
    author: { login: "kkreative" }, isDraft: false, labels: [], mergeable: "MERGEABLE", isCrossRepository: false, ...extra,
  });
  // Repo A: PR #1 wants a review; PR #7 is this machine's card branch, red CI, labelled needs-ci-call.
  writeFileSync(join(repoA, "prs.json"), JSON.stringify([
    pr(1),
    pr(7, { headRefName: "b/cat-7-x", body: `Reviewed: ${sha("7")} — /review`, labels: [{ name: "needs-ci-call" }] }),
  ]));
  // Repo B: PR #2's mergeability isn't computed yet.
  writeFileSync(join(repoB, "prs.json"), JSON.stringify([pr(2, { mergeable: "UNKNOWN", body: `Reviewed: ${sha("2")} — /review` })]));
  writeFileSync(join(bin, "gh"), `#!/usr/bin/env bash
echo "$*" >>"${calls}"
[ "$1 $2" = "api user" ] && { echo kkreative; exit 0; }
[ "$1 $2" = "api rate_limit" ] && { [ -e "${t}/no-rate-limit" ] && exit 1; echo 1700000000; exit 0; }
sub="$1 $2"; shift 2; n=; h=; q=.
case $sub in "pr view"|"pr checks") n=$1; shift;; esac
while [ $# -gt 0 ]; do case $1 in --head) h=$2; shift;; --jq) q=$2; shift;; esac; shift; done
[ "$sub" = "pr checks" ] && { echo '[{"name":"test","bucket":"fail","link":"https://ci/1"}]' | jq -r "$q"; exit 0; }
[ "$sub" = "pr list" ] && [ -z "$h" ] && { ${ghPrList} }
if [ -n "$n" ]; then jq -r ".[] | select(.number == $n) | $q" prs.json
elif [ -n "$h" ]; then jq -r "[.[] | select(.headRefName == \\"$h\\")] | $q" prs.json
else jq -r "$q" prs.json; fi
`, { mode: 0o755 });
  writeFileSync(units, "");
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
  const lists = () => read(calls).split("\n").filter((l) => l.startsWith("pr list --state open"));
  const started = () => read(units).trim().split("\n").filter(Boolean);
  return { t, tick, lists, started, state, repoA, repoB, pr, calls: calls_ };
}

test("a tick over two repos calls gh pr list --state open exactly twice, and all three sweeps read it", () => {
  const m = machine("open-prs", ":;");
  const r = m.tick();
  assert.equal(r.status, 0, r.stderr);
  const lists = m.lists();
  assert.equal(lists.length, 2, lists.join("\n"));
  // Only the fields the sweeps read, at most 100 PRs.
  for (const l of lists) assert.equal(l, `pr list --state open --limit 100 --json ${FIELDS} --jq .`);
  // conflicts read Repo B's list, ci_fixes and pr_reviews Repo A's.
  assert.match(r.stdout, /1 PR \(#2\) in .*Repo_B: mergeability not computed yet/);
  assert.match(r.stdout, /PR #7 in .*Repo_A fails CI \(test\); labelled needs-ci-call, so it waits for a person/);
  assert.ok(m.started().includes("factory-review-repo-a-pr-1.service"), m.started().join("\n"));
  assert.doesNotMatch(r.stdout, /gh pr list failed|could not read the open PRs/);
  // The reviews sweep and the waiting count read the same list: no open-PR call per launched branch.
  assert.deepEqual(m.calls().filter((l) => /^pr list --head .*--state open/.test(l)), []);
});

test("the waiting count reads launched branches' open PRs from the shared list, and a repo it lacks is asked per branch", () => {
  const m = machine("waiting", `[[ $PWD == *Repo_A ]] && [ -e fail ] && { echo "HTTP 502" >&2; exit 1; };`);
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

test("merges, retros and touches share one lookup per launched branch per tick, and an OLD one is not asked again for a day", () => {
  const m = machine("factory-pr", ":;");
  const fixture = join(m.repoA, "prs.json");
  const write7 = (extra) => writeFileSync(fixture, JSON.stringify([m.pr(1), m.pr(7, { headRefName: "b/cat-7-x", labels: [{ name: "needs-ci-call" }], ...extra })]));
  const lookups = () => m.calls().filter((l) => l.startsWith("pr list --head b/cat-7-x --state all --limit 1 ")).length;
  // Open: asked once a tick, though three sweeps read it.
  write7({ state: "OPEN" });
  let r = m.tick();
  assert.equal(r.status, 0, r.stderr);
  assert.equal(lookups(), 1);
  writeFileSync(join(m.t, "calls"), "");
  r = m.tick();
  assert.equal(lookups(), 1, "an open PR is asked again the next tick");
  // Merged over a week ago: asked once, then not again.
  write7({ state: "MERGED", closedAt: "2026-01-01T00:00:00Z" });
  writeFileSync(join(m.t, "calls"), "");
  r = m.tick();
  assert.equal(lookups(), 1);
  writeFileSync(join(m.t, "calls"), "");
  r = m.tick();
  assert.equal(r.status, 0, r.stderr);
  assert.equal(lookups(), 0, "an OLD PR is not asked again within a day");
});

test("launch() drops a branch's OLD answer, so a relaunched branch's new PR is seen at once", () => {
  assert.match(read(DISPATCH), /echo "\$dir \$branch \$key" >>"\$LAUNCHED"\n  rm -f "\$STATE\/pr-old\/\$\(pr_key "\$dir" "\$branch"\)"/);
});

test("a spent GraphQL quota is one line naming the reset time, and the next repo is not asked", () => {
  const m = machine("quota", `echo "GraphQL: API rate limit already exceeded for user ID 1." >&2; exit 1;`);
  const r = m.tick();
  assert.equal(r.status, 0, r.stderr);
  assert.equal(m.lists().length, 1);
  const lines = r.stdout.split("\n").filter((l) => /quota|gh pr list failed|could not read the open PRs|no conflict|no CI|no reviews/.test(l));
  assert.deepEqual(lines, ["GitHub GraphQL quota spent (resets at 2023-11-14T22:13:20+00:00); no conflict, CI or review sessions this tick"]);
  assert.deepEqual(m.started(), []);
  // The waiting count can't be read, so pickups hold, and it doesn't ask per branch on a spent quota.
  assert.match(r.stdout, /^GitHub is rate limiting, so the PRs waiting on review can't be counted; no new pickups$/m);
  assert.deepEqual(m.calls().filter((l) => /^pr list --head .*--state open/.test(l)), []);
  assert.match(read(join(m.state, "pass.json")), /"lastPassResult":"holding: GitHub rate limited"/);
  // REST can't say either: the line still comes, with the reset unknown.
  writeFileSync(join(m.t, "no-rate-limit"), "");
  const again = m.tick();
  assert.match(again.stdout, /^GitHub GraphQL quota spent \(resets at unknown\); no conflict, CI or review sessions this tick$/m);
});

test("any other list failure is one line per repo, and that repo gets no sweep, not even from the last tick's list", () => {
  const m = machine("listfail", `[ -e fail ] && { echo "HTTP 502" >&2; exit 1; };`);
  // A good tick first, so a list from it is on disk.
  let r = m.tick();
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(join(m.state, "open-prs", "repo-a.json")));
  assert.match(r.stdout, /PR #7 in .*Repo_A fails CI/);
  writeFileSync(join(m.repoA, "fail"), "");
  writeFileSync(join(m.t, "units"), "");
  writeFileSync(join(m.t, "calls"), "");
  r = m.tick();
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!existsSync(join(m.state, "open-prs", "repo-a.json")), "the last tick's list for Repo_A is gone");
  assert.doesNotMatch(r.stdout, /PR #7 in .*Repo_A/);
  assert.equal(m.lists().length, 2);
  const failed = r.stdout.split("\n").filter((l) => /gh pr list failed|could not read the open PRs/.test(l));
  assert.equal(failed.length, 1, r.stdout);
  assert.match(failed[0], /^gh pr list failed in .*Repo_A; no conflict, CI or review sessions there this tick: HTTP 502$/);
  assert.deepEqual(m.started(), []);
  assert.match(r.stdout, /1 PR \(#2\) in .*Repo_B: mergeability not computed yet/);
});

test("a secondary rate limit is one line with no hourly reset time", () => {
  const m = machine("secondary", `echo "You have exceeded a secondary rate limit. Please wait a few minutes." >&2; exit 1;`);
  const r = m.tick();
  assert.equal(r.status, 0, r.stderr);
  assert.equal(m.lists().length, 1);
  const lines = r.stdout.split("\n").filter((l) => /rate limit|quota|gh pr list failed/.test(l));
  assert.deepEqual(lines, [
    "GitHub secondary rate limit hit; no conflict, CI or review sessions this tick",
    "GitHub is rate limiting, so the PRs waiting on review can't be counted; no new pickups",
  ]);
});

test("a repo with 100 open PRs, the most one list reads, says so", () => {
  const m = machine("hundred", ":;");
  writeFileSync(join(m.repoB, "prs.json"), JSON.stringify(Array.from({ length: 100 }, (_, i) => m.pr(i + 100, { body: "Reviewed: x" }))));
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
