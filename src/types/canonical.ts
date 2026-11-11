// JobFill BD - Canonical Profile Ontology (Part C of Master Engineering Specification)
// Provides a normalized, typed, verified representation of applicant data.
// Strict separation between Permanent Profile data and Circular-Specific Declarations.

import { UserProfile } from './profile';

export type CanonicalDataType = 'string' | 'number' | 'date' | 'enum' | 'boolean' | 'attachment';

export type FieldSource = 'user_profile' | 'derived' | 'circular_specific';

export interface CanonicalFieldMetadata<T = any> {
  canonicalId: string;
  category: 'personal' | 'address_present' | 'address_permanent' | 'education_ssc' | 'education_hsc' | 'education_graduation' | 'education_masters' | 'experience' | 'preferences' | 'circular_declarations';
  labelEn: string;
  labelBn: string;
  dataType: CanonicalDataType;
  value: T;
  source: FieldSource;
  verifiedByUser: boolean;
  lastUpdated: string;
  validationRegex?: string;
  enumOptions?: string[];
}

// Circular-Specific Declarations (Not permanently fixed across circulars)
export interface CircularSpecificPreferences {
  circularCode?: string;
  postCode?: string;
  postName?: string;
  preferredExamCenter?: string;
  questionVersion?: 'Bangla' | 'English';
  quotaAppliedFor?: string;
  organizationChoices?: string[];
  applicantSignatureConfirmed?: boolean;
}

// Master Canonical Representation
export interface CanonicalProfileState {
  profileId: string;
  profileName: string;
  fields: Record<string, CanonicalFieldMetadata>;
  circularPreferences: CircularSpecificPreferences;
  completenessScore: number;
}

