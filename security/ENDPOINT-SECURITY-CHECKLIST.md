# 🏥 MedScript-OPD Clinical Endpoint & Network Security Hardening Guide

> **Target Standard**: HIPAA Security Rule (45 CFR Part 160 and Part 164, Subparts A and C), ISO 27001 / ISO 27799 (Health Informatics), NABH Digital Health Standards, and GDPR Article 32 (Security of Processing).

This guide provides operational hardening instructions for clinic administrators and doctors deploying **MedScript-OPD** on consultation workstations and clinic local area networks (LAN).

---

## 1. Authentication & Credential Governance Protocols

### Multi-Factor Authentication (MFA / 2FA)
- **Standard**: RFC 6238 Time-Based One-Time Password (TOTP) Algorithm.
- **Offline Sovereignty**: MedScript-OPD computes TOTP cryptographic verification entirely on-device using HMAC-SHA1. No third-party cloud authentication servers or cellular SMS dependencies are required.
- **Supported Apps**: Google Authenticator, Microsoft Authenticator, Aegis (Open Source), 2FAS (Open Source), Bitwarden.
- **Emergency Recovery**: 5 single-use cryptographically hashed emergency recovery scratch codes are generated during setup. Store these offline in a secure safe or locked drawer.

### Credential & PIN Policies
- **Mandatory Rotation**: Configurable rotation interval (mandatory change every **60 to 90 days**). The system warns the doctor and requires setting a fresh PIN once the threshold is reached.
- **Length & Complexity**: Enforces 4 to 8 digit PINs with algorithmic rejection of weak, easily guessable patterns:
  - Disallows sequential patterns (e.g., `1234`, `4321`, `6789`).
  - Disallows repetitive digits (e.g., `1111`, `0000`, `9999`).
- **Anti-Brute Force Lockout**: 5 consecutive failed attempts trigger an automatic 5-minute lockout accompanied by a high-priority audit trail log.

---

## 2. Role-Based Access Control (RBAC)

MedScript-OPD enforces strict principle-of-least-privilege segregation between clinical decision-making and administrative intake:

| Functionality | Doctor Role | Front Desk / Receptionist Role |
| :--- | :---: | :---: |
| **New Prescription Desk** | ✅ Full Authority | ❌ Strictly Prohibited |
| **Clinical Modification & Deletion** | ✅ Permitted | ❌ Strictly Prohibited |
| **Diagnostic Analytics & Vitals Trends** | ✅ Full Access | ❌ Restricted |
| **Patient Registration & Demographics** | ✅ Permitted | ✅ Permitted |
| **Patient Search & Contact Info** | ✅ Full View | ✅ Permitted |
| **Clinic Letterhead & Master Settings** | ✅ Full Access | ❌ Strictly Prohibited |
| **Two-Factor Authentication Setup** | ✅ Full Authority | ❌ Strictly Prohibited |

---

## 3. Cryptographic Data Protection (At Rest & In Transit)

### Data at Rest (Storage)
1. **Full-Disk Encryption (FDE)**:
   - **Linux**: Enable **LUKS** full-disk encryption during OS installation.
   - **Windows**: Enable **BitLocker** Drive Encryption with TPM 2.0.
   - **macOS**: Enable **FileVault**.
2. **POSIX File Permissions**:
   - MedScript-OPD automatically applies POSIX `0600` (`-rw-------`) permissions to `sqlite.db`, `sqlite.db-wal`, `sqlite.db-shm`, and automated snapshot backups in `./backups`. Only the operating system user running the Node process can read or write database files.
3. **Column-Level PHI Encryption**:
   - Sensitive clinical data points are encrypted using authenticated **AES-256-GCM** via `src/lib/crypto-storage.ts` before persistence.

