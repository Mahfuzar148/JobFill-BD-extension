// JobFill BD - Smart Profile Diff Engine, Update Manager & Undo Service
// Detects meaningful differences between user inputs on job application forms and saved profile data.
// Security Invariants:
// - Never auto-overwrites profile without explicit user review and approval.
// - Password fields never enter profile or change history.
// - Captures only on supported job application forms; ignores CAPTCHA, OTP, hidden, submit, and tokens.
// - Normalizes Bengali/English numerals, whitespace, and phone formats.
// - Provides reversible Undo history for user-approved changes.

import { UserProfile } from '../types/profile';
import { ValueNormalizer } from '../intelligence/value-normalizer';
import { toCanonicalProfile } from '../content/page-scanner';
import { resolveCanonicalValue } from '../shared/types/canonical-schema';
import { applyCanonicalProfileFieldUpdate, saveActiveProfile, getActiveProfile } from './storage';

export type ProfileDestination = 'personal' | 'address' | 'education' | 'experience' | 'tracker' | 'vault';

export interface DetectedProfileDiffItem {
  id: string;
  canonicalKey: string;
  fieldLabel: string;
  fieldLabelBn: string;
  destination: ProfileDestination;
  destinationLabel: string;
  destinationLabelBn: string;
  oldValue: string;
  newValue: string;
  diffType: 'NEW' | 'CHANGED';
  selected: boolean;
  sectionContext?: string;
}

export interface ProfileChangeHistoryRecord {
  id: string;
  fieldKey: string;
  fieldLabelEn: string;
  fieldLabelBn: string;
  previousValue: string;
  newValue: string;
  sourceOrigin: string;
  destination: ProfileDestination;
  updatedAt: number;
  userApproved: boolean;
  reverted?: boolean;
}

const HISTORY_STORAGE_KEY = 'jobfill_profile_change_history_v1';

export const FIELD_METADATA_MAP: Record<
  string,
  {
    destination: ProfileDestination;
    labelEn: string;
    labelBn: string;
    categoryEn: string;
    categoryBn: string;
  }
