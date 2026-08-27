---
name: decision-governance
description: Guard how decisions get recorded for Catalyst Shift — in Linear issues, in HQ documents, and against canon. Use whenever you are about to file, retitle, or update an issue that asserts a decision; whenever you generate a document that cites one; and whenever your output would change strategy, pricing, ICP, positioning, what we sell, or commit us to an external partner. Also use when Kevin, Lucas, or Keith says "we decided", "we're going with", "this supersedes", or asks you to amend canon.
user-invocable: true
---

# Catalyst Shift — Decision Governance

**One person cannot ratify canon. Neither can an agent acting for one person.** Canon-touching decisions require both founders. (Ruled by Kevin, 2026-08-27.)

This is a **write-time guard**. It fires when you are about to *record* something — a ticket, a document, an amendment — not while you are thinking, drafting, or arguing. Reasoning freely about a direction is the job. Stamping it as settled is the risk.

## Check 1 — Never attribute agreement to someone who isn't here

Before writing any decision line, ask: **is every person named in it present in this conversation?**

If not, you may not write their name into it, and you may not write `DECIDED`.

| Situation | Write this |
|---|---|
| One teammate reached a position | `PROPOSED: <thing>` — name that one owner |
| A ratification record exists (Check 5) | `DECIDED: <thing>` |
| A teammate tells you the other founder agreed | `DECIDED: <thing> (per <teammate>, <date>)` — record who told you |

This is not a style preference, it is the specific defect this skill exists to prevent. In August 2026 a session filed a Linear issue titled *"DECIDED (2026-08-26, Kevin + Lucas)"* asserting it superseded canon §10. Kevin had not agreed and was not in that session. The claim propagated into five child issues and into a filed HQ workbook before anyone caught it.

## Check 2 — Is this canon-touching?

Only ask the question when the answer can matter. A decision is canon-touching if it changes:

1. the strategy doc (`Strategy and Canon/CatalystShift_Strategy_v<current>.md`)
2. pricing, or the front door into an engagement
3. ICP or beachhead
4. the positioning line — what we say we are
5. what we sell, or what we refuse to sell
6. an external commitment to a partner, association, or vendor

**Anything else: one owner decides, file it, move on.** Do not slow ordinary work down. This rule exists for those six, not for the tracker generally.

> **Do not hardcode what canon currently says — not here, not in any skill.** Read the current strategy doc at decision time. Plugins go stale (this repo's document skill has been re-aligned across four strategy versions); canon must have exactly one home.

## Check 3 — Children inherit their parent's state

If a parent issue is `PROPOSED`, **every child is `PROPOSED`.** When you spawn sub-issues off a proposal:

- Write *"if `<parent>` is ratified, X"* — never *"per `<parent>`, we now want X."*
- Do not set due dates that assume ratification.
- Do not open external work off an unratified parent — no emails, calls, or listings positioned as commitments.

When a parent is retitled from `DECIDED` to `PROPOSED`, **the retitle is not the fix.** Sweep the children in the same pass, and sweep description bodies, not just titles. A title change is a label; it propagates nothing on its own.

## Check 4 — The state travels to the artifact

Any document, spreadsheet, or deck generated off an unratified decision carries a banner on its first readable surface — cover, README sheet, or opening paragraph:

> ⚠️ **PROPOSED — not ratified as of `<date>`.** Canon v`<current>` stands. Do not treat as company direction.

A Linear ticket gets read for a week. A document in `/sites/hq` gets read for years, by someone who was not in the room.

## Check 5 — What counts as ratification

Exactly one of:

- **both founders on the issue thread, explicitly**, or
- **the amendment landing in the strategy doc**

**Silence is not consent.** A live conversation that ended without an explicit "no" is not a yes — that is how the August 2026 episode started. If you are asked to record a decision and you cannot point at one of those two, it is `PROPOSED`.

## What this skill must not become

**Do not make proposing expensive.** A serious, well-argued proposal filed as `PROPOSED` is exactly what should happen — the failure mode above was the *label*, not the act. The proposal in question was good work, and its author built the analysis that undercut his own case.

So: do not lecture, do not add ceremony to ordinary tickets, never refuse to write a proposal, and never withhold the reasoning that makes one persuasive. Set the label correctly, sweep the children, banner the artifact, and get out of the way.

Recording provenance is the job. Policing colleagues is not.
