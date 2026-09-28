# catalyst-shift-plugins — Claude project instructions

This repo holds the Catalyst Shift Claude Code plugins (`catalyst-ops`, `design-skill`). Its operating canon is the Ways of Working block below — the same block every Catalyst Shift surface carries.

## Ways of Working — Catalyst Shift

<!-- Canonical block. Byte-identical in: each repo's CLAUDE.md, the HQ project
     instructions, and the catalyst-ops plugin's ways-of-working skill. Change
     all copies in ONE Linear issue. Last synced: 2026-09-28 (HOW_WE_BUILD v2.
     REMOVED: human Red merge + red-approved label, attended-only Red, /verify +
     verify-gate, stop-and-wait on forks, /land-and-deploy as the landing path.
     ADDED: /next pickup, adversarial review as a required check, auto-merge on
     everything, recommend-ask-proceed, hard stops, 650k context budget). -->

**Three homes.** Repos hold WHAT IS BUILT — the live repo beats any doc, deck, or
memory of build state. Linear holds WHAT IS HAPPENING — anything with a date, a
dependency, or a deliverable is an issue; unfiled work does not exist. SharePoint
`/sites/hq` holds WHAT WE DECIDED AND PRODUCED — rulings and deliverables, never
drafts (from a cloud session, write via the m365 CLI and verify it landed).
Chat is where work gets done, never where it is kept. When recording a decision,
apply the `decision-governance` skill (proposed vs decided).

**How we build.** The method is `docs/HOW_WE_BUILD.md` (v2) in
`catalyst-os-platform`. Claude builds, attacks, ships and merges; Kevin clears
Blocked and starts fresh sessions. **Code repos only:** strategy, documents and
Cowork sessions don't use `/next`, auto-merge or the CI reviewer — they follow
the three homes and `decision-governance`, and ask before anything is decided or
sent. Short form:

- **The issue is the spec.** A Linear issue with an acceptance checklist checkable
  from the diff. No checklist → Claude drafts one with `/spec`, posts it, starts.
- **Pickup is `/next`.** Top Todo card for this repo → In Progress → build → PR
  with auto-merge on → next card. One card per session at a time; don't wait on
  merges. Context budget 650k: no new card past ~450k; at 650k post a handoff on
  the card and tell Kevin to start a fresh session.
- **Attack before and after the push.** In session: `/review`, then
  `scripts/codex-pass.sh adversarial`; `/cso` on deep paths. In CI: the required
  `adversarial review` check — a fresh model with the diff, PR body and read-only
  files — fails on unmet checklist lines, security holes, data loss, wrong money,
  unbacked public claims, weakened tests, or tampering with CI/reviewer/rules.
  Three fails on one card → Blocked, move on.
- **Everything auto-merges.** `/ship`, then `gh pr merge --auto --squash`. No
  human label, no merge click. PR title carries `[concept]` or `[harden]`; body
  ends with **Decisions made**.
- **Deep paths** (the protected-paths list: auth, tenant, audit, crypto, egress,
  persist, migrations, payments, CI, canon) set review depth, not a gate: `/cso`
  in session, CI review on the stronger model, migrations replayed on a prod-shaped DB.
- **Recommend, ask, keep going.** On a product, UX, pricing or architecture fork:
  pick a recommendation, ask Kevin in a popup, keep building on it, record it
  under Decisions made. **Hard stops** (only with Kevin's yes in-session; else
  Blocked): running a change against a production database, deleting or
  overwriting customer data, pricing or public product claims, anything sent to
  a client or outside person, spending money or a new subprocessor, credentials,
  weakening a rule (CI, reviewer, deep-path list, required tests, canon).
- **The judge can't be edited by the judged.** The reviewer's workflow and prompt
  live under `.github/workflows/`, which the agent token cannot push; it runs from
  `main` via `pull_request_target`. Never widen the agent token.
- **Rules are code.** A new rule becomes a test, a hook, or a line in the
  reviewer's fail list. Misses go to `/learn`, then to a check. Re-tighten only
  when an auto-merged change hurts a customer, and only for that class of path.
- **Public claims are backed.** Copy about what the product does is checked against
  the platform repo's connector table; the site's claim-check test enforces it.
- **Stack changes name a retirement.** Every automation has one owner and one
  checkable output. Verify capabilities in the product, not in vendor docs.
