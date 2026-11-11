// JobFill BD - Background Job Check & Notification Orchestrator
// Coordinates source fetching -> normalization/dedup -> deadline validation ->
// daily digest -> deadline reminder scheduler -> next Chrome alarm setup.

import { JobSourceRegistry } from '../sources/source-registry';
import { fetchFromSources, SourceProgressEvent } from '../services/job-fetcher';
import { deduplicateAndMergeJobs } from '../services/job-deduplicator';
import { JobRepository } from '../database/job-repository';
import { ApplicationRepository } from '../database/application-repository';
import { DailyDigestService, jobMatchesPreferences } from '../notifications/daily-digest';
import { NotificationScheduler } from '../notifications/notification-scheduler';
import { NotificationManager } from '../notifications/notification-manager';
import {
  JobAlarmManager,
  ALARM_DAILY_CHECK,
  ALARM_DEADLINE_SCHEDULER,
  ALARM_FEE_CHECK_PREFIX,
} from './alarm-manager';
import { SourceFetchOutcome, deriveSourceConnectionStatus } from '../types/source.types';
import { fetchTeletalkGovtOrganizations } from '../sources/teletalk/teletalk.adapter';
import {
  SourceHealthSummary,
  computeSourceHealthSummary,
  selectAuthoritativeSourceOutcome,
} from '../services/source-health-state';
import { registerDynamicOrgAliases } from '../services/search-engine';
import { recordExtensionDiagnostic } from '../../security/diagnostics';
import { fetchApprovedPublicJobsPage } from '../../cloud/public-jobs-client';

export interface FullJobCheckReport {
  checkedAt: number;
  sourceOutcomes: SourceFetchOutcome[];
  sourceHealth?: SourceHealthSummary;
  totalStoredJobs: number;
  newJobsCount: number;
  updatedJobsCount: number;
  duplicatesSkipped: number;
  dailyDigestSent: boolean;
  deadlineRemindersSent: number;
  nextDeadlineAlarmAt: number | null;
}

export class JobCheckService {
  private static activeCheckPromise: Promise<FullJobCheckReport> | null = null;

