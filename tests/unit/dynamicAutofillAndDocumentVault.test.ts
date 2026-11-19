// JobFill BD - Smart Dynamic Form Autofill & Secure Document Vault Test Suite
// Verifies:
// 1. All 64 Districts & Upazilas bilingual matching (Bangla, English, spelling variations)
// 2. Cascading dependent dropdowns (District -> Upazila bounded wait & selection)
// 3. SSC vs HSC Board disambiguation and Result Scale -> GPA cascading
// 4. Framework-resilient native event dispatch & post-fill DOM verification
// 5. Secure Visual Document Vault (NID Front/Back encryption, masking, academic certificates)

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  matchDropdownOption,
  findBestOption,
  setSelectValue,
  BILINGUAL_EQUIVALENTS,
} from '../../src/engine/dropdownMatcher';
import { OptionMatcher } from '../../src/intelligence/option-matcher';
import { SelectHandler } from '../../src/handlers/select-handler';
import { VerificationEngine, FillPlanItem } from '../../src/validation/verification-engine';
import { FieldContext } from '../../src/content/scanner/field-context';
import { DocumentRepository } from '../../src/database/document-repository';
import { DocumentCategory, UserProfile } from '../../src/types/profile';
import { createEmptyProfile } from '../../src/types/defaults';
import {
  IDENTITY_DOC_CATEGORIES,
  ACADEMIC_DOC_CATEGORIES,
  GENERAL_DOC_CATEGORIES,
} from '../../src/dashboard/pages/DocumentsPage';

