// JobFill BD - Centralized Source Health, Targeted Retry, Search Index & NTRCA Consistency Tests
// Covers Scenarios A-F plus distinct search/index/retrieval result metrics.

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AppProvider } from '../../src/dashboard/context/AppContext';
import { CompactSourceHealthBar } from '../../src/jobs/dashboard/CompactSourceHealthBar';
import { JobSearchPage } from '../../src/jobs/dashboard/JobSearchPage';
import { JobRepository } from '../../src/jobs/database/job-repository';
import { BookmarkRepository } from '../../src/jobs/database/bookmark-repository';
import { ApplicationRepository } from '../../src/jobs/database/application-repository';
import { JobNotificationRepository } from '../../src/jobs/database/notification-repository';
import { JobSourceRegistry } from '../../src/jobs/sources/source-registry';
import { NtrcaAdapter } from '../../src/jobs/sources/ntrca/ntrca.adapter';
import { JobCheckService } from '../../src/jobs/background/job-check-service';
import { normalizeJobRecord } from '../../src/jobs/services/job-normalizer';
import {
  buildSearchIndexEntries,
  searchAndRankJobs,
  JobSearchQueryState,
} from '../../src/jobs/services/search-engine';
import {
  computeSourceHealthSummary,
  formatSourceFailureAlertMessage,
  formatSourceHealthHeadline,
} from '../../src/jobs/services/source-health-state';
import { DAY_MS } from '../../src/jobs/services/deadline-parser';
import {
  DEFAULT_JOB_PREFERENCES,
  NormalizedJobCircular,
} from '../../src/jobs/types/job.types';
import {
  JobSourceAdapter,
  SourceCompatibilityStatus,
  SourceConnectionStatus,
  SourceFetchOutcome,
} from '../../src/jobs/types/source.types';

async function flushUi(ms: number = 45) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

