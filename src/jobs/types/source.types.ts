// JobFill BD - Job Source Adapter Contracts
// Defines standard modular interface for official & discovery Bangladesh job sources.

import { NormalizedJobCircular, SourceVerificationStatus, JobCategory } from './job.types';

export type SourceType =
  | 'official_portal'
  | 'official_commission'
  | 'official_bank'
  | 'job_board'
  | 'ministry_directory'
  | 'discovery_rss'
  | 'un_ngo_api'
  | 'remote_tech_api';

export type SourceCompatibilityStatus =
  | 'supported'
  | 'partially_supported'
  | 'manual_only'
  | 'unavailable';

export type SourceConnectionStatus =
  | 'Working'
  | 'Partially Working'
  | 'Failed'
  | 'Manual Verification Required'
  | 'Waiting'
  | 'Temporarily Unavailable'
  | 'Not Implemented'
  | 'Not Tested';

export type CentralizedSourceStatus =
  | 'SUCCESS'
  | 'PARTIAL_SUCCESS'
  | 'FAILED'
  | 'MANUAL_VERIFICATION_REQUIRED'
  | 'NOT_TESTED'
  | 'WAITING'
  | 'TEMPORARILY_UNAVAILABLE';

export type RetryPolicyKind =
  | 'scheduled_interval'
  | 'exponential_backoff'
  | 'rate_limit_retry_after'
  | 'halted_captcha_manual'
  | 'halted_invalid_response'
  | 'partial_scheduled'
  | 'none';

export function deriveSourceConnectionStatus(outcome?: Partial<SourceFetchOutcome> | null): SourceConnectionStatus {
  if (!outcome) {
    return 'Not Tested';
  }
  if (outcome.status === 'WAITING' || outcome.connectionStatus === 'Waiting') {
    return 'Waiting';
  }
  if (outcome.status === 'MANUAL_VERIFICATION_REQUIRED' || outcome.blockedByCaptcha) {
    return 'Manual Verification Required';
  }
  if (outcome.status === 'TEMPORARILY_UNAVAILABLE' || outcome.rateLimited) {
    return 'Temporarily Unavailable';
  }
  if (outcome.status === 'NOT_TESTED' || outcome.connectionStatus === 'Not Tested') {
    return 'Not Tested';
  }

  const hasExplicitState =
    Boolean(outcome.status) ||
    Boolean(outcome.connectionStatus) ||
    typeof outcome.success === 'boolean' ||
    Boolean(outcome.compatibilityStatus);

  if (!outcome.checkedAt && !hasExplicitState) {
    return 'Not Tested';
  }
  if (outcome.compatibilityStatus === 'manual_only' || outcome.connectionStatus === 'Not Implemented') {
    return 'Not Implemented';
  }
  if (
    outcome.status === 'FAILED' ||
    outcome.success === false ||
    outcome.compatibilityStatus === 'unavailable' ||
    outcome.connectionStatus === 'Failed'
  ) {
    return 'Failed';
  }
  if (
    outcome.status === 'PARTIAL_SUCCESS' ||
    outcome.compatibilityStatus === 'partially_supported' ||
    outcome.connectionStatus === 'Partially Working'
  ) {
    return 'Partially Working';
  }
  return 'Working';
}

export type SourceAccessMethodType =
  | 'API'
  | 'Undocumented Static Feed'
  | 'RSS'
  | 'HTML'
  | 'Hybrid API + HTML'
  | 'Directory / Manual';
export type SourcePublisherType = 'Official' | 'Third-Party';

export interface RawSourceJobItem {
  externalId?: string;
  sourceJobId?: string | null;
  organizationId?: number;
  organizationShortName?: string;
  organization: string;
  organizationBn?: string | null;
  organizationLogo?: string;
  jobTitle: string;
  titleBn?: string | null;
  position?: string;
  circularNumber?: string;
  category?: JobCategory;
  employmentType?: string;
  vacancies?: number | null;
  salary?: string;
  qualification?: string;
  experience?: string;
  ageRequirement?: string;
  location?: string;
  publishedDateText?: string;
  applicationStartText?: string;
  deadlineText?: string;
  circularUrl?: string;
  applicationUrl?: string | null;
  organizationUrl?: string;
  sourceUrl?: string | null;
  description?: string;
  requirements?: string[];
  applicationFee?: string;
  applicationProcedure?: string;
  requiredDocuments?: string[];
  rawPayload?: unknown;
}

export interface SourceFetchOutcome {
  sourceId: string;
  sourceName: string;
  compatibilityStatus: SourceCompatibilityStatus;
  connectionStatus?: SourceConnectionStatus;
  status?: CentralizedSourceStatus;
  accessMethodType?: SourceAccessMethodType;
  publisherType?: SourcePublisherType;
  success: boolean;
  jobs: NormalizedJobCircular[];
  jobCount?: number;
  insertedCount?: number;
  updatedCount?: number;
  duplicateCount?: number;
  rejectedCount?: number;
  savedCount?: number;
  totalIndexedCount?: number;
  checkedAt: number;
  lastSuccessfulFetchAt?: number | null;
  httpStatus?: number | null;
  blockedByCaptcha?: boolean;
  invalidResponse?: boolean;
  rateLimited?: boolean;
  retryAfterMs?: number | null;
  nextEligibleCheckAt?: number | null;
  consecutiveFailures?: number;
  retryPolicy?: RetryPolicyKind;
  dataCoverageNote?: string;
  deadlineVerificationNote?: string;
  etag?: string;
  lastModified?: string;
  skippedByCooldown?: boolean;
  accessNotes: string;
  directPortalUrl: string;
  openPortalUrl?: string;
  error?: string;
}

export interface JobValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  hasVerifiedDeadline: boolean;
}

export interface JobSourceAdapter {
  sourceId: string;
  sourceName: string;
  sourceType: SourceType;
  officialDomain: string;
  compatibilityStatus: SourceCompatibilityStatus;
  accessMethodType?: SourceAccessMethodType;
  publisherType?: SourcePublisherType;
  accessMethod: string;
  verificationLevel: SourceVerificationStatus;
  directSourceUrl: string;
  minPollCooldownMs?: number;
  complianceNotes?: string;
  notes: string;
  fetchJobs: (signal?: AbortSignal) => Promise<SourceFetchOutcome>;
  parseJob: (raw: RawSourceJobItem, checkedAt?: number) => NormalizedJobCircular;
  validateJob: (job: NormalizedJobCircular) => JobValidationResult;
  getApplicationUrl: (rawOrJob: RawSourceJobItem | NormalizedJobCircular) => string | null;
  getCircularUrl: (rawOrJob: RawSourceJobItem | NormalizedJobCircular) => string | undefined;
}
