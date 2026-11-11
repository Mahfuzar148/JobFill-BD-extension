import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PageScanner } from '../../src/content/page-scanner';
import { sampleDemoProfile } from '../../src/types/defaults';
import { VerificationEngine } from '../../src/validation/verification-engine';
import { PetroBanglaRules } from '../../src/adapters/petrobangla/petrobangla.rules';

describe('PetroBangla Form End-to-End Live Workflow', () => {
  it(
    'Scans and automatically fills all supported fields without confidence score blockers',
    async () => {
    const htmlPath = path.resolve(__dirname, '../../test-pages/petrobangla-form.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

    document.documentElement.innerHTML = htmlContent;

    // 1. Pre-process dynamic progressive disclosure sections
    const gradChk = document.querySelector<HTMLInputElement>('#chk_grad');
    if (gradChk) {
      gradChk.checked = true;
      const gradSec = document.getElementById('sec_graduation');
      if (gradSec) gradSec.style.display = 'table';
    }

    // 2. Perform page scan
    const scanResult = await PageScanner.scanPage(sampleDemoProfile);

    expect(scanResult.totalVisibleInputs).toBeGreaterThanOrEqual(25);
    expect(scanResult.readyToFillCount).toBeGreaterThanOrEqual(20);
    expect(scanResult.ambiguousCount).toBe(0);

    // Ensure ordinary matched items are approved by default
    const matchedItems = scanResult.planItems.filter((i) => i.status === 'Matched');
    expect(matchedItems.length).toBeGreaterThanOrEqual(20);
    expect(matchedItems.every((i) => i.isApproved)).toBe(true);

    // 3. Execute Auto Fill Now
    const sessionId = 'session_test_petrobangla';
    const report = await VerificationEngine.executePlan(sessionId, matchedItems);

    expect(report.successfullyFilled).toBeGreaterThanOrEqual(20);
    const failedItems = report.items.filter((i) => i.status === 'Fill Failed');
    if (failedItems.length > 0) {
      console.log('FAILED ITEMS:', failedItems.map((i) => ({ label: i.fieldLabel, msg: i.verificationMessage, proposed: i.proposedValue, current: (i.element as any).value, tag: i.element.tagName })));
    }
    expect(report.failedVerification).toBe(0);

    // Apply postFill adapter rules
    PetroBanglaRules.applyPostFillRules(document, sampleDemoProfile);

    // 4. Verify DOM values directly
    const applicantName = (document.getElementById('applicant_name') as HTMLInputElement).value;
    const applicantNameBn = (document.getElementById('applicant_name_bn') as HTMLInputElement).value;
    const fatherName = (document.getElementById('father_name') as HTMLInputElement).value;
    const motherName = (document.getElementById('mother_name') as HTMLInputElement).value;
    const dob = (document.getElementById('dob') as HTMLInputElement).value;
    const nationality = (document.getElementById('nationality') as HTMLSelectElement).value;
    const religion = (document.getElementById('religion') as HTMLSelectElement).value;
    const gender = (document.getElementById('gender') as HTMLSelectElement).value;

    expect(applicantName).toBe('MD. HASAN MAHMUD');
    expect(applicantNameBn).toContain('মাহমুদ');
    expect(fatherName).toBe('MD. ABDUR RAHIM');
    expect(motherName).toBe('MST. FATEMA BEGUM');
    expect(dob).toBe('15-05-1998'); // DD-MM-YYYY format
    expect(nationality.toLowerCase()).toBe('bangladeshi');
    expect(religion.toLowerCase()).toBe('islam');
    expect(gender.toLowerCase()).toBe('male');

    // Education Examination Dropdown Assertions
    const sscExam = (document.getElementById('ssc_exam') as HTMLSelectElement).value;
    const hscExam = (document.getElementById('hsc_exam') as HTMLSelectElement).value;
    expect(sscExam).toBe('S.S.C');
    expect(hscExam).toBe('H.S.C');
  }, 15000);
});