> = {
  // Personal
  'applicant.fullName.english': {
    destination: 'personal',
    labelEn: 'Full Name (English)',
    labelBn: 'পূর্ণ নাম (ইংরেজি)',
    categoryEn: 'Personal Profile',
    categoryBn: 'ব্যক্তিগত তথ্য',
  },
  'applicant.fullName.bangla': {
    destination: 'personal',
    labelEn: 'Full Name (Bangla)',
    labelBn: 'পূর্ণ নাম (বাংলা)',
    categoryEn: 'Personal Profile',
    categoryBn: 'ব্যক্তিগত তথ্য',
  },
  'family.father.name.english': {
    destination: 'personal',
    labelEn: "Father's Name (English)",
    labelBn: 'পিতার নাম (ইংরেজি)',
    categoryEn: 'Personal Profile',
    categoryBn: 'ব্যক্তিগত তথ্য',
  },
  'family.father.name.bangla': {
    destination: 'personal',
    labelEn: "Father's Name (Bangla)",
    labelBn: 'পিতার নাম (বাংলা)',
    categoryEn: 'Personal Profile',
    categoryBn: 'ব্যক্তিগত তথ্য',
  },
  'family.mother.name.english': {
    destination: 'personal',
    labelEn: "Mother's Name (English)",
    labelBn: 'মাতার নাম (ইংরেজি)',
    categoryEn: 'Personal Profile',
    categoryBn: 'ব্যক্তিগত তথ্য',
  },
  'family.mother.name.bangla': {
    destination: 'personal',
    labelEn: "Mother's Name (Bangla)",
    labelBn: 'মাতার নাম (বাংলা)',
    categoryEn: 'Personal Profile',
    categoryBn: 'ব্যক্তিগত তথ্য',
  },
  'applicant.dateOfBirth': {
    destination: 'personal',
    labelEn: 'Date of Birth',
    labelBn: 'জন্ম তারিখ',
    categoryEn: 'Personal Profile',
    categoryBn: 'ব্যক্তিগত তথ্য',
  },
  'applicant.gender': {
    destination: 'personal',
    labelEn: 'Gender',
    labelBn: 'লিঙ্গ',
    categoryEn: 'Personal Profile',
    categoryBn: 'ব্যক্তিগত তথ্য',
  },
  'applicant.religion': {
    destination: 'personal',
    labelEn: 'Religion',
    labelBn: 'ধর্ম',
    categoryEn: 'Personal Profile',
    categoryBn: 'ব্যক্তিগত তথ্য',
  },
  'applicant.maritalStatus': {
    destination: 'personal',
    labelEn: 'Marital Status',
    labelBn: 'বৈবাহিক অবস্থা',
    categoryEn: 'Personal Profile',
    categoryBn: 'ব্যক্তিগত তথ্য',
  },
  'contact.mobile': {
    destination: 'personal',
    labelEn: 'Mobile Number',
    labelBn: 'মোবাইল নম্বর',
    categoryEn: 'Personal Profile',
    categoryBn: 'ব্যক্তিগত তথ্য',
  },
  'contact.confirmMobile': {
    destination: 'personal',
    labelEn: 'Confirm Mobile',
    labelBn: 'মোবাইল নম্বর নিশ্চিতকরণ',
    categoryEn: 'Personal Profile',
    categoryBn: 'ব্যক্তিগত তথ্য',
  },
  'contact.email': {
    destination: 'personal',
    labelEn: 'Email Address',
    labelBn: 'ইমেইল ঠিকানা',
    categoryEn: 'Personal Profile',
    categoryBn: 'ব্যক্তিগত তথ্য',
  },
  'identity.nationalId': {
    destination: 'personal',
    labelEn: 'National ID (NID)',
    labelBn: 'জাতীয় পরিচয়পত্র (NID)',
    categoryEn: 'Personal Profile',
    categoryBn: 'ব্যক্তিগত তথ্য',
  },
  'identity.nid': {
    destination: 'personal',
    labelEn: 'National ID (NID)',
    labelBn: 'জাতীয় পরিচয়পত্র (NID)',
    categoryEn: 'Personal Profile',
    categoryBn: 'ব্যক্তিগত তথ্য',
  },
  'identities.nationalId': {
    destination: 'personal',
    labelEn: 'National ID (NID)',
    labelBn: 'জাতীয় পরিচয়পত্র (NID)',
    categoryEn: 'Personal Profile',
    categoryBn: 'ব্যক্তিগত তথ্য',
  },
  'identity.birthRegistration': {
    destination: 'personal',
    labelEn: 'Birth Registration No (BRN)',
    labelBn: 'জন্ম নিবন্ধন নম্বর',
    categoryEn: 'Personal Profile',
    categoryBn: 'ব্যক্তিগত তথ্য',
  },
  'identity.birthReg': {
    destination: 'personal',
    labelEn: 'Birth Registration No (BRN)',
    labelBn: 'জন্ম নিবন্ধন নম্বর',
    categoryEn: 'Personal Profile',
    categoryBn: 'ব্যক্তিগত তথ্য',
  },
  'identity.passport': {
    destination: 'personal',
    labelEn: 'Passport Number',
    labelBn: 'পাসপোর্ট নম্বর',
    categoryEn: 'Personal Profile',
    categoryBn: 'ব্যক্তিগত তথ্য',
  },
  'applicant.quota': {
    destination: 'personal',
    labelEn: 'Quota Category',
    labelBn: 'কোটা সুবিধা',
    categoryEn: 'Personal Profile',
    categoryBn: 'ব্যক্তিগত তথ্য',
  },

  // Address
  'address.present.careOf': {
    destination: 'address',
    labelEn: 'Present Address: Care Of',
    labelBn: 'বর্তমান ঠিকানা: অভিভাবকের নাম',
    categoryEn: 'Address Profile',
    categoryBn: 'ঠিকানা',
  },
  'address.present.village': {
    destination: 'address',
    labelEn: 'Present Address: Village/Road',
    labelBn: 'বর্তমান ঠিকানা: গ্রাম/মহল্লা',
    categoryEn: 'Address Profile',
    categoryBn: 'ঠিকানা',
  },
  'address.present.district': {
    destination: 'address',
    labelEn: 'Present District',
    labelBn: 'বর্তমান জেলা',
    categoryEn: 'Address Profile',
    categoryBn: 'ঠিকানা',
  },
  'address.present.upazila': {
    destination: 'address',
    labelEn: 'Present Upazila/Thana',
    labelBn: 'বর্তমান উপজেলা/থানা',
    categoryEn: 'Address Profile',
    categoryBn: 'ঠিকানা',
  },
  'address.present.postOffice': {
    destination: 'address',
    labelEn: 'Present Post Office',
    labelBn: 'বর্তমান ডাকঘর',
    categoryEn: 'Address Profile',
    categoryBn: 'ঠিকানা',
  },
  'address.present.postCode': {
    destination: 'address',
    labelEn: 'Present Post Code',
    labelBn: 'বর্তমান পোস্ট কোড',
    categoryEn: 'Address Profile',
    categoryBn: 'ঠিকানা',
  },
  'address.permanent.careOf': {
    destination: 'address',
    labelEn: 'Permanent Address: Care Of',
    labelBn: 'স্থায়ী ঠিকানা: অভিভাবকের নাম',
    categoryEn: 'Address Profile',
    categoryBn: 'ঠিকানা',
  },
  'address.permanent.village': {
    destination: 'address',
    labelEn: 'Permanent Address: Village/Road',
    labelBn: 'স্থায়ী ঠিকানা: গ্রাম/মহল্লা',
    categoryEn: 'Address Profile',
    categoryBn: 'ঠিকানা',
  },
  'address.permanent.district': {
    destination: 'address',
    labelEn: 'Permanent District',
    labelBn: 'স্থায়ী জেলা',
    categoryEn: 'Address Profile',
    categoryBn: 'ঠিকানা',
  },
  'address.permanent.upazila': {
    destination: 'address',
    labelEn: 'Permanent Upazila/Thana',
    labelBn: 'স্থায়ী উপজেলা/থানা',
    categoryEn: 'Address Profile',
    categoryBn: 'ঠিকানা',
  },
  'address.permanent.postOffice': {
    destination: 'address',
    labelEn: 'Permanent Post Office',
    labelBn: 'স্থায়ী ডাকঘর',
    categoryEn: 'Address Profile',
    categoryBn: 'ঠিকানা',
  },
  'address.permanent.postCode': {
    destination: 'address',
    labelEn: 'Permanent Post Code',
    labelBn: 'স্থায়ী পোস্ট কোড',
    categoryEn: 'Address Profile',
    categoryBn: 'ঠিকানা',
  },

  // Education SSC
  'education.ssc.examination': {
    destination: 'education',
    labelEn: 'SSC Examination',
    labelBn: 'এসএসসি পরীক্ষার নাম',
    categoryEn: 'Education Records',
    categoryBn: 'শিক্ষাগত যোগ্যতা',
  },
  'education.ssc.board': {
    destination: 'education',
    labelEn: 'SSC Board',
    labelBn: 'এসএসসি শিক্ষাবোর্ড',
    categoryEn: 'Education Records',
    categoryBn: 'শিক্ষাগত যোগ্যতা',
  },
  'education.ssc.roll': {
    destination: 'education',
    labelEn: 'SSC Roll Number',
    labelBn: 'এসএসসি রোল নম্বর',
    categoryEn: 'Education Records',
    categoryBn: 'শিক্ষাগত যোগ্যতা',
  },
  'education.ssc.group': {
    destination: 'education',
    labelEn: 'SSC Group / Major',
    labelBn: 'এসএসসি বিভাগ/শাখা',
    categoryEn: 'Education Records',
    categoryBn: 'শিক্ষাগত যোগ্যতা',
  },
  'education.ssc.gpa': {
    destination: 'education',
    labelEn: 'SSC GPA / Result',
    labelBn: 'এসএসসি জিপিএ / ফলাফল',
    categoryEn: 'Education Records',
    categoryBn: 'শিক্ষাগত যোগ্যতা',
  },
  'education.ssc.passingYear': {
    destination: 'education',
    labelEn: 'SSC Passing Year',
    labelBn: 'এসএসসি পাসের সন',
    categoryEn: 'Education Records',
    categoryBn: 'শিক্ষাগত যোগ্যতা',
  },

  // Education HSC
  'education.hsc.examination': {
    destination: 'education',
    labelEn: 'HSC Examination',
    labelBn: 'এইচএসসি পরীক্ষার নাম',
    categoryEn: 'Education Records',
    categoryBn: 'শিক্ষাগত যোগ্যতা',
  },
  'education.hsc.board': {
    destination: 'education',
    labelEn: 'HSC Board',
    labelBn: 'এইচএসসি শিক্ষাবোর্ড',
    categoryEn: 'Education Records',
    categoryBn: 'শিক্ষাগত যোগ্যতা',
  },
  'education.hsc.roll': {
    destination: 'education',
    labelEn: 'HSC Roll Number',
    labelBn: 'এইচএসসি রোল নম্বর',
    categoryEn: 'Education Records',
    categoryBn: 'শিক্ষাগত যোগ্যতা',
  },
  'education.hsc.group': {
    destination: 'education',
    labelEn: 'HSC Group / Major',
    labelBn: 'এইচএসসি বিভাগ/শাখা',
    categoryEn: 'Education Records',
    categoryBn: 'শিক্ষাগত যোগ্যতা',
  },
  'education.hsc.gpa': {
    destination: 'education',
    labelEn: 'HSC GPA / Result',
    labelBn: 'এইচএসসি জিপিএ / ফলাফল',
    categoryEn: 'Education Records',
    categoryBn: 'শিক্ষাগত যোগ্যতা',
  },
  'education.hsc.passingYear': {
    destination: 'education',
    labelEn: 'HSC Passing Year',
    labelBn: 'এইচএসসি পাসের সন',
    categoryEn: 'Education Records',
    categoryBn: 'শিক্ষাগত যোগ্যতা',
  },

  // Education Graduation
  'education.graduation.degree': {
    destination: 'education',
    labelEn: 'Graduation Degree',
    labelBn: 'স্নাতক ডিগ্রির নাম',
    categoryEn: 'Education Records',
    categoryBn: 'শিক্ষাগত যোগ্যতা',
  },
  'education.graduation.examination': {
    destination: 'education',
    labelEn: 'Graduation Degree',
    labelBn: 'স্নাতক ডিগ্রির নাম',
    categoryEn: 'Education Records',
    categoryBn: 'শিক্ষাগত যোগ্যতা',
  },
  'education.graduation.subject': {
    destination: 'education',
    labelEn: 'Graduation Subject / Discipline',
    labelBn: 'স্নাতক বিষয়',
    categoryEn: 'Education Records',
    categoryBn: 'শিক্ষাগত যোগ্যতা',
  },
  'education.graduation.institution': {
    destination: 'education',
    labelEn: 'Graduation University / Institute',
    labelBn: 'স্নাতক বিশ্ববিদ্যালয়/ইনস্টিটিউট',
    categoryEn: 'Education Records',
    categoryBn: 'শিক্ষাগত যোগ্যতা',
  },
  'education.graduation.gpa': {
    destination: 'education',
    labelEn: 'Graduation CGPA / Class',
    labelBn: 'স্নাতক সিজিপিএ / ফলাফল',
    categoryEn: 'Education Records',
    categoryBn: 'শিক্ষাগত যোগ্যতা',
  },
  'education.graduation.cgpa': {
    destination: 'education',
    labelEn: 'Graduation CGPA / Class',
    labelBn: 'স্নাতক সিজিপিএ / ফলাফল',
    categoryEn: 'Education Records',
    categoryBn: 'শিক্ষাগত যোগ্যতা',
  },
  'education.graduation.passingYear': {
    destination: 'education',
    labelEn: 'Graduation Passing Year',
    labelBn: 'স্নাতক পাসের সন',
    categoryEn: 'Education Records',
    categoryBn: 'শিক্ষাগত যোগ্যতা',
  },

  // Education Masters
  'education.masters.degree': {
    destination: 'education',
    labelEn: 'Masters Degree',
    labelBn: 'মাস্টার্স ডিগ্রির নাম',
    categoryEn: 'Education Records',
    categoryBn: 'শিক্ষাগত যোগ্যতা',
  },
  'education.masters.examination': {
    destination: 'education',
    labelEn: 'Masters Examination',
    labelBn: 'মাস্টার্স পরীক্ষার নাম',
    categoryEn: 'Education Records',
    categoryBn: 'শিক্ষাগত যোগ্যতা',
  },
  'education.masters.subject': {
    destination: 'education',
    labelEn: 'Masters Subject',
    labelBn: 'মাস্টার্স বিষয়',
    categoryEn: 'Education Records',
    categoryBn: 'শিক্ষাগত যোগ্যতা',
  },
  'education.masters.institution': {
    destination: 'education',
    labelEn: 'Masters University / Institute',
    labelBn: 'মাস্টার্স বিশ্ববিদ্যালয়/ইনস্টিটিউট',
    categoryEn: 'Education Records',
    categoryBn: 'শিক্ষাগত যোগ্যতা',
  },
  'education.masters.gpa': {
    destination: 'education',
    labelEn: 'Masters CGPA / Class',
    labelBn: 'মাস্টার্স সিজিপিএ / ফলাফল',
    categoryEn: 'Education Records',
    categoryBn: 'শিক্ষাগত যোগ্যতা',
  },
  'education.masters.cgpa': {
    destination: 'education',
    labelEn: 'Masters CGPA / Class',
    labelBn: 'মাস্টার্স সিজিপিএ / ফলাফল',
    categoryEn: 'Education Records',
    categoryBn: 'শিক্ষাগত যোগ্যতা',
  },
  'education.masters.passingYear': {
    destination: 'education',
    labelEn: 'Masters Passing Year',
    labelBn: 'মাস্টার্স পাসের সন',
    categoryEn: 'Education Records',
    categoryBn: 'শিক্ষাগত যোগ্যতা',
  },

  // Job Experience
  'experience.organization': {
    destination: 'experience',
    labelEn: 'Organization / Company Name',
    labelBn: 'প্রতিষ্ঠানের নাম',
    categoryEn: 'Experience Records',
    categoryBn: 'চাকরির অভিজ্ঞতা',
  },
  'experience.designation': {
    destination: 'experience',
    labelEn: 'Designation / Post Name',
    labelBn: 'পদের নাম',
    categoryEn: 'Experience Records',
    categoryBn: 'চাকরির অভিজ্ঞতা',
  },
  'experience.startDate': {
    destination: 'experience',
    labelEn: 'Experience Start Date',
    labelBn: 'শুরুর তারিখ',
    categoryEn: 'Experience Records',
    categoryBn: 'চাকরির অভিজ্ঞতা',
  },
  'experience.endDate': {
    destination: 'experience',
    labelEn: 'Experience End Date',
    labelBn: 'সমাপ্তির তারিখ',
    categoryEn: 'Experience Records',
    categoryBn: 'চাকরির অভিজ্ঞতা',
  },
};

