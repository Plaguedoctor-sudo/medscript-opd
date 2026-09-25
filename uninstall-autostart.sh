#!/usr/bin/env bash

# MedScript OPD - Autostart Service Uninstaller
set -e

SERVICE_FILE="$HOME/.config/systemd/user/medscript.service"

echo "================================================================="
echo "       MEDSCRIPT OPD - AUTOSTART SERVICE UNINSTALLER"
echo "================================================================="

if systemctl --user is-active --quiet medscript.service 2>/dev/null; then
    echo "Stopping medscript.service..."
    systemctl --user stop medscript.service
fi

if systemctl --user is-enabled --quiet medscript.service 2>/dev/null; then
    echo "Disabling medscript.service..."
    systemctl --user disable medscript.service
fi

if [ -f "$SERVICE_FILE" ]; then
    rm -f "$SERVICE_FILE"
    echo "Removed $SERVICE_FILE"
fi

systemctl --user daemon-reload
echo "✓ MedScript background service successfully uninstalled."
echo "================================================================="
