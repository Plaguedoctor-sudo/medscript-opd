# MedScript OPD — Project Progress Log

> **How to use this file**
> - At the start of every session: read this file first. It tells you the current state.
> - At the end of every session: update the relevant sections before committing.
> - Keep `## Current State` accurate at all times — it is the single source of truth.

---

## Current State

**Version:** `1.1.9` | **Branch:** `main`
**Build:** ✅ 0 errors | **Tests:** ✅ 206/206 passing across 19 test suites
**Status:** Multi-Branch Clinic Mesh Replication (Vector Clocks & CRDT LWW Reconciliation) · Live WebRTC WHEP CCTV · NVR Footage Vault · Section 65B Forensic Admissibility

```
Next.js 16.3.8 (Turbopack) · SQLite (Drizzle ORM) · Multi-Branch Mesh Clustering · Offline-First PWA · Android Native APK
```

---

## 🎯 Target Tasks for Tomorrow (Priority Roadmap)

### 1. Patient Portal & Health Information User (HIU) Consent Gateway
- Provide patient-facing view of ABDM linked care contexts and digital prescriptions via OTP authorization.
- Enable automatic PM-JAY claim filing integration with electronic National Health Authority submission.

### 2. Autonomous Background Sync Daemon & Resilient WAN Transport
- Implement automated heartbeat ping and periodic delta synchronization worker running in background.
- Integrate WebRTC data-channel fallback for peer-to-peer clinic data transfer across symmetric NATs.

---

## ✅ Completed Features

### Core Clinical
- [x] **OPD Prescription system** — new consultation, edit, PDF export, digital Rx seal
- [x] **Patient registry** — registration, demographics, patient timeline (`/patient/[id]`)
- [x] **ICD-10 diagnostic coding** — searchable dropdown on prescription form (`/lib/icd10.ts`)
- [x] **Drug formulary** — generics, IV fluids, injectables, topicals, surgical consumables
- [x] **Drug-Drug Interaction (DDI) checker** — real-time alert on prescription form
- [x] **Drug-Allergy guard** — cross-checks prescribed drugs against patient allergy list
- [x] **Clinical calculators modal** — embedded in prescription form
- [x] **Medical certificates** — issue & PDF print (`certificate-actions.ts`)
- [x] **Patient documents** — upload/view attached documents (`PatientDocumentsSection`)
- [x] **Prescription templates** — save, load, manage templates (`PrescriptionTemplatesModal`)
- [x] **Vitals analytics** — charts per-patient across 4 vitals tabs (`PatientVitalsAnalytics`)

### IPD (Inpatient)
- [x] **IPD admissions** — create, list, filter (`/ipd`, `/ipd/[id]`)
- [x] **Clinical rounds** — doctor round notes with vitals
- [x] **Nurse nursing notes section** — IPD nursing notes
- [x] **eMAR** (Electronic Medication Administration Record) — nurse drug charting with prescribing doctor & administering nurse attribution
- [x] **Fluid balance I/O chart** — 24h nurse input/output tracking with running totals and nurse attribution
- [x] **Inpatient Handovers** — cross-shift nursing handovers and doctor round handovers (`IpdHandoverSection`)
- [x] **Inpatient Clinical Services & Procedures** — oxygen therapy, suctioning, drainage care with nurse and doctor attribution (`IpdNursingServicesSection`)
- [x] **Discharge workflow** — discharge summary, advice, referral (`IpdDischargeModal`)
- [x] **IPD deposits** — advance, top-up, refund receipts
- [x] **IPD billing integration & discharge settlement** — auto-generate final invoice from bed tariffs, procedures, nursing care, doctor visits & advance deposits (`IpdBillingSection`, `billing-actions.ts`)
- [x] **Clinical consents** — digital consent with tamper-evident seal

### Labs
- [x] **Lab reports module** — create, update, print, dispatch (`/labs`, `/labs/[id]`)
- [x] **Lab data editing exclusivity** — strictly restricted to certified `lab_technician` and `admin_doctor` (`LabResultEditorModal`)
- [x] **Standard lab templates** — CBC, LFT, RFT, Urine, Lipid, Thyroid, etc.
- [x] **Lab report PDF** — structured printable output

