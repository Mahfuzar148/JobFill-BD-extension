# JobFill BD — Current State Audit & System Inspection Report
## Live Job Circular Intelligence & Career Notification Engine Architecture

**Project:** JobFill BD Chrome & Microsoft Edge Extension  
**Publisher:** MR Software Studio  
**Target Repository:** `D:\Job form Fill-up extension`  
**Active Git Branch:** `feat/complete-system-integration-audit`  
**Head Commit:** `d568edd feat(integration): complete master system integration audit and real Edge extension runtime verification`  
**Audit Date:** November 19, 2026  
**Primary Timezone:** Asia/Dhaka (`UTC+06:00`)  
**Technology Stack:** React 19 + TypeScript 5.8 + Vite 6.2 + Tailwind CSS + Chrome Manifest V3  
**Storage Architecture:** IndexedDB (DB Version 12, 29 Stores) + LocalStorage/In-Memory Fallback  
**Auditor Identity:** Antigravity Forensic Codebase Auditor  

---

## Executive Summary

An exhaustive, non-destructive codebase audit was conducted across the JobFill BD extension repository (`D:\Job form Fill-up extension`). The audit inspected Git revision logs, TypeScript compilation, Vitest regression test suites, store packaging scripts, source adapters, background alarms, service worker lifecycles, notification managers, and IndexedDB schema migrations.

### Key Audit Highlights:
1. **TypeScript Compilation:** `npx tsc --noEmit` completes with **0 errors**.
2. **Production Extension Build:** `node build.js` completes successfully with **exit code 0**, emitting:
   - `dist/background.js` (661 kB, gzip 156 kB)
   - `dist/content.js` (793 kB, gzip 181 kB)
   - `dist/assets/dashboard.js` (563 kB, gzip 122 kB)
   - `dist/assets/jobs-hub.js` (1,056 kB, gzip 245 kB)
3. **Automated Test Suite Status:**
   - Vitest executes **88 test files** containing **1,130 individual tests**.
   - **84 test files passed** (1,121 tests passed).
   - **4 test files failed** (9 individual tests failed).
   - **Forensic Root Cause Analysis of the 4 Failing Tests:**
     - `src/jobs/database/job-repository.ts` lines 420–430: `JobRepository.getAllJobs()` automatically injects 9 seed circulars (`getSeedCirculars()`) when the store is empty. This breaks tests expecting a clean empty store:
       - `tests/unit/auditRegressionSuite.test.tsx` (verifying `purgeAllData()` expects 0, gets 9).
       - `tests/unit/jobCircularDataLoadingFix.test.tsx` (tests 4, 6, 7 expecting 1 job or offline empty state, receives 10 or 9).
       - `tests/unit/sourceHealthAndSearchConsistency.test.tsx` (Scenario D expecting 11 jobs, receives 20).
     - `src/jobs/data/official-portals.ts`: legitimately expanded from 15 to 18 official portals, while `tests/unit/officialJobPortals.test.tsx` strictly hardcoded `expect(OFFICIAL_JOB_PORTALS).toHaveLength(15)`.
4. **Store Packaging Immutability (Preservation Rule Verified):**
   - Both production store packages in `release/` remain 100% untouched with matching SHA-256 hashes:
     - `release/JobFill-BD-Edge.zip`: `DB08AA45F1C3ED99AD8ADEBF5B81EDFA94812E93A02557D2306EE171AAD52732`
     - `release/chrome/JobFill-BD-Chrome.zip`: `23D002185F2640CB47803A086AB39076F2C2E923AC84405C3117391D65F89DB9`
5. **Career Notification Architecture Readiness:** The foundation (`chrome.alarms`, `NotificationManager`, `NotificationScheduler`) exists, but contains critical delivery gaps regarding the requested 6-stage lifecycle, 48h/24h/12h/6h/1h deadline milestones, and Service Worker sleep/wake resilience.

---

## 1. Git Status & Working Tree Inspection

- **Current Branch:** `feat/complete-system-integration-audit`
- **Head Commit:** `d568edd feat(integration): complete master system integration audit and real Edge extension runtime verification`
- **Recent Git Log:**
  - `d568edd`: feat(integration): complete master system integration audit and real Edge extension runtime verification
  - `22cb426`: feat(filters): complete live browser E2E verification, separate Cadre/Gazetted from grade, and test real circulars
  - `28b2b56`: feat(document-wallet): complete final runtime, security, and data integrity audit for document wallet and identity gallery
  - `e141aca`: feat(jobs): verify 31 government sources via live HTTP audit, fix exam result classification, and record health metrics
  - `4d3c944`: feat(eligibility): implement profile-based intelligent job eligibility engine, 4 verdict states, and candidate data breakdown
