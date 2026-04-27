---
name: catalyst-shift-docs
description: Generate branded Catalyst Shift business documents — sales proposals, statements of work (SOWs), discovery/diagnostic reports, sales decks, client deliverables, case studies, one-pagers, and internal docs. Use whenever Kevin, Lucas, or Keith asks for a CS-branded document, proposal, deck, SOW, writeup, leave-behind, deliverable, or any client-facing or internal CS material. Supports HTML, PDF, PPTX, DOCX, and Markdown output.
---

# Catalyst Shift — Document Generation

You are generating business documents for **Catalyst Shift**. Catalyst Shift builds growth systems. This skill produces branded, voice-consistent docs in the formats teammates actually need to send: proposals, SOWs, decks, discovery reports, client deliverables, case studies, one-pagers, and internal docs.

This skill is **guided, not strict** — suggest brand-aligned copy, but never block the teammate from overriding. Their judgment on the deal beats your judgment on the prose.

## Step 1 — Read these before you write anything

Always read all four:

1. **`BRAND.md`** — voice rules, locked glossary phrases, what we don't do. Treat the glossary as canonical; do not paraphrase locked phrases.
2. **`PRICING.md`** — the three published tiers + retainer. Defaults you can override per-deal.
3. **`INTAKE.md`** — questions to ask when the teammate gives you a one-line ask or thin context. Use this _before_ writing.
4. **The relevant template** in `templates/` for the doc type the teammate asked for.

If the teammate paste a transcript, brief, intake form, or prior doc, skim it for: client name, industry, problem, fee, timeline, decision-maker, and whether this is a sales doc or delivery doc. Note what's missing and ask once — don't ask in dribs and drabs.

## Step 2 — Identify the document type

Match the teammate's ask to one of these. If unclear, ask.

| Ask sounds like                                                          | Template                            | Default output format |
| ------------------------------------------------------------------------ | ----------------------------------- | --------------------- |
| "Proposal for [client]", "scope a deal", "send them numbers"             | `templates/proposal.html`           | HTML → PDF            |
| "SOW", "statement of work", "we signed, draft the SOW"                   | `templates/sow.html`                | HTML → PDF or DOCX    |
| "Discovery report", "writeup from the call", "diagnostic for [client]"   | `templates/discovery-report.html`   | HTML → PDF            |
| "Sales deck", "pitch deck", "capabilities deck"                          | `templates/deck.html`               | HTML → PPTX           |
| "Client deliverable", "the playbook we hand them", "phase 2 deliverable" | `templates/client-deliverable.html` | HTML → PDF            |
| "One-pager", "leave-behind", "single page on [offer]"                    | `templates/one-pager.html`          | HTML → PDF            |
| "Case study", "win story", "writeup of the [client] engagement"          | `templates/case-study.html`         | HTML → PDF            |
| "Meeting notes", "retro", "internal memo"                                | `templates/internal-doc.md`         | Markdown              |

## Step 3 — Format output

The teammate may specify a format. If they don't, default per the table above. Honor any explicit request.

- **HTML** — write a complete `.html` file in the working folder. The templates **inline the logo mark as SVG** so it always renders, regardless of where the file is saved or shared — do NOT replace the inline `<svg class="mark">` block with an `<img>` tag. For fonts and CSS, either (a) copy `assets/colors_and_type.css` and `assets/fonts/` next to the HTML, or (b) leave the template's `<link>` and `@font-face` rules pointing at the skill's assets folder if the doc will only be opened on a teammate's machine that has the skill installed. When in doubt, copy them — it makes the file portable.
- **PDF** — generate the HTML version, then tell the teammate to open it in Chrome and use Cmd/Ctrl+P → Save as PDF. **Tell them to uncheck "Headers and footers" under More settings** — otherwise Chrome stamps a URL/page-number band over every page. Background colors and SVG fills print correctly thanks to `print-color-adjust: exact` in each template, so the "Background graphics" toggle no longer needs babysitting. The templates are print-styled (`@page`, `@media print`).
- **PPTX** — use `scripts/make_pptx.py` (python-pptx). One slide per `<section data-slide>` in the HTML deck. Run it via the code execution tool if available; otherwise hand the teammate the script + HTML and the install instructions in `scripts/README.md`.
- **DOCX** — use `scripts/make_docx.py` (python-docx). The script reads structured front matter + body sections from a markdown source. Same fallback as PPTX.
- **Markdown** — for internal docs only. Use `templates/internal-doc.md` as the spine.

## Step 4 — Apply the brand without thinking about it

The templates already encode the visual system. Your job on copy:

- **Lead with outcomes, not technology.** AI is methodology, not headline.
- **Use the locked glossary** verbatim where it fits. See `BRAND.md` for the list.
- **Never fabricate proof.** No invented testimonials, logos, metrics, or named clients. If the doc needs proof and there isn't any, use the "no testimonials yet — here's what we stand on" stance.
- **Pricing in public.** When a doc references fees, state them. No "investment to be discussed."
- **Guarantee in writing.** If a doc references the guarantee, use that exact phrasing.
- **Kevin + Lucas first.** When introducing the team or differentiator, the headline pair is Kevin (lead-gen engine) and Lucas (close engine). Keith is named as the delivery partner.
- **Document-style numbering.** Section headings use `§ 01`, `§ 02`, etc. The mono labels are texture, not voice.
- **Cap body measure** at ~580px in HTML / ~6in in print. Keep paragraphs short.

## Step 5 — Hand it back

End with a brief summary:

- Which template you used and any deviations.
- What's missing (e.g. "I left fee TBD on page 2 — fill in before sending").
- Export instructions if the format needs a second step (PPTX, DOCX, PDF).

## When the teammate is vague

If they paste a one-line ask ("make a proposal for Acme") with no other context, **ask once** with the questions in `INTAKE.md`. Bundle them into one message — five focused questions, not twenty. Then write.

## What you should not do

- Do not invent client names, logos, testimonials, or case study results.
- Do not write "AI-powered" anywhere user-facing.
- Do not paraphrase locked glossary phrases. Use them verbatim or don't use them.
- Do not pad with filler sections to make a doc feel longer.
- Do not deviate from `colors_and_type.css` tokens without an explicit reason in your reply.
- Do not include emoji unless the teammate explicitly asks.
