# factory/: the Claude dev factory dispatcher

Every 5 minutes the dispatcher claims the top **Ready For Factory** card in each
Linear project you list, and starts one unattended Claude Code session for it in
its own worktree. When that session has opened a PR, a fresh session reviews the
PR and stamps it `Reviewed: <head sha>`. People merge, except for PRs whose risk
the repo's stage on the Factory Board allows (see Review below). Kevin's and Keith's Omarchy machines both run it from
this folder; Keith's setup follows this README.

## Daily use

```bash
# install or update (safe to re-run; enables nothing by itself)
git -C ~/Projects/catalyst-shift-plugins pull && ~/Projects/catalyst-shift-plugins/factory/install.sh

touch ~/.local/state/claude-factory/paused      # pause: no new sessions or reviews
rm ~/.local/state/claude-factory/paused         # resume

claude-factory-dispatch status                    # one screen: running, waiting on you to merge, other open PRs, stages, paused, boot check
claude-factory-dispatch merge-rule <repo> <risk> --dry-run   # may a reviewer self-merge that risk now? (stage and source; changes nothing)
claude-factory-bootcheck                          # will it all come back after a reboot? (read-only; see First install)
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
to Done (the dispatcher does this; see "Waiting on you to merge" below). *In Review with no PR* (an investigation): read the findings and close
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
has the blocker. A session that finds an earlier In Progress card changing the
same code or tables puts its own card back in Ready For Factory, blocked by
that card. Adding to the same list (a nav link, a feature-map row) doesn't
count: it builds and resolves that conflict on rebase. Only the card that went In Progress later waits, so two cards never
block each other.

**Parent issues** (cards with sub-issues, like a Factory v2 epic) are never
picked, even in Ready For Factory: they track other cards and are not built.

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
factory stage: a person merges every dependency PR. Release notes in a
Dependabot PR are written by package authors, so the session doesn't rely on
the prompt: it runs in `dontAsk` mode with a short allowlist (`gh pr
view/diff/comment/edit`, `git fetch/diff/log/show`, `npm view`, the
lockfile-only audits, `osv-scanner`), denies `git push`, `gh pr merge` and
`gh api`, and loads neither the repo's `.claude` settings nor MCP servers. It shares the cap, the
`reviewed/<repo>/<pr>-<sha>` record, and the `review-<repo>-pr-<n>.log` log
with the other PR reviews.

**Merge conflicts (CAT-1468):** each tick, before the reviews, any open,
non-draft PR that GitHub lists as `CONFLICTING` gets a conflict session in its
own worktree (`factory-conflict-<repo>-pr-<n>`), detached at the PR head. It
merges the PR's base branch in (a merge commit, never a rebase or force-push),
keeps both sides' intent (both sides' list entries; old-format entries moved
to the current format), runs every check the repo's CLAUDE.md and CI run, and
only then pushes to the PR's own branch, with one PR comment saying which files
conflicted, how each was resolved and which checks passed. The new head has no
stamp, so the next review sweep reviews it. When both sides changed the same
logic and picking one loses behaviour, it doesn't guess: it comments both
versions on the PR, adds the label `needs-conflict-call`, and pushes nothing;
a person resolves it, or removes the label to let the next tick try again. A
failed check also pushes nothing, gets one PR comment with the output and the
same label, so a red check isn't retried on every push to main. It never
merges the PR, edits its body or touches a card. The usual spellings of a
force-push, a branch delete, a push to the base, a rebase, `gh pr merge` and
`gh api` are also denied by pattern (`--disallowedTools`). That list backs up
the prompt; it is not a sandbox, so a protected default branch is still the
guard against a push to it.
Skipped: Dependabot PRs, PRs from forks, PRs labelled `no-factory-review`
(that opt-out covers conflict sessions too) or `needs-conflict-call`, PRs whose
head is the default branch or another open PR's base (a push there would land
on a shared branch), PRs with a builder, reviewer or CI session running on them, and PRs
that are neither from a branch this machine launched nor by one of its review
authors. Conflict sessions share the cap and show in
`claude-factory-dispatch status`; no reviewer starts on a PR while its conflict
session runs. Each PR is tried once per (head sha, base sha), recorded in
`~/.local/state/claude-factory/conflicts/<repo>/<pr>-<head>-<base>`, and logs
to `conflict-<repo>-pr-<n>.log`; a new push to either side tries again.
Each conflicting PR the sweep passes over gets one journal line per tick
saying why (`PR #<n> in <repo> conflicts; …`, including `waiting for a free
slot (<running>/<cap>)`), and PRs whose mergeability GitHub still shows as
`UNKNOWN` are listed per repo and never resolved (CAT-1478).

**Red CI (CAT-1479):** each tick, right after the conflict sweep, any open PR
from a branch this machine's factory launched whose required checks (`gh pr
checks --required`, which reads the branch ruleset) have a failing conclusion
at its head gets a CI session in its own worktree (`factory-ci-<repo>-pr-<n>`),
detached at the PR head, on the `build-medium` model. It reads the failing
job's log, reproduces the failure locally before changing anything, checks
whether the base branch fails the same way, root-causes it, makes the smallest
fix, runs every check the repo's CLAUDE.md and CI run, and pushes a normal
commit to the PR's own branch (never a rebase, amend or force-push), ending its
message with `Factory-CI-Fix: PR #<n>`, then posts one PR comment naming the
failing check, the cause and the checks that passed. A failure that is red on
the base too gets one comment saying so and no push. One it can't reproduce or
fix without guessing, or whose checks still fail after the fix, gets one
comment and the label `needs-ci-call`, and no push. It never skips, disables
or quarantines a test, never loosens a rule or weakens CI, never merges, never
edits the PR body and never touches a card; the same push patterns as conflict
sessions, plus `git commit --amend`, are denied by `--disallowedTools`.
A `review stamp` failure alone starts nothing (the review sweeps handle
stamps), and a PR with no required checks is never red. Each PR is tried once
per (head sha, failing check set), recorded in
`~/.local/state/claude-factory/ci/<repo>/<pr>-<head>-<set hash>`, and logs to
`ci-<repo>-pr-<n>.log`. If the PR is red again and its head is the session's
own `Factory-CI-Fix` commit, on top of a head the factory already tried, the
dispatcher labels it `needs-ci-call` and comments once instead of starting
another session; anything pushed on top of that fix (by a person, a reviewer
or a conflict merge) is a fresh try, up to a limit: whatever the trailer says,
once the factory has tried a PR at 3 earlier heads of its branch, the next red
head is labelled instead (`CI_TRIES` in the dispatcher), so no PR can start
sessions without end. A PR labelled `needs-ci-call` waits for
a person, and its tries are forgotten when the dispatcher labels it and
whenever a tick sees the label (red or green),
so removing the label lets the next tick try again, with its tries starting over. One `gh pr list` per
repo finds the PRs, not one call per launched branch. Each red PR the sweep
passes over gets one journal line per tick saying why (`PR #<n> in <repo>
fails CI (<checks>); …`): labelled `needs-ci-call`, `no-factory-review` (the
opt-out covers CI sessions too) or `needs-conflict-call`, conflicting with its
base (the conflict sweep goes first), a draft, a branch name that isn't plain,
a builder, reviewer, conflict or CI session running on it, a required check
still running, already tried at this head, or `waiting for a free slot
(<running>/<cap>)`. CI sessions share the cap; no reviewer or conflict
session starts on a PR while its CI session runs. The session checks the base
in a scratch worktree, `.claude/worktrees/ci-base-<repo>-pr-<n>` (passed with
`--add-dir`); the next tick after the session ends removes it if the session
didn't. A failure to read a PR's required checks gets its own journal line
(`could not read its required checks`); a repo with no required checks gets
none. PRs the factory didn't build, and forks, are out of scope.

