# Contributing to MedScript OPD

Thank you for your interest in contributing to **MedScript OPD**! We welcome doctors, software engineers, and health-tech enthusiasts who wish to help build an accessible, private, and high-performance outpatient clinical management system.

---

## Code of Conduct
We are committed to providing a friendly, safe, and welcoming environment for everyone, regardless of background, identity, or technical experience. Please treat all contributors with respect.

---

## How Can You Contribute?
- 🐛 **Report Bugs**: If you find an issue or unexpected behavior, open an issue using our Bug Report template.
- 💡 **Suggest Features**: Share suggestions for clinical workflows, drug formatting, diagnostic panels, or usability improvements.
- 💻 **Submit Pull Requests**: Implement bug fixes, performance improvements, or new features.
- 📚 **Documentation**: Improve guides, translations, clinical templates, or setup instructions.

---

## Development Setup

### 1. Prerequisites
- **Node.js** v18 or v20+ (Node v20 LTS recommended)
- **npm** v9+
- **Git**

### 2. Clone & Install
```bash
git clone https://github.com/medscript/medscript-opd.git
cd medscript-opd
npm install
```

### 3. Initialize Development Database
```bash
npm run db:seed
```
This populates a sample clinic profile and test patients in `sqlite.db`.

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Quality Standards & Guidelines

Before submitting a Pull Request, ensure that:

1. **TypeScript Type-check passes**:
   ```bash
   npx tsc --noEmit
   ```
2. **ESLint passes with 0 errors**:
   ```bash
   npm run lint
   ```
3. **Production build succeeds**:
   ```bash
   npm run build
   ```
4. **Medical Privacy Principle**:
   - MedScript OPD is strictly **offline-first**.
   - No patient identifiable information (PHI) should ever be transmitted to third-party tracking services or external cloud APIs without explicit user consent.
   - All database operations must keep local SQLite durability and strict POSIX permissions in mind.

---

## Pull Request Process

1. Fork the repository and create your branch from `master`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes and commit with meaningful commit messages:
   ```bash
   git commit -m "feat(rx): add pediatric dosage calculator helper"
   ```
3. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
4. Open a Pull Request against the `master` branch of `medscript/medscript-opd`.
5. Clearly describe what changed and link any relevant issues.

---

## License
By contributing to MedScript OPD, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
