// CAT-1553: the pickup prompt ranks Ready cards by what they unblock, and
// flags stranded chains. Pinned in the dispatcher source, as the prompt is
// model-read text.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "factory", "bin", "claude-factory-dispatch"), "utf8");
const prompt = src.slice(src.indexOf("pick() {"), src.indexOf("# Starts a transient user unit"));

test("pickup keeps the blocked-skip rule", () => {
  assert.match(prompt, /Skip any issue that is blocked/);
  assert.match(prompt, /not Done, Canceled or Duplicate/);
});

test("pickup ranks by effective priority, then unblock count, then oldest", () => {
  assert.match(prompt, /ranked by effective priority: the highest priority .* of the card itself and of every card it blocks, directly or through a chain, that is not Done, Canceled or Duplicate/);
  assert.match(prompt, /Ties: the card that unblocks more cards first, then oldest first/);
});

test("the claim comment names why ranking changed the pick", () => {
  assert.match(prompt, /Picked first because it unblocks CAT-NNNN/);
});

test("a stranded chain gets one comment per blocker status", () => {
  assert.match(prompt, /blocker is in Backlog, Todo or Blocked/);
  assert.match(prompt, /Waiting on <blocker id>, which is in <status>; move it to Ready For Factory or remove the link\./);
  assert.match(prompt, /unless one already says 'Waiting on <blocker id>, which is in <that status>'/);
});
