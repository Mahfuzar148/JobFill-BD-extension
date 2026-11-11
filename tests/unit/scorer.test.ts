import { describe, it, expect } from 'vitest';
import { scoreFieldMatch } from '../../src/engine/scorer';
import { FIELD_DICTIONARY } from '../../src/engine/fieldDictionary';

describe('Scorer Engine', () => {
  it('awards 100 score for exact HTML name match', () => {
    const input = document.createElement('input');
    input.setAttribute('name', 'applicant_name');
    input.id = 'applicant_name';

    const def = FIELD_DICTIONARY.find((d) => d.key === 'personal.applicantNameEn')!;
    const result = scoreFieldMatch(input, def, 'personal');

    expect(result.totalScore).toBeGreaterThanOrEqual(100);
    expect(result.confidence).toBe('HIGH');
  });

  it('correctly matches Bengali names via label', () => {
    const input = document.createElement('input');
    input.setAttribute('name', 'name_bn');
    input.setAttribute('placeholder', 'আবেদনকারীর নাম (বাংলায়)');

    const def = FIELD_DICTIONARY.find((d) => d.key === 'personal.applicantNameBn')!;
    const result = scoreFieldMatch(input, def, 'personal');

    expect(result.confidence).toBe('HIGH');
  });

  it('disambiguates SSC vs HSC Roll based on section context', () => {
    const sscRollInput = document.createElement('input');
    sscRollInput.setAttribute('name', 'roll_no');
    sscRollInput.id = 'roll';

    const sscDef = FIELD_DICTIONARY.find((d) => d.key === 'ssc.rollNumber')!;
    const hscDef = FIELD_DICTIONARY.find((d) => d.key === 'hsc.rollNumber')!;

    const sscScore = scoreFieldMatch(sscRollInput, sscDef, 'ssc');
    const hscScore = scoreFieldMatch(sscRollInput, hscDef, 'ssc');

    // In SSC context, SSC definition must score higher than HSC definition
    expect(sscScore.totalScore).toBeGreaterThan(hscScore.totalScore);
  });

  it('penalizes mismatched section contexts', () => {
    const input = document.createElement('input');
    input.setAttribute('name', 'roll_no');

    const sscDef = FIELD_DICTIONARY.find((d) => d.key === 'ssc.rollNumber')!;
    // In permanent_address context, roll_no should receive heavy penalty
    const result = scoreFieldMatch(input, sscDef, 'permanent_address');

    expect(result.confidence).toBe('LOW');
  });
});
