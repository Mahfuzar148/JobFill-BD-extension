# JobFill BD — Smart Bangladesh Government Job Application Assistant

> A privacy-first, intelligent Chrome Extension (Manifest V3) designed to securely store job applicant credentials and automatically, accurately populate Bangladesh Government recruitment portals (PetroBangla, Teletalk, BPSC, Ministries, Autonomous Bodies).

![JobFill BD Banner](https://img.shields.io/badge/Manifest-V3-16a34a?style=for-the-badge&logo=googlechrome)
![React](https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=for-the-badge&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38bdf8?style=for-the-badge&logo=tailwindcss)
![Security](https://img.shields.io/badge/Local%20Encryption-AES--GCM-darkgreen?style=for-the-badge)

---

## 🌟 Key Features

- **One-Time Comprehensive Profile:** Store Personal (English/Bangla), Address, SSC, HSC, Graduation, Masters, Experience, Special/BCS, and References.
- **Full Dashboard Tab Experience:** Clicking the extension icon opens a comprehensive, modern dashboard with sidebar navigation, profile completion progress tracker, and form validation.
- **Smart Weighted Field Detection:** Inspects HTML names, IDs, Bangla/English labels, placeholders, ARIA tags, and section boundary context.
- **Contextual Disambiguation:** Never confuses "Name" (Applicant vs Father vs Mother) or "Roll Number" (SSC vs HSC vs Graduation).
- **Smart Dropdown & Dependent Dropdown Matching:** Normalized Bengali-English equivalents (Dhaka = ঢাকা, Male = পুরুষ, Single = Unmarried) and Cascading selections (Division -> District -> Upazila).
- **In-Page Interactive Assistant:** Floating non-intrusive widget on job application pages with an interactive Review & Approval modal.
- **Strict Safety Guarantee:** Never clicks Submit, Final Submit, Pay Now, or irreversible actions; warns before autofilling sensitive fields on unencrypted `http://` sites.
- **Local-First Encrypted Vault:** Profiles and documents are stored locally inside IndexedDB encrypted via Web Crypto AES-256-GCM (non-extractable device key or optional PBKDF2-SHA256 Master Password). Optional Supabase cloud sync is disabled by default and uploads only E2EE `profiles_bundle` ciphertext (documents stay local-only in v2.0.0).
- **Zero-PII Job Discovery Hub:** Checks Bangladeshi official portals & public sources via unauthenticated read-only `GET` (`credentials: 'omit'`) with strict anti-bot/CAPTCHA compliance (halting automatically and guiding manual portal verification).
- **Meeting & Sensitive Site Exclusion:** Strictly excludes `meet.google.com`, `zoom.us`, `zoom.com`, and Google Auth/Mail/Drive/Docs at manifest and runtime levels.
- **One Codebase, Two Stores:** Built cleanly for both **Google Chrome Web Store** (`npm run build:chrome-store`) and **Microsoft Edge Add-ons Store** (`npm run build:edge-store`).

---

## 🚀 Quick Setup, Build & Browser Loading

### 1. Build Commands
```bash
cd "D:\Job form Fill-up extension"
npm install
npm run build            # Development unpacked build -> dist/
npm run build:stores     # Store-ready Chrome & Edge packages -> release/chrome & release/edge
npm run validate:stores  # Validate manifests, CSP, PII-free store bundles, and ZIPs
```

### 2. Load Unpacked in Chrome / Edge
1. Open `chrome://extensions/` (Google Chrome) or `edge://extensions/` (Microsoft Edge).
2. Enable **Developer mode**.
3. Click **Load unpacked** and select `D:\Job form Fill-up extension\dist` (or `release/chrome/unpacked` / `release/edge/unpacked`).
4. Pin **JobFill BD** to the browser toolbar.

---

## 📖 Comprehensive Documentation

For complete technical specifications, profile field schema, matching algorithms, and security details, please refer to:
👉 **[DOCUMENTATION.md](./DOCUMENTATION.md)**

---

## 🧪 Local Test Pages Included

Verify all features on built-in offline test pages in `test-pages/`:
1. `petrobangla-form.html` — Faithful replica of the 4 PetroBangla application screenshots.
2. `teletalk-form.html` — Standard Teletalk recruitment CV format.
3. `bpsc-bcs-form.html` — BPSC 47th BCS Form-1 simulation.
4. `dependent-dropdown.html` — Cascading Division -> District -> Upazila interactive test.

---
*Created with ❤️ for job seekers across Bangladesh.*
