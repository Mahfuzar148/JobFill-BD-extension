// JobFill BD - Unified Career & Exam Calendar Engine (Asia/Dhaka Timezone)
// Combines circular deadlines, tracker exam/interview/admit/result dates,
// document expiries (where explicitly set by user), and custom study reminders
// with deterministic sourceRefId deduplication.

import { IndexedDBManager, STORES } from '../database/indexeddb';
import type { NormalizedJobCircular, ApplicationTrackerRecord } from '../jobs/types/job.types';
import type { DocumentMetadata } from '../types/profile';

export const DHAKA_TIMEZONE = 'Asia/Dhaka';
const CALENDAR_FALLBACK_KEY = 'jobfill_calendar_events_v1';

export type CalendarEventKind =
  | 'deadline'
  | 'exam'
  | 'interview'
  | 'admit_card'
  | 'result'
  | 'fee_deadline'
  | 'document_expiry'
  | 'study_plan'
  | 'custom_reminder';

export interface CalendarEventRecord {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD in Asia/Dhaka
  time?: string; // HH:mm optional
  kind: CalendarEventKind;
  organization?: string;
  sourceRefId?: string;
  verifiedDate: boolean;
  isAutoDerived: boolean;
  notes?: string;
  reminderMinutesBefore?: number;
  createdAt: string;
  updatedAt: string;
}

export function formatTimestampInDhakaDate(ms: number): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: DHAKA_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(ms));
  } catch {
    return new Date(ms + 6 * 3600_000).toISOString().slice(0, 10);
  }
}

export function getDhakaTodayDateString(nowMs: number = Date.now()): string {
  return formatTimestampInDhakaDate(nowMs);
}

function normalizeIsoDate(raw?: string | number | null): string | null {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return formatTimestampInDhakaDate(raw);
  }
  const str = String(raw).trim();
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const parsed = Date.parse(str);
  if (!Number.isNaN(parsed)) {
    return formatTimestampInDhakaDate(parsed);
  }
  return null;
}

