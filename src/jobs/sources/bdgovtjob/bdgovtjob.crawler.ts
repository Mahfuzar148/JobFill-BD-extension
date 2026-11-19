// JobFill BD - BD Govt Job Resumable Crawler Engine
// Implements Two-Tier Crawl Architecture:
// Tier 1: Fast Catalog Indexing across dynamic pagination of /category/all-jobs/
// Tier 2: Deep Extraction for active/bundled/BPSC circulars
// Resumable checkpoint persistence (jobfill_bdgovtjob_crawl_checkpoint_v1)
// Polite rate limiting (1.2s delay).

import {
  BdGovtJobCrawlCheckpoint,
  BdGovtJobCrawlOptions,
} from './bdgovtjob.types';
import { RawSourceJobItem } from '../../types/source.types';
import { safePublicGet } from '../../services/job-fetcher';
import {
  BDGOVTJOB_ALL_JOBS_URL,
  BDGOVTJOB_BPSC_URL,
  parseBdGovtJobCard,
  discoverPagination,
  cardDataToRawItem,
  discoverArticleMetadata,
  extractMultipleCirculars,
  detectConflicts,
  verifyOfficialSource,
} from './bdgovtjob.parser';

export const BDGOVTJOB_CHECKPOINT_KEY = 'jobfill_bdgovtjob_crawl_checkpoint_v1';
export const DEFAULT_CRAWL_DELAY_MS = 1200;

let memoryCheckpointFallback: BdGovtJobCrawlCheckpoint | null = null;

export function createDefaultCheckpoint(mode: BdGovtJobCrawlCheckpoint['crawlMode'] = 'ALL_JOBS'): BdGovtJobCrawlCheckpoint {
  return {
    status: 'IDLE',
    crawlMode: mode,
    currentPage: 1,
    totalPagesDiscovered: 1,
    discoveredArticleUrls: [],
    processedArticleUrls: [],
    failedUrls: [],
    startedAt: Date.now(),
    lastUpdated: Date.now(),
    importedJobsCount: 0,
  };
}

export async function loadCheckpoint(): Promise<BdGovtJobCrawlCheckpoint> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get([BDGOVTJOB_CHECKPOINT_KEY], (res) => {
        if (res && res[BDGOVTJOB_CHECKPOINT_KEY]) {
          resolve(res[BDGOVTJOB_CHECKPOINT_KEY]);
        } else {
          resolve(memoryCheckpointFallback || createDefaultCheckpoint());
        }
      });
    });
  }

  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(BDGOVTJOB_CHECKPOINT_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {}
    }
  }

  return memoryCheckpointFallback || createDefaultCheckpoint();
}

export async function saveCheckpoint(cp: BdGovtJobCrawlCheckpoint): Promise<void> {
  cp.lastUpdated = Date.now();
  memoryCheckpointFallback = { ...cp };

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    await new Promise<void>((resolve) => {
      chrome.storage.local.set({ [BDGOVTJOB_CHECKPOINT_KEY]: cp }, () => resolve());
    });
  }

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(BDGOVTJOB_CHECKPOINT_KEY, JSON.stringify(cp));
    } catch {}
  }
}

export async function resetCheckpoint(): Promise<void> {
  memoryCheckpointFallback = null;
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    await new Promise<void>((resolve) => {
      chrome.storage.local.remove([BDGOVTJOB_CHECKPOINT_KEY], () => resolve());
    });
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(BDGOVTJOB_CHECKPOINT_KEY);
  }
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Checks if a circular card corresponds to a bundled multi-notice article (e.g. DC Office, Police).
 */
export function isBundledCircularCard(title: string, deadlinesCount: number): boolean {
  if (deadlinesCount > 1) return true;
  return /সকল\s*জেলা|জেলা\s*প্রশাসক|dc\s*office|পুলিশ|police|বিপিএসসি|bpsc/i.test(title);
}

export interface CrawlResult {
  items: RawSourceJobItem[];
  checkpoint: BdGovtJobCrawlCheckpoint;
  pagesCrawled: number;
  hasMore: boolean;
}

