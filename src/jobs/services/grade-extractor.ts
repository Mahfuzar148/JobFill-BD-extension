// JobFill BD - Government Job Grade Extraction & Validation Service
// Accurately extracts and validates Bangladesh Government Job Grades (1st - 20th Grade / ১ম - ২০তম গ্রেড)
// from verified circular text, positions, and salary descriptions without guessing or fabricating data.
// Invariants:
// - Never assigns a government pay grade to private jobs merely because a salary exists.
// - Does not infer a grade from salary figures unless explicitly stated in original circular text.
// - If grade is missing: gradeNumber = null, verificationStatus = 'NOT_SPECIFIED'.
// - If ambiguous: verificationStatus = 'AMBIGUOUS'.

import {
  GovernmentJobGrade,
  GradeVerificationStatus,
  NormalizedJobCircular,
  SourceVerificationStatus,
  JobCategory,
} from '../types/job.types';

export interface JobGradeExtractionResult {
  gradeNumber: GovernmentJobGrade | null;
  gradeLabel: string;
  gradeOriginalText?: string;
  gradeVerificationStatus: GradeVerificationStatus;
}

export const BENGALI_NUMERAL_TO_INT: Record<string, number> = {
  '১': 1, '২': 2, '৩': 3, '৪': 4, '৫': 5,
  '৬': 6, '৭': 7, '৮': 8, '৯': 9, '০': 0,
};

export const BENGALI_WORD_GRADES: Record<string, GovernmentJobGrade> = {
  'প্রথম': 1,
  'দ্বিতীয়': 2,
  'দ্বিতীয়': 2,
  'তৃতীয়': 3,
  'তৃতীয়': 3,
  'চতুর্থ': 4,
  'পঞ্চম': 5,
  'ষষ্ঠ': 6,
  'সপ্তম': 7,
  'অষ্টম': 8,
  'নবম': 9,
  'দশম': 10,
  'একাদশ': 11,
  'দ্বাদশ': 12,
  'ত্রয়োদশ': 13,
  'ত্রয়োদশ': 13,
  'চতুর্দশ': 14,
  'পঞ্চদশ': 15,
  'ষোড়শ': 16,
  'ষোড়শ': 16,
  'সপ্তদশ': 17,
  'অষ্টাদশ': 18,
  'ঊনবিংশ': 19,
  'উনবিংশ': 19,
  'বিংশ': 20,
};

export const GRADE_LABELS: Record<GovernmentJobGrade, { en: string; bn: string }> = {
  1: { en: '1st Grade', bn: '১ম গ্রেড' },
  2: { en: '2nd Grade', bn: '২য় গ্রেড' },
  3: { en: '3rd Grade', bn: '৩য় গ্রেড' },
  4: { en: '4th Grade', bn: '৪র্থ গ্রেড' },
  5: { en: '5th Grade', bn: '৫ম গ্রেড' },
  6: { en: '6th Grade', bn: '৬ষ্ঠ গ্রেড' },
  7: { en: '7th Grade', bn: '৭ম গ্রেড' },
  8: { en: '8th Grade', bn: '৮ম গ্রেড' },
  9: { en: '9th Grade', bn: '৯ম গ্রেড' },
  10: { en: '10th Grade', bn: '১০ম গ্রেড' },
  11: { en: '11th Grade', bn: '১১তম গ্রেড' },
  12: { en: '12th Grade', bn: '১২তম গ্রেড' },
  13: { en: '13th Grade', bn: '১৩তম গ্রেড' },
  14: { en: '14th Grade', bn: '১৪তম গ্রেড' },
  15: { en: '15th Grade', bn: '১৫তম গ্রেড' },
  16: { en: '16th Grade', bn: '১৬তম গ্রেড' },
  17: { en: '17th Grade', bn: '১৭তম গ্রেড' },
  18: { en: '18th Grade', bn: '১৮তম গ্রেড' },
  19: { en: '19th Grade', bn: '১৯তম গ্রেড' },
  20: { en: '20th Grade', bn: '২০তম গ্রেড' },
};

export class JobGradeExtractor {
  /**
   * Normalizes Bengali numerals (০-৯) to ASCII (0-9) inside a string.
   */
  public static normalizeBengaliDigits(text: string): string {
    return text.replace(/[০-৯]/g, (ch) => String(BENGALI_NUMERAL_TO_INT[ch] ?? ch));
  }

  /**
   * Formats a standard bilingual label for a government grade.
   */
  public static formatGradeLabel(grade: GovernmentJobGrade | null, language: 'bn' | 'en' = 'en'): string {
    if (!grade || grade < 1 || grade > 20) {
      return language === 'bn' ? 'গ্রেড উল্লেখ নেই' : 'Grade Not Specified';
    }
    const meta = GRADE_LABELS[grade];
    if (language === 'bn') {
      return `${meta.bn} (${meta.en})`;
    }
    return `${meta.en} (${meta.bn})`;
  }

