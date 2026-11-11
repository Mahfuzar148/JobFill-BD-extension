// JobFill BD - Value & Character Constraint Validator
// Implements Section 20 of Master Specification:
// Preserves leading zeros in roll/reg/phone/postal identifiers and enforces character ceilings.

export class ValueValidator {
  /**
   * Asserts that leading zeros are preserved in identifiers
   */
  public static preservesLeadingZero(original: string, processed: string): boolean {
    if (original.startsWith('0')) {
      return processed.startsWith('0') && original.length === processed.length;
    }
    return true;
  }

  /**
   * Validates and trims text to character ceiling (e.g. 300 chars for Job Description)
   */
  public static enforceCharacterLimit(text: string, maxChars = 300): {
    isWithinLimit: boolean;
    currentLength: number;
    maxLimit: number;
    trimmedText: string;
  } {
    const len = text ? text.length : 0;
    return {
      isWithinLimit: len <= maxChars,
      currentLength: len,
      maxLimit: maxChars,
      trimmedText: text ? text.slice(0, maxChars) : '',
    };
  }

  /**
   * Checks if a string contains valid Bengali script characters
   */
  public static containsBengaliScript(text: string): boolean {
    if (!text) return false;
    // Bengali Unicode block: U+0980 to U+09FF
    return /[\u0980-\u09FF]/.test(text);
  }

  /**
   * Checks if an English name string is uppercase as required by Bangladesh recruitment portals
   */
  public static isUppercaseEnglish(text: string): boolean {
    if (!text || !text.trim()) return false;
    const clean = text.replace(/[^a-zA-Z]/g, '');
    return clean.length > 0 && clean === clean.toUpperCase();
  }

  /**
   * Sanitizes numeric string while guaranteeing leading zeros are never removed
   */
  public static sanitizeNumericString(value: string): string {
    if (!value) return '';
    // Strip non-digits but keep all digits intact
    return value.replace(/\D/g, '');
  }
}
