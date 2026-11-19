# JOBFILL BD — GOVERNMENT JOB GRADE BROWSING & SMART SUBJECT-BASED ELIGIBILITY ENGINE
## Phase 1: Mandatory Repository & Architecture Audit Report (`JOB_GRADE_SUBJECT_AUDIT.md`)

**Date:** 2026-11-19  
**Repository:** `D:\Job form Fill-up extension`  
**Active Branch:** `feat/complete-system-integration-audit`  
**Target Release Packages (Untouched):**
- `release/JobFill-BD-Edge.zip` (SHA-256: `DB08AA45F1C3ED99AD8ADEBF5B81EDFA94812E93A02557D2306EE171AAD52732`)
- `release/chrome/JobFill-BD-Chrome.zip` (SHA-256: `23D002185F2640CB47803A086AB39076F2C2E923AC84405C3117391D65F89DB9`)

---

## Executive Summary

JobFill BD is a production-grade Chrome/Edge Manifest V3 extension featuring local-first architecture, sandboxed IndexedDB storage, AES-256-GCM encryption for personal identity data, a 14-source job aggregation engine, an 18-category universal directory, an application lifecycle tracker, and an offline eligibility evaluation engine.

This comprehensive audit inspects the current codebase against the master development plan for:
1. **Government Job Grade-Based Browsing (Grade 4 through Grade 20)**
2. **Education Qualification & Subject-Based Smart Filtering Engine**
3. **Multi-Degree User Profile and Eligibility Matching Architecture**

All findings in this report are grounded in actual code inspection, file paths, line numbers, and live test executions.

---

## 1. Existing Job Types & Schemas Audit

### 1.1 Job Circular Data Model (`src/jobs/types/job.types.ts`)
- **Government Job Grade (`GovernmentJobGrade`, lines 67–69):**
  ```typescript
  export type GovernmentJobGrade =
    | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
    | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20;
  ```
  *Current State:* Defined as integers 1–20.
  *Gap:* The user requirement specifically focuses on Grades 4 through 20 for public recruitment (Grades 1–3 are constitutional/secretariat appointment posts). The current types do not explicitly normalize or partition Grades 4–20 as a primary browsing structure.
- **Grade Verification Status (`GradeVerificationStatus`, lines 71–76):**
  ```typescript
  export type GradeVerificationStatus =
    | 'OFFICIAL_MATCH'
    | 'TEXT_EXTRACTED_UNVERIFIED'
    | 'AMBIGUOUS'
    | 'NOT_SPECIFIED'
    | 'NOT_APPLICABLE';
  ```
- **Education Requirement (`EducationRequirement`, lines 24–32):**
  ```typescript
  export type EducationRequirement =
    | 'SSC'
    | 'HSC'
    | 'Diploma'
    | 'Bachelor'
    | 'Honours'
    | 'Masters'
    | 'PhD'
    | 'Any Qualification';
  ```
  *Critical Gap:* Missing Bangladesh-specific higher education degree distinctions:
  - `BSc Engineering` (4-year professional engineering degree required by BUET, RUET, CUET, KUET, PWD, RHD, PGCB, etc.)
  - `MBBS / BDS` (5-year medical/dental degrees required for BCS Health & medical posts)
  - `LLB / LLM` (Law degrees required for Sub-Registrar, Assistant Judge, Legal Officer)
  - `Bachelor / Pass Course` (3-year degree vs 4-year Honours)
  - `Honours / BSc` (4-year general degree)
- **Qualification Data Representation in `NormalizedJobCircular` (lines 124–232):**
  Currently, `NormalizedJobCircular` has:
  ```typescript
  qualification: EducationRequirement | string;
  minGpa?: number | null;
  minCgpa?: number | null;
  experience?: string;
  ageRequirement?: string;
  ```
  *Missing Fields for Smart Filtering:*
  - No `subjectRule`: `'ANY_SUBJECT' | 'SPECIFIC_SUBJECT' | 'SUBJECT_GROUP' | 'MULTIPLE_REQUIREMENTS'`
  - No `acceptedSubjects`: `string[]`
  - No `rejectedSubjects`: `string[]`
  - No `requirementGroups`: structured condition tree with `AND` / `OR` operators.
  - No structured `ageRequirement`: `minimumAge`, `maximumAge`, `referenceDate`, `rulesSource`.
  - No `payScale`: string representing National Pay Scale (NPS 2015) salary range.

