// JobFill BD - Automatic Job Circular Visit Tracking Repository (IndexedDB + Fallback)
// Stores and updates recognized job circular visits with deduplication, URL canonicalization,
// and user-controlled toggle. Never uses chrome.history or tracks unrelated browsing.

import { STORES } from '../../database/indexeddb';
import { JobVisitRecord } from '../types/job.types';
import { SharedStoreCrud } from './job-repository';

export const KEY_TRACK_VISITS_SETTING = 'jobfill_setting_track_visits';

const visitCrud = new SharedStoreCrud<JobVisitRecord>(STORES.JOB_VISITS, 'visitId');

// Simple fast deterministic hash for stable visit identifiers
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Strips known marketing/tracking query parameters while strictly preserving
 * essential job identifiers (id, circular_id, job_id, post_id, etc.).
 */
export function canonicalizeJobUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  try {
    const parsed = new URL(rawUrl);
    const trackingKeys = new Set([
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'fbclid',
      'gclid',
      '_ga',
      'ref',
      'source',
      'mc_cid',
      'mc_eid',
    ]);

    const params = new URLSearchParams(parsed.search);
    for (const key of Array.from(params.keys())) {
      if (trackingKeys.has(key.toLowerCase()) || key.toLowerCase().startsWith('utm_')) {
        params.delete(key);
      }
    }

    const cleanSearch = params.toString() ? `?${params.toString()}` : '';
    // Normalize pathname by removing trailing slash if not root
    const cleanPath = parsed.pathname.length > 1 ? parsed.pathname.replace(/\/+$/, '') : parsed.pathname;
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${cleanPath}${cleanSearch}`;
  } catch {
    return rawUrl.trim().split('#')[0];
  }
}

export class JobVisitRepository {
  public static canonicalizeJobUrl = canonicalizeJobUrl;

  public static async isVisitTrackingEnabled(): Promise<boolean> {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const res = await new Promise<{ [key: string]: any }>((resolve) => {
        chrome.storage.local.get([KEY_TRACK_VISITS_SETTING], (r) => resolve(r || {}));
      });
      return res[KEY_TRACK_VISITS_SETTING] !== false; // default true
    }
    if (typeof localStorage !== 'undefined') {
      const val = localStorage.getItem(KEY_TRACK_VISITS_SETTING);
      return val !== 'false';
    }
    return true;
  }

  public static async setVisitTrackingEnabled(enabled: boolean): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ [KEY_TRACK_VISITS_SETTING]: enabled });
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEY_TRACK_VISITS_SETTING, String(enabled));
    }
  }

  public static async getAllVisits(): Promise<JobVisitRecord[]> {
    const list = await visitCrud.getAll();
    return list.sort((a, b) => b.lastVisitedAt - a.lastVisitedAt);
  }

  public static async getByVisitId(visitId: string): Promise<JobVisitRecord | null> {
    return visitCrud.getByKey(visitId);
  }

  public static async getByJobId(jobId: string): Promise<JobVisitRecord | null> {
    if (!jobId) return null;
    const all = await visitCrud.getAll();
    return all.find((v) => v.jobId === jobId) || null;
  }

  public static async recordVisit(input: {
    jobId?: string | null;
    sourceId?: string;
    organization: string;
    jobTitle: string;
    circularUrl: string;
    deadlineAt?: number | null;
    verificationStatus?: 'verified' | 'unverified' | 'internal';
    circularId?: string;
    applicationUrl?: string | null;
    subStatus?: string;
  }): Promise<JobVisitRecord | null> {
    const enabled = await this.isVisitTrackingEnabled();
    if (!enabled) return null;

    const rawUrl = (input.circularUrl || '').trim();
    if (!rawUrl) return null;

    const canonicalUrl = canonicalizeJobUrl(rawUrl);
    const now = Date.now();

    const allVisits = await visitCrud.getAll();
    const existing = allVisits.find(
      (v) => (input.jobId && v.jobId === input.jobId) || v.canonicalUrl === canonicalUrl
    );

    if (existing) {
      const updated: JobVisitRecord = {
        ...existing,
        jobId: existing.jobId || input.jobId || null,
        jobTitle: input.jobTitle && input.jobTitle !== 'Circular' ? input.jobTitle : existing.jobTitle,
        organization: input.organization && input.organization !== 'Unknown' ? input.organization : existing.organization,
        deadlineAt: input.deadlineAt ?? existing.deadlineAt,
        circularId: input.circularId || existing.circularId,
        applicationUrl: input.applicationUrl ?? existing.applicationUrl,
        subStatus: input.subStatus || existing.subStatus,
        verificationStatus: existing.verificationStatus === 'verified' ? 'verified' : (input.verificationStatus || existing.verificationStatus),
        lastVisitedAt: now,
        visitCount: (existing.visitCount || 1) + 1,
      };
      await visitCrud.put(updated);
      return updated;
    }

    const visitId = input.jobId ? `visit_${input.jobId}` : `visit_${hashString(canonicalUrl)}`;
    const newRecord: JobVisitRecord = {
      visitId,
      jobId: input.jobId || null,
      sourceId: input.sourceId || 'portal_direct',
      organization: input.organization || 'General Recruitment',
      jobTitle: input.jobTitle || 'Official Circular',
      circularUrl: rawUrl,
      canonicalUrl,
      firstVisitedAt: now,
      lastVisitedAt: now,
      visitCount: 1,
      verificationStatus: input.verificationStatus || 'unverified',
      deadlineAt: input.deadlineAt ?? null,
      circularId: input.circularId,
      applicationUrl: input.applicationUrl || null,
      subStatus: input.subStatus,
    };

    await visitCrud.put(newRecord);
    return newRecord;
  }

  public static async removeVisit(visitId: string): Promise<void> {
    await visitCrud.remove(visitId);
  }

  public static async removeVisitByJobId(jobId: string): Promise<void> {
    if (!jobId) return;
    const all = await visitCrud.getAll();
    const match = all.find((v) => v.jobId === jobId || v.visitId === jobId);
    if (match) {
      await visitCrud.remove(match.visitId);
    }
  }

  public static async clearAllVisits(): Promise<void> {
    await visitCrud.clear();
  }
}
