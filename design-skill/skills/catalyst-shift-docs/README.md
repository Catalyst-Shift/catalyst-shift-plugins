# Catalyst Shift Docs — Skill for Claude Desktop

A Claude skill that generates branded Catalyst Shift documents — proposals, SOWs, discovery reports, sales decks, client deliverables, case studies, one-pagers, and internal docs — in HTML, PDF, PPTX, DOCX, or Markdown.

Built for the three co-founders — Kevin, Lucas and Keith. Same brand, same voice, same templates, every time.

> **Strategy version:** v6.0 (canon 2026-10-09). If generated docs still call Catalyst Shift a product company or "the operating layer for MSPs," print a "$2,500 assessment" or per-managed-client MRR, say "two co-founders" or "no consultative services," sell five modules à la carte, or promise "keep working at no cost," your local copy is stale — see **Updating** below.

---

## What it does

You ask Claude something like:

> "Make a CS proposal for Acme Machining — Workplace Readiness. They're a 60-person DIB sub on GCC High, no Copilot yet, CMMC Level 2 coming up on their prime's contract. Fixed price is $X, care is $Y a month."

Claude reads the skill, asks any missing questions in one bundle, and writes a full proposal into your working folder. Same for SOWs, discovery reports, decks, etc.

The skill has the v6.0 positioning (a services firm with its own platform), the spine, the offers and doors, the DIB conditions (never claim CMMC compliance, never hold CUI), the locked glossary, the pricing rules (fixed scope, no public price, a care contract on every engagement), the defined-deliverables guarantee, the template structures, and the visual system baked in. You provide the deal-specific content.

---

## What's inside

```
catalyst-shift-docs/
├── SKILL.md                  # entry point Claude reads first (v6.0)
├── BRAND.md                  # positioning, offers, doors, voice, glossary (v6.0)
├── PRICING.md                # fixed-scope pricing, care contract, no public price (v6.0)
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
- "Draft an SOW for [client] — fixed price $X, care $Y/mo, start May 15."
- "Make a CS discovery report from this call transcript…"
- "Build a 10-slide CS deck for a DIB prime's supplier group."
- "Generate a one-pager on **Workplace Readiness**."
- "One-pager for CPA firms."
- "I need a case study writeup for [client] — here are the outcomes…"
- "Format this as a CS client deliverable."
- "Internal doc: co-founder sync notes from today."

Or, vaguer:

- "Make a CS proposal." → Claude will ask the intake questions in `INTAKE.md`.

You can also paste a call transcript, an assessment, or a prior doc and Claude will use it. **If the prior doc is v5.2 or older**, Claude will rewrite it to v6.0.

---

## v6.0 quick reference

**What we are:** a **services firm with its own platform** — a Microsoft 365 partner and Copilot-focused services firm, not an MSP. We sell outcomes, deliver them with our own tooling (Catalyst OS), and are accountable for the result in writing.

**Primary offer:** **Workplace Readiness** — Copilot and AI-readiness assessment → Modernize → Run. Its scope and price aren't set in canon yet; the teammate supplies them.

**The spine:** Connect · Normalize · Synthesize · Act · Keep. Every engagement is a stop on it.

**Doors:** GCC High / DIB first. Law, CPA, actuarial and commercial M365 open. MSP on Halo is background only (the M.01–M.05 use cases live there).

**DIB conditions:** never claim to make anyone CMMC compliant; never take custody of CUI.

**Pricing:** fixed scope, fixed price, priced on outcome; a care contract attaches at signature. No public price list on any surface, including the assessment. Internal bands are in `PRICING.md` and never printed.

**Team:** three co-founders — Kevin (Delivery & Tooling), Lucas (Revenue), Keith (COO; acceptance pending on CAT-443).

**Guarantee:** defined deliverables **in writing** — never "keep working at no cost."

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
- Put every engagement on the spine and attach the care contract.
- Write to the door — DIB, law, CPA, actuarial, commercial M365, or (when asked) MSP.
- Use only the price the teammate gives for this client — never a band or a list.
- Ask in one bundled message for anything it doesn't have (door, size, tenant, decision-maker, offer, price).
- Format outputs to match the live site's type, color, and editorial structure.
- Replace v5.2 and older language in any prior doc you paste in.

**Won't:**

- Claim to make anyone CMMC compliant, or imply custody of CUI.
- Fabricate testimonials, client logos, results, prices, or offer scope canon hasn't set.
- Name **ScalePad**, write "AI-powered," lead with "AI," or pitch "general AI services."
- Publish a price list, band or rate card; write an advisory-only engagement.
- Call Catalyst Shift an MSP or a product company, say "two co-founders," or use the retired founder-named differentiator.
- Use the "keep working at no cost" guarantee, or the M.01–M.05 use cases outside an MSP doc.
- Render section numbers with the `§` glyph, pad with filler, or use emoji.
- Override your judgment — if you tell it to change copy, it changes copy.

---

## Updating the skill

When something changes — pricing model, a use case is renamed, a glossary phrase evolves, a template needs a new section — edit the relevant file:

- **New brand voice rule / glossary phrase / positioning shift** → `BRAND.md`
- **Pricing-model change / new exception** → `PRICING.md`
- **New intake question** → `INTAKE.md`
- **Template change** → the relevant file in `templates/`
- **New doc type** → add a template + a row in `SKILL.md`'s routing table

Bump the strategy version banner in `SKILL.md` and `README.md` whenever you make a positioning-level change, and bump `version` in `design-skill/.claude-plugin/plugin.json`. Then push to the `catalyst-shift-plugins` repo. Teammates pick it up via Cowork → Sync (and a Cowork restart).

### Troubleshooting — "the templates aren't displaying the new version"

Almost never a browser cache issue. Check in this order:

1. **Is the change merged on `main`?** Open `Catalyst-Shift/catalyst-shift-plugins` on GitHub and confirm the version in `design-skill/.claude-plugin/plugin.json` matches what you pushed.
2. **Has the teammate synced?** Cowork → Customize → plugins → catalyst-shift-plugins → Sync. Then accept the version update.
3. **Did they restart Cowork after sync?** Cowork caches plugin assets at install time; a quit + reopen forces a clean reload.
4. **Is Claude actually opening the templates?** If proposals come back looking written from memory (no module-frame chrome, no cover-strip, generic sections), the SKILL.md instruction to read `templates/` first isn't firing. The current SKILL.md ("Step 2 — you MUST read the relevant template file") addresses this; if older copies are still around, sync.

---

## Built on

The same design system as the live site (v2 tokens, v6.0 content). Hallmarks:

- **Tokens** in `assets/colors_and_type.css` — graphite surfaces, signal teal, accent violet, warm coral.
- **Type** General Sans (display) · DM Sans (body) · IBM Plex Mono (UI/labels), all self-hosted in `assets/fonts/`.
- **Document grammar** — sticky nav, hero with grid + glow, cover-strip, plain numbered section rails (`01 / Title`, no glyph), module-frame product chrome with status dots, defined-deliverables guarantee block, a five-row section rail (the spine; M.01–M.05 in MSP docs).
- **Dark-only, screen-first.** All templates render dark on screen and invert to clean white when printed via Cmd/Ctrl+P. There is no `-light` variant.

v1 token names (`--gold`, `--teal`, `--action`, `--terracotta`) remain as aliases inside `colors_and_type.css` so anything written against the old palette keeps rendering. If the live site evolves, mirror the change here.