export class CalendarRepository {
  public static async getAll(): Promise<CalendarEventRecord[]> {
    if (typeof indexedDB !== 'undefined') {
      try {
        const list = await IndexedDBManager.executeTransaction<CalendarEventRecord[]>(
          STORES.CALENDAR_EVENTS,
          'readonly',
          (store) =>
            new Promise((resolve, reject) => {
              const req = store.getAll();
              req.onsuccess = () => resolve(req.result || []);
              req.onerror = () => reject(req.error);
            })
        );
        return list.sort((a, b) => a.date.localeCompare(b.date));
      } catch {
        // Fallback below
      }
    }
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(CALENDAR_FALLBACK_KEY);
        const parsed: CalendarEventRecord[] = raw ? JSON.parse(raw) : [];
        return parsed.sort((a, b) => a.date.localeCompare(b.date));
      } catch {
        return [];
      }
    }
    return [];
  }

  public static async save(
    input: Omit<CalendarEventRecord, 'id' | 'createdAt' | 'updatedAt' | 'isAutoDerived'> & {
      id?: string;
    }
  ): Promise<CalendarEventRecord> {
    if (!input.title.trim()) throw new Error('Event title is required.');
    const normalizedDate = normalizeIsoDate(input.date);
    if (!normalizedDate) throw new Error('Valid YYYY-MM-DD date is required.');

    const existing = await this.getAll();
    const dup = existing.find(
      (ev) =>
        ev.id !== input.id &&
        ev.date === normalizedDate &&
        ev.kind === input.kind &&
        ev.title.trim().toLowerCase() === input.title.trim().toLowerCase()
    );
    if (dup && !input.id) {
      return dup; // Deterministic duplicate prevention
    }

    const now = new Date().toISOString();
    const prev = input.id ? existing.find((e) => e.id === input.id) : undefined;
    const record: CalendarEventRecord = {
      id: input.id || `cal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      title: input.title.trim(),
      date: normalizedDate,
      time: input.time?.trim() || undefined,
      kind: input.kind,
      organization: input.organization?.trim() || undefined,
      sourceRefId: input.sourceRefId,
      verifiedDate: Boolean(input.verifiedDate),
      isAutoDerived: false,
      notes: input.notes?.trim() || undefined,
      reminderMinutesBefore: input.reminderMinutesBefore,
      createdAt: prev?.createdAt || now,
      updatedAt: now,
    };

    if (typeof indexedDB !== 'undefined') {
      try {
        await IndexedDBManager.executeTransaction(STORES.CALENDAR_EVENTS, 'readwrite', (store) =>
          new Promise<void>((resolve, reject) => {
            const req = store.put(record);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
          })
        );
        return record;
      } catch {
        // Fallback below
      }
    }
    if (typeof localStorage !== 'undefined') {
      const next = existing.filter((e) => e.id !== record.id).concat(record);
      localStorage.setItem(CALENDAR_FALLBACK_KEY, JSON.stringify(next));
    }
    return record;
  }

  public static async remove(id: string): Promise<void> {
    if (typeof indexedDB !== 'undefined') {
      try {
        await IndexedDBManager.executeTransaction(STORES.CALENDAR_EVENTS, 'readwrite', (store) =>
          new Promise<void>((resolve, reject) => {
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
          })
        );
        return;
      } catch {
        // Fallback
      }
    }
    if (typeof localStorage !== 'undefined') {
      const existing = await this.getAll();
      localStorage.setItem(
        CALENDAR_FALLBACK_KEY,
        JSON.stringify(existing.filter((e) => e.id !== id))
      );
    }
  }
}

/**
 * Merges custom stored events with live non-duplicated derived events from
 * saved/tracked jobs, application records, and user-marked document expiries.
 */
export function buildUnifiedCalendarEvents(
  customEvents: CalendarEventRecord[],
  jobs: NormalizedJobCircular[],
  applications: ApplicationTrackerRecord[],
  documents: DocumentMetadata[] = []
): CalendarEventRecord[] {
  const byDedupKey = new Map<string, CalendarEventRecord>();
  const nowIso = new Date().toISOString();

  for (const ev of customEvents) {
    const key = ev.sourceRefId ? `${ev.kind}|${ev.sourceRefId}|${ev.date}` : ev.id;
    byDedupKey.set(key, ev);
  }

  for (const app of applications) {
    const deadlineDate = normalizeIsoDate(app.deadlineAt);
    if (deadlineDate) {
      const ref = `app_${app.jobId}`;
      const key = `deadline|${ref}|${deadlineDate}`;
      if (!byDedupKey.has(key)) {
        byDedupKey.set(key, {
          id: `auto_dl_${app.jobId}`,
          title: `Deadline: ${app.jobTitle}`,
          date: deadlineDate,
          kind: 'deadline',
          organization: app.organization,
          sourceRefId: ref,
          verifiedDate: true,
          isAutoDerived: true,
          notes: app.notes,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }
    }

    const examDate = normalizeIsoDate(app.examDate);
    if (examDate) {
      const ref = `exam_${app.jobId}`;
      const key = `exam|${ref}|${examDate}`;
      if (!byDedupKey.has(key)) {
        byDedupKey.set(key, {
          id: `auto_exam_${app.jobId}`,
          title: `Exam: ${app.jobTitle}`,
          date: examDate,
          kind: 'exam',
          organization: app.organization,
          sourceRefId: ref,
          verifiedDate: true,
          isAutoDerived: true,
          notes: app.examVenue ? `Venue: ${app.examVenue}` : undefined,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }
    }

    const feeDate = normalizeIsoDate(app.feeDeadlineAt);
    if (feeDate && app.feePaymentStatus === 'unpaid') {
      const ref = `fee_${app.jobId}`;
      const key = `fee_deadline|${ref}|${feeDate}`;
      if (!byDedupKey.has(key)) {
        byDedupKey.set(key, {
          id: `auto_fee_${app.jobId}`,
          title: `Fee Payment Due: ${app.jobTitle}`,
          date: feeDate,
          kind: 'fee_deadline',
          organization: app.organization,
          sourceRefId: ref,
          verifiedDate: true,
          isAutoDerived: true,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }
    }
  }

  for (const job of jobs) {
    if (job.status === 'expired' || (!job.deadlineAt && !job.deadlineText)) continue;
    const dlDate = normalizeIsoDate(job.deadlineAt ?? job.deadlineText);
    if (!dlDate) continue;
    const ref = `app_${job.id}`;
    const key = `deadline|${ref}|${dlDate}`;
    const jobKey = `deadline|job_${job.id}|${dlDate}`;
    if (!byDedupKey.has(key) && !byDedupKey.has(jobKey)) {
      byDedupKey.set(jobKey, {
        id: `auto_job_${job.id}`,
        title: `Circular Deadline: ${job.jobTitle}`,
        date: dlDate,
        kind: 'deadline',
        organization: job.organization,
        sourceRefId: `job_${job.id}`,
        verifiedDate: Boolean(job.deadlineVerified),
        isAutoDerived: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }
  }

  for (const doc of documents) {
    if (!doc.expiresAt) continue;
    const expDate = normalizeIsoDate(doc.expiresAt);
    if (!expDate) continue;
    const key = `document_expiry|doc_${doc.documentId}|${expDate}`;
    if (!byDedupKey.has(key)) {
      byDedupKey.set(key, {
        id: `auto_doc_${doc.documentId}`,
        title: `Document Expiry: ${doc.title || doc.fileName}`,
        date: expDate,
        kind: 'document_expiry',
        sourceRefId: `doc_${doc.documentId}`,
        verifiedDate: true,
        isAutoDerived: true,
        notes: doc.validityNotes,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }
  }

  return Array.from(byDedupKey.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function exportCalendarAsIcs(events: CalendarEventRecord[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MR Software Studio//JobFill BD//EN',
    'X-WR-TIMEZONE:Asia/Dhaka',
  ];
  for (const ev of events) {
    const dt = ev.date.replace(/-/g, '');
    const safeTitle = ev.title.replace(/[\r\n,;]/g, ' ');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${ev.id}@jobfillbd.local`,
      `DTSTART;VALUE=DATE:${dt}`,
      `SUMMARY:${safeTitle}`,
      ev.notes ? `DESCRIPTION:${ev.notes.replace(/[\r\n]+/g, ' ')}` : '',
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  return lines.filter(Boolean).join('\r\n');
}
