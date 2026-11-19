// JobFill BD - Bangladesh Government Recruitment Notice Classifier
// Strictly distinguishes between:
// 1. PRIMARY_JOB_CIRCULAR (Eligible for new/updated job card)
// 2. RECRUITMENT_UPDATE (Linked to existing job card: Exam, Admit Card, Viva, Result)
// 3. ADMINISTRATIVE_NON_JOB (Strictly excluded: Transfer, Promotion, Retirement, Tender, Memo, Office Order)

import {
  NoticeClassificationCategory,
  NoticeClassificationResult,
  PrimaryJobSubtype,
  RecruitmentUpdateSubtype,
  AdministrativeNonJobSubtype,
} from '../types/government.types';

export class GovernmentNoticeClassifier {
  /**
   * Evaluates notice title and details to categorize the exact government notice type.
   */
  public static classifyNotice(
    title: string,
    details?: string,
    pdfUrl?: string
  ): NoticeClassificationResult {
    const raw = `${title || ''} ${details || ''}`.trim();
    const norm = raw.toLowerCase();
    const matchedKeywords: string[] = [];

    // =======================================================================
    // STEP 1: EXCLUSION CHECK — ADMINISTRATIVE NON-JOB NOTICES (Tender, Transfer, Memo)
    // =======================================================================

    // A. Tender & Procurement
    if (/(?:দরপত্র|টেন্ডার|tender|procurement|rfp|eoi|quotation|নিলাম|auction|pre-qualification)/i.test(norm)) {
      matchedKeywords.push('tender_procurement');
      return {
        category: 'ADMINISTRATIVE_NON_JOB',
        subtype: 'TENDER',
        isRecruitmentRelated: false,
        isJobCardEligible: false,
        confidenceScore: 95,
        matchedKeywords,
        exclusionEvidence: 'Identified as procurement or commercial tender notice.',
      };
    }

    // B. Employee Transfer / Posting
    if (/(?:বদলির?\s*আদেশ|কর্মস্থল\s*পরিবর্তন|কর্মস্থল\s*নির্ধারণ|বদলিপূর্বক|transfer\s*order|posting\s*order)/i.test(norm)) {
      matchedKeywords.push('employee_transfer');
      return {
        category: 'ADMINISTRATIVE_NON_JOB',
        subtype: 'TRANSFER',
        isRecruitmentRelated: false,
        isJobCardEligible: false,
        confidenceScore: 92,
        matchedKeywords,
        exclusionEvidence: 'Identified as routine internal employee transfer or posting order.',
      };
    }

    // C. Promotion & Seniority
    if (/(?:পদোন্নতি|জ্যেষ্ঠতা\s*তালিকা|seniority\s*list|promotion\s*order)/i.test(norm) && !/নিয়োগ|recruitment/i.test(norm)) {
      matchedKeywords.push('employee_promotion');
      return {
        category: 'ADMINISTRATIVE_NON_JOB',
        subtype: 'PROMOTION',
        isRecruitmentRelated: false,
        isJobCardEligible: false,
        confidenceScore: 90,
        matchedKeywords,
        exclusionEvidence: 'Identified as existing employee promotion or seniority list.',
      };
    }

    // D. Retirement / PRL
    if (/(?:অবসর\s*গ্রহণ|অবসরোত্তর\s*ছুটি|পিআরএল|prl\s*order|retirement\s*notice)/i.test(norm)) {
      matchedKeywords.push('employee_retirement');
      return {
        category: 'ADMINISTRATIVE_NON_JOB',
        subtype: 'RETIREMENT',
        isRecruitmentRelated: false,
        isJobCardEligible: false,
        confidenceScore: 90,
        matchedKeywords,
        exclusionEvidence: 'Identified as official retirement or post-retirement leave memo.',
      };
    }

    // E. Routine Office Order, Meeting, Leave
    if (/(?:অফিস\s*আদেশ|দাপ্তরিক\s*আদেশ|অফিস\s*স্মারক|সভার\s*নোটিশ|ছুটি\s*মঞ্জুর|বহিঃ\s*বাংলাদেশ\s*ছুটি|meeting\s*notice|leave\s*order|office\s*memo)/i.test(norm) &&
        !/নিয়োগ|পরীক্ষা|আবেদন|recruitment|circular|vacancy/i.test(norm)) {
      matchedKeywords.push('office_order');
      return {
        category: 'ADMINISTRATIVE_NON_JOB',
        subtype: 'OFFICE_ORDER',
        isRecruitmentRelated: false,
        isJobCardEligible: false,
        confidenceScore: 85,
        matchedKeywords,
        exclusionEvidence: 'Identified as routine administrative memo or meeting notice without recruitment scope.',
      };
    }

    // =======================================================================
    // STEP 2: RECRUITMENT UPDATES LINKED TO EXISTING JOBS (Admit, Exam, Result)
    // =======================================================================

    // A. Admit Card Download Notice
    if (/(?:প্রবেশপত্র|এডমিট\s*কার্ড|admit\s*card|download\s*admit)/i.test(norm)) {
      matchedKeywords.push('admit_card');
      return {
        category: 'RECRUITMENT_UPDATE',
        subtype: 'ADMIT_CARD',
        isRecruitmentRelated: true,
        isJobCardEligible: false,
        confidenceScore: 95,
        matchedKeywords,
        linkedJobCandidateKey: this.extractJobMatchingKey(title),
      };
    }

    // B. Examination Schedule & Seat Plan
    if (/(?:পরীক্ষার\s*সময়সূচি|পরীক্ষার\s*তারিখ|আসন\s*বিন্যাস|লিখিত\s*পরীক্ষা|এমসিকিউ\s*পরীক্ষা|ব্যবহারিক\s*পরীক্ষা|মৌখিক\s*পরীক্ষা|ভাইভা|exam\s*schedule|exam\s*date|seat\s*plan|written\s*exam|mcq\s*exam|viva\s*voce)/i.test(norm) &&
        !/(?:নিয়োগ\s*বিজ্ঞপ্তি|শূন্য\s*পদে|job\s*circular|new\s*vacancy|ফলাফল|result|উত্তীর্ণ|নির্বাচিত|selected)/i.test(norm)) {
      matchedKeywords.push('exam_schedule');
      const subtype: RecruitmentUpdateSubtype =
        /(?:লিখিত|written)/i.test(norm)
          ? 'EXAM_SCHEDULE_WRITTEN'
          : /(?:mcq|এমসিকিউ)/i.test(norm)
            ? 'EXAM_SCHEDULE_MCQ'
            : /(?:ব্যবহারিক|practical)/i.test(norm)
              ? 'EXAM_SCHEDULE_PRACTICAL'
              : /(?:মৌখিক|ভাইভা|viva)/i.test(norm)
                ? 'EXAM_SCHEDULE_VIVA'
                : 'EXAM_SCHEDULE_WRITTEN';

      return {
        category: 'RECRUITMENT_UPDATE',
        subtype,
        isRecruitmentRelated: true,
        isJobCardEligible: false,
        confidenceScore: 92,
        matchedKeywords,
        linkedJobCandidateKey: this.extractJobMatchingKey(title),
      };
    }

    // C. Recruitment Results & Selection Lists
    if (/(?:পরীক্ষার\s*ফলাফল|লিখিত\s*পরীক্ষার\s*ফলাফল|চূড়ান্ত\s*ফলাফল|উত্তীর্ণ\s*প্রার্থীদের\s*তালিকা|লিখিত\s*পরীক্ষায়\s*উত্তীর্ণ|নির্বাচিত\s*প্রার্থী|exam\s*result|preliminary\s*result|written\s*result|final\s*result|selected\s*candidates)/i.test(norm) &&
        !/(?:নিয়োগ\s*বিজ্ঞপ্তি|দরখাস্ত\s*আহ্বান|job\s*circular)/i.test(norm)) {
      matchedKeywords.push('recruitment_result');
      const subtype: RecruitmentUpdateSubtype =
        /(?:চূড়ান্ত|final|নির্বাচিত)/i.test(norm)
          ? 'RESULT_FINAL'
          : /(?:লিখিত|written)/i.test(norm)
            ? 'RESULT_WRITTEN'
            : 'RESULT_PRELIMINARY';

      return {
        category: 'RECRUITMENT_UPDATE',
        subtype,
        isRecruitmentRelated: true,
        isJobCardEligible: false,
        confidenceScore: 92,
        matchedKeywords,
        linkedJobCandidateKey: this.extractJobMatchingKey(title),
      };
    }

    // D. Waiting List
    if (/(?:অপেক্ষমাণ\s*তালিকা|waiting\s*list)/i.test(norm)) {
      matchedKeywords.push('waiting_list');
      return {
        category: 'RECRUITMENT_UPDATE',
        subtype: 'WAITING_LIST',
        isRecruitmentRelated: true,
        isJobCardEligible: false,
        confidenceScore: 90,
        matchedKeywords,
        linkedJobCandidateKey: this.extractJobMatchingKey(title),
      };
    }

    // E. Joining Instruction & Final Appointment Letters
    if (/(?:যোগদানের\s*নির্দেশনা|যোগদান\s*পত্র|নিয়োগপত্র\s*প্রদান|joining\s*instruction|appointment\s*letter)/i.test(norm)) {
      matchedKeywords.push('joining_instruction');
      return {
        category: 'RECRUITMENT_UPDATE',
        subtype: 'JOINING_INSTRUCTION',
        isRecruitmentRelated: true,
        isJobCardEligible: false,
        confidenceScore: 88,
        matchedKeywords,
        linkedJobCandidateKey: this.extractJobMatchingKey(title),
      };
    }

    // =======================================================================
    // STEP 3: PRIMARY RECRUITMENT CIRCULARS (Job Card Eligible)
    // =======================================================================

    // A. Cancellation / Correction / Deadline Extension
    if (/(?:নিয়োগ\s*বাতিল|বিজ্ঞপ্তি\s*বাতিল|circular\s*cancelled|recruitment\s*cancelled)/i.test(norm)) {
      matchedKeywords.push('recruitment_cancellation');
      return {
        category: 'PRIMARY_JOB_CIRCULAR',
        subtype: 'CANCELLATION',
        isRecruitmentRelated: true,
        isJobCardEligible: true,
        confidenceScore: 95,
        matchedKeywords,
      };
    }

    if (/(?:(?:আবেদনের\s*)?(?:সময়|সময়|তারিখ)(?:সীমা)?\s*(?:বৃদ্ধি|বর্ধিতকরণ)|deadline\s*extension|date\s*extended|time\s*extension)/i.test(norm)) {
      matchedKeywords.push('deadline_extension');
      return {
        category: 'PRIMARY_JOB_CIRCULAR',
        subtype: 'DEADLINE_EXTENSION',
        isRecruitmentRelated: true,
        isJobCardEligible: true,
        confidenceScore: 95,
        matchedKeywords,
      };
    }

    if (/(?:সংশোধিত\s*নিয়োগ|সংশোধিত\s*বিজ্ঞপ্তি|সংশোধনী|corrigendum|amended\s*circular|revised\s*circular)/i.test(norm)) {
      matchedKeywords.push('revised_circular');
      return {
        category: 'PRIMARY_JOB_CIRCULAR',
        subtype: 'REVISED_CIRCULAR',
        isRecruitmentRelated: true,
        isJobCardEligible: true,
        confidenceScore: 92,
        matchedKeywords,
      };
    }

    // B. Direct New Recruitment Circulars
    const isNewRecruitment =
      /(?:নিয়োগ\s*বিজ্ঞপ্তি|সরাসরি\s*নিয়োগ|জনবল\s*নিয়োগ|শূন্য\s*পদে\s*নিয়োগ|কর্মকর্তা\s*নিয়োগ|কর্মচারী\s*নিয়োগ|দরখাস্ত\s*আহ্বান|recruitment\s*circular|job\s*circular|vacancy\s*announcement|career\s*opportunity|appointment\s*of|recruitment\s*notice)/i.test(
        norm
      );

    if (isNewRecruitment) {
      matchedKeywords.push('primary_recruitment');
      const subtype: PrimaryJobSubtype =
        /(?:চুক্তিভিত্তিক|contractual)/i.test(norm)
          ? 'CONTRACTUAL_RECRUITMENT'
          : /(?:অস্থায়ী|temporary)/i.test(norm)
            ? 'TEMPORARY_RECRUITMENT'
            : /(?:প্রকল্প|project)/i.test(norm)
              ? 'PROJECT_RECRUITMENT'
              : 'NEW_CIRCULAR';

      // Detect grade if mentioned
      let detectedGrade: number | null = null;
      const gradeWordMatch = norm.match(/(প্রথম|দ্বিতীয়|দ্বিতীয়|তৃতীয়|তৃতীয়|চতুর্থ|পঞ্চম|ষষ্ঠ|সপ্তম|অষ্টম|নবম|দশম|একাদশ|দ্বাদশ|ত্রয়োদশ|চতুর্দশ|পঞ্চদশ|ষোড়শ|ষোড়শ|সপ্তদশ|অষ্টাদশ|ঊনবিংশ|বিংশ)\s*(?:গ্রেড|grade)/i);
      if (gradeWordMatch) {
        const wordMap: Record<string, number> = {
          'প্রথম': 1, 'দ্বিতীয়': 2, 'দ্বিতীয়': 2, 'তৃতীয়': 3, 'তৃতীয়': 3,
          'চতুর্থ': 4, 'পঞ্চম': 5, 'ষষ্ঠ': 6, 'সপ্তম': 7, 'অষ্টম': 8,
          'নবম': 9, 'দশম': 10, 'একাদশ': 11, 'দ্বাদশ': 12, 'ত্রয়োদশ': 13,
          'চতুর্দশ': 14, 'পঞ্চদশ': 15, 'ষোড়শ': 16, 'ষোড়শ': 16, 'সপ্তদশ': 17,
          'অষ্টাদশ': 18, 'ঊনবিংশ': 19, 'বিংশ': 20,
        };
        detectedGrade = wordMap[gradeWordMatch[1]] ?? null;
      }

      if (!detectedGrade) {
        const gradeNumMatch =
          norm.match(/(?:গ্রেড|grade)\s*[-:–]?\s*([০-৯0-9]{1,2})/i) ||
          norm.match(/([০-৯0-9]{1,2})\s*(?:ম|তম|th|st|nd|rd)?\s*(?:গ্রেড|grade)/i);
        if (gradeNumMatch) {
          const num = gradeNumMatch[1].replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));
          const g = parseInt(num, 10);
          if (g >= 1 && g <= 20) detectedGrade = g;
        }
      }

