import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  evaluateProfileEligibility,
  extractJobRequirements,
  normalizeBengaliDigits,
  normalizeAcademicSubjectName,
  resolveApplicantEducationProfile,
  calculateAgeOnCutoffDate,
} from '../../src/jobs/services/eligibility-helper';
import { createEmptyProfile, sampleDemoProfile } from '../../src/types/defaults';
import { NormalizedJobCircular } from '../../src/jobs/types/job.types';
import { EligibilityCheckerPage } from '../../src/dashboard/pages/EligibilityCheckerPage';
import { JobRepository } from '../../src/jobs/database/job-repository';

// Mock AppContext for testing UI components
vi.mock('../../src/dashboard/context/AppContext', () => ({
  useApp: () => ({
    language: 'bn',
    theme: 'light',
  }),
}));

function makeMockJob(overrides: Partial<NormalizedJobCircular> = {}): NormalizedJobCircular {
  return {
    id: 'job_test_cse_officer',
    jobTitle: 'Assistant Programmer',
    position: 'Assistant Programmer',
    organization: 'Bangladesh Computer Council (BCC)',
    sourceId: 'bcc',
    sourceName: 'BCC Official',
    sourceUrl: 'https://bcc.gov.bd',
    circularUrl: 'https://bcc.gov.bd/circular.pdf',
    applicationUrl: 'https://bcc.teletalk.com.bd',
    sourceVerification: 'official_verified',
    deadlineVerified: true,
    deadlineAt: Date.parse('2026-12-31T18:00:00Z'),
    deadlineText: '2026-12-31',
    location: 'Dhaka',
    category: 'Government',
    qualification: 'Bachelor',
    experience: 'No experience required',
    ageRequirement: '18-30 years as on 2026-12-31',
    requirements: ['Bachelor in Computer Science / CSE with minimum CGPA 3.00 out of 4.00'],
    description: 'Open to candidates from all districts across Bangladesh. Work location: Agargaon, Dhaka.',
    status: 'active',
    publishedAt: Date.parse('2026-11-01T00:00:00Z'),
    lastUpdatedAt: Date.parse('2026-11-10T00:00:00Z'),
    minGpa: 3.0,
    minCgpa: 3.0,
    deadlineTimezone: 'Asia/Dhaka',
    ...overrides,
  };
}

