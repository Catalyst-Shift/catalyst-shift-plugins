---
name: correct
description: Fix a mistake that has happened twice at the highest level that works (architecture, then types, then a lint whose error names the fix, then a test, then a written rule last and only for judgment calls), prove the check fails on the real past mistake, and record it in the repo's `## Rules and what enforces them` table. Use when a /reflect retro finds something a lint, type, test or script could enforce, or a mistake that repeats one already in the table or in an earlier `retro:` comment, or when Kevin or Keith types /correct. Drops a rule's prose once its mistake can no longer happen. Never adds a gate. Method adapted from Lauren Tan's pstack /correct.
user-invocable: true
---

# /correct — a repeated mistake gets a fix, not another sentence

A written rule is the weakest fix: sessions skim it. Move the mistake out of
reach instead. The rule of thumb is the ladder below; stop at the first rung
that closes the mistake.

## The ladder

1. **Architecture.** Change the shape so the mistake has no place to happen (one function owns it, the wrong call doesn't exist).
2. **Types.** Make the wrong value unrepresentable.
3. **A lint** whose error message names the fix ("use X instead of Y"), so the session that trips it knows what to do.
4. **A test** that fails on the mistake.
5. **A written rule**, only for judgment calls no command can see. One line, in the skill or CLAUDE.md section where the decision gets made.

A check here is a lint, a type, a test, a script, a hook in the repo. It is not a
new CI gate: `/correct` never edits `.github/`, rulesets, CODEOWNERS, the
required-checks list or the hard-stop list. If the repo's existing test run or lint
already runs in CI, putting the check there is enough. If the only home is a new
required check, stop and say so on the card: that is a governance PR.

## Steps

1. **Name the mistake and find both times it happened.** Cards, PRs, commits, `retro:` comments. If you find only one, it is a `/reflect` lesson, not a `/correct` case; say so and stop.
2. **Pick the rung** and write the check.
3. **Prove it.** Check out the commit that had the mistake (the PR's pre-fix commit, or the merged commit) in a scratch worktree, run the new check there, and see it fail for the right reason. Put the failing output in the PR body. A check you have not seen fail on a real past mistake does not ship.
4. **Run the whole suite** the repo runs before a push, and make sure the check passes on current `main`.
5. **Update the rules table.** Every factory repo's CLAUDE.md has `## Rules and what enforces them` (before the Ways of Working block, never inside it): a row per rule, `rule · enforced by · source card`. Add the row, or fill in the *enforced by* of a row that had none. Delete any prose line elsewhere that the new check makes redundant. A row whose mistake can no longer happen loses its prose line, and a repeated rule with nothing enforcing it is escalated here, in the same change, not left for the next retro.
6. **Open the PR**, branch `factory-correct/<card key>`, title `[harden] <card ID> correct: <mistake>`. Body: the two occurrences (cards or PRs), the rung and why not a higher one, the failing output from step 3, and the rollback (revert the PR). It merges under the repo's normal stage; do not turn on auto-merge.

## Never

Add a gate, loosen a check to make room for a new one, skip or delete a test,
touch the Ways of Working block, or write a rule with no enforcing check "for now".
