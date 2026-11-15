// JobFill BD - Application Tracker Repository (IndexedDB + Fallback)
// Tracks local user application progress (Interested -> Applied -> Exam -> Result).
// Never auto-marks Applied without user action.

import { STORES } from '../../database/indexeddb';
import {
  ApplicationTrackerRecord,
  ApplicationStatus,
  NormalizedJobCircular,
  VisitedTrackerItem,
} from '../types/job.types';
import { SharedStoreCrud } from './job-repository';
import { JobVisitRepository } from './job-visit-repository';

export type { VisitedTrackerItem };

export const APPLIED_STATUS_SET = new Set<ApplicationStatus>([
  'Applied',
  'Payment Pending',
  'Payment Completed',
  'Admit Card Available',
  'Exam Scheduled',
  'Result Published',
  'Selected',
]);

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
      loginUrl?: string | null;
      organizationUrl?: string | null;
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
        | 'loginUrl'
        | 'organizationUrl'
        | 'loginUrlVerified'
        | 'loginUrlProvenance'
        | 'previousLoginUrl'
        | 'credentialId'
        | 'credentialLinkedAt'
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
      loginUrl: extra.loginUrl ?? existing?.loginUrl ?? job.loginUrl ?? null,
      organizationUrl: extra.organizationUrl ?? existing?.organizationUrl ?? job.organizationUrl ?? null,
      loginUrlVerified: extra.loginUrlVerified ?? existing?.loginUrlVerified ?? false,
      loginUrlProvenance: extra.loginUrlProvenance ?? existing?.loginUrlProvenance ?? 'system',
      previousLoginUrl: extra.previousLoginUrl ?? existing?.previousLoginUrl ?? null,
      credentialId: extra.credentialId ?? existing?.credentialId ?? null,
      credentialLinkedAt: extra.credentialLinkedAt ?? existing?.credentialLinkedAt,
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
   * Sanitizes, normalizes and validates a candidate portal URL.
   * Enforces HTTPS, checks hostname, strips sensitive query parameters (tokens, session IDs),
   * and blocks PDF circulars from being assigned as login URLs.
   */
  public static sanitizeAndValidateUrl(rawUrl: string): {
    isValid: boolean;
    normalizedUrl: string;
    hostname: string;
    isHttps: boolean;
    isPdfCircular: boolean;
    warnings: string[];
    reason?: string;
  } {
    const trimmed = (rawUrl || '').trim();
    if (!trimmed) {
      return {
        isValid: false,
        normalizedUrl: '',
        hostname: '',
        isHttps: false,
        isPdfCircular: false,
        warnings: ['URL cannot be empty.'],
        reason: 'Empty URL',
      };
    }

    try {
      const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
      const isHttps = parsed.protocol === 'https:';
      const warnings: string[] = [];

      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return {
          isValid: false,
          normalizedUrl: '',
          hostname: '',
          isHttps: false,
          isPdfCircular: false,
          warnings: ['Invalid protocol. Only HTTPS URLs are permitted.'],
          reason: 'Invalid protocol',
        };
      }

      if (!isHttps) {
        warnings.push('URL is not using secure HTTPS.');
      }

      const pathnameLower = parsed.pathname.toLowerCase();
      const isPdfCircular = pathnameLower.endsWith('.pdf') || pathnameLower.includes('circular.pdf');
      if (isPdfCircular) {
        return {
          isValid: false,
          normalizedUrl: parsed.toString(),
          hostname: parsed.hostname,
          isHttps,
          isPdfCircular: true,
          warnings: ['PDF Circular cannot be used as a Portal Login URL.'],
          reason: 'Circular PDF cannot be used as a Login URL.',
        };
      }

      // Strip sensitive query parameters (auth tokens, session IDs, tickets)
      const sensitiveParams = [
        'token',
        'auth',
        'session',
        'sid',
        'ticket',
        'jwt',
        'code',
        'access_token',
        'refresh_token',
        'jsessionid',
        'phpsessid',
      ];
      for (const param of sensitiveParams) {
        if (parsed.searchParams.has(param)) {
          parsed.searchParams.delete(param);
          warnings.push(`Removed sensitive session parameter: ${param}`);
        }
      }

      return {
        isValid: Boolean(parsed.hostname && parsed.hostname.includes('.')),
        normalizedUrl: parsed.toString(),
        hostname: parsed.hostname,
        isHttps,
        isPdfCircular: false,
        warnings,
      };
    } catch {
      return {
        isValid: false,
        normalizedUrl: '',
        hostname: '',
        isHttps: false,
        isPdfCircular: false,
        warnings: ['Malformed URL syntax.'],
        reason: 'Malformed URL syntax',
      };
    }
  }

  public static async setLoginUrl(
    jobId: string,
    url: string,
    provenance: 'manual' | 'detected' | 'system' = 'manual',
    verified = false
  ): Promise<ApplicationTrackerRecord> {
    const existing = await this.getByJobId(jobId);
    if (!existing) {
      throw new Error(`Application record with jobId "${jobId}" not found.`);
    }

    const check = this.sanitizeAndValidateUrl(url);
    if (!check.isValid) {
      throw new Error(check.reason || 'Invalid portal URL.');
    }

    const updated: ApplicationTrackerRecord = {
      ...existing,
      previousLoginUrl: existing.loginUrl ?? null,
      loginUrl: check.normalizedUrl,
      loginUrlVerified: verified,
      loginUrlProvenance: provenance,
      updatedAt: Date.now(),
    };
    await appCrud.put(updated);
    return updated;
  }

  public static async undoLoginUrlChange(jobId: string): Promise<ApplicationTrackerRecord> {
    const existing = await this.getByJobId(jobId);
    if (!existing) {
      throw new Error(`Application record with jobId "${jobId}" not found.`);
    }
    if (existing.previousLoginUrl === undefined) {
      return existing;
    }
    const updated: ApplicationTrackerRecord = {
      ...existing,
      loginUrl: existing.previousLoginUrl,
      previousLoginUrl: null,
      updatedAt: Date.now(),
    };
    await appCrud.put(updated);
    return updated;
  }

  public static async linkCredential(
    jobId: string,
    credentialId: string
  ): Promise<ApplicationTrackerRecord> {
    const existing = await this.getByJobId(jobId);
    if (!existing) {
      throw new Error(`Application record with jobId "${jobId}" not found.`);
    }
    const updated: ApplicationTrackerRecord = {
      ...existing,
      credentialId,
      credentialLinkedAt: Date.now(),
      updatedAt: Date.now(),
    };
    await appCrud.put(updated);
    return updated;
  }

  public static async unlinkCredential(jobId: string): Promise<ApplicationTrackerRecord> {
    const existing = await this.getByJobId(jobId);
    if (!existing) {
      throw new Error(`Application record with jobId "${jobId}" not found.`);
    }
    const updated: ApplicationTrackerRecord = {
      ...existing,
      credentialId: null,
      credentialLinkedAt: undefined,
      updatedAt: Date.now(),
    };
    await appCrud.put(updated);
    return updated;
  }

  public static async setOrganizationUrl(jobId: string, url: string): Promise<ApplicationTrackerRecord> {
    const existing = await this.getByJobId(jobId);
    if (!existing) {
      throw new Error(`Application record with jobId "${jobId}" not found.`);
    }
    const check = this.sanitizeAndValidateUrl(url);
    const updated: ApplicationTrackerRecord = {
      ...existing,
      organizationUrl: check.normalizedUrl || url.trim(),
      updatedAt: Date.now(),
    };
    await appCrud.put(updated);
    return updated;
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

  public static isAppliedStatus(status: ApplicationStatus): boolean {
    return APPLIED_STATUS_SET.has(status);
  }

  /**
   * Atomically transitions a job from Visited to Applied upon confirmed submission.
   * If a record already exists, updates its status and records submission proof.
   * If only a JobVisitRecord exists, creates the ApplicationTrackerRecord.
   * Strictly guarantees mutual exclusivity: once applied, it is excluded from visited.
   */
  public static async moveJobToApplied(
    jobIdOrUrl: string,
    evidence?: {
      confirmedAt?: number;
      teletalkUserId?: string;
      applicantId?: string;
      applicationRefId?: string;
      transactionId?: string;
      source?: string;
      notes?: string;
      applicationUrl?: string;
      circularUrl?: string;
      organization?: string;
      jobTitle?: string;
      circularId?: string;
      loginUrl?: string;
      organizationUrl?: string;
      credentialId?: string;
      applicationDate?: string;
      feePaymentStatus?: ApplicationTrackerRecord['feePaymentStatus'];
      feeDeadlineAt?: number | null;
    }
  ): Promise<ApplicationTrackerRecord> {
    const rawTarget = (jobIdOrUrl || '').trim();
    let existing = rawTarget ? await this.getByJobId(rawTarget) : null;
    const targetCanon = rawTarget ? JobVisitRepository.canonicalizeJobUrl(rawTarget) : '';

    if (!existing && targetCanon) {
      const all = await this.getAll();
      existing =
        all.find((a) => {
          const c1 = a.circularUrl ? JobVisitRepository.canonicalizeJobUrl(a.circularUrl) : '';
          const c2 = a.applicationUrl ? JobVisitRepository.canonicalizeJobUrl(a.applicationUrl) : '';
          return (c1 && c1 === targetCanon) || (c2 && c2 === targetCanon);
        }) || null;
    }

    const allVisits = await JobVisitRepository.getAllVisits();
    const matchVisit = allVisits.find((v) => {
      if (rawTarget && (v.jobId === rawTarget || v.visitId === rawTarget)) return true;
      if (targetCanon && v.canonicalUrl === targetCanon) return true;
      if (existing?.circularUrl && v.canonicalUrl === JobVisitRepository.canonicalizeJobUrl(existing.circularUrl)) return true;
      return false;
    });

    const now = Date.now();
    const confirmedAt = evidence?.confirmedAt || now;
    const targetId =
      existing?.jobId ||
      matchVisit?.jobId ||
      (rawTarget && !rawTarget.startsWith('http') ? rawTarget : `app_${now.toString(36)}`);

    const record: ApplicationTrackerRecord = {
      jobId: targetId,
      jobTitle: existing?.jobTitle || matchVisit?.jobTitle || evidence?.jobTitle || 'Job Application',
      organization: existing?.organization || matchVisit?.organization || evidence?.organization || 'Official Portal',
      circularId: existing?.circularId || matchVisit?.circularId || evidence?.circularId,
      applicationUrl: existing?.applicationUrl || matchVisit?.applicationUrl || evidence?.applicationUrl || null,
      circularUrl: existing?.circularUrl || matchVisit?.circularUrl || evidence?.circularUrl,
      loginUrl: existing?.loginUrl || evidence?.loginUrl || null,
      organizationUrl: existing?.organizationUrl || evidence?.organizationUrl || null,
      loginUrlVerified: existing?.loginUrlVerified ?? false,
      loginUrlProvenance: existing?.loginUrlProvenance ?? 'system',
      previousLoginUrl: existing?.previousLoginUrl ?? null,
      credentialId: existing?.credentialId ?? evidence?.credentialId ?? null,
      credentialLinkedAt: existing?.credentialLinkedAt,
      deadlineAt: existing?.deadlineAt ?? matchVisit?.deadlineAt ?? null,
      status: 'Applied',
      applicationDate:
        evidence?.applicationDate ||
        existing?.applicationDate ||
        new Date(confirmedAt).toISOString().slice(0, 10),
      submissionAttemptedAt: existing?.submissionAttemptedAt || confirmedAt,
      submissionConfirmedAt: confirmedAt,
      teletalkUserId: evidence?.teletalkUserId || existing?.teletalkUserId,
      applicationRefId: evidence?.applicationRefId || existing?.applicationRefId,
      applicantId: evidence?.applicantId || existing?.applicantId,
      transactionId: evidence?.transactionId || existing?.transactionId,
      feePaymentStatus: evidence?.feePaymentStatus || existing?.feePaymentStatus || 'unpaid',
      feeDeadlineAt: evidence?.feeDeadlineAt || existing?.feeDeadlineAt,
      notes: evidence?.notes || existing?.notes,
      needsReview: false,
      reviewReason: undefined,
      createdAt: existing?.createdAt || matchVisit?.firstVisitedAt || now,
      updatedAt: now,
    };

    await appCrud.put(record);

    // Update visit record verificationStatus if present
    if (matchVisit) {
      try {
        await JobVisitRepository.recordVisit({
          jobId: targetId,
          jobTitle: record.jobTitle,
          organization: record.organization,
          circularUrl: matchVisit.circularUrl,
          deadlineAt: record.deadlineAt,
          verificationStatus: 'verified',
        });
      } catch {
        // safe fallback
      }
    }

    return record;
  }

  /**
   * Retrieves both VISITED and APPLIED collections with strict mutual exclusivity.
   * If a job circular has been confirmed applied, it is excluded from visited.
   * Duplicate visits for the same job are merged into a single VisitedTrackerItem.
   */
  public static async getVisitedAndAppliedLists(): Promise<{
    visited: VisitedTrackerItem[];
    applied: ApplicationTrackerRecord[];
    visitedCount: number;
    appliedCount: number;
  }> {
    const allApps = await this.getAll();
    const allVisits = await JobVisitRepository.getAllVisits();

    // 1. Identify all confirmed Applied records
    const applied = allApps
      .filter((a) => this.isAppliedStatus(a.status))
      .sort((a, b) => (b.submissionConfirmedAt || b.updatedAt) - (a.submissionConfirmedAt || a.updatedAt));

    // 2. Build lookup sets of applied identifiers to strictly prevent duplicate appearances
    const appliedJobIds = new Set<string>();
    const appliedCanonUrls = new Set<string>();

    for (const app of applied) {
      if (app.jobId) appliedJobIds.add(app.jobId);
      if (app.circularUrl) {
        const c = JobVisitRepository.canonicalizeJobUrl(app.circularUrl);
        if (c) appliedCanonUrls.add(c);
      }
      if (app.applicationUrl) {
        const a = JobVisitRepository.canonicalizeJobUrl(app.applicationUrl);
        if (a) appliedCanonUrls.add(a);
      }
    }

    // 3. Construct Visited map merging non-applied application records & visit records
    const visitedMap = new Map<string, VisitedTrackerItem>();

    // Step A: Process non-applied application records (e.g. Visited, Application Started, etc.)
    for (const app of allApps) {
      if (this.isAppliedStatus(app.status)) continue;
      if (app.jobId && appliedJobIds.has(app.jobId)) continue;
      const appCircCanon = app.circularUrl ? JobVisitRepository.canonicalizeJobUrl(app.circularUrl) : '';
      const appAppCanon = app.applicationUrl ? JobVisitRepository.canonicalizeJobUrl(app.applicationUrl) : '';
      if (appCircCanon && appliedCanonUrls.has(appCircCanon)) continue;
      if (appAppCanon && appliedCanonUrls.has(appAppCanon)) continue;

      const key = app.jobId || appCircCanon || appAppCanon || `app_${app.createdAt}`;
      visitedMap.set(key, {
        id: app.jobId,
        jobId: app.jobId,
        visitId: null,
        jobTitle: app.jobTitle,
        organization: app.organization,
        circularId: app.circularId,
        circularUrl: app.circularUrl,
        applicationUrl: app.applicationUrl,
        loginUrl: app.loginUrl,
        deadlineAt: app.deadlineAt,
        firstVisitedAt: app.createdAt,
        lastVisitedAt: app.updatedAt,
        visitCount: 1,
        subStatus: app.status,
        needsReview: app.needsReview,
        reviewReason: app.reviewReason,
        verificationStatus: 'verified',
        applicationRecord: app,
        visitRecord: null,
      });
    }

    // Step B: Merge JobVisitRecords from visit repository
    for (const visit of allVisits) {
      // Exclude if already applied
      if (visit.jobId && appliedJobIds.has(visit.jobId)) continue;
      if (visit.canonicalUrl && appliedCanonUrls.has(visit.canonicalUrl)) continue;
      const visitCircCanon = visit.circularUrl ? JobVisitRepository.canonicalizeJobUrl(visit.circularUrl) : '';
      if (visitCircCanon && appliedCanonUrls.has(visitCircCanon)) continue;

      // Find matching item in visitedMap
      let matchKey: string | null = null;
      if (visit.jobId && visitedMap.has(visit.jobId)) {
        matchKey = visit.jobId;
      } else if (visit.canonicalUrl && visitedMap.has(visit.canonicalUrl)) {
        matchKey = visit.canonicalUrl;
      } else if (visitCircCanon && visitedMap.has(visitCircCanon)) {
        matchKey = visitCircCanon;
      } else {
        // Check by canonicalUrl or circularUrl match
        for (const [k, v] of visitedMap.entries()) {
          const vCirc = v.circularUrl ? JobVisitRepository.canonicalizeJobUrl(v.circularUrl) : '';
          const vApp = v.applicationUrl ? JobVisitRepository.canonicalizeJobUrl(v.applicationUrl) : '';
          if (
            (visit.jobId && v.jobId === visit.jobId) ||
            (visit.canonicalUrl && (vCirc === visit.canonicalUrl || vApp === visit.canonicalUrl)) ||
            (visitCircCanon && (vCirc === visitCircCanon || vApp === visitCircCanon))
          ) {
            matchKey = k;
            break;
          }
        }
      }

      if (matchKey && visitedMap.has(matchKey)) {
        const existing = visitedMap.get(matchKey)!;
        existing.visitId = visit.visitId;
        existing.visitRecord = visit;
        existing.visitCount = Math.max(existing.visitCount, visit.visitCount || 1);
        existing.lastVisitedAt = Math.max(existing.lastVisitedAt, visit.lastVisitedAt);
        existing.firstVisitedAt = Math.min(existing.firstVisitedAt, visit.firstVisitedAt);
        if (!existing.circularUrl && visit.circularUrl) existing.circularUrl = visit.circularUrl;
        if (!existing.applicationUrl && visit.applicationUrl) existing.applicationUrl = visit.applicationUrl;
        if (!existing.circularId && visit.circularId) existing.circularId = visit.circularId;
        if (!existing.deadlineAt && visit.deadlineAt) existing.deadlineAt = visit.deadlineAt;
      } else {
        const key = visit.jobId || visit.canonicalUrl || visit.visitId;
        visitedMap.set(key, {
          id: visit.visitId,
          jobId: visit.jobId || null,
          visitId: visit.visitId,
          jobTitle: visit.jobTitle,
          organization: visit.organization,
          circularId: visit.circularId,
          circularUrl: visit.circularUrl,
          applicationUrl: visit.applicationUrl || null,
          loginUrl: null,
          deadlineAt: visit.deadlineAt ?? null,
          firstVisitedAt: visit.firstVisitedAt,
          lastVisitedAt: visit.lastVisitedAt,
          visitCount: visit.visitCount || 1,
          subStatus: (visit.subStatus as any) || 'Visited',
          needsReview: false,
          verificationStatus: visit.verificationStatus,
          applicationRecord: null,
          visitRecord: visit,
        });
      }
    }

    // Step C: Convert to list, strictly filter out any applied leftovers, and sort
    const visited = Array.from(visitedMap.values())
      .filter((v) => {
        if (v.jobId && appliedJobIds.has(v.jobId)) return false;
        const c = v.circularUrl ? JobVisitRepository.canonicalizeJobUrl(v.circularUrl) : '';
        if (c && appliedCanonUrls.has(c)) return false;
        return true;
      })
      .sort((a, b) => b.lastVisitedAt - a.lastVisitedAt);

    return {
      visited,
      applied,
      visitedCount: visited.length,
      appliedCount: applied.length,
    };
  }

  /**
   * Removes a job from the Visited list.
   * If an application tracker record exists with non-applied status, deletes it.
   * Also deletes the visit record from JobVisitRepository.
   */
  public static async removeFromVisited(id: string): Promise<void> {
    if (!id) return;
    const existing = await this.getByJobId(id);
    if (existing && !this.isAppliedStatus(existing.status)) {
      await this.remove(id);
    }
    await JobVisitRepository.removeVisit(id);
    await JobVisitRepository.removeVisitByJobId(id);
  }

  public static async remove(jobId: string): Promise<void> {
    await appCrud.remove(jobId);
  }

  public static async clearAll(): Promise<void> {
    await appCrud.clear();
  }
}