- **Working Tree State:**
  - 32 modified tracked files across handlers, content scripts, UI components, and taxonomy.
  - Newly added untracked subsystem files:
    - `src/jobs/data/seed-circulars.ts`: Seed circular dataset.
    - `src/jobs/database/job-lifecycle-repository.ts`: Repositories for exam schedules, admit cards, seat plans, and results.
    - `src/jobs/sources/bdgovtjob/`: Dedicated bdgovtjob.net source adapter.
    - `src/jobs/taxonomy/canonical-categories.ts`: 18 universal categories `A` through `R`.
    - `src/jobs/types/job-system.types.ts`: Universal job system types.

---

## 2. Component-by-Component Forensic Audit

### 2.1 Job Source Adapters (`src/jobs/sources/source-registry.ts`)
The extension registers **14 central source adapters** in `JobSourceRegistry`:
1. `teletalk` (`TeletalkAdapter`): Official Teletalk Alljobs aggregator & recruitment portals.
2. `official_website` (`OfficialWebsiteAdapter`): Bangladesh National Portal (`bangladesh.gov.bd`).
3. `bpsc` (`BpscAdapter`): Bangladesh Public Service Commission (`bpsc.gov.bd` & `bpsc.teletalk.com.bd`).
4. `bdgovtjob` (`BdGovtJobAdapter`): Verified Bangladesh Government circular aggregator (`bdgovtjob.net`).
5. `bangladesh_bank` (`BangladeshBankAdapter`): Central bank and Bankers' Selection Committee (`erecruitment.bb.org.bd`).
6. `ntrca` (`NtrcaAdapter`): Non-Government Teachers Registration and Certification Authority.
7. `dpe` (`DpeAdapter`): Directorate of Primary Education.
8. `bdjobs` (`BdjobsAdapter`): Bangladesh corporate and private recruitment aggregator.
9. `google_news_discovery` (`GoogleNewsDiscoveryAdapter`): Discovery RSS feed for Bangladesh circular notices.
10. `remotive_remote` (`RemotiveAdapter`): Remote developer/technology jobs.
11. `remoteok_remote` (`RemoteOkAdapter`): Global remote jobs.
12. `himalayas_remote` (`HimalayasAdapter`): Global remote listings with Asia support.
13. `arbeitnow_remote` (`ArbeitnowAdapter`): International and European listings.
14. `reliefweb_bd` (`ReliefWebAdapter`): UN and NGO humanitarian vacancies.

In addition, `src/jobs/sources/government-registry/government-source-registry.ts` defines:
- **31 pre-seeded official government sources** (`SEED_GOVERNMENT_SOURCES`) categorized into 7 groups (Central Aggregators, Public Service Commission, Ministries, Directorates, Defence, Banks, Universities).
- **Dynamic Runtime Registration**: `GovernmentSourceRegistry.registerDynamicGovtSource()` and `registerFromOrgRecord()` dynamically register new official government portals discovered during scraping or Teletalk directory sync.

### 2.2 Job Fetcher & Safe HTTP Client (`src/jobs/services/job-fetcher.ts`)
- **Privacy & Credential Isolation:** Network requests strictly use `credentials: 'omit'` and unauthenticated HTTP `GET`. No user profile tokens, NID data, or documents are ever transmitted.
- **Anti-Bot & CAPTCHA Resilience:** `detectAccessRestrictionWithReason()` detects Cloudflare, CAPTCHA, or login barriers and immediately halts polling with status `MANUAL_VERIFICATION_REQUIRED` without attempting circumvention.
- **Cooldowns & Rate Limiting:** Enforces domain cooldowns (e.g. 6 hours for Remotive/Bangladesh Bank, 1 hour for Arbeitnow/RemoteOK) and exponential backoff capped at 6 hours.
- **Concurrency Control:** Limits parallel source fetches to 4 concurrent threads (`DEFAULT_CONCURRENCY_LIMIT = 4`).

