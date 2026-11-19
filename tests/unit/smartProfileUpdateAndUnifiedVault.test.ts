import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProfileDiffEngine, DetectedProfileDiffItem } from '../../src/services/profile-diff-engine';
import { CredentialVaultRepository } from '../../src/credentials/credential-repository';
import { sampleDemoProfile, createEmptyProfile } from '../../src/types/defaults';
import { UserProfile } from '../../src/types/profile';
import { MessageRouter } from '../../src/background/message-router';
import { ApplicationRepository } from '../../src/jobs/database/application-repository';

describe('JobFill BD - Smart Profile Update Engine & Unified Credential Manager Suite', () => {
  let profile: UserProfile;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await CredentialVaultRepository.resetForIsolatedUnitTest();
    await ProfileDiffEngine.clearChangeHistory();
    profile = JSON.parse(JSON.stringify(sampleDemoProfile));
  });

  afterEach(async () => {
    await CredentialVaultRepository.resetForIsolatedUnitTest();
    await ProfileDiffEngine.clearChangeHistory();
    document.body.innerHTML = '';
  });

  describe('Part 1: Smart Profile Update Engine', () => {
    it('1. Detects changed fields (e.g. mobile 017... -> 018..., address Rajshahi -> Dhaka, passing year)', () => {
      // Current profile has mobile: 01711223344, village: Dhanmondi R/A, passingYear: 2020
      const scannedInputs = [
        { canonicalKey: 'contact.mobile', value: '01899001122', label: 'Mobile Number' },
        { canonicalKey: 'address.present.village', value: 'Mirpur-10, Dhaka', label: 'Present Address' },
        { canonicalKey: 'education.ssc.passingYear', value: '2021', label: 'SSC Passing Year' },
        { canonicalKey: 'applicant.fullName.english', value: profile.personal.applicantNameEn, label: 'Full Name' }, // Unchanged
      ];

      const diffs = ProfileDiffEngine.detectFormDiffs(scannedInputs, profile);

      expect(diffs).toHaveLength(3);

      const mobileDiff = diffs.find((d) => d.canonicalKey === 'contact.mobile');
      expect(mobileDiff).toBeDefined();
      expect(mobileDiff!.diffType).toBe('CHANGED');
      expect(mobileDiff!.oldValue).toBe(profile.personal.mobile);
      expect(mobileDiff!.newValue).toBe('01899001122');
      expect(mobileDiff!.destination).toBe('personal');

      const addrDiff = diffs.find((d) => d.canonicalKey === 'address.present.village');
      expect(addrDiff).toBeDefined();
      expect(addrDiff!.diffType).toBe('CHANGED');
      expect(addrDiff!.newValue).toBe('Mirpur-10, Dhaka');
      expect(addrDiff!.destination).toBe('address');

      const sscDiff = diffs.find((d) => d.canonicalKey === 'education.ssc.passingYear');
      expect(sscDiff).toBeDefined();
      expect(sscDiff!.diffType).toBe('CHANGED');
      expect(sscDiff!.newValue).toBe('2021');
      expect(sscDiff!.destination).toBe('education');
    });

    it('2. Normalizes Bengali digits and whitespace, detecting unchanged values without triggering false updates', () => {
      // Saved profile mobile is 01711223344
      profile.personal.mobile = '01711223344';

      // User enters the SAME mobile in Bengali numerals: ০১৭১১২২৩৩৪৪
      const bengaliMobile = '০১৭১১২২৩৩৪৪';
      const comp1 = ProfileDiffEngine.compareField('contact.mobile', bengaliMobile, profile);
      expect(comp1.diffType).toBe('UNCHANGED');

      // User enters with extra whitespace and country code +8801711223344
      const formattedMobile = '  +8801711223344  ';
      const comp2 = ProfileDiffEngine.compareField('contact.mobile', formattedMobile, profile);
      expect(comp2.diffType).toBe('UNCHANGED');

      // Genuinely different mobile number in Bengali: ০১৮৯৯০০১১২২
      const newBengaliMobile = '০১৮৯৯০০১১২২';
      const comp3 = ProfileDiffEngine.compareField('contact.mobile', newBengaliMobile, profile);
      expect(comp3.diffType).toBe('CHANGED');
      expect(comp3.normalizedNewValue).toBe('01899001122');
    });

    it('3. Strictly ignores passwords, CAPTCHA, OTP, and hidden tokens from profile diffs', () => {
      const sensitiveInputs = [
        { canonicalKey: 'portal.password', value: 'Secret#123' },
        { canonicalKey: 'captcha.solution', value: '4G7X' },
        { canonicalKey: 'otp.verification_code', value: '984512' },
        { canonicalKey: 'csrf.token', value: 'abc-xyz-token' },
      ];

      const diffs = ProfileDiffEngine.detectFormDiffs(sensitiveInputs, profile);
      expect(diffs).toHaveLength(0);

      const passComp = ProfileDiffEngine.compareField('portal.password', 'Secret#123', profile);
      expect(passComp.diffType).toBe('UNSUPPORTED');
    });

    it('4. User approval gating: applies only selected diffs and persists to history with undo capability', async () => {
      const originalMobile = profile.personal.mobile;
      const originalVillage = profile.address.present.village;

      const diffItems: DetectedProfileDiffItem[] = [
        {
          id: 'diff_1',
          canonicalKey: 'contact.mobile',
          fieldLabel: 'Mobile Number',
          fieldLabelBn: 'মোবাইল নম্বর',
          destination: 'personal',
          destinationLabel: 'Personal Profile',
          destinationLabelBn: 'ব্যক্তিগত তথ্য',
          oldValue: originalMobile,
          newValue: '01899001122',
          diffType: 'CHANGED',
          selected: true,
        },
        {
          id: 'diff_2',
          canonicalKey: 'address.present.village',
          fieldLabel: 'Present Address',
          fieldLabelBn: 'বর্তমান ঠিকানা',
          destination: 'address',
          destinationLabel: 'Address Profile',
          destinationLabelBn: 'ঠিকানা তথ্য',
          oldValue: originalVillage,
          newValue: 'Sector-4, Uttara, Dhaka',
          diffType: 'CHANGED',
          selected: false, // User deselected this field!
        },
      ];

      const result = await ProfileDiffEngine.applyApprovedDiffs(profile, diffItems, 'https://alljobs.teletalk.com.bd');

      expect(result.appliedCount).toBe(1); // Only selected field applied!
      expect(result.updatedProfile.personal.mobile).toBe('01899001122');
      // Deselected address must remain unchanged!
      expect(result.updatedProfile.address.present.village).toBe(originalVillage);

      // Check change history
      const history = await ProfileDiffEngine.getChangeHistory();
      expect(history).toHaveLength(1);
      expect(history[0].fieldKey).toBe('contact.mobile');
      expect(history[0].previousValue).toBe(originalMobile);
      expect(history[0].newValue).toBe('01899001122');
      expect(history[0].userApproved).toBe(true);

      // Reversible Undo!
      const undoResult = await ProfileDiffEngine.undoChange(history[0].id, result.updatedProfile);
      expect(undoResult.reverted).toBe(true);
      expect(undoResult.updatedProfile.personal.mobile).toBe(originalMobile);
    });
  });

  describe('Part 2: Unified Job Portal Credential Manager', () => {
    it('5. Supports multiple separate accounts on the same portal origin without overwriting', async () => {
      await CredentialVaultRepository.initializeVault('Master#Vault2026', 15);

      // Account 1: BOGMC on Teletalk Alljobs
      const acc1 = await CredentialVaultRepository.saveCredential({
        portalName: 'Teletalk Alljobs (BOGMC)',
        portalUrl: 'https://alljobs.teletalk.com.bd/bogmc/login',
        organization: 'Petrobangla (BOGMC)',
        jobTitle: 'Assistant Director',
        accountType: 'Job-Specific Account',
        username: 'bogmc_user_001',
        userId: 'USER001',
        password: 'Password#BOGMC1',
      });

      // Account 2: Directorate of Registration (Sub-Registrar) on the same Teletalk Alljobs domain
      const acc2 = await CredentialVaultRepository.saveCredential({
        portalName: 'Teletalk Alljobs (Sub-Registrar)',
        portalUrl: 'https://alljobs.teletalk.com.bd/dor/login',
        organization: 'Directorate of Registration',
        jobTitle: 'Sub-Registrar',
        accountType: 'Job-Specific Account',
        username: 'sub_registrar_user_002',
        userId: 'USER002',
        password: 'Password#SubReg2',
      });

      expect(acc1.id).not.toBe(acc2.id);

      const allEntries = await CredentialVaultRepository.listDecryptedCredentials();
      expect(allEntries).toHaveLength(2);

      // Querying matching accounts for the portal origin returns BOTH accounts cleanly
      const matches = await CredentialVaultRepository.findMatchingForPageUrl('https://alljobs.teletalk.com.bd/apply');
      expect(matches).toHaveLength(2);

      const bpscMatch = matches.find((m) => m.organization === 'Petrobangla (BOGMC)');
      const dorMatch = matches.find((m) => m.organization === 'Directorate of Registration');

      expect(bpscMatch).toBeDefined();
      expect(bpscMatch!.username).toBe('bogmc_user_001');
      expect(bpscMatch!.password).toBe('Password#BOGMC1');

      expect(dorMatch).toBeDefined();
      expect(dorMatch!.username).toBe('sub_registrar_user_002');
      expect(dorMatch!.password).toBe('Password#SubReg2');
    });

    it('6. Searches credentials by Organization, Job Title, User ID, and Portal Name', async () => {
      await CredentialVaultRepository.initializeVault('Master#Vault2026', 15);

      await CredentialVaultRepository.saveCredential({
        portalName: 'BPSC Portal',
        portalUrl: 'https://bpsc.teletalk.com.bd',
        organization: 'Bangladesh Public Service Commission',
        jobTitle: '48th BCS Cadre',
        username: 'bcs_applicant_88',
        userId: 'BCS-88',
        password: 'BcsPassword#2026',
      });

      await CredentialVaultRepository.saveCredential({
        portalName: 'Bangladesh Bank eRecruitment',
        portalUrl: 'https://erecruitment.bb.org.bd',
        organization: 'Bangladesh Bank',
        jobTitle: 'Assistant Director (General)',
        username: 'bb_candidate_12',
        userId: 'BB-12',
        password: 'BbPassword#2026',
      });

      const list = await CredentialVaultRepository.listDecryptedCredentials();

      // Search by Organization "Public Service"
      const orgSearch = list.filter((c) => (c.organization || '').toLowerCase().includes('public service'));
      expect(orgSearch).toHaveLength(1);
      expect(orgSearch[0].jobTitle).toBe('48th BCS Cadre');

      // Search by Job Title "Assistant Director"
      const jobSearch = list.filter((c) => (c.jobTitle || '').toLowerCase().includes('assistant director'));
      expect(jobSearch).toHaveLength(1);
      expect(jobSearch[0].portalName).toBe('Bangladesh Bank eRecruitment');

      // Search by User ID "BCS-88"
      const idSearch = list.filter((c) => (c.userId || '').toLowerCase().includes('bcs-88'));
      expect(idSearch).toHaveLength(1);
    });

    it('7. Application Tracker separation: stores applicantId and links credentialId without exposing passwords', async () => {
      await CredentialVaultRepository.initializeVault('Master#Vault2026', 15);

      const cred = await CredentialVaultRepository.saveCredential({
        portalName: 'Teletalk DOR',
        portalUrl: 'https://dor.teletalk.com.bd',
        organization: 'Directorate of Registration',
        jobTitle: 'Sub-Registrar',
        username: 'sub_reg_applicant',
        userId: 'SR-2026-001',
        password: 'TopSecret#Password',
      });

      // Save application in Application Tracker
      const appRecord = await ApplicationRepository.setStatus(
        {
          id: 'job_sub_registrar_84',
          jobTitle: 'Sub-Registrar (84 Posts)',
          organization: 'Directorate of Registration',
          applicationUrl: 'https://dor.teletalk.com.bd',
          circularUrl: 'https://dor.gov.bd',
          deadlineAt: 1764500000000,
        },
        'Applied',
        {
          teletalkUserId: 'SR-2026-001',
          applicationRefId: 'REF-99881',
          notes: 'Admit card expected December',
        }
      );

      // Attach credential link to application record
      appRecord.credentialId = cred.id;
      await ApplicationRepository.upsert(appRecord);

      const retrieved = await ApplicationRepository.getByJobId('job_sub_registrar_84');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.teletalkUserId).toBe('SR-2026-001');
      expect(retrieved!.credentialId).toBe(cred.id);

      // Password NEVER exists on the application record!
      expect((retrieved as any).password).toBeUndefined();
    });
  });

  describe('Part 3: MessageRouter IPC & Integration', () => {
    it('8. Handles PROFILE_UPDATE_APPROVE and PROFILE_UPDATE_UNDO via trusted IPC messages', async () => {
      const diff: DetectedProfileDiffItem = {
        id: 'diff_ipc_1',
        canonicalKey: 'contact.mobile',
        fieldLabel: 'Mobile Number',
        fieldLabelBn: 'মোবাইল নম্বর',
        destination: 'personal',
        destinationLabel: 'Personal Profile',
        destinationLabelBn: 'ব্যক্তিগত তথ্য',
        oldValue: profile.personal.mobile,
        newValue: '01988776655',
        diffType: 'CHANGED',
        selected: true,
      };

      const approveRes: any = await new Promise((resolve) => {
        MessageRouter.handleMessage(
          {
            action: 'PROFILE_UPDATE_APPROVE',
            payload: {
              approvedItems: [diff],
              sourceOrigin: 'https://bpsc.teletalk.com.bd',
            },
          },
          { tab: { id: 1, url: 'https://bpsc.teletalk.com.bd/apply' } as any },
          resolve
        );
      });

      expect(approveRes.status).toBe('ok');
      expect(approveRes.appliedCount).toBe(1);
      expect(approveRes.updatedProfile.personal.mobile).toBe('01988776655');

      // Query change history via IPC
      const histRes: any = await new Promise((resolve) => {
        MessageRouter.handleMessage(
          { action: 'GET_PROFILE_CHANGE_HISTORY' },
          { tab: { id: 1, url: 'https://bpsc.teletalk.com.bd/apply' } as any },
          resolve
        );
      });
      expect(histRes.status).toBe('ok');
      expect(histRes.history).toHaveLength(1);
      const recordId = histRes.history[0].id;

      // Undo via IPC
      const undoRes: any = await new Promise((resolve) => {
        MessageRouter.handleMessage(
          {
            action: 'PROFILE_UPDATE_UNDO',
            payload: { historyRecordId: recordId },
          },
          { tab: { id: 1, url: 'https://bpsc.teletalk.com.bd/apply' } as any },
          resolve
        );
      });
      expect(undoRes.status).toBe('ok');
      expect(undoRes.reverted).toBe(true);
      expect(undoRes.updatedProfile.personal.mobile).toBe(profile.personal.mobile);
    });

    it('9. Detects and routes new Education (Masters) and Job Experience records to their dedicated destinations', async () => {
      // Profile initially has no masters and empty job experiences
      delete (profile as any).masters;
      profile.hasMasters = false;
      profile.jobExperiences = [];
      profile.hasJobExperience = false;

      const scannedInputs = [
        { canonicalKey: 'education.masters.examination', value: 'M.Sc in Computer Science', label: 'Masters Degree' },
        { canonicalKey: 'education.masters.passingYear', value: '2023', label: 'Masters Passing Year' },
        { canonicalKey: 'experience.organization', value: 'Bangladesh Computer Council', label: 'Organization' },
        { canonicalKey: 'experience.designation', value: 'Assistant Programmer', label: 'Designation' },
      ];

      const diffs = ProfileDiffEngine.detectFormDiffs(scannedInputs, profile);
      expect(diffs).toHaveLength(4);

      const mastersExam = diffs.find((d) => d.canonicalKey === 'education.masters.examination');
      expect(mastersExam).toBeDefined();
      expect(mastersExam!.destination).toBe('education');
      expect(mastersExam!.diffType).toBe('NEW');

      const expOrg = diffs.find((d) => d.canonicalKey === 'experience.organization');
      expect(expOrg).toBeDefined();
      expect(expOrg!.destination).toBe('experience');
      expect(expOrg!.diffType).toBe('NEW');

      // Apply approved diffs
      const result = await ProfileDiffEngine.applyApprovedDiffs(profile, diffs, 'https://alljobs.teletalk.com.bd');
      expect(result.appliedCount).toBe(4);
      expect(result.updatedProfile.masters.examination).toBe('M.Sc in Computer Science');
      expect(result.updatedProfile.masters.passingYear).toBe('2023');
      expect(result.updatedProfile.hasMasters).toBe(true);
      expect(result.updatedProfile.jobExperiences).toHaveLength(1);
      expect(result.updatedProfile.jobExperiences[0].organization).toBe('Bangladesh Computer Council');
      expect(result.updatedProfile.jobExperiences[0].designation).toBe('Assistant Programmer');
      expect(result.updatedProfile.hasJobExperience).toBe(true);
    });

    it('10. Enforces strict exact HTTPS origin matching and blocks lookalike or HTTP origin queries', async () => {
      await CredentialVaultRepository.initializeVault('Master#Vault2026', 15);

      await CredentialVaultRepository.saveCredential({
        portalName: 'Official Govt Portal',
        portalUrl: 'https://official.gov.bd/login',
        username: 'gov_user_1',
        password: 'Secure#Password123',
      });

      // Query from insecure HTTP URL
      const httpMatches = await CredentialVaultRepository.findMatchingForPageUrl('http://official.gov.bd/login');
      expect(httpMatches).toHaveLength(0);

      // Query from lookalike phishing URL
      const lookalikeMatches = await CredentialVaultRepository.findMatchingForPageUrl('https://official.gov.bd.attacker.com/login');
      expect(lookalikeMatches).toHaveLength(0);

      // Query from exact HTTPS origin succeeds
      const exactMatches = await CredentialVaultRepository.findMatchingForPageUrl('https://official.gov.bd/application-form');
      expect(exactMatches).toHaveLength(1);
      expect(exactMatches[0].username).toBe('gov_user_1');
    });
  });
});
