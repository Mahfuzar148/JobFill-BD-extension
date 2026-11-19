import { describe, it, expect } from 'vitest';
import {
  evaluateProfileEligibility,
  extractJobRequirements,
  normalizeBengaliDigits,
} from '../../src/jobs/services/eligibility-helper';
import { createEmptyProfile, sampleDemoProfile } from '../../src/types/defaults';
import { NormalizedJobCircular } from '../../src/jobs/types/job.types';

function makeCircular(overrides: Partial<NormalizedJobCircular> = {}): NormalizedJobCircular {
  return {
    id: 'job_test_1',
    jobTitle: 'Assistant Programmer',
    position: 'Assistant Programmer',
    organization: 'Bangladesh Public Service Commission',
    sourceId: 'bpsc',
    sourceName: 'BPSC',
    sourceUrl: 'https://bpsc.gov.bd',
    circularUrl: 'https://bpsc.gov.bd/circular.pdf',
    applicationUrl: 'https://bpsc.teletalk.com.bd',
    sourceVerification: 'official_verified',
    deadlineVerified: true,
    deadlineAt: Date.parse('2026-11-30T18:00:00Z'),
    deadlineText: '2026-11-30',
    location: 'All Bangladesh',
    category: 'Government',
    qualification: 'Bachelor',
    experience: 'No experience required',
    ageRequirement: '18-30 years as on 2026-11-30',
    requirements: ['Bachelor in Computer Science / CSE with minimum CGPA 3.00 out of 4.00'],
    description: 'Open to candidates from all districts.',
    status: 'active',
    publishedAt: Date.parse('2026-11-01T00:00:00Z'),
    lastUpdatedAt: Date.parse('2026-11-05T00:00:00Z'),
    ...overrides,
  };
}

