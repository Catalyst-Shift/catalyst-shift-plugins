# Catalyst Shift Docs — Skill for Claude Desktop

A Claude skill that generates branded Catalyst Shift documents — proposals, SOWs, discovery reports, sales decks, client deliverables, case studies, one-pagers, and internal docs — in HTML, PDF, PPTX, DOCX, or Markdown.

Built for **Kevin, Lucas, and Keith**. Same brand, same voice, same templates, every time.

---

## What it does

You ask Claude something like:

> "Make a CS proposal for Acme Industrial — Foundation tier, $35K, kickoff May 15. Their issue is the founder is the only seller and they hit $2M in ceiling."

Claude reads the skill, asks any missing questions in one bundle, and writes a full proposal into your working folder. Same for SOWs, discovery reports, decks, etc.

The skill has the brand voice, the locked glossary, the pricing tiers, the guarantee language, the template structures, and the visual system baked in. You just provide the deal-specific content.

---

## What's inside

```
catalyst-shift-docs/
├── SKILL.md                  # entry point Claude reads first
├── BRAND.md                  # voice rules + locked glossary
├── PRICING.md                # the three tiers + retainer
├── INTAKE.md                 # questions to ask when context is thin
├── README.md                 # this file
├── assets/
│   ├── colors_and_type.css   # design tokens (mirrors live site)
│   ├── logo-inline.svg
│   ├── logo-stacked.svg
│   └── fonts/                # General Sans woff2 (self-hosted)
├── templates/
│   ├── proposal.html
│   ├── sow.html
│   ├── discovery-report.html
│   ├── deck.html
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

The skill lives in a Claude Desktop "skills" folder. Both Mac and Windows pick it up automatically once it's in the right place.

### Mac

```bash
mkdir -p "~/Library/Application Support/Claude/skills"
# Drop the catalyst-shift-docs folder into that directory.
```

### Windows

```
%APPDATA%\Claude\skills\
```

Drop the `catalyst-shift-docs` folder in. Restart Claude Desktop.

### Shared Drive workflow (recommended)

If we keep the canonical copy in our shared Drive:

1. **Sync the Drive folder locally** (Google Drive desktop app, Dropbox, etc.).
2. **Symlink** the synced `catalyst-shift-docs` folder into Claude's skills directory:

   ```bash
   # Mac
   ln -s "/path/to/synced/catalyst-shift-docs" "~/Library/Application Support/Claude/skills/catalyst-shift-docs"
   ```

   ```cmd
   :: Windows (Run as Admin)
   mklink /D "%APPDATA%\Claude\skills\catalyst-shift-docs" "C:\path\to\synced\catalyst-shift-docs"
   ```

3. Updates pushed to Drive flow to everyone automatically.

---

## How to invoke it

Just ask Claude in plain English. The skill description fires on phrases like:

- "Write a Catalyst Shift proposal for [client]…"
- "Draft an SOW for [client] — Foundation tier, $35K, start May 15."
- "Make a CS discovery report from this transcript…"
- "Build a 10-slide CS sales deck for [audience]."
- "Generate a one-pager for the Diagnostic offer."
- "I need a case study writeup for [client] — here are the metrics…"
- "Format this as a CS client deliverable."
- "Internal doc: meeting notes from today."

Or, vaguer:

- "Make a CS proposal." → Claude will ask the intake questions.

You can also paste a discovery call transcript, an intake form, or a previous doc and Claude will use it.

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
- Use locked glossary phrases verbatim ("Kevin builds the engine…", "in writing", "Most engagements continue").
- Apply the three-tier pricing as defaults; honor overrides.
- Ask you, in one bundled question, for anything it doesn't have.
- Format outputs to match the live website's type, color, and editorial structure.

**Won't:**
- Fabricate testimonials, client logos, or case study results.
- Write "AI-powered" anything user-facing.
- Pad with filler sections.
- Use emoji.
- Override your judgment — if you tell it to change copy, it changes copy.

---

## Updating the skill

When you learn something — a new objection that comes up in calls, a phrase that's working, a tier that's evolved — edit the relevant file:

- **New brand voice rule** → `BRAND.md`
- **Pricing change** → `PRICING.md`
- **New intake question** → `INTAKE.md`
- **Template change** → the relevant file in `templates/`
- **New doc type entirely** → add a template + a row in the SKILL.md routing table

If you're using the synced-Drive setup, push the change to Drive and everyone gets it on next sync.

---

## Built on

The same design system as the live site: tokens in `colors_and_type.css`, General Sans / DM Sans / IBM Plex Mono, gold/teal/terracotta palette, document-style numbering. If the site evolves, mirror the change here.
