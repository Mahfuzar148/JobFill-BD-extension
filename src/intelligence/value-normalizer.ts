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

  // Format Bangladesh mobile phone number consistently
  public static normalizeMobileNumber(raw: string): string {
    const englishDigits = this.toEnglishNumerals(raw).replace(/\D/g, '');
    if (englishDigits.startsWith('8801') && englishDigits.length === 13) {
      return englishDigits.substring(2);
    }
    if (englishDigits.startsWith('01') && englishDigits.length === 11) {
      return englishDigits;
    }
    return raw.trim();
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
      const match = norm.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
      if (match) {
        const [, y, m, d] = match;
        const yNum = Number(y), mNum = Number(m), dNum = Number(d);
        if (!this.isValidCalendarDate(yNum, mNum, dNum)) return '';
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
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
    if (hintLower.includes('yyyy-mm-dd')) {
      return `${year}-${month}-${day}`;
    }
    if (hintLower.includes('dd/mm/yyyy')) {
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
