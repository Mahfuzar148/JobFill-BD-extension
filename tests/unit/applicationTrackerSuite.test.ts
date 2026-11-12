import { describe, it, expect, beforeEach } from 'vitest';
import { ApplicationRepository } from '../../src/jobs/database/application-repository';
import { openJobApplicationWithContext } from '../../src/jobs/services/job-ui-actions';

describe('Phase 3 — Advanced Application Tracker & Non-Destructive Preservation Suite', () => {
  beforeEach(async () => {
    await ApplicationRepository.clearAll();
  });

  it('1. Preserves all extended metadata fields (circularId, transactionId, admitCardStatus, resultSummary)', async () => {
    const first = await ApplicationRepository.setStatus(
      {
        id: 'app_bb_1',
        jobTitle: 'Assistant Director (General)',
        organization: 'Bangladesh Bank',
        circularNumber: 'BB-AD-2026',
        applicationUrl: 'https://erecruitment.bb.org.bd',
        circularUrl: 'https://bb.org.bd/circular.pdf',
        deadlineAt: Date.parse('2026-12-01T18:00:00Z'),
      },
      'Payment Pending',
      {
        teletalkUserId: 'BB88123',
        transactionId: 'TXN_BANK_5512',
        feePaymentStatus: 'unpaid',
        admitCardStatus: 'Not Published',
        examRoll: '771122',
        examVenue: 'Eden College',
      }
    );

    expect(first.circularId).toBe('BB-AD-2026');
    expect(first.transactionId).toBe('TXN_BANK_5512');
    expect(first.admitCardStatus).toBe('Not Published');
    expect(first.feePaymentStatus).toBe('unpaid');

    // Subsequent status update preserves previous tracker metadata
    const second = await ApplicationRepository.setStatus(
      {
        id: 'app_bb_1',
        jobTitle: 'Assistant Director (General)',
        organization: 'Bangladesh Bank',
        applicationUrl: 'https://erecruitment.bb.org.bd',
        circularUrl: 'https://bb.org.bd/circular.pdf',
        deadlineAt: first.deadlineAt,
      },
      'Admit Card Available',
      {
        admitCardStatus: 'Available',
        resultSummary: 'Viva Qualified',
      }
    );

    expect(second.teletalkUserId).toBe('BB88123');
    expect(second.transactionId).toBe('TXN_BANK_5512');
    expect(second.admitCardStatus).toBe('Available');
    expect(second.resultSummary).toBe('Viva Qualified');
  });

  it('2. Supports non-destructive backup export and merge-restore without overwriting newer records', async () => {
    await ApplicationRepository.upsert({
      jobId: 'existing_1',
      jobTitle: 'Junior Officer',
      organization: 'Sonali Bank',
      status: 'Applied',
      deadlineAt: null,
      teletalkUserId: 'SB111',
      createdAt: 1000,
      updatedAt: 9000,
    });

    const backup = await ApplicationRepository.exportBackup();
    expect(backup.schemaVersion).toBe(1);
    expect(backup.records).toHaveLength(1);

    // Add a second record locally
    await ApplicationRepository.upsert({
      jobId: 'existing_2',
      jobTitle: 'Programmer',
      organization: 'BPSC',
      status: 'Interested',
      deadlineAt: null,
      createdAt: 2000,
      updatedAt: 5000,
    });

    // Mutate existing_1 to an even newer updatedAt locally
    await ApplicationRepository.upsert({
      jobId: 'existing_1',
      jobTitle: 'Junior Officer',
      organization: 'Sonali Bank',
      status: 'Exam Scheduled',
      deadlineAt: null,
      teletalkUserId: 'SB111',
      createdAt: 1000,
      updatedAt: 9999999999999,
    });

    // Restore older backup + add new backup entry existing_3 -> keeps existing_1 newer & existing_2 untouched
    const restoredCount = await ApplicationRepository.restoreBackupMerge([
      ...backup.records,
      {
        jobId: 'backup_3',
        jobTitle: 'Lecturer',
        organization: 'NTRCA',
        status: 'Ready to Apply',
        deadlineAt: null,
        createdAt: 3000,
        updatedAt: 4000,
      },
    ]);

    expect(restoredCount).toBe(1); // only backup_3 inserted; older existing_1 skipped cleanly
    const all = await ApplicationRepository.getAll();
    expect(all).toHaveLength(3);
    expect(all.find((r) => r.jobId === 'existing_1')?.status).toBe('Exam Scheduled');
  });

  it('3. Opening an external application URL never auto-marks an application as Applied', async () => {
    const opened = await openJobApplicationWithContext({
      id: 'no_auto_apply',
      jobTitle: 'Assistant Engineer',
      organization: 'BPDB',
      sourceId: 'teletalk',
      sourceName: 'Teletalk',
      sourceUrl: 'https://bpdb.teletalk.com.bd',
      circularUrl: 'https://bpdb.gov.bd/circular.pdf',
      applicationUrl: 'https://bpdb.teletalk.com.bd',
      sourceVerification: 'official_verified',
      deadlineVerified: false,
      deadlineAt: null,
      location: 'All Bangladesh',
      category: 'Government',
      qualification: 'Bachelor',
      requirements: [],
      description: '',
      status: 'active',
      publishedAt: null,
      lastUpdatedAt: Date.now(),
    });

    expect(opened.opened).toBe(true);
    const tracked = await ApplicationRepository.getByJobId('no_auto_apply');
    expect(tracked).toBeNull();
  });
});
