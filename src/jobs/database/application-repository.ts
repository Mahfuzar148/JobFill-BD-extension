// JobFill BD - Application Tracker Repository (IndexedDB + Fallback)
// Tracks local user application progress (Interested -> Applied -> Exam -> Result).
// Never auto-marks Applied without user action.

import { STORES } from '../../database/indexeddb';
import { ApplicationTrackerRecord, ApplicationStatus, NormalizedJobCircular } from '../types/job.types';
import { SharedStoreCrud } from './job-repository';

const appCrud = new SharedStoreCrud<ApplicationTrackerRecord>(STORES.APPLICATIONS, 'jobId');

export class ApplicationRepository {
  public static async getAll(): Promise<ApplicationTrackerRecord[]> {
    const list = await appCrud.getAll();
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  public static async getByJobId(jobId: string): Promise<ApplicationTrackerRecord | null> {
    return appCrud.getByKey(jobId);
  }

  public static async upsert(record: ApplicationTrackerRecord): Promise<ApplicationTrackerRecord> {
    const updated: ApplicationTrackerRecord = {
      ...record,
      updatedAt: Date.now(),
    };
    await appCrud.put(updated);
    return updated;
  }

  public static async setStatus(
    job: Pick<NormalizedJobCircular, 'id' | 'jobTitle' | 'organization' | 'applicationUrl' | 'circularUrl' | 'deadlineAt'>,
    status: ApplicationStatus,
    extra: Partial<
      Pick<
        ApplicationTrackerRecord,
        | 'applicationDate'
        | 'teletalkUserId'
        | 'applicationRefId'
        | 'feePaymentStatus'
        | 'feeDeadlineAt'
        | 'examRoll'
        | 'examVenue'
        | 'notes'
        | 'examDate'
        | 'admitCardUrl'
        | 'resultUrl'
      >
    > = {}
  ): Promise<ApplicationTrackerRecord> {
    const existing = await this.getByJobId(job.id);
    const now = Date.now();
    const record: ApplicationTrackerRecord = {
      jobId: job.id,
      jobTitle: job.jobTitle,
      organization: job.organization,
      applicationUrl: job.applicationUrl,
      circularUrl: job.circularUrl,
      deadlineAt: job.deadlineAt,
      status,
      applicationDate:
        extra.applicationDate ??
        existing?.applicationDate ??
        (status === 'Applied' ? new Date().toISOString().slice(0, 10) : undefined),
      teletalkUserId: extra.teletalkUserId ?? existing?.teletalkUserId,
      applicationRefId: extra.applicationRefId ?? existing?.applicationRefId,
      feePaymentStatus: extra.feePaymentStatus ?? existing?.feePaymentStatus,
      feeDeadlineAt: extra.feeDeadlineAt ?? existing?.feeDeadlineAt,
      examRoll: extra.examRoll ?? existing?.examRoll,
      examVenue: extra.examVenue ?? existing?.examVenue,
      notes: extra.notes ?? existing?.notes,
      examDate: extra.examDate ?? existing?.examDate,
      admitCardUrl: extra.admitCardUrl ?? existing?.admitCardUrl,
      resultUrl: extra.resultUrl ?? existing?.resultUrl,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await appCrud.put(record);
    return record;
  }

  public static async remove(jobId: string): Promise<void> {
    await appCrud.remove(jobId);
  }

  public static async clearAll(): Promise<void> {
    await appCrud.clear();
  }
}
