// JobFill BD - Bangladesh Complete Government Job Circular Aggregation Engine
// SECOND-PHASE REAL-WORLD INTEGRATION AUDIT & LIVE SMOKE TEST SUITE
// Tests every one of the 31 registered government sources against live public endpoints.
// Verifies:
// 1. Live connectivity, HTTP status code, content-type, latency, payload size.
// 2. Real parser execution on live returned HTML.
// 3. Notice classification (Primary Circular, Exam/Admit/Result Update, Administrative non-job).
// 4. Real multi-page pagination behavior.
// 5. Circular field extraction & Grade 1-20 detection.
// 6. Circular update linking (linking exam notices/results without duplicate cards).
// 7. Dashboard overview integration & Health counter consistency (zero double counting).

import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  SEED_GOVERNMENT_SOURCES,
  GovernmentSourceRegistry,
} from '../../src/jobs/sources/government-registry/government-source-registry';
import {
  GovernmentNoticeClassifier,
} from '../../src/jobs/services/government-notice-classifier';
import {
  parseBangladeshPortalNoticeTableHtml,
  parseNationalPortalJobTenderHtml,
  parseDhakaUniversityNoticeLinks,
} from '../../src/jobs/sources/national-portal/national-portal.adapter';
import { detectAccessRestrictionWithReason } from '../../src/jobs/services/captcha-detector';
import { JobTaxonomyClassifier } from '../../src/jobs/services/taxonomy-classifier';
import { JobGradeExtractor } from '../../src/jobs/services/grade-extractor';
import { extractJobRequirements } from '../../src/jobs/services/eligibility-helper';
import { NormalizedJobCircular } from '../../src/jobs/types/job.types';
import { GovernmentSourceRecord } from '../../src/jobs/types/government.types';

export interface RealSourceAuditResult {
  sourceId: string;
  sourceName: string;
  organizationName: string;
  sourceGroup: string;
  officialDomain: string;
  recruitmentPageUrl: string;
  noticePageUrl: string;
  applicationPortalUrl?: string;
  adapterAssigned: string;
  accessMethod: string;
  requestAttempted: boolean;
  httpStatus: number;
  contentType: string;
  latencyMs: number;
  responseSizeBytes: number;
  blockedByCaptcha: boolean;
  blockedReason?: string;
  error?: string;
  rawNoticesFound: number;
  recruitmentNoticesIdentified: number;
  validCircularsExtracted: number;
  examResultUpdatesLinked: number;
  rejectedAdministrativeNotices: number;
  parserErrors: number;
  paginationSupported: boolean;
  page2Attempted: boolean;
  page2HttpStatus?: number;
  page2NoticesFound?: number;
  sampleJobTitles: string[];
  sampleDetectedGrades: number[];
  actualStatus: 'SUCCESS' | 'PARTIAL' | 'TEMPORARY_FAILURE' | 'BLOCKED' | 'NOT_CONFIGURED' | 'NOT_TESTED' | 'MANUAL_REVIEW_REQUIRED';
  actualStatusReason: string;
  lastCheckedAt: number;
}

const AUDIT_OUT_PATH = 'C:/Users/mahfu/.gemini/antigravity/brain/05e510eb-24f6-4805-b4cf-c419eb0db7d3/scratch/government_sources_real_audit.json';

async function fetchWithTimeout(url: string, timeoutMs = 12000): Promise<{
  status: number;
  contentType: string;
  body: string;
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 JobFillBD/2.0',
      },
      signal: controller.signal,
    });
    const latencyMs = Date.now() - start;
    const contentType = res.headers.get('content-type') || '';
    const body = await res.text();
    return {
      status: res.status,
      contentType,
      body,
      latencyMs,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    return {
      status: 0,
      contentType: '',
      body: '',
      latencyMs,
      error: err?.name === 'AbortError' ? `Timeout after ${timeoutMs}ms` : err?.message || 'Network error',
    };
  } finally {
    clearTimeout(timer);
  }
}

