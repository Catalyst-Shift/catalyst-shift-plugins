---
name: reflect
description: Turn what a finished factory card taught us into edits to skills and CLAUDE.md sections that already exist, batched into one open `factory-reflect` PR per repo that Kevin or Keith approve with one skim. Use after a factory PR merges and had friction (review findings, CI-fix or conflict commits, human commits or comments, a revert), when the dispatcher starts a retro session, or when Kevin or Keith types /reflect. Judges each lesson against durable, decision-changing, not a one-off, not already covered, routed to a skill the session used. Sends anything a lint, type, test or script could enforce to /correct. Never adds a gate. Method adapted from Lauren Tan's pstack /reflect.
user-invocable: true
---

# /reflect — a retro after a merged card

A retro makes the next card cheaper. It edits skills that already exist. It does
not add rules for their own sake, and it never adds a gate. People approve skill
edits: never auto-apply, never merge.

## Inputs

Read all of these before judging anything:

- the card and every comment on it (earlier `retro:` and `touch:` comments too)
- the merged PR: body, commits, review comments, PR comments, labels
- the session's events: the builder's log (`~/.local/state/claude-factory/<card key>.log`) and the reviewer's, if they are on this machine
- the repo's `## Rules and what enforces them` table in CLAUDE.md
- the skills the session actually used (the log shows which)

## Step 1 — list the lessons

One line each: what went wrong or took longer than it should, and the decision
that would have avoided it. A lesson is a decision a future session can make
differently, not a story.

## Step 2 — judge each lesson

Keep it only if **all** of these hold (pstack's synthesizer criteria):

1. **Durable.** It will still be true next month.
2. **Decision-changing.** A session that read it would act differently.
3. **Not a one-off.** It is not about this card's data, a flaky run, or a typo.
4. **Not already covered.** Search the skills and CLAUDE.md first; a rule that exists and was ignored is a `/correct` case, not a new line.
5. **Routed to something the session used.** It goes in a skill or CLAUDE.md section that the session actually read. A lesson with no such home is dropped.

Everything else is rejected, with a one-line reason. Rejecting is the normal
outcome; a retro that accepts everything is padding.

## Step 3 — route what is accepted

- **A lint, type, test or script could enforce it** (a command can see the mistake), **or it repeats a mistake** already in the rules table or in an earlier `retro:` comment: do not write a rule. Run `/correct` on it.
- **A judgment call** (no command can see it): an edit to the one skill or CLAUDE.md section it belongs in. Smallest change that works; replace a weaker line rather than add beside it.

## Step 4 — the `factory-reflect` PR

One open PR per repo, branch `factory-reflect`. If it is open, add a commit to it
(a normal push, never a force-push) and add the new lessons to its body; otherwise
branch from the default branch and open it. Skills in the `catalyst-ops` plugin
live in `Catalyst-Shift/catalyst-shift-plugins`: clone it to a scratch directory
and use that repo's `factory-reflect` PR. Title: `[harden] factory-reflect: <short>`.
Body: for each edit, the lesson, the card it came from, and the file. End with the
card IDs. Never turn on auto-merge and never merge: Kevin or Keith approve it from
the Retros page's Review release or on GitHub.

The PR never touches `.github/`, rulesets, CODEOWNERS, the required-checks list,
the hard-stop list (the Ways of Working block) or the ways-of-working skill. A CI
check fails it if it does. If a lesson needs one of those, reject it and say
"needs a governance PR" in the reason.

## Step 5 — comment on the card

Exactly one comment, first line:

```
retro: <accepted> accepted, <rejected> rejected
```

Then one line per rejection: `- rejected: <lesson> — <reason>`, one per accepted
lesson naming where it went, and a last line `structural: <n> sent to /correct`.
A card with nothing worth keeping still gets the comment (`0 accepted, N rejected`).

## Hard stops

Production databases, customer data, credentials, spending, pricing or public
product claims, anything sent outside the team, weakening a rule. A retro that
would need one of these records it as a rejection and moves on.