export class ProfileDiffEngine {
  /**
   * Normalizes a raw string value for exact comparison with canonical profile fields.
   */
  public static normalizeValue(canonicalKey: string, raw: string): string {
    if (!raw) return '';
    let val = raw.trim();

    // 1. Numerals: convert Bengali digits to English
    val = ValueNormalizer.toEnglishNumerals(val);

    // 2. Mobile formatting: normalize 01... or 8801...
    if (canonicalKey.includes('mobile') || canonicalKey.includes('phone')) {
      return ValueNormalizer.normalizeMobileNumber(val);
    }

    // 3. NID formatting: strip whitespace and hyphens
    if (canonicalKey.includes('nid') || canonicalKey.includes('nationalid')) {
      return ValueNormalizer.normalizeNid(val);
    }

    // 4. Clean extra spaces
    val = val.replace(/\s+/g, ' ');

    return val;
  }

  /**
   * Resolves the profile destination category and labels for a canonical key.
   */
  public static resolveDestination(canonicalKey: string): {
    destination: ProfileDestination;
    labelEn: string;
    labelBn: string;
    categoryEn: string;
    categoryBn: string;
  } {
    const meta = FIELD_METADATA_MAP[canonicalKey];
    if (meta) {
      return meta;
    }

    if (canonicalKey.startsWith('address.')) {
      return {
        destination: 'address',
        labelEn: canonicalKey.replace('address.', ''),
        labelBn: 'ঠিকানা',
        categoryEn: 'Address Profile',
        categoryBn: 'ঠিকানা তথ্য',
      };
    }

    if (canonicalKey.startsWith('education.')) {
      return {
        destination: 'education',
        labelEn: canonicalKey.replace('education.', ''),
        labelBn: 'শিক্ষাগত তথ্য',
        categoryEn: 'Education Records',
        categoryBn: 'শিক্ষাগত যোগ্যতা',
      };
    }

    if (canonicalKey.startsWith('experience.')) {
      return {
        destination: 'experience',
        labelEn: canonicalKey.replace('experience.', ''),
        labelBn: 'অভিজ্ঞতা',
        categoryEn: 'Experience Records',
        categoryBn: 'চাকরির অভিজ্ঞতা',
      };
    }

    if (canonicalKey.startsWith('application.') || canonicalKey.startsWith('applicant.id')) {
      return {
        destination: 'tracker',
        labelEn: 'Applicant / Application ID',
        labelBn: 'আবেদন আইডি',
        categoryEn: 'Application Tracker',
        categoryBn: 'আবেদন ট্র্যাকার',
      };
    }

    return {
      destination: 'personal',
      labelEn: canonicalKey,
      labelBn: canonicalKey,
      categoryEn: 'Personal Profile',
      categoryBn: 'ব্যক্তিগত তথ্য',
    };
  }

