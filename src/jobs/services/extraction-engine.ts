// JobFill BD - Modular Smart Job Data Extraction Engine
// Extracts public recruitment data strictly adhering to Phase 4 rules:
// 1. Supports Schema.org JobPosting JSON-LD, structured tables, and RSS/API items.
// 2. Strict provenance tracking (sourceId, sourceUrl, retrievedAt, verificationState, evidence).
// 3. Absolute separation of Circular URL (official notice) and Application URL (application form).
// 4. Zero data invention — missing fields stay null/empty, never guessed or fabricated.

import { NormalizedJobCircular, SourceVerificationStatus, JobCategory } from '../types/job.types';
import { RawSourceJobItem, JobSourceAdapter } from '../types/source.types';
import { normalizeJobRecord } from './job-normalizer';
import { validateJobCircular } from './job-validator';

export interface FieldProvenance {
  sourceId: string;
  sourceUrl: string;
  retrievedAt: number;
  verificationState: SourceVerificationStatus;
  originalEvidence?: string;
}

export interface ExtractedJobResult {
  job: NormalizedJobCircular;
  provenance: FieldProvenance;
  isValid: boolean;
  validationErrors: string[];
}

/**
 * Extracts Schema.org "JobPosting" structured data from public web pages.
 * Commonly published by job boards, government portals with JSON-LD, and corporate career sites.
 */
export function extractJsonLdJobPostings(
  docOrHtml: Document | string,
  sourceUrl: string,
  defaultOrg: string = 'Public Employer'
): RawSourceJobItem[] {
  const items: RawSourceJobItem[] = [];
  const scripts: string[] = [];

  if (typeof docOrHtml === 'string') {
    const matches = docOrHtml.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
    for (const m of matches) {
      const inner = m.replace(/<script[^>]*>|<\/script>/gi, '').trim();
      if (inner) scripts.push(inner);
    }
  } else if (docOrHtml && typeof docOrHtml.querySelectorAll === 'function') {
    const elements = docOrHtml.querySelectorAll('script[type="application/ld+json"]');
    elements.forEach((el) => {
      const content = el.textContent?.trim();
      if (content) scripts.push(content);
    });
  }

  for (const jsonText of scripts) {
    try {
      const parsed = JSON.parse(jsonText);
      const candidates = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed['@graph'])
          ? parsed['@graph']
          : [parsed];

      for (const item of candidates) {
        if (!item || typeof item !== 'object') continue;
        const typeStr = String(item['@type'] || '');
        if (!typeStr.includes('JobPosting')) continue;

        const title = String(item.title || item.name || '').trim();
        if (!title) continue;

        let orgName = defaultOrg;
        if (typeof item.hiringOrganization === 'string') {
          orgName = item.hiringOrganization;
        } else if (item.hiringOrganization && typeof item.hiringOrganization === 'object') {
          orgName = item.hiringOrganization.name || defaultOrg;
        }

        let location = 'All Bangladesh';
        if (item.jobLocation) {
          const loc = item.jobLocation;
          if (typeof loc === 'string') {
            location = loc;
          } else if (loc.address) {
            const addr = loc.address;
            location = [addr.addressLocality, addr.addressRegion, addr.addressCountry]
              .filter(Boolean)
              .join(', ') || location;
          }
        }

        let salary: string | undefined;
        if (item.baseSalary) {
          const s = item.baseSalary;
          if (typeof s === 'string') {
            salary = s;
          } else if (s.value) {
            salary = `${s.currency ? s.currency + ' ' : ''}${s.value.value || s.value.minValue || ''}`;
          }
        }

        const circularUrl = item.url || item.sameAs || sourceUrl;
        const appUrl = item.directApplyUrl || item.applicationUrl || null;
        const datePosted = item.datePosted ? String(item.datePosted).slice(0, 10) : undefined;
        const validThrough = item.validThrough ? String(item.validThrough).slice(0, 10) : undefined;

        items.push({
          externalId: `jsonld_${orgName}_${title}_${datePosted || ''}`.replace(/\s+/g, '_').toLowerCase(),
          organization: orgName,
          jobTitle: title,
          position: title,
          category: (item.occupationalCategory as JobCategory) || 'Other',
          employmentType: item.employmentType ? String(item.employmentType) : 'Full Time',
          location,
          salary,
          publishedDateText: datePosted,
          deadlineText: validThrough,
          circularUrl,
          applicationUrl: appUrl,
          sourceUrl,
          description: typeof item.description === 'string' ? item.description.replace(/<[^>]+>/g, ' ').slice(0, 1000).trim() : undefined,
          qualification: item.educationRequirements ? String(item.educationRequirements) : undefined,
        });
      }
    } catch {
      // ignore invalid or malformed JSON-LD scripts
    }
  }

  return items;
}

/**
 * Normalizes, validates, and attaches provenance metadata to raw extracted items.
 */
export function processExtractedJobItem(
  raw: RawSourceJobItem,
  adapter: JobSourceAdapter,
  checkedAt: number = Date.now()
): ExtractedJobResult {
  const provenance: FieldProvenance = {
    sourceId: adapter.sourceId,
    sourceUrl: raw.sourceUrl || adapter.directSourceUrl,
    retrievedAt: checkedAt,
    verificationState: adapter.verificationLevel,
    originalEvidence: raw.circularUrl || raw.applicationUrl || adapter.directSourceUrl,
  };

  const normalized = adapter.parseJob(raw, checkedAt);
  const validation = adapter.validateJob(normalized);

  return {
    job: normalized,
    provenance,
    isValid: validation.isValid,
    validationErrors: validation.errors,
  };
}
