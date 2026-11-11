// JobFill BD - Layer 3: Multi-Signal Weighted Field Matcher & Scorer
// Implements Part G of Master Engineering Specification:
// Heuristic scoring based on 12 evidences:
// Label: 40 | Name/ID: 22 | Placeholder: 14 | ARIA/Title: 8 | Context: 12 | Type/Option: 4
// Rigorous contextual and type penalties (-45, -40, -35, -25).

import { FieldEvidence } from '../content/field-extractor';
import { CanonicalFieldDefinition, CANONICAL_FIELD_DEFINITIONS } from './alias-dictionary';
import { ContextAnalyzer, ContextAnalysisResult } from './context-analyzer';
import { ValueNormalizer } from './value-normalizer';

export interface CandidateMatchScore {
  definition: CanonicalFieldDefinition;
  totalScore: number;
  labelScore: number;
  nameIdScore: number;
  placeholderScore: number;
  ariaScore: number;
  contextScore: number;
  typeScore: number;
  penalties: Array<{ reason: string; deduction: number }>;
  supportingEvidence: string[];
}

export class FieldMatcher {
  // Token-phrase boundary check prevents suffix collisions like "upazila" falsely matching "zila" or "female" matching "male"
  private static hasTokenPhrase(haystack: string, needle: string): boolean {
    if (!haystack || !needle) return false;
    const cleanHay = haystack.replace(/['’]s(?=\s|$)/gi, '').replace(/['’]/g, '').trim();
    const cleanNeedle = needle.replace(/['’]s(?=\s|$)/gi, '').replace(/['’]/g, '').trim();
    if (!cleanHay || !cleanNeedle) return false;
    if (cleanHay === cleanNeedle) return true;
    const escaped = cleanNeedle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|\\s)${escaped}(?:$|\\s)`).test(cleanHay);
  }

  public static evaluateCandidate(
    evidence: FieldEvidence,
    def: CanonicalFieldDefinition,
    context: ContextAnalysisResult
  ): CandidateMatchScore {
    let labelScore = 0;
    let nameIdScore = 0;
    let placeholderScore = 0;
    let ariaScore = 0;
    let contextScore = 0;
    let typeScore = 0;
    const penalties: Array<{ reason: string; deduction: number }> = [];
    const supportingEvidence: string[] = [];

    const normLabel = ValueNormalizer.cleanText(evidence.label);
    const normName = ValueNormalizer.cleanText(evidence.name);
    const normId = ValueNormalizer.cleanText(evidence.id);
    const tokenizedName = ValueNormalizer.cleanText((evidence.name || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2'));
    const tokenizedId = ValueNormalizer.cleanText((evidence.id || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2'));
    const normPlaceholder = ValueNormalizer.cleanText(evidence.placeholder);
    const normAria = ValueNormalizer.cleanText(`${evidence.ariaLabel} ${evidence.title}`);

    // All known aliases for this canonical definition
    const allAliases = [
      ...def.aliasesEn.map((s) => ValueNormalizer.cleanText(s)),
      ...def.aliasesBn.map((s) => ValueNormalizer.cleanText(s)),
      ...def.aliasesRomanized.map((s) => ValueNormalizer.cleanText(s)),
    ];

    // 1. Evidence 1: Label Match (Max 55 points)
    if (normLabel) {
      if (allAliases.some((a) => a === normLabel || normLabel === ValueNormalizer.cleanText(def.labelEn) || normLabel === ValueNormalizer.cleanText(def.labelBn))) {
        labelScore = 55;
        supportingEvidence.push('Exact Label Match (55 pts)');
      } else if (allAliases.some((a) => this.hasTokenPhrase(normLabel, a) || this.hasTokenPhrase(a, normLabel))) {
        labelScore = 38;
        supportingEvidence.push('Partial Label Match (38 pts)');
      }
    }

    // 2. Evidence 2: HTML Name or ID Match (Max 22 points)
    const exactNameMatch = def.exactNames.some((n) => normName === ValueNormalizer.cleanText(n));
    const exactIdMatch = def.exactIds.some((i) => normId === ValueNormalizer.cleanText(i));

    if (exactNameMatch || exactIdMatch) {
      nameIdScore = 22;
      supportingEvidence.push(`Exact Name/ID Match (${normName || normId}) (22 pts)`);
    } else if (allAliases.some((a) => this.hasTokenPhrase(tokenizedName, a) || this.hasTokenPhrase(tokenizedId, a))) {
      nameIdScore = 14;
      supportingEvidence.push('Partial Name/ID Match (14 pts)');
    }

    // 3. Evidence 3: Placeholder Match (Max 14 points)
    if (normPlaceholder) {
      if (allAliases.some((a) => a === normPlaceholder)) {
        placeholderScore = 14;
        supportingEvidence.push('Exact Placeholder Match (14 pts)');
      } else if (allAliases.some((a) => this.hasTokenPhrase(normPlaceholder, a) || this.hasTokenPhrase(a, normPlaceholder))) {
        placeholderScore = 9;
        supportingEvidence.push('Partial Placeholder Match (9 pts)');
      }
    }

    // 4. Evidence 4: ARIA / Title Match (Max 8 points)
    if (normAria) {
      if (allAliases.some((a) => a === normAria || this.hasTokenPhrase(normAria, a))) {
        ariaScore = 8;
        supportingEvidence.push('ARIA/Title Match (8 pts)');
      }
    }

    // 5. Evidence 5: Section Context Match (Max 12 points)
    if (context.sectionCategory !== 'unknown') {
      if (
        (def.sectionHint === 'ssc' && context.sectionCategory === 'ssc') ||
        (def.sectionHint === 'hsc' && context.sectionCategory === 'hsc') ||
        (def.sectionHint === 'graduation' && context.sectionCategory === 'graduation') ||
        (def.sectionHint === 'masters' && context.sectionCategory === 'masters') ||
        (def.sectionHint === 'present_address' && context.sectionCategory === 'present_address') ||
        (def.sectionHint === 'permanent_address' && context.sectionCategory === 'permanent_address') ||
        (def.sectionHint === 'experience' && context.sectionCategory === 'experience') ||
        (def.sectionHint === 'personal' && ['applicant', 'father', 'mother', 'spouse'].includes(context.sectionCategory))
      ) {
        contextScore = 12;
        supportingEvidence.push(`Section Context Validated (${context.hierarchyPath}) (12 pts)`);
      }
    }

    // 6. Evidence 6: Field Type Compatibility (Max 4 points)
    if (def.expectedInputTypes.includes(evidence.inputType)) {
      typeScore = 4;
      supportingEvidence.push(`Input Type Matches Expected (${evidence.inputType}) (4 pts)`);
    }

    // =================== RIGOROUS PENALTIES ===================
    // Wrong education level penalty (-45)
    if (
      ['ssc', 'hsc', 'graduation', 'masters'].includes(def.sectionHint) &&
      context.academicLevel &&
      def.sectionHint !== context.academicLevel
    ) {
      penalties.push({
        reason: `Mismatched Education Level (Target: ${def.sectionHint}, Section: ${context.academicLevel})`,
        deduction: 45,
      });
    }

    // Wrong address section penalty (-45)
    if (
      ['present_address', 'permanent_address'].includes(def.sectionHint) &&
      context.addressType &&
      !def.canonicalId.includes(context.addressType)
    ) {
      penalties.push({
        reason: `Mismatched Address Type (Target: ${def.canonicalId}, Found: ${context.addressType})`,
        deduction: 45,
      });
    }

    // Conflicting family context penalty (-35)
    if (def.canonicalId.startsWith('family.father.') && context.personType && context.personType !== 'father') {
      penalties.push({ reason: 'Conflicting Person (Expected Father)', deduction: 35 });
    }
    if (def.canonicalId.startsWith('family.mother.') && context.personType && context.personType !== 'mother') {
      penalties.push({ reason: 'Conflicting Person (Expected Mother)', deduction: 35 });
    }
    if (
      def.canonicalId.startsWith('applicant.fullName.') &&
      context.personType &&
      ['father', 'mother', 'spouse'].includes(context.personType)
    ) {
      penalties.push({ reason: `Conflicting Person (${context.personType} != applicant)`, deduction: 35 });
    }

    // English vs Bangla field language polarity disambiguation
    const langSignalText = `${normLabel} ${tokenizedName} ${tokenizedId} ${normPlaceholder} ${normAria}`.toLowerCase();
    const hasBanglaSignal = /(?:বাংলায়|বাংলা|bangla|bengali|\bbn\b|\bbng\b)/.test(langSignalText);
    if (def.canonicalId.endsWith('.english') && hasBanglaSignal) {
      penalties.push({ reason: 'Bangla field indicator disqualifies English name variant', deduction: 45 });
    }
    if (def.canonicalId.endsWith('.bangla') && !hasBanglaSignal) {
      penalties.push({ reason: 'No Bangla indicator present for Bangla name variant', deduction: 35 });
    }

    // Disambiguate primary Mobile Number vs Confirm Mobile Number (-35)
    const mobileSignalText = `${normLabel} ${tokenizedName} ${tokenizedId}`;
    const isConfirmSignal = /\b(confirm|retype|re type|reenter|re enter|verify|again|পুনরায়|নিশ্চিতকরণ)\b/.test(
      mobileSignalText
    );
    if (def.canonicalId === 'contact.mobile' && isConfirmSignal) {
      penalties.push({ reason: 'Confirm Mobile indicator disqualifies primary contact.mobile', deduction: 35 });
    }
    if (def.canonicalId === 'contact.confirmMobile' && !isConfirmSignal) {
      penalties.push({ reason: 'No confirmation indicator for contact.confirmMobile', deduction: 35 });
    }

    // Incompatible data type penalty (-60 if text input tested against strictly non-text definitions like select/checkbox)
    if (!def.expectedInputTypes.includes(evidence.inputType)) {
      const isStrictNonTextDef = !def.expectedInputTypes.includes('text');
      const deduction = isStrictNonTextDef ? 60 : 40;
      penalties.push({
        reason: `Incompatible Input Type (${evidence.inputType} not in ${def.expectedInputTypes.join(',')})`,
        deduction,
      });
    }

    // Calculate total score bounded between 0 and 100
    const rawSum = labelScore + nameIdScore + placeholderScore + ariaScore + contextScore + typeScore;
    const totalDeductions = penalties.reduce((acc, p) => acc + p.deduction, 0);
    const totalScore = Math.max(0, Math.min(100, rawSum - totalDeductions));

    return {
      definition: def,
      totalScore,
      labelScore,
      nameIdScore,
      placeholderScore,
      ariaScore,
      contextScore,
      typeScore,
      penalties,
      supportingEvidence,
    };
  }

  // Matches an element against all definitions and sorts candidates by score
  public static matchField(evidence: FieldEvidence): CandidateMatchScore[] {
    const context = ContextAnalyzer.analyze(evidence);
    const candidateScores: CandidateMatchScore[] = [];

    for (const def of CANONICAL_FIELD_DEFINITIONS) {
      const score = this.evaluateCandidate(evidence, def, context);
      const hasSemanticMatch =
        score.labelScore > 0 || score.nameIdScore > 0 || score.placeholderScore > 0 || score.ariaScore > 0;
      if (hasSemanticMatch && score.totalScore > 0) {
        candidateScores.push(score);
      }
    }

    return candidateScores.sort((a, b) => b.totalScore - a.totalScore);
  }
}
