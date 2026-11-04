// CAT-1441: each dispatcher tick pulls the machine's control settings from the
// board (pause, running and review caps, stop). A fake curl answers from a
// board file (or 503s when it holds "down"), checks the bearer token arrived on
// stdin and logs every call; systemctl says which units are active and logs
// stops; claude logs picks and stop calls.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DISPATCH = join(ROOT, "factory", "bin", "claude-factory-dispatch");
const STREAM = join(ROOT, "factory", "bin", "claude-factory-stream");
const require = createRequire(import.meta.url);
const { heartbeatSnapshot } = require(STREAM);
const read = (f) => readFileSync(f, "utf8");

function rig() {
  const t = mkdtempSync(join(tmpdir(), "factory-control-"));
  const home = join(t, "home"), bin = join(t, "bin"), state = join(home, ".local/state/claude-factory");
  for (const d of [bin, state, join(home, ".config/claude-factory")]) mkdirSync(d, { recursive: true });
  const board = join(t, "board.json"), calls = join(t, "calls"), active = join(t, "active");
  writeFileSync(calls, "");
  writeFileSync(active, "");
  writeFileSync(join(bin, "gh"), `#!/usr/bin/env bash
[ "$1 $2" = "api user" ] && { echo kkreative; exit 0; }
shift 2; q=.
while [ $# -gt 0 ]; do case $1 in --jq) q=$2; shift;; esac; shift; done
echo '[]' | jq -r "$q"
`, { mode: 0o755 });
  writeFileSync(join(bin, "systemd-run"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  writeFileSync(join(bin, "systemctl"), `#!/bin/sh
case "$*" in
  *is-active*) u=$(printf '%s' "$*" | sed 's/.*--quiet //; s/\\.service//'); grep -qx "$u" "${active}" && exit 0; exit 3;;
  *"stop "*) echo "systemctl $*" >>"${calls}"; u=$(printf '%s' "$*" | sed 's/.*stop //; s/\\.service//'); grep -vx "$u" "${active}" >"${active}.n"; mv "${active}.n" "${active}";;
esac
exit 0
`, { mode: 0o755 });
  writeFileSync(join(bin, "curl"), `#!/usr/bin/env bash
cfg=$(cat); out=; method=GET; body=
while [ $# -gt 0 ]; do case $1 in -o) out=$2; shift;; -X) method=$2; shift;; --data-binary) body=\${2#@}; shift;; http*) url=$1;; esac; shift; done
case $cfg in *'Authorization: Bearer tok-secret'*) ;; *) echo "curl: no token on stdin" >>"${calls}"; printf 401; exit 0;; esac
if [ "$method" = POST ]; then echo "POST $url $(cat "$body")" >>"${calls}"; printf 200; exit 0; fi
echo "GET $url" >>"${calls}"
if [ "$(cat "${board}")" = down ]; then printf 503; exit 0; fi
cat "${board}" >"$out"; printf 200
`, { mode: 0o755 });
  writeFileSync(join(bin, "claude"), `#!/usr/bin/env bash
p=\${!#}
case $p in
  *"stopped via Factory Board"*) id=$(printf '%s' "$p" | grep -oE 'issue [A-Z]+-[0-9]+' | head -1); echo "stop-card \${id#issue }" >>"${calls}"
    if [ -n "$NO_LINEAR" ]; then echo "no Linear"; else echo "STOPPED Blocked"; fi;;
  *"Ready For Factory"*) echo "pick" >>"${calls}"; echo NONE;;
  *) echo NONE;;
esac
`, { mode: 0o755 });
  writeFileSync(join(home, ".config/claude-factory/repos.conf"), `label kevin-omarchy\n${t} proj\n`);
  const set = (o) => writeFileSync(board, typeof o === "string" ? o : JSON.stringify(o));
  const ctl = (o = {}) => set({ paused_until: null, runningCap: null, reviewCap: null, stop: [], version: 1, ...o });
  ctl();
  const run = (args = [], extra = {}) => spawnSync("bash", [DISPATCH, ...args], {
    encoding: "utf8",
    env: { HOME: home, PATH: `${bin}:/usr/bin:/bin`, CLAUDE_BIN: join(bin, "claude"), FACTORY_INGEST_TOKEN: "tok-secret", CLAUDE_FACTORY_CONTROL_URL: "http://board.test/api/machines", CLAUDE_FACTORY_NODE: "/nonexistent", ...extra },
  });
  const took = () => { const c = read(calls); writeFileSync(calls, ""); return c.trim().split("\n").filter(Boolean); };
  const pass = () => JSON.parse(read(join(state, "pass.json")));
  const beat = () => heartbeatSnapshot({ HOME: home, FACTORY_MACHINE: "kevin-omarchy" });
  const url = "http://board.test/api/machines/kevin-omarchy/control";
  return { t, state, set, ctl, run, took, pass, beat, url, setActive: (u) => writeFileSync(active, u.map((x) => x + "\n").join("")) };
}
const inAnHour = () => new Date(Date.now() + 3600e3).toISOString().replace(/\.\d+Z$/, "Z");

test("each tick fetches the board's settings with the token on stdin; no pause means a pick", () => {
  const { t, run, took, pass, url } = rig();
  try {
    const r = run();
    assert.equal(r.status, 0, r.stderr);
    // CAT-1486: the stages fetch follows the control fetch, with the same token on stdin.
    assert.deepEqual(took(), [`GET ${url}`, "GET https://os.catalystshift.ai/api/factory/stages", "pick"]);
    assert.deepEqual({ ...pass(), lastPassAt: 0 }, { lastPassAt: 0, lastPassResult: "ok", runningCap: 2, reviewWaiting: 0, reviewCap: 3, control: "live", controlVersion: 1, pausedUntil: null });
  } finally { rmSync(t, { recursive: true, force: true }); }
});

test("paused_until in the future claims nothing and the heartbeat shows it; a past time does not pause", () => {
  const { t, ctl, run, took, pass, beat } = rig();
  try {
    const future = inAnHour();
    ctl({ paused_until: future, version: 4 });
    let r = run();
    assert.equal(r.status, 0, r.stderr);
    assert.ok(!took().includes("pick"), "a paused machine claimed a card");
    assert.ok(r.stdout.includes(`paused by the board until ${future}`), r.stdout);
    assert.equal(pass().pausedUntil, future);
    assert.equal(pass().controlVersion, 4);
    const b = beat();
    assert.equal(b.dispatcher, "paused");
    assert.equal(b.pausedUntil, future);
    assert.equal(b.control, "live");
    assert.equal(b.controlVersion, 4);

    ctl({ paused_until: "2020-01-01T00:00:00Z", version: 5 });
    r = run();
    assert.ok(took().includes("pick"), r.stdout);
    assert.equal(pass().pausedUntil, null);
    assert.equal(beat().dispatcher, "running");
  } finally { rmSync(t, { recursive: true, force: true }); }
});

test("a pause that is not a time is ignored and logged", () => {
  const { t, ctl, run, took } = rig();
  try {
    ctl({ paused_until: "tomorrow" });
    const r = run();
    assert.ok(took().includes("pick"));
    assert.ok(r.stderr.includes("ignoring paused_until 'tomorrow' from the board"), r.stderr);
  } finally { rmSync(t, { recursive: true, force: true }); }
});

test("caps 1 to 8 override the defaults; anything else is ignored and logged", () => {
  const { t, ctl, run, pass } = rig();
  try {
    ctl({ runningCap: 5, reviewCap: 7, version: 2 });
    let r = run();
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual([pass().runningCap, pass().reviewCap], [5, 7]);
    for (const [rc, vc] of [[0, 9], [3.5, "4"], [-1, 100]]) {
      ctl({ runningCap: rc, reviewCap: vc, version: 3 });
      r = run();
      assert.equal(r.status, 0, r.stderr);
      assert.deepEqual([pass().runningCap, pass().reviewCap], [2, 3], `${rc}/${vc}`);
      assert.ok(r.stderr.includes(`ignoring runningCap ${JSON.stringify(rc)} from the board`), r.stderr);
      assert.ok(r.stderr.includes(`ignoring reviewCap ${JSON.stringify(vc)} from the board`), r.stderr);
    }
    ctl({ runningCap: 1, version: 6 });
    r = run();
    assert.deepEqual([pass().runningCap, pass().reviewCap], [1, 3]);
    assert.equal(r.stderr, "");
  } finally { rmSync(t, { recursive: true, force: true }); }
});

test("stop[] stops the card's session, moves it to Blocked with the comment, acks, and is not repeated", () => {
  const { t, state, ctl, run, took, setActive } = rig();
  try {
    setActive(["factory-cat-7", "factory-cat-8"]);
    ctl({ stop: ["CAT-7"], version: 9 });
    let r = run();
    assert.equal(r.status, 0, r.stderr);
    const c = took();
    assert.ok(c.includes("systemctl --user stop factory-cat-7.service"), c.join("\n"));
    assert.ok(c.includes("stop-card CAT-7"), c.join("\n"));
    assert.ok(c.includes(`POST http://board.test/api/machines/kevin-omarchy/control/ack {"version":9,"stopped":["CAT-7"]}`), c.join("\n"));
    assert.ok(!c.some((l) => l.includes("cat-8") || l.includes("CAT-8")), "another card was touched");
    assert.equal(existsSync(join(state, "stopped", "cat-7")), false);

    // The board cleared it; nothing more happens.
    ctl({ version: 10 });
    r = run();
    assert.deepEqual(took().filter((l) => !l.startsWith("GET") && l !== "pick"), []);
  } finally { rmSync(t, { recursive: true, force: true }); }
});

test("a stop whose card isn't confirmed Blocked is retried; a card that isn't running is just acked", () => {
  const { t, state, ctl, run, took, setActive } = rig();
  try {
    setActive(["factory-cat-7"]);
    ctl({ stop: ["CAT-7", "CAT-99"], version: 9 });
    run([], { NO_LINEAR: "1" });
    let c = took();
    assert.ok(c.includes("stop-card CAT-7"), c.join("\n"));
    assert.ok(c.includes(`POST http://board.test/api/machines/kevin-omarchy/control/ack {"version":9,"stopped":["CAT-99"]}`), c.join("\n"));
    assert.equal(read(join(state, "stopped", "cat-7")).trim(), "stopped");
    // Next tick the unit is gone, but the record makes it finish the card, then ack.
    run();
    c = took();
    assert.ok(c.includes("stop-card CAT-7"), c.join("\n"));
    assert.ok(c.some((l) => l.includes(`ack {"version":9,"stopped":["CAT-7","CAT-99"]}`)), c.join("\n"));
    assert.equal(existsSync(join(state, "stopped", "cat-7")), false);
  } finally { rmSync(t, { recursive: true, force: true }); }
});

test("an unreachable board changes nothing: last settings stay, the heartbeat says stale, nothing pauses or stops", () => {
  const { t, state, ctl, set, run, took, pass, beat, setActive } = rig();
  try {
    ctl({ runningCap: 4, stop: ["CAT-7"], version: 7 });
    run();
    took();
    setActive(["factory-cat-7"]);
    set("down");
    const r = run();
    assert.equal(r.status, 0, r.stderr);
    const c = took();
    assert.ok(c.includes("pick"), "an outage paused the machine");
    assert.ok(!c.some((l) => l.includes("systemctl") || l.startsWith("POST") || l.startsWith("stop-card")), c.join("\n"));
    assert.equal(pass().control, "stale");
    assert.equal(pass().runningCap, 4);
    assert.equal(pass().controlVersion, 7);
    assert.match(r.stdout, /did not answer \(503\); keeping the last settings/);
    assert.equal(beat().control, "stale");
    // Never fetched: stale, default caps, no version.
    rmSync(join(state, "control.json"));
    run();
    assert.equal(pass().runningCap, 2);
    assert.equal(pass().controlVersion, null);
  } finally { rmSync(t, { recursive: true, force: true }); }
});

test("a pause the board gave stays in force through an outage until it expires", () => {
  const { t, ctl, set, run, took, pass, beat } = rig();
  try {
    const future = inAnHour();
    ctl({ paused_until: future, version: 3 });
    run();
    took();
    set("down");
    run();
    assert.ok(!took().includes("pick"));
    assert.equal(pass().control, "stale");
    assert.equal(beat().dispatcher, "paused");
  } finally { rmSync(t, { recursive: true, force: true }); }
});

test("without FACTORY_INGEST_TOKEN the dispatcher never calls the board", () => {
  const { t, run, took, pass } = rig();
  try {
    const r = run([], { FACTORY_INGEST_TOKEN: "" });
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(took(), ["pick"]);
    assert.equal(pass().control, "off");
    assert.equal(pass().pausedUntil, null);
    assert.equal(beat0(t).control, "local");
  } finally { rmSync(t, { recursive: true, force: true }); }
});
const beat0 = (t) => heartbeatSnapshot({ HOME: join(t, "home"), FACTORY_MACHINE: "kevin-omarchy" });

test("status --json carries the control settings in effect and the version, writes nothing, and the token stays off command lines", () => {
  const { t, state, ctl, run } = rig();
  try {
    const future = inAnHour();
    ctl({ paused_until: future, runningCap: 6, reviewCap: 9, version: 12 });
    run();
    const before = readdirSync(state).sort();
    const r = run(["status", "--json"]);
    assert.equal(r.status, 0, r.stderr);
    const j = JSON.parse(r.stdout);
    assert.deepEqual(j.control, { state: "live", version: 12, pausedUntil: future, runningCap: 6, reviewCap: null, effective: { runningCap: 6, reviewCap: 3 } });
    assert.equal(j.cap, 6);
    assert.deepEqual(readdirSync(state).sort(), before, "status wrote state");
    assert.match(run(["status"]).stdout, /Running \(cap 6, set by the board\)/);
    const s = read(DISPATCH);
    assert.doesNotMatch(s, /Bearer \$\{?INGEST_TOKEN/);
    assert.match(s, /printf 'header = "Authorization: Bearer %s"\\n' "\$INGEST_TOKEN" \|/);
  } finally { rmSync(t, { recursive: true, force: true }); }
});
