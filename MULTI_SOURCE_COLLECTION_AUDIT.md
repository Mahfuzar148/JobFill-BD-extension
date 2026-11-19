# JobFill BD — Universal Multi-Source Job Circular Data Collection Audit
## Hybrid Multi-Source Data Collection Architecture Audit Report
**Project:** JobFill BD Manifest V3 Extension  
**Repository:** `D:\Job form Fill-up extension`  
**Date:** 19 November 2026  
**Document ID:** `JOBFILL-MULTI-SOURCE-AUDIT-2026-11`

---

## 1. Executive Summary

This architecture audit assesses JobFill BD's existing multi-source data collection pipeline against the 10 core data collection techniques, universal source adapter specifications, and strict security and privacy standards required for Bangladesh government and private recruitment intelligence.

### Core Audit Verdict:
- **Architecture State:** Hybrid Multi-Source Data Collection Engine is **fully operational** and structured modularly.
- **Source Adapters:** 12 active adapters registered in `src/jobs/sources/source-registry.ts`.
- **Techniques Covered:** 9 out of 10 techniques actively implemented in production, with Technique 10 (Webhooks/External Push) architecturally staged for enterprise cloud sync.
- **Verification Engine:** Strict separation between Official Government Authorities (`.gov.bd`, `.teletalk.com.bd`, `bb.org.bd`) and Secondary Aggregators (`bdgovtjob.net`, `bdjobs.com`).
- **Safety Invariants:** Zero CAPTCHA bypass, zero private token usage, Service Worker network isolation, and sleep/wake alarm persistence.

---

## 2. Audit of the 10 Data Collection Techniques

| # | Collection Technique | Implemented Components | Operational Status & Enforcement |
|:---|:---|:---|:---|
| **1** | **Official API Integration** | `arbeitnow.adapter.ts`, `remotive.adapter.ts`, `remoteok.adapter.ts`, `himalayas.adapter.ts`, Teletalk portal JSON. | ✅ **ACTIVE:** Structured JSON parsing, exponential backoff, rate limiting, and timeout isolation. |
| **2** | **RSS / Atom Feed Parsing** | `google-news-discovery.adapter.ts`, feed normalizer in `job-normalizer.ts`. | ✅ **ACTIVE:** XML item parsing, publication timestamp extraction, and canonical link resolution. |
| **3** | **Sitemap XML Discovery** | `bdgovtjob.parser.ts`, `bdgovtjob.adapter.ts`. | ✅ **ACTIVE:** Discovers changed circular URLs using last-modified timestamps; never saves raw URLs as complete jobs. |
| **4** | **HTML Web Scraping** | `bpsc.adapter.ts`, `national-portal.adapter.ts`, `bdgovtjob.adapter.ts`, `official-website.adapter.ts`, `bdjobs.adapter.ts`. | ✅ **ACTIVE:** Configurable DOM selectors, multi-notice table parsers, Bengali number/date normalization, degraded health detection. |
| **5** | **Structured Data Extraction** | `extraction-engine.ts`, `page-scanner.ts`. | ✅ **ACTIVE:** Extracts JSON-LD `JobPosting`, Open Graph tags, and flags conflicts when Schema differs from page text. |
| **6** | **PDF Circular Parsing** | `bpsc.adapter.ts`, `application-link-detector.ts`. | ✅ **ACTIVE:** Discovers direct PDF notices, validates MIME types, isolates PDF URLs from application URLs, and flags scanned PDFs for review. |
| **7** | **Content Script Extraction** | `open-tab-portal-sync.ts`, `content.ts`. | ✅ **ACTIVE:** User-initiated extraction from active browser tabs (e.g. Bangladesh Bank), DOM reading without background scraping. |
| **8** | **Network / API Discovery** | `scripts/probe-live-portals.mjs`, `federated-search-orchestrator.ts`. | ✅ **ACTIVE:** Explores public REST/XHR endpoints legitimately; strictly forbids token theft or session tampering. |
| **9** | **Manual URL & File Import** | `job-file-importer.ts`, `JobFilters.tsx`. | ✅ **ACTIVE:** Allows users to paste circular URLs or import CSV/JSON files with schema validation and duplicate checks. |
| **10**| **Email / Webhook / External** | Extensible cloud sync hooks in `service-worker.ts`. | ⚠️ **STAGED:** Staged for future opt-in notifications; private mailbox access strictly disabled by default. |

---

## 3. Universal Source Adapter System Audit

### Universal Adapter Interface (`src/jobs/types/source.types.ts`)
All adapters conform to the standard `JobSourceAdapter` contract:
```typescript
export interface JobSourceAdapter {
  sourceId: string;
  sourceName: string;
  sourceType: JobSourceType;
  officialDomain?: string;
  compatibilityStatus: 'supported' | 'partially_supported' | 'unsupported';
  accessMethodType: 'API' | 'RSS' | 'HTML' | 'PDF' | 'MANUAL';
  fetchJobs(signal?: AbortSignal): Promise<SourceFetchOutcome>;
  checkHealth?(): Promise<SourceHealthRecord>;
}
```

### Discovery vs. Extraction Separation
- **Discovery Layer:** Identifies new articles, links, or notices (e.g. `discoverArticleMetadata()` in `bdgovtjob.parser.ts`).
- **Extraction Layer:** Parses individual vacancy rows, grade, education, subject, and deadline (`extractMultipleCirculars()`).
- **Normalization Layer:** Converts raw extracted dictionaries into standard `NormalizedJobCircular` via `normalizeJobRecord()`.
- **Verification Layer:** Cross-checks official domains, memorandums, and detects conflicts via `source-verifier.ts` and `job-deduplicator.ts`.

---

## 4. Source Verification & Multi-Tier Status

The system enforces 5 distinct verification tiers:
1. `OFFICIAL_VERIFIED`: Directly fetched from authentic government domains (`.gov.bd`, `.teletalk.com.bd`, `bb.org.bd`).
2. `SECONDARY_SOURCE_ONLY`: Discovered from verified third-party aggregators (`bdgovtjob.net`, `bdjobs.com`). Carries a secondary badge.
3. `PARTIALLY_VERIFIED`: Official notice discovered but full PDF details require manual confirmation.
4. `CONFLICT_DETECTED`: Discrepancy between secondary aggregator deadline and official notice. Both preserved; flagged for review.
5. `UNVERIFIED`: User-submitted or unindexed discovery pending verification.

---

## 5. Security, Permissions & Service Worker Constraints

1. **Manifest V3 Service Worker Lifecycle:**
   - Background polling relies strictly on `chrome.alarms` (`ALARM_DAILY_CHECK`, `ALARM_DEADLINE_CHECK`), never ephemeral `setInterval()`.
   - Polling state, cooldown timestamps, and delivery bitmasks are stored persistently in IndexedDB.
2. **Minimal Host Permissions:**
   - Host permissions are limited to trusted government and recruitment endpoints (`*.gov.bd`, `*.teletalk.com.bd`, `*.bb.org.bd`, `*.bdjobs.com`).
   - Broad `<all_urls>` permission is restricted strictly to local autofill assistance on active tabs.
3. **Anti-Bot & Access Policy:**
   - Zero CAPTCHA bypass scripts. When a WAF or CAPTCHA challenge is detected (e.g. `/tspd/` on Bangladesh Bank), JobFill BD marks the status as `MANUAL_VERIFICATION_REQUIRED` and pauses automatic retries.
