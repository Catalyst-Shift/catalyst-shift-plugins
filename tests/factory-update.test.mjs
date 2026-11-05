// CAT-1562: the factory machine updates itself when plugins main moves. A fake
// origin (a bare repo) and a fake plugins clone stand in for GitHub and
// ~/Projects/catalyst-shift-plugins; the clone's factory/install.sh is a stub
// that logs each run and writes installed.json the way the real one does. The
// boot check, claude and gstack-upgrade are stubs that log their calls.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UPDATE = join(ROOT, "factory", "bin", "claude-factory-update");
const DISPATCH = join(ROOT, "factory", "bin", "claude-factory-dispatch");
const STREAM = join(ROOT, "factory", "bin", "claude-factory-stream");
const require = createRequire(import.meta.url);
const { heartbeatSnapshot } = require(STREAM);
const read = (f) => readFileSync(f, "utf8");
const readOr = (f) => (existsSync(f) ? read(f) : "");

const GIT_ENV = {
  GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t",
  GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null",
};

const INSTALL_STUB = `#!/usr/bin/env bash
R=$(cd "$(dirname "$0")/.." && pwd)
echo "install $(git -C "$R" rev-parse HEAD)" >>"$HOME/install.log"
mkdir -p "$HOME/.local/state/claude-factory"
printf '{"factorySha":"%s","source":"%s"}\\n' "$(git -C "$R" rev-parse HEAD)" "$R" >"$HOME/.local/state/claude-factory/installed.json"
exit "\${INSTALL_EXIT:-0}"
`;

function rig() {
  const t = mkdtempSync(join(tmpdir(), "factory-update-"));
  const home = join(t, "home"), bin = join(t, "bin"), gstack = join(t, "gstack");
  const state = join(home, ".local/state/claude-factory");
  const origin = join(t, "origin.git"), seed = join(t, "seed"), clone = join(home, "Projects/catalyst-shift-plugins");
  for (const d of [bin, join(gstack, "bin"), join(home, ".local/bin"), join(home, ".config/claude-factory"), state]) mkdirSync(d, { recursive: true });
  const env = { HOME: home, PATH: `${bin}:/usr/bin:/bin`, CLAUDE_BIN: join(bin, "claude"), GSTACK_DIR: gstack, ...GIT_ENV };
  const git = (cwd, ...a) => {
    const r = spawnSync("git", a, { cwd, encoding: "utf8", env });
    assert.equal(r.status, 0, `git ${a.join(" ")}: ${r.stderr}`);
    return r.stdout.trim();
  };
  git(t, "init", "-q", "--bare", "-b", "main", origin);
  git(t, "init", "-q", "-b", "main", seed);
  mkdirSync(join(seed, "factory"), { recursive: true });
  writeFileSync(join(seed, "factory/install.sh"), INSTALL_STUB, { mode: 0o755 });
  writeFileSync(join(seed, "factory/dispatch"), "v1\n");
  writeFileSync(join(seed, "README.md"), "r1\n");
  git(seed, "add", "-A");
  git(seed, "commit", "-qm", "one");
  git(seed, "remote", "add", "origin", origin);
  git(seed, "push", "-q", "origin", "main");
  git(t, "clone", "-q", origin, clone);
  // Upstream commits: a path and its content, pushed to origin main.
  const commit = (path, body) => {
    writeFileSync(join(seed, path), body);
    git(seed, "add", "-A");
    git(seed, "commit", "-qm", `change ${path}`);
    git(seed, "push", "-q", "-f", "origin", "main");
    return git(seed, "rev-parse", "HEAD");
  };
  // Stubs: the boot check answers from $HOME/boot; claude and gstack-upgrade log.
  writeFileSync(join(home, ".local/bin/claude-factory-bootcheck"), `#!/bin/sh\necho "bootcheck $*" >>"$HOME/calls"\ncat "$HOME/boot" 2>/dev/null || echo "boot: ok"\n`, { mode: 0o755 });
  writeFileSync(join(bin, "claude"), `#!/bin/sh\necho "claude $*" >>"$HOME/calls"\necho "ok"\n`, { mode: 0o755 });
  writeFileSync(join(gstack, "bin/gstack-upgrade"), `#!/bin/sh\necho "gstack-upgrade in $(pwd)" >>"$HOME/calls"\necho "gstack-upgrade: current 1.0"\n`, { mode: 0o755 });
  const conf = join(home, ".config/claude-factory/repos.conf");
  writeFileSync(conf, "label kevin-omarchy\n");
  // The first install, by hand.
  const first = spawnSync(join(clone, "factory/install.sh"), [], { encoding: "utf8", env });
  assert.equal(first.status, 0, first.stderr);
  const run = (args, extra = {}) => spawnSync("bash", [UPDATE, ...args], { encoding: "utf8", env: { ...env, ...extra } });
  const lines = (r) => r.stdout.trimEnd().split("\n").filter(Boolean);
  const decision = (r) => lines(r).filter((l) => l.startsWith("=> ")).pop();
  const installs = () => readOr(join(home, "install.log")).trim().split("\n").filter(Boolean);
  const upd = () => JSON.parse(read(join(state, "update.json")));
  const calls = () => readOr(join(home, "calls"));
  const head = () => git(clone, "rev-parse", "HEAD");
  return { t, home, bin, state, clone, seed, conf, env, git, commit, run, lines, decision, installs, upd, calls, head, done: () => rmSync(t, { recursive: true, force: true }) };
}

