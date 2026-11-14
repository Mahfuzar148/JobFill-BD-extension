// JobFill BD - Application Tracker Repository (IndexedDB + Fallback)
// Tracks local user application progress (Interested -> Applied -> Exam -> Result).
// Never auto-marks Applied without user action.

import { STORES } from '../../database/indexeddb';
import { ApplicationTrackerRecord, ApplicationStatus, NormalizedJobCircular } from '../types/job.types';
import { SharedStoreCrud } from './job-repository';
import { JobVisitRepository } from './job-visit-repository';

export interface RepairMisclassifiedResult {
  scanned: number;
  repaired: number;
  unmodified: number;
  repairedRecords: ApplicationTrackerRecord[];
}

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
    job: Pick<NormalizedJobCircular, 'id' | 'jobTitle' | 'organization' | 'applicationUrl' | 'circularUrl' | 'deadlineAt'> & {
      circularNumber?: string;
    },
    status: ApplicationStatus,
    extra: Partial<
      Pick<
        ApplicationTrackerRecord,
        | 'circularId'
        | 'applicationDate'
        | 'teletalkUserId'
        | 'applicationRefId'
        | 'transactionId'
        | 'feePaymentStatus'
        | 'feeDeadlineAt'
        | 'admitCardStatus'
        | 'examRoll'
        | 'examVenue'
        | 'notes'
        | 'examDate'
        | 'admitCardUrl'
        | 'resultSummary'
        | 'resultUrl'
        | 'submissionConfirmedAt'
        | 'submissionAttemptedAt'
        | 'needsReview'
        | 'reviewReason'
      >
    > = {}
  ): Promise<ApplicationTrackerRecord> {
    const existing = await this.getByJobId(job.id);
    const now = Date.now();
    const record: ApplicationTrackerRecord = {
      jobId: job.id,
      jobTitle: job.jobTitle,
      organization: job.organization,
      circularId: extra.circularId ?? existing?.circularId ?? job.circularNumber,
      applicationUrl: job.applicationUrl,
      circularUrl: job.circularUrl,
      deadlineAt: job.deadlineAt,
      status,
      applicationDate:
        extra.applicationDate ??
        existing?.applicationDate ??
        (status === 'Applied' ? new Date().toISOString().slice(0, 10) : undefined),
      submissionAttemptedAt: extra.submissionAttemptedAt ?? existing?.submissionAttemptedAt,
      submissionConfirmedAt:
        extra.submissionConfirmedAt ??
        existing?.submissionConfirmedAt ??
        (status === 'Applied' ? now : undefined),
      teletalkUserId: extra.teletalkUserId ?? existing?.teletalkUserId,
      applicationRefId: extra.applicationRefId ?? existing?.applicationRefId,
      transactionId: extra.transactionId ?? existing?.transactionId,
      feePaymentStatus: extra.feePaymentStatus ?? existing?.feePaymentStatus,
      feeDeadlineAt: extra.feeDeadlineAt ?? existing?.feeDeadlineAt,
      admitCardStatus: extra.admitCardStatus ?? existing?.admitCardStatus,
      examRoll: extra.examRoll ?? existing?.examRoll,
      examVenue: extra.examVenue ?? existing?.examVenue,
      notes: extra.notes ?? existing?.notes,
      examDate: extra.examDate ?? existing?.examDate,
      admitCardUrl: extra.admitCardUrl ?? existing?.admitCardUrl,
      resultSummary: extra.resultSummary ?? existing?.resultSummary,
      resultUrl: extra.resultUrl ?? existing?.resultUrl,
      needsReview: extra.needsReview ?? (status === 'Applied' ? false : existing?.needsReview),
      reviewReason: extra.reviewReason ?? (status === 'Applied' ? undefined : existing?.reviewReason),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await appCrud.put(record);
    return record;
  }

  /**
   * Repairs misclassified "Applied" records that have zero submission evidence
   * (no confirmation timestamp, no User ID, no applicant ID, no transaction ID,
   * no exam info, and no notes). Safely reclassifies them to 'Needs Manual Confirmation'
   * with needsReview=true and ensures a visit record exists in JobVisitRepository.
   * Never deletes records or loses user data.
   */
  public static async repairMisclassifiedRecords(): Promise<RepairMisclassifiedResult> {
    const all = await this.getAll();
    let repairedCount = 0;
    const repairedRecords: ApplicationTrackerRecord[] = [];

    for (const rec of all) {
      if (rec.status === 'Applied') {
        const hasEvidence = Boolean(
          rec.submissionConfirmedAt ||
            rec.teletalkUserId ||
            rec.applicantId ||
            rec.applicationRefId ||
            rec.transactionId ||
            rec.examRoll ||
            rec.examDate ||
            rec.examVenue ||
            rec.admitCardStatus ||
            rec.resultSummary ||
            (rec.notes && rec.notes.trim().length > 0)
        );

        if (!hasEvidence) {
          rec.status = 'Needs Manual Confirmation';
          rec.needsReview = true;
          rec.reviewReason = 'Auto-detected: Marked as Applied without verified submission evidence.';
          rec.updatedAt = Date.now();
          await appCrud.put(rec);
          repairedCount += 1;
          repairedRecords.push(rec);

          // Ensure visit is preserved in JobVisitRepository
          try {
            await JobVisitRepository.recordVisit({
              jobId: rec.jobId,
              jobTitle: rec.jobTitle,
              organization: rec.organization,
              circularUrl: rec.circularUrl || rec.applicationUrl || '',
              deadlineAt: rec.deadlineAt,
              verificationStatus: 'verified',
            });
          } catch {
            // safe fallback
          }
        }
      }
    }

    return {
      scanned: all.length,
      repaired: repairedCount,
      unmodified: all.length - repairedCount,
      repairedRecords,
    };
  }

  public static async exportBackup(): Promise<{ schemaVersion: 1; exportedAt: string; records: ApplicationTrackerRecord[] }> {
    const records = await this.getAll();
    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      records,
    };
  }

  public static async restoreBackupMerge(incoming: ApplicationTrackerRecord[]): Promise<number> {
    if (!Array.isArray(incoming)) {
      throw new Error('Backup payload must contain a records array.');
    }
    const existingList = await this.getAll();
    const byId = new Map(existingList.map((r) => [r.jobId, r]));
    let restored = 0;

    for (const rec of incoming) {
      if (!rec || typeof rec.jobId !== 'string' || typeof rec.jobTitle !== 'string' || typeof rec.organization !== 'string') {
        continue;
      }
      const prev = byId.get(rec.jobId);
      if (!prev || (Number(rec.updatedAt) || 0) >= (Number(prev.updatedAt) || 0)) {
        await appCrud.put({
          ...rec,
          createdAt: prev?.createdAt ?? rec.createdAt ?? Date.now(),
          updatedAt: rec.updatedAt || Date.now(),
        });
        restored += 1;
      }
    }
    return restored;
  }

  public static async remove(jobId: string): Promise<void> {
    await appCrud.remove(jobId);
  }

  public static async clearAll(): Promise<void> {
    await appCrud.clear();
  }
}
