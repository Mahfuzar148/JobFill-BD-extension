# 🔒 JobFill BD — Privacy Policy & Data Protection Declaration
**Document:** `docs/PRIVACY_POLICY.md` (Synced with [privacy.html](../privacy.html) and [MR Software Studio Privacy Site](https://mahfuzar148.github.io/jobfill-bd-privacy/))  
**Effective Date & Last Updated:** November 11, 2026  
**Product:** JobFill BD Browser Extension (`v2.0.0`, Manifest V3 — Google Chrome & Microsoft Edge)  
**Publisher:** MR Software Studio ([mahfuzar148@gmail.com](mailto:mahfuzar148@gmail.com))

---

## 1. Core Architecture: Local-Only First Public Release (`v2.0.0`)

JobFill BD is engineered on a **Local-First, user-owned vault architecture**. Your sensitive personal credentials, family/address details, academic history, work records, uploaded photos/signatures/certificates, bookmarks, application status tracker notes, and masked autofill history belong solely to you.

- **First Public Release Mode (`v2.0.0`, `__JOBFILL_CLOUD_SYNC_DISABLED__=true` across ALL builds):** Cloud Sync, user registration/login, and Supabase endpoints are **disabled at compile time and unreachable at runtime** in both Google Chrome and Microsoft Edge Add-ons Store `v2.0.0` releases. Personal profiles, documents, bookmarks, and autofill logs remain strictly inside your browser's local storage unless you export a local JSON backup or manually submit a third-party recruitment form.
- **Public Job Circular Retrieval Requires Internet Access:** Background and manual job circular discovery executes unauthenticated read-only HTTP `GET` requests (`credentials: 'omit'`) to `13` configured official/public portals and feeds with **zero** saved profile data (apart from an optional user-configured ReliefWeb `appname` query parameter if entered in Settings).
- **No Analytics, Telemetry, Ads, or External AI SDKs:** All DOM scanning and form-matching run deterministically inside your browser with zero tracking pixels, telemetry SDKs, remote fonts, or advertising brokers.

---

## 2. Categories of Data & Handling Model

| Data Category | Storage & Transmission Scope | Encryption & Controls |
| :--- | :--- | :--- |
| **A. Personal, Health/Disability & Address Profile (`encrypted_vault`)** | Local IndexedDB (`JobFillBD_SecureStorage`) | AES-256-GCM via non-extractable device `CryptoKey`, or PBKDF2-SHA256 (`100,000` iterations) Master Vault Password. |
| **B. Education & Employment (`education_records`, `experience_records`)** | Local IndexedDB (`JobFillBD_SecureStorage`) | Individually encrypted AES-256-GCM rows (`isEncrypted: true`). |
| **C. Uploaded Documents, Photos & Signatures (`documents`)** | Strictly Local IndexedDB (`v2.0.0`) | AES-256-GCM encrypted (`dataUrl` omitted at rest); resized locally via HTML5 Canvas; transferred to page inputs only on explicit user approval (`GET_APPROVED_DOCUMENT_PAYLOAD`). |
| **D. Autofill Logs & Selector Memory (`history`, `jobfill_adaptive_mapping_memory`)** | Strictly Local Browser Storage | `history` caps at `100` sessions, masks NID/passport/birthReg to last 4 chars, strips query/hash params; selector memory saves structural CSS signatures without field values. |
| **E. Bookmarks, Applications & Notifications (`bookmarks`, `applications`, `notifications`)** | Strictly Local IndexedDB (`v2.0.0`) | Driven by local `chrome.alarms` & `chrome.notifications`. |
| **F. Public Job Circular Discovery** | Read-only public `GET` requests requiring Internet access | `credentials: 'omit'`, zero user PII, automatically halts on CAPTCHA/anti-bot challenge pages. |
| **G. Webpage Form Filling** | User-initiated / matching portals in active tab | Deterministic local scan; explicit warning before sensitive fields on unencrypted `http://`; never clicks Submit/Pay or bypasses CAPTCHA/OTP. |
| **H. Cloud Sync & Remote Accounts (`v2.0.0`)** | Disabled & Inactive across all `v2.0.0` store builds | `__JOBFILL_CLOUD_SYNC_DISABLED__=true`; dead-code eliminated from production bundles; zero cloud endpoints contacted. |

---

## 3. Strict Exclusions & Safety Boundaries

- **Excluded Surfaces:** `meet.google.com`, `*.meet.google.com`, `zoom.us`, `*.zoom.us`, `zoom.com`, `*.zoom.com`, Google Mail/Drive/Calendar/Docs/Auth, and YouTube pages are excluded in both `manifest.json` (`15` rules) and `site-policy.ts`.
- **Zero WebRTC / Page Request Interception:** JobFill BD never hooks `getUserMedia`, `getDisplayMedia`, `RTCPeerConnection`, `window.fetch`, `XMLHttpRequest`, or `navigator.sendBeacon`.
- **Zero Browser History / Cookies / Geolocation Access:** Never accesses `chrome.history`, `chrome.cookies`, `navigator.geolocation`, or personal messages.

---

## 4. User Rights, Deletion & Support

- **Local Backups:** Export/import plaintext or PBKDF2 + AES-256-GCM password-encrypted `.json` profile backups locally from **Security & Backup**.
- **Permanent Local Deletion:** Use **Delete Local Private Vault Data** or **Purge All Profiles & Data** inside **Security & Backup**, or uninstall the extension.
- **Contact & Support:** MR Software Studio — [mahfuzar148@gmail.com](mailto:mahfuzar148@gmail.com) | Public Policy: <https://mahfuzar148.github.io/jobfill-bd-privacy/>
