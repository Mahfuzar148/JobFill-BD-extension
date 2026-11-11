// JobFill BD - Official Job Portals Quick Access Test Suite

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AppProvider } from '../../src/dashboard/context/AppContext';
import { Sidebar } from '../../src/dashboard/components/Sidebar';
import { Header } from '../../src/dashboard/components/Header';
import { App as PopupApp } from '../../src/popup/App';
import { createEmptyProfile } from '../../src/types/defaults';
import { JobCircularPage } from '../../src/jobs/dashboard/JobCircularPage';
import {
  OfficialJobPortalsPage,
} from '../../src/jobs/dashboard/OfficialJobPortalsPage';
import {
  OFFICIAL_JOB_PORTALS,
  OFFICIAL_PORTAL_CATEGORIES,
  isTrustedOfficialPortalUrl,
  openOfficialPortalInNewTab,
  filterOfficialPortals,
} from '../../src/jobs/data/official-portals';
import { JobRepository } from '../../src/jobs/database/job-repository';
import { JobNotificationRepository } from '../../src/jobs/database/notification-repository';
import { BookmarkRepository } from '../../src/jobs/database/bookmark-repository';
import { ApplicationRepository } from '../../src/jobs/database/application-repository';

async function flushUi(ms: number = 40) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

function setReactInputValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (setter) {
    setter.call(el, value);
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

const EXPECTED_PORTAL_URLS: Array<[string, string]> = [
  ['Teletalk Alljobs', 'https://alljobs.teletalk.com.bd/jobs/government'],
  ['BPSC', 'https://bpsc.gov.bd/'],
  ['BPSC Teletalk', 'https://bpscs.teletalk.com.bd/'],
  ['Bangladesh National Portal', 'https://bangladesh.gov.bd/pages/job-tender-announcements'],
  ['Bangladesh Bank eRecruitment', 'https://erecruitment.bb.org.bd/'],
  ['Bangladesh Bank', 'https://www.bb.org.bd/'],
  ['NTRCA', 'https://ntrca.gov.bd/'],
  ['NTRCA Teletalk', 'https://ntrcar.teletalk.com.bd/'],
  ['Directorate of Primary Education', 'https://dpe.gov.bd/'],
  ['Bdjobs', 'https://www.bdjobs.com/'],
  ['Himalayas', 'https://himalayas.app/jobs'],
  ['RemoteOK', 'https://remoteok.com/'],
  ['Remotive', 'https://remotive.com/'],
  ['Arbeitnow', 'https://www.arbeitnow.com/'],
];

describe('JobFill BD - Official Job Portals Quick Access', () => {
  let container: HTMLDivElement;
  let root: Root;
  let origChrome: any;

  beforeEach(async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    origChrome = (globalThis as any).chrome;
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('jobfill_language', 'en');
    await JobRepository.clearAll();
    await JobNotificationRepository.clearAll();
    await ApplicationRepository.clearAll();
    await BookmarkRepository.clearAll();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    (globalThis as any).chrome = origChrome;
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('contains all 14 exact predefined official HTTPS portal entries across all 6 categories', () => {
    expect(OFFICIAL_JOB_PORTALS).toHaveLength(14);
    expect(OFFICIAL_PORTAL_CATEGORIES).toEqual([
      'Government',
      'Bank',
      'Education',
      'Private',
      'International',
      'Remote',
    ]);

    for (const [expectedName, expectedUrl] of EXPECTED_PORTAL_URLS) {
      const match = OFFICIAL_JOB_PORTALS.find(
        (p) => p.name === expectedName && p.url === expectedUrl
      );
      expect(match).toBeDefined();
      expect(isTrustedOfficialPortalUrl(expectedUrl)).toBe(true);
    }

    // Category distribution should keep every pill populated
    expect(filterOfficialPortals(OFFICIAL_JOB_PORTALS, 'Government', '').length).toBe(4);
    expect(filterOfficialPortals(OFFICIAL_JOB_PORTALS, 'Bank', '').length).toBe(2);
    expect(filterOfficialPortals(OFFICIAL_JOB_PORTALS, 'Education', '').length).toBe(3);
    expect(filterOfficialPortals(OFFICIAL_JOB_PORTALS, 'Private', '').length).toBe(1);
    expect(filterOfficialPortals(OFFICIAL_JOB_PORTALS, 'International', '').length).toBe(2);
    expect(filterOfficialPortals(OFFICIAL_JOB_PORTALS, 'Remote', '').length).toBe(2);
  });

  it('strictly blocks untrusted, non-HTTPS, redirect, and arbitrary external URLs', async () => {
    const tabsCreateSpy = vi.fn().mockResolvedValue({ id: 99 });
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    (globalThis as any).chrome = {
      tabs: { create: tabsCreateSpy },
    };

    const maliciousOrUnlisted = [
      '',
      'http://bpsc.gov.bd/',
      'javascript:alert(1)',
      'data:text/html,<h1>phish</h1>',
      'https://evil-phishing.example.com/',
      'https://bpsc.gov.bd/?next=https://evil.com',
      'https://alljobs.teletalk.com.bd/jobs/government?redirect=https://bad.site',
    ];

    for (const badUrl of maliciousOrUnlisted) {
      expect(isTrustedOfficialPortalUrl(badUrl)).toBe(false);
      const res = await openOfficialPortalInNewTab(badUrl);
      expect(res.opened).toBe(false);
      expect(res.method).toBe('blocked');
    }

    expect(tabsCreateSpy).not.toHaveBeenCalled();
    expect(windowOpenSpy).not.toHaveBeenCalled();
  });

  it('renders all 14 portal cards and opens exact predefined URLs in new Chrome tabs via chrome.tabs.create', async () => {
    const tabsCreateSpy = vi.fn().mockResolvedValue({ id: 101 });
    (globalThis as any).chrome = {
      tabs: { create: tabsCreateSpy },
    };

    const initialHref = window.location.href;

    await act(async () => {
      root.render(
        <AppProvider>
          <OfficialJobPortalsPage />
        </AppProvider>
      );
    });
    await flushUi();

    expect(container.textContent).toContain('Official Job Portals');
    expect(container.textContent).toContain('Showing 14 of 14 portals');

    const cards = container.querySelectorAll('[data-testid^="portal-card-"]');
    expect(cards.length).toBe(14);

    // Every card displays name, category, description, and Visit Website button with SVG icon
    for (const portal of OFFICIAL_JOB_PORTALS) {
      const card = container.querySelector(`[data-testid="portal-card-${portal.id}"]`);
      expect(card).not.toBeNull();
      expect(card!.textContent).toContain(portal.name);
      expect(card!.textContent).toContain(portal.category);
      expect(card!.textContent).toContain(portal.description);

      const visitBtn = container.querySelector(
        `[data-testid="visit-portal-${portal.id}"]`
      ) as HTMLButtonElement;
      expect(visitBtn).not.toBeNull();
      expect(visitBtn.textContent).toContain('Visit Website');
      expect(visitBtn.querySelector('svg')).not.toBeNull();

      await act(async () => {
        visitBtn.click();
      });
      await flushUi(10);

      expect(tabsCreateSpy).toHaveBeenCalledWith({ url: portal.url, active: true });
    }

    expect(tabsCreateSpy).toHaveBeenCalledTimes(14);
    // Must not navigate away from existing Dashboard page
    expect(window.location.href).toBe(initialHref);
  });

  it('filters portals accurately using Search input and all 6 Category buttons', async () => {
    await act(async () => {
      root.render(
        <AppProvider>
          <OfficialJobPortalsPage />
        </AppProvider>
      );
    });
    await flushUi();

    const clickCategory = async (category: string) => {
      const btn = container.querySelector(
        `[data-testid="portal-category-${category}"]`
      ) as HTMLButtonElement;
      expect(btn).not.toBeNull();
      await act(async () => {
        btn.click();
      });
      await flushUi(15);
    };

    await clickCategory('Bank');
    expect(container.querySelectorAll('[data-testid^="portal-card-"]').length).toBe(2);
    expect(container.textContent).toContain('Bangladesh Bank eRecruitment');
    expect(container.textContent).toContain('Bangladesh Bank');

    await clickCategory('Education');
    expect(container.querySelectorAll('[data-testid^="portal-card-"]').length).toBe(3);
    expect(container.textContent).toContain('NTRCA Teletalk');
    expect(container.textContent).toContain('Directorate of Primary Education');

    await clickCategory('Private');
    expect(container.querySelectorAll('[data-testid^="portal-card-"]').length).toBe(1);
    expect(container.textContent).toContain('Bdjobs');

    await clickCategory('International');
    expect(container.querySelectorAll('[data-testid^="portal-card-"]').length).toBe(2);
    expect(container.textContent).toContain('Himalayas');
    expect(container.textContent).toContain('Arbeitnow');

    await clickCategory('Remote');
    expect(container.querySelectorAll('[data-testid^="portal-card-"]').length).toBe(2);
    expect(container.textContent).toContain('RemoteOK');
    expect(container.textContent).toContain('Remotive');

    await clickCategory('All');
    expect(container.querySelectorAll('[data-testid^="portal-card-"]').length).toBe(14);

    // Search test
    const searchInput = container.querySelector(
      '[data-testid="portal-search-input"]'
    ) as HTMLInputElement;
    expect(searchInput).not.toBeNull();

    await act(async () => {
      setReactInputValue(searchInput, 'BPSC');
    });
    await flushUi(15);
    expect(container.querySelectorAll('[data-testid^="portal-card-"]').length).toBe(2);
    expect(container.textContent).toContain('BPSC Teletalk');

    await act(async () => {
      setReactInputValue(searchInput, 'no-such-portal-xyz');
    });
    await flushUi(15);
    expect(container.querySelectorAll('[data-testid^="portal-card-"]').length).toBe(0);
    expect(container.textContent).toContain('No matching job portals found');

    const resetBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Reset Filters')
    );
    expect(resetBtn).toBeDefined();
    await act(async () => {
      resetBtn!.click();
    });
    await flushUi(15);
    expect(container.querySelectorAll('[data-testid^="portal-card-"]').length).toBe(14);
  });

  it('adds 🌐 Official Job Portals button to Sidebar, Header breadcrumbs, Extension Popup, and Circular Hub Header', async () => {
    const tabsCreateSpy = vi.fn().mockResolvedValue({ id: 77 });
    (globalThis as any).chrome = {
      storage: {
        local: {
          get: (_keys: any, cb: any) => cb({ jobfill_profiles: [] }),
          set: (_data: any, cb?: any) => cb?.(),
        },
      },
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 1, url: 'chrome://newtab' }]),
        create: tabsCreateSpy,
      },
      runtime: {
        getURL: (p: string) => `chrome-extension://jobfill-bd/${p}`,
        sendMessage: vi.fn(),
        lastError: null,
      },
    };

    // 1. Popup button opens dashboard?tab=portals in a Chrome tab
    await act(async () => {
      root.render(<PopupApp />);
    });
    await flushUi();

    const popupBtn = container.querySelector(
      '[data-testid="popup-official-portals-btn"]'
    ) as HTMLButtonElement;
    expect(popupBtn).not.toBeNull();
    expect(popupBtn.textContent).toContain('🌐 Official Job Portals');

    await act(async () => {
      popupBtn.click();
    });
    expect(tabsCreateSpy).toHaveBeenCalledWith({
      url: 'chrome-extension://jobfill-bd/dashboard.html?tab=portals',
    });

    // 2. Dashboard Sidebar + Header breadcrumb support 'portals'
    const onSelectTab = vi.fn();
    const sampleProfile = createEmptyProfile('Candidate');
    await act(async () => {
      root.render(
        <AppProvider>
          <Header
            activeTab="portals"
            currentProfile={sampleProfile}
            allProfiles={[sampleProfile]}
            onSelectProfile={vi.fn()}
            onCreateProfile={vi.fn()}
            onSave={vi.fn()}
            hasUnsavedChanges={false}
            isSaving={false}
            isLocked={false}
          />
          <Sidebar activeTab="portals" onSelectTab={onSelectTab} completionScore={80} />
        </AppProvider>
      );
    });
    await flushUi();

    expect(container.textContent).toContain('Job Hub / Official Job Portals');
    const sidebarPortalsBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('🌐 Official Job Portals')
    );
    expect(sidebarPortalsBtn).toBeDefined();
    await act(async () => {
      sidebarPortalsBtn!.click();
    });
    expect(onSelectTab).toHaveBeenCalledWith('portals');

    // 3. Job Circular Hub Header button calls onNavigatePortals or opens Portal Directory Modal
    const onNavigatePortals = vi.fn();
    await act(async () => {
      root.render(
        <AppProvider>
          <JobCircularPage onNavigatePortals={onNavigatePortals} />
        </AppProvider>
      );
    });
    await flushUi();

    const hubBtn = container.querySelector(
      '[data-testid="hub-official-portals-btn"]'
    ) as HTMLButtonElement;
    expect(hubBtn).not.toBeNull();
    expect(hubBtn.textContent).toContain('🌐 Official Job Portals');
    await act(async () => {
      hubBtn.click();
    });
    expect(onNavigatePortals).toHaveBeenCalledTimes(1);

    // Without onNavigatePortals prop, clicking opens interactive modal with 14 portal cards
    await act(async () => {
      root.render(
        <AppProvider>
          <JobCircularPage />
        </AppProvider>
      );
    });
    await flushUi();

    const standaloneHubBtn = container.querySelector(
      '[data-testid="hub-official-portals-btn"]'
    ) as HTMLButtonElement;
    await act(async () => {
      standaloneHubBtn.click();
    });
    await flushUi(20);

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.querySelectorAll('[data-testid^="portal-card-"]').length).toBe(14);
  });

  it('preserves Official Job Portals search & category filter state across navigation returns', async () => {
    await act(async () => {
      root.render(
        <AppProvider>
          <OfficialJobPortalsPage />
        </AppProvider>
      );
    });
    await flushUi();

    const bankBtn = container.querySelector('[data-testid="portal-category-Bank"]') as HTMLButtonElement;
    const searchInput = container.querySelector('[data-testid="portal-search-input"]') as HTMLInputElement;
    await act(async () => {
      bankBtn.click();
      setReactInputValue(searchInput, 'eRecruitment');
    });
    await flushUi(20);
    expect(container.querySelectorAll('[data-testid^="portal-card-"]').length).toBe(1);

    // Unmount (user switches tab) and remount cleanly
    await act(async () => {
      root.render(
        <AppProvider>
          <OfficialJobPortalsPage />
        </AppProvider>
      );
    });
    await flushUi(20);
    expect(container.querySelectorAll('[data-testid^="portal-card-"]').length).toBe(1);
    expect(container.textContent).toContain('Bangladesh Bank eRecruitment');
  });
});
