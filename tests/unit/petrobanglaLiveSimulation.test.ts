import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PageScanner } from '../../src/content/page-scanner';
import { sampleDemoProfile } from '../../src/types/defaults';
import { VerificationEngine } from '../../src/validation/verification-engine';
import { PetroBanglaRules } from '../../src/adapters/petrobangla/petrobangla.rules';
import { DocumentFieldDetector } from '../../src/documents/document-field-detector';
import { DocumentUploadCoordinator } from '../../src/documents/document-coordinator';
import { ImageProcessor } from '../../src/services/image-processor';

function installChromeDataTransferPolyfill() {
  if ((HTMLInputElement.prototype as any).__hasDataTransferPolyfill) return;
  (HTMLInputElement.prototype as any).__hasDataTransferPolyfill = true;
  class MockFileList extends Array<File> {
    item(index: number) {
      return this[index] || null;
    }
  }
  (globalThis as any).DataTransfer = class {
    private _files = new MockFileList();
    public items = {
      add: (file: File) => {
        this._files.push(file);
      },
    };
    get files(): FileList {
      return this._files as unknown as FileList;
    }
  };
  const proto = HTMLInputElement.prototype;
  const origDesc = Object.getOwnPropertyDescriptor(proto, 'files');
  const fileMap = new WeakMap<HTMLInputElement, FileList>();
  Object.defineProperty(proto, 'files', {
    configurable: true,
    get() {
      return fileMap.get(this) || (origDesc?.get ? origDesc.get.call(this) : ({ length: 0, item: () => null } as any));
    },
    set(val: FileList) {
      fileMap.set(this, val);
    },
  });
}

function makeSyntheticJpegDataUrl(byteSize = 4096): string {
  const bytes = new Uint8Array(byteSize);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  bytes[3] = 0xe0;
  bytes[byteSize - 2] = 0xff;
  bytes[byteSize - 1] = 0xd9;
  return ImageProcessor.uint8ArrayToDataUrl(bytes, 'image/jpeg');
}

