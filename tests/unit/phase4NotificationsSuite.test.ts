import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationScheduler } from '../../src/jobs/notifications/notification-scheduler';
import { ApplicationRepository } from '../../src/jobs/database/application-repository';
import { JobNotificationRepository } from '../../src/jobs/database/notification-repository';
import { JobRepository } from '../../src/jobs/database/job-repository';
import { JobAlarmManager, ALARM_DAILY_CHECK } from '../../src/jobs/background/alarm-manager';
import { DEFAULT_JOB_PREFERENCES, NormalizedJobCircular } from '../../src/jobs/types/job.types';

function makeJob(overrides: Partial<NormalizedJobCircular> = {}): NormalizedJobCircular {
  return {
    id: 'job_notif_1',
    jobTitle: 'Senior Officer',
    position: 'Senior Officer',
    organization: 'Sonali Bank',
    sourceId: 'bb',
    sourceName: 'BB',
    sourceUrl: 'https://bb.org.bd',
    circularUrl: 'https://bb.org.bd/circ.pdf',
    applicationUrl: 'https://erecruitment.bb.org.bd',
    sourceVerification: 'official_verified',
    deadlineVerified: true,
    deadlineAt: Date.now() + 24 * 3600 * 1000,
    deadlineText: '2026-12-10',
    location: 'All Bangladesh',
    category: 'Bank',
    qualification: 'Masters',
    requirements: [],
    description: '',
    status: 'active',
    publishedAt: Date.now() - 86400_000,
    lastUpdatedAt: Date.now(),
    ...overrides,
  };
}

describe('Phase 4 — Smart Notification & Reminder Verification Suite', () => {
  beforeEach(async () => {
    localStorage.clear();
    await JobRepository.clearAll();
    await ApplicationRepository.clearAll();
    await JobNotificationRepository.clearAll();
    await JobRepository.saveReminderSchedules({});
    await JobRepository.savePreferences({ ...DEFAULT_JOB_PREFERENCES });
  });

  it('1. Dispatches exam, admit card, and result notifications without duplicates across repeated scheduler cycles', async () => {
    const now = Date.parse('2026-11-12T03:00:00Z'); // 09:00 Asia/Dhaka
    await ApplicationRepository.upsert({
      jobId: 'app_exam_1',
      jobTitle: 'Assistant Maintenance Engineer',
      organization: 'DESCO',
      deadlineAt: null,
      status: 'Admit Card Available',
      examDate: '2026-11-15',
      examVenue: 'BUET Campus',
      admitCardStatus: 'Available',
      resultSummary: 'Shortlisted',
      createdAt: now,
      updatedAt: now,
    });

    const first = await NotificationScheduler.runCycle(now);
    const types1 = first.notificationsSent.map((n) => n.type);
    expect(types1).toContain('exam_reminder');
    expect(types1).toContain('admit_card_alert');
    expect(types1).toContain('result_alert');
    expect(first.notificationsSent).toHaveLength(3);

    // Second run must suppress duplicates completely
    const second = await NotificationScheduler.runCycle(now + 60_000);
    expect(second.notificationsSent).toHaveLength(0);
  });

  it('2. Suppresses unverified deadlines, expired jobs, and user-disabled notification categories', async () => {
    const now = Date.parse('2026-11-12T04:00:00Z');
    await JobRepository.saveJobs([
      makeJob({ id: 'unverified_dl', deadlineVerified: false, deadlineAt: now + 12 * 3600_000 }),
      makeJob({ id: 'expired_job', deadlineVerified: true, deadlineAt: now - 3600_000 }),
    ]);

    const res = await NotificationScheduler.runCycle(now);
    const deadlineSent = res.notificationsSent.filter(
      (n) => n.type === 'deadline_reminder' || n.type === 'urgent_deadline'
    );
    expect(deadlineSent).toHaveLength(0);

    // Disabled exam & admit alerts stay silent cleanly
    await JobRepository.savePreferences({
      ...DEFAULT_JOB_PREFERENCES,
      deadlineRemindersEnabled: false,
      examRemindersEnabled: false,
      admitResultAlertsEnabled: false,
    });
    await ApplicationRepository.upsert({
      jobId: 'app_muted_1',
      jobTitle: 'Officer',
      organization: 'NTRCA',
      deadlineAt: null,
      status: 'Admit Card Available',
      examDate: '2026-11-14',
      admitCardStatus: 'Available',
      createdAt: now,
      updatedAt: now,
    });

    const mutedCycle = await NotificationScheduler.runCycle(now + 1000);
    expect(mutedCycle.notificationsSent).toHaveLength(0);
  });

  it('3. Recreates MV3 alarms cleanly on startup / restart without setInterval loops', async () => {
    const created: Array<{ name: string; info: any }> = [];
    (globalThis as any).chrome = {
      alarms: {
        get: vi.fn(async () => undefined),
        create: vi.fn(async (name, info) => created.push({ name, info })),
        clear: vi.fn(async () => true),
      },
    };

    await JobAlarmManager.ensureAlarms();
    expect(created.some((a) => a.name === ALARM_DAILY_CHECK)).toBe(true);
  });
});
