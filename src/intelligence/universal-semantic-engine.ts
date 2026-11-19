// JobFill BD - Universal Multi-Portal Semantic Form Intelligence Engine
// Multi-Signal Semantic Matching, Section Context Disambiguation,
// Transparent Confidence Scoring, 13 Granular Field Statuses,
// Sensitive Declaration Protection, and Read-Back Verification.

import { FieldEvidence } from '../content/field-extractor';
import { UniversalFieldRegistry, UniversalCanonicalField } from './universal-field-registry';
import { FormSectionEngine, FormSectionContext } from './form-section-engine';
import { ValueNormalizer } from './value-normalizer';
import { MasterCanonicalProfile, resolveCanonicalValue } from '../shared/types/canonical-schema';
import { VerificationEngine } from '../validation/verification-engine';
import { ControlHandlerRouter } from '../handlers';
import { CompositeFieldAdapter } from './composite-field-adapter';

export type UniversalFieldStatus =
  | 'FILLED_VERIFIED'
  | 'ALREADY_CORRECT'
  | 'PARTIALLY_FILLED'
  | 'PROFILE_DATA_MISSING'
  | 'FIELD_NOT_FOUND'
  | 'AMBIGUOUS_MAPPING'
  | 'OPTION_NOT_FOUND'
  | 'DEPENDENCY_TIMEOUT'
  | 'VALIDATION_REJECTED'
  | 'FRAMEWORK_UPDATE_FAILED'
  | 'MANUAL_SELECTION_REQUIRED'
  | 'SKIPPED_BY_USER'
  | 'UNSUPPORTED_CONTROL';

export interface SemanticMatchResult {
  canonicalField: UniversalCanonicalField | null;
  canonicalId: string | null;
  confidenceScore: number;
  decisionTier: 'HIGH_CONFIDENCE' | 'MEDIUM_CONFIDENCE' | 'LOW_CONFIDENCE' | 'AMBIGUOUS';
  sectionContext: FormSectionContext;
  supportingEvidence: string[];
  penalties: Array<{ reason: string; deduction: number }>;
  isSafeToAutofill: boolean;
  requiresUserConfirmation: boolean;
  proposedValue: string;
  rejectionReason?: string;
}

export interface UniversalFieldExecutionResult {
  element: HTMLElement;
  canonicalId: string;
  fieldLabel: string;
  sectionContext: string;
  status: UniversalFieldStatus;
  proposedValue: string;
  actualVerifiedValue: string;
  message: string;
  confidenceScore: number;
}

export class UniversalSemanticEngine {
  private static readonly HIGH_CONFIDENCE_THRESHOLD = 80;
  private static readonly MEDIUM_CONFIDENCE_THRESHOLD = 60;
  private static readonly MIN_SAFE_AMBIGUITY_MARGIN = 15;

  /**
   * Evaluates all 14 signals to match an extracted form element to a Canonical Field
   */
  public static matchElement(
    evidence: FieldEvidence,
    section?: FormSectionContext
  ): SemanticMatchResult {
    const el = evidence.element;
    const formSection = section || FormSectionEngine.detectSection(el);

    // 0. STRICT SECURITY INVARIANT: Exclude CAPTCHA, MFA, OTP, Security Challenges, and Final Submissions
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute('type') || '').toLowerCase();
    const nameId = `${evidence.name} ${evidence.id}`.toLowerCase();
    const labelText = (evidence.label || '').toLowerCase();

    if (
      type === 'submit' ||
      nameId.includes('captcha') ||
      nameId.includes('validation_code') ||
      nameId.includes('security_code') ||
      labelText.includes('captcha') ||
      labelText.includes('security code') ||
      labelText.includes('validation code') ||
      labelText.includes('ভেরিফিকেশন কোড')
    ) {
      return {
        canonicalField: null,
        canonicalId: null,
        confidenceScore: 0,
        decisionTier: 'LOW_CONFIDENCE',
        sectionContext: formSection,
        supportingEvidence: ['Security / CAPTCHA exclusion invariant applied.'],
        penalties: [{ reason: 'CAPTCHA or submit control prohibited from automated filling', deduction: 100 }],
        isSafeToAutofill: false,
        requiresUserConfirmation: true,
        proposedValue: '',
        rejectionReason: 'Security Policy: Automated script must never touch CAPTCHA or submit triggers.',
      };
    }

