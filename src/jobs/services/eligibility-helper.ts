// JobFill BD - Local Offline Age-on-Circular-Cutoff & Bilingual Eligibility Engine
// Compares saved profile fields conservatively against parsed or manually corrected
// circular requirements without ever fabricating conditions or finalizing uncertain quotas.

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
    // Align to Dhaka calendar date
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
// PHASE 2: BILINGUAL CIRCULAR REQUIREMENT PARSER & COMPARATOR
// ============================================================

export type EducationLevelRank = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type CriterionStatus =
  | 'Matched'
  | 'Failed'
  | 'Missing Profile Data'
  | 'Not Specified'
  | 'Needs Verification';

export type EligibilityVerdict = 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'NEEDS_MANUAL_VERIFICATION';

export interface ParsedJobRequirements {
  minEducationLevel: 'SSC' | 'HSC' | 'Diploma' | 'Bachelor' | 'Masters' | 'PhD' | null;
  requiredSubjects: string[];
  minGpa: number | null;
  gpaScale: 4 | 5 | null;
  minPassingYear: number | null;
  maxPassingYear: number | null;
  minAgeYears: number | null;
  maxAgeYears: number | null;
  ageCutoffDate: string | null;
  minExperienceYears: number | null;
  restrictedDistricts: string[];
  allDistrictsEligible: boolean;
  uncertainConditions: string[];
  hasExtractedAnyRequirement: boolean;
}

export interface EligibilityCriterionResult {
  key: 'education' | 'subject' | 'gpa' | 'passingYear' | 'age' | 'experience' | 'location' | 'conditions';
  labelEn: string;
  labelBn: string;
  status: CriterionStatus;
  requirementText: string;
  profileValueText: string;
  reasonEn: string;
  reasonBn: string;
}

