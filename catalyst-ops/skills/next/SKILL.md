---
name: next
description: Pick up and finish the next Linear card for this repo, end to end — build, attack, ship with auto-merge on, then take the next card. Use when Kevin types /next (optionally with a card ID like CAT-123 or a repo/project hint like "lbl"), or says "grab the next thing", "keep going", "pick up work" in a code repo. Code repos only — never for strategy, documents or Cowork work. HOW_WE_BUILD v2 §2–§5.
user-invocable: true
---

# /next — the pickup loop

You run the whole card. Kevin clears Blocked and starts fresh sessions. Don't wait on him unless you hit a hard stop.

**The person running the loop** is whoever started this session. It decides which cards are yours (§1). It doesn't change who answers a fork or a hard stop: that stays as §4 says.

**The repo's own method adds to this skill; it never replaces the rails.** If the repo has its own `/next` (`.claude/commands/next.md`) or a "How work moves" / "How we ship" section in CLAUDE.md, follow it for method: its commands, its extra checks, its extra hard stops. The preflight in §0, the attack steps in §3 and the hard stops in §4 still apply in full; where the repo is stricter, do both. Today that means:

- **nourish-enablement** has its own `/next`, `/pickup`, `/build`, `/open-pr` and `/land`, and its attack adds `npm run verify`, the app driven as its user with what was seen captured, every guard the change relies on made to fail once, `compliance-reviewer` on deep paths, and a reader that didn't write the change. Deep-path edits there need the session to be attended (the `attending` declaration); a headless run can't make them.
- **lbl-nextjs** keeps its rules in CLAUDE.md "How we ship" and "Parallel sessions".

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

Anything but `PREFLIGHT_OK` (including an API error) means **stop**: tell Kevin that `main` doesn't enforce `adversarial review` for this identity (the check isn't required in an active ruleset, the ruleset lets this identity bypass it, or protection is set by classic branch protection, which this endpoint doesn't see), and start no card or merge. Auto-merge without the enforced check merges unreviewed code. If the repo also has its own merge-gate script (nourish: `node scripts/check-merge-gate.mjs`), run it as well; a non-zero exit from either means stop.

**Budget.** Estimate how much context this session has used. **Don't start a new card past ~450k tokens. At 650k, stop** at the next clean point (a pushed commit, or a PR opened) and hand off (§6). Keeping context under 650k keeps token costs down, and that matters more than finishing one more card.

## 1. Pick the card

- If an ID was given, use it. Otherwise, in Linear pull Todo issues for this repo's project, sorted by priority then by board order.

  | repo | Linear project |
  |---|---|
  | catalyst-os-platform | catalyst-os-platform |
  | catalyst-shift | catalyst-shift-site |
  | catalyst-shift-plugins | business-ops (label `platform`) |
  | lbl-nextjs | lbl-nextjs |
  | nourish-enablement | nourish-rep-enablement |

- Skip anything labelled `blocked-external` or `trigger-gated`, anything assigned to someone other than the person running the loop (unassigned cards are fair game), and any card that isn't code in this repo (a call, an email, a decision). A card ID given to you that is assigned to someone else is theirs: say so and stop.
- **Don't collide with what's running.** Read the In Progress cards first. If the top Todo card would edit the same files or migrate the same tables as one of them, don't start it: take a card the person running the loop names by ID, or stop and say why. Files every card touches (CLAUDE.md, `package.json`, shared types) don't count.
- No acceptance checklist? Draft one with `/spec`. Keep it to 3–8 lines checkable from the diff. Post it as a comment headed `Checklist drafted by Claude — edit if wrong`, then start.
- **Checklist lines state outcomes, never tool names.** Write "the four screens driven in a browser, screenshots attached", not "with /qa-only". A line that names a tool can't pass when the session doesn't have that tool, even if the PR is right. The CI reviewer sees only the diff, the PR body and the repo, so put the evidence where it can read it: a committed test, a checked-in screenshot, or a change the diff shows.
- **Claim it.** Re-read the card's state just before claiming, because two `/next` runs started together can pick the same card; if it's already In Progress, it isn't yours. Assign it to the person running the loop and move it to **In Progress**. That is the claim, and it comes before the first edit.
- **One card, one worktree.** Branch from fresh `origin/main` using the card's `gitBranchName`, in a worktree of its own when other sessions may be working the repo (lbl: `scripts/session.sh <gitBranchName>`). Don't edit, reset, clean or commit in another session's worktree, and never run a bare `git stash` or `git stash pop`: the stash stack is shared. Set work aside with a WIP commit instead.
- **Too big for one PR?** Say which checklist lines each PR delivers before building. Each PR carries only its own lines, and every one must be met. The card's other lines go under **Deferred to later PRs on this card**, each naming where it goes. Every PR but the last says `Refs CAT-NNN`; the last says `Closes CAT-NNN` and defers nothing.

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

  Exit 0 means no deep paths. Exit 1 means deep paths. Any other result (a git error, a missing `origin/main`, a checker crash), or no checker and no list in the repo's CLAUDE.md or `.github/workflows/deep-paths.txt`, means treat the card as touching deep paths. In repos where the checker is `.claude/hooks/protected-paths.mjs`, use that path in the command.

  lbl-nextjs has no checker: its list is `.github/CODEOWNERS`, copied as regexes in `.github/workflows/deep-paths.txt`. Collect the paths first and match only once every git step has succeeded, because `grep`'s exit 1 means "no match":

  ```bash
  ( set -o pipefail
    base=$(git merge-base origin/main HEAD) || exit 2
    paths=$( { git diff --no-renames --name-only "$base" HEAD && git diff --no-renames --name-only --cached && git diff --no-renames --name-only && git ls-files --others --exclude-standard; } | sort -u ) || exit 2
    printf '%s\n' "$paths" | grep -Ef .github/workflows/deep-paths.txt >/dev/null && exit 1
    [ $? -eq 1 ] && exit 0 || exit 2 )
  ```

  That keeps the same meaning as the checker: exit 0 no deep paths, exit 1 deep, anything else treated as deep. Check again after every edit and before the push. If the card touches deep paths, `/cso` runs in step 3, and migrations follow `.claude/rules/migrations.md`.

