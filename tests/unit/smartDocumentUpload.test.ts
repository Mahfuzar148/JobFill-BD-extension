import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { DocumentRepository } from '../../src/database/document-repository';
import { DocumentFieldDetector } from '../../src/documents/document-field-detector';
import { DocumentRequirementValidator } from '../../src/documents/document-requirement-validator';
import { DocumentUploader } from '../../src/documents/document-uploader';
import { DocumentUploadCoordinator } from '../../src/documents/document-coordinator';
import { ImageProcessor } from '../../src/services/image-processor';
import { MessageRouter } from '../../src/background/message-router';
import { VaultManager } from '../../src/security/vault-manager';
import { KeyManager } from '../../src/security/key-manager';

// Helpers to create realistic synthetic JPEG and PNG binary Data URLs
function makeSyntheticJpegDataUrl(byteSize = 4096): string {
  const bytes = new Uint8Array(byteSize);
  // JPEG SOI + APP0 header magic bytes
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  bytes[3] = 0xe0;
  bytes[byteSize - 2] = 0xff;
  bytes[byteSize - 1] = 0xd9;
  return ImageProcessor.uint8ArrayToDataUrl(bytes, 'image/jpeg');
}

function makeSyntheticPngDataUrl(byteSize = 4096): string {
  const bytes = new Uint8Array(byteSize);
  // PNG signature magic bytes: 89 50 4E 47 0D 0A 1A 0A
  bytes[0] = 0x89;
  bytes[1] = 0x50;
  bytes[2] = 0x4e;
  bytes[3] = 0x47;
  bytes[4] = 0x0d;
  bytes[5] = 0x0a;
  bytes[6] = 0x1a;
  bytes[7] = 0x0a;
  return ImageProcessor.uint8ArrayToDataUrl(bytes, 'image/png');
}

function makeSyntheticPdfDataUrl(byteSize = 2048): string {
  const bytes = new Uint8Array(byteSize);
  // %PDF-1.4
  bytes[0] = 0x25;
  bytes[1] = 0x50;
  bytes[2] = 0x44;
  bytes[3] = 0x46;
  return ImageProcessor.uint8ArrayToDataUrl(bytes, 'application/pdf');
}

