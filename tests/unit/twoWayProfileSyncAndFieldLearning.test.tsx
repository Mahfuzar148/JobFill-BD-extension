// JobFill BD - Smart Two-Way Profile Sync & Dynamic Field Learning Engine Test Suite
// Verifies:
// 1. Semantic FieldClassifier accurately maps inputs to canonical personal, family, contact, identity,
//    address, education, experience, special info, and application tracker fields.
// 2. Strict Security Invariant: Passwords, OTP, PIN, CSRF, and CAPTCHA are BLOCKED and NEVER entered into profile.
// 3. Dynamic Field Learning: Unmapped inputs with meaningful labels are classified as CustomProfileField.
// 4. Inferred data types (text, number, date, select, boolean) and categories (skills, education, etc.).
// 5. ProfileDiffEngine detects NEW vs CHANGED values with Bengali numeral normalization.
// 6. Safe Auto-Save Policy: Sensitive PII (NID, Phone, Email, DOB, Family, Address, Education) NEVER auto-saves
//    silently; requires explicit review. Only safe non-PII auto-saves when enabled.
// 7. Apply Approved Diffs: Upserts customFields in active profile and records reversible change history.
// 8. Reversible Undo: Restores canonical fields to previous values and deletes newly added custom fields on undo.
// 9. REUSABILITY LOOP (Profile -> Form -> Form Edit -> Learned & Saved -> Future Autofill):
//    Once a custom field is saved into profile.customFields, subsequent forms scanned by PageScanner
//    successfully match and propose the learned value for autofill!
// 10. Profile Update Dialog UI: Floating pill, categorized tabs, inline editing, and exclusion checkboxes.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FieldClassifier } from '../../src/intelligence/field-classifier';
import { ProfileDiffEngine, DetectedProfileDiffItem } from '../../src/services/profile-diff-engine';
import {
  applyCanonicalProfileFieldUpdate,
  getAutoSaveSafeFieldsSetting,
  setAutoSaveSafeFieldsSetting,
} from '../../src/services/storage';
import { PageScanner, toCanonicalProfile } from '../../src/content/page-scanner';
import { resolveCanonicalValue } from '../../src/shared/types/canonical-schema';
import { sampleDemoProfile, createEmptyProfile } from '../../src/types/defaults';
import { UserProfile, CustomProfileField } from '../../src/types/profile';
import {
  showProfileUpdatePill,
  removeProfileUpdatePill,
  showProfileUpdateReviewModal,
} from '../../src/content/profile-update-dialog';

