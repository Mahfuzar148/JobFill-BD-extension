// JobFill BD - Regression Tests for Bangladesh Bank CAPTCHA Failure Fix,
// Manual Verification Workflow, Cooldown/Retry Behavior, Source Health UI,
// Error Sanitization, and Teletalk published_date Priority Fix.

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AppProvider } from '../../src/dashboard/context/AppContext';
import { CompactSourceHealthBar } from '../../src/jobs/dashboard/CompactSourceHealthBar';
import { AddJobCircularModal, buildPrefillFromSourceHealthItem } from '../../src/jobs/dashboard/AddJobCircularModal';
import { JobDetails } from '../../src/jobs/dashboard/JobDetails';
import { JobCircularPage } from '../../src/jobs/dashboard/JobCircularPage';
import { BangladeshBankAdapter } from '../../src/jobs/sources/bangladesh-bank/bangladesh-bank.adapter';
import { TeletalkAdapter } from '../../src/jobs/sources/teletalk/teletalk.adapter';
import { JobSourceRegistry } from '../../src/jobs/sources/source-registry';
import { JobRepository } from '../../src/jobs/database/job-repository';
import { JobCheckService } from '../../src/jobs/background/job-check-service';
import {
  detectAccessRestrictionWithReason,
  fetchFromSources,
} from '../../src/jobs/services/job-fetcher';
import { syncBangladeshBankFromOpenTab } from '../../src/jobs/services/open-tab-portal-sync';
import {
  getDetailedVerificationBadges,
  getVerificationBadgeMeta,
} from '../../src/jobs/services/source-verifier';
import {
  computeSourceHealthSummary,
  sanitizeSourceErrorMessage,
} from '../../src/jobs/services/source-health-state';
import { isTimestampInCurrentDhakaWeek } from '../../src/jobs/services/deadline-parser';
import { normalizeJobRecord } from '../../src/jobs/services/job-normalizer';
import { JobSourceAdapter, SourceFetchOutcome } from '../../src/jobs/types/source.types';
import { DEFAULT_JOB_PREFERENCES } from '../../src/jobs/types/job.types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const TSPD_WAF_HTML = `<!DOCTYPE html>
<html>
<head>
<script type="text/javascript" src="/tspd/0812ab34cd56ef?type=11"></script>
<script type="text/javascript">
var bobcmn = {"a":"b","TSPD_101":"challenge"};
</script>
</head>
<body><noscript>Please enable JavaScript to view the page content.</noscript></body>
</html>`;

async function flushUi(ms: number = 40) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

function setInputValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const proto =
    el instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('JobFill BD - Bangladesh Bank CAPTCHA Handling & Manual Verification Regression Suite', () => {
  let container: HTMLDivElement;
  let root: Root;
  const origFetch = globalThis.fetch;
  const origGetAll = JobSourceRegistry.getAll.bind(JobSourceRegistry);

  beforeEach(async () => {
    await JobRepository.clearAll();
    await JobRepository.savePreferences({ ...DEFAULT_JOB_PREFERENCES });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    globalThis.fetch = origFetch;
    JobSourceRegistry.getAll = origGetAll;
    vi.restoreAllMocks();
  });

  it('1. Detects /tspd/ WAF challenge without bypass, stores zero CAPTCHA HTML, and never marks BB successful', async () => {
    const restricted = detectAccessRestrictionWithReason(TSPD_WAF_HTML, 200);
    expect(restricted.blockedByCaptcha).toBe(true);
    expect(restricted.blockedReason).toContain('anti-bot/CAPTCHA challenge page');

    // Existing saved BB circular in local storage must be preserved even if live fetch hits CAPTCHA
    const preSaved = normalizeJobRecord(
      {
        externalId: 'bb_existing_1',
        organization: 'Bangladesh Bank',
        jobTitle: 'Officer (Cash)',
        position: 'Officer (Cash)',
        category: 'Bank',
        publishedDateText: '2026-11-01',
        deadlineText: '2099-12-20',
        applicationUrl: 'https://erecruitment.bb.org.bd/onlineapp/apply_cash.php',
      },
      { sourceId: 'bangladesh_bank', sourceName: 'Bangladesh Bank Recruitment', verificationLevel: 'official_verified' }
    );
    await JobRepository.saveJobs([preSaved]);

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('erecruitment.bb.org.bd')) {
        return new Response(TSPD_WAF_HTML, { status: 200, headers: { 'content-type': 'text/html' } });
      }
      return new Response('<html><body>ok</body></html>', { status: 200 });
    });
    globalThis.fetch = fetchMock as any;

    const bbOutcome = await BangladeshBankAdapter.fetchJobs();
    // Called onlineapp + career once each (0 transient retries on CAPTCHA)
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(bbOutcome.success).toBe(false);
    expect(bbOutcome.compatibilityStatus).toBe('unavailable');
    expect(bbOutcome.connectionStatus).toBe('Manual Verification Required');
    expect(bbOutcome.blockedByCaptcha).toBe(true);
    expect(bbOutcome.httpStatus).toBe(200);
    expect(bbOutcome.jobs).toEqual([]);
    expect(bbOutcome.error).toContain('anti-bot/CAPTCHA');

    // Mixed partial case: onlineapp cleanly says 0 positions, career returns /tspd/ CAPTCHA -> still blocked/failed
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('onlineapp/joblist.php')) {
        return new Response('<html><body><p>There is no advertised position now.</p></body></html>', { status: 200 });
      }
      return new Response(TSPD_WAF_HTML, { status: 200 });
    }) as any;

    const mixedBlockedOutcome = await BangladeshBankAdapter.fetchJobs();
    expect(mixedBlockedOutcome.success).toBe(false);
    expect(mixedBlockedOutcome.blockedByCaptcha).toBe(true);
    expect(mixedBlockedOutcome.jobs).toEqual([]);

    // Working sibling source still succeeds and pre-saved BB record stays intact
    const okWorkingAdapter: JobSourceAdapter = {
      sourceId: 'test_working',
      sourceName: 'Test Working Portal',
      sourceType: 'official_portal',
      officialDomain: 'teletalk.com.bd',
      compatibilityStatus: 'supported',
      accessMethod: 'JSON API',
      verificationLevel: 'official_verified',
      directSourceUrl: 'https://alljobs.teletalk.com.bd/',
      notes: 'ok',
      async fetchJobs() {
        return {
          sourceId: 'test_working',
          sourceName: 'Test Working Portal',
          compatibilityStatus: 'supported',
          connectionStatus: 'Working',
          success: true,
          checkedAt: Date.now(),
          jobs: [
            normalizeJobRecord(
              {
                externalId: 'w_1',
                organization: 'BPSC',
                jobTitle: 'Assistant Engineer',
                position: 'Assistant Engineer',
                deadlineText: '2099-12-30',
                applicationUrl: 'https://bpsc.teletalk.com.bd/',
              },
              { sourceId: 'test_working', sourceName: 'Test Working Portal', verificationLevel: 'official_verified' }
            ),
          ],
        };
      },
      parseJob: (raw) => normalizeJobRecord(raw, { sourceId: 'test_working', sourceName: 'Test Working Portal', verificationLevel: 'official_verified' }),
      validateJob: () => ({ isValid: true, hasVerifiedDeadline: true, errors: [] }),
      getApplicationUrl: (r) => r.applicationUrl || null,
      getCircularUrl: (r) => r.circularUrl,
    };

    JobSourceRegistry.getAll = () => [BangladeshBankAdapter, okWorkingAdapter];
    globalThis.fetch = fetchMock as any;
    const report = await JobCheckService.runFullCheck({ forceDigest: false });

    const storedAfter = await JobRepository.getAllJobs();
    expect(storedAfter.some((j) => j.id === preSaved.id)).toBe(true);
    expect(storedAfter.some((j) => JSON.stringify(j).includes('/tspd/'))).toBe(false);
    expect(storedAfter.some((j) => j.jobTitle === 'Assistant Engineer')).toBe(true);
    const reportBb = report.sourceOutcomes.find((o) => o.sourceId === 'bangladesh_bank');
    expect(reportBb?.success).toBe(false);
    expect(reportBb?.status).toBe('MANUAL_VERIFICATION_REQUIRED');
    expect(reportBb?.openPortalUrl).toBe('https://erecruitment.bb.org.bd/');
    expect(reportBb?.lastSuccessfulFetchAt).toBeNull();
    expect(reportBb?.savedCount).toBe(0);
    expect(report.sourceHealth?.manualVerificationSources).toBe(1);
    expect(report.sourceHealth?.captchaBlockedSources).toBe(1);
    expect(report.sourceHealth?.failedSources).toBe(0);
    expect(report.sourceHealth?.successfulSources).toBe(1);
  });

  it('2. Suppresses repeated automatic polling and rapid <60s manual retries on CAPTCHA-blocked endpoints', async () => {
    const fetchSpy = vi.fn(async () => new Response(TSPD_WAF_HTML, { status: 200 }));
    globalThis.fetch = fetchSpy as any;

    const now = Date.now();
    const recentBlockedOutcome: SourceFetchOutcome = {
      sourceId: 'bangladesh_bank',
      sourceName: 'Bangladesh Bank Recruitment',
      compatibilityStatus: 'unavailable',
      connectionStatus: 'Failed',
      accessMethodType: 'HTML',
      publisherType: 'Official',
      success: false,
      jobs: [],
      savedCount: 0,
      checkedAt: now - 15_000, // 15s ago
      httpStatus: 200,
      blockedByCaptcha: true,
      retryAfterMs: now + 45_000,
      error: 'Portal returned an anti-bot/CAPTCHA challenge page — automatic extraction halted per policy.',
      directPortalUrl: 'https://erecruitment.bb.org.bd/',
    };

    const prevMap = new Map([['bangladesh_bank', recentBlockedOutcome]]);

    // Automatic check within 6h cooldown must NOT hit blocked portal again
    const autoOutcomes = await fetchFromSources([BangladeshBankAdapter], undefined, {
      respectCooldowns: true,
      isManualRetry: false,
      previousOutcomesById: prevMap,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(0);
    expect(autoOutcomes[0].success).toBe(false);
    expect(autoOutcomes[0].blockedByCaptcha).toBe(true);
    expect(autoOutcomes[0].skippedByCooldown).toBe(true);

    // Rapid manual retry within 60s interval must ALSO NOT hit blocked portal again
    const rapidManualOutcomes = await fetchFromSources([BangladeshBankAdapter], undefined, {
      respectCooldowns: false,
      isManualRetry: true,
      previousOutcomesById: prevMap,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(0);
    expect(rapidManualOutcomes[0].blockedByCaptcha).toBe(true);

    // Manual retry AFTER >60s interval performs one clean check and retains failed CAPTCHA status if still blocked
    const agedBlockedOutcome: SourceFetchOutcome = {
      ...recentBlockedOutcome,
      checkedAt: now - 65_000,
      retryAfterMs: now - 5_000,
    };
    const agedManualOutcomes = await fetchFromSources([BangladeshBankAdapter], undefined, {
      respectCooldowns: false,
      isManualRetry: true,
      previousOutcomesById: new Map([['bangladesh_bank', agedBlockedOutcome]]),
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(agedManualOutcomes[0].success).toBe(false);
    expect(agedManualOutcomes[0].blockedByCaptcha).toBe(true);
    expect(agedManualOutcomes[0].jobs).toEqual([]);
  });

  it('3. Manual verification workflow validates URLs, preserves sourceUrl/history, and marks records Pending Verification', async () => {
    expect(getVerificationBadgeMeta('user_submitted').labelEn).toBe(
      'Manually Added — Official Source Pending Verification'
    );

    const bbItem = computeSourceHealthSummary([BangladeshBankAdapter], [
      {
        sourceId: 'bangladesh_bank',
        sourceName: 'Bangladesh Bank Recruitment',
        compatibilityStatus: 'unavailable',
        connectionStatus: 'Failed',
        success: false,
        jobs: [],
        checkedAt: Date.now() - 70_000,
        httpStatus: 200,
        blockedByCaptcha: true,
        error: 'Portal returned an anti-bot/CAPTCHA challenge page — automatic extraction halted per policy.',
      },
    ]).sources[0];

    const prefill = buildPrefillFromSourceHealthItem(bbItem);
    expect(prefill.organization).toBe('Bangladesh Bank');
    expect(prefill.organizationUrl).toBe(BangladeshBankAdapter.directSourceUrl);
    expect(prefill.category).toBe('Bank');

    const savedJobs: any[] = [];
    await act(async () => {
      root.render(
        <AddJobCircularModal
          language="en"
          prefill={prefill}
          onClose={() => {}}
          onSave={async (job) => {
            savedJobs.push(job);
            await JobRepository.saveJob(job);
          }}
        />
      );
    });
    await flushUi();

    const posInput = container.querySelector('input[placeholder*="Assistant Programmer"]') as HTMLInputElement;
    const appUrlInput = container.querySelector('input[placeholder*="bogmc.teletalk.com.bd"]') as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;

    // Rejects javascript: unsafe URL scheme even when prefilled
    await act(async () => {
      setInputValue(posInput, 'Assistant Director (General)');
      setInputValue(appUrlInput, 'javascript:alert(1)');
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flushUi();
    expect(savedJobs.length).toBe(0);

    // Accepts valid https circular URL & saves cleanly
    await act(async () => {
      setInputValue(appUrlInput, 'https://erecruitment.bb.org.bd/onlineapp/ad_circular_2026.php');
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flushUi();

    expect(savedJobs).toHaveLength(1);
    const saved = savedJobs[0];
    expect(saved.sourceVerification).toBe('user_submitted');
    expect(saved.sourceUrl).toBe(BangladeshBankAdapter.directSourceUrl);
    expect(saved.verificationHistory?.length).toBeGreaterThanOrEqual(1);
    expect(saved.verificationHistory?.[0].action).toBe(
      'Manually Added — Official Source Pending Verification'
    );
    expect(saved.verificationHistory?.[0].sourceUrl).toBe(BangladeshBankAdapter.directSourceUrl);
    expect(typeof saved.verificationHistory?.[0].timestamp).toBe('number');

    const badges = getDetailedVerificationBadges(saved).map((b) => b.labelEn);
    expect(badges).toContain('Manually Added — Official Source Pending Verification');
    expect(badges).not.toContain('Official Source');
    expect(badges).not.toContain('Source Verified');

    // JobDetails renders the pending-verification badge, sourceUrl, and Verification History
    await act(async () => {
      root.render(
        <JobDetails
          job={saved}
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
    await flushUi();
    expect(container.textContent).toContain('Manually Added — Official Source Pending Verification');
    expect(container.textContent).toContain('Verification History');
    expect(container.textContent).toContain(BangladeshBankAdapter.directSourceUrl);
  });

  it('4. CompactSourceHealthBar shows Manual Verification Required, CAPTCHA status, sanitized error, counts, and action buttons', async () => {
    expect(
      sanitizeSourceErrorMessage('HTTP 403 at https://api.reliefweb.int/v2/jobs?appname=secret-token Bearer xyz123')
    ).toBe('HTTP 403 at https://api.reliefweb.int/v2/jobs Bearer [redacted]');

    const now = Date.now();
    const outcomes: SourceFetchOutcome[] = [
      {
        sourceId: 'bangladesh_bank',
        sourceName: 'Bangladesh Bank Recruitment',
        compatibilityStatus: 'unavailable',
        connectionStatus: 'Failed',
        accessMethodType: 'HTML',
        publisherType: 'Official',
        success: false,
        jobs: [],
        savedCount: 0,
        checkedAt: now - 90_000,
        lastSuccessfulFetchAt: null,
        httpStatus: 200,
        blockedByCaptcha: true,
        retryAfterMs: now - 30_000,
        error: 'Portal returned an anti-bot/CAPTCHA challenge page at https://erecruitment.bb.org.bd/?token=secret',
        directPortalUrl: 'https://erecruitment.bb.org.bd/',
      },
    ];

    const onOpenManualAdd = vi.fn();
    const onRetrySingleSource = vi.fn();

    await act(async () => {
      root.render(
        <CompactSourceHealthBar
          adapters={[BangladeshBankAdapter]}
          outcomes={outcomes}
          lastSuccessfulSyncAt={null}
          syncing={false}
          expanded={true}
          onToggleExpanded={() => {}}
          onRetryFailed={() => {}}
          onRetrySingleSource={onRetrySingleSource}
          onOpenManualAdd={onOpenManualAdd}
          bn={false}
        />
      );
    });
    await flushUi();

    const text = container.textContent || '';
    expect(text).toContain('Bangladesh Bank Recruitment');
    expect(text).toContain('Manual Verification Required');
    expect(text).toContain('Automatic Fetch: Halted (CAPTCHA/Anti-Bot)');
    expect(text).toContain('Records Retrieved: 0');
    expect(text).toContain('Records Saved: 0');
    expect(text).toContain('HTTP 200');
    expect(text).toContain('Last Attempted:');
    expect(text).toContain('Last Successful:');
    expect(text).toContain('Retry Availability:');
    expect(text).not.toContain('token=secret');

    const portalLink = Array.from(container.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Open Official Portal')
    );
    expect(portalLink?.getAttribute('href')).toBe('https://erecruitment.bb.org.bd/');

    const addManualBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Add Circular Manually')
    );
    const checkAgainBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Check Again')
    );
    expect(addManualBtn).toBeTruthy();
    expect(checkAgainBtn).toBeTruthy();

    await act(async () => {
      addManualBtn?.click();
      checkAgainBtn?.click();
    });
    expect(onOpenManualAdd).toHaveBeenCalledTimes(1);
    expect(onRetrySingleSource).toHaveBeenCalledWith('bangladesh_bank');

    // Integration inside JobCircularPage: clicking Add Circular Manually opens prefilled AddJobCircularModal
    await JobRepository.saveSourceOutcomes(outcomes);
    JobSourceRegistry.getAll = () => [BangladeshBankAdapter];
    await act(async () => {
      root.render(
        <AppProvider>
          <JobCircularPage />
        </AppProvider>
      );
    });
    await flushUi(80);
    const toggleBtn = container.querySelector('[data-testid="source-health-details-toggle"]') as HTMLButtonElement;
    await act(async () => {
      toggleBtn?.click();
    });
    await flushUi();
    const pageManualBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Add Circular Manually') || b.textContent?.includes('ম্যানুয়াল সার্কুলার যোগ করুন')
    ) as HTMLButtonElement;
    await act(async () => {
      pageManualBtn?.click();
    });
    await flushUi();
    const modalOrgInput = container.querySelector('input[placeholder*="PetroBangla"]') as HTMLInputElement;
    expect(modalOrgInput?.value).toBe('Bangladesh Bank');
  });

  it('5. TeletalkAdapter prefers published_date over created_at so historical circulars are not inflated into New This Week', () => {
    const fakeNow = Date.parse('2026-11-11T12:00:00+06:00');
    const historicalParsed = TeletalkAdapter.parseJob(
      {
        externalId: 'tt_old_row_1',
        organization: 'Bangladesh Computer Council',
        jobTitle: 'Programmer',
        position: 'Programmer',
        publishedDateText: '2026-10-15', // old circular date
        deadlineText: '2026-11-25',
        applicationUrl: 'https://bcc.teletalk.com.bd/',
      },
      fakeNow
    );
    expect(isTimestampInCurrentDhakaWeek(historicalParsed.publishedAt, fakeNow)).toBe(false);

    // Direct JSON payload check via TeletalkAdapter.fetchJobs
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/published-jobs/search')) {
        return new Response(
          JSON.stringify({
            count: 1,
            govtJobs: [
              {
                job_primary_id: 9091,
                job_id: 'GJOB9091',
                job_title: 'Historical Officer',
                org_name: 'Cabinet Division',
                deadline_date: '2099-12-20',
                published_date: '2026-10-15',
                created_at: '2026-11-10T10:00:00Z', // DB ingest date this week!
                application_site_url: 'https://cab.teletalk.com.bd/',
              },
            ],
          }),
          { status: 200 }
        );
      }
      return new Response('{}', { status: 404 });
    }) as any;

    return TeletalkAdapter.fetchJobs().then((out) => {
      expect(out.success).toBe(true);
      expect(out.jobs).toHaveLength(1);
      expect(isTimestampInCurrentDhakaWeek(out.jobs[0].publishedAt, fakeNow)).toBe(false);
    });
  });

  it('6. Smart CAPTCHA inference, localized BN retry UI, Hub Bank fallback pill, and human-in-the-loop open tab sync', async () => {
    // Even if a legacy cached outcome lacks blockedByCaptcha boolean, error text infers CAPTCHA block cleanly
    const legacyOutcome: SourceFetchOutcome = {
      sourceId: 'bangladesh_bank',
      sourceName: 'Bangladesh Bank Recruitment',
      compatibilityStatus: 'unavailable',
      connectionStatus: 'Failed',
      accessMethodType: 'HTML',
      publisherType: 'Official',
      success: false,
      jobs: [],
      checkedAt: Date.now() - 10_000,
      error: 'Portal returned an anti-bot/CAPTCHA challenge page — automatic extraction halted per policy.',
      directPortalUrl: BangladeshBankAdapter.directSourceUrl,
    };

    const inferredSummary = computeSourceHealthSummary([BangladeshBankAdapter], [legacyOutcome]);
    expect(inferredSummary.captchaBlockedSources).toBe(1);
    expect(inferredSummary.sources[0].blockedByCaptcha).toBe(true);
    expect(inferredSummary.sources[0].retryAvailabilityNoteBn).toContain('ক্যাপচা বিরতি চলছে');

    // Deep-body WAF challenge beyond first 4KB still detected safely
    const paddedChallenge = `${'<!-- spacer -->'.repeat(350)}\n<script src="/tspd/0812?type=1"></script><script>var bobcmn={};</script>`;
    expect(detectAccessRestrictionWithReason(paddedChallenge, 200).blockedByCaptcha).toBe(true);
    expect(detectAccessRestrictionWithReason('<div class="cf-turnstile"></div>', 200).blockedByCaptcha).toBe(true);

    // Bank job already stored in Hub + BN card displays localized UI + View Bank Jobs + Sync from Open Tab
    const existingBankJob = normalizeJobRecord(
      {
        externalId: 'tt_bank_1',
        organization: 'Sonali Bank PLC',
        jobTitle: 'Senior Officer',
        position: 'Senior Officer',
        category: 'Bank',
        deadlineText: '2099-12-25',
        applicationUrl: 'https://bb.teletalk.com.bd/',
      },
      { sourceId: 'teletalk', sourceName: 'Teletalk All Jobs', verificationLevel: 'official_verified' }
    );

    const onSyncFromOpenTab = vi.fn();
    const onViewBankJobs = vi.fn();

    await act(async () => {
      root.render(
        <CompactSourceHealthBar
          adapters={[BangladeshBankAdapter]}
          outcomes={[legacyOutcome]}
          jobs={[existingBankJob]}
          lastSuccessfulSyncAt={null}
          syncing={false}
          expanded={true}
          onToggleExpanded={() => {}}
          onRetryFailed={() => {}}
          onRetrySingleSource={() => {}}
          onSyncFromOpenTab={onSyncFromOpenTab}
          onViewBankJobs={onViewBankJobs}
          bn={true}
        />
      );
    });
    await flushUi();

    const bnCardText = container.textContent || '';
    expect(bnCardText).toContain('ম্যানুয়াল যাচাই প্রয়োজন');
    expect(bnCardText).toContain('হাব-এ ব্যাংক সার্কুলার: ১টি');
    expect(bnCardText).not.toContain('Ready to check');

    const syncTabBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('খোলা ট্যাব থেকে সিঙ্ক')
    );
    const viewBankBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('ব্যাংক চাকরি দেখুন')
    );
    await act(async () => {
      syncTabBtn?.click();
      viewBankBtn?.click();
    });
    expect(onSyncFromOpenTab).toHaveBeenCalledTimes(1);
    expect(onViewBankJobs).toHaveBeenCalledTimes(1);

    // Human-in-the-loop open tab sync:
    // Case A: no BB tab open -> opens official portal cleanly
    const origChrome = (globalThis as any).chrome;
    const tabsCreateSpy = vi.fn(async () => ({ id: 99 }));
    const tabsUpdateSpy = vi.fn(async () => ({}));
    (globalThis as any).chrome = {
      ...origChrome,
      tabs: {
        query: vi.fn(async () => []),
        create: tabsCreateSpy,
        update: tabsUpdateSpy,
        sendMessage: vi.fn(),
      },
    };
    const openRes = await syncBangladeshBankFromOpenTab();
    expect(openRes.status).toBe('opened_portal');
    expect(tabsCreateSpy).toHaveBeenCalledTimes(1);

    // Case B: open BB tab still has CAPTCHA -> refuses to bypass and focuses tab
    (globalThis as any).chrome.tabs.query = vi.fn(async () => [
      { id: 77, url: 'https://erecruitment.bb.org.bd/career/jobopportunity.php' },
    ]);
    (globalThis as any).chrome.tabs.sendMessage = vi.fn(async () => ({
      status: 'captcha_present',
      url: 'https://erecruitment.bb.org.bd/career/jobopportunity.php',
    }));
    const blockedTabRes = await syncBangladeshBankFromOpenTab();
    expect(blockedTabRes.status).toBe('captcha_present');
    expect(tabsUpdateSpy).toHaveBeenCalledWith(77, { active: true });

    // Case C: user verified in browser & open tab now renders real BB circular table -> imports & clears block
    const cleanCareerHtml = `
      <table><tbody>
        <tr>
          <td>415</td>
          <td>Advertisement</td>
          <td><strong>Officer (IT) — Bankers Selection Committee</strong></td>
          <td><a href="20261111_bsc_it.pdf">Download</a></td>
          <td>11/11/2026</td>
          <td>28/11/2026</td>
        </tr>
      </tbody></table>`;
    (globalThis as any).chrome.tabs.sendMessage = vi.fn(async () => ({
      status: 'ok',
      url: 'https://erecruitment.bb.org.bd/career/jobopportunity.php',
      html: cleanCareerHtml,
    }));
    const importedRes = await syncBangladeshBankFromOpenTab();
    expect(importedRes.status).toBe('imported');
    expect(importedRes.importedCount).toBe(1);
    const storedJobs = await JobRepository.getAllJobs();
    expect(storedJobs.some((j) => j.position.includes('Officer (IT)'))).toBe(true);
    const updatedOutcomes = await JobRepository.getSourceOutcomes();
    const updatedBb = updatedOutcomes.find((o: any) => o.sourceId === 'bangladesh_bank');
    expect(updatedBb?.blockedByCaptcha).toBe(false);
    expect(updatedBb?.success).toBe(true);
    (globalThis as any).chrome = origChrome;
  });
});