describe('Phase 2 — Bilingual Job Eligibility Checker Suite', () => {
  it('1. Normalizes Bengali digits and parses Bengali + English circular requirements without fabricating absent ones', () => {
    expect(normalizeBengaliDigits('ন্যূনতম সিজিপিএ ৩.০০ ও বয়স ১৮-৩০ বছর')).toBe(
      'ন্যূনতম সিজিপিএ 3.00 ও বয়স 18-30 বছর'
    );

    const parsedBn = extractJobRequirements({
      qualification: 'Any Qualification',
      requirements: ['স্নাতকোত্তর (অর্থনীতি) এবং ন্যূনতম সিজিপিএ ৩.২৫', '২ বছরের অভিজ্ঞতা'],
      ageRequirement: 'অনূর্ধ্ব ৩২ বছর',
      location: 'All Bangladesh',
    });

    expect(parsedBn.minEducationLevel).toBe('Masters');
    expect(parsedBn.requiredSubjects).toContain('economics');
    expect(parsedBn.minGpa).toBe(3.25);
    expect(parsedBn.maxAgeYears).toBe(32);
    expect(parsedBn.minExperienceYears).toBe(2);

    // Absent requirements stay null instead of being invented
    const sparse = extractJobRequirements({
      qualification: 'Any Qualification',
      requirements: [],
      description: 'Apply online',
    });
    expect(sparse.minEducationLevel).toBeNull();
    expect(sparse.minGpa).toBeNull();
    expect(sparse.maxAgeYears).toBeNull();
    expect(sparse.hasExtractedAnyRequirement).toBe(false);
  });

  it('2. Returns ELIGIBLE when all verified profile requirements match cleanly', () => {
    const profile = structuredClone(sampleDemoProfile);
    profile.personal.dob = '1999-05-10';
    profile.hasGraduation = true;
    profile.graduation.examination = 'B.Sc in Engineering';
    profile.graduation.subjectDegree = 'Computer Science & Engineering (CSE)';
    profile.graduation.gpa = '3.65';
    profile.graduation.gpaScale = '4';

    const report = evaluateProfileEligibility(profile, makeCircular());
    expect(report.overallStatus).toBe('ELIGIBLE');
    expect(report.failedCount).toBe(0);
    expect(report.circularUrl).toBe('https://bpsc.gov.bd/circular.pdf');
    expect(report.criteria.find((c) => c.key === 'education')?.status).toBe('Matched');
    expect(report.criteria.find((c) => c.key === 'subject')?.status).toBe('Matched');
    expect(report.criteria.find((c) => c.key === 'gpa')?.status).toBe('Matched');
    expect(report.criteria.find((c) => c.key === 'age')?.status).toBe('Matched');
  });

  it('3. Returns NOT_ELIGIBLE when GPA threshold, degree subject, experience, or age fails', () => {
    const profile = structuredClone(sampleDemoProfile);
    profile.personal.dob = '1999-01-01';
    profile.hasGraduation = true;
    profile.graduation.subjectDegree = 'Computer Science';
    profile.graduation.gpa = '2.99'; // Just below CGPA 3.00
    profile.graduation.gpaScale = '4';

    const gpaFail = evaluateProfileEligibility(profile, makeCircular());
    expect(gpaFail.overallStatus).toBe('NOT_ELIGIBLE');
    expect(gpaFail.criteria.find((c) => c.key === 'gpa')?.status).toBe('Failed');

    // Subject mismatch (Accounting vs Computer Science — must NOT treat unrelated fields as equal)
    profile.graduation.gpa = '3.80';
    profile.graduation.subjectDegree = 'Accounting';
    const subjFail = evaluateProfileEligibility(profile, makeCircular());
    expect(subjFail.overallStatus).toBe('NOT_ELIGIBLE');
    expect(subjFail.criteria.find((c) => c.key === 'subject')?.status).toBe('Failed');

    // Age cutoff boundary test (exactly 30 yrs + 1 day old on 2026-11-30)
    profile.graduation.subjectDegree = 'CSE';
    profile.personal.dob = '1996-11-29';
    const ageFail = evaluateProfileEligibility(profile, makeCircular());
    expect(ageFail.overallStatus).toBe('NOT_ELIGIBLE');
    expect(ageFail.criteria.find((c) => c.key === 'age')?.status).toBe('Failed');
  });

  it('4. Returns INSUFFICIENT_PROFILE_DATA or MANUAL_REVIEW_REQUIRED when profile data is missing or uncertain quotas exist', () => {
    const empty = createEmptyProfile('Incomplete Applicant');
    const missingRes = evaluateProfileEligibility(empty, makeCircular());
    expect(['INSUFFICIENT_PROFILE_DATA', 'NEEDS_MANUAL_VERIFICATION']).toContain(missingRes.overallStatus);
    expect(missingRes.missingProfileCount).toBeGreaterThan(0);

    // Full matching profile against circular with Freedom Fighter quota / see circular footnote
    const profile = structuredClone(sampleDemoProfile);
    profile.personal.dob = '1999-05-10';
    profile.hasGraduation = true;
    profile.graduation.subjectDegree = 'Computer Science';
    profile.graduation.gpa = '3.50';
    profile.graduation.gpaScale = '4';

    const quotaRes = evaluateProfileEligibility(
      profile,
      makeCircular({
        requirements: [
          'Bachelor in Computer Science with CGPA 3.00',
          'মুক্তিযোদ্ধা কোটা ও প্রতিবন্ধী কোটার জন্য সরকারি শর্তাবলি প্রযোজ্য',
        ],
      })
    );
    expect(['MANUAL_REVIEW_REQUIRED', 'NEEDS_MANUAL_VERIFICATION']).toContain(quotaRes.overallStatus);
    expect(quotaRes.criteria.find((c) => c.key === 'conditions')?.status).toBe('Needs Verification');
  });

  it('5. Supports manual requirement override without altering circular links', () => {
    const profile = structuredClone(sampleDemoProfile);
    profile.personal.dob = '1999-05-10';
    profile.hasGraduation = true;
    profile.graduation.gpa = '3.40';
    profile.graduation.gpaScale = '4';

    const sparseJob = makeCircular({
      qualification: 'Any Qualification',
      requirements: [],
      ageRequirement: undefined,
      description: 'Download PDF for full details',
    });

    const beforeOverride = evaluateProfileEligibility(profile, sparseJob);
    expect(['MANUAL_REVIEW_REQUIRED', 'NEEDS_MANUAL_VERIFICATION']).toContain(beforeOverride.overallStatus);

    const afterOverride = evaluateProfileEligibility(profile, sparseJob, {
      minEducationLevel: 'Bachelor',
      minGpa: 3.0,
      hasExtractedAnyRequirement: true,
    });
    expect(afterOverride.overallStatus).toBe('ELIGIBLE');
    expect(afterOverride.circularUrl).toBe('https://bpsc.gov.bd/circular.pdf');
  });
});
