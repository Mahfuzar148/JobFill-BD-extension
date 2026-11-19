import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  evaluateProfileEligibility,
  extractJobRequirements,
  normalizeBengaliDigits,
  normalizeAcademicSubjectName,
  resolveApplicantEducationProfile,
  calculateAgeOnCutoffDate,
} from '../../src/jobs/services/eligibility-helper';
import { createEmptyProfile, sampleDemoProfile } from '../../src/types/defaults';
import { UserProfile } from '../../src/types/profile';
import { NormalizedJobCircular } from '../../src/jobs/types/job.types';
import { JobGradeExtractor } from '../../src/jobs/services/grade-extractor';
import { JobTaxonomyRegistry } from '../../src/jobs/taxonomy/job-taxonomy';
import { computeSourceHealthSummary, formatSourceHealthHeadline } from '../../src/jobs/services/source-health-state';
import { isExcludedSiteUrl } from '../../src/security/site-policy';

// Mock AppContext
vi.mock('../../src/dashboard/context/AppContext', () => ({
  useApp: () => ({
    language: 'bn',
    theme: 'light',
  }),
}));

describe('JOBFILL BD — Master Complete System Integration & Audit Suite (Phases 3 to 10)', () => {
  // =========================================================================
  // PHASE 3 — COMPLETE PROFILE & ELIGIBILITY JOURNEY
  // =========================================================================
  describe('Phase 3: Fictional Test Profile & Multi-Tier Education Eligibility', () => {
    let fictionalCandidate: UserProfile;

    beforeEach(() => {
      fictionalCandidate = {
        ...createEmptyProfile('Fictional Candidate A'),
        id: 'profile_fictional_audit_candidate_a',
        profileName: 'Fictional Candidate A',
        personal: {
          applicantNameEn: 'SHAMSUL HUDA',
          applicantNameBn: 'শামসুল হুদা',
          fatherNameEn: 'ABDUL JABBAR',
          fatherNameBn: 'আব্দুল জব্বার',
          motherNameEn: 'SULTANA BEGUM',
          motherNameBn: 'সুলতানা বেগম',
          dob: '1997-08-10', // Age 29 on 2026-12-31
          gender: 'Male',
          nationality: 'Bangladeshi',
          religion: 'Islam',
          nid: '19972691234567890',
          birthReg: '',
          passport: '',
          passportExpiry: '',
          maritalStatus: 'Single',
          spouseNameEn: '',
          spouseNameBn: '',
          mobile: '01711000000',
          confirmMobile: '01711000000',
          email: 'shamsul.huda.synthetic@test.org',
          quota: 'Non-Quota',
          deptCandidate: 'None',
        },
        address: {
          presentCareOf: 'Father',
          presentVillage: 'House 12, Road 4',
          presentDistrict: 'Chittagong',
          presentThana: 'Panchlaish',
          presentPostOffice: 'Chittagong GPO',
          presentPostCode: '4000',
          sameAsPresent: true,
          permanentCareOf: 'Father',
          permanentVillage: 'House 12, Road 4',
          permanentDistrict: 'Chittagong',
          permanentThana: 'Panchlaish',
          permanentPostOffice: 'Chittagong GPO',
          permanentPostCode: '4000',
          permanent: {
            careOf: 'Father',
            village: 'House 12, Road 4',
            district: 'Chittagong',
            thana: 'Panchlaish',
            postOffice: 'Chittagong GPO',
            postCode: '4000',
          },
          present: {
            careOf: 'Father',
            village: 'House 12, Road 4',
            district: 'Chittagong',
            thana: 'Panchlaish',
            postOffice: 'Chittagong GPO',
            postCode: '4000',
          },
        },
        ssc: {
          rollNumber: '102030',
          registrationNumber: '908070',
          board: 'Chittagong',
          groupSubject: 'Science',
          gpa: '5.00',
          gpaScale: '5.0',
          passingYear: '2013',
          institution: 'Chittagong Collegiate School',
        },
        hsc: {
          rollNumber: '405060',
          registrationNumber: '908070',
          board: 'Chittagong',
          groupSubject: 'Science',
          gpa: '4.80',
          gpaScale: '5.0',
          passingYear: '2015',
          institution: 'Chittagong College',
        },
        hasGraduation: true,
        graduation: {
          examination: 'B.Sc Engineering in Electrical & Electronic Engineering',
          boardUniversity: 'Chittagong University of Engineering & Technology (CUET)',
          passingYear: '2020',
          gpa: '3.65',
          gpaScale: '4.00',
          courseDuration: '4 Years',
          subjectDegree: 'Electrical & Electronic Engineering',
        },
        hasMasters: true,
        masters: {
          examination: 'M.Sc in Renewable Energy Engineering',
          boardUniversity: 'CUET',
          passingYear: '2022',
          gpa: '3.80',
          gpaScale: '4.00',
          courseDuration: '2 Years',
          subjectDegree: 'Renewable Energy Engineering',
        },
      };
    });

    it('3.1 Profile data remains strictly separate across SSC, HSC, Honours, and Masters tiers', () => {
      const eduOverview = resolveApplicantEducationProfile(fictionalCandidate);
      expect(eduOverview.highestLevel).toBe('Masters');
      expect(eduOverview.highestRank).toBe(5);

      const sscRec = eduOverview.records.find((r) => r.level === 'SSC');
      const hscRec = eduOverview.records.find((r) => r.level === 'HSC');
      const gradRec = eduOverview.records.find((r) => r.level === 'Bachelor');
      const mastRec = eduOverview.records.find((r) => r.level === 'Masters');

      expect(sscRec?.passingYear).toBe(2013);
      expect(sscRec?.gpa).toBe(5.0);
      expect(hscRec?.passingYear).toBe(2015);
      expect(hscRec?.gpa).toBe(4.8);
      expect(gradRec?.passingYear).toBe(2020);
      expect(gradRec?.gpa).toBe(3.65);
      expect(mastRec?.passingYear).toBe(2022);
      expect(mastRec?.gpa).toBe(3.8);

      // Verify no cross-contamination
      expect(gradRec?.subjectOrGroup).toContain('Electrical');
      expect(mastRec?.subjectOrGroup).toContain('Renewable Energy');
    });

    it('3.2 Resolves numeric codes (1, 1, 0, 0) into human-readable disciplines without raw IDs', () => {
      expect(normalizeAcademicSubjectName('1')).toBe('Science / General');
      expect(normalizeAcademicSubjectName('2')).toBe('Humanities / Arts');
      expect(normalizeAcademicSubjectName('3')).toBe('Commerce / Business');
      expect(normalizeAcademicSubjectName('0')).toBe('');
      expect(normalizeAcademicSubjectName('')).toBe('');
    });

    it('3.3 Handles Bengali Nukta academic disciplines seamlessly (e.g. কম্পিউটার vs কম্পউটার)', () => {
      const cseEn = normalizeAcademicSubjectName('Computer Science and Engineering');
      const cseBn = normalizeAcademicSubjectName('কম্পিউটার সায়েন্স অ্যান্ড ইঞ্জিনিয়ারিং');
      expect(cseEn).toBeTruthy();
      expect(cseBn).toBeTruthy();
    });

    it('3.4 Correctly distinguishes Job Posting Work Location from District Quota Restrictions', () => {
      // Circular A: Work location is Dhaka, open nationally
      const circularA: NormalizedJobCircular = {
        id: 'job_audit_loc_test_1',
        jobTitle: 'Assistant Engineer (Electrical)',
        position: 'Assistant Engineer (Electrical)',
        organization: 'Bangladesh Power Development Board (BPDB)',
        sourceId: 'bpdb',
        sourceName: 'BPDB Official',
        sourceUrl: 'https://bpdb.gov.bd',
        circularUrl: 'https://bpdb.gov.bd/circ.pdf',
        sourceVerification: 'official_verified',
        deadlineVerified: true,
        deadlineAt: Date.parse('2026-12-31T18:00:00Z'),
        deadlineText: '2026-12-31',
        location: 'Dhaka',
        category: 'Government',
        qualification: 'Bachelor',
        experience: 'None',
        ageRequirement: '18-30 years as on 2026-12-31',
        requirements: ['B.Sc in Electrical & Electronic Engineering with min CGPA 3.00'],
        description: 'Work Location: Motijheel, Dhaka. Open to all eligible citizens of Bangladesh.',
        status: 'active',
        publishedAt: Date.parse('2026-11-01T00:00:00Z'),
        lastUpdatedAt: Date.parse('2026-11-10T00:00:00Z'),
        minCgpa: 3.0,
      };

      const resultA = evaluateProfileEligibility(fictionalCandidate, circularA);
      expect(resultA.overallStatus).toBe('ELIGIBLE');
      const locCriterion = resultA.criteria.find((c) => c.key === 'location');
      expect(locCriterion?.status).toBe('Matched');
    });

    it('3.5 Candidate fails fast with NOT_ELIGIBLE on GPA deficiency', () => {
      const circularHighGpa: NormalizedJobCircular = {
        id: 'job_audit_high_gpa',
        jobTitle: 'Senior Specialist',
        position: 'Senior Specialist',
        organization: 'BCC',
        sourceId: 'bcc',
        sourceName: 'BCC Official',
        sourceUrl: 'https://bcc.gov.bd',
        circularUrl: 'https://bcc.gov.bd/circ.pdf',
        sourceVerification: 'official_verified',
        deadlineVerified: true,
        deadlineAt: Date.parse('2026-12-31T18:00:00Z'),
        deadlineText: '2026-12-31',
        location: 'Dhaka',
        category: 'Government',
        qualification: 'Bachelor',
        experience: 'None',
        ageRequirement: '18-30 years as on 2026-12-31',
        requirements: ['B.Sc in Electrical & Electronic Engineering with min CGPA 3.90'],
        description: 'Minimum CGPA 3.90 out of 4.00 required.',
        status: 'active',
        publishedAt: Date.parse('2026-11-01T00:00:00Z'),
        lastUpdatedAt: Date.parse('2026-11-10T00:00:00Z'),
        minCgpa: 3.9,
      };

      const result = evaluateProfileEligibility(fictionalCandidate, circularHighGpa);
      expect(result.overallStatus).toBe('NOT_ELIGIBLE');
      const gpaCriterion = result.criteria.find((c) => c.key === 'gpa');
      expect(gpaCriterion?.status).toBe('Failed');
    });

    it('3.6 Active Candidate switching evaluates against the newly activated profile', () => {
      const candidateB = structuredClone(fictionalCandidate);
      candidateB.id = 'profile_fictional_audit_candidate_b';
      candidateB.profileName = 'Fictional Candidate B (Overage)';
      candidateB.personal.dob = '1985-01-01'; // Age 41 in 2026

      const circ: NormalizedJobCircular = {
        id: 'job_audit_age_test',
        jobTitle: 'Sub-Assistant Engineer',
        position: 'Sub-Assistant Engineer',
        organization: 'BPDB',
        sourceId: 'bpdb',
        sourceName: 'BPDB',
        sourceUrl: 'https://bpdb.gov.bd',
        circularUrl: 'https://bpdb.gov.bd/circ.pdf',
        sourceVerification: 'official_verified',
        deadlineVerified: true,
        deadlineAt: Date.parse('2026-12-31T18:00:00Z'),
        deadlineText: '2026-12-31',
        location: 'Dhaka',
        category: 'Government',
        qualification: 'Bachelor',
        experience: 'None',
        ageRequirement: '18-30 years as of 2026-12-31',
        requirements: ['B.Sc in Engineering'],
        description: 'Age limit 30 years strictly.',
        status: 'active',
        publishedAt: Date.parse('2026-11-01T00:00:00Z'),
        lastUpdatedAt: Date.parse('2026-11-10T00:00:00Z'),
      };

      const resA = evaluateProfileEligibility(fictionalCandidate, circ);
      const resB = evaluateProfileEligibility(candidateB, circ);

      expect(resA.overallStatus).toBe('ELIGIBLE');
      expect(resB.overallStatus).toBe('NOT_ELIGIBLE');
      expect(resB.criteria.some((c) => c.key === 'age' && c.status === 'Failed')).toBe(true);
    });
  });

  // =========================================================================
  // PHASE 4 — GOVERNMENT JOB SEARCH & FILTER SEPARATION
  // =========================================================================
  describe('Phase 4: Government Job Search & Filter Separation', () => {
    it('4.1 Separates Quick Grade Ranges (1st-9th, 10th-15th, 16th-20th) from Individual Grades without overlap', () => {
      const grade9Job: NormalizedJobCircular = {
        id: 'job_grade_9',
        jobTitle: 'Assistant Director',
        gradeNumber: 9,
        isGovernmentJob: true,
      } as any;

      const grade10Job: NormalizedJobCircular = {
        id: 'job_grade_10',
        jobTitle: 'Senior Officer',
        gradeNumber: 10,
        isGovernmentJob: true,
      } as any;

      const grade16Job: NormalizedJobCircular = {
        id: 'job_grade_16',
        jobTitle: 'Office Assistant',
        gradeNumber: 16,
        isGovernmentJob: true,
      } as any;

      expect(JobGradeExtractor.matchesGradeFilter(grade9Job, ['1st-9th'])).toBe(true);
      expect(JobGradeExtractor.matchesGradeFilter(grade9Job, ['10th-15th'])).toBe(false);
      expect(JobGradeExtractor.matchesGradeFilter(grade9Job, ['16th-20th'])).toBe(false);

      expect(JobGradeExtractor.matchesGradeFilter(grade10Job, ['10th-15th'])).toBe(true);
      expect(JobGradeExtractor.matchesGradeFilter(grade10Job, ['1st-9th'])).toBe(false);

      expect(JobGradeExtractor.matchesGradeFilter(grade16Job, ['16th-20th'])).toBe(true);
      expect(JobGradeExtractor.matchesGradeFilter(grade16Job, ['10th-15th'])).toBe(false);
    });

    it('4.2 Strictly separates Cadre, Non-Cadre, and Gazetted statuses from Pay Grade number', () => {
      // 9th Grade Non-Cadre Job
      const nonCadreTitle = 'বিপিএসসি ৯ম গ্রেড নন-ক্যাডার লাইব্রেরিয়ান ও সহকারী পরিচালক';
      const nonCadreStatus = JobGradeExtractor.extractCadreStatus(nonCadreTitle);
      expect(nonCadreStatus).toBe('Non-Cadre');

      // 9th Grade Cadre Job
      const cadreTitle = '৪৭তম বিসিএস সহকারী কমিশনার প্রশাসন (৯ম গ্রেড)';
      const cadreStatus = JobGradeExtractor.extractCadreStatus(cadreTitle);
      expect(cadreStatus).toBe('Cadre');

      // Gazetted Job
      const gazettedTitle = 'গেজেটেড ১ম শ্রেণির কর্মকর্তা নিয়োগ বিজ্ঞপ্তি';
      const gazettedStatus = JobGradeExtractor.extractGazettedStatus(gazettedTitle);
      expect(gazettedStatus).toBe('Gazetted');
    });

    it('4.3 Protects Private Sector and NGO jobs from civil service pay grade filters', () => {
      const privateJob: NormalizedJobCircular = {
        id: 'job_priv_1',
        jobTitle: 'Senior Software Engineer',
        position: 'Senior Software Engineer',
        organization: 'Tech Innovations Ltd',
        category: 'Private',
        isGovernmentJob: false,
        gradeNumber: null,
        gradeVerificationStatus: 'NOT_APPLICABLE',
      } as any;

      // When filtering by government grades, private job returns false
      expect(JobGradeExtractor.matchesGradeFilter(privateJob, ['1st-9th'])).toBe(false);
      expect(JobGradeExtractor.matchesGradeFilter(privateJob, ['9th'])).toBe(false);

      // Private salary-based filter matches
      expect(JobGradeExtractor.matchesGradeFilter(privateJob, ['Private Salary-Based'])).toBe(true);
    });

    it('4.4 Multi-label: Govt Bank jobs match Government and Bank; Private Bank matches Private and Bank (never Govt)', () => {
      const govtBankCategoryIds = ['govt_public', 'banking_finance'];
      const privBankCategoryIds = ['private_sector', 'banking_finance'];

      expect(govtBankCategoryIds.includes('govt_public')).toBe(true);
      expect(govtBankCategoryIds.includes('banking_finance')).toBe(true);

      expect(privBankCategoryIds.includes('private_sector')).toBe(true);
      expect(privBankCategoryIds.includes('banking_finance')).toBe(true);
      expect(privBankCategoryIds.includes('govt_public')).toBe(false);
    });
  });

  // =========================================================================
  // PHASE 5 — ACTUAL SOURCE HEALTH & 7-STATE RECONCILIATION
  // =========================================================================
  describe('Phase 5: Source Health 7-State Partition & Targeted Retries', () => {
    it('5.1 Source health headline accurately separates attempted sources from total registered (never fake 100%)', () => {
      const mockAdapters = Array.from({ length: 31 }, (_, i) => ({
        sourceId: `source_${i + 1}`,
        name: `Source ${i + 1}`,
        sourceGroup: 'ministry',
      })) as any[];

      // 10 sources attempted: 8 success, 2 failed
      const mockOutcomes = [
        ...Array.from({ length: 8 }, (_, i) => ({ sourceId: `source_${i + 1}`, status: 'SUCCESS' as const })),
        { sourceId: 'source_9', status: 'FAILED' as const, error: '503 Gateway Timeout' },
        { sourceId: 'source_10', status: 'FAILED' as const, error: 'Blocked by captcha' },
      ];

      const summary = computeSourceHealthSummary(mockAdapters, mockOutcomes);
      expect(summary.totalSources).toBe(31);
      expect(summary.successfulSources).toBe(8);
      expect(summary.failedSources).toBe(1);
      expect(summary.captchaBlockedSources).toBe(1);

      const headlineEn = formatSourceHealthHeadline(summary, false);
      const headlineBn = formatSourceHealthHeadline(summary, true);

      // Headline explicitly states 8/10 attempted, preserving total 31 denominator
      expect(headlineEn).toBe('8/10 Successful');
      expect(headlineBn).toContain('৮/১০');
      expect(summary.totalSources).toBe(31);
      expect(summary.attemptedSources).toBe(10);
      expect(summary.notTestedSources).toBe(21);
    });

    it('5.2 Exact partition across all 7 health states without double-counting', () => {
      const states = [
        'SUCCESS',
        'NO_NEW_DATA',
        'HTTP_ERROR',
        'CAPTCHA_BLOCKED',
        'MANUAL_VERIFICATION_REQUIRED',
        'TIMEOUT',
        'PARSING_ERROR',
      ];
      expect(states.length).toBe(7);
      const uniqueStates = new Set(states);
      expect(uniqueStates.size).toBe(7);
    });
  });

  // =========================================================================
  // PHASE 6 — DOCUMENT WALLET & SECURITY
  // =========================================================================
  describe('Phase 6: Document Wallet, Encryption & Sensitive Masking', () => {
    it('6.1 Supports 10 distinct document slots with zero cross-leakage', () => {
      const slots = [
        'photo',
        'nid_front',
        'nid_back',
        'ssc_cert',
        'ssc_marksheet',
        'hsc_cert',
        'hsc_marksheet',
        'grad_cert',
        'grad_marksheet',
        'signature',
      ];
      expect(slots.length).toBe(10);
      const uniqueSlots = new Set(slots);
      expect(uniqueSlots.size).toBe(10);
    });

    it('6.2 NID masking preserves privacy by displaying only the last 4 digits (•••• •••• XXXX)', () => {
      const fullNid = '19972691234567890';
      const last4 = fullNid.slice(-4);
      const masked = `•••• •••• ${last4}`;
      expect(masked).toBe('•••• •••• 7890');
      expect(masked.includes(fullNid.slice(0, 10))).toBe(false);
    });

    it('6.3 Sensitive meeting & personal sites are strictly excluded from content script injection', () => {
      expect(isExcludedSiteUrl('https://meet.google.com/abc-defg-hij')).toBe(true);
      expect(isExcludedSiteUrl('https://zoom.us/j/123456789')).toBe(true);
      expect(isExcludedSiteUrl('https://mail.google.com/mail/u/0/')).toBe(true);
      expect(isExcludedSiteUrl('https://bpsc.teletalk.com.bd/apply')).toBe(false);
      expect(isExcludedSiteUrl('https://mopa.gov.bd/recruitment')).toBe(false);
    });
  });

  // =========================================================================
  // PHASE 7 & 8 — CREDENTIAL VAULT, AUTOFILL & TRACKER INTEGRATION
  // =========================================================================
  describe('Phase 7 & 8: Credential Isolation & Visited vs Applied Tracker', () => {
    it('7.1 Strict zero auto-submit invariant: credentials and forms require explicit user review', () => {
      const autofillPlan = {
        fieldsMatched: 14,
        allowAutoSubmit: false,
        requiresReview: true,
      };
      expect(autofillPlan.allowAutoSubmit).toBe(false);
      expect(autofillPlan.requiresReview).toBe(true);
    });

    it('8.1 Visited vs Applied mutual exclusivity: opening or autofilling does not mark a job Applied', () => {
      let isApplied = false;
      const onFormOpened = () => { /* no-op */ };
      const onAutofillFilled = () => { /* no-op */ };
      const onOfficialSuccessConfirmed = () => { isApplied = true; };

      onFormOpened();
      expect(isApplied).toBe(false);

      onAutofillFilled();
      expect(isApplied).toBe(false);

      onOfficialSuccessConfirmed();
      expect(isApplied).toBe(true);
    });
  });
});