test("current: nothing behind installs nothing; the first check of the hour refreshes", () => {
  const x = rig();
  try {
    const sha = x.head();
    const r = x.run(["check"]);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(x.lines(r), [`update: current (${sha.slice(0, 7)})`, "=> refresh"]);
    assert.equal(x.upd().state, "current");
    assert.equal(x.upd().latestSha, sha);
    assert.equal(x.upd().boot, "boot: ok");
    assert.deepEqual(x.installs(), [`install ${sha}`]);
    // Within 10 minutes the next check does nothing and says nothing.
    assert.deepEqual(x.lines(x.run(["check"])), ["=> none"]);
  } finally {
    x.done();
  }
});

test("a fast-forward that changes factory/ is pulled and installed, and the boot check passes", () => {
  const x = rig();
  try {
    const prev = x.head();
    const sha = x.commit("factory/dispatch", "v2\n");
    const r = x.run(["check", "--force"]);
    assert.equal(x.decision(r), `=> apply ${sha}`, r.stdout);
    assert.equal(x.upd().state, "behind");
    const a = x.run(["apply", sha]);
    assert.equal(a.status, 0, a.stderr);
    assert.match(a.stdout, new RegExp(`update: installed ${sha.slice(0, 7)} \\(boot: ok\\)`));
    assert.equal(x.head(), sha);
    assert.deepEqual(x.installs(), [`install ${prev}`, `install ${sha}`]);
    assert.deepEqual({ ...x.upd(), checkedAt: null }, { checkedAt: null, latestSha: sha, state: "current", reason: `installed ${sha.slice(0, 7)}`, boot: "boot: ok" });
    // The same step refreshed the plugins and gstack (from $HOME, so it certifies no project).
    const c = x.calls();
    assert.match(c, /^claude plugin marketplace update catalyst-shift-plugins$/m);
    assert.match(c, /^claude plugin update catalyst-ops@catalyst-shift-plugins$/m);
    assert.match(c, /^claude plugin update design-skill@catalyst-shift-plugins$/m);
    assert.match(c, new RegExp(`^gstack-upgrade in ${x.home}$`, "m"));
    assert.doesNotMatch(c, /-y\b|--yes/, "never accepts a marketplace-declared command unattended");
  } finally {
    x.done();
  }
});