### 1.2 System-Level Job Types (`src/jobs/types/job-system.types.ts`)
- Defines `JobGrade` (lines 107–116):
  ```typescript
  export interface JobGrade {
    gradeNumber: number | null;
    gradeLabel: string;
    gradeCategory: GradeCategoryLabel;
    gradeRange?: GradeRange | null;
    gradeVerificationStatus: GradeVerificationStatus;
    gradeOriginalText?: string;
    payScale?: string;
    isGovernmentGrade: boolean;
  }
  ```
- *Observation:* While `JobGrade` interface in `job-system.types.ts` has `payScale`, `NormalizedJobCircular` in `job.types.ts` does not embed this full object directly, leading to field fragmentation between `job.gradeNumber` and `(job as any).grade`.

---

## 2. IndexedDB Databases, Object Stores & Migrations Audit

### 2.1 Database Architecture (`src/database/indexeddb.ts`)
- **Database Name:** `JobFillBD_SecureStorage` (line 6)
- **Current Database Version:** `DB_VERSION = 12` (line 7)
- **Current Object Stores (29 Stores):**
  1. `profiles` (keyPath: `id`)
  2. `documents` (keyPath: `id`, indexes: `profileId`, `type`)
  3. `mappings` (keyPath: `fingerprintHash`, indexes: `domain`, `canonicalKey`)
  4. `history` (keyPath: `id`, indexes: `timestamp`, `domain`)
  5. `jobs` (keyPath: `id`, indexes: `sourceId`, `category`, `deadlineAt`, `publishedAt`, `status`, `fingerprintHash`, `sourceJobId`)
  6. `bookmarks` (keyPath: `jobId`, index: `savedAt`)
  7. `applications` (keyPath: `jobId`, indexes: `status`, `updatedAt`)
  8. `job_visits` (keyPath: `visitId`, indexes: `jobId`, `canonicalUrl`, `lastVisitedAt`, `sourceId`)
  9. `notifications` (keyPath: `id`, indexes: `createdAt`, `type`, `jobId`, `isRead`)
  10. `search_index` (keyPath: `jobId`, indexes: `category`, `updatedAt`)
  11. `sync_history` (keyPath: `id`, index: `syncedAt`)
  12. `govt_orgs` (keyPath: `organizationId`, indexes: `shortName`, `openingCount`)
  13. `source_health` (keyPath: `sourceId`, indexes: `status`, `lastCheckedAt`)
  14. `education_records` (keyPath: `id`, index: `profileId`) — *Created in DB v7*
  15. `experience_records` (keyPath: `id`, index: `profileId`) — *Created in DB v7*
  16. `encrypted_vault` (keyPath: `id`) — *Created in DB v7*
  17. `migration_logs` (keyPath: `id`, index: `completedAt`) — *Created in DB v8*
  18. `credential_vault` (keyPath: `id`, indexes: `origin`, `portalName`, `updatedAt`) — *Created in DB v9*
  19. `cv_documents` (keyPath: `id`, indexes: `profileId`, `updatedAt`) — *Created in DB v9*
  20. `calendar_events` (keyPath: `id`, indexes: `date`, `kind`, `sourceRefId`) — *Created in DB v10*
  21. `exam_attempts` (keyPath: `id`, indexes: `subject`, `completedAt`) — *Created in DB v10*
  22. `vocabulary_items` (keyPath: `id`, indexes: `word`, `nextReviewAt`, `saved`) — *Created in DB v10*
  23. `study_notes` (keyPath: `id`, indexes: `kind`, `updatedAt`) — *Created in DB v10*
  24. `exam_schedules` (keyPath: `id`, indexes: `circularId`, `stage`, `status`) — *Created in DB v12*
  25. `admit_card_notices` (keyPath: `id`, indexes: `circularId`, `stage`, `status`) — *Created in DB v12*
  26. `seat_plan_notices` (keyPath: `id`, indexes: `circularId`, `stage`, `status`) — *Created in DB v12*
  27. `job_results` (keyPath: `id`, indexes: `circularId`, `stage`, `publicationStatus`) — *Created in DB v12*
  28. `lifecycle_events` (keyPath: `id`, indexes: `circularId`, `eventType`, `eventDate`) — *Created in DB v12*
  29. `notice_history` (keyPath: `id`, indexes: `circularId`, `noticeType`) — *Created in DB v12*

