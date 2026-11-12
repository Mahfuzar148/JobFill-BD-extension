// JobFill BD - Scholarship, Internship & Student Opportunity Classifier
// Strictly categorizes real circulars/entries without fabricating links, deadlines, or mixed categories.

import type { NormalizedJobCircular } from '../jobs/types/job.types';
import { verifyJobUrl } from '../jobs/services/source-verifier';
import { classifyOfficialSourceTier, type OfficialVerificationTier } from '../jobs/services/scam-awareness';

export type StudentOpportunityCategory =
  | 'Scholarship'
  | 'Internship'
  | 'Fresh Graduate Job'
  | 'Part-Time Job'
  | 'Training Program'
  | 'Graduate Development Program';

export interface CategorizedOpportunity {
  job: NormalizedJobCircular;
  opportunityCategory: StudentOpportunityCategory;
  sourceTier: OfficialVerificationTier;
  hasVerifiedApplicationLink: boolean;
  hasVerifiedDeadline: boolean;
}

const CATEGORY_RULES: Array<{
  category: StudentOpportunityCategory;
  pattern: RegExp;
}> = [
  { category: 'Scholarship', pattern: /\b(scholarship|fellowship|stipend|grant|বৃত্তি|স্কলারশিপ)\b/i },
  { category: 'Internship', pattern: /\b(intern|internship|trainee\s+intern|ইন্টার্ন|ইন্টার্নশিপ)\b/i },
  { category: 'Graduate Development Program', pattern: /\b(management\s+trainee|young\s+leader|graduate\s+development|gdp|ম্যানেজমেন্ট\s+ট্রেইনি)\b/i },
  { category: 'Training Program', pattern: /\b(training|bootcamp|seip|edge\s+training|workshop|প্রশিক্ষণ)\b/i },
  { category: 'Part-Time Job', pattern: /\b(part[\s-]*time|freelance|campus\s+ambassador|পার্ট[\s-]*টাইম)\b/i },
  {
    category: 'Fresh Graduate Job',
    pattern: /\b(fresher|fresh\s+graduate|entry[\s-]*level|0\s*year|no\s+experience|trainee\s+officer|নবীন|অভিজ্ঞতা\s*ছাড়াই|অভিজ্ঞতা\s*নিষ্প্রয়োজন)\b/i,
  },
];

export function classifyStudentOpportunity(job: NormalizedJobCircular): StudentOpportunityCategory | null {
  const haystack = `${job.jobTitle} ${job.position} ${job.category} ${job.employmentType} ${job.experience || ''} ${job.description}`;
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(haystack)) {
      // Prevent internships/jobs from being misclassified into Scholarships unless Scholarship keywords appear in title/notes
      if (rule.category === 'Scholarship' && /\binternship\b/i.test(job.jobTitle) && !/\bscholarship|বৃত্তি\b/i.test(job.jobTitle)) {
        continue;
      }
      return rule.category;
    }
  }
  return null;
}

export function extractStudentOpportunities(
  jobs: NormalizedJobCircular[],
  filterCategory: StudentOpportunityCategory | 'All' = 'All'
): CategorizedOpportunity[] {
  const out: CategorizedOpportunity[] = [];
  for (const job of jobs) {
    if (job.status === 'expired') continue;
    const cat = classifyStudentOpportunity(job);
    if (!cat) continue;
    if (filterCategory !== 'All' && cat !== filterCategory) continue;

    const tierInfo = classifyOfficialSourceTier(job);
    const appCheck = verifyJobUrl(job.applicationUrl);
    out.push({
      job,
      opportunityCategory: cat,
      sourceTier: tierInfo.tier,
      hasVerifiedApplicationLink: Boolean(appCheck.isSafeToOpen && (appCheck.isOfficialDomain || tierInfo.tier !== 'Unverified Discovery')),
      hasVerifiedDeadline: Boolean(job.deadlineVerified && job.deadlineAt),
    });
  }
  return out;
}
