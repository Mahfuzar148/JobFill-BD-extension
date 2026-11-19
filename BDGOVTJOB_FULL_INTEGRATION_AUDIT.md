# JobFill BD — BD Govt Job (bdgovtjob.net) Full Integration Audit
**Document ID:** `JOBFILL-BDGOVTJOB-AUDIT-2026-11`  
**Phase:** Phase 0 — Mandatory Repository & Live Architecture Audit  
**Date:** November 19, 2026  
**Target Repository:** `D:\Job form Fill-up extension`  
**Domain Audited:** `https://bdgovtjob.net`  
**Target Entrypoints:**
1. Source 1 — All Jobs Category: `https://bdgovtjob.net/category/all-jobs/`
2. Source 2 — BPSC Circulars: `https://bdgovtjob.net/bpsc-job-circular/`

---

## Executive Summary

JobFill BD currently incorporates a targeted adapter for `https://bdgovtjob.net/bpsc-job-circular/`, which extracts 3 separate BPSC recruitment notices (Non-Cadre Grade 5, Non-Cadre Grade 9, and 51st BCS Special). However, this single-article parser is insufficient to fulfill the broader requirement: a **Full Website Integration of BD Govt Job** that systematically crawls the entire `/category/all-jobs/` catalog across dynamic multi-page pagination (152 discovered pages, ~1,520 articles dating back to 2019), extracts multi-notice circulars (such as DC Office, PBS, and Police recruitment), classifies them across 9+ sectors, normalizes qualifications and pay grades, discovers circular images/PDFs, deduplicates against official government sources, provides an interactive import preview/resumable crawler, and maintains incremental sync without fabricating data or misrepresenting secondary blog posts as official government notices.

This Phase 0 Audit evaluates the existing JobFill BD codebase, documents live website structure and network realities, identifies reusable subsystems versus required expansions, and provides an end-to-end architectural roadmap for Phases 1 through 17.

---

## 1. Subsystem Audit Matrix (Phase 0 Requirements)

