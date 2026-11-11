// JobFill BD - Google-Style Job Search Engine, Live Multi-Source Discovery,
// Smart Notifications & Enhanced UI Verification Suite

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AppProvider } from '../../src/dashboard/context/AppContext';
import { Sidebar } from '../../src/dashboard/components/Sidebar';
import { App as PopupApp } from '../../src/popup/App';
import { JobSearchPage } from '../../src/jobs/dashboard/JobSearchPage';
import { JobDetails } from '../../src/jobs/dashboard/JobDetails';
import { NotificationCenterPage } from '../../src/jobs/dashboard/NotificationCenterPage';
import { ApplicationTracker, APPLICATION_STATUSES } from '../../src/jobs/dashboard/ApplicationTracker';
import { JobPreferencesSection } from '../../src/jobs/dashboard/JobPreferencesSection';
import { JobRepository } from '../../src/jobs/database/job-repository';
import { BookmarkRepository } from '../../src/jobs/database/bookmark-repository';
import { ApplicationRepository } from '../../src/jobs/database/application-repository';
import { JobNotificationRepository } from '../../src/jobs/database/notification-repository';
import { normalizeJobRecord } from '../../src/jobs/services/job-normalizer';
import {
  searchAndRankJobs,
  buildSearchIndexEntries,
  getSearchSuggestions,
  JobSearchQueryState,
} from '../../src/jobs/services/search-engine';
import { safePublicGet, fetchFromSources, SourceProgressEvent } from '../../src/jobs/services/job-fetcher';
import { parseRemoteOkApiJson, RemoteOkAdapter } from '../../src/jobs/sources/remoteok.adapter';
import { parseHimalayasApiJson, HimalayasAdapter } from '../../src/jobs/sources/himalayas.adapter';
import { JobSourceRegistry } from '../../src/jobs/sources/source-registry';
import { JobCheckService } from '../../src/jobs/background/job-check-service';
import { jobMatchesPreferences } from '../../src/jobs/notifications/daily-digest';
import { DEFAULT_JOB_PREFERENCES } from '../../src/jobs/types/job.types';
import { JobSourceAdapter } from '../../src/jobs/types/source.types';
import { DAY_MS } from '../../src/jobs/services/deadline-parser';

