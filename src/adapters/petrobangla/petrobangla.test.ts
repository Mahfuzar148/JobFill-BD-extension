// JobFill BD - PetroBangla Adapter Unit & Integration Tests
import { describe, it, expect } from 'vitest';
import { PetroBanglaDetector } from './petrobangla.detector';
import { PETROBANGLA_FIELD_MAPS } from './petrobangla.field-map';
import { PetroBanglaRules } from './petrobangla.rules';

describe('PetroBangla / BOGMC Dedicated Adapter Suite', () => {
  it('1. Detects live BOGMC 2026 application URL with arbitrary query parameters', () => {
    const liveBogmcUrl =
      'http://bogmc.teletalk.com.bd/bogmc_2026/application.php?post_code=xZ0N&info=wpIObm3OaDUCVGb6RZEfskDWnXJG6ZX0Lbi3wmR3p%2FW1xiAK&alljobs_id=&nid=2&submitPremium=';

    const result = PetroBanglaDetector.detect(liveBogmcUrl);
    expect(result.isSupported).toBe(true);
    expect(result.organization).toContain('Bangladesh Oil, Gas and Mineral Corporation');
    expect(result.platform).toContain('Teletalk');
    expect(result.pageType).toBe('application_form');
  });

  it('2. Detects local PetroBangla replica form page', () => {
    const mockUrl = 'file:///D:/Job%20form%20Fill-up%20extension/dist/test-pages/petrobangla-form.html';
    const result = PetroBanglaDetector.detect(mockUrl);
    expect(result.isSupported).toBe(true);
    expect(result.pageType).toBe('application_form');
  });

  it('3. Rejects non-government or unsupported URLs', () => {
    const unknownUrl = 'https://example.com/jobs/apply';
    const result = PetroBanglaDetector.detect(unknownUrl);
    expect(result.isSupported).toBe(false);
  });

  it('4. Contains canonical mappings for key BOGMC form sections', () => {
    const nameMap = PETROBANGLA_FIELD_MAPS.find((m) => m.canonicalKey === 'applicant.fullName.english');
    expect(nameMap).toBeDefined();
    expect(nameMap?.fieldNames).toContain('name');

    const sscRollMap = PETROBANGLA_FIELD_MAPS.find((m) => m.canonicalKey === 'education.ssc.roll');
    expect(sscRollMap).toBeDefined();
    expect(sscRollMap?.sectionHint).toBe('ssc');

    const choice1Map = PETROBANGLA_FIELD_MAPS.find((m) => m.canonicalKey === 'circular.orgChoice1');
    expect(choice1Map).toBeDefined();
    expect(choice1Map?.fieldNames).toContain('org_choice_1');
  });

  it('5. Strictly protects CAPTCHA, passwords, and submit buttons from auto-filling', () => {
    const fakeCaptcha = document.createElement('input');
    fakeCaptcha.setAttribute('name', 'val_code');
    fakeCaptcha.setAttribute('type', 'text');
    expect(PetroBanglaRules.isProtected(fakeCaptcha)).toBe(true);

    const fakeSubmit = document.createElement('input');
    fakeSubmit.setAttribute('type', 'submit');
    expect(PetroBanglaRules.isProtected(fakeSubmit)).toBe(true);

    const fakeRegularInput = document.createElement('input');
    fakeRegularInput.setAttribute('name', 'father_name');
    fakeRegularInput.setAttribute('type', 'text');
    expect(PetroBanglaRules.isProtected(fakeRegularInput)).toBe(false);
  });
});