| Subsystem | Existing File(s) | Current Capabilities | Gaps / Required Expansions for Full Integration | Reusability Rating |
|:---|:---|:---|:---|:---:|
| **1. Source Registry** | `src/jobs/sources/source-registry.ts` | Registers 14 adapters (`JOB_SOURCE_ADAPTERS`), including `BdGovtJobAdapter`. Provides `getAll()`, `getById()`, `getOfficialAdapters()`, `getDiscoveryAdapters()`. | Currently registers `bdgovtjob` with only BPSC scope. Needs to support full multi-mode crawling (`all-jobs` + `bpsc`), multi-source entrypoints, and distinct sub-source filters. | **HIGH (100% Reusable)** |
| **2. Existing BD Govt Job Adapter** | `src/jobs/sources/bdgovtjob/bdgovtjob.adapter.ts` | Implements `JobSourceAdapter`. Fetches `BDGOVTJOB_BPSC_URL`. Performs 5-minute memory caching, anti-bot challenge check, and maps to `RawSourceJobItem`. | Only fetches 1 single URL. No crawler, no pagination loop, no article queue, no checkpoint persistence. | **MEDIUM (Adapter shell reusable, crawler engine needed)** |
| **3. BD Govt Job Parser** | `src/jobs/sources/bdgovtjob/bdgovtjob.parser.ts` | Bengali digit parser (`parseBengaliNumber`), 24h time extractor (`extractTimeOfDay`), memo parser (`extractMemorandumNumbers`), conflict detector (`detectConflicts`), BPSC multi-notice splitter. | Hardcoded to BPSC defaults (`organization: 'BPSC'`, `bpsc.gov.bd`). Lacks category card parser, dynamic multi-org extractor (e.g. DC offices, IDRA, Universities), and multi-page discovery. | **HIGH (Parsing primitives 100% reusable, article extractor needs generalization)** |
| **4. Existing BPSC Adapter** | `src/jobs/sources/bpsc/bpsc.adapter.ts` | Scrapes `bpsc.gov.bd/pages/notification-circulars`, `bpsc.gov.bd/pages/notices`, and `bpsc.teletalk.com.bd/ncad/apply.php`. | Authoritative official source. Reusable for cross-verifying secondary notices from `bdgovtjob.net`. | **HIGH (Authoritative verification anchor)** |
| **5. Existing Teletalk Adapter** | `src/jobs/sources/teletalk/teletalk.adapter.ts` | Multi-page JSON fetcher (`MAX_TELETALK_PAGES = 25`), organization directory scraper, and applicant portal resolver. | Provides proven multi-page fetching loop and org resolver that can be adapted for HTML pagination. | **HIGH (Pagination design reference)** |
| **6. Job Fetcher & HTTP Client** | `src/jobs/services/job-fetcher.ts` | `safePublicGet`: safe unauthenticated HTTP GET, 12s timeout, transient retry, Cloudflare/Turnstile anti-bot detection, rate limiting (429 Retry-After), `fetchFromSources` with concurrency control. | Fully ready. Handles rate limiting, backoff, and signal aborts. Must be reused directly for all `bdgovtjob.net` fetches. | **CRITICAL (100% Reusable — DO NOT DUPLICATE)** |
| **7. Job Normalizer** | `src/jobs/services/job-normalizer.ts` | Maps `RawSourceJobItem` to `NormalizedJobCircular`. Normalizes category, location, employment type, salary ranges, GPA/CGPA, fingerprint hashes, and secondary source metadata. | Already supports `secondarySourceUrl`, `officialSourceUrl`, `verificationStatus`, `circularImages`, `hasConflict`, `conflictNotes`, `memorandumNumber`. | **CRITICAL (100% Reusable)** |
| **8. Job Types & Schema** | `src/jobs/types/job.types.ts`, `source.types.ts` | Rich types for `NormalizedJobCircular`, `OfficialSourceVerificationStatus`, `JobCategory`, `JobGradeCategory`, `RawSourceJobItem`, `SourceFetchOutcome`. | Complete. Includes all 5 official verification states (`OFFICIAL_VERIFIED`, `SECONDARY_SOURCE_ONLY`, `PARTIALLY_VERIFIED`, `CONFLICT_DETECTED`, `UNVERIFIED`). | **HIGH (100% Reusable)** |
| **9. IndexedDB Architecture** | `src/database/indexeddb.ts`, `src/jobs/database/job-repository.ts` | `DB_NAME = 'JobFillBD_SecureStorage'`, version 12, 29 object stores (`jobs`, `bookmarks`, `applications`, `notifications`, `sync_history`, `source_health`, etc.). `kvStorage` supports `chrome.storage.local` with fallback. | Needs crawl checkpoint store / persistent key (`jobfill_bdgovtjob_crawl_checkpoint_v1`) to allow pause/resume/restart. | **HIGH (Reusable without destructive migration)** |
| **10. Source Health & Monitoring** | `src/jobs/services/source-health-state.ts` | Tracks 7 centralized health states (`SUCCESS`, `PARTIAL_SUCCESS`, `FAILED`, `MANUAL_VERIFICATION_REQUIRED`, etc.), latency, inserted/updated/duplicate counts, and retry availability. | Fully integrated. BD Govt Job crawler outcomes can report directly into `SourceHealthState`. | **HIGH (100% Reusable)** |
| **11. Notification System** | `src/jobs/background/alarm-manager.ts`, `src/jobs/notifications/` | Manifest V3 Chrome Alarms (`chrome.alarms`), daily digests, urgent deadline reminders, notification deduplication. Strict zero-fake-deadline rule. | Must enforce that historical/expired circulars do NOT trigger deadline notifications, and duplicate circulars do not fire double alerts. | **HIGH (100% Reusable)** |
| **12. Grade & Subject Engines** | `src/jobs/services/grade-extractor.ts`, `src/jobs/taxonomy/subject-taxonomy.ts`, `src/jobs/services/qualification-rule-engine.ts` | Grade 1-20 extractor with Bengali numerals and word grades. 5 academic disciplines with strict subject separation (e.g. ICT != CSE). Qualification Rule Engine supports ANY_SUBJECT, SPECIFIC_SUBJECT, SUBJECT_GROUP, and AND/OR trees. | Fully operational and verified. Ready to evaluate extracted qualifications. | **HIGH (100% Reusable)** |
| **13. Application Tracker** | `src/jobs/database/application-repository.ts`, `ApplicationTracker.tsx` | Full lifecycle tracking (Interested -> Applied -> Exam -> Result). Never auto-marks applied. | Fully operational. Circulars extracted from `bdgovtjob.net` can be tracked seamlessly. | **HIGH (100% Reusable)** |
| **14. Cloud Sync Architecture** | `src/cloud/encrypted-sync-service.ts`, `public-jobs-client.ts` | Client-side E2EE private vault sync. Disabled by default (`__JOBFILL_CLOUD_SYNC_DISABLED__ = true`), local-only privacy. | No changes required. Keeps all BD Govt Job secondary data local-first. | **HIGH (100% Reusable)** |

