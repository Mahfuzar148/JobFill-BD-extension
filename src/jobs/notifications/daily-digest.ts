// JobFill BD - Daily Job Digest Service
// Evaluates new/meaningfully updated jobs against user preferences and sends
// a single non-duplicate daily update at the configured Asia/Dhaka time (default 9:00 AM).

import { NormalizedJobCircular, JobPreferences, JobNotificationRecord } from '../types/job.types';
import { getDhakaDateKey, getDhakaParts, dhakaWallTimeToUtcMs, DAY_MS } from '../services/deadline-parser';
import { JobRepository } from '../database/job-repository';
import { NotificationManager } from './notification-manager';

export function jobMatchesPreferences(job: NormalizedJobCircular, prefs: JobPreferences): boolean {
  if (prefs.preferredCategories.length > 0) {
    const matchesCat = prefs.preferredCategories.some((cat) => {
      if (cat === job.category) return true;
      if (cat === 'Education' && (job.category === 'Teaching' || job.category === 'University')) return true;
      if (cat === 'Defence' && job.category === 'Defence / Security') return true;
      if (cat === 'Defence / Security' && job.category === 'Defence') return true;
      return false;
    });
    if (!matchesCat) return false;
  }

  const orgPrefs = (prefs.preferredOrganizations || []).map((o) => o.trim().toLowerCase()).filter(Boolean);
  if (orgPrefs.length > 0) {
    const orgHaystack = `${job.organization} ${job.organizationBn || ''}`.toLowerCase();
    if (!orgPrefs.some((org) => orgHaystack.includes(org))) {
      return false;
    }
  }

  if (prefs.preferredLocations.length > 0 && !prefs.preferredLocations.includes(job.location as any)) {
    // 'All Bangladesh' jobs remain relevant to all location preferences
    if (job.location !== 'All Bangladesh') return false;
  }
  if (prefs.preferredEmploymentTypes.length > 0 && !prefs.preferredEmploymentTypes.includes(job.employmentType)) {
    return false;
  }

  const workMode = prefs.workModePreference || 'Any';
  if (workMode !== 'Any') {
    const isRemote =
      job.category === 'Remote Jobs' ||
      job.sourceId === 'remotive_remote' ||
      job.sourceId === 'remoteok_remote' ||
      job.sourceId === 'himalayas_remote' ||
      job.sourceId === 'arbeitnow_remote' ||
      /\bremote\b/i.test(`${job.jobTitle} ${job.location}`);
    if (workMode === 'Remote' && !isRemote) return false;
    if (workMode === 'On-Site' && isRemote) return false;
  }

  if (prefs.preferredEducation.length > 0 && !prefs.preferredEducation.includes('Any Qualification')) {
    const jobQual = String(job.qualification || '').toLowerCase();
    const matchesQual = prefs.preferredEducation.some((eq) => jobQual.includes(eq.toLowerCase()));
    if (!matchesQual && jobQual !== 'any qualification') return false;
  }
  if (prefs.minimumSalary && job.salary) {
    const numMatch = job.salary.replace(/,/g, '').match(/\d{4,6}/);
    if (numMatch && Number(numMatch[0]) < prefs.minimumSalary) {
      return false;
    }
  }

  const haystack = `${job.jobTitle} ${job.titleBn || ''} ${job.organization} ${job.organizationBn || ''} ${job.position} ${job.qualification} ${job.description || ''} ${job.category} ${job.location}`.toLowerCase();

  const excludes = (prefs.excludeKeywords || []).map((k) => k.trim().toLowerCase()).filter(Boolean);
  if (excludes.length > 0 && excludes.some((kw) => haystack.includes(kw))) {
    return false;
  }

  const includes = (prefs.includeKeywords || []).map((k) => k.trim().toLowerCase()).filter(Boolean);
  if (includes.length > 0 && !includes.some((kw) => haystack.includes(kw))) {
    return false;
  }

  return true;
}

