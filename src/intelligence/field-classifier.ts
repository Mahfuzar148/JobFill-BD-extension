// JobFill BD - Semantic Field Classifier & Two-Way Sync Intelligence
// Analyzes live HTML form elements, extracts contextual semantics, and maps them
// to canonical profile fields, dynamic custom fields, or application tracker entities.
// Security Invariants:
// - Passwords, OTP, PIN, CSRF, and CAPTCHA are marked BLOCKED and never entered into profile.
// - Sensitive PII (NID, Phone, Email, DOB, Family, Address, Education) is flagged as isSensitive = true.

import { CustomFieldCategory, CustomFieldDataType } from '../types/profile';

export type FieldDestination =
  | 'personal'
  | 'family'
  | 'address'
  | 'education'
  | 'experience'
  | 'skills'
  | 'tracker'
  | 'vault'
  | 'custom'
  | 'ignored';

export interface FieldClassificationResult {
  isSupported: boolean;
  isSensitive: boolean;
  isBlockedSecurity: boolean;
  isCustomField: boolean;
  canonicalKey: string;
  fieldLabelEn: string;
  fieldLabelBn: string;
  destination: FieldDestination;
  destinationLabelEn: string;
  destinationLabelBn: string;
  category: CustomFieldCategory;
  dataType: CustomFieldDataType;
  inferredValue: string;
  contextText?: string;
}

