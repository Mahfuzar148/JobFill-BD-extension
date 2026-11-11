// JobFill BD - Form Scanner & Fill Plan Generator
// Simple, Deterministic Architecture replacing Confidence Score system:
// FIELD NAME + SECTION CONTEXT -> MATCH PROFILE FIELD -> GET SAVED VALUE -> FILL WEBSITE FIELD -> VERIFY RESULT

import { FieldExtractor, FieldEvidence } from './field-extractor';
import { DecisionEngine, MatchExplanation } from '../intelligence/decision-engine';
import { MappingRepository } from '../database/mapping-repository';
import { extractElementFingerprint } from '../intelligence/mapping-memory';
import { DynamicFormHandler } from '../engine/dynamicFormHandler';
import { UserProfile } from '../types/profile';
import { resolveCanonicalValue, MasterCanonicalProfile } from '../shared/types/canonical-schema';
import { ValueNormalizer } from '../intelligence/value-normalizer';
import { FillPlanItem } from '../validation/verification-engine';
import { FieldStatus, DiagnosticFieldStatus } from '../types/field-status';
import { resolveSiteAdapter } from '../adapters/adapter-registry';
import { PETROBANGLA_FIELD_MAPS } from '../adapters/petrobangla/petrobangla.field-map';
import { ControlHandlerRouter, CheckboxHandler, SelectHandler } from '../handlers';

export interface PageScanResult {
  timestamp: string;
  url: string;
  totalVisibleInputs: number;
  matchedCount: number;
  readyToFillCount: number;
  alreadyCorrectCount: number;
  missingInfoCount: number;
  ambiguousCount: number;
  conflictsCount: number;
  confirmationRequiredCount?: number;
  unsupportedCount: number;
  failedCount: number;
  missingProfileFields: string[];
  planItems: FillPlanItem[];
  explanations: Map<string, MatchExplanation>;

  // Retained for backward-compatibility with existing callers
  highConfidenceCount: number;
  needsReviewCount: number;
}

