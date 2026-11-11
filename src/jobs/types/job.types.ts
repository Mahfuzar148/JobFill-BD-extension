// JobFill BD - Normalized Job Circular & Notification System Types
// Local-first, Asia/Dhaka timezone aware, zero fabricated deadlines.

export type JobCategory =
  | 'Government'
  | 'Private'
  | 'Bank'
  | 'NGO'
  | 'University'
  | 'Autonomous Organization'
  | 'Defence / Security'
  | 'Defence'
  | 'Education'
  | 'Teaching'
  | 'IT / Technology'
  | 'Healthcare'
  | 'Remote Jobs'
  | 'International Jobs'
  | 'Other';

export type EducationRequirement =
  | 'SSC'
  | 'HSC'
  | 'Diploma'
  | 'Bachelor'
  | 'Honours'
  | 'Masters'
  | 'PhD'
  | 'Any Qualification';

export type JobEmploymentType =
  | 'Full Time'
  | 'Part Time'
  | 'Contractual'
  | 'Internship'
  | 'Temporary';

export type JobLocation =
  | 'All Bangladesh'
  | 'Dhaka'
  | 'Rajshahi'
  | 'Chattogram'
  | 'Khulna'
  | 'Rangpur'
  | 'Barishal'
  | 'Sylhet'
  | 'Mymensingh'
  | 'Other';

export type SourceVerificationStatus =
  | 'official_verified'
  | 'official_partial'
  | 'discovery_only'
  | 'user_submitted'
  | 'unverified';

export type JobCircularStatus = 'active' | 'closing_soon' | 'expired';

export type FieldVerificationState = 'verified' | 'partial' | 'unverified';

export interface JobFieldVerificationMap {
  title: FieldVerificationState;
  organization: FieldVerificationState;
  deadline: FieldVerificationState;
  vacancy: FieldVerificationState;
  salary: FieldVerificationState;
  qualification: FieldVerificationState;
  applicationUrl: FieldVerificationState;
  circularUrl: FieldVerificationState;
}

export interface JobOriginalValues {
  title?: string;
  titleBn?: string | null;
  organization?: string;
  organizationBn?: string | null;
  deadlineText?: string;
  publishedDateText?: string;
  applicationStartText?: string;
  location?: string;
}

export interface AlternateSourceLink {
  sourceId: string;
  sourceName: string;
  circularUrl?: string;
  applicationUrl?: string | null;
  organizationUrl?: string;
  sourceUrl?: string | null;
  verificationStatus: SourceVerificationStatus;
}

export interface NormalizedJobCircular {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceJobId?: string | null;
  organizationId?: number;
  organizationShortName?: string;
  organization: string;
  organizationBn?: string | null;
  organizationLogo?: string;
  jobTitle: string;
  titleBn?: string | null;
  position: string;
  circularNumber?: string;
  category: JobCategory;
  employmentType: JobEmploymentType;
  vacancies?: number | null;
  salary?: string;
  qualification: EducationRequirement | string;
  experience?: string;
  ageRequirement?: string;
  location: JobLocation | string;
  publishedAt: number | null;
  publishedDateText?: string;
  applicationStartAt: number | null;
  applicationStartText?: string;
  deadlineAt: number | null;
  deadlineText?: string;
  deadlineTimezone: 'Asia/Dhaka';
  timezone?: 'Asia/Dhaka' | 'UTC';
  deadlineVerified: boolean;
  deadlineNeedsRevalidation?: boolean;
  circularUrl?: string;
  applicationUrl: string | null;
  organizationUrl?: string;
  sourceUrl?: string | null;
  description: string;
  requirements: string[];
  applicationFee?: string;
  applicationProcedure?: string;
  requiredDocuments?: string[];
  sourceVerification: SourceVerificationStatus;
  fieldVerification?: JobFieldVerificationMap;
  sourceLastCheckedAt: number;
  sourceLastVerifiedAt?: number | null;
  firstDiscoveredAt: number;
  lastUpdatedAt: number;
  status: JobCircularStatus;
  fingerprintHash?: string;
  alternateSources?: AlternateSourceLink[];
  originalValues?: JobOriginalValues;
  possibleDuplicateOfId?: string | null;
  duplicateConfidence?: number | null;
  isManual?: boolean;
  notes?: string;
  verificationHistory?: Array<{
    timestamp: number;
    status: SourceVerificationStatus;
    action: string;
    sourceUrl?: string | null;
    note?: string;
  }>;
}

export type DeadlineFilterOption =
  | 'all'
  | 'closing_soon'
  | 'more_than_7_days'
  | '3_to_7_days'
  | '1_to_2_days'
  | 'closing_today'
  | 'expired';

export type DashboardStatFilter =
  | 'total'
  | 'new_this_week'
  | 'closing_soon'
  | 'expired'
  | 'bookmarked'
  | 'in_progress';

export type JobSortOption =
  | 'latest_published'
  | 'deadline_soonest'
  | 'recently_expired'
  | 'organization_name'
  | 'recently_updated';

export interface JobSearchFilters {
  query: string;
  category: JobCategory | 'All';
  education: EducationRequirement | 'All';
  employmentType: JobEmploymentType | 'All';
  deadline: DeadlineFilterOption;
  location: JobLocation | 'All';
  sortBy: JobSortOption;
  bookmarkedOnly?: boolean;
  statFilter?: DashboardStatFilter;
}

export interface BookmarkRecord {
  jobId: string;
  savedAt: number;
  note?: string;
}