export class FieldClassifier {
  /**
   * Classifies an HTML input, select, or textarea element semantically.
   */
  public static classifyElement(
    element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
    externalContext: string = ''
  ): FieldClassificationResult {
    const rawVal = (element.value || '').trim();
    const type = (element.getAttribute('type') || element.tagName).toLowerCase();
    const id = (element.id || '').toLowerCase();
    const name = (element.name || '').toLowerCase();
    const placeholder = (element.getAttribute('placeholder') || '').toLowerCase();
    const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();

    // 1. Security Check: Passwords, OTP, Token, CAPTCHA
    if (
      type === 'password' ||
      id.includes('password') ||
      name.includes('password') ||
      id.includes('captcha') ||
      name.includes('captcha') ||
      placeholder.includes('captcha') ||
      id.includes('otp') ||
      name.includes('otp') ||
      id.includes('token') ||
      name.includes('token') ||
      id.includes('csrf') ||
      name.includes('csrf') ||
      id.includes('cvv') ||
      name.includes('cvv') ||
      /(^|[_.-])pin([_.-]|$)/.test(id) ||
      /(^|[_.-])pin([_.-]|$)/.test(name) ||
      id.includes('security_pin') ||
      name.includes('security_pin')
    ) {
      const isPass = type === 'password' || id.includes('password') || name.includes('password');
      return {
        isSupported: false,
        isSensitive: true,
        isBlockedSecurity: true,
        isCustomField: false,
        canonicalKey: isPass ? 'vault.password' : 'security.blocked',
        fieldLabelEn: isPass ? 'Password' : 'Security Token',
        fieldLabelBn: isPass ? 'পাসওয়ার্ড' : 'নিরাপত্তা টোকেন',
        destination: isPass ? 'vault' : 'ignored',
        destinationLabelEn: isPass ? 'Credential Vault' : 'Ignored',
        destinationLabelBn: isPass ? 'ক্রেডেনশিয়াল ভল্ট' : 'বাতিলকৃত',
        category: 'other',
        dataType: 'text',
        inferredValue: isPass ? '[PROTECTED]' : '',
      };
    }

    // 2. Extract Visible Label & Context
    const labelText = this.extractLabelText(element);
    const parentRowText = this.extractParentContext(element);
    const combinedTokens = `${id} ${name} ${placeholder} ${ariaLabel} ${labelText} ${parentRowText} ${externalContext}`.toLowerCase();

    // 3. Application Tracker Identification (Applicant ID, Tracking No, Roll No, Ref No)
    if (
      (combinedTokens.includes('applicant') && (combinedTokens.includes('id') || combinedTokens.includes('number'))) ||
      combinedTokens.includes('user_id') ||
      combinedTokens.includes('userid') ||
      combinedTokens.includes('tracking_no') ||
      combinedTokens.includes('tracking_num') ||
      combinedTokens.includes('app_id') ||
      combinedTokens.includes('application_id') ||
      combinedTokens.includes('invoice_no') ||
      combinedTokens.includes('invoice_num') ||
      combinedTokens.includes('transaction_id') ||
      combinedTokens.includes('txnid') ||
      combinedTokens.includes('roll_no') ||
      combinedTokens.includes('roll_number') ||
      combinedTokens.includes('রেজিস্ট্রেশন নম্বর') ||
      combinedTokens.includes('আবেদন আইডি')
    ) {
      return {
        isSupported: true,
        isSensitive: false,
        isBlockedSecurity: false,
        isCustomField: false,
        canonicalKey: 'application.tracker.identifier',
        fieldLabelEn: labelText || 'Application / User ID',
        fieldLabelBn: 'আবেদন / ইউজার আইডি',
        destination: 'tracker',
        destinationLabelEn: 'Application Tracker',
        destinationLabelBn: 'আবেদন ট্র্যাকার',
        category: 'other',
        dataType: 'text',
        inferredValue: rawVal,
        contextText: combinedTokens,
      };
    }

    // 4. Contact Fields
    if (combinedTokens.includes('mobile') || combinedTokens.includes('phone') || combinedTokens.includes('মোবাইল')) {
      const isConfirm = combinedTokens.includes('confirm') || combinedTokens.includes('নিশ্চিত');
      const key = isConfirm ? 'contact.confirmMobile' : 'contact.mobile';
      return {
        isSupported: true,
        isSensitive: true,
        isBlockedSecurity: false,
        isCustomField: false,
        canonicalKey: key,
        fieldLabelEn: isConfirm ? 'Confirm Mobile Number' : 'Mobile Number',
        fieldLabelBn: isConfirm ? 'মোবাইল নম্বর নিশ্চিতকরণ' : 'মোবাইল নম্বর',
        destination: 'personal',
        destinationLabelEn: 'Personal Profile',
        destinationLabelBn: 'ব্যক্তিগত তথ্য',
        category: 'personal',
        dataType: 'text',
        inferredValue: rawVal,
        contextText: combinedTokens,
      };
    }

    if (combinedTokens.includes('email') || combinedTokens.includes('ইমেইল') || combinedTokens.includes('ই-মেইল')) {
      return {
        isSupported: true,
        isSensitive: true,
        isBlockedSecurity: false,
        isCustomField: false,
        canonicalKey: 'contact.email',
        fieldLabelEn: 'Email Address',
        fieldLabelBn: 'ইমেইল ঠিকানা',
        destination: 'personal',
        destinationLabelEn: 'Personal Profile',
        destinationLabelBn: 'ব্যক্তিগত তথ্য',
        category: 'personal',
        dataType: 'text',
        inferredValue: rawVal,
        contextText: combinedTokens,
      };
    }

    // 5. Identities (NID, Birth Reg, Passport)
    if (combinedTokens.includes('nid') || combinedTokens.includes('national_id') || combinedTokens.includes('জাতীয় পরিচয়পত্র')) {
      return {
        isSupported: true,
        isSensitive: true,
        isBlockedSecurity: false,
        isCustomField: false,
        canonicalKey: 'identity.nationalId',
        fieldLabelEn: 'National ID (NID)',
        fieldLabelBn: 'জাতীয় পরিচয়পত্র (NID)',
        destination: 'personal',
        destinationLabelEn: 'Personal Profile',
        destinationLabelBn: 'ব্যক্তিগত তথ্য',
        category: 'personal',
        dataType: 'text',
        inferredValue: rawVal,
        contextText: combinedTokens,
      };
    }

    if (combinedTokens.includes('birth_reg') || combinedTokens.includes('birthreg') || combinedTokens.includes('brn') || combinedTokens.includes('জন্ম নিবন্ধন')) {
      return {
        isSupported: true,
        isSensitive: true,
        isBlockedSecurity: false,
        isCustomField: false,
        canonicalKey: 'identity.birthRegistration',
        fieldLabelEn: 'Birth Registration No (BRN)',
        fieldLabelBn: 'জন্ম নিবন্ধন নম্বর',
        destination: 'personal',
        destinationLabelEn: 'Personal Profile',
        destinationLabelBn: 'ব্যক্তিগত তথ্য',
        category: 'personal',
        dataType: 'text',
        inferredValue: rawVal,
        contextText: combinedTokens,
      };
    }

    if (combinedTokens.includes('passport') || combinedTokens.includes('পাসপোর্ট')) {
      return {
        isSupported: true,
        isSensitive: true,
        isBlockedSecurity: false,
        isCustomField: false,
        canonicalKey: 'identity.passport',
        fieldLabelEn: 'Passport Number',
        fieldLabelBn: 'পাসপোর্ট নম্বর',
        destination: 'personal',
        destinationLabelEn: 'Personal Profile',
        destinationLabelBn: 'ব্যক্তিগত তথ্য',
        category: 'personal',
        dataType: 'text',
        inferredValue: rawVal,
        contextText: combinedTokens,
      };
    }

    // 6. Names (Applicant, Father, Mother, Spouse)
    const isBanglaField = combinedTokens.includes('bangla') || combinedTokens.includes('bn') || combinedTokens.includes('বাংলা');
    if (combinedTokens.includes('father') || combinedTokens.includes('পিতা')) {
      const key = isBanglaField ? 'family.father.name.bangla' : 'family.father.name.english';
      return {
        isSupported: true,
        isSensitive: true,
        isBlockedSecurity: false,
        isCustomField: false,
        canonicalKey: key,
        fieldLabelEn: isBanglaField ? "Father's Name (Bangla)" : "Father's Name (English)",
        fieldLabelBn: isBanglaField ? 'পিতার নাম (বাংলা)' : 'পিতার নাম (ইংরেজি)',
        destination: 'family',
        destinationLabelEn: 'Family Details',
        destinationLabelBn: 'পারিবারিক তথ্য',
        category: 'family',
        dataType: 'text',
        inferredValue: rawVal,
        contextText: combinedTokens,
      };
    }

    if (combinedTokens.includes('mother') || combinedTokens.includes('মাতা')) {
      const key = isBanglaField ? 'family.mother.name.bangla' : 'family.mother.name.english';
      return {
        isSupported: true,
        isSensitive: true,
        isBlockedSecurity: false,
        isCustomField: false,
        canonicalKey: key,
        fieldLabelEn: isBanglaField ? "Mother's Name (Bangla)" : "Mother's Name (English)",
        fieldLabelBn: isBanglaField ? 'মাতার নাম (বাংলা)' : 'মাতার নাম (ইংরেজি)',
        destination: 'family',
        destinationLabelEn: 'Family Details',
        destinationLabelBn: 'পারিবারিক তথ্য',
        category: 'family',
        dataType: 'text',
        inferredValue: rawVal,
        contextText: combinedTokens,
      };
    }

    if (combinedTokens.includes('spouse') || combinedTokens.includes('স্বামী') || combinedTokens.includes('স্ত্রী')) {
      const key = isBanglaField ? 'family.spouse.name.bangla' : 'family.spouse.name.english';
      return {
        isSupported: true,
        isSensitive: true,
        isBlockedSecurity: false,
        isCustomField: false,
        canonicalKey: key,
        fieldLabelEn: isBanglaField ? "Spouse's Name (Bangla)" : "Spouse's Name (English)",
        fieldLabelBn: isBanglaField ? 'স্বামী/স্ত্রীর নাম (বাংলা)' : 'স্বামী/স্ত্রীর নাম (ইংরেজি)',
        destination: 'family',
        destinationLabelEn: 'Family Details',
        destinationLabelBn: 'পারিবারিক তথ্য',
        category: 'family',
        dataType: 'text',
        inferredValue: rawVal,
        contextText: combinedTokens,
      };
    }

    if (
      combinedTokens.includes('applicant_name') ||
      combinedTokens.includes('candidate_name') ||
      combinedTokens.includes('full_name') ||
      combinedTokens.includes('applicantname') ||
      combinedTokens.includes('প্রার্থীর নাম') ||
      (combinedTokens.includes('name') && !combinedTokens.includes('user') && !combinedTokens.includes('org'))
    ) {
      const key = isBanglaField ? 'applicant.fullName.bangla' : 'applicant.fullName.english';
      return {
        isSupported: true,
        isSensitive: true,
        isBlockedSecurity: false,
        isCustomField: false,
        canonicalKey: key,
        fieldLabelEn: isBanglaField ? 'Full Name (Bangla)' : 'Full Name (English)',
        fieldLabelBn: isBanglaField ? 'পূর্ণ নাম (বাংলা)' : 'পূর্ণ নাম (ইংরেজি)',
        destination: 'personal',
        destinationLabelEn: 'Personal Profile',
        destinationLabelBn: 'ব্যক্তিগত তথ্য',
        category: 'personal',
        dataType: 'text',
        inferredValue: rawVal,
        contextText: combinedTokens,
      };
    }

    // 7. Personal Demographics (DOB, Gender, Religion, Marital, Nationality, Quota)
    if (combinedTokens.includes('dob') || combinedTokens.includes('birth_date') || combinedTokens.includes('dateofbirth') || combinedTokens.includes('জন্ম তারিখ')) {
      return {
        isSupported: true,
        isSensitive: true,
        isBlockedSecurity: false,
        isCustomField: false,
        canonicalKey: 'applicant.dateOfBirth',
        fieldLabelEn: 'Date of Birth',
        fieldLabelBn: 'জন্ম তারিখ',
        destination: 'personal',
        destinationLabelEn: 'Personal Profile',
        destinationLabelBn: 'ব্যক্তিগত তথ্য',
        category: 'personal',
        dataType: 'date',
        inferredValue: rawVal,
        contextText: combinedTokens,
      };
    }

    if (combinedTokens.includes('gender') || combinedTokens.includes('sex') || combinedTokens.includes('লিঙ্গ')) {
      return {
        isSupported: true,
        isSensitive: false,
        isBlockedSecurity: false,
        isCustomField: false,
        canonicalKey: 'applicant.gender',
        fieldLabelEn: 'Gender',
        fieldLabelBn: 'লিঙ্গ',
        destination: 'personal',
        destinationLabelEn: 'Personal Profile',
        destinationLabelBn: 'ব্যক্তিগত তথ্য',
        category: 'personal',
        dataType: 'select',
        inferredValue: rawVal,
        contextText: combinedTokens,
      };
    }

    if (combinedTokens.includes('religion') || combinedTokens.includes('ধর্ম')) {
      return {
        isSupported: true,
        isSensitive: false,
        isBlockedSecurity: false,
        isCustomField: false,
        canonicalKey: 'applicant.religion',
        fieldLabelEn: 'Religion',
        fieldLabelBn: 'ধর্ম',
        destination: 'personal',
        destinationLabelEn: 'Personal Profile',
        destinationLabelBn: 'ব্যক্তিগত তথ্য',
        category: 'personal',
        dataType: 'select',
        inferredValue: rawVal,
        contextText: combinedTokens,
      };
    }

    if (combinedTokens.includes('marital') || combinedTokens.includes('বৈবাহিক')) {
      return {
        isSupported: true,
        isSensitive: false,
        isBlockedSecurity: false,
        isCustomField: false,
        canonicalKey: 'applicant.maritalStatus',
        fieldLabelEn: 'Marital Status',
        fieldLabelBn: 'বৈবাহিক অবস্থা',
        destination: 'personal',
        destinationLabelEn: 'Personal Profile',
        destinationLabelBn: 'ব্যক্তিগত তথ্য',
        category: 'personal',
        dataType: 'select',
        inferredValue: rawVal,
        contextText: combinedTokens,
      };
    }

    if (combinedTokens.includes('nationality') || combinedTokens.includes('জাতীয়তা')) {
      return {
        isSupported: true,
        isSensitive: false,
        isBlockedSecurity: false,
        isCustomField: false,
        canonicalKey: 'applicant.nationality',
        fieldLabelEn: 'Nationality',
        fieldLabelBn: 'জাতীয়তা',
        destination: 'personal',
        destinationLabelEn: 'Personal Profile',
        destinationLabelBn: 'ব্যক্তিগত তথ্য',
        category: 'personal',
        dataType: 'text',
        inferredValue: rawVal,
        contextText: combinedTokens,
      };
    }

    if (combinedTokens.includes('quota') || combinedTokens.includes('কোটা')) {
      return {
        isSupported: true,
        isSensitive: false,
        isBlockedSecurity: false,
        isCustomField: false,
        canonicalKey: 'applicant.quota',
        fieldLabelEn: 'Quota Category',
        fieldLabelBn: 'কোটা সুবিধা',
        destination: 'personal',
        destinationLabelEn: 'Personal Profile',
        destinationLabelBn: 'ব্যক্তিগত তথ্য',
        category: 'personal',
        dataType: 'select',
        inferredValue: rawVal,
        contextText: combinedTokens,
      };
    }

    // 8. Special Info (Blood group, Height, Weight, Exam Centre)
    if (combinedTokens.includes('blood') || combinedTokens.includes('রক্তের গ্রুপ')) {
      return {
        isSupported: true,
        isSensitive: false,
        isBlockedSecurity: false,
        isCustomField: false,
        canonicalKey: 'special.bloodGroup',
        fieldLabelEn: 'Blood Group',
        fieldLabelBn: 'রক্তের গ্রুপ',
        destination: 'personal',
        destinationLabelEn: 'Personal Profile',
        destinationLabelBn: 'ব্যক্তিগত তথ্য',
        category: 'personal',
        dataType: 'select',
        inferredValue: rawVal,
        contextText: combinedTokens,
      };
    }

    if (combinedTokens.includes('height') || combinedTokens.includes('উচ্চতা')) {
      return {
        isSupported: true,
        isSensitive: false,
        isBlockedSecurity: false,
        isCustomField: false,
        canonicalKey: 'special.heightCm',
        fieldLabelEn: 'Height (cm)',
        fieldLabelBn: 'উচ্চতা',
        destination: 'personal',
        destinationLabelEn: 'Personal Profile',
        destinationLabelBn: 'ব্যক্তিগত তথ্য',
        category: 'personal',
        dataType: 'number',
        inferredValue: rawVal,
        contextText: combinedTokens,
      };
    }

    if (combinedTokens.includes('weight') || combinedTokens.includes('ওজন')) {
      return {
        isSupported: true,
        isSensitive: false,
        isBlockedSecurity: false,
        isCustomField: false,
        canonicalKey: 'special.weightKg',
        fieldLabelEn: 'Weight (kg)',
        fieldLabelBn: 'ওজন',
        destination: 'personal',
        destinationLabelEn: 'Personal Profile',
        destinationLabelBn: 'ব্যক্তিগত তথ্য',
        category: 'personal',
        dataType: 'number',
        inferredValue: rawVal,
        contextText: combinedTokens,
      };
    }

    if (combinedTokens.includes('exam_centre') || combinedTokens.includes('exam_center') || combinedTokens.includes('পরীক্ষা কেন্দ্র')) {
      return {
        isSupported: true,
        isSensitive: false,
        isBlockedSecurity: false,
        isCustomField: false,
        canonicalKey: 'special.examCentre',
        fieldLabelEn: 'Exam Centre',
        fieldLabelBn: 'পরীক্ষা কেন্দ্র',
        destination: 'personal',
        destinationLabelEn: 'Personal Profile',
        destinationLabelBn: 'ব্যক্তিগত তথ্য',
        category: 'personal',
        dataType: 'select',
        inferredValue: rawVal,
        contextText: combinedTokens,
      };
    }

    // 9. Address Fields (Present vs Permanent)
    const isPermanent =
      combinedTokens.includes('permanent') ||
      combinedTokens.includes('perm_') ||
      combinedTokens.includes('স্থায়ী');
    const addrPrefix = isPermanent ? 'address.permanent' : 'address.present';
    const addrTypeBn = isPermanent ? 'স্থায়ী' : 'বর্তমান';

    if (combinedTokens.includes('district') || combinedTokens.includes('জেলা')) {
      return {
        isSupported: true,
        isSensitive: true,
        isBlockedSecurity: false,
        isCustomField: false,
        canonicalKey: `${addrPrefix}.district`,
        fieldLabelEn: `${isPermanent ? 'Permanent' : 'Present'} District`,
        fieldLabelBn: `${addrTypeBn} জেলা`,
        destination: 'address',
        destinationLabelEn: 'Address Details',
        destinationLabelBn: 'ঠিকানা তথ্য',
        category: 'address',
        dataType: 'select',
        inferredValue: rawVal,
        contextText: combinedTokens,
      };
    }

    if (combinedTokens.includes('upazila') || combinedTokens.includes('thana') || combinedTokens.includes('উপজেলা') || combinedTokens.includes('থানা')) {
      return {
        isSupported: true,
        isSensitive: true,
        isBlockedSecurity: false,
        isCustomField: false,
        canonicalKey: `${addrPrefix}.upazila`,
        fieldLabelEn: `${isPermanent ? 'Permanent' : 'Present'} Upazila / Thana`,
        fieldLabelBn: `${addrTypeBn} উপজেলা/থানা`,
        destination: 'address',
        destinationLabelEn: 'Address Details',
        destinationLabelBn: 'ঠিকানা তথ্য',
        category: 'address',
        dataType: 'select',
        inferredValue: rawVal,
        contextText: combinedTokens,
      };
    }

    if (combinedTokens.includes('post_code') || combinedTokens.includes('postcode') || combinedTokens.includes('পোস্ট কোড')) {
      return {
        isSupported: true,
        isSensitive: true,
        isBlockedSecurity: false,
        isCustomField: false,
        canonicalKey: `${addrPrefix}.postCode`,
        fieldLabelEn: `${isPermanent ? 'Permanent' : 'Present'} Post Code`,
        fieldLabelBn: `${addrTypeBn} পোস্ট কোড`,
        destination: 'address',
        destinationLabelEn: 'Address Details',
        destinationLabelBn: 'ঠিকানা তথ্য',
        category: 'address',
        dataType: 'text',
        inferredValue: rawVal,
        contextText: combinedTokens,
      };
    }

    if (combinedTokens.includes('post_office') || combinedTokens.includes('postoffice') || combinedTokens.includes('ডাকঘর')) {
      return {
        isSupported: true,
        isSensitive: true,
        isBlockedSecurity: false,
        isCustomField: false,
        canonicalKey: `${addrPrefix}.postOffice`,
        fieldLabelEn: `${isPermanent ? 'Permanent' : 'Present'} Post Office`,
        fieldLabelBn: `${addrTypeBn} ডাকঘর`,
        destination: 'address',
        destinationLabelEn: 'Address Details',
        destinationLabelBn: 'ঠিকানা তথ্য',
        category: 'address',
        dataType: 'text',
        inferredValue: rawVal,
        contextText: combinedTokens,
      };
    }

    if (combinedTokens.includes('careof') || combinedTokens.includes('care_of') || combinedTokens.includes('অভিভাবক')) {
      return {
        isSupported: true,
        isSensitive: true,
        isBlockedSecurity: false,
        isCustomField: false,
        canonicalKey: `${addrPrefix}.careOf`,
        fieldLabelEn: `${isPermanent ? 'Permanent' : 'Present'} Care Of`,
        fieldLabelBn: `${addrTypeBn} অভিভাবক`,
        destination: 'address',
        destinationLabelEn: 'Address Details',
        destinationLabelBn: 'ঠিকানা তথ্য',
        category: 'address',
        dataType: 'text',
        inferredValue: rawVal,
        contextText: combinedTokens,
      };
    }

    if (
      combinedTokens.includes('village') ||
      combinedTokens.includes('road') ||
      combinedTokens.includes('house') ||
      combinedTokens.includes('গ্রাম') ||
      combinedTokens.includes('মহল্লা') ||
      combinedTokens.includes('ঠিকানা')
    ) {
      return {
        isSupported: true,
        isSensitive: true,
        isBlockedSecurity: false,
        isCustomField: false,
        canonicalKey: `${addrPrefix}.village`,
        fieldLabelEn: `${isPermanent ? 'Permanent' : 'Present'} Village / Road`,
        fieldLabelBn: `${addrTypeBn} গ্রাম/মহল্লা`,
        destination: 'address',
        destinationLabelEn: 'Address Details',
        destinationLabelBn: 'ঠিকানা তথ্য',
        category: 'address',
        dataType: 'text',
        inferredValue: rawVal,
        contextText: combinedTokens,
      };
    }

    // 10. Education Fields (SSC, HSC, Graduation, Masters)
    const eduLevel = this.detectEducationLevel(combinedTokens);
    if (eduLevel) {
      const prefix = `education.${eduLevel}`;
      const levelLabel = eduLevel.toUpperCase();

      if (combinedTokens.includes('board') || combinedTokens.includes('বোর্ড')) {
        return {
          isSupported: true,
          isSensitive: true,
          isBlockedSecurity: false,
          isCustomField: false,
          canonicalKey: `${prefix}.board`,
          fieldLabelEn: `${levelLabel} Board`,
          fieldLabelBn: `${levelLabel} শিক্ষাবোর্ড`,
          destination: 'education',
          destinationLabelEn: 'Education Records',
          destinationLabelBn: 'শিক্ষাগত যোগ্যতা',
          category: 'education',
          dataType: 'select',
          inferredValue: rawVal,
          contextText: combinedTokens,
        };
      }

      if (combinedTokens.includes('roll') || combinedTokens.includes('রোল')) {
        return {
          isSupported: true,
          isSensitive: true,
          isBlockedSecurity: false,
          isCustomField: false,
          canonicalKey: `${prefix}.roll`,
          fieldLabelEn: `${levelLabel} Roll Number`,
          fieldLabelBn: `${levelLabel} রোল নম্বর`,
          destination: 'education',
          destinationLabelEn: 'Education Records',
          destinationLabelBn: 'শিক্ষাগত যোগ্যতা',
          category: 'education',
          dataType: 'text',
          inferredValue: rawVal,
          contextText: combinedTokens,
        };
      }

      if (combinedTokens.includes('group') || combinedTokens.includes('major') || combinedTokens.includes('শাখা') || combinedTokens.includes('বিভাগ')) {
        return {
          isSupported: true,
          isSensitive: true,
          isBlockedSecurity: false,
          isCustomField: false,
          canonicalKey: `${prefix}.group`,
          fieldLabelEn: `${levelLabel} Group / Major`,
          fieldLabelBn: `${levelLabel} বিভাগ/শাখা`,
          destination: 'education',
          destinationLabelEn: 'Education Records',
          destinationLabelBn: 'শিক্ষাগত যোগ্যতা',
          category: 'education',
          dataType: 'select',
          inferredValue: rawVal,
          contextText: combinedTokens,
        };
      }

      if (combinedTokens.includes('gpa') || combinedTokens.includes('cgpa') || combinedTokens.includes('result') || combinedTokens.includes('জিপিএ') || combinedTokens.includes('ফলাফল')) {
        return {
          isSupported: true,
          isSensitive: true,
          isBlockedSecurity: false,
          isCustomField: false,
          canonicalKey: `${prefix}.gpa`,
          fieldLabelEn: `${levelLabel} GPA / Result`,
          fieldLabelBn: `${levelLabel} জিপিএ / ফলাফল`,
          destination: 'education',
          destinationLabelEn: 'Education Records',
          destinationLabelBn: 'শিক্ষাগত যোগ্যতা',
          category: 'education',
          dataType: 'text',
          inferredValue: rawVal,
          contextText: combinedTokens,
        };
      }

      if (combinedTokens.includes('year') || combinedTokens.includes('passing_year') || combinedTokens.includes('পাসের সন')) {
        return {
          isSupported: true,
          isSensitive: true,
          isBlockedSecurity: false,
          isCustomField: false,
          canonicalKey: `${prefix}.passingYear`,
          fieldLabelEn: `${levelLabel} Passing Year`,
          fieldLabelBn: `${levelLabel} পাসের সন`,
          destination: 'education',
          destinationLabelEn: 'Education Records',
          destinationLabelBn: 'শিক্ষাগত যোগ্যতা',
          category: 'education',
          dataType: 'text',
          inferredValue: rawVal,
          contextText: combinedTokens,
        };
      }

      if (combinedTokens.includes('university') || combinedTokens.includes('institute') || combinedTokens.includes('institution') || combinedTokens.includes('বিশ্ববিদ্যালয়')) {
        return {
          isSupported: true,
          isSensitive: true,
          isBlockedSecurity: false,
          isCustomField: false,
          canonicalKey: `${prefix}.institution`,
          fieldLabelEn: `${levelLabel} University / Institution`,
          fieldLabelBn: `${levelLabel} বিশ্ববিদ্যালয়/প্রতিষ্ঠান`,
          destination: 'education',
          destinationLabelEn: 'Education Records',
          destinationLabelBn: 'শিক্ষাগত যোগ্যতা',
          category: 'education',
          dataType: 'text',
          inferredValue: rawVal,
          contextText: combinedTokens,
        };
      }

      if (combinedTokens.includes('subject') || combinedTokens.includes('discipline') || combinedTokens.includes('বিষয়')) {
        return {
          isSupported: true,
          isSensitive: true,
          isBlockedSecurity: false,
          isCustomField: false,
          canonicalKey: `${prefix}.subject`,
          fieldLabelEn: `${levelLabel} Subject / Discipline`,
          fieldLabelBn: `${levelLabel} বিষয়`,
          destination: 'education',
          destinationLabelEn: 'Education Records',
          destinationLabelBn: 'শিক্ষাগত যোগ্যতা',
          category: 'education',
          dataType: 'text',
          inferredValue: rawVal,
          contextText: combinedTokens,
        };
      }
    }

    // 11. Experience Fields
    if (combinedTokens.includes('experience') || combinedTokens.includes('job') || combinedTokens.includes('অভিজ্ঞতা') || combinedTokens.includes('চাকরি')) {
      if (combinedTokens.includes('organization') || combinedTokens.includes('company') || combinedTokens.includes('employer') || combinedTokens.includes('প্রতিষ্ঠান')) {
        return {
          isSupported: true,
          isSensitive: true,
          isBlockedSecurity: false,
          isCustomField: false,
          canonicalKey: 'experience.organization',
          fieldLabelEn: 'Organization / Company Name',
          fieldLabelBn: 'প্রতিষ্ঠানের নাম',
          destination: 'experience',
          destinationLabelEn: 'Experience Records',
          destinationLabelBn: 'চাকরির অভিজ্ঞতা',
          category: 'experience',
          dataType: 'text',
          inferredValue: rawVal,
          contextText: combinedTokens,
        };
      }

      if (combinedTokens.includes('designation') || combinedTokens.includes('post_name') || combinedTokens.includes('position') || combinedTokens.includes('পদবী')) {
        return {
          isSupported: true,
          isSensitive: true,
          isBlockedSecurity: false,
          isCustomField: false,
          canonicalKey: 'experience.designation',
          fieldLabelEn: 'Designation / Post Name',
          fieldLabelBn: 'পদের নাম',
          destination: 'experience',
          destinationLabelEn: 'Experience Records',
          destinationLabelBn: 'চাকরির অভিজ্ঞতা',
          category: 'experience',
          dataType: 'text',
          inferredValue: rawVal,
          contextText: combinedTokens,
        };
      }

      if (combinedTokens.includes('start_date') || combinedTokens.includes('from_date') || combinedTokens.includes('যোগদানের তারিখ')) {
        return {
          isSupported: true,
          isSensitive: true,
          isBlockedSecurity: false,
          isCustomField: false,
          canonicalKey: 'experience.startDate',
          fieldLabelEn: 'Experience Start Date',
          fieldLabelBn: 'শুরুর তারিখ',
          destination: 'experience',
          destinationLabelEn: 'Experience Records',
          destinationLabelBn: 'চাকরির অভিজ্ঞতা',
          category: 'experience',
          dataType: 'date',
          inferredValue: rawVal,
          contextText: combinedTokens,
        };
      }

      if (combinedTokens.includes('end_date') || combinedTokens.includes('to_date') || combinedTokens.includes('সমাপ্তির তারিখ')) {
        return {
          isSupported: true,
          isSensitive: true,
          isBlockedSecurity: false,
          isCustomField: false,
          canonicalKey: 'experience.endDate',
          fieldLabelEn: 'Experience End Date',
          fieldLabelBn: 'সমাপ্তির তারিখ',
          destination: 'experience',
          destinationLabelEn: 'Experience Records',
          destinationLabelBn: 'চাকরির অভিজ্ঞতা',
          category: 'experience',
          dataType: 'date',
          inferredValue: rawVal,
          contextText: combinedTokens,
        };
      }
    }

    // 12. Dynamic Custom Field Fallback (Learned Form Field)
    // If we have a reasonable label or name/id and user entered a value
    const slug = this.generateFieldSlug(labelText || name || id);
    const inferredCategory = this.inferCustomCategory(combinedTokens);
    const inferredDataType = this.inferDataType(element);

    const isSensitiveCustom =
      inferredCategory === 'personal' ||
      inferredCategory === 'family' ||
      inferredCategory === 'address' ||
      inferredCategory === 'education';

    const labelEn = labelText || this.slugToTitleCase(slug);

    return {
      isSupported: true,
      isSensitive: isSensitiveCustom,
      isBlockedSecurity: false,
      isCustomField: true,
      canonicalKey: `custom_${slug}`,
      fieldLabelEn: labelEn,
      fieldLabelBn: labelEn,
      destination: 'custom',
      destinationLabelEn: 'Custom Profile Fields',
      destinationLabelBn: 'কাস্টম প্রোফাইল তথ্য',
      category: inferredCategory,
      dataType: inferredDataType,
      inferredValue: rawVal,
      contextText: combinedTokens,
    };
  }

