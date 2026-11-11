import { describe, it, expect, beforeEach } from 'vitest';
import { ProfileRepository } from '../../src/database/profile-repository';
import { HistoryRepository } from '../../src/database/history-repository';
import { BackupManager } from '../../src/database/backup-manager';
import { sampleDemoProfile } from '../../src/types/defaults';
import { AutofillHistoryRecord } from '../../src/types/profile';

describe('Phase 3: Database & Repository Suite', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves, retrieves, and updates user profiles via ProfileRepository', async () => {
    const testProfile = {
      ...sampleDemoProfile,
      id: 'prof_test_db',
      profileName: 'Database Test User',
    };

    await ProfileRepository.saveProfile(testProfile);
    const retrieved = await ProfileRepository.getProfileById('prof_test_db');

    expect(retrieved).not.toBeNull();
    expect(retrieved?.profileName).toBe('Database Test User');

    // Delete
    await ProfileRepository.deleteProfile('prof_test_db');
    const afterDelete = await ProfileRepository.getProfileById('prof_test_db');
    expect(afterDelete).toBeNull();
  });

  it('records, queries, and clears history records via HistoryRepository', async () => {
    const record: AutofillHistoryRecord = {
      id: 'session_db_1',
      timestamp: Date.now(),
      url: 'https://bogmc.teletalk.com.bd',
      domain: 'bogmc.teletalk.com.bd',
      pageTitle: 'PetroBangla Test',
      profileId: 'p1',
      profileName: 'Test Profile',
      totalDetected: 10,
      totalFilled: 10,
      totalFailed: 0,
      totalAmbiguous: 0,
      status: 'completed',
    };

    await HistoryRepository.addRecord(record);
    const history = await HistoryRepository.getHistory();

    expect(history.length).toBeGreaterThan(0);
    expect(history[0].id).toBe('session_db_1');

    await HistoryRepository.clearHistory();
    const cleared = await HistoryRepository.getHistory();
    expect(cleared.length).toBe(0);
  });

  it('exports and imports profile backups via BackupManager', async () => {
    const exportedJson = await BackupManager.exportBackup(false);
    expect(exportedJson).toContain('"appName": "JobFill BD"');

    const importedCount = await BackupManager.importBackup(exportedJson);
    expect(importedCount).toBeGreaterThan(0);
  });
});
