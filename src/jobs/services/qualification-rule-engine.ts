/**
 * JobFill BD — Academic Qualification Rule Engine
 * Evaluates candidate qualifications against structured circular requirements:
 * 1. ANY_SUBJECT (Open to all disciplines as long as education level is met)
 * 2. SPECIFIC_SUBJECT (Requires specific department or degree, strictly disallowing conflated departments)
 * 3. SUBJECT_GROUP (Discipline-wide requirement, e.g. Engineering, Business, Science, Law)
 * 4. MULTIPLE_REQUIREMENTS (Nested AND / OR boolean logic trees)
 */

import {
  ALL_CANONICAL_SUBJECTS,
  getSubjectById,
  matchSubjectFromText,
  SubjectItem,
  ACADEMIC_DISCIPLINES,
} from '../taxonomy/subject-taxonomy';
import { EDUCATION_RANK, EducationLevelRank } from './eligibility-helper';

export type QualificationRuleType =
  | 'ANY_SUBJECT'
  | 'SPECIFIC_SUBJECT'
  | 'SUBJECT_GROUP'
  | 'MULTIPLE_REQUIREMENTS';

export type LogicalOperator = 'AND' | 'OR';

export interface QualificationRule {
  id?: string;
  type: QualificationRuleType;
  operator?: LogicalOperator; // Defaults to 'OR' for multiple subjects, 'AND' for composite requirements
  minLevel?: 'SSC' | 'HSC' | 'Diploma' | 'Bachelor' | 'Honours' | 'Masters' | 'PhD' | null;
  requiredSubjectIds?: string[]; // IDs from subject-taxonomy.ts (e.g. ['cse', 'eee']) or canonical names
  discipline?: 'engineering' | 'business' | 'law_social' | 'science' | 'humanities';
  minGpa?: number | null;
  gpaScale?: number | null;
  subRules?: QualificationRule[];
  descriptionEn?: string;
  descriptionBn?: string;
}

export interface CandidateEducationInput {
  level: string; // 'SSC', 'HSC', 'Diploma', 'Bachelor', 'Honours', 'Masters', 'PhD'
  degreeTitle: string;
  subjectOrGroup: string;
  normalizedSubject?: string;
  gpa?: number | null;
  gpaScale?: number | null;
  passingYear?: number | null;
  institution?: string;
}

export interface QualificationEvaluationResult {
  status: 'ELIGIBLE' | 'REVIEW_REQUIRED' | 'NOT_ELIGIBLE';
  isMatched: boolean;
  matchedSubject?: string | null;
  matchedLevel?: string | null;
  reasonsEn: string[];
  reasonsBn: string[];
  missingFields: string[];
}

export class QualificationRuleEngine {
  /**
   * Evaluates a candidate's education records against a structured QualificationRule.
   */
  public static evaluate(
    rule: QualificationRule,
    candidateRecords: CandidateEducationInput[]
  ): QualificationEvaluationResult {
    // 1. If candidate has no education records at all
    if (!candidateRecords || candidateRecords.length === 0) {
      return {
        status: 'REVIEW_REQUIRED',
        isMatched: false,
        reasonsEn: ['No education records found in candidate profile.'],
        reasonsBn: ['প্রার্থীর প্রোফাইলে কোনো শিক্ষাগত তথ্য পাওয়া যায়নি।'],
        missingFields: ['education'],
      };
    }

    switch (rule.type) {
      case 'ANY_SUBJECT':
        return this.evaluateAnySubject(rule, candidateRecords);

      case 'SPECIFIC_SUBJECT':
        return this.evaluateSpecificSubject(rule, candidateRecords);

      case 'SUBJECT_GROUP':
        return this.evaluateSubjectGroup(rule, candidateRecords);

      case 'MULTIPLE_REQUIREMENTS':
        return this.evaluateMultipleRequirements(rule, candidateRecords);

      default:
        return {
          status: 'REVIEW_REQUIRED',
          isMatched: false,
          reasonsEn: [`Unknown qualification rule type: ${(rule as any).type}`],
          reasonsBn: ['অজানা যোগ্যতার নিয়ম পাওয়া গেছে।'],
          missingFields: [],
        };
    }
  }