  /**
   * Retrieves the current saved string value of a canonical key from UserProfile.
   */
  public static getSavedValue(profile: UserProfile, canonicalKey: string): string {
    const canonical = toCanonicalProfile(profile);
    const resolved = resolveCanonicalValue(canonical, canonicalKey);
    return resolved ? String(resolved).trim() : '';
  }

  /**
   * Evaluates a single canonical field against the saved profile.
   */
  public static compareField(
    canonicalKey: string,
    rawFormValue: string,
    profile: UserProfile
  ): {
    diffType: 'NEW' | 'CHANGED' | 'UNCHANGED' | 'UNSUPPORTED';
    oldValue: string;
    normalizedNewValue: string;
  } {
    // Passwords, tokens, CAPTCHA, hidden are rejected
    const lowerKey = canonicalKey.toLowerCase();
    if (
      lowerKey.includes('password') ||
      lowerKey.includes('token') ||
      lowerKey.includes('captcha') ||
      lowerKey.includes('otp') ||
      lowerKey.includes('csrf') ||
      lowerKey.includes('submit')
    ) {
      return { diffType: 'UNSUPPORTED', oldValue: '', normalizedNewValue: '' };
    }

    const normalizedNew = this.normalizeValue(canonicalKey, rawFormValue);
    if (!normalizedNew) {
      // Empty input does not count as a proposed new value
      return { diffType: 'UNCHANGED', oldValue: '', normalizedNewValue: '' };
    }

    const rawOld = this.getSavedValue(profile, canonicalKey);
    const normalizedOld = this.normalizeValue(canonicalKey, rawOld);

    if (!normalizedOld) {
      return {
        diffType: 'NEW',
        oldValue: '',
        normalizedNewValue: normalizedNew,
      };
    }

    if (normalizedOld.toLowerCase() === normalizedNew.toLowerCase()) {
      return {
        diffType: 'UNCHANGED',
        oldValue: rawOld,
        normalizedNewValue: normalizedNew,
      };
    }

    return {
      diffType: 'CHANGED',
      oldValue: rawOld,
      normalizedNewValue: normalizedNew,
    };
  }

