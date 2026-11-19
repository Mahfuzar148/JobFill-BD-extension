// JobFill BD - Universal Job Category & Industry Taxonomy (27 Categories)
// Centralized, extensible, data-driven taxonomy covering Bangladesh & international employment markets.
// Allows adding new categories without rewriting adapters or UI components.

export * from './canonical-categories';

export type EmployerType =
  | 'Government'
  | 'Government Ministry'
  | 'Directorate / Department'
  | 'Autonomous'
  | 'Autonomous Organization'
  | 'Public University'
  | 'Bank'
  | 'Central Bank'
  | 'Commercial Bank'
  | 'Specialized Bank'
  | 'NBFI'
  | 'Private'
  | 'Private Enterprise'
  | 'Multinational'
  | 'NGO'
  | 'NGO / INGO'
  | 'International'
  | 'Other';

export type TaxonomyEmploymentType =
  | 'Full-Time'
  | 'Part-Time'
  | 'Permanent'
  | 'Temporary'
  | 'Contractual'
  | 'Project-Based'
  | 'Internship'
  | 'Apprenticeship'
  | 'Freelance'
  | 'Seasonal'
  | 'Commission-Based';

export type WorkMode = 'On-Site' | 'Remote' | 'Hybrid' | 'Field-Based' | 'Unspecified';

export type ExperienceLevel =
  | 'No Experience'
  | 'Fresh Graduate'
  | 'Fresh Graduate / Entry-Level'
  | 'Entry-Level'
  | '1–3 Years'
  | 'Mid-Level (1-4 years)'
  | '3–5 Years'
  | '5+ Years'
  | 'Senior'
  | 'Senior Level (5+ years)'
  | 'Managerial'
  | 'Leadership / Executive'
  | 'Not Specified';

export interface SubcategoryDefinition {
  id: string;
  labelEn: string;
  labelBn: string;
  keywordsEn: string[];
  keywordsBn: string[];
  synonymsEn?: string[];
  synonymsBn?: string[];
}

export interface MainCategoryDefinition {
  id: string;
  code: string; // e.g., '01', '02', ..., '27'
  letter?: string; // backward-compatibility letter (A, B, C...)
  labelEn: string;
  labelBn: string;
  aliasesEn: string[];
  aliasesBn: string[];
  industry: string;
  defaultEmployerType: EmployerType;
  keywordsEn: string[];
  keywordsBn: string[];
  synonymsEn: string[];
  synonymsBn: string[];
  relatedTitlesEn?: string[];
  relatedTitlesBn?: string[];
  iconName: string;
  subcategories: SubcategoryDefinition[];
  isActive: boolean;
  isDeprecated?: boolean;
}

export interface ProposedCategory {
  id: string;
  proposedTitleEn: string;
  proposedTitleBn: string;
  parentCategoryId?: string;
  justification: string;
  submittedAt: number;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
}

