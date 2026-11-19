// JobFill BD - Real Dashboard Statistics Computer
// Aggregates real local counts from IndexedDB stores (never fabricates counters).

import type { UserProfile } from '../../types/profile';
import type {
  ApplicationTrackerRecord,
  BookmarkRecord,
  NormalizedJobCircular,
} from '../../jobs/types/job.types';
import { evaluateProfileEligibility } from '../../jobs/services/eligibility-helper';
import { DAY_MS } from '../../jobs/services/deadline-parser';

export interface DashboardRealStats {
  totalActiveJobs: number;
  matchingJobsCount: number;
  bookmarkedJobsCount: number;
  applicationsSubmittedCount: number;
  upcomingDeadlinesCount: number;
  upcomingExamsCount: number;
}

const SUBMITTED_STATUSES = new Set([
  'Applied',
  'Payment Pending',
  'Payment Completed',
  'Admit Card Available',
  'Exam Scheduled',
  'Result Published',
  'Selected',
]);

export function computeRealDashboardStats(
  profile: UserProfile,
  jobs: NormalizedJobCircular[],
  bookmarks: BookmarkRecord[],
  applications: ApplicationTrackerRecord[],
  now: number = Date.now()
): DashboardRealStats {
  const activeJobs = jobs.filter((j) => j.status !== 'expired');
  const matchingJobsCount = activeJobs.filter(
    (j) => evaluateProfileEligibility(profile, j).overallStatus === 'ELIGIBLE'
  ).length;

  const upcomingDeadlinesCount = activeJobs.filter(
    (j) =>
      j.deadlineVerified &&
      typeof j.deadlineAt === 'number' &&
      j.deadlineAt > now &&
      j.deadlineAt - now <= 7 * DAY_MS
  ).length;

  const applicationsSubmittedCount = applications.filter((a) =>
    SUBMITTED_STATUSES.has(a.status)
  ).length;

  const upcomingExamsCount = applications.filter((a) => {
    if (!a.examDate) return false;
    const examTs = Date.parse(`${a.examDate}T23:59:59+06:00`);
    return Number.isFinite(examTs) && examTs >= now;
  }).length;

  return {
    totalActiveJobs: activeJobs.length,
    matchingJobsCount,
    bookmarkedJobsCount: bookmarks.length,
    applicationsSubmittedCount,
    upcomingDeadlinesCount,
    upcomingExamsCount,
  };
}