function installChromeDataTransferPolyfill() {
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

describe('JobFill BD - Smart Photo & Signature Auto Upload Suite', () => {
  beforeEach(() => {
    installChromeDataTransferPolyfill();
    document.documentElement.innerHTML = '';
    localStorage.clear();
    DocumentRepository.clearVolatileTestStore();
    KeyManager.clearKey();
  });

  it('1. Encrypts all 6 document categories at rest and preserves originals alongside processed copies', async () => {
    const profileId = 'prof_doc_sec_1';
    const rawPhotoUrl = makeSyntheticJpegDataUrl(24 * 1024);

    // Save Original Photo
    const origMeta = await DocumentRepository.saveDocument({
      id: 'photo_orig_1',
      profileId,
      documentType: 'photo',
      title: 'Applicant Photograph',
      fileName: 'passport_raw.jpg',
      mimeType: 'image/jpeg',
      fileSize: 24 * 1024,
      width: 600,
      height: 600,
      dataUrl: rawPhotoUrl,
    });

    // Check raw record is encrypted at rest (no plaintext dataUrl on persisted record)
    const rawRecord = await DocumentRepository.getRawRecordById(origMeta.documentId);
    expect(rawRecord).not.toBeNull();
    expect(rawRecord?.isEncrypted).toBe(true);
    expect(rawRecord?.encryptedPayload?.algorithm).toBe('AES-GCM');
    expect(rawRecord?.dataUrl).toBeUndefined();

    // Save processed copy without overwriting original
    const procUrl = makeSyntheticJpegDataUrl(18 * 1024);
    await DocumentRepository.saveProcessedVariant(origMeta.documentId, {
      profileId,
      documentType: 'photo',
      title: 'Processed 300x300',
      fileName: 'photo_300x300.jpg',
      mimeType: 'image/jpeg',
      fileSize: 18 * 1024,
      width: 300,
      height: 300,
      dataUrl: procUrl,
    });

    // Save Signature, NID, Birth Certificate, Educational Certificate, Other
    await DocumentRepository.saveDocument({
      profileId,
      documentType: 'signature',
      fileName: 'sig.png',
      mimeType: 'image/png',
      fileSize: 12 * 1024,
      width: 300,
      height: 80,
      dataUrl: makeSyntheticPngDataUrl(12 * 1024),
    });
    await DocumentRepository.saveDocument({
      profileId,
      documentType: 'nid',
      fileName: 'nid_front.jpg',
      mimeType: 'image/jpeg',
      fileSize: 50 * 1024,
      width: 800,
      height: 500,
      dataUrl: makeSyntheticJpegDataUrl(50 * 1024),
    });
    await DocumentRepository.saveDocument({
      profileId,
      documentType: 'birth_certificate',
      fileName: 'breg.pdf',
      mimeType: 'application/pdf',
      fileSize: 80 * 1024,
      width: 0,
      height: 0,
      dataUrl: makeSyntheticPdfDataUrl(80 * 1024),
    });
    await DocumentRepository.saveDocument({
      profileId,
      documentType: 'educational_certificate',
      fileName: 'bsc_cert.pdf',
      mimeType: 'application/pdf',
      fileSize: 90 * 1024,
      width: 0,
      height: 0,
      dataUrl: makeSyntheticPdfDataUrl(90 * 1024),
    });
    await DocumentRepository.saveDocument({
      profileId,
      documentType: 'other',
      fileName: 'exp_letter.pdf',
      mimeType: 'application/pdf',
      fileSize: 40 * 1024,
      width: 0,
      height: 0,
      dataUrl: makeSyntheticPdfDataUrl(40 * 1024),
    });

    // Retrieve original (must still be 600x600 and 24KB!)
    const retrievedOrig = await DocumentRepository.getByCategory(profileId, 'photo', false);
    expect(retrievedOrig?.metadata.width).toBe(600);
    expect(retrievedOrig?.metadata.fileName).toBe('passport_raw.jpg');

    // Retrieve processed variant separately
    const retrievedProc = await DocumentRepository.getByCategory(profileId, 'photo', true);
    expect(retrievedProc?.metadata.width).toBe(300);
    expect(retrievedProc?.metadata.isProcessedVariant).toBe(true);

    const allMetas = await DocumentRepository.getDocumentMetadataByProfile(profileId);
    expect(allMetas.length).toBe(7); // Original photo + processed copy + 5 other docs
  });

  it('2. Detects Photo and Signature fields semantically regardless of DOM order and reads website requirements', () => {
    // Reversed DOM order: Signature FIRST, Photo SECOND, plus Bangla label
    document.body.innerHTML = `
      <form>
        <table>
          <tr>
            <td>প্রার্থীর স্বাক্ষর (Applicant Signature)</td>
            <td>
              <input type="file" id="field_1" name="sig_upload" accept="image/jpeg,image/png" />
              <small>Upload signature 300 x 80 px, maximum 60 KB</small>
            </td>
          </tr>
          <tr>
            <td>Recent Photograph (ছবি)</td>
            <td>
              <input type="file" id="field_2" name="pic_upload" accept="image/jpeg,image/jpg" />
              <small>Must be 300×300 pixel and not more than 100 KB</small>
            </td>
          </tr>
          <tr>
            <td>Supporting File</td>
            <td>
              <input type="file" id="field_3" name="extra_upload" />
            </td>
          </tr>
        </table>
      </form>
    `;

    const detected = DocumentFieldDetector.scanDocumentFields(document);
    expect(detected.length).toBe(3);

    // Position 0 is Signature (not assumed to be Photo!)
    expect(detected[0].documentType).toBe('signature');
    expect(detected[0].canonicalKey).toBe('profile.documents.signature');
    expect(detected[0].requirements.requiredWidth).toBe(300);
    expect(detected[0].requirements.requiredHeight).toBe(80);
    expect(detected[0].requirements.maxSizeBytes).toBe(60 * 1024);
    expect(detected[0].requirements.requiresManualReview).toBe(false);

    // Position 1 is Photo
    expect(detected[1].documentType).toBe('photo');
    expect(detected[1].canonicalKey).toBe('profile.documents.photo');
    expect(detected[1].requirements.requiredWidth).toBe(300);
    expect(detected[1].requirements.requiredHeight).toBe(300);
    expect(detected[1].requirements.maxSizeBytes).toBe(100 * 1024);
    expect(detected[1].requirements.acceptedMimeTypes).toContain('image/jpeg');

    // Field with missing website instructions never invents dims/size and sets requiresManualReview
    expect(detected[2].requirements.requiredWidth).toBeNull();
    expect(detected[2].requirements.maxSizeBytes).toBeNull();
    expect(detected[2].requirements.requiresManualReview).toBe(true);
  });

  it('3. Validates JPG, JPEG, PNG, incorrect format (PDF/fake magic bytes), oversized image, and wrong dimensions/aspect ratio', () => {
    const photoReqs = {
      acceptAttribute: 'image/jpeg,image/jpg,image/png',
      acceptedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png'],
      acceptedExtensions: ['jpg', 'jpeg', 'png'],
      requiredWidth: 300,
      requiredHeight: 300,
      minWidth: null,
      maxWidth: null,
      minHeight: null,
      maxHeight: null,
      maxSizeBytes: 100 * 1024,
      minSizeBytes: null,
      requiredAspectRatio: 1,
      instructionText: '300 x 300 px, max 100 KB',
      websiteValidationMessages: [],
      requirementsDetected: true,
      requiresManualReview: false,
    };

    const validJpgBytes = ImageProcessor.dataUrlToUint8Array(makeSyntheticJpegDataUrl(40 * 1024));
    const jpgCheck = DocumentRequirementValidator.validateAgainstRequirements(
      {
        documentId: 'd1',
        documentType: 'photo',
        fileName: 'photo.jpg',
        mimeType: 'image/jpeg',
        fileSize: validJpgBytes.byteLength,
        width: 300,
        height: 300,
        createdAt: '',
      },
      photoReqs,
      validJpgBytes
    );
    expect(jpgCheck.isValid).toBe(true);

    // JPEG extension alias check
    const jpegCheck = DocumentRequirementValidator.validateAgainstRequirements(
      {
        documentId: 'd2',
        documentType: 'photo',
        fileName: 'photo.jpeg',
        mimeType: 'image/jpeg',
        fileSize: validJpgBytes.byteLength,
        width: 300,
        height: 300,
        createdAt: '',
      },
      photoReqs,
      validJpgBytes
    );
    expect(jpegCheck.isValid).toBe(true);

    // PNG valid check
    const validPngBytes = ImageProcessor.dataUrlToUint8Array(makeSyntheticPngDataUrl(30 * 1024));
    const pngCheck = DocumentRequirementValidator.validateAgainstRequirements(
      {
        documentId: 'd3',
        documentType: 'photo',
        fileName: 'sig.png',
        mimeType: 'image/png',
        fileSize: validPngBytes.byteLength,
        width: 300,
        height: 300,
        createdAt: '',
      },
      photoReqs,
      validPngBytes
    );
    expect(pngCheck.isValid).toBe(true);

    // Incorrect file format (PDF inside JPG/PNG image field)
    const pdfBytes = ImageProcessor.dataUrlToUint8Array(makeSyntheticPdfDataUrl(20 * 1024));
    const pdfCheck = DocumentRequirementValidator.validateAgainstRequirements(
      {
        documentId: 'd4',
        documentType: 'photo',
        fileName: 'photo.pdf',
        mimeType: 'application/pdf',
        fileSize: pdfBytes.byteLength,
        width: 0,
        height: 0,
        createdAt: '',
      },
      photoReqs,
      pdfBytes
    );
    expect(pdfCheck.isValid).toBe(false);
    expect(pdfCheck.canAutoProcess).toBe(false);
    expect(pdfCheck.errors.some((e) => e.includes('Unsupported format'))).toBe(true);

    // Spoofed/corrupted binary bytes disguised as photo.jpg
    const disguisedPdf = ImageProcessor.dataUrlToUint8Array(makeSyntheticPdfDataUrl(15 * 1024));
    const spoofCheck = DocumentRequirementValidator.validateAgainstRequirements(
      {
        documentId: 'd5',
        documentType: 'photo',
        fileName: 'fake.jpg',
        mimeType: 'image/jpeg',
        fileSize: disguisedPdf.byteLength,
        width: 300,
        height: 300,
        createdAt: '',
      },
      photoReqs,
      disguisedPdf
    );
    expect(spoofCheck.isValid).toBe(false);
    expect(spoofCheck.detectedMagicMime).toBe('application/pdf');
    expect(spoofCheck.canAutoProcess).toBe(false);

    // Oversized image (> 100 KB)
    const oversizedBytes = ImageProcessor.dataUrlToUint8Array(makeSyntheticJpegDataUrl(150 * 1024));
    const oversizedCheck = DocumentRequirementValidator.validateAgainstRequirements(
      {
        documentId: 'd6',
        documentType: 'photo',
        fileName: 'big.jpg',
        mimeType: 'image/jpeg',
        fileSize: oversizedBytes.byteLength,
        width: 300,
        height: 300,
        createdAt: '',
      },
      photoReqs,
      oversizedBytes
    );
    expect(oversizedCheck.isValid).toBe(false);
    expect(oversizedCheck.canAutoProcess).toBe(true);
    expect(oversizedCheck.errors.some((e) => e.includes('exceeds website maximum limit'))).toBe(true);

    // Incorrect dimensions (400 x 200 instead of 300 x 300)
    const badDimCheck = DocumentRequirementValidator.validateAgainstRequirements(
      {
        documentId: 'd7',
        documentType: 'photo',
        fileName: 'wide.jpg',
        mimeType: 'image/jpeg',
        fileSize: validJpgBytes.byteLength,
        width: 400,
        height: 200,
        createdAt: '',
      },
      photoReqs,
      validJpgBytes
    );
    expect(badDimCheck.isValid).toBe(false);
    expect(badDimCheck.canAutoProcess).toBe(true);
    expect(badDimCheck.errors.some((e) => e.includes('300 × 300 px'))).toBe(true);
  });

  it('4. Handles missing photograph, missing signature, and duplicate file fields safely without auto-approval', async () => {
    document.body.innerHTML = `
      <form>
        <label for="p1">Applicant Photo</label>
        <input type="file" id="p1" name="photo_primary" accept="image/jpeg" />

        <label for="p2">Candidate Photo</label>
        <input type="file" id="p2" name="photo_dup" accept="image/jpeg" />

        <label for="s1">Applicant Signature</label>
        <input type="file" id="s1" name="signature" accept="image/jpeg" />
      </form>
    `;

    // Save only photo (Signature is MISSING)
    await DocumentRepository.saveDocument({
      profileId: 'prof_missing_test',
      documentType: 'photo',
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      fileSize: 20 * 1024,
      width: 300,
      height: 300,
      dataUrl: makeSyntheticJpegDataUrl(20 * 1024),
    });

    const plan = await DocumentUploadCoordinator.buildApprovalPlan(document, (t) =>
      DocumentRepository.getByCategory('prof_missing_test', t, false)
    );

    expect(plan.length).toBe(3);

    // Duplicate Photo inputs flagged ambiguous and NOT auto-approved
    expect(plan[0].field.isDuplicate).toBe(true);
    expect(plan[0].isApproved).toBe(false);
    expect(plan[1].field.isDuplicate).toBe(true);
    expect(plan[1].isApproved).toBe(false);

    // Missing Signature
    expect(plan[2].documentType).toBe('signature');
    expect(plan[2].status).toBe('Missing Document');
    expect(plan[2].isApproved).toBe(false);
  });

  it('5. Never uploads without user approval and attaches approved BOGMC Photo & Signature via DataTransfer', async () => {
    const htmlPath = path.resolve(__dirname, '../../test-pages/petrobangla-form.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');
    document.documentElement.innerHTML = html;

    const profileId = 'prof_bogmc_upload';
    const photoUrl = makeSyntheticJpegDataUrl(35 * 1024); // 35 KB
    const sigUrl = makeSyntheticPngDataUrl(18 * 1024); // 18 KB

    await DocumentRepository.saveDocument({
      profileId,
      documentType: 'photo',
      fileName: 'synthetic_photo_300x300.jpg',
      mimeType: 'image/jpeg',
      fileSize: 35 * 1024,
      width: 300,
      height: 300,
      dataUrl: photoUrl,
    });

    await DocumentRepository.saveDocument({
      profileId,
      documentType: 'signature',
      fileName: 'synthetic_sig_300x80.png',
      mimeType: 'image/png',
      fileSize: 18 * 1024,
      width: 300,
      height: 80,
      dataUrl: sigUrl,
    });

    const plan = await DocumentUploadCoordinator.buildApprovalPlan(document, (t) =>
      DocumentRepository.getByCategory(profileId, t, false)
    );

    expect(plan.length).toBe(2);
    expect(plan[0].documentType).toBe('photo');
    expect(plan[1].documentType).toBe('signature');

    // Simulate user skipping signature and approving ONLY photo first
    plan[0].isApproved = true;
    plan[1].isApproved = false;

    const firstPassResults = await DocumentUploadCoordinator.executeApprovedUploads(plan);
    expect(firstPassResults[0].status).toBe('Uploaded');
    expect(firstPassResults[0].fileAttached).toBe(true);
    expect(firstPassResults[1].status).toBe('Skipped');
    expect((document.getElementById('signature') as HTMLInputElement).files?.length || 0).toBe(0);

    // Now approve Signature as well (with BOGMC preview script handler simulated)
    const sigInput = document.getElementById('signature') as HTMLInputElement;
    const sigPreview = document.getElementById('sig_preview') as HTMLImageElement;
    sigInput.addEventListener('change', () => {
      if (sigInput.files && sigInput.files.length > 0) {
        sigPreview.src = sigUrl;
        sigPreview.style.display = 'inline-block';
      }
    });

    plan[1].isApproved = true;
    const secondPassResults = await DocumentUploadCoordinator.executeApprovedUploads(plan);

    const photoInput = document.getElementById('photo') as HTMLInputElement;
    expect(photoInput.files?.length).toBe(1);
    expect(photoInput.files?.[0].name).toBe('synthetic_photo_300x300.jpg');
    expect(sigInput.files?.length).toBe(1);
    expect(sigInput.files?.[0].name).toBe('synthetic_sig_300x80.png');
    expect(secondPassResults[1].status).toBe('Uploaded');
    expect(secondPassResults[1].previewObserved).toBe(true);
  });

  it('6. Works with React file inputs (_valueTracker) and detects website validation errors honestly', async () => {
    document.body.innerHTML = `
      <div class="upload-box">
        <label for="react_photo">Applicant Photograph</label>
        <input type="file" id="react_photo" name="photo" accept="image/jpeg" />
        <small>300 x 300 pixel, max 100 KB</small>
        <div id="photo_error"></div>
      </div>
    `;

    const fileInput = document.getElementById('react_photo') as HTMLInputElement;
    let trackerResetCalled = false;
    (fileInput as any)._valueTracker = {
      setValue: () => {
        trackerResetCalled = true;
      },
    };

    let reactOnChangeTriggered = false;
    fileInput.addEventListener('change', () => {
      reactOnChangeTriggered = true;
    });

    const fields = DocumentFieldDetector.scanDocumentFields(document);
    const res = await DocumentUploader.attachApprovedDocument(fields[0], {
      documentId: 'r1',
      documentType: 'photo',
      selector: '#react_photo',
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      fileSize: 20 * 1024,
      width: 300,
      height: 300,
      dataUrl: makeSyntheticJpegDataUrl(20 * 1024),
    });

    expect(trackerResetCalled).toBe(true);
    expect(reactOnChangeTriggered).toBe(true);
    expect(res.status).toBe('Uploaded');

    // Now test website displaying validation error upon change
    fileInput.addEventListener('change', () => {
      const errDiv = document.getElementById('photo_error')!;
      errDiv.textContent = 'Invalid image dimensions rejected by server rule';
    });

    const resErr = await DocumentUploader.attachApprovedDocument(fields[0], {
      documentId: 'r2',
      documentType: 'photo',
      selector: '#react_photo',
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      fileSize: 20 * 1024,
      width: 300,
      height: 300,
      dataUrl: makeSyntheticJpegDataUrl(20 * 1024),
    });

    expect(resErr.status).toBe('Validation Failed');
    expect(resErr.websiteValidationError).toContain('Invalid image dimensions');
    expect(resErr.requiresManualFallback).toBe(true);
  });

  it('7. Never falsely reports Uploaded when browser/script blocks DataTransfer (Manual Upload Required fallback)', async () => {
    document.body.innerHTML = `
      <div>
        <label for="blocked_photo">Applicant Photo</label>
        <input type="file" id="blocked_photo" name="photo" />
      </div>
    `;

    const fileInput = document.getElementById('blocked_photo') as HTMLInputElement;
    // Simulate locked/read-only FileList property rejecting programmatic DataTransfer assignment
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      get: () => ({ length: 0, item: () => null } as unknown as FileList),
      set: () => {
        throw new Error('SecurityError: Assignment to FileList blocked');
      },
    });

    const fields = DocumentFieldDetector.scanDocumentFields(document);
    const res = await DocumentUploader.attachApprovedDocument(fields[0], {
      documentId: 'b1',
      documentType: 'photo',
      selector: '#blocked_photo',
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      fileSize: 20 * 1024,
      width: 300,
      height: 300,
      dataUrl: makeSyntheticJpegDataUrl(20 * 1024),
    });

    expect(res.status).toBe('Manual Upload Required');
    expect(res.fileAttached).toBe(false);
    expect(res.requiresManualFallback).toBe(true);

    // Also verify graceful Manual Upload Required when DataTransfer constructor is unavailable
    const savedDT = (globalThis as any).DataTransfer;
    delete (globalThis as any).DataTransfer;
    document.body.innerHTML = `<input type="file" id="no_dt_photo" name="photo" />`;
    const fieldsNoDt = DocumentFieldDetector.scanDocumentFields(document);
    const resNoDt = await DocumentUploader.attachApprovedDocument(fieldsNoDt[0], {
      documentId: 'b2',
      documentType: 'photo',
      selector: '#no_dt_photo',
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      fileSize: 20 * 1024,
      width: 300,
      height: 300,
      dataUrl: makeSyntheticJpegDataUrl(20 * 1024),
    });
    (globalThis as any).DataTransfer = savedDT;
    expect(resNoDt.status).toBe('Manual Upload Required');
    expect(resNoDt.fileAttached).toBe(false);
  });

  it('8. Enforces Vault Lock and URL authorization for document transfer security', async () => {
    // 1. Restricted URL denied by MessageRouter
    const deniedResponse = await new Promise<any>((resolve) => {
      MessageRouter.handleMessage(
        {
          action: 'GET_APPROVED_DOCUMENT_PAYLOAD',
          payload: {
            profileId: 'p1',
            approvedTypes: ['photo'],
            url: 'chrome://settings',
          },
        },
        { tab: { url: 'chrome://settings' } as any },
        resolve
      );
    });
    expect(deniedResponse.status).toBe('denied');

    // 2. Vault locked refuses decryption
    await VaultManager.setPassword('SecretPass123!', 15);
    VaultManager.lock();
    KeyManager.clearKey();

    await expect(
      DocumentRepository.saveDocument({
        profileId: 'p_locked',
        documentType: 'photo',
        fileName: 'p.jpg',
        mimeType: 'image/jpeg',
        fileSize: 1024,
        width: 300,
        height: 300,
        dataUrl: makeSyntheticJpegDataUrl(1024),
      })
    ).rejects.toThrow('VAULT_LOCKED');

    // Unlock vault and verify save + read works cleanly
    const unlocked = await VaultManager.unlock('SecretPass123!');
    expect(unlocked).toBe(true);
    const meta = await DocumentRepository.saveDocument({
      profileId: 'p_locked',
      documentType: 'photo',
      fileName: 'p.jpg',
      mimeType: 'image/jpeg',
      fileSize: 1024,
      width: 300,
      height: 300,
      dataUrl: makeSyntheticJpegDataUrl(1024),
    });
    expect(meta.documentType).toBe('photo');
  });

  it('9. Generates separate resized copy for oversized/non-conforming image without overwriting saved original', async () => {
    document.body.innerHTML = `
      <form>
        <label for="bogmc_photo">Applicant Photograph</label>
        <input type="file" id="bogmc_photo" name="photo" accept="image/jpeg" />
        <small>Photo must be 300 x 300 pixel and not more than 100 KB</small>
      </form>
    `;

    const profileId = 'prof_resize_test';
    const oversizedOrigUrl = makeSyntheticJpegDataUrl(180 * 1024); // 180 KB, 800x800
    await DocumentRepository.saveDocument({
      id: 'orig_photo_keep',
      profileId,
      documentType: 'photo',
      fileName: 'studio_highres.jpg',
      mimeType: 'image/jpeg',
      fileSize: 180 * 1024,
      width: 800,
      height: 800,
      dataUrl: oversizedOrigUrl,
    });

    const resizedCopyUrl = makeSyntheticJpegDataUrl(42 * 1024); // 42 KB, 300x300
    const spy = vi.spyOn(ImageProcessor, 'processAndFit').mockResolvedValueOnce({
      dataUrl: resizedCopyUrl,
      blob: new Blob([ImageProcessor.dataUrlToUint8Array(resizedCopyUrl) as any], { type: 'image/jpeg' }),
      width: 300,
      height: 300,
      fileSize: 42 * 1024,
      sizeKb: 42,
      format: 'image/jpeg',
    });

    const plan = await DocumentUploadCoordinator.buildApprovalPlan(document, (t) =>
      DocumentRepository.getByCategory(profileId, t, false)
    );

    expect(spy).toHaveBeenCalledOnce();
    expect(plan.length).toBe(1);
    expect(plan[0].validation?.isValid).toBe(false); // Original failed 800x800 & 180KB
    expect(plan[0].useProcessedCopy).toBe(true);
    expect(plan[0].processedCopy?.width).toBe(300);
    expect(plan[0].processedCopy?.height).toBe(300);
    expect(plan[0].processedCopy?.fileSize).toBe(42 * 1024);
    expect(plan[0].processedValidation?.isValid).toBe(true);
    expect(plan[0].isApproved).toBe(true);

    // Execute approved upload and confirm original saved document in vault stayed 800x800 & 180KB
    const uploadResults = await DocumentUploadCoordinator.executeApprovedUploads(plan);
    expect(uploadResults[0].status).toBe('Uploaded');
    expect(uploadResults[0].fileName).toBe('studio_highres_300x300.jpg');

    const storedOriginalAfter = await DocumentRepository.getByCategory(profileId, 'photo', false);
    expect(storedOriginalAfter?.metadata.width).toBe(800);
    expect(storedOriginalAfter?.metadata.fileSize).toBe(180 * 1024);

    spy.mockRestore();
  });

  it('10. Migrates legacy profile documents safely to active real profile without overwriting or bypassing Vault Lock', async () => {
    const legacyPhotoUrl = makeSyntheticJpegDataUrl(22 * 1024);
    const legacySigUrl = makeSyntheticPngDataUrl(12 * 1024);

    await DocumentRepository.saveDocument({
      id: 'photo_profile_sample_demo_original',
      profileId: 'profile_sample_demo',
      documentType: 'photo',
      fileName: 'legacy_photo.jpg',
      mimeType: 'image/jpeg',
      fileSize: 22 * 1024,
      width: 300,
      height: 300,
      dataUrl: legacyPhotoUrl,
    });
    await DocumentRepository.saveDocument({
      id: 'sig_profile_sample_demo_original',
      profileId: 'profile_sample_demo',
      documentType: 'signature',
      fileName: 'legacy_sig.png',
      mimeType: 'image/png',
      fileSize: 12 * 1024,
      width: 300,
      height: 80,
      dataUrl: legacySigUrl,
    });

    const migratedCount = await DocumentRepository.migrateMissingDocumentsToProfile(
      'profile_synthetic_test',
      ['profile_sample_demo']
    );
    expect(migratedCount).toBe(2);

    const realPhoto = await DocumentRepository.getByCategory('profile_synthetic_test', 'photo', false);
    const realSig = await DocumentRepository.getByCategory('profile_synthetic_test', 'signature', false);
    expect(realPhoto?.metadata.fileName).toBe('legacy_photo.jpg');
    expect(realSig?.metadata.fileName).toBe('legacy_sig.png');

    // Second run must be a no-op and never overwrite newer custom photo
    const customUrl = makeSyntheticJpegDataUrl(25 * 1024);
    await DocumentRepository.saveDocument({
      id: 'photo_profile_synthetic_test_original',
      profileId: 'profile_synthetic_test',
      documentType: 'photo',
      fileName: 'updated_synthetic.jpg',
      mimeType: 'image/jpeg',
      fileSize: 25 * 1024,
      width: 300,
      height: 300,
      dataUrl: customUrl,
    });
    const noopCount = await DocumentRepository.migrateMissingDocumentsToProfile(
      'profile_synthetic_test',
      ['profile_sample_demo']
    );
    expect(noopCount).toBe(0);
    const afterRealPhoto = await DocumentRepository.getByCategory('profile_synthetic_test', 'photo', false);
    expect(afterRealPhoto?.metadata.fileName).toBe('updated_synthetic.jpg');
  });

  it('11. Supports SAVE_PROFILE_DOCUMENT security checks and distinguishes Vault Locked from Missing Document', async () => {
    // Reject restricted URL in SAVE_PROFILE_DOCUMENT
    const deniedSave = await new Promise<any>((resolve) => {
      MessageRouter.handleMessage(
        {
          action: 'SAVE_PROFILE_DOCUMENT',
          payload: {
            profileId: 'profile_synthetic_test',
            documentType: 'photo',
            fileName: 'p.jpg',
            mimeType: 'image/jpeg',
            fileSize: 1024,
            width: 300,
            height: 300,
            dataUrl: makeSyntheticJpegDataUrl(1024),
            url: 'chrome://extensions',
          },
        },
        { tab: { url: 'chrome://extensions' } as any },
        resolve
      );
    });
    expect(deniedSave.status).toBe('denied');

    // Save photo securely via SAVE_PROFILE_DOCUMENT on authorized recruitment URL
    const okSave = await new Promise<any>((resolve) => {
      MessageRouter.handleMessage(
        {
          action: 'SAVE_PROFILE_DOCUMENT',
          payload: {
            profileId: 'profile_synthetic_test',
            documentType: 'photo',
            fileName: 'direct_pick.jpg',
            mimeType: 'image/jpeg',
            fileSize: 2048,
            width: 300,
            height: 300,
            dataUrl: makeSyntheticJpegDataUrl(2048),
            url: 'http://bogmc.teletalk.com.bd/apply.php',
          },
        },
        { tab: { url: 'http://bogmc.teletalk.com.bd/apply.php' } as any },
        resolve
      );
    });
    expect(okSave.status).toBe('ok');
    expect(okSave.metadata?.documentId).toBe('photo_profile_synthetic_test_original');

    // Build approval plan when Vault throws VAULT_LOCKED -> clear lock message instead of Missing Document
    document.body.innerHTML = `
      <form>
        <label for="p_lock">Applicant Photo</label>
        <input type="file" id="p_lock" name="photo" accept="image/jpeg" />
      </form>
    `;
    const lockedPlan = await DocumentUploadCoordinator.buildApprovalPlan(document, async () => {
      throw new Error('VAULT_LOCKED: Unlock vault password before accessing encrypted documents.');
    });
    expect(lockedPlan.length).toBe(1);
    expect(lockedPlan[0].status).toBe('Manual Upload Required');
    expect(lockedPlan[0].statusMessage).toContain('Vault Locked');
    expect(lockedPlan[0].isApproved).toBe(false);
  });
});
