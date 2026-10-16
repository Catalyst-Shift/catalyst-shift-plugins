---
name: next
description: Pick up and finish the next Linear card for this repo, end to end — build, attack, ship with auto-merge on, then take the next card. Use when Kevin or Keith types /next (optionally with a card ID like CAT-123 or a repo/project hint like "lbl"), or says "grab the next thing", "keep going", "pick up work" in a code repo. Code repos only — never for strategy, documents or Cowork work. HOW_WE_BUILD v2 §2–§5.
user-invocable: true
---

# /next — the pickup loop

You run the whole card. Kevin or Keith clears Blocked and starts fresh sessions. Don't wait on them unless you hit a hard stop.

**The person running the loop** is whoever started this session: Kevin or Keith. It decides which cards are yours (§1), and that person answers this session's forks and gives its hard-stop yeses (§4). Kevin and Keith hold the same authority in every repo (Kevin, 2026-10-16); every ruling is recorded with who gave it.

**The repo's own method adds to this skill.** If the repo has its own `/next` (`.claude/commands/next.md`) or a "How work moves" / "How we ship" section in CLAUDE.md, follow it for method: its commands, its extra checks, its extra hard stops. The preflight in §0 and the hard stops in §4 still apply in full; where the repo is stricter, do both. The §3 attack steps apply in full too, with one exception from HOW_WE_BUILD §3: a repo whose code transfers to the client and doesn't carry gstack (today, nourish) attacks with its own steps, which stand in for `/review`, the Codex pass and `/cso` there, and its attendance rule (below) stands in for `/careful` on deep paths. Today that means:

- **nourish-enablement** has its own `/next`, `/pickup`, `/build`, `/verify`, `/open-pr`, `/release` and `/land`, and its attack adds `npm run verify`, the app driven as its user with what was seen captured, every guard the change relies on made to fail once, `compliance-reviewer` on deep paths, and a reader that didn't write the change. Deep-path edits there need the session to be attended: the person types `attending` as a prompt's first line in the interactive CLI (it lasts 8 hours), so a headless run can't make them.
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

Anything but `PREFLIGHT_OK` (including an API error) means **stop**: tell the person running the loop that `main` doesn't enforce `adversarial review` for this identity (the check isn't required in an active ruleset, the ruleset lets this identity bypass it, or protection is set by classic branch protection, which this endpoint doesn't see), and start no card or merge. Auto-merge without the enforced check merges unreviewed code. If the repo also has its own merge-gate script (nourish: `node scripts/check-merge-gate.mjs`), run it as well; a non-zero exit from either means stop.

**Open PRs.** On a repo whose ruleset requires up-to-date branches (lbl-nextjs), keep this session's open PRs up to date (§5, "BEHIND").

**Budget.** Estimate how much context this session has used. **Don't start a new card past ~450k tokens. At 650k, stop** at the next clean point (a pushed commit, or a PR opened) and hand off (§6). Keeping context under 650k keeps token costs down, and that matters more than finishing one more card.

## 1. Pick the card

- If an ID was given, use it (a card that isn't Todo only as a resume, below). Otherwise, pull Todo issues for this repo's project, sorted by priority then by board order.

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
- **Claim it.** Re-read the card's state and assignee just before claiming, because two `/next` runs started together can pick the same card: if it has left Todo or is now assigned to someone else, it isn't yours. Assign it to the person running the loop and move it to **In Progress**. That is the claim, and it comes before the first edit. **Resuming** is different, and only by ID: when the person running the loop gives the ID of their own card whose newest comment is a handoff (§6), they are saying no other session is on it. Before touching the branch, comment `Resumed by <name>` on the card; a later resume needs a new handoff. Continue from the handoff: an unfinished PR on the branch it names, or a split card's next PR on the new branch it names, created fresh from `origin/main` (lbl: `scripts/session.sh <gitBranchName>` reopens the card's own branch; an unfinished `Refs` branch reuses its worktree if it still exists, otherwise `git fetch origin && git worktree add ../lbl-nextjs-<short-slug>-prN <branch>`). For an unfinished branch anywhere, run `git fetch origin` and then `git merge --ff-only origin/<branch>` in its worktree before editing; if that refuses, stop and ask the person running the loop. A split card's next PR is new: `git fetch origin` and branch from `origin/main`, as below. If Linear moved a split card to Done when a `Refs` PR merged, move it back to In Progress first. Never resume a card on your own initiative: any In Progress card you weren't handed by ID is someone's live work.
- **One card, one worktree.** Branch from fresh `origin/main` using the card's `gitBranchName`, in a worktree of its own when other sessions may be working the repo (lbl: `scripts/session.sh <gitBranchName>`). Don't edit, reset, clean or commit in another session's worktree, and never run a bare `git stash` or `git stash pop`: the stash stack is shared. Set work aside with a WIP commit instead.
- **Too big for one PR?** Say which checklist lines each PR delivers before building. Each PR carries only its own lines, and every one must be met. The card's other lines go under **Deferred to later PRs on this card**, each naming where it goes. Every PR but the last says `Refs CAT-NNN`; the last says `Closes CAT-NNN` and defers nothing. Linear's GitHub integration moves a card to Done when a PR on a branch carrying its ID merges, so a `Refs` PR's branch must not carry the card ID: name it `<person>/<short-slug>-pr1`, `-pr2` and so on, each fresh from `origin/main` after the previous one merged. Only the `Closes` PR uses the card's `gitBranchName`. For a `Refs` PR this overrides a repo's own branch-naming step (nourish's `/pickup` says to use `gitBranchName`); its other pickup steps still apply. lbl's `scripts/session.sh` needs the card ID in a branch name, so a `Refs` branch there gets its worktree from `git worktree add ../lbl-nextjs-<short-slug>-prN -b <branch> origin/main` and is removed with `git worktree remove`.