### Military-Grade Security Subsystem
- [x] **DoD DEFCON Threat Readiness Matrix** — real-time levels 1 to 5 with threat score gauge & admin manual override
- [x] **Deep Payload Inspection & IDS Sentinel** — zero-day heuristics for SQLi, XSS, Path Traversal, and RCE (`military-sentinel.ts`)
- [x] **Automated 24h IP Quarantine** — autonomous hardware/SQLite blocklist and pardon workflow
- [x] **Next.js 16 Edge Proxy Defense** — request filtering and DoD STIG security headers (`src/proxy.ts`)
- [x] **Fleet-Wide Cryptographic Seals** — HMAC-SHA256 seals for prescriptions, lab results, eMAR, handovers, and audit blockchain (`military-crypto.ts`)
- [x] **Military Cyber Command Center UI** — integrated radar, fleet sweep, quarantine table, and attack drills (`MilitarySecurityCommandCenter.tsx`)

### Android & Mobile Experience
- [x] **Mobile Viewport & Touch Optimization** — Next.js 16 `Viewport` config (`viewportFit: "cover"`, touch-action manipulation, safe-area-inset CSS for Android navigation pills).
- [x] **Native Bottom Navigation Bar** (`MobileNavigation.tsx`) — Android-native bottom navigation with Quick actions (Queue, Consultation, Patients, IPD, More).
- [x] **Role-Scoped Mobile Navigation Drawer** — Slide-out drawer with quick links to all authorized clinical modules based on user role.
- [x] **Responsive Desktop Headers** — Screen-adaptive headers across all main pages (`/`, `/patients`, `/ipd`, `/billing`, `/labs`, `/inventory`, `/appointments`, `/reports`, `/settings`) hiding cluttered desktop links on mobile phones.
- [x] **Instant PWA WebAPK Installation** — Android Chrome 1-tap "Install App on Phone" with manifest and beforeinstallprompt support.
- [x] **Native Android APK Wrapper Project** (`/android`) — Standalone Android Studio Kotlin Gradle project with cleartext LAN support, camera/upload handling, pull-to-refresh, hardware back button, and dynamic Server URL config.
- [x] **Automated APK Build Script** (`scripts/build-android-apk.sh`) & Documentation (`android/README.md`).

### Billing
- [x] **OPD invoice system** — create, edit, status management (`/billing`, `/billing/[id]`)
- [x] **Invoice PDF** — printable invoice with clinic branding
- [x] **Patient search for billing** — quick lookup on new invoice

### Appointments / Queue
- [x] **Appointment scheduling** — create, update, cancel (`/appointments`)
- [x] **OPD queue** — live token queue view (`/appointments/queue`)
- [x] **Check-in workflow** — patient check-in (`/checkin`)

### Pharmacy / Inventory
- [x] **Pharmacy inventory** — add, dispense/adjust stock, transactions log (`/inventory`)
- [x] **Rack location, supplier, expiry tracking** on inventory items

### Reports
- [x] **Reports dashboard** (`/reports`) — clinical analytics view
- [x] **IDSP reporting** (`/reports/idsp`) — communicable disease surveillance

### Dispatch / Communication
- [x] **WhatsApp Cloud API dispatch** — prescription/lab messages via Meta API
- [x] **WhatsApp web fallback** — URL-based fallback when Cloud API not configured
- [x] **SMS dispatch** — basic SMS via configured provider

### Interoperability
- [x] **HL7 FHIR R4 endpoints** — `/api/fhir/...` patient, prescription resources
- [x] **ABDM integration client** — ABHA number support, ABHA verification flow (`/lib/abdm/`)

