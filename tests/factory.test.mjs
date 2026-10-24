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

test("install.sh skips label and offset lines like the dispatcher does", () => {
  const skip = /grep -vE '\^\[\[:space:\]\]\*\(#\|\$\|label\[\[:space:\]\]\|offset\[\[:space:\]\]\)'/;
  assert.match(read(INSTALL), skip);
  assert.match(read(DISPATCH), skip);
});
