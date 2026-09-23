#!/usr/bin/env bash

# MedScript OPD - Clinic Local Area Network (LAN) Launcher
# Allows Tablets & Receptionist PCs to connect over clinic Wi-Fi/Ethernet
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "================================================================="
echo "        MEDSCRIPT OPD - CLINIC MULTI-DEVICE LAN LAUNCHER"
echo "================================================================="
echo ""

# Find Local IP Address
LOCAL_IP="localhost"
if command -v hostname &> /dev/null; then
    LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
fi

if [ ! -d "node_modules" ]; then
    npm install
fi

if [ ! -d ".next" ]; then
    npm run build
fi

echo ""
echo "================================================================="
echo " MedScript OPD is running in Clinic Multi-Device Mode!"
echo ""
echo " • On this computer:        http://localhost:3000"
echo " • From Receptionist PC:    http://${LOCAL_IP}:3000"
echo " • From Tablet / iPad:      http://${LOCAL_IP}:3000"
echo ""
echo " Press Ctrl+C in this terminal to stop the server."
echo "================================================================="
echo ""

# Start listening on all network interfaces
npm run start -- -H 0.0.0.0 -p 3000
