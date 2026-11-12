// JobFill BD - Job, Salary & Benefit Comparison Service (Factual Only)
// Never fabricates missing vacancies, salaries, grades, or net take-home pay.

import type { NormalizedJobCircular } from '../types/job.types';
import { classifyOfficialSourceTier, type OfficialVerificationTier } from './scam-awareness';

export interface ParsedSalaryBreakdown {
  publishedText: string;
  grade: string;
  basicRange: string;
  allowancesNote: string;
  isDisclosed: boolean;
}

export interface JobComparisonColumn {
  jobId: string;
  organization: string;
  jobTitle: string;
  verificationTier: OfficialVerificationTier;
  employmentType: string;
  qualification: string;
  ageLimit: string;
  experience: string;
  location: string;
  deadlineDisplay: string;
  deadlineVerified: boolean;
  vacanciesDisplay: string;
  salaryBreakdown: ParsedSalaryBreakdown;
  applicationFee: string;
}

export function extractPublishedSalaryBreakdown(rawSalary?: string | null, rawDesc?: string): ParsedSalaryBreakdown {
  const sal = (rawSalary || '').trim();
  const desc = (rawDesc || '').trim();
  const combined = [sal, desc].filter(Boolean).join(' ');

  if (!sal || /^(?:not specified|negotiable|n\/a|salary not disclosed)$/i.test(sal)) {
    const gradeMatch = desc.match(/(?:grade|গ্রেড)\s*[-:]?\s*(\d{1,2})/i);
    if (!gradeMatch) {
      return {
        publishedText: sal || 'Salary not disclosed',
        grade: 'Not Available',
        basicRange: 'Salary not disclosed',
        allowancesNote: 'Not Available',
        isDisclosed: false,
      };
    }
  }

  const gradeMatch = combined.match(/(?:pay\s*scale|national\s*pay\s*scale|grade|গ্রেড)\s*[-:#]?\s*(\d{1,2})/i);
  const rangeMatch = sal.match(/(\d[\d,]{3,}\s*[-–to]+\s*\d[\d,]{3,}|BDT\s*\d[\d,]+|Tk\.?\s*\d[\d,]+)/i);
  const hasAllowancesMention = /(allowance|medical|house\s*rent|festival|bonus|provident|ভাতা|সুবিধা)/i.test(combined);

  return {
    publishedText: sal || 'Salary not disclosed',
    grade: gradeMatch ? `Grade ${gradeMatch[1]}` : 'Not Specified',
    basicRange: rangeMatch ? rangeMatch[1] : sal || 'Salary not disclosed',
    allowancesNote: hasAllowancesMention
      ? 'Allowances/benefits mentioned in circular text (see official PDF for exact rules)'
      : 'Not specified in circular summary',
    isDisclosed: Boolean(sal),
  };
}

export function computeUserAssumedNetSalary(
  grossMonthlyBdt: number,
  userDeductionPercent: number
): {
  isUserAssumptionOnly: true;
  grossMonthly: number;
  deductionPercent: number;
  estimatedNetMonthly: number;
} {
  const safeGross = Math.max(0, Number.isFinite(grossMonthlyBdt) ? grossMonthlyBdt : 0);
  const safePct = Math.min(80, Math.max(0, Number.isFinite(userDeductionPercent) ? userDeductionPercent : 0));
  return {
    isUserAssumptionOnly: true,
    grossMonthly: safeGross,
    deductionPercent: safePct,
    estimatedNetMonthly: Math.round(safeGross * (1 - safePct / 100)),
  };
}

export function buildJobComparisonMatrix(jobs: NormalizedJobCircular[]): JobComparisonColumn[] {
  return jobs.map((job) => {
    const source = classifyOfficialSourceTier(job);
    const salaryBreakdown = extractPublishedSalaryBreakdown(job.salary, job.description);
    const deadlineDisplay = job.deadlineAt
      ? new Date(job.deadlineAt).toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka' })
      : job.deadlineText || 'Not Available';

    return {
      jobId: job.id,
      organization: job.organization || 'Not Available',
      jobTitle: job.jobTitle || 'Not Available',
      verificationTier: source.tier,
      employmentType: job.employmentType || 'Not Available',
      qualification: job.qualification || 'Not Available',
      ageLimit: job.ageRequirement || 'Not Available',
      experience: job.experience || 'Not Specified',
      location: job.location || 'Not Available',
      deadlineDisplay,
      deadlineVerified: Boolean(job.deadlineVerified),
      vacanciesDisplay:
        typeof job.vacancies === 'number' && job.vacancies > 0 ? String(job.vacancies) : 'Not Available',
      salaryBreakdown,
      applicationFee: job.applicationFee || 'Not Available',
    };
  });
}
