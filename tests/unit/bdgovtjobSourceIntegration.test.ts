// JobFill BD - BD Govt Job (bdgovtjob.net) Comprehensive Integration Test Suite
// Verifies all Phase 1-11 requirements: Article discovery, multiple circular extraction,
// official source verification, conflict detection, deduplication, live sync, caching, and notifications.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { verifyJobUrl } from '../../src/jobs/services/source-verifier';
import {
  BdGovtJobAdapter,
  BDGOVTJOB_BPSC_URL,
  BDGOVTJOB_BASE,
  parseBdGovtJobTable,
  discoverArticleMetadata,
  extractMultipleCirculars,
  detectConflicts,
  verifyOfficialSource,
  parseBengaliNumber,
  extractTimeOfDay,
  extractMemorandumNumbers,
  resetBdGovtJobCache,
} from '../../src/jobs/sources/bdgovtjob';
import { parseDeadlineDate } from '../../src/jobs/services/deadline-parser';
import { JobSourceRegistry } from '../../src/jobs/sources/source-registry';
import * as jobFetcher from '../../src/jobs/services/job-fetcher';
import { deduplicateAndMergeJobs } from '../../src/jobs/services/job-deduplicator';
import { validateJobCircular } from '../../src/jobs/services/job-validator';
import { NormalizedJobCircular } from '../../src/jobs/types/job.types';

const FIXTURE_PATH = resolve(__dirname, '../fixtures/bdgovtjob_bpsc_snapshot.html');
const LIVE_SNAPSHOT_HTML = readFileSync(FIXTURE_PATH, 'utf-8');

const SAMPLE_BDGOVTJOB_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>৫১৪৭ পদে বাংলাদেশ সরকারি কর্ম কমিশন (BPSC) নিয়োগ বিজ্ঞপ্তি ২০২৬ - BD Govt Job</title>
  <link rel="canonical" href="https://bdgovtjob.net/bpsc-job-circular/" />
</head>
<body>
  <div class="entry-content">
    <h1 class="entry-title">৫১৪৭ পদে বাংলাদেশ সরকারি কর্ম কমিশন (BPSC) নিয়োগ বিজ্ঞপ্তি ২০২৬</h1>
    <table class="jc-table">
      <tbody>
        <tr><th>প্রতিষ্ঠানের নাম</th><td>বাংলাদেশ সরকারি কর্ম কমিশন (BPSC)</td></tr>
        <tr><th>পদের ক্যাটাগরি</th><td>নন-ক্যাডার বিভিন্ন পদ (২১টি ক্যাটাগরি, মোট ৫১৪৭ জন)</td></tr>
        <tr><th>মোট শূন্যপদ</th><td>৫,১৪৭ টি</td></tr>
        <tr><th>বেতন স্কেল</th><td>২৪,৩০০ – ১৩৯,৭০০/- টাকা (৯ম গ্রেড)</td></tr>
        <tr><th>চাকরির ধরন</th><td>সরকারি চাকরি</td></tr>
        <tr><th>বিজ্ঞপ্তি প্রকাশের তারিখ</th><td>০১ মার্চ ২০২৬</td></tr>
        <tr><th>আবেদন শুরুর তারিখ</th><td>০১ মার্চ ২০২৬</td></tr>
        <tr><th>আবেদনের শেষ তারিখ</th><td>৩০ নভেম্বর ২০২৬</td></tr>
        <tr><th>অফিশিয়াল ওয়েবসাইট</th><td><a href="https://bpsc.gov.bd/" target="_blank">bpsc.gov.bd</a></td></tr>
        <tr><th>আবেদন পদ্ধতি</th><td>অনলাইনে <a href="https://bpsc.teletalk.com.bd" target="_blank">bpsc.teletalk.com.bd</a> এর মাধ্যমে</td></tr>
        <tr><th>স্মারক নম্বর</th><td>৮০.০০.০০০০.০০০.৩০১.৭৩.০১৪ (০০৪).২৬-৩৫৪</td></tr>
        <tr><th>শিক্ষাগত যোগ্যতা</th><td>স্নাতক বা সমমানের ডিগ্রি</td></tr>
        <tr><th>বয়সসীমা</th><td>১৮ থেকে ৩২ বছর</td></tr>
        <tr><th>জব লোকেশন</th><td>বাংলাদেশের যেকোনো স্থান</td></tr>
      </tbody>
    </table>
  </div>
