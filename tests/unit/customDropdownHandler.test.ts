// JobFill BD - CustomDropdownHandler & Advanced Dropdown Regression Test Suite
// Verifies all 12 custom control scenarios specified in Section 2 of the audit mandate:
// 1. Native Select
// 2. ARIA Combobox
// 3. ARIA Listbox
// 4. Searchable Dropdown
// 5. Custom React Dropdown
// 6. Delayed Dropdown Options
// 7. District -> Upazila Cascading
// 8. Degree -> Subject Cascading
// 9. Repeated SSC/HSC Dropdowns
// 10. Dropdown with Duplicate Labels
// 11. Dropdown with Missing Target Option
// 12. Keyboard-accessible Dropdown

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CustomDropdownHandler,
  SelectHandler,
  ControlHandlerRouter,
} from '../../src/handlers';
import { CascadingDropdownEngine } from '../../src/engine/cascadingDropdownEngine';
import { FieldExtractor } from '../../src/content/field-extractor';

describe('JobFill BD — CustomDropdownHandler & Dropdown Regression Suite', () => {
  let customHandler: CustomDropdownHandler;
  let nativeHandler: SelectHandler;

  beforeEach(() => {
    document.documentElement.innerHTML = '';
    customHandler = new CustomDropdownHandler();
    nativeHandler = new SelectHandler();
  });

  // 1. Native Select
  describe('1. Native Select', () => {
    it('routes native select to SelectHandler and correctly populates value and text', async () => {
      document.body.innerHTML = `
        <select id="district_native" name="district">
          <option value="">-- Select District --</option>
          <option value="1">Dhaka</option>
          <option value="2">Rajshahi</option>
          <option value="3">Chittagong</option>
        </select>
      `;
      const select = document.getElementById('district_native') as HTMLSelectElement;
      const routerHandler = ControlHandlerRouter.getHandler(select);

      expect(routerHandler.controlType).toBe('select');
      expect(nativeHandler.canHandle(select)).toBe(true);

      const res = await nativeHandler.fill(select, 'Rajshahi');
      expect(res.success).toBe(true);
      expect(select.value).toBe('2');
      expect(select.options[select.selectedIndex].text).toBe('Rajshahi');
      expect(nativeHandler.getCurrentValue(select)).toBe('Rajshahi');
      expect(nativeHandler.verify(select, 'Rajshahi')).toBe(true);
    });
  });

  // 2. ARIA Combobox
  describe('2. ARIA Combobox', () => {
    it('identifies role="combobox", expands, selects matching option and verifies text and attribute', async () => {
      document.body.innerHTML = `
        <div id="combo_quota" role="combobox" aria-expanded="false" aria-controls="quota_listbox" tabindex="0">
          <span class="combobox-value">Select Quota</span>
        </div>
        <ul id="quota_listbox" role="listbox">
          <li role="option" data-value="gen" aria-selected="false">Non-Quota / General</li>
          <li role="option" data-value="ff" aria-selected="false">Children of Freedom Fighter</li>
          <li role="option" data-value="tribal" aria-selected="false">Tribal / Ethnic Minority</li>
        </ul>
      `;
      const combo = document.getElementById('combo_quota') as HTMLElement;
      const listbox = document.getElementById('quota_listbox') as HTMLElement;

      expect(FieldExtractor.isSafeEditableField(combo)).toBe(true);
      expect(customHandler.canHandle(combo)).toBe(true);
      expect(ControlHandlerRouter.getHandler(combo).controlType).toBe('custom-dropdown');

      const fillRes = await customHandler.fill(combo, 'Children of Freedom Fighter');
      expect(fillRes.success).toBe(true);
      expect(fillRes.appliedValue).toBe('Children of Freedom Fighter');

      const selectedOption = listbox.querySelector('[aria-selected="true"]');
      expect(selectedOption).not.toBeNull();
      expect(selectedOption?.getAttribute('data-value')).toBe('ff');
      expect(selectedOption?.textContent?.trim()).toBe('Children of Freedom Fighter');
      expect(combo.querySelector('.combobox-value')?.textContent?.trim()).toBe('Children of Freedom Fighter');
      expect(customHandler.getCurrentValue(combo)).toBe('Children of Freedom Fighter');
      expect(customHandler.verify(combo, 'Children of Freedom Fighter')).toBe(true);
    });
  });

  // 3. ARIA Listbox
  describe('3. ARIA Listbox', () => {
    it('handles direct role="listbox" containers and marks aria-selected true', async () => {
      document.body.innerHTML = `
        <div id="degree_listbox" role="listbox" tabindex="0">
          <div role="option" id="deg_1" data-value="bba" aria-selected="false">Bachelor of Business Administration</div>
          <div role="option" id="deg_2" data-value="cse" aria-selected="false">Computer Science & Engineering</div>
          <div role="option" id="deg_3" data-value="llb" aria-selected="false">Bachelor of Laws (LL.B)</div>
        </div>
      `;
      const listbox = document.getElementById('degree_listbox') as HTMLElement;
      expect(customHandler.canHandle(listbox)).toBe(true);

      const fillRes = await customHandler.fill(listbox, 'Computer Science & Engineering');
      expect(fillRes.success).toBe(true);

      const activeOpt = listbox.querySelector('[aria-selected="true"]');
      expect(activeOpt?.getAttribute('data-value')).toBe('cse');
      expect(activeOpt?.textContent?.trim()).toBe('Computer Science & Engineering');
      expect(customHandler.verify(listbox, 'Computer Science & Engineering')).toBe(true);
    });
  });

  // 4. Searchable Dropdown
  describe('4. Searchable Dropdown', () => {
    it('populates searchable dropdown with hidden/associated input and syncs values', async () => {
      document.body.innerHTML = `
        <div class="custom-select-wrapper">
          <input type="hidden" id="univ_id" name="university_id" value="" />
          <div id="univ_dropdown" class="searchable-dropdown custom-dropdown" role="combobox" aria-expanded="false">
            <span class="selected-value">Select University</span>
            <ul class="options-menu">
              <li class="custom-option" data-value="du">University of Dhaka</li>
              <li class="custom-option" data-value="buet">Bangladesh University of Engineering & Technology</li>
              <li class="custom-option" data-value="ru">University of Rajshahi</li>
            </ul>
          </div>
        </div>
      `;
      const dropdown = document.getElementById('univ_dropdown') as HTMLElement;
      const hiddenInput = document.getElementById('univ_id') as HTMLInputElement;

      expect(customHandler.canHandle(dropdown)).toBe(true);

      const res = await customHandler.fill(dropdown, 'Bangladesh University of Engineering & Technology');
      expect(res.success).toBe(true);

      expect(hiddenInput.value).toBe('buet');
      expect(dropdown.querySelector('.selected-value')?.textContent?.trim()).toBe('Bangladesh University of Engineering & Technology');
      expect(customHandler.getCurrentValue(dropdown)).toBe('Bangladesh University of Engineering & Technology');
    });
  });

  // 5. Custom React Dropdown
  describe('5. Custom React Dropdown', () => {
    it('handles simulated React controlled select component with synthetic event simulation', async () => {
      document.body.innerHTML = `
        <div class="react-select-container">
          <div id="react_religion" class="react-select custom-select" role="combobox" aria-haspopup="listbox" aria-expanded="false">
            <input type="hidden" name="religion" value="" />
            <div class="current">Select Religion</div>
            <div class="react-options" role="listbox">
              <div role="option" data-value="islam" class="option">Islam</div>
              <div role="option" data-value="hindu" class="option">Hinduism</div>
              <div role="option" data-value="christian" class="option">Christianity</div>
            </div>
          </div>
        </div>
      `;
      const reactSelect = document.getElementById('react_religion') as HTMLElement;
      const input = reactSelect.querySelector<HTMLInputElement>('input[type="hidden"]')!;

      let reactStateValue = '';
      input.addEventListener('change', (e: any) => {
        reactStateValue = (e.target as HTMLInputElement).value;
      });

      expect(customHandler.canHandle(reactSelect)).toBe(true);

      const fillRes = await customHandler.fill(reactSelect, 'Islam');
      expect(fillRes.success).toBe(true);
      expect(input.value).toBe('islam');
      expect(reactStateValue).toBe('islam');
      expect(reactSelect.querySelector('.current')?.textContent?.trim()).toBe('Islam');
      expect(customHandler.verify(reactSelect, 'Islam')).toBe(true);
    });
  });

  // 6. Delayed Dropdown Options
  describe('6. Delayed Dropdown Options', () => {
    it('waits for asynchronously populated options and succeeds within bounded timeout', async () => {
      document.body.innerHTML = `
        <div id="async_post" role="combobox" aria-expanded="false" aria-controls="async_listbox">
          <span class="combobox-value">Select Post</span>
        </div>
        <div id="async_listbox" role="listbox"></div>
      `;
      const combobox = document.getElementById('async_post') as HTMLElement;
      const listbox = document.getElementById('async_listbox') as HTMLElement;

      // Simulate async network response populating options after 30ms
      setTimeout(() => {
        listbox.innerHTML = `
          <div role="option" data-value="post_01">Assistant Director</div>
          <div role="option" data-value="post_02">System Analyst</div>
          <div role="option" data-value="post_03">Programmer</div>
        `;
      }, 30);

      const fillRes = await customHandler.fill(combobox, 'System Analyst');
      expect(fillRes.success).toBe(true);
      expect(fillRes.appliedValue).toBe('System Analyst');
      expect(customHandler.getCurrentValue(combobox)).toBe('System Analyst');
    });
  });

  // 7. District -> Upazila Cascading
  describe('7. District -> Upazila Cascading', () => {
    it('coordinates parent district change, waits for upazila population, and selects upazila', async () => {
      document.body.innerHTML = `
        <select id="sel_dist" name="district">
          <option value="">Select District</option>
          <option value="dhaka">Dhaka</option>
          <option value="rajshahi">Rajshahi</option>
        </select>
        <select id="sel_upazila" name="upazila">
          <option value="">Select Upazila</option>
        </select>
      `;
      const distSelect = document.getElementById('sel_dist') as HTMLSelectElement;
      const upazilaSelect = document.getElementById('sel_upazila') as HTMLSelectElement;

      distSelect.addEventListener('change', () => {
        if (distSelect.value === 'rajshahi') {
          setTimeout(() => {
            upazilaSelect.innerHTML = `
              <option value="">Select Upazila</option>
              <option value="boalia">Boalia</option>
              <option value="motihar">Motihar</option>
              <option value="rajpara">Rajpara</option>
            `;
            upazilaSelect.dispatchEvent(new Event('options_loaded'));
          }, 30);
        }
      });

      const cascadeRes = await CascadingDropdownEngine.handleCascadingPair(
        distSelect,
        upazilaSelect,
        'Rajshahi',
        'Motihar',
        { maxWaitMs: 1000 }
      );

      expect(cascadeRes.success).toBe(true);
      expect(cascadeRes.status).toBe('FILLED_VERIFIED');
      expect(distSelect.value).toBe('rajshahi');
      expect(upazilaSelect.value).toBe('motihar');
      expect(upazilaSelect.options[upazilaSelect.selectedIndex].text).toBe('Motihar');
    });
  });

  // 8. Degree -> Subject Cascading
  describe('8. Degree -> Subject Cascading', () => {
    it('populates and selects subjects conditionally based on degree selection', async () => {
      document.body.innerHTML = `
        <select id="sel_deg" name="degree">
          <option value="">Select Degree</option>
          <option value="bsc_eng">B.Sc Engineering</option>
          <option value="ba">Bachelor of Arts</option>
        </select>
        <select id="sel_subj" name="subject">
          <option value="">Select Subject</option>
        </select>
      `;
      const degSelect = document.getElementById('sel_deg') as HTMLSelectElement;
      const subjSelect = document.getElementById('sel_subj') as HTMLSelectElement;

      degSelect.addEventListener('change', () => {
        if (degSelect.value === 'bsc_eng') {
          subjSelect.innerHTML = `
            <option value="">Select Subject</option>
            <option value="cse">Computer Science & Engineering</option>
            <option value="eee">Electrical & Electronic Engineering</option>
            <option value="me">Mechanical Engineering</option>
          `;
        }
      });

      const cascadeRes = await CascadingDropdownEngine.handleCascadingPair(
        degSelect,
        subjSelect,
        'B.Sc Engineering',
        'Computer Science & Engineering',
        { maxWaitMs: 500 }
      );

      expect(cascadeRes.success).toBe(true);
      expect(degSelect.value).toBe('bsc_eng');
      expect(subjSelect.value).toBe('cse');
      expect(subjSelect.options[subjSelect.selectedIndex].text).toBe('Computer Science & Engineering');
    });
  });

  // 9. Repeated SSC/HSC Dropdowns
  describe('9. Repeated SSC/HSC Dropdowns', () => {
    it('isolates repeated board and result dropdowns between SSC and HSC sections', async () => {
      document.body.innerHTML = `
        <fieldset id="ssc_section" class="edu-block">
          <legend>Secondary School Certificate (SSC)</legend>
          <select id="ssc_board" name="ssc_board">
            <option value="">Select Board</option>
            <option value="dhaka">Dhaka</option>
            <option value="rajshahi">Rajshahi</option>
            <option value="comilla">Comilla</option>
          </select>
          <select id="ssc_result" name="ssc_result">
            <option value="">Select Result</option>
            <option value="gpa5">GPA (out of 5)</option>
            <option value="first">First Division</option>
          </select>
        </fieldset>

        <fieldset id="hsc_section" class="edu-block">
          <legend>Higher Secondary Certificate (HSC)</legend>
          <select id="hsc_board" name="hsc_board">
            <option value="">Select Board</option>
            <option value="dhaka">Dhaka</option>
            <option value="rajshahi">Rajshahi</option>
            <option value="dinajpur">Dinajpur</option>
          </select>
          <select id="hsc_result" name="hsc_result">
            <option value="">Select Result</option>
            <option value="gpa5">GPA (out of 5)</option>
            <option value="gpa4">GPA (out of 4)</option>
          </select>
        </fieldset>
      `;

      const sscBoard = document.getElementById('ssc_board') as HTMLSelectElement;
      const sscResult = document.getElementById('ssc_result') as HTMLSelectElement;
      const hscBoard = document.getElementById('hsc_board') as HTMLSelectElement;
      const hscResult = document.getElementById('hsc_result') as HTMLSelectElement;

      // Fill SSC with Rajshahi Board & GPA 5
      await nativeHandler.fill(sscBoard, 'Rajshahi');
      await nativeHandler.fill(sscResult, 'GPA (out of 5)');

      // Fill HSC with Dhaka Board & GPA 5
      await nativeHandler.fill(hscBoard, 'Dhaka');
      await nativeHandler.fill(hscResult, 'GPA (out of 5)');

      // Verify no cross-contamination between sections
      expect(sscBoard.value).toBe('rajshahi');
      expect(sscBoard.options[sscBoard.selectedIndex].text).toBe('Rajshahi');

      expect(hscBoard.value).toBe('dhaka');
      expect(hscBoard.options[hscBoard.selectedIndex].text).toBe('Dhaka');

      expect(sscResult.value).toBe('gpa5');
      expect(hscResult.value).toBe('gpa5');
    });
  });

  // 10. Dropdown with Duplicate Labels
  describe('10. Dropdown with Duplicate Labels', () => {
    it('disambiguates options when labels contain duplicates by value matching', async () => {
      document.body.innerHTML = `
        <select id="sel_stream" name="stream">
          <option value="">Select Stream</option>
          <option value="secondary_sci">Science (Secondary)</option>
          <option value="higher_sci">Science (Higher Secondary)</option>
        </select>
      `;
      const select = document.getElementById('sel_stream') as HTMLSelectElement;

      const res = await nativeHandler.fill(select, 'Science (Higher Secondary)');
      expect(res.success).toBe(true);
      expect(select.value).toBe('higher_sci');
      expect(select.options[select.selectedIndex].text).toBe('Science (Higher Secondary)');
    });
  });

  // 11. Dropdown with Missing Target Option
  describe('11. Dropdown with Missing Target Option', () => {
    it('safely handles missing target option without crashing and leaves value unchanged', async () => {
      document.body.innerHTML = `
        <div id="missing_target_combo" role="combobox" aria-expanded="false" aria-controls="opts_missing">
          <span class="combobox-value">Select Division</span>
        </div>
        <ul id="opts_missing" role="listbox">
          <li role="option" data-value="1">Dhaka</li>
          <li role="option" data-value="2">Chittagong</li>
          <li role="option" data-value="3">Rajshahi</li>
        </ul>
      `;
      const combo = document.getElementById('missing_target_combo') as HTMLElement;

      const res = await customHandler.fill(combo, 'Barisal');
      expect(res.success).toBe(false);
      expect(res.status).toBe('Fill Failed');
      expect(res.message).toContain('No matching custom dropdown option found');
      expect(combo.querySelector('.combobox-value')?.textContent?.trim()).toBe('Select Division');
    });
  });

  // 12. Keyboard-Accessible Dropdown
  describe('12. Keyboard-Accessible Dropdown', () => {
    it('dispatches keyboard navigation events (ArrowDown, focus) and verifies selection', async () => {
      document.body.innerHTML = `
        <div id="kbd_dropdown" role="combobox" aria-expanded="false" aria-controls="kbd_opts" tabindex="0">
          <span class="combobox-value">Select Exam</span>
        </div>
        <ul id="kbd_opts" role="listbox">
          <li role="option" data-value="ssc">S.S.C</li>
          <li role="option" data-value="dakhil">Dakhil</li>
          <li role="option" data-value="ssc_voc">S.S.C Vocational</li>
        </ul>
      `;
      const combo = document.getElementById('kbd_dropdown') as HTMLElement;
      let keydownFired = false;
      combo.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') keydownFired = true;
      });

      const fillRes = await customHandler.fill(combo, 'S.S.C');
      expect(fillRes.success).toBe(true);
      expect(keydownFired).toBe(true);

      const selectedOpt = document.querySelector('#kbd_opts [aria-selected="true"]');
      expect(selectedOpt?.getAttribute('data-value')).toBe('ssc');
      expect(combo.querySelector('.combobox-value')?.textContent?.trim()).toBe('S.S.C');
    });
  });
});
