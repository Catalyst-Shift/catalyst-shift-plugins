// factory/ (CAT-1298): the dispatcher and its installer stay valid bash, carry
// no machine-specific home paths, and keep the two fixes the live dispatcher
// needed: --allowedTools=<list> (the variadic flag otherwise swallows the
// prompt) and claude calls reading stdin from /dev/null inside `while read`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FACTORY = join(ROOT, "factory");
const DISPATCH = join(FACTORY, "bin", "claude-factory-dispatch");
const INSTALL = join(FACTORY, "install.sh");
const SCRIPTS = [DISPATCH, INSTALL];
const read = (f) => readFileSync(f, "utf8");

for (const f of SCRIPTS) {
  test(`${f.slice(ROOT.length + 1)} passes bash -n`, () => {
    const r = spawnSync("bash", ["-n", f], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
  });
}

test("no hardcoded home paths anywhere in factory/", () => {
  const files = [
    ...SCRIPTS,
    join(FACTORY, "repos.conf.example"),
    ...readdirSync(join(FACTORY, "systemd")).map((f) => join(FACTORY, "systemd", f)),
  ];
  for (const f of files) {
    const bad = read(f).match(/\/home\/[A-Za-z0-9._-]+|\/Users\/[A-Za-z0-9._-]+/);
    assert.equal(bad, null, `${f} hardcodes ${bad}`);
  }
});

test("the haiku pick keeps --allowedTools= with the = form, Linear tools only", () => {
  const s = read(DISPATCH);
  assert.match(s, /--allowedTools="\$\{LINEAR\}__/);
  assert.doesNotMatch(s, /--allowedTools\s+["$]/, "space form swallows the prompt");
  assert.match(s, /^LINEAR=mcp__claude_ai_Linear$/m);
});

test("every claude and systemd-run call in the dispatcher reads stdin from /dev/null", () => {
  const s = read(DISPATCH);
  // pick(): the claude -p call ends its prompt with </dev/null
  assert.match(s, /PICK <identifier> <gitBranchName>" <\/dev\/null/);
  // run_unit(): every builder and reviewer start goes through it
  assert.match(s, /"\$CLAUDE" "\$@" <\/dev\/null/);
  // settle(): the haiku call ends its prompt with </dev/null
  assert.match(s, /SETTLED <the status it ends in>" <\/dev\/null/);
});

test("the dispatcher finds claude via CLAUDE_BIN or command -v, and uses the shared state dir", () => {
  const s = read(DISPATCH);
  assert.match(s, /CLAUDE=\$\{CLAUDE_BIN:-\$\(command -v claude\)\}/);
  assert.match(s, /\$HOME\/\.config\/claude-factory\/repos\.conf/);
  assert.match(s, /STATE=\$HOME\/\.local\/state\/claude-factory/);
});

test("the builder is told not to stamp; the reviewer stamps and never merges", () => {
  const s = read(DISPATCH);
  assert.match(s, /Do not write a 'Reviewed:' line/);
  assert.match(s, /Reviewed: <full 40-character head sha/);
  assert.match(s, /Never merge the PR and never turn on auto-merge/);
});

test("install.sh never enables or starts a unit, and never overwrites repos.conf", () => {
  const s = read(INSTALL);
  const run = s.split("\n").filter((l) => !/^(#|echo\b|miss\b|ok\b)/.test(l.trim()) && !/echo "/.test(l));
  for (const l of run) assert.doesNotMatch(l, /systemctl --user (enable|start|restart)|loginctl enable-linger/, l);
  assert.match(s, /if \[ -e "\$CONF" \]/);
});

test("status lists open factory PRs with their stamp state and takes no lock", () => {
  const t = mkdtempSync(join(tmpdir(), "factory-status-"));
  const home = join(t, "home"), bin = join(t, "bin"), state = join(home, ".local/state/claude-factory");
  for (const d of [bin, state, join(home, ".config/claude-factory")]) mkdirSync(d, { recursive: true });
  const a = "a".repeat(40), b = "b".repeat(40);
  // gh stub: applies the dispatcher's own --jq to a fixture PR list (needs jq).
  writeFileSync(join(bin, "gh"), `#!/usr/bin/env bash
while [ $# -gt 0 ]; do case $1 in --head) h=$2; shift;; --jq) q=$2; shift;; esac; shift; done
case $h in
  b/cat-1-x) j='[{"number":1,"url":"u1","headRefOid":"${a}","body":"x\\nReviewed: ${a} — /review"}]';;
  b/cat-2-y) j='[{"number":2,"url":"u2","headRefOid":"${b}","body":"Reviewed: ${a} — /review"}]';;
  *) j='[]';;
esac
printf '%s' "$j" | jq -r "$q"
`, { mode: 0o755 });
  writeFileSync(join(bin, "systemctl"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  writeFileSync(join(home, ".config/claude-factory/repos.conf"), `label kevin-omarchy\n${t} proj\n`);
  writeFileSync(join(state, "launched"), `${t} b/cat-1-x cat-1\n${t} b/cat-2-y cat-2\n${t} b/cat-3-z cat-3\n`);
  const r = spawnSync("bash", [DISPATCH, "status"], {
    encoding: "utf8",
    env: { HOME: home, PATH: `${bin}:/usr/bin:/bin`, CLAUDE_BIN: "/bin/true" },
  });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /cat-1 {2}#1 u1 stamped/);
  assert.match(r.stdout, /cat-2 {2}#2 u2 not stamped/);
  assert.doesNotMatch(r.stdout, /cat-3/);
  assert.match(r.stdout, /Paused: no/);
  assert.deepEqual(readdirSync(state).sort(), ["launched"], "status wrote state");
});

// settle (CAT-1317): a finished builder with no PR and a card still In
// Progress gets moved to Blocked by a haiku call, once per launch. Run one
// tick against a temporary HOME with gh, systemctl and claude stubbed.
test("settle only touches finished builders with no PR, and only records a confirmed result", () => {
  const t = mkdtempSync(join(tmpdir(), "factory-settle-"));
  const home = join(t, "home"), bin = join(t, "bin"), state = join(home, ".local/state/claude-factory");
  for (const d of [bin, state, join(home, ".config/claude-factory")]) mkdirSync(d, { recursive: true });
  // cat-1 builder running, cat-2 reviewer running, cat-3 no PR, cat-4 a merged
  // PR, cat-5 gh fails, cat-6 the haiku call never confirms a status, cat-7
  // was settled on an earlier tick.
  writeFileSync(join(bin, "gh"), `#!/usr/bin/env bash
while [ $# -gt 0 ]; do case $1 in --head) h=$2; shift;; --state) s=$2; shift;; --jq) q=$2; shift;; esac; shift; done
case $h in
  b/cat-5-*) exit 1;;
  b/cat-4-*) [ "$s" = all ] && j='[{"number":4}]' || j='[]';;
  *) j='[]';;
esac
printf '%s' "$j" | jq -r "$q"
`, { mode: 0o755 });
  writeFileSync(join(bin, "systemctl"), `#!/usr/bin/env bash
case "$*" in
  *is-active*factory-cat-1.service*|*is-active*factory-review-cat-2.service*) exit 0;;
  *is-active*) exit 3;;
esac
exit 0
`, { mode: 0o755 });
  const calls = join(t, "claude-calls");
  writeFileSync(join(bin, "claude"), `#!/usr/bin/env bash
[ "$(readlink /proc/$$/fd/0)" = /dev/null ] || echo "stdin was not /dev/null" >>"${calls}"
p=\${!#}
printf '%s\\n' "$p" | head -1 >>"${calls}"
case $p in
  *"issue CAT-6."*) echo "I could not reach Linear.";;
  *"issue CAT-"*) printf 'Moved it.\nSETTLED Blocked\n';;
  *) echo "\${PICK:-NONE}";;
esac
`, { mode: 0o755 });
  writeFileSync(join(bin, "systemd-run"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  writeFileSync(join(home, ".config/claude-factory/repos.conf"), `label kevin-omarchy\n${t} proj\n`);
  writeFileSync(join(state, "launched"), [1, 2, 3, 4, 5, 6, 7].map((n) => `${t} b/cat-${n}-x cat-${n}`).join("\n") + "\n");
  mkdirSync(join(state, "settled"));
  writeFileSync(join(state, "settled", "cat-7"), "earlier\n");
  const tick = (extra = {}) => spawnSync("bash", [DISPATCH], {
    encoding: "utf8",
    env: { HOME: home, PATH: `${bin}:/usr/bin:/bin`, CLAUDE_BIN: join(bin, "claude"), ...extra },
  });

  let r = tick();
  assert.equal(r.status, 0, r.stderr);
  const asked = read(calls);
  assert.doesNotMatch(asked, /stdin was not/);
  for (const n of [3, 6]) assert.match(asked, new RegExp(`Get Linear issue CAT-${n}\\.`));
  for (const n of [1, 2, 4, 5, 7]) assert.doesNotMatch(asked, new RegExp(`issue CAT-${n}\\.`));
  assert.deepEqual(readdirSync(join(state, "settled")).sort(), ["cat-3", "cat-4", "cat-7"]);

  // Paused: no Linear calls at all.
  writeFileSync(calls, "");
  writeFileSync(join(state, "paused"), "");
  r = tick();
  assert.equal(r.status, 0, r.stderr);
  assert.equal(read(calls), "");

  // A card picked up again (Blocked, then back to Ready For Factory) is settled again.
  rmSync(join(state, "paused"));
  r = tick({ PICK: "PICK CAT-3 b/cat-3-x" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /started CAT-3/);
  assert.ok(!existsSync(join(state, "settled", "cat-3")), "relaunch kept the old settled record");
});

// CAT-1318: card keys from any Linear team, read from an identifier or from
// where Linear puts it in a branch name.
test("cardkey reads CAT- and LUM- keys from identifiers and Linear branch names", () => {
  const fn = read(DISPATCH).split("\n").find((l) => l.startsWith("cardkey()"));
  const key = (s) => spawnSync("bash", ["-c", `${fn}\ncardkey "$1"`, "_", s], { encoding: "utf8" }).stdout.trim();
  assert.equal(key("CAT-3"), "cat-3");
  assert.equal(key("LUM-45"), "lum-45");
  assert.equal(key("kevin/cat-1318-two-machines-safe-claim"), "cat-1318");
  assert.equal(key("keith/lum-12-fix-step-2"), "lum-12");
  assert.equal(key("ops-2/cat-9-x"), "cat-9", "a username with -<digits> is not the key");
  assert.equal(key("cat-7-no-user"), "cat-7");
  assert.equal(key("kevin/no-key-here"), "");
});

// CAT-1318: repos.conf can carry label and offset lines; neither is a repo,
// a bad or missing offset never breaks the tick, and a LUM- pick launches.
test("offset and label lines are config, not repos; offset is validated; LUM- picks launch", () => {
  const t = mkdtempSync(join(tmpdir(), "factory-offset-"));
  const home = join(t, "home"), bin = join(t, "bin"), state = join(home, ".local/state/claude-factory");
  for (const d of [bin, state, join(home, ".config/claude-factory")]) mkdirSync(d, { recursive: true });
  const calls = join(t, "calls");
  writeFileSync(join(bin, "gh"), "#!/bin/sh\necho 0\n", { mode: 0o755 });
  writeFileSync(join(bin, "systemctl"), "#!/bin/sh\ncase \"$*\" in *is-active*) exit 3;; esac\nexit 0\n", { mode: 0o755 });
  writeFileSync(join(bin, "systemd-run"), `#!/bin/sh\necho "systemd-run $*" | head -c 200 >>"${calls}"; echo >>"${calls}"\n`, { mode: 0o755 });
  writeFileSync(join(bin, "claude"), `#!/usr/bin/env bash
p=\${!#}
printf 'pick %s\\n' "$(printf '%s' "$p" | grep -o "project '[^']*'")" >>"${calls}"
echo "\${PICK:-NONE}"
`, { mode: 0o755 });
  const conf = join(home, ".config/claude-factory/repos.conf");
  const tick = (offset, extra = {}) => {
    writeFileSync(conf, `label keith-omarchy\n${offset}\n${t} proj\n`);
    writeFileSync(calls, "");
    return spawnSync("bash", [DISPATCH], {
      encoding: "utf8",
      env: { HOME: home, PATH: `${bin}:/usr/bin:/bin`, CLAUDE_BIN: join(bin, "claude"), ...extra },
    });
  };
  for (const [offset, warn] of [["", false], ["offset 0", false], ["offset 1", false], ["offset abc", true], ["offset 300", true], ["offset 99999999999999999999", true]]) {
    const r = tick(offset);
    assert.equal(r.status, 0, `${offset}: ${r.stderr}`);
    assert.doesNotMatch(r.stderr, /integer|syntax error/, `${offset}: ${r.stderr}`);
    assert.equal(/ignoring 'offset/.test(r.stderr), warn, `${offset}: ${r.stderr}`);
    // Exactly one pick, for the one repo line: label and offset are not repos.
    assert.equal(read(calls).trim(), "pick project 'proj'", offset);
  }
  const r = tick("offset 0", { PICK: "PICK LUM-45 keith/lum-45-some-title" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /started LUM-45 .*unit factory-lum-45/);
  assert.match(read(calls), /--unit=factory-lum-45 /);
  assert.match(read(join(state, "launched")), /keith\/lum-45-some-title lum-45$/m);
});

test("install.sh skips label, offset and review-authors lines like the dispatcher does", () => {
  const skip = /grep -vE '\^\[\[:space:\]\]\*\(#\|\$\|label\[\[:space:\]\]\|offset\[\[:space:\]\]\|review-authors\[\[:space:\]\]\)'/;
  assert.match(read(INSTALL), skip);
  assert.match(read(DISPATCH), skip);
});

// CAT-1320: every open PR in a configured repo gets a reviewer, not only the
// factory's own. One tick against a temporary HOME; gh applies the
// dispatcher's own --jq to a fixture (needs jq), systemd-run and systemctl
// share a file of running units, git only records what it was asked.
test("pr_reviews reviews any open unstamped PR by a review author, within the cap, once per sha", () => {
  const t = mkdtempSync(join(tmpdir(), "factory-prs-"));
  const home = join(t, "home"), bin = join(t, "bin"), state = join(home, ".local/state/claude-factory");
  const repo = join(t, "My_Repo"), units = join(t, "units"), calls = join(t, "calls");
  for (const d of [bin, state, repo, join(home, ".config/claude-factory")]) mkdirSync(d, { recursive: true });
  const sha = (c) => c.repeat(40);
  const pr = (number, login, extra = {}) => ({
    number, headRefOid: sha(String(number % 10)), headRefName: `b/${number}`, body: "", author: { login },
    isDraft: false, labels: [], ...extra,
  });
  const prs = [
    pr(1, "kkreative"),                                                   // reviewed
    pr(2, "kkreative", { isDraft: true }),                                // draft
    pr(3, "app/dependabot"),                                              // dependabot
    pr(4, "keithcatalyst"),                                               // other author until review-authors lists it
    pr(5, "kkreative", { labels: [{ name: "no-factory-review" }] }),      // opted out
    pr(6, "kkreative", { body: `x\r\nReviewed: ${sha("6")} — /review\r\n` }), // stamped at head
    pr(7, "kkreative", { headRefName: "b/cat-7-x", body: `Reviewed: ${sha("0")} — /review` }), // factory branch
    pr(8, "kkreative", { body: `Reviewed: ${sha("0")} — /review` }),     // stale stamp: reviewed, but over the cap at first
  ];
  const fixture = join(t, "prs.json");
  writeFileSync(fixture, JSON.stringify(prs));
  writeFileSync(join(bin, "gh"), `#!/usr/bin/env bash
[ "$1 $2" = "api user" ] && { [ -n "$NO_USER" ] && exit 1; echo kkreative; exit 0; }
sub="$1 $2"; shift 2; n=; h=; q=.
[ "$sub" = "pr view" ] && { n=$1; shift; }
while [ $# -gt 0 ]; do case $1 in --head) h=$2; shift;; --jq) q=$2; shift;; esac; shift; done
if [ -n "$n" ]; then jq -r ".[] | select(.number == $n) | $q" "${fixture}"
elif [ -n "$h" ]; then jq -r "[.[] | select(.headRefName == \\"$h\\")] | $q" "${fixture}"
else jq -r "$q" "${fixture}"; fi
`, { mode: 0o755 });
  writeFileSync(units, "");
  writeFileSync(join(bin, "systemd-run"), `#!/usr/bin/env bash
for a; do case $a in --unit=*) u=\${a#--unit=}; echo "$u.service" >>"${units}";; esac; done
printf '%s' "\${!#}" >"${units}.$u"
`, { mode: 0o755 });
  writeFileSync(join(bin, "systemctl"), `#!/usr/bin/env bash
case "$*" in
  *list-units*) cat "${units}";;
  *is-active*) grep -qxF "\${!#}" "${units}";;
esac
`, { mode: 0o755 });
  writeFileSync(join(bin, "git"), `#!/usr/bin/env bash
echo "git $*" >>"${calls}"
case "$*" in
  *pull/11/head*) exit 1;;
  # The fixture's head for PR n is its last digit 40 times; PR 12 moved since the list.
  *"rev-parse refs/factory/pr/"*) n=\${!#}; n=\${n##*/}; [ "$n" = 12 ] && { echo moved; exit 0; }; printf "$((n % 10))%.0s" $(seq 40); echo;;
  *"worktree add"*) mkdir -p "\${@: -2:1}";;
  *"worktree remove"*) rm -rf "\${!#}";;
esac
exit 0
`, { mode: 0o755 });
  writeFileSync(join(bin, "claude"), "#!/bin/sh\necho NONE\n", { mode: 0o755 });
  const conf = join(home, ".config/claude-factory/repos.conf");
  writeFileSync(conf, `label kevin-omarchy\n${repo} proj\n`);
  writeFileSync(join(state, "launched"), `${repo} b/cat-7-x cat-7\n`);
  const tick = (cap, extra = {}) => spawnSync("bash", [DISPATCH], {
    encoding: "utf8",
    env: { HOME: home, PATH: `${bin}:/usr/bin:/bin`, CLAUDE_BIN: join(bin, "claude"), CLAUDE_FACTORY_CAP: String(cap), ...extra },
  });
  const started = () => read(units).trim().split("\n").filter(Boolean).map((u) => u.replace(/\.service$/, ""));
  const reviewed = () => readdirSync(join(state, "reviewed", "my-repo")).sort();

  // Cap 2: the factory card's reviewer (cat-7) takes one slot, PR #1 the other.
  let r = tick(2);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(started(), ["factory-review-cat-7", "factory-review-my-repo-pr-1"]);
  assert.deepEqual(reviewed(), [`1-${sha("1")}`]);
  assert.match(read(calls), /fetch --quiet origin \+refs\/pull\/1\/head:refs\/factory\/pr\/1/);
  assert.ok(existsSync(join(repo, ".claude/worktrees/factory-review-my-repo-pr-1")));
  assert.match(r.stdout, /started review of PR #1 by kkreative/);

  // Both still running: the cap holds, nothing new starts.
  r = tick(2);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(started().length, 2);

  // Both finished: their worktrees go (with the fetched ref), PR #8 starts,
  // PR #1 is not retried at the same sha.
  writeFileSync(units, "");
  writeFileSync(calls, "");
  r = tick(2);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(started(), ["factory-review-my-repo-pr-8"]);
  assert.match(read(calls), /update-ref -d refs\/factory\/pr\/1/);
  assert.deepEqual(reviewed(), [`1-${sha("1")}`, `8-${sha("8")}`]);

  // review-authors replaces the gh login: keithcatalyst's PR #4 now counts.
  writeFileSync(units, "");
  writeFileSync(conf, `label kevin-omarchy\nreview-authors kkreative keithcatalyst\n${repo} proj\n`);
  r = tick(2);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(started(), ["factory-review-my-repo-pr-4"]);
  // Never: the draft, dependabot, the opted-out PR, the stamped one, the factory branch.
  assert.deepEqual(reviewed(), [`1-${sha("1")}`, `4-${sha("4")}`, `8-${sha("8")}`]);
  assert.match(read(`${units}.factory-review-my-repo-pr-4`), /git push origin 'HEAD:b\/4'/);

  // A fork PR (login in another case) is reviewed but told to push nothing; a
  // branch name that isn't plain is skipped; a failed checkout leaves no marker
  // and no fetched ref, so the next tick tries again.
  writeFileSync(fixture, JSON.stringify([
    pr(9, "KKreative", { isCrossRepository: true }),
    pr(10, "kkreative", { headRefName: "b/x;y" }),
    pr(11, "kkreative"),
    pr(12, "kkreative"),                 // pushed again between the list and the fetch
  ]));
  writeFileSync(units, "");
  writeFileSync(calls, "");
  writeFileSync(conf, `label kevin-omarchy\n${repo} proj\n`);
  r = tick(5);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(started(), ["factory-review-my-repo-pr-9"]);
  const forkPrompt = read(`${units}.factory-review-my-repo-pr-9`);
  assert.match(forkPrompt, /from a fork: push nothing/);
  assert.doesNotMatch(forkPrompt, /git push/);
  assert.match(r.stdout, /PR #10 .*branch name 'b\/x;y' is not plain/);
  assert.match(r.stdout, /PR #11 .*could not check out/);
  assert.match(read(calls), /update-ref -d refs\/factory\/pr\/11/);
  assert.ok(!existsSync(join(state, "reviewed/my-repo", `11-${sha("1")}`)), "failed checkout left a marker");
  assert.match(r.stdout, /PR #12 .*could not check out/);
  assert.ok(!existsSync(join(state, "reviewed/my-repo", `12-${sha("2")}`)), "moved head left a marker");

  // gh can't say who it runs as and no review-authors line: nothing is reviewed.
  writeFileSync(units, "");
  rmSync(join(state, "reviewed/my-repo"), { recursive: true });
  r = tick(5, { NO_USER: "1" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /no review authors/);
  assert.deepEqual(started(), []);
});

test("the reviewer of another PR pushes at most a one-line fix, never merges, and stamps the checked head", () => {
  const s = read(DISPATCH);
  const body = s.slice(s.indexOf("review_pr() {"), s.indexOf("pr_reviews() {"));
  assert.match(body, /only when the fix is one line/);
  assert.match(body, /Push nothing else/);
  assert.match(body, /Never merge the PR and never turn on auto-merge/);
  assert.match(body, /still equals the commit you reviewed/);
  assert.match(body, /leave the body unstamped and post one PR comment/);
});

// CAT-1320: a reviewer worktree detached at a fork's PR head is reachable only
// from refs/factory/pr/<n>. Real git: cleanup removes it once it's finished,
// drops that ref, and a prune of origin can't strand it.
test("cleanup removes a finished PR reviewer worktree held only by refs/factory/pr/<n>", () => {
  const t = mkdtempSync(join(tmpdir(), "factory-cleanup-"));
  const bin = join(t, "bin"), repo = join(t, "repo");
  mkdirSync(bin);
  writeFileSync(join(bin, "systemctl"), "#!/bin/sh\nexit 3\n", { mode: 0o755 });
  const sh = (cmd) => {
    const r = spawnSync("bash", ["-c", cmd], {
      encoding: "utf8",
      env: { PATH: `${bin}:/usr/bin:/bin`, HOME: t, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" },
    });
    assert.equal(r.status, 0, `${cmd}\n${r.stderr}`);
    return r.stdout;
  };
  sh(`git init -q --bare ${t}/origin.git && git clone -q ${t}/origin.git ${repo} 2>/dev/null
cd ${repo} && git commit -q --allow-empty -m base && git push -q origin HEAD:main
git checkout -q --detach && git commit -q --allow-empty -m fork-head
git update-ref refs/factory/pr/5 HEAD && git checkout -q main
git worktree add -q --detach .claude/worktrees/factory-review-repo-pr-5 refs/factory/pr/5
git fetch -q --prune origin`);
  const s = read(DISPATCH);
  const fn = (name) => s.slice(s.indexOf(`${name}() {`), s.indexOf("\n}\n", s.indexOf(`${name}() {`)) + 3);
  const out = sh(`${s.split("\n").find((l) => l.startsWith("active()"))}\n${fn("cleanup")}\ncleanup ${repo}`);
  assert.match(out, /removed finished worktree .*factory-review-repo-pr-5/);
  assert.equal(sh(`git -C ${repo} for-each-ref refs/factory`), "");
});

// CAT-1323: `claude -w` locks its worktree and the lock outlives the session.
// cleanup unlocks a finished builder's clean worktree and removes it once the
// pid in the lock is gone. It leaves one whose unit is still active, one whose
// lock pid is still alive (a session started by hand under a factory-* name),
// and one locked by hand with no pid, and never fails the tick (set -e).
test("cleanup unlocks and removes a finished builder worktree left locked by claude -w", () => {
  const t = mkdtempSync(join(tmpdir(), "factory-locked-"));
  const bin = join(t, "bin"), repo = join(t, "repo");
  mkdirSync(bin);
  writeFileSync(join(bin, "systemctl"), `#!/usr/bin/env bash
case "$*" in *is-active*factory-cat-2.service*) exit 0;; esac
exit 3
`, { mode: 0o755 });
  const sh = (cmd) => {
    const r = spawnSync("bash", ["-c", cmd], {
      encoding: "utf8",
      env: { PATH: `${bin}:/usr/bin:/bin`, HOME: t, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" },
    });
    assert.equal(r.status, 0, `${cmd}\n${r.stderr}`);
    return r.stdout;
  };
  sh(`git init -q --bare ${t}/origin.git && git clone -q ${t}/origin.git ${repo} 2>/dev/null
cd ${repo} && git commit -q --allow-empty -m base && git push -q origin HEAD:main
for n in 1 2 3 4; do git worktree add -q --detach .claude/worktrees/factory-cat-$n origin/main; done
git worktree lock --reason "claude session factory-cat-1 (pid 2147483646)" .claude/worktrees/factory-cat-1
git worktree lock --reason "claude session factory-cat-2 (pid 2147483646)" .claude/worktrees/factory-cat-2
git worktree lock --reason "claude agent factory-cat-3 (pid ${process.pid} start 1)" .claude/worktrees/factory-cat-3
git worktree lock --reason "kept by hand" .claude/worktrees/factory-cat-4`);
  const s = read(DISPATCH);
  const fn = (name) => s.slice(s.indexOf(`${name}() {`), s.indexOf("\n}\n", s.indexOf(`${name}() {`)) + 3);
  const out = sh(`set -euo pipefail\n${s.split("\n").find((l) => l.startsWith("active()"))}\n${fn("cleanup")}\ncleanup ${repo} 2>&1\necho tick-continues`);
  assert.match(out, /removed finished worktree .*factory-cat-1/);
  assert.match(out, /could not remove .*factory-cat-3; leaving it/);
  assert.match(out, /could not remove .*factory-cat-4; leaving it/);
  assert.match(out, /tick-continues/);
  assert.ok(!existsSync(join(repo, ".claude/worktrees/factory-cat-1")));
  assert.ok(existsSync(join(repo, ".claude/worktrees/factory-cat-2")), "removed a worktree whose unit is still active");
  assert.ok(existsSync(join(repo, ".claude/worktrees/factory-cat-3")), "unlocked a worktree whose lock pid is alive");
  assert.ok(existsSync(join(repo, ".claude/worktrees/factory-cat-4")), "unlocked a worktree locked by hand");
});
