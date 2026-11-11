// JobFill BD - Part A: Floating Toolbar Dismiss, Per-Tab Session Isolation & Popup Restore Suite

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isTabToolbarDismissed,
  setTabToolbarDismissed,
  clearTabToolbarDismissal,
  clearAllTabToolbarDismissals,
} from '../../src/background/toolbar-state';
import { MessageRouter } from '../../src/background/message-router';
import { App as PopupApp } from '../../src/popup/App';

describe('JobFill BD - Part A: Per-Tab Floating Toolbar Dismiss & Restore', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(async () => {
    await clearAllTabToolbarDismissals();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
      container = null;
    }
    delete (globalThis as any).chrome;
  });

  it('tracks dismissed toolbar state strictly per tab using chrome.storage.session and cleans on close/startup', async () => {
    const sessionStore: Record<string, any> = {};
    (globalThis as any).chrome = {
      runtime: { lastError: undefined },
      storage: {
        session: {
          get: (keys: string[], cb: (res: Record<string, any>) => void) => {
            const out: Record<string, any> = {};
            for (const k of keys) out[k] = sessionStore[k];
            cb(out);
          },
          set: (items: Record<string, any>, cb?: () => void) => {
            Object.assign(sessionStore, items);
            cb?.();
          },
          remove: (keys: string[], cb?: () => void) => {
            for (const k of keys) delete sessionStore[k];
            cb?.();
          },
        },
      },
    };

    // Tab 101 dismissed, Tab 202 untouched
    await setTabToolbarDismissed(101, true);
    expect(await isTabToolbarDismissed(101)).toBe(true);
    expect(await isTabToolbarDismissed(202)).toBe(false);

    // Closing Tab 101 clears only Tab 101
    await setTabToolbarDismissed(303, true);
    await clearTabToolbarDismissal(101);
    expect(await isTabToolbarDismissed(101)).toBe(false);
    expect(await isTabToolbarDismissed(303)).toBe(true);

    // Startup clears all session toolbar state
    await clearAllTabToolbarDismissals();
    expect(await isTabToolbarDismissed(303)).toBe(false);
  });

  it('MessageRouter routes per-tab toolbar state and rejects excluded Google Meet / Zoom origins', async () => {
    const sessionStore: Record<string, any> = {};
    (globalThis as any).chrome = {
      runtime: { lastError: undefined },
      storage: {
        session: {
          get: (keys: string[], cb: (res: Record<string, any>) => void) => {
            const out: Record<string, any> = {};
            for (const k of keys) out[k] = sessionStore[k];
            cb(out);
          },
          set: (items: Record<string, any>, cb?: () => void) => {
            Object.assign(sessionStore, items);
            cb?.();
          },
          remove: (keys: string[], cb?: () => void) => {
            for (const k of keys) delete sessionStore[k];
            cb?.();
          },
        },
      },
    };

    const callRouter = (action: any, senderUrl: string, tabId: number, payload?: any) =>
      new Promise<any>((resolve) => {
        MessageRouter.handleMessage(
          { action, payload },
          { tab: { id: tabId, url: senderUrl } as chrome.tabs.Tab, url: senderUrl },
          resolve
        );
      });

    // Allowed job site sets dismissed state for Tab 11 only
    const setRes = await callRouter('SET_TAB_TOOLBAR_DISMISSED', 'https://bogmc.teletalk.com.bd/apply.php', 11, {
      dismissed: true,
    });
    expect(setRes).toEqual({ status: 'ok', tabId: 11, dismissed: true });

    const getTab11 = await callRouter('GET_TAB_TOOLBAR_STATE', 'https://bogmc.teletalk.com.bd/apply.php', 11);
    expect(getTab11).toEqual({ status: 'ok', tabId: 11, dismissed: true });

    const getTab12 = await callRouter('GET_TAB_TOOLBAR_STATE', 'https://bogmc.teletalk.com.bd/apply.php', 12);
    expect(getTab12).toEqual({ status: 'ok', tabId: 12, dismissed: false });

    // Google Meet and Zoom origins are rejected
    const meetRes = await callRouter('GET_TAB_TOOLBAR_STATE', 'https://meet.google.com/abc-defg-hij', 99);
    expect(meetRes.status).toBe('denied');
    expect(meetRes.dismissed).toBe(false);

    const zoomRes = await callRouter('SET_TAB_TOOLBAR_DISMISSED', 'https://app.zoom.us/wc/join/123', 98, {
      dismissed: false,
    });
    expect(zoomRes.status).toBe('denied');
  });

  it('Popup shows a single Show Toolbar restore control when dismissed on active tab and restores it cleanly', async () => {
    const sentTabMessages: Array<{ tabId: number; action: string }> = [];
    const sentRuntimeMessages: Array<{ action: string; payload?: any }> = [];
    let toolbarDismissedOnTab = true;

    (globalThis as any).chrome = {
      runtime: {
        id: 'ext-test-id',
        lastError: undefined,
        getURL: (p: string) => `chrome-extension://ext-test-id/${p}`,
        sendMessage: (msg: any, cb?: (res: any) => void) => {
          sentRuntimeMessages.push(msg);
          if (msg.action === 'GET_ACTIVE_PROFILE_STATE') {
            cb?.({ status: 'locked', isPasswordProtected: false, activeProfile: null, profiles: [] });
            return;
          }
          if (msg.action === 'SET_TAB_TOOLBAR_DISMISSED') {
            toolbarDismissedOnTab = Boolean(msg.payload?.dismissed);
            cb?.({ status: 'ok', dismissed: toolbarDismissedOnTab });
            return;
          }
          if (msg.action === 'GET_TAB_TOOLBAR_STATE') {
            cb?.({ status: 'ok', dismissed: toolbarDismissedOnTab });
            return;
          }
          cb?.({ status: 'ok' });
        },
      },
      storage: {
        local: {
          get: (_keys: any, cb: (res: any) => void) => cb({}),
          set: (_items: any, cb?: () => void) => cb?.(),
        },
      },
      tabs: {
        query: async () => [{ id: 55, url: 'https://bogmc.teletalk.com.bd/apply.php' }],
        sendMessage: async (tabId: number, msg: any) => {
          sentTabMessages.push({ tabId, action: msg.action });
          if (msg.action === 'DETECT_FORM') {
            return {
              status: 'ok',
              hasJobForm: true,
              organization: 'Petrobangla BOGMC',
              platform: 'Teletalk',
              pageTitle: 'Application Form',
              toolbarDismissed: toolbarDismissedOnTab,
              totalDetected: 12,
              matchedCount: 10,
              readyToFillCount: 10,
            };
          }
          if (msg.action === 'SHOW_FLOATING_TOOLBAR') {
            toolbarDismissedOnTab = false;
            return { status: 'ok', toolbarDismissed: false, toolbarVisible: true };
          }
          return { status: 'ok' };
        },
      },
    };

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(<PopupApp />);
      await new Promise((r) => setTimeout(r, 80));
    });

    const restoreBtn = container.querySelector('[data-testid="popup-restore-toolbar-btn"]') as HTMLButtonElement | null;
    expect(restoreBtn).not.toBeNull();
    expect(restoreBtn?.textContent).toContain('Show Toolbar');

    await act(async () => {
      restoreBtn?.click();
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(sentRuntimeMessages.some((m) => m.action === 'SET_TAB_TOOLBAR_DISMISSED' && m.payload?.dismissed === false)).toBe(true);
    expect(sentTabMessages.some((m) => m.tabId === 55 && m.action === 'SHOW_FLOATING_TOOLBAR')).toBe(true);
    expect(container.querySelector('[data-testid="popup-restore-toolbar-btn"]')).toBeNull();
  });

  it('Popup never exposes Show Toolbar control on excluded Google Meet tabs', async () => {
    (globalThis as any).chrome = {
      runtime: {
        id: 'ext-test-id',
        lastError: undefined,
        getURL: (p: string) => `chrome-extension://ext-test-id/${p}`,
        sendMessage: (msg: any, cb?: (res: any) => void) => {
          if (msg.action === 'GET_ACTIVE_PROFILE_STATE') {
            cb?.({ status: 'locked', isPasswordProtected: false, activeProfile: null, profiles: [] });
            return;
          }
          cb?.({ status: 'ok', dismissed: true });
        },
      },
      storage: {
        local: {
          get: (_keys: any, cb: (res: any) => void) => cb({}),
          set: (_items: any, cb?: () => void) => cb?.(),
        },
      },
      tabs: {
        query: async () => [{ id: 77, url: 'https://meet.google.com/xyz-abcd-efg' }],
      },
    };

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(<PopupApp />);
      await new Promise((r) => setTimeout(r, 80));
    });

    expect(container.textContent).toContain('Restricted Browser Page');
    expect(container.querySelector('[data-testid="popup-restore-toolbar-btn"]')).toBeNull();
  });
});
