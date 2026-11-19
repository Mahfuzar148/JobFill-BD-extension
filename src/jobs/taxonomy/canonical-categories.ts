// JobFill BD - Canonical 18-Category Universal Directory (Categories A through R)
// Unified taxonomy covering all Bangladesh civil service, autonomous, banking, private, NGO, and international sectors.

import type { CategoryLetter, SectorType } from '../types/job-system.types';

export interface CanonicalCategoryDefinition {
  letter: CategoryLetter;
  id: string;
  nameEn: string;
  nameBn: string;
  defaultSector: SectorType;
  subcategories: Array<{ id: string; nameEn: string; nameBn: string }>;
}

export const CANONICAL_18_CATEGORIES: CanonicalCategoryDefinition[] = [
  {
    letter: 'A',
    id: 'govt_civil',
    nameEn: 'Government Jobs',
    nameBn: 'সরকারি চাকরি',
    defaultSector: 'Government',
    subcategories: [
      { id: 'bpsc_cadre', nameEn: 'BCS Cadre', nameBn: 'বিসিএস ক্যাডার' },
      { id: 'bpsc_non_cadre', nameEn: 'BPSC Non-Cadre', nameBn: 'নন-ক্যাডার' },
      { id: 'govt_revenue', nameEn: 'Revenue Budget Posts', nameBn: 'রাজস্ব খাত' },
    ],
  },
  {
    letter: 'B',
    id: 'autonomous_govt',
    nameEn: 'Autonomous Government Organizations',
    nameBn: 'স্বায়ত্তশাসিত সরকারি প্রতিষ্ঠান',
    defaultSector: 'Autonomous',
    subcategories: [
      { id: 'power_energy', nameEn: 'Power & Energy Corporations', nameBn: 'বিদ্যুৎ ও জ্বালানি' },
      { id: 'water_transport', nameEn: 'Water & Port Authorities', nameBn: 'পানি ও বন্দর কর্তৃপক্ষ' },
    ],
  },
  {
    letter: 'C',
    id: 'govt_banks',
    nameEn: 'Government Banks',
    nameBn: 'রাষ্ট্রায়ত্ত ব্যাংক',
    defaultSector: 'Government',
    subcategories: [
      { id: 'central_bank', nameEn: 'Bangladesh Bank', nameBn: 'বাংলাদেশ ব্যাংক' },
      { id: 'state_commercial', nameEn: 'State-Owned Commercial Banks', nameBn: 'রাষ্ট্রায়ত্ত বাণিজ্যিক ব্যাংক' },
      { id: 'specialized_banks', nameEn: 'Specialized Development Banks', nameBn: 'বিশেষায়িত ব্যাংক' },
    ],
  },
  {
    letter: 'D',
    id: 'private_banks',
    nameEn: 'Private Banks',
    nameBn: 'বেসরকারি ব্যাংক',
    defaultSector: 'Private',
    subcategories: [
      { id: 'private_commercial', nameEn: 'Private Commercial Banks', nameBn: 'প্রাইভেট কমার্শিয়াল ব্যাংক' },
      { id: 'islamic_banks', nameEn: 'Islamic Banks', nameBn: 'ইসলামিক ব্যাংক' },
      { id: 'foreign_banks', nameEn: 'Foreign Commercial Banks', nameBn: 'বিদেশি বাণিজ্যিক ব্যাংক' },
    ],
  },
  {
    letter: 'E',
    id: 'financial_institutions',
    nameEn: 'Banking & Financial Institutions',
    nameBn: 'ব্যাংকিং ও আর্থিক প্রতিষ্ঠান',
    defaultSector: 'Private',
    subcategories: [
      { id: 'nbfi', nameEn: 'Non-Banking Financial Institutions', nameBn: 'আর্থিক প্রতিষ্ঠান (এনবিএফআই)' },
      { id: 'insurance', nameEn: 'Insurance Companies', nameBn: 'বীমা কোম্পানি' },
      { id: 'microfinance', nameEn: 'Microfinance Institutions', nameBn: 'ক্ষুদ্রঋণ প্রতিষ্ঠান' },
    ],
  },
  {
    letter: 'F',
    id: 'education_university',
    nameEn: 'Education & University',
    nameBn: 'শিক্ষা ও বিশ্ববিদ্যালয়',
    defaultSector: 'Autonomous',
    subcategories: [
      { id: 'public_university', nameEn: 'Public Universities', nameBn: 'পাবলিক বিশ্ববিদ্যালয়' },
      { id: 'private_university', nameEn: 'Private Universities', nameBn: 'বেসরকারি বিশ্ববিদ্যালয়' },
      { id: 'research_institute_edu', nameEn: 'Affiliated Institutes', nameBn: 'সংযুক্ত শিক্ষা প্রতিষ্ঠান' },
    ],
  },
  {
    letter: 'G',
    id: 'school_college',
    nameEn: 'School & College',
    nameBn: 'স্কুল ও কলেজ',
    defaultSector: 'Government',
    subcategories: [
      { id: 'govt_college', nameEn: 'Government Colleges', nameBn: 'সরকারি কলেজ' },
      { id: 'govt_school', nameEn: 'Government Schools', nameBn: 'সরকারি মাধ্যমিক ও প্রাথমিক বিদ্যালয়' },
      { id: 'mpo_institutes', nameEn: 'Non-Govt MPO-Enlisted Institutes', nameBn: 'এমপিওভুক্ত শিক্ষা প্রতিষ্ঠান' },
    ],
  },
  {
    letter: 'H',
    id: 'medical_healthcare',
    nameEn: 'Medical & Healthcare',
    nameBn: 'চিকিৎসা ও স্বাস্থ্যসেবা',
    defaultSector: 'Government',
    subcategories: [
      { id: 'govt_hospitals', nameEn: 'Government Hospitals & DGHS', nameBn: 'সরকারি হাসপাতাল ও স্বাস্থ্য অধিদপ্তর' },
      { id: 'nursing_midwifery', nameEn: 'Nursing & Midwifery Directorate', nameBn: 'নার্সিং ও মিডওয়াইফারি' },
      { id: 'private_healthcare', nameEn: 'Private Hospitals & Clinics', nameBn: 'বেসরকারি স্বাস্থ্যসেবা' },
    ],
  },
  {
    letter: 'I',
    id: 'defence',
    nameEn: 'Defence',
    nameBn: 'প্রতিরক্ষা বাহিনী',
    defaultSector: 'Government',
    subcategories: [
      { id: 'army_civilian', nameEn: 'Bangladesh Army (Civilian & Uniformed)', nameBn: 'বাংলাদেশ সেনাবাহিনী' },
      { id: 'navy_civilian', nameEn: 'Bangladesh Navy', nameBn: 'বাংলাদেশ নৌবাহিনী' },
      { id: 'airforce_civilian', nameEn: 'Bangladesh Air Force', nameBn: 'বাংলাদেশ বিমান বাহিনী' },
    ],
  },
  {
    letter: 'J',
    id: 'police_law_enforcement',
    nameEn: 'Police & Law Enforcement',
    nameBn: 'পুলিশ ও আইনশৃঙ্খলা রক্ষাকারী বাহিনী',
    defaultSector: 'Government',
    subcategories: [
      { id: 'bd_police', nameEn: 'Bangladesh Police', nameBn: 'বাংলাদেশ পুলিশ' },
      { id: 'rab', nameEn: 'Rapid Action Battalion (RAB)', nameBn: 'র‌্যাব' },
      { id: 'ansar_vdp', nameEn: 'Ansar & VDP', nameBn: 'আনসার ও ভিডিপি' },
    ],
  },
  {
    letter: 'K',
    id: 'ministry_department',
    nameEn: 'Ministry & Government Department',
    nameBn: 'মন্ত্রণালয় ও সরকারি বিভাগ',
    defaultSector: 'Government',
    subcategories: [
      { id: 'secretariat_posts', nameEn: 'Secretariat General Posts', nameBn: 'সচিবালয় সাধারণ পদ' },
      { id: 'ministry_division', nameEn: 'Divisional Administrative Posts', nameBn: 'বিভাগীয় প্রশাসন' },
    ],
  },
  {
    letter: 'L',
    id: 'directorate_office',
    nameEn: 'Directorate & Government Office',
    nameBn: 'অধিদপ্তর ও সরকারি দপ্তর',
    defaultSector: 'Government',
    subcategories: [
      { id: 'dpe_primary', nameEn: 'Directorate of Primary Education (DPE)', nameBn: 'প্রাথমিক শিক্ষা অধিদপ্তর' },
      { id: 'dshe_secondary', nameEn: 'Directorate of Secondary & Higher Education', nameBn: 'মাউশি অধিদপ্তর' },
      { id: 'dghs_directorate', nameEn: 'Directorate General of Health Services', nameBn: 'স্বাস্থ্য অধিদপ্তর' },
    ],
  },
  {
    letter: 'M',
    id: 'engineering_technical',
    nameEn: 'Engineering & Technical',
    nameBn: 'প্রকৌশল ও কারিগরি',
    defaultSector: 'Government',
    subcategories: [
      { id: 'pwd_rhd_lged', nameEn: 'PWD / RHD / LGED Engineering', nameBn: 'পিডব্লিউডি / আরএইচডি / এলজিইডি' },
      { id: 'water_dev_board', nameEn: 'Bangladesh Water Development Board (BWDB)', nameBn: 'পানি উন্নয়ন বোর্ড' },
    ],
  },
  {
    letter: 'N',
    id: 'it_software',
    nameEn: 'IT & Software',
    nameBn: 'আইটি ও সফটওয়্যার',
    defaultSector: 'Government',
    subcategories: [
      { id: 'doict_bcc', nameEn: 'DoICT & Bangladesh Computer Council', nameBn: 'আইসিটি অধিদপ্তর ও বিসিসি' },
      { id: 'private_software', nameEn: 'Private Tech Companies & Startups', nameBn: 'বেসরকারি সফটওয়্যার কোম্পানি' },
    ],
  },
  {
    letter: 'O',
    id: 'private_company',
    nameEn: 'Private Company',
    nameBn: 'বেসরকারি কোম্পানি ও শিল্পপ্রতিষ্ঠান',
    defaultSector: 'Private',
    subcategories: [
      { id: 'pharmaceuticals', nameEn: 'Pharmaceuticals & Healthcare Tech', nameBn: 'ফার্মাসিউটিক্যালস' },
      { id: 'rmg_textile', nameEn: 'RMG & Textile Garments', nameBn: 'আরএমজি ও টেক্সটাইল' },
      { id: 'fmcg_conglomerate', nameEn: 'FMCG & Conglomerates', nameBn: 'ভোগ্যপণ্য ও শিল্প গ্রুপ' },
    ],
  },
  {
    letter: 'P',
    id: 'ngo_development',
    nameEn: 'NGO & Development Organizations',
    nameBn: 'এনজিও ও উন্নয়ন সংস্থা',
    defaultSector: 'NGO',
    subcategories: [
      { id: 'national_ngos', nameEn: 'National NGOs (BRAC, ASA, etc.)', nameBn: 'জাতীয় এনজিও' },
      { id: 'development_programs', nameEn: 'Social Development Projects', nameBn: 'উন্নয়ন প্রকল্প' },
    ],
  },
  {
    letter: 'Q',
    id: 'international_orgs',
    nameEn: 'International Organizations',
    nameBn: 'আন্তর্জাতিক সংস্থা ও দূতাবাস',
    defaultSector: 'International',
    subcategories: [
      { id: 'un_agencies', nameEn: 'UN Agencies (UNDP, UNICEF, WHO)', nameBn: 'জাতিসংঘ সংস্থাসমূহ' },
      { id: 'foreign_missions', nameEn: 'Embassies & High Commissions', nameBn: 'দূতাবাস ও কূটনৈতিক মিশন' },
    ],
  },
  {
    letter: 'R',
    id: 'research_other',
    nameEn: 'Research & Other Organizations',
    nameBn: 'গবেষণা ও অন্যান্য সংস্থা',
    defaultSector: 'Autonomous',
    subcategories: [
      { id: 'scientific_research', nameEn: 'Scientific Research (BCSIR, BARI, BRRI)', nameBn: 'বৈজ্ঞানিক ও কৃষি গবেষণা' },
      { id: 'socio_economic', nameEn: 'Socio-Economic Research (BIDS)', nameBn: 'সামাজিক ও অর্থনৈতিক গবেষণা' },
    ],
  },
];

