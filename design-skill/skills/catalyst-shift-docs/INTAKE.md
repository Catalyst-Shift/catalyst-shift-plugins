# Intake — what to ask when context is thin

When a teammate invokes this skill with a one-line ask ("make a proposal for Acme"), you need more before you can write a credible doc. Ask in **one bundled message**, not piecemeal.

## Universal questions (always ask if missing)

1. **Client / company name** — and one line on what they do.
2. **MSP size** — **annual revenue band** ($1M–$4M beachhead / $500K–$10M eligible / out-of-scope) and **managed-client count** (15+ is the beachhead). *(Revenue and managed-client count are the parameters — not endpoints or headcount.)*
3. **Stack** — CRM + PSA (ConnectWise / Halo / Autotask / other) + RMM (NinjaOne / Datto / Atera / other) + ticketing.
4. **Decision-maker** — name, role (owner / COO), what they care about most.
5. **Stage** — first contact, post-listen call, post paid-assessment, post-signed agreement, or delivery phase.
6. **Format preference** — HTML/PDF, PPTX, DOCX, Markdown. Default per the table in `SKILL.md`.

## Doc-specific add-ons

### Proposal
- Has the **paid assessment ($2,500, credited)** been run? The assessment is what builds the custom proposal (scope + setup + per-client MRR). If not, the honest path is: scope the assessment first.
- Which **use case(s)** lead — M.01 The Operator Brief (the default first use case), M.02 Churn Early Warning, M.03 Proposal Generation, M.04 Pipeline Visibility, M.05 Authority Engine? (We sell the platform; use cases are the starting depth, not an à-la-carte menu.)
- Custom pricing for this deal from the assessment — one-time setup (credited) + per-client MRR. *(Do not publish a price list or fixed tiers.)*
- Is this an **early-adopter / design-partner deal** (reduced economics for product input, case-study rights, reference participation — all with deliverables in writing)?
- Is the prospect an **IBPI member** (15% setup + 10% Y1 MRR + 5% rebate) or **ASCII Spark**?
- Specific outcomes to put **in writing** — the deliverables and the outcomes we'll measure (e.g. first Operator Brief inside 30 days). *(Not "keep working at no cost.")*
- Integration scope — which systems does the synthesis layer read/write (CRM/PSA/RMM), and who owns access on the customer side?
- Any client-specific constraints (timeline, compliance — HIPAA / CMMC / SOC 2, data-use/zero-retention questions, multi-tenant)?

### SOW (statement of work)
- Has the proposal (from the assessment) been accepted? If not, write the proposal first.
- Final one-time setup (credited) + per-client MRR + payment schedule; annual term.
- Final deliverables and measured outcomes **in writing** — specific and measurable.
- Start date and integration kickoff (target: onboarding within 5 business days of signing, first outcome inside 30 days).
- Who's the CS lead? **Lucas leads revenue/relationship and is the client-facing signer; Kevin reviews technical scope.** (Keith is internal only — not on the SOW as a client contact.)

### Discovery report / assessment findings
- When was the listen call / paid assessment? Pull from transcript or notes.
- What problem(s) did the MSP surface? Use their words. Map to use case(s) where there's clear fit.
- What's the recommended starting depth — which use case(s) first (Operator Brief is the default), and the platform path from there.
- Did we commit to follow-up materials (the custom proposal) by a specific date?

### Sales deck
- Audience — single owner, leadership team, IBPI peer group, channel partner?
- Length — 8 / 10 / 12 / 14 slides?
- Are we leading with the **synthesis story** and the platform (default), or anchoring on a single lead use case (typically M.01 The Operator Brief)?
- Are we including the early-adopter framing and the paid-assessment front door?
- Any real proof points to feature? (If none, lean on the synthesis demo, the use-case framework, the Palantir precedent, and the founding-cohort narrative — never fabricate, never name ScalePad.)

### Client deliverable
- Which use case is this for (M.01–M.05) and which deliverable inside it (e.g. the actual Operator Brief)?
- What's the actual content the teammate has? (The skill formats and brands; it doesn't invent the work product.)
- Internal review or client-final?

### Case study
- **Has the engagement produced a measured outcome against the SOW?** If not, do not write a case study — propose a "founding-cohort update" or "principles in practice" doc instead.
- Client approval to use their name? If not, write it anonymized (industry + revenue/managed-client band + region). **Never name ScalePad.**
- Specific metrics — Operator Briefs delivered, churn caught, proposals sent-to-signed, forecast accuracy, pipeline velocity, content cadence. Use-case-specific, pulled from the SOW.

### One-pager
- What single thing is this for — the platform, a lead use case (M.01–M.05), the early-adopter program, the IBPI program, the paid assessment?
- Where will it be used — email attachment, in-person leave-behind, conference handout, IBPI peer-group share?

### Internal doc
- What kind — meeting notes, retro, decision memo, planning doc?
- Audience — the two co-founders, or extended (Keith on the build, advisor, IBPI)?
- Action items vs reference?

## When the teammate gives you a transcript

Read it once. Pull:
- Decision-maker name + role + what they kept coming back to
- Specific pain language they used (quote it back in the doc)
- Stack mentions (CRM / PSA / RMM / ticketing) — even partial
- Managed-client count and revenue band if mentioned
- Any explicit asks ("send us a proposal by Friday")
- Any deal-breakers (budget, timeline, must-haves, compliance, data-use concerns)

Then ask only what's *not* in the transcript.

## When the teammate gives you a prior doc to remix

Read it. Note what's reusable (structure, voice, sections) and what needs to change (client, size, stack, scope, use cases, fees, dates, outcomes). **If the prior doc uses v4.x/v3.x language** — five modules à la carte, named tiers (Foundation / Growth / Full Stack), public setup+MRR price lists, "QBR Automation" headline, the founder-named differentiator, "keep working at no cost," "vertical-first product-led firm" — flag it and rewrite to v5.2: product company, synthesis layer sold as a platform, use cases (M.01 The Operator Brief …), paid-assessment front door, custom pricing (no public list), two co-founders, defined-deliverables guarantee. Confirm the new client + scope, then write.