export function getNextDailyDigestTimeUtc(prefs: JobPreferences, now: number = Date.now()): number {
  const parts = getDhakaParts(now);
  const todaySlot = dhakaWallTimeToUtcMs(
    parts.year,
    parts.month,
    parts.day,
    prefs.notificationHour,
    prefs.notificationMinute,
    0
  );
  if (now < todaySlot) {
    return todaySlot;
  }
  return todaySlot + DAY_MS;
}

export function isDailyDigestDue(
  lastDigestDateKey: string | null,
  prefs: JobPreferences,
  now: number = Date.now()
): boolean {
  if (!prefs.dailyDigestEnabled) return false;
  const todayKey = getDhakaDateKey(now);
  if (lastDigestDateKey === todayKey) return false;

  const parts = getDhakaParts(now);
  const todaySlot = dhakaWallTimeToUtcMs(
    parts.year,
    parts.month,
    parts.day,
    prefs.notificationHour,
    prefs.notificationMinute,
    0
  );
  return now >= todaySlot;
}

export interface DailyDigestResult {
  sent: boolean;
  newMatchingCount: number;
  upcomingDeadlineCount: number;
  notification?: JobNotificationRecord;
}

export class DailyDigestService {
  public static async runDailyDigestIfDue(
    jobs: NormalizedJobCircular[],
    prefs: JobPreferences,
    options: { force?: boolean; now?: number } = {}
  ): Promise<DailyDigestResult> {
    const now = options.now ?? Date.now();
    const state = await JobRepository.getSchedulerState();
    const todayKey = getDhakaDateKey(now);

    if (!options.force && !isDailyDigestDue(state.lastDailyDigestDateKey, prefs, now)) {
      return { sent: false, newMatchingCount: 0, upcomingDeadlineCount: 0 };
    }

    const seenIds = new Set(await JobRepository.getSeenDigestJobIds());
    const activeJobs = jobs.filter((j) => j.status !== 'expired');
    const matchingNewJobs = activeJobs.filter(
      (j) => !seenIds.has(`${j.id}@${j.lastUpdatedAt}`) && jobMatchesPreferences(j, prefs)
    );

    const upcomingDeadlines = activeJobs.filter(
      (j) =>
        j.deadlineVerified &&
        typeof j.deadlineAt === 'number' &&
        j.deadlineAt > now &&
        j.deadlineAt - now <= 7 * DAY_MS &&
        jobMatchesPreferences(j, prefs)
    );

    if (matchingNewJobs.length === 0 && upcomingDeadlines.length === 0) {
      await JobRepository.saveSchedulerState({
        ...state,
        lastDailyDigestDateKey: todayKey,
      });
      return { sent: false, newMatchingCount: 0, upcomingDeadlineCount: 0 };
    }

    const parts: string[] = [];
    if (matchingNewJobs.length > 0) {
      parts.push(
        `${matchingNewJobs.length} new job circular${matchingNewJobs.length === 1 ? '' : 's'} found today.`
      );
    }
    if (upcomingDeadlines.length > 0) {
      parts.push(
        `${upcomingDeadlines.length} upcoming deadline${upcomingDeadlines.length === 1 ? '' : 's'} within 7 days.`
      );
    }

    const notification = await NotificationManager.dispatch({
      type: 'daily_digest',
      title: 'JobFill BD – Daily Job Update',
      message: parts.join(' '),
      jobId: matchingNewJobs[0]?.id || upcomingDeadlines[0]?.id,
      jobTitle: matchingNewJobs[0]?.jobTitle,
      organization: matchingNewJobs[0]?.organization,
      isUrgent: false,
      actionButtonTitle: 'Open Job Circular Dashboard',
      routeTab: 'circulars',
      createdAt: now,
    });

    await JobRepository.addSeenDigestJobIds(activeJobs.map((j) => `${j.id}@${j.lastUpdatedAt}`));
    await JobRepository.saveSchedulerState({
      ...state,
      lastDailyDigestDateKey: todayKey,
    });

    return {
      sent: true,
      newMatchingCount: matchingNewJobs.length,
      upcomingDeadlineCount: upcomingDeadlines.length,
      notification,
    };
  }
}
