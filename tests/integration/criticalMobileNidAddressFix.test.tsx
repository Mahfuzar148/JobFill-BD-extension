import { describe, it, expect, beforeEach } from 'vitest';
import { PageScanner } from '../../src/content/page-scanner';
import { VerificationEngine } from '../../src/validation/verification-engine';
import { sampleDemoProfile } from '../../src/types/defaults';
import { UserProfile } from '../../src/types/profile';

describe('JobFill BD Critical Mobile, NID & Address Autofill Fixes', () => {
  let baseProfile: UserProfile;

  beforeEach(() => {
    document.body.innerHTML = '';
    // Deep clone demo profile
    baseProfile = JSON.parse(JSON.stringify(sampleDemoProfile));
  });

  // TEST A: Mobile 11-digit String with Leading Zero & Confirm Mobile Equality
  it('Test A: Populates full 11-digit mobile with leading zero and verifies confirm mobile equality', async () => {
    baseProfile.personal.mobile = '01712345678';
    baseProfile.personal.confirmMobile = '01712345678';

    document.body.innerHTML = `
      <form id="jobForm">
        <label for="mobileno">Mobile Number* :</label>
        <input type="text" name="mobileno" id="mobileno" />
        <label for="confirmmobile">Confirm Mobile* :</label>
        <input type="text" name="confirmmobile" id="confirmmobile" />
      </form>
    `;

    const scan = await PageScanner.scanPage(baseProfile);
    const mobilePlan = scan.planItems.find((p) => p.canonicalId === 'contact.mobile');
    const confirmPlan = scan.planItems.find((p) => p.canonicalId === 'contact.confirmMobile');

    expect(mobilePlan).toBeDefined();
    expect(confirmPlan).toBeDefined();
    expect(mobilePlan?.proposedValue).toBe('01712345678');
    expect(confirmPlan?.proposedValue).toBe('01712345678');

    const report = await VerificationEngine.executePlan('session_test_a', scan.planItems);
    const mobileEl = document.getElementById('mobileno') as HTMLInputElement;
    const confirmEl = document.getElementById('confirmmobile') as HTMLInputElement;

    expect(mobileEl.value).toBe('01712345678');
    expect(confirmEl.value).toBe('01712345678');
    expect(mobileEl.value.startsWith('0')).toBe(true);
    expect(mobileEl.value.length).toBe(11);
    expect(confirmEl.value).toBe(mobileEl.value);

    const verifiedConfirm = report.items.find((i) => i.canonicalId === 'contact.confirmMobile');
    expect(verifiedConfirm?.status).toBe('Filled');
    expect(verifiedConfirm?.verificationMessage).toContain('Verified matching primary Mobile Number');
  });

  // TEST B: Mobile Field Restriction (maxLength Rejection, No Silent Truncation)
  it('Test B: Rejects silent truncation if input maxLength is shorter than mobile number', async () => {
    baseProfile.personal.mobile = '01712345678';

    document.body.innerHTML = `
      <form id="jobForm">
        <label for="mobileno">Mobile Number (restricted):</label>
        <input type="text" name="mobileno" id="mobileno" maxlength="5" />
      </form>
    `;

    const scan = await PageScanner.scanPage(baseProfile);
    const mobilePlan = scan.planItems.find((p) => p.canonicalId === 'contact.mobile');
    expect(mobilePlan?.proposedValue).toBe('01712345678'); // Preserves full string, no silent slicing to 5 chars

    const report = await VerificationEngine.executePlan('session_test_b', scan.planItems);
    const mobileEl = document.getElementById('mobileno') as HTMLInputElement;

    // Field should NOT be populated with a corrupt 5-digit number
    expect(mobileEl.value).toBe('');
    const execItem = report.items.find((i) => i.canonicalId === 'contact.mobile');
    expect(execItem?.status).toBe('Fill Failed');
    expect(execItem?.verificationMessage).toContain('Validation Rejected');
  });

  // TEST C: NID Number Text Input vs NID Yes/No Radio Group Independence
  it('Test C: Distinguishes between NID Yes/No radio group and NID number text input cleanly', async () => {
    baseProfile.personal.nid = '19982692512345678';

    document.body.innerHTML = `
      <form id="jobForm">
        <label>National ID* :</label>
        <input type="radio" name="nid" id="nid_01" value="1" /> Yes
        <input type="radio" name="nid" id="nid_02" value="2" /> No
        <label for="xplod">NID Number:</label>
        <input type="text" name="nid_no" id="xplod" />
      </form>
    `;

    const scan = await PageScanner.scanPage(baseProfile);
    const hasNidPlan = scan.planItems.find((p) => p.canonicalId === 'candidate.nationalId.hasNid');
    const nidNoPlan = scan.planItems.find((p) => p.canonicalId === 'identity.nationalId');

    expect(hasNidPlan).toBeDefined();
    expect(nidNoPlan).toBeDefined();
    expect(hasNidPlan?.proposedValue).toBe('Yes');
    expect(nidNoPlan?.proposedValue).toBe('19982692512345678');

    await VerificationEngine.executePlan('session_test_c', scan.planItems);

    const yesRadio = document.getElementById('nid_01') as HTMLInputElement;
    const noRadio = document.getElementById('nid_02') as HTMLInputElement;
    const nidTextInput = document.getElementById('xplod') as HTMLInputElement;

    expect(yesRadio.checked).toBe(true);
    expect(noRadio.checked).toBe(false);
    expect(nidTextInput.value).toBe('19982692512345678');
  });

  // TEST D: Present District & Dependent Upazila Cascading Dropdown
  it('Test D: Selects Present District and triggers population/selection of dependent Upazila', async () => {
    baseProfile.address.present.district = 'Rangpur';
    baseProfile.address.present.upazila = 'Kaunia';

    document.body.innerHTML = `
      <form id="jobForm">
        <label for="menu_one">District</label>
        <select name="menu_one" id="menu_one">
          <option value="0">Select a District</option>
          <option value="55">Rangpur</option>
          <option value="47">Dhaka</option>
        </select>

        <label for="menu_one_list">P.S./Upazila</label>
        <select name="menu_one_list" id="menu_one_list">
          <option value="0">Select a P.S./Upazila</option>
        </select>
      </form>
    `;

    // Simulate Teletalk cascading script
    document.getElementById('menu_one')?.addEventListener('change', () => {
      const upzSelect = document.getElementById('menu_one_list') as HTMLSelectElement;
      upzSelect.innerHTML = `
        <option value="0">Select a P.S./Upazila</option>
        <option value="201">Badarganj</option>
        <option value="202">Kaunia</option>
        <option value="203">Pirgachha</option>
      `;
    });

    const scan = await PageScanner.scanPage(baseProfile);
    const distPlan = scan.planItems.find((p) => p.canonicalId === 'address.present.district');
    const upzPlan = scan.planItems.find((p) => p.canonicalId === 'address.present.upazila');

    expect(distPlan?.proposedValue).toBe('Rangpur');
    expect(upzPlan?.proposedValue).toBe('Kaunia');

    const report = await VerificationEngine.executePlan('session_test_d', scan.planItems);

    const distEl = document.getElementById('menu_one') as HTMLSelectElement;
    const upzEl = document.getElementById('menu_one_list') as HTMLSelectElement;

    expect(distEl.value).toBe('55');
    expect(distEl.options[distEl.selectedIndex].text).toBe('Rangpur');
    expect(upzEl.value).toBe('202');
    expect(upzEl.options[upzEl.selectedIndex].text).toBe('Kaunia');

    expect(report.successfullyFilled).toBe(2);
    expect(report.failedVerification).toBe(0);
  });

  // TEST E: Permanent District & Upazila Differ From Present
  it('Test E: Independently selects Permanent District and Upazila when differing from Present', async () => {
    baseProfile.address.present.district = 'Rangpur';
    baseProfile.address.present.upazila = 'Kaunia';
    baseProfile.address.permanent.district = 'Rajshahi';
    baseProfile.address.permanent.upazila = 'Boalia';

    document.body.innerHTML = `
      <form id="jobForm">
        <!-- Present Address -->
        <select name="menu_one" id="menu_one">
          <option value="0">Select a District</option>
          <option value="55">Rangpur</option>
          <option value="54">Rajshahi</option>
        </select>
        <select name="menu_one_list" id="menu_one_list">
          <option value="0">Select a P.S./Upazila</option>
        </select>

        <!-- Permanent Address -->
        <select name="menu_two" id="menu_two">
          <option value="0">Select a District</option>
          <option value="55">Rangpur</option>
          <option value="54">Rajshahi</option>
        </select>
        <select name="menu_two_list" id="menu_two_list">
          <option value="0">Select a P.S./Upazila</option>
        </select>
      </form>
    `;

    document.getElementById('menu_one')?.addEventListener('change', () => {
      const upz = document.getElementById('menu_one_list') as HTMLSelectElement;
      upz.innerHTML = '<option value="0">Select a P.S./Upazila</option><option value="202">Kaunia</option>';
    });
    document.getElementById('menu_two')?.addEventListener('change', () => {
      const upz = document.getElementById('menu_two_list') as HTMLSelectElement;
      upz.innerHTML = '<option value="0">Select a P.S./Upazila</option><option value="301">Boalia</option>';
    });

    const scan = await PageScanner.scanPage(baseProfile);
    await VerificationEngine.executePlan('session_test_e', scan.planItems);

    const presDist = document.getElementById('menu_one') as HTMLSelectElement;
    const presUpz = document.getElementById('menu_one_list') as HTMLSelectElement;
    const permDist = document.getElementById('menu_two') as HTMLSelectElement;
    const permUpz = document.getElementById('menu_two_list') as HTMLSelectElement;

    expect(presDist.options[presDist.selectedIndex].text).toBe('Rangpur');
    expect(presUpz.options[presUpz.selectedIndex].text).toBe('Kaunia');
    expect(permDist.options[permDist.selectedIndex].text).toBe('Rajshahi');
    expect(permUpz.options[permUpz.selectedIndex].text).toBe('Boalia');
  });

  // TEST F: Same as Present Address Checkbox Remains Unchecked (and Unchecks if pre-checked)
  it('Test F: Keeps Same as Present checkbox unchecked when addresses differ, and actively unchecks it if pre-checked', async () => {
    // Distinct present vs permanent addresses
    baseProfile.address.present.district = 'Rangpur';
    baseProfile.address.present.village = 'Katihara, Uttar Mominpur';
    baseProfile.address.permanent.district = 'Rajshahi';
    baseProfile.address.permanent.village = 'Huseyn Shaheed Suhrawardy Hall, University of Rajshahi';
    baseProfile.address.sameAsPresent = false;

    document.body.innerHTML = `
      <form id="jobForm">
        <label for="copy">Permanent Address same as present address</label>
        <input type="checkbox" name="copy" id="copy" checked />
      </form>
    `;

    const scan = await PageScanner.scanPage(baseProfile);
    const copyPlan = scan.planItems.find((p) => p.canonicalId === 'address.sameAsPresent');

    expect(copyPlan).toBeDefined();
    expect(copyPlan?.proposedValue).toBe('false');
    expect(copyPlan?.isApproved).toBe(true); // Approved to fix the conflicting checked state

    await VerificationEngine.executePlan('session_test_f', scan.planItems);

    const copyEl = document.getElementById('copy') as HTMLInputElement;
    expect(copyEl.checked).toBe(false);
  });

  // TEST G: Same as Present Address Checkbox Checked ONLY When Strictly Matching
  it('Test G: Checks Same as Present checkbox when all address components strictly match and enabled', async () => {
    baseProfile.address.present.district = 'Dhaka';
    baseProfile.address.present.upazila = 'Mohammadpur';
    baseProfile.address.present.postOffice = 'Mohammadpur PO';
    baseProfile.address.present.postCode = '1207';
    baseProfile.address.present.village = 'House 12, Road 5';

    // Duplicate exactly to permanent
    baseProfile.address.permanent = { ...baseProfile.address.present };
    baseProfile.address.sameAsPresent = true;

    document.body.innerHTML = `
      <form id="jobForm">
        <label for="copy">Permanent Address same as present address</label>
        <input type="checkbox" name="copy" id="copy" />
      </form>
    `;

    const scan = await PageScanner.scanPage(baseProfile);
    const copyPlan = scan.planItems.find((p) => p.canonicalId === 'address.sameAsPresent');

    expect(copyPlan).toBeDefined();
    expect(copyPlan?.proposedValue).toBe('true');
    expect(copyPlan?.isApproved).toBe(true);

    await VerificationEngine.executePlan('session_test_g', scan.planItems);

    const copyEl = document.getElementById('copy') as HTMLInputElement;
    expect(copyEl.checked).toBe(true);
  });

  // TEST H: Missing District Shows PROFILE_DATA_MISSING Without Guessing
  it('Test H: Marks missing profile district as Missing Profile Information and does not guess', async () => {
    baseProfile.address.present.district = '';

    document.body.innerHTML = `
      <form id="jobForm">
        <label for="menu_one">District</label>
        <select name="menu_one" id="menu_one">
          <option value="0">Select a District</option>
          <option value="55">Rangpur</option>
          <option value="47">Dhaka</option>
        </select>
      </form>
    `;

    const scan = await PageScanner.scanPage(baseProfile);
    const distPlan = scan.planItems.find((p) => p.canonicalId === 'address.present.district');

    expect(distPlan).toBeDefined();
    expect(distPlan?.status).toBe('Missing Profile Information');
    expect(distPlan?.diagnosticStatus).toBe('Profile Information Missing');
    expect(distPlan?.isApproved).toBe(false);

    await VerificationEngine.executePlan('session_test_h', scan.planItems);

    const distEl = document.getElementById('menu_one') as HTMLSelectElement;
    expect(distEl.value).toBe('0'); // Remained untouched at placeholder
  });

  // TEST I: Invalid Upazila Shows OPTION_NOT_FOUND (Fill Failed)
  it('Test I: Fails verification when saved Upazila is not present in target dropdown options', async () => {
    baseProfile.address.present.district = 'Dhaka';
    baseProfile.address.present.upazila = 'NonExistentThana';

    document.body.innerHTML = `
      <form id="jobForm">
        <label for="menu_one_list">P.S./Upazila</label>
        <select name="menu_one_list" id="menu_one_list">
          <option value="0">Select a P.S./Upazila</option>
          <option value="101">Mohammadpur</option>
          <option value="102">Dhanmondi</option>
        </select>
      </form>
    `;

    const scan = await PageScanner.scanPage(baseProfile);
    const upzPlan = scan.planItems.find((p) => p.canonicalId === 'address.present.upazila');

    expect(upzPlan).toBeDefined();
    expect(upzPlan?.proposedValue).toBe('NonExistentThana');

    const report = await VerificationEngine.executePlan('session_test_i', scan.planItems);
    const upzEl = document.getElementById('menu_one_list') as HTMLSelectElement;

    expect(upzEl.value).toBe('0'); // Placeholder preserved
    const executedUpz = report.items.find((i) => i.canonicalId === 'address.present.upazila');
    expect(executedUpz?.status).toBe('Fill Failed');
    expect(executedUpz?.verificationMessage).toContain('No matching option found');
  });
});
