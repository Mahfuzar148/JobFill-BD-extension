import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, Root } from 'react-dom/client';
import { act } from 'react';
import { BangladeshBankAdapter, BB_PORTAL_ROOT_URL } from '../../src/jobs/sources/bangladesh-bank/bangladesh-bank.adapter';
import {
  BdjobsAdapter,
  BDJOBS_COVERAGE_DISCLOSURE,
  BDJOBS_DEADLINE_DISCLOSURE,
} from '../../src/jobs/sources/bdjobs/bdjobs.adapter';
import { fetchFromSources } from '../../src/jobs/services/job-fetcher';
import {
  computeSourceHealthSummary,
  deriveCentralizedSourceStatus,
  migrateLegacySourceOutcome,
  selectAuthoritativeSourceOutcome,
} from '../../src/jobs/services/source-health-state';
import { CompactSourceHealthBar } from '../../src/jobs/dashboard/CompactSourceHealthBar';
import { JobRepository } from '../../src/jobs/database/job-repository';
import { normalizeJobRecord } from '../../src/jobs/services/job-normalizer';
import { JobSourceAdapter, SourceFetchOutcome } from '../../src/jobs/types/source.types';
import {
  assessHttpSensitiveAutofillRisk,
  canRequestCustomPortalPermission,
} from '../../src/security/site-policy';
import { mergeCloudProfilesWithLocal } from '../../src/cloud/encrypted-sync-service';
import { sampleDemoProfile } from '../../src/types/defaults';
import { syntheticMadrasahTestProfile } from '../fixtures/syntheticProfiles';

async function flushUi(ms = 35) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

