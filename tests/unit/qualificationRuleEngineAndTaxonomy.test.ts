import { describe, it, expect } from 'vitest';
import {
  QualificationRuleEngine,
  QualificationRule,
  CandidateEducationInput,
} from '../../src/jobs/services/qualification-rule-engine';
import {
  ALL_CANONICAL_SUBJECTS,
  getSubjectById,
  matchSubjectFromText,
} from '../../src/jobs/taxonomy/subject-taxonomy';
import {
  evaluateProfileEligibility,
  extractJobRequirements,
} from '../../src/jobs/services/eligibility-helper';
import { createEmptyProfile, sampleDemoProfile } from '../../src/types/defaults';
import { NormalizedJobCircular } from '../../src/jobs/types/job.types';

describe('JobFill BD — Qualification Rule Engine & Subject Taxonomy Suite', () => {
  const baseMockJob: NormalizedJobCircular = {
    id: 'test_job_1',
    jobTitle: 'Assistant Programmer',
    position: 'Assistant Programmer',
    organization: 'BCC',
    sourceId: 'bcc',
    sourceName: 'BCC Official',
    sourceVerification: 'official_verified',
    category: 'government',
    location: 'Dhaka',
    qualification: 'Bachelor in Computer Science',
    requirements: ['Bachelor in Computer Science / CSE'],
    status: 'active',
    publishedAt: Date.now() - 86400000,
    lastUpdatedAt: Date.now(),
    deadlineAt: Date.now() + 86400000 * 10,
    deadlineVerified: true,
  };

  describe('1. Subject Taxonomy Disentanglement', () => {
    it('strictly isolates CSE and ICT without conflation', () => {
      const cseItem = matchSubjectFromText('Computer Science & Engineering');
      const ictItem = matchSubjectFromText('Information & Communication Technology');

      expect(cseItem).toBeDefined();
      expect(ictItem).toBeDefined();
      expect(cseItem?.id).toBe('cse');
      expect(ictItem?.id).toBe('ict');
      expect(cseItem?.id).not.toBe(ictItem?.id);
    });

    it('strictly isolates Finance and Banking without conflation', () => {
      const fin = matchSubjectFromText('Finance');
      const bnk = matchSubjectFromText('Banking & Insurance');

      expect(fin?.id).toBe('finance');
      expect(bnk?.id).toBe('banking');
      expect(fin?.id).not.toBe(bnk?.id);
    });

    it('strictly isolates Management and HRM without conflation', () => {
      const mgmt = matchSubjectFromText('Management');
      const hrm = matchSubjectFromText('Human Resource Management');

      expect(mgmt?.id).toBe('management');
      expect(hrm?.id).toBe('hrm');
      expect(mgmt?.id).not.toBe(hrm?.id);
    });

    it('strictly isolates Chemistry and Biochemistry without conflation', () => {
      const chem = matchSubjectFromText('Chemistry');
      const biochem = matchSubjectFromText('Biochemistry');

      expect(chem?.id).toBe('chemistry');
      expect(biochem?.id).toBe('biochemistry');
      expect(chem?.id).not.toBe(biochem?.id);
    });

    it('strictly isolates Sociology and Social Work without conflation', () => {
      const soc = matchSubjectFromText('Sociology');
      const sw = matchSubjectFromText('Social Work');

      expect(soc?.id).toBe('sociology');
      expect(sw?.id).toBe('social_work');
      expect(soc?.id).not.toBe(sw?.id);
    });
  });

  describe('2. Qualification Rule Engine — Conditions', () => {
    it('evaluates ANY_SUBJECT correctly based on education level', () => {
      const rule: QualificationRule = {
        type: 'ANY_SUBJECT',
        minLevel: 'Bachelor',
      };

      const candidateA: CandidateEducationInput[] = [
        { level: 'HSC', degreeTitle: 'HSC', subjectOrGroup: 'Science' },
      ];
      const resA = QualificationRuleEngine.evaluate(rule, candidateA);
      expect(resA.status).toBe('NOT_ELIGIBLE');

      const candidateB: CandidateEducationInput[] = [
        { level: 'Bachelor', degreeTitle: 'BBA', subjectOrGroup: 'Marketing' },
      ];
      const resB = QualificationRuleEngine.evaluate(rule, candidateB);
      expect(resB.status).toBe('ELIGIBLE');
      expect(resB.matchedLevel).toBe('Bachelor');
    });

    it('evaluates SPECIFIC_SUBJECT rejecting non-matching distinct departments', () => {
      const rule: QualificationRule = {
        type: 'SPECIFIC_SUBJECT',
        minLevel: 'Bachelor',
        requiredSubjectIds: ['cse'],
      };

      // Candidate with ICT degree should NOT pass strict CSE-only requirement
      const candidateIct: CandidateEducationInput[] = [
        {
          level: 'Bachelor',
          degreeTitle: 'B.Sc in Information & Communication Technology',
          subjectOrGroup: 'Information & Communication Technology',
        },
      ];
      const resIct = QualificationRuleEngine.evaluate(rule, candidateIct);
      expect(resIct.status).toBe('NOT_ELIGIBLE');

      // Candidate with CSE degree should pass
      const candidateCse: CandidateEducationInput[] = [
        {
          level: 'Bachelor',
          degreeTitle: 'B.Sc in Computer Science & Engineering',
          subjectOrGroup: 'Computer Science & Engineering',
        },
      ];
      const resCse = QualificationRuleEngine.evaluate(rule, candidateCse);
      expect(resCse.status).toBe('ELIGIBLE');
      expect(resCse.matchedSubject).toContain('Computer Science');
    });

    it('evaluates SUBJECT_GROUP for engineering and business disciplines', () => {
      const engRule: QualificationRule = {
        type: 'SUBJECT_GROUP',
        discipline: 'engineering',
        minLevel: 'Bachelor',
      };

      const candidateEee: CandidateEducationInput[] = [
        { level: 'Bachelor', degreeTitle: 'B.Sc in EEE', subjectOrGroup: 'Electrical & Electronic Engineering' },
      ];
      const resEee = QualificationRuleEngine.evaluate(engRule, candidateEee);
      expect(resEee.status).toBe('ELIGIBLE');

      const candidateHist: CandidateEducationInput[] = [
        { level: 'Bachelor', degreeTitle: 'BA Honours in History', subjectOrGroup: 'History' },
      ];
      const resHist = QualificationRuleEngine.evaluate(engRule, candidateHist);
      expect(resHist.status).toBe('NOT_ELIGIBLE');
    });

    it('evaluates MULTIPLE_REQUIREMENTS with nested AND/OR condition tree', () => {
      // Rule: (Bachelor in CSE) OR (Bachelor in EEE)
      const orRule: QualificationRule = {
        type: 'MULTIPLE_REQUIREMENTS',
        operator: 'OR',
        subRules: [
          { type: 'SPECIFIC_SUBJECT', minLevel: 'Bachelor', requiredSubjectIds: ['cse'] },
          { type: 'SPECIFIC_SUBJECT', minLevel: 'Bachelor', requiredSubjectIds: ['eee'] },
        ],
      };

      const candidateEee: CandidateEducationInput[] = [
        { level: 'Bachelor', degreeTitle: 'B.Sc in Electrical Engineering', subjectOrGroup: 'Electrical Engineering' },
      ];
      expect(QualificationRuleEngine.evaluate(orRule, candidateEee).status).toBe('ELIGIBLE');

      const candidateAcct: CandidateEducationInput[] = [
        { level: 'Bachelor', degreeTitle: 'BBA in Accounting', subjectOrGroup: 'Accounting' },
      ];
      expect(QualificationRuleEngine.evaluate(orRule, candidateAcct).status).toBe('NOT_ELIGIBLE');
    });
  });

  describe('3. Multi-degree Profile & Honest Age Cutoff Integration', () => {
    it('recognizes candidate secondary degrees in educationDegrees array', () => {
      const profile = structuredClone(sampleDemoProfile);
      profile.hasGraduation = true;
      profile.graduation.examination = 'B.Sc in Civil Engineering';
      profile.graduation.subjectDegree = 'Civil Engineering';
      profile.personal.dob = '1998-01-01';

      // Circular requiring LLB
      const lawJob: NormalizedJobCircular = {
        ...baseMockJob,
        jobTitle: 'Legal Officer',
        qualification: 'Bachelor in Law (LLB)',
        requirements: ['Bachelor in Law / LLB'],
      };

      // Initially only Civil Engineering -> NOT_ELIGIBLE
      const rep1 = evaluateProfileEligibility(profile, lawJob);
      expect(rep1.overallStatus).toBe('NOT_ELIGIBLE');

      // Now add 2nd degree: LLB in educationDegrees
      profile.educationDegrees = [
        {
          id: 'deg_law_1',
          level: 'Bachelor',
          degreeTitle: 'Bachelor of Laws (LL.B)',
          subjectOrGroup: 'Law',
          passingYear: '2023',
          gpa: '3.65',
        },
      ];

      const rep2 = evaluateProfileEligibility(profile, lawJob);
      expect(rep2.overallStatus).toBe('ELIGIBLE');
      expect(rep2.criteria.find((c) => c.key === 'subject')?.status).toBe('Matched');
    });

    it('strictly marks age as Needs Verification when circular text does not explicitly specify a cutoff date', () => {
      const profile = structuredClone(sampleDemoProfile);
      profile.personal.dob = '1998-05-15';
      profile.hasGraduation = true;
      profile.graduation.examination = 'B.Sc in CSE';
      profile.graduation.subjectDegree = 'Computer Science';
      profile.graduation.gpa = '3.80';

      // Circular specifies age limit 18-30, but does NOT contain explicit "as on" / "তারিখ পর্যন্ত" date
      // Note: deadlineAt is present, but engine MUST NOT guess age cutoff from deadlineAt!
      const jobWithoutExplicitCutoff: NormalizedJobCircular = {
        ...baseMockJob,
        ageRequirement: '১৮ থেকে ৩০ বছর',
        requirements: ['কম্পিউটার সায়েন্সে স্নাতক'],
        deadlineAt: Date.parse('2026-12-31T18:00:00Z'),
      };

      const extracted = extractJobRequirements(jobWithoutExplicitCutoff);
      expect(extracted.ageCutoffDate).toBeNull();

      const report = evaluateProfileEligibility(profile, jobWithoutExplicitCutoff);
      const ageCrit = report.criteria.find((c) => c.key === 'age');
      expect(ageCrit?.status).toBe('Needs Verification');
      expect(report.overallStatus).toBe('MANUAL_REVIEW_REQUIRED');
    });
  });
});