  /**
   * Case 1: ANY_SUBJECT
   * Open to any discipline, provided the candidate meets the minimum level.
   */
  private static evaluateAnySubject(
    rule: QualificationRule,
    records: CandidateEducationInput[]
  ): QualificationEvaluationResult {
    const requiredLevel = rule.minLevel || null;
    const reqRank = requiredLevel ? (EDUCATION_RANK[requiredLevel] ?? 0) : 0;

    // Check if any record satisfies or exceeds the required level
    const qualifiedRecord = records.find((r) => {
      const recRank = EDUCATION_RANK[r.level] ?? 0;
      return recRank >= reqRank;
    });

    if (qualifiedRecord) {
      return {
        status: 'ELIGIBLE',
        isMatched: true,
        matchedSubject: qualifiedRecord.subjectOrGroup || qualifiedRecord.degreeTitle,
        matchedLevel: qualifiedRecord.level,
        reasonsEn: [
          `Candidate meets the minimum level (${qualifiedRecord.level} >= ${requiredLevel || 'Any'}) in discipline "${qualifiedRecord.subjectOrGroup || 'Open'}".`,
        ],
        reasonsBn: [
          `প্রার্থী ন্যূনতম স্তর (${qualifiedRecord.level} >= ${requiredLevel || 'যেকোনো'}) অর্জন করেছেন (বিষয়: ${qualifiedRecord.subjectOrGroup || 'উন্মুক্ত'})।`,
        ],
        missingFields: [],
      };
    }

    return {
      status: 'NOT_ELIGIBLE',
      isMatched: false,
      reasonsEn: [
        `Candidate's highest education does not meet the minimum level of ${requiredLevel || 'required standard'}.`,
      ],
      reasonsBn: [
        `প্রার্থীর শিক্ষাগত স্তর ন্যূনতম প্রয়োজনীয় ${requiredLevel || 'মানদণ্ড'} পূরণ করে না।`,
      ],
      missingFields: [],
    };
  }

