// JobFill BD - BPSC (Bangladesh Public Service Commission) Adapter
import { SiteAdapter } from './types';
import { UserProfile } from '../types/profile';

export const BPSCAdapter: SiteAdapter = {
  id: 'bpsc',
  name: 'BPSC (BCS Form-1 & Non-Cadre)',
  description: 'Specialized for bpsc.teletalk.com.bd and bpsc.gov.bd recruitment applications',

  matchesUrl(url: string): boolean {
    const u = url.toLowerCase();
    return u.includes('bpsc.teletalk.com.bd') || u.includes('bpsc.gov.bd');
  },

  detectSite(document: Document): boolean {
    const text = document.body.textContent || '';
    return text.includes('Bangladesh Public Service Commission') || text.includes('BPSC') || text.includes('BCS');
  },

  postFill(document: Document, profile: UserProfile) {
    // Fill special BCS measurements if requested
    if (profile.special.heightCm) {
      const hInput = document.querySelector<HTMLInputElement>('input[name*="height" i]');
      if (hInput && !hInput.value) {
        hInput.value = profile.special.heightCm;
        hInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    if (profile.special.weightKg) {
      const wInput = document.querySelector<HTMLInputElement>('input[name*="weight" i]');
      if (wInput && !wInput.value) {
        wInput.value = profile.special.weightKg;
        wInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  },
};
