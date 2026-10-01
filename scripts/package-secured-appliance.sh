#!/usr/bin/env bash
# ==============================================================================
# MedScript OPD - Sovereign Secured Appliance Packager
#
# Generates a closed-source, production-hardened distribution artifact.
# Completely EXCLUDES raw TypeScript files, React components, and git history.
# Only contains minified machine code, tree-shaken node modules, and static assets.
# ==============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

VERSION=$(node -p "require('./package.json').version || '1.1.1'")
DIST_DIR="$ROOT_DIR/dist"
STAGE_DIR="$ROOT_DIR/.secured-stage"
APPLIANCE_DIR="$STAGE_DIR/medscript-opd-appliance"

echo "================================================================="
echo "   MEDSCRIPT OPD - SECURED CLOSED-SOURCE APPLIANCE PACKAGER"
echo "================================================================="
echo "Version:     v$VERSION"
echo "Root:        $ROOT_DIR"
echo "Destination: $DIST_DIR"
echo ""

# 1. Clean previous build & staging directories
echo "🧹 [1/5] Cleaning previous distribution staging..."
rm -rf "$STAGE_DIR"
mkdir -p "$DIST_DIR" "$APPLIANCE_DIR"

# 2. Build standalone Next.js production bundle
echo "🔨 [2/5] Compiling Next.js in hardened standalone mode (minification & tree-shaking)..."
export NODE_ENV=production
npm run build

# 3. Assemble closed-source runtime payload
echo "📦 [3/5] Assembling closed-source appliance runtime..."
if [ ! -d ".next/standalone" ]; then
  echo "❌ Error: .next/standalone directory was not generated. Check next.config.ts output option."
  exit 1
fi