export class BdGovtJobCrawler {
  private isPaused: boolean = false;

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    this.isPaused = false;
  }

  /**
   * Crawls bdgovtjob.net All Jobs dynamic catalog using the Two-Tier architecture.
   */
  public async crawl(options: BdGovtJobCrawlOptions = {}): Promise<CrawlResult> {
    let checkpoint = options.forceRestart ? createDefaultCheckpoint(options.mode || 'ALL_JOBS') : await loadCheckpoint();

    if (options.mode) {
      checkpoint.crawlMode = options.mode;
    }

    if (this.isPaused || options.signal?.aborted) {
      checkpoint.status = 'PAUSED';
      await saveCheckpoint(checkpoint);
      return {
        items: [],
        checkpoint,
        pagesCrawled: 0,
        hasMore: checkpoint.currentPage <= checkpoint.totalPagesDiscovered,
      };
    }

    const rateLimit = options.rateLimitMs !== undefined ? options.rateLimitMs : DEFAULT_CRAWL_DELAY_MS;

    // Incremental Mode: ALWAYS checks Page 1 and discoveries without corrupting or advancing checkpoint.currentPage
    if (options.mode === 'INCREMENTAL') {
      const pageUrl = BDGOVTJOB_ALL_JOBS_URL;
      const res = await safePublicGet(pageUrl, 'text/html,*/*', options.signal);
      if (!res.ok) {
        return { items: [], checkpoint, pagesCrawled: 0, hasMore: false };
      }

      const pagInfo = discoverPagination(res.body, pageUrl);
      if (pagInfo.totalPages > checkpoint.totalPagesDiscovered) {
        checkpoint.totalPagesDiscovered = pagInfo.totalPages;
      }

      const cardMatches = Array.from(res.body.matchAll(/<article[^>]+class=["'][^"']*bdg-card[^"']*["'][\s\S]*?<\/article>/gi));
      const incItems: RawSourceJobItem[] = [];

      for (const cm of cardMatches) {
        const cardData = parseBdGovtJobCard(cm[0]);
        if (!cardData) continue;

        if (!checkpoint.discoveredArticleUrls.includes(cardData.canonicalUrl)) {
          checkpoint.discoveredArticleUrls.push(cardData.canonicalUrl);
        }

        const isBundled = isBundledCircularCard(cardData.title, cardData.deadlinesList.length);
        const shouldDeepExtract = options.deepExtraction || isBundled || /bpsc/i.test(cardData.title);

        if (shouldDeepExtract) {
          if (rateLimit > 0) await delay(Math.min(rateLimit, 500));
          const deepRes = await safePublicGet(cardData.canonicalUrl, 'text/html,*/*', options.signal);
          if (deepRes.ok) {
            const meta = discoverArticleMetadata(deepRes.body, cardData.canonicalUrl);
            const notices = extractMultipleCirculars(deepRes.body, meta, cardData.canonicalUrl);
            detectConflicts(notices, meta);

            if (notices.length > 0) {
              const isMultiNotice = notices.length > 1;
              if (isMultiNotice) {
                checkpoint.multiNoticeArticlesCount = (checkpoint.multiNoticeArticlesCount || 0) + 1;
              }
              for (const n of notices) {
                const verification = verifyOfficialSource(n);
                if (verification.status === 'OFFICIAL_VERIFIED') {
                  checkpoint.officialVerifiedCount = (checkpoint.officialVerifiedCount || 0) + 1;
                } else if (verification.status === 'SECONDARY_SOURCE_ONLY') {
                  checkpoint.secondaryOnlyCount = (checkpoint.secondaryOnlyCount || 0) + 1;
                }
                if (n.hasConflict) {
                  checkpoint.reviewRequiredCount = (checkpoint.reviewRequiredCount || 0) + 1;
                }
                if (n.circularDocumentUrl && n.circularDocumentUrl.endsWith('.pdf')) {
                  if (!checkpoint.pdfUrlsDiscovered) checkpoint.pdfUrlsDiscovered = [];
                  if (!checkpoint.pdfUrlsDiscovered.includes(n.circularDocumentUrl)) {
                    checkpoint.pdfUrlsDiscovered.push(n.circularDocumentUrl);
                  }
                }
                const extId = isMultiNotice
                  ? `bdgovtjob-post-${cardData.postId}-sec-${n.sectionIndex}`
                  : `bdgovtjob-post-${cardData.postId}`;
                const srcJobId = isMultiNotice
                  ? `bdgovtjob:post:${cardData.postId}:${n.sectionIndex}`
                  : `bdgovtjob:post:${cardData.postId}`;

                incItems.push({
                  externalId: extId,
                  sourceJobId: srcJobId,
                  organization: n.organization,
                  organizationBn: n.organizationBn,
                  jobTitle: n.jobTitle,
                  titleBn: n.titleBn,
                  position: n.postNames[0] || n.jobTitle,
                  circularNumber: n.memorandumNumber || undefined,
                  category: cardData.category as any,
                  employmentType: 'Full Time',
                  vacancies: n.vacancies ?? cardData.vacancies,
                  salary: n.salary || undefined,
                  qualification: n.qualification || undefined,
                  ageRequirement: n.ageRequirement || undefined,
                  experience: n.experience || undefined,
                  location: 'All Bangladesh',
                  deadlineText: n.deadlineText || undefined,
                  applicationStartText: n.applicationStartText || undefined,
                  publishedDateText: n.publishedDateText || cardData.publishedDateText,
                  circularUrl: n.circularDocumentUrl || cardData.canonicalUrl,
                  applicationUrl: n.applicationUrl,
                  organizationUrl: n.officialSourceUrl || undefined,
                  sourceUrl: cardData.canonicalUrl,
                  secondarySourceUrl: cardData.canonicalUrl,
                  officialSourceUrl: verification.officialSourceUrl,
                  circularDocumentUrl: n.circularDocumentUrl,
                  circularImages: n.circularImages,
                  verificationStatus: verification.status,
                  lastVerifiedAt: verification.lastVerifiedAt,
                  hasConflict: n.hasConflict,
                  conflictNotes: n.conflictNotes,
                  recruitmentType: n.recruitmentType,
                  memorandumNumber: n.memorandumNumber || undefined,
                  applicationStartTime: n.applicationStartTime || undefined,
                  applicationDeadlineTime: n.applicationDeadlineTime || undefined,
                  description: `${n.jobTitle}। মোট শূন্যপদ: ${n.vacancies ?? 'উল্লেখ নেই'}টি। মাধ্যমিক উৎস: bdgovtjob.net।`,
                });
              }
              if (!checkpoint.processedArticleUrls.includes(cardData.canonicalUrl)) {
                checkpoint.processedArticleUrls.push(cardData.canonicalUrl);
              }
            } else {
              incItems.push(cardDataToRawItem(cardData));
              if (!checkpoint.processedArticleUrls.includes(cardData.canonicalUrl)) {
                checkpoint.processedArticleUrls.push(cardData.canonicalUrl);
              }
            }
          } else {
            incItems.push(cardDataToRawItem(cardData));
            if (!checkpoint.processedArticleUrls.includes(cardData.canonicalUrl)) {
              checkpoint.processedArticleUrls.push(cardData.canonicalUrl);
            }
          }
        } else {
          incItems.push(cardDataToRawItem(cardData));
          if (!checkpoint.processedArticleUrls.includes(cardData.canonicalUrl)) {
            checkpoint.processedArticleUrls.push(cardData.canonicalUrl);
          }
        }
      }

      checkpoint.importedJobsCount = (checkpoint.importedJobsCount || 0) + incItems.length;
      checkpoint.lastUpdated = Date.now();
      await saveCheckpoint(checkpoint);

      return {
        items: incItems,
        checkpoint,
        pagesCrawled: 1,
        hasMore: false,
      };
    }

    checkpoint.status = 'CRAWLING';
    await saveCheckpoint(checkpoint);

    const maxPages = options.maxPages || Infinity;
    const extractedItems: RawSourceJobItem[] = [];
    let pagesCrawledThisRun = 0;

    while (
      checkpoint.currentPage <= checkpoint.totalPagesDiscovered &&
      pagesCrawledThisRun < maxPages &&
      !this.isPaused &&
      !options.signal?.aborted
    ) {
      const pageUrl =
        checkpoint.currentPage === 1
          ? BDGOVTJOB_ALL_JOBS_URL
          : `https://bdgovtjob.net/category/all-jobs/page/${checkpoint.currentPage}/`;

      const res = await safePublicGet(pageUrl, 'text/html,*/*', options.signal);

      if (!res.ok) {
        checkpoint.failedUrls.push({
          url: pageUrl,
          error: res.blockedReason || `HTTP ${res.status || 'error'}`,
          retries: 1,
        });
        checkpoint.status = 'FAILED';
        await saveCheckpoint(checkpoint);
        break;
      }

      // 1. Dynamic pagination discovery
      const pagInfo = discoverPagination(res.body, pageUrl);
      if (pagInfo.totalPages > checkpoint.totalPagesDiscovered) {
        checkpoint.totalPagesDiscovered = pagInfo.totalPages;
      }

      // 2. Tier 1: Parse all visible card articles on this pagination page
      const cardMatches = Array.from(res.body.matchAll(/<article[^>]+class=["'][^"']*bdg-card[^"']*["'][\s\S]*?<\/article>/gi));
      const pageItems: RawSourceJobItem[] = [];

      for (const cm of cardMatches) {
        const cardData = parseBdGovtJobCard(cm[0]);
        if (!cardData) continue;

        if (!checkpoint.discoveredArticleUrls.includes(cardData.canonicalUrl)) {
          checkpoint.discoveredArticleUrls.push(cardData.canonicalUrl);
        }

        const isBundled = isBundledCircularCard(cardData.title, cardData.deadlinesList.length);
        const shouldDeepExtract = options.deepExtraction || isBundled || /bpsc/i.test(cardData.title);

        if (shouldDeepExtract && !checkpoint.processedArticleUrls.includes(cardData.canonicalUrl)) {
          // Tier 2: Deep extraction for active/bundled circulars
          if (rateLimit > 0) await delay(Math.min(rateLimit, 500));
          const deepRes = await safePublicGet(cardData.canonicalUrl, 'text/html,*/*', options.signal);
          if (deepRes.ok) {
            const meta = discoverArticleMetadata(deepRes.body, cardData.canonicalUrl);
            const notices = extractMultipleCirculars(deepRes.body, meta, cardData.canonicalUrl);
            detectConflicts(notices, meta);

            if (notices.length > 0) {
              const isMultiNotice = notices.length > 1;
              if (isMultiNotice) {
                checkpoint.multiNoticeArticlesCount = (checkpoint.multiNoticeArticlesCount || 0) + 1;
              }
              for (const n of notices) {
                const verification = verifyOfficialSource(n);
                if (verification.status === 'OFFICIAL_VERIFIED') {
                  checkpoint.officialVerifiedCount = (checkpoint.officialVerifiedCount || 0) + 1;
                } else if (verification.status === 'SECONDARY_SOURCE_ONLY') {
                  checkpoint.secondaryOnlyCount = (checkpoint.secondaryOnlyCount || 0) + 1;
                }
                if (n.hasConflict) {
                  checkpoint.reviewRequiredCount = (checkpoint.reviewRequiredCount || 0) + 1;
                }
                if (n.circularDocumentUrl && n.circularDocumentUrl.endsWith('.pdf')) {
                  if (!checkpoint.pdfUrlsDiscovered) checkpoint.pdfUrlsDiscovered = [];
                  if (!checkpoint.pdfUrlsDiscovered.includes(n.circularDocumentUrl)) {
                    checkpoint.pdfUrlsDiscovered.push(n.circularDocumentUrl);
                  }
                }
                const extId = isMultiNotice
                  ? `bdgovtjob-post-${cardData.postId}-sec-${n.sectionIndex}`
                  : `bdgovtjob-post-${cardData.postId}`;
                const srcJobId = isMultiNotice
                  ? `bdgovtjob:post:${cardData.postId}:${n.sectionIndex}`
                  : `bdgovtjob:post:${cardData.postId}`;

                const item: RawSourceJobItem = {
                  externalId: extId,
                  sourceJobId: srcJobId,
                  organization: n.organization,
                  organizationBn: n.organizationBn,
                  jobTitle: n.jobTitle,
                  titleBn: n.titleBn,
                  position: n.postNames[0] || n.jobTitle,
                  circularNumber: n.memorandumNumber || undefined,
                  category: cardData.category as any,
                  employmentType: 'Full Time',
                  vacancies: n.vacancies ?? cardData.vacancies,
                  salary: n.salary || undefined,
                  qualification: n.qualification || undefined,
                  ageRequirement: n.ageRequirement || undefined,
                  experience: n.experience || undefined,
                  location: 'All Bangladesh',
                  deadlineText: n.deadlineText || undefined,
                  applicationStartText: n.applicationStartText || undefined,
                  publishedDateText: n.publishedDateText || cardData.publishedDateText,
                  circularUrl: n.circularDocumentUrl || cardData.canonicalUrl,
                  applicationUrl: n.applicationUrl,
                  organizationUrl: n.officialSourceUrl || undefined,
                  sourceUrl: cardData.canonicalUrl,
                  secondarySourceUrl: cardData.canonicalUrl,
                  officialSourceUrl: verification.officialSourceUrl,
                  circularDocumentUrl: n.circularDocumentUrl,
                  circularImages: n.circularImages,
                  verificationStatus: verification.status,
                  lastVerifiedAt: verification.lastVerifiedAt,
                  hasConflict: n.hasConflict,
                  conflictNotes: n.conflictNotes,
                  recruitmentType: n.recruitmentType,
                  memorandumNumber: n.memorandumNumber || undefined,
                  applicationStartTime: n.applicationStartTime || undefined,
                  applicationDeadlineTime: n.applicationDeadlineTime || undefined,
                  description: `${n.jobTitle}। মোট শূন্যপদ: ${n.vacancies ?? 'উল্লেখ নেই'}টি। মাধ্যমিক উৎস: bdgovtjob.net।`,
                };
                extractedItems.push(item);
                pageItems.push(item);
              }
              checkpoint.processedArticleUrls.push(cardData.canonicalUrl);
            } else {
              const rawCard = cardDataToRawItem(cardData);
              extractedItems.push(rawCard);
              pageItems.push(rawCard);
              checkpoint.processedArticleUrls.push(cardData.canonicalUrl);
            }
          } else {
            // Fallback to Tier 1 card data
            const rawCard = cardDataToRawItem(cardData);
            extractedItems.push(rawCard);
            pageItems.push(rawCard);
            checkpoint.processedArticleUrls.push(cardData.canonicalUrl);
          }
        } else {
          // Tier 1 Fast Catalog indexing
          const rawCard = cardDataToRawItem(cardData);
          extractedItems.push(rawCard);
          pageItems.push(rawCard);
          if (!checkpoint.processedArticleUrls.includes(cardData.canonicalUrl)) {
            checkpoint.processedArticleUrls.push(cardData.canonicalUrl);
          }
        }
      }

      pagesCrawledThisRun += 1;
      checkpoint.currentPage += 1;
      checkpoint.importedJobsCount = (checkpoint.importedJobsCount || 0) + pageItems.length;
      await saveCheckpoint(checkpoint);

      if (checkpoint.currentPage <= checkpoint.totalPagesDiscovered && !this.isPaused && !options.signal?.aborted) {
        if (rateLimit > 0) {
          await delay(rateLimit);
        }
      }
    }

    if (this.isPaused || options.signal?.aborted) {
      checkpoint.status = 'PAUSED';
    } else if (checkpoint.currentPage > checkpoint.totalPagesDiscovered) {
      checkpoint.status = 'COMPLETED';
    }
    await saveCheckpoint(checkpoint);

    return {
      items: extractedItems,
      checkpoint,
      pagesCrawled: pagesCrawledThisRun,
      hasMore: checkpoint.currentPage <= checkpoint.totalPagesDiscovered && checkpoint.status !== 'COMPLETED',
    };
  }

  /**
   * Retries all recorded failed page and article URLs in checkpoint.
   */
  public async retryFailed(options: BdGovtJobCrawlOptions = {}): Promise<CrawlResult> {
    const checkpoint = await loadCheckpoint();
    if (checkpoint.failedUrls.length === 0) {
      return {
        items: [],
        checkpoint,
        pagesCrawled: 0,
        hasMore: checkpoint.currentPage <= checkpoint.totalPagesDiscovered,
      };
    }

    const rateLimit = options.rateLimitMs !== undefined ? options.rateLimitMs : DEFAULT_CRAWL_DELAY_MS;
    const remainingFailed: typeof checkpoint.failedUrls = [];
    const extractedItems: RawSourceJobItem[] = [];
    let pagesCrawled = 0;

    for (const failedItem of checkpoint.failedUrls) {
      if (this.isPaused || options.signal?.aborted) {
        remainingFailed.push(failedItem);
        continue;
      }

      if (rateLimit > 0) await delay(rateLimit);
      const res = await safePublicGet(failedItem.url, 'text/html,*/*', options.signal);

      if (!res.ok) {
        remainingFailed.push({
          url: failedItem.url,
          error: res.blockedReason || `HTTP ${res.status || 'error'}`,
          retries: failedItem.retries + 1,
        });
        continue;
      }

      // Check if URL is a pagination page or an individual article
      if (failedItem.url.includes('/category/all-jobs')) {
        pagesCrawled++;
        const cardMatches = Array.from(res.body.matchAll(/<article[^>]+class=["'][^"']*bdg-card[^"']*["'][\s\S]*?<\/article>/gi));
        for (const cm of cardMatches) {
          const cardData = parseBdGovtJobCard(cm[0]);
          if (!cardData) continue;
          if (!checkpoint.discoveredArticleUrls.includes(cardData.canonicalUrl)) {
            checkpoint.discoveredArticleUrls.push(cardData.canonicalUrl);
          }
          extractedItems.push(cardDataToRawItem(cardData));
        }
      } else {
        // Individual article retry
        const meta = discoverArticleMetadata(res.body, failedItem.url);
        const notices = extractMultipleCirculars(res.body, meta, failedItem.url);
        if (notices.length > 0) {
          const isMultiNotice = notices.length > 1;
          for (const n of notices) {
            const verification = verifyOfficialSource(n);
            extractedItems.push({
              externalId: isMultiNotice ? `bdgovtjob-retry-${n.sectionIndex}` : `bdgovtjob-retry-1`,
              sourceJobId: isMultiNotice ? `bdgovtjob:retry:${n.sectionIndex}` : `bdgovtjob:retry:1`,
              organization: n.organization,
              organizationBn: n.organizationBn,
              jobTitle: n.jobTitle,
              titleBn: n.titleBn,
              position: n.postNames[0] || n.jobTitle,
              circularNumber: n.memorandumNumber || undefined,
              category: 'Government',
              employmentType: 'Full Time',
              vacancies: n.vacancies,
              salary: n.salary || undefined,
              qualification: n.qualification || undefined,
              location: 'All Bangladesh',
              deadlineText: n.deadlineText || undefined,
              circularUrl: n.circularDocumentUrl || failedItem.url,
              applicationUrl: n.applicationUrl,
              officialSourceUrl: verification.officialSourceUrl,
              sourceUrl: failedItem.url,
              secondarySourceUrl: failedItem.url,
              verificationStatus: verification.status,
              lastVerifiedAt: Date.now(),
              hasConflict: n.hasConflict,
              conflictNotes: n.conflictNotes,
              description: `${n.jobTitle}। মাধ্যমিক উৎস: bdgovtjob.net।`,
            });
          }
          checkpoint.processedArticleUrls.push(failedItem.url);
        }
      }
    }

    checkpoint.failedUrls = remainingFailed;
    checkpoint.importedJobsCount = (checkpoint.importedJobsCount || 0) + extractedItems.length;
    if (checkpoint.failedUrls.length === 0 && checkpoint.status === 'FAILED') {
      checkpoint.status = checkpoint.currentPage > checkpoint.totalPagesDiscovered ? 'COMPLETED' : 'PAUSED';
    }
    checkpoint.lastUpdated = Date.now();
    await saveCheckpoint(checkpoint);

    return {
      items: extractedItems,
      checkpoint,
      pagesCrawled,
      hasMore: checkpoint.currentPage <= checkpoint.totalPagesDiscovered,
    };
  }

  /**
   * Crawls dedicated BPSC entrypoint.
   */
  public async crawlBpsc(signal?: AbortSignal): Promise<RawSourceJobItem[]> {
    const res = await safePublicGet(BDGOVTJOB_BPSC_URL, 'text/html,*/*', signal);
    if (!res.ok) return [];

    const meta = discoverArticleMetadata(res.body, BDGOVTJOB_BPSC_URL);
    const notices = extractMultipleCirculars(res.body, meta, BDGOVTJOB_BPSC_URL);
    detectConflicts(notices, meta);

    const items: RawSourceJobItem[] = [];
    for (const notice of notices) {
      const verification = verifyOfficialSource(notice);
      const stableKey = notice.memorandumNumber
        ? notice.memorandumNumber.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 24)
        : `sec_${notice.sectionIndex}`;

      items.push({
        externalId: `bdgovtjob-bpsc-${stableKey}`,
        sourceJobId: `bdgovtjob:bpsc:${stableKey}`,
        organization: notice.organization,
        organizationBn: notice.organizationBn,
        organizationShortName: 'BPSC',
        jobTitle: notice.jobTitle,
        titleBn: notice.titleBn,
        position: notice.postNames[0] || notice.jobTitle,
        circularNumber: notice.memorandumNumber || undefined,
        category: 'Government',
        employmentType: 'Full Time',
        vacancies: notice.vacancies,
        salary: notice.salary || undefined,
        cadreStatus: notice.recruitmentType.includes('BCS') ? 'Cadre' : 'Non-Cadre',
        qualification: notice.qualification || 'Bachelor',
        ageRequirement: notice.ageRequirement || undefined,
        experience: notice.experience || undefined,
        location: 'All Bangladesh',
        deadlineText: notice.deadlineText || undefined,
        applicationStartText: notice.applicationStartText || undefined,
        publishedDateText: notice.publishedDateText || undefined,
        circularUrl: notice.circularDocumentUrl || BDGOVTJOB_BPSC_URL,
        applicationUrl: notice.applicationUrl,
        organizationUrl: notice.officialSourceUrl || undefined,
        sourceUrl: BDGOVTJOB_BPSC_URL,
        secondarySourceUrl: BDGOVTJOB_BPSC_URL,
        officialSourceUrl: verification.officialSourceUrl,
        circularDocumentUrl: notice.circularDocumentUrl,
        circularImages: notice.circularImages,
        verificationStatus: verification.status,
        lastVerifiedAt: verification.lastVerifiedAt,
        hasConflict: notice.hasConflict,
        conflictNotes: notice.conflictNotes,
        recruitmentType: notice.recruitmentType,
        memorandumNumber: notice.memorandumNumber || undefined,
        applicationStartTime: notice.applicationStartTime || undefined,
        applicationDeadlineTime: notice.applicationDeadlineTime || undefined,
        description: `${notice.jobTitle}. মোট শূন্যপদ: ${notice.vacancies ?? 'উল্লেখ নেই'}টি। মাধ্যমিক উৎস: bdgovtjob.net।`,
      });
    }

    return items;
  }

  /**
   * Performs lightweight incremental synchronization: checks Page 1 and BPSC article only.
   */
  public async syncIncremental(signal?: AbortSignal, rateLimitMs: number = 0): Promise<RawSourceJobItem[]> {
    const cp = await loadCheckpoint();
    const result = await this.crawl({
      mode: 'INCREMENTAL',
      maxPages: 1,
      deepExtraction: true,
      rateLimitMs,
      signal,
    });

    const bpscItems = await this.crawlBpsc(signal);

    // Merge without duplicate URLs
    const existingUrls = new Set(result.items.map((i) => i.secondarySourceUrl || i.sourceUrl));
    for (const bi of bpscItems) {
      if (!existingUrls.has(bi.sourceJobId)) {
        result.items.push(bi);
      }
    }

    return result.items;
  }
}

export const bdGovtJobCrawler = new BdGovtJobCrawler();
