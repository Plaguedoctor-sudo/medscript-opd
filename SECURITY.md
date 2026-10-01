# Security Policy

## Medical Data Privacy & Architecture Principles

MedScript OPD is intentionally engineered with an **offline-first, zero-cloud architecture**:
- **Local Sovereignty**: All Protected Health Information (PHI), consultation records, and prescription histories reside exclusively in your local SQLite database on the clinic machine.
- **Zero Telemetry**: No patient names, phone numbers, vitals, or clinical notes are ever transmitted across the internet.
- **Defense in Depth**:
  - Constant-time PIN verification preventing timing side-channel attacks.
  - Rate-limited consultation desk authentication (5 failed attempts &rarr; 5-minute lockout).
  - Inactivity screen auto-lock to prevent shoulder-surfing in unattended consultation rooms.
  - Strict POSIX file permissions (`chmod 600` on database, `chmod 700` on backup directories).
  - Hardened HTTP security headers (`X-Frame-Options: DENY`, `nosniff`, CSP, anti-caching for sensitive clinical endpoints).
  - Immutable local audit logging for all authentication and clinical record mutations.

---

## Supported Versions

Only the latest active minor release receives immediate security patches:

| Version | Supported          | Security SLA Status |
| ------- | ------------------ | ------------------- |
| 1.1.x   | :white_check_mark: | Active (Current)    |
| 1.0.x   | :white_check_mark: | Critical-only       |
| < 1.0   | :x:                | Deprecated          |

---

## Vulnerability Remediation SLAs (NIST SP 800-218 & CISA KEV)

MedScript OPD adheres to strict Mean Time to Remediate (MTTR) targets across all code and third-party dependencies:

| Severity (CVSS v3.1) | Acknowledgment SLA | Remediation & Patch SLA | CISA KEV Active Exploit SLA |
| :------------------- | :----------------- | :---------------------- | :-------------------------- |
| **Critical (9.0–10.0)** | ≤ 24 Hours         | ≤ 48 Hours              | ≤ 24 Hours                  |
| **High (7.0–8.9)**      | ≤ 24 Hours         | ≤ 7 Days                | ≤ 72 Hours                  |
| **Medium (4.0–6.9)**    | ≤ 48 Hours         | ≤ 30 Days               | N/A                         |
| **Low (0.1–3.9)**       | ≤ 7 Days           | Next Scheduled Minor    | N/A                         |

---

## Supply Chain Integrity & Software Bill of Materials (SBOM)

In compliance with Executive Order 14028 and NIST SSDF:
- Every production build and release generates an official CycloneDX v1.6 SBOM (`bom.json`).
- Automated Software Composition Analysis (SCA) runs on every pull request via `npm run audit:ci`, automatically blocking merges with unresolved High or Critical CVEs.
- Dependabot continuously audits dependencies daily for CVE advisories.

---

## Reporting a Vulnerability

If you discover a security vulnerability or medical data leak issue in MedScript OPD, please report it responsibly:

1. **Do NOT report security issues via public GitHub issues.**
2. Send an email to the security maintainers at: `security@medscript.org` (or open a private [GitHub Security Advisory](https://github.com/Plaguedoctor-sudo/medscript-opd/security/advisories)).
3. Please include:
   - A description of the vulnerability and attack vector.
   - Exact steps or proof-of-concept to reproduce the behavior.
   - Operating system and environment details.
4. We will acknowledge receipt of your report within 24 hours and coordinate patch verification prior to public disclosure.
