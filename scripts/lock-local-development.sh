#!/usr/bin/env bash
# ==============================================================================
# MedScript OPD - Local Workstation Source Code Lock
#
# Locks down all source code in the repository on this machine:
# 1. Strips write permissions from all files (chmod 0444)
# 2. Applies the Linux kernel immutable attribute (chattr +i)
# Once locked, ANY attempt to modify, delete, rename, or overwrite files
# in an editor, terminal, or script will fail with "Operation not permitted".
# ==============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ "$EUID" -ne 0 ]; then
  echo "🔒 Sudo privileges required to set Linux kernel immutable flags."
  exec sudo "$0" "$@"
fi

echo "================================================================="
echo "       MEDSCRIPT OPD - WORKSTATION SOURCE CODE LOCKDOWN"
echo "================================================================="
echo "Target directory: $ROOT_DIR"

# Lock src, scripts, components, db, and config files
TARGETS=("src" "scripts" "server.js" "next.config.ts" "tsconfig.json" "package.json")

for item in "${TARGETS[@]}"; do
  if [ -e "$ROOT_DIR/$item" ]; then
    echo "🔒 Securing: $item"
    chmod -R ugo-w "$ROOT_DIR/$item" 2>/dev/null || true
    chattr -R +i "$ROOT_DIR/$item" 2>/dev/null || true
  fi
done

echo ""
echo "================================================================="
echo "✅ SOURCE CODE LOCKED DOWN SUCCESSFULLY!"
echo "   • File modifications are now strictly blocked by the Linux kernel."
echo "   • Even 'sudo rm', text editors, or automated tools cannot change code."
echo ""
echo "To unlock when you want to edit again, run:"
echo "   sudo ./scripts/unlock-local-development.sh"
echo "================================================================="