export const UNIVERSAL_JOB_TAXONOMY: MainCategoryDefinition[] = [
  // 01. Government & Public Sector
  {
    id: 'govt_public',
    code: '01',
    letter: 'A',
    labelEn: 'Government & Public Sector',
    labelBn: 'সরকারি ও স্বায়ত্তশাসিত চাকরি',
    aliasesEn: ['gov_public', 'government', 'public sector', 'civil service', 'bcs', 'govt'],
    aliasesBn: ['সরকারি', 'সরকারী চাকরি', 'পাবলিক সার্ভিস', 'বিসিএস'],
    industry: 'Public Administration & Civil Service',
    defaultEmployerType: 'Government',
    iconName: 'Building2',
    keywordsEn: ['government', 'govt', 'bcs', 'ministry', 'directorate', 'cadre', 'public service', 'teletalk', 'bpsc', 'secretariat'],
    keywordsBn: ['সরকারি', 'সরকারী', 'মন্ত্রণালয়', 'অধিদপ্তর', 'বিসিএস', 'ক্যাডার', 'কর্ম কমিশন', 'স্বায়ত্তশাসিত', 'সচিবালয়'],
    synonymsEn: ['Public Administration', 'Civil Service', 'State Organs', 'Public Office'],
    synonymsBn: ['জনপ্রশাসন', 'সিভিল সার্ভিস', 'সরকারি দপ্তর', 'রাষ্ট্রীয় সেবা'],
    relatedTitlesEn: ['Assistant Commissioner', 'Administrative Officer', 'Section Officer', 'Director', 'Magistrate'],
    relatedTitlesBn: ['সহকারী কমিশনার', 'প্রশাসনিক কর্মকর্তা', 'সেকশন অফিসার', 'পরিচালক', 'ম্যাজিস্ট্রেট'],
    isActive: true,
    subcategories: [
      { id: 'bcs_civil', labelEn: 'BCS & Civil Service', labelBn: 'বিসিএস ও সিভিল সার্ভিস', keywordsEn: ['bcs', 'cadre', 'civil service', 'assistant commissioner'], keywordsBn: ['বিসিএস', 'ক্যাডার', 'সিভিল সার্ভিস', 'সহকারী কমিশনার'] },
      { id: 'ministry', labelEn: 'Ministry', labelBn: 'মন্ত্রণালয়', keywordsEn: ['ministry', 'secretariat', 'assistant secretary'], keywordsBn: ['মন্ত্রণালয়', 'সচিবালয়', 'সহকারী সচিব'] },
      { id: 'directorate', labelEn: 'Directorate', labelBn: 'অধিদপ্তর ও পরিদপ্তর', keywordsEn: ['directorate', 'department', 'dg'], keywordsBn: ['অধিদপ্তর', 'পরিদপ্তর', 'বোর্ড'] },
      { id: 'autonomous', labelEn: 'Autonomous Organization', labelBn: 'স্বায়ত্তশাসিত সংস্থা', keywordsEn: ['autonomous', 'corporation', 'authority', 'bida', 'bsec'], keywordsBn: ['স্বায়ত্তশাসিত', 'কর্পোরেশন', 'কর্তৃপক্ষ'] },
      { id: 'public_university', labelEn: 'Public University', labelBn: 'পাবলিক বিশ্ববিদ্যালয়', keywordsEn: ['public university', 'dhaka university', 'buet', 'ru', 'cu'], keywordsBn: ['পাবলিক বিশ্ববিদ্যালয়', 'বিশ্ববিদ্যালয়'] },
      { id: 'govt_bank', labelEn: 'Government Bank', labelBn: 'সরকারি ব্যাংক', keywordsEn: ['sonali bank', 'janata bank', 'agrani bank', 'rupali bank', 'bsc'], keywordsBn: ['সোনালী ব্যাংক', 'জনতা ব্যাংক', 'অগ্রণী ব্যাংক', 'রূপালী ব্যাংক'] },
      { id: 'local_govt', labelEn: 'Local Government', labelBn: 'স্থানীয় সরকার (সিটি কর্পোরেশন/পৌরসভা)', keywordsEn: ['city corporation', 'pourashava', 'union parishad', 'upazila'], keywordsBn: ['সিটি কর্পোরেশন', 'পৌরসভা', 'উপজেলা পরিষদ'] },
      { id: 'judiciary', labelEn: 'Judiciary', labelBn: 'বিচার বিভাগ ও আইন সেবা', keywordsEn: ['judiciary', 'judicial', 'bjsc', 'sub-registrar', 'court'], keywordsBn: ['বিচার বিভাগ', 'জুডিসিয়াল', 'সাব-রেজিস্ট্রার', 'আদালত'] },
      { id: 'public_utilities', labelEn: 'Public Utilities', labelBn: 'পাবলিক ইউটিলিটি ও জনসেবা', keywordsEn: ['wasa', 'utility', 'desco', 'dpdc', 'titas'], keywordsBn: ['ওয়াসা', 'ইউটিলিটি', 'তিতাস গ্যাস'] },
      { id: 'govt_project', labelEn: 'Government Project', labelBn: 'সরকারি প্রকল্প চাকরি', keywordsEn: ['government project', 'development project', 'mega project'], keywordsBn: ['প্রকল্প', 'উন্নয়ন প্রকল্প'] },
      { id: 'public_corp', labelEn: 'Public Corporation', labelBn: 'পাবলিক কর্পোরেশন', keywordsEn: ['petrobangla', 'bpc', 'bcic', 'biman'], keywordsBn: ['পেট্রোবাংলা', 'বিপিসি', 'বিসিআইসি'] },
    ],
  },

  // 02. Banking & Finance
  {
    id: 'banking_finance',
    code: '02',
    letter: 'B',
    labelEn: 'Banking & Finance',
    labelBn: 'ব্যাংক ও আর্থিক প্রতিষ্ঠান',
    aliasesEn: ['bank_finance', 'banking', 'finance', 'banks', 'financial'],
    aliasesBn: ['ব্যাংক', 'আর্থিক প্রতিষ্ঠান', 'ব্যাংকিং'],
    industry: 'Financial Services & Banking',
    defaultEmployerType: 'Bank',
    iconName: 'Landmark',
    keywordsEn: ['bank', 'banking', 'finance', 'financial', 'insurance', 'nbfi', 'audit', 'accounting', 'tax', 'fintech'],
    keywordsBn: ['ব্যাংক', 'আর্থিক প্রতিষ্ঠান', 'বীমা', 'ফিন্যান্স', 'অডিট', 'হিসাবরক্ষণ', 'ট্যাক্স', 'ভ্যাট'],
    synonymsEn: ['Banking', 'Capital Markets', 'Wealth Management', 'Financial Operations'],
    synonymsBn: ['ব্যাংকিং খাত', 'পুঁজিবাজার', 'অর্থায়ন', 'আর্থিক ব্যবস্থাপনা'],
    relatedTitlesEn: ['Assistant Director', 'Officer Cash', 'Credit Analyst', 'Branch Manager', 'Auditor'],
    relatedTitlesBn: ['সহকারী পরিচালক', 'অফিসার ক্যাশ', 'ক্রেডিট অ্যানালিস্ট', 'শাখা ব্যবস্থাপক', 'নিরীক্ষক'],
    isActive: true,
    subcategories: [
      { id: 'central_bank', labelEn: 'Central Bank', labelBn: 'বাংলাদেশ ব্যাংক (কেন্দ্রীয় ব্যাংক)', keywordsEn: ['bangladesh bank', 'central bank', 'ad', 'assistant director'], keywordsBn: ['বাংলাদেশ ব্যাংক', 'সহকারী পরিচালক'] },
      { id: 'public_bank', labelEn: 'Public Bank', labelBn: 'সরকারি ব্যাংক', keywordsEn: ['sonali', 'janata', 'agrani', 'rupali', 'bkb', 'rakub'], keywordsBn: ['সোনালী', 'জনতা', 'অগ্রণী', 'রূপালী', 'কৃষি ব্যাংক'] },
      { id: 'private_bank', labelEn: 'Private Bank', labelBn: 'বেসরকারি বাণিজ্যিক ব্যাংক', keywordsEn: ['brac bank', 'ebl', 'city bank', 'dhaka bank', 'prime bank', 'mtb', 'ucb', 'scb'], keywordsBn: ['ব্র্যাক ব্যাংক', 'ইস্টার্ন ব্যাংক', 'দি সিটি ব্যাংক', 'প্রাইম ব্যাংক'] },
      { id: 'nbfi', labelEn: 'NBFI', labelBn: 'আর্থিক প্রতিষ্ঠান (এনবিএফআই)', keywordsEn: ['nbfi', 'idlc', 'ipdc', 'lanka bangla', 'leasing'], keywordsBn: ['আইডিএলসি', 'আইপিডিসি', 'লিজিং'] },
      { id: 'insurance', labelEn: 'Insurance', labelBn: 'বীমা (জীবন ও সাধারণ)', keywordsEn: ['insurance', 'life insurance', 'general insurance'], keywordsBn: ['বীমা', 'ইন্স্যুরেন্স', 'জীবন বীমা'] },
      { id: 'microfinance', labelEn: 'Microfinance', labelBn: 'ক্ষুদ্রঋণ ও পল্লী উন্নয়ন', keywordsEn: ['microfinance', 'grameen', 'asa', 'tmss', 'buro'], keywordsBn: ['ক্ষুদ্রঋণ', 'গ্রামীণ ব্যাংক', 'আশা', 'টিএমএসএস'] },
      { id: 'accounting', labelEn: 'Accounting', labelBn: 'অ্যাকাউন্টিং ও হিসাবরক্ষণ', keywordsEn: ['accountant', 'accounts officer', 'ca', 'cma'], keywordsBn: ['অ্যাকাউন্টস', 'হিসাবরক্ষক'] },
      { id: 'audit', labelEn: 'Audit', labelBn: 'অভ্যন্তরীণ ও বাহ্যিক অডিট', keywordsEn: ['auditor', 'internal audit', 'audit officer'], keywordsBn: ['অডিট', 'নিরীক্ষা', 'নিরীক্ষক'] },
      { id: 'tax_vat', labelEn: 'Tax & VAT', labelBn: 'ট্যাক্স, ভ্যাট ও শুল্ক', keywordsEn: ['tax', 'vat', 'customs', 'tax consultant', 'nbr'], keywordsBn: ['ট্যাক্স', 'ভ্যাট', 'আয়কর', 'কাস্টমস'] },
      { id: 'fintech', labelEn: 'Fintech', labelBn: 'ফিনটেক ও মোবাইল ব্যাংকিং', keywordsEn: ['fintech', 'bkash', 'nagad', 'upay', 'rocket', 'payment gateway'], keywordsBn: ['ফিনটেক', 'বিকাশ', 'নগদ', 'রকেট'] },
      { id: 'investment', labelEn: 'Investment & Financial Analysis', labelBn: 'বিনিয়োগ ও আর্থিক বিশ্লেষণ', keywordsEn: ['investment', 'equity research', 'financial analyst', 'portfolio'], keywordsBn: ['বিনিয়োগ', 'আর্থিক বিশ্লেষক'] },
    ],
  },

  // 03. Education & Research
  {
    id: 'education_research',
    code: '03',
    letter: 'C',
    labelEn: 'Education & Research',
    labelBn: 'শিক্ষা ও গবেষণা',
    aliasesEn: ['education', 'research', 'teaching', 'academic'],
    aliasesBn: ['শিক্ষা', 'গবেষণা', 'শিক্ষকতা'],
    industry: 'Education & Academic Training',
    defaultEmployerType: 'Autonomous',
    iconName: 'GraduationCap',
    keywordsEn: ['teacher', 'faculty', 'lecturer', 'professor', 'education', 'school', 'college', 'madrasa', 'ntrca', 'dpe', 'research'],
    keywordsBn: ['শিক্ষক', 'প্রভাষক', 'অধ্যাপক', 'শিক্ষা', 'স্কুল', 'কলেজ', 'মাদ্রাসা', 'এনটিআরসিএ', 'ডিপিই', 'গবেষণা'],
    synonymsEn: ['Pedagogy', 'Academia', 'Instructional Training', 'Scholarly Research'],
    synonymsBn: ['শিক্ষাদান', 'একাডেমিক শিক্ষা', 'পাঠদান', 'গবেষণা কর্ম'],
    relatedTitlesEn: ['Headmaster', 'Principal', 'Lecturer', 'Assistant Teacher', 'Research Fellow'],
    relatedTitlesBn: ['প্রধান শিক্ষক', 'অধ্যক্ষ', 'প্রভাষক', 'সহকারী শিক্ষক', 'গবেষক'],
    isActive: true,
    subcategories: [
      { id: 'primary_teacher', labelEn: 'Primary Teacher', labelBn: 'প্রাথমিক বিদ্যালয় শিক্ষক', keywordsEn: ['primary teacher', 'assistant teacher', 'dpe'], keywordsBn: ['প্রাথমিক শিক্ষক', 'সহকারী শিক্ষক', 'ডিপিই'] },
      { id: 'school_teacher', labelEn: 'School Teacher', labelBn: 'মাধ্যমিক বিদ্যালয় শিক্ষক', keywordsEn: ['high school teacher', 'assistant teacher', 'ntrca'], keywordsBn: ['মাধ্যমিক শিক্ষক', 'সহকারী শিক্ষক'] },
      { id: 'college_teacher', labelEn: 'College Teacher', labelBn: 'কলেজ প্রভাষক ও শিক্ষক', keywordsEn: ['college lecturer', 'assistant professor', 'bcs general education'], keywordsBn: ['কলেজ প্রভাষক', 'সহকারী অধ্যাপক'] },
      { id: 'university_faculty', labelEn: 'University Faculty', labelBn: 'বিশ্ববিদ্যালয় শিক্ষক ও অধ্যাপক', keywordsEn: ['university faculty', 'lecturer', 'professor', 'associate professor'], keywordsBn: ['বিশ্ববিদ্যালয় শিক্ষক', 'প্রভাষক', 'অধ্যাপক'] },
      { id: 'lecturer', labelEn: 'Lecturer', labelBn: 'প্রভাষক', keywordsEn: ['lecturer', 'college lecturer'], keywordsBn: ['প্রভাষক'] },
      { id: 'professor', labelEn: 'Professor', labelBn: 'অধ্যাপক', keywordsEn: ['professor', 'associate professor'], keywordsBn: ['অধ্যাপক', 'সহযোগী অধ্যাপক'] },
      { id: 'madrasa_teacher', labelEn: 'Madrasa Teacher', labelBn: 'মাদ্রাসা শিক্ষক', keywordsEn: ['madrasa', 'alim', 'fazil', 'kamil', 'quranic teacher'], keywordsBn: ['মাদ্রাসা শিক্ষক', 'মৌলভী', 'মুহাদ্দিস'] },
      { id: 'researcher', labelEn: 'Researcher', labelBn: 'গবেষক ও ফেলো', keywordsEn: ['researcher', 'research fellow', 'scientist', 'phd candidate'], keywordsBn: ['গবেষক', 'ফেলো', 'বিজ্ঞানী'] },
      { id: 'academic_admin', labelEn: 'Academic Administration', labelBn: 'শিক্ষা প্রশাসন', keywordsEn: ['principal', 'headmaster', 'registrar', 'education officer', 'ueo'], keywordsBn: ['অধ্যক্ষ', 'প্রধান শিক্ষক', 'রেজিস্ট্রার', 'শিক্ষা কর্মকর্তা'] },
      { id: 'training_coaching', labelEn: 'Training and Coaching', labelBn: 'প্রশিক্ষণ ও কোচিং', keywordsEn: ['trainer', 'coach', 'instructor', 'ielts instructor'], keywordsBn: ['প্রশিক্ষক', 'ইন্সট্রাক্টর', 'ট্রেইনার'] },
    ],
  },

  // 04. Medical & Healthcare
  {
    id: 'medical_healthcare',
    code: '04',
    letter: 'D',
    labelEn: 'Medical & Healthcare',
    labelBn: 'চিকিৎসা ও স্বাস্থ্যসেবা',
    aliasesEn: ['medical', 'healthcare', 'health', 'hospital', 'pharma'],
    aliasesBn: ['মেডিকেল', 'চিকিৎসা', 'স্বাস্থ্য', 'হাসপাতাল'],
    industry: 'Healthcare & Pharmaceuticals',
    defaultEmployerType: 'Government',
    iconName: 'Stethoscope',
    keywordsEn: ['doctor', 'nurse', 'medical', 'hospital', 'health', 'clinic', 'pharma', 'dghs', 'mbbs', 'pharmacist'],
    keywordsBn: ['ডাক্তার', 'চিকিৎসক', 'নার্স', 'সেবিকা', 'হাসপাতাল', 'স্বাস্থ্য', 'ফার্মাসিস্ট', 'ঔষধ', 'মেডিকেল'],
    synonymsEn: ['Healthcare', 'Clinical Medicine', 'Nursing Care', 'Pharmaceutical Science'],
    synonymsBn: ['স্বাস্থ্যসেবা', 'চিকিৎসা বিজ্ঞান', 'নার্সিং', 'ফার্মাসিউটিক্যালস'],
    relatedTitlesEn: ['Medical Officer', 'Staff Nurse', 'Consultant', 'Hospital Administrator', 'Pharmacist'],
    relatedTitlesBn: ['মেডিকেল অফিসার', 'স্টাফ নার্স', 'পরামর্শক চিকিৎসক', 'ফার্মাসিস্ট'],
    isActive: true,
    subcategories: [
      { id: 'doctor', labelEn: 'Doctor', labelBn: 'মেডিকেল অফিসার ও চিকিৎসক', keywordsEn: ['doctor', 'medical officer', 'mbbs', 'resident'], keywordsBn: ['ডাক্তার', 'মেডিকেল অফিসার', 'চিকিৎসক'] },
      { id: 'specialist', labelEn: 'Specialist', labelBn: 'বিশেষজ্ঞ চিকিৎসক', keywordsEn: ['specialist', 'consultant', 'fcps', 'md', 'ms'], keywordsBn: ['বিশেষজ্ঞ', 'কনসালট্যান্ট'] },
      { id: 'nurse', labelEn: 'Nurse', labelBn: 'স্টাফ নার্স ও মিডওয়াইফ', keywordsEn: ['nurse', 'staff nurse', 'midwife', 'senior staff nurse'], keywordsBn: ['নার্স', 'স্টাফ নার্স', 'মিডওয়াইফ', 'সেবিকা'] },
      { id: 'pharmacist', labelEn: 'Pharmacist', labelBn: 'ফার্মাসিস্ট ও ড্রাগিস্ট', keywordsEn: ['pharmacist', 'hospital pharmacist', 'b.pharm'], keywordsBn: ['ফার্মাসিস্ট', 'ঔষধ প্রস্তুতকারক'] },
      { id: 'dentist', labelEn: 'Dentist', labelBn: 'ডেন্টাল সার্জন / ডেন্টিস্ট', keywordsEn: ['dentist', 'dental surgeon', 'bds'], keywordsBn: ['ডেন্টিস্ট', 'দাঁতের ডাক্তার'] },
      { id: 'medical_technologist', labelEn: 'Medical Technologist', labelBn: 'মেডিকেল টেকনোলজিস্ট', keywordsEn: ['medical technologist', 'radiology', 'pathology technologist'], keywordsBn: ['মেডিকেল টেকনোলজিস্ট', 'রেডিওলজি'] },
      { id: 'laboratory', labelEn: 'Laboratory', labelBn: 'ল্যাব টেকনিশিয়ান', keywordsEn: ['lab technician', 'laboratory assistant', 'clinical lab'], keywordsBn: ['ল্যাব টেকনিশিয়ান', 'ল্যাবরেটরি'] },
      { id: 'physiotherapy', labelEn: 'Physiotherapy', labelBn: 'ফিজিওথেরাপিস্ট', keywordsEn: ['physiotherapist', 'physiotherapy', 'rehab'], keywordsBn: ['ফিজিওথেরাপিস্ট', 'ফিজিওথেরাপি'] },
      { id: 'public_health', labelEn: 'Public Health', labelBn: 'জনস্বাস্থ্য বিশেষজ্ঞ', keywordsEn: ['public health', 'epidemiologist', 'mph', 'who', 'unicef health'], keywordsBn: ['জনস্বাস্থ্য', 'মহামারী বিশেষজ্ঞ'] },
      { id: 'hospital_admin', labelEn: 'Hospital Administration', labelBn: 'হাসপাতাল প্রশাসন', keywordsEn: ['hospital administrator', 'hospital manager', 'clinic coordinator'], keywordsBn: ['হাসপাতাল ম্যানেজার', 'হাসপাতাল প্রশাসন'] },
      { id: 'pharmaceutical', labelEn: 'Pharmaceutical & Medical Representative', labelBn: 'ফার্মাসিউটিক্যাল ও মেডিকেল রিপ্রেজেন্টেটিভ', keywordsEn: ['medical representative', 'mpo', 'pharma production', 'square', 'beximco'], keywordsBn: ['মেডিকেল রিপ্রেজেন্টেটিভ', 'এমপিও', 'ফার্মা'] },
      { id: 'veterinary', labelEn: 'Veterinary', labelBn: 'ভেটেরিনারি সার্জন ও প্রাণিসম্পদ', keywordsEn: ['veterinary', 'animal health', 'dvm', 'livestock officer'], keywordsBn: ['ভেটেরিনারি', 'পশু চিকিৎসক', 'প্রাণিসম্পদ'] },
    ],
  },

  // 05. Engineering & Architecture
  {
    id: 'engineering_architecture',
    code: '05',
    letter: 'E',
    labelEn: 'Engineering & Architecture',
    labelBn: 'প্রকৌশল ও স্থাপত্য',
    aliasesEn: ['engineering', 'architecture', 'engineer', 'civil engineer', 'electrical engineer'],
    aliasesBn: ['প্রকৌশল', 'স্থাপত্য', 'ইঞ্জিনিয়ার', 'প্রকৌশলী'],
    industry: 'Engineering, Construction & Infrastructure',
    defaultEmployerType: 'Government',
    iconName: 'Wrench',
    keywordsEn: ['engineer', 'engineering', 'civil', 'electrical', 'mechanical', 'textile', 'architecture', 'pwd', 'rhd', 'lged', 'bwdb', 'buet'],
    keywordsBn: ['প্রকৌশলী', 'ইঞ্জিনিয়ার', 'পুরকৌশল', 'তড়িৎ', 'যন্ত্রকৌশল', 'স্থাপত্য', 'গণপূর্ত', 'এলজিইডি', 'সড়ক ও জনপথ'],
    synonymsEn: ['Infrastructure Engineering', 'Structural Design', 'Technical Construction', 'Architectural Planning'],
    synonymsBn: ['অবকাঠামো প্রকৌশল', 'নির্মাণ শিল্প', 'স্থাপত্য নকশা'],
    relatedTitlesEn: ['Civil Engineer', 'Assistant Engineer', 'Sub-Assistant Engineer', 'Architect', 'Project Engineer'],
    relatedTitlesBn: ['সিভিল ইঞ্জিনিয়ার', 'সহকারী প্রকৌশলী', 'উপ-সহকারী প্রকৌশলী', 'স্থপতি', 'প্রজেক্ট ইঞ্জিনিয়ার'],
    isActive: true,
    subcategories: [
      { id: 'civil', labelEn: 'Civil', labelBn: 'পুরকৌশল ও সিভিল ইঞ্জিনিয়ারিং', keywordsEn: ['civil engineer', 'structural engineer', 'pwd', 'lged', 'rhd'], keywordsBn: ['পুরকৌশল', 'সিভিল ইঞ্জিনিয়ার', 'এলজিইডি'] },
      { id: 'electrical', labelEn: 'Electrical', labelBn: 'তড়িৎ প্রকৌশল', keywordsEn: ['electrical engineer', 'substation', 'wiring engineer'], keywordsBn: ['তড়িৎ প্রকৌশল', 'ইলেকট্রিক্যাল'] },
      { id: 'mechanical', labelEn: 'Mechanical', labelBn: 'যন্ত্রকৌশল', keywordsEn: ['mechanical engineer', 'plant engineer', 'hvac'], keywordsBn: ['যন্ত্রকৌশল', 'মেকানিক্যাল'] },
      { id: 'chemical', labelEn: 'Chemical', labelBn: 'রাসায়নিক প্রকৌশল', keywordsEn: ['chemical engineer', 'process engineer'], keywordsBn: ['কেমিক্যাল ইঞ্জিনিয়ার', 'রাসায়নিক প্রকৌশল'] },
      { id: 'textile', labelEn: 'Textile', labelBn: 'টেক্সটাইল প্রকৌশল', keywordsEn: ['textile engineer', 'spinning', 'weaving', 'dyeing'], keywordsBn: ['টেক্সটাইল ইঞ্জিনিয়ার', 'বস্ত্র প্রকৌশল'] },
      { id: 'industrial', labelEn: 'Industrial', labelBn: 'ইন্ডাস্ট্রিয়াল অ্যান্ড প্রোডাকশন (IPE)', keywordsEn: ['industrial engineer', 'ipe', 'production engineer'], keywordsBn: ['ইন্ডাস্ট্রিয়াল ইঞ্জিনিয়ার', 'আইপিই'] },
      { id: 'electronics', labelEn: 'Electronics', labelBn: 'ইলেকট্রনিক্স প্রকৌশল', keywordsEn: ['electronics engineer', 'embedded systems', 'vlsi'], keywordsBn: ['ইলেকট্রনিক্স ইঞ্জিনিয়ার'] },
      { id: 'architecture', labelEn: 'Architecture', labelBn: 'স্থাপত্য ও নগর পরিকল্পনা', keywordsEn: ['architect', 'urban planner', 'interior design'], keywordsBn: ['স্থপতি', 'স্থাপত্য', 'নগর পরিকল্পনাবিদ'] },
      { id: 'construction', labelEn: 'Construction & Maintenance', labelBn: 'নির্মাণ ও রক্ষণাবেক্ষণ', keywordsEn: ['construction manager', 'site engineer', 'maintenance engineer'], keywordsBn: ['নির্মাণ প্রকৌশলী', 'সাইট ইঞ্জিনিয়ার'] },
    ],
  },

  // 06. IT & Software
  {
    id: 'it_software',
    code: '06',
    letter: 'F',
    labelEn: 'IT & Software',
    labelBn: 'তথ্যপ্রযুক্তি ও সফটওয়্যার',
    aliasesEn: ['it_digital', 'software', 'it', 'tech', 'developer', 'computer'],
    aliasesBn: ['সফটওয়্যার', 'আইটি', 'তথ্যপ্রযুক্তি', 'প্রোগ্রামার', 'কম্পিউটার'],
    industry: 'Information Technology & Software',
    defaultEmployerType: 'Private',
    iconName: 'Code',
    keywordsEn: ['software', 'developer', 'it', 'programmer', 'web', 'app', 'data', 'cloud', 'qa', 'devops', 'cybersecurity', 'tech', 'ai'],
    keywordsBn: ['সফটওয়্যার', 'আইটি', 'প্রোগ্রামার', 'ডেভেলপার', 'ওয়েব', 'অ্যাপ', 'ডাটা', 'সাইবার নিরাপত্তা', 'ক্লাউড'],
    synonymsEn: ['Software Engineering', 'Information Technology', 'Computer Science', 'Digital Solutions'],
    synonymsBn: ['সফটওয়্যার প্রকৌশল', 'তথ্যপ্রযুক্তি সেবা', 'কম্পিউটার বিজ্ঞান'],
    relatedTitlesEn: ['Software Engineer', 'Full Stack Developer', 'Data Scientist', 'DevOps Engineer', 'QA Tester'],
    relatedTitlesBn: ['সফটওয়্যার ইঞ্জিনিয়ার', 'ফুল স্ট্যাক ডেভেলপার', 'ডাটা সায়েন্টিস্ট', 'ডেভঅপস ইঞ্জিনিয়ার', 'কিউএ ইঞ্জিনিয়ার'],
    isActive: true,
    subcategories: [
      { id: 'software', labelEn: 'Software Development', labelBn: 'সফটওয়্যার ডেভেলপমেন্ট ও ব্যাকএন্ড', keywordsEn: ['software engineer', 'backend developer', 'java', 'python', 'golang', 'node.js', '.net'], keywordsBn: ['সফটওয়্যার ইঞ্জিনিয়ার', 'ব্যাকএন্ড ডেভেলপার'] },
      { id: 'web', labelEn: 'Web Development', labelBn: 'ওয়েব ডেভেলপমেন্ট ও ফ্রন্টএন্ড', keywordsEn: ['frontend developer', 'react', 'vue', 'angular', 'javascript', 'html', 'css', 'fullstack'], keywordsBn: ['ওয়েব ডেভেলপার', 'ফ্রন্টএন্ড'] },
      { id: 'mobile_app', labelEn: 'Mobile App', labelBn: 'মোবাইল অ্যাপ ডেভেলপমেন্ট (iOS/Android)', keywordsEn: ['flutter', 'react native', 'android developer', 'ios developer', 'swift', 'kotlin'], keywordsBn: ['মোবাইল অ্যাপ', 'ফ্লাটার', 'অ্যান্ড্রয়েড'] },
      { id: 'ai_ml', labelEn: 'AI & Machine Learning', labelBn: 'কৃত্রিম বুদ্ধিমত্তা ও মেশিন লার্নিং', keywordsEn: ['machine learning', 'ai engineer', 'nlp', 'deep learning'], keywordsBn: ['কৃত্রিম বুদ্ধিমত্তা', 'মেশিন লার্নিং'] },
      { id: 'data_science', labelEn: 'Data Science & Data Engineering', labelBn: 'ডাটা সায়েন্স ও ডাটা ইঞ্জিনিয়ারিং', keywordsEn: ['data scientist', 'data analyst', 'data engineer', 'bi', 'power bi'], keywordsBn: ['ডাটা সায়েন্টিস্ট', 'ডাটা অ্যানালিস্ট', 'ডাটা ইঞ্জিনিয়ার'] },
      { id: 'cybersecurity', labelEn: 'Cybersecurity', labelBn: 'সাইবার নিরাপত্তা ও সিকিউরিটি অ্যানালিস্ট', keywordsEn: ['cybersecurity', 'information security', 'soc analyst', 'penetration tester'], keywordsBn: ['সাইবার নিরাপত্তা', 'সিকিউরিটি অ্যানালিস্ট'] },
      { id: 'networking', labelEn: 'Networking & System Administration', labelBn: 'নেটওয়ার্কিং ও সিসঅ্যাডমিন', keywordsEn: ['network engineer', 'ccna', 'system administrator', 'sysadmin'], keywordsBn: ['নেটওয়ার্ক ইঞ্জিনিয়ার', 'সিসঅ্যাডমিন'] },
      { id: 'cloud_devops', labelEn: 'Cloud & DevOps', labelBn: 'ক্লাউড কম্পিউটিং ও ডেভঅপস', keywordsEn: ['devops', 'aws', 'azure', 'docker', 'kubernetes', 'sre'], keywordsBn: ['ক্লাউড', 'ডেভঅপস'] },
      { id: 'qa', labelEn: 'QA & Testing', labelBn: 'সফটওয়্যার টেস্টিং ও কিউএ', keywordsEn: ['qa engineer', 'software tester', 'automation testing', 'selenium'], keywordsBn: ['কিউএ ইঞ্জিনিয়ার', 'সফটওয়্যার টেস্টার'] },
      { id: 'ui_ux', labelEn: 'UI/UX Design', labelBn: 'ইউআই/ইউএক্স ডিজাইন', keywordsEn: ['ui designer', 'ux designer', 'product designer', 'figma'], keywordsBn: ['ইউআই ডিজাইনার', 'ইউএক্স ডিজাইনার'] },
      { id: 'it_support', labelEn: 'IT Support', labelBn: 'আইটি সাপোর্ট ও কম্পিউটার অপারেটর', keywordsEn: ['it support', 'desktop support', 'hardware technician', 'computer operator'], keywordsBn: ['আইটি সাপোর্ট', 'হার্ডওয়্যার টেকনিশিয়ান', 'কম্পিউটার অপারেটর'] },
    ],
  },

  // 07. Business & Management
  {
    id: 'business_management',
    code: '07',
    letter: 'G',
    labelEn: 'Business & Management',
    labelBn: 'ব্যবসায় ব্যবস্থাপনা ও প্রশাসন',
    aliasesEn: ['business_admin', 'business', 'management', 'administration', 'hr'],
    aliasesBn: ['ব্যবস্থাপনা', 'প্রশাসন', 'এইচআর', 'মানবসম্পদ'],
    industry: 'Corporate Management & Administration',
    defaultEmployerType: 'Private',
    iconName: 'Briefcase',
    keywordsEn: ['administration', 'admin', 'hr', 'human resources', 'management', 'procurement', 'operations', 'executive', 'supply chain'],
    keywordsBn: ['প্রশাসন', 'এইচআর', 'মানবসম্পদ', 'ব্যবস্থাপনা', 'অপারেশন্স', 'প্রকিউরমেন্ট', 'সাপ্লাই চেইন'],
    synonymsEn: ['Corporate Governance', 'Human Resources', 'Supply Chain Operations', 'Executive Leadership'],
    synonymsBn: ['কর্পোরেট প্রশাসন', 'অফিস ব্যবস্থাপনা', 'মানবসম্পদ উন্নয়ন'],
    relatedTitlesEn: ['HR Manager', 'Administrative Officer', 'Operations Director', 'Procurement Specialist', 'Project Manager'],
    relatedTitlesBn: ['এইচআর ম্যানেজার', 'প্রশাসনিক কর্মকর্তা', 'অপারেশনস পরিচালক', 'প্রকিউরমেন্ট স্পেশালিস্ট'],
    isActive: true,
    subcategories: [
      { id: 'administration', labelEn: 'Administration', labelBn: 'সাধারণ প্রশাসন ও অফিস ব্যবস্থাপনা', keywordsEn: ['administrative officer', 'office manager', 'admin executive'], keywordsBn: ['প্রশাসনিক কর্মকর্তা', 'অফিস ম্যানেজার'] },
      { id: 'hr', labelEn: 'HR (Human Resources)', labelBn: 'মানবসম্পদ (এইচআর)', keywordsEn: ['human resources', 'hr', 'hr officer', 'hr manager', 'talent acquisition', 'recruitment', 'payroll'], keywordsBn: ['এইচআর', 'মানবসম্পদ', 'মানবসম্পদ কর্মকর্তা', 'রিক্রুটমেন্ট'] },
      { id: 'management', labelEn: 'Management', labelBn: 'ব্যবস্থাপনা ও টিম লিডারশিপ', keywordsEn: ['general manager', 'branch manager', 'team lead'], keywordsBn: ['ব্যবস্থাপক', 'ম্যানেজার'] },
      { id: 'operations', labelEn: 'Operations', labelBn: 'অপারেশন্স ও বিজনেস প্রসেস', keywordsEn: ['operations manager', 'coo', 'operations executive'], keywordsBn: ['অপারেশন্স ম্যানেজার'] },
      { id: 'procurement', labelEn: 'Procurement', labelBn: 'ক্রয় ও প্রকিউরমেন্ট', keywordsEn: ['procurement officer', 'purchase executive'], keywordsBn: ['ক্রয় কর্মকর্তা', 'প্রকিউরমেন্ট'] },
      { id: 'supply_chain', labelEn: 'Supply Chain', labelBn: 'সাপ্লাই চেইন ম্যানেজমেন্ট', keywordsEn: ['supply chain', 'supply chain manager'], keywordsBn: ['সাপ্লাই চেইন'] },
      { id: 'project_mgmt', labelEn: 'Project Management', labelBn: 'প্রকল্প ব্যবস্থাপনা', keywordsEn: ['project manager', 'pmp', 'project coordinator'], keywordsBn: ['প্রকল্প ব্যবস্থাপক', 'প্রজেক্ট কোঅর্ডিনেটর'] },
    ],
  },

  // 08. Sales & Marketing
  {
    id: 'sales_marketing',
    code: '08',
    letter: 'H',
    labelEn: 'Sales & Marketing',
    labelBn: 'বিক্রয় ও বিপণন',
    aliasesEn: ['sales', 'marketing', 'digital marketing', 'advertising'],
    aliasesBn: ['সেলস', 'মার্কেটিং', 'বিক্রয়', 'বিপণন'],
    industry: 'Commercial Sales & Digital Marketing',
    defaultEmployerType: 'Private',
    iconName: 'TrendingUp',
    keywordsEn: ['sales', 'marketing', 'digital marketing', 'seo', 'social media', 'brand', 'telemarketing', 'call center', 'b2b'],
    keywordsBn: ['সেলস', 'মার্কেটিং', 'বিক্রয়', 'ডিজিটাল মার্কেটিং', 'ব্র্যান্ডিং', 'কল সেন্টার', 'বিপণন'],
    synonymsEn: ['Commercial Growth', 'Brand Promotion', 'Digital Acquisition', 'Client Engagement'],
    synonymsBn: ['পণ্য বিপণন', 'বাণিজ্যিক বিক্রয়', 'ব্র্যান্ড উন্নয়ন'],
    relatedTitlesEn: ['Territory Officer', 'Digital Marketer', 'Brand Executive', 'SEO Specialist', 'Sales Representative'],
    relatedTitlesBn: ['টেরিটরি অফিসার', 'ডিজিটাল মার্কেটার', 'ব্র্যান্ড এক্সিকিউটিভ', 'বিক্রয় প্রতিনিধি'],
    isActive: true,
    subcategories: [
      { id: 'sales', labelEn: 'Sales', labelBn: 'সাধারণ বিক্রয় ও ফিল্ড সেলস', keywordsEn: ['sales executive', 'territory officer', 'field sales'], keywordsBn: ['সেলস এক্সিকিউটিভ', 'বিক্রয় কর্মকর্তা'] },
      { id: 'digital_marketing', labelEn: 'Digital Marketing', labelBn: 'ডিজিটাল মার্কেটিং', keywordsEn: ['digital marketing', 'social media marketing', 'meta ads', 'google ads'], keywordsBn: ['ডিজিটাল মার্কেটিং'] },
      { id: 'seo', labelEn: 'SEO', labelBn: 'সার্চ ইঞ্জিন অপটিমাইজেশন (SEO)', keywordsEn: ['seo specialist', 'search engine optimization', 'sem'], keywordsBn: ['এসইও স্পেশালিস্ট'] },
      { id: 'branding', labelEn: 'Branding', labelBn: 'ব্র্যান্ডিং ও জনসংযোগ', keywordsEn: ['brand manager', 'brand executive', 'brand communication'], keywordsBn: ['ব্র্যান্ড ম্যানেজার', 'ব্র্যান্ডিং'] },
      { id: 'social_media', labelEn: 'Social Media', labelBn: 'সোশ্যাল মিডিয়া ম্যানেজমেন্ট', keywordsEn: ['social media manager', 'content creator social media'], keywordsBn: ['সোশ্যাল মিডিয়া ম্যানেজার'] },
      { id: 'corporate_sales', labelEn: 'Corporate Sales', labelBn: 'কর্পোরেট সেলস ও বিটুবি', keywordsEn: ['corporate sales', 'b2b sales', 'key account manager'], keywordsBn: ['কর্পোরেট সেলস', 'বিটুবি'] },
      { id: 'customer_relationship', labelEn: 'Customer Relationship', labelBn: 'কাস্টমার কেয়ার ও সিআরএম', keywordsEn: ['crm', 'customer care', 'call center agent', 'telemarketing'], keywordsBn: ['কাস্টমার কেয়ার', 'কল সেন্টার'] },
    ],
  },

  // 09. NGO & Development
  {
    id: 'ngo_development',
    code: '09',
    letter: 'I',
    labelEn: 'NGO & Development',
    labelBn: 'এনজিও ও উন্নয়ন সংস্থা',
    aliasesEn: ['ngo', 'development', 'humanitarian', 'social development', 'ingo'],
    aliasesBn: ['এনজিও', 'উন্নয়ন সংস্থা', 'ত্রাণ', 'মানবাধিকার'],
    industry: 'Non-Governmental & International Development',
    defaultEmployerType: 'NGO',
    iconName: 'HeartHandshake',
    keywordsEn: ['ngo', 'development', 'undp', 'unicef', 'brac', 'icddrb', 'humanitarian', 'rohingya', 'usaid', 'reliefweb', 'social work'],
    keywordsBn: ['এনজিও', 'উন্নয়ন সংস্থা', 'মানবাধিকার', 'ত্রাণ', 'ব্র্যাক', 'আইসিডিডিআরবি', 'সমাজসেবা'],
    synonymsEn: ['Humanitarian Aid', 'Community Welfare', 'Social Impact', 'Sustainable Development'],
    synonymsBn: ['মানবিক সহায়তা', 'সামাজিক উন্নয়ন', 'সমাজকল্যাণ'],
    relatedTitlesEn: ['Project Coordinator', 'M&E Officer', 'Community Mobilizer', 'Humanitarian Worker', 'Field Officer'],
    relatedTitlesBn: ['প্রজেক্ট কোঅর্ডিনেটর', 'এম অ্যান্ড ই কর্মকর্তা', 'মাঠ কর্মকর্তা'],
    isActive: true,
    subcategories: [
      { id: 'ngo', labelEn: 'NGO', labelBn: 'জাতীয় এনজিও', keywordsEn: ['national ngo', 'brac', 'asa', 'tmss'], keywordsBn: ['এনজিও', 'ব্র্যাক', 'আশা'] },
      { id: 'ingo', labelEn: 'INGO', labelBn: 'আন্তর্জাতিক উন্নয়ন সংস্থা (INGO / UN)', keywordsEn: ['ingo', 'undp', 'unicef', 'usaid', 'oxfam', 'care'], keywordsBn: ['আন্তর্জাতিক সংস্থা', 'আইএনজিও', 'ইউএন'] },
      { id: 'humanitarian', labelEn: 'Humanitarian', labelBn: 'মানবিক সহায়তা ও শরণার্থী সেবা', keywordsEn: ['humanitarian officer', 'disaster response', 'wash officer', 'refugee'], keywordsBn: ['মানবিক সহায়তা', 'শরণার্থী', 'ত্রাণ'] },
      { id: 'project_officer', labelEn: 'Project Officer', labelBn: 'প্রজেক্ট অফিসার ও কোঅর্ডিনেটর', keywordsEn: ['project officer', 'field coordinator', 'program manager'], keywordsBn: ['প্রজেক্ট অফিসার', 'কর্মসূচি সমন্বয়কারী'] },
      { id: 'field_officer', labelEn: 'Field Officer', labelBn: 'মাঠ কর্মকর্তা ও ফিল্ড অর্গানাইজার', keywordsEn: ['field officer', 'community organizer', 'case worker'], keywordsBn: ['মাঠ কর্মকর্তা', 'কমিউনিটি কর্মী'] },
      { id: 'social_work', labelEn: 'Social Work', labelBn: 'সমাজকর্ম ও পরামর্শ সেবা', keywordsEn: ['social worker', 'counselor', 'gender specialist'], keywordsBn: ['সমাজকর্মী', 'পরামর্শক'] },
      { id: 'm_and_e', labelEn: 'Monitoring & Evaluation', labelBn: 'মনিটরিং ও মূল্যায়ন (M&E)', keywordsEn: ['monitoring and evaluation', 'm&e officer', 'impact evaluation'], keywordsBn: ['মনিটরিং অ্যান্ড ইভ্যালুয়েশন'] },
    ],
  },

  // 10. Agriculture & Fisheries
  {
    id: 'agriculture_fisheries',
    code: '10',
    letter: 'J',
    labelEn: 'Agriculture & Fisheries',
    labelBn: 'কৃষি, মৎস্য ও প্রাণিসম্পদ',
    aliasesEn: ['agriculture', 'fisheries', 'livestock', 'farming', 'agri_environment'],
    aliasesBn: ['কৃষি', 'মৎস্য', 'প্রাণিসম্পদ', 'খামার'],
    industry: 'Agriculture, Fisheries & Livestock Science',
    defaultEmployerType: 'Government',
    iconName: 'Wheat',
    keywordsEn: ['agriculture', 'fisheries', 'livestock', 'forestry', 'veterinary', 'dae', 'bari', 'brri', 'dls', 'dof', 'agronomy'],
    keywordsBn: ['কৃষি', 'মৎস্য', 'প্রাণিসম্পদ', 'বন', 'ভেটেরিনারি', 'ডিএই', 'বারি', 'ব্রি', 'মৎস্য অধিদপ্তর'],
    synonymsEn: ['Agronomy', 'Aquaculture', 'Animal Husbandry', 'Agribusiness'],
    synonymsBn: ['কৃষিবিজ্ঞান', 'মৎস্য চাষ', 'পশুসম্পদ উন্নয়ন'],
    relatedTitlesEn: ['Agriculture Extension Officer', 'Fisheries Officer', 'Livestock Officer', 'Veterinary Surgeon'],
    relatedTitlesBn: ['কৃষি কর্মকর্তা', 'উপসহকারী কৃষি কর্মকর্তা', 'মৎস্য কর্মকর্তা', 'প্রাণিসম্পদ কর্মকর্তা'],
    isActive: true,
    subcategories: [
      { id: 'agriculture', labelEn: 'Agriculture', labelBn: 'কৃষি সম্প্রসারণ ও ফসল বিজ্ঞান', keywordsEn: ['agriculture officer', 'upazila agriculture officer', 'agronomist', 'dae', 'bari'], keywordsBn: ['কৃষি কর্মকর্তা', 'উপসহকারী কৃষি কর্মকর্তা', 'ডিএই'] },
      { id: 'fisheries', labelEn: 'Fisheries', labelBn: 'মৎস্য সম্পদ ও হ্যাচারি', keywordsEn: ['fisheries officer', 'aquaculture specialist', 'dof', 'hatchery'], keywordsBn: ['মৎস্য কর্মকর্তা', 'মৎস্য সম্প্রসারণ', 'হ্যাচারি'] },
      { id: 'livestock', labelEn: 'Livestock', labelBn: 'প্রাণিসম্পদ ও খামার উন্নয়ন', keywordsEn: ['livestock officer', 'poultry farm', 'dairy farm', 'dls'], keywordsBn: ['প্রাণিসম্পদ কর্মকর্তা', 'ডেইরি খামার'] },
      { id: 'forestry', labelEn: 'Forestry', labelBn: 'বন ও বনায়ন', keywordsEn: ['forest officer', 'ranger', 'silviculture'], keywordsBn: ['বন কর্মকর্তা', 'রেঞ্জার'] },
      { id: 'veterinary', labelEn: 'Veterinary', labelBn: 'ভেটেরিনারি ও পশুচিকিৎসা', keywordsEn: ['veterinary', 'animal health', 'dvm'], keywordsBn: ['ভেটেরিনারি', 'পশু চিকিৎসক'] },
      { id: 'agri_research', labelEn: 'Agricultural Research', labelBn: 'কৃষি গবেষণা', keywordsEn: ['agri research', 'crop scientist', 'brri scientist'], keywordsBn: ['কৃষি বিজ্ঞানী', 'গবেষক'] },
      { id: 'food_technology', labelEn: 'Food Technology', labelBn: 'খাদ্য প্রযুক্তি ও ফুড সেফটি', keywordsEn: ['food technology', 'food safety', 'quality assurance food'], keywordsBn: ['খাদ্য প্রযুক্তি', 'ফুড সেফটি'] },
    ],
  },

  // 11. Environment & Energy
  {
    id: 'environment_energy',
    code: '11',
    letter: 'K',
    labelEn: 'Environment & Energy',
    labelBn: 'পরিবেশ, জলবায়ু ও বিদ্যুৎ-জ্বালানি',
    aliasesEn: ['environment', 'energy', 'power', 'renewable energy', 'oil and gas'],
    aliasesBn: ['পরিবেশ', 'জলবায়ু', 'বিদ্যুৎ', 'জ্বালানি'],
    industry: 'Energy, Utilities & Environmental Sustainability',
    defaultEmployerType: 'Government',
    iconName: 'Leaf',
    keywordsEn: ['environment', 'climate', 'renewable energy', 'power', 'electricity', 'oil and gas', 'minerals', 'water resources', 'bpdb', 'petrobangla', 'doe'],
    keywordsBn: ['পরিবেশ', 'জলবায়ু', 'বিদ্যুৎ', 'জ্বালানি', 'তেল গ্যাস', 'পানি সম্পদ', 'নবায়নযোগ্য শক্তি', 'ডেসকো'],
    synonymsEn: ['Sustainable Energy', 'Ecological Science', 'Power Generation', 'Natural Resources'],
    synonymsBn: ['টেকসই শক্তি', 'পরিবেশবিদ্যা', 'বিদ্যুৎ উৎপাদন'],
    relatedTitlesEn: ['Environmental Officer', 'Power Plant Engineer', 'Solar Specialist', 'Energy Consultant'],
    relatedTitlesBn: ['পরিবেশ কর্মকর্তা', 'বিদ্যুৎ প্রকৌশলী', 'সোলার স্পেশালিস্ট'],
    isActive: true,
    subcategories: [
      { id: 'environment', labelEn: 'Environment', labelBn: 'পরিবেশ বিজ্ঞান ও দূষণ নিয়ন্ত্রণ', keywordsEn: ['environmental specialist', 'waste management', 'doe'], keywordsBn: ['পরিবেশ কর্মকর্তা', 'বর্জ্য ব্যবস্থাপনা'] },
      { id: 'climate', labelEn: 'Climate', labelBn: 'জলবায়ু পরিবর্তন ও স্থায়িত্ব', keywordsEn: ['climate change', 'adaptation', 'carbon'], keywordsBn: ['জলবায়ু পরিবর্তন'] },
      { id: 'renewable_energy', labelEn: 'Renewable Energy', labelBn: 'নবায়নযোগ্য জ্বালানি ও সৌরবিদ্যুৎ', keywordsEn: ['renewable energy', 'solar', 'wind energy'], keywordsBn: ['নবায়নযোগ্য শক্তি', 'সৌর বিদ্যুৎ'] },
      { id: 'power_electricity', labelEn: 'Power & Electricity', labelBn: 'বিদ্যুৎ উৎপাদন ও বিতরণ', keywordsEn: ['power plant', 'electricity', 'bpdb', 'desco', 'dpdc', 'pgcb'], keywordsBn: ['বিদ্যুৎ বোর্ড', 'ডেসকো', 'বিদ্যুৎ কেন্দ্র'] },
      { id: 'oil_gas', labelEn: 'Oil & Gas', labelBn: 'তেল, গ্যাস ও খনিজ সম্পদ', keywordsEn: ['oil and gas', 'petroleum', 'petrobangla', 'bpc'], keywordsBn: ['তেল গ্যাস', 'পেট্রোলিয়াম', 'পেট্রোবাংলা'] },
      { id: 'water_resources', labelEn: 'Water Resources', labelBn: 'পানি সম্পদ ও নদী ব্যবস্থাপনা', keywordsEn: ['water resources', 'bwdb', 'hydrology'], keywordsBn: ['পানি সম্পদ', 'পানি উন্নয়ন বোর্ড'] },
    ],
  },

  // 12. Garments & Manufacturing
  {
    id: 'garments_manufacturing',
    code: '12',
    letter: 'L',
    labelEn: 'Garments & Manufacturing',
    labelBn: 'পোশাক শিল্প ও উৎপাদন কারখানা',
    aliasesEn: ['garments', 'manufacturing', 'rmg', 'textile factory', 'production'],
    aliasesBn: ['পোশাক', 'গার্মেন্টস', 'উৎপাদন', 'কারখানা'],
    industry: 'Apparel, Textile & Industrial Manufacturing',
    defaultEmployerType: 'Private',
    iconName: 'Shirt',
    keywordsEn: ['garments', 'textile', 'rmg', 'merchandiser', 'production', 'factory', 'quality control', 'leather', 'merchandising'],
    keywordsBn: ['পোশাক', 'গার্মেন্টস', 'টেক্সটাইল', 'মার্চেন্ডাইজার', 'উৎপাদন', 'কোয়ালিটি কন্ট্রোল', 'চামড়া', 'কারখানা'],
    synonymsEn: ['RMG Industry', 'Apparel Production', 'Textile Operations', 'Industrial Fabrication'],
    synonymsBn: ['তৈরি পোশাক', 'গার্মেন্টস উৎপাদন', 'বস্ত্র কারখানা'],
    relatedTitlesEn: ['Garment Merchandiser', 'Production Manager', 'QC Inspector', 'Floor In-charge'],
    relatedTitlesBn: ['মার্চেন্ডাইজার', 'উৎপাদন ব্যবস্থাপক', 'কিউসি পরিদর্শক'],
    isActive: true,
    subcategories: [
      { id: 'garments', labelEn: 'Garments', labelBn: 'তৈরি পোশাক শিল্প (RMG)', keywordsEn: ['garments', 'apparel', 'rmg'], keywordsBn: ['পোশাক শিল্প', 'তৈরি পোশাক'] },
      { id: 'textile', labelEn: 'Textile', labelBn: 'টেক্সটাইল মিলস ও উইভিং', keywordsEn: ['textile mill', 'spinning', 'weaving', 'dyeing'], keywordsBn: ['টেক্সটাইল মিল', 'স্পিনিং', 'ডাইং'] },
      { id: 'leather', labelEn: 'Leather', labelBn: 'চামড়া ও পাদুকা শিল্প', keywordsEn: ['leather', 'tannery', 'footwear'], keywordsBn: ['চামড়া', 'ট্যানারি', 'জুতো শিল্প'] },
      { id: 'merchandising', labelEn: 'Merchandising', labelBn: 'মার্চেন্ডাইজিং', keywordsEn: ['merchandiser', 'apparel merchandiser', 'apparel merchandising', 'woven', 'knit', 'buyer liaison'], keywordsBn: ['মার্চেন্ডাইজার', 'পোশাক মার্চেন্ডাইজিং'] },
      { id: 'production', labelEn: 'Production', labelBn: 'প্রোডাকশন ও ফ্লোর ম্যানেজমেন্ট', keywordsEn: ['production manager', 'floor incharge', 'line supervisor'], keywordsBn: ['উৎপাদন ব্যবস্থাপক', 'ফ্লোর ইনচার্জ'] },
      { id: 'factory_mgmt', labelEn: 'Factory Management', labelBn: 'কারখানা প্রশাসন ও ব্যবস্থাপনা', keywordsEn: ['factory manager', 'plant manager'], keywordsBn: ['কারখানা ব্যবস্থাপক'] },
      { id: 'quality_control', labelEn: 'Quality Control', labelBn: 'কোয়ালিটি কন্ট্রোল ও পরিদর্শন', keywordsEn: ['quality control', 'qc inspector', 'qa garments'], keywordsBn: ['কোয়ালিটি কন্ট্রোলার', 'কিউসি'] },
    ],
  },

  // 13. Transport & Logistics
  {
    id: 'transport_logistics',
    code: '13',
    letter: 'M',
    labelEn: 'Transport & Logistics',
    labelBn: 'পরিবহন, লজিস্টিকস ও সরবরাহ',
    aliasesEn: ['transport', 'logistics', 'supply chain logistics', 'shipping', 'warehouse'],
    aliasesBn: ['পরিবহন', 'লজিস্টিকস', 'গুদাম', 'সরবরাহ'],
    industry: 'Logistics, Supply Chain & Transport Operations',
    defaultEmployerType: 'Private',
    iconName: 'Truck',
    keywordsEn: ['transport', 'logistics', 'warehouse', 'driver', 'shipping', 'port', 'railway', 'maritime', 'freight', 'delivery'],
    keywordsBn: ['পরিবহন', 'লজিস্টিকস', 'গুদাম', 'ড্রাইভার', 'নৌপরিবহন', 'বন্দর', 'রেলওয়ে', 'ডেলিভারি', 'শিপিং'],
    synonymsEn: ['Freight Operations', 'Supply Chain Distribution', 'Cargo Management', 'Transit Services'],
    synonymsBn: ['পণ্য পরিবহন', 'সরবরাহ ব্যবস্থা', 'জাহাজ চলাচল'],
    relatedTitlesEn: ['Logistics Officer', 'Warehouse Manager', 'Fleet Supervisor', 'Port Officer', 'Heavy Driver'],
    relatedTitlesBn: ['লজিস্টিকস কর্মকর্তা', 'স্টোর ইনচার্জ', 'বন্দর কর্মকর্তা', 'চালক'],
    isActive: true,
    subcategories: [
      { id: 'driving', labelEn: 'Driving', labelBn: 'পেশাদার ড্রাইভার ও ফ্লিট অপারেটর', keywordsEn: ['driver', 'heavy driver', 'chauffeur'], keywordsBn: ['চালক', 'ড্রাইভার', 'গাড়ি চালক'] },
      { id: 'delivery', labelEn: 'Delivery', labelBn: 'ডেলিভারি ও কুরিয়ার সেবা', keywordsEn: ['delivery rider', 'courier agent', 'dispatch'], keywordsBn: ['ডেলিভারি রাইডার', 'কুরিয়ার'] },
      { id: 'warehouse', labelEn: 'Warehouse', labelBn: 'গুদাম ও ইনভেন্টরি', keywordsEn: ['warehouse manager', 'store officer', 'inventory'], keywordsBn: ['গুদাম কর্মকর্তা', 'স্টোর ইনচার্জ'] },
      { id: 'logistics', labelEn: 'Logistics', labelBn: 'লজিস্টিকস ও সাপ্লাই ম্যানেজমেন্ট', keywordsEn: ['logistics officer', 'distribution manager'], keywordsBn: ['লজিস্টিকস কর্মকর্তা', 'বিতরণ'] },
      { id: 'shipping_port', labelEn: 'Shipping & Port', labelBn: 'শিপিং ও বন্দর পরিচালনা', keywordsEn: ['shipping', 'port authority', 'chittagong port', 'c&f'], keywordsBn: ['শিপিং', 'বন্দর কর্তৃপক্ষ', 'চট্টগ্রাম বন্দর'] },
      { id: 'railway', labelEn: 'Railway', labelBn: 'বাংলাদেশ রেলওয়ে', keywordsEn: ['railway', 'station master', 'locomotive master'], keywordsBn: ['বাংলাদেশ রেলওয়ে', 'স্টেশন মাস্টার'] },
      { id: 'maritime', labelEn: 'Maritime', labelBn: 'নৌপরিবহন ও সমুদ্রযাত্রা', keywordsEn: ['maritime', 'marine engineer', 'seaman'], keywordsBn: ['নৌপরিবহন', 'মেরিন ইঞ্জিনিয়ার'] },
    ],
  },

  // 14. Hospitality & Tourism
  {
    id: 'hospitality_tourism',
    code: '14',
    letter: 'N',
    labelEn: 'Hospitality & Tourism',
    labelBn: 'হোটেল, পর্যটন ও রেস্টুরেন্ট',
    aliasesEn: ['hospitality', 'tourism', 'hotel', 'restaurant', 'travel'],
    aliasesBn: ['হোটেল', 'পর্যটন', 'রেস্টুরেন্ট', 'ভ্রমণ'],
    industry: 'Hospitality, Food Service & Tourism',
    defaultEmployerType: 'Private',
    iconName: 'Utensils',
    keywordsEn: ['hotel', 'tourism', 'restaurant', 'chef', 'cooking', 'travel', 'food', 'waiter', 'event management'],
    keywordsBn: ['হোটেল', 'পর্যটন', 'রেস্টুরেন্ট', 'শেফ', 'বাবুর্চি', 'ভ্রমণ', 'খাবার', 'ইভেন্ট'],
    synonymsEn: ['Travel Services', 'Culinary Operations', 'Guest Relations', 'Tourism Hospitality'],
    synonymsBn: ['আতিথেয়তা', 'রন্ধনশিল্প', 'পর্যটন সেবা'],
    relatedTitlesEn: ['Hotel General Manager', 'Executive Chef', 'Travel Consultant', 'Front Desk Officer'],
    relatedTitlesBn: ['হোটেল ম্যানেজার', 'শেফ', 'ফ্রন্ট ডেস্ক অফিসার'],
    isActive: true,
    subcategories: [
      { id: 'hotel', labelEn: 'Hotel', labelBn: 'হোটেল ফ্রন্ট অফিস ও ব্যবস্থাপনা', keywordsEn: ['hotel manager', 'front desk officer', 'concierge'], keywordsBn: ['হোটেল ম্যানেজার', 'ফ্রন্ট ডেস্ক'] },
      { id: 'restaurant', labelEn: 'Restaurant', labelBn: 'রেস্টুরেন্ট ও ফুড সার্ভিস', keywordsEn: ['restaurant manager', 'f&b supervisor'], keywordsBn: ['রেস্টুরেন্ট ম্যানেজার', 'খাবার পরিবেশন'] },
      { id: 'chef', labelEn: 'Chef', labelBn: 'শেফ, বাবুর্চি ও কুক', keywordsEn: ['chef', 'cook', 'baker', 'sous chef'], keywordsBn: ['শেফ', 'বাবুর্চি', 'কুক'] },
      { id: 'tourism', labelEn: 'Tourism', labelBn: 'পর্যটন ও ইকো ট্যুরিজম', keywordsEn: ['tourism officer', 'tour guide', 'sightseeing'], keywordsBn: ['পর্যটন কর্মকর্তা', 'ট্যুর গাইড'] },
      { id: 'travel_agency', labelEn: 'Travel Agency', labelBn: 'ট্রাভেল এজেন্সি ও টিকেটিং', keywordsEn: ['travel consultant', 'ticketing officer', 'iata'], keywordsBn: ['ট্রাভেল কনসালট্যান্ট', 'টিকেটিং'] },
      { id: 'event_mgmt', labelEn: 'Event Management', labelBn: 'ইভেন্ট ম্যানেজমেন্ট', keywordsEn: ['event coordinator', 'event planner'], keywordsBn: ['ইভেন্ট কোঅর্ডিনেটর', 'ইভেন্ট প্ল্যানার'] },
    ],
  },

  // 15. Media & Creative
  {
    id: 'media_creative',
    code: '15',
    letter: 'O',
    labelEn: 'Media & Creative',
    labelBn: 'গণমাধ্যম, ক্রিয়েটিভ ও কনটেন্ট',
    aliasesEn: ['media', 'creative', 'journalism', 'graphics', 'content writing'],
    aliasesBn: ['গণমাধ্যম', 'সাংবাদিকতা', 'ক্রিয়েটিভ', 'গ্রাফিক্স'],
    industry: 'Media, Journalism & Creative Arts',
    defaultEmployerType: 'Private',
    iconName: 'Camera',
    keywordsEn: ['media', 'journalism', 'news', 'reporter', 'content', 'graphics', 'video', 'design', 'copywriting', 'translation', 'broadcasting', 'staff reporter'],
    keywordsBn: ['গণমাধ্যম', 'সাংবাদিকতা', 'সংবাদ', 'গ্রাফিক্স', 'ভিডিও', 'কন্টেন্ট', 'অনুবাদ', 'সম্প্রচার', 'রিপোর্টার', 'স্টাফ রিপোর্টার', 'বার্তা সম্পাদক', 'দৈনিক', 'সংবাদপত্র'],
    synonymsEn: ['Mass Communications', 'Visual Storytelling', 'Broadcasting', 'Content Strategy'],
    synonymsBn: ['গণযোগাযোগ', 'দৃশ্যমাধ্যম', 'সংবাদ ও বিনোদন'],
    relatedTitlesEn: ['News Editor', 'Staff Reporter', 'Graphic Designer', 'Video Editor', 'Copywriter'],
    relatedTitlesBn: ['বার্তা সম্পাদক', 'প্রতিবেদক', 'গ্রাফিক ডিজাইনার', 'ভিডিও এডিটর', 'কপিরাইটার'],
    isActive: true,
    subcategories: [
      { id: 'journalism', labelEn: 'Journalism', labelBn: 'সাংবাদিকতা ও বার্তা বিভাগ', keywordsEn: ['journalist', 'reporter', 'news editor', 'sub editor', 'staff reporter'], keywordsBn: ['সাংবাদিক', 'প্রতিবেদক', 'সহ-সম্পাদক', 'রিপোর্টার', 'স্টাফ রিপোর্টার', 'বার্তা সম্পাদক', 'সংবাদকর্মী'] },
      { id: 'content_writing', labelEn: 'Content Writing', labelBn: 'কন্টেন্ট রাইটিং ও কপিরাইটিং', keywordsEn: ['content writer', 'copywriter', 'blog writer', 'script writer'], keywordsBn: ['কন্টেন্ট লেখক', 'কপিরাইটার'] },
      { id: 'translation', labelEn: 'Translation', labelBn: 'অনুবাদ ও ভাষা রূপান্তর', keywordsEn: ['translator', 'interpreter', 'proofreader'], keywordsBn: ['অনুবাদক', 'দোভাষী'] },
      { id: 'graphic_design', labelEn: 'Graphic Design', labelBn: 'গ্রাফিক ডিজাইন ও ইলাস্ট্রেশন', keywordsEn: ['graphic designer', 'illustrator', 'visual designer', 'photoshop'], keywordsBn: ['গ্রাফিক ডিজাইনার', 'ডিজাইনার'] },
      { id: 'photography_video', labelEn: 'Photography & Video Editing', labelBn: 'ভিডিও এডিটিং ও ফটোগ্রাফি', keywordsEn: ['video editor', 'motion graphics', 'photographer', 'cinematographer'], keywordsBn: ['ভিডিও এডিটর', 'ফটোগ্রাফার'] },
      { id: 'broadcasting', labelEn: 'Broadcasting', labelBn: 'টিভি, রেডিও ও ব্রডকাস্টিং', keywordsEn: ['broadcast engineer', 'news presenter', 'radio jockey'], keywordsBn: ['সংবাদ উপস্থাপক', 'সম্প্রচার'] },
    ],
  },

  // 16. Retail & E-commerce
  {
    id: 'retail_ecommerce',
    code: '16',
    letter: 'P',
    labelEn: 'Retail & E-commerce',
    labelBn: 'খুচরা বিক্রয় ও ই-কমার্স',
    aliasesEn: ['retail', 'ecommerce', 'e-commerce', 'shop', 'outlet'],
    aliasesBn: ['খুচরা বিক্রয়', 'ই-কমার্স', 'দোকান', 'আউটলেট'],
    industry: 'Retail Merchandising & Digital Commerce',
    defaultEmployerType: 'Private',
    iconName: 'ShoppingBag',
    keywordsEn: ['retail', 'ecommerce', 'e-commerce', 'shop', 'outlet', 'daraz', 'shwapno', 'aarong', 'store management'],
    keywordsBn: ['খুচরা বিক্রয়', 'ই-কমার্স', 'দোকান', 'আউটলেট', 'শপ', 'স্বপ্ন', 'আড়ং'],
    synonymsEn: ['Consumer Commerce', 'Store Operations', 'Online Marketplace', 'Merchandise Sales'],
    synonymsBn: ['ভোগ্যপণ্য বাণিজ্য', 'দোকান পরিচালনা', 'ডিজিটাল মার্কেটপ্লেস'],
    relatedTitlesEn: ['Store Manager', 'E-commerce Specialist', 'Catalog Associate', 'Cashier'],
    relatedTitlesBn: ['শোরুম ম্যানেজার', 'ই-কমার্স স্পেশালিস্ট', 'ক্যাশিয়ার'],
    isActive: true,
    subcategories: [
      { id: 'retail', labelEn: 'Retail', labelBn: 'রিটেইল শোরুম ও আউটলেট', keywordsEn: ['store manager', 'outlet incharge', 'retail supervisor'], keywordsBn: ['শোরুম ম্যানেজার', 'আউটলেট ইনচার্জ'] },
      { id: 'ecommerce', labelEn: 'E-commerce', labelBn: 'ই-কমার্স ও মার্কেটপ্লেস', keywordsEn: ['ecommerce manager', 'catalog manager', 'daraz specialist'], keywordsBn: ['ই-কমার্স ম্যানেজার'] },
      { id: 'store_mgmt', labelEn: 'Store Management', labelBn: 'স্টোর ও ইনভেন্টরি পরিচালনা', keywordsEn: ['store incharge', 'inventory controller'], keywordsBn: ['স্টোর ইনচার্জ'] },
      { id: 'merchandising_retail', labelEn: 'Merchandising', labelBn: 'রিটেইল মার্চেন্ডাইজিং', keywordsEn: ['retail merchandiser', 'visual merchandiser'], keywordsBn: ['ভিজুয়াল মার্চেন্ডাইজার'] },
      { id: 'customer_support_retail', labelEn: 'Customer Support', labelBn: 'কাস্টমার সাপোর্ট ও ক্যাশিয়ার', keywordsEn: ['cashier', 'shop assistant', 'customer support retail'], keywordsBn: ['ক্যাশিয়ার', 'বিক্রয়কর্মী'] },
    ],
  },

  // 17. Skilled & Technical Trades
  {
    id: 'skilled_trades',
    code: '17',
    letter: 'Q',
    labelEn: 'Skilled & Technical Trades',
    labelBn: 'কারিগরি ও দক্ষ শ্রমিক',
    aliasesEn: ['skilled_technical', 'skilled trades', 'technician', 'vocational', 'trades'],
    aliasesBn: ['কারিগরি', 'দক্ষ শ্রমিক', 'টেকনিশিয়ান', 'মিস্ত্রি'],
    industry: 'Technical Trades & Vocational Services',
    defaultEmployerType: 'Private',
    iconName: 'Hammer',
    keywordsEn: ['electrician', 'plumber', 'mechanic', 'technician', 'welder', 'carpenter', 'ac', 'machine operator', 'equipment operator', 'vocational', 'refrigeration'],
    keywordsBn: ['ইলেকট্রিশিয়ান', 'প্লাম্বার', 'মেকানিক', 'টেকনিশিয়ান', 'ওয়েল্ডার', 'মিস্ত্রি', 'মেশিন অপারেটর', 'এসি মিস্ত্রি'],
    synonymsEn: ['Vocational Trades', 'Mechanical Installation', 'Field Maintenance', 'Craftsmanship'],
    synonymsBn: ['বৃত্তিমূলক কাজ', 'কারিগরি শ্রম', 'মেরামত ও রক্ষণাবেক্ষণ'],
    relatedTitlesEn: ['Master Electrician', 'Pipefitter', 'Certified Welder', 'AC Technician', 'Machine Operator'],
    relatedTitlesBn: ['বিদ্যুৎ মিস্ত্রি', 'প্লাম্বার', 'ওয়েল্ডার', 'এসি টেকনিশিয়ান'],
    isActive: true,
    subcategories: [
      { id: 'electrician', labelEn: 'Electrician', labelBn: 'ইলেকট্রিশিয়ান ও ওয়্যারিং', keywordsEn: ['electrician', 'wireman', 'lineman'], keywordsBn: ['ইলেকট্রিশিয়ান', 'বিদ্যুৎ মিস্ত্রি'] },
      { id: 'plumber', labelEn: 'Plumber', labelBn: 'প্লাম্বার ও স্যানিটারি মিস্ত্রি', keywordsEn: ['plumber', 'pipefitter', 'sanitary technician'], keywordsBn: ['প্লাম্বার', 'স্যানিটারি মিস্ত্রি'] },
      { id: 'welder', labelEn: 'Welder', labelBn: 'ওয়েল্ডার ও ঝালাইকর্মী', keywordsEn: ['welder', 'arc welder', 'fabricator'], keywordsBn: ['ওয়েল্ডার', 'ঝালাইকর্মী'] },
      { id: 'mechanic', labelEn: 'Mechanic', labelBn: 'সাধারণ মেকানিক ও ফিটার', keywordsEn: ['mechanic', 'fitter', 'equipment mechanic'], keywordsBn: ['মেকানিক', 'ফিটার'] },
      { id: 'carpenter', labelEn: 'Carpenter', labelBn: 'কাঠমিস্ত্রি ও কার্পেন্টার', keywordsEn: ['carpenter', 'woodworker', 'furniture maker'], keywordsBn: ['কাঠমিস্ত্রি', 'কার্পেন্টার'] },
      { id: 'ac_refrigeration', labelEn: 'AC & Refrigeration', labelBn: 'এসি ও রেফ্রিজারেশন টেকনিশিয়ান', keywordsEn: ['ac technician', 'refrigeration mechanic', 'chiller operator'], keywordsBn: ['এসি টেকনিশিয়ান', 'ফ্রিজ মিস্ত্রি'] },
      { id: 'machine_technician', labelEn: 'Machine Technician', labelBn: 'মেশিন অপারেটর ও টেকনিশিয়ান', keywordsEn: ['machine operator', 'cnc operator', 'lathe operator'], keywordsBn: ['মেশিন অপারেটর'] },
    ],
  },

  // 18. Legal & Compliance
  {
    id: 'legal_compliance',
    code: '18',
    letter: 'R',
    labelEn: 'Legal & Compliance',
    labelBn: 'আইন, কমপ্লায়েন্স ও মানবাধিকার',
    aliasesEn: ['legal', 'compliance', 'law', 'lawyer', 'legal_security'],
    aliasesBn: ['আইন', 'কমপ্লায়েন্স', 'আইনজীবী'],
    industry: 'Legal Advisory, Corporate Compliance & Labour Affairs',
    defaultEmployerType: 'Private',
    iconName: 'Scale',
    keywordsEn: ['lawyer', 'legal', 'advocate', 'compliance', 'regulatory affairs', 'labour relations', 'human rights', 'barrister'],
    keywordsBn: ['আইনজীবী', 'আইন', 'অ্যাডভোকেট', 'কমপ্লায়েন্স', 'শ্রম আইন', 'মানবাধিকার'],
    synonymsEn: ['Judicial Services', 'Regulatory Oversight', 'Statutory Compliance', 'Legal Counsel'],
    synonymsBn: ['আইনি পরামর্শ', 'বিধিবদ্ধ নিয়মাবলি', 'আইন সহায়তা'],
    relatedTitlesEn: ['Legal Counsel', 'Compliance Officer', 'Advocate', 'Labour Law Specialist'],
    relatedTitlesBn: ['আইন কর্মকর্তা', 'কমপ্লায়েন্স অফিসার', 'অ্যাডভোকেট'],
    isActive: true,
    subcategories: [
      { id: 'lawyer', labelEn: 'Lawyer', labelBn: 'কর্পোরেট আইনজীবী ও লিগ্যাল অফিসার', keywordsEn: ['lawyer', 'legal officer', 'barrister', 'advocate'], keywordsBn: ['আইনজীবী', 'লিগ্যাল অফিসার', 'অ্যাডভোকেট'] },
      { id: 'legal_assistant', labelEn: 'Legal Assistant', labelBn: 'প্যারালিগ্যাল ও সহকারী', keywordsEn: ['legal assistant', 'paralegal', 'court clerk'], keywordsBn: ['লিগ্যাল অ্যাসিস্ট্যান্ট', 'আইনি সহকারী'] },
      { id: 'compliance', labelEn: 'Compliance', labelBn: 'কর্পোরেট কমপ্লায়েন্স', keywordsEn: ['compliance officer', 'regulatory compliance'], keywordsBn: ['কমপ্লায়েন্স কর্মকর্তা'] },
      { id: 'regulatory_affairs', labelEn: 'Regulatory Affairs', labelBn: 'রেগুলেটরি অ্যাফেয়ার্স', keywordsEn: ['regulatory affairs', 'statutory filings'], keywordsBn: ['রেগুলেটরি অ্যাফেয়ার্স'] },
      { id: 'labour_relations', labelEn: 'Labour Relations', labelBn: 'শ্রম আইন ও শিল্প সম্পর্ক', keywordsEn: ['labour relations', 'labour law specialist', 'industrial dispute'], keywordsBn: ['শ্রম আইন', 'শ্রম সম্পর্ক'] },
      { id: 'human_rights', labelEn: 'Human Rights', labelBn: 'মানবাধিকার ও লিগ্যাল এইড', keywordsEn: ['human rights officer', 'legal aid advocate'], keywordsBn: ['মানবাধিকার কর্মকর্তা', 'আইনি সহায়তা'] },
    ],
  },

  // 19. Defence & Security
  {
    id: 'defence_security',
    code: '19',
    letter: 'S',
    labelEn: 'Defence & Security',
    labelBn: 'প্রতিরক্ষা ও নিরাপত্তা বাহিনী',
    aliasesEn: ['defence', 'security', 'police', 'military', 'army', 'navy', 'air force'],
    aliasesBn: ['প্রতিরক্ষা', 'নিরাপত্তা', 'পুলিশ', 'সেনাবাহিনী', 'নৌবাহিনী'],
    industry: 'National Defence, Law Enforcement & Public Safety',
    defaultEmployerType: 'Government',
    iconName: 'Shield',
    keywordsEn: ['army', 'navy', 'air force', 'police', 'ansar', 'border guard', 'bgb', 'fire service', 'civil defence', 'security', 'safety officer'],
    keywordsBn: ['সেনাবাহিনী', 'নৌবাহিনী', 'বিমানবাহিনী', 'পুলিশ', 'আনসার', 'বিজিবি', 'ফায়ার সার্ভিস', 'নিরাপত্তা প্রহরী', 'প্রতিরক্ষা'],
    synonymsEn: ['Armed Forces', 'Law Enforcement', 'Public Safety', 'Border Protection'],
    synonymsBn: ['সশস্ত্র বাহিনী', 'আইনশৃঙ্খলা রক্ষা', 'নিরাপত্তা ব্যবস্থা'],
    relatedTitlesEn: ['Commissioned Officer', 'Sub-Inspector', 'Constable', 'Fire Fighter', 'Security Guard'],
    relatedTitlesBn: ['কমিশন্ড অফিসার', 'উপ-পরিদর্শক', 'কনস্টেবল', 'ফায়ার ফাইটার', 'নিরাপত্তা প্রহরী'],
    isActive: true,
    subcategories: [
      { id: 'army', labelEn: 'Army', labelBn: 'বাংলাদেশ সেনাবাহিনী', keywordsEn: ['army', 'military', 'infantry', 'cadet'], keywordsBn: ['সেনাবাহিনী', 'আর্মি'] },
      { id: 'navy', labelEn: 'Navy', labelBn: 'বাংলাদেশ নৌবাহিনী', keywordsEn: ['navy', 'sailor', 'naval officer'], keywordsBn: ['নৌবাহিনী', 'নেভি'] },
      { id: 'air_force', labelEn: 'Air Force', labelBn: 'বাংলাদেশ বিমানবাহিনী', keywordsEn: ['air force', 'airman', 'pilot officer'], keywordsBn: ['বিমানবাহিনী'] },
      { id: 'police', labelEn: 'Police', labelBn: 'বাংলাদেশ পুলিশ', keywordsEn: ['police', 'sub inspector', 'constable', 'rab', 'si'], keywordsBn: ['পুলিশ', 'এসআই', 'কনস্টেবল', 'র‌্যাব'] },
      { id: 'ansar', labelEn: 'Ansar & VDP', labelBn: 'আনসার ও ভিডিপি', keywordsEn: ['ansar', 'vdp', 'battalion ansar'], keywordsBn: ['আনসার', 'ভিডিপি'] },
      { id: 'border_guard', labelEn: 'Border Guard', labelBn: 'বর্ডার গার্ড বাংলাদেশ (বিজিবি)', keywordsEn: ['bgb', 'border guard', 'sipahi'], keywordsBn: ['বিজিবি', 'বর্ডার গার্ড', 'সিপাহী'] },
      { id: 'fire_service', labelEn: 'Fire Service', labelBn: 'ফায়ার সার্ভিস ও সিভিল ডিফেন্স', keywordsEn: ['fire service', 'civil defence', 'fire fighter'], keywordsBn: ['ফায়ার সার্ভিস', 'সিভিল ডিফেন্স'] },
      { id: 'security_guard', labelEn: 'Security & Safety Officer', labelBn: 'নিরাপত্তা প্রহরী ও ওএইচএস কর্মকর্তা', keywordsEn: ['security guard', 'security officer', 'safety officer', 'cso'], keywordsBn: ['সিকিউরিটি গার্ড', 'নিরাপত্তা প্রহরী', 'নিরাপত্তা কর্মকর্তা'] },
    ],
  },

  // 20. Science & Statistics
  {
    id: 'science_statistics',
    code: '20',
    letter: 'T',
    labelEn: 'Science & Statistics',
    labelBn: 'বিজ্ঞান, পরিসংখ্যান ও গবেষণা',
    aliasesEn: ['science', 'statistics', 'scientific research', 'science_research'],
    aliasesBn: ['বিজ্ঞান', 'পরিসংখ্যান', 'গবেষণা'],
    industry: 'Scientific Discovery & Statistical Analytics',
    defaultEmployerType: 'Autonomous',
    iconName: 'FlaskConical',
    keywordsEn: ['physics', 'chemistry', 'biology', 'mathematics', 'statistics', 'laboratory', 'scientific research', 'statistician', 'bcsir', 'baec'],
    keywordsBn: ['পদার্থবিজ্ঞান', 'রসায়ন', 'জীববিজ্ঞান', 'গণিত', 'পরিসংখ্যান', 'বৈজ্ঞানিক গবেষণা', 'বিসিএসআইআর'],
    synonymsEn: ['Scientific Inquiry', 'Empirical Analytics', 'Quantitative Research', 'Laboratory Science'],
    synonymsBn: ['বৈজ্ঞানিক অনুসন্ধান', 'পরিসংখ্যান বিশ্লেষণ', 'গবেষণাগার'],
    relatedTitlesEn: ['Scientific Officer', 'Statistician', 'Chemist', 'Data Modeler'],
    relatedTitlesBn: ['বৈজ্ঞানিক কর্মকর্তা', 'পরিসংখ্যানবিদ', 'রসায়নবিদ'],
    isActive: true,
    subcategories: [
      { id: 'physics_chemistry', labelEn: 'Physics & Chemistry', labelBn: 'পদার্থ ও রসায়ন', keywordsEn: ['physicist', 'chemist', 'atomic energy', 'baec'], keywordsBn: ['পদার্থবিদ', 'রসায়নবিদ', 'পরমাণু শক্তি'] },
      { id: 'biology', labelEn: 'Biology & Biochemistry', labelBn: 'জীববিজ্ঞান ও প্রাণরসায়ন', keywordsEn: ['biologist', 'biochemist', 'microbiologist'], keywordsBn: ['জীববিজ্ঞানী', 'অণুজীববিজ্ঞানী'] },
      { id: 'mathematics', labelEn: 'Mathematics', labelBn: 'গণিত ও গণনাবিদ্যা', keywordsEn: ['mathematician', 'actuary'], keywordsBn: ['গণিতবিদ'] },
      { id: 'statistics', labelEn: 'Statistics', labelBn: 'পরিসংখ্যান ও সমীক্ষা', keywordsEn: ['statistician', 'statistical officer', 'bbs'], keywordsBn: ['পরিসংখ্যানবিদ', 'পরিসংখ্যান কর্মকর্তা', 'বিবিএস'] },
      { id: 'laboratory', labelEn: 'Laboratory Research', labelBn: 'গবেষণাগার ও বৈজ্ঞানিক কর্মকর্তা', keywordsEn: ['scientific officer', 'bcsir', 'research scientist'], keywordsBn: ['বৈজ্ঞানিক কর্মকর্তা', 'গবেষক'] },
    ],
  },

  // 21. Telecom & Communication
  {
    id: 'telecom_communication',
    code: '21',
    letter: 'U',
    labelEn: 'Telecom & Communication',
    labelBn: 'টেলিযোগাযোগ ও নেটওয়ার্কিং',
    aliasesEn: ['telecom', 'telecommunications', 'mobile network', 'communication'],
    aliasesBn: ['টেলিকম', 'টেলিযোগাযোগ', 'মোবাইল নেটওয়ার্ক'],
    industry: 'Telecommunications & Transmission Networks',
    defaultEmployerType: 'Private',
    iconName: 'Radio',
    keywordsEn: ['telecom', 'telecommunications', 'mobile network', 'radio', 'network operations', 'communication technology', 'grameenphone', 'robi', 'banglalink', 'btcl', 'btrc'],
    keywordsBn: ['টেলিকম', 'টেলিযোগাযোগ', 'মোবাইল নেটওয়ার্ক', 'গ্রামীণফোন', 'রবি', 'বাংলালিংক', 'বিটিসিএল', 'বিটিআরসি'],
    synonymsEn: ['Cellular Networks', 'Broadband Infrastructure', 'Wireless Communications', 'Optical Fiber Transmission'],
    synonymsBn: ['সেলুলার নেটওয়ার্ক', 'ফাইবার অপটিক', 'ওয়্যারলেস যোগাযোগ'],
    relatedTitlesEn: ['Telecom Engineer', 'NOC Specialist', 'BTS Engineer', 'RF Engineer'],
    relatedTitlesBn: ['টেলিকম ইঞ্জিনিয়ার', 'এনওসি স্পেশালিস্ট', 'বিটিএস ইঞ্জিনিয়ার'],
    isActive: true,
    subcategories: [
      { id: 'telecom_ops', labelEn: 'Telecommunications Operations', labelBn: 'টেলিকম নেটওয়ার্ক অপারেশন', keywordsEn: ['telecom engineer', 'bts engineer', 'rf engineer'], keywordsBn: ['টেলিকম ইঞ্জিনিয়ার', 'বিটিএস'] },
      { id: 'mobile_network', labelEn: 'Mobile Networks', labelBn: 'মোবাইল নেটওয়ার্ক ও সেলুলার', keywordsEn: ['grameenphone', 'robi', 'banglalink', 'teletalk telecom'], keywordsBn: ['মোবাইল অপারেটর', 'গ্রামীণফোন', 'রবি'] },
      { id: 'network_ops', labelEn: 'Network Operations (NOC)', labelBn: 'এনওসি ও সুইচিং', keywordsEn: ['noc engineer', 'switching engineer', 'transmission'], keywordsBn: ['এনওসি', 'সুইচিং'] },
      { id: 'optical_fiber', labelEn: 'Optical Fiber & Broadband', labelBn: 'ফাইবার অপটিক ও ব্রডব্যান্ড', keywordsEn: ['fiber optic', 'isp engineer', 'broadband technician'], keywordsBn: ['ফাইবার অপটিক', 'আইএসপি'] },
    ],
  },

  // 22. Real Estate & Property
  {
    id: 'real_estate',
    code: '22',
    letter: 'V',
    labelEn: 'Real Estate & Property',
    labelBn: 'রিয়েল এস্টেট ও আবাসন',
    aliasesEn: ['property', 'housing', 'land administration', 'developer'],
    aliasesBn: ['আবাসন', 'প্রপার্টি', 'প্লট ফ্ল্যাট', 'রিয়েল এস্টেট'],
    industry: 'Real Estate, Property & Facility Management',
    defaultEmployerType: 'Private',
    iconName: 'Home',
    keywordsEn: ['real estate', 'property', 'facility management', 'housing', 'land administration', 'developer', 'sheltech', 'shanta', 'building', 'flat', 'apartment'],
    keywordsBn: ['রিয়েল এস্টেট', 'আবাসন', 'প্রপার্টি', 'বিল্ডিং', 'ভূমি প্রশাসন', 'ডেভেলপার', 'ফ্ল্যাট ও রিয়েল এস্টেট', 'হাউজিং', 'ফ্ল্যাট', 'প্লট'],
    synonymsEn: ['Property Development', 'Urban Housing', 'Asset Management', 'Land Administration'],
    synonymsBn: ['আবাসন উন্নয়ন', 'সম্পত্তি ব্যবস্থাপনা', 'ভূমি সেবা'],
    relatedTitlesEn: ['Property Consultant', 'Facility Manager', 'Real Estate Executive', 'Land Officer'],
    relatedTitlesBn: ['আবাসন পরামর্শক', 'ফ্যাসিলিটি ম্যানেজার', 'ভূমি কর্মকর্তা'],
    isActive: true,
    subcategories: [
      { id: 'real_estate_sales', labelEn: 'Real Estate Sales', labelBn: 'ফ্ল্যাট ও প্লট বিক্রয় কর্মকর্তা', keywordsEn: ['property consultant', 'real estate sales', 'housing sales'], keywordsBn: ['আবাসন বিক্রয় কর্মকর্তা', 'ফ্ল্যাট বিক্রয়', 'রিয়েল এস্টেট বিক্রয়', 'ফ্ল্যাট ও রিয়েল এস্টেট', 'প্রপার্টি বিক্রয়'] },
      { id: 'facility_mgmt', labelEn: 'Facility Management', labelBn: 'বিল্ডিং ও ফ্যাসিলিটি ম্যানেজমেন্ট', keywordsEn: ['facility manager', 'property manager', 'building engineer'], keywordsBn: ['ফ্যাসিলিটি ম্যানেজার', 'ভবন রক্ষণাবেক্ষণ'] },
      { id: 'housing_dev', labelEn: 'Housing & Land Administration', labelBn: 'আবাসন উন্নয়ন ও ভূমি প্রশাসন', keywordsEn: ['housing developer', 'land surveyor', 'rajuk', 'cda'], keywordsBn: ['রাজউক', 'ভূমি জরিপ'] },
    ],
  },

  // 23. Social Services & Community
  {
    id: 'social_services',
    code: '23',
    letter: 'W',
    labelEn: 'Social Services & Community',
    labelBn: 'সমাজসেবা ও সামাজিক উন্নয়ন',
    aliasesEn: ['social welfare', 'community', 'social service', 'counselling'],
    aliasesBn: ['সমাজসেবা', 'সমাজকল্যাণ', 'সামাজিক সেবা'],
    industry: 'Social Services, Community Outreach & Public Welfare',
    defaultEmployerType: 'Government',
    iconName: 'Users',
    keywordsEn: ['social welfare', 'community development', 'counselling', 'rehabilitation', 'public service', 'dss', 'social service officer'],
    keywordsBn: ['সমাজসেবা', 'সমাজকল্যাণ', 'কাউন্সেলিং', 'পুনর্বাসন', 'সমাজসেবা অধিদপ্তর', 'ইউএসএসও'],
    synonymsEn: ['Public Welfare', 'Community Support', 'Social Rehabilitation', 'Child Protection'],
    synonymsBn: ['জনকল্যাণ', 'সমাজকল্যাণ অধিদপ্তর', 'শিশু সুরক্ষা'],
    relatedTitlesEn: ['Social Services Officer', 'Community Organizer', 'Rehab Counselor', 'Child Protection Officer'],
    relatedTitlesBn: ['সমাজসেবা কর্মকর্তা', 'কাউন্সেলর', 'পুনর্বাসন কর্মকর্তা'],
    isActive: true,
    subcategories: [
      { id: 'social_welfare', labelEn: 'Social Welfare', labelBn: 'সমাজসেবা অধিদপ্তর ও সরকারি কল্যাণ', keywordsEn: ['social welfare', 'dss', 'upazila social service officer'], keywordsBn: ['সমাজসেবা কর্মকর্তা', 'সমাজকল্যাণ'] },
      { id: 'community_dev', labelEn: 'Community Development', labelBn: 'কমিউনিটি উন্নয়ন ও মাঠপর্যায়', keywordsEn: ['community development', 'community worker'], keywordsBn: ['কমিউনিটি উন্নয়ন'] },
      { id: 'counselling_rehab', labelEn: 'Counselling & Rehabilitation', labelBn: 'কাউন্সেলিং ও পুনর্বাসন', keywordsEn: ['counselor', 'rehabilitation officer', 'psychosocial'], keywordsBn: ['কাউন্সেলর', 'পুনর্বাসন'] },
    ],
  },

  // 24. Automotive & Mechanical Services
  {
    id: 'automotive_mechanical',
    code: '24',
    letter: 'X',
    labelEn: 'Automotive & Mechanical Services',
    labelBn: 'অটোমোবাইল ও মোটর ওয়ার্কশপ',
    aliasesEn: ['automotive', 'automobile', 'workshop', 'vehicle maintenance'],
    aliasesBn: ['অটোমোবাইল', 'গাড়ির গ্যারেজ', 'মোটর মেকানিক'],
    industry: 'Automotive Engineering & Fleet Maintenance',
    defaultEmployerType: 'Private',
    iconName: 'Car',
    keywordsEn: ['automobile', 'vehicle maintenance', 'auto electrical', 'workshop', 'transport maintenance', 'garage', 'mechanic automotive'],
    keywordsBn: ['অটোমোবাইল', 'গাড়ি মেরামত', 'অটো ইলেকট্রিক্যাল', 'ওয়ার্কশপ', 'মোটর মেকানিক', 'গ্যারেজ'],
    synonymsEn: ['Vehicle Servicing', 'Automotive Repair', 'Fleet Workshop', 'Motor Engineering'],
    synonymsBn: ['মোটরযান মেরামত', 'গাড়ির কারখানা', 'অটো সার্ভিসিং'],
    relatedTitlesEn: ['Automobile Engineer', 'Auto Electrician', 'Workshop Supervisor', 'Vehicle Inspector'],
    relatedTitlesBn: ['অটোমোবাইল ইঞ্জিনিয়ার', 'অটো ইলেকট্রিশিয়ান', 'গ্যারেজ সুপারভাইজার'],
    isActive: true,
    subcategories: [
      { id: 'automobile_eng', labelEn: 'Automobile Engineering', labelBn: 'অটোমোবাইল প্রকৌশল ও ম্যানুফ্যাকচারিং', keywordsEn: ['automobile engineer', 'automotive manufacturing'], keywordsBn: ['অটোমোবাইল ইঞ্জিনিয়ার'] },
      { id: 'vehicle_maintenance', labelEn: 'Vehicle Maintenance', labelBn: 'গাড়ি মেরামত ও ওয়ার্কশপ', keywordsEn: ['vehicle maintenance', 'auto mechanic', 'workshop'], keywordsBn: ['গাড়ি মেরামত', 'গ্যারেজ মিস্ত্রি'] },
      { id: 'auto_electrical', labelEn: 'Auto Electrical', labelBn: 'অটো ইলেকট্রিক্যাল ও ডায়াগনস্টিক', keywordsEn: ['auto electrical', 'car wiring', 'obd diagnostic'], keywordsBn: ['অটো ইলেকট্রিক্যাল', 'গাড়ির ওয়্যারিং'] },
    ],
  },

  // 25. Aviation & Aerospace
  {
    id: 'aviation_aerospace',
    code: '25',
    letter: 'Y',
    labelEn: 'Aviation & Aerospace',
    labelBn: 'বিমান, এয়ারপোর্ট ও মহাকাশ',
    aliasesEn: ['aviation', 'aerospace', 'airline', 'airport', 'pilot', 'flight'],
    aliasesBn: ['বিমান', 'এয়ারলাইন্স', 'এয়ারপোর্ট', 'পাইলট'],
    industry: 'Aviation, Flight Operations & Aerospace Services',
    defaultEmployerType: 'Government',
    iconName: 'Plane',
    keywordsEn: ['pilot', 'cabin crew', 'airport operations', 'air traffic', 'aircraft maintenance', 'biman', 'caab', 'us-bangla', 'flight attendant'],
    keywordsBn: ['পাইলট', 'কেবিন ক্রু', 'বিমান বাংলাদেশ', 'এয়ারপোর্ট', 'বেবিচক', 'এয়ার ট্রাফিক', 'ফ্লাইট'],
    synonymsEn: ['Flight Operations', 'Civil Aviation', 'Aeronautical Services', 'Airport Management'],
    synonymsBn: ['বেসামরিক বিমান চলাচল', 'উড্ডয়ন সেবা', 'বিমানবন্দর ব্যবস্থাপনা'],
    relatedTitlesEn: ['Commercial Pilot', 'Flight Attendant / Cabin Crew', 'Air Traffic Controller', 'Aircraft Maintenance Engineer'],
    relatedTitlesBn: ['পাইলট', 'কেবিন ক্রু', 'এয়ার ট্রাফিক কন্ট্রোলার', 'এয়ারক্রাফট মেকানিক'],
    isActive: true,
    subcategories: [
      { id: 'pilot_flight', labelEn: 'Pilot & Flight Operations', labelBn: 'পাইলট ও ফ্লাইট অপারেশন', keywordsEn: ['pilot', 'commercial pilot', 'first officer', 'captain'], keywordsBn: ['পাইলট', 'ক্যাপ্টেন', 'ফার্স্ট অফিসার'] },
      { id: 'cabin_crew', labelEn: 'Cabin Crew', labelBn: 'কেবিন ক্রু ও এয়ার হোস্টেস', keywordsEn: ['cabin crew', 'flight attendant', 'air hostess'], keywordsBn: ['কেবিন ক্রু', 'এয়ার হোস্টেস'] },
      { id: 'airport_ops', labelEn: 'Airport Operations', labelBn: 'বিমানবন্দর গ্রাউন্ড ও কার্গো অপারেশন', keywordsEn: ['airport operations', 'ground staff', 'caab', 'check-in agent'], keywordsBn: ['এয়ারপোর্ট গ্রাউন্ড স্টাফ', 'বেবিচক'] },
      { id: 'air_traffic', labelEn: 'Air Traffic Control (ATC)', labelBn: 'এয়ার ট্রাফিক কন্ট্রোল (ATC)', keywordsEn: ['air traffic', 'atc officer', 'radar operator'], keywordsBn: ['এয়ার ট্রাফিক', 'এটিসি'] },
      { id: 'aircraft_maintenance', labelEn: 'Aircraft Maintenance Engineering', labelBn: 'এয়ারক্রাফট মেইনটেন্যান্স ইঞ্জিনিয়ারিং', keywordsEn: ['aircraft maintenance', 'ame', 'avionics'], keywordsBn: ['এয়ারক্রাফট ইঞ্জিনিয়ার', 'অ্যাভিওনিক্স'] },
    ],
  },

  // 26. Other Professional Services
  {
    id: 'other_professional',
    code: '26',
    letter: 'Z',
    labelEn: 'Other Professional Services',
    labelBn: 'অন্যান্য পেশাদার সেবা ও কনসালটেন্সি',
    aliasesEn: ['professional services', 'consultant', 'advisory', 'specialist services'],
    aliasesBn: ['পেশাদার সেবা', 'পরামর্শক', 'কনসালটেন্ট'],
    industry: 'Professional Advisory, Consulting & Specialized Vocations',
    defaultEmployerType: 'Private',
    iconName: 'Layers',
    keywordsEn: ['general professional', 'specialist', 'consultant', 'temporary professional services', 'advisor', 'expert'],
    keywordsBn: ['পেশাদার', 'কনসালট্যান্ট', 'উপদেষ্টা', 'বিশেষজ্ঞ', 'পরামর্শক'],
    synonymsEn: ['Specialized Consulting', 'Independent Advisory', 'Professional Contracting'],
    synonymsBn: ['স্বাধীন পরামর্শ সেবা', 'বিশেষায়িত সেবা'],
    relatedTitlesEn: ['Senior Consultant', 'Technical Advisor', 'Subject Matter Expert'],
    relatedTitlesBn: ['সিনিয়র কনসালট্যান্ট', 'টেকনিক্যাল অ্যাডভাইজর'],
    isActive: true,
    subcategories: [
      { id: 'consultant', labelEn: 'Consultant', labelBn: 'পেশাদার কনসালট্যান্ট ও পরামর্শক', keywordsEn: ['consultant', 'senior consultant', 'advisory'], keywordsBn: ['কনসালট্যান্ট', 'পরামর্শক'] },
      { id: 'specialist_services', labelEn: 'Specialist Services', labelBn: 'বিশেষায়িত সেবা', keywordsEn: ['specialist', 'expert advisor', 'analyst specialist'], keywordsBn: ['বিশেষজ্ঞ সেবা'] },
      { id: 'temp_professional', labelEn: 'Temporary Professional Services', labelBn: 'চুক্তিভিত্তিক পেশাদার সেবা', keywordsEn: ['temporary professional', 'contract consultant'], keywordsBn: ['চুক্তিভিত্তিক পেশাদার'] },
    ],
  },

  // 27. Other / Unclassified
  {
    id: 'other_unclassified',
    code: '27',
    letter: 'ZZ',
    labelEn: 'Other / Unclassified',
    labelBn: 'অন্যান্য ও অনির্ধারিত ক্যাটাগরি',
    aliasesEn: ['other', 'unclassified', 'general', 'miscellaneous', 'unknown'],
    aliasesBn: ['অন্যান্য', 'অনির্দিষ্ট', 'সাধারণ', 'বিবিধ', 'অচেনা'],
    industry: 'General, Emerging & Unclassified Vocations',
    defaultEmployerType: 'Other',
    iconName: 'HelpCircle',
    keywordsEn: ['other', 'general', 'miscellaneous', 'unclassified', 'trainee', 'unknown', 'emerging'],
    keywordsBn: ['অন্যান্য', 'সাধারণ', 'বিবিধ', 'অনির্ধারিত', 'অচেনা'],
    synonymsEn: ['Unassigned Roles', 'Emerging Job Fields', 'New Vocations'],
    synonymsBn: ['নতুন ধরনের চাকরি', 'অনির্ধারিত পদ'],
    relatedTitlesEn: ['Management Trainee', 'Apprentice', 'General Officer'],
    relatedTitlesBn: ['ম্যানেজমেন্ট ট্রেইনি', 'শিক্ষানবিস'],
    isActive: true,
    subcategories: [
      { id: 'unclassified_general', labelEn: 'General Unclassified', labelBn: 'সাধারণ অনির্ধারিত পদ', keywordsEn: ['general', 'any', 'unspecified'], keywordsBn: ['সাধারণ', 'অনির্দিষ্ট'] },
      { id: 'emerging_vocations', labelEn: 'New Emerging Job Category', labelBn: 'নতুন বা উদীয়মান পেশা', keywordsEn: ['emerging', 'new vocation', 'novel'], keywordsBn: ['নতুন পেশা', 'উদীয়মান'] },
      { id: 'trainee_intern', labelEn: 'Intern & Trainee', labelBn: 'ইন্টার্ন ও শিক্ষানবিস', keywordsEn: ['intern', 'mto', 'trainee', 'apprentice'], keywordsBn: ['ইন্টার্ন', 'ম্যানেজমেন্ট ট্রেইনি', 'শিক্ষানবিস'] },
    ],
  },
];

