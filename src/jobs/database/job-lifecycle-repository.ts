// JobFill BD - Job Lifecycle Repositories (Milestone M1)
// Storage repositories for Exam Schedules, Admit Cards, Seat Plans,
// Job Results, Lifecycle Events, and Notice History.
// Built on SharedStoreCrud with transparent IndexedDB and in-memory/localStorage fallbacks.

import { STORES } from '../../database/indexeddb';
import { SharedStoreCrud } from './job-repository';
import type {
  ExamSchedule,
  ExamStage,
  ExamScheduleStatus,
  AdmitCardNotice,
  AdmitCardNoticeStatus,
  SeatPlanNotice,
  SeatPlanNoticeStatus,
  JobResult,
  ResultStage,
  ResultPublicationStatus,
  JobEvent,
  LifecycleEventType,
  LifecycleEventStatus,
  NoticeHistory,
  NoticeHistoryType,
  JobLifecycleTimeline,
} from '../types';

// ============================================================================
// 1. Exam Schedule Repository
// ============================================================================

export class ExamScheduleRepository extends SharedStoreCrud<ExamSchedule> {
  private static instance = new ExamScheduleRepository();

  constructor() {
    super(STORES.EXAM_SCHEDULES, 'id');
  }

  public static getInstance(): ExamScheduleRepository {
    return this.instance;
  }

  public async getByCircularId(circularId: string): Promise<ExamSchedule[]> {
    const list = await this.getAll();
    return list
      .filter((item) => item.circularId === circularId)
      .sort((a, b) => (a.examDate || '').localeCompare(b.examDate || ''));
  }

  public async getUpcomingExams(): Promise<ExamSchedule[]> {
    const list = await this.getAll();
    return list
      .filter((item) => item.status === 'Announced' || item.status === 'Rescheduled')
      .sort((a, b) => (a.examDate || '').localeCompare(b.examDate || ''));
  }

  public async getByStage(stage: ExamStage): Promise<ExamSchedule[]> {
    const list = await this.getAll();
    return list.filter((item) => item.stage === stage);
  }

  public async getByStatus(status: ExamScheduleStatus): Promise<ExamSchedule[]> {
    const list = await this.getAll();
    return list.filter((item) => item.status === status);
  }

  public async save(schedule: ExamSchedule): Promise<void> {
    const now = Date.now();
    await this.put({
      ...schedule,
      updatedAt: schedule.updatedAt || now,
      createdAt: schedule.createdAt || now,
    });
  }

  // Static API delegates
  public static async getAll(): Promise<ExamSchedule[]> {
    return this.instance.getAll();
  }

  public static async getById(id: string): Promise<ExamSchedule | null> {
    return this.instance.getByKey(id);
  }

  public static async getByCircularId(circularId: string): Promise<ExamSchedule[]> {
    return this.instance.getByCircularId(circularId);
  }

  public static async getUpcomingExams(): Promise<ExamSchedule[]> {
    return this.instance.getUpcomingExams();
  }

  public static async save(schedule: ExamSchedule): Promise<void> {
    return this.instance.save(schedule);
  }

  public static async saveMany(schedules: ExamSchedule[]): Promise<void> {
    return this.instance.putMany(schedules);
  }

  public static async deleteById(id: string): Promise<void> {
    return this.instance.remove(id);
  }

  public static async clearAll(): Promise<void> {
    return this.instance.clear();
  }
}

// ============================================================================
// 2. Admit Card Notice Repository
// ============================================================================

export class AdmitCardNoticeRepository extends SharedStoreCrud<AdmitCardNotice> {
  private static instance = new AdmitCardNoticeRepository();

  constructor() {
    super(STORES.ADMIT_CARD_NOTICES, 'id');
  }

  public static getInstance(): AdmitCardNoticeRepository {
    return this.instance;
  }

