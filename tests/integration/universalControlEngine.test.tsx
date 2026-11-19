// JobFill BD - Universal Form Control Engine Integration & Regression Test Suite
// Verifies all 30 required regression matrix categories defined in Part 19 of Master Command:
// Native, Custom, ARIA, Multi-Select, Toggle, Split Date, Cascading, Repeated Fields, File Input, Security.

import { describe, it, expect, beforeEach } from 'vitest';
import { PageScanner } from '../../src/content/page-scanner';
import { VerificationEngine } from '../../src/validation/verification-engine';
import { ControlDetectionRegistry } from '../../src/intelligence/control-detection-registry';
import { ControlHandlerRouter } from '../../src/handlers/router';
import { MultiSelectHandler } from '../../src/handlers/multi-select-handler';
import { ToggleSwitchHandler } from '../../src/handlers/toggle-switch-handler';
import { FileInputHandler } from '../../src/handlers/file-input-handler';
import { CustomDropdownHandler } from '../../src/handlers/custom-dropdown-handler';
import { CompositeFieldAdapter } from '../../src/intelligence/composite-field-adapter';
import { sampleDemoProfile } from '../../src/types/defaults';
import { UserProfile } from '../../src/types/profile';

describe('JobFill BD — Universal Form Control Engine Regression Matrix (30 Categories)', () => {
  let profileA: UserProfile;
  let profileB: UserProfile;

  beforeEach(() => {
    document.body.innerHTML = '';
    profileA = JSON.parse(JSON.stringify(sampleDemoProfile));
    profileA.personal.applicantNameEn = 'MD. RASHEDUL ISLAM';
    profileA.personal.applicantNameBn = 'মোঃ রাশেদুল ইসলাম';
    profileA.personal.gender = 'Male';
    profileA.personal.maritalStatus = 'Single';
    profileA.personal.religion = 'Islam';
    profileA.personal.nationality = 'Bangladeshi';
    profileA.personal.mobile = '01712345678';
    profileA.personal.confirmMobile = '01712345678';
    profileA.personal.nid = '19922692012345678';
    profileA.personal.dob = '1992-05-15';
    profileA.personal.quota = 'Freedom Fighter';
    profileA.personal.departmentalStatus = 'No';

    profileA.address.present.district = 'Dhaka';
    profileA.address.present.upazila = 'Dhanmondi';
    profileA.address.permanent.district = 'Rajshahi';
    profileA.address.permanent.upazila = 'Motihar';
    profileA.address.sameAsPresent = false;

    profileA.ssc = {
      examination: 'Dakhil',
      board: 'Madrasah',
      institution: 'Madrasah',
      rollNumber: '123456',
      registrationNumber: '9876543210',
      groupSubject: 'Science',
      resultType: 'GPA (Out of 5)',
      gpa: '5.00',
      gpaScale: '5.0',
      passingYear: '2010',
    };

    profileA.hsc = {
      examination: 'Alim',
      board: 'Madrasah',
      institution: 'Madrasah',
      rollNumber: '654321',
      registrationNumber: '9876543210',
      groupSubject: 'Science',
      resultType: 'GPA (Out of 5)',
      gpa: '4.80',
      gpaScale: '5.0',
      passingYear: '2012',
    };

    profileB = JSON.parse(JSON.stringify(sampleDemoProfile));
    profileB.personal.applicantNameEn = 'FATEMA KHANOM';
    profileB.personal.gender = 'Female';
    profileB.personal.maritalStatus = 'Married';
    profileB.personal.spouseNameEn = 'KAMRUL HASSAN';
    profileB.personal.mobile = '01898765432';
    profileB.personal.confirmMobile = '01898765432';
    profileB.personal.nid = '';
    profileB.address.sameAsPresent = true;
    profileB.address.present.district = 'Dhaka';
    profileB.address.present.upazila = 'Mirpur';
    profileB.address.permanent.district = 'Dhaka';
    profileB.address.permanent.upazila = 'Mirpur';
  });

  // 1. Single Radio Selection
  it('Category 1: Selects single radio correctly without guessing or default index selection', async () => {
    document.body.innerHTML = `
      <form>
        <fieldset>
          <legend>Gender</legend>
          <label><input type="radio" name="gender" value="Male" id="g_m"> Male</label>
          <label><input type="radio" name="gender" value="Female" id="g_f"> Female</label>
        </fieldset>
      </form>
    `;
    const scan = await PageScanner.scanPage(profileA);
    await VerificationEngine.executePlan('reg_1', scan.planItems);
    const m = document.getElementById('g_m') as HTMLInputElement;
    const f = document.getElementById('g_f') as HTMLInputElement;
    expect(m.checked).toBe(true);
    expect(f.checked).toBe(false);
  });

  // 2. Radio with Bengali Labels
  it('Category 2: Selects radio button using Bengali semantic label matching', async () => {
    document.body.innerHTML = `
      <form>
        <fieldset>
          <legend>লিঙ্গ (Gender)</legend>
          <label><input type="radio" name="gender" value="1" id="bn_male"> পুরুষ</label>
          <label><input type="radio" name="gender" value="2" id="bn_female"> মহিলা</label>
        </fieldset>
      </form>
    `;
    const scan = await PageScanner.scanPage(profileA);
    await VerificationEngine.executePlan('reg_2', scan.planItems);
    const m = document.getElementById('bn_male') as HTMLInputElement;
    const f = document.getElementById('bn_female') as HTMLInputElement;
    expect(m.checked).toBe(true);
    expect(f.checked).toBe(false);
  });

  // 3. Radio with English Labels
  it('Category 3: Selects radio button using English label matching', async () => {
    document.body.innerHTML = `
      <form>
        <fieldset>
          <legend>Marital Status</legend>
          <label><input type="radio" name="marital_status" value="S" id="m_single"> Single</label>
          <label><input type="radio" name="marital_status" value="M" id="m_married"> Married</label>
        </fieldset>
      </form>
    `;
    const scan = await PageScanner.scanPage(profileA);
    await VerificationEngine.executePlan('reg_3', scan.planItems);
    const s = document.getElementById('m_single') as HTMLInputElement;
    const m = document.getElementById('m_married') as HTMLInputElement;
    expect(s.checked).toBe(true);
    expect(m.checked).toBe(false);
  });

  // 4. Multiple Radio Groups with Duplicate / Common Labels
  it('Category 4: Isolates multiple radio groups with duplicate labels (Yes/No)', async () => {
    document.body.innerHTML = `
      <form>
        <fieldset id="grp_nid">
          <legend>Do you have a National ID?</legend>
          <label><input type="radio" name="has_nid" value="Yes" id="nid_y"> Yes</label>
          <label><input type="radio" name="has_nid" value="No" id="nid_n"> No</label>
        </fieldset>
        <fieldset id="grp_dept">
          <legend>Are you a Departmental Candidate?</legend>
          <label><input type="radio" name="dept_cand" value="Yes" id="dept_y"> Yes</label>
          <label><input type="radio" name="dept_cand" value="No" id="dept_n"> No</label>
        </fieldset>
      </form>
    `;
    const scan = await PageScanner.scanPage(profileA);
    await VerificationEngine.executePlan('reg_4', scan.planItems);
    expect((document.getElementById('nid_y') as HTMLInputElement).checked).toBe(true);
    expect((document.getElementById('dept_n') as HTMLInputElement).checked).toBe(true);
  });

  // 5. Yes/No Radio (Identity Presence)
  it('Category 5: Yes/No radio correctly set based on candidate identity existence', async () => {
    document.body.innerHTML = `
      <form>
        <fieldset>
          <legend>National ID Card</legend>
          <label><input type="radio" name="nid_status" value="Yes" id="nid_status_y"> Yes (হ্যাঁ)</label>
          <label><input type="radio" name="nid_status" value="No" id="nid_status_n"> No (না)</label>
        </fieldset>
      </form>
    `;
    const scan = await PageScanner.scanPage(profileA);
    await VerificationEngine.executePlan('reg_5', scan.planItems);
    expect((document.getElementById('nid_status_y') as HTMLInputElement).checked).toBe(true);
  });

  // 6. Native Single Select
  it('Category 6: Fills Native Single Select dropdown and verifies selected value', async () => {
    document.body.innerHTML = `
      <form>
        <label for="religion">Religion</label>
        <select id="religion" name="religion">
          <option value="">Select Religion</option>
          <option value="Islam">Islam</option>
          <option value="Hinduism">Hinduism</option>
        </select>
      </form>
    `;
    const scan = await PageScanner.scanPage(profileA);
    await VerificationEngine.executePlan('reg_6', scan.planItems);
    const sel = document.getElementById('religion') as HTMLSelectElement;
    expect(sel.value).toBe('Islam');
  });

  // 7. Native Multi-Select
  it('Category 7: Fills Native Multi-Select (<select multiple>) with multiple matching options', async () => {
    const multiHandler = new MultiSelectHandler();
    document.body.innerHTML = `
      <select id="skills" multiple size="4">
        <option value="js">JavaScript</option>
        <option value="py">Python</option>
        <option value="sql">SQL Database</option>
        <option value="mgmt">Management</option>
      </select>
    `;
    const sel = document.getElementById('skills') as HTMLSelectElement;
    expect(multiHandler.canHandle(sel)).toBe(true);

    const res = await multiHandler.fill(sel, 'JavaScript, Python');
    expect(res.success).toBe(true);
    expect(sel.options[0].selected).toBe(true);
    expect(sel.options[1].selected).toBe(true);
    expect(sel.options[2].selected).toBe(false);
    expect(multiHandler.verify(sel, 'JavaScript, Python')).toBe(true);
  });

  // 8. Searchable Select
  it('Category 8: Handles searchable select and filters placeholder options', async () => {
    document.body.innerHTML = `
      <div class="searchable-select" role="combobox" aria-haspopup="listbox" aria-expanded="false" id="search_quota">
        <span class="selected-text">Select Quota</span>
      </div>
      <ul role="listbox" id="quota_list">
        <li role="option" data-value="General">General</li>
        <li role="option" data-value="Freedom Fighter">Freedom Fighter</li>
      </ul>
    `;
    const el = document.getElementById('search_quota') as HTMLElement;
    const customHandler = new CustomDropdownHandler();
    expect(customHandler.canHandle(el)).toBe(true);

    const res = await customHandler.fill(el, 'Freedom Fighter');
    expect(res.success).toBe(true);
    expect(customHandler.verify(el, 'Freedom Fighter')).toBe(true);
  });

  // 9. Custom Dropdown
  it('Category 9: Selects option in Custom Dropdown and updates text readback', async () => {
    document.body.innerHTML = `
      <div id="exam_centre_trigger" class="custom-select-trigger" role="combobox" aria-haspopup="listbox">
        <span class="val">Select Centre</span>
      </div>
      <div role="listbox">
        <div role="option" data-value="Dhaka">Dhaka</div>
        <div role="option" data-value="Chittagong">Chittagong</div>
      </div>
    `;
    const trigger = document.getElementById('exam_centre_trigger') as HTMLElement;
    const handler = new CustomDropdownHandler();
    const res = await handler.fill(trigger, 'Dhaka');
    expect(res.success).toBe(true);
    expect(handler.getCurrentValue(trigger)).toBe('Dhaka');
  });

  // 10. ARIA Combobox
  it('Category 10: Handles ARIA Combobox with popup listbox and aria-selected state', async () => {
    document.body.innerHTML = `
      <div id="aria_cb" role="combobox" aria-expanded="false" aria-controls="cb_list">
        <span id="cb_text">Select Nationality</span>
      </div>
      <ul id="cb_list" role="listbox">
        <li role="option" data-value="Bangladeshi" id="opt_bd">Bangladeshi</li>
        <li role="option" data-value="Others" id="opt_oth">Others</li>
      </ul>
    `;
    const cb = document.getElementById('aria_cb') as HTMLElement;
    const handler = new CustomDropdownHandler();
    const res = await handler.fill(cb, 'Bangladeshi');
    expect(res.success).toBe(true);
    const optBd = document.getElementById('opt_bd') as HTMLElement;
    expect(optBd.getAttribute('aria-selected')).toBe('true');
  });

  // 11. ARIA Listbox Standalone
  it('Category 11: Interacts with standalone ARIA listbox', async () => {
    document.body.innerHTML = `
      <ul id="standalone_listbox" role="listbox" tabindex="0">
        <li role="option" data-value="Single" id="opt_single">Single</li>
        <li role="option" data-value="Married" id="opt_married">Married</li>
      </ul>
    `;
    const listbox = document.getElementById('standalone_listbox') as HTMLElement;
    const handler = new CustomDropdownHandler();
    const res = await handler.fill(listbox, 'Single');
    expect(res.success).toBe(true);
    const optSingle = document.getElementById('opt_single') as HTMLElement;
    expect(optSingle.getAttribute('aria-selected')).toBe('true');
  });

  // 12. Delayed Options (Asynchronous Loading)
  it('Category 12: Waits for dynamically updated / delayed options before failing', async () => {
    document.body.innerHTML = `
      <select id="delayed_select" name="specialization">
        <option value="">Loading...</option>
      </select>
    `;
    const sel = document.getElementById('delayed_select') as HTMLSelectElement;

    // Simulate async network response adding options after 100ms
    setTimeout(() => {
      sel.innerHTML = `
        <option value="">Select Option</option>
        <option value="Software">Software</option>
        <option value="Network">Network</option>
      `;
    }, 100);

    const handler = ControlHandlerRouter.getHandler(sel);
    const res = await handler.fill(sel, 'Software');
    expect(res.success).toBe(true);
    expect(sel.value).toBe('Software');
  });

  // 13. Cascading Selection (District -> Upazila)
  it('Category 13: Coordinates Cascading Dropdown (District -> Upazila) with proper child update', async () => {
    document.body.innerHTML = `
      <div class="present-address-box">
        <label for="p_dist">District</label>
        <select id="p_dist" name="p_district">
          <option value="">Select District</option>
          <option value="Dhaka">Dhaka</option>
          <option value="Rajshahi">Rajshahi</option>
        </select>

        <label for="p_upazila">Upazila</label>
        <select id="p_upazila" name="p_upazila">
          <option value="">Select Upazila</option>
        </select>
      </div>
    `;
    const distEl = document.getElementById('p_dist') as HTMLSelectElement;
    const upazilaEl = document.getElementById('p_upazila') as HTMLSelectElement;

    distEl.addEventListener('change', () => {
      if (distEl.value === 'Dhaka') {
        upazilaEl.innerHTML = `
          <option value="">Select Upazila</option>
          <option value="Dhanmondi">Dhanmondi</option>
          <option value="Gulshan">Gulshan</option>
        `;
      }
    });

    const scan = await PageScanner.scanPage(profileA);
    await VerificationEngine.executePlan('reg_13', scan.planItems);

    expect(distEl.value).toBe('Dhaka');
    expect(upazilaEl.value).toBe('Dhanmondi');
  });

  // 14. Duplicate Options
  it('Category 14: Handles duplicate visible option names with correct value selection', async () => {
    document.body.innerHTML = `
      <select id="dup_select" name="centre">
        <option value="">Select One</option>
        <option value="101">Dhaka (North)</option>
        <option value="102">Dhaka (South)</option>
        <option value="201">Chittagong</option>
      </select>
    `;
    const sel = document.getElementById('dup_select') as HTMLSelectElement;
    const handler = ControlHandlerRouter.getHandler(sel);
    const res = await handler.fill(sel, 'Dhaka (North)');
    expect(res.success).toBe(true);
    expect(sel.value).toBe('101');
  });

  // 15. Missing Option Handling
  it('Category 15: Reports OPTION_NOT_FOUND when requested option does not exist (never randomly selects)', async () => {
    document.body.innerHTML = `
      <select id="opt_missing" name="category">
        <option value="">Select Category</option>
        <option value="Standard">Standard</option>
        <option value="Basic">Basic</option>
      </select>
    `;
    const sel = document.getElementById('opt_missing') as HTMLSelectElement;
    const handler = ControlHandlerRouter.getHandler(sel);
    const res = await handler.fill(sel, 'Enterprise Tier');
    expect(res.success).toBe(false);
    expect(res.status).toBe('Fill Failed');
    expect(res.message).toMatch(/OPTION_NOT_FOUND|no matching option found/i);
  });

  // 16. Disabled Option / Control
  it('Category 16: Refuses to fill disabled options or disabled controls', async () => {
    document.body.innerHTML = `
      <input type="text" id="disabled_input" name="auto_id" value="LOCKED" disabled />
    `;
    const scan = await PageScanner.scanPage(profileA);
    const item = scan.planItems.find((p) => p.selector === '#disabled_input');
    expect(item?.status).toBe('Unsupported Field');
    expect(item?.diagnosticStatus).toBe('Unsupported Control');
  });

  // 17. Checkbox True/False
  it('Category 17: Evaluates boolean checkbox according to profile preference', async () => {
    document.body.innerHTML = `
      <label><input type="checkbox" id="emp_status" name="currently_employed" /> Currently Employed</label>
    `;
    const cb = document.getElementById('emp_status') as HTMLInputElement;
    const handler = ControlHandlerRouter.getHandler(cb);
    await handler.fill(cb, 'true');
    expect(cb.checked).toBe(true);
    await handler.fill(cb, 'false');
    expect(cb.checked).toBe(false);
  });

  // 18. Same as Present Logic (Safety Protection)
  it('Category 18: Leaves Same as Present UNCHECKED when present and permanent differ, CHECKS when identical', async () => {
    document.body.innerHTML = `
      <label><input type="checkbox" id="chk_same" name="same_as_present" /> Same as Present</label>
    `;
    const cb = document.getElementById('chk_same') as HTMLInputElement;

    // Profile A has different addresses (Dhaka vs Rajshahi)
    const scanA = await PageScanner.scanPage(profileA);
    const itemA = scanA.planItems.find((p) => p.selector === '#chk_same');
    expect(itemA?.proposedValue).toBe('false');

    // Profile B has identical addresses (Dhaka vs Dhaka)
    const scanB = await PageScanner.scanPage(profileB);
    const itemB = scanB.planItems.find((p) => p.selector === '#chk_same');
    expect(itemB?.proposedValue).toBe('true');
  });

  // 19. Toggle Switch True/False (Accessible Switch Engine)
  it('Category 19: Handles role="switch" idempotently without oscillation', async () => {
    document.body.innerHTML = `
      <div role="switch" id="switch_dept" aria-checked="false" class="custom-switch"></div>
    `;
    const sw = document.getElementById('switch_dept') as HTMLElement;
    const handler = new ToggleSwitchHandler();
    expect(handler.canHandle(sw)).toBe(true);

    // Turn ON
    const res1 = await handler.fill(sw, 'true');
    expect(res1.success).toBe(true);
    expect(sw.getAttribute('aria-checked')).toBe('true');

    // Turn ON again (must remain ON, not oscillate)
    const res2 = await handler.fill(sw, 'true');
    expect(res2.status).toBe('Already Correct');
    expect(sw.getAttribute('aria-checked')).toBe('true');

    // Turn OFF
    const res3 = await handler.fill(sw, 'false');
    expect(res3.success).toBe(true);
    expect(sw.getAttribute('aria-checked')).toBe('false');
  });

  // 20. Date Single Input (Native HTML5 Date)
  it('Category 20: Formats and sets native HTML5 date input (YYYY-MM-DD)', async () => {
    document.body.innerHTML = `
      <input type="date" id="native_dob" name="dob" />
    `;
    const scan = await PageScanner.scanPage(profileA);
    await VerificationEngine.executePlan('reg_20', scan.planItems);
    const el = document.getElementById('native_dob') as HTMLInputElement;
    expect(el.value).toBe('1992-05-15');
  });

  // 21. Date Split into Three Dropdowns (Day, Month, Year)
  it('Category 21: Fills and verifies split Day, Month, and Year dropdowns separately', async () => {
    document.body.innerHTML = `
      <div id="dob_container">
        <select id="dob_day" name="dob_day">
          <option value="">Day</option>
          <option value="15">15</option>
        </select>
        <select id="dob_month" name="dob_month">
          <option value="">Month</option>
          <option value="5">May</option>
          <option value="05">05</option>
        </select>
        <select id="dob_year" name="dob_year">
          <option value="">Year</option>
          <option value="1992">1992</option>
        </select>
      </div>
    `;
    const dEl = document.getElementById('dob_day') as HTMLSelectElement;
    const mEl = document.getElementById('dob_month') as HTMLSelectElement;
    const yEl = document.getElementById('dob_year') as HTMLSelectElement;

    const res = await CompositeFieldAdapter.fillSplitDateDropdowns(dEl, mEl, yEl, '1992-05-15');
    expect(res.success).toBe(true);
    expect(dEl.value).toBe('15');
    expect(mEl.value).toBe('5');
    expect(yEl.value).toBe('1992');
  });

  // 22. Masked Date Input (DD/MM/YYYY text)
  it('Category 22: Fills masked date text input in DD/MM/YYYY format', async () => {
    document.body.innerHTML = `
      <input type="text" id="masked_dob" name="text_dob" placeholder="DD/MM/YYYY" maxlength="10" />
    `;
    const scan = await PageScanner.scanPage(profileA);
    await VerificationEngine.executePlan('reg_22', scan.planItems);
    const el = document.getElementById('masked_dob') as HTMLInputElement;
    expect(el.value).toBe('15/05/1992');
  });

  // 23. Confirm Mobile Equality
  it('Category 23: Strictly enforces 11-digit leading zero and identity between Mobile and Confirm Mobile', async () => {
    document.body.innerHTML = `
      <input type="tel" id="mobile" name="mobile" maxlength="11" />
      <input type="tel" id="c_mobile" name="c_mobile" maxlength="11" />
    `;
    const scan = await PageScanner.scanPage(profileA);
    await VerificationEngine.executePlan('reg_23', scan.planItems);
    const m = (document.getElementById('mobile') as HTMLInputElement).value;
    const c = (document.getElementById('c_mobile') as HTMLInputElement).value;
    expect(m).toBe('01712345678');
    expect(c).toBe('01712345678');
    expect(m).toBe(c);
  });

  // 24. NID Number Input versus NID Yes/No Radio
  it('Category 24: Strictly distinguishes NID Number free-text input from NID Yes/No choice', async () => {
    document.body.innerHTML = `
      <form>
        <fieldset>
          <legend>National ID Card</legend>
          <label><input type="radio" name="has_nid" value="Yes" id="nid_choice_y"> Yes</label>
          <label><input type="radio" name="has_nid" value="No" id="nid_choice_n"> No</label>
        </fieldset>
        <label for="txt_nid">NID Number</label>
        <input type="text" id="txt_nid" name="nid_no" />
      </form>
    `;
    const scan = await PageScanner.scanPage(profileA);
    await VerificationEngine.executePlan('reg_24', scan.planItems);
    expect((document.getElementById('nid_choice_y') as HTMLInputElement).checked).toBe(true);
    expect((document.getElementById('txt_nid') as HTMLInputElement).value).toBe('19922692012345678');
  });

  // 25. SSC vs. HSC Board Separation (Madrasah Board / Dakhil / Alim)
  it('Category 25: Strictly isolates SSC Board from HSC Board in repeated education blocks', async () => {
    document.body.innerHTML = `
      <fieldset class="edu-block" id="ssc_box">
        <legend>SSC or Equivalent</legend>
        <label for="ssc_exam">Examination</label>
        <select id="ssc_exam" name="ssc_exam"><option value="Dakhil">Dakhil</option></select>
        <label for="ssc_board">Board</label>
        <select id="ssc_board" name="ssc_board">
          <option value="">Select Board</option>
          <option value="Dhaka">Dhaka</option>
          <option value="Madrasah">Madrasah</option>
        </select>
        <label for="ssc_roll">Roll No</label>
        <input type="text" id="ssc_roll" name="ssc_roll" />
      </fieldset>

      <fieldset class="edu-block" id="hsc_box">
        <legend>HSC or Equivalent</legend>
        <label for="hsc_exam">Examination</label>
        <select id="hsc_exam" name="hsc_exam"><option value="Alim">Alim</option></select>
        <label for="hsc_board">Board</label>
        <select id="hsc_board" name="hsc_board">
          <option value="">Select Board</option>
          <option value="Dhaka">Dhaka</option>
          <option value="Madrasah">Madrasah</option>
        </select>
        <label for="hsc_roll">Roll No</label>
        <input type="text" id="hsc_roll" name="hsc_roll" />
      </fieldset>
    `;
    const scan = await PageScanner.scanPage(profileA);
    await VerificationEngine.executePlan('reg_25', scan.planItems);

    const sBoard = (document.getElementById('ssc_board') as HTMLSelectElement).value;
    const hBoard = (document.getElementById('hsc_board') as HTMLSelectElement).value;
    const sRoll = (document.getElementById('ssc_roll') as HTMLInputElement).value;
    const hRoll = (document.getElementById('hsc_roll') as HTMLInputElement).value;

    expect(sBoard).toBe('Madrasah');
    expect(hBoard).toBe('Madrasah');
    expect(sRoll).toBe('123456');
    expect(hRoll).toBe('654321');
  });

  // 26. Graduation vs. Masters Separation
  it('Category 26: Isolates Graduation Degree/Subject from Masters Degree/Subject', async () => {
    delete (profileA as any).masters;
    profileA.hasMasters = false;
    profileA.graduation = {
      examination: 'Graduation',
      degree: 'B.Sc Engineering',
      subjectDegree: 'Computer Science & Engineering',
      universityInstitute: 'BUET',
      resultType: 'First Class / Division',
      gpa: '3.85',
      gpaScale: '4.0',
      passingYear: '2016',
      courseDuration: '4 Years',
    };

    document.body.innerHTML = `
      <div class="edu-block">
        <legend>Graduation / Equivalent Level</legend>
        <label for="grad_sub">Subject</label>
        <input type="text" id="grad_sub" name="grad_subject" />
      </div>
      <div class="edu-block">
        <legend>Masters / Equivalent Level</legend>
        <label for="mast_sub">Subject</label>
        <input type="text" id="mast_sub" name="masters_subject" />
      </div>
    `;
    const scan = await PageScanner.scanPage(profileA);
    await VerificationEngine.executePlan('reg_26', scan.planItems);

    const gSub = (document.getElementById('grad_sub') as HTMLInputElement).value;
    const mSub = (document.getElementById('mast_sub') as HTMLInputElement).value;

    expect(gSub).toBe('Computer Science & Engineering');
    expect(mSub).toBe(''); // Profile A has no Masters record
  });

  // 27. File Input Handling & Safety Fallback
  it('Category 27: Programmatically attaches file when DataTransfer is supported and provides safe manual fallback when restricted', async () => {
    const fileHandler = new FileInputHandler();
    document.body.innerHTML = `
      <label for="user_photo">Photo (ছবি)</label>
      <input type="file" id="user_photo" name="photo" accept="image/jpeg,image/png" />
    `;
    const el = document.getElementById('user_photo') as HTMLInputElement;
    expect(fileHandler.canHandle(el)).toBe(true);

    // Mock DataTransfer in JSDOM environment
    const originalDT = (global as any).DataTransfer;
    try {
      class MockDataTransfer {
        public items = {
          add: (file: File) => {
            (this as any).files = [file];
          },
        };
        public files: File[] = [];
      }
      (global as any).DataTransfer = MockDataTransfer;

      const res = await fileHandler.fill(el, 'applicant_photo.png');
      expect(res.success).toBe(true);
      expect(res.status).toBe('Filled');
      expect(fileHandler.verify(el, 'applicant_photo.png')).toBe(true);
    } finally {
      (global as any).DataTransfer = originalDT;
    }

    // Fallback verification when DataTransfer is unavailable
    const originalDT2 = (global as any).DataTransfer;
    try {
      delete (global as any).DataTransfer;
      const resFallback = await fileHandler.fill(el, 'applicant_photo.png');
      expect(resFallback.success).toBe(false);
      expect(resFallback.status).toBe('Manual Selection Required');
      expect(resFallback.message).toContain('Browser security restricts');
    } finally {
      (global as any).DataTransfer = originalDT2;
    }
  });

  // 28. Profile Switching (Profile A vs Profile B)
  it('Category 28: Seamlessly switches between Profile A (Male/Single) and Profile B (Female/Married)', async () => {
    document.body.innerHTML = `
      <form>
        <input type="text" id="cand_name" name="name" />
        <input type="text" id="cand_mobile" name="mobile" />
      </form>
    `;
    const nameEl = document.getElementById('cand_name') as HTMLInputElement;
    const mobEl = document.getElementById('cand_mobile') as HTMLInputElement;

    // 1. Fill Profile A
    const scanA = await PageScanner.scanPage(profileA);
    await VerificationEngine.executePlan('reg_28_a', scanA.planItems);
    expect(nameEl.value).toBe('MD. RASHEDUL ISLAM');
    expect(mobEl.value).toBe('01712345678');

    // 2. Switch to Profile B (User approves updating fields with new profile values)
    const scanB = await PageScanner.scanPage(profileB);
    scanB.planItems.forEach((item) => {
      item.isApproved = true;
    });
    await VerificationEngine.executePlan('reg_28_b', scanB.planItems);
    expect(nameEl.value).toBe('FATEMA KHANOM');
    expect(mobEl.value).toBe('01898765432');
  });

  // 29. Manual Mapping Approval & Ambiguity Handling
  it('Category 29: Flags ambiguous fields for user review and does not auto-fill without approval', async () => {
    document.body.innerHTML = `
      <form>
        <label for="dept_choice">Preferred Department Option</label>
        <input type="text" id="dept_choice" name="dept_choice_unknown" />
      </form>
    `;
    const scan = await PageScanner.scanPage(profileA);
    const item = scan.planItems.find((p) => p.selector === '#dept_choice');
    expect(item?.isApproved).toBe(false);
  });

  // 30. Security Exclusions (CAPTCHA, OTP, Passwords, Legal Declarations)
  it('Category 30: Absolute safety policy excludes CAPTCHA, OTP, Password and Legal Declarations', async () => {
    document.body.innerHTML = `
      <form>
        <input type="text" id="security_captcha" name="captcha" />
        <input type="password" id="user_pwd" name="password" />
        <input type="text" id="otp_code" name="otp_code" />
        <label><input type="checkbox" id="legal_agree" name="declaration" /> I certify that all info is true</label>
      </form>
    `;
    const reg = ControlDetectionRegistry;
    const captchaCheck = reg.checkSecurityExclusion(document.getElementById('security_captcha') as HTMLElement);
    const pwdCheck = reg.checkSecurityExclusion(document.getElementById('user_pwd') as HTMLElement);
    const otpCheck = reg.checkSecurityExclusion(document.getElementById('otp_code') as HTMLElement);

    expect(captchaCheck.excluded).toBe(true);
    expect(pwdCheck.excluded).toBe(true);
    expect(otpCheck.excluded).toBe(true);

    const scan = await PageScanner.scanPage(profileA);
    // Security fields excluded from scan items
    const captchaItem = scan.planItems.find((p) => p.selector === '#security_captcha');
    expect(captchaItem).toBeUndefined();

    // Legal declaration detected but strictly marked as Unsupported Control and NEVER auto-approved
    const declItem = scan.planItems.find((p) => p.selector === '#legal_agree');
    expect(declItem?.isApproved).toBe(false);
    expect((document.getElementById('legal_agree') as HTMLInputElement).checked).toBe(false);
  });

  // 31. URL Input Type (LinkedIn / Portfolio URL)
  it('Category 31: Fills and verifies input[type="url"] with normalized web URL', async () => {
    (profileA.special as any).linkedin = 'https://linkedin.com/in/rashedul-islam';
    document.body.innerHTML = `
      <form>
        <label for="linkedin_url">LinkedIn Profile</label>
        <input type="url" id="linkedin_url" name="linkedin_url" placeholder="https://linkedin.com/in/..." />
      </form>
    `;
    const scan = await PageScanner.scanPage(profileA);
    await VerificationEngine.executePlan('reg_31', scan.planItems);
    const el = document.getElementById('linkedin_url') as HTMLInputElement;
    expect(el.value).toBe('https://linkedin.com/in/rashedul-islam');
  });

  // 32. HTML5 Datalist Input (Autocomplete Suggestions)
  it('Category 32: Detects and matches input with linked HTML5 <datalist>', async () => {
    (profileA.special as any).bloodGroup = 'O+';
    document.body.innerHTML = `
      <form>
        <label for="blood_group">Blood Group</label>
        <input list="blood_list" id="blood_group" name="blood_group" />
        <datalist id="blood_list">
          <option value="A+">A Positive</option>
          <option value="B+">B Positive</option>
          <option value="O+">O Positive</option>
          <option value="AB+">AB Positive</option>
        </datalist>
      </form>
    `;
    const el = document.getElementById('blood_group') as HTMLInputElement;
    const detected = ControlDetectionRegistry.detectControl(el);
    expect(detected.controlType).toBe('datalist');
    expect(detected.associatedOptions.length).toBe(4);
    expect(detected.associatedOptions.some((o) => o.value === 'O+')).toBe(true);

    const scan = await PageScanner.scanPage(profileA);
    await VerificationEngine.executePlan('reg_32', scan.planItems);
    expect(el.value).toBe('O+');
  });

  // 33. Range Slider Input (Expected Salary / Score)
  it('Category 33: Sets and verifies input[type="range"] slider value', async () => {
    document.body.innerHTML = `
      <form>
        <label for="salary_range">Expected Salary Range</label>
        <input type="range" id="salary_range" name="expected_salary" min="20000" max="100000" step="5000" value="30000" />
      </form>
    `;
    const el = document.getElementById('salary_range') as HTMLInputElement;
    const handler = ControlHandlerRouter.getHandler(el);
    const res = await handler.fill(el, '65000');
    expect(res.success).toBe(true);
    expect(el.value).toBe('65000');
  });

  // 34. Temporal Inputs (Time, Month, Week)
  it('Category 34: Correctly handles temporal inputs (input[type="time"], input[type="month"])', async () => {
    document.body.innerHTML = `
      <form>
        <input type="time" id="exam_time" name="exam_time" />
        <input type="month" id="grad_month" name="grad_month" />
      </form>
    `;
    const timeEl = document.getElementById('exam_time') as HTMLInputElement;
    const monthEl = document.getElementById('grad_month') as HTMLInputElement;

    const handler = ControlHandlerRouter.getHandler(timeEl);
    await handler.fill(timeEl, '10:30');
    expect(timeEl.value).toBe('10:30');

    await handler.fill(monthEl, '2024-06');
    expect(monthEl.value).toBe('2024-06');
  });
});
