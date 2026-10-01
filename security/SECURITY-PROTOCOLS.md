# MedScript OPD: High-Assurance Security Protocols & Engineering Standards

**Authority**: MedScript OPD Core Security Standard  
**Mandate**: **MUST BE APPLIED TO EVERY NEW FEATURE, SERVER ACTION, API ROUTE, UI COMPONENT, AND CONFIGURATION CHANGE.**  
**Compliance Standards**: HIPAA Security Rule (45 CFR § 164.312), DISHA / ABDM (India), OWASP SAMM v2.0 (Level 3), NIST SSDF (SP 800-218), DoD STIG High Baseline, NIST SP 800-88 Rev. 1.

---

## 1. Network & Ingress Protocols

1. **Kernel-Verified Ingress (CWE-290 Immunity)**:
   - Never trust user-controlled `Host`, `X-Forwarded-Host`, or `X-Real-IP` headers to grant loopback or administrative bypasses.
   - Peer IPs must be resolved from physical TCP sockets via the gateway multiplexer (`gatewayPeerMap`) and stamped into internal verified headers (`x-medscript-verified-ip`).
2. **Canary Trap & Intrusion Quarantining**:
   - Any access attempt to forbidden honeypot paths (`/.env`, `/.git`, `/wp-admin`, `/phpmyadmin`, `/.aws`, `/config.json`, etc.) must immediately trip a **24-hour automated IP quarantine** recorded in SQLite.
3. **Pre-Routing IDS Heuristics**:
   - All inbound URLs and parameters must pass heuristic regex filters against SQLi, XSS, Path Traversal (`../../etc/passwd`, `%2e%2e/`), and Remote Code Execution.
4. **Air-Gapped & Zero-Cloud Sovereignty**:
   - Under no circumstances may Protected Health Information (PHI), consultation notes, patient names, or phone numbers be transmitted to third-party cloud analytics, telemetry servers, or remote logging services.

---

## 2. Authentication & Identity Assurance Protocols

1. **Memory-Hard Password & PIN Derivation**:
   - All passwords and PINs must be hashed using **scrypt** (`N=16384, r=8, p=1`) with unique 16-byte cryptographically secure salts.
   - Constant-time comparison (`safeCompare`) must be used for all hash and secret comparisons to eliminate timing side-channels.
2. **Dual-Keyed Anti-Botnet Lockout**:
   - Rate limiting on authentication endpoints must track **both** the client IP address **and** the target account identifier (`user:<loginId>`).
   - A distributed brute-force attack across rotating IPs against a single account must trigger an automatic progressive lockout on that account key.
3. **Anti-Password Spray & Complexity Policy**:
   - All passwords must be at least 8 characters and require letter + number complexity.
   - Algorithmic rejection must disallow:
     - Predictable seasonal/year patterns (e.g., `Fall2019!`, `Summer2024`, `Winter2025!`, `Spring2026`).
     - Repetitive digits (`111111`) or trivial sequences (`12345678`).
     - Common facility spray patterns (`clinic1234`, `medscript123`, `admin1234`).
4. **Dynamic Cryptographic Session Invalidation**:
   - Session tokens must encode timestamp, role, and user ID with HMAC-SHA256 signatures.
   - Sessions must be verified against database timestamps on every authenticated request:
     - Deactivating an account (`is_active = 0`) must revoke sessions instantly.
     - Changing a password must revoke all tokens issued prior to `password_updated_at`.
     - Administrative role demotion must authoritatively reflect the live database role immediately.

---

## 3. Authorization & Role-Based Access Control (RBAC) Protocols

1. **Mandatory Guard on Every Server Action & API Route**:
   - Every server action must begin with `await requirePermission('permission:name')` or `await requireRole(['role1', 'role2'])`.
   - Never rely on client-side UI visibility alone for security boundaries.
2. **Clinical Authority Segregation (`isDoctor`)**:
   - High-consequence clinical operations must strictly enforce `isDoctor(role)` (`doctor` or `admin_doctor`):
     - Issuing or editing prescriptions.
     - Issuing signed Medical Certificates.
     - Finalizing and signing IPD Discharge Summaries.
     - Deleting patient documents or medical records.
     - Sending unlinked, custom freeform WhatsApp messages to patients.
3. **Peripheral & Auxiliary Isolation**:
   - Telemetry ingestion routes (`/api/devices/telemetry`) require active clinical staff sessions with `device:telemetry` or verified pre-shared machine tokens.
   - Surveillance camera modification and deletion require `cctv:manage` (Hospital Manager or Admin Doctor only).

---

## 4. Data Protection & Cryptographic Storage Protocols

1. **NIST SP 800-88 Physical Storage Zeroization**:
   - SQLite must operate with `PRAGMA secure_delete = ON`. Any deleted row or table must immediately zero-fill vacated storage blocks on physical media.
