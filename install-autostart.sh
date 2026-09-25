#!/usr/bin/env bash

# MedScript OPD - Autostart Service Installer
# Installs a systemd user service so MedScript OPD runs automatically in the background
# whenever the computer starts or logs in, with auto-restart on crashes.
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USER_NAME="$(whoami)"
NPM_BIN="$(which npm || echo "/usr/bin/npm")"
SERVICE_DIR="$HOME/.config/systemd/user"
SERVICE_FILE="$SERVICE_DIR/medscript.service"

echo "================================================================="
echo "        MEDSCRIPT OPD - AUTOSTART SERVICE INSTALLER"
echo "================================================================="
echo "• Project Directory: $DIR"
echo "• User:              $USER_NAME"
echo "• Service File:      $SERVICE_FILE"
echo ""

# Ensure production build exists
if [ ! -d "$DIR/.next" ]; then
    echo "📦 Building production bundle (one-time setup)..."
    cd "$DIR"
    npm run build
fi

# Ensure systemd user directory exists
mkdir -p "$SERVICE_DIR"

# Write service definition with dynamic paths
cat <<EOF > "$SERVICE_FILE"
[Unit]
Description=MedScript OPD Clinical System
After=network.target

[Service]
Type=simple
WorkingDirectory=$DIR
ExecStart=$NPM_BIN run start -- -H 0.0.0.0 -p 3000
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000

StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
EOF

echo "✓ Created $SERVICE_FILE"

# Reload systemd user daemon and enable service
systemctl --user daemon-reload
systemctl --user enable medscript.service
systemctl --user restart medscript.service

echo "✓ systemd user service enabled and started"

# Optional: Enable linger so it starts on boot even before graphical login
if command -v loginctl &> /dev/null; then
    loginctl enable-linger "$USER_NAME" 2>/dev/null || true
fi

# Check status
echo ""
echo "Verifying server response..."
sleep 2

LOCAL_IP="localhost"
if command -v hostname &> /dev/null; then
    LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
fi

if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200\|307\|308\|302"; then
    echo "✅ SUCCESS! MedScript OPD is running in the background."
else
    echo "ℹ️ Server is initializing... check status in a few seconds."
fi

echo ""
echo "================================================================="
echo " MedScript OPD is now permanently running as a background service!"
echo ""
echo " • On this PC:             http://localhost:3000"
echo " • Other Clinic Devices:   http://${LOCAL_IP}:3000"
echo ""
echo " Useful commands to manage the background service:"
echo "   systemctl --user status medscript   # Check service status"
echo "   systemctl --user restart medscript  # Restart server"
echo "   systemctl --user stop medscript     # Stop server"
echo "   journalctl --user -u medscript -f   # View live server logs"
echo "================================================================="
