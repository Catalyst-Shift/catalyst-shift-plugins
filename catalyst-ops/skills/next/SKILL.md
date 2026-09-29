---
name: next
description: Pick up and finish the next Linear card for this repo, end to end — build, attack, ship with auto-merge on, then take the next card. Use when Kevin types /next (optionally with a card ID like CAT-123 or a repo/project hint like "lbl"), or says "grab the next thing", "keep going", "pick up work" in a code repo. Code repos only — never for strategy, documents or Cowork work. HOW_WE_BUILD v2 §2–§5.
user-invocable: true
---

# /next — the pickup loop

You run the whole card. Kevin clears Blocked and starts fresh sessions. Don't wait on him unless you hit a hard stop.

## 0. Preflight and budget check (every time, before a card)

**Preflight, before the first card and again before each `gh pr merge --auto`.** Confirm `main` requires the `adversarial review` check, posted by GitHub Actions (integration 15368):

```bash
gh api repos/{owner}/{repo}/rules/branches/main \
  --jq '[.[] | select(.type=="required_status_checks") | .parameters.required_status_checks[]] | any(.context=="adversarial review" and .integration_id==15368)'
```

If that prints anything but `true` (including an API error), **stop**: tell Kevin that `main` doesn't require `adversarial review` in an active ruleset (or that it's set by classic branch protection, which this endpoint doesn't see), and start no card or merge. Auto-merge without the required check merges unreviewed code.

**Budget.** Estimate how much context this session has used. **Don't start a new card past ~450k tokens. At 650k, stop** at the next clean point (a pushed commit, or a PR opened) and hand off (§6). Keeping context under 650k keeps token costs down, and that matters more than finishing one more card.

## 1. Pick the card

- If an ID was given, use it. Otherwise, in Linear pull Todo issues for this repo's project, sorted by priority then by board order.

  | repo | Linear project |
  |---|---|
  | catalyst-os-platform | catalyst-os-platform |
  | catalyst-shift | catalyst-shift-site |
  | catalyst-shift-plugins | business-ops (label `platform`) |
  | lbl-nextjs | lbl-nextjs |
  | nourish-rep-enablement | nourish-rep-enablement |

- Skip anything labelled `blocked-external` or `trigger-gated`, anything assigned to someone other than Kevin (unassigned cards are fair game), and any card that isn't code in this repo (a call, an email, a decision).
- No acceptance checklist? Draft one with `/spec`. Keep it to 3–8 lines checkable from the diff. Post it as a comment headed `Checklist drafted by Claude — edit if wrong`, then start.
- **Checklist lines state outcomes, never tool names.** Write "the four screens driven in a browser, screenshots attached", not "with /qa-only". A line that names a tool can't pass when the session doesn't have that tool, even if the PR is right.
- Move the card to **In Progress**. Branch from fresh `origin/main` using the card's `gitBranchName`.

## 2. Build

gstack is the method in session, not a gate. Nothing merges or waits on it; only the required CI checks decide a merge.

| Every card | When it fits | Not in /next |
| -- | -- | -- |
| `/review`, `/ship` | `/investigate` (bugs), `/qa` or `/qa-only` (anything with a UI), `/cso` (deep paths), `/careful` (risky edits), `/autoplan` (a new surface with real scope) | `/land-and-deploy` (auto-merge replaced it), the full plan-review chain on small cards |

If a gstack skill isn't installed in the session, get the same outcome another way (a subagent review, a scripted Playwright drive), say so in the PR body, and keep going. **A missing tool is never a reason for Blocked.** The §3 attack steps are still mandatory; only the tool can change. A substitute for `/cso` is a security-focused pass over the deep-path diff, named in the PR body.

- Load the `.claude/rules/*.md` that match the paths you'll touch.
- Check whether you're touching **deep paths**, using the repo's protected-paths list: `node .claude/hooks/protected-paths.mjs --check` on the file list, or the list in the repo's CLAUDE.md. If you are, `/cso` runs in step 3, and migrations follow `.claude/rules/migrations.md`.

## 3. Attack before the push

1. `/review`
2. `scripts/codex-pass.sh adversarial` (the platform repo; elsewhere use `/codex` in adversarial mode)
3. `/cso` if you touched deep paths

A step whose skill isn't installed gets the same outcome another way (§2), noted in the PR body. For each finding: fix it, or add one line to the PR body saying why it isn't a problem. Run the tests the repo can run.

## 4. Forks: recommend, ask, keep going

For a product, UX, pricing or architecture choice: pick a recommendation, ask Kevin with AskUserQuestion (recommendation first, marked Recommended), and **keep building on it** while he hasn't answered. Record every one under `## Decisions made` in the PR body and as a card comment: `Assumed X over Y because Z. Overrule → new card.`

**Hard stops.** Don't do these without Kevin's yes in this session:

- running a change against a production database (merging the migration file is fine)
- deleting or overwriting customer data
- pricing, packaging, or a public claim about the product
- sending anything to a client or outside person
- spending money, or adding a paid service or subprocessor
- creating, rotating or moving credentials
- weakening a rule: CI, the reviewer, the deep-path list, a required test, or canon

If he doesn't answer, move the card to **Blocked** with the question as a comment, and go back to step 1.

## 5. Ship

- `/ship` handles version, CHANGELOG and the PR. Title carries `[concept]` or `[harden]`. Body: what · why · checklist with each line ticked · what did not change · Decisions made.
- `gh pr merge --auto --squash`. Move the card to **In Review** and comment the PR link.
- **Don't wait for the merge.** Go back to step 0 for the next card.
- When a PR from this session merges, close its card with version + PR number, and file anything that surfaced (a date, a dependency, or a deliverable) as a new card.
- When the `adversarial review` check fails, read its PR comment, fix, and push. **Three fails on one card** → card to Blocked with the findings pasted in, and move on.

## 6. Handoff

At the budget limit, or when the Todo list for this repo is empty:

- On every card still In Progress: comment with the branch, what's done, what's left, the decisions taken, and the next command to run.
- Tell Kevin in two lines what merged or is queued to merge, what's in Blocked and why, and then: **start a fresh session and run `/next`.**