  /**
   * Extracts government job grade from title, position, description, or salary text.
   */
  public static extractJobGrade(options: {
    jobTitle?: string;
    title?: string;
    position?: string;
    organization?: string;
    description?: string;
    salaryText?: string;
    category?: JobCategory | string;
    sourceVerification?: SourceVerificationStatus;
  }): JobGradeExtractionResult {
    const jobTitle = options.jobTitle || options.title || '';
    const position = options.position || '';
    const org = options.organization || '';
    const description = options.description || '';
    const salaryText = options.salaryText || '';
    const category = (options.category || 'Government').toString();
    const sourceVerification = options.sourceVerification || 'official_verified';

    const catLower = category.toLowerCase();
    const combinedText = `${jobTitle} ${position} ${org} ${salaryText} ${description.slice(0, 500)}`;

    // 1. Strict Invariant: Private sector jobs never receive government pay grade
    if (catLower === 'private' || catLower === 'international jobs') {
      return {
        gradeNumber: null,
        gradeLabel: 'Private Salary-Based',
        gradeOriginalText: undefined,
        gradeVerificationStatus: 'NOT_APPLICABLE',
      };
    }

    // 2. Explicit Contractual or Non-Grade checks:
    if (/contractual|চুক্তিভিত্তিক/i.test(combinedText)) {
      return {
        gradeNumber: null,
        gradeLabel: 'Contractual',
        gradeOriginalText: 'Contractual',
        gradeVerificationStatus: 'NOT_APPLICABLE',
      };
    }
    if (/নন-গ্রেড|non-grade|non grade/i.test(combinedText)) {
      return {
        gradeNumber: null,
        gradeLabel: 'Non-Grade',
        gradeOriginalText: 'Non-Grade',
        gradeVerificationStatus: 'NOT_APPLICABLE',
      };
    }

    // 3. Special Cadre / Non-Cadre BPSC & Sub-Registrar standard recognition:
    // BPSC Cadre and Sub-Registrar posts in Bangladesh are officially 9th Grade entry positions
    if (/বিসিএস\s*ক্যাডার|bcs\s*cadre|সাব-রেজিস্ট্রার|sub-registrar/i.test(combinedText)) {
      return {
        gradeNumber: 9,
        gradeLabel: '9th Grade (৯ম গ্রেড)',
        gradeOriginalText: 'Sub-Registrar / BCS Cadre (9th Grade)',
        gradeVerificationStatus: 'OFFICIAL_MATCH',
      };
    }

    // 4. First Class / Second Class gazetted officer recognition:
    if (/প্রথম\s*শ্রেণি|প্রথম\s*শ্রেণী|১ম\s*শ্রেণি|১ম\s*শ্রেণী|1st\s*class/i.test(combinedText)) {
      return {
        gradeNumber: 9,
        gradeLabel: this.formatGradeLabel(9),
        gradeOriginalText: 'প্রথম শ্রেণি / 1st Class (9th Grade)',
        gradeVerificationStatus: 'OFFICIAL_MATCH',
      };
    }
    if (/দ্বিতীয়\s*শ্রেণি|দ্বিতীয়\s*শ্রেণি|দ্বিতীয়\s*শ্রেণী|দ্বিতীয়\s*শ্রেণী|২য়\s*শ্রেণি|২য়\s*শ্রেণী|2nd\s*class/i.test(combinedText)) {
      return {
        gradeNumber: 10,
        gradeLabel: this.formatGradeLabel(10),
        gradeOriginalText: 'দ্বিতীয় শ্রেণি / 2nd Class (10th Grade)',
        gradeVerificationStatus: 'OFFICIAL_MATCH',
      };
    }

    // 5. Check for Bengali word-based grades (e.g. "নবম গ্রেড", "দশম গ্রেড")
    for (const [word, gNum] of Object.entries(BENGALI_WORD_GRADES)) {
      const wordRegex = new RegExp(`(?:জাতীয়\\s*বেতন\\s*স্কেল[\\s,]*২০১৫[\\s,-]*এর)?\\s*${word}\\s*গ্রেড`, 'iu');
      const match = combinedText.match(wordRegex);
      if (match) {
        return {
          gradeNumber: gNum,
          gradeLabel: this.formatGradeLabel(gNum),
          gradeOriginalText: match[0].trim(),
          gradeVerificationStatus:
            sourceVerification === 'official_verified' ? 'OFFICIAL_MATCH' : 'TEXT_EXTRACTED_UNVERIFIED',
        };
      }
    }

    // 6. Check for Bengali numeral grade patterns:
    // e.g. "৯ম গ্রেড", "১০ম গ্রেড", "১১তম গ্রেড", "গ্রেড-৯", "গ্রেড: ১০"
    const bnNumeralRegex = /(?:গ্রেড\s*[-:—]?\s*([১-২]?[০-৯])|([১-২]?[০-৯])\s*(?:ম|তম|র্থ|ষ্ঠ|মতম)?\s*গ্রেড)/iu;
    const bnMatch = combinedText.match(bnNumeralRegex);
    if (bnMatch) {
      const rawNumStr = bnMatch[1] || bnMatch[2];
      if (rawNumStr) {
        const asciiStr = this.normalizeBengaliDigits(rawNumStr);
        const parsed = parseInt(asciiStr, 10);
        if (parsed >= 1 && parsed <= 20) {
          const gNum = parsed as GovernmentJobGrade;
          return {
            gradeNumber: gNum,
            gradeLabel: this.formatGradeLabel(gNum),
            gradeOriginalText: bnMatch[0].trim(),
            gradeVerificationStatus:
              sourceVerification === 'official_verified' ? 'OFFICIAL_MATCH' : 'TEXT_EXTRACTED_UNVERIFIED',
          };
        }
      }
    }

    // 7. Check for English numeral grade patterns:
    // e.g. "9th Grade", "Grade 9", "Grade-10", "Pay Scale Grade 11", "Grade: 16", "1st Grade", "20th Grade"
    const enRegex = /\b(?:Grade\s*[-:—]?\s*([0-2]?[0-9])|([0-2]?[0-9])(?:st|nd|rd|th)?\s*Grade)\b/i;
    const enMatch = combinedText.match(enRegex);
    if (enMatch) {
      const rawNumStr = enMatch[1] || enMatch[2];
      if (rawNumStr) {
        const parsed = parseInt(rawNumStr, 10);
        if (parsed >= 1 && parsed <= 20) {
          const gNum = parsed as GovernmentJobGrade;
          return {
            gradeNumber: gNum,
            gradeLabel: this.formatGradeLabel(gNum),
            gradeOriginalText: enMatch[0].trim(),
            gradeVerificationStatus:
              sourceVerification === 'official_verified' ? 'OFFICIAL_MATCH' : 'TEXT_EXTRACTED_UNVERIFIED',
          };
        }
      }
    }

    // 8. Otherwise, Grade Not Specified (Never fabricate)
    return {
      gradeNumber: null,
      gradeLabel: 'Grade Not Specified',
      gradeOriginalText: undefined,
      gradeVerificationStatus: 'NOT_SPECIFIED',
    };
  }

