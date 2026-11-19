// JobFill BD - Full BD Govt Job Integration Verification Suite
// Tests Two-Tier Crawling, Dynamic Pagination, Multi-Notice Bundles (#circular-item-N),
// Bengali Category Normalization, Checkpoint Pause/Resume, and UI Source Filtering.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  BdGovtJobCrawler,
  bdGovtJobCrawler,
  createDefaultCheckpoint,
  loadCheckpoint,
  saveCheckpoint,
  resetCheckpoint,
  BDGOVTJOB_CHECKPOINT_KEY,
} from '../../src/jobs/sources/bdgovtjob/bdgovtjob.crawler';
import {
  discoverPagination,
  parseBdGovtJobCard,
  cardDataToRawItem,
  formatCompactDateString,
  extractMultipleCirculars,
  discoverArticleMetadata,
  inferOrgFromTitle,
  BDGOVTJOB_ALL_JOBS_URL,
} from '../../src/jobs/sources/bdgovtjob/bdgovtjob.parser';
import { BdGovtJobAdapter } from '../../src/jobs/sources/bdgovtjob/bdgovtjob.adapter';
import { normalizeCategory } from '../../src/jobs/services/job-normalizer';
import { deduplicateAndMergeJobs, computeDuplicateMatchConfidence } from '../../src/jobs/services/job-deduplicator';
import { SOURCE_FILTER_GROUPS, isJobMatchingSourceGroup } from '../../src/jobs/dashboard/JobFilters';
import { matchesSearchCategory } from '../../src/jobs/services/search-engine';
import * as jobFetcher from '../../src/jobs/services/job-fetcher';
import { NormalizedJobCircular } from '../../src/jobs/types/job.types';

const MOCK_PAGINATION_HTML = `
<div class="site-main">
  <article id="post-1226" class="bdg-card v7 post-1226 post type-post hentry category-all-jobs">
    <div class="bdg-card-top"><span class="bdg-card-cat">সরকারি চাকরি</span></div>
    <h2 class="bdg-card-title"><a href="https://bdgovtjob.net/dc-office-job-circular/">সকল জেলা প্রশাসকের কার্যালয়ে নিয়োগ ২০২৬ – DC Office Job Circular 2026</a></h2>
    <div class="bdg-card-foot">
      <time datetime="2026-11-18T11:10:34+00:00">১৮ নভেম্বর ২০২৬</time>
      <span class="bdg-track"
        data-post-id="1226"
        data-t="সকল জেলা প্রশাসকের কার্যালয়ে নিয়োগ ২০২৬ – DC Office Job Circular 2026"
        data-u="https://bdgovtjob.net/dc-office-job-circular/"
        data-d="20261121"
        data-e="1795258800"
        data-l="1797847200"
        data-c="সরকারি চাকরি"
        data-days="20261121T1700,20261122T1700,20261221T1600"
        data-n="২৬৩"
        data-i="https://bdgovtjob.net/wp-content/uploads/2026/10/dc-office.png">
      </span>
    </div>
  </article>

  <article id="post-1227" class="bdg-card v7 post-1227 post type-post hentry">
    <div class="bdg-card-top"><span class="bdg-card-cat">ডিফেন্স জব সার্কুলার</span></div>
    <h2 class="bdg-card-title"><a href="https://bdgovtjob.net/police-job-circular/">বাংলাদেশ পুলিশ নিয়োগ বিজ্ঞপ্তি ২০২৬</a></h2>
    <div class="bdg-card-foot">
      <time datetime="2026-11-17T09:00:00+00:00">১৭ নভেম্বর ২০২৬</time>
      <span class="bdg-track"
        data-post-id="1227"
        data-t="বাংলাদেশ পুলিশ নিয়োগ বিজ্ঞপ্তি ২০২৬"
        data-u="https://bdgovtjob.net/police-job-circular/"
        data-d="20261117"
        data-e="1795258800"
        data-l="1797847200"
        data-c="ডিফেন্স জব সার্কুলার"
        data-days="20261215T1700"
        data-n="১৫০"
        data-i="https://bdgovtjob.net/wp-content/uploads/2026/10/police.png">
      </span>
    </div>
  </article>

  <nav id="nav-below" class="paging-navigation" aria-label="Archive Page">
    <div class="nav-links">
      <span aria-current="page" class="page-numbers current"><span class="screen-reader-text">পেজ</span>১</span>
      <a class="page-numbers" href="https://bdgovtjob.net/category/all-jobs/page/2/"><span class="screen-reader-text">পেজ</span>২</a>
      <a class="page-numbers" href="https://bdgovtjob.net/category/all-jobs/page/3/"><span class="screen-reader-text">পেজ</span>৩</a>
      <span class="page-numbers dots">…</span>
      <a class="page-numbers" href="https://bdgovtjob.net/category/all-jobs/page/152/"><span class="screen-reader-text">পেজ</span>১৫২</a>
      <a class="next page-numbers" href="https://bdgovtjob.net/category/all-jobs/page/2/">পরের →</a>
    </div>
  </nav>
</div>
`;