test("a dirty clone or a non-fast-forward installs nothing and writes one update: skipped line", () => {
  const x = rig();
  try {
    const prev = x.head();
    x.commit("factory/dispatch", "v2\n");
    writeFileSync(join(x.clone, "README.md"), "local edit\n");
    let r = x.run(["check", "--force"]);
    assert.deepEqual(x.lines(r), ["update: skipped (the plugins clone has uncommitted changes)", "=> none"]);
    assert.equal(x.upd().state, "skipped");
    assert.equal(x.upd().reason, "the plugins clone has uncommitted changes");
    x.git(x.clone, "checkout", "-q", "--", "README.md");
    // origin/main rewritten: the installed sha is no longer its ancestor.
    x.git(x.seed, "reset", "-q", "--hard", prev);
    x.git(x.seed, "commit", "-q", "--amend", "-m", "rewritten");
    const rewritten = x.commit("factory/dispatch", "v3\n");
    r = x.run(["check", "--force"]);
    assert.deepEqual(x.lines(r), [`update: skipped (origin/main ${rewritten.slice(0, 7)} is not a fast-forward of the installed ${prev.slice(0, 7)})`, "=> none"]);
    // A clone on another branch is skipped too.
    x.git(x.clone, "checkout", "-q", "-b", "local");
    x.git(x.seed, "reset", "-q", "--hard", prev);
    x.commit("factory/dispatch", "v4\n");
    r = x.run(["check", "--force"]);
    assert.deepEqual(x.lines(r), ["update: skipped (the plugins clone is on local, not main)", "=> none"]);
    assert.deepEqual(x.installs(), [`install ${prev}`], "nothing installed");
    assert.equal(x.git(x.clone, "rev-parse", "HEAD"), prev);
  } finally {
    x.done();
  }
});

test("a change outside factory/ installs nothing", () => {
  const x = rig();
  try {
    const prev = x.head();
    const sha = x.commit("README.md", "r2\n");
    const r = x.run(["check", "--force"]);
    assert.equal(x.lines(r)[0], `update: current (nothing under factory/ changed since ${prev.slice(0, 7)})`);
    assert.equal(x.upd().state, "current");
    assert.equal(x.upd().latestSha, sha);
    assert.deepEqual(x.installs(), [`install ${prev}`]);
  } finally {
    x.done();
  }
});

test("a failing boot check after the install rolls back to the previous factorySha and doesn't retry that sha", () => {
  const x = rig();
  try {
    const prev = x.head();
    const sha = x.commit("factory/dispatch", "v2\n");
    assert.equal(x.decision(x.run(["check", "--force"])), `=> apply ${sha}`);
    writeFileSync(join(x.home, "boot"), "boot: 1 missing (run install.sh)\n");
    const a = x.run(["apply", sha]);
    assert.equal(a.status, 0, a.stderr);
    assert.match(a.stdout, new RegExp(`^update: rolled back to ${prev.slice(0, 7)} \\(boot check said: boot: 1 missing \\(run install\\.sh\\)\\)$`, "m"));
    assert.equal(x.head(), prev, "the clone is back on the previous factorySha");
    assert.deepEqual(x.installs(), [`install ${prev}`, `install ${sha}`, `install ${prev}`], "install.sh re-ran from the previous sha");
    assert.equal(x.upd().state, "rolled-back");
    assert.equal(x.upd().reason, `rolled back to ${prev.slice(0, 7)} (boot check said: boot: 1 missing (run install.sh))`);
    // Healthy again, the same main sha is not tried again; a new one is.
    rmSync(join(x.home, "boot"));
    let r = x.run(["check", "--force"]);
    assert.notEqual(x.decision(r), `=> apply ${sha}`);
    assert.equal(x.upd().state, "rolled-back");
    const next = x.commit("factory/dispatch", "v3\n");
    r = x.run(["check", "--force"]);
    assert.equal(x.decision(r), `=> apply ${next}`);
    // A failing install.sh rolls back too.
    const b = x.run(["apply", next], { INSTALL_EXIT: "1" });
    assert.match(b.stdout, new RegExp(`update: rolled back to ${prev.slice(0, 7)} \\(install\\.sh failed \\(exit 1\\); the rollback install failed too\\)`));
    assert.equal(x.head(), prev);
  } finally {
    x.done();
  }
});

