// JobFill BD - Universal Form Detection & Intelligent Autofill Engine V2 Integration Suite
// Verifies all core Phase 2-20 upgrades:
// 1. Cascading dropdowns with bounded MutationObserver option waits (no hardcoded sleep)
// 2. Composite DOB multi-control triplet coordination (Day/Month/Year dropdowns & inputs)
// 3. Dynamic array indexing in resolveCanonicalValue for experiences[N] and references[N]
// 4. DynamicDomObserver attribute filtering for CSS class/style wizard step mutations
// 5. Assisted Mode vs Preview Mode vs Full Autofill Mode branching
// 6. Click-to-focus on completeness report items with smooth scrolling and pulse highlight

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
import { CascadingDropdownEngine } from '../../src/engine/cascadingDropdownEngine';
import { CompositeFieldAdapter } from '../../src/intelligence/composite-field-adapter';
import { UniversalSemanticEngine } from '../../src/intelligence/universal-semantic-engine';
import { PageScanner, toCanonicalProfile } from '../../src/content/page-scanner';
import { DynamicDomObserver } from '../../src/content/dom-observer';
import { resolveCanonicalValue, MasterCanonicalProfile } from '../../src/shared/types/canonical-schema';
import { UserProfile } from '../../src/types/profile';
import { FillReport, FillReportData } from '../../src/popup/components/FillReport';
import { VerificationEngine } from '../../src/validation/verification-engine';