  public static async runFullCheck(
    options: {
      forceDigest?: boolean;
      skipFetch?: boolean;
      respectCooldowns?: boolean;
      sourceIds?: string[];
      onSourceProgress?: (event: SourceProgressEvent) => void;
    } = {}
  ): Promise<FullJobCheckReport> {
    if (this.activeCheckPromise) {
      return this.activeCheckPromise;
    }

    this.activeCheckPromise = (async () => {
      const now = Date.now();
      recordExtensionDiagnostic('background_task_run', {
        source: 'JobCheckService.runFullCheck',
        detail: options.skipFetch ? 'skip_fetch_check' : 'source_sync_check',
      });
      let sourceOutcomes: SourceFetchOutcome[] = [];
      let newJobsCount = 0;
      let updatedJobsCount = 0;
      let duplicatesSkipped = 0;
      let newlyAddedJobs: typeof existingJobs = [];
      let deadlineChangedIds: string[] = [];

      const existingJobs = await JobRepository.getAllJobs(now);
      let workingJobs = existingJobs;

      if (!options.skipFetch) {
        const allAdapters = JobSourceRegistry.getAll();
        const isTargetedRetry = Array.isArray(options.sourceIds) && options.sourceIds.length > 0;
        const targetIdSet = isTargetedRetry ? new Set(options.sourceIds) : null;
        const adapters = targetIdSet
          ? allAdapters.filter((a) => targetIdSet.has(a.sourceId))
          : allAdapters;

        const prevOutcomesList = await JobRepository.getSourceOutcomes();
        const previousOutcomesById = new Map<string, any>(
          prevOutcomesList.map((o: any) => [o.sourceId, o])
        );

        const fetchedOutcomes = await fetchFromSources(adapters, undefined, {
          respectCooldowns: Boolean(options.respectCooldowns && !isTargetedRetry),
          isManualRetry: isTargetedRetry,
          previousOutcomesById,
          onSourceProgress: options.onSourceProgress,
        });

        let cloudPublicJobs: typeof workingJobs = [];
        if (
          !isTargetedRetry &&
          !(typeof __JOBFILL_CLOUD_SYNC_DISABLED__ !== 'undefined' && __JOBFILL_CLOUD_SYNC_DISABLED__)
        ) {
          try {
            const cloudPage = await fetchApprovedPublicJobsPage({ offset: 0, limit: 100 });
            if (cloudPage?.jobs?.length) {
              cloudPublicJobs = cloudPage.jobs;
            }
          } catch {
            // Fall back smoothly to local adapters & cache when cloud DB is offline/unconfigured
          }
        }

        const incoming = [...cloudPublicJobs, ...fetchedOutcomes.flatMap((o) => o.jobs)];
        // Re-read latest stored jobs so any manual circulars added mid-fetch are preserved in index/counts
        const latestExistingJobs = await JobRepository.getAllJobs(now);
        const mergeRes = deduplicateAndMergeJobs(latestExistingJobs, incoming, now);
        workingJobs = mergeRes.mergedJobs;
        newlyAddedJobs = mergeRes.newJobs;
        deadlineChangedIds = mergeRes.deadlineChangedJobIds;
        newJobsCount = mergeRes.newJobs.length;
        updatedJobsCount = mergeRes.updatedJobs.length;
        duplicatesSkipped = mergeRes.duplicateCount;

        const storedCountBySource = new Map<string, number>();
        for (const item of workingJobs) {
          storedCountBySource.set(item.sourceId, (storedCountBySource.get(item.sourceId) ?? 0) + 1);
        }
        const insertedBySource = new Map<string, number>();
        for (const item of mergeRes.newJobs) {
          insertedBySource.set(item.sourceId, (insertedBySource.get(item.sourceId) ?? 0) + 1);
        }
        const updatedBySource = new Map<string, number>();
        for (const item of mergeRes.updatedJobs) {
          updatedBySource.set(item.sourceId, (updatedBySource.get(item.sourceId) ?? 0) + 1);
        }

        const freshOutcomes = fetchedOutcomes.map((o) => {
          const prevForSource = previousOutcomesById.get(o.sourceId);
          const isHealthy =
            Boolean(o.success) &&
            o.compatibilityStatus !== 'unavailable' &&
            o.compatibilityStatus !== 'manual_only';
          const inserted = insertedBySource.get(o.sourceId) ?? 0;
          const updated = updatedBySource.get(o.sourceId) ?? 0;
          const retrieved = o.skippedByCooldown
            ? typeof o.jobCount === 'number'
              ? o.jobCount
              : 0
            : o.jobs.length;
          const duplicates = o.skippedByCooldown ? 0 : Math.max(0, retrieved - inserted - updated);
          const totalStored = storedCountBySource.get(o.sourceId) ?? 0;
          const candidateOutcome: SourceFetchOutcome = {
            ...o,
            connectionStatus: o.connectionStatus || deriveSourceConnectionStatus(o),
            insertedCount: o.skippedByCooldown ? (o.insertedCount ?? 0) : inserted,
            updatedCount: o.skippedByCooldown ? (o.updatedCount ?? 0) : updated,
            duplicateCount: o.skippedByCooldown ? (o.duplicateCount ?? 0) : duplicates,
            rejectedCount: o.rejectedCount ?? 0,
            totalIndexedCount: totalStored,
            savedCount: isHealthy ? totalStored : 0,
          };
          // Never allow an older stale cached outcome to overwrite a fresher attempt or failure
          return (
            (selectAuthoritativeSourceOutcome(prevForSource, candidateOutcome) as SourceFetchOutcome) ||
            candidateOutcome
          );
        });

        if (isTargetedRetry) {
          const freshById = new Map(freshOutcomes.map((o) => [o.sourceId, o]));
          sourceOutcomes = allAdapters
            .map((a) => freshById.get(a.sourceId) || previousOutcomesById.get(a.sourceId))
            .filter(Boolean);
        } else {
          sourceOutcomes = freshOutcomes;
        }

        await JobRepository.saveJobs(workingJobs);
        await JobRepository.rebuildSearchIndex(workingJobs);
        await JobRepository.saveSourceOutcomes(sourceOutcomes);

        if (adapters.some((a) => a.sourceId === 'teletalk')) {
          try {
            const orgRes = await fetchTeletalkGovtOrganizations(workingJobs);
            if (orgRes.organizations.length > 0) {
              registerDynamicOrgAliases(orgRes.organizations);
              await JobRepository.saveGovtOrganizations(orgRes.organizations);
            }
          } catch (orgErr) {
            console.warn('JobFill BD [JobCheckService]: Govt org directory update skipped:', orgErr);
          }
        }

        await JobRepository.addSyncHistory({
          id: `sync_${now}_${Math.random().toString(36).slice(2, 6)}`,
          syncedAt: now,
          totalRetrieved: incoming.length,
          newJobsCount,
          updatedJobsCount,
          duplicatesRemoved: duplicatesSkipped,
          sourceSummaries: freshOutcomes.map((o) => ({
            sourceId: o.sourceId,
            sourceName: o.sourceName,
            status: o.connectionStatus || deriveSourceConnectionStatus(o),
            retrieved:
              o.skippedByCooldown && typeof o.jobCount === 'number' ? o.jobCount : o.jobs.length,
            saved: o.savedCount ?? 0,
            error: o.error,
          })),
        });

        console.info(
          `JobFill BD [JobCheckService]: sources=${sourceOutcomes.length} retrieved=${incoming.length} new=${newJobsCount} updated=${updatedJobsCount} totalStored=${workingJobs.length}`
        );
      }

      const prefs = await JobRepository.getPreferences();

      // Emit deadline_changed notifications for previously saved jobs whose closing date moved
      if (deadlineChangedIds.length > 0 && prefs.deadlineRemindersEnabled) {
        const jobMap = new Map(workingJobs.map((j) => [j.id, j]));
        for (const changedId of deadlineChangedIds.slice(0, 3)) {
          const changedJob = jobMap.get(changedId);
          if (!changedJob) continue;
          await NotificationManager.dispatch({
            type: 'deadline_changed',
            title: `Deadline Updated: ${changedJob.jobTitle}`,
            message: `${changedJob.organization} updated the closing deadline${changedJob.deadlineText ? ` to ${changedJob.deadlineText}` : ''}. Verify official circular before applying.`,
            jobId: changedJob.id,
            jobTitle: changedJob.jobTitle,
            organization: changedJob.organization,
            deadlineAt: changedJob.deadlineAt ?? null,
            circularUrl: changedJob.circularUrl,
            applicationUrl: changedJob.applicationUrl,
            isUrgent: false,
            actionButtonTitle: 'Open Job Details',
            routeTab: 'circulars',
            createdAt: now,
          });
        }
      }

      // Run Daily Digest if due (or forced)
      const digestRes = await DailyDigestService.runDailyDigestIfDue(workingJobs, prefs, {
        force: options.forceDigest,
        now,
      });

      // Emit matching_job instant alert when user configured personalization filters and digest didn't run now
      const hasCustomFilters =
        prefs.preferredCategories.length > 0 ||
        (prefs.preferredOrganizations?.length ?? 0) > 0 ||
        (prefs.includeKeywords?.length ?? 0) > 0 ||
        prefs.preferredLocations.length > 0 ||
        prefs.preferredEducation.length > 0;
      if (!digestRes.sent && hasCustomFilters && newlyAddedJobs.length > 0) {
        const matchedNew = newlyAddedJobs.filter((j) => j.status !== 'expired' && jobMatchesPreferences(j, prefs));
        if (matchedNew.length > 0) {
          const lead = matchedNew[0];
          await NotificationManager.dispatch({
            type: 'matching_job',
            title: `JobFill BD – ${matchedNew.length} Matching Job${matchedNew.length === 1 ? '' : 's'} Found`,
            message:
              matchedNew.length === 1
                ? `${lead.jobTitle} (${lead.organization}) matches your saved job preferences.`
                : `${lead.jobTitle} (${lead.organization}) and ${matchedNew.length - 1} other new circular(s) match your saved preferences.`,
            jobId: lead.id,
            jobTitle: lead.jobTitle,
            organization: lead.organization,
            deadlineAt: lead.deadlineAt ?? null,
            circularUrl: lead.circularUrl,
            applicationUrl: lead.applicationUrl,
            isUrgent: false,
            actionButtonTitle: 'Open Job Search',
            routeTab: 'search',
            createdAt: now,
          });
        }
      }

      // Run Deadline Reminder Scheduler & schedule next Chrome Alarm
      const schedSummary = await NotificationScheduler.runCycle(now);
      await JobAlarmManager.scheduleNextDeadlineAlarm(schedSummary.nextAlarmAt);

      const prevState = await JobRepository.getSchedulerState();
      const allRegisteredAdapters = JobSourceRegistry.getAll();
      if (options.skipFetch) {
        sourceOutcomes = await JobRepository.getSourceOutcomes();
      }
      const anySourceSucceeded = sourceOutcomes.some(
        (o) => o.success && o.compatibilityStatus !== 'unavailable' && o.compatibilityStatus !== 'manual_only'
      );
      const nextLastSuccessfulSyncAt = options.skipFetch
        ? prevState.lastSuccessfulSyncAt ?? null
        : anySourceSucceeded
          ? now
          : prevState.lastSuccessfulSyncAt ?? null;

      await JobRepository.saveSchedulerState({
        ...prevState,
        lastDailyCheckAt: now,
        lastSuccessfulSyncAt: nextLastSuccessfulSyncAt,
        nextScheduledAlarmAt: schedSummary.nextAlarmAt,
      });

      const sourceHealth = computeSourceHealthSummary(
        allRegisteredAdapters,
        sourceOutcomes,
        nextLastSuccessfulSyncAt
      );

      return {
        checkedAt: now,
        sourceOutcomes,
        sourceHealth,
        totalStoredJobs: workingJobs.length,
        newJobsCount,
        updatedJobsCount,
        duplicatesSkipped,
        dailyDigestSent: digestRes.sent,
        deadlineRemindersSent: schedSummary.notificationsSent.length,
        nextDeadlineAlarmAt: schedSummary.nextAlarmAt,
      };
    })();

    try {
      return await this.activeCheckPromise;
    } finally {
      this.activeCheckPromise = null;
    }
  }

