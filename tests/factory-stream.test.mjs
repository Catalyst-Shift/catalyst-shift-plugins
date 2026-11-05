// CAT-1442: factory machines stream each session's events to the board.
// claude-factory-stream cleans each stream-json event (tool results cut to
// 4 KB, file contents and env values never sent), batches them to the board's
// ingest route, spools them while the board is down and sends them in order
// when it is back; the heartbeat posts the machine's state; the dispatcher
// runs sessions under it and reports per card the last seq sent and the spool.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, existsSync, statSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FACTORY = join(ROOT, "factory");
const STREAM = join(FACTORY, "bin", "claude-factory-stream");
const DISPATCH = join(FACTORY, "bin", "claude-factory-dispatch");
const require = createRequire(import.meta.url);
const S = require(STREAM);
const read = (f) => readFileSync(f, "utf8");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TOKEN = "f".repeat(64);
const NODE_DIR = dirname(process.execPath);

async function until(cond, ms = 10_000, what = "condition") {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await cond()) return;
    await sleep(50);
  }
  throw new Error(`timed out waiting for ${what}`);
}

/** A stand-in for the board's POST /api/ingest/events that can be stopped and started on one port. */
function board(answer = () => 202) {
  const bodies = [];
  const auth = [];
  const tried = [];
  let server = null;
  let port = 0;
  const handler = (req, res) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      let body;
      try {
        body = JSON.parse(data);
      } catch {
        body = { unparsed: data };
      }
      tried.push(body);
      // `answer` scripts the board: a status per request (202 stores the batch).
      const status = answer(body, tried.length);
      if (status === 202) {
        auth.push(req.headers.authorization);
        bodies.push(body);
      }
      res.writeHead(status, { "content-type": "application/json" });
      res.end("{}");
    });
  };
  const up = () =>
    new Promise((r) => {
      server = createServer(handler);
      server.listen(port, "127.0.0.1", () => {
        port = server.address().port;
        r();
      });
    });
  const down = () =>
    new Promise((r) => {
      server.closeAllConnections();
      server.close(() => r());
    });
  return { bodies, auth, tried, up, down, url: () => `http://127.0.0.1:${port}/api/ingest/events` };
}

function home() {
  const t = mkdtempSync(join(tmpdir(), "factory-stream-"));
  const h = join(t, "home"), bin = join(t, "bin"), state = join(h, ".local/state/claude-factory");
  for (const d of [bin, state, join(h, ".config/claude-factory")]) mkdirSync(d, { recursive: true });
  writeFileSync(join(h, ".config/claude-factory/repos.conf"), "label kevin-omarchy\n");
  return { t, home: h, bin, state };
}

// ---- Cleaning (checklist 2).

test("a Read of .env is never sent: no value from the file leaves the machine", () => {
  const ctx = { tools: new Map() };
  const env = "DATABASE_URL=postgres://app:hunter2hunter2@db.internal:5432/app\nSTRIPE_SECRET_KEY=sk_live_abcdefghijklmnop1234\nPLAIN=visible-but-from-env-file\n";
  const use = { type: "assistant", message: { content: [{ type: "tool_use", id: "t1", name: "Read", input: { file_path: "/repo/.env.local" } }] } };
  const result = {
    type: "user",
    message: { content: [{ type: "tool_result", tool_use_id: "t1", content: env }] },
    tool_use_result: { type: "text", file: { filePath: "/repo/.env.local", content: env } },
  };
  S.sanitizeEvent(use, ctx);
  const out = JSON.stringify(S.sanitizeEvent(result, ctx));
  for (const secret of ["hunter2hunter2", "sk_live_abcdefghijklmnop1234", "visible-but-from-env-file", "DATABASE_URL"]) {
    assert.ok(!out.includes(secret), `${secret} was sent: ${out}`);
  }
  // A .env read is both file contents and env values: only its size and path go.
  assert.match(out, /not sent: \d+ bytes from \/repo\/\.env\.local\]/);
  assert.ok(!out.includes("tool_use_result"), "the structured copy of the result was sent");
});

test("any Read result is file contents and is never sent in full; a cat of .env is not sent at all", () => {
  const ctx = { tools: new Map() };
  S.sanitizeEvent({ type: "assistant", message: { content: [
    { type: "tool_use", id: "r", name: "Read", input: { file_path: "/repo/src/app.ts" } },
    { type: "tool_use", id: "b", name: "Bash", input: { command: "cat .env.production | head", description: "look" } },
    { type: "tool_use", id: "p", name: "Bash", input: { command: "printenv" } },
  ] } }, ctx);
  const out = S.sanitizeEvent({ type: "user", message: { content: [
    { type: "tool_result", tool_use_id: "r", content: [{ type: "text", text: "export const secretSauce = 1;\n" }] },
    { type: "tool_result", tool_use_id: "b", content: "NEXT_PUBLIC_URL=https://x\nlowercase_value=abc123" },
    { type: "tool_result", tool_use_id: "p", content: "HOME=/home/someone\nweird=thing" },
  ] } }, ctx);
  const s = JSON.stringify(out);
  for (const v of ["secretSauce", "NEXT_PUBLIC_URL", "lowercase_value", "/home/someone"]) assert.ok(!s.includes(v), `${v} was sent`);
  assert.match(s, /may show env values or secrets not sent/);
});

test("tool-result bodies are cut to 4 KB per event; other tools' inputs stay readable", () => {
  const ctx = { tools: new Map() };
  const use = S.sanitizeEvent({ type: "assistant", message: { content: [{ type: "tool_use", id: "g", name: "Bash", input: { command: "npm test" } }] } }, ctx);
  assert.equal(use.message.content[0].input.command, "npm test");
  const big = "x".repeat(20_000);
  const out = S.sanitizeEvent({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "g", content: big }] } }, ctx);
  const body = out.message.content[0].content;
  assert.ok(Buffer.byteLength(body) <= S.MAX_FIELD_BYTES, `body is ${Buffer.byteLength(body)} bytes`);
  assert.match(body, /… \[159\d\d more bytes not sent\]$/);
  // A secret cut by the 4 KB boundary is masked first, so no part of it is sent.
  const edge = S.sanitizeEvent({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "g", content: "y".repeat(4040) + "ghp_abcdefghijklmnopqrstuvwxyz0123" }] } }, ctx);
  assert.doesNotMatch(JSON.stringify(edge), /ghp_/);
  // Content blocks: 4 KB in all, not per block.
  const blocks = S.sanitizeEvent({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "g", content: [
    { type: "text", text: "a".repeat(3000) }, { type: "text", text: "b".repeat(3000) }, { type: "text", text: "c".repeat(3000) },
  ] }] } }, ctx).message.content[0].content;
  const total = blocks.reduce((n, b) => n + Buffer.byteLength(b.text), 0);
  assert.ok(total <= S.MAX_FIELD_BYTES, `blocks total ${total} bytes`);
});

test("secrets in any text are masked: env-style assignments, token formats, URL passwords, known env values", () => {
  const known = S.secretValues({ FACTORY_INGEST_TOKEN: TOKEN, MY_SERVICE_KEY: "q9w8e7r6t5y4", HOME: "/home/x", SHORT_TOKEN: "abc" });
  assert.ok(known.includes(TOKEN) && known.includes("q9w8e7r6t5y4"));
  assert.ok(!known.includes("/home/x") && !known.includes("abc"));
  const ctx = { tools: new Map() };
  S.sanitizeEvent({ type: "assistant", message: { content: [{ type: "tool_use", id: "x", name: "Bash", input: { command: "npm run deploy" } }] } }, ctx);
  const text = [
    "GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz0123",
    "export OPENAI_API_KEY='sk-proj-aaaaaaaaaaaaaaaaaaaaaaaa'",
    "push to https://kevin:s3cretpass@github.com/x.git",
    `Authorization: Bearer ${TOKEN}`,
    "lin_api_ABCDEFGHIJKLMNOPQRSTUVWX1234 and xoxb-1234567890-abcdef",
    '{"client_secret": "shh-very-secret"}',
    "service key q9w8e7r6t5y4 in a log line",
    "-----BEGIN RSA PRIVATE KEY-----\nMIIEow\n-----END RSA PRIVATE KEY-----",
  ].join("\n");
  const out = S.sanitizeEvent({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "x", content: text }] } }, ctx, known);
  const s = JSON.stringify(out);
  for (const v of ["ghp_abcdefghijklmnopqrstuvwxyz0123", "sk-proj-aaaa", "s3cretpass", TOKEN, "lin_api_ABCD", "xoxb-1234567890", "shh-very-secret", "q9w8e7r6t5y4", "MIIEow"]) {
    assert.ok(!s.includes(v), `${v} was sent`);
  }
  assert.match(s, /GITHUB_TOKEN=\[redacted\]/);
  // A field named for a secret is masked; token usage counts are numbers and stay.
  const ev = S.sanitizeEvent({ type: "assistant", message: { usage: { output_tokens: 12 }, content: [{ type: "tool_use", id: "y", name: "mcp__x__call", input: { token: "abc", q: "hi" } }] } }, ctx);
  assert.equal(ev.message.usage.output_tokens, 12);
  assert.equal(ev.message.content[0].input.token, "[redacted]");
  assert.equal(ev.message.content[0].input.q, "hi");
});

