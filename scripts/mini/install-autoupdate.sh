#!/usr/bin/env bash
#
# Installs redeploy.sh as a launchd agent so the mini follows `main` on its own.
#
#   ./scripts/mini/install-autoupdate.sh              # install / reinstall
#   ./scripts/mini/install-autoupdate.sh --interval 600
#   ./scripts/mini/install-autoupdate.sh --uninstall
#   ./scripts/mini/install-autoupdate.sh --status
#
# A user agent, not a system daemon: the stack runs as this user under Docker
# Desktop, which only exists inside their session. LaunchDaemons start before
# login and would find no Docker at all.
#
# Pull, not push. CI cannot reach this machine — it is behind Tailscale with no
# public port — and the alternative, handing a GitHub Actions runner an SSH key
# into a home network, is a much larger door than this problem justifies. The
# mini asks; nothing is granted the right to tell it.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LABEL="com.pon.mini-redeploy"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/pon-mini-redeploy.log"
INTERVAL=300

while [ $# -gt 0 ]; do
  case "$1" in
    --interval) INTERVAL="${2:-300}"; shift 2 ;;
    --uninstall)
      launchctl unload "$PLIST" 2>/dev/null
      rm -f "$PLIST"
      printf '\033[32m✓\033[0m auto-update removed\n'; exit 0 ;;
    --status)
      if launchctl list | grep -q "$LABEL"; then
        printf '\033[32m✓\033[0m agent loaded\n'
        launchctl list "$LABEL" 2>/dev/null | grep -E 'LastExitStatus|PID' | sed 's/^/  /'
      else
        printf '\033[31m✗\033[0m agent not loaded\n'
      fi
      s="${PON_STATE_DIR:-$HOME/.local/state/pon-mini}"
      [ -f "$s/last-check" ]  && echo "  last check:  $(cat "$s/last-check")"
      [ -f "$s/last-deploy" ] && echo "  last deploy: $(cat "$s/last-deploy")"
      echo "  log:         $LOG"
      exit 0 ;;
    *) echo "unknown flag: $1"; exit 2 ;;
  esac
done

mkdir -p "$HOME/Library/LaunchAgents" "$(dirname "$LOG")"

# Docker Desktop's binaries are not on launchd's default PATH, which is why a
# job that works in a shell does nothing here.
cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$ROOT/scripts/mini/redeploy.sh</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
  <key>StartInterval</key><integer>$INTERVAL</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
  <key>WorkingDirectory</key><string>$ROOT</string>
</dict>
</plist>
PLIST_EOF

plutil -lint "$PLIST" >/dev/null || { echo "✗ generated plist is malformed"; exit 1; }
launchctl unload "$PLIST" 2>/dev/null
launchctl load "$PLIST" 2>/dev/null || { echo "✗ launchctl load failed"; exit 1; }

printf '\033[32m✓\033[0m mini follows main, checking every %ss\n' "$INTERVAL"
echo "  log:    $LOG"
echo "  status: ./scripts/mini/install-autoupdate.sh --status"
echo "  stop:   ./scripts/mini/install-autoupdate.sh --uninstall"
