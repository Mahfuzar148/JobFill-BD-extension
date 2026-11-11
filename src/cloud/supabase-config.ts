// JobFill BD - Optional Hybrid Cloud & Public Job DB Configuration
// Default mode is STRICTLY Local-Only (cloudSyncEnabled: false, no account required).
// Never accepts or persists Supabase service_role secrets inside the extension.

export interface CloudSyncConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  cloudSyncEnabled: boolean;
  usePublicCloudJobsFeed: boolean;
  lastSyncedAt: number | null;
  authenticatedEmail?: string | null;
}

const STORAGE_KEY_CLOUD_CONFIG = 'jobfill_cloud_config_v1';

export const DEFAULT_CLOUD_CONFIG: CloudSyncConfig = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  cloudSyncEnabled: false,
  usePublicCloudJobsFeed: false,
  lastSyncedAt: null,
  authenticatedEmail: null,
};

/**
 * Release feature flag isolating optional Supabase Cloud Sync.
 * Disabled in initial Microsoft Edge Store package (`__JOBFILL_CLOUD_SYNC_DISABLED__ = true`)
 * while preserved in local builds and Chrome builds.
 */
export function isCloudSyncFeatureEnabled(): boolean {
  if (typeof __JOBFILL_CLOUD_SYNC_DISABLED__ !== 'undefined' && __JOBFILL_CLOUD_SYNC_DISABLED__) {
    return false;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).__JOBFILL_CLOUD_SYNC_DISABLED__ === true) {
    return false;
  }
  return true;
}

/**
 * Validates that an API key looks like a public anon JWT / publishable key and NEVER a service_role secret.
 */
export function isSafePublicAnonKey(key: string): boolean {
  const trimmed = (key || '').trim();
  if (!trimmed) return false;
  if (/service_role/i.test(trimmed)) return false;

  // Inspect standard JWT payload if formatted as 3 base64url segments
  const parts = trimmed.split('.');
  if (parts.length === 3) {
    try {
      const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payloadJson = JSON.parse(atob(normalized));
      if (payloadJson?.role && String(payloadJson.role).toLowerCase() === 'service_role') {
        return false;
      }
    } catch {
      // Allow non-JWT opaque publishable keys (e.g. sb_publishable_...)
    }
  }
  return true;
}

export async function getCloudConfig(): Promise<CloudSyncConfig> {
  if ((typeof __JOBFILL_CLOUD_SYNC_DISABLED__ !== 'undefined' && __JOBFILL_CLOUD_SYNC_DISABLED__) || !isCloudSyncFeatureEnabled()) {
    return { ...DEFAULT_CLOUD_CONFIG };
  }
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY_CLOUD_CONFIG], (res) => {
        resolve({ ...DEFAULT_CLOUD_CONFIG, ...(res?.[STORAGE_KEY_CLOUD_CONFIG] || {}) });
      });
    });
  }
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CLOUD_CONFIG);
      if (raw) return { ...DEFAULT_CLOUD_CONFIG, ...JSON.parse(raw) };
    } catch {
      // Fallback
    }
  }
  return { ...DEFAULT_CLOUD_CONFIG };
}

export async function saveCloudConfig(partial: Partial<CloudSyncConfig>): Promise<CloudSyncConfig> {
  if ((typeof __JOBFILL_CLOUD_SYNC_DISABLED__ !== 'undefined' && __JOBFILL_CLOUD_SYNC_DISABLED__) || !isCloudSyncFeatureEnabled()) {
    throw new Error('CLOUD_SYNC_DISABLED_IN_RELEASE: Optional Cloud Sync is disabled in this release.');
  }
  const current = await getCloudConfig();
  const next: CloudSyncConfig = { ...current, ...partial };

  if (next.supabaseAnonKey && !isSafePublicAnonKey(next.supabaseAnonKey)) {
    throw new Error('Rejected unsafe Supabase key: service_role keys must NEVER be stored inside the browser extension.');
  }
  if (next.supabaseUrl) {
    const parsed = new URL(next.supabaseUrl.trim());
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
      throw new Error('Supabase URL must use HTTPS.');
    }
    next.supabaseUrl = parsed.origin;
  }

  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.set({ [STORAGE_KEY_CLOUD_CONFIG]: next });
  } else if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_CLOUD_CONFIG, JSON.stringify(next));
  }
  return next;
}

export function isCloudBackendConfigured(cfg: CloudSyncConfig): boolean {
  if ((typeof __JOBFILL_CLOUD_SYNC_DISABLED__ !== 'undefined' && __JOBFILL_CLOUD_SYNC_DISABLED__) || !isCloudSyncFeatureEnabled()) return false;
  return Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && isSafePublicAnonKey(cfg.supabaseAnonKey));
}