test("the init line goes as counts, not its full tool and skill lists", () => {
  const init = S.sanitizeEvent({ type: "system", subtype: "init", model: "m", session_id: "s", tools: Array(80).fill("T"), skills: Array(200).fill("x".repeat(100)), mcp_servers: [{ name: "linear", status: "connected" }] });
  assert.deepEqual(init, { type: "system", subtype: "init", model: "m", session_id: "s", mcp_servers: [{ name: "linear", status: "connected" }], counts: { tools: 80, skills: 200 } });
});

// ---- Stages (checklist 4) and the session's command line (checklist 1).

test("stage changes come from the skills a session runs, its edits and gh pr create", () => {
  const call = (name, input) => ({ type: "assistant", message: { content: [{ type: "tool_use", id: "i", name, input }] } });
  assert.equal(S.stageOf(call("Skill", { skill: "investigate" })), "investigate");
  assert.equal(S.stageOf(call("Skill", { skill: "gstack:review" })), "review");
  assert.equal(S.stageOf(call("Skill", { skill: "cso" })), "review");
  assert.equal(S.stageOf(call("Skill", { skill: "qa" })), "qa");
  assert.equal(S.stageOf(call("Skill", { skill: "ship" })), "ship");
  assert.equal(S.stageOf(call("Edit", { file_path: "a" })), "build");
  assert.equal(S.stageOf(call("Edit", { file_path: "a" }), "review"), null, "a reviewer's fix is not a build stage");
  assert.equal(S.stageOf(call("Bash", { command: "gh pr create --title x" })), "ship");
  assert.equal(S.stageOf(call("Bash", { command: "ls" })), null);
  assert.equal(S.stageOf({ type: "user", message: { content: [] } }), null);
});

test("the session runs with stream-json output, --verbose and a known session id; the prompt is kept", () => {
  const [cmd, args] = S.childArgs(["/bin/claude", "-p", "--permission-mode", "auto", "-w", "factory-cat-1", "--output-format", "text", "the prompt"], "uuid-1");
  assert.equal(cmd, "/bin/claude");
  assert.deepEqual(args, ["--session-id", "uuid-1", "--verbose", "-p", "--permission-mode", "auto", "-w", "factory-cat-1", "--output-format", "stream-json", "the prompt"]);
  // The format is changed where it stands: a variadic option list before it must not swallow the prompt.
  assert.deepEqual(S.childArgs(["c", "-p", "--allowedTools", "Bash", "Read", "--output-format", "text", "prompt"], "u")[1],
    ["--session-id", "u", "--verbose", "-p", "--allowedTools", "Bash", "Read", "--output-format", "stream-json", "prompt"]);
  assert.deepEqual(S.childArgs(["c", "--output-format=text", "p"], "u")[1], ["--session-id", "u", "--verbose", "--output-format=stream-json", "p"]);
  assert.deepEqual(S.childArgs(["c", "-p", "p"], "u")[1], ["--session-id", "u", "--verbose", "--output-format", "stream-json", "-p", "p"]);
});

// ---- A session end to end: batches, spool across an outage, order (checklists 1, 3, 4, 5).

test("a session's events reach the board in order, with nothing lost while the endpoint is stopped mid-session", async () => {
  const { t, home: h, state } = home();
  const b = board();
  await b.up();
  const fake = join(t, "fake-claude");
  // 30 events in three phases; the test moves it on by creating files.
  writeFileSync(fake, `#!/usr/bin/env node
const fs = require("fs");
fs.writeFileSync(${JSON.stringify(join(t, "child-env"))}, JSON.stringify({ token: process.env.FACTORY_INGEST_TOKEN ?? null, args: process.argv.slice(2) }));
const wait = (f) => new Promise((r) => { const i = setInterval(() => { if (fs.existsSync(f)) { clearInterval(i); r(); } }, 20); });
let n = 0;
const emit = () => console.log(JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "event " + n++ }] } }));
(async () => {
  console.log(JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", id: "s", name: "Skill", input: { skill: "investigate" } }] } }));
  for (let i = 0; i < 10; i++) emit();
  await wait(${JSON.stringify(join(t, "phase2"))});
  for (let i = 0; i < 10; i++) emit();
  await wait(${JSON.stringify(join(t, "phase3"))});
  console.log(JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", id: "e", name: "Edit", input: { file_path: "x" } }] } }));
  for (let i = 0; i < 10; i++) emit();
  console.log(JSON.stringify({ type: "result", subtype: "success", is_error: false }));
})();
`, { mode: 0o755 });
  const env = {
    HOME: h, PATH: `${NODE_DIR}:/usr/bin:/bin`, FACTORY_INGEST_TOKEN: TOKEN, FACTORY_INGEST_URL: b.url(),
    FACTORY_STREAM_FLUSH_MS: "100", FACTORY_STREAM_TIMEOUT_MS: "1000", FACTORY_STREAM_FINAL_MS: "20000",
  };
  const p = spawn(process.execPath, [STREAM, "run", "--unit", "factory-cat-77", "--repo", "my-repo", "--", fake, "-p", "--output-format", "text", "prompt"], { env });
  let out = "", err = "";
  p.stdout.on("data", (d) => (out += d));
  p.stderr.on("data", (d) => (err += d));
  const exited = new Promise((r) => p.on("close", r));
  const received = () => b.bodies.flatMap((x) => x.events ?? []);

  await until(() => received().length >= 12, 10_000, "first phase on the board");
  await b.down();
  writeFileSync(join(t, "phase2"), "");
  const spool = () => readdirSync(join(state, "spool")).filter((f) => f.endsWith(".jsonl") && !f.includes("rejected"));
  await until(() => spool().length === 1 && read(join(state, "spool", spool()[0])).trim().length > 0, 10_000, "events spooled while the board is down");
  const whileDown = read(join(state, "spool", spool()[0])).trim().split("\n").flatMap((l) => JSON.parse(l).events);
  assert.ok(whileDown.length >= 10, `only ${whileDown.length} events in the spool`);
  await b.up();
  writeFileSync(join(t, "phase3"), "");
  const code = await exited;
  assert.equal(code, 0, err);

  // Every event once, in seq order, with no gap (a resend of a stored batch is a duplicate the board ignores).
  const seen = new Map();
  for (const e of received()) if (!seen.has(e.seq)) seen.set(e.seq, e);
  const seqs = [...seen.keys()];
  assert.deepEqual(seqs, [...seqs].sort((x, y) => x - y), "sent out of order");
  assert.deepEqual(seqs, seqs.map((_, i) => i), "a gap in seq: something was lost");
  const events = [...seen.values()];
  // 1 start + 32 assistant lines + 30 text... count what the fake printed: 33 lines + result, and 4 status events.
  const texts = events.filter((e) => e.type === "assistant" && e.message.content[0].type === "text").map((e) => e.message.content[0].text);
  assert.deepEqual(texts, Array.from({ length: 30 }, (_, i) => `event ${i}`));
  const statuses = events.filter((e) => e.type === "status");
  assert.deepEqual(statuses.map((e) => e.stage), ["start", "investigate", "build", "end"]);
  for (const s of statuses) assert.equal(s.card, "CAT-77");
  assert.equal(statuses.at(-1).note, "exit 0");

  // Batch shape: {machine, card, sessionId, seq, events[]}, at most 50 events, bearer token in a header only.
  for (const body of b.bodies) {
    assert.equal(body.machine, "kevin-omarchy");
    assert.equal(body.card, "CAT-77");
    assert.match(body.sessionId, /^[0-9a-f-]{36}$/);
    assert.equal(body.seq, body.events[0].seq);
    assert.ok(body.events.length <= 50);
    assert.ok(!JSON.stringify(body).includes(TOKEN), "the token was in a body");
  }
  assert.ok(b.auth.every((a) => a === `Bearer ${TOKEN}`));

  // The session never saw the token, ran with stream-json and the session id the batches carry.
  const child = JSON.parse(read(join(t, "child-env")));
  assert.equal(child.token, null);
  assert.deepEqual(child.args, ["--session-id", b.bodies[0].sessionId, "--verbose", "-p", "--output-format", "stream-json", "prompt"]);
  // The unit's log keeps the raw lines.
  assert.match(out, /"event 29"/);
  // Spool empty, state says the last seq sent; every batch logs its time on the session's side.
  assert.deepEqual(spool(), []);
  const st = JSON.parse(read(join(state, "stream", "factory-cat-77.json")));
  assert.equal(st.lastSeq, seqs.at(-1));
  assert.equal(st.spoolEvents, 0);
  assert.equal(st.repo, "my-repo");
  const preps = [...err.matchAll(/prep ([\d.]+) ms, post (\d+) ms/g)].map((m) => Number(m[1]));
  assert.ok(preps.length >= 3, err);
  for (const ms of preps) assert.ok(ms < 50, `a batch took ${ms} ms on the session's side`);
  assert.match(err, /unreachable|timeout/, "the outage was not logged");
  await b.down();
});

