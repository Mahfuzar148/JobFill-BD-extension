# JobFill BD — BD Govt Job Source Integration Report
**Document ID:** `JOBFILL-BDGOVTJOB-INT-2026-11`  
**Integration Status:** Complete, Verified & Production-Ready  
**Date:** November 19, 2026  
**Target Repository:** `D:\Job form Fill-up extension`  
**Active Branch:** `feat/complete-system-integration-audit`  

---

## Executive Summary

JobFill BD has integrated **BD Govt Job** (`bdgovtjob.net`) as an additional secondary public job discovery source for Bangladesh Public Service Commission (BPSC) recruitment notices.

The integration delivers an end-to-end multi-circular discovery, parsing, validation, conflict detection, official-source verification, deduplication, live MV3 alarm synchronization, and UI dashboard presentation workflow. Crucially, the system enforces **strict architectural separation between secondary aggregator evidence and official government sources** (`bpsc.gov.bd`, `bpsc.teletalk.com.bd`), ensuring JobFill BD users are never misled into trusting a private blog aggregator as a primary government authority.

---

## 1. Source Profile & Architectural Classification

| Attribute | Specification | Notes / Enforcement |
|:---|:---|:---|
| **Source Name** | BD Govt Job | Registered in `JOB_SOURCES` and `JOB_SOURCE_ADAPTERS` |
| **Domain** | `bdgovtjob.net` | Secondary third-party aggregator domain |
| **Source Type** | `job_board` | Third-Party job board category |
| **Publisher Type** | `Third-Party` | Strictly separated from `Official` government ministries |
| **Verification Level** | `discovery_only` | Discovered items require cross-verification before official tagging |
| **Entry Point URL** | `https://bdgovtjob.net/bpsc-job-circular/` | Authorized public HTTP GET endpoint |
| **Target Category** | Government Jobs (`government_jobs`) | Filterable under BPSC subcategory (`bpsc`) |
| **Country / Language** | Bangladesh / Bengali (`bn`) & English (`en`) | Supports bilingual titles and Bengali number parsing |
| **Access Compliance** | Robots.txt checked (`Allow: /bpsc-job-circular/`) | Safe HTTP GET; no CAPTCHA bypass or anti-bot evasions |
| **Caching Policy** | 5-Minute In-Memory TTL | Mitigates redundant polling; respects upstream servers |

---

## 2. Files Created & Modified

### Newly Created Files
1. **`src/jobs/sources/bdgovtjob/bdgovtjob.types.ts`**
   - Defines interfaces: `BdGovtJobArticleMetadata`, `BdGovtJobNoticeItem`, `BdGovtJobConflictReport`, `BdGovtJobVerificationOutcome`.
2. **`src/jobs/sources/bdgovtjob/bdgovtjob.parser.ts`**
   - Core parsing engine: Article metadata extraction, Bengali number normalization, Bengali 24h time parser, multiple circular section extractor, conflict detection, and official source verification.
3. **`src/jobs/sources/bdgovtjob/bdgovtjob.adapter.ts`**
   - `BdGovtJobAdapter` implementing `JobSourceAdapter` interface, registered with `sourceId: 'bdgovtjob'`, using `safePublicGet`, 5-minute memory caching, and source health tracking.
4. **`src/jobs/sources/bdgovtjob/index.ts`**
   - Barrel module exporting all types, utilities, parsers, and the adapter class.
5. **`tests/fixtures/bdgovtjob_bpsc_snapshot.html`**
   - 186,278-byte snapshot of live HTML captured from `https://bdgovtjob.net/bpsc-job-circular/` for deterministic offline testing.
6. **`tests/unit/bdgovtjobSourceIntegration.test.ts`**
   - 21-test test suite verifying all Phase 1-11 requirements.

### Modified Files
1. **`src/jobs/types/job.types.ts`**
   - Added `OfficialSourceVerificationStatus` (`'OFFICIAL_VERIFIED' | 'SECONDARY_SOURCE_ONLY' | 'PARTIALLY_VERIFIED' | 'CONFLICT_DETECTED' | 'UNVERIFIED'`).
   - Extended `NormalizedJobCircular` with: `secondarySourceUrl`, `officialSourceUrl`, `circularDocumentUrl`, `circularImages`, `verificationStatus`, `lastVerifiedAt`, `hasConflict`, `conflictNotes`, `recruitmentType`, `memorandumNumber`, `applicationStartTime`, `applicationDeadlineTime`.
2. **`src/jobs/types/source.types.ts`**
   - Added matching fields to `RawSourceJobItem` for seamless pipeline pass-through.
3. **`src/jobs/services/job-normalizer.ts`**
   - Updated `normalizeJobRecord()` to map secondary source metadata and official verification attributes into normalized circular records.
