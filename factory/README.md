# factory/: the Claude dev factory dispatcher

Every 5 minutes the dispatcher claims the top **Ready For Factory** card in each
Linear project you list, and starts one unattended Claude Code session for it in
its own worktree. When that session has opened a PR, a fresh session reviews the
PR and stamps it `Reviewed: <head sha>`. People merge, except for low-risk PRs at
stage 2 (see Review below). Kevin's and Keith's Omarchy machines both run it from
this folder; Keith's setup follows this README.

## Daily use

```bash
# install or update (safe to re-run; enables nothing by itself)
git -C ~/Projects/catalyst-shift-plugins pull && ~/Projects/catalyst-shift-plugins/factory/install.sh

touch ~/.local/state/claude-factory/paused      # pause: no new sessions or reviews
rm ~/.local/state/claude-factory/paused         # resume

claude-factory-dispatch status                    # one screen: running, waiting PRs, paused
systemctl --user list-units 'factory-*'          # what's running
journalctl --user -u claude-factory -n 50        # what the dispatcher did
tail -f ~/.local/state/claude-factory/cat-123.log          # one builder
tail -f ~/.local/state/claude-factory/review-cat-123.log   # one reviewer

systemctl --user stop factory-cat-123            # stop one builder
systemctl --user stop factory-review-cat-123     # stop one reviewer
systemctl --user disable --now claude-factory.timer   # turn the dispatcher off
```

**One view of everything in flight:** every card the factory picks up gets the
Linear labels `factory` and this machine's label (set `label kevin-omarchy` or
`label keith-omarchy` in repos.conf). A saved Linear view filtered on `factory`,
grouped by status, shows both machines' work on any device.

**Where a card ends up:** every factory card leaves In Progress when its
session ends. *In Review with a PR*: review and merge, and the merge moves it
to Done. *In Review with no PR* (an investigation): read the findings and close
it, or approve the proposed follow-up card. *Blocked*: the card says what it
needs. If a session dies without moving its card, the next dispatcher tick
moves it to Blocked with a pointer to the log.

**Two machines, same projects:** Kevin's and Keith's machines can both list
every project. Each picks Ready For Factory cards that are assigned to its
owner or unassigned, never cards assigned to the other person, and it re-checks
the card before and after claiming it; the session it starts checks the
assignee once more and ends without touching the card if the other machine won.
To steer a card to one machine, assign it. Both timers fire at the same clock
times (:00, :05, ...), and `offset 150` in Keith's repos.conf makes his machine
pick about 2½ minutes later, so the two rarely look at the same card at once.
This needs both clocks synced (systemd-timesyncd or similar). Every Linear team
the factory serves needs the statuses Ready For Factory, In Progress, In
Review, Blocked and Done.

**Dependencies:** when one card must land before another, mark it in Linear
(Blocked by / Blocks). The dispatcher never picks a card while anything it is
blocked by is unfinished (not Done, Canceled or Duplicate), whichever machine
has the blocker. A session that finds an earlier In Progress card touching the
same files or tables puts its own card back in Ready For Factory, blocked by
that card. Only the card that went In Progress later waits, so two cards never
block each other.

**Every PR gets reviewed, not only factory cards:** any open, non-draft PR
in a repo listed in repos.conf whose head has no current `Reviewed:` stamp gets
a fresh reviewer session, however it was opened (a cloud thread, Remote
Control, a laptop). Each machine reviews the PRs its own person opened: by
default the GitHub login `gh` runs as on that machine. `review-authors kkreative
keithcatalyst` in repos.conf replaces that list, for example while only one
machine runs; never list the same login on both machines. Any PR with the
label `no-factory-review` is skipped (add it to opt a PR out), and Dependabot
PRs get their own reviewer (below). The reviewer pushes at most a one-line fix
to a branch it didn't build; anything bigger it answers or reports in a PR comment and leaves the PR
unstamped. One reviewer per head sha, recorded in
`~/.local/state/claude-factory/reviewed/<repo>/<pr>-<sha>`; it shows in
`claude-factory-dispatch status` while it runs, and logs to
`review-<repo>-pr-<n>.log`. `<repo>` is the folder name lowercased, with anything
other than letters and digits turned into `-` (`My_Repo` becomes `my-repo`).

**Dependabot PRs (CAT-1327):** skipped unless `review-authors` lists
`dependabot` (or `dependabot[bot]`), on one machine only, for example
`review-authors kkreative keithcatalyst dependabot`. Then each open Dependabot
PR gets a dependency reviewer instead of `/review`. It installs nothing and
runs nothing from the PR. It reads the lockfile diff for brand-new packages,
new install scripts, a changed registry or tarball source, and major-version
jumps; asks npm (`npm view <pkg>@<ver> maintainers repository`,
`npm view <pkg> time`) for a changed maintainer or repository and for versions
published less than 7 days ago; and scans the lockfile with `osv-scanner` if
it is installed, or the repo's own audit (`npm audit --package-lock-only`,
`pnpm audit`, `yarn npm audit`) if not. It posts one PR comment ending
`Verdict: looks routine` or `Verdict: needs a look: <why>`. Only when routine
does it add `Reviewed: <head sha> — dependency review (no pushes)` to the PR
body; Dependabot PRs are exempt from the `review stamp` check, so the line is
for people and for the dispatcher's one-review-per-sha record. It never
pushes, never merges and never turns on auto-merge, whatever the repo's
factory stage (the session is also denied `git push` and `gh pr merge`):
a person merges every dependency PR. It shares the cap, the
`reviewed/<repo>/<pr>-<sha>` record, and the `review-<repo>-pr-<n>.log` log
with the other PR reviews.

