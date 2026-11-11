import { describe, it, expect } from 'vitest';
import { FormDetector } from '../../src/content/form-detector';
import { SectionDetector } from '../../src/content/section-detector';
import { AmbiguityDetector } from '../../src/intelligence/ambiguity-detector';
import { FieldFiller } from '../../src/content/field-filler';

describe('Phase 8, 9, 10: DOM Scanner, Context & Field Filler', () => {
  it('detects government recruitment forms and filters out search forms', () => {
    const doc = document.implementation.createHTMLDocument();

    // 1. Application form
    const appForm = doc.createElement('form');
    appForm.id = 'petrobangla_apply';
    appForm.innerHTML = `
      <h2>Basic Information</h2>
      <label>Applicant Name</label><input type="text" name="app_name" />
      <label>Father's Name</label><input type="text" name="father_name" />
      <label>SSC Roll</label><input type="text" name="ssc_roll" />
    `;
    doc.body.appendChild(appForm);

    // 2. Search form
    const searchForm = doc.createElement('form');
    searchForm.innerHTML = `<input type="search" name="q" />`;
    doc.body.appendChild(searchForm);

    const detected = FormDetector.detectApplicationForms(doc);
    const appFormInfo = detected.find((d) => d.formElement.id === 'petrobangla_apply');
    expect(appFormInfo).toBeDefined();
    expect(appFormInfo?.isGovernmentApplication).toBe(true);

    const searchFormInfo = detected.find((d) => d.formElement === searchForm);
    expect(searchFormInfo?.isGovernmentApplication).toBe(false);
  });

  it('detects section context from fieldset legend and container hierarchy', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <fieldset>
        <legend>SSC/Equivalent Level</legend>
        <input id="ssc_roll_input" type="text" />
      </fieldset>

      <fieldset>
        <legend>HSC/Equivalent Level</legend>
        <input id="hsc_roll_input" type="text" />
      </fieldset>

      <div class="present-address-box">
        <h4>Present Address (বর্তমান ঠিকানা)</h4>
        <input id="present_careof" type="text" />
      </div>
    `;
    document.body.appendChild(container);

    const sscInput = document.getElementById('ssc_roll_input')!;
    const hscInput = document.getElementById('hsc_roll_input')!;
    const presentInput = document.getElementById('present_careof')!;

    expect(SectionDetector.detectElementSection(sscInput)).toBe('ssc');
    expect(SectionDetector.detectElementSection(hscInput)).toBe('hsc');
    expect(SectionDetector.detectElementSection(presentInput)).toBe('present_address');

    container.remove();
  });

  it('detects ambiguous candidate matches when margin is under 15 points', () => {
    const candidates = [
      { fieldKey: 'education.ssc.roll', totalScore: 82, reasons: [] },
      { fieldKey: 'education.hsc.roll', totalScore: 78, reasons: [] }, // margin = 4 (< 15)
    ];

    expect(AmbiguityDetector.isAmbiguous(candidates, 15)).toBe(true);

    const clearCandidates = [
      { fieldKey: 'applicant.fullName.english', totalScore: 92, reasons: [] },
      { fieldKey: 'family.father.name.english', totalScore: 60, reasons: [] }, // margin = 32 (> 15)
    ];

    expect(AmbiguityDetector.isAmbiguous(clearCandidates, 15)).toBe(false);
  });

  it('safely populates input values using FieldFiller', () => {
    const input = document.createElement('input');
    input.type = 'text';
    document.body.appendChild(input);

    const res = FieldFiller.fillTextInput(input, 'MAHFUZUR RAHMAN');
    expect(res.success).toBe(true);
    expect(input.value).toBe('MAHFUZUR RAHMAN');

    input.remove();
  });
});
