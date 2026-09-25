# MedScript OPD - Open-Source Publishing & Distribution Guide 🌐

This guide provides step-by-step instructions to publish **MedScript OPD** across major open-source ecosystems so physicians, clinics, and developers worldwide can freely discover, download, and install it.

---

## 1. 🐙 GitHub (Primary Source Repository & Releases)

Publishing to GitHub hosts your source code, enables community contributions, and automatically triggers CI/CD pipelines to build release packages.

### Step 1: Create a New GitHub Repository
1. Log into your account at [github.com](https://github.com).
2. Go to [github.com/new](https://github.com/new).
3. **Repository Name**: `medscript-opd`
4. **Visibility**: `Public`
5. **Important**: Leave "Add a README", ".gitignore", and "License" **UNCHECKED** (we already have customized versions prepared).
6. Click **Create repository**.

### Step 2: Publish with 1 Command
Run the publisher script from your terminal:
```bash
./scripts/publish-to-github.sh
```
*This script will prompt for your GitHub username, set your remote origin, push the `main` branch, and tag `v1.0.0`.*

### Step 3: Automated GitHub Releases
Once you push tag `v1.0.0`, GitHub Actions automatically:
- Tests the build across Node.js 18 and 20.
- Runs `./scripts/package-release.sh`.
- Creates **Release v1.0.0** on GitHub and attaches:
  - `medscript-opd-v1.0.0-linux.tar.gz`
  - `medscript-opd-v1.0.0-windows-portable.zip`

### Step 4: Configure GitHub Repository Details
On your GitHub repository page:
- Click the ⚙️ icon next to **About**:
  - **Description**: `Offline-First Outpatient Prescription & Electronic Medical Records (EMR) System`
  - **Tags / Topics**: `medical`, `emr`, `ehr`, `prescription`, `healthcare`, `doctor`, `clinic`, `offline-first`, `nextjs`, `sqlite`, `flatpak`, `open-source`, `self-hosted`

---

## 2. 📦 Flathub (The Universal Linux App Store)

Flathub allows any Linux user (Ubuntu, Fedora, Arch, Linux Mint, Debian, SteamOS) to install MedScript OPD with one click from GNOME Software, KDE Discover, or the terminal.

We have already created all required Flathub files in `packaging/flatpak/`:
- `io.github.<username>.MedScriptOPD.yml` (Flatpak manifest)
- `io.github.<username>.MedScriptOPD.desktop` (Freedesktop app launcher)
- `io.github.<username>.MedScriptOPD.metainfo.xml` (AppStream software center metadata)
- `io.github.<username>.MedScriptOPD.svg` (Application icon)

### Submission Steps:
1. Fork the official Flathub submission repository: [github.com/flathub/flathub](https://github.com/flathub/flathub).
2. Create a new branch:
   ```bash
   git checkout -b new-app-medscript-opd
   ```
3. Add your `io.github.<username>.MedScriptOPD.yml` manifest to the repository.
4. Open a Pull Request on [github.com/flathub/flathub](https://github.com/flathub/flathub).
5. The Flathub automated bot will test-build the package. Once merged by the Flathub review team, your app will be live at `https://flathub.org/apps/io.github.<username>.MedScriptOPD`!

Users can then install it with:
```bash
flatpak install flathub io.github.<username>.MedScriptOPD
```

---

## 3. 🐳 Docker Hub & GitHub Container Registry (GHCR)

For clinics running local Linux servers, NAS, or Home Assistant setups:

### Publish to Docker Hub:
```bash
# 1. Login to Docker Hub
docker login

# 2. Build the image
docker build -t <your-docker-username>/medscript-opd:latest .
docker tag <your-docker-username>/medscript-opd:latest <your-docker-username>/medscript-opd:1.0.0

# 3. Push to Docker Hub
docker push <your-docker-username>/medscript-opd:latest
docker push <your-docker-username>/medscript-opd:1.0.0
```

Doctors or IT staff can then deploy instantly with:
```bash
docker run -d \
  --name medscript-opd \
  -p 3000:3000 \
  -v medscript_data:/app/data \
  -v medscript_backups:/app/backups \
  --restart unless-stopped \
  <your-docker-username>/medscript-opd:latest
```

---

## 4. 🪟 Windows Package Manager (Winget)

To allow Windows users to install via PowerShell (`winget install MedScript.OPD`):
1. Fork [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs).
2. Use the official `wingetcreate` CLI tool:
   ```powershell
   wingetcreate new https://github.com/<your-username>/medscript-opd/releases/download/v1.0.0/medscript-opd-v1.0.0-windows-portable.zip
   ```
3. Submit the generated pull request to `microsoft/winget-pkgs`.

---

## 5. 🌍 Public Open-Source Indexes & Community Directories

To maximize discovery among doctors and outpatient clinics:

1. **Awesome-Selfhosted**:
   - Repository: [github.com/awesome-selfhosted/awesome-selfhosted](https://github.com/awesome-selfhosted/awesome-selfhosted)
   - Section: **Software Development > Health and Medical / EHR**
   - Submit a PR adding:
     ```markdown
     - [MedScript OPD](https://github.com/<your-username>/medscript-opd) - Offline-first outpatient prescription and electronic medical records (EMR) system. `MIT` `NodeJS/SQLite`
     ```

2. **AlternativeTo**:
   - List MedScript OPD at [alternativeto.net](https://alternativeto.net) as an open-source, privacy-preserving alternative to cloud-only clinic management software (Practo, Kareo, DrChrono, OpenEMR).

3. **Community Forums**:
   - Post an introduction on **Reddit**:
     - `r/selfhosted` (Showcasing the offline, self-contained architecture)
     - `r/opensource`
     - `r/medicine` / `r/JuniorDoctorsUK` / medical tech communities
   - Share on **Hacker News (Show HN)**:
     - `Show HN: MedScript OPD – Offline-first EMR and prescription generator for outpatient clinics`
