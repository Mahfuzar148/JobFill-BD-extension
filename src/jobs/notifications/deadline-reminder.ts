// JobFill BD - Smart Deadline Reminder Engine
// Rules:
// - Verified deadlines ONLY (never guess/estimate)
// - > 48h remaining: once daily at user's configured Asia/Dhaka notification time
// - <= 48h remaining: every 2 hours
// - <= 24h remaining: every 2 hours + URGENT mark
// - < 2h remaining: exact remaining time shown prominently
// - Expired / Applied / Dismissed / Snoozed / Needs-Revalidation: suppressed cleanly

import {
  NormalizedJobCircular,
  ReminderScheduleRecord,
  JobPreferences,
  ReminderStatus,
} from '../types/job.types';
import {
  HOUR_MS,
  DAY_MS,
  getDhakaDateKey,
  getDhakaParts,
  dhakaWallTimeToUtcMs,
  calculateRemainingTime,
} from '../services/deadline-parser';

export const URGENT_WINDOW_MS = 48 * HOUR_MS;
export const CRITICAL_24H_MS = 24 * HOUR_MS;
export const TWO_HOURS_MS = 2 * HOUR_MS;

export interface ReminderEvaluation {
  shouldNotifyNow: boolean;
  isUrgent: boolean;
  schedule: ReminderScheduleRecord;
  title: string;
  message: string;
  remainingText: string;
}

export function formatDeadlineReminderCopy(
  job: NormalizedJobCircular,
  now: number = Date.now()
): { title: string; message: string; isUrgent: boolean; remainingText: string } {
  const breakdown = calculateRemainingTime(job.deadlineAt, job.deadlineVerified, now);
  const pos = job.position || job.jobTitle;

  if (!breakdown.isVerified || breakdown.isExpired || !job.deadlineAt) {
    return {
      title: `${pos} — ${job.organization}`,
      message: breakdown.labelEn,
      isUrgent: false,
      remainingText: breakdown.labelEn,
    };
  }

  const remainingMs = breakdown.remainingMs;

  // < 2 hours: exact remaining time prominently
  if (remainingMs < TWO_HOURS_MS) {
    const minsTotal = Math.max(1, Math.floor(remainingMs / 60000));
    const hrs = Math.floor(minsTotal / 60);
    const mins = minsTotal % 60;
    const exactStr =
      hrs > 0
        ? `${hrs} hour${hrs > 1 ? 's' : ''}${mins > 0 ? ` ${mins} minute${mins > 1 ? 's' : ''}` : ''}`
        : `${mins} minute${mins > 1 ? 's' : ''}`;
    return {
      title: `URGENT Final Reminder: ${pos}`,
      message: `Final Reminder: Only ${exactStr} left! (${job.organization})`,
      isUrgent: true,
      remainingText: exactStr,
    };
  }

  // 2h to <= 4h: Final Reminder in hours
  if (remainingMs <= 4 * HOUR_MS) {
    const hrs = Math.ceil(remainingMs / HOUR_MS);
    return {
      title: `URGENT Final Reminder: ${pos}`,
      message: `Final Reminder: Only ${hrs} hour${hrs > 1 ? 's' : ''} left! (${job.organization})`,
      isUrgent: true,
      remainingText: `${hrs} hours`,
    };
  }

  // <= 24 hours: URGENT
  if (remainingMs <= CRITICAL_24H_MS) {
    const hrs = Math.ceil(remainingMs / HOUR_MS);
    return {
      title: `URGENT: ${pos} (${job.organization})`,
      message: `URGENT: Application closes in ${hrs} hour${hrs > 1 ? 's' : ''}.`,
      isUrgent: true,
      remainingText: `${hrs} hours`,
    };
  }

  // <= 48 hours: URGENT
  if (remainingMs <= URGENT_WINDOW_MS) {
    const hrs = Math.ceil(remainingMs / HOUR_MS);
    const message =
      hrs >= 47 && hrs <= 48
        ? 'URGENT: Only 48 hours left to apply!'
        : `URGENT: Only ${hrs} hours left to apply!`;
    return {
      title: `URGENT: ${pos} (${job.organization})`,
      message,
      isUrgent: true,
      remainingText: `${hrs} hours`,
    };
  }

  // > 48 hours: normal daily reminder
  const days = Math.max(2, Math.round(remainingMs / DAY_MS));
  return {
    title: `Deadline Reminder: ${job.organization}`,
    message: `${days} days left to apply for ${pos}.`,
    isUrgent: false,
    remainingText: `${days} days`,
  };
}

function getNextDailySlotUtc(prefs: JobPreferences, now: number, alreadySentToday: boolean): number {
  const parts = getDhakaParts(now);
  const todaySlot = dhakaWallTimeToUtcMs(
    parts.year,
    parts.month,
    parts.day,
    prefs.notificationHour,
    prefs.notificationMinute,
    0
  );

  if (!alreadySentToday && now < todaySlot) {
    return todaySlot;
  }
  if (!alreadySentToday && now >= todaySlot) {
    return now;
  }
  return todaySlot + DAY_MS;
}