  /**
   * Compares an array of scanned/filled form elements against the user's active profile.
   * Returns only actionable NEW and CHANGED diff items.
   */
  public static detectFormDiffs(
    scannedItems: Array<{
      canonicalKey?: string;
      label?: string;
      value: string;
      sectionContext?: string;
    }>,
    profile: UserProfile
  ): DetectedProfileDiffItem[] {
    const diffs: DetectedProfileDiffItem[] = [];
    const seenKeys = new Set<string>();

    for (const item of scannedItems) {
      if (!item.canonicalKey || !item.value || seenKeys.has(item.canonicalKey)) {
        continue;
      }
      seenKeys.add(item.canonicalKey);

      const comparison = this.compareField(item.canonicalKey, item.value, profile);
      if (comparison.diffType === 'NEW' || comparison.diffType === 'CHANGED') {
        const meta = this.resolveDestination(item.canonicalKey);
        diffs.push({
          id: `diff_${item.canonicalKey}_${Date.now()}`,
          canonicalKey: item.canonicalKey,
          fieldLabel: item.label || meta.labelEn,
          fieldLabelBn: meta.labelBn,
          destination: meta.destination,
          destinationLabel: meta.categoryEn,
          destinationLabelBn: meta.categoryBn,
          oldValue: comparison.oldValue,
          newValue: comparison.normalizedNewValue,
          diffType: comparison.diffType,
          selected: true, // Selected by default for user convenience
          sectionContext: item.sectionContext,
        });
      }
    }

    return diffs;
  }