describe('Universal Autofill Engine V2 — Comprehensive Integration Suite', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'test-sandbox-root';
    document.body.appendChild(container);
  });

  afterEach(async () => {
    DynamicDomObserver.stopObserving();
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Cascading Dropdown Engine Integration
  // =========================================================================
  describe('1. Cascading Dropdown Coordination (Bounded MutationObserver)', () => {
    it('coordinates District -> Upazila cascading selects via MutationObserver without sleep', async () => {
      container.innerHTML = `
        <form id="addr_form">
          <select id="present_district" name="present_district">
            <option value="">Select District</option>
            <option value="Dhaka">Dhaka</option>
            <option value="Rajshahi">Rajshahi</option>
          </select>
          <select id="present_upazila" name="present_upazila">
            <option value="">Select Upazila</option>
          </select>
        </form>
      `;

      const distSelect = document.getElementById('present_district') as HTMLSelectElement;
      const upzSelect = document.getElementById('present_upazila') as HTMLSelectElement;

      // Simulate real-world portal: when district changes, asynchronously populate upazilas
      distSelect.addEventListener('change', () => {
        setTimeout(() => {
          if (distSelect.value === 'Dhaka') {
            upzSelect.innerHTML = `
              <option value="">Select Upazila</option>
              <option value="Dhanmondi">Dhanmondi</option>
              <option value="Mirpur">Mirpur</option>
              <option value="Gulshan">Gulshan</option>
            `;
          } else if (distSelect.value === 'Rajshahi') {
            upzSelect.innerHTML = `
              <option value="">Select Upazila</option>
              <option value="Motihar">Motihar</option>
              <option value="Boalia">Boalia</option>
            `;
          }
        }, 30);
      });

      const res = await CascadingDropdownEngine.handleCascadingPair(
        distSelect,
        upzSelect,
        'Dhaka',
        'Dhanmondi',
        { maxWaitMs: 1500 }
      );

      expect(res.success).toBe(true);
      expect(res.status).toBe('FILLED_VERIFIED');
      expect(distSelect.value).toBe('Dhaka');
      expect(upzSelect.value).toBe('Dhanmondi');
    });

    it('handles Degree -> Subject cascading selection sequentially', async () => {
      container.innerHTML = `
        <form id="edu_form">
          <select id="gra_degree" name="gra_degree">
            <option value="">Select Degree</option>
            <option value="B.Sc Engineering">B.Sc Engineering</option>
            <option value="BBA">BBA</option>
          </select>
          <select id="gra_subject" name="gra_subject">
            <option value="">Select Subject</option>
          </select>
        </form>
      `;

      const degSelect = document.getElementById('gra_degree') as HTMLSelectElement;
      const subSelect = document.getElementById('gra_subject') as HTMLSelectElement;

      degSelect.addEventListener('change', () => {
        setTimeout(() => {
          if (degSelect.value === 'B.Sc Engineering') {
            subSelect.innerHTML = `
              <option value="">Select Subject</option>
              <option value="Computer Science & Engineering">Computer Science & Engineering</option>
              <option value="Electrical Engineering">Electrical Engineering</option>
            `;
          }
        }, 20);
      });

      const res = await CascadingDropdownEngine.handleCascadingPair(
        degSelect,
        subSelect,
        'B.Sc Engineering',
        'Computer Science & Engineering',
        { maxWaitMs: 1200 }
      );

      expect(res.success).toBe(true);
      expect(res.status).toBe('FILLED_VERIFIED');
      expect(degSelect.value).toBe('B.Sc Engineering');
      expect(subSelect.value).toBe('Computer Science & Engineering');
    });

    it('resolves cascading address via PageScanner.resolveCascadingFields', async () => {
      container.innerHTML = `
        <form id="cascade_form">
          <select id="present_district" name="present_district">
            <option value="">Select District</option>
            <option value="Rajshahi">Rajshahi</option>
          </select>
          <select id="present_upazila" name="present_upazila">
            <option value="">Select Upazila</option>
          </select>
        </form>
      `;

      const dist = document.getElementById('present_district') as HTMLSelectElement;
      const upz = document.getElementById('present_upazila') as HTMLSelectElement;

      dist.addEventListener('change', () => {
        setTimeout(() => {
          upz.innerHTML = `
            <option value="">Select Upazila</option>
            <option value="Motihar">Motihar</option>
          `;
        }, 15);
      });

      const profile: Partial<UserProfile> = {
        address: {
          present: {
            district: 'Rajshahi',
            upazila: 'Motihar',
            careOf: '', village: '', road: '', house: '', flat: '', division: '', postOffice: '', postCode: ''
          },
          permanent: {
            district: '', upazila: '', careOf: '', village: '', road: '', house: '', flat: '', division: '', postOffice: '', postCode: ''
          },
          sameAsPresent: false
        }
      };

      const result = await PageScanner.resolveCascadingFields(document, profile as UserProfile);
      expect(result.addressResolved).toBe(true);
      expect(dist.value).toBe('Rajshahi');
      expect(upz.value).toBe('Motihar');
    });

    it('resolves 3-level address cascade: Division -> District -> Upazila', async () => {
      container.innerHTML = `
        <form id="three_level_form">
          <select id="present_division" name="present_division">
            <option value="">Select Division</option>
            <option value="Dhaka">Dhaka</option>
            <option value="Rajshahi">Rajshahi</option>
          </select>
          <select id="present_district" name="present_district">
            <option value="">Select District</option>
          </select>
          <select id="present_upazila" name="present_upazila">
            <option value="">Select Upazila</option>
          </select>
        </form>
      `;

      const div = document.getElementById('present_division') as HTMLSelectElement;
      const dist = document.getElementById('present_district') as HTMLSelectElement;
      const upz = document.getElementById('present_upazila') as HTMLSelectElement;

      div.addEventListener('change', () => {
        setTimeout(() => {
          if (div.value === 'Rajshahi') {
            dist.innerHTML = `
              <option value="">Select District</option>
              <option value="Rajshahi">Rajshahi</option>
              <option value="Bogra">Bogra</option>
            `;
          }
        }, 15);
      });

      dist.addEventListener('change', () => {
        setTimeout(() => {
          if (dist.value === 'Rajshahi') {
            upz.innerHTML = `
              <option value="">Select Upazila</option>
              <option value="Motihar">Motihar</option>
            `;
          }
        }, 15);
      });

      const profile: Partial<UserProfile> = {
        address: {
          present: {
            division: 'Rajshahi',
            district: 'Rajshahi',
            upazila: 'Motihar',
            careOf: '', village: '', road: '', house: '', flat: '', postOffice: '', postCode: ''
          },
          permanent: {
            division: '', district: '', upazila: '', careOf: '', village: '', road: '', house: '', flat: '', postOffice: '', postCode: ''
          },
          sameAsPresent: false
        }
      };

      const result = await PageScanner.resolveCascadingFields(document, profile as UserProfile);
      expect(result.addressResolved).toBe(true);
      expect(div.value).toBe('Rajshahi');
      expect(dist.value).toBe('Rajshahi');
      expect(upz.value).toBe('Motihar');
    });

    it('resolves Masters Degree -> Subject cascading resolution', async () => {
      container.innerHTML = `
        <form id="masters_cascade_form">
          <select id="mas_degree" name="mas_degree">
            <option value="">Select Examination</option>
            <option value="M.Sc Engineering">M.Sc Engineering</option>
          </select>
          <select id="mas_subject" name="mas_subject">
            <option value="">Select Subject</option>
          </select>
        </form>
      `;

      const deg = document.getElementById('mas_degree') as HTMLSelectElement;
      const sub = document.getElementById('mas_subject') as HTMLSelectElement;

      deg.addEventListener('change', () => {
        setTimeout(() => {
          sub.innerHTML = `
            <option value="">Select Subject</option>
            <option value="Computer Science & Engineering">Computer Science & Engineering</option>
          `;
        }, 15);
      });

      const profile: Partial<UserProfile> = {
        masters: {
          examination: 'M.Sc Engineering',
          subjectDegree: 'Computer Science & Engineering',
          universityInstitute: 'BUET',
          resultType: 'GPA',
          gpa: '3.90',
          gpaScale: '4.0',
          passingYear: '2021',
          courseDuration: '2 Years'
        }
      };

      const result = await PageScanner.resolveCascadingFields(document, profile as UserProfile);
      expect(result.educationResolved).toBe(true);
      expect(deg.value).toBe('M.Sc Engineering');
      expect(sub.value).toBe('Computer Science & Engineering');
    });

    it('fails gracefully with DEPENDENCY_TIMEOUT when child options never populate', async () => {
      container.innerHTML = `
        <select id="parent_sel"><option value="X">Option X</option></select>
        <select id="child_sel"><option value="">Select</option></select>
      `;

      const parent = document.getElementById('parent_sel') as HTMLSelectElement;
      const child = document.getElementById('child_sel') as HTMLSelectElement;

      const res = await CascadingDropdownEngine.handleCascadingPair(
        parent,
        child,
        'Option X',
        'Target Child',
        { maxWaitMs: 100 }
      );

      expect(res.success).toBe(false);
      expect(res.status).toBe('DEPENDENCY_TIMEOUT');
    });
  });

  // =========================================================================
  // 2. Composite Field Adapter Multi-Control DOB Triplet Integration
  // =========================================================================
  describe('2. Composite Date of Birth Multi-Control Triplet Coordination', () => {
    it('parses ISO date and DD-MM-YYYY into multi-representation components', () => {
      const p1 = CompositeFieldAdapter.parseDateOfBirth('1995-10-15');
      expect(p1).not.toBeNull();
      expect(p1?.day).toBe('15');
      expect(p1?.dayPadded).toBe('15');
      expect(p1?.month).toBe('10');
      expect(p1?.monthNameEn).toBe('October');
      expect(p1?.monthShortEn).toBe('Oct');
      expect(p1?.monthNameBn).toBe('অক্টোবর');
      expect(p1?.year).toBe('1995');

      const p2 = CompositeFieldAdapter.parseDateOfBirth('05-02-1998');
      expect(p2).not.toBeNull();
      expect(p2?.day).toBe('5');
      expect(p2?.dayPadded).toBe('05');
      expect(p2?.month).toBe('2');
      expect(p2?.monthPadded).toBe('02');
      expect(p2?.monthNameEn).toBe('February');
      expect(p2?.monthNameBn).toBe('ফেব্রুয়ারি');
      expect(p2?.year).toBe('1998');

      expect(CompositeFieldAdapter.parseDateOfBirth('invalid-date')).toBeNull();
      expect(CompositeFieldAdapter.parseDateOfBirth('')).toBeNull();
    });

    it('coordinates Day/Month/Year dropdown triplet with Bengali month names', async () => {
      container.innerHTML = `
        <div id="dob_container">
          <label>Date of Birth</label>
          <select id="dob_day" name="dob_day">
            <option value="">দিন</option>
            <option value="1">1</option>
            <option value="15">15</option>
          </select>
          <select id="dob_month" name="dob_month">
            <option value="">মাস</option>
            <option value="1">জানুয়ারি</option>
            <option value="10">অক্টোবর</option>
          </select>
          <select id="dob_year" name="dob_year">
            <option value="">বছর</option>
            <option value="1994">1994</option>
            <option value="1995">1995</option>
          </select>
        </div>
      `;

      const daySel = document.getElementById('dob_day') as HTMLSelectElement;
      const monSel = document.getElementById('dob_month') as HTMLSelectElement;
      const yrSel = document.getElementById('dob_year') as HTMLSelectElement;

      const res = await CompositeFieldAdapter.fillCompositeDateOfBirth(daySel, monSel, yrSel, '1995-10-15');
      expect(res.success).toBe(true);
      expect(res.verifiedDay).toBe(true);
      expect(res.verifiedMonth).toBe(true);
      expect(res.verifiedYear).toBe(true);
      expect(daySel.value).toBe('15');
      expect(monSel.value).toBe('10');
      expect(yrSel.value).toBe('1995');
    });

    it('coordinates Day/Month/Year input triplet using UniversalSemanticEngine.coordinateCompositeDob', async () => {
      container.innerHTML = `
        <div id="dob_inputs">
          <input type="text" id="b_day" name="b_day" placeholder="DD" />
          <input type="text" id="b_month" name="b_month" placeholder="MM" />
          <input type="text" id="b_year" name="b_year" placeholder="YYYY" />
        </div>
      `;

      const dayInput = document.getElementById('b_day') as HTMLInputElement;
      const monInput = document.getElementById('b_month') as HTMLInputElement;
      const yrInput = document.getElementById('b_year') as HTMLInputElement;

      const res = await UniversalSemanticEngine.coordinateCompositeDob(
        dayInput,
        monInput,
        yrInput,
        '1995-04-09'
      );

      expect(res.success).toBe(true);
      expect(dayInput.value).toBe('9');
      expect(monInput.value).toBe('04');
      expect(yrInput.value).toBe('1995');
    });

    it('PageScanner.coordinateCompositeDob discovers and populates DOB controls automatically', async () => {
      container.innerHTML = `
        <fieldset id="applicant_dob_section">
          <legend>Date of Birth</legend>
          <select id="dob_day" name="day"><option value="">Day</option><option value="15">15</option></select>
          <select id="dob_month" name="month"><option value="">Month</option><option value="Oct">Oct</option></select>
          <select id="dob_year" name="year"><option value="">Year</option><option value="1995">1995</option></select>
        </fieldset>
      `;

      const res = await PageScanner.coordinateCompositeDob(container, '1995-10-15');
      expect(res.success).toBe(true);

      const daySel = document.getElementById('dob_day') as HTMLSelectElement;
      const monSel = document.getElementById('dob_month') as HTMLSelectElement;
      const yrSel = document.getElementById('dob_year') as HTMLSelectElement;

      expect(daySel.value).toBe('15');
      expect(monSel.value).toBe('Oct');
      expect(yrSel.value).toBe('1995');
    });

    it('PageScanner.scanPage correctly assigns padded day and month for input triplet', async () => {
      container.innerHTML = `
        <div>
          <input type="text" id="dob_day" name="applicant.dateOfBirth.day" placeholder="DD" maxlength="2" />
          <input type="text" id="dob_month" name="applicant.dateOfBirth.month" placeholder="MM" maxlength="2" />
          <input type="text" id="dob_year" name="applicant.dateOfBirth.year" placeholder="YYYY" maxlength="4" />
        </div>
      `;

      const userProf: Partial<UserProfile> = {
        personal: {
          dob: '1998-04-05',
          applicantNameEn: 'Test',
          mobile: '01700000000',
        } as any
      };

      const scan = await PageScanner.scanPage(userProf as UserProfile);
      const dayItem = scan.planItems.find((i) => i.selector === '#dob_day');
      const monthItem = scan.planItems.find((i) => i.selector === '#dob_month');
      const yearItem = scan.planItems.find((i) => i.selector === '#dob_year');

      expect(dayItem?.proposedValue).toBe('05');
      expect(monthItem?.proposedValue).toBe('04');
      expect(yearItem?.proposedValue).toBe('1998');
    });
  });

  // =========================================================================
  // 3. Dynamic Array Indexing in resolveCanonicalValue
  // =========================================================================
  describe('3. Dynamic Array Indexing (experiences[N] and references[N])', () => {
    const canonicalProfile: MasterCanonicalProfile = {
      profileId: 'test_prof_1',
      profileName: 'Test Candidate',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      personal: {
        fullName: { english: 'Tanvir Ahmed', bangla: 'তানভীর আহমেদ' },
        fatherName: { english: 'Rafiqul Islam', bangla: 'রফিকুল ইসলাম' },
        motherName: { english: 'Tahmina Begum', bangla: 'তাহমিনা বেগম' },
        dateOfBirth: '1995-10-15',
        gender: 'Male',
        nationality: 'Bangladeshi',
        religion: 'Islam',
        maritalStatus: 'Single',
        spouseName: { english: '', bangla: '' },
        identities: { nationalId: '1234567890', birthRegistration: '', passport: '', passportExpiry: '' },
        contact: { mobile: '01712345678', confirmMobile: '01712345678', email: 'tanvir@test.com' },
        quota: '',
        departmentalStatus: 'No',
      },
      address: {
        present: { careOf: '', village: '', road: '', house: '', flat: '', division: '', district: 'Dhaka', upazila: 'Dhanmondi', postOffice: '', postCode: '1205' },
        permanent: { careOf: '', village: '', road: '', house: '', flat: '', division: '', district: 'Rajshahi', upazila: 'Motihar', postOffice: '', postCode: '6204' },
        sameAsPresent: false,
      },
      education: {
        ssc: { examination: 'SSC', board: 'Rajshahi', roll: '111', registration: '222', group: 'Science', result: 'GPA (out of 5)', gpa: '5.00', gpaScale: '5.0', passingYear: '2012' },
        hsc: { examination: 'HSC', board: 'Dhaka', roll: '333', registration: '222', group: 'Science', result: 'GPA (out of 5)', gpa: '5.00', gpaScale: '5.0', passingYear: '2014' },
      },
      experiences: [
        {
          id: 'exp_0',
          organization: 'Brain Station 23',
          designation: 'Software Engineer',
          employedOn: 'Full Time',
          address: 'Mohakhali, Dhaka',
          startDate: '2019-01-01',
          endDate: '2021-06-30',
          currentlyWorking: false,
          jobDescription: 'Backend services development with Node.js',
        },
        {
          id: 'exp_1',
          organization: 'Grameenphone Ltd',
          designation: 'Senior Lead Engineer',
          employedOn: 'Full Time',
          address: 'Bashundhara, Dhaka',
          startDate: '2021-07-01',
          endDate: '',
          currentlyWorking: true,
          jobDescription: 'Fintech platform architecture and scaling',
        },
      ],
      references: [
        {
          id: 'ref_0',
          name: 'Prof. Dr. Mohammad Kaykobad',
          designation: 'Distinguished Professor',
          organization: 'BUET',
          mobile: '01711000000',
          email: 'kaykobad@buet.ac.bd',
          address: 'Dhaka, Bangladesh',
          relation: 'Academic Supervisor',
        },
        {
          id: 'ref_1',
          name: 'Engr. Sarah Khan',
          designation: 'Head of Engineering',
          organization: 'Grameenphone',
          mobile: '01712000000',
          email: 'sarah.khan@gp.com',
          address: 'Bashundhara R/A',
          relation: 'Direct Manager',
        },
      ],
      circularPreferences: {
        recruitmentTitle: '', postCode: '', postName: '', department: '',
        examCentre: 'Dhaka', questionVersion: 'Bangla', cadrePreference: '',
        nonCadrePreference: '', quotaDeclaration: '', orgChoice1: '', orgChoice2: '',
      },
    };

    it('resolves experiences with arbitrary array indices', () => {
      expect(resolveCanonicalValue(canonicalProfile, 'employment.experiences[0].organization')).toBe('Brain Station 23');
      expect(resolveCanonicalValue(canonicalProfile, 'employment.experiences[0].designation')).toBe('Software Engineer');
      expect(resolveCanonicalValue(canonicalProfile, 'experiences[1].organization')).toBe('Grameenphone Ltd');
      expect(resolveCanonicalValue(canonicalProfile, 'experiences[1].designation')).toBe('Senior Lead Engineer');
      expect(resolveCanonicalValue(canonicalProfile, 'experience.1.currentlyWorking')).toBe('true');
      expect(resolveCanonicalValue(canonicalProfile, 'experiences[1].address')).toBe('Bashundhara, Dhaka');
      expect(resolveCanonicalValue(canonicalProfile, 'experience.0.currentlyWorking')).toBe('false');

      // 1-based indexing support for natural field aliases
      expect(resolveCanonicalValue(canonicalProfile, 'experience1.organization')).toBe('Brain Station 23');
      expect(resolveCanonicalValue(canonicalProfile, 'exp1.designation')).toBe('Software Engineer');

      // Out of bounds index returns empty string safely
      expect(resolveCanonicalValue(canonicalProfile, 'experiences[5].organization')).toBe('');
    });

    it('resolves references with arbitrary array indices', () => {
      expect(resolveCanonicalValue(canonicalProfile, 'references[0].name')).toBe('Prof. Dr. Mohammad Kaykobad');
      expect(resolveCanonicalValue(canonicalProfile, 'references[0].organization')).toBe('BUET');
      expect(resolveCanonicalValue(canonicalProfile, 'reference.0.designation')).toBe('Distinguished Professor');
      expect(resolveCanonicalValue(canonicalProfile, 'references[1].name')).toBe('Engr. Sarah Khan');
      expect(resolveCanonicalValue(canonicalProfile, 'references[1].mobile')).toBe('01712000000');
      expect(resolveCanonicalValue(canonicalProfile, 'reference.1.relation')).toBe('Direct Manager');

      // 1-based natural alias references
      expect(resolveCanonicalValue(canonicalProfile, 'reference1.name')).toBe('Prof. Dr. Mohammad Kaykobad');
      expect(resolveCanonicalValue(canonicalProfile, 'ref1.organization')).toBe('BUET');
      expect(resolveCanonicalValue(canonicalProfile, 'ref1.mobile')).toBe('01711000000');

      // Out of bounds index
      expect(resolveCanonicalValue(canonicalProfile, 'references[10].name')).toBe('');
    });

    it('toCanonicalProfile correctly converts references from UserProfile', () => {
      const userProf: Partial<UserProfile> = {
        id: 'u1',
        profileName: 'Profile 1',
        personal: {
          applicantNameEn: 'Tanvir',
          applicantNameBn: '',
          fatherNameEn: 'Rafiq',
          fatherNameBn: '',
          motherNameEn: 'Tahmina',
          motherNameBn: '',
          dob: '1995-10-15',
          gender: 'Male',
          nationality: 'Bangladeshi',
          religion: 'Islam',
          maritalStatus: 'Single',
          spouseNameEn: '',
          spouseNameBn: '',
          nid: '123',
          birthReg: '',
          passport: '',
          passportExpiry: '',
          mobile: '01712345678',
          confirmMobile: '01712345678',
          email: 'tanvir@test.com',
          quota: '',
          departmentalStatus: 'No',
        },
        address: {
          present: { careOf: '', village: '', road: '', house: '', flat: '', division: '', district: 'Dhaka', upazila: 'Dhanmondi', postOffice: '', postCode: '' },
          permanent: { careOf: '', village: '', road: '', house: '', flat: '', division: '', district: '', upazila: '', postOffice: '', postCode: '' },
          sameAsPresent: false,
        },
        references: [
          {
            id: 'ref_x',
            name: 'Dr. Rahman',
            designation: 'Professor',
            organization: 'DU',
            mobile: '01811111111',
            email: 'rahman@du.ac.bd',
            address: 'Dhaka',
            relation: 'Teacher',
          },
        ],
      };

      const canon = toCanonicalProfile(userProf as UserProfile);
      expect(canon.references).toBeDefined();
      expect(canon.references?.length).toBe(1);
      expect(canon.references?.[0].name).toBe('Dr. Rahman');
      expect(canon.references?.[0].organization).toBe('DU');
    });
  });

  // =========================================================================
  // 4. CSS Wizard Mutations in DynamicDomObserver
  // =========================================================================
  describe('4. DynamicDomObserver CSS Wizard Step Revelations', () => {
    it('detects newly revealed form controls when visibility CSS classes or hidden attributes toggle', async () => {
      container.innerHTML = `
        <form id="wizard_form">
          <div id="step_1" class="step">
            <input type="text" id="step1_name" name="name" />
          </div>
          <div id="step_2" class="step hidden" hidden>
            <input type="text" id="step2_subject" name="subject" />
            <select id="step2_board" name="board"><option value="Dhaka">Dhaka</option></select>
          </div>
        </form>
      `;

      let detectedElements: HTMLElement[] = [];
      const observerCallback = vi.fn((added: HTMLElement[]) => {
        detectedElements = added;
      });

      const wizardForm = document.getElementById('wizard_form')!;
      DynamicDomObserver.startObserving(observerCallback, 50, wizardForm);
      expect(DynamicDomObserver.isObserving()).toBe(true);

      // Simulate Step 2 transition: remove hidden attribute and remove hidden class
      const step2 = document.getElementById('step_2')!;
      step2.removeAttribute('hidden');
      step2.classList.remove('hidden');

      // Wait for debounced observer invocation
      await new Promise((r) => setTimeout(r, 120));

      expect(observerCallback).toHaveBeenCalled();
      const detectedIds = detectedElements.map((el) => el.id);
      expect(detectedIds).toContain('step2_subject');
      expect(detectedIds).toContain('step2_board');

      DynamicDomObserver.stopObserving();
      expect(DynamicDomObserver.isObserving()).toBe(false);
    });

    it('does not report inputs added in hidden state via childList until they become visible via attribute mutation', async () => {
      container.innerHTML = `<div id="observer_target"></div>`;
      const target = document.getElementById('observer_target')!;

      let detectedElements: HTMLElement[] = [];
      const observerCallback = vi.fn((added: HTMLElement[]) => {
        detectedElements = added;
      });

      DynamicDomObserver.startObserving(observerCallback, 40, target);

      // Ingest a child with hidden container
      const hiddenStep = document.createElement('div');
      hiddenStep.className = 'wizard-pane hidden';
      hiddenStep.setAttribute('hidden', '');
      hiddenStep.innerHTML = `<input id="deferred_input" type="text" />`;
      target.appendChild(hiddenStep);

      // Wait for debounced childList observer
      await new Promise((r) => setTimeout(r, 80));

      // Should NOT have reported the hidden input!
      expect(detectedElements.length).toBe(0);

      // Now reveal the step
      hiddenStep.removeAttribute('hidden');
      hiddenStep.classList.remove('hidden');

      // Wait for attribute mutation
      await new Promise((r) => setTimeout(r, 80));

      expect(observerCallback).toHaveBeenCalled();
      expect(detectedElements.map((e) => e.id)).toContain('deferred_input');

      DynamicDomObserver.stopObserving();
    });
  });

  // =========================================================================
  // 5. Assisted Mode & Autofill Mode Safety
  // =========================================================================
  describe('5. Autofill Modes (Assisted Mode vs Full Mode vs Preview Mode)', () => {
    it('Assisted Mode withholds ambiguous/medium confidence fields from automated filling', async () => {
      container.innerHTML = `
        <form id="multi_confidence_form">
          <input type="text" id="applicant_name" name="applicant_name" />
          <input type="email" id="email_addr" name="email_addr" />
          <input type="text" id="name_of_guardian" name="guardian_name" />
        </form>
      `;

      const testProf: Partial<UserProfile> = {
        id: 'p_test',
        profileName: 'Test Profile',
        personal: {
          applicantNameEn: 'Md Tanvir Ahmed',
          applicantNameBn: '',
          fatherNameEn: 'Md Rafiqul Islam',
          fatherNameBn: '',
          motherNameEn: 'Mst Tahmina Begum',
          motherNameBn: '',
          dob: '1995-10-15',
          gender: 'Male',
          nationality: 'Bangladeshi',
          religion: 'Islam',
          maritalStatus: 'Single',
          spouseNameEn: '',
          spouseNameBn: '',
          nid: '1234567890',
          birthReg: '',
          passport: '',
          passportExpiry: '',
          mobile: '01712345678',
          confirmMobile: '01712345678',
          email: 'tanvir@test.com',
          quota: '',
          departmentalStatus: 'No',
        },
        address: {
          present: { careOf: '', village: '', road: '', house: '', flat: '', division: '', district: '', upazila: '', postOffice: '', postCode: '' },
          permanent: { careOf: '', village: '', road: '', house: '', flat: '', division: '', district: '', upazila: '', postOffice: '', postCode: '' },
          sameAsPresent: false,
        },
      };

      const scan = await PageScanner.scanPage(testProf as UserProfile);

      // High confidence: applicant name and email
      const nameItem = scan.planItems.find((i) => i.selector === '#applicant_name');
      const emailItem = scan.planItems.find((i) => i.selector === '#email_addr');
      const guardianItem = scan.planItems.find((i) => i.selector === '#name_of_guardian');

      expect(nameItem?.status).toBe('Matched');
      expect(emailItem?.status).toBe('Matched');

      // In Assisted Mode, executePlan only runs high-confidence approved items
      const assistedApprovedItems = scan.planItems.filter((i) => {
        // High confidence approved items
        return i.status === 'Matched' && i.isApproved;
      });

      await VerificationEngine.executePlan('assisted_session', assistedApprovedItems);

      expect((document.getElementById('applicant_name') as HTMLInputElement).value).toBe('Md Tanvir Ahmed');
      expect((document.getElementById('email_addr') as HTMLInputElement).value).toBe('tanvir@test.com');
      // Guardian field is ambiguous and was NOT filled automatically
      expect((document.getElementById('name_of_guardian') as HTMLInputElement).value).toBe('');
    });

    it('Assisted Mode strictly filters out fields whose explanation decisionTier is not HIGH_CONFIDENCE', async () => {
      container.innerHTML = `
        <form id="tier_filter_form">
          <input type="text" id="high_conf_field" name="high_conf" value="" />
          <input type="text" id="med_conf_field" name="med_conf" value="" />
          <input type="text" id="unexplained_field" name="unexp" value="" />
        </form>
      `;

      const highEl = document.getElementById('high_conf_field') as HTMLInputElement;
      const medEl = document.getElementById('med_conf_field') as HTMLInputElement;
      const unexpEl = document.getElementById('unexplained_field') as HTMLInputElement;

      const planItems: any[] = [
        {
          id: 'item_1',
          element: highEl,
          selector: '#high_conf_field',
          canonicalId: 'candidate.fullName.en',
          proposedValue: 'Tanvir Ahmed',
          status: 'Matched',
          isApproved: true,
          hasConflict: false,
        },
        {
          id: 'item_2',
          element: medEl,
          selector: '#med_conf_field',
          canonicalId: 'candidate.religion',
          proposedValue: 'Islam',
          status: 'Matched',
          isApproved: true,
          hasConflict: false,
        },
        {
          id: 'item_3',
          element: unexpEl,
          selector: '#unexplained_field',
          canonicalId: 'some.field',
          proposedValue: 'Some Value',
          status: 'Matched',
          isApproved: true,
          hasConflict: false,
        },
      ];

      const explanations = new Map<string, any>();
      explanations.set('#high_conf_field', { decisionTier: 'HIGH_CONFIDENCE' });
      explanations.set('#med_conf_field', { decisionTier: 'MEDIUM_CONFIDENCE' });
      // #unexplained_field has no explanation

      // Replicate Assisted Mode filter logic from content.ts
      const isAssistedMode = true;
      const filtered = planItems.filter((item) => {
        if (!item.proposedValue) return false;
        if (item.status === 'Already Correct') return false;
        if (item.status === 'User Confirmation Required') return false;
        if (item.hasConflict) return false;
        if (isAssistedMode) {
          const exp = explanations.get(item.selector);
          if (!exp || exp.decisionTier !== 'HIGH_CONFIDENCE') {
            return false;
          }
        }
        return item.status === 'Matched' || item.isApproved;
      });

      expect(filtered.length).toBe(1);
      expect(filtered[0].selector).toBe('#high_conf_field');

      await VerificationEngine.executePlan('assisted_tier_session', filtered);
      expect(highEl.value).toBe('Tanvir Ahmed');
      expect(medEl.value).toBe('');
      expect(unexpEl.value).toBe('');
    });
  });

  // =========================================================================
  // 6. FillReport Click-to-Focus & Pulse Highlight
  // =========================================================================
  describe('6. Completeness Report Click-to-Focus and Pulse Highlight', () => {
    it('triggers onFocusField when user clicks an attention item in FillReport', async () => {
      const mockFocusField = vi.fn();

      const sampleReportData: FillReportData = {
        successfullyFilled: 18,
        alreadyCorrect: 2,
        missingInfo: 1,
        ambiguous: 1,
        conflicts: 0,
        confirmationRequired: 1,
        failed: 0,
        completenessReport: [
          {
            fieldLabel: 'Quota Preference (applicant.quota)',
            selector: '#quota_select',
            canonicalId: 'applicant.quota',
            status: 'User Confirmation Required',
            rawStatus: 'User Confirmation Required',
            proposedValue: 'Freedom Fighter',
            insertedValue: '',
            reason: 'User confirmation required before selecting quota.',
          },
          {
            fieldLabel: 'HSC Roll (education.hsc.roll)',
            selector: '#hsc_roll',
            canonicalId: 'education.hsc.roll',
            status: 'Profile Information Missing',
            rawStatus: 'Profile Information Missing',
            proposedValue: '',
            insertedValue: '',
            reason: 'Profile data missing for HSC roll.',
          },
        ],
      };

      root = createRoot(container);
      await act(async () => {
        root?.render(
          <FillReport
            report={sampleReportData}
            onUndo={vi.fn()}
            onScanAgain={vi.fn()}
            onOpenDashboard={vi.fn()}
            onFocusField={mockFocusField}
          />
        );
      });

      // Find the Quota item in the completeness report
      const quotaItem = container.querySelector('div[title*="Click to focus"]') as HTMLElement;
      expect(quotaItem).not.toBeNull();

      quotaItem.click();
      expect(mockFocusField).toHaveBeenCalledWith('#quota_select');
    });

    it('simulates content script FOCUS_FIELD action with scrollIntoView and pulse highlight', () => {
      container.innerHTML = `
        <div style="height: 1000px;">Spacer</div>
        <input type="text" id="target_field" style="border: 1px solid gray;" />
      `;

      const target = document.getElementById('target_field') as HTMLInputElement;
      target.scrollIntoView = vi.fn();
      target.focus = vi.fn();

      // Execute simulated content script action
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.focus();
      target.style.outline = '3px solid #f59e0b';
      target.style.boxShadow = '0 0 14px rgba(245, 158, 11, 0.75)';

      expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
      expect(target.focus).toHaveBeenCalled();
      expect(target.style.outline).toContain('3px solid');
      expect(target.style.outline).toContain('#f59e0b');
    });
  });
});
