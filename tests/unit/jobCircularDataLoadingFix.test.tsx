// JobFill BD - Root-Cause Investigation & Loading Recovery Test Suite
// Verifies IndexedDB onblocked recovery, chrome.storage lastError safety,
// OfficialWebsite MOPA HTML parsing, source failure isolation, offline/retry UI states,
// Source Health panel badges, search/filter/sort accuracy, and Apply Now integration.
// NOTE: Uses synthetic test fixtures only (never mixed with production circulars).

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IndexedDBManager } from '../../src/database/indexeddb';
import { kvStorage, JobRepository } from '../../src/jobs/database/job-repository';
import { BookmarkRepository } from '../../src/jobs/database/bookmark-repository';
import { ApplicationRepository } from '../../src/jobs/database/application-repository';
import { JobNotificationRepository } from '../../src/jobs/database/notification-repository';
import {
  OfficialWebsiteAdapter,
  parseBangladeshPortalNoticeTableHtml,
  parseDhakaUniversityNoticeLinks,
  parseNationalPortalJobTenderHtml,
} from '../../src/jobs/sources/national-portal';
import { BangladeshBankAdapter, parseBangladeshBankCareerHtml } from '../../src/jobs/sources/bangladesh-bank';
import { BpscAdapter, parseBpscNoticeTableHtml } from '../../src/jobs/sources/bpsc';
import { BdjobsAdapter, BDJOBS_COMMUNITY_EVALUATION } from '../../src/jobs/sources/bdjobs';
import { NtrcaAdapter, parseNtrcaNoticeTableHtml } from '../../src/jobs/sources/ntrca';
import { DpeAdapter, parseDpeNoticeTableHtml } from '../../src/jobs/sources/dpe';
import {
  TeletalkAdapter,
  parseTeletalkPublishedJobsJson,
  searchTeletalkPublishedJobs,
} from '../../src/jobs/sources/teletalk';
import { GoogleNewsDiscoveryAdapter } from '../../src/jobs/sources/google-news-discovery.adapter';
import { RemotiveAdapter, parseRemotiveApiJson } from '../../src/jobs/sources/remotive.adapter';
import { ReliefWebAdapter, parseReliefWebV2Json } from '../../src/jobs/sources/reliefweb.adapter';
import { JobCheckService } from '../../src/jobs/background/job-check-service';
import { JobCircularPage } from '../../src/jobs/dashboard/JobCircularPage';
import { AppProvider } from '../../src/dashboard/context/AppContext';
import { filterAndSortJobs, DEFAULT_JOB_FILTERS } from '../../src/jobs/dashboard/JobFilters';
import { deduplicateAndMergeJobs } from '../../src/jobs/services/job-deduplicator';
import { normalizeJobRecord } from '../../src/jobs/services/job-normalizer';
import { dhakaWallTimeToUtcMs } from '../../src/jobs/services/deadline-parser';

const FAKE_NOW = dhakaWallTimeToUtcMs(2026, 11, 10, 12, 0, 0);

async function flushUi(ms = 40) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