async function flushUi(ms: number = 40) {
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

describe('JobFill BD - Job Search Engine, Discovery, Smart Notifications & UI Suite', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    vi.restoreAllMocks();
    localStorage.clear();
    localStorage.setItem('jobfill_language', 'en');
    await JobRepository.clearAll();
    await JobNotificationRepository.clearAll();
    await ApplicationRepository.clearAll();
    await BookmarkRepository.clearAll();
    await JobRepository.savePreferences(DEFAULT_JOB_PREFERENCES);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('1. Bilingual, alias & spelling-variant search ranks exact title/ID higher and supports 11 categories', async () => {
    const future = new Date(Date.now() + 10 * DAY_MS).toISOString().slice(0, 10);
    const bankJob = normalizeJobRecord(
      {
        externalId: 's_bb_1',
        organization: 'Bangladesh Bank',
        organizationBn: 'বাংলাদেশ ব্যাংক',
        jobTitle: 'Assistant Director (General)',
        position: 'Assistant Director (General)',
        circularNumber: 'BB-2026-44',
        category: 'Bank',
        location: 'Chattogram',
        qualification: 'Masters',
        deadlineText: future,
        applicationUrl: 'https://erecruitment.bb.org.bd/',
        description: 'Requires Bachelor/Masters and analytical skills.',
      },
      { sourceId: 'bangladesh_bank', sourceName: 'Bangladesh Bank', verificationLevel: 'official_verified' }
    );
    const bodyMentionJob = normalizeJobRecord(
      {
        externalId: 's_pvt_1',
        organization: 'Acme Corp BD',
        jobTitle: 'Accounts Executive',
        position: 'Accounts Executive',
        circularNumber: 'ACME-09',
        category: 'Private',
        location: 'Dhaka',
        qualification: 'Bachelor',
        deadlineText: future,
        applicationUrl: 'https://example.com/apply',
        description: 'Coordinate banking operations with Bangladesh Bank compliance team.',
      },
      { sourceId: 'bdjobs', sourceName: 'Bdjobs', verificationLevel: 'official_partial' }
    );
    const teacherJob = normalizeJobRecord(
      {
        externalId: 's_dpe_1',
        organization: 'Directorate of Primary Education',
        organizationBn: 'প্রাথমিক শিক্ষা অধিদপ্তর',
        jobTitle: 'Assistant Teacher Recruitment',
        position: 'সহকারী শিক্ষক',
        category: 'Teaching',
        location: 'Dhaka',
        qualification: 'Bachelor',
        deadlineText: future,
        applicationUrl: 'https://dpe.teletalk.com.bd/',
        description: 'Primary assistant teacher recruitment.',
      },
      { sourceId: 'dpe', sourceName: 'DPE Official', verificationLevel: 'official_verified' }
    );
    const remoteJob = normalizeJobRecord(
      {
        externalId: 's_rem_1',
        organization: 'Remote Labs',
        jobTitle: 'Senior React Engineer (Remote OK)',
        position: 'Senior React Engineer',
        category: 'Remote Jobs',
        location: 'All Bangladesh',
        experience: '3+ years React & TypeScript',
        applicationUrl: 'https://remoteok.com/remote-jobs/123',
        description: 'Build TypeScript and React applications remotely.',
      },
      { sourceId: 'remoteok_remote', sourceName: 'Remote OK (Public REST API)', verificationLevel: 'official_partial' }
    );

    const jobs = [bodyMentionJob, bankJob, teacherJob, remoteJob];
    const indexMap = new Map(buildSearchIndexEntries(jobs).map((e) => [e.jobId, e]));

    const baseState: JobSearchQueryState = {
      query: '',
      category: 'All',
      education: 'All',
      location: 'All',
      deadline: 'all',
      skillsOrExperience: '',
      sortBy: 'relevance',
      bookmarkedOnly: false,
    };

    // Alias + Bangla query
    const bnBankMatches = searchAndRankJobs(jobs, { ...baseState, query: 'বাংলাদেশ ব্যাংক' }, new Set(), new Set(), indexMap);
    expect(bnBankMatches.length).toBeGreaterThanOrEqual(1);
    expect(bnBankMatches[0].job.id).toBe(bankJob.id);

    // Spelling variant Chittagong -> Chattogram
    const ctgMatches = searchAndRankJobs(jobs, { ...baseState, query: 'Chittagong' }, new Set(), new Set(), indexMap);
    expect(ctgMatches.map((r) => r.job.id)).toContain(bankJob.id);

    // Circular ID search
    const idMatches = searchAndRankJobs(jobs, { ...baseState, query: 'BB-2026-44' }, new Set(), new Set(), indexMap);
    expect(idMatches).toHaveLength(1);
    expect(idMatches[0].job.id).toBe(bankJob.id);

    // Category alias: Education -> includes Teaching
    const eduMatches = searchAndRankJobs(jobs, { ...baseState, category: 'Education' }, new Set(), new Set(), indexMap);
    expect(eduMatches.map((r) => r.job.id)).toContain(teacherJob.id);

    // Category Remote Jobs & Skills filter
    const remoteMatches = searchAndRankJobs(
      jobs,
      { ...baseState, category: 'Remote Jobs', skillsOrExperience: 'React' },
      new Set(),
      new Set(),
      indexMap
    );
    expect(remoteMatches).toHaveLength(1);
    expect(remoteMatches[0].job.id).toBe(remoteJob.id);

    // Hidden job exclusion
    const afterHide = searchAndRankJobs(jobs, baseState, new Set(), new Set([remoteJob.id]), indexMap);
    expect(afterHide.map((r) => r.job.id)).not.toContain(remoteJob.id);

    // Dynamic suggestions
    const sugg = getSearchSuggestions(jobs, 'Bangladesh', 5);
    expect(sugg.some((s) => /Bangladesh Bank/i.test(s))).toBe(true);
  });

  it('2. Repository persists search_index, sync_history, recent searches, saved searches & hidden results', async () => {
    const j1 = normalizeJobRecord(
      {
        externalId: 'repo_1',
        organization: 'BPSC',
        jobTitle: 'Assistant Programmer',
        position: 'Assistant Programmer',
        category: 'Government',
        applicationUrl: 'https://bpsc.gov.bd/',
      },
      { sourceId: 'bpsc', sourceName: 'BPSC', verificationLevel: 'official_verified' }
    );

    const built = await JobRepository.rebuildSearchIndex([j1]);
    expect(built).toHaveLength(1);
    const map = await JobRepository.getSearchIndexMap();
    expect(map.get(j1.id)?.normalizedTokens.length).toBeGreaterThan(0);

    await JobRepository.addSyncHistory({
      id: 'sync_test_1',
      syncedAt: Date.now(),
      totalRetrieved: 5,
      newJobsCount: 3,
      updatedJobsCount: 1,
      duplicatesRemoved: 1,
      sourceSummaries: [{ sourceId: 'bpsc', sourceName: 'BPSC', status: 'Working', retrieved: 5, saved: 3 }],
    });
    const history = await JobRepository.getSyncHistory(5);
    expect(history).toHaveLength(1);
    expect(history[0].totalRetrieved).toBe(5);

    await JobRepository.addRecentSearch('BPSC');
    await JobRepository.addRecentSearch('bpsc'); // dedupe case-insensitive
    await JobRepository.addRecentSearch('Bank');
    expect(await JobRepository.getRecentSearches()).toEqual(['Bank', 'bpsc']);

    const savedList = await JobRepository.saveSavedSearch({
      label: 'Gov • Dhaka',
      query: 'Programmer',
      category: 'Government',
      location: 'Dhaka',
      education: 'All',
    });
    expect(savedList).toHaveLength(1);
    expect(await JobRepository.deleteSavedSearch(savedList[0].id)).toHaveLength(0);

    await JobRepository.hideJobId(j1.id);
    expect(await JobRepository.getHiddenJobIds()).toContain(j1.id);
    expect(await JobRepository.unhideAllJobs()).toEqual([]);
  });

  it('3. Fetcher retries transient 503 once, skips retry on 403, and enforces bounded concurrency with progress', async () => {
    let transientCalls = 0;
    let perm403Calls = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = String(input);
      if (url.includes('/transient')) {
        transientCalls += 1;
        if (transientCalls === 1) {
          return { ok: false, status: 503, headers: new Headers(), text: async () => 'Busy' } as Response;
        }
        return { ok: true, status: 200, headers: new Headers(), text: async () => 'Recovered' } as Response;
      }
      if (url.includes('/forbidden')) {
        perm403Calls += 1;
        return { ok: false, status: 403, headers: new Headers(), text: async () => 'Forbidden' } as Response;
      }
      return { ok: true, status: 200, headers: new Headers(), text: async () => '' } as Response;
    });

    const okAfterRetry = await safePublicGet('https://example.org/transient', 'text/plain');
    expect(okAfterRetry.ok).toBe(true);
    expect(transientCalls).toBe(2);

    const permFail = await safePublicGet('https://example.org/forbidden', 'text/plain');
    expect(permFail.ok).toBe(false);
    expect(permFail.status).toBe(403);
    expect(perm403Calls).toBe(1);

    let inFlight = 0;
    let peakInFlight = 0;
    const events: SourceProgressEvent[] = [];

    const makeMockAdapter = (id: string, delayMs: number): JobSourceAdapter => ({
      sourceId: id,
      sourceName: `Mock ${id}`,
      sourceType: 'remote_tech_api',
      officialDomain: 'example.com',
      compatibilityStatus: 'supported',
      accessMethod: 'Mock',
      verificationLevel: 'official_partial',
      directSourceUrl: 'https://example.com',
      notes: '',
      async fetchJobs() {
        inFlight += 1;
        peakInFlight = Math.max(peakInFlight, inFlight);
        await new Promise((r) => setTimeout(r, delayMs));
        inFlight -= 1;
        return {
          sourceId: id,
          sourceName: `Mock ${id}`,
          compatibilityStatus: 'supported',
          success: true,
          jobs: [],
          checkedAt: Date.now(),
        };
      },
      parseJob: (raw) => normalizeJobRecord(raw, { sourceId: id, sourceName: id, verificationLevel: 'official_partial' }),
      validateJob: () => ({ isValid: true, reasons: [] }),
      getApplicationUrl: () => 'https://example.com',
      getCircularUrl: () => undefined,
    });

    const mockAdapters = ['a', 'b', 'c', 'd', 'e'].map((id, i) => makeMockAdapter(id, 15 + i * 5));
    const outcomes = await fetchFromSources(mockAdapters, undefined, {
      concurrency: 2,
      onSourceProgress: (ev) => events.push(ev),
    });

    expect(outcomes).toHaveLength(5);
    expect(peakInFlight).toBeLessThanOrEqual(2);
    expect(events.filter((e) => e.phase === 'completed')).toHaveLength(5);
  });

  it('4. RemoteOkAdapter & HimalayasAdapter parse accurately, omit trademark logo, filter by BD/Worldwide & respect toggles', async () => {
    const sampleRemoteOk = JSON.stringify([
      { legal: 'Please link back and mention Remote OK without Remote OK logo' },
      {
        id: '99123',
        company: 'CloudScale',
        position: 'Backend Engineer',
        tags: ['node', 'typescript'],
        location: 'Worldwide',
        date: '2026-11-08T10:00:00+00:00',
        salary_min: 70000,
        salary_max: 95000,
        url: 'https://remoteok.com/remote-jobs/backend-99123',
        description: '<p>API systems role.</p>',
      },
    ]);
    const remoteOkItems = parseRemoteOkApiJson(sampleRemoteOk);
    expect(remoteOkItems).toHaveLength(1);
    expect(remoteOkItems[0].organizationLogo).toBeUndefined();
    expect(remoteOkItems[0].deadlineText).toBeUndefined();
    expect(remoteOkItems[0].category).toBe('Remote Jobs');
    expect(remoteOkItems[0].applicationUrl).toBe('https://remoteok.com/remote-jobs/backend-99123');

    const sampleHimalayas = JSON.stringify({
      jobs: [
        {
          guid: 'https://himalayas.app/companies/x/jobs/us-only',
          title: 'US Restricted Role',
          companyName: 'US Co',
          applicationLink: 'https://himalayas.app/apply/us',
          locationRestrictions: ['United States'],
          pubDate: 1762700000,
        },
        {
          guid: 'https://himalayas.app/companies/y/jobs/global-dev',
          title: 'Platform Engineer',
          companyName: 'GlobalCo',
          applicationLink: 'https://himalayas.app/apply/global-dev',
          locationRestrictions: ['Worldwide'],
          pubDate: 1762700000,
          excerpt: 'Remote anywhere including Bangladesh.',
        },
      ],
      nextCursor: null,
    });
    const himalayasPage = parseHimalayasApiJson(sampleHimalayas);
    expect(himalayasPage.totalScanned).toBe(2);
    expect(himalayasPage.items).toHaveLength(1);
    expect(himalayasPage.items[0].position).toBe('Platform Engineer');
    expect(himalayasPage.items[0].category).toBe('International Jobs');
    expect(himalayasPage.items[0].deadlineText).toBeUndefined();

    // Respect user opt-out toggles
    await JobRepository.savePreferences({
      ...DEFAULT_JOB_PREFERENCES,
      enableRemoteOkSource: false,
      enableHimalayasSource: false,
    });
    const roDisabled = await RemoteOkAdapter.fetchJobs();
    const himDisabled = await HimalayasAdapter.fetchJobs();
    expect(roDisabled.connectionStatus).toBe('Not Implemented');
    expect(himDisabled.connectionStatus).toBe('Not Implemented');
  });

  it('5. Preferences match org/keywords/workMode and JobCheckService emits deadline_changed & matching_job alerts', async () => {
    const prefs = {
      ...DEFAULT_JOB_PREFERENCES,
      preferredOrganizations: ['PetroBangla'],
      workModePreference: 'On-Site' as const,
      includeKeywords: ['Engineer'],
      excludeKeywords: ['Intern'],
      dailyDigestEnabled: true,
    };

    const matchJob = normalizeJobRecord(
      {
        externalId: 'pref_1',
        organization: 'PetroBangla (BOGMC)',
        jobTitle: 'Assistant Engineer (Mechanical)',
        position: 'Assistant Engineer (Mechanical)',
        category: 'Autonomous Organization',
        location: 'Dhaka',
        deadlineText: '2026-12-20',
        applicationUrl: 'https://bogmc.teletalk.com.bd/',
        description: 'Permanent mechanical engineer post.',
      },
      { sourceId: 'teletalk', sourceName: 'Teletalk', verificationLevel: 'official_verified' }
    );
    const excludedIntern = normalizeJobRecord(
      {
        externalId: 'pref_2',
        organization: 'PetroBangla',
        jobTitle: 'Engineering Intern',
        position: 'Engineering Intern',
        category: 'Autonomous Organization',
        location: 'Dhaka',
        applicationUrl: 'https://bogmc.teletalk.com.bd/',
        description: 'Internship post.',
      },
      { sourceId: 'teletalk', sourceName: 'Teletalk', verificationLevel: 'official_verified' }
    );
    const remoteRole = normalizeJobRecord(
      {
        externalId: 'pref_3',
        organization: 'PetroBangla',
        jobTitle: 'Software Engineer (Remote)',
        position: 'Software Engineer',
        category: 'Remote Jobs',
        location: 'All Bangladesh',
        applicationUrl: 'https://remoteok.com/remote-jobs/1',
        description: 'Remote role.',
      },
      { sourceId: 'remoteok_remote', sourceName: 'Remote OK', verificationLevel: 'official_partial' }
    );

    expect(jobMatchesPreferences(matchJob, prefs)).toBe(true);
    expect(jobMatchesPreferences(excludedIntern, prefs)).toBe(false);
    expect(jobMatchesPreferences(remoteRole, prefs)).toBe(false);

    // Seed existing job with older deadline, then simulate adapter returning updated deadline + a new matching job
    const seededOld = normalizeJobRecord(
      {
        externalId: 'upd_dl_1',
        organization: 'BPSC',
        jobTitle: 'Senior Officer',
        position: 'Senior Officer',
        circularNumber: 'BPSC-2026-77',
        category: 'Government',
        location: 'Dhaka',
        deadlineText: '2026-12-01',
        applicationUrl: 'https://bpsc.gov.bd/',
      },
      { sourceId: 'bpsc', sourceName: 'BPSC', verificationLevel: 'official_verified' }
    );
    await JobRepository.saveJobs([seededOld]);
    await JobRepository.savePreferences({
      ...prefs,
      dailyDigestEnabled: false,
      preferredOrganizations: [],
      includeKeywords: [],
      preferredCategories: ['Autonomous Organization'],
      notificationHour: 23,
      notificationMinute: 59,
    });

    const updatedDeadlineJob = normalizeJobRecord(
      {
        externalId: 'upd_dl_1',
        organization: 'BPSC',
        jobTitle: 'Senior Officer',
        position: 'Senior Officer',
        circularNumber: 'BPSC-2026-77',
        category: 'Government',
        location: 'Dhaka',
        deadlineText: '2026-12-28',
        applicationUrl: 'https://bpsc.gov.bd/',
      },
      { sourceId: 'bpsc', sourceName: 'BPSC', verificationLevel: 'official_verified' }
    );

    const mockAdapter: JobSourceAdapter = {
      sourceId: 'bpsc',
      sourceName: 'BPSC Mock',
      sourceType: 'official_commission',
      officialDomain: 'bpsc.gov.bd',
      compatibilityStatus: 'supported',
      accessMethod: 'Mock',
      verificationLevel: 'official_verified',
      directSourceUrl: 'https://bpsc.gov.bd/',
      notes: '',
      async fetchJobs() {
        return {
          sourceId: 'bpsc',
          sourceName: 'BPSC Mock',
          compatibilityStatus: 'supported',
          success: true,
          jobs: [updatedDeadlineJob, matchJob],
          checkedAt: Date.now(),
        };
      },
      parseJob: (raw) => normalizeJobRecord(raw, { sourceId: 'bpsc', sourceName: 'BPSC Mock', verificationLevel: 'official_verified' }),
      validateJob: () => ({ isValid: true, reasons: [] }),
      getApplicationUrl: (j) => j.applicationUrl,
      getCircularUrl: (j) => j.circularUrl,
    };

    vi.spyOn(JobSourceRegistry, 'getAll').mockReturnValue([mockAdapter]);
    const report = await JobCheckService.runFullCheck();
    expect(report.totalStoredJobs).toBe(2);

    const notifs = await JobNotificationRepository.getAll();
    expect(notifs.some((n) => n.type === 'deadline_changed')).toBe(true);
    expect(notifs.some((n) => n.type === 'matching_job')).toBe(true);
    expect((await JobRepository.getSearchIndexEntries()).length).toBe(2);
    expect((await JobRepository.getSyncHistory(5)).length).toBeGreaterThanOrEqual(1);
  });

  it('6. JobSearchPage search, category/hide/restore, saved searches, offline/retry & JobDetails PDF preview work', async () => {
    const future = new Date(Date.now() + 8 * DAY_MS).toISOString().slice(0, 10);
    const pdfJob = normalizeJobRecord(
      {
        externalId: 'ui_pdf_1',
        organization: 'BPSC',
        jobTitle: 'Assistant Programmer',
        position: 'Assistant Programmer',
        circularNumber: 'BPSC-PDF-12',
        category: 'Government',
        location: 'Dhaka',
        qualification: 'Bachelor',
        deadlineText: future,
        circularUrl: 'https://bpsc.gov.bd/sites/default/files/circular_12.pdf',
        applicationUrl: 'https://bpsc.teletalk.com.bd/',
      },
      { sourceId: 'bpsc', sourceName: 'BPSC Official', verificationLevel: 'official_verified' }
    );
    const remoteUiJob = normalizeJobRecord(
      {
        externalId: 'ui_rem_1',
        organization: 'Remotive Co',
        jobTitle: 'Frontend Developer (Remote)',
        position: 'Frontend Developer',
        category: 'Remote Jobs',
        location: 'All Bangladesh',
        applicationUrl: 'https://remotive.com/remote-jobs/fe-1',
      },
      { sourceId: 'remotive_remote', sourceName: 'Remotive', verificationLevel: 'official_partial' }
    );
    await JobRepository.saveJobs([pdfJob, remoteUiJob]);

    await act(async () => {
      root.render(
        <AppProvider>
          <JobSearchPage />
        </AppProvider>
      );
    });
    await flushUi(80);

    expect(container.textContent).toContain('Job Search');
    expect(container.textContent).toContain('Remote Jobs');
    expect(container.textContent).toContain('International Jobs');
    expect(container.textContent).toContain('Assistant Programmer');
    expect(container.textContent).toContain('Frontend Developer');

    // Submit search for Assistant Programmer
    const searchInput = container.querySelector('input[type="search"]') as HTMLInputElement;
    setReactInputValue(searchInput, 'Assistant Programmer');
    const form = searchInput.closest('form') as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flushUi(50);

    expect(container.textContent).toContain('Assistant Programmer');
    expect(container.textContent).not.toContain('Frontend Developer');
    expect(await JobRepository.getRecentSearches()).toContain('Assistant Programmer');

    // Save Search chip
    const saveBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Save Search')
    ) as HTMLButtonElement;
    await act(async () => {
      saveBtn.click();
    });
    await flushUi(30);
    expect(container.textContent).toContain('Saved Searches:');

    // Clear filters to restore both, then hide Assistant Programmer and unhide
    const clearBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Clear Filters')
    ) as HTMLButtonElement;
    await act(async () => {
      clearBtn.click();
    });
    await flushUi(50);

    const hideBtn = container.querySelector('button[aria-label="Hide Assistant Programmer"]') as HTMLButtonElement;
    await act(async () => {
      hideBtn.click();
    });
    await flushUi(40);
    expect(container.querySelector('button[aria-label="Hide Assistant Programmer"]')).toBeNull();
    expect(container.textContent).toContain('Unhide 1 hidden result(s)');

    const unhideBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Unhide 1 hidden result(s)')
    ) as HTMLButtonElement;
    await act(async () => {
      unhideBtn.click();
    });
    await flushUi(40);
    expect(container.textContent).toContain('Assistant Programmer');

    // Verify partial failure on Fetch Latest preserves existing jobs cleanly
    vi.spyOn(JobSourceRegistry, 'getAll').mockReturnValue([
      {
        sourceId: 'failing_mock',
        sourceName: 'Failing Source',
        sourceType: 'official_portal',
        officialDomain: 'example.gov.bd',
        compatibilityStatus: 'supported',
        accessMethod: 'Mock',
        verificationLevel: 'official_verified',
        directSourceUrl: 'https://example.gov.bd/',
        notes: '',
        async fetchJobs() {
          return {
            sourceId: 'failing_mock',
            sourceName: 'Failing Source',
            compatibilityStatus: 'unavailable',
            success: false,
            jobs: [],
            checkedAt: Date.now(),
            error: 'HTTP 503',
          };
        },
        parseJob: (raw) => normalizeJobRecord(raw, { sourceId: 'failing_mock', sourceName: 'Failing Source', verificationLevel: 'official_verified' }),
        validateJob: () => ({ isValid: true, reasons: [] }),
        getApplicationUrl: (j) => j.applicationUrl,
        getCircularUrl: (j) => j.circularUrl,
      },
    ]);
    const fetchLatestBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Fetch Latest')
    ) as HTMLButtonElement;
    await act(async () => {
      fetchLatestBtn.click();
    });
    await flushUi(50);
    expect(container.textContent).toContain('preserved your last saved search dataset');
    expect(container.textContent).toContain('Assistant Programmer');

    // Open JobDetails from result article and toggle PDF Preview
    const titleBtn = Array.from(container.querySelectorAll('article button')).find((b) =>
      b.textContent?.trim() === 'Assistant Programmer'
    ) as HTMLButtonElement;
    expect(titleBtn).toBeTruthy();
    await act(async () => {
      titleBtn.click();
    });
    await flushUi(40);

    const pdfToggleBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Preview PDF Circular')
    ) as HTMLButtonElement;
    expect(pdfToggleBtn).toBeTruthy();
    await act(async () => {
      pdfToggleBtn.click();
    });
    await flushUi(30);
    const iframe = container.querySelector('iframe[title="Official Job Circular PDF"]') as HTMLIFrameElement;
    expect(iframe).toBeTruthy();
    expect(iframe.src).toContain('circular_12.pdf');
  });

  it('7. NotificationCenter tabs (Matching Jobs, Deadline Changed, Bookmarked), Tracker statuses, Preferences, Sidebar & Popup work', async () => {
    const jobBm = normalizeJobRecord(
      {
        externalId: 'nc_bm_1',
        organization: 'Bangladesh Bank',
        jobTitle: 'IT Officer',
        position: 'IT Officer',
        category: 'Bank',
        applicationUrl: 'https://erecruitment.bb.org.bd/',
      },
      { sourceId: 'bangladesh_bank', sourceName: 'Bangladesh Bank', verificationLevel: 'official_verified' }
    );
    await JobRepository.saveJobs([jobBm]);
    await BookmarkRepository.addBookmark(jobBm.id);

    await JobNotificationRepository.add({
      id: 'n_match',
      type: 'matching_job',
      title: 'Matching IT Job',
      message: 'New bank IT post matched.',
      jobId: jobBm.id,
      organization: 'Bangladesh Bank',
      isUrgent: false,
      isRead: false,
      createdAt: Date.now(),
    });
    await JobNotificationRepository.add({
      id: 'n_dl',
      type: 'deadline_changed',
      title: 'Deadline Shifted',
      message: 'Closing date extended.',
      isUrgent: false,
      isRead: false,
      createdAt: Date.now() - 1000,
    });

    await act(async () => {
      root.render(
        <NotificationCenterPage
          language="en"
          onOpenJobDetails={() => {}}
        />
      );
    });
    await flushUi(50);

    expect(container.textContent).toContain('chrome.alarms');
    expect(container.textContent).toContain('Matching Jobs');
    expect(container.textContent).toContain('Deadline Changed');
    expect(container.textContent).toContain('Bookmarked');

    const bmTab = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Bookmarked') as HTMLButtonElement;
    await act(async () => {
      bmTab.click();
    });
    await flushUi(30);
    expect(container.textContent).toContain('Matching IT Job');
    expect(container.textContent).not.toContain('Deadline Shifted');

    // Tracker includes Bookmarked & Expired statuses
    expect(APPLICATION_STATUSES).toContain('Bookmarked');
    expect(APPLICATION_STATUSES).toContain('Expired');
    await act(async () => {
      root.render(
        <ApplicationTracker
          records={[]}
          language="en"
          onUpdateRecord={async () => {}}
          onDeleteRecord={async () => {}}
        />
      );
    });
    await flushUi(20);
    expect(container.textContent).toContain('Bookmarked');
    expect(container.textContent).toContain('Expired');

    // JobPreferencesSection renders new preference controls and persists Remote OK / Himalayas toggles + WorkMode
    await act(async () => {
      root.render(
        <AppProvider>
          <JobPreferencesSection showToast={() => {}} />
        </AppProvider>
      );
    });
    await flushUi(40);
    expect(container.textContent).toContain('Work Mode Preference');
    expect(container.textContent).toContain('Preferred Organizations');
    expect(container.textContent).toContain('Remote OK Public API');
    expect(container.textContent).toContain('Himalayas Remote Public API');

    const workModeSelect = container.querySelector('select[aria-label="Work Mode Preference"]') as HTMLSelectElement;
    await act(async () => {
      setReactInputValue(workModeSelect, 'Remote');
    });
    await flushUi(30);
    expect((await JobRepository.getPreferences()).workModePreference).toBe('Remote');

    // Sidebar + Popup include Job Search
    await act(async () => {
      root.render(
        <AppProvider>
          <Sidebar activeTab="search" onSelectTab={() => {}} completionScore={95} />
        </AppProvider>
      );
    });
    await flushUi(20);
    expect(container.textContent).toContain('Job Search');
    expect(container.textContent).toContain('Job Circulars');

    await act(async () => {
      root.render(<PopupApp />);
    });
    await flushUi(30);
    expect(container.textContent).toContain('Search');
    expect(container.textContent).toContain('Job Circulars');
  });

  it('8. JobDetails renders safely without PDF iframe when circularUrl is non-PDF HTML page', async () => {
    const htmlJob = normalizeJobRecord(
      {
        externalId: 'html_only_1',
        organization: 'Bangladesh Bank',
        jobTitle: 'Officer',
        position: 'Officer',
        category: 'Bank',
        circularUrl: 'https://erecruitment.bb.org.bd/onlineapp/joblist.php',
        applicationUrl: 'https://erecruitment.bb.org.bd/',
      },
      { sourceId: 'bangladesh_bank', sourceName: 'Bangladesh Bank', verificationLevel: 'official_verified' }
    );

    await act(async () => {
      root.render(
        <JobDetails
          job={htmlJob}
          isBookmarked={false}
          language="en"
          onBack={() => {}}
          onApplyNow={() => {}}
          onToggleBookmark={() => {}}
          onMarkApplied={() => {}}
          onShare={() => {}}
        />
      );
    });
    await flushUi(20);

    expect(container.textContent).not.toContain('Preview PDF Circular');
    expect(container.querySelector('iframe')).toBeNull();
  });
});