### 2.3 Background Alarm Manager (`src/jobs/background/alarm-manager.ts`)
- Exclusively utilizes `chrome.alarms` (never `setInterval` or `setTimeout`) to prevent battery drain and comply with Manifest V3 Service Worker sleep cycles.
- **Alarms Maintained:**
  - `jobfill_daily_job_check`: Periodic check configured for 360-minute cadence (6 hours) aligned with user-configured Asia/Dhaka daily digest time.
  - `jobfill_deadline_scheduler`: Dynamically set to the single earliest upcoming deadline reminder timestamp across all stored circulars (`earliestNextAt`).
  - `jobfill_fee_deadline_[jobId]`: Dedicated fee payment reminder set 6 hours prior to fee expiry.
- **Vulnerability Found in Service Worker Sleep Recovery:**
  In `alarm-manager.ts` lines 56–62:
  ```typescript
  const state = await JobRepository.getSchedulerState();
  if (state.nextScheduledAlarmAt && state.nextScheduledAlarmAt > Date.now()) {
    const deadlineAlarm = await chrome.alarms.get(ALARM_DEADLINE_SCHEDULER);
    if (!deadlineAlarm) {
      await this.scheduleNextDeadlineAlarm(state.nextScheduledAlarmAt);
    }
  }
  ```
  If the machine sleeps through `nextScheduledAlarmAt`, then upon wakeup `state.nextScheduledAlarmAt > Date.now()` evaluates to **false**. `ensureAlarms()` does NOT trigger an overdue check or re-evaluate deadlines. The scheduler remains dormant until the 6-hour periodic alarm triggers, potentially missing critical 1-hour or 6-hour deadlines.

### 2.4 Service Worker Lifecycle (`src/background/service-worker.ts`)
- Top-level initialization ensures `ensureAlarms()` is registered before asynchronous events.
- Notification click events (`chrome.notifications.onClicked`, `chrome.notifications.onButtonClicked`) look up stored routes in IndexedDB and focus the dashboard directly to the target circular detail tab.
- MV3 shortcut commands (`Alt+Shift+F`, `Alt+Shift+R`) cleanly dispatch to the active recruitment tab without crashing if no valid tab exists.

### 2.5 Notification Manager & Scheduler (`src/jobs/notifications/`)
- `NotificationManager` (`notification-manager.ts`): Creates desktop basic notifications with extension monogram, sets high priority (2) and `requireInteraction` for urgent alerts, and logs all entries into the In-App Notification Center (`STORES.NOTIFICATIONS`).
- `NotificationScheduler` (`notification-scheduler.ts`):
  - Evaluates circular deadlines and emits alerts.
  - **Decoupling Vulnerability:** Exam reminders, admit card alerts, and result alerts are **only evaluated for records in `ApplicationRepository`** (legacy application tracker). The 6 new lifecycle stores (`exam_schedules`, `admit_card_notices`, `seat_plan_notices`, `job_results`) are completely ignored.
  - **Application Opening Missing:** Does not evaluate `job.applicationStartAt` to schedule or emit opening notifications.
- `DeadlineReminder` (`deadline-reminder.ts`):
  - Urgency copy:
    - `< 2h`: "Final Reminder: Only X hours Y minutes left!" (Urgent).
    - `2h–4h`: "Final Reminder: Only X hours left!" (Urgent).
    - `<= 24h`: "URGENT: Application closes in X hours." (Urgent).
    - `<= 48h`: "URGENT: Only X hours left to apply!" (Urgent).
    - `> 48h`: Daily reminder in days remaining.
  - Frequency calculation: Currently uses a fixed 2-hour cadence (`TWO_HOURS_MS = 2 * HOUR_MS`) when `<= 48h`, producing up to 24 alerts instead of the user's specific requested milestones (**48h, 24h, 12h, 6h, 1h**).

