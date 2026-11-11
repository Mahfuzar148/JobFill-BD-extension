// JobFill BD - Canonical Profile Schema with Zod Validation
// Implements Part C of Master Engineering Specification:
// Universal dot-notation canonical identifiers with strict separation
// of Permanent Profile Information from Job-Specific Circular Declarations.

import { z } from 'zod';

export type CanonicalDataType = 'string' | 'number' | 'date' | 'enum' | 'boolean' | 'attachment';
export type FieldSource = 'manual' | 'document' | 'confirmed_mapping';

// Metadata wrapper attached to every canonical value
export interface CanonicalMetadata<T = any> {
  canonicalId: string;
  value: T;
  dataType: CanonicalDataType;
  source: FieldSource;
  lastUpdated: string;
  verifiedByUser: boolean;
}

// 1. Zod Schema for Permanent Personal Profile
export const PersonalProfileSchema = z.object({
  fullName: z.object({
    english: z.string().min(1, 'Applicant name in English is required'),
    bangla: z.string().default(''),
  }),
  fatherName: z.object({
    english: z.string().min(1, "Father's name in English is required"),
    bangla: z.string().default(''),
  }),
  motherName: z.object({
    english: z.string().min(1, "Mother's name in English is required"),
    bangla: z.string().default(''),
  }),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'DOB must be in YYYY-MM-DD format'),
  gender: z.enum(['Male', 'Female', 'Other', '']),
  nationality: z.string().default('Bangladeshi'),
  religion: z.enum(['Islam', 'Hinduism', 'Christianity', 'Buddhism', 'Other', '']),
  maritalStatus: z.enum(['Single', 'Married', 'Divorced', 'Widowed', '']),
  spouseName: z.object({
    english: z.string().default(''),
    bangla: z.string().default(''),
  }),
  identities: z.object({
    nationalId: z.string().default(''),
    birthRegistration: z.string().default(''),
    passport: z.string().default(''),
    passportExpiry: z.string().default(''),
  }),
  contact: z.object({
    mobile: z.string().regex(/^(\+8801|01)\d{9}$/, 'Invalid Bangladesh mobile number').or(z.literal('')),
    confirmMobile: z.string().default(''),
    email: z.string().email('Invalid email address').or(z.literal('')),
  }),
  quota: z.string().default(''),
  departmentalStatus: z.string().default('No'),
});

export type PersonalProfile = z.infer<typeof PersonalProfileSchema>;

// 2. Address Schema
export const AddressDetailsSchema = z.object({
  careOf: z.string().default(''),
  village: z.string().default(''),
  road: z.string().default(''),
  house: z.string().default(''),
  flat: z.string().default(''),
  division: z.string().default(''),
  district: z.string().default(''),
  upazila: z.string().default(''),
  postOffice: z.string().default(''),
  postCode: z.string().default(''),
});

export const AddressProfileSchema = z.object({
  present: AddressDetailsSchema,
  permanent: AddressDetailsSchema,
  sameAsPresent: z.boolean().default(false),
});

export type AddressProfile = z.infer<typeof AddressProfileSchema>;

// 3. Education Schema
export const SecondaryEducationSchema = z.object({
  examination: z.string().default(''),
  board: z.string().default(''),
  roll: z.string().default(''),
  registration: z.string().default(''),
  group: z.string().default(''),
  result: z.string().default(''),
  gpa: z.string().default(''),
  passingYear: z.string().default(''),
});

export const HigherEducationSchema = z.object({
  degree: z.string().default(''),
  subject: z.string().default(''),
  institution: z.string().default(''),
  result: z.string().default(''),
  gpa: z.string().default(''),
  passingYear: z.string().default(''),
  courseDuration: z.string().default(''),
});

export const EducationProfileSchema = z.object({
  ssc: SecondaryEducationSchema,
  hsc: SecondaryEducationSchema,
  graduation: HigherEducationSchema.optional(),
  masters: HigherEducationSchema.optional(),
});

export type EducationProfile = z.infer<typeof EducationProfileSchema>;

// 4. Job Experience Schema
export const JobExperienceItemSchema = z.object({
  id: z.string(),
  employedOn: z.string().default(''),
  organization: z.string().default(''),
  designation: z.string().default(''),
  address: z.string().default(''),
  startDate: z.string().default(''),
  endDate: z.string().default(''),
  currentlyWorking: z.boolean().default(false),
  jobDescription: z.string().max(300, 'Max 300 characters allowed').default(''),
});

export type JobExperienceItem = z.infer<typeof JobExperienceItemSchema>;

