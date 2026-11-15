// JobFill BD - Local Offline Age-on-Circular-Cutoff & Bilingual Intelligent Eligibility Engine
// Compares saved profile fields accurately against parsed or manually corrected
// circular requirements without fabricating conditions or confusing work location with district quota.

import type { UserProfile } from '../../types/profile';
import type { NormalizedJobCircular } from '../types/job.types';

export interface ParsedCalendarDate {
  year: number;
  month: number; // 1..12
  day: number; // 1..31
}

export interface AgeEligibilityResult {
  isValid: boolean;
  years: number;
  months: number;
  days: number;
  formattedEn: string;
  formattedBn: string;
  meetsGeneral30: boolean;
  meetsGovt32: boolean;
  underMinimum18: boolean;
  status: 'eligible' | 'eligible_32_standard' | 'overage' | 'underage' | 'invalid';
}

/**
 * Parses YYYY-MM-DD, DD/MM/YYYY, or DD-MM-YYYY date strings cleanly without UTC timezone drift.
 */
export function parseFlexibleDateString(raw?: string | number | null): ParsedCalendarDate | null {
  if (raw === null || raw === undefined) return null;

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const dt = new Date(raw);
    if (Number.isNaN(dt.getTime())) return null;
    // Align to Dhaka calendar date (UTC+6)
    const dhaka = new Date(dt.getTime() + 6 * 3600 * 1000);
    return {
      year: dhaka.getUTCFullYear(),
      month: dhaka.getUTCMonth() + 1,
      day: dhaka.getUTCDate(),
    };
  }

  const str = String(raw).trim();
  if (!str) return null;

  // YYYY-MM-DD
  let m = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    return validateCalendarDate(year, month, day);
  }

  // DD/MM/YYYY or DD-MM-YYYY
  m = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    return validateCalendarDate(year, month, day);
  }

  const parsedTs = Date.parse(str);
  if (!Number.isNaN(parsedTs)) {
    const dt = new Date(parsedTs);
    return {
      year: dt.getFullYear(),
      month: dt.getMonth() + 1,
      day: dt.getDate(),
    };
  }

  return null;
}

