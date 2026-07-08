# Catalyst Shift Docs — Skill for Claude Desktop

A Claude skill that generates branded Catalyst Shift documents — proposals, SOWs, discovery reports, sales decks, client deliverables, case studies, one-pagers, and internal docs — in HTML, PDF, PPTX, DOCX, or Markdown.

Built for **Kevin and Lucas** (with Keith supporting the build internally). Same brand, same voice, same templates, every time.

> **Strategy version:** v5.2 (canon 2026-06-30; amended 2026-07-03). If generated docs still say "vertical-first product-led firm," sell five modules à la carte, quote named tiers (Foundation / Growth / Full Stack) or public setup+MRR price lists, headline "QBR Automation," use the founder-named differentiator, or promise "keep working at no cost," your local copy is stale — see **Updating** below.

---

## What it does

You ask Claude something like:

> "Make a CS proposal for Acme MSP — leading with The Operator Brief, off the paid assessment. They're $1.8M revenue, 22 managed clients, ConnectWise + NinjaOne + HubSpot. Owner is drowning in client reviews and three clients are showing churn signals."

Claude reads the skill, asks any missing questions in one bundle, and writes a full proposal into your working folder. Same for SOWs, discovery reports, decks, etc.

The skill has the v5.2 brand voice, the locked glossary, the synthesis-first story, the platform pricing model (custom-managed, no public price list), the paid-assessment front door, the defined-deliverables guarantee, the template structures, and the visual system baked in. You provide the deal-specific content.

---

## What's inside

```
catalyst-shift-docs/
├── SKILL.md                  # entry point Claude reads first (v5.2)
├── BRAND.md                  # voice rules + locked glossary (v5.2)
├── PRICING.md                # price-the-platform model, assessment, no public list (v5.2)
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
- "Draft an SOW for [client] — off the assessment, setup + per-client MRR, start May 15."
- "Make a CS discovery report from this listen-call transcript…"
- "Build a 10-slide CS sales deck for an IBPI peer-group room."
- "Generate a one-pager on **The Operator Brief (M.01)**."
- "One-pager on the early-adopter program."
- "I need a case study writeup for [client] — here are the outcomes…"
- "Format this as a CS client deliverable."
- "Internal doc: co-founder sync notes from today."

Or, vaguer:

- "Make a CS proposal." → Claude will ask the intake questions in `INTAKE.md`.

You can also paste a listen-call transcript, an assessment, or a prior doc and Claude will use it. **If the prior doc is v4.x/v3.x**, Claude will rewrite to v5.2 (platform-priced synthesis layer, use cases, paid-assessment front door, two co-founders).

---

## v5.2 quick reference

**What we are:** a **product company.** The product is **Catalyst OS** — the business-layer operating system for an MSP, built on a **synthesis core** that makes the stack (CRM + PSA + RMM) talk to itself and *acts* on it. Delivered managed until proven across ~5 customers, then graduates toward software (the Palantir pattern). **We sell the platform, not modules à la carte.**

The five **use cases** (a module is a use case — a view over the synthesis spine):

| ID | Use case |
|---|---|
| **M.01** | The Operator Brief *(renamed QBR output — the default first use case)* |
| **M.02** | Churn Early Warning |
| **M.03** | Proposal Generation |
| **M.04** | Pipeline Visibility |
| **M.05** | Authority Engine |

**Pricing:** price the platform, deliver custom. Per managed client × use-case depth, with caps. Managed now: **paid assessment ($2,500, credited) → custom SOW → setup (credited) → per-client MRR.** **No public price list.** SaaS tiers (Intelligence / Action / Operator-Owned) are illustrative and future-only. Managed floor = Action. See `PRICING.md`.

**Front door:** the paid assessment builds the custom proposal; the free self-serve Scorecard is lead capture ahead of it. No consultative/advisory services.

**Team:** two co-founders — Kevin (product/eng) and Lucas (revenue, client-facing). Keith supports the build internally, not presented externally.

**Guarantee:** defined deliverables **in writing** — never "keep working at no cost."

Plus the **early-adopter program**, **IBPI member** terms (15% setup + 10% Y1 MRR + 5% rebate), and **ASCII Spark**. See `PRICING.md`.

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

- Lead with **synthesis** and outcomes; use locked glossary phrases verbatim ("operating layer," "your stack, finally talking to itself," "actioned intelligence," "operator-owned intelligence," "The Operator Brief," "in writing," "most engagements continue," "Palantir, for the MSP business layer").
- Sell the **platform**, framing the five as use cases over one synthesis spine.
- Price custom off the **paid assessment** — no public price list, no fixed tiers.
- Ask in one bundled message for anything it doesn't have (revenue band, managed-client count, stack, decision-maker, lead use case, early-adopter/IBPI status).
- Format outputs to match the live site's type, color, and editorial structure.
- Replace v4.x/v3.x language in any prior doc you paste in.

**Won't:**

- Fabricate testimonials, client logos, or results. The synthesis core is demoable and delivered managed until proven across ~5 customers — Claude says so via the founding-cohort narrative.
- Name **ScalePad**, or write "AI-powered" / lead with "AI" in customer-facing headlines.
- Sell use cases à la carte, publish a price list, or quote the illustrative SaaS tiers as a managed price.
- Use the retired founder-named differentiator, present Keith externally, or introduce a third co-founder.
- Use the "keep working at no cost" guarantee, or headline "QBR Automation."
- Describe CS as a "growth strategy firm" or "vertical-first product-led firm" — it's a product company.
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

The same design system as the live site (v2 tokens, v5.2 content). Hallmarks:

- **Tokens** in `assets/colors_and_type.css` — graphite surfaces, signal teal, accent violet, warm coral.
- **Type** General Sans (display) · DM Sans (body) · IBM Plex Mono (UI/labels), all self-hosted in `assets/fonts/`.
- **Document grammar** — sticky nav, hero with grid + glow, cover-strip, plain numbered section rails (`01 / Title`, no glyph), module-frame product chrome with status dots, defined-deliverables guarantee block, use-case IDs (M.01–M.05) used as in-text mono anchors.
- **Dark-only, screen-first.** All templates render dark on screen and invert to clean white when printed via Cmd/Ctrl+P. There is no `-light` variant.

v1 token names (`--gold`, `--teal`, `--action`, `--terracotta`) remain as aliases inside `colors_and_type.css` so anything written against the old palette keeps rendering. If the live site evolves, mirror the change here.