    // Evaluate against all canonical definitions in the registry
    const allFields = UniversalFieldRegistry.getAllFields();
    const scoredCandidates: Array<{
      field: UniversalCanonicalField;
      score: number;
      evidenceList: string[];
      penalties: Array<{ reason: string; deduction: number }>;
    }> = [];

    const normLabel = ValueNormalizer.cleanText(evidence.label);
    const normName = ValueNormalizer.cleanText(evidence.name);
    const normId = ValueNormalizer.cleanText(evidence.id);
    const normPlaceholder = ValueNormalizer.cleanText(evidence.placeholder);
    const normAria = ValueNormalizer.cleanText(`${evidence.ariaLabel} ${evidence.title}`);

    for (const field of allFields) {
      let score = 0;
      const evidenceList: string[] = [];
      const penalties: Array<{ reason: string; deduction: number }> = [];

      // 1. Explicit Label Match (Max 50 points)
      const allLabels = [
        ...field.aliasesEn.map((s) => ValueNormalizer.cleanText(s)),
        ...field.aliasesBn.map((s) => ValueNormalizer.cleanText(s)),
        ...field.abbreviations.map((s) => ValueNormalizer.cleanText(s)),
        ...field.spellingVariations.map((s) => ValueNormalizer.cleanText(s)),
      ];

      if (normLabel) {
        if (allLabels.some((l) => l === normLabel || normLabel === ValueNormalizer.cleanText(field.labelEn) || normLabel === ValueNormalizer.cleanText(field.labelBn))) {
          score += 50;
          evidenceList.push(`Exact Label Match: "${normLabel}" (50 pts)`);
        } else if (allLabels.some((l) => l.length > 2 && (normLabel.includes(l) || l.includes(normLabel)))) {
          score += 35;
          evidenceList.push(`Partial Label Match: "${normLabel}" (35 pts)`);
        }
      }

      // 2. HTML Name or ID Match (Max 25 points)
      const exactNameMatch = field.htmlNameAliases.some((n) => normName === ValueNormalizer.cleanText(n));
      const exactIdMatch = field.htmlIdAliases.some((i) => normId === ValueNormalizer.cleanText(i));

      if (exactNameMatch || exactIdMatch) {
        score += 25;
        evidenceList.push(`Exact HTML Name/ID Match (${normName || normId}) (25 pts)`);
      } else if (allLabels.some((l) => l.length > 2 && (normName.includes(l) || normId.includes(l)))) {
        score += 15;
        evidenceList.push('Partial Name/ID Match (15 pts)');
      }

      // 3. Placeholder Match (Max 15 points)
      if (normPlaceholder) {
        if (field.placeholderAliases.some((p) => ValueNormalizer.cleanText(p) === normPlaceholder)) {
          score += 15;
          evidenceList.push('Exact Placeholder Match (15 pts)');
        } else if (allLabels.some((l) => l.length > 2 && normPlaceholder.includes(l))) {
          score += 10;
          evidenceList.push('Partial Placeholder Match (10 pts)');
        }
      }

      // 4. ARIA Label / Title Match (Max 10 points)
      if (normAria) {
        if (field.ariaLabelAliases.some((a) => ValueNormalizer.cleanText(a) === normAria)) {
          score += 10;
          evidenceList.push('Exact ARIA Match (10 pts)');
        }
      }

      // 5. Parent Section Context Compatibility (Critical Weight: +20 or -40)
      const targetSec = formSection.sectionType;
      const fieldSec = field.category;

      if (
        (fieldSec === 'ssc' && targetSec === 'ssc_level') ||
        (fieldSec === 'hsc' && targetSec === 'hsc_level') ||
        (fieldSec === 'graduation' && targetSec === 'graduation_level') ||
        (fieldSec === 'masters' && targetSec === 'masters_level') ||
        (field.canonicalId.includes('present') && targetSec === 'present_address') ||
        (field.canonicalId.includes('permanent') && targetSec === 'permanent_address') ||
        (field.canonicalId.startsWith('candidate.fullName.bn') && targetSec === 'bangla_info') ||
        (fieldSec === 'identity' && (targetSec === 'personal_info' || targetSec === 'identity_citizenship')) ||
        (fieldSec === 'contact' && (targetSec === 'contact_info' || targetSec === 'contact_quota')) ||
        (fieldSec === 'special_status' && (targetSec === 'contact_quota' || targetSec === 'employment_info')) ||
        (fieldSec === 'preference' && targetSec === 'exam_centre')
      ) {
        score += 20;
        evidenceList.push(`Section Context Aligned: [${formSection.canonicalSectionName}] (+20 pts)`);
      } else if (
        // Severe penalties for cross-section collisions
        (fieldSec === 'ssc' && targetSec === 'hsc_level') ||
        (fieldSec === 'hsc' && targetSec === 'ssc_level') ||
        (fieldSec === 'graduation' && (targetSec === 'ssc_level' || targetSec === 'hsc_level')) ||
        (field.canonicalId.includes('present') && targetSec === 'permanent_address') ||
        (field.canonicalId.includes('permanent') && targetSec === 'present_address') ||
        (field.canonicalId.includes('.bn') && !targetSec.includes('bangla') && normLabel.includes('english')) ||
        (field.canonicalId.includes('.en') && (targetSec.includes('bangla') || normLabel.includes('বাংলা')))
      ) {
        score -= 45;
        penalties.push({
          reason: `Cross-section conflict: ${field.canonicalId} does not belong in ${formSection.canonicalSectionName}`,
          deduction: 45,
        });
      }

      // 6. Input Control Compatibility (e.g. text vs select vs radio vs checkbox)
      const inputType = evidence.inputType;
      if (field.expectedInputTypes.includes(inputType) || (inputType === 'select' && field.expectedInputTypes.includes('select'))) {
        score += 5;
        evidenceList.push(`Input Type Compatible (${inputType}) (+5 pts)`);
      } else if (inputType === 'radio' && !field.expectedInputTypes.includes('radio')) {
        score -= 30;
        penalties.push({ reason: `Control type mismatch: ${field.canonicalId} is not expected as radio`, deduction: 30 });
      } else if (inputType === 'checkbox' && !field.expectedInputTypes.includes('checkbox')) {
        score -= 40;
        penalties.push({ reason: `Control type mismatch: ${field.canonicalId} is not expected as checkbox`, deduction: 40 });
      }

      // 7. Type A vs Type B Disambiguation (NID Number vs NID Yes/No)
      if (field.canonicalId === 'candidate.nationalId.number' && (inputType === 'radio' || (inputType === 'select' && normLabel.includes('have')))) {
        score -= 40;
        penalties.push({ reason: 'NID Number field cannot be a Yes/No radio/select', deduction: 40 });
      }
      if (field.canonicalId === 'candidate.nationalId.hasNid' && (inputType === 'text' || inputType === 'number')) {
        score -= 40;
        penalties.push({ reason: 'NID Yes/No check cannot be a free text/number input', deduction: 40 });
      }

      // 8. Freedom Fighter Quota vs General Quota Disambiguation
      if (field.canonicalId === 'quota.category' && (normName.includes('ff') || normId.includes('ff') || normLabel.includes('freedom') || normLabel.includes('মুক্তিযোদ্ধা'))) {
        score -= 35;
        penalties.push({ reason: 'Freedom Fighter quota signals present; deprioritizing generic quota.category', deduction: 35 });
      }
      if (field.canonicalId.includes('freedomFighter') && !normName.includes('ff') && !normId.includes('ff') && !normLabel.includes('freedom') && !normLabel.includes('মুক্তিযোদ্ধা')) {
        score -= 35;
        penalties.push({ reason: 'No Freedom Fighter signals present; deprioritizing freedom fighter status', deduction: 35 });
      }

      // 9. Roll Number vs Registration Number Disambiguation
      if (field.canonicalId.includes('rollNumber') && (normName.includes('reg') || normId.includes('reg') || normLabel.includes('reg') || normLabel.includes('রেজি'))) {
        score -= 45;
        penalties.push({ reason: 'Registration number signals present; rollNumber disqualified', deduction: 45 });
      }
      if (field.canonicalId.includes('registrationNumber') && (normName.includes('roll') || normId.includes('roll') || normLabel.includes('roll') || normLabel.includes('রোল'))) {
        score -= 45;
        penalties.push({ reason: 'Roll number signals present; registrationNumber disqualified', deduction: 45 });
      }

      // 10. Mobile Number vs Confirm Mobile Number Disambiguation
      const isMobileConfirmSignal = /(?:confirm|retype|re_type|re-type|reenter|re_enter|re-enter|verify|again|c_mobile|c mobile|\bc_mob\b|\bcmob\b|\bcmobile\b|mobile_confirm|re_mobile|re mobile|পুনরায়|নিশ্চিতকরণ|নিশ্চিত|কনফার্ম)/i.test(
        `${evidence.name || ''} ${evidence.id || ''} ${normLabel} ${normName} ${normId} ${evidence.placeholder || ''}`
      );
      if (field.canonicalId === 'contact.mobile' && isMobileConfirmSignal) {
        score -= 50;
        penalties.push({ reason: 'Confirm Mobile signals present; primary contact.mobile disqualified', deduction: 50 });
      }
      if (
        (field.canonicalId === 'contact.alternateMobile' || field.canonicalId === 'contact.confirmMobile') &&
        !isMobileConfirmSignal
      ) {
        score -= 50;
        penalties.push({ reason: 'No confirmation signals present; contact.alternateMobile disqualified', deduction: 50 });
      }
      if (
        (field.canonicalId === 'contact.alternateMobile' || field.canonicalId === 'contact.confirmMobile') &&
        isMobileConfirmSignal
      ) {
        score += 25;
        evidenceList.push('Confirm Mobile Indicator Matched (+25 pts)');
      }

      if (score > 25) {
        scoredCandidates.push({
          field,
          score,
          evidenceList,
          penalties,
        });
      }
    }