test("a boot check already failing before the update installs nothing", () => {
  const x = rig();
  try {
    x.commit("factory/dispatch", "v2\n");
    writeFileSync(join(x.home, "boot"), "boot: 2 missing (run install.sh)\n");
    const r = x.run(["check", "--force"]);
    assert.deepEqual(x.lines(r), ["update: skipped (the boot check is not ok before the update: boot: 2 missing (run install.sh))", "=> none"]);
  } finally {
    x.done();
  }
});

test("the update waits while a session is starting, and is checked again on the next tick", () => {
  const x = rig();
  try {
    const sha = x.commit("factory/dispatch", "v2\n");
    let r = x.run(["check", "--hold", "factory-cat-9 is starting"]);
    assert.deepEqual(x.lines(r), [`update: behind (${sha.slice(0, 7)}; waiting: factory-cat-9 is starting)`, "=> wait"]);
    assert.equal(x.upd().state, "behind");
    assert.equal(x.upd().reason, "waiting: factory-cat-9 is starting");
    // No 10-minute wait after a hold: the next tick checks again.
    r = x.run(["check"]);
    assert.equal(x.decision(r), `=> apply ${sha}`);
  } finally {
    x.done();
  }
});

test("update off in repos.conf and the board's hold turn it all off, without a fetch", () => {
  const x = rig();
  try {
    x.commit("factory/dispatch", "v2\n");
    writeFileSync(x.conf, "label keith-omarchy\nupdate after kevin-omarchy\nupdate off\n");
    let r = x.run(["check", "--force"]);
    assert.deepEqual(x.lines(r), ["update: skipped (update off in repos.conf)", "=> none"]);
    assert.equal(x.upd().state, "skipped");
    assert.equal(x.git(x.clone, "rev-parse", "origin/main"), x.head(), "no fetch");
    writeFileSync(x.conf, "label keith-omarchy\n");
    r = x.run(["check", "--force", "--held"]);
    assert.deepEqual(x.lines(r), ["update: skipped (held from the board)", "=> none"]);
  } finally {
    x.done();
  }
});

test("canary order: update after <machine> waits for 3 of its ticks on the same sha with boot: ok", () => {
  const x = rig();
  try {
    const sha = x.commit("factory/dispatch", "v2\n");
    writeFileSync(x.conf, "label keith-omarchy\nupdate after kevin-omarchy\n");
    const fleet = join(x.t, "fleet.json");
    const beat = (s, boot, pass) => writeFileSync(fleet, JSON.stringify({ machines: [
      { machine: "keith-omarchy", heartbeat: { installed: { factorySha: sha }, update: { boot: "boot: ok" }, lastPassAt: pass } },
      { machine: "kevin-omarchy", heartbeat: { installed: { factorySha: s }, update: { boot }, lastPassAt: pass } },
    ] }));
    const check = (args = ["--fleet", fleet]) => x.run(["check", ...args], { CLAUDE_FACTORY_UPDATE_EVERY: "0" });
    let r = check([]);
    assert.equal(x.lines(r)[0], `update: behind (${sha.slice(0, 7)}; waiting: can't read kevin-omarchy's heartbeat from the board)`);
    assert.equal(x.decision(r), "=> none");
    beat("0000000", "boot: ok", "2026-11-05T10:00:00Z");
    assert.match(x.lines(check())[0], /waiting: kevin-omarchy is not on .* with boot: ok yet/);
    beat(sha, "boot: 1 missing (run install.sh)", "2026-11-05T10:02:00Z");
    assert.match(x.lines(check())[0], /waiting: kevin-omarchy is not on/);
    beat(sha, "boot: ok", "2026-11-05T10:04:00Z");
    assert.match(x.lines(check())[0], /waiting: kevin-omarchy has run .* with boot: ok for 1 of 3 ticks/);
    // The same tick seen twice counts once.
    assert.match(x.lines(check())[0], /for 1 of 3 ticks/);
    beat(sha, "boot: ok", "2026-11-05T10:06:00Z");
    assert.match(x.lines(check())[0], /for 2 of 3 ticks/);
    beat(sha, "boot: ok", "2026-11-05T10:08:00Z");
    assert.equal(x.decision(check()), `=> apply ${sha}`);
    assert.deepEqual(x.installs().length, 1, "check installs nothing itself");
  } finally {
    x.done();
  }
});

