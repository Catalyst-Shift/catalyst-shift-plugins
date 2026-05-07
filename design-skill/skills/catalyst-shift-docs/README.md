# Catalyst Shift Docs — Skill for Claude Desktop

A Claude skill that generates branded Catalyst Shift documents — proposals, SOWs, discovery reports, sales decks, client deliverables, case studies, one-pagers, and internal docs — in HTML, PDF, PPTX, DOCX, or Markdown.

Built for **Kevin, Lucas, and Keith**. Same brand, same voice, same templates, every time.

> **Strategy version:** v4.3 (2026-05-07). If you're seeing old tier names (Diagnostic / 60-day Foundation / Operating Layer 90-day) or "growth strategy firm" framing in generated docs, your local copy is stale — see **Updating** below.

---

## What it does

You ask Claude something like:

> "Make a CS proposal for Acme MSP — Foundation tier, $12,500 setup / $3,200 MRR, kickoff May 15. They're $1.8M revenue, 220 endpoints, ConnectWise + NinjaOne. Owner is drowning in QBRs and three big clients are showing churn signals."

Claude reads the skill, asks any missing questions in one bundle, and writes a full proposal into your working folder. Same for SOWs, discovery reports, decks, etc.

The skill has the brand voice, the locked glossary, the v4.3 module pricing, the guarantee language, the template structures, and the visual system baked in. You provide the deal-specific content.

---

## What's inside

```
catalyst-shift-docs/
├── SKILL.md                  # entry point Claude reads first
├── BRAND.md                  # voice rules + locked glossary (v4.3)
├── PRICING.md                # five modules + Foundation/Growth/Full Stack tiers (v4.3)
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
- "Draft an SOW for [client] — Full Stack, $16,500 setup / $4,500 MRR, start May 15."
- "Make a CS discovery report from this transcript…"
- "Build a 10-slide CS sales deck for an IBPI peer-group room."
- "Generate a one-pager for **M.01 QBR Automation**."
- "One-pager on the design-partner program."
- "I need a case study writeup for [client] — here are the metrics…"
- "Format this as a CS client deliverable."
- "Internal doc: leadership sync notes from today."

Or, vaguer:

- "Make a CS proposal." → Claude will ask the intake questions in `INTAKE.md`.

You can also paste a discovery transcript, an intake form, or a prior doc and Claude will use it. **If the prior doc is from v3.x**, Claude will rewrite to v4.3 (modules + Foundation/Growth/Full Stack tiers).

---

## v4.3 quick reference

The five **Catalyst OS** modules:

| ID | Module | Setup | MRR |
|---|---|---|---|
| **M.01** | QBR Automation | $4,500 | $1,200/mo |
| **M.02** | Churn Early Warning | $5,000 | $1,500/mo |
| **M.03** | Proposal Generation | $5,500 | $1,000/mo |
| **M.04** | Pipeline Visibility | $3,500 | $800/mo |
| **M.05** | Content & Authority | $3,000 | $1,000/mo |

The three tiers:

| Tier | Setup | MRR | Coverage |
|---|---|---|---|
| **Foundation** | $12,500 | $3,200/mo | M.01–M.03 · Operations |
| **Growth** | $5,500 | $1,600/mo | M.04–M.05 · Revenue |
| **Full Stack** | $16,500 | $4,500/mo | All five modules |

Plus **design-partner** terms (first 10 customers) and **IBPI member** discount. See `PRICING.md`.

---

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

- Use locked glossary phrases verbatim ("Kevin builds the engine…", "operating layer," "install the infrastructure," "in writing," "most engagements continue," "whether you're paying attention or not").
- Apply the v4.3 module pricing and Foundation/Growth/Full Stack tiers as defaults; honor overrides.
- Ask in one bundled message for anything it doesn't have (MSP size, stack, decision-maker, modules, design-partner status, IBPI status).
- Format outputs to match the live site's type, color, and editorial structure.
- Replace v3.x language in any prior doc you paste in.

**Won't:**

- Fabricate testimonials, client logos, or case-study results. Catalyst OS is in active development with the founding cohort — Claude will say so plainly when relevant.
- Write "AI-powered" anywhere customer-facing.
- Use deprecated tier names (Diagnostic / 60-day Foundation / 90-day Operating Layer / Signal Sprint / Operator / fractional CRO).
- Describe CS as a "growth strategy firm" — it's a vertical-first, product-led firm for MSPs.
- Render section numbers with the `§` glyph (deprecated v1.x).
- Pad with filler sections.
- Use emoji.
- Override your judgment — if you tell it to change copy, it changes copy.

---

## Updating the skill

When something changes — pricing, a new module ships, a glossary phrase evolves, a template needs a new section — edit the relevant file:

- **New brand voice rule / glossary phrase / positioning shift** → `BRAND.md`
- **Pricing change / new module / new discount** → `PRICING.md`
- **New intake question** → `INTAKE.md`
- **Template change** → the relevant file in `templates/`
- **New doc type** → add a template + a row in `SKILL.md`'s routing table

Bump the strategy version banner in `SKILL.md` and `README.md` whenever you make a positioning-level change. Then push to the `catalyst-shift-plugins` repo and tag a release. Teammates pick it up via Cowork → Sync (and a Cowork restart).

### Troubleshooting — "the templates aren't displaying the new version"

Almost never a browser cache issue. Check in this order:

1. **Is the change merged on `main`?** Open `Catalyst-Shift/catalyst-shift-plugins` on GitHub and confirm the version in `design-skill/.claude-plugin/plugin.json` matches what you pushed.
2. **Has the teammate synced?** Cowork → Customize → plugins → catalyst-shift-plugins → Sync. Then accept the version update.
3. **Did they restart Cowork after sync?** Cowork caches plugin assets at install time; a quit + reopen forces a clean reload.
4. **Is Claude actually opening the templates?** If proposals come back looking like they were written from memory (no module-frame chrome, no cover-strip, generic numbered sections), the SKILL.md instruction to read `templates/` first isn't firing. The current SKILL.md ("Step 2 — you MUST read the relevant template file") addresses this; if older copies are still around, sync.

---

## Built on

The same design system as the live site (v2 tokens, v4.3 content). Hallmarks:

- **Tokens** in `assets/colors_and_type.css` — graphite surfaces, signal teal, accent violet, warm coral.
- **Type** General Sans (display) · DM Sans (body) · IBM Plex Mono (UI/labels), all self-hosted in `assets/fonts/`.
- **Document grammar** — sticky nav, hero with grid + glow, cover-strip, plain numbered section rails (`01 / Title`, no glyph), module-frame product chrome with status dots, in-writing guarantee block, module IDs (M.01–M.05) used as in-text mono anchors.
- **Dark-only, screen-first.** All templates render dark on screen and invert to clean white when printed via Cmd/Ctrl+P. There is no `-light` variant — that was an earlier iteration and has been removed.

v1 token names (`--gold`, `--teal`, `--action`, `--terracotta`) remain as aliases inside `colors_and_type.css` so anything written against the old palette keeps rendering. If the live site evolves, mirror the change here.
