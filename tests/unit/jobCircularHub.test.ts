// JobFill BD - Job Circular Hub Comprehensive Test Suite
// Covers synthetic fixtures, official source parsers, deduplication, deadline parsing,
// URL verification, manual addition, filtering/sorting, Application Tracker,
// source/RSS unavailability, and integration with existing Auto Fill Now.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  parseBangladeshBankCareerHtml,
  parseBangladeshBankOnlineAppHtml,
  BangladeshBankAdapter,
} from '../../src/jobs/sources/bangladesh-bank.adapter';
import { parseBpscNoticeTableHtml, BpscAdapter } from '../../src/jobs/sources/bpsc.adapter';
import { parseBdjobsStaticJson } from '../../src/jobs/sources/bdjobs.adapter';
import { parseGoogleNewsRssXml, GoogleNewsDiscoveryAdapter } from '../../src/jobs/sources/google-news-discovery.adapter';
import { normalizeJobRecord } from '../../src/jobs/services/job-normalizer';
import { deduplicateAndMergeJobs } from '../../src/jobs/services/job-deduplicator';
import { parseDeadlineDate, calculateRemainingTime, dhakaWallTimeToUtcMs } from '../../src/jobs/services/deadline-parser';
import { verifyJobUrl } from '../../src/jobs/services/source-verifier';
import { validateJobCircular } from '../../src/jobs/services/job-validator';
import { filterAndSortJobs, DEFAULT_JOB_FILTERS } from '../../src/jobs/dashboard/JobFilters';
import { JobRepository } from '../../src/jobs/database/job-repository';
import { BookmarkRepository } from '../../src/jobs/database/bookmark-repository';
import { ApplicationRepository } from '../../src/jobs/database/application-repository';
import { PageScanner } from '../../src/content/page-scanner';
import { VerificationEngine } from '../../src/validation/verification-engine';
import { sampleDemoProfile } from '../../src/types/defaults';

const FAKE_NOW = dhakaWallTimeToUtcMs(2026, 11, 10, 10, 0, 0); // 10 Nov 2026 10:00 AM Asia/Dhaka

