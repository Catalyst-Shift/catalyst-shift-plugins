// CAT-1433: every merged factory PR gets a retro. A clean one is a card comment
// and no session; one with friction gets a /reflect session; touches and the
// `retro --since` report read the card comments. gh, systemctl, systemd-run and
// claude are stubs; the repo is a real clone so the worktree is a real one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, existsSync, readdirSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DISPATCH = join(ROOT, "factory", "bin", "claude-factory-dispatch");
const read = (f) => readFileSync(f, "utf8");

function rig() {
  const t = mkdtempSync(join(tmpdir(), "factory-retro-"));
  const home = join(t, "home"), bin = join(t, "bin"), state = join(home, ".local/state/claude-factory");
  const repo = join(t, "My_Repo"), units = join(t, "units"), calls = join(t, "calls");
  for (const d of [bin, state, join(home, ".config/claude-factory")]) mkdirSync(d, { recursive: true });
  const gitEnv = { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };
  const sh = (cmd) => {
    const r = spawnSync("bash", ["-c", cmd], { encoding: "utf8", env: { PATH: "/usr/bin:/bin", HOME: t, ...gitEnv } });
    assert.equal(r.status, 0, `${cmd}\n${r.stderr}`);
    return r.stdout.trim();
  };
  sh(`git init -q --bare ${t}/origin.git && git clone -q ${t}/origin.git ${repo} 2>/dev/null
cd ${repo} && echo base >doc.md && git add doc.md && git commit -q -m base && git push -q origin HEAD:main && git remote set-head origin main`);
  const recent = new Date(Date.now() - 3600e3).toISOString().replace(/\.\d+Z$/, "Z");
  const old = new Date(Date.now() - 30 * 86400e3).toISOString().replace(/\.\d+Z$/, "Z");
  const co = "Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>";
  const commit = (headline, body = co) => ({ messageHeadline: headline, messageBody: body });
  const pr = (number, extra = {}) => ({ number, state: "MERGED", closedAt: recent, url: `https://github.com/o/r/pull/${number}`, headRefOid: String(number % 10).repeat(40), body: "", ...extra });
  const view = (extra = {}) => ({ commits: [commit("[concept] work")], comments: [], reviews: [], labels: [], ...extra });
  const data = {
    prs: {
      "b/cat-1-x": [pr(1)],                                          // clean
      "b/cat-2-x": [pr(2)],                                          // a reviewer fix commit
      "b/cat-3-x": [pr(3)],                                          // a person's commit
      "b/cat-4-x": [pr(4)],                                          // only a deploy bot commented: clean
      "b/cat-5-x": [pr(5)],                                          // reverted later
      "b/cat-6-x": [pr(6, { state: "OPEN", closedAt: null, body: `Reviewed: ${"6".repeat(40)} — /review` })],       // still open
      "b/cat-7-x": [pr(7)],                                          // gh can't read it
      "b/cat-8-x": [pr(8, { closedAt: old })],                       // merged long ago
      "b/cat-9-x": [pr(9)],                                          // a CI-fix and a conflict merge
      "b/cat-10-x": [pr(10)],                                        // a review comment and a person's comment
    },
    views: {
      1: view(),
      6: view({ body: `Reviewed: ${"6".repeat(40)} — /review` }),
      2: view({ commits: [commit("[concept] work"), commit("fix", `a finding\n\nFactory-Review-Fix: PR #2\n${co}`)] }),
      3: view({ commits: [commit("[concept] work"), commit("tweak", "by hand")] }),
      4: view({ comments: [{ author: { login: "vercel" }, body: "deployed" }, { author: { login: "github-actions[bot]" }, body: "x" }] }),
      5: view(),
      9: view({ commits: [commit("[concept] work"), commit("fix ci", `x\n\nFactory-CI-Fix: PR #9\n${co}`), commit("Merge main into b/cat-9-x", "")] }),
      10: view({ reviews: [{ state: "COMMENTED", body: "nit" }], comments: [{ author: { login: "kkreative" }, body: "please" }] }),
    },
    reverts: [{ title: 'Revert "[concept] CAT-5 thing (#5)"', body: "This reverts #5." }, { title: "Add thing (#50)", body: "" }],
  };
  const fixture = join(t, "fixture.json");
  const save = () => writeFileSync(fixture, JSON.stringify(data));
  save();
  writeFileSync(join(bin, "gh"), `#!/usr/bin/env bash
[ "$1 $2" = "api user" ] && { echo kkreative; exit 0; }
sub="$1 $2"; shift 2; n=; h=; s=all; q=.
case $sub in "pr view"|"pr checks") n=$1; shift;; esac
while [ $# -gt 0 ]; do case $1 in --head) h=$2; shift;; --state) s=$2; shift;; --jq) q=$2; shift;; esac; shift; done
case $sub in
  "pr view") [ "$n" = 7 ] && exit 1; jq -r ".views[\\"$n\\"] | $q" "${fixture}";;
  "pr checks") echo '[]' | jq -r "$q";;
  *) if [ -n "$h" ]; then jq -r --arg h "$h" --arg s "$s" "[.prs[\\$h][]? | select(\\$s == \\"all\\" or (.state | ascii_downcase) == \\$s)] | $q" "${fixture}"
     elif [ "$s" = merged ]; then jq -r ".reverts | $q" "${fixture}"
     else echo '[]' | jq -r "$q"; fi;;
esac
`, { mode: 0o755 });
  writeFileSync(join(bin, "systemctl"), `#!/usr/bin/env bash
case "$*" in
  *list-units*) cat "${units}" 2>/dev/null;;
  *is-active*) grep -qxF "\${!#}" "${units}" 2>/dev/null; exit $?;;
  *show-environment*) exit 0;;
esac
exit 0
`, { mode: 0o755 });
  writeFileSync(join(bin, "systemd-run"), `#!/usr/bin/env bash
for a; do case $a in --unit=*) u=\${a#--unit=};; --working-directory=*) w=\${a#--working-directory=};; esac; done
echo "$u.service" >>"${units}"; printf '%s' "\${!#}" >"${units}.$u"; printf '%s' "$w" >"${units}.$u.wd"; printf '%s\\n' "$@" >"${units}.$u.args"
`, { mode: 0o755 });
  writeFileSync(calls, "");
  writeFileSync(join(bin, "claude"), `#!/usr/bin/env bash
[ "$(readlink /proc/$$/fd/0)" = /dev/null ] || echo "stdin was not /dev/null" >>"${calls}"
for a; do case $a in --allowedTools=*) tools=\${a#--allowedTools=};; esac; done
p=\${!#}
id=$(printf '%s' "$p" | grep -oE 'issue [A-Z]+-[0-9]+' | head -1); id=\${id#issue }
case $p in
  *"REPORT done"*) echo "$SECONDS" >/dev/null; cat "${t}/report.txt" || exit 1; echo "REPORT done";;
  *"'retro: clean'"*) echo "clean $id $tools" >>"${calls}"; [ "$id" = "$FAIL" ] && echo "no Linear" || echo "RETRO clean";;
  *"stateHistory"*) echo "touch $id $tools" >>"${calls}"; echo "TOUCH checked";;
  *) echo NONE;;
esac
`, { mode: 0o755 });
  writeFileSync(join(home, ".config/claude-factory/repos.conf"), `label kevin-omarchy\n${repo} proj\n`);
  const launch = (ns) => writeFileSync(join(state, "launched"), ns.map((n) => `${repo} b/cat-${n}-x cat-${n}`).join("\n") + "\n");
  launch([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const run = (args = [], extra = {}) => spawnSync("bash", [...(process.env.XT ? ["-x"] : []), DISPATCH, ...args], {
    encoding: "utf8",
    env: { HOME: home, PATH: `${bin}:/usr/bin:/bin`, CLAUDE_BIN: join(bin, "claude"), CLAUDE_FACTORY_CAP: "20", ...extra },
  });
  const asked = () => { const c = read(calls); writeFileSync(calls, ""); return c.trim().split("\n").filter(Boolean); };
  const unitsStarted = () => (existsSync(units) ? read(units).trim().split("\n").filter(Boolean).sort() : []);
  const record = (k) => (existsSync(join(state, "retro", k)) ? read(join(state, "retro", k)).trim() : null);
  return { sh, t, repo, state, units, data, save, run, asked, unitsStarted, record, report: (s) => writeFileSync(join(t, "report.txt"), s) };
}

test("retros: a clean merged PR gets `retro: clean` and no session; one with friction gets a /reflect session, once", () => {
  const { t: rigdir, repo, state, units, run, asked, unitsStarted, record } = rig();
  const r = run();
  assert.equal(r.status, 0, r.stderr);
  const calls = asked();
  const clean = calls.filter((c) => c.startsWith("clean ")).map((c) => c.split(" ")[1]).sort();
  assert.deepEqual(clean, ["CAT-1", "CAT-4"], "a bot-only comment is still clean");
  assert.match(calls.find((c) => c.startsWith("clean CAT-1")), /__get_issue,.*__list_comments,.*__save_comment$/);
  assert.equal(record("cat-1-1"), "clean");
  assert.equal(record("cat-4-4"), "clean");
  assert.match(r.stdout, /CAT-1: PR #1 merged clean; commented retro: clean/);

  // Sessions for 2, 3, 5, 9 and 10 only: not the open PR (6), the unreadable one (7) or the old one (8).
  assert.deepEqual(unitsStarted(), ["factory-retro-cat-10.service", "factory-retro-cat-2.service", "factory-retro-cat-3.service", "factory-retro-cat-5.service", "factory-retro-cat-9.service"]);
  for (const k of ["cat-2-2", "cat-3-3", "cat-5-5", "cat-9-9", "cat-10-10"]) assert.match(record(k) ?? "", /^20\d\d-/, k);
  for (const k of ["cat-6-6", "cat-7-7", "cat-8-8"]) assert.equal(record(k), null, k);
  assert.match(r.stdout, /started retro for CAT-2 PR #2 \(review fix commits\)/);
  assert.match(r.stdout, /started retro for CAT-3 PR #3 \(human commits\)/);
  assert.match(r.stdout, /started retro for CAT-5 PR #5 \(reverted\)/);
  assert.match(r.stdout, /started retro for CAT-9 PR #9 \(CI-fix commits, conflict merge commits\)/);
  assert.match(r.stdout, /started retro for CAT-10 PR #10 \(review comments, PR comments\)/);
  assert.match(r.stdout, /CAT-7: PR #7 merged, but its retro signals could not be read/);

  // The session runs on the default branch in its own factory- worktree, with the pushes it may not make denied.
  const wd = read(`${units}.factory-retro-cat-2.wd`);
  assert.equal(wd, join(repo, ".claude/worktrees/factory-retro-cat-2"));
  assert.ok(existsSync(wd));
  const args = read(`${units}.factory-retro-cat-2.args`);
  assert.match(args, /--model\nclaude-sonnet-5-5\n/);
  for (const d of ["git push --force*", "git push origin main*", "gh pr merge*", "git rebase*"]) assert.ok(args.includes(`Bash(${d})`), d);
  const prompt = read(`${units}.factory-retro-cat-2`);
  assert.match(prompt, /Card CAT-2 .* https:\/\/github\.com\/o\/r\/pull\/2 merged, but it cost more than one clean pass: review fix commits/);
  assert.match(prompt, /retro: <accepted> accepted, <rejected> rejected/);
  assert.match(prompt, /one open factory-reflect PR/);
  assert.match(prompt, /factory-correct\/cat-2/);
  assert.match(prompt, /never merge a PR, never turn on auto-merge/i);
  assert.match(prompt, /a retro never adds a gate/i);
  assert.match(prompt, /needs a governance PR/);

  // Next tick: nothing repeats; the unreadable PR is tried again.
  const before = unitsStarted();
  const r2 = run();
  assert.equal(r2.status, 0, r2.stderr);
  assert.deepEqual(asked().filter((c) => c.startsWith("clean ")), []);
  assert.deepEqual(unitsStarted(), before);
  assert.match(r2.stdout, /CAT-7: PR #7 merged, but its retro signals could not be read/);
  assert.equal(existsSync(join(state, "retro", "cat-7-7")), false);
});

test("retros: an unconfirmed clean comment is retried; a full cap holds the session back and names why", () => {
  const { run, asked, unitsStarted, record } = rig();
  let r = run([], { FAIL: "CAT-1", CLAUDE_FACTORY_CAP: "0" });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(record("cat-1-1"), null, "an unconfirmed comment was recorded");
  assert.equal(record("cat-4-4"), "clean");
  assert.deepEqual(unitsStarted(), []);
  assert.match(r.stdout, /CAT-2: PR #2 merged with review fix commits; retro waiting for a free slot \(0\/0\)/);
  asked();
  r = run([]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(record("cat-1-1"), "clean");
  assert.deepEqual(asked().filter((c) => c.startsWith("clean ")).map((c) => c.split(" ")[1]), ["CAT-1"]);
  assert.equal(unitsStarted().length, 5);
});

test("a leftover retro worktree is not started over, and a paused factory runs no retro", () => {
  const { sh, repo, state, run, unitsStarted, record } = rig();
  const left = join(repo, ".claude/worktrees/factory-retro-cat-2");
  sh(`git -C ${repo} worktree add -q --detach ${left} origin/main && echo unpushed >${left}/notes.md`);
  let r = run();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /CAT-2: PR #2 merged and needs a retro, but .*factory-retro-cat-2 is left over with unpushed work; not starting one/);
  assert.equal(record("cat-2-2"), null);
  assert.ok(!unitsStarted().includes("factory-retro-cat-2.service"));
  rmSync(join(state, "retro"), { recursive: true });
  writeFileSync(join(state, "paused"), "");
  r = run();
  assert.equal(record("cat-1-1"), null);
});

test("touches: an open-PR card is checked for a pull-back from In Review at most every 15 minutes", () => {
  const { state, run, asked } = rig();
  let r = run();
  assert.equal(r.status, 0, r.stderr);
  const touched = asked().filter((c) => c.startsWith("touch "));
  assert.deepEqual(touched.map((c) => c.split(" ")[1]), ["CAT-6"], "only the card with an open PR");
  assert.match(touched[0], /__get_issue,.*__list_comments,.*__save_comment$/);
  assert.ok(existsSync(join(state, "touch", "cat-6")));
  r = run();
  assert.deepEqual(asked().filter((c) => c.startsWith("touch ")), [], "checked again within 15 minutes");
  const past = new Date(Date.now() - 20 * 60e3);
  utimesSync(join(state, "touch", "cat-6"), past, past);
  r = run();
  assert.deepEqual(asked().filter((c) => c.startsWith("touch ")).map((c) => c.split(" ")[1]), ["CAT-6"]);
  const s = read(DISPATCH);
  assert.match(s, /touch: <who> <reason> \[<ISO time of the move>\]/);
  assert.match(s, /ignore moves to Done, Canceled or Blocked/);
});

test("retro --since: clean, accepted, rejected, structural and touches per repo, counted by the script", () => {
  const { run, report } = rig();
  report([
    "COMMENT CAT-1 retro: clean",
    "COMMENT CAT-2 retro: 2 accepted, 3 rejected | - rejected: a — one-off | structural: 1 sent to /correct",
    "COMMENT CAT-3 retro: 1 accepted, 0 rejected | structural: 0 sent to /correct",
    "COMMENT CAT-4 touch: kevin In Progress [2026-11-04T10:00:00Z]",
    "COMMENT CAT-4 touch: keith Ready For Factory [2026-11-04T11:00:00Z]",
    "some chatter the model added",
  ].join("\n") + "\n");
  let r = run(["retro", "--since", "7d"]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), "My_Repo (last 7d): clean 1, accepted 3, rejected 3, structural 1, touches 2");
  r = run(["retro"]);
  assert.match(r.stdout, /last 7d/);
  r = run(["retro", "--since", "soon"]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /usage: claude-factory-dispatch retro/);
});

test("retro --since says so when Linear can't be read, and counts zero when there are no retro comments", () => {
  const { run, report, t } = rig();
  report("");
  let r = run(["retro", "--since", "30d"]);
  assert.equal(r.stdout.trim(), "My_Repo (last 30d): clean 0, accepted 0, rejected 0, structural 0, touches 0");
  rmSync(join(t, "report.txt"));
  r = run(["retro", "--since", "7d"]);
  assert.match(r.stdout, /My_Repo: could not read the retro comments from Linear/);
});

test("the reviewer prompts ask for the Factory-Review-Fix trailer the retro reads; retro is a model job", () => {
  const s = read(DISPATCH);
  assert.equal(s.split("Factory-Review-Fix: PR #$number").length - 1, 2);
  assert.match(s, /^JOBS="[^"]* retro"$/m);
  assert.match(s, /MODEL_RETRO=\$\(conf_model retro claude-sonnet-5-5\)/);
  assert.ok(readdirSync(join(ROOT, "catalyst-ops", "skills")).includes("reflect"));
  assert.ok(readdirSync(join(ROOT, "catalyst-ops", "skills")).includes("correct"));
});
