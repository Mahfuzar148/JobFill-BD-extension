# JobFill BD — Career Assistant Architecture & Security Notes

> **Status:** Development branch (`feat/career-assistant-evolution`). Production store release archives (`release/JobFill-BD-Edge.zip` and `release/chrome/JobFill-BD-Chrome.zip`) remain unmodified.

## 1. Product Identity & User Modes
- **Product Name:** JobFill BD by MR Software Studio
- **Subtitle:** Your Smart Career & Job Application Assistant
- **Integrated Workspace Modes (`AppContext`):**
  - `job_seeker` (`Job Seeker` / `চাকরিপ্রার্থী`)
  - `student` (`Student Mode` / `ছাত্রছাত্রী মোড`)
  - Mode switching adapts overview emphasis cleanly in UI (`OverviewPage.tsx`) without hiding or locking any core tools (`Credential Vault`, `Eligibility Checker`, `Application Tracker`, `CV Builder`, `Job Circular Hub`).

## 2. Local-Only Credential Vault (`src/credentials/`)
- **Strict Local-Only Isolation:** Credential records are stored exclusively in browser IndexedDB store `credential_vault` (`DB_VERSION = 9`).
- **Cloud Sync Exclusion:** `EncryptedSyncService` (`src/cloud/encrypted-sync-service.ts`) synchronizes **only** `profiles`, `bookmarks`, and `applications`. Credentials are **never** serialized into sync payloads, Chrome Sync storage, external APIs, or Microsoft Edge builds (where Cloud Sync itself is compiled out).
- **Cryptography:**
  - Key derivation: PBKDF2-HMAC-SHA256 with `210,000` iterations and per-record / per-verifier CSPRNG 16-byte salts (`deriveMasterVaultCryptoKey`).
  - Cipher: AES-256-GCM with fresh CSPRNG 12-byte IV per encryption write.
  - Auto-lock: Non-extractable in-memory `CryptoKey` in Dashboard runtime with configurable idle auto-lock (`5` / `15` / `30` / `60` min) and manual lock.
- **No Master Password Recovery:** If the Master Vault Password is forgotten, encrypted credentials cannot be decrypted or recovered without a user-saved encrypted JSON backup file and its backup passphrase.
- **Autofill Safety:**
  - Origin matching uses strict exact HTTPS origin equality (`isStrictOriginMatch`); HTTP pages, punycode lookalikes, embedded credentials, subdomains, and substring matches are rejected.
  - Zero automatic form fill or automatic form submit; login fill requires explicit user action via extension UI (`FILL_CREDENTIAL_LOGIN` from trusted extension-origin IPC only).

## 3. Bilingual Eligibility Checker (`src/jobs/services/eligibility-helper.ts`)
- Parses Bangla and English age ranges (including Bengali numeral normalization `০-৯ -> 0-9`), GPA thresholds (including 5.0 vs 4.0 scale comparison), quota notes, and education requirements from real loaded circular metadata.
- Three explicit outcomes: `ELIGIBLE`, `NOT_ELIGIBLE`, and `NEEDS_MANUAL_VERIFICATION`.
- Never fabricates missing rules or extrapolates completeness from template defaults: incomplete profiles report missing fields rather than false rejection or false eligibility.
- Always advises applicants to verify the official circular PDF/source before paying fees or submitting applications.

## 4. Application Tracker & Notifications (`src/jobs/`)
- Extended statuses include `Applied`, `Payment Pending`, `Payment Completed`, `Admit Card Available`, `Written Exam`, `Viva`, `Result Published`, `Offered`, `Rejected`, `Archived`.
- Manual application entry and JSON Merge-Restore (`ApplicationRepository.restoreBackupMerge`) append/update entries without wiping existing tracker records.
- Notification scheduler (`NotificationScheduler`) triggers deduplicated reminders for closing circulars and tracker exam/admit-card/result states using `chrome.alarms` / `chrome.notifications`.
- **Browser Delivery Limitation:** Chrome/Edge MV3 service worker alarms cannot fire while the browser is completely closed or the device is sleeping; missed alarms catch up only when the browser wakes/restarts.

## 5. Multi-Version Local-First ATS CV Builder (`src/cv/`)
- Stored locally in IndexedDB `cv_documents` (`DB_VERSION = 9`).
- Pre-fills drafts from local applicant profile and renders clean printable A4 HTML (`buildAtsCvHtml`) for English and Bengali Unicode resumes via the browser's Print / Save as PDF dialog (no external font CDNs or cloud PDF APIs).

## 6. IndexedDB Schema Upgrade & Packaging
- **IndexedDB `DB_VERSION = 9`:** Adds `credential_vault` and `cv_documents` additively alongside all existing `v8` stores (`profiles`, `job_listings`, `job_bookmarks`, `job_applications`, `job_notifications`, etc.) without dropping or resetting user data.
- **Development Packaging:** Separate developer packages are generated into `dev-builds/` via `node scripts/package-dev-builds.mjs` (`JobFill-BD-Edge-Dev.zip` with Cloud Sync disabled, `JobFill-BD-Chrome-Dev.zip` with Cloud Sync enabled) so production packages under `release/` remain untouched.
