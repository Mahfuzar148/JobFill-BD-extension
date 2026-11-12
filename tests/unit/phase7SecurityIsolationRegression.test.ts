import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { isExcludedSiteUrl, isGoogleMeetUrl } from '../../src/security/site-policy';
import { DB_VERSION, STORES } from '../../src/database/indexeddb';
import { MessageRouter } from '../../src/background/message-router';

describe('Phase 7 — Meet/Zoom Exclusion, Schema Non-Destructive Upgrade & Router Guard Regression', () => {
  it('1. Strictly preserves Google Meet, Zoom, Gmail, YouTube, and chrome:// exclusions', () => {
    expect(isExcludedSiteUrl('https://meet.google.com/abc-defg-hij')).toBe(true);
    expect(isGoogleMeetUrl('https://meet.google.com/landing')).toBe(true);
    expect(isExcludedSiteUrl('https://us05web.zoom.us/wc/join/12345')).toBe(true);
    expect(isExcludedSiteUrl('https://zoom.us/j/123456')).toBe(true);
    expect(isExcludedSiteUrl('https://mail.google.com/mail/u/0/')).toBe(true);
    expect(isExcludedSiteUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
    expect(isExcludedSiteUrl('chrome://extensions')).toBe(true);

    const manifest = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../../manifest.json'), 'utf8')
    );
    const excludes: string[] = manifest.content_scripts[0].exclude_matches;
    expect(excludes).toContain('*://meet.google.com/*');
    expect(excludes).toContain('*://zoom.us/*');
    expect(excludes).toContain('*://*.zoom.us/*');
  });

  it('2. Keeps IndexedDB schema upgrade additive (v10 with credentials, cv, calendar, exam & vocab stores, zero deleteObjectStore)', () => {
    expect(DB_VERSION).toBe(10);
    expect(STORES.CREDENTIALS).toBe('credential_vault');
    expect(STORES.CV_DOCUMENTS).toBe('cv_documents');
    expect(STORES.CALENDAR_EVENTS).toBe('calendar_events');
    expect(STORES.EXAM_ATTEMPTS).toBe('exam_attempts');
    expect(STORES.VOCABULARY_ITEMS).toBe('vocabulary_items');
    expect(STORES.STUDY_NOTES).toBe('study_notes');
    expect(STORES.PROFILES).toBe('profiles');
    expect(STORES.APPLICATIONS).toBe('applications');

    const dbSource = fs.readFileSync(
      path.resolve(__dirname, '../../src/database/indexeddb.ts'),
      'utf8'
    );
    expect(dbSource).not.toContain('deleteObjectStore');
    expect(dbSource).not.toContain('deleteDatabase');
  });

  it('3. MessageRouter blocks arbitrary webpage tabs from querying or filling Credential Vault', async () => {
    const deniedActions = [
      'CRED_VAULT_GET_STATUS',
      'CRED_VAULT_FIND_FOR_TAB',
      'CRED_VAULT_FILL_TAB',
      'CRED_VAULT_SAVE_MANUAL',
    ] as const;

    for (const action of deniedActions) {
      const response: any = await new Promise((resolve) => {
        MessageRouter.handleMessage(
          { action, payload: { url: 'https://teletalk.com.bd' } },
          { tab: { id: 99, url: 'https://evil-page.example.com/form' } as any },
          resolve
        );
      });
      expect(response?.status).toBe('denied');
    }
  });
});
