// JobFill BD - Job Circular Repository (IndexedDB + Fallback Store)
// Also provides shared local storage & IndexedDB store helpers to eliminate duplication.

import { IndexedDBManager, STORES } from '../../database/indexeddb';
import {
  NormalizedJobCircular,
  JobPreferences,
  DEFAULT_JOB_PREFERENCES,
  ReminderScheduleRecord,
  SchedulerPersistentState,
  SearchIndexEntry,
  SavedSearchRecord,
  SyncHistoryRecord,
  GovtOrganizationRecord,
} from '../types/job.types';
import { deriveSourceConnectionStatus } from '../types/source.types';
import { refreshJobStatus } from '../services/job-validator';
import { buildSearchIndexEntries, SEARCH_INDEX_SCHEMA_VERSION } from '../services/search-engine';
import { migrateLegacyCircularRecord } from '../services/application-link-detector';
import { computeJobFieldVerification } from '../services/job-normalizer';

const FALLBACK_PREFIX = 'jobfill_idb_fallback_';
const KEY_JOB_PREFERENCES = 'jobfill_job_preferences_v1';
const KEY_REMINDER_SCHEDULES = 'jobfill_reminder_schedules_v1';
const KEY_SCHEDULER_STATE = 'jobfill_scheduler_state_v1';
const KEY_SEEN_DIGEST_IDS = 'jobfill_seen_digest_ids_v1';
const KEY_NOTIF_ROUTE_MAP = 'jobfill_notif_route_map_v1';
const KEY_SOURCE_OUTCOMES = 'jobfill_source_outcomes_v1';
const KEY_RECENT_SEARCHES = 'jobfill_recent_searches_v1';
const KEY_SAVED_SEARCHES = 'jobfill_saved_searches_v1';
const KEY_HIDDEN_JOB_IDS = 'jobfill_hidden_job_ids_v1';
const KEY_URL_MIGRATED_V2 = 'jobfill_url_separation_migrated_v2';
const KEY_SEARCH_INDEX_VERSION = 'jobfill_search_index_version';

const memoryStores = new Map<string, Map<string, any>>();

function getMemoryStore(storeName: string): Map<string, any> {
  if (!memoryStores.has(storeName)) {
    memoryStores.set(storeName, new Map<string, any>());
  }
  return memoryStores.get(storeName)!;
}

function readFallbackArray<T>(storeName: string, keyField: string): T[] {
  const mem = getMemoryStore(storeName);
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(FALLBACK_PREFIX + storeName);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && item[keyField] && !mem.has(String(item[keyField]))) {
              mem.set(String(item[keyField]), item);
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }
  return Array.from(mem.values());
}

function writeFallbackArray<T>(storeName: string, keyField: string, items: T[]): void {
  const mem = getMemoryStore(storeName);
  mem.clear();
  for (const item of items) {
    const k = String((item as any)[keyField]);
    mem.set(k, item);
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(FALLBACK_PREFIX + storeName, JSON.stringify(items));
    } catch {
      // ignore quota error
    }
  }
}

export class SharedStoreCrud<T extends Record<string, any>> {
  constructor(private readonly storeName: string, private readonly keyField: string) {}

  public async getAll(): Promise<T[]> {
    try {
      return await IndexedDBManager.executeTransaction<T[]>(this.storeName, 'readonly', (store) =>
        new Promise<T[]>((resolve, reject) => {
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        })
      );
    } catch {
      return readFallbackArray<T>(this.storeName, this.keyField);
    }
  }

  public async getByKey(key: string): Promise<T | null> {
    try {
      return await IndexedDBManager.executeTransaction<T | null>(this.storeName, 'readonly', (store) =>
        new Promise<T | null>((resolve, reject) => {
          const req = store.get(key);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => reject(req.error);
        })
      );
    } catch {
      const items = readFallbackArray<T>(this.storeName, this.keyField);
      return items.find((i) => String(i[this.keyField]) === key) || null;
    }
  }

