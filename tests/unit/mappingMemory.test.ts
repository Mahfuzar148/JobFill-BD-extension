import { describe, it, expect, beforeEach } from 'vitest';
import { extractElementFingerprint, computeFingerprintKey } from '../../src/intelligence/mapping-memory';
import { MappingRepository } from '../../src/database/mapping-repository';

describe('Adaptive Mapping Memory Engine', () => {
  beforeEach(async () => {
    await MappingRepository.clear();
  });

  it('generates consistent structural fingerprints without user personal data', () => {
    const input = document.createElement('input');
    input.setAttribute('type', 'text');
    input.setAttribute('name', 'custom_applicant_id');
    input.id = 'cand_id';

    const fp = extractElementFingerprint(input, 'personal');

    expect(fp.tagName).toBe('input');
    expect(fp.inputType).toBe('text');
    expect(fp.normalizedName).toBe('custom applicant id');
    expect(fp.normalizedId).toBe('cand id');
    expect(fp.sectionContext).toBe('personal');

    const key = computeFingerprintKey(fp);
    expect(key).toContain('custom applicant id');
  });

  it('records user confirmation and retrieves learned mapping', async () => {
    const input = document.createElement('input');
    input.setAttribute('name', 'petro_unit_p1');
    const fp = extractElementFingerprint(input, 'special');

    // Initially unmapped
    const before = await MappingRepository.findMapping(fp);
    expect(before).toBeNull();

    // Record user confirmation
    await MappingRepository.recordConfirmation(fp, 'special.orgChoice1');

    // Query learned mapping
    const after = await MappingRepository.findMapping(fp);
    expect(after).not.toBeNull();
    expect(after?.canonicalKey).toBe('special.orgChoice1');
    expect(after?.confirmationCount).toBe(1);
    expect(after?.accuracyScore).toBeGreaterThanOrEqual(95);
  });
});
