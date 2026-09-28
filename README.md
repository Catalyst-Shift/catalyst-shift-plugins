# Catalyst Shift — Claude plugins

Internal Catalyst Shift plugins for **Claude Cowork** (desktop) and Claude Code (CLI).

Currently ships:

- **`design-skill`** — branded document generation (proposals, SOWs, decks, discovery reports, client deliverables, case studies, one-pagers, internal docs).
- **`catalyst-ops`** — how we operate: `next` (the pickup loop — top card → build → in-session adversarial pass → `/ship` with auto-merge on → next card; hands off at 650k context), `ways-of-working` (the canon block: three homes + HOW_WE_BUILD v2), `decision-governance` (proposed-vs-decided labelling, ratification rules). `verify` and the `verify-gate` hook are retired (2026-09-28): the required `adversarial review` CI check replaces them.

---

## Branch protection

`main` is protected by the ruleset in `.github/ruleset-main.json` (PR required, `validate` required and up to date, no bypass actors, no deletion or force-push). Apply or replace it from a human terminal — the agent token cannot touch rulesets by design (CAT-529):

```bash
gh api repos/Catalyst-Shift/catalyst-shift-plugins/rulesets --input .github/ruleset-main.json
# replace an existing one: gh api -X PUT repos/Catalyst-Shift/catalyst-shift-plugins/rulesets/<id> --input .github/ruleset-main.json
```

Why: on 2026-09-05 PR #8 merged with a red `validate` because nothing required it. A required check must have reported on `main` at least once under its name before the ruleset can name it — `validate` has.

**Deep paths.** `scripts/protected-paths.mjs` holds this repo's deep-path list (`.github/**`, every `CLAUDE.md`, every `.claude-plugin/` manifest, every `hooks/` directory, the ways-of-working skill, the checker + its tests). Under HOW_WE_BUILD v2 it no longer gates a merge: the `adversarial review` workflow runs it with `--check` to decide how deep to review, and every PR auto-merges on `validate` + `adversarial review`.

Approve from a real terminal with the platform's sha-checked script: `scripts/red-approve.sh <pr> <sha-you-read> Catalyst-Shift/catalyst-shift-plugins` (in `catalyst-os-platform`). A push after approval strips the label.

The job is required by the ruleset since 2026-09-05 (`protected paths` context in `.github/ruleset-main.json`); a new required check must report on one merged PR before it goes into the payload, or every PR deadlocks on a check that never runs.

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
