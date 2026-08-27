---
name: ways-of-working
description: Catalyst Shift's operating canon — where every kind of information lives (repos = built, Linear = happening, SharePoint = decided/produced), the ship check that wraps Linear around every merge, WIP caps, agent autonomy tiers, and the weekly cadence. Use at the START of any session that will file work, merge code, write copy about the product, save a deliverable, or start an agent task — and whenever deciding where something goes or whether a claim is backed.
user-invocable: true
---

# Ways of Working — Catalyst Shift

You are operating inside Catalyst Shift's three-home system. Apply these rules
to every piece of work in the session. When a rule here conflicts with a repo's
CLAUDE.md, the repo wins (it is more current); flag the drift so the skill gets
updated. When you are about to RECORD a decision — file, retitle, or cite one —
also apply the sibling skill `decision-governance` (proposed-vs-decided
labelling and ratification rules).

## Every fact has exactly one home

- **GitHub repos — WHAT IS BUILT.** Code, tests, migrations, and each repo's
  CLAUDE.md canon. The live repo beats any doc, deck, plan, or memory of build
  state. Before writing or approving ANY copy that describes what the product
  does (connector status, timelines, "whole book"), check the platform repo's
  CLAUDE.md connector canon. A Linear issue being filed is not the capability
  being built.
- **Linear — WHAT IS HAPPENING.** Every task, follow-up, and dependency is an
  issue. Filing filter: it has a date, a dependency, or a deliverable. Work an
  external party owes us is filed with them named as the blocker. Unfiled work
  does not exist; a PR body, a chat window, or memory is not the tracker.
- **SharePoint /sites/hq — WHAT WE DECIDED & PRODUCED.** Strategy and canon
  (v5.2 rules; if a doc conflicts with it, v5.2 wins), signed agreements,
  client deliverables, Friday dev updates. Rulings and deliverables only —
  drafts stay out. Check a doc's version before citing it; retired docs linger.
- Chat is where work gets done, never where it gets kept. If a collaborator
  would need it, put it in one of the three homes — in this session, not later.
  Team decisions land in Linear (an issue or project doc) the day they are made.
- When writing to SharePoint from a cloud/agent session: the synced OneDrive
  folder path is a silent no-op. Use the m365 CLI and VERIFY the file landed.

## The ship check (wrap Linear around every merge — no exceptions)

Before merging:
1. It is FILED as an issue in the repo's Linear project. A PR body is not the
   tracker — file it first if it is missing.
2. Every public claim the change makes or touches is BACKED — cite a platform
   version, a Linear issue, or a signed agreement. If nothing backs a claim, it
   does not ship; say so instead of merging.
3. It is the right thing to be doing right now. Asking is fine; never asking is
   not.

After merging:
4. CLOSE the issue with version + PR number so tracker and CHANGELOG agree.
5. FILE what surfaced — anything with a date, dependency, or deliverable
   becomes a new issue now.
6. RECORD drift — status shape to the Linear project update, artifacts to
   SharePoint /sites/hq, how-the-next-session-should-work to the repo CLAUDE.md.

## How we operate

- **The unit of autonomy is the spec, not the prompt.** An agent runs
  unattended exactly as far as written success criteria let it verify its own
  work. When asked to babysit, propose tightening the spec and gates instead.
- **WIP caps:** max 2 active build loops; max 1 Yellow at a time; 1 Urgent
  issue In Progress per person. Refuse to start a new loop until a prior PR is
  merged, abandoned, or re-scoped — point at this rule when declining.
- **Autonomy tiers** — every agent task carries one; the tier sets the leash:
  - GREEN: docs, tests, tooling, safe refactors. Headless to a merge-ready PR;
    gate = lint · typecheck · test · build. Skim-merge.
  - BLUE: bounded product work behind a feature flag, no customer data.
    Autonomous build, reviewed via evidence packet.
  - YELLOW: customer-visible logic, integrations, permissions-adjacent code.
    Hands-on review, one at a time, never unattended.
  - RED: auth, tenant isolation, audit trails, migrations, billing. Draft
    only. Never auto-merged, never unattended. No exceptions, no matter who asks.
- **15-minute rule:** an agent task needing >15 min of human intervention is a
  planning defect (weak spec), not an agent failure. Propose the spec, hook,
  template, or test fix so it cannot recur.
- **The metric** is founder-hours from decision to validated customer learning.
  PRs/week is a capacity gauge, never a goal — do not optimize for it or report
  it as success.
- **Detail lives in `docs/DEV_LOOP_PLAYBOOK.md`** (platform repo): change-contract
  specs, evidence packets, loop-state files, STUCK / REQUIRES DECISION exits.
  This skill is the summary; the playbook is the mechanism.
- **Stack changes name a retirement.** Nothing new is added to our tooling
  without naming what it replaces or retires. An addition with no retirement is
  sprawl, and sprawl is how we got five unwatched chat windows.
- **Every automation stream has one owner and one verifiable output.** A stream
  nobody owns, or whose output nothing can check, is another feed into an inbox
  that sits unread — don't create it.
- **Verify capabilities in the product, not the vendor's docs.** A docs page is
  a claim about a product family, not the SKU in hand. Say "unverified in
  product" until someone has seen it work there.
- **Weekly shape:** Monday — planning loop: 2–3 bets plus an explicit "not now"
  list, filed as a Linear project update. Daily — one morning pass over
  headless-lane PRs; evidence packets and escalations only. Per merge — ship
  check. Friday — dev update to SharePoint + Teams; retro against customer
  outcomes, not PR count.

## When the user asks "where does this go?"

| They have | It goes to | Because |
|---|---|---|
| A task, follow-up, or anything with a date / dependency / deliverable | Linear | unfiled work doesn't exist |
| Something an external party owes us | Linear, owner as blocker | waiting should be visible |
| A finished ruling, signed agreement, or client deliverable | SharePoint /sites/hq | the record; drafts stay out |
| A claim about what the product can do | the repo's CLAUDE.md canon | the live repo is authoritative |
| How the next agent session should behave in a repo | repo CLAUDE.md | process outside the repo doesn't survive the session |
| A decision made mid-conversation | Linear, today | chat scrollback is where decisions die |