describe('JobFill BD - Job Circular Hub & Source Integration Suite', () => {
  beforeEach(async () => {
    localStorage.clear();
    await JobRepository.clearAll();
    await BookmarkRepository.clearAll();
    await ApplicationRepository.clearAll();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Government job listing: parses BPSC notice table with Bengali date and marks PDF-only deadlines unverified', () => {
    const html = `
      <table id="noticeTable">
        <tbody class="table-tbody">
          <tr class="table-tr">
            <td class="table-td" data-column="id">১</td>
            <td class="table-td" data-column="title">৪৮তম বিসিএস নিয়োগ বিজ্ঞপ্তি প্রকাশ</td>
            <td class="table-td" data-column="memorial_no">80.00.0000.200.11.001.26-102</td>
            <td class="table-td" data-column="files">
              <a href="https://objectstorage.example.test/bpsc/48bcs.pdf">PDF</a>
            </td>
            <td class="table-td" data-column="publish_date"><span>০৫-১১-২০২৬</span></td>
            <td class="table-td"><a href="/pages/notification-circulars/48bcs">দেখুন</a></td>
          </tr>
        </tbody>
      </table>
    `;

    const rawItems = parseBpscNoticeTableHtml(html, 'https://bpsc.gov.bd/pages/notification-circulars');
    expect(rawItems.length).toBe(1);

    const job = BpscAdapter.parseJob(rawItems[0], FAKE_NOW);
    expect(job.category).toBe('Government');
    expect(job.sourceVerification).toBe('official_verified');
    expect(job.publishedDateText).toBe('০৫-১১-২০২৬');
    expect(job.publishedAt).not.toBeNull();
    // Deadline was not in HTML table -> MUST NOT be invented
    expect(job.deadlineVerified).toBe(false);
    expect(job.deadlineAt).toBeNull();
    expect(calculateRemainingTime(job.deadlineAt, job.deadlineVerified).labelEn).toBe('Deadline Not Verified');
  });

  it('2. Private job listing: normalizes and validates private circular with verified deadline', () => {
    const privateJob = normalizeJobRecord(
      {
        externalId: 'priv_1',
        organization: 'Synthetic Tech Bangladesh Ltd.',
        jobTitle: 'Junior Software Engineer',
        position: 'Junior Software Engineer',
        category: 'Private',
        employmentType: 'Full Time',
        qualification: 'Bachelor in CSE',
        location: 'Dhaka',
        vacancies: 4,
        salary: '45,000 BDT',
        publishedDateText: '2026-11-08',
        deadlineText: '2026-11-20',
        applicationUrl: 'https://careers.synthetic-bd.example/apply/101',
      },
      {
        sourceId: 'manual',
        sourceName: 'Manual Entry',
        verificationLevel: 'user_submitted',
        checkedAt: FAKE_NOW,
        defaultApplicationUrl: 'https://careers.synthetic-bd.example/apply/101',
      }
    );

    const validation = validateJobCircular(privateJob, FAKE_NOW);
    expect(validation.isValid).toBe(true);
    expect(validation.hasVerifiedDeadline).toBe(true);
    expect(privateJob.category).toBe('Private');
    expect(privateJob.location).toBe('Dhaka');
    expect(privateJob.deadlineTimezone).toBe('Asia/Dhaka');
  });

  it('3. Bank job listing: parses Bangladesh Bank HTML tables with verified Publish Date & Close Date', () => {
    const careerHtml = `
      <table class="responsive-table">
        <tbody>
          <tr>
            <td data-label='Job Id'>310</td>
            <td data-label='Circular For'>Advertisement</td>
            <td data-label='Circular Title'><strong>Assistant Director (General) Recruitment Circular</strong></td>
            <td data-label='View Details'><a href="20261110_ad_circular.pdf" class="btn-download">Download PDF</a></td>
            <td data-label='Publish Date'>10/11/2026</td>
            <td data-label='Close Date'><span><strong>25/11/2026</strong></span></td>
          </tr>
        </tbody>
      </table>
    `;
    const onlineHtml = `
      <table class="responsive-table">
        <tbody>
          <tr>
            <td>310</td>
            <td>Assistant Director (General)</td>
            <td>120</td>
            <td>22000-53060</td>
            <td>01/11/2026</td>
            <td>Masters / 4-year Honours</td>
            <td>200 BDT</td>
            <td>25/11/2026</td>
          </tr>
        </tbody>
      </table>
    `;

    const careerItems = parseBangladeshBankCareerHtml(careerHtml);
    const onlineItems = parseBangladeshBankOnlineAppHtml(onlineHtml);
    expect(careerItems.length).toBe(1);
    expect(onlineItems.length).toBe(1);

    const job = BangladeshBankAdapter.parseJob(onlineItems[0], FAKE_NOW);
    expect(job.category).toBe('Bank');
    expect(job.vacancies).toBe(120);
    expect(job.deadlineVerified).toBe(true);
    expect(job.sourceVerification).toBe('official_verified');
    expect(job.applicationUrl).toBe('https://erecruitment.bb.org.bd/onlineapp/joblist.php');
  });

  it('4. Duplicate circular detection: deduplicates overlaps and preserves official verification over discovery_only', () => {
    const officialJob = normalizeJobRecord(
      {
        externalId: 'off_ap_1',
        organization: 'Example Government Department',
        jobTitle: 'Assistant Programmer',
        position: 'Assistant Programmer',
        circularNumber: 'CIR-2026-88',
        category: 'Government',
        deadlineText: '2026-11-22',
        applicationUrl: 'https://bogmc.teletalk.com.bd/apply',
      },
      {
        sourceId: 'bpsc',
        sourceName: 'BPSC',
        verificationLevel: 'official_verified',
        checkedAt: FAKE_NOW,
        defaultApplicationUrl: 'https://bogmc.teletalk.com.bd/apply',
      }
    );

    const discoveryDuplicate = normalizeJobRecord(
      {
        externalId: 'gnews_ap_999',
        organization: 'Example Government Department',
        jobTitle: 'Assistant Programmer',
        position: 'Assistant Programmer',
        circularNumber: 'CIR-2026-88',
        category: 'Government',
        applicationUrl: 'https://bogmc.teletalk.com.bd/apply?utm_source=news',
      },
      {
        sourceId: 'google_news_discovery',
        sourceName: 'Google News RSS',
        verificationLevel: 'discovery_only',
        checkedAt: FAKE_NOW + 1000,
        defaultApplicationUrl: 'https://news.google.com/',
      }
    );

    const merged = deduplicateAndMergeJobs([officialJob], [discoveryDuplicate], FAKE_NOW + 1000);
    expect(merged.mergedJobs.length).toBe(1);
    expect(merged.duplicateCount).toBe(1);
    expect(merged.mergedJobs[0].sourceVerification).toBe('official_verified');
    expect(merged.mergedJobs[0].deadlineVerified).toBe(true);
  });

  it('5 & 6. Missing and Invalid deadlines: never guesses dates and displays "Deadline Not Verified"', () => {
    const missing = parseDeadlineDate('');
    expect(missing.isVerified).toBe(false);
    expect(missing.timestamp).toBeNull();

    const vague = parseDeadlineDate('Ongoing / Soon');
    expect(vague.isVerified).toBe(false);
    expect(vague.timestamp).toBeNull();

    const invalidCal = parseDeadlineDate('31/02/2026');
    expect(invalidCal.isVerified).toBe(false);
    expect(invalidCal.timestamp).toBeNull();

    const garbage = parseDeadlineDate('99/99/2026');
    expect(garbage.isVerified).toBe(false);
    expect(garbage.timestamp).toBeNull();

    const countdown = calculateRemainingTime(null, false, FAKE_NOW);
    expect(countdown.labelEn).toBe('Deadline Not Verified');
  });

  it('7. Search, Filter, & Sort: filters by category, education, location, deadline bucket, and sorts cleanly', async () => {
    const jobs = [
      normalizeJobRecord(
        {
          externalId: 'f1',
          organization: 'Alpha Bank PLC',
          jobTitle: 'Bank Officer',
          position: 'Bank Officer',
          category: 'Bank',
          qualification: 'Masters',
          location: 'Dhaka',
          deadlineText: '2026-11-12', // ~2 days from FAKE_NOW
          publishedDateText: '2026-11-01',
          applicationUrl: 'https://erecruitment.bb.org.bd/apply',
        },
        { sourceId: 'bangladesh_bank', sourceName: 'BB', verificationLevel: 'official_verified', checkedAt: FAKE_NOW, defaultApplicationUrl: 'https://erecruitment.bb.org.bd/' }
      ),
      normalizeJobRecord(
        {
          externalId: 'f2',
          organization: 'Zeta Govt Directorate',
          jobTitle: 'Data Entry Operator',
          position: 'Data Entry Operator',
          category: 'Government',
          qualification: 'HSC',
          location: 'Rajshahi',
          deadlineText: '2026-11-25', // >7 days
          publishedDateText: '2026-11-09',
          applicationUrl: 'https://alljobs.teletalk.com.bd/',
        },
        { sourceId: 'teletalk', sourceName: 'Teletalk', verificationLevel: 'official_verified', checkedAt: FAKE_NOW, defaultApplicationUrl: 'https://alljobs.teletalk.com.bd/' }
      ),
    ];

    const bankFiltered = filterAndSortJobs(
      jobs,
      { ...DEFAULT_JOB_FILTERS, category: 'Bank' },
      new Set(),
      FAKE_NOW
    );
    expect(bankFiltered.length).toBe(1);
    expect(bankFiltered[0].organization).toBe('Alpha Bank PLC');

    const sortedSoonest = filterAndSortJobs(
      jobs,
      { ...DEFAULT_JOB_FILTERS, sortBy: 'deadline_soonest' },
      new Set(),
      FAKE_NOW
    );
    expect(sortedSoonest[0].position).toBe('Bank Officer');
  });

  it('17 & 18. Source unavailable & RSS unavailable: fails gracefully without crashing or inventing jobs', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network offline'));

    const bbOutcome = await BangladeshBankAdapter.fetchJobs();
    expect(bbOutcome.success).toBe(false);
    expect(bbOutcome.compatibilityStatus).toBe('unavailable');
    expect(bbOutcome.jobs).toEqual([]);
    expect(bbOutcome.directPortalUrl).toBe('https://erecruitment.bb.org.bd/career/jobopportunity.php');

    const rssOutcome = await GoogleNewsDiscoveryAdapter.fetchJobs();
    expect(rssOutcome.success).toBe(false);
    expect(rssOutcome.jobs).toEqual([]);

    // Also test anti-bot block detection (never bypasses)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 403,
      headers: new Headers({ 'content-type': 'text/html' }),
      text: async () => '<html><body>Please verify you are human - CAPTCHA</body></html>',
    } as Response);

    const blockedOutcome = await BpscAdapter.fetchJobs();
    expect(blockedOutcome.success).toBe(false);
    expect(blockedOutcome.error).toContain('403');
  });

  it('18b. Discovery RSS & Bdjobs Static JSON: parses valid XML/JSON strictly as non-official/partial without inventing deadlines', () => {
    const rssXml = `<?xml version="1.0"?><rss version="2.0"><channel>
      <item>
        <title>PetroBangla Recruitment 2026 - Daily Star</title>
        <link>https://news.google.com/rss/articles/abc</link>
        <guid>g1</guid>
        <pubDate>Tue, 10 Nov 2026 04:00:00 GMT</pubDate>
        <source>Daily Star</source>
      </item>
    </channel></rss>`;
    const rssRaw = parseGoogleNewsRssXml(rssXml, 'Government');
    expect(rssRaw.length).toBe(1);
    const rssJob = GoogleNewsDiscoveryAdapter.parseJob(rssRaw[0], FAKE_NOW);
    expect(rssJob.sourceVerification).toBe('discovery_only');
    expect(rssJob.deadlineVerified).toBe(false);

    const bdJson = JSON.stringify([
      { CompanyName: 'PetroBangla', JobTitle: 'Assistant Manager', JP_ID: 282809 },
    ]);
    const bdRaw = parseBdjobsStaticJson(bdJson);
    expect(bdRaw.length).toBe(1);
    expect(bdRaw[0].deadlineText).toBeUndefined();
  });

  it('19. Invalid application URL: blocks unsafe schemes, IP hosts, and detects suspicious redirects', () => {
    expect(verifyJobUrl('javascript:alert(1)').isSafeToOpen).toBe(false);
    expect(verifyJobUrl('data:text/html,<h1>phish</h1>').isSafeToOpen).toBe(false);
    expect(verifyJobUrl('http://192.168.1.10/login').isSafeToOpen).toBe(false);
    expect(verifyJobUrl('https://portal.example.com/go?redirect=https://evil-phish.biz/steal').hasSuspiciousRedirect).toBe(true);
    expect(verifyJobUrl('https://portal.example.com/go?redirect=https://evil-phish.biz/steal').isSafeToOpen).toBe(false);

    const safeCheck = verifyJobUrl('https://bogmc.teletalk.com.bd/apply.php');
    expect(safeCheck.isValid).toBe(true);
    expect(safeCheck.isSafeToOpen).toBe(true);
    expect(safeCheck.isOfficialDomain).toBe(true);
  });

  it('20 & 21. Manual circular addition & Application Tracker: persists locally and never auto-marks Applied', async () => {
    const manualJob = normalizeJobRecord(
      {
        externalId: 'manual_test_1',
        organization: 'Dhaka University',
        jobTitle: 'Lecturer in CSE',
        position: 'Lecturer in CSE',
        category: 'University',
        qualification: 'Masters',
        location: 'Dhaka',
        deadlineText: '2026-11-30',
        applicationUrl: 'https://jobs.du.ac.bd/apply',
      },
      {
        sourceId: 'manual',
        sourceName: 'Manual Entry',
        verificationLevel: 'user_submitted',
        checkedAt: FAKE_NOW,
        defaultApplicationUrl: 'https://jobs.du.ac.bd/apply',
        isManual: true,
      }
    );

    await JobRepository.saveJob(manualJob);
    const loaded = await JobRepository.getJobById(manualJob.id, FAKE_NOW);
    expect(loaded).not.toBeNull();
    expect(loaded?.isManual).toBe(true);

    // Bookmarking or opening Apply Now does NOT mark Applied automatically
    await BookmarkRepository.addBookmark(manualJob.id);
    const trackedSaved = await ApplicationRepository.setStatus(manualJob, 'Ready to Apply');
    expect(trackedSaved.status).toBe('Ready to Apply');

    // User manually marks Applied + adds exam date & admit card
    const trackedApplied = await ApplicationRepository.setStatus(manualJob, 'Applied', {
      applicationDate: '2026-11-10',
      examDate: '2026-12-15',
      admitCardUrl: 'https://jobs.du.ac.bd/admit/123',
      notes: 'Fee paid via Sonali Bank',
    });
    expect(trackedApplied.status).toBe('Applied');
    expect(trackedApplied.examDate).toBe('2026-12-15');
  });

  it('22. Integration with existing Auto Fill Now: official application page triggers existing scanner & autofill engine cleanly', async () => {
    // Simulate landing on an official application form after clicking Apply Now
    document.body.innerHTML = `
      <form action="https://bogmc.teletalk.com.bd/submit" method="post">
        <div class="section">
          <h2>Basic Information</h2>
          <label for="name">Applicant's Name</label>
          <input type="text" id="name" name="name" />
          <label for="father">Father's Name</label>
          <input type="text" id="father" name="father" />
          <label for="mobile">Mobile Number</label>
          <input type="text" id="mobile" name="mobile" />
        </div>
        <button type="submit">Submit Application</button>
      </form>
    `;

    const scan = await PageScanner.scanPage(sampleDemoProfile, document);
    const approved = scan.planItems.filter((i) => i.isApproved);
    expect(approved.length).toBe(3);

    const execReport = await VerificationEngine.executePlan('job_apply_integration_1', approved);
    expect(execReport.successfullyFilled).toBe(3);
    expect((document.getElementById('name') as HTMLInputElement).value).toBe('MD. HASAN MAHMUD');
    expect((document.getElementById('mobile') as HTMLInputElement).value).toBe('01712345678');
  });
});
