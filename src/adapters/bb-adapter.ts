// JobFill BD - Bangladesh Bank (erecruitment.bb.org.bd) Site Adapter
import { SiteAdapter } from './types';
import { UserProfile } from '../types/profile';

export const BangladeshBankAdapter: SiteAdapter = {
  id: 'bangladesh_bank',
  name: 'Bangladesh Bank e-Recruitment',
  description: 'Specialized for erecruitment.bb.org.bd & state-owned bank recruitment portals',

  matchesUrl(url: string): boolean {
    const u = url.toLowerCase();
    return u.includes('erecruitment.bb.org.bd') || u.includes('bb.org.bd/en/card') || u.includes('bb.org.bd');
  },

  detectSite(document: Document): boolean {
    const text = (document.body?.textContent || '').toLowerCase();
    return (
      text.includes('bangladesh bank') ||
      text.includes('bankers selection committee') ||
      document.querySelector('form[action*="erecruitment" i]') !== null
    );
  },

  preProcessForm(document: Document) {
    const collapsed = document.querySelectorAll<HTMLElement>('.collapse:not(.show), .panel-collapse:not(.in)');
    collapsed.forEach((el) => {
      el.classList.add('show', 'in');
    });
  },

  postFill(document: Document, profile: UserProfile) {
    // Dispatch change events on dependent permanent/present district selectors common on BB forms
    const selects = document.querySelectorAll<HTMLSelectElement>('select[name*="district" i], select[id*="district" i]');
    selects.forEach((sel) => {
      if (sel.value) sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    void profile;
  },

  documentMappings: [
    {
      canonicalKey: 'profile.documents.photo',
      documentType: 'photo',
      fieldNames: ['photo', 'applicant_photo', 'candidate_photo', 'filePhoto'],
      fieldIds: ['photo', 'applicant_photo', 'filePhoto'],
      labelKeywords: ['Photo', 'Photograph', 'ছবি'],
      previewSelectors: ['#imgPhoto', '#photoPreview'],
      errorSelectors: ['#photoError'],
    },
    {
      canonicalKey: 'profile.documents.signature',
      documentType: 'signature',
      fieldNames: ['signature', 'sign', 'candidate_sign', 'fileSignature'],
      fieldIds: ['signature', 'sign', 'fileSignature'],
      labelKeywords: ['Signature', 'স্বাক্ষর'],
      previewSelectors: ['#imgSignature', '#signaturePreview'],
      errorSelectors: ['#sigError'],
    },
    {
      canonicalKey: 'profile.documents.cv',
      documentType: 'cv',
      fieldNames: ['cv', 'resume', 'cv_file', 'fileCv'],
      fieldIds: ['cv', 'resume', 'cv_file'],
      labelKeywords: ['CV', 'Resume', 'Curriculum Vitae'],
    },
  ],
};