### 2.6 IndexedDB Schema & Non-Destructive Migrations (`src/database/indexeddb.ts`)
- Current database version: **`DB_VERSION = 12`**.
- Contains **29 object stores**:
  1. `profiles`: Candidate personal, academic, address, and employment profiles.
  2. `documents`: Uploaded photos, signatures, NID cards, and certificates.
  3. `mappings`: Domain-specific selector memory.
  4. `history`: Autofill history records.
  5. `jobs`: Normalized job circulars with indexes (`sourceId`, `category`, `deadlineAt`, `publishedAt`, `status`, `fingerprintHash`, `sourceJobId`).
  6. `bookmarks`: Bookmarked job IDs with `savedAt` index.
  7. `applications`: Application tracker store (`status`, `updatedAt`).
  8. `job_visits`: Visited circular history.
  9. `notifications`: Notification log (`createdAt`, `type`, `jobId`, `isRead`).
  10. `search_index`: Tokenized inverted search entries.
  11. `sync_history`: Source sync metrics and logs.
  12. `govt_orgs`: Teletalk Alljobs government organization directory.
  13. `source_health`: Source health tracking.
  14. `education_records`: Normalized educational degree records.
  15. `experience_records`: Normalized employment experience records.
  16. `encrypted_vault`: Local encrypted sensitive data.
  17. `migration_logs`: Non-destructive schema migration reports.
  18. `credential_vault`: Portal usernames and passwords (encrypted).
  19. `cv_documents`: Local CV builder documents.
  20. `calendar_events`: Unified career calendar events.
  21. `exam_attempts`: Practice exam attempts and scoring.
  22. `vocabulary_items`: Spaced-repetition vocabulary items.
  23. `study_notes`: Career preparation notes.
  24. `exam_schedules`: Multi-stage exam schedules (v12).
  25. `admit_card_notices`: Admit card issuance records (v12).
  26. `seat_plan_notices`: Exam seat plan notices (v12).
  27. `job_results`: Multi-stage job results & merit lists (v12).
  28. `lifecycle_events`: Circular progression lifecycle milestones (v12).
  29. `notice_history`: Historical notices and corrigenda (v12).
- Transparent fallback: When IndexedDB is unavailable or blocked, `SharedStoreCrud` gracefully falls back to localStorage or in-memory stores.

---

## 3. Findings Matrix

| Audit Dimension | Status | Key Findings & Concrete Evidence |
|---|:---:|---|
| **18 Universal Categories (A–R)** | **FULLY IMPLEMENTED** | 18 canonical categories (`A` through `R`) implemented in `canonical-categories.ts` and `job-system.types.ts`. Cleanly decoupled from Organization Type and Sector. |
| **Government Pay Grades (1–20)** | **FULLY IMPLEMENTED** | Extracted and classified in `grade-extractor.ts`. Grade ranges (`1–9`, `10–15`, `16–20`, `Non-Grade`) verified. Private sector and NGO jobs strictly isolated from civil service badges. |
| **Exam Schedule Tracking (7 Stages)** | **FULLY IMPLEMENTED** | Preliminary, MCQ, Written, Practical, Physical, Viva, and Final Selection stages tracked in `job-lifecycle-repository.ts`. Anti-fabrication invariant displays "Exam Date Not Announced" when unconfirmed. |
| **Job Result Tracking (9 Types)** | **FULLY IMPLEMENTED** | 9 result types (Preliminary, Written, Practical, Viva, Final, Merit List, Waiting List, Revised, Cancellation) stored with official PDF links in `JobResultRepository`. |
| **Lifecycle Timeline (11 Stages)** | **FULLY IMPLEMENTED** | 11-stage visual interactive timeline rendered in `JobDetails.tsx` (Publication → Application Opens → Deadline → Admit Card → Seat Plan → Exam → Preli Result → Written Result → Viva → Practical → Final Selection). |
| **Intelligent Eligibility Engine** | **FULLY IMPLEMENTED** | `eligibility-helper.ts` (1,459 lines) validates candidate age on cutoff date (Asia/Dhaka), minimum education level, degree subject, GPA/division, quota, and home district restrictions. |
| **Circular Published Notification** | **PARTIALLY BROKEN** | `type: 'new_job'` is defined in `NotificationCategoryType` but is NEVER dispatched anywhere in the codebase. Only `matching_job` is dispatched when custom filters exist. |
| **Application Opening Notification** | **MISSING** | `NotificationScheduler` does not evaluate `job.applicationStartAt` to schedule or emit an `application_opening` notification when the application window opens. |
| **Milestone Deadline Reminders (48h/24h/12h/6h/1h)** | **PARTIALLY IMPLEMENTED** | Reminders currently trigger every 2 hours when `<= 48h` via `TWO_HOURS_MS`. Specific milestone alerts (48h, 24h, 12h, 6h, 1h) are not tracked as distinct milestone triggers. |
| **Personalized Alert Filters in Sync** | **PARTIALLY IMPLEMENTED** | `jobMatchesPreferences` in `daily-digest.ts` checks legacy education strings and keywords, but does not check the 18 universal categories (A–R), government pay grades (1–20), or candidate age eligibility. |
| **Bookmarked Job Prioritized Notifications** | **PARTIALLY IMPLEMENTED** | `NotificationScheduler` only sends an expiration notice for bookmarked jobs; there is no separate priority notification pipeline or preference toggle for bookmarked circulars. |
| **Unit Test Regressions** | **BROKEN (TEST LEVEL)** | 4 test files fail due to seed data side-effects in `job-repository.ts` (auto-seeding 9 circulars into empty DB inside `getAllJobs()`) and portal count expansion (18 vs 15 in `officialJobPortals.test.tsx`). |
| **Store Packaging Validation** | **COMPLIANCE LEAK IN UNPACKED** | `npm run validate:stores` fails against `release/chrome/unpacked/` because `dashboard.js` contains cloud strings forbidden when cloud sync is disabled. (Production release ZIPs remain compliant and untouched.) |

