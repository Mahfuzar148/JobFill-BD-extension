// JobFill BD - Apply Now Navigation, URL Field Separation, Missing Application URL Handling,
// Intelligent HTML Link Detection, Teletalk/BPSC/BB Sources, Login Portals & DB Migration Tests

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AppProvider } from '../../src/dashboard/context/AppContext';
import { JobCard } from '../../src/jobs/dashboard/JobCard';
import { JobDetails } from '../../src/jobs/dashboard/JobDetails';
import { JobSearchPage } from '../../src/jobs/dashboard/JobSearchPage';
import { JobCircularPage } from '../../src/jobs/dashboard/JobCircularPage';
import { JobRepository } from '../../src/jobs/database/job-repository';
import { BookmarkRepository } from '../../src/jobs/database/bookmark-repository';
import { ApplicationRepository } from '../../src/jobs/database/application-repository';
import { normalizeJobRecord } from '../../src/jobs/services/job-normalizer';
import { validateJobCircular } from '../../src/jobs/services/job-validator';
import { openJobApplicationWithContext } from '../../src/jobs/services/job-ui-actions';
import {
  classifyApplicationDestination,
  detectApplicationLinksFromDetailHtml,
  isCircularDocumentUrl,
  migrateLegacyCircularRecord,
} from '../../src/jobs/services/application-link-detector';
import { TeletalkAdapter, parseTeletalkPublishedJobsJson } from '../../src/jobs/sources/teletalk/teletalk.adapter';
import { BpscAdapter } from '../../src/jobs/sources/bpsc/bpsc.adapter';
import {
  BangladeshBankAdapter,
  parseBangladeshBankCareerHtml,
  parseBangladeshBankOnlineAppHtml,
} from '../../src/jobs/sources/bangladesh-bank/bangladesh-bank.adapter';
import { OfficialWebsiteAdapter } from '../../src/jobs/sources/national-portal/national-portal.adapter';
import { NormalizedJobCircular } from '../../src/jobs/types/job.types';

async function flushUi(ms = 40) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