4. **`src/jobs/sources/source-registry.ts`**
   - Registered `BdGovtJobAdapter` into `JOB_SOURCE_ADAPTERS` and `JOB_SOURCES`.
5. **`src/jobs/dashboard/JobCard.tsx`**
   - Added Secondary Source Badge (`উৎস: bdgovtjob.net (মাধ্যমিক)`), Conflict Alert Badge (`তথ্য গরমিল`), and dedicated "Original Article" (`secondarySourceUrl`) button separate from "Official Circular" and "Apply Now".
6. **`src/jobs/dashboard/JobDetails.tsx`**
   - Added Secondary Discovery Source & Official Verification Card and Conflict Alert Warning Banner.
7. **`src/jobs/database/job-repository.ts`**
   - Made default auto-seeding in `getAllJobs()` opt-in (`{ seedIfEmpty: true }`), preserving zero-job empty states while allowing explicit seeding.

---

## 3. Multiple Circular Extraction (Phase 4 Results)

The live entry article (`https://bdgovtjob.net/bpsc-job-circular/`) bundles **multiple distinct recruitment notices** into a single blog post. The adapter extracts **3 separate circular records**:

```
Article: "৫১৪৭ পদে বাংলাদেশ সরকারি কর্ম কমিশন (BPSC) নিয়োগ বিজ্ঞপ্তি ২০২৬"
 │
 ├── Notice 1: Non-Cadre Recruitment (5 Categories / 12 Vacancies / Grade 5)
 ├── Notice 2: Non-Cadre Recruitment (14 Categories / 135 Vacancies / Grade 9)
 └── Notice 3: 51st BCS Special Examination (5000 Vacancies / Grade 9)
```

### Detailed Breakdown per Notice

| Field | Notice 1 | Notice 2 | Notice 3 |
|:---|:---|:---|:---|
| **Section Title** | বাংলাদেশ সরকারি কর্ম কমিশন (BPSC) নিয়োগ বিজ্ঞপ্তি ১ (৫টি ক্যাটাগরির ১২টি পদ) | বাংলাদেশ সরকারি কর্ম কমিশন (BPSC) নিয়োগ বিজ্ঞপ্তি ২ (১৪টি ক্যাটাগরির ১৩৫টি পদ) | ৫১তম বি.সি.এস. (বিশেষ) নিয়োগ বিজ্ঞপ্তি ২০২৬ (৫০০০ পদ) |
| **Recruitment Type** | Non-Cadre Recruitment | Non-Cadre Recruitment | Special BCS Examination |
| **Organization** | Bangladesh Public Service Commission (BPSC) | Bangladesh Public Service Commission (BPSC) | Bangladesh Public Service Commission (BPSC) |
| **Total Vacancies** | 12 | 135 | 5,000 |
| **Government Grade** | Grade 5 | Grade 9 | Grade 9 |
| **Salary Scale** | ৪৩,০০০ – ৬৯,৮৫০/- টাকা | ২২,০০০ – ৫৩,০৬০/- টাকা | ২২,০০০ – ৫৩,০৬০/- টাকা |
| **Post Names Sample** | সিস্টেম অ্যানালিস্ট, মেইনটেন্যান্স ইঞ্জিনিয়ার, সহকারী সিস্টেম অ্যানালিস্ট | আইন কর্মকর্তা, সহকারী পরিচালক, গবেষণা কর্মকর্তা, হিসাবরক্ষণ কর্মকর্তা | ৫১তম বিসিএস (বিশেষ) ক্যাডার পদসমূহ |
| **Memorandum No.** | ৮০.০০.০০০০.০০০.৩০১.৭৩.০১৪ (০০৪).২৬-৩৫৪ | ৮০.০০.০০০০.০০০.৩০১.৭৩.০১৪ (০০৪).২৬-৩৫৫ | ৮০.০০.০০০০.২০০.৪৬.০৩১.২৬-২৪৮ (51st BCS Special) |
| **Application Start** | ০১ মার্চ ২০২৬ | ০১ মার্চ ২০২৬ | ০১ মার্চ ২০২৬ |
| **Application Deadline** | ৩০ নভেম্বর ২০২৬ (১৮:০০) | ৩০ নভেম্বর ২০২৬ (১৮:০০) | ২৫ অক্টোবর ২০২৬ (১৮:০০) |
| **Application URL** | `https://bpsc.teletalk.com.bd` | `https://bpsc.teletalk.com.bd` | `https://bpsc.teletalk.com.bd` |
| **Official Source URL** | `https://bpsc.gov.bd` | `https://bpsc.gov.bd` | `https://bpsc.gov.bd` |
| **Secondary Article URL** | `https://bdgovtjob.net/bpsc-job-circular/` | `https://bdgovtjob.net/bpsc-job-circular/` | `https://bdgovtjob.net/bpsc-job-circular/` |
| **Circular Images** | High-res notice scans (78-82) | High-res notice scans (83-96) | 51st BCS notice scans |
| **Verification Status** | `SECONDARY_SOURCE_ONLY` | `SECONDARY_SOURCE_ONLY` | `CONFLICT_DETECTED` (see Phase 6) |