**Cut-off sessions (CAT-1481):** the once-per-head records above (`reviewed/`,
`conflicts/`, `ci/`) say whether that session finished. Just before a
reviewer, conflict or CI unit starts, its record is written as `started <date>
<boot id>` (the id from `/proc/sys/kernel/random/boot_id`). The unit's
`ExecStopPost` runs `claude-factory-mark-done <record>` (a separate script, so
units started by this version never run a dispatcher tick after a rollback). It
rewrites the record to `done <date>` when the session exited 0, and to
`stopped <date> <boot id>` when it was stopped (SIGTERM: `systemctl --user
stop`, or a shutdown). A record still `started` with no unit running (or
starting or stopping) means the session was cut off: a power loss, a crash, or
a session that died on start (any non-zero exit). A `stopped` record counts as
cut off only when the boot id has changed since (the machine shut down); in
the same boot it was a person's stop, and it stays tried. The sweep that finds
a cut-off record at the PR's current head starts the session once more and,
as it starts it, logs `PR #<n> in <dir>: <kind> session was
interrupted (<reason>); retrying once` (`<kind>` is review, conflict or CI;
the reason is `the machine restarted`, `unit result <result>` while systemd
still has the unit, or `it ended without finishing`). The retry's record
carries ` retry`. If that one is cut off too, nothing starts again at that
head: the PR gets one comment saying a person should look, the journal says
so, and the record becomes `interrupted <date> retry <reason>`; a new push
gets a fresh try. A CI retry counts toward `CI_TRIES`, at an earlier head or
this one. Records written before this change hold a bare date and still mean
tried, so upgrading starts nothing new. Nothing is retried while `systemctl
--user` can't reach the user bus. A cut-off session that left uncommitted
work in its worktree waits for a person, as before (`left over with unpushed
work`), and so does one waiting for a free slot: neither logs a retry until it
starts. Builders are not covered: `settle` already handles a builder that ends
without a PR. A machine-wide failure (the subscription's usage limit, an
expired login, no network) fails the retry too, so each PR it hit gets the
"cut off twice" comment.

