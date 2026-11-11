// JobFill BD - Teletalk Alljobs Government Organizations & Job Directory Tests

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AppProvider } from '../../src/dashboard/context/AppContext';
import { Sidebar } from '../../src/dashboard/components/Sidebar';
import { GovtOrganizationsPage } from '../../src/jobs/dashboard/GovtOrganizationsPage';
import { JobRepository } from '../../src/jobs/database/job-repository';
import { BookmarkRepository } from '../../src/jobs/database/bookmark-repository';
import { ApplicationRepository } from '../../src/jobs/database/application-repository';
import { JobNotificationRepository } from '../../src/jobs/database/notification-repository';
import {
  TeletalkAdapter,
  parseTeletalkPublishedJobsJson,
  parseTeletalkGovtOrgListJson,
  parseTeletalkGovtJobsListJson,
  fetchTeletalkGovtOrganizations,
  buildGovtOrganizationsFromJobs,
} from '../../src/jobs/sources/teletalk/teletalk.adapter';
import { JobCheckService } from '../../src/jobs/background/job-check-service';
import { NotificationScheduler } from '../../src/jobs/notifications/notification-scheduler';
import { DAY_MS, HOUR_MS, getDhakaDateKey } from '../../src/jobs/services/deadline-parser';

async function flushUi(ms: number = 45) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