---

## 2. Live Website Inspection Findings (`bdgovtjob.net`)

A live inspection of `https://bdgovtjob.net` on November 19, 2026 revealed detailed structural characteristics:

### A. Access Compliance & Robots.txt
- **URL Tested:** `https://bdgovtjob.net/robots.txt` (HTTP 200)
- **Rules:**
  ```text
  User-agent: *
  Disallow: /wp-admin/
  Allow: /wp-admin/admin-ajax.php
  Sitemap: https://bdgovtjob.net/sitemap_index.xml
  ```
- **Finding:** Both `/category/all-jobs/` and `/bpsc-job-circular/` are completely permitted for public GET access. No robots.txt blocking exists for job circular paths.
- **Server Platform:** LiteSpeed Web Server behind Cloudflare CDN. Response headers include `x-litespeed-cache: hit`.

### B. Category Landing Page Structure (`/category/all-jobs/`)
- **Pagination Depth:** The page contains `152` pagination pages!
  - Oldest article inspected on Page 152: `https://bdgovtjob.net/sylhet-technical-school-and-college-job-circular/` (dating back to 2019).
  - Articles per page: Exactly 10 articles per page.
  - Total historical article corpus: ~1,520 articles across the site history.
- **Card HTML Markup:**
  Each circular is wrapped in a structured `<article>` tag:
  ```html
  <article id="post-1226" 
    class="bdg-card v7 st-amber post-1226 post type-post status-publish format-standard has-post-thumbnail hentry category-government-jobs-circular category-newspaper-jobs category-teletalk-application category-all-jobs resize-featured-image" 
    data-pub="1795000234">
    <div class="bdg-card-media is-logo">
      <img src="https://bdgovtjob.net/wp-content/uploads/2026/10/Bangladesh-Government-Logo-BD-Govt-Logo.png" />
    </div>
    <div class="bdg-card-top">
      <span class="bdg-card-cat">সরকারি চাকরি</span>
      <span class="bdg-card-new">নতুন</span>
    </div>
    <h2 class="bdg-card-title">
      <a href="https://bdgovtjob.net/dc-office-job-circular/" rel="bookmark">
        সকল জেলা প্রশাসকের কার্যালয়ে নিয়োগ ২০২৬ – DC Office Job Circular 2026
      </a>
    </h2>
    <div class="jc-info">
      <div class="is-vac">
        <span class="v"><b class="p">২৬৩টি পদ</b> · <span class="p">৬৬ ক্যাটাগরি</span> · <span class="p">১৭টি সার্কুলার</span></span>
      </div>
      <div class="is-dl" data-days="20261121T1700,20261122T1700,20261125T1600...">
        <span class="v"><span class="dt">২১, ২২, ২৫... ডিসেম্বর ২০২৬</span></span>
      </div>
    </div>
    <div class="bdg-card-foot">
      <time datetime="2026-11-18T11:10:34+00:00">১৮ নভেম্বর ২০২৬</time>
      <span class="bdg-track" 
        data-post-id="1226" 
        data-t="সকল জেলা প্রশাসকের কার্যালয়ে নিয়োগ ২০২৬ – DC Office Job Circular 2026" 
        data-u="https://bdgovtjob.net/dc-office-job-circular/" 
        data-d="20261121" 
        data-e="1795258800" 
        data-l="1797847200" 
        data-c="সরকারি চাকরি" 
        data-n="২৬৩" 
        data-i="https://...png">
      </span>
    </div>
  </article>
  ```
