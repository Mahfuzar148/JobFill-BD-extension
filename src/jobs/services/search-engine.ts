// JobFill BD - Bilingual Indexed Search & Ranking Engine
// Supports English, Bengali, mixed Bangla-English queries, organization aliases,
// spelling variants, indexed token matching, and Google-style relevance ranking.

import {
  NormalizedJobCircular,
  JobCategory,
  EducationRequirement,
  DeadlineFilterOption,
  SearchIndexEntry,
  GovtOrganizationRecord,
} from '../types/job.types';
import { DAY_MS } from './deadline-parser';

const DYNAMIC_ORG_ALIAS_MAP = new Map<string, string[]>();

export function registerDynamicOrgAliases(orgs: GovtOrganizationRecord[]): void {
  for (const org of orgs || []) {
    if (!org?.organizationId) continue;
    const aliases = [org.name, org.nameBn || '', org.shortName || '', org.shortCode || '']
      .map((s) => s.trim())
      .filter(Boolean);
    if (aliases.length > 0) {
      DYNAMIC_ORG_ALIAS_MAP.set(String(org.organizationId), aliases);
    }
  }
}

export const SEARCH_INDEX_SCHEMA_VERSION = 3;

export type SearchSortMode = 'relevance' | 'latest_published' | 'deadline_soonest' | 'organization_name';

export interface JobSearchQueryState {
  query: string;
  category: JobCategory | 'All';
  education: EducationRequirement | 'All';
  location: string;
  deadline: DeadlineFilterOption;
  skillsOrExperience: string;
  sortBy: SearchSortMode;
  bookmarkedOnly?: boolean;
}

export const SEARCH_ENGINE_CATEGORIES: Array<JobCategory | 'All'> = [
  'All',
  'Government',
  'Private',
  'Bank',
  'NGO',
  'University',
  'Autonomous Organization',
  'Education',
  'Healthcare',
  'Defence',
  'Remote Jobs',
  'International Jobs',
];

const EQUIVALENT_TERM_GROUPS: string[][] = [
  ['bb', 'bangladesh bank', 'বাংলাদেশ ব্যাংক', 'bsc', 'bankers selection'],
  ['bpsc', 'বিপিএসসি', 'bcs', 'বিসিএস', 'সরকারি কর্ম কমিশন', 'সরকারী কর্ম কমিশন'],
  ['dpe', 'ডিপিই', 'প্রাথমিক শিক্ষা', 'assistant teacher', 'সহকারী শিক্ষক'],
  ['ntrca', 'এনটিআরসিএ'],
  ['teletalk', 'টেলিটক', 'alljobs'],
  ['du', 'ঢাকা বিশ্ববিদ্যালয়', 'ঢাকা বিশ্ববিদ্যালয়', 'dhaka university'],
  ['dshe', 'মাউশি', 'মাধ্যমিক ও উচ্চশিক্ষা'],
  ['mopa', 'জনপ্রশাসন', 'public administration'],
  ['dghs', 'স্বাস্থ্য অধিদপ্তর', 'health services'],
  ['doict', 'ict', 'তথ্য ও যোগাযোগ প্রযুক্তি'],
  ['bogmc', 'petrobangla', 'পেট্রোবাংলা'],
  ['dscc', 'ঢাকা দক্ষিণ সিটি', 'south city corporation'],
  ['chittagong', 'chattogram', 'চট্টগ্রাম'],
  ['barisal', 'barishal', 'বরিশাল'],
  ['comilla', 'cumilla', 'কুমিল্লা'],
  ['jessore', 'jashore', 'যশোর'],
  ['bogra', 'bogura', 'বগুড়া', 'বগুড়া'],
  ['dhaka', 'ঢাকা'],
  ['rajshahi', 'রাজশাহী'],
  ['khulna', 'খুলনা'],
  ['sylhet', 'সিলেট'],
  ['rangpur', 'রংপুর'],
  ['mymensingh', 'ময়মনসিংহ', 'ময়মনসিংহ'],
  ['govt', 'government', 'সরকারি', 'সরকারী'],
  ['bank', 'ব্যাংক'],
  ['recruitment', 'নিয়োগ', 'নিয়োগ', 'recruiting'],
  ['non-government', 'non government', 'বেসরকারি', 'বেসরকারী'],
  ['teacher', 'teachers', 'lecturer', 'শিক্ষক', 'প্রভাষক'],
  ['registration', 'নিবন্ধন'],
  ['certification', 'প্রত্যয়ন', 'প্রত্যয়ন'],
  ['authority', 'কর্তৃপক্ষ'],
  ['commission', 'কমিশন'],
  ['directorate', 'অধিদপ্তর'],
  ['primary', 'প্রাথমিক'],
  ['engineer', 'প্রকৌশলী', 'ইঞ্জিনিয়ার'],
  ['officer', 'কর্মকর্তা', 'অফিসার'],
  ['assistant', 'সহকারী'],
  ['programmer', 'প্রোগ্রামার', 'developer', 'software'],
  ['nurse', 'নার্স', 'nursing'],
  ['doctor', 'medical officer', 'চিকিৎসক', 'ডাক্তার'],
  ['remote', 'wfh', 'work from home', 'রিমোট'],
];