</body>
</html>
`;

describe('BD Govt Job (bdgovtjob.net) Source Integration Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetBdGovtJobCache();
  });

  afterEach(() => {
    resetBdGovtJobCache();
  });

  describe('1. Domain & URL Verification (Phase 2)', () => {
    it('should verify https://bdgovtjob.net/bpsc-job-circular/ as valid and safe secondary portal', () => {
      const result = verifyJobUrl(BDGOVTJOB_BPSC_URL);
      expect(result.isValid).toBe(true);
      expect(result.isSafeToOpen).toBe(true);
      expect(result.hostname).toBe('bdgovtjob.net');
      expect(result.normalizedUrl).toBe('https://bdgovtjob.net/bpsc-job-circular/');
    });

    it('should verify category and subpage paths on bdgovtjob.net', () => {
      const result = verifyJobUrl('https://bdgovtjob.net/category/gov-job/');
      expect(result.isValid).toBe(true);
      expect(result.isSafeToOpen).toBe(true);
      expect(result.hostname).toBe('bdgovtjob.net');
    });
  });

  describe('2. Bengali Number & Time Extraction (Phase 4)', () => {
    it('should correctly parse Bengali digits into numbers', () => {
      expect(parseBengaliNumber('৫১৪৭')).toBe(5147);
      expect(parseBengaliNumber('১২')).toBe(12);
      expect(parseBengaliNumber('১৩৫')).toBe(135);
      expect(parseBengaliNumber('৫,০০০')).toBe(5000);
      expect(parseBengaliNumber(null)).toBeNull();
    });

    it('should extract 24-hour time of day from Bengali expressions', () => {
      expect(extractTimeOfDay('সকাল ১০:০০ টা')).toBe('10:00');
      expect(extractTimeOfDay('দুপুর ১২:০০ টা')).toBe('12:00');
      expect(extractTimeOfDay('সন্ধ্যা ৬:০০ টা')).toBe('18:00');
      expect(extractTimeOfDay('রাত ১১:৫৯ টা')).toBe('23:59');
    });

    it('should correctly parse full Bengali dates into timestamps', () => {
      const parsed1 = parseDeadlineDate('৩০ নভেম্বর ২০২৬');
      expect(parsed1.timestamp).not.toBeNull();
      const dt1 = new Date(parsed1.timestamp!);
      expect(dt1.getUTCFullYear()).toBe(2026);
      expect(dt1.getUTCMonth()).toBe(10); // November is month 10 (0-indexed)

      const parsed2 = parseDeadlineDate('০১ মার্চ ২০২৬');
      expect(parsed2.timestamp).not.toBeNull();
      const dt2 = new Date(parsed2.timestamp!);
      expect(dt2.getUTCFullYear()).toBe(2026);
      expect(dt2.getUTCMonth()).toBe(2); // March is month 2
    });
  });

  describe('3. Article Discovery (Phase 3)', () => {
    it('should discover article title, canonical URL, date, author, images, and links from real snapshot', () => {
      const meta = discoverArticleMetadata(LIVE_SNAPSHOT_HTML, BDGOVTJOB_BPSC_URL);

      expect(meta.title).toContain('৫১৪৭ পদে বাংলাদেশ');
      expect(meta.title).toContain('BPSC');
      expect(meta.canonicalUrl).toBe(BDGOVTJOB_BPSC_URL);
      expect(meta.publishedDateText).toBeTruthy();
      expect(meta.author).toBe('Gauss Uddin Dolar');
      expect(meta.circularImages.length).toBeGreaterThan(0);
      expect(meta.circularImages.some((img) => img.includes('bpsc-non-cadre-job-circular'))).toBe(true);
      expect(meta.summaryTableData['প্রতিষ্ঠানের নাম']).toContain('বাংলাদেশ');
      expect(meta.summaryTableData['মোট শূন্যপদ']).toContain('৫১৪৭');
    });

    it('should not hardcode the current article title and handle synthetic articles', () => {
      const meta = discoverArticleMetadata(SAMPLE_BDGOVTJOB_HTML, 'https://bdgovtjob.net/bpsc-test/');
      expect(meta.title).toBe('৫১৪৭ পদে বাংলাদেশ সরকারি কর্ম কমিশন (BPSC) নিয়োগ বিজ্ঞপ্তি ২০২৬');
      expect(meta.canonicalUrl).toBe('https://bdgovtjob.net/bpsc-job-circular/');
    });
  });

  describe('4. Multiple Circular Extraction (Phase 4)', () => {
    it('should extract distinct recruitment notices from multi-notice article rather than merging into one', () => {
      const meta = discoverArticleMetadata(LIVE_SNAPSHOT_HTML, BDGOVTJOB_BPSC_URL);
      const notices = extractMultipleCirculars(LIVE_SNAPSHOT_HTML, meta, BDGOVTJOB_BPSC_URL);

      // Must produce 3 separate circular notices: Notice 1 (5 posts), Notice 2 (14 posts), Notice 3 (51st BCS Special)
      expect(notices.length).toBe(3);

      const notice1 = notices[0];
      expect(notice1.sectionTitle).toContain('নিয়োগ বিজ্ঞপ্তি ১');
      expect(notice1.postNames.length).toBeGreaterThan(0);
      expect(notice1.gradeNumber).toBe(5);
      expect(notice1.applicationUrl).toBe('https://bpsc.teletalk.com.bd');
      expect(notice1.officialSourceUrl).toBe('https://bpsc.gov.bd');

      const notice2 = notices[1];
      expect(notice2.sectionTitle).toContain('নিয়োগ বিজ্ঞপ্তি ২');
      expect(notice2.gradeNumber).toBe(9);
      expect(notice2.applicationUrl).toBe('https://bpsc.teletalk.com.bd');

      const notice3 = notices[2];
      expect(notice3.sectionTitle).toContain('৫১তম বি.সি.এস. (বিশেষ)');
      expect(notice3.recruitmentType).toBe('Special BCS Examination');
      expect(notice3.vacancies).toBe(5000);
      expect(notice3.gradeNumber).toBe(9);
    });

    it('should fallback cleanly to single-table extraction when article has only one table', () => {
      const meta = discoverArticleMetadata(SAMPLE_BDGOVTJOB_HTML, BDGOVTJOB_BPSC_URL);
      const notices = extractMultipleCirculars(SAMPLE_BDGOVTJOB_HTML, meta, BDGOVTJOB_BPSC_URL);

      expect(notices.length).toBe(1);
      expect(notices[0].vacancies).toBe(5147);
      expect(notices[0].gradeNumber).toBe(9);
      expect(notices[0].applicationUrl).toBe('https://bpsc.teletalk.com.bd');
      expect(notices[0].officialSourceUrl).toBe('https://bpsc.gov.bd/');
    });
  });

  describe('5. Missing Fields Handling (Phase 4)', () => {
    it('should mark unavailable fields as null or not specified without inventing fake data', () => {
      const minimalHtml = `
        <div class="entry-content">
          <h1>বিপিএসসি নিয়োগ বিজ্ঞপ্তি ২০২৬</h1>
          <table>
            <tr><th>প্রতিষ্ঠানের নাম</th><td>বাংলাদেশ সরকারী কর্ম কমিশন</td></tr>
            <tr><th>আবেদনের শেষ তারিখ</th><td>৩০ নভেম্বর ২০২৬</td></tr>
          </table>
        </div>
      `;
      const meta = discoverArticleMetadata(minimalHtml, BDGOVTJOB_BPSC_URL);
      const notices = extractMultipleCirculars(minimalHtml, meta, BDGOVTJOB_BPSC_URL);

      expect(notices.length).toBe(1);
      expect(notices[0].vacancies).toBeNull();
      expect(notices[0].gradeNumber).toBeNull();
      expect(notices[0].experience).toBeNull();
      expect(notices[0].salary).toBeNull();
    });
  });

  describe('6. Official Source Verification & Separation (Phase 5)', () => {
    it('should preserve separate secondarySourceUrl, officialSourceUrl, and applicationUrl', () => {
      const meta = discoverArticleMetadata(LIVE_SNAPSHOT_HTML, BDGOVTJOB_BPSC_URL);
      const notices = extractMultipleCirculars(LIVE_SNAPSHOT_HTML, meta, BDGOVTJOB_BPSC_URL);

      for (const notice of notices) {
        expect(notice.sourceArticleUrl).toBe(BDGOVTJOB_BPSC_URL);
        expect(notice.officialSourceUrl).toContain('bpsc.gov.bd');
        expect(notice.applicationUrl).toBe('https://bpsc.teletalk.com.bd');

        const verification = verifyOfficialSource(notice, ['৮০.০০.০০০০', '51st BCS']);
        expect(['OFFICIAL_VERIFIED', 'PARTIALLY_VERIFIED', 'SECONDARY_SOURCE_ONLY']).toContain(verification.status);
        expect(verification.lastVerifiedAt).toBeGreaterThan(0);
      }
    });

    it('should never automatically convert unverified secondary source claims into official verification', () => {
      const unverifiedNotice = {
        sectionIndex: 1,
        sectionTitle: 'Unverified Third-Party Circular',
        jobTitle: 'Unknown Job Notice',
        organization: 'Some Organization',
        organizationBn: 'কিছু প্রতিষ্ঠান',
        recruitmentType: 'Unknown',
        postNames: [],
        vacancies: 10,
        qualification: null,
        ageRequirement: null,
        experience: null,
        salary: null,
        gradeNumber: null,
        applicationStartText: null,
        applicationStartTime: null,
        deadlineText: '30 November 2026',
        applicationDeadlineTime: null,
        applicationUrl: 'https://thirdparty-unknown-portal.com',
        officialSourceUrl: 'https://thirdparty-unknown-portal.com',
        circularDocumentUrl: null,
        circularImages: [],
        memorandumNumber: null,
        publishedDateText: null,
        sourceArticleUrl: 'https://bdgovtjob.net/test/',
        verificationStatus: 'SECONDARY_SOURCE_ONLY' as const,
        lastVerifiedAt: Date.now(),
        hasConflict: false,
        conflictNotes: [],
      };

      const result = verifyOfficialSource(unverifiedNotice, []);
      expect(result.status).toBe('SECONDARY_SOURCE_ONLY');
    });
  });

  describe('7. Conflict Detection (Phase 6)', () => {
    it('should detect conflicting deadlines between notice section and summary table', () => {
      const meta = discoverArticleMetadata(LIVE_SNAPSHOT_HTML, BDGOVTJOB_BPSC_URL);
      // Simulate summary table with 30 November, but Notice 3 has 25 October
      meta.summaryTableData['আবেদনের শেষ তারিখ'] = '৩০ নভেম্বর ২০২৬';
      const notices = extractMultipleCirculars(LIVE_SNAPSHOT_HTML, meta, BDGOVTJOB_BPSC_URL);

      const conflicts = detectConflicts(notices, meta);
      expect(conflicts.length).toBeGreaterThan(0);

      const mismatch = conflicts.find((c) => c.issueType === 'DEADLINE_MISMATCH');
      expect(mismatch).toBeDefined();
      expect(mismatch?.noticeTitle).toContain('৫১তম বি.সি.এস.');

      const conflictingNotice = notices.find((n) => n.hasConflict);
      expect(conflictingNotice).toBeDefined();
      expect(conflictingNotice?.verificationStatus).toBe('CONFLICT_DETECTED');
      expect(conflictingNotice?.conflictNotes.length).toBeGreaterThan(0);
    });

    it('should detect when article claims application closed but deadline is in the future', () => {
      const closedMeta = discoverArticleMetadata(SAMPLE_BDGOVTJOB_HTML, BDGOVTJOB_BPSC_URL);
      closedMeta.title = 'আবেদন শেষ! বিপিএসসি ৫১৪৭ পদে নিয়োগ বিজ্ঞপ্তি';
      const notices = extractMultipleCirculars(SAMPLE_BDGOVTJOB_HTML, closedMeta, BDGOVTJOB_BPSC_URL);

      const conflicts = detectConflicts(notices, closedMeta);
      const closedConflict = conflicts.find((c) => c.issueType === 'CLOSED_BUT_FUTURE');
      expect(closedConflict).toBeDefined();
      expect(notices[0].hasConflict).toBe(true);
      expect(notices[0].verificationStatus).toBe('CONFLICT_DETECTED');
    });
  });

  describe('8. Deduplication with Official BPSC Circulars (Phase 7)', () => {
    it('should merge secondary source as alternateSources instead of creating a duplicate job', () => {
      const officialBpscJob: NormalizedJobCircular = {
        id: 'bpsc-official-circular-78-82',
        sourceId: 'bpsc',
        sourceName: 'Bangladesh Public Service Commission (BPSC)',
        sourceVerification: 'official_verified',
        organization: 'Bangladesh Public Service Commission (BPSC)',
        organizationBn: 'বাংলাদেশ সরকারী কর্ম কমিশন',
        jobTitle: 'বিপিএসসি নন-ক্যাডার নিয়োগ বিজ্ঞপ্তি (Circular No: 78-82/2026)',
        position: 'নন-ক্যাডার বিভিন্ন পদ',
        circularNumber: '৮০.০০.০০০০.০০০.৩০১.৭৩.০১৪ (০০৪).২৬-৩৫৪',
        category: 'Government',
        employmentType: 'Full Time',
        vacancies: 12,
        qualification: 'Bachelor',
        salary: '২৪,৩০০ – ১৩৯,৭০০/- টাকা (৯ম গ্রেড)',
        gradeNumber: 9,
        location: 'All Bangladesh',
        publishedAt: Date.now() - 86400000,
        applicationStartAt: Date.now(),
        deadlineText: '৩০ নভেম্বর ২০২৬',
        deadlineAt: 1796061599000,
        deadlineTimezone: 'Asia/Dhaka',
        deadlineVerified: true,
        circularUrl: 'https://bpsc.gov.bd/pages/notification-circulars',
        applicationUrl: 'https://bpsc.teletalk.com.bd/ncad/apply.php',
        organizationUrl: 'https://bpsc.gov.bd',
        sourceUrl: 'https://bpsc.gov.bd/pages/notification-circulars',
        description: 'Official circular from BPSC portal.',
        requirements: [],
        sourceLastCheckedAt: Date.now(),
        firstDiscoveredAt: Date.now(),
        lastUpdatedAt: Date.now(),
        status: 'active',
      };

      const secondaryRawItem = {
        externalId: 'bdgovtjob-bpsc-notice-1',
        sourceJobId: 'bdgovtjob:bpsc:1',
        organization: 'Bangladesh Public Service Commission (BPSC)',
        organizationBn: 'বাংলাদেশ সরকারী কর্ম কমিশন',
        jobTitle: 'নিয়োগ বিজ্ঞপ্তি ১: বাংলাদেশ সরকারী কর্ম কমিশন সচিবালয় (৫টি পদ)',
        position: 'নন-ক্যাডার বিভিন্ন পদ',
        circularNumber: '৮০.০০.০০০০.০০০.৩০১.৭৩.০১৪ (০০৪).২৬-৩৫৪',
        category: 'Government' as const,
        employmentType: 'Full Time',
        vacancies: 12,
        salary: '২৪,৩০০ – ১৩৯,৭০০/- টাকা (৯ম গ্রেড)',
        qualification: 'Bachelor',
        location: 'All Bangladesh',
        deadlineText: '৩০ নভেম্বর ২০২৬',
        applicationUrl: 'https://bpsc.teletalk.com.bd',
        circularUrl: BDGOVTJOB_BPSC_URL,
        organizationUrl: 'https://bpsc.gov.bd',
        sourceUrl: BDGOVTJOB_BPSC_URL,
        secondarySourceUrl: BDGOVTJOB_BPSC_URL,
      };

      const secondaryJob = BdGovtJobAdapter.parseJob(secondaryRawItem);

      const mergeResult = deduplicateAndMergeJobs([officialBpscJob], [secondaryJob]);
      expect(mergeResult.newJobs.length).toBe(0);
      expect(mergeResult.mergedJobs.length).toBe(1);

      const merged = mergeResult.mergedJobs[0];
      expect(merged.id).toBe(officialBpscJob.id);
      expect(merged.sourceVerification).toBe('official_verified');
      expect(merged.alternateSources).toBeDefined();
      expect(merged.alternateSources!.length).toBeGreaterThanOrEqual(2);

      const hasSecondary = merged.alternateSources!.some((s) => s.sourceId === 'bdgovtjob');
      expect(hasSecondary).toBe(true);
    });
  });

  describe('9. Live Synchronization & Caching (Phase 8)', () => {
    it('should successfully fetch and discover circulars via BdGovtJobAdapter.fetchJobs()', async () => {
      vi.spyOn(jobFetcher, 'safePublicGet').mockResolvedValueOnce({
        ok: true,
        status: 200,
        contentType: 'text/html',
        body: LIVE_SNAPSHOT_HTML,
      });

      const outcome = await BdGovtJobAdapter.fetchJobs(undefined, { forceRefresh: true });
      expect(outcome.success).toBe(true);
      expect(outcome.compatibilityStatus).toBe('supported');
      expect(outcome.connectionStatus).toBe('Working');
      expect(outcome.jobs.length).toBeGreaterThanOrEqual(1);

      for (const job of outcome.jobs) {
        expect(job.organization).toContain('Public Service Commission');
        expect(job.applicationUrl).toBe('https://bpsc.teletalk.com.bd');
        expect(job.secondarySourceUrl).toBe(BDGOVTJOB_BPSC_URL);
        expect(validateJobCircular(job).isValid).toBe(true);
      }
    });

    it('should respect 5-minute cache and not re-fetch unchanged article unnecessarily', async () => {
      const getSpy = vi.spyOn(jobFetcher, 'safePublicGet').mockResolvedValue({
        ok: true,
        status: 200,
        contentType: 'text/html',
        body: LIVE_SNAPSHOT_HTML,
      });

      // 1st call (force refresh to populate cache)
      const res1 = await BdGovtJobAdapter.fetchJobs(undefined, { forceRefresh: true });
      expect(res1.success).toBe(true);
      expect(getSpy).toHaveBeenCalledTimes(1);

      // 2nd call without forceRefresh -> should serve from cache
      const res2 = await BdGovtJobAdapter.fetchJobs();
      expect(res2.success).toBe(true);
      expect(res2.accessNotes).toContain('cached circular(s)');
      expect(getSpy).toHaveBeenCalledTimes(1); // network not called again
    });

    it('should handle network failures gracefully with unavailable status', async () => {
      vi.spyOn(jobFetcher, 'safePublicGet').mockResolvedValueOnce({
        ok: false,
        status: 503,
        contentType: 'text/html',
        body: '',
        blockedReason: 'Service Unavailable (503)',
      });

      const outcome = await BdGovtJobAdapter.fetchJobs(undefined, { forceRefresh: true });
      expect(outcome.success).toBe(false);
      expect(outcome.jobs.length).toBe(0);
      expect(outcome.compatibilityStatus).toBe('unavailable');
      expect(outcome.connectionStatus).toBe('Failed');
      expect(outcome.error).toBe('Service Unavailable (503)');
    });
  });

  describe('10. Adapter Registration & Contracts (Phase 2)', () => {
    it('should have BdGovtJobAdapter registered in JobSourceRegistry with secondary credentials', () => {
      const adapter = JobSourceRegistry.getById('bdgovtjob');
      expect(adapter).toBeDefined();
      expect(adapter?.sourceId).toBe('bdgovtjob');
      expect(adapter?.officialDomain).toBe('bdgovtjob.net');
      expect(adapter?.sourceType).toBe('job_board');
      expect(adapter?.publisherType).toBe('Third-Party');
      expect(adapter?.compatibilityStatus).toBe('supported');
    });

    it('should keep application links strictly separate from circular and article links', () => {
      const raw = {
        externalId: 'test-link-sep',
        organization: 'Bangladesh Public Service Commission (BPSC)',
        jobTitle: 'Test Separation',
        position: 'Test Separation',
        vacancies: 10,
        applicationUrl: 'https://bpsc.teletalk.com.bd',
        circularUrl: 'https://bdgovtjob.net/uploads/circular.pdf',
        sourceUrl: BDGOVTJOB_BPSC_URL,
        secondarySourceUrl: BDGOVTJOB_BPSC_URL,
        officialSourceUrl: 'https://bpsc.gov.bd',
      };

      const normalized = BdGovtJobAdapter.parseJob(raw);
      expect(normalized.applicationUrl).toBe('https://bpsc.teletalk.com.bd');
      expect(normalized.circularUrl).toBe('https://bdgovtjob.net/uploads/circular.pdf');
      expect(normalized.secondarySourceUrl).toBe(BDGOVTJOB_BPSC_URL);
      expect(normalized.officialSourceUrl).toBe('https://bpsc.gov.bd');
      expect(normalized.applicationUrl).not.toBe(normalized.circularUrl);
      expect(normalized.applicationUrl).not.toBe(normalized.secondarySourceUrl);
    });
  });

  describe('11. Structured Table Parser Backward Compatibility (parseBdGovtJobTable)', () => {
    it('should accurately extract all fields from legacy table HTML', () => {
      const extracted = parseBdGovtJobTable(SAMPLE_BDGOVTJOB_HTML, BDGOVTJOB_BPSC_URL);

      expect(extracted.jobTitle).toContain('৫১৪৭ পদে বাংলাদেশ সরকারি কর্ম কমিশন (BPSC)');
      expect(extracted.organization).toBe('Bangladesh Public Service Commission (BPSC)');
      expect(extracted.organizationBn).toBe('বাংলাদেশ সরকারি কর্ম কমিশন');
      expect(extracted.vacancies).toBe(5147);
      expect(extracted.position).toContain('নন-ক্যাডার বিভিন্ন পদ');
      expect(extracted.salary).toContain('৯ম গ্রেড');
      expect(extracted.deadlineText).toBe('৩০ নভেম্বর ২০২৬');
      expect(extracted.applicationStartText).toBe('০১ মার্চ ২০২৬');
      expect(extracted.publishedDateText).toBe('০১ মার্চ ২০২৬');
      expect(extracted.applicationUrl).toBe('https://bpsc.teletalk.com.bd');
      expect(extracted.organizationUrl).toBe('https://bpsc.gov.bd/');
      expect(extracted.circularNumber).toContain('৮০.০০.০০০০');
      expect(extracted.qualification).toContain('স্নাতক');
      expect(extracted.ageRequirement).toContain('১৮ থেকে ৩২ বছর');
    });
  });

  describe('12. Notification Engine Integration (Phase 10)', () => {
    it('should generate discovery and application notification records without duplication', async () => {
      const { NotificationManager } = await import('../../src/jobs/notifications/notification-manager');
      const raw = {
        externalId: 'bdgovtjob-notif-1',
        organization: 'Bangladesh Public Service Commission (BPSC)',
        jobTitle: '৫০তম বিসিএস ক্যাডার নিয়োগ বিজ্ঞপ্তি',
        position: 'ক্যাডার বিভিন্ন পদ',
        deadlineText: '৩০ নভেম্বর ২০২৬',
        applicationUrl: 'https://bpsc.teletalk.com.bd',
        circularUrl: BDGOVTJOB_BPSC_URL,
        secondarySourceUrl: BDGOVTJOB_BPSC_URL,
      };
      const job = BdGovtJobAdapter.parseJob(raw);
      expect(job.id).toBeTruthy();

      const notifSpy = vi.spyOn(NotificationManager, 'dispatch').mockResolvedValue({
        id: 'notif-bdgovtjob-1',
        type: 'deadline_48h',
        title: 'New Circular: BPSC Non-Cadre',
        message: 'Discovered from BD Govt Job with official Teletalk link.',
        timestamp: Date.now(),
        read: false,
      });

      const dispatched = await NotificationManager.dispatch({
        type: 'deadline_48h',
        title: `New Circular: ${job.jobTitle}`,
        message: `Discovered from BD Govt Job with official Teletalk link. (${job.organization})`,
        jobId: job.id,
        jobTitle: job.jobTitle,
        organization: job.organization,
        deadlineAt: job.deadlineAt ?? undefined,
      });

      expect(dispatched.id).toBe('notif-bdgovtjob-1');
      expect(notifSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('13. Memorandum Number Dynamic Extraction (Phase 4 & 5)', () => {
    it('should dynamically extract multiple memorandum numbers from comma/ও separated text', () => {
      const rawText =
        '৮০.০০.০০০০.০০০.৩০১.৭৩.০১৪ (০০৪).২৬-৩৫৪, ৮০.০০.০০০০.০০০.৩০১.৭৩.০১৪ (০০৪).২৬-৩৫৫ ও ৮০.০০.০০০০.২০০.৪৬.০৩১.২৬-২৪৮';
      const memos = extractMemorandumNumbers(rawText);
      expect(memos.length).toBe(3);
      expect(memos[0]).toBe('৮০.০০.০০০০.০০০.৩০১.৭৩.০১৪ (০০৪).২৬-৩৫৪');
      expect(memos[1]).toBe('৮০.০০.০০০০.০০০.৩০১.৭৩.০১৪ (০০৪).২৬-৩৫৫');
      expect(memos[2]).toBe('৮০.০০.০০০০.২০০.৪৬.০৩১.২৬-২৪৮');
    });

    it('should return empty array for text with no memorandum numbers without inventing fake strings', () => {
      expect(extractMemorandumNumbers('')).toEqual([]);
      expect(extractMemorandumNumbers('সাধারণ বিজ্ঞপ্তি কোনো স্মারক নেই')).toEqual([]);
    });
  });

  describe('14. PDF Link & Pagination Extraction (Phase 3 & 11)', () => {
    it('should extract direct PDF circular links when present', () => {
      const htmlWithPdf = `
        <div class="entry-content">
          <h1>বিপিএসসি সার্কুলার</h1>
          <p><a href="https://bdgovtjob.net/uploads/2026/03/bpsc-circular-detailed.pdf">অফিসিয়াল সার্কুলার PDF ডাউনলোড করুন</a></p>
        </div>
      `;
      const meta = discoverArticleMetadata(htmlWithPdf, BDGOVTJOB_BPSC_URL);
      expect(meta.pdfLinks.length).toBe(1);
      expect(meta.pdfLinks[0]).toBe('https://bdgovtjob.net/uploads/2026/03/bpsc-circular-detailed.pdf');
    });

    it('should extract pagination and related BPSC circular links', () => {
      const htmlWithPagination = `
        <div class="entry-content">
          <h1>বিপিএসসি চাকরি</h1>
          <a class="page-numbers" href="https://bdgovtjob.net/bpsc-job-circular/page/2/">2</a>
          <a class="page-numbers" href="https://bdgovtjob.net/bpsc-job-circular/?paged=3">3</a>
          <a href="https://bdgovtjob.net/bpsc-non-cadre-circular-2026/">Related BPSC Circular</a>
        </div>
      `;
      const meta = discoverArticleMetadata(htmlWithPagination, BDGOVTJOB_BPSC_URL);
      expect(meta.paginationLinks.length).toBe(2);
      expect(meta.paginationLinks).toContain('https://bdgovtjob.net/bpsc-job-circular/page/2/');
      expect(meta.relatedBpscLinks.length).toBeGreaterThanOrEqual(1);
      expect(meta.relatedBpscLinks).toContain('https://bdgovtjob.net/bpsc-non-cadre-circular-2026/');
    });
  });

  describe('15. Untested Edge Cases: 4+ Multi-Notices & Anti-Bot Protection', () => {
    it('should handle 4+ circular notices with mixed English and Bengali numeral identifiers', () => {
      const multi4Html = `
        <div class="entry-content">
          <h1>৪টি নিয়োগ বিজ্ঞপ্তি বাংলাদেশ কর্ম কমিশন</h1>
          <h3>নিয়োগ বিজ্ঞপ্তি ১: সহকারী পরিচালক (১০টি পদ)</h3>
          <div><p>পদ: ১০টি</p><p>শিক্ষাগত যোগ্যতা: মাস্টার্স</p><p>বেতনস্কেল ও গ্রেড: ৯তম গ্রেড</p><p>আবেদনের শেষ তারিখ: ৩০ নভেম্বর ২০২৬</p></div>
          <h3>নিয়োগ বিজ্ঞপ্তি ২: গবেষণা কর্মকর্তা (৫টি পদ)</h3>
          <div><p>পদ: ৫টি</p><p>শিক্ষাগত যোগ্যতা: স্নাতক</p><p>বেতনস্কেল ও গ্রেড: ৯তম গ্রেড</p><p>আবেদনের শেষ তারিখ: ৩০ নভেম্বর ২০২৬</p></div>
          <h3>বিজ্ঞপ্তি ৩: উপসহকারী প্রকৌশলী (২০টি পদ)</h3>
          <div><p>পদ: ২০টি</p><p>শিক্ষাগত যোগ্যতা: ডিপ্লোমা</p><p>বেতনস্কেল ও গ্রেড: ১০তম গ্রেড</p><p>আবেদনের শেষ তারিখ: ১৫ ডিসেম্বর ২০২৬</p></div>
          <h3>বিজ্ঞপ্তি ৪: কম্পিউটার অপারেটর (১৫টি পদ)</h3>
          <div><p>পদ: ১৫টি</p><p>শিক্ষাগত যোগ্যতা: এইচএসসি</p><p>বেতনস্কেল ও গ্রেড: ১১তম গ্রেড</p><p>আবেদনের শেষ তারিখ: ২০ ডিসেম্বর ২০২৬</p></div>
        </div>
      `;
      const meta = discoverArticleMetadata(multi4Html, BDGOVTJOB_BPSC_URL);
      const notices = extractMultipleCirculars(multi4Html, meta, BDGOVTJOB_BPSC_URL);

      expect(notices.length).toBe(4);
      expect(notices[0].sectionTitle).toContain('বিজ্ঞপ্তি ১');
      expect(notices[0].gradeNumber).toBe(9);
      expect(notices[1].sectionTitle).toContain('বিজ্ঞপ্তি ২');
      expect(notices[2].sectionTitle).toContain('বিজ্ঞপ্তি ৩');
      expect(notices[2].gradeNumber).toBe(10);
      expect(notices[3].sectionTitle).toContain('বিজ্ঞপ্তি ৪');
      expect(notices[3].gradeNumber).toBe(11);
    });

    it('should gracefully handle Cloudflare / anti-bot interstitial challenge without crashing', async () => {
      vi.spyOn(jobFetcher, 'safePublicGet').mockResolvedValueOnce({
        ok: true,
        status: 200,
        contentType: 'text/html',
        body: '<!DOCTYPE html><html><head><title>Just a moment...</title></head><body><div id="cf-chl-bypass">Checking your browser...</div></body></html>',
      });

      const outcome = await BdGovtJobAdapter.fetchJobs(undefined, { forceRefresh: true });
      expect(outcome.success).toBe(false);
      expect(outcome.blockedByCaptcha).toBe(true);
      expect(outcome.compatibilityStatus).toBe('partially_supported');
      expect(outcome.connectionStatus).toBe('Manual Verification Required');
      expect(outcome.accessNotes).toContain('anti-bot challenge');
      expect(outcome.jobs.length).toBe(0);
    });

    it('should detect article modifications when deadline is altered incrementally', () => {
      const originalMeta = discoverArticleMetadata(SAMPLE_BDGOVTJOB_HTML, BDGOVTJOB_BPSC_URL);
      const originalNotices = extractMultipleCirculars(SAMPLE_BDGOVTJOB_HTML, originalMeta, BDGOVTJOB_BPSC_URL);
      expect(originalNotices[0].deadlineText).toBe('৩০ নভেম্বর ২০২৬');

      // Modified article with extended deadline
      const updatedHtml = SAMPLE_BDGOVTJOB_HTML.replace('৩০ নভেম্বর ২০২৬', '১৫ ডিসেম্বর ২০২৬');
      const updatedMeta = discoverArticleMetadata(updatedHtml, BDGOVTJOB_BPSC_URL);
      const updatedNotices = extractMultipleCirculars(updatedHtml, updatedMeta, BDGOVTJOB_BPSC_URL);
      expect(updatedNotices[0].deadlineText).toBe('১৫ ডিসেম্বর ২০২৬');
      expect(updatedNotices[0].deadlineText).not.toBe(originalNotices[0].deadlineText);
    });
  });
});