// 5. Job-Specific Circular Preferences (Separated from Permanent Profile)
export const CircularPreferenceSchema = z.object({
  recruitmentTitle: z.string().default(''),
  postCode: z.string().default(''),
  postName: z.string().default(''),
  department: z.string().default(''),
  examCentre: z.string().default('Dhaka'),
  questionVersion: z.enum(['Bangla', 'English']).default('Bangla'),
  cadrePreference: z.string().default(''),
  nonCadrePreference: z.string().default(''),
  quotaDeclaration: z.string().default(''),
  orgChoice1: z.string().default(''),
  orgChoice2: z.string().default(''),
});

export type CircularPreference = z.infer<typeof CircularPreferenceSchema>;

// 6. Master Canonical Profile State
export interface MasterCanonicalProfile {
  profileId: string;
  profileName: string;
  createdAt: string;
  updatedAt: string;
  personal: PersonalProfile;
  address: AddressProfile;
  education: EducationProfile;
  experiences: JobExperienceItem[];
  circularPreferences: CircularPreference;
}

// Canonical Dot-Notation Identifier Dictionary Resolver
export function resolveCanonicalValue(profile: MasterCanonicalProfile, canonicalId: string): string {
  switch (canonicalId) {
    // Applicant
    case 'applicant.fullName.english':
      return profile.personal.fullName.english;
    case 'applicant.fullName.bangla':
      return profile.personal.fullName.bangla;
    case 'applicant.dateOfBirth':
      return profile.personal.dateOfBirth;
    case 'applicant.gender':
      return profile.personal.gender;
    case 'applicant.nationality':
      return profile.personal.nationality;
    case 'applicant.religion':
      return profile.personal.religion;
    case 'applicant.maritalStatus':
      return profile.personal.maritalStatus;

    // Family
    case 'family.father.name.english':
      return profile.personal.fatherName.english;
    case 'family.father.name.bangla':
      return profile.personal.fatherName.bangla;
    case 'family.mother.name.english':
      return profile.personal.motherName.english;
    case 'family.mother.name.bangla':
      return profile.personal.motherName.bangla;
    case 'family.spouse.name.english':
      return profile.personal.spouseName.english;
    case 'family.spouse.name.bangla':
      return profile.personal.spouseName.bangla;

    // Identity
    case 'identity.nationalId':
    case 'identity.nid':
    case 'applicant.nid':
    case 'identities.nationalId':
      return profile.personal.identities.nationalId;
    case 'identity.birthRegistration':
    case 'identity.birthReg':
      return profile.personal.identities.birthRegistration;
    case 'identity.passport':
      return profile.personal.identities.passport;

    // Contact
    case 'contact.mobile':
      return profile.personal.contact.mobile;
    case 'contact.confirmMobile':
      // Always match primary mobile number rather than using a stale/divergent value
      return profile.personal.contact.mobile;
    case 'contact.email':
      return profile.personal.contact.email;

    // Quota & Departmental
    case 'applicant.quota':
      return profile.personal.quota;
    case 'applicant.departmentalStatus':
      return profile.personal.departmentalStatus;

    // Present Address
    case 'address.present.careOf':
      return profile.address.present.careOf;
    case 'address.present.village':
      return profile.address.present.village || profile.address.present.road || profile.address.present.house;
    case 'address.present.division':
      return profile.address.present.division;
    case 'address.present.district':
      return profile.address.present.district;
    case 'address.present.upazila':
      return profile.address.present.upazila;
    case 'address.present.postOffice':
      return profile.address.present.postOffice;
    case 'address.present.postCode':
      return profile.address.present.postCode;

    // Permanent Address
    case 'address.permanent.careOf':
      return profile.address.permanent.careOf;
    case 'address.permanent.village':
      return profile.address.permanent.village || profile.address.permanent.road || profile.address.permanent.house;
    case 'address.permanent.division':
      return profile.address.permanent.division;
    case 'address.permanent.district':
      return profile.address.permanent.district;
    case 'address.permanent.upazila':
      return profile.address.permanent.upazila;
    case 'address.permanent.postOffice':
      return profile.address.permanent.postOffice;
    case 'address.permanent.postCode':
      return profile.address.permanent.postCode;
    case 'address.sameAsPresent':
      return profile.address.sameAsPresent ? 'true' : 'false';

    // SSC
    case 'education.ssc.examination':
    case 'education.records[SSC].examination':
    case 'education.records[0].examination':
      return profile.education.ssc.examination;
    case 'education.ssc.board':
      return profile.education.ssc.board;
    case 'education.ssc.roll':
      return profile.education.ssc.roll;
    case 'education.ssc.registration':
      return profile.education.ssc.registration;
    case 'education.ssc.group':
      return profile.education.ssc.group;
    case 'education.ssc.result':
      return profile.education.ssc.result;
    case 'education.ssc.gpa':
    case 'education.ssc.cgpa':
      return profile.education.ssc.gpa;
    case 'education.ssc.passingYear':
      return profile.education.ssc.passingYear;

    // HSC
    case 'education.hsc.examination':
    case 'education.records[HSC].examination':
    case 'education.records[1].examination':
      return profile.education.hsc.examination;
    case 'education.hsc.board':
      return profile.education.hsc.board;
    case 'education.hsc.roll':
      return profile.education.hsc.roll;
    case 'education.hsc.registration':
      return profile.education.hsc.registration;
    case 'education.hsc.group':
      return profile.education.hsc.group;
    case 'education.hsc.result':
      return profile.education.hsc.result;
    case 'education.hsc.gpa':
    case 'education.hsc.cgpa':
      return profile.education.hsc.gpa;
    case 'education.hsc.passingYear':
      return profile.education.hsc.passingYear;

    // Graduation
    case 'education.graduation.degree':
    case 'education.graduation.examination':
    case 'education.records[Graduation].examination':
    case 'education.records[2].examination':
      return profile.education.graduation?.degree || '';
    case 'education.graduation.subject':
      return profile.education.graduation?.subject || '';
    case 'education.graduation.institution':
      return profile.education.graduation?.institution || '';
    case 'education.graduation.result':
      return profile.education.graduation?.result || '';
    case 'education.graduation.gpa':
    case 'education.graduation.cgpa':
      return profile.education.graduation?.gpa || '';
    case 'education.graduation.passingYear':
      return profile.education.graduation?.passingYear || '';
    case 'education.graduation.courseDuration':
      return profile.education.graduation?.courseDuration || '';

    // Masters
    case 'education.masters.degree':
    case 'education.masters.examination':
    case 'education.records[Masters].examination':
    case 'education.records[3].examination':
      return profile.education.masters?.degree || '';
    case 'education.masters.subject':
      return profile.education.masters?.subject || '';
    case 'education.masters.institution':
      return profile.education.masters?.institution || '';
    case 'education.masters.result':
      return profile.education.masters?.result || '';
    case 'education.masters.gpa':
    case 'education.masters.cgpa':
      return profile.education.masters?.gpa || '';
    case 'education.masters.passingYear':
      return profile.education.masters?.passingYear || '';

    // Primary Job Experience
    case 'employment.experiences[0].employedOn':
    case 'experience.0.employedOn':
      return profile.experiences[0]?.employedOn || '';
    case 'employment.experiences[0].organization':
    case 'experience.0.organization':
      return profile.experiences[0]?.organization || '';
    case 'employment.experiences[0].designation':
    case 'experience.0.designation':
      return profile.experiences[0]?.designation || '';
    case 'employment.experiences[0].address':
    case 'experience.0.address':
      return profile.experiences[0]?.address || '';
    case 'employment.experiences[0].startDate':
    case 'experience.0.startDate':
      return profile.experiences[0]?.startDate || '';
    case 'employment.experiences[0].endDate':
    case 'experience.0.endDate':
      return profile.experiences[0]?.endDate || '';
    case 'employment.experiences[0].jobDescription':
    case 'experience.0.jobDescription':
    case 'experience.0.responsibilities':
      return profile.experiences[0]?.jobDescription || '';
    case 'employment.experiences[0].currentlyWorking':
    case 'employment.currentlyWorking':
    case 'experience.0.currentlyWorking':
      return profile.experiences[0]?.currentlyWorking ? 'true' : 'false';

    // Circular / Preferences
    case 'circular.examCentre':
    case 'circularPreferences.examCentre':
      return profile.circularPreferences.examCentre;
    case 'circular.questionVersion':
    case 'circularPreferences.questionVersion':
      return profile.circularPreferences.questionVersion;
    case 'circular.orgChoice1':
    case 'circularPreferences.orgChoice1':
      return profile.circularPreferences.orgChoice1;
    case 'circular.orgChoice2':
    case 'circularPreferences.orgChoice2':
      return profile.circularPreferences.orgChoice2;
    case 'circular.cadrePreference':
      return profile.circularPreferences.cadrePreference;
    case 'circular.nonCadrePreference':
      return profile.circularPreferences.nonCadrePreference;

    default:
      return '';
  }
}

export const CANONICAL_DOCUMENT_KEYS = {
  photo: 'profile.documents.photo',
  signature: 'profile.documents.signature',
  nid: 'profile.documents.nid',
  birth_certificate: 'profile.documents.birthCertificate',
  educational_certificate: 'profile.documents.educationalCertificate',
  other: 'profile.documents.other',
} as const;
