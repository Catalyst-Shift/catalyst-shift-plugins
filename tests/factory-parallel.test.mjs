// CAT-1547: each repo's tick work (its sweeps, then its pickup) runs in its own
// background job, at most `parallel <n>` at once (default 4). The running cap
// is checked and a slot taken under one flock in the state folder, so it holds
// across repos; a repo's failing job ends only that repo's work; and every
// line a job prints starts with "[<repo folder name>] ".
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DISPATCH = join(ROOT, "factory", "bin", "claude-factory-dispatch");
const GH_REST = join(ROOT, "tests", "support");
const read = (f) => readFileSync(f, "utf8");

// Two repos (repo-a for proj-a, repo-b for proj-b), each with one Ready card.
// systemd-run and systemctl share a file of running units. The pick logs when
// it starts and ends, and takes PICK_SLEEP seconds, so two picks in flight at
// once overlap in the log.
// A repo's open PRs come from <t>/prs-<repo folder>.json when it has one (gh runs in the
// repo folder); git is stubbed only when a test needs worktrees.
function rig({ git = false } = {}) {
  const t = mkdtempSync(join(tmpdir(), "factory-parallel-"));
  const home = join(t, "home"), bin = join(t, "bin"), state = join(home, ".local/state/claude-factory");
  const units = join(t, "units"), calls = join(t, "calls");
  const repoA = join(t, "repo-a"), repoB = join(t, "repo-b");
  for (const d of [bin, state, repoA, repoB, join(home, ".config/claude-factory")]) mkdirSync(d, { recursive: true });
  writeFileSync(units, "");
  writeFileSync(calls, "");
  writeFileSync(join(bin, "gh"), `#!/usr/bin/env bash
[ "$1 $2" = "api user" ] && { echo kkreative; exit 0; }
f="${t}/prs-$(basename "$PWD").json"
[ -f "$f" ] || { echo '[]'; exit 0; }
sub="$1 $2"; shift 2; n=; h=; q=.
[ "$sub" = "pr view" ] && { n=$1; shift; }
while [ $# -gt 0 ]; do case $1 in --head) h=$2; shift;; --jq) q=$2; shift;; esac; shift; done
case $sub in
  "pr list") if [ -n "$h" ]; then jq -r "[.[] | select(.headRefName == \\"$h\\")] | $q" "$f"; else jq -r "$q" "$f"; fi ;;
  "pr view") jq -r ".[] | select(.number == $n) | $q" "$f" ;;
  *) echo '[]' ;;
esac
`, { mode: 0o755 });
  if (git) {
    writeFileSync(join(bin, "git"), `#!/usr/bin/env bash
case "$*" in
  *"worktree add"*) mkdir -p "\${@: -2:1}";;
esac
exit 0
`, { mode: 0o755 });
  }
  writeFileSync(join(bin, "systemctl"), `#!/usr/bin/env bash
case "$*" in
  *list-units*) cat "${units}" ;;
  *is-active*) grep -qxF "\${!#}" "${units}"; exit $? ;;
esac
exit 0
`, { mode: 0o755 });
  writeFileSync(join(bin, "systemd-run"), `#!/usr/bin/env bash
for a; do case $a in --unit=*) u=\${a#--unit=};; esac; done
[ "$u" = "\${FAIL_UNIT:-}" ] && exit 1
echo "$u.service" >>"${units}"
`, { mode: 0o755 });
  writeFileSync(join(bin, "claude"), `#!/usr/bin/env bash
p=\${!#}
proj=$(printf '%s' "$p" | grep -o "project '[^']*'" | head -1 | cut -d"'" -f2)
echo "pick $proj start $(date +%s%N)" >>"${calls}"
sleep "\${PICK_SLEEP:-0}"
echo "pick $proj end $(date +%s%N)" >>"${calls}"
case $proj in
  proj-a) echo "PICK CAT-1 b/cat-1-x Low" ;;
  proj-b) echo "PICK CAT-2 b/cat-2-x Low" ;;
  *) echo NONE ;;
esac
`, { mode: 0o755 });
  const conf = join(home, ".config/claude-factory/repos.conf");
  const tick = (cap, extraConf = "", env = {}) => {
    writeFileSync(conf, `label kevin-omarchy\n${extraConf}${repoA} proj-a\n${repoB} proj-b\n`);
    return spawnSync("bash", [DISPATCH], {
      encoding: "utf8",
      env: { HOME: home, PATH: `${GH_REST}:${bin}:/usr/bin:/bin`, CLAUDE_FACTORY_NO_KICK: "1", CLAUDE_BIN: join(bin, "claude"), CLAUDE_FACTORY_CAP: String(cap), ...env },
    });
  };
  const started = () => read(units).trim().split("\n").filter(Boolean);
  const picks = () => read(calls).trim().split("\n").filter(Boolean).map((l) => l.split(" "));
  return { t, state, units, calls, repoA, repoB, conf, tick, started, picks };
}

