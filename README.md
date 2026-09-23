# MedScript OPD

**MedScript OPD** is a modern Electronic Medical Records (EMR) and digital prescription system designed for outpatient clinics, independent doctors, and polyclinics. Built with Next.js 16, React 19, Tailwind CSS, SQLite with Drizzle ORM, and `@react-pdf/renderer`.

---

## 🌟 Key Features

### 1. ℞ OPD Consultation & Prescription Generator
- **Patient Identification**: Fast patient search or new patient registration with demographics, phone number, and Ayushman Bharat Health Account (ABHA ID).
- **Vital Signs Recording**: Weight, Blood Pressure (BP), Pulse rate, Temperature (°F), and SPO2 (%).
- **Clinical Records**: Chief complaints, clinical history, and clinical diagnosis with autocompletion datalists.
- **Medication Management**: Add generic medicines, strength, dosage frequencies (`1-0-1`, `1-1-1`, `SOS`), timing (`After food`, `Before food`), and durations (`5 days`, `1 month`) with one-click shortcut chips.
- **Advice & Investigations**: Pre-configured dietary advice, lab tests recommended, and follow-up date scheduling.

### 2. 📄 Professional PDF Letterhead & Printing
- **Real-time PDF Preview**: Built-in interactive document viewer using `@react-pdf/renderer`.
- **One-Click Download & Print**: Instant vector PDF downloads formatted to A4 medical prescription specifications, with support for direct thermal/desktop printing.
- **Custom Doctor Header & Signature**: Doctor qualifications, registration number, clinic logo, contact info, and legal computer-generated electronic Rx footer.

### 3. 👥 Patient Directory & Medical History
- **Searchable Patient Directory**: Search by patient name, phone number, or ABHA ID.
- **Patient Profile**: Full timeline of past consultations, previous diagnoses, prescribed drugs, and follow-up dates.
- **Demographic Updates**: Edit patient details (contact, age, ABHA ID) anytime directly from the patient profile.

### 4. 🏥 Clinic & Letterhead Customization
- Configure clinic name, full address, contact numbers, doctor degree/specialization, medical council registration number, and custom clinic logo.
- Automatic fallback letterhead ensures prescriptions can be drafted and tested immediately even before clinic settings are populated.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack, Server Actions)
- **UI Library**: [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/), [Lucide React](https://lucide.dev/)
- **Components**: [Base UI](https://base-ui.com/)
- **Database & ORM**: [SQLite (`better-sqlite3`)](https://github.com/WiseLibs/better-sqlite3) with [Drizzle ORM](https://orm.drizzle.team/)
- **PDF Generation**: [@react-pdf/renderer](https://react-pdf.org/)

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (Node 20+ recommended)
- npm, yarn, or pnpm

### 1. Install Dependencies
```bash
npm install
```

### 2. Populate Sample Data (Optional)
To populate demo doctor settings, patients (Amit Verma, Priya Patel), and sample prescriptions:
```bash
npm run db:seed
```
*(Alternatively, you can click "Load Sample Clinic Profile & Demo Patients" on the Settings page.)*

### 3. Run the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📜 Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Runs the Next.js development server with Turbopack |
| `npm run build` | Compiles and builds the production application |
| `npm run start` | Starts the production server |
| `npm run lint` | Runs ESLint code quality checks |
| `npm run db:seed` | Populates sample clinic profile, patients, and prescriptions |
