import { describe, it, expect } from 'vitest';
import {
  classifyOfficialSourceTier,
  assessCircularScamSignals,
} from '../../src/jobs/services/scam-awareness';
import {
  buildJobComparisonMatrix,
  extractPublishedSalaryBreakdown,
  computeUserAssumedNetSalary,
} from '../../src/jobs/services/job-comparison';
import {
  classifyStudentOpportunity,
  extractStudentOpportunities,
} from '../../src/opportunities/opportunities-service';
import { findDuplicateOrClusteredCirculars } from '../../src/jobs/services/job-deduplicator';
import type { NormalizedJobCircular } from '../../src/jobs/types/job.types';

function makeJob(overrides: Partial<NormalizedJobCircular>): NormalizedJobCircular {
  return {
    id: 'j1',
    sourceId: 'bpsc',
    sourceName: 'BPSC',
    organization: 'Bangladesh Public Service Commission',
    jobTitle: 'Assistant Engineer',
    position: 'Assistant Engineer',
    category: 'Government',
    employmentType: 'Full Time',
    qualification: 'Graduate',
    location: 'Dhaka',
    publishedAt: Date.now(),
    applicationStartAt: null,
    deadlineAt: Date.now() + 86400000 * 10,
    deadlineTimezone: 'Asia/Dhaka',
    deadlineVerified: true,
    applicationUrl: 'https://bpsc.teletalk.com.bd/apply',
    description: 'Official circular notice.',
    requirements: ['BSc in CSE'],
    sourceVerification: 'official_verified',
    sourceLastCheckedAt: Date.now(),
    firstDiscoveredAt: Date.now(),
    lastUpdatedAt: Date.now(),
    status: 'active',
    ...overrides,
  };
}

describe('JobFill BD - Milestone 3: Source Verification, Scam Awareness, Comparison, Salary & Opportunities', () => {
  it('classifies official source tiers accurately and detects scam risk signals conservatively', () => {
    const cleanTeletalk = makeJob({});
    expect(classifyOfficialSourceTier(cleanTeletalk).tier).toBe('Official Recruitment Portal');
    expect(assessCircularScamSignals(cleanTeletalk).warningLevel).toBe('None Observed');

    const shady = makeJob({
      id: 'j_shady',
      sourceVerification: 'discovery_only',
      applicationUrl: 'http://unofficial-jobs-bd.example/apply',
      description: '100% job guarantee without exam! Send money to 01700000000 personal bKash fee.',
    });
    expect(classifyOfficialSourceTier(shady).tier).toBe('Secondary Discovery Source');
    const report = assessCircularScamSignals(shady);
    expect(report.warningLevel).toBe('High Attention');
    expect(report.reasons.some((r) => r.code === 'HTTP_APPLICATION_LINK')).toBe(true);
    expect(report.reasons.some((r) => r.code === 'PERSONAL_MFS_FEE_REQUEST')).toBe(true);
    expect(report.cautionNotice).toContain('do not prove fraud');
  });

  it('compares multiple jobs honestly without inventing salary, net take-home, or missing vacancies', () => {
    const jobA = makeJob({
      id: 'cmp_1',
      jobTitle: 'Programmer (Grade 9)',
      salary: 'BDT 22,000 - 53,060 (National Pay Scale Grade 9)',
      vacancies: 4,
      description: 'Includes house rent and festival allowance as per govt rules.',
    });
    const jobB = makeJob({
      id: 'cmp_2',
      jobTitle: 'Junior Officer',
      salary: '',
      vacancies: null,
      ageRequirement: '',
      description: 'Apply online.',
    });

    const matrix = buildJobComparisonMatrix([jobA, jobB]);
    expect(matrix).toHaveLength(2);
    expect(matrix[0].vacanciesDisplay).toBe('4');
    expect(matrix[0].salaryBreakdown.grade).toBe('Grade 9');
    expect(matrix[0].salaryBreakdown.allowancesNote).toContain('Allowances');

    expect(matrix[1].vacanciesDisplay).toBe('Not Available');
    expect(matrix[1].ageLimit).toBe('Not Available');
    expect(matrix[1].salaryBreakdown.publishedText).toBe('Salary not disclosed');
    expect(extractPublishedSalaryBreakdown('Negotiable', '').isDisclosed).toBe(false);

    const calc = computeUserAssumedNetSalary(40000, 10);
    expect(calc.isUserAssumptionOnly).toBe(true);
    expect(calc.estimatedNetMonthly).toBe(36000);
  });

  it('strictly classifies Scholarships/Internships/Fresh Graduate opportunities and groups duplicate clusters', () => {
    const intern = makeJob({
      id: 'opp_intern',
      jobTitle: 'Software Engineering Internship 2026',
      employmentType: 'Internship',
      sourceVerification: 'official_verified',
    });
    const scholarship = makeJob({
      id: 'opp_schol',
      jobTitle: 'ICT Division Fellowship Scholarship',
      applicationUrl: 'https://ictd.gov.bd/scholarship',
      sourceVerification: 'official_partial',
    });
    const regular = makeJob({
      id: 'reg_job',
      jobTitle: 'Senior Manager',
      experience: '10 years experience required',
    });

    expect(classifyStudentOpportunity(intern)).toBe('Internship');
    expect(classifyStudentOpportunity(scholarship)).toBe('Scholarship');
    expect(classifyStudentOpportunity(regular)).toBeNull();

    const filteredInterns = extractStudentOpportunities([intern, scholarship, regular], 'Internship');
    expect(filteredInterns).toHaveLength(1);
    expect(filteredInterns[0].job.id).toBe('opp_intern');

    const clusterPrimary = makeJob({
      id: 'dup_1',
      alternateSources: [
        { sourceId: 'bpsc', sourceName: 'BPSC', verificationStatus: 'official_verified' },
        { sourceId: 'news', sourceName: 'Google News', verificationStatus: 'discovery_only' },
      ],
    });
    const clusterChild = makeJob({ id: 'dup_2', possibleDuplicateOfId: 'dup_1' });
    const clusters = findDuplicateOrClusteredCirculars([clusterPrimary, clusterChild]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].relatedJobs).toHaveLength(1);
    expect(clusters[0].alternateSourcesCount).toBe(2);
  });
});