**Waiting on you to merge (CAT-1336):** when a PR from a branch this machine's
factory launched is open, stamped at its head (`Reviewed: <head sha>`) and its
CI is green (every check in `gh pr checks` passed or was skipped; a PR with no
checks never counts as green), the dispatcher adds the Linear label
`needs-merge` to its card, once. Filter a Linear view on `needs-merge` to see
what is waiting on you, and `claude-factory-dispatch status` lists those PRs
with their URL under "Waiting on you to merge", apart from Running and the
other open PRs. When the PR merges, the card moves to Done (if it isn't
already) and loses `needs-merge`. When it is closed without merging, the label
comes off and the status stays. The label is an existing workspace label, so
it works in every team; the dispatcher never creates it. Each change is one
cheap `claude -p` call on the `housekeeping` model (Haiku; see Models) allowed only `get_issue` and `save_issue`,
recorded in `~/.local/state/claude-factory/merge/<card key>-<pr number>`
(`labelled`, `done` or `closed`, then the PR number) only once Linear confirms it, so
nothing repeats and a failed call is retried next tick; each call's output goes
to `merge.log`. PRs merged or closed more than 7 days ago are left alone. A
new push after the label went on doesn't take it off; the merge or close
does. PRs the factory didn't build are never labelled, and nothing happens
while the factory is paused.

**Caps (per machine):** at most 2 sessions run at once (builders, reviewers,
conflict and CI sessions together), and no new card is picked up while 3 or more PRs from branches this
machine's factory launched are open (those waiting on you to merge count too).
Reviews still run while that cap holds; they are how PRs get unstuck. To change
either cap on one machine, add a drop-in with `systemctl --user edit
claude-factory.service`:

```ini
[Service]
Environment=CLAUDE_FACTORY_WAITING_CAP=5
```

The next tick picks it up (each tick is a fresh run). `claude-factory-dispatch
status` run from a shell doesn't read the drop-in, so the cap it prints is the
default unless you set the same variable there.

**Models (CAT-1476):** each kind of session runs on the model set for its job
in repos.conf, one `model <job> <model>` line per job you change. A job with no
line runs on its default:

