# Contributing

Three of us maintain this repo: Kevin, Lucas, Keith. Anyone can edit the skill; the rules below keep us from breaking each other's flow.

## Branch + PR

- Work on a branch named `<your-initials>/<short-description>` (e.g. `kp/tighten-sow-template`).
- Open a PR. **At least one of the other two reviews before merge.** This is the brand/tone catch — the whole point of the skill is consistency, so a second pair of eyes on prose changes is non-negotiable.
- Squash-merge to `main`.

## Bump the version on every merge

Both files must match. Bump them in the same PR as the change.

- `design-skill/.claude-plugin/plugin.json` → `version`
- `.claude-plugin/marketplace.json` → `plugins[0].version`

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
3. Post a one-line summary in `#design` so Lucas and Keith know to **Sync** in Cowork → Customize → plugins.

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
