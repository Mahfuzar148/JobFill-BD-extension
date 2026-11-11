import { describe, it, expect } from 'vitest';
import { classifySectionText } from '../../src/engine/contextDetector';

describe('Context Detector Engine', () => {
  it('correctly identifies personal information headers', () => {
    expect(classifySectionText('Basic Information')).toBe('personal');
    expect(classifySectionText('Applicant Information')).toBe('personal');
    expect(classifySectionText('ব্যক্তিগত তথ্য')).toBe('personal');
  });

  it('correctly identifies SSC section headers', () => {
    expect(classifySectionText('SSC/Equivalent Level')).toBe('ssc');
    expect(classifySectionText('Secondary School Certificate')).toBe('ssc');
    expect(classifySectionText('মাধ্যমিক বা সমমান')).toBe('ssc');
  });

  it('correctly identifies HSC section headers', () => {
    expect(classifySectionText('HSC/Equivalent Level/Diploma-in-Engineering')).toBe('hsc');
    expect(classifySectionText('Higher Secondary Certificate')).toBe('hsc');
    expect(classifySectionText('উচ্চ মাধ্যমিক')).toBe('hsc');
  });

  it('correctly identifies Graduation and Masters headers', () => {
    expect(classifySectionText('Graduation/Equivalent Level')).toBe('graduation');
    expect(classifySectionText('Masters/Equivalent Level')).toBe('masters');
    expect(classifySectionText('স্নাতকোত্তর')).toBe('masters');
  });

  it('correctly identifies Present and Permanent address headers', () => {
    expect(classifySectionText('Present Address (বর্তমান ঠিকানা)')).toBe('present_address');
    expect(classifySectionText('Permanent Address (স্থায়ী ঠিকানা)')).toBe('permanent_address');
  });

  it('correctly identifies Job Experience and Organization Choice headers', () => {
    expect(classifySectionText('Job Experiences')).toBe('experience');
    expect(classifySectionText('Organization Choice')).toBe('special');
  });
});
