import { describe, it, expect, beforeEach } from 'vitest';
import {
  CalendarRepository,
  buildUnifiedCalendarEvents,
  DHAKA_TIMEZONE,
  exportCalendarAsIcs,
  formatTimestampInDhakaDate,
} from '../../src/calendar/career-calendar';
import { evaluateApplicationReadiness } from '../../src/readiness/readiness-checker';
import { createEmptyProfile } from '../../src/types/defaults';
import { DocumentRepository } from '../../src/database/document-repository';
import { createCvDraftFromProfile } from '../../src/cv/cv-repository';
import type { NormalizedJobCircular, ApplicationTrackerRecord } from '../../src/jobs/types/job.types';

describe('JobFill BD - Milestone 2: Career Calendar, Readiness Checker, Document Validity & Unified Profile', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('builds deduplicated Asia/Dhaka calendar events, flags unverified dates, and prevents duplicate manual saves', async () => {
    expect(DHAKA_TIMEZONE).toBe('Asia/Dhaka');
    // 2026-11-12T20:00:00Z is 2026-11-13 02:00 AM in Asia/Dhaka!
    const dhakaDate = formatTimestampInDhakaDate(Date.parse('2026-11-12T20:00:00Z'));
    expect(dhakaDate).toBe('2026-11-13');

    const ev1 = await CalendarRepository.save({
      title: 'BCS Bangla Revision',
      date: '2026-12-01',
      kind: 'study_plan',
      verifiedDate: true,
    });
    const evDup = await CalendarRepository.save({
      title: 'BCS Bangla Revision',
      date: '2026-12-01',
      kind: 'study_plan',
      verifiedDate: true,
    });
    expect(evDup.id).toBe(ev1.id);

    const job = {
      id: 'job_cal_1',
      jobTitle: 'Sub-Assistant Engineer',
      organization: 'BPDB',
      deadlineAt: Date.parse('2026-12-10T10:00:00Z'),
      deadlineVerified: false,
      status: 'active',
    } as NormalizedJobCircular;

    const app = {
      jobId: 'job_cal_2',
      jobTitle: 'Assistant Director',
      organization: 'Bangladesh Bank',
      deadlineAt: Date.parse('2026-12-15T10:00:00Z'),
      examDate: '2026-12-28',
      status: 'Exam Scheduled',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as ApplicationTrackerRecord;

    const unified = buildUnifiedCalendarEvents([ev1], [job], [app], [
      {
        documentId: 'doc_lic_1',
        documentType: 'other',
        fileName: 'driving-license.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        width: 0,
        height: 0,
        createdAt: new Date().toISOString(),
        expiresAt: '2026-12-30',
        validityNotes: 'BRTA renewal',
      },
    ]);

    expect(unified.some((u) => u.id === 'auto_job_job_cal_1' && !u.verifiedDate)).toBe(true);
    expect(unified.some((u) => u.id === 'auto_exam_job_cal_2' && u.kind === 'exam')).toBe(true);
    expect(unified.some((u) => u.kind === 'document_expiry' && u.date === '2026-12-30')).toBe(true);

    const ics = exportCalendarAsIcs(unified);
    expect(ics).toContain('X-WR-TIMEZONE:Asia/Dhaka');
    expect(ics).toContain('BCS Bangla Revision');

    await CalendarRepository.remove(ev1.id);
    const remaining = await CalendarRepository.getAll();
    expect(remaining).toHaveLength(0);
  });

  it('evaluates Application Readiness without auto-checking declarations or falsifying incomplete profiles', () => {
    const emptyProfile = createEmptyProfile('Blank');
    const resBlank = evaluateApplicationReadiness(emptyProfile, [], null, {
      formFieldsReviewed: false,
      feeInfoReviewed: false,
      declarationsReviewed: false,
    });
    expect(resBlank.allRequiredReady).toBe(false);
    expect(resBlank.items.find((i) => i.key === 'personal_profile')?.status).toBe('Missing');
    expect(resBlank.items.find((i) => i.key === 'education_details')?.status).toBe('Missing');
    expect(resBlank.items.find((i) => i.key === 'manual_declaration_review')?.status).toBe('Needs Review');

    const filled = createEmptyProfile('Ready');
    filled.personal.applicantNameEn = 'KARIM UDDIN';
    filled.personal.fatherNameEn = 'RAHIM UDDIN';
    filled.personal.motherNameEn = 'AMENA BEGUM';
    filled.personal.dob = '1999-01-10';
    filled.personal.mobile = '01711111111';
    filled.personal.nid = '1999123456789';
    filled.ssc.gpa = '5.00';
    filled.hsc.gpa = '5.00';

    const resReady = evaluateApplicationReadiness(
      filled,
      [
        {
          documentId: 'p1',
          documentType: 'photo',
          fileName: 'photo.jpg',
          mimeType: 'image/jpeg',
          fileSize: 20480,
          width: 300,
          height: 300,
          createdAt: new Date().toISOString(),
        },
        {
          documentId: 's1',
          documentType: 'signature',
          fileName: 'sig.jpg',
          mimeType: 'image/jpeg',
          fileSize: 10240,
          width: 300,
          height: 80,
          createdAt: new Date().toISOString(),
        },
        {
          documentId: 'c1',
          documentType: 'educational_certificate',
          fileName: 'ssc.pdf',
          mimeType: 'application/pdf',
          fileSize: 50000,
          width: 0,
          height: 0,
          createdAt: new Date().toISOString(),
        },
      ],
      null,
      { formFieldsReviewed: true, feeInfoReviewed: true, declarationsReviewed: true }
    );
    expect(resReady.allRequiredReady).toBe(true);
  });

  it('feeds Student Career Profile into CV drafts and rejects expiration dates on academic certificates', async () => {
    const profile = createEmptyProfile('Student');
    profile.careerProfile = {
      educationLevel: 'Honours / Bachelor',
      departmentOrSubject: 'CSE',
      passingYear: '2025',
      skills: ['TypeScript', 'MS Excel'],
      languages: [{ language: 'English', proficiency: 'Fluent' }],
      projects: [{ id: 'pr1', title: 'Exam Helper', role: 'Author', techOrFocus: 'React', summary: 'Open source tool' }],
      achievements: ['Dean List 2024'],
      careerInterests: ['Software Engineer'],
      preferredJobCategories: ['Government', 'IT'],
      preferredLocations: ['Dhaka'],
      internshipPreference: true,
      careerGoals: [],
    };
    const cv = createCvDraftFromProfile(profile);
    expect(cv.skills).toContain('TypeScript');
    expect(cv.languages[0]).toContain('English (Fluent)');
    expect(cv.projects[0].name).toBe('Exam Helper');

    const acadMeta = await DocumentRepository.saveDocument({
      id: 'acad_cert_1',
      profileId: 'p_val',
      documentType: 'educational_certificate',
      fileName: 'bsc-cert.pdf',
      mimeType: 'application/pdf',
      dataUrl: 'data:application/pdf;base64,JVBERi0xLjQK',
    });
    expect(acadMeta.documentId).toBe('acad_cert_1');
    await expect(
      DocumentRepository.updateDocumentValidity('acad_cert_1', '2030-01-01')
    ).rejects.toThrow(/Academic certificates do not expire/);
  });
});
