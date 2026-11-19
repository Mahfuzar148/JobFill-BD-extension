# JobFill BD — Career Assistant Technical Architecture & QA Notes

> **Status:** Development branch (`feat/career-assistant-evolution`). Production store release archives (`release/JobFill-BD-Edge.zip` and `release/chrome/JobFill-BD-Chrome.zip`) remain strictly unmodified.

## 1. Product Identity & Modes
- **Product Name:** JobFill BD (`MR Software Studio`)
- **Tagline:** Your Smart Career & Job Application Assistant
- **Integrated Modes (`AppContext`):** `student` and `job_seeker`, persisted in `localStorage` (`jobfill_user_mode`). Shared IndexedDB stores prevent database duplication and keep all capabilities accessible in both modes.

## 2. Security, Privacy & Local-Only Credential Vault (`src/credentials/`)
- **IndexedDB Store:** `credential_vault` (`DB_VERSION = 10` additive schema).
- **Zero Cloud Sync Participation:** `EncryptedSyncService` (`src/cloud/encrypted-sync-service.ts`) strictly syncs `profiles`, `bookmarks`, and `applications`. Credentials and local documents never participate in Cloud Sync, Edge builds (`__JOBFILL_CLOUD_SYNC_DISABLED__ = true`), or remote job APIs.
- **Cryptography:** PBKDF2-HMAC-SHA256 (`210,000` iterations) with CSPRNG 16-byte random salts + Web Crypto AES-256-GCM with fresh 12-byte IVs per encryption write. Non-extractable session key kept in volatile memory only until lock or configurable auto-lock timeout (`5` / `10` / `15` / `30` min).
- **Origin Enforcement:** Strict exact HTTPS equality (`isStrictOriginMatch`); rejects HTTP, punycode lookalikes, subdomains, embedded credentials, and substring matching. Explicit user confirmation required before autofill; no silent credential harvesting.
- **Recovery Limitation:** Master Vault Passwords are never stored; if forgotten, stored credentials cannot be recovered automatically without a user-saved encrypted backup JSON and its backup passphrase.

## 3. Core Career & Application Modules
- **Smart Autofill & Document Engine:** Preserves existing 5-layer matching, BOGMC/Teletalk SSC/HSC disambiguation, dependent cascading selects, React `_valueTracker`, strict safety boundaries (never auto-accepts legal declarations or bypasses CAPTCHA/OTP), and Meet/Zoom/YouTube `exclude_matches` isolation.
- **Unified Student & Job Seeker Profile:** Extends `UserProfile` with optional `StudentCareerProfile` (level, department, passing year, skills, languages, projects, achievements, career interests, preferred categories/locations, internship toggle, expected salary note) reused by CV Builder, Career Planner, and Skills Gap Analyzer.
- **Bilingual Eligibility Checker (`src/jobs/services/eligibility-helper.ts`):** Handles English/Bengali digits and age cutoffs, never extrapolates dropdown defaults (`Dhaka`, `SSC`) as filled education, and labels incomplete conditions `NEEDS_MANUAL_VERIFICATION`.
- **Application Readiness Checker (`src/readiness/readiness-checker.ts`):** Audits personal fields, real academic records, 300×300 photo, 300×80 signature, certificates, eligibility, and manual review checkboxes (never auto-submits or auto-checks declarations).
- **Application & Fee Payment Tracker (`src/jobs/dashboard/ApplicationTracker.tsx`):** Supports expanded statuses, manual entry, CSV/JSON merge-restore, TXN references, application fee notes, and payment dates with zero storage of bank passwords, card PINs, MFS PINs, or OTPs.
- **Document Validity Tracker (`src/database/document-repository.ts` & `DocumentsPage.tsx`):** Optional `expiresAt` (`YYYY-MM-DD`) strictly restricted to applicable time-limited records (`other` licenses/training certs); explicitly rejects expiration dates on academic certificates.
- **Notifications & Career Calendar (`src/calendar/career-calendar.ts` & `NotificationScheduler`):** Unified `Asia/Dhaka` calendar linking circular deadlines (verified/unverified flags), tracker exams/interviews/admit/results, document expiries, custom study reminders, `.ICS` export, and deterministic deduplication. Browser alarm delivery respects Chrome/Edge MV3 sleep/close caveats.
- **Multi-Version ATS CV Builder (`src/cv/`):** English and Bengali Unicode A4 templates (`ats_classic`, `academic_bd`, `modern_compact`), persisted in `cv_documents` with browser Print / Save as PDF generation (zero external uploads or font CDNs).

## 4. Source Verification, Intelligence & Learning Modules
- **Official Source Tiers, Duplicate Clusters & Scam Awareness (`src/jobs/services/scam-awareness.ts`):** Classifies 5 verification tiers (`Official Organization Website`, `Official Recruitment Portal`, `Official Circular Document`, `Secondary Discovery Source`, `Unverified Discovery`), flags objective HTTP/MFS-fee/mismatch warning signals with evidence without making fraud accusations, and exposes duplicate clusters without merging distinct notices.
- **Job Comparison & Published Salary Breakdown (`src/jobs/services/job-comparison.ts`):** Side-by-side matrix displaying `'Not Available'` / `'Salary not disclosed'` when omitted; optional deduction estimator is explicitly labeled `'User Assumption Only'`.
- **Scholarships, Internships & Student Hub (`src/opportunities/`):** Categorizes real records and verified manual entries without inventing links or mixing categories.
- **Career Path Planner & Skills Gap Analyzer (`src/career/career-planner.ts`):** Matches saved skills/interests transparently as advisory suggestions only, compares explicitly extracted circular skills without inventing mandatory requirements, and persists personal career goals in `study_notes`.
- **Exam Practice, Vocabulary SRS & Interview Prep (`src/exam/`, `src/career/interview-prep.ts`):** Covers all 8 BD recruitment subjects with validated curated practice banks explicitly marked `isOfficialPastPaper: false`, subject analytics, spaced-repetition vocabulary cards, and sample viva outlines with personal answer notes.

## 5. IndexedDB v10 Additive Schema & Build Packaging
- **IndexedDB `DB_VERSION = 10`:** Additively introduces `calendar_events`, `exam_attempts`, `vocabulary_items`, and `study_notes` alongside existing stores (`profiles`, `credential_vault`, `cv_documents`, `documents`, `jobs`, `bookmarks`, `applications`, `notifications`, etc.) without `deleteObjectStore` or `deleteDatabase`.
- **Development Builds (`scripts/package-dev-builds.mjs`):** Builds isolated `dev-builds/edge/JobFill-BD-Edge-Dev.zip` (Cloud Sync disabled) and `dev-builds/chrome/JobFill-BD-Chrome-Dev.zip` (Cloud Sync enabled), verifying permissions, exclusions, zero secrets/source-maps/test-pages, and verifying unchanged SHA-256 hashes on `release/JobFill-BD-Edge.zip` and `release/chrome/JobFill-BD-Chrome.zip`.
