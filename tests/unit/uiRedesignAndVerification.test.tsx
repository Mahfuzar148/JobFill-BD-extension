// JobFill BD - UI/UX Redesign, Verification Badges, Technical ID Hiding,
// Compact Source Health & Smarter Deduplication Tests

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AppProvider } from '../../src/dashboard/context/AppContext';
import { JobCard } from '../../src/jobs/dashboard/JobCard';
import { JobDetails } from '../../src/jobs/dashboard/JobDetails';
import { JobSearchPage } from '../../src/jobs/dashboard/JobSearchPage';
import { CompactSourceHealthBar } from '../../src/jobs/dashboard/CompactSourceHealthBar';
import {
  getDetailedVerificationBadges,
  sanitizeCircularRefForDisplay,
} from '../../src/jobs/services/source-verifier';
import { deduplicateAndMergeJobs } from '../../src/jobs/services/job-deduplicator';
import { normalizeJobRecord } from '../../src/jobs/services/job-normalizer';
import { JobSourceRegistry } from '../../src/jobs/sources/source-registry';
import { JobRepository } from '../../src/jobs/database/job-repository';
import { BookmarkRepository } from '../../src/jobs/database/bookmark-repository';
import { ApplicationRepository } from '../../src/jobs/database/application-repository';
import { DAY_MS } from '../../src/jobs/services/deadline-parser';

async function flushUi(ms = 40) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