  /**
   * Applies approved diff items to the UserProfile, persists to storage,
   * records history, and returns the updated profile.
   */
  public static async applyApprovedDiffs(
    profile: UserProfile,
    approvedItems: DetectedProfileDiffItem[],
    sourceOrigin: string = typeof window !== 'undefined' ? window.location?.origin || '' : ''
  ): Promise<{
    updatedProfile: UserProfile;
    appliedCount: number;
    historyRecords: ProfileChangeHistoryRecord[];
  }> {
    const historyRecords: ProfileChangeHistoryRecord[] = [];
    let appliedCount = 0;
    const now = Date.now();

    for (const item of approvedItems) {
      if (!item.selected || !item.canonicalKey || !item.newValue) continue;

      const previousValue = this.getSavedValue(profile, item.canonicalKey);
      const ok = applyCanonicalProfileFieldUpdate(profile, item.canonicalKey, item.newValue);

      if (ok) {
        appliedCount += 1;
        const historyEntry: ProfileChangeHistoryRecord = {
          id: `hist_${item.canonicalKey}_${now}_${Math.random().toString(36).slice(2, 7)}`,
          fieldKey: item.canonicalKey,
          fieldLabelEn: item.fieldLabel,
          fieldLabelBn: item.fieldLabelBn,
          previousValue,
          newValue: item.newValue,
          sourceOrigin,
          destination: item.destination,
          updatedAt: now,
          userApproved: true,
          reverted: false,
        };
        historyRecords.push(historyEntry);
      }
    }

    if (appliedCount > 0) {
      profile.updatedAt = new Date().toISOString();
      await saveActiveProfile(profile);
      await this.appendChangeHistory(historyRecords);
    }

    return {
      updatedProfile: profile,
      appliedCount,
      historyRecords,
    };
  }

