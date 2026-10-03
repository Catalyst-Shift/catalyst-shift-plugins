# Contributing

Changes land the way every Catalyst Shift code repo lands them (HOW_WE_BUILD v2, the Ways of Working block in `CLAUDE.md`): a Linear issue with an acceptance checklist, a branch, a PR titled `[concept]` or `[harden]`, and the required `adversarial review` check deciding the merge. Lucas and Keith use the plugins in Cowork but don't review GitHub PRs.

## Branch + PR

- Branch from fresh `origin/main` using the Linear issue's `gitBranchName`.
- Open a PR and turn on auto-merge (`gh pr merge --auto --squash`). It merges itself when the required checks pass. **Read the rendered diff** before you arm it — brand-tone drift is much easier to catch there than in the editor.
- Every change is a PR, including a one-line copy fix. Nothing is pushed straight to `main`.

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

1. The release starts when the PR (with the version bump) auto-merges on its required checks.
2. Tell Lucas and Keith (Slack, text, however) to hit **Sync** in Cowork → Customize → plugins. Cowork will also surface the update on next session even without manual sync.

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