### 2.2 Missing Indexes on `jobs` Store
- The `jobs` store currently has indexes: `sourceId`, `category`, `deadlineAt`, `publishedAt`, `status`, `fingerprintHash`, `sourceJobId`.
- **Missing Index:** There is NO index on `gradeNumber`. Fast queries for `gradeNumber` (e.g. 4–20) currently scan all records in memory.
- **Missing Index:** There is NO index on `isGovernmentJob`.
- **Migration Policy:** IndexedDB version upgrades must be strictly non-destructive. If bumping to `DB_VERSION = 13` to add indexes on `jobs` (`gradeNumber`, `educationLevel`), existing stores and records must remain 100% untouched.

---

## 3. User Profile & Education Profile Audit

### 3.1 Profile Schema (`src/types/profile.ts`)
- **UserProfile Structure (lines 313–334):**
  ```typescript
  export interface UserProfile {
    id: string;
    profileName: string;
    personal: PersonalInfo;
    address: AddressInfo;
    ssc: SecondaryEducation;
    hsc: SecondaryEducation;
    graduation: HigherEducation;
    masters: HigherEducation;
    hasGraduation: boolean;
    hasMasters: boolean;
    additionalQualifications: AdditionalQualification[];
    jobExperiences: JobExperience[];
    hasJobExperience: boolean;
    special: SpecialInfo;
    references: ReferencePerson[];
    documents: DocumentItem[];
    careerProfile?: StudentCareerProfile;
    customFields?: CustomProfileField[];
  }
  ```
- **Severe Limitation — Rigid Degree Slots:**
  1. `UserProfile` only contains single fixed slots for `ssc`, `hsc`, `graduation`, and `masters`.
  2. If a candidate holds **two Bachelor degrees** (e.g., BSc in EEE and LLB) or a **Diploma followed by BSc Engineering**, or **MBBS + MPH**, they cannot store both degrees in structured degree fields without overflowing into generic `additionalQualifications`.
  3. `HigherEducation` (lines 113–130) contains:
     `examination`, `subjectDegree`, `universityInstitute`, `college`, `studentId`, `registrationNumber`, `rollNumber`, `session`, `resultType`, `gpa`, `gpaScale`, `passingYear`, `courseDuration`.
     It stores `subjectDegree` as an unnormalized raw string (e.g., `"Computer Science & Engineering"` or `"0"`).
- **Date of Birth & Age Input:**
  - `personal.dob` exists as a string (`YYYY-MM-DD`).
  - When present, age can be computed accurately without external network calls.
- **Normalized Education Store (`src/database/profile-repository.ts`, lines 23–34):**
  `StoredEducationRecord` currently only stores:
  `{ id, profileId, level: 'ssc' | 'hsc' | 'graduation' | 'masters' | 'additional', examination, boardOrUniversity, rollNumber, passingYear, gpa, updatedAt }`.
  *Note:* It omits `subjectDegree` in the normalized stored type!

---

## 4. Existing Job Search, Filtering & Eligibility Modules Audit

### 4.1 Government Job Grade Extractor (`src/jobs/services/grade-extractor.ts`)
- **Bengali Numeral & Word Recognition (lines 27–58):**
  Correctly maps numerals `১`–`২০` and Bengali words (`প্রথম` to `বিংশ`, lines 32–58) to integer grades 1–20.
- **Cadre / Non-Cadre & Gazetted Isolation (lines 109–131):**
  Strict regex parsing. Never assumes Grade 1–9 is Cadre or Gazetted.
- **Private Sector Isolation Invariant (lines 173–210):**
  Strict invariant prevents private jobs, NGOs, and international jobs from receiving government grades. If category or employer is private, returns `'Private Salary-Based'` and `gradeVerificationStatus = 'NOT_APPLICABLE'`.
- **Shortcomings in Current Grade Extractor:**
  1. No support for Grade 4–20 bounded range views.
  2. No lookup table for official pay scales (NPS 2015) by grade number.
  3. Grade filter logic (`matchesGradeFilter`, lines 333–421) only supports predefined buckets (`'1st-9th'`, `'10th-15th'`, `'16th-20th'`) and individual grade numbers, but lacks a clean Grade 4–20 ascending index.