  /**
   * Appends records to the persistent change history.
   */
  public static async appendChangeHistory(records: ProfileChangeHistoryRecord[]): Promise<void> {
    if (!records.length) return;
    try {
      const existing = await this.getChangeHistory();
      const combined = [...records, ...existing].slice(0, 100); // retain last 100 changes

      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await new Promise<void>((resolve) => {
          chrome.storage.local.set({ [HISTORY_STORAGE_KEY]: combined }, () => resolve());
        });
        return;
      }

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(combined));
      }
    } catch (err) {
      console.warn('JobFill BD: Could not persist change history:', err);
    }
  }

  /**
   * Retrieves full profile change history.
   */
  public static async getChangeHistory(): Promise<ProfileChangeHistoryRecord[]> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const res: any = await new Promise((resolve) => {
          chrome.storage.local.get([HISTORY_STORAGE_KEY], (r) => resolve(r || {}));
        });
        return Array.isArray(res?.[HISTORY_STORAGE_KEY]) ? res[HISTORY_STORAGE_KEY] : [];
      }

      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
      }
    } catch {
      return [];
    }
    return [];
  }

  /**
   * Reverts a previously approved change back to its previous value (Undo).
   */
  public static async undoChange(
    historyRecordId: string,
    activeProfile?: UserProfile
  ): Promise<{ updatedProfile: UserProfile; reverted: boolean; fieldKey: string }> {
    const history = await this.getChangeHistory();
    const entryIndex = history.findIndex((h) => h.id === historyRecordId);
    if (entryIndex === -1) {
      throw new Error('History record not found.');
    }

    const entry = history[entryIndex];
    if (entry.reverted) {
      throw new Error('Change has already been reverted.');
    }

    const profile = activeProfile || (await getActiveProfile());
    // Revert the profile field back to previousValue
    const ok = applyCanonicalProfileFieldUpdate(profile, entry.fieldKey, entry.previousValue);
    if (!ok) {
      throw new Error(`Failed to restore previous value for ${entry.fieldKey}`);
    }

    profile.updatedAt = new Date().toISOString();
    await saveActiveProfile(profile);

    // Mark history entry as reverted
    entry.reverted = true;
    history[entryIndex] = entry;
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await new Promise<void>((resolve) => {
        chrome.storage.local.set({ [HISTORY_STORAGE_KEY]: history }, () => resolve());
      });
    } else if (typeof localStorage !== 'undefined') {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    }

    return {
      updatedProfile: profile,
      reverted: true,
      fieldKey: entry.fieldKey,
    };
  }

  /**
   * Clears change history.
   */
  public static async clearChangeHistory(): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await new Promise<void>((resolve) => {
        chrome.storage.local.remove([HISTORY_STORAGE_KEY], () => resolve());
      });
    } else if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
    }
  }
}