test("refresh pulls clean repo clones on their default branch, skips dirty ones, and writes no config, cap, token or env file", () => {
  const x = rig();
  try {
    // Two repo clones: one clean and behind, one with uncommitted changes.
    const mk = (name) => {
      const o = join(x.t, `${name}.git`), s = join(x.t, `${name}-seed`), c = join(x.home, "Projects", name);
      x.git(x.t, "init", "-q", "--bare", "-b", "main", o);
      x.git(x.t, "init", "-q", "-b", "main", s);
      writeFileSync(join(s, "f"), "1\n");
      x.git(s, "add", "-A"); x.git(s, "commit", "-qm", "1"); x.git(s, "remote", "add", "origin", o); x.git(s, "push", "-q", "origin", "main");
      x.git(x.t, "clone", "-q", o, c);
      writeFileSync(join(s, "f"), "2\n");
      x.git(s, "commit", "-qam", "2"); x.git(s, "push", "-q", "origin", "main");
      return { c, tip: x.git(s, "rev-parse", "HEAD") };
    };
    const clean = mk("lumen"), dirty = mk("lbl-nextjs");
    writeFileSync(join(dirty.c, "f"), "local\n");
    const pluginsBefore = x.head();
    x.commit("README.md", "r2\n");
    writeFileSync(x.conf, `label kevin-omarchy\nmodel review claude-sonnet-5-5\n~/Projects/lumen lumen\n${dirty.c} lbl-nextjs\n~/Projects/catalyst-shift-plugins catalyst-shift-plugins\n`);
    const envd = join(x.home, ".config/environment.d");
    mkdirSync(envd, { recursive: true });
    writeFileSync(join(envd, "90-factory-token.conf"), "FACTORY_INGEST_TOKEN=tok\n");
    writeFileSync(join(x.state, "control.json"), '{"version":3,"runningCap":4}\n');
    const files = [x.conf, join(envd, "90-factory-token.conf"), join(x.state, "control.json")];
    const before = files.map(read);
    const a = x.run(["apply", "-"]);
    assert.equal(a.status, 0, a.stderr);
    assert.equal(x.git(clean.c, "rev-parse", "HEAD"), clean.tip, "the clean clone is pulled");
    assert.match(a.stdout, new RegExp(`^update: repo ${x.home}/Projects/lumen: at ${clean.tip.slice(0, 7)}$`, "m"));
    assert.match(a.stdout, new RegExp(`^update: repo ${dirty.c}: skipped \\(uncommitted changes\\)$`, "m"));
    assert.equal(read(join(dirty.c, "f")), "local\n");
    assert.equal(x.head(), pluginsBefore, "the plugins clone moves only with an install");
    assert.doesNotMatch(a.stdout, /catalyst-shift-plugins: /);
    assert.deepEqual(files.map(read), before, "repos.conf, the token env file and control.json are byte-identical");
    assert.deepEqual(x.installs().length, 1, "a refresh runs no install");
  } finally {
    x.done();
  }
});

