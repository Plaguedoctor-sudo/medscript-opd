#!/usr/bin/env bash
# MedScript OPD - Flathub Submission Automation Script
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo "================================================================="
echo "        MEDSCRIPT OPD - FLATHUB PULL REQUEST PREPARER"
echo "================================================================="
echo ""

APP_ID="io.github.Plaguedoctor_sudo.MedScriptOPD"
STAGE_DIR="/tmp/flathub-submission-$$"
GH_USER="Plaguedoctor-sudo"

echo "Step 1: Cloning your fork of flathub into temporary staging..."
rm -rf "$STAGE_DIR"
git clone "git@github.com:$GH_USER/flathub.git" "$STAGE_DIR"
cd "$STAGE_DIR"

echo "Step 2: Fetching upstream new-pr branch..."
git remote add upstream https://github.com/flathub/flathub.git
git fetch upstream new-pr

echo "Step 3: Checking out submission branch based on upstream new-pr..."
git checkout -B "add-$APP_ID" upstream/new-pr

echo "Step 4: Copying prepared Flathub manifest and assets..."
cp "$DIR/packaging/flathub-pr-ready/"* .

git add .
git commit -m "Add $APP_ID"

echo "Step 5: Pushing branch to your GitHub fork..."
git push -u origin "add-$APP_ID" --force

echo ""
echo "================================================================="
echo "🎉 Flathub submission branch has been pushed to your fork!"
echo ""
echo "To open your Pull Request to Flathub, click this link:"
echo "👉 https://github.com/flathub/flathub/compare/new-pr...$GH_USER:add-$APP_ID?expand=1"
echo "Or visit your fork: https://github.com/$GH_USER/flathub/tree/add-$APP_ID"
echo ""
echo "Title: Add $APP_ID"
echo "Base branch: new-pr"
echo "================================================================="

# Clean up
rm -rf "$STAGE_DIR"
