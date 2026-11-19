// JobFill BD - Canonical Profile Schema with Zod Validation
// Implements Part C of Master Engineering Specification:
// Universal dot-notation canonical identifiers with strict separation
// of Permanent Profile Information from Job-Specific Circular Declarations.

import { z } from 'zod';
import { CustomProfileField, ReferencePerson } from '../../types/profile';

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
  gpaScale: z.string().default('5.0'),
  passingYear: z.string().default(''),
});

export const HigherEducationSchema = z.object({
  degree: z.string().default(''),
  subject: z.string().default(''),
  institution: z.string().default(''),
  result: z.string().default(''),
  gpa: z.string().default(''),
  gpaScale: z.string().default('4.0'),
  passingYear: z.string().default(''),
  courseDuration: z.string().default(''),
});

export const CandidateDegreeItemSchema = z.object({
  id: z.string().default(''),
  level: z.string().default('Bachelor'),
  degreeTitle: z.string().default(''),
  subject: z.string().default(''),
  institution: z.string().default(''),
  result: z.string().default(''),
  gpa: z.string().default(''),
  gpaScale: z.string().default('4.0'),
  passingYear: z.string().default(''),
  courseDuration: z.string().default(''),
});
export type CandidateDegreeItem = z.infer<typeof CandidateDegreeItemSchema>;

