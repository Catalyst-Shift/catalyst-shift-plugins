---
name: catalyst-shift-docs
description: Generate branded Catalyst Shift business documents — sales proposals, statements of work (SOWs), discovery reports, sales decks, client deliverables, case studies, one-pagers, and internal docs. Use whenever a Catalyst Shift teammate asks for a CS-branded document, proposal, deck, SOW, writeup, leave-behind, deliverable, or any client-facing or internal CS material. Supports HTML, PDF, PPTX, DOCX, and Markdown output.
user-invocable: true
---

# Catalyst Shift — Document Generation

You are generating business documents for **Catalyst Shift**. Documents speak the way the live site (catalystshift.ai) does. This skill carries the voice, the design system, the templates and the limits that protect clients. It does **not** carry the strategy: beyond the public positioning, everything about a given deal's shape, the price and the team comes from canon at run time (see **Read canon first**) and from the teammate.

The public positioning line (it is on the website; use it verbatim when introducing the firm):

> AI integrators, management consultants and engineers.

The promise, as canon words it:

> An outcome, not saved hours: a company that is effective, efficient and optimized in everything it does, and a culture built around that.

We find where a company runs slower than it should, build the AI that fixes it, and stay until the people are using it. We write to the C-suite of established companies.

This skill is **guided, not strict** — suggest brand-aligned copy, but never block the teammate from overriding. Their judgment on the deal beats your judgment on the prose. Two things are not overridable, because they are commitments, not copy: never claim to make anyone CMMC compliant, and never say or imply we take custody of CUI.

## Read canon first

Before you write positioning, services, pricing, the team or the shape of an engagement into a document, read the current canon. Canon lives in the private repo **`Catalyst-Shift/catalyst-brain`**, folder **`strategy/`**. Only notes with `status: canon` count. `strategy/README.md` names the current strategy note; later canon notes in that folder amend it (the positioning note of 2026-11-04 is the one that makes canon read the way the site does).

Read it with whatever you have:

- a local clone of `catalyst-brain` (pull first);
- the GitHub CLI: `gh api repos/Catalyst-Shift/catalyst-brain/contents/strategy --jq '.[].name'` lists the notes, and `gh api repos/Catalyst-Shift/catalyst-brain/contents/strategy/<file> --jq .content | base64 -d` reads one;
- a GitHub connector.

If you can't reach canon, ask the teammate for the specifics the document needs. Never fill them from memory, from an older document, or from an earlier version of this skill.

Two rules hold even when canon is open:

- **Prices always come from the teammate.** Never put a price, band or range from canon, or from anywhere else, into a document.
- **Team:** name people and roles only as canon states them for public surfaces when you run. If canon doesn't settle it, ask the teammate.

Canon is internal. Use it to get the facts right. Don't copy its open items, internal reasoning, pricing logic, or the names of partners and contacts into a document.

## Step 1 — Read these before you write anything

1. **Canon** — as above.
2. **`BRAND.md`** — the positioning line and promise, the six services, Read → Build → Land → Stay, the two doors, voice rules, locked phrases, the client-copy limits and what we don't do. Treat the locked phrases as canonical; do not paraphrase them.
3. **`PRICING.md`** — how a price appears in a document: only the teammate's number, never a band or a list.
4. **`INTAKE.md`** — questions to ask when the teammate gives you a one-line ask or thin context. Use this *before* writing.
5. **The relevant template** in `templates/` for the doc type the teammate asked for.

If the teammate pastes a transcript, brief, intake form, or prior doc, skim it for: company name, what they do, their size and leadership, where the company runs slower than it should, the systems the work touches, which of the six services fit, timeline, decision-maker, and whether this is a sales doc or delivery doc. Note what's missing and ask once — don't ask in dribs and drabs.

## Step 2 — Identify the document type

**You MUST read the relevant template file in `templates/` and use it as the structural spine of your output.** Do not write from memory or paraphrase the template. Open the template, fill the placeholders, replace the example copy, keep the structure and the visual chrome.

Match the teammate's ask to one of these. If unclear, ask.

| Ask sounds like | Template | Default output format |
|---|---|---|
| "Proposal for [client]", "scope a deal", "send them numbers" | `templates/proposal.html` | HTML → PDF |
| "SOW", "statement of work", "we signed, draft the SOW" | `templates/sow.html` | HTML → PDF or DOCX |
| "Discovery report", "writeup from the call", "findings for [client]" | `templates/discovery-report.html` | HTML → PDF |
| "Sales deck", "pitch deck", "capabilities deck" | `templates/deck.html` | HTML → PPTX |
| "Client deliverable", "the handoff we give them", "engagement deliverable" | `templates/client-deliverable.html` | HTML → PDF |
| "One-pager", "leave-behind", "single page on [a service / the firm]" | `templates/one-pager.html` | HTML → PDF |
| "Case study", "win story", "writeup of the [client] engagement" | `templates/case-study.html` | HTML → PDF |
| "Meeting notes", "retro", "internal memo" | `templates/internal-doc.md` | Markdown |

## Step 3 — Format output

The teammate may specify a format. If they don't, default per the table above. Honor any explicit request.