### 4.2 Eligibility Engine (`src/jobs/services/eligibility-helper.ts`)
- **Cutoff Date Calculation (lines 107–180):**
  Calculates exact age in years, months, and days on the circular's cutoff date without timezone drift. Evaluates against standard 18–30 (general) and 18–32 (government quota/standard) rules.
- **Subject Extraction & Aliases (lines 302–426):**
  Contains 25 hardcoded subject alias groups (`SUBJECT_ALIAS_GROUPS`):
  `computer science`, `electrical engineering`, `civil engineering`, `mechanical engineering`, `economics`, `accounting`, `finance`, `management`, `business administration`, `marketing`, `english`, `bangla`, `mathematics`, `statistics`, `physics`, `chemistry`, `biology`, `law`, `medical`, `pharmacy`, `agriculture`, `public administration`, `international relations`, `political science`, `sociology`.
- **Subject Matching Flaws Identified:**
  1. **Strictly Flat OR Matching:** `matchProfileSubjectToRequirement` (lines 1012–1034) loops through required subjects and returns `isMatched: true` if *any* required subject matches *any* candidate degree. It cannot enforce `AND` requirements (e.g. "BSc in CSE AND Master in IT") or complex groups.
  2. **Missing Key Subjects:** Does not include `Materials Science & Engineering (MSE)`, `Applied Chemistry & Chemical Engineering (ACCE)`, `Industrial & Production Engineering (IPE)`, `Chemical Engineering`, `Information & Communication Technology (ICT)`, `Architecture`, `Human Resource Management (HRM)`, `Banking`, `Social Work`, `Botany`, `Zoology`, `Biochemistry`, `Microbiology`, `Biotechnology`, `Geography`, `History`, `Philosophy`, `Islamic Studies`, `Arabic`, `Education`.
  3. **No Requirement Type Classification:** Does not classify circular conditions into `ANY_SUBJECT`, `SPECIFIC_SUBJECT`, `SUBJECT_GROUP`, or `MULTIPLE_REQUIREMENTS`.
  4. **Flat Education Hierarchy:** `EDUCATION_RANK` (lines 291–300) assigns identical rank (4) to `Bachelor`, `Honours`, and `Graduation`, but does not distinguish `BSc Engineering` (professional) or `MBBS / BDS` from 3-year pass courses.

### 4.3 Filter UI Components (`src/jobs/dashboard/JobFilters.tsx`)
- Contains standard search inputs, sort dropdown, and collapsible grade panel (lines 1028–1095).
- Currently has quick buttons for `1st–9th Grade`, `10th–15th Grade`, `16th–20th Grade`.
- **Deficiencies:**
  - No Subject filter dropdown or categorized Subject selector.
  - No Education Level taxonomy filter (only generic 8-item dropdown).
  - No Eligibility status filter (`Eligible`, `Review Required`, `Not Eligible`).
  - No Age slider / range filter.

### 4.4 Dashboard Circular Page (`src/jobs/dashboard/JobCircularPage.tsx`)
- Currently includes a `hubTab` state with `'grades'` (line 205).
- When `hubTab === 'grades'` is active, lines 666–668 simply filter:
  `list = list.filter((j) => j.gradeNumber !== null && j.gradeNumber !== undefined && j.gradeNumber >= 1 && j.gradeNumber <= 20);`
- **Missing UI Feature:** It does NOT show the proposed **Government Jobs Grade Explorer** with:
  - Numerical tab sequence: 4th → 5th → 6th → ... → 20th Grade
  - Circular counts per grade
  - Salary scale preview per grade
  - Active jobs count and upcoming application deadlines
  - Unknown / unverified grade partition

### 4.5 Job Card Component (`src/jobs/dashboard/JobCard.tsx`)
- Displays title, organization, location, qualification string, vacancies, salary, countdown, and verified grade pill (lines 160–175).
- **Missing Information on Card:**
  - Separate Subject Requirement tag (e.g. `Subject: Any Subject` vs `Subject: CSE`).
  - Candidate Smart Eligibility Badge (`Eligible`, `Review Required`, `Not Eligible`).
  - Explicit Age limit badge.

---

## 5. Source Adapters & Normalization Audit

### 5.1 Source Adapters Inspected
1. **BPSC Adapter (`src/jobs/sources/bpsc/bpsc.adapter.ts`):**
   - Parses official BPSC notification tables, notices, and Teletalk Non-Cadre portal (`bpsc.teletalk.com.bd/ncad/apply.php`).
   - Accurately captures Grade 9 and 10 entry positions, Cadre vs Non-Cadre status, and memorandum numbers.