## 3. Attack before the push

1. `/review`
2. `scripts/codex-pass.sh adversarial` (the platform repo; elsewhere use `/codex` in adversarial mode)
3. `/cso` if you touched deep paths

These are canon, not method: the substitution rule in §2 doesn't cover them. Run the real tools. Each must finish cleanly and cover the whole current diff. If one is missing, errors, stops early (no auth, no quota) or returns only a partial report, the card goes to **Blocked** with the missing tool named, until the canon changes. For each finding: fix it, or add one line to the PR body saying why it isn't a problem. The attack has to cover what you push: if you edit after it ran (a finding fix, `/ship`'s version and CHANGELOG bump), run the §3 steps again on the changed diff before pushing. Run the tests the repo can run.

## 4. Forks: recommend, ask, keep going

For a product, UX, pricing or architecture choice: pick a recommendation, ask Kevin with AskUserQuestion (recommendation first, marked Recommended), and **keep building on it** while he hasn't answered. Record every one under `## Decisions made` in the PR body and as a card comment, with who ruled: `Assumed X over Y because Z. Overrule → new card.`

**Hard stops.** Don't do these without Kevin's yes in this session. Record it. The repo's CLAUDE.md may add more hard stops (nourish: a constraint break, the scope fence, an escape-hatch annotation; lbl: anything that changes what Craig's customers see or pay), never fewer:

- running a change against a production database (merging the migration file is fine)
- deleting or overwriting customer data
- pricing, packaging, or a public claim about the product
- sending anything to a client or outside person
- spending money, or adding a paid service or subprocessor
- creating, rotating or moving credentials
- weakening a rule: CI, the reviewer, the deep-path list, a required test, or canon

If he doesn't answer, move the card to **Blocked** with the question as a comment, and go back to step 1.

## 5. Ship

- `/ship` handles version, CHANGELOG and the PR (nourish: `/open-pr`). Do the version and CHANGELOG bump before the last §3 pass, so the diff you push is the diff that was attacked. Take the shared counters late, against freshly fetched `origin/main`: the version number and, where migrations are numbered or timestamped, the migration's. If `origin/main` already holds that number, renumber before pushing. Never rename a migration after it merges. Title carries `[concept]` or `[harden]`. Body: what · why · checklist with each line ticked · what did not change · Decisions made.
- `gh pr merge --auto --squash`. Then check once: `gh pr view <n> --json state,mergeStateStatus`. If it's already `MERGED`, or `CLEAN` while required checks are still running, the gate didn't hold: stop the loop and tell the person running it. Otherwise move the card to **In Review** and comment the PR link.
- **Don't wait for the merge.** Go back to step 0 for the next card.
- **BEHIND on a strict repo.** Where the ruleset requires up-to-date branches (lbl-nextjs), every merge leaves the other open PRs BEHIND. The session that owns the PR runs `gh pr update-branch <n>` when the PR is otherwise ready, not on every merge, because each update re-runs CI and the review. Auto-merge stays armed. Repos with strict off (platform, nourish) need nothing.
- When a PR from this session merges, close its card with version + PR number, but only for a PR that says `Closes`; a `Refs` PR leaves the card open with its deferred lines commented on it. File anything that surfaced (a date, a dependency, or a deliverable) as a new card. Remove the card's worktree (lbl: `scripts/session.sh --remove <gitBranchName>`).
- When the `adversarial review` check fails, read the PR comment from that failed run: it must name the current head SHA and be posted after the run attempt started (`gh run view <run-id> --json startedAt`), because a re-run keeps the same SHA. If there's no such comment, treat the fail as findings you haven't seen, and read the job log. If it reports blocking findings, fix every one of them locally, re-run §3 on the result, and push **once**. Notes in the comment are optional, not findings. If the fail is an infrastructure error with no findings (a timeout, an API error, "Reviewer did not finish"), don't change the code. Re-run the job with `gh run rerun <run-id> --failed`. If the token can't (`Resource not accessible by personal access token`; the agent token isn't allowed to, and don't widen it), push an empty commit (`git commit --allow-empty -m "retry adversarial review"`) to start a fresh review. A push of an unchanged SHA starts no new review. Every fail counts toward the three below, infrastructure ones included.
- **Where the reviewer reuses verdicts** (CAT-785, CAT-947; in nourish and lbl, coming to the others), a run whose PR diff (VERSION and CHANGELOG.md left out), PR body and judge on `main` are unchanged since the last completed run takes that run's PASS or FAIL with no model call. So a re-run, an empty commit or a VERSION/CHANGELOG-only push never overturns a real FAIL: blocking findings are fixed in code, as above, and that push gets a fresh read. An infrastructure fail leaves no verdict to reuse, so its retry is a full review. A PR body edit also changes the fingerprint, but lbl doesn't run the review on a body edit, so any body change there needs a push to be read. The comment footer shows the model, cost and turns of each run. **Three fails on one card** → card to Blocked with the findings pasted in, and move on.

## 6. Handoff

At the budget limit, or when the Todo list for this repo is empty:

- On every card still In Progress: comment with the branch, what's done, what's left, the decisions taken, and the next command to run.
- Tell Kevin in two lines what merged or is queued to merge, what's in Blocked and why, and then: **start a fresh session and run `/next`.**