export function evaluateJobReminderSchedule(
  job: NormalizedJobCircular,
  existing: ReminderScheduleRecord | undefined,
  prefs: JobPreferences,
  now: number = Date.now(),
  options: { isApplied?: boolean } = {}
): ReminderEvaluation {
  const markedAsApplied = Boolean(options.isApplied || existing?.markedAsApplied);

  const base: ReminderScheduleRecord = {
    jobId: job.id,
    deadlineAt: job.deadlineAt ?? null,
    lastReminderAt: existing?.lastReminderAt ?? null,
    nextReminderAt: existing?.nextReminderAt ?? null,
    reminderCount: existing?.reminderCount ?? 0,
    reminderStatus: existing?.reminderStatus ?? 'scheduled_daily',
    snoozedUntil: existing?.snoozedUntil ?? null,
    dismissed: existing?.dismissed ?? false,
    markedAsApplied,
    deadlineUpdatedAt: existing?.deadlineUpdatedAt ?? null,
  };

  const makeStop = (status: ReminderStatus): ReminderEvaluation => ({
    shouldNotifyNow: false,
    isUrgent: false,
    schedule: {
      ...base,
      reminderStatus: status,
      nextReminderAt: null,
    },
    title: job.position,
    message: '',
    remainingText: '',
  });

  // 1. Revalidation or missing/unverified deadline
  if (job.deadlineNeedsRevalidation) {
    return makeStop('needs_revalidation');
  }
  if (!job.deadlineVerified || typeof job.deadlineAt !== 'number' || !Number.isFinite(job.deadlineAt)) {
    return makeStop('unverified_deadline');
  }

  // 2. Expired deadline stops everything
  const remainingMs = job.deadlineAt - now;
  if (remainingMs <= 0 || job.status === 'expired') {
    return makeStop('expired');
  }

  // 3. Applied / Dismissed suppression
  if (base.dismissed) {
    return makeStop('dismissed');
  }
  if (markedAsApplied && prefs.stopRemindersWhenApplied) {
    return makeStop('applied_stopped');
  }
  if (!prefs.deadlineRemindersEnabled) {
    return makeStop(base.reminderStatus);
  }

  // 4. Recalculate if source updated the deadline
  let lastReminderAt = base.lastReminderAt;
  let snoozedUntil = base.snoozedUntil;
  let deadlineUpdatedAt = base.deadlineUpdatedAt;

  if (existing && existing.deadlineAt !== null && existing.deadlineAt !== job.deadlineAt) {
    deadlineUpdatedAt = now;
    snoozedUntil = null;
    // Allow re-evaluation on updated deadline while preserving reminderCount history
    lastReminderAt = null;
  }

  // 5. Snooze suppression
  if (snoozedUntil && now < snoozedUntil) {
    const nextAfterSnooze = snoozedUntil < job.deadlineAt ? snoozedUntil : null;
    return {
      shouldNotifyNow: false,
      isUrgent: false,
      schedule: {
        ...base,
        deadlineAt: job.deadlineAt,
        lastReminderAt,
        snoozedUntil,
        deadlineUpdatedAt,
        reminderStatus: 'snoozed',
        nextReminderAt: nextAfterSnooze,
      },
      title: job.position,
      message: '',
      remainingText: '',
    };
  }

  // Clear expired snooze
  snoozedUntil = null;

  const copy = formatDeadlineReminderCopy(job, now);

  // 6. <= 48 hours remaining -> every 2 hours
  if (remainingMs <= URGENT_WINDOW_MS) {
    const status: ReminderStatus = remainingMs < TWO_HOURS_MS ? 'final_countdown' : 'scheduled_urgent_2h';
    const isDue = lastReminderAt === null || now - lastReminderAt >= TWO_HOURS_MS;

    if (isDue) {
      const candidateNext = now + TWO_HOURS_MS;
      return {
        ...copy,
        shouldNotifyNow: true,
        schedule: {
          ...base,
          deadlineAt: job.deadlineAt,
          lastReminderAt,
          snoozedUntil,
          deadlineUpdatedAt,
          reminderStatus: status,
          nextReminderAt: candidateNext < job.deadlineAt ? candidateNext : null,
        },
      };
    }

    const nextAt = (lastReminderAt ?? now) + TWO_HOURS_MS;
    return {
      ...copy,
      shouldNotifyNow: false,
      schedule: {
        ...base,
        deadlineAt: job.deadlineAt,
        lastReminderAt,
        snoozedUntil,
        deadlineUpdatedAt,
        reminderStatus: status,
        nextReminderAt: nextAt < job.deadlineAt ? nextAt : null,
      },
    };
  }

  // 7. > 48 hours remaining -> once daily at user's notification time
  const alreadySentToday = lastReminderAt !== null && getDhakaDateKey(lastReminderAt) === getDhakaDateKey(now);
  const nextDailySlot = getNextDailySlotUtc(prefs, now, alreadySentToday);
  const urgentEntryAt = job.deadlineAt - URGENT_WINDOW_MS;

  if (!alreadySentToday && nextDailySlot <= now) {
    const tomorrowSlot = getNextDailySlotUtc(prefs, now, true);
    const boundedNext = urgentEntryAt > now && urgentEntryAt < tomorrowSlot ? urgentEntryAt : tomorrowSlot;
    return {
      ...copy,
      shouldNotifyNow: true,
      schedule: {
        ...base,
        deadlineAt: job.deadlineAt,
        lastReminderAt,
        snoozedUntil,
        deadlineUpdatedAt,
        reminderStatus: 'scheduled_daily',
        nextReminderAt: boundedNext < job.deadlineAt ? boundedNext : null,
      },
    };
  }

  const boundedNext = urgentEntryAt > now && urgentEntryAt < nextDailySlot ? urgentEntryAt : nextDailySlot;
  return {
    ...copy,
    shouldNotifyNow: false,
    schedule: {
      ...base,
      deadlineAt: job.deadlineAt,
      lastReminderAt,
      snoozedUntil,
      deadlineUpdatedAt,
      reminderStatus: 'scheduled_daily',
      nextReminderAt: boundedNext < job.deadlineAt ? boundedNext : null,
    },
  };
}