2. **Hardware Storage B-Tree Attestation**:
   - On database initialization, `PRAGMA quick_check` must verify database structural integrity and block consistency.
3. **POSIX Permission Lockdown**:
   - Enforce POSIX `0600` (`-rw-------`) on `sqlite.db`, `sqlite.db-wal`, `sqlite.db-shm`, and backup databases. Only the operating system user running the application process may read/write files.
   - Backup directories must enforce POSIX `0700` (`drwx------`).
4. **Column-Level PHI Encryption**:
   - Sensitive third-party secrets (WhatsApp Cloud tokens, cloud sync keys, ABHA linkages) must be encrypted at rest using authenticated **AES-256-GCM** with scrypt derivation (`encryptBufferAesGcm` / `encryptPhi`).
5. **NIST SP 800-88 Ephemeral File Shredding**:
   - Temporary database snapshots exported during backups must be overwritten with cryptographic random bytes before unlinking.
6. **Active Deception Lockdown**:
   - If the system is placed in breach containment or deception mode, data export endpoints must serve synthetic decoy databases with embedded canary tokens.

---

## 5. Tamper-Evident Integrity & Digital Seals Protocols

1. **Cryptographic Digital Record Seals**:
   - Every issued prescription, lab report, eMAR medication dose, nursing handover, and medical certificate must calculate a deterministic HMAC-SHA256 digital seal across its immutable clinical payload.
2. **RFC 6962 / Merkle Hash-Chained Audit Ledger**:
   - The append-only audit trail in `audit_logs` must be chronologically hash-chained with HMAC-SHA256 starting from `MEDSCRIPT_GENESIS_ROOT_V1`.
   - Modifying, deleting, or reordering any audit row must break `computeAuditTrailIntegrityHash()`.

---

## 6. Operating System & Host Hardening Protocols

1. **Windows Unquoted Service Path Prevention (CWE-428)**:
   - All Windows service and scheduled task installation scripts (`.bat`) must explicitly quote executable binary paths with `%SystemRoot%\System32\` (e.g. `\"%SystemRoot%\System32\wscript.exe\" \"%VBS_FILE%\"`).
2. **Linux Systemd Privilege Isolation & Sandboxing**:
   - All Linux systemd service configurations must enforce:
     - `NoNewPrivileges=true` (blocks SUID/GTFOBins escalation).
     - `PrivateTmp=true` (isolates `/tmp` namespace against symlink hijacking).
     - `ProtectSystem=full` (mounts `/usr`, `/boot`, `/etc` read-only).
     - `ProtectControlGroups=true`
     - `ProtectKernelModules=true`

---

## 7. Web Client & Browser Sandbox Protocols

1. **High-Assurance Content Security Policy (DoD STIG)**:
   - Production builds MUST strictly ban `'unsafe-eval'`.
   - Enforce: `object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';`.
2. **Tech Stack Fingerprint Suppression**:
   - Next.js must operate with `poweredByHeader: false`.
   - Outgoing gateway responses must strip `X-Powered-By`.
   - Suppress exact server versions from headers and error pages.
3. **Mandatory HTTP Security Headers**:
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `Referrer-Policy: strict-origin-when-cross-origin` / `no-referrer`
   - `Cross-Origin-Opener-Policy: same-origin`
   - `Cross-Origin-Resource-Policy: same-origin`
   - Anti-caching headers (`no-store, no-cache, must-revalidate`) on all clinical routes.

---

## 8. Secure Software Development Lifecycle (SSDLC) Protocols

1. **Automated CI/CD Vulnerability Quality Gate**:
   - Every pull request and build must execute `npm run audit:ci` (`npm audit --audit-level=high`).
   - Merges containing High or Critical severity CVEs must be automatically rejected.
2. **Automated Software Bill of Materials (SBOM)**:
   - Every build and release must generate a verifiable CycloneDX v1.6 SBOM (`npm run sbom`).
3. **Continuous Dependency Monitoring**:
   - `.github/dependabot.yml` must scan dependencies daily and file security updates.
4. **Vulnerability Remediation SLAs (NIST SP 800-218 & CISA KEV)**:
   - **Critical (CVSS 9.0–10.0)**: Acknowledgment ≤ 24h, Remediation ≤ 48h (CISA KEV ≤ 24h).
   - **High (CVSS 7.0–8.9)**: Acknowledgment ≤ 24h, Remediation ≤ 7 days (CISA KEV ≤ 72h).
   - **Medium (CVSS 4.0–6.9)**: Acknowledgment ≤ 48h, Remediation ≤ 30 days.
5. **Mandatory Test Verification**:
   - All changes must pass `npx tsc --noEmit`, `npm run lint`, and `npm test` (with zero regression in `security-exploit-verification.test.ts`).