---

## 4. Successfully Parsed vs. Omitted Fields

### Successfully Parsed Fields
- **Job Title**: Extracted from section headings (`<h3>`).
- **Organization Name**: Mapped bilingually (`Bangladesh Public Service Commission (BPSC)` / `বাংলাদেশ সরকারী কর্ম কমিশন`).
- **Recruitment Type**: Disambiguated between `Non-Cadre Recruitment` and `Special BCS Examination`.
- **Vacancies**: Bengali numerals parsed accurately to JavaScript integers (`১২` -> 12, `১৩৫` -> 135, `৫,০০০` -> 5000).
- **Government Grade**: Normalized to integer grade levels (5, 9).
- **Salary Range**: Bengali currency expressions extracted.
- **Application Start / Deadline Dates**: Full Bengali date string parsed (`০১ মার্চ ২০২৬`, `৩০ নভেম্বর ২০২৬`, `২৫ অক্টোবর ২০২৬`).
- **Time of Day**: Extracted into 24-hour HH:mm (`সকাল ১০:০০ টা` -> 10:00, `সন্ধ্যা ৬:০০ টা` -> 18:00).
- **Memorandum Numbers**: Extracted from notice blocks.
- **Application Portal**: Extracted official Teletalk submission URL (`https://bpsc.teletalk.com.bd`).
- **Official Portal**: Extracted official commission URL (`https://bpsc.gov.bd`).
- **Circular Document / Images**: Extracted image attachments for each section.
- **Author**: Extracted (`Gauss Uddin Dolar`).
- **Canonical Article URL**: Extracted from `<link rel="canonical">`.

### Omitted / Unspecified Fields (Gracefully Handled)
- **Direct PDF Download Links**: The article embeds scanned PNG/JPG image circulars instead of raw `.pdf` files. The adapter maps images to `circularImages` and assigns the first scan to `circularDocumentUrl`.
- **Exam Dates & Admit Card Dates**: Not present in the initial recruitment announcement. Strictly stored as `null` (not invented or hallucinated).
- **Detailed 21-category vacancy sub-table**: Full individual vacancy breakdown per category is preserved in circular scan images; summary vacancy totals are extracted cleanly.

---

## 5. Official Source Verification & Link Isolation (Phase 5)

BD Govt Job is classified strictly as a **secondary information aggregator**. The following rules are enforced:

1. **Separation of Links**:
   - `secondarySourceUrl`: Points to `https://bdgovtjob.net/bpsc-job-circular/` ("Open Original Article").
   - `officialSourceUrl`: Points to `https://bpsc.gov.bd` ("Open Official Circular").
   - `applicationUrl`: Points to `https://bpsc.teletalk.com.bd` ("Apply Now").
2. **Verification State Machine**:
   - `SECONDARY_SOURCE_ONLY`: Discovered from BD Govt Job without confirmed official matching records.
   - `PARTIALLY_VERIFIED`: Memorandum number matches official BPSC format pattern (`৮০.০০.০০০০...`).
   - `OFFICIAL_VERIFIED`: Confirmed match against live `bpsc.gov.bd` official notices.
   - `CONFLICT_DETECTED`: Discrepancy detected between article text, summary tables, or official notices.
   - `UNVERIFIED`: Missing or unrecognized source metadata.
3. **No Automatic Elevation**: Secondary source claims are never automatically upgraded to `OFFICIAL_VERIFIED` without verifiable official evidence.

---

## 6. Conflict Detection (Phase 6 Results)

The parser implements automated conflict detection (`detectConflicts`). 

**Real Discrepancy Found in Live Article**:
- In the article's summary table (`.jc-table`), the general deadline is stated as **৩০ নভেম্বর ২০২৬** (30 November 2026).
- In the text for Notice 3 (51st BCS Special), the deadline is explicitly stated as **২৫ অক্টোবর ২০২৬ সন্ধ্যা ৬:০০ টা** (25 October 2026, 18:00).
- **System Action**: Notice 3 is flagged with `hasConflict: true`, assigned status `CONFLICT_DETECTED`, and annotated with:
  `"Notice deadline 2026-10-25 differs from article summary table deadline 2026-11-30"`.
- The dashboard displays a warning banner alerting the user to verify the exact deadline directly against the official BPSC circular.

---

## 7. Deduplication & Merge Behavior (Phase 7)