test("the updater installs code only: no unit stop or restart, no write to repos.conf or environment files", () => {
  const s = read(UPDATE);
  assert.doesNotMatch(s, /systemctl/, "it never stops or restarts a unit (install.sh only daemon-reloads)");
  assert.doesNotMatch(s, />>?\s*"?\$CONF/, "never writes repos.conf");
  assert.doesNotMatch(s, /environment\.d|set-environment|FACTORY_INGEST_TOKEN|CLAUDE_FACTORY_CAP/);
  // install.sh runs from the clone, never files copied by the updater itself.
  assert.match(s, /"\$c\/factory\/install\.sh" <\/dev\/null/);
  assert.doesNotMatch(s, /\binstall -D|\bcp\b/);
  // Every claude and git network call reads stdin from /dev/null.
  for (const l of s.split("\n").filter((l) => /"\$CLAUDE" plugin|timeout \d+ "\$GSTACK_DIR\/bin\/gstack-upgrade"|git -C "\$\w+" (fetch|pull)/.test(l))) assert.match(l, /<\/dev\/null/, l);
  // The whole script runs from main(), parsed before install.sh can replace the file.
  assert.match(s, /\nmain "\$@"; exit \$\?\n$/);
});

test("the heartbeat carries update next to installed", () => {
  const x = rig();
  try {
    let hb = heartbeatSnapshot({ HOME: x.home, FACTORY_MACHINE: "kevin-omarchy" });
    assert.equal(hb.update, null, "null before the first check");
    x.run(["check"]);
    hb = heartbeatSnapshot({ HOME: x.home, FACTORY_MACHINE: "kevin-omarchy" });
    assert.deepEqual(Object.keys(hb.update), ["checkedAt", "latestSha", "state", "reason", "boot"]);
    assert.equal(hb.update.state, "current");
    assert.equal(hb.update.latestSha, x.head());
    assert.equal(hb.update.boot, "boot: ok");
    assert.ok(Object.keys(hb).indexOf("update") === Object.keys(hb).indexOf("installed") + 1);
    // An unknown state is not sent.
    writeFileSync(join(x.state, "update.json"), '{"state":"weird","reason":"x"}');
    assert.equal(heartbeatSnapshot({ HOME: x.home, FACTORY_MACHINE: "kevin-omarchy" }).update, null);
  } finally {
    x.done();
  }
});

// The dispatcher's side: the real dispatcher, with systemctl and systemd-run
// stubbed. $HOME/units is what list-units shows; $HOME/since the
// ActiveEnterTimestamp; $HOME/update-active makes claude-factory-update active.
function tick(x, extra = {}) {
  writeFileSync(join(x.bin, "systemctl"), `#!/bin/sh
case "$*" in
  *"is-active --quiet claude-factory-update.service"*) [ -e "$HOME/update-active" ] && exit 0; exit 3;;
  *is-active*) exit 3;;
  *list-units*) cat "$HOME/units" 2>/dev/null;;
  *ActiveEnterTimestamp*) cat "$HOME/since" 2>/dev/null;;
esac
exit 0
`, { mode: 0o755 });
  writeFileSync(join(x.bin, "systemd-run"), `#!/bin/sh\necho "systemd-run $*" >>"$HOME/calls"\n[ -t 0 ] && echo "stdin is a tty" >>"$HOME/calls"\nexit 0\n`, { mode: 0o755 });
  writeFileSync(join(x.bin, "gh"), "#!/bin/sh\necho '[]'\n", { mode: 0o755 });
  writeFileSync(join(x.bin, "claude"), `#!/bin/sh\necho "claude $*" | cut -c1-60 >>"$HOME/calls"\necho NONE\n`, { mode: 0o755 });
  return spawnSync("bash", [DISPATCH], { encoding: "utf8", env: { ...x.env, CLAUDE_FACTORY_NODE: "/nonexistent", ...extra } });
}

test("dispatcher: a starting session holds the update; with none starting the tick starts claude-factory-update and ends", () => {
  const x = rig();
  try {
    const sha = x.commit("factory/dispatch", "v2\n");
    writeFileSync(join(x.home, "units"), "factory-cat-9.service loaded activating start Claude factory session\n");
    let r = tick(x);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /update: behind \(.{7}; waiting: factory-cat-9 is starting\)/);
    assert.doesNotMatch(x.calls(), /claude-factory-update/);
    // Active, but for under 60 seconds: still starting.
    writeFileSync(join(x.home, "units"), "factory-cat-9.service loaded active running Claude factory session\n");
    writeFileSync(join(x.home, "since"), new Date().toString() + "\n");
    r = tick(x);
    assert.match(r.stdout, /waiting: factory-cat-9 is starting/);
    // Running for minutes: it keeps running, and the update starts beside it.
    writeFileSync(join(x.home, "since"), new Date(Date.now() - 600e3).toString() + "\n");
    r = tick(x);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /update: started claude-factory-update \(apply [0-9a-f]{40}; log .*update\.log\); this tick ends here/);
    const run = x.calls().split("\n").find((l) => l.startsWith("systemd-run") && l.includes("claude-factory-update"));
    assert.ok(run, x.calls());
    assert.match(run, /--user --quiet --unit=claude-factory-update --collect/);
    assert.match(run, new RegExp(`claude-factory-update apply ${sha}$`));
    assert.match(run, /UnsetEnvironment=ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN FACTORY_INGEST_TOKEN/);
    assert.doesNotMatch(x.calls(), /stdin is a tty|systemctl --user stop/);
    assert.doesNotMatch(x.calls(), /claude -p/, "the tick ended before any pick");
    assert.equal(JSON.parse(read(join(x.state, "pass.json"))).lastPassResult, `updating: apply ${sha}`);
    // While the update unit runs, ticks hold.
    writeFileSync(join(x.home, "update-active"), "");
    r = tick(x);
    assert.match(r.stdout, /update: claude-factory-update is running; this tick waits for it/);
    assert.equal(JSON.parse(read(join(x.state, "pass.json"))).lastPassResult, "holding: updating");
  } finally {
    x.done();
  }
});

