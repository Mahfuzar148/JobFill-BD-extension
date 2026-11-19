// JobFill BD - BD Govt Job (bdgovtjob.net) Integration Types
// Models article discovery, multi-circular breakdown, official source verification,
// and conflict detection for BPSC recruitment notices.

import { OfficialSourceVerificationStatus } from '../../types/job.types';

export interface BdGovtJobArticleMetadata {
  title: string;
  titleBn: string;
  canonicalUrl: string;
  publishedAt: number | null;
  publishedDateText: string | null;
  author: string | null;
  circularImages: string[];
  pdfLinks: string[];
  paginationLinks: string[];
  relatedBpscLinks: string[];
  summaryTableData: Record<string, string>;
  rawHtmlLength: number;
}

export interface BdGovtJobNoticeItem {
  sectionIndex: number;
  sectionTitle: string;
  jobTitle: string;
  titleBn?: string;
  organization: string;
  organizationBn: string;
  recruitmentType: string;
  postNames: string[];
  vacancies: number | null;
  qualification: string | null;
  ageRequirement: string | null;
  experience: string | null;
  salary: string | null;
  gradeNumber: number | null;
  applicationStartText: string | null;
  applicationStartTime: string | null;
  deadlineText: string | null;
  applicationDeadlineTime: string | null;
  applicationUrl: string | null;
  officialSourceUrl: string | null;
  circularDocumentUrl: string | null;
  circularImages: string[];
  memorandumNumber: string | null;
  publishedDateText: string | null;
  sourceArticleUrl: string;
  verificationStatus: OfficialSourceVerificationStatus;
  lastVerifiedAt: number | null;
  hasConflict: boolean;
  conflictNotes: string[];
}

export interface BdGovtJobConflictReport {
  noticeIndex: number;
  noticeTitle: string;
  issueType: 'DEADLINE_MISMATCH' | 'CLOSED_BUT_FUTURE' | 'VACANCY_MISMATCH' | 'SOURCE_DISCREPANCY';
  description: string;
  articleClaim: string;
  verifiedOrAlternativeClaim: string;
}

export interface OfficialVerificationResult {
  status: OfficialSourceVerificationStatus;
  officialSourceUrl: string | null;
  applicationUrl: string | null;
  lastVerifiedAt: number;
  notes: string[];
}

export interface BdGovtJobCardData {
  postId: string;
  title: string;
  canonicalUrl: string;
  category: string;
  earliestDeadline: number | null;
  latestDeadline: number | null;
  deadlinesList: string[];
  vacancies: number | null;
  imageUrl?: string;
  publishedDateText?: string;
  isNew?: boolean;
}

export interface BdGovtJobPaginationInfo {
  currentPage: number;
  totalPages: number;
  nextPageUrl: string | null;
  prevPageUrl: string | null;
  pageLinks: string[];
}

export interface BdGovtJobCrawlCheckpoint {
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
  multiNoticeArticlesCount?: number;
  pdfUrlsDiscovered?: string[];
  reviewRequiredCount?: number;
  officialVerifiedCount?: number;
  secondaryOnlyCount?: number;
}

export interface BdGovtJobCrawlOptions {
  mode?: 'ALL_JOBS' | 'BPSC_ONLY' | 'INCREMENTAL';
  maxPages?: number;
  deepExtraction?: boolean;
  rateLimitMs?: number;
  forceRestart?: boolean;
  signal?: AbortSignal;
}
