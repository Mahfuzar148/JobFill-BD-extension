// JobFill BD - Smart Deadline Reminder & Daily Digest Scheduler Test Suite
// Uses deterministic synthetic fake timestamps anchored in Asia/Dhaka (+06:00).

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_JOB_PREFERENCES,
  NormalizedJobCircular,
} from '../../src/jobs/types/job.types';
import { normalizeJobRecord } from '../../src/jobs/services/job-normalizer';
import { deduplicateAndMergeJobs } from '../../src/jobs/services/job-deduplicator';
import {
  HOUR_MS,
  DAY_MS,
  dhakaWallTimeToUtcMs,
} from '../../src/jobs/services/deadline-parser';
import { evaluateJobReminderSchedule } from '../../src/jobs/notifications/deadline-reminder';
import { NotificationScheduler } from '../../src/jobs/notifications/notification-scheduler';
import { DailyDigestService } from '../../src/jobs/notifications/daily-digest';
import { JobRepository } from '../../src/jobs/database/job-repository';
import { JobNotificationRepository } from '../../src/jobs/database/notification-repository';
import { ApplicationRepository } from '../../src/jobs/database/application-repository';
import { TabManager } from '../../src/background/tab-manager';

function makeJob(id: string, position: string, deadlineUtcMs: number): NormalizedJobCircular {
  return normalizeJobRecord(
    {
      externalId: id,
      organization: 'Ministry of Public Administration',
      jobTitle: position,
      position,
      category: 'Government',
      location: 'Dhaka',
      deadlineText: new Date(deadlineUtcMs).toISOString(),
      applicationUrl: 'https://alljobs.teletalk.com.bd/apply',
    },
    {
      sourceId: 'teletalk',
      sourceName: 'Teletalk All Jobs',
      verificationLevel: 'official_verified',
      checkedAt: deadlineUtcMs - 10 * DAY_MS,
      defaultApplicationUrl: 'https://alljobs.teletalk.com.bd/',
    }
  );
}

