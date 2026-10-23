# Catalyst Shift Docs — Skill for Claude Desktop

A Claude skill that generates branded Catalyst Shift documents — proposals, SOWs, discovery reports, sales decks, client deliverables, case studies, one-pagers, and internal docs — in HTML, PDF, PPTX, DOCX, or Markdown.

Built for the Catalyst Shift team. Same brand, same voice, same templates, every time.

> **This skill carries no strategy.** Positioning beyond the public line, offers, markets, pricing, the team and engagement shape are read at run time from the current canon in `Catalyst-Shift/catalyst-brain` `strategy/` (`status: canon` notes only). If Claude can't reach canon, it asks you for the specifics. Prices always come from you.

---

## What it does

You ask Claude something like:

> "Make a CS proposal for Acme Machining — Workplace Readiness. They're a 60-person defense subcontractor on commercial M365, migrating to GCC High, no Copilot yet, CMMC Level 2 coming up on their prime's contract. Price and care monthly are in my notes below."

Claude reads current canon, reads the skill, asks any missing questions in one bundle, and writes a full proposal into your working folder. Same for SOWs, discovery reports, decks, etc.

The skill carries the public positioning line, the spine, the client-copy limits (no public price, never claim CMMC compliance, never hold CUI, no "keep working at no cost," no fabricated proof, never name ScalePad), the locked glossary, the defined-deliverables guarantee, the template structures, and the visual system. Canon supplies the strategy; you provide the deal-specific content and the price.

---

## What's inside

```
catalyst-shift-docs/
├── SKILL.md                  # entry point Claude reads first; "Read canon first"
├── BRAND.md                  # public positioning line, spine, client-copy limits, voice, glossary
├── PRICING.md                # how a price appears in a doc: the teammate's number only
├── INTAKE.md                 # questions to ask when context is thin
├── README.md                 # this file
├── assets/
│   ├── colors_and_type.css   # design tokens (mirrors live site, v2)
│   ├── doc-shell.css         # shared dark-doc shell — nav, hero, sections, module-frame
│   ├── mark-dark.svg         # favicon / inline mark
│   └── fonts/                # General Sans + DM Sans + Plex Mono (self-hosted)
├── templates/                # dark, screen-first; print to white via Cmd/Ctrl+P
│   ├── proposal.html
│   ├── sow.html
│   ├── discovery-report.html
│   ├── deck.html             # 1280×720 slides; export with the PPTX skill
│   ├── one-pager.html
│   ├── case-study.html
│   ├── client-deliverable.html
│   └── internal-doc.md
└── scripts/
    ├── make_pptx.py          # HTML deck → PPTX
    ├── make_docx.py          # Markdown → DOCX
    └── README.md             # script usage
```

---

## Install (per teammate)

This skill ships as part of the **`catalyst-shift-plugins`** plugin. The recommended install is via the plugin sync, not a manual file copy.

### Recommended — Cowork plugin sync

1. Open Cowork → **Customize** → **Plugins**.
2. Find **`catalyst-shift-plugins`** in the list.
3. Click **Sync**. Accept the latest version when prompted.
4. **Quit and reopen Cowork.** This forces a clean reload of the templates folder.

To confirm you're on the current build, check the plugin version in the Customize panel matches the latest tag in the `Catalyst-Shift/catalyst-shift-plugins` repo on GitHub.

### Manual install (advanced)

If you need the skill files directly (testing, offline use, etc.):

**Mac**

```bash
mkdir -p "~/Library/Application Support/Claude/skills"
# Drop the catalyst-shift-docs folder into that directory.
```

**Windows**

```
%APPDATA%\Claude\skills\
```

Drop the `catalyst-shift-docs` folder in. Restart Claude Desktop.

---

## How to invoke it

Ask Claude in plain English. The skill description fires on phrases like:

- "Write a Catalyst Shift proposal for [client]…"
- "Draft an SOW for [client] — price and care monthly attached, start May 15."
- "Make a CS discovery report from this call transcript…"
- "Build a 10-slide CS deck for [audience]."
- "Generate a one-pager on **Workplace Readiness**."
- "One-pager for [an industry]."
- "I need a case study writeup for [client] — here are the outcomes…"
- "Format this as a CS client deliverable."
- "Internal doc: co-founder sync notes from today."

Or, vaguer:

- "Make a CS proposal." → Claude will ask the intake questions in `INTAKE.md`.

You can also paste a call transcript, an assessment, or a prior doc and Claude will use it. If the prior doc doesn't match current canon, Claude flags what's out of date and rewrites it to canon.

---

## Quick reference

**Canon first:** for positioning, offers, markets, pricing, the team and engagement shape, Claude reads `Catalyst-Shift/catalyst-brain` `strategy/` (`status: canon`) through a local clone, `gh api`, or a GitHub connector. No access → it asks you.

