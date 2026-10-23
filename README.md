# Catalyst Shift — Claude plugins

Internal Catalyst Shift plugins for **Claude Cowork** (desktop) and Claude Code (CLI).

Currently ships:

- **`design-skill`** — branded document generation (proposals, SOWs, decks, discovery reports, client deliverables, case studies, one-pagers, internal docs).
- **`catalyst-ops`** — how we operate: `next` (build one card by hand — the named card or the top Ready For Factory card → gstack → `/ship` opens a PR that carries the evidence; never auto-merges, Kevin or Keith merges), `ways-of-working` (the canon block: three homes + the Claude dev factory), `decision-governance` (proposed-vs-decided labelling, ratification rules). Normal pickup is the factory's dispatcher on Kevin's and Keith's machines, not `/next` (2026-10-23, CAT-1297).

Also here, outside any plugin: **[`factory/`](factory/README.md)**, the Claude dev factory dispatcher and its systemd units, installed on Kevin's and Keith's Omarchy machines with `factory/install.sh`.

---

## Branch protection

`main` is protected by the ruleset in `.github/ruleset-main.json` (PR required, `validate` required and up to date, no bypass actors, no deletion or force-push). Apply or replace it from a human terminal — the agent token cannot touch rulesets by design (CAT-529):

```bash
gh api repos/Catalyst-Shift/catalyst-shift-plugins/rulesets --input .github/ruleset-main.json
# replace an existing one: gh api -X PUT repos/Catalyst-Shift/catalyst-shift-plugins/rulesets/<id> --input .github/ruleset-main.json
```

Why: on 2026-09-05 PR #8 merged with a red `validate` because nothing required it. A required check must have reported on `main` at least once under its name before the ruleset can name it — `validate` has.

**Deep paths.** `scripts/protected-paths.mjs` holds this repo's deep-path list (`.github/**`, every `CLAUDE.md`, every `.claude-plugin/` manifest, every `hooks/` directory, the ways-of-working skill, the checker + its tests). It sets review depth (`/cso` in session on a deep path); it doesn't merge anything; a PR touching `.github/CODEOWNERS` paths needs a code-owner approval. Under the Claude dev factory, Kevin or Keith merges every PR (stage 1, no auto-merge).

## Install (Claude Desktop / Cowork)

One-time setup. After this, you get updates by clicking **Sync** — no downloading, no zip files.

1. Open Claude Desktop → switch to **Cowork**.
2. Open **Customize** (left sidebar) → go to plugins → **Add marketplace**.
3. In the URL field, paste:

   ```
   Catalyst-Shift/catalyst-shift-plugins
   ```

4. Click **Sync**.
5. Once the `catalyst-shift-plugins` marketplace appears, install the **`design-skill`** plugin from it.

The skill auto-activates when you ask Claude for any CS-branded doc — proposal, SOW, deck, discovery report, case study, one-pager, etc.

> Repo is private to the `Catalyst-Shift` org. If Sync fails with an auth error, make sure your GitHub account is signed in to the desktop app and you're a member of the org.

## Update

When Kevin pushes a new version:

1. Open **Customize** → plugins → find `catalyst-shift-plugins` → click **Sync**.
2. Cowork will surface the new version of `design-skill` — accept the update.

(Cowork also prompts you on session start when an update is available, so you can usually skip the manual sync.)

---

## Maintainer workflow

See [`CONTRIBUTING.md`](./CONTRIBUTING.md). Short version:

1. Edit on a branch, open a PR, get a review from one of the other two.
2. Bump `version` in the touched plugin's `.claude-plugin/plugin.json` (`marketplace.json` carries no version).
3. Squash-merge to `main` and push.

That's it. Lucas and Keith pick it up on their next Sync. No zips, no releases, no upload step.
