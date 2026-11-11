# JobFill BD v2.0.0 — Microsoft Edge Add-ons Store Compliance Audit & Certification Report

**Release Mode:** Option A — Local-Only First Public Release (`v2.0.0`, `__JOBFILL_CLOUD_SYNC_DISABLED__=true`)  
**Audit Date:** November 11, 2026  
**Publisher:** MR Software Studio ([mahfuzar148@gmail.com](mailto:mahfuzar148@gmail.com))  
**Public Privacy Policy URL:** `https://mahfuzar148.github.io/jobfill-bd-privacy/` (`HTTP/1.1 200 OK`, SHA-256 `5081f81ed088b02739e610bc06adf04e83411523364d1b5d50b8bffb6f8ec7ba`)  
**Edge Production Package:** `D:\Job form Fill-up extension\release\JobFill-BD-Edge.zip` (`399,535` bytes, SHA-256 `db08aa45f1c3ed99ad8adebf5b81edfa94812e93a02557d2306ee171aad52732`)  
**Chrome Store Compatible Package:** `D:\Job form Fill-up extension\release\chrome\JobFill-BD-Chrome.zip` (`399,535` bytes, SHA-256 `3b4053d2bc5f9ba2aac4362b525e7bab1316263360608fdf49dd48194c95426c`)

---

## Executive Compliance Matrix (Sections A–J)

| Section | Compliance Area | Status | Summary of Observed Evidence |
| :--- | :--- | :---: | :--- |
| **A** | Local-Only Storage & Cloud Sync Isolation (`v2.0.0`) | **PASS** | `build.js` sets `isCloudSyncDisabled = true` across `dist/`, Chrome, and Edge builds (`JOBFILL_ENABLE_CLOUD_SYNC !== '1'`); `src/jobs/background/job-check-service.ts` compile-time guards `fetchApprovedPublicJobsPage`; `0` Supabase URLs or UI controls remain in any compiled `.js` bundle. |
| **B** | Data Security, Local Encryption & Logging Hygiene | **PASS** | IndexedDB (`JobFillBD_SecureStorage`) encrypts profiles, `education_records`, `experience_records`, and `documents` via Web Crypto AES-256-GCM; Master Password uses PBKDF2-SHA256 (`100,000` iterations) without writing raw passwords/keys; console logs omit NID/phones/documents. |
| **C** | Least-Privilege Manifest V3 Permissions | **PASS** | Removed `"tabs"` (`"Read your browsing history"`) and unused `https://*.edu.bd/*`; declared `permissions`: `storage`, `activeTab`, `scripting`, `alarms`, `notifications` plus `15` `host_permissions` and `optional_host_permissions`; identical MV3 parity verified between Chrome and Edge builds. |
| **D** | Site Exclusions, WebRTC Safety & User-in-the-Loop Autofill | **PASS** | `15` `exclude_matches` patterns in `manifest.json` + runtime `isExcludedSiteUrl()` in `src/security/site-policy.ts`; verified `0` DOM nodes injected on Google Meet, Zoom, and YouTube in Edge E2E; explicit unencrypted HTTP prompt + never auto-clicks Submit/Pay/CAPTCHA. |
| **E** | Privacy Policy Accuracy & Synchronization | **PASS** | `privacy-policy-site/index.html` pushed to `Mahfuzar148/jobfill-bd-privacy` (`main`, commit `18f757f`) and served live at `https://mahfuzar148.github.io/jobfill-bd-privacy/` (`HTTP 200 OK`); byte-for-byte identical SHA-256 (`5081f8...ec7ba`) across live GitHub Pages, `privacy.html`, Edge ZIP, and Chrome ZIP. Zero claims of active Cloud Sync. |
| **F** | Live Network Audit Across 8 Workflows (`Edge 157`) | **PASS** | Tested extracted `release/JobFill-BD-Edge.zip` in `msedge.exe` `157.0.4341.46` (Edge `157.0.0.0`) with Playwright + SW CDP listeners across fresh install, profile edit, photo/signature upload, Teletalk autofill, job circular refresh, backup export/restore, browser restart, and Meet/Zoom: `77` captured requests, `0` Supabase requests, `0` unknown third-party requests, `0` cookies or PII in job GETs, `0` errors. |
| **G** | Store Packaging & Visual Asset Parity | **PASS** | `npm run build:stores` and `npm run validate:stores` passed cleanly: `manifest.json` at ZIP root, `19` POSIX forward-slash entries per ZIP, `0` `.map`/`test-pages`/`node_modules`/`.env` leaks, verified `300x300`, `128x128`, `440x280`, `1400x560`, and `1280x800` PNGs. |
| **H** | Unit, Security & DOM Integration Regression (`Vitest`) | **PASS** | `npm run typecheck`, `npm run lint` (`212` source files), and `npx vitest run --maxWorkers=2` passed `43/43` test files (`265/265` tests). |
| **I** | Microsoft Edge End-to-End Runtime Verification | **PASS** | `node scripts/verify-edge-e2e.mjs` passed cleanly against both unpacked `dist/` and extracted `release/JobFill-BD-Edge.zip` (including `TabManager.openOrFocusDashboard` single-tab focus without `"tabs"` permission and zero console/SW/page errors). |
| **J** | Google Chrome Automated CLI E2E Verification | **BLOCKED** | Branded Google Chrome (`157.0.8103.40`, M137+) blocks automated CLI `--load-extension` launches (`CHROME Background Service Worker failed to start`); Chrome MV3 compatibility relies on build/audit/manifest parity + JS unit suite (`PASS`), while manual `chrome://extensions` Developer Mode loading was not executed in an interactive GUI session. |