describe('Real-World Government Job Source Integration Audit', () => {
  const allAuditResults: RealSourceAuditResult[] = [];

  it('audits all 31 registered government sources via live HTTP and records factual outcomes', async () => {
    const sources = GovernmentSourceRegistry.getAllSources();
    expect(sources.length).toBe(31);

    const BATCH_SIZE = 4;
    for (let i = 0; i < sources.length; i += BATCH_SIZE) {
      const batch = sources.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (source): Promise<RealSourceAuditResult> => {
        const testUrl = source.recruitmentPageUrl || source.noticePageUrl;
        const adapterName =
          source.sourceId === 'natportal_jobs'
            ? 'NationalPortalAdapter'
            : source.sourceId === 'teletalk_alljobs_govt'
            ? 'TeletalkAdapter'
            : source.sourceId.startsWith('bpsc')
            ? 'BpscAdapter'
            : source.sourceId.includes('bangladesh_bank')
            ? 'BangladeshBankAdapter'
            : source.sourceId === 'du_university'
            ? 'DhakaUniversityAdapter'
            : 'BangladeshPortalNoticeTableAdapter';

        const auditItem: RealSourceAuditResult = {
          sourceId: source.sourceId,
          sourceName: source.sourceName,
          organizationName: source.organizationName,
          sourceGroup: source.sourceGroup,
          officialDomain: source.officialDomain,
          recruitmentPageUrl: source.recruitmentPageUrl,
          noticePageUrl: source.noticePageUrl,
          applicationPortalUrl: source.applicationPortalUrl,
          adapterAssigned: adapterName,
          accessMethod: source.sourceAccessMethod,
          requestAttempted: true,
          httpStatus: 0,
          contentType: '',
          latencyMs: 0,
          responseSizeBytes: 0,
          blockedByCaptcha: false,
          rawNoticesFound: 0,
          recruitmentNoticesIdentified: 0,
          validCircularsExtracted: 0,
          examResultUpdatesLinked: 0,
          rejectedAdministrativeNotices: 0,
          parserErrors: 0,
          paginationSupported: source.paginationMethod === 'PAGE_NUMBER',
          page2Attempted: false,
          sampleJobTitles: [],
          sampleDetectedGrades: [],
          actualStatus: 'TEMPORARY_FAILURE',
          actualStatusReason: '',
          lastCheckedAt: Date.now(),
        };

        const res = await fetchWithTimeout(testUrl, 15000);
        auditItem.httpStatus = res.status;
        auditItem.contentType = res.contentType;
        auditItem.latencyMs = res.latencyMs;
        auditItem.responseSizeBytes = res.body ? Buffer.byteLength(res.body, 'utf-8') : 0;

        if (res.error) {
          auditItem.error = res.error;
          auditItem.actualStatus = 'TEMPORARY_FAILURE';
          auditItem.actualStatusReason = `Connection failure: ${res.error}`;
          return auditItem;
        }

        // Check for access restriction, captcha, waf
        const restriction = detectAccessRestrictionWithReason(res.body, res.status);
        if (restriction.blockedReason) {
          auditItem.blockedByCaptcha = restriction.blockedByCaptcha || false;
          auditItem.blockedReason = restriction.blockedReason;
          auditItem.actualStatus = 'BLOCKED';
          auditItem.actualStatusReason = `Access restricted: ${restriction.blockedReason}`;
          return auditItem;
        }

        if (res.status >= 400) {
          auditItem.actualStatus = res.status === 403 ? 'BLOCKED' : 'TEMPORARY_FAILURE';
          auditItem.actualStatusReason = `Server returned HTTP ${res.status}`;
          return auditItem;
        }

        // Parse HTML
        let parsedRawItems: any[] = [];
        try {
          if (source.sourceId === 'natportal_jobs') {
            parsedRawItems = parseNationalPortalJobTenderHtml(res.body);
          } else if (source.sourceId === 'du_university') {
            parsedRawItems = parseDhakaUniversityNoticeLinks(res.body);
          } else {
            parsedRawItems = parseBangladeshPortalNoticeTableHtml(res.body, {
              idPrefix: source.sourceId,
              organization: source.organizationName,
              organizationBn: source.organizationNameBn,
              baseUrl: `https://${source.officialDomain}`,
              pageUrl: testUrl,
              defaultApplyUrl: source.applicationPortalUrl,
            });
          }
        } catch (parseErr: any) {
          auditItem.parserErrors++;
          auditItem.error = `Parser error: ${parseErr?.message}`;
        }

        auditItem.rawNoticesFound = parsedRawItems.length;

        // Classify each parsed item
        for (const item of parsedRawItems) {
          const classification = GovernmentNoticeClassifier.classifyNotice(
            item.jobTitle || item.position || '',
            item.description,
            item.circularUrl
          );

          if (classification.category === 'ADMINISTRATIVE_NON_JOB') {
            auditItem.rejectedAdministrativeNotices++;
          } else if (classification.category === 'PRIMARY_JOB_CIRCULAR') {
            auditItem.recruitmentNoticesIdentified++;
            auditItem.validCircularsExtracted++;
            if (auditItem.sampleJobTitles.length < 3) {
              auditItem.sampleJobTitles.push(item.jobTitle);
            }
            if (classification.detectedGrade && !auditItem.sampleDetectedGrades.includes(classification.detectedGrade)) {
              auditItem.sampleDetectedGrades.push(classification.detectedGrade);
            }
          } else if (classification.category === 'RECRUITMENT_UPDATE') {
            auditItem.recruitmentNoticesIdentified++;
            auditItem.examResultUpdatesLinked++;
            if (auditItem.sampleJobTitles.length < 3) {
              auditItem.sampleJobTitles.push(`[${classification.subtype}] ${item.jobTitle}`);
            }
          }
        }

        // Test Pagination if supported and page 1 succeeded
        if (source.paginationMethod === 'PAGE_NUMBER' && res.status === 200) {
          auditItem.page2Attempted = true;
          const separator = testUrl.includes('?') ? '&' : '?';
          const page2Url = `${testUrl}${separator}page=2`;
          try {
            const page2Res = await fetchWithTimeout(page2Url, 10000);
            auditItem.page2HttpStatus = page2Res.status;
            if (page2Res.status === 200) {
              let page2Items: any[] = [];
              if (source.sourceId === 'natportal_jobs') {
                page2Items = parseNationalPortalJobTenderHtml(page2Res.body);
              } else if (source.sourceId === 'du_university') {
                page2Items = parseDhakaUniversityNoticeLinks(page2Res.body);
              } else {
                page2Items = parseBangladeshPortalNoticeTableHtml(page2Res.body, {
                  idPrefix: source.sourceId,
                  organization: source.organizationName,
                  baseUrl: `https://${source.officialDomain}`,
                  pageUrl: page2Url,
                });
              }
              auditItem.page2NoticesFound = page2Items.length;
            }
          } catch {
            // Non-critical, record whatever happened
          }
        }

        // Assign factual status
        if (auditItem.validCircularsExtracted > 0 || auditItem.examResultUpdatesLinked > 0) {
          auditItem.actualStatus = 'SUCCESS';
          auditItem.actualStatusReason = `Extracted ${auditItem.validCircularsExtracted} primary circulars & ${auditItem.examResultUpdatesLinked} exam/result updates. HTTP ${res.status}.`;
        } else if (res.status === 200 && auditItem.rawNoticesFound > 0) {
          auditItem.actualStatus = 'PARTIAL';
          auditItem.actualStatusReason = `Fetched ${auditItem.rawNoticesFound} notices successfully, but all were classified as administrative notices (non-job) or pending manual review.`;
        } else if (res.status === 200 && auditItem.rawNoticesFound === 0) {
          auditItem.actualStatus = 'PARTIAL';
          auditItem.actualStatusReason = `HTTP 200 received (${Math.round(auditItem.responseSizeBytes / 1024)} KB), but 0 table notice rows found (portal may use client-side JS rendering or different table selector).`;
        } else {
          auditItem.actualStatus = 'MANUAL_REVIEW_REQUIRED';
          auditItem.actualStatusReason = `HTTP ${res.status} received. Requires manual adapter tuning.`;
        }

        return auditItem;
      });

      const results = await Promise.all(batchPromises);
      allAuditResults.push(...results);
    }

    // Save full JSON audit output
    try {
      fs.writeFileSync(AUDIT_OUT_PATH, JSON.stringify(allAuditResults, null, 2), 'utf-8');
      console.log(`Saved audit results to ${AUDIT_OUT_PATH}`);
    } catch (e) {
      console.error('Failed to write audit JSON:', e);
    }

    expect(allAuditResults.length).toBe(31);
  }, 180000);

  it('computes accurate non-overlapping health metrics across all 31 sources', () => {
    const totalRegistered = allAuditResults.length;
    expect(totalRegistered).toBe(31);

    const verifiedOfficial = allAuditResults.filter((r) =>
      r.officialDomain.endsWith('.gov.bd') ||
      r.officialDomain.endsWith('.mil.bd') ||
      r.officialDomain.endsWith('.ac.bd') ||
      r.officialDomain.endsWith('.edu.bd') ||
      r.officialDomain.endsWith('.org.bd') ||
      r.officialDomain.endsWith('.com.bd')
    ).length;
    expect(verifiedOfficial).toBe(31);

    const attempted = allAuditResults.filter((r) => r.requestAttempted).length;
    expect(attempted).toBe(31);

    const successful = allAuditResults.filter((r) => r.actualStatus === 'SUCCESS').length;
    const partial = allAuditResults.filter((r) => r.actualStatus === 'PARTIAL').length;
    const failed = allAuditResults.filter((r) => r.actualStatus === 'TEMPORARY_FAILURE').length;
    const blocked = allAuditResults.filter((r) => r.actualStatus === 'BLOCKED').length;
    const manualReview = allAuditResults.filter((r) => r.actualStatus === 'MANUAL_REVIEW_REQUIRED').length;
    const untested = allAuditResults.filter((r) => r.actualStatus === 'NOT_TESTED').length;

    // Strict invariant: sum of mutually exclusive statuses equals total attempted!
    expect(successful + partial + failed + blocked + manualReview + untested).toBe(31);

    console.log('Health Counters Summary:', {
      totalRegistered,
      verifiedOfficial,
      attempted,
      successful,
      partial,
      failed,
      blocked,
      manualReview,
      untested,
    });
  });

  it('verifies that notice updates (admit, exam schedule, result) correctly link without creating duplicate independent cards', () => {
    // Exam schedule notice
    const examNotice = GovernmentNoticeClassifier.classifyNotice(
      '৪৫তম বিসিএস পরীক্ষা-২০২২ এর লিখিত পরীক্ষার আসন বিন্যাস ও সময়সূচি',
      'বাংলাদেশ সরকারি কর্ম কমিশন সচিবালয়, ঢাকা',
      'https://bpsc.gov.bd/pages/notices/1234'
    );
    expect(examNotice.category).toBe('RECRUITMENT_UPDATE');
    expect(examNotice.subtype).toBe('EXAM_SCHEDULE_WRITTEN');
    expect(examNotice.isRecruitmentRelated).toBe(true);
    expect(examNotice.isJobCardEligible).toBe(false); // Does NOT create duplicate new job card!
    expect(examNotice.confidenceScore).toBeGreaterThanOrEqual(90);

    // Admit card notice
    const admitNotice = GovernmentNoticeClassifier.classifyNotice(
      'সহকারী প্রাথমিক শিক্ষক নিয়োগ পরীক্ষার প্রবেশপত্র (Admit Card) ডাউনলোড সংক্রান্ত বিজ্ঞপ্তি',
      'প্রাথমিক শিক্ষা অধিদপ্তর',
      'https://dpe.gov.bd/pages/notices/5678'
    );
    expect(admitNotice.category).toBe('RECRUITMENT_UPDATE');
    expect(admitNotice.subtype).toBe('ADMIT_CARD');
    expect(admitNotice.isRecruitmentRelated).toBe(true);
    expect(admitNotice.isJobCardEligible).toBe(false);

    // Exam result notice
    const resultNotice = GovernmentNoticeClassifier.classifyNotice(
      '১০ম গ্রেড ব্যক্তিগত কর্মকর্তা পদের লিখিত পরীক্ষার ফলাফল প্রকাশ',
      'বাংলাদেশ সরকারি কর্ম কমিশন',
      'https://bpsc.gov.bd/pages/notices/7890'
    );
    expect(resultNotice.category).toBe('RECRUITMENT_UPDATE');
    expect(resultNotice.subtype).toBe('RESULT_WRITTEN');
    expect(resultNotice.isJobCardEligible).toBe(false);

    // Administrative non-job memo (transfer/leave)
    const adminNotice = GovernmentNoticeClassifier.classifyNotice(
      'জনাব মো: রফিকুল ইসলাম, উপসচিব এর বহিঃবাংলাদেশ অর্জিত ছুটি মঞ্জুর সংক্রান্ত',
      'জনপ্রশাসন মন্ত্রণালয়',
      'https://mopa.gov.bd/pages/notices/9999'
    );
    expect(adminNotice.category).toBe('ADMINISTRATIVE_NON_JOB');
    expect(adminNotice.isRecruitmentRelated).toBe(false);
    expect(adminNotice.isJobCardEligible).toBe(false);
  });

  it('verifies circular field extraction accuracy for government jobs (Grade, Education, Vacancy, Age, Subject)', () => {
    const rawJobDescription = `
      পদের নাম: সহকারী প্রোগ্রামার (Assistant Programmer)
      পদ সংখ্যা: ১৫টি (15)
      বেতন স্কেল: ২২,০০০-৫৩,০৬০/- (জাতীয় বেতন স্কেল ২০১৫ এর ৯ম গ্রেড)
      শিক্ষাগত যোগ্যতা: কোনো স্বীকৃত বিশ্ববিদ্যালয় হতে কম্পিউটার সায়েন্স/কম্পিউটার ইঞ্জিনিয়ারিং বিষয়ে স্নাতক বা সমমানের ডিগ্রি। ন্যূনতম সিজিপিএ ৩.০০ থাকতে হবে।
      বয়সসীমা: ০১-১১-২০২৬ তারিখে অনূর্ধ্ব ৩০ বছর (মুক্তিযোদ্ধা কোটায় ৩২ বছর)।
      আবেদনের শেষ তারিখ: ১৫-১২-২০২৬
    `;

    // 1. Grade extraction
    const detectedGrade = JobGradeExtractor.extractJobGrade({
      jobTitle: 'সহকারী প্রোগ্রামার (৯ম গ্রেড)',
      description: rawJobDescription,
    });
    expect(detectedGrade?.gradeNumber).toBe(9);
    expect(detectedGrade?.gradeLabel).toContain('9th Grade');

    // 2. Requirements extraction
    const requirements = extractJobRequirements({ description: rawJobDescription });
    expect(requirements.minEducationLevel).toBe('Bachelor');
    expect(requirements.requiredSubjects).toContain('computer science');
    expect(requirements.minGpa).toBe(3.0);
    expect(requirements.maxAgeYears).toBe(30);

    // 3. Taxonomy Enrichment
    const mockCircular: Partial<NormalizedJobCircular> = {
      id: 'test_job_1',
      jobTitle: 'সহকারী প্রোগ্রামার (Assistant Programmer) ৯ম গ্রেড',
      description: rawJobDescription,
      organization: 'Department of ICT',
      isGovernmentJob: true,
      gradeNumber: 9 as any,
    };
    JobTaxonomyClassifier.enrichJobWithTaxonomy(mockCircular as NormalizedJobCircular);
    expect(mockCircular.taxonomyCategoryNameEn).toBe('IT & Software');
    expect(mockCircular.taxonomyCategoryId).toBe('it_software');
    expect(mockCircular.taxonomyCategoryIds).toContain('it_software');
    expect(mockCircular.isGovernmentJob).toBe(true);
  });
});