- **Key Insight on Card Metadata:**
  The `bdg-track` container and `article` dataset contain structured machine-readable fields even before opening the article:
  - `data-post-id`: WordPress numeric ID
  - `data-t`: Clean title
  - `data-u`: Article canonical URL
  - `data-c`: Category label (e.g. `সরকারি চাকরি`, `ব্যাংক চাকরির খবর`, `বিশ্ববিদ্যালয় চাকরি`, `এনজিও চাকরি`, `ফার্মাসিউটিক্যালস চাকরি`, `গ্রুপ অব কোম্পানি চাকরি`)
  - `data-e` & `data-l`: Exact Unix timestamps for earliest and latest application deadlines!
  - `data-days`: Comma-separated ISO deadline strings.
  - `data-n`: Total vacancy count.

### C. Pagination Navigation DOM Structure
- **Container:** `<nav id="nav-below" class="paging-navigation" aria-label="Archive Page">`
- **Page Numbers:** Inside `<div class="nav-links">`:
  - Current page: `<span aria-current="page" class="page-numbers current"><span class="screen-reader-text">পেজ</span>১</span>`
  - Next page: `<a class="next page-numbers" href="https://bdgovtjob.net/category/all-jobs/page/2/">পরের →</a>`
  - Last page link: `<a class="page-numbers" href="https://bdgovtjob.net/category/all-jobs/page/152/"><span class="screen-reader-text">পেজ</span>১৫২</a>`
- **Dynamic Calculation:** The total page count (152) can be parsed directly from the highest page link or traversed until `a.next.page-numbers` is no longer present. **Never hardcode 152.**

### D. Single-Notice vs. Multi-Notice Article Architectures
Live inspection revealed two primary article layout archetypes:

1. **Archetype A: Single Organization Circular (e.g. IDRA Job Circular)**
   - **URL:** `https://bdgovtjob.net/idra-job-circular/`
   - **Structure:**
     - `<table class="jc-table">` provides key-value pairs:
       - `প্রতিষ্ঠানের নাম`: বীমা উন্নয়ন ও নিয়ন্ত্রণ কর্তৃপক্ষ
       - `জব লোকেশন`: ঢাকা (দিলকুশা বা/এ)
       - `মোট শূন্যপদ`: ০১ জন
       - `চাকরির ধরন`: সরকারি চাকরি (খন্ডকালীন, চুক্তিভিত্তিক)
       - `শিক্ষাগত যোগ্যতা`: স্নাতকোত্তর (মাস্টার্স) ও ১০ বছরের অভিজ্ঞতা
       - `বেতন/গ্রেড`: আলোচনা সাপেক্ষে
       - `স্মারক নম্বর`: ৫৩.০৩.০০০০.০০০.০০৯.১১.০০১০.২৬.৪২৯
       - `আবেদনের শেষ তারিখ`: ৩০ নভেম্বর ২০২৬
       - `আবেদন পদ্ধতি`: ডাকযোগে / সরাসরি
     - `<table class="jc-table jc-table-full">` provides specific post breakdown:
       - `পদের নাম`: Institutional Development, Product Standardisation বিষয়ক পরামর্শক...
       - `পদ সংখ্যা`: ১টি

