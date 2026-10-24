---
name: card
description: Write or fix a Linear card in the Claude dev factory format so the factory can build it — why, 3–8 executable checklist lines, risk class, rollback line, and "blocked by" links set as Linear relations. Use when Kevin or Keith types /card, says "write a card for…", "make this factory-ready", "fix this card", or before moving a card to Ready For Factory. Also used by /next when a card has no checklist. Code work only: a Linear issue for a call, an email, a decision or a document doesn't need this format. Canon: catalyst-brain strategy/2026-10-23-claude-dev-factory.md.
user-invocable: true
---

# /card — a card the factory can build

A card is ready only when someone else could check it from the PR alone. Draft
it, show it, and file or update it in Linear. Keep it short: the card is the
spec, not a design doc.

## The format

```markdown
## Why
One or two sentences: the problem and who it hurts.

## Checklist
1. <a command and its expected output, e.g. `npm test -- menu` passes>
2. <a URL and its expected state on the preview, e.g. /menu loads with no console error>
3. <a DB/API assertion, e.g. GET /api/orders/123 returns 404 for another tenant>
(3–8 lines. Each one is checkable from the PR's evidence. No "works well", no "looks good".)

## Risk
Low | Medium | High: <one line why>. High = migrations, auth, RLS, payments,
env or deploy config, data deletion.

## Rollback
Revert the PR (plus Vercel instant rollback where the repo deploys there). Migrations: name the down path or the forward fix.

## Notes
Optional: what's out of scope, the test target (a non-production database only), links.
```

## Steps

1. **Find or make the card.** Use the card ID you were given, or create one in
   the repo's Linear project. The title says the outcome, not the task.
2. **Fill the format** from what you were told and what the repo shows. Read the
   code enough to write real checklist lines: file names, commands, routes.
   If you have to guess at a product decision, ask. If nobody is there to
   answer, write the question under Notes and leave the card out of Ready For
   Factory.
3. **Dependencies.** If this card can only land after another, set that as a
   Linear "blocked by" relation, not a sentence. The dispatcher won't pick a
   card while anything it's blocked by is unfinished.
4. **Risk is set by what the change will touch**: the High list above and the
   repo's CODEOWNERS deep paths, not how big it feels.
5. **Show the card**, then save it. A new card gets the format as its
   description. On an existing card, the description changes only when the
   person running `/card` asked for that card to be fixed: then rewrite it
   into the format, keep their why, intent and links, and drop only the
   wording under Never write. Otherwise (including when `/next` drafts a
   missing checklist) post the draft as a comment headed
   `Checklist drafted by Claude — edit if wrong` and leave the description
   alone.
6. **Ready For Factory is Kevin's or Keith's call.** Move the card there only if
   one of them says so. Assign it to steer it to one machine; leave it
   unassigned for whichever machine is free.

## Never write

These belong to the retired pre-factory format. Leave them out, and remove them
when you fix an old card:
- pasted "data-fence preflight" blocks, or any "Winston and Lupe paste this word for word";
- steps addressed to Karen, Spex, Lupe, Winston or other bots. Karen is retired,
  and no factory session runs the others (their roles in the factory are still
  open), so a step addressed to them never happens. Verification is `/qa` on the
  preview plus the review stamp;
- pstack playbook names, Cursor settings or `__CURSOR_SANDBOX_ENV_RESTORE`;
- secrets, production database connection strings or project refs, or customer
  data. Saying a bug shows up in production, with a link to the error, is fine.

Keep only the rule that matters: test against a non-production database only.