---

## Detailed Evidence & Verification Notes

### A–B. Local-Only Isolation & Vault Cryptography
- **Feature Flag Enforcement ([`build.js`](file:///D:/Job%20form%20Fill-up%20extension/build.js)):** `isCloudSyncDisabled = process.env.JOBFILL_ENABLE_CLOUD_SYNC !== '1'` injects `__JOBFILL_CLOUD_SYNC_DISABLED__ = true` into Dashboard, Popup, Background Service Worker, and Content Script across `dist/`, Chrome Store, and Edge Store targets.
- **Dead-Code Elimination Audit (`0` Bundle Leaks):** Scanning every compiled `.js` file under `dist/`, `release/chrome/unpacked/`, and `release/edge/unpacked/` returned `0` occurrences of `supabase.co`, `user_vault_blobs`, `user_sync_devices`, `auth/v1/signup`, `Enable Cloud Sync`, and `Supabase Project URL`.
- **Vault Security (`SecurityPage.tsx`, `HelpSupportPage.tsx`):** Updated all user-facing notices to state **First Public Release v2.0.0 — Local-Only Mode (Cloud Sync Disabled)** consistently across Chrome and Edge builds.

### C. Manifest V3 Permissions & Least-Privilege Reduction
- **Final Declared Permissions (`manifest.json`):** `storage`, `activeTab`, `scripting`, `alarms`, `notifications` (`"tabs"` removed cleanly; `TabManager.openOrFocusDashboard` in `src/background/tab-manager.ts` uses `chrome.runtime.getContexts({ contextTypes: ['TAB'] })` + `chrome.tabs.get()` cleanly without duplicate dashboard tabs).
- **Host Scope:** Removed unused `https://*.edu.bd/*` from `host_permissions`, `content_scripts.matches`, and `web_accessible_resources.matches` (`15` recruitment/public feed `host_permissions` retained, plus on-demand `optional_host_permissions` `["https://*/*", "http://*/*"]` and `15` `exclude_matches` exclusions).

### E. Live Public Privacy Policy Verification (`HTTP 200 OK`)
- **Live URL:** `https://mahfuzar148.github.io/jobfill-bd-privacy/` (`Last-Modified: Wed, 11 Nov 2026 15:36:42 GMT`, `Content-Length: 35562`, `HTTP/1.1 200 OK` via unauthenticated `curl.exe`).
- **Automated Responsive & Security Validation (`validate_privacy_site.mjs`):** `17` sections, `0` `<script>` tags, `0` `<form>` inputs, `0` cookies, `0` external JS/font requests, `0` horizontal overflow at desktop (`1280×800`) and mobile (`375×812`).

### F. Live Network Audit Summary (Extracted `release/JobFill-BD-Edge.zip` in Edge `157.0.0.0`)
- **Captured Traffic:** `77` HTTP requests across all 8 workflows (`74` read-only `GET` public circular/feed requests across `21` approved job/feed hostnames during Scenario 5 refresh, plus `3` local Playwright-intercepted mock test navigations to `mockportal.teletalk.com.bd`, `meet.google.com`, and `us06web.zoom.us`).
- **Zero Leakage Proof:**
  - `supabaseRequestCount`: `0`
  - `unknownThirdPartyCount`: `0`
  - `nonGetJobRequestCount`: `0`
  - `jobRequestsWithCookiesCount`: `0`
  - `piiLeakRequestCount`: `0`
  - `persistedAcrossBrowserRestart`: `true`
  - `meetDomCount`: `0`, `zoomDomCount`: `0`
  - `consoleErrors`: `[]`, `pageErrors`: `[]`

---

## Final Release Acceptance Checklist

- [x] Option A Local-Only First Release enforced across all `v2.0.0` builds (`__JOBFILL_CLOUD_SYNC_DISABLED__=true`).
- [x] Broad `"tabs"` permission and unused `https://*.edu.bd/*` wildcard removed and verified in Edge E2E.
- [x] Zero Supabase UI, login/signup flows, or endpoints present in compiled bundles or runtime requests.
- [x] Live GitHub Pages Privacy Policy (`https://mahfuzar148.github.io/jobfill-bd-privacy/`) and internal `privacy.html` updated, byte-for-byte identical, and verified `HTTP/1.1 200 OK` without login.
- [x] `typecheck`, `lint`, `vitest` (`43/43` files, `265/265` tests), `build`, `build:stores`, `validate:stores`, Edge E2E, and 8-scenario Network Audit all passed cleanly.
- [x] Production `release/JobFill-BD-Edge.zip` ready for manual upload to Microsoft Partner Center (no automated store upload performed).
