# catalyst-shift-plugins — Claude project instructions

This repo holds the Catalyst Shift Claude Code plugins (`catalyst-ops`, `design-skill`). Its operating canon is the Ways of Working block below — the same block every Catalyst Shift surface carries.

## Ways of Working — Catalyst Shift

<!-- Canonical block. Byte-identical in: each repo's CLAUDE.md, the HQ project
     instructions, and the catalyst-ops plugin's ways-of-working skill. Change
     all copies in ONE Linear issue. Last synced: 2026-09-04 (replaced the
     2026-08-28 block: tiers 4→2, ship check 6→2, kanban, auto-land). -->

**Three homes.** Repos hold WHAT IS BUILT — the live repo beats any doc, deck, or
memory of build state. Linear holds WHAT IS HAPPENING — anything with a date, a
dependency, or a deliverable is an issue; unfiled work does not exist. SharePoint
`/sites/hq` holds WHAT WE DECIDED AND PRODUCED — rulings and deliverables, never
drafts (from a cloud session, write via the m365 CLI and verify it landed).
Chat is where work gets done, never where it is kept. When recording a decision,
apply the `decision-governance` skill (proposed vs decided).

**How we build.** The method is `docs/HOW_WE_BUILD.md` in `catalyst-os-platform`.
Short form:

- **The issue is the spec.** Work starts from a Linear issue with an acceptance
  checklist. No checklist, no start.
- **Kanban.** Top card in Todo is next. One In Progress per person. No weekly ritual.
- **Two kinds of PR**, named in the title: `[concept]` lands on CI green + verifier
  pass; `[harden]` adds `/review` at depth, tests, docs. Most work is concept work.
- **Two tiers.** Red = the paths the protected-paths hook names (auth, tenant,
  audit, migrations, secrets, CI, canon). Red gets `/cso` and a human merge, always;
  the `protected-paths` CI job blocks it without a human `red-approved` label, which
  an agent never applies. Everything else is Normal and may auto-land.
- **Verify before ship.** `/verify`: a fresh-context agent reads only the diff and
  the checklist, returns PASS/FAIL with evidence, never edits. Three fails → stop.
- **Ship with `/ship`** (runs `/review` once), land with `/land-and-deploy`. Close
  the issue with version + PR number. File what surfaced.
- **Stop on product forks.** Product, UX, pricing, or architecture decisions are
  asked, never resolved by picking the cheapest path.
- **Rules are code.** A new rule becomes a test, a hook, or a CI job — or it is not
  added. Recurring misses go to `/learn` and then to a check.
- **Public claims are backed.** Copy about what the product does is checked against
  the platform repo's connector table; the site's claim-check test enforces it.
- **Stack changes name a retirement.** Every automation has one owner and one
  checkable output. Verify capabilities in the product, not in vendor docs.
