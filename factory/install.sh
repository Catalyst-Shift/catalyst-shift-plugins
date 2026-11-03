#!/usr/bin/env bash
# Install or update the Claude factory for the current user. Safe to re-run:
#   git pull && factory/install.sh
# It copies the dispatcher and the systemd units, reloads systemd, and checks
# prerequisites. It never overwrites repos.conf and never enables or starts
# anything: it prints the commands for that.
set -euo pipefail

SRC=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
BIN=$HOME/.local/bin
UNITS=$HOME/.config/systemd/user
CONF_DIR=$HOME/.config/claude-factory
CONF=$CONF_DIR/repos.conf
STATE=$HOME/.local/state/claude-factory

ENVD=$HOME/.config/environment.d
CHROME=/usr/bin/google-chrome-stable
# Any of these makes gstack launch Chromium with --no-sandbox (CAT-1416).
NO_SANDBOX_VARS='GSTACK_CHROMIUM_NO_SANDBOX|CI|CONTAINER'

# gstack's browser runs on Chrome stable, not Playwright's bundled Chromium.
# Check before installing anything, so a machine without it is left as it was.
if [ ! -x "$CHROME" ]; then
  echo "== Refusing to install: $CHROME not found"
  echo "  gstack's /browse and /qa run on Chrome stable on factory machines (see factory/README.md, Browser)."
  echo "  Install it from the AUR, then re-run this script:  yay -S google-chrome"
  exit 1
fi

echo "== Installing from $SRC"
install -Dm755 "$SRC/bin/claude-factory-dispatch" "$BIN/claude-factory-dispatch"
echo "  $BIN/claude-factory-dispatch"
for f in "$SRC"/systemd/*; do
  install -Dm644 "$f" "$UNITS/$(basename "$f")"
  echo "  $UNITS/$(basename "$f")"
done
for f in "$SRC"/environment.d/*.conf; do
  install -Dm644 "$f" "$ENVD/$(basename "$f")"
  echo "  $ENVD/$(basename "$f")"
done
if [ -e "$CONF" ]; then
  echo "  $CONF exists; left as it is"
else
  install -Dm644 "$SRC/repos.conf.example" "$CONF"
  echo "  $CONF created from the example: every line is commented out, add your repos"
fi
mkdir -p "$STATE"

missing=0
miss() { echo "  MISSING: $*"; missing=1; }
ok() { echo "  ok: $*"; }

echo "== Prerequisites"
if command -v git >/dev/null; then ok "git"; else miss "git (sudo pacman -S git)"; fi
if command -v gh >/dev/null; then
  if gh auth status >/dev/null 2>&1; then ok "gh logged in"; else miss "gh is not logged in (gh auth login)"; fi
else
  miss "gh (sudo pacman -S github-cli, then gh auth login)"
fi
CLAUDE=${CLAUDE_BIN:-$(command -v claude || true)}
if [ -z "$CLAUDE" ]; then
  miss "claude (install Claude Code, then claude auth login)"
else
  case "$("$CLAUDE" auth status --json 2>/dev/null </dev/null || true)" in
    *'"loggedIn": true'*'"authMethod": "claude.ai"'*) ok "claude logged in with a claude.ai subscription" ;;
    *'"loggedIn": true'*) miss "claude is logged in, but not with a claude.ai subscription (claude auth login); the factory never uses an API key" ;;
    *) miss "claude is not logged in (claude auth login)" ;;
  esac
  if timeout 120 "$CLAUDE" mcp list 2>/dev/null </dev/null | grep -qE '^claude\.ai Linear:.*Connected'; then
    ok "Linear connector (claude.ai Linear) connected"
  else
    miss "the Linear connector: connect Linear at claude.ai (Settings > Connectors), then check: claude mcp list"
  fi
fi
if systemctl --user show-environment >/dev/null 2>&1; then
  ok "systemd user session"
  systemctl --user daemon-reload
  ok "systemctl --user daemon-reload"
  # environment.d is read when the user manager starts; set it now as well so
  # running units pick it up on their next start without a re-login.
  systemctl --user set-environment GSTACK_CHROMIUM_PATH="$CHROME"
  ok "GSTACK_CHROMIUM_PATH=$CHROME ($("$CHROME" --version 2>/dev/null || echo 'version unknown'))"
else
  miss "a systemd user session (systemctl --user does not answer)"
fi
# The sandbox stays on: nothing in the user manager, environment.d or the
# factory units (or their drop-ins, including service.d/ and factory-.service.d/,
# which reach the transient factory-* units) may set a variable that turns it off.
# An Environment= line can hold several assignments, so any of them counts.
sandbox_off=$( { systemctl --user show-environment 2>/dev/null || true
  cat "$ENVD"/*.conf "$UNITS"/claude-factory.service "$UNITS"/claude-rc@.service \
    "$UNITS"/claude-*.d/*.conf "$UNITS"/factory-*.d/*.conf "$UNITS"/service.d/*.conf 2>/dev/null || true
} | grep -E "^[[:space:]]*(Environment=([^#;]*[[:space:]])?)?\"?($NO_SANDBOX_VARS)=" || true)
if [ -n "$sandbox_off" ]; then
  echo "== Refusing to finish: this would turn Chromium's sandbox off:"
  echo "$sandbox_off" | sed 's/^/  /'
  echo "  Remove it (systemctl --user unset-environment <NAME>, and the line in ~/.config/environment.d/ or the unit), then re-run."
  exit 1
fi
ok "Chromium sandbox stays on (no GSTACK_CHROMIUM_NO_SANDBOX, CI or CONTAINER)"
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  echo "  note: ANTHROPIC_API_KEY is set in this shell; the factory ignores it and runs on the subscription"
fi
linger=$(loginctl show-user "$USER" -p Linger --value 2>/dev/null || true)

echo "== To turn it on (install.sh never does this itself)"
echo "  loginctl enable-linger $USER     # keep it running while you are logged out (now: Linger=${linger:-unknown})"
echo "  systemctl --user enable --now claude-factory.timer"
if [ -f "$CONF" ]; then
  { grep -vE '^[[:space:]]*(#|$|label[[:space:]]|offset[[:space:]]|review-authors[[:space:]])' "$CONF" || true; } | while read -r dir _; do
    echo "  systemctl --user enable --now claude-rc@$(basename "$dir").service"
  done
fi
echo "  (one claude-rc@<folder>.service per repo under ~/Projects you want Remote Control for)"

# Per-repo Remote Control units from before the template; replace them with claude-rc@<folder>.
for old in "$UNITS"/claude-rc-*.service; do
  [ -e "$old" ] || continue
  name=$(basename "$old" .service)
  echo "  old unit $name: systemctl --user disable --now $name && rm $old, then enable claude-rc@${name#claude-rc-}.service"
done

if [ "$missing" = 0 ]; then echo "== Done"; else echo "== Done, but fix the MISSING lines above before turning it on"; fi
