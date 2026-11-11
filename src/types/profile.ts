// JobFill BD - Comprehensive Profile Database Types
// Compliant with PetroBangla, Teletalk, BPSC, Ministries, and Bangladesh Government Application Forms

export type Gender = 'Male' | 'Female' | 'Other';
export type MaritalStatus = 'Single' | 'Married' | 'Divorced' | 'Widowed';
export type Religion = 'Islam' | 'Hinduism' | 'Christianity' | 'Buddhism' | 'Other';

export type QuotaCategory =
  | 'General'
  | 'Freedom Fighter'
  | 'Child of Freedom Fighter'
  | 'Grandchild of Freedom Fighter'
  | 'District'
  | 'Women'
  | 'Tribal'
  | 'Disabled'
  | 'Ansar VDP'
  | 'Orphan'
  | 'Non-Quota';

export type DepartmentalStatus =
  | 'No'
  | 'Yes'
  | 'Government Employee'
  | 'Semi-Government Employee'
  | 'Autonomous Body'
  | 'Departmental Candidate';

export type EmploymentType =
  | 'Government'
  | 'Semi-Government'
  | 'Autonomous'
  | 'Private'
  | 'NGO'
  | 'Self-Employed'
  | 'Contractual'
  | 'Unemployed';

export type ResultType =
  | 'GPA (out of 5)'
  | 'CGPA (out of 4)'
  | 'First Division'
  | 'Second Division'
  | 'Third Division'
  | 'First Class'
  | 'Second Class'
  | 'Third Class'
  | 'Passed'
  | 'Appeared';

// --- A. Personal Information ---
export interface PersonalInfo {
  applicantNameEn: string;
  applicantNameBn: string;
  fatherNameEn: string;
  fatherNameBn: string;
  motherNameEn: string;
  motherNameBn: string;
  dob: string; // YYYY-MM-DD
  gender: Gender | '';
  nationality: string;
  religion: Religion | '';
  nid: string;
  birthReg: string;
  passport: string;
  passportExpiry: string;
  maritalStatus: MaritalStatus | '';
  spouseNameEn: string;
  spouseNameBn: string;
  mobile: string;
  confirmMobile: string;
  email: string;
  quota: QuotaCategory | '';
  departmentalStatus: DepartmentalStatus | '';
  employmentStatus: EmploymentType | '';
}

// --- B. Address Information ---
export interface AddressDetails {
  careOf: string;
  village: string;
  road: string;
  house: string;
  flat: string;
  division: string;
  district: string;
  upazila: string;
  postOffice: string;
  postCode: string;
}

export interface AddressInfo {
  present: AddressDetails;
  permanent: AddressDetails;
  sameAsPresent: boolean;
}

// --- C & D. SSC & HSC Qualifications ---
export interface SecondaryEducation {
  examination: string;
  board: string;
  institution: string;
  rollNumber: string;
  registrationNumber: string;
  groupSubject: string;
  resultType: ResultType | '';
  gpa: string;
  gpaScale: string;
  passingYear: string;
}

// --- E & F. Graduation & Masters Qualifications ---
export interface HigherEducation {
  examination: string;
  subjectDegree: string;
  universityInstitute: string;
  college: string;
  studentId: string;
  registrationNumber: string;
  rollNumber: string;
  session: string;
  resultType: ResultType | '';
  gpa: string;
  gpaScale: string;
  passingYear: string;
  courseDuration: string; // e.g. "4 Years"
  appearedStatus: boolean;
  examStartDate: string;
  examEndDate: string;
}

// --- G. Additional Qualifications ---
export interface AdditionalQualification {
  id: string;
  type: 'Diploma' | 'Professional Degree' | 'Training' | 'Computer Skills' | 'Language Skills' | 'Other';
  title: string;
  institution: string;
  duration: string;
  year: string;
  result: string;
  details: string;
}

// --- H. Job Experience ---
export interface JobExperience {
  id: string;
  employedOn: string; // Government, Semi-Govt, Autonomous, Private, NGO etc.
  organization: string;
  designation: string;
  address: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  currentlyWorking: boolean;
  salary: string;
  jobDescription: string;
}

// --- I. Special Information ---
export interface SpecialInfo {
  heightCm: string;
  weightKg: string;
  chestCm: string;
  bloodGroup: string;
  examCentre: string;
  questionVersion: 'Bangla' | 'English' | '';
  cadrePreference: string;
  nonCadrePreference: string;
  postRelatedSubjectCode: string;
  freedomFighterCertNo: string;
  freedomFighterRelation: string;
  disabilityType: string;
  disabilityPercent: string;
  disabilityCertNo: string;
  orgChoice1: string;
  orgChoice2: string;
}

