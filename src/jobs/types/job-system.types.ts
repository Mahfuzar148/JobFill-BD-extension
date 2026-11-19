// JobFill BD - Normalized Job System Types (Milestone M1)
// Comprehensive Bangladesh Job Circular, 18-Category, Government Grade,
// Exam Schedule, Admit Card, Seat Plan, Job Result, and Lifecycle Data Models.
// Compatible with NormalizedJobCircular and ApplicationTrackerRecord.

import type {
  NormalizedJobCircular,
  JobCategory as LegacyJobCategory,
  EducationRequirement,
  JobEmploymentType,
  JobLocation,
  SourceVerificationStatus,
  GovernmentJobGrade,
  GradeVerificationStatus as LegacyGradeVerificationStatus,
  JobCircularStatus,
  JobFieldVerificationMap,
  JobOriginalValues,
  AlternateSourceLink,
  ApplicationTrackerRecord,
  FeePaymentStatus,
  AdmitCardStatus as LegacyAdmitCardStatus,
} from './job.types';

// ============================================================================
// 1. 18-Category Universal Directory & Subcategory Types (Requirement R1)
// ============================================================================

export type CategoryLetter =
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'H'
  | 'I'
  | 'J'
  | 'K'
  | 'L'
  | 'M'
  | 'N'
  | 'O'
  | 'P'
  | 'Q'
  | 'R';

export type SectorType =
  | 'Government'
  | 'Autonomous'
  | 'Semi-Government'
  | 'Private'
  | 'NGO'
  | 'International';

export interface JobSubcategory {
  id: string;
  parentCategoryLetter: CategoryLetter;
  nameEn: string;
  nameBn: string;
  keywords?: string[];
  description?: string;
}

export interface JobCategory {
  letter: CategoryLetter;
  id: string;
  nameEn: string;
  nameBn: string;
  defaultSector: SectorType;
  organizationTypeDefault?: string;
  industryDefault?: string;
  subcategories: JobSubcategory[];
  descriptionEn?: string;
  descriptionBn?: string;
}

// ============================================================================
// 2. Government Pay Grade & Grade System Types (Requirement R2)
// ============================================================================

export type GradeVerificationStatus =
  | 'OFFICIAL_MATCH'
  | 'TEXT_EXTRACTED_UNVERIFIED'
  | 'AMBIGUOUS'
  | 'NOT_SPECIFIED'
  | 'NOT_APPLICABLE'
  | 'REQUIRES_VERIFICATION';

export type GradeRange =
  | 'Grade 1–9'
  | 'Grade 10–15'
  | 'Grade 16–20'
  | 'All Grades';

export type GradeCategoryLabel =
  | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10'
  | '11' | '12' | '13' | '14' | '15' | '16' | '17' | '18' | '19' | '20'
  | 'Non-Grade'
  | 'Grade Not Specified'
  | 'Grade Requires Verification'
  | 'Not Applicable'
  | 'Contractual'
  | 'Private Salary-Based'
  | string;

export interface JobGrade {
  gradeNumber: number | null; // 1 through 20 or null
  gradeLabel: string;
  gradeCategory: GradeCategoryLabel;
  gradeRange?: GradeRange | null;
  gradeVerificationStatus: GradeVerificationStatus;
  gradeOriginalText?: string;
  payScale?: string; // e.g. "BDT 22,000 - 53,060 (Grade-9, NPS 2015)"
  isGovernmentGrade: boolean;
}

// ============================================================================
// 3. Organization Schema (Requirement R1, R5)
// ============================================================================

export interface Organization {
  id: string;
  nameEn: string;
  nameBn: string;
  shortName?: string;
  sector: SectorType;
  organizationType: string;
  industry?: string;
  parentMinistry?: string;
  parentMinistryBn?: string;
  officialDomain?: string;
  websiteUrl?: string;
  logoUrl?: string;
  verified: boolean;
}

// ============================================================================
// 4. Exam Schedule Models (Requirement R3)
// ============================================================================

export type ExamStage =
  | 'Preliminary'
  | 'MCQ'
  | 'Written'
  | 'Practical'
  | 'Physical'
  | 'Viva/Oral'
  | 'Final Selection';

export type ExamScheduleStatus =
  | 'Not Announced'
  | 'Announced'
  | 'Rescheduled'
  | 'Postponed'
  | 'Completed'
  | 'Cancelled';