| Job | Runs | Default |
|---|---|---|
| `build-high` | builder for a card whose Risk is High, missing or unclear | `claude-opus-5-5` |
| `build-medium` | builder for a Medium-risk card, and every CI session (CAT-1479) | `claude-opus-5-5` |
| `build-low` | builder for a Low-risk card | `claude-sonnet-5-5` |
| `review` | the card reviewer and the reviewer of other PRs | `claude-sonnet-5-5` |
| `dep-review` | the Dependabot dependency reviewer | `claude-haiku-5-5` |
| `housekeeping` | the Linear pick, settle, needs-merge, retro-clean, touch and report calls | `haiku` |
| `retro` | the `/reflect` session after a merged PR that had friction (CAT-1433) | `claude-sonnet-5-5` |

```
model build-low claude-opus-5-5
model review claude-opus-5-5
```

The pick reads the card's Risk section and ends with `PICK <card> <branch>
<Low|Medium|High|Unknown>`; anything but Low or Medium (or an older PICK line
with no risk) builds on `build-high`. A model is letters, digits, dots and
dashes; a value that isn't, or a job name that doesn't exist, is ignored with a
line in the dispatcher's log. Every session's `--model` is on its unit's
command line, in the dispatcher's `started …` line, and next to each running
unit in `claude-factory-dispatch status`. The next tick picks a change up.
**Back on Opus:** builders and reviewers ran on the account default (Opus)
before this; to go back, add `model build-low claude-opus-5-5`,
`model review claude-opus-5-5` and `model dep-review claude-opus-5-5`
(housekeeping was already Haiku; add `model housekeeping claude-opus-5-5` too
for every job on Opus).

## Streaming to the board

With `FACTORY_INGEST_TOKEN` set (CAT-1442), each card's console on the Factory
Board (`os.catalystshift.ai/factory`) shows the session live, and the board shows
the machine's state. Without it, nothing is sent and sessions run as before.

**Turn it on:** the board issues one token per machine (catalyst_os
`scripts/factory-ingest-token.ts`). Put it in the factory user environment, in
a file only you can read, then restart the user units that need it:

```bash
install -m600 /dev/null ~/.config/environment.d/70-factory-ingest.conf
$EDITOR ~/.config/environment.d/70-factory-ingest.conf   # one line, no quotes: FACTORY_INGEST_TOKEN=<this machine's token>
# now, without logging out (the value goes through the environment, never a command line):
(set -a; . ~/.config/environment.d/70-factory-ingest.conf; systemctl --user import-environment FACTORY_INGEST_TOKEN)
systemctl --user enable --now claude-factory-heartbeat.service
systemctl --user restart claude-factory-heartbeat.service   # it reads the token when it starts
```

The machine name sent is repos.conf's `label` (`kevin-omarchy`), which must be
the name the token was made for. **Turn it off (rollback):** delete that file,
`systemctl --user unset-environment FACTORY_INGEST_TOKEN`, then
`systemctl --user restart claude-factory-heartbeat.service`. The next session
runs without streaming and the heartbeat sends nothing. **Rotate:** put the new
token in the file and run the import and restart lines again. (A heartbeat whose
token the board refuses restarts itself after a minute, so it also picks up a new
token on its own.)

**Who can read the token:** sessions are started without it in their
environment, and its value is masked in anything sent. A session still runs as
the same Linux user, so a determined one could read the file or the user
manager's environment; the token only lets a caller post events as this
machine, and the board can rotate it. Keeping it from same-user processes would
need the streamer to run as a separate user.

**What runs:** the dispatcher starts every session under
`claude-factory-stream run`, which runs claude with `--output-format stream-json`
(the unit's log keeps the raw lines) and posts the events to
`POST /api/ingest/events` in batches of up to 50 every 2 seconds, with the token
as `Authorization: Bearer`. Before sending, each event is cleaned: file
contents (a Read, a Grep in content mode, an MCP tool that returns files, query
rows, messages or logs, and the common shell prints: `cat`/`head`/`tail`/`sed -n`
of a file, `git show rev:file`) are never sent, only their size. The shell
check is a list of known commands, not a guarantee: another way to print a file
(`grep . f`, `bash -c "cat f"`, `sqlite3`) is sent masked and cut to 4 KB, like
any other tool result. Nor is the output sent of a call that touches
`.env` files, `env`/`printenv`/`set`/`export`, `process.env`, keys or
credentials; every other tool result and every string is cut to 4 KB; secrets
in text (`*_TOKEN=`, `password:`, `ghp_…`, `sk-…`, URL passwords, this
machine's secret env values) are masked. The session's environment never
carries the token. Each session also sends
`status` events: `start` (or `review` for a reviewer), each stage change
(`investigate`, `build`, `qa`, `ship`, `review`, from the skills it runs, its
edits and `gh pr create`) and `end`.

**Board down:** every batch is written to
`~/.local/state/claude-factory/spool/<sessionId>.jsonl` before it is sent and
taken out once the board stores it, so nothing is lost (a batch sent twice is
ignored by the board). A session retries with backoff and never waits on the
network; what is left when it ends is sent by the next dispatcher tick, oldest
session first. A batch that is too large is split and resent; one the board
can never take (400, or 413 for a single event) is kept in
`spool/<sessionId>.rejected.jsonl`. The spool and state files are readable
only by you. Each send is logged in the session's log with its time on the
session's side (`prep … ms`) and the post's. If streaming fails in any way
(disk full, a bug), it stops with one log line and the session carries on.

The session's log (`cat-NNN.log`) now holds the raw stream-json lines, not just
the final answer. To read the answer:
`jq -rR 'fromjson? | select(.type == "result") | .result' ~/.local/state/claude-factory/cat-123.log`. It stays
on the machine and is never sent as is.

```bash
claude-factory-dispatch status --json   # per running card: last seq the board stored, events still in the spool
```

**Heartbeat:** `claude-factory-heartbeat.service` posts
`{machine, dispatcher, pausedUntil, lastPassAt, lastPassResult, runningCap, running[], reviewWaiting, reviewCap, control, controlVersion}`
every 60 seconds and within 5 seconds of a change. The dispatcher writes the
pass fields to `state/pass.json` at the end of every tick (and right after it
reads the board's control, so a pause shows without waiting for the pass to end).
The heartbeat starts
and stops with `claude-factory.timer`, so a stopped dispatcher goes silent and
the board flags the machine after 15 minutes. `control` is `live` (the board
answered on the last tick), `stale` (it did not; the last settings stay in
force) or `local` (no token).

**Control from the board (CAT-1441):** with the token set, each tick starts with
`GET https://os.catalystshift.ai/api/machines/<machine>/control`
(`<machine>` is the `label` in repos.conf), which answers
`{"paused_until":null,"runningCap":null,"reviewCap":null,"stop":[],"version":n}`.
The last good answer is kept in `state/control.json`.

