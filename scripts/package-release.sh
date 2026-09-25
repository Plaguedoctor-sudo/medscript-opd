#!/usr/bin/env bash
# MedScript OPD - Release Packaging Script
# Creates distributable Linux and Windows archives for GitHub Releases
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

VERSION=$(node -p "require('./package.json').version || '1.0.0'")
DIST_DIR="$DIR/dist"
STAGE_DIR="$DIR/.release-stage"

echo "================================================================="
echo "        MEDSCRIPT OPD - MULTI-PLATFORM RELEASE PACKAGER"
echo "================================================================="
echo "Version: $VERSION"
echo "Destination: $DIST_DIR"
echo ""

# 1. Clean previous build & staging
rm -rf "$DIST_DIR" "$STAGE_DIR"
mkdir -p "$DIST_DIR" "$STAGE_DIR/medscript-opd"

# 2. Build production assets
echo "Building Next.js production bundle..."
npm run build

# 3. Copy application files to staging (clean of local DB, caches, or dev logs)
echo "Staging release payload..."
cp -r \
  package.json \
  package-lock.json \
  next.config.ts \
  tsconfig.json \
  src \
  public \
  scripts \
  start-windows.bat \
  start-linux.sh \
  start-lan.sh \
  start-lan.bat \
  install-autostart.sh \
  uninstall-autostart.sh \
  install-windows-service.bat \
  uninstall-windows-service.bat \
  backup-task.bat \
  README.md \
  LICENSE \
  SECURITY.md \
  CONTRIBUTING.md \
  "$STAGE_DIR/medscript-opd/"

# Copy production build but clean turbopack cache to reduce bundle size
mkdir -p "$STAGE_DIR/medscript-opd/.next"
cp -r .next/* "$STAGE_DIR/medscript-opd/.next/"
rm -rf "$STAGE_DIR/medscript-opd/.next/cache"

# Include Flatpak manifest in packaging folder
mkdir -p "$STAGE_DIR/medscript-opd/packaging"
cp -r packaging/* "$STAGE_DIR/medscript-opd/packaging/"

# 4. Create Linux Release Bundle (.tar.gz)
echo "Creating Linux release bundle (tar.gz)..."
tar -czf "$DIST_DIR/medscript-opd-v${VERSION}-linux.tar.gz" -C "$STAGE_DIR" medscript-opd

# 5. Create Windows Release Bundle (.zip)
if command -v zip &>/dev/null; then
  echo "Creating Windows portable release bundle (zip)..."
  (cd "$STAGE_DIR" && zip -r -q "$DIST_DIR/medscript-opd-v${VERSION}-windows-portable.zip" medscript-opd)
fi

# Clean up staging
rm -rf "$STAGE_DIR"

echo ""
echo "================================================================="
echo "✅ Release packaging completed successfully!"
ls -lh "$DIST_DIR"
echo "================================================================="
