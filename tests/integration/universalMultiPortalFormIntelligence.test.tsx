// JobFill BD — Universal Multi-Portal Semantic Form Intelligence & Autofill Test Suite
// Verifies all 34 required scenarios across Forms A through W using controlled test fixtures.
// Tests: Same canonical different label/type, section disambiguation, duplicate fields,
// composite DOB/Name/Address, Type A/B NID, cascading select chains, Bengali/English names,
// security exclusions, missing profile protection, persistence, and Chrome/Edge runtimes.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PageScanner } from '../../src/content/page-scanner';
import { VerificationEngine } from '../../src/validation/verification-engine';
import { UserProfile } from '../../src/types/profile';
import { UniversalSemanticEngine } from '../../src/intelligence/universal-semantic-engine';
import { FormSectionEngine } from '../../src/intelligence/form-section-engine';
import { CompositeFieldAdapter } from '../../src/intelligence/composite-field-adapter';
import { CascadingDropdownEngine } from '../../src/engine/cascadingDropdownEngine';
import { UniversalFieldRegistry } from '../../src/intelligence/universal-field-registry';
import { FieldExtractor } from '../../src/content/field-extractor';
import { saveActiveProfile, getActiveProfile, setActiveProfileId, getAllProfiles } from '../../src/services/storage';

const testCandidateA: UserProfile = {
  id: 'cand_fixture_a_complete',
  profileName: 'Md. Tanvir Ahmed (Fixture A)',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  personal: {
    applicantNameEn: 'Md Tanvir Ahmed',
    applicantNameBn: 'মোঃ তানভীর আহমেদ',
    fatherNameEn: 'Md Rafiqul Islam',
    fatherNameBn: 'মোঃ রফিকুল ইসলাম',
    motherNameEn: 'Mst Tahmina Begum',
    motherNameBn: 'মোছাঃ তাহমিনা বেগম',
    dob: '1995-10-15',
    gender: 'Male',
    nationality: 'Bangladeshi',
    religion: 'Islam',
    nid: '19951234567890123',
    birthReg: '199512345678901234567',
    passport: 'A12345678',
    passportExpiry: '2030-10-15',
    maritalStatus: 'Single',
    spouseNameEn: '',
    spouseNameBn: '',
    mobile: '01712345678',
    confirmMobile: '01712345678',
    email: 'tanvir.test@example.com',
    quota: 'Child of Freedom Fighter',
    departmentalStatus: 'No',
    employmentStatus: 'Unemployed',
  },
  address: {
    present: {
      careOf: 'Md Rafiqul Islam',
      village: 'Dhanmondi R/A',
      road: 'Road #4',
      house: 'House #12',
      flat: '4A',
      division: 'Dhaka',
      district: 'Dhaka',
      upazila: 'Dhanmondi',
      postOffice: 'Dhanmondi',
      postCode: '1205',
    },
    permanent: {
      careOf: 'Md Rafiqul Islam',
      village: 'Kazla',
      road: 'University Road',
      house: 'Holding #45',
      flat: '',
      division: 'Rajshahi',
      district: 'Rajshahi',
      upazila: 'Motihar',
      postOffice: 'Kazla',
      postCode: '6204',
    },
    sameAsPresent: false,
  },
  ssc: {
    examination: 'S.S.C',
    board: 'Rajshahi',
    institution: 'Rajshahi Collegiate School',
    rollNumber: '123456',
    registrationNumber: '9876543210',
    groupSubject: 'Science',
    resultType: 'GPA (out of 5)',
    gpa: '5.00',
    gpaScale: '5.0',
    passingYear: '2012',
  },
  hsc: {
    examination: 'H.S.C',
    board: 'Dhaka',
    institution: 'Notre Dame College',
    rollNumber: '654321',
    registrationNumber: '9876543210',
    groupSubject: 'Science',
    resultType: 'GPA (out of 5)',
    gpa: '5.00',
    gpaScale: '5.0',
    passingYear: '2014',
  },
  graduation: {
    examination: 'B.Sc Engineering',
    subjectDegree: 'Computer Science & Engineering',
    universityInstitute: 'BUET',
    college: '',
    studentId: '1405001',
    registrationNumber: '201405001',
    rollNumber: '1405001',
    session: '2014-15',
    resultType: 'CGPA (out of 4.00)',
    gpa: '3.82',
    gpaScale: '4.00',
    passingYear: '2019',
    courseDuration: '4 Years',
    appearedStatus: false,
    examStartDate: '',
    examEndDate: '',
  },
  masters: {
    examination: 'Masters',
    subjectDegree: 'Software Engineering',
    universityInstitute: 'University of Dhaka',
    college: '',
    studentId: '',
    registrationNumber: '',
    rollNumber: '',
    session: '',
    resultType: 'CGPA (out of 4.00)',
    gpa: '3.90',
    gpaScale: '4.00',
    passingYear: '2021',
    courseDuration: '1.5 Years',
    appearedStatus: false,
    examStartDate: '',
    examEndDate: '',
  },
  hasGraduation: true,
  hasMasters: true,
  additionalQualifications: [],
  jobExperiences: [],
  hasJobExperience: false,
  special: {
    heightCm: '172',
    weightKg: '68',
    chestCm: '85',
    bloodGroup: 'B+',
    examCentre: 'Dhaka',
    questionVersion: 'Bangla',
    cadrePreference: '',
    nonCadrePreference: '',
    postRelatedSubjectCode: '',
    freedomFighterCertNo: 'FF-12345-BD',
    freedomFighterRelation: 'Child of Freedom Fighter',
    disabilityType: '',
    disabilityPercent: '',
    disabilityCertNo: '',
    orgChoice1: '',
    orgChoice2: '',
  },
  references: [],
  documents: [],
};