describe('JobFill BD - Smart Two-Way Profile Sync & Dynamic Field Learning Engine Suite', () => {
  let profile: UserProfile;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    document.body.innerHTML = '';
    await ProfileDiffEngine.clearChangeHistory();
    await setAutoSaveSafeFieldsSetting(false);
    profile = JSON.parse(JSON.stringify(sampleDemoProfile));
    profile.customFields = [];
  });

  afterEach(async () => {
    await ProfileDiffEngine.clearChangeHistory();
    document.body.innerHTML = '';
  });

  // =========================================================================
  // PART 1: SEMANTIC FIELD CLASSIFIER & SECURITY INVARIANTS
  // =========================================================================
  describe('Part 1: Semantic Field Classifier & Security Invariants', () => {
    it('1. Classifies canonical personal demographic fields accurately', () => {
      const nameInput = document.createElement('input');
      nameInput.name = 'applicant_name';
      nameInput.value = 'Rahim Uddin';
      const cName = FieldClassifier.classifyElement(nameInput);
      expect(cName.isSupported).toBe(true);
      expect(cName.canonicalKey).toBe('applicant.fullName.english');
      expect(cName.destination).toBe('personal');
      expect(cName.isSensitive).toBe(true);

      const dobInput = document.createElement('input');
      dobInput.type = 'date';
      dobInput.name = 'dob';
      dobInput.value = '1996-05-12';
      const cDob = FieldClassifier.classifyElement(dobInput);
      expect(cDob.canonicalKey).toBe('applicant.dateOfBirth');
      expect(cDob.dataType).toBe('date');
      expect(cDob.isSensitive).toBe(true);

      const natSelect = document.createElement('select');
      natSelect.name = 'nationality';
      const cNat = FieldClassifier.classifyElement(natSelect);
      expect(cNat.canonicalKey).toBe('applicant.nationality');
      expect(cNat.destination).toBe('personal');
    });

    it('2. Classifies family fields (Father, Mother, Spouse) with distinct destination', () => {
      const fatherInput = document.createElement('input');
      fatherInput.name = 'father_name_en';
      fatherInput.value = 'Late Abdul Karim';
      const cFather = FieldClassifier.classifyElement(fatherInput);
      expect(cFather.canonicalKey).toBe('family.father.name.english');
      expect(cFather.destination).toBe('family');
      expect(cFather.isSensitive).toBe(true);

      const motherInput = document.createElement('input');
      motherInput.name = 'mother_name_bn';
      motherInput.value = 'আমেনা বেগম';
      const cMother = FieldClassifier.classifyElement(motherInput);
      expect(cMother.canonicalKey).toBe('family.mother.name.bangla');
      expect(cMother.destination).toBe('family');

      const spouseInput = document.createElement('input');
      spouseInput.name = 'spouse_name';
      spouseInput.value = 'Fatema Akter';
      const cSpouse = FieldClassifier.classifyElement(spouseInput);
      expect(cSpouse.canonicalKey).toBe('family.spouse.name.english');
      expect(cSpouse.destination).toBe('family');
    });

    it('3. Classifies contact and identity fields with strict sensitivity tagging', () => {
      const mobileInput = document.createElement('input');
      mobileInput.name = 'mobile_number';
      mobileInput.value = '01811223344';
      const cMob = FieldClassifier.classifyElement(mobileInput);
      expect(cMob.canonicalKey).toBe('contact.mobile');
      expect(cMob.isSensitive).toBe(true);

      const nidInput = document.createElement('input');
      nidInput.name = 'national_id_no';
      nidInput.value = '19951234567890123';
      const cNid = FieldClassifier.classifyElement(nidInput);
      expect(cNid.canonicalKey).toBe('identity.nationalId');
      expect(cNid.isSensitive).toBe(true);

      const brnInput = document.createElement('input');
      brnInput.name = 'birth_registration_number';
      brnInput.value = '1995123456789012345';
      const cBrn = FieldClassifier.classifyElement(brnInput);
      expect(cBrn.canonicalKey).toBe('identity.birthRegistration');
      expect(cBrn.isSensitive).toBe(true);
    });

    it('4. Classifies Present vs Permanent Address fields based on input name and context', () => {
      const presDist = document.createElement('select');
      presDist.name = 'present_district';
      const cPresDist = FieldClassifier.classifyElement(presDist);
      expect(cPresDist.canonicalKey).toBe('address.present.district');
      expect(cPresDist.destination).toBe('address');

      const permDist = document.createElement('select');
      permDist.name = 'permanent_district';
      const cPermDist = FieldClassifier.classifyElement(permDist);
      expect(cPermDist.canonicalKey).toBe('address.permanent.district');
      expect(cPermDist.destination).toBe('address');

      const permPostCode = document.createElement('input');
      permPostCode.name = 'perm_postcode';
      const cPost = FieldClassifier.classifyElement(permPostCode);
      expect(cPost.canonicalKey).toBe('address.permanent.postCode');
      expect(cPost.destination).toBe('address');
    });

    it('5. Classifies Education records across SSC, HSC, Graduation, and Masters tiers', () => {
      const sscGpa = document.createElement('input');
      sscGpa.name = 'ssc_result_gpa';
      const cSsc = FieldClassifier.classifyElement(sscGpa);
      expect(cSsc.canonicalKey).toBe('education.ssc.gpa');
      expect(cSsc.destination).toBe('education');

      const hscBoard = document.createElement('select');
      hscBoard.name = 'hsc_board';
      const cHsc = FieldClassifier.classifyElement(hscBoard);
      expect(cHsc.canonicalKey).toBe('education.hsc.board');
      expect(cHsc.destination).toBe('education');

      const gradSubject = document.createElement('input');
      gradSubject.name = 'graduation_discipline_subject';
      const cGrad = FieldClassifier.classifyElement(gradSubject);
      expect(cGrad.canonicalKey).toBe('education.graduation.subject');
      expect(cGrad.destination).toBe('education');

      const mastersInst = document.createElement('input');
      mastersInst.name = 'masters_university_institute';
      const cMasters = FieldClassifier.classifyElement(mastersInst);
      expect(cMasters.canonicalKey).toBe('education.masters.institution');
      expect(cMasters.destination).toBe('education');
    });

    it('6. Classifies Experience records (organization, designation, start/end dates)', () => {
      const orgInput = document.createElement('input');
      orgInput.name = 'job_experience_company';
      const cOrg = FieldClassifier.classifyElement(orgInput);
      expect(cOrg.canonicalKey).toBe('experience.organization');
      expect(cOrg.destination).toBe('experience');

      const desigInput = document.createElement('input');
      desigInput.name = 'job_post_designation';
      const cDesig = FieldClassifier.classifyElement(desigInput);
      expect(cDesig.canonicalKey).toBe('experience.designation');
      expect(cDesig.destination).toBe('experience');
    });

    it('7. Classifies Application-Specific / Tracker identifiers (Applicant ID, Tracking No, User ID)', () => {
      const appId = document.createElement('input');
      appId.name = 'applicant_id';
      appId.value = 'APP-2026-998811';
      const cApp = FieldClassifier.classifyElement(appId);
      expect(cApp.canonicalKey).toBe('application.tracker.identifier');
      expect(cApp.destination).toBe('tracker');
      expect(cApp.destinationLabelEn).toBe('Application Tracker');

      const trackingInput = document.createElement('input');
      trackingInput.name = 'tracking_number';
      const cTrack = FieldClassifier.classifyElement(trackingInput);
      expect(cTrack.destination).toBe('tracker');
    });

    it('8. SECURITY INVARIANT: Passwords, OTP, PIN, CSRF, and CAPTCHA are marked BLOCKED and rejected from profile', () => {
      const passInput = document.createElement('input');
      passInput.type = 'password';
      passInput.name = 'user_password';
      passInput.value = 'Secret@12345';
      const cPass = FieldClassifier.classifyElement(passInput);
      expect(cPass.isBlockedSecurity).toBe(true);
      expect(cPass.isSupported).toBe(false);
      expect(cPass.destination).toBe('vault');
      expect(cPass.inferredValue).toBe('[PROTECTED]');

      const otpInput = document.createElement('input');
      otpInput.name = 'sms_otp_code';
      otpInput.value = '123456';
      const cOtp = FieldClassifier.classifyElement(otpInput);
      expect(cOtp.isBlockedSecurity).toBe(true);
      expect(cOtp.isSupported).toBe(false);
      expect(cOtp.destination).toBe('ignored');

      const captchaInput = document.createElement('input');
      captchaInput.name = 'captcha_code';
      captchaInput.value = 'x8y9z';
      const cCap = FieldClassifier.classifyElement(captchaInput);
      expect(cCap.isBlockedSecurity).toBe(true);
      expect(cCap.isSupported).toBe(false);
    });

    it('9. Detects unrecognized form fields as dynamic CustomProfileField with inferred category and dataType', () => {
      const speedInput = document.createElement('input');
      speedInput.name = 'computer_typing_speed';
      speedInput.setAttribute('aria-label', 'Computer Typing Speed');
      speedInput.value = '45 WPM English, 35 WPM Bangla';
      const cSpeed = FieldClassifier.classifyElement(speedInput);

      expect(cSpeed.isSupported).toBe(true);
      expect(cSpeed.isCustomField).toBe(true);
      expect(cSpeed.canonicalKey).toBe('custom_computer_typing_speed');
      expect(cSpeed.destination).toBe('custom');
      expect(cSpeed.category).toBe('skills');
      expect(cSpeed.dataType).toBe('text');
      expect(cSpeed.fieldLabelEn).toBe('Computer Typing Speed');

      const trainingInput = document.createElement('input');
      trainingInput.name = 'specialized_training_course';
      trainingInput.value = 'Advanced GIS Mapping';
      const cTrain = FieldClassifier.classifyElement(trainingInput);
      expect(cTrain.isCustomField).toBe(true);
      expect(cTrain.category).toBe('education');
    });
  });

  // =========================================================================
  // PART 2: PROFILE DIFF ENGINE, FIELD LEARNING & SAFE AUTO-SAVE POLICY
  // =========================================================================
  describe('Part 2: Profile Diff Engine, Field Learning & Safe Auto-Save Policy', () => {
    it('10. Detects CHANGED field when user edits existing profile information', () => {
      const scanned = [
        { canonicalKey: 'contact.mobile', value: '01899001122', label: 'Mobile Number' },
      ];
      const diffs = ProfileDiffEngine.detectFormDiffs(scanned, profile);
      expect(diffs).toHaveLength(1);
      expect(diffs[0].diffType).toBe('CHANGED');
      expect(diffs[0].oldValue).toBe(profile.personal.mobile);
      expect(diffs[0].newValue).toBe('01899001122');
    });

    it('11. Detects NEW canonical field when user enters previously empty profile information', () => {
      profile.personal.nationality = ''; // Empty profile field
      const scanned = [
        { canonicalKey: 'applicant.nationality', value: 'Bangladeshi', label: 'Nationality' },
      ];
      const diffs = ProfileDiffEngine.detectFormDiffs(scanned, profile);
      expect(diffs).toHaveLength(1);
      expect(diffs[0].diffType).toBe('NEW');
      expect(diffs[0].oldValue).toBe('');
      expect(diffs[0].newValue).toBe('Bangladeshi');
    });

    it('12. Detects genuinely NEW CustomProfileField entered on form (e.g. Blood Group, Driving License)', () => {
      const scanned = [
        {
          canonicalKey: 'custom_driving_license_no',
          value: 'DL-DHAKA-2026-991',
          label: 'Driving License Number',
          isCustomField: true,
          category: 'other' as const,
          dataType: 'text' as const,
        },
      ];
      const diffs = ProfileDiffEngine.detectFormDiffs(scanned, profile);
      expect(diffs).toHaveLength(1);
      expect(diffs[0].diffType).toBe('NEW');
      expect(diffs[0].isCustomField).toBe(true);
      expect(diffs[0].destination).toBe('custom');
      expect(diffs[0].newValue).toBe('DL-DHAKA-2026-991');
    });

    it('13. Normalizes Bengali numerals without flagging false diffs', () => {
      // Set known mobile on profile to verify numeral normalization
      profile.personal.mobile = '01711223344';
      const scanned = [
        { canonicalKey: 'contact.mobile', value: '০১৭১১২২৩৩৪৪', label: 'Mobile Number' },
      ];
      const diffs = ProfileDiffEngine.detectFormDiffs(scanned, profile);
      expect(diffs).toHaveLength(0); // Identical normalized value
    });

    it('14. Ignores empty or blank form fields without creating empty diffs', () => {
      const scanned = [
        { canonicalKey: 'applicant.fullName.bangla', value: '   ', label: 'Name Bangla' },
        { canonicalKey: 'identity.passport', value: '', label: 'Passport' },
      ];
      const diffs = ProfileDiffEngine.detectFormDiffs(scanned, profile);
      expect(diffs).toHaveLength(0);
    });

    it('15. Safe Auto-Save Policy: returns false when auto-save setting is OFF', () => {
      const item: DetectedProfileDiffItem = {
        id: 'diff_1',
        canonicalKey: 'custom_hobby',
        fieldLabel: 'Hobby',
        fieldLabelBn: 'শখ',
        destination: 'custom',
        destinationLabel: 'Custom Profile Fields',
        destinationLabelBn: 'কাস্টম প্রোফাইল তথ্য',
        oldValue: '',
        newValue: 'Robotics',
        diffType: 'NEW',
        selected: true,
        isSensitive: false,
      };

      const canSaveDisabled = ProfileDiffEngine.canAutoSave(item, false);
      expect(canSaveDisabled).toBe(false);
    });

    it('16. Safe Auto-Save Policy: Sensitive PII (NID, Phone, Email, DOB, Family, Address, Education) NEVER auto-saves even if enabled', () => {
      const sensitiveKeys = [
        'contact.mobile',
        'contact.email',
        'identity.nationalId',
        'applicant.dateOfBirth',
        'family.father.name.english',
        'address.present.district',
        'education.ssc.gpa',
      ];

      sensitiveKeys.forEach((key) => {
        const item: DetectedProfileDiffItem = {
          id: `diff_${key}`,
          canonicalKey: key,
          fieldLabel: key,
          fieldLabelBn: key,
          destination: 'personal',
          destinationLabel: 'Personal',
          destinationLabelBn: 'ব্যক্তিগত',
          oldValue: '',
          newValue: '12345',
          diffType: 'NEW',
          selected: true,
          isSensitive: true,
        };
        const canAuto = ProfileDiffEngine.canAutoSave(item, true);
        expect(canAuto).toBe(false); // Strict Invariant: Sensitive PII MUST require user review!
      });
    });

    it('17. Safe Auto-Save Policy: Passwords, OTP, and Security Tokens are NEVER auto-saved or placed in profile', () => {
      const passItem: DetectedProfileDiffItem = {
        id: 'diff_pass',
        canonicalKey: 'vault.password',
        fieldLabel: 'Password',
        fieldLabelBn: 'পাসওয়ার্ড',
        destination: 'vault',
        destinationLabel: 'Vault',
        destinationLabelBn: 'ভল্ট',
        oldValue: '',
        newValue: 'P@ssword123',
        diffType: 'NEW',
        selected: true,
      };
      expect(ProfileDiffEngine.canAutoSave(passItem, true)).toBe(false);
    });

    it('18. Safe Auto-Save Policy: Safe non-sensitive custom fields CAN auto-save when enabled', () => {
      const safeItem: DetectedProfileDiffItem = {
        id: 'diff_safe',
        canonicalKey: 'custom_preferred_job_region',
        fieldLabel: 'Preferred Job Region',
        fieldLabelBn: 'পছন্দের চাকরির অঞ্চল',
        destination: 'custom',
        destinationLabel: 'Custom Profile Fields',
        destinationLabelBn: 'কাস্টম প্রোফাইল তথ্য',
        oldValue: '',
        newValue: 'Chittagong Division',
        diffType: 'NEW',
        selected: true,
        isSensitive: false,
      };
      expect(ProfileDiffEngine.canAutoSave(safeItem, true)).toBe(true);
    });
  });

  // =========================================================================
  // PART 3: STORAGE UPDASTERS, HISTORY AUDIT & REVERSIBLE UNDO
  // =========================================================================
  describe('Part 3: Storage Updaters, History Audit & Reversible Undo', () => {
    it('19. applyCanonicalProfileFieldUpdate updates canonical profile fields', () => {
      const ok = applyCanonicalProfileFieldUpdate(profile, 'contact.mobile', '01988776655');
      expect(ok).toBe(true);
      expect(profile.personal.mobile).toBe('01988776655');

      const okNat = applyCanonicalProfileFieldUpdate(profile, 'applicant.nationality', 'Bangladeshi');
      expect(okNat).toBe(true);
      expect(profile.personal.nationality).toBe('Bangladeshi');
    });

    it('20. applyCanonicalProfileFieldUpdate dynamically creates new custom profile field', () => {
      const ok = applyCanonicalProfileFieldUpdate(
        profile,
        'custom_blood_group',
        'AB Positive',
        {
          labelEn: 'Blood Group',
          category: 'personal',
          dataType: 'select',
          reuseInAutofill: true,
        }
      );

      expect(ok).toBe(true);
      expect(profile.customFields).toHaveLength(1);
      const cf = profile.customFields![0];
      expect(cf.fieldKey).toBe('custom_blood_group');
      expect(cf.value).toBe('AB Positive');
      expect(cf.labelEn).toBe('Blood Group');
      expect(cf.reuseInAutofill).toBe(true);
    });

    it('21. applyCanonicalProfileFieldUpdate updates existing custom profile field cleanly', () => {
      applyCanonicalProfileFieldUpdate(profile, 'custom_typing_speed', '35 WPM');
      expect(profile.customFields![0].value).toBe('35 WPM');

      applyCanonicalProfileFieldUpdate(profile, 'custom_typing_speed', '50 WPM');
      expect(profile.customFields).toHaveLength(1);
      expect(profile.customFields![0].value).toBe('50 WPM');
    });

    it('22. applyApprovedDiffs saves active profile, updates storage, and logs audit change history', async () => {
      const diffItem: DetectedProfileDiffItem = {
        id: 'diff_mob_1',
        canonicalKey: 'contact.mobile',
        fieldLabel: 'Mobile Number',
        fieldLabelBn: 'মোবাইল নম্বর',
        destination: 'personal',
        destinationLabel: 'Personal Profile',
        destinationLabelBn: 'ব্যক্তিগত তথ্য',
        oldValue: profile.personal.mobile,
        newValue: '01899112233',
        diffType: 'CHANGED',
        selected: true,
      };

      const result = await ProfileDiffEngine.applyApprovedDiffs(profile, [diffItem], 'https://alljobs.teletalk.com.bd');
      expect(result.appliedCount).toBe(1);
      expect(result.updatedProfile.personal.mobile).toBe('01899112233');

      const history = await ProfileDiffEngine.getChangeHistory();
      expect(history).toHaveLength(1);
      expect(history[0].fieldKey).toBe('contact.mobile');
      expect(history[0].previousValue).toBe(diffItem.oldValue);
      expect(history[0].newValue).toBe('01899112233');
      expect(history[0].sourceOrigin).toBe('https://alljobs.teletalk.com.bd');
    });

    it('23. Reversible Undo: Restores changed profile field back to previous value', async () => {
      const origMobile = profile.personal.mobile;
      const diffItem: DetectedProfileDiffItem = {
        id: 'diff_undo_test',
        canonicalKey: 'contact.mobile',
        fieldLabel: 'Mobile Number',
        fieldLabelBn: 'মোবাইল নম্বর',
        destination: 'personal',
        destinationLabel: 'Personal Profile',
        destinationLabelBn: 'ব্যক্তিগত তথ্য',
        oldValue: origMobile,
        newValue: '01855667788',
        diffType: 'CHANGED',
        selected: true,
      };

      const applyRes = await ProfileDiffEngine.applyApprovedDiffs(profile, [diffItem]);
      expect(applyRes.updatedProfile.personal.mobile).toBe('01855667788');

      const historyId = applyRes.historyRecords[0].id;
      const undoRes = await ProfileDiffEngine.undoChange(historyId, profile);
      expect(undoRes.reverted).toBe(true);
      expect(undoRes.updatedProfile.personal.mobile).toBe(origMobile);
    });

    it('24. Reversible Undo: Completely removes newly added custom field on undo', async () => {
      const diffItem: DetectedProfileDiffItem = {
        id: 'diff_custom_undo',
        canonicalKey: 'custom_emergency_contact',
        fieldLabel: 'Emergency Contact',
        fieldLabelBn: 'জরুরি যোগাযোগ',
        destination: 'custom',
        destinationLabel: 'Custom Profile Fields',
        destinationLabelBn: 'কাস্টম প্রোফাইল তথ্য',
        oldValue: '',
        newValue: '01911223344',
        diffType: 'NEW',
        selected: true,
        customFieldMeta: {
          fieldKey: 'custom_emergency_contact',
          labelEn: 'Emergency Contact',
          labelBn: 'জরুরি যোগাযোগ',
          value: '01911223344',
          category: 'personal',
          dataType: 'text',
          reuseInAutofill: true,
        },
      };

      const applyRes = await ProfileDiffEngine.applyApprovedDiffs(profile, [diffItem]);
      expect(applyRes.updatedProfile.customFields).toHaveLength(1);

      const historyId = applyRes.historyRecords[0].id;
      const undoRes = await ProfileDiffEngine.undoChange(historyId, profile);
      expect(undoRes.reverted).toBe(true);
      expect(undoRes.updatedProfile.customFields).toHaveLength(0); // Cleanly removed!
    });
  });

  // =========================================================================
  // PART 4: COMPLETE TWO-WAY REUSABILITY LOOP (FORM -> LEARN -> FUTURE AUTOFILL)
  // =========================================================================
  describe('Part 4: Complete Two-Way Reusability Loop (Form -> Learn -> Future Autofill)', () => {
    it('25. Form 1 -> Learn Field -> Form 2 -> PageScanner matches and proposes learned field for Autofill!', async () => {
      // 1. Initial State: Profile has no custom fields
      expect(profile.customFields).toHaveLength(0);

      // 2. User fills an unmapped field on Form 1 (e.g. Computer Typing Speed)
      const form1Input = document.createElement('input');
      form1Input.name = 'computer_typing_speed';
      form1Input.setAttribute('aria-label', 'Computer Typing Speed');
      form1Input.value = '40 WPM';

      // 3. FieldClassifier identifies it as Custom Profile Field
      const classified = FieldClassifier.classifyElement(form1Input);
      expect(classified.isCustomField).toBe(true);
      expect(classified.canonicalKey).toBe('custom_computer_typing_speed');

      // 4. ProfileDiffEngine detects NEW custom diff
      const diffs = ProfileDiffEngine.detectFormDiffs(
        [
          {
            canonicalKey: classified.canonicalKey,
            label: classified.fieldLabelEn,
            value: classified.inferredValue,
            isCustomField: true,
            destination: 'custom',
            category: classified.category,
            dataType: classified.dataType,
          },
        ],
        profile
      );
      expect(diffs).toHaveLength(1);
      expect(diffs[0].diffType).toBe('NEW');

      // 5. User reviews and approves; saved to profile
      const applyResult = await ProfileDiffEngine.applyApprovedDiffs(profile, diffs);
      profile = applyResult.updatedProfile;
      expect(profile.customFields).toHaveLength(1);
      expect(profile.customFields![0].fieldKey).toBe('custom_computer_typing_speed');
      expect(profile.customFields![0].value).toBe('40 WPM');

      // 6. FUTURE FORM SIMULATION (Form 2 on another recruitment portal)
      document.body.innerHTML = `
        <form id="future-job-form">
          <label for="c_speed">Computer Typing Speed</label>
          <input type="text" id="c_speed" name="typing_speed" value="" />
        </form>
      `;

      // 7. PageScanner scans Form 2 with updated profile containing learned field
      const scanResult = await PageScanner.scanPage(profile);

      // 8. VERIFICATION: Scanner matched the input against profile.customFields!
      const planItem = scanResult.planItems.find(
        (item) => item.canonicalId === 'custom_computer_typing_speed'
      );
      expect(planItem).toBeDefined();
      expect(planItem!.proposedValue).toBe('40 WPM');
      expect(planItem!.status).toBe('Matched');
      expect(planItem!.isApproved).toBe(true);
    });

    it('26. resolveCanonicalValue resolves dynamic custom fields and special profile fields', () => {
      profile.customFields = [
        {
          id: 'cf_1',
          fieldKey: 'custom_blood_group',
          labelEn: 'Blood Group',
          labelBn: 'রক্তের গ্রুপ',
          value: 'B+',
          category: 'personal',
          dataType: 'select',
          reuseInAutofill: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const canonical = toCanonicalProfile(profile);
      const resolved = resolveCanonicalValue(canonical, 'custom_blood_group');
      expect(resolved).toBe('B+');

      // Also dot-notation fallback
      const resolvedDot = resolveCanonicalValue(canonical, 'custom.blood_group');
      expect(resolvedDot).toBe('B+');
    });
  });

  // =========================================================================
  // PART 5: PROFILE UPDATE REVIEW DIALOG UI & USER CONTROL
  // =========================================================================
  describe('Part 5: Profile Update Review Dialog UI & User Control', () => {
    it('27. showProfileUpdatePill displays distinct counters for new vs modified fields', () => {
      const onReview = vi.fn();
      const onDismiss = vi.fn();

      showProfileUpdatePill(3, onReview, onDismiss, 'en', { newCount: 2, changeCount: 1 });

      const pill = document.getElementById('jobfill-profile-update-pill');
      expect(pill).toBeDefined();
      expect(pill!.textContent).toContain('2 new');
      expect(pill!.textContent).toContain('1 modified');

      const reviewBtn = document.getElementById('jobfill-pill-review-btn');
      reviewBtn?.click();
      expect(onReview).toHaveBeenCalledTimes(1);

      removeProfileUpdatePill();
      expect(document.getElementById('jobfill-profile-update-pill')).toBeNull();
    });

    it('28. showProfileUpdateReviewModal renders category tabs, allows inline editing and deselection', async () => {
      const onApprove = vi.fn().mockResolvedValue(undefined);
      const onDismiss = vi.fn();

      const sampleDiffs: DetectedProfileDiffItem[] = [
        {
          id: 'diff_1',
          canonicalKey: 'contact.mobile',
          fieldLabel: 'Mobile Number',
          fieldLabelBn: 'মোবাইল নম্বর',
          destination: 'personal',
          destinationLabel: 'Personal Profile',
          destinationLabelBn: 'ব্যক্তিগত তথ্য',
          oldValue: '01711223344',
          newValue: '01899112233',
          diffType: 'CHANGED',
          selected: true,
        },
        {
          id: 'diff_2',
          canonicalKey: 'custom_typing_speed',
          fieldLabel: 'Typing Speed',
          fieldLabelBn: 'টাইপিং স্পিড',
          destination: 'custom',
          destinationLabel: 'Custom Profile Fields',
          destinationLabelBn: 'কাস্টম প্রোফাইল তথ্য',
          oldValue: '',
          newValue: '40 WPM',
          diffType: 'NEW',
          selected: true,
          isCustomField: true,
        },
      ];

      showProfileUpdateReviewModal({
        diffs: sampleDiffs,
        lang: 'en',
        onApprove,
        onDismiss,
      });

      const modal = document.getElementById('jobfill-profile-update-modal');
      expect(modal).toBeDefined();

      // Check category tabs rendered
      const tabs = modal!.querySelectorAll('.jobfill-cat-tab');
      expect(tabs.length).toBeGreaterThanOrEqual(2); // All + categories

      // Check inline editing input works
      const inputEl = document.getElementById('diff-val-input-0') as HTMLInputElement;
      expect(inputEl).toBeDefined();
      inputEl.value = '01899999999';
      inputEl.dispatchEvent(new Event('input'));

      // Check deselect second item
      const chk1 = document.getElementById('diff-check-1') as HTMLInputElement;
      chk1.checked = false;
      chk1.dispatchEvent(new Event('change'));

      // Click Update Selected button
      const updateBtn = document.getElementById('jobfill-modal-update-btn') as HTMLButtonElement;
      updateBtn.click();

      expect(onApprove).toHaveBeenCalledTimes(1);
      const approvedArgs = onApprove.mock.calls[0][0];
      expect(approvedArgs).toHaveLength(1);
      expect(approvedArgs[0].canonicalKey).toBe('contact.mobile');
      expect(approvedArgs[0].newValue).toBe('01899999999'); // Edited value preserved!
    });
  });
});
