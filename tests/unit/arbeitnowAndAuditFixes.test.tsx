// JobFill BD - Arbeitnow Adapter, Category Preservation, Pagination & Audit Regression Tests

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AppProvider } from '../../src/dashboard/context/AppContext';
import { JobCircularPage } from '../../src/jobs/dashboard/JobCircularPage';
import { JobSearchPage } from '../../src/jobs/dashboard/JobSearchPage';
import { GovtOrganizationsPage } from '../../src/jobs/dashboard/GovtOrganizationsPage';
import {
  ArbeitnowAdapter,
  parseArbeitnowApiJson,
} from '../../src/jobs/sources/arbeitnow.adapter';
import { JobSourceRegistry } from '../../src/jobs/sources/source-registry';
import { normalizeCategory, normalizeJobRecord } from '../../src/jobs/services/job-normalizer';
import { JobRepository } from '../../src/jobs/database/job-repository';
import { BookmarkRepository } from '../../src/jobs/database/bookmark-repository';
import { ApplicationRepository } from '../../src/jobs/database/application-repository';
import { JobNotificationRepository } from '../../src/jobs/database/notification-repository';
import { NormalizedJobCircular } from '../../src/jobs/types/job.types';

async function flushUi(ms: number = 40) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

function makeTestCircular(index: number, overrides: Partial<NormalizedJobCircular> = {}): NormalizedJobCircular {
  const baseTs = Date.now() - index * 60_000;
  return normalizeJobRecord(
    {
      externalId: `test_pag_${index}`,
      organization: `Organization ${index}`,
      jobTitle: `Software Engineer Role ${index}`,
      position: `Software Engineer Role ${index}`,
      category: 'Government',
      location: 'Dhaka',
      publishedDateText: '2026-11-10',
      circularUrl: `https://alljobs.teletalk.com.bd/job/${index}`,
      applicationUrl: `https://alljobs.teletalk.com.bd/apply/${index}`,
    },
    {
      sourceId: 'manual',
      sourceName: 'Test Fixture',
      verificationLevel: 'official_verified',
      checkedAt: baseTs,
      defaultApplicationUrl: 'https://alljobs.teletalk.com.bd/',
    }
  );
}

