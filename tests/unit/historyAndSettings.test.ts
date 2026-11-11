import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAutofillHistory,
  addAutofillHistory,
  clearAutofillHistory,
  getGeneralSettings,
  saveGeneralSettings,
  DEFAULT_GENERAL_SETTINGS,
} from '../../src/services/storage';
import { AutofillHistoryRecord } from '../../src/types/profile';

describe('Autofill History & App Settings Storage', () => {
  beforeEach(async () => {
    localStorage.clear();
  });

  it('retrieves default general settings when none are stored', async () => {
    const settings = await getGeneralSettings();
    expect(settings.language).toBe('bn');
    expect(settings.theme).toBe('light');
    expect(settings.fillMode).toBe('review_first');
    expect(settings.overwriteProtection).toBe('warn');
    expect(settings.minimumConfidenceThreshold).toBe(65);
    expect(settings.enableBengaliConversion).toBe(true);
  });

  it('updates and persists general settings', async () => {
    await saveGeneralSettings({
      language: 'en',
      theme: 'dark',
      fillMode: 'instant_fill',
      minimumConfidenceThreshold: 85,
    });

    const updated = await getGeneralSettings();
    expect(updated.language).toBe('en');
    expect(updated.theme).toBe('dark');
    expect(updated.fillMode).toBe('instant_fill');
    expect(updated.minimumConfidenceThreshold).toBe(85);
    // Unchanged defaults remain
    expect(updated.overwriteProtection).toBe('warn');
  });

  it('records, queries, and clears autofill history sessions', async () => {
    const initial = await getAutofillHistory();
    expect(initial).toEqual([]);

    const record: AutofillHistoryRecord = {
      id: 'session_test_1',
      timestamp: Date.now(),
      url: 'https://petrobangla.teletalk.com.bd/apply',
      domain: 'petrobangla.teletalk.com.bd',
      pageTitle: 'PetroBangla Recruitment Form',
      profileId: 'prof_1',
      profileName: 'Mahfuzur Rahman',
      totalDetected: 35,
      totalFilled: 34,
      totalFailed: 1,
      totalAmbiguous: 0,
      status: 'partial',
      filledFields: [
        {
          fieldLabel: 'Applicant Name',
          canonicalKey: 'applicant.fullName.english',
          value: 'MAHFUZUR RAHMAN',
          confidence: 'HIGH_CONFIDENCE',
        },
      ],
    };

    await addAutofillHistory(record);

    const history = await getAutofillHistory();
    expect(history.length).toBe(1);
    expect(history[0].domain).toBe('petrobangla.teletalk.com.bd');
    expect(history[0].totalFilled).toBe(34);
    expect(history[0].filledFields?.[0].canonicalKey).toBe('applicant.fullName.english');

    await clearAutofillHistory();
    const afterClear = await getAutofillHistory();
    expect(afterClear).toEqual([]);
  });
});
