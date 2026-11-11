import { DashboardTab } from '../components/Sidebar';

export interface ProfileFieldSearchEntry {
  id: string;
  tab: DashboardTab;
  labelEn: string;
  labelBn: string;
  sectionEn: string;
  sectionBn: string;
  matchHint: string;
  keywords: string[];
}

export const PROFILE_FIELD_SEARCH_INDEX: ProfileFieldSearchEntry[] = [
  {
    id: 'personal.applicantNameEn',
    tab: 'personal',
    labelEn: "Applicant's Full Name (English)",
    labelBn: 'আবেদনকারীর নাম (ইংরেজি)',
    sectionEn: 'Personal Info',
    sectionBn: 'ব্যক্তিগত তথ্য',
    matchHint: "Applicant's Name",
    keywords: ['name', 'full name', 'applicant', 'নাম', 'english'],
  },
  {
    id: 'personal.applicantNameBn',
    tab: 'personal',
    labelEn: "Applicant's Name (Bangla)",
    labelBn: 'আবেদনকারীর নাম (বাংলা)',
    sectionEn: 'Personal Info',
    sectionBn: 'ব্যক্তিগত তথ্য',
    matchHint: 'বাংলায়',
    keywords: ['bangla name', 'বাংলা নাম', 'আবেদনকারীর নাম'],
  },
  {
    id: 'personal.dob',
    tab: 'personal',
    labelEn: 'Date of Birth (DOB)',
    labelBn: 'জন্ম তারিখ',
    sectionEn: 'Personal Info',
    sectionBn: 'ব্যক্তিগত তথ্য',
    matchHint: 'Date of Birth',
    keywords: ['dob', 'birth', 'date', 'age', 'জন্ম', 'বয়স'],
  },
  {
    id: 'personal.nationalId',
    tab: 'personal',
    labelEn: 'National ID (NID / Smart Card)',
    labelBn: 'জাতীয় পরিচয়পত্র (NID)',
    sectionEn: 'Personal Info',
    sectionBn: 'ব্যক্তিগত তথ্য',
    matchHint: 'National ID',
    keywords: ['nid', 'national id', 'smart card', 'পরিচয়পত্র', 'এনআইডি'],
  },
  {
    id: 'personal.birthRegistration',
    tab: 'personal',
    labelEn: 'Birth Registration Number',
    labelBn: 'জন্ম নিবন্ধন নম্বর',
    sectionEn: 'Personal Info',
    sectionBn: 'ব্যক্তিগত তথ্য',
    matchHint: 'Birth Registration',
    keywords: ['birth registration', 'brc', 'জন্ম নিবন্ধন'],
  },
  {
    id: 'personal.passport',
    tab: 'personal',
    labelEn: 'Passport Number',
    labelBn: 'পাসপোর্ট নম্বর',
    sectionEn: 'Personal Info',
    sectionBn: 'ব্যক্তিগত তথ্য',
    matchHint: 'Passport',
    keywords: ['passport', 'পাসপোর্ট'],
  },
  {
    id: 'personal.mobile',
    tab: 'personal',
    labelEn: 'Mobile Number & Email',
    labelBn: 'মোবাইল নম্বর ও ইমেইল',
    sectionEn: 'Personal Info',
    sectionBn: 'ব্যক্তিগত তথ্য',
    matchHint: 'Mobile',
    keywords: ['mobile', 'phone', 'contact', 'email', 'sms', 'মোবাইল', 'ফোন', 'ইমেইল'],
  },
  {
    id: 'personal.religionGender',
    tab: 'personal',
    labelEn: 'Religion, Gender & Marital Status',
    labelBn: 'ধর্ম, লিঙ্গ ও বৈবাহিক অবস্থা',
    sectionEn: 'Personal Info',
    sectionBn: 'ব্যক্তিগত তথ্য',
    matchHint: 'Religion',
    keywords: ['religion', 'gender', 'marital', 'ধর্ম', 'লিঙ্গ', 'বৈবাহিক'],
  },
  {
    id: 'family.fatherName',
    tab: 'family',
    labelEn: "Father's & Mother's Name",
    labelBn: 'পিতা ও মাতার নাম',
    sectionEn: 'Family Info',
    sectionBn: 'পারিবারিক তথ্য',
    matchHint: "Father's Name",
    keywords: ['father', 'mother', 'guardian', 'spouse', 'পিতা', 'মাতা', 'বাবা', 'মা'],
  },
  {
    id: 'address.present',
    tab: 'address',
    labelEn: 'Present & Permanent Address (Division, District, Upazila)',
    labelBn: 'বর্তমান ও স্থায়ী ঠিকানা (বিভাগ, জেলা, উপজেলা)',
    sectionEn: 'Address',
    sectionBn: 'ঠিকানা',
    matchHint: 'District',
    keywords: ['address', 'present', 'permanent', 'division', 'district', 'upazila', 'thana', 'post office', 'post code', 'ঠিকানা', 'জেলা', 'উপজেলা', 'বিভাগ'],
  },
  {
    id: 'education.ssc',
    tab: 'education',
    labelEn: 'SSC / H.S.C / Graduation / Masters Results',
    labelBn: 'এসএসসি, এইচএসসি, স্নাতক ও স্নাতকোত্তর তথ্য',
    sectionEn: 'Education',
    sectionBn: 'শিক্ষাগত যোগ্যতা',
    matchHint: 'SSC',
    keywords: ['education', 'ssc', 'hsc', 'graduation', 'honours', 'bachelor', 'masters', 'cgpa', 'gpa', 'board', 'roll', 'শিক্ষা', 'বোর্ড', 'রোল'],
  },
  {
    id: 'additional.skills',
    tab: 'additional',
    labelEn: 'Computer Literacy, Skills & Training',
    labelBn: 'কম্পিউটার দক্ষতা ও প্রশিক্ষণ',
    sectionEn: 'Skills & Training',
    sectionBn: 'দক্ষতা ও প্রশিক্ষণ',
    matchHint: 'Skill',
    keywords: ['skill', 'training', 'computer', 'typing', 'language', 'দক্ষতা', 'প্রশিক্ষণ', 'কম্পিউটার'],
  },
  {
    id: 'experience.work',
    tab: 'experience',
    labelEn: 'Work / Job Experience Records',
    labelBn: 'চাকরির অভিজ্ঞতার তথ্য',
    sectionEn: 'Experience',
    sectionBn: 'চাকরির অভিজ্ঞতা',
    matchHint: 'Designation',
    keywords: ['experience', 'job', 'designation', 'organization', 'অভিজ্ঞতা', 'পদবি'],
  },
  {
    id: 'documents.photoSig',
    tab: 'documents',
    labelEn: 'Photo (300×300), Signature (300×80), CV & Certificates',
    labelBn: 'ছবি (৩০০×৩০০), স্বাক্ষর (৩০০×৮০), সিভি ও সনদপত্র',
    sectionEn: 'Documents & Photos',
    sectionBn: 'ছবি ও সনদপত্র',
    matchHint: 'Photo',
    keywords: ['photo', 'signature', 'sign', 'cv', 'resume', 'certificate', 'nid doc', 'crop', 'resize', 'ছবি', 'স্বাক্ষর', 'সিভি', 'সনদ'],
  },
  {
    id: 'preferences.quota',
    tab: 'preferences',
    labelEn: 'Quota, Departmental Candidate & BCS Cadre Preferences',
    labelBn: 'কোটা, বিভাগীয় প্রার্থী ও বিসিএস ক্যাডার পছন্দক্রম',
    sectionEn: 'Preferences & Quota',
    sectionBn: 'বিশেষ তথ্য ও পছন্দক্রম',
    matchHint: 'Quota',
    keywords: ['quota', 'freedom fighter', 'bcs', 'cadre', 'departmental', 'exam center', 'কোটা', 'ক্যাডার'],
  },
  {
    id: 'tracker.applications',
    tab: 'tracker',
    labelEn: 'Application Tracker (Teletalk User ID & 72h Fee Alert)',
    labelBn: 'আবেদন ট্র্যাকার (Teletalk User ID ও ৭২ ঘণ্টা ফি অ্যালার্ট)',
    sectionEn: 'Application Tracker',
    sectionBn: 'আবেদন ট্র্যাকার',
    matchHint: 'User ID',
    keywords: ['tracker', 'teletalk', 'user id', 'fee', 'payment', 'admit', 'exam roll', 'venue', 'ট্র্যাকার', 'ইউজার আইডি', 'ফি'],
  },
  {
    id: 'circulars.hub',
    tab: 'circulars',
    labelEn: 'Bangladesh Govt Job Circulars & Eligibility Check',
    labelBn: 'সরকারি চাকরির বিজ্ঞপ্তি ও বয়স/যোগ্যতা যাচাই',
    sectionEn: 'Job Circulars',
    sectionBn: 'চাকরির বিজ্ঞপ্তি',
    matchHint: 'Circular',
    keywords: ['circular', 'job', 'deadline', 'govt', 'bpsc', 'bank', 'age calculator', 'বিজ্ঞপ্তি', 'চাকরি'],
  },
  {
    id: 'mappings.saved',
    tab: 'mappings',
    labelEn: 'Saved Field Mappings (Memory)',
    labelBn: 'সংরক্ষিত ফিল্ড ম্যাপিং',
    sectionEn: 'Saved Mappings',
    sectionBn: 'সংরক্ষিত ম্যাপিং',
    matchHint: 'Mapping',
    keywords: ['mapping', 'saved rule', 'teach field', 'ম্যাপিং'],
  },
  {
    id: 'security.vault',
    tab: 'security',
    labelEn: 'Master Password & Local Vault Encryption',
    labelBn: 'মাস্টার পাসওয়ার্ড ও লোকাল ভল্ট এনক্রিপশন',
    sectionEn: 'Security & Vault',
    sectionBn: 'সিকিউরিটি ও ভল্ট',
    matchHint: 'Password',
    keywords: ['security', 'password', 'lock', 'encrypt', 'vault', 'পাসওয়ার্ড', 'ভল্ট'],
  },
  {
    id: 'settings.backup',
    tab: 'settings',
    labelEn: 'Encrypted Backup, JSON Export & Diagnostics',
    labelBn: 'এনক্রিপ্টেড ব্যাকআপ, JSON এক্সপোর্ট ও সেটিংস',
    sectionEn: 'Settings',
    sectionBn: 'সেটিংস',
    matchHint: 'Export',
    keywords: ['backup', 'export', 'import', 'json', 'restore', 'settings', 'ব্যাকআপ', 'এক্সপোর্ট'],
  },
];

export function searchProfileFields(query: string, limit = 8): ProfileFieldSearchEntry[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  const tokens = normalized.split(/\s+/).filter(Boolean);
  const scored = PROFILE_FIELD_SEARCH_INDEX.map((entry) => {
    const haystack = [
      entry.labelEn,
      entry.labelBn,
      entry.sectionEn,
      entry.sectionBn,
      entry.matchHint,
      ...entry.keywords,
    ]
      .join(' ')
      .toLowerCase();

    let score = 0;
    for (const token of tokens) {
      if (entry.labelEn.toLowerCase().includes(token) || entry.labelBn.toLowerCase().includes(token)) {
        score += 3;
      } else if (entry.keywords.some((k) => k.toLowerCase().includes(token))) {
        score += 2;
      } else if (haystack.includes(token)) {
        score += 1;
      } else {
        return { entry, score: -1 };
      }
    }
    return { entry, score };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => s.entry);
}
