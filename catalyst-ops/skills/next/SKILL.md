---
name: next
description: Build one Linear card by hand under the Claude dev factory rules — the card you name (or the top Ready For Factory card for this repo's project), moved to In Progress, branched from fresh origin/main, built with gstack, shipped as a PR that carries the evidence, reviewed and stamped (`Reviewed: <head sha>`) by a fresh session that didn't build it, then left for Kevin or Keith to merge. Never turns on auto-merge or merges. Use when Kevin or Keith types /next (optionally with a card ID like CAT-123 or a repo/project hint like "lbl"), or says "build this card", "pick up work" in a code repo. Pickup is normally the factory's dispatcher; /next is the by-hand path. Code repos only — never for strategy, documents or Cowork work. Canon: catalyst-brain strategy/2026-10-23-claude-dev-factory.md.
user-invocable: true
---

# /next — build one card by hand

The factory's dispatcher normally picks up Ready For Factory cards, one unattended session per card. `/next` is the same job started by hand: **one card, one session, one PR**, then stop. The Ways of Working block is the rule set; this skill is how to run it for one card.

**The person running it** is whoever started this session: Kevin or Keith. That person answers this session's forks and gives its hard-stop yeses (§4). If nobody is watching (a session left running unattended or through Remote Control), anything that needs an answer moves the card to **Blocked**.

**The repo's own method adds to this skill.** If the repo has its own `.claude/commands/next.md` or a "How work moves" / "How we ship" section in CLAUDE.md, follow it for method (its commands, extra checks, extra hard stops). Where it is stricter, do both. Where it says to auto-merge or merge, it is out of date: don't (§5).

## 1. Take the card

- If an ID was given, use it. Otherwise, in Linear, take the top **Ready For Factory** card for this repo's project, sorted by priority then by board order.

  | repo | Linear project |
  |---|---|
  | catalyst-os-platform | catalyst-os-platform |
  | catalyst-shift | catalyst-shift-site |
  | catalyst-shift-plugins | business-ops (label `platform`) |
  | lbl-nextjs | lbl-nextjs |
  | nourish-enablement | nourish-rep-enablement |

- Skip anything labelled `blocked-external` or `trigger-gated`, anything assigned to someone other than the person running it (unassigned is fair game), and any card that isn't code in this repo (a call, an email, a decision). Skip a card whose Linear "blocked by" issues aren't all Done, Canceled or Duplicate, whoever is working on them. A card ID you were given that is assigned to someone else is theirs: say so and stop.
- **The card is the spec.** It needs why it matters, 3–8 executable checklist lines (a command, a URL with its expected state, or a DB/API assertion), a risk class (high = migrations, auth, RLS, payments, env or deploy config, data deletion) and a rollback line. Anything missing: draft it with `/card` (catalyst-ops) and post it as a comment headed `Checklist drafted by Claude — edit if wrong`. If the card can only land after another card, add that as a Linear "blocked by" relation so the factory waits for it. Build on a drafted checklist only if the person running it is watching and says go; otherwise leave the card for Kevin or Keith to move to Ready For Factory, and stop.
- **Claim it.** Re-read the card's state and assignee just before claiming, because the dispatcher may have taken it. If it has moved on or is now someone else's, it isn't yours. Assign it to the person running it and move it to **In Progress** before the first edit. Then look at the project's other In Progress cards: if one went In Progress before yours and would change the same files or migrate the same tables, and it isn't already blocked by your card, add it as "blocked by" on your card, move your card back to Ready For Factory with a comment, and stop. The card that went In Progress later is the one that waits, so two cards never block each other.
- **Branch from fresh `origin/main`:** `git fetch origin`, then a worktree of its own on the card's `gitBranchName`, since other sessions may be working the repo. Don't touch another session's worktree, and never run a bare `git stash`: the stash stack is shared.

## 2. Build with gstack

- `/investigate` first for a bug. `/careful` on risky edits. `/autoplan` only for a new surface with real scope.
- Load the `.claude/rules/*.md` that match the paths you'll touch.
- Check for **deep paths** with the repo's protected-paths checker (`scripts/protected-paths.mjs` or `.claude/hooks/protected-paths.mjs`, whichever exists). Feed it every path the PR can carry, renames off:

  ```bash
  ( set -o pipefail; base=$(git merge-base origin/main HEAD) && { git diff --no-renames --name-only "$base" HEAD && git diff --no-renames --name-only --cached && git diff --no-renames --name-only && git ls-files --others --exclude-standard; } | sort -u | node scripts/protected-paths.mjs --check )
  ```

  Exit 0: no deep paths. Exit 1: deep paths. Anything else (a git error, a checker crash, no checker and no list in CLAUDE.md): treat it as deep. Check again before the push. Migrations follow `.claude/rules/migrations.md`.
- If a gstack skill other than `/review` or `/cso` isn't installed, get the same outcome another way, say so in the PR body, and keep going.

## 3. Before the push

1. `/review` on the diff.
2. `/cso` if the diff touches a deep path.
3. `/qa` on the Vercel preview, for anything that has one.
4. Everything CI runs, run locally where it can be.

Each must finish cleanly and cover the whole current diff. If `/review`, or `/cso` on a deep path, is missing, errors or stops early, the card goes to **Blocked** with the missing tool named. For each finding: fix it, or add one line to the PR body saying why it isn't a problem. If you edit after they ran (a fix, the version bump), run them again on the changed diff.

## 4. Forks and hard stops

**Recommend, ask, keep going.** On a product, UX, pricing or architecture fork: pick a recommendation, ask the person running it with AskUserQuestion (recommendation first, marked Recommended), keep building on it while they haven't answered, and record it under `## Decisions made` in the PR body and as a card comment: `Assumed X over Y because Z. Overrule → new card.` If nobody is watching and the card can't be built without guessing at a product decision, comment what it needs and move the card to **Blocked**.

**Hard stops.** Only with a yes from Kevin or Keith in this session, recorded with who gave it. With no one to ask, the card goes to **Blocked** with the question as a comment.

- running a change against a production database (merging the migration file is fine)
- deleting or overwriting customer data
- pricing or a public claim about the product
- sending anything to a client or outside person
- spending money, or a new subprocessor
- credentials (creating, rotating, moving)
- weakening a rule: CI, review, the deep-path list, a required test, or canon

The repo's CLAUDE.md may add hard stops, never fewer.

## 5. Ship

- **`/ship` opens the PR**, after §3. In a **fragment repo** (fresh `origin/main` has `changelog.d/`), don't run `/ship`, because it bumps the version: add one fragment as `changelog.d/README.md` says, leave `VERSION`, `CHANGELOG.md` and the project's own version alone, follow the repo's own open-PR steps up to the push, run the repo's full verify, then push and open the PR (the repo's PR body, or `gh pr create`). A release card there runs the repo's `/release` the same way.
- **Title:** `[concept]` or `[harden]` plus the card ID.
- **Body, the evidence:** card link; risk class; each checklist line with its evidence (command output, a screenshot, the preview URL and what it showed); what deliberately didn't change; rollback; `## Decisions made`; `Closes CAT-NNN`.
- **Never turn on auto-merge and never merge.** Every repo starts at stage 1 and stays there until canon moves it: Kevin or Keith merges. No `gh pr merge`, with or without `--auto`.
- **A fresh session reviews it, not this one.** After `/ship` opens the PR (or the repo's own open-PR steps, in a fragment repo), a separate session that didn't build the card runs `/review` on the PR, plus `/cso` if it touches a deep path. It fixes each finding or answers it in the PR body, then adds the review stamp to the PR body, naming what actually ran:

  ```
  Reviewed: <40-char head sha> — /review[, /cso][, /qa]
  ```

  The sha is the PR's head commit (`gh pr view <n> --json headRefOid -q .headRefOid`). The `review stamp` CI check fails unless it matches, so a fix pushed after the review needs a new review on the new head before the stamp is written again. The session that built the card never writes the stamp from its own review.
  - **The factory dispatcher runs on this machine for this repo** (`systemctl --user is-active claude-factory.timer` succeeds and the repo is in `~/.config/claude-factory/repos.conf`): start no reviewer and spawn none. Within a tick it starts a fresh reviewer for any open PR you opened that has no stamp at its head, and stamps it. A second reviewer would race it on the PR body and the branch. Tell the person running it that the dispatcher will review and stamp PR #N.
  - **Run by hand, someone watching:** tell them to start a new session to review and stamp PR #N, and leave the stamp to that session.
  - **Nobody watching:** spawn a fresh subagent that sees only the PR diff and the card (not this session's transcript or plan). It runs `/review`, and `/cso` on a deep path, and reports its findings. Fix or answer each one; if that pushes a commit, have a fresh subagent review the new head. Then write the stamp with the final head sha and what the subagent ran.
- Move the card to **In Review** and comment the PR link. Then stop: one card per session.
- **Investigation card:** no PR. End with findings and a proposed fix as a card comment.

## 6. Blocked

On a hard stop, a missing §3 tool, or a fork no one can answer: comment on the card with the branch, what's done, what's left, the question or the missing tool, and the next command (`/next CAT-NNN`), then move it to **Blocked**. Tell the person running it in two lines.