  public async getByCircularId(circularId: string): Promise<AdmitCardNotice[]> {
    const list = await this.getAll();
    return list
      .filter((item) => item.circularId === circularId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  public async getAvailableNotices(): Promise<AdmitCardNotice[]> {
    const list = await this.getAll();
    return list.filter((item) => item.status === 'Available');
  }

  public async getByStage(stage: ExamStage): Promise<AdmitCardNotice[]> {
    const list = await this.getAll();
    return list.filter((item) => item.stage === stage);
  }

  public async save(notice: AdmitCardNotice): Promise<void> {
    const now = Date.now();
    await this.put({
      ...notice,
      updatedAt: notice.updatedAt || now,
      createdAt: notice.createdAt || now,
    });
  }

  // Static API delegates
  public static async getAll(): Promise<AdmitCardNotice[]> {
    return this.instance.getAll();
  }

  public static async getById(id: string): Promise<AdmitCardNotice | null> {
    return this.instance.getByKey(id);
  }

  public static async getByCircularId(circularId: string): Promise<AdmitCardNotice[]> {
    return this.instance.getByCircularId(circularId);
  }

  public static async getAvailableNotices(): Promise<AdmitCardNotice[]> {
    return this.instance.getAvailableNotices();
  }

  public static async save(notice: AdmitCardNotice): Promise<void> {
    return this.instance.save(notice);
  }

  public static async saveMany(notices: AdmitCardNotice[]): Promise<void> {
    return this.instance.putMany(notices);
  }

  public static async deleteById(id: string): Promise<void> {
    return this.instance.remove(id);
  }

  public static async clearAll(): Promise<void> {
    return this.instance.clear();
  }
}

// ============================================================================
// 3. Seat Plan Notice Repository
// ============================================================================

export class SeatPlanNoticeRepository extends SharedStoreCrud<SeatPlanNotice> {
  private static instance = new SeatPlanNoticeRepository();

  constructor() {
    super(STORES.SEAT_PLAN_NOTICES, 'id');
  }

  public static getInstance(): SeatPlanNoticeRepository {
    return this.instance;
  }

  public async getByCircularId(circularId: string): Promise<SeatPlanNotice[]> {
    const list = await this.getAll();
    return list
      .filter((item) => item.circularId === circularId)
      .sort((a, b) => (a.examDate || '').localeCompare(b.examDate || ''));
  }

  public async getAnnouncedNotices(): Promise<SeatPlanNotice[]> {
    const list = await this.getAll();
    return list.filter((item) => item.status === 'Announced' || item.status === 'Updated');
  }

  public async getByStage(stage: ExamStage): Promise<SeatPlanNotice[]> {
    const list = await this.getAll();
    return list.filter((item) => item.stage === stage);
  }

  public async save(notice: SeatPlanNotice): Promise<void> {
    const now = Date.now();
    await this.put({
      ...notice,
      updatedAt: notice.updatedAt || now,
      createdAt: notice.createdAt || now,
    });
  }

  // Static API delegates
  public static async getAll(): Promise<SeatPlanNotice[]> {
    return this.instance.getAll();
  }

  public static async getById(id: string): Promise<SeatPlanNotice | null> {
    return this.instance.getByKey(id);
  }

  public static async getByCircularId(circularId: string): Promise<SeatPlanNotice[]> {
    return this.instance.getByCircularId(circularId);
  }

  public static async getAnnouncedNotices(): Promise<SeatPlanNotice[]> {
    return this.instance.getAnnouncedNotices();
  }

  public static async save(notice: SeatPlanNotice): Promise<void> {
    return this.instance.save(notice);
  }

  public static async saveMany(notices: SeatPlanNotice[]): Promise<void> {
    return this.instance.putMany(notices);
  }

  public static async deleteById(id: string): Promise<void> {
    return this.instance.remove(id);
  }

  public static async clearAll(): Promise<void> {
    return this.instance.clear();
  }
}

// ============================================================================
// 4. Job Result Repository
// ============================================================================

export class JobResultRepository extends SharedStoreCrud<JobResult> {
  private static instance = new JobResultRepository();

  constructor() {
    super(STORES.JOB_RESULTS, 'id');
  }

  public static getInstance(): JobResultRepository {
    return this.instance;
  }

  public async getByCircularId(circularId: string): Promise<JobResult[]> {
    const list = await this.getAll();
    return list
      .filter((item) => item.circularId === circularId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  public async getPublishedResults(): Promise<JobResult[]> {
    const list = await this.getAll();
    return list.filter(
      (item) =>
        item.publicationStatus === 'Result Published' ||
        item.publicationStatus === 'Partially Published' ||
        item.publicationStatus === 'Revised Result Published'
    );
  }

  public async getByStage(stage: ResultStage): Promise<JobResult[]> {
    const list = await this.getAll();
    return list.filter((item) => item.stage === stage);
  }

  public async save(result: JobResult): Promise<void> {
    const now = Date.now();
    await this.put({
      ...result,
      updatedAt: result.updatedAt || now,
      createdAt: result.createdAt || now,
    });
  }

  // Static API delegates
  public static async getAll(): Promise<JobResult[]> {
    return this.instance.getAll();
  }

  public static async getById(id: string): Promise<JobResult | null> {
    return this.instance.getByKey(id);
  }

  public static async getByCircularId(circularId: string): Promise<JobResult[]> {
    return this.instance.getByCircularId(circularId);
  }

  public static async getPublishedResults(): Promise<JobResult[]> {
    return this.instance.getPublishedResults();
  }

  public static async save(result: JobResult): Promise<void> {
    return this.instance.save(result);
  }

  public static async saveMany(results: JobResult[]): Promise<void> {
    return this.instance.putMany(results);
  }

  public static async deleteById(id: string): Promise<void> {
    return this.instance.remove(id);
  }

  public static async clearAll(): Promise<void> {
    return this.instance.clear();
  }
}

// ============================================================================
// 5. Job Lifecycle Event Repository
// ============================================================================

export class JobLifecycleEventRepository extends SharedStoreCrud<JobEvent> {
  private static instance = new JobLifecycleEventRepository();

  constructor() {
    super(STORES.LIFECYCLE_EVENTS, 'id');
  }

  public static getInstance(): JobLifecycleEventRepository {
    return this.instance;
  }

  public async getByCircularId(circularId: string): Promise<JobEvent[]> {
    const list = await this.getAll();
    return list
      .filter((item) => item.circularId === circularId)
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  }

  public async getByEventType(eventType: LifecycleEventType): Promise<JobEvent[]> {
    const list = await this.getAll();
    return list.filter((item) => item.eventType === eventType);
  }

  public async save(event: JobEvent): Promise<void> {
    const now = Date.now();
    await this.put({
      ...event,
      updatedAt: event.updatedAt || now,
      createdAt: event.createdAt || now,
    });
  }

  // Static API delegates
  public static async getAll(): Promise<JobEvent[]> {
    return this.instance.getAll();
  }

  public static async getById(id: string): Promise<JobEvent | null> {
    return this.instance.getByKey(id);
  }

  public static async getByCircularId(circularId: string): Promise<JobEvent[]> {
    return this.instance.getByCircularId(circularId);
  }

  public static async save(event: JobEvent): Promise<void> {
    return this.instance.save(event);
  }

  public static async saveMany(events: JobEvent[]): Promise<void> {
    return this.instance.putMany(events);
  }

  public static async deleteById(id: string): Promise<void> {
    return this.instance.remove(id);
  }

  public static async clearAll(): Promise<void> {
    return this.instance.clear();
  }
}

// ============================================================================
// 6. Notice History Repository
// ============================================================================

export class NoticeHistoryRepository extends SharedStoreCrud<NoticeHistory> {
  private static instance = new NoticeHistoryRepository();

  constructor() {
    super(STORES.NOTICE_HISTORY, 'id');
  }

  public static getInstance(): NoticeHistoryRepository {
    return this.instance;
  }

  public async getByCircularId(circularId: string): Promise<NoticeHistory[]> {
    const list = await this.getAll();
    return list
      .filter((item) => item.circularId === circularId)
      .sort((a, b) => b.publishedAt - a.publishedAt);
  }

  public async getByType(noticeType: NoticeHistoryType): Promise<NoticeHistory[]> {
    const list = await this.getAll();
    return list.filter((item) => item.noticeType === noticeType);
  }

  public async save(notice: NoticeHistory): Promise<void> {
    await this.put({
      ...notice,
      publishedAt: notice.publishedAt || Date.now(),
    });
  }

  // Static API delegates
  public static async getAll(): Promise<NoticeHistory[]> {
    return this.instance.getAll();
  }

  public static async getById(id: string): Promise<NoticeHistory | null> {
    return this.instance.getByKey(id);
  }

  public static async getByCircularId(circularId: string): Promise<NoticeHistory[]> {
    return this.instance.getByCircularId(circularId);
  }

  public static async save(notice: NoticeHistory): Promise<void> {
    return this.instance.save(notice);
  }

  public static async saveMany(notices: NoticeHistory[]): Promise<void> {
    return this.instance.putMany(notices);
  }

  public static async deleteById(id: string): Promise<void> {
    return this.instance.remove(id);
  }

  public static async clearAll(): Promise<void> {
    return this.instance.clear();
  }
}

// ============================================================================
// Singletons & Unified Aggregation Helper
// ============================================================================

export const examScheduleRepository = ExamScheduleRepository.getInstance();
export const admitCardNoticeRepository = AdmitCardNoticeRepository.getInstance();
export const seatPlanNoticeRepository = SeatPlanNoticeRepository.getInstance();
export const jobResultRepository = JobResultRepository.getInstance();
export const jobLifecycleEventRepository = JobLifecycleEventRepository.getInstance();
export const noticeHistoryRepository = NoticeHistoryRepository.getInstance();

export async function getCompleteLifecycleForCircular(
  circularId: string,
  jobTitle = 'Unknown',
  organization = 'Unknown'
): Promise<JobLifecycleTimeline> {
  const [events, examSchedules, admitCardNotices, seatPlanNotices, results] = await Promise.all([
    jobLifecycleEventRepository.getByCircularId(circularId),
    examScheduleRepository.getByCircularId(circularId),
    admitCardNoticeRepository.getByCircularId(circularId),
    seatPlanNoticeRepository.getByCircularId(circularId),
    jobResultRepository.getByCircularId(circularId),
  ]);

  // Determine current lifecycle stage
  let currentStage: LifecycleEventType = 'PUBLICATION';
  if (results.length > 0) {
    const hasFinal = results.some((r) => r.stage === 'Final' || r.stage === 'Merit List');
    currentStage = hasFinal ? 'FINAL_SELECTION' : 'RESULT';
  } else if (examSchedules.some((e) => e.status === 'Completed')) {
    currentStage = 'RESULT';
  } else if (seatPlanNotices.length > 0) {
    currentStage = 'SEAT_PLAN';
  } else if (examSchedules.some((e) => e.status === 'Announced' || e.status === 'Rescheduled')) {
    currentStage = 'EXAM';
  } else if (admitCardNotices.some((a) => a.status === 'Available')) {
    currentStage = 'ADMIT_CARD';
  } else if (events.some((ev) => ev.eventType === 'APPLICATION_WINDOW')) {
    currentStage = 'APPLICATION_WINDOW';
  }

  return {
    circularId,
    jobTitle,
    organization,
    currentStage,
    events,
    examSchedules,
    admitCardNotices,
    seatPlanNotices,
    results,
    lastUpdated: Date.now(),
  };
}