  private static extractLabelText(element: HTMLElement): string {
    // 1. Direct label reference via <label for="...">
    if (element.id && typeof document !== 'undefined') {
      const forLabel = document.querySelector(`label[for="${element.id}"]`);
      if (forLabel?.textContent?.trim()) {
        return forLabel.textContent.trim();
      }
    }

    // 2. HTMLFormElement labels property
    const asInput = element as HTMLInputElement;
    if (asInput.labels && asInput.labels.length > 0 && asInput.labels[0].textContent?.trim()) {
      return asInput.labels[0].textContent.trim();
    }

    // 3. Parent <label>
    const parentLabel = element.closest('label');
    if (parentLabel?.textContent?.trim()) {
      return parentLabel.textContent.trim();
    }

    // 4. aria-label or placeholder
    const aria = element.getAttribute('aria-label');
    if (aria?.trim()) return aria.trim();

    const placeholder = element.getAttribute('placeholder');
    if (placeholder?.trim()) return placeholder.trim();

    return '';
  }

  private static extractParentContext(element: HTMLElement): string {
    const parentTd = element.closest('td, th');
    if (parentTd) {
      const prevSibling = parentTd.previousElementSibling;
      if (prevSibling?.textContent?.trim()) {
        return prevSibling.textContent.trim();
      }
    }
    const parentRow = element.closest('tr, .form-group, .row, fieldset');
    return parentRow?.textContent?.trim().slice(0, 80) || '';
  }

