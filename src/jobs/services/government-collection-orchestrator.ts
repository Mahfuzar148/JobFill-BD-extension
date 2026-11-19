// JobFill BD - Centralized Government Job Collection Orchestrator
// Coordinates authorized, multi-source collection across registered ministries, directorates & commissions.
// Features:
// 1. Independent source isolation (one failed website never stops other sources).
// 2. Complete multi-page pagination & bounded historical scanning.
// 3. Strict notice classification (discards administrative memos, links exam updates, preserves circulars).
// 4. Multi-label universal taxonomy and official Grade 1-20 extraction.
// 5. Deduplication and canonical record enrichment into central IndexedDB.

import {
  GovernmentSourceRecord,
  GovernmentSourcePaginationResult,
  GovernmentCollectionRunSummary,
} from '../types/government.types';
import { GovernmentSourceRegistry } from '../sources/government-registry/government-source-registry';
import { GovernmentNoticeClassifier } from './government-notice-classifier';
import { NormalizedJobCircular } from '../types/job.types';
import { JobRepository } from '../database/job-repository';
import { safePublicGet } from './job-fetcher';
import { normalizeJobRecord } from './job-normalizer';
import { validateJobCircular } from './job-validator';
import { JobTaxonomyClassifier } from './taxonomy-classifier';
import {
  parseBangladeshPortalNoticeTableHtml,
  parseNationalPortalJobTenderHtml,
  parseDhakaUniversityNoticeLinks,
} from '../sources/national-portal/national-portal.adapter';

export interface GovernmentNoticeItem {
  rawTitle: string;
  rawDetails?: string;
  noticeUrl?: string;
  pdfUrl?: string;
  publishedDateText?: string;
  pageNumber?: number;
}

export class GovernmentCollectionOrchestrator {
  private static readonly MAX_CONCURRENT_SOURCES = 4;
  private static readonly DEFAULT_PAGE_LIMIT = 5;

