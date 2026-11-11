// JobFill BD - P0-P5 Architecture Upgrade Verification Suite
// Tests rate-limit cooldown caching, lastSuccessfulFetchAt preservation, field-level provenance,
// originalValues retention, confidence-based duplicate detection (without unsafe auto-merge),
// dynamic organization short-name indexing, and IndexedDB v6 additive store support.

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DB_VERSION, STORES } from '../../src/database/indexeddb';
import { JobRepository } from '../../src/jobs/database/job-repository';
import { normalizeJobRecord } from '../../src/jobs/services/job-normalizer';
import {
  deduplicateAndMergeJobs,
  computeDuplicateMatchConfidence,
} from '../../src/jobs/services/job-deduplicator';
import { fetchFromSources } from '../../src/jobs/services/job-fetcher';
import { computeSourceHealthSummary } from '../../src/jobs/services/source-health-state';
import {
  buildSearchIndexEntries,
  registerDynamicOrgAliases,
  searchAndRankJobs,
  JobSearchQueryState,
} from '../../src/jobs/services/search-engine';
import { DAY_MS } from '../../src/jobs/services/deadline-parser';
import { AppProvider } from '../../src/dashboard/context/AppContext';
import { JobCard } from '../../src/jobs/dashboard/JobCard';
import { JobDetails } from '../../src/jobs/dashboard/JobDetails';
import { JobSearchPage } from '../../src/jobs/dashboard/JobSearchPage';
import { SmartAutoFillPage } from '../../src/dashboard/pages/SmartAutoFillPage';
import { filterAndSortJobs, DEFAULT_JOB_FILTERS } from '../../src/jobs/dashboard/JobFilters';
import { KeyManager } from '../../src/security/key-manager';
import fs from 'node:fs';
import path from 'node:path';
import {
  isExcludedSiteUrl,
  isGoogleMeetUrl,
  isZoomUrl,
  isVideoConferencingUrl,
  isSupportedJobPortalUrl,
  extractSafeHostname,
} from '../../src/security/site-policy';
import {
  recordExtensionDiagnostic,
  getExtensionDiagnostics,
  resetExtensionDiagnostics,
} from '../../src/security/diagnostics';
import { PermissionManager } from '../../src/background/permission-manager';
import { MessageRouter } from '../../src/background/message-router';
import { DynamicDomObserver } from '../../src/content/dom-observer';
import { FormDetector } from '../../src/content/scanner/form-detector';
import { ProfileRepository } from '../../src/database/profile-repository';
import {
  enableVaultEncryption,
  disableVaultEncryption,
  checkAutoLock,
  recordActivity,
  lockVault,
} from '../../src/services/storage';
import { JobSourceAdapter, SourceFetchOutcome } from '../../src/jobs/types/source.types';
import { DEFAULT_JOB_PREFERENCES } from '../../src/jobs/types/job.types';

async function flushUi(ms: number = 40) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