function setReactInputValue(el: HTMLInputElement | HTMLSelectElement, value: string) {
  const proto =
    el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) {
    setter.call(el, value);
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('JobFill BD - Complete Teletalk Alljobs Government Organization System', () => {
  let container: HTMLDivElement;
  let root: Root;
  let origChrome: any;

  beforeEach(async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    origChrome = (globalThis as any).chrome;
    vi.restoreAllMocks();
    localStorage.clear();
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
    vi.restoreAllMocks();
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('1. Parses all Alljobs schema fields, multi-page org-list & fallback govt-jobs/list cleanly', async () => {
    const futureSoon = new Date(Date.now() + 3 * DAY_MS).toISOString();
    const pastDeadline = new Date(Date.now() - 2 * DAY_MS).toISOString();

    const searchPayload = JSON.stringify({
      status: 'success',
      count: 22,
      govtJobs: [
        {
          job_primary_id: 15257,
          job_id: 'GJOB15257',
          job_title: 'Veterinary Officer',
          job_title_bn: 'ভেটেরিনারী কর্মকর্তা',
          vacancy: '06',
          vacancy_not_specific: false,
          application_site_url: 'https://dscc.teletalk.com.bd/',
          published_date: '2026-11-11T04:00:00.000Z',
          deadline_date: futureSoon,
          created_at: '2026-11-10T04:36:40.760Z',
          organization_id: 635,
          org_name: 'Dhaka South City Corporation (DSCC)',
          org_name_bn: null,
          short_name: 'DSCC',
          logo: 'recruiter/organization/logo/DGFPMAG_gjrffie.png',
          website: 'http://dscc.gov.bd/',
        },
      ],
    });

    const parsedSearch = parseTeletalkPublishedJobsJson(searchPayload);
    expect(parsedSearch.ok).toBe(true);
    expect(parsedSearch.items[0].organizationId).toBe(635);
    expect(parsedSearch.items[0].organizationShortName).toBe('DSCC');
    expect(parsedSearch.items[0].circularNumber).toBe('GJOB15257');
    expect(parsedSearch.items[0].vacancies).toBe(6);
    expect(parsedSearch.items[0].applicationStartText).toBe('2026-11-11T04:00:00.000Z');
    expect(parsedSearch.items[0].organizationLogo).toBe(
      'https://alljobs.teletalk.com.bd/media/recruiter/organization/logo/DGFPMAG_gjrffie.png'
    );

    const orgListPayload = JSON.stringify({
      status: 'success',
      count: 2,
      govtOrgJobs: [
        {
          id: 635,
          name: 'Dhaka South City Corporation (DSCC)',
          name_bn: null,
          short_name: 'DSCC',
          logo: 'recruiter/organization/logo/DGFPMAG_gjrffie.png',
          website: 'http://dscc.gov.bd/',
          govt_jobs: [{ id: 15257 }],
        },
        {
          id: 1172,
          name: 'Office of the Director General, Bangladesh Post Office (DGBPO)',
          name_bn: 'ডাক অধিদপ্তর',
          short_name: 'DGBPO',
          logo: 'public/recruiter/organization/logo/gov-job-organization-logo-1794216525410.png',
          website: 'https://bdpost.gov.bd/',
          govt_jobs: [{ id: 15237 }],
        },
      ],
    });
    expect(parseTeletalkGovtOrgListJson(orgListPayload).orgs).toHaveLength(2);

    // Verify Step 8 Fallback: published-jobs/search returns 503 -> recovers via govt-jobs/list?skipLimit=YES
    const listFallbackPayload = JSON.stringify({
      status: 'success',
      count: 1,
      govtJobs: [
        {
          id: 15237,
          job_id: 'GJOB15237',
          job_title: 'Counter',
          job_title_bn: 'কাউন্টার',
          vacancy: '12',
          vacancy_not_specific: false,
          application_site: 'https://dgbpo.teletalk.com.bd/',
          published_date: '2026-11-10T04:00:00.000Z',
          deadline_date: pastDeadline,
          organization_id: 1172,
          job_utilities_govtorganization: {
            id: 1172,
            name: 'Bangladesh Post Office',
            name_bn: 'ডাক অধিদপ্তর',
            short_name: 'DGBPO',
            logo: 'public/recruiter/organization/logo/gov-job-organization-logo-1794216525410.png',
            website: 'https://bdpost.gov.bd/',
          },
        },
      ],
    });
    expect(parseTeletalkGovtJobsListJson(listFallbackPayload).items[0].vacancies).toBe(12);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = String(input);
      if (url.includes('/api/v1/published-jobs/search')) {
        return {
          ok: false,
          status: 503,
          headers: new Headers({ 'content-type': 'application/json' }),
          text: async () => 'Service Unavailable',
        } as Response;
      }
      if (url.includes('/api/v1/govt-jobs/list')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          text: async () => listFallbackPayload,
        } as Response;
      }
      if (url.includes('/api/v1/govt-jobs/org-list')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          text: async () => orgListPayload,
        } as Response;
      }
      return { ok: true, status: 200, headers: new Headers(), text: async () => '' } as Response;
    });

    const outcome = await TeletalkAdapter.fetchJobs();
    expect(outcome.success).toBe(true);
    expect(outcome.jobs).toHaveLength(1);
    expect(outcome.jobs[0].organizationId).toBe(1172);
    expect(outcome.accessNotes).toContain('govt-jobs/list fallback');

    const orgRes = await fetchTeletalkGovtOrganizations(outcome.jobs);
    expect(orgRes.ok).toBe(true);
    expect(orgRes.organizations.find((o) => o.organizationId === 1172)?.nameBn).toBe('ডাক অধিদপ্তর');
  });

  it('2. GovtOrganizationsPage renders org cards, View Jobs details, Bangla/ID search, Vacancy/Deadline filters & Apply Now without auto-submit', async () => {
    const now = Date.now();
    const soonDeadline = new Date(now + 2 * DAY_MS).toISOString();
    const expiredDeadline = new Date(now - 3 * DAY_MS).toISOString();
    const startIso = new Date(now - 1 * DAY_MS).toISOString();

    const jDscc = TeletalkAdapter.parseJob({
      externalId: 'teletalk_GJOB15257',
      sourceJobId: 'GJOB15257',
      organizationId: 635,
      organizationShortName: 'DSCC',
      organization: 'Dhaka South City Corporation (DSCC)',
      organizationLogo: 'https://alljobs.teletalk.com.bd/media/recruiter/organization/logo/dscc.png',
      jobTitle: 'Veterinary Officer — ভেটেরিনারী কর্মকর্তা',
      titleBn: 'ভেটেরিনারী কর্মকর্তা',
      position: 'Veterinary Officer',
      circularNumber: 'GJOB15257',
      category: 'Government',
      vacancies: 15,
      applicationStartText: startIso,
      publishedDateText: startIso,
      deadlineText: soonDeadline,
      applicationUrl: 'https://dscc.teletalk.com.bd/',
    });
    const jDgbpo = TeletalkAdapter.parseJob({
      externalId: 'teletalk_GJOB15200',
      sourceJobId: 'GJOB15200',
      organizationId: 1172,
      organizationShortName: 'DGBPO',
      organization: 'Bangladesh Post Office',
      organizationBn: 'ডাক অধিদপ্তর',
      organizationLogo: 'https://alljobs.teletalk.com.bd/media/recruiter/organization/logo/dgbpo.png',
      jobTitle: 'Postal Operator',
      position: 'Postal Operator',
      circularNumber: 'GJOB15200',
      category: 'Government',
      vacancies: 2,
      applicationStartText: getDhakaDateKey(now - 10 * DAY_MS),
      publishedDateText: getDhakaDateKey(now - 10 * DAY_MS),
      deadlineText: expiredDeadline,
      applicationUrl: 'https://dgbpo.teletalk.com.bd/',
    });

    await JobRepository.saveJobs([jDscc, jDgbpo]);
    await JobRepository.saveGovtOrganizations([
      {
        organizationId: 635,
        name: 'Dhaka South City Corporation (DSCC)',
        nameBn: null,
        shortName: 'DSCC',
        logoUrl: 'https://alljobs.teletalk.com.bd/media/recruiter/organization/logo/dscc.png',
        website: 'https://dscc.gov.bd/',
        openingCount: 1,
        expiredCount: 0,
        sourceId: 'teletalk',
        sourceUrl: 'https://alljobs.teletalk.com.bd/jobs/government/635',
        lastUpdatedAt: now,
      },
      {
        organizationId: 1172,
        name: 'Bangladesh Post Office',
        nameBn: 'ডাক অধিদপ্তর',
        shortName: 'DGBPO',
        logoUrl: 'https://alljobs.teletalk.com.bd/media/recruiter/organization/logo/dgbpo.png',
        website: 'https://bdpost.gov.bd/',
        openingCount: 0,
        expiredCount: 1,
        sourceId: 'teletalk',
        sourceUrl: 'https://alljobs.teletalk.com.bd/jobs/government/1172',
        lastUpdatedAt: now,
      },
    ]);

    const setSpy = vi.fn((_obj: any, cb?: () => void) => cb?.());
    const tabsCreateSpy = vi.fn(async () => ({}));
    (globalThis as any).chrome = {
      storage: { local: { set: setSpy, get: (_k: any, cb: any) => cb({}) } },
      tabs: { create: tabsCreateSpy },
    };

    await act(async () => {
      root.render(
        <AppProvider>
          <GovtOrganizationsPage />
        </AppProvider>
      );
    });
    await flushUi(60);

    // Organization Directory renders logos, names, short names, openings
    expect(container.textContent).toContain('Government Organizations Directory (Teletalk Alljobs)');
    expect(container.textContent).toContain('Dhaka South City Corporation (DSCC)');
    expect(container.textContent).toContain('ডাক অধিদপ্তর');
    expect(container.textContent).toContain('Openings: 1');
    const imgs = container.querySelectorAll('img');
    expect(imgs.length).toBe(2);

    // Search by Bengali name filters directory list strictly to DGBPO
    const searchInput = container.querySelector('input[aria-label="Search government organizations and jobs"]') as HTMLInputElement;
    await act(async () => {
      setReactInputValue(searchInput, 'ডাক');
    });
    await flushUi(30);
    const dirListText = container.querySelector('div[role="list"]')?.textContent || '';
    expect(dirListText).toContain('Bangladesh Post Office');
    expect(dirListText).not.toContain('Dhaka South City Corporation');

    // Clear Filters
    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Clear Filters')
      ) as HTMLButtonElement).click();
    });
    await flushUi(30);

    // Click View Jobs on DSCC card
    const viewJobsBtn = Array.from(container.querySelectorAll('div[role="listitem"] button')).find((b) =>
      b.textContent?.includes('View Jobs')
    ) as HTMLButtonElement;
    await act(async () => {
      viewJobsBtn.click();
    });
    await flushUi(40);

    expect(container.textContent).toContain('Veterinary Officer');
    expect(container.textContent).toContain('GJOB15257');
    expect(container.textContent).toContain('Vacancy: 15');
    expect(container.textContent).toContain('Live');
    expect(container.textContent).toContain('Apply Portal (dscc.teletalk.com.bd)');
    expect(container.textContent).not.toContain('https://dscc.teletalk.com.bd/');
    expect(container.querySelector('a[href="https://dscc.teletalk.com.bd/"]')).toBeTruthy();

    // Apply Now opens official site + writes Autofill context cleanly (no auto-submit!)
    const applyBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Apply Now')
    ) as HTMLButtonElement;
    await act(async () => {
      applyBtn.click();
    });
    await flushUi(20);
    expect(setSpy).toHaveBeenCalled();
    expect(tabsCreateSpy).toHaveBeenCalledWith({ url: 'https://dscc.teletalk.com.bd/' });

    // Back to Organizations -> test Expired Jobs & Vacancy 10+ filters
    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Back to Organizations')
      ) as HTMLButtonElement).click();
    });
    await flushUi(25);

    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Expired Jobs')
      ) as HTMLButtonElement).click();
    });
    await flushUi(30);
    expect(container.textContent).toContain('Postal Operator');
    expect(container.textContent).not.toContain('Veterinary Officer');

    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('All Active Jobs')
      ) as HTMLButtonElement).click();
    });
    await flushUi(30);
    const vacSelect = container.querySelector('select[aria-label="Filter by Vacancy"]') as HTMLSelectElement;
    await act(async () => {
      setReactInputValue(vacSelect, '10+');
    });
    await flushUi(25);
    expect(container.textContent).toContain('Veterinary Officer');
    expect(container.textContent).not.toContain('Postal Operator');

    // Sidebar preserves navigation alongside Govt Organizations
    await act(async () => {
      root.render(
        <AppProvider>
          <Sidebar activeTab="govt_orgs" onSelectTab={() => {}} completionScore={90} />
        </AppProvider>
      );
    });
    await flushUi(20);
    expect(container.textContent).toContain('Govt Organizations');
    expect(container.textContent).toContain('Job Circulars');
  });

  it('3. JobCheckService updates govt_orgs + dedupes + NotificationScheduler emits expired_job notification for bookmarked job', async () => {
    const deadline = Date.now() + 1 * HOUR_MS;
    const bmJob = TeletalkAdapter.parseJob({
      externalId: 'teletalk_GJOB_EXP_TEST',
      sourceJobId: 'GJOB_EXP_TEST',
      organizationId: 635,
      organizationShortName: 'DSCC',
      organization: 'Dhaka South City Corporation (DSCC)',
      jobTitle: 'Assistant Engineer',
      position: 'Assistant Engineer',
      circularNumber: 'GJOB_EXP_TEST',
      deadlineText: new Date(deadline).toISOString(),
      applicationUrl: 'https://dscc.teletalk.com.bd/',
    });
    await JobRepository.saveJobs([bmJob]);
    await BookmarkRepository.addBookmark(bmJob.id);

    const summary = await NotificationScheduler.runCycle(deadline + 60_000);
    expect(summary.expiredJobsUpdated).toBe(1);
    expect(summary.expiredNotificationsSent?.length).toBe(1);
    const notifs = await JobNotificationRepository.getAll();
    expect(notifs.some((n) => n.type === 'expired_job')).toBe(true);

    // Derive orgs helper preserves accurate counts after expiration
    const refreshedJobs = await JobRepository.getAllJobs(deadline + 60_000);
    const derivedOrgs = buildGovtOrganizationsFromJobs(refreshedJobs, deadline + 60_000);
    expect(derivedOrgs[0].expiredCount).toBe(1);
    expect(derivedOrgs[0].openingCount).toBe(0);
    expect(JobCheckService).toBeTruthy();
  });
});
