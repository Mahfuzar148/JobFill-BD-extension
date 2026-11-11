// JobFill BD - Google News RSS Discovery Adapter
// DISCOVERY SOURCE ONLY — NEVER treated as official verification.
// Uses pure-JS XML regex parsing (no DOMParser dependency in MV3 Service Worker).

import {
  JobSourceAdapter,
  RawSourceJobItem,
  SourceFetchOutcome,
} from '../types/source.types';
import { NormalizedJobCircular, JobCategory } from '../types/job.types';
import { safePublicGet } from '../services/job-fetcher';
import { normalizeJobRecord } from '../services/job-normalizer';
import { validateJobCircular } from '../services/job-validator';
import { extractTagText, stripHtmlTags } from './official-website.adapter';

interface DiscoveryFeedConfig {
  id: string;
  label: string;
  category: JobCategory;
  url: string;
}

export const GOOGLE_NEWS_DISCOVERY_FEEDS: DiscoveryFeedConfig[] = [
  {
    id: 'gnews_govt',
    label: 'Bangladesh Govt Jobs (Google News)',
    category: 'Government',
    url: 'https://news.google.com/rss/search?q=Bangladesh+government+job+circular&hl=en-BD&gl=BD&ceid=BD:en',
  },
  {
    id: 'gnews_bank',
    label: 'Bangladesh Bank & Financial Jobs (Google News)',
    category: 'Bank',
    url: 'https://news.google.com/rss/search?q=Bangladesh+bank+job+circular&hl=en-BD&gl=BD&ceid=BD:en',
  },
  {
    id: 'gnews_private_ngo',
    label: 'Bangladesh Private & NGO Jobs (Google News)',
    category: 'Private',
    url: 'https://news.google.com/rss/search?q=Bangladesh+private+OR+NGO+job+circular&hl=en-BD&gl=BD&ceid=BD:en',
  },
];

export function parseGoogleNewsRssXml(xml: string, category: JobCategory): RawSourceJobItem[] {
  const itemMatches = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || [];
  const parsed: RawSourceJobItem[] = [];

  for (const itemXml of itemMatches.slice(0, 15)) {
    const rawTitle = extractTagText(itemXml, 'title');
    const link = extractTagText(itemXml, 'link');
    const guid = extractTagText(itemXml, 'guid');
    const pubDate = extractTagText(itemXml, 'pubDate');
    const sourcePublisher = stripHtmlTags(extractTagText(itemXml, 'source'));

    if (!rawTitle || !link) continue;

    // Google News RSS titles typically end with " - Publisher Name"
    const dashIdx = rawTitle.lastIndexOf(' - ');
    const cleanTitle = dashIdx > 10 ? rawTitle.slice(0, dashIdx).trim() : rawTitle;
    const publisher = sourcePublisher || (dashIdx > 10 ? rawTitle.slice(dashIdx + 3).trim() : 'News Discovery');

    // Parse RFC 2822 RSS pubDate strictly (only publishedAt, NEVER invent deadline)
    const pubMs = Date.parse(pubDate);
    const publishedDateText = Number.isFinite(pubMs) ? new Date(pubMs).toISOString().slice(0, 10) : undefined;

    parsed.push({
      externalId: guid || link,
      organization: publisher,
      jobTitle: cleanTitle,
      position: cleanTitle,
      category,
      employmentType: 'Full Time',
      location: 'All Bangladesh',
      publishedDateText,
      // Discovery feeds NEVER provide verified official deadlines or direct application forms
      deadlineText: undefined,
      circularUrl: undefined,
      sourceUrl: link,
      applicationUrl: null,
      description: `Discovered via Google News RSS (${publisher}). Open source article or search official organization portal to apply.`,
    });
  }

  return parsed;
}

export const GoogleNewsDiscoveryAdapter: JobSourceAdapter = {
  sourceId: 'google_news_discovery',
  sourceName: 'Google News RSS (Discovery Only)',
  sourceType: 'discovery_rss',
  officialDomain: 'news.google.com',
  compatibilityStatus: 'partially_supported',
  accessMethodType: 'RSS',
  publisherType: 'Third-Party',
  accessMethod: 'Public Google News RSS XML feeds (discovery only, unverified)',
  verificationLevel: 'discovery_only',
  directSourceUrl: 'https://news.google.com/',
  notes:
    'Used strictly for discovering news articles about new circulars. Results are flagged "Discovery Only (Unverified)" and never invent deadlines.',

  async fetchJobs(signal?: AbortSignal): Promise<SourceFetchOutcome> {
    const checkedAt = Date.now();
    const results = await Promise.all(
      GOOGLE_NEWS_DISCOVERY_FEEDS.map(async (feed) => {
        const res = await safePublicGet(feed.url, 'application/rss+xml,application/xml,text/xml,*/*', signal);
        if (!res.ok) return { ok: false, error: res.blockedReason, items: [] as RawSourceJobItem[] };
        return { ok: true, items: parseGoogleNewsRssXml(res.body, feed.category) };
      })
    );

    const anyOk = results.some((r) => r.ok);
    if (!anyOk) {
      return {
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        compatibilityStatus: 'unavailable',
        success: false,
        jobs: [],
        checkedAt,
        accessNotes: results[0]?.error || 'Google News RSS feeds unavailable.',
        directPortalUrl: this.directSourceUrl,
        error: results[0]?.error,
      };
    }

    const rawItems = results.flatMap((r) => r.items);
    const jobs = rawItems.map((raw) => this.parseJob(raw, checkedAt)).filter((j) => this.validateJob(j).isValid);

    return {
      sourceId: this.sourceId,
      sourceName: this.sourceName,
      compatibilityStatus: 'partially_supported',
      success: true,
      jobs,
      checkedAt,
      accessNotes: `Discovered ${jobs.length} news item(s). Marked Discovery Only — confirm on official portal.`,
      directPortalUrl: this.directSourceUrl,
    };
  },

  parseJob(raw: RawSourceJobItem, checkedAt?: number): NormalizedJobCircular {
    return normalizeJobRecord(raw, {
      sourceId: this.sourceId,
      sourceName: this.sourceName,
      verificationLevel: 'discovery_only',
      checkedAt,
    });
  },

  validateJob(job: NormalizedJobCircular) {
    return validateJobCircular(job);
  },

  getApplicationUrl(rawOrJob) {
    return rawOrJob.applicationUrl || null;
  },

  getCircularUrl(rawOrJob) {
    return rawOrJob.circularUrl;
  },
};