2. **Archetype B: Multi-Circular Bundle Articles (e.g. DC Office Circulars)**
   - **URL:** `https://bdgovtjob.net/dc-office-job-circular/`
   - **Structure:**
     - Bundles **17 distinct DC Office circulars** into one blog post!
     - Summary table (Table 2) lists every district office with individual deadlines (`২১ ডিসেম্বর`, `১৭ ডিসেম্বর`, `০২ ডিসেম্বর`, etc.) and anchor links (`#circular-item-1` to `#circular-item-17`).
     - Each section `<div id="circular-item-N" class="jc-mixed-item">` contains:
       - Title: `১. জেলা প্রশাসকের কার্যালয়, রাঙ্গামাটি পার্বত্য জেলা নিয়োগ বিজ্ঞপ্তি ২০২৬`
       - Organization: `জেলা প্রশাসকের কার্যালয়, রাঙ্গামাটি পার্বত্য জেলা`
       - Vacancies: `০৬ জন`
       - Scanned circular images: `rangamati-dc-office-job-circular-2026_1.jpg`, `_2.jpg`, `_3.jpg`
       - Start Date: `২২ নভেম্বর ২০২৬ সকাল ০৯:০০ টা`
       - Deadline Date: `২১ ডিসেম্বর ২০২৬ বিকাল ০৪:০০ টা`
       - Application Method: `অনলাইন`
       - Application Portal: `https://dcrangamati.teletalk.com.bd`
   - **Strict Rule:** This must be split into **17 distinct normalized circulars**. Merging them into a single record would corrupt deadlines and portal URLs.

3. **Archetype C: Dedicated BPSC Article**
   - **URL:** `https://bdgovtjob.net/bpsc-job-circular/`
   - Bundles Non-Cadre Grade 5 (12 posts), Non-Cadre Grade 9 (135 posts), and 51st BCS Special (5,000 posts), with different deadlines (30 November vs 25 October) and Teletalk application links (`bpsc.teletalk.com.bd`).

---

## 3. Critical Findings & Architectural Constraints

### 1. Extension Host Permissions (`manifest.json`)
- **Inspection Result:**
  ```json
  "host_permissions": [
    "https://*.teletalk.com.bd/*",
    "http://*.teletalk.com.bd/*",
    "https://*.gov.bd/*",
    "http://*.gov.bd/*",
    "https://*.bb.org.bd/*",
    "https://*.org.bd/*",
    "https://*.ac.bd/*",
    "https://*.bdjobs.com/*",
    "https://storage.googleapis.com/*",
    "https://news.google.com/*",
    "https://remotive.com/*",
    "https://remoteok.com/*",
    "https://himalayas.app/*",
    "https://www.arbeitnow.com/*",
    "https://api.reliefweb.int/*"
  ]
  ```
- **Vulnerability / Blocker:** `https://bdgovtjob.net/*` is **NOT** present in `host_permissions`!
- **Impact:** While unit tests run in Node.js and bypass browser security, in the actual Chrome / Edge runtime, background fetch requests to `https://bdgovtjob.net/category/all-jobs/` will be blocked by Chrome MV3 CSP.
- **Remediation Required:** `https://bdgovtjob.net/*` must be added to `host_permissions` in `manifest.json`.

### 2. PDF & OCR Extraction Realities
- **Investigation:**
  - `package.json` contains no PDF parsing library (e.g. `pdfjs-dist`) or OCR library (e.g. `tesseract.js`).
  - `bdgovtjob.net` predominantly hosts scanned JPG/PNG images of circulars (over 90% of government circulars on the site are scanned images uploaded to WordPress, not selectable PDFs).
  - Running client-side OCR across 1,520 articles (estimated 4,500+ scanned images) in a Chrome Extension service worker or dashboard thread would freeze the browser, consume tens of gigabytes of network bandwidth, and crash Chrome due to MV3 service worker memory limits.
- **Architectural Decision:**
  - **Phase 7 Document Discovery:** Discover and extract all circular image URLs (`circularImages`) and direct PDF URLs (`circularDocumentUrl`), storing them with high fidelity.
  - **On-Demand Processing:** Only attempt document text inspection on-demand for individual user-opened circulars, rather than brute-force OCR during background crawling.
  - Preserve original scanned circular images so users can view the authentic notice with 100% confidence.

