# Catalyst Shift — Claude plugins

Internal Catalyst Shift plugins for **Claude Cowork** (desktop) and Claude Code (CLI).

Currently ships:

- **`design-skill`** — branded document generation (proposals, SOWs, decks, discovery reports, client deliverables, case studies, one-pagers, internal docs).

---

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
2. Bump `version` in both `design-skill/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`.
3. Squash-merge to `main` and push.

That's it. Lucas and Keith pick it up on their next Sync. No zips, no releases, no upload step.