  public async put(item: T): Promise<void> {
    const key = String(item[this.keyField]);
    try {
      await IndexedDBManager.executeTransaction(this.storeName, 'readwrite', (store) =>
        new Promise<void>((resolve, reject) => {
          const req = store.put(item);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        })
      );
      return;
    } catch {
      const existing = readFallbackArray<T>(this.storeName, this.keyField).filter(
        (i) => String(i[this.keyField]) !== key
      );
      existing.push(item);
      writeFallbackArray(this.storeName, this.keyField, existing);
    }
  }

  public async putMany(items: T[]): Promise<void> {
    if (items.length === 0) return;
    try {
      await IndexedDBManager.executeTransaction(this.storeName, 'readwrite', (store) =>
        new Promise<void>((resolve, reject) => {
          for (const item of items) {
            store.put(item);
          }
          resolve();
        })
      );
      return;
    } catch {
      const existingMap = new Map<string, T>();
      for (const oldItem of readFallbackArray<T>(this.storeName, this.keyField)) {
        existingMap.set(String(oldItem[this.keyField]), oldItem);
      }
      for (const newItem of items) {
        existingMap.set(String(newItem[this.keyField]), newItem);
      }
      writeFallbackArray(this.storeName, this.keyField, Array.from(existingMap.values()));
    }
  }

  public async remove(key: string): Promise<void> {
    try {
      await IndexedDBManager.executeTransaction(this.storeName, 'readwrite', (store) =>
        new Promise<void>((resolve, reject) => {
          const req = store.delete(key);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        })
      );
      return;
    } catch {
      const remaining = readFallbackArray<T>(this.storeName, this.keyField).filter(
        (i) => String(i[this.keyField]) !== key
      );
      writeFallbackArray(this.storeName, this.keyField, remaining);
    }
  }

  public async clear(): Promise<void> {
    try {
      await IndexedDBManager.executeTransaction(this.storeName, 'readwrite', (store) =>
        new Promise<void>((resolve, reject) => {
          const req = store.clear();
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        })
      );
      return;
    } catch {
      getMemoryStore(this.storeName).clear();
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(FALLBACK_PREFIX + this.storeName);
      }
    }
  }
}

const KV_TIMEOUT_MS = 2500;

function readLocalJson<T>(key: string, defaultValue: T): T {
  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      try {
        return JSON.parse(raw) as T;
      } catch {
        return defaultValue;
      }
    }
  }
  return defaultValue;
}

export const kvStorage = {
  async get<T>(key: string, defaultValue: T): Promise<T> {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      return new Promise((resolve) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            resolve(readLocalJson(key, defaultValue));
          }
        }, KV_TIMEOUT_MS);

        try {
          chrome.storage.local.get([key], (res) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try {
              if (chrome.runtime?.lastError || !res) {
                resolve(readLocalJson(key, defaultValue));
                return;
              }
              resolve(res[key] !== undefined ? (res[key] as T) : defaultValue);
            } catch {
              resolve(readLocalJson(key, defaultValue));
            }
          });
        } catch {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(readLocalJson(key, defaultValue));
          }
        }
      });
    }
    return readLocalJson(key, defaultValue);
  },

  async set(key: string, value: any): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      return new Promise((resolve) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            resolve();
          }
        }, KV_TIMEOUT_MS);

        try {
          chrome.storage.local.set({ [key]: value }, () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve();
          });
        } catch {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve();
          }
        }
      });
    }
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // ignore quota error
      }
    }
  },
};

const jobsCrud = new SharedStoreCrud<NormalizedJobCircular>(STORES.JOBS, 'id');
const searchIndexCrud = new SharedStoreCrud<SearchIndexEntry>(STORES.SEARCH_INDEX, 'jobId');
const syncHistoryCrud = new SharedStoreCrud<SyncHistoryRecord>(STORES.SYNC_HISTORY, 'id');
const govtOrgsCrud = new SharedStoreCrud<GovtOrganizationRecord>(STORES.GOVT_ORGS, 'organizationId');
const sourceHealthCrud = new SharedStoreCrud<any>(STORES.SOURCE_HEALTH, 'sourceId');