## 2. Build

gstack is the method in session, not a gate. Nothing merges or waits on it; only the required CI checks decide a merge. The exception is the canon's attack steps in §3 (`/review`, the codex adversarial pass, `/cso` on deep paths), which run on every card whatever the table says.

| Every card | When it fits | Not in /next |
| -- | -- | -- |
| `/review`, `/ship` (not in a fragment repo, §5) | `/investigate` (bugs), `/qa` or `/qa-only` (anything with a UI), `/cso` (deep paths), `/careful` (risky edits, and always on deep paths), `/autoplan` (a new surface with real scope) | `/land-and-deploy` (auto-merge replaced it), the full plan-review chain on small cards |

If a gstack skill isn't installed in the session, get the same outcome another way (a subagent review, a scripted Playwright drive), say so in the PR body, and keep going. **A missing tool is never a reason for Blocked**, except for the §3 attack steps and `/careful` on deep paths, which can't be substituted either (nourish: see its exception at the top).

- Load the `.claude/rules/*.md` that match the paths you'll touch.
- Check whether you're touching **deep paths** with the repo's protected-paths checker (`.claude/hooks/protected-paths.mjs` or `scripts/protected-paths.mjs`, whichever exists). Feed it every path the PR can carry: committed changes since the merge base with `main`, plus staged, unstaged and untracked files, with renames off so a moved protected file still shows its old path:

  ```bash
  ( set -o pipefail; base=$(git merge-base origin/main HEAD) && { git -c core.quotePath=false diff --no-renames --name-only "$base" HEAD && git -c core.quotePath=false diff --no-renames --name-only --cached && git -c core.quotePath=false diff --no-renames --name-only && git -c core.quotePath=false ls-files --others --exclude-standard; } | sort -u | node scripts/protected-paths.mjs --check )
  ```

  Exit 0 means no deep paths. Exit 1 means deep paths. Any other result (a git error, a missing `origin/main`, a checker crash), or no checker and no list in the repo's CLAUDE.md or `.github/workflows/deep-paths.txt`, means treat the card as touching deep paths. In repos where the checker is `.claude/hooks/protected-paths.mjs`, use that path in the command.

  lbl-nextjs has no checker: its list is `.github/CODEOWNERS`, copied as regexes in `.github/workflows/deep-paths.txt`. Collect the paths first and match only once every git step has succeeded, because `grep`'s exit 1 means "no match":

  ```bash
  ( set -o pipefail
    base=$(git merge-base origin/main HEAD) || exit 2
    paths=$( { g() { git -c core.quotePath=false "$@"; }; g diff --no-renames --name-only "$base" HEAD && g diff --no-renames --name-only --cached && g diff --no-renames --name-only && g ls-files --others --exclude-standard; } | sort -u ) || exit 2
    case "$paths" in '"'*|*'
"'*) exit 1 ;; esac
    printf '%s\n' "$paths" | grep -Ef .github/workflows/deep-paths.txt >/dev/null && exit 1
    [ $? -eq 1 ] && exit 0 || exit 2 )
  ```

  That keeps the same meaning as the checker: exit 0 no deep paths, exit 1 deep, anything else treated as deep. `core.quotePath=false` keeps non-ASCII names readable, and a name git still quotes (a quote, backslash or control character in it) counts as deep. Check again after every edit and before the push. If the card touches deep paths, `/cso` runs in step 3, and migrations follow `.claude/rules/migrations.md`.

