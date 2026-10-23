// factory/ (CAT-1298): the dispatcher and its installer stay valid bash, carry
// no machine-specific home paths, and keep the two fixes the live dispatcher
// needed: --allowedTools=<list> (the variadic flag otherwise swallows the
// prompt) and claude calls reading stdin from /dev/null inside `while read`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, readdirSync } from "node:fs";

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
