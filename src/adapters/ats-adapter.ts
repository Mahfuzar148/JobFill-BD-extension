// JobFill BD - Modern ATS & Career Portal Adapter
// Covers Greenhouse, Lever, Workday, Ashby, SmartRecruiters, and Bdjobs Apply portals.
import { SiteAdapter } from './types';
import { UserProfile } from '../types/profile';

const ATS_HOST_HINTS = [
  'boards.greenhouse.io',
  'job-boards.greenhouse.io',
  'jobs.lever.co',
  'myworkdayjobs.com',
  'jobs.smartrecruiters.com',
  'jobs.ashbyhq.com',
  'bdjobs.com',
];

export const AtsPortalAdapter: SiteAdapter = {
  id: 'ats_portals',
  name: 'Corporate ATS & Career Portals (Greenhouse / Lever / Workday / Bdjobs)',
  description: 'Adapter for structured international & local career application forms',

  matchesUrl(url: string): boolean {
    const u = url.toLowerCase();
    return ATS_HOST_HINTS.some((hint) => u.includes(hint));
  },

  detectSite(document: Document): boolean {
    return (
      document.querySelector('[data-qa="application-form"], form#application-form, form[action*="greenhouse" i], form[action*="lever" i]') !== null
    );
  },

  preProcessForm(document: Document) {
    const expandable = document.querySelectorAll<HTMLDetailsElement>('details:not([open])');
    expandable.forEach((d) => {
      d.open = true;
    });
  },

  postFill(_document: Document, _profile: UserProfile) {
    // ATS React/Ember forms react synchronously via native input events from VerificationEngine
  },

  documentMappings: [
    {
      canonicalKey: 'profile.documents.cv',
      documentType: 'cv',
      fieldNames: ['resume', 'cv', 'resume_file', 'cv_file', 'candidate[resume]'],
      fieldIds: ['resume', 'cv', 'resume_file', 's3_upload_for_resume'],
      labelKeywords: ['Resume', 'CV', 'Curriculum Vitae', 'Cover Letter'],
    },
    {
      canonicalKey: 'profile.documents.photo',
      documentType: 'photo',
      fieldNames: ['photo', 'avatar', 'profile_photo'],
      fieldIds: ['photo', 'avatar'],
      labelKeywords: ['Photo', 'Picture', 'Headshot'],
    },
  ],
};
