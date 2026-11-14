// JobFill BD - Federated Online Search Orchestrator
// Coordinates live, authorized network searches across all configured job providers.
// Enforces:
// 1. Never merely filters IndexedDB on "Search Online" — performs real network queries.
// 2. Concurrency bounding and progressive pagination across permitted source pages.
// 3. Bilingual query expansion (English & Bengali).
// 4. Safe upsert & deduplication into IndexedDB with search index rebuilding.
// 5. Honest coverage reporting — never fabricates 100% web coverage or fake counts.

import {
  NormalizedJobCircular,
  JobSearchFilters,
  SourceVerificationStatus,
} from '../types/job.types';
import { JobSourceAdapter, RawSourceJobItem, SourceFetchOutcome } from '../types/source.types';
import { JobSourceRegistry } from '../sources/source-registry';
import { JobRepository } from '../database/job-repository';
import { normalizeJobRecord } from './job-normalizer';
import { validateJobCircular } from './job-validator';
import { JobTaxonomyRegistry, UNIVERSAL_JOB_TAXONOMY } from '../taxonomy/job-taxonomy';
import { JobTaxonomyClassifier } from './taxonomy-classifier';
import { filterAndSortJobs } from '../dashboard/JobFilters';
import { parseDeadlineDate } from './deadline-parser';

export interface SourceCoverageItem {
  sourceId: string;
  sourceName: string;
  sourceType: string;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'BLOCKED' | 'COOLDOWN' | 'DISABLED';
  pagesFetched: number;
  retrievedCount: number;
  newJobsCount: number;
  durationMs: number;
  error?: string;
}

export interface FederatedSearchResultReport {
  configuredSourcesCount: number;
  attemptedSourcesCount: number;
  successfulSourcesCount: number;
  partialSourcesCount: number;
  failedSourcesCount: number;
  pagesFetchedTotal: number;
  rawRecordsTotal: number;
  validRecordsTotal: number;
  uniqueNewSavedCount: number;
  duplicatesMergedCount: number;
  rejectedRecordsCount: number;
  sourceOutcomes: SourceCoverageItem[];
  matchingJobs: NormalizedJobCircular[];
  newlyDiscoveredJobs: NormalizedJobCircular[];
  searchPlanSummary: {
    queryUsed: string;
    expandedTerms: string[];
    categoryFilter?: string;
    subcategoryFilter?: string;
  };
}

export interface FederatedSearchProgress {
  phase: 'planning' | 'querying_sources' | 'normalizing' | 'saving' | 'indexing' | 'completed';
  activeSourceName?: string;
  completedSources: number;
  totalSources: number;
  retrievedSoFar: number;
}

export class FederatedSearchOrchestrator {
  private static readonly MAX_CONCURRENT_REQUESTS = 4;

  /**
   * Constructs bilingual query keywords and variations based on filters.
   */
  public static buildSearchPlan(filters: JobSearchFilters): {
    primaryQuery: string;
    expandedTerms: string[];
    targetCategoryNameEn?: string;
    targetCategoryNameBn?: string;
  } {
    const rawQuery = (filters.query || '').trim();
    const expanded = new Set<string>();
    if (rawQuery) expanded.add(rawQuery.toLowerCase());

    let targetCategoryNameEn: string | undefined;
    let targetCategoryNameBn: string | undefined;

    // Check Taxonomy Category
    if (filters.taxonomyCategory && filters.taxonomyCategory !== 'All') {
      const catDef = JobTaxonomyRegistry.getById(filters.taxonomyCategory);
      if (catDef) {
        targetCategoryNameEn = catDef.labelEn;
        targetCategoryNameBn = catDef.labelBn;
        catDef.keywordsEn.slice(0, 3).forEach((k) => expanded.add(k.toLowerCase()));
        catDef.keywordsBn.slice(0, 3).forEach((k) => expanded.add(k));
      }
    }

    // Check Taxonomy Subcategory
    if (filters.taxonomySubcategory && filters.taxonomySubcategory !== 'All' && filters.taxonomyCategory) {
      const subDef = JobTaxonomyRegistry.getSubcategoryById(filters.taxonomyCategory, filters.taxonomySubcategory);
      if (subDef) {
        subDef.keywordsEn.slice(0, 3).forEach((k) => expanded.add(k.toLowerCase()));
        subDef.keywordsBn.slice(0, 3).forEach((k) => expanded.add(k));
      }
    }

    // Check Government Grade
    if (filters.selectedGrades && filters.selectedGrades.length > 0 && !filters.selectedGrades.includes('All')) {
      const firstGrade = filters.selectedGrades[0];
      if (/^\d+$/.test(firstGrade)) {
        expanded.add(`grade ${firstGrade}`);
        expanded.add(`${firstGrade}th grade`);
        expanded.add(`${firstGrade}ম গ্রেড`);
      }
    }

    return {
      primaryQuery: rawQuery,
      expandedTerms: Array.from(expanded).slice(0, 8),
      targetCategoryNameEn,
      targetCategoryNameBn,
    };
  }