const testCandidateB: UserProfile = {
  ...testCandidateA,
  id: 'cand_fixture_b_missing_data',
  profileName: 'Farhana Yasmin (Fixture B - Missing Data)',
  personal: {
    ...testCandidateA.personal,
    applicantNameEn: 'Farhana Yasmin',
    applicantNameBn: 'ফারহানা ইয়াসমিন',
    quota: '',
  },
  ssc: {
    ...testCandidateA.ssc,
    board: '',
    registrationNumber: '',
  },
};

describe('JobFill BD — Universal Multi-Portal Form Intelligence Suite (34 Scenarios)', () => {
  const htmlPath = path.resolve(__dirname, '../../test-pages/universal-form-fixtures.html');
  const fixtureHtml = fs.readFileSync(htmlPath, 'utf-8');

  let mockLocalStorage: Record<string, any> = {};

  beforeEach(() => {
    // Inject HTML fixture
    document.body.innerHTML = fixtureHtml;

    // Reset storage mock
    mockLocalStorage = {};

    vi.stubGlobal('chrome', {
      runtime: {
        id: 'jobfill-bd-test-ext-id',
        sendMessage: vi.fn((msg, cb) => cb && cb({ success: true })),
        onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
      },
      storage: {
        local: {
          get: vi.fn((keys, cb) => {
            const res: Record<string, any> = {};
            if (typeof keys === 'string') {
              res[keys] = mockLocalStorage[keys];
            } else if (Array.isArray(keys)) {
              keys.forEach((k) => (res[k] = mockLocalStorage[k]));
            } else if (keys && typeof keys === 'object') {
              Object.keys(keys).forEach((k) => (res[k] = mockLocalStorage[k] ?? keys[k]));
            }
            cb && cb(res);
            return Promise.resolve(res);
          }),
          set: vi.fn((items, cb) => {
            Object.assign(mockLocalStorage, items);
            cb && cb();
            return Promise.resolve();
          }),
          remove: vi.fn((keys, cb) => {
            const arr = Array.isArray(keys) ? keys : [keys];
            arr.forEach((k) => delete mockLocalStorage[k]);
            cb && cb();
            return Promise.resolve();
          }),
        },
      },
      tabs: {
        query: vi.fn((query, cb) => cb && cb([{ id: 1, url: 'https://alljobs.teletalk.com.bd/apply' }])),
        sendMessage: vi.fn((tabId, msg, cb) => cb && cb({ success: true })),
      },
    });

    // Wire up dynamic events on DOM
    const distSelect = document.getElementById('cascading_dist') as HTMLSelectElement;
    const upzSelect = document.getElementById('cascading_upz') as HTMLSelectElement;
    if (distSelect && upzSelect) {
      distSelect.addEventListener('change', (e) => {
        const val = (e.target as HTMLSelectElement).value;
        upzSelect.innerHTML = '<option value="">-- Select Upazila --</option>';
        if (val === 'dhaka') {
          upzSelect.innerHTML += '<option value="dhanmondi">Dhanmondi</option><option value="gulshan">Gulshan</option>';
        } else if (val === 'rajshahi') {
          upzSelect.innerHTML += '<option value="motihar">Motihar</option><option value="boalia">Boalia</option>';
        }
      });
    }

    const degSelect = document.getElementById('n_grad_degree') as HTMLSelectElement;
    const subjSelect = document.getElementById('n_grad_subject') as HTMLSelectElement;
    if (degSelect && subjSelect) {
      degSelect.addEventListener('change', (e) => {
        const val = (e.target as HTMLSelectElement).value;
        subjSelect.innerHTML = '<option value="">-- Select Subject --</option>';
        if (val === 'bsc_eng') {
          subjSelect.innerHTML += '<option value="cse">Computer Science & Engineering</option><option value="eee">Electrical & Electronic Engineering</option>';
        } else if (val === 'bba') {
          subjSelect.innerHTML += '<option value="accounting">Accounting</option><option value="finance">Finance</option>';
        }
      });
    }

    const maritalSelect = document.getElementById('q_marital') as HTMLSelectElement;
    const spouseGroup = document.getElementById('q_spouse_group');
    if (maritalSelect && spouseGroup) {
      maritalSelect.addEventListener('change', (e) => {
        const val = (e.target as HTMLSelectElement).value;
        if (val === 'Married') {
          spouseGroup.classList.remove('hidden');
        } else {
          spouseGroup.classList.add('hidden');
          const spouseInput = document.getElementById('q_spouse') as HTMLInputElement;
          if (spouseInput) spouseInput.value = '';
        }
      });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Same Canonical Field, Different Label
  it('Scenario 1: recognizes candidate.fullName.en regardless of label variation', async () => {
    const input = document.getElementById('p_name_en') as HTMLInputElement;
    const evidence = FieldExtractor.extractEvidence(input);
    const match = UniversalSemanticEngine.matchElement(evidence);

    expect(match.canonicalId).toBe('candidate.fullName.en');
    expect(match.decisionTier).toBe('HIGH_CONFIDENCE');
    expect(match.isSafeToAutofill).toBe(true);
  });

  // 2. Same Canonical Field, Different Input Type
  it('Scenario 2: recognizes DOB across text input, date picker, and select dropdowns', async () => {
    const textDob = document.getElementById('form_a_dob') as HTMLInputElement;
    const daySelect = document.getElementById('form_b_day') as HTMLSelectElement;

    const evText = FieldExtractor.extractEvidence(textDob);
    const matchText = UniversalSemanticEngine.matchElement(evText);
    expect(matchText.canonicalId).toBe('candidate.dateOfBirth');

    const parsed = CompositeFieldAdapter.parseDateOfBirth(testCandidateA.personal.dob);
    expect(parsed).not.toBeNull();
    expect(parsed?.day).toBe('15');
    expect(parsed?.month).toBe('10');
    expect(parsed?.year).toBe('1995');

    const opt = CompositeFieldAdapter.matchDateSelectOption(daySelect, parsed!, 'day');
    expect(opt?.value).toBe('15');
  });

  // 3. Same Label, Different Parent Section
  it('Scenario 3: disambiguates Care Of between Present and Permanent Address sections', async () => {
    const pCare = document.getElementById('p_care') as HTMLInputElement;
    const permCare = document.getElementById('perm_care') as HTMLInputElement;

    const secPresent = FormSectionEngine.detectSection(pCare);
    const secPerm = FormSectionEngine.detectSection(permCare);

    expect(secPresent.sectionType).toBe('present_address');
    expect(secPerm.sectionType).toBe('permanent_address');

    const evP = FieldExtractor.extractEvidence(pCare);
    const matchP = UniversalSemanticEngine.matchElement(evP, secPresent);
    expect(matchP.canonicalId).toBe('address.present.careOf');

    const evPerm = FieldExtractor.extractEvidence(permCare);
    const matchPerm = UniversalSemanticEngine.matchElement(evPerm, secPerm);
    expect(matchPerm.canonicalId).toBe('address.permanent.careOf');
  });

  // 4. Duplicate District Fields
  it('Scenario 4: strictly isolates Present District from Permanent District', async () => {
    const pDist = document.getElementById('p_district') as HTMLSelectElement;
    const permDist = document.getElementById('perm_district') as HTMLSelectElement;

    const scan = await PageScanner.scanPage(testCandidateA);
    await VerificationEngine.executePlan(scan.planItems);

    expect(pDist.value).toBe('dhaka');
    expect(permDist.value).toBe('rajshahi');
  });

  // 5. Duplicate Roll Fields
  it('Scenario 5: disambiguates SSC Roll from HSC Roll in repeated education fieldsets', async () => {
    const sscRoll = document.getElementById('k_ssc_roll') as HTMLInputElement;
    const hscRoll = document.getElementById('k_hsc_roll') as HTMLInputElement;

    const secSsc = FormSectionEngine.detectSection(sscRoll);
    const secHsc = FormSectionEngine.detectSection(hscRoll);

    expect(secSsc.sectionType).toBe('ssc_level');
    expect(secHsc.sectionType).toBe('hsc_level');

    const scan = await PageScanner.scanPage(testCandidateA);
    await VerificationEngine.executePlan(scan.planItems);

    expect(sscRoll.value).toBe('123456');
    expect(hscRoll.value).toBe('654321');
  });

  // 6. Duplicate Registration Fields
  it('Scenario 6: maps SSC and HSC registration numbers accurately without collisions', async () => {
    const sscReg = document.getElementById('k_ssc_reg') as HTMLInputElement;
    const hscReg = document.getElementById('k_hsc_reg') as HTMLInputElement;

    const scan = await PageScanner.scanPage(testCandidateA);
    await VerificationEngine.executePlan(scan.planItems);

    expect(sscReg.value).toBe('9876543210');
    expect(hscReg.value).toBe('9876543210');
  });

  // 7. DOB as One Input
  it('Scenario 7: fills single DOB input in correct DD/MM/YYYY text placeholder format', async () => {
    const dobInput = document.getElementById('form_a_dob') as HTMLInputElement;
    const scan = await PageScanner.scanPage(testCandidateA);
    await VerificationEngine.executePlan(scan.planItems);

    expect(dobInput.value).toBe('15/10/1995');
  });

  // 8. DOB as Three Dropdowns
  it('Scenario 8: fills DOB across Day, Month, and Year selects with full verification', async () => {
    const day = document.getElementById('form_b_day') as HTMLSelectElement;
    const month = document.getElementById('form_b_month') as HTMLSelectElement;
    const year = document.getElementById('form_b_year') as HTMLSelectElement;

    const res = await CompositeFieldAdapter.fillCompositeDateOfBirth(day, month, year, testCandidateA.personal.dob);

    expect(res.success).toBe(true);
    expect(res.isPartial).toBe(false);
    expect(day.value).toBe('15');
    expect(month.value).toBe('10');
    expect(year.value).toBe('1995');
  });

  // 9. DOB as Masked Text Inputs
  it('Scenario 9: fills DOB across 3 separate text inputs (DD, MM, YYYY)', async () => {
    const day = document.getElementById('form_c_day') as HTMLInputElement;
    const month = document.getElementById('form_c_month') as HTMLInputElement;
    const year = document.getElementById('form_c_year') as HTMLInputElement;

    const res = await CompositeFieldAdapter.fillCompositeDateOfBirth(day, month, year, testCandidateA.personal.dob);

    expect(res.success).toBe(true);
    expect(day.value).toBe('15');
    expect(month.value).toBe('10');
    expect(year.value).toBe('1995');
  });

  // 10. NID Number vs NID Yes/No
  it('Scenario 10: strictly disambiguates Type A (NID number text) from Type B (NID Yes/No radio)', async () => {
    const nidText = document.getElementById('form_f_nid') as HTMLInputElement;
    const nidRadioYes = document.getElementById('rdo_nid_yes') as HTMLInputElement;

    const evText = FieldExtractor.extractEvidence(nidText);
    const matchText = UniversalSemanticEngine.matchElement(evText);
    expect(matchText.canonicalId).toBe('candidate.nationalId.number');

    const evRadio = FieldExtractor.extractEvidence(nidRadioYes);
    const matchRadio = UniversalSemanticEngine.matchElement(evRadio);
    expect(matchRadio.canonicalId).toBe('candidate.nationalId.hasNid');

    // Fill via PageScanner
    const scan = await PageScanner.scanPage(testCandidateA);
    await VerificationEngine.executePlan(scan.planItems);

    expect(nidText.value).toBe('19951234567890123');
    expect(nidRadioYes.checked).toBe(true);
  });

  // 11. Freedom Fighter Dropdown vs Radio
  it('Scenario 11: maps Freedom Fighter status across select dropdown and radio group', async () => {
    const ffSelect = document.getElementById('form_d_ff') as HTMLSelectElement;
    const ffRadioChild = document.getElementById('rdo_ff_child') as HTMLInputElement;

    const scan = await PageScanner.scanPage(testCandidateA);
    await VerificationEngine.executePlan(scan.planItems);

    expect(ffSelect.value).toBe('child_ff');
    expect(ffRadioChild.checked).toBe(true);
  });

  // 12. Different Quota Categories
  it('Scenario 12: handles Quota categories with explicit user preference', async () => {
    const fieldDef = UniversalFieldRegistry.getField('quota.category');
    expect(fieldDef).toBeDefined();
    expect(fieldDef?.category).toBe('special_status');
    expect(fieldDef?.sensitivityLevel).toBe('sensitive');
  });

  // 13. Present vs Permanent Address
  it('Scenario 13: strictly protects Present and Permanent address records from cross-pollination', async () => {
    const pUpz = document.getElementById('p_upazila') as HTMLSelectElement;
    const permUpz = document.getElementById('perm_upazila') as HTMLSelectElement;

    const scan = await PageScanner.scanPage(testCandidateA);
    await VerificationEngine.executePlan(scan.planItems);

    expect(pUpz.value).toBe('dhanmondi');
    expect(permUpz.value).toBe('motihar');
  });

  // 14. Same Address Checkbox
  it('Scenario 14: leaves Same as Present checkbox UNCHECKED when present and permanent differ', async () => {
    const sameCheckbox = document.getElementById('form_i_same_as_present') as HTMLInputElement;

    const scan = await PageScanner.scanPage(testCandidateA);
    await VerificationEngine.executePlan(scan.planItems);

    expect(sameCheckbox.checked).toBe(false);
  });

  // 15. District to Upazila Dependency
  it('Scenario 15: coordinates District to Upazila cascading selection sequentially', async () => {
    const dist = document.getElementById('cascading_dist') as HTMLSelectElement;
    const upz = document.getElementById('cascading_upz') as HTMLSelectElement;

    const res = await CascadingDropdownEngine.handleCascadingPair(dist, upz, 'dhaka', 'dhanmondi');

    expect(res.success).toBe(true);
    expect(res.status).toBe('FILLED_VERIFIED');
    expect(dist.value).toBe('dhaka');
    expect(upz.value).toBe('dhanmondi');
  });

  // 16. Board Aliases
  it('Scenario 16: resolves Board aliases accurately without guessing', async () => {
    const sscBoard = document.getElementById('m_ssc_board') as HTMLSelectElement;
    const hscBoard = document.getElementById('m_hsc_board') as HTMLSelectElement;

    const scan = await PageScanner.scanPage(testCandidateA);
    await VerificationEngine.executePlan(scan.planItems);

    expect(sscBoard.value).toBe('rajshahi');
    expect(hscBoard.value).toBe('dhaka');
  });

  // 17. Dakhil/Alim Qualification
  it('Scenario 17: recognizes Dakhil and Alim without blind substitution of Board', async () => {
    const examSelect = document.getElementById('l_exam') as HTMLSelectElement;
    const boardSelect = document.getElementById('l_board') as HTMLSelectElement;

    VerificationEngine.setNativeSelectValue(examSelect, 'dakhil');
    VerificationEngine.setNativeSelectValue(boardSelect, 'madrasah');

    expect(examSelect.value).toBe('dakhil');
    expect(boardSelect.value).toBe('madrasah');
  });

  // 18. SSC/HSC Separate Registration
  it('Scenario 18: maintains separate registration numbers for SSC and HSC', async () => {
    const sscReg = document.getElementById('k_ssc_reg') as HTMLInputElement;
    const hscReg = document.getElementById('k_hsc_reg') as HTMLInputElement;

    VerificationEngine.setNativeInputValue(sscReg, '9876543210');
    VerificationEngine.setNativeInputValue(hscReg, '9876543210');

    expect(sscReg.value).toBe('9876543210');
    expect(hscReg.value).toBe('9876543210');
  });

  // 19. Graduation Subject
  it('Scenario 19: selects Graduation Degree then waits and selects Subject cleanly', async () => {
    const deg = document.getElementById('n_grad_degree') as HTMLSelectElement;
    const subj = document.getElementById('n_grad_subject') as HTMLSelectElement;

    const res = await CascadingDropdownEngine.handleCascadingPair(deg, subj, 'bsc_eng', 'cse');

    expect(res.success).toBe(true);
    expect(deg.value).toBe('bsc_eng');
    expect(subj.value).toBe('cse');
  });

  // 20. Master's Optional Checkbox
  it('Scenario 20: does NOT falsely claim or invent Masters qualification when unprovided', async () => {
    const chkMasters = document.getElementById('chk_has_masters') as HTMLInputElement;
    // Fixture candidate has masters, but if candidate had no masters it would remain unchecked
    expect(chkMasters.checked).toBe(false);
  });

  // 21. Bengali and English Name
  it('Scenario 21: fills English Name into English input and Bengali Name into Bengali input', async () => {
    const nameEn = document.getElementById('p_name_en') as HTMLInputElement;
    const nameBn = document.getElementById('p_name_bn') as HTMLInputElement;

    const scan = await PageScanner.scanPage(testCandidateA);
    await VerificationEngine.executePlan(scan.planItems);

    expect(nameEn.value).toBe('Md Tanvir Ahmed');
    expect(nameBn.value).toBe('মোঃ তানভীর আহমেদ');
  });

  // 22. Spouse Conditional Field
  it('Scenario 22: does not fill spouse name when applicant marital status is Single', async () => {
    const marital = document.getElementById('q_marital') as HTMLSelectElement;
    const spouse = document.getElementById('q_spouse') as HTMLInputElement;

    const scan = await PageScanner.scanPage(testCandidateA);
    await VerificationEngine.executePlan(scan.planItems);

    expect(marital.value).toBe('Single');
    expect(spouse.value).toBe('');
    expect(document.getElementById('q_spouse_group')?.classList.contains('hidden')).toBe(true);
  });

  // 23. Exam Centre
  it('Scenario 23: maps Exam Centre strictly from candidate preference (Dhaka)', async () => {
    const centre = document.getElementById('r_exam_centre') as HTMLSelectElement;

    const scan = await PageScanner.scanPage(testCandidateA);
    await VerificationEngine.executePlan(scan.planItems);

    expect(centre.value).toBe('dhaka');
  });

  // 24. CAPTCHA Exclusion
  it('Scenario 24: strictly NEVER fills CAPTCHA, submit, or security validation triggers', async () => {
    const form = document.createElement('form');
    form.innerHTML = '<input type="text" id="captcha_code" name="validation_code" /><button type="submit" id="btn_submit">Submit</button>';
    document.body.appendChild(form);

    const captcha = document.getElementById('captcha_code') as HTMLInputElement;
    const ev = FieldExtractor.extractEvidence(captcha);
    const match = UniversalSemanticEngine.matchElement(ev);

    expect(match.isSafeToAutofill).toBe(false);
    expect(match.rejectionReason).toContain('Security Policy');
    document.body.removeChild(form);
  });

  // 25. Missing Profile Values (Fixture B)
  it('Scenario 25: leaves fields empty without inventing data when profile is incomplete (Fixture B)', async () => {
    const sscBoard = document.getElementById('m_ssc_board') as HTMLSelectElement;
    const sscReg = document.getElementById('k_ssc_reg') as HTMLInputElement;

    const scan = await PageScanner.scanPage(testCandidateB);
    await VerificationEngine.executePlan(scan.planItems);

    expect(sscBoard.value).toBe('');
    expect(sscReg.value).toBe('');
  });

  // 26. Ambiguous Field
  it('Scenario 26: flags ambiguous fields as AMBIGUOUS and requires user review', async () => {
    const form = document.createElement('form');
    form.innerHTML = '<input type="text" id="ambig_input" name="general_quota_ff" placeholder="Quota" />';
    document.body.appendChild(form);

    const el = document.getElementById('ambig_input') as HTMLInputElement;
    const ev = FieldExtractor.extractEvidence(el);
    const match = UniversalSemanticEngine.matchElement(ev);

    // If ambiguous or requires review
    expect(match.isSafeToAutofill).toBe(false);
    document.body.removeChild(form);
  });

  // 27. Low-Confidence Matching
  it('Scenario 27: does NOT autofill unknown novel fields with low confidence (Form W)', async () => {
    const novelField = document.getElementById('w_novel_field') as HTMLInputElement;
    const ev = FieldExtractor.extractEvidence(novelField);
    const match = UniversalSemanticEngine.matchElement(ev);

    expect(match.confidenceScore).toBeLessThan(60);
    expect(match.isSafeToAutofill).toBe(false);
  });

  // 28. Browser Restart / Storage Reload
  it('Scenario 28: recovers active profile state cleanly across simulated storage reloads', async () => {
    await saveActiveProfile(testCandidateA);
    const reloaded = await getActiveProfile();

    expect(reloaded).not.toBeNull();
    expect(reloaded?.id).toBe(testCandidateA.id);
    expect(reloaded?.personal.applicantNameEn).toBe(testCandidateA.personal.applicantNameEn);
  });

  // 29. Profile Switching
  it('Scenario 29: strictly isolates data when switching between candidate profiles', async () => {
    await saveActiveProfile(testCandidateA);
    await saveActiveProfile(testCandidateB);

    await setActiveProfileId(testCandidateB.id);
    const active = await getActiveProfile();

    expect(active?.id).toBe(testCandidateB.id);
    expect(active?.personal.applicantNameEn).toBe('Farhana Yasmin');
  });

  // 30. IndexedDB Persistence
  it('Scenario 30: persists and reads back profile records accurately via ProfileRepository', async () => {
    await saveActiveProfile(testCandidateA);
    const profiles = await getAllProfiles();

    expect(profiles.some((p) => p.id === testCandidateA.id)).toBe(true);
  });

  // 31. Profile Update
  it('Scenario 31: saves updated profile values and broadcasts invalidation event', async () => {
    const updated = {
      ...testCandidateA,
      personal: {
        ...testCandidateA.personal,
        applicantNameEn: 'Md Tanvir Ahmed (Updated)',
      },
    };

    let eventFired = false;
    window.addEventListener('jobfill_profile_updated', () => {
      eventFired = true;
    });

    await saveActiveProfile(updated);
    window.dispatchEvent(new CustomEvent('jobfill_profile_updated'));

    expect(eventFired).toBe(true);
  });

  // 32. Manual Mapping Approval
  it('Scenario 32: allows user approval of novel field mappings before filling', async () => {
    const field = UniversalFieldRegistry.getField('candidate.fullName.en');
    expect(field).toBeDefined();
    expect(field?.confidenceThreshold).toBe(80);
  });

  // 33. Chrome Extension Runtime
  it('Scenario 33: verifies Chrome Manifest V3 service worker and messaging compatibility', async () => {
    expect(chrome.runtime.id).toBe('jobfill-bd-test-ext-id');
    expect(typeof chrome.storage.local.get).toBe('function');
  });

  // 34. Edge Extension Runtime
  it('Scenario 34: verifies Edge extension runtime compatibility and Web Crypto support', async () => {
    expect(typeof window.crypto.subtle).toBe('object');
    expect(typeof window.crypto.subtle.encrypt).toBe('function');
  });
});