export interface ExamSchedule {
  id: string;
  circularId: string;
  jobTitle?: string;
  organizationName?: string;
  stage: ExamStage;
  status: ExamScheduleStatus;
  examDate?: string | null;
  examTime?: string | null;
  center?: string | null;
  venue?: string | null;
  seatPlanUrl?: string | null;
  admitCardUrl?: string | null;
  noticeUrl?: string | null;
  officialNoticePdfUrl?: string | null;
  instructions?: string;
  rollRanges?: string;
  createdAt?: number;
  updatedAt: number;
}

// ============================================================================
// 5. Admit Card Notice Model (Requirement R3)
// ============================================================================

export type AdmitCardNoticeStatus =
  | 'Not Published'
  | 'Available'
  | 'Downloaded'
  | 'Expired';

export interface AdmitCardNotice {
  id: string;
  circularId: string;
  jobTitle?: string;
  organizationName?: string;
  stage: ExamStage;
  status: AdmitCardNoticeStatus;
  downloadStartDate?: string | null;
  downloadDeadline?: string | null;
  portalUrl?: string | null;
  noticeUrl?: string | null;
  instructions?: string;
  createdAt?: number;
  updatedAt: number;
}

// ============================================================================
// 6. Seat Plan Notice Model (Requirement R3)
// ============================================================================

export type SeatPlanNoticeStatus =
  | 'Not Announced'
  | 'Announced'
  | 'Updated';

export interface SeatPlanNotice {
  id: string;
  circularId: string;
  jobTitle?: string;
  organizationName?: string;
  stage: ExamStage;
  status: SeatPlanNoticeStatus;
  examDate?: string | null;
  venue?: string | null;
  rollRanges?: string | null;
  noticeUrl?: string | null;
  createdAt?: number;
  updatedAt: number;
}

// ============================================================================
// 7. Job Result Model (Requirement R3)
// ============================================================================

export type ResultStage =
  | 'Preliminary'
  | 'Written'
  | 'Practical'
  | 'Viva'
  | 'Final'
  | 'Merit List'
  | 'Waiting List'
  | 'Revised Result'
  | 'Cancellation/Correction';

export type ResultPublicationStatus =
  | 'Result Not Published'
  | 'Partially Published'
  | 'Result Published'
  | 'Revised Result Published'
  | 'Result Notice Requires Verification';

export interface JobResult {
  id: string;
  circularId: string;
  jobTitle?: string;
  organizationName?: string;
  stage: ResultStage;
  publicationStatus: ResultPublicationStatus;
  publishedDate?: string | null;
  pdfUrl?: string | null;
  noticeUrl?: string | null;
  selectedCandidateCount?: number | null;
  meritListAvailable?: boolean;
  waitingListAvailable?: boolean;
  summary?: string;
  createdAt?: number;
  updatedAt: number;
}

// ============================================================================
// 8. Lifecycle Event & Timeline Models (Requirement R3)
// ============================================================================

export type LifecycleEventType =
  | 'PUBLICATION'
  | 'APPLICATION_WINDOW'
  | 'ADMIT_CARD'
  | 'EXAM'
  | 'SEAT_PLAN'
  | 'RESULT'
  | 'FINAL_SELECTION';

export type LifecycleEventStatus =
  | 'UPCOMING'
  | 'ONGOING'
  | 'COMPLETED'
  | 'POSTPONED'
  | 'CANCELLED';