// --- References ---
export interface ReferencePerson {
  id: string;
  name: string;
  designation: string;
  organization: string;
  mobile: string;
  email: string;
  address: string;
  relation: string;
}

// --- J. Document Metadata ---
export type DocumentCategory =
  | 'photo'
  | 'signature'
  | 'nid'
  | 'birth_certificate'
  | 'educational_certificate'
  | 'cv'
  | 'other'
  // Legacy aliases retained for backward compatibility
  | 'ssc_cert'
  | 'hsc_cert'
  | 'grad_cert'
  | 'masters_cert'
  | 'nid_doc';

export interface DocumentMetadata {
  documentId: string;
  documentType: DocumentCategory;
  profileId?: string;
  title?: string;
  fileName: string;
  mimeType: string;
  fileSize: number; // bytes
  width: number;
  height: number;
  createdAt: string;
  isProcessedVariant?: boolean;
  parentDocumentId?: string;
}

export interface DocumentItem {
  id: string;
  type: DocumentCategory;
  title: string;
  fileName: string;
  fileSizeKb: number;
  fileSize?: number; // exact bytes
  mimeType: string;
  dimensions?: { width: number; height: number };
  uploadedAt: string;
  isProcessedVariant?: boolean;
  parentDocumentId?: string;
  dataUrl?: string; // stored encrypted in IndexedDB, never persisted plaintext if encrypted
}

// --- Complete Profile Database Schema ---
export interface UserProfile {
  id: string;
  profileName: string;
  createdAt: string;
  updatedAt: string;
  personal: PersonalInfo;
  address: AddressInfo;
  ssc: SecondaryEducation;
  hsc: SecondaryEducation;
  graduation: HigherEducation;
  masters: HigherEducation;
  hasGraduation: boolean;
  hasMasters: boolean;
  additionalQualifications: AdditionalQualification[];
  jobExperiences: JobExperience[];
  hasJobExperience: boolean;
  special: SpecialInfo;
  references: ReferencePerson[];
  documents: DocumentItem[];
}

// --- Security & Settings Schema ---
export interface SecuritySettings {
  isPasswordProtected: boolean;
  passwordHash?: string;
  salt?: string;
  autoLockMinutes: number; // e.g. 15 mins
  lastUnlockedAt?: number;
  lastBackupAt?: number;
  activeProfileId: string;
}

// Field Matching Result Types
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface FieldMatchResult {
  element: HTMLElement;
  selector: string;
  fieldKey: string;
  fieldLabel: string;
  sectionContext: string;
  proposedValue: string;
  currentValue: string;
  confidence: ConfidenceLevel;
  score: number;
  matchReason: string;
  isApproved: boolean;
  isFilled: boolean;
  requiresConfirmation: boolean;
}

export interface FormScanReport {
  timestamp: string;
  url: string;
  siteAdapter: string;
  totalFieldsFound: number;
  highConfidenceCount: number;
  mediumConfidenceCount: number;
  lowConfidenceCount: number;
  unmatchedCount: number;
  matches: FieldMatchResult[];
  unmatchedElements: Array<{ selector: string; label: string; placeholder: string; name: string }>;
}

// --- Application Autofill History Schema ---
export interface AutofillHistoryRecord {
  id: string;
  timestamp: number;
  url: string;
  domain: string;
  pageTitle: string;
  profileId: string;
  profileName: string;
  totalDetected: number;
  totalFilled: number;
  totalFailed: number;
  totalAmbiguous: number;
  status: 'completed' | 'partial' | 'reverted';
  filledFields?: Array<{
    fieldLabel: string;
    canonicalKey: string;
    value: string;
    confidence: string;
  }>;
}

// --- General Application Settings Schema ---
export interface AppGeneralSettings {
  language: 'bn' | 'en';
  theme: 'light' | 'dark';
  fillMode: 'review_first' | 'instant_fill';
  overwriteProtection: 'warn' | 'never' | 'always';
  minimumConfidenceThreshold: number; // e.g. 65 or 85
  autoLockMinutes: number;
  enableBengaliConversion: boolean;
  enableSoundEffects: boolean;
  highlightFilledFields: boolean;
}