function setReactInputValue(el: HTMLInputElement | HTMLSelectElement, value: string) {
  const proto =
    el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function makeMockAdapter(
  sourceId: string,
  sourceName: string,
  handler: () => Promise<SourceFetchOutcome>
): JobSourceAdapter {
  return {
    sourceId,
    sourceName,
    sourceType: 'official_portal',
    officialDomain: `${sourceId}.gov.bd`,
    compatibilityStatus: 'supported',
    accessMethodType: 'HTML',
    publisherType: 'Official',
    accessMethod: 'Mock Portal',
    verificationLevel: 'official_verified',
    directSourceUrl: `https://${sourceId}.gov.bd/`,
    notes: `${sourceName} mock adapter`,
    fetchJobs: handler,
    parseJob: (raw, checkedAt) =>
      normalizeJobRecord(raw, {
        sourceId,
        sourceName,
        verificationLevel: 'official_verified',
        checkedAt,
      }),
    validateJob: () => ({ isValid: true, errors: [], warnings: [], hasVerifiedDeadline: false }),
    getApplicationUrl: (j) => j.applicationUrl || null,
    getCircularUrl: (j) => j.circularUrl,
  };
}

function makeOutcome(
  adapter: JobSourceAdapter,
  mode: 'success' | 'partial' | 'failed' | 'not_tested',
  jobs: NormalizedJobCircular[] = [],
  checkedAt: number = Date.now(),
  error?: string
): SourceFetchOutcome {
  const compatibilityStatus: SourceCompatibilityStatus =
    mode === 'success'
      ? 'supported'
      : mode === 'partial'
        ? 'partially_supported'
        : mode === 'failed'
          ? 'unavailable'
          : 'manual_only';
  const connectionStatus: SourceConnectionStatus =
    mode === 'success'
      ? 'Working'
      : mode === 'partial'
        ? 'Partially Working'
        : mode === 'failed'
          ? 'Failed'
          : 'Not Implemented';
  return {
    sourceId: adapter.sourceId,
    sourceName: adapter.sourceName,
    compatibilityStatus,
    connectionStatus,
    accessMethodType: 'HTML',
    publisherType: 'Official',
    success: mode !== 'failed',
    jobs,
    savedCount: mode === 'failed' || mode === 'not_tested' ? 0 : jobs.length,
    checkedAt: mode === 'not_tested' ? 0 : checkedAt,
    accessNotes: adapter.notes,
    directPortalUrl: adapter.directSourceUrl,
    error: mode === 'failed' ? error || 'HTTP 503 Unavailable' : undefined,
  };
}

describe('JobFill BD - Source Status Counting, Targeted Retry & Search Index Consistency', () => {
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

  it('Scenario A: 12 successful sources compute and display 12/12 Successful cleanly (EN & BN)', async () => {
    const adapters = Array.from({ length: 12 }, (_, idx) =>
      makeMockAdapter(`src_${idx + 1}`, `Source ${idx + 1}`, async () =>
        makeOutcome(adapters[idx], 'success')
      )
    );
    const now = Date.now();
    const outcomes = adapters.map((a) => makeOutcome(a, 'success', [], now));
    const summary = computeSourceHealthSummary(adapters, outcomes, now);

    expect(summary.totalSources).toBe(12);
    expect(summary.attemptedSources).toBe(12);
    expect(summary.successfulSources).toBe(12);
    expect(summary.partiallySuccessfulSources).toBe(0);
    expect(summary.failedSources).toBe(0);
    expect(summary.notTestedSources).toBe(0);
    expect(summary.retryableSourceIds).toEqual([]);
    expect(formatSourceFailureAlertMessage(summary, true)).toBeNull();
    expect(formatSourceFailureAlertMessage(summary, false)).toBeNull();

    await act(async () => {
      root.render(
        <CompactSourceHealthBar
          adapters={adapters}
          outcomes={outcomes}
          healthSummary={summary}
          lastSuccessfulSyncAt={now}
          syncing={false}
          expanded={false}
          onToggleExpanded={() => {}}
          onRetryFailed={() => {}}
          bn={false}
        />
      );
    });
    await flushUi(20);
    expect(container.textContent).toContain('12/12 Successful');
    expect(container.textContent).toContain('Successful: 12');
    expect(container.textContent).not.toContain('Failed:');

    await act(async () => {
      root.render(
        <CompactSourceHealthBar
          adapters={adapters}
          outcomes={outcomes}
          healthSummary={summary}
          lastSuccessfulSyncAt={now}
          syncing={false}
          expanded={false}
          onToggleExpanded={() => {}}
          onRetryFailed={() => {}}
          bn
        />
      );
    });
    await flushUi(20);
    expect(container.textContent).toContain('১২/১২ সূত্র সফল');
    expect(container.textContent).not.toContain('সূত্র ব্যর্থ');
  });

  it('Scenario B: 11 successful + 1 failed reports 11/12 Successful and 1 Failed (never 12/12) in EN & BN', async () => {
    const future = new Date(Date.now() + 10 * DAY_MS).toISOString().slice(0, 10);
    const adapters: JobSourceAdapter[] = Array.from({ length: 12 }, (_, idx) => {
      const id = idx === 11 ? 'bangladesh_bank' : `src_${idx + 1}`;
      const name = idx === 11 ? 'Bangladesh Bank Recruitment' : `Official Source ${idx + 1}`;
      return makeMockAdapter(id, name, async () => {
        if (id === 'bangladesh_bank') {
          return makeOutcome(adapters[idx], 'failed', [], Date.now(), 'Gateway Timeout');
        }
        const job = normalizeJobRecord(
          {
            externalId: `b_job_${idx}`,
            organization: name,
            jobTitle: `Officer ${idx + 1}`,
            position: `Officer ${idx + 1}`,
            category: 'Government',
            deadlineText: future,
            applicationUrl: `https://${id}.gov.bd/apply`,
          },
          { sourceId: id, sourceName: name, verificationLevel: 'official_verified' }
        );
        return makeOutcome(adapters[idx], 'success', [job]);
      });
    });

    vi.spyOn(JobSourceRegistry, 'getAll').mockReturnValue(adapters);
    const report = await JobCheckService.runFullCheck();

    expect(report.sourceHealth?.totalSources).toBe(12);
    expect(report.sourceHealth?.attemptedSources).toBe(12);
    expect(report.sourceHealth?.successfulSources).toBe(11);
    expect(report.sourceHealth?.partiallySuccessfulSources).toBe(0);
    expect(report.sourceHealth?.failedSources).toBe(1);
    expect(report.sourceHealth?.notTestedSources).toBe(0);
    expect(report.sourceHealth?.retryableSourceIds).toEqual(['bangladesh_bank']);

    // Render JobSearchPage in Bengali mode -> must match Scenario B exact strings cleanly
    localStorage.setItem('jobfill_language', 'bn');
    await act(async () => {
      root.render(
        <AppProvider>
          <JobSearchPage />
        </AppProvider>
      );
    });
    await flushUi(70);

    expect(container.textContent).toContain('১১/১২ সূত্র সফল');
    expect(container.textContent).toContain('১টি সূত্র ব্যর্থ');
    expect(container.textContent).not.toContain('১২/১২');
    expect(container.textContent).not.toContain('12/12');

    // Expand source list -> verify Bangladesh Bank Recruitment status is ব্যর্থ (Failed)
    const detailsToggle = container.querySelector(
      '[data-testid="source-health-details-toggle"]'
    ) as HTMLButtonElement;
    await act(async () => {
      detailsToggle.click();
    });
    await flushUi(30);
    const bbCard = container.querySelector('[data-source-id="bangladesh_bank"]');
    expect(bbCard?.textContent).toContain('Bangladesh Bank Recruitment');
    expect(bbCard?.textContent).toContain('ব্যর্থ');
  });

  it('Scenario C: 10 successful + 1 partial + 1 failed produces accurate separate counts', async () => {
    const now = Date.now();
    const adapters = Array.from({ length: 13 }, (_, idx) =>
      makeMockAdapter(`sc_c_${idx + 1}`, `Source ${idx + 1}`, async () =>
        makeOutcome(adapters[idx], 'success', [], now)
      )
    );
    // 10 working, 1 partial, 1 failed, 1 unconfigured Not Tested
    const outcomes = [
      ...adapters.slice(0, 10).map((a) => makeOutcome(a, 'success', [], now)),
      makeOutcome(adapters[10], 'partial', [], now),
      makeOutcome(adapters[11], 'failed', [], now, 'HTTP 502'),
      makeOutcome(adapters[12], 'not_tested', [], 0),
    ];

    const summary = computeSourceHealthSummary(adapters, outcomes, now);
    expect(summary.totalSources).toBe(13);
    expect(summary.attemptedSources).toBe(12);
    expect(summary.successfulSources).toBe(10);
    expect(summary.partiallySuccessfulSources).toBe(1);
    expect(summary.failedSources).toBe(1);
    expect(summary.notTestedSources).toBe(1);
    expect(summary.retryableSourceIds).toEqual(['sc_c_11', 'sc_c_12']);
    expect(formatSourceHealthHeadline(summary, false)).toBe('10/12 Successful');
    expect(formatSourceHealthHeadline(summary, true)).toBe('১০/১২ সূত্র সফল');

    await act(async () => {
      root.render(
        <CompactSourceHealthBar
          adapters={adapters}
          outcomes={outcomes}
          healthSummary={summary}
          lastSuccessfulSyncAt={now}
          syncing={false}
          expanded
          onToggleExpanded={() => {}}
          onRetryFailed={() => {}}
          bn={false}
        />
      );
    });
    await flushUi(30);

    expect(container.textContent).toContain('10/12 Successful');
    expect(container.textContent).toContain('Successful: 10');
    expect(container.textContent).toContain('Partially Successful: 1');
    expect(container.textContent).toContain('Failed: 1');
    expect(container.textContent).toContain('Not Tested: 1');
    expect(container.textContent).not.toContain('11/12 Successful');
    expect(container.textContent).not.toContain('12/12 Successful');
  });

  it('Scenario D: Retry runs ONLY failed/partial sources, preserves saved records, prevents duplicates & updates index', async () => {
    const future = new Date(Date.now() + 9 * DAY_MS).toISOString().slice(0, 10);
    let bbRecovered = false;
    const callCounts = new Map<string, number>();

    const adapters: JobSourceAdapter[] = Array.from({ length: 12 }, (_, idx) => {
      const id = idx === 11 ? 'bangladesh_bank' : `keep_src_${idx + 1}`;
      const name = idx === 11 ? 'Bangladesh Bank Recruitment' : `Working Source ${idx + 1}`;
      return makeMockAdapter(id, name, async () => {
        callCounts.set(id, (callCounts.get(id) ?? 0) + 1);
        if (id === 'bangladesh_bank') {
          if (!bbRecovered) {
            return makeOutcome(adapters[idx], 'failed', [], Date.now(), 'Temporary 503');
          }
          const dupOfFirst = normalizeJobRecord(
            {
              externalId: 'keep_ext_0',
              organization: 'Working Source 1',
              jobTitle: 'Working Job 1',
              position: 'Working Job 1',
              circularNumber: 'CIR-KEEP-0',
              category: 'Government',
              deadlineText: future,
              applicationUrl: 'https://keep_src_1.gov.bd/apply/0',
            },
            { sourceId: id, sourceName: name, verificationLevel: 'official_verified' }
          );
          const bbNew1 = normalizeJobRecord(
            {
              externalId: 'bb_rec_1',
              organization: 'Bangladesh Bank',
              organizationBn: 'বাংলাদেশ ব্যাংক',
              jobTitle: 'Assistant Director (Statistics)',
              position: 'Assistant Director (Statistics)',
              circularNumber: 'BB-STAT-2026',
              category: 'Bank',
              deadlineText: future,
              applicationUrl: 'https://erecruitment.bb.org.bd/onlineapp/joblist.php',
            },
            { sourceId: id, sourceName: name, verificationLevel: 'official_verified' }
          );
          return makeOutcome(adapters[idx], 'success', [dupOfFirst, bbNew1]);
        }

        const job = normalizeJobRecord(
          {
            externalId: `keep_ext_${idx}`,
            organization: name,
            jobTitle: `Working Job ${idx + 1}`,
            position: `Working Job ${idx + 1}`,
            circularNumber: `CIR-KEEP-${idx}`,
            category: 'Government',
            deadlineText: future,
            applicationUrl: `https://${id}.gov.bd/apply/${idx}`,
          },
          { sourceId: id, sourceName: name, verificationLevel: 'official_verified' }
        );
        return makeOutcome(adapters[idx], 'success', [job]);
      });
    });

    vi.spyOn(JobSourceRegistry, 'getAll').mockReturnValue(adapters);
    const initialReport = await JobCheckService.runFullCheck();
    expect(initialReport.totalStoredJobs).toBe(11);
    expect(initialReport.sourceHealth?.failedSources).toBe(1);

    // Render JobSearchPage showing 11/12 Successful + Retry button
    await act(async () => {
      root.render(
        <AppProvider>
          <JobSearchPage />
        </AppProvider>
      );
    });
    await flushUi(70);

    expect(container.textContent).toContain('11/12 Successful');
    expect(container.textContent).toContain('Failed: 1');

    // Recover failed source and click Retry Failed Sources
    bbRecovered = true;
    callCounts.clear();

    const retryBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Retry Failed Sources')
    ) as HTMLButtonElement;
    expect(retryBtn).toBeTruthy();

    await act(async () => {
      retryBtn.click();
    });
    await flushUi(80);

    // Must retry ONLY the failed source (bangladesh_bank), NOT the 11 working sources!
    expect(callCounts.get('bangladesh_bank')).toBe(1);
    for (let i = 0; i < 11; i++) {
      expect(callCounts.get(`keep_src_${i + 1}`) ?? 0).toBe(0);
    }

    // Stored jobs preserved + merged deduplicated (11 + 1 new = 12, duplicate did not add extra copy)
    const storedAfter = await JobRepository.getAllJobs();
    expect(storedAfter).toHaveLength(12);
    expect((await JobRepository.getSearchIndexEntries())).toHaveLength(12);

    // UI recalculated from centralized state: 12/12 Successful, warning gone, new job searchable!
    expect(container.textContent).toContain('12/12 Successful');
    expect(container.textContent).not.toContain('Failed: 1');
    expect(container.textContent).toContain('Assistant Director (Statistics)');
  });

  it('Scenario E & F: Searching NTRCA & BN/EN aliases returns all genuine stored records across Government and All without force-matching unrelated jobs', async () => {
    const future = new Date(Date.now() + 14 * DAY_MS).toISOString().slice(0, 10);

    const ntrcaJobs: NormalizedJobCircular[] = [
      NtrcaAdapter.parseJob({
        externalId: 'ntrca_1',
        organization: 'NTRCA',
        organizationBn: 'বেসরকারি শিক্ষক নিবন্ধন ও প্রত্যয়ন কর্তৃপক্ষ (এনটিআরসিএ)',
        jobTitle: '৬ষ্ঠ গণবিজ্ঞপ্তি (শিক্ষক নিয়োগ)',
        titleBn: '৬ষ্ঠ গণবিজ্ঞপ্তি (শিক্ষক নিয়োগ)',
        position: '৬ষ্ঠ গণবিজ্ঞপ্তি',
        category: 'Teaching',
        deadlineText: future,
        circularUrl: 'https://ntrca.gov.bd/sites/default/files/6th.pdf',
        applicationUrl: 'https://ntrcar.teletalk.com.bd/',
        sourceUrl: 'https://ntrca.gov.bd/pages/notices',
      }),
      NtrcaAdapter.parseJob({
        externalId: 'ntrca_2',
        organization: 'NTRCA',
        organizationBn: 'বেসরকারি শিক্ষক নিবন্ধন ও প্রত্যয়ন কর্তৃপক্ষ (এনটিআরসিএ)',
        jobTitle: '১৮তম শিক্ষক নিবন্ধন পরীক্ষার চূড়ান্ত বিজ্ঞপ্তি',
        titleBn: '১৮তম শিক্ষক নিবন্ধন পরীক্ষার চূড়ান্ত বিজ্ঞপ্তি',
        position: 'প্রভাষক ও সহকারী শিক্ষক নিবন্ধন',
        category: 'Teaching',
        deadlineText: future,
        circularUrl: 'https://ntrca.gov.bd/sites/default/files/18th.pdf',
        applicationUrl: 'https://ntrcar.teletalk.com.bd/',
        sourceUrl: 'https://ntrca.gov.bd/pages/notices',
      }),
      NtrcaAdapter.parseJob({
        externalId: 'ntrca_3',
        organization: 'NTRCA',
        organizationBn: 'বেসরকারি শিক্ষক নিবন্ধন ও প্রত্যয়ন কর্তৃপক্ষ (এনটিআরসিএ)',
        jobTitle: 'বিশেষ গণবিজ্ঞপ্তি - স্কুল ও কলেজ পদ',
        titleBn: 'বিশেষ গণবিজ্ঞপ্তি - স্কুল ও কলেজ পদ',
        position: 'সহকারী মৌলভী ও প্রভাষক',
        category: 'Teaching',
        deadlineText: future,
        circularUrl: 'https://ntrca.gov.bd/sites/default/files/special.pdf',
        applicationUrl: 'https://ntrcar.teletalk.com.bd/',
        sourceUrl: 'https://ntrca.gov.bd/pages/notices',
      }),
      NtrcaAdapter.parseJob({
        externalId: 'ntrca_4',
        organization: 'NTRCA',
        organizationBn: 'বেসরকারি শিক্ষক নিবন্ধন ও প্রত্যয়ন কর্তৃপক্ষ (এনটিআরসিএ)',
        jobTitle: '৫ম গণবিজ্ঞপ্তি সংক্রান্ত জরুরি বিজ্ঞপ্তি',
        titleBn: '৫ম গণবিজ্ঞপ্তি সংক্রান্ত জরুরি বিজ্ঞপ্তি',
        position: 'বেসরকারি শিক্ষা প্রতিষ্ঠান শিক্ষক',
        category: 'Teaching',
        deadlineText: future,
        circularUrl: 'https://ntrca.gov.bd/sites/default/files/5th.pdf',
        applicationUrl: 'https://ntrcar.teletalk.com.bd/',
        sourceUrl: 'https://ntrca.gov.bd/pages/notices',
      }),
    ];

    const unrelatedPrivateNibondhon = normalizeJobRecord(
      {
        externalId: 'pvt_unrel_1',
        organization: 'Sunrise Community Clinic',
        jobTitle: 'জন্ম নিবন্ধন ও তথ্য সহকারী',
        position: 'Information Assistant',
        category: 'NGO',
        deadlineText: future,
        applicationUrl: 'https://example.org/apply',
        description: 'Community clinic health & birth registration desk.',
      },
      { sourceId: 'bdjobs', sourceName: 'Bdjobs', verificationLevel: 'official_partial' }
    );

    const bpscJob = normalizeJobRecord(
      {
        externalId: 'govt_bpsc_1',
        organization: 'Bangladesh Public Service Commission (BPSC)',
        organizationBn: 'বাংলাদেশ সরকারি কর্ম কমিশন',
        jobTitle: 'Assistant Maintenance Engineer',
        position: 'Assistant Maintenance Engineer',
        category: 'Government',
        deadlineText: future,
        applicationUrl: 'https://bpsc.teletalk.com.bd/',
      },
      { sourceId: 'bpsc', sourceName: 'BPSC Official', verificationLevel: 'official_verified' }
    );

    const bbJob = normalizeJobRecord(
      {
        externalId: 'bank_bb_1',
        organization: 'Bangladesh Bank (BSC)',
        organizationBn: 'বাংলাদেশ ব্যাংক',
        jobTitle: 'Senior Officer (IT)',
        position: 'Senior Officer (IT)',
        category: 'Bank',
        deadlineText: future,
        applicationUrl: 'https://erecruitment.bb.org.bd/',
      },
      { sourceId: 'bangladesh_bank', sourceName: 'Bangladesh Bank Recruitment', verificationLevel: 'official_verified' }
    );

    const allStored = [...ntrcaJobs, unrelatedPrivateNibondhon, bpscJob, bbJob];
    await JobRepository.saveJobs(allStored);

    // Verify search_index builds and query matching works across ALL required aliases
    const indexMap = new Map(buildSearchIndexEntries(allStored).map((e) => [e.jobId, e]));
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

    for (const q of [
      'NTRCA',
      'NTRCA Teacher Recruitment',
      'বেসরকারি শিক্ষক নিবন্ধন ও নিয়োগ',
      'এনটিআরসিএ',
      'বেসরকারি শিক্ষক নিবন্ধন ও প্রত্যয়ন কর্তৃপক্ষ',
    ]) {
      // Must find all 4 NTRCA records with Category: All
      const resAll = searchAndRankJobs(allStored, { ...baseState, query: q }, new Set(), new Set(), indexMap);
      expect(resAll.map((r) => r.job.id).sort()).toEqual(ntrcaJobs.map((j) => j.id).sort());

      // Must find all 4 NTRCA records with Category: Government (BUG 2 exact screenshot scenario!)
      const resGov = searchAndRankJobs(
        allStored,
        { ...baseState, category: 'Government', query: q },
        new Set(),
        new Set(),
        indexMap
      );
      expect(resGov.map((r) => r.job.id).sort()).toEqual(ntrcaJobs.map((j) => j.id).sort());
    }

    // Verify other org BN/EN aliases match ONLY their own records
    const bbAliasMatches = searchAndRankJobs(
      allStored,
      { ...baseState, query: 'Bangladesh Bank Recruitment' },
      new Set(),
      new Set(),
      indexMap
    );
    expect(bbAliasMatches.map((r) => r.job.id)).toEqual([bbJob.id]);

    const bpscBnMatches = searchAndRankJobs(
      allStored,
      { ...baseState, query: 'সরকারি কর্ম কমিশন' },
      new Set(),
      new Set(),
      indexMap
    );
    expect(bpscBnMatches.map((r) => r.job.id)).toEqual([bpscJob.id]);

    // Verify JobSearchPage automatically upgrades stale pre-fix index (without NTRCA aliases) non-destructively
    await JobRepository.clearSearchIndex();
    await act(async () => {
      root.render(
        <AppProvider>
          <JobSearchPage />
        </AppProvider>
      );
    });
    await flushUi(80);

    expect((await JobRepository.getAllJobs())).toHaveLength(allStored.length);
    expect((await JobRepository.getSearchIndexEntries())).toHaveLength(allStored.length);

    // Click Government category pill + search NTRCA in live JobSearchPage UI
    const govBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Government'
    ) as HTMLButtonElement;
    await act(async () => {
      govBtn.click();
    });
    await flushUi(30);

    const searchInput = container.querySelector('input[type="search"]') as HTMLInputElement;
    setReactInputValue(searchInput, 'NTRCA');
    const form = searchInput.closest('form') as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flushUi(50);

    const metricsBar = container.querySelector('[data-testid="search-metrics-bar"]');
    expect(metricsBar?.getAttribute('data-total-indexed')).toBe(String(allStored.length));
    expect(metricsBar?.getAttribute('data-total-matching')).toBe('4');
    expect(metricsBar?.getAttribute('data-currently-displayed')).toBe('4');
    expect(container.textContent).not.toContain('Sunrise Community Clinic');
    expect(container.textContent).not.toContain('Assistant Maintenance Engineer');
  });

  it('BUG 3: Distinguishes Total indexed, Total matching, Currently displayed, Successfully retrieved, and Newly added counts', async () => {
    const future = new Date(Date.now() + 12 * DAY_MS).toISOString().slice(0, 10);
    const jobs: NormalizedJobCircular[] = Array.from({ length: 25 }, (_, i) =>
      normalizeJobRecord(
        {
          externalId: `m3_job_${i}`,
          organization: i < 3 ? 'BPSC' : `Department ${i}`,
          jobTitle: i < 3 ? `BPSC Officer ${i}` : `General Post ${i}`,
          position: i < 3 ? `BPSC Officer ${i}` : `General Post ${i}`,
          category: 'Government',
          deadlineText: future,
          applicationUrl: `https://example.gov.bd/apply/${i}`,
        },
        { sourceId: i < 3 ? 'bpsc' : 'teletalk', sourceName: i < 3 ? 'BPSC Official' : 'Teletalk', verificationLevel: 'official_verified' }
      )
    );
    await JobRepository.saveJobs(jobs);
    await JobRepository.rebuildSearchIndex(jobs);

    // Record outcomes reporting 34 retrieved across sources (higher than 25 unique stored jobs due to cross-source overlaps)
    await JobRepository.saveSourceOutcomes([
      {
        sourceId: 'teletalk',
        sourceName: 'Teletalk',
        compatibilityStatus: 'supported',
        connectionStatus: 'Working',
        success: true,
        jobCount: 28,
        savedCount: 22,
        checkedAt: Date.now(),
      },
      {
        sourceId: 'bpsc',
        sourceName: 'BPSC Official',
        compatibilityStatus: 'supported',
        connectionStatus: 'Working',
        success: true,
        jobCount: 6,
        savedCount: 3,
        checkedAt: Date.now(),
      },
    ]);
    await JobRepository.addSyncHistory({
      id: 'sync_m3',
      syncedAt: Date.now(),
      totalRetrieved: 34,
      newJobsCount: 4,
      updatedJobsCount: 2,
      duplicatesRemoved: 9,
      sourceSummaries: [],
    });

    await act(async () => {
      root.render(
        <AppProvider>
          <JobSearchPage />
        </AppProvider>
      );
    });
    await flushUi(80);

    const bar = container.querySelector('[data-testid="search-metrics-bar"]');
    expect(bar?.getAttribute('data-total-indexed')).toBe('25');
    expect(bar?.getAttribute('data-total-matching')).toBe('25');
    expect(bar?.getAttribute('data-currently-displayed')).toBe('20'); // Page size = 20
    expect(bar?.getAttribute('data-successfully-retrieved')).toBe('34');
    expect(bar?.getAttribute('data-newly-added')).toBe('4');

    expect(container.textContent).toContain('Indexed: 25');
    expect(container.textContent).toContain('Matching: 25');
    expect(container.textContent).toContain('Displayed: 20');
    expect(container.textContent).toContain('Retrieved: 34');
    expect(container.textContent).toContain('Newly Added: 4');

    // Filter down to BPSC -> Matching=3, Displayed=3, Indexed remains 25!
    const searchInput = container.querySelector('input[type="search"]') as HTMLInputElement;
    setReactInputValue(searchInput, 'BPSC');
    const form = searchInput.closest('form') as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flushUi(50);

    const filteredBar = container.querySelector('[data-testid="search-metrics-bar"]');
    expect(filteredBar?.getAttribute('data-total-indexed')).toBe('25');
    expect(filteredBar?.getAttribute('data-total-matching')).toBe('3');
    expect(filteredBar?.getAttribute('data-currently-displayed')).toBe('3');
  });
});
