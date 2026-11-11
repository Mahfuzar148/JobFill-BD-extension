import { describe, it, expect, beforeEach } from 'vitest';
import { VerificationEngine } from '../../src/validation/verification-engine';
import { PageScanner } from '../../src/content/page-scanner';
import { sampleDemoProfile, createEmptyProfile } from '../../src/types/defaults';
import {
  enableVaultEncryption,
  disableVaultEncryption,
  unlockVault,
  lockVault,
  getAllProfiles,
  saveActiveProfile,
  setActiveProfileId,
  getActiveProfile,
  deleteProfile,
} from '../../src/services/storage';
import { DocumentRepository } from '../../src/database/document-repository';
import { DynamicDomObserver } from '../../src/content/dom-observer';
import { ImageProcessor } from '../../src/services/image-processor';

function makeTinyJpg(): string {
  const b = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);
  return ImageProcessor.uint8ArrayToDataUrl(b, 'image/jpeg');
}

describe('JobFill BD - Autonomous QA Audit & Regression Suite', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = '';
    localStorage.clear();
    DocumentRepository.clearVolatileTestStore();
    lockVault();
  });

  it('1. Undo preserves user edits made manually after autofill while reverting untouched fields', async () => {
    document.body.innerHTML = `
      <form>
        <div class="section">
          <label for="applicant_name">Applicant's Name</label>
          <input type="text" id="applicant_name" name="applicant_name" />
          <label for="mobile">Mobile Number</label>
          <input type="text" id="mobile" name="mobile" />
        </div>
      </form>
    `;

    const scan = await PageScanner.scanPage(sampleDemoProfile);
    const items = scan.planItems.filter((i) => i.isApproved);
    expect(items.length).toBe(2);

    const sessionId = 'qa_undo_preserve';
    await VerificationEngine.executePlan(sessionId, items);

    const nameEl = document.getElementById('applicant_name') as HTMLInputElement;
    const mobileEl = document.getElementById('mobile') as HTMLInputElement;
    expect(nameEl.value).toBe('MD. HASAN MAHMUD');
    expect(mobileEl.value).toBe('01712345678');

    // User manually edits mobile AFTER autofill
    mobileEl.value = '01999887766';

    const undoResult = VerificationEngine.undoLastFill(sessionId, true);
    expect(undoResult.restoredCount).toBe(1);
    expect(undoResult.preservedCount).toBe(1);

    // Applicant name reverted to '', Mobile preserved user's manual change!
    expect(nameEl.value).toBe('');
    expect(mobileEl.value).toBe('01999887766');
  });

  it('2. Synchronizes encrypted Vault unlock/lock cleanly between profile storage and DocumentRepository', async () => {
    await enableVaultEncryption('MasterQA#2026');

    // Lock vault
    lockVault();
    await expect(getAllProfiles()).rejects.toThrow('VAULT_LOCKED');
    await expect(
      DocumentRepository.saveDocument({
        profileId: sampleDemoProfile.id,
        documentType: 'photo',
        fileName: 'blocked.jpg',
        mimeType: 'image/jpeg',
        fileSize: 8,
        width: 300,
        height: 300,
        dataUrl: makeTinyJpg(),
      })
    ).rejects.toThrow('VAULT_LOCKED');

    // Unlock vault -> both profile storage & encrypted DocumentRepository succeed
    const ok = await unlockVault('MasterQA#2026');
    expect(ok).toBe(true);

    const profiles = await getAllProfiles();
    expect(profiles.length).toBeGreaterThan(0);

    const meta = await DocumentRepository.saveDocument({
      profileId: profiles[0].id,
      documentType: 'photo',
      fileName: 'unlocked.jpg',
      mimeType: 'image/jpeg',
      fileSize: 8,
      width: 300,
      height: 300,
      dataUrl: makeTinyJpg(),
    });
    expect(meta.fileName).toBe('unlocked.jpg');
  });

  it('3. Supports full multi-profile CRUD, switching, persistence, and missing profile field safety', async () => {
    const p1 = { ...sampleDemoProfile, id: 'p_alpha', profileName: 'Alpha' };
    const p2 = createEmptyProfile('Beta Missing');
    p2.id = 'p_beta';
    p2.personal.applicantNameEn = 'BETA CANDIDATE';

    await saveActiveProfile(p1);
    await saveActiveProfile(p2);

    // Switch back to p1
    await setActiveProfileId('p_alpha');
    const active1 = await getActiveProfile();
    expect(active1.id).toBe('p_alpha');

    // Switch to p2 (which has mostly empty fields) and verify scanner marks missing fields accurately
    await setActiveProfileId('p_beta');
    const active2 = await getActiveProfile();
    expect(active2.id).toBe('p_beta');

    document.body.innerHTML = `
      <form>
        <label for="applicant_name">Applicant's Name</label>
        <input type="text" id="applicant_name" name="applicant_name" />
        <label for="email">Email Address</label>
        <input type="email" id="email" name="email" />
      </form>
    `;
    const scanBeta = await PageScanner.scanPage(active2);
    const nameItem = scanBeta.planItems.find((i) => i.selector === '#applicant_name');
    const emailItem = scanBeta.planItems.find((i) => i.selector === '#email');
    expect(nameItem?.status).toBe('Matched');
    expect(nameItem?.proposedValue).toBe('BETA CANDIDATE');
    expect(emailItem?.status).toBe('Missing Profile Information');
    expect(emailItem?.isApproved).toBe(false);

    // Delete p2 cleanly falls back to p1
    await deleteProfile('p_beta');
    const remaining = await getAllProfiles();
    expect(remaining.some((p) => p.id === 'p_beta')).toBe(false);
    expect(remaining.some((p) => p.id === 'p_alpha')).toBe(true);
  });

  it('4. DynamicDomObserver starts, stops, and cleans up intervals cleanly without leaks', () => {
    let called = false;
    const stopMonitor = DynamicDomObserver.monitorMultiStepChanges(() => {
      called = true;
    });
    expect(typeof stopMonitor).toBe('function');
    DynamicDomObserver.startObserving(() => {});
    DynamicDomObserver.stopObserving();
    stopMonitor();
    expect(called).toBe(false);
  });

  it('5. Legal declaration checkboxes and submit controls are strictly excluded from automation', async () => {
    document.body.innerHTML = `
      <form>
        <label for="applicant_name">Applicant's Name</label>
        <input type="text" id="applicant_name" name="applicant_name" />
        <label><input type="checkbox" id="declare_terms" name="declaration" /> I declare that all information provided is true</label>
        <input type="submit" id="btn_submit" value="Submit Application" />
      </form>
    `;

    const scan = await PageScanner.scanPage(sampleDemoProfile);
    const decl = scan.planItems.find((i) => i.selector === '#declare_terms');
    const submit = scan.planItems.find((i) => i.selector === '#btn_submit');

    expect(decl?.isApproved).toBe(false);
    expect(decl?.status).toBe('Unsupported Field');
    expect(submit).toBeUndefined(); // Strictly excluded!

    const report = await VerificationEngine.executePlan('legal_guard_test', scan.planItems.filter((i) => i.isApproved));
    expect(report.successfullyFilled).toBe(1);
    expect((document.getElementById('declare_terms') as HTMLInputElement).checked).toBe(false);
  });

  it('6. Prevents "upazila" vs "zila" word collision, rejects type-only checkbox mappings, and excludes JobFill UI inputs', async () => {
    document.body.innerHTML = `
      <form>
        <div class="section-title">4. Present Address - Dependent Cascading Dropdowns</div>
        <div class="present-address-box">
          <div class="form-group">
            <label for="present_upazila">Present Upazila / Thana</label>
            <select id="present_upazila" name="present_upazila">
              <option value="">Select Upazila</option>
              <option value="mohammadpur">Mohammadpur</option>
            </select>
          </div>
          <label><input type="checkbox" id="random_newsletter" name="newsletter" /> Subscribe updates</label>
        </div>
      </form>
      <div id="jobfill-review-modal" data-jobfill-ext="true">
        <input type="checkbox" id="jobfill-replace-toggle" />
      </div>
    `;

    const scan = await PageScanner.scanPage(sampleDemoProfile);
    const upazilaItem = scan.planItems.find((i) => i.selector === '#present_upazila');
    const newsletterItem = scan.planItems.find((i) => i.selector === '#random_newsletter');
    const internalItem = scan.planItems.find((i) => i.selector === '#jobfill-replace-toggle');

    expect(scan.ambiguousCount).toBe(0);
    expect(upazilaItem?.canonicalId).toBe('address.present.upazila');
    expect(upazilaItem?.status).toBe('Matched');
    expect(newsletterItem?.canonicalId).toBe('unknown');
    expect(newsletterItem?.status).toBe('Unsupported Field');
    expect(internalItem).toBeUndefined();
  });

  it('7. Re-encrypts pre-existing documents across Vault enable -> lock -> unlock -> disable transitions without data loss', async () => {
    // 1. Save a document BEFORE setting any Master Password (uses local device wrapping key)
    const jpgUrl = makeTinyJpg();
    const meta = await DocumentRepository.saveDocument({
      profileId: sampleDemoProfile.id,
      documentType: 'photo',
      fileName: 'pre_vault_photo.jpg',
      mimeType: 'image/jpeg',
      fileSize: 8,
      width: 300,
      height: 300,
      dataUrl: jpgUrl,
    });

    // 2. Enable Master Vault Password -> pre-existing doc must re-encrypt cleanly
    await enableVaultEncryption('VaultPass#2026');
    lockVault();
    await expect(DocumentRepository.getDocumentById(meta.documentId)).rejects.toThrow('VAULT_LOCKED');

    // 3. Unlock -> doc decrypts cleanly under new master key
    expect(await unlockVault('VaultPass#2026')).toBe(true);
    const decryptedAfterEnable = await DocumentRepository.getDocumentById(meta.documentId);
    expect(decryptedAfterEnable?.dataUrl).toBe(jpgUrl);

    // 4. Disable Master Vault Password -> doc re-encrypts back to local device key cleanly
    await disableVaultEncryption('VaultPass#2026');
    const decryptedAfterDisable = await DocumentRepository.getDocumentById(meta.documentId);
    expect(decryptedAfterDisable?.dataUrl).toBe(jpgUrl);
  });
});