2. **BDGovtJob Adapter (`src/jobs/sources/bdgovtjob/bdgovtjob.adapter.ts`):**
   - Secondary source aggregator adapter. Discovers government circulars and links back to official `.gov.bd` / Teletalk endpoints.
3. **National Portal / Official Website Adapter (`src/jobs/sources/national-portal/national-portal.adapter.ts`):**
   - Discovers circulars from 80+ ministry and directorate websites.
4. **Teletalk Adapter (`src/jobs/sources/teletalk/teletalk.adapter.ts`):**
   - Collects all jobs from `alljobs.teletalk.com.bd`.
5. **Bangladesh Bank Adapter (`src/jobs/sources/bangladesh-bank/`):**
   - Parses Central Bank recruitment circulars (Officer, Assistant Director).

### 5.2 Normalization Engine (`src/jobs/services/job-normalizer.ts`)
- Normalizes raw items via `normalizeJobRecord()` (lines 205–354).
- Grade extraction is invoked automatically via `JobGradeExtractor.extractJobGrade()` (line 237).
- Cadre and Gazetted statuses are extracted without conflation (lines 289–290).
- Fingerprint hash generation (`computeFingerprintHash`, lines 33–49) ensures deduplication across sources.
- **Normalization Gaps:**
  - Does not structure `JobQualification` with `subjectRule` or `acceptedSubjects`.
  - Stores `qualification` as a simple string or single `EducationRequirement` enum value.

---

## 6. Reusable Components & Services Inventory

The following production components and utilities are fully functional, tested, and ready to be leveraged without rewrite:

| Component / Utility | File Path | Capabilities |
| :--- | :--- | :--- |
| `JobGradeExtractor` | `src/jobs/services/grade-extractor.ts` | Bengali/English numeral extraction, word-based grades, Cadre/Gazetted distinction, private job exclusion. |
| `calculateAgeOnCutoffDate` | `src/jobs/services/eligibility-helper.ts` | Exact year/month/day calculation on circular cutoff date with zero timezone drift. |
| `parseFlexibleDateString` | `src/jobs/services/eligibility-helper.ts` | Parses ISO, DD/MM/YYYY, DD-MM-YYYY, and epoch timestamps safely. |
| `normalizeBengaliDigits` | `src/jobs/services/eligibility-helper.ts` | Converts Bengali digits (`০–৯`) to ASCII (`0–9`). |
| `IndexedDBManager` | `src/database/indexeddb.ts` | Centralized transaction manager with retry guards and memory fallback. |
| `JobRepository` | `src/jobs/database/job-repository.ts` | High-level circular retrieval, caching, deduplication, search index rebuild. |
| `KeyManager` & WebCrypto | `src/security/key-manager.ts`, `src/utils/crypto.ts` | Non-extractable AES-GCM-256 local encryption for profile vault and documents. |
| `CompactSourceHealthBar` | `src/jobs/dashboard/CompactSourceHealthBar.tsx` | Live multi-source connectivity status and retry controls. |
| `DeadlineCountdown` | `src/jobs/dashboard/DeadlineCountdown.tsx` | Asia/Dhaka deadline countdown with verified date badges. |
| `BookmarkButton` | `src/jobs/dashboard/BookmarkButton.tsx` | Bookmark toggle with IndexedDB synchronization. |

---

## 7. Compatibility Risks & Invariant Protection

1. **Release Package Hash Integrity:**
   - Files `release/JobFill-BD-Edge.zip` and `release/chrome/JobFill-BD-Chrome.zip` must remain completely unmodified.
   - Verified current SHA-256 hashes must match post-implementation:
     - Edge: `DB08AA45F1C3ED99AD8ADEBF5B81EDFA94812E93A02557D2306EE171AAD52732`
     - Chrome: `23D002185F2640CB47803A086AB39076F2C2E923AC84405C3117391D65F89DB9`
2. **IndexedDB Versioning & Data Preservation:**
   - Existing DB version is 12. If new stores or indexes are required, upgrade to version 13 with non-destructive additive migrations only.
   - Do not call `db.deleteObjectStore` or `store.clear()` during upgrade.
   - Ensure backward compatibility for circular records that lack new qualification fields (`subjectRule`, `acceptedSubjects`, `requirementGroups`).
