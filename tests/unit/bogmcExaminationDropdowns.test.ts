import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { SelectHandler } from '../../src/handlers/select-handler';
import { PageScanner } from '../../src/content/page-scanner';
import { VerificationEngine } from '../../src/validation/verification-engine';
import { sampleDemoProfile } from '../../src/types/defaults';
import { UserProfile } from '../../src/types/profile';

describe('JobFill BD - BOGMC Examination Dropdown & Section Disambiguation Suite', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = '';
    SelectHandler.clearDebugReports();
  });

  // Test 1: SSC -> S.S.C
  it('1. Correctly matches and selects S.S.C when profile examination is SSC', async () => {
    document.body.innerHTML = `
      <div class="edu-block">
        <label>Examination</label>
        <select id="ssc_exam" name="ssc_exam">
          <option value="">Select</option>
          <option value="S.S.C">S.S.C</option>
          <option value="Dakhil">Dakhil</option>
          <option value="S.S.C Vocational">S.S.C Vocational</option>
        </select>
      </div>
    `;
    const select = document.getElementById('ssc_exam') as HTMLSelectElement;
    const handler = new SelectHandler();

    const res = await handler.fill(select, 'SSC');
    expect(res.success).toBe(true);
    expect(select.value).toBe('S.S.C');

    const debugReports = SelectHandler.getDebugReports();
    const report = debugReports.find((r) => r.field.includes('Examination') || r.field.includes('ssc_exam'));
    expect(report?.result).toBe('Successfully Selected');
    expect(report?.selectedOption).toBe('S.S.C');
  });

  // Test 2: HSC -> H.S.C
  it('2. Correctly matches and selects H.S.C when profile examination is HSC', async () => {
    document.body.innerHTML = `
      <div class="edu-block">
        <label>Examination</label>
        <select id="hsc_exam" name="hsc_exam">
          <option value="">Select</option>
          <option value="H.S.C">H.S.C</option>
          <option value="Alim">Alim</option>
          <option value="H.S.C Vocational">H.S.C Vocational</option>
        </select>
      </div>
    `;
    const select = document.getElementById('hsc_exam') as HTMLSelectElement;
    const handler = new SelectHandler();

    const res = await handler.fill(select, 'HSC');
    expect(res.success).toBe(true);
    expect(select.value).toBe('H.S.C');
  });

  // Test 3: Dakhil -> Dakhil
  it('3. Selects Dakhil when profile specifies Dakhil (and does NOT select S.S.C)', async () => {
    document.body.innerHTML = `
      <select id="ssc_exam">
        <option value="">Select</option>
        <option value="S.S.C">S.S.C</option>
        <option value="Dakhil">Dakhil</option>
        <option value="Dakhil Vocational">Dakhil Vocational</option>
      </select>
    `;
    const select = document.getElementById('ssc_exam') as HTMLSelectElement;
    const handler = new SelectHandler();

    const res = await handler.fill(select, 'Dakhil');
    expect(res.success).toBe(true);
    expect(select.value).toBe('Dakhil');
    expect(select.value).not.toBe('S.S.C');
  });

  // Test 4: O Level -> O Level/Cambridge
  it('4. Selects O Level/Cambridge when profile has O Level or O-Level', async () => {
    document.body.innerHTML = `
      <select id="ssc_exam">
        <option value="">Select</option>
        <option value="S.S.C">S.S.C</option>
        <option value="O Level/Cambridge">O Level/Cambridge</option>
      </select>
    `;
    const select = document.getElementById('ssc_exam') as HTMLSelectElement;
    const handler = new SelectHandler();

    const res = await handler.fill(select, 'O Level');
    expect(res.success).toBe(true);
    expect(select.value).toBe('O Level/Cambridge');
  });

  // Test 5: SSC Vocational -> S.S.C Vocational
  it('5. Distinguishes SSC Vocational from regular S.S.C', async () => {
    document.body.innerHTML = `
      <select id="ssc_exam">
        <option value="">Select</option>
        <option value="S.S.C">S.S.C</option>
        <option value="S.S.C Vocational">S.S.C Vocational</option>
      </select>
    `;
    const select = document.getElementById('ssc_exam') as HTMLSelectElement;
    const handler = new SelectHandler();

    // Fill SSC Vocational
    const resVoc = await handler.fill(select, 'SSC Vocational');
    expect(resVoc.success).toBe(true);
    expect(select.value).toBe('S.S.C Vocational');

    // Fill regular SSC and confirm it selects S.S.C, not S.S.C Vocational
    const resReg = await handler.fill(select, 'SSC');
    expect(resReg.success).toBe(true);
    expect(select.value).toBe('S.S.C');
  });

  // Test 6: SSC and HSC sections on the same page
  it('6. Disambiguates SSC and HSC Examination dropdowns on the same page', async () => {
    document.body.innerHTML = `
      <div class="edu-block" id="block_ssc">
        <div class="edu-header">SSC/Equivalent Level</div>
        <label>Examination</label>
        <select id="exam_ssc" name="exam">
          <option value="">Select</option>
          <option value="S.S.C">S.S.C</option>
          <option value="Dakhil">Dakhil</option>
        </select>
      </div>

      <div class="edu-block" id="block_hsc">
        <div class="edu-header">HSC/Equivalent Level</div>
        <label>Examination</label>
        <select id="exam_hsc" name="exam">
          <option value="">Select</option>
          <option value="H.S.C">H.S.C</option>
          <option value="Alim">Alim</option>
        </select>
      </div>
    `;

    const scan = await PageScanner.scanPage(sampleDemoProfile);
    const sscItem = scan.planItems.find((i) => i.selector.includes('exam_ssc'));
    const hscItem = scan.planItems.find((i) => i.selector.includes('exam_hsc'));

    expect(sscItem?.canonicalId).toBe('education.ssc.examination');
    expect(hscItem?.canonicalId).toBe('education.hsc.examination');
    expect(sscItem?.proposedValue).toBe('SSC');
    expect(hscItem?.proposedValue).toBe('HSC');
  });

  // Test 7: Same label in multiple sections (SSC, HSC, Graduation, Masters)
  it('7. Maps identical "Examination" label to correct canonical keys across 4 academic tiers', async () => {
    document.body.innerHTML = `
      <div class="edu-block">
        <h3>SSC / Equivalent</h3>
        <label>Examination</label>
        <select id="e1"><option value="S.S.C">S.S.C</option></select>
      </div>
      <div class="edu-block">
        <h3>HSC / Equivalent</h3>
        <label>Examination</label>
        <select id="e2"><option value="H.S.C">H.S.C</option></select>
      </div>
      <div class="edu-block">
        <h3>Graduation Level</h3>
        <label>Examination</label>
        <select id="e3"><option value="B.Sc">B.Sc Engineering</option></select>
      </div>
      <div class="edu-block">
        <h3>Masters Level</h3>
        <label>Examination</label>
        <select id="e4"><option value="M.Sc">M.Sc Engineering</option></select>
      </div>
    `;

    const scan = await PageScanner.scanPage(sampleDemoProfile);
    expect(scan.planItems.find((i) => i.selector === '#e1')?.canonicalId).toBe('education.ssc.examination');
    expect(scan.planItems.find((i) => i.selector === '#e2')?.canonicalId).toBe('education.hsc.examination');
    expect(scan.planItems.find((i) => i.selector === '#e3')?.canonicalId).toBe('education.graduation.degree');
    expect(scan.planItems.find((i) => i.selector === '#e4')?.canonicalId).toBe('education.masters.degree');
  });

  // Test 8: Missing saved examination value
  it('8. Reports Missing Profile Information when examination is blank in profile', async () => {
    document.body.innerHTML = `
      <div class="edu-block">
        <label>Examination</label>
        <select id="ssc_exam" name="ssc_exam">
          <option value="">Select</option>
          <option value="S.S.C">S.S.C</option>
        </select>
      </div>
    `;
    const select = document.getElementById('ssc_exam') as HTMLSelectElement;
    const handler = new SelectHandler();

    const res = await handler.fill(select, '');
    expect(res.success).toBe(false);
    expect(res.message).toContain('No value found in active profile');

    const debugReports = SelectHandler.getDebugReports();
    expect(debugReports[0].result).toBe('Profile value missing');
  });

  // Test 9: No matching dropdown option
  it('9. Reports No matching option when target value does not exist among options', async () => {
    document.body.innerHTML = `
      <select id="ssc_exam" name="ssc_exam">
        <option value="">Select</option>
        <option value="B.A">B.A</option>
        <option value="B.Sc">B.Sc</option>
      </select>
    `;
    const select = document.getElementById('ssc_exam') as HTMLSelectElement;
    const handler = new SelectHandler();

    const res = await handler.fill(select, 'SSC');
    expect(res.success).toBe(false);

    const debugReports = SelectHandler.getDebugReports();
    expect(debugReports[0].result).toBe('No matching option');
  });

  // Test 10: Dynamically updated Group/Subject options
  it('10. Observes dynamic update of Group/Subject options after Examination is selected', async () => {
    document.body.innerHTML = `
      <div class="edu-block">
        <select id="exam_select">
          <option value="">Select</option>
          <option value="S.S.C">S.S.C</option>
        </select>
        <select id="group_select">
          <option value="">Select</option>
        </select>
      </div>
    `;

    const examEl = document.getElementById('exam_select') as HTMLSelectElement;
    const groupEl = document.getElementById('group_select') as HTMLSelectElement;

    examEl.addEventListener('change', () => {
      if (examEl.value === 'S.S.C') {
        groupEl.innerHTML = `
          <option value="">Select</option>
          <option value="Science">Science</option>
          <option value="Humanities">Humanities</option>
          <option value="Commerce">Commerce</option>
        `;
      }
    });

    const success = await SelectHandler.fillCascadingPair(examEl, 'SSC', groupEl, 'Science');
    expect(success).toBe(true);
    expect(examEl.value).toBe('S.S.C');
    expect(groupEl.value).toBe('Science');
  });

  // Test 11: Native select events dispatching
  it('11. Dispatches input, change, and blur events on native select update', async () => {
    document.body.innerHTML = `
      <select id="test_sel">
        <option value="">Select</option>
        <option value="S.S.C">S.S.C</option>
      </select>
    `;
    const select = document.getElementById('test_sel') as HTMLSelectElement;
    let changeFired = false;
    let inputFired = false;

    select.addEventListener('change', () => { changeFired = true; });
    select.addEventListener('input', () => { inputFired = true; });

    const handler = new SelectHandler();
    await handler.fill(select, 'SSC');

    expect(changeFired).toBe(true);
    expect(inputFired).toBe(true);
  });

  // Test 12: Actual BOGMC form end-to-end simulation
  it('12. End-to-End: Successfully fills S.S.C and H.S.C Examination on full BOGMC replica', async () => {
    const htmlPath = path.resolve(__dirname, '../../test-pages/petrobangla-form.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');
    document.documentElement.innerHTML = html;

    const scanResult = await PageScanner.scanPage(sampleDemoProfile);
    const approvedItems = scanResult.planItems.filter((i) => i.isApproved);
    const sessionId = 'session_bogmc_exam_test';

    const report = await VerificationEngine.executePlan(sessionId, approvedItems);
    expect(report.failedVerification).toBe(0);

    const sscExamVal = (document.getElementById('ssc_exam') as HTMLSelectElement).value;
    const hscExamVal = (document.getElementById('hsc_exam') as HTMLSelectElement).value;

    expect(sscExamVal).toBe('S.S.C');
    expect(hscExamVal).toBe('H.S.C');

    const debugReports = SelectHandler.getDebugReports();
    const sscDebug = debugReports.find((r) => r.section === 'SSC' && (r.field.includes('Examination') || r.field.includes('ssc_exam')));
    const hscDebug = debugReports.find((r) => r.section === 'HSC' && (r.field.includes('Examination') || r.field.includes('hsc_exam')));

    expect(sscDebug?.result).toBe('Successfully Selected');
    expect(hscDebug?.result).toBe('Successfully Selected');
  }, 15000);
});
