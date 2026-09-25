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

Only the latest release received security patches:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

---

## Reporting a Vulnerability

If you discover a security vulnerability or medical data leak issue in MedScript OPD, please report it responsibly:

1. **Do NOT report security issues via public GitHub issues.**
2. Send an email to the security maintainers at: `security@medscript.org` (or open a private [GitHub Security Advisory](https://github.com/medscript/medscript-opd/security/advisories)).
3. Please include:
   - A description of the vulnerability and attack vector.
   - Exact steps or proof-of-concept to reproduce the behavior.
   - Operating system and environment details.
4. We will acknowledge receipt of your report within 48 hours and work with you to test and deploy a fix before public disclosure.