const MOCK_DC_BUNDLE_HTML = `
<article class="post-1226">
  <h1 class="entry-title">সকল জেলা প্রশাসকের কার্যালয়ে নিয়োগ ২০২৬ – DC Office Job Circular 2026</h1>
  <div class="entry-content">
    <div id="circular-item-1" class="jc-mixed-item">
      <h3>১. জেলা প্রশাসকের কার্যালয়, রাঙ্গামাটি পার্বত্য জেলা নিয়োগ বিজ্ঞপ্তি ২০২৬</h3>
      <p>মোট শূন্যপদ: ০৬ জন।</p>
      <p>আবেদন শুরুর তারিখ: ২২ নভেম্বর ২০২৬ সকাল ০৯:০০ টা</p>
      <p>আবেদনের শেষ তারিখ: ২১ ডিসেম্বর ২০২৬ বিকাল ০৪:০০ টা</p>
      <p>আবেদন লিংক: <a href="https://dcrangamati.teletalk.com.bd">dcrangamati.teletalk.com.bd</a></p>
      <p>অফিশিয়াল ওয়েবসাইট: <a href="https://rangamati.gov.bd">rangamati.gov.bd</a></p>
      <p>স্মারক নম্বর: ০৫.৪২.৮৪০০.০২০.১১.০০১.২৬.৩১২</p>
      <figure><img src="https://bdgovtjob.net/uploads/rangamati-circular.jpg" /></figure>
    </div>

    <div id="circular-item-2" class="jc-mixed-item">
      <h3>২. জেলা প্রশাসকের কার্যালয়, বান্দরবান পার্বত্য জেলা নিয়োগ বিজ্ঞপ্তি ২০২৬</h3>
      <p>মোট শূন্যপদ: ১০ জন।</p>
      <p>আবেদন শুরুর তারিখ: ২৫ নভেম্বর ২০২৬ সকাল ১০:০০ টা</p>
      <p>আবেদনের শেষ তারিখ: ২৪ ডিসেম্বর ২০২৬ বিকাল ০৫:০০ টা</p>
      <p>আবেদন লিংক: <a href="https://dcbandarban.teletalk.com.bd">dcbandarban.teletalk.com.bd</a></p>
      <p>অফিশিয়াল ওয়েবসাইট: <a href="https://bandarban.gov.bd">bandarban.gov.bd</a></p>
      <p>স্মারক নম্বর: ০৫.৪২.০৩০০.০২০.১১.০০১.২৬.৫৫০</p>
      <figure><img src="https://bdgovtjob.net/uploads/bandarban-circular.jpg" /></figure>
    </div>
  </div>
</article>
`;

const MOCK_IDRA_SINGLE_HTML = `
<article class="post-999">
  <h1 class="entry-title">বীমা উন্নয়ন ও নিয়ন্ত্রণ কর্তৃপক্ষ (IDRA) জব সার্কুলার ২০২৬</h1>
  <table class="jc-table">
    <tbody>
      <tr><th>প্রতিষ্ঠানের নাম</th><td>বীমা উন্নয়ন ও নিয়ন্ত্রণ কর্তৃপক্ষ (IDRA)</td></tr>
      <tr><th>মোট শূন্যপদ</th><td>০১ জন</td></tr>
      <tr><th>বেতন স্কেল</th><td>আলোচনা সাপেক্ষে</td></tr>
      <tr><th>আবেদনের শেষ তারিখ</th><td>৩০ নভেম্বর ২০২৬</td></tr>
      <tr><th>আবেদন শুরুর তারিখ</th><td>১০ নভেম্বর ২০২৬</td></tr>
      <tr><th>শিক্ষাগত যোগ্যতা</th><td>স্নাতকোত্তর</td></tr>
      <tr><th>স্মারক নম্বর</th><td>৫৩.০৩.০০০০.০০০.০০৯.১১.০০১০.২৬.৪২৯</td></tr>
      <tr><th>অফিশিয়াল ওয়েবসাইট</th><td><a href="https://idra.org.bd">idra.org.bd</a></td></tr>
    </tbody>
  </table>
</article>
`;

