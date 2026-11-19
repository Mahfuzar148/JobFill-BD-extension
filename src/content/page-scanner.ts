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
import { UniversalSemanticEngine } from '../intelligence/universal-semantic-engine';
import { FormSectionEngine } from '../intelligence/form-section-engine';
import { CascadingDropdownEngine } from '../engine/cascadingDropdownEngine';
import { CompositeFieldAdapter } from '../intelligence/composite-field-adapter';

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
      nationality: p.personal.nationality || '',
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
        mobile: ValueNormalizer.normalizeMobileNumber(
          p.personal.mobile || (p.personal as any).phone || (p.personal as any).contactNumber || ''
        ),
        confirmMobile: ValueNormalizer.normalizeMobileNumber(
          p.personal.mobile || p.personal.confirmMobile || (p.personal as any).phone || ''
        ),
        email: p.personal.email || '',
      },
      quota: p.personal.quota || '',
      departmentalStatus: p.personal.departmentalStatus || 'No',
    },
    address: {
      present: {
        careOf: p.address?.present?.careOf || '',
        village: p.address?.present?.village || '',
        road: p.address?.present?.road || '',
        house: p.address?.present?.house || '',
        flat: p.address?.present?.flat || '',
        division: p.address?.present?.division || '',
        district: p.address?.present?.district || '',
        upazila: p.address?.present?.upazila || '',
        postOffice: p.address?.present?.postOffice || '',
        postCode: p.address?.present?.postCode || '',
      },
      permanent: {
        careOf: p.address?.permanent?.careOf || '',
        village: p.address?.permanent?.village || '',
        road: p.address?.permanent?.road || '',
        house: p.address?.permanent?.house || '',
        flat: p.address?.permanent?.flat || '',
        division: p.address?.permanent?.division || '',
        district: p.address?.permanent?.district || '',
        upazila: p.address?.permanent?.upazila || '',
        postOffice: p.address?.permanent?.postOffice || '',
        postCode: p.address?.permanent?.postCode || '',
      },
      sameAsPresent: (() => {
        if (!p.address?.sameAsPresent) return false;
        const pres = p.address?.present || ({} as any);
        const perm = p.address?.permanent || ({} as any);
        const clean = (s: string | undefined) => (s || '').trim().toLowerCase();
        const hasExplicitConflict = Boolean(
          (pres.district && perm.district && clean(pres.district) !== clean(perm.district)) ||
          (pres.upazila && perm.upazila && clean(pres.upazila) !== clean(perm.upazila)) ||
          (pres.village && perm.village && clean(pres.village) !== clean(perm.village)) ||
          (pres.careOf && perm.careOf && clean(pres.careOf) !== clean(perm.careOf)) ||
          (pres.road && perm.road && clean(pres.road) !== clean(perm.road)) ||
          (pres.house && perm.house && clean(pres.house) !== clean(perm.house)) ||
          (pres.postCode && perm.postCode && clean(pres.postCode) !== clean(perm.postCode))
        );
        return !hasExplicitConflict;
      })(),
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
        gpaScale: p.ssc?.gpaScale || '5.0',
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
        gpaScale: p.hsc?.gpaScale || '5.0',
        passingYear: p.hsc?.passingYear || '',
      },
      graduation: p.graduation
        ? {
            degree: p.graduation.examination || '',
            subject: p.graduation.subjectDegree || '',
            institution: p.graduation.universityInstitute || '',
            result: p.graduation.resultType || '',
            gpa: p.graduation.gpa || '',
            gpaScale: p.graduation.gpaScale || '4.0',
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
            gpaScale: p.masters.gpaScale || '4.0',
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
    references: (p.references || []).map((ref, idx) => ({
      id: ref.id || `ref_${idx}`,
      name: ref.name || '',
      designation: ref.designation || '',
      organization: ref.organization || '',
      mobile: ref.mobile || '',
      email: ref.email || '',
      address: ref.address || '',
      relation: ref.relation || '',
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
    customFields: p.customFields || [],
    special: (p.special as any) || {},
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
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>('input, select, textarea, [role="combobox"]')
    ).filter((el) => FieldExtractor.isSafeEditableField(el));

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
        const learnedExp: MatchExplanation = {
          detectedLabel: evidence.label || evidence.name || 'Learned Field',
          elementSelector: evidence.selector,
          selectedCanonicalId: learned.canonicalKey,
          matchScore: 100,
          decisionTier: 'HIGH_CONFIDENCE',
          confidencePercent: 100,
          hierarchyContext: evidence.parentContextText,
          supportingEvidence: ['Learned Adaptive Mapping Memory'],
          penalties: [],
          alternativeCandidates: [],
          isSafeToAutofill: true,
          requiresUserConfirmation: false,
        };
        explanations.set(evidence.selector, learnedExp);
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
        } else {
          // Fallback to Universal Multi-Signal Semantic Engine
          const uniMatch = UniversalSemanticEngine.matchElement(evidence);
          if (uniMatch.decisionTier === 'AMBIGUOUS') {
            isAmbiguous = true;
            ambiguityReason = uniMatch.rejectionReason || 'Ambiguous matching candidates in universal engine.';
          } else if (uniMatch.canonicalId && uniMatch.isSafeToAutofill) {
            matchedCanonicalId = uniMatch.canonicalId;
            explanation = {
              detectedLabel: evidence.label || evidence.name || 'Field',
              elementSelector: evidence.selector,
              selectedCanonicalId: uniMatch.canonicalId,
              matchScore: uniMatch.confidenceScore,
              decisionTier: uniMatch.decisionTier,
              confidencePercent: uniMatch.confidenceScore,
              hierarchyContext: evidence.parentContextText,
              supportingEvidence: uniMatch.supportingEvidence,
              penalties: uniMatch.penalties,
              alternativeCandidates: [],
              isSafeToAutofill: uniMatch.isSafeToAutofill,
              requiresUserConfirmation: uniMatch.requiresUserConfirmation,
              rejectionReason: uniMatch.rejectionReason,
            };
            explanations.set(evidence.selector, explanation);
          }
        }
      }

      // Check 3: Learned Dynamic Custom Fields Matcher (Enables Future Autofill of Learned Fields)
      if (!matchedCanonicalId && profile.customFields && profile.customFields.length > 0) {
        const textToMatch = [
          evidence.name,
          evidence.id,
          evidence.label,
          evidence.placeholder,
          evidence.ariaLabel,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        const elNameClean = (evidence.name || '').toLowerCase().replace(/[^a-z0-9_]+/g, '_');
        const elIdClean = (evidence.id || '').toLowerCase().replace(/[^a-z0-9_]+/g, '_');

        for (const cf of profile.customFields) {
          if (cf.reuseInAutofill === false) continue;
          const cleanKey = cf.fieldKey.replace(/^custom_/, '').toLowerCase();
          const keyRaw = cleanKey.replace(/_/g, ' ');
          const labelEn = cf.labelEn ? cf.labelEn.toLowerCase() : '';
          const labelBn = cf.labelBn ? cf.labelBn.trim() : '';

          // Significant words (length >= 3, excluding common stopwords)
          const stopWords = new Set(['the', 'and', 'for', 'with', 'your', 'from']);
          const keyWords = keyRaw.split(' ').filter((w) => w.length >= 3 && !stopWords.has(w));
          const labelWords = labelEn.split(' ').filter((w) => w.length >= 3 && !stopWords.has(w));
          const wordsToTest = Array.from(new Set([...keyWords, ...labelWords]));
          const matchedWords = wordsToTest.filter((w) => textToMatch.includes(w));
          const hasSemanticWordOverlap =
            wordsToTest.length >= 2 ? matchedWords.length >= 2 : matchedWords.length >= 1;

          if (
            (cleanKey && (cleanKey === elNameClean || cleanKey === elIdClean)) ||
            (keyRaw && textToMatch.includes(keyRaw)) ||
            (cleanKey && textToMatch.includes(cleanKey)) ||
            (labelEn && textToMatch.includes(labelEn)) ||
            (labelBn && textToMatch.includes(labelBn)) ||
            hasSemanticWordOverlap
          ) {
            matchedCanonicalId = cf.fieldKey;
            break;
          }
        }
      }

      // Retrieve saved value
      let proposedVal = '';
      let isIdentityYesNoSelect = false;
      if (matchedCanonicalId) {
        if (
          matchedCanonicalId === 'contact.confirmMobile' ||
          matchedCanonicalId === 'contact.alternateMobile' ||
          matchedCanonicalId === 'candidate.confirmMobile'
        ) {
          // Always mirror primary contact.mobile rather than a stale/divergent confirmMobile
          proposedVal = canonicalProfile.personal.contact.mobile || '';
        } else {
          proposedVal = resolveCanonicalValue(canonicalProfile, matchedCanonicalId) || '';
        }

        if (
          matchedCanonicalId === 'contact.mobile' ||
          matchedCanonicalId === 'candidate.mobile' ||
          matchedCanonicalId === 'contact.confirmMobile' ||
          matchedCanonicalId === 'contact.alternateMobile' ||
          matchedCanonicalId === 'candidate.confirmMobile'
        ) {
          proposedVal = ValueNormalizer.normalizeMobileNumber(proposedVal);
        }

        // Handle Teletalk/BOGMC Yes/No presence controls (Dropdowns or Radio groups) for National ID, Birth Registration, and Passport ID
        if (
          matchedCanonicalId === 'candidate.nationalId.hasNid' ||
          ((matchedCanonicalId === 'identity.birthRegistration' ||
            matchedCanonicalId === 'identity.nationalId' ||
            matchedCanonicalId === 'candidate.nationalId.number' ||
            matchedCanonicalId === 'identity.passport') &&
            ((el instanceof HTMLSelectElement && SelectHandler.isYesNoSelect(el)) ||
             (el instanceof HTMLInputElement && el.type.toLowerCase() === 'radio')))
        ) {
          isIdentityYesNoSelect = true;
          if (el instanceof HTMLInputElement && el.type.toLowerCase() === 'radio' && (el.name === 'nid' || el.name.toLowerCase().includes('nid'))) {
            matchedCanonicalId = 'candidate.nationalId.hasNid';
          }
          let trimmedId = proposedVal.trim();
          if (
            (matchedCanonicalId === 'candidate.nationalId.number' ||
              matchedCanonicalId === 'candidate.nationalId.hasNid' ||
              matchedCanonicalId === 'identity.nationalId') &&
            !trimmedId
          ) {
            trimmedId = (canonicalProfile.personal.identities.nationalId || '').trim();
          }
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

        // Coordinate Day/Month/Year components using CompositeFieldAdapter
        if (
          matchedCanonicalId.includes('dateOfBirth.day') ||
          matchedCanonicalId.includes('dob.day') ||
          matchedCanonicalId.includes('dateOfBirth.month') ||
          matchedCanonicalId.includes('dob.month') ||
          matchedCanonicalId.includes('dateOfBirth.year') ||
          matchedCanonicalId.includes('dob.year')
        ) {
          const rawDob = profile.personal.dob || canonicalProfile.personal.dateOfBirth;
          const parsed = CompositeFieldAdapter.parseDateOfBirth(rawDob);
          if (parsed) {
            const kind = (matchedCanonicalId.includes('.day')
              ? 'day'
              : matchedCanonicalId.includes('.month')
              ? 'month'
              : 'year') as 'day' | 'month' | 'year';

            if (el instanceof HTMLSelectElement) {
              const matchedOpt = CompositeFieldAdapter.matchDateSelectOption(el, parsed, kind);
              if (matchedOpt) {
                proposedVal = matchedOpt.value;
              }
            } else if (el instanceof HTMLInputElement) {
              if (kind === 'day') {
                proposedVal = (evidence.placeholder.toLowerCase() === 'dd' || evidence.maxLength === 2)
                  ? parsed.dayPadded
                  : parsed.day;
              } else if (kind === 'month') {
                proposedVal = (evidence.placeholder.toLowerCase() === 'mm' || evidence.maxLength === 2)
                  ? parsed.monthPadded
                  : parsed.month;
              } else {
                proposedVal = parsed.year;
              }
            }
          }
        }

        // Enforce input maxLength limit for free-text fields, but NEVER silently truncate critical numeric identities (Mobile, NID, PostCode)
        const isCriticalNumeric =
          matchedCanonicalId.includes('mobile') ||
          matchedCanonicalId.includes('nationalId') ||
          matchedCanonicalId.includes('nid') ||
          matchedCanonicalId.includes('postCode');

        if (evidence.maxLength > 0 && proposedVal) {
          if (isCriticalNumeric && proposedVal.length > evidence.maxLength) {
            // Keep full string so validation cleanly rejects rather than inserting a corrupted partial number
          } else {
            proposedVal = ValueNormalizer.truncate(proposedVal, evidence.maxLength);
          }
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
      } else if (evidence.isDisabled || evidence.isReadOnly) {
        status = 'Unsupported Field';
        diagnosticStatus = 'Unsupported Control';
        statusReason = 'Unsupported Control: Field is currently disabled or read-only on the website.';
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
        } else if (matchedCanonicalId === 'education.ssc.board') {
          statusReason =
            'PROFILE_DATA_MISSING: SSC Board is not set in active profile. Please update SSC Education record.';
        } else if (matchedCanonicalId === 'education.hsc.board') {
          statusReason =
            'PROFILE_DATA_MISSING: HSC Board is not set in active profile. Please update HSC Education record.';
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
        // For checkboxes:
        // - Unchecked ('false') ready to check when profile has 'true'
        // - Checked ('true') ready to uncheck when profile has 'false' (e.g. Same as Present when addresses differ)
        if (evidence.inputType === 'checkbox') {
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

  /**
   * Resolves dependent cascading dropdown pairs (Division -> District -> Upazila, Degree -> Subject)
   * using bounded MutationObserver option waits rather than fragile sleep delays.
   */
  public static async resolveCascadingFields(
    doc: Document = document,
    profile: UserProfile
  ): Promise<{ addressResolved: boolean; educationResolved: boolean }> {
    let addressResolved = false;
    let educationResolved = false;

    // 1. Present Address Cascading: Division -> District -> Upazila
    const presDiv = doc.querySelector<HTMLSelectElement>(
      'select[name*="present" i][name*="div" i], select[id*="present" i][id*="div" i], select#present_division, select#p_division'
    );
    const presDist = doc.querySelector<HTMLSelectElement>(
      'select[name*="present" i][name*="dist" i], select[id*="present" i][id*="dist" i], select#present_district, select#p_district'
    );
    const presUpz = doc.querySelector<HTMLSelectElement>(
      'select[name*="present" i][name*="upaz" i], select[name*="present" i][name*="thana" i], select[id*="present" i][id*="upaz" i], select#present_upazila, select#p_upazila'
    );

    if (presDiv && presDist && profile.address?.present?.division && profile.address?.present?.district) {
      await CascadingDropdownEngine.handleCascadingPair(
        presDiv,
        presDist,
        profile.address.present.division,
        profile.address.present.district
      );
    }
    if (presDist && presUpz && profile.address?.present?.district && profile.address?.present?.upazila) {
      const res = await CascadingDropdownEngine.handleCascadingPair(
        presDist,
        presUpz,
        profile.address.present.district,
        profile.address.present.upazila
      );
      if (res.success) addressResolved = true;
    }

    // 2. Permanent Address Cascading: Division -> District -> Upazila
    const permDiv = doc.querySelector<HTMLSelectElement>(
      'select[name*="permanent" i][name*="div" i], select[id*="permanent" i][id*="div" i], select#permanent_division, select#per_division'
    );
    const permDist = doc.querySelector<HTMLSelectElement>(
      'select[name*="permanent" i][name*="dist" i], select[id*="permanent" i][id*="dist" i], select#permanent_district, select#per_district'
    );
    const permUpz = doc.querySelector<HTMLSelectElement>(
      'select[name*="permanent" i][name*="upaz" i], select[name*="permanent" i][name*="thana" i], select[id*="permanent" i][id*="upaz" i], select#permanent_upazila, select#per_upazila'
    );

    if (permDiv && permDist && profile.address?.permanent?.division && profile.address?.permanent?.district) {
      await CascadingDropdownEngine.handleCascadingPair(
        permDiv,
        permDist,
        profile.address.permanent.division,
        profile.address.permanent.district
      );
    }
    if (permDist && permUpz && profile.address?.permanent?.district && profile.address?.permanent?.upazila) {
      const res = await CascadingDropdownEngine.handleCascadingPair(
        permDist,
        permUpz,
        profile.address.permanent.district,
        profile.address.permanent.upazila
      );
      if (res.success) addressResolved = true;
    }

    // 3. Education Cascading: Degree -> Subject (Graduation & Masters)
    const gradDegree = doc.querySelector<HTMLSelectElement>(
      'select[name*="gra" i][name*="deg" i], select[id*="gra" i][id*="deg" i], select#gra_degree, select#n_grad_degree'
    );
    const gradSubject = doc.querySelector<HTMLSelectElement>(
      'select[name*="gra" i][name*="sub" i], select[id*="gra" i][id*="sub" i], select#gra_subject, select#n_grad_subject'
    );
    if (gradDegree && gradSubject && profile.graduation?.examination && profile.graduation?.subjectDegree) {
      const res = await CascadingDropdownEngine.handleCascadingPair(
        gradDegree,
        gradSubject,
        profile.graduation.examination,
        profile.graduation.subjectDegree
      );
      if (res.success) educationResolved = true;
    }

    const masDegree = doc.querySelector<HTMLSelectElement>(
      'select[name*="mas" i][name*="deg" i], select[id*="mas" i][id*="deg" i], select#mas_degree, select#n_mas_degree'
    );
    const masSubject = doc.querySelector<HTMLSelectElement>(
      'select[name*="mas" i][name*="sub" i], select[id*="mas" i][id*="sub" i], select#mas_subject, select#n_mas_subject'
    );
    if (masDegree && masSubject && profile.masters?.examination && profile.masters?.subjectDegree) {
      const res = await CascadingDropdownEngine.handleCascadingPair(
        masDegree,
        masSubject,
        profile.masters.examination,
        profile.masters.subjectDegree
      );
      if (res.success) educationResolved = true;
    }

    // 4. Secondary Education Board -> Group
    const sscBoard = doc.querySelector<HTMLSelectElement>(
      'select[name*="ssc" i][name*="board" i], select[id*="ssc" i][id*="board" i], select#ssc_board'
    );
    const sscGroup = doc.querySelector<HTMLSelectElement>(
      'select[name*="ssc" i][name*="group" i], select[id*="ssc" i][id*="group" i], select#ssc_group'
    );
    if (sscBoard && sscGroup && profile.ssc?.board && profile.ssc?.groupSubject) {
      const res = await CascadingDropdownEngine.handleCascadingPair(
        sscBoard,
        sscGroup,
        profile.ssc.board,
        profile.ssc.groupSubject
      );
      if (res.success) educationResolved = true;
    }

    return { addressResolved, educationResolved };
  }

  /**
   * Coordinates composite Date of Birth triplets (Day/Month/Year dropdowns or inputs)
   * using CompositeFieldAdapter.
   */
  public static async coordinateCompositeDob(
    containerOrDoc: Element | Document = document,
    dobIso: string
  ): Promise<{ success: boolean; message: string }> {
    const dayControl = containerOrDoc.querySelector<HTMLElement>(
      'select[name*="dob" i][name*="day" i], select[id*="dob" i][id*="day" i], select[name*="birth" i][name*="day" i], select#dob_day, select#b_day, select#day, input[name*="dob" i][name*="day" i], input[id*="dob" i][id*="day" i], input#dob_day, input#b_day, select[name*="day" i], select[id*="day" i], input[name*="day" i], input[id*="day" i]'
    );
    const monthControl = containerOrDoc.querySelector<HTMLElement>(
      'select[name*="dob" i][name*="month" i], select[id*="dob" i][id*="month" i], select[name*="birth" i][name*="month" i], select#dob_month, select#b_month, select#month, input[name*="dob" i][name*="month" i], input[id*="dob" i][id*="month" i], input#dob_month, input#b_month, select[name*="month" i], select[id*="month" i], input[name*="month" i], input[id*="month" i]'
    );
    const yearControl = containerOrDoc.querySelector<HTMLElement>(
      'select[name*="dob" i][name*="year" i], select[id*="dob" i][id*="year" i], select[name*="birth" i][name*="year" i], select#dob_year, select#b_year, select#year, input[name*="dob" i][name*="year" i], input[id*="dob" i][id*="year" i], input#dob_year, input#b_year, select[name*="year" i], select[id*="year" i], input[name*="year" i], input[id*="year" i]'
    );

    if (dayControl && monthControl && yearControl && dobIso) {
      const res = await CompositeFieldAdapter.fillCompositeDateOfBirth(
        dayControl,
        monthControl,
        yearControl,
        dobIso
      );
      return { success: res.success, message: res.message };
    }
    return { success: false, message: 'Could not find all 3 Day/Month/Year controls' };
  }
}

export { CascadingDropdownEngine, CompositeFieldAdapter };