**Public line:** "We sell outcomes to small businesses. We deliver them with our own tooling at a cost nobody can match, and we're accountable for the result. The software is how we do it, not what we sell."

**The spine:** Connect · Normalize · Synthesize · Act · Keep. Every engagement is a stop on it.

**Client-copy limits:** no public price (only yours, for this client); never claim to make anyone CMMC compliant; never take custody of CUI; no "keep working at no cost"; no fabricated proof; never name ScalePad.

**Guarantee:** defined deliverables **in writing**.

## Output formats

Claude defaults to HTML for visual docs and Markdown for internal ones. You can override:

- **HTML** — opens in browser, save-as-PDF for final.
- **PDF** — Cmd/Ctrl+P from the HTML output.
- **PPTX** — for decks. Run `scripts/make_pptx.py` after generation.
- **DOCX** — for editable Word. Run `scripts/make_docx.py` on the markdown source.
- **Markdown** — internal docs only.

The script README is at `scripts/README.md`.

---

## What Claude will and won't do

**Will:**

- Lead with outcomes and accountability; use locked glossary phrases verbatim.
- Put every engagement on the spine; include a care contract only when your scope has one.
- Read current canon before writing positioning, offers, pricing or the team, and ask you when it can't.
- Write to the client's industry, obligations and systems.
- Use only the price you give for this client — never a band or a list.
- Ask in one bundled message for anything it doesn't have (industry, size, tenant, decision-maker, offer, price).
- Format outputs to match the live site's type, color, and editorial structure.
- Flag and rewrite anything in a prior doc that no longer matches canon.

**Won't:**

- Claim to make anyone CMMC compliant, or imply custody of CUI.
- Fabricate testimonials, client logos, results, prices, or offer scope.
- Name **ScalePad**, write "AI-powered," lead with "AI," or pitch "general AI services."
- Publish a price list, band or rate card.
- Write strategy from memory when canon is out of reach — it asks instead.
- Use the "keep working at no cost" guarantee, or the M.01–M.05 use cases outside an MSP-audience doc.
- Render section numbers with the `§` glyph, pad with filler, or use emoji.
- Override your judgment — if you tell it to change copy, it changes copy.

---

## Updating the skill

Strategy changes (positioning, offers, markets, pricing, team) go to canon in `catalyst-brain`, not here; the skill picks them up at run time. When something about the documents themselves changes — a glossary phrase evolves, a voice rule, a template needs a new section — edit the relevant file:

- **New brand voice rule / glossary phrase / client-copy limit** → `BRAND.md`
- **How prices are written in a doc** → `PRICING.md`
- **New intake question** → `INTAKE.md`
- **Template change** → the relevant file in `templates/`
- **New doc type** → add a template + a row in `SKILL.md`'s routing table

Bump `version` in `design-skill/.claude-plugin/plugin.json`. Then push to the `catalyst-shift-plugins` repo. Teammates pick it up via Cowork → Sync (and a Cowork restart).

### Troubleshooting — "the templates aren't displaying the new version"

Almost never a browser cache issue. Check in this order:

1. **Is the change merged on `main`?** Open `Catalyst-Shift/catalyst-shift-plugins` on GitHub and confirm the version in `design-skill/.claude-plugin/plugin.json` matches what you pushed.
2. **Has the teammate synced?** Cowork → Customize → plugins → catalyst-shift-plugins → Sync. Then accept the version update.
3. **Did they restart Cowork after sync?** Cowork caches plugin assets at install time; a quit + reopen forces a clean reload.
4. **Is Claude actually opening the templates?** If proposals come back looking written from memory (no module-frame chrome, no cover-strip, generic sections), the SKILL.md instruction to read `templates/` first isn't firing. The current SKILL.md ("Step 2 — you MUST read the relevant template file") addresses this; if older copies are still around, sync.

---

## Built on

The same design system as the live site (v2 tokens). Hallmarks:

- **Tokens** in `assets/colors_and_type.css` — graphite surfaces, signal teal, accent violet, warm coral.
- **Type** General Sans (display) · DM Sans (body) · IBM Plex Mono (UI/labels), all self-hosted in `assets/fonts/`.
- **Document grammar** — sticky nav, hero with grid + glow, cover-strip, plain numbered section rails (`01 / Title`, no glyph), module-frame product chrome with status dots, defined-deliverables guarantee block, a five-row section rail (the spine; M.01–M.05 in MSP-audience docs).
- **Dark-only, screen-first.** All templates render dark on screen and invert to clean white when printed via Cmd/Ctrl+P. There is no `-light` variant.

v1 token names (`--gold`, `--teal`, `--action`, `--terracotta`) remain as aliases inside `colors_and_type.css` so anything written against the old palette keeps rendering. If the live site evolves, mirror the change here.