### Security
- [x] **PIN-based session auth** — `requireAuth()` guard on all pages
- [x] **RBAC (Role-Based Access Control)** — `requirePermission()` on all server actions
  - Roles: `admin_doctor`, `doctor`, `nurse`, `receptionist`, `lab_technician`
  - 30+ granular `Permission` keys in `ROLE_PERMISSIONS` matrix
  - `canDo(role, permission)` client helper for UI gating
  - **Clinical Lab Access Control**:
    - `doctor`: Can order lab tests (`lab:order`), cannot edit diagnostic lab reports/results.
    - `nurse`: Cannot order lab tests, cannot edit diagnostic lab reports/results.
    - `lab_technician`: Exclusive editor of diagnostic lab results & parameters (`lab:manage`), can intake walk-in lab tests (`lab:order`).
    - `admin_doctor`: Complete supervisor over lab ordering, result calibration, and report deletion.
- [x] **Multi-user staff management** — individual PINs per staff member (`/settings` → Staff tab)
- [x] **TOTP / MFA** — TOTP setup and verify (`/lib/totp.ts`, `MfaSetupModal`)
- [x] **PHI sanitization** — ABHA, Aadhaar masking in logs (`phi-sanitizer.ts`)
- [x] **AES-256-GCM encryption** — sensitive field crypto (`crypto-storage.ts`)
- [x] **Digital consent sealing** — HMAC-based tamper detection (`consent-security.ts`)
- [x] **Tamper-evident audit chain** — append-only audit log (`audit.ts`)
- [x] **Rate limiter** — per-IP + global lockout after 5 failed PIN attempts
- [x] **Idle auto-lock** — session lock after inactivity (`IdleAutoLock`)
- [x] **Decoy engine + honeypot** — fake admin route to detect intrusion (`decoy-engine.ts`)
- [x] **OWASP WSTG hardening** — CSP, HSTS, X-Frame, rate limiting, input validation
- [x] **Security alert bell** — real-time alerts for suspicious events (`SecurityAlertBell`)

### PWA / Offline
- [x] **Service worker** — offline-first caching (`/public/sw.js`)
- [x] **Web app manifest** — installable PWA (`/public/manifest.json`)
- [x] **Offline fallback page** (`/public/offline.html`)

### Settings
- [x] **Clinic settings** — name, logo, address, contact, branding
- [x] **Staff management** — add/edit/delete staff with role assignment
- [x] **Google Drive backup** — one-click SQLite backup to Drive (`gdrive-backup.ts`)
- [x] **Backup/restore UI** (`/settings/backup`)

### Patient UX
- [x] **Patient registration page** — standalone intake for receptionist/nurse (`/patients/register`)
- [x] **Bulk patient import** — CSV import modal (`BulkPatientImportModal`)
- [x] **Dashboard role-contextual CTAs** — primary action varies by role
- [x] **Dashboard navbar filtered by role** — lab_tech sees only Labs, nurse sees IPD, etc.

### Legal / IP
- [x] **Proprietary license** — MIT replaced with custom proprietary license
- [x] **Copyright headers** injected in 14 core modules
- [x] **IP registration dossier** — codemeta.json, CITATION.cff, Zenodo metadata
- [x] **Proof-of-existence certificate** — SHA-256 hash timestamp
- [x] **Startup India DPIIT / NSWS** — registration guidance docs

### CI / Quality
- [x] **GitHub Actions CI** — lint + type-check + test on every push (`.github/workflows/ci.yml`)
- [x] **Vitest** — 176 tests across 17 test suites
- [x] **ESLint** — configured for Next.js (`eslint.config.mjs`)