describe('JobFill BD - Job Circular Loading Fix, Resilience & Source Health Suite', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    localStorage.setItem('jobfill_language', 'en');
    IndexedDBManager.resetConnection();
    await JobRepository.clearAll();
    await BookmarkRepository.clearAll();
    await ApplicationRepository.clearAll();
    await JobNotificationRepository.clearAll();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    delete (globalThis as any).indexedDB;
    delete (globalThis as any).chrome;
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    IndexedDBManager.resetConnection();
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('1. Recovers cleanly from IndexedDB onblocked upgrade hang instead of stalling forever', async () => {
    vi.useFakeTimers();
    const fakeReq: any = {
      onupgradeneeded: null,
      onblocked: null,
      onsuccess: null,
      onerror: null,
    };
    (globalThis as any).indexedDB = {
      open: vi.fn(() => {
        setTimeout(() => {
          fakeReq.onblocked?.(new Event('blocked'));
        }, 10);
        return fakeReq;
      }),
    };

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const pendingDb = IndexedDBManager.getDB();
    const rejectionAssertion = expect(pendingDb).rejects.toThrow('INDEXEDDB_OPEN_BLOCKED');

    await vi.advanceTimersByTimeAsync(1600);
    await rejectionAssertion;
    expect(warnSpy).toHaveBeenCalled();

    vi.useRealTimers();
    delete (globalThis as any).indexedDB;

    // Repository falls back gracefully and resolves without hanging JobCircularPage
    const jobs = await JobRepository.getAllJobs();
    expect(Array.isArray(jobs)).toBe(true);
  });

  it('2. kvStorage.get handles chrome.runtime.lastError & undefined callback result without hanging forever', async () => {
    (globalThis as any).chrome = {
      runtime: { lastError: { message: 'Storage IPC busy' } },
      storage: {
        local: {
          get: (_keys: string[], cb: (res: any) => void) => {
            cb(undefined);
          },
          set: (_items: Record<string, any>, cb: () => void) => cb(),
        },
      },
    };

    const result = await kvStorage.get('jobfill_source_outcomes_v1', []);
    expect(result).toEqual([]);
  });

  it('3. OfficialWebsiteAdapter parses synthetic MOPA recruitment table rows without inventing deadlines', () => {
    const html = `
      <table>
        <tbody class="table-tbody">
          <tr class="table-tr">
            <td data-column="title">জনপ্রশাসন মন্ত্রণালয়ের অফিস সহায়ক পদের নিয়োগ বিজ্ঞপ্তি প্রকাশ</td>
            <td data-column="memorial_no">05.00.0000.110.11.001.26-44</td>
            <td data-column="files"><a href="/uploads/mopa_office_assistant.pdf">PDF</a></td>
            <td data-column="publish_date">০৫-১১-২০২৬</td>
          </tr>
          <tr class="table-tr">
            <td data-column="title">Training Workshop Notice Only</td>
            <td data-column="files"></td>
            <td data-column="publish_date">০৩-১১-২০২৬</td>
          </tr>
        </tbody>
      </table>
    `;

    const extracted = parseBangladeshPortalNoticeTableHtml(html, {
      idPrefix: 'mopa',
      organization: 'Ministry of Public Administration (MOPA)',
      baseUrl: 'https://mopa.gov.bd',
      pageUrl: 'https://mopa.gov.bd/pages/notices',
      recruitmentPattern: /নিয়োগ|নিয়োগ|বিজ্ঞপ্তি|সার্কুলার/i,
    });

    expect(extracted.length).toBe(1);
    expect(extracted[0].circularUrl).toBe('https://mopa.gov.bd/uploads/mopa_office_assistant.pdf');
    expect(extracted[0].publishedDateText).toBe('০৫-১১-২০২৬');
    expect(extracted[0].deadlineText).toBeUndefined();
  });

  it('4. Source adapters operate independently and failed sources never block working sources in JobCheckService', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = String(input);
      if (url.includes('erecruitment.bb.org.bd')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => `
            <table><tbody><tr>
              <td>901</td><td>Synthetic Test AD Post</td><td>15</td><td>22000</td>
              <td>01/11/2026</td><td>Masters</td><td>200</td><td>25/11/2026</td>
            </tr></tbody></table>`,
        } as Response;
      }
      if (url.includes('news.google.com')) {
        throw new Error('Synthetic RSS outage');
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: async () => '<html><body><div id="root"></div></body></html>',
      } as Response;
    });

    const report = await JobCheckService.runFullCheck();
    expect(report.totalStoredJobs).toBe(1);
    expect(report.newJobsCount).toBe(1);

    const outcomes = await JobRepository.getSourceOutcomes();
    const bbOutcome = outcomes.find((o) => o.sourceId === 'bangladesh_bank');
    const rssOutcome = outcomes.find((o) => o.sourceId === 'google_news_discovery');

    expect(bbOutcome?.connectionStatus).toBe('Working');
    expect(bbOutcome?.jobCount).toBe(2);
    expect(bbOutcome?.savedCount).toBe(1);
    expect(rssOutcome?.connectionStatus).toBe('Failed');
    expect(rssOutcome?.error).toContain('Synthetic RSS outage');

    // Verify re-running prevents duplicates
    const secondReport = await JobCheckService.runFullCheck();
    expect(secondReport.newJobsCount).toBe(0);
    expect(secondReport.totalStoredJobs).toBe(1);
  });

  it('5. All 6 registered adapters verify cleanly in isolation without cross-contamination', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = String(input);
      if (url.includes('bdjobs-home-static/GovtJobs.json')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          text: async () => JSON.stringify([{ CompanyName: 'Synthetic Ministry Org', JobTitle: 'Assistant Officer', JP_ID: 777111 }]),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: async () => '<html><body><div id="root"></div></body></html>',
      } as Response;
    });

    expect((await BdjobsAdapter.fetchJobs()).jobs.length).toBe(1);
    expect((await TeletalkAdapter.fetchJobs()).success).toBe(true);
    expect((await BpscAdapter.fetchJobs()).success).toBe(true);
    expect((await OfficialWebsiteAdapter.fetchJobs()).success).toBe(true);
    expect((await BangladeshBankAdapter.fetchJobs()).success).toBe(true);
    expect((await GoogleNewsDiscoveryAdapter.fetchJobs()).jobs.length).toBe(0);

    // Bengali-only titles without ASCII memorial numbers must keep unique IDs and never collapse into 1
    const bn1 = BpscAdapter.parseJob(
      {
        externalId: 'bpsc_০৫-১১-২০২৬_প্রথম সার্কুলার',
        organization: 'Bangladesh Public Service Commission (BPSC)',
        jobTitle: 'প্রথম বাংলা নিয়োগ বিজ্ঞপ্তি',
        position: 'সহকারী পরিচালক',
        circularUrl: 'https://bpsc.gov.bd/pages/notices',
        applicationUrl: 'https://bpsc.teletalk.com.bd/',
      },
      FAKE_NOW
    );
    const bn2 = BpscAdapter.parseJob(
      {
        externalId: 'bpsc_০৫-১১-২০২৬_দ্বিতীয় সার্কুলার',
        organization: 'Bangladesh Public Service Commission (BPSC)',
        jobTitle: 'দ্বিতীয় বাংলা নিয়োগ বিজ্ঞপ্তি',
        position: 'উপসহকারী প্রকৌশলী',
        circularUrl: 'https://bpsc.gov.bd/pages/notices',
        applicationUrl: 'https://bpsc.teletalk.com.bd/',
      },
      FAKE_NOW
    );
    expect(bn1.id).not.toBe(bn2.id);
    const dedupCheck = deduplicateAndMergeJobs([], [bn1, bn2], FAKE_NOW);
    expect(dedupCheck.mergedJobs.length).toBe(2);
  });

  it('6. JobCircularPage shows Offline state + Retry button cleanly without getting stuck loading forever', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });

    await act(async () => {
      root.render(
        <AppProvider>
          <JobCircularPage />
        </AppProvider>
      );
    });
    await flushUi();

    const text = container.textContent || '';
    expect(text).not.toContain('Loading job circulars...');
    expect(text).toContain('Offline Mode Detected');
    expect(text).toContain('Retry');
  });

  it('7. JobCircularPage recovers cleanly after Fetch Failure -> Retry -> Working Sync & renders Sources Health Panel', async () => {
    // 1st render: simulate stored failed source outcomes
    await JobRepository.saveSourceOutcomes([
      {
        sourceId: 'bangladesh_bank',
        sourceName: 'Bangladesh Bank Recruitment',
        compatibilityStatus: 'unavailable',
        connectionStatus: 'Failed',
        success: false,
        jobCount: 0,
        savedCount: 0,
        checkedAt: Date.now(),
        accessNotes: 'Portal timeout',
        directPortalUrl: 'https://erecruitment.bb.org.bd/',
        error: 'Request timed out',
      },
    ]);

    await act(async () => {
      root.render(
        <AppProvider>
          <JobCircularPage />
        </AppProvider>
      );
    });
    await flushUi();

    expect(container.textContent).toContain('Failed to Load Job Circulars');
    expect(container.textContent).toContain('Retry');

    // Now mock successful fetch and click Retry
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = String(input);
      if (url.includes('erecruitment.bb.org.bd')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => `
            <table><tbody><tr>
              <td>505</td><td>Synthetic Retried Position</td><td>10</td><td>22000</td>
              <td>10/11/2026</td><td>Bachelor</td><td>200</td><td>28/11/2026</td>
            </tr></tbody></table>`,
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: async () => '<html><body><div id="root"></div></body></html>',
      } as Response;
    });

    const retryBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Retry')
    );
    expect(retryBtn).toBeTruthy();

    await act(async () => {
      retryBtn!.click();
    });
    await flushUi(120);

    expect(container.textContent).toContain('Synthetic Retried Position');

    // Open Sources Status panel & check Successful / Retrieved / Saved fields
    const sourcesBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Sources Status')
    );
    await act(async () => {
      sourcesBtn!.click();
    });
    await flushUi();

    const panelText = container.textContent || '';
    expect(panelText).toContain('Official Sources & Health Status');
    expect(panelText).toContain('Successful');
    expect(panelText).toContain('Retrieved:');
    expect(panelText).toContain('Saved:');
  });

  it('8. Search, Category, Education, Job Type, Deadline (including Closing Soon), Location, Bookmarked, Sort & Apply Now work accurately', async () => {
    const j1 = normalizeJobRecord(
      {
        externalId: 's_1',
        organization: 'Synthetic Bank Org',
        jobTitle: 'Assistant Director',
        position: 'Assistant Director',
        circularNumber: 'CIR-100',
        category: 'Bank',
        employmentType: 'Full Time',
        qualification: 'Masters',
        location: 'Dhaka',
        publishedDateText: '2026-11-08',
        deadlineText: '2026-11-12', // within 7 days -> closing_soon
        applicationUrl: 'https://erecruitment.bb.org.bd/onlineapp/joblist.php',
      },
      { sourceId: 'bangladesh_bank', sourceName: 'Bangladesh Bank Recruitment', verificationLevel: 'official_verified', checkedAt: FAKE_NOW, defaultApplicationUrl: 'https://erecruitment.bb.org.bd/' }
    );
    const j2 = normalizeJobRecord(
      {
        externalId: 's_2',
        organization: 'Synthetic Health Clinic',
        jobTitle: 'Senior Nurse',
        position: 'Senior Nurse',
        circularNumber: 'CIR-202',
        category: 'Healthcare',
        employmentType: 'Contractual',
        qualification: 'Diploma',
        location: 'Rajshahi',
        publishedDateText: '2026-10-01',
        deadlineText: '2026-10-20', // expired
        applicationUrl: 'https://health.gov.bd/apply',
      },
      { sourceId: 'manual', sourceName: 'Manual Entry', verificationLevel: 'user_submitted', checkedAt: FAKE_NOW, defaultApplicationUrl: 'https://health.gov.bd/' }
    );

    const bmSet = new Set([j1.id]);

    expect(filterAndSortJobs([j1, j2], { ...DEFAULT_JOB_FILTERS, query: 'CIR-100' }, bmSet, FAKE_NOW).length).toBe(1);
    expect(filterAndSortJobs([j1, j2], { ...DEFAULT_JOB_FILTERS, query: 'Masters' }, bmSet, FAKE_NOW).length).toBe(1);
    expect(filterAndSortJobs([j1, j2], { ...DEFAULT_JOB_FILTERS, category: 'Healthcare' }, bmSet, FAKE_NOW).length).toBe(1);
    expect(filterAndSortJobs([j1, j2], { ...DEFAULT_JOB_FILTERS, education: 'Diploma' }, bmSet, FAKE_NOW).length).toBe(1);
    expect(filterAndSortJobs([j1, j2], { ...DEFAULT_JOB_FILTERS, employmentType: 'Contractual' }, bmSet, FAKE_NOW).length).toBe(1);
    expect(filterAndSortJobs([j1, j2], { ...DEFAULT_JOB_FILTERS, deadline: 'closing_soon' }, bmSet, FAKE_NOW).map((j) => j.id)).toEqual([j1.id]);
    expect(filterAndSortJobs([j1, j2], { ...DEFAULT_JOB_FILTERS, deadline: 'expired' }, bmSet, FAKE_NOW).map((j) => j.id)).toEqual([j2.id]);
    expect(filterAndSortJobs([j1, j2], { ...DEFAULT_JOB_FILTERS, location: 'Rajshahi' }, bmSet, FAKE_NOW).map((j) => j.id)).toEqual([j2.id]);
    expect(filterAndSortJobs([j1, j2], { ...DEFAULT_JOB_FILTERS, bookmarkedOnly: true }, bmSet, FAKE_NOW).map((j) => j.id)).toEqual([j1.id]);
    expect(filterAndSortJobs([j1, j2], DEFAULT_JOB_FILTERS, bmSet, FAKE_NOW).length).toBe(2);

    // Apply Now saves context & opens actual applicationUrl (never auto-submits)
    const setSpy = vi.fn();
    const tabsCreateSpy = vi.fn(async () => ({}));
    (globalThis as any).chrome = {
      storage: { local: { set: setSpy, get: (_k: any, cb: any) => cb({}) } },
      tabs: { create: tabsCreateSpy },
    };

    await JobRepository.saveJobs([j1, j2]);
    await act(async () => {
      root.render(
        <AppProvider>
          <JobCircularPage />
        </AppProvider>
      );
    });
    await flushUi();

    const applyBtns = Array.from(container.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('Apply Now')
    );
    expect(applyBtns.length).toBe(2);

    await act(async () => {
      applyBtns[0].click();
    });
    await flushUi();

    expect(setSpy).toHaveBeenCalled();
    expect(tabsCreateSpy).toHaveBeenCalledWith({
      url: 'https://erecruitment.bb.org.bd/onlineapp/joblist.php',
    });
  });

  it('9. RemotiveAdapter parses public REST JSON without inventing deadlines and respects Settings opt-out', async () => {
    const sampleJson = JSON.stringify({
      jobs: [
        {
          id: 9901,
          url: 'https://remotive.com/remote-jobs/software-dev/backend-engineer-9901',
          title: 'Senior TypeScript Engineer',
          company_name: 'Synthetic Cloud Ltd',
          category: 'Software Development',
          job_type: 'full_time',
          publication_date: '2026-11-09T10:30:00',
          candidate_required_location: 'Worldwide',
          salary: '$60k - $80k',
          description: '<p>Remote backend role.</p>',
        },
      ],
    });

    const parsed = parseRemotiveApiJson(sampleJson);
    expect(parsed.length).toBe(1);
    expect(parsed[0].deadlineText).toBeUndefined();
    expect(parsed[0].publishedDateText).toBe('2026-11-09');
    expect(parsed[0].category).toBe('IT / Technology');

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => sampleJson,
    } as Response);

    const enabledRes = await RemotiveAdapter.fetchJobs();
    expect(enabledRes.success).toBe(true);
    expect(enabledRes.connectionStatus).toBe('Working');
    expect(enabledRes.jobs.length).toBe(1);

    await JobRepository.savePreferences({ enableRemotiveSource: false });
    const disabledRes = await RemotiveAdapter.fetchJobs();
    expect(disabledRes.success).toBe(true);
    expect(disabledRes.connectionStatus).toBe('Not Implemented');
    expect(disabledRes.jobs.length).toBe(0);
  });

  it('10. ReliefWebAdapter guides user when appname is unset and parses verified v2 API closing dates when configured', async () => {
    const unconfigured = await ReliefWebAdapter.fetchJobs();
    expect(unconfigured.success).toBe(true);
    expect(unconfigured.connectionStatus).toBe('Not Implemented');
    expect(unconfigured.jobs.length).toBe(0);

    const v2Json = JSON.stringify({
      data: [
        {
          id: 400123,
          fields: {
            title: 'WASH Programme Officer (Cox’s Bazar)',
            url: 'https://reliefweb.int/job/400123/wash-programme-officer',
            date: {
              created: '2026-11-08T00:00:00+00:00',
              closing: '2026-11-25T23:59:59+00:00',
            },
            source: [{ name: 'Synthetic UN Agency' }],
            city: [{ name: 'Chattogram' }],
          },
        },
      ],
    });

    const rawRw = parseReliefWebV2Json(v2Json);
    expect(rawRw.length).toBe(1);
    expect(rawRw[0].organization).toBe('Synthetic UN Agency');

    await JobRepository.savePreferences({ reliefwebAppName: 'synthetic-app-id' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => v2Json,
    } as Response);

    const rwRes = await ReliefWebAdapter.fetchJobs();
    expect(rwRes.success).toBe(true);
    expect(rwRes.connectionStatus).toBe('Working');
    expect(rwRes.jobs.length).toBe(1);
    expect(rwRes.jobs[0].deadlineVerified).toBe(true);
    expect(rwRes.jobs[0].category).toBe('NGO');
  });

  it('11. OfficialWebsiteAdapter isolates unreachable directorates while extracting live National Portal notices', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = String(input);
      if (url.includes('dshe.gov.bd')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => `
            <table><tbody class="table-tbody"><tr class="table-tr">
              <td data-column="title">মাউশি প্রদর্শক পদে নিয়োগ বিজ্ঞপ্তি প্রকাশ</td>
              <td data-column="files"><a href="/uploads/dshe_job.pdf">PDF</a></td>
              <td data-column="publish_date">০৫-১১-২০২৬</td>
            </tr></tbody></table>`,
        } as Response;
      }
      throw new Error('Synthetic timeout');
    });

    const outcome = await OfficialWebsiteAdapter.fetchJobs();
    expect(outcome.success).toBe(true);
    expect(outcome.connectionStatus).toBe('Partially Working');
    expect(outcome.jobs.length).toBe(1);
    expect(outcome.jobs[0].circularUrl).toBe('https://dshe.gov.bd/uploads/dshe_job.pdf');
  });

  it('12. Teletalk hybrid JSON endpoint parser preserves job IDs, bilingual titles, vacancies, deadlines, logos, and omits 0 salary', async () => {
    const mockApiJson = JSON.stringify({
      status: 'success',
      statusCode: 200,
      count: 25,
      govtJobs: [
        {
          job_primary_id: 15257,
          job_title: 'Veterinary Officer',
          job_title_bn: 'ভেটেরিনারী কর্মকর্তা',
          job_id: 'GJOB15257',
          vacancy: '06',
          vacancy_not_specific: false,
          application_site_url: 'https://dscc.teletalk.com.bd/',
          published_date: '2026-11-11T04:00:00.000Z',
          deadline_date: '2026-12-02T11:00:00.000Z',
          job_location: '',
          salary: 0,
          org_name: 'Dhaka South City Corporation (DSCC)',
          org_name_bn: null,
          logo: 'recruiter/organization/logo/DGFPMAG_gjrffie.png',
          website: 'http://dscc.gov.bd/',
        },
      ],
    });

    const parsed = parseTeletalkPublishedJobsJson(mockApiJson);
    expect(parsed.ok).toBe(true);
    expect(parsed.totalCount).toBe(25);
    expect(parsed.items.length).toBe(1);
    expect(parsed.items[0].circularNumber).toBe('GJOB15257');
    expect(parsed.items[0].vacancies).toBe(6);
    expect(parsed.items[0].salary).toBeUndefined(); // must never emit "0"
    expect(parsed.items[0].organizationLogo).toBe('https://alljobs.teletalk.com.bd/media/recruiter/organization/logo/DGFPMAG_gjrffie.png');

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const u = String(input);
      if (u.includes('page=2')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          text: async () =>
            JSON.stringify({
              status: 'success',
              count: 25,
              govtJobs: [
                {
                  job_primary_id: 15200,
                  job_title: 'Assistant Engineer',
                  job_id: 'GJOB15200',
                  vacancy: '02',
                  vacancy_not_specific: false,
                  application_site_url: 'https://fri.teletalk.com.bd/',
                  published_date: '2026-11-08T04:00:00.000Z',
                  deadline_date: '2026-11-28T11:00:00.000Z',
                  salary: 22000,
                  org_name: 'Bangladesh Fisheries Research Institute',
                  org_name_bn: 'বাংলাদেশ মৎস্য গবেষণা ইনস্টিটিউট',
                },
              ],
            }),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => mockApiJson,
      } as Response;
    });

    const outcome = await TeletalkAdapter.fetchJobs();
    expect(outcome.success).toBe(true);
    expect(outcome.connectionStatus).toBe('Working');
    expect(outcome.jobs.length).toBe(2);
    expect(outcome.jobs[0].deadlineVerified).toBe(true);
    expect(outcome.jobs[0].sourceVerification).toBe('official_partial');

    const keywordSearch = await searchTeletalkPublishedJobs('Veterinary', 1);
    expect(keywordSearch.ok).toBe(true);
    expect(keywordSearch.jobs[0].applicationUrl).toBe('https://dscc.teletalk.com.bd/');
  });

  it('13. TeletalkAdapter falls back cleanly to SPA portal reachability when undocumented JSON endpoint returns 403', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const u = String(input);
      if (u.includes('/api/v1/published-jobs/search')) {
        return {
          ok: false,
          status: 403,
          headers: new Headers({ 'content-type': 'application/json' }),
          text: async () => '{"message":"Forbidden"}',
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: async () => '<html><body><div id="root"></div></body></html>',
      } as Response;
    });

    const outcome = await TeletalkAdapter.fetchJobs();
    expect(outcome.success).toBe(true);
    expect(outcome.connectionStatus).toBe('Partially Working');
    expect(outcome.jobs.length).toBe(0);
  });

  it('14. parseDhakaUniversityNoticeLinks extracts recruitment notices only and ignores admission/convocation circulars', () => {
    const duHtml = `
      <div>
        <a href="https://www.du.ac.bd/du_post_details/prob-admission/101">এমফিল ভর্তি বিজ্ঞপ্তি</a>
        <a href="https://www.du.ac.bd/du_post_details/lecturer-cse-recruitment/102">Lecturer in CSE নিয়োগ বিজ্ঞপ্তি</a>
      </div>
    `;
    const parsed = parseDhakaUniversityNoticeLinks(duHtml);
    expect(parsed.length).toBe(1);
    expect(parsed[0].category).toBe('University');
    expect(parsed[0].circularUrl).toBe('https://www.du.ac.bd/du_post_details/lecturer-cse-recruitment/102');
  });

  it('15. National Portal job-tender-announcements strictly keeps category=job and excludes tenders', () => {
    const npHtml = `
      <table><tbody class="table-tbody">
        <tr class="table-tr">
          <td data-column="title">সহকারী প্রোগ্রামার পদে নিয়োগ বিজ্ঞপ্তি</td>
          <td data-column="category"><span>job</span></td>
          <td data-column="files"><a href="https://objectstorage.example.test/job.pdf">PDF</a></td>
          <td data-column="start_date"><span>০১-১১-২০২৬ ১২:০০ am</span></td>
          <td data-column="end_date"><span>২৫-১১-২০২৬ ১১:৫৯ pm</span></td>
          <td><a href="/pages/job-tender-announcements/job-101">দেখুন</a></td>
        </tr>
        <tr class="table-tr">
          <td data-column="title">Purchase of Office Printer Equipment Tender</td>
          <td data-column="category"><span>tender</span></td>
          <td data-column="files"><a href="https://objectstorage.example.test/tender.pdf">PDF</a></td>
          <td data-column="start_date"><span>০১-১১-২০২৬ ১২:০০ am</span></td>
          <td data-column="end_date"><span>২৫-১১-২০২৬ ১১:৫৯ pm</span></td>
          <td><a href="/pages/job-tender-announcements/tender-202">দেখুন</a></td>
        </tr>
      </tbody></table>
    `;
    const items = parseNationalPortalJobTenderHtml(npHtml);
    expect(items.length).toBe(1);
    expect(items[0].jobTitle).toContain('সহকারী প্রোগ্রামার');
    expect(items[0].circularUrl).toBe('https://objectstorage.example.test/job.pdf');
    expect(items[0].sourceUrl).toBe('https://bangladesh.gov.bd/pages/job-tender-announcements/job-101');

    const job = OfficialWebsiteAdapter.parseJob(items[0], FAKE_NOW);
    expect(job.deadlineVerified).toBe(true);
    expect(job.sourceJobId).toBe('job-101');
  });

  it('16. NTRCA & DPE parsers extract recruitment circulars only and ignore administrative/hearing/mourning notices', () => {
    const ntrcaHtml = `
      <table><tbody class="table-tbody">
        <tr class="table-tr">
          <td data-column="title">শুনানীতে অংশগ্রহন প্রসঙ্গে। (১৩৩৬)</td>
          <td data-column="files"><a href="https://objectstorage.example.test/hearing.pdf">PDF</a></td>
          <td data-column="publish_date">০৮-১১-২০২৬</td>
        </tr>
        <tr class="table-tr">
          <td data-column="title">৬ষ্ঠ গণবিজ্ঞপ্তি ও এনটিআরসিএ শিক্ষক নিয়োগ বিজ্ঞপ্তি প্রকাশ</td>
          <td data-column="files"><a href="https://objectstorage.example.test/ntrca_rec.pdf">PDF</a></td>
          <td data-column="publish_date">০৪-১১-২০২৬</td>
          <td><a href="/pages/notices/ntrca-6">দেখুন</a></td>
        </tr>
      </tbody></table>
    `;
    const ntrcaItems = parseNtrcaNoticeTableHtml(ntrcaHtml);
    expect(ntrcaItems.length).toBe(1);
    expect(ntrcaItems[0].applicationUrl).toBe('https://ntrcar.teletalk.com.bd/');
    const ntrcaJob = NtrcaAdapter.parseJob(ntrcaItems[0], FAKE_NOW);
    expect(ntrcaJob.category).toBe('Teaching');

    const dpeHtml = `
      <table><tbody class="table-tbody">
        <tr class="table-tr">
          <td data-column="title">রাষ্ট্রীয় শোক পালন প্রজ্ঞাপন</td>
          <td data-column="files"><a href="https://objectstorage.example.test/admin.pdf">PDF</a></td>
          <td data-column="publish_date">০১-১১-২০২৬</td>
        </tr>
        <tr class="table-tr">
          <td data-column="title">সরকারি প্রাথমিক বিদ্যালয়ে সহকারী শিক্ষক নিয়োগ লিখিত পরীক্ষা সংক্রান্ত বিজ্ঞপ্তি</td>
          <td data-column="files"><a href="https://objectstorage.example.test/dpe_job.pdf">PDF</a></td>
          <td data-column="publish_date">০৩-১১-২০২৬</td>
          <td><a href="/pages/notices/dpe-1">দেখুন</a></td>
        </tr>
      </tbody></table>
    `;
    const dpeItems = parseDpeNoticeTableHtml(dpeHtml);
    expect(dpeItems.length).toBe(1);
    const dpeJob = DpeAdapter.parseJob(dpeItems[0], FAKE_NOW);
    expect(dpeJob.category).toBe('Teaching');
  });

  it('17. BangladeshBank excludes financial policy circulars and BPSC excludes ex-Bangladesh leave memos', () => {
    const bbHtml = `
      <table><tbody>
        <tr>
          <td>101</td><td>BRPD Circular</td><td>Revised Monetary Policy Interest Rate Directive</td>
          <td><a href="policy.pdf">PDF</a></td><td>05/11/2026</td><td>15/11/2026</td>
        </tr>
        <tr>
          <td>320</td><td>Advertisement</td><td>Senior Officer Recruitment Circular</td>
          <td><a href="so_recruit.pdf">PDF</a></td><td>05/11/2026</td><td>25/11/2026</td>
        </tr>
      </tbody></table>
    `;
    const bbItems = parseBangladeshBankCareerHtml(bbHtml);
    expect(bbItems.length).toBe(1);
    expect(bbItems[0].position).toBe('Senior Officer Recruitment Circular');

    const bpscHtml = `
      <table><tbody class="table-tbody">
        <tr class="table-tr">
          <td data-column="title">Notification regarding ex-Bangladesh leave of Member</td>
          <td data-column="files"><a href="/leave.pdf">PDF</a></td>
          <td data-column="publish_date">০২-১১-২০২৬</td>
        </tr>
        <tr class="table-tr">
          <td data-column="title">৪৯তম বিসিএস নিয়োগ বিজ্ঞপ্তি</td>
          <td data-column="files"><a href="/49bcs.pdf">PDF</a></td>
          <td data-column="publish_date">০৫-১১-২০২৬</td>
        </tr>
      </tbody></table>
    `;
    const bpscItems = parseBpscNoticeTableHtml(bpscHtml, 'https://bpsc.gov.bd/pages/notices');
    expect(bpscItems.length).toBe(1);
    expect(bpscItems[0].jobTitle).toContain('৪৯তম বিসিএস');
  });

  it('18. Bdjobs third-party Apify scrapers remain disabled without approval & sourceJobId prevents cross-sync duplicates', () => {
    expect(BDJOBS_COMMUNITY_EVALUATION.evaluatedThirdPartyServices.every((s) => s.activated === false)).toBe(true);
    expect(BdjobsAdapter.publisherType).toBe('Third-Party');

    const existing = normalizeJobRecord(
      {
        externalId: 'sj_test',
        sourceJobId: 'GJOB15257',
        organization: 'DSCC',
        jobTitle: 'Veterinary Officer',
        applicationUrl: 'https://dscc.teletalk.com.bd/',
      },
      { sourceId: 'teletalk', sourceName: 'Teletalk All Jobs', verificationLevel: 'official_partial', checkedAt: FAKE_NOW, defaultApplicationUrl: 'https://alljobs.teletalk.com.bd/' }
    );
    const incomingSameSourceJobId = normalizeJobRecord(
      {
        externalId: 'sj_renamed_variant',
        sourceJobId: 'GJOB15257',
        organization: 'DSCC Revised',
        jobTitle: 'Veterinary Officer (Updated)',
        deadlineText: '2026-12-05',
        applicationUrl: 'https://dscc.teletalk.com.bd/',
      },
      { sourceId: 'teletalk', sourceName: 'Teletalk All Jobs', verificationLevel: 'official_partial', checkedAt: FAKE_NOW, defaultApplicationUrl: 'https://alljobs.teletalk.com.bd/' }
    );
    const merged = deduplicateAndMergeJobs([existing], [incomingSameSourceJobId], FAKE_NOW);
    expect(merged.mergedJobs.length).toBe(1);
    expect(merged.mergedJobs[0].deadlineVerified).toBe(true);
  });
});
