// JobFill BD - Single-Alarm Deadline & Notification Scheduler
// Computes the earliest next eligible reminder across all jobs and drives one
// Chrome Alarm rather than creating unbounded per-job alarms.
// Safely catches up overdue reminders on wake/startup without duplicate floods.

import {
  NormalizedJobCircular,
  ReminderScheduleRecord,
  JobNotificationRecord,
} from '../types/job.types';
import { JobRepository } from '../database/job-repository';
import { BookmarkRepository } from '../database/bookmark-repository';
import { JobNotificationRepository } from '../database/notification-repository';
import { ApplicationRepository } from '../database/application-repository';
import { evaluateJobReminderSchedule, TWO_HOURS_MS } from './deadline-reminder';
import { NotificationManager } from './notification-manager';
import { refreshJobStatus } from '../services/job-validator';

export interface SchedulerCycleSummary {
  processedJobs: number;
  expiredJobsUpdated: number;
  notificationsSent: JobNotificationRecord[];
  expiredNotificationsSent?: JobNotificationRecord[];
  nextAlarmAt: number | null;
}

export class NotificationScheduler {
  private static isRunning = false;

  public static async runCycle(now: number = Date.now()): Promise<SchedulerCycleSummary> {
    if (this.isRunning) {
      return {
        processedJobs: 0,
        expiredJobsUpdated: 0,
        notificationsSent: [],
        expiredNotificationsSent: [],
        nextAlarmAt: null,
      };
    }

    this.isRunning = true;
    try {
      const [jobs, schedules, prefs, applications, bookmarkedIds, existingNotifs] = await Promise.all([
        JobRepository.getAllRawJobs(),
        JobRepository.getReminderSchedules(),
        JobRepository.getPreferences(),
        ApplicationRepository.getAll(),
        BookmarkRepository.getBookmarkedJobIds(),
        JobNotificationRepository.getAll(),
      ]);

      const emittedKeys = new Set(
        existingNotifs.map((n) => `${n.type}::${n.jobId || ''}::${n.remainingText || n.title}`)
      );

      const trackedNonAppliedIds = new Set(
        applications
          .filter((a) => ['Interested', 'Saved', 'Bookmarked', 'Ready to Apply'].includes(a.status))
          .map((a) => a.jobId)
      );

      const appliedJobIds = new Set(
        applications
          .filter((a) =>
            [
              'Applied',
              'Payment Pending',
              'Payment Completed',
              'Admit Card Available',
              'Exam Scheduled',
              'Result Published',
              'Rejected',
              'Selected',
            ].includes(a.status)
          )
          .map((a) => a.jobId)
      );

      const notificationsSent: JobNotificationRecord[] = [];
      const expiredNotificationsSent: JobNotificationRecord[] = [];

      // Process Tracker-level Exam, Admit Card & Result Alerts (strictly deduplicated)
      for (const app of applications) {
        if (prefs.examRemindersEnabled !== false && app.examDate) {
          const examTs = Date.parse(`${app.examDate}T09:00:00+06:00`);
          if (Number.isFinite(examTs) && examTs > now) {
            const msUntilExam = examTs - now;
            if (msUntilExam <= 7 * 86_400_000) {
              const examDedupKey = `exam_reminder::${app.jobId}::${app.examDate}`;
              if (!emittedKeys.has(examDedupKey)) {
                emittedKeys.add(examDedupKey);
                const daysLeft = Math.max(1, Math.ceil(msUntilExam / 86_400_000));
                const notif = await NotificationManager.dispatch({
                  type: 'exam_reminder',
                  title: `Upcoming Exam (${daysLeft}d): ${app.jobTitle}`,
                  message: `Exam scheduled for ${app.examDate}${app.examVenue ? ` at ${app.examVenue}` : ''}. (${app.organization})`,
                  jobId: app.jobId,
                  jobTitle: app.jobTitle,
                  organization: app.organization,
                  remainingText: app.examDate,
                  circularUrl: app.circularUrl,
                  applicationUrl: app.applicationUrl,
                  isUrgent: msUntilExam <= 48 * 3_600_000,
                  actionButtonTitle: 'Open Tracker',
                  routeTab: 'tracker',
                  createdAt: now,
                });
                notificationsSent.push(notif);
              }
            }
          }
        }

        if (
          prefs.admitResultAlertsEnabled !== false &&
          (app.admitCardStatus === 'Available' || app.status === 'Admit Card Available')
        ) {
          const admitDedupKey = `admit_card_alert::${app.jobId}::Available`;
          if (!emittedKeys.has(admitDedupKey)) {
            emittedKeys.add(admitDedupKey);
            const notif = await NotificationManager.dispatch({
              type: 'admit_card_alert',
              title: `Admit Card Available: ${app.jobTitle}`,
              message: `Download admit card for ${app.organization}${app.examDate ? ` (Exam: ${app.examDate})` : ''}.`,
              jobId: app.jobId,
              jobTitle: app.jobTitle,
              organization: app.organization,
              remainingText: 'Available',
              circularUrl: app.circularUrl,
              applicationUrl: app.admitCardUrl || app.applicationUrl,
              isUrgent: true,
              actionButtonTitle: 'Open Tracker',
              routeTab: 'tracker',
              createdAt: now,
            });
            notificationsSent.push(notif);
          }
        }

        if (
          prefs.admitResultAlertsEnabled !== false &&
          (app.status === 'Result Published' || Boolean(app.resultSummary?.trim()))
        ) {
          const resultTag = (app.resultSummary || 'Published').trim();
          const resultDedupKey = `result_alert::${app.jobId}::${resultTag}`;
          if (!emittedKeys.has(resultDedupKey)) {
            emittedKeys.add(resultDedupKey);
            const notif = await NotificationManager.dispatch({
              type: 'result_alert',
              title: `Result Update: ${app.jobTitle}`,
              message: `${app.organization}: ${app.resultSummary || 'Result published — check official portal.'}`,
              jobId: app.jobId,
              jobTitle: app.jobTitle,
              organization: app.organization,
              remainingText: resultTag,
              circularUrl: app.circularUrl,
              applicationUrl: app.resultUrl || app.applicationUrl,
              isUrgent: false,
              actionButtonTitle: 'View Tracker',
              routeTab: 'tracker',
              createdAt: now,
            });
            notificationsSent.push(notif);
          }
        }
      }

      const updatedJobs: NormalizedJobCircular[] = [];
      let expiredJobsUpdated = 0;
      const updatedSchedules: Record<string, ReminderScheduleRecord> = { ...schedules };
      let earliestNextAt: number | null = null;

      for (const rawJob of jobs) {
        const job = refreshJobStatus(rawJob, now);
        if (job.status !== rawJob.status) {
          updatedJobs.push(job);
          if (job.status === 'expired') {
            expiredJobsUpdated++;
            if (
              !appliedJobIds.has(job.id) &&
              (bookmarkedIds.has(job.id) || trackedNonAppliedIds.has(job.id)) &&
              schedules[job.id]?.reminderStatus !== 'expired'
            ) {
              const expNotif = await NotificationManager.dispatch({
                type: 'expired_job',
                title: `Deadline Expired: ${job.position || job.jobTitle}`,
                message: `The verified application deadline for ${job.organization} (${job.circularNumber || job.position}) has passed.`,
                jobId: job.id,
                jobTitle: job.jobTitle,
                organization: job.organization,
                deadlineAt: job.deadlineAt,
                circularUrl: job.circularUrl,
                applicationUrl: job.applicationUrl,
                isUrgent: false,
                actionButtonTitle: 'View Circular',
                routeTab: 'circulars',
                createdAt: now,
              });
              expiredNotificationsSent.push(expNotif);
            }
          }
        }

        const existingSched = updatedSchedules[job.id];
        const evaluation = evaluateJobReminderSchedule(job, existingSched, prefs, now, {
          isApplied: appliedJobIds.has(job.id),
        });

        let finalSchedule = evaluation.schedule;

        if (evaluation.shouldNotifyNow) {
          // Guard against duplicate immediate firing on overlapping wakeups
          const minGap = evaluation.isUrgent ? TWO_HOURS_MS - 60_000 : 12 * 60 * 60 * 1000;
          const recentlyFired =
            existingSched?.lastReminderAt !== null &&
            existingSched?.lastReminderAt !== undefined &&
            now - existingSched.lastReminderAt < minGap;

          if (!recentlyFired) {
            const sent = await NotificationManager.dispatch({
              type: evaluation.isUrgent ? 'urgent_deadline' : 'deadline_reminder',
              title: evaluation.title,
              message: evaluation.message,
              jobId: job.id,
              jobTitle: job.jobTitle,
              organization: job.organization,
              deadlineAt: job.deadlineAt,
              remainingText: evaluation.remainingText,
              circularUrl: job.circularUrl,
              applicationUrl: job.applicationUrl,
              isUrgent: evaluation.isUrgent,
              actionButtonTitle: 'Open Job Details',
              routeTab: 'circulars',
              createdAt: now,
            });
            notificationsSent.push(sent);

            finalSchedule = {
              ...finalSchedule,
              lastReminderAt: now,
              reminderCount: (existingSched?.reminderCount ?? 0) + 1,
            };
          }
        }

        updatedSchedules[job.id] = finalSchedule;

        if (
          finalSchedule.nextReminderAt !== null &&
          finalSchedule.nextReminderAt > now &&
          (earliestNextAt === null || finalSchedule.nextReminderAt < earliestNextAt)
        ) {
          earliestNextAt = finalSchedule.nextReminderAt;
        }
      }

      if (updatedJobs.length > 0) {
        await JobRepository.saveJobs(updatedJobs);
      }
      await JobRepository.saveReminderSchedules(updatedSchedules);

      const state = await JobRepository.getSchedulerState();
      await JobRepository.saveSchedulerState({
        ...state,
        lastSchedulerRunAt: now,
        nextScheduledAlarmAt: earliestNextAt,
      });

      return {
        processedJobs: jobs.length,
        expiredJobsUpdated,
        notificationsSent,
        expiredNotificationsSent,
        nextAlarmAt: earliestNextAt,
      };
    } finally {
      this.isRunning = false;
    }
  }