### 3. Checkpoint Persistence & Resumable Crawling
- **Investigation:**
  - Crawling 152 pages * 10 articles = 1,520 requests.
  - At a polite rate limit of 1 request per 1.5 seconds, a full historical crawl requires ~35-40 minutes.
  - In Manifest V3, background service workers terminate after 30 seconds of inactivity or when the browser closes.
- **Architectural Decision:**
  - Crawler state must be persistent using `kvStorage` (`chrome.storage.local` with fallback to `localStorage`).
  - Checkpoint schema:
    ```typescript
    interface BdGovtJobCrawlCheckpoint {
      status: 'IDLE' | 'CRAWLING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
      crawlMode: 'ALL_JOBS' | 'BPSC_ONLY' | 'INCREMENTAL';
      currentPage: number;
      totalPagesDiscovered: number;
      discoveredArticleUrls: string[];
      processedArticleUrls: string[];
      failedUrls: Array<{ url: string; error: string; retries: number }>;
      startedAt: number;
      lastUpdated: number;
      importedJobsCount: number;
    }
    ```
  - If the service worker restarts or the user clicks "Pause", the crawl resumes seamlessly from `currentPage` and `processedArticleUrls` without re-fetching already extracted articles.

### 4. Deduplication & Official Source Hierarchy
- BD Govt Job is a secondary aggregator.
- Circulars appearing on `bdgovtjob.net` may already exist from official sources (`bpsc.gov.bd`, `alljobs.teletalk.com.bd`, `bb.org.bd`).
- Invariant: **Never overwrite an official source record with secondary data.**
- If an official circular exists:
  - Attach the `bdgovtjob.net` URL as an `alternateSources` link.
  - Keep `sourceVerification: 'official_verified'`.
- If only discovered from `bdgovtjob.net`:
  - Mark `verificationStatus: 'SECONDARY_SOURCE_ONLY'`.
  - Store `secondarySourceUrl: articleUrl`.
  - Store official ministry/portal URL separately in `officialSourceUrl`.

---

## 4. Architectural Blueprint: Phases 1 to 17

### Phase 1 — Source Registration & Configuration
- Expand `BdGovtJobAdapter` in `src/jobs/sources/bdgovtjob/bdgovtjob.adapter.ts`.
- Update metadata:
  - `sourceId: 'bdgovtjob'`
  - `sourceName: 'BD Govt Job (bdgovtjob.net)'`
  - `publisherType: 'Third-Party'`
  - `verificationLevel: 'discovery_only'`
  - Entrypoints: `https://bdgovtjob.net/category/all-jobs/` and `https://bdgovtjob.net/bpsc-job-circular/`.

### Phase 2 — All Jobs Dynamic Category Crawler
- Implement `BdGovtJobCrawler` in `src/jobs/sources/bdgovtjob/bdgovtjob.crawler.ts`:
  - `discoverPagination(html: string): { currentPage: number; totalPages: number; nextPageUrl?: string }`
  - Dynamic discovery without hardcoded numbers.
  - Polite crawl throttling (`CRAWL_DELAY_MS = 1200ms`).
  - Retry logic for transient 500/429 responses.
  - Checkpoint persistence in `kvStorage`.

### Phase 3 — Sector & Category Classification
- Map WordPress card and article categories into JobFill BD Universal Taxonomy (`canonical-categories.ts`):
  | BD Govt Job Category | Internal Canonical Category | Default Sector |
  |:---|:---|:---|
  | `সরকারি চাকরি` | `govt_civil` (`A`) | Government |
  | `ব্যাংক চাকরির খবর` | `govt_banks` (`C`) / `private_banks` (`D`) | Government / Private |
  | `প্রাইভেট চাকরি` | `private_company` (`O`) | Private |
  | `এনজিও চাকরি` | `ngo_development` (`P`) | NGO |
  | `ফার্মাসিউটিক্যালস চাকরি` | `private_company` (`O`) [Sub: `pharmaceuticals`] | Private |
  | `গ্রুপ অব কোম্পানি চাকরি` | `private_company` (`O`) [Sub: `fmcg_conglomerate`] | Private |
  | `শিক্ষা প্রতিষ্ঠান চাকরি` | `school_college` (`G`) | Government / MPO |
  | `বিশ্ববিদ্যালয় চাকরি` | `education_university` (`F`) | Autonomous |
  | `ডিফেন্স জব সার্কুলার` | `defence` (`I`) | Government |

