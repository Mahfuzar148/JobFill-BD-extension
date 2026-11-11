// JobFill BD - Optional Cloud Sync Authentication Manager (Supabase Auth REST)
// Strictly optional; basic extension autofill and local vault never require an account.
// Holds session token in volatile memory by default and clears all session state on logout.

import { getCloudConfig, saveCloudConfig, isCloudBackendConfigured, isCloudSyncFeatureEnabled } from './supabase-config';
import { lockVault } from '../services/storage';

export interface CloudAuthSession {
  accessToken: string;
  refreshToken?: string;
  userId: string;
  email: string;
  expiresAt: number;
}

let activeCloudSession: CloudAuthSession | null = null;

export function getActiveCloudSession(): CloudAuthSession | null {
  if ((typeof __JOBFILL_CLOUD_SYNC_DISABLED__ !== 'undefined' && __JOBFILL_CLOUD_SYNC_DISABLED__) || !isCloudSyncFeatureEnabled()) return null;
  if (!activeCloudSession) return null;
  if (Date.now() >= activeCloudSession.expiresAt) {
    activeCloudSession = null;
    return null;
  }
  return { ...activeCloudSession };
}

export function clearActiveCloudSession(): void {
  activeCloudSession = null;
}

export async function signUpCloudAccount(email: string, password: string): Promise<CloudAuthSession> {
  if ((typeof __JOBFILL_CLOUD_SYNC_DISABLED__ !== 'undefined' && __JOBFILL_CLOUD_SYNC_DISABLED__) || !isCloudSyncFeatureEnabled()) {
    throw new Error('CLOUD_SYNC_DISABLED_IN_RELEASE: Optional Supabase Cloud Sync is disabled in this release.');
  }
  const cfg = await getCloudConfig();
  if (!isCloudBackendConfigured(cfg)) {
    throw new Error('CLOUD_NOT_CONFIGURED: Configure Supabase URL and public anon key first.');
  }

  const resp = await fetch(`${cfg.supabaseUrl}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      apikey: cfg.supabaseAnonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: email.trim(), password }),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data?.access_token || !data?.user?.id) {
    throw new Error(data?.msg || data?.error_description || 'Cloud account registration failed or email confirmation pending.');
  }

  activeCloudSession = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    userId: data.user.id,
    email: data.user.email || email.trim(),
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
  };
  await saveCloudConfig({ authenticatedEmail: activeCloudSession.email });
  return { ...activeCloudSession };
}

export async function signInCloudAccount(email: string, password: string): Promise<CloudAuthSession> {
  if ((typeof __JOBFILL_CLOUD_SYNC_DISABLED__ !== 'undefined' && __JOBFILL_CLOUD_SYNC_DISABLED__) || !isCloudSyncFeatureEnabled()) {
    throw new Error('CLOUD_SYNC_DISABLED_IN_RELEASE: Optional Supabase Cloud Sync is disabled in this release.');
  }
  const cfg = await getCloudConfig();
  if (!isCloudBackendConfigured(cfg)) {
    throw new Error('CLOUD_NOT_CONFIGURED: Configure Supabase URL and public anon key first.');
  }

  const resp = await fetch(`${cfg.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: cfg.supabaseAnonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: email.trim(), password }),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data?.access_token || !data?.user?.id) {
    throw new Error(data?.error_description || data?.msg || 'Invalid email or password.');
  }

  activeCloudSession = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    userId: data.user.id,
    email: data.user.email || email.trim(),
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
  };
  await saveCloudConfig({ authenticatedEmail: activeCloudSession.email });
  return { ...activeCloudSession };
}

export async function signOutCloudAccount(alsoLockLocalVault = true): Promise<void> {
  if ((typeof __JOBFILL_CLOUD_SYNC_DISABLED__ !== 'undefined' && __JOBFILL_CLOUD_SYNC_DISABLED__) || !isCloudSyncFeatureEnabled()) {
    clearActiveCloudSession();
    if (alsoLockLocalVault) lockVault();
    return;
  }
  const cfg = await getCloudConfig();
  const sess = getActiveCloudSession();

  if (sess && isCloudBackendConfigured(cfg)) {
    try {
      await fetch(`${cfg.supabaseUrl}/auth/v1/logout`, {
        method: 'POST',
        headers: {
          apikey: cfg.supabaseAnonKey,
          Authorization: `Bearer ${sess.accessToken}`,
        },
      });
    } catch {
      // Ignore offline logout network error; always clear local session
    }
  }

  clearActiveCloudSession();
  await saveCloudConfig({ authenticatedEmail: null });
  if (alsoLockLocalVault) {
    lockVault();
  }
}