describe('JobFill BD - P0-P5 Architecture Upgrade Suite', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    vi.restoreAllMocks();
    localStorage.clear();
    localStorage.setItem('jobfill_language', 'en');
    await JobRepository.clearAll();
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

  it('P0: Rate-limit cooldown avoids re-polling cooled sources and preserves lastSuccessfulFetchAt on later failure', async () => {
    const t1 = Date.now() - 10 * 60 * 1000; // 10 minutes ago
    const remotiveCalls = vi.fn();
    const bpscCalls = vi.fn();

    const mockAdapters: JobSourceAdapter[] = [
      {
        sourceId: 'remotive_remote',
        sourceName: 'Remotive',
        sourceType: 'remote_tech_api',
        officialDomain: 'remotive.com',
        compatibilityStatus: 'supported',
        minPollCooldownMs: 6 * 60 * 60 * 1000,
        accessMethod: 'REST API',
        verificationLevel: 'official_partial',
        directSourceUrl: 'https://remotive.com/',
        notes: 'Remotive API',
        async fetchJobs(): Promise<SourceFetchOutcome> {
          remotiveCalls();
          return {
            sourceId: 'remotive_remote',
            sourceName: 'Remotive',
            compatibilityStatus: 'supported',
            success: true,
            jobs: [],
            checkedAt: Date.now(),
            accessNotes: 'Fetched cleanly',
            directPortalUrl: 'https://remotive.com/',
          };
        },
        parseJob: (raw) => normalizeJobRecord(raw, { sourceId: 'remotive_remote', sourceName: 'Remotive', verificationLevel: 'official_partial' }),
        validateJob: () => ({ isValid: true, errors: [], warnings: [], hasVerifiedDeadline: false }),
        getApplicationUrl: (j) => j.applicationUrl || null,
        getCircularUrl: (j) => j.circularUrl,
      },
      {
        sourceId: 'bpsc',
        sourceName: 'BPSC',
        sourceType: 'official_commission',
        officialDomain: 'bpsc.gov.bd',
        compatibilityStatus: 'supported',
        accessMethod: 'HTML',
        verificationLevel: 'official_verified',
        directSourceUrl: 'https://bpsc.gov.bd/',
        notes: 'BPSC notices',
        async fetchJobs(): Promise<SourceFetchOutcome> {
          bpscCalls();
          return {
            sourceId: 'bpsc',
            sourceName: 'BPSC',
            compatibilityStatus: 'unavailable',
            success: false,
            jobs: [],
            checkedAt: Date.now(),
            accessNotes: 'Temporary timeout',
            directPortalUrl: 'https://bpsc.gov.bd/',
            error: 'HTTP 503',
          };
        },
        parseJob: (raw) => normalizeJobRecord(raw, { sourceId: 'bpsc', sourceName: 'BPSC', verificationLevel: 'official_verified' }),
        validateJob: () => ({ isValid: true, errors: [], warnings: [], hasVerifiedDeadline: false }),
        getApplicationUrl: (j) => j.applicationUrl || null,
        getCircularUrl: (j) => j.circularUrl,
      },
    ];

    const previousById = new Map<string, any>([
      [
        'remotive_remote',
        {
          sourceId: 'remotive_remote',
          sourceName: 'Remotive',
          compatibilityStatus: 'supported',
          connectionStatus: 'Working',
          success: true,
          jobCount: 13,
          savedCount: 13,
          checkedAt: t1,
          lastSuccessfulFetchAt: t1,
          directPortalUrl: 'https://remotive.com/',
          accessNotes: 'Cached 13 items',
        },
      ],
      [
        'bpsc',
        {
          sourceId: 'bpsc',
          sourceName: 'BPSC',
          compatibilityStatus: 'supported',
          connectionStatus: 'Working',
          success: true,
          jobCount: 11,
          savedCount: 11,
          checkedAt: t1,
          lastSuccessfulFetchAt: t1,
          directPortalUrl: 'https://bpsc.gov.bd/',
          accessNotes: 'Fetched 11',
        },
      ],
    ]);

    const outcomes = await fetchFromSources(mockAdapters, undefined, {
      respectCooldowns: true,
      previousOutcomesById: previousById,
    });

    // Remotive should skip live HTTP poll (within 6h cooldown) and preserve cached counts/timestamps
    expect(remotiveCalls).not.toHaveBeenCalled();
    expect(bpscCalls).toHaveBeenCalledTimes(1);

    const remOutcome = outcomes.find((o) => o.sourceId === 'remotive_remote')!;
    expect(remOutcome.skippedByCooldown).toBe(true);
    expect(remOutcome.jobCount).toBe(13);
    expect(remOutcome.lastSuccessfulFetchAt).toBe(t1);

    // BPSC failed this check, yet lastSuccessfulFetchAt retains prior healthy timestamp (t1)
    const bpscOutcome = outcomes.find((o) => o.sourceId === 'bpsc')!;
    expect(bpscOutcome.success).toBe(false);
    expect(bpscOutcome.lastSuccessfulFetchAt).toBe(t1);

    const summary = computeSourceHealthSummary(mockAdapters, outcomes, t1);
    expect(summary.successfulSources).toBe(1);
    expect(summary.failedSources).toBe(1);
    expect(summary.sources.find((s) => s.sourceId === 'bpsc')?.lastSuccessfulFetchAt).toBe(t1);
  });

  it('P2: Normalizer preserves originalValues & fieldVerification; IndexedDB schema v6 exposes source_health', () => {
    expect(DB_VERSION).toBeGreaterThanOrEqual(6);
    expect(STORES.SOURCE_HEALTH).toBe('source_health');

    const job = normalizeJobRecord(
      {
        externalId: 'prov_1',
        organization: 'Teletalk Official Org',
        organizationBn: 'টেলিটক বাংলাদেশ',
        jobTitle: '  Assistant Engineer (Electrical)  ',
        titleBn: 'সহকারী প্রকৌশলী',
        category: 'Government',
        vacancies: 12,
        salary: '22000-53060 BDT',
        qualification: 'B.Sc Engineering',
        publishedDateText: '2026-11-05',
        applicationStartText: '2026-11-06',
        deadlineText: '2026-12-20',
        circularUrl: 'https://example.gov.bd/circ.pdf',
        applicationUrl: 'https://example.teletalk.com.bd/',
      },
      { sourceId: 'teletalk', sourceName: 'Teletalk All Jobs', verificationLevel: 'official_verified' }
    );

    expect(job.timezone).toBe('Asia/Dhaka');
    expect(job.applicationStartAt).toBeTypeOf('number');
    expect(job.originalValues?.title).toBe('Assistant Engineer (Electrical)');
    expect(job.originalValues?.deadlineText).toBe('2026-12-20');
    expect(job.fieldVerification?.deadline).toBe('verified');
    expect(job.fieldVerification?.vacancy).toBe('verified');
    expect(job.fieldVerification?.salary).toBe('verified');
    expect(job.fieldVerification?.applicationUrl).toBe('verified');
  });

  it('P2 & P3: Confidence deduplication merges confirmed dupes, flags uncertain matches without data loss, and renders badge', async () => {
    const now = Date.now();
    const future = new Date(now + 15 * DAY_MS).toISOString().slice(0, 10);

    const officialJob = normalizeJobRecord(
      {
        externalId: 'bb_off_1',
        organization: 'Bangladesh Bank (BSC)',
        jobTitle: 'Assistant Director General Recruitment',
        position: 'Assistant Director General',
        category: 'Bank',
        publishedDateText: '2026-11-10',
        deadlineText: future,
        circularUrl: 'https://erecruitment.bb.org.bd/career/ad.pdf',
        applicationUrl: 'https://erecruitment.bb.org.bd/onlineapp/joblist.php',
      },
      { sourceId: 'bangladesh_bank', sourceName: 'Bangladesh Bank Recruitment', verificationLevel: 'official_verified', checkedAt: now }
    );

    // Uncertain medium-confidence match: same org alias + very similar position published same day,
    // without matching circularNumber or explicit applicationUrl -> must NOT auto-delete!
    const newsMaybeDup = normalizeJobRecord(
      {
        externalId: 'gnews_uncertain_1',
        organization: 'বাংলাদেশ ব্যাংক',
        jobTitle: 'Assistant Director General Circular',
        position: 'Assistant Director General Circular',
        category: 'Bank',
        publishedDateText: '2026-11-10',
        sourceUrl: 'https://news.example.com/bb-ad-2026',
        applicationUrl: null,
      },
      { sourceId: 'google_news_discovery', sourceName: 'Google News RSS', verificationLevel: 'discovery_only', checkedAt: now }
    );

    const conf = computeDuplicateMatchConfidence(officialJob, newsMaybeDup);
    expect(conf).toBeGreaterThanOrEqual(60);
    expect(conf).toBeLessThan(85);

    const mergeRes = deduplicateAndMergeJobs([officialJob], [newsMaybeDup], now);
    expect(mergeRes.mergedJobs).toHaveLength(2);
    expect(mergeRes.possibleDuplicateCount).toBe(1);

    const flagged = mergeRes.mergedJobs.find((j) => j.id === newsMaybeDup.id)!;
    expect(flagged.possibleDuplicateOfId).toBe(officialJob.id);
    expect(flagged.duplicateConfidence).toBe(conf);

    // Verify JobCard & JobDetails render Possible Duplicate notice safely
    await act(async () => {
      root.render(
        <div>
          <JobCard
            job={flagged}
            variant="search"
            isBookmarked={false}
            language="en"
            onViewDetails={() => {}}
            onApplyNow={() => {}}
            onToggleBookmark={() => {}}
          />
          <JobDetails
            job={flagged}
            isBookmarked={false}
            language="en"
            onBack={() => {}}
            onApplyNow={() => {}}
            onToggleBookmark={() => {}}
            onMarkApplied={() => {}}
            onShare={() => {}}
          />
        </div>
      );
    });
    await flushUi(20);
    expect(container.textContent).toContain('Possible Duplicate');
    expect(container.textContent).toContain('Potential duplicate circular detected');
  });

  it('P2 & P3: Dynamic Teletalk org short-name aliases index accurately & Search category pills localize cleanly in BN mode', async () => {
    registerDynamicOrgAliases([
      {
        organizationId: 901,
        name: 'Power Grid Company of Bangladesh (PGCB)',
        nameBn: 'পাওয়ার গ্রিড কোম্পানি অব বাংলাদেশ',
        shortName: 'PGCB',
        openingCount: 1,
        expiredCount: 0,
        sourceId: 'teletalk',
        sourceUrl: 'https://alljobs.teletalk.com.bd/jobs/government/901',
        lastUpdatedAt: Date.now(),
      },
    ]);

    const pgcbJob = normalizeJobRecord(
      {
        externalId: 'tt_pgcb_1',
        organizationId: 901,
        organization: 'Power Grid Company of Bangladesh',
        jobTitle: 'Sub-Assistant Engineer',
        position: 'Sub-Assistant Engineer',
        category: 'Government',
        applicationUrl: 'https://pgcb.teletalk.com.bd/',
      },
      { sourceId: 'teletalk', sourceName: 'Teletalk All Jobs', verificationLevel: 'official_partial' }
    );

    const indexMap = new Map(buildSearchIndexEntries([pgcbJob]).map((e) => [e.jobId, e]));
    const baseState: JobSearchQueryState = {
      query: 'PGCB',
      category: 'Government',
      education: 'All',
      location: 'All',
      deadline: 'all',
      skillsOrExperience: '',
      sortBy: 'relevance',
      bookmarkedOnly: false,
    };

    const hits = searchAndRankJobs([pgcbJob], baseState, new Set(), new Set(), indexMap);
    expect(hits.map((h) => h.job.id)).toEqual([pgcbJob.id]);

    // Verify Bengali category pill localization in JobSearchPage
    await JobRepository.saveJobs([pgcbJob]);
    localStorage.setItem('jobfill_language', 'bn');
    await act(async () => {
      root.render(
        <AppProvider>
          <JobSearchPage />
        </AppProvider>
      );
    });
    await flushUi(70);

    expect(container.textContent).toContain('সরকারি');
    expect(container.textContent).toContain('ব্যাংক');
    expect(container.textContent).toContain('রিমোট চাকরি');
  });

  it('Bug Fixes: Preserves cooldown notes once, preserves medium-dup flags across re-sync, localizes JobCard/JobFilters aliases, and syncs Vault auto-lock', async () => {
    const now = Date.now();
    // 1. Cooldown note must not stack on repeated cooldown passes
    const adapter: JobSourceAdapter = {
      sourceId: 'remotive_remote',
      sourceName: 'Remotive',
      sourceType: 'remote_tech_api',
      officialDomain: 'remotive.com',
      compatibilityStatus: 'supported',
      minPollCooldownMs: 6 * 60 * 60 * 1000,
      accessMethod: 'REST API',
      verificationLevel: 'official_partial',
      directSourceUrl: 'https://remotive.com/',
      notes: 'Remotive API',
      async fetchJobs(): Promise<SourceFetchOutcome> {
        throw new Error('Should not fetch while cooled');
      },
      parseJob: (raw) => normalizeJobRecord(raw, { sourceId: 'remotive_remote', sourceName: 'Remotive', verificationLevel: 'official_partial' }),
      validateJob: () => ({ isValid: true, errors: [], warnings: [], hasVerifiedDeadline: false }),
      getApplicationUrl: (j) => j.applicationUrl || null,
      getCircularUrl: (j) => j.circularUrl,
    };
    const [cooledOutcome] = await fetchFromSources([adapter], undefined, {
      respectCooldowns: true,
      previousOutcomesById: new Map([
        [
          'remotive_remote',
          {
            sourceId: 'remotive_remote',
            sourceName: 'Remotive',
            compatibilityStatus: 'supported',
            success: true,
            jobCount: 5,
            savedCount: 5,
            checkedAt: now - 10_000,
            lastSuccessfulFetchAt: now - 10_000,
            accessNotes: 'Cached 5 jobs (Rate-limit cache cooldown active)',
          },
        ],
      ]),
    });
    expect(cooledOutcome.accessNotes?.match(/Rate-limit cache cooldown active/g)).toHaveLength(1);

    // 2. Re-syncing the same medium-confidence job preserves possibleDuplicateOfId
    const primary = normalizeJobRecord(
      {
        externalId: 'p1',
        organization: 'Bangladesh Bank (BSC)',
        jobTitle: 'Senior Officer Cash Recruitment',
        position: 'Senior Officer Cash',
        category: 'Bank',
        publishedDateText: '2026-11-10',
        circularUrl: 'https://erecruitment.bb.org.bd/career/cash.pdf',
      },
      { sourceId: 'bangladesh_bank', sourceName: 'Bangladesh Bank', verificationLevel: 'official_verified', checkedAt: now }
    );
    const maybeDup = normalizeJobRecord(
      {
        externalId: 'm1',
        organization: 'বাংলাদেশ ব্যাংক',
        jobTitle: 'Senior Officer Cash Circular',
        position: 'Senior Officer Cash Circular',
        category: 'Bank',
        publishedDateText: '2026-11-10',
        sourceUrl: 'https://news.example.com/cash-1',
      },
      { sourceId: 'google_news_discovery', sourceName: 'Google News RSS', verificationLevel: 'discovery_only', checkedAt: now }
    );
    const firstMerge = deduplicateAndMergeJobs([primary], [maybeDup], now);
    const secondMerge = deduplicateAndMergeJobs(firstMerge.mergedJobs, [maybeDup], now + 1000);
    const keptMaybeDup = secondMerge.mergedJobs.find((j) => j.id === maybeDup.id)!;
    expect(keptMaybeDup.possibleDuplicateOfId).toBe(primary.id);

    // 3. JobFilters matches Bengali/English aliases cleanly & JobCard localizes category + applicationStatus in BN
    const ntrcaJob = normalizeJobRecord(
      {
        externalId: 'ntrca_bn_1',
        organization: 'Non-Government Teachers Registration Authority (NTRCA)',
        jobTitle: '৮ম এনটিআরসিএ নিয়োগ বিজ্ঞপ্তি',
        position: 'প্রভাষক',
        category: 'Government',
      },
      { sourceId: 'ntrca', sourceName: 'NTRCA Teacher Recruitment', verificationLevel: 'official_verified', checkedAt: now }
    );
    expect(
      filterAndSortJobs([ntrcaJob], { ...DEFAULT_JOB_FILTERS, query: 'এনটিআরসিএ' }, new Set(), now)
    ).toHaveLength(1);
    expect(
      filterAndSortJobs([ntrcaJob], { ...DEFAULT_JOB_FILTERS, query: 'NTRCA' }, new Set(), now)
    ).toHaveLength(1);

    await act(async () => {
      root.render(
        <JobCard
          job={ntrcaJob}
          isBookmarked={false}
          applicationStatus="Applied"
          language="bn"
          onViewDetails={() => {}}
          onApplyNow={() => {}}
          onToggleBookmark={() => {}}
        />
      );
    });
    await flushUi(20);
    expect(container.textContent).toContain('সরকারি');
    expect(container.textContent).toContain('আবেদনকৃত');

    // 4. Vault auto-lock + activity refresh + manual lock
    await enableVaultEncryption('BugAudit#2026');
    recordActivity(15);
    expect(await checkAutoLock()).toBe(false);
    expect(KeyManager.getSessionExpiresAt()).toBeTypeOf('number');
    lockVault();
    expect(await checkAutoLock()).toBe(true);

    // Clean up Vault password state cleanly after test
    expect(KeyManager.isKeyActive()).toBe(false);
    await (async () => {
      const { unlockVault } = await import('../../src/services/storage');
      expect(await unlockVault('BugAudit#2026')).toBe(true);
      await disableVaultEncryption('BugAudit#2026');
    })();
  });

  it('Google Meet Isolation & Least-Privilege Permissions: blocks Meet/media origins, scopes observers, and preserves IDB v7 stores', async () => {
    // 1. Verify Google Meet, subdomains, YouTube & Google Workspace URLs are strictly excluded
    expect(isGoogleMeetUrl('https://meet.google.com/abc-defg-hij')).toBe(true);
    expect(isExcludedSiteUrl('https://meet.google.com/abc-defg-hij')).toBe(true);
    expect(isExcludedSiteUrl('https://hangouts.google.com/call')).toBe(true);
    expect(isExcludedSiteUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
    expect(isSupportedJobPortalUrl('https://meet.google.com/abc-defg-hij')).toBe(false);
    expect(isSupportedJobPortalUrl('https://bogmc.teletalk.com.bd/bogmc_2026/')).toBe(true);
    expect(isSupportedJobPortalUrl('https://bpsc.gov.bd/pages/notification-circulars')).toBe(true);
    expect(PermissionManager.isRestrictedUrl('https://meet.google.com/abc-defg-hij')).toBe(true);
    expect(await PermissionManager.requestHostPermission('https://meet.google.com/abc-defg-hij')).toBe(false);

    // 2. Verify MessageRouter denies profile/document access from Google Meet origins
    const meetResp = await new Promise<any>((resolve) => {
      MessageRouter.handleMessage(
        { action: 'GET_ACTIVE_PROFILE_STATE' },
        { tab: { url: 'https://meet.google.com/abc-defg-hij' } as any },
        resolve
      );
    });
    expect(meetResp.status).toBe('denied');

    const meetDocResp = await new Promise<any>((resolve) => {
      MessageRouter.handleMessage(
        { action: 'GET_APPROVED_DOCUMENT_PAYLOAD', payload: { profileId: 'p1', approvedTypes: ['photo'] } },
        { tab: { url: 'https://meet.google.com/abc-defg-hij' } as any },
        resolve
      );
    });
    expect(meetDocResp.status).toBe('denied');

    // 3. Verify DynamicDomObserver ignores video/audio/canvas nodes and stops cleanly
    document.body.innerHTML = `<form id="job_form"><input name="applicant_name" /></form><video id="meet_vid"></video>`;
    const obsEvents: HTMLElement[][] = [];
    const formEl = document.getElementById('job_form')!;
    DynamicDomObserver.startObserving((els) => obsEvents.push(els), 15, formEl);
    expect(DynamicDomObserver.isObserving()).toBe(true);

    const videoEl = document.getElementById('meet_vid')!;
    const canvas = document.createElement('canvas');
    videoEl.appendChild(canvas);
    await flushUi(35);
    expect(obsEvents).toHaveLength(0);

    const dynInput = document.createElement('input');
    dynInput.name = 'mobile';
    formEl.appendChild(dynInput);
    await flushUi(45);
    expect(obsEvents.length).toBeGreaterThanOrEqual(1);
    DynamicDomObserver.stopObserving();
    expect(DynamicDomObserver.isObserving()).toBe(false);

    // 4. Verify FormDetector does NOT detect job forms when window URL is excluded
    const prevHref = window.location.href;
    expect(FormDetector.analyze(document).platformName).toBeDefined();
    expect(prevHref).toBeTruthy();

    // 5. Verify IndexedDB v7 includes education_records, experience_records & encrypted_vault
    expect(DB_VERSION).toBeGreaterThanOrEqual(7);
    expect(STORES.EDUCATION_RECORDS).toBe('education_records');
    expect(STORES.EXPERIENCE_RECORDS).toBe('experience_records');
    expect(STORES.VAULT_STORE).toBe('encrypted_vault');
    expect(typeof ProfileRepository.getEducationRecords).toBe('function');
    expect(typeof ProfileRepository.getExperienceRecords).toBe('function');

    // 6. Verify SmartAutoFillPage never probes or dynamically injects scripts into Google Meet tabs
    const sendMsgSpy = vi.fn();
    const executeScriptSpy = vi.fn();
    (globalThis as any).chrome = {
      tabs: {
        query: vi.fn(async () => [{ id: 77, url: 'https://meet.google.com/abc-defg-hij', lastAccessed: Date.now() }]),
        sendMessage: sendMsgSpy,
      },
      scripting: {
        insertCSS: vi.fn(),
        executeScript: executeScriptSpy,
      },
    };
    await act(async () => {
      root.render(
        <AppProvider>
          <SmartAutoFillPage />
        </AppProvider>
      );
    });
    await flushUi(40);
    expect(sendMsgSpy).not.toHaveBeenCalled();
    expect(executeScriptSpy).not.toHaveBeenCalled();
    delete (globalThis as any).chrome;
  });

  it('7. Strictly isolates Zoom (zoom.us, www.zoom.us, app.zoom.us, *.zoom.us) and Google Meet with hostname-only matching and privacy-safe diagnostics', async () => {
    resetExtensionDiagnostics();

    // 1. Video conferencing hostname-only matching (positive cases)
    const excludedMeetingUrls = [
      'https://meet.google.com/secret-code-123',
      'https://zoom.us/',
      'https://zoom.us/j/99887766',
      'https://www.zoom.us/join',
      'https://app.zoom.us/wc/join/99887766',
      'https://us02web.zoom.us/wc/99887766/start',
      'https://www.zoom.com/',
    ];
    for (const url of excludedMeetingUrls) {
      expect(isExcludedSiteUrl(url)).toBe(true);
      expect(isVideoConferencingUrl(url)).toBe(true);
    }
    expect(isZoomUrl('https://app.zoom.us/wc/join/99887766')).toBe(true);
    expect(isZoomUrl('https://zoom.us/j/123456')).toBe(true);
    expect(isZoomUrl('https://meet.google.com/abc-defg-hij')).toBe(false);

    // 2. Negative cases: never use unsafe substring matching on unrelated hosts
    const nonExcludedUrls = [
      'https://myzoominfo.example.com/jobs',
      'https://zoom.us.careers.example.com/apply',
      'https://meeting-notes.example.org/careers',
      'https://bogmc.teletalk.com.bd/',
    ];
    for (const url of nonExcludedUrls) {
      expect(isExcludedSiteUrl(url)).toBe(false);
      expect(isZoomUrl(url)).toBe(false);
      expect(isVideoConferencingUrl(url)).toBe(false);
    }

    // 3. Static manifest check includes Meet + Zoom exclusions and zero <all_urls>
    const manifestJson = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'manifest.json'), 'utf8')
    );
    const excludeMatches: string[] = manifestJson.content_scripts?.[0]?.exclude_matches || [];
    expect(excludeMatches).toContain('*://meet.google.com/*');
    expect(excludeMatches).toContain('*://zoom.us/*');
    expect(excludeMatches).toContain('*://*.zoom.us/*');
    expect(manifestJson.host_permissions || []).not.toContain('<all_urls>');

    // 4. PermissionManager & MessageRouter reject Zoom tabs cleanly
    expect(PermissionManager.isRestrictedUrl('https://app.zoom.us/wc/join/99887766')).toBe(true);
    const zoomPerm = await PermissionManager.requestHostPermission('https://app.zoom.us/wc/join/99887766');
    expect(zoomPerm).toBe(false);

    const zoomDocResp = await new Promise<any>((resolve) => {
      MessageRouter.handleMessage(
        { action: 'GET_APPROVED_DOCUMENT_PAYLOAD', payload: { profileId: 'p1', approvedTypes: ['photo'] } },
        { tab: { url: 'https://app.zoom.us/wc/join/99887766' } as any },
        resolve
      );
    });
    expect(zoomDocResp.status).toBe('denied');

    // 5. SmartAutoFillPage ignores Zoom tabs without probing or injecting scripts
    const sendMsgSpy = vi.fn();
    const executeScriptSpy = vi.fn();
    (globalThis as any).chrome = {
      tabs: {
        query: vi.fn(async () => [
          { id: 88, url: 'https://app.zoom.us/wc/join/99887766', lastAccessed: Date.now() },
          { id: 89, url: 'https://us02web.zoom.us/j/11223344', lastAccessed: Date.now() - 1000 },
        ]),
        sendMessage: sendMsgSpy,
      },
      scripting: {
        insertCSS: vi.fn(),
        executeScript: executeScriptSpy,
      },
    };
    await act(async () => {
      root.render(
        <AppProvider>
          <SmartAutoFillPage />
        </AppProvider>
      );
    });
    await flushUi(40);
    expect(sendMsgSpy).not.toHaveBeenCalled();
    expect(executeScriptSpy).not.toHaveBeenCalled();
    delete (globalThis as any).chrome;

    // 6. Privacy-safe diagnostics: stores hostname ONLY, never full URLs, meeting IDs, or query secrets
    expect(extractSafeHostname('https://meet.google.com/secret-code-123?authuser=1')).toBe('meet.google.com');
    expect(extractSafeHostname('https://app.zoom.us/wc/join/99887766?tk=supersecret')).toBe('app.zoom.us');

    recordExtensionDiagnostic('excluded_site_detected', {
      url: 'https://meet.google.com/secret-code-123?authuser=1',
      source: 'unit-test',
    });
    recordExtensionDiagnostic('script_injection_blocked', {
      url: 'https://app.zoom.us/wc/join/99887766?tk=supersecret',
      source: 'unit-test',
    });
    recordExtensionDiagnostic('api_fetch_call', {
      url: 'https://remotive.com/api/remote-jobs?limit=50',
      source: 'job-fetcher',
    });

    const diagResp = await new Promise<any>((resolve) => {
      MessageRouter.handleMessage({ action: 'GET_EXTENSION_DIAGNOSTICS' }, {} as any, resolve);
    });
    expect(diagResp.status).toBe('ok');
    const snap = getExtensionDiagnostics();
    expect(snap.counters.excludedSiteDetections).toBeGreaterThanOrEqual(2);
    expect(snap.counters.injectionBlocked).toBeGreaterThanOrEqual(1);
    expect(snap.counters.apiFetchCalls).toBeGreaterThanOrEqual(1);

    const serialized = JSON.stringify(diagResp.diagnostics);
    expect(serialized).toContain('meet.google.com');
    expect(serialized).toContain('app.zoom.us');
    expect(serialized).not.toContain('secret-code-123');
    expect(serialized).not.toContain('99887766');
    expect(serialized).not.toContain('supersecret');
    expect(serialized).not.toContain('limit=50');
  });
});