test("without FACTORY_INGEST_TOKEN the session just runs: nothing sent, nothing spooled", () => {
  const { t, home: h, state } = home();
  const fake = join(t, "fake");
  writeFileSync(fake, "#!/bin/sh\necho \"args: $*\"\n", { mode: 0o755 });
  const r = spawnSync(process.execPath, [STREAM, "run", "--unit", "factory-cat-1", "--", fake, "--output-format", "text", "p"], {
    encoding: "utf8", env: { HOME: h, PATH: "/usr/bin:/bin", FACTORY_INGEST_URL: "http://127.0.0.1:9/" },
  });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, "args: --output-format text p\n");
  assert.ok(!existsSync(join(state, "spool")));
});

test("drain sends an ended session's spool in order and removes it; with the board down it keeps it", async () => {
  const { home: h, state } = home();
  mkdirSync(join(state, "spool"), { recursive: true });
  const batch = (seq) => JSON.stringify({ machine: "kevin-omarchy", card: "CAT-5", sessionId: "sid-1", seq, events: [{ type: "text", seq, text: `e${seq}` }] });
  const file = join(state, "spool", "sid-1.jsonl");
  writeFileSync(file, `${batch(0)}\n${batch(1)}\n`);
  const b = board();
  await b.up();
  const url = b.url();
  await b.down();
  const env = { HOME: h, PATH: "/usr/bin:/bin", FACTORY_INGEST_TOKEN: TOKEN, FACTORY_INGEST_URL: url };
  let r = spawnSync(process.execPath, [STREAM, "drain"], { encoding: "utf8", env });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(read(file).trim().split("\n").length, 2, "board down: the spool must stay");
  await b.up();
  const run = () => new Promise((res) => spawn(process.execPath, [STREAM, "drain"], { env }).on("close", res));
  assert.equal(await run(), 0);
  assert.deepEqual(b.bodies.map((x) => x.seq), [0, 1]);
  assert.ok(!existsSync(file));
  await b.down();
});

// ---- Heartbeat (checklist 7).

function heartbeatHome(timerActive) {
  const x = home();
  // Each timer check leaves a line in checks, so a test can see the loop ran.
  writeFileSync(join(x.bin, "systemctl"), `#!/usr/bin/env bash
case "$*" in
  *is-active*claude-factory.timer*) echo x >>${JSON.stringify(join(x.t, "checks"))}; exit ${timerActive ? 0 : 3};;
  *list-units*) printf 'factory-cat-7.service loaded active running x\\nfactory-review-my-repo-pr-4.service loaded active running y\\n';;
esac
exit 0
`, { mode: 0o755 });
  mkdirSync(join(x.state, "stream"), { recursive: true });
  writeFileSync(join(x.state, "stream", "factory-cat-7.json"), JSON.stringify({ card: "CAT-7", repo: "lbl-nextjs", startedAt: "2026-11-03T10:00:00Z", sessionId: "s" }));
  writeFileSync(join(x.state, "pass.json"), JSON.stringify({ lastPassAt: "2026-11-03T10:05:00-05:00", lastPassResult: "ok", runningCap: 2, reviewWaiting: 1, reviewCap: 3 }));
  return x;
}

// CAT-1510: the first status event says what the session is for.
async function firstStatus(args, extraState) {
  const { t, home: h, state } = home();
  const b = board();
  await b.up();
  const fake = join(t, "fake-claude");
  writeFileSync(fake, `#!/usr/bin/env node\nconsole.log(JSON.stringify({ type: "result", subtype: "success", is_error: false }));\n`, { mode: 0o755 });
  const env = { HOME: h, PATH: `${NODE_DIR}:/usr/bin:/bin`, FACTORY_INGEST_TOKEN: TOKEN, FACTORY_INGEST_URL: b.url(), FACTORY_STREAM_FLUSH_MS: "50" };
  const code = await new Promise((res) => spawn(process.execPath, [STREAM, "run", ...args, "--", fake, "-p", "x"], { env }).on("close", res));
  assert.equal(code, 0);
  const statuses = b.bodies.flatMap((x) => x.events).filter((e) => e.type === "status");
  await b.down();
  return { statuses, state };
}

test("the first status event carries kind, pr and repo; an outside review adds author and dependency", async () => {
  let r = await firstStatus(["--unit", "factory-review-my-repo-pr-88", "--card", "", "--repo", "my-repo", "--kind", "review", "--pr", "88", "--author", "dependabot[bot]", "--dependency", "true"]);
  const [rev] = r.statuses;
  assert.equal(rev.stage, "review");
  assert.equal(rev.card, null);
  assert.deepEqual({ kind: rev.kind, pr: rev.pr, repo: rev.repo, author: rev.author, dependency: rev.dependency }, { kind: "review", pr: 88, repo: "my-repo", author: "dependabot[bot]", dependency: true });
  assert.equal(r.statuses[1].kind, undefined, "only the first event carries them");
  assert.equal(JSON.parse(read(join(r.state, "stream", "factory-review-my-repo-pr-88.json"))).pr, 88);

  r = await firstStatus(["--unit", "factory-review-my-repo-pr-9", "--repo", "my-repo", "--kind", "review", "--pr", "9", "--author", "kev"]);
  assert.equal(r.statuses[0].author, "kev");
  assert.equal(r.statuses[0].dependency, undefined);

  r = await firstStatus(["--unit", "factory-conflict-my-repo-pr-21", "--repo", "my-repo", "--kind", "conflict", "--pr", "21"]);
  assert.deepEqual({ stage: r.statuses[0].stage, kind: r.statuses[0].kind, pr: r.statuses[0].pr, repo: r.statuses[0].repo, author: r.statuses[0].author }, { stage: "conflict", kind: "conflict", pr: 21, repo: "my-repo", author: undefined });

  r = await firstStatus(["--unit", "factory-cat-5", "--card", "CAT-5", "--repo", "my-repo", "--kind", "build"]);
  assert.deepEqual({ stage: r.statuses[0].stage, kind: r.statuses[0].kind, card: r.statuses[0].card, repo: r.statuses[0].repo }, { stage: "start", kind: "build", card: "CAT-5", repo: "my-repo" });
  assert.ok(!("pr" in r.statuses[0]));
});

test("with no --kind the stream falls back to the unit name; a --kind review makes a reviewer", async () => {
  for (const [unit, kind] of [["factory-review-my-repo-pr-3", "review"], ["factory-review-cat-4", "review"], ["factory-conflict-my-repo-pr-3", "conflict"], ["factory-ci-my-repo-pr-3", "ci"], ["factory-retro-cat-4", "retro"], ["factory-cat-4", "build"], ["whatever", "build"]]) {
    assert.equal(S.kindOf(undefined, unit), kind, unit);
  }
  assert.equal(S.kindOf("bogus", "factory-ci-x-pr-1"), "ci");
  assert.equal(S.kindOf("review", "factory-cat-4"), "review");
  const old = await firstStatus(["--unit", "factory-conflict-my-repo-pr-21", "--repo", "my-repo"]);
  assert.equal(old.statuses[0].kind, "conflict");
  assert.equal(old.statuses[0].stage, "conflict");
  // Role follows --kind: a review kind on a build-style unit name starts at review.
  const rev = await firstStatus(["--unit", "factory-cat-6", "--kind", "review"]);
  assert.equal(rev.statuses[0].stage, "review");
  assert.equal(rev.statuses[0].note, "reviewer session started");
});

