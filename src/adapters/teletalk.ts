// JobFill BD - Teletalk Standard Alljobs Adapter
import { SiteAdapter } from './types';
import { UserProfile } from '../types/profile';

export const TeletalkAdapter: SiteAdapter = {
  id: 'teletalk',
  name: 'Teletalk Alljobs & Ministerial Recruitment',
  description: 'Specialized for alljobs.teletalk.com.bd and ministerial recruitment portals',

  matchesUrl(url: string): boolean {
    const u = url.toLowerCase();
    return u.includes('teletalk.com.bd') || u.includes('alljobs.teletalk.com.bd');
  },

  detectSite(document: Document): boolean {
    const text = document.body.textContent || '';
    return text.includes('Teletalk') || document.querySelector('form[name*="tele" i]') !== null;
  },

  preProcessForm(document: Document) {
    // Reveal expandable sections if closed
    const accordions = document.querySelectorAll<HTMLElement>('.collapse:not(.show), .panel-collapse:not(.in)');
    accordions.forEach((el) => {
      el.classList.add('show', 'in');
    });
  },

  postFill(document: Document, profile: UserProfile) {
    if (profile.personal.quota && profile.personal.quota !== 'General') {
      const quotaSelect = document.querySelector<HTMLSelectElement>('select[name*="quota" i]');
      if (quotaSelect) {
        quotaSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  },

  documentMappings: [
    {
      canonicalKey: 'profile.documents.photo',
      documentType: 'photo',
      fieldNames: ['photo', 'photo_file', 'applicant_photo', 'pic'],
      fieldIds: ['photo', 'photo_file', 'applicant_photo', 'pic'],
      labelKeywords: ['Photo', 'Photograph', 'ছবি'],
      previewSelectors: ['#photo_preview', '#img_photo'],
      errorSelectors: ['#photo_error'],
    },
    {
      canonicalKey: 'profile.documents.signature',
      documentType: 'signature',
      fieldNames: ['signature', 'sign', 'sig', 'sign_file'],
      fieldIds: ['signature', 'sign', 'sig', 'sign_file'],
      labelKeywords: ['Signature', 'স্বাক্ষর'],
      previewSelectors: ['#sig_preview', '#signature_preview', '#img_sig'],
      errorSelectors: ['#sig_error', '#signature_error'],
    },
  ],
};