---

## 4. Critique & Corrections to Prior Investigation

| Issue # | Prior Investigator Claim | Evidence Cited | Actual Code Reality | Corrected Finding |
|---|---|---|---|---|
| **1** | "In `job-repository.ts#L419-L430`, `getAllRawJobs()` automatically injects 9 seed circulars when the store is empty." | `src/jobs/database/job-repository.ts#L419-L430` | Lines 407–409 show `getAllRawJobs()` is a pure getter (`return jobsCrud.getAll()`) that does NOT seed. Lines 411–436 define `getAllJobs()`, which contains the auto-seeding logic. | The auto-seeding method is `getAllJobs()`, NOT `getAllRawJobs()`. Test suites calling `getAllJobs()` or `JobCheckService.runFullCheck()` trigger seeding. Adding `{ skipSeed?: boolean }` to `getAllRawJobs()` (as proposed by the prior worker) would fail to fix the issue. |
| **2** | Artifact report written to `C:\Users\mahfu\.gemini\antigravity\brain\f48f97ec-c72e-4efb-81f6-ee10740b0276\JOBFILL_BD_CURRENT_STATE_AUDIT.md`. | Output paths | The user prompt explicitly required `C:\Users\mahfu\.gemini\antigravity\brain\05e510eb-24f6-4805-b4cf-c419eb0db7d3\JOBFILL_BD_CURRENT_STATE_AUDIT.md`. | The prior worker wrote the artifact to the wrong brain directory. The target file in `05e510eb-24f6-4805-b4cf-c419eb0db7d3` was missing. |
| **3** | `SEED_GOVERNMENT_SOURCES` has 31 static sources. | `government-source-registry.ts#L11-L60` | Lines 780–810 contain `registerDynamicGovtSource()` and `registerFromOrgRecord()`. | The government registry is not static; it dynamically registers discovered official portals at runtime. |
| **4** | Service Worker alarm recovery claimed fully resilient via `ensureAlarms()`. | `alarm-manager.ts#L43-L77` | Line 57 checks `if (state.nextScheduledAlarmAt && state.nextScheduledAlarmAt > Date.now())`. | If the machine sleeps through `nextScheduledAlarmAt`, `ensureAlarms()` skips rescheduling, leaving the scheduler dormant for up to 6 hours. |
| **5** | Identified missing notification types (`application_opening`, etc.). | `job.types.ts#L414-L425` | `type: 'new_job'` exists in the type union but is NEVER dispatched in `job-check-service.ts`. | Circular Published notifications for un-filtered users are completely broken because `new_job` is dead code. |
| **6** | Noted exam alerts only fire for tracked jobs. | `notification-scheduler.ts#L82-L166` | Milestone M1 added 6 dedicated lifecycle repositories (`job-lifecycle-repository.ts`), yet `notification-scheduler.ts` does not import or query them at all. | Complete architectural disconnect between the new lifecycle database stores and the notification engine. |

---

## 5. Architectural Upgrade Plan for Phase 2