test("the dispatcher's six launch sites pass their kind, pr and (outside review) author and dependency", () => {
  const src = read(DISPATCH);
  const sites = src.split("\n").filter((l) => /\brun_unit "/.test(l) && !l.startsWith("run_unit()"));
  assert.equal(sites.length, 6, sites.join("\n"));
  const has = (re) => assert.equal(sites.filter((l) => re.test(l)).length, 1, `${re}\n${sites.join("\n")}`);
  has(/^\s*RUN_KIND=build run_unit "factory-\$key"/);
  has(/^\s*RUN_KIND=review RUN_PR=\$number run_unit "factory-review-\$key"/);
  has(/^\s*RUN_KIND=conflict RUN_PR=\$number run_unit "\$name"/);
  has(/^\s*RUN_KIND=ci RUN_PR=\$number run_unit "\$name"/);
  has(/^\s*RUN_KIND=review RUN_PR=\$number RUN_AUTHOR=\$author RUN_DEP=\$dep run_unit "\$name"/);
  has(/^\s*RUN_KIND=retro RUN_PR=\$number run_unit "\$name"/);
  assert.match(src, /--kind "\$RUN_KIND"/);
  assert.match(src, /--pr "\$RUN_PR"/);
});

test("the heartbeat carries the machine's state and no env values or tokens", async () => {
  const x = heartbeatHome(true);
  const b = board();
  await b.up();
  const env = { HOME: x.home, PATH: `${x.bin}:/usr/bin:/bin`, FACTORY_INGEST_TOKEN: TOKEN, FACTORY_INGEST_URL: b.url(), SOME_SECRET: "zzzzzzzzzzzz" };
  const code = await new Promise((res) => spawn(process.execPath, [STREAM, "heartbeat", "--once"], { env }).on("close", res));
  assert.equal(code, 0);
  assert.equal(b.bodies.length, 1);
  const body = b.bodies[0];
  assert.equal(body.sessionId, null);
  assert.equal(body.machine, "kevin-omarchy");
  const [hb] = body.events;
  assert.equal(hb.type, "heartbeat");
  assert.ok(!Number.isNaN(Date.parse(hb.at)));
  assert.deepEqual(
    { ...hb, at: undefined },
    {
      type: "heartbeat", at: undefined, machine: "kevin-omarchy", dispatcher: "running", pausedUntil: null,
      lastPassAt: "2026-11-03T10:05:00-05:00", lastPassResult: "ok", runningCap: 2,
      running: [{ card: "CAT-7", kind: "build", pr: null, repo: "lbl-nextjs", startedAt: "2026-11-03T10:00:00Z" }, { card: null, kind: "review", pr: null, repo: null, startedAt: null }],
      reviewWaiting: 1, reviewCap: 3, installed: null, control: "local", controlVersion: null,
    },
  );
  const s = JSON.stringify(body);
  assert.ok(!s.includes(TOKEN) && !s.includes("zzzzzzzzzzzz"));
  // Paused shows as paused.
  writeFileSync(join(x.state, "paused"), "");
  assert.equal(S.heartbeatSnapshot({ HOME: x.home, PATH: env.PATH }).dispatcher, "paused");
  await b.down();
});

test("the heartbeat posts again within a tick of a change, and not at all while the dispatcher timer is stopped", async () => {
  for (const active of [true, false]) {
    const x = heartbeatHome(active);
    const b = board();
    await b.up();
    const env = {
      HOME: x.home, PATH: `${x.bin}:/usr/bin:/bin`, FACTORY_INGEST_TOKEN: TOKEN, FACTORY_INGEST_URL: b.url(),
      FACTORY_HEARTBEAT_TICK_MS: "100", FACTORY_HEARTBEAT_EVERY_MS: "600000",
    };
    const p = spawn(process.execPath, [STREAM, "heartbeat"], { env });
    const checks = () => (existsSync(join(x.t, "checks")) ? read(join(x.t, "checks")).split("\n").length - 1 : 0);
    // Several ticks have run (not a fixed sleep: a slow start only waits longer).
    await until(() => checks() >= 4, 10_000, "heartbeat ticks");
    if (active) {
      assert.equal(b.bodies.length, 1, "one post, then quiet while nothing changes");
      writeFileSync(join(x.state, "pass.json"), JSON.stringify({ lastPassAt: "2026-11-03T10:10:00-05:00", lastPassResult: "ok: started CAT-8", runningCap: 2, reviewWaiting: 1, reviewCap: 3 }));
      await until(() => b.bodies.length === 2, 2_000, "a heartbeat after the change");
      assert.equal(b.bodies[1].events[0].lastPassResult, "ok: started CAT-8");
    } else {
      assert.equal(b.bodies.length, 0, "a stopped dispatcher must go silent");
    }
    p.kill();
    await b.down();
  }
});

test("the heartbeat unit starts and stops with the dispatcher timer; Remote Control sessions never get the token", () => {
  const unit = read(join(FACTORY, "systemd", "claude-factory-heartbeat.service"));
  assert.match(unit, /^PartOf=claude-factory\.timer$/m);
  assert.match(unit, /^WantedBy=claude-factory\.timer$/m);
  assert.match(unit, /^ExecStart=%h\/\.local\/bin\/claude-factory-stream heartbeat$/m);
  assert.match(read(join(FACTORY, "systemd", "claude-rc@.service")), /^UnsetEnvironment=.*\bFACTORY_INGEST_TOKEN\b/m);
  const install = read(join(FACTORY, "install.sh"));
  assert.match(install, /for f in claude-factory-dispatch claude-factory-stream( claude-factory-[a-z-]+)*; do/);
  assert.doesNotMatch(install, /echo[^\n]*\$FACTORY_INGEST_TOKEN|\$\{FACTORY_INGEST_TOKEN/, "install.sh must never print the token");
});

// ---- Dispatcher (checklists 1 and 6).

function dispatcherHome() {
  const x = home();
  const repo = join(x.t, "my-repo");
  mkdirSync(repo);
  writeFileSync(join(x.home, ".config/claude-factory/repos.conf"), `label kevin-omarchy\n${repo} proj\n`);
  // No PRs anywhere: counts are 0, lists are empty.
  writeFileSync(join(x.bin, "gh"), '#!/bin/sh\ncase "$*" in *"--jq length"*) echo 0;; esac\n', { mode: 0o755 });
  writeFileSync(join(x.bin, "systemctl"), `#!/usr/bin/env bash
case "$*" in
  *list-units*) [ -n "$UNITS" ] && printf '%b' "$UNITS";;
  *show*) echo "Tue 2026-11-03 10:00:00 EST";;
  *is-active*) exit 3;;
esac
exit 0
`, { mode: 0o755 });
  writeFileSync(join(x.bin, "systemd-run"), `#!/usr/bin/env bash\nprintf '%s\\n' "$@" >${JSON.stringify(join(x.t, "systemd-run.args"))}\n`, { mode: 0o755 });
  writeFileSync(join(x.bin, "claude"), `#!/usr/bin/env bash\n[ -n "$FACTORY_INGEST_TOKEN" ] && echo leaked >>${JSON.stringify(join(x.t, "claude-saw-token"))}\necho "\${PICK:-NONE}"\n`, { mode: 0o755 });
  writeFileSync(join(x.bin, "stream"), `#!/usr/bin/env bash\necho "$1 token=\${FACTORY_INGEST_TOKEN:+set}" >>${JSON.stringify(join(x.t, "stream-calls"))}\n`, { mode: 0o755 });
  return { ...x, repo };
}

test("with a token, the dispatcher runs each session under claude-factory-stream and drains spools; the claude calls never see the token", () => {
  const x = dispatcherHome();
  const tick = (extra) => spawnSync("bash", [DISPATCH], {
    encoding: "utf8",
    // The stub streamer is a bash script, so "node" here is bash.
    env: { HOME: x.home, PATH: `${x.bin}:${NODE_DIR}:/usr/bin:/bin`, CLAUDE_BIN: join(x.bin, "claude"), CLAUDE_FACTORY_STREAM: join(x.bin, "stream"), CLAUDE_FACTORY_NODE: "/bin/bash", PICK: "PICK CAT-3 kevin/cat-3-x",
      // The board's control and stages calls go nowhere (a closed local port), never to the real board.
      CLAUDE_FACTORY_CONTROL_URL: "http://127.0.0.1:9/api/machines", CLAUDE_FACTORY_STAGES_URL: "http://127.0.0.1:9/api/factory/stages", ...extra },
  });
  let r = tick({ FACTORY_INGEST_TOKEN: TOKEN });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /started CAT-3/);
  let args = read(join(x.t, "systemd-run.args")).split("\n");
  const at = args.indexOf(join(x.bin, "stream"));
  assert.ok(at > 0, args.join(" "));
  // node by its real path, then the streamer.
  assert.deepEqual(args.slice(at - 1, at + 12), ["/bin/bash", join(x.bin, "stream"), "run", "--unit", "factory-cat-3", "--card", "CAT-3", "--repo", "my-repo", "--kind", "build", "--", join(x.bin, "claude")]);
  assert.ok(args.includes("--property=UnsetEnvironment=ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN"));
  assert.equal(read(join(x.t, "stream-calls")), "drain token=set\n");
  assert.ok(!existsSync(join(x.t, "claude-saw-token")), "a claude call got the token");
  const pass = JSON.parse(read(join(x.state, "pass.json")));
  assert.equal(pass.lastPassResult, "ok: started CAT-3");
  assert.equal(pass.runningCap, 2);
  assert.equal(pass.reviewWaiting, 0);
  assert.equal(pass.reviewCap, 3);
  assert.ok(!Number.isNaN(Date.parse(pass.lastPassAt)));

  // No token: claude runs directly and the unit drops the token; nothing is drained.
  r = tick({ PICK: "PICK CAT-4 kevin/cat-4-x" });
  assert.equal(r.status, 0, r.stderr);
  args = read(join(x.t, "systemd-run.args")).split("\n");
  assert.ok(!args.includes(join(x.bin, "stream")));
  assert.ok(args.includes("--property=UnsetEnvironment=ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN FACTORY_INGEST_TOKEN"));
  assert.equal(read(join(x.t, "stream-calls")), "drain token=set\n");

  // Paused: the pass says so.
  writeFileSync(join(x.state, "paused"), "");
  r = tick({});
  assert.equal(JSON.parse(read(join(x.state, "pass.json"))).lastPassResult, "paused");
});

test("status --json shows per running card the last seq sent and the spool length", () => {
  const x = dispatcherHome();
  mkdirSync(join(x.state, "stream"), { recursive: true });
  writeFileSync(join(x.state, "stream", "factory-cat-9.json"), JSON.stringify({ card: "CAT-9", repo: "my-repo", sessionId: "sid-9", lastSeq: 41, spoolEvents: 7 }));
  const r = spawnSync("bash", [DISPATCH, "status", "--json"], {
    encoding: "utf8",
    env: {
      HOME: x.home, PATH: `${x.bin}:/usr/bin:/bin`, CLAUDE_BIN: join(x.bin, "claude"),
      UNITS: "factory-cat-9.service loaded active running a\\nfactory-review-cat-2.service loaded active running b\\n",
    },
  });
  assert.equal(r.status, 0, r.stderr);
  const s = JSON.parse(r.stdout);
  assert.equal(s.paused, false);
  assert.equal(s.cap, 2);
  assert.equal(s.streaming, false);
  assert.deepEqual(s.running, [
    { unit: "factory-cat-9", card: "CAT-9", repo: "my-repo", since: "Tue 2026-11-03 10:00:00 EST", sessionId: "sid-9", lastSeq: 41, spool: 7 },
    { unit: "factory-review-cat-2", card: "CAT-2", repo: null, since: "Tue 2026-11-03 10:00:00 EST", sessionId: null, lastSeq: null, spool: null },
  ]);
  assert.equal(basename(DISPATCH), "claude-factory-dispatch");
});

// ---- Review fixes (CAT-1442 /review): what the first version let through.

test("env dumps, file prints and Grep content are not sent; only their size is", () => {
  const calls = [
    ["Bash", { command: "env" }],
    ["Bash", { command: "env | sort" }],
    ["Bash", { command: "set" }],
    ["Bash", { command: "export" }],
    ["Bash", { command: "systemctl --user show-environment" }],
    ["Bash", { command: "node -e \"console.log(process.env)\"" }],
    ["Bash", { command: "python3 -c 'import os; print(os.environ)'" }],
    ["Bash", { command: "cat app.env" }],
    ["Bash", { command: "cat .envrc" }],
    ["Bash", { command: "cat .dev.vars" }],
    ["Bash", { command: "cat ~/.config/environment.d/70-factory-ingest.conf" }],
    ["Bash", { command: "cat src/config.ts" }],
    ["Bash", { command: "head -n 20 README.md" }],
    ["Bash", { command: "sed -n 1,40p factory/install.sh" }],
    ["Grep", { pattern: "x", output_mode: "content" }],
  ];
  for (const [name, input] of calls) {
    const ctx = { tools: new Map() };
    S.sanitizeEvent({ type: "assistant", message: { content: [{ type: "tool_use", id: "a", name, input }] } }, ctx);
    const r = S.sanitizeEvent({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "a", content: "PLAIN=visible-value\nmore" }] } }, ctx);
    const s = JSON.stringify(r);
    assert.doesNotMatch(s, /visible-value/, `${name} ${JSON.stringify(input)} was sent`);
    assert.match(s, /not sent: \d+ bytes/);
    assert.equal(ctx.tools.size, 0, "a call is forgotten once its result is in");
  }
  // Ordinary commands and Grep listings still show their output.
  for (const [name, input] of [["Bash", { command: "npm test" }], ["Bash", { command: "git status" }], ["Grep", { pattern: "x", output_mode: "files_with_matches" }], ["Bash", { command: "settle --env-free" }]]) {
    const ctx = { tools: new Map() };
    S.sanitizeEvent({ type: "assistant", message: { content: [{ type: "tool_use", id: "a", name, input }] } }, ctx);
    const r = S.sanitizeEvent({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "a", content: "ok 12 tests" }] } }, ctx);
    assert.match(JSON.stringify(r), /ok 12 tests/, `${input.command ?? input.output_mode} was hidden`);
  }
});

