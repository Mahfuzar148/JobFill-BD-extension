// JobFill BD - Layer 1: Value Normalizer
// Implements Part N & Part E of Master Engineering Specification:
// Unicode normalization, Bengali numeral conversion, robust date/phone/NID formatting,
// and string cleaning without ever mutating or rounding sensitive personal data.

export class ValueNormalizer {
  // Bengali to English numeral mapping
  private static readonly BN_TO_EN_DIGITS: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
  };

  private static readonly EN_TO_BN_DIGITS: Record<string, string> = {
    '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
    '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯',
  };

  // Convert Bengali numerals to Western Arabic numerals (0-9)
  public static toEnglishNumerals(input: string): string {
    if (!input) return '';
    return input.replace(/[০-৯]/g, (char) => this.BN_TO_EN_DIGITS[char] || char);
  }

  // Convert Western Arabic numerals (0-9) to Bengali numerals
  public static toBengaliNumerals(input: string): string {
    if (!input) return '';
    return input.replace(/[0-9]/g, (char) => this.EN_TO_BN_DIGITS[char] || char);
  }

  // Unicode normalization (NFC), lowercase, extra whitespace collapsed
  public static cleanText(text: string): string {
    if (!text) return '';
    return text
      .normalize('NFC')
      .toLowerCase()
      .replace(/[\s\-_.\/():,;|ঃ।?!*\[\]{}•]+/g, ' ')
      .trim();
  }

  // Tokenize text into normalized unique words
  public static tokenize(text: string): string[] {
    const cleaned = this.cleanText(text);
    return cleaned.split(' ').filter((w) => w.length > 0);
  }

  // Format Bangladesh mobile phone number consistently (strict string, leading zero preservation)
  public static normalizeMobileNumber(raw: string | number): string {
    if (!raw && raw !== 0) return '';
    const str = String(raw).trim();
    const englishDigits = this.toEnglishNumerals(str).replace(/\D/g, '');
    if (englishDigits.startsWith('8801') && englishDigits.length === 13) {
      return englishDigits.substring(2);
    }
    if (englishDigits.startsWith('01') && englishDigits.length === 11) {
      return englishDigits;
    }
    // If leading zero was stripped by numeric parsing (e.g. 1712345678 -> 10 digits starting with 1)
    if (englishDigits.startsWith('1') && englishDigits.length === 10) {
      return '0' + englishDigits;
    }
    return str;
  }

  // Format National ID (strips hyphens/spaces, preserves leading zeros)
  public static normalizeNid(raw: string): string {
    const englishDigits = this.toEnglishNumerals(raw).replace(/\s|-/g, '');
    return englishDigits.trim();
  }

  // Strict calendar date validation (checks leap years, days in month)
  public static isValidCalendarDate(year: number, month: number, day: number): boolean {
    if (isNaN(year) || isNaN(month) || isNaN(day)) return false;
    if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false;
    const dateObj = new Date(year, month - 1, day);
    return (
      dateObj.getFullYear() === year &&
      dateObj.getMonth() === month - 1 &&
      dateObj.getDate() === day
    );
  }

  // Helper to compute standard ISO-8601 week string YYYY-Www
  public static getISOWeekString(year: number, month: number, day: number): string {
    const d = new Date(Date.UTC(year, month - 1, day));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }

  // Robust date normalization: parses DD-MM-YYYY, YYYY-MM-DD, or DD/MM/YYYY into required target format
  public static formatDateForTarget(
    isoDate: string, // YYYY-MM-DD
    targetType: string,
    placeholderHint: string = ''
  ): string {
    if (!isoDate) return '';
    const norm = this.toEnglishNumerals(isoDate).trim();

    // HTML5 date inputs strictly require YYYY-MM-DD
    if (targetType === 'date') {
      const matchYMD = norm.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
      if (matchYMD) {
        const [, y, m, d] = matchYMD;
        const yNum = Number(y), mNum = Number(m), dNum = Number(d);
        if (!this.isValidCalendarDate(yNum, mNum, dNum)) return '';
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      const matchDMY = norm.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
      if (matchDMY) {
        const [, d, m, y] = matchDMY;
        const yNum = Number(y), mNum = Number(m), dNum = Number(d);
        if (!this.isValidCalendarDate(yNum, mNum, dNum)) return '';
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      return norm;
    }

    // HTML5 month inputs strictly require YYYY-MM
    if (targetType === 'month') {
      const matchYM = norm.match(/^(\d{4})[-/.](\d{1,2})$/);
      if (matchYM) {
        const [, y, m] = matchYM;
        const yNum = Number(y), mNum = Number(m);
        if (yNum < 1900 || yNum > 2100 || mNum < 1 || mNum > 12) return '';
        return `${y}-${m.padStart(2, '0')}`;
      }
      const matchYMD = norm.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
      if (matchYMD) {
        const [, y, m, d] = matchYMD;
        const yNum = Number(y), mNum = Number(m), dNum = Number(d);
        if (!this.isValidCalendarDate(yNum, mNum, dNum)) return '';
        return `${y}-${m.padStart(2, '0')}`;
      }
      const matchDMY = norm.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
      if (matchDMY) {
        const [, d, m, y] = matchDMY;
        const yNum = Number(y), mNum = Number(m), dNum = Number(d);
        if (!this.isValidCalendarDate(yNum, mNum, dNum)) return '';
        return `${y}-${m.padStart(2, '0')}`;
      }
      return norm;
    }

    // HTML5 week inputs strictly require YYYY-Www
    if (targetType === 'week') {
      const matchWeek = norm.match(/^(\d{4})-W(\d{1,2})$/i);
      if (matchWeek) {
        return `${matchWeek[1]}-W${matchWeek[2].padStart(2, '0')}`;
      }
      const matchYMD = norm.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
      if (matchYMD) {
        const [, y, m, d] = matchYMD;
        const yNum = Number(y), mNum = Number(m), dNum = Number(d);
        if (!this.isValidCalendarDate(yNum, mNum, dNum)) return '';
        return this.getISOWeekString(yNum, mNum, dNum);
      }
      const matchDMY = norm.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
      if (matchDMY) {
        const [, d, m, y] = matchDMY;
        const yNum = Number(y), mNum = Number(m), dNum = Number(d);
        if (!this.isValidCalendarDate(yNum, mNum, dNum)) return '';
        return this.getISOWeekString(yNum, mNum, dNum);
      }
      return norm;
    }

    // HTML5 time inputs strictly require HH:MM
    if (targetType === 'time') {
      const matchTime = norm.match(/^(\d{1,2}):(\d{2})(:(\d{2}))?$/);
      if (matchTime) {
        const h = Number(matchTime[1]);
        const m = Number(matchTime[2]);
        if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        }
      }
      return norm;
    }

    // Parse input date parts
    let day = '', month = '', year = '';
    if (norm.includes('-') || norm.includes('/')) {
      const parts = norm.split(/[-/]/);
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        [year, month, day] = parts;
      } else if (parts[2]?.length === 4) {
        // DD-MM-YYYY
        [day, month, year] = parts;
      }
    }

    if (!day || !month || !year) return norm;

    const yNum = Number(year), mNum = Number(month), dNum = Number(day);
    if (!this.isValidCalendarDate(yNum, mNum, dNum)) return '';

    day = day.padStart(2, '0');
    month = month.padStart(2, '0');

    const hintLower = placeholderHint.toLowerCase();
    if (hintLower.includes('yyyy-mm-dd') || hintLower.includes('yyyy/mm/dd') || hintLower.includes('yyyy mm dd')) {
      return `${year}-${month}-${day}`;
    }
    if (
      hintLower.includes('dd/mm/yyyy') ||
      hintLower.includes('/') ||
      hintLower.includes('dd mm yyyy') ||
      hintLower.includes('dd/mm/yy') ||
      hintLower.includes('dd mm yy')
    ) {
      return `${day}/${month}/${year}`;
    }
    if (hintLower.includes('dd-mm-yy') && !hintLower.includes('yyyy')) {
      return `${day}-${month}-${year.substring(2)}`;
    }

    // Default Bangladesh government standard: DD-MM-YYYY
    return `${day}-${month}-${year}`;
  }

  // Safely truncate string to maxLength without throwing
  public static truncate(text: string, maxLength: number): string {
    if (!text || maxLength <= 0) return text;
    return text.length > maxLength ? text.substring(0, maxLength) : text;
  }
}