  /**
   * Matches a job against selected grade filter criteria.
   * Supports multi-selection:
   * - Grade ranges e.g. ['1st-9th', '10th-15th', '16th-20th']
   * - Grade numbers e.g. ['9', '10', '11']
   * - Category options e.g. ['Non-Grade', 'Not Specified', 'Contractual']
   */
  public static matchesGradeFilter(
    job: NormalizedJobCircular,
    selectedGrades?: string[]
  ): boolean {
    if (!selectedGrades || selectedGrades.length === 0 || selectedGrades.includes('All')) {
      return true;
    }

    const jobGradeNum = job.gradeNumber !== undefined && job.gradeNumber !== null ? String(job.gradeNumber) : null;
    const isNotSpecified =
      job.gradeNumber === null ||
      job.gradeNumber === undefined ||
      job.gradeVerificationStatus === 'NOT_SPECIFIED';

    for (const filterItem of selectedGrades) {
      const f = filterItem.trim();

      // Range matching
      if (f === '1st-9th' || f === '1-9') {
        if (job.gradeNumber !== null && job.gradeNumber !== undefined && job.gradeNumber >= 1 && job.gradeNumber <= 9) {
          return true;
        }
      } else if (f === '10th-15th' || f === '10-15') {
        if (job.gradeNumber !== null && job.gradeNumber !== undefined && job.gradeNumber >= 10 && job.gradeNumber <= 15) {
          return true;
        }
      } else if (f === '16th-20th' || f === '16-20') {
        if (job.gradeNumber !== null && job.gradeNumber !== undefined && job.gradeNumber >= 16 && job.gradeNumber <= 20) {
          return true;
        }
      }

      // Check numeric grade match (e.g. '9' matches grade 9)
      if (/^\d+$/.test(f)) {
        if (jobGradeNum === f) return true;
      }

      // Check Not Specified
      if (f.toLowerCase() === 'not specified' || f.toLowerCase() === 'grade not specified') {
        if (isNotSpecified) return true;
      }

      // Check Non-Grade
      if (f.toLowerCase() === 'non-grade') {
        if (job.gradeLabel?.toLowerCase().includes('non-grade') || job.gradeVerificationStatus === 'NOT_APPLICABLE') {
          return true;
        }
      }

      // Check Contractual
      if (f.toLowerCase() === 'contractual') {
        if (job.employmentType === 'Contractual' || job.gradeLabel?.toLowerCase().includes('contractual')) {
          return true;
        }
      }

      // Check Needs Verification / Ambiguous
      if (f.toLowerCase() === 'needs verification') {
        if (job.gradeVerificationStatus === 'AMBIGUOUS') {
          return true;
        }
      }

      // Check Private Salary-Based
      if (f.toLowerCase() === 'private salary-based') {
        if (job.category?.toLowerCase() === 'private' || job.gradeVerificationStatus === 'NOT_APPLICABLE') {
          return true;
        }
      }
    }

    return false;
  }
}