### Hospital CCTV Surveillance & NVR Vault
- [x] **Multi-Zone Command Center** (`/cctv`) — Live surveillance grid (1x1, 2x2, 3x3, Wall) for ICU, Emergency, OT, Pharmacy, IPD Wards, Reception, and Stores with PTZ optical controls and HIPAA/DISHA patient dignity masking.
- [x] **Native RTSP Bridge & ONVIF Discovery** (`src/lib/cctv/rtsp-bridge.ts`) — Media gateway integration (go2rtc / MediaMTX) and local subnet WS-Discovery auto-scanner.
- [x] **NVR Storage Engine & Retention Manager** (`src/lib/cctv/cctv-storage-engine.ts`) — Automated rolling purge according to configurable retention windows (7 to 180 days, default 30 days NABH standard) and disk quota (GB) with NIST SP 800-88 cryptographic zeroization.
- [x] **Section 65B Medico-Legal Evidence Preservation** — Permanent evidence locking (`is_locked = 1`) exempt from auto-purge, tamper-evident SHA-256 digital seals with constant-time verification, and exportable Certificates of Electronic Evidence under Section 65B Indian Evidence Act / Section 63 Bharatiya Sakshya Adhiniyam.
- [x] **Interactive Footage Library UI** (`CctvStorageManager.tsx`) — Storage capacity gauge, zone & trigger filtering, clip playback simulator, live hash integrity test, evidence locking dialog, and Section 65B electronic certificate export.
- [x] **Live WebRTC Video Player & Optical PTZ Canvas** (`src/components/cctv/CctvWebRtcPlayer.tsx`, `src/lib/cctv/webrtc-whep-client.ts`) — Hardware-accelerated WHEP WebRTC video player (<150ms zero-latency), draft-ietf-wish-whep compliance, real-time telemetry HUD (bitrate, fps, jitter, RTT), interactive on-canvas optical PTZ D-pad and drag-to-pan gestures, clinical surveillance presets (Bed, Doorway, Infusion Rack), HIPAA/DISHA privacy masking, and automatic fallback to simulated HUD.

### High Availability & Multi-Branch Clinic Mesh Replication
- [x] **LAN Peer Mirroring & Automated Failover** (`src/lib/lan-mirroring.ts`, `LanMirroringCard.tsx`) — Sub-second heartbeat monitoring, automatic standby promotion, and zero-data-loss database sync between Doctor Desk and Reception Desk.
- [x] **Multi-Branch Vector Clocks & CRDT Reconciliation** (`src/lib/mesh-replication.ts`, `MeshReplicationCard.tsx`) — Causal ordering with monotonic vector clocks across multi-doctor facilities, satellite clinics, and mobile medical vans over intermittent 4G/5G WAN links.
- [x] **Conflict-Free Allergy Set-Union Merging** — Automatic set-union merge for patient drug allergies across branches, guaranteeing zero allergy record loss during concurrent updates.
- [x] **Store-and-Forward Outbox Queue** (`mesh_outbox_queue`) — Local WAN disconnection resilience with automatic retry backoff, HMAC-SHA256 payload signing, and constant-time PSK token verification.
- [x] **Live Mesh Command Center** (`MeshReplicationCard.tsx`) — Remote branch registration modal, latency monitoring, outbox depth counters, and manual sync triggers in Settings.

---

## 🔄 In Progress / Partially Done

- [ ] **ABDM full flow** — client exists but ABHA OTP verification UI not wired to real endpoints yet
- [ ] **FHIR endpoints** — basic scaffolding exists; needs full Bundle, Observation resources
- [ ] **Lab report FHIR export** — DiagnosticReport resource not yet generated
- [ ] **Prescription FHIR export** — MedicationRequest resource stub only

---

## 📋 Backlog (Not Started)

### Clinical
- [ ] **OP Visit history timeline** — chronological patient encounter view
- [ ] **Referral letter generator** — printable referral to specialist
- [ ] **Growth chart** — pediatric weight/height percentile plotting
- [ ] **Immunization tracker** — vaccination schedule and records
- [ ] **Allergy list editable from patient profile** — currently append-only
- [ ] **Prescription auto-save / draft** — recover unsaved consultations

### IPD
- [x] **IPD billing integration** — auto-generate invoice from IPD stay (bed charges, procedures, rounds, nursing care & advance deposits)
- [ ] **Bed/ward management UI** — visual bed occupancy map
- [ ] **Diet chart / nutritionist notes** — IPD dietary orders
- [ ] **Physiotherapy notes** — IPD rehab records

### Labs
- [ ] **Lab report QR code** — scannable verification QR on report PDF
- [ ] **External lab integration** — import results from external LIMS
- [ ] **Lab billing** — auto-create invoice from lab order

