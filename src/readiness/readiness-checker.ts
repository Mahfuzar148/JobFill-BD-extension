// JobFill BD - Pre-Application Readiness Checker
// Audits saved profile data, documents, eligibility, and manual review confirmations
// before a user opens an application portal. NEVER auto-submits forms or accepts declarations.

import type { DocumentMetadata, UserProfile } from '../types/profile';
import type { NormalizedJobCircular } from '../jobs/types/job.types';
import { evaluateProfileEligibility, type FullEligibilityReport } from '../jobs/services/eligibility-helper';

export type ReadinessStatus = 'Ready' | 'Missing' | 'Needs Review';

export interface ReadinessCheckItem {
  key:
    | 'personal_profile'
    | 'education_details'
    | 'photo_ready'
    | 'signature_ready'
    | 'certificates_ready'
    | 'eligibility_review'
    | 'manual_form_review'
    | 'manual_fee_review'
    | 'manual_declaration_review';
  titleEn: string;
  titleBn: string;
  status: ReadinessStatus;
  detailEn: string;
  isManualConfirmation?: boolean;
}

export interface ReadinessEvaluationResult {
  overallReadyCount: number;
  totalChecks: number;
  allRequiredReady: boolean;
  items: ReadinessCheckItem[];
  eligibilityReport: FullEligibilityReport | null;
}

export interface ManualReadinessState {
  formFieldsReviewed: boolean;
  feeInfoReviewed: boolean;
  declarationsReviewed: boolean;
}

const READINESS_STORAGE_KEY = 'jobfill_readiness_manual_v1';

export function loadManualReadiness(scopeKey: string): ManualReadinessState {
  if (typeof localStorage === 'undefined') {
    return { formFieldsReviewed: false, feeInfoReviewed: false, declarationsReviewed: false };
  }
  try {
    const raw = localStorage.getItem(READINESS_STORAGE_KEY);
    if (!raw) return { formFieldsReviewed: false, feeInfoReviewed: false, declarationsReviewed: false };
    const map = JSON.parse(raw) as Record<string, ManualReadinessState>;
    return (
      map[scopeKey] || {
        formFieldsReviewed: false,
        feeInfoReviewed: false,
        declarationsReviewed: false,
      }
    );
  } catch {
    return { formFieldsReviewed: false, feeInfoReviewed: false, declarationsReviewed: false };
  }
}

export function saveManualReadiness(scopeKey: string, next: ManualReadinessState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(READINESS_STORAGE_KEY);
    const map: Record<string, ManualReadinessState> = raw ? JSON.parse(raw) : {};
    map[scopeKey] = next;
    localStorage.setItem(READINESS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota error
  }
}

