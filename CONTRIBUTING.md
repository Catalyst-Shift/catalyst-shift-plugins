# Contributing

Kevin maintains this repo solo for now; Lucas and Keith use the plugin in Cowork but don't review GitHub PRs. The branch + PR flow below is kept for hygiene (forces self-review of the diff, gives you an easy revert handle) — not as a review gate.

## Branch + PR

- Work on a branch named `<your-initials>/<short-description>` (e.g. `kp/tighten-sow-template`).
- Open a PR. **Self-review the diff in the GitHub UI before merging** — it's much easier to catch brand-tone drift in the rendered diff than in the editor. Treat your past-self as the second pair of eyes.
- Squash-merge to `main`.

If a change is trivial (typo, single-line copy fix), commit straight to `main`. The PR ceremony is for anything substantive.

## Bump the version on every merge

Bump `version` in the touched plugin's `.claude-plugin/plugin.json` (`design-skill/…` or `catalyst-ops/…`) in the same PR as the change. (`marketplace.json` no longer carries a version field — Cowork's schema doesn't expect one there, only in the plugin manifest.)

Use [semver](https://semver.org/):

| Change | Bump |
|---|---|
| Copy tweak, glossary fix, asset swap, template polish | **patch** (`1.0.0` → `1.0.1`) |
| New template, new doc type, new output format | **minor** (`1.0.0` → `1.1.0`) |
| Restructured templates, renamed skill, broken backwards-compat | **major** (`1.0.0` → `2.0.0`) |

## Ship a release

There is no release artifact to build. `main` is the release.

1. Merge the PR (with the version bump).
2. `git push origin main` (if it isn't already).
3. Tell Lucas and Keith (Slack, text, however) to hit **Sync** in Cowork → Customize → plugins. Cowork will also surface the update on next session even without manual sync.

Optional but nice: tag the commit so it's easy to refer back to.

```bash
git pull
VERSION=$(python3 -c "import json; print(json.load(open('design-skill/.claude-plugin/plugin.json'))['version'])")
git tag "v${VERSION}"
git push --tags
```

## What not to commit

- `.DS_Store` (already gitignored)
- Anything client-confidential (deal terms, signed SOWs, client logos we haven't been given permission to ship as samples)
- Real client testimonials or case study results unless explicitly cleared
