// JobFill BD - Strict Asia/Dhaka Deadline Parser & Countdown Utility
// Bangladesh Standard Time (Asia/Dhaka) is UTC+06:00 year-round (no DST).
// NEVER guesses or invents missing/invalid deadlines.

export const DHAKA_OFFSET_MINUTES = 6 * 60;
export const DHAKA_OFFSET_MS = DHAKA_OFFSET_MINUTES * 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

export interface ParsedDeadlineResult {
  timestamp: number | null;
  isVerified: boolean;
  originalText: string;
  timezone: 'Asia/Dhaka';
  error?: string;
}

const BENGALI_DIGITS: Record<string, string> = {
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

const MONTH_MAP: Record<string, number> = {
  january: 1, jan: 1, 'জানুয়ারি': 1, 'জানুয়ারী': 1, 'জানুয়ারি': 1,
  february: 2, feb: 2, 'ফেব্রুয়ারি': 2, 'ফেব্রুয়ারী': 2, 'ফেব্রুয়ারি': 2,
  march: 3, mar: 3, 'মার্চ': 3,
  april: 4, apr: 4, 'এপ্রিল': 4,
  may: 5, 'মে': 5,
  june: 6, jun: 6, 'জুন': 6,
  july: 7, jul: 7, 'জুলাই': 7,
  august: 8, aug: 8, 'আগস্ট': 8,
  september: 9, sep: 9, sept: 9, 'সেপ্টেম্বর': 9,
  october: 10, oct: 10, 'অক্টোবর': 10,
  november: 11, nov: 11, 'নভেম্বর': 11,
  december: 12, dec: 12, 'ডিসেম্বর': 12,
};

export function normalizeDigits(input: string): string {
  return input.replace(/[০-৯]/g, (ch) => BENGALI_DIGITS[ch] ?? ch);
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const check = new Date(Date.UTC(year, month - 1, day));
  return (
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day
  );
}

/**
 * Converts a Dhaka local wall-clock date/time into UTC epoch milliseconds.
 */
export function dhakaWallTimeToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number = 23,
  minute: number = 59,
  second: number = 59
): number {
  return Date.UTC(year, month - 1, day, hour, minute, second) - DHAKA_OFFSET_MS;
}

/**
 * Returns YYYY-MM-DD in Asia/Dhaka timezone for any UTC timestamp.
 */