const SEARCH_JOINER_WORDS = new Set(['ও', 'এবং', 'and', 'of', 'for', 'the', '&', '-', '/']);

const VARIATION_MAP = new Map<string, string[]>();
for (const group of EQUIVALENT_TERM_GROUPS) {
  const lowered = group.map((t) => t.toLowerCase());
  for (const term of lowered) {
    VARIATION_MAP.set(term, lowered);
  }
}

export function normalizeSearchText(input: string): string {
  return (input || '')
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .toLowerCase()
    .replace(/[()[\]{}"'’‘.,;:|\\/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeSearchQuery(query: string): string[] {
  const norm = normalizeSearchText(query);
  if (!norm) return [];
  const raw = norm.split(/\s+/).filter(Boolean);
  if (raw.length <= 1) return raw;
  const meaningful = raw.filter((tok) => !SEARCH_JOINER_WORDS.has(tok));
  return meaningful.length > 0 ? meaningful : raw;
}

/**
 * Returns verified EN/BN organization aliases strictly for records genuinely belonging
 * to that organization or official source. Never attaches aliases to unrelated records.
 */
export function getOrganizationSearchAliases(job: NormalizedJobCircular): string[] {
  const identityText = `${job.sourceId || ''} ${job.sourceName || ''} ${job.organization || ''} ${job.organizationBn || ''} ${job.organizationShortName || ''}`;
  const aliases = new Set<string>();

  if (
    job.sourceId === 'ntrca' ||
    /\bntrca\b|এনটিআরসিএ|বেসরকারি\s+শিক্ষক\s+নিবন্ধন/i.test(identityText)
  ) {
    for (const a of [
      'NTRCA',
      'এনটিআরসিএ',
      'NTRCA Teacher Recruitment',
      'বেসরকারি শিক্ষক নিবন্ধন ও প্রত্যয়ন কর্তৃপক্ষ',
      'বেসরকারি শিক্ষক নিবন্ধন ও প্রত্যয়ন কর্তৃপক্ষ (এনটিআরসিএ)',
      'বেসরকারি শিক্ষক নিবন্ধন ও নিয়োগ',
      "Non-Government Teachers' Registration and Certification Authority",
    ]) {
      aliases.add(a);
    }
  }

  if (
    job.sourceId === 'dpe' ||
    /\bdpe\b|ডিপিই|directorate\s+of\s+primary\s+education|প্রাথমিক\s+শিক্ষা\s+অধিদপ্তর/i.test(identityText)
  ) {
    for (const a of [
      'DPE',
      'ডিপিই',
      'DPE Primary Education Recruitment',
      'Directorate of Primary Education',
      'প্রাথমিক শিক্ষা অধিদপ্তর',
    ]) {
      aliases.add(a);
    }
  }

  if (
    job.sourceId === 'bpsc' ||
    /\bbpsc\b|বিপিএসসি|public\s+service\s+commission|সরকারি\s+কর্ম\s+কমিশন/i.test(identityText)
  ) {
    for (const a of [
      'BPSC',
      'বিপিএসসি',
      'Bangladesh Public Service Commission',
      'বাংলাদেশ সরকারি কর্ম কমিশন',
    ]) {
      aliases.add(a);
    }
  }

  if (
    job.sourceId === 'bangladesh_bank' ||
    /bangladesh\s+bank|বাংলাদেশ\s+ব্যাংক|bankers\s+selection/i.test(identityText)
  ) {
    for (const a of [
      'Bangladesh Bank',
      'Bangladesh Bank Recruitment',
      'Bangladesh Bank (BSC)',
      'বাংলাদেশ ব্যাংক',
      'ব্যাংকার্স সিলেকশন কমিটি',
    ]) {
      aliases.add(a);
    }
  }

  if (job.sourceId === 'teletalk' || /\balljobs\b|\bteletalk\b|টেলিটক/i.test(identityText)) {
    for (const a of ['Teletalk', 'Alljobs', 'Teletalk All Jobs', 'টেলিটক']) {
      aliases.add(a);
    }
  }

  if (typeof job.organizationId === 'number') {
    const dyn = DYNAMIC_ORG_ALIAS_MAP.get(String(job.organizationId));
    if (dyn) {
      for (const a of dyn) aliases.add(a);
    }
  }

  return Array.from(aliases);
}

export function expandQueryTerms(rawToken: string): string[] {
  const norm = normalizeSearchText(rawToken);
  if (!norm) return [];
  const results = new Set<string>([norm]);
  const direct = VARIATION_MAP.get(norm);
  if (direct) {
    for (const v of direct) results.add(v);
  }
  return Array.from(results);
}

export function buildJobSearchIndexEntry(job: NormalizedJobCircular): SearchIndexEntry {
  const orgAliases = getOrganizationSearchAliases(job);
  const parts = [
    job.jobTitle,
    job.titleBn || '',
    job.position,
    job.organization,
    job.organizationBn || '',
    job.organizationShortName || '',
    ...orgAliases,
    job.sourceId,
    job.sourceId.replace(/[_-]+/g, ' '),
    job.sourceName,
    job.circularNumber || '',
    job.sourceJobId || '',
    job.category,
    String(job.qualification || ''),
    String(job.location || ''),
    job.experience || '',
    job.salary || '',
    job.description || '',
    ...(job.requirements || []),
  ];
  const searchableText = normalizeSearchText(parts.join(' '));
  const rawTokens = searchableText.split(/[^\p{L}\p{M}\p{N}+-]+/u).filter((t) => t.length >= 2);
  const expanded = new Set<string>();
  for (const t of rawTokens.slice(0, 160)) {
    expanded.add(t);
    const aliasGroup = VARIATION_MAP.get(t);
    if (aliasGroup) {
      for (const a of aliasGroup) expanded.add(a);
    }
  }
  return {
    jobId: job.id,
    searchableText,
    normalizedTokens: Array.from(expanded).slice(0, 200),
    category: job.category,
    updatedAt: job.lastUpdatedAt,
  };
}

export function buildSearchIndexEntries(jobs: NormalizedJobCircular[]): SearchIndexEntry[] {
  return jobs.map((j) => buildJobSearchIndexEntry(j));
}

export function matchesSearchCategory(job: NormalizedJobCircular, selected: JobCategory | 'All'): boolean {
  if (selected === 'All') return true;
  if (job.category === selected) return true;
  if (selected === 'Government') {
    const isStatutoryGovtEducationBody =
      (job.category === 'Teaching' || job.category === 'Education') &&
      (job.sourceId === 'ntrca' ||
        job.sourceId === 'dpe' ||
        /\b(?:ntrca|dpe|dshe)\.gov\.bd\b|\bntrcar\.teletalk\.com\.bd\b/i.test(
          `${job.circularUrl || ''} ${job.applicationUrl || ''} ${job.organizationUrl || ''} ${job.sourceUrl || ''}`
        ));
    return isStatutoryGovtEducationBody;
  }
  if (selected === 'Education') {
    return job.category === 'Teaching' || job.category === 'Education' || job.category === 'University';
  }
  if (selected === 'Teaching') {
    return job.category === 'Teaching' || job.category === 'Education';
  }
  if (selected === 'Defence' || selected === 'Defence / Security') {
    return job.category === 'Defence' || job.category === 'Defence / Security';
  }
  if (selected === 'Remote Jobs') {
    return (
      job.category === 'Remote Jobs' ||
      job.sourceId === 'remotive_remote' ||
      job.sourceId === 'remoteok_remote' ||
      job.sourceId === 'arbeitnow_remote' ||
      /\bremote\b/i.test(`${job.jobTitle} ${job.location}`)
    );
  }
  if (selected === 'International Jobs') {
    return (
      job.category === 'International Jobs' ||
      job.category === 'Remote Jobs' ||
      job.sourceId === 'himalayas_remote' ||
      job.sourceId === 'arbeitnow_remote' ||
      job.sourceId === 'remoteok_remote' ||
      job.sourceId === 'remotive_remote'
    );
  }
  return false;
}

export function computeSearchRelevanceScore(
  job: NormalizedJobCircular,
  queryTokens: string[],
  indexEntry?: SearchIndexEntry
): number {
  if (queryTokens.length === 0) return 1;

  const orgAliases = getOrganizationSearchAliases(job);
  const titleText = normalizeSearchText(`${job.jobTitle} ${job.titleBn || ''} ${job.position}`);
  const orgText = normalizeSearchText(
    `${job.organization} ${job.organizationBn || ''} ${job.organizationShortName || ''} ${job.sourceId} ${job.sourceId.replace(/[_-]+/g, ' ')} ${job.sourceName} ${orgAliases.join(' ')}`
  );
  const idText = normalizeSearchText(`${job.circularNumber || ''} ${job.sourceJobId || ''}`);
  const metaText = normalizeSearchText(`${job.qualification} ${job.location} ${job.experience || ''} ${job.category}`);
  const liveFullText = normalizeSearchText(`${titleText} ${orgText} ${idText} ${metaText} ${job.description}`);
  const fullText = indexEntry?.searchableText
    ? `${indexEntry.searchableText} ${liveFullText}`
    : liveFullText;

  let score = 0;
  for (const token of queryTokens) {
    const variants = expandQueryTerms(token);
    const inTitle = variants.some((v) => titleText.includes(v));
    const inOrg = variants.some((v) => orgText.includes(v));
    const inId = variants.some((v) => idText.includes(v));
    const inMeta = variants.some((v) => metaText.includes(v));
    const inFull = inTitle || inOrg || inId || inMeta || variants.some((v) => fullText.includes(v));

    if (!inFull) return 0; // All non-empty substantive query terms must match at least one alias/variant
    if (inId) score += 25;
    if (inTitle) score += 16;
    if (inOrg) score += 12;
    if (inMeta) score += 7;
    if (!inTitle && !inOrg && !inId && !inMeta) score += 4;
  }

  // Slight freshness & official verification boost
  if (job.sourceVerification === 'official_verified') score += 3;
  else if (job.sourceVerification === 'official_partial') score += 2;
  if (job.status === 'expired') score -= 4;

  return Math.max(1, score);
}

export function matchesJobEducation(
  job: NormalizedJobCircular,
  selected: EducationRequirement | 'All'
): boolean {
  if (selected === 'All' || selected === 'Any Qualification') return true;
  const qualLower = normalizeSearchText(String(job.qualification || ''));
  return qualLower.includes(selected.toLowerCase());
}

export function matchesJobLocation(
  job: NormalizedJobCircular,
  selectedLocation: string
): boolean {
  const locFilterNorm = normalizeSearchText(selectedLocation || '');
  if (!locFilterNorm || locFilterNorm === 'all') return true;
  const jobLocNorm = normalizeSearchText(String(job.location || ''));
  const isNationwide = jobLocNorm === 'all bangladesh';
  if (locFilterNorm === 'all bangladesh') {
    return isNationwide;
  }
  const locVariants = expandQueryTerms(locFilterNorm);
  return isNationwide || locVariants.some((v) => jobLocNorm.includes(v));
}

export function matchesJobDeadline(
  job: NormalizedJobCircular,
  deadline: DeadlineFilterOption,
  now: number = Date.now()
): boolean {
  if (deadline === 'all') return true;
  if (deadline === 'expired') {
    return Boolean(
      job.status === 'expired' ||
        (job.deadlineVerified && typeof job.deadlineAt === 'number' && job.deadlineAt <= now)
    );
  }
  if (!job.deadlineVerified || typeof job.deadlineAt !== 'number' || job.deadlineAt <= now) {
    return false;
  }
  const rem = job.deadlineAt - now;
  if (deadline === 'closing_soon') return rem <= 7 * DAY_MS;
  if (deadline === 'more_than_7_days') return rem > 7 * DAY_MS;
  if (deadline === '3_to_7_days') return rem >= 2 * DAY_MS && rem <= 7 * DAY_MS;
  if (deadline === '1_to_2_days') return rem > 1 * DAY_MS && rem <= 2 * DAY_MS;
  if (deadline === 'closing_today') return rem <= 1 * DAY_MS;
  return true;
}

export function searchAndRankJobs(
  jobs: NormalizedJobCircular[],
  state: JobSearchQueryState,
  bookmarkedIds: Set<string>,
  hiddenIds: Set<string>,
  indexMap?: Map<string, SearchIndexEntry>,
  now: number = Date.now()
): Array<{ job: NormalizedJobCircular; relevanceScore: number }> {
  const queryTokens = tokenizeSearchQuery(state.query);
  const skillsNorm = normalizeSearchText(state.skillsOrExperience || '');

  const scored: Array<{ job: NormalizedJobCircular; relevanceScore: number }> = [];

  for (const job of jobs) {
    if (hiddenIds.has(job.id)) continue;
    if (state.bookmarkedOnly && !bookmarkedIds.has(job.id)) continue;
    if (!matchesSearchCategory(job, state.category)) continue;
    if (!matchesJobEducation(job, state.education)) continue;
    if (!matchesJobLocation(job, state.location)) continue;

    if (skillsNorm) {
      const skillHaystack = normalizeSearchText(
        `${job.experience || ''} ${job.description} ${(job.requirements || []).join(' ')} ${job.qualification}`
      );
      if (!skillHaystack.includes(skillsNorm)) continue;
    }

    if (!matchesJobDeadline(job, state.deadline, now)) continue;

    const idxEntry = indexMap?.get(job.id);
    const relevanceScore = computeSearchRelevanceScore(job, queryTokens, idxEntry);
    if (queryTokens.length > 0 && relevanceScore <= 0) continue;

    scored.push({ job, relevanceScore });
  }

  scored.sort((a, b) => {
    switch (state.sortBy) {
      case 'deadline_soonest': {
        const da = a.job.deadlineVerified && a.job.deadlineAt && a.job.deadlineAt > now ? a.job.deadlineAt : Number.MAX_SAFE_INTEGER;
        const db = b.job.deadlineVerified && b.job.deadlineAt && b.job.deadlineAt > now ? b.job.deadlineAt : Number.MAX_SAFE_INTEGER;
        return da - db;
      }
      case 'organization_name':
        return a.job.organization.localeCompare(b.job.organization);
      case 'latest_published':
        return (b.job.publishedAt ?? b.job.firstDiscoveredAt) - (a.job.publishedAt ?? a.job.firstDiscoveredAt);
      case 'relevance':
      default:
        if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
        return (b.job.publishedAt ?? b.job.firstDiscoveredAt) - (a.job.publishedAt ?? a.job.firstDiscoveredAt);
    }
  });

  return scored;
}

export function getSearchSuggestions(jobs: NormalizedJobCircular[], query: string, limit: number = 8): string[] {
  const norm = normalizeSearchText(query);
  const candidates = new Set<string>([
    'Assistant Programmer',
    'Bangladesh Bank',
    'BPSC',
    'Teletalk',
    'সহকারী শিক্ষক',
    'NTRCA',
    'Remote Developer',
    'Dhaka',
  ]);
  for (const j of jobs.slice(0, 60)) {
    if (j.position) candidates.add(j.position);
    if (j.organization) candidates.add(j.organization);
  }
  const all = Array.from(candidates);
  if (!norm) return all.slice(0, limit);
  const qVariants = expandQueryTerms(norm);
  return all
    .filter((item) => {
      const lower = normalizeSearchText(item);
      return qVariants.some((v) => lower.includes(v));
    })
    .slice(0, limit);
}