// Converts a UserProfile into MasterCanonicalProfile
export function toCanonicalProfile(p: UserProfile): MasterCanonicalProfile {
  return {
    profileId: p.id,
    profileName: p.profileName,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    personal: {
      fullName: {
        english: p.personal.applicantNameEn || '',
        bangla: p.personal.applicantNameBn || '',
      },
      fatherName: {
        english: p.personal.fatherNameEn || '',
        bangla: p.personal.fatherNameBn || '',
      },
      motherName: {
        english: p.personal.motherNameEn || '',
        bangla: p.personal.motherNameBn || '',
      },
      dateOfBirth: p.personal.dob || '',
      gender: p.personal.gender || '',
      nationality: p.personal.nationality || 'Bangladeshi',
      religion: p.personal.religion || '',
      maritalStatus: p.personal.maritalStatus || '',
      spouseName: {
        english: p.personal.spouseNameEn || '',
        bangla: p.personal.spouseNameBn || '',
      },
      identities: {
        nationalId: p.personal.nid || '',
        birthRegistration: p.personal.birthReg || '',
        passport: p.personal.passport || '',
        passportExpiry: p.personal.passportExpiry || '',
      },
      contact: {
        mobile: p.personal.mobile || '',
        confirmMobile: p.personal.mobile || p.personal.confirmMobile || '',
        email: p.personal.email || '',
      },
      quota: p.personal.quota || '',
      departmentalStatus: p.personal.departmentalStatus || 'No',
    },
    address: {
      present: {
        careOf: p.address.present.careOf || '',
        village: p.address.present.village || '',
        road: p.address.present.road || '',
        house: p.address.present.house || '',
        flat: p.address.present.flat || '',
        division: p.address.present.division || '',
        district: p.address.present.district || '',
        upazila: p.address.present.upazila || '',
        postOffice: p.address.present.postOffice || '',
        postCode: p.address.present.postCode || '',
      },
      permanent: {
        careOf: p.address.permanent.careOf || '',
        village: p.address.permanent.village || '',
        road: p.address.permanent.road || '',
        house: p.address.permanent.house || '',
        flat: p.address.permanent.flat || '',
        division: p.address.permanent.division || '',
        district: p.address.permanent.district || '',
        upazila: p.address.permanent.upazila || '',
        postOffice: p.address.permanent.postOffice || '',
        postCode: p.address.permanent.postCode || '',
      },
      sameAsPresent: p.address.sameAsPresent || false,
    },
    education: {
      ssc: {
        examination: p.ssc?.examination || '',
        board: p.ssc?.board || '',
        roll: p.ssc?.rollNumber || '',
        registration: p.ssc?.registrationNumber || '',
        group: p.ssc?.groupSubject || '',
        result: p.ssc?.resultType || '',
        gpa: p.ssc?.gpa || '',
        passingYear: p.ssc?.passingYear || '',
      },
      hsc: {
        examination: p.hsc?.examination || '',
        board: p.hsc?.board || '',
        roll: p.hsc?.rollNumber || '',
        registration: p.hsc?.registrationNumber || '',
        group: p.hsc?.groupSubject || '',
        result: p.hsc?.resultType || '',
        gpa: p.hsc?.gpa || '',
        passingYear: p.hsc?.passingYear || '',
      },
      graduation: p.graduation
        ? {
            degree: p.graduation.examination || '',
            subject: p.graduation.subjectDegree || '',
            institution: p.graduation.universityInstitute || '',
            result: p.graduation.resultType || '',
            gpa: p.graduation.gpa || '',
            passingYear: p.graduation.passingYear || '',
            courseDuration: p.graduation.courseDuration || '',
          }
        : undefined,
      masters: p.masters
        ? {
            degree: p.masters.examination || '',
            subject: p.masters.subjectDegree || '',
            institution: p.masters.universityInstitute || '',
            result: p.masters.resultType || '',
            gpa: p.masters.gpa || '',
            passingYear: p.masters.passingYear || '',
            courseDuration: p.masters.courseDuration || '',
          }
        : undefined,
    },
    experiences: (p.jobExperiences || []).map((exp, idx) => ({
      id: exp.id || `exp_${idx}`,
      employedOn: exp.employedOn || '',
      organization: exp.organization || '',
      designation: exp.designation || '',
      address: exp.address || '',
      startDate: exp.startDate || '',
      endDate: exp.endDate || '',
      currentlyWorking: exp.currentlyWorking || false,
      jobDescription: exp.jobDescription || '',
    })),
    circularPreferences: {
      recruitmentTitle: '',
      postCode: '',
      postName: '',
      department: '',
      examCentre: p.special?.examCentre || 'Dhaka',
      questionVersion: (p.special?.questionVersion as any) || 'Bangla',
      cadrePreference: p.special?.cadrePreference || '',
      nonCadrePreference: p.special?.nonCadrePreference || '',
      quotaDeclaration: p.personal?.quota || 'General',
      orgChoice1: p.special?.orgChoice1 || '',
      orgChoice2: p.special?.orgChoice2 || '',
    },
  };
}

export class PageScanner {
  public static async scanPage(profile: UserProfile): Promise<PageScanResult> {
    // 1. Trigger conditional section reveals based on applicant profile
    DynamicFormHandler.prepareConditionalSections(document, profile);

    const canonicalProfile = toCanonicalProfile(profile);
    const planItems: FillPlanItem[] = [];
    const explanations = new Map<string, MatchExplanation>();
    const missingProfileFields: string[] = [];

    // Query candidate inputs (filter out hidden, submit buttons, captchas, csrf tokens)
    const elements = Array.from(document.querySelectorAll<HTMLElement>('input, select, textarea')).filter((el) =>
      FieldExtractor.isSafeEditableField(el)
    );

    const siteAdapter = resolveSiteAdapter(window.location.href, document);
    const isPetroBanglaSite = siteAdapter?.id === 'petrobangla';

    const seenRadioGroups = new Set<string>();

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];

      // Radio group deduplication: create single plan item per named radio group
      if (el instanceof HTMLInputElement && el.type.toLowerCase() === 'radio' && el.name) {
        if (seenRadioGroups.has(el.name)) {
          continue;
        }
        seenRadioGroups.add(el.name);
      }

      const evidence = FieldExtractor.extractEvidence(el);

      let matchedCanonicalId: string | null = null;
      let isAmbiguous = false;
      let ambiguityReason = '';

