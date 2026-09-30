#!/usr/bin/env bash
# MedScript OPD - Local Clinic Certificate Authority & Server Certificate Generator
# Creates a 2-Tier PKI:
# 1. MedScript Clinic Root CA (valid for 10 years)
# 2. Server Certificate signed by Root CA with full SAN support (localhost, medscript.local, hostname.local, LAN IPs)
# 3. Copies Root CA to public/ so any clinic device can download and trust it in 1 click.

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERT_DIR="$DIR/certificates"
PUBLIC_DIR="$DIR/public"
mkdir -p "$CERT_DIR" "$PUBLIC_DIR"

CA_KEY="$CERT_DIR/medscript-ca.key"
CA_CERT="$CERT_DIR/MedScript-Clinic-Root-CA.crt"
SERVER_KEY="$CERT_DIR/localhost-key.pem"
SERVER_CSR="$CERT_DIR/server.csr"
SERVER_CERT="$CERT_DIR/localhost.pem"
EXT_FILE="$CERT_DIR/server.ext"

HOST_NAME="$(hostname 2>/dev/null || echo "medscript")"

# 1. Build Subject Alternative Name (SAN) list
SAN_LIST="DNS:localhost,DNS:medscript.local,DNS:${HOST_NAME}.local,IP:127.0.0.1,IP:::1"

if command -v hostname &>/dev/null; then
    for ip in $(hostname -I 2>/dev/null); do
        if [[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            SAN_LIST="${SAN_LIST},IP:${ip}"
        fi
    done
fi

echo "================================================================="
echo "   MEDSCRIPT OPD - 2-TIER CLINIC PKI & SSL GENERATOR"
echo "================================================================="
echo "• Target Directory: $CERT_DIR"
echo "• SAN Domains:      $SAN_LIST"
echo ""

# 2. Generate or reuse Root CA
if [ ! -f "$CA_KEY" ] || [ ! -f "$CA_CERT" ]; then
    echo "🔑 [1/3] Generating MedScript Clinic Root Certificate Authority (CA)..."
    openssl req -x509 -new -nodes -newkey rsa:4096 -sha256 -days 3650 \
      -subj "/CN=MedScript Clinic Root CA/O=MedScript Healthcare/OU=Clinical Security" \
      -keyout "$CA_KEY" \
      -out "$CA_CERT" 2>/dev/null
    chmod 600 "$CA_KEY"
    chmod 644 "$CA_CERT"
    echo "✓ MedScript Root CA created (valid for 10 years)"
else
    echo "ℹ️ [1/3] Using existing MedScript Clinic Root CA."
fi

# 3. Generate Server Private Key & CSR
echo "📄 [2/3] Generating Server Certificate Signing Request (CSR)..."
openssl req -new -nodes -newkey rsa:2048 -sha256 \
  -subj "/CN=localhost/O=MedScript Healthcare/OU=Clinical Systems" \
  -keyout "$SERVER_KEY" \
  -out "$SERVER_CSR" 2>/dev/null
chmod 600 "$SERVER_KEY"

# 4. Create SAN extension configuration file
cat <<EOF > "$EXT_FILE"
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = $SAN_LIST
extendedKeyUsage = serverAuth, clientAuth
EOF

# 5. Sign Server Certificate with MedScript Root CA
echo "🔐 [3/3] Signing Server Certificate with MedScript Root CA..."
openssl x509 -req -in "$SERVER_CSR" -CA "$CA_CERT" -CAkey "$CA_KEY" -CAcreateserial \
  -out "$SERVER_CERT" -days 825 -sha256 -extfile "$EXT_FILE" 2>/dev/null
chmod 644 "$SERVER_CERT"
rm -f "$SERVER_CSR" "$EXT_FILE" "$CERT_DIR"/*.srl

# 6. Copy Public Root CA to public/ directory for easy device onboarding
cp -f "$CA_CERT" "$PUBLIC_DIR/MedScript-Clinic-Root-CA.crt"
chmod 644 "$PUBLIC_DIR/MedScript-Clinic-Root-CA.crt"

echo ""
echo "================================================================="
echo "✅ PKI SETUP COMPLETE!"
echo ""
echo "• Server Certificate: $SERVER_CERT"
echo "• Server Private Key: $SERVER_KEY"
echo "• Root CA Public:     $PUBLIC_DIR/MedScript-Clinic-Root-CA.crt"
echo ""
echo "📱 To get a 100% green padlock on clinic Tablets, iPads & PCs:"
echo "   Download the CA from: https://<server-ip>:3000/MedScript-Clinic-Root-CA.crt"
echo "   and install it as a Trusted Root Certification Authority."
echo "================================================================="