test("dispatcher: the board's updatesHeld skips; updateRequested checks now, once per control version", () => {
  const x = rig();
  try {
    x.commit("factory/dispatch", "v2\n");
    writeFileSync(join(x.state, "control.json"), '{"version":5,"updatesHeld":true}\n');
    let r = tick(x);
    assert.match(r.stdout, /update: skipped \(held from the board\)/);
    assert.doesNotMatch(x.calls(), /claude-factory-update/);
    // Within 10 minutes of a check nothing runs, unless the board asks.
    writeFileSync(join(x.state, "update", "checked"), "");
    writeFileSync(join(x.state, "control.json"), '{"version":6,"updateRequested":true}\n');
    writeFileSync(join(x.conf), "label keith-omarchy\nupdate after kevin-omarchy\n");
    r = tick(x);
    assert.match(r.stdout, /update: started claude-factory-update \(apply /, "Update now skips the 10-minute wait and the canary");
    assert.equal(read(join(x.state, "update", "requested")).trim(), "6");
    writeFileSync(join(x.home, "calls"), "");
    r = tick(x);
    assert.doesNotMatch(x.calls(), /claude-factory-update/, "the same request is not acted on twice");
  } finally {
    x.done();
  }
});

test("every systemd-run in the dispatcher's update step reads stdin from /dev/null", () => {
  const s = read(DISPATCH);
  const step = s.slice(s.indexOf("update_step() {"), s.indexOf("\n}\n", s.indexOf("update_step() {")));
  assert.match(step, /"\$UPDATER" apply "\$target" <\/dev\/null/);
  assert.match(step, /"\$UPDATER" "\$\{args\[@\]\}" <\/dev\/null/);
});