      // Check 1: Adaptive Mapping Memory
      const fp = extractElementFingerprint(el, evidence.parentContextText);
      const learned = await MappingRepository.findMapping(fp);
      if (learned && learned.canonicalKey) {
        matchedCanonicalId = learned.canonicalKey;
      }

      // Check 2: Universal Matcher with Rigorous Context Analysis
      let explanation: MatchExplanation | undefined;
      if (!matchedCanonicalId) {
        explanation = DecisionEngine.decide(evidence);
        explanations.set(evidence.selector, explanation);

        if (explanation.decisionTier === 'AMBIGUOUS') {
          isAmbiguous = true;
          ambiguityReason = explanation.rejectionReason || 'Ambiguous matching candidates. Requires user clarification.';
        } else if (explanation.selectedCanonicalId) {
          matchedCanonicalId = explanation.selectedCanonicalId;
        }
      }

      // Retrieve saved value
      let proposedVal = '';
      let isIdentityYesNoSelect = false;
      if (matchedCanonicalId) {
        if (matchedCanonicalId === 'contact.confirmMobile') {
          // Always mirror primary contact.mobile rather than a stale/divergent confirmMobile
          proposedVal = canonicalProfile.personal.contact.mobile || '';
        } else {
          proposedVal = resolveCanonicalValue(canonicalProfile, matchedCanonicalId) || '';
        }

        // Handle Teletalk/BOGMC Yes/No presence dropdowns for National ID, Birth Registration, and Passport ID
        if (
          (matchedCanonicalId === 'identity.birthRegistration' ||
            matchedCanonicalId === 'identity.nationalId' ||
            matchedCanonicalId === 'identity.passport') &&
          el instanceof HTMLSelectElement &&
          SelectHandler.isYesNoSelect(el)
        ) {
          isIdentityYesNoSelect = true;
          const trimmedId = proposedVal.trim();
          const negativeTokens = new Set(['no', 'none', 'n/a', 'না', 'নেই']);
          if (trimmedId && !negativeTokens.has(trimmedId.toLowerCase())) {
            proposedVal = 'Yes';
          } else {
            // Never assume Yes or No when saved identity number is absent
            proposedVal = '';
          }
        }

        // Date format normalization for target element (DD-MM-YYYY vs YYYY-MM-DD)
        if (
          matchedCanonicalId.includes('dateOfBirth') ||
          matchedCanonicalId.includes('dob') ||
          matchedCanonicalId.includes('Date')
        ) {
          proposedVal = ValueNormalizer.formatDateForTarget(proposedVal, evidence.inputType, evidence.placeholder);
        }

        // Enforce input maxLength limit
        if (evidence.maxLength > 0 && proposedVal) {
          proposedVal = ValueNormalizer.truncate(proposedVal, evidence.maxLength);
        }
      }

      // Conflict detection using specialized control handler
      const handler = ControlHandlerRouter.getHandler(el);
      const currentVal = handler.getCurrentValue(el);
      const isCorrect = handler.isAlreadyCorrect(el, proposedVal);
      const isDeclaration =
        handler instanceof CheckboxHandler &&
        el instanceof HTMLInputElement &&
        handler.isDeclarationOrTermsCheckbox(el);

      let status: FieldStatus = 'Unsupported Field';
      let diagnosticStatus: DiagnosticFieldStatus = 'Mapping Not Found';
      let statusReason = '';
      let hasConflict = false;
      let isApproved = false;

