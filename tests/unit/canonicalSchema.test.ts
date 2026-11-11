import { describe, it, expect } from 'vitest';
import {
  PersonalProfileSchema,
  AddressProfileSchema,
  CircularPreferenceSchema,
  resolveCanonicalValue,
  MasterCanonicalProfile,
} from '../../src/shared/types/canonical-schema';

describe('Layer 1: Canonical Profile Schema & Data Separation', () => {
  it('validates a correct personal profile with Zod', () => {
    const validPersonal = {
      fullName: { english: 'MD. MAHFUZUR RAHMAN', bangla: 'মোঃ মাহফুজুর রহমান' },
      fatherName: { english: 'MD. ABDUR RAHIM', bangla: 'মোঃ আব্দুর রহিম' },
      motherName: { english: 'MST. FATEMA BEGUM', bangla: 'মোছাঃ ফাতেমা বেগম' },
      dateOfBirth: '1998-05-15',
      gender: 'Male',
      nationality: 'Bangladeshi',
      religion: 'Islam',
      maritalStatus: 'Single',
      spouseName: { english: '', bangla: '' },
      identities: { nationalId: '1998123456789', birthRegistration: '', passport: '', passportExpiry: '' },
      contact: { mobile: '01711223344', confirmMobile: '01711223344', email: 'applicant@example.com' },
      quota: 'General',
      departmentalStatus: 'No',
    };

    const parsed = PersonalProfileSchema.safeParse(validPersonal);
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid mobile numbers or dates', () => {
    const invalidPersonal = {
      fullName: { english: 'Test', bangla: '' },
      fatherName: { english: 'Test', bangla: '' },
      motherName: { english: 'Test', bangla: '' },
      dateOfBirth: 'invalid-date',
      gender: 'Male',
      contact: { mobile: '12345', email: 'bad' },
    };

    const parsed = PersonalProfileSchema.safeParse(invalidPersonal);
    expect(parsed.success).toBe(false);
  });

  it('separates circular-specific preferences from permanent profile', () => {
    const circular = CircularPreferenceSchema.parse({
      postName: 'Assistant Director (Technical)',
      postCode: 'BOGMC-101',
      examCentre: 'Dhaka',
      orgChoice1: 'Petrobangla HQ',
      orgChoice2: 'Titas Gas T&D Co.',
    });

    expect(circular.postCode).toBe('BOGMC-101');
    expect(circular.orgChoice1).toBe('Petrobangla HQ');
  });

  it('resolves canonical dot-notation paths correctly', () => {
    const mockProfile: MasterCanonicalProfile = {
      profileId: 'p1',
      profileName: 'Mahfuz Profile',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      personal: {
        fullName: { english: 'MD. MAHFUZUR RAHMAN', bangla: 'মোঃ মাহফুজুর রহমান' },
        fatherName: { english: 'MD. ABDUR RAHIM', bangla: 'মোঃ আব্দুর রহিম' },
        motherName: { english: 'MST. FATEMA BEGUM', bangla: 'মোছাঃ ফাতেমা বেগম' },
        dateOfBirth: '1998-05-15',
        gender: 'Male',
        nationality: 'Bangladeshi',
        religion: 'Islam',
        maritalStatus: 'Single',
        spouseName: { english: '', bangla: '' },
        identities: { nationalId: '987654321', birthRegistration: '', passport: '', passportExpiry: '' },
        contact: { mobile: '01711223344', confirmMobile: '01711223344', email: 'mahfuz@test.com' },
        quota: 'General',
        departmentalStatus: 'No',
      },
      address: {
        present: {
          careOf: 'Father',
          village: 'Road 5, Block B, Mirpur',
          road: '',
          house: '',
          flat: '',
          division: 'Dhaka',
          district: 'Dhaka',
          upazila: 'Mirpur',
          postOffice: 'Mirpur-10',
          postCode: '1216',
        },
        permanent: {
          careOf: 'Father',
          village: 'Village Rampur',
          road: '',
          house: '',
          flat: '',
          division: 'Rajshahi',
          district: 'Bogra',
          upazila: 'Sadar',
          postOffice: 'Rampur',
          postCode: '5800',
        },
        sameAsPresent: false,
      },
      education: {
        ssc: { examination: 'SSC', board: 'Dhaka', roll: '123456', registration: '98765', group: 'Science', result: '5.00', gpa: '5.00', passingYear: '2014' },
        hsc: { examination: 'HSC', board: 'Dhaka', roll: '654321', registration: '98765', group: 'Science', result: '5.00', gpa: '5.00', passingYear: '2016' },
      },
      experiences: [],
      circularPreferences: {
        recruitmentTitle: 'Petrobangla Recruitment',
        postCode: '101',
        postName: 'Assistant Manager',
        department: 'BOGMC',
        examCentre: 'Dhaka',
        questionVersion: 'Bangla',
        cadrePreference: '',
        nonCadrePreference: '',
        quotaDeclaration: 'General',
        orgChoice1: 'Petrobangla HQ',
        orgChoice2: 'Titas Gas',
      },
    };

    expect(resolveCanonicalValue(mockProfile, 'applicant.fullName.english')).toBe('MD. MAHFUZUR RAHMAN');
    expect(resolveCanonicalValue(mockProfile, 'family.father.name.english')).toBe('MD. ABDUR RAHIM');
    expect(resolveCanonicalValue(mockProfile, 'education.ssc.roll')).toBe('123456');
    expect(resolveCanonicalValue(mockProfile, 'education.hsc.roll')).toBe('654321');
    expect(resolveCanonicalValue(mockProfile, 'address.present.district')).toBe('Dhaka');
    expect(resolveCanonicalValue(mockProfile, 'address.permanent.district')).toBe('Bogra');
    expect(resolveCanonicalValue(mockProfile, 'circular.orgChoice1')).toBe('Petrobangla HQ');
  });
});