```
┌────────────────────────────────────────────────────────────────────────┐
│                   JobFill BD Career Notification Engine                │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  [Official Sources / Adapters] ──> [JobFetcher (Public GET, Safe)]    │
│                                           │                            │
│                                           ▼                            │
│                         [Deduplicator & Normalizer]                    │
│                                           │                            │
│                                           ▼                            │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    IndexedDB (Version 12+)                       │  │
│  │  - jobs               - exam_schedules     - admit_card_notices  │  │
│  │  - job_results        - lifecycle_events   - notifications       │  │
│  │  - reminder_schedules - bookmarks          - applications        │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                           │                            │
│                                           ▼                            │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │             Smart Milestone Notification Scheduler               │  │
│  │  1. Circular Published (Instant on new discovery via new_job)    │  │
│  │  2. Application Opening (When now >= applicationStartAt)        │  │
│  │  3. Milestone Deadlines (48h -> 24h -> 12h -> 6h -> 1h)          │  │
│  │  4. Admit Card & Exam (From ExamSchedule & AdmitCardNotice Repos)│  │
│  │  5. Multi-Stage Results (Preli, Written, Viva, Practical)        │  │
│  │  6. Final Appointment / Selection Notice                         │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                           │                            │
│                                           ▼                            │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │               Chrome Alarms Lifecycle Orchestrator               │  │
│  │  - ALARM_DAILY_CHECK (Daily Digest & Maintenance)                │  │
│  │  - ALARM_CAREER_MILESTONE (Next earliest of: deadline milestone, │  │
│  │    application start, exam date, or admit card date)             │  │
│  │  - Resilient wakeup: Recomputes overdue alarms immediately       │  │
│  │    when state.nextScheduledAlarmAt <= Date.now()                 │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                           │                            │
│                                           ▼                            │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │      Notification Manager (Desktop Notification + In-App Center) │  │
│  │  - Route directly to Circular Detail Modal or Tracker Tab        │  │
│  │  - Strict deduplication (never fire duplicate alerts)            │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Remaining Questions & Gaps

1. **Service Worker Overdue Alarm Strategy:** When a computer resumes from sleep and `state.nextScheduledAlarmAt <= Date.now()`, multiple milestone deadlines (e.g. 24h and 12h) may have passed simultaneously. The scheduler must fire only the single most urgent overdue reminder (e.g. 12h) and mark earlier milestones as consumed, preventing notification floods.
2. **Bookmarked vs Global Notification Default:** Should users receive milestone reminders for ALL matching circulars by default, or should milestone alerts be restricted to circulars the user has explicitly Bookmarked or Added to Tracker? (Recommended: All matching circulars get 48h/24h reminders; intensive 12h/6h/1h reminders prioritize Bookmarked & Tracked jobs, with a settings toggle `milestonesForBookmarkedOnly`).
3. **Seeding Strategy for Test Environments:** In `job-repository.ts`, `getAllJobs()` auto-seeds 9 circulars when empty. The recommended fix is to pass an option `getAllJobs(now, { skipSeed?: boolean })` or check `typeof process !== 'undefined' && process.env.NODE_ENV === 'test'` so test suites asserting clean empty stores pass cleanly.
4. **Targeted Implementation Priorities for Phase 2:**
   - **Step 1:** Fix the 4 failing unit test suites (`getAllJobs` seeding control + `officialJobPortals.test.tsx` length assertion update).
   - **Step 2:** Upgrade `ReminderScheduleRecord` in `job.types.ts` to include milestone flags: `milestonesTriggered: { '48h'?: boolean; '24h'?: boolean; '12h'?: boolean; '6h'?: boolean; '1h'?: boolean; 'opening'?: boolean }`.
   - **Step 3:** Implement `application_opening` notification and milestone scheduler in `deadline-reminder.ts` and `notification-scheduler.ts`.
   - **Step 4:** Connect `ExamScheduleRepository`, `AdmitCardNoticeRepository`, `SeatPlanNoticeRepository`, and `JobResultRepository` to `NotificationScheduler`.
   - **Step 5:** Fix `JobAlarmManager.ensureAlarms()` sleep recovery: if `nextScheduledAlarmAt <= Date.now()`, run `runDeadlineTickOnly()` immediately.
   - **Step 6:** Dispatch `type: 'new_job'` in `job-check-service.ts` when new circulars are fetched and user has default filters.
   - **Step 7:** Expand `jobMatchesPreferences` and `JobPreferences` to include 18 Universal Categories (`A`–`R`), Government Pay Grades (`1`–`20`), and candidate age eligibility via `eligibility-helper.ts`.

---
*Report certified by Antigravity Investigation Agent for MR Software Studio.*
