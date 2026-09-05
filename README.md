# Catalyst Shift — Claude plugins

Internal Catalyst Shift plugins for **Claude Cowork** (desktop) and Claude Code (CLI).

Currently ships:

- **`design-skill`** — branded document generation (proposals, SOWs, decks, discovery reports, client deliverables, case studies, one-pagers, internal docs).
- **`catalyst-ops`** — how we operate: `ways-of-working` (the canon block: three homes + the build method), `verify` (fresh-context verifier — diff + checklist only, PASS/FAIL with evidence, before every `/ship`), the `verify-gate` hook (a Claude session cannot `gh pr merge` a commit `/verify` has not passed — `CS_LAND_UNVERIFIED=1` overrides, logged), `decision-governance` (proposed-vs-decided labelling, ratification rules).

---

## Branch protection

`main` is protected by the ruleset in `.github/ruleset-main.json` (PR required, `validate` required and up to date, no bypass actors, no deletion or force-push). Apply or replace it from a human terminal — the agent token cannot touch rulesets by design (CAT-529):

```bash
gh api repos/Catalyst-Shift/catalyst-shift-plugins/rulesets --input .github/ruleset-main.json
# replace an existing one: gh api -X PUT repos/Catalyst-Shift/catalyst-shift-plugins/rulesets/<id> --input .github/ruleset-main.json
```

Why: on 2026-09-05 PR #8 merged with a red `validate` because nothing required it. A required check must have reported on `main` at least once under its name before the ruleset can name it — `validate` has.

**Red paths (CAT-537).** `.github/workflows/protected-paths.yml` is the platform's job, mirrored: on every PR to `main` it runs `scripts/protected-paths.mjs --check` (base branch's copy, via `pull_request_target`) over the PR's changed file names and fails unless a named human applied `red-approved` to that exact head. Red here = `.github/**`, every `CLAUDE.md`, every `.claude-plugin/` manifest, every `hooks/` directory, `catalyst-ops/skills/ways-of-working/` (the canon block's source), `catalyst-ops/skills/verify/` (the verifier the land gate trusts), and the checker + its tests. The `PROTECTED` array in the script is the list. Everything else is Normal and may auto-land on `validate` + `/verify`. An agent never merges a Red PR here: it opens it and stops.

Approve from a real terminal with the platform's sha-checked script: `scripts/red-approve.sh <pr> <sha-you-read> Catalyst-Shift/catalyst-shift-plugins` (in `catalyst-os-platform`). A push after approval strips the label.

Make the job required once it has reported on one merged PR: add `{ "context": "protected paths", "integration_id": 15368 }` to `required_status_checks` in `.github/ruleset-main.json` and `PUT` the ruleset (command above).

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