3. **Local Encryption Invariant:**
   - Candidate personal data (DOB, NID, academic certificates) must remain encrypted in `encrypted_vault` and `education_records`. Never introduce plaintext storage of sensitive PII.
4. **Honest Data Rule:**
   - Never fabricate pay grades from salaries for private jobs.
   - Never assume Grade 1–9 is Cadre or Gazetted without evidence.
   - If a circular has ambiguous qualification requirements, return `REVIEW_REQUIRED` (or `MANUAL_REVIEW_REQUIRED`) rather than guessing eligibility.

---

## 8. Detailed Gap Analysis & Proposed Solutions

### 8.1 Government Pay Grade System (Grades 4–20)
*Audit Finding:* Currently, grades are filtered in broad ranges (1–9, 10–15, 16–20) or individual numbers. There is no dedicated grade-wise browsing hub with circular counts and official salary scales.
*Target Architecture:*
- Bounded Grade 4–20 domain:
  - 4th Grade: ৳50,000 – ৳71,200
  - 5th Grade: ৳43,000 – ৳69,850
  - 6th Grade: ৳35,500 – ৳67,010
  - 7th Grade: ৳29,000 – ৳63,410
  - 8th Grade: ৳23,000 – ৳55,470
  - 9th Grade: ৳22,000 – ৳53,060 (BCS Cadre, Sub-Registrar, Assistant Director)
  - 10th Grade: ৳16,000 – ৳38,640 (Sub-Assistant Engineer, 2nd Class Officer)
  - 11th Grade: ৳12,500 – ৳30,230
  - 12th Grade: ৳11,300 – ৳27,300
  - 13th Grade: ৳11,000 – ৳26,590
  - 14th Grade: ৳10,200 – ৳24,680
  - 15th Grade: ৳9,700 – ৳23,490
  - 16th Grade: ৳9,300 – ৳22,490
  - 17th Grade: ৳9,000 – ৳21,800
  - 18th Grade: ৳8,800 – ৳21,310
  - 19th Grade: ৳8,500 – ৳20,570
  - 20th Grade: ৳8,250 – ৳20,010 (Office Support Staff)
- Sorting: Strictly ascending (4 → 5 → 6 → ... → 20).
- Special categories partitioned separately: `Grade Not Specified`, `Non-Grade`, `Contractual`, `Private Salary-Based`.

### 8.2 Education Level Taxonomy
*Audit Finding:* Current `EducationRequirement` enum has only 8 items, conflating 3-year pass course with 4-year Honours, and lacking professional degrees (`BSc Engineering`, `MBBS / BDS`, `LLB / LLM`).
*Target Architecture:*
```typescript
export type NormalizedEducationLevel =
  | 'SSC'
  | 'HSC'
  | 'Diploma'
  | 'Bachelor / Pass Course'
  | 'Honours / BSc'
  | 'BSc Engineering'
  | 'MBBS / BDS'
  | 'LLB'
  | 'LLM'
  | 'Masters / MSc / MBA'
  | 'PhD'
  | 'Other';
```

### 8.3 Categorized Academic Subject Taxonomy
*Audit Finding:* Subject groups are currently a flat list of 25 regex groups in `eligibility-helper.ts`.
*Target Architecture:* A centralized, extensible academic subject taxonomy module (`src/jobs/taxonomy/subject-taxonomy.ts`) organized into 5 major disciplines:
1. **Engineering & Technology:** CSE, EEE, MSE, ACCE, Civil Engineering, Mechanical Engineering, IPE, Chemical Engineering, ICT, Architecture.
2. **Business & Finance:** Accounting, Finance, Management, Marketing, HRM, Banking, Economics.
3. **Law & Social Science:** Law, Political Science, Sociology, Public Administration, Social Work, International Relations.
4. **Science & General:** Physics, Chemistry, Mathematics, Statistics, Botany, Zoology, Biochemistry, Microbiology, Biotechnology, Geography.
5. **Arts & Humanities:** Bangla, English, History, Philosophy, Islamic Studies, Arabic, Education.

Each entry contains canonical ID, English name, Bengali name, aliases, and regex matcher.

