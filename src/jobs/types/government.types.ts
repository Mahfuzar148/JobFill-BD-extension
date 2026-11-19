// JobFill BD - Bangladesh Government Job Circular Aggregation Types
// Comprehensive taxonomy, organization types, source records, notice classification, and collection metrics.

export type GovernmentOrganizationType =
  | 'Ministry'
  | 'Division'
  | 'Directorate'
  | 'Department'
  | 'Commission'
  | 'Constitutional Institution'
  | 'Autonomous Organization'
  | 'Statutory Body'
  | 'Public Corporation'
  | 'Government Bank'
  | 'Public University'
  | 'Government School or College Authority'
  | 'Government Hospital or Medical Institution'
  | 'Defence Force'
  | 'Law Enforcement Agency'
  | 'District Administration'
  | 'Local Government'
  | 'Other Government Institution';

export type GovernmentSourceGroup =
  | 'central_aggregators' // A. Central Aggregators (National Portal, Alljobs)
  | 'public_service_commissions' // B. BPSC & Public Commissions
  | 'ministries_divisions' // C. Ministries & Divisions
  | 'directorates_departments' // D. Directorates & Departments
  | 'defence_uniformed' // E. Defence & Police Forces
  | 'government_financial' // F. Bangladesh Bank & Public Banks
  | 'public_education' // G. Universities & Education Boards
  | 'public_healthcare' // H. Medical Colleges & Hospitals
  | 'public_corporations' // I. Public Corporations & Utilities
  | 'district_local_govt'; // J. DC Offices & Local Administration

export type GovernmentSourceStatus =
  | 'ACTIVE'
  | 'PARTIAL'
  | 'BLOCKED'
  | 'FAILED'
  | 'DISABLED'
  | 'NOT_TESTED';

export type GovernmentSourceVerificationStatus =
  | 'CANDIDATE'
  | 'OFFICIAL_DOMAIN_VERIFIED'
  | 'ACCESS_REVIEWED'
  | 'CONFIGURED'
  | 'ACTIVE'
  | 'PARTIAL'
  | 'BLOCKED'
  | 'FAILED'
  | 'DISABLED'
  | 'NOT_TESTED';

export type GovernmentAccessMethod =
  | 'API'
  | 'RSS_JSON'
  | 'HTML_NOTICE_BOARD'
  | 'HTML_RECRUITMENT_TABLE'
  | 'STRUCTURED_PAGINATED'
  | 'PORTAL_REDIRECT'
  | 'MANUAL_LINK';

export type GovernmentPaginationMethod =
  | 'PAGE_NUMBER'
  | 'OFFSET'
  | 'CURSOR'
  | 'NEXT_LINK'
  | 'ARCHIVE_YEAR_MONTH'
  | 'NONE';

export interface GovernmentSourceRecord {
  sourceId: string;
  sourceName: string;
  sourceNameBn: string;
  organizationName: string;
  organizationNameBn: string;
  organizationType: GovernmentOrganizationType;
  sourceGroup: GovernmentSourceGroup;
  parentMinistry?: string;
  parentMinistryBn?: string;
  officialDomain: string;
  recruitmentPageUrl: string;
  noticePageUrl: string;
  applicationPortalUrl?: string;
  sourceAccessMethod: GovernmentAccessMethod;
  paginationMethod: GovernmentPaginationMethod;
  maxPagesToScan?: number;
  supportedCategories: string[];
  recruitmentDetectionRules?: {
    titleKeywords?: string[];
    excludeKeywords?: string[];
    columnMap?: Record<string, string>;
  };
  termsReviewStatus: 'REVIEWED_PUBLIC' | 'RESTRICTED' | 'UNREVIEWED';
  lastCheckedAt?: number;
  lastSuccessfulAt?: number;
  sourceHealth: GovernmentSourceStatus;
  enabled: boolean;
  verificationStatus: GovernmentSourceVerificationStatus;
  lastError?: string;
  officialPortalUrl?: string;
  notes?: string;
  notesBn?: string;
  historicalArchiveCoverage?: string;
}

// =========================================================================
// NOTICE CLASSIFICATION TYPES (Part 6 & Part 13)
// =========================================================================

export type NoticeClassificationCategory =
  | 'PRIMARY_JOB_CIRCULAR'
  | 'RECRUITMENT_UPDATE'
  | 'ADMINISTRATIVE_NON_JOB';

export type PrimaryJobSubtype =
  | 'NEW_CIRCULAR'
  | 'REVISED_CIRCULAR'
  | 'DEADLINE_EXTENSION'
  | 'VACANCY_ANNOUNCEMENT'
  | 'CONTRACTUAL_RECRUITMENT'
  | 'TEMPORARY_RECRUITMENT'
  | 'PROJECT_RECRUITMENT'
  | 'CANCELLATION'
  | 'CORRECTION';

export type RecruitmentUpdateSubtype =
  | 'APPLICATION_START'
  | 'ADMIT_CARD'
  | 'EXAM_SCHEDULE_WRITTEN'
  | 'EXAM_SCHEDULE_MCQ'
  | 'EXAM_SCHEDULE_PRACTICAL'
  | 'EXAM_SCHEDULE_VIVA'
  | 'RESULT_PRELIMINARY'
  | 'RESULT_WRITTEN'
  | 'RESULT_FINAL'
  | 'WAITING_LIST'
  | 'APPOINTMENT_LETTER'
  | 'JOINING_INSTRUCTION';

