// JobFill BD - PetroBangla / BOGMC Master Site Adapter
// Complete implementation conforming to SiteAdapter interface.

import { SiteAdapter } from '../types';
import { UserProfile } from '../../types/profile';
import { PetroBanglaDetector } from './petrobangla.detector';
import { PetroBanglaRules } from './petrobangla.rules';
import { PETROBANGLA_FIELD_MAPS } from './petrobangla.field-map';

export const PetroBanglaAdapter: SiteAdapter = {
  id: 'petrobangla',
  name: 'PetroBangla / BOGMC Adapter',
  description: 'Specialized for Bangladesh Oil, Gas & Mineral Corporation (bogmc.teletalk.com.bd) & energy entities',

  matchesUrl(url: string): boolean {
    const res = PetroBanglaDetector.detect(url);
    return res.isSupported;
  },

  detectSite(document: Document): boolean {
    const res = PetroBanglaDetector.detect(document.location?.href || '', document);
    return res.isSupported;
  },

  preProcessForm(document: Document): void {
    // Reveal hidden progressive disclosure tables before scanning
    try {
      const gradChk = document.querySelector<HTMLInputElement>(
        'input[type="checkbox"][id*="grad" i], input[type="checkbox"][name*="grad" i], #chk_grad'
      );
      if (gradChk && !gradChk.checked) {
        gradChk.checked = true;
        gradChk.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const masChk = document.querySelector<HTMLInputElement>(
        'input[type="checkbox"][id*="mast" i], input[type="checkbox"][name*="mast" i], #chk_masters'
      );
      if (masChk && !masChk.checked) {
        masChk.checked = true;
        masChk.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } catch {
      // safe fallback
    }
  },

  postFill(document: Document, profile: UserProfile): void {
    PetroBanglaRules.applyPostFillRules(document, profile);
  },

  documentMappings: [
    {
      canonicalKey: 'profile.documents.photo',
      documentType: 'photo',
      fieldNames: ['photo', 'photo_file', 'applicant_photo', 'file_photo'],
      fieldIds: ['photo', 'photo_file', 'applicant_photo', 'file_photo'],
      labelKeywords: ['Photograph', 'Photo', 'Applicant Photo', 'Recent Photograph', 'ছবি', 'প্রার্থীর ছবি'],
      previewSelectors: ['#photo_preview', '#img_photo', '.photo-preview img'],
      errorSelectors: ['#photo_error', '#photo_status'],
    },
    {
      canonicalKey: 'profile.documents.signature',
      documentType: 'signature',
      fieldNames: ['signature', 'sig', 'sign', 'sign_file', 'sig_file', 'applicant_signature'],
      fieldIds: ['signature', 'sig', 'sign', 'sign_file', 'sig_file', 'applicant_signature'],
      labelKeywords: ['Signature', 'Applicant Signature', 'স্বাক্ষর', 'প্রার্থীর স্বাক্ষর'],
      previewSelectors: ['#sig_preview', '#signature_preview', '#img_sig', '.signature-preview img'],
      errorSelectors: ['#sig_error', '#signature_error', '#sig_status'],
    },
  ],
};

export { PetroBanglaDetector, PetroBanglaRules, PETROBANGLA_FIELD_MAPS };
