import { describe, it, expect } from 'vitest';
import { FieldValidator } from '../../src/validation/field-validator';
import { ValueValidator } from '../../src/validation/value-validator';
import { DocumentValidator } from '../../src/validation/document-validator';
import { FormValidator } from '../../src/validation/form-validator';
import { sampleDemoProfile } from '../../src/types/defaults';

describe('Phase 6 & 7: Validation Engine & Document Specifications', () => {
  it('validates 11-digit Bangladeshi mobile numbers correctly', () => {
    expect(FieldValidator.validateMobile('01711223344').isValid).toBe(true);
    expect(FieldValidator.validateMobile('+8801811223344').isValid).toBe(true);
    expect(FieldValidator.validateMobile('01211223344').isValid).toBe(false); // 012 is invalid operator
    expect(FieldValidator.validateMobile('017112233').isValid).toBe(false); // too short
  });

  it('validates National ID lengths (10, 13, 17 digits)', () => {
    expect(FieldValidator.validateNID('1234567890').isValid).toBe(true); // 10 digit smart
    expect(FieldValidator.validateNID('1234567890123').isValid).toBe(true); // 13 digit
    expect(FieldValidator.validateNID('19901234567890123').isValid).toBe(true); // 17 digit
    expect(FieldValidator.validateNID('12345').isValid).toBe(false); // invalid
  });

  it('validates applicant age within government recruitment bounds (18 - 45)', () => {
    const today = new Date();
    const validBirthYear = today.getFullYear() - 25;
    expect(FieldValidator.validateDOB(`${validBirthYear}-05-15`).isValid).toBe(true);

    const underageBirthYear = today.getFullYear() - 15;
    expect(FieldValidator.validateDOB(`${underageBirthYear}-05-15`).isValid).toBe(false);

    const overageBirthYear = today.getFullYear() - 55;
    expect(FieldValidator.validateDOB(`${overageBirthYear}-05-15`).isValid).toBe(false);
  });

  it('strictly preserves leading zeros in numeric identifiers', () => {
    expect(ValueValidator.preservesLeadingZero('01711223344', '01711223344')).toBe(true);
    expect(ValueValidator.preservesLeadingZero('0212', '212')).toBe(false); // mangled
    expect(ValueValidator.preservesLeadingZero('00142857', '00142857')).toBe(true);
  });

  it('enforces character ceilings on job experience descriptions (300 max)', () => {
    const shortDesc = 'Supervised network infrastructure and billing servers.';
    const resShort = ValueValidator.enforceCharacterLimit(shortDesc, 300);
    expect(resShort.isWithinLimit).toBe(true);

    const longDesc = 'A'.repeat(350);
    const resLong = ValueValidator.enforceCharacterLimit(longDesc, 300);
    expect(resLong.isWithinLimit).toBe(false);
    expect(resLong.trimmedText.length).toBe(300);
  });

  it('validates document compliance against 300x300 photo and 300x80 signature standards', () => {
    // Exact valid photo
    const validPhoto = DocumentValidator.validatePhoto(300, 300, 75, 'image/jpeg');
    expect(validPhoto.isCompliant).toBe(true);

    // Dimension mismatch photo
    const badDimPhoto = DocumentValidator.validatePhoto(400, 400, 50, 'image/jpeg');
    expect(badDimPhoto.isCompliant).toBe(false);

    // Oversized photo
    const heavyPhoto = DocumentValidator.validatePhoto(300, 300, 150, 'image/jpeg');
    expect(heavyPhoto.isCompliant).toBe(false);

    // Exact valid signature
    const validSig = DocumentValidator.validateSignature(300, 80, 40, 'image/jpeg');
    expect(validSig.isCompliant).toBe(true);

    // Dimension mismatch signature
    const badSig = DocumentValidator.validateSignature(300, 120, 30, 'image/jpeg');
    expect(badSig.isCompliant).toBe(false);
  });

  it('verifies form-level cross-field consistency rules', () => {
    // Valid profile
    const reportValid = FormValidator.validateProfile(sampleDemoProfile);
    expect(reportValid.isValid).toBe(true);
    expect(reportValid.totalErrors).toBe(0);

    // Chronological passing year violation: HSC year before SSC year
    const conflictingProfile = {
      ...sampleDemoProfile,
      ssc: { ...sampleDemoProfile.ssc, passingYear: '2018' },
      hsc: { ...sampleDemoProfile.hsc, passingYear: '2016' },
    };
    const reportConflict = FormValidator.validateProfile(conflictingProfile);
    expect(reportConflict.isValid).toBe(false);
    expect(reportConflict.issues.some((i) => i.field === 'hscPassingYear')).toBe(true);
  });
});