## 3. Attack before the push

1. `/review`
2. `scripts/codex-pass.sh adversarial` (the platform repo; elsewhere use `/codex` in adversarial mode)
3. `/cso` if you touched deep paths

These are canon, not method: the substitution rule in §2 doesn't cover them. (In nourish, its own attack steps are these steps; see the top of this skill.) Run the real tools. Each must finish cleanly and cover the whole current diff. If one is missing, errors, stops early (no auth, no quota) or returns only a partial report, the card goes to **Blocked** with the missing tool named, until the canon changes. For each finding: fix it, or add one line to the PR body saying why it isn't a problem. The attack has to cover what you push: if you edit after it ran (a finding fix; the version and CHANGELOG bump, or in a fragment repo the changelog fragment), run the §3 steps again on the changed diff before pushing. Run the tests the repo can run.

## 4. Forks: recommend, ask, keep going

For a product, UX, pricing or architecture choice: pick a recommendation, ask the person running the loop with AskUserQuestion (recommendation first, marked Recommended), and **keep building on it** while they haven't answered. Record every one under `## Decisions made` in the PR body and as a card comment, with who ruled: `Assumed X over Y because Z. Overrule → new card.`

**Hard stops.** Don't do these without a yes in this session from Kevin or Keith. Record it with who gave it. The repo's CLAUDE.md may add more hard stops (nourish: a constraint break, the scope fence, an escape-hatch annotation; lbl: anything that changes what Craig's customers see or pay), never fewer:

- running a change against a production database (merging the migration file is fine)
- deleting or overwriting customer data
- pricing, packaging, or a public claim about the product
- sending anything to a client or outside person
- spending money, or adding a paid service or subprocessor
- creating, rotating or moving credentials
- weakening a rule: CI, the reviewer, the deep-path list, a required test, or canon

If no one answers, move the card to **Blocked** with the question as a comment, and go back to step 1.

## 5. Ship

- **A fragment repo** is one whose fresh `origin/main` has a `changelog.d/` directory. There, the PR adds one new fragment in `changelog.d/`, named and formatted as `changelog.d/README.md` says (no README: match the fragments already there). It leaves `VERSION`, `CHANGELOG.md`, the project's own version (in `package.json` and its lockfile entry; dependency versions the card needs may change) and every other fragment untouched; the repo's `/release` assigns versions in a PR of its own. **Don't run `/ship`:** it writes the version bump, commits and pushes in one run, with no step to skip. Prepare every file change first: if the repo has its own open-PR command (`.claude/commands/open-pr.md`), follow its steps **up to, not including, the push** (in nourish that's the self-review, the migration renumber and the fragment), since those steps edit the diff. Then run the repo's full verify (`npm run verify` where it exists, since it holds the changelog check), the last §3 pass on the complete diff, and only then commit, push and open the PR (with that command's PR body, or `gh pr create`).
- **A release card** in a fragment repo (its job is cutting the next version) runs the repo's `/release` the same way (up to the push, then the last §3 pass, then push) and adds no fragment. Its pre-open checks (in nourish, that no other release PR is open) run before the push. Its PR title is the one `/release` gives (in nourish, `[release] vX.Y.Z`), and its card closes with that version.
- **Otherwise,** `/ship` handles version, CHANGELOG and the PR. Do the version and CHANGELOG bump before the last §3 pass, so the diff you push is the diff that was attacked.
- **Take the shared counters late**, against freshly fetched `origin/main`: the version number (where the repo bumps per PR) and, where migrations are numbered or timestamped, the migration's. If `origin/main` already holds that number, renumber before the last §3 pass. Never rename a migration after it merges.
- The PR title carries `[concept]` or `[harden]` (a release card's carries what `/release` gives; any other PR in a fragment repo carries no version number). Body: what · why · checklist with each line ticked · what did not change · Decisions made, and `Closes CAT-NNN` (or `Refs CAT-NNN` on a split card's earlier PR).
- `gh pr merge --auto --squash`. Then check once: `gh pr view <n> --json state,mergeStateStatus` and `gh pr checks <n> --required`. If it's `MERGED` or `CLEAN` while any required check (`adversarial review` among them) hasn't passed, the gate didn't hold: stop the loop and tell the person running it. Pending checks (`gh pr checks` exit 8, or "no required checks reported" in the seconds before the reviewer registers) and a failed check (exit 1 with a check list) are answers; if a call fails with no check list (an API or auth error) or the answer is unclear, stop too. `MERGED` after every required check passed is a normal merge: complete the card as below (nourish's own `/next` stops on any `MERGED`; there, stop and tell the person running the loop). Otherwise, for a `Closes` PR, move the card to **In Review** and comment the PR link. For a `Refs` PR the card stays **In Progress**: comment the PR link and a handoff (§6) listing the deferred lines, the next PR's new branch (fresh from `origin/main`), and the next command (`/next CAT-NNN` once PR #n merges).
- **Don't wait for the merge.** Go back to step 0 for the next card.
- **BEHIND on a strict repo.** Where the ruleset requires up-to-date branches (lbl-nextjs), every merge leaves the other open PRs BEHIND. At step 0, before each new card, bring up to date this session's open PRs (the ones it opened, or those of a card it resumed under §1's checks) that are BEHIND with every other check green; not on every merge, because each update re-runs CI. If `main` changed none of the PR's own files, `gh pr update-branch <n>` is enough (the review keeps its verdict). If it did, merge `origin/main` into the branch in this session's own worktree for it, re-run §3 on the result, then push. Never touch another session's PR or worktree. Auto-merge stays armed. Repos with strict off (platform, nourish) need nothing.
- When a PR from this session merges, close its card only if the PR says `Closes`: with its PR number, plus its version only where the repo bumps per PR (in a fragment repo, only a release card). A `Refs` PR leaves the card In Progress with its handoff (as nourish's `/land` does); the person running the loop resumes it by ID. File anything that surfaced (a date, a dependency, or a deliverable) as a new card. Remove the merged PR's worktree (lbl: `scripts/session.sh --remove --force <that PR's branch>`, since a squash merge leaves the branch unmerged in git's eyes; a `Refs` branch: `git worktree remove`, without `--force`; if it refuses, the worktree holds uncommitted work, so stop and say so).
- When the `adversarial review` check fails, read the PR comment from that failed run: it must name the current head SHA and be posted after the run attempt started (`gh run view <run-id> --json startedAt`), because a re-run keeps the same SHA. If the run reused an earlier verdict, it posts no new comment: its log names the run it reused, so read that run's comment for the findings. If there's no such comment, treat the fail as findings you haven't seen, and read the job log. If it reports blocking findings, fix every one of them locally, re-run §3 on the result, and push **once**. Every push is a new review run. Notes in the comment are optional, not findings. If the fail is an infrastructure error with no findings (a timeout, an API error, "Reviewer did not finish"), don't change the code. Re-run the job with `gh run rerun <run-id> --failed`. If the token can't (`Resource not accessible by personal access token`; the agent token isn't allowed to, and don't widen it), push an empty commit (`git commit --allow-empty -m "retry adversarial review"`) to start a fresh review. A push of an unchanged SHA starts no new review. Every fail counts toward the three below, infrastructure ones included.
- **Where the reviewer reuses verdicts** (nourish and lbl; platform, catalyst-shift and this repo call the model on every run), a run whose PR diff with `VERSION` and `CHANGELOG.md` left out, PR body and judge on `main` are unchanged since the last completed run takes that run's PASS or FAIL with no model call. So an empty commit or a VERSION/CHANGELOG-only push never overturns a real FAIL (in lbl a re-run doesn't either; in nourish a re-run reuses only when the run being re-run itself reused a verdict, otherwise it calls the model again): blocking findings are fixed in code, as above, and that push gets a fresh read. A `changelog.d/` fragment is not left out, so a fragment change gets a fresh read. Both also keep a verdict after a merge from `main` that touched none of the PR's own files. An infrastructure fail leaves no verdict to reuse, so its retry is a full review. A PR body edit re-runs the review in nourish; lbl doesn't run it on a body edit, so a body change there needs a push to be read. The comment footer shows the model, cost and turns of each run. **Three fails on one card** → card to Blocked with the findings pasted in, and move on.

## 6. Handoff

At the budget limit, or when the Todo list for this repo is empty:

- On every card this session claimed or resumed and is leaving In Progress: comment a handoff with the branch, what's done, what's left, the decisions taken, and the next command to run.
- On a strict repo, on every card this session left In Review with an open PR: comment the PR number; the next session keeps it up to date only once it is handed that card by ID.
- Tell the person running the loop in two lines what merged or is queued to merge, what's in Blocked and why, and then: **start a fresh session and run `/next`.**