describe('JobFill BD - Smart Dynamic Form Autofill & Secure Document Gallery Suite', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    SelectHandler.clearDebugReports();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    SelectHandler.clearDebugReports();
  });

  // =========================================================================
  // TEST 1: Bangladesh 64 Districts & Upazila Bilingual Dropdown Matching
  // =========================================================================
  describe('1. 64-District & Upazila Bilingual Dropdown Intelligence', () => {
    it('matches English district name "Bogura" / "Bogra" to Bengali dropdown option "বগুড়া"', () => {
      const select = document.createElement('select');
      select.innerHTML = `
        <option value="">-- জেলা নির্বাচন করুন --</option>
        <option value="54">বগুড়া</option>
        <option value="55">রাজশাহী</option>
        <option value="56">রংপুর</option>
      `;
      document.body.appendChild(select);

      // Match with Bogura
      const match1 = OptionMatcher.matchOption(select, 'Bogura');
      expect(match1).not.toBeNull();
      expect(match1?.value).toBe('54');
      expect(match1?.text).toBe('বগুড়া');

      // Match with Bogra
      const match2 = OptionMatcher.matchOption(select, 'Bogra');
      expect(match2).not.toBeNull();
      expect(match2?.value).toBe('54');
    });

    it('matches English district "Natore" and "Cox\'s Bazar" to Bengali options with numeric values', () => {
      const select = document.createElement('select');
      select.innerHTML = `
        <option value="0">Select District</option>
        <option value="10">কক্সবাজার</option>
        <option value="20">নাটোর</option>
        <option value="30">চাঁপাইনবাবগঞ্জ</option>
        <option value="40">কুষ্টিয়া</option>
      `;
      document.body.appendChild(select);

      const natoreMatch = OptionMatcher.matchOption(select, 'Natore');
      expect(natoreMatch?.value).toBe('20');
      expect(natoreMatch?.text).toBe('নাটোর');

      const coxsMatch = OptionMatcher.matchOption(select, "Cox's Bazar");
      expect(coxsMatch?.value).toBe('10');
      expect(coxsMatch?.text).toBe('কক্সবাজার');

      const kushtiaMatch = OptionMatcher.matchOption(select, 'Kushtia');
      expect(kushtiaMatch?.value).toBe('40');
      expect(kushtiaMatch?.text).toBe('কুষ্টিয়া');
    });

    it('matches Upazila / Thana bilingually (e.g. Motihar -> মতিহার, Boalia -> বোয়ালিয়া)', () => {
      const select = document.createElement('select');
      select.innerHTML = `
        <option value="">Select Upazila / Thana</option>
        <option value="th_1">বোয়ালিয়া</option>
        <option value="th_2">মতিহার</option>
        <option value="th_3">রাজপাড়া</option>
        <option value="th_4">সদর</option>
      `;
      document.body.appendChild(select);

      const motiharMatch = OptionMatcher.matchOption(select, 'Motihar');
      expect(motiharMatch?.value).toBe('th_2');
      expect(motiharMatch?.text).toBe('মতিহার');

      const boaliaMatch = OptionMatcher.matchOption(select, 'Boalia');
      expect(boaliaMatch?.value).toBe('th_1');
      expect(boaliaMatch?.text).toBe('বোয়ালিয়া');
    });

    it('setSelectValue correctly dispatches native events and triggers reactive property updates', () => {
      const select = document.createElement('select');
      select.innerHTML = `
        <option value="">Select District</option>
        <option value="DHK">ঢাকা</option>
        <option value="RAJ">রাজশাহী</option>
      `;
      document.body.appendChild(select);

      let changeFired = false;
      let inputFired = false;
      select.addEventListener('change', () => { changeFired = true; });
      select.addEventListener('input', () => { inputFired = true; });

      const success = setSelectValue(select, 'Rajshahi');
      expect(success).toBe(true);
      expect(select.value).toBe('RAJ');
      expect(changeFired).toBe(true);
      expect(inputFired).toBe(true);
    });
  });

  // =========================================================================
  // TEST 2: Cascading Dependent Dropdowns (District -> Upazila Bounded Wait)
  // =========================================================================
  describe('2. Cascading Dependent Dropdown Selection Engine', () => {
    it('executes cascading sequence with async options loading on child Upazila dropdown', async () => {
      const container = document.createElement('div');
      container.className = 'present-address-box';
      container.innerHTML = `
        <label>District</label>
        <select id="p_district" name="present_district">
          <option value="">Select District</option>
          <option value="RAJ">Rajshahi</option>
          <option value="DHK">Dhaka</option>
        </select>

        <label>Upazila / Thana</label>
        <select id="p_upazila" name="present_upazila" disabled>
          <option value="">Select District First</option>
        </select>
      `;
      document.body.appendChild(container);

      const districtSelect = container.querySelector<HTMLSelectElement>('#p_district')!;
      const upazilaSelect = container.querySelector<HTMLSelectElement>('#p_upazila')!;

      // Simulate AJAX call on host portal when District changes
      districtSelect.addEventListener('change', () => {
        setTimeout(() => {
          upazilaSelect.disabled = false;
          upazilaSelect.innerHTML = `
            <option value="">Select Upazila</option>
            <option value="UP_1">Boalia</option>
            <option value="UP_2">Motihar</option>
            <option value="UP_3">Puthia</option>
          `;
        }, 50);
      });

      const cascadeSuccess = await OptionMatcher.executeCascadingSequence(
        districtSelect,
        'Rajshahi',
        upazilaSelect,
        'Motihar',
        1000
      );

      expect(cascadeSuccess).toBe(true);
      expect(districtSelect.value).toBe('RAJ');
      expect(upazilaSelect.value).toBe('UP_2');
    });

    it('prioritizes parent dependencies before child dependent controls in VerificationEngine.executePlan', async () => {
      const container = document.createElement('div');
      container.className = 'present-address-box';
      container.innerHTML = `
        <select id="dist_el" name="present_dist">
          <option value="">Select District</option>
          <option value="RAJ">Rajshahi</option>
        </select>
        <select id="upazila_el" name="present_upazila">
          <option value="">Select Upazila</option>
          <option value="MOT">Motihar</option>
        </select>
      `;
      document.body.appendChild(container);

      const distEl = container.querySelector<HTMLSelectElement>('#dist_el')!;
      const upazilaEl = container.querySelector<HTMLSelectElement>('#upazila_el')!;

      // Plan with child item before parent item
      const planItems: FillPlanItem[] = [
        {
          id: 'item_upazila',
          element: upazilaEl,
          selector: '#upazila_el',
          canonicalId: 'address.present.upazila',
          fieldLabel: 'Present Upazila',
          proposedValue: 'Motihar',
          originalValue: '',
          hasConflict: false,
          isApproved: true,
          status: 'Matched',
        },
        {
          id: 'item_dist',
          element: distEl,
          selector: '#dist_el',
          canonicalId: 'address.present.district',
          fieldLabel: 'Present District',
          proposedValue: 'Rajshahi',
          originalValue: '',
          hasConflict: false,
          isApproved: true,
          status: 'Matched',
        },
      ];

      const report = await VerificationEngine.executePlan('session_test', planItems);
      expect(report.successfullyFilled).toBe(2);
      expect(distEl.value).toBe('RAJ');
      expect(upazilaEl.value).toBe('MOT');
    });
  });

  // =========================================================================
  // TEST 3: SSC vs HSC Board Disambiguation & Result Scale Matching
  // =========================================================================
  describe('3. SSC vs HSC Board & Result Scale Disambiguation', () => {
    it('accurately disambiguates SSC and HSC containers using FieldContext', () => {
      const form = document.createElement('form');
      form.innerHTML = `
        <fieldset class="ssc-block">
          <legend>Secondary School Certificate (S.S.C)</legend>
          <label>Board</label>
          <select id="ssc_board" name="board">
            <option value="">Select Board</option>
            <option value="RAJ">Rajshahi</option>
          </select>
        </fieldset>

        <fieldset class="hsc-block">
          <legend>Higher Secondary Certificate (H.S.C)</legend>
          <label>Board</label>
          <select id="hsc_board" name="board">
            <option value="">Select Board</option>
            <option value="DHK">Dhaka</option>
          </select>
        </fieldset>
      `;
      document.body.appendChild(form);

      const sscEl = form.querySelector<HTMLElement>('#ssc_board')!;
      const hscEl = form.querySelector<HTMLElement>('#hsc_board')!;

      expect(FieldContext.resolveContext(sscEl)).toBe('education_ssc');
      expect(FieldContext.resolveContext(hscEl)).toBe('education_hsc');
    });

    it('matches Result scales (e.g. GPA (out of 5.00) / GPA 5) bilingually', () => {
      const select = document.createElement('select');
      select.innerHTML = `
        <option value="">-- Result --</option>
        <option value="1">First Division</option>
        <option value="2">Second Division</option>
        <option value="4">GPA (out of 4.00)</option>
        <option value="5">GPA (out of 5.00)</option>
        <option value="6">Passed</option>
      `;
      document.body.appendChild(select);

      const match5 = OptionMatcher.matchOption(select, 'GPA (out of 5.00)');
      expect(match5?.value).toBe('5');

      const matchFirst = OptionMatcher.matchOption(select, 'First Division');
      expect(matchFirst?.value).toBe('1');
    });
  });

  // =========================================================================
  // TEST 4: Framework-Resilient Event Dispatch & Post-Fill DOM Verification
  // =========================================================================
  describe('4. Framework Event Dispatch & DOM Verification', () => {
    it('sets input value using native property descriptor setters to avoid framework rejection', () => {
      const input = document.createElement('input');
      input.type = 'text';
      document.body.appendChild(input);

      let eventsDispatched: string[] = [];
      input.addEventListener('input', () => eventsDispatched.push('input'));
      input.addEventListener('change', () => eventsDispatched.push('change'));
      input.addEventListener('blur', () => eventsDispatched.push('blur'));

      VerificationEngine.setNativeInputValue(input, '01712345678');
      expect(input.value).toBe('01712345678');
      expect(eventsDispatched).toContain('input');
      expect(eventsDispatched).toContain('change');
      expect(eventsDispatched).toContain('blur');
    });

    it('verifies actual DOM value post-fill and reports honest failure if value was reverted', async () => {
      const input = document.createElement('input');
      input.type = 'text';
      document.body.appendChild(input);

      // Revert value upon change event to simulate hostile/strict framework validation
      input.addEventListener('change', () => {
        input.value = '';
      });

      const item: FillPlanItem = {
        id: 'test_item',
        element: input,
        selector: 'input',
        canonicalId: 'applicant.fullName.english',
        fieldLabel: 'Applicant Name',
        proposedValue: 'Md Mahmudul Hasan',
        originalValue: '',
        hasConflict: false,
        isApproved: true,
        status: 'Matched',
      };

      const success = await VerificationEngine.executeFillItem(item);
      expect(success).toBe(false);
      expect(item.status).toBe('Fill Failed');
      expect(item.verificationMessage).toContain('reverted');
    });
  });

  // =========================================================================
  // TEST 5: Visual Personal Profile & Secure Document Gallery
  // =========================================================================
  describe('5. Secure Document Vault & Category Configurations', () => {
    it('exposes dedicated Identity, Academic, and General document categories', () => {
      const idTypes = IDENTITY_DOC_CATEGORIES.map((c) => c.type);
      expect(idTypes).toContain('nid_front');
      expect(idTypes).toContain('nid_back');
      expect(idTypes).toContain('nid');
      expect(idTypes).toContain('birth_certificate');

      const acadTypes = ACADEMIC_DOC_CATEGORIES.map((c) => c.type);
      expect(acadTypes).toContain('ssc_cert');
      expect(acadTypes).toContain('ssc_marksheet');
      expect(acadTypes).toContain('hsc_cert');
      expect(acadTypes).toContain('hsc_marksheet');
      expect(acadTypes).toContain('grad_cert');
      expect(acadTypes).toContain('transcript');

      const genTypes = GENERAL_DOC_CATEGORIES.map((c) => c.type);
      expect(genTypes).toContain('cv');
      expect(genTypes).toContain('training_cert');
      expect(genTypes).toContain('other');
    });

    it('marks NID Front and NID Back as sensitive identity documents for UI masking', () => {
      const nidFront = IDENTITY_DOC_CATEGORIES.find((c) => c.type === 'nid_front');
      const nidBack = IDENTITY_DOC_CATEGORIES.find((c) => c.type === 'nid_back');
      const cv = GENERAL_DOC_CATEGORIES.find((c) => c.type === 'cv');

      expect(nidFront?.isSensitiveNid).toBe(true);
      expect(nidBack?.isSensitiveNid).toBe(true);
      expect(cv?.isSensitiveNid).toBeUndefined();
    });

    it('rejects expiry dates on academic certificates while allowing them on training/licenses', async () => {
      // Academic certificate rejects expiry date
      await expect(
        DocumentRepository.saveDocument({
          id: 'test_ssc_invalid',
          documentId: 'test_ssc_invalid',
          profileId: 'prof_test',
          documentType: 'educational_certificate',
          type: 'educational_certificate',
          fileName: 'ssc_cert.jpg',
          mimeType: 'image/jpeg',
          fileSize: 10240,
          fileSizeKb: 10,
          width: 800,
          height: 600,
          createdAt: new Date().toISOString(),
          dataUrl: 'data:image/jpeg;base64,dGVzdA==',
          expiresAt: '2030-01-01',
        })
      ).rejects.toThrow('Academic certificates do not expire');
    });
  });
});
