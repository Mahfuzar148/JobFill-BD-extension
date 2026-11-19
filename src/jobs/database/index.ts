// JobFill BD - Database Repositories Index
// Re-exports all job repositories and lifecycle stores with explicit named exports for tree-shaking clarity.

export * from './job-repository';
export * from './job-lifecycle-repository';
export * from './application-repository';
export * from './bookmark-repository';
export * from './job-visit-repository';
export * from './notification-repository';

// Explicit lifecycle repository and aggregator named exports
export {
  ExamScheduleRepository,
  examScheduleRepository,
  AdmitCardNoticeRepository,
  admitCardNoticeRepository,
  SeatPlanNoticeRepository,
  seatPlanNoticeRepository,
  JobResultRepository,
  jobResultRepository,
  JobLifecycleEventRepository,
  jobLifecycleEventRepository,
  NoticeHistoryRepository,
  noticeHistoryRepository,
  getCompleteLifecycleForCircular,
} from './job-lifecycle-repository';

// Lifecycle stores seeding helper
export { seedDefaultLifecycleStores } from '../data/seed-circulars';