test("secrets under lower-case or short names and passwordless-user URLs are masked; names that only contain a word are not", () => {
  const s = S.scrub([
    "password: hunter2xyz",
    "api_key = abcdef123456",
    "secret_key: abcd1234efgh",
    "DB_PASS=hunter3xyz",
    '"apiKey": "k-123456789"',
    "REDIS_URL=redis://:hunter4pass@host:6379",
    "whsec_abcdefghijklmnopqrstu",
  ].join("\n"));
  for (const v of ["hunter2xyz", "abcdef123456", "abcd1234efgh", "hunter3xyz", "k-123456789", "hunter4pass", "whsec_abcdefghijklmnopq"]) assert.ok(!s.includes(v), `${v} in ${s}`);
  // Whole segments only: these stay readable on the board.
  const plain = "author: Kevin\nkeyboard: us\nmonkey=1\nmonorepo: yes";
  assert.equal(S.scrub(plain), plain);
  // Env values only for names that say secret: the author's name and the desktop are not.
  const known = S.secretValues({ GIT_AUTHOR_NAME: "Kevin Townsend", DESKTOP_SESSION: "hyprland", SSH_AUTH_SOCK: "/run/user/1000/ssh", DB_PASS: "pw-123456789" });
  assert.deepEqual(known, ["pw-123456789"]);
});

test("masking a huge string costs the session nothing: it looks at the first 8 KB", () => {
  const shapes = ["a1b2".repeat(25_000), "A_KEYB".repeat(20_000), "AKEYB".repeat(20_000), "a-".repeat(50_000), "token".repeat(20_000)];
  for (const big of shapes) {
    const t0 = performance.now();
    const out = S.sanitizeEvent({ type: "assistant", message: { content: [{ type: "text", text: big }] } });
    const ms = performance.now() - t0;
    // gstack-timing-ok: the card's own bound (under 50 ms per batch on the session's side); the regex cost is the behavior under test.
    assert.ok(ms < 50, `${big.slice(0, 8)}… took ${ms.toFixed(0)} ms`);
    assert.ok(Buffer.byteLength(out.message.content[0].text) <= S.MAX_FIELD_BYTES);
  }
});

async function outbox(answer, extra = {}) {
  const { home: h, state } = home();
  const b = board(answer);
  await b.up();
  const box = new S.Outbox({ url: b.url(), token: TOKEN, machine: "kevin-omarchy", card: "CAT-1", sessionId: "sid-x", env: { HOME: h }, timeoutMs: 1000, ...extra });
  return { b, box, state, spool: join(state, "spool", "sid-x.jsonl"), rejected: join(state, "spool", "sid-x.rejected.jsonl") };
}
const events = (n, from = 0) => Array.from({ length: n }, (_, i) => ({ type: "text", text: `e${from + i}` }));

test("outbox: a 413 batch is split and resent in order; a single event the board can't take is put aside and the rest still go", async () => {
  // More than 10 events in one batch is too large; e7 alone is always refused.
  const { b, box, spool, rejected } = await outbox((body) => (body.events.length > 10 ? 413 : body.events.some((e) => e.text === "e7") ? 400 : 202));
  for (const e of events(40)) box.push(e);
  await box.flush(5_000);
  const seqs = b.bodies.flatMap((x) => x.events.map((e) => e.seq));
  assert.deepEqual(seqs, [...seqs].sort((p, q) => p - q), "split batches went out of order");
  assert.ok(b.tried.some((x) => x.events.length === 40), "the first try was the whole batch");
  for (const x of b.bodies) assert.equal(x.seq, x.events[0].seq);
  const rej = read(rejected).trim().split("\n").map((l) => JSON.parse(l));
  assert.ok(rej.every((x) => x.events.some((e) => e.text === "e7")));
  // Everything but the refused batch arrived.
  const refused = new Set(rej.flatMap((x) => x.events.map((e) => e.seq)));
  assert.deepEqual(seqs.concat([...refused]).sort((p, q) => p - q), Array.from({ length: 40 }, (_, i) => i));
  assert.ok(!existsSync(spool));
  assert.equal(box.spoolEvents, 0);
  await b.down();
});

test("outbox: a 503 or a refused token keeps the batch spooled and retries later (a minute for the token); the spool file is private", async () => {
  let n = 0;
  const { b, box, spool } = await outbox(() => (++n === 1 ? 503 : 202));
  for (const e of events(3)) box.push(e);
  box.cut();
  await until(() => b.tried.length === 1, 5_000, "first try");
  await sleep(50);
  assert.equal(box.queue.length, 1, "a 503 dropped the batch");
  assert.equal(statSync(spool).mode & 0o777, 0o600);
  assert.equal(statSync(dirname(spool)).mode & 0o777, 0o700);
  assert.ok(box.backoffUntil - Date.now() > 1_000, "no backoff after a 503");
  await box.flush(5_000);
  assert.equal(b.bodies.length, 1);
  assert.ok(!existsSync(spool));
  await b.down();

  const auth = await outbox(() => 401);
  for (const e of events(2)) auth.box.push(e);
  auth.box.cut();
  await until(() => auth.b.tried.length === 1, 5_000, "first try");
  await sleep(50);
  assert.ok(auth.box.backoffUntil - Date.now() > 55_000, "a refused token must wait a minute");
  assert.equal(read(auth.spool).trim().split("\n").length, 1);
  await auth.b.down();
});

