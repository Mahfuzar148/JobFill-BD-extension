// JobFill BD - Local Offline Age-on-Circular-Cutoff & Eligibility Helper
// Performs exact calendar age math strictly locally inside the browser without network calls.

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