# Copy standalone server (minified machine code & bundled dependencies)
cp -r .next/standalone/* "$APPLIANCE_DIR/"

# Create internal .next directory and copy static chunks
mkdir -p "$APPLIANCE_DIR/.next"
cp -r .next/static "$APPLIANCE_DIR/.next/"

# Copy public static assets (icons, manifests, etc.)
if [ -d "public" ]; then
  cp -r public "$APPLIANCE_DIR/"
fi

# Copy SSL certificates if present
if [ -d "certificates" ]; then
  mkdir -p "$APPLIANCE_DIR/certificates"
  cp -r certificates/* "$APPLIANCE_DIR/certificates/" 2>/dev/null || true
fi

# Remove any stray source or development files from payload
find "$APPLIANCE_DIR" -type f -name "*.ts" -delete
find "$APPLIANCE_DIR" -type f -name "*.tsx" -delete
find "$APPLIANCE_DIR" -type f -name "*.map" -delete
find "$APPLIANCE_DIR" -type d -name ".git" -exec rm -rf {} + 2>/dev/null || true

# 4. Generate Appliance Installation & Hardening Script
echo "🔒 [4/5] Embedding Linux kernel lockdown & service installer..."
cat << 'INSTALLER_EOF' > "$APPLIANCE_DIR/install-secure-appliance.sh"
#!/usr/bin/env bash
# ==============================================================================
# MedScript OPD - Automated Secure Appliance Installer
#
# Enforces:
# 1. Dedicated unprivileged system service user with /usr/sbin/nologin
# 2. Linux kernel immutable bit (chattr +i) preventing all modifications
# 3. Read-only filesystem permissions (chmod 0555, chown root:root)
# 4. Sandboxed Systemd Service (ProtectSystem=strict, ProtectHome=true)
# ==============================================================================
set -euo pipefail

if [ "$EUID" -ne 0 ]; then
  echo "❌ Error: This installation script must be executed with sudo / root privileges."
  echo "Usage: sudo ./install-secure-appliance.sh"
  exit 1
fi

APP_DIR="/opt/medscript-opd"
DATA_DIR="/var/lib/medscript"
LOG_DIR="/var/log/medscript"
SERVICE_USER="medscript-svc"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "================================================================="
echo "       MEDSCRIPT OPD - CLINICAL APPLIANCE SECURE INSTALLER"
echo "================================================================="

# 1. Create dedicated non-login system user
if ! id -u "$SERVICE_USER" &>/dev/null; then
  echo "👤 Creating unprivileged system user: $SERVICE_USER (/usr/sbin/nologin)..."
  useradd -r -s /usr/sbin/nologin -d "$DATA_DIR" -M -c "MedScript OPD Sovereign Service" "$SERVICE_USER"
else
  echo "✓ Service user $SERVICE_USER already exists."
fi

# 2. Stop existing service if running
if systemctl is-active --quiet medscript.service; then
  echo "⏹️ Stopping running medscript.service..."
  systemctl stop medscript.service || true
fi

# 3. Unlock existing directory if immutable
if [ -d "$APP_DIR" ]; then
  echo "🔓 Removing immutable flags from existing installation..."
  chattr -R -i "$APP_DIR" 2>/dev/null || true
  rm -rf "$APP_DIR"
fi

# 4. Deploy closed-source application payload
echo "📂 Deploying sealed binaries to $APP_DIR..."
mkdir -p "$APP_DIR" "$DATA_DIR" "$LOG_DIR"
cp -r "$SCRIPT_DIR"/* "$APP_DIR/"
rm -f "$APP_DIR/install-secure-appliance.sh"

# 5. Initialize Database Storage
if [ ! -f "$DATA_DIR/sqlite.db" ]; then
  if [ -f "$APP_DIR/sqlite.db" ]; then
    mv "$APP_DIR/sqlite.db"* "$DATA_DIR/"
  fi
fi
chown -R "$SERVICE_USER:$SERVICE_USER" "$DATA_DIR" "$LOG_DIR"
chmod 0700 "$DATA_DIR"
chmod 0750 "$LOG_DIR"

# 6. Apply Linux Filesystem Lockdown (Read-Only & Root-Owned)
echo "🔒 Applying POSIX read-only permissions (root:root, 0555)..."
chown -R root:root "$APP_DIR"
find "$APP_DIR" -type d -exec chmod 0555 {} +
find "$APP_DIR" -type f -exec chmod 0444 {} +
chmod 0555 "$APP_DIR/server.js" 2>/dev/null || true

# 7. Apply Linux Kernel Immutable Flag (chattr +i)
echo "🛡️ Locking files with Linux Kernel Immutable Flag (chattr +i)..."
if command -v chattr &>/dev/null; then
  chattr -R +i "$APP_DIR"
  echo "✓ Immutable flag active. Files CANNOT be modified or deleted even by root without chattr -i."
fi

# 8. Configure Hardened Systemd Service
echo "⚙️ Configuring hardened systemd service unit..."
cat << SYSTEMD_EOF > /etc/systemd/system/medscript.service
[Unit]
Description=MedScript OPD Sovereign Clinical System
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5

# Environment Configuration
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=0.0.0.0
Environment=DATABASE_PATH=$DATA_DIR/sqlite.db

# System Hardening & Sandboxing
ProtectSystem=strict
ProtectHome=true
NoNewPrivileges=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictRealtime=true
RestrictNamespaces=true
ReadWritePaths=$DATA_DIR $LOG_DIR
ReadOnlyPaths=$APP_DIR

# Logging
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SYSTEMD_EOF

# 9. Reload, Enable, and Start Service
systemctl daemon-reload
systemctl enable medscript.service
systemctl restart medscript.service

echo ""
echo "================================================================="
echo "✅ MedScript OPD Secure Appliance successfully installed and locked!"
echo "   • Service Status:  systemctl status medscript.service"
echo "   • Live UI URL:     http://localhost:3000"
echo "   • App Directory:   $APP_DIR (Locked with chattr +i)"
echo "   • Data Directory:  $DATA_DIR (Restricted POSIX 0700)"
echo "   • Source Code:     0% (Zero TypeScript files or git history)"
echo "================================================================="
INSTALLER_EOF

chmod +x "$APPLIANCE_DIR/install-secure-appliance.sh"

# Add uninstaller / unlock script for authorized administrator maintenance
cat << 'UNINSTALL_EOF' > "$APPLIANCE_DIR/uninstall-secure-appliance.sh"
#!/usr/bin/env bash
set -euo pipefail
if [ "$EUID" -ne 0 ]; then
  echo "❌ Error: Root privileges required. Run with: sudo ./uninstall-secure-appliance.sh"
  exit 1
fi
echo "Stopping MedScript service..."
systemctl stop medscript.service || true
systemctl disable medscript.service || true
rm -f /etc/systemd/system/medscript.service
systemctl daemon-reload

echo "Unlocking application directory..."
chattr -R -i /opt/medscript-opd 2>/dev/null || true
rm -rf /opt/medscript-opd
echo "✓ MedScript application uninstalled. (Data in /var/lib/medscript preserved for safety)."
UNINSTALL_EOF

chmod +x "$APPLIANCE_DIR/uninstall-secure-appliance.sh"

# 5. Create Distribution Archive (.tar.gz)
echo "🗜️ [5/5] Compressing secured appliance release archive..."
TARBALL="$DIST_DIR/medscript-opd-v${VERSION}-secured-appliance.tar.gz"
tar -czf "$TARBALL" -C "$STAGE_DIR" medscript-opd-appliance

# Generate cryptographic SHA256 checksum
sha256sum "$TARBALL" > "${TARBALL}.sha256"

# Cleanup staging directory
rm -rf "$STAGE_DIR"

echo ""
echo "================================================================="
echo "🎉 SECURED APPLIANCE BUNDLE GENERATED SUCCESSFULLY!"
echo "================================================================="
echo "Archive:  $TARBALL"
echo "Checksum: $(cat "${TARBALL}.sha256")"
echo ""
echo "To deploy on any clinic machine:"
echo "  1. Copy the tarball to the destination machine"
echo "  2. tar -xzf medscript-opd-v${VERSION}-secured-appliance.tar.gz"
echo "  3. cd medscript-opd-appliance"
echo "  4. sudo ./install-secure-appliance.sh"
echo "================================================================="
