# Changelog — catalyst-ops

## 0.4.1 — 2026-09-29

- `/next`: preflight (before the first card and before each auto-merge) stops the loop unless `main` enforces `adversarial review` from GitHub Actions in a ruleset the merging identity can't bypass. Checklist lines state outcomes, never tool names, with evidence the CI reviewer can read. gstack is the in-session method, not a gate (every-card / when-it-fits / not-in-/next table). A missing gstack skill means getting the same outcome another way, noted in the PR body, never Blocked, except the canon's §3 attack steps (`/review`, the cross-model adversarial pass, `/cso` on deep paths) and `/careful` on deep paths. A missing, failed, early-stopped or partial §3 run means Blocked, and §3 re-runs on anything edited after it. Deep-path detection uses every path the PR can carry (committed since the merge base, staged, unstaged, untracked; renames off; pipefail) and treats any error as deep. The version and CHANGELOG bump happens before the last §3 pass. After a CI review fail, fix every blocking finding, re-run §3, and push once; an infrastructure-only fail is re-run (or, where the token can't re-run, retried with an empty commit) and still counts toward the three fails; the fail comment must match the current head and the failed run attempt. (CAT-783)

## 0.4.0 — 2026-09-28

- `/next` pickup loop; verify skill and verify-gate hook retired; HOW_WE_BUILD v2 block. (CAT-752, #16)
