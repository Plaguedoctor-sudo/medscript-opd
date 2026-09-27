# Form XIV Copyright Application Dossier (Government of India)
## Under Rule 70 of the Copyright Rules, 2013 | Copyright Act, 1957

This document contains the exact pre-filled particulars required for submitting an online application for **Computer Software Copyright** on the official portal of the Registrar of Copyrights, New Delhi ([https://copyright.gov.in](https://copyright.gov.in)).

---

### Statement of Particulars (SoP)

| Field No. | Particular Required | Entry for MedScript OPD |
| :--- | :--- | :--- |
| **1.** | Registration Number (to be left blank) | *(Generated upon e-filing)* |
| **2.** | Name, Address & Nationality of Applicant | **Dr. Nitin Hiralal Sonare**<br>Sonare Hospital, Dhotra Bh. Chikhali, Buldhana, Maharashtra - 443201, India<br>Nationality: Indian |
| **3.** | Nature of Applicant’s Interest in the Copyright | **Author and Sole Proprietor/Owner** |
| **4.** | Class and Description of the Work | **Computer Software / Literary Work**<br>*Description*: Sovereign offline-first outpatient electronic medical records (EMR), digital clinical prescription generation, drug interaction surveillance, and cryptographic record integrity system. |
| **5.** | Title of the Work | **MedScript OPD - Offline-First Outpatient Prescription & EMR Software (v1.1.1)** |
| **6.** | Language of the Work | Source code written in **TypeScript, React, Next.js, and SQL (SQLite)**. User Interface and documentation in English. |
| **7.** | Name, Address & Nationality of Author | **Dr. Nitin Hiralal Sonare**<br>Sonare Hospital, Dhotra Bh. Chikhali, Buldhana, Maharashtra - 443201, India<br>Nationality: Indian |
| **8.** | Whether the work is published or unpublished? | **Unpublished / Published** *(Select 'Published' if already deployed at clinic or pushed to private/public repository)* |
| **9.** | Year and Country of First Publication | **Year: 2026, Country: India** |
| **10.** | Name, Address & Nationality of the Publisher | **Dr. Nitin Hiralal Sonare**<br>Sonare Hospital, Buldhana, Maharashtra, India. |
| **11.** | Names, Addresses & Nationalities of owners of various rights | **Dr. Nitin Hiralal Sonare** (100% sole copyright ownership) |
| **12.** | Whether work is an original work or adaptation? | **Original Work** |

---

### Statement of Further Particulars (SoFP) - Computer Software Specific

| Question | Answer |
| :--- | :--- |
| **Is the software an original computer programme?** | Yes, developed from first principles with custom data models, cryptographic prescription verification, and localized clinical UI. |
| **Programming Language(s)** | TypeScript (ES2022+), React 19, Next.js App Router, SQLite SQL. |
| **Source Code vs Object Code** | Both Source Code and compiled JavaScript runtime are deposited. |
| **Operating System & Hardware Environment** | Linux POSIX Operating System (x86_64, aarch64), running standalone single-tenant server bound to local loopback and Flatpak desktop container. |
| **Database System** | Local SQLite (`better-sqlite3`) with WAL journal mode and POSIX `0600` access boundaries. |
| **Key Functional Algorithms** | 1. Local HMAC-SHA256 prescription tamper-evident cryptographic sealing (`DigitalRxSeal`).<br>2. Real-time deterministic drug-drug contraindication matrix.<br>3. Offline ICD-10 diagnostic indexing and categorization engine. |

---

### Source Code Deposit Instructions for Copyright Office:
Under Indian copyright filing standards:
1. Run `node scripts/generate-copyright-deposit.js` to create the standardized source code document.
2. The Copyright Office requires a PDF submission containing the **first 20 pages** and **last 20 pages** of source code without blocking out functional logic.
3. Submit Form XIV and upload the generated PDF on [copyright.gov.in](https://copyright.gov.in).
4. Pay statutory government fee of ₹500 via Bharatkosh payment gateway.
5. You will receive a **Diary Number** immediately. A 30-day mandatory waiting period applies for third-party objections, followed by scrutiny and issuance of the **Copyright Registration Certificate**.