export type ApplicationStatus =
  | 'Interested'
  | 'Bookmarked'
  | 'Saved'
  | 'Ready to Apply'
  | 'Applied'
  | 'Exam Scheduled'
  | 'Result Published'
  | 'Selected'
  | 'Rejected'
  | 'Expired';

export type FeePaymentStatus = 'unpaid' | 'paid' | 'exempt' | 'expired';

export interface ApplicationTrackerRecord {
  jobId: string;
  jobTitle: string;
  organization: string;
  applicationUrl?: string | null;
  circularUrl?: string;
  deadlineAt: number | null;
  status: ApplicationStatus;
  applicationDate?: string;
  teletalkUserId?: string;
  applicationRefId?: string;
  feePaymentStatus?: FeePaymentStatus;
  feeDeadlineAt?: number | null;
  examRoll?: string;
  examVenue?: string;
  notes?: string;
  examDate?: string;
  admitCardUrl?: string;
  resultUrl?: string;
  createdAt: number;
  updatedAt: number;
}

export type ReminderStatus =
  | 'scheduled_daily'
  | 'scheduled_urgent_2h'
  | 'final_countdown'
  | 'snoozed'
  | 'dismissed'
  | 'applied_stopped'
  | 'expired'
  | 'needs_revalidation'
  | 'unverified_deadline';

export interface ReminderScheduleRecord {
  jobId: string;
  deadlineAt: number | null;
  lastReminderAt: number | null;
  nextReminderAt: number | null;
  reminderCount: number;
  reminderStatus: ReminderStatus;
  snoozedUntil: number | null;
  dismissed: boolean;
  markedAsApplied: boolean;
  deadlineUpdatedAt?: number | null;
}

export type NotificationCategoryType =
  | 'new_job'
  | 'matching_job'
  | 'daily_digest'
  | 'deadline_reminder'
  | 'deadline_changed'
  | 'urgent_deadline'
  | 'expired_job';

export interface JobNotificationRecord {
  id: string;
  type: NotificationCategoryType;
  title: string;
  message: string;
  jobId?: string;
  jobTitle?: string;
  organization?: string;
  deadlineAt?: number | null;
  remainingText?: string;
  circularUrl?: string;
  applicationUrl?: string | null;
  isUrgent: boolean;
  isRead: boolean;
  createdAt: number;
}

export type ExperienceLevelPreference = 'Any' | 'Fresh Graduate' | '1-3 Years' | '3+ Years';

export type WorkModePreference = 'Any' | 'Remote' | 'On-Site';

export interface JobPreferences {
  dailyDigestEnabled: boolean;
  deadlineRemindersEnabled: boolean;
  notificationHour: number; // 0-23 Asia/Dhaka, default 9
  notificationMinute: number; // 0-59 Asia/Dhaka, default 0
  stopRemindersWhenApplied: boolean;
  preferredCategories: JobCategory[];
  preferredOrganizations?: string[];
  preferredEducation: EducationRequirement[];
  preferredLocations: JobLocation[];
  preferredEmploymentTypes: JobEmploymentType[];
  minimumSalary?: number;
  experienceLevel: ExperienceLevelPreference;
  workModePreference?: WorkModePreference;
  includeKeywords?: string[];
  excludeKeywords?: string[];
  enableRemotiveSource?: boolean;
  enableRemoteOkSource?: boolean;
  enableHimalayasSource?: boolean;
  enableArbeitnowSource?: boolean;
  reliefwebAppName?: string;
}

export const DEFAULT_JOB_PREFERENCES: JobPreferences = {
  dailyDigestEnabled: true,
  deadlineRemindersEnabled: true,
  notificationHour: 9,
  notificationMinute: 0,
  stopRemindersWhenApplied: true,
  preferredCategories: [],
  preferredOrganizations: [],
  preferredEducation: [],
  preferredLocations: [],
  preferredEmploymentTypes: [],
  minimumSalary: undefined,
  experienceLevel: 'Any',
  workModePreference: 'Any',
  includeKeywords: [],
  excludeKeywords: [],
  enableRemotiveSource: true,
  enableRemoteOkSource: true,
  enableHimalayasSource: true,
  enableArbeitnowSource: true,
  reliefwebAppName: '',
};

export interface SearchIndexEntry {
  jobId: string;
  searchableText: string;
  normalizedTokens: string[];
  category: string;
  updatedAt: number;
}

export interface SavedSearchRecord {
  id: string;
  label: string;
  query: string;
  category: JobCategory | 'All';
  location?: string;
  education?: string;
  createdAt: number;
}

export interface SyncHistoryRecord {
  id: string;
  syncedAt: number;
  totalRetrieved: number;
  newJobsCount: number;
  updatedJobsCount: number;
  duplicatesRemoved: number;
  sourceSummaries: Array<{
    sourceId: string;
    sourceName: string;
    status: string;
    retrieved: number;
    saved: number;
    error?: string;
  }>;
}

export interface GovtOrganizationRecord {
  organizationId: number;
  name: string;
  nameBn: string | null;
  shortName: string;
  shortCode?: string | null;
  logoUrl?: string;
  website?: string;
  openingCount: number;
  expiredCount: number;
  sourceId: 'teletalk';
  sourceUrl: string;
  lastUpdatedAt: number;
}

export interface SchedulerPersistentState {
  lastDailyCheckAt: number | null;
  lastSuccessfulSyncAt?: number | null;
  lastDailyDigestDateKey: string | null; // YYYY-MM-DD in Asia/Dhaka
  lastSchedulerRunAt: number | null;
  nextScheduledAlarmAt: number | null;
  lastAlarmTypeFired?: string;
  lastAlarmFiredAt?: number;
}