    // Sort descending by score
    scoredCandidates.sort((a, b) => b.score - a.score);

    if (scoredCandidates.length === 0) {
      return {
        canonicalField: null,
        canonicalId: null,
        confidenceScore: 0,
        decisionTier: 'LOW_CONFIDENCE',
        sectionContext: formSection,
        supportingEvidence: [],
        penalties: [],
        isSafeToAutofill: false,
        requiresUserConfirmation: true,
        proposedValue: '',
        rejectionReason: 'No matching canonical field identified above minimum confidence threshold.',
      };
    }

    const top = scoredCandidates[0];
    const second = scoredCandidates.length > 1 ? scoredCandidates[1] : null;

    // Check for ambiguity: if second candidate is close in score
    let isAmbiguous = false;
    if (second && top.score >= this.MEDIUM_CONFIDENCE_THRESHOLD) {
      if (top.score - second.score < this.MIN_SAFE_AMBIGUITY_MARGIN) {
        isAmbiguous = true;
      }
    }

    let decisionTier: SemanticMatchResult['decisionTier'] = 'LOW_CONFIDENCE';
    let isSafe = false;

    if (isAmbiguous) {
      decisionTier = 'AMBIGUOUS';
      isSafe = false;
    } else if (top.score >= this.HIGH_CONFIDENCE_THRESHOLD) {
      decisionTier = 'HIGH_CONFIDENCE';
      isSafe = true;
    } else if (top.score >= this.MEDIUM_CONFIDENCE_THRESHOLD) {
      decisionTier = 'MEDIUM_CONFIDENCE';
      isSafe = false; // requires user review
    } else {
      decisionTier = 'LOW_CONFIDENCE';
      isSafe = false;
    }

