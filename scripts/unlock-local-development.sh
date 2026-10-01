#!/usr/bin/env bash
# ==============================================================================
# MedScript OPD - Local Workstation Source Code Unlock
#
# Unlocks source code on this machine by removing the immutable attribute
# and restoring write permissions to the repository owner.
# ==============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ "$EUID" -ne 0 ]; then
  echo "🔑 Sudo privileges required to unlock files."
  exec sudo "$0" "$@"
fi

ORIGINAL_USER="${SUDO_USER:-$USER}"

echo "================================================================="
echo "       MEDSCRIPT OPD - WORKSTATION SOURCE CODE UNLOCK"
echo "================================================================="
echo "Target directory: $ROOT_DIR"
echo "Owner:            $ORIGINAL_USER"

TARGETS=("src" "scripts" "server.js" "next.config.ts" "tsconfig.json" "package.json")

for item in "${TARGETS[@]}"; do
  if [ -e "$ROOT_DIR/$item" ]; then
    echo "🔓 Unlocking: $item"
    chattr -R -i "$ROOT_DIR/$item" 2>/dev/null || true
    chmod -R u+rw "$ROOT_DIR/$item" 2>/dev/null || true
    chown -R "$ORIGINAL_USER:$ORIGINAL_USER" "$ROOT_DIR/$item" 2>/dev/null || true
  fi
done

echo ""
echo "================================================================="
echo "✅ SOURCE CODE UNLOCKED!"
echo "   • Write access has been restored to user '$ORIGINAL_USER'."
echo "   • You may now resume editing files normally."
echo "================================================================="
