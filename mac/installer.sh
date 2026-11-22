#!/bin/sh
# Lance Iris CRM au démarrage du Mac (launchd), sur http://localhost:4810.
# Pour l'arrêter : launchctl bootout gui/$(id -u)/com.starshipcoder.iris-crm
set -e
ICI="$(cd "$(dirname "$0")" && pwd)"
NODE="$(command -v node)"
PLIST="$HOME/Library/LaunchAgents/com.starshipcoder.iris-crm.plist"
mkdir -p "$HOME/Library/Logs"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.starshipcoder.iris-crm</string>
  <key>ProgramArguments</key><array><string>$NODE</string><string>$ICI/serveur.mjs</string><string>--port</string><string>4810</string></array>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/iris-crm.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/iris-crm.log</string>
</dict></plist>
PL
# L'ancien nom (Suivi Easy Way, jusqu'au 22/11) : arrêté et retiré.
ANCIEN="$HOME/Library/LaunchAgents/com.starshipcoder.suivi-easyway.plist"
launchctl bootout "gui/$(id -u)/com.starshipcoder.suivi-easyway" 2>/dev/null || true
[ -f "$ANCIEN" ] && rm "$ANCIEN"
launchctl bootout "gui/$(id -u)/com.starshipcoder.iris-crm" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Iris CRM : http://localhost:4810 (lancé au démarrage du Mac)"
