// JobFill BD - Generic Recruitment Form Adapter
// Universal fallback adapter for unknown Bangladesh government and autonomous portals
import { SiteAdapter } from './types';
import { UserProfile } from '../types/profile';

export const GenericAdapter: SiteAdapter = {
  id: 'generic',
  name: 'Generic Bangladesh Recruitment Portal Adapter',
  description: 'Universal fallback adapter using 5-layer heuristic intelligence for unknown government forms',

  matchesUrl(_url: string): boolean {
    return true; // Matches any web form
  },

  detectSite(document: Document): boolean {
    // Detects any page with form controls
    return document.querySelectorAll('input:not([type="hidden"]), select, textarea').length >= 3;
  },

  preProcessForm(document: Document) {
    // Reveal any hidden tabs or accordions
    const collapsibles = document.querySelectorAll<HTMLElement>('.collapse:not(.show), .accordion-collapse:not(.show)');
    collapsibles.forEach((el) => {
      el.classList.add('show');
    });
  },

  postFill(document: Document, profile: UserProfile) {
    // Handle "Same as Present Address" checkbox if present and synchronize strictly with profile
    const sameAddressChk = document.querySelector<HTMLInputElement>(
      'input[type="checkbox"][id*="same" i], input[type="checkbox"][name*="same" i], input[type="checkbox"]#copy, input[type="checkbox"][name="copy"]'
    );
    if (sameAddressChk) {
      const shouldCheck = !!profile.address.sameAsPresent;
      if (sameAddressChk.checked !== shouldCheck) {
        sameAddressChk.checked = shouldCheck;
        sameAddressChk.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  },
};