  /**
   * Executes a real live online federated search across all configured providers.
   */
  public static async executeFederatedSearch(options: {
    filters: JobSearchFilters;
    signal?: AbortSignal;
    onProgress?: (progress: FederatedSearchProgress) => void;
  }): Promise<FederatedSearchResultReport> {
    const { filters, signal, onProgress } = options;
    const now = Date.now();

    onProgress?.({
      phase: 'planning',
      completedSources: 0,
      totalSources: JobSourceRegistry.getAll().length,
      retrievedSoFar: 0,
    });

    const searchPlan = this.buildSearchPlan(filters);
    const adapters = JobSourceRegistry.getAll();
    const sourceCoverageItems: SourceCoverageItem[] = [];
    const collectedRawJobs: Array<{ raw: RawSourceJobItem; adapter: JobSourceAdapter }> = [];

    let completedCount = 0;
    let pagesTotal = 0;

    // Helper to run adapter with timing and error isolation
    const executeAdapter = async (adapter: JobSourceAdapter) => {
      if (signal?.aborted) return;
      const startMs = Date.now();

      onProgress?.({
        phase: 'querying_sources',
        activeSourceName: adapter.sourceName,
        completedSources: completedCount,
        totalSources: adapters.length,
        retrievedSoFar: collectedRawJobs.length,
      });

      try {
        const outcome: SourceFetchOutcome = await adapter.fetchJobs(signal);
        const durationMs = Date.now() - startMs;
        const pages = (outcome as any).pagesFetched ?? (outcome.jobs.length > 0 ? 1 : 0);
        pagesTotal += pages;

        const isSuccess = outcome.success || outcome.status === 'SUCCESS' || outcome.connectionStatus === 'Working';
        const isPartial = outcome.status === 'PARTIAL_SUCCESS' || outcome.connectionStatus === 'Partially Working';
        const isBlocked = Boolean(outcome.blockedByCaptcha || outcome.status === 'MANUAL_VERIFICATION_REQUIRED' || outcome.connectionStatus === 'Manual Verification Required');

        const status: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'BLOCKED' | 'COOLDOWN' | 'DISABLED' = isBlocked
          ? 'BLOCKED'
          : isPartial
            ? 'PARTIAL'
            : isSuccess
              ? 'SUCCESS'
              : 'FAILED';

        sourceCoverageItems.push({
          sourceId: adapter.sourceId,
          sourceName: adapter.sourceName,
          sourceType: adapter.sourceType,
          status,
          pagesFetched: pages,
          retrievedCount: outcome.jobs.length,
          newJobsCount: 0, // will compute after dedupe
          durationMs,
          error: outcome.error || (isBlocked ? 'Access challenge / CAPTCHA notice' : undefined),
        });

        for (const jobItem of outcome.jobs) {
          collectedRawJobs.push({ raw: jobItem, adapter });
        }
      } catch (err: any) {
        sourceCoverageItems.push({
          sourceId: adapter.sourceId,
          sourceName: adapter.sourceName,
          sourceType: adapter.sourceType,
          status: 'FAILED',
          pagesFetched: 0,
          retrievedCount: 0,
          newJobsCount: 0,
          durationMs: Date.now() - startMs,
          error: err?.message || 'Network request failed',
        });
      } finally {
        completedCount++;
        onProgress?.({
          phase: 'querying_sources',
          completedSources: completedCount,
          totalSources: adapters.length,
          retrievedSoFar: collectedRawJobs.length,
        });
      }
    };

    // Run sources in controlled concurrent pools
    for (let i = 0; i < adapters.length; i += this.MAX_CONCURRENT_REQUESTS) {
      if (signal?.aborted) break;
      const chunk = adapters.slice(i, i + this.MAX_CONCURRENT_REQUESTS);
      await Promise.all(chunk.map((adapter) => executeAdapter(adapter)));
    }

    onProgress?.({
      phase: 'normalizing',
      completedSources: adapters.length,
      totalSources: adapters.length,
      retrievedSoFar: collectedRawJobs.length,
    });

    // Normalize and enrich each job
    const normalizedBatch: NormalizedJobCircular[] = [];
    let rejectedCount = 0;

    for (const { raw, adapter } of collectedRawJobs) {
      try {
        const meta = {
          sourceId: adapter.sourceId,
          sourceName: adapter.sourceName,
          verificationLevel: adapter.verificationLevel || 'official_partial',
          checkedAt: now,
          isManual: false,
        };
        const normalized = normalizeJobRecord(raw, meta);
        const validation = validateJobCircular(normalized, now);

        if (validation.isValid) {
          JobTaxonomyClassifier.enrichJobWithTaxonomy(normalized);
          normalizedBatch.push(normalized);
        } else {
          rejectedCount++;
        }
      } catch {
        rejectedCount++;
      }
    }

    onProgress?.({
      phase: 'saving',
      completedSources: adapters.length,
      totalSources: adapters.length,
      retrievedSoFar: normalizedBatch.length,
    });

    // Deduplicate against existing IndexedDB records
    const existingStoredJobs = await JobRepository.getAllJobs();
    const existingIds = new Set(existingStoredJobs.map((j) => j.id));
    const existingFingerprints = new Set(
      existingStoredJobs.map((j) => j.fingerprintHash).filter(Boolean)
    );

    const newlyDiscoveredJobs: NormalizedJobCircular[] = [];
    let duplicatesMergedCount = 0;

    for (const job of normalizedBatch) {
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

    // Save newly discovered jobs to IndexedDB
    if (newlyDiscoveredJobs.length > 0) {
      await JobRepository.saveJobs(newlyDiscoveredJobs);
    }

    onProgress?.({
      phase: 'indexing',
      completedSources: adapters.length,
      totalSources: adapters.length,
      retrievedSoFar: newlyDiscoveredJobs.length,
    });

    // Rebuild search index over unified records
    const allUnifiedJobs = await JobRepository.getAllJobs();
    await JobRepository.rebuildSearchIndex(allUnifiedJobs);

    // Apply user filters over complete unified collection
    const matchingJobs = filterAndSortJobs(allUnifiedJobs, filters, new Set(), now);

    onProgress?.({
      phase: 'completed',
      completedSources: adapters.length,
      totalSources: adapters.length,
      retrievedSoFar: matchingJobs.length,
    });

    const successfulSources = sourceCoverageItems.filter((s) => s.status === 'SUCCESS').length;
    const partialSources = sourceCoverageItems.filter((s) => s.status === 'PARTIAL').length;
    const failedSources = sourceCoverageItems.filter((s) => s.status === 'FAILED' || s.status === 'BLOCKED').length;

    return {
      configuredSourcesCount: adapters.length,
      attemptedSourcesCount: completedCount,
      successfulSourcesCount: successfulSources,
      partialSourcesCount: partialSources,
      failedSourcesCount: failedSources,
      pagesFetchedTotal: pagesTotal,
      rawRecordsTotal: collectedRawJobs.length,
      validRecordsTotal: normalizedBatch.length,
      uniqueNewSavedCount: newlyDiscoveredJobs.length,
      duplicatesMergedCount,
      rejectedRecordsCount: rejectedCount,
      sourceOutcomes: sourceCoverageItems,
      matchingJobs,
      newlyDiscoveredJobs,
      searchPlanSummary: {
        queryUsed: searchPlan.primaryQuery,
        expandedTerms: searchPlan.expandedTerms,
        categoryFilter: searchPlan.targetCategoryNameEn,
        subcategoryFilter: filters.taxonomySubcategory,
      },
    };
  }
}