function ensureJobFieldProvenance(job: NormalizedJobCircular): NormalizedJobCircular {
  const needsUpgrade =
    !job.fieldVerification ||
    !job.timezone ||
    typeof job.sourceLastVerifiedAt !== 'number';
  if (!needsUpgrade) return job;
  return {
    ...job,
    timezone: job.timezone || job.deadlineTimezone || 'Asia/Dhaka',
    sourceLastVerifiedAt: job.sourceLastVerifiedAt ?? job.sourceLastCheckedAt,
    fieldVerification: job.fieldVerification || computeJobFieldVerification(job),
  };
}

export class JobRepository {
  private static migrationPromise: Promise<number> | null = null;
  private static migrationDoneInMemory = false;
  private static inFlightGetAllJobsPromise: Promise<NormalizedJobCircular[]> | null = null;

  public static async migrateLegacyUrlsIfNeeded(force: boolean = false): Promise<number> {
    if (!force && this.migrationDoneInMemory) return 0;
    if (this.migrationPromise) return this.migrationPromise;
    this.migrationPromise = (async () => {
      try {
        if (!force) {
          const alreadyDone = await kvStorage.get<boolean>(KEY_URL_MIGRATED_V2, false);
          if (alreadyDone) {
            this.migrationDoneInMemory = true;
            return 0;
          }
        }
        const stored = await jobsCrud.getAll();
        if (stored.length === 0) {
          this.migrationDoneInMemory = true;
          return 0;
        }
        const changedJobs: NormalizedJobCircular[] = [];
        for (const item of stored) {
          const res = migrateLegacyCircularRecord(item);
          if (res.changed) {
            changedJobs.push(res.job);
          }
        }
        if (changedJobs.length > 0) {
          await jobsCrud.putMany(changedJobs);
          console.info(`JobFill BD [JobRepository]: migrated ${changedJobs.length} legacy job URL record(s)`);
        }
        this.migrationDoneInMemory = true;
        // Persist completion flag without blocking UI callers whose test mocks don't fire storage.set callbacks
        void kvStorage.set(KEY_URL_MIGRATED_V2, true);
        return changedJobs.length;
      } finally {
        this.migrationPromise = null;
      }
    })();
    return this.migrationPromise;
  }

  public static async getAllRawJobs(): Promise<NormalizedJobCircular[]> {
    return jobsCrud.getAll();
  }

  public static async getAllJobs(now: number = Date.now()): Promise<NormalizedJobCircular[]> {
    if (this.inFlightGetAllJobsPromise) {
      const shared = await this.inFlightGetAllJobsPromise;
      return shared.map((j) => refreshJobStatus(j, now));
    }

    const loadTask = (async () => {
      await this.migrateLegacyUrlsIfNeeded(false);
      const items = await jobsCrud.getAll();
      return items.map((j) => {
        const migrated = migrateLegacyCircularRecord(j);
        const enriched = ensureJobFieldProvenance(migrated.job);
        return refreshJobStatus(enriched, now);
      });
    })();

    this.inFlightGetAllJobsPromise = loadTask;
    try {
      return await loadTask;
    } finally {
      if (this.inFlightGetAllJobsPromise === loadTask) {
        this.inFlightGetAllJobsPromise = null;
      }
    }
  }

  public static async getJobById(id: string, now: number = Date.now()): Promise<NormalizedJobCircular | null> {
    const found = await jobsCrud.getByKey(id);
    if (!found) return null;
    const migrated = migrateLegacyCircularRecord(found);
    return refreshJobStatus(migrated.job, now);
  }

  public static async saveJob(job: NormalizedJobCircular): Promise<void> {
    this.inFlightGetAllJobsPromise = null;
    await jobsCrud.put(refreshJobStatus(job));
  }

  public static async saveJobs(jobs: NormalizedJobCircular[]): Promise<void> {
    this.inFlightGetAllJobsPromise = null;
    await jobsCrud.putMany(jobs.map((j) => refreshJobStatus(j)));
  }

  public static async deleteJob(id: string): Promise<void> {
    this.inFlightGetAllJobsPromise = null;
    await jobsCrud.remove(id);
  }