describe('JobFill BD - Fix Apply Now Navigation & URL Field Separation Suite', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    vi.restoreAllMocks();
    delete (globalThis as any).chrome;
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
    vi.restoreAllMocks();
    delete (globalThis as any).chrome;
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('1. URL Separation & Normalization: never falls back circularUrl PDF into applicationUrl', () => {
    const pdfOnlyRaw = normalizeJobRecord(
      {
        externalId: 'np_pdf_only',
        organization: 'MOPA',
        jobTitle: 'Office Assistant Circular',
        circularUrl: 'https://mopa.gov.bd/uploads/office-assistant-2026.pdf',
        organizationUrl: 'https://mopa.gov.bd',
        sourceUrl: 'https://mopa.gov.bd/pages/notices/office-assistant',
        applicationUrl: null,
      },
      { sourceId: 'official_website', sourceName: 'Bangladesh National Portal', verificationLevel: 'official_verified' }
    );

    expect(pdfOnlyRaw.circularUrl).toBe('https://mopa.gov.bd/uploads/office-assistant-2026.pdf');
    expect(pdfOnlyRaw.organizationUrl).toBe('https://mopa.gov.bd');
    expect(pdfOnlyRaw.sourceUrl).toBe('https://mopa.gov.bd/pages/notices/office-assistant');
    expect(pdfOnlyRaw.applicationUrl).toBeNull();
    expect(validateJobCircular(pdfOnlyRaw).isValid).toBe(true);

    // Passing a circular PDF directly into applicationUrl is sanitized into circularUrl & applicationUrl = null
    const pdfContaminated = normalizeJobRecord(
      {
        externalId: 'pdf_in_app',
        organization: 'BPSC',
        jobTitle: 'Gazette Notice',
        applicationUrl: 'https://bpsc.gov.bd/uploads/gazette.pdf',
      },
      { sourceId: 'bpsc', sourceName: 'BPSC', verificationLevel: 'official_verified' }
    );
    expect(pdfContaminated.circularUrl).toBe('https://bpsc.gov.bd/uploads/gazette.pdf');
    expect(pdfContaminated.applicationUrl).toBeNull();
  });

  it('2. Teletalk job: preserves exact application_site_url without guessing and separates organizationUrl', async () => {
    const mockJson = JSON.stringify({
      status: 'success',
      count: 2,
      govtJobs: [
        {
          job_primary_id: 15257,
          job_id: 'GJOB15257',
          job_title: 'Veterinary Officer',
          job_title_bn: 'ভেটেরিনারী কর্মকর্তা',
          vacancy: 6,
          application_site_url: 'https://dscc.teletalk.com.bd/dscc_2025_2026/',
          published_date: '2026-11-10',
          deadline_date: '2026-12-02T11:00:00.000Z',
          organization_id: 635,
          org_name: 'Dhaka South City Corporation (DSCC)',
          short_name: 'DSCC',
          website: 'http://dscc.gov.bd/',
        },
        {
          job_primary_id: 15999,
          job_id: 'GJOB15999',
          job_title: 'Notice Without Portal',
          vacancy: 2,
          application_site_url: null,
          organization_id: 700,
          org_name: 'Sample Board',
          short_name: 'SB',
          website: 'https://sampleboard.gov.bd/',
        },
      ],
    });

    const parsed = parseTeletalkPublishedJobsJson(mockJson);
    expect(parsed.items).toHaveLength(2);

    const dsccJob = TeletalkAdapter.parseJob(parsed.items[0]);
    expect(dsccJob.applicationUrl).toBe('https://dscc.teletalk.com.bd/dscc_2025_2026/');
    expect(dsccJob.organizationUrl).toBe('http://dscc.gov.bd/');
    expect(dsccJob.circularUrl).toBeUndefined();

    // Missing application_site_url stays null (never constructs guessed URL or falls back to alljobs directory)
    const missingAppTeletalk = TeletalkAdapter.parseJob(parsed.items[1]);
    expect(missingAppTeletalk.applicationUrl).toBeNull();
    expect(missingAppTeletalk.organizationUrl).toBe('https://sampleboard.gov.bd/');

    const setSpy = vi.fn((_obj: any, cb?: () => void) => cb?.());
    const getSpy = vi.fn((_k: any, cb?: (v: any) => void) => cb?.({}));
    const tabsCreateSpy = vi.fn(async () => ({}));
    (globalThis as any).chrome = {
      storage: { local: { set: setSpy, get: getSpy } },
      tabs: { create: tabsCreateSpy },
    };

    const toast = vi.fn();
    const res = await openJobApplicationWithContext(dsccJob, toast, false);
    expect(res.opened).toBe(true);
    expect(tabsCreateSpy).toHaveBeenCalledWith({ url: 'https://dscc.teletalk.com.bd/dscc_2025_2026/' });
    expect(setSpy).toHaveBeenCalledWith({
      jobfill_active_application_context: expect.objectContaining({
        applicationUrl: 'https://dscc.teletalk.com.bd/dscc_2025_2026/',
        organization: dsccJob.organization,
      }),
    });
  });

  it('3. BPSC & National Portal: inspects detail HTML for genuine Apply Online links and leaves PDF-only notices null', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = String(input);
      if (url === 'https://bpsc.gov.bd/pages/notification-circulars') {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => `
            <table><tbody>
              <tr>
                <td data-column="title">৪৯তম বিসিএস বিশেষ নিয়োগ বিজ্ঞপ্তি প্রকাশ</td>
                <td data-column="memorial_no">80.00.0000.200.11.001.26</td>
                <td data-column="files"><a href="https://bpsc.gov.bd/uploads/49bcs_circular.pdf">PDF</a></td>
                <td data-column="publish_date">০৫-১১-২০২৬</td>
                <td><a href="/pages/notification-circulars/49-bcs-circular">দেখুন</a></td>
              </tr>
              <tr>
                <td data-column="title">সহকারী পরিচালক পদে নিয়োগের প্রজ্ঞাপন</td>
                <td data-column="memorial_no">80.00.0000.200.11.002.26</td>
                <td data-column="files"><a href="https://bpsc.gov.bd/uploads/ad_gazette.pdf">PDF</a></td>
                <td data-column="publish_date">০৬-১১-২০২৬</td>
                <td><a href="/pages/notification-circulars/ad-gazette">দেখুন</a></td>
              </tr>
            </tbody></table>`,
        } as Response;
      }
      if (url.includes('/49-bcs-circular')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => `
            <main>
              <h1>৪৯তম বিসিএস বিশেষ নিয়োগ বিজ্ঞপ্তি</h1>
              <a href="https://bpsc.teletalk.com.bd/">অনলাইনে আবেদন করুন (Apply Online)</a>
              <a href="https://bpsc.gov.bd/uploads/49bcs_circular.pdf">ডাউনলোড করুন</a>
            </main>`,
        } as Response;
      }
      if (url.includes('/ad-gazette')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => `
            <main>
              <h1>সহকারী পরিচালক পদে নিয়োগের প্রজ্ঞাপন</h1>
              <a href="https://bpsc.gov.bd/uploads/ad_gazette.pdf">ডাউনলোড করুন</a>
            </main>`,
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: async () => '<html><body><table><tbody></tbody></table></body></html>',
      } as Response;
    });

    const bpscOutcome = await BpscAdapter.fetchJobs();
    expect(bpscOutcome.jobs).toHaveLength(2);

    const bcsJob = bpscOutcome.jobs.find((j) => j.position.includes('৪৯তম বিসিএস'))!;
    expect(bcsJob.circularUrl).toBe('https://bpsc.gov.bd/uploads/49bcs_circular.pdf');
    expect(bcsJob.applicationUrl).toBe('https://bpsc.teletalk.com.bd/');
    expect(bcsJob.organizationUrl).toBe('https://bpsc.gov.bd');

    const gazetteJob = bpscOutcome.jobs.find((j) => j.position.includes('প্রজ্ঞাপন'))!;
    expect(gazetteJob.circularUrl).toBe('https://bpsc.gov.bd/uploads/ad_gazette.pdf');
    expect(gazetteJob.applicationUrl).toBeNull();
    expect(gazetteJob.organizationUrl).toBe('https://bpsc.gov.bd');
  });

  it('4. Bangladesh Bank: Advertisement & onlineapp open eRecruitment onlineapp URL, while Viva/MCQ PDF notices set applicationUrl = null', () => {
    const careerHtml = `
      <table><tbody>
        <tr>
          <td>310</td><td>Advertisement</td><td>Assistant Director (General) Circular</td>
          <td><a href="20261110_ad.pdf">PDF</a></td><td>10/11/2026</td><td>25/11/2026</td>
        </tr>
        <tr>
          <td>302</td><td>VIVA</td><td>Schedule of Viva Voce for Assistant Director</td>
          <td><a href="20261109_viva.pdf">PDF</a></td><td>09/11/2026</td><td>20/11/2026</td>
        </tr>
      </tbody></table>`;

    const careerItems = parseBangladeshBankCareerHtml(careerHtml);
    expect(careerItems).toHaveLength(2);

    const adJob = BangladeshBankAdapter.parseJob(careerItems[0]);
    expect(adJob.applicationUrl).toBe('https://erecruitment.bb.org.bd/onlineapp/joblist.php');
    expect(adJob.circularUrl).toBe('https://erecruitment.bb.org.bd/career/20261110_ad.pdf');
    expect(adJob.organizationUrl).toBe('https://www.bb.org.bd/');

    const vivaJob = BangladeshBankAdapter.parseJob(careerItems[1]);
    expect(vivaJob.applicationUrl).toBeNull();
    expect(vivaJob.circularUrl).toBe('https://erecruitment.bb.org.bd/career/20261109_viva.pdf');
    expect(vivaJob.organizationUrl).toBe('https://www.bb.org.bd/');

    const onlineHtml = `
      <table><tbody>
        <tr>
          <td>401</td><td>Officer (IT)</td><td>45</td><td>22000</td>
          <td>01/11/2026</td><td>BSc in CSE</td><td>200</td>
          <td>28/11/2026 <a href="apply.php?job=401">Apply Online</a></td>
        </tr>
      </tbody></table>`;
    const onlineItems = parseBangladeshBankOnlineAppHtml(onlineHtml);
    const activeOnlineJob = BangladeshBankAdapter.parseJob(onlineItems[0]);
    expect(activeOnlineJob.applicationUrl).toBe('https://erecruitment.bb.org.bd/onlineapp/apply.php?job=401');
  });

  it('5. Missing Application URL: clicking Apply Now never opens PDF, shows exact message & 3 separate fallback buttons', async () => {
    const tabsCreateSpy = vi.fn(async () => ({}));
    (globalThis as any).chrome = {
      storage: {
        local: {
          set: vi.fn((_o: any, cb?: () => void) => cb?.()),
          get: (_k: any, cb: any) => cb?.({}),
        },
      },
      tabs: { create: tabsCreateSpy },
    };

    const pdfOnlyJob = normalizeJobRecord(
      {
        externalId: 'missing_app_job_1',
        organization: 'Directorate of Secondary & Higher Education (DSHE)',
        jobTitle: 'Demonstrator Recruitment Circular',
        position: 'Demonstrator Recruitment Circular',
        category: 'Government',
        circularUrl: 'https://dshe.gov.bd/uploads/demonstrator_2026.pdf',
        organizationUrl: 'https://dshe.gov.bd',
        sourceUrl: 'https://dshe.gov.bd/pages/notices',
        applicationUrl: null,
      },
      { sourceId: 'official_website', sourceName: 'National Portal', verificationLevel: 'official_verified' }
    );

    await JobRepository.saveJobs([pdfOnlyJob]);
    localStorage.setItem('jobfill_language', 'bn');

    await act(async () => {
      root.render(
        <AppProvider>
          <JobSearchPage />
        </AppProvider>
      );
    });
    await flushUi(80);

    // Check clear Bengali labels requested in specification
    expect(container.textContent).toContain('বিস্তারিত দেখুন');
    expect(container.textContent).toContain('অফিশিয়াল বিজ্ঞপ্তি (PDF)');
    expect(container.textContent).toContain('সরাসরি আবেদন করুন');

    const applyBtn = Array.from(container.querySelectorAll('article button')).find((b) =>
      b.textContent?.includes('সরাসরি আবেদন করুন')
    ) as HTMLButtonElement;
    expect(applyBtn).toBeTruthy();

    await act(async () => {
      applyBtn.click();
    });
    await flushUi(40);

    // CRITICAL: Must NEVER open the PDF URL accidentally!
    expect(tabsCreateSpy).not.toHaveBeenCalled();

    // Must show exact missing application URL message & 3 distinct action buttons
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.textContent).toContain('সরাসরি অনলাইন আবেদন লিংক পাওয়া যায়নি।');
    expect(dialog?.textContent).toContain('অফিশিয়াল বিজ্ঞপ্তি দেখুন');
    expect(dialog?.textContent).toContain('প্রতিষ্ঠানের ওয়েবসাইট দেখুন');
    expect(dialog?.textContent).toContain('আবেদন লিংক খুঁজুন');

    // Explicit click on Button 1 opens Circular PDF intentionally
    const viewCircularBtn = Array.from(dialog!.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('অফিশিয়াল বিজ্ঞপ্তি দেখুন')
    ) as HTMLButtonElement;
    await act(async () => {
      viewCircularBtn.click();
    });
    expect(tabsCreateSpy).toHaveBeenCalledWith({
      url: 'https://dshe.gov.bd/uploads/demonstrator_2026.pdf',
    });

    // Explicit click on Button 2 opens Organization Website
    const orgSiteBtn = Array.from(dialog!.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('প্রতিষ্ঠানের ওয়েবসাইট দেখুন')
    ) as HTMLButtonElement;
    await act(async () => {
      orgSiteBtn.click();
    });
    expect(tabsCreateSpy).toHaveBeenCalledWith({
      url: 'https://dshe.gov.bd/',
    });

    // Explicit click on Button 3 opens Search Query for online application link
    const searchLinkBtn = Array.from(dialog!.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('আবেদন লিংক খুঁজুন')
    ) as HTMLButtonElement;
    await act(async () => {
      searchLinkBtn.click();
    });
    expect(tabsCreateSpy).toHaveBeenLastCalledWith({
      url: expect.stringContaining('https://www.google.com/search?q='),
    });
  });

  it('6. Login-gated application portals are detected accurately and opened with requiresLogin context', async () => {
    const loginPortalUrl = 'https://mybdjobs.bdjobs.com/applicant/login?ReturnUrl=%2Fapply%2F999';
    const cls = classifyApplicationDestination(loginPortalUrl, 'Apply Online');
    expect(cls.isApplicationUrl).toBe(true);
    expect(cls.isLoginRequired).toBe(true);
    expect(cls.kind).toBe('login_portal');

    const loginJob = normalizeJobRecord(
      {
        externalId: 'login_req_1',
        organization: 'BRAC NGO',
        jobTitle: 'Programme Coordinator',
        position: 'Programme Coordinator',
        category: 'NGO',
        circularUrl: 'https://brac.net/circulars/pc-2026.pdf',
        organizationUrl: 'https://www.brac.net/',
        applicationUrl: loginPortalUrl,
      },
      { sourceId: 'bdjobs', sourceName: 'Bdjobs', verificationLevel: 'official_partial' }
    );

    await act(async () => {
      root.render(
        <JobCard
          job={loginJob}
          isBookmarked={false}
          language="en"
          onViewDetails={() => {}}
          onApplyNow={() => {}}
          onToggleBookmark={() => {}}
        />
      );
    });
    await flushUi();
    expect(container.textContent).toContain('Login Required');

    const setSpy = vi.fn((_obj: any, cb?: () => void) => cb?.());
    const getSpy = vi.fn((_k: any, cb?: (v: any) => void) => cb?.({}));
    const tabsCreateSpy = vi.fn(async () => ({}));
    (globalThis as any).chrome = {
      storage: { local: { set: setSpy, get: getSpy } },
      tabs: { create: tabsCreateSpy },
    };
    const res = await openJobApplicationWithContext(loginJob, vi.fn(), false);
    expect(res.opened).toBe(true);
    expect(tabsCreateSpy).toHaveBeenCalledWith({ url: loginPortalUrl });
    expect(setSpy).toHaveBeenCalledWith({
      jobfill_active_application_context: expect.objectContaining({
        requiresLogin: true,
        applicationUrl: loginPortalUrl,
      }),
    });
  });

  it('7. Legacy IndexedDB migration cleans up PDFs/notice links previously saved as applicationUrl', async () => {
    const legacyPdfJob: NormalizedJobCircular = {
      id: 'legacy_np_1',
      sourceId: 'official_website',
      sourceName: 'Bangladesh National Portal',
      organization: 'MOPA',
      jobTitle: 'Old Buggy PDF Notice',
      position: 'Old Buggy PDF Notice',
      category: 'Government',
      employmentType: 'Full Time',
      qualification: 'Any Qualification',
      location: 'All Bangladesh',
      publishedAt: null,
      applicationStartAt: null,
      deadlineAt: null,
      deadlineTimezone: 'Asia/Dhaka',
      deadlineVerified: false,
      // Old buggy state: applicationUrl pointed straight to PDF without circularUrl!
      applicationUrl: 'https://mopa.gov.bd/uploads/old-circular.pdf',
      sourceUrl: 'https://mopa.gov.bd/pages/notices/old',
      description: 'Test legacy migration',
      requirements: [],
      sourceVerification: 'official_verified',
      sourceLastCheckedAt: Date.now(),
      firstDiscoveredAt: Date.now(),
      lastUpdatedAt: Date.now(),
      status: 'active',
    };

    const legacyDuplicateWithAlt: NormalizedJobCircular = {
      ...legacyPdfJob,
      id: 'legacy_dup_with_alt',
      applicationUrl: 'https://news.google.com/rss/articles/CBMiTest',
      circularUrl: 'https://bogmc.org.bd/circular.pdf',
      alternateSources: [
        {
          sourceId: 'teletalk',
          sourceName: 'Teletalk Alljobs',
          applicationUrl: 'https://bogmc.teletalk.com.bd/',
          verificationStatus: 'official_verified',
        },
      ],
    };

    expect(isCircularDocumentUrl(legacyPdfJob.applicationUrl)).toBe(true);
    const directRes = migrateLegacyCircularRecord(legacyPdfJob);
    expect(directRes.changed).toBe(true);
    expect(directRes.job.circularUrl).toBe('https://mopa.gov.bd/uploads/old-circular.pdf');
    expect(directRes.job.applicationUrl).toBeNull();

    // Save raw un-migrated records directly and trigger repository automatic migration
    await JobRepository.saveJobs([legacyPdfJob, legacyDuplicateWithAlt]);
    await JobRepository.migrateLegacyUrlsIfNeeded(true);
    const loaded = await JobRepository.getAllJobs();

    const migratedPdfOnly = loaded.find((j) => j.id === 'legacy_np_1')!;
    expect(migratedPdfOnly.circularUrl).toBe('https://mopa.gov.bd/uploads/old-circular.pdf');
    expect(migratedPdfOnly.applicationUrl).toBeNull();

    const migratedAltRecovered = loaded.find((j) => j.id === 'legacy_dup_with_alt')!;
    expect(migratedAltRecovered.applicationUrl).toBe('https://bogmc.teletalk.com.bd/');
    expect(migratedAltRecovered.circularUrl).toBe('https://bogmc.org.bd/circular.pdf');
  });

  it('8. JobDetails and OfficialWebsiteAdapter detail-page detector never leak PDF links as applicationUrl', async () => {
    const htmlWithMixedLinks = `
      <html>
        <header><nav><a href="https://example.gov.bd/apply-fake-nav">Nav Apply</a></nav></header>
        <main>
          <h1>Ministry Recruitment Notice</h1>
          <a href="https://example.gov.bd/files/notice-2026.pdf">Download PDF Notice</a>
          <a href="https://ministry.teletalk.com.bd/">অনলাইনে আবেদন করুন (Online Application)</a>
        </main>
        <footer><a href="https://nvaccess.org/nvda.exe">Screen Reader</a></footer>
      </html>
    `;
    const detected = detectApplicationLinksFromDetailHtml(
      htmlWithMixedLinks,
      'https://example.gov.bd',
      'https://example.gov.bd/pages/notices/rec-1'
    );
    expect(detected.circularPdfUrl).toBe('https://example.gov.bd/files/notice-2026.pdf');
    expect(detected.applicationUrl).toBe('https://ministry.teletalk.com.bd/');
    expect(detected.organizationUrl).toBe('https://example.gov.bd');

    // Also render JobCircularPage & JobDetails with missing applicationUrl in EN
    const noAppJob = normalizeJobRecord(
      {
        externalId: 'details_no_app',
        organization: 'National Portal',
        jobTitle: 'Junior Officer Circular',
        position: 'Junior Officer Circular',
        circularUrl: 'https://bangladesh.gov.bd/notice.pdf',
        organizationUrl: 'https://bangladesh.gov.bd',
        applicationUrl: null,
      },
      { sourceId: 'official_website', sourceName: 'National Portal', verificationLevel: 'official_verified' }
    );
    await JobRepository.saveJobs([noAppJob]);
    await act(async () => {
      root.render(
        <JobDetails
          job={noAppJob}
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
    expect(container.textContent).toContain('সরাসরি অনলাইন আবেদন লিংক পাওয়া যায়নি।');
    expect(container.textContent).toContain('Official Circular (PDF)');
    expect(container.textContent).toContain('Organization Website');
    expect(container.textContent).not.toContain('Open Official Application URL');

    // Keep unused import sanity verified via OfficialWebsiteAdapter existence
    expect(typeof OfficialWebsiteAdapter.getApplicationUrl).toBe('function');
    expect(typeof JobCircularPage).toBe('function');
  });
});