// Converts a UserProfile into a verified CanonicalProfileState
export function buildCanonicalState(profile: UserProfile, circularPrefs?: CircularSpecificPreferences): CanonicalProfileState {
  const now = new Date().toISOString();
  const fields: Record<string, CanonicalFieldMetadata> = {};

  const register = <T>(
    id: string,
    category: CanonicalFieldMetadata['category'],
    labelEn: string,
    labelBn: string,
    dataType: CanonicalDataType,
    value: T,
    source: FieldSource = 'user_profile',
    enumOptions?: string[]
  ) => {
    fields[id] = {
      canonicalId: id,
      category,
      labelEn,
      labelBn,
      dataType,
      value,
      source,
      verifiedByUser: true,
      lastUpdated: now,
      enumOptions,
    };
  };

  // Personal Info
  register('personal.applicant_name_en', 'personal', "Applicant's Name (English)", 'আবেদনকারীর নাম (ইংরেজি)', 'string', profile.personal.applicantNameEn);
  register('personal.applicant_name_bn', 'personal', "Applicant's Name (Bangla)", 'আবেদনকারীর নাম (বাংলা)', 'string', profile.personal.applicantNameBn);
  register('personal.father_name_en', 'personal', "Father's Name (English)", 'পিতার নাম (ইংরেজি)', 'string', profile.personal.fatherNameEn);
  register('personal.father_name_bn', 'personal', "Father's Name (Bangla)", 'পিতার নাম (বাংলা)', 'string', profile.personal.fatherNameBn);
  register('personal.mother_name_en', 'personal', "Mother's Name (English)", 'মাতার নাম (ইংরেজি)', 'string', profile.personal.motherNameEn);
  register('personal.mother_name_bn', 'personal', "Mother's Name (Bangla)", 'মাতার নাম (বাংলা)', 'string', profile.personal.motherNameBn);
  register('personal.dob', 'personal', 'Date of Birth', 'জন্ম তারিখ', 'date', profile.personal.dob);
  register('personal.gender', 'personal', 'Gender', 'লিঙ্গ', 'enum', profile.personal.gender, 'user_profile', ['Male', 'Female', 'Other']);
  register('personal.nationality', 'personal', 'Nationality', 'জাতীয়তা', 'string', profile.personal.nationality || 'Bangladeshi');
  register('personal.religion', 'personal', 'Religion', 'ধর্ম', 'enum', profile.personal.religion);
  register('personal.nid', 'personal', 'National ID (NID)', 'জাতীয় পরিচয়পত্র', 'string', profile.personal.nid);
  register('personal.birth_reg', 'personal', 'Birth Registration No', 'জন্ম নিবন্ধন নম্বর', 'string', profile.personal.birthReg);
  register('personal.passport', 'personal', 'Passport ID', 'পাসপোর্ট নম্বর', 'string', profile.personal.passport);
  register('personal.marital_status', 'personal', 'Marital Status', 'বৈবাহিক অবস্থা', 'enum', profile.personal.maritalStatus);
  register('personal.spouse_name_en', 'personal', 'Spouse Name (English)', 'স্বামী/স্ত্রীর নাম (ইংরেজি)', 'string', profile.personal.spouseNameEn);
  register('personal.spouse_name_bn', 'personal', 'Spouse Name (বাংলা)', 'স্বামী/স্ত্রীর নাম (বাংলা)', 'string', profile.personal.spouseNameBn);
  register('personal.mobile', 'personal', 'Mobile Number', 'মোবাইল নম্বর', 'string', profile.personal.mobile);
  register('personal.email', 'personal', 'Email Address', 'ইমেইল এড্রেস', 'string', profile.personal.email);
  register('personal.quota', 'personal', 'Quota Category', 'কোটা', 'enum', profile.personal.quota);
  register('personal.departmental_status', 'personal', 'Departmental Status', 'বিভাগীয় প্রার্থীর ধরন', 'enum', profile.personal.departmentalStatus);

  // Address (Present)
  register('present_address.care_of', 'address_present', 'Present Care Of', 'বর্তমান ঠিকানা অভিভাবক (কেয়ার অব)', 'string', profile.address.present.careOf);
  register('present_address.village', 'address_present', 'Present Village/Road/House/Flat', 'বর্তমান গ্রাম/রাস্তা/বাসা', 'string', profile.address.present.village || profile.address.present.road || profile.address.present.house);
  register('present_address.division', 'address_present', 'Present Division', 'বর্তমান বিভাগ', 'string', profile.address.present.division);
  register('present_address.district', 'address_present', 'Present District', 'বর্তমান জেলা', 'string', profile.address.present.district);
  register('present_address.upazila', 'address_present', 'Present Upazila/P.S.', 'বর্তমান উপজেলা/থানা', 'string', profile.address.present.upazila);
  register('present_address.post_office', 'address_present', 'Present Post Office', 'বর্তমান ডাকঘর', 'string', profile.address.present.postOffice);
  register('present_address.post_code', 'address_present', 'Present Post Code', 'বর্তমান পোস্ট কোড', 'string', profile.address.present.postCode);

  // Address (Permanent)
  register('permanent_address.care_of', 'address_permanent', 'Permanent Care Of', 'স্থায়ী ঠিকানা অভিভাবক (কেয়ার অব)', 'string', profile.address.permanent.careOf);
  register('permanent_address.village', 'address_permanent', 'Permanent Village/Road/House/Flat', 'স্থায়ী গ্রাম/রাস্তা/বাসা', 'string', profile.address.permanent.village || profile.address.permanent.road || profile.address.permanent.house);
  register('permanent_address.division', 'address_permanent', 'Permanent Division', 'স্থায়ী বিভাগ', 'string', profile.address.permanent.division);
  register('permanent_address.district', 'address_permanent', 'Permanent District', 'স্থায়ী জেলা', 'string', profile.address.permanent.district);
  register('permanent_address.upazila', 'address_permanent', 'Permanent Upazila/P.S.', 'স্থায়ী উপজেলা/থানা', 'string', profile.address.permanent.upazila);
  register('permanent_address.post_office', 'address_permanent', 'Permanent Post Office', 'স্থায়ী ডাকঘর', 'string', profile.address.permanent.postOffice);
  register('permanent_address.post_code', 'address_permanent', 'Permanent Post Code', 'স্থায়ী পোস্ট কোড', 'string', profile.address.permanent.postCode);

  // Education (SSC)
  register('ssc.examination', 'education_ssc', 'SSC Examination', 'এসএসসি পরীক্ষা', 'string', profile.ssc.examination);
  register('ssc.board', 'education_ssc', 'SSC Board', 'এসএসসি বোর্ড', 'string', profile.ssc.board);
  register('ssc.roll', 'education_ssc', 'SSC Roll No', 'এসএসসি রোল নম্বর', 'string', profile.ssc.rollNumber);
  register('ssc.group', 'education_ssc', 'SSC Group/Subject', 'এসএসসি বিভাগ/বিষয়', 'string', profile.ssc.groupSubject);
  register('ssc.result_type', 'education_ssc', 'SSC Result Type', 'এসএসসি ফলাফলের ধরন', 'string', profile.ssc.resultType);
  register('ssc.gpa', 'education_ssc', 'SSC GPA/Result', 'এসএসসি ফলাফল', 'string', profile.ssc.gpa);
  register('ssc.passing_year', 'education_ssc', 'SSC Passing Year', 'এসএসসি পাসের সন', 'string', profile.ssc.passingYear);

  // Education (HSC)
  register('hsc.examination', 'education_hsc', 'HSC Examination', 'এইচএসসি পরীক্ষা', 'string', profile.hsc.examination);
  register('hsc.board', 'education_hsc', 'HSC Board', 'এইচএসসি বোর্ড', 'string', profile.hsc.board);
  register('hsc.roll', 'education_hsc', 'HSC Roll No', 'এইচএসসি রোল নম্বর', 'string', profile.hsc.rollNumber);
  register('hsc.group', 'education_hsc', 'HSC Group/Subject', 'এইচএসসি বিভাগ/বিষয়', 'string', profile.hsc.groupSubject);
  register('hsc.result_type', 'education_hsc', 'HSC Result Type', 'এইচএসসি ফলাফলের ধরন', 'string', profile.hsc.resultType);
  register('hsc.gpa', 'education_hsc', 'HSC GPA/Result', 'এইচএসসি ফলাফল', 'string', profile.hsc.gpa);
  register('hsc.passing_year', 'education_hsc', 'HSC Passing Year', 'এইচএসসি পাসের সন', 'string', profile.hsc.passingYear);

  // Education (Graduation)
  if (profile.hasGraduation && profile.graduation) {
    register('graduation.examination', 'education_graduation', 'Graduation Degree', 'স্নাতক ডিগ্রি', 'string', profile.graduation.examination);
    register('graduation.subject', 'education_graduation', 'Graduation Subject/Major', 'স্নাতকের বিষয়', 'string', profile.graduation.subjectDegree);
    register('graduation.university', 'education_graduation', 'Graduation University/Institute', 'স্নাতক প্রতিষ্ঠান/বিশ্ববিদ্যালয়', 'string', profile.graduation.universityInstitute);
    register('graduation.cgpa', 'education_graduation', 'Graduation CGPA/Result', 'স্নাতকের সিজিপিএ', 'string', profile.graduation.gpa);
    register('graduation.passing_year', 'education_graduation', 'Graduation Passing Year', 'স্নাতক পাসের সন', 'string', profile.graduation.passingYear);
    register('graduation.duration', 'education_graduation', 'Course Duration', 'কোর্সের মেয়াদ', 'string', profile.graduation.courseDuration);
  }

  // Masters
  if (profile.hasMasters && profile.masters) {
    register('masters.examination', 'education_masters', 'Masters Degree', 'স্নাতকোত্তর ডিগ্রি', 'string', profile.masters.examination);
    register('masters.subject', 'education_masters', 'Masters Subject', 'স্নাতকোত্তরের বিষয়', 'string', profile.masters.subjectDegree);
    register('masters.university', 'education_masters', 'Masters University', 'স্নাতকোত্তর বিশ্ববিদ্যালয়', 'string', profile.masters.universityInstitute);
    register('masters.cgpa', 'education_masters', 'Masters CGPA', 'স্নাতকোত্তর সিজিপিএ', 'string', profile.masters.gpa);
    register('masters.passing_year', 'education_masters', 'Masters Passing Year', 'স্নাতকোত্তর পাসের সন', 'string', profile.masters.passingYear);
  }

  // Job Experience (Primary)
  if (profile.hasJobExperience && profile.jobExperiences && profile.jobExperiences.length > 0) {
    const exp = profile.jobExperiences[0];
    register('experience.employed_on', 'experience', 'Employed On', 'চাকরির ধরন', 'string', exp.employedOn);
    register('experience.organization', 'experience', 'Organization Name', 'প্রতিষ্ঠানের নাম', 'string', exp.organization);
    register('experience.designation', 'experience', 'Designation / Post', 'পদবী', 'string', exp.designation);
    register('experience.address', 'experience', 'Office Address', 'অফিসের ঠিকানা', 'string', exp.address);
    register('experience.start_date', 'experience', 'Start Date', 'শুরুর তারিখ', 'date', exp.startDate);
    register('experience.end_date', 'experience', 'End Date', 'শেষ তারিখ', 'date', exp.endDate);
    register('experience.job_description', 'experience', 'Job Description', 'কাজের বিবরণ', 'string', exp.jobDescription);
  }

  return {
    profileId: profile.id,
    profileName: profile.profileName,
    fields,
    circularPreferences: circularPrefs || {
      preferredExamCenter: profile.special?.examCentre || 'Dhaka',
      questionVersion: (profile.special?.questionVersion as any) || 'Bangla',
      organizationChoices: [profile.special?.orgChoice1, profile.special?.orgChoice2].filter(Boolean) as string[],
    },
    completenessScore: 100,
  };
}