    return {
      canonicalField: isAmbiguous ? null : top.field,
      canonicalId: isAmbiguous ? null : top.field.canonicalId,
      confidenceScore: top.score,
      decisionTier,
      sectionContext: formSection,
      supportingEvidence: top.evidenceList,
      penalties: top.penalties,
      isSafeToAutofill: isSafe,
      requiresUserConfirmation: !isSafe,
      proposedValue: '',
      rejectionReason: isAmbiguous ? `Ambiguity between ${top.field.canonicalId} and ${second?.field.canonicalId}` : undefined,
    };
  }

  /**
   * Coordinates multi-control Date of Birth (Day/Month/Year dropdown triplets)
   * using CompositeFieldAdapter.
   */
  public static async coordinateCompositeDob(
    dayEl: HTMLElement,
    monthEl: HTMLElement,
    yearEl: HTMLElement,
    dobIso: string
  ): Promise<{
    success: boolean;
    isPartial: boolean;
    verifiedDay: boolean;
    verifiedMonth: boolean;
    verifiedYear: boolean;
    message: string;
  }> {
    return CompositeFieldAdapter.fillCompositeDateOfBirth(dayEl, monthEl, yearEl, dobIso);
  }

  /**
   * Executes autofill for a matched field and performs strict read-back verification
   */
  public static async executeAndVerify(
    el: HTMLElement,
    canonicalId: string,
    profile: MasterCanonicalProfile
  ): Promise<UniversalFieldExecutionResult> {
    const rawVal = resolveCanonicalValue(profile, canonicalId) || '';
    const label = el.getAttribute('name') || el.id || 'Field';
    const section = FormSectionEngine.detectSection(el).canonicalSectionName;

    // 1. Missing Profile Data Check: NEVER invent or guess
    if (!rawVal && rawVal !== 'false') {
      return {
        element: el,
        canonicalId,
        fieldLabel: label,
        sectionContext: section,
        status: 'PROFILE_DATA_MISSING',
        proposedValue: '',
        actualVerifiedValue: '',
        message: `Profile data missing for ${canonicalId}; field left empty without fabrication.`,
        confidenceScore: 0,
      };
    }

    // 2. Framework & Control Handler Routing
    const handler = ControlHandlerRouter.getHandler(el);
    const currentValue = handler.getCurrentValue(el);

    // 3. Already Correct Check
    if (handler.isAlreadyCorrect(el, rawVal)) {
      return {
        element: el,
        canonicalId,
        fieldLabel: label,
        sectionContext: section,
        status: 'ALREADY_CORRECT',
        proposedValue: rawVal,
        actualVerifiedValue: currentValue,
        message: 'Element already holds the correct profile value.',
        confidenceScore: 100,
      };
    }

    // 4. Fill through appropriate control handler
    let fillSuccess = false;
    try {
      const result = await handler.fill(el, rawVal);
      fillSuccess = result.success;
    } catch {
      fillSuccess = false;
    }

    // 5. Read-back verification
    const verifiedVal = handler.getCurrentValue(el);
    const verified = handler.isAlreadyCorrect(el, rawVal) || (verifiedVal.length > 0 && verifiedVal.toLowerCase().includes(rawVal.toLowerCase()));

    if (verified) {
      return {
        element: el,
        canonicalId,
        fieldLabel: label,
        sectionContext: section,
        status: 'FILLED_VERIFIED',
        proposedValue: rawVal,
        actualVerifiedValue: verifiedVal,
        message: 'Field successfully populated and verified via DOM read-back.',
        confidenceScore: 100,
      };
    } else if (fillSuccess) {
      return {
        element: el,
        canonicalId,
        fieldLabel: label,
        sectionContext: section,
        status: 'PARTIALLY_FILLED',
        proposedValue: rawVal,
        actualVerifiedValue: verifiedVal,
        message: 'Field updated but read-back verification was partial or diverged.',
        confidenceScore: 70,
      };
    } else {
      return {
        element: el,
        canonicalId,
        fieldLabel: label,
        sectionContext: section,
        status: 'FRAMEWORK_UPDATE_FAILED',
        proposedValue: rawVal,
        actualVerifiedValue: verifiedVal,
        message: 'Framework setter or event dispatcher failed to update DOM control.',
        confidenceScore: 0,
      };
    }
  }
}