export type AdministrativeNonJobSubtype =
  | 'TRANSFER'
  | 'PROMOTION'
  | 'RETIREMENT'
  | 'OFFICE_ORDER'
  | 'TENDER'
  | 'PROCUREMENT'
  | 'MEETING_NOTICE'
  | 'LEAVE_APPROVAL'
  | 'GENERAL_ANNOUNCEMENT';

export interface NoticeClassificationResult {
  category: NoticeClassificationCategory;
  subtype: PrimaryJobSubtype | RecruitmentUpdateSubtype | AdministrativeNonJobSubtype;
  isRecruitmentRelated: boolean;
  isJobCardEligible: boolean; // TRUE only for PRIMARY_JOB_CIRCULAR
  confidenceScore: number; // 0 - 100
  matchedKeywords: string[];
  exclusionEvidence?: string;
  linkedJobCandidateKey?: string; // e.g. org|position|circularNo for matching existing job
  extractedDeadlines?: string[];
  extractedExamDates?: string[];
  detectedGrade?: number | null;
}

// =========================================================================
// COLLECTION ORCHESTRATION & PAGINATION METRICS (Part 8 & 9)
// =========================================================================

export interface GovernmentSourcePaginationResult {
  sourceId: string;
  sourceName: string;
  totalPagesDiscovered: number;
  pagesAttempted: number;
  pagesSuccessful: number;
  pagesFailed: number;
  rawNoticesFound: number;
  recruitmentNoticesIdentified: number;
  validCirculars: number;
  duplicatesMerged: number;
  rejectedAdministrativeNotices: number;
  newlySavedRecords: number;
  durationMs: number;
  status: GovernmentSourceStatus;
  error?: string;
}

export interface GovernmentCollectionRunSummary {
  runId: string;
  startedAt: number;
  completedAt: number;
  totalSourcesAttempted: number;
  successfulSources: number;
  partialSources: number;
  failedSources: number;
  blockedSources: number;
  totalPagesFetched: number;
  totalRawNoticesScanned: number;
  totalValidCirculars: number;
  totalNewSaved: number;
  totalDuplicatesMerged: number;
  totalAdministrativeRejected: number;
  sourceBreakdown: GovernmentSourcePaginationResult[];
  sourcesAttempted?: number;
  sourcesSucceeded?: number;
  sourcesFailed?: number;
  totalNoticesScanned?: number;
  primaryCircularsDiscovered?: number;
  savedToDatabaseCount?: number;
  administrativeNoticesRejected?: number;
  errors?: Array<{ sourceId: string; errorMessage: string }>;
}

// =========================================================================
// RECRUITMENT CALENDAR EVENT TYPES (Part 22)
// =========================================================================

export type GovernmentCalendarEventType =
  | 'APPLICATION_START'
  | 'APPLICATION_DEADLINE'
  | 'ADMIT_CARD_DOWNLOAD'
  | 'WRITTEN_EXAM'
  | 'MCQ_EXAM'
  | 'PRACTICAL_EXAM'
  | 'VIVA_VOCE'
  | 'RESULT_PUBLICATION'
  | 'JOINING_DATE';

export interface GovernmentRecruitmentCalendarEvent {
  id: string;
  jobId: string;
  circularTitle: string;
  organizationName: string;
  eventType: GovernmentCalendarEventType;
  eventDateText: string;
  eventTimestamp: number;
  isTimezoneDhaka: true;
  verificationLevel: 'OFFICIAL_CONFIRMED' | 'TENTATIVE' | 'NEEDS_VERIFICATION';
  details?: string;
  actionUrl?: string;
}

// =========================================================================
// MISSING CIRCULAR DIAGNOSTIC TYPES (Part 23)
// =========================================================================

export type MissingCircularReasonCode =
  | 'ORGANIZATION_SOURCE_NOT_DISCOVERED'
  | 'OFFICIAL_RECRUITMENT_PAGE_NOT_FOUND'
  | 'SOURCE_NOT_CONFIGURED'
  | 'PAGINATION_INCOMPLETE'
  | 'SOURCE_REQUEST_FAILED'
  | 'SOURCE_ACCESS_RESTRICTED'
  | 'CAPTCHA_REQUIRED'
  | 'AUTHENTICATION_REQUIRED'
  | 'PDF_EXTRACTION_FAILED'
  | 'RECRUITMENT_CLASSIFIER_REJECTED'
  | 'DUPLICATE_MERGED'
  | 'RECORD_EXPIRED_OR_FILTERED'
  | 'INVALID_RECRUITMENT_DATE'
  | 'UNVERIFIED_EXTERNAL_LINK';

export interface MissingCircularDiagnosticResult {
  queryOrganization: string;
  queryTitle: string;
  queryUrl?: string;
  diagnosticReasonCode: MissingCircularReasonCode;
  primaryReason?: string;
  isRecognizedGovernmentDomain?: boolean;
  reasonEn: string;
  reasonBn: string;
  explanation?: string;
  recommendation?: string;
  evidence: string[];
  suggestedActionEn: string;
  suggestedActionBn: string;
  sourceRecord?: GovernmentSourceRecord;
}
