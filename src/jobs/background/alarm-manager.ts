// JobFill BD - Manifest V3 Chrome Alarms Manager
// Uses ONLY chrome.alarms (never setInterval) for reliable MV3 Service Worker wakeups.
// Recreates missing alarms on startup/install and schedules one dynamic deadline alarm.

import { JobRepository } from '../database/job-repository';
import { ApplicationRepository } from '../database/application-repository';
import { getNextDailyDigestTimeUtc } from '../notifications/daily-digest';
import { ApplicationTrackerRecord } from '../types/job.types';

export const ALARM_DAILY_CHECK = 'jobfill_daily_job_check';
export const ALARM_DEADLINE_SCHEDULER = 'jobfill_deadline_scheduler';
export const ALARM_FEE_CHECK_PREFIX = 'jobfill_fee_deadline_';
const DAILY_CHECK_PERIOD_MINUTES = 360; // Periodic 6-hour catch-up + daily digest alignment
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export class JobAlarmManager {
  public static getFeeAlarmName(jobId: string): string {
    return `${ALARM_FEE_CHECK_PREFIX}${jobId}`;
  }

  public static async scheduleFeePaymentReminder(record: ApplicationTrackerRecord): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.alarms) return;
    const alarmName = this.getFeeAlarmName(record.jobId);
    await chrome.alarms.clear(alarmName);

    if (
      record.feePaymentStatus === 'unpaid' &&
      typeof record.feeDeadlineAt === 'number' &&
      record.feeDeadlineAt > Date.now()
    ) {
      // Alert 6 hours before fee expiry, or in 1 minute if window is already within 6 hours
      const preferredWhen = record.feeDeadlineAt - SIX_HOURS_MS;
      const safeWhen = Math.max(Date.now() + 60_000, preferredWhen);
      await chrome.alarms.create(alarmName, { when: safeWhen });
    }
  }

  public static async clearFeePaymentReminder(jobId: string): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.alarms) return;
    await chrome.alarms.clear(this.getFeeAlarmName(jobId));
  }

  public static async ensureAlarms(): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.alarms) return;

    const dailyAlarm = await chrome.alarms.get(ALARM_DAILY_CHECK);
    if (!dailyAlarm) {
      const prefs = await JobRepository.getPreferences();
      const nextDailyUtc = getNextDailyDigestTimeUtc(prefs, Date.now());
      await chrome.alarms.create(ALARM_DAILY_CHECK, {
        when: Math.max(Date.now() + 60_000, nextDailyUtc),
        periodInMinutes: DAILY_CHECK_PERIOD_MINUTES,
      });
    }

    const state = await JobRepository.getSchedulerState();
    if (state.nextScheduledAlarmAt && state.nextScheduledAlarmAt > Date.now()) {
      const deadlineAlarm = await chrome.alarms.get(ALARM_DEADLINE_SCHEDULER);
      if (!deadlineAlarm) {
        await this.scheduleNextDeadlineAlarm(state.nextScheduledAlarmAt);
      }
    }

    const apps = await ApplicationRepository.getAll();
    for (const app of apps) {
      if (
        app.feePaymentStatus === 'unpaid' &&
        typeof app.feeDeadlineAt === 'number' &&
        app.feeDeadlineAt > Date.now()
      ) {
        const existingFeeAlarm = await chrome.alarms.get(this.getFeeAlarmName(app.jobId));
        if (!existingFeeAlarm) {
          await this.scheduleFeePaymentReminder(app);
        }
      }
    }
  }

  public static async scheduleNextDeadlineAlarm(nextAt: number | null): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.alarms) return;

    await chrome.alarms.clear(ALARM_DEADLINE_SCHEDULER);
    if (!nextAt) return;

    // Chrome MV3 enforces minimum ~1 minute delay in packed extensions or fires immediately if past
    const safeWhen = Math.max(Date.now() + 30_000, nextAt);
    await chrome.alarms.create(ALARM_DEADLINE_SCHEDULER, { when: safeWhen });
  }

  public static async rescheduleDailyAlarmFromPreferences(): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.alarms) return;
    const prefs = await JobRepository.getPreferences();
    await chrome.alarms.clear(ALARM_DAILY_CHECK);
    if (prefs.dailyDigestEnabled || prefs.deadlineRemindersEnabled) {
      const nextDailyUtc = getNextDailyDigestTimeUtc(prefs, Date.now());
      await chrome.alarms.create(ALARM_DAILY_CHECK, {
        when: Math.max(Date.now() + 60_000, nextDailyUtc),
        periodInMinutes: DAILY_CHECK_PERIOD_MINUTES,
      });
    }
  }
}