export function getDhakaDateKey(utcMs: number): string {
  const shifted = new Date(utcMs + DHAKA_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns wall-clock components in Asia/Dhaka timezone.
 */
export function getDhakaParts(utcMs: number): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const shifted = new Date(utcMs + DHAKA_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  };
}

/**
 * Returns Sunday 00:00:00.000 through Saturday 23:59:59.999 in Asia/Dhaka for the week containing `now`.
 */
export function getDhakaWeekBounds(now: number = Date.now()): { weekStartMs: number; weekEndMs: number } {
  const shifted = new Date(now + DHAKA_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth() + 1;
  const day = shifted.getUTCDate();
  const dayOfWeek = shifted.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const todayStartMs = dhakaWallTimeToUtcMs(year, month, day, 0, 0, 0);
  const weekStartMs = todayStartMs - dayOfWeek * DAY_MS;
  const weekEndMs = weekStartMs + 7 * DAY_MS - 1;
  return { weekStartMs, weekEndMs };
}

/**
 * Returns true strictly when a verified published timestamp falls in the current Asia/Dhaka calendar week.
 */
export function isTimestampInCurrentDhakaWeek(ts: number | null | undefined, now: number = Date.now()): boolean {
  if (typeof ts !== 'number' || !Number.isFinite(ts)) return false;
  const { weekStartMs, weekEndMs } = getDhakaWeekBounds(now);
  return ts >= weekStartMs && ts <= weekEndMs;
}

function parseOptionalTime(text: string): { hour: number; minute: number; second: number; explicit: boolean } {
  const match = text.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!match) {
    return { hour: 23, minute: 59, second: 59, explicit: false };
  }
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = match[3] ? Number(match[3]) : 0;
  const ampm = match[4]?.toLowerCase();

  if (minute > 59 || second > 59 || hour > 23) {
    return { hour: -1, minute: -1, second: -1, explicit: true };
  }
  if (ampm === 'pm' && hour < 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;
  if (ampm && (hour > 23 || Number(match[1]) > 12 || Number(match[1]) < 1)) {
    return { hour: -1, minute: -1, second: -1, explicit: true };
  }
  return { hour, minute, second, explicit: true };
}

/**
 * Parses an explicit, verified date string into UTC milliseconds anchored to Asia/Dhaka.
 * Returns null timestamp if missing, ambiguous, vague, or invalid.
 */
export function parseDeadlineDate(rawInput?: string | number | null): ParsedDeadlineResult {
  if (typeof rawInput === 'number') {
    if (Number.isFinite(rawInput) && rawInput > 946684800000 && rawInput < 4102444800000) {
      return {
        timestamp: rawInput,
        isVerified: true,
        originalText: new Date(rawInput).toISOString(),
        timezone: 'Asia/Dhaka',
      };
    }
    return {
      timestamp: null,
      isVerified: false,
      originalText: String(rawInput),
      timezone: 'Asia/Dhaka',
      error: 'Invalid numeric timestamp',
    };
  }

  const originalText = (rawInput || '').trim();
  if (!originalText) {
    return {
      timestamp: null,
      isVerified: false,
      originalText: '',
      timezone: 'Asia/Dhaka',
      error: 'Missing deadline text',
    };
  }

  const normalized = normalizeDigits(originalText).replace(/,/g, ' ').replace(/\s+/g, ' ').trim();

  // Reject vague/unverified terms
  if (/^(soon|ongoing|tba|tbd|n\/a|na|open|running|not\s*specified|deadline\s*not\s*verified|-+|—)$/i.test(normalized)) {
    return {
      timestamp: null,
      isVerified: false,
      originalText,
      timezone: 'Asia/Dhaka',
      error: 'Unverified or vague deadline text',
    };
  }

  // 1. Strict ISO 8601 with explicit timezone or date-only YYYY-MM-DD
  const isoWithTz = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/i);
  if (isoWithTz) {
    const year = Number(isoWithTz[1]);
    const month = Number(isoWithTz[2]);
    const day = Number(isoWithTz[3]);
    const hour = Number(isoWithTz[4]);
    const minute = Number(isoWithTz[5]);
    const second = isoWithTz[6] ? Number(isoWithTz[6]) : 0;
    if (!isValidCalendarDate(year, month, day) || hour > 23 || minute > 59 || second > 59) {
      return { timestamp: null, isVerified: false, originalText, timezone: 'Asia/Dhaka', error: 'Invalid ISO calendar date/time' };
    }
    const ms = Date.parse(normalized);
    if (Number.isFinite(ms)) {
      return { timestamp: ms, isVerified: true, originalText, timezone: 'Asia/Dhaka' };
    }
  }

  // 2. YYYY-MM-DD (optional HH:mm)
  const ymdMatch = normalized.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(.*))?$/);
  if (ymdMatch) {
    const year = Number(ymdMatch[1]);
    const month = Number(ymdMatch[2]);
    const day = Number(ymdMatch[3]);
    if (!isValidCalendarDate(year, month, day)) {
      return { timestamp: null, isVerified: false, originalText, timezone: 'Asia/Dhaka', error: 'Invalid YYYY-MM-DD calendar date' };
    }
    const time = parseOptionalTime(ymdMatch[4] || '');
    if (time.hour < 0) {
      return { timestamp: null, isVerified: false, originalText, timezone: 'Asia/Dhaka', error: 'Invalid time' };
    }
    return {
      timestamp: dhakaWallTimeToUtcMs(year, month, day, time.hour, time.minute, time.second),
      isVerified: true,
      originalText,
      timezone: 'Asia/Dhaka',
    };
  }

  // 3. DD/MM/YYYY or DD-MM-YYYY (Bangladesh standard official format, e.g. 13/11/2026 or 05-11-2026)
  const dmyMatch = normalized.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:\s+(.*))?$/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    const year = Number(dmyMatch[3]);
    if (!isValidCalendarDate(year, month, day)) {
      return { timestamp: null, isVerified: false, originalText, timezone: 'Asia/Dhaka', error: 'Invalid DD/MM/YYYY calendar date' };
    }
    const time = parseOptionalTime(dmyMatch[4] || '');
    if (time.hour < 0) {
      return { timestamp: null, isVerified: false, originalText, timezone: 'Asia/Dhaka', error: 'Invalid time' };
    }
    return {
      timestamp: dhakaWallTimeToUtcMs(year, month, day, time.hour, time.minute, time.second),
      isVerified: true,
      originalText,
      timezone: 'Asia/Dhaka',
    };
  }

  // 4. DD Month YYYY or Month DD YYYY (English or Bengali months)
  const tokens = normalized.split(' ');
  if (tokens.length >= 3) {
    let day = -1;
    let month = -1;
    let year = -1;
    let restText = '';

    const m1 = MONTH_MAP[tokens[1].toLowerCase()];
    const m0 = MONTH_MAP[tokens[0].toLowerCase()];

    if (m1 && /^\d{1,2}$/.test(tokens[0]) && /^\d{4}$/.test(tokens[2])) {
      day = Number(tokens[0]);
      month = m1;
      year = Number(tokens[2]);
      restText = tokens.slice(3).join(' ');
    } else if (m0 && /^\d{1,2}$/.test(tokens[1]) && /^\d{4}$/.test(tokens[2])) {
      month = m0;
      day = Number(tokens[1]);
      year = Number(tokens[2]);
      restText = tokens.slice(3).join(' ');
    }

    if (year > 0 && isValidCalendarDate(year, month, day)) {
      const time = parseOptionalTime(restText);
      if (time.hour < 0) {
        return { timestamp: null, isVerified: false, originalText, timezone: 'Asia/Dhaka', error: 'Invalid time' };
      }
      return {
        timestamp: dhakaWallTimeToUtcMs(year, month, day, time.hour, time.minute, time.second),
        isVerified: true,
        originalText,
        timezone: 'Asia/Dhaka',
      };
    }
  }

  return {
    timestamp: null,
    isVerified: false,
    originalText,
    timezone: 'Asia/Dhaka',
    error: 'Unrecognized date format',
  };
}

