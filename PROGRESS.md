# MedScript OPD — Project Progress Log

> **How to use this file**
> - At the start of every session: read this file first. It tells you the current state.
> - At the end of every session: update the relevant sections before committing.
> - Keep `## Current State` accurate at all times — it is the single source of truth.

---

## Current State

**Version:** `1.1.1` | **Branch:** `main` | **Last commit:** `d8d9269`
**Build:** ✅ 0 errors | **Tests:** ✅ 14/14 passing

```
Next.js 16.3.4 (Turbopack) · SQLite (Drizzle ORM) · Offline-First PWA
```

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
- [x] **eMAR** (Electronic Medication Administration Record) — nurse drug charting
- [x] **Fluid balance I/O chart** — 24h nurse input/output tracking with running totals
- [x] **Discharge workflow** — discharge summary, advice, referral (`IpdDischargeModal`)
- [x] **IPD deposits** — advance, top-up, refund receipts
- [x] **Clinical consents** — digital consent with tamper-evident seal

### Labs
- [x] **Lab reports module** — create, update, print, dispatch (`/labs`, `/labs/[id]`)
- [x] **Standard lab templates** — CBC, LFT, RFT, Urine, Lipid, Thyroid, etc.
- [x] **Lab report PDF** — structured printable output

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
- [x] **Vitest** — 14 tests across allergy checker, DDI, vitals, crypto
- [x] **ESLint** — configured for Next.js (`eslint.config.mjs`)

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
- [ ] **IPD billing integration** — auto-generate invoice from IPD stay (bed charges, procedures)
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
- [ ] **Page-level RBAC** — several page.tsx still use `requireAuth` instead of `requirePermission`
  - `src/app/patient/[id]/page.tsx` — needs `patient:view`
  - `src/app/prescription/[id]/page.tsx` — needs `prescription:view`
  - `src/app/ipd/[id]/page.tsx` — needs `ipd:view`
  - `src/app/labs/[id]/page.tsx` — needs `lab:view`
  - `src/app/billing/[id]/page.tsx` — needs `billing:view`
  - `src/app/appointments/page.tsx` — needs `appointment:view`
  - `src/app/patients/page.tsx` — needs `patient:view`
  - `src/app/page.tsx` (dashboard) — keep `requireAuth` (open to all authenticated)
- [ ] **Prescription actions RBAC** — `src/app/prescription/new/actions.ts` still uses `requireAuth`
- [ ] **IPD discharge actions RBAC** — `src/app/actions/ipd-discharge-actions.ts` still uses `requireAuth`
- [ ] **Test coverage** — expand beyond 14 tests; add action/API route tests
- [ ] **E2E tests** — Playwright or Cypress smoke tests for critical flows
- [ ] **Storybook** — component library documentation
- [ ] **next/image migration** — audit `<img>` tags for performance

---

## 🗓 Session Log

| Date | What was done |
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