  public static async runRetrySources(
    sourceIds?: string[],
    options: { onSourceProgress?: (event: SourceProgressEvent) => void } = {}
  ): Promise<FullJobCheckReport> {
    let targetIds = Array.isArray(sourceIds) ? sourceIds.filter(Boolean) : [];
    if (targetIds.length === 0) {
      const prevOutcomes = await JobRepository.getSourceOutcomes();
      const summary = computeSourceHealthSummary(JobSourceRegistry.getAll(), prevOutcomes);
      targetIds = summary.retryableSourceIds;
    }

    if (targetIds.length === 0) {
      return this.runFullCheck({
        skipFetch: true,
        onSourceProgress: options.onSourceProgress,
      });
    }

    return this.runFullCheck({
      sourceIds: targetIds,
      onSourceProgress: options.onSourceProgress,
    });
  }

  public static async runDeadlineTickOnly(): Promise<void> {
    const summary = await NotificationScheduler.runCycle(Date.now());
    await JobAlarmManager.scheduleNextDeadlineAlarm(summary.nextAlarmAt);
  }

  public static async handleAlarmEvent(alarmName: string): Promise<boolean> {
    // Guard against rapid duplicate alarm events in MV3
    const state = await JobRepository.getSchedulerState();
    const now = Date.now();
    if (
      state.lastAlarmTypeFired === alarmName &&
      state.lastAlarmFiredAt &&
      now - state.lastAlarmFiredAt < 10_000
    ) {
      return false;
    }

    await JobRepository.saveSchedulerState({
      ...state,
      lastAlarmTypeFired: alarmName,
      lastAlarmFiredAt: now,
    });

    if (alarmName === ALARM_DAILY_CHECK) {
      await this.runFullCheck({ respectCooldowns: true });
      return true;
    }

    if (alarmName === ALARM_DEADLINE_SCHEDULER) {
      await this.runDeadlineTickOnly();
      return true;
    }

    if (alarmName.startsWith(ALARM_FEE_CHECK_PREFIX)) {
      const jobId = alarmName.slice(ALARM_FEE_CHECK_PREFIX.length);
      const record = await ApplicationRepository.getByJobId(jobId);
      if (
        record &&
        record.feePaymentStatus === 'unpaid' &&
        typeof record.feeDeadlineAt === 'number' &&
        record.feeDeadlineAt > Date.now()
      ) {
        const hoursLeft = Math.max(1, Math.ceil((record.feeDeadlineAt - Date.now()) / (60 * 60 * 1000)));
        const userIdLabel = record.teletalkUserId ? `User ID: ${record.teletalkUserId}` : 'Payment Required';
        if (typeof chrome !== 'undefined' && chrome.notifications?.create) {
          const notifId = `jobfill_fee_alert_${jobId}_${Date.now()}`;
          await new Promise<void>((resolve) => {
            chrome.notifications.create(
              notifId,
              {
                type: 'basic',
                iconUrl: chrome.runtime?.getURL?.('icons/icon128.png') || 'icons/icon128.png',
                title: `💳 Fee Payment Urgent (${hoursLeft}h left)`,
                message: `${record.jobTitle} (${record.organization}) — ${userIdLabel}. Complete Teletalk/portal fee payment before expiry.`,
                priority: 2,
              },
              () => resolve()
            );
          });
        }
        return true;
      }
      return false;
    }

    return false;
  }
}
