#!/usr/bin/env bash
# MedScript OPD - 1-Click GitHub Repository Publisher
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo "================================================================="
echo "        MEDSCRIPT OPD - 1-CLICK GITHUB PUBLISHER"
echo "================================================================="
echo ""
echo "This script will link your local project to your GitHub account"
echo "and publish the code, branches, and release tags."
echo ""

# Check Git
if ! command -v git &>/dev/null; then
    echo "[ERROR] Git is not installed."
    exit 1
fi

# Ask for GitHub username / repository URL
CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "")

if [ -n "$CURRENT_REMOTE" ]; then
    echo "Current GitHub remote: $CURRENT_REMOTE"
    read -p "Use this existing remote? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        CURRENT_REMOTE=""
    fi
fi

if [ -z "$CURRENT_REMOTE" ]; then
    echo "Please create a new repository on GitHub (https://github.com/new)"
    echo "  • Repository name: medscript-opd"
    echo "  • Visibility: Public"
    echo "  • Do NOT initialize with README, .gitignore, or license (we already have them)"
    echo ""
    read -p "Enter your GitHub Username: " GH_USER
    if [ -z "$GH_USER" ]; then
        echo "[ERROR] Username cannot be empty."
        exit 1
    fi

    REPO_URL="https://github.com/$GH_USER/medscript-opd.git"
    git remote remove origin 2>/dev/null || true
    git remote add origin "$REPO_URL"
    echo "Configured remote origin -> $REPO_URL"
fi

# Ask for Git Author details if default
CURRENT_NAME=$(git config user.name || echo "")
CURRENT_EMAIL=$(git config user.email || echo "")

if [ "$CURRENT_NAME" = "Your Name" ] || [ -z "$CURRENT_NAME" ]; then
    echo ""
    echo "Setting Git Author Name & Email for commits..."
    read -p "Enter your display name (e.g. Dr. Nitin): " AUTHOR_NAME
    read -p "Enter your GitHub email address: " AUTHOR_EMAIL
    if [ -n "$AUTHOR_NAME" ]; then
        git config user.name "$AUTHOR_NAME"
    fi
    if [ -n "$AUTHOR_EMAIL" ]; then
        git config user.email "$AUTHOR_EMAIL"
    fi
    # Amend the latest commit with correct author
    git commit --amend --reset-author --no-edit || true
fi

# Ensure default branch is main
git branch -M main

echo ""
echo "================================================================="
echo "Pushing code to GitHub (main branch)..."
echo "Note: When prompted for password, enter your GitHub Personal Access"
echo "Token (PAT) or authenticate via your browser."
echo "================================================================="
echo ""

git push -u origin main

echo ""
echo "Creating and pushing release tag v1.0.0..."
git tag -fa v1.0.0 -m "Release v1.0.0 - Offline Outpatient Prescription & EMR System" || true
git push origin v1.0.0 --force

echo ""
echo "================================================================="
echo "🎉 SUCCESS! Your project has been published to GitHub!"
echo ""
echo "GitHub Actions CI/CD will now automatically:"
echo " 1. Run automated build tests across Node 18 & 20"
echo " 2. Package multi-platform release archives"
echo " 3. Publish GitHub Release v1.0.0 with Windows & Linux downloads"
echo "================================================================="