describe('JobFill BD - Daily Digest & Smart Deadline Reminder Scheduler', () => {
  beforeEach(async () => {
    localStorage.clear();
    await JobRepository.clearAll();
    await JobNotificationRepository.clearAll();
    await ApplicationRepository.clearAll();
    await JobRepository.saveReminderSchedules({});
    await JobRepository.savePreferences(DEFAULT_JOB_PREFERENCES);
    await JobRepository.saveSchedulerState({
      lastDailyCheckAt: null,
      lastDailyDigestDateKey: null,
      lastSchedulerRunAt: null,
      nextScheduledAlarmAt: null,
    });
  });

  it('7. Updated deadline: recalculates reminder schedule cleanly when official source extends deadline', () => {
    const now = dhakaWallTimeToUtcMs(2026, 11, 10, 10, 0, 0);
    const oldDeadline = now + 30 * HOUR_MS; // 30h left
    const job = makeJob('upd_1', 'Assistant Programmer', oldDeadline);

    const firstEval = evaluateJobReminderSchedule(job, undefined, DEFAULT_JOB_PREFERENCES, now);
    expect(firstEval.schedule.reminderStatus).toBe('scheduled_urgent_2h');

    // Source updates deadline by +6 days
    const extendedDeadline = now + 7 * DAY_MS;
    const updatedIncoming = makeJob('upd_1', 'Assistant Programmer', extendedDeadline);
    const mergeRes = deduplicateAndMergeJobs([job], [updatedIncoming], now + 1000);
    expect(mergeRes.deadlineChangedJobIds).toContain(job.id);

    const secondEval = evaluateJobReminderSchedule(
      mergeRes.mergedJobs[0],
      { ...firstEval.schedule, lastReminderAt: now },
      DEFAULT_JOB_PREFERENCES,
      now + 1000
    );
    expect(secondEval.schedule.deadlineAt).toBe(extendedDeadline);
    expect(secondEval.schedule.reminderStatus).toBe('scheduled_daily');
    expect(secondEval.schedule.deadlineUpdatedAt).toBe(now + 1000);
  });

  it('8. Daily notification: sends digest once per day at 9:00 AM Asia/Dhaka and prevents duplicates', async () => {
    const before9am = dhakaWallTimeToUtcMs(2026, 11, 10, 8, 30, 0);
    const after9am = dhakaWallTimeToUtcMs(2026, 11, 10, 9, 5, 0);
    const job = makeJob('dig_1', 'Assistant Engineer', after9am + 10 * DAY_MS);

    // Before 9 AM: should NOT fire
    const early = await DailyDigestService.runDailyDigestIfDue([job], DEFAULT_JOB_PREFERENCES, { now: before9am });
    expect(early.sent).toBe(false);

    // At 9:05 AM: fires once
    const due = await DailyDigestService.runDailyDigestIfDue([job], DEFAULT_JOB_PREFERENCES, { now: after9am });
    expect(due.sent).toBe(true);
    expect(due.newMatchingCount).toBe(1);
    expect(due.notification?.title).toBe('JobFill BD – Daily Job Update');
    expect(due.notification?.message).toContain('1 new job circular found today.');

    // Same day re-run: zero duplicate digest
    const repeat = await DailyDigestService.runDailyDigestIfDue([job], DEFAULT_JOB_PREFERENCES, { now: after9am + HOUR_MS });
    expect(repeat.sent).toBe(false);
  });

  it('9, 10 & 11. 48h, 24h & Every-two-hour reminder logic including <2h exact countdown and anti-flood catchup', async () => {
    const deadline = dhakaWallTimeToUtcMs(2026, 11, 12, 18, 0, 0);
    const job = makeJob('urg_1', 'Office Assistant', deadline);
    await JobRepository.saveJob(job);

    // 7 days before: normal daily reminder
    const at7Days = deadline - 7 * DAY_MS;
    const eval7d = evaluateJobReminderSchedule(job, undefined, DEFAULT_JOB_PREFERENCES, at7Days);
    expect(eval7d.schedule.reminderStatus).toBe('scheduled_daily');
    expect(eval7d.isUrgent).toBe(false);
    expect(eval7d.message).toBe('7 days left to apply for Office Assistant.');

    // 48 hours remaining -> URGENT every 2 hours
    const at48h = deadline - 48 * HOUR_MS;
    const cycle48 = await NotificationScheduler.runCycle(at48h);
    expect(cycle48.notificationsSent.length).toBe(1);
    expect(cycle48.notificationsSent[0].isUrgent).toBe(true);
    expect(cycle48.notificationsSent[0].message).toBe('URGENT: Only 48 hours left to apply!');

    // +1 hour later (47h remaining) -> MUST NOT fire yet (< 2h elapsed)
    const cycle47 = await NotificationScheduler.runCycle(at48h + 1 * HOUR_MS);
    expect(cycle47.notificationsSent.length).toBe(0);

    // +2 hours after first urgent alert (46h remaining) -> fires 2h reminder
    const cycle46 = await NotificationScheduler.runCycle(at48h + 2 * HOUR_MS);
    expect(cycle46.notificationsSent.length).toBe(1);

    // 23 hours remaining -> URGENT 24h copy
    const at23h = deadline - 23 * HOUR_MS;
    const cycle23 = await NotificationScheduler.runCycle(at23h);
    expect(cycle23.notificationsSent.length).toBe(1);
    expect(cycle23.notificationsSent[0].message).toBe('URGENT: Application closes in 23 hours.');

    // < 2 hours remaining (1h 45m left) after >2h gap -> Final Reminder with exact time
    const at1h45m = deadline - (1 * HOUR_MS + 45 * 60_000);
    const evalFinal = evaluateJobReminderSchedule(
      job,
      {
        jobId: job.id,
        deadlineAt: deadline,
        lastReminderAt: at23h,
        nextReminderAt: at1h45m,
        reminderCount: 4,
        reminderStatus: 'scheduled_urgent_2h',
        snoozedUntil: null,
        dismissed: false,
        markedAsApplied: false,
      },
      DEFAULT_JOB_PREFERENCES,
      at1h45m
    );
    expect(evalFinal.shouldNotifyNow).toBe(true);
    expect(evalFinal.schedule.reminderStatus).toBe('final_countdown');
    expect(evalFinal.message).toContain('Final Reminder: Only 1 hour 45 minutes left!');
  });

  it('12. Expired job reminder cancellation: marks job expired and stops all reminders', async () => {
    const deadline = Date.now() + 2 * HOUR_MS;
    const job = makeJob('exp_1', 'Data Entry Operator', deadline);
    await JobRepository.saveJob(job);
    expect(job.status).not.toBe('expired');

    const afterDeadline = deadline + 5 * 60_000;
    const summary = await NotificationScheduler.runCycle(afterDeadline);
    expect(summary.notificationsSent.length).toBe(0);
    expect(summary.expiredJobsUpdated).toBe(1);

    const stored = await JobRepository.getJobById(job.id, afterDeadline);
    expect(stored?.status).toBe('expired');

    const schedules = await JobRepository.getReminderSchedules();
    expect(schedules[job.id].reminderStatus).toBe('expired');
    expect(schedules[job.id].nextReminderAt).toBeNull();
  });

  it('13. Applied job reminder cancellation: stops reminders when user marks job Applied', async () => {
    const deadline = dhakaWallTimeToUtcMs(2026, 11, 12, 18, 0, 0);
    const now = deadline - 20 * HOUR_MS;
    const job = makeJob('app_1', 'Bank Officer', deadline);
    await JobRepository.saveJob(job);

    await ApplicationRepository.setStatus(job, 'Applied');
    await NotificationScheduler.markJobAsApplied(job.id, true);

    const summary = await NotificationScheduler.runCycle(now);
    expect(summary.notificationsSent.length).toBe(0);

    const schedules = await JobRepository.getReminderSchedules();
    expect(schedules[job.id].reminderStatus).toBe('applied_stopped');
    expect(schedules[job.id].nextReminderAt).toBeNull();
  });

  it('14 & 15. Snooze and Dismiss reminder: suppresses notifications accurately', async () => {
    const deadline = dhakaWallTimeToUtcMs(2026, 11, 15, 18, 0, 0);
    const now = Date.now();
    const job = makeJob('snooze_1', 'Computer Operator', now + 20 * HOUR_MS);
    await JobRepository.saveJob(job);

    await NotificationScheduler.snoozeJobReminder(job.id, 4 * HOUR_MS);
    const snoozedSummary = await NotificationScheduler.runCycle(now + 30 * 60_000);
    expect(snoozedSummary.notificationsSent.length).toBe(0);

    await NotificationScheduler.dismissJobReminder(job.id);
    const dismissedSummary = await NotificationScheduler.runCycle(now + 5 * HOUR_MS);
    expect(dismissedSummary.notificationsSent.length).toBe(0);
    const schedules = await JobRepository.getReminderSchedules();
    expect(schedules[job.id].reminderStatus).toBe('dismissed');
  });

  it('16. Notification click opens correct job: routes notification ID to jobId in dashboard', async () => {
    const deadline = dhakaWallTimeToUtcMs(2026, 11, 12, 18, 0, 0);
    const now = deadline - 10 * HOUR_MS;
    const job = makeJob('click_job_42', 'Assistant Programmer', deadline);
    await JobRepository.saveJob(job);

    const summary = await NotificationScheduler.runCycle(now);
    expect(summary.notificationsSent.length).toBe(1);

    const notifId = summary.notificationsSent[0].id;
    const routeMap = await JobRepository.getNotificationRouteMap();
    expect(routeMap[notifId]).toEqual({ tab: 'circulars', jobId: job.id });

    // Verify TabManager opens URL with exact tab & jobId in non-chrome fallback
    const openedUrls: string[] = [];
    const origOpen = window.open;
    window.open = ((u?: string | URL) => {
      openedUrls.push(String(u));
      return null;
    }) as any;

    try {
      await TabManager.openOrFocusDashboard(routeMap[notifId].tab, routeMap[notifId].jobId);
      expect(openedUrls[0]).toBe(`dashboard.html?tab=circulars&jobId=${encodeURIComponent(job.id)}`);
    } finally {
      window.open = origOpen;
    }
  });
});
