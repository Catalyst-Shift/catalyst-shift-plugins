# Catalyst Shift Docs — Skill for Claude Desktop

A Claude skill that generates branded Catalyst Shift documents — proposals, SOWs, discovery reports, sales decks, client deliverables, case studies, one-pagers, and internal docs — in HTML, PDF, PPTX, DOCX, or Markdown.

Built for the Catalyst Shift team. Documents speak the way the live site (catalystshift.ai) does: same positioning, same six services, same look.

> **This skill carries no strategy.** Beyond the public positioning, deal shape, pricing and the team are read at run time from the current canon in `Catalyst-Shift/catalyst-brain` `strategy/` (`status: canon` notes only). If Claude can't reach canon, it asks you for the specifics. Prices always come from you.

---

## What it does

You ask Claude something like:

> "Make a CS proposal for Acme Manufacturing — connect their company brain and get their people using AI. About 400 people; the CEO and COO were on the call and said order handoffs between sales and the plant take days. Price and the Stay monthly are in my notes below."

Claude reads current canon, reads the skill, asks any missing questions in one bundle, and writes a full proposal into your working folder. Same for SOWs, discovery reports, decks, etc.

The skill carries the public positioning line and promise, the six services, Read → Build → Land → Stay, the site's two doors, the client-copy limits (no public price, never claim CMMC compliance, never hold CUI, no "keep working at no cost", no invented proof, never name ScalePad, never "Microsoft partner"), the locked phrases, the template structures, and the visual system. Canon supplies the strategy; you provide the deal-specific content and the price.

---

## What's inside

