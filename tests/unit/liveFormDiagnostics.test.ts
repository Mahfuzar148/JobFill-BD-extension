import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PageScanner } from '../../src/content/page-scanner';
import { VerificationEngine } from '../../src/validation/verification-engine';
import { sampleDemoProfile } from '../../src/types/defaults';
import { PetroBanglaRules } from '../../src/adapters/petrobangla/petrobangla.rules';
import { SelectHandler } from '../../src/handlers/select-handler';

describe('Live Form Deep Diagnostic Inspection & Self-Fill Verification', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = '';
    SelectHandler.clearDebugReports();
  });

  it('1. Simulates complete BOGMC form fill-up and verifies zero failures and exact DOM states', async () => {
    const htmlPath = path.resolve(__dirname, '../../test-pages/petrobangla-form.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');
    document.documentElement.innerHTML = html;

    // Apply progressive disclosures (open Graduation, Experience)
    PetroBanglaRules.applyProgressiveDisclosures(document, sampleDemoProfile);

    // Scan page
    const scanResult = await PageScanner.scanPage(sampleDemoProfile);

    expect(scanResult.conflictsCount).toBe(0);
    expect(scanResult.ambiguousCount).toBe(0);
    // Only the 2 "If Applicable" section toggle checkboxes (#chk_grad, #chk_exp) are non-data UI toggles
    const unsupportedSelectors = scanResult.planItems
      .filter((i) => i.status === 'Unsupported Field')
      .map((i) => i.selector)
      .sort();
    expect(unsupportedSelectors).toEqual(['#chk_exp', '#chk_grad']);
    expect(scanResult.readyToFillCount).toBeGreaterThanOrEqual(55);

    // Execute Fill Plan
    const approved = scanResult.planItems.filter((i) => i.isApproved);
    const sessionId = 'session_diagnostic';
    const report = await VerificationEngine.executePlan(sessionId, approved);

    expect(report.failedVerification).toBe(0);
    expect(report.successfullyFilled).toBe(approved.length);

    // Verify Result Dropdown + Numeric GPA pairs for SSC, HSC, and Graduation
    expect((document.getElementById('ssc_result') as HTMLSelectElement).value).toBe('GPA(out of 5)');
    expect((document.getElementById('ssc_gpa') as HTMLInputElement).value).toBe('5.00');
    expect((document.getElementById('hsc_result') as HTMLSelectElement).value).toBe('GPA(out of 5)');
    expect((document.getElementById('hsc_gpa') as HTMLInputElement).value).toBe('5.00');
    expect((document.getElementById('gra_result') as HTMLSelectElement).value).toBe('CGPA (out of 4)');
    expect((document.getElementById('gra_cgpa') as HTMLInputElement).value).toBe('3.82');

    // Verify Graduation Examination & Passing Year
    expect((document.getElementById('gra_examination') as HTMLSelectElement).value).toBe('B.Sc Engineering');
    expect((document.getElementById('gra_passing_year') as HTMLSelectElement).value).toBe('2021');
    expect((document.getElementById('gra_duration') as HTMLSelectElement).value).toBe('4 Years');

    // Verify Job Experience Date & Textarea
    expect((document.getElementsByName('exp_start_date')[0] as HTMLInputElement).value).toBe('01-09-21');
    expect((document.getElementsByName('exp_end_date')[0] as HTMLInputElement).value).toBe(''); // currentlyWorking = true
    expect((document.getElementsByName('CurrentlyWorking')[0] as HTMLInputElement).checked).toBe(true);
    expect((document.getElementsByName('exp_job_description')[0] as HTMLTextAreaElement).value).toContain('Leading web application');

    // Verify Undo restores both text fields and dropdowns cleanly
    const undo = VerificationEngine.undoLastFill(sessionId);
    expect(undo.restoredCount).toBeGreaterThanOrEqual(50);
    expect((document.getElementById('ssc_exam') as HTMLSelectElement).selectedIndex).toBe(0);
    expect((document.getElementById('applicant_name') as HTMLInputElement).value).toBe('');
  }, 20000);

  it('2. Handles classic Teletalk numbered PHP variable names and hidden-then-revealed GPA boxes', async () => {
    document.body.innerHTML = `
      <form id="teletalk_live_form">
        <div class="edu-block">
          <div class="edu-header">Present Address</div>
          <table>
            <tr><td>Village/Road</td><td><input type="text" name="present_vill" id="present_vill" /></td></tr>
            <tr><td>District</td><td><select name="present_dist" id="present_dist"><option value="">Select</option><option value="Dhaka">Dhaka</option></select></td></tr>
            <tr><td>Upazila/P.S.</td><td><select name="present_ps" id="present_ps"><option value="">Select</option><option value="Mohammadpur">Mohammadpur</option></select></td></tr>
            <tr><td>Post Code</td><td><input type="text" name="present_pcode" id="present_pcode" /></td></tr>
          </table>
        </div>
        <div class="edu-block">
          <div class="edu-header">SSC/Equivalent Level</div>
          <table>
            <tr><td>Examination</td><td><select name="exam1" id="exam1"><option value="">Select</option><option value="S.S.C">S.S.C</option></select></td></tr>
            <tr><td>Roll No</td><td><input type="text" name="roll1" id="roll1" /></td></tr>
            <tr>
              <td>Result</td>
              <td>
                <select name="result1" id="result1">
                  <option value="">Select</option>
                  <option value="4">GPA(out of 5)</option>
                </select>
                <input type="text" name="result_gpa1" id="result_gpa1" style="display:none;" />
              </td>
            </tr>
          </table>
        </div>
      </form>
    `;

    // Simulate live Teletalk JS revealing result_gpa1 when result1 changes to GPA(out of 5)
    const result1 = document.getElementById('result1') as HTMLSelectElement;
    const gpa1 = document.getElementById('result_gpa1') as HTMLInputElement;
    result1.addEventListener('change', () => {
      if (result1.value === '4') {
        gpa1.style.display = 'inline-block';
      }
    });

    // Pass 1 Scan & Fill
    const scan1 = await PageScanner.scanPage(sampleDemoProfile);
    const pass1Items = scan1.planItems.filter((i) => i.isApproved);
    expect(pass1Items.some((i) => i.selector === '#result_gpa1')).toBe(false); // Initially hidden

    await VerificationEngine.executePlan('teletalk_2pass', pass1Items);

    expect((document.getElementById('present_vill') as HTMLInputElement).value).toBe('Kaderabad Housing');
    expect((document.getElementById('present_dist') as HTMLSelectElement).value).toBe('Dhaka');
    expect((document.getElementById('present_ps') as HTMLSelectElement).value).toBe('Mohammadpur');
    expect((document.getElementById('present_pcode') as HTMLInputElement).value).toBe('1207');
    expect((document.getElementById('exam1') as HTMLSelectElement).value).toBe('S.S.C');
    expect((document.getElementById('roll1') as HTMLInputElement).value).toBe('142857');
    expect(result1.value).toBe('4');
    expect(gpa1.style.display).toBe('inline-block');

    // Pass 2 Scan & Fill (catches newly unlocked result_gpa1!)
    const scan2 = await PageScanner.scanPage(sampleDemoProfile);
    const pass2Items = scan2.planItems.filter(
      (i) => i.isApproved && !pass1Items.some((p1) => p1.element === i.element && p1.status === 'Filled')
    );
    expect(pass2Items.some((i) => i.selector === '#result_gpa1')).toBe(true);

    await VerificationEngine.executePlan('teletalk_2pass', pass2Items);
    expect(gpa1.value).toBe('5.00');
  });
});
