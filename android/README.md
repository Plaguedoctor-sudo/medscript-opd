# MedScript OPD - Android Mobile Deployment Guide

This directory contains the standalone Android wrapper application for **MedScript OPD**.

---

## 🚀 Option 1: Instant Chrome WebAPK (Recommended - 0 Toolchain Needed)

MedScript OPD is a Progressive Web Application (PWA). Android Chrome generates and installs a true standalone WebAPK directly on any Android device without needing Android Studio or APK compilation on your server:

1. Connect your Android phone or tablet to the **same Wi-Fi network** as the MedScript OPD server.
2. Open **Google Chrome** on the Android device.
3. In the address bar, type the server address:
   ```text
   http://<SERVER_IP>:3000
   ```
   *(e.g., `http://192.168.1.100:3000` or `https://nitin-thinkcentre-m920q.local:3000`)*
4. You will see an **"Install App on Phone"** button in the MedScript OPD bottom drawer menu, or in Chrome's menu (three dots `⋮`) -> **"Install app"** / **"Add to Home screen"**.
5. Tap **Install**.
6. The app installs as a native Android app on your home screen with:
   - Fullscreen kiosk-like UI (no browser address bar).
   - Bottom navigation bar with safe-area spacing for Android gestures.
   - Smooth touch handling and offline caching.

---

## 📦 Option 2: Native Android APK (Custom Wrapper Project)

The files in this `android/` directory form a complete native Android Studio Gradle project.

### Features
- Native WebView with hardware acceleration.
- Pull-to-refresh (`SwipeRefreshLayout`).
- Hardware Back button handling.
- Camera & file chooser integration for uploading prescriptions, lab results, and patient documents.
- Built-in Server URL configuration dialog to switch host IPs effortlessly.

### Building the APK
1. **Using Android Studio:**
   - Open Android Studio on any workstation.
   - Choose **File > Open** and select the `/android` directory.
   - Click **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
   - The compiled `.apk` will be in `android/app/build/outputs/apk/debug/app-debug.apk`.

2. **Using the CLI (Terminal):**
   - Ensure OpenJDK 17 and Android SDK are installed:
     ```bash
     sudo apt update && sudo apt install -y openjdk-17-jdk
     ```
   - Run the builder script:
     ```bash
     ./scripts/build-android-apk.sh
     ```

3. **Installing on Phone:**
   - Copy `app-debug.apk` to your phone via USB or WhatsApp, open it, and tap **Install**.
   - Or install via ADB:
     ```bash
     adb install -r android/app/build/outputs/apk/debug/app-debug.apk
     ```
