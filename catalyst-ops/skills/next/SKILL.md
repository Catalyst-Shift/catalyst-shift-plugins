---
name: next
description: Pick up and finish the next Linear card for this repo, end to end — build, attack, ship with auto-merge on, then take the next card. Use when Kevin types /next (optionally with a card ID like CAT-123 or a repo/project hint like "lbl"), or says "grab the next thing", "keep going", "pick up work" in a code repo. Code repos only — never for strategy, documents or Cowork work. HOW_WE_BUILD v2 §2–§5.
user-invocable: true
---

# /next — the pickup loop

You run the whole card. Kevin clears Blocked and starts fresh sessions. Don't wait on him unless you hit a hard stop.

## 0. Preflight and budget check (every time, before a card)

**Preflight, before the first card and again before each `gh pr merge --auto`.** Confirm `main` requires the `adversarial review` check, posted by GitHub Actions (integration 15368), in at least one active ruleset that the identity you merge with can't bypass:

```bash
preflight() {
  local ids id
  ids=$(gh api repos/{owner}/{repo}/rules/branches/main --jq '[.[] | select(.type=="required_status_checks") | select(any(.parameters.required_status_checks[]?; .context=="adversarial review" and .integration_id==15368)) | .ruleset_id] | unique | .[]') || return 1
  [ -n "$ids" ] || return 1
  for id in $ids; do
    [ "$(gh api repos/{owner}/{repo}/rulesets/$id --jq .current_user_can_bypass)" = never ] && return 0
  done
  return 1
}
preflight && echo PREFLIGHT_OK || { echo PREFLIGHT_FAIL; false; }
```

Anything but `PREFLIGHT_OK` (including an API error) means **stop**: tell Kevin that `main` doesn't enforce `adversarial review` for this identity (the check isn't required in an active ruleset, the ruleset lets this identity bypass it, or protection is set by classic branch protection, which this endpoint doesn't see), and start no card or merge. Auto-merge without the enforced check merges unreviewed code.

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
- **Checklist lines state outcomes, never tool names.** Write "the four screens driven in a browser, screenshots attached", not "with /qa-only". A line that names a tool can't pass when the session doesn't have that tool, even if the PR is right. The CI reviewer sees only the diff, the PR body and the repo, so put the evidence where it can read it: a committed test, a checked-in screenshot, or a change the diff shows.
- Move the card to **In Progress**. Branch from fresh `origin/main` using the card's `gitBranchName`.

## 2. Build

gstack is the method in session, not a gate. Nothing merges or waits on it; only the required CI checks decide a merge. The exception is the canon's attack steps in §3 (`/review`, the codex adversarial pass, `/cso` on deep paths), which run on every card whatever the table says.

| Every card | When it fits | Not in /next |
| -- | -- | -- |
| `/review`, `/ship` | `/investigate` (bugs), `/qa` or `/qa-only` (anything with a UI), `/cso` (deep paths), `/careful` (risky edits, and always on deep paths), `/autoplan` (a new surface with real scope) | `/land-and-deploy` (auto-merge replaced it), the full plan-review chain on small cards |

If a gstack skill isn't installed in the session, get the same outcome another way (a subagent review, a scripted Playwright drive), say so in the PR body, and keep going. **A missing tool is never a reason for Blocked**, except for the §3 attack steps and `/careful` on deep paths, which can't be substituted either.

- Load the `.claude/rules/*.md` that match the paths you'll touch.
- Check whether you're touching **deep paths** with the repo's protected-paths checker (`.claude/hooks/protected-paths.mjs` or `scripts/protected-paths.mjs`, whichever exists). Feed it every path the PR can carry: committed changes since the merge base with `main`, plus staged, unstaged and untracked files, with renames off so a moved protected file still shows its old path:

  ```bash
  ( set -o pipefail; base=$(git merge-base origin/main HEAD) && { git diff --no-renames --name-only "$base" HEAD && git diff --no-renames --name-only --cached && git diff --no-renames --name-only && git ls-files --others --exclude-standard; } | sort -u | node scripts/protected-paths.mjs --check )
  ```

  Exit 0 means no deep paths. Exit 1 means deep paths. Any other result (a git error, a missing `origin/main`, a checker crash), or no checker and no list in the repo's CLAUDE.md, means treat the card as touching deep paths. In repos where the checker is `.claude/hooks/protected-paths.mjs`, use that path in the command. Check again after every edit and before the push. If the card touches deep paths, `/cso` runs in step 3, and migrations follow `.claude/rules/migrations.md`.

## 3. Attack before the push

1. `/review`
2. `scripts/codex-pass.sh adversarial` (the platform repo; elsewhere use `/codex` in adversarial mode)
3. `/cso` if you touched deep paths

These are canon, not method: the substitution rule in §2 doesn't cover them. Run the real tools. Each must finish cleanly and cover the whole current diff. If one is missing, errors, stops early (no auth, no quota) or returns only a partial report, the card goes to **Blocked** with the missing tool named, until the canon changes. For each finding: fix it, or add one line to the PR body saying why it isn't a problem. The attack has to cover what you push: if you edit after it ran (a finding fix, `/ship`'s version and CHANGELOG bump), run the §3 steps again on the changed diff before pushing. Run the tests the repo can run.

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

- `/ship` handles version, CHANGELOG and the PR. Do the version and CHANGELOG bump before the last §3 pass, so the diff you push is the diff that was attacked. Title carries `[concept]` or `[harden]`. Body: what · why · checklist with each line ticked · what did not change · Decisions made.
- `gh pr merge --auto --squash`. Move the card to **In Review** and comment the PR link.
- **Don't wait for the merge.** Go back to step 0 for the next card.
- When a PR from this session merges, close its card with version + PR number, and file anything that surfaced (a date, a dependency, or a deliverable) as a new card.
- When the `adversarial review` check fails, read its PR comment. If it reports blocking findings, fix every one of them locally, re-run §3 on the result, and push **once**. Every push is a new paid review run. Notes in the comment are optional, not findings. If the fail is an infrastructure error with no findings (a timeout, an API error), re-run the job with `gh run rerun <run-id> --failed` instead of pushing; an unchanged push starts no new review. **Three fails on one card** → card to Blocked with the findings pasted in, and move on.

## 6. Handoff

At the budget limit, or when the Todo list for this repo is empty:

- On every card still In Progress: comment with the branch, what's done, what's left, the decisions taken, and the next command to run.
- Tell Kevin in two lines what merged or is queued to merge, what's in Blocked and why, and then: **start a fresh session and run `/next`.**
