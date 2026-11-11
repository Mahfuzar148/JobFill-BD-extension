import { describe, it, expect, beforeEach } from 'vitest';
import { PageScanner } from '../../src/content/page-scanner';
import { sampleDemoProfile } from '../../src/types/defaults';
import { VerificationEngine } from '../../src/validation/verification-engine';
import { FieldExtractor } from '../../src/content/field-extractor';

describe('Simplified Autofill Engine & 8-Status Lifecycle', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('1. Correctly matches fields and assigns Matched status without confidence scoring', async () => {
    document.body.innerHTML = `
      <form id="appForm">
        <table>
          <tr>
            <td>Applicant's Name</td>
            <td>:</td>
            <td><input type="text" name="applicant_name" id="applicant_name" /></td>
          </tr>
          <tr>
            <td>Father's Name</td>
            <td>:</td>
            <td><input type="text" name="father_name" id="father_name" /></td>
          </tr>
          <tr>
            <td>Mother's Name</td>
            <td>:</td>
            <td><input type="text" name="mother_name" id="mother_name" /></td>
          </tr>
        </table>
      </form>
    `;

    const scan = await PageScanner.scanPage(sampleDemoProfile);

    expect(scan.matchedCount).toBe(3);
    expect(scan.readyToFillCount).toBe(3);
    expect(scan.conflictsCount).toBe(0);

    const nameItem = scan.planItems.find((i) => i.canonicalId === 'applicant.fullName.english');
    expect(nameItem).toBeDefined();
    expect(nameItem?.status).toBe('Matched');
    expect(nameItem?.isApproved).toBe(true);
    expect(nameItem?.proposedValue).toBe('MD. HASAN MAHMUD');

    const fatherItem = scan.planItems.find((i) => i.canonicalId === 'family.father.name.english');
    expect(fatherItem?.status).toBe('Matched');
    expect(fatherItem?.proposedValue).toBe('MD. ABDUR RAHIM');
  });

  it('2. Disambiguates SSC vs HSC Roll based on section context without relying on confidence tier', async () => {
    document.body.innerHTML = `
      <fieldset>
        <legend>SSC/Equivalent Level</legend>
        <table>
          <tr><td>Roll No</td><td>:</td><td><input type="text" name="roll" id="ssc_roll" /></td></tr>
        </table>
      </fieldset>
      <fieldset>
        <legend>HSC/Equivalent Level</legend>
        <table>
          <tr><td>Roll No</td><td>:</td><td><input type="text" name="roll" id="hsc_roll" /></td></tr>
        </table>
      </fieldset>
    `;

    const scan = await PageScanner.scanPage(sampleDemoProfile);

    const sscItem = scan.planItems.find((i) => i.element.id === 'ssc_roll');
    const hscItem = scan.planItems.find((i) => i.element.id === 'hsc_roll');

    expect(sscItem?.canonicalId).toBe('education.ssc.roll');
    expect(hscItem?.canonicalId).toBe('education.hsc.roll');
    expect(sscItem?.status).toBe('Matched');
    expect(hscItem?.status).toBe('Matched');
    expect(sscItem?.proposedValue).toBe(sampleDemoProfile.ssc.rollNumber);
    expect(hscItem?.proposedValue).toBe(sampleDemoProfile.hsc.rollNumber);
  });

  it('3. Assigns Already Correct when field on website already contains profile value', async () => {
    document.body.innerHTML = `
      <table>
        <tr>
          <td>Mobile Number</td>
          <td>:</td>
          <td><input type="text" name="mobile" id="mobile" value="${sampleDemoProfile.personal.mobile}" /></td>
        </tr>
      </table>
    `;

    const scan = await PageScanner.scanPage(sampleDemoProfile);
    const mobileItem = scan.planItems.find((i) => i.element.id === 'mobile');

    expect(mobileItem?.status).toBe('Already Correct');
    expect(mobileItem?.isApproved).toBe(false);
    expect(scan.alreadyCorrectCount).toBe(1);
  });

  it('4. Assigns Existing Value Conflict when website value differs from profile', async () => {
    document.body.innerHTML = `
      <table>
        <tr>
          <td>Mobile Number</td>
          <td>:</td>
          <td><input type="text" name="mobile" id="mobile" value="01899887766" /></td>
        </tr>
      </table>
    `;

    const scan = await PageScanner.scanPage(sampleDemoProfile);
    const mobileItem = scan.planItems.find((i) => i.element.id === 'mobile');

    expect(mobileItem?.status).toBe('Existing Value Conflict');
    expect(mobileItem?.hasConflict).toBe(true);
    expect(mobileItem?.isApproved).toBe(false); // Protected against unconfirmed overwrite
    expect(scan.conflictsCount).toBe(1);
  });

  it('5. Assigns Missing Profile Information when profile does not have a value', async () => {
    document.body.innerHTML = `
      <table>
        <tr>
          <td>Passport Number</td>
          <td>:</td>
          <td><input type="text" name="passport" id="passport" /></td>
        </tr>
      </table>
    `;

    const emptyPassportProfile = {
      ...sampleDemoProfile,
      personal: { ...sampleDemoProfile.personal, passport: '' },
    };

    const scan = await PageScanner.scanPage(emptyPassportProfile);
    const passportItem = scan.planItems.find((i) => i.element.id === 'passport');

    expect(passportItem?.status).toBe('Missing Profile Information');
    expect(passportItem?.isApproved).toBe(false);
    expect(scan.missingInfoCount).toBe(1);
  });

  it('6. Executes Auto Fill Now and transitions Matched to Filled with verification', async () => {
    document.body.innerHTML = `
      <form id="petrobangla_test">
        <input type="text" name="applicant_name" id="applicant_name" />
        <input type="text" name="father_name" id="father_name" />
        <input type="text" name="dob" id="dob" placeholder="DD-MM-YYYY" />
      </form>
    `;

    const scan = await PageScanner.scanPage(sampleDemoProfile);
    expect(scan.readyToFillCount).toBe(3);

    const itemsToFill = scan.planItems.filter((i) => i.status === 'Matched');
    const sessionId = 'test_session_' + Date.now();
    const report = await VerificationEngine.executePlan(sessionId, itemsToFill);

    expect(report.successfullyFilled).toBe(3);
    expect(report.failedVerification).toBe(0);

    const nameInput = document.getElementById('applicant_name') as HTMLInputElement;
    const dobInput = document.getElementById('dob') as HTMLInputElement;

    expect(nameInput.value).toBe('MD. HASAN MAHMUD');
    // Date normalized to DD-MM-YYYY
    expect(dobInput.value).toBe('15-05-1998');

    // Items transitioned to Filled status
    expect(itemsToFill[0].status).toBe('Filled');
  });
});