### Data in Transit (Network Transmission)
- **HTTP Security Headers**: Enforced directly in `next.config.ts`:
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (HSTS)
  - `X-Frame-Options: DENY` (Anti-Clickjacking)
  - `X-Content-Type-Options: nosniff` (Anti-MIME Sniffing)
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Cross-Origin-Opener-Policy: same-origin` (COOP)
  - `Cross-Origin-Resource-Policy: same-origin` (CORP)
  - `Content-Security-Policy`: Restricts scripts and styles to self.
- **TLS 1.3 Reverse Proxy**:
  - Deploy with Caddy (`security/caddy-tls-reverse-proxy.Caddyfile`) or Nginx (`security/nginx-tls-reverse-proxy.conf`) to terminate modern TLS 1.3.

---

## 4. Comprehensive Clinical Audit Trail

Under HIPAA § 164.312(b), all actions involving Protected Health Information (PHI) are logged to an immutable local SQLite audit trail table (`audit_logs`):

- `AUTH_LOGIN_SUCCESS` / `AUTH_LOGIN_FAILURE` (With IP and timestamp)
- `MFA_SETUP`, `MFA_ENABLED`, `MFA_DISABLED`, `MFA_VERIFIED`
- `PASSWORD_ROTATED`
- `PATIENT_VIEWED` / `PATIENT_CREATED` / `PATIENT_UPDATED`
- `PRESCRIPTION_VIEWED` / `PRESCRIPTION_CREATED` / `PRESCRIPTION_UPDATED` / `PRESCRIPTION_DELETED`
- `PRESCRIPTION_PRINTED` / `PRESCRIPTION_PDF_DOWNLOADED`
- `DATABASE_BACKUP_SNAPSHOT` / `AUDIT_LOG_EXPORTED`

Audit logs can be reviewed in real-time under **Settings → Clinical Audit Trail** or exported as a timestamped CSV for compliance inspections.

---

## 5. Network & Endpoint Hardening Deployment

### A. Endpoint Detection and Response (EDR)
Deploy enterprise or open-source EDR software on all clinic workstations:
- **Commercial Options**: CrowdStrike Falcon, SentinelOne, Microsoft Defender for Business/Endpoint.
- **Open-Source Alternative**: **Wazuh** (host-based intrusion detection, file integrity monitoring, vulnerability assessment).
- **Configuration**:
  - Enable Real-Time Behavioral Monitoring.
  - Enable Memory Inspection & Script Execution Blocking.
  - Enable Automatic USB Storage Device Scanning.

### B. Workstation & Perimeter Firewalls
- Run the included firewall hardening script:
  ```bash
  sudo bash security/firewall-rules.sh
  ```
- **Policy**:
  - Deny all unsolicited incoming WAN traffic.
  - Restrict port 3000 to `localhost` (127.0.0.1) or internal clinic subnet (`192.168.1.0/24`).

### C. URL Filtering & Phishing Defense
- Configure clinic routers or workstation DNS to use filtered DNS resolvers:
  - **Cloudflare for Families (Malware Blocking)**: `1.1.1.2` / `1.0.0.2`
  - **NextDNS**: Configured with threat intelligence blocklists (phishing, malware, newly registered domains).
  - **Cisco Umbrella / Quad9**: `9.9.9.9` (DNS threat filtering).

### D. Attachment Sandboxing & Antivirus
- Clinical email attachments (lab reports, radiology PDFs) must be opened through an isolated sandbox before transferring into patient records:
  - Enable Microsoft 365 Defender Safe Attachments or Google Workspace Sandboxing.
  - On Linux workstations, scan incoming files with ClamAV:
    ```bash
    sudo apt-get install clamav clamav-daemon
    clamscan -r /home/clinic/Downloads
    ```

### E. Remote Doctor Access via VPN (Zero Open Router Ports)
- **Never open port 3000 or port 80/443 directly to the public internet on your clinic router.**
- For remote telemedicine or viewing charts from home:
  - **WireGuard**: Use the preconfigured configuration in `security/wireguard-clinic-vpn.conf`.
  - **Tailscale**: Zero-config peer-to-peer encrypted WireGuard mesh.
    ```bash
    curl -fsSL https://tailscale.com/install.sh | sh
    sudo tailscale up
    ```

---

## 6. Daily Backup & Disaster Recovery Runbook

1. **Automated Daily Snapshots**:
   ```bash
   npm run db:backup
   ```
2. **Offsite USB Replication**:
   - Replicate the `./backups` folder to a BitLocker or LUKS encrypted USB drive at the end of each clinic day.
3. **Database Health Verification**:
   - Run the built-in SQLite forensic diagnostics under **Settings → Database Backup & Disaster Recovery** to confirm 100% zero corruption and foreign key integrity.