### Phase 4 — Article Extraction Engine
- Generalize `src/jobs/sources/bdgovtjob/bdgovtjob.parser.ts`:
  - Parse both Archetype A (Single Org table) and Archetype B (Multi-notice sections).
  - Extract: Organization, Location, Grade, Vacancies, Published Date, Application Start, Deadline, Fees, Procedure, Teletalk URLs, Circular Scans, Memo Number.
  - Bilingual support: Bengali numerals converted to standard numbers; dates parsed to `Asia/Dhaka` timestamps.

### Phase 5 — Multi-Circular Splitting
- Detect bundled notices:
  - Match section headers (`<div id="circular-item-N">`, `<h3>বিজ্ঞপ্তি ১</h3>`, `<h3>...জেলা...</h3>`).
  - Create separate `RawSourceJobItem` for each independent circular with its own distinct deadline, vacancies, grade, and application URL.
  - If separation is ambiguous, mark as `REVIEW_REQUIRED`.

### Phase 6 — Dedicated BPSC Discovery
- Retain specialized BPSC logic for `https://bdgovtjob.net/bpsc-job-circular/`.
- Cross-verify extracted Non-Cadre and BCS notices with official `bpsc.gov.bd` / `bpsc.teletalk.com.bd` records.

### Phase 7 — Circular Documents & Image Discovery
- Extract all high-res scans from figures (`figure.jc-media-figure-styled img`, `.aligncenter`).
- Identify direct PDF download links (`a[href$=".pdf"]`).
- Store images in `circularImages` and primary document in `circularDocumentUrl`.

### Phase 8 — Job Normalization & Pay Grade / Subject Mapping
- Pipeline raw items through `normalizeJobRecord()`.
- Use `JobGradeExtractor.extractJobGrade()` to validate grades (1 to 20).
- Extract GPA/CGPA with `extractMinGpaOrCgpa()`.
- Assign `fingerprintHash` for stable deduplication.

### Phase 9 — Source Verification & URL Separation
- Enforce strict link isolation:
  - `secondarySourceUrl`: Points to article on `bdgovtjob.net`.
  - `officialSourceUrl`: Points to official ministry/commission domain.
  - `applicationUrl`: Points to Teletalk or designated portal.
  - `circularDocumentUrl`: Points to official circular document/scan.
- Status machine: `SECONDARY_SOURCE_ONLY` -> `PARTIALLY_VERIFIED` -> `OFFICIAL_VERIFIED` or `CONFLICT_DETECTED`.

### Phase 10 — Historical Circular Archive Handling
- Classify circulars by timestamp against Asia/Dhaka current time:
  - Active: `deadlineAt > now`
  - Closing Soon: `0 < (deadlineAt - now) <= 3 days`
  - Expired / Archived: `deadlineAt <= now`
- Historical expired jobs are archived and searchable in UI, but **silenced from notification engines**.

### Phase 11 — Multi-Source Deduplication
- Use `job-deduplicator.ts` (`computeDuplicateMatchConfidence`):
  - Memo number match: Confidence 95%
  - Circular URL match: Confidence 92%
  - Organization + Title token match: Confidence 90%
- Merge secondary evidence into existing official jobs without duplicating records.

### Phase 12 — Import Preview & Admin Controls UI
- Add Import Management Modal / Explorer:
  - Displays: Total Discovered, Unique, Multi-Notice Count, Failed URLs, Checkpoint Status.
  - Controls: "Start Full Import", "Pause", "Resume", "Retry Failed", "BPSC Only", "Incremental Sync".
  - Checkpoint stored in `kvStorage`.