### Billing
- [ ] **GST / tax handling** — configurable tax rates on invoice line items
- [ ] **Expense tracking** — clinic expense register
- [ ] **Payment gateway integration** — Razorpay / Stripe for digital payments
- [ ] **Insurance / TPA billing** — claim generation workflow

### Interoperability
- [ ] **ABHA OTP UI** — complete patient ABHA verification flow in registration
- [ ] **FHIR Bundle export** — patient summary export as complete FHIR Bundle
- [ ] **Ayushman Bharat / PM-JAY** — scheme eligibility check and claim codes
- [ ] **DigiLocker integration** — share records with patient's DigiLocker

### Reporting
- [ ] **Custom date-range reports** — filter analytics by arbitrary date range
- [ ] **Export to Excel/CSV** — reports export (CSV export lib exists, needs UI)
- [ ] **Doctor performance dashboard** — consultations per day, avg duration

### Operations
- [ ] **Appointment reminders** — WhatsApp/SMS 24h before appointment
- [ ] **Patient portal (read-only)** — patient can view their own prescriptions via link
- [ ] **Multi-branch / multi-clinic** — single deployment serving multiple locations
- [ ] **Telemedicine integration** — video consult link in appointment

### Technical Debt
- [x] **Page-level RBAC** — several page.tsx still use `requireAuth` instead of `requirePermission`
  - [x] `src/app/patient/[id]/page.tsx` — uses `requirePermission('patient:view')`
  - [x] `src/app/prescription/[id]/page.tsx` — uses `requirePermission('prescription:view')`
  - [x] `src/app/ipd/[id]/page.tsx` — uses `requirePermission('ipd:view')`
  - [x] `src/app/labs/[id]/page.tsx` — uses `requirePermission('lab:view')`
  - [x] `src/app/billing/[id]/page.tsx` — uses `requirePermission('billing:view')`
  - [x] `src/app/appointments/page.tsx` — uses `requirePermission('appointment:view')`
  - [x] `src/app/page.tsx` (dashboard) — keep `requireAuth` (open to all authenticated)
- [x] **Prescription actions RBAC** — `src/app/prescription/new/actions.ts` uses `requirePermission`
- [x] **IPD discharge actions RBAC** — `src/app/actions/ipd-discharge-actions.ts` uses `requirePermission`
- [ ] **Test coverage** — expand beyond 27 tests; add action/API route tests
- [ ] **E2E tests** — Playwright or Cypress smoke tests for critical flows
- [ ] **Storybook** — component library documentation
- [ ] **next/image migration** — audit `<img>` tags for performance

---

## 🗓 Session Log

