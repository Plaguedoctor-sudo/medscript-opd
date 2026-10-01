<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# MedScript OPD: Mandatory Security & Architecture Protocols

All agents, developers, and tools working on this codebase MUST strictly follow and enforce the security protocols defined in [security/SECURITY-PROTOCOLS.md](security/SECURITY-PROTOCOLS.md) on EVERY new feature, server action, API route, component, and configuration change:

1. **Server Actions & API Routes (RBAC)**:
   - EVERY new server action MUST start with `await requirePermission('...')` or `await requireRole([...])`.
   - Operations that create/modify clinical prescriptions, medical certificates, discharge summaries, or delete medical records MUST verify `isDoctor(role)`.
   - Never trust client-supplied authentication state or parameters without authoritative server-side checks.

2. **Ingress & Networking (CWE-290)**:
   - NEVER trust user-controlled `Host` or `X-Real-IP` headers for loopback privileges or authentication bypass. Always rely on `x-medscript-verified-ip` or direct TCP socket remote address.
   - Maintain honeypot paths (`/.env`, `/.git`, etc.) and automated 24-hour quarantine integration.

3. **Data Protection & Physical Zeroization (NIST SP 800-88)**:
   - All SQLite database configurations MUST maintain `PRAGMA secure_delete = ON`.
   - Sensitive credentials, ABHA identifiers, and API tokens MUST be encrypted at rest using AES-256-GCM + scrypt derivation (`encryptPhi` / `encryptBufferAesGcm`).
   - Temporary export snapshots MUST be cryptographically shredded with random bytes before file deletion.

4. **Tamper-Evident Digital Seals & Audit Ledger**:
   - Clinical documents (prescriptions, certificates, discharge summaries) MUST calculate and attach deterministic HMAC-SHA256 digital seals.
   - Append-only audit logging via `logAuditEvent()` MUST be invoked for all state mutations and security events.

5. **Authentication & Credential Hardening**:
   - All password and PIN inputs MUST pass `validateCredentialPolicy()` (minimum 8 chars, letter+number complexity, rejection of seasonal patterns like `Fall2019!`, and facility spray words).
   - Rate limiting MUST be dual-keyed on both Client IP and Target Account (`user:<loginId>`).

6. **Content Security Policy & Fingerprinting**:
   - NEVER introduce `'unsafe-eval'` into production Content Security Policy.
   - Maintain `poweredByHeader: false` and strip `X-Powered-By` headers.

7. **Verification & Testing**:
   - After implementing any feature or change, run `npm run typecheck`, `npm test`, and `npm run audit:ci`. All 129+ unit and exploit regression tests MUST pass with 0 errors.