function validateCalendarDate(year: number, month: number, day: number): ParsedCalendarDate | null {
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() + 1 !== month ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function daysInMonth(year: number, month1Based: number): number {
  return new Date(Date.UTC(year, month1Based, 0)).getUTCDate();
}

export function formatIsoCalendarDate(d: ParsedCalendarDate): string {
  const mm = String(d.month).padStart(2, '0');
  const dd = String(d.day).padStart(2, '0');
  return `${d.year}-${mm}-${dd}`;
}

/**
 * Calculates exact applicant age in years, months, and days on a given circular cutoff date.
 */
export function calculateAgeOnCutoffDate(
  dobInput: string | null | undefined,
  cutoffInput: string | number | null | undefined,
  minAgeYears = 18,
  customMaxAgeYears = 30
): AgeEligibilityResult {
  const invalid: AgeEligibilityResult = {
    isValid: false,
    years: 0,
    months: 0,
    days: 0,
    formattedEn: 'Enter valid DOB & Cutoff Date',
    formattedBn: 'সঠিক জন্ম তারিখ ও কাট-অফ তারিখ দিন',
    meetsGeneral30: false,
    meetsGovt32: false,
    underMinimum18: false,
    status: 'invalid',
  };

  const dob = parseFlexibleDateString(dobInput);
  const cutoff = parseFlexibleDateString(cutoffInput);
  if (!dob || !cutoff) return invalid;

  const dobOrder = dob.year * 10000 + dob.month * 100 + dob.day;
  const cutoffOrder = cutoff.year * 10000 + cutoff.month * 100 + cutoff.day;
  if (cutoffOrder < dobOrder) return invalid;

  let years = cutoff.year - dob.year;
  let months = cutoff.month - dob.month;
  let days = cutoff.day - dob.day;

  if (days < 0) {
    months -= 1;
    const prevMonth = cutoff.month === 1 ? 12 : cutoff.month - 1;
    const prevYear = cutoff.month === 1 ? cutoff.year - 1 : cutoff.year;
    days += daysInMonth(prevYear, prevMonth);
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const underMinimum18 = years < minAgeYears;
  const exceedsCustomMax = years > customMaxAgeYears || (years === customMaxAgeYears && (months > 0 || days > 0));
  const exceeds30 = years > 30 || (years === 30 && (months > 0 || days > 0));
  const exceeds32 = years > 32 || (years === 32 && (months > 0 || days > 0));

  const meetsGeneral30 = !underMinimum18 && !exceeds30 && !exceedsCustomMax;
  const meetsGovt32 = !underMinimum18 && !exceeds32;

  let status: AgeEligibilityResult['status'] = 'eligible';
  if (underMinimum18) {
    status = 'underage';
  } else if (meetsGeneral30) {
    status = 'eligible';
  } else if (meetsGovt32) {
    status = 'eligible_32_standard';
  } else {
    status = 'overage';
  }

  return {
    isValid: true,
    years,
    months,
    days,
    formattedEn: `${years} years, ${months} months, ${days} days`,
    formattedBn: `${years} বছর ${months} মাস ${days} দিন`,
    meetsGeneral30,
    meetsGovt32,
    underMinimum18,
    status,
  };
}

// ============================================================
// PHASE 2 & 3: BILINGUAL CIRCULAR REQUIREMENT PARSER & COMPARATOR
// ============================================================

export type EducationLevelRank = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type CriterionStatus =
  | 'Matched'
  | 'Failed'
  | 'Missing Profile Data'
  | 'Not Specified'
  | 'Needs Verification';

export type EligibilityVerdict =
  | 'ELIGIBLE'
  | 'NOT_ELIGIBLE'
  | 'MANUAL_REVIEW_REQUIRED'
  | 'INSUFFICIENT_PROFILE_DATA'
  | 'NEEDS_MANUAL_VERIFICATION'; // Retained for backward compatibility

export interface ParsedJobRequirements {
  minEducationLevel: 'SSC' | 'HSC' | 'Diploma' | 'Bachelor' | 'Honours' | 'Masters' | 'PhD' | null;
  requiredSubjects: string[];
  anySubjectAllowed: boolean;
  minGpa: number | null;
  gpaScale: 4 | 5 | null;
  minDivision: number | null; // 1 = 1st Class/Div, 2 = 2nd Class/Div, 3 = 3rd Class/Div
  minPassingYear: number | null;
  maxPassingYear: number | null;
  minAgeYears: number | null;
  maxAgeYears: number | null;
  ageCutoffDate: string | null;
  minExperienceYears: number | null;
  restrictedDistricts: string[];
  allDistrictsEligible: boolean;
  workLocation?: string;
  uncertainConditions: string[];
  hasExtractedAnyRequirement: boolean;
}

export type CriterionKey =
  | 'education'
  | 'ssc'
  | 'hsc'
  | 'graduation'
  | 'masters'
  | 'subject'
  | 'gpa'
  | 'passingYear'
  | 'age'
  | 'experience'
  | 'location'
  | 'conditions';

export interface EligibilityCriterionResult {
  key: CriterionKey;
  labelEn: string;
  labelBn: string;
  status: CriterionStatus;
  requirementText: string;
  profileValueText: string;
  reasonEn: string;
  reasonBn: string;
}

export interface CandidateAcademicOverview {
  highestLevel: string;
  highestDegreeTitle: string;
  highestGpaText: string;
  sscText: string;
  hscText: string;
  graduationText: string;
  mastersText: string;
  permanentDistrict: string;
  presentDistrict: string;
}

export interface FullEligibilityReport {
  overallStatus: EligibilityVerdict;
  parsedRequirements: ParsedJobRequirements;
  criteria: EligibilityCriterionResult[];
  candidateOverview: CandidateAcademicOverview;
  matchedCount: number;
  failedCount: number;
  needsVerificationCount: number;
  missingProfileCount: number;
  circularUrl: string;
  applicationUrl?: string | null;
  sourceName?: string;
  lastVerifiedAt?: number;
}

const BN_DIGIT_MAP: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

export function normalizeBengaliDigits(input: string): string {
  return String(input || '').replace(/[০-৯]/g, (ch) => BN_DIGIT_MAP[ch] ?? ch);
}

export const EDUCATION_RANK: Record<string, number> = {
  SSC: 1,
  HSC: 2,
  Diploma: 3,
  Bachelor: 4,
  Honours: 4,
  Graduation: 4,
  Masters: 5,
  PhD: 6,
};

export const SUBJECT_ALIAS_GROUPS: Array<{ canonical: string; patterns: RegExp[] }> = [
  {
    canonical: 'computer science',
    patterns: [
      /\bcse\b/i,
      /computer science/i,
      /computer engineering/i,
      /software engineering/i,
      /information technology/i,
      /\bict\b/i,
      /data science/i,
      /cyber security/i,
      /কম্পিউটার\s*সায়েন্স/i,
      /কম্পিউটার\s*প্রকৌশল/i,
      /তথ্য\s*ও\s*যোগাযোগ\s*প্রযুক্তি/i,
    ],
  },
  {
    canonical: 'electrical engineering',
    patterns: [
      /\beee\b/i,
      /electrical/i,
      /electronic/i,
      /\bece\b/i,
      /\bete\b/i,
      /telecommunication/i,
      /তড়িৎ/i,
      /ইলেকট্রিক্যাল/i,
      /ইলেকট্রনিক্স/i,
    ],
  },
  {
    canonical: 'civil engineering',
    patterns: [/\bcivil\b/i, /পুরকৌশল/i, /সিভিল\s*প্রকৌশল/i],
  },
  {
    canonical: 'mechanical engineering',
    patterns: [/\bmechanical\b/i, /যন্ত্রকৌশল/i, /মেকানিক্যাল/i],
  },
  {
    canonical: 'economics',
    patterns: [/\beconomics\b/i, /agricultural economics/i, /অর্থনীতি/i, /কৃষি\s*অর্থনীতি/i],
  },
  {
    canonical: 'accounting',
    patterns: [/\baccounting\b/i, /\bais\b/i, /হিসাববিজ্ঞান/i, /হিসাব\s*বিজ্ঞান/i],
  },
  {
    canonical: 'finance',
    patterns: [/\bfinance\b/i, /banking/i, /ফিন্যান্স/i, /ব্যাংকিং/i],
  },
  {
    canonical: 'management',
    patterns: [/\bmanagement\b/i, /\bhrm\b/i, /ব্যবস্থাপনা/i],
  },
  {
    canonical: 'business administration',
    patterns: [/\bbba\b/i, /\bmba\b/i, /business administration/i, /commerce/i, /বাণিজ্য/i, /ব্যবসায়\s*শিক্ষা/i, /ব্যবসায়\s*প্রশাসন/i],
  },
  {
    canonical: 'marketing',
    patterns: [/\bmarketing\b/i, /বিপণন/i],
  },
  {
    canonical: 'english',
    patterns: [/\benglish\b/i, /ইংরেজি/i],
  },
  {
    canonical: 'bangla',
    patterns: [/\bbangla\b/i, /bengali/i, /বাংলা/i, /বাংলা\s*ভাষা\s*ও\s*সাহিত্য/i],
  },
  {
    canonical: 'mathematics',
    patterns: [/\bmathematics\b/i, /\bmath\b/i, /applied mathematics/i, /গণিত/i, /ফলিত\s*গণিত/i],
  },
  {
    canonical: 'statistics',
    patterns: [/\bstatistics\b/i, /পরিসংখ্যান/i, /ফলিত\s*পরিসংখ্যান/i],
  },
  {
    canonical: 'physics',
    patterns: [/\bphysics\b/i, /applied physics/i, /পদার্থবিজ্ঞান/i, /ফলিত\s*পদার্থ/i],
  },
  {
    canonical: 'chemistry',
    patterns: [/\bchemistry\b/i, /applied chemistry/i, /biochemistry/i, /রসায়ন/i, /ফলিত\s*রসায়ন/i, /প্রাণরসায়ন/i],
  },
  {
    canonical: 'biology',
    patterns: [/\bbiology\b/i, /botany/i, /zoology/i, /microbiology/i, /উদ্ভিদবিজ্ঞান/i, /প্রাণিবিজ্ঞান/i, /অণুজীববিজ্ঞান/i],
  },
  {
    canonical: 'law',
    patterns: [/\bllb\b/i, /\bllm\b/i, /\blaw\b/i, /jurisprudence/i, /আইন/i],
  },
  {
    canonical: 'medical',
    patterns: [/\bmbbs\b/i, /\bbds\b/i, /medical/i, /doctor/i, /চিকিৎসা/i],
  },
  {
    canonical: 'pharmacy',
    patterns: [/\bb\.?\s*pharm\b/i, /\bm\.?\s*pharm\b/i, /\bpharmacy\b/i, /ফার্মেসি/i],
  },
  {
    canonical: 'agriculture',
    patterns: [/\bagriculture\b/i, /agronomy/i, /horticulture/i, /কৃষি/i],
  },
  {
    canonical: 'public administration',
    patterns: [/\bpublic administration\b/i, /লোকপ্রশাসন/i],
  },
  {
    canonical: 'international relations',
    patterns: [/\binternational relations\b/i, /আন্তর্জাতিক\s*সম্পর্ক/i],
  },
  {
    canonical: 'political science',
    patterns: [/\bpolitical science\b/i, /রাষ্ট্রবিজ্ঞান/i],
  },
  {
    canonical: 'sociology',
    patterns: [/\bsociology\b/i, /social work/i, /সমাজবিজ্ঞান/i, /সমাজকর্ম/i],
  },
];

export const BD_DISTRICTS_CANONICAL: Array<{ canonical: string; patterns: RegExp[] }> = [
  { canonical: 'Dhaka', patterns: [/\bdhaka\b/i, /ঢাকা/] },
  { canonical: 'Gazipur', patterns: [/\bgazipur\b/i, /গাজীপুর/] },
  { canonical: 'Narayanganj', patterns: [/\bnarayanganj\b/i, /নারায়ণগঞ্জ|নারায়ণগঞ্জ/] },
  { canonical: 'Chattogram', patterns: [/\bchattogram\b/i, /\bchittagong\b/i, /চট্টগ্রাম/] },
  { canonical: 'Rajshahi', patterns: [/\brajshahi\b/i, /রাজশাহী/] },
  { canonical: 'Khulna', patterns: [/\bkhulna\b/i, /খুলনা/] },
  { canonical: 'Sylhet', patterns: [/\bsylhet\b/i, /সিলেট/] },
  { canonical: 'Rangpur', patterns: [/\brangpur\b/i, /রংপুর/] },
  { canonical: 'Barishal', patterns: [/\bbarishal\b/i, /\bbarisal\b/i, /বরিশাল/] },
  { canonical: 'Mymensingh', patterns: [/\bmymensingh\b/i, /ময়মনসিংহ|ময়মনসিংহ/] },
  { canonical: 'Cumilla', patterns: [/\bcumilla\b/i, /\bcomilla\b/i, /কুমিল্লা/] },
  { canonical: 'Bogura', patterns: [/\bbogura\b/i, /\bbogra\b/i, /বগুড়া|বগুড়া/] },
  { canonical: 'Dinajpur', patterns: [/\bdinajpur\b/i, /দিনাজপুর/] },
  { canonical: 'Jashore', patterns: [/\bjashore\b/i, /\bjessore\b/i, /যশোর/] },
  { canonical: 'Pabna', patterns: [/\bpabna\b/i, /পাবনা/] },
  { canonical: 'Faridpur', patterns: [/\bfaridpur\b/i, /ফরিদপুর/] },
  { canonical: 'Coxs Bazar', patterns: [/\bcox'?s\s*bazar\b/i, /কক্সবাজার|কক্স\s*বাজার/] },
];

/**
 * Normalizes raw secondary/higher secondary group codes (like '1', '2', '3') from Teletalk forms
 * into clear, readable academic subject/group names.
 */
export function normalizeAcademicSubjectName(
  raw?: string | null,
  contextLevel?: 'SSC' | 'HSC' | 'Higher'
): string {
  if (!raw) return '';
  const str = String(raw).trim();
  if (!str || str === '0') return '';

  if (contextLevel === 'SSC' || contextLevel === 'HSC') {
    if (str === '1' || str === '01' || /^science$/i.test(str) || /বিজ্ঞান/i.test(str)) {
      return 'Science';
    }
    if (str === '2' || str === '02' || /^humanities$/i.test(str) || /^arts$/i.test(str) || /মানবিক/i.test(str)) {
      return 'Humanities';
    }
    if (str === '3' || str === '03' || /^commerce$/i.test(str) || /business/i.test(str) || /ব্যবসায়/i.test(str) || /বাণিজ্য/i.test(str)) {
      return 'Business Studies';
    }
    if (str === '4' || str === '04' || /vocational/i.test(str) || /ভোকেশনাল/i.test(str)) {
      return 'Vocational';
    }
    if (str === '5' || str === '05' || /madrasah/i.test(str) || /দাখিল/i.test(str) || /আলিম/i.test(str)) {
      return 'General (Madrasah)';
    }
  }

  // Higher degree numeric code fallback
  if (str === '1' || str === '01') return 'Science / General';
  if (str === '2' || str === '02') return 'Humanities / Arts';
  if (str === '3' || str === '03') return 'Commerce / Business';

  return str;
}

/**
 * Parses job requirements safely without fabricating conditions or confusing work sites with applicant residence quotas.
 */
export function extractJobRequirements(job: Partial<NormalizedJobCircular>): ParsedJobRequirements {
  const combinedRaw = [
    job.qualification,
    job.ageRequirement,
    job.experience,
    ...(Array.isArray(job.requirements) ? job.requirements : []),
    job.description,
    job.location,
    job.position,
    job.jobTitle,
  ]
    .filter(Boolean)
    .join(' | ');
  const text = normalizeBengaliDigits(combinedRaw);
  const lower = text.toLowerCase();

  // 1. Minimum Education Level
  let minEducationLevel: ParsedJobRequirements['minEducationLevel'] = null;
  if (/\bphd\b|পিএইচডি|ডক্টরেট/i.test(text)) {
    minEducationLevel = 'PhD';
  } else if (/\bmasters?\b|\bm\.?\s?sc\b|\bm\.?\s?a\b|\bmba\b|\bm\.?\s?com\b|স্নাতকোত্তর|মাস্টার্স|কামিল/i.test(text)) {
    minEducationLevel = 'Masters';
  } else if (
    /\bbachelor\b|\bhonours?\b|\bhonors?\b|\bgraduate\b|\bgraduation\b|\bb\.?\s?sc\b|\bb\.?\s?a\b|\bb\.?\s?com\b|\bbba\b|\bllb\b|\bmbbs\b|স্নাতক|অনার্স|ডিগ্রি|ফাজিল/i.test(
      text
    )
  ) {
    minEducationLevel = 'Bachelor';
  } else if (/\bdiploma\b|ডিপ্লোমা/i.test(text)) {
    minEducationLevel = 'Diploma';
  } else if (/\bhsc\b|higher secondary|এইচএসসি|উচ্চ\s*মাধ্যমিক|আলিম/i.test(text)) {
    minEducationLevel = 'HSC';
  } else if (/\bssc\b|secondary school|এসএসসি|মাধ্যমিক|দাখিল/i.test(text)) {
    minEducationLevel = 'SSC';
  } else if (job.qualification && job.qualification !== 'Any Qualification') {
    const q = job.qualification.trim();
    if (q === 'Honours' || q === 'Bachelor') {
      minEducationLevel = 'Bachelor';
    } else if (EDUCATION_RANK[q]) {
      minEducationLevel = q as NonNullable<ParsedJobRequirements['minEducationLevel']>;
    }
  }

  // 2. Subject extraction
  const anySubjectPhrase = /any discipline|any subject|যেকোনো বিষয়|যেকোনো বিভাগ|সকল বিভাগ|যে কোনো বিষয়|যেকোনো শাখায়/i.test(text);
  const requiredSubjects: string[] = [];
  if (!anySubjectPhrase) {
    for (const grp of SUBJECT_ALIAS_GROUPS) {
      if (grp.patterns.some((rx) => rx.test(text))) {
        requiredSubjects.push(grp.canonical);
      }
    }
  }

  // 3. Minimum GPA / CGPA threshold & Division
  let minGpa: number | null = null;
  let gpaScale: 4 | 5 | null = null;
  let minDivision: number | null = null;

  // Prefer explicit properties from NormalizedJobCircular if provided
  if (typeof job.minCgpa === 'number' && job.minCgpa > 0) {
    minGpa = job.minCgpa;
    gpaScale = 4;
  } else if (typeof job.minGpa === 'number' && job.minGpa > 0) {
    minGpa = job.minGpa;
    gpaScale = job.minGpa > 4 ? 5 : 4;
  }

  if (minGpa === null) {
    const cgpaMatch = text.match(
      /(?:cgpa|সিজিপিএ)\s*[:\-]?\s*(?:minimum|min|at least|ন্যূনতম|কমপক্ষে)?\s*([1-4](?:\.\d{1,2})?)/i
    );
    if (cgpaMatch) {
      const val = parseFloat(cgpaMatch[1]);
      if (Number.isFinite(val) && val > 0 && val <= 4.0) {
        minGpa = val;
        gpaScale = 4;
      }
    }
  }

  if (minGpa === null) {
    const gpaMatch = text.match(
      /(?:gpa|জিপিএ)\s*[:\-]?\s*(?:minimum|min|at least|ন্যূনতম|কমপক্ষে)?\s*([1-5](?:\.\d{1,2})?)/i
    );
    if (gpaMatch) {
      const val = parseFloat(gpaMatch[1]);
      if (Number.isFinite(val) && val > 0 && val <= 5.0) {
        minGpa = val;
        if (/out of 5|৫\.০০|5\.00/i.test(text) || val > 4) {
          gpaScale = 5;
        } else if (/out of 4|৪\.০০|4\.00/i.test(text)) {
          gpaScale = 4;
        } else {
          gpaScale = val > 4 ? 5 : 4;
        }
      }
    }
  }

  // Division / Class mentions (e.g. "কমপক্ষে ২য় শ্রেণি বা সমমানের সিজিপিএ")
  if (
    /(?:1st|[১1](?:st|ম)?)\s*(?:class|division|শ্রেণি|বিভাগ)|first\s*(?:class|division)|প্রথম\s*(?:শ্রেণি|বিভাগ)/i.test(
      text
    )
  ) {
    minDivision = 1;
    if (minGpa === null) {
      minGpa = 3.0;
      gpaScale = 4;
    }
  } else if (
    /(?:2nd|[২2](?:nd|য়|য়)?)\s*(?:class|division|শ্রেণি|বিভাগ)|second\s*(?:class|division)|দ্বিতীয়\s*(?:শ্রেণি|বিভাগ)/i.test(
      text
    )
  ) {
    minDivision = 2;
    if (minGpa === null) {
      minGpa = 2.25;
      gpaScale = 4;
    }
  } else if (
    /(?:3rd|[৩3](?:rd|য়|য়)?)\s*(?:class|division|শ্রেণি|বিভাগ)|third\s*(?:class|division)|তৃতীয়\s*(?:শ্রেণি|বিভাগ)/i.test(
      text
    )
  ) {
    minDivision = 3;
    if (minGpa === null) {
      minGpa = 2.0;
      gpaScale = 4;
    }
  }

  // 4. Passing year constraints
  let minPassingYear: number | null = null;
  let maxPassingYear: number | null = null;
  const passAfterMatch = text.match(/(?:passing year|passed in|উত্তীর্ণ).*?(20\d{2})\s*(?:or later|onwards|এর পর|পরবর্তী)/i);
  if (passAfterMatch) {
    minPassingYear = Number(passAfterMatch[1]);
  } else {
    const passExactMatch = text.match(/(?:passed in|উত্তীর্ণ(?:র)?\s*সাল)\s*[:\-]?\s*(20\d{2})/i);
    if (passExactMatch) {
      minPassingYear = Number(passExactMatch[1]);
      maxPassingYear = Number(passExactMatch[1]);
    }
  }

  // 5. Age Limits & Cutoff Date
  let minAgeYears: number | null = null;
  let maxAgeYears: number | null = null;
  let ageCutoffDate: string | null = null;
  const ageSrc = normalizeBengaliDigits(
    [job.ageRequirement, ...(job.requirements || []), job.description].filter(Boolean).join(' ')
  );

  const rangeMatch = ageSrc.match(/\b(1[6-9]|2[0-9])\s*(?:-|to|থেকে)\s*(2[5-9]|3[0-9]|4[0-5])\b/i);
  if (rangeMatch) {
    minAgeYears = Number(rangeMatch[1]);
    maxAgeYears = Number(rangeMatch[2]);
  } else {
    const maxMatch = ageSrc.match(
      /(?:max(?:imum)?\s*age|up to|not exceeding|অনূর্ধ্ব|সর্বোচ্চ\s*বয়স)\s*[:\-]?\s*(2[0-9]|3[0-9]|4[0-5])/i
    );
    if (maxMatch) {
      maxAgeYears = Number(maxMatch[1]);
    }
    const minMatch = ageSrc.match(/(?:min(?:imum)?\s*age|সর্বনিম্ন\s*বয়স)\s*[:\-]?\s*(1[6-9]|2[0-5])/i);
    if (minMatch) {
      minAgeYears = Number(minMatch[1]);
    }
  }

  const cutoffMatch = ageSrc.match(
    /(?:as on|cutoff|তারিখ পর্যন্ত|তারিখে বয়স)\s*[:\-]?\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})/i
  );
  if (cutoffMatch) {
    const parsedCut = parseFlexibleDateString(cutoffMatch[1]);
    if (parsedCut) ageCutoffDate = formatIsoCalendarDate(parsedCut);
  } else if (job.deadlineAt) {
    const dParsed = parseFlexibleDateString(job.deadlineAt);
    if (dParsed) ageCutoffDate = formatIsoCalendarDate(dParsed);
  }

  // 6. Experience Years
  let minExperienceYears: number | null = null;
  const expText = normalizeBengaliDigits(
    [job.experience, ...(job.requirements || []), job.description].filter(Boolean).join(' ')
  );
  if (/no experience|freshers|fresh graduate|অভিজ্ঞতার প্রয়োজন নেই|অভিজ্ঞতা নিষ্প্রয়োজন/i.test(expText)) {
    minExperienceYears = 0;
  } else {
    const expMatch = expText.match(
      /(\d+(?:\.\d+)?)\s*(?:\+\s*)?(?:years?|yrs?|বছর(?:ের)?)\s*(?:of\s*)?(?:experience|অভিজ্ঞতা|চাকরি)/i
    );
    if (expMatch) {
      minExperienceYears = parseFloat(expMatch[1]);
    }
  }

  // 7. Location: Work Location vs Candidate District Quota
  const workLocation = (job.location || 'All Bangladesh').trim();
  const descRequirementsText = normalizeBengaliDigits(
    [...(job.requirements || []), job.description].filter(Boolean).join(' ')
  );

  // Check for EXPLICIT applicant residence restrictions (not merely work location!)
  const hasExplicitQuotaClause =
    /only candidates from|শুধুমাত্র.*জেলার|নিজ জেলা.*হতে হবে|যে সকল জেলার প্রার্থীগণ আবেদন করতে পারবেন|eligible districts|জেলা কোটা প্রযোজ্য/i.test(
      descRequirementsText
    );

  const restrictedDistricts: string[] = [];
  let allDistrictsEligible = true;

  if (hasExplicitQuotaClause) {
    allDistrictsEligible = false;
    for (const d of BD_DISTRICTS_CANONICAL) {
      if (d.patterns.some((rx) => rx.test(descRequirementsText))) {
        restrictedDistricts.push(d.canonical);
      }
    }
    if (restrictedDistricts.length === 0) {
      allDistrictsEligible = true;
    }
  } else {
    allDistrictsEligible = true;
  }

  // 8. Uncertain Conditions (Quotas, Disability, Departmental, Refer-to-Circular)
  const uncertainConditions: string[] = [];
  // Exclude "জেলা কোটা" (district quota) which is already evaluated directly via restrictedDistricts
  const textWithoutDistrictQuota = lower.replace(/জেলা\s*কোটা|district\s*quota/g, '');
  if (
    /freedom fighter|মুক্তিযোদ্ধা|tribal|উপজাতি|ansar|আনসার|orphan|এতিম|শহীদ\s*মুক্তিযোদ্ধা/i.test(lower) ||
    /quota|কোটা/i.test(textWithoutDistrictQuota)
  ) {
    uncertainConditions.push('কোটা নীতিমালা (মুক্তিযোদ্ধা/ক্ষুদ্র নৃ-গোষ্ঠী/আনসার) মূল বিজ্ঞপ্তি থেকে প্রযোজ্য');
  }
  if (/disabilit|প্রতিবন্ধী/i.test(lower)) {
    uncertainConditions.push('প্রতিবন্ধী প্রার্থীদের জন্য প্রযোজ্য শর্তাবলি যাচাই করুন');
  }
  if (/departmental|বিভাগীয় প্রার্থী/i.test(lower)) {
    uncertainConditions.push('বিভাগীয় প্রার্থীদের ক্ষেত্রে প্রযোজ্য শর্ত ও বয়স শিথিলতা');
  }
  if (/see circular|বিজ্ঞপ্তি দেখুন|শর্তাবলি প্রযোজ্য/i.test(lower)) {
    uncertainConditions.push('বিজ্ঞপ্তিতে উল্লেখিত বিশেষ শর্তাবলি প্রযোজ্য');
  }

  const hasExtractedAnyRequirement = Boolean(
    minEducationLevel ||
      requiredSubjects.length > 0 ||
      minGpa !== null ||
      minDivision !== null ||
      minPassingYear !== null ||
      minAgeYears !== null ||
      maxAgeYears !== null ||
      restrictedDistricts.length > 0
  );

  return {
    minEducationLevel,
    requiredSubjects,
    anySubjectAllowed: anySubjectPhrase,
    minGpa,
    gpaScale,
    minDivision,
    minPassingYear,
    maxPassingYear,
    minAgeYears,
    maxAgeYears,
    ageCutoffDate,
    minExperienceYears,
    restrictedDistricts,
    allDistrictsEligible,
    workLocation,
    uncertainConditions,
    hasExtractedAnyRequirement,
  };
}

export interface CandidateEducationRecord {
  level: string;
  degreeTitle: string;
  subjectOrGroup: string;
  normalizedSubject: string;
  gpa: number | null;
  gpaScale: number;
  resultType: string;
  passingYear: number | null;
  institution: string;
}

export interface CandidateEducationProfile {
  highestLevel: string | null;
  highestRank: number;
  highestDegreeName: string;
  records: CandidateEducationRecord[];
  allNormalizedSubjects: string[];
  passingYears: number[];
  overview: CandidateAcademicOverview;
}

export function resolveApplicantEducationProfile(profile: UserProfile): CandidateEducationProfile {
  let highestLevel: string | null = null;
  let highestRank = 0;
  let highestDegreeName = '';
  const records: CandidateEducationRecord[] = [];
  const allNormalizedSubjects: string[] = [];
  const passingYears: number[] = [];

  // 1. SSC
  if (
    profile.ssc &&
    (profile.ssc.rollNumber?.trim() ||
      profile.ssc.registrationNumber?.trim() ||
      profile.ssc.gpa?.trim() ||
      profile.ssc.passingYear?.trim() ||
      profile.ssc.institution?.trim())
  ) {
    const rawSubj = profile.ssc.groupSubject?.trim() || '';
    const normSubj = normalizeAcademicSubjectName(rawSubj, 'SSC');
    const gpaNum = parseFloat(normalizeBengaliDigits(profile.ssc.gpa || ''));
    const yr = parseInt(normalizeBengaliDigits(profile.ssc.passingYear || ''), 10);
    const rec: CandidateEducationRecord = {
      level: 'SSC',
      degreeTitle: profile.ssc.examination?.trim() || 'SSC',
      subjectOrGroup: normSubj || rawSubj || 'Science',
      normalizedSubject: normSubj || rawSubj || 'Science',
      gpa: Number.isFinite(gpaNum) && gpaNum > 0 ? gpaNum : null,
      gpaScale: 5.0,
      resultType: profile.ssc.resultType || 'GPA (out of 5)',
      passingYear: Number.isFinite(yr) && yr >= 1970 && yr <= 2100 ? yr : null,
      institution: profile.ssc.institution?.trim() || '',
    };
    records.push(rec);
    if (rec.normalizedSubject) allNormalizedSubjects.push(rec.normalizedSubject.toLowerCase());
    if (rec.passingYear) passingYears.push(rec.passingYear);
    if (EDUCATION_RANK.SSC > highestRank) {
      highestRank = EDUCATION_RANK.SSC;
      highestLevel = 'SSC';
      highestDegreeName = rec.degreeTitle;
    }
  }

  // 2. HSC
  if (
    profile.hsc &&
    (profile.hsc.rollNumber?.trim() ||
      profile.hsc.registrationNumber?.trim() ||
      profile.hsc.gpa?.trim() ||
      profile.hsc.passingYear?.trim() ||
      profile.hsc.institution?.trim())
  ) {
    const rawSubj = profile.hsc.groupSubject?.trim() || '';
    const normSubj = normalizeAcademicSubjectName(rawSubj, 'HSC');
    const gpaNum = parseFloat(normalizeBengaliDigits(profile.hsc.gpa || ''));
    const yr = parseInt(normalizeBengaliDigits(profile.hsc.passingYear || ''), 10);
    const rec: CandidateEducationRecord = {
      level: 'HSC',
      degreeTitle: profile.hsc.examination?.trim() || 'HSC',
      subjectOrGroup: normSubj || rawSubj || 'Science',
      normalizedSubject: normSubj || rawSubj || 'Science',
      gpa: Number.isFinite(gpaNum) && gpaNum > 0 ? gpaNum : null,
      gpaScale: 5.0,
      resultType: profile.hsc.resultType || 'GPA (out of 5)',
      passingYear: Number.isFinite(yr) && yr >= 1970 && yr <= 2100 ? yr : null,
      institution: profile.hsc.institution?.trim() || '',
    };
    records.push(rec);
    if (rec.normalizedSubject) allNormalizedSubjects.push(rec.normalizedSubject.toLowerCase());
    if (rec.passingYear) passingYears.push(rec.passingYear);
    if (EDUCATION_RANK.HSC > highestRank) {
      highestRank = EDUCATION_RANK.HSC;
      highestLevel = 'HSC';
      highestDegreeName = rec.degreeTitle;
    }
  }

  // 3. Graduation / Bachelor / Honours / Diploma
  if (
    profile.hasGraduation &&
    profile.graduation &&
    (profile.graduation.universityInstitute?.trim() ||
      profile.graduation.subjectDegree?.trim() ||
      profile.graduation.gpa?.trim() ||
      profile.graduation.passingYear?.trim())
  ) {
    const examLower = `${profile.graduation.examination || ''} ${profile.graduation.subjectDegree || ''}`.toLowerCase();
    const isDiploma = examLower.includes('diploma') && !examLower.includes('post graduate');
    const levelName = isDiploma ? 'Diploma' : 'Bachelor';
    const rank = isDiploma ? EDUCATION_RANK.Diploma : EDUCATION_RANK.Bachelor;

    const rawSubj = profile.graduation.subjectDegree?.trim() || '';
    const normSubj = normalizeAcademicSubjectName(rawSubj, 'Higher');
    const gpaNum = parseFloat(normalizeBengaliDigits(profile.graduation.gpa || ''));
    const scaleNum = parseFloat(normalizeBengaliDigits(profile.graduation.gpaScale || ''));
    const yr = parseInt(normalizeBengaliDigits(profile.graduation.passingYear || ''), 10);

    const rec: CandidateEducationRecord = {
      level: levelName,
      degreeTitle: profile.graduation.examination?.trim() || (isDiploma ? 'Diploma' : 'Bachelor / Honours'),
      subjectOrGroup: normSubj || rawSubj || '',
      normalizedSubject: normSubj || rawSubj || '',
      gpa: Number.isFinite(gpaNum) && gpaNum > 0 ? gpaNum : null,
      gpaScale: Number.isFinite(scaleNum) && scaleNum > 0 ? scaleNum : 4.0,
      resultType: profile.graduation.resultType || 'CGPA (out of 4)',
      passingYear: Number.isFinite(yr) && yr >= 1970 && yr <= 2100 ? yr : null,
      institution: profile.graduation.universityInstitute?.trim() || profile.graduation.college?.trim() || '',
    };
    records.push(rec);
    if (rec.normalizedSubject) allNormalizedSubjects.push(rec.normalizedSubject.toLowerCase());
    if (rec.passingYear) passingYears.push(rec.passingYear);
    if (rank > highestRank) {
      highestRank = rank;
      highestLevel = levelName;
      highestDegreeName = rec.degreeTitle;
    }
  }

  // 4. Masters / PhD
  if (
    profile.hasMasters &&
    profile.masters &&
    (profile.masters.universityInstitute?.trim() ||
      profile.masters.subjectDegree?.trim() ||
      profile.masters.gpa?.trim() ||
      profile.masters.passingYear?.trim())
  ) {
    const mLower = `${profile.masters.examination || ''} ${profile.masters.subjectDegree || ''}`.toLowerCase();
    const isPhd = mLower.includes('phd') || mLower.includes('doctorate');
    const levelName = isPhd ? 'PhD' : 'Masters';
    const rank = isPhd ? EDUCATION_RANK.PhD : EDUCATION_RANK.Masters;

    const rawSubj = profile.masters.subjectDegree?.trim() || '';
    const normSubj = normalizeAcademicSubjectName(rawSubj, 'Higher');
    const gpaNum = parseFloat(normalizeBengaliDigits(profile.masters.gpa || ''));
    const scaleNum = parseFloat(normalizeBengaliDigits(profile.masters.gpaScale || ''));
    const yr = parseInt(normalizeBengaliDigits(profile.masters.passingYear || ''), 10);

    const rec: CandidateEducationRecord = {
      level: levelName,
      degreeTitle: profile.masters.examination?.trim() || (isPhd ? 'PhD' : 'Masters'),
      subjectOrGroup: normSubj || rawSubj || '',
      normalizedSubject: normSubj || rawSubj || '',
      gpa: Number.isFinite(gpaNum) && gpaNum > 0 ? gpaNum : null,
      gpaScale: Number.isFinite(scaleNum) && scaleNum > 0 ? scaleNum : 4.0,
      resultType: profile.masters.resultType || 'CGPA (out of 4)',
      passingYear: Number.isFinite(yr) && yr >= 1970 && yr <= 2100 ? yr : null,
      institution: profile.masters.universityInstitute?.trim() || '',
    };
    records.push(rec);
    if (rec.normalizedSubject) allNormalizedSubjects.push(rec.normalizedSubject.toLowerCase());
    if (rec.passingYear) passingYears.push(rec.passingYear);
    if (rank > highestRank) {
      highestRank = rank;
      highestLevel = levelName;
      highestDegreeName = rec.degreeTitle;
    }
  }

  // Candidate academic overview formatting
  const sscRec = records.find((r) => r.level === 'SSC');
  const hscRec = records.find((r) => r.level === 'HSC');
  const gradRec = records.find((r) => r.level === 'Bachelor' || r.level === 'Diploma');
  const mastRec = records.find((r) => r.level === 'Masters' || r.level === 'PhD');

  const sscText = sscRec
    ? `GPA ${sscRec.gpa?.toFixed(2) ?? 'N/A'}/5.00 (${sscRec.subjectOrGroup})`
    : 'Not Recorded';
  const hscText = hscRec
    ? `GPA ${hscRec.gpa?.toFixed(2) ?? 'N/A'}/5.00 (${hscRec.subjectOrGroup})`
    : 'Not Recorded';
  const graduationText = gradRec
    ? `${gradRec.degreeTitle}: ${gradRec.subjectOrGroup || 'General'} (CGPA ${gradRec.gpa?.toFixed(2) ?? 'N/A'}/${gradRec.gpaScale.toFixed(1)})`
    : 'Not Recorded';
  const mastersText = mastRec
    ? `${mastRec.degreeTitle}: ${mastRec.subjectOrGroup || 'General'} (CGPA ${mastRec.gpa?.toFixed(2) ?? 'N/A'}/${mastRec.gpaScale.toFixed(1)})`
    : 'Not Recorded';

  const highestGpaRec = mastRec?.gpa ? mastRec : gradRec?.gpa ? gradRec : hscRec?.gpa ? hscRec : sscRec;
  const highestGpaText = highestGpaRec
    ? `${highestGpaRec.level}: ${highestGpaRec.gpa?.toFixed(2)} (/${highestGpaRec.gpaScale.toFixed(1)})`
    : 'No GPA';

  const overview: CandidateAcademicOverview = {
    highestLevel: highestLevel || 'None',
    highestDegreeTitle: highestDegreeName || 'No Degree Recorded',
    highestGpaText,
    sscText,
    hscText,
    graduationText,
    mastersText,
    permanentDistrict: (profile.address?.permanent?.district || '').trim(),
    presentDistrict: (profile.address?.present?.district || '').trim(),
  };

  return {
    highestLevel,
    highestRank,
    highestDegreeName,
    records,
    allNormalizedSubjects,
    passingYears,
    overview,
  };
}

function estimateExperienceYears(profile: UserProfile): number {
  if (!profile.hasJobExperience || !Array.isArray(profile.jobExperiences) || profile.jobExperiences.length === 0) {
    return 0;
  }
  let totalDays = 0;
  const now = Date.now();
  for (const exp of profile.jobExperiences) {
    const startTs = exp.startDate ? Date.parse(exp.startDate) : NaN;
    const endTs = exp.currentlyWorking ? now : exp.endDate ? Date.parse(exp.endDate) : NaN;
    if (Number.isFinite(startTs) && Number.isFinite(endTs) && endTs > startTs) {
      totalDays += (endTs - startTs) / 86_400_000;
    }
  }
  return Number((totalDays / 365.25).toFixed(2));
}

function matchProfileSubjectToRequirement(
  candidateRecords: CandidateEducationRecord[],
  requiredCanonicalSubjects: string[]
): { isMatched: boolean; matchedRequirement: string; matchedProfileSubject: string } {
  const higherRecords = candidateRecords.filter((r) => r.level === 'Bachelor' || r.level === 'Masters' || r.level === 'Diploma');
  const targetRecords = higherRecords.length > 0 ? higherRecords : candidateRecords;

  for (const reqCanon of requiredCanonicalSubjects) {
    const grp = SUBJECT_ALIAS_GROUPS.find((g) => g.canonical === reqCanon);

    for (const rec of targetRecords) {
      const combined = `${rec.degreeTitle} ${rec.subjectOrGroup} ${rec.normalizedSubject}`.toLowerCase();
      if (grp && grp.patterns.some((rx) => rx.test(combined))) {
        return { isMatched: true, matchedRequirement: reqCanon, matchedProfileSubject: rec.subjectOrGroup || rec.degreeTitle };
      }
      if (combined.includes(reqCanon.toLowerCase())) {
        return { isMatched: true, matchedRequirement: reqCanon, matchedProfileSubject: rec.subjectOrGroup || rec.degreeTitle };
      }
    }
  }

  return { isMatched: false, matchedRequirement: requiredCanonicalSubjects.join(', '), matchedProfileSubject: '' };
}

/**
 * Evaluates candidate eligibility strictly from saved profile fields and extracted (or manually corrected) requirements.
 */
export function evaluateProfileEligibility(
  profile: UserProfile,
  job: Partial<NormalizedJobCircular>,
  manualOverride?: Partial<ParsedJobRequirements>
): FullEligibilityReport {
  const extracted = extractJobRequirements(job);
  const reqs: ParsedJobRequirements = {
    ...extracted,
    ...manualOverride,
  };

  const eduProfile = resolveApplicantEducationProfile(profile);
  const criteria: EligibilityCriterionResult[] = [];

  // ============================================================
  // 1. MINIMUM OVERALL EDUCATION LEVEL
  // ============================================================
  if (!reqs.minEducationLevel) {
    criteria.push({
      key: 'education',
      labelEn: 'Minimum Education Level',
      labelBn: 'ন্যূনতম শিক্ষাগত যোগ্যতা',
      status: 'Matched',
      requirementText: 'Any Qualification (কোনো নির্দিষ্ট স্তর বাধ্য নয়)',
      profileValueText: eduProfile.highestLevel ? `${eduProfile.highestLevel} (${eduProfile.highestDegreeName})` : 'Not provided',
      reasonEn: 'No strict minimum education level required; all qualification levels are acceptable.',
      reasonBn: 'বিজ্ঞপ্তিতে কোনো নির্দিষ্ট ন্যূনতম স্তর নির্ধারণ করা হয়নি; যেকোনো যোগ্যতায় আবেদনযোগ্য।',
    });
  } else if (!eduProfile.highestLevel) {
    criteria.push({
      key: 'education',
      labelEn: 'Minimum Education Level',
      labelBn: 'ন্যূনতম শিক্ষাগত যোগ্যতা',
      status: 'Missing Profile Data',
      requirementText: `Minimum ${reqs.minEducationLevel}`,
      profileValueText: 'Missing education records in profile',
      reasonEn: `Profile has no saved education records to verify against required ${reqs.minEducationLevel}.`,
      reasonBn: `প্রয়োজনীয় ${reqs.minEducationLevel} যাচাইয়ের জন্য প্রোফাইলে কোনো শিক্ষাগত তথ্য নেই।`,
    });
  } else {
    const reqRank = EDUCATION_RANK[reqs.minEducationLevel] || 4;
    const ok = eduProfile.highestRank >= reqRank;
    criteria.push({
      key: 'education',
      labelEn: 'Minimum Education Level',
      labelBn: 'ন্যূনতম শিক্ষাগত যোগ্যতা',
      status: ok ? 'Matched' : 'Failed',
      requirementText: `Minimum ${reqs.minEducationLevel}`,
      profileValueText: `${eduProfile.highestLevel} (${eduProfile.highestDegreeName})`,
      reasonEn: ok
        ? `Education level (${eduProfile.highestLevel}) satisfies minimum ${reqs.minEducationLevel}.`
        : `Requires ${reqs.minEducationLevel}, but highest profile qualification is ${eduProfile.highestLevel}.`,
      reasonBn: ok
        ? `আপনার শিক্ষাগত স্তর (${eduProfile.highestLevel}) বিজ্ঞপ্তির ন্যূনতম ${reqs.minEducationLevel} শর্ত পূরণ করে।`
        : `বিজ্ঞপ্তিতে ${reqs.minEducationLevel} প্রয়োজন, কিন্তু প্রোফাইলে সর্বোচ্চ যোগ্যতা ${eduProfile.highestLevel}।`,
    });
  }

  // ============================================================
  // 2. DEGREE SUBJECT / DISCIPLINE MATCHING
  // ============================================================
  const gradOrMastersRec = eduProfile.records.find((r) => r.level === 'Bachelor' || r.level === 'Masters');
  const candidateSubjectDisplay = gradOrMastersRec
    ? `${gradOrMastersRec.degreeTitle} in ${gradOrMastersRec.subjectOrGroup || 'General'}`
    : eduProfile.records.map((r) => `${r.level}: ${r.subjectOrGroup}`).join(', ') || 'No subject logged';

  if (reqs.requiredSubjects.length === 0 || reqs.anySubjectAllowed) {
    criteria.push({
      key: 'subject',
      labelEn: 'Academic Subject / Discipline',
      labelBn: 'বিষয় / বিভাগ',
      status: 'Matched',
      requirementText: 'Any Discipline / Open (উন্মুক্ত)',
      profileValueText: candidateSubjectDisplay,
      reasonEn: 'Open to candidates from all disciplines; no specific field restricted.',
      reasonBn: 'যেকোনো বিভাগ বা বিষয়ে ডিগ্রিধারী প্রার্থী আবেদন করতে পারবেন।',
    });
  } else if (eduProfile.records.length === 0) {
    criteria.push({
      key: 'subject',
      labelEn: 'Academic Subject / Discipline',
      labelBn: 'বিষয় / বিভাগ',
      status: 'Missing Profile Data',
      requirementText: reqs.requiredSubjects.join(' / '),
      profileValueText: 'Missing subject in profile',
      reasonEn: `Circular requires ${reqs.requiredSubjects.join(' / ')}; update Education section.`,
      reasonBn: `বিজ্ঞপ্তিতে ${reqs.requiredSubjects.join(' / ')} চাওয়া হয়েছে; প্রোফাইলে বিষয় যোগ করুন।`,
    });
  } else {
    const subjMatch = matchProfileSubjectToRequirement(eduProfile.records, reqs.requiredSubjects);
    criteria.push({
      key: 'subject',
      labelEn: 'Academic Subject / Discipline',
      labelBn: 'বিষয় / বিভাগ',
      status: subjMatch.isMatched ? 'Matched' : 'Failed',
      requirementText: reqs.requiredSubjects.join(' / '),
      profileValueText: candidateSubjectDisplay,
      reasonEn: subjMatch.isMatched
        ? `Academic discipline (${subjMatch.matchedProfileSubject}) matches required ${reqs.requiredSubjects.join(' / ')}.`
        : `Candidate's discipline (${candidateSubjectDisplay}) does not match required ${reqs.requiredSubjects.join(' / ')}.`,
      reasonBn: subjMatch.isMatched
        ? `আপনার বিষয় (${subjMatch.matchedProfileSubject}) বিজ্ঞপ্তির শর্ত (${reqs.requiredSubjects.join(' / ')}) পূরণ করে।`
        : `আপনার বিষয় (${candidateSubjectDisplay}) বিজ্ঞপ্তির কাঙ্ক্ষিত বিষয় (${reqs.requiredSubjects.join(' / ')}) অনুযায়ী মেলেনি।`,
    });
  }

  // ============================================================
  // 3. GPA / CGPA & DIVISION EVALUATION
  // ============================================================
  const relevantGradOrMasters = eduProfile.records.find((r) => r.level === 'Bachelor' || r.level === 'Masters');
  const relevantRecordForGpa = relevantGradOrMasters || eduProfile.records[0];

  if (reqs.minGpa === null && reqs.minDivision === null) {
    criteria.push({
      key: 'gpa',
      labelEn: 'GPA / CGPA / Division',
      labelBn: 'জিপিএ / সিজিপিএ / শ্রেণি',
      status: 'Matched',
      requirementText: 'Passing Grade (পাস বা সমমান)',
      profileValueText: relevantRecordForGpa?.gpa
        ? `${relevantRecordForGpa.level}: ${relevantRecordForGpa.gpa.toFixed(2)} (/${relevantRecordForGpa.gpaScale.toFixed(1)})`
        : 'Result not logged',
      reasonEn: 'No specific minimum GPA or class threshold mandated.',
      reasonBn: 'নির্দিষ্ট কোনো ন্যূনতম জিপিএ বা শ্রেণি উল্লেখ নেই; সাধারণ পাস থাকলেই যোগ্য।',
    });
  } else if (!relevantRecordForGpa || relevantRecordForGpa.gpa === null) {
    criteria.push({
      key: 'gpa',
      labelEn: 'GPA / CGPA / Division',
      labelBn: 'জিপিএ / সিজিপিএ / শ্রেণি',
      status: 'Missing Profile Data',
      requirementText: `Min ${reqs.minGpa?.toFixed(2) ?? '2nd Class'}`,
      profileValueText: 'Missing GPA in profile',
      reasonEn: `Enter your GPA/CGPA in Education to verify minimum ${reqs.minGpa?.toFixed(2) ?? 'class'} requirement.`,
      reasonBn: `ন্যূনতম ফলাফল যাচাই করতে প্রোফাইলের শিক্ষাগত তথ্যে GPA/CGPA দিন।`,
    });
  } else {
    // Check against candidate GPA
    const candGpa = relevantRecordForGpa.gpa;
    const requiredGpa = reqs.minGpa ?? 2.25;
    const ok = candGpa >= requiredGpa;

    criteria.push({
      key: 'gpa',
      labelEn: 'GPA / CGPA / Division',
      labelBn: 'জিপিএ / সিজিপিএ / শ্রেণি',
      status: ok ? 'Matched' : 'Failed',
      requirementText: `Min ${requiredGpa.toFixed(2)}${reqs.gpaScale ? ` (/${reqs.gpaScale})` : ''}${reqs.minDivision ? ` (or ${reqs.minDivision === 1 ? '1st' : reqs.minDivision === 2 ? '2nd' : '3rd'} Class)` : ''}`,
      profileValueText: `${relevantRecordForGpa.level}: ${candGpa.toFixed(2)} (/${relevantRecordForGpa.gpaScale.toFixed(1)})`,
      reasonEn: ok
        ? `GPA ${candGpa.toFixed(2)} satisfies the required minimum of ${requiredGpa.toFixed(2)}.`
        : `GPA ${candGpa.toFixed(2)} is below the required threshold of ${requiredGpa.toFixed(2)}.`,
      reasonBn: ok
        ? `আপনার প্রাপ্ত ফল (${candGpa.toFixed(2)}) প্রয়োজনীয় ন্যূনতম ${requiredGpa.toFixed(2)} শর্ত পূরণ করে।`
        : `আপনার ফল (${candGpa.toFixed(2)}) প্রয়োজনীয় ${requiredGpa.toFixed(2)} এর নিচে।`,
    });
  }

  // ============================================================
  // 4. PASSING YEAR CONSTRAINTS (IF SPECIFIED)
  // ============================================================
  if (reqs.minPassingYear !== null || reqs.maxPassingYear !== null) {
    const latestYear = eduProfile.passingYears.length > 0 ? Math.max(...eduProfile.passingYears) : null;
    if (latestYear === null) {
      criteria.push({
        key: 'passingYear',
        labelEn: 'Passing Year',
        labelBn: 'পাসের সন',
        status: 'Missing Profile Data',
        requirementText: `${reqs.minPassingYear ?? ''} - ${reqs.maxPassingYear ?? 'Present'}`,
        profileValueText: 'Missing passing year',
        reasonEn: 'Add passing year in Education to verify this condition.',
        reasonBn: 'পাসের সন যাচাই করতে প্রোফাইলে সাল যোগ করুন।',
      });
    } else {
      const okMin = reqs.minPassingYear === null || latestYear >= reqs.minPassingYear;
      const okMax = reqs.maxPassingYear === null || latestYear <= reqs.maxPassingYear;
      const ok = okMin && okMax;
      criteria.push({
        key: 'passingYear',
        labelEn: 'Passing Year',
        labelBn: 'পাসের সন',
        status: ok ? 'Matched' : 'Failed',
        requirementText:
          reqs.minPassingYear === reqs.maxPassingYear
            ? `${reqs.minPassingYear}`
            : `${reqs.minPassingYear ?? 'Any'} - ${reqs.maxPassingYear ?? 'Later'}`,
        profileValueText: String(latestYear),
        reasonEn: ok
          ? `Passing year (${latestYear}) satisfies circular constraints.`
          : `Passing year (${latestYear}) is outside the required range.`,
        reasonBn: ok
          ? `পাসের সন (${latestYear}) শর্তানুযায়ী সঠিক।`
          : `পাসের সন (${latestYear}) নির্ধারিত সীমার বাইরে।`,
      });
    }
  }

  // ============================================================
  // 5. AGE LIMIT ON CUTOFF DATE
  // ============================================================
  const dob = profile.personal?.dob || '';
  if (reqs.maxAgeYears === null && reqs.minAgeYears === null) {
    criteria.push({
      key: 'age',
      labelEn: 'Age Limit',
      labelBn: 'বয়সসীমা',
      status: 'Matched',
      requirementText: 'Standard Govt/General Rules (১৮-৩০/৩২ বছর)',
      profileValueText: dob ? `DOB: ${dob}` : 'No DOB set',
      reasonEn: 'Standard age conditions apply; verify circular cutoff date if special restrictions exist.',
      reasonBn: 'সাধারণ সরকারি/বেসরকারি বয়সসীমা প্রযোজ্য; কোনো বিশেষ বিধিনিষেধ পাওয়া যায়নি।',
    });
  } else if (!dob) {
    criteria.push({
      key: 'age',
      labelEn: 'Age Limit',
      labelBn: 'বয়সসীমা',
      status: 'Missing Profile Data',
      requirementText: `${reqs.minAgeYears ?? 18}–${reqs.maxAgeYears ?? '?'} years`,
      profileValueText: 'Date of Birth missing',
      reasonEn: 'Set Date of Birth in Personal Info to evaluate age eligibility.',
      reasonBn: 'বয়স যাচাই করতে ব্যক্তিগত তথ্যে জন্ম তারিখ যোগ করুন।',
    });
  } else if (!reqs.ageCutoffDate) {
    criteria.push({
      key: 'age',
      labelEn: 'Age Limit',
      labelBn: 'বয়সসীমা',
      status: 'Needs Verification',
      requirementText: `${reqs.minAgeYears ?? 18}–${reqs.maxAgeYears ?? 32} years`,
      profileValueText: `DOB: ${dob}`,
      reasonEn: 'Exact cutoff date could not be parsed automatically; verify the official circular PDF.',
      reasonBn: 'বিজ্ঞপ্তির নির্দিষ্ট কাট-অফ তারিখ পাওয়া যায়নি; বিজ্ঞপ্তি থেকে কাট-অফ তারিখ দেখে নিন।',
    });
  } else {
    const minY = reqs.minAgeYears ?? 18;
    const maxY = reqs.maxAgeYears ?? 30;
    const calc = calculateAgeOnCutoffDate(dob, reqs.ageCutoffDate, minY, maxY);
    if (!calc.isValid) {
      criteria.push({
        key: 'age',
        labelEn: 'Age Limit',
        labelBn: 'বয়সসীমা',
        status: 'Needs Verification',
        requirementText: `${minY}–${maxY} yrs on ${reqs.ageCutoffDate}`,
        profileValueText: dob,
        reasonEn: 'Invalid DOB or cutoff date format.',
        reasonBn: 'জন্ম তারিখ বা কাট-অফ তারিখের ফরম্যাট সঠিক নয়।',
      });
    } else {
      const ok = !calc.underMinimum18 && calc.meetsGeneral30;
      criteria.push({
        key: 'age',
        labelEn: 'Age Limit',
        labelBn: 'বয়সসীমা',
        status: ok ? 'Matched' : 'Failed',
        requirementText: `${minY}–${maxY} yrs (on ${reqs.ageCutoffDate})`,
        profileValueText: calc.formattedEn,
        reasonEn: ok
          ? `Applicant age (${calc.formattedEn}) is within ${minY}–${maxY} years on cutoff date (${reqs.ageCutoffDate}).`
          : `Applicant age (${calc.formattedEn}) is outside the required ${minY}–${maxY} years threshold on ${reqs.ageCutoffDate}.`,
        reasonBn: ok
          ? `কাট-অফ তারিখে (${reqs.ageCutoffDate}) আপনার বয়স (${calc.formattedBn}) নির্ধারিত ${minY}–${maxY} বছরের মধ্যে রয়েছে।`
          : `কাট-অফ তারিখে (${reqs.ageCutoffDate}) আপনার বয়স (${calc.formattedBn}) নির্ধারিত ${minY}–${maxY} বছর সীমার বাইরে।`,
      });
    }
  }

  // ============================================================
  // 6. WORK EXPERIENCE
  // ============================================================
  const profileExpYears = estimateExperienceYears(profile);
  if (reqs.minExperienceYears === null || reqs.minExperienceYears === 0) {
    criteria.push({
      key: 'experience',
      labelEn: 'Work Experience',
      labelBn: 'চাকরির অভিজ্ঞতা',
      status: 'Matched',
      requirementText: 'Freshers Eligible (অভিজ্ঞতার বাধ্যবাধকতা নেই)',
      profileValueText: `${profileExpYears} yr(s)`,
      reasonEn: 'No prior work experience is required; fresh graduates are fully eligible.',
      reasonBn: 'পূর্ব অভিজ্ঞতার প্রয়োজন নেই; নতুন প্রার্থীরাও সরাসরি আবেদন করতে পারবেন।',
    });
  } else if (!profile.hasJobExperience && profile.jobExperiences.length === 0) {
    criteria.push({
      key: 'experience',
      labelEn: 'Work Experience',
      labelBn: 'চাকরির অভিজ্ঞতা',
      status: 'Failed',
      requirementText: `Min ${reqs.minExperienceYears} yr(s)`,
      profileValueText: '0 yrs (No experience logged)',
      reasonEn: `Circular requires ${reqs.minExperienceYears} year(s) of experience, but none is logged in profile.`,
      reasonBn: `বিজ্ঞপ্তিতে ন্যূনতম ${reqs.minExperienceYears} বছরের অভিজ্ঞতা চাওয়া হয়েছে, কিন্তু প্রোফাইলে অভিজ্ঞতা নেই।`,
    });
  } else {
    const ok = profileExpYears >= reqs.minExperienceYears;
    criteria.push({
      key: 'experience',
      labelEn: 'Work Experience',
      labelBn: 'চাকরির অভিজ্ঞতা',
      status: ok ? 'Matched' : 'Failed',
      requirementText: `Min ${reqs.minExperienceYears} yr(s)`,
      profileValueText: `${profileExpYears} yr(s)`,
      reasonEn: ok
        ? `Logged work experience (${profileExpYears} yrs) meets minimum requirement of ${reqs.minExperienceYears} yr(s).`
        : `Logged work experience (${profileExpYears} yrs) is less than required ${reqs.minExperienceYears} yr(s).`,
      reasonBn: ok
        ? `আপনার অভিজ্ঞতা (${profileExpYears} বছর) ন্যূনতম ${reqs.minExperienceYears} বছরের শর্ত পূরণ করে।`
        : `আপনার অভিজ্ঞতা (${profileExpYears} বছর) প্রয়োজনীয় ${reqs.minExperienceYears} বছরের চেয়ে কম।`,
    });
  }

  // ============================================================
  // 7. LOCATION & DISTRICT QUOTA
  // ============================================================
  const userPermanentDistrict = (profile.address?.permanent?.district || '').trim();
  const userPresentDistrict = (profile.address?.present?.district || '').trim();
  const candidateDistrict = userPermanentDistrict || userPresentDistrict;

  if (reqs.restrictedDistricts.length > 0) {
    if (!candidateDistrict) {
      criteria.push({
        key: 'location',
        labelEn: 'District Quota / Residence',
        labelBn: 'জেলা কোটা / স্থায়ী ঠিকানা',
        status: 'Missing Profile Data',
        requirementText: `Eligible Districts: ${reqs.restrictedDistricts.join(', ')}`,
        profileValueText: 'Missing district in Address',
        reasonEn: 'Circular restricts eligibility to specific districts; set Permanent District in Address.',
        reasonBn: 'বিজ্ঞপ্তিতে নির্দিষ্ট জেলার প্রার্থীদের আবেদন করতে বলা হয়েছে; স্থায়ী ঠিকানায় জেলার নাম দিন।',
      });
    } else {
      const ok = reqs.restrictedDistricts.some(
        (d) =>
          d.toLowerCase() === userPermanentDistrict.toLowerCase() ||
          d.toLowerCase() === userPresentDistrict.toLowerCase()
      );
      criteria.push({
        key: 'location',
        labelEn: 'District Quota / Residence',
        labelBn: 'জেলা কোটা / স্থায়ী ঠিকানা',
        status: ok ? 'Matched' : 'Failed',
        requirementText: `Eligible Districts: ${reqs.restrictedDistricts.join(', ')}`,
        profileValueText: `${candidateDistrict} (${userPermanentDistrict ? 'Permanent' : 'Present'})`,
        reasonEn: ok
          ? `District (${candidateDistrict}) is among the eligible quota districts.`
          : `Candidate's district (${candidateDistrict}) is not in the eligible district list (${reqs.restrictedDistricts.join(', ')}).`,
        reasonBn: ok
          ? `আপনার জেলা (${candidateDistrict}) আবেদনযোগ্য জেলার তালিকায় রয়েছে।`
          : `আপনার জেলা (${candidateDistrict}) বিজ্ঞপ্তিতে উল্লেখিত জেলার তালিকায় নেই।`,
      });
    }
  } else {
    // Standard nationwide opening
    criteria.push({
      key: 'location',
      labelEn: 'District Quota / Residence',
      labelBn: 'জেলা কোটা / স্থায়ী ঠিকানা',
      status: 'Matched',
      requirementText: `All Bangladesh (Work site: ${reqs.workLocation || 'Open'})`,
      profileValueText: candidateDistrict ? `${candidateDistrict} (Permanent)` : 'All districts eligible',
      reasonEn: `Open nationally to all 64 districts. Work posting location is ${reqs.workLocation || 'Bangladesh'}.`,
      reasonBn: `সারা দেশের ৬৪ জেলার প্রার্থীরাই আবেদনযোগ্য। পদটির কর্মস্থল: ${reqs.workLocation || 'বাংলাদেশ'}।`,
    });
  }

  // ============================================================
  // 8. UNCERTAIN CONDITIONS / QUOTA CLAUSES
  // ============================================================
  if (reqs.uncertainConditions.length > 0) {
    criteria.push({
      key: 'conditions',
      labelEn: 'Quotas & Special Clauses',
      labelBn: 'কোটা ও বিশেষ শর্তাবলি',
      status: 'Needs Verification',
      requirementText: reqs.uncertainConditions[0],
      profileValueText: `Quota: ${profile.personal?.quota || 'General'}`,
      reasonEn: 'Special quotas (Freedom Fighter, ethnic, departmental, disability) must be manually reviewed on circular.',
      reasonBn: 'মুক্তিযোদ্ধা, এতিম, প্রতিবন্ধী বা বিভাগীয় প্রার্থীর বিশেষ শর্তাদি মূল বিজ্ঞপ্তি দেখে নিশ্চিত হতে হবে।',
    });
  }

  // ============================================================
  // 9. METRICS & OVERALL STATUS DETERMINATION
  // ============================================================
  const matchedCount = criteria.filter((c) => c.status === 'Matched').length;
  const failedCount = criteria.filter((c) => c.status === 'Failed').length;
  const missingProfileCount = criteria.filter((c) => c.status === 'Missing Profile Data').length;
  const needsVerificationCount = criteria.filter((c) => c.status === 'Needs Verification').length;

  let overallStatus: EligibilityVerdict;
  if (failedCount > 0) {
    overallStatus = 'NOT_ELIGIBLE';
  } else if (missingProfileCount > 0) {
    overallStatus = 'INSUFFICIENT_PROFILE_DATA';
  } else if (
    needsVerificationCount > 0 ||
    reqs.uncertainConditions.length > 0 ||
    !reqs.hasExtractedAnyRequirement
  ) {
    overallStatus = 'MANUAL_REVIEW_REQUIRED';
  } else {
    overallStatus = 'ELIGIBLE';
  }

  return {
    overallStatus,
    parsedRequirements: reqs,
    criteria,
    candidateOverview: eduProfile.overview,
    matchedCount,
    failedCount,
    needsVerificationCount,
    missingProfileCount,
    circularUrl: job.circularUrl || '',
    applicationUrl: job.applicationUrl,
    sourceName: job.sourceName,
    lastVerifiedAt: job.sourceLastVerifiedAt || job.lastUpdatedAt,
  };
}
