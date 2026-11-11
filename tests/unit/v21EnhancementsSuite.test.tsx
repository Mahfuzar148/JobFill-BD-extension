import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  DocumentRequirementValidator,
  inferDocumentMimeType,
} from '../../src/documents/document-requirement-validator';
import { DocumentFieldDetector } from '../../src/documents/document-field-detector';
import { isDevExtensionTestPageUrl, isExcludedSiteUrl } from '../../src/security/site-policy';
import { searchProfileFields } from '../../src/dashboard/data/field-search-index';
import {
  calculateAgeOnCutoffDate,
  parseFlexibleDateString,
} from '../../src/jobs/services/eligibility-helper';
import { ImageProcessor } from '../../src/services/image-processor';
import { MappingRepository } from '../../src/database/mapping-repository';
import {
  resolveSiteAdapter,
  BangladeshBankAdapter,
  AtsPortalAdapter,
} from '../../src/adapters/adapter-registry';
import { buildPrintableBioDataHtml } from '../../src/dashboard/components/BioDataPrintModal';
import { sampleDemoProfile } from '../../src/types/defaults';
import { DocumentUploader } from '../../src/documents/document-uploader';
import { ApplicationRepository } from '../../src/jobs/database/application-repository';
import { JobAlarmManager, ALARM_FEE_CHECK_PREFIX } from '../../src/jobs/background/alarm-manager';

