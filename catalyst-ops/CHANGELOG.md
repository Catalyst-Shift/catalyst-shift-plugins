# Changelog — catalyst-ops

## 0.6.2 — 2026-10-24

- `/next` skips a card whose Linear "blocked by" issues aren't all Done, Canceled or Duplicate, and adds "blocked by" relations when it drafts a card that depends on another. After claiming, it checks the project's other In Progress cards: if one that went In Progress earlier would change the same files or tables, the card goes back to Ready For Factory, blocked by that card. Only the later card waits, so two cards never block each other. (CAT-1319)

## 0.6.1 — 2026-10-23

- `decision-governance`: the cautionary example no longer names people or internal dates, and the canon pointer is `Catalyst-Shift/catalyst-brain` `strategy/` (this repo is public; CAT-1303).

## 0.6.0 — 2026-10-23

- Karen is retired; verification is gstack `/qa` on the PR's non-production preview plus the review stamp (CAT-1300; canon: catalyst-brain `strategy/2026-10-23-claude-dev-factory.md` → Verification). The Ways of Working block is resynced byte-identically in `CLAUDE.md` and the `ways-of-working` skill: the new "A fresh session reviews it" bullet, Karen under REMOVED, and the new Last synced line.
- `/next` §5: after the PR opens, a separate fresh session (not the one that built the card) runs `/review` (plus `/cso` on deep paths), fixes or answers each finding, and writes `Reviewed: <40-char head sha> — /review[, /cso][, /qa]` into the PR body; the `review stamp` CI check (CAT-1299) fails unless the sha is the PR's head. Run by hand, `/next` tells the person to start a new session for it; with nobody watching, it spawns a fresh subagent that sees only the diff and the card, and re-reviews after any fix it pushes.

## 0.5.0 — 2026-10-23

- The Claude dev factory (CAT-1297; canon: catalyst-brain `strategy/2026-10-23-claude-dev-factory.md`). The Ways of Working block is resynced byte-identically in `CLAUDE.md` and the `ways-of-working` skill: gstack, the Ready For Factory dispatcher on Kevin's and Keith's Omarchy machines, merge stages, review by risk, the 3-PR review cap; `/next` as the pickup loop, auto-merge on everything, the adversarial review CI check, pstack and HOW_WE_BUILD.md as the method doc are gone.
- `/next` is now the by-hand way to build one card: the given card, or the top Ready For Factory card for this repo's project, claimed and moved to In Progress, branched from fresh `origin/main` in its own worktree, built with gstack (`/investigate`, `/review`, `/cso` on deep paths, `/qa` on the preview, `/ship`), and shipped as a PR whose body carries the evidence (risk class, checklist lines with evidence, rollback, Decisions made). It never turns on auto-merge or merges (stage 1), and moves the card to Blocked on hard stops. Removed: the adversarial-review ruleset preflight, `gh pr merge --auto`, the CI review-fail handling, the codex adversarial pass, and the 650k context-budget loop. Kevin or Keith runs it, and either can give a hard-stop yes.

## 0.4.2 — 2026-10-16

- `/next`: in a fragment repo (fresh `origin/main` has a `changelog.d/` directory), a PR adds one new fragment in the format `changelog.d/README.md` gives (or the existing fragments show), and leaves `VERSION`, `CHANGELOG.md`, the project's own version in `package.json` and its lockfile, and other fragments untouched. `/next` doesn't run `/ship` there, because `/ship` bumps, commits and pushes in one run. It follows the repo's own open-PR command, if there is one, only up to the push; then it runs the repo's full verify and the last §3 pass on the complete diff, and only then commits, pushes and opens the PR. A release card runs the repo's `/release` the same way, with its pre-open checks before the push; its PR takes the title `/release` gives, and its card closes with the version. Other repos bump per PR through `/ship` as in 0.4.1. §3's re-attack rule names whichever of the two the repo uses. A merged card closes with its PR number, plus its version only where the repo bumps per PR. The pickup table now names the repo `nourish-enablement`; its Linear project stays `nourish-rep-enablement`. Without this, `/next` in nourish-enablement (CAT-1160) would bump `VERSION` and fail its changelog check. (CAT-1163)

## 0.4.1 — 2026-09-29

- `/next`: preflight (before the first card and before each auto-merge) stops the loop unless `main` enforces `adversarial review` from GitHub Actions in a ruleset the merging identity can't bypass. Checklist lines state outcomes, never tool names, with evidence the CI reviewer can read. gstack is the in-session method, not a gate (every-card / when-it-fits / not-in-/next table). A missing gstack skill means getting the same outcome another way, noted in the PR body, never Blocked, except the canon's §3 attack steps (`/review`, the cross-model adversarial pass, `/cso` on deep paths) and `/careful` on deep paths. A missing, failed, early-stopped or partial §3 run means Blocked, and §3 re-runs on anything edited after it. Deep-path detection uses every path the PR can carry (committed since the merge base, staged, unstaged, untracked; renames off; pipefail) and treats any error as deep. The version and CHANGELOG bump happens before the last §3 pass. After a CI review fail, fix every blocking finding, re-run §3, and push once; an infrastructure-only fail is re-run (or, where the token can't re-run, retried with an empty commit) and still counts toward the three fails; the fail comment must match the current head and the failed run attempt. (CAT-783)

## 0.4.0 — 2026-09-28

- `/next` pickup loop; verify skill and verify-gate hook retired; HOW_WE_BUILD v2 block. (CAT-752, #16)