describe('JobFill BD - Audit Fixes, Arbeitnow API & DOM Pagination Suite', () => {
  let container: HTMLDivElement;
  let root: Root;
  let origChrome: any;
  let origFetch: any;

  beforeEach(async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    origChrome = (globalThis as any).chrome;
    origFetch = (globalThis as any).fetch;
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('jobfill_language', 'en');
    await JobRepository.clearAll();
    await JobNotificationRepository.clearAll();
    await ApplicationRepository.clearAll();
    await BookmarkRepository.clearAll();
    await JobRepository.savePreferences({ enableArbeitnowSource: true });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    (globalThis as any).chrome = origChrome;
    (globalThis as any).fetch = origFetch;
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('preserves Defence, Education, Remote Jobs, and International Jobs in normalizeCategory', () => {
    expect(normalizeCategory('International Jobs', 'Global role')).toBe('International Jobs');
    expect(normalizeCategory('Remote Jobs', 'Senior Developer')).toBe('Remote Jobs');
    expect(normalizeCategory('Education', 'School Notice')).toBe('Education');
    expect(normalizeCategory('Defence', 'Cadet Wing')).toBe('Defence');
  });

  it('parses Arbeitnow REST API JSON filtering strictly to remote=true and preserving International Jobs category without fake deadlines', async () => {
    const samplePayload = JSON.stringify({
      data: [
        {
          slug: 'senior-ts-dev-remote-1',
          company_name: 'CloudOps GmbH',
          title: 'Senior TypeScript Developer',
          description: '<p>Build scalable web apps remotely.</p>',
          remote: true,
          url: 'https://www.arbeitnow.com/jobs/companies/cloudops/senior-ts-dev-remote-1',
          tags: ['Remote', 'TypeScript'],
          job_types: ['Full-time'],
          location: 'Berlin',
          created_at: 1794331865,
        },
        {
          slug: 'onsite-clerk-munich-2',
          company_name: 'Munich Local Co',
          title: 'On-Site Office Clerk',
          description: '<p>On-site Munich office only.</p>',
          remote: false,
          url: 'https://www.arbeitnow.com/jobs/companies/munich/onsite-clerk-munich-2',
          tags: ['Office'],
          job_types: ['Full-time'],
          location: 'Munich',
          created_at: 1794331865,
        },
      ],
    });

    const parsed = parseArbeitnowApiJson(samplePayload);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].organization).toBe('CloudOps GmbH');
    expect(parsed[0].category).toBe('International Jobs');
    expect(parsed[0].deadlineText).toBeUndefined();

    const normalized = ArbeitnowAdapter.parseJob(parsed[0], Date.now());
    expect(normalized.category).toBe('International Jobs');
    expect(normalized.deadlineAt).toBeNull();
    expect(normalized.deadlineVerified).toBe(false);
    expect(normalized.publishedAt).not.toBeNull();

    expect(JobSourceRegistry.getById('arbeitnow_remote')).toBeDefined();

    // Respects opt-out setting without network calls
    await JobRepository.savePreferences({ enableArbeitnowSource: false });
    const fetchSpy = vi.fn();
    (globalThis as any).fetch = fetchSpy;
    const disabledOutcome = await ArbeitnowAdapter.fetchJobs();
    expect(disabledOutcome.connectionStatus).toBe('Not Implemented');
    expect(disabledOutcome.jobs).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('paginates JobCircularPage (24/page), JobSearchPage (20/page), and GovtOrganizationsPage (24/page) cleanly', async () => {
    const thirtyJobs: NormalizedJobCircular[] = [];
    for (let i = 1; i <= 30; i++) {
      thirtyJobs.push({
        ...makeTestCircular(i),
        sourceId: 'teletalk',
        sourceName: 'Teletalk All Jobs',
        organizationId: 700 + (i % 3),
        organizationShortName: `ORG${i % 3}`,
        publishedAt: Date.now() - i * 1000,
      });
    }
    await JobRepository.saveJobs(thirtyJobs);
    await JobRepository.saveSchedulerState({
      lastDailyCheckAt: Date.now(),
      lastSuccessfulSyncAt: Date.now(),
      lastDailyDigestDateKey: null,
      lastSchedulerRunAt: Date.now(),
      nextScheduledAlarmAt: null,
    });

    // 1. JobCircularPage renders 24 cards on page 1, 6 on page 2
    await act(async () => {
      root.render(
        <AppProvider>
          <JobCircularPage />
        </AppProvider>
      );
    });
    await flushUi(80);

    expect(container.textContent).toContain('Page 1 of 2 (30 total)');
    expect(container.querySelectorAll('[role="list"] > div').length).toBe(24);

    const nextCircularBtn = Array.from(container.querySelectorAll('nav[aria-label="Job circulars pagination"] button')).find(
      (b) => b.textContent?.includes('Next')
    ) as HTMLButtonElement;
    expect(nextCircularBtn).toBeDefined();
    await act(async () => {
      nextCircularBtn.click();
    });
    await flushUi(30);
    expect(container.textContent).toContain('Page 2 of 2 (30 total)');
    expect(container.querySelectorAll('[role="list"] > div').length).toBe(6);

    // 2. JobSearchPage renders 20 results on page 1, 10 on page 2
    await act(async () => {
      root.render(
        <AppProvider>
          <JobSearchPage />
        </AppProvider>
      );
    });
    await flushUi(80);

    expect(container.textContent).toContain('Page 1 of 2 (30 results)');
    expect(container.querySelectorAll('article').length).toBe(20);

    const nextSearchBtn = Array.from(container.querySelectorAll('nav[aria-label="Job search results pagination"] button')).find(
      (b) => b.textContent?.includes('Next')
    ) as HTMLButtonElement;
    await act(async () => {
      nextSearchBtn.click();
    });
    await flushUi(30);
    expect(container.textContent).toContain('Page 2 of 2 (30 results)');
    expect(container.querySelectorAll('article').length).toBe(10);

    // 3. GovtOrganizationsPage paginates active openings at 24 per page
    await act(async () => {
      root.render(
        <AppProvider>
          <GovtOrganizationsPage />
        </AppProvider>
      );
    });
    await flushUi(80);

    const activeOpeningsCard = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('All Active Jobs')
    ) as HTMLButtonElement;
    expect(activeOpeningsCard).toBeDefined();
    await act(async () => {
      activeOpeningsCard.click();
    });
    await flushUi(40);

    expect(container.textContent).toContain('Page 1 of 2 (30 openings)');
    const nextOrgJobsBtn = Array.from(container.querySelectorAll('nav[aria-label="Government jobs pagination"] button')).find(
      (b) => b.textContent?.includes('Next')
    ) as HTMLButtonElement;
    expect(nextOrgJobsBtn).toBeDefined();
    await act(async () => {
      nextOrgJobsBtn.click();
    });
    await flushUi(30);
    expect(container.textContent).toContain('Page 2 of 2 (30 openings)');
  });
});
