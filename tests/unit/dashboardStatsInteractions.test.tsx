// JobFill BD - Dashboard Statistics Cards, Partial Warning Actions & Filter Integration Tests

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AppProvider } from '../../src/dashboard/context/AppContext';
import { JobCircularPage } from '../../src/jobs/dashboard/JobCircularPage';
import { JobRepository } from '../../src/jobs/database/job-repository';
import { BookmarkRepository } from '../../src/jobs/database/bookmark-repository';
import { ApplicationRepository } from '../../src/jobs/database/application-repository';
import { JobNotificationRepository } from '../../src/jobs/database/notification-repository';
import { JobSourceRegistry } from '../../src/jobs/sources/source-registry';
import { normalizeJobRecord } from '../../src/jobs/services/job-normalizer';
import {
  DAY_MS,
  getDhakaDateKey,
  getDhakaWeekBounds,
  isTimestampInCurrentDhakaWeek,
  dhakaWallTimeToUtcMs,
} from '../../src/jobs/services/deadline-parser';
import { JobSourceAdapter } from '../../src/jobs/types/source.types';

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

function getStatCard(container: HTMLElement, labelPart: string): HTMLButtonElement {
  const btn = Array.from(container.querySelectorAll('div[role="group"] button')).find((b) =>
    b.textContent?.includes(labelPart)
  ) as HTMLButtonElement | undefined;
  if (!btn) {
    throw new Error(`Stat card not found: ${labelPart}`);
  }
  return btn;
}

function getRenderedCardHeadings(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('div.grid h3')).map((h) => h.textContent?.trim() || '');
}

