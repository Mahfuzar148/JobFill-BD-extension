// JobFill BD - Central IndexedDB Architecture
// Manages object stores: 'profiles', 'documents', 'mappings', 'history',
// plus Job Circular Hub stores: 'jobs', 'bookmarks', 'applications', 'notifications'
// Fully local, persistent, and sandboxed inside Chrome.

export const DB_NAME = 'JobFillBD_SecureStorage';
export const DB_VERSION = 8;

export const STORES = {
  PROFILES: 'profiles',
  EDUCATION_RECORDS: 'education_records',
  EXPERIENCE_RECORDS: 'experience_records',
  VAULT_STORE: 'encrypted_vault',
  DOCUMENTS: 'documents',
  MAPPINGS: 'mappings',
  HISTORY: 'history',
  JOBS: 'jobs',
  BOOKMARKS: 'bookmarks',
  APPLICATIONS: 'applications',
  NOTIFICATIONS: 'notifications',
  SEARCH_INDEX: 'search_index',
  SYNC_HISTORY: 'sync_history',
  GOVT_ORGS: 'govt_orgs',
  SOURCE_HEALTH: 'source_health',
  MIGRATION_LOGS: 'migration_logs',
} as const;

const OPEN_TIMEOUT_MS = 4000;
const BLOCKED_TIMEOUT_MS = 1500;
const TX_TIMEOUT_MS = 5000;

export class IndexedDBManager {
  private static dbInstance: IDBDatabase | null = null;
  private static openingPromise: Promise<IDBDatabase> | null = null;

  public static resetConnection(): void {
    if (this.dbInstance) {
      try {
        this.dbInstance.close();
      } catch {
        // ignore close errors
      }
      this.dbInstance = null;
    }
    this.openingPromise = null;
  }

