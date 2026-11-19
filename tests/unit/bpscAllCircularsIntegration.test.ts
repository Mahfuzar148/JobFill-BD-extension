// JobFill BD - Comprehensive BPSC All Circulars Integration Test Suite
// Verifies BPSC BCS Cadre, Non-Cadre, Assistant Director, and Sub-Registrar circulars,
// Teletalk NCAD parsing, bpsc.gov.bd table extraction, and lifecycle event tracking.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BpscAdapter,
  BPSC_CIRCULARS_URL,
  BPSC_NOTICES_URL,
  BPSC_NCAD_URL,
  parseBpscTeletalkNcadHtml,
  parseBpscNoticeTableHtml,
} from '../../src/jobs/sources/bpsc/bpsc.adapter';
import { JobSourceRegistry } from '../../src/jobs/sources/source-registry';
import {
  ALL_BPSC_CIRCULARS,
  ALL_BPSC_JOB_CIRCULARS,
  BPSC_5147_BDGOVTJOB_CIRCULAR,
  BPSC_47TH_BCS_CIRCULAR,
  BPSC_46TH_BCS_CIRCULAR,
  BPSC_NCAD_83_96_CIRCULAR,
  BPSC_NCAD_78_82_CIRCULAR,
  BPSC_SEC_ASSISTANT_DIRECTOR_CIRCULAR,
  BPSC_SUB_REGISTRAR_CIRCULAR,
  BPSC_50TH_BCS_CIRCULAR,
  BPSC_51ST_BCS_SPECIAL_CIRCULAR,
  BPSC_SEED_EXAM_SCHEDULES,
  BPSC_SEED_ADMIT_CARDS,
  BPSC_SEED_JOB_RESULTS,
  getSeedCirculars,
  getSeedJobCirculars,
  getAllBpscCirculars,
} from '../../src/jobs/data/seed-circulars';
import { JobRepository } from '../../src/jobs/database/job-repository';
import { OFFICIAL_JOB_PORTALS } from '../../src/jobs/data/official-portals';
import { validateJobCircular } from '../../src/jobs/services/job-validator';
import * as jobFetcher from '../../src/jobs/services/job-fetcher';

const SAMPLE_TELETALK_NCAD_HTML = `
<table width="730" border="0" cellpadding="5" cellspacing="0" class="bdr02">
  <tr class="black12bold" bgcolor="#ADC9AD">
    <td height="30" align="center" valign="middle" class="black12bold">Circulars</td>
  </tr>
  <tr bgcolor="#D0EDD0">
    <td height="25" align="left" valign="middle">
      <a href="doc/ad_202607.pdf" target="_blank" class="circular">
        Circular No: 78-82/2026/Higher Scale &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date: 30 October 2026
      </a>
    </td>
  </tr>
  <tr bgcolor="#D0EDD0">
    <td height="30" align="left" valign="middle" class="black12">
      <label for="202607#78-82/2026/Higher Scale#30 October 2026">
        <input type="radio" name="ix" value="202607#78-82/2026/Higher Scale#30 October 2026" />
        Apply on 01 November 2026, 12:00 PM to 30 November 2026, 06:00 PM
      </label>
    </td>
  </tr>
  <tr bgcolor="#E9F7E9">
    <td height="25" align="left" valign="middle">
      <a href="doc/ad_202608.pdf" target="_blank" class="circular">
        Circular No: 83-96/2026 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date: 30 October 2026
      </a>
    </td>
  </tr>
  <tr bgcolor="#E9F7E9">
    <td height="30" align="left" valign="middle" class="black12">
      <label for="202608#83-96/2026#30 October 2026">
        <input type="radio" name="ix" value="202608#83-96/2026#30 October 2026" />
        Apply on 01 November 2026, 12:00 PM to 30 November 2026, 06:00 PM
      </label>
    </td>
  </tr>
</table>
`;

const SAMPLE_BPSC_GOV_TABLE_HTML = `
<table id="noticeTable" class="notice-table">
  <tbody class="table-tbody">
    <tr class="table-tr">
      <td class="table-td" data-column="id">৪</td>
      <td class="table-td" data-column="title">
        বাংলাদেশ সরকারী কর্ম কমিশন সচিবালয়ের 'সহকারী পরিচালক' (৯ম গ্রেড) পদে নিয়োগের প্রজ্ঞাপন
      </td>
      <td class="table-td" data-column="memorial_no">৮০.০০.০০০০.৩০১.৭৩.০১৪.২৬</td>
      <td class="table-td" data-column="files">
        <a class="table-td-icon" href="https://objectstorage.ap-dcc-gazipur-1.oraclecloud15.com/office-bpsc/2026/10/ad_assistant_dir.pdf">
          PDF
        </a>
      </td>
      <td class="table-td" data-column="publish_date">০৫-১১-২০২৬</td>
      <td class="table-td centered">
        <a href="/pages/notification-circulars/bpsc-ad-2026">দেখুন</a>
      </td>
    </tr>
  </tbody>
</table>
`;

