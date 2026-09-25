#!/usr/bin/env bash
# ==============================================================================
# MedScript-OPD: Clinical Workstation Firewall Configuration Script (UFW / iptables)
# ==============================================================================
# Security Standard: ISO 27001 / HIPAA Technical Safeguards § 164.312(e)(1)
# Purpose: Hardens OPD workstation network perimeter, prevents unauthorized LAN/WAN
#          connections to the electronic medical records database, and enforces
#          defense-in-depth perimeter containment.
# ==============================================================================

set -euo pipefail

echo "🛡️  Configuring Clinical Workstation Firewall for MedScript-OPD..."

if [[ $EUID -ne 0 ]]; then
   echo "❌ Error: This script must be run as root (use: sudo ./firewall-rules.sh)"
   exit 1
fi

# Check if UFW is installed
if ! command -v ufw &> /dev/null; then
    echo "📦 UFW not found. Installing ufw..."
    apt-get update -qq && apt-get install -y -qq ufw
fi

echo "🔄 Resetting firewall to default state..."
ufw --force reset

# Set baseline policies: Deny all incoming, allow outgoing
echo "🔒 Enforcing default DENY on all unsolicited incoming traffic..."
ufw default deny incoming
ufw default allow outgoing

# Allow all traffic on loopback (lo) interface (Crucial for local SQLite & Next.js port 3000)
echo "✅ Whitelisting local loopback interface (127.0.0.1)..."
ufw allow in on lo to any

# Rate limit SSH (if remote system administration is used)
if ufw status verbose | grep -q "22"; then
    echo "🔐 Enforcing rate limiting on SSH (port 22)..."
    ufw limit 22/tcp comment 'Rate-limited SSH administration'
fi

# Multi-Room OPD Setup:
# If receptionists or other clinic rooms need to access MedScript-OPD via LAN,
# uncomment and adjust your clinic subnet below (e.g., 192.168.1.0/24):
#
# ufw allow from 192.168.1.0/24 to any port 3000 proto tcp comment 'MedScript OPD LAN access'
# ufw allow from 192.168.1.0/24 to any port 443 proto tcp comment 'MedScript OPD HTTPS LAN access'

# Enable UFW logging for clinical security auditing
echo "📝 Enabling firewall security event logging (/var/log/ufw.log)..."
ufw logging low

# Activate firewall
echo "🚀 Activating firewall..."
ufw --force enable

echo "=============================================================================="
echo "✅ Clinical Workstation Firewall successfully configured and active!"
echo "Status:"
ufw status verbose
echo "=============================================================================="