describe('JobFill BD v2.1 Enhancements Suite', () => {
  const originalChrome = (globalThis as any).chrome;
  const originalDataTransfer = (globalThis as any).DataTransfer;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    (globalThis as any).chrome = originalChrome;
    (globalThis as any).DataTransfer = originalDataTransfer;
    vi.restoreAllMocks();
  });

  describe('P0: Document CV Support, Extension Deduplication & Modal CSS Isolation', () => {
    it('infers Office/PDF/Text MIME types reliably from filenames when raw MIME is empty or generic', () => {
      expect(inferDocumentMimeType('resume.pdf', '')).toBe('application/pdf');
      expect(inferDocumentMimeType('cv.docx', 'application/octet-stream')).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      expect(inferDocumentMimeType('cv.doc', '')).toBe('application/msword');
      expect(inferDocumentMimeType('notes.rtf', '')).toBe('application/rtf');
      expect(inferDocumentMimeType('cover.txt', '')).toBe('text/plain');
      expect(inferDocumentMimeType('pic.png', 'image/png')).toBe('image/png');
    });

    it('detects magic bytes for DOCX/PK ZIP, DOC/OLE2, and RTF files', () => {
      expect(DocumentRequirementValidator.detectMagicMime(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe(
        'application/zip'
      );
      expect(
        DocumentRequirementValidator.detectMagicMime(
          new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
        )
      ).toBe('application/msword');
      expect(
        DocumentRequirementValidator.detectMagicMime(new Uint8Array([0x7b, 0x5c, 0x72, 0x74, 0x66]))
      ).toBe('application/rtf');
    });

    it('deduplicates accepted extensions (fixes PDF/PDF duplicate) and detects CV file inputs', () => {
      document.body.innerHTML = `
        <form>
          <label for="cv_upload">Upload CV / Resume</label>
          <input type="file" id="cv_upload" name="resume_file" accept=".pdf,application/pdf,.doc,.docx,application/pdf" />
        </form>
      `;
      const fields = DocumentFieldDetector.scanDocumentFields(document);
      expect(fields).toHaveLength(1);
      expect(fields[0].documentType).toBe('cv');
      expect(fields[0].requirements.acceptedExtensions).toEqual(['pdf', 'doc', 'docx']);
      const pdfOccurrences = fields[0].requirements.acceptedExtensions.filter((e) => e === 'pdf');
      expect(pdfOccurrences).toHaveLength(1);
    });

    it('attaches direct CV/PDF document cleanly to unknown or cv file input via DataTransfer', async () => {
      class MockFileList extends Array<File> {
        item(index: number) {
          return this[index] || null;
        }
      }
      (globalThis as any).DataTransfer = class {
        private _files = new MockFileList();
        public items = { add: (file: File) => this._files.push(file) };
        get files(): FileList {
          return this._files as unknown as FileList;
        }
      };
      const origFilesDesc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files');
      const fileMap = new WeakMap<HTMLInputElement, FileList>();
      Object.defineProperty(HTMLInputElement.prototype, 'files', {
        configurable: true,
        get() {
          return fileMap.get(this) || (origFilesDesc?.get ? origFilesDesc.get.call(this) : ({ length: 0, item: () => null } as any));
        },
        set(val: FileList) {
          fileMap.set(this, val);
        },
      });

      try {
        document.body.innerHTML = `
          <form>
            <label for="unknown_doc">Upload Document</label>
            <input type="file" id="unknown_doc" name="attachment" />
          </form>
        `;
        const fields = DocumentFieldDetector.scanDocumentFields(document);
        expect(fields).toHaveLength(1);
        const pdfBytes = '%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF';
        const dataUrl = `data:application/pdf;base64,${btoa(pdfBytes)}`;
        const res = await DocumentUploader.attachApprovedDocument(fields[0], {
          documentId: 'direct_cv_1',
          documentType: 'cv',
          selector: fields[0].selector,
          fileName: 'resume.pdf',
          mimeType: 'application/pdf',
          fileSize: pdfBytes.length,
          width: 0,
          height: 0,
          dataUrl,
        });
        expect(res.status).toBe('Uploaded');
        expect(res.fileAttached).toBe(true);
        expect((fields[0].element as HTMLInputElement).files?.[0]?.name).toBe('resume.pdf');
      } finally {
        if (origFilesDesc) {
          Object.defineProperty(HTMLInputElement.prototype, 'files', origFilesDesc);
        }
      }
    });
    it('contains explicit host-CSS line-height & layout isolation in content.css for document modal', () => {
      const css = fs.readFileSync(path.resolve(__dirname, '../../src/content/content.css'), 'utf8');
      expect(css).toContain('#jobfill-doc-modal-backdrop *');
      expect(css).toContain('line-height: 1.45 !important');
      expect(css).toContain('.jobfill-doc-card');
      expect(css).toContain('.jobfill-doc-meta');
    });
  });

  describe('P0: Dev-Only Mock Form URL Handling & Header Quick-Jump Search', () => {
    it('allows own extension /test-pages/ URLs only when storeClean flag is off and runtime matches', () => {
      (globalThis as any).chrome = {
        runtime: { id: 'ext_test_12345' },
      };

      expect(isDevExtensionTestPageUrl('chrome-extension://ext_test_12345/test-pages/petrobangla-form.html')).toBe(
        true
      );
      expect(isExcludedSiteUrl('chrome-extension://ext_test_12345/test-pages/petrobangla-form.html')).toBe(false);

      // Different extension ID or non-test-pages internal URLs remain strictly excluded
      expect(isExcludedSiteUrl('chrome-extension://other_ext/test-pages/petrobangla-form.html')).toBe(true);
      expect(isExcludedSiteUrl('chrome-extension://ext_test_12345/dashboard.html')).toBe(true);
      expect(isExcludedSiteUrl('chrome://settings')).toBe(true);
      expect(isExcludedSiteUrl('https://meet.google.com/abc-defg-hij')).toBe(true);
    });

    it('ranks and jumps cleanly across bilingual English & Bangla profile field search queries', () => {
      const nidMatches = searchProfileFields('NID');
      expect(nidMatches[0]?.id).toBe('personal.nationalId');
      expect(nidMatches[0]?.tab).toBe('personal');

      const photoMatches = searchProfileFields('signature');
      expect(photoMatches.some((m) => m.tab === 'documents')).toBe(true);

      const trackerMatches = searchProfileFields('teletalk');
      expect(trackerMatches.some((m) => m.tab === 'tracker')).toBe(true);

      const banglaMatches = searchProfileFields('এনআইডি');
      expect(banglaMatches[0]?.tab).toBe('personal');

      expect(searchProfileFields('   ')).toEqual([]);
    });
  });

  describe('P1: Age-on-Circular-Cutoff Calculator, Teletalk Tracker & Image Cleaner', () => {
    it('parses flexible dates and computes exact age on circular cutoff date accurately', () => {
      expect(parseFlexibleDateString('15/08/1996')).toEqual({ year: 1996, month: 8, day: 15 });
      expect(parseFlexibleDateString('2026-11-11')).toEqual({ year: 2026, month: 11, day: 11 });

      const eligible29 = calculateAgeOnCutoffDate('1998-06-15', '2026-11-10');
      expect(eligible29.isValid).toBe(true);
      expect(eligible29.years).toBe(28);
      expect(eligible29.months).toBe(4);
      expect(eligible29.days).toBe(26);
      expect(eligible29.status).toBe('eligible');

      const limit32 = calculateAgeOnCutoffDate('1995-03-01', '2026-11-10');
      expect(limit32.status).toBe('eligible_32_standard');

      const underage = calculateAgeOnCutoffDate('2012-01-01', '2026-11-10');
      expect(underage.status).toBe('underage');
      expect(underage.underMinimum18).toBe(true);

      const overage = calculateAgeOnCutoffDate('1990-01-01', '2026-11-10');
      expect(overage.status).toBe('overage');
    });

    it('persists Teletalk User ID, Fee Deadline & schedules fee reminder alarms cleanly', async () => {
      const alarmsCreated: any[] = [];
      const alarmsCleared: string[] = [];
      (globalThis as any).chrome = {
        alarms: {
          create: vi.fn(async (name, info) => alarmsCreated.push({ name, info })),
          clear: vi.fn(async (name) => {
            alarmsCleared.push(name);
            return true;
          }),
          get: vi.fn(async () => undefined),
        },
      };

      const futureFeeDeadline = Date.now() + 72 * 3600 * 1000;
      const saved = await ApplicationRepository.setStatus(
        {
          id: 'job_petrobangla_1',
          jobTitle: 'Assistant Engineer',
          organization: 'Petrobangla',
          applicationUrl: 'https://bogmc.teletalk.com.bd',
          circularUrl: 'https://petrobangla.org.bd/circular.pdf',
          deadlineAt: Date.now() + 10 * 86400 * 1000,
        },
        'Applied',
        {
          teletalkUserId: 'PB2026XY',
          applicationRefId: 'REF-7788',
          feePaymentStatus: 'unpaid',
          feeDeadlineAt: futureFeeDeadline,
          examRoll: '901122',
          examVenue: 'Dhaka College',
        }
      );

      expect(saved.teletalkUserId).toBe('PB2026XY');
      expect(saved.feePaymentStatus).toBe('unpaid');
      expect(saved.examRoll).toBe('901122');

      // Ensure subsequent status update preserves Teletalk User ID and fee metadata
      const next = await ApplicationRepository.setStatus(
        {
          id: 'job_petrobangla_1',
          jobTitle: 'Assistant Engineer',
          organization: 'Petrobangla',
          applicationUrl: 'https://bogmc.teletalk.com.bd',
          circularUrl: 'https://petrobangla.org.bd/circular.pdf',
          deadlineAt: saved.deadlineAt,
        },
        'Exam Scheduled'
      );
      expect(next.teletalkUserId).toBe('PB2026XY');
      expect(next.feeDeadlineAt).toBe(futureFeeDeadline);

      await JobAlarmManager.scheduleFeePaymentReminder(saved);
      expect(alarmsCreated.some((a) => a.name === `${ALARM_FEE_CHECK_PREFIX}job_petrobangla_1`)).toBe(true);

      await JobAlarmManager.clearFeePaymentReminder('job_petrobangla_1');
      expect(alarmsCleared).toContain(`${ALARM_FEE_CHECK_PREFIX}job_petrobangla_1`);
    });

    it('cleans light grey paper background pixels to pure white while deepening dark signature ink', () => {
      const pixels = new Uint8ClampedArray([
        215, 218, 220, 255, // grey paper shadow -> should become 255, 255, 255
        20, 30, 80, 255, // blue/black ink stroke -> should stay dark / crisp
      ]);
      ImageProcessor.cleanSignaturePixels(pixels, 195);
      expect([pixels[0], pixels[1], pixels[2]]).toEqual([255, 255, 255]);
      expect(pixels[4]).toBeLessThanOrEqual(20);
      expect(pixels[5]).toBeLessThanOrEqual(30);
    });
  });

  describe('P1-P2: Mapping Deletion/Import, Bio-Data Sheet, Adapters & Shortcuts', () => {
    it('supports single mapping deletion and safe JSON import/export in MappingRepository', async () => {
      await MappingRepository.clear();
      await MappingRepository.importMappings([
        {
          fingerprintHash: 'fp_1',
          domain: 'teletalk.com.bd',
          canonicalKey: 'applicant.fullName.english',
          confirmationCount: 2,
          lastConfirmedAt: '2026-11-01T00:00:00.000Z',
          accuracyScore: 98,
        },
        {
          fingerprintHash: 'fp_2',
          domain: 'erecruitment.bb.org.bd',
          canonicalKey: 'identity.nationalId',
          confirmationCount: 1,
          lastConfirmedAt: '2026-11-02T00:00:00.000Z',
          accuracyScore: 95,
        },
      ]);

      let loaded = await MappingRepository.load();
      expect(loaded.size).toBe(2);

      const deleted = await MappingRepository.deleteMapping('fp_1');
      expect(deleted).toBe(true);
      loaded = await MappingRepository.load();
      expect(loaded.size).toBe(1);
      expect(loaded.has('fp_2')).toBe(true);
    });

    it('resolves specialized adapters for Bangladesh Bank and modern ATS career portals', () => {
      expect(resolveSiteAdapter('https://erecruitment.bb.org.bd/onlineapp/index.php', document).id).toBe(
        BangladeshBankAdapter.id
      );
      expect(resolveSiteAdapter('https://boards.greenhouse.io/company/jobs/123', document).id).toBe(
        AtsPortalAdapter.id
      );
      expect(resolveSiteAdapter('https://myworkdayjobs.com/en-US/Careers', document).id).toBe(
        AtsPortalAdapter.id
      );
    });

    it('generates XSS-escaped printable Applicant Bio-Data HTML cleanly offline', () => {
      const profile = structuredClone(sampleDemoProfile);
      profile.personal.applicantNameEn = 'Md. Hasan <script>alert(1)</script>';
      const html = buildPrintableBioDataHtml(profile, 'data:image/jpeg;base64,AAA', 'data:image/jpeg;base64,BBB');
      expect(html).toContain('Md. Hasan &lt;script&gt;alert(1)&lt;/script&gt;');
      expect(html).not.toContain('<script>alert(1)</script>');
      expect(html).toContain('Academic Qualifications');
      expect(html).toContain('data:image/jpeg;base64,AAA');
    });

    it('declares MV3 commands shortcuts cleanly in manifest.json without expanding permissions', () => {
      const manifest = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, '../../manifest.json'), 'utf8')
      );
      expect(manifest.commands['quick-autofill'].suggested_key.default).toBe('Alt+Shift+F');
      expect(manifest.commands['open-review-modal'].suggested_key.default).toBe('Alt+Shift+R');
      expect(manifest.permissions).toEqual([
        'storage',
        'activeTab',
        'scripting',
        'alarms',
        'notifications',
      ]);
    });
  });
});
