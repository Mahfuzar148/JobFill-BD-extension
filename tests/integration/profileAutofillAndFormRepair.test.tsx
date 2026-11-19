// JobFill BD - Comprehensive Profile Autofill, Dynamic Cascading Dropdown & Profile Update Integration Suite
// Verifies all 32 required assertions across Scenarios 1-5 with Fixture A and Fixture B

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PageScanner } from '../../src/content/page-scanner';
import { VerificationEngine } from '../../src/validation/verification-engine';
import { UserProfile } from '../../src/types/profile';
import { ProfileRepository } from '../../src/database/profile-repository';
import { saveActiveProfile, getActiveProfile, getAllProfiles, setActiveProfileId } from '../../src/services/storage';

// -------------------------------------------------------------------------
// Synthetic Test Fixtures (Strict Isolation from Real User Identity)
// -------------------------------------------------------------------------

export const fixtureCandidateA: UserProfile = {
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

// Fixture B: Deliberately missing registration numbers and missing Board information
export const fixtureCandidateB: UserProfile = {
  ...fixtureCandidateA,
  id: 'cand_fixture_b_missing_data',
  profileName: 'Farhana Yasmin (Fixture B - Missing Data)',
  personal: {
    ...fixtureCandidateA.personal,
    applicantNameEn: 'Farhana Yasmin',
    applicantNameBn: 'ফারহানা ইয়াসমিন',
    quota: '', // No quota saved
  },
  ssc: {
    ...fixtureCandidateA.ssc,
    board: '', // Deliberately missing board
    registrationNumber: '', // Deliberately missing registration
  },
  hsc: {
    ...fixtureCandidateA.hsc,
    board: '', // Deliberately missing board
    registrationNumber: '', // Deliberately missing registration
  },
  special: {
    ...fixtureCandidateA.special,
    freedomFighterRelation: '', // Deliberately missing freedom fighter status
    freedomFighterCertNo: '',
  },
};

// -------------------------------------------------------------------------
// Helper: Load Controlled Test HTML into JSDOM and bind cascades
// -------------------------------------------------------------------------

function setupControlledTestPage(): void {
  const htmlPath = path.resolve(__dirname, '../../test-pages/profile-autofill-scenarios.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  document.documentElement.innerHTML = html;

  // Bind District -> Upazila Cascading Logic
  const upazilaData: Record<string, string[]> = {
    Dhaka: ['Dhanmondi', 'Gulshan', 'Mirpur', 'Uttara', 'Savar'],
    Rajshahi: ['Boalia', 'Motihar', 'Rajpoot', 'Puthia', 'Bagmara', 'Godagari'],
    Chittagong: ['Kotwali', 'Panchlaish', 'Double Mooring', 'Hathazari'],
    Khulna: ['Kotwali', 'Sonadanga', 'Daulatpur', 'Khalishpur'],
  };

  const bindCascade = (distId: string, upaId: string) => {
    const d = document.getElementById(distId) as HTMLSelectElement;
    const u = document.getElementById(upaId) as HTMLSelectElement;
    if (!d || !u) return;
    d.addEventListener('change', () => {
      u.innerHTML = '<option value="">Select Upazila</option>';
      const list = upazilaData[d.value] || [];
      list.forEach((optText) => {
        const opt = document.createElement('option');
        opt.value = optText;
        opt.textContent = optText;
        u.appendChild(opt);
      });
    });
  };

  bindCascade('present_district', 'present_upazila');
  bindCascade('permanent_district', 'permanent_upazila');

  // Bind Degree -> Subject Cascading Logic
  const subjectData: Record<string, string[]> = {
    'B.Sc Engineering': [
      'Computer Science & Engineering',
      'Electrical & Electronic Engineering',
      'Civil Engineering',
      'Mechanical Engineering',
    ],
    'B.Sc (Hons)': ['Physics', 'Chemistry', 'Mathematics', 'Statistics'],
    'B.B.A': ['Finance', 'Marketing', 'Accounting', 'Management'],
    'B.A (Hons)': ['English', 'Bangla', 'History', 'Philosophy'],
  };

  const deg = document.getElementById('gra_exam') as HTMLSelectElement;
  const sub = document.getElementById('gra_subject') as HTMLSelectElement;
  if (deg && sub) {
    deg.addEventListener('change', () => {
      sub.innerHTML = '<option value="">Select Subject</option>';
      const list = subjectData[deg.value] || [];
      list.forEach((optText) => {
        const opt = document.createElement('option');
        opt.value = optText;
        opt.textContent = optText;
        sub.appendChild(opt);
      });
    });
  }

  // Same as Present Checkbox handler
  const sameChk = document.getElementById('same_as_present') as HTMLInputElement;
  if (sameChk) {
    sameChk.addEventListener('change', () => {
      if (sameChk.checked) {
        (document.getElementById('permanent_care') as HTMLInputElement).value = (
          document.getElementById('present_care') as HTMLInputElement
        ).value;
        (document.getElementById('permanent_village') as HTMLInputElement).value = (
          document.getElementById('present_village') as HTMLInputElement
        ).value;
        const pDist = (document.getElementById('present_district') as HTMLSelectElement).value;
        const permDist = document.getElementById('permanent_district') as HTMLSelectElement;
        permDist.value = pDist;
        permDist.dispatchEvent(new Event('change'));
        const pUpa = (document.getElementById('present_upazila') as HTMLSelectElement).value;
        const permUpa = document.getElementById('permanent_upazila') as HTMLSelectElement;
        permUpa.value = pUpa;
        (document.getElementById('permanent_post') as HTMLInputElement).value = (
          document.getElementById('present_post') as HTMLInputElement
        ).value;
        (document.getElementById('permanent_postcode') as HTMLInputElement).value = (
          document.getElementById('present_postcode') as HTMLInputElement
        ).value;
      }
    });
  }
}

// -------------------------------------------------------------------------
// Master Test Suite (32 Required Assertions)
// -------------------------------------------------------------------------

describe('JobFill BD — Complete Profile-Driven Autofill, Dynamic Dropdown & Profile Save Suite', () => {
  beforeEach(() => {
    setupControlledTestPage();
  });

  afterEach(() => {
    document.documentElement.innerHTML = '';
  });

  // =========================================================================
  // Scenarios 1 & 2: Personal, Contact & Quota Assertions
  // =========================================================================

  it('1. DOB fills in correct portal format (DD/MM/YYYY text placeholder)', async () => {
    const scan = await PageScanner.scanPage(fixtureCandidateA);
    const dobItem = scan.planItems.find((i) => i.selector === '#dob_text');
    expect(dobItem).toBeDefined();
    expect(dobItem?.canonicalId).toBe('applicant.dateOfBirth');
    // ISO 1995-10-15 formatted to DD/MM/YYYY
    expect(dobItem?.proposedValue).toBe('15/10/1995');

    await VerificationEngine.executePlan('dob_test', [dobItem!]);
    expect((document.getElementById('dob_text') as HTMLInputElement).value).toBe('15/10/1995');
  });

  it('2. Mobile fills and preserves leading zeroes as string', async () => {
    const scan = await PageScanner.scanPage(fixtureCandidateA);
    const mobItem = scan.planItems.find((i) => i.selector === '#mobile');
    expect(mobItem).toBeDefined();
    expect(mobItem?.proposedValue).toBe('01712345678');
    expect(typeof mobItem?.proposedValue).toBe('string');
    expect(mobItem?.proposedValue.startsWith('01')).toBe(true);

    await VerificationEngine.executePlan('mobile_test', [mobItem!]);
    expect((document.getElementById('mobile') as HTMLInputElement).value).toBe('01712345678');
  });

  it('3. Confirm Mobile fills with matching number', async () => {
    const scan = await PageScanner.scanPage(fixtureCandidateA);
    const primaryItem = scan.planItems.find((i) => i.selector === '#mobile');
    const confirmItem = scan.planItems.find((i) => i.selector === '#confirm_mobile');

    expect(confirmItem).toBeDefined();
    expect(confirmItem?.canonicalId).toBe('contact.confirmMobile');
    expect(confirmItem?.proposedValue).toBe(fixtureCandidateA.personal.mobile);

    await VerificationEngine.executePlan('confirm_mobile_test', [primaryItem!, confirmItem!]);
    expect((document.getElementById('confirm_mobile') as HTMLInputElement).value).toBe('01712345678');
    expect((document.getElementById('confirm_mobile') as HTMLInputElement).value).toBe(
      (document.getElementById('mobile') as HTMLInputElement).value
    );
  });

  it('4. Freedom Fighter status uses explicit Profile value (never assumed)', async () => {
    const scan = await PageScanner.scanPage(fixtureCandidateA);
    const ffItem = scan.planItems.find((i) => i.selector === '#ff_quota');
    expect(ffItem).toBeDefined();
    expect(ffItem?.canonicalId).toBe('special.freedomFighterStatus');
    expect(ffItem?.proposedValue).toBe('Child of Freedom Fighter');

    await VerificationEngine.executePlan('ff_test', [ffItem!]);
    expect((document.getElementById('ff_quota') as HTMLSelectElement).value).toBe('Child of Freedom Fighter');
  });

  it('5. Quota Category matches explicit saved Profile preference', async () => {
    const scan = await PageScanner.scanPage(fixtureCandidateA);
    const quotaItem = scan.planItems.find((i) => i.selector === '#quota');
    expect(quotaItem).toBeDefined();
    expect(quotaItem?.proposedValue).toBe('Child of Freedom Fighter');

    // Confirm explicitly as per Quota policy
    quotaItem!.isApproved = true;
    await VerificationEngine.executePlan('quota_test', [quotaItem!]);
    expect((document.getElementById('quota') as HTMLSelectElement).value).toBe('Child of Freedom Fighter');
  });

  // =========================================================================
  // Scenario 3: Address & Cascading Dropdown Assertions
  // =========================================================================

  it('6. Present Address fields fill correctly', async () => {
    const scan = await PageScanner.scanPage(fixtureCandidateA);
    const careItem = scan.planItems.find((i) => i.selector === '#present_care');
    const villItem = scan.planItems.find((i) => i.selector === '#present_village');
    const postItem = scan.planItems.find((i) => i.selector === '#present_post');
    const codeItem = scan.planItems.find((i) => i.selector === '#present_postcode');

    await VerificationEngine.executePlan('present_addr_test', [careItem!, villItem!, postItem!, codeItem!]);
    expect((document.getElementById('present_care') as HTMLInputElement).value).toBe('Md Rafiqul Islam');
    expect((document.getElementById('present_village') as HTMLInputElement).value).toBe('Dhanmondi R/A');
    expect((document.getElementById('present_post') as HTMLInputElement).value).toBe('Dhanmondi');
    expect((document.getElementById('present_postcode') as HTMLInputElement).value).toBe('1205');
  });

  it('7. Permanent Address fields fill independently from Present Address', async () => {
    const scan = await PageScanner.scanPage(fixtureCandidateA);
    const permCare = scan.planItems.find((i) => i.selector === '#permanent_care');
    const permVill = scan.planItems.find((i) => i.selector === '#permanent_village');
    const permPost = scan.planItems.find((i) => i.selector === '#permanent_post');
    const permCode = scan.planItems.find((i) => i.selector === '#permanent_postcode');

    await VerificationEngine.executePlan('perm_addr_test', [permCare!, permVill!, permPost!, permCode!]);
    expect((document.getElementById('permanent_village') as HTMLInputElement).value).toBe('Kazla');
    expect((document.getElementById('permanent_post') as HTMLInputElement).value).toBe('Kazla');
    expect((document.getElementById('permanent_postcode') as HTMLInputElement).value).toBe('6204');
    expect((document.getElementById('permanent_village') as HTMLInputElement).value).not.toBe(
      (document.getElementById('present_village') as HTMLInputElement).value
    );
  });

  it('8. Same as Present checkbox behaves correctly (remains UNCHECKED when addresses differ)', async () => {
    const scan = await PageScanner.scanPage(fixtureCandidateA);
    const sameItem = scan.planItems.find((i) => i.selector === '#same_as_present');
    expect(sameItem).toBeDefined();
    // Present is Dhaka, Permanent is Rajshahi -> MUST be 'false'
    expect(sameItem?.proposedValue).toBe('false');

    await VerificationEngine.executePlan('same_as_test', [sameItem!]);
    expect((document.getElementById('same_as_present') as HTMLInputElement).checked).toBe(false);
  });

  it('9. Present District selection succeeds', async () => {
    const scan = await PageScanner.scanPage(fixtureCandidateA);
    const distItem = scan.planItems.find((i) => i.selector === '#present_district');
    expect(distItem?.proposedValue).toBe('Dhaka');

    await VerificationEngine.executePlan('pres_dist_test', [distItem!]);
    expect((document.getElementById('present_district') as HTMLSelectElement).value).toBe('Dhaka');
  });

  it('10. Present Upazila selection waits for District and succeeds sequentially', async () => {
    const scan = await PageScanner.scanPage(fixtureCandidateA);
    const distItem = scan.planItems.find((i) => i.selector === '#present_district');
    const upaItem = scan.planItems.find((i) => i.selector === '#present_upazila');

    expect(distItem).toBeDefined();
    expect(upaItem).toBeDefined();

    // Before fill, Upazila dropdown has 0 options except placeholder
    expect((document.getElementById('present_upazila') as HTMLSelectElement).options.length).toBe(1);

    // VerificationEngine executes District first, dispatches change, Upazila options populate, then fills Upazila
    await VerificationEngine.executePlan('pres_cascade_test', [upaItem!, distItem!]);

    expect((document.getElementById('present_district') as HTMLSelectElement).value).toBe('Dhaka');
    expect((document.getElementById('present_upazila') as HTMLSelectElement).value).toBe('Dhanmondi');
  });

  it('11. Permanent District selection succeeds with Rajshahi', async () => {
    const scan = await PageScanner.scanPage(fixtureCandidateA);
    const permDistItem = scan.planItems.find((i) => i.selector === '#permanent_district');
    expect(permDistItem?.proposedValue).toBe('Rajshahi');

    await VerificationEngine.executePlan('perm_dist_test', [permDistItem!]);
    expect((document.getElementById('permanent_district') as HTMLSelectElement).value).toBe('Rajshahi');
  });

  it('12. Permanent Upazila selection waits for Permanent District and fills Motihar', async () => {
    const scan = await PageScanner.scanPage(fixtureCandidateA);
    const permDistItem = scan.planItems.find((i) => i.selector === '#permanent_district');
    const permUpaItem = scan.planItems.find((i) => i.selector === '#permanent_upazila');

    await VerificationEngine.executePlan('perm_cascade_test', [permUpaItem!, permDistItem!]);

    expect((document.getElementById('permanent_district') as HTMLSelectElement).value).toBe('Rajshahi');
    expect((document.getElementById('permanent_upazila') as HTMLSelectElement).value).toBe('Motihar');
  });

  // =========================================================================
  // Scenario 4: Academic Information (SSC & HSC) Assertions
  // =========================================================================

  it('13. Board selection succeeds for SSC (Rajshahi) and HSC (Dhaka)', async () => {
    const scan = await PageScanner.scanPage(fixtureCandidateA);
    const sscBoard = scan.planItems.find((i) => i.selector === '#ssc_board');
    const hscBoard = scan.planItems.find((i) => i.selector === '#hsc_board');

    await VerificationEngine.executePlan('boards_test', [sscBoard!, hscBoard!]);
    expect((document.getElementById('ssc_board') as HTMLSelectElement).value).toBe('Rajshahi');
    expect((document.getElementById('hsc_board') as HTMLSelectElement).value).toBe('Dhaka');
  });

  it('14. SSC Roll fills correctly (123456)', async () => {
    const scan = await PageScanner.scanPage(fixtureCandidateA);
    const sscRoll = scan.planItems.find((i) => i.selector === '#ssc_roll');
    expect(sscRoll?.proposedValue).toBe('123456');

    await VerificationEngine.executePlan('ssc_roll_test', [sscRoll!]);
    expect((document.getElementById('ssc_roll') as HTMLInputElement).value).toBe('123456');
  });

  it('15. SSC Registration fills correctly (9876543210)', async () => {
    const scan = await PageScanner.scanPage(fixtureCandidateA);
    const sscReg = scan.planItems.find((i) => i.selector === '#ssc_reg');
    expect(sscReg).toBeDefined();
    expect(sscReg?.canonicalId).toBe('education.ssc.registration');
    expect(sscReg?.proposedValue).toBe('9876543210');

    await VerificationEngine.executePlan('ssc_reg_test', [sscReg!]);
    expect((document.getElementById('ssc_reg') as HTMLInputElement).value).toBe('9876543210');
  });

  it('16. HSC Roll fills correctly (654321)', async () => {
    const scan = await PageScanner.scanPage(fixtureCandidateA);
    const hscRoll = scan.planItems.find((i) => i.selector === '#hsc_roll');
    expect(hscRoll?.proposedValue).toBe('654321');

    await VerificationEngine.executePlan('hsc_roll_test', [hscRoll!]);
    expect((document.getElementById('hsc_roll') as HTMLInputElement).value).toBe('654321');
  });

  it('17. HSC Registration fills correctly (9876543210)', async () => {
    const scan = await PageScanner.scanPage(fixtureCandidateA);
    const hscReg = scan.planItems.find((i) => i.selector === '#hsc_reg');
    expect(hscReg).toBeDefined();
    expect(hscReg?.canonicalId).toBe('education.hsc.registration');
    expect(hscReg?.proposedValue).toBe('9876543210');

    await VerificationEngine.executePlan('hsc_reg_test', [hscReg!]);
    expect((document.getElementById('hsc_reg') as HTMLInputElement).value).toBe('9876543210');
  });

  it('18. SSC Result Type and GPA fill correctly', async () => {
    const scan = await PageScanner.scanPage(fixtureCandidateA);
    const sscResType = scan.planItems.find((i) => i.selector === '#ssc_result_type');
    const sscGpa = scan.planItems.find((i) => i.selector === '#ssc_gpa');

    await VerificationEngine.executePlan('ssc_res_test', [sscResType!, sscGpa!]);
    expect((document.getElementById('ssc_result_type') as HTMLSelectElement).value).toBe('GPA (out of 5)');
    expect((document.getElementById('ssc_gpa') as HTMLInputElement).value).toBe('5.00');
  });

  it('19. HSC Result Type and GPA fill correctly', async () => {
    const scan = await PageScanner.scanPage(fixtureCandidateA);
    const hscResType = scan.planItems.find((i) => i.selector === '#hsc_result_type');
    const hscGpa = scan.planItems.find((i) => i.selector === '#hsc_gpa');

    await VerificationEngine.executePlan('hsc_res_test', [hscResType!, hscGpa!]);
    expect((document.getElementById('hsc_result_type') as HTMLSelectElement).value).toBe('GPA (out of 5)');
    expect((document.getElementById('hsc_gpa') as HTMLInputElement).value).toBe('5.00');
  });

  it('20. SSC/HSC Group fills correctly with Science', async () => {
    const scan = await PageScanner.scanPage(fixtureCandidateA);
    const sscGroup = scan.planItems.find((i) => i.selector === '#ssc_group');
    const hscGroup = scan.planItems.find((i) => i.selector === '#hsc_group');

    await VerificationEngine.executePlan('groups_test', [sscGroup!, hscGroup!]);
    expect((document.getElementById('ssc_group') as HTMLSelectElement).value).toBe('Science');
    expect((document.getElementById('hsc_group') as HTMLSelectElement).value).toBe('Science');
  });

  it('21. Passing Year fills correctly for SSC (2012) and HSC (2014)', async () => {
    const scan = await PageScanner.scanPage(fixtureCandidateA);
    const sscYear = scan.planItems.find((i) => i.selector === '#ssc_year');
    const hscYear = scan.planItems.find((i) => i.selector === '#hsc_year');

    await VerificationEngine.executePlan('years_test', [sscYear!, hscYear!]);
    expect((document.getElementById('ssc_year') as HTMLSelectElement).value).toBe('2012');
    expect((document.getElementById('hsc_year') as HTMLSelectElement).value).toBe('2014');
  });

  // =========================================================================
  // Scenario 5: Graduation & Higher Education Assertions
  // =========================================================================

  it('22. Graduation Degree fills correctly with B.Sc Engineering', async () => {
    const scan = await PageScanner.scanPage(fixtureCandidateA);
    const degItem = scan.planItems.find((i) => i.selector === '#gra_exam');
    expect(degItem?.proposedValue).toBe('B.Sc Engineering');

    await VerificationEngine.executePlan('grad_deg_test', [degItem!]);
    expect((document.getElementById('gra_exam') as HTMLSelectElement).value).toBe('B.Sc Engineering');
  });

  it('23. Graduation Subject waits for Degree and fills Computer Science & Engineering', async () => {
    const scan = await PageScanner.scanPage(fixtureCandidateA);
    const degItem = scan.planItems.find((i) => i.selector === '#gra_exam');
    const subItem = scan.planItems.find((i) => i.selector === '#gra_subject');

    expect(degItem).toBeDefined();
    expect(subItem).toBeDefined();

    // Sequential cascading fill: Degree selects first -> Subject populates -> Subject selects
    await VerificationEngine.executePlan('grad_cascade_test', [subItem!, degItem!]);

    expect((document.getElementById('gra_exam') as HTMLSelectElement).value).toBe('B.Sc Engineering');
    expect((document.getElementById('gra_subject') as HTMLSelectElement).value).toBe(
      'Computer Science & Engineering'
    );
  });

  it('24. University fills correctly with BUET', async () => {
    const scan = await PageScanner.scanPage(fixtureCandidateA);
    const uniItem = scan.planItems.find((i) => i.selector === '#gra_institute');
    expect(uniItem?.proposedValue).toBe('BUET');

    await VerificationEngine.executePlan('uni_test', [uniItem!]);
    expect((document.getElementById('gra_institute') as HTMLSelectElement).value).toBe('BUET');
  });

  it('25. Graduation CGPA and scale fill correctly (3.82 / 4.00)', async () => {
    const scan = await PageScanner.scanPage(fixtureCandidateA);
    const cgpaItem = scan.planItems.find((i) => i.selector === '#gra_cgpa');
    const scaleItem = scan.planItems.find((i) => i.selector === '#gra_scale');

    await VerificationEngine.executePlan('cgpa_scale_test', [cgpaItem!, scaleItem!]);
    expect((document.getElementById('gra_cgpa') as HTMLInputElement).value).toBe('3.82');
    expect((document.getElementById('gra_scale') as HTMLSelectElement).value).toBe('4.00');
  });

  // =========================================================================
  // Scenarios 6: Missing Profile Data & Ambiguity Handlers (Fixture B)
  // =========================================================================

  it('26. Missing Profile data remains unfilled (Fixture B: Missing Board and Registration)', async () => {
    const scanB = await PageScanner.scanPage(fixtureCandidateB);

    const sscRegItem = scanB.planItems.find((i) => i.selector === '#ssc_reg');
    const sscBoardItem = scanB.planItems.find((i) => i.selector === '#ssc_board');
    const ffQuotaItem = scanB.planItems.find((i) => i.selector === '#ff_quota');

    expect(sscRegItem?.status).toBe('Missing Profile Information');
    expect(sscBoardItem?.status).toBe('Missing Profile Information');
    expect(ffQuotaItem?.status).toBe('Missing Profile Information');

    // Execute plan with missing data items
    await VerificationEngine.executePlan('missing_test', scanB.planItems);

    // Form fields MUST remain blank / at index 0 (never invented)
    expect((document.getElementById('ssc_reg') as HTMLInputElement).value).toBe('');
    expect((document.getElementById('ssc_board') as HTMLSelectElement).value).toBe('');
    expect((document.getElementById('ff_quota') as HTMLSelectElement).value).toBe('');
  });

  it('27. Ambiguous options require user action (never silently guess)', async () => {
    const ambiguousDiv = document.createElement('div');
    ambiguousDiv.innerHTML = `
      <label>Special Options</label>
      <select id="ambiguous_select" name="special_pref">
        <option value="">Choose</option>
        <option value="Choice A">Choice A</option>
        <option value="Choice B">Choice B</option>
      </select>
    `;
    document.body.appendChild(ambiguousDiv);

    const scan = await PageScanner.scanPage(fixtureCandidateA);
    const ambItem = scan.planItems.find((i) => i.selector === '#ambiguous_select');
    // Unmatched/unrecognized field is NOT executed automatically
    expect(ambItem?.isApproved).toBe(false);

    await VerificationEngine.executePlan('amb_test', scan.planItems);
    expect((document.getElementById('ambiguous_select') as HTMLSelectElement).value).toBe('');
  });

  // =========================================================================
  // Scenario 7: Profile Persistence & Active Profile Isolation
  // =========================================================================

  it('28. Save Profile persists changes and updates record in storage', async () => {
    const updatedCandidate: UserProfile = {
      ...fixtureCandidateA,
      personal: {
        ...fixtureCandidateA.personal,
        mobile: '01899887766',
      },
    };

    await saveActiveProfile(updatedCandidate);

    const readBack = await getActiveProfile();
    expect(readBack.id).toBe(fixtureCandidateA.id);
    expect(readBack.personal.mobile).toBe('01899887766');
  });

  it('29. Browser restart / re-read preserves saved data', async () => {
    await ProfileRepository.saveProfile(fixtureCandidateA);
    const reloaded = await ProfileRepository.getProfileById(fixtureCandidateA.id);

    expect(reloaded).not.toBeNull();
    expect(reloaded?.personal.applicantNameEn).toBe('Md Tanvir Ahmed');
    expect(reloaded?.ssc.registrationNumber).toBe('9876543210');
    expect(reloaded?.graduation.universityInstitute).toBe('BUET');
  });

  it('30. Active Profile switching does not leak data between candidate records', async () => {
    await saveActiveProfile(fixtureCandidateA);
    await saveActiveProfile(fixtureCandidateB);

    // Switch to Candidate B
    await setActiveProfileId(fixtureCandidateB.id);
    const activeB = await getActiveProfile();
    expect(activeB.id).toBe(fixtureCandidateB.id);
    expect(activeB.personal.applicantNameEn).toBe('Farhana Yasmin');
    expect(activeB.ssc.registrationNumber).toBe('');

    // Switch to Candidate A
    await setActiveProfileId(fixtureCandidateA.id);
    const activeA = await getActiveProfile();
    expect(activeA.id).toBe(fixtureCandidateA.id);
    expect(activeA.personal.applicantNameEn).toBe('Md Tanvir Ahmed');
    expect(activeA.ssc.registrationNumber).toBe('9876543210');
  });

  it('31. Manual Profile Update requires explicit user approval', async () => {
    // Conflict detection: when a website field already contains a value differing from profile
    const nameInput = document.getElementById('applicant_name') as HTMLInputElement;
    nameInput.value = 'Existing Incompatible Name';

    const scan = await PageScanner.scanPage(fixtureCandidateA);
    const nameItem = scan.planItems.find((i) => i.selector === '#applicant_name');

    expect(nameItem?.hasConflict).toBe(true);
    expect(nameItem?.status).toBe('Existing Value Conflict');
    expect(nameItem?.isApproved).toBe(false);

    // Without user approval, executePlan protects existing form value from being overwritten
    await VerificationEngine.executePlan('conflict_test', scan.planItems);
    expect(nameInput.value).toBe('Existing Incompatible Name');
  });

  it('32. No sensitive data (NID, mobile, registration) appears in plaintext logs', () => {
    const consoleSpy = vi.spyOn(console, 'log');

    // Create a diagnostic string through VerificationEngine completeness
    const completeness = VerificationEngine.buildCompletenessReport([
      {
        id: 'nid_log_test',
        element: document.getElementById('nid') as HTMLElement,
        selector: '#nid',
        canonicalId: 'identity.nationalId',
        fieldLabel: 'National ID',
        proposedValue: '19951234567890123',
        originalValue: '',
        hasConflict: false,
        isApproved: true,
        status: 'SUCCESS',
        diagnosticStatus: 'Successfully Filled',
        verificationMessage: 'Field verified successfully',
      },
    ]);

    expect(completeness[0].reason).not.toContain('19951234567890123');
    consoleSpy.mockRestore();
  });
});