// Backward-compatibility ID alias map: maps legacy IDs from prior versions to new stable IDs
export const LEGACY_CATEGORY_ID_MAP: Record<string, string> = {
  gov_public: 'govt_public',
  government: 'govt_public',
  bank_finance: 'banking_finance',
  banks: 'banking_finance',
  engineering: 'engineering_architecture',
  it_digital: 'it_software',
  it: 'it_software',
  software: 'it_software',
  business_admin: 'business_management',
  agri_environment: 'agriculture_fisheries',
  agriculture: 'agriculture_fisheries',
  environment: 'environment_energy',
  legal_security: 'legal_compliance',
  legal: 'legal_compliance',
  defence: 'defence_security',
  skilled_technical: 'skilled_trades',
  science_research: 'science_statistics',
  media: 'media_creative',
  telecom: 'telecom_communication',
  aviation: 'aviation_aerospace',
  unclassified: 'other_unclassified',
};

export class JobTaxonomyRegistry {
  private static categories: MainCategoryDefinition[] = [...UNIVERSAL_JOB_TAXONOMY];
  private static proposedCategories: ProposedCategory[] = [];

  public static getAll(): MainCategoryDefinition[] {
    return this.categories;
  }

  /**
   * Resolves a category ID or legacy alias into the current stable canonical ID.
   */
  public static resolveCategoryId(idOrAlias: string): string {
    if (!idOrAlias) return 'other_unclassified';
    const lower = idOrAlias.toLowerCase().trim();

    if (LEGACY_CATEGORY_ID_MAP[lower]) {
      return LEGACY_CATEGORY_ID_MAP[lower];
    }

    const exact = this.categories.find(
      (c) =>
        c.id.toLowerCase() === lower ||
        c.code.toLowerCase() === lower ||
        (c.letter && c.letter.toLowerCase() === lower) ||
        c.aliasesEn.some((a) => a.toLowerCase() === lower) ||
        c.aliasesBn.some((a) => a === lower)
    );

    return exact ? exact.id : lower;
  }

