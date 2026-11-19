import { describe, it, expect, beforeEach } from 'vitest';
import { PageScanner } from '../../src/content/page-scanner';
import { VerificationEngine } from '../../src/validation/verification-engine';
import { sampleDemoProfile } from '../../src/types/defaults';
import { UserProfile } from '../../src/types/profile';

describe('JobFill BD — Critical SSC/HSC Board Dropdown Autofill Suite', () => {
  let baseProfile: UserProfile;

  beforeEach(() => {
    document.body.innerHTML = '';
    baseProfile = JSON.parse(JSON.stringify(sampleDemoProfile));
  });

  // SCENARIO A: SSC Dakhil + Madrasah Board
  it('Scenario A: Selects Dakhil examination and matching Madrasah Board for SSC', async () => {
    baseProfile.ssc = {
      ...baseProfile.ssc,
      examination: 'Dakhil',
      board: 'Bangladesh Madrasah Education Board',
      rollNumber: '810234',
      registrationNumber: '1412345678',
      resultType: 'GPA (out of 5)',
      gpa: '5.00',
      gpaScale: '5.00',
      groupSubject: 'General',
      passingYear: '2018',
    };

    document.body.innerHTML = `
      <form id="appForm">
        <fieldset class="edu-block ssc-section">
          <legend>SSC / Dakhil / Equivalent Level</legend>
          <label for="ssc_exam">Examination</label>
          <select id="ssc_exam" name="ssc_exam">
            <option value="">Select One</option>
            <option value="ssc">S.S.C</option>
            <option value="dakhil">Dakhil</option>
            <option value="ssc_voc">S.S.C (Vocational)</option>
          </select>

          <label for="ssc_board">Board</label>
          <select id="ssc_board" name="ssc_board">
            <option value="">Select One</option>
            <option value="1">Dhaka</option>
            <option value="2">Rajshahi</option>
            <option value="9">Madrasah</option>
            <option value="10">Technical</option>
          </select>
        </fieldset>
      </form>
    `;

    const scan = await PageScanner.scanPage(baseProfile);
    const examItem = scan.planItems.find((p) => p.canonicalId === 'education.ssc.examination');
    const boardItem = scan.planItems.find((p) => p.canonicalId === 'education.ssc.board');

    expect(examItem).toBeDefined();
    expect(boardItem).toBeDefined();
    expect(examItem?.proposedValue).toBe('Dakhil');
    expect(boardItem?.proposedValue).toBe('Bangladesh Madrasah Education Board');

    const report = await VerificationEngine.executePlan('session_scenario_a', scan.planItems);
    const examEl = document.getElementById('ssc_exam') as HTMLSelectElement;
    const boardEl = document.getElementById('ssc_board') as HTMLSelectElement;

    expect(examEl.value).toBe('dakhil');
    expect(examEl.options[examEl.selectedIndex].text).toBe('Dakhil');
    expect(boardEl.value).toBe('9');
    expect(boardEl.options[boardEl.selectedIndex].text).toBe('Madrasah');

    const executedBoard = report.items.find((i) => i.canonicalId === 'education.ssc.board');
    expect(executedBoard?.status).toBe('Filled');
    expect(executedBoard?.verificationMessage).toContain('FILLED_VERIFIED');
  });

  // SCENARIO B: HSC Alim + Madrasah Board
  it('Scenario B: Selects Alim examination and matching Madrasah Board for HSC', async () => {
    baseProfile.hsc = {
      ...baseProfile.hsc,
      examination: 'Alim',
      board: 'বাংলাদেশ মাদ্রাসা শিক্ষা বোর্ড',
      rollNumber: '610489',
      registrationNumber: '1412345678',
      resultType: 'GPA (out of 5)',
      gpa: '5.00',
      gpaScale: '5.00',
      groupSubject: 'General',
      passingYear: '2020',
    };

    document.body.innerHTML = `
      <form id="appForm">
        <fieldset class="edu-block hsc-section">
          <legend>HSC / Alim / Equivalent Level</legend>
          <label for="hsc_exam">Examination</label>
          <select id="hsc_exam" name="hsc_exam">
            <option value="">Select One</option>
            <option value="hsc">H.S.C</option>
            <option value="alim">Alim</option>
            <option value="diploma">Diploma in Engineering</option>
          </select>

          <label for="hsc_board">Board</label>
          <select id="hsc_board" name="hsc_board">
            <option value="">Select One</option>
            <option value="dhaka">Dhaka</option>
            <option value="chittagong">Chittagong</option>
            <option value="madrasah">মাদ্রাসা বোর্ড</option>
            <option value="bteb">কারিগরি বোর্ড</option>
          </select>
        </fieldset>
      </form>
    `;

    const scan = await PageScanner.scanPage(baseProfile);
    const examItem = scan.planItems.find((p) => p.canonicalId === 'education.hsc.examination');
    const boardItem = scan.planItems.find((p) => p.canonicalId === 'education.hsc.board');

    expect(examItem).toBeDefined();
    expect(boardItem).toBeDefined();
    expect(examItem?.proposedValue).toBe('Alim');
    expect(boardItem?.proposedValue).toBe('বাংলাদেশ মাদ্রাসা শিক্ষা বোর্ড');

    const report = await VerificationEngine.executePlan('session_scenario_b', scan.planItems);
    const examEl = document.getElementById('hsc_exam') as HTMLSelectElement;
    const boardEl = document.getElementById('hsc_board') as HTMLSelectElement;

    expect(examEl.value).toBe('alim');
    expect(examEl.options[examEl.selectedIndex].text).toBe('Alim');
    expect(boardEl.value).toBe('madrasah');
    expect(boardEl.options[boardEl.selectedIndex].text).toBe('মাদ্রাসা বোর্ড');

    const executedBoard = report.items.find((i) => i.canonicalId === 'education.hsc.board');
    expect(executedBoard?.status).toBe('Filled');
    expect(executedBoard?.verificationMessage).toContain('FILLED_VERIFIED');
  });

  // SCENARIO C: SSC and HSC both use separate Board dropdowns on same form
  it('Scenario C: Correctly isolates SSC Board and HSC Board without cross-pollination', async () => {
    baseProfile.ssc = {
      ...baseProfile.ssc,
      examination: 'Dakhil',
      board: 'Madrasah',
      rollNumber: '810234',
    };
    baseProfile.hsc = {
      ...baseProfile.hsc,
      examination: 'Alim',
      board: 'Madrasah',
      rollNumber: '610489',
    };

    document.body.innerHTML = `
      <form id="appForm">
        <!-- SSC Section -->
        <div class="edu-block" id="sec_ssc">
          <div class="edu-header">SSC / Dakhil Level</div>
          <select name="exam1" id="exam1">
            <option value="">Select</option>
            <option value="1">S.S.C</option>
            <option value="2">Dakhil</option>
          </select>
          <select name="board1" id="board1">
            <option value="">Select One</option>
            <option value="1">Dhaka</option>
            <option value="9">Madrasah</option>
          </select>
        </div>

        <!-- HSC Section -->
        <div class="edu-block" id="sec_hsc">
          <div class="edu-header">HSC / Alim Level</div>
          <select name="exam2" id="exam2">
            <option value="">Select</option>
            <option value="1">H.S.C</option>
            <option value="2">Alim</option>
          </select>
          <select name="board2" id="board2">
            <option value="">Select One</option>
            <option value="1">Dhaka</option>
            <option value="9">Madrasah</option>
          </select>
        </div>
      </form>
    `;

    const scan = await PageScanner.scanPage(baseProfile);
    const sscBoard = scan.planItems.find((p) => p.canonicalId === 'education.ssc.board');
    const hscBoard = scan.planItems.find((p) => p.canonicalId === 'education.hsc.board');

    expect(sscBoard?.element.id).toBe('board1');
    expect(hscBoard?.element.id).toBe('board2');

    await VerificationEngine.executePlan('session_scenario_c', scan.planItems);

    const board1El = document.getElementById('board1') as HTMLSelectElement;
    const board2El = document.getElementById('board2') as HTMLSelectElement;

    expect(board1El.value).toBe('9');
    expect(board2El.value).toBe('9');
  });

  // SCENARIO D: Board options load dynamically after Examination selection
  it('Scenario D: Waits for Board options to populate after Examination change and selects verified Board', async () => {
    baseProfile.ssc = {
      ...baseProfile.ssc,
      examination: 'Dakhil',
      board: 'Madrasah Board',
    };

    document.body.innerHTML = `
      <form id="appForm">
        <div class="edu-block">
          <div class="edu-header">SSC / Dakhil Level</div>
          <select name="ssc_exam" id="ssc_exam">
            <option value="">Select One</option>
            <option value="ssc">S.S.C</option>
            <option value="dakhil">Dakhil</option>
          </select>

          <!-- Board dropdown starts with only placeholder -->
          <select name="ssc_board" id="ssc_board">
            <option value="">Select One</option>
          </select>
        </div>
      </form>
    `;

    // Simulate portal script injecting boards upon exam change
    document.getElementById('ssc_exam')?.addEventListener('change', () => {
      const b = document.getElementById('ssc_board') as HTMLSelectElement;
      b.innerHTML = `
        <option value="">Select One</option>
        <option value="dhaka">Dhaka</option>
        <option value="madrasah">Madrasah Board</option>
      `;
    });

    const scan = await PageScanner.scanPage(baseProfile);
    const report = await VerificationEngine.executePlan('session_scenario_d', scan.planItems);

    const examEl = document.getElementById('ssc_exam') as HTMLSelectElement;
    const boardEl = document.getElementById('ssc_board') as HTMLSelectElement;

    expect(examEl.value).toBe('dakhil');
    expect(boardEl.value).toBe('madrasah');
    expect(boardEl.options[boardEl.selectedIndex].text).toBe('Madrasah Board');
    expect(report.successfullyFilled).toBe(2);
    expect(report.failedVerification).toBe(0);
  });

  // SCENARIO E: Delayed Board options (asynchronous 200ms delay)
  it('Scenario E: Handles async delayed Board option loading via bounded waiting', async () => {
    baseProfile.hsc = {
      ...baseProfile.hsc,
      examination: 'Alim',
      board: 'Madrasah',
    };

    document.body.innerHTML = `
      <form id="appForm">
        <div class="edu-block">
          <div class="edu-header">HSC / Alim Level</div>
          <select name="hsc_exam" id="hsc_exam">
            <option value="">Select One</option>
            <option value="alim">Alim</option>
          </select>

          <select name="hsc_board" id="hsc_board">
            <option value="">Select One</option>
          </select>
        </div>
      </form>
    `;

    // Delayed async option population
    document.getElementById('hsc_exam')?.addEventListener('change', () => {
      setTimeout(() => {
        const b = document.getElementById('hsc_board') as HTMLSelectElement;
        b.innerHTML = `
          <option value="">Select One</option>
          <option value="1">Dhaka</option>
          <option value="9">Madrasah</option>
        `;
      }, 150);
    });

    const scan = await PageScanner.scanPage(baseProfile);
    const report = await VerificationEngine.executePlan('session_scenario_e', scan.planItems);

    const boardEl = document.getElementById('hsc_board') as HTMLSelectElement;
    expect(boardEl.value).toBe('9');
    expect(boardEl.options[boardEl.selectedIndex].text).toBe('Madrasah');
    expect(report.successfullyFilled).toBe(2);
  });

  // SCENARIO F: Custom Board Dropdown (ARIA Combobox / Listbox)
  it('Scenario F: Correctly fills and verifies custom ARIA Combobox Board dropdown with Madrasah alias', async () => {
    baseProfile.ssc = {
      ...baseProfile.ssc,
      examination: 'Dakhil',
      board: 'Bangladesh Madrasah Education Board',
    };

    document.body.innerHTML = `
      <div class="edu-block">
        <label id="lbl_board">SSC Board</label>
        <div id="custom_board" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="lbl_board" class="custom-select">
          <span class="selected-text">Select One</span>
        </div>
        <ul id="custom_board_list" role="listbox" style="display:none;">
          <li role="option" data-value="1">Dhaka Board</li>
          <li role="option" data-value="2">Rajshahi Board</li>
          <li role="option" data-value="9">মাদ্রাসা শিক্ষা বোর্ড</li>
          <li role="option" data-value="10">Technical Board</li>
        </ul>
      </div>
    `;

    const customEl = document.getElementById('custom_board') as HTMLElement;
    const listEl = document.getElementById('custom_board_list') as HTMLElement;

    customEl.addEventListener('click', () => {
      customEl.setAttribute('aria-expanded', 'true');
      listEl.style.display = 'block';
    });

    const scan = await PageScanner.scanPage(baseProfile);
    const boardItem = scan.planItems.find((p) => p.canonicalId === 'education.ssc.board');

    expect(boardItem).toBeDefined();
    expect(boardItem?.proposedValue).toBe('Bangladesh Madrasah Education Board');

    await VerificationEngine.executePlan('session_scenario_f', scan.planItems);

    const selectedSpan = customEl.querySelector('.selected-text');
    expect(selectedSpan?.textContent).toBe('মাদ্রাসা শিক্ষা বোর্ড');
  });

  // SCENARIO G: Missing SSC Board in Profile
  it('Scenario G: Reports PROFILE_DATA_MISSING when SSC Board is not saved in profile without guessing', async () => {
    baseProfile.ssc = {
      ...baseProfile.ssc,
      examination: 'Dakhil',
      board: '', // Missing
    };

    document.body.innerHTML = `
      <form id="appForm">
        <div class="edu-block">
          <div class="edu-header">SSC Level</div>
          <select name="ssc_board" id="ssc_board">
            <option value="">Select One</option>
            <option value="9">Madrasah</option>
          </select>
        </div>
      </form>
    `;

    const scan = await PageScanner.scanPage(baseProfile);
    const boardItem = scan.planItems.find((p) => p.canonicalId === 'education.ssc.board');

    expect(boardItem).toBeDefined();
    expect(boardItem?.status).toBe('Missing Profile Information');
    expect(boardItem?.diagnosticStatus).toBe('Profile Information Missing');
    expect(boardItem?.statusReason).toContain('PROFILE_DATA_MISSING: SSC Board is not set');
    expect(boardItem?.isApproved).toBe(false);

    await VerificationEngine.executePlan('session_scenario_g', scan.planItems);

    const boardEl = document.getElementById('ssc_board') as HTMLSelectElement;
    expect(boardEl.value).toBe(''); // Preserved at placeholder
  });

  // SCENARIO H: Missing HSC Board in Profile
  it('Scenario H: Reports PROFILE_DATA_MISSING when HSC Board is not saved in profile without guessing', async () => {
    baseProfile.hsc = {
      ...baseProfile.hsc,
      examination: 'Alim',
      board: '', // Missing
    };

    document.body.innerHTML = `
      <form id="appForm">
        <div class="edu-block">
          <div class="edu-header">HSC Level</div>
          <select name="hsc_board" id="hsc_board">
            <option value="">Select One</option>
            <option value="9">Madrasah</option>
          </select>
        </div>
      </form>
    `;

    const scan = await PageScanner.scanPage(baseProfile);
    const boardItem = scan.planItems.find((p) => p.canonicalId === 'education.hsc.board');

    expect(boardItem).toBeDefined();
    expect(boardItem?.status).toBe('Missing Profile Information');
    expect(boardItem?.diagnosticStatus).toBe('Profile Information Missing');
    expect(boardItem?.statusReason).toContain('PROFILE_DATA_MISSING: HSC Board is not set');
    expect(boardItem?.isApproved).toBe(false);

    await VerificationEngine.executePlan('session_scenario_h', scan.planItems);

    const boardEl = document.getElementById('hsc_board') as HTMLSelectElement;
    expect(boardEl.value).toBe(''); // Preserved at placeholder
  });

  // SCENARIO I: Incorrect or unavailable Board option
  it('Scenario I: Fails verification cleanly with OPTION_NOT_FOUND when saved Board does not exist on portal', async () => {
    baseProfile.ssc = {
      ...baseProfile.ssc,
      examination: 'Dakhil',
      board: 'Oxford International Board', // Not present in BD options
    };

    document.body.innerHTML = `
      <form id="appForm">
        <div class="edu-block">
          <div class="edu-header">SSC Level</div>
          <select name="ssc_board" id="ssc_board">
            <option value="">Select One</option>
            <option value="dhaka">Dhaka</option>
            <option value="madrasah">Madrasah</option>
          </select>
        </div>
      </form>
    `;

    const scan = await PageScanner.scanPage(baseProfile);
    const report = await VerificationEngine.executePlan('session_scenario_i', scan.planItems);

    const boardEl = document.getElementById('ssc_board') as HTMLSelectElement;
    expect(boardEl.value).toBe(''); // Did not pick an unrelated option

    const executedBoard = report.items.find((i) => i.canonicalId === 'education.ssc.board');
    expect(executedBoard?.status).toBe('Fill Failed');
    expect(executedBoard?.verificationMessage).toContain('OPTION_NOT_FOUND');
  });

  // SCENARIO J: Different Board values in SSC and HSC
  it('Scenario J: Fills completely different saved Board values for SSC and HSC independently', async () => {
    baseProfile.ssc = {
      ...baseProfile.ssc,
      examination: 'Dakhil',
      board: 'Madrasah',
    };
    baseProfile.hsc = {
      ...baseProfile.hsc,
      examination: 'HSC',
      board: 'Rajshahi Board',
    };

    document.body.innerHTML = `
      <form id="appForm">
        <!-- SSC Section -->
        <div class="edu-block">
          <label>SSC Board</label>
          <select name="ssc_board" id="ssc_board">
            <option value="">Select One</option>
            <option value="1">Dhaka</option>
            <option value="2">Rajshahi</option>
            <option value="9">Madrasah</option>
          </select>
        </div>

        <!-- HSC Section -->
        <div class="edu-block">
          <label>HSC Board</label>
          <select name="hsc_board" id="hsc_board">
            <option value="">Select One</option>
            <option value="1">Dhaka</option>
            <option value="2">Rajshahi</option>
            <option value="9">Madrasah</option>
          </select>
        </div>
      </form>
    `;

    const scan = await PageScanner.scanPage(baseProfile);
    await VerificationEngine.executePlan('session_scenario_j', scan.planItems);

    const sscBoardEl = document.getElementById('ssc_board') as HTMLSelectElement;
    const hscBoardEl = document.getElementById('hsc_board') as HTMLSelectElement;

    expect(sscBoardEl.value).toBe('9');
    expect(sscBoardEl.options[sscBoardEl.selectedIndex].text).toBe('Madrasah');

    expect(hscBoardEl.value).toBe('2');
    expect(hscBoardEl.options[hscBoardEl.selectedIndex].text).toBe('Rajshahi');
  });
});
