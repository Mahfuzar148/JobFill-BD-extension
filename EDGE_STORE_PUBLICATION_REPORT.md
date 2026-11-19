# JobFill BD — Microsoft Edge Add-ons Store Publication Report (v2.0.1)

**Date of Submission:** November 19, 2026  
**Product Name:** JobFill BD  
**Release Version:** `2.0.1`  
**Git Branch:** `feat/complete-system-integration-audit`  
**Target ZIP File:** [release/JobFill-BD-Edge-v2.0.1.zip](file:///D:/Job%20form%20Fill-up%20extension/release/JobFill-BD-Edge-v2.0.1.zip)  
**Package File Size:** 846,162 bytes (0.81 MB)  
**Package SHA-256 Checksum:** `88A0799BE54893430AFBDBED863B538B7CAE740E3E2EE1FF5B5F69BC676925D7`  
**Submission Confirmation Evidence:** [edge_store_in_review_confirmation.png](file:///C:/Users/mahfu/.gemini/antigravity/brain/05e510eb-24f6-4805-b4cf-c419eb0db7d3/edge_store_in_review_confirmation.png)

---

## 1. Store & Submission Identifiers

| Identifier Key | Value |
|:---|:---|
| **Product ID** | `eb526695-67c1-4f54-ada8-63d13302630a` |
| **Store ID** | `0RDCK9KG03MN` |
| **CRX ID** | `codkdflmgahpbdhadkblabeihgknjnda` |
| **Public Store URL** | `https://microsoftedge.microsoft.com/addons/detail/codkdflmgahpbdhadkblabeihgknjnda` |
| **Partner Center Portal** | `https://partner.microsoft.com/en-us/dashboard/microsoftedge/eb526695-67c1-4f54-ada8-63d13302630a/packages/dashboard` |

---

## 2. Official Microsoft Partner Center Submission Status

```
========================================================================================
  EXTENSION STATUS: IN REVIEW
  Update — JobFill BD Version 2.0.1
  Status: In review
  Notice: "Microsoft is reviewing your submission currently. Expect to hear back from us in 7 business days."
  Category: Productivity | Visibility: Public | Languages: English (United States)
========================================================================================
```

### Full Release Stage Breakdown:

| Stage | Status | Evidentiary Basis |
|:---|:---:|:---|
| **1. AUDIT_COMPLETE** | **CONFIRMED** | Repository audit, dependency check, permissions, and security verified with zero secrets. |
| **2. BUILD_COMPLETE** | **CONFIRMED** | Clean production build compiled with `node build.js --edge-store`. |
| **3. TESTS_PASSED** | **CONFIRMED** | `tsc --noEmit` passed with 0 errors; Vitest passed 91/91 test files, 1,203/1,203 tests (100%). |
| **4. PACKAGE_READY** | **CONFIRMED** | `JobFill-BD-Edge-v2.0.1.zip` validated with exact SHA-256 match. |
| **5. LISTING_READY** | **CONFIRMED** | Packages, Availability, Properties, Privacy, Store listings all confirmed with green checkmarks. |
| **6. UPLOADED** | **CONFIRMED** | Package ingested into Partner Center; verified by Microsoft backend as Version: 2.0.1, Status: Complete. |
| **7. SUBMITTED** | **CONFIRMED** | Certification notes entered; "Publish" submitted on the submission dashboard. |
| **8. IN_REVIEW** | **CONFIRMED** | Partner Center dashboard confirms: "In review. Microsoft is reviewing your submission currently." |
| **9. CERTIFIED** | *PENDING* | Awaiting Microsoft automated compliance & human security review (up to 7 business days). |
| **10. PUBLISHED** | *PENDING* | Will automatically switch to Live upon certification approval. |

---

## 3. Certification Release Notes Submitted to Microsoft Reviewers

```text
JobFill BD Version 2.0.1: Added 4th-20th Grade Explorer, Academic Subject Eligibility Matching, and Milestone Notification Reminders. All candidate data and credentials remain strictly stored in local encrypted IndexedDB. No passwords or OTPs are ever transmitted or bypassed.
```

---

## 4. Manifest V3 Permissions Declared & Justified

- `storage`: Encrypted IndexedDB vault & extension preferences stored locally on device.
- `alarms`: MV3 periodic daily circular check and deadline notification evaluation.
- `notifications`: Application milestone reminders in Windows/Edge Action Center.
- `unlimitedStorage`: Prevents quota eviction of candidate profiles and circular records.
- `host_permissions`:
  - `https://*.teletalk.com.bd/*` & `http://*.teletalk.com.bd/*`
  - `https://*.gov.bd/*` & `http://*.gov.bd/*`
  - `https://*.bb.org.bd/*`, `https://*.org.bd/*`, `https://*.ac.bd/*`, `https://*.bdjobs.com/*`
  - `https://bdgovtjob.net/*`
  - Public news/job APIs (credentials: 'omit', zero PII transmitted).

---

## 5. Next Steps

- Microsoft certification review is underway.
- The extension version `2.0.0` remains **Live** and installable for all users while Microsoft reviews version `2.0.1`.
- Once certified, version `2.0.1` will be automatically deployed to the public Edge Store at:
  `https://microsoftedge.microsoft.com/addons/detail/codkdflmgahpbdhadkblabeihgknjnda`