test("outbox: the spool is rewritten every 25 acks, not on every ack; batches sent twice are duplicates the board ignores", async () => {
  const { b, box, spool } = await outbox(() => 202);
  const writes = [];
  const orig = box.rewriteSpool.bind(box);
  box.rewriteSpool = () => {
    writes.push(box.queue.length);
    orig();
  };
  for (let i = 0; i < 60; i++) {
    for (const e of events(1, i)) box.push(e);
    box.cut();
  }
  await box.flush(10_000);
  assert.equal(b.bodies.length, 60);
  assert.ok(writes.length <= 4, `${writes.length} rewrites for 60 acks`);
  assert.ok(!existsSync(spool));
  await b.down();
});

test("a session keeps running when streaming can't write its state: it falls back to running plain", () => {
  const { t, home: h } = home();
  const fake = join(t, "fake");
  writeFileSync(fake, "#!/bin/sh\necho '{\"type\":\"result\",\"result\":\"done\"}'\n", { mode: 0o755 });
  const notADir = join(t, "a-file");
  writeFileSync(notADir, "");
  const r = spawnSync(process.execPath, [STREAM, "run", "--unit", "factory-cat-2", "--", fake, "--output-format", "text", "p"], {
    encoding: "utf8",
    env: { HOME: h, PATH: "/usr/bin:/bin", FACTORY_INGEST_TOKEN: TOKEN, FACTORY_INGEST_URL: "http://127.0.0.1:9/", CLAUDE_FACTORY_STATE: notADir, FACTORY_STREAM_FINAL_MS: "300" },
  });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /"result":"done"/);
  assert.match(r.stderr, /could not/);
});

test("drain: skips a session still streaming, splits a 413, keeps the rest on a 503, oldest session first", async () => {
  const { home: h, state } = home();
  const dir = join(state, "spool");
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(state, "stream"), { recursive: true });
  const batch = (sid, seq, n = 1) => JSON.stringify({ machine: "kevin-omarchy", card: "CAT-5", sessionId: sid, seq, events: Array.from({ length: n }, (_, i) => ({ type: "text", seq: seq + i })) });
  writeFileSync(join(dir, "zzz-old.jsonl"), `${batch("zzz-old", 0, 4)}\n${batch("zzz-old", 4)}\n`);
  writeFileSync(join(dir, "aaa-new.jsonl"), `${batch("aaa-new", 0)}\n`);
  writeFileSync(join(dir, "live.jsonl"), `${batch("live", 0)}\n`);
  // zzz-old is older than aaa-new, whatever their names say.
  utimesSync(join(dir, "zzz-old.jsonl"), new Date(Date.now() - 60_000), new Date(Date.now() - 60_000));
  writeFileSync(join(state, "stream", "factory-cat-9.json"), JSON.stringify({ sessionId: "live", pid: process.pid }));
  const b = board((body) => (body.events.length > 2 ? 413 : 202));
  await b.up();
  const env = { HOME: h, PATH: "/usr/bin:/bin", FACTORY_INGEST_TOKEN: TOKEN, FACTORY_INGEST_URL: b.url() };
  const run = () => new Promise((res) => spawn(process.execPath, [STREAM, "drain"], { env }).on("close", res));
  assert.equal(await run(), 0);
  assert.deepEqual(b.bodies.map((x) => `${x.sessionId}:${x.events.map((e) => e.seq).join(",")}`), ["zzz-old:0,1", "zzz-old:2,3", "zzz-old:4", "aaa-new:0"]);
  assert.ok(existsSync(join(dir, "live.jsonl")), "a live session's spool was touched");
  assert.ok(!existsSync(join(dir, "zzz-old.jsonl")) && !existsSync(join(dir, "aaa-new.jsonl")));
  await b.down();

  // 503: the file stays as it is, nothing put aside.
  writeFileSync(join(dir, "s503.jsonl"), `${batch("s503", 0)}\n${batch("s503", 1)}\n`);
  const down = board(() => 503);
  await down.up();
  assert.equal(await new Promise((res) => spawn(process.execPath, [STREAM, "drain"], { env: { ...env, FACTORY_INGEST_URL: down.url() } }).on("close", res)), 0);
  assert.equal(read(join(dir, "s503.jsonl")).trim().split("\n").length, 2);
  assert.ok(!existsSync(join(dir, "s503.rejected.jsonl")));
  await down.down();
});

test("the heartbeat without a token sends nothing and exits, so systemd restarts it with the current environment", async () => {
  const x = heartbeatHome(true);
  const b = board();
  await b.up();
  const env = { HOME: x.home, PATH: `${x.bin}:/usr/bin:/bin`, FACTORY_INGEST_URL: b.url(), FACTORY_HEARTBEAT_RESTART_MS: "50" };
  assert.equal(await new Promise((res) => spawn(process.execPath, [STREAM, "heartbeat"], { env }).on("close", res)), 0);
  // A token the board refuses: it exits too (non-zero), after the restart wait.
  const refusing = board(() => 401);
  await refusing.up();
  const code = await new Promise((res) => spawn(process.execPath, [STREAM, "heartbeat"], { env: { ...env, FACTORY_INGEST_TOKEN: TOKEN, FACTORY_INGEST_URL: refusing.url() } }).on("close", res));
  assert.equal(code, 1);
  assert.equal(b.bodies.length, 0);
  await b.down();
  await refusing.down();
});

// ---- Second review pass.

test("a process the session leaves behind holding its stdout does not keep the streamer running", async () => {
  const { t, home: h } = home();
  const fake = join(t, "fake");
  // The background sleep inherits stdout and keeps the pipe open after the session exits.
  writeFileSync(fake, "#!/bin/sh\n(sleep 8) &\necho '{\"type\":\"result\",\"subtype\":\"success\"}'\n", { mode: 0o755 });
  const b = board();
  await b.up();
  try {
    const t0 = Date.now();
    // stderr ignored: the leftover holds the streamer's stderr too, and a pipe here would wait for it.
    const p = spawn(process.execPath, [STREAM, "run", "--unit", "factory-cat-3", "--", fake, "--output-format", "text", "p"], {
      stdio: ["ignore", "ignore", "ignore"],
      env: { HOME: h, PATH: "/usr/bin:/bin", FACTORY_INGEST_TOKEN: TOKEN, FACTORY_INGEST_URL: b.url(), FACTORY_STREAM_CLOSE_MS: "300", FACTORY_STREAM_FLUSH_MS: "100" },
    });
    const code = await new Promise((res) => p.on("exit", res));
    assert.equal(code, 0);
    // gstack-timing-ok: the leftover sleeps 8 s; the streamer must end long before it.
    assert.ok(Date.now() - t0 < 6_000, `the streamer waited ${Date.now() - t0} ms for the leftover`);
    const stages = b.bodies.flatMap((x) => x.events).filter((e) => e.type === "status").map((e) => e.stage);
    assert.deepEqual(stages, ["start", "end"]);
  } finally {
    await b.down();
  }
});

test("a denied call's input, more env dumps and background output reads are not sent", () => {
  const denied = S.sanitizeEvent({ type: "result", subtype: "success", permission_denials: [{ tool_name: "Write", tool_use_id: "w", tool_input: { file_path: "/w/.env.local", content: "PG=hunter2secret\nOTHER=abcd" } }] });
  assert.doesNotMatch(JSON.stringify(denied), /hunter2secret/);
  assert.equal(denied.permission_denials[0].tool_input.file_path, "/w/.env.local");
  for (const command of ["env -0", "env --null | tr", "export -p", "typeset -x", "ps eww", "echo $(env)"]) {
    const ctx = { tools: new Map() };
    S.sanitizeEvent({ type: "assistant", message: { content: [{ type: "tool_use", id: "a", name: "Bash", input: { command } }] } }, ctx);
    const r = S.sanitizeEvent({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "a", content: "X=visible-value" }] } }, ctx);
    assert.doesNotMatch(JSON.stringify(r), /visible-value/, command);
  }
  // printenv in the background, read back later: still not sent.
  const ctx = { tools: new Map() };
  S.sanitizeEvent({ type: "assistant", message: { content: [{ type: "tool_use", id: "bg", name: "Bash", input: { command: "printenv", run_in_background: true } }] } }, ctx);
  S.sanitizeEvent({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "bg", content: "started shell 7" }] } }, ctx);
  S.sanitizeEvent({ type: "assistant", message: { content: [{ type: "tool_use", id: "o", name: "TaskOutput", input: { task_id: "7" } }] } }, ctx);
  const out = S.sanitizeEvent({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "o", content: "X=visible-value" }] } }, ctx);
  assert.doesNotMatch(JSON.stringify(out), /visible-value/);
});

