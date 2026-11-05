# catalyst-shift-plugins — Claude project instructions

This repo holds the Catalyst Shift Claude Code plugins (`catalyst-ops`, `design-skill`). Its operating canon is the Ways of Working block below — the same block every Catalyst Shift surface carries.

## Rules and what enforces them

Each rule is a row: the rule, what makes it impossible to break (a test, a lint,
a CI step; "judgment" only when no command can see it), and the card it came
from. `/correct` (catalyst-ops) adds the enforcing check to a row and deletes the
prose line a check makes redundant; a repeated rule with nothing enforcing it is
fixed in the same change. This section sits above the Ways of Working block on
purpose: the block is byte-identical across surfaces and ends the file.

| Rule | Enforced by | Source card |
|---|---|---|
| The Ways of Working block is byte-identical in CLAUDE.md and the ways-of-working skill | `validate` step "The Ways of Working block is byte-identical" | CAT-1297 |
| A deep path (`.github/`, CLAUDE.md, manifests, hooks, the ways-of-working skill, the checkers) needs a code-owner approval | `.github/CODEOWNERS`, mirrored by `scripts/protected-paths.mjs` and `tests/protected-paths.test.mjs` | CAT-1243 |
| A PR merges only with `Reviewed: <head sha>` in its body | `review stamp` check (`.github/workflows/review-stamp.yml`) | CAT-1299 |
| The dispatcher and installer are valid bash, hardcode no home path, and every `claude` / `systemd-run` call reads stdin from `/dev/null` | `tests/factory.test.mjs` | CAT-1298 |
| A `factory-reflect` or `/correct` PR never touches a gate (`.github/`, rulesets, CODEOWNERS, required checks, the Ways of Working block, the ways-of-working skill) | `validate` step "A factory-reflect or /correct PR touches no gate", `scripts/retro-guard.mjs`, `tests/retro-guard.test.mjs` | CAT-1433 |
| A running-cap check in the dispatcher asks `-lt "$CAP"`, so a non-numeric cap holds sessions back instead of starting them | `tests/factory.test.mjs` "every running-cap check … asks -lt" | CAT-1478 |
| A merged factory PR is retro'd once: `retro: clean` or a `/reflect` session | `tests/factory-retro.test.mjs` | CAT-1433 |

## Ways of Working — Catalyst Shift

<!-- Canonical block. Byte-identical in: each repo's CLAUDE.md, the HQ project
     instructions, and the catalyst-ops plugin's ways-of-working skill. Change
     all copies in ONE Linear issue. Last synced: 2026-10-23 (CAT-1297 and
     its build-out cards; canon: catalyst-brain
     strategy/2026-10-23-claude-dev-factory.md, amending strategy v6.4.
     REMOVED: /next as the pickup loop, auto-merge on everything, the
     adversarial review CI check, pstack, HOW_WE_BUILD.md as the method doc,
     Karen. ADDED: the Ready For Factory dispatcher on Kevin's and Keith's
     Omarchy machines, gstack, the local review stamp, merge stages, review
     by risk, the 3-PR review cap). Amended 2026-11-05 (CAT-1512): green
     merges itself by stage, a red founder gate is merged by hand, any
     other red check is fixed. -->

**Three homes.** Repos hold WHAT IS BUILT — the live repo beats any doc, deck, or
memory of build state. Linear holds WHAT IS HAPPENING — anything with a date, a
dependency, or a deliverable is an issue; unfiled work does not exist. SharePoint
`/sites/hq` holds WHAT WE DECIDED AND PRODUCED — rulings and deliverables, never
drafts (from a cloud session, write via the m365 CLI and verify it landed).
Chat is where work gets done, never where it is kept. When recording a decision,
apply the `decision-governance` skill (proposed vs decided).

**How we build: the Claude dev factory.** Canon is
`strategy/2026-10-23-claude-dev-factory.md` in `catalyst-brain`. **Code repos
only:** strategy, documents and Cowork sessions follow the three homes and
`decision-governance`, and ask before anything is decided or sent. Short form:

- **The card is the spec.** A Linear card with why it matters, 3–8 executable
  checklist lines (a command, a URL with its expected state, or a DB/API
  assertion), a risk class and a rollback line. High risk = migrations, auth,
  RLS, payments, env or deploy config, data deletion. No checklist → Claude
  drafts one with `/spec` and posts it. Kevin or Keith moves the card to
  Ready For Factory.
- **The factory picks it up.** Kevin and Keith each run the factory on their own
  Omarchy machine. A dispatcher checks Ready For Factory every 5 minutes and
  starts one unattended Claude Code session per card in its own worktree, up to
  a running cap. It starts nothing new while 3 factory PRs wait on review.
  Sessions are also started and steered by hand from Claude desktop or mobile
  through Remote Control. Either way: the card goes to In Progress, one card per
  session, and the branch comes from fresh `origin/main`.
- **Build with gstack.** `/investigate` for bugs. Before the push: `/review` on
  the diff, `/cso` when it touches a deep path, `/qa` on the Vercel preview,
  and everything CI runs. `/ship` opens the PR.
- **A fresh session reviews it.** A session that didn't write the code runs
  `/review` on the PR (`/cso` too on a deep path), fixes or answers each
  finding, and adds `Reviewed: <head sha> — <what ran>` to the PR body. The
  `review stamp` CI check (no model, no cost) fails unless that sha is the
  PR's head commit, so a new push needs a new review. The dispatcher does this
  for factory cards; by hand, start a new session for it.
- **The PR carries the evidence.** Title `[concept]` or `[harden]` plus the card
  ID. Body: card link, risk class, each checklist line with its evidence, what
  deliberately didn't change, rollback, and **Decisions made**. An
  investigation card ends with findings and a proposed fix on the card.
- **People merge, by stage.** Stage 1, where every repo starts: Kevin or Keith
  merges everything, and nobody turns on auto-merge. After 15 clean PRs a repo
  moves to stage 2 (low risk merges itself); after 40 clean self-merges, to
  stage 3 (medium too). Any revert or escaped bug drops the repo one stage, and
  the fix ships with a test or lint rule. High risk is always reviewed by Kevin
  or Keith. Where its stage allows, green merges itself. A red `founder gate`
  check (High risk, a deep path, or Dependabot) means Kevin or Keith reads the
  proof and merges by hand; the factory never merges or turns on auto-merge
  past it. Any other red check is fixed, never merged past.
- **Review by risk.** Low: skim the evidence. Medium: read the evidence and the
  diff. High: full review plus a click-through on the preview.
- **Recommend, ask, keep going.** On a product, UX, pricing or architecture fork:
  pick a recommendation, ask if someone is watching, keep building on it, and
  record it under Decisions made. An unattended session that can't build the card
  without guessing at a product decision comments what it needs and moves the
  card to Blocked.
- **Hard stops** (only with Kevin's or Keith's yes in the session; unattended →
  Blocked): running a change against a production database, deleting or
  overwriting customer data, pricing or public product claims, anything sent to
  a client or outside person, spending money or a new subprocessor, credentials,
  weakening a rule (CI, review, deep-path list, required tests, canon). No
  production database credentials on a factory machine.
- **Rules are code.** A new rule becomes a test, a hook, or a CI check. Misses go
  to `/learn`, then to a check.
- **Public claims are backed.** Copy about what the product does is checked against
  the platform repo's connector table; the site's claim-check test enforces it.
- **Stack changes name a retirement.** Every automation has one owner and one
  checkable output. Verify capabilities in the product, not in vendor docs.