```
catalyst-shift-docs/
├── SKILL.md                  # entry point Claude reads first; "Read canon first"
├── BRAND.md                  # positioning, six services, Read → Build → Land → Stay, voice, limits
├── PRICING.md                # how a price appears in a doc: the teammate's number only
├── INTAKE.md                 # questions to ask when context is thin
├── README.md                 # this file
├── assets/
│   ├── colors_and_type.css   # design tokens (mirrors the live site, Rev 05)
│   ├── doc-shell.css         # shared paper-doc shell: nav, cover, sections, service rail, step rule
│   ├── favicon.svg           # "CS" monogram on Ink, for icon sizes only
│   ├── wordmark.svg          # the plain wordmark, where an image is needed
│   └── fonts/                # General Sans, the offline fallback (Switzer and Plex Mono load from the web)
├── templates/                # paper, editorial; print as they look via Cmd/Ctrl+P
│   ├── proposal.html
│   ├── sow.html
│   ├── discovery-report.html
│   ├── deck.html             # 1280×720 slides, paper with Ink cover and close
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
- "Draft an SOW for [client] — price and Stay monthly attached, kickoff May 15."
- "Make a CS discovery report from this call transcript…"
- "Build a 10-slide CS deck for [audience]."
- "One-pager on **Get your people using AI**."
- "One-pager on the firm."
- "I need a case study writeup for [client] — here are the outcomes…"
- "Format this as a CS client deliverable."
- "Internal doc: co-founder sync notes from today."

Or, vaguer:

- "Make a CS proposal." → Claude will ask the intake questions in `INTAKE.md`.

You can also paste a call transcript or a prior doc and Claude will use it. If the prior doc doesn't match the site and current canon, Claude flags what's out of date and rewrites it.

---

## Quick reference

**Canon first:** for deal shape, pricing and the team, Claude reads `Catalyst-Shift/catalyst-brain` `strategy/` (`status: canon`) through a local clone, `gh api`, or a GitHub connector. No access → it asks you.

**Public line:** "AI integrators, management consultants and engineers."

**The promise:** "An outcome, not saved hours: a company that is effective, efficient and optimized in everything it does, and a culture built around that."

**The six services:** Build software and AI applications · Connect your company brain · Set up Copilot and other AI platforms · Get your people using AI · Automate sales and marketing · Automate operations.

**How we work:** Read (1–2 weeks) → Build (2–6) → Land (2–4) → Stay (monthly). Every engagement ends in Stay.

**Client-copy limits:** no public price (only yours, for this client); never claim to make anyone CMMC compliant; never take custody of CUI; no "keep working at no cost"; no invented proof; never name ScalePad; never "Microsoft partner"; no "hours back" framing; no "AI-powered".

**In writing:** defined deliverables and measured outcomes, before a dollar changes hands.

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

- Lead with outcomes, not hours; use the locked phrases verbatim.
- Show the six services and put every engagement on Read → Build → Land → Stay, ending in Stay.
- Read current canon before writing deal shape, pricing or the team, and ask you when it can't.
- Write to the client's company, leadership and systems, for the C-suite.
- Use only the price you give for this client — never a band or a list.
- Ask in one bundled message for anything it doesn't have (size, leadership, where the company runs slower than it should, services, price).
- Format outputs to match the live site's type, colour and editorial structure.
- Flag and rewrite anything in a prior doc that no longer matches the site and canon.

**Won't:**

- Claim to make anyone CMMC compliant, or imply custody of CUI.
- Invent quotes, client logos, results, prices, or what a service includes.
- Name **ScalePad**, write "Microsoft partner", "AI-powered" or "hours back", or use the banned vocabulary.
- Publish a price list, band or rate card.
- Write strategy from memory when canon is out of reach — it asks instead.
- Use the "keep working at no cost" guarantee, or add a seventh service.
- Render section numbers with the `§` glyph, pad with filler, or use emoji.
- Override your judgment — if you tell it to change copy, it changes copy.

---

## Updating the skill

Strategy changes (positioning, services, pricing, team) go to canon in `catalyst-brain`, not here; the skill picks them up at run time. When the site changes how it speaks or looks, mirror it here. When something about the documents themselves changes — a locked phrase, a voice rule, a template needs a new section — edit the relevant file:

- **New brand voice rule / locked phrase / client-copy limit** → `BRAND.md`
- **How prices are written in a doc** → `PRICING.md`
- **New intake question** → `INTAKE.md`
- **Template change** → the relevant file in `templates/`
- **Design token change** → `assets/colors_and_type.css`, from the site's `DESIGN.md` and `app/globals.css`
- **New doc type** → add a template + a row in `SKILL.md`'s routing table

Bump `version` in `design-skill/.claude-plugin/plugin.json`. Then push to the `catalyst-shift-plugins` repo. Teammates pick it up via Cowork → Sync (and a Cowork restart).

### Troubleshooting — "the templates aren't displaying the new version"

Almost never a browser cache issue. Check in this order:

1. **Is the change merged on `main`?** Open `Catalyst-Shift/catalyst-shift-plugins` on GitHub and confirm the version in `design-skill/.claude-plugin/plugin.json` matches what you pushed.
2. **Has the teammate synced?** Cowork → Customize → plugins → catalyst-shift-plugins → Sync. Then accept the version update.
3. **Did they restart Cowork after sync?** Cowork caches plugin assets at install time; a quit + reopen forces a clean reload.
4. **Is Claude actually opening the templates?** If proposals come back looking written from memory (no cover strip, no service rail, generic sections), the SKILL.md instruction to read `templates/` first isn't firing. The current SKILL.md ("Step 2 — you MUST read the relevant template file") addresses this; if older copies are still around, sync.

---

## Built on

The same design system as the live site (Rev 05, the guided-conversation site). Hallmarks:

- **Tokens** in `assets/colors_and_type.css` — Paper and Ink surfaces, teal `#34E2C2` as the accent (deep teal `#0B7C6E` for text on paper), indigo only as ambient depth behind an Ink passage. No orange.
- **Type** Switzer (display and body) · IBM Plex Mono (captions). General Sans is bundled in `assets/fonts/` as the offline fallback.
- **Wordmark** — plain "Catalyst Shift" on one line, "Shift" in the accent. No symbol, no hex mark.
- **Document grammar** — nav with the wordmark, a cover with a cover strip, plain numbered section rails (`01`, no glyph), the six-service rail, the Read · Build · Land · Stay step rule, an outcomes card with status dots, the in-writing block, and the site's two doors on the one-pager.
- **Light by default.** Templates are paper on screen and print as they look. A dark passage is `class="ink"`; a whole dark doc is `<html data-theme="dark">`.