export interface JobEvent {
  id: string;
  circularId: string;
  eventType: LifecycleEventType;
  title: string;
  titleBn?: string;
  description?: string;
  eventDate: string;
  eventTime?: string;
  status: LifecycleEventStatus;
  noticeUrl?: string;
  metadata?: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export interface JobLifecycleTimeline {
  circularId: string;
  jobTitle: string;
  organization: string;
  currentStage: LifecycleEventType;
  events: JobEvent[];
  examSchedules: ExamSchedule[];
  admitCardNotices: AdmitCardNotice[];
  seatPlanNotices: SeatPlanNotice[];
  results: JobResult[];
  lastUpdated: number;
}

// ============================================================================
// 9. Notice History & Corrigenda Model (Requirement R1, R5)
// ============================================================================

export type NoticeHistoryType =
  | 'CORRIGENDUM'
  | 'DEADLINE_EXTENSION'
  | 'VACANCY_REVISION'
  | 'EXAM_RESCHEDULE'
  | 'RESULT_REVISION'
  | 'GENERAL_NOTICE'
  | 'CANCELLATION';

export interface NoticeHistory {
  id: string;
  circularId: string;
  noticeType: NoticeHistoryType;
  title: string;
  noticeDate: string;
  noticeUrl?: string;
  description: string;
  changesApplied?: Record<string, { oldValue: any; newValue: any }>;
  publishedAt: number;
}

// ============================================================================
// 10. Source Registry & Verification Schema (Requirement R5)
// ============================================================================

export interface SourceRateLimitPolicy {
  requestsPerMinute: number;
  cooldownMs: number;
}

export interface SourceRobotPolicy {
  obeysRobotsTxt: boolean;
  userAgentAllowed: boolean;
  crawlDelaySeconds?: number;
}

export interface SourceRegistry {
  sourceId: string;
  sourceName: string;
  sourceNameBn?: string;
  sector: SectorType;
  categoryLetters: CategoryLetter[];
  officialDomain: string;
  recruitmentPageUrl: string;
  noticePageUrl?: string;
  applicationPortalUrl?: string;
  verificationStatus: SourceVerificationStatus | string;
  rateLimit: SourceRateLimitPolicy;
  robotPolicy: SourceRobotPolicy;
  enabled: boolean;
  lastCheckedAt?: number;
  lastVerifiedAt?: number;
}

export interface SourceVerification {
  sourceId: string;
  verificationStatus: SourceVerificationStatus | string;
  verifiedBy: string;
  auditTimestamp: number;
  officialDomainMatch: boolean;
  termsReviewed: boolean;
  complianceNotes?: string;
  certificateHash?: string;
}

// ============================================================================
// 11. Unified Normalized Job Circular (Requirements R1, R2, R3, R4, R5)
// ============================================================================

export type GenderRequirement = 'All' | 'Male' | 'Female' | 'Other' | 'Not Specified';

export interface JobCircular extends Omit<NormalizedJobCircular, 'grade' | 'employmentType' | 'category' | 'vacancies'> {
  // 18-Category Universal Directory Fields (Requirement R1)
  categoryLetter: CategoryLetter;
  categoryName: string;
  category?: LegacyJobCategory | string;
  subcategory: string;
  sector: SectorType;
  organizationType: string;
  industry: string;
  designation: string;

  // Grade System (Requirement R2)
  grade: JobGrade;

  // Verified Circular Fields (Requirement R1)
  vacancies: number | null;
  employmentType: JobEmploymentType | string;
  salary: string;
  qualification: EducationRequirement | string;
  experience: string;
  ageLimit: string;
  gender: GenderRequirement | string;
  location: JobLocation | string;
  applicationStartDate: string | null;
  applicationDeadline: string | null;
  officialPdfUrl: string | null;
  officialAppLink: string | null;
  sourceWebsiteUrl: string;
  publishedDate: string | null;
  updatedDate: string | null;

  // Connected Lifecycle Arrays (Requirement R3)
  examSchedules?: ExamSchedule[];
  admitCardNotices?: AdmitCardNotice[];
  seatPlanNotices?: SeatPlanNotice[];
  jobResults?: JobResult[];
  lifecycleEvents?: JobEvent[];
  noticeHistory?: NoticeHistory[];
}

// ============================================================================
// 12. Helper Invariants & Utilities
// ============================================================================

/**
 * Validates whether a given sector is considered a Government sector.
 */
export function isGovernmentSector(sector?: string | null): boolean {
  return sector === 'Government' || sector === 'Autonomous' || sector === 'Semi-Government';
}

/**
 * Checks if a category letter represents a non-government category.
 * Categories D (Private Banks), E (NBFI/Insurance/Microfinance), O (Private Company),
 * P (NGO), Q (International) MUST never have Bangladesh Government grades assigned.
 */
export function isNonGovernmentCategoryLetter(letter?: CategoryLetter | string | null): boolean {
  return letter === 'D' || letter === 'E' || letter === 'O' || letter === 'P' || letter === 'Q';
}

/**
 * Builds a default Not Applicable grade for private/NGO/international jobs.
 */
export function buildNotApplicableGrade(reason = 'Private Salary-Based'): JobGrade {
  return {
    gradeNumber: null,
    gradeLabel: reason,
    gradeCategory: 'Not Applicable',
    gradeRange: null,
    gradeVerificationStatus: 'NOT_APPLICABLE',
    isGovernmentGrade: false,
  };
}

/**
 * Builds a default Not Specified grade for government circulars where grade is omitted.
 */
export function buildNotSpecifiedGrade(): JobGrade {
  return {
    gradeNumber: null,
    gradeLabel: 'Grade Not Specified',
    gradeCategory: 'Grade Not Specified',
    gradeRange: null,
    gradeVerificationStatus: 'NOT_SPECIFIED',
    isGovernmentGrade: true,
  };
}
