#!/usr/bin/env bash
set -e

# ==============================================================================
# MedScript OPD - Android APK Builder & Packaging Utility
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ANDROID_DIR="$ROOT_DIR/android"

echo "============================================================"
echo "  MedScript OPD - Android APK Packaging Utility"
echo "============================================================"
echo ""

# Check for Java
if ! command -v java >/dev/null 2>&1; then
    echo "⚠️  Java (JDK 17+) is not installed on this system."
    echo ""
    echo "To build the APK locally from terminal on Ubuntu/Debian:"
    echo "  sudo apt update && sudo apt install -y openjdk-17-jdk"
    echo ""
    echo "Alternatively, you have two instant zero-effort options:"
    echo "  1. Open the project in Android Studio on any workstation:"
    echo "     File -> Open -> Select '$ANDROID_DIR' -> Build APK"
    echo ""
    echo "  2. Instant PWA Install (No build required!):"
    echo "     Open Chrome on your Android phone, navigate to your server:"
    echo "     e.g., http://<SERVER-IP>:3000"
    echo "     Tap the 'Install App on Phone' button in MedScript OPD."
    echo "     Android will install a native WebAPK with full-screen support."
    echo ""
    exit 0
fi

cd "$ANDROID_DIR"

# Check for Gradle wrapper
if [ ! -f "./gradlew" ]; then
    echo "Initializing Gradle wrapper..."
    if command -v gradle >/dev/null 2>&1; then
        gradle wrapper
    else
        echo "Gradle not found. Please install gradle or open the 'android' folder in Android Studio."
        exit 1
    fi
fi

echo "Building Debug APK..."
chmod +x ./gradlew
./gradlew assembleDebug

APK_PATH="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"

if [ -f "$APK_PATH" ]; then
    echo ""
    echo "✅ APK successfully generated at:"
    echo "   $APK_PATH"
    echo ""
    echo "To install on a connected Android phone/tablet via ADB:"
    echo "   adb install -r \"$APK_PATH\""
    echo ""
    echo "Or transfer '$APK_PATH' to your phone via USB or WhatsApp and tap to install."
fi