test("CAT-1547: repo jobs read stdin from /dev/null, so no job can eat the rest of the repo list", () => {
  assert.match(read(DISPATCH), /repo_job "job-\$n" "\$dir" "\$project" "\$fn" <\/dev\/null &/);
});

test("CAT-1547: two repo lines for one Linear project pick once, never the same card side by side", () => {
  const r = rig();
  const conf = (extra) => `label kevin-omarchy\n${extra}${r.repoA} proj-a\n${r.repoB} proj-a\n`;
  writeFileSync(r.conf, conf(""));
  const out = spawnSync("bash", [DISPATCH], {
    encoding: "utf8",
    env: { HOME: join(r.t, "home"), PATH: `${GH_REST}:${join(r.t, "bin")}:/usr/bin:/bin`, CLAUDE_FACTORY_NO_KICK: "1", CLAUDE_BIN: join(r.t, "bin", "claude"), CLAUDE_FACTORY_CAP: "4" },
  });
  assert.equal(out.status, 0, out.stderr);
  assert.equal(r.picks().filter(([, , what]) => what === "start").length, 1);
  assert.deepEqual(r.started(), ["factory-cat-1.service"]);
});

test("CAT-1547: two repos each have a factory PR needing a reviewer and the cap is 1: exactly one reviewer starts", () => {
  const r = rig({ git: true });
  const sha = (c) => c.repeat(40);
  const pr = (number, branch, c) => ({
    number, headRefOid: sha(c), headRefName: branch, baseRefName: "main", mergeable: "MERGEABLE", state: "OPEN",
    isDraft: false, author: { login: "someone-else" }, labels: [], isCrossRepository: false, body: "", url: `https://github.com/o/r/pull/${number}`,
  });
  writeFileSync(join(r.t, "prs-repo-a.json"), JSON.stringify([pr(1, "b/cat-1-x", "1")]));
  writeFileSync(join(r.t, "prs-repo-b.json"), JSON.stringify([pr(2, "b/cat-2-x", "2")]));
  writeFileSync(join(r.state, "launched"), `${r.repoA} b/cat-1-x cat-1\n${r.repoB} b/cat-2-x cat-2\n`);
  writeFileSync(join(r.repoA, ".keep-me"), "x");
  const out = r.tick(1);
  assert.equal(out.status, 0, out.stderr);
  assert.ok(existsSync(join(r.repoA, ".keep-me")), "a tick never deletes a file in a repo folder");
  const reviewers = r.started().filter((u) => u.startsWith("factory-review-"));
  assert.equal(reviewers.length, 1, `${out.stdout}\n${out.stderr}`);
  assert.equal(r.started().length, 1, `nothing else starts past the cap: ${r.started()}`);
  assert.ok(!existsSync(join(r.state, "slots")));
  // With room for both, both repos' reviewers start.
  const r2 = rig({ git: true });
  writeFileSync(join(r2.t, "prs-repo-a.json"), JSON.stringify([pr(1, "b/cat-1-x", "1")]));
  writeFileSync(join(r2.t, "prs-repo-b.json"), JSON.stringify([pr(2, "b/cat-2-x", "2")]));
  writeFileSync(join(r2.state, "launched"), `${r2.repoA} b/cat-1-x cat-1\n${r2.repoB} b/cat-2-x cat-2\n`);
  const out2 = r2.tick(2);
  assert.equal(out2.status, 0, out2.stderr);
  assert.deepEqual(r2.started().filter((u) => u.startsWith("factory-review-")).sort(), ["factory-review-cat-1.service", "factory-review-cat-2.service"], out2.stdout);
});

test("CAT-1547: two repos each want a session and the running cap is 1: exactly one starts", () => {
  const r = rig();
  const out = r.tick(1, "", { PICK_SLEEP: "1" });
  assert.equal(out.status, 0, out.stderr);
  assert.equal(r.started().length, 1, `${out.stdout}\n${r.started()}`);
  assert.match(r.started()[0], /^factory-cat-[12]\.service$/);
  // Only one card is claimed: the other repo's pick never ran (it waited for
  // the slot the first repo held, then found the cap full).
  assert.equal(r.picks().filter(([, , what]) => what === "start").length, 1);
  assert.equal(read(join(r.state, "launched")).trim().split("\n").length, 1);
  // No slot is left behind for the next tick.
  assert.ok(!existsSync(join(r.state, "slots")));
  assert.match(read(join(r.state, "pass.json")), /"lastPassResult":"ok: started CAT-[12]"/);
});