  public static getById(id: string): MainCategoryDefinition | undefined {
    if (!id) return undefined;
    const resolvedId = this.resolveCategoryId(id);
    return this.categories.find((c) => c.id.toLowerCase() === resolvedId.toLowerCase());
  }

  public static getSubcategories(mainId: string): SubcategoryDefinition[] {
    const main = this.getById(mainId);
    return main ? main.subcategories : [];
  }

  public static getSubcategoryById(mainId: string, subId: string): SubcategoryDefinition | undefined {
    const main = this.getById(mainId);
    if (!main) return undefined;
    return main.subcategories.find(
      (s) => s.id.toLowerCase() === subId.toLowerCase()
    );
  }

  /**
   * Search categories and subcategories in English or Bengali
   */
  public static searchCategories(query: string, language: 'en' | 'bn' = 'bn'): MainCategoryDefinition[] {
    const q = (query || '').toLowerCase().trim();
    if (!q) return this.categories;

    return this.categories.filter((cat) => {
      const matchEn =
        cat.labelEn.toLowerCase().includes(q) ||
        cat.aliasesEn.some((a) => a.toLowerCase().includes(q)) ||
        cat.keywordsEn.some((k) => k.toLowerCase().includes(q)) ||
        cat.synonymsEn.some((s) => s.toLowerCase().includes(q));

      const matchBn =
        cat.labelBn.includes(q) ||
        cat.aliasesBn.some((a) => a.includes(q)) ||
        cat.keywordsBn.some((k) => k.includes(q)) ||
        cat.synonymsBn.some((s) => s.includes(q));

      const matchSub = cat.subcategories.some(
        (sub) =>
          sub.labelEn.toLowerCase().includes(q) ||
          sub.labelBn.includes(q) ||
          sub.keywordsEn.some((k) => k.toLowerCase().includes(q)) ||
          sub.keywordsBn.some((k) => k.includes(q))
      );

      return matchEn || matchBn || matchSub;
    });
  }