  public static async snoozeJobReminder(jobId: string, durationMs: number = 4 * 60 * 60 * 1000): Promise<void> {
    const schedules = await JobRepository.getReminderSchedules();
    const job = await JobRepository.getJobById(jobId);
    const existing = schedules[jobId];
    const now = Date.now();

    schedules[jobId] = {
      jobId,
      deadlineAt: job?.deadlineAt ?? existing?.deadlineAt ?? null,
      lastReminderAt: existing?.lastReminderAt ?? null,
      nextReminderAt: now + durationMs,
      reminderCount: existing?.reminderCount ?? 0,
      reminderStatus: 'snoozed',
      snoozedUntil: now + durationMs,
      dismissed: false,
      markedAsApplied: existing?.markedAsApplied ?? false,
    };
    await JobRepository.saveReminderSchedules(schedules);
  }

  public static async dismissJobReminder(jobId: string): Promise<void> {
    const schedules = await JobRepository.getReminderSchedules();
    const job = await JobRepository.getJobById(jobId);
    const existing = schedules[jobId];

    schedules[jobId] = {
      jobId,
      deadlineAt: job?.deadlineAt ?? existing?.deadlineAt ?? null,
      lastReminderAt: existing?.lastReminderAt ?? null,
      nextReminderAt: null,
      reminderCount: existing?.reminderCount ?? 0,
      reminderStatus: 'dismissed',
      snoozedUntil: null,
      dismissed: true,
      markedAsApplied: existing?.markedAsApplied ?? false,
    };
    await JobRepository.saveReminderSchedules(schedules);
  }

  public static async markJobAsApplied(jobId: string, isApplied: boolean = true): Promise<void> {
    const schedules = await JobRepository.getReminderSchedules();
    const job = await JobRepository.getJobById(jobId);
    const existing = schedules[jobId];

    schedules[jobId] = {
      jobId,
      deadlineAt: job?.deadlineAt ?? existing?.deadlineAt ?? null,
      lastReminderAt: existing?.lastReminderAt ?? null,
      nextReminderAt: isApplied ? null : existing?.nextReminderAt ?? null,
      reminderCount: existing?.reminderCount ?? 0,
      reminderStatus: isApplied ? 'applied_stopped' : 'scheduled_daily',
      snoozedUntil: existing?.snoozedUntil ?? null,
      dismissed: existing?.dismissed ?? false,
      markedAsApplied: isApplied,
    };
    await JobRepository.saveReminderSchedules(schedules);
  }
}