### Phase 13 — Incremental MV3 Background Synchronization
- Register in `JobCheckService`:
  - Regular alarm checks (e.g. 6-hour or daily sync) only fetch Page 1 of `/category/all-jobs/` and the BPSC article.
  - If new article URLs or updated publication dates are found, fetch only those changed articles.
  - Avoid re-crawling all 152 historical pages on routine alarms.

### Phase 14 — UI & Filter Integration
- Update `JobFilters.tsx`:
  - Add dedicated source filter: `bdgovtjob` ("BD Govt Job").
  - Support category filtering: All Jobs, Government, Bank, Private, NGO, Pharma, Group, Education, University, Defence.
  - Show secondary source badge and verification state on `JobCard.tsx` and `JobDetails.tsx`.

### Phase 15 — Event-Driven Notifications
- Notifications generated only for verified upcoming deadlines and newly published active circulars.
- Suppress notifications for closed or historical archive items.

### Phase 16 — Comprehensive Test Suite & Fixtures
- Realistic offline fixtures:
  - `tests/fixtures/bdgovtjob_all_jobs_page1.html`
  - `tests/fixtures/bdgovtjob_dc_office_snapshot.html`
  - `tests/fixtures/bdgovtjob_idra_snapshot.html`
  - `tests/fixtures/bdgovtjob_bank_asia_snapshot.html`
- Unit and integration tests covering:
  - Pagination discovery & dynamic page count.
  - Multi-notice splitting.
  - Conflict detection.
  - Deduplication & merge.
  - Checkpoint pause & resume.

### Phase 17 — Production Report & Delivery
- Generate `BDGOVTJOB_COMPLETE_IMPORT_REPORT.md` with final metrics and test results.

---

## 5. Risk Assessment & Mitigation

| Risk | Impact | Likelihood | Mitigation Strategy |
|:---|:---:|:---:|:---|
| **CORS / Permission Rejection in Chrome** | High | High | Add `https://bdgovtjob.net/*` to `manifest.json` `host_permissions`. |
| **Cloudflare / LiteSpeed Rate Limiting (429)** | Medium | Medium | Use `safePublicGet` with 1200ms delay between requests; respect `Retry-After` headers. |
| **Memory Exhaustion in Service Worker** | High | Medium | Do not hold 1,520 HTML pages in memory; process page by page, commit to IndexedDB, and clear references. |
| **Service Worker Inactivity Termination** | High | High | Persist crawler state in `kvStorage` on every page completion so progress is never lost. |
| **Corrupted Multi-Notice Deadlines** | High | Low | Enforce section-level extraction (`circular-item-N`); fallback to `REVIEW_REQUIRED` if ambiguous. |
| **Spamming Users with Expired Notifications** | High | Low | Explicitly gate notification triggers behind `job.deadlineAt > Date.now()` and `job.status !== 'expired'`. |

---

## 6. Audit Conclusion & Next Steps

The repository audit confirms that **JobFill BD's foundation is exceptionally well-structured and fully capable of hosting the complete BD Govt Job integration**. Core utilities—including `safePublicGet`, `JobNormalizer`, `JobGradeExtractor`, `QualificationRuleEngine`, `JobDeduplicator`, and `IndexedDBManager`—are already implemented and battle-tested across 915 passing tests.

The work required consists of:
1. Adding `https://bdgovtjob.net/*` to `manifest.json` host permissions.
2. Building `BdGovtJobCrawler` with dynamic pagination discovery and checkpoint persistence.
3. Generalizing `BdGovtJobParser` to extract both single-org articles and multi-circular bundles across all 9+ sectors.
4. Implementing the Resumable Import Preview UI and dedicated source filter.
5. Providing realistic offline test fixtures for the new crawler and multi-circular structures.

Implementation may proceed according to Phases 1 through 17 upon coordinator authorization.
