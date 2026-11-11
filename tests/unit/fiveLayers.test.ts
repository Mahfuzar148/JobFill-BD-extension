import { describe, it, expect, beforeEach } from 'vitest';
import { FieldExtractor } from '../../src/content/field-extractor';
import { ContextAnalyzer } from '../../src/intelligence/context-analyzer';
import { FieldMatcher } from '../../src/intelligence/field-matcher';
import { DecisionEngine } from '../../src/intelligence/decision-engine';
import { OptionMatcher } from '../../src/intelligence/option-matcher';
import { VerificationEngine, FillPlanItem } from '../../src/validation/verification-engine';

describe('The 5-Layer Intelligence Architecture', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  // Layer 1: Semantic Intelligence
  it('Layer 1 (Semantic): recognizes synonyms for Applicant Name in English & Bengali', () => {
    const input = document.createElement('input');
    input.setAttribute('name', 'cand_name');
    input.setAttribute('placeholder', 'Candidate Name');
    container.appendChild(input);

    const evidence = FieldExtractor.extractEvidence(input);
    const candidates = FieldMatcher.matchField(evidence);

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].definition.canonicalId).toBe('applicant.fullName.english');
  });

  // Layer 2: Context Intelligence
  it('Layer 2 (Context): correctly disambiguates Roll No inside SSC section from HSC section', () => {
    container.innerHTML = `
      <div class="edu-block">
        <div class="form-section-title">SSC/Equivalent Level</div>
        <table>
          <tr>
            <td>Roll No</td>
            <td><input type="text" name="roll" id="ssc_roll" /></td>
          </tr>
        </table>
      </div>
      <div class="edu-block">
        <div class="form-section-title">HSC/Equivalent Level</div>
        <table>
          <tr>
            <td>Roll No</td>
            <td><input type="text" name="roll" id="hsc_roll" /></td>
          </tr>
        </table>
      </div>
    `;

    const sscInput = document.getElementById('ssc_roll') as HTMLInputElement;
    const hscInput = document.getElementById('hsc_roll') as HTMLInputElement;

    const sscEvidence = FieldExtractor.extractEvidence(sscInput);
    const hscEvidence = FieldExtractor.extractEvidence(hscInput);

    const sscContext = ContextAnalyzer.analyze(sscEvidence);
    const hscContext = ContextAnalyzer.analyze(hscEvidence);

    expect(sscContext.academicLevel).toBe('ssc');
    expect(hscContext.academicLevel).toBe('hsc');

    const sscDecision = DecisionEngine.decide(sscEvidence);
    const hscDecision = DecisionEngine.decide(hscEvidence);

    expect(sscDecision.selectedCanonicalId).toBe('education.ssc.roll');
    expect(hscDecision.selectedCanonicalId).toBe('education.hsc.roll');
  });

  // Layer 3: Matching & Ambiguity Intelligence
  it('Layer 3 (Matching & Ambiguity): scores evidence using 40/22/14/8/12/4 and detects ambiguity', () => {
    container.innerHTML = `
      <fieldset>
        <legend>Basic Information</legend>
        <label for="cand_name">Applicant's Name</label>
        <input type="text" name="applicant_name" id="cand_name" placeholder="Full Name" />
      </fieldset>
    `;

    const input = document.getElementById('cand_name') as HTMLInputElement;
    const evidence = FieldExtractor.extractEvidence(input);
    const decision = DecisionEngine.decide(evidence);

    // Exact label (40) + exact name (22) + exact placeholder (14) + section (12) + type (4) = 92
    expect(decision.matchScore).toBeGreaterThanOrEqual(85);
    expect(decision.decisionTier).toBe('HIGH_CONFIDENCE');
    expect(decision.isSafeToAutofill).toBe(true);
  });

  // Layer 4: Dynamic Form Intelligence & Bilingual Dropdown Matching
  it('Layer 4 (Dynamic Dropdown): matches bilingual options and handles selection', () => {
    const select = document.createElement('select');
    select.innerHTML = `
      <option value="">নির্বাচন করুন</option>
      <option value="1">পুরুষ</option>
      <option value="2">মহিলা</option>
    `;
    container.appendChild(select);

    const match = OptionMatcher.matchOption(select, 'Male');
    expect(match).not.toBeNull();
    expect(match?.value).toBe('1');
  });

  // Layer 5: Verification & Undo Intelligence
  it('Layer 5 (Verification & Undo): sets value natively, verifies, and restores on undo', async () => {
    const input = document.createElement('input');
    input.setAttribute('type', 'text');
    input.value = 'Old Value';
    container.appendChild(input);

    const planItem: FillPlanItem = {
      id: 'test_item_1',
      element: input,
      selector: 'input',
      canonicalId: 'applicant.fullName.english',
      fieldLabel: "Applicant's Name",
      proposedValue: 'MD. MAHFUZUR RAHMAN',
      originalValue: 'Old Value',
      hasConflict: true,
      isApproved: true,
      status: 'PENDING',
    };

    const sessionId = 'test_session_101';
    const report = await VerificationEngine.executePlan(sessionId, [planItem]);

    expect(report.successfullyFilled).toBe(1);
    expect(input.value).toBe('MD. MAHFUZUR RAHMAN');

    // Test Undo
    const undoResult = VerificationEngine.undoLastFill(sessionId);
    expect(undoResult.restoredCount).toBe(1);
    expect(input.value).toBe('Old Value');
  });
});
