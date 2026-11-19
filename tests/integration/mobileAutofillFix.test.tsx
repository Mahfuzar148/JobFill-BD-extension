import { describe, it, expect, beforeEach } from 'vitest';
import { PageScanner } from '../../src/content/page-scanner';
import { VerificationEngine } from '../../src/validation/verification-engine';
import { TextInputHandler } from '../../src/handlers/text-input-handler';
import { ValueNormalizer } from '../../src/intelligence/value-normalizer';
import { sampleDemoProfile } from '../../src/types/defaults';
import { UserProfile } from '../../src/types/profile';

describe('JobFill BD — Mobile & Confirm Mobile Autofill Fix Suite', () => {
  let baseProfile: UserProfile;

  beforeEach(() => {
    document.body.innerHTML = '';
    baseProfile = JSON.parse(JSON.stringify(sampleDemoProfile));
  });

  // 1. Full 11-digit string with leading zero into both Mobile and Confirm Mobile
  it('Scenario 1: Reads string mobile number from profile, preserves leading zero, fills both fields identically', async () => {
    baseProfile.personal.mobile = '01712345678';
    baseProfile.personal.confirmMobile = '01712345678';

    document.body.innerHTML = `
      <form id="appForm">
        <label for="mobile">Mobile Number *</label>
        <input type="text" id="mobile" name="mobile" />

        <label for="confirm_mobile">Confirm Mobile Number *</label>
        <input type="text" id="confirm_mobile" name="confirm_mobile" />
      </form>
    `;

    const scan = await PageScanner.scanPage(baseProfile);
    const mobItem = scan.planItems.find((p) => p.canonicalId === 'contact.mobile');
    const confItem = scan.planItems.find(
      (p) => p.canonicalId === 'contact.confirmMobile' || p.canonicalId === 'contact.alternateMobile'
    );

    expect(mobItem).toBeDefined();
    expect(confItem).toBeDefined();
    expect(mobItem?.proposedValue).toBe('01712345678');
    expect(confItem?.proposedValue).toBe('01712345678');

    const report = await VerificationEngine.executePlan('session_mobile_1', scan.planItems);
    const mobEl = document.getElementById('mobile') as HTMLInputElement;
    const confEl = document.getElementById('confirm_mobile') as HTMLInputElement;

    expect(mobEl.value).toBe('01712345678');
    expect(confEl.value).toBe('01712345678');
    expect(mobEl.value.startsWith('0')).toBe(true);
    expect(mobEl.value.length).toBe(11);
    expect(confEl.value).toBe(mobEl.value);
    expect(report.successfullyFilled).toBe(2);
    expect(report.failedVerification).toBe(0);
  });

  // 2. Normalizes +880 / 880 / hyphens and strictly preserves leading zero
  it('Scenario 2: Normalizes formatted phone numbers (+8801712345678) into clean 11-digit string starting with 01', () => {
    expect(ValueNormalizer.normalizeMobileNumber('+8801712345678')).toBe('01712345678');
    expect(ValueNormalizer.normalizeMobileNumber('8801712345678')).toBe('01712345678');
    expect(ValueNormalizer.normalizeMobileNumber('01712-345678')).toBe('01712345678');
    expect(ValueNormalizer.normalizeMobileNumber('০১৭১২৩৪৫৬৭৮')).toBe('01712345678');
  });

  // 3. Restores missing leading zero if profile number was stored as 10-digit number (1712345678)
  it('Scenario 3: Restores dropped leading zero if candidate mobile was stored without leading zero', () => {
    expect(ValueNormalizer.normalizeMobileNumber('1712345678')).toBe('01712345678');
    expect(ValueNormalizer.normalizeMobileNumber(1712345678 as any)).toBe('01712345678');
  });

  // 4. Rejects corrupted value "2" or short fragments, never truncates or corrupts field
  it('Scenario 4: Rejects corrupted value "2" or short fragments with Validation Rejected error', async () => {
    const handler = new TextInputHandler();
    const input = document.createElement('input');
    input.type = 'tel';
    input.name = 'mobile';
    document.body.appendChild(input);

    const result = await handler.fill(input, '2');
    expect(result.success).toBe(false);
    expect(result.status).toBe('Fill Failed');
    expect(result.message).toContain('Validation Rejected');
    expect(input.value).toBe(''); // Never sets "2" into the field
  });

  // 5. Rejects silent truncation when input has restrictive maxLength
  it('Scenario 5: Rejects silent truncation if input has maxLength shorter than 11 digits', async () => {
    const handler = new TextInputHandler();
    const input = document.createElement('input');
    input.type = 'tel';
    input.name = 'mobile';
    input.maxLength = 8;
    document.body.appendChild(input);

    const result = await handler.fill(input, '01712345678');
    expect(result.success).toBe(false);
    expect(result.status).toBe('Fill Failed');
    expect(result.message).toContain('Validation Rejected');
    expect(result.message).toContain('exceeds field maxLength');
    expect(input.value).toBe('');
  });

  // 6. Disambiguates Teletalk confirm mobile aliases (c_mobile, cmobile, re_mobile, retype_mobile)
  it('Scenario 6: Accurately maps various Teletalk confirm mobile aliases without ambiguity', async () => {
    baseProfile.personal.mobile = '01712345678';

    document.body.innerHTML = `
      <form id="appForm">
        <input type="text" id="mob" name="mobile_no" />
        <input type="text" id="cmob" name="c_mobile" />
      </form>
    `;

    const scan = await PageScanner.scanPage(baseProfile);
    const mobItem = scan.planItems.find((p) => p.element.id === 'mob');
    const cmobItem = scan.planItems.find((p) => p.element.id === 'cmob');

    expect(mobItem?.canonicalId).toBe('contact.mobile');
    expect(cmobItem?.canonicalId).toMatch(/contact\.(confirmMobile|alternateMobile)/);
    expect(mobItem?.proposedValue).toBe('01712345678');
    expect(cmobItem?.proposedValue).toBe('01712345678');
  });

  // 7. React 16+ Value Tracker integration
  it('Scenario 7: Bypasses React value tracker so framework state synchronizes correctly', async () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.name = 'mobile';
    document.body.appendChild(input);

    let reactState = '';
    (input as any)._valueTracker = {
      getValue: () => reactState,
      setValue: (v: string) => { reactState = v; },
      stop: () => {},
    };

    const handler = new TextInputHandler();
    const res = await handler.fill(input, '01712345678');
    expect(res.success).toBe(true);
    expect(input.value).toBe('01712345678');
  });

  // 8. Fails verification if Confirm Mobile does not match Primary Mobile
  it('Scenario 8: Verification engine fails execution if Confirm Mobile deviates from Primary Mobile', async () => {
    baseProfile.personal.mobile = '01712345678';
    baseProfile.personal.confirmMobile = '01712345678';

    document.body.innerHTML = `
      <form id="appForm">
        <input type="text" id="mobile" name="mobile" />
        <input type="text" id="confirm_mobile" name="confirm_mobile" />
      </form>
    `;

    const scan = await PageScanner.scanPage(baseProfile);

    // Tamper with confirm input to simulate mismatch
    const confItem = scan.planItems.find((p) => p.canonicalId.includes('confirm') || p.canonicalId.includes('alternate'));
    if (confItem) {
      confItem.proposedValue = '01899999999';
    }

    const report = await VerificationEngine.executePlan('session_mobile_mismatch', scan.planItems);
    expect(report.failedVerification).toBeGreaterThan(0);
    const failedConf = report.items.find((p) => p.canonicalId.includes('confirm') || p.canonicalId.includes('alternate'));
    expect(failedConf?.status).toBe('Fill Failed');
    expect(failedConf?.verificationMessage).toContain('does not match primary Mobile');
  });

  // 9. Auto-populates Confirm Mobile identically even if profile.confirmMobile is blank
  it('Scenario 9: Mirrors primary mobile into Confirm Mobile even if profile confirmMobile is blank', async () => {
    baseProfile.personal.mobile = '01812345678';
    baseProfile.personal.confirmMobile = ''; // empty in profile

    document.body.innerHTML = `
      <form id="appForm">
        <input type="text" id="mobile" name="mobile" />
        <input type="text" id="confirm_mobile" name="confirm_mobile" />
      </form>
    `;

    const scan = await PageScanner.scanPage(baseProfile);
    const confItem = scan.planItems.find((p) => p.canonicalId.includes('confirm') || p.canonicalId.includes('alternate'));

    expect(confItem).toBeDefined();
    expect(confItem?.proposedValue).toBe('01812345678');

    await VerificationEngine.executePlan('session_mobile_mirror', scan.planItems);
    const confEl = document.getElementById('confirm_mobile') as HTMLInputElement;
    expect(confEl.value).toBe('01812345678');
  });

  // 10. Verification strictly rejects truncated or partial values
  it('Scenario 10: TextInputHandler.verify strictly rejects partial values (e.g. 5 digits)', () => {
    const handler = new TextInputHandler();
    const input = document.createElement('input');
    input.type = 'tel';
    input.name = 'mobile';
    input.value = '01712'; // truncated 5 digits

    // Must NOT pass verification for mobile field
    expect(handler.verify(input, '01712345678')).toBe(false);

    input.value = '01712345678';
    expect(handler.verify(input, '01712345678')).toBe(true);
  });
});