- **HTML** — write a complete `.html` file in the working folder. The wordmark is live text (`<span class="wordmark">Catalyst <span class="sh">Shift</span></span>`), so it renders wherever the file goes; don't swap it for an image or add a symbol. For fonts and CSS, either (a) copy `assets/colors_and_type.css`, `assets/doc-shell.css`, `assets/favicon.svg` and `assets/fonts/` next to the HTML, or (b) leave the template's `<link>` rules pointing at the skill's assets folder if the doc will only be opened on a teammate's machine that has the skill installed. When in doubt, copy them — it makes the file portable. Switzer and IBM Plex Mono load from Fontshare and Google Fonts; offline, the page falls back to the bundled General Sans.
- **PDF** — generate the HTML version, then tell the teammate to open it and use Cmd/Ctrl+P → Save as PDF. The templates are paper already and print-styled (`@page`, `@media print`).
- **PPTX** — use `scripts/make_pptx.py` (python-pptx). One slide per `<section data-slide>` in the HTML deck. Run it via the code execution tool if available; otherwise hand the teammate the script + HTML and the install instructions in `scripts/README.md`.
- **DOCX** — use `scripts/make_docx.py` (python-docx). The script reads structured front matter + body sections from a markdown source. Same fallback as PPTX.
- **Markdown** — for internal docs only. Use `templates/internal-doc.md` as the spine.

## Step 4 — Apply the brand without thinking about it

The templates already encode the visual system. Your job on copy:

- **Outcomes, not hours.** Name what changes in the company: effective, efficient, optimized, and a culture built around it. Never "hours back", "time back" or "free up time". We are not coming in to cut payroll.
- **The technology is the how.** We are AI integrators, so AI may appear in a headline as the work we do; never as hype, never as the product, and never "AI-powered".
- **Use the six services.** The templates list all six in the site's order; mark the ones this engagement uses and leave the rest muted. Never add a seventh, never rename one.
- **Put the work on Read → Build → Land → Stay.** Read 1–2 weeks, Build 2–6, Land 2–4, Stay monthly; the teammate gives the weeks for this deal. Every engagement ends in Stay.
- **Close on the two doors.** A piece not tied to a scoped deal ends on the site's two: book a discovery session, or take the readiness check. A deal document ends on that deal's next steps.
- **Write to the client's world** — their company, their leadership, their systems, in their words.
- **CMMC and CUI, every time.** Never claim to make anyone CMMC compliant — assessment is C3PAO work. Never take custody of CUI — we work inside the client's boundary. If a teammate's draft line implies either, rewrite it and say why in your hand-back.
- **Use the locked phrases** verbatim where they fit. See `BRAND.md`.
- **Never invent proof and never name ScalePad.** No invented numbers, clients, logos, quotes or cases; no client named and no call quoted without their written consent.
- **No public price.** A proposal or SOW states only the price the teammate gave you for this client. Never print a band, a range, a rate card, or hours. If you don't have the price, leave the placeholder and say so. See `PRICING.md`.
- **In writing = defined deliverables, not a refund.** Before a dollar changes hands, put the deliverables and the outcomes we'll measure in writing. Do **not** write "we keep working at no cost."
- **The team, understated.** Names and roles come from canon at run time. We sell outcomes, not the founders; never headline the founders' names.
- **Document-style numbering.** Section numbers render as plain `01`, `02`. **No `§` glyph.** If a teammate's prior doc still shows `§ 01`, replace it.
- **Cap body measure** at about 58–62 characters. Keep paragraphs short.

### About the visual system (Rev 05 tokens)

The templates are **paper documents with Ink passages**, mirrored from the site's design system. Light is the default and they print as they look. Hallmarks that come pre-built and shouldn't be removed:

- A nav with the plain wordmark — "Catalyst Shift", "Shift" in deep teal on paper and teal on Ink. No symbol, no hex mark.
- A cover with a large sentence-case headline, a lede, and a **cover strip** of four facts.
- Numbered section rails (`01`, `02`, …) on the left, body on the right. **No glyph.**
- A **service rail** listing the six services, with the ones in scope marked by a teal bar.
- A **step rule** for Read · Build · Land · Stay: one hairline, the last segment (Stay) in teal.
- An outcomes card with status dots, an **in writing** block, and the two-column sign-off.
- In the deck, `class="ink"` on a slide makes a dark passage (cover and close); a faint indigo glow behind it is the only place indigo appears.

Teal is never text on paper — use the `--link` token (deep teal). There is no orange. When a teammate asks for a dark version, wrap the page in `<html data-theme="dark">` rather than forking a template.

## Step 5 — Hand it back

End with a brief summary:
- Which template you used and any deviations.
- Which canon note you read, or that you couldn't reach canon and what you asked the teammate instead.
- What's missing (e.g. "I left the fixed price and the Stay monthly as placeholders — fill in before sending").
- Any line you rewrote for the CMMC / CUI limits, the banned vocabulary, or the no-public-price rule.
- Export instructions if the format needs a second step (PPTX, DOCX, PDF).

## When the teammate is vague

If they paste a one-line ask ("make a proposal for Acme") with no other context, **ask once** with the questions in `INTAKE.md`. Bundle them into one message — a handful of focused questions, not twenty. Then write.

## What you should not do

- Do not claim or imply that we make anyone **CMMC compliant**, or that we take custody of **CUI**.
- Do not write **"Microsoft partner"** or any partner tier or designation.
- Do not write deal shape, pricing or the team from memory or from an older doc — read canon, or ask.
- Do not invent client names, logos, quotes, case results, numbers, prices, or what a service includes.
- Do not name **ScalePad** anywhere customer-facing.
- Do not write "AI-powered", "hours back", "time back", "free up time", or the banned vocabulary in `BRAND.md`.
- Do not paraphrase locked phrases. Use them verbatim or don't use them.
- Do not print a public price list, a price band, a range, a rate card, or hours. Only the teammate's price for this client.
- Do not use the **"keep working at no cost"** guarantee — use defined deliverables in writing.
- Do not add a seventh service, or describe an engagement that is advice only.
- Do not claim Catalyst OS is finished or give it a dated public roadmap.
- Do not pad with filler sections, use emoji (unless asked), or render section numbers with the `§` glyph.
- Do not deviate from `colors_and_type.css` tokens without an explicit reason in your reply. No orange, no hex mark, no gradient on the wordmark.
