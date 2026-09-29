# Changelog — catalyst-ops

## 0.4.1 — 2026-09-29

- `/next`: preflight (before the first card and before each auto-merge) stops the loop if `main` doesn't require `adversarial review` from GitHub Actions; checklist lines state outcomes, never tool names; gstack is the in-session method, not a gate (every-card / when-it-fits / not-in-/next table), and a missing gstack skill means getting the same outcome another way, noted in the PR body, never Blocked, except the canon's §3 attack steps (`/review`, the cross-model adversarial pass, `/cso` on deep paths), where a missing or failing tool means Blocked; `/careful` stays on for deep paths; after a CI review fail, fixes are batched, §3 re-runs, and there is one push. (CAT-783)

## 0.4.0 — 2026-09-28

- `/next` pickup loop; verify skill and verify-gate hook retired; HOW_WE_BUILD v2 block. (CAT-752, #16)