  public static async clearAll(): Promise<void> {
    this.migrationDoneInMemory = false;
    this.inFlightGetAllJobsPromise = null;
    await jobsCrud.clear();
    await searchIndexCrud.clear();
    await syncHistoryCrud.clear();
    await govtOrgsCrud.clear();
    await sourceHealthCrud.clear();
    await kvStorage.set(KEY_SOURCE_OUTCOMES, []);
    await kvStorage.set(KEY_RECENT_SEARCHES, []);
    await kvStorage.set(KEY_SAVED_SEARCHES, []);
    await kvStorage.set(KEY_HIDDEN_JOB_IDS, []);
    await kvStorage.set(KEY_URL_MIGRATED_V2, false);
    await kvStorage.set(KEY_SEARCH_INDEX_VERSION, 0);
  }

  public static async getGovtOrganizations(): Promise<GovtOrganizationRecord[]> {
    const list = await govtOrgsCrud.getAll();
    return [...list].sort((a, b) => b.openingCount - a.openingCount || a.name.localeCompare(b.name));
  }

  public static async saveGovtOrganizations(orgs: GovtOrganizationRecord[]): Promise<void> {
    await govtOrgsCrud.clear();
    if (orgs.length > 0) {
      await govtOrgsCrud.putMany(orgs);
    }
  }

  public static async clearGovtOrganizations(): Promise<void> {
    await govtOrgsCrud.clear();
  }

  public static async getSearchIndexEntries(): Promise<SearchIndexEntry[]> {
    return searchIndexCrud.getAll();
  }

  public static async getSearchIndexMap(): Promise<Map<string, SearchIndexEntry>> {
    const entries = await searchIndexCrud.getAll();
    const map = new Map<string, SearchIndexEntry>();
    for (const entry of entries) {
      map.set(entry.jobId, entry);
    }
    return map;
  }

  public static async rebuildSearchIndex(jobs: NormalizedJobCircular[]): Promise<SearchIndexEntry[]> {
    const entries = buildSearchIndexEntries(jobs);
    await searchIndexCrud.clear();
    if (entries.length > 0) {
      await searchIndexCrud.putMany(entries);
    }
    void kvStorage.set(KEY_SEARCH_INDEX_VERSION, SEARCH_INDEX_SCHEMA_VERSION);
    return entries;
  }

  /**
   * Ensures every stored job is indexed using the current SearchIndex schema version
   * without touching or removing existing job records in IndexedDB.
   */
  public static async ensureSearchIndexCurrent(
    jobs: NormalizedJobCircular[]
  ): Promise<Map<string, SearchIndexEntry>> {
    const currentMap = await this.getSearchIndexMap();
    if (jobs.length === 0) return currentMap;
    const version = await kvStorage.get<number>(KEY_SEARCH_INDEX_VERSION, 0);
    const missingAnyJob =
      currentMap.size !== jobs.length || jobs.some((j) => !currentMap.has(j.id));
    if (version < SEARCH_INDEX_SCHEMA_VERSION || missingAnyJob) {
      const rebuilt = await this.rebuildSearchIndex(jobs);
      return new Map(rebuilt.map((e) => [e.jobId, e]));
    }
    return currentMap;
  }

  public static async clearSearchIndex(): Promise<void> {
    await searchIndexCrud.clear();
    void kvStorage.set(KEY_SEARCH_INDEX_VERSION, 0);
  }

  public static async getSyncHistory(limit: number = 25): Promise<SyncHistoryRecord[]> {
    const records = await syncHistoryCrud.getAll();
    return [...records].sort((a, b) => b.syncedAt - a.syncedAt).slice(0, limit);
  }

  public static async addSyncHistory(record: SyncHistoryRecord): Promise<void> {
    await syncHistoryCrud.put(record);
    const all = await syncHistoryCrud.getAll();
    if (all.length > 30) {
      const sorted = [...all].sort((a, b) => b.syncedAt - a.syncedAt);
      for (const stale of sorted.slice(30)) {
        await syncHistoryCrud.remove(stale.id);
      }
    }
  }

  public static async clearSyncHistory(): Promise<void> {
    await syncHistoryCrud.clear();
  }

  public static async getRecentSearches(): Promise<string[]> {
    return kvStorage.get<string[]>(KEY_RECENT_SEARCHES, []);
  }