export const EducationProfileSchema = z.object({
  ssc: SecondaryEducationSchema,
  hsc: SecondaryEducationSchema,
  graduation: HigherEducationSchema.optional(),
  masters: HigherEducationSchema.optional(),
  degrees: z.array(CandidateDegreeItemSchema).optional(),
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

// 5. Reference Schema
export const ReferencePersonSchema = z.object({
  id: z.string().default(''),
  name: z.string().default(''),
  designation: z.string().default(''),
  organization: z.string().default(''),
  mobile: z.string().default(''),
  email: z.string().default(''),
  address: z.string().default(''),
  relation: z.string().default(''),
});

export type { ReferencePerson };

// 6. Job-Specific Circular Preferences (Separated from Permanent Profile)
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

// 7. Master Canonical Profile State
export interface MasterCanonicalProfile {
  profileId: string;
  profileName: string;
  createdAt: string;
  updatedAt: string;
  personal: PersonalProfile;
  address: AddressProfile;
  education: EducationProfile;
  experiences: JobExperienceItem[];
  references?: ReferencePerson[];
  circularPreferences: CircularPreference;
  customFields?: CustomProfileField[];
  special?: Record<string, string>;
}

// Canonical Dot-Notation Identifier Dictionary Resolver
export function resolveCanonicalValue(profile: MasterCanonicalProfile, canonicalId: string): string {
  // Dynamic repeatable experiences: experiences[N].field or experience.N.field or employment.experiences[N].field or experience1.field
  const expMatch = canonicalId.match(/^(?:employment\.experiences|experiences|experience|exp)([\[\._]?)(\d+)[\]\.]?\.?([a-zA-Z0-9_]+)$/i);
  if (expMatch) {
    const sep = expMatch[1];
    let idx = parseInt(expMatch[2], 10);
    // If there was NO separator (e.g. experience1, exp1) or separator was '_', it's 1-indexed natural field naming
    if (!sep || sep === '_') {
      if (idx > 0) idx = idx - 1;
    }
    const field = expMatch[3].toLowerCase();
    const exp = profile.experiences?.[idx];
    if (exp) {
      switch (field) {
        case 'employedon':
          return exp.employedOn || '';
        case 'organization':
        case 'company':
        case 'employer':
        case 'institute':
          return exp.organization || '';
        case 'designation':
        case 'position':
        case 'title':
        case 'post':
          return exp.designation || '';
        case 'address':
          return exp.address || '';
        case 'startdate':
        case 'joiningdate':
        case 'from':
          return exp.startDate || '';
        case 'enddate':
        case 'endingdate':
        case 'to':
          return exp.endDate || '';
        case 'jobdescription':
        case 'responsibilities':
        case 'description':
          return exp.jobDescription || '';
        case 'currentlyworking':
        case 'current':
          return exp.currentlyWorking ? 'true' : 'false';
        default:
          return (exp as any)[expMatch[3]] || '';
      }
    }
    return '';
  }

  // Dynamic repeatable references: references[N].field or reference.N.field or reference1.field or ref1.field
  const refMatch = canonicalId.match(/^(?:references|reference|ref)([\[\._]?)(\d+)[\]\.]?\.?([a-zA-Z0-9_]+)$/i);
  if (refMatch) {
    const sep = refMatch[1];
    let idx = parseInt(refMatch[2], 10);
    // If there was NO separator (e.g. reference1, ref1) or separator was '_', it's 1-indexed natural field naming
    if (!sep || sep === '_') {
      if (idx > 0) idx = idx - 1;
    }
    const field = refMatch[3].toLowerCase();
    const ref = profile.references?.[idx];
    if (ref) {
      switch (field) {
        case 'name':
        case 'fullname':
        case 'personname':
          return ref.name || '';
        case 'designation':
        case 'title':
        case 'post':
        case 'position':
          return ref.designation || '';
        case 'organization':
        case 'company':
        case 'institute':
        case 'office':
          return ref.organization || '';
        case 'mobile':
        case 'phone':
        case 'contact':
        case 'cell':
          return ref.mobile || '';
        case 'email':
          return ref.email || '';
        case 'address':
          return ref.address || '';
        case 'relation':
        case 'relationship':
          return ref.relation || '';
        default:
          return (ref as any)[refMatch[3]] || '';
      }
    }
    return '';
  }

  switch (canonicalId) {
    // Applicant / Candidate Identity
    case 'candidate.fullName.english':
    case 'candidate.fullName.en':
    case 'applicant.fullName.english':
      return profile.personal.fullName.english;
    case 'candidate.fullName.bangla':
    case 'candidate.fullName.bn':
    case 'applicant.fullName.bangla':
      return profile.personal.fullName.bangla;
    case 'candidate.dateOfBirth':
    case 'applicant.dateOfBirth':
      return profile.personal.dateOfBirth;
    case 'candidate.dateOfBirth.day':
    case 'applicant.dateOfBirth.day':
    case 'applicant.dob.day': {
      const parts = (profile.personal.dateOfBirth || '').split(/[-/.]/);
      const d = parts[0]?.length === 4 ? parts[2] : parts[0];
      return d ? String(parseInt(d, 10)) : '';
    }
    case 'candidate.dateOfBirth.month':
    case 'applicant.dateOfBirth.month':
    case 'applicant.dob.month': {
      const parts = (profile.personal.dateOfBirth || '').split(/[-/.]/);
      const m = parts[1];
      return m ? String(parseInt(m, 10)) : '';
    }
    case 'candidate.dateOfBirth.year':
    case 'applicant.dateOfBirth.year':
    case 'applicant.dob.year': {
      const parts = (profile.personal.dateOfBirth || '').split(/[-/.]/);
      const y = parts[0]?.length === 4 ? parts[0] : parts[2];
      return y || '';
    }
    case 'candidate.gender':
    case 'applicant.gender':
      return profile.personal.gender;
    case 'candidate.nationality':
    case 'applicant.nationality':
      return profile.personal.nationality;
    case 'candidate.religion':
    case 'applicant.religion':
      return profile.personal.religion;
    case 'candidate.maritalStatus':
    case 'applicant.maritalStatus':
      return profile.personal.maritalStatus;

    // Family
    case 'candidate.fatherName.en':
    case 'family.father.name.english':
      return profile.personal.fatherName.english;
    case 'candidate.fatherName.bn':
    case 'family.father.name.bangla':
      return profile.personal.fatherName.bangla;
    case 'candidate.motherName.en':
    case 'family.mother.name.english':
      return profile.personal.motherName.english;
    case 'candidate.motherName.bn':
    case 'family.mother.name.bangla':
      return profile.personal.motherName.bangla;
    case 'candidate.spouseName.en':
    case 'family.spouse.name.english':
      return profile.personal.spouseName.english;
    case 'candidate.spouseName.bn':
    case 'family.spouse.name.bangla':
      return profile.personal.spouseName.bangla;

    // Identity
    case 'candidate.nationalId.number':
    case 'identity.nationalId':
    case 'identity.nid':
    case 'applicant.nid':
    case 'identities.nationalId':
      return profile.personal.identities.nationalId;
    case 'candidate.nationalId.hasNid':
    case 'identity.hasNid':
    case 'applicant.hasNid': {
      const rawNid = profile.personal.identities.nationalId?.trim();
      return rawNid && !['no', 'none', 'n/a', 'না', 'নেই'].includes(rawNid.toLowerCase()) ? 'Yes' : 'No';
    }
    case 'candidate.birthRegistrationNumber':
    case 'identity.birthRegistration':
    case 'identity.birthReg':
      return profile.personal.identities.birthRegistration;
    case 'candidate.passportNumber':
    case 'identity.passport':
      return profile.personal.identities.passport;

    // Contact
    case 'contact.mobile':
    case 'candidate.mobile':
    case 'personal.mobile':
      return profile.personal.contact.mobile;
    case 'contact.alternateMobile':
    case 'contact.confirmMobile':
    case 'candidate.confirmMobile':
    case 'personal.confirmMobile':
      // Always match primary mobile number rather than using a stale/divergent value
      return profile.personal.contact.mobile;
    case 'contact.email':
    case 'candidate.email':
    case 'personal.email':
      return profile.personal.contact.email;
    case 'candidate.additionalContactAddress':
      return profile.personal.contact.email;
    case 'contact.linkedin':
      return (profile.special as any)?.linkedin || '';
    case 'contact.github':
      return (profile.special as any)?.github || '';
    case 'contact.portfolio':
    case 'contact.website':
      return (profile.special as any)?.portfolio || (profile.special as any)?.website || '';
    case 'candidate.bloodGroup':
      return (profile.special as any)?.bloodGroup || '';
    case 'candidate.height':
      return (profile.special as any)?.height || '';
    case 'candidate.weight':
      return (profile.special as any)?.weight || '';
    case 'job.expectedSalary':
      return (profile.special as any)?.expectedSalary || (profile.circularPreferences as any)?.expectedSalary || '';

    // Quota & Departmental
    case 'quota.category':
    case 'applicant.quota':
      return profile.personal.quota;
    case 'quota.freedomFighter.status':
    case 'special.freedomFighterStatus':
    case 'special.freedomFighter':
      return profile.special?.freedomFighterRelation || (profile.personal.quota?.includes('Freedom Fighter') ? profile.personal.quota : '');
    case 'quota.freedomFighter.relationship':
    case 'special.freedomFighterRelation':
      return profile.special?.freedomFighterRelation || (profile.personal.quota?.includes('Child') ? 'Child of Freedom Fighter' : profile.personal.quota?.includes('Grandchild') ? 'Grandchild of Freedom Fighter' : profile.personal.quota?.includes('Freedom Fighter') ? 'Freedom Fighter' : '');
    case 'special.freedomFighterCertNo':
      return profile.special?.freedomFighterCertNo || '';
    case 'quota.ethnicMinority.status':
    case 'special.ethnicMinority':
      return profile.special?.ethnicMinority || (profile.personal.quota?.toLowerCase().includes('tribal') || profile.personal.quota?.toLowerCase().includes('ethnic') ? 'Yes' : '');
    case 'quota.disability.status':
    case 'special.disability':
      return profile.special?.disability || (profile.personal.quota?.toLowerCase().includes('physical') || profile.personal.quota?.toLowerCase().includes('handicapped') || profile.personal.quota?.toLowerCase().includes('disability') ? 'Yes' : '');
    case 'employment.departmentalCandidate':
    case 'employment.currentStatus':
    case 'applicant.departmentalStatus':
      return profile.personal.departmentalStatus;

    // Present Address
    case 'address.present.careOf':
      return profile.address.present.careOf;
    case 'address.present.village':
      return profile.address.present.village || profile.address.present.road || profile.address.present.house;
    case 'address.present.road':
      return profile.address.present.road;
    case 'address.present.house':
      return profile.address.present.house;
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
    case 'address.permanent.road':
      return profile.address.permanent.road;
    case 'address.permanent.house':
      return profile.address.permanent.house;
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
    case 'address.sameAsPresent': {
      if (!profile.address.sameAsPresent) return 'false';
      const p = profile.address.present;
      const perm = profile.address.permanent;
      const clean = (s: string | undefined) => (s || '').trim().toLowerCase();
      const hasExplicitConflict = Boolean(
        (p.district && perm.district && clean(p.district) !== clean(perm.district)) ||
        (p.upazila && perm.upazila && clean(p.upazila) !== clean(perm.upazila)) ||
        (p.village && perm.village && clean(p.village) !== clean(perm.village)) ||
        (p.careOf && perm.careOf && clean(p.careOf) !== clean(perm.careOf)) ||
        (p.road && perm.road && clean(p.road) !== clean(perm.road)) ||
        (p.house && perm.house && clean(p.house) !== clean(perm.house)) ||
        (p.postCode && perm.postCode && clean(p.postCode) !== clean(perm.postCode))
      );
      return !hasExplicitConflict ? 'true' : 'false';
    }

    // SSC
    case 'education.ssc.examination':
    case 'education.records[SSC].examination':
    case 'education.records[0].examination':
      return profile.education.ssc.examination;
    case 'education.ssc.board':
      return profile.education.ssc.board;
    case 'education.ssc.roll':
    case 'education.ssc.rollNumber':
      return profile.education.ssc.roll;
    case 'education.ssc.registration':
    case 'education.ssc.registrationNumber':
      return profile.education.ssc.registration;
    case 'education.ssc.group':
      return profile.education.ssc.group;
    case 'education.ssc.result':
    case 'education.ssc.resultType':
      return profile.education.ssc.result;
    case 'education.ssc.gpa':
    case 'education.ssc.cgpa':
    case 'education.ssc.resultValue':
      return profile.education.ssc.gpa;
    case 'education.ssc.gpaScale':
    case 'education.ssc.scale':
    case 'education.ssc.resultScale':
      return profile.education.ssc.gpaScale || '5.0';
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
    case 'education.hsc.rollNumber':
      return profile.education.hsc.roll;
    case 'education.hsc.registration':
    case 'education.hsc.registrationNumber':
      return profile.education.hsc.registration;
    case 'education.hsc.group':
      return profile.education.hsc.group;
    case 'education.hsc.result':
    case 'education.hsc.resultType':
      return profile.education.hsc.result;
    case 'education.hsc.gpa':
    case 'education.hsc.cgpa':
    case 'education.hsc.resultValue':
      return profile.education.hsc.gpa;
    case 'education.hsc.gpaScale':
    case 'education.hsc.scale':
    case 'education.hsc.resultScale':
      return profile.education.hsc.gpaScale || '5.0';
    case 'education.hsc.passingYear':
      return profile.education.hsc.passingYear;

    // Graduation
    case 'education.graduation.degree':
    case 'education.graduation.degreeType':
    case 'education.graduation.examination':
    case 'education.records[Graduation].examination':
    case 'education.records[2].examination':
      return profile.education.graduation?.degree || '';
    case 'education.graduation.subject':
      return profile.education.graduation?.subject || '';
    case 'education.graduation.institution':
    case 'education.graduation.university':
      return profile.education.graduation?.institution || '';
    case 'education.graduation.result':
    case 'education.graduation.resultType':
      return profile.education.graduation?.result || '';
    case 'education.graduation.gpa':
    case 'education.graduation.cgpa':
    case 'education.graduation.resultValue':
      return profile.education.graduation?.gpa || '';
    case 'education.graduation.gpaScale':
    case 'education.graduation.scale':
    case 'education.graduation.resultScale':
      return profile.education.graduation?.gpaScale || '4.0';
    case 'education.graduation.passingYear':
      return profile.education.graduation?.passingYear || '';
    case 'education.graduation.courseDuration':
      return profile.education.graduation?.courseDuration || '';

    // Masters
    case 'education.masters.degree':
    case 'education.masters.degreeType':
    case 'education.masters.examination':
    case 'education.records[Masters].examination':
    case 'education.records[3].examination':
      return profile.education.masters?.degree || '';
    case 'education.masters.subject':
      return profile.education.masters?.subject || '';
    case 'education.masters.institution':
    case 'education.masters.university':
      return profile.education.masters?.institution || '';
    case 'education.masters.result':
    case 'education.masters.resultType':
      return profile.education.masters?.result || '';
    case 'education.masters.gpa':
    case 'education.masters.cgpa':
    case 'education.masters.resultValue':
      return profile.education.masters?.gpa || '';
    case 'education.masters.gpaScale':
    case 'education.masters.scale':
    case 'education.masters.resultScale':
      return profile.education.masters?.gpaScale || '4.0';
    case 'education.masters.passingYear':
      return profile.education.masters?.passingYear || '';
    case 'education.masters.courseDuration':
      return profile.education.masters?.courseDuration || '';

    // Primary Job Experience
    case 'employment.experiences[0].employedOn':
    case 'experience.0.employedOn':
    case 'experience.employedOn':
      return profile.experiences[0]?.employedOn || '';
    case 'employment.experiences[0].organization':
    case 'experience.0.organization':
    case 'experience.organization':
      return profile.experiences[0]?.organization || '';
    case 'employment.experiences[0].designation':
    case 'experience.0.designation':
    case 'experience.designation':
      return profile.experiences[0]?.designation || '';
    case 'employment.experiences[0].address':
    case 'experience.0.address':
    case 'experience.address':
      return profile.experiences[0]?.address || '';
    case 'employment.experiences[0].startDate':
    case 'experience.0.startDate':
    case 'experience.startDate':
      return profile.experiences[0]?.startDate || '';
    case 'employment.experiences[0].endDate':
    case 'experience.0.endDate':
    case 'experience.endDate':
      return profile.experiences[0]?.endDate || '';
    case 'employment.experiences[0].jobDescription':
    case 'experience.0.jobDescription':
    case 'experience.jobDescription':
    case 'experience.0.responsibilities':
      return profile.experiences[0]?.jobDescription || '';
    case 'employment.experiences[0].currentlyWorking':
    case 'employment.currentlyWorking':
    case 'experience.0.currentlyWorking':
    case 'experience.currentlyWorking':
      return profile.experiences[0]?.currentlyWorking ? 'true' : 'false';

    // Circular / Preferences
    case 'preference.examCentre':
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
      if (canonicalId.startsWith('custom_') || canonicalId.startsWith('custom.')) {
        const cleanKey = canonicalId.replace(/^custom\./, 'custom_');
        const cf = profile.customFields?.find(
          (f) => f.fieldKey === canonicalId || f.fieldKey === cleanKey
        );
        if (cf) return cf.value;
      }
      if (canonicalId.startsWith('special.') && profile.special) {
        const specKey = canonicalId.replace('special.', '');
        if (profile.special[specKey] !== undefined) {
          return profile.special[specKey];
        }
      }
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