export interface RemainingTimeBreakdown {
  isVerified: boolean;
  isExpired: boolean;
  remainingMs: number;
  days: number;
  hours: number;
  minutes: number;
  totalHours: number;
  urgencyTier: 'unverified' | 'expired' | 'critical_lt_2h' | 'urgent_24h' | 'urgent_48h' | 'closing_soon_7d' | 'normal';
  labelEn: string;
  labelBn: string;
}

export function calculateRemainingTime(
  deadlineAt: number | null | undefined,
  deadlineVerified: boolean,
  now: number = Date.now()
): RemainingTimeBreakdown {
  if (!deadlineVerified || typeof deadlineAt !== 'number' || !Number.isFinite(deadlineAt)) {
    return {
      isVerified: false,
      isExpired: false,
      remainingMs: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      totalHours: 0,
      urgencyTier: 'unverified',
      labelEn: 'Deadline Not Verified',
      labelBn: 'শেষ তারিখ যাচাইকৃত নয়',
    };
  }

  const remainingMs = deadlineAt - now;
  if (remainingMs <= 0) {
    return {
      isVerified: true,
      isExpired: true,
      remainingMs: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      totalHours: 0,
      urgencyTier: 'expired',
      labelEn: 'Deadline Passed',
      labelBn: 'আবেদনের সময় শেষ',
    };
  }

  const totalMinutes = Math.floor(remainingMs / 60000);
  const totalHours = Math.ceil(remainingMs / HOUR_MS);
  const days = Math.floor(remainingMs / DAY_MS);
  const hours = Math.floor((remainingMs % DAY_MS) / HOUR_MS);
  const minutes = totalMinutes % 60;

  let urgencyTier: RemainingTimeBreakdown['urgencyTier'] = 'normal';
  if (remainingMs < 2 * HOUR_MS) urgencyTier = 'critical_lt_2h';
  else if (remainingMs <= 24 * HOUR_MS) urgencyTier = 'urgent_24h';
  else if (remainingMs <= 48 * HOUR_MS) urgencyTier = 'urgent_48h';
  else if (remainingMs <= 7 * DAY_MS) urgencyTier = 'closing_soon_7d';

  let labelEn: string;
  let labelBn: string;
  if (days >= 2) {
    labelEn = `${days} Days`;
    labelBn = `${days} দিন বাকি`;
  } else if (remainingMs > 24 * HOUR_MS) {
    const hrs = Math.ceil(remainingMs / HOUR_MS);
    labelEn = `${hrs} Hours`;
    labelBn = `${hrs} ঘণ্টা বাকি`;
  } else if (remainingMs >= 2 * HOUR_MS) {
    const hrs = Math.floor(remainingMs / HOUR_MS);
    labelEn = `${hrs} Hours ${minutes > 0 ? `${minutes}m` : ''}`.trim();
    labelBn = `${hrs} ঘণ্টা${minutes > 0 ? ` ${minutes} মি.` : ''} বাকি`;
  } else {
    const hrs = Math.floor(remainingMs / HOUR_MS);
    labelEn = hrs > 0 ? `${hrs}h ${minutes}m left` : `${Math.max(1, minutes)}m left`;
    labelBn = hrs > 0 ? `${hrs} ঘণ্টা ${minutes} মি. বাকি` : `${Math.max(1, minutes)} মিনিট বাকি`;
  }

  return {
    isVerified: true,
    isExpired: false,
    remainingMs,
    days,
    hours,
    minutes,
    totalHours,
    urgencyTier,
    labelEn,
    labelBn,
  };
}

export function formatDhakaDate(timestamp: number | null | undefined, fallbackText?: string): string {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
    return fallbackText || 'Deadline Not Verified';
  }
  const { year, month, day } = getDhakaParts(timestamp);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(day).padStart(2, '0')} ${monthNames[month - 1]} ${year}`;
}