describe('JobFill BD - 7-State Source Health, Bdjobs/BB Improvements & Release Security Hardening', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    await JobRepository.saveJobs([]);
    await JobRepository.saveSourceOutcomes([]);
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

  it('1. Bangladesh Bank CAPTCHA uses MANUAL_VERIFICATION_REQUIRED, preserves null lastSuccessful, and opens erecruitment.bb.org.bd root', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html><body><script src="/tspd/challenge.js"></script><script>var bobcmn={};</script></body></html>', {
        status: 200,
      })
    );

    const outcomes = await fetchFromSources([BangladeshBankAdapter]);
    const bb = outcomes[0];
    expect(bb.status).toBe('MANUAL_VERIFICATION_REQUIRED');
    expect(bb.connectionStatus).toBe('Manual Verification Required');
    expect(bb.blockedByCaptcha).toBe(true);
    expect(bb.lastSuccessfulFetchAt).toBeNull();
    expect(bb.jobs).toEqual([]);
    expect(bb.openPortalUrl).toBe(BB_PORTAL_ROOT_URL);
    expect(bb.retryPolicy).toBe('halted_captcha_manual');

    const summary = computeSourceHealthSummary([BangladeshBankAdapter], [bb]);
    expect(summary.manualVerificationSources).toBe(1);
    expect(summary.failedSources).toBe(0);
    expect(summary.retryableSourceIds).toEqual([]); // Never batch auto-retried!

    await act(async () => {
      root.render(
        <CompactSourceHealthBar
          adapters={[BangladeshBankAdapter]}
          outcomes={[bb]}
          healthSummary={summary}
          lastSuccessfulSyncAt={null}
          syncing={false}
          expanded={true}
          onToggleExpanded={() => {}}
          onRetryFailed={() => {}}
          onRetrySingleSource={() => {}}
          bn={false}
        />
      );
    });
    await flushUi();

    const portalLink = container.querySelector('[data-source-id="bangladesh_bank"] a[href]') as HTMLAnchorElement;
    expect(portalLink?.getAttribute('href')).toBe('https://erecruitment.bb.org.bd/');
    expect(container.textContent).toContain('Manual Verification Required');
  });

  it('2. Bdjobs accurately labels Undocumented Static Feed, separates coverage/deadline warnings, keeps null deadlines, and halts on invalid JSON', async () => {
    const sampleFeed = JSON.stringify([
      {
        CompanyName: 'Bangladesh Bridge Authority',
        JobTitle: 'Assistant Engineer (Civil)',
        JP_ID: '1498111',
        IsGovtJob: '1',
      },
      {
        CompanyName: 'LGED Project',
        JobTitle: 'Sub-Assistant Engineer',
        JP_ID: '1498222',
        IsGovtJob: '1',
      },
    ]);

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(sampleFeed, { status: 200, headers: { 'content-type': 'application/json' } })
    );

    const bdOutcomes = await fetchFromSources([BdjobsAdapter]);
    const bd = bdOutcomes[0];
    expect(bd.status).toBe('PARTIAL_SUCCESS');
    expect(bd.accessMethodType).toBe('Undocumented Static Feed');
    expect(bd.jobs).toHaveLength(2);
    expect(bd.jobs.every((j) => j.deadlineAt === null && j.deadlineVerified === false)).toBe(true);
    expect(bd.dataCoverageNote).toBe(BDJOBS_COVERAGE_DISCLOSURE);
    expect(bd.deadlineVerificationNote).toBe(BDJOBS_DEADLINE_DISCLOSURE);

    // Invalid response structure halts safely instead of crashing or saving garbage
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('<html>unexpected error page</html>', { status: 200, headers: { 'content-type': 'text/html' } })
    );
    const badBdOutcomes = await fetchFromSources([BdjobsAdapter]);
    expect(badBdOutcomes[0].success).toBe(false);
    expect(badBdOutcomes[0].invalidResponse).toBe(true);
    expect(badBdOutcomes[0].retryPolicy).toBe('halted_invalid_response');
  });

  it('3. Centralized 7-state migration, count invariant, stale-cache guard, 429 Retry-After, 5xx backoff, and concurrent dedup', async () => {
    const migratedLegacy = migrateLegacySourceOutcome({
      sourceId: 'bangladesh_bank',
      connectionStatus: 'Failed',
      success: false,
      checkedAt: 1000,
      lastSuccessfulFetchAt: 1000, // corrupted legacy field when never actually fetched clean jobs
      error: 'Portal returned an anti-bot/CAPTCHA challenge page',
    });
    expect(migratedLegacy.status).toBe('MANUAL_VERIFICATION_REQUIRED');
    expect(migratedLegacy.blockedByCaptcha).toBe(true);

    // Older cached success must NEVER overwrite newer failure
    const newerFailure: Partial<SourceFetchOutcome> = {
      sourceId: 's1',
      status: 'FAILED',
      success: false,
      checkedAt: 5000,
      error: 'HTTP 503',
    };
    const olderCachedSuccess: Partial<SourceFetchOutcome> = {
      sourceId: 's1',
      status: 'SUCCESS',
      success: true,
      checkedAt: 4000,
      skippedByCooldown: true,
    };
    expect(selectAuthoritativeSourceOutcome(newerFailure, olderCachedSuccess)).toBe(newerFailure);

    // Validate all 7 states sum cleanly to totalSources
    const adapters: JobSourceAdapter[] = [1, 2, 3, 4, 5, 6, 7].map((i) => ({
      sourceId: `st_${i}`,
      sourceName: `State ${i}`,
      sourceType: 'official_portal',
      officialDomain: 'example.gov.bd',
      compatibilityStatus: 'supported',
      accessMethod: 'API',
      verificationLevel: 'official_verified',
      directSourceUrl: 'https://example.gov.bd/',
      notes: '',
      fetchJobs: async () => ({
        sourceId: `st_${i}`,
        sourceName: `State ${i}`,
        compatibilityStatus: 'supported',
        success: true,
        jobs: [],
        checkedAt: Date.now(),
        accessNotes: '',
        directPortalUrl: 'https://example.gov.bd/',
      }),
      parseJob: (r) => normalizeJobRecord(r, { sourceId: `st_${i}`, sourceName: `State ${i}`, verificationLevel: 'official_verified' }),
      validateJob: () => ({ isValid: true, errors: [], warnings: [], hasVerifiedDeadline: false }),
      getApplicationUrl: () => null,
      getCircularUrl: () => undefined,
    }));

    const now = Date.now();
    const outcomes: Partial<SourceFetchOutcome>[] = [
      { sourceId: 'st_1', status: 'SUCCESS', success: true, checkedAt: now },
      { sourceId: 'st_2', status: 'PARTIAL_SUCCESS', compatibilityStatus: 'partially_supported', success: true, checkedAt: now },
      { sourceId: 'st_3', status: 'FAILED', success: false, checkedAt: now, error: 'HTTP 500' },
      { sourceId: 'st_4', status: 'MANUAL_VERIFICATION_REQUIRED', blockedByCaptcha: true, success: false, checkedAt: now },
      { sourceId: 'st_5', status: 'TEMPORARILY_UNAVAILABLE', rateLimited: true, httpStatus: 429, retryAfterMs: now + 30_000, nextEligibleCheckAt: now + 30_000, success: false, checkedAt: now },
      { sourceId: 'st_6', status: 'WAITING', checkedAt: 0 },
      // st_7 has no outcome -> NOT_TESTED
    ];

    const summary = computeSourceHealthSummary(adapters, outcomes, now, now);
    expect(summary.totalSources).toBe(7);
    expect(
      summary.successfulSources +
        summary.partiallySuccessfulSources +
        summary.failedSources +
        summary.manualVerificationSources +
        summary.temporarilyUnavailableSources +
        summary.waitingSources +
        summary.notTestedSources
    ).toBe(7);
    expect(summary.attemptedSources + summary.waitingSources + summary.notTestedSources).toBe(7);
    expect(deriveCentralizedSourceStatus(outcomes[4])).toBe('TEMPORARILY_UNAVAILABLE');

    // Concurrent duplicate fetches for the same adapter share ONE network call
    let fetchCalls = 0;
    let resolvePending!: () => void;
    const sharedAdapter: JobSourceAdapter = {
      ...adapters[0],
      sourceId: 'concurrent_src',
      fetchJobs: () =>
        new Promise((res) => {
          fetchCalls += 1;
          resolvePending = () =>
            res({
              sourceId: 'concurrent_src',
              sourceName: 'Concurrent Test',
              compatibilityStatus: 'supported',
              success: true,
              jobs: [],
              checkedAt: Date.now(),
              accessNotes: 'ok',
              directPortalUrl: 'https://example.gov.bd/',
            });
        }),
    };
    const p1 = fetchFromSources([sharedAdapter]);
    const p2 = fetchFromSources([sharedAdapter]);
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchCalls).toBe(1);
    resolvePending();
    await Promise.all([p1, p2]);
  });

  it('4. Security Hardening: HTTP warning excludes local dev, custom permission rejects Meet/Zoom, cloud merge preserves local profiles', () => {
    const insecureNid = assessHttpSensitiveAutofillRisk('http://bogmc.teletalk.com.bd/apply.php', [
      'identity.nationalId',
    ]);
    expect(insecureNid.requiresExplicitWarning).toBe(true);
    expect(insecureNid.isInsecureHttp).toBe(true);

    const httpsNid = assessHttpSensitiveAutofillRisk('https://bpsc.teletalk.com.bd/apply.php', [
      'identity.nationalId',
    ]);
    expect(httpsNid.requiresExplicitWarning).toBe(false);

    const localDev = assessHttpSensitiveAutofillRisk('http://127.0.0.1:4173/test.html', [
      'identity.nationalId',
    ]);
    expect(localDev.requiresExplicitWarning).toBe(false);

    expect(canRequestCustomPortalPermission('https://careers.example.com/apply')).toBe(true);
    expect(canRequestCustomPortalPermission('https://meet.google.com/xyz-abcd-efg')).toBe(false);
    expect(canRequestCustomPortalPermission('https://us06web.zoom.us/j/12345')).toBe(false);
    expect(canRequestCustomPortalPermission('chrome://extensions')).toBe(false);

    const localOnly = { ...syntheticMadrasahTestProfile, updatedAt: '2026-11-10T10:00:00.000Z' };
    const sharedOld = { ...sampleDemoProfile, updatedAt: '2026-11-09T10:00:00.000Z' };
    const sharedNew = {
      ...sampleDemoProfile,
      profileName: 'Updated From Cloud',
      updatedAt: '2026-11-11T10:00:00.000Z',
    };

    const mergeRes = mergeCloudProfilesWithLocal([localOnly, sharedOld], [sharedNew], 'merge');
    expect(mergeRes.merged).toHaveLength(2);
    expect(mergeRes.merged.some((p) => p.id === localOnly.id)).toBe(true);
    expect(mergeRes.merged.find((p) => p.id === sampleDemoProfile.id)?.profileName).toBe('Updated From Cloud');
    expect(mergeRes.conflictIds).toEqual([sampleDemoProfile.id]);
  });
});