When both official BPSC circulars (from `bpsc.gov.bd` or `bpsc.teletalk.com.bd`) and secondary circulars from `bdgovtjob.net` exist:
1. **Primary Key Match**: If an official BPSC circular exists with matching memorandum number or matching job title + organization + deadline, the official circular remains the canonical record.
2. **Merging Alternate Evidence**: The BD Govt Job article URL is attached to `alternateSources` rather than duplicating the job card.
3. **Distinct Period Isolation**: Notices with different application deadlines (e.g. 25 October vs 30 November) or different grades (Grade 5 vs Grade 9) are recognized as distinct circulars and never erroneously merged.

---

## 8. Live Synchronization & MV3 Alarms (Phase 8)

- **Registration**: Integrated into `JobCheckService` under MV3 periodic alarm checks (every 30 minutes in background worker).
- **Safe Fetching**: Uses `safePublicGet` with standard headers, 10s timeout, and rate-limit backoff.
- **In-Memory Caching**: 5-minute cache (`CACHE_TTL_MS = 300,000 ms`) prevents redundant requests when multiple dashboard components or rapid manual refreshes trigger checks.
- **Source Health Monitoring**: Reports health status (`SUCCESS`, `PARTIAL_SUCCESS`, `FAILED`) and latency to the Source Health Panel.
- **Fallback Resilience**: If `bdgovtjob.net` returns empty HTML or encounters an outage, `extractMultipleCirculars` returns `[]` cleanly, ensuring failed third-party fetches never crash or block official sources.

---

## 9. Test Suite & Verification Results

### BD Govt Job Integration Suite (`tests/unit/bdgovtjobSourceIntegration.test.ts`)
- **21 tests executed, 21 tests passed (100%)**
  - Phase 1 & 2: Domain safety verification & registration.
  - Phase 3: Article title, date, canonical URL, author, and image discovery.
  - Phase 4: Multiple circular extraction (3 distinct notices), Bengali number parsing, 24h time extraction, single-table fallback.
  - Phase 5: Missing fields handling, official verification state machine, separate URL preservation.
  - Phase 6: Conflict detection for mismatched deadlines.
  - Phase 7: Deduplication against official BPSC notices.
  - Phase 8: 5-minute caching and safe error recovery.

### Full System Verification Matrix

| Suite | Files | Tests | Result | Notes |
|:---|:---:|:---:|:---:|:---|
| **Unit Test Suite (`tests/unit/`)** | 76 | 731 | **731 Passed (0 Failed)** | 100% pass across all subsystems |
| **Integration Test Suite (`tests/integration/`)** | 10 | 184 | **184 Passed (0 Failed)** | 100% pass across multi-portal autofill & sources |
| **Total Test Coverage** | **86** | **915** | **915 Passed (0 Failed)** | Clean run in 133s |
| **TypeScript Typecheck (`tsc --noEmit`)** | — | — | **0 Errors** | Clean compilation |
| **Production Build (`node build.js`)** | — | — | **Success (20s)** | `dist/` ready for Chrome & Edge |

### Production Package Integrity Check

| Package | Expected SHA-256 | Actual SHA-256 | Status |
|:---|:---|:---|:---:|
| `release/JobFill-BD-Edge.zip` | `DB08AA45F1C3ED99AD8ADEBF5B81EDFA94812E93A02557D2306EE171AAD52732` | `DB08AA45F1C3ED99AD8ADEBF5B81EDFA94812E93A02557D2306EE171AAD52732` | **MATCH (Untouched)** |
| `release/chrome/JobFill-BD-Chrome.zip` | `23D002185F2640CB47803A086AB39076F2C2E923AC84405C3117391D65F89DB9` | `23D002185F2640CB47803A086AB39076F2C2E923AC84405C3117391D65F89DB9` | **MATCH (Untouched)** |

---

## 10. Remaining Limitations & Edge Cases

1. **WordPress DOM Structure Changes**: The multi-notice extractor relies on heading elements (`<h3>`) containing notice identifiers (e.g. `বিজ্ঞপ্তি ১`, `বিজ্ঞপ্তি ২`, `বিসিএস`). If the site author alters their naming convention, the parser falls back to summary table parsing.
2. **Image-Embedded Details**: Certain detailed terms (such as quota breakdowns and specific educational degrees per post) are embedded in scanned JPG/PNG images rather than HTML text. Full optical character recognition (OCR) of circular images is not performed locally.
3. **Third-Party Server Availability**: As a private WordPress website, `bdgovtjob.net` may occasionally experience downtime, slow response times, or introduce Cloudflare challenge pages during high traffic surges. The adapter's 10-second timeout, 5-minute cache, and failure isolation prevent any impact on core JobFill BD operations.
