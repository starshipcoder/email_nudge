#!/bin/sh
# Lance la page de suivi au démarrage du Mac (launchd), sur http://localhost:4810.
# Pour l'arrêter : launchctl bootout gui/$(id -u)/com.starshipcoder.suivi-easyway
set -e
ICI="$(cd "$(dirname "$0")" && pwd)"
NODE="$(command -v node)"
PLIST="$HOME/Library/LaunchAgents/com.starshipcoder.suivi-easyway.plist"
mkdir -p "$HOME/Library/Logs"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.starshipcoder.suivi-easyway</string>
  <key>ProgramArguments</key><array><string>$NODE</string><string>$ICI/serveur.mjs</string><string>--port</string><string>4810</string></array>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/suivi-easyway.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/suivi-easyway.log</string>
</dict></plist>
PL
launchctl bootout "gui/$(id -u)/com.starshipcoder.suivi-easyway" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Suivi Easy Way : http://localhost:4810 (lancé au démarrage du Mac)"