### 8.4 Smart Qualification Rule Engine
*Audit Finding:* Current matching is flat OR matching.
*Target Architecture:*
```typescript
export type SubjectRequirementRule =
  | 'ANY_SUBJECT'
  | 'SPECIFIC_SUBJECT'
  | 'SUBJECT_GROUP'
  | 'MULTIPLE_REQUIREMENTS';

export interface StructuredRequirementGroup {
  operator: 'AND' | 'OR';
  requirements: Array<{
    educationLevel?: NormalizedEducationLevel;
    subjects?: string[];
    subjectRule?: 'ANY' | 'SPECIFIC' | 'GROUP';
    minCgpa?: number;
  }>;
}

export interface StructuredJobQualification {
  educationLevels: NormalizedEducationLevel[];
  subjectRule: SubjectRequirementRule;
  acceptedSubjects: string[];
  rejectedSubjects?: string[];
  requirementGroups?: StructuredRequirementGroup[];
  rawText?: string;
}
```

### 8.5 Multi-Degree User Education Profile
*Audit Finding:* `UserProfile` has rigid single fields for `ssc`, `hsc`, `graduation`, `masters`.
*Target Architecture:*
Enhance `UserProfile` with a backward-compatible `educationDegrees?: CandidateDegreeItem[]` array while keeping existing `ssc`, `hsc`, `graduation`, `masters` fields intact. This allows users to add multiple degrees (e.g. BSc in EEE + MSc in Materials Science + LLB) without breaking existing profile storage or autofill handlers.

### 8.6 Tri-Verdict Smart Job Matching System
*Target Verdicts:*
1. `ELIGIBLE`: All education levels, subjects, GPA, age on cutoff date, and mandatory conditions verified.
2. `REVIEW_REQUIRED` (or `MANUAL_REVIEW_REQUIRED`): Ambiguous circular language, unextracted cutoff dates, or special quota clauses.
3. `NOT_ELIGIBLE`: Definite mismatch in degree level, subject, GPA, or age.
4. `INSUFFICIENT_PROFILE_DATA`: Missing user profile fields.

---

## 9. Implementation Roadmap & Phased Execution Plan

The project should proceed through the following phased sequence:

- **Phase 2 — Government Pay Grade System:**
  - Create Grade 4–20 taxonomy and NPS 2015 salary metadata.
  - Implement ascending Grade 4–20 sorting and counts.
  - Build Grade-wise Browsing Explorer component.
- **Phase 3 — Education & Subject Taxonomy Engine:**
  - Build `src/jobs/taxonomy/subject-taxonomy.ts` with 5 academic disciplines.
  - Build normalized `EducationLevel` taxonomy with professional degrees.
  - Implement `ANY_SUBJECT`, `SPECIFIC_SUBJECT`, `SUBJECT_GROUP`, and `MULTIPLE_REQUIREMENTS` rule evaluators with explicit `AND`/`OR` support.
- **Phase 4 — User Education Profile & Eligibility Matching:**
  - Extend profile model to support multiple degrees and subjects backward-compatibly.
  - Update `eligibility-helper.ts` to evaluate multi-degree profiles against structured qualification rules.
  - Support exact cutoff date age calculation.
- **Phase 5 — UI & Advanced Filter Integration:**
  - Update `JobFilters.tsx` to include Grade 4–20, Education Level, Subject, Subject Rule, and Eligibility status filters.
  - Update `JobCard.tsx` to display Grade, Education, Subject rule badge, and candidate Eligibility badge.
  - Build Grade Explorer tab and dedicated view inside `JobCircularPage.tsx`.
- **Phase 6 — Testing & Build Verification:**
  - Unit tests for Grade 4–20 ordering, Subject taxonomy resolution, AND/OR qualification logic, age cutoff calculation, and multi-degree matching.
  - Verify zero regressions in full test suite (1148+ tests).
  - Verify untouched release packages SHA-256 hashes.
  - Produce final `GRADE_SUBJECT_FILTER_IMPLEMENTATION_REPORT.md`.

---

## 10. Audit Conclusion

The repository is well-architected, modular, and has a strong test foundation. All required features—Government Job Grade 4–20 browsing, professional education taxonomy, 5-discipline academic subject taxonomy, structured ANY/SPECIFIC/GROUP qualification rules, and multi-degree profile eligibility—can be implemented cleanly as backward-compatible enhancements without rewriting existing database tables or disrupting existing autofill, document wallet, and source aggregation workflows.