      if (isDeclaration) {
        status = 'Unsupported Field';
        diagnosticStatus = 'Unsupported Control';
        statusReason = 'Safety Policy: Legal declarations and terms must be checked manually by the applicant.';
        isApproved = false;
      } else if (!matchedCanonicalId && !isAmbiguous) {
        status = 'Unsupported Field';
        diagnosticStatus = 'Mapping Not Found';
        statusReason = 'Mapping Not Found: No matching canonical profile field identified.';
        isApproved = false;
      } else if (isAmbiguous) {
        status = 'Ambiguous Field';
        diagnosticStatus = 'Mapping Not Found';
        statusReason = ambiguityReason || 'Mapping Not Found: Ambiguous field meaning in current section context.';
        isApproved = false;
      } else if (!proposedVal || proposedVal.trim() === '') {
        status = 'Missing Profile Information';
        diagnosticStatus = 'Profile Information Missing';
        if (matchedCanonicalId === 'applicant.quota') {
          statusReason =
            'Application-Specific Information Required: No Quota preference is saved in profile (never assumed).';
        } else if (isIdentityYesNoSelect) {
          statusReason =
            'Profile Information Missing: No saved number in profile; Yes/No option cannot be assumed.';
        } else {
          statusReason = 'Profile Information Missing: No saved value in active profile.';
        }
        missingProfileFields.push(matchedCanonicalId!);
        isApproved = false;
      } else if (isCorrect) {
        status = 'Already Correct';
        diagnosticStatus = 'Already Correct';
        statusReason = 'Field on website already contains the saved profile value.';
        isApproved = false; // No need to overwrite
      } else if (evidence.isDisabled || evidence.isReadOnly) {
        status = 'Unsupported Field';
        diagnosticStatus = 'Unsupported Control';
        statusReason = 'Unsupported Control: Field is currently disabled or read-only on the website.';
        isApproved = false;
      } else if (matchedCanonicalId === 'applicant.quota') {
        // Explicit Quota preference requires explicit user confirmation before selecting
        status = 'User Confirmation Required';
        diagnosticStatus = 'User Confirmation Required';
        statusReason = `User Confirmation Required: Saved Quota preference "${proposedVal}". Confirm before selecting.`;
        hasConflict = false;
        isApproved = false;
      } else if (currentVal !== '' && !isCorrect) {
        // For checkboxes, unchecked ('false') is ready to fill when user profile has true
        if (evidence.inputType === 'checkbox' && currentVal === 'false') {
          status = 'Matched';
          diagnosticStatus = 'Successfully Filled';
          statusReason = 'Matched with saved profile and ready to fill.';
          hasConflict = false;
          isApproved = true;
        } else {
          status = 'Existing Value Conflict';
          diagnosticStatus = 'User Confirmation Required';
          statusReason = `Website currently has "${currentVal}", profile has "${proposedVal}".`;
          hasConflict = true;
          isApproved = false; // Protected from overwrite without explicit user check
        }
      } else {
        status = 'Matched';
        diagnosticStatus = 'Successfully Filled';
        statusReason = 'Matched with saved profile and ready to fill.';
        hasConflict = false;
        isApproved = true; // Auto-approved! No confidence-based blocking!
      }

      planItems.push({
        id: `item_${i}`,
        element: el,
        selector: evidence.selector,
        canonicalId: matchedCanonicalId || 'unknown',
        fieldLabel: `${evidence.label || evidence.name || 'Field'} (${matchedCanonicalId || 'unmatched'})`,
        sectionContext: evidence.parentContextText,
        proposedValue: proposedVal,
        originalValue: currentVal,
        hasConflict,
        isApproved,
        status,
        diagnosticStatus,
        statusReason,
      });
    }

    const matchedCount = planItems.filter((i) => i.canonicalId !== 'unknown').length;
    const readyToFillCount = planItems.filter((i) => i.status === 'Matched').length;
    const alreadyCorrectCount = planItems.filter((i) => i.status === 'Already Correct').length;
    const missingInfoCount = planItems.filter((i) => i.status === 'Missing Profile Information').length;
    const ambiguousCount = planItems.filter((i) => i.status === 'Ambiguous Field').length;
    const conflictsCount = planItems.filter((i) => i.status === 'Existing Value Conflict').length;
    const confirmationRequiredCount = planItems.filter((i) => i.status === 'User Confirmation Required').length;
    const unsupportedCount = planItems.filter((i) => i.status === 'Unsupported Field').length;
    const failedCount = planItems.filter((i) => i.status === 'Fill Failed').length;

    return {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      totalVisibleInputs: elements.length,
      matchedCount,
      readyToFillCount,
      alreadyCorrectCount,
      missingInfoCount,
      ambiguousCount,
      conflictsCount,
      confirmationRequiredCount,
      unsupportedCount,
      failedCount,
      missingProfileFields: Array.from(new Set(missingProfileFields)),
      planItems,
      explanations,
      // Backward compatibility counters
      highConfidenceCount: readyToFillCount,
      needsReviewCount: missingInfoCount + ambiguousCount + conflictsCount + confirmationRequiredCount,
    };
  }
}