- `paused_until` in the future: no new card is claimed (reviews, conflict and CI
  sessions still run), the heartbeat shows `"dispatcher":"paused"` with
  `pausedUntil`. The `paused` file still pauses everything, as before.
- `runningCap` and `reviewCap` replace `CLAUDE_FACTORY_CAP` and
  `CLAUDE_FACTORY_WAITING_CAP` when they are whole numbers from 1 to 8; anything
  else is ignored and logged.
- A card id in `stop[]`: its builder or reviewer unit is stopped, the card moves
  to Blocked with the comment `stopped via Factory Board`, and the machine posts
  `{version, stopped:[...]}` to `.../control/ack` so the board clears the id.
  Each step is recorded in `state/stopped/<card key>` and retried next tick if
  it fails.
- Board unreachable (or any answer but a valid 200): the last settings stay and
  the heartbeat says `stale`. A failed fetch never starts a pause or a stop.
- `claude-factory-dispatch status --json` has a `control` object: `state`, the
  settings and `version` as last read, and the `effective` caps.

Rollback: remove `FACTORY_INGEST_TOKEN` from the machine (see above); the
dispatcher ignores control and the usual caps apply.

---

## First install

1. Prerequisites (install.sh checks each and prints what's missing): Chrome
   stable (`yay -S google-chrome`; install.sh stops without it, see Browser); `git`;
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
   line per repo this machine works on. The `model` lines are optional (see Models).
4. Run the commands install.sh printed:
   ```bash
   loginctl enable-linger "$USER"                       # keep running while logged out
   systemctl --user enable --now claude-factory.timer
   systemctl --user enable --now claude-rc@lbl-nextjs.service   # one per repo folder under ~/Projects
   ```
5. Re-run `factory/install.sh`. It ends with a **boot check** (CAT-1483) that
   prints `ok` or `MISSING` for each thing a reboot with nobody logged in
   needs: Linger on, `claude-factory.timer` enabled,
   `claude-factory-heartbeat.service` enabled (only when `FACTORY_INGEST_TOKEN`
   is set), and an enabled `claude-rc@<folder>.service` for every repo folder in
   repos.conf. Each MISSING line ends with the command that fixes it. The check
   is read-only (`bin/claude-factory-bootcheck`); install.sh still enables
   nothing itself. `claude-factory-dispatch status` repeats it in one line:
   `boot: ok`, or `boot: 2 missing (run install.sh)`.

`claude-rc@<folder>.service` runs `claude remote-control --spawn worktree` in
`~/Projects/<folder>`, so you can start and steer sessions from Claude desktop or
mobile. It replaces the older per-repo `claude-rc-<folder>.service` files;
install.sh prints how to retire any it finds.

## Browser

gstack's `/browse` and `/qa` drive a real browser from unattended sessions on a
machine that holds repo, Linear and Vercel credentials. By default gstack uses
Playwright's bundled Chromium, which lags Chrome stable and its security fixes.
So factory machines point gstack at Chrome stable with the sandbox on (CAT-1416):

- install.sh refuses to run until `/usr/bin/google-chrome-stable` exists
  (`yay -S google-chrome`).
- It installs `environment.d/60-gstack-chrome.conf` to `~/.config/environment.d/`
  (`GSTACK_CHROMIUM_PATH=/usr/bin/google-chrome-stable`) and sets it in the
  running user manager, so every user unit gets it: the dispatcher,
  `claude-rc@`, the `factory-*` sessions and the desktop session. It applies to
  every project on the machine; a repo's `.env` can't override it.
- It refuses to finish if the user manager, environment.d or the factory units
  set `GSTACK_CHROMIUM_NO_SANDBOX`, `CI` or `CONTAINER`: any of them makes gstack
  launch Chromium with `--no-sandbox`.

Chrome stays patched with the system: `yay -Syu` (which includes `pacman -Syu`).

Check it:

```bash
systemctl --user show-environment | grep GSTACK_CHROMIUM_PATH   # /usr/bin/google-chrome-stable
# while a session is running /browse:
ps -o args= -C chrome | head -1     # /opt/google/chrome/chrome ..., no --no-sandbox
google-chrome-stable --version      # chrome://version in that browser shows the same
```

Real Chrome blocks `--load-extension`; headless `/browse` and `/qa` don't need it.
Units started before the first install pick the path up on their next start
(`systemctl --user restart claude-rc@<folder>.service`; `factory-*` units are
new for every card). Rollback: delete `~/.config/environment.d/60-gstack-chrome.conf`,
run `systemctl --user unset-environment GSTACK_CHROMIUM_PATH` and restart the
units; gstack goes back to its bundled Chromium.

## How a card flows

1. **Pick.** A cheap `claude -p` call on the `housekeeping` model (Haiku),
   allowed only the Linear MCP tools (`mcp__claude_ai_Linear__*`), takes the top
   Ready For Factory card in the project (priority, then oldest), moves it to
   In Progress, assigns it to you, comments, and reads the card's Risk.
2. **Build.** Unit `factory-cat-NNN` runs `claude -p --model <model for the
   card's Risk> --permission-mode auto -w factory-cat-NNN` in the repo (see Models). It follows the repo's CLAUDE.md, opens the PR,
   never merges or turns on auto-merge, and moves the card to Blocked on a hard
   stop. It does not stamp its own PR.
3. **Review.** On a later tick, when `factory-cat-NNN` has finished, its branch
   has an open PR, and the PR body has no `Reviewed: <current head sha>` line,
   the dispatcher adds a worktree `.claude/worktrees/factory-review-cat-NNN`
   detached at the PR head and starts unit `factory-review-cat-NNN`: a fresh
   `claude -p --model <review model> --permission-mode auto` session that didn't write the code. It runs
   gstack `/review` (plus `/cso` if the diff touches a path in
   `.github/CODEOWNERS`), fixes or answers each finding, and writes one line
   `Reviewed: <40-char head sha> — /review[, /cso]` in the PR body. It never
   merges itself. A hard stop moves the card to Blocked.
   **Stages (CAT-1326, CAT-1486).** The dispatcher gives the reviewer the
   repo's stage: the one the Factory Board computes (`GET
   /api/factory/stages`, read each tick with the machine token and cached in
   `~/.local/state/claude-factory/stages.json`). On a 503 `read_failed` or a
   network error it keeps the cached answer for up to 24 hours; on a 401 or
   403, a 503 `not_configured`, no token, or no (fresh) cache, it uses the old
   rule: stage 2 when the default branch's CLAUDE.md has the exact line
   `Factory stage: 2`, else stage 1. A repo the board's answer leaves out is
   stage 1. `stages claude-md` in repos.conf
   ignores the board. `claude-factory-dispatch status --json` shows each
   repo's stage and its source (`board`, `cache` or `claude-md`).
   After stamping, the reviewer runs `gh pr merge <n> --auto --squash
   --match-head-commit <stamped sha>` only when the PR targets the default
   branch, the card's Risk is one the stage allows (stage 2: Low; stage 3: Low
   or Medium; stage 4: any), below stage 4 no file in the diff matches
   `.github/CODEOWNERS`, the stamp is still at the head, and, right before,
   `claude-factory-dispatch merge-rule <repo> <risk> --dry-run` still prints
   `self-merge allowed` (so a founder's veto on the board stops it from the
   next tick). GitHub merges once the required checks are green. Before a
   stage-4 High auto-merge, the reviewer adds the card label `post-merge-review`
   and the comment `post-merge review due <next working day>` (no label, no
   auto-merge); the dispatcher then leaves the
   merged card's status alone until a founder clears the label. Otherwise nobody turns on auto-merge: not the builder, and never the
   reviewer of a PR without a factory card. These rules live in the prompts; the
   dispatcher does not check them itself. GitHub backs up two of them: a
   CODEOWNERS path still needs a code-owner approval, and `--match-head-commit`
   refuses a moved head. A push after auto-merge is on is caught only once the
   repo's ruleset requires the `review stamp` check.
   The dispatcher starts at most one reviewer per head sha, recorded as
   `~/.local/state/claude-factory/reviewed/cat-NNN-<sha>`. A new push (by a
   person, say) changes the head, so the next tick reviews again. If a reviewer
   finishes without stamping, the dispatcher doesn't retry that sha: look at
   `review-cat-NNN.log`. One that was cut off (a reboot, a crash, a non-zero
   exit) is started once more (see "Cut-off sessions" above).
   Any other open PR without a stamp goes through the same review on unit
   `factory-review-<repo>-pr-<n>` (see "Every PR gets reviewed" above).
4. **Clean up.** Each tick removes a finished builder or reviewer worktree once
   it has no uncommitted changes and nothing unpushed.
5. **Retro (CAT-1433).** The pass after a factory PR merges looks at it once
   (`~/.local/state/claude-factory/retro/cat-NNN-<pr>`), from the PR alone, with
   no model: review comments or a `Factory-Review-Fix:` commit, a
   `Factory-CI-Fix:` commit or a `Merge … into …` commit, a commit without the
   Claude co-author trailer, a PR comment from anyone but the deploy bots in
   `CLAUDE_FACTORY_RETRO_IGNORE` (default `vercel|github-actions|dependabot|codecov|supabase|linear|sentry|neon-database|socket-security`),
   a `needs-ci-call` / `needs-conflict-call` label, or a later merged PR that
   reverts it. None of those: the card gets `retro: clean` and no session starts.
   Any of them: unit `factory-retro-cat-NNN` (job `retro` in Models, default
   Sonnet; counts toward the running cap) runs `/reflect` in a worktree on the
   default branch. It judges each lesson (durable, decision-changing, not a
   one-off, not already covered, routed to a skill the session used), comments
   `retro: <n> accepted, <n> rejected` on the card with each rejection's reason,
   and batches accepted skill and CLAUDE.md edits into the repo's one open
   `factory-reflect` PR. Anything a lint, type, test or script could enforce, or
   a repeat of a mistake in the rules table, goes to `/correct`: a
   `factory-correct/cat-NNN` PR with the check proven against the commit that had
   the mistake, merged under the repo's normal stage. The `factory-reflect` PR
   is never self-merged; Kevin or Keith approve it from the Retros page's
   **Review release** or on GitHub. `validate` fails any `factory-reflect*` or
   `factory-correct*` PR that touches `.github/`, a ruleset, CODEOWNERS, the
   required-checks list, the hard-stop list (the Ways of Working block) or the
   ways-of-working skill (`scripts/retro-guard.mjs`). A retro never adds a gate.
   A retro whose unit fails to start is retried next tick; one that ran and left
   no `retro:` comment is not (look at `retro-cat-NNN.log`).
6. **Touches.** A card with an open PR is checked (at most every 15 minutes) for
   a person pulling it back out of In Review to In Progress, Ready For Factory or
   Todo; each such move gets one `touch: <who> <reason> [<time>]` comment.
   Moves to Done, Canceled and Blocked don't count (the factory's own reviewer
   and settle pass move cards to Blocked).

`claude-factory-dispatch retro --since 7d` (`--since <N>d`, default 7d) prints
one line per repo with the counts of clean retros, accepted, rejected and
structural (sent to `/correct`) lessons and touches, read from those `retro:`
and `touch:` comments with one housekeeping call per repo. It takes no lock and
changes nothing.

## Files

| In the repo | Installed to |
|---|---|
| `bin/claude-factory-dispatch` | `~/.local/bin/` |
| `bin/claude-factory-stream` (node 18+) | `~/.local/bin/` |
| `bin/claude-factory-mark-done` | `~/.local/bin/` |
| `bin/claude-factory-bootcheck` | `~/.local/bin/` |
| `systemd/claude-factory.service`, `.timer` | `~/.config/systemd/user/` |
| `systemd/claude-factory-heartbeat.service` | `~/.config/systemd/user/` |
| `systemd/claude-rc@.service` | `~/.config/systemd/user/` |
| `environment.d/60-gstack-chrome.conf` | `~/.config/environment.d/` |
| `repos.conf.example` | `~/.config/claude-factory/repos.conf` (first install only) |

State and logs live in `~/.local/state/claude-factory/`: `launched` (the branches
it started), `reviewed/`, `settled/`, `merge/`, `pick-<project>.log`, `settle.log`,
`merge.log`, `cat-NNN.log`, `review-cat-NNN.log`, `review-<repo>-pr-<n>.log`,
`pass.json` (how the last tick ended), and with streaming on, `spool/` and
`stream/<unit>.json`.

The dispatcher finds `claude` with `command -v claude` on the service's PATH
(`~/.local/share/mise/shims`, `~/.local/bin`, `/usr/local/bin`, `/usr/bin`).
To use a different binary, set `CLAUDE_BIN` with
`systemctl --user edit claude-factory.service`. The caps can be changed there too
(see Caps above): `CLAUDE_FACTORY_CAP` (default 2) and `CLAUDE_FACTORY_WAITING_CAP`
(default 3).