test("more secret shapes are masked; ordinary code and commands stay readable", () => {
  const s = S.scrub([
    "PGPASSWORD=pgsecret123",
    "curl -u admin:curlpw123 https://x",
    "mysql -pMysqlPw123 db",
    "tool --password FlagPw123",
    "Authorization: Basic dXNlcjpwYXNzd29yZA==",
    "accessToken = camel-tok-123",
    '{"refreshToken": "refresh-123456"}',
    "glpat-abcdefghijklmnopqrstu",
    "AIzaSyA1234567890abcdefghijklmnopqrstuv",
    "sb_secret_abcdefghijklmnop1234",
    "https://hooks.slack.com/services/T000/B000/abcdefghijklmnopqrstuvwx",
    'TOKEN="unterminated-value-123',
  ].join("\n"));
  for (const v of ["pgsecret123", "curlpw123", "MysqlPw123", "FlagPw123", "dXNlcjpwYXNzd29yZA", "camel-tok-123", "refresh-123456", "glpat-abc", "AIzaSyA123", "sb_secret_abc", "abcdefghijklmnopqrstuvwx", "unterminated-value-123"]) {
    assert.ok(!s.includes(v), `${v} in:\n${s}`);
  }
  const plain = "const key = items[i].id;\n<li key={id}>\npass_rate: 0.9\nauth: required\nmonkey=1";
  assert.equal(S.scrub(plain), plain);
  assert.equal(S.secretValues({ PWD: "/home/someone/project" }).length, 0);
  // An edit of code that reads process.env, jq on a .key field, a commit ending in "set": output shown.
  for (const [name, input] of [
    ["Edit", { file_path: "src/env.ts", old_string: "a", new_string: "const u = process.env.URL; import.meta.env.X" }],
    ["Bash", { command: "jq -r .key package.json" }],
    ["Bash", { command: "git commit -m 'make the default set'" }],
  ]) {
    const ctx = { tools: new Map() };
    const use = S.sanitizeEvent({ type: "assistant", message: { content: [{ type: "tool_use", id: "a", name, input }] } }, ctx);
    const r = S.sanitizeEvent({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "a", content: "all-good-output" }] } }, ctx);
    assert.match(JSON.stringify(r), /all-good-output/, `${name} ${JSON.stringify(input)}`);
    if (name === "Edit") assert.match(use.message.content[0].input.new_string, /process\.env\.URL/);
  }
  // A file print after another command is still file contents.
  const ctx = { tools: new Map() };
  S.sanitizeEvent({ type: "assistant", message: { content: [{ type: "tool_use", id: "a", name: "Bash", input: { command: "git status && cat src/x.ts" } }] } }, ctx);
  assert.match(JSON.stringify(S.sanitizeEvent({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "a", content: "secret code" }] } }, ctx)), /file contents not sent/);
});

test("the spool is replaced whole: a failed rewrite leaves the old spool, never a half file", async () => {
  const { b, box, spool } = await outbox(() => 503);
  for (const e of events(3)) box.push(e);
  box.cut();
  await until(() => b.tried.length === 1, 5_000, "first try");
  const before = read(spool);
  // A directory where the temporary file would go makes the write fail.
  mkdirSync(`${spool}.${process.pid}.tmp`);
  box.rewriteSpool();
  assert.equal(read(spool), before);
  await b.down();
});

// Fresh-review findings on PR #23: shapes that slipped past the trust boundary.
const resultOf = (name, input, content) => {
  const ctx = { tools: new Map() };
  S.sanitizeEvent({ type: "assistant", message: { content: [{ type: "tool_use", id: "r", name, input }] } }, ctx);
  return JSON.stringify(S.sanitizeEvent({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "r", content }] } }, ctx));
};

test("text past the 8 KB masking window is never sent, even when masking shrinks what came before it", () => {
  const key = "-----BEGIN RSA PRIVATE KEY-----\n" + ("A".repeat(64) + "\n").repeat(150) + "-----END RSA PRIVATE KEY-----\n";
  const tail = "GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz0123";
  for (const s of [
    resultOf("Bash", { command: "openssl genrsa" }, "openssl output:\n" + key),
    JSON.stringify(S.sanitizeEvent({ type: "assistant", message: { content: [{ type: "text", text: "k:\n" + key + tail }] } })),
  ]) {
    assert.doesNotMatch(s, /A{64}/, "key body was sent");
    assert.doesNotMatch(s, /ghp_/);
  }
  assert.match(resultOf("Bash", { command: "ls" }, "x".repeat(20_000)), /more bytes not sent/);
});

test("env dumps run through bash -c, sudo, a path or a container are not sent", () => {
  for (const command of ['bash -c "env"', "/usr/bin/env", "sudo env", "docker exec app env", "sudo printenv", 'bash -c "env -u A -i"']) {
    assert.match(resultOf("Bash", { command }, "FOO_ROLE=abcdefghijkl"), /not sent/, command);
  }
  // env as a prefix that runs another command is not a dump.
  assert.match(resultOf("Bash", { command: "env FOO=1 make test" }, "ok 12 tests"), /ok 12 tests/);
});

test("file prints on a later line, after a pipe, in $( ) or via sudo / git -C are not sent", () => {
  for (const command of ["cd x\ncat src/config.ts", "ls | xargs cat", "echo $(cat f)", "(cat f)", "sudo cat f", "time cat f", "git -C dir show HEAD:f", "xargs -0 -n1 cat"]) {
    assert.match(resultOf("Bash", { command }, "const secretSauce = 1"), /file contents not sent/, command);
  }
  for (const command of ["npm test", "npm test 2>&1 | tail -20", "git log | head -5"]) {
    assert.match(resultOf("Bash", { command }, "const secretSauce = 1"), /secretSauce/, command);
  }
});

test("MCP tools that return files, query results or logs are sent as a size only", () => {
  for (const name of ["mcp__claude_ai_Gmail__get_thread", "mcp__claude_ai_Gmail__get_message", "mcp__claude_ai_HubSpot__search_crm_objects", "mcp__claude_ai_Vercel__get_runtime_errors", "mcp__supabase__execute_sql", "mcp__claude_ai_Vercel__get_deployment_file_contents", "mcp__claude_ai_Neon__run_sql", "mcp__claude_ai_Vercel__get_runtime_logs", "mcp__claude_ai_Google_Drive__read_file_content", "mcp__x__download_file"]) {
    assert.match(resultOf(name, { q: "a" }, "someone@example.com"), /not sent/, name);
  }
  for (const name of ["mcp__claude_ai_Linear__get_issue", "mcp__playwright__browser_snapshot", "mcp__airtable__list_bases"]) {
    assert.match(resultOf(name, { id: "CAT-1" }, "Factory machines stream"), /Factory machines stream/, name);
  }
});

test("a tool result's non-text blocks count against its 4 KB too", () => {
  const blocks = Array.from({ length: 10 }, () => ({ type: "resource", resource: { text: "z".repeat(5000) } }));
  const s = resultOf("mcp__x__thing", { q: "a" }, blocks);
  assert.ok(s.length < 2 * S.MAX_FIELD_BYTES, `sent ${s.length} bytes`);
});

test("lower-case bearer values and JSON escaped inside a string are masked", () => {
  for (const h of ["authorization: bearer abcdefghijklmnop123", '"authorization":"bearer abcdefghijklmnop123"']) assert.doesNotMatch(S.scrub(h), /abcdefghijklmnop123/, h);
  assert.doesNotMatch(S.scrub('log: {\\"password\\":\\"hunter2hunter2\\"}'), /hunter2/);
});

test("SHELL_READER stays linear on blank-line runs; heredocs into cat and prose descriptions are not withheld", () => {
  // Commands are not windowed: each ~100 KB shape that was quadratic at first, timed on its own.
  for (const command of ["echo a" + "\n".repeat(100_000) + "b", "x" + "\n \n".repeat(30_000), "env -u ".repeat(14_000) + "!", " env -a".repeat(14_000), "sudo " + "-;sudo ".repeat(14_000) + "X", "sudo " + "-`time ".repeat(14_000) + "X"]) {
    const t0 = performance.now();
    resultOf("Bash", { command }, "ok");
    const ms = performance.now() - t0;
    // gstack-timing-ok: the card's own bound (under 50 ms per batch on the session's side); quadratic backtracking is the regression under test.
    assert.ok(ms < 50, `${command.slice(0, 8)}… took ${ms.toFixed(0)} ms`);
  }
  for (const command of [`git commit -m "$(cat <<'EOF'\nfix it\nEOF\n)"`, "cat > notes.txt <<EOF\nx\nEOF"]) {
    assert.match(resultOf("Bash", { command }, "[main abc123] fix it"), /abc123/, command);
  }
  assert.match(resultOf("Bash", { command: "ls -la", description: "Show env folder" }, "total 8"), /total 8/);
  assert.match(resultOf("Bash", { command: "env -u PATH" }, "FOO_ROLE=abcdefghijkl"), /not sent/);
});