export interface FullEligibilityReport {
  overallStatus: EligibilityVerdict;
  parsedRequirements: ParsedJobRequirements;
  criteria: EligibilityCriterionResult[];
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

const EDUCATION_RANK: Record<NonNullable<ParsedJobRequirements['minEducationLevel']>, number> = {
  SSC: 1,
  HSC: 2,
  Diploma: 3,
  Bachelor: 4,
  Masters: 5,
  PhD: 6,
};

const SUBJECT_ALIAS_GROUPS: Array<{ canonical: string; patterns: RegExp[] }> = [
  { canonical: 'computer science', patterns: [/\bcse\b/i, /computer science/i, /computer engineering/i, /software engineering/i, /information technology/i, /\bict\b/i, /কম্পিউটার\s*সায়েন্স/i, /কম্পিউটার\s*প্রকৌশল/i] },
  { canonical: 'electrical engineering', patterns: [/\beee\b/i, /electrical/i, /electronic/i, /তড়িৎ/i] },
  { canonical: 'civil engineering', patterns: [/\bcivil\b/i, /পুরকৌশল/i] },
  { canonical: 'mechanical engineering', patterns: [/\bmechanical\b/i, /যন্ত্রকৌশল/i] },
  { canonical: 'economics', patterns: [/\beconomics\b/i, /অর্থনীতি/i] },
  { canonical: 'accounting', patterns: [/\baccounting\b/i, /হিসাববিজ্ঞান/i] },
  { canonical: 'finance', patterns: [/\bfinance\b/i, /banking/i, /ফিন্যান্স/i] },
  { canonical: 'management', patterns: [/\bbba\b/i, /\bmba\b/i, /\bmanagement\b/i, /ব্যবস্থাপনা/i] },
  { canonical: 'english', patterns: [/\benglish\b/i, /ইংরেজি/i] },
  { canonical: 'bangla', patterns: [/\bbangla\b/i, /bengali/i, /বাংলা সাহিত্য/i] },
  { canonical: 'mathematics', patterns: [/\bmathematics\b/i, /\bmath\b/i, /গণিত/i] },
  { canonical: 'statistics', patterns: [/\bstatistics\b/i, /পরিসংখ্যান/i] },
  { canonical: 'physics', patterns: [/\bphysics\b/i, /পদার্থবিজ্ঞান/i] },
  { canonical: 'chemistry', patterns: [/\bchemistry\b/i, /রসায়ন/i] },
  { canonical: 'law', patterns: [/\bllb\b/i, /\bllm\b/i, /\blaw\b/i, /আইন/i] },
  { canonical: 'pharmacy', patterns: [/\bb\.?\s*pharm\b/i, /\bpharmacy\b/i, /ফার্মেসি/i] },
];

const BD_DISTRICTS_CANONICAL: Array<{ canonical: string; patterns: RegExp[] }> = [
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
];

export function extractJobRequirements(job: Partial<NormalizedJobCircular>): ParsedJobRequirements {
  const combinedRaw = [
    job.qualification,
    job.ageRequirement,
    job.experience,
    ...(Array.isArray(job.requirements) ? job.requirements : []),
    job.description,
    job.location,
  ]
    .filter(Boolean)
    .join(' | ');
  const text = normalizeBengaliDigits(combinedRaw);
  const lower = text.toLowerCase();

  // 1. Minimum Education Level (strictly check highest explicit requirement threshold without fabricating)
  let minEducationLevel: ParsedJobRequirements['minEducationLevel'] = null;
  if (/\bphd\b|পিএইচডি|ডক্টরেট/i.test(text)) {
    minEducationLevel = 'Masters'; // conservative ceiling if Masters required prior, track PhD accurately:
    minEducationLevel = 'PhD';
  } else if (/\bmasters?\b|\bm\.?\s?sc\b|\bm\.?\s?a\b|\bmba\b|\bm\.?\s?com\b|স্নাতকোত্তর|মাস্টার্স/i.test(text)) {
    minEducationLevel = 'Masters';
  } else if (/\bbachelor\b|\bhonours?\b|\bhonors?\b|\bgraduate\b|\bgraduation\b|\bb\.?\s?sc\b|\bb\.?\s?a\b|\bb\.?\s?com\b|\bbba\b|\bllb\b|স্নাতক|অনার্স|ডিগ্রি/i.test(text)) {
    minEducationLevel = 'Bachelor';
  } else if (/\bdiploma\b|ডিপ্লোমা/i.test(text)) {
    minEducationLevel = 'Diploma';
  } else if (/\bhsc\b|higher secondary|এইচএসসি|উচ্চ\s*মাধ্যমিক|আলিম/i.test(text)) {
    minEducationLevel = 'HSC';
  } else if (/\bssc\b|secondary school|এসএসসি|মাধ্যমিক|দাখিল/i.test(text)) {
    minEducationLevel = 'SSC';
  } else if (
    job.qualification &&
    job.qualification !== 'Any Qualification' &&
    EDUCATION_RANK[job.qualification as keyof typeof EDUCATION_RANK]
  ) {
    minEducationLevel = job.qualification as NonNullable<ParsedJobRequirements['minEducationLevel']>;
  }

  // 2. Subject extraction (only when explicit disciplined subjects appear AND not negated as "Any Discipline")
  const anySubjectPhrase = /any discipline|any subject|যেকোনো বিষয়|যেকোনো বিভাগ|সকল বিভাগ/i.test(text);
  const requiredSubjects: string[] = [];
  if (!anySubjectPhrase) {
    for (const grp of SUBJECT_ALIAS_GROUPS) {
      if (grp.patterns.some((rx) => rx.test(text))) {
        requiredSubjects.push(grp.canonical);
      }
    }
  }

  // 3. Minimum GPA / CGPA threshold
  let minGpa: number | null = null;
  let gpaScale: 4 | 5 | null = null;
  const cgpaMatch = text.match(/(?:cgpa|gpa|সিজিপিএ|জিপিএ)\s*[:\-]?\s*(?:minimum|min|at least|ন্যূনতম|কমপক্ষে)?\s*(\d+(?:\.\d{1,2})?)/i);
  if (cgpaMatch) {
    const val = parseFloat(cgpaMatch[1]);
    if (Number.isFinite(val) && val > 0 && val <= 5) {
      minGpa = val;
      if (/out of 5|৫\.০০|5\.00/i.test(text) || val > 4) gpaScale = 5;
      else if (/out of 4|৪\.০০|4\.00/i.test(text) || /\bcgpa\b|সিজিপিএ/i.test(cgpaMatch[0])) gpaScale = 4;
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
  const ageSrc = normalizeBengaliDigits([job.ageRequirement, ...(job.requirements || []), job.description].filter(Boolean).join(' '));

  const rangeMatch = ageSrc.match(/\b(1[6-9]|2[0-9])\s*(?:-|to|থেকে)\s*(2[5-9]|3[0-9]|4[0-5])\b/i);
  if (rangeMatch) {
    minAgeYears = Number(rangeMatch[1]);
    maxAgeYears = Number(rangeMatch[2]);
  } else {
    const maxMatch = ageSrc.match(/(?:max(?:imum)?\s*age|up to|not exceeding|অনূর্ধ্ব|সর্বোচ্চ\s*বয়স)\s*[:\-]?\s*(2[0-9]|3[0-9]|4[0-5])/i);
    if (maxMatch) {
      maxAgeYears = Number(maxMatch[1]);
    }
    const minMatch = ageSrc.match(/(?:min(?:imum)?\s*age|সর্বনিম্ন\s*বয়স)\s*[:\-]?\s*(1[6-9]|2[0-5])/i);
    if (minMatch) {
      minAgeYears = Number(minMatch[1]);
    }
  }

  const cutoffMatch = ageSrc.match(/(?:as on|cutoff|তারিখ পর্যন্ত|তারিখে বয়স)\s*[:\-]?\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})/i);
  if (cutoffMatch) {
    const parsedCut = parseFlexibleDateString(cutoffMatch[1]);
    if (parsedCut) ageCutoffDate = formatIsoCalendarDate(parsedCut);
  } else if (job.deadlineAt) {
    const dParsed = parseFlexibleDateString(job.deadlineAt);
    if (dParsed) ageCutoffDate = formatIsoCalendarDate(dParsed);
  }

  // 6. Experience Years
  let minExperienceYears: number | null = null;
  const expText = normalizeBengaliDigits([job.experience, ...(job.requirements || []), job.description].filter(Boolean).join(' '));
  if (/no experience|freshers|fresh graduate|অভিজ্ঞতার প্রয়োজন নেই|অভিজ্ঞতা নিষ্প্রয়োজন/i.test(expText)) {
    minExperienceYears = 0;
  } else {
    const expMatch = expText.match(/(\d+(?:\.\d+)?)\s*(?:\+\s*)?(?:years?|yrs?|বছর(?:ের)?)\s*(?:of\s*)?(?:experience|অভিজ্ঞতা|চাকরি)/i);
    if (expMatch) {
      minExperienceYears = parseFloat(expMatch[1]);
    }
  }

  // 7. District Restrictions vs All Districts
  const locText = normalizeBengaliDigits([job.location, ...(job.requirements || []), job.description].filter(Boolean).join(' '));
  const allDistrictsEligible = /all bangladesh|all districts|সকল জেলা/i.test(locText) || job.location === 'All Bangladesh';
  const restrictedDistricts: string[] = [];
  if (!allDistrictsEligible && /only candidates from|শুধুমাত্র.*জেলার|নিজ জেলা.*প্রার্থী|eligible districts/i.test(locText)) {
    for (const d of BD_DISTRICTS_CANONICAL) {
      if (d.patterns.some((rx) => rx.test(locText))) {
        restrictedDistricts.push(d.canonical);
      }
    }
  }

  // 8. Uncertain Conditions (Quotas, Disability, Departmental, Refer-to-Circular)
  const uncertainConditions: string[] = [];
  if (/quota|কোটা|freedom fighter|মুক্তিযোদ্ধা|tribal|উপজাতি|ansar|আনসার/i.test(lower)) {
    uncertainConditions.push('Quota rules (Freedom Fighter / District / Ethnic) require manual verification');
  }
  if (/disabilit|প্রতিবন্ধী/i.test(lower)) {
    uncertainConditions.push('Disability eligibility clauses require manual verification');
  }
  if (/departmental|বিভাগীয় প্রার্থী/i.test(lower)) {
    uncertainConditions.push('Departmental candidate age relaxation / condition applies');
  }
  if (/see circular|বিজ্ঞপ্তি দেখুন|শর্তাবলি প্রযোজ্য/i.test(lower)) {
    uncertainConditions.push('Circular references additional manual PDF conditions');
  }

  const hasExtractedAnyRequirement = Boolean(
    minEducationLevel ||
      requiredSubjects.length > 0 ||
      minGpa !== null ||
      minPassingYear !== null ||
      minAgeYears !== null ||
      maxAgeYears !== null ||
      restrictedDistricts.length > 0
  );

  return {
    minEducationLevel,
    requiredSubjects,
    minGpa,
    gpaScale,
    minPassingYear,
    maxPassingYear,
    minAgeYears,
    maxAgeYears,
    ageCutoffDate,
    minExperienceYears,
    restrictedDistricts,
    allDistrictsEligible,
    uncertainConditions,
    hasExtractedAnyRequirement,
  };
}

function resolveApplicantEducationProfile(profile: UserProfile): {
  highestLevel: NonNullable<ParsedJobRequirements['minEducationLevel']> | null;
  highestRank: number;
  subjects: string[];
  gpas: Array<{ level: string; gpa: number; scale: number }>;
  passingYears: number[];
} {
  let highestLevel: NonNullable<ParsedJobRequirements['minEducationLevel']> | null = null;
  let highestRank = 0;
  const subjects: string[] = [];
  const gpas: Array<{ level: string; gpa: number; scale: number }> = [];
  const passingYears: number[] = [];

  const recordEdu = (
    level: NonNullable<ParsedJobRequirements['minEducationLevel']>,
    subjectRaw?: string,
    gpaRaw?: string,
    scaleRaw?: string,
    yearRaw?: string
  ) => {
    if (EDUCATION_RANK[level] > highestRank) {
      highestRank = EDUCATION_RANK[level];
      highestLevel = level;
    }
    if (subjectRaw && subjectRaw.trim()) subjects.push(subjectRaw.trim());
    const numGpa = parseFloat(normalizeBengaliDigits(gpaRaw || ''));
    if (Number.isFinite(numGpa) && numGpa > 0) {
      const scaleNum = parseFloat(normalizeBengaliDigits(scaleRaw || ''));
      const scale = Number.isFinite(scaleNum) && scaleNum > 0 ? scaleNum : level === 'SSC' || level === 'HSC' ? 5 : 4;
      gpas.push({ level, gpa: numGpa, scale });
    }
    const yr = parseInt(normalizeBengaliDigits(yearRaw || ''), 10);
    if (Number.isFinite(yr) && yr >= 1980 && yr <= 2100) passingYears.push(yr);
  };

  if (
    profile.ssc &&
    (profile.ssc.rollNumber?.trim() ||
      profile.ssc.registrationNumber?.trim() ||
      profile.ssc.gpa?.trim() ||
      profile.ssc.passingYear?.trim() ||
      profile.ssc.institution?.trim())
  ) {
    recordEdu('SSC', profile.ssc.groupSubject, profile.ssc.gpa, profile.ssc.gpaScale, profile.ssc.passingYear);
  }
  if (
    profile.hsc &&
    (profile.hsc.rollNumber?.trim() ||
      profile.hsc.registrationNumber?.trim() ||
      profile.hsc.gpa?.trim() ||
      profile.hsc.passingYear?.trim() ||
      profile.hsc.institution?.trim())
  ) {
    recordEdu('HSC', profile.hsc.groupSubject, profile.hsc.gpa, profile.hsc.gpaScale, profile.hsc.passingYear);
  }
  if (
    profile.hasGraduation &&
    profile.graduation &&
    (profile.graduation.universityInstitute?.trim() ||
      profile.graduation.subjectDegree?.trim() ||
      profile.graduation.gpa?.trim() ||
      profile.graduation.passingYear?.trim())
  ) {
    const examLower = `${profile.graduation.examination || ''} ${profile.graduation.subjectDegree || ''}`.toLowerCase();
    const gradLevel: NonNullable<ParsedJobRequirements['minEducationLevel']> = examLower.includes('diploma')
      ? 'Diploma'
      : 'Bachelor';
    recordEdu(
      gradLevel,
      `${profile.graduation.examination || ''} ${profile.graduation.subjectDegree || ''}`,
      profile.graduation.gpa,
      profile.graduation.gpaScale,
      profile.graduation.passingYear
    );
  }
  if (
    profile.hasMasters &&
    profile.masters &&
    (profile.masters.universityInstitute?.trim() ||
      profile.masters.subjectDegree?.trim() ||
      profile.masters.gpa?.trim() ||
      profile.masters.passingYear?.trim())
  ) {
    const mastersLower = `${profile.masters.examination || ''} ${profile.masters.subjectDegree || ''}`.toLowerCase();
    const mLevel: NonNullable<ParsedJobRequirements['minEducationLevel']> = mastersLower.includes('phd')
      ? 'PhD'
      : 'Masters';
    recordEdu(
      mLevel,
      `${profile.masters.examination || ''} ${profile.masters.subjectDegree || ''}`,
      profile.masters.gpa,
      profile.masters.gpaScale,
      profile.masters.passingYear
    );
  }

  return { highestLevel, highestRank, subjects, gpas, passingYears };
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

function matchProfileSubjectToRequirement(profileSubjects: string[], requiredCanonicalSubjects: string[]): boolean {
  const joined = normalizeBengaliDigits(profileSubjects.join(' ')).toLowerCase();
  if (!joined.trim()) return false;
  for (const reqCanon of requiredCanonicalSubjects) {
    const grp = SUBJECT_ALIAS_GROUPS.find((g) => g.canonical === reqCanon);
    if (grp && grp.patterns.some((rx) => rx.test(joined))) {
      return true;
    }
    if (joined.includes(reqCanon)) return true;
  }
  return false;
}

/**
 * Evaluates applicant eligibility strictly from saved profile fields and extracted (or manually corrected) requirements.
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

  // 1. Education Level
  if (!reqs.minEducationLevel) {
    criteria.push({
      key: 'education',
      labelEn: 'Education Level',
      labelBn: 'শিক্ষাগত যোগ্যতা',
      status: 'Not Specified',
      requirementText: 'Not specified in circular text',
      profileValueText: eduProfile.highestLevel || 'Not provided',
      reasonEn: 'Education requirement is not explicitly specified; verify the official circular.',
      reasonBn: 'বিজ্ঞপ্তিতে নির্দিষ্ট শিক্ষাগত স্তর স্পষ্টভাবে উল্লেখ নেই; মূল বিজ্ঞপ্তি দেখুন।',
    });
  } else if (!eduProfile.highestLevel) {
    criteria.push({
      key: 'education',
      labelEn: 'Education Level',
      labelBn: 'শিক্ষাগত যোগ্যতা',
      status: 'Missing Profile Data',
      requirementText: `Minimum ${reqs.minEducationLevel}`,
      profileValueText: 'Missing education records',
      reasonEn: `Profile has no saved education record to compare against ${reqs.minEducationLevel}.`,
      reasonBn: `${reqs.minEducationLevel} যাচাইয়ের জন্য প্রোফাইলে শিক্ষাগত তথ্য নেই।`,
    });
  } else {
    const reqRank = EDUCATION_RANK[reqs.minEducationLevel];
    const ok = eduProfile.highestRank >= reqRank;
    criteria.push({
      key: 'education',
      labelEn: 'Education Level',
      labelBn: 'শিক্ষাগত যোগ্যতা',
      status: ok ? 'Matched' : 'Failed',
      requirementText: `Minimum ${reqs.minEducationLevel}`,
      profileValueText: eduProfile.highestLevel,
      reasonEn: ok
        ? `Education (${eduProfile.highestLevel}) meets minimum ${reqs.minEducationLevel}.`
        : `Requires ${reqs.minEducationLevel}, but profile highest education is ${eduProfile.highestLevel}.`,
      reasonBn: ok
        ? `শিক্ষাগত যোগ্যতা (${eduProfile.highestLevel}) ন্যূনতম ${reqs.minEducationLevel} শর্ত পূরণ করে।`
        : `${reqs.minEducationLevel} প্রয়োজন, কিন্তু প্রোফাইলে সর্বোচ্চ যোগ্যতা ${eduProfile.highestLevel}।`,
    });
  }

  // 2. Subject / Discipline
  if (reqs.requiredSubjects.length === 0) {
    criteria.push({
      key: 'subject',
      labelEn: 'Degree Subject',
      labelBn: 'বিষয় / বিভাগ',
      status: 'Not Specified',
      requirementText: 'Any or not specified',
      profileValueText: eduProfile.subjects.join(', ') || 'Not specified',
      reasonEn: 'No specific subject restriction detected.',
      reasonBn: 'নির্দিষ্ট কোনো বিষয়ের বাধ্যবাধকতা পাওয়া যায়নি।',
    });
  } else if (eduProfile.subjects.length === 0) {
    criteria.push({
      key: 'subject',
      labelEn: 'Degree Subject',
      labelBn: 'বিষয় / বিভাগ',
      status: 'Missing Profile Data',
      requirementText: reqs.requiredSubjects.join(' / '),
      profileValueText: 'Missing subject in profile',
      reasonEn: `Circular specifies ${reqs.requiredSubjects.join(' / ')}; add subject in Education.`,
      reasonBn: `বিজ্ঞপ্তিতে ${reqs.requiredSubjects.join(' / ')} চাওয়া হয়েছে; প্রোফাইলে বিষয় যোগ করুন।`,
    });
  } else {
    const matchedSubj = matchProfileSubjectToRequirement(eduProfile.subjects, reqs.requiredSubjects);
    criteria.push({
      key: 'subject',
      labelEn: 'Degree Subject',
      labelBn: 'বিষয় / বিভাগ',
      status: matchedSubj ? 'Matched' : 'Failed',
      requirementText: reqs.requiredSubjects.join(' / '),
      profileValueText: eduProfile.subjects.join(' | '),
      reasonEn: matchedSubj
        ? `Subject matches (${reqs.requiredSubjects.join(' / ')}).`
        : `Required subject (${reqs.requiredSubjects.join(' / ')}) does not match saved profile subjects.`,
      reasonBn: matchedSubj
        ? `বিষয়/ডিগ্রি মিলেছে (${reqs.requiredSubjects.join(' / ')})।`
        : `প্রোফাইলের বিষয়টি বিজ্ঞপ্তির শর্ত (${reqs.requiredSubjects.join(' / ')}) অনুযায়ী মেলেনি।`,
    });
  }

  // 3. Minimum GPA / CGPA
  if (reqs.minGpa === null) {
    criteria.push({
      key: 'gpa',
      labelEn: 'GPA / CGPA',
      labelBn: 'জিপিএ / সিজিপিএ',
      status: 'Not Specified',
      requirementText: 'Not specified',
      profileValueText: eduProfile.gpas.map((g) => `${g.level}: ${g.gpa}`).join(', ') || 'Not provided',
      reasonEn: 'No minimum numeric GPA threshold parsed.',
      reasonBn: 'ন্যূনতম জিপিএ/সিজিপিএ সীমা উল্লেখ পাওয়া যায়নি।',
    });
  } else if (eduProfile.gpas.length === 0) {
    criteria.push({
      key: 'gpa',
      labelEn: 'GPA / CGPA',
      labelBn: 'জিপিএ / সিজিপিএ',
      status: 'Missing Profile Data',
      requirementText: `Min ${reqs.minGpa.toFixed(2)}`,
      profileValueText: 'Missing GPA in profile',
      reasonEn: `Add GPA/CGPA to verify minimum ${reqs.minGpa.toFixed(2)}.`,
      reasonBn: `ন্যূনতম ${reqs.minGpa.toFixed(2)} যাচাই করতে প্রোফাইলে GPA/CGPA দিন।`,
    });
  } else {
    // Compare against matching scale where possible (higher degree GPA preferred)
    const relevantGpa =
      (reqs.gpaScale
        ? eduProfile.gpas.filter((g) => g.scale === reqs.gpaScale).slice(-1)[0]
        : eduProfile.gpas.slice(-1)[0]) || eduProfile.gpas.slice(-1)[0];
    const ok = relevantGpa.gpa >= reqs.minGpa;
    criteria.push({
      key: 'gpa',
      labelEn: 'GPA / CGPA',
      labelBn: 'জিপিএ / সিজিপিএ',
      status: ok ? 'Matched' : 'Failed',
      requirementText: `Min ${reqs.minGpa.toFixed(2)}${reqs.gpaScale ? ` (/${reqs.gpaScale})` : ''}`,
      profileValueText: `${relevantGpa.level}: ${relevantGpa.gpa.toFixed(2)} (/${relevantGpa.scale})`,
      reasonEn: ok
        ? `GPA ${relevantGpa.gpa.toFixed(2)} meets minimum ${reqs.minGpa.toFixed(2)}.`
        : `${relevantGpa.level} GPA (${relevantGpa.gpa.toFixed(2)}) is below required ${reqs.minGpa.toFixed(2)}.`,
      reasonBn: ok
        ? `প্রাপ্ত ${relevantGpa.gpa.toFixed(2)} ন্যূনতম ${reqs.minGpa.toFixed(2)} শর্ত পূরণ করে।`
        : `${relevantGpa.level} ফলাফল (${relevantGpa.gpa.toFixed(2)}) প্রয়োজনীয় ${reqs.minGpa.toFixed(2)} এর নিচে।`,
    });
  }

  // 4. Passing Year (only if circular states constraint)
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
        reasonEn: ok ? `Passing year (${latestYear}) satisfies constraint.` : `Passing year (${latestYear}) falls outside required range.`,
        reasonBn: ok ? `পাসের সন (${latestYear}) শর্তানুযায়ী সঠিক।` : `পাসের সন (${latestYear}) নির্ধারিত সীমার বাইরে।`,
      });
    }
  }

  // 5. Age Limit on Circular Cutoff
  const dob = profile.personal?.dob || '';
  if (reqs.maxAgeYears === null && reqs.minAgeYears === null) {
    criteria.push({
      key: 'age',
      labelEn: 'Age Limit',
      labelBn: 'বয়সসীমা',
      status: 'Not Specified',
      requirementText: 'Not specified in circular text',
      profileValueText: dob || 'No DOB set',
      reasonEn: 'Age limit not automatically parsed; verify age cutoff on the circular.',
      reasonBn: 'বয়সসীমা স্বয়ংক্রিয়ভাবে পাওয়া যায়নি; বিজ্ঞপ্তি থেকে যাচাই করুন।',
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
      reasonEn: 'Exact cutoff date could not be verified from circular; enter cutoff date manually.',
      reasonBn: 'বিজ্ঞপ্তির নির্দিষ্ট কাট-অফ তারিখ পাওয়া যায়নি; ম্যানুয়ালি তারিখ দিয়ে যাচাই করুন।',
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
          ? `Age (${calc.formattedEn}) is within ${minY}–${maxY} years on ${reqs.ageCutoffDate}.`
          : `Age (${calc.formattedEn}) is outside ${minY}–${maxY} years on ${reqs.ageCutoffDate}.`,
        reasonBn: ok
          ? `বয়স (${calc.formattedBn}) নির্ধারিত ${minY}–${maxY} বছরের মধ্যে আছে।`
          : `বয়স (${calc.formattedBn}) নির্ধারিত ${minY}–${maxY} বছর সীমার বাইরে।`,
      });
    }
  }

  // 6. Work Experience
  const profileExpYears = estimateExperienceYears(profile);
  if (reqs.minExperienceYears === null) {
    criteria.push({
      key: 'experience',
      labelEn: 'Work Experience',
      labelBn: 'চাকরির অভিজ্ঞতা',
      status: 'Not Specified',
      requirementText: 'Not specified',
      profileValueText: `${profileExpYears} yr(s)`,
      reasonEn: 'Circular does not state specific years of required experience.',
      reasonBn: 'নির্দিষ্ট অভিজ্ঞতার বছর উল্লেখ পাওয়া যায়নি।',
    });
  } else if (reqs.minExperienceYears === 0) {
    criteria.push({
      key: 'experience',
      labelEn: 'Work Experience',
      labelBn: 'চাকরির অভিজ্ঞতা',
      status: 'Matched',
      requirementText: 'None required (Freshers eligible)',
      profileValueText: `${profileExpYears} yr(s)`,
      reasonEn: 'No prior experience required.',
      reasonBn: 'পূর্ব অভিজ্ঞতা বাধ্যতামূলক নয়।',
    });
  } else if (!profile.hasJobExperience && profile.jobExperiences.length === 0) {
    criteria.push({
      key: 'experience',
      labelEn: 'Work Experience',
      labelBn: 'চাকরির অভিজ্ঞতা',
      status: 'Failed',
      requirementText: `Min ${reqs.minExperienceYears} yr(s)`,
      profileValueText: '0 yrs (No experience logged)',
      reasonEn: `Circular requires ${reqs.minExperienceYears} year(s) of experience.`,
      reasonBn: `বিজ্ঞপ্তিতে ন্যূনতম ${reqs.minExperienceYears} বছরের অভিজ্ঞতা চাওয়া হয়েছে।`,
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
        ? `Experience (${profileExpYears} yrs) meets minimum ${reqs.minExperienceYears} yr(s).`
        : `Recorded experience (${profileExpYears} yrs) is below required ${reqs.minExperienceYears} yr(s).`,
      reasonBn: ok
        ? `অভিজ্ঞতা (${profileExpYears} বছর) ন্যূনতম শর্ত পূরণ করে।`
        : `অভিজ্ঞতা (${profileExpYears} বছর) প্রয়োজনীয় ${reqs.minExperienceYears} বছরের চেয়ে কম।`,
    });
  }

  // 7. District / Location Quota
  const userDistrict = (profile.address?.permanent?.district || profile.address?.present?.district || '').trim();
  if (reqs.restrictedDistricts.length > 0) {
    if (!userDistrict) {
      criteria.push({
        key: 'location',
        labelEn: 'District / Location',
        labelBn: 'জেলা কোটা',
        status: 'Missing Profile Data',
        requirementText: reqs.restrictedDistricts.join(', '),
        profileValueText: 'Missing district in Address',
        reasonEn: 'Circular restricts districts; set Present/Permanent District in Address.',
        reasonBn: 'বিজ্ঞপ্তিতে জেলা নির্ধারিত আছে; প্রোফাইলে জেলার নাম যোগ করুন।',
      });
    } else {
      const ok = reqs.restrictedDistricts.some((d) => d.toLowerCase() === userDistrict.toLowerCase());
      criteria.push({
        key: 'location',
        labelEn: 'District / Location',
        labelBn: 'জেলা কোটা',
        status: ok ? 'Matched' : 'Failed',
        requirementText: reqs.restrictedDistricts.join(', '),
        profileValueText: userDistrict,
        reasonEn: ok
          ? `District (${userDistrict}) is within eligible districts.`
          : `District (${userDistrict}) is not listed among eligible districts (${reqs.restrictedDistricts.join(', ')}).`,
        reasonBn: ok
          ? `আপনার জেলা (${userDistrict}) আবেদনযোগ্য তালিকায় রয়েছে।`
          : `আপনার জেলা (${userDistrict}) বিজ্ঞপ্তির নির্দিষ্ট জেলার মধ্যে নেই।`,
      });
    }
  } else {
    criteria.push({
      key: 'location',
      labelEn: 'District / Location',
      labelBn: 'জেলা কোটা',
      status: reqs.allDistrictsEligible ? 'Matched' : 'Not Specified',
      requirementText: reqs.allDistrictsEligible ? 'All Districts (All Bangladesh)' : 'See circular',
      profileValueText: userDistrict || 'Not set',
      reasonEn: reqs.allDistrictsEligible
        ? 'Open to candidates from all districts.'
        : 'Verify circular district quota table manually.',
      reasonBn: reqs.allDistrictsEligible
        ? 'দেশের সকল জেলার প্রার্থী আবেদন করতে পারবেন।'
        : 'বিজ্ঞপ্তির জেলা কোটা তালিকা নিজ দায়িত্বে যাচাই করুন।',
    });
  }

  // 8. Uncertain / Quota / Manual Clauses (NEVER decide automatically!)
  if (reqs.uncertainConditions.length > 0) {
    criteria.push({
      key: 'conditions',
      labelEn: 'Quotas & Special Clauses',
      labelBn: 'কোটা ও বিশেষ শর্ত',
      status: 'Needs Verification',
      requirementText: reqs.uncertainConditions[0],
      profileValueText: profile.personal?.quota || 'General',
      reasonEn: 'Special quotas, disability clauses, or circular footnotes require applicant verification.',
      reasonBn: 'কোটা, প্রতিবন্ধী বা বিভাগীয় শর্তাবলি স্বয়ংক্রিয়ভাবে চূড়ান্ত করা হয় না—বিজ্ঞপ্তি যাচাই করুন।',
    });
  }

  const matchedCount = criteria.filter((c) => c.status === 'Matched').length;
  const failedCount = criteria.filter((c) => c.status === 'Failed').length;
  const needsVerificationCount = criteria.filter((c) => c.status === 'Needs Verification').length;
  const missingProfileCount = criteria.filter((c) => c.status === 'Missing Profile Data').length;

  let overallStatus: EligibilityVerdict = 'NEEDS_MANUAL_VERIFICATION';
  if (failedCount > 0) {
    overallStatus = 'NOT_ELIGIBLE';
  } else if (
    needsVerificationCount > 0 ||
    missingProfileCount > 0 ||
    !reqs.hasExtractedAnyRequirement
  ) {
    overallStatus = 'NEEDS_MANUAL_VERIFICATION';
  } else {
    overallStatus = 'ELIGIBLE';
  }

  return {
    overallStatus,
    parsedRequirements: reqs,
    criteria,
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