describe('PetroBangla Form End-to-End Live Workflow', () => {
  it(
    'Scans and automatically fills all supported fields without confidence score blockers',
    async () => {
    const htmlPath = path.resolve(__dirname, '../../test-pages/petrobangla-form.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

    document.documentElement.innerHTML = htmlContent;

    // 1. Pre-process dynamic progressive disclosure sections
    const gradChk = document.querySelector<HTMLInputElement>('#chk_grad');
    if (gradChk) {
      gradChk.checked = true;
      const gradSec = document.getElementById('sec_graduation');
      if (gradSec) gradSec.style.display = 'table';
    }

    // 2. Perform page scan
    const scanResult = await PageScanner.scanPage(sampleDemoProfile);

    expect(scanResult.totalVisibleInputs).toBeGreaterThanOrEqual(25);
    expect(scanResult.readyToFillCount).toBeGreaterThanOrEqual(20);
    expect(scanResult.ambiguousCount).toBe(0);

    // Ensure ordinary matched items are approved by default
    const matchedItems = scanResult.planItems.filter((i) => i.status === 'Matched');
    expect(matchedItems.length).toBeGreaterThanOrEqual(20);
    expect(matchedItems.every((i) => i.isApproved)).toBe(true);

    // 3. Execute Auto Fill Now
    const sessionId = 'session_test_petrobangla';
    const report = await VerificationEngine.executePlan(sessionId, matchedItems);

    expect(report.successfullyFilled).toBeGreaterThanOrEqual(20);
    const failedItems = report.items.filter((i) => i.status === 'Fill Failed');
    if (failedItems.length > 0) {
      console.log('FAILED ITEMS:', failedItems.map((i) => ({ label: i.fieldLabel, msg: i.verificationMessage, proposed: i.proposedValue, current: (i.element as any).value, tag: i.element.tagName })));
    }
    expect(report.failedVerification).toBe(0);

    // Apply postFill adapter rules
    PetroBanglaRules.applyPostFillRules(document, sampleDemoProfile);

    // 4. Verify DOM values directly
    const applicantName = (document.getElementById('applicant_name') as HTMLInputElement).value;
    const applicantNameBn = (document.getElementById('applicant_name_bn') as HTMLInputElement).value;
    const fatherName = (document.getElementById('father_name') as HTMLInputElement).value;
    const motherName = (document.getElementById('mother_name') as HTMLInputElement).value;
    const dob = (document.getElementById('dob') as HTMLInputElement).value;
    const nationality = (document.getElementById('nationality') as HTMLSelectElement).value;
    const religion = (document.getElementById('religion') as HTMLSelectElement).value;
    const gender = (document.getElementById('gender') as HTMLSelectElement).value;

    expect(applicantName).toBe('MD. HASAN MAHMUD');
    expect(applicantNameBn).toContain('মাহমুদ');
    expect(fatherName).toBe('MD. ABDUR RAHIM');
    expect(motherName).toBe('MST. FATEMA BEGUM');
    expect(dob).toBe('15-05-1998'); // DD-MM-YYYY format
    expect(nationality.toLowerCase()).toBe('bangladeshi');
    expect(religion.toLowerCase()).toBe('islam');
    expect(gender.toLowerCase()).toBe('male');

    // Education Examination Dropdown Assertions
    const sscExam = (document.getElementById('ssc_exam') as HTMLSelectElement).value;
    const hscExam = (document.getElementById('hsc_exam') as HTMLSelectElement).value;
    expect(sscExam).toBe('S.S.C');
    expect(hscExam).toBe('H.S.C');
  }, 15000);

  it(
    'Auto-attaches conforming Photo and Signature during autofill and updates previews on Petrobangla official form',
    async () => {
      // 1. Load HTML
      const htmlPath = path.resolve(__dirname, '../../test-pages/petrobangla-form.html');
      const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
      document.documentElement.innerHTML = htmlContent;

      installChromeDataTransferPolyfill();

      // Bind host script change listeners for preview (emulating browser execution of page scripts)
      const bindTeletalkPreview = (inputId: string, previewId: string, errId: string, maxKb: number) => {
        const inp = document.getElementById(inputId) as HTMLInputElement | null;
        const img = document.getElementById(previewId) as HTMLImageElement | null;
        const err = document.getElementById(errId);
        if (!inp) return;
        inp.addEventListener('change', () => {
          if (err) err.textContent = '';
          const file = inp.files && inp.files[0];
          if (!file) return;
          if (file.size > maxKb * 1024) {
            if (err) err.textContent = `File size exceeds ${maxKb} KB limit.`;
            return;
          }
          if (img) {
            img.src = 'data:image/jpeg;base64,preview_' + inputId;
            img.style.display = 'inline-block';
          }
        });
      };
      bindTeletalkPreview('photo', 'photo_preview', 'photo_error', 100);
      bindTeletalkPreview('signature', 'sig_preview', 'sig_error', 60);

      // Verify inputs start empty and previews hidden
      const photoInput = document.getElementById('photo') as HTMLInputElement;
      const sigInput = document.getElementById('signature') as HTMLInputElement;
      const photoPreview = document.getElementById('photo_preview') as HTMLImageElement;
      const sigPreview = document.getElementById('sig_preview') as HTMLImageElement;
      expect(photoInput.files?.length || 0).toBe(0);
      expect(sigInput.files?.length || 0).toBe(0);
      expect(photoPreview.style.display).toBe('none');
      expect(sigPreview.style.display).toBe('none');

      // 2. Scan document fields
      const docFields = DocumentFieldDetector.scanDocumentFields(document);
      expect(docFields.length).toBe(2);
      expect(docFields.some((df) => df.documentType === 'photo')).toBe(true);
      expect(docFields.some((df) => df.documentType === 'signature')).toBe(true);

      // 3. Mock fetchDocumentFn with conforming photo (300x300 JPEG, 20 KB) and signature (300x80 JPEG, 10 KB)
      const mockFetchDoc = async (type: string) => {
        if (type === 'photo') {
          return {
            metadata: {
              documentId: 'doc_photo_petro',
              documentType: 'photo' as const,
              profileId: 'prof_petro',
              title: 'Applicant Photo',
              fileName: 'photo_300x300.jpg',
              mimeType: 'image/jpeg',
              fileSize: 20 * 1024,
              width: 300,
              height: 300,
              createdAt: new Date().toISOString(),
            },
            dataUrl: makeSyntheticJpegDataUrl(20 * 1024),
          };
        }
        if (type === 'signature') {
          return {
            metadata: {
              documentId: 'doc_sig_petro',
              documentType: 'signature' as const,
              profileId: 'prof_petro',
              title: 'Applicant Signature',
              fileName: 'signature_300x80.jpg',
              mimeType: 'image/jpeg',
              fileSize: 10 * 1024,
              width: 300,
              height: 80,
              createdAt: new Date().toISOString(),
            },
            dataUrl: makeSyntheticJpegDataUrl(10 * 1024),
          };
        }
        return null;
      };

      // 4. Execute auto attach
      const autoAttachResult = await DocumentUploadCoordinator.autoAttachEligibleDocuments(document, mockFetchDoc);

      expect(autoAttachResult.attempted).toBe(2);
      expect(autoAttachResult.attachedCount).toBe(2);
      expect(autoAttachResult.failedCount).toBe(0);
      expect(autoAttachResult.pendingManualReview.length).toBe(0);

      // 5. Verify DOM state
      expect(photoInput.files).toBeDefined();
      expect(photoInput.files!.length).toBe(1);
      expect(photoInput.files![0].name).toBe('photo_300x300.jpg');

      expect(sigInput.files).toBeDefined();
      expect(sigInput.files!.length).toBe(1);
      expect(sigInput.files![0].name).toBe('signature_300x80.jpg');

      // Previews are now rendered
      expect(photoPreview.style.display).toBe('inline-block');
      expect(sigPreview.style.display).toBe('inline-block');
      expect((document.getElementById('photo_error') as HTMLElement).textContent).toBe('');
      expect((document.getElementById('sig_error') as HTMLElement).textContent).toBe('');
    },
    15000
  );
});
