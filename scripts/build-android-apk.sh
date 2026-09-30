#!/usr/bin/env bash
set -e

# ==============================================================================
# MedScript OPD - Android APK Builder & Packaging Utility
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ANDROID_DIR="$ROOT_DIR/android"
TOOLCHAIN_DIR="$HOME/.medscript-android-toolchain"
BOOTSTRAP_JDK_DIR="$TOOLCHAIN_DIR/jdk"
BOOTSTRAP_SDK_DIR="$TOOLCHAIN_DIR/sdk"

echo "============================================================"
echo "  MedScript OPD - Android Standalone APK Builder"
echo "============================================================"
echo ""

# Handle --bootstrap flag
if [[ "$1" == "--bootstrap" || "$1" == "--install-tools" ]]; then
    echo "⚡ Bootstrapping user-space Android toolchain (No sudo required)..."
    mkdir -p "$TOOLCHAIN_DIR"

    # 1. Download OpenJDK 17 if not present
    if [ ! -d "$BOOTSTRAP_JDK_DIR/bin" ]; then
        echo "📥 Downloading portable OpenJDK 17 (Temurin)..."
        mkdir -p "$BOOTSTRAP_JDK_DIR"
        curl -sL "https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse" -o "$TOOLCHAIN_DIR/jdk17.tar.gz"
        tar -xzf "$TOOLCHAIN_DIR/jdk17.tar.gz" -C "$BOOTSTRAP_JDK_DIR" --strip-components=1
        rm -f "$TOOLCHAIN_DIR/jdk17.tar.gz"
        echo "✅ OpenJDK 17 installed to $BOOTSTRAP_JDK_DIR"
    fi

    # 2. Download Android Command Line Tools if not present
    if [ ! -d "$BOOTSTRAP_SDK_DIR/cmdline-tools/latest" ]; then
        echo "📥 Downloading Android Command-Line Tools..."
        mkdir -p "$BOOTSTRAP_SDK_DIR/cmdline-tools"
        curl -sL "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip" -o "$TOOLCHAIN_DIR/cmdline-tools.zip"
        unzip -q -o "$TOOLCHAIN_DIR/cmdline-tools.zip" -d "$TOOLCHAIN_DIR"
        rm -rf "$BOOTSTRAP_SDK_DIR/cmdline-tools/latest"
        mv "$TOOLCHAIN_DIR/cmdline-tools" "$BOOTSTRAP_SDK_DIR/cmdline-tools/latest"
        rm -f "$TOOLCHAIN_DIR/cmdline-tools.zip"
        echo "✅ Android Command-Line Tools installed"
    fi

    export JAVA_HOME="$BOOTSTRAP_JDK_DIR"
    export ANDROID_HOME="$BOOTSTRAP_SDK_DIR"
    export PATH="$BOOTSTRAP_JDK_DIR/bin:$BOOTSTRAP_SDK_DIR/cmdline-tools/latest/bin:$BOOTSTRAP_SDK_DIR/platform-tools:$PATH"

    echo "📋 Accepting Android SDK licenses and installing build components (Android 34)..."
    yes | "$BOOTSTRAP_SDK_DIR/cmdline-tools/latest/bin/sdkmanager" --licenses >/dev/null 2>&1 || true
    "$BOOTSTRAP_SDK_DIR/cmdline-tools/latest/bin/sdkmanager" "platforms;android-34" "build-tools;34.0.0" "platform-tools"
    echo "✅ Android SDK dependencies ready!"
fi

# Detect Java: check system or toolchain
if [ -d "$BOOTSTRAP_JDK_DIR/bin" ]; then
    export JAVA_HOME="$BOOTSTRAP_JDK_DIR"
    export PATH="$BOOTSTRAP_JDK_DIR/bin:$PATH"
fi

if [ -d "$BOOTSTRAP_SDK_DIR" ]; then
    export ANDROID_HOME="$BOOTSTRAP_SDK_DIR"
    export PATH="$BOOTSTRAP_SDK_DIR/cmdline-tools/latest/bin:$BOOTSTRAP_SDK_DIR/platform-tools:$PATH"
fi

if ! command -v java >/dev/null 2>&1; then
    echo "⚠️  Java (JDK 17+) was not found."
    echo ""
    echo "Choose one of the following methods to build your APK:"
    echo ""
    echo "  Method 1 (Automatic 1-command build - No sudo needed):"
    echo "     $0 --bootstrap"
    echo "     (Downloads user-space JDK 17 & Android SDK, then builds the APK)"
    echo ""
    echo "  Method 2 (Using System Package Manager):"
    echo "     sudo apt update && sudo apt install -y openjdk-17-jdk"
    echo "     $0"
    echo ""
    echo "  Method 3 (Open in Android Studio on any PC/Laptop):"
    echo "     Open Android Studio -> Open project -> Select '$ANDROID_DIR' -> Build APK"
    echo ""
    exit 1
fi

echo "Using Java: $(java -version 2>&1 | head -n 1)"

if [ -z "$ANDROID_HOME" ] && [ -d "$HOME/Android/Sdk" ]; then
    export ANDROID_HOME="$HOME/Android/Sdk"
fi

if [ -n "$ANDROID_HOME" ]; then
    echo "Using Android SDK: $ANDROID_HOME"
fi

cd "$ANDROID_DIR"

# Ensure gradlew has execute permission
chmod +x ./gradlew

echo ""
echo "🔨 Compiling Android APK via Gradle..."
./gradlew assembleDebug

APK_PATH="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"

if [ -f "$APK_PATH" ]; then
    echo ""
    echo "============================================================"
    echo "  🎉 SUCCESS: Standalone Android APK Built Successfully!"
    echo "============================================================"
    echo "  File Location: $APK_PATH"
    echo "  File Size:     $(du -h "$APK_PATH" | cut -f1)"
    echo ""
    echo "  How to install on Android phone / tablet:"
    echo "  1. Connect your phone via USB or copy via WhatsApp/Drive."
    echo "  2. Tap the APK file on your Android phone and click 'Install'."
    echo "  3. Open 'MedScript OPD' - enter your clinic host URL if prompted."
    echo "     (e.g., http://192.168.1.100:3000 or http://nitin-thinkcentre-m920q.local:3000)"
    echo "============================================================"
fi