  public static async addRecentSearch(term: string): Promise<string[]> {
    const cleaned = term.trim();
    if (!cleaned) return this.getRecentSearches();
    const current = await this.getRecentSearches();
    const lower = cleaned.toLowerCase();
    const updated = [cleaned, ...current.filter((item) => item.trim().toLowerCase() !== lower)].slice(0, 10);
    await kvStorage.set(KEY_RECENT_SEARCHES, updated);
    return updated;
  }

  public static async clearRecentSearches(): Promise<string[]> {
    await kvStorage.set(KEY_RECENT_SEARCHES, []);
    return [];
  }

  public static async getSavedSearches(): Promise<SavedSearchRecord[]> {
    return kvStorage.get<SavedSearchRecord[]>(KEY_SAVED_SEARCHES, []);
  }

  public static async saveSavedSearch(
    record: Omit<SavedSearchRecord, 'id' | 'createdAt'>
  ): Promise<SavedSearchRecord[]> {
    const current = await this.getSavedSearches();
    const normQuery = record.query.trim().toLowerCase();
    const normLoc = (record.location || '').trim().toLowerCase();
    const normEdu = (record.education || '').trim().toLowerCase();
    const deduped = current.filter(
      (item) =>
        !(
          item.query.trim().toLowerCase() === normQuery &&
          item.category === record.category &&
          (item.location || '').trim().toLowerCase() === normLoc &&
          (item.education || '').trim().toLowerCase() === normEdu
        )
    );
    const nextItem: SavedSearchRecord = {
      ...record,
      id: `saved_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
    };
    const updated = [nextItem, ...deduped].slice(0, 20);
    await kvStorage.set(KEY_SAVED_SEARCHES, updated);
    return updated;
  }

  public static async deleteSavedSearch(id: string): Promise<SavedSearchRecord[]> {
    const current = await this.getSavedSearches();
    const updated = current.filter((item) => item.id !== id);
    await kvStorage.set(KEY_SAVED_SEARCHES, updated);
    return updated;
  }

  public static async getHiddenJobIds(): Promise<string[]> {
    return kvStorage.get<string[]>(KEY_HIDDEN_JOB_IDS, []);
  }

  public static async hideJobId(jobId: string): Promise<string[]> {
    const current = await this.getHiddenJobIds();
    if (current.includes(jobId)) return current;
    const updated = [jobId, ...current].slice(0, 300);
    await kvStorage.set(KEY_HIDDEN_JOB_IDS, updated);
    return updated;
  }

  public static async unhideJobId(jobId: string): Promise<string[]> {
    const current = await this.getHiddenJobIds();
    const updated = current.filter((id) => id !== jobId);
    await kvStorage.set(KEY_HIDDEN_JOB_IDS, updated);
    return updated;
  }

  public static async unhideAllJobs(): Promise<string[]> {
    await kvStorage.set(KEY_HIDDEN_JOB_IDS, []);
    return [];
  }

  // Preferences & Small Metadata in chrome.storage.local
  public static async getPreferences(): Promise<JobPreferences> {
    const stored = await kvStorage.get<Partial<JobPreferences>>(KEY_JOB_PREFERENCES, {});
    return { ...DEFAULT_JOB_PREFERENCES, ...stored };
  }

  public static async savePreferences(patch: Partial<JobPreferences>): Promise<JobPreferences> {
    const current = await this.getPreferences();
    const updated = { ...current, ...patch };
    await kvStorage.set(KEY_JOB_PREFERENCES, updated);
    return updated;
  }

  public static async getReminderSchedules(): Promise<Record<string, ReminderScheduleRecord>> {
    return kvStorage.get<Record<string, ReminderScheduleRecord>>(KEY_REMINDER_SCHEDULES, {});
  }

  public static async saveReminderSchedules(map: Record<string, ReminderScheduleRecord>): Promise<void> {
    await kvStorage.set(KEY_REMINDER_SCHEDULES, map);
  }

  public static async getSchedulerState(): Promise<SchedulerPersistentState> {
    return kvStorage.get<SchedulerPersistentState>(KEY_SCHEDULER_STATE, {
      lastDailyCheckAt: null,
      lastDailyDigestDateKey: null,
      lastSchedulerRunAt: null,
      nextScheduledAlarmAt: null,
    });
  }

  public static async saveSchedulerState(state: SchedulerPersistentState): Promise<void> {
    await kvStorage.set(KEY_SCHEDULER_STATE, state);
  }

  public static async getSeenDigestJobIds(): Promise<string[]> {
    return kvStorage.get<string[]>(KEY_SEEN_DIGEST_IDS, []);
  }

  public static async addSeenDigestJobIds(ids: string[]): Promise<void> {
    const set = new Set(await this.getSeenDigestJobIds());
    for (const id of ids) set.add(id);
    await kvStorage.set(KEY_SEEN_DIGEST_IDS, Array.from(set).slice(-3000));
  }

  public static async getNotificationRouteMap(): Promise<Record<string, { tab: string; jobId?: string }>> {
    return kvStorage.get<Record<string, { tab: string; jobId?: string }>>(KEY_NOTIF_ROUTE_MAP, {});
  }

  public static async saveNotificationRoute(notifId: string, route: { tab: string; jobId?: string }): Promise<void> {
    const map = await this.getNotificationRouteMap();
    map[notifId] = route;
    const keys = Object.keys(map);
    if (keys.length > 120) {
      delete map[keys[0]];
    }
    await kvStorage.set(KEY_NOTIF_ROUTE_MAP, map);
  }

  public static async getSourceOutcomes(): Promise<any[]> {
    const kvList = await kvStorage.get<any[]>(KEY_SOURCE_OUTCOMES, []);
    if (kvList.length > 0) return kvList;
    const storeList = await sourceHealthCrud.getAll();
    return storeList;
  }

  public static async saveSourceOutcomes(outcomes: any[]): Promise<void> {
    // Store lightweight metadata only (without duplicating huge job lists)
    const compact = outcomes.map((o) => ({
      sourceId: o.sourceId,
      sourceName: o.sourceName,
      compatibilityStatus: o.compatibilityStatus,
      connectionStatus: o.connectionStatus || deriveSourceConnectionStatus(o),
      status: o.status,
      accessMethodType: o.accessMethodType,
      publisherType: o.publisherType,
      success: Boolean(o.success),
      jobCount:
        o.skippedByCooldown && typeof o.jobCount === 'number'
          ? o.jobCount
          : Array.isArray(o.jobs)
            ? o.jobs.length
            : typeof o.jobCount === 'number'
              ? o.jobCount
              : 0,
      insertedCount: typeof o.insertedCount === 'number' ? o.insertedCount : 0,
      updatedCount: typeof o.updatedCount === 'number' ? o.updatedCount : 0,
      duplicateCount: typeof o.duplicateCount === 'number' ? o.duplicateCount : 0,
      rejectedCount: typeof o.rejectedCount === 'number' ? o.rejectedCount : 0,
      savedCount: typeof o.savedCount === 'number' ? o.savedCount : 0,
      totalIndexedCount:
        typeof o.totalIndexedCount === 'number'
          ? o.totalIndexedCount
          : typeof o.savedCount === 'number'
            ? o.savedCount
            : 0,
      checkedAt: o.checkedAt,
      lastSuccessfulFetchAt: o.lastSuccessfulFetchAt ?? null,
      httpStatus: typeof o.httpStatus === 'number' ? o.httpStatus : null,
      blockedByCaptcha: Boolean(o.blockedByCaptcha),
      rateLimited: Boolean(o.rateLimited),
      invalidResponse: Boolean(o.invalidResponse),
      retryAfterMs: typeof o.retryAfterMs === 'number' ? o.retryAfterMs : null,
      nextEligibleCheckAt: typeof o.nextEligibleCheckAt === 'number' ? o.nextEligibleCheckAt : null,
      consecutiveFailures: typeof o.consecutiveFailures === 'number' ? o.consecutiveFailures : 0,
      retryPolicy: o.retryPolicy,
      dataCoverageNote: o.dataCoverageNote,
      deadlineVerificationNote: o.deadlineVerificationNote,
      skippedByCooldown: Boolean(o.skippedByCooldown),
      accessNotes: o.accessNotes,
      directPortalUrl: o.directPortalUrl,
      openPortalUrl: o.openPortalUrl,
      error: o.error,
    }));
    await kvStorage.set(KEY_SOURCE_OUTCOMES, compact);
    await sourceHealthCrud.putMany(compact);
  }
}
