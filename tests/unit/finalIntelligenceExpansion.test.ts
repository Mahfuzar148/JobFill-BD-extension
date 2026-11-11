import { describe, it, expect, beforeEach } from 'vitest';
import { CrossFieldValidator } from '../../src/intelligence/cross-field-validator';
import { FieldRelationshipGraph } from '../../src/intelligence/relationship-graph';
import { FormSchemaEngine } from '../../src/intelligence/form-schema-engine';
import { MultiPassScanner } from '../../src/intelligence/multi-pass-scanner';
import { TransactionManager } from '../../src/validation/transaction-manager';
import { SchemaChangeDetector } from '../../src/intelligence/schema-change-detector';
import { SiteErrorAnalyzer } from '../../src/validation/site-error-analyzer';
import { QualityCalibrationEngine } from '../../src/intelligence/quality-calibration';
import { sampleDemoProfile } from '../../src/types/defaults';
import { FillPlanItem } from '../../src/validation/verification-engine';
import { FieldEvidence } from '../../src/content/field-extractor';

describe('Final Intelligence Expansion — 8 Advanced Engines', () => {
  let testContainer: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    testContainer = document.createElement('div');
    document.body.appendChild(testContainer);
    QualityCalibrationEngine.resetMetrics();
  });

  // 1. Cross-Field Consistency Intelligence
  it('1. Cross-Field: catches mobile mismatches and chronological educational errors', () => {
    const conflictedProfile = {
      ...sampleDemoProfile,
      personal: {
        ...sampleDemoProfile.personal,
        mobile: '01711223344',
        confirmMobile: '01999887766', // Mismatch!
        dob: '2015-01-01', // Under 18!
      },
      ssc: {
        ...sampleDemoProfile.ssc,
        passingYear: '2018',
      },
      hsc: {
        ...sampleDemoProfile.hsc,
        passingYear: '2016', // Earlier than SSC! Impossible!
      },
    };

    const issues = CrossFieldValidator.validate(conflictedProfile);
    expect(issues.length).toBeGreaterThanOrEqual(3);

    const mobileIssue = issues.find((i) => i.titleEn.includes('Mobile Numbers Do Not Match'));
    expect(mobileIssue).toBeDefined();
    expect(mobileIssue?.severity).toBe('CRITICAL_ERROR');

    const ageIssue = issues.find((i) => i.titleEn.includes('Applicant Under 18'));
    expect(ageIssue).toBeDefined();

    const eduIssue = issues.find((i) => i.titleEn.includes('HSC Passing Year Must Be After SSC'));
    expect(eduIssue).toBeDefined();
  });

  // 2. Field Relationship Graph
  it('2. Relationship Graph: resolves parent groups and dependency chains', () => {
    const sscRollNode = FieldRelationshipGraph.getNode('education.ssc.roll');
    expect(sscRollNode).toBeDefined();
    expect(sscRollNode?.parentGroup).toBe('education.ssc');

    // Context compatibility
    expect(FieldRelationshipGraph.isContextCompatible('education.ssc.roll', 'education.ssc')).toBe(true);
    expect(FieldRelationshipGraph.isContextCompatible('education.ssc.roll', 'address.permanent')).toBe(false);

    // Dependencies (Upazila depends on District)
    const upzDeps = FieldRelationshipGraph.getDependency('address.present.upazila');
    expect(upzDeps).toContain('address.present.district');
  });

  // 3. Full Form Schema Intelligence
  it('3. Form Schema: analyzes structural layout, sections, and conditional elements', () => {
    testContainer.innerHTML = `
      <div class="form-header-bar">Basic Information</div>
      <input type="text" name="applicant_name" required />
      <div class="edu-block">
        <label><input type="checkbox" id="chk_grad" checked /> If Applicable</label>
        <div class="edu-header">Graduation/Equivalent Level</div>
        <input type="text" name="gra_subject" />
      </div>
    `;

    const schema = FormSchemaEngine.analyzeDocument(document);
    expect(schema.sections.length).toBeGreaterThanOrEqual(2);
    expect(schema.totalFieldsCount).toBeGreaterThanOrEqual(2);
    expect(schema.requiredFieldsCount).toBe(1);
    expect(schema.conditionalSectionsCount).toBeGreaterThanOrEqual(1);
  });

  // 4. Multi-Pass Detection Pipeline (7 Passes)
  it('4. Multi-Pass Scanner: completes Passes 1 through 7 and builds fill plan', async () => {
    testContainer.innerHTML = `
      <div class="form-header-bar">Basic Information</div>
      <label for="c_name">Applicant's Name</label>
      <input type="text" name="applicant_name" id="c_name" placeholder="Applicant's Name" />
      <label for="c_dob">Date of Birth</label>
      <input type="text" name="dob" id="c_dob" placeholder="DD-MM-YYYY" />
    `;

    const result = await MultiPassScanner.execute7PassDetection(document, sampleDemoProfile);
    expect(result.pass1DiscoveredCount).toBe(2);
    expect(result.pass2ExtractedEvidence.length).toBe(2);
    expect(result.pass3ContextResults.length).toBe(2);
    expect(result.pass6ValidatedPlan.length).toBe(2);
    expect(result.pass7FinalReport.approvedCount).toBeGreaterThanOrEqual(1);
  });

  // 5. Transactional Form Filling, Idempotency & Rollback
  it('5. Transaction Manager: executes transactionally and performs clean rollback', async () => {
    const input1 = document.createElement('input');
    input1.value = 'Initial';
    testContainer.appendChild(input1);

    const planItem: FillPlanItem = {
      id: 'tx_item_1',
      element: input1,
      selector: 'input',
      canonicalId: 'applicant.fullName.english',
      fieldLabel: 'Applicant Name',
      proposedValue: 'MD. MAHFUZUR RAHMAN',
      originalValue: 'Initial',
      hasConflict: false,
      isApproved: true,
      status: 'PENDING',
    };

    const txId = 'tx_session_001';
    const tx = await TransactionManager.executeTransaction(txId, [planItem]);

    expect(tx.status).toBe('COMMITTED');
    expect(input1.value).toBe('MD. MAHFUZUR RAHMAN');

    // Idempotency: re-running the same plan shouldn't break or duplicate
    const tx2 = await TransactionManager.executeTransaction(txId, [planItem]);
    expect(tx2.status).toBe('COMMITTED');
    expect(input1.value).toBe('MD. MAHFUZUR RAHMAN');

    // Rollback
    const rb = TransactionManager.rollback(txId);
    expect(rb.restoredCount).toBe(1);
    expect(input1.value).toBe('Initial');
  });

  // 6. Website Schema Change Detection
  it('6. Schema Change Detector: detects drift when website changes input type', () => {
    const fakeEvidence: FieldEvidence = {
      element: document.createElement('input'),
      selector: '#input_district',
      tagName: 'select', // changed to select!
      inputType: 'select',
      name: 'district',
      id: 'input_district',
      label: 'district',
      placeholder: '',
      ariaLabel: '',
      ariaLabelledBy: '',
      title: '',
      legend: '',
      tableHeader: '',
      parentContextText: 'present address',
      options: [],
      maxLength: 0,
      pattern: '',
      isRequired: false,
      isReadOnly: false,
      isDisabled: false,
      currentValue: '',
    };

    const oldRecord = {
      fingerprintHash: 'local::present_address::input:text::district',
      domain: 'local',
      canonicalKey: 'address.present.district',
      confirmationCount: 1,
      lastConfirmedAt: '2026-01-01',
      accuracyScore: 95,
    };

    const driftReport = SchemaChangeDetector.verifyMappingFreshness(fakeEvidence, oldRecord);
    expect(driftReport.hasStructuralDrift).toBe(true);
    expect(driftReport.recommendedAction).toBe('INVALIDATE');
  });

  // 7. Site Validation Error Intelligence
  it('7. Site Error Analyzer: pairs error feedback with corresponding form fields', () => {
    testContainer.innerHTML = `
      <div>
        <label>Mobile Number</label>
        <input type="text" name="mobile" id="mobile" value="123" />
        <span class="invalid-feedback text-danger" id="mobile-err">Mobile number must be 11 digits</span>
      </div>
    `;

    const errors = SiteErrorAnalyzer.scanPageErrors(document);
    expect(errors.length).toBe(1);
    expect(errors[0].rawErrorMessage).toContain('11 digits');
    expect(errors[0].probableCauseEn).toContain('11-digit');
  });

  // 8. Quality Calibration Engine
  it('8. Quality Calibration: calculates precision, recall, and accuracy metrics', () => {
    QualityCalibrationEngine.recordMatchOutcome(true, false, false, false);
    QualityCalibrationEngine.recordMatchOutcome(true, false, false, false);
    QualityCalibrationEngine.recordMatchOutcome(false, false, false, true); // 1 correction

    const metrics = QualityCalibrationEngine.getMetrics();
    expect(metrics.totalFieldsTested).toBe(3);
    expect(metrics.truePositives).toBe(2);
    expect(metrics.userCorrectionCount).toBe(1);
    expect(metrics.precisionRate).toBeGreaterThan(60);
  });
});