describe('JobFill BD — BD Govt Job Full Integration Suite', () => {
  beforeEach(async () => {
    await resetCheckpoint();
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    await resetCheckpoint();
  });

  describe('1. Dynamic Pagination Discovery', () => {
    it('should dynamically discover total pages from pagination nav without hardcoding', () => {
      const pag = discoverPagination(MOCK_PAGINATION_HTML, BDGOVTJOB_ALL_JOBS_URL);

      expect(pag.currentPage).toBe(1);
      expect(pag.totalPages).toBe(152);
      expect(pag.nextPageUrl).toBe('https://bdgovtjob.net/category/all-jobs/page/2/');
      expect(pag.pageLinks).toContain('https://bdgovtjob.net/category/all-jobs/page/152/');
    });

    it('should correctly parse page 2 URL and identify next/prev links', () => {
      const page2Html = `
        <nav id="nav-below" class="paging-navigation">
          <div class="nav-links">
            <a class="prev page-numbers" href="https://bdgovtjob.net/category/all-jobs/">← আগের</a>
            <a class="page-numbers" href="https://bdgovtjob.net/category/all-jobs/">১</a>
            <span aria-current="page" class="page-numbers current">২</span>
            <a class="page-numbers" href="https://bdgovtjob.net/category/all-jobs/page/3/">৩</a>
            <a class="next page-numbers" href="https://bdgovtjob.net/category/all-jobs/page/3/">পরের →</a>
          </div>
        </nav>
      `;
      const pag = discoverPagination(page2Html, 'https://bdgovtjob.net/category/all-jobs/page/2/');

      expect(pag.currentPage).toBe(2);
      expect(pag.totalPages).toBe(3);
      expect(pag.prevPageUrl).toBe('https://bdgovtjob.net/category/all-jobs/');
      expect(pag.nextPageUrl).toBe('https://bdgovtjob.net/category/all-jobs/page/3/');
    });
  });

  describe('2. Tier 1 Fast Catalog Card Parser', () => {
    it('should format compact date strings from data-days into standard YYYY-MM-DD HH:mm', () => {
      expect(formatCompactDateString('20261221T1600')).toBe('2026-12-21 16:00');
      expect(formatCompactDateString('20261121')).toBe('2026-11-21');
      expect(formatCompactDateString('Already Standard')).toBe('Already Standard');
    });

    it('should parse structured machine-readable bdg-track attributes from card HTML', () => {
      const cardHtml = `
        <article id="post-1226" class="bdg-card">
          <span class="bdg-track"
            data-post-id="1226"
            data-t="সকল জেলা প্রশাসকের কার্যালয়ে নিয়োগ ২০২৬ – DC Office Job Circular 2026"
            data-u="https://bdgovtjob.net/dc-office-job-circular/"
            data-c="সরকারি চাকরি"
            data-e="1795258800"
            data-l="1797847200"
            data-days="20261121T1700,20261221T1600"
            data-n="২৬৩"
            data-i="https://bdgovtjob.net/uploads/dc.png">
          </span>
          <time datetime="2026-11-18">১৮ নভেম্বর ২০২৬</time>
        </article>
      `;
      const card = parseBdGovtJobCard(cardHtml);

      expect(card).not.toBeNull();
      expect(card!.postId).toBe('1226');
      expect(card!.title).toBe('সকল জেলা প্রশাসকের কার্যালয়ে নিয়োগ ২০২৬ – DC Office Job Circular 2026');
      expect(card!.canonicalUrl).toBe('https://bdgovtjob.net/dc-office-job-circular/');
      expect(card!.category).toBe('সরকারি চাকরি');
      expect(card!.vacancies).toBe(263);
      expect(card!.deadlinesList.length).toBe(2);
      expect(card!.publishedDateText).toBe('১৮ নভেম্বর ২০২৬');
    });

    it('should transform card data to raw item preserving secondary source evidence', () => {
      const cardHtml = `
        <article id="post-1227" class="bdg-card">
          <span class="bdg-track"
            data-post-id="1227"
            data-t="বাংলাদেশ পুলিশ নিয়োগ বিজ্ঞপ্তি ২০২৬"
            data-u="https://bdgovtjob.net/police-job-circular/"
            data-c="ডিফেন্স জব সার্কুলার"
            data-e="1795258800"
            data-l="1797847200"
            data-days="20261215T1700"
            data-n="১৫০">
          </span>
        </article>
      `;
      const card = parseBdGovtJobCard(cardHtml);
      expect(card).not.toBeNull();

      const item = cardDataToRawItem(card!);
      expect(item.externalId).toBe('bdgovtjob-post-1227');
      expect(item.sourceJobId).toBe('bdgovtjob:post:1227');
      expect(item.secondarySourceUrl).toBe('https://bdgovtjob.net/police-job-circular/');
      expect(item.verificationStatus).toBe('SECONDARY_SOURCE_ONLY');
      expect(item.vacancies).toBe(150);
      expect(item.organization).toContain('বাংলাদেশ পুলিশ');
    });
  });

  describe('3. Multi-Notice Splitting (#circular-item-N)', () => {
    it('should split Archetype B bundle into distinct notices without hardcoding BPSC', () => {
      const meta = discoverArticleMetadata(MOCK_DC_BUNDLE_HTML, 'https://bdgovtjob.net/dc-office-job-circular/');
      const notices = extractMultipleCirculars(MOCK_DC_BUNDLE_HTML, meta, 'https://bdgovtjob.net/dc-office-job-circular/');

      expect(notices.length).toBe(2);

      // Notice 1: Rangamati DC Office
      const n1 = notices[0];
      expect(n1.sectionIndex).toBe(1);
      expect(n1.organization).toContain('জেলা প্রশাসকের কার্যালয়, রাঙ্গামাটি');
      expect(n1.vacancies).toBe(6);
      expect(n1.applicationUrl).toBe('https://dcrangamati.teletalk.com.bd');
      expect(n1.officialSourceUrl).toBe('https://rangamati.gov.bd');
      expect(n1.memorandumNumber).toBe('০৫.৪২.৮৪০০.০২০.১১.০০১.২৬.৩১২');
      expect(n1.deadlineText).toContain('২১ ডিসেম্বর ২০২৬');
      expect(n1.sourceArticleUrl).toBe('https://bdgovtjob.net/dc-office-job-circular/#circular-item-1');

      // Notice 2: Bandarban DC Office
      const n2 = notices[1];
      expect(n2.sectionIndex).toBe(2);
      expect(n2.organization).toContain('জেলা প্রশাসকের কার্যালয়, বান্দরবান');
      expect(n2.vacancies).toBe(10);
      expect(n2.applicationUrl).toBe('https://dcbandarban.teletalk.com.bd');
      expect(n2.officialSourceUrl).toBe('https://bandarban.gov.bd');
      expect(n2.memorandumNumber).toBe('০৫.৪২.০৩০০.০২০.১১.০০১.২৬.৫৫০');
      expect(n2.deadlineText).toContain('২৪ ডিসেম্বর ২০২৬');
      expect(n2.sourceArticleUrl).toBe('https://bdgovtjob.net/dc-office-job-circular/#circular-item-2');
    });

    it('should accurately extract organization from single-table article (IDRA) without defaulting to BPSC', () => {
      const meta = discoverArticleMetadata(MOCK_IDRA_SINGLE_HTML, 'https://bdgovtjob.net/idra-job-circular/');
      const notices = extractMultipleCirculars(MOCK_IDRA_SINGLE_HTML, meta, 'https://bdgovtjob.net/idra-job-circular/');

      expect(notices.length).toBe(1);
      const idra = notices[0];
      expect(idra.organization).toBe('বীমা উন্নয়ন ও নিয়ন্ত্রণ কর্তৃপক্ষ (IDRA)');
      expect(idra.organizationBn).toBe('বীমা উন্নয়ন ও নিয়ন্ত্রণ কর্তৃপক্ষ (IDRA)');
      expect(idra.vacancies).toBe(1);
      expect(idra.deadlineText).toBe('৩০ নভেম্বর ২০২৬');
      expect(idra.memorandumNumber).toBe('৫৩.০৩.০০০০.০০০.০০৯.১১.০০১০.২৬.৪২৯');
      expect(idra.officialSourceUrl).toBe('https://idra.org.bd');
    });
  });

  describe('4. Bengali Category Normalization', () => {
    it('should map Bengali Defence and Security categories to "Defence / Security"', () => {
      expect(normalizeCategory('ডিফেন্স জব সার্কুলার')).toBe('Defence / Security');
      expect(normalizeCategory('প্রতিরক্ষা')).toBe('Defence / Security');
      expect(normalizeCategory('বাংলাদেশ পুলিশ নিয়োগ')).toBe('Defence / Security');
      expect(normalizeCategory('সেনাবাহিনী নিয়োগ')).toBe('Defence / Security');
    });

    it('should map Pharmaceuticals and Company categories to "Private"', () => {
      expect(normalizeCategory('ফার্মাসিউটিক্যালস চাকরি')).toBe('Private');
      expect(normalizeCategory('ফার্মাসিউটিকাল')).toBe('Private');
      expect(normalizeCategory('ঔষধ কোম্পানি')).toBe('Private');
      expect(normalizeCategory('গ্রুপ অব কোম্পানি চাকরি')).toBe('Private');
      expect(normalizeCategory('গ্রুপ অফ কোম্পানি')).toBe('Private');
      expect(normalizeCategory('বেসরকারি কোম্পানি')).toBe('Private');
    });

    it('should map Education and Teaching categories to "Teaching"', () => {
      expect(normalizeCategory('শিক্ষা প্রতিষ্ঠান চাকরি')).toBe('Teaching');
      expect(normalizeCategory('স্কুল শিক্ষক')).toBe('Teaching');
      expect(normalizeCategory('কলেজ প্রভাষক')).toBe('Teaching');
    });

    it('should map University categories to "University"', () => {
      expect(normalizeCategory('বিশ্ববিদ্যালয় চাকরি')).toBe('University');
      expect(normalizeCategory('বিশ্ববিদ্যালয়')).toBe('University');
    });
  });

  describe('5. Resumable Checkpoint Persistence (jobfill_bdgovtjob_crawl_checkpoint_v1)', () => {
    it('should create default checkpoint with IDLE status and page 1', () => {
      const cp = createDefaultCheckpoint('ALL_JOBS');
      expect(cp.status).toBe('IDLE');
      expect(cp.currentPage).toBe(1);
      expect(cp.totalPagesDiscovered).toBe(1);
      expect(cp.processedArticleUrls).toEqual([]);
    });

    it('should save and reload checkpoint accurately', async () => {
      const cp = createDefaultCheckpoint('ALL_JOBS');
      cp.status = 'CRAWLING';
      cp.currentPage = 5;
      cp.totalPagesDiscovered = 152;
      cp.discoveredArticleUrls.push('https://bdgovtjob.net/article-1/');
      cp.processedArticleUrls.push('https://bdgovtjob.net/article-1/');

      await saveCheckpoint(cp);
      const loaded = await loadCheckpoint();

      expect(loaded.status).toBe('CRAWLING');
      expect(loaded.currentPage).toBe(5);
      expect(loaded.totalPagesDiscovered).toBe(152);
      expect(loaded.processedArticleUrls).toContain('https://bdgovtjob.net/article-1/');
    });

    it('should support pausing and resuming the crawler', async () => {
      const crawler = new BdGovtJobCrawler();
      crawler.pause();

      vi.spyOn(jobFetcher, 'safePublicGet').mockResolvedValue({
        ok: true,
        status: 200,
        body: MOCK_PAGINATION_HTML,
      } as any);

      // Run crawl while paused: should save status as PAUSED and not advance
      const res = await crawler.crawl({ maxPages: 2, rateLimitMs: 0 });
      expect(res.checkpoint.status).toBe('PAUSED');

      // Now resume and run: should advance
      crawler.resume();
      const resumeRes = await crawler.crawl({ maxPages: 1, rateLimitMs: 0 });
      expect(resumeRes.pagesCrawled).toBe(1);
      expect(resumeRes.checkpoint.currentPage).toBe(2);
    });
  });

  describe('6. Deduplication and Cross-Year Collision Prevention', () => {
    it('should distinguish historical circulars with same organization and title across different publication years', () => {
      const oldJob: NormalizedJobCircular = {
        id: 'bpsc-ad-2021',
        sourceId: 'bdgovtjob',
        sourceJobId: 'bdgovtjob:post:100:1',
        jobTitle: 'Assistant Director',
        position: 'Assistant Director',
        organization: 'Bangladesh Public Service Commission (BPSC)',
        organizationBn: 'বাংলাদেশ সরকারি কর্ম কমিশন',
        category: 'Government',
        employmentType: 'Full Time',
        vacancies: 50,
        publishedAt: Date.parse('2021-03-01T00:00:00Z'),
        publishedDateText: '2021-03-01',
        deadlineAt: Date.parse('2021-04-01T00:00:00Z'),
        deadlineText: '2021-04-01',
        deadlineVerified: true,
        sourceVerification: 'discovery_only',
        status: 'expired',
        firstDiscoveredAt: Date.parse('2021-03-01T00:00:00Z'),
        lastCheckedAt: Date.parse('2021-03-01T00:00:00Z'),
      };

      const newJob: NormalizedJobCircular = {
        id: 'bpsc-ad-2026',
        sourceId: 'bdgovtjob',
        sourceJobId: 'bdgovtjob:post:900:1',
        jobTitle: 'Assistant Director',
        position: 'Assistant Director',
        organization: 'Bangladesh Public Service Commission (BPSC)',
        organizationBn: 'বাংলাদেশ সরকারি কর্ম কমিশন',
        category: 'Government',
        employmentType: 'Full Time',
        vacancies: 60,
        publishedAt: Date.parse('2026-03-01T00:00:00Z'),
        publishedDateText: '2026-03-01',
        deadlineAt: Date.parse('2026-04-01T00:00:00Z'),
        deadlineText: '2026-04-01',
        deadlineVerified: true,
        sourceVerification: 'discovery_only',
        status: 'active',
        firstDiscoveredAt: Date.parse('2026-03-01T00:00:00Z'),
        lastCheckedAt: Date.parse('2026-03-01T00:00:00Z'),
      };

      // Confidence between two different years should be 0 (areDistinctCirculars returns true)
      const conf = computeDuplicateMatchConfidence(oldJob, newJob);
      expect(conf).toBe(0);

      // Deduplication should NOT merge 2026 job into 2021 job
      const mergeResult = deduplicateAndMergeJobs([oldJob], [newJob]);
      expect(mergeResult.newJobs.length).toBe(1);
      expect(mergeResult.newJobs[0].id).toBe('bpsc-ad-2026');
      expect(mergeResult.mergedJobs.length).toBe(2);
    });

    it('should prevent cross-year collision even across different sources (e.g. bpsc official vs bdgovtjob secondary)', () => {
      const oldOfficialJob: NormalizedJobCircular = {
        id: 'official-bpsc-2021',
        sourceId: 'bpsc',
        sourceJobId: 'bpsc:2021:circular1',
        jobTitle: 'Assistant Director',
        position: 'Assistant Director',
        organization: 'Bangladesh Public Service Commission (BPSC)',
        organizationBn: 'বাংলাদেশ সরকারি কর্ম কমিশন',
        category: 'Government',
        employmentType: 'Full Time',
        vacancies: 50,
        publishedAt: Date.parse('2021-03-01T00:00:00Z'),
        publishedDateText: '2021-03-01',
        deadlineAt: Date.parse('2021-04-01T00:00:00Z'),
        deadlineText: '2021-04-01',
        deadlineVerified: true,
        sourceVerification: 'official_verified',
        status: 'expired',
        firstDiscoveredAt: Date.parse('2021-03-01T00:00:00Z'),
        lastCheckedAt: Date.parse('2021-03-01T00:00:00Z'),
      };

      const newSecondaryJob: NormalizedJobCircular = {
        id: 'bdgovtjob-bpsc-2026',
        sourceId: 'bdgovtjob',
        sourceJobId: 'bdgovtjob:post:900',
        jobTitle: 'Assistant Director',
        position: 'Assistant Director',
        organization: 'Bangladesh Public Service Commission (BPSC)',
        organizationBn: 'বাংলাদেশ সরকারি কর্ম কমিশন',
        category: 'Government',
        employmentType: 'Full Time',
        vacancies: 60,
        publishedAt: Date.parse('2026-03-01T00:00:00Z'),
        publishedDateText: '2026-03-01',
        deadlineAt: Date.parse('2026-04-01T00:00:00Z'),
        deadlineText: '2026-04-01',
        deadlineVerified: true,
        sourceVerification: 'discovery_only',
        status: 'active',
        firstDiscoveredAt: Date.parse('2026-03-01T00:00:00Z'),
        lastCheckedAt: Date.parse('2026-03-01T00:00:00Z'),
      };

      // areDistinctCirculars returns true because publication years differ (2021 vs 2026)
      const conf = computeDuplicateMatchConfidence(oldOfficialJob, newSecondaryJob);
      expect(conf).toBe(0);

      const mergeResult = deduplicateAndMergeJobs([oldOfficialJob], [newSecondaryJob]);
      expect(mergeResult.newJobs.length).toBe(1);
      expect(mergeResult.newJobs[0].possibleDuplicateOfId).toBeUndefined();
    });

    it('should seamlessly merge and enrich single-notice shallow card with deep extracted details without duplicating', () => {
      // 1. Shallow card from Tier 1
      const shallowCardItem = cardDataToRawItem({
        postId: '999',
        title: 'বীমা উন্নয়ন ও নিয়ন্ত্রণ কর্তৃপক্ষ (IDRA) জব সার্কুলার ২০২৬',
        canonicalUrl: 'https://bdgovtjob.net/idra-job-circular/',
        category: 'সরকারি চাকরি',
        earliestDeadline: null,
        latestDeadline: null,
        deadlinesList: ['20261130'],
        vacancies: 1,
      });
      const shallowJob = BdGovtJobAdapter.parseJob(shallowCardItem);

      // 2. Deep extracted notice from Tier 2
      const meta = discoverArticleMetadata(MOCK_IDRA_SINGLE_HTML, 'https://bdgovtjob.net/idra-job-circular/');
      const notices = extractMultipleCirculars(MOCK_IDRA_SINGLE_HTML, meta, 'https://bdgovtjob.net/idra-job-circular/');
      expect(notices.length).toBe(1);

      const deepItem: any = {
        externalId: 'bdgovtjob-post-999',
        sourceJobId: 'bdgovtjob:post:999',
        jobTitle: notices[0].jobTitle,
        position: notices[0].postNames[0] || notices[0].jobTitle,
        organization: notices[0].organization,
        organizationBn: notices[0].organizationBn,
        vacancies: notices[0].vacancies,
        category: 'Government',
        employmentType: 'Full Time',
        circularNumber: notices[0].memorandumNumber,
        officialSourceUrl: notices[0].officialSourceUrl,
        deadlineText: notices[0].deadlineText,
        sourceUrl: 'https://bdgovtjob.net/idra-job-circular/',
        secondarySourceUrl: 'https://bdgovtjob.net/idra-job-circular/',
      };
      const deepJob = BdGovtJobAdapter.parseJob(deepItem);

      const mergeResult = deduplicateAndMergeJobs([shallowJob], [deepJob]);
      // Should merge into the existing job, NOT create a second new job
      expect(mergeResult.newJobs.length).toBe(0);
      expect(mergeResult.updatedJobs.length).toBe(1);
      expect(mergeResult.mergedJobs.length).toBe(1);
      expect(mergeResult.mergedJobs[0].circularNumber).toBe('৫৩.০৩.০০০০.০০০.০০৯.১১.০০১০.২৬.৪২৯');
    });
  });

  describe('7. UI Source Filter Integration (JobFilters.tsx)', () => {
    it('should include bdgovtjob in SOURCE_FILTER_GROUPS with accurate labels', () => {
      const group = SOURCE_FILTER_GROUPS.find((g) => g.id === 'bdgovtjob');
      expect(group).toBeDefined();
      expect(group!.labelEn).toContain('BD Govt Job');
      expect(group!.shortLabelBn).toBe('বিডি গভর্নমেন্ট জব');
    });

    it('should match jobs from bdgovtjob when bdgovtjob filter is active', () => {
      const job: NormalizedJobCircular = {
        id: 'bdgovtjob-test-1',
        sourceId: 'bdgovtjob',
        sourceName: 'BD Govt Job (bdgovtjob.net)',
        jobTitle: 'DC Office Circular',
        position: 'Office Assistant',
        organization: 'DC Office',
        category: 'Government',
        employmentType: 'Full Time',
        sourceVerification: 'discovery_only',
        status: 'active',
        firstDiscoveredAt: Date.now(),
        lastCheckedAt: Date.now(),
      };

      expect(isJobMatchingSourceGroup(job, 'bdgovtjob')).toBe(true);
      expect(isJobMatchingSourceGroup(job, 'teletalk')).toBe(false);
      expect(isJobMatchingSourceGroup(job, 'bdjobs')).toBe(false);
      expect(isJobMatchingSourceGroup(job, 'All')).toBe(true);
    });

    it('should match BPSC jobs with matchesSearchCategory when BPSC filter is selected', () => {
      const bpscJob: NormalizedJobCircular = {
        id: 'bpsc-ad-test',
        sourceId: 'bdgovtjob',
        sourceJobId: 'bdgovtjob:bpsc:sec_1',
        jobTitle: 'Bangladesh Public Service Commission Circular',
        position: 'Assistant Director',
        organization: 'Bangladesh Public Service Commission (BPSC)',
        organizationShortName: 'BPSC',
        category: 'Government',
        cadreStatus: 'Cadre',
        employmentType: 'Full Time',
        sourceVerification: 'discovery_only',
        status: 'active',
        firstDiscoveredAt: Date.now(),
        lastCheckedAt: Date.now(),
      };

      expect(matchesSearchCategory(bpscJob, 'BPSC' as any)).toBe(true);
      expect(matchesSearchCategory(bpscJob, 'Bank' as any)).toBe(false);
    });
  });

  describe('8. Crawler Orchestration via BdGovtJobAdapter', () => {
    it('should run full crawl mode via BdGovtJobAdapter.fetchJobs({ mode: "ALL_JOBS" })', async () => {
      vi.spyOn(jobFetcher, 'safePublicGet').mockImplementation(async (url: string) => {
        if (url.includes('category/all-jobs')) {
          return { ok: true, status: 200, body: MOCK_PAGINATION_HTML } as any;
        }
        if (url.includes('dc-office')) {
          return { ok: true, status: 200, body: MOCK_DC_BUNDLE_HTML } as any;
        }
        return { ok: true, status: 200, body: '<html></html>' } as any;
      });

      const outcome = await (BdGovtJobAdapter as any).startFullCrawl({ maxPages: 1, rateLimitMs: 0 });
      expect(outcome.success).toBe(true);
      expect(outcome.jobs.length).toBeGreaterThan(0);
      expect(outcome.directPortalUrl).toBe(BDGOVTJOB_ALL_JOBS_URL);
    });

    it('should run incremental sync via BdGovtJobAdapter.syncIncremental() without corrupting completed checkpoint', async () => {
      // Simulate completed full crawl checkpoint at page 153
      const cp = createDefaultCheckpoint('ALL_JOBS');
      cp.status = 'COMPLETED';
      cp.currentPage = 153;
      cp.totalPagesDiscovered = 152;
      await saveCheckpoint(cp);

      vi.spyOn(jobFetcher, 'safePublicGet').mockImplementation(async (url: string) => {
        if (url.includes('bpsc-job-circular')) {
          return { ok: true, status: 200, body: MOCK_DC_BUNDLE_HTML } as any;
        }
        return { ok: true, status: 200, body: MOCK_PAGINATION_HTML } as any;
      });

      const outcome = await (BdGovtJobAdapter as any).syncIncremental();
      expect(outcome.success).toBe(true);
      expect(outcome.jobs.length).toBeGreaterThan(0);

      // Verify checkpoint was NOT corrupted and currentPage remained 153
      const updatedCp = await loadCheckpoint();
      expect(updatedCp.currentPage).toBe(153);
    });

    it('should retry failed URLs and remove recovered items from checkpoint.failedUrls', async () => {
      const cp = createDefaultCheckpoint('ALL_JOBS');
      cp.status = 'FAILED';
      cp.failedUrls = [
        { url: 'https://bdgovtjob.net/category/all-jobs/page/2/', error: 'HTTP 500', retries: 1 },
      ];
      await saveCheckpoint(cp);

      vi.spyOn(jobFetcher, 'safePublicGet').mockResolvedValue({
        ok: true,
        status: 200,
        body: MOCK_PAGINATION_HTML,
      } as any);

      const outcome = await (BdGovtJobAdapter as any).retryFailed({ rateLimitMs: 0 });
      expect(outcome.success).toBe(true);
      expect(outcome.jobs.length).toBeGreaterThan(0);

      const updatedCp = await loadCheckpoint();
      expect(updatedCp.failedUrls.length).toBe(0);
      expect(updatedCp.status).not.toBe('FAILED');
    });
  });
});