  /**
   * Extensible: Allows registering new job categories dynamically at runtime
   */
  public static registerCustomCategory(cat: MainCategoryDefinition): void {
    const existing = this.categories.findIndex((c) => c.id === cat.id);
    if (existing >= 0) {
      this.categories[existing] = cat;
    } else {
      this.categories.push(cat);
    }
  }

  /**
   * User Category Proposal Action with duplicate prevention
   */
  public static proposeCategory(proposal: {
    proposedTitleEn: string;
    proposedTitleBn: string;
    parentCategoryId?: string;
    justification: string;
  }): { success: boolean; reason?: string; categoryId?: string } {
    const titleEn = proposal.proposedTitleEn.trim();
    const titleBn = proposal.proposedTitleBn.trim();

    if (!titleEn && !titleBn) {
      return { success: false, reason: 'Category title cannot be empty' };
    }

    // Check for duplicate in existing taxonomy
    const existing = this.categories.find(
      (c) =>
        (titleEn && c.labelEn.toLowerCase() === titleEn.toLowerCase()) ||
        (titleBn && c.labelBn === titleBn) ||
        (titleEn && c.aliasesEn.some((a) => a.toLowerCase() === titleEn.toLowerCase())) ||
        (titleBn && c.aliasesBn.some((a) => a === titleBn))
    );

    if (existing) {
      return {
        success: false,
        reason: `An equivalent category already exists: "${existing.labelEn} / ${existing.labelBn}"`,
        categoryId: existing.id,
      };
    }

    const newId = `proposed_${Date.now()}_${titleEn.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 16)}`;
    const record: ProposedCategory = {
      id: newId,
      proposedTitleEn: titleEn || titleBn,
      proposedTitleBn: titleBn || titleEn,
      parentCategoryId: proposal.parentCategoryId,
      justification: proposal.justification,
      submittedAt: Date.now(),
      status: 'PENDING_REVIEW',
    };

    this.proposedCategories.push(record);
    return { success: true, categoryId: newId };
  }

  public static getProposedCategories(): ProposedCategory[] {
    return this.proposedCategories;
  }
}