describe('JobFill BD - Interactive Dashboard Statistics & Warning Actions Suite', () => {
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

  it('0. Asia/Dhaka current week boundary accurately separates Saturday 23:59:59+06 from Sunday 00:00:00+06', () => {
    // Tuesday 2026-11-10T15:00:00Z (= 21:00 Asia/Dhaka) -> week starts Sunday 2026-11-08 00:00:00 +06:00
    const refNow = Date.UTC(2026, 10, 10, 15, 0, 0);
    const { weekStartMs, weekEndMs } = getDhakaWeekBounds(refNow);
    const sunMidnightDhaka = dhakaWallTimeToUtcMs(2026, 11, 8, 0, 0, 0);
    const satBeforeMidnightDhaka = dhakaWallTimeToUtcMs(2026, 11, 7, 23, 59, 59);
    const satEndOfThisWeek = dhakaWallTimeToUtcMs(2026, 11, 14, 23, 59, 59);

    expect(weekStartMs).toBe(sunMidnightDhaka);
    expect(Math.floor(weekEndMs / 1000)).toBe(Math.floor(satEndOfThisWeek / 1000));
    expect(isTimestampInCurrentDhakaWeek(sunMidnightDhaka, refNow)).toBe(true);
    expect(isTimestampInCurrentDhakaWeek(satBeforeMidnightDhaka, refNow)).toBe(false);
    expect(isTimestampInCurrentDhakaWeek(null, refNow)).toBe(false);
  });

  it('1-6, 9-10: All 6 statistics cards filter accurately, integrate with search/category, sync bookmarks live, exclude invalid/dupes & clear cleanly', async () => {
    const now = Date.now();
    const todayDhakaKey = getDhakaDateKey(now);
    const oldWeekDateKey = getDhakaDateKey(now - 10 * DAY_MS);
    const in2DaysKey = getDhakaDateKey(now + 2 * DAY_MS);
    const in5DaysKey = getDhakaDateKey(now + 5 * DAY_MS);
    const in20DaysKey = getDhakaDateKey(now + 20 * DAY_MS);
    const expired1DayAgoKey = getDhakaDateKey(now - 1 * DAY_MS);
    const expired6DaysAgoKey = getDhakaDateKey(now - 6 * DAY_MS);

    // 1. Bank job published this week & closing soon in 2 days (Bookmarked + Ready to Apply)
    const bankClosingSoon = normalizeJobRecord(
      {
        externalId: 'stat_bank_soon',
        organization: 'Bangladesh Bank',
        jobTitle: 'Bank Assistant Director',
        position: 'Bank Assistant Director',
        circularNumber: 'BB-STAT-1',
        category: 'Bank',
        publishedDateText: todayDhakaKey,
        deadlineText: in2DaysKey,
        applicationUrl: 'https://erecruitment.bb.org.bd/onlineapp/joblist.php',
      },
      { sourceId: 'bangladesh_bank', sourceName: 'Bangladesh Bank', verificationLevel: 'official_verified', checkedAt: now }
    );

    // 2. Government job closing soon in 5 days, published last week, bookmarked & Applied
    const govClosingSoon = normalizeJobRecord(
      {
        externalId: 'stat_gov_soon',
        organization: 'BPSC',
        jobTitle: 'Gov Assistant Programmer',
        position: 'Gov Assistant Programmer',
        circularNumber: 'BPSC-STAT-2',
        category: 'Government',
        publishedDateText: oldWeekDateKey,
        deadlineText: in5DaysKey,
        applicationUrl: 'https://bpsc.teletalk.com.bd/',
      },
      { sourceId: 'bpsc', sourceName: 'BPSC', verificationLevel: 'official_verified', checkedAt: now }
    );

    // 3. Job with verified publishedAt this week & unverified deadline (Excluded from Closing Soon!)
    const unverifiedDeadlineThisWeek = normalizeJobRecord(
      {
        externalId: 'stat_unverified_dl',
        organization: 'PetroBangla',
        jobTitle: 'Junior Mechanical Officer',
        position: 'Junior Mechanical Officer',
        category: 'Autonomous Organization',
        publishedDateText: todayDhakaKey,
        deadlineText: undefined,
        applicationUrl: 'https://bogmc.teletalk.com.bd/',
      },
      { sourceId: 'teletalk', sourceName: 'Teletalk', verificationLevel: 'official_verified', checkedAt: now }
    );

    // 4. Job with NO verified publishedAt & deadline in 20 days (Excluded from New This Week!) + Tracker Interested (NOT in Progress!)
    const noPubDateLongDeadline = normalizeJobRecord(
      {
        externalId: 'stat_no_pub',
        organization: 'NTRCA',
        jobTitle: 'College Lecturer Notice',
        position: 'College Lecturer Notice',
        category: 'Education',
        publishedDateText: undefined,
        deadlineText: in20DaysKey,
        applicationUrl: 'https://ntrca.gov.bd/',
      },
      { sourceId: 'ntrca', sourceName: 'NTRCA', verificationLevel: 'official_verified', checkedAt: now }
    );

    // 5 & 6. Two expired jobs (one expired 1 day ago, one expired 6 days ago) to verify most-recently-expired sort
    const expiredRecent = normalizeJobRecord(
      {
        externalId: 'stat_exp_recent',
        organization: 'DPE',
        jobTitle: 'Recently Expired Teacher Post',
        position: 'Recently Expired Teacher Post',
        category: 'Government',
        publishedDateText: oldWeekDateKey,
        deadlineText: expired1DayAgoKey,
        applicationUrl: 'https://dpe.gov.bd/',
      },
      { sourceId: 'dpe', sourceName: 'DPE', verificationLevel: 'official_verified', checkedAt: now }
    );

    const expiredOlder = normalizeJobRecord(
      {
        externalId: 'stat_exp_older',
        organization: 'Local Health',
        jobTitle: 'Older Expired Medical Post',
        position: 'Older Expired Medical Post',
        category: 'Healthcare',
        publishedDateText: oldWeekDateKey,
        deadlineText: expired6DaysAgoKey,
        applicationUrl: 'https://dghs.gov.bd/',
      },
      { sourceId: 'official_website', sourceName: 'National Portal', verificationLevel: 'official_verified', checkedAt: now }
    );

    // Duplicate record with identical fingerprintHash + invalid record without URL (must NOT inflate counts!)
    const duplicateBank = {
      ...bankClosingSoon,
      id: 'dup_bank_copy',
      sourceVerification: 'discovery_only' as const,
      lastUpdatedAt: now - 5000,
    };
    const invalidJob = {
      ...expiredOlder,
      id: 'invalid_bad_url',
      applicationUrl: 'javascript:alert(1)',
    };

    await JobRepository.saveJobs([
      bankClosingSoon,
      govClosingSoon,
      unverifiedDeadlineThisWeek,
      noPubDateLongDeadline,
      expiredRecent,
      expiredOlder,
      duplicateBank,
      invalidJob,
    ]);

    await BookmarkRepository.addBookmark(bankClosingSoon.id);
    await BookmarkRepository.addBookmark(govClosingSoon.id);
    await ApplicationRepository.setStatus(bankClosingSoon, 'Ready to Apply');
    await ApplicationRepository.setStatus(govClosingSoon, 'Applied');
    await ApplicationRepository.setStatus(noPubDateLongDeadline, 'Interested'); // Should NOT count under In Progress!

    await act(async () => {
      root.render(
        <AppProvider>
          <JobCircularPage />
        </AppProvider>
      );
    });
    await flushUi(80);

    // Check exact real deduplicated counts across all 6 cards
    expect(getStatCard(container, 'Total Job Circulars').textContent).toContain('6');
    expect(getStatCard(container, 'New This Week').textContent).toContain('2'); // bankClosingSoon + unverifiedDeadlineThisWeek ONLY!
    expect(getStatCard(container, 'Closing Soon').textContent).toContain('2'); // bankClosingSoon + govClosingSoon ONLY!
    expect(getStatCard(container, 'Deadline Passed').textContent).toContain('2'); // expiredRecent + expiredOlder
    expect(getStatCard(container, 'Bookmarked Jobs').textContent).toContain('2'); // bankClosingSoon + govClosingSoon
    expect(getStatCard(container, 'Application In Progress').textContent).toContain('2'); // Ready to Apply + Applied (excludes Interested!)

    // Test 2: Clicking New This Week filters strictly to verified publishedAt in current Dhaka week
    await act(async () => {
      getStatCard(container, 'New This Week').click();
    });
    await flushUi(40);
    let headings = getRenderedCardHeadings(container);
    expect(headings).toHaveLength(2);
    expect(headings).toContain('Bank Assistant Director');
    expect(headings).toContain('Junior Mechanical Officer');
    expect(headings).not.toContain('College Lecturer Notice'); // no verified publishedAt
    expect(headings).not.toContain('Gov Assistant Programmer'); // last week

    // Test 3 + Test 9: Closing Soon + Search "Bank" combined filter!
    await act(async () => {
      getStatCard(container, 'Closing Soon').click();
    });
    await flushUi(40);
    headings = getRenderedCardHeadings(container);
    expect(headings).toEqual(['Bank Assistant Director', 'Gov Assistant Programmer']); // nearest deadline (2d) BEFORE 5d!

    const searchInput = container.querySelector('input[placeholder*="Search organization"]') as HTMLInputElement;
    await act(async () => {
      setReactInputValue(searchInput, 'Bank');
    });
    await flushUi(40);
    headings = getRenderedCardHeadings(container);
    expect(headings).toEqual(['Bank Assistant Director']);
    expect(getStatCard(container, 'Closing Soon').getAttribute('aria-pressed')).toBe('true');

    // Clear Filter restores all 6 valid deduplicated records
    const clearBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Clear Filter')
    ) as HTMLButtonElement;
    expect(clearBtn).toBeTruthy();
    await act(async () => {
      clearBtn.click();
    });
    await flushUi(40);
    expect(getRenderedCardHeadings(container)).toHaveLength(6);

    // Test 4: Clicking Deadline Passed (Expired) shows expired sorted most recently expired first + Expired badge + preserves DB
    await act(async () => {
      getStatCard(container, 'Deadline Passed').click();
    });
    await flushUi(40);
    headings = getRenderedCardHeadings(container);
    expect(headings).toEqual(['Recently Expired Teacher Post', 'Older Expired Medical Post']);
    expect(container.textContent).toContain('Expired');
    expect((await JobRepository.getAllJobs()).some((j) => j.id === expiredRecent.id)).toBe(true);

    // Test 5: Bookmarked + Category "Government" AND real-time unbookmark updates list immediately
    await act(async () => {
      getStatCard(container, 'Bookmarked Jobs').click();
    });
    await flushUi(40);
    expect(getRenderedCardHeadings(container)).toHaveLength(2);

    const catSelect = container.querySelector('select[aria-label="Job Category"]') as HTMLSelectElement;
    await act(async () => {
      setReactInputValue(catSelect, 'Government');
    });
    await flushUi(40);
    expect(getRenderedCardHeadings(container)).toEqual(['Gov Assistant Programmer']);

    // Toggle bookmark off while Bookmarked filter active -> list updates immediately to 0!
    const bmBtn = container.querySelector('button[title="Remove Bookmark"]') as HTMLButtonElement;
    await act(async () => {
      bmBtn.click();
    });
    await flushUi(50);
    expect(getRenderedCardHeadings(container)).toHaveLength(0);
    expect(getStatCard(container, 'Bookmarked Jobs').textContent).toContain('1');

    // Test 6: Clicking Application In Progress filters to Ready to Apply + Applied, displays statuses, opens JobDetails
    await act(async () => {
      setReactInputValue(catSelect, 'All');
    });
    await flushUi(30);
    await act(async () => {
      getStatCard(container, 'Application In Progress').click();
    });
    await flushUi(40);
    headings = getRenderedCardHeadings(container);
    expect(headings).toHaveLength(2);
    expect(container.textContent).toContain('Ready to Apply');
    expect(container.textContent).toContain('Applied');

    // Open Job Details from filtered card
    const viewDetailsBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('View Details')
    ) as HTMLButtonElement;
    await act(async () => {
      viewDetailsBtn.click();
    });
    await flushUi(30);
    expect(container.textContent).toContain('Back to Job Circulars');

    // Return back & click Total Job Circulars (Card 1) -> restores all 6
    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Back to Job Circulars')
      ) as HTMLButtonElement).click();
    });
    await flushUi(30);
    await act(async () => {
      getStatCard(container, 'Total Job Circulars').click();
    });
    await flushUi(40);
    expect(getRenderedCardHeadings(container)).toHaveLength(6);
    expect(getStatCard(container, 'Total Job Circulars').getAttribute('aria-pressed')).toBe('true');
  });

  it('7-8: Partial warning banner Sources Status opens Source Health Dashboard & Retry retries ONLY failed/partial sources cleanly', async () => {
    const workingSpy = vi.fn();
    const failedCalls = { count: 0 };

    const workingAdapter: JobSourceAdapter = {
      sourceId: 'working_mock',
      sourceName: 'Working Official Portal',
      sourceType: 'official_portal',
      officialDomain: 'working.gov.bd',
      accessMethodType: 'API',
      publisherType: 'Official',
      compatibilityStatus: 'supported',
      accessMethod: 'REST API',
      verificationLevel: 'official_verified',
      directSourceUrl: 'https://working.gov.bd/',
      notes: 'Working mock',
      async fetchJobs() {
        workingSpy();
        return {
          sourceId: 'working_mock',
          sourceName: 'Working Official Portal',
          compatibilityStatus: 'supported',
          connectionStatus: 'Working',
          accessMethodType: 'API',
          publisherType: 'Official',
          success: true,
          jobs: [],
          checkedAt: Date.now(),
        };
      },
      parseJob: (r) => normalizeJobRecord(r, { sourceId: 'working_mock', sourceName: 'Working Official Portal', verificationLevel: 'official_verified', defaultApplicationUrl: 'https://working.gov.bd/' }),
      validateJob: () => ({ isValid: true, reasons: [] }),
      getApplicationUrl: (j) => j.applicationUrl,
      getCircularUrl: (j) => j.circularUrl,
    };

    const recoverableFailedAdapter: JobSourceAdapter = {
      sourceId: 'failed_mock',
      sourceName: 'Recoverable Failed Portal',
      sourceType: 'official_bank',
      officialDomain: 'bb.org.bd',
      accessMethodType: 'HTML',
      publisherType: 'Official',
      compatibilityStatus: 'supported',
      accessMethod: 'HTML',
      verificationLevel: 'official_verified',
      directSourceUrl: 'https://bb.org.bd/',
      notes: 'Recoverable mock',
      async fetchJobs() {
        failedCalls.count += 1;
        if (failedCalls.count === 1) {
          return {
            sourceId: 'failed_mock',
            sourceName: 'Recoverable Failed Portal',
            compatibilityStatus: 'unavailable',
            connectionStatus: 'Failed',
            accessMethodType: 'HTML',
            publisherType: 'Official',
            success: false,
            jobs: [],
            checkedAt: Date.now(),
            error: 'HTTP 503 Gateway Timeout',
          };
        }
        const recoveredJob = normalizeJobRecord(
          {
            externalId: 'recovered_1',
            organization: 'Bangladesh Bank Recovered',
            jobTitle: 'Retried Officer Position',
            position: 'Retried Officer Position',
            category: 'Bank',
            publishedDateText: getDhakaDateKey(Date.now()),
            deadlineText: getDhakaDateKey(Date.now() + 4 * DAY_MS),
            applicationUrl: 'https://bb.org.bd/apply/recovered_1',
          },
          {
            sourceId: 'failed_mock',
            sourceName: 'Recoverable Failed Portal',
            verificationLevel: 'official_verified',
            defaultApplicationUrl: 'https://bb.org.bd/',
          }
        );
        return {
          sourceId: 'failed_mock',
          sourceName: 'Recoverable Failed Portal',
          compatibilityStatus: 'supported',
          connectionStatus: 'Working',
          accessMethodType: 'HTML',
          publisherType: 'Official',
          success: true,
          jobs: [recoveredJob],
          checkedAt: Date.now(),
        };
      },
      parseJob: (r) => normalizeJobRecord(r, { sourceId: 'failed_mock', sourceName: 'Recoverable Failed Portal', verificationLevel: 'official_verified', defaultApplicationUrl: 'https://bb.org.bd/' }),
      validateJob: () => ({ isValid: true, reasons: [] }),
      getApplicationUrl: (j) => j.applicationUrl,
      getCircularUrl: (j) => j.circularUrl,
    };

    const existingSeedJob = normalizeJobRecord(
      {
        externalId: 'seed_working_1',
        organization: 'Working Official Portal',
        jobTitle: 'Existing Working Position',
        position: 'Existing Working Position',
        category: 'Government',
        applicationUrl: 'https://working.gov.bd/apply/1',
      },
      { sourceId: 'working_mock', sourceName: 'Working Official Portal', verificationLevel: 'official_verified', defaultApplicationUrl: 'https://working.gov.bd/' }
    );
    await JobRepository.saveJobs([existingSeedJob]);
    await JobRepository.saveSourceOutcomes([
      {
        sourceId: 'working_mock',
        sourceName: 'Working Official Portal',
        compatibilityStatus: 'supported',
        connectionStatus: 'Working',
        accessMethodType: 'API',
        publisherType: 'Official',
        success: true,
        jobCount: 1,
        savedCount: 1,
        checkedAt: Date.now() - 60_000,
      },
      {
        sourceId: 'failed_mock',
        sourceName: 'Recoverable Failed Portal',
        compatibilityStatus: 'unavailable',
        connectionStatus: 'Failed',
        accessMethodType: 'HTML',
        publisherType: 'Official',
        success: false,
        jobCount: 0,
        savedCount: 0,
        checkedAt: Date.now() - 60_000,
        error: 'HTTP 503 Gateway Timeout',
      },
    ]);

    // Trigger initial failure on first manual Retry check? First render loads stored outcomes -> partial_failure banner is visible!
    vi.spyOn(JobSourceRegistry, 'getAll').mockReturnValue([workingAdapter, recoverableFailedAdapter]);

    // Set failedCalls.count = 1 so clicking Retry is the recovery pass (attempt 2):
    failedCalls.count = 1;

    await act(async () => {
      root.render(
        <AppProvider>
          <JobCircularPage />
        </AppProvider>
      );
    });
    await flushUi(80);

    // Partial failure banner must appear with Sources Status & Retry Failed Sources buttons
    expect(container.textContent).toContain('Partial Source Failure');
    const sourcesStatusBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Sources Status'
    ) as HTMLButtonElement;
    expect(sourcesStatusBtn).toBeTruthy();

    await act(async () => {
      sourcesStatusBtn.click();
    });
    await flushUi(30);

    const healthRegion = container.querySelector('[role="region"][aria-label*="Sources"]');
    expect(healthRegion).toBeTruthy();
    expect(healthRegion?.textContent).toContain('Working Official Portal');
    expect(healthRegion?.textContent).toContain('Recoverable Failed Portal');
    expect(healthRegion?.textContent).toContain('Error: HTTP 503 Gateway Timeout');
    expect(healthRegion?.textContent).toContain('Retrieved:');
    expect(healthRegion?.textContent).toContain('Saved:');

    // Click Retry Failed Sources in partial warning banner -> must ONLY invoke failed_mock, NOT working_mock!
    const retryFailedBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Retry Failed Sources')
    ) as HTMLButtonElement;
    expect(retryFailedBtn).toBeTruthy();

    await act(async () => {
      retryFailedBtn.click();
    });
    await flushUi(100);

    expect(failedCalls.count).toBe(2);
    expect(workingSpy).toHaveBeenCalledTimes(0); // Did NOT unnecessarily refetch already Working source!
    expect(container.textContent).toContain('Retried Officer Position');
    expect(getStatCard(container, 'Total Job Circulars').textContent).toContain('2');
    expect(getStatCard(container, 'Closing Soon').textContent).toContain('1');
    expect(container.textContent).not.toContain('Partial Source Failure'); // Resolved cleanly!
  });
});