test("CAT-1547: with room for both, the two repos' picks run side by side and both start", () => {
  const r = rig();
  const out = r.tick(2, "", { PICK_SLEEP: "1" });
  assert.equal(out.status, 0, out.stderr);
  assert.deepEqual(r.started().sort(), ["factory-cat-1.service", "factory-cat-2.service"]);
  // The second pick started before the first one ended: they overlapped.
  const at = Object.fromEntries(r.picks().map(([, proj, what, ns]) => [`${proj} ${what}`, BigInt(ns)]));
  const [first, second] = ["proj-a", "proj-b"].sort((x, y) => (at[`${x} start`] < at[`${y} start`] ? -1 : 1));
  assert.ok(at[`${second} start`] < at[`${first} end`], `picks did not overlap: ${read(r.calls)}`);
  // Each repo's lines carry its folder name.
  assert.match(out.stdout, /^\[repo-a\] started CAT-1 /m);
  assert.match(out.stdout, /^\[repo-b\] started CAT-2 /m);
  assert.match(read(join(r.state, "pass.json")), /"lastPassResult":"ok: started CAT-[12] CAT-[12]"/);
});

test("CAT-1547: parallel 1 runs the repos one after another; a bad parallel line is said and falls back to 4", () => {
  let r = rig();
  let out = r.tick(2, "parallel 1\n", { PICK_SLEEP: "1" });
  assert.equal(out.status, 0, out.stderr);
  assert.doesNotMatch(out.stderr, /ignoring 'parallel/);
  assert.equal(r.started().length, 2);
  const p = r.picks();
  // One after another: the first pick ended before the second started.
  assert.deepEqual(p.map(([, , what]) => what), ["start", "end", "start", "end"]);
  assert.ok(BigInt(p[1][3]) <= BigInt(p[2][3]));
  for (const bad of ["parallel 0", "parallel 17", "parallel two"]) {
    r = rig();
    out = r.tick(2, `${bad}\n`);
    assert.equal(out.status, 0, `${bad}: ${out.stderr}`);
    assert.match(out.stderr, new RegExp(`ignoring '${bad}' in .*: it must be a whole number from 1 to 16; using 4`));
    // Not read as a repo line: still exactly two picks, one per repo.
    assert.equal(r.picks().filter(([, , what]) => what === "start").length, 2, bad);
  }
});

test("CAT-1547: one repo's failing sweep doesn't stop or fail the other repos' sweeps or pickups; that repo picks nothing", () => {
  for (const parallel of ["parallel 1\n", ""]) {
    const r = rig();
    // repo-a's CI sweep can't make its state folder (a file is in the way):
    // under set -e that ends repo-a's sweeps job there.
    mkdirSync(join(r.state, "ci"), { recursive: true });
    writeFileSync(join(r.state, "ci", "repo-a"), "");
    const out = r.tick(2, parallel);
    assert.equal(out.status, 0, `${parallel}: ${out.stderr}`);
    assert.match(out.stderr, /^\[repo-a\] this repo's repo_sweeps ended with exit 1; the other repos' went on$/m);
    assert.doesNotMatch(out.stderr, /\[repo-b\] this repo's/);
    // repo-b's sweeps ran past the CI sweep to the review sweep; repo-a's stopped before it.
    assert.ok(existsSync(join(r.state, "reviewed", "repo-b")), parallel);
    assert.ok(!existsSync(join(r.state, "reviewed", "repo-a")), parallel);
    // repo-b still picked and started its card; repo-a, whose sweeps failed,
    // claimed none (its builder would likely hit the same fault).
    assert.deepEqual(r.started(), ["factory-cat-2.service"], parallel);
    assert.deepEqual(r.picks().filter(([, , what]) => what === "start").map(([, proj]) => proj), ["proj-b"], parallel);
    assert.match(out.stderr, /^\[repo-a\] its sweeps failed this tick, so no new card is picked there$/m);
    // The heartbeat names the repo whose job failed.
    assert.match(read(join(r.state, "pass.json")), /"lastPassResult":"error \(failed in repo-a\); ok: started CAT-2"/);
  }
});

test("CAT-1547: a session that fails to start ends its repo's pickup only, and frees its slot", () => {
  const r = rig();
  const out = r.tick(1, "parallel 1\n", { FAIL_UNIT: "factory-cat-1" });
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stderr, /^\[repo-a\] this repo's repo_pickup ended with exit 1; the other repos' went on$/m);
  // repo-a's slot was freed when its job ended, so repo-b's card still started under cap 1.
  assert.deepEqual(r.started(), ["factory-cat-2.service"]);
});
