// JobFill BD - Form-Level & Cross-Field Consistency Validator
// Implements Section 19 of Master Specification:
// Cross-field validation between personal, academic, address, and employment records.

import { UserProfile } from '../types/profile';
import { FieldValidator } from './field-validator';

export interface FormValidationIssue {
  field: string;
  fieldBn: string;
  type: 'error' | 'warning';
  message: string;
  messageBn: string;
}

export interface ProfileValidationReport {
  isValid: boolean;
  scorePercentage: number;
  totalErrors: number;
  totalWarnings: number;
  issues: FormValidationIssue[];
}

export class FormValidator {
  public static validateProfile(profile: UserProfile): ProfileValidationReport {
    const issues: FormValidationIssue[] = [];

    // 1. Personal Names
    if (!profile.personal.applicantNameEn.trim()) {
      issues.push({
        field: 'applicantNameEn',
        fieldBn: 'আবেদনকারীর নাম (ইংরেজি)',
        type: 'error',
        message: 'Applicant name in English is required',
        messageBn: 'আবেদনকারীর ইংরেজি নাম আবশ্যক',
      });
    }

    if (!profile.personal.applicantNameBn.trim()) {
      issues.push({
        field: 'applicantNameBn',
        fieldBn: 'আবেদনকারীর নাম (বাংলা)',
        type: 'warning',
        message: 'Applicant name in Bengali is recommended for PetroBangla / Teletalk forms',
        messageBn: 'পেট্রোবাংলা ও টেলিটক ফর্মে বাংলা নাম থাকা প্রয়োজন',
      });
    }

    // 2. Mobile & Confirm Mobile Check
    const mobileCheck = FieldValidator.validateMobile(profile.personal.mobile);
    if (!mobileCheck.isValid) {
      issues.push({
        field: 'mobile',
        fieldBn: 'মোবাইল নম্বর',
        type: 'error',
        message: mobileCheck.error || 'Invalid mobile number',
        messageBn: mobileCheck.errorBn || 'সঠিক মোবাইল নম্বর দিন',
      });
    }

    // 3. Date of Birth & Age Limit
    const dobCheck = FieldValidator.validateDOB(profile.personal.dob);
    if (!dobCheck.isValid) {
      issues.push({
        field: 'dob',
        fieldBn: 'জন্ম তারিখ',
        type: 'error',
        message: dobCheck.error || 'Invalid date of birth',
        messageBn: dobCheck.errorBn || 'সঠিক জন্ম তারিখ দিন',
      });
    }

    // 4. Identity Document (At least NID or Birth Reg is required)
    const hasNID = Boolean(profile.personal.nid && profile.personal.nid.trim());
    const hasBirthReg = Boolean(profile.personal.birthReg && profile.personal.birthReg.trim());
    if (!hasNID && !hasBirthReg) {
      issues.push({
        field: 'identity',
        fieldBn: 'জাতীয় পরিচয়পত্র / জন্ম নিবন্ধন',
        type: 'error',
        message: 'Either National ID (NID) or Birth Registration is mandatory',
        messageBn: 'এনআইডি অথবা জন্ম নিবন্ধন নম্বরের যেকোনো একটি অবশ্যই দিতে হবে',
      });
    }

    // 5. Marital Status & Spouse Name
    if (profile.personal.maritalStatus === 'Married') {
      if (!profile.personal.spouseNameEn.trim() && !profile.personal.spouseNameBn?.trim()) {
        issues.push({
          field: 'spouseName',
          fieldBn: 'স্বামী/স্ত্রীর নাম',
          type: 'warning',
          message: 'Spouse name is required when marital status is Married',
          messageBn: 'বৈবাহিক অবস্থা বিবাহিত হলে স্বামী/স্ত্রীর নাম আবশ্যক',
        });
      }
    }

    // 6. Chronological Passing Years (SSC <= HSC <= Graduation <= Masters)
    const sscYear = parseInt(profile.ssc.passingYear, 10);
    const hscYear = parseInt(profile.hsc.passingYear, 10);
    const gradYear = parseInt(profile.graduation.passingYear, 10);
    const masYear = parseInt(profile.masters.passingYear, 10);

    if (sscYear && hscYear && hscYear < sscYear + 2) {
      issues.push({
        field: 'hscPassingYear',
        fieldBn: 'এইচএসসি পাসের বছর',
        type: 'error',
        message: `HSC passing year (${hscYear}) cannot be earlier than SSC + 2 years (${sscYear + 2})`,
        messageBn: `এইচএসসি পাসের বছর (${hscYear}) এসএসসি (${sscYear}) এর চেয়ে অন্তত ২ বছর বেশি হতে হবে`,
      });
    }

    if (profile.hasGraduation && hscYear && gradYear && gradYear < hscYear + 3) {
      issues.push({
        field: 'gradPassingYear',
        fieldBn: 'স্নাতক পাসের বছর',
        type: 'warning',
        message: `Graduation passing year (${gradYear}) is typically at least 3 years after HSC (${hscYear})`,
        messageBn: `স্নাতক পাসের বছর (${gradYear}) সাধারণত এইচএসসি (${hscYear}) এর ৩ বা ৪ বছর পর হয়`,
      });
    }

    if (profile.hasMasters && gradYear && masYear && masYear < gradYear + 1) {
      issues.push({
        field: 'mastersPassingYear',
        fieldBn: 'মাস্টার্স পাসের বছর',
        type: 'warning',
        message: `Masters passing year (${masYear}) cannot be earlier than Graduation (${gradYear})`,
        messageBn: `মাস্টার্স পাসের বছর (${masYear}) স্নাতক পাসের বছরের চেয়ে কম হতে পারে না`,
      });
    }

    // 7. Employment Start & End Dates
    if (profile.hasJobExperience && profile.jobExperiences) {
      profile.jobExperiences.forEach((job, idx) => {
        if (!job.currentlyWorking && job.startDate && job.endDate) {
          if (new Date(job.startDate) > new Date(job.endDate)) {
            issues.push({
              field: `jobExperience[${idx}]`,
              fieldBn: `চাকরির অভিজ্ঞতা #${idx + 1}`,
              type: 'error',
              message: `Job start date (${job.startDate}) cannot be after end date (${job.endDate})`,
              messageBn: `চাকরি শুরুর তারিখ (${job.startDate}) শেষ তারিখ (${job.endDate}) এর পরে হতে পারে না`,
            });
          }
        }
      });
    }

    // 8. Address Verification
    if (!profile.address.present.district.trim()) {
      issues.push({
        field: 'presentDistrict',
        fieldBn: 'বর্তমান জেলা',
        type: 'error',
        message: 'Present District is required for applicant communication',
        messageBn: 'বর্তমান জেলা আবশ্যক',
      });
    }

    if (!profile.address.permanent.district.trim() && !profile.address.sameAsPresent) {
      issues.push({
        field: 'permanentDistrict',
        fieldBn: 'স্থায়ী জেলা',
        type: 'error',
        message: 'Permanent District is required for home quota evaluation',
        messageBn: 'নিজ জেলা বা কোটা মূল্যায়নের জন্য স্থায়ী জেলা আবশ্যক',
      });
    }

    const errorCount = issues.filter((i) => i.type === 'error').length;
    const warningCount = issues.filter((i) => i.type === 'warning').length;

    // Calculate score: starts at 100, minus 15 per error, minus 5 per warning
    const rawScore = Math.max(0, 100 - errorCount * 15 - warningCount * 5);

    return {
      isValid: errorCount === 0,
      scorePercentage: rawScore,
      totalErrors: errorCount,
      totalWarnings: warningCount,
      issues,
    };
  }
}
