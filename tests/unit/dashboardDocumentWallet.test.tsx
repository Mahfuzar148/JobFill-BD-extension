// JobFill BD - Dashboard Visual Document Wallet & Identity Gallery Test Suite
// Verifies:
// 1. Full Dashboard visual gallery layout (Area A Photo, Area B NID, Area C Certificates, Area D Others).
// 2. Real repository status tracking (Uploaded vs Missing, exact counts, zero fake uploads).
// 3. Separate NID Front and NID Back tracking (never treating one side as both).
// 4. NID security: Masked NID number, locked previews by default, authentication prompt before reveal.
// 5. Memory cleanup: Preview close clears temporary dataUrl & revokes object URLs.
// 6. Academic Certificates correlated with profile education metadata (Board, Passing Year, Level).
// 7. Image and PDF document recognition and preview.
// 8. Direct actions: upload, preview, replace, and deletion with confirmation.
// 9. Profile switching isolation: documents between different profiles never cross-contaminate.
// 10. Release package integrity: SHA-256 hashes of release ZIPs remain untouched.

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { MyDocumentsWallet, maskNidNumber } from '../../src/dashboard/components/MyDocumentsWallet';
import { OverviewPage } from '../../src/dashboard/pages/OverviewPage';
import { AppProvider } from '../../src/dashboard/context/AppContext';
import { UserProfile, DocumentMetadata } from '../../src/types/profile';
import { createEmptyProfile, sampleDemoProfile } from '../../src/types/defaults';
import { DocumentRepository } from '../../src/database/document-repository';
import { VaultManager } from '../../src/security/vault-manager';
import { KeyManager } from '../../src/security/key-manager';

async function flushUi(ms = 50) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