**Caps (per machine):** at most 2 sessions run at once (builders and reviewers
together), and no new card is picked up while 3 or more PRs from branches this
machine's factory launched are open. Reviews still run while that cap holds;
they are how PRs get unstuck.

---

## First install

1. Prerequisites (install.sh checks each and prints what's missing): `git`;
   `gh auth login`; Claude Code, signed in with the claude.ai subscription
   (`claude auth login`; the factory never uses an API key); the Linear
   connector connected at claude.ai, so `claude mcp list` shows
   `claude.ai Linear ... Connected`; a systemd user session.
2. Clone this repo to `~/Projects/catalyst-shift-plugins` and run
   `factory/install.sh`. It copies:
   - `bin/claude-factory-dispatch` to `~/.local/bin/`
   - `systemd/claude-factory.{service,timer}` and `systemd/claude-rc@.service` to
     `~/.config/systemd/user/`, then runs `systemctl --user daemon-reload`
   - `repos.conf.example` to `~/.config/claude-factory/repos.conf`, only if
     that file doesn't exist. It never overwrites it.
3. Edit `~/.config/claude-factory/repos.conf`: one `<repo folder> <Linear project>`
   line per repo this machine works on.
4. Run the commands install.sh printed:
   ```bash
   loginctl enable-linger "$USER"                       # keep running while logged out
   systemctl --user enable --now claude-factory.timer
   systemctl --user enable --now claude-rc@lbl-nextjs.service   # one per repo folder under ~/Projects
   ```

`claude-rc@<folder>.service` runs `claude remote-control --spawn worktree` in
`~/Projects/<folder>`, so you can start and steer sessions from Claude desktop or
mobile. It replaces the older per-repo `claude-rc-<folder>.service` files;
install.sh prints how to retire any it finds.

## How a card flows

1. **Pick.** A cheap `claude -p --model haiku` call, allowed only the Linear MCP
   tools (`mcp__claude_ai_Linear__*`), takes the top Ready For Factory card in
   the project (priority, then oldest), moves it to In Progress, assigns it to
   you, and comments.
2. **Build.** Unit `factory-cat-NNN` runs `claude -p --permission-mode auto -w
   factory-cat-NNN` in the repo. It follows the repo's CLAUDE.md, opens the PR,
   never merges or turns on auto-merge, and moves the card to Blocked on a hard
   stop. It does not stamp its own PR.
3. **Review.** On a later tick, when `factory-cat-NNN` has finished, its branch
   has an open PR, and the PR body has no `Reviewed: <current head sha>` line,
   the dispatcher adds a worktree `.claude/worktrees/factory-review-cat-NNN`
   detached at the PR head and starts unit `factory-review-cat-NNN`: a fresh
   `claude -p --permission-mode auto` session that didn't write the code. It runs
   gstack `/review` (plus `/cso` if the diff touches a path in
   `.github/CODEOWNERS`), fixes or answers each finding, and writes one line
   `Reviewed: <40-char head sha> — /review[, /cso]` in the PR body. It never
   merges itself. A hard stop moves the card to Blocked.
   **Stage 2 (CAT-1326).** After stamping, the reviewer runs `gh pr merge <n>
   --auto --squash --match-head-commit <stamped sha>` only when the PR targets
   the default branch, whose CLAUDE.md has the exact line `Factory stage: 2`,
   the card's Risk is Low, no file in the diff matches `.github/CODEOWNERS`, and
   the stamp is still at the head. GitHub merges once the required checks are
   green. Otherwise nobody turns on auto-merge: not the builder, and never the
   reviewer of a PR without a factory card. These rules live in the prompts; the
   dispatcher does not check them itself. GitHub backs up two of them: a
   CODEOWNERS path still needs a code-owner approval, and `--match-head-commit`
   refuses a moved head. A push after auto-merge is on is caught only once the
   repo's ruleset requires the `review stamp` check.
   The dispatcher starts at most one reviewer per head sha, recorded as
   `~/.local/state/claude-factory/reviewed/cat-NNN-<sha>`. A new push (by a
   person, say) changes the head, so the next tick reviews again. If a reviewer
   ends without stamping, the dispatcher doesn't retry that sha: look at
   `review-cat-NNN.log`.
   Any other open PR without a stamp goes through the same review on unit
   `factory-review-<repo>-pr-<n>` (see "Every PR gets reviewed" above).
4. **Clean up.** Each tick removes a finished builder or reviewer worktree once
   it has no uncommitted changes and nothing unpushed.

## Files

| In the repo | Installed to |
|---|---|
| `bin/claude-factory-dispatch` | `~/.local/bin/` |
| `systemd/claude-factory.service`, `.timer` | `~/.config/systemd/user/` |
| `systemd/claude-rc@.service` | `~/.config/systemd/user/` |
| `repos.conf.example` | `~/.config/claude-factory/repos.conf` (first install only) |

State and logs live in `~/.local/state/claude-factory/`: `launched` (the branches
it started), `reviewed/`, `pick-<project>.log`, `cat-NNN.log`, `review-cat-NNN.log`,
`review-<repo>-pr-<n>.log`.

The dispatcher finds `claude` with `command -v claude` on the service's PATH
(`~/.local/share/mise/shims`, `~/.local/bin`, `/usr/local/bin`, `/usr/bin`).
To use a different binary, set `CLAUDE_BIN` with
`systemctl --user edit claude-factory.service`. The caps can be changed there too:
`CLAUDE_FACTORY_CAP` (default 2) and `CLAUDE_FACTORY_WAITING_CAP` (default 3).
