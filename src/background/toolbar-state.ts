// JobFill BD - Per-Tab Floating Toolbar Dismissal State
// Uses chrome.storage.session so dismissal persists across same-tab reloads and SPA navigation
// without leaking to other tabs or surviving browser restarts.

const SESSION_TOOLBAR_KEY = 'jobfill_dismissed_toolbar_tabs_v1';
const memoryFallbackDismissedTabs = new Set<number>();

function getSessionStorageArea(): chrome.storage.StorageArea | null {
  if (typeof chrome !== 'undefined' && chrome.storage && (chrome.storage as any).session) {
    return (chrome.storage as any).session as chrome.storage.StorageArea;
  }
  return null;
}

async function readDismissedTabMap(): Promise<Record<string, boolean>> {
  const area = getSessionStorageArea();
  if (!area) {
    const out: Record<string, boolean> = {};
    for (const tabId of memoryFallbackDismissedTabs) {
      out[String(tabId)] = true;
    }
    return out;
  }

  return new Promise((resolve) => {
    try {
      area.get([SESSION_TOOLBAR_KEY], (res) => {
        if (chrome.runtime?.lastError) {
          resolve({});
          return;
        }
        const raw = res?.[SESSION_TOOLBAR_KEY];
        resolve(raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {});
      });
    } catch {
      resolve({});
    }
  });
}

async function writeDismissedTabMap(map: Record<string, boolean>): Promise<void> {
  const area = getSessionStorageArea();
  if (!area) {
    memoryFallbackDismissedTabs.clear();
    for (const [k, v] of Object.entries(map)) {
      const id = Number(k);
      if (v && Number.isFinite(id)) {
        memoryFallbackDismissedTabs.add(id);
      }
    }
    return;
  }

  await new Promise<void>((resolve) => {
    try {
      area.set({ [SESSION_TOOLBAR_KEY]: map }, () => resolve());
    } catch {
      resolve();
    }
  });
}

export async function isTabToolbarDismissed(tabId: number): Promise<boolean> {
  if (!Number.isFinite(tabId) || tabId < 0) return false;
  const map = await readDismissedTabMap();
  return Boolean(map[String(tabId)]);
}

export async function setTabToolbarDismissed(tabId: number, dismissed: boolean): Promise<void> {
  if (!Number.isFinite(tabId) || tabId < 0) return;
  const map = await readDismissedTabMap();
  if (dismissed) {
    map[String(tabId)] = true;
  } else {
    delete map[String(tabId)];
  }
  await writeDismissedTabMap(map);
}

export async function clearTabToolbarDismissal(tabId: number): Promise<void> {
  await setTabToolbarDismissed(tabId, false);
}

export async function clearAllTabToolbarDismissals(): Promise<void> {
  memoryFallbackDismissedTabs.clear();
  const area = getSessionStorageArea();
  if (!area) return;
  await new Promise<void>((resolve) => {
    try {
      area.remove([SESSION_TOOLBAR_KEY], () => resolve());
    } catch {
      resolve();
    }
  });
}