describe('JobFill BD - UI/UX Redesign, Field-Level Verification & Deduplication', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    localStorage.setItem('jobfill_language', 'en');
    await JobRepository.clearAll();
    await BookmarkRepository.clearAll();
    await ApplicationRepository.clearAll();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('hides long encoded technical IDs and raw URLs from JobCard & JobSearchPage, moving them to collapsed Technical Details', async () => {
    const encodedLongSourceId =
      'https://news.google.com/rss/articles/CBMiW0FVX3lxTE9zYV9sb25nX3NlY3JldF9oYXNoX3ZhbHVlXzEyMzQ1Njc4OTAxMjM0NTY3ODkw?oc=5';
    const rawGoogleNewsJob = normalizeJobRecord(
      {
        externalId: encodedLongSourceId,
        circularNumber: encodedLongSourceId,
        organization: 'Bangladesh Public Service Commission',
        jobTitle: 'Assistant Maintenance Engineer',
        position: 'Assistant Maintenance Engineer',
        category: 'Government',
        location: 'Dhaka',
        description: 'Official circular notice published via public recruitment portal.',
        applicationUrl: 'https://bpsc.gov.bd/site/notices/ame-2026',
        circularUrl: 'https://bpsc.gov.bd/site/notices/ame-2026.pdf',
      },
      {
        sourceId: 'google_news',
        sourceName: 'Google News Jobs BD RSS',
        verificationLevel: 'discovery_only',
        checkedAt: Date.now(),
      }
    );

    expect(sanitizeCircularRefForDisplay(encodedLongSourceId)).toBeNull();
    expect(sanitizeCircularRefForDisplay('Memo-2026/01')).toBe('Memo-2026/01');

    // Render JobCard directly
    await act(async () => {
      root.render(
        <JobCard
          job={rawGoogleNewsJob}
          isBookmarked={false}
          language="en"
          onViewDetails={() => {}}
          onApplyNow={() => {}}
          onToggleBookmark={() => {}}
        />
      );
    });
    await flushUi();

    const cardText = container.textContent || '';
    expect(cardText).toContain('Assistant Maintenance Engineer');
    expect(cardText).toContain('Bangladesh Public Service Commission');
    expect(cardText).toContain('Official Circular (PDF)');
    expect(cardText).not.toContain('CBMiW0FVX3lx');
    expect(cardText).not.toContain('news.google.com/rss/articles');
    expect(cardText).not.toContain(rawGoogleNewsJob.id);
    expect(cardText).not.toContain('https://bpsc.gov.bd/site/notices/ame-2026');

    // Save into repository and verify JobSearchPage result card also hides technical IDs & raw URLs
    await JobRepository.saveJobs([rawGoogleNewsJob]);
    await act(async () => {
      root.render(
        <AppProvider>
          <JobSearchPage />
        </AppProvider>
      );
    });
    await flushUi(80);

    const articleEl = container.querySelector('article');
    expect(articleEl).toBeTruthy();
    const articleText = articleEl?.textContent || '';
    expect(articleText).toContain('Assistant Maintenance Engineer');
    expect(articleText).not.toContain('CBMiW0FVX3lx');
    expect(articleText).not.toContain(`ID: ${rawGoogleNewsJob.id}`);
    expect(articleText).not.toContain('https://bpsc.gov.bd');

    // Open JobDetails and verify Technical Details accordion is collapsed by default
    await act(async () => {
      root.render(
        <JobDetails
          job={rawGoogleNewsJob}
          isBookmarked={false}
          language="en"
          onBack={() => {}}
          onApplyNow={() => {}}
          onToggleBookmark={() => {}}
        />
      );
    });
    await flushUi();

    const detailsEl = container.querySelector('details') as HTMLDetailsElement | null;
    expect(detailsEl).toBeTruthy();
    expect(detailsEl?.open).toBe(false);
    expect(detailsEl?.textContent).toContain('Technical Details');
    expect(detailsEl?.textContent).toContain(rawGoogleNewsJob.id);
    expect(detailsEl?.textContent).toContain('CBMiW0FVX3lx');
  });

  it('computes separate field-level verification badges and never marks .gov.bd missing-deadline jobs fully verified', async () => {
    const now = Date.now();
    const futureDate = new Date(now + 10 * DAY_MS).toISOString().slice(0, 10);

    // 1. Official .gov.bd job WITH verified deadline + published date -> Official Source + Source Verified
    const fullyVerifiedJob = normalizeJobRecord(
      {
        externalId: 'gov_full_1',
        organization: 'Department of Livestock Services',
        jobTitle: 'Veterinary Surgeon',
        position: 'Veterinary Surgeon',
        category: 'Government',
        publishedDateText: '2026-11-05',
        deadlineText: futureDate,
        applicationUrl: 'https://dls.teletalk.com.bd/',
        circularUrl: 'https://dls.gov.bd/notice.pdf',
      },
      { sourceId: 'teletalk', sourceName: 'Teletalk Alljobs', verificationLevel: 'official_verified', checkedAt: now }
    );

    const fullBadges = getDetailedVerificationBadges(fullyVerifiedJob).map((b) => b.labelEn);
    expect(fullBadges).toContain('Official Source');
    expect(fullBadges).toContain('Source Verified');
    expect(fullBadges).not.toContain('Details Partially Verified');

    // 2. Official .gov.bd job WITHOUT verified deadline -> Official Source + Details Partially Verified + Deadline Not Verified
    const officialPartialJob = normalizeJobRecord(
      {
        externalId: 'gov_partial_1',
        organization: 'Ministry of Finance',
        jobTitle: 'Office Assistant Circular',
        position: 'Office Assistant Circular',
        category: 'Government',
        publishedDateText: '2026-11-06',
        deadlineText: undefined,
        applicationUrl: 'https://mof.gov.bd/recruitment',
      },
      { sourceId: 'official_website', sourceName: 'National Portal', verificationLevel: 'official_partial', checkedAt: now }
    );

    const partialBadges = getDetailedVerificationBadges(officialPartialJob).map((b) => b.labelEn);
    expect(partialBadges).toContain('Official Source');
    expect(partialBadges).toContain('Details Partially Verified');
    expect(partialBadges).not.toContain('Source Verified');

    await act(async () => {
      root.render(
        <JobCard
          job={officialPartialJob}
          isBookmarked={false}
          language="en"
          onViewDetails={() => {}}
          onApplyNow={() => {}}
          onToggleBookmark={() => {}}
        />
      );
    });
    await flushUi();
    expect(container.textContent).toContain('Official Source');
    expect(container.textContent).toContain('Details Partially Verified');
    expect(container.textContent).toContain('Deadline Not Verified');

    // 3. Unverified Discovery job without deadline -> Unverified Discovery + Deadline Not Verified
    const unverifiedJob = normalizeJobRecord(
      {
        externalId: 'news_unv_1',
        organization: 'Career News Portal',
        jobTitle: 'District Field Officer',
        position: 'District Field Officer',
        category: 'NGO',
        applicationUrl: 'https://example-news.org/jobs/1',
      },
      { sourceId: 'google_news', sourceName: 'Google News Jobs', verificationLevel: 'discovery_only', checkedAt: now }
    );
    const unverifiedBadges = getDetailedVerificationBadges(unverifiedJob).map((b) => b.labelEn);
    expect(unverifiedBadges).toEqual(['Unverified Discovery']);
  });

  it('merges same circular across sources while keeping alternate source links and does not merge distinct circulars sharing title', () => {
    const now = Date.now();
    const sameDeadlineA = new Date(now + 12 * DAY_MS).toISOString().slice(0, 10);
    const farDeadlineB = new Date(now + 45 * DAY_MS).toISOString().slice(0, 10);

    // Same circular across Google News and BPSC official portal
    const discoveryCopy = normalizeJobRecord(
      {
        externalId: 'gn_901',
        organization: 'Bangladesh Bank',
        jobTitle: 'Officer (General)',
        position: 'Officer (General)',
        category: 'Bank',
        circularNumber: 'BB-2026-09',
        deadlineText: sameDeadlineA,
        applicationUrl: 'https://news.example.com/bb-officer',
      },
      { sourceId: 'google_news', sourceName: 'Google News RSS', verificationLevel: 'discovery_only', checkedAt: now - 1000 }
    );

    const officialCopy = normalizeJobRecord(
      {
        externalId: 'bb_901',
        organization: 'Bangladesh Bank',
        jobTitle: 'Officer (General)',
        position: 'Officer (General)',
        category: 'Bank',
        circularNumber: 'BB-2026-09',
        publishedDateText: '2026-11-01',
        deadlineText: sameDeadlineA,
        applicationUrl: 'https://erecruitment.bb.org.bd/onlineapp/joblist.php',
        circularUrl: 'https://www.bb.org.bd/circular-09.pdf',
      },
      { sourceId: 'bangladesh_bank', sourceName: 'Bangladesh Bank eRecruitment', verificationLevel: 'official_verified', checkedAt: now }
    );

    // Distinct circular sharing organization & position title, but different circularNumber and >14d later deadline
    const distinctSecondCircular = normalizeJobRecord(
      {
        externalId: 'bb_999',
        organization: 'Bangladesh Bank',
        jobTitle: 'Officer (General)',
        position: 'Officer (General)',
        category: 'Bank',
        circularNumber: 'BB-2026-44',
        deadlineText: farDeadlineB,
        applicationUrl: 'https://erecruitment.bb.org.bd/onlineapp/joblist.php?id=44',
      },
      { sourceId: 'bangladesh_bank', sourceName: 'Bangladesh Bank eRecruitment', verificationLevel: 'official_verified', checkedAt: now }
    );

    const merged1 = deduplicateAndMergeJobs([discoveryCopy], [officialCopy], now);
    expect(merged1.mergedJobs.length).toBe(1);
    expect(merged1.mergedJobs[0].sourceVerification).toBe('official_verified');
    expect(merged1.mergedJobs[0].alternateSources?.length).toBe(2);

    const merged2 = deduplicateAndMergeJobs(merged1.mergedJobs, [distinctSecondCircular], now);
    expect(merged2.mergedJobs.length).toBe(2);
  });

  it('CompactSourceHealthBar hides full table by default, counts failed sources honestly, and expands on click', async () => {
    const adapters = JobSourceRegistry.getAll().slice(0, 3);
    const outcomes = [
      { sourceId: adapters[0].sourceId, success: true, connectionStatus: 'Working', jobCount: 15, savedCount: 15 },
      { sourceId: adapters[1].sourceId, success: false, connectionStatus: 'Failed', compatibilityStatus: 'unavailable', error: 'HTTP 503', jobCount: 0, savedCount: 0 },
      { sourceId: adapters[2].sourceId, success: true, connectionStatus: 'Partially Working', jobCount: 4, savedCount: 4 },
    ];
    const onRetryFailed = vi.fn();
    let expanded = false;

    const renderBar = () => (
      <CompactSourceHealthBar
        adapters={adapters}
        outcomes={outcomes}
        lastSuccessfulSyncAt={Date.now()}
        syncing={false}
        expanded={expanded}
        onToggleExpanded={() => {
          expanded = !expanded;
          root.render(renderBar());
        }}
        onRetryFailed={onRetryFailed}
        bn={false}
      />
    );

    await act(async () => {
      root.render(renderBar());
    });
    await flushUi();

    expect(container.querySelector('[role="region"]')).toBeNull();
    expect(container.textContent).toContain('Successful: 1');
    expect(container.textContent).toContain('Partially Successful: 1');
    expect(container.textContent).toContain('Failed: 1');
    expect(container.textContent).toContain('1/3 Successful');
    expect(container.textContent).not.toContain('2/3 Successful');
    expect(container.textContent).not.toContain('3/3 Successful');

    const retryBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Retry Failed Sources')
    );
    expect(retryBtn).toBeTruthy();
    await act(async () => {
      retryBtn?.click();
    });
    expect(onRetryFailed).toHaveBeenCalledWith([adapters[1].sourceId, adapters[2].sourceId]);

    const toggleBtn = container.querySelector('[data-testid="source-health-details-toggle"]') as HTMLButtonElement;
    expect(toggleBtn).toBeTruthy();
    await act(async () => {
      toggleBtn.click();
    });
    await flushUi();

    expect(container.querySelector('[role="region"]')).toBeTruthy();
    expect(container.textContent).toContain(adapters[1].sourceName);
  });
});