      return {
        category: 'PRIMARY_JOB_CIRCULAR',
        subtype,
        isRecruitmentRelated: true,
        isJobCardEligible: true,
        confidenceScore: 96,
        matchedKeywords,
        detectedGrade,
      };
    }

    // C. Non-Cadre & Cadre Specific Matches
    if (/(?:বিসিএস|ক্যাডার|নন-ক্যাডার|bcs|cadre|non-cadre)/i.test(norm) && /(?:বিজ্ঞপ্তি|পরীক্ষা|আবেদন)/i.test(norm)) {
      matchedKeywords.push('bpsc_cadre_or_noncadre');
      return {
        category: 'PRIMARY_JOB_CIRCULAR',
        subtype: 'NEW_CIRCULAR',
        isRecruitmentRelated: true,
        isJobCardEligible: true,
        confidenceScore: 90,
        matchedKeywords,
      };
    }

    // D. Fallback: Check if clearly non-job
    return {
      category: 'ADMINISTRATIVE_NON_JOB',
      subtype: 'GENERAL_ANNOUNCEMENT',
      isRecruitmentRelated: false,
      isJobCardEligible: false,
      confidenceScore: 70,
      matchedKeywords,
      exclusionEvidence: 'Notice does not match any recognized government recruitment circular patterns.',
    };
  }

  /**
   * Generates a normalized matching key for linking updates to canonical jobs.
   */
  public static extractJobMatchingKey(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 48);
  }
}