  /**
   * Case 2: SPECIFIC_SUBJECT
   * Requires one of the explicitly allowed subjects.
   * Distinct departments (e.g. ICT vs CSE, Banking vs Finance) are strictly evaluated.
   */
  private static evaluateSpecificSubject(
    rule: QualificationRule,
    records: CandidateEducationInput[]
  ): QualificationEvaluationResult {
    const requiredIds = (rule.requiredSubjectIds || []).map((s) => s.toLowerCase().trim());
    if (requiredIds.length === 0) {
      // If none specified, fall back to any subject
      return this.evaluateAnySubject(rule, records);
    }

    const requiredLevel = rule.minLevel || null;
    const reqRank = requiredLevel ? (EDUCATION_RANK[requiredLevel] ?? 0) : 0;

    // Find candidate records meeting level requirement
    const eligibleLevelRecords = records.filter((r) => {
      const recRank = EDUCATION_RANK[r.level] ?? 0;
      return recRank >= reqRank;
    });

    if (eligibleLevelRecords.length === 0 && reqRank > 0) {
      return {
        status: 'NOT_ELIGIBLE',
        isMatched: false,
        reasonsEn: [
          `Education level requirement (${requiredLevel}) not met.`,
        ],
        reasonsBn: [
          `প্রয়োজনীয় শিক্ষাগত স্তর (${requiredLevel}) পূরণ হয়নি।`,
        ],
        missingFields: [],
      };
    }

    const targetRecords = eligibleLevelRecords.length > 0 ? eligibleLevelRecords : records;

    // Resolve canonical SubjectItems for required subjects
    const requiredItems: SubjectItem[] = [];
    for (const reqId of requiredIds) {
      const byId = getSubjectById(reqId);
      if (byId) {
        requiredItems.push(byId);
      } else {
        const byText = matchSubjectFromText(reqId);
        if (byText) {
          requiredItems.push(byText);
        } else {
          // Dynamic fallback item
          requiredItems.push({
            id: reqId,
            nameEn: reqId,
            nameBn: reqId,
            discipline: 'science',
            aliases: [new RegExp(`\\b${reqId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')],
          });
        }
      }
    }

    // Try matching candidate records against required items
    for (const rec of targetRecords) {
      const candidateText = `${rec.degreeTitle || ''} ${rec.subjectOrGroup || ''} ${rec.normalizedSubject || ''}`.trim();
      const matchedCandidateSubject = matchSubjectFromText(candidateText);

      for (const reqItem of requiredItems) {
        // Direct ID match
        if (matchedCandidateSubject && matchedCandidateSubject.id === reqItem.id) {
          return {
            status: 'ELIGIBLE',
            isMatched: true,
            matchedSubject: reqItem.nameEn,
            matchedLevel: rec.level,
            reasonsEn: [
              `Candidate's discipline "${rec.subjectOrGroup || rec.degreeTitle}" matches required subject "${reqItem.nameEn}".`,
            ],
            reasonsBn: [
              `প্রার্থীর বিষয় "${rec.subjectOrGroup || rec.degreeTitle}" কাঙ্ক্ষিত বিষয় "${reqItem.nameBn}"-এর সাথে মিলেছে।`,
            ],
            missingFields: [],
          };
        }

        // Direct alias check against candidate text
        const aliasMatch = reqItem.aliases.some((rx) => rx.test(candidateText));
        if (aliasMatch) {
          // Guard: if candidate has an explicit subject that is another known distinct subject, ensure no collision
          // For example, if candidate is "Information & Communication Technology (ICT)",
          // and reqItem is CSE, we must not let it match CSE unless CSE alias actually matches!
          if (
            matchedCandidateSubject &&
            matchedCandidateSubject.id !== reqItem.id &&
            !reqItem.aliases.some((rx) => rx.test(matchedCandidateSubject.nameEn))
          ) {
            continue;
          }

          return {
            status: 'ELIGIBLE',
            isMatched: true,
            matchedSubject: reqItem.nameEn,
            matchedLevel: rec.level,
            reasonsEn: [
              `Candidate's academic record "${candidateText}" matches required subject "${reqItem.nameEn}".`,
            ],
            reasonsBn: [
              `প্রার্থীর শিক্ষাগত বিবরণী "${candidateText}" কাঙ্ক্ষিত বিষয় "${reqItem.nameBn}"-এর সাথে মিলেছে।`,
            ],
            missingFields: [],
          };
        }
      }
    }

    const reqLabels = requiredItems.map((i) => i.nameEn).join(' / ');
    const candidateSubjects = targetRecords.map((r) => r.subjectOrGroup || r.degreeTitle).filter(Boolean).join(', ');

    return {
      status: 'NOT_ELIGIBLE',
      isMatched: false,
      reasonsEn: [
        `Candidate's discipline (${candidateSubjects || 'None specified'}) does not match required subject (${reqLabels}).`,
      ],
      reasonsBn: [
        `প্রার্থীর বিষয় (${candidateSubjects || 'উল্লেখ নেই'}) কাঙ্ক্ষিত বিষয়ের (${reqLabels}) সাথে মেলেনি।`,
      ],
      missingFields: [],
    };
  }

  /**
   * Case 3: SUBJECT_GROUP
   * e.g. "Any Engineering discipline", "Any Business discipline", "Science group".
   */
  private static evaluateSubjectGroup(
    rule: QualificationRule,
    records: CandidateEducationInput[]
  ): QualificationEvaluationResult {
    const targetDiscipline = rule.discipline;
    if (!targetDiscipline) {
      return this.evaluateAnySubject(rule, records);
    }

    const requiredLevel = rule.minLevel || null;
    const reqRank = requiredLevel ? (EDUCATION_RANK[requiredLevel] ?? 0) : 0;

    const eligibleLevelRecords = records.filter((r) => {
      const recRank = EDUCATION_RANK[r.level] ?? 0;
      return recRank >= reqRank;
    });

    const targetRecords = eligibleLevelRecords.length > 0 ? eligibleLevelRecords : records;

    for (const rec of targetRecords) {
      // For SSC/HSC, check groupSubject directly (e.g. Science, Commerce, Arts)
      if (rec.level === 'SSC' || rec.level === 'HSC') {
        const grp = (rec.subjectOrGroup || '').toLowerCase();
        if (targetDiscipline === 'science' && grp.includes('science')) {
          return {
            status: 'ELIGIBLE',
            isMatched: true,
            matchedSubject: rec.subjectOrGroup,
            matchedLevel: rec.level,
            reasonsEn: [`${rec.level} in Science group matches required Science discipline.`],
            reasonsBn: [`${rec.level}-এ বিজ্ঞান বিভাগ কাঙ্ক্ষিত বিজ্ঞান অনুষদের শর্ত পূরণ করে।`],
            missingFields: [],
          };
        }
        if (targetDiscipline === 'business' && (grp.includes('business') || grp.includes('commerce'))) {
          return {
            status: 'ELIGIBLE',
            isMatched: true,
            matchedSubject: rec.subjectOrGroup,
            matchedLevel: rec.level,
            reasonsEn: [`${rec.level} in Business Studies matches required Business discipline.`],
            reasonsBn: [`${rec.level}-এ ব্যবসায় শিক্ষা কাঙ্ক্ষিত বাণিজ্য অনুষদের শর্ত পূরণ করে।`],
            missingFields: [],
          };
        }
      }

      // For Higher education, check discipline from subject taxonomy
      const candidateText = `${rec.degreeTitle || ''} ${rec.subjectOrGroup || ''} ${rec.normalizedSubject || ''}`.trim();
      const subjectItem = matchSubjectFromText(candidateText);
      if (subjectItem && subjectItem.discipline === targetDiscipline) {
        return {
          status: 'ELIGIBLE',
          isMatched: true,
          matchedSubject: subjectItem.nameEn,
          matchedLevel: rec.level,
          reasonsEn: [
            `Candidate's subject "${subjectItem.nameEn}" belongs to the required ${targetDiscipline} discipline.`,
          ],
          reasonsBn: [
            `প্রার্থীর বিষয় "${subjectItem.nameBn}" কাঙ্ক্ষিত অনুষদের অন্তর্ভুক্ত।`,
          ],
          missingFields: [],
        };
      }
    }

    const discGroup = ACADEMIC_DISCIPLINES.find((d) => d.id === targetDiscipline);
    const discLabel = discGroup ? `${discGroup.nameEn} (${discGroup.nameBn})` : targetDiscipline;

    return {
      status: 'NOT_ELIGIBLE',
      isMatched: false,
      reasonsEn: [`Candidate has no qualification under the required ${discLabel} discipline.`],
      reasonsBn: [`প্রার্থীর অর্জিত কোনো ডিগ্রি ${discLabel} অনুষদের আওতাভুক্ত নয়।`],
      missingFields: [],
    };
  }

  /**
   * Case 4: MULTIPLE_REQUIREMENTS (AND / OR Tree)
   * Evaluates subRules recursively according to operator.
   */
  private static evaluateMultipleRequirements(
    rule: QualificationRule,
    records: CandidateEducationInput[]
  ): QualificationEvaluationResult {
    const subRules = rule.subRules || [];
    if (subRules.length === 0) {
      return this.evaluateAnySubject(rule, records);
    }

    const operator: LogicalOperator = rule.operator || 'OR';
    const subResults = subRules.map((sr) => this.evaluate(sr, records));

    if (operator === 'AND') {
      const allPassed = subResults.every((r) => r.isMatched && r.status === 'ELIGIBLE');
      const anyReview = subResults.some((r) => r.status === 'REVIEW_REQUIRED');

      const allReasonsEn = subResults.flatMap((r) => r.reasonsEn);
      const allReasonsBn = subResults.flatMap((r) => r.reasonsBn);
      const allMissing = Array.from(new Set(subResults.flatMap((r) => r.missingFields)));

      if (allPassed) {
        return {
          status: 'ELIGIBLE',
          isMatched: true,
          matchedSubject: subResults[0].matchedSubject,
          matchedLevel: subResults[0].matchedLevel,
          reasonsEn: allReasonsEn,
          reasonsBn: allReasonsBn,
          missingFields: [],
        };
      }

      if (anyReview && !subResults.some((r) => r.status === 'NOT_ELIGIBLE')) {
        return {
          status: 'REVIEW_REQUIRED',
          isMatched: false,
          reasonsEn: allReasonsEn,
          reasonsBn: allReasonsBn,
          missingFields: allMissing,
        };
      }

      return {
        status: 'NOT_ELIGIBLE',
        isMatched: false,
        reasonsEn: allReasonsEn,
        reasonsBn: allReasonsBn,
        missingFields: allMissing,
      };
    } else {
      // OR operator: any one passing condition is enough
      const passedResult = subResults.find((r) => r.isMatched && r.status === 'ELIGIBLE');
      if (passedResult) {
        return {
          ...passedResult,
          status: 'ELIGIBLE',
          isMatched: true,
        };
      }

      const reviewResult = subResults.find((r) => r.status === 'REVIEW_REQUIRED');
      if (reviewResult) {
        return {
          ...reviewResult,
          status: 'REVIEW_REQUIRED',
          isMatched: false,
        };
      }

      return {
        status: 'NOT_ELIGIBLE',
        isMatched: false,
        reasonsEn: subResults.flatMap((r) => r.reasonsEn),
        reasonsBn: subResults.flatMap((r) => r.reasonsBn),
        missingFields: [],
      };
    }
  }

  /**
   * Helper: Parses raw requirement strings into a QualificationRule.
   */
  public static parseToRule(rawText: string, minLevelFallback?: string | null): QualificationRule {
    const clean = (rawText || '').trim();
    if (!clean) {
      return {
        type: 'ANY_SUBJECT',
        minLevel: (minLevelFallback as any) || null,
      };
    }

    const lower = clean.toLowerCase();

    // Check for open / any discipline
    if (
      /any\s*(?:discipline|subject)|যেকোনো\s*(?:বিভাগ|বিষয়|শাখা)|উন্মুক্ত/i.test(lower)
    ) {
      return {
        type: 'ANY_SUBJECT',
        minLevel: (minLevelFallback as any) || null,
        descriptionEn: 'Any discipline accepted',
        descriptionBn: 'যেকোনো বিভাগ বা বিষয় গ্রহণযোগ্য',
      };
    }

    // Check for discipline group requirements
    if (/engineering|প্রকৌশল/i.test(lower) && !/cse|eee|civil|mechanical/i.test(lower)) {
      return {
        type: 'SUBJECT_GROUP',
        discipline: 'engineering',
        minLevel: (minLevelFallback as any) || 'Bachelor',
        descriptionEn: 'Engineering discipline',
        descriptionBn: 'প্রকৌশল অনুষদ',
      };
    }

    if (/commerce|business\s*studies|ব্যবসায়\s*শিক্ষা/i.test(lower)) {
      return {
        type: 'SUBJECT_GROUP',
        discipline: 'business',
        minLevel: (minLevelFallback as any) || null,
        descriptionEn: 'Business discipline',
        descriptionBn: 'ব্যবসায় শিক্ষা অনুষদ',
      };
    }

    // Check for individual specific subjects
    const matchedSubjectIds: string[] = [];
    for (const item of ALL_CANONICAL_SUBJECTS) {
      if (item.aliases.some((rx) => rx.test(clean))) {
        matchedSubjectIds.push(item.id);
      }
    }

    if (matchedSubjectIds.length > 0) {
      return {
        type: 'SPECIFIC_SUBJECT',
        requiredSubjectIds: matchedSubjectIds,
        minLevel: (minLevelFallback as any) || null,
        operator: 'OR',
      };
    }

    return {
      type: 'ANY_SUBJECT',
      minLevel: (minLevelFallback as any) || null,
    };
  }
}