| Date | What was done |
|---|---|
| 2026-10-03 | **Live WebRTC Video Player (WHEP) & Interactive On-Canvas Optical PTZ Subsystem (v1.1.8)** — (1) **WHEP WebRTC Client Architecture (`src/lib/cctv/webrtc-whep-client.ts`)**: IETF draft-ietf-wish-whep protocol implementation for sub-200ms zero-latency camera feeds; automated endpoint resolver for go2rtc (`/api/webrtc?src=cam_<id>`) and MediaMTX (`/cam_<id>/whep`); dual transceiver inbound audio/video negotiation with SDP exchange; real-time telemetry stats polling (round-trip time RTT, frames per second, network bitrate Kbps, packet loss); clean session lifecycle management with HTTP DELETE teardown on disconnect; (2) **Interactive Optical PTZ & Gesture Engine**: Pan [-180°, 180°], Tilt [-90°, 90°], and Zoom [1.0x, 30.0x] boundary mathematical clamps; mouse drag-to-pan gestures with sensitivity dampening directly across live video; clinical hospital presets (Preset 1: Patient Bed Focus, Preset 2: Ward Doorway Access, Preset 3: Medical Equipment / Infusion Rack); (3) **Hardware-Accelerated UI Player (`CctvWebRtcPlayer.tsx`)**: Embedded in `HospitalCctvCommandCenter.tsx` for both individual grid tiles and expanded focus inspector; CSS GPU transform acceleration (`scale` + `translate`) for smooth digital/optical pan and zoom; HIPAA/DISHA patient privacy masking blur; telemetry HUD badge indicating live WHEP connection status and latency in ms; integrated on-canvas collapsible PTZ D-pad overlay, preset triggers, audio unmute, and instant forensic snapshot capture; automatic fallback to animated clinical telemetry canvas (ECG waveform, sterile field HUD) when gateway is offline; (4) **Test Suite (`cctv-webrtc-whep.test.ts`)**: 14 comprehensive unit tests verifying WHEP URL resolution, PTZ state transitions and boundary clamps, hospital presets recall, drag-to-pan vector calculations, and client session lifecycle. Build ✅ Typecheck ✅ Tests ✅ 190/190 passing across 18 test suites, 0 errors. |
|---|---|
| 2026-10-02 | **Hospital CCTV Feed Storage, NVR Archive & Medico-Legal Evidence Preservation Subsystem (v1.1.7)** — (1) **Database Schema & Migrations**: Added `hospital_cctv_recordings` table with indexing on `camera_id`, `zone`, `start_time`, and `is_locked`, plus clinic settings configuration fields for `cctv_storage_path`, `cctv_retention_days`, `cctv_max_storage_gb`, and `cctv_auto_purge_enabled`; (2) **Storage & Retention Engine (`src/lib/cctv/cctv-storage-engine.ts`)**: Configurable retention windows (7, 15, 30, 60, 90, 180 days) matching NABH recommendations and disk quotas (GB); automated rolling purge enforcing NIST SP 800-88 cryptographic zeroization before unlinking; strict evidence lock protection ensuring `is_locked = 1` files are permanently exempt from purge or unauthorized deletion; (3) **Section 65B Indian Evidence Act / Section 63 BSA Forensic Admissibility**: SHA-256 digital seals generated per video segment with POSIX 0600 file modes; constant-time `crypto.timingSafeEqual` hash verification detecting any disk bit modification or tampering; exportable Section 65B electronic evidence certificates; (4) **Server Actions (`src/app/cctv/storage-actions.ts`)**: `getCctvStorageDataAction`, `updateCctvStorageConfigAction`, `toggleLockRecordingAction`, `verifyRecordingIntegrityAction`, `deleteRecordingAction`, and `triggerStoragePruneAction` secured with `requirePermission('cctv:view')` and `requirePermission('cctv:manage')`; (5) **Interactive UI (`CctvStorageManager.tsx` & `HospitalCctvCommandCenter.tsx`)**: Storage capacity gauge with utilization progress bar, zone & trigger filters, clip playback inspector modal with Section 65B certificate generator, evidence locking dialog with case custody notes, and manual rolling purge trigger; (6) **Test Suite (`cctv-feed-storage.test.ts`)**: 6 comprehensive unit tests validating segment saving, SHA-256 integrity, tamper detection, evidence locking preventing deletion, selective prune preserving locked evidence, and storage statistics. Build ✅ Typecheck ✅ Tests ✅ 176/176 passing across 17 test suites, 0 errors. |
|---|---|
| 2026-10-02 | **High Availability LAN Mirroring, Native CCTV RTSP Bridge, and ABDM/PM-JAY Sandbox Certification** — (1) **Automated LAN Peer Mirroring (Zero Data Loss)**: High Availability SQLite cluster engine (`src/lib/lan-mirroring.ts`) with SHA-256 database seals, constant-time cluster PSK verification (`crypto.timingSafeEqual`), signed replication snapshot packages, heartbeat monitoring endpoints (`/api/lan-mirror/heartbeat`, `/api/lan-mirror/sync`), emergency failover promotion (`promoteToPrimary`), and interactive UI (`LanMirroringCard.tsx`) on `/settings`; (2) **Native Hospital CCTV RTSP Bridge & ONVIF Discovery**: Integrated RTSP bridge engine (`src/lib/cctv/rtsp-bridge.ts`) supporting local go2rtc/MediaMTX gateways, ONVIF Profile S/T WS-Discovery camera scanner, TCP port stream probe with latency diagnostics, production `go2rtc.yaml` and `mediamtx.yml` configuration generators, and UI integration with test connection button in `HospitalCctvCommandCenter.tsx`; (3) **ABDM & PM-JAY Sandbox Compliance Validator**: NHA compliance engine (`src/lib/abdm/abdm-sandbox-validator.ts`) covering M1 (ABHA creation & verification), M2 (HIP care context linking), and M3 (NRCES FHIR R4 Document Bundle with Entry[0] Composition and Practitioner attribution), plus Ayushman Bharat PM-JAY HBP 2.2 pre-authorization and claim readiness auditor (`runAbdmSandboxValidationAction`); (4) **Test Suites**: Added 34 unit tests across `lan-peer-mirroring.test.ts` (10 tests), `cctv-rtsp-bridge.test.ts` (14 tests), and `abdm-sandbox-validation.test.ts` (10 tests). Build ✅ Typecheck ✅ Tests ✅ 170/170 passing across 16 test suites, 0 errors. |
|---|---|
| 2026-09-30 | **Zero-Trust Security Hardening & Anti-Compromise Loophole Remediation** — (1) Live Staff User Session Lifecycle: Instant session revocation when staff account is deactivated or deleted; removed dangerous fall-through in `getCurrentUser()`; added `password_updated_at` column to invalidate tokens on credential reset; authoritative role queried live from database to prevent demotion bypass; (2) FHIR R4 Endpoint RBAC Protection: Enforced `canDo(role, 'patient:view')` on `/api/fhir/R4/Patient` and `canDo(role, 'prescription:view')` on `/api/fhir/R4/Bundle/[id]` and `/api/fhir/R4/MedicationRequest`; (3) Database Restoration Lockdown: Restoring active database strictly guarded by `admin_doctor` in `restoreLocalDatabaseSnapshotAction`; (4) Inventory Protection: Adding pharmacy stock and setting prices strictly requires `inventory:manage`; manual stock write-offs (`ADJUSTMENT`/`EXPIRED`) strictly requires doctor role; (5) Destructive Action Safeguards: Deleting medical records (`deletePatientDocumentAction`), prescriptions (`deletePrescription`), billing invoices (`deleteInvoiceAction`), and diagnostic reports (`deleteLabReport`) strictly restricted to authorized doctors or CMO (`admin_doctor`); (6) Waiting Room Kiosk Anti-Scraping: Enforced IP rate limiting (10 queries/min) in `lookupReturningPatientAction` to prevent automated enumeration of patient registry; (7) Tamper-Evident Medical Certificates: Added HMAC-SHA256 digital seal hash (`digital_seal_hash`) on `medical_certificates`; (8) Unit test suite: `insider-security-loopholes.test.ts` with 9 tests covering token lifecycle, role demotion, kiosk rate limiting, and RBAC isolation. Build ✅ Tests ✅ 63/63 passing across 8 test suites. |
|---|---|
| 2026-09-30 | **IPD Billing Integration & Inpatient Settlement** — (1) Core calculation engine (`src/lib/ipd-billing.ts`) for length of stay, ward tariffs, daily nursing care, doctor round charges, procedures, and lab fees; (2) Inpatient advance deposits reconciliation (ADVANCE + TOP_UP - REFUND) with net payable/refund tracking; (3) Server actions (`ipd/billing-actions.ts`) for breakdown calculation and official IPD final invoice generation; (4) Interactive case sheet UI (`IpdBillingSection.tsx`) with real-time financial ledger, deposit receipts badges, and final bill generation modal; (5) Two-way `/billing` linking with `admissionId` pre-population and IPD admission badges on printable invoices (`InvoiceView.tsx`); (6) Unit test suite (`ipd-billing.test.ts`) with 14 tests covering tariffs, stay length, and edge cases. Build ✅ Tests ✅ 41/41 passing across 6 test suites. |
|---|---|
| 2026-09-30 | **Enterprise Infrastructure & RBAC Hardening** — (1) Localhost HTTP-to-HTTPS upgrade with dual-protocol TCP multiplexer in `server.js`; (2) 2-tier Clinic PKI (`MedScript-Clinic-Root-CA.crt` & server cert with SAN for localhost, mDNS, and LAN IPs); (3) Clinic mDNS hostname broadcast (`nitin-ThinkCentre-M920q.local`); (4) Automated daily & 6-hourly SQLite backup service (`medscript-backup.timer`); (5) PWA Service Worker verified over HTTPS; (6) Complete Page-Level RBAC migration across Patient, Prescription, IPD, Labs, Billing, and Appointments. Build ✅ Tests ✅ 27/27 passing across 5 test suites. |
|---|---|
| 2026-09-29 | **Receptionist patient registration** — scoped `/patients` page to `requirePermission('patient:view')`; gated Labs/Reports/Billing nav links with `canDo()`; bulk import uses `requirePermission('patient:register')`; receptionist dashboard now shows workspace panel (Register Patient, OPD Queue, Billing hero cards) instead of prescriptions table; register page back button → `/`; success state adds "Back to Dashboard". Build ✅ Tests ✅ 14/14. Committed: `0fddbc1` |
|---|---|
| 2026-09-29 | **RBAC wiring** — fixed `requirePermission` import bugs in `ipd/actions.ts`, `labs/actions.ts`; removed dead `requireAuth` imports from `appointments`, `billing`, `inventory`; fixed stray `requireAuth(` call in `whatsapp-cloud-actions.ts`. Build ✅ Tests ✅ 14/14. Committed: `d8d9269` |
| 2026-09-29 | **RBAC implementation** — 30+ permissions, `canDo()`, `requirePermission()`, role-contextual dashboard, `/patients/register` page, IPD action button gating, page guards for billing/labs/reports/settings/inventory/ipd. Committed: `ced525b` |
| 2026-09-29 | **IPD fluid balance I/O** — 24h chart, running totals, full datetime timestamps across IPD records. Committed: `9552af5` |