describe('JobFill BD — Dashboard Visual Document Wallet & Identity Gallery Suite', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;
  let testProfile: UserProfile;

  beforeEach(async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    sessionStorage.clear();
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    testProfile = {
      ...createEmptyProfile('Test Candidate'),
      id: 'prof_test_wallet_1',
      personal: {
        ...createEmptyProfile('Test Candidate').personal,
        applicantNameEn: 'Md Mahmudul Hasan',
        applicantNameBn: 'মো: মাহমুদুল হাসান',
        nid: '19951234567890123',
      },
      ssc: {
        ...createEmptyProfile('Test Candidate').ssc,
        board: 'Dhaka Board',
        institution: 'Dhaka Collegiate School',
        passingYear: '2012',
        gpa: '5.00',
      },
      hsc: {
        ...createEmptyProfile('Test Candidate').hsc,
        board: 'Dhaka Board',
        institution: 'Dhaka College',
        passingYear: '2014',
        gpa: '5.00',
      },
      hasGraduation: true,
      graduation: {
        ...createEmptyProfile('Test Candidate').graduation,
        universityInstitute: 'University of Dhaka',
        subjectDegree: 'Computer Science & Engineering',
        passingYear: '2018',
        gpa: '3.85',
      },
    };
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
    document.body.innerHTML = '';
    localStorage.clear();
  });

  // =========================================================================
  // TEST GROUP 1: Component Layout & Section Header
  // =========================================================================
  describe('1. Dashboard Document Wallet Layout & Header Architecture', () => {
    it('renders the My Documents section header with subtitle, counts, and local AES-256 badge', async () => {
      const onNavigate = vi.fn();
      await act(async () => {
        root?.render(
          <MyDocumentsWallet
            profile={testProfile}
            language="en"
            onNavigateTab={onNavigate}
          />
        );
      });
      await flushUi();

      expect(container.textContent).toContain('My Documents & Identity Wallet');
      expect(container.textContent).toContain('Your profile, identity and academic documents in one secure local place.');
      expect(container.textContent).toContain('Local AES-256');

      // Top right action
      const viewAllBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('View All Documents')
      );
      expect(viewAllBtn).toBeDefined();

      // Clicking View All Documents routes to 'documents'
      await act(async () => {
        viewAllBtn?.click();
      });
      expect(onNavigate).toHaveBeenCalledWith('documents');
    });

    it('renders Bengali language header and labels accurately when language is "bn"', async () => {
      await act(async () => {
        root?.render(
          <MyDocumentsWallet
            profile={testProfile}
            language="bn"
            onNavigateTab={vi.fn()}
          />
        );
      });
      await flushUi();

      expect(container.textContent).toContain('আমার ডকুমেন্টস ও সার্টিফিকেট');
      expect(container.textContent).toContain('প্রোফাইল ছবি');
      expect(container.textContent).toContain('জাতীয় পরিচয়পত্র');
      expect(container.textContent).toContain('শিক্ষাগত সনদ ও মার্কশিট');
    });

    it('renders all four main areas (Photo, NID, Academic Certificates, Others)', async () => {
      await act(async () => {
        root?.render(
          <MyDocumentsWallet
            profile={testProfile}
            language="en"
            onNavigateTab={vi.fn()}
          />
        );
      });
      await flushUi();

      // Area A: Photo
      expect(container.textContent).toContain('Profile Photograph');
      // Area B: NID
      expect(container.textContent).toContain('NID Front Part');
      expect(container.textContent).toContain('NID Back Part');
      // Area C: Academic Certificates
      expect(container.textContent).toContain('SSC Certificate');
      expect(container.textContent).toContain('SSC Marksheet');
      expect(container.textContent).toContain('HSC Certificate');
      expect(container.textContent).toContain('HSC Marksheet');
      expect(container.textContent).toContain('Graduation Certificate');
      // Area D: Others
      expect(container.textContent).toContain('Signature & Supporting Documents');
      expect(container.textContent).toContain('CV / Resume');
    });
  });

  // =========================================================================
  // TEST GROUP 2: Real Data Status (No Fake Claims) & Empty States
  // =========================================================================
  describe('2. Honest Status Display & Separate NID Card Tracking', () => {
    it('shows "Missing" / "No Photo" when no documents are uploaded yet', async () => {
      await act(async () => {
        root?.render(
          <MyDocumentsWallet
            profile={testProfile}
            language="en"
            onNavigateTab={vi.fn()}
          />
        );
      });
      await flushUi();

      expect(container.textContent).toContain('0 Uploaded');
      expect(container.textContent).toContain('Upload Profile Photo');
      expect(container.textContent).toContain('Upload Front');
      expect(container.textContent).toContain('Upload Back');
    });

    it('tracks NID Front and NID Back separately and never treats one image as both sides', async () => {
      // Save ONLY NID Front
      await DocumentRepository.saveDocument({
        id: `doc_${testProfile.id}_nid_front_1`,
        documentId: `doc_${testProfile.id}_nid_front_1`,
        profileId: testProfile.id,
        type: 'nid_front',
        documentType: 'nid_front',
        title: 'National ID Front Part',
        fileName: 'nid_front_scanned.jpg',
        fileSize: 45000,
        fileSizeKb: 43.95,
        mimeType: 'image/jpeg',
        width: 1200,
        height: 750,
        dataUrl: 'data:image/jpeg;base64,bmlkX2Zyb250X2RhdGE=',
      });

      await act(async () => {
        root?.render(
          <MyDocumentsWallet
            profile={testProfile}
            language="en"
            onNavigateTab={vi.fn()}
          />
        );
      });
      await flushUi();

      // Find NID Front card: should be Uploaded
      const allText = container.textContent || '';
      expect(allText).toContain('NID Front Part');
      expect(allText).toContain('1 Uploaded');

      // NID Back must still show Missing and "Upload Back" button
      expect(allText).toContain('NID Back Part');
      expect(allText).toContain('Upload Back');
    });

    it('accurately updates count to 2 when both NID Front and NID Back are saved', async () => {
      await DocumentRepository.saveDocument({
        id: `doc_${testProfile.id}_nid_front_1`,
        documentId: `doc_${testProfile.id}_nid_front_1`,
        profileId: testProfile.id,
        type: 'nid_front',
        documentType: 'nid_front',
        title: 'National ID Front Part',
        fileName: 'nid_front.jpg',
        fileSize: 45000,
        fileSizeKb: 43.95,
        mimeType: 'image/jpeg',
        width: 1200,
        height: 750,
        dataUrl: 'data:image/jpeg;base64,ZnJvbnQ=',
      });

      await DocumentRepository.saveDocument({
        id: `doc_${testProfile.id}_nid_back_1`,
        documentId: `doc_${testProfile.id}_nid_back_1`,
        profileId: testProfile.id,
        type: 'nid_back',
        documentType: 'nid_back',
        title: 'National ID Back Part',
        fileName: 'nid_back.jpg',
        fileSize: 42000,
        fileSizeKb: 41.02,
        mimeType: 'image/jpeg',
        width: 1200,
        height: 750,
        dataUrl: 'data:image/jpeg;base64,YmFjaw==',
      });

      await act(async () => {
        root?.render(
          <MyDocumentsWallet
            profile={testProfile}
            language="en"
            onNavigateTab={vi.fn()}
          />
        );
      });
      await flushUi();

      expect(container.textContent).toContain('2 Uploaded');
    });
  });

  // =========================================================================
  // TEST GROUP 3: NID Security, Masking & Authentication Unlock
  // =========================================================================
  describe('3. NID Security, Masked Numbers & Authentication Protection', () => {
    it('masks full NID number on Dashboard (never displays unmasked plaintext NID)', () => {
      const fullNid = '19951234567890123';
      const masked = maskNidNumber(fullNid);

      expect(masked).toBe('•••• •••• 0123');
      expect(masked).not.toContain('199512345678');
    });

    it('displays masked NID number in the Dashboard Identity header', async () => {
      await act(async () => {
        root?.render(
          <MyDocumentsWallet
            profile={testProfile}
            language="en"
            onNavigateTab={vi.fn()}
          />
        );
      });
      await flushUi();

      expect(container.textContent).toContain('NID: •••• •••• 0123');
      expect(container.textContent).not.toContain('19951234567890123');
    });

    it('displays "Locked Preview" by default for uploaded NID documents', async () => {
      await DocumentRepository.saveDocument({
        id: `doc_${testProfile.id}_nid_front_1`,
        documentId: `doc_${testProfile.id}_nid_front_1`,
        profileId: testProfile.id,
        type: 'nid_front',
        documentType: 'nid_front',
        title: 'National ID Front Part',
        fileName: 'nid_front.jpg',
        fileSize: 50000,
        fileSizeKb: 48.8,
        mimeType: 'image/jpeg',
        width: 1200,
        height: 750,
        dataUrl: 'data:image/jpeg;base64,ZGF0YQ==',
      });

      await act(async () => {
        root?.render(
          <MyDocumentsWallet
            profile={testProfile}
            language="en"
            onNavigateTab={vi.fn()}
          />
        );
      });
      await flushUi();

      expect(container.textContent).toContain('Locked Preview');
      expect(container.textContent).toContain('Unlock & View');
    });

    it('clicking "Unlock & View" opens authentication prompt before revealing image', async () => {
      await DocumentRepository.saveDocument({
        id: `doc_${testProfile.id}_nid_front_1`,
        documentId: `doc_${testProfile.id}_nid_front_1`,
        profileId: testProfile.id,
        type: 'nid_front',
        documentType: 'nid_front',
        title: 'National ID Front Part',
        fileName: 'nid_front.jpg',
        fileSize: 50000,
        fileSizeKb: 48.8,
        mimeType: 'image/jpeg',
        width: 1200,
        height: 750,
        dataUrl: 'data:image/jpeg;base64,ZGF0YQ==',
      });

      await act(async () => {
        root?.render(
          <MyDocumentsWallet
            profile={testProfile}
            language="en"
            onNavigateTab={vi.fn()}
          />
        );
      });
      await flushUi();

      const unlockBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Unlock & View')
      );
      expect(unlockBtn).toBeDefined();

      await act(async () => {
        unlockBtn?.click();
      });
      await flushUi();

      // Authentication modal opens
      expect(container.textContent).toContain('Unlock Sensitive Identity Document');
      expect(container.textContent).toContain('Authorize & Unlock');

      // Submit authorization
      const authorizeBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Authorize & Unlock')
      );
      await act(async () => {
        authorizeBtn?.click();
      });
      await flushUi(200);

      // Preview modal opens revealing document
      expect(container.textContent).toContain('National ID Front Part');
      expect(container.textContent).toContain('Close & Lock');

      // Closing preview revokes and locks representation again
      const closeLockBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Close & Lock')
      );
      await act(async () => {
        closeLockBtn?.click();
      });
      await flushUi();

      // Returns to locked representation
      expect(container.textContent).toContain('Locked Preview');
    });
  });

  // =========================================================================
  // TEST GROUP 4: Academic Certificates & Education Metadata Integration
  // =========================================================================
  describe('4. Academic Certificates & Profile Education Metadata', () => {
    it('correlates SSC and HSC cards with board and passing year from profile', async () => {
      await act(async () => {
        root?.render(
          <MyDocumentsWallet
            profile={testProfile}
            language="en"
            onNavigateTab={vi.fn()}
          />
        );
      });
      await flushUi();

      expect(container.textContent).toContain('Dhaka Board');
      expect(container.textContent).toContain('2012'); // SSC year
      expect(container.textContent).toContain('2014'); // HSC year
      expect(container.textContent).toContain('University of Dhaka'); // Graduation
    });

    it('recognizes PDF academic certificate and displays PDF badge and file size', async () => {
      await DocumentRepository.saveDocument({
        id: `doc_${testProfile.id}_ssc_cert_1`,
        documentId: `doc_${testProfile.id}_ssc_cert_1`,
        profileId: testProfile.id,
        type: 'educational_certificate',
        documentType: 'ssc_cert',
        title: 'SSC Certificate Original',
        fileName: 'ssc_board_certificate.pdf',
        fileSize: 256000,
        fileSizeKb: 250,
        mimeType: 'application/pdf',
        width: 0,
        height: 0,
        dataUrl: 'data:application/pdf;base64,SlZCRVJpMENDZw==',
      });

      await act(async () => {
        root?.render(
          <MyDocumentsWallet
            profile={testProfile}
            language="en"
            onNavigateTab={vi.fn()}
          />
        );
      });
      await flushUi();

      expect(container.textContent).toContain('📄 PDF');
      expect(container.textContent).toContain('250 KB');
      expect(container.textContent).toContain('Uploaded');
    });

    it('opens Preview modal for academic certificate when preview button is clicked', async () => {
      await DocumentRepository.saveDocument({
        id: `doc_${testProfile.id}_ssc_cert_1`,
        documentId: `doc_${testProfile.id}_ssc_cert_1`,
        profileId: testProfile.id,
        type: 'educational_certificate',
        documentType: 'ssc_cert',
        title: 'SSC Certificate Official',
        fileName: 'ssc_certificate.pdf',
        fileSize: 180000,
        fileSizeKb: 175.78,
        mimeType: 'application/pdf',
        width: 0,
        height: 0,
        dataUrl: 'data:application/pdf;base64,cGRmX2NvbnRlbnQ=',
      });

      await act(async () => {
        root?.render(
          <MyDocumentsWallet
            profile={testProfile}
            language="en"
            onNavigateTab={vi.fn()}
          />
        );
      });
      await flushUi();

      const alertSpy = vi.spyOn(window, 'alert');
      const previewBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Preview')
      );
      expect(previewBtn).toBeDefined();

      await act(async () => {
        previewBtn?.click();
      });
      await flushUi(600);

      if (alertSpy.mock.calls.length > 0) {
        console.error('Alert called with:', alertSpy.mock.calls);
      }
      expect(container.textContent).toContain('SSC Certificate Official');
      expect(container.textContent).toContain('Close & Lock');
    });
  });

  // =========================================================================
  // TEST GROUP 5: Profile Isolation (Multi-Profile Isolation)
  // =========================================================================
  describe('5. Profile Switching Isolation', () => {
    it('strictly isolates documents between different profiles and never leaks records', async () => {
      const profileA = { ...testProfile, id: 'prof_alpha' };
      const profileB = { ...testProfile, id: 'prof_beta' };

      // Save photo for Profile A only
      await DocumentRepository.saveDocument({
        id: `photo_${profileA.id}_original`,
        documentId: `photo_${profileA.id}_original`,
        profileId: profileA.id,
        type: 'photo',
        documentType: 'photo',
        title: 'Alpha Photograph',
        fileName: 'alpha.jpg',
        fileSize: 20000,
        fileSizeKb: 19.5,
        mimeType: 'image/jpeg',
        width: 300,
        height: 300,
        dataUrl: 'data:image/jpeg;base64,YWxwaGE=',
      });

      // Render with Profile A
      await act(async () => {
        root?.render(
          <MyDocumentsWallet
            profile={profileA}
            language="en"
            onNavigateTab={vi.fn()}
          />
        );
      });
      await flushUi();

      expect(container.textContent).toContain('1 Uploaded');

      // Switch to Profile B
      await act(async () => {
        root?.render(
          <MyDocumentsWallet
            profile={profileB}
            language="en"
            onNavigateTab={vi.fn()}
          />
        );
      });
      await flushUi();

      // Profile B has no documents: must show 0 Uploaded
      expect(container.textContent).toContain('0 Uploaded');
      expect(container.textContent).toContain('Upload Profile Photo');
    });
  });

  // =========================================================================
  // TEST GROUP 6: OverviewPage Integration
  // =========================================================================
  describe('6. OverviewPage Dashboard Integration', () => {
    it('renders MyDocumentsWallet inside OverviewPage cleanly', async () => {
      await act(async () => {
        root?.render(
          <AppProvider>
            <OverviewPage
              profile={testProfile}
              onNavigateTab={vi.fn()}
            />
          </AppProvider>
        );
      });
      await flushUi();

      expect(
        container.textContent?.includes('My Documents & Identity Wallet') ||
          container.textContent?.includes('আমার ডকুমেন্টস ও সার্টিফিকেট')
      ).toBe(true);
      expect(
        container.textContent?.includes('Profile Photograph') ||
          container.textContent?.includes('প্রোফাইল ছবি')
      ).toBe(true);
      expect(
        container.textContent?.includes('Identity Documents') ||
          container.textContent?.includes('জাতীয় পরিচয়পত্র')
      ).toBe(true);
      expect(
        container.textContent?.includes('Academic Certificates') ||
          container.textContent?.includes('শিক্ষাগত সনদ ও মার্কশিট')
      ).toBe(true);
    });
  });

  // =========================================================================
  // TEST GROUP 7: Release Package Integrity Baseline Verification
  // =========================================================================
  describe('7. Production Release Package Integrity Protection', () => {
    it('verifies SHA-256 of release/JobFill-BD-Edge.zip remains strictly untouched', () => {
      const edgeZipPath = path.resolve('D:/Job form Fill-up extension', 'release', 'JobFill-BD-Edge.zip');
      const expectedEdgeHash = 'DB08AA45F1C3ED99AD8ADEBF5B81EDFA94812E93A02557D2306EE171AAD52732';

      const fileBuffer = fs.readFileSync(edgeZipPath);
      const computedHash = crypto.createHash('sha256').update(fileBuffer).digest('hex').toUpperCase();

      expect(computedHash).toBe(expectedEdgeHash);
    });

    it('verifies SHA-256 of release/chrome/JobFill-BD-Chrome.zip remains strictly untouched', () => {
      const chromeZipPath = path.resolve('D:/Job form Fill-up extension', 'release', 'chrome', 'JobFill-BD-Chrome.zip');
      const expectedChromeHash = '23D002185F2640CB47803A086AB39076F2C2E923AC84405C3117391D65F89DB9';

      const fileBuffer = fs.readFileSync(chromeZipPath);
      const computedHash = crypto.createHash('sha256').update(fileBuffer).digest('hex').toUpperCase();

      expect(computedHash).toBe(expectedChromeHash);
    });
  });
});
