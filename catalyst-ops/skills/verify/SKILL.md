---
name: verify
description: Fresh-context verifier for a branch before /ship. Reads ONLY the diff against main and the issue's acceptance checklist, checks each line with evidence, returns PASS or FAIL. Never edits code, never sees the builder's reasoning. Use before every /ship; the loop stops after three FAILs. Trigger on "verify", "/verify", "check this against the issue", "is this ready to ship".
user-invocable: true
---

# /verify — the second pair of eyes that did not write the code

The builder normalizes its own mistakes. The verifier gets none of the builder's
context on purpose: the diff, the checklist, the repo. That separation is what
catches missed details. (HOW_WE_BUILD.md §5.)

## Inputs

1. **The issue.** `CAT-###` from the branch name, the PR title, or the user. Fetch
   it with the Linear MCP (`get_issue`) and take the **acceptance checklist** from
   its description. If the issue has no checklist, that is the first FAIL: report
   "no acceptance checklist on CAT-###" and stop.
2. **The diff.** `git diff origin/main...HEAD` (fall back to `main...HEAD`). Plus
   `git diff --name-only` for the touched list.

Nothing else. Do not read the conversation that produced the branch. Do not ask
the builder what it meant. If a checklist line is ambiguous, FAIL it and say so.

## Run it in fresh context

Spawn a subagent (Agent tool, `general-purpose`) whose prompt is exactly:

> You are the verifier. Here is an acceptance checklist and a git diff. For every
> checklist line, decide PASS or FAIL and cite the evidence — a file:line in the
> diff, a command you ran and its output, or a test you executed. Run the repo's
> checks where a line needs them (`npm run lint`, `npm run typecheck`, `npm test`,
> a targeted test file, a script). Do not modify any file. Do not infer intent
> from anything outside the diff. If a line cannot be checked from the diff and
> the repo, mark it FAIL with "not verifiable from diff". Finish with one line:
> `VERDICT: PASS` or `VERDICT: FAIL (n of m)`.

Append the checklist and the diff to that prompt. Give the subagent the repo
path. That is the whole handoff.

## Output

Post the subagent's report to the issue as a comment (`save_comment`) and print
it. Format:

```
/verify CAT-### @ <short sha>
[PASS] <checklist line> — <evidence>
[FAIL] <checklist line> — <what is missing>
...
VERDICT: PASS | FAIL (n of m)
```

On **PASS**: say "ready for /ship". On **FAIL**: list only the failing lines and
what would satisfy them. Do not fix anything. Do not soften a FAIL because the
work looks good otherwise.

## Loop rule

The builder gets three tries. Track the count in the issue comments (`/verify`
comments are the record). On the third FAIL, stop: comment "verify: stopped after
3 fails — needs a human or a better checklist" and do not run again until a
person changes the checklist or the branch.

## What this is not

Not `/review` (that runs inside `/ship` and looks for bugs the checklist did not
anticipate). Not `/qa` (browser). Not `/cso` (Red paths). `/verify` answers one
question only: does the diff satisfy the checklist, with evidence.