  public static async getDB(): Promise<IDBDatabase> {
    if (this.dbInstance) return this.dbInstance;
    if (this.openingPromise) return this.openingPromise;

    if (typeof indexedDB === 'undefined') {
      throw new Error('INDEXEDDB_UNAVAILABLE');
    }

    this.openingPromise = new Promise<IDBDatabase>((resolve, reject) => {
      let settled = false;
      let blockedTimer: ReturnType<typeof setTimeout> | null = null;
      const openTimer = setTimeout(() => {
        if (!settled) {
          settled = true;
          this.openingPromise = null;
          reject(new Error('INDEXEDDB_OPEN_TIMEOUT'));
        }
      }, OPEN_TIMEOUT_MS);

      const cleanupTimers = () => {
        clearTimeout(openTimer);
        if (blockedTimer) {
          clearTimeout(blockedTimer);
          blockedTimer = null;
        }
      };

      let request: IDBOpenDBRequest;
      try {
        request = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (err) {
        cleanupTimers();
        this.openingPromise = null;
        reject(err);
        return;
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 1. Profiles Store
        if (!db.objectStoreNames.contains(STORES.PROFILES)) {
          db.createObjectStore(STORES.PROFILES, { keyPath: 'id' });
        }

        // 2. Documents Store
        if (!db.objectStoreNames.contains(STORES.DOCUMENTS)) {
          const docStore = db.createObjectStore(STORES.DOCUMENTS, { keyPath: 'id' });
          docStore.createIndex('profileId', 'profileId', { unique: false });
          docStore.createIndex('type', 'type', { unique: false });
        }

        // 3. Mappings Store
        if (!db.objectStoreNames.contains(STORES.MAPPINGS)) {
          const mapStore = db.createObjectStore(STORES.MAPPINGS, { keyPath: 'fingerprintHash' });
          mapStore.createIndex('domain', 'domain', { unique: false });
          mapStore.createIndex('canonicalKey', 'canonicalKey', { unique: false });
        }

        // 4. History Store
        if (!db.objectStoreNames.contains(STORES.HISTORY)) {
          const histStore = db.createObjectStore(STORES.HISTORY, { keyPath: 'id' });
          histStore.createIndex('timestamp', 'timestamp', { unique: false });
          histStore.createIndex('domain', 'domain', { unique: false });
        }

        // 5. Jobs Store (Job Circular Hub)
        let jobStore: IDBObjectStore;
        if (!db.objectStoreNames.contains(STORES.JOBS)) {
          jobStore = db.createObjectStore(STORES.JOBS, { keyPath: 'id' });
          jobStore.createIndex('sourceId', 'sourceId', { unique: false });
          jobStore.createIndex('category', 'category', { unique: false });
          jobStore.createIndex('deadlineAt', 'deadlineAt', { unique: false });
          jobStore.createIndex('publishedAt', 'publishedAt', { unique: false });
          jobStore.createIndex('status', 'status', { unique: false });
        } else {
          jobStore = request.transaction!.objectStore(STORES.JOBS);
        }
        if (!jobStore.indexNames.contains('fingerprintHash')) {
          jobStore.createIndex('fingerprintHash', 'fingerprintHash', { unique: false });
        }
        if (!jobStore.indexNames.contains('sourceJobId')) {
          jobStore.createIndex('sourceJobId', 'sourceJobId', { unique: false });
        }

        // 6. Bookmarks Store
        if (!db.objectStoreNames.contains(STORES.BOOKMARKS)) {
          const bookmarkStore = db.createObjectStore(STORES.BOOKMARKS, { keyPath: 'jobId' });
          bookmarkStore.createIndex('savedAt', 'savedAt', { unique: false });
        }

        // 7. Applications Tracker Store
        if (!db.objectStoreNames.contains(STORES.APPLICATIONS)) {
          const appStore = db.createObjectStore(STORES.APPLICATIONS, { keyPath: 'jobId' });
          appStore.createIndex('status', 'status', { unique: false });
          appStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        // 8. Job Notifications Store
        if (!db.objectStoreNames.contains(STORES.NOTIFICATIONS)) {
          const notifStore = db.createObjectStore(STORES.NOTIFICATIONS, { keyPath: 'id' });
          notifStore.createIndex('createdAt', 'createdAt', { unique: false });
          notifStore.createIndex('type', 'type', { unique: false });
          notifStore.createIndex('jobId', 'jobId', { unique: false });
          notifStore.createIndex('isRead', 'isRead', { unique: false });
        }

        // 9. Search Index Store
        if (!db.objectStoreNames.contains(STORES.SEARCH_INDEX)) {
          const idxStore = db.createObjectStore(STORES.SEARCH_INDEX, { keyPath: 'jobId' });
          idxStore.createIndex('category', 'category', { unique: false });
          idxStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        // 10. Source Sync History Store
        if (!db.objectStoreNames.contains(STORES.SYNC_HISTORY)) {
          const syncStore = db.createObjectStore(STORES.SYNC_HISTORY, { keyPath: 'id' });
          syncStore.createIndex('syncedAt', 'syncedAt', { unique: false });
        }

        // 11. Government Organizations Store (Teletalk Alljobs)
        if (!db.objectStoreNames.contains(STORES.GOVT_ORGS)) {
          const orgStore = db.createObjectStore(STORES.GOVT_ORGS, { keyPath: 'organizationId' });
          orgStore.createIndex('shortName', 'shortName', { unique: false });
          orgStore.createIndex('openingCount', 'openingCount', { unique: false });
        }

        // 12. Centralized Source Health Store (v6 additive store)
        if (!db.objectStoreNames.contains(STORES.SOURCE_HEALTH)) {
          const healthStore = db.createObjectStore(STORES.SOURCE_HEALTH, { keyPath: 'sourceId' });
          healthStore.createIndex('status', 'status', { unique: false });
          healthStore.createIndex('lastCheckedAt', 'lastCheckedAt', { unique: false });
        }

        // 13. Normalized Education Records Store (v7 additive store)
        if (!db.objectStoreNames.contains(STORES.EDUCATION_RECORDS)) {
          const eduStore = db.createObjectStore(STORES.EDUCATION_RECORDS, { keyPath: 'id' });
          eduStore.createIndex('profileId', 'profileId', { unique: false });
        }

        // 14. Normalized Experience Records Store (v7 additive store)
        if (!db.objectStoreNames.contains(STORES.EXPERIENCE_RECORDS)) {
          const expStore = db.createObjectStore(STORES.EXPERIENCE_RECORDS, { keyPath: 'id' });
          expStore.createIndex('profileId', 'profileId', { unique: false });
        }

        // 15. Local Encrypted Vault & Non-Extractable CryptoKey Store (v7 additive store)
        if (!db.objectStoreNames.contains(STORES.VAULT_STORE)) {
          db.createObjectStore(STORES.VAULT_STORE, { keyPath: 'id' });
        }

        // 16. Non-Destructive Schema Migration Reports Store (v8 additive store)
        if (!db.objectStoreNames.contains(STORES.MIGRATION_LOGS)) {
          const migStore = db.createObjectStore(STORES.MIGRATION_LOGS, { keyPath: 'id' });
          migStore.createIndex('completedAt', 'completedAt', { unique: false });
        }
      };

      request.onblocked = () => {
        console.warn('JobFill BD: IndexedDB upgrade blocked by another open tab/context; activating timeout guard.');
        if (!blockedTimer && !settled) {
          blockedTimer = setTimeout(() => {
            if (!settled) {
              settled = true;
              cleanupTimers();
              this.openingPromise = null;
              reject(new Error('INDEXEDDB_OPEN_BLOCKED'));
            }
          }, BLOCKED_TIMEOUT_MS);
        }
      };

      request.onsuccess = () => {
        cleanupTimers();
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          if (this.dbInstance === db) {
            this.dbInstance = null;
          }
        };
        db.onclose = () => {
          if (this.dbInstance === db) {
            this.dbInstance = null;
          }
        };
        this.dbInstance = db;
        this.openingPromise = null;
        if (!settled) {
          settled = true;
          resolve(db);
        } else {
          // Opened after timeout; close stale orphan handle cleanly
          try {
            db.close();
          } catch {
            // ignore
          }
          if (this.dbInstance === db) {
            this.dbInstance = null;
          }
        }
      };

      request.onerror = () => {
        cleanupTimers();
        this.openingPromise = null;
        if (!settled) {
          settled = true;
          reject(request.error || new Error('INDEXEDDB_OPEN_ERROR'));
        }
      };
    });

    return this.openingPromise;
  }

  public static async executeTransaction<T>(
    storeName: string,
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => Promise<T>
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const db = await this.getDB();
        if (!db.objectStoreNames.contains(storeName)) {
          throw new Error(`INDEXEDDB_STORE_MISSING:${storeName}`);
        }
        return await new Promise<T>((resolve, reject) => {
          let settled = false;
          const txTimer = setTimeout(() => {
            if (!settled) {
              settled = true;
              reject(new Error(`INDEXEDDB_TX_TIMEOUT:${storeName}`));
            }
          }, TX_TIMEOUT_MS);

          const finishResolve = (val: T) => {
            if (settled) return;
            settled = true;
            clearTimeout(txTimer);
            resolve(val);
          };

          const finishReject = (err: unknown) => {
            if (settled) return;
            settled = true;
            clearTimeout(txTimer);
            reject(err);
          };

          let tx: IDBTransaction;
          let store: IDBObjectStore;
          try {
            tx = db.transaction(storeName, mode);
            store = tx.objectStore(storeName);
          } catch (syncErr) {
            finishReject(syncErr);
            return;
          }

          let txCompleted = false;
          let opResolved = false;
          let opResult: T;

          tx.oncomplete = () => {
            txCompleted = true;
            if (opResolved) finishResolve(opResult);
          };
          tx.onerror = () => finishReject(tx.error || new Error('IndexedDB transaction error'));
          tx.onabort = () => finishReject(tx.error || new Error('IndexedDB transaction aborted'));

          operation(store)
            .then((res) => {
              opResult = res;
              opResolved = true;
              if (txCompleted) finishResolve(opResult);
            })
            .catch(finishReject);
        });
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.name || err?.message || '');
        if (attempt === 0 && (msg.includes('InvalidStateError') || msg.includes('closing') || msg.includes('TX_TIMEOUT'))) {
          this.resetConnection();
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  }
}