---

## Architecture Quick Reference

```
src/
├── app/                  # Next.js App Router pages + server actions
│   ├── actions/          # Shared server actions (certs, docs, templates, whatsapp, ipd-discharge)
│   ├── appointments/     # Appointments + OPD queue
│   ├── billing/          # Invoicing
│   ├── checkin/          # Patient check-in
│   ├── inventory/        # Pharmacy inventory
│   ├── ipd/              # Inpatient (list + case sheet)
│   ├── labs/             # Lab reports
│   ├── patients/         # Patient list + register
│   ├── prescription/     # New + view prescriptions
│   ├── reports/          # Analytics + IDSP
│   └── settings/         # Clinic + staff + backup
├── components/           # Shared React components
│   └── ipd/              # IPD-specific components
├── db/
│   ├── index.ts          # Drizzle + SQLite connection
│   └── schema.ts         # All table definitions
├── lib/                  # Business logic, utilities
│   ├── auth.ts           # Session, RBAC, requirePermission()
│   ├── audit.ts          # Tamper-evident audit log
│   └── ...               # drug-interactions, icd10, abdm, fhir, etc.
└── types/index.ts        # Shared TypeScript types
```

### Key Permissions Reference (from `auth.ts`)
| Permission | Who has it |
|---|---|
| `prescription:create` | admin_doctor, doctor |
| `patient:register` | admin_doctor, doctor, nurse, receptionist |
| `ipd:view` | admin_doctor, doctor, nurse, receptionist |
| `ipd:nursing_notes` | admin_doctor, doctor, nurse |
| `ipd:emar` | admin_doctor, doctor, nurse |
| `lab:view` | admin_doctor, doctor, nurse, lab_technician |
| `billing:view` | admin_doctor, doctor, receptionist |
| `inventory:view` | admin_doctor, doctor, nurse, receptionist |
| `reports:view` | admin_doctor, doctor |
| `settings:clinic` | admin_doctor, doctor |
| `settings:staff_management` | admin_doctor only |
