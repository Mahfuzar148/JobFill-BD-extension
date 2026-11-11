import { describe, it, expect } from 'vitest';
import { ValueNormalizer } from '../../src/intelligence/value-normalizer';

describe('Layer 1: Value Normalizer Engine', () => {
  it('converts Bengali digits to English numerals', () => {
    expect(ValueNormalizer.toEnglishNumerals('০১৭১১২২৩৩৪')).toBe('0171122334');
    expect(ValueNormalizer.toEnglishNumerals('১৯৯৮-০৫-১৫')).toBe('1998-05-15');
    expect(ValueNormalizer.toEnglishNumerals('জিপিএ ৫.০০')).toBe('জিপিএ 5.00');
  });

  it('converts English digits to Bengali numerals', () => {
    expect(ValueNormalizer.toBengaliNumerals('1998')).toBe('১৯৯৮');
    expect(ValueNormalizer.toBengaliNumerals('5.00')).toBe('৫.০০');
  });

  it('cleans and normalizes unicode and whitespace', () => {
    expect(ValueNormalizer.cleanText('  Applicant   Name (English)  ')).toBe('applicant name english');
    expect(ValueNormalizer.cleanText('আবেদনকারীর    নামঃ')).toBe('আবেদনকারীর নাম');
  });

  it('normalizes Bangladesh mobile numbers', () => {
    expect(ValueNormalizer.normalizeMobileNumber('+8801711223344')).toBe('01711223344');
    expect(ValueNormalizer.normalizeMobileNumber('8801711223344')).toBe('01711223344');
    expect(ValueNormalizer.normalizeMobileNumber('০১৭১১২২৩৩৪৪')).toBe('01711223344');
  });

  it('formats dates for various government portal requirements', () => {
    const isoDate = '1998-05-15';
    // Default Bangladesh Govt format
    expect(ValueNormalizer.formatDateForTarget(isoDate, 'text', 'DD-MM-YYYY')).toBe('15-05-1998');
    // HTML5 date input
    expect(ValueNormalizer.formatDateForTarget(isoDate, 'date', '')).toBe('1998-05-15');
    // Slash formatted
    expect(ValueNormalizer.formatDateForTarget(isoDate, 'text', 'DD/MM/YYYY')).toBe('15/05/1998');
    // Bengali numerals input
    expect(ValueNormalizer.formatDateForTarget('১৯৯৮-০৫-১৫', 'text', 'DD-MM-YYYY')).toBe('15-05-1998');
  });

  it('truncates text safely to maxLength for job descriptions', () => {
    const longText = 'A'.repeat(350);
    expect(ValueNormalizer.truncate(longText, 300).length).toBe(300);
  });
});
