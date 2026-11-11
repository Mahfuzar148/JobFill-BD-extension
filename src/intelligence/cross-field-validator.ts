// JobFill BD - Final Intelligence Add-on 1: Cross-Field Consistency Intelligence
// Analyzes relationships between profile fields to catch chronological impossibilities,
// mobile mismatches, age discrepancies, and educational timeline conflicts.
// Never modifies data silently; emits structured warnings and requests user review.

import { UserProfile } from '../types/profile';
import { ValueNormalizer } from './value-normalizer';

export interface ConsistencyIssue {
  severity: 'CRITICAL_ERROR' | 'WARNING' | 'INFO';
  fieldKeys: string[];
  titleEn: string;
  titleBn: string;
  messageEn: string;
  messageBn: string;
  suggestedActionEn: string;
  suggestedActionBn: string;
}

export class CrossFieldValidator {
  public static validate(profile: UserProfile): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];

    // 1. Mobile vs Confirm Mobile Equality
    if (profile.personal.mobile && profile.personal.confirmMobile) {
      const normMob1 = ValueNormalizer.normalizeMobileNumber(profile.personal.mobile);
      const normMob2 = ValueNormalizer.normalizeMobileNumber(profile.personal.confirmMobile);
      if (normMob1 !== normMob2) {
        issues.push({
          severity: 'CRITICAL_ERROR',
          fieldKeys: ['personal.mobile', 'personal.confirmMobile'],
          titleEn: 'Mobile Numbers Do Not Match',
          titleBn: 'মোবাইল নম্বর দুটি মিলছে না',
          messageEn: `Mobile number (${normMob1}) is different from confirmation number (${normMob2}).`,
          messageBn: `মূল মোবাইল নম্বর (${normMob1}) এবং কনফার্মেশন নম্বর (${normMob2}) আলাদা।`,
          suggestedActionEn: 'Ensure both mobile number fields are identical.',
          suggestedActionBn: 'উভয় ফিল্ডে একই মোবাইল নম্বর দিন।',
        });
      }
    }

    // 2. Date of Birth and Age Consistency
    if (profile.personal.dob) {
      const dob = new Date(profile.personal.dob);
      if (!isNaN(dob.getTime())) {
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
          age--;
        }

        if (age < 18) {
          issues.push({
            severity: 'CRITICAL_ERROR',
            fieldKeys: ['personal.dob'],
            titleEn: 'Applicant Under 18 Years Old',
            titleBn: 'আবেদনকারীর বয়স ১৮ বছরের কম',
            messageEn: `Calculated age is ${age} years. Bangladesh govt job circulars require minimum 18 years.`,
            messageBn: `হিসাব অনুযায়ী বয়স ${age} বছর। সরকারি চাকরিতে আবেদনের ন্যূনতম বয়স ১৮ বছর হতে হবে।`,
            suggestedActionEn: 'Verify your Date of Birth in the profile.',
            suggestedActionBn: 'প্রোফাইলে জন্ম তারিখ যাচাই করুন।',
          });
        } else if (age > 45) {
          issues.push({
            severity: 'WARNING',
            fieldKeys: ['personal.dob'],
            titleEn: 'Applicant Over Standard Age Limit',
            titleBn: 'আবেদনকারীর বয়স সাধারণ চাকরি সীমা অতিক্রম করেছে',
            messageEn: `Calculated age is ${age} years. Verify if special quota or departmental relaxation applies.`,
            messageBn: `হিসাব অনুযায়ী বয়স ${age} বছর। কোটা বা বিভাগীয় প্রার্থীর শিথিলতা প্রযোজ্য কিনা দেখুন।`,
            suggestedActionEn: 'Check circular eligibility criteria.',
            suggestedActionBn: 'নিয়োগ বিজ্ঞপ্তির বয়সসীমা শর্তাবলি যাচাই করুন।',
          });
        }
      }
    }

    // 3. Educational Chronological Passing Years Order
    // SSC -> HSC -> Graduation -> Masters
    const sscYear = parseInt(ValueNormalizer.toEnglishNumerals(profile.ssc?.passingYear || ''), 10);
    const hscYear = parseInt(ValueNormalizer.toEnglishNumerals(profile.hsc?.passingYear || ''), 10);
    const gradYear = parseInt(
      ValueNormalizer.toEnglishNumerals(profile.graduation?.passingYear || ''),
      10
    );
    const mastersYear = parseInt(
      ValueNormalizer.toEnglishNumerals(profile.masters?.passingYear || ''),
      10
    );

    // SSC vs HSC
    if (sscYear && hscYear) {
      if (hscYear <= sscYear) {
        issues.push({
          severity: 'CRITICAL_ERROR',
          fieldKeys: ['ssc.passingYear', 'hsc.passingYear'],
          titleEn: 'HSC Passing Year Must Be After SSC',
          titleBn: 'এইচএসসি পাসের সন এসএসসির পরে হতে হবে',
          messageEn: `HSC passing year (${hscYear}) cannot be equal to or earlier than SSC passing year (${sscYear}).`,
          messageBn: `এইচএসসি পাসের সন (${hscYear}) এসএসসি পাসের সন (${sscYear})-এর সমান বা আগের হতে পারে না।`,
          suggestedActionEn: 'Correct the passing year in Education tab.',
          suggestedActionBn: 'শিক্ষাগত যোগ্যতা ট্যাবে পাসের সন ঠিক করুন।',
        });
      } else if (hscYear - sscYear < 2) {
        issues.push({
          severity: 'WARNING',
          fieldKeys: ['ssc.passingYear', 'hsc.passingYear'],
          titleEn: 'HSC Passing Year Too Close to SSC',
          titleBn: 'এসএসসি ও এইচএসসির ব্যবধান স্বাভাবিকের চেয়ে কম',
          messageEn: `HSC was passed only ${hscYear - sscYear} year after SSC (Standard is 2 years).`,
          messageBn: `এসএসসির মাত্র ${hscYear - sscYear} বছর পরই এইচএসসি পাস দেখানো হয়েছে (স্বাভাবিক ব্যবধান ২ বছর)।`,
          suggestedActionEn: 'Verify if you passed through open university or special program.',
          suggestedActionBn: 'উন্মুক্ত বিশ্ববিদ্যালয় বা বিশেষ প্রোগ্রাম কিনা নিশ্চিত করুন।',
        });
      }
    }

    // HSC vs Graduation
    if (hscYear && gradYear) {
      if (gradYear <= hscYear) {
        issues.push({
          severity: 'CRITICAL_ERROR',
          fieldKeys: ['hsc.passingYear', 'graduation.passingYear'],
          titleEn: 'Graduation Passing Year Must Be After HSC',
          titleBn: 'স্নাতক পাসের সন এইচএসসির পরে হতে হবে',
          messageEn: `Graduation passing year (${gradYear}) cannot be earlier than or equal to HSC (${hscYear}).`,
          messageBn: `স্নাতক পাসের সন (${gradYear}) এইচএসসি (${hscYear})-এর আগের বা সমান হতে পারে না।`,
          suggestedActionEn: 'Correct graduation passing year.',
          suggestedActionBn: 'স্নাতক পাসের সন সংশোধন করুন।',
        });
      }
    }

    // Graduation vs Masters
    if (gradYear && mastersYear) {
      if (mastersYear <= gradYear) {
        issues.push({
          severity: 'CRITICAL_ERROR',
          fieldKeys: ['graduation.passingYear', 'masters.passingYear'],
          titleEn: 'Masters Passing Year Must Be After Graduation',
          titleBn: 'মাস্টার্স পাসের সন স্নাতকের পরে হতে হবে',
          messageEn: `Masters passing year (${mastersYear}) cannot be earlier than or equal to Graduation (${gradYear}).`,
          messageBn: `মাস্টার্স পাসের সন (${mastersYear}) স্নাতক (${gradYear})-এর আগের বা সমান হতে পারে না।`,
          suggestedActionEn: 'Correct masters passing year.',
          suggestedActionBn: 'মাস্টার্স পাসের সন সংশোধন করুন।',
        });
      }
    }

    // 4. Address Completeness
    if (profile.address.present) {
      if (!profile.address.present.district || !profile.address.present.upazila) {
        issues.push({
          severity: 'WARNING',
          fieldKeys: ['address.present.district', 'address.present.upazila'],
          titleEn: 'Incomplete Present Address',
          titleBn: 'বর্তমান ঠিকানায় জেলা বা উপজেলা বাকি',
          messageEn: 'Present District and Upazila are mandatory on almost all recruitment portals.',
          messageBn: 'সরকারি চাকরির সব পোর্টালে বর্তমান জেলা ও উপজেলা দেওয়া বাধ্যতামূলক।',
          suggestedActionEn: 'Fill District and Upazila in Address tab.',
          suggestedActionBn: 'ঠিকানা ট্যাবে জেলা ও উপজেলা নির্বাচন করুন।',
        });
      }
    }

    return issues;
  }
}