  /**
   * Executes a collection run across active or filtered government sources.
   */
  public static async executeGovernmentCollection(
    optionsOrSources?:
      | {
          sourceIds?: string[];
          sourceGroup?: string;
          signal?: AbortSignal;
          onProgress?: (completed: number, total: number, activeSourceName?: string) => void;
        }
      | GovernmentSourceRecord[],
    fetchNoticeItems?: (sourceId: string, page: number) => Promise<GovernmentNoticeItem[]>,
    maxPagesOverride?: number
  ): Promise<GovernmentCollectionRunSummary> {
    const startedAt = Date.now();
    const runId = `gov_run_${startedAt}`;

    let targetSources: GovernmentSourceRecord[] = [];
    let signal: AbortSignal | undefined;
    let onProgress: ((completed: number, total: number, activeSourceName?: string) => void) | undefined;

    if (Array.isArray(optionsOrSources)) {
      targetSources = [...optionsOrSources];
    } else {
      targetSources = GovernmentSourceRegistry.getActiveSources();
      if (optionsOrSources?.sourceIds && optionsOrSources.sourceIds.length > 0) {
        targetSources = targetSources.filter((s) => optionsOrSources.sourceIds!.includes(s.sourceId));
      }
      if (optionsOrSources?.sourceGroup && optionsOrSources.sourceGroup !== 'All') {
        targetSources = targetSources.filter((s) => s.sourceGroup === optionsOrSources.sourceGroup);
      }
      signal = optionsOrSources?.signal;
      onProgress = optionsOrSources?.onProgress;
    }

    const sourceBreakdowns: GovernmentSourcePaginationResult[] = [];
    const collectedCirculars: NormalizedJobCircular[] = [];

    let completedSourcesCount = 0;
    const totalSources = targetSources.length;

    const processSingleSource = async (
      source: GovernmentSourceRecord
    ): Promise<GovernmentSourcePaginationResult> => {
      const sourceStartMs = Date.now();
      onProgress?.(completedSourcesCount, totalSources, source.sourceName);

      const result: GovernmentSourcePaginationResult = {
        sourceId: source.sourceId,
        sourceName: source.sourceName,
        totalPagesDiscovered: 1,
        pagesAttempted: 0,
        pagesSuccessful: 0,
        pagesFailed: 0,
        rawNoticesFound: 0,
        recruitmentNoticesIdentified: 0,
        validCirculars: 0,
        duplicatesMerged: 0,
        rejectedAdministrativeNotices: 0,
        newlySavedRecords: 0,
        durationMs: 0,
        status: 'ACTIVE',
      };

      try {
        const maxPages = maxPagesOverride || source.maxPagesToScan || this.DEFAULT_PAGE_LIMIT;
        let currentPage = 1;
        let hasMorePages = true;

        while (hasMorePages && currentPage <= maxPages) {
          if (signal?.aborted) break;
          result.pagesAttempted++;

          let rawNoticeItems: any[] = [];

          if (fetchNoticeItems) {
            try {
              const customItems = await fetchNoticeItems(source.sourceId, currentPage);
              result.pagesSuccessful++;
              rawNoticeItems = customItems.map((item, idx) => ({
                id: `${source.sourceId}_${currentPage}_${idx}`,
                sourceId: source.sourceId,
                sourceName: source.sourceName,
                organization: source.organizationName,
                organizationBn: source.organizationNameBn,
                jobTitle: item.rawTitle,
                position: item.rawTitle,
                category: 'Government' as const,
                employmentType: 'Full Time' as const,
                qualification: 'Any Qualification',
                location: 'All Bangladesh',
                publishedAt: item.publishedDateText ? Date.parse(item.publishedDateText) || Date.now() : Date.now(),
                applicationStartAt: Date.now(),
                deadlineAt: Date.now() + 15 * 86400000,
                deadlineTimezone: 'Asia/Dhaka' as const,
                deadlineVerified: false,
                circularUrl: item.pdfUrl || item.noticeUrl || source.recruitmentPageUrl,
                applicationUrl: source.applicationPortalUrl || null,
                description: item.rawDetails || item.rawTitle,
                requirements: [],
                sourceVerification: 'official_verified' as const,
                sourceLastCheckedAt: Date.now(),
                firstDiscoveredAt: Date.now(),
                lastUpdatedAt: Date.now(),
                status: 'active' as const,
                governmentGroup: source.sourceGroup,
              }));
            } catch (err: any) {
              result.pagesFailed++;
              if (currentPage === 1) {
                result.status = 'FAILED';
                result.error = err?.message || 'Custom fetcher failure';
              }
              break;
            }
          } else {
            // Construct paginated URL based on source configuration
            let pageUrl = source.recruitmentPageUrl || source.noticePageUrl;
            if (source.paginationMethod === 'PAGE_NUMBER' && currentPage > 1) {
              const separator = pageUrl.includes('?') ? '&' : '?';
              pageUrl = `${pageUrl}${separator}page=${currentPage}`;
            }

            const res = await safePublicGet(pageUrl, 'text/html,application/xhtml+xml,*/*', signal);

            if (!res.ok) {
              result.pagesFailed++;
              if (currentPage === 1) {
                result.status = res.blockedByCaptcha ? 'BLOCKED' : 'FAILED';
                result.error = res.blockedReason || `HTTP ${res.status || 'unknown'}`;
              }
              break;
            }

            result.pagesSuccessful++;

            // Parse raw items using suitable parser based on source type
            if (source.sourceId === 'natportal_jobs') {
              rawNoticeItems = parseNationalPortalJobTenderHtml(res.body);
            } else if (source.sourceId === 'du_university') {
              rawNoticeItems = parseDhakaUniversityNoticeLinks(res.body);
            } else {
              rawNoticeItems = parseBangladeshPortalNoticeTableHtml(res.body, {
                idPrefix: source.sourceId,
                organization: source.organizationName,
                organizationBn: source.organizationNameBn,
                baseUrl: `https://${source.officialDomain}`,
                pageUrl,
                defaultApplyUrl: source.applicationPortalUrl,
              });
            }
          }

          result.rawNoticesFound += rawNoticeItems.length;

          // Apply Government Notice Classifier on each notice
          for (const raw of rawNoticeItems) {
            const classification = GovernmentNoticeClassifier.classifyNotice(
              raw.jobTitle,
              raw.description,
              raw.circularUrl
            );

            if (classification.category === 'ADMINISTRATIVE_NON_JOB') {
              result.rejectedAdministrativeNotices++;
              continue;
            }

            result.recruitmentNoticesIdentified++;

            if (classification.category === 'PRIMARY_JOB_CIRCULAR') {
              const normalized = normalizeJobRecord(raw, {
                sourceId: source.sourceId,
                sourceName: source.sourceName,
                verificationLevel: 'official_verified',
                checkedAt: Date.now(),
              });

              normalized.isGovernmentJob = true;
              normalized.governmentGroup = source.sourceGroup;
              normalized.category = 'Government';

              // Enrich with Government Grade if detected
              if (classification.detectedGrade && !normalized.gradeNumber) {
                normalized.gradeNumber = classification.detectedGrade as any;
                normalized.gradeLabel = `${classification.detectedGrade}th Grade`;
                normalized.gradeVerificationStatus = 'OFFICIAL_MATCH';
              }

              // Multi-Label Universal Taxonomy Classification
              JobTaxonomyClassifier.enrichJobWithTaxonomy(normalized);

              const validation = validateJobCircular(normalized);
              if (validation.isValid) {
                result.validCirculars++;
                collectedCirculars.push(normalized);
              }
            }
          }

          // Check if pagination continues (if fewer items returned than typical page size, stop)
          if (rawNoticeItems.length === 0 || source.paginationMethod === 'NONE') {
            hasMorePages = false;
          } else {
            currentPage++;
            result.totalPagesDiscovered = currentPage;
          }
        }

        result.status = result.pagesSuccessful > 0 ? 'ACTIVE' : result.status;
        GovernmentSourceRegistry.updateSourceHealth(source.sourceId, result.status);
      } catch (err: any) {
        result.status = 'FAILED';
        result.error = err?.message || 'Source request failed';
        GovernmentSourceRegistry.updateSourceHealth(source.sourceId, 'FAILED', result.error);
      } finally {
        result.durationMs = Date.now() - sourceStartMs;
        completedSourcesCount++;
        onProgress?.(completedSourcesCount, totalSources);
      }

      return result;
    };

    // Run active sources in controlled concurrency batches
    for (let i = 0; i < targetSources.length; i += this.MAX_CONCURRENT_SOURCES) {
      if (signal?.aborted) break;
      const batch = targetSources.slice(i, i + this.MAX_CONCURRENT_SOURCES);
      const batchResults = await Promise.all(batch.map((s) => processSingleSource(s)));
      sourceBreakdowns.push(...batchResults);
    }

    // Deduplicate against existing IndexedDB records
    const existingStoredJobs = await JobRepository.getAllJobs();
    const existingIds = new Set(existingStoredJobs.map((j) => j.id));
    const existingFingerprints = new Set(
      existingStoredJobs.map((j) => j.fingerprintHash).filter(Boolean)
    );

    const newlyDiscoveredJobs: NormalizedJobCircular[] = [];
    let duplicatesMergedCount = 0;

    for (const job of collectedCirculars) {
      const isKnownId = existingIds.has(job.id);
      const isKnownFp = job.fingerprintHash ? existingFingerprints.has(job.fingerprintHash) : false;

      if (!isKnownId && !isKnownFp) {
        newlyDiscoveredJobs.push(job);
        existingIds.add(job.id);
        if (job.fingerprintHash) existingFingerprints.add(job.fingerprintHash);
      } else {
        duplicatesMergedCount++;
      }
    }

    if (newlyDiscoveredJobs.length > 0) {
      await JobRepository.saveJobs(newlyDiscoveredJobs);
    }

    // Rebuild search index
    const allUnifiedJobs = await JobRepository.getAllJobs();
    await JobRepository.rebuildSearchIndex(allUnifiedJobs);

    const successfulSources = sourceBreakdowns.filter((s) => s.status === 'ACTIVE').length;
    const partialSources = sourceBreakdowns.filter((s) => s.status === 'PARTIAL').length;
    const failedSources = sourceBreakdowns.filter((s) => s.status === 'FAILED').length;
    const blockedSources = sourceBreakdowns.filter((s) => s.status === 'BLOCKED').length;

    const totalPagesFetched = sourceBreakdowns.reduce((acc, s) => acc + s.pagesSuccessful, 0);
    const totalRawNoticesScanned = sourceBreakdowns.reduce((acc, s) => acc + s.rawNoticesFound, 0);
    const totalAdministrativeRejected = sourceBreakdowns.reduce((acc, s) => acc + s.rejectedAdministrativeNotices, 0);

    const errors = sourceBreakdowns
      .filter((s) => s.error)
      .map((s) => ({ sourceId: s.sourceId, errorMessage: s.error || '' }));

    return {
      runId,
      startedAt,
      completedAt: Date.now(),
      totalSourcesAttempted: targetSources.length,
      successfulSources,
      partialSources,
      failedSources,
      blockedSources,
      totalPagesFetched,
      totalRawNoticesScanned,
      totalValidCirculars: collectedCirculars.length,
      totalNewSaved: newlyDiscoveredJobs.length,
      totalDuplicatesMerged: duplicatesMergedCount,
      totalAdministrativeRejected,
      sourceBreakdown: sourceBreakdowns,
      sourcesAttempted: targetSources.length,
      sourcesSucceeded: successfulSources,
      sourcesFailed: failedSources,
      totalNoticesScanned: totalRawNoticesScanned,
      primaryCircularsDiscovered: collectedCirculars.length,
      savedToDatabaseCount: newlyDiscoveredJobs.length,
      administrativeNoticesRejected: totalAdministrativeRejected,
      errors,
    };
  }
}