export function evaluateApplicationReadiness(
  profile: UserProfile,
  documents: DocumentMetadata[],
  job: NormalizedJobCircular | null,
  manual: ManualReadinessState
): ReadinessEvaluationResult {
  const items: ReadinessCheckItem[] = [];

  // 1. Personal profile completeness
  const missingPersonal: string[] = [];
  if (!profile.personal?.applicantNameEn?.trim()) missingPersonal.push('Applicant Name');
  if (!profile.personal?.fatherNameEn?.trim()) missingPersonal.push("Father's Name");
  if (!profile.personal?.motherNameEn?.trim()) missingPersonal.push("Mother's Name");
  if (!profile.personal?.dob?.trim()) missingPersonal.push('Date of Birth');
  if (!profile.personal?.mobile?.trim()) missingPersonal.push('Mobile');
  if (!profile.personal?.nid?.trim() && !profile.personal?.birthReg?.trim()) missingPersonal.push('NID or Birth Reg');

  items.push({
    key: 'personal_profile',
    titleEn: 'Personal & Identity Information',
    titleBn: 'ব্যক্তিগত ও পরিচয় সংক্রান্ত তথ্য',
    status: missingPersonal.length === 0 ? 'Ready' : 'Missing',
    detailEn:
      missingPersonal.length === 0
        ? 'Core identity fields present in local profile.'
        : `Missing: ${missingPersonal.join(', ')}`,
  });

  // 2. Real Academic Records (never counts empty dropdown defaults)
  const hasSsc = Boolean(profile.ssc?.gpa?.trim() || profile.ssc?.rollNumber?.trim() || profile.ssc?.passingYear?.trim());
  const hasHsc = Boolean(profile.hsc?.gpa?.trim() || profile.hsc?.rollNumber?.trim() || profile.hsc?.passingYear?.trim());
  const hasGrad = Boolean(
    profile.hasGraduation &&
      (profile.graduation?.gpa?.trim() ||
        profile.graduation?.subjectDegree?.trim() ||
        profile.graduation?.universityInstitute?.trim())
  );
  items.push({
    key: 'education_details',
    titleEn: 'Academic Qualifications (SSC/HSC/Higher)',
    titleBn: 'শিক্ষাগত যোগ্যতার তথ্য',
    status: hasSsc && hasHsc ? 'Ready' : hasSsc ? 'Needs Review' : 'Missing',
    detailEn:
      hasSsc && hasHsc
        ? `SSC & HSC entered${hasGrad ? ' + Higher Education' : ''}.`
        : 'Enter real Roll/GPA/Passing Year under Education Records.',
  });

  // 3. Photo Ready (300x300 standard check)
  const photos = documents.filter((d) => d.documentType === 'photo');
  const compliantPhoto = photos.find((p) => p.width === 300 && p.height === 300);
  items.push({
    key: 'photo_ready',
    titleEn: 'Applicant Photograph (300 × 300 px)',
    titleBn: 'প্রার্থীর ছবি (৩০০ × ৩০০ পিক্সেল)',
    status: compliantPhoto ? 'Ready' : photos.length > 0 ? 'Needs Review' : 'Missing',
    detailEn: compliantPhoto
      ? `Compliant copy ready (${compliantPhoto.fileName}, ${Math.round(compliantPhoto.fileSize / 1024)} KB).`
      : photos.length > 0
        ? 'Photo uploaded — use Auto-Fit Copy or Crop to prepare 300 × 300 px.'
        : 'No photo uploaded yet under Documents & Photos.',
  });

  // 4. Signature Ready (300x80 standard check)
  const sigs = documents.filter((d) => d.documentType === 'signature');
  const compliantSig = sigs.find((s) => s.width === 300 && s.height === 80);
  items.push({
    key: 'signature_ready',
    titleEn: 'Applicant Signature (300 × 80 px)',
    titleBn: 'প্রার্থীর স্বাক্ষর (৩০০ × ৮০ পিক্সেল)',
    status: compliantSig ? 'Ready' : sigs.length > 0 ? 'Needs Review' : 'Missing',
    detailEn: compliantSig
      ? `Compliant signature ready (${compliantSig.fileName}, ${Math.round(compliantSig.fileSize / 1024)} KB).`
      : sigs.length > 0
        ? 'Signature uploaded — generate 300 × 80 px copy for Teletalk portals.'
        : 'No signature uploaded yet under Documents & Photos.',
  });

  // 5. Supporting Certificates & NID Files
  const certs = documents.filter((d) =>
    ['educational_certificate', 'ssc_cert', 'hsc_cert', 'grad_cert', 'masters_cert', 'nid', 'birth_certificate'].includes(
      d.documentType
    )
  );
  items.push({
    key: 'certificates_ready',
    titleEn: 'NID & Supporting Certificates',
    titleBn: 'জাতীয় পরিচয়পত্র ও শিক্ষাগত সনদ ফাইল',
    status: certs.length > 0 ? 'Ready' : 'Needs Review',
    detailEn:
      certs.length > 0
        ? `${certs.length} encrypted supporting document(s) saved locally.`
        : 'Optional locally stored NID or academic certificate scans not yet attached.',
  });

  // 6. Eligibility summary if a job circular is selected
  let eligibilityReport: FullEligibilityReport | null = null;
  if (job) {
    eligibilityReport = evaluateProfileEligibility(profile, job);
    items.push({
      key: 'eligibility_review',
      titleEn: 'Circular Eligibility Pre-Check',
      titleBn: 'বিজ্ঞপ্তির শর্তাবলি ও যোগ্যতা যাচাই',
      status:
        eligibilityReport.overallStatus === 'ELIGIBLE'
          ? 'Ready'
          : eligibilityReport.overallStatus === 'NOT_ELIGIBLE' || eligibilityReport.overallStatus === 'INSUFFICIENT_PROFILE_DATA'
            ? 'Missing'
            : 'Needs Review',
      detailEn: `Result: ${eligibilityReport.overallStatus} (${eligibilityReport.criteria.length} criterion checks).`,
    });
  }

  // 7-9. User Manual Confirmation Checkboxes (Never checked automatically!)
  items.push({
    key: 'manual_form_review',
    titleEn: 'Application Form Spelling & Data Verified Manually',
    titleBn: 'আবেদন ফর্মের বানান ও তথ্য নিজে যাচাই করেছি',
    status: manual.formFieldsReviewed ? 'Ready' : 'Needs Review',
    detailEn: manual.formFieldsReviewed
      ? 'Marked as reviewed by applicant.'
      : 'Review NID/SSC spelling carefully before submitting on the portal.',
    isManualConfirmation: true,
  });

  items.push({
    key: 'manual_fee_review',
    titleEn: 'Application Fee & Payment Rules Reviewed',
    titleBn: 'আবেদন ফি ও পেমেন্ট নির্দেশিকা দেখা হয়েছে',
    status: manual.feeInfoReviewed ? 'Ready' : 'Needs Review',
    detailEn: job?.applicationFee
      ? `Circular Fee: ${job.applicationFee}`
      : manual.feeInfoReviewed
        ? 'Fee schedule reviewed by applicant.'
        : 'Confirm official fee amount & deadline before paying.',
    isManualConfirmation: true,
  });

  items.push({
    key: 'manual_declaration_review',
    titleEn: 'Legal Declarations & Quota Rules Confirmed by Applicant',
    titleBn: 'চাকরির ঘোষণা (Declaration) ও কোটা শর্ত নিজে পড়েছি',
    status: manual.declarationsReviewed ? 'Ready' : 'Needs Review',
    detailEn: manual.declarationsReviewed
      ? 'Applicant manually confirmed declaration review.'
      : 'JobFill BD never checks legal declarations automatically.',
    isManualConfirmation: true,
  });

  const overallReadyCount = items.filter((i) => i.status === 'Ready').length;
  return {
    overallReadyCount,
    totalChecks: items.length,
    allRequiredReady: overallReadyCount === items.length,
    items,
    eligibilityReport,
  };
}
