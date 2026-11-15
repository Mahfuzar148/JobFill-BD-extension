// JobFill BD - Shared Job Normalizer
// Converts raw source adapter payloads into the unified NormalizedJobCircular schema.

import {
  NormalizedJobCircular,
  JobCategory,
  JobEmploymentType,
  EducationRequirement,
  JobLocation,
  SourceVerificationStatus,
  JobFieldVerificationMap,
  JobOriginalValues,
  FieldVerificationState,
} from '../types/job.types';
import { RawSourceJobItem } from '../types/source.types';
import { parseDeadlineDate } from './deadline-parser';
import { refreshJobStatus } from './job-validator';
import { isCircularDocumentUrl } from './application-link-detector';
import { JobGradeExtractor } from './grade-extractor';
import { JobTaxonomyClassifier } from './taxonomy-classifier';

const DHAKA_DIVISIONS: JobLocation[] = [
  'Dhaka',
  'Rajshahi',
  'Chattogram',
  'Khulna',
  'Rangpur',
  'Barishal',
  'Sylhet',
  'Mymensingh',
];

export function computeFingerprintHash(org: string, title: string, circularNo?: string, appUrl?: string): string {
  const clean = (s?: string) =>
    (s || '')
      .normalize('NFC')
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const base = `${clean(org)}|${clean(title)}|${clean(circularNo)}|${clean(appUrl?.split('?')[0])}`;
  let hash = 2166136261;
  for (let i = 0; i < base.length; i++) {
    hash ^= base.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export function normalizeCategory(raw?: string, textHint: string = ''): JobCategory {
  const combined = `${raw || ''} ${textHint}`.toLowerCase();
  if (raw && (
    ['Government', 'Private', 'Bank', 'NGO', 'University', 'Autonomous Organization', 'Defence / Security', 'Defence', 'Education', 'Teaching', 'IT / Technology', 'Healthcare', 'Remote Jobs', 'International Jobs', 'Other'] as string[]
  ).includes(raw)) {
    return raw as JobCategory;
  }
  if (/bank|bb\.org|sonali|janata|rupali|agrani|spcbl|ব্যাংক/i.test(combined)) return 'Bank';
  if (/defence|army|navy|air force|police|ansar|rab|bgb|সেনাবাহিনী|পুলিশ/i.test(combined)) return 'Defence / Security';
  if (/university|বিশ্ববিদ্যালয়|buet|du\.ac|sust|ju|cu|ru/i.test(combined)) return 'University';
  if (/hospital|medical|health|nurse|doctor|স্বাস্থ্য|হাসপাতাল/i.test(combined)) return 'Healthcare';
  if (/school|college|teacher|lecturer|professor|শিক্ষক|প্রভাষক/i.test(combined)) return 'Teaching';
  if (/software|developer|programmer|engineer|it |ict|প্রোগ্রামার|আইটি/i.test(combined)) return 'IT / Technology';
  if (/ngo|brac|asa|grameen|unicef|undp|এনজিও/i.test(combined)) return 'NGO';
  if (/petrobangla|bpdb|desco|wasa|reb|autonomous|স্বায়ত্তশাসিত/i.test(combined)) return 'Autonomous Organization';
  if (/gov\.bd|bpsc|teletalk|ministry|directorate|government|সরকারি|মন্ত্রণালয়|অধিদপ্তর|বিপিএসসি/i.test(combined)) return 'Government';
  if (/private|limited|ltd|company|corporate|বেসরকারি/i.test(combined)) return 'Private';
  return 'Other';
}

export function normalizeEmploymentType(raw?: string): JobEmploymentType {
  const lower = (raw || '').toLowerCase();
  if (/part[\s-]?time/.test(lower)) return 'Part Time';
  if (/contract/.test(lower)) return 'Contractual';
  if (/intern/.test(lower)) return 'Internship';
  if (/temp|adhoc/.test(lower)) return 'Temporary';
  return 'Full Time';
}

export function normalizeQualification(raw?: string): EducationRequirement | string {
  const txt = (raw || '').trim();
  if (!txt) return 'Any Qualification';
  const lower = txt.toLowerCase();
  if (/\bphd\b|\bdoctorate\b/.test(lower)) return 'PhD';
  if (/\bmaster|\bm\.?sc\b|\bm\.?a\b|\bm\.?b\.?a\b|\bm\.?b\.?s\b|স্নাতকোত্তর/.test(lower)) return 'Masters';
  if (/\bhonours\b|\bhons\b|অনার্স/.test(lower)) return 'Honours';
  if (/\bbachelor|\bb\.?sc\b|\bb\.?b\.?a\b|\bb\.?a\b|\bgraduation\b|\bgraduate\b|স্নাতক/.test(lower)) return 'Bachelor';
  if (/\bdiploma\b|ডিপ্লোমা/.test(lower)) return 'Diploma';
  if (/\bhsc\b|\balim\b|এইচএসসি/.test(lower)) return 'HSC';
  if (/\bssc\b|\bdakhil\b|এসএসসি/.test(lower)) return 'SSC';
  return txt;
}

export function normalizeLocation(raw?: string): JobLocation | string {
  const txt = (raw || '').trim();
  if (!txt) return 'All Bangladesh';
  const lower = txt.toLowerCase();
  for (const div of DHAKA_DIVISIONS) {
    if (lower.includes(div.toLowerCase())) return div;
  }
  if (/chittagong|চট্টগ্রাম/.test(lower)) return 'Chattogram';
  if (/ঢাকা/.test(lower)) return 'Dhaka';
  if (/রাজশাহী/.test(lower)) return 'Rajshahi';
  if (/খুলনা/.test(lower)) return 'Khulna';
  if (/রংপুর/.test(lower)) return 'Rangpur';
  if (/বরিশাল/.test(lower)) return 'Barishal';
  if (/সিলেট/.test(lower)) return 'Sylhet';
  if (/ময়মনসিংহ|ময়মনসিংহ/.test(lower)) return 'Mymensingh';
  if (/bangladesh|nationwide|all|সারা দেশ|বাংলাদেশ/.test(lower)) return 'All Bangladesh';
  return txt;
}

export function computeJobFieldVerification(
  circular: Pick<
    NormalizedJobCircular,
    | 'jobTitle'
    | 'position'
    | 'organization'
    | 'deadlineVerified'
    | 'vacancies'
    | 'salary'
    | 'qualification'
    | 'applicationUrl'
    | 'circularUrl'
    | 'sourceVerification'
  >
): JobFieldVerificationMap {
  const isOfficial = circular.sourceVerification === 'official_verified';
  const isPartialSource =
    circular.sourceVerification === 'official_partial' ||
    circular.sourceVerification === 'user_submitted';
  const baseSourceState: FieldVerificationState = isOfficial
    ? 'verified'
    : isPartialSource
      ? 'partial'
      : 'unverified';

  const hasAppUrl = Boolean(circular.applicationUrl && !isCircularDocumentUrl(circular.applicationUrl));
  const qualStr = String(circular.qualification || '').trim();

  return {
    title: circular.jobTitle || circular.position ? baseSourceState : 'unverified',
    organization: circular.organization ? baseSourceState : 'unverified',
    deadline: circular.deadlineVerified ? 'verified' : 'unverified',
    vacancy:
      typeof circular.vacancies === 'number' && circular.vacancies > 0 ? baseSourceState : 'unverified',
    salary: circular.salary && circular.salary.trim() ? baseSourceState : 'unverified',
    qualification:
      qualStr && qualStr !== 'Any Qualification'
        ? baseSourceState
        : 'unverified',
    applicationUrl: hasAppUrl ? (isOfficial ? 'verified' : 'partial') : 'unverified',
    circularUrl: circular.circularUrl ? (isOfficial ? 'verified' : 'partial') : 'unverified',
  };
}

export function buildJobOriginalValues(raw: RawSourceJobItem): JobOriginalValues {
  return {
    title: raw.jobTitle?.trim() || undefined,
    titleBn: raw.titleBn?.trim() || null,
    organization: raw.organization?.trim() || undefined,
    organizationBn: raw.organizationBn?.trim() || null,
    deadlineText: raw.deadlineText?.trim() || undefined,
    publishedDateText: raw.publishedDateText?.trim() || undefined,
    applicationStartText: raw.applicationStartText?.trim() || undefined,
    location: raw.location?.trim() || undefined,
  };
}

export function extractMinGpaOrCgpa(text?: string): { minGpa: number | null; minCgpa: number | null } {
  if (!text) return { minGpa: null, minCgpa: null };
  const cleaned = text.replace(/[০-৯]/g, (ch) => String('০১২৩৪৫৬৭৮৯'.indexOf(ch)));
  let minGpa: number | null = null;
  let minCgpa: number | null = null;

  const gpaMatch = cleaned.match(/(?:\bGPA|জিপিএ)\s*[:\-=]?\s*([1-5](?:\.\d{1,2})?)/i);
  if (gpaMatch) {
    const val = parseFloat(gpaMatch[1]);
    if (val >= 1.0 && val <= 5.0) minGpa = val;
  }

  const cgpaMatch = cleaned.match(/(?:\bCGPA|সিজিপিএ)\s*[:\-=]?\s*([1-4](?:\.\d{1,2})?)/i);
  if (cgpaMatch) {
    const val = parseFloat(cgpaMatch[1]);
    if (val >= 1.0 && val <= 4.0) minCgpa = val;
  }

  return { minGpa, minCgpa };
}

export function parseSalaryRangeNumbers(salaryStr?: string): { min: number | null; max: number | null } {
  if (!salaryStr) return { min: null, max: null };
  const cleaned = salaryStr
    .replace(/[০-৯]/g, (ch) => String('০১২৩৪৫৬৭৮৯'.indexOf(ch)))
    .replace(/,/g, '');
  const matches = cleaned.match(/\b(\d{4,7})\b/g);
  if (!matches || matches.length === 0) return { min: null, max: null };

  const nums = matches.map((m) => parseInt(m, 10)).filter((n) => n >= 5000 && n <= 500000);
  if (nums.length === 0) return { min: null, max: null };
  if (nums.length === 1) return { min: nums[0], max: nums[0] };
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

export function normalizeJobRecord(
  raw: RawSourceJobItem,
  meta: {
    sourceId: string;
    sourceName: string;
    verificationLevel: SourceVerificationStatus;
    checkedAt?: number;
    defaultApplicationUrl?: string;
    isManual?: boolean;
  }
): NormalizedJobCircular {
  const now = meta.checkedAt ?? Date.now();
  const org = (raw.organization || meta.sourceName).trim();
  const title = (raw.jobTitle || raw.position || 'Job Circular').trim();
  const position = (raw.position || raw.jobTitle || title).trim();

  let circularUrl = raw.circularUrl?.trim() || undefined;
  let appUrl: string | null = raw.applicationUrl ? raw.applicationUrl.trim() : null;
  if (appUrl === '') appUrl = null;
  // Never store a circular PDF / document download link inside applicationUrl
  if (appUrl && isCircularDocumentUrl(appUrl)) {
    if (!circularUrl) circularUrl = appUrl;
    appUrl = null;
  }
  const orgUrl = raw.organizationUrl?.trim() || undefined;
  const sourceUrl = raw.sourceUrl?.trim() || null;

  const parsedPub = parseDeadlineDate(raw.publishedDateText);
  const parsedStart = parseDeadlineDate(raw.applicationStartText);
  const parsedDeadline = parseDeadlineDate(raw.deadlineText);

  const category = normalizeCategory(raw.category, `${org} ${title}`);
  const gradeResult = JobGradeExtractor.extractJobGrade({
    jobTitle: title,
    position,
    description: raw.description,
    salaryText: raw.salary,
    category,
    sourceVerification: meta.verificationLevel,
  });

  const salaryRange = parseSalaryRangeNumbers(raw.salary);
  const gpaInfo = extractMinGpaOrCgpa(`${raw.qualification || ''} ${raw.description || ''}`);

  const primaryRefUrl = appUrl || circularUrl || sourceUrl || orgUrl || '';
  const fingerprintHash = computeFingerprintHash(org, position, raw.circularNumber, primaryRefUrl);
  const stableHash = raw.externalId
    ? computeFingerprintHash(raw.externalId, title, raw.circularNumber || raw.publishedDateText, circularUrl || primaryRefUrl)
    : fingerprintHash;
  const asciiSlug = raw.externalId
    ? raw.externalId
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 36)
    : '';
  const stableSuffix = asciiSlug
    ? `${meta.sourceId}_${asciiSlug}_${stableHash}`
    : `${meta.sourceId}_${stableHash}`;

  const circular: NormalizedJobCircular = {
    id: stableSuffix,
    sourceId: meta.sourceId,
    sourceName: meta.sourceName,
    sourceJobId: raw.sourceJobId ?? (raw.externalId || raw.circularNumber || null),
    organizationId: typeof raw.organizationId === 'number' ? raw.organizationId : undefined,
    organizationShortName: raw.organizationShortName?.trim() || undefined,
    organization: org,
    organizationBn: raw.organizationBn?.trim() || null,
    organizationLogo: raw.organizationLogo,
    jobTitle: title,
    titleBn: raw.titleBn?.trim() || null,
    position,
    circularNumber: raw.circularNumber?.trim() || undefined,
    category,
    employmentType: normalizeEmploymentType(raw.employmentType),
    vacancies: typeof raw.vacancies === 'number' && raw.vacancies > 0 ? raw.vacancies : null,
    salary: raw.salary?.trim() || undefined,
    salaryMin: salaryRange.min,
    salaryMax: salaryRange.max,
    gradeNumber: gradeResult.gradeNumber,
    gradeLabel: gradeResult.gradeLabel,
    gradeOriginalText: gradeResult.gradeOriginalText,
    gradeVerificationStatus: gradeResult.gradeVerificationStatus,
    cadreStatus: raw.cadreStatus || JobGradeExtractor.extractCadreStatus(`${title} ${raw.description || ''} ${org}`),
    gazettedStatus: raw.gazettedStatus || JobGradeExtractor.extractGazettedStatus(`${title} ${raw.description || ''} ${org}`),
    qualification: normalizeQualification(raw.qualification),
    minGpa: gpaInfo.minGpa,
    minCgpa: gpaInfo.minCgpa,
    experience: raw.experience?.trim() || undefined,
    ageRequirement: raw.ageRequirement?.trim() || undefined,
    location: normalizeLocation(raw.location),
    publishedAt: parsedPub.isVerified ? parsedPub.timestamp : null,
    publishedDateText: raw.publishedDateText?.trim() || undefined,
    applicationStartAt: parsedStart.isVerified ? parsedStart.timestamp : null,
    applicationStartText: raw.applicationStartText?.trim() || undefined,
    deadlineAt: parsedDeadline.isVerified ? parsedDeadline.timestamp : null,
    deadlineText: raw.deadlineText?.trim() || undefined,
    deadlineTimezone: 'Asia/Dhaka',
    timezone: 'Asia/Dhaka',
    deadlineVerified: parsedDeadline.isVerified,
    circularUrl,
    applicationUrl: appUrl,
    organizationUrl: orgUrl,
    sourceUrl,
    description: (raw.description || title).trim(),
    requirements: Array.isArray(raw.requirements) ? raw.requirements.filter(Boolean) : [],
    applicationFee: raw.applicationFee?.trim() || undefined,
    applicationProcedure: raw.applicationProcedure?.trim() || undefined,
    requiredDocuments: Array.isArray(raw.requiredDocuments) ? raw.requiredDocuments.filter(Boolean) : undefined,
    sourceVerification: meta.verificationLevel,
    sourceLastCheckedAt: now,
    sourceLastVerifiedAt: now,
    firstDiscoveredAt: now,
    lastUpdatedAt: now,
    status: 'active',
    fingerprintHash,
    originalValues: buildJobOriginalValues(raw),
    possibleDuplicateOfId: null,
    duplicateConfidence: null,
    isManual: meta.isManual,
    verificationHistory: meta.isManual
      ? [
          {
            timestamp: now,
            status: 'user_submitted',
            action: 'Manually Added — Official Source Pending Verification',
            sourceUrl: sourceUrl || circularUrl || appUrl || orgUrl || null,
            note: 'Supplied manually by user; awaiting independent verification.',
          },
        ]
      : undefined,
  };

  circular.fieldVerification = computeJobFieldVerification(circular);
  JobTaxonomyClassifier.enrichJobWithTaxonomy(circular);
  return refreshJobStatus(circular, now);
}

export class JobNormalizer {
  public static normalize(raw: any, now: number = Date.now()): NormalizedJobCircular {
    const meta = {
      sourceId: raw.sourceId || 'manual',
      sourceName: raw.sourceName || 'Official Source',
      verificationLevel: raw.sourceVerification || 'official_verified',
      checkedAt: now,
      isManual: raw.isManual || false,
    };
    const rawItem: RawSourceJobItem = {
      jobTitle: raw.title || raw.jobTitle || 'Job Circular',
      position: raw.position || raw.title || raw.jobTitle,
      organization: raw.organization || 'Official Portal',
      category: raw.category || 'Government',
      location: raw.location || 'All Bangladesh',
      salary: raw.salary,
      qualification: raw.qualification,
      deadlineText: raw.deadline || raw.deadlineText,
      circularUrl: raw.circularUrl || raw.url,
      applicationUrl: raw.applicationUrl || raw.url,
      description: raw.description,
      requirements: raw.requirements,
    };
    return normalizeJobRecord(rawItem, meta);
  }
}
