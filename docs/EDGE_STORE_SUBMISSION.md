# JobFill BD — Microsoft Edge Add-ons Store Publication Readiness

## 1. Store Listing Overview
- **Extension Name:** JobFill BD — Smart Job Application Assistant
- **Manifest Version:** 3 (`version: 2.0.0`)
- **Primary Functionality:** Assists Bangladeshi job applicants by organizing official public recruitment circulars and semi-automatically filling government and career application forms from the user's locally encrypted device vault, with strict user control over legal declarations and file uploads.

---

## 2. Manifest V3 Permissions & Justification (`manifest.json`)

| Permission / Host Pattern | Why Required (Least-Privilege Justification) |
| :--- | :--- |
| `storage` | Persists non-sensitive extension preferences, vault security metadata (salt/hash/auto-lock timeout), and learned selector fingerprints locally. |
| `activeTab` | Allows user-initiated inspection and autofill on the currently active recruitment portal tab when the user clicks the extension popup or action button. |
| `scripting` | Injects the bundled `content.js` / `content.css` into a user-triggered recruitment tab only after verifying `isExcludedSiteUrl()` is false. |
| `alarms` | Schedules periodic daily public job circular checks (`jobfill_daily_job_check`) and deadline reminder ticks (`jobfill_deadline_scheduler`) using MV3 `chrome.alarms` instead of polling. |
| `notifications` | Delivers user-enabled local deadline reminders and daily digest summaries inside Chrome/Edge Notification Center. |
| `host_permissions` (`*.teletalk.com.bd`, `*.gov.bd`, `*.bb.org.bd`, `*.org.bd`, `*.ac.bd`, `*.bdjobs.com`, public feeds) | Required for read-only background fetching of public Bangladeshi job circulars/notices without transmitting cookies or personal data (`credentials: 'omit'`), plus form autofill on official recruitment portals. Broad `tabs` permission and unused `.edu.bd` wildcard are intentionally omitted. |
| `optional_host_permissions` (`https://*/*`, `http://*/*`) | Requested dynamically via `chrome.permissions.request()` only when a user explicitly opens and activates autofill on a custom career domain outside the default Bangladeshi portal list. Never requests or touches excluded meeting/media origins. |

### Strict Meeting & Media Domain Exclusions (`exclude_matches` & `site-policy.ts`)
`<all_urls>` is **never** declared in `host_permissions`, `content_scripts`, or `web_accessible_resources`.  
Google Meet (`meet.google.com`, `*.meet.google.com`, `hangouts.google.com`, `talkgadget.google.com`, `workspace.google.com`, `accounts.google.com`, `mail.google.com`, `docs.google.com`, `drive.google.com`, `calendar.google.com`), YouTube (`*.youtube.com`), and Zoom (`zoom.us`, `*.zoom.us`, `zoom.com`, `*.zoom.com`) are hard-excluded statically and dynamically. No WebRTC (`getUserMedia`, `getDisplayMedia`, `RTCPeerConnection`, `MediaStream`, `AudioContext`) or network globals (`window.fetch`, `XMLHttpRequest`) are ever overridden or intercepted.

---

## 3. Privacy Policy & Data Handling Disclosure

**Published HTTPS Privacy Policy:** https://mahfuzar148.github.io/jobfill-bd-privacy/  
**Publisher:** MR Software Studio ([mahfuzar148@gmail.com](mailto:mahfuzar148@gmail.com))

### Local-Only First Public Release (`v2.0.0`)
- JobFill BD `v2.0.0` operates strictly in **Local-Only Storage Mode** (`__JOBFILL_CLOUD_SYNC_DISABLED__=true` across both Microsoft Edge Add-ons and Google Chrome Web Store builds). No user account, login, or remote cloud sync is active in this release.
- Personal applicant data (names, parents' names, dates of birth, NID, birth registration, passport details, addresses, blood group / physical measurements / disability quota metadata, academic transcripts, employment history, uploaded photos, signatures, certificates, bookmarks, application tracker notes, and masked autofill history) is stored inside local browser IndexedDB (`JobFillBD_SecureStorage`) encrypted using Web Crypto **AES-256-GCM** (non-extractable device `CryptoKey`, or 100,000-iteration **PBKDF2-SHA256** when a Master Vault Password is enabled).
- Raw passwords and decryption keys are **never stored** in `chrome.storage`, `localStorage`, or `IndexedDB`, and are never transmitted externally.
- Public job circular retrieval requires **Internet access** and performs unauthenticated read-only HTTP `GET` (`credentials: 'omit'`) requests to 13 configured official/public sources without transmitting saved profile data (aside from an optional user-configured ReliefWeb `appname` query parameter if added in Settings).
- Diagnostic counters store **hostname only** in volatile memory (`50` max events).

### Cloud Sync Isolation Notice (`v2.0.0`)
- Future-release Cloud Sync modules (`src/cloud/*`) are preserved behind release flag isolation (`__JOBFILL_CLOUD_SYNC_DISABLED__=true`) in both `release/JobFill-BD-Edge.zip` and `release/chrome/JobFill-BD-Chrome.zip` so Rollup eliminates remote endpoints and zero Supabase signup, login, profile sync, activity sync, or cloud upload requests are reachable or triggered.
- Users can lock the local vault, export/import plaintext or encrypted `.json` profile backups, delete local vault data, or purge all extension storage from **Security & Backup**.

### Recovery Notice
Because vault encryption and backups rely on zero-knowledge client-side cryptography, JobFill BD cannot recover lost Master Vault Passwords if you lose both your password and exported recovery backup files.

---

## 4. CSP & Technical Compliance Notes
- Manifest V3 compliant: zero remote code loading, zero `eval()`, zero `new Function()`.
- All third-party dependencies bundled cleanly offline via Vite (`react`, `react-dom`, `lucide-react`, `zod`).
- Static security verification enforced by `scripts/lint-check.mjs` + TypeScript strict mode.

## 5. Pre-Submission Release Notes (Chrome Web Store + Microsoft Edge Add-ons)
1. **Store-Clean Packages (`npm run build:edge-store` / `npm run build:stores`):** Clean store packages are built with `__JOBFILL_STORE_CLEAN__=true` and `__JOBFILL_CLOUD_SYNC_DISABLED__=true`, zero developer/test PII, no remote fonts, and no `test-pages/*`, `localhost`, `tabs` permission, or `.edu.bd` wildcard.
2. **Hosted Public Privacy Policy:** Published live at `https://mahfuzar148.github.io/jobfill-bd-privacy/` and mirrored byte-for-byte internally via `privacy.html` (strictly describing `v2.0.0` Local-Only Storage Mode).
3. **Store Review Boundary:** Final submission to Microsoft Partner Center is held pending publisher action.