describe('JOBFILL BD — Intelligent Job Eligibility Checker Engine Suite', () => {
  it('1. Returns ELIGIBLE when candidate meets all academic, GPA, age, and location requirements', () => {
    const profile = structuredClone(sampleDemoProfile);
    profile.personal.dob = '1998-05-15'; // Age ~28 on 2026-12-31
    profile.hasGraduation = true;
    profile.graduation.examination = 'B.Sc in Computer Science and Engineering';
    profile.graduation.subjectDegree = 'Computer Science & Engineering';
    profile.graduation.gpa = '3.82';
    profile.graduation.gpaScale = '4.00';
    profile.address.permanent.district = 'Dhaka';

    const report = evaluateProfileEligibility(profile, makeMockJob());

    expect(report.overallStatus).toBe('ELIGIBLE');
    expect(report.failedCount).toBe(0);
    expect(report.missingProfileCount).toBe(0);

    const eduCrit = report.criteria.find((c) => c.key === 'education');
    expect(eduCrit?.status).toBe('Matched');
    expect(eduCrit?.profileValueText).toContain('Bachelor');

    const subjCrit = report.criteria.find((c) => c.key === 'subject');
    expect(subjCrit?.status).toBe('Matched');
    expect(subjCrit?.profileValueText).toContain('Computer Science');

    const gpaCrit = report.criteria.find((c) => c.key === 'gpa');
    expect(gpaCrit?.status).toBe('Matched');
    expect(gpaCrit?.profileValueText).toContain('3.82');

    const ageCrit = report.criteria.find((c) => c.key === 'age');
    expect(ageCrit?.status).toBe('Matched');

    const locCrit = report.criteria.find((c) => c.key === 'location');
    expect(locCrit?.status).toBe('Matched');
  });

  it('2. Properly honors Honours and Masters levels hierarchically without failing higher qualifications', () => {
    const profile = structuredClone(sampleDemoProfile);
    profile.personal.dob = '1998-02-10';
    profile.hasGraduation = true;
    profile.graduation.examination = 'Honours';
    profile.graduation.subjectDegree = 'Economics';
    profile.graduation.gpa = '3.40';

    profile.hasMasters = true;
    profile.masters.examination = 'Masters in Economics';
    profile.masters.subjectDegree = 'Economics';
    profile.masters.gpa = '3.75';
    profile.masters.gpaScale = '4.00';

    // Circular requiring Bachelor
    const bachelorJob = makeMockJob({
      qualification: 'Honours',
      requirements: ['Bachelor / Honours in Economics with minimum CGPA 2.50'],
    });

    const report = evaluateProfileEligibility(profile, bachelorJob);
    expect(report.overallStatus).toBe('ELIGIBLE');
    expect(report.candidateOverview.highestLevel).toBe('Masters');
    expect(report.criteria.find((c) => c.key === 'education')?.status).toBe('Matched');
  });

  it('3. Normalizes Teletalk numeric subject codes (1, 2, 3) and never renders cryptic 1, 1, 0, 0', () => {
    expect(normalizeAcademicSubjectName('1', 'SSC')).toBe('Science');
    expect(normalizeAcademicSubjectName('2', 'HSC')).toBe('Humanities');
    expect(normalizeAcademicSubjectName('3', 'SSC')).toBe('Business Studies');
    expect(normalizeAcademicSubjectName('0', 'Higher')).toBe('');

    const profile = structuredClone(sampleDemoProfile);
    profile.ssc.groupSubject = '1';
    profile.hsc.groupSubject = '1';
    profile.hasGraduation = true;
    profile.graduation.subjectDegree = '0';
    profile.hasMasters = false;

    const eduProfile = resolveApplicantEducationProfile(profile);
    const sscRec = eduProfile.records.find((r) => r.level === 'SSC');
    const hscRec = eduProfile.records.find((r) => r.level === 'HSC');

    expect(sscRec?.subjectOrGroup).toBe('Science');
    expect(hscRec?.subjectOrGroup).toBe('Science');
    expect(eduProfile.overview.sscText).toContain('Science');
    expect(eduProfile.overview.sscText).not.toContain('1, 1');
  });

  it('4. Returns NOT_ELIGIBLE when GPA/CGPA is below circular requirement', () => {
    const profile = structuredClone(sampleDemoProfile);
    profile.personal.dob = '1998-05-15';
    profile.hasGraduation = true;
    profile.graduation.examination = 'B.Sc in CSE';
    profile.graduation.subjectDegree = 'Computer Science';
    profile.graduation.gpa = '2.80'; // Required is 3.00
    profile.graduation.gpaScale = '4.00';

    const report = evaluateProfileEligibility(profile, makeMockJob());
    expect(report.overallStatus).toBe('NOT_ELIGIBLE');
    expect(report.failedCount).toBeGreaterThan(0);
    expect(report.criteria.find((c) => c.key === 'gpa')?.status).toBe('Failed');
  });

  it('5. Returns NOT_ELIGIBLE when academic subject/discipline does not match', () => {
    const profile = structuredClone(sampleDemoProfile);
    profile.personal.dob = '1998-05-15';
    profile.hasGraduation = true;
    profile.graduation.examination = 'B.A (Honours)';
    profile.graduation.subjectDegree = 'History & Islamic Civilization';
    profile.graduation.gpa = '3.80';
    profile.graduation.gpaScale = '4.00';

    const report = evaluateProfileEligibility(profile, makeMockJob());
    expect(report.overallStatus).toBe('NOT_ELIGIBLE');
    expect(report.criteria.find((c) => c.key === 'subject')?.status).toBe('Failed');
    expect(report.criteria.find((c) => c.key === 'subject')?.profileValueText).toContain('History');
  });

  it('6. Returns NOT_ELIGIBLE when candidate age exceeds max cutoff age', () => {
    const profile = structuredClone(sampleDemoProfile);
    // Born in 1990 -> on 2026-12-31 age is 36 years (exceeds max 30)
    profile.personal.dob = '1990-06-01';
    profile.hasGraduation = true;
    profile.graduation.examination = 'B.Sc in CSE';
    profile.graduation.subjectDegree = 'Computer Science';
    profile.graduation.gpa = '3.50';

    const report = evaluateProfileEligibility(profile, makeMockJob());
    expect(report.overallStatus).toBe('NOT_ELIGIBLE');
    expect(report.criteria.find((c) => c.key === 'age')?.status).toBe('Failed');
  });

  it('7. Returns NOT_ELIGIBLE when candidate age is below minimum age (underage)', () => {
    const profile = structuredClone(sampleDemoProfile);
    // Born in 2010 -> on 2026-12-31 age is 16 years (below min 18)
    profile.personal.dob = '2010-01-01';
    profile.hasGraduation = true;
    profile.graduation.examination = 'B.Sc in CSE';
    profile.graduation.subjectDegree = 'Computer Science';
    profile.graduation.gpa = '3.50';

    const report = evaluateProfileEligibility(profile, makeMockJob());
    expect(report.overallStatus).toBe('NOT_ELIGIBLE');
    expect(report.criteria.find((c) => c.key === 'age')?.status).toBe('Failed');
  });

  it('8. Returns NOT_ELIGIBLE when education level is below required (HSC applicant for Bachelor post)', () => {
    const profile = structuredClone(sampleDemoProfile);
    profile.personal.dob = '1998-05-15';
    profile.hasGraduation = false;
    profile.graduation.universityInstitute = '';
    profile.graduation.gpa = '';
    profile.graduation.subjectDegree = '';
    profile.hasMasters = false;

    const report = evaluateProfileEligibility(profile, makeMockJob());
    expect(report.overallStatus).toBe('NOT_ELIGIBLE');
    expect(report.criteria.find((c) => c.key === 'education')?.status).toBe('Failed');
  });

  it('9. Properly distinguishes job work location from candidate district quota', () => {
    const profile = structuredClone(sampleDemoProfile);
    profile.personal.dob = '1998-05-15';
    profile.hasGraduation = true;
    profile.graduation.examination = 'B.Sc in CSE';
    profile.graduation.subjectDegree = 'Computer Science';
    profile.graduation.gpa = '3.50';
    profile.address.permanent.district = 'Dhaka';

    // Case A: Work location is Rajshahi, but job is open nationally (no quota restriction)
    const rajshahiWorkJob = makeMockJob({
      location: 'Rajshahi',
      description: 'Job location is Rajshahi Office. Open to all districts.',
    });
    const repA = evaluateProfileEligibility(profile, rajshahiWorkJob);
    expect(repA.overallStatus).toBe('ELIGIBLE');
    expect(repA.criteria.find((c) => c.key === 'location')?.status).toBe('Matched');
    expect(repA.criteria.find((c) => c.key === 'location')?.reasonEn).toContain('Open nationally');

    // Case B: Explicit district quota restriction (Only permanent residents of Rajshahi)
    const rajshahiQuotaJob = makeMockJob({
      location: 'Rajshahi',
      requirements: ['শুধুমাত্র রাজশাহী জেলার স্থায়ী বাসিন্দাগণ আবেদন করতে পারবেন'],
      description: 'জেলা কোটা প্রযোজ্য',
    });
    const repB = evaluateProfileEligibility(profile, rajshahiQuotaJob);
    expect(repB.overallStatus).toBe('NOT_ELIGIBLE');
    expect(repB.criteria.find((c) => c.key === 'location')?.status).toBe('Failed');

    // Case C: Candidate permanent district is Rajshahi
    profile.address.permanent.district = 'Rajshahi';
    const repC = evaluateProfileEligibility(profile, rajshahiQuotaJob);
    expect(repC.overallStatus).toBe('ELIGIBLE');
    expect(repC.criteria.find((c) => c.key === 'location')?.status).toBe('Matched');
  });

  it('10. Returns MANUAL_REVIEW_REQUIRED when quota clauses or unextracted conditions exist', () => {
    const profile = structuredClone(sampleDemoProfile);
    profile.personal.dob = '1998-05-15';
    profile.hasGraduation = true;
    profile.graduation.examination = 'B.Sc in CSE';
    profile.graduation.subjectDegree = 'Computer Science';
    profile.graduation.gpa = '3.50';

    const quotaJob = makeMockJob({
      requirements: [
        'Bachelor in Computer Science with CGPA 3.00',
        'মুক্তিযোদ্ধা কোটা ও প্রতিবন্ধী কোটার সরকারি শর্তাবলি প্রযোজ্য',
      ],
    });

    const report = evaluateProfileEligibility(profile, quotaJob);
    expect(report.overallStatus).toBe('MANUAL_REVIEW_REQUIRED');
    expect(report.needsVerificationCount).toBeGreaterThan(0);
  });

  it('11. Returns INSUFFICIENT_PROFILE_DATA when candidate profile is missing mandatory data', () => {
    const empty = createEmptyProfile('Fresh Profile');
    const report = evaluateProfileEligibility(empty, makeMockJob());

    expect(report.overallStatus).toBe('INSUFFICIENT_PROFILE_DATA');
    expect(report.missingProfileCount).toBeGreaterThan(0);
    expect(report.criteria.find((c) => c.key === 'education')?.status).toBe('Missing Profile Data');
  });

  it('12. Recognizes 1st and 2nd Class Division equivalence in Bengali and English', () => {
    const parsedClass = extractJobRequirements({
      requirements: ['স্নাতক (কম্পিউটার সায়েন্স) এবং কমপক্ষে ২য় শ্রেণি বা সমমানের সিজিপিএ'],
    });

    expect(parsedClass.minEducationLevel).toBe('Bachelor');
    expect(parsedClass.minDivision).toBe(2);
    expect(parsedClass.minGpa).toBe(2.25);
  });

  it('13. Renders EligibilityCheckerPage UI with 5 verdict tabs and candidate snapshot', () => {
    const candidate = structuredClone(sampleDemoProfile);
    candidate.personal.dob = '1998-05-15';
    candidate.hasGraduation = true;
    candidate.graduation.examination = 'B.Sc in CSE';
    candidate.graduation.subjectDegree = 'Computer Science';
    candidate.graduation.gpa = '3.80';

    const html = renderToString(<EligibilityCheckerPage profile={candidate} />);

    // Verify key UI elements render
    expect(html).toContain('স্মার্ট যোগ্যতা যাচাইকারী');
    expect(html).toContain('সব সার্কুলার');
    expect(html).toContain('যোগ্য');
    expect(html).toContain('যোগ্য নন');
    expect(html).toContain('ম্যানুয়াল যাচাই');
    expect(html).toContain('তথ্য অসম্পূর্ণ');
  });
});
