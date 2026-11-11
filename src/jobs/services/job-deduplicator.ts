// JobFill BD - Job Circular Deduplicator
// Merges incoming circulars with existing records without losing official verification
// or creating duplicates from overlapping sources (e.g. Google News + Official Portal).

import { NormalizedJobCircular, SourceVerificationStatus, AlternateSourceLink } from '../types/job.types';
import { computeFingerprintHash, computeJobFieldVerification } from './job-normalizer';
import { isMeaningfulJobUpdate, refreshJobStatus } from './job-validator';

const VERIFICATION_RANK: Record<SourceVerificationStatus, number> = {
  official_verified: 5,
  official_partial: 4,
  user_submitted: 3,
  discovery_only: 2,
  unverified: 1,
};

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export interface DeduplicationMergeResult {
  mergedJobs: NormalizedJobCircular[];
  newJobs: NormalizedJobCircular[];
  updatedJobs: NormalizedJobCircular[];
  deadlineChangedJobIds: string[];
  possibleDuplicateCount: number;
  duplicateCount: number;
}

function normVal(v?: string | null): string {
  return (v || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeOrgAliasKey(org?: string | null): string {
  const n = normVal(org);
  if (!n) return '';
  if (n.includes('bangladesh bank') || n.includes('বাংলাদেশ ব্যাংক') || n.includes('bsc')) return 'bangladesh bank';
  if (n.includes('bpsc') || n.includes('public service commission') || n.includes('কর্ম কমিশন')) return 'bpsc';
  if (n.includes('ntrca') || n.includes('এনটিআরসিএ') || n.includes('শিক্ষক নিবন্ধন')) return 'ntrca';
  if (n.includes('dpe') || n.includes('primary education') || n.includes('প্রাথমিক শিক্ষা')) return 'dpe';
  return n;
}

function tokenJaccardSimilarity(a: string, b: string): number {
  const setA = new Set(normVal(a).split(' ').filter((t) => t.length >= 2));
  const setB = new Set(normVal(b).split(' ').filter((t) => t.length >= 2));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Computes duplicate match confidence (0-100):
 * - >= 85: Confirmed match (safe to auto-merge while preserving alternate sources)
 * - 60-84: Uncertain match (flagged cleanly as possible duplicate; never auto-merged or deleted)
 * - < 60: Distinct records
 */
export function computeDuplicateMatchConfidence(
  a: NormalizedJobCircular,
  b: NormalizedJobCircular
): number {
  if (a.id === b.id) return 100;
  if (areDistinctCirculars(a, b)) return 0;

  if (a.sourceId === b.sourceId && a.sourceJobId && b.sourceJobId && normVal(a.sourceJobId) === normVal(b.sourceJobId)) {
    return 100;
  }

  const orgA = normalizeOrgAliasKey(a.organization);
  const orgB = normalizeOrgAliasKey(b.organization);
  const orgMatch = orgA.length > 0 && orgA === orgB;

  if (a.circularNumber && b.circularNumber && normVal(a.circularNumber) === normVal(b.circularNumber) && orgMatch) {
    return 95;
  }

  if (a.circularUrl && b.circularUrl && a.circularUrl.split('#')[0].toLowerCase().trim() === b.circularUrl.split('#')[0].toLowerCase().trim()) {
    return 92;
  }

  const posSim = tokenJaccardSimilarity(a.position || a.jobTitle, b.position || b.jobTitle);
  if (orgMatch && posSim >= 0.99) {
    return 90;
  }

  if (orgMatch && posSim >= 0.72) {
    const pubDiffOk =
      typeof a.publishedAt === 'number' &&
      typeof b.publishedAt === 'number' &&
      Math.abs(a.publishedAt - b.publishedAt) <= 3 * 24 * 60 * 60 * 1000;
    const dlMatchOk =
      a.deadlineVerified &&
      b.deadlineVerified &&
      typeof a.deadlineAt === 'number' &&
      typeof b.deadlineAt === 'number' &&
      Math.abs(a.deadlineAt - b.deadlineAt) <= 24 * 60 * 60 * 1000;
    if (dlMatchOk) return 86;
    if (pubDiffOk) return 75;
    return 65;
  }

  return 0;
}

function areDistinctCirculars(a: NormalizedJobCircular, b: NormalizedJobCircular): boolean {
  if (a.id === b.id) return false;
  if (a.sourceId === b.sourceId && a.sourceJobId && b.sourceJobId) {
    if (normVal(a.sourceJobId) !== normVal(b.sourceJobId)) return true;
  }
  if (a.circularNumber && b.circularNumber) {
    if (normVal(a.circularNumber) !== normVal(b.circularNumber)) return true;
  }
  if (
    a.deadlineVerified &&
    b.deadlineVerified &&
    typeof a.deadlineAt === 'number' &&
    typeof b.deadlineAt === 'number' &&
    Math.abs(a.deadlineAt - b.deadlineAt) > FOURTEEN_DAYS_MS
  ) {
    return true;
  }
  return false;
}

function collectAlternateSources(
  existing: NormalizedJobCircular,
  incoming: NormalizedJobCircular
): AlternateSourceLink[] | undefined {
  const map = new Map<string, AlternateSourceLink>();
  const addEntry = (item: AlternateSourceLink) => {
    const key = `${item.sourceId}|${item.applicationUrl || ''}|${item.circularUrl || ''}`;
    if (!map.has(key)) {
      map.set(key, item);
    }
  };

  for (const prev of existing.alternateSources || []) addEntry(prev);
  for (const inc of incoming.alternateSources || []) addEntry(inc);

  addEntry({
    sourceId: existing.sourceId,
    sourceName: existing.sourceName,
    circularUrl: existing.circularUrl,
    applicationUrl: existing.applicationUrl,
    organizationUrl: existing.organizationUrl,
    sourceUrl: existing.sourceUrl,
    verificationStatus: existing.sourceVerification,
  });
  addEntry({
    sourceId: incoming.sourceId,
    sourceName: incoming.sourceName,
    circularUrl: incoming.circularUrl,
    applicationUrl: incoming.applicationUrl,
    organizationUrl: incoming.organizationUrl,
    sourceUrl: incoming.sourceUrl,
    verificationStatus: incoming.sourceVerification,
  });

  const all = Array.from(map.values());
  return all.length > 1 ? all : existing.alternateSources;
}

function getIdentityKeys(job: NormalizedJobCircular): string[] {
  const keys: string[] = [job.id];
  if (job.sourceJobId) {
    keys.push(`sjid:${job.sourceId}|${normVal(job.sourceJobId)}`);
  }
  if (job.circularNumber) {
    keys.push(`circ:${normVal(job.organization)}|${normVal(job.circularNumber)}`);
  }
  const fp =
    job.fingerprintHash ||
    computeFingerprintHash(
      job.organization,
      job.position,
      job.circularNumber,
      job.applicationUrl || job.circularUrl || job.sourceUrl || ''
    );
  keys.push(`fp:${fp}`);
  keys.push(`title:${normVal(job.organization)}|${normVal(job.position)}`);
  if (job.circularUrl) {
    const cleanCurl = job.circularUrl.split('#')[0].toLowerCase().trim();
    const isSpecificCircularUrl = /\.pdf(\?|$)|[?&](?:id|jobid|circular|jp_id)=|\/(?:notification-circulars|notices|circulars)\/[^/]+/i.test(cleanCurl);
    if (isSpecificCircularUrl) {
      keys.push(`curl:${cleanCurl}`);
    }
  }
  return keys;
}

export function deduplicateAndMergeJobs(
  existingJobs: NormalizedJobCircular[],
  incomingJobs: NormalizedJobCircular[],
  now: number = Date.now()
): DeduplicationMergeResult {
  const byId = new Map<string, NormalizedJobCircular>();
  const keyToId = new Map<string, string>();
  const orgBuckets = new Map<string, NormalizedJobCircular[]>();

  const registerOrgBucket = (job: NormalizedJobCircular) => {
    const orgKey = normalizeOrgAliasKey(job.organization);
    if (!orgKey) return;
    const list = orgBuckets.get(orgKey) || [];
    list.push(job);
    orgBuckets.set(orgKey, list);
  };

  for (const job of existingJobs) {
    const refreshed = refreshJobStatus(job, now);
    byId.set(refreshed.id, refreshed);
    for (const k of getIdentityKeys(refreshed)) {
      if (!keyToId.has(k)) keyToId.set(k, refreshed.id);
    }
    registerOrgBucket(refreshed);
  }

  const newJobs: NormalizedJobCircular[] = [];
  const updatedJobs: NormalizedJobCircular[] = [];
  const deadlineChangedJobIds: string[] = [];
  let possibleDuplicateCount = 0;
  let duplicateCount = 0;

  for (const rawIncoming of incomingJobs) {
    const incoming = refreshJobStatus(rawIncoming, now);
    const keys = getIdentityKeys(incoming);
    let matchedId: string | undefined;
    for (const k of keys) {
      if (keyToId.has(k)) {
        matchedId = keyToId.get(k);
        break;
      }
    }

    let uncertainCandidate: { job: NormalizedJobCircular; confidence: number } | null = null;
    if (!matchedId) {
      const orgKey = normalizeOrgAliasKey(incoming.organization);
      const bucket = orgKey ? orgBuckets.get(orgKey) || [] : [];
      let bestHigh = 0;
      let bestUncertain = 0;
      for (const candidate of bucket) {
        const conf = computeDuplicateMatchConfidence(candidate, incoming);
        if (conf >= 85 && conf > bestHigh) {
          bestHigh = conf;
          matchedId = candidate.id;
        } else if (conf >= 60 && conf < 85 && conf > bestUncertain) {
          bestUncertain = conf;
          uncertainCandidate = { job: candidate, confidence: conf };
        }
      }
    }

    if (!matchedId) {
      const flaggedIncoming: NormalizedJobCircular = uncertainCandidate
        ? {
            ...incoming,
            possibleDuplicateOfId: uncertainCandidate.job.id,
            duplicateConfidence: uncertainCandidate.confidence,
          }
        : incoming;
      if (uncertainCandidate) {
        possibleDuplicateCount += 1;
      }
      byId.set(flaggedIncoming.id, flaggedIncoming);
      for (const k of keys) keyToId.set(k, flaggedIncoming.id);
      registerOrgBucket(flaggedIncoming);
      newJobs.push(flaggedIncoming);
      continue;
    }

    const existing = byId.get(matchedId)!;
    // Do not merge unrelated circulars merely sharing similar organization or post title
    if (areDistinctCirculars(existing, incoming)) {
      byId.set(incoming.id, incoming);
      registerOrgBucket(incoming);
      newJobs.push(incoming);
      continue;
    }

    duplicateCount++;
    const existingRank = VERIFICATION_RANK[existing.sourceVerification] ?? 0;
    const incomingRank = VERIFICATION_RANK[incoming.sourceVerification] ?? 0;
    const combinedAlternates = collectAlternateSources(existing, incoming);

    // Never overwrite official verified data with unverified discovery data
    if (incomingRank < existingRank) {
      byId.set(existing.id, {
        ...existing,
        alternateSources: combinedAlternates,
      });
      continue;
    }

    const { meaningful, deadlineChanged } = isMeaningfulJobUpdate(existing, incoming);
    const mergedBase: NormalizedJobCircular = {
      ...existing,
      ...incoming,
      id: existing.id, // preserve primary ID so bookmarks/applications/reminders stay linked
      circularUrl: incoming.circularUrl || existing.circularUrl,
      applicationUrl: incoming.applicationUrl || existing.applicationUrl || null,
      organizationUrl: incoming.organizationUrl || existing.organizationUrl,
      sourceUrl: incoming.sourceUrl || existing.sourceUrl || null,
      applicationStartAt: incoming.applicationStartAt ?? existing.applicationStartAt ?? null,
      applicationStartText: incoming.applicationStartText || existing.applicationStartText,
      timezone: existing.timezone || incoming.timezone || 'Asia/Dhaka',
      originalValues: existing.originalValues || incoming.originalValues,
      alternateSources: combinedAlternates,
      firstDiscoveredAt: existing.firstDiscoveredAt,
      lastUpdatedAt: meaningful ? now : existing.lastUpdatedAt,
      sourceLastCheckedAt: now,
      sourceLastVerifiedAt: now,
      deadlineVerified:
        incoming.deadlineVerified ||
        (incomingRank === existingRank ? incoming.deadlineVerified : existing.deadlineVerified),
      deadlineAt: incoming.deadlineVerified
        ? incoming.deadlineAt
        : incomingRank > existingRank
          ? incoming.deadlineAt
          : existing.deadlineAt,
      deadlineNeedsRevalidation: deadlineChanged && !incoming.deadlineVerified ? true : false,
      possibleDuplicateOfId:
        incoming.sourceId !== existing.sourceId || (combinedAlternates?.length ?? 0) > 1
          ? null
          : existing.possibleDuplicateOfId && existing.possibleDuplicateOfId !== existing.id
            ? existing.possibleDuplicateOfId
            : null,
      duplicateConfidence:
        incoming.sourceId !== existing.sourceId || (combinedAlternates?.length ?? 0) > 1
          ? null
          : existing.possibleDuplicateOfId && existing.possibleDuplicateOfId !== existing.id
            ? existing.duplicateConfidence ?? null
            : null,
    };
    mergedBase.fieldVerification = computeJobFieldVerification(mergedBase);
    const merged: NormalizedJobCircular = refreshJobStatus(mergedBase, now);

    byId.set(existing.id, merged);
    if (meaningful) {
      updatedJobs.push(merged);
    }
    if (deadlineChanged) {
      deadlineChangedJobIds.push(existing.id);
    }
  }

  return {
    mergedJobs: Array.from(byId.values()),
    newJobs,
    updatedJobs,
    deadlineChangedJobIds,
    possibleDuplicateCount,
    duplicateCount,
  };
}
