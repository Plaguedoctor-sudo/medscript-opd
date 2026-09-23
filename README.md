# MedScript OPD

**MedScript OPD** is a modern, privacy-focused Electronic Medical Records (EMR) and digital prescription system designed for outpatient clinics, independent doctors, and polyclinics. Built with Next.js 16, React 19, Tailwind CSS, SQLite with Drizzle ORM, and `@react-pdf/renderer`.

---

## 🌟 Key Features

### 1. ℞ OPD Consultation & Digital Prescriptions
- **Patient Directory & ABHA Integration**: Fast patient search by name, phone, or Ayushman Bharat Health Account (ABHA ID).
- **Vital Signs Recording**: Weight, Blood Pressure (BP), Pulse rate, Temperature (°F), and SpO2 (%).
- **Clinical Records**: Chief complaints, clinical history, and clinical diagnosis with autocompletion datalists.
- **Medication Management**: Dosage frequencies (`1-0-1`, `1-1-1`, `SOS`), timing (`After food`, `Before food`), duration (`5 days`, `1 month`), and specific patient instructions (`Take at bedtime with warm water`).
- **1-Click Repeat Rx**: Refill chronic medications and past clinical history instantly without re-typing.

### 2. 📊 Longitudinal Patient Vitals & Clinical Analytics
- **Multi-Visit Parameter Trends**: Interactive SVG charts tracking Blood Pressure (with Normal Zone & Hypertensive alert bands), Weight progression curve, Pulse, SpO2, and Temperature curves.
- **Longitudinal Clinical Flowsheet**: Tabular side-by-side comparison of vitals and diagnoses across all past visits.
- **KPI Summary Cards**: Latest readings with delta indicators (`vs prev visit`) and automated JNC-8 BP classification.

### 3. 📄 Professional PDF Letterhead & Printing
- **Real-time PDF Preview**: Built-in document viewer powered by `@react-pdf/renderer`.
- **One-Click Download & Print**: Instant vector PDF downloads formatted to A4 medical prescription specifications, with support for direct thermal and desktop printing.
- **Custom Doctor Header & Signature**: Doctor qualifications, registration number, clinic logo, contact info, and legal computer-generated electronic Rx footer.
- **Resilient Fallback**: Automatic default letterhead ensures immediate usability even before clinic settings are populated.

### 4. 🔒 Consultation Desk PIN Lock & Security
- **Doctor PIN Protection**: Protect confidential patient health records when stepping away from the clinic desk.
- **On-Screen Touch Keypad**: Virtual keypad designed for clinic tablets (iPad/Android) and touch-screen all-in-one PCs.
- **Quick Lock**: 1-click "Lock Desk" button in the top navigation bar.
- **Input Sanitization & Storage Integrity**: File MIME validation (2MB cap), string bounds, SQLite WAL mode, and foreign key cascading.

### 5. 💾 Database Backup & Disaster Recovery
- **1-Click Live Backup**: Download a clean, live copy of `sqlite.db` directly from the Settings page.
- **Automated CLI Backup**: Scheduled atomic backup script (`npm run db:backup`) with automatic rotation keeping the last 30 daily backups.
- **Disaster Recovery**: Restoring to a new computer is as simple as copying `sqlite.db`.

---

## 🚀 1-Click Quick Start (Clinic Deployment)

### Windows
Double-click **`start-windows.bat`**.
> Automatically checks Node.js, installs dependencies, builds the production app, initializes the database, and opens `http://localhost:3000` in your default browser.

### Linux / macOS
Run the launcher script:
```bash
chmod +x start-linux.sh
./start-linux.sh
```

### Clinic Local Area Network (LAN) / Multi-Device Mode
To allow the receptionist to register patients from their desk and doctors to consult on tablets over clinic Wi-Fi:
- **Windows**: Double-click `start-lan.bat`
- **Linux/macOS**: `./start-lan.sh`
> Displays the exact local IP address (e.g. `http://192.168.1.50:3000`) for all devices connected to the clinic Wi-Fi.

---

## 🛠️ Manual Installation

### Prerequisites
- Node.js 18+ (Node 20+ recommended)
- npm, pnpm, or yarn

```bash
# 1. Install dependencies
npm install

# 2. Seed initial clinic settings & demo multi-visit patients (Optional)
npm run db:seed

# 3. Build optimized production bundle
npm run build

# 4. Start production server
npm run start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔄 Automated Daily Backups

To back up your clinic database daily:

```bash
# Run backup manually
npm run db:backup
```
Backups are saved to `./backups/medscript-backup-YYYY-MM-DD_HH-mm-ss.db`.

### Linux / macOS Cron Setup
Add to crontab (`crontab -e`) to run every evening at 9:00 PM:
```bash
0 21 * * * cd /path/to/medscript-opd && npm run db:backup >> /tmp/medscript-backup.log 2>&1
```

### Windows Task Scheduler Setup
Create a basic task in Windows Task Scheduler:
- **Trigger**: Daily at 9:00 PM
- **Action**: Start a program -> select `backup-task.bat`

---

## 📜 Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Runs the Next.js development server with Turbopack |
| `npm run build` | Compiles and builds the production application |
| `npm run start` | Starts the production server on port 3000 |
| `npm run lint` | Runs ESLint code quality checks |
| `npm run db:seed` | Populates sample clinic profile, patients, and multi-visit consultations |
| `npm run db:backup` | Creates an atomic timestamped backup snapshot in `./backups` |
