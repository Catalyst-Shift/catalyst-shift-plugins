// factory/ (CAT-1298): the dispatcher and its installer stay valid bash, carry
// no machine-specific home paths, and keep the two fixes the live dispatcher
// needed: --allowedTools=<list> (the variadic flag otherwise swallows the
// prompt) and claude calls reading stdin from /dev/null inside `while read`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
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
