// JobFill BD - Dynamic Form State & Cascading Dropdowns Handler
// Implements Parts F, G & N of Master Engineering Specification
// Handles conditional reveals (Graduation/Masters/Exp checkboxes, NID yes/no toggles)
// and dependent cascading dropdowns (Division -> District -> Upazila/Thana)

import { UserProfile } from '../types/profile';
import { setSelectValue } from './dropdownMatcher';

export class DynamicFormHandler {
  // Prepares the form by triggering conditional reveals based on applicant's profile data
  public static prepareConditionalSections(document: Document, profile: UserProfile): void {
    // 1. Graduation Checkbox ("If Applicable")
    if (profile.graduation && profile.graduation.examination) {
      this.activateCheckbox(document, [
        '#chk_grad',
        '#grad_applicable',
        'input[type="checkbox"][id*="grad" i]',
        'input[type="checkbox"][name*="grad" i]',
        'input[type="checkbox"][id*="gra_" i]',
      ]);
    }

    // 2. Masters Checkbox ("If Applicable")
    if (profile.masters && profile.masters.examination) {
      this.activateCheckbox(document, [
        '#chk_masters',
        '#chk_mast',
        '#masters_applicable',
        'input[type="checkbox"][id*="mast" i]',
        'input[type="checkbox"][name*="mast" i]',
      ]);
    }

    // 3. Experience Checkbox ("If Applicable")
    if (profile.jobExperiences && profile.jobExperiences.length > 0) {
      this.activateCheckbox(document, [
        '#chk_exp',
        '#exp_applicable',
        'input[type="checkbox"][id*="exp" i]',
        'input[type="checkbox"][name*="exp" i]',
      ]);
    }

    // 4. Teletalk Yes/No Dropdowns that reveal text inputs
    this.handleTeletalkRevealDropdowns(document, profile);
  }

  // Toggles a checkbox if not already checked and dispatches native reactive events
  private static activateCheckbox(document: Document, selectors: string[]): boolean {
    for (const sel of selectors) {
      const chk = document.querySelector<HTMLInputElement>(sel);
      if (chk && !chk.checked) {
        chk.checked = true;
        chk.dispatchEvent(new Event('input', { bubbles: true }));
        chk.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }
    return false;
  }

  // Handles dropdowns like "Do you have National ID? -> Yes"
  private static handleTeletalkRevealDropdowns(document: Document, profile: UserProfile): void {
    // NID Available dropdown
    if (profile.personal.nid) {
      const nidSelect = document.querySelector<HTMLSelectElement>(
        'select[name*="has_nid" i], select[id*="has_nid" i], select[name="nid_status"]'
      );
      if (nidSelect && (nidSelect.value === '' || nidSelect.value.toLowerCase().includes('select'))) {
        setSelectValue(nidSelect, 'Yes');
      }
    }

    // Birth Registration dropdown
    if (profile.personal.birthReg) {
      const bregSelect = document.querySelector<HTMLSelectElement>(
        'select[name*="has_breg" i], select[id*="has_breg" i], select[name*="has_birth" i]'
      );
      if (bregSelect && (bregSelect.value === '' || bregSelect.value.toLowerCase().includes('select'))) {
        setSelectValue(bregSelect, 'Yes');
      }
    }

    // Passport dropdown
    if (profile.personal.passport) {
      const passSelect = document.querySelector<HTMLSelectElement>(
        'select[name*="has_pass" i], select[id*="has_pass" i]'
      );
      if (passSelect && (passSelect.value === '' || passSelect.value.toLowerCase().includes('select'))) {
        setSelectValue(passSelect, 'Yes');
      }
    }

    // Marital Status revealing spouse name
    if (profile.personal.maritalStatus === 'Married') {
      const maritalSelect = document.querySelector<HTMLSelectElement>(
        'select[name*="marital" i], select[id*="marital" i]'
      );
      if (maritalSelect && maritalSelect.value !== 'Married') {
        setSelectValue(maritalSelect, 'Married');
      }
    }
  }

  // Safely handles cascading addresses with asynchronous DOM mutation observation
  public static async resolveCascadingAddress(
    document: Document,
    prefix: 'present' | 'permanent',
    division: string,
    district: string,
    upazila: string
  ): Promise<void> {
    const divSelect = document.querySelector<HTMLSelectElement>(
      `select[name*="${prefix}" i][name*="div" i], select[id*="${prefix}" i][id*="div" i]`
    );
    const distSelect = document.querySelector<HTMLSelectElement>(
      `select[name*="${prefix}" i][name*="dist" i], select[id*="${prefix}" i][id*="dist" i]`
    );
    const upzSelect = document.querySelector<HTMLSelectElement>(
      `select[name*="${prefix}" i][name*="upaz" i], select[name*="${prefix}" i][name*="thana" i], select[id*="${prefix}" i][id*="upaz" i]`
    );

    // Step 1: Set Division if present
    if (divSelect && division) {
      setSelectValue(divSelect, division);
      await this.sleep(120);
    }

    // Step 2: Set District
    if (distSelect && district) {
      setSelectValue(distSelect, district);
      await this.sleep(150);
    }

    // Step 3: Set Upazila
    if (upzSelect && upazila) {
      setSelectValue(upzSelect, upazila);
    }
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
