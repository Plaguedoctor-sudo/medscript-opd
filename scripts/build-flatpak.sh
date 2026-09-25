#!/usr/bin/env bash
# MedScript OPD - Flatpak Build & Installation Helper
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo "================================================================="
echo "           MEDSCRIPT OPD - FLATPAK BUILD HELPER"
echo "================================================================="
echo ""

# Check for flatpak and flatpak-builder
if ! command -v flatpak &>/dev/null; then
  echo "❌ Error: 'flatpak' is not installed."
  echo "On Ubuntu/Debian: sudo apt install flatpak flatpak-builder"
  echo "On Fedora:        sudo dnf install flatpak flatpak-builder"
  echo "On Arch Linux:    sudo pacman -S flatpak flatpak-builder"
  exit 1
fi

if ! command -v flatpak-builder &>/dev/null; then
  echo "❌ Error: 'flatpak-builder' is not installed."
  echo "Please install flatpak-builder using your package manager."
  exit 1
fi

# Ensure Flathub repository is available
echo "Checking Flathub remote..."
flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo

# Ensure required runtime and SDK are installed
echo "Ensuring Freedesktop 24.08 runtime and Node.js SDK extension..."
flatpak install -y --user flathub org.freedesktop.Platform//24.08 org.freedesktop.Sdk//24.08 org.freedesktop.Sdk.Extension.node20//24.08

BUILD_DIR="$DIR/.flatpak-build"
REPO_DIR="$DIR/.flatpak-repo"

echo "Building Flatpak package..."
flatpak-builder --user --install --force-clean "$BUILD_DIR" packaging/flatpak/io.github.Plaguedoctor_sudo.MedScriptOPD.yml

echo ""
echo "================================================================="
echo "✅ Flatpak successfully built and installed for current user!"
echo "   Run the app using: flatpak run io.github.Plaguedoctor_sudo.MedScriptOPD"
echo "   Or launch 'MedScript OPD' from your Linux desktop application menu."
echo "================================================================="