test("secrets as JSON keys, in non-string secret fields, quoted --password values and escaped UPPER names are masked; prose is not", () => {
  const tok = "zq".repeat(20);
  const s = JSON.stringify(S.sanitizeEvent({ type: "assistant", message: { content: [{ type: "tool_use", id: "k", name: "X", input: { payload: { [tok]: "v" }, password: 123456, token: ["not-in-env-zzz"] } }] } }, { tools: new Map() }, [tok]));
  for (const v of [tok, "123456", "not-in-env-zzz"]) assert.ok(!s.includes(v), `${v} was sent`);
  assert.doesNotMatch(S.scrub('client --password "not-an-env-value-123"'), /not-an-env-value/);
  assert.doesNotMatch(S.scrub('{\\"DB_PASS\\": \\"hunter2xyz\\"}'), /hunter2xyz/);
  const prose = "a basic implementation of tokenization; the bearer verification_service uses bearer authentication-v2 scheme";
  assert.equal(S.scrub(prose), prose);
  // Usage counts stay.
  const u = S.sanitizeEvent({ type: "result", usage: { input_tokens: 12, output_tokens: 34 } });
  assert.deepEqual(u.usage, { input_tokens: 12, output_tokens: 34 });
});

test("a tool result has one 4 KB budget in all: images, objects and the blocks past it", () => {
  const imgs = resultOf("X", {}, Array.from({ length: 2000 }, () => ({ type: "image", source: {} })));
  const links = resultOf("X", {}, Array.from({ length: 20_000 }, () => ({ type: "resource_link", uri: "file:///x" })));
  const obj = resultOf("X", {}, { rows: Array.from({ length: 1000 }, () => "r".repeat(400)) });
  for (const x of [imgs, links, obj]) assert.ok(x.length < 2 * S.MAX_FIELD_BYTES, `sent ${x.length} bytes`);
  assert.match(links, /more blocks not sent/);
});

// ---- CAT-1487: installed versions in the heartbeat, skill events.

test("the heartbeat carries installed.json, and --print shows it without sending", () => {
  const home = mkdtempSync(join(tmpdir(), "hb-installed-"));
  const state = join(home, ".local/state/claude-factory");
  mkdirSync(state, { recursive: true });
  const env = { HOME: home, PATH: process.env.PATH, FACTORY_MACHINE: "m1" };
  assert.equal(S.heartbeatSnapshot(env).installed, null);
  const installed = { factorySha: "abc", installedAt: "2026-11-04T00:00:00Z", plugins: { "catalyst-ops": "1.2.3", "design-skill": "0.4.0", gstack: "def" } };
  writeFileSync(join(state, "installed.json"), JSON.stringify(installed));
  assert.deepEqual(S.heartbeatSnapshot(env).installed, installed);
  writeFileSync(join(state, "installed.json"), "{not json");
  assert.equal(S.heartbeatSnapshot(env).installed, null);
  writeFileSync(join(state, "installed.json"), JSON.stringify(installed));
  const r = spawnSync(process.execPath, [STREAM, "heartbeat", "--print"], { env, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.type, "heartbeat");
  assert.deepEqual(out.installed, installed);
});

test("a Skill tool call becomes a skill event with the skill's name", () => {
  const ev = (...blocks) => ({ type: "assistant", message: { content: blocks } });
  const skill = (s) => ({ type: "tool_use", id: "t", name: "Skill", input: { skill: s } });
  assert.deepEqual(S.skillsUsed(ev(skill("review"), { type: "text", text: "x" }, skill("catalyst-ops:next"))), ["review", "catalyst-ops:next"]);
  assert.deepEqual(S.skillsUsed(ev(skill("/qa"))), ["qa"]);
  assert.deepEqual(S.skillsUsed(ev({ type: "tool_use", name: "Bash", input: { skill: "review" } })), []);
  assert.deepEqual(S.skillsUsed(ev(skill("a b; rm"))), []);
  assert.deepEqual(S.skillsUsed({ type: "user", message: { content: [skill("review")] } }), []);
  assert.deepEqual(S.skillsUsed(null), []);
});

test("install.sh writes installed.json from the repo, the plugin manifests and gstack", () => {
  const s = read(join(FACTORY, "install.sh"));
  assert.match(s, /installed\.json/);
  assert.match(s, /\.claude-plugin\/plugin\.json/);
  assert.match(s, /rev-parse HEAD/);
});

// ---- CAT-1484: a session cut off by a reboot is shown as ended.

const BOOT = (() => {
  try {
    return readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim();
  } catch {
    return null;
  }
})();

test("state files record this boot's id next to the pid", async (t) => {
  if (!BOOT) return t.skip("no boot id on this OS");
  const { home: h, state, bin } = home();
  writeFileSync(join(bin, "claude"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  const b = board();
  await b.up();
  const env = { HOME: h, PATH: `${bin}:/usr/bin:/bin`, FACTORY_INGEST_TOKEN: TOKEN, FACTORY_INGEST_URL: b.url() };
  const code = await new Promise((res) => spawn(process.execPath, [STREAM, "run", "--unit", "factory-cat-77", "--", "claude", "-p", "x"], { env }).on("close", res));
  assert.equal(code, 0);
  const s = JSON.parse(read(join(state, "stream", "factory-cat-77.json")));
  assert.equal(s.bootId, BOOT);
  await b.down();
});

test("drain ends a session from another boot or with a gone pid, once, after its spool; a live wrapper is untouched", async (t) => {
  if (!BOOT) return t.skip("no boot id on this OS");
  const { home: h, state } = home();
  const dir = join(state, "spool");
  const sdir = join(state, "stream");
  mkdirSync(dir, { recursive: true });
  mkdirSync(sdir, { recursive: true });
  const batch = (sid, seq, n = 1) => JSON.stringify({ machine: "kevin-omarchy", card: "CAT-5", sessionId: sid, seq, events: Array.from({ length: n }, (_, i) => ({ type: "text", seq: seq + i })) });
  const gone = spawnSync("true").pid; // a pid that has exited
  const st = (sessionId, o) => writeFileSync(join(sdir, `${sessionId}.json`), JSON.stringify({ unit: sessionId, card: "CAT-5", sessionId, ...o }));
  // Same pid as a live process, but another boot: the pid was reused.
  st("rebooted", { pid: process.pid, bootId: "00000000-other-boot", lastSeq: 0 });
  writeFileSync(join(dir, "rebooted.jsonl"), `${batch("rebooted", 0)}\n${batch("rebooted", 1, 2)}\n`);
  st("pidgone", { pid: gone, bootId: BOOT, lastSeq: 4 }); // no spool left
  st("alive", { pid: process.pid, bootId: BOOT, lastSeq: 0 });
  writeFileSync(join(dir, "alive.jsonl"), `${batch("alive", 0)}\n`);
  st("clean", { pid: null, bootId: BOOT, lastSeq: 3 });
  const b = board();
  await b.up();
  const env = { HOME: h, PATH: "/usr/bin:/bin", FACTORY_INGEST_TOKEN: TOKEN, FACTORY_INGEST_URL: b.url() };
  const run = () => new Promise((res) => spawn(process.execPath, [STREAM, "drain"], { env }).on("close", res));
  assert.equal(await run(), 0);
  const sent = b.bodies.map((x) => `${x.sessionId}:${x.events.map((e) => (e.stage ? `${e.stage}/${e.note}#${e.seq}` : e.seq)).join(",")}`);
  assert.deepEqual(sent, ["rebooted:0", "rebooted:1,2", "rebooted:end/ended: machine restarted#3", "pidgone:end/ended: process gone#5"]);
  assert.ok(existsSync(join(dir, "alive.jsonl")), "a live wrapper's spool was touched");
  assert.equal(JSON.parse(read(join(sdir, "rebooted.json"))).pid, null);
  assert.equal(JSON.parse(read(join(sdir, "pidgone.json"))).ended, true);
  assert.equal(JSON.parse(read(join(sdir, "alive.json"))).pid, process.pid);
  // Only once.
  assert.equal(await run(), 0);
  assert.equal(b.bodies.length, 4);
  await b.down();

  // Board down: no end sent, not marked; the next tick tries again.
  st("retry", { pid: gone, bootId: BOOT, lastSeq: 0 });
  const down = board(() => 503);
  await down.up();
  await new Promise((res) => spawn(process.execPath, [STREAM, "drain"], { env: { ...env, FACTORY_INGEST_URL: down.url() } }).on("close", res));
  assert.equal(JSON.parse(read(join(sdir, "retry.json"))).pid, gone);
  await down.down();
});