export function getCanonicalCategoryByLetter(letter: CategoryLetter): CanonicalCategoryDefinition | undefined {
  return CANONICAL_18_CATEGORIES.find((c) => c.letter === letter);
}

export function mapJobToCategoryLetter(jobInput: string | {
  categoryLetter?: string | null;
  category?: string | null;
  taxonomyCategoryId?: string | null;
  organization?: string | null;
  jobTitle?: string | null;
  position?: string | null;
  titleBn?: string | null;
}): CategoryLetter {
  const job = typeof jobInput === 'string'
    ? { category: jobInput, jobTitle: jobInput, organization: jobInput }
    : (jobInput || {});

  if (job.categoryLetter && /^[A-R]$/.test(job.categoryLetter)) {
    return job.categoryLetter as CategoryLetter;
  }

  const text = `${job.organization || ''} ${job.jobTitle || ''} ${job.position || ''} ${job.titleBn || ''}`.toLowerCase();
  const cat = (job.category || '').toLowerCase();
  const taxId = (job.taxonomyCategoryId || '').toLowerCase();

  // Category E: Banking & Financial Institutions (NBFI, Insurance, Microfinance)
  if (
    taxId === 'financial_institutions' ||
    taxId === 'nbfi' ||
    taxId === 'insurance' ||
    taxId === 'microfinance' ||
    cat.includes('nbfi') ||
    cat.includes('insurance') ||
    cat.includes('microfinance') ||
    cat.includes('financial institutions') ||
    cat.includes('financial_institutions') ||
    text.includes('insurance') ||
    text.includes('বীমা') ||
    text.includes('microfinance') ||
    text.includes('ক্ষুদ্রঋণ') ||
    text.includes('nbfi') ||
    text.includes('financial institution') ||
    text.includes('আর্থিক প্রতিষ্ঠান')
  ) {
    return 'E';
  }

  // Banking (C = Govt Bank, D = Private Bank)
  if (text.includes('bangladesh bank') || text.includes('বাংলাদেশ ব্যাংক')) {
    return 'C';
  }
  if (cat.includes('govt bank') || text.includes('govt bank') || cat.includes('government bank') || text.includes('রাষ্ট্রায়ত্ত ব্যাংক')) {
    return 'C';
  }
  if (cat.includes('private bank') || text.includes('private bank') || cat.includes('বেসরকারি ব্যাংক')) {
    return 'D';
  }
  if (cat.includes('bank') || text.includes('bank') || text.includes('ব্যাংক')) {
    if (text.includes('sonali') || text.includes('janata') || text.includes('agrani') || text.includes('rupali') || text.includes('krishi') || text.includes('govt')) {
      return 'C';
    }
    return 'D';
  }

  // Category L: Directorate & Government Office / Primary education / DPE
  if (
    taxId === 'directorate_office' ||
    taxId === 'dpe_primary' ||
    text.includes('primary') ||
    text.includes('প্রাথমিক') ||
    text.includes('dpe') ||
    text.includes('সহকারী শিক্ষক')
  ) {
    return 'L';
  }

  // Category G: School & College
  if (
    taxId === 'school_college' ||
    taxId === 'govt_school' ||
    taxId === 'govt_college' ||
    taxId === 'mpo_institutes' ||
    cat.includes('school') ||
    cat.includes('college') ||
    text.includes('school') ||
    text.includes('college') ||
    text.includes('বিদ্যালয়') ||
    text.includes('কলেজ') ||
    text.includes('মাধ্যমিক') ||
    text.includes('mpo')
  ) {
    return 'G';
  }

  // Category M: Engineering & Technical (PWD, RHD, LGED, BWDB)
  if (
    taxId === 'engineering_technical' ||
    taxId === 'pwd_rhd_lged' ||
    taxId === 'water_dev_board' ||
    cat.includes('engineering') ||
    cat.includes('technical') ||
    text.includes('engineering') ||
    text.includes('প্রকৌশল') ||
    text.includes('কারিগরি') ||
    /\bpwd\b/i.test(text) ||
    /\brhd\b/i.test(text) ||
    /\blged\b/i.test(text) ||
    /\bbwdb\b/i.test(text) ||
    text.includes('পানি উন্নয়ন বোর্ড')
  ) {
    return 'M';
  }

  // Category R: Research & Other Organizations (BCSIR, BARI, BRRI, BIDS)
  if (
    taxId === 'research_other' ||
    taxId === 'scientific_research' ||
    taxId === 'socio_economic' ||
    cat.includes('research') ||
    text.includes('research') ||
    text.includes('গবেষণা') ||
    /\bbcsir\b/i.test(text) ||
    /\bbari\b/i.test(text) ||
    /\bbrri\b/i.test(text) ||
    /\bbids\b/i.test(text)
  ) {
    return 'R';
  }

  // BPSC & Civil service / Judicial (Category A)
  if (
    taxId === 'bpsc_cadre' ||
    taxId === 'bpsc_non_cadre' ||
    taxId === 'govt_revenue' ||
    text.includes('bpsc') ||
    text.includes('বিসিএস') ||
    text.includes('bcs') ||
    text.includes('কর্ম কমিশন') ||
    text.includes('judicial') ||
    cat.includes('judicial')
  ) {
    return 'A';
  }

  // Category K: Ministry & Government Department
  if (
    taxId === 'ministry_department' ||
    taxId === 'secretariat_posts' ||
    taxId === 'ministry_division' ||
    cat.includes('ministry') ||
    text.includes('ministry') ||
    text.includes('মন্ত্রণালয়') ||
    text.includes('সচিবালয়')
  ) {
    return 'K';
  }

  // Autonomous (Category B)
  if (cat.includes('autonomous') || text.includes('autonomous') || text.includes('authority') || text.includes('কর্তৃপক্ষ')) {
    return 'B';
  }

  // University (Category F)
  if (cat.includes('university') || text.includes('university') || text.includes('বিশ্ববিদ্যালয়')) {
    return 'F';
  }

  // Defence (Category I)
  if (cat.includes('defence') || text.includes('army') || text.includes('navy') || text.includes('air force') || text.includes('সেনাবাহিনী')) {
    return 'I';
  }

  // Police (Category J)
  if (cat.includes('police') || text.includes('rab') || text.includes('পুলিশ')) {
    return 'J';
  }

  // Healthcare (Category H)
  if (cat.includes('medical') || text.includes('hospital') || text.includes('হাসপাতাল') || text.includes('doctor') || text.includes('dghs')) {
    return 'H';
  }

  // IT & Software (Category N) - Strict word boundary to avoid false matching on "Security", "Audit", "Recruitment", "financial_institutions"
  const isItMatch =
    taxId === 'it_software' ||
    taxId === 'doict_bcc' ||
    taxId === 'private_software' ||
    /\bit\b/i.test(cat) ||
    /\bit\b/i.test(taxId) ||
    cat.includes('technology') ||
    cat.includes('software') ||
    text.includes('software') ||
    text.includes('programmer') ||
    text.includes('তথ্যপ্রযুক্তি');

  if (isItMatch) {
    return 'N';
  }

  // NGO (Category P)
  if (cat.includes('ngo') || text.includes('ngo') || text.includes('brac') || text.includes('asa')) {
    return 'P';
  }

  // International (Category Q)
  if (cat.includes('international') || text.includes('unicef') || text.includes('undp') || text.includes('embassy')) {
    return 'Q';
  }

  // Directorate & Government Office if mentioned "অধিদপ্তর" (Category L)
  if (cat.includes('directorate') || text.includes('অধিদপ্তর')) {
    return 'L';
  }

  // Ministry & Government (Category A fallback)
  if (cat.includes('government') || text.includes('সরকারি')) {
    return 'A';
  }

  // Private company default (Category O)
  if (cat.includes('private') || text.includes('private') || text.includes('বেসরকারি')) {
    return 'O';
  }

  return 'A';
}
