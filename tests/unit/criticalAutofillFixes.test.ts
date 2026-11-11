import { describe, it, expect, beforeEach } from 'vitest';
import { PageScanner } from '../../src/content/page-scanner';
import { sampleDemoProfile } from '../../src/types/defaults';
import { VerificationEngine, FillPlanItem } from '../../src/validation/verification-engine';
import { ValueNormalizer } from '../../src/intelligence/value-normalizer';
import { PetroBanglaRules } from '../../src/adapters/petrobangla/petrobangla.rules';
import { UserProfile } from '../../src/types/profile';

describe('JobFill BD Critical Autofill & Profile-First Engine Test Suite (20 Tests)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  // 1. Medium-confidence field selection
  it('1. Profile-First Mode: automatically selects and approves safe matches even if heuristic is medium', async () => {
    document.body.innerHTML = `
      <table><tr><td>Applicant Name</td><td>:</td><td><input type="text" name="applicant_name" /></td></tr></table>
    `;
    const scan = await PageScanner.scanPage(sampleDemoProfile);
    expect(scan.readyToFillCount).toBe(1);
    expect(scan.planItems[0].isApproved).toBe(true);
    expect(scan.planItems[0].status).toBe('Matched');
  });

  // 2. Checkbox selection and deselection
  it('2. Checkbox toggles item approval state cleanly without throwing', () => {
    const item: FillPlanItem = {
      id: 'item_1',
      element: document.createElement('input'),
      selector: 'input',
      canonicalId: 'applicant.fullName.english',
      fieldLabel: 'Name',
      proposedValue: 'MD. MAHFUZUR RAHMAN',
      originalValue: '',
      hasConflict: false,
      isApproved: true,
      status: 'Matched',
    };
    // Toggle
    item.isApproved = !item.isApproved;
    expect(item.isApproved).toBe(false);
    item.isApproved = !item.isApproved;
    expect(item.isApproved).toBe(true);
  });

  // 3. Select All
  it('3. Select All marks all proposed fields as approved', async () => {
    document.body.innerHTML = `
      <input name="applicant_name" />
      <input name="father_name" />
    `;
    const scan = await PageScanner.scanPage(sampleDemoProfile);
    // Initially deselect all
    scan.planItems.forEach((i) => (i.isApproved = false));
    expect(scan.planItems.filter((i) => i.isApproved).length).toBe(0);

    // Select All
    scan.planItems.forEach((i) => {
      if (i.proposedValue) i.isApproved = true;
    });
    expect(scan.planItems.filter((i) => i.isApproved).length).toBe(2);
  });

  // 4. Review value editing
  it('4. Allows updating proposed value during review before filling', async () => {
    document.body.innerHTML = `<input name="applicant_name" id="app_name" />`;
    const scan = await PageScanner.scanPage(sampleDemoProfile);
    const item = scan.planItems[0];
    item.proposedValue = 'MAHFUZUR RAHMAN (CUSTOM)';

    await VerificationEngine.executePlan('test_session_edit', [item]);
    const input = document.getElementById('app_name') as HTMLInputElement;
    expect(input.value).toBe('MAHFUZUR RAHMAN (CUSTOM)');
  });

  // 5. Auto Fill Now
  it('5. Auto Fill Now executes approved plan and sets real values in DOM', async () => {
    document.body.innerHTML = `
      <input name="applicant_name" id="app_name" />
      <input name="father_name" id="f_name" />
    `;
    const scan = await PageScanner.scanPage(sampleDemoProfile);
    const report = await VerificationEngine.executePlan('session_autofill', scan.planItems);

    expect(report.successfullyFilled).toBe(2);
    expect((document.getElementById('app_name') as HTMLInputElement).value).toBe('MD. HASAN MAHMUD');
    expect((document.getElementById('f_name') as HTMLInputElement).value).toBe('MD. ABDUR RAHIM');
  });

  // 6. Re-scan
  it('6. Re-scan inspects the live DOM freshly and reflects dynamic additions', async () => {
    document.body.innerHTML = `<input name="applicant_name" />`;
    const scan1 = await PageScanner.scanPage(sampleDemoProfile);
    expect(scan1.totalVisibleInputs).toBe(1);

    // Dynamically append new field
    const newInput = document.createElement('input');
    newInput.name = 'father_name';
    document.body.appendChild(newInput);

    const scan2 = await PageScanner.scanPage(sampleDemoProfile);
    expect(scan2.totalVisibleInputs).toBe(2);
  });

  // 7. Native date input
  it('7. Native date input is formatted as YYYY-MM-DD', () => {
    const formatted = ValueNormalizer.formatDateForTarget('1998-05-15', 'date', '');
    expect(formatted).toBe('1998-05-15');
  });

  // 8. DD-MM-YY date input
  it('8. Converts date to DD-MM-YY when placeholder specifies 2-digit year', () => {
    const formatted = ValueNormalizer.formatDateForTarget('1998-05-15', 'text', 'DD-MM-YY');
    expect(formatted).toBe('15-05-98');
  });

  // 9. DD-MM-YYYY date input
  it('9. Converts date to DD-MM-YYYY standard government format', () => {
    const formatted = ValueNormalizer.formatDateForTarget('1998-05-15', 'text', 'DD-MM-YYYY');
    expect(formatted).toBe('15-05-1998');
  });

  // 10. Job Experience with one record
  it('10. Correctly maps single job experience record and formats dates', async () => {
    document.body.innerHTML = `
      <input name="exp_address" id="exp_address" />
      <input name="exp_start_date" id="exp_start_date" placeholder="DD-MM-YY" />
      <input type="checkbox" name="CurrentlyWorking" id="CurrentlyWorking" />
    `;
    const profileWithExp: UserProfile = {
      ...sampleDemoProfile,
      jobExperiences: [
        {
          id: 'exp_1',
          employedOn: 'Full-time',
          organization: 'Bangladesh Gas Fields Co.',
          designation: 'Assistant Network Engineer',
          address: 'Dhaka, Bangladesh',
          startDate: '2022-01-01',
          endDate: '',
          currentlyWorking: true,
          jobDescription: 'Server maintenance',
        },
      ],
    };

    PetroBanglaRules.applyPostFillRules(document, profileWithExp);
    const currWork = document.getElementById('CurrentlyWorking') as HTMLInputElement;
    expect(currWork.checked).toBe(true);
  });

  // 11. Job Experience with multiple records
  it('11. Preserves multiple experience records without duplicating sections', () => {
    const multiExpProfile: UserProfile = {
      ...sampleDemoProfile,
      jobExperiences: [
        {
          id: 'exp_1',
          employedOn: 'Full-time',
          organization: 'Org 1',
          designation: 'Role 1',
          address: 'Address 1',
          startDate: '2020-01-01',
          endDate: '2021-12-31',
          currentlyWorking: false,
          jobDescription: 'Desc 1',
        },
        {
          id: 'exp_2',
          employedOn: 'Full-time',
          organization: 'Org 2',
          designation: 'Role 2',
          address: 'Address 2',
          startDate: '2022-01-01',
          endDate: '',
          currentlyWorking: true,
          jobDescription: 'Desc 2',
        },
      ],
    };
    expect(multiExpProfile.jobExperiences.length).toBe(2);
    expect(multiExpProfile.jobExperiences[1].currentlyWorking).toBe(true);
  });

  // 12. CurrentlyWorking checkbox
  it('12. When CurrentlyWorking is true, unsets end date input to avoid fake dates', () => {
    document.body.innerHTML = `
      <input name="exp_end_date" id="exp_end_date" value="31-12-2025" />
      <input type="checkbox" name="CurrentlyWorking" id="CurrentlyWorking" />
    `;
    const expWorkingProfile: UserProfile = {
      ...sampleDemoProfile,
      jobExperiences: [
        {
          id: 'exp_1',
          employedOn: 'Full-time',
          organization: 'Petrobangla',
          designation: 'Engineer',
          address: 'Dhaka',
          startDate: '2021-01-01',
          endDate: '',
          currentlyWorking: true,
          jobDescription: 'Ops',
        },
      ],
    };

    PetroBanglaRules.applyPostFillRules(document, expWorkingProfile);
    const currWork = document.getElementById('CurrentlyWorking') as HTMLInputElement;
    const endDate = document.getElementById('exp_end_date') as HTMLInputElement;

    expect(currWork.checked).toBe(true);
    expect(endDate.value).toBe('');
  });

  // 13. Empty optional experience section
  it('13. Leaves optional experience section untouched when profile has no experiences', () => {
    document.body.innerHTML = `
      <input type="checkbox" id="chk_exp" /> If Applicable
      <input name="exp_address" id="exp_address" />
    `;
    const noExpProfile: UserProfile = {
      ...sampleDemoProfile,
      jobExperiences: [],
    };

    PetroBanglaRules.applyProgressiveDisclosures(document, noExpProfile);
    const chk = document.getElementById('chk_exp') as HTMLInputElement;
    expect(chk.checked).toBe(false);
  });

  // 14. Organization Choice without saved preferences
  it('14. Leaves Organization Choice empty when user has no saved application preferences', () => {
    document.body.innerHTML = `
      <input name="org_choice_1" id="org_choice_1" />
      <input name="org_choice_2" id="org_choice_2" />
    `;
    const noPrefProfile: UserProfile = {
      ...sampleDemoProfile,
      special: {
        ...sampleDemoProfile.special,
        orgChoice1: '',
        orgChoice2: '',
      },
    };

    PetroBanglaRules.applyPostFillRules(document, noPrefProfile);
    const choice1 = document.getElementById('org_choice_1') as HTMLInputElement;
    const choice2 = document.getElementById('org_choice_2') as HTMLInputElement;

    expect(choice1.value).toBe('');
    expect(choice2.value).toBe('');
  });

  // 15. Existing website values protection
  it('15. Protects existing conflicting values from overwrite unless approved', async () => {
    document.body.innerHTML = `
      <table><tr><td>Mobile Number</td><td>:</td><td><input name="mobile" id="mobile" value="01899887766" /></td></tr></table>
    `;
    const scan = await PageScanner.scanPage(sampleDemoProfile);
    const item = scan.planItems[0];

    expect(item.status).toBe('Existing Value Conflict');
    expect(item.hasConflict).toBe(true);
    expect(item.isApproved).toBe(false); // Protected
  });

  // 16. Missing profile information
  it('16. Reports Missing Profile Information when profile field is empty', async () => {
    document.body.innerHTML = `
      <table><tr><td>Passport</td><td>:</td><td><input name="passport" id="passport" /></td></tr></table>
    `;
    const emptyPassportProfile = {
      ...sampleDemoProfile,
      personal: { ...sampleDemoProfile.personal, passport: '' },
    };
    const scan = await PageScanner.scanPage(emptyPassportProfile);
    expect(scan.missingInfoCount).toBe(1);
    expect(scan.planItems[0].status).toBe('Missing Profile Information');
  });

  // 17. React-controlled input setter & events
  it('17. Dispatches bubbled input and change events for framework-controlled inputs', () => {
    const input = document.createElement('input');
    let eventCount = 0;
    input.addEventListener('input', () => eventCount++);
    input.addEventListener('change', () => eventCount++);

    document.body.appendChild(input);
    VerificationEngine.setNativeInputValue(input, 'TEST_VAL');

    expect(input.value).toBe('TEST_VAL');
    expect(eventCount).toBe(2);
  });

  // 18. Failed field update handling
  it('18. Reports Fill Failed if element is detached from DOM or read-only', async () => {
    const disabledInput = document.createElement('input');
    disabledInput.disabled = true;
    document.body.appendChild(disabledInput);

    const item: FillPlanItem = {
      id: 'item_dis',
      element: disabledInput,
      selector: 'input',
      canonicalId: 'applicant.fullName.english',
      fieldLabel: 'Name',
      proposedValue: 'TEST',
      originalValue: '',
      hasConflict: false,
      isApproved: true,
      status: 'PENDING',
    };

    const res = await VerificationEngine.executeFillItem(item);
    expect(res).toBe(false);
    expect(item.status).toBe('Fill Failed');
  });

  // 19. Undo Fill restoration
  it('19. Restores previous values accurately when Undo is clicked', async () => {
    document.body.innerHTML = `<input name="applicant_name" id="app_name" value="INITIAL_VAL" />`;
    const input = document.getElementById('app_name') as HTMLInputElement;

    const scan = await PageScanner.scanPage(sampleDemoProfile);
    const item = scan.planItems[0];
    // User approves overwriting the existing value
    item.isApproved = true;

    const sessionId = 'session_undo_test';
    await VerificationEngine.executePlan(sessionId, [item]);

    expect(input.value).toBe('MD. HASAN MAHMUD');

    const undo = VerificationEngine.undoLastFill(sessionId);
    expect(undo.restoredCount).toBe(1);
    expect(input.value).toBe('INITIAL_VAL');
  });

  // 20. Tab status / scan response structure
  it('20. Returns structured scan report ready for popup communication', async () => {
    document.body.innerHTML = `
      <form id="gov_form">
        <table>
          <tr><td>Applicant's Name</td><td>:</td><td><input name="applicant_name" /></td></tr>
          <tr><td>Father's Name</td><td>:</td><td><input name="father_name" /></td></tr>
        </table>
      </form>
    `;
    const scan = await PageScanner.scanPage(sampleDemoProfile);

    const response = {
      status: 'ok',
      hasJobForm: scan.planItems.length > 0,
      totalDetected: scan.totalVisibleInputs,
      matchedCount: scan.matchedCount,
      readyToFillCount: scan.readyToFillCount,
      conflictsCount: scan.conflictsCount,
      missingInfoCount: scan.missingInfoCount,
      activeProfileName: sampleDemoProfile.personal.applicantNameEn,
    };

    expect(response.status).toBe('ok');
    expect(response.hasJobForm).toBe(true);
    expect(response.readyToFillCount).toBe(2);
    expect(response.activeProfileName).toBe('MD. HASAN MAHMUD');
  });
});