  private static detectEducationLevel(tokens: string): 'ssc' | 'hsc' | 'graduation' | 'masters' | null {
    if (tokens.includes('ssc') || tokens.includes('dakhil') || tokens.includes('এসএসসি') || tokens.includes('দাখিল')) {
      return 'ssc';
    }
    if (tokens.includes('hsc') || tokens.includes('alim') || tokens.includes('এইচএসসি') || tokens.includes('আলিম')) {
      return 'hsc';
    }
    if (
      tokens.includes('graduation') ||
      tokens.includes('honours') ||
      tokens.includes('bachelor') ||
      tokens.includes('degree') ||
      tokens.includes('স্নাতক')
    ) {
      return 'graduation';
    }
    if (tokens.includes('masters') || tokens.includes('postgraduate') || tokens.includes('মাস্টার্স')) {
      return 'masters';
    }
    return null;
  }

  private static generateFieldSlug(text: string): string {
    const clean = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return clean || 'field';
  }

  private static slugToTitleCase(slug: string): string {
    return slug
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  private static inferCustomCategory(tokens: string): CustomFieldCategory {
    if (
      tokens.includes('skill') ||
      tokens.includes('typing') ||
      tokens.includes('computer') ||
      tokens.includes('language') ||
      tokens.includes('দক্ষতা')
    ) {
      return 'skills';
    }
    if (
      tokens.includes('training') ||
      tokens.includes('course') ||
      tokens.includes('certificate') ||
      tokens.includes('প্রশিক্ষণ')
    ) {
      return 'education';
    }
    if (tokens.includes('company') || tokens.includes('organization') || tokens.includes('work')) {
      return 'experience';
    }
    if (tokens.includes('location') || tokens.includes('area') || tokens.includes('thana')) {
      return 'address';
    }
    if (tokens.includes('family') || tokens.includes('brother') || tokens.includes('sister')) {
      return 'family';
    }
    return 'personal';
  }

  private static inferDataType(element: HTMLElement): CustomFieldDataType {
    if (element instanceof HTMLSelectElement) return 'select';
    if (element instanceof HTMLInputElement) {
      const type = element.type.toLowerCase();
      if (type === 'number') return 'number';
      if (type === 'date') return 'date';
      if (type === 'checkbox') return 'boolean';
    }
    return 'text';
  }
}
