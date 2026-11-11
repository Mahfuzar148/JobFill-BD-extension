// JobFill BD - PetroBangla / BOGMC Specific Form Rules & DOM Automations

import { UserProfile } from '../../types/profile';

export class PetroBanglaRules {
  /**
   * Protected field selectors that must NEVER be automated or cleared.
   */
  public static readonly PROTECTED_SELECTORS = [
    'input[name*="val_code" i]',
    'input[name*="captcha" i]',
    'input[id*="captcha" i]',
    'input[name*="security_code" i]',
    'input[type="password"]',
    'input[type="submit"]',
    'button[type="submit"]',
    'input[name*="submit" i]',
    'input[name*="token" i]',
  ];

  /**
   * Checks if an element is protected.
   */
  public static isProtected(element: HTMLElement): boolean {
    const tagName = element.tagName.toLowerCase();
    const type = (element.getAttribute('type') || '').toLowerCase();
    const name = (element.getAttribute('name') || '').toLowerCase();
    const id = (element.getAttribute('id') || '').toLowerCase();

    if (type === 'submit' || type === 'password' || tagName === 'button') {
      return true;
    }

    if (
      name.includes('captcha') ||
      name.includes('security') ||
      name.includes('val_code') ||
      id.includes('captcha')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Handles dynamic progressive disclosure checkboxes on BOGMC forms:
   * e.g. revealing Graduation or Masters tables if profile contains those degrees.
   */
  public static applyProgressiveDisclosures(doc: Document, profile: UserProfile): void {
    // If Graduation degree exists in profile, ensure the checkbox is checked to reveal fields
    const hasGrad = !!(
      profile.hasGraduation ||
      profile.graduation?.rollNumber ||
      profile.graduation?.universityInstitute
    );

    if (hasGrad) {
      const gradChk = doc.querySelector<HTMLInputElement>(
        'input[type="checkbox"][id*="grad" i], input[type="checkbox"][name*="grad" i], #chk_grad'
      );
      if (gradChk && !gradChk.checked) {
        gradChk.checked = true;
        gradChk.dispatchEvent(new Event('change', { bubbles: true }));
        gradChk.dispatchEvent(new Event('click', { bubbles: true }));
      }
    }

    // If Masters degree exists in profile
    const hasMasters = !!(
      profile.hasMasters ||
      profile.masters?.rollNumber ||
      profile.masters?.universityInstitute
    );

    if (hasMasters) {
      const masChk = doc.querySelector<HTMLInputElement>(
        'input[type="checkbox"][id*="mast" i], input[type="checkbox"][name*="mast" i], #chk_masters'
      );
      if (masChk && !masChk.checked) {
        masChk.checked = true;
        masChk.dispatchEvent(new Event('change', { bubbles: true }));
        masChk.dispatchEvent(new Event('click', { bubbles: true }));
      }
    }
  }

  /**
   * Applies post-fill synchronization such as "Same as Present Address",
   * Job Experience CurrentlyWorking checkbox, and application-specific Organization Choices.
   */
  public static applyPostFillRules(doc: Document, profile: UserProfile): void {
    // 1. Same as Present Address sync
    if (profile.address.sameAsPresent) {
      const sameChk = doc.querySelector<HTMLInputElement>(
        'input[type="checkbox"][id*="same" i], input[type="checkbox"][name*="same" i]'
      );
      if (sameChk && !sameChk.checked) {
        sameChk.click();
      }
    }

    // 2. Job Experience: CurrentlyWorking checkbox & End Date handling
    if (profile.jobExperiences && profile.jobExperiences.length > 0) {
      const firstExp = profile.jobExperiences[0];
      const currWorkChk = doc.querySelector<HTMLInputElement>(
        'input[type="checkbox"][name*="CurrentlyWorking" i], input[type="checkbox"][id*="CurrentlyWorking" i]'
      );
      if (currWorkChk) {
        currWorkChk.checked = !!firstExp.currentlyWorking;
        currWorkChk.dispatchEvent(new Event('change', { bubbles: true }));

        // If currently working, ensure end date input is not populated with a fake date
        if (firstExp.currentlyWorking) {
          const endDateInput = doc.querySelector<HTMLInputElement>(
            'input[name*="exp_end_date" i], input[id*="exp_end_date" i]'
          );
          if (endDateInput) {
            endDateInput.value = '';
          }
        }
      }
    }

    // 3. Organization Choice 1 & 2 (User Preferences)
    if (profile.special?.orgChoice1) {
      const choice1 = doc.querySelector<HTMLInputElement>(
        'input[name="org_choice_1"], input[id="org_choice_1"], input[name="orgChoice1"]'
      );
      if (choice1 && !choice1.value) {
        choice1.value = profile.special.orgChoice1;
        choice1.dispatchEvent(new Event('input', { bubbles: true }));
        choice1.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    if (profile.special?.orgChoice2) {
      const choice2 = doc.querySelector<HTMLInputElement>(
        'input[name="org_choice_2"], input[id="org_choice_2"], input[name="orgChoice2"]'
      );
      if (choice2 && !choice2.value) {
        choice2.value = profile.special.orgChoice2;
        choice2.dispatchEvent(new Event('input', { bubbles: true }));
        choice2.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }
}
