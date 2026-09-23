#!/usr/bin/env bash

# MedScript OPD - Linux & macOS 1-Click Clinic Launcher
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "================================================================="
echo "                MEDSCRIPT OPD - CLINIC EMR LAUNCHER"
echo "================================================================="
echo ""

# 1. Check Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed."
    echo "Please install Node.js 18+ or 20+ from https://nodejs.org"
    exit 1
fi

# 2. Check dependencies
if [ ! -d "node_modules" ]; then
    echo "[INFO] Installing dependencies (first-time run)..."
    npm install
fi

# 3. Check database
if [ ! -f "sqlite.db" ]; then
    echo "[INFO] Initializing new clinic database..."
    npm run db:seed
fi

# 4. Check production build
if [ ! -d ".next" ]; then
    echo "[INFO] Building application for high-speed production..."
    npm run build
fi

# 5. Open browser in background
(
    sleep 2
    if command -v xdg-open &> /dev/null; then
        xdg-open "http://localhost:3000" &> /dev/null || true
    elif command -v open &> /dev/null; then
        open "http://localhost:3000" &> /dev/null || true
    fi
) &

echo ""
echo "================================================================="
echo " MedScript OPD is LIVE!"
echo " Consultation Desk: http://localhost:3000"
echo " Press Ctrl+C in this terminal to stop the server."
echo "================================================================="
echo ""

npm run start
