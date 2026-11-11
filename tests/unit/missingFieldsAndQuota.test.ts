import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PageScanner } from '../../src/content/page-scanner';
import { VerificationEngine } from '../../src/validation/verification-engine';
import { sampleDemoProfile, createEmptyProfile } from '../../src/types/defaults';
import { syntheticMadrasahTestProfile } from '../fixtures/syntheticProfiles';
import { PetroBanglaRules } from '../../src/adapters/petrobangla/petrobangla.rules';
import { calculateProfileScore } from '../../src/services/storage';

describe('JobFill BD - Missing Fields, Yes/No Identity, Confirm Mobile, Quota & Completeness Suite', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = '';
  });

  it('1. BIRTH REGISTRATION: selects "Yes" on Yes/No dropdown, reveals dynamic BRN input, and fills saved BRN without invention', async () => {
    document.body.innerHTML = `
      <form>
        <table>
          <tr>
            <td>Birth Registration</td>
            <td>
              <select name="birth_reg" id="birth_reg">
                <option value="">Select</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
              <input type="text" name="birth_reg_no" id="birth_reg_no" style="display:none;" placeholder="Birth Registration No" />
            </td>
          </tr>
        </table>
      </form>
    `;

    const brSelect = document.getElementById('birth_reg') as HTMLSelectElement;
    const brInput = document.getElementById('birth_reg_no') as HTMLInputElement;
    brSelect.addEventListener('change', () => {
      brInput.style.display = brSelect.value === 'Yes' ? 'inline-block' : 'none';
    });

    // Pass 1: profile WITH saved birthReg -> selects Yes and reveals BRN input
    const scan1 = await PageScanner.scanPage(sampleDemoProfile);
    const brSelectItem = scan1.planItems.find((i) => i.selector === '#birth_reg');
    expect(brSelectItem?.canonicalId).toBe('identity.birthRegistration');
    expect(brSelectItem?.proposedValue).toBe('Yes');
    expect(brSelectItem?.status).toBe('Matched');

    const approved1 = scan1.planItems.filter((i) => i.isApproved);
    await VerificationEngine.executePlan('br_test_saved', approved1);
    expect(brSelect.value).toBe('Yes');
    expect(brInput.style.display).toBe('inline-block');

    // Pass 2: scans newly revealed BRN input and fills exact saved BRN
    const scan2 = await PageScanner.scanPage(sampleDemoProfile);
    const brInputItem = scan2.planItems.find((i) => i.selector === '#birth_reg_no');
    expect(brInputItem?.canonicalId).toBe('identity.birthRegistration');
    expect(brInputItem?.proposedValue).toBe(sampleDemoProfile.personal.birthReg);
    expect(brInputItem?.status).toBe('Matched');

    await VerificationEngine.executePlan('br_test_saved_p2', [brInputItem!]);
    expect(brInput.value).toBe('19982692512000123');
  });

  it('2. BIRTH REGISTRATION (EMPTY): leaves Yes/No dropdown untouched and reports Profile Information Missing without assuming Yes/No', async () => {
    document.body.innerHTML = `
      <form>
        <table>
          <tr>
            <td>Birth Registration</td>
            <td>
              <select name="birth_reg" id="birth_reg">
                <option value="">Select</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </td>
          </tr>
        </table>
      </form>
    `;

    const emptyBrProfile = {
      ...sampleDemoProfile,
      personal: { ...sampleDemoProfile.personal, birthReg: '' },
    };

    const scan = await PageScanner.scanPage(emptyBrProfile);
    const item = scan.planItems.find((i) => i.selector === '#birth_reg');
    expect(item?.canonicalId).toBe('identity.birthRegistration');
    expect(item?.status).toBe('Missing Profile Information');
    expect(item?.diagnosticStatus).toBe('Profile Information Missing');
    expect(item?.isApproved).toBe(false);
    expect((document.getElementById('birth_reg') as HTMLSelectElement).value).toBe('');
  });

  it('3. CONFIRM MOBILE NUMBER: uses exact contact.mobile even when confirmMobile differs/stale, and verifies equality', async () => {
    document.body.innerHTML = `
      <form>
        <label for="mobile">Mobile Number</label>
        <input type="text" id="mobile" name="mobile" />
        <label for="confirm_mobile">Re-enter Mobile</label>
        <input type="text" id="confirm_mobile" name="confirm_mobile" />
      </form>
    `;

    const mismatchedProfile = {
      ...sampleDemoProfile,
      personal: {
        ...sampleDemoProfile.personal,
        mobile: '01755667788',
        confirmMobile: '01911000000', // Stale/divergent value must NEVER be used!
      },
    };

    const scan = await PageScanner.scanPage(mismatchedProfile);
    const mobileItem = scan.planItems.find((i) => i.selector === '#mobile');
    const confirmItem = scan.planItems.find((i) => i.selector === '#confirm_mobile');

    expect(mobileItem?.canonicalId).toBe('contact.mobile');
    expect(confirmItem?.canonicalId).toBe('contact.confirmMobile');
    expect(confirmItem?.proposedValue).toBe('01755667788');

    const report = await VerificationEngine.executePlan('confirm_mobile_suite', [mobileItem!, confirmItem!]);
    expect(report.failedVerification).toBe(0);
    expect(report.successfullyFilled).toBe(2);
    expect((document.getElementById('mobile') as HTMLInputElement).value).toBe('01755667788');
    expect((document.getElementById('confirm_mobile') as HTMLInputElement).value).toBe('01755667788');
  });

  it('4. QUOTA POLICY: createEmptyProfile never assumes General; empty quota reports Application-Specific Information Required; saved quota requires explicit confirmation', async () => {
    document.body.innerHTML = `
      <form>
        <label for="quota">Quota</label>
        <select id="quota" name="quota">
          <option value="">Select</option>
          <option value="General">General</option>
          <option value="Freedom Fighter">Freedom Fighter</option>
          <option value="District">District</option>
        </select>
      </form>
    `;

    // A. Newly created profile MUST NOT assume 'General'
    const freshProfile = createEmptyProfile('Fresh User');
    expect(freshProfile.personal.quota).toBe('');

    const emptyScore = calculateProfileScore(freshProfile);
    expect(emptyScore.missingKeyFields).toContain('Quota Category (কোটা)');
    expect(emptyScore.missingKeyFields).toContain('Birth Registration No.');

    const scanUnset = await PageScanner.scanPage(freshProfile);
    const qUnset = scanUnset.planItems.find((i) => i.selector === '#quota');
    expect(qUnset?.status).toBe('Missing Profile Information');
    expect(qUnset?.statusReason).toContain('Application-Specific Information Required');
    expect(qUnset?.isApproved).toBe(false);

    // B. Explicitly saved quota MUST ask for confirmation (never silently auto-approved)
    const ffProfile = {
      ...sampleDemoProfile,
      personal: { ...sampleDemoProfile.personal, quota: 'Freedom Fighter' },
    };
    const scanSaved = await PageScanner.scanPage(ffProfile);
    const qSaved = scanSaved.planItems.find((i) => i.selector === '#quota');
    expect(qSaved?.canonicalId).toBe('applicant.quota');
    expect(qSaved?.proposedValue).toBe('Freedom Fighter');
    expect(qSaved?.status).toBe('User Confirmation Required');
    expect(qSaved?.diagnosticStatus).toBe('User Confirmation Required');
    expect(qSaved?.isApproved).toBe(false);

    // Unconfirmed execution MUST leave #quota untouched
    const reportUnconfirmed = await VerificationEngine.executePlan('quota_unconfirmed', scanSaved.planItems);
    expect(reportUnconfirmed.confirmationRequired).toBe(1);
    expect((document.getElementById('quota') as HTMLSelectElement).value).toBe('');

    // Once user explicitly confirms, selection succeeds
    qSaved!.isApproved = true;
    const reportConfirmed = await VerificationEngine.executePlan('quota_confirmed', [qSaved!]);
    expect(reportConfirmed.successfullyFilled).toBe(1);
    expect((document.getElementById('quota') as HTMLSelectElement).value).toBe('Freedom Fighter');
  });

  it('5. COMPLETENESS REPORT & REGRESSION: BOGMC Basic Information fields all resolve with explicit diagnostic statuses and zero silent skips', async () => {
    const htmlPath = path.resolve(__dirname, '../../test-pages/petrobangla-form.html');
    document.documentElement.innerHTML = fs.readFileSync(htmlPath, 'utf-8');
    // JSDOM does not execute inline <script> on innerHTML assignment; wire Teletalk Yes/No toggle listeners
    for (const [selId, inpId] of [
      ['nid', 'nid_no'],
      ['birth_reg', 'birth_reg_no'],
      ['passport', 'passport_no'],
    ]) {
      const sel = document.getElementById(selId) as HTMLSelectElement | null;
      const inp = document.getElementById(inpId) as HTMLInputElement | null;
      sel?.addEventListener('change', () => {
        if (inp) inp.style.display = sel.value === 'Yes' ? 'inline-block' : 'none';
      });
    }
    PetroBanglaRules.applyProgressiveDisclosures(document, sampleDemoProfile);

    const scan1 = await PageScanner.scanPage(sampleDemoProfile);
    const report1 = await VerificationEngine.executePlan('bogmc_basic_regression', scan1.planItems);

    // Verify Pass 1 Basic Info & Regression Fields
    expect((document.getElementById('gender') as HTMLSelectElement).value).toBe('Male');
    expect((document.getElementById('nid') as HTMLSelectElement).value).toBe('Yes');
    expect((document.getElementById('birth_reg') as HTMLSelectElement).value).toBe('Yes');
    expect((document.getElementById('passport') as HTMLSelectElement).value).toBe('Yes');
    expect((document.getElementById('marital_status') as HTMLSelectElement).value).toBe('Single');
    expect((document.getElementById('mobile') as HTMLInputElement).value).toBe('01712345678');
    expect((document.getElementById('confirm_mobile') as HTMLInputElement).value).toBe('01712345678');
    expect((document.getElementById('email') as HTMLInputElement).value).toBe('applicant.demo@example.com');
    expect((document.getElementById('departmental_status') as HTMLSelectElement).value).toBe('No');
    // Quota MUST wait for explicit confirmation
    expect((document.getElementById('quota') as HTMLSelectElement).value).toBe('');

    const quotaEntry = report1.completenessReport.find((c) => c.selector === '#quota');
    const confirmEntry = report1.completenessReport.find((c) => c.selector === '#confirm_mobile');
    expect(quotaEntry?.status).toBe('User Confirmation Required');
    expect(confirmEntry?.status).toBe('Successfully Filled');

    // Every single detected item has one of the 7 explicit DiagnosticFieldStatus labels
    const allowedStatuses = new Set([
      'Successfully Filled',
      'Already Correct',
      'Profile Information Missing',
      'Mapping Not Found',
      'Unsupported Control',
      'User Confirmation Required',
      'Fill Failed',
    ]);
    expect(report1.completenessReport.length).toBe(scan1.planItems.length);
    for (const entry of report1.completenessReport) {
      expect(allowedStatuses.has(entry.status)).toBe(true);
    }

    // Pass 2: Verify newly revealed nid_no, birth_reg_no, passport_no inputs fill cleanly
    const scan2 = await PageScanner.scanPage(sampleDemoProfile);
    const revealedItems = scan2.planItems.filter(
      (i) => ['#nid_no', '#birth_reg_no', '#passport_no'].includes(i.selector) && i.isApproved
    );
    expect(revealedItems.length).toBe(3);
    await VerificationEngine.executePlan('bogmc_basic_regression_p2', revealedItems);
    expect((document.getElementById('nid_no') as HTMLInputElement).value).toBe(sampleDemoProfile.personal.nid);
    expect((document.getElementById('birth_reg_no') as HTMLInputElement).value).toBe(sampleDemoProfile.personal.birthReg);
    expect((document.getElementById('passport_no') as HTMLInputElement).value).toBe(sampleDemoProfile.personal.passport);
  }, 15000);

  it('6. SYNTHETIC MADRASAH PROFILE (SSC Dakhil, HSC Alim & NID): fills verified fields accurately without fabricating unprovided fields', async () => {
    const htmlPath = path.resolve(__dirname, '../../test-pages/petrobangla-form.html');
    document.documentElement.innerHTML = fs.readFileSync(htmlPath, 'utf-8');
    const nidSel = document.getElementById('nid') as HTMLSelectElement;
    const nidInp = document.getElementById('nid_no') as HTMLInputElement;
    nidSel.addEventListener('change', () => {
      nidInp.style.display = nidSel.value === 'Yes' ? 'inline-block' : 'none';
    });

    const scan1 = await PageScanner.scanPage(syntheticMadrasahTestProfile);
    const report1 = await VerificationEngine.executePlan('synthetic_madrasah_pass1', scan1.planItems);
    expect(report1.failedVerification).toBe(0);

    // Personal & NID synthetic test values
    expect((document.getElementById('applicant_name') as HTMLInputElement).value).toBe('MD. TAREQ AZIZ');
    expect((document.getElementById('applicant_name_bn') as HTMLInputElement).value).toBe('মোঃ তারেক আজিজ');
    expect((document.getElementById('father_name') as HTMLInputElement).value).toBe('MD. KARIM UDDIN');
    expect((document.getElementById('father_name_bn') as HTMLInputElement).value).toBe('মোঃ করিম উদ্দিন');
    expect((document.getElementById('mother_name') as HTMLInputElement).value).toBe('ROKEYA BEGUM');
    expect((document.getElementById('mother_name_bn') as HTMLInputElement).value).toBe('রোকেয়া বেগম');
    expect((document.getElementById('dob') as HTMLInputElement).value).toBe('15-04-2001');
    expect((document.getElementById('gender') as HTMLSelectElement).value).toBe('Male');
    expect(nidSel.value).toBe('Yes');

    // Pass 2 reveals #nid_no
    const scan2 = await PageScanner.scanPage(syntheticMadrasahTestProfile);
    const nidItem = scan2.planItems.find((i) => i.selector === '#nid_no');
    expect(nidItem?.proposedValue).toBe('9001122334');
    await VerificationEngine.executePlan('synthetic_madrasah_pass2', [nidItem!]);
    expect(nidInp.value).toBe('9001122334');

    // Address
    expect((document.getElementById('permanent_village') as HTMLTextAreaElement).value).toBe('Shantinagar Road, Sector 3');
    expect((document.getElementById('permanent_district') as HTMLSelectElement).value).toBe('Rangpur');
    expect((document.getElementById('permanent_upazila') as HTMLSelectElement).value).toBe('Rangpur Sadar');
    expect((document.getElementById('permanent_post') as HTMLInputElement).value).toBe('Rangpur Cantt');
    expect((document.getElementById('permanent_postcode') as HTMLInputElement).value).toBe('5401');

    // SSC (Dakhil 2017) & HSC (Alim 2019) Madrasah Board
    expect((document.getElementById('ssc_exam') as HTMLSelectElement).value).toBe('Dakhil');
    expect((document.getElementById('ssc_board') as HTMLSelectElement).value).toBe('Madrasah');
    expect((document.getElementById('ssc_roll') as HTMLInputElement).value).toBe('810234');
    expect((document.getElementById('ssc_gpa') as HTMLInputElement).value).toBe('5.00');
    expect((document.getElementById('ssc_year') as HTMLSelectElement).value).toBe('2018');
    expect((document.getElementById('hsc_exam') as HTMLSelectElement).value).toBe('Alim');
    expect((document.getElementById('hsc_board') as HTMLSelectElement).value).toBe('Madrasah');
    expect((document.getElementById('hsc_roll') as HTMLInputElement).value).toBe('610489');
    expect((document.getElementById('hsc_gpa') as HTMLInputElement).value).toBe('5.00');
    expect((document.getElementById('hsc_year') as HTMLSelectElement).value).toBe('2020');

    // Unprovided fields remain blank and honestly reported as Profile Information Missing
    expect((document.getElementById('birth_reg') as HTMLSelectElement).value).toBe('');
    expect((document.getElementById('passport') as HTMLSelectElement).value).toBe('');
    expect((document.getElementById('mobile') as HTMLInputElement).value).toBe('');
    expect((document.getElementById('quota') as HTMLSelectElement).value).toBe('');
    const missingIds = report1.completenessReport
      .filter((c) => c.status === 'Profile Information Missing')
      .map((c) => c.canonicalId);
    expect(missingIds).toContain('identity.birthRegistration');
    expect(missingIds).toContain('contact.mobile');
    expect(missingIds).toContain('applicant.quota');
  }, 15000);

  it('7. SPOUSE DETAILS: matches and fills both Spouse Name (English) and Spouse Name (Bangla)', async () => {
    document.body.innerHTML = `
      <form>
        <label for="spouse_name">Spouse's Name</label>
        <input type="text" id="spouse_name" name="spouse_name" />
        <label for="spouse_name_bn">স্বামী/স্ত্রীর নাম (বাংলায়)</label>
        <input type="text" id="spouse_name_bn" name="spouse_name_bn" />
      </form>
    `;

    const marriedProfile = {
      ...sampleDemoProfile,
      personal: {
        ...sampleDemoProfile.personal,
        maritalStatus: 'Married' as const,
        spouseNameEn: 'NUSRAT JAHAN',
        spouseNameBn: 'নুসরাত জাহান',
      },
    };

    const scan = await PageScanner.scanPage(marriedProfile);
    const enItem = scan.planItems.find((i) => i.selector === '#spouse_name');
    const bnItem = scan.planItems.find((i) => i.selector === '#spouse_name_bn');
    expect(enItem?.canonicalId).toBe('family.spouse.name.english');
    expect(bnItem?.canonicalId).toBe('family.spouse.name.bangla');

    const report = await VerificationEngine.executePlan('spouse_fill_test', scan.planItems);
    expect(report.successfullyFilled).toBe(2);
    expect((document.getElementById('spouse_name') as HTMLInputElement).value).toBe('NUSRAT JAHAN');
    expect((document.getElementById('spouse_name_bn') as HTMLInputElement).value).toBe('নুসরাত জাহান');
  });

  it('8. BANGLA NAMES WITH ASTERISK & BRACKETED NID INPUT: disambiguates father/mother Bangla names despite cryptic IDs and "*" markers, matches [National ID Number], and avoids disabled Fill Failed', async () => {
    document.body.innerHTML = `
      <form>
        <div class="form-header-bar">Basic Information</div>
        <label for="f_bn">পিতার নাম বাংলায় *</label>
        <input type="text" id="f_bn" name="var_f_01" />
        <label for="m_bn">মাতার নাম বাংলায় *</label>
        <input type="text" id="m_bn" name="var_m_02" />
        <label for="nid_bracket">[National ID Number]</label>
        <input type="text" id="nid_bracket" name="var_nid_num" />
        <label for="perm_dist_dis">Permanent District</label>
        <select id="perm_dist_dis" name="permanent_district" disabled>
          <option value="">Select</option>
          <option value="Rangpur">Rangpur</option>
        </select>
      </form>
    `;

    const scan = await PageScanner.scanPage(syntheticMadrasahTestProfile);
    expect(scan.ambiguousCount).toBe(0);

    const fatherBn = scan.planItems.find((i) => i.selector === '#f_bn');
    const motherBn = scan.planItems.find((i) => i.selector === '#m_bn');
    const nidItem = scan.planItems.find((i) => i.selector === '#nid_bracket');
    const disPerm = scan.planItems.find((i) => i.selector === '#perm_dist_dis');

    expect(fatherBn?.canonicalId).toBe('family.father.name.bangla');
    expect(fatherBn?.proposedValue).toBe('মোঃ করিম উদ্দিন');
    expect(motherBn?.canonicalId).toBe('family.mother.name.bangla');
    expect(motherBn?.proposedValue).toBe('রোকেয়া বেগম');
    expect(nidItem?.canonicalId).toBe('identity.nationalId');
    expect(nidItem?.proposedValue).toBe('9001122334');
    expect(disPerm?.status).toBe('Unsupported Field');
    expect(disPerm?.diagnosticStatus).toBe('Unsupported Control');

    const report = await VerificationEngine.executePlan('bn_disambig_test', scan.planItems);
    expect(report.failedVerification).toBe(0);
    expect(report.successfullyFilled).toBe(3);
    expect((document.getElementById('f_bn') as HTMLInputElement).value).toBe('মোঃ করিম উদ্দিন');
    expect((document.getElementById('m_bn') as HTMLInputElement).value).toBe('রোকেয়া বেগম');
    expect((document.getElementById('nid_bracket') as HTMLInputElement).value).toBe('9001122334');
  });
});