describe('BPSC All Circulars Integration Suite', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
  });

  describe('1. BPSC Adapter Registration & Configuration', () => {
    it('should be registered in JobSourceRegistry with official_verified level', () => {
      const adapter = JobSourceRegistry.getById('bpsc');
      expect(adapter).toBeDefined();
      expect(adapter?.sourceId).toBe('bpsc');
      expect(adapter?.officialDomain).toBe('bpsc.gov.bd');
      expect(adapter?.verificationLevel).toBe('official_verified');
      expect(adapter?.compatibilityStatus).toBe('supported');
    });

    it('should have official URLs configured', () => {
      expect(BPSC_CIRCULARS_URL).toBe('https://bpsc.gov.bd/pages/notification-circulars');
      expect(BPSC_NOTICES_URL).toBe('https://bpsc.gov.bd/pages/notices');
      expect(BPSC_NCAD_URL).toBe('https://bpsc.teletalk.com.bd/ncad/apply.php');
    });
  });

  describe('2. Teletalk Non-Cadre apply.php Parser', () => {
    it('should accurately extract active non-cadre circulars 78-82 and 83-96', () => {
      const items = parseBpscTeletalkNcadHtml(SAMPLE_TELETALK_NCAD_HTML);
      expect(items.length).toBe(2);

      // Circular 1: Higher Scale
      const c1 = items[0];
      expect(c1.circularNumber).toBe('78-82/2026/Higher Scale');
      expect(c1.organization).toBe('Bangladesh Public Service Commission (BPSC)');
      expect(c1.cadreStatus).toBe('Non-Cadre');
      expect(c1.salary).toContain('উচ্চতর স্কেল');
      expect(c1.publishedDateText).toBe('30 October 2026');
      expect(c1.deadlineText).toBe('30 November 2026, 06:00 PM');
      expect(c1.applicationUrl).toBe('https://bpsc.teletalk.com.bd/ncad/apply.php');
      expect(c1.circularUrl).toBe('https://bpsc.teletalk.com.bd/ncad/doc/ad_202607.pdf');

      // Circular 2: 83-96
      const c2 = items[1];
      expect(c2.circularNumber).toBe('83-96/2026');
      expect(c2.cadreStatus).toBe('Non-Cadre');
      expect(c2.deadlineText).toBe('30 November 2026, 06:00 PM');
      expect(c2.circularUrl).toBe('https://bpsc.teletalk.com.bd/ncad/doc/ad_202608.pdf');
    });
  });

  describe('3. bpsc.gov.bd Notice Table Parser', () => {
    it('should extract Assistant Director 9th Grade recruitment memo', () => {
      const items = parseBpscNoticeTableHtml(SAMPLE_BPSC_GOV_TABLE_HTML, BPSC_CIRCULARS_URL);
      expect(items.length).toBe(1);

      const ad = items[0];
      expect(ad.jobTitle).toContain('সহকারী পরিচালক');
      expect(ad.jobTitle).toContain('৯ম গ্রেড');
      expect(ad.organization).toBe('Bangladesh Public Service Commission (BPSC)');
      expect(ad.circularNumber).toBe('৮০.০০.০০০০.৩০১.৭৩.০১৪.২৬');
      expect(ad.publishedDateText).toBe('০৫-১১-২০২৬');
      expect(ad.circularUrl).toContain('ad_assistant_dir.pdf');
    });
  });

  describe('4. Multi-Endpoint Live Fetch Simulation', () => {
    it('should fetch and normalize circulars across notification, notice, and Teletalk NCAD endpoints', async () => {
      vi.spyOn(jobFetcher, 'safePublicGet').mockImplementation(async (url: string) => {
        if (url === BPSC_NCAD_URL) {
          return { ok: true, status: 200, contentType: 'text/html', body: SAMPLE_TELETALK_NCAD_HTML };
        }
        if (url === BPSC_CIRCULARS_URL) {
          return { ok: true, status: 200, contentType: 'text/html', body: SAMPLE_BPSC_GOV_TABLE_HTML };
        }
        return { ok: true, status: 200, contentType: 'text/html', body: '<table><tbody></tbody></table>' };
      });

      const outcome = await BpscAdapter.fetchJobs();
      expect(outcome.success).toBe(true);
      expect(outcome.jobs.length).toBe(3);

      for (const job of outcome.jobs) {
        expect(job.organization).toBe('Bangladesh Public Service Commission (BPSC)');
        expect(job.deadlineTimezone).toBe('Asia/Dhaka');
        expect([9, 10, 12]).toContain(job.gradeNumber);
        const validation = validateJobCircular(job);
        expect(validation.isValid).toBe(true);
      }
    });
  });

  describe('5. Verified Pre-Seeded BPSC Circulars Catalog', () => {
    it('should contain all 9 major verified BPSC circulars', () => {
      const allCircs = getAllBpscCirculars();
      expect(allCircs.length).toBe(9);

      const expectedIds = [
        'bpsc-5147-non-cadre-2026',
        'bpsc-47th-bcs-examination-2026',
        'bpsc-46th-bcs-examination-2024',
        'bpsc-ncad-circular-83-96-2026',
        'bpsc-ncad-circular-78-82-2026-higher-scale',
        'bpsc-sec-assistant-director-9th-grade-2026',
        'bpsc-sub-registrar-recruitment-2026',
        'bpsc-50th-bcs-examination-2025',
        'bpsc-51st-bcs-special-examination-2026',
      ];

      for (const id of expectedIds) {
        const found = allCircs.find((c) => c.id === id);
        expect(found).toBeDefined();
        expect(found?.organization).toContain('Bangladesh Public Service Commission');
        expect(found?.gradeNumber).toBe(9);
        expect(found?.deadlineTimezone).toBe('Asia/Dhaka');
        const validation = validateJobCircular(found!);
        expect(validation.isValid).toBe(true);
      }
    });

    it('should export all 9 circulars as JobCircular with categoryLetter A and Grade 9', () => {
      const jobCircs = getSeedJobCirculars();
      expect(jobCircs.length).toBe(9);

      for (const jc of jobCircs) {
        expect(jc.categoryLetter).toBe('A');
        expect(jc.sector).toBe('Government');
        expect(jc.grade.gradeNumber).toBe(9);
        expect(jc.grade.isGovernmentGrade).toBe(true);
        expect(jc.grade.gradeVerificationStatus).toBe('OFFICIAL_MATCH');
        expect(jc.officialAppLink).toMatch(/https:\/\/bpsc\.teletalk\.com\.bd/);
      }
    });
  });

  describe('6. Pre-Seeded BPSC Lifecycle Events', () => {
    it('should include authentic Exam Schedules for 47th BCS, Non-Cadre 5147, and Sub-Registrar', () => {
      expect(BPSC_SEED_EXAM_SCHEDULES.length).toBe(3);
      const preli47 = BPSC_SEED_EXAM_SCHEDULES.find((e) => e.id === 'exam_bpsc_47th_preli');
      expect(preli47).toBeDefined();
      expect(preli47?.stage).toBe('Preliminary');
      expect(preli47?.status).toBe('Announced');
      expect(preli47?.examDate).toBe('2026-05-15');

      const subReg = BPSC_SEED_EXAM_SCHEDULES.find((e) => e.id === 'exam_bpsc_sub_registrar_written');
      expect(subReg).toBeDefined();
      expect(subReg?.stage).toBe('Written');
      expect(subReg?.examDate).toBe('2026-12-15');
    });

    it('should include authentic Admit Card Notices for 50th and 47th BCS', () => {
      expect(BPSC_SEED_ADMIT_CARDS.length).toBe(2);
      const admit50 = BPSC_SEED_ADMIT_CARDS.find((a) => a.id === 'admit_bpsc_50th_preli');
      expect(admit50?.status).toBe('Available');
      expect(admit50?.portalUrl).toBe('https://bpsc.teletalk.com.bd/bcs50');
    });

    it('should include authentic Results for 46th BCS Written and Secretariat Assistant Director', () => {
      expect(BPSC_SEED_JOB_RESULTS.length).toBe(2);
      const bcs46Result = BPSC_SEED_JOB_RESULTS.find((r) => r.id === 'result_bpsc_46th_written');
      expect(bcs46Result?.publicationStatus).toBe('Result Published');
      expect(bcs46Result?.selectedCandidateCount).toBe(4250);
    });
  });

  describe('7. JobRepository Seeding & Initial Load', () => {
    it('should seed BPSC circulars into JobRepository idempotently', async () => {
      await JobRepository.clearAll();
      const added = await JobRepository.seedBpscCirculars();
      expect(added).toBe(9);

      const loaded = await JobRepository.getAllJobs();
      expect(loaded.length).toBe(9);

      // Re-seeding should not add duplicates
      const reAdded = await JobRepository.seedBpscCirculars();
      expect(reAdded).toBe(0);
    });

    it('should automatically provide seed circulars when getAllJobs is called on empty store with seedIfEmpty', async () => {
      await JobRepository.clearAll();
      const loaded = await JobRepository.getAllJobs(Date.now(), { seedIfEmpty: true });
      expect(loaded.length).toBe(9);
      expect(loaded[0].id).toBe('bpsc-5147-non-cadre-2026');
    });
  });

  describe('8. Official Portals Directory BPSC Entries', () => {
    it('should have all official BPSC portal endpoints in OFFICIAL_JOB_PORTALS', () => {
      const portalIds = [
        'bpsc-official',
        'bpsc-teletalk',
      ];

      for (const pid of portalIds) {
        const portal = OFFICIAL_JOB_PORTALS.find((p) => p.id === pid);
        expect(portal).toBeDefined();
        expect(portal?.category).toBe('Government');
        expect(portal?.isBangladeshOfficial).toBe(true);
      }
    });
  });
});
