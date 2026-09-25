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

echo "Step 1: Check if you have forked flathub/flathub on GitHub."
echo "If you haven't yet, open: https://github.com/flathub/flathub/fork"
echo "and click 'Create fork'."
echo ""
read -p "Have you created the fork of flathub/flathub? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Please visit https://github.com/flathub/flathub/fork to fork the repository first."
    exit 0
fi

echo ""
echo "Step 2: Cloning your fork of flathub into temporary staging..."
rm -rf "$STAGE_DIR"
git clone "git@github.com:$GH_USER/flathub.git" "$STAGE_DIR"
cd "$STAGE_DIR"

echo "Step 3: Checking out submission branch..."
git checkout -b "add-$APP_ID"

echo "Step 4: Copying prepared Flathub manifest and assets..."
cp "$DIR/packaging/flathub-pr-ready/"* .

git add .
git commit -m "Add $APP_ID"

echo "Step 5: Pushing branch to your GitHub fork..."
git push -u origin "add-$APP_ID"

echo ""
echo "================================================================="
echo "🎉 Flathub submission branch has been pushed to your fork!"
echo ""
echo "To open your Pull Request to Flathub, click this link:"
echo "👉 https://github.com/flathub/flathub/compare/new-pr...$GH_USER:flathub:add-$APP_ID?expand=1"
echo ""
echo "Title: Add $APP_ID"
echo "Base branch: new-pr"
echo "================================================================="

# Clean up
rm -rf "$STAGE_DIR"
