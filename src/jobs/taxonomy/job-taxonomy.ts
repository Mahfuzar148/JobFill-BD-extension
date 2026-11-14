// JobFill BD - Universal Job Category & Industry Taxonomy
// Centralized, extensible taxonomy covering Bangladesh and international employment markets.
// Allows adding new categories without rewriting adapters or UI components.

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
}

export interface MainCategoryDefinition {
  id: string;
  letter: string;
  code?: string;
  labelEn: string;
  labelBn: string;
  industry: string;
  defaultEmployerType: EmployerType;
  keywordsEn: string[];
  keywordsBn: string[];
  subcategories: SubcategoryDefinition[];
}

export const UNIVERSAL_JOB_TAXONOMY: MainCategoryDefinition[] = [
  {
    id: 'gov_public',
    letter: 'A',
    labelEn: 'Government & Public Sector',
    labelBn: 'সরকারি ও স্বায়ত্তশাসিত চাকরি',
    industry: 'Public Administration & Civil Service',
    defaultEmployerType: 'Government',
    keywordsEn: ['government', 'govt', 'bcs', 'ministry', 'directorate', 'cadre', 'public service', 'teletalk', 'bpsc'],
    keywordsBn: ['সরকারি', 'সরকারী', 'মন্ত্রণালয়', 'অধিদপ্তর', 'বিসিএস', 'ক্যাডার', 'কর্ম কমিশন', 'স্বায়ত্তশাসিত'],
    subcategories: [
      { id: 'bcs_civil', labelEn: 'BCS & Civil Service', labelBn: 'বিসিএস ও সিভিল সার্ভিস', keywordsEn: ['bcs', 'cadre', 'civil service', 'assistant commissioner'], keywordsBn: ['বিসিএস', 'ক্যাডার', 'সিভিল সার্ভিস', 'সহকারী কমিশনার'] },
      { id: 'ministry', labelEn: 'Ministry Jobs', labelBn: 'মন্ত্রণালয়ের চাকরি', keywordsEn: ['ministry', 'secretariat'], keywordsBn: ['মন্ত্রণালয়', 'সচিবালয়'] },
      { id: 'directorate', labelEn: 'Directorate Jobs', labelBn: 'অধিদপ্তরের চাকরি', keywordsEn: ['directorate', 'department', 'dg'], keywordsBn: ['অধিদপ্তর', 'পরিদপ্তর', 'বোর্ড'] },
      { id: 'autonomous', labelEn: 'Autonomous Organizations', labelBn: 'স্বায়ত্তশাসিত সংস্থা', keywordsEn: ['autonomous', 'corporation', 'authority', 'bida', 'bsec'], keywordsBn: ['স্বায়ত্তশাসিত', 'কর্পোরেশন', 'কর্তৃপক্ষ'] },
      { id: 'public_university', labelEn: 'Public Universities', labelBn: 'পাবলিক বিশ্ববিদ্যালয়', keywordsEn: ['public university', 'dhaka university', 'buet', 'ru', 'cu'], keywordsBn: ['পাবলিক বিশ্ববিদ্যালয়', 'বিশ্ববিদ্যালয়'] },
      { id: 'govt_bank', labelEn: 'Government Banks', labelBn: 'সরকারি ব্যাংক', keywordsEn: ['sonali bank', 'janata bank', 'agrani bank', 'rupali bank', 'bb', 'bsc'], keywordsBn: ['সোনালী ব্যাংক', 'জনতা ব্যাংক', 'অগ্রণী ব্যাংক', 'রূপালী ব্যাংক', 'বাংলাদেশ ব্যাংক'] },
      { id: 'defence', labelEn: 'Defence Jobs', labelBn: 'প্রতিরক্ষা বাহিনী', keywordsEn: ['army', 'navy', 'air force', 'defence', 'military'], keywordsBn: ['সেনাবাহিনী', 'নৌবাহিনী', 'বিমানবাহিনী', 'প্রতিরক্ষা'] },
      { id: 'police', labelEn: 'Police & Law Enforcement', labelBn: 'পুলিশ ও আইনশৃঙ্খলা বাহিনী', keywordsEn: ['police', 'sub inspector', 'constable', 'rab', 'ansar', 'bgb'], keywordsBn: ['পুলিশ', 'এসআই', 'কনস্টেবল', 'র‌্যাব', 'আনসার', 'বিজিবি'] },
      { id: 'fire_service', labelEn: 'Fire Service & Civil Defence', labelBn: 'ফায়ার সার্ভিস ও সিভিল ডিফেন্স', keywordsEn: ['fire service', 'civil defence', 'fire fighter'], keywordsBn: ['ফায়ার সার্ভিস', 'সিভিল ডিফেন্স', 'ফায়ার ফাইটার'] },
      { id: 'judiciary', labelEn: 'Judiciary & Legal Services', labelBn: 'বিচার বিভাগ ও আইন সেবা', keywordsEn: ['judiciary', 'judicial', 'bjsc', 'sub-registrar', 'court'], keywordsBn: ['বিচার বিভাগ', 'জুডিসিয়াল', 'সাব-রেজিস্ট্রার', 'আদালত'] },
      { id: 'local_govt', labelEn: 'Local Government (City Corp/Pourashava)', labelBn: 'স্থানীয় সরকার (সিটি কর্পোরেশন/পৌরসভা)', keywordsEn: ['city corporation', 'pourashava', 'union parishad', 'upazila'], keywordsBn: ['সিটি কর্পোরেশন', 'পৌরসভা', 'উপজেলা পরিষদ'] },
      { id: 'public_project', labelEn: 'Public Project Jobs', labelBn: 'সরকারি প্রকল্প চাকরি', keywordsEn: ['project', 'development project', 'mega project'], keywordsBn: ['প্রকল্প', 'উন্নয়ন প্রকল্প'] },
    ],
  },
  {
    id: 'bank_finance',
    letter: 'B',
    labelEn: 'Banking & Finance',
    labelBn: 'ব্যাংক ও আর্থিক প্রতিষ্ঠান',
    industry: 'Financial Services & Banking',
    defaultEmployerType: 'Bank',
    keywordsEn: ['bank', 'banking', 'finance', 'financial', 'insurance', 'nbfi', 'audit', 'accounting', 'tax', 'fintech'],
    keywordsBn: ['ব্যাংক', 'আর্থিক প্রতিষ্ঠান', 'বীমা', 'ফিন্যান্স', 'অডিট', 'হিসাবরক্ষণ', 'ট্যাক্স', 'ভ্যাট'],
    subcategories: [
      { id: 'central_bank', labelEn: 'Central Bank (Bangladesh Bank)', labelBn: 'বাংলাদেশ ব্যাংক (কেন্দ্রীয় ব্যাংক)', keywordsEn: ['bangladesh bank', 'central bank', 'ad', 'assistant director'], keywordsBn: ['বাংলাদেশ ব্যাংক', 'সহকারী পরিচালক'] },
      { id: 'govt_banks', labelEn: 'Government Banks', labelBn: 'সরকারি বাণিজ্যিক ব্যাংক', keywordsEn: ['sonali', 'janata', 'agrani', 'rupali', 'bkb', 'rakub'], keywordsBn: ['সোনালী', 'জনতা', 'অগ্রণী', 'রূপালী', 'কৃষি ব্যাংক'] },
      { id: 'private_banks', labelEn: 'Private Commercial Banks', labelBn: 'বেসরকারি বাণিজ্যিক ব্যাংক', keywordsEn: ['brac bank', 'ebl', 'city bank', 'dhaka bank', 'prime bank', 'mtb', 'ucb', 'scb'], keywordsBn: ['ব্র্যাক ব্যাংক', 'ইস্টার্ন ব্যাংক', 'দি সিটি ব্যাংক', 'প্রাইম ব্যাংক'] },
      { id: 'nbfi', labelEn: 'Non-Banking Financial Institutions (NBFI)', labelBn: 'আর্থিক প্রতিষ্ঠান (এনবিএফআই)', keywordsEn: ['nbfi', 'idlc', 'ipdc', 'lanka bangla', 'leasing'], keywordsBn: ['আইডিএলসি', 'আইপিডিসি', 'লিজিং'] },
      { id: 'insurance', labelEn: 'Insurance (Life & General)', labelBn: 'বীমা (জীবন ও সাধারণ)', keywordsEn: ['insurance', 'life insurance', 'general insurance'], keywordsBn: ['বীমা', 'ইন্স্যুরেন্স', 'জীবন বীমা'] },
      { id: 'microfinance', labelEn: 'Microfinance & NGO Banking', labelBn: 'ক্ষুদ্রঋণ ও পল্লী উন্নয়ন', keywordsEn: ['microfinance', 'grameen', 'asa', 'tmss', 'buro'], keywordsBn: ['ক্ষুদ্রঋণ', 'গ্রামীণ ব্যাংক', 'আশা', 'টিএমএসএস'] },
      { id: 'accounting_audit', labelEn: 'Accounting & Audit', labelBn: 'অ্যাকাউন্টিং ও অডিট', keywordsEn: ['accountant', 'accounts officer', 'auditor', 'internal audit', 'ca', 'cma'], keywordsBn: ['অ্যাকাউন্টস', 'হিসাবরক্ষক', 'অডিট', 'নিরীক্ষা'] },
      { id: 'tax_vat', labelEn: 'Tax, VAT & Customs', labelBn: 'ট্যাক্স, ভ্যাট ও শুল্ক', keywordsEn: ['tax', 'vat', 'customs', 'tax consultant', 'nbr'], keywordsBn: ['ট্যাক্স', 'ভ্যাট', 'আয়কর', 'কাস্টমস'] },
      { id: 'fintech', labelEn: 'Fintech & Mobile Banking', labelBn: 'ফিনটেক ও মোবাইল ব্যাংকিং', keywordsEn: ['fintech', 'bkash', 'nagad', 'upay', 'rocket', 'payment gateway'], keywordsBn: ['ফিনটেক', 'বিকাশ', 'নগদ', 'রকেট'] },
    ],
  },
  {
    id: 'education_research',
    letter: 'C',
    labelEn: 'Education & Research',
    labelBn: 'শিক্ষা ও গবেষণা',
    industry: 'Education & Academic Training',
    defaultEmployerType: 'Autonomous',
    keywordsEn: ['teacher', 'faculty', 'lecturer', 'professor', 'education', 'school', 'college', 'madrasa', 'ntrca', 'dpe'],
    keywordsBn: ['শিক্ষক', 'প্রভাষক', 'অধ্যাপক', 'শিক্ষা', 'স্কুল', 'কলেজ', 'মাদ্রাসা', 'এনটিআরসিএ', 'ডিপিই'],
    subcategories: [
      { id: 'primary_teaching', labelEn: 'Primary School Teacher', labelBn: 'প্রাথমিক বিদ্যালয় শিক্ষক', keywordsEn: ['primary teacher', 'assistant teacher', 'dpe'], keywordsBn: ['প্রাথমিক শিক্ষক', 'সহকারী শিক্ষক', 'ডিপিই'] },
      { id: 'school_teaching', labelEn: 'High School Teacher', labelBn: 'মাধ্যমিক বিদ্যালয় শিক্ষক', keywordsEn: ['high school teacher', 'assistant teacher', 'ntrca'], keywordsBn: ['মাধ্যমিক শিক্ষক', 'সহকারী শিক্ষক'] },
      { id: 'college_teaching', labelEn: 'College Lecturer', labelBn: 'কলেজ প্রভাষক', keywordsEn: ['college lecturer', 'assistant professor', 'bcs general education'], keywordsBn: ['কলেজ প্রভাষক', 'সহকারী অধ্যাপক'] },
      { id: 'university_faculty', labelEn: 'University Faculty & Professor', labelBn: 'বিশ্ববিদ্যালয় শিক্ষক ও অধ্যাপক', keywordsEn: ['university faculty', 'lecturer', 'professor', 'associate professor'], keywordsBn: ['বিশ্ববিদ্যালয় শিক্ষক', 'প্রভাষক', 'অধ্যাপক'] },
      { id: 'madrasa_teaching', labelEn: 'Madrasa Teacher', labelBn: 'মাদ্রাসা শিক্ষক', keywordsEn: ['madrasa', 'alim', 'fazil', 'kamil', 'quranic teacher'], keywordsBn: ['মাদ্রাসা শিক্ষক', 'মৌলভী', 'মুহাদ্দিস'] },
      { id: 'academic_research', labelEn: 'Researcher & Fellow', labelBn: 'গবেষক ও ফেলো', keywordsEn: ['researcher', 'research fellow', 'scientist', 'phd candidate'], keywordsBn: ['গবেষক', 'ফেলো', 'বিজ্ঞানী'] },
      { id: 'edu_administration', labelEn: 'Education Administration', labelBn: 'শিক্ষা প্রশাসন', keywordsEn: ['principal', 'headmaster', 'registrar', 'education officer', 'ueo'], keywordsBn: ['অধ্যক্ষ', 'প্রধান শিক্ষক', 'রেজিস্ট্রার', 'শিক্ষা কর্মকর্তা'] },
      { id: 'coaching_training', labelEn: 'Training & Coaching', labelBn: 'প্রশিক্ষণ ও কোচিং', keywordsEn: ['trainer', 'coach', 'instructor', 'ielts instructor'], keywordsBn: ['প্রশিক্ষক', 'ইন্সট্রাক্টর', 'ট্রেইনার'] },
    ],
  },
  {
    id: 'medical_healthcare',
    letter: 'D',
    labelEn: 'Medical & Healthcare',
    labelBn: 'চিকিৎসা ও স্বাস্থ্যসেবা',
    industry: 'Healthcare & Pharmaceuticals',
    defaultEmployerType: 'Government',
    keywordsEn: ['doctor', 'nurse', 'medical', 'hospital', 'health', 'clinic', 'pharma', 'dghs', 'mbbs'],
    keywordsBn: ['ডাক্তার', 'চিকিৎসক', 'নার্স', 'সেবিকা', 'হাসপাতাল', 'স্বাস্থ্য', 'ফার্মাসিস্ট', 'ঔষধ'],
    subcategories: [
      { id: 'doctor_specialist', labelEn: 'Medical Officer & Specialist Doctor', labelBn: 'মেডিকেল অফিসার ও বিশেষজ্ঞ চিকিৎসক', keywordsEn: ['medical officer', 'doctor', 'mbbs', 'fcps', 'consultant'], keywordsBn: ['মেডিকেল অফিসার', 'ডাক্তার', 'কনসালট্যান্ট'] },
      { id: 'nurse_midwife', labelEn: 'Staff Nurse & Midwife', labelBn: 'স্টাফ নার্স ও মিডওয়াইফ', keywordsEn: ['nurse', 'staff nurse', 'midwife', 'senior staff nurse'], keywordsBn: ['নার্স', 'স্টাফ নার্স', 'মিডওয়াইফ', 'সেবিকা'] },
      { id: 'pharmacist', labelEn: 'Pharmacist & Chemist', labelBn: 'ফার্মাসিস্ট ও ড্রাগিস্ট', keywordsEn: ['pharmacist', 'chemist', 'hospital pharmacist'], keywordsBn: ['ফার্মাসিস্ট', 'ঔষধ প্রস্তুতকারক'] },
      { id: 'medical_technologist', labelEn: 'Medical Technologist & Lab Technician', labelBn: 'মেডিকেল টেকনোলজিস্ট ও ল্যাব টেকনিশিয়ান', keywordsEn: ['medical technologist', 'lab technician', 'radiology', 'pathology'], keywordsBn: ['মেডিকেল টেকনোলজিস্ট', 'ল্যাব টেকনিশিয়ান', 'প্যাথলজি'] },
      { id: 'dentist', labelEn: 'Dentist / Dental Surgeon', labelBn: 'ডেন্টাল সার্জন / ডেন্টিস্ট', keywordsEn: ['dentist', 'dental surgeon', 'bds'], keywordsBn: ['ডেন্টিস্ট', 'দাঁতের ডাক্তার'] },
      { id: 'public_health', labelEn: 'Public Health Specialist', labelBn: 'জনস্বাস্থ্য বিশেষজ্ঞ', keywordsEn: ['public health', 'epidemiologist', 'mph', 'who', 'unicef health'], keywordsBn: ['জনস্বাস্থ্য', 'মহামারী বিশেষজ্ঞ'] },
      { id: 'hospital_admin', labelEn: 'Hospital Administration', labelBn: 'হাসপাতাল প্রশাসন', keywordsEn: ['hospital administrator', 'hospital manager', 'clinic coordinator'], keywordsBn: ['হাসপাতাল ম্যানেজার', 'হাসপাতাল প্রশাসন'] },
      { id: 'pharma_representative', labelEn: 'Pharmaceutical & Medical Representative', labelBn: 'ফার্মাসিউটিক্যাল ও মেডিকেল রিপ্রেজেন্টেটিভ', keywordsEn: ['medical representative', 'mpo', 'pharma production', 'square', 'beximco'], keywordsBn: ['মেডিকেল রিপ্রেজেন্টেটিভ', 'এমপিও', 'ফার্মা'] },
      { id: 'veterinary', labelEn: 'Veterinary Doctor & Animal Health', labelBn: 'ভেটেরিনারি সার্জন ও প্রাণিসম্পদ', keywordsEn: ['veterinary', 'animal health', 'dvm', 'livestock officer'], keywordsBn: ['ভেটেরিনারি', 'পশু চিকিৎসক', 'প্রাণিসম্পদ'] },
    ],
  },
  {
    id: 'engineering',
    letter: 'E',
    labelEn: 'Engineering',
    labelBn: 'প্রকৌশল ও নির্মাণ',
    industry: 'Engineering & Heavy Infrastructure',
    defaultEmployerType: 'Government',
    keywordsEn: ['engineer', 'engineering', 'civil', 'electrical', 'mechanical', 'textile', 'pwd', 'rhd', 'lged', 'bwdb', 'buet'],
    keywordsBn: ['প্রকৌশলী', 'ইঞ্জিনিয়ার', 'পুরকৌশল', 'তড়িৎ', 'যন্ত্রকৌশল', 'গণপূর্ত', 'এলজিইডি', 'সড়ক ও জনপথ'],
    subcategories: [
      { id: 'civil_eng', labelEn: 'Civil & Structural Engineering', labelBn: 'পুরকৌশল ও স্ট্রাকচারাল ইঞ্জিনিয়ারিং', keywordsEn: ['civil engineer', 'structural engineer', 'pwd', 'lged', 'rhd'], keywordsBn: ['পুরকৌশল', 'সিভিল ইঞ্জিনিয়ার', 'এলজিইডি'] },
      { id: 'electrical_eng', labelEn: 'Electrical & Power Engineering', labelBn: 'তড়িৎ ও বিদ্যুৎ প্রকৌশল', keywordsEn: ['electrical engineer', 'power plant', 'bpdb', 'desco', 'dpdc', 'pgcb'], keywordsBn: ['তড়িৎ প্রকৌশল', 'ইলেকট্রিক্যাল', 'বিদ্যুৎ বোর্ড', 'ডেসকো'] },
      { id: 'mechanical_eng', labelEn: 'Mechanical & Automobile Engineering', labelBn: 'যন্ত্রকৌশল ও অটোমোবাইল ইঞ্জিনিয়ারিং', keywordsEn: ['mechanical engineer', 'automobile engineer', 'hvac', 'plant engineer'], keywordsBn: ['যন্ত্রকৌশল', 'মেকানিক্যাল'] },
      { id: 'textile_eng', labelEn: 'Textile & Chemical Engineering', labelBn: 'টেক্সটাইল ও কেমিক্যাল ইঞ্জিনিয়ারিং', keywordsEn: ['textile engineer', 'chemical engineer', 'dyeing', 'spinning'], keywordsBn: ['টেক্সটাইল ইঞ্জিনিয়ার', 'কেমিক্যাল'] },
      { id: 'architecture', labelEn: 'Architecture & Urban Planning', labelBn: 'স্থাপত্য ও নগর পরিকল্পনা', keywordsEn: ['architect', 'urban planner', 'interior design'], keywordsBn: ['স্থপতি', 'স্থাপত্য', 'নগর পরিকল্পনাবিদ'] },
      { id: 'telecom_eng', labelEn: 'Telecom & Network Engineering', labelBn: 'টেলিযোগাযোগ প্রকৌশল', keywordsEn: ['telecom engineer', 'bts engineer', 'fiber optic', 'grameenphone', 'robi'], keywordsBn: ['টেলিকম ইঞ্জিনিয়ার', 'নেটওয়ার্ক'] },
      { id: 'sub_assistant_eng', labelEn: 'Sub-Assistant Engineer (Diploma)', labelBn: 'উপ-সহকারী প্রকৌশলী (ডিপ্লোমা)', keywordsEn: ['sub-assistant engineer', 'sae', 'diploma engineer'], keywordsBn: ['উপ-সহকারী প্রকৌশলী', 'ডিপ্লোমা প্রকৌশলী'] },
    ],
  },
  {
    id: 'it_digital',
    letter: 'F',
    labelEn: 'IT & Digital Technology',
    labelBn: 'তথ্যপ্রযুক্তি ও সফটওয়্যার',
    industry: 'Information Technology & Software',
    defaultEmployerType: 'Private',
    keywordsEn: ['software', 'developer', 'it', 'programmer', 'web', 'app', 'data', 'cloud', 'qa', 'devops', 'cybersecurity', 'tech'],
    keywordsBn: ['সফটওয়্যার', 'আইটি', 'প্রোগ্রামার', 'ডেভেলপার', 'ওয়েব', 'অ্যাপ', 'ডাটা', 'সাইবার নিরাপত্তা'],
    subcategories: [
      { id: 'software_dev', labelEn: 'Software Development & Backend', labelBn: 'সফটওয়্যার ডেভেলপমেন্ট ও ব্যাকএন্ড', keywordsEn: ['software engineer', 'backend developer', 'java', 'python', 'golang', 'node.js', '.net'], keywordsBn: ['সফটওয়্যার ইঞ্জিনিয়ার', 'ব্যাকএন্ড ডেভেলপার'] },
      { id: 'web_dev', labelEn: 'Web Development & Frontend', labelBn: 'ওয়েব ডেভেলপমেন্ট ও ফ্রন্টএন্ড', keywordsEn: ['frontend developer', 'react', 'vue', 'angular', 'javascript', 'html', 'css', 'fullstack'], keywordsBn: ['ওয়েব ডেভেলপার', 'ফ্রন্টএন্ড'] },
      { id: 'mobile_dev', labelEn: 'Mobile App Development (iOS/Android)', labelBn: 'মোবাইল অ্যাপ ডেভেলপমেন্ট (আইওএস/অ্যান্ড্রয়েড)', keywordsEn: ['flutter', 'react native', 'android developer', 'ios developer', 'swift', 'kotlin'], keywordsBn: ['মোবাইল অ্যাপ', 'ফ্লাটার', 'অ্যান্ড্রয়েড'] },
      { id: 'data_science_ai', labelEn: 'Data Science, AI & Machine Learning', labelBn: 'ডাটা সায়েন্স, কৃত্রিম বুদ্ধিমত্তা ও এমএল', keywordsEn: ['data scientist', 'machine learning', 'ai engineer', 'data analyst', 'bi'], keywordsBn: ['ডাটা সায়েন্টিস্ট', 'কৃত্রিম বুদ্ধিমত্তা', 'মেশিন লার্নিং'] },
      { id: 'cybersecurity', labelEn: 'Cybersecurity & Ethical Hacking', labelBn: 'সাইবার নিরাপত্তা ও সিকিউরিটি অ্যানালিস্ট', keywordsEn: ['cybersecurity', 'information security', 'soc analyst', 'penetration tester'], keywordsBn: ['সাইবার নিরাপত্তা', 'সিকিউরিটি অ্যানালিস্ট'] },
      { id: 'cloud_devops', labelEn: 'Cloud Computing, DevOps & SysAdmin', labelBn: 'ক্লাউড কম্পিউটিং, ডেভঅপস ও সিসঅ্যাডমিন', keywordsEn: ['devops', 'aws', 'azure', 'docker', 'kubernetes', 'system administrator'], keywordsBn: ['ক্লাউড', 'ডেভঅপস', 'সিসঅ্যাডমিন'] },
      { id: 'qa_testing', labelEn: 'Software QA & Automation Testing', labelBn: 'সফটওয়্যার টেস্টিং ও কিউএ ইঞ্জিনিয়ার', keywordsEn: ['qa engineer', 'software tester', 'automation testing', 'selenium'], keywordsBn: ['কিউএ ইঞ্জিনিয়ার', 'সফটওয়্যার টেস্টার'] },
      { id: 'ui_ux_design', labelEn: 'UI/UX Design & Product Design', labelBn: 'ইউআই/ইউএক্স ও প্রোডাক্ট ডিজাইন', keywordsEn: ['ui designer', 'ux designer', 'product designer', 'figma'], keywordsBn: ['ইউআই ডিজাইনার', 'ইউএক্স ডিজাইনার'] },
      { id: 'data_entry', labelEn: 'Data Entry & Computer Operator', labelBn: 'ডাটা এন্ট্রি ও কম্পিউটার অপারেটর', keywordsEn: ['data entry', 'computer operator', 'office assistant computer'], keywordsBn: ['ডাটা এন্ট্রি', 'কম্পিউটার অপারেটর'] },
      { id: 'it_support', labelEn: 'IT Support & Hardware Technician', labelBn: 'আইটি সাপোর্ট ও হার্ডওয়্যার টেকনিশিয়ান', keywordsEn: ['it support', 'desktop support', 'hardware technician', 'cctv'], keywordsBn: ['আইটি সাপোর্ট', 'হার্ডওয়্যার টেকনিশিয়ান'] },
    ],
  },
  {
    id: 'business_admin',
    letter: 'G',
    labelEn: 'Business & Administration',
    labelBn: 'ব্যবসায় ব্যবস্থাপনা ও প্রশাসন',
    industry: 'Corporate Management & Administration',
    defaultEmployerType: 'Private',
    keywordsEn: ['administration', 'admin', 'hr', 'human resources', 'management', 'procurement', 'operations', 'executive'],
    keywordsBn: ['প্রশাসন', 'এইচআর', 'মানবসম্পদ', 'ব্যবস্থাপনা', 'অপারেশন্স', 'প্রকিউরমেন্ট'],
    subcategories: [
      { id: 'human_resources', labelEn: 'Human Resources (HR)', labelBn: 'মানবসম্পদ (এইচআর)', keywordsEn: ['hr officer', 'hr manager', 'talent acquisition', 'payroll'], keywordsBn: ['এইচআর', 'মানবসম্পদ কর্মকর্তা'] },
      { id: 'general_admin', labelEn: 'General Administration & Office Management', labelBn: 'সাধারণ প্রশাসন ও অফিস ব্যবস্থাপনা', keywordsEn: ['administrative officer', 'office manager', 'admin executive'], keywordsBn: ['প্রশাসনিক কর্মকর্তা', 'অফিস ম্যানেজার'] },
      { id: 'operations_management', labelEn: 'Operations & Management', labelBn: 'অপারেশন্স ও ম্যানেজমেন্ট', keywordsEn: ['operations manager', 'general manager', 'branch manager'], keywordsBn: ['অপারেশন্স ম্যানেজার', 'শাখা ব্যবস্থাপক'] },
      { id: 'procurement_supply', labelEn: 'Procurement & Supply Chain', labelBn: 'ক্রয় ও সাপ্লাই চেইন', keywordsEn: ['procurement officer', 'supply chain', 'purchase executive'], keywordsBn: ['ক্রয় কর্মকর্তা', 'সাপ্লাই চেইন'] },
      { id: 'project_mgmt', labelEn: 'Project Management & Planning', labelBn: 'প্রকল্প ব্যবস্থাপনা ও পরিকল্পনা', keywordsEn: ['project manager', 'pmp', 'project coordinator'], keywordsBn: ['প্রকল্প ব্যবস্থাপক', 'প্রজেক্ট কোঅর্ডিনেটর'] },
      { id: 'executive_assistant', labelEn: 'Executive Assistant & Secretary', labelBn: 'নির্বাহী সহকারী ও ব্যক্তিগত সচিব', keywordsEn: ['executive assistant', 'personal secretary', 'ps'], keywordsBn: ['ব্যক্তিগত সহকারী', 'সচিব'] },
    ],
  },
  {
    id: 'sales_marketing',
    letter: 'H',
    labelEn: 'Sales & Marketing',
    labelBn: 'বিক্রয় ও বিপণন',
    industry: 'Commercial Sales & Digital Marketing',
    defaultEmployerType: 'Private',
    keywordsEn: ['sales', 'marketing', 'digital marketing', 'seo', 'social media', 'brand', 'telemarketing', 'call center'],
    keywordsBn: ['সেলস', 'মার্কেটিং', 'বিক্রয়', 'ডিজিটাল মার্কেটিং', 'ব্র্যান্ডিং', 'কল সেন্টার'],
    subcategories: [
      { id: 'field_corporate_sales', labelEn: 'Corporate & Field Sales', labelBn: 'কর্পোরেট ও ফিল্ড সেলস', keywordsEn: ['sales executive', 'territory manager', 'b2b sales'], keywordsBn: ['সেলস এক্সিকিউটিভ', 'বিক্রয় কর্মকর্তা'] },
      { id: 'digital_marketing', labelEn: 'Digital Marketing & Social Media', labelBn: 'ডিজিটাল মার্কেটিং ও সোশ্যাল মিডিয়া', keywordsEn: ['digital marketing', 'social media manager', 'facebook ads'], keywordsBn: ['ডিজিটাল মার্কেটিং', 'সোশ্যাল মিডিয়া'] },
      { id: 'seo_content', labelEn: 'SEO & Search Engine Marketing', labelBn: 'এসইও ও সার্চ ইঞ্জিন মার্কেটিং', keywordsEn: ['seo specialist', 'search engine marketing', 'sem'], keywordsBn: ['এসইও স্পেশালিস্ট'] },
      { id: 'brand_product', labelEn: 'Brand Management & Product Marketing', labelBn: 'ব্র্যান্ড ম্যানেজমেন্ট ও প্রোডাক্ট মার্কেটিং', keywordsEn: ['brand manager', 'product marketing', 'advertising'], keywordsBn: ['ব্র্যান্ড ম্যানেজার', 'বিজ্ঞাপন'] },
      { id: 'customer_support_call', labelEn: 'Customer Care & Call Center', labelBn: 'কাস্টমার কেয়ার ও কল সেন্টার', keywordsEn: ['customer service', 'call center agent', 'telemarketing'], keywordsBn: ['কাস্টমার কেয়ার', 'কল সেন্টার'] },
    ],
  },
  {
    id: 'ngo_development',
    letter: 'I',
    labelEn: 'NGO & Development',
    labelBn: 'এনজিও ও উন্নয়ন সংস্থা',
    industry: 'Non-Governmental & International Development',
    defaultEmployerType: 'NGO',
    keywordsEn: ['ngo', 'development', 'undp', 'unicef', 'brac', 'icddrb', 'humanitarian', 'rohingya', 'usaid', 'reliefweb'],
    keywordsBn: ['এনজিও', 'উন্নয়ন সংস্থা', 'মানবাধিকার', 'ত্রাণ', 'ব্র্যাক', 'আইসিডিডিআরবি'],
    subcategories: [
      { id: 'project_officer_ngo', labelEn: 'Project Officer & Coordinator', labelBn: 'প্রজেক্ট অফিসার ও কোঅর্ডিনেটর', keywordsEn: ['project officer', 'field coordinator', 'program manager'], keywordsBn: ['প্রজেক্ট অফিসার', 'কর্মসূচি সমন্বয়কারী'] },
      { id: 'm_and_e', labelEn: 'Monitoring & Evaluation (M&E)', labelBn: 'মনিটরিং ও মূল্যায়ন (এম অ্যান্ড ই)', keywordsEn: ['monitoring and evaluation', 'm&e officer', 'impact evaluation'], keywordsBn: ['মনিটরিং অ্যান্ড ইভ্যালুয়েশন'] },
      { id: 'field_community', labelEn: 'Field Officer & Community Mobilizer', labelBn: 'মাঠ কর্মকর্তা ও কমিউনিটি মোবিলাইজার', keywordsEn: ['field officer', 'community organizer', 'case worker'], keywordsBn: ['মাঠ কর্মকর্তা', 'কমিউনিটি কর্মী'] },
      { id: 'humanitarian_relief', labelEn: 'Humanitarian & Disaster Management', labelBn: 'মানবিক সহায়তা ও দুর্যোগ ব্যবস্থাপনা', keywordsEn: ['humanitarian officer', 'disaster response', 'wash officer'], keywordsBn: ['ত্রাণ ও দুর্যোগ', 'জরুরি সেবা'] },
      { id: 'research_advocacy', labelEn: 'Research, Policy & Advocacy', labelBn: 'গবেষণা, নীতি ও অ্যাডভোকেসি', keywordsEn: ['policy analyst', 'advocacy officer', 'gender specialist'], keywordsBn: ['পলিসি অ্যানালিস্ট', 'অ্যাডভোকেসি'] },
    ],
  },
  {
    id: 'agri_environment',
    letter: 'J',
    labelEn: 'Agriculture & Environment',
    labelBn: 'কৃষি, মৎস্য ও পরিবেশ',
    industry: 'Agriculture, Forestry & Environmental Sustainability',
    defaultEmployerType: 'Government',
    keywordsEn: ['agriculture', 'fisheries', 'livestock', 'forestry', 'environment', 'climate', 'dae', 'bari', 'bri'],
    keywordsBn: ['কৃষি', 'মৎস্য', 'প্রাণিসম্পদ', 'বন', 'পরিবেশ', 'জলবায়ু'],
    subcategories: [
      { id: 'agriculture_crop', labelEn: 'Agricultural Extension & Agronomy', labelBn: 'কৃষি সম্প্রসারণ ও ফসল বিজ্ঞান', keywordsEn: ['agriculture officer', 'upazila agriculture officer', 'agronomist', 'dae'], keywordsBn: ['কৃষি কর্মকর্তা', 'উপসহকারী কৃষি কর্মকর্তা', 'ডিএই'] },
      { id: 'fisheries_aquaculture', labelEn: 'Fisheries & Aquaculture', labelBn: 'মৎস্য সম্পদ ও অ্যাকুয়াকালচার', keywordsEn: ['fisheries officer', 'aquaculture specialist', 'dof'], keywordsBn: ['মৎস্য কর্মকর্তা', 'মৎস্য সম্প্রসারণ'] },
      { id: 'livestock_poultry', labelEn: 'Livestock & Poultry Development', labelBn: 'প্রাণিসম্পদ ও পোল্ট্রি উন্নয়ন', keywordsEn: ['livestock officer', 'poultry farm', 'dls'], keywordsBn: ['প্রাণিসম্পদ কর্মকর্তা'] },
      { id: 'forestry_wildlife', labelEn: 'Forestry & Wildlife Management', labelBn: 'বন ও বন্যপ্রাণী ব্যবস্থাপনা', keywordsEn: ['forest officer', 'wildlife biologist', 'ranger'], keywordsBn: ['বন কর্মকর্তা', 'রেঞ্জার'] },
      { id: 'environment_climate', labelEn: 'Environmental Science & Climate', labelBn: 'পরিবেশ বিজ্ঞান ও জলবায়ু পরিবর্তন', keywordsEn: ['environmental specialist', 'climate change', 'waste management', 'doe'], keywordsBn: ['পরিবেশ কর্মকর্তা', 'জলবায়ু পরিবর্তন'] },
    ],
  },
  {
    id: 'garments_manufacturing',
    letter: 'K',
    labelEn: 'Garments & Manufacturing',
    labelBn: 'পোশাক শিল্প ও উৎপাদন কারখানা',
    industry: 'Apparel, Textile & Industrial Manufacturing',
    defaultEmployerType: 'Private',
    keywordsEn: ['garments', 'textile', 'rmg', 'merchandiser', 'production', 'factory', 'quality control', 'leather'],
    keywordsBn: ['পোশাক', 'গার্মেন্টস', 'টেক্সটাইল', 'মার্চেন্ডাইজার', 'উৎপাদন', 'কোয়ালিটি কন্ট্রোল', 'চামড়া'],
    subcategories: [
      { id: 'merchandising_rmg', labelEn: 'Garments Merchandising', labelBn: 'গার্মেন্টস মার্চেন্ডাইজিং', keywordsEn: ['merchandiser', 'apparel merchandising', 'buyer liaison'], keywordsBn: ['মার্চেন্ডাইজার', 'পোশাক মার্চেন্ডাইজিং'] },
      { id: 'production_floor', labelEn: 'Production & Floor Management', labelBn: 'প্রোডাকশন ও ফ্লোর ম্যানেজমেন্ট', keywordsEn: ['production manager', 'floor incharge', 'line supervisor'], keywordsBn: ['উৎপাদন ব্যবস্থাপক', 'ফ্লোর ইনচার্জ'] },
      { id: 'quality_assurance_rmg', labelEn: 'Quality Control & QA (Garments)', labelBn: 'কোয়ালিটি কন্ট্রোল ও পরিদর্শন', keywordsEn: ['quality manager', 'qc inspector', 'quality auditor'], keywordsBn: ['কোয়ালিটি কন্ট্রোলার', 'কিউসি'] },
      { id: 'industrial_maintenance', labelEn: 'Factory Engineering & Maintenance', labelBn: 'কারখানা প্রকৌশল ও রক্ষণাবেক্ষণ', keywordsEn: ['maintenance engineer', 'boiler operator', 'utility manager'], keywordsBn: ['রক্ষণাবেক্ষণ প্রকৌশলী', 'বয়লার অপারেটর'] },
      { id: 'leather_footwear', labelEn: 'Leather & Footwear Manufacturing', labelBn: 'চামড়া ও জুতো শিল্প', keywordsEn: ['leather technologist', 'footwear production', 'tannery'], keywordsBn: ['চামড়া প্রযুক্তি', 'জুতো কারখানা'] },
    ],
  },
  {
    id: 'transport_logistics',
    letter: 'L',
    labelEn: 'Transport & Logistics',
    labelBn: 'পরিবহন, লজিস্টিকস ও সরবরাহ',
    industry: 'Logistics, Supply Chain & Transport',
    defaultEmployerType: 'Private',
    keywordsEn: ['transport', 'logistics', 'supply chain', 'warehouse', 'driver', 'aviation', 'shipping', 'c&f', 'port'],
    keywordsBn: ['পরিবহন', 'লজিস্টিকস', 'গুদাম', 'ড্রাইভার', 'বিমান', 'নৌপরিবহন', 'বন্দর'],
    subcategories: [
      { id: 'logistics_operations', labelEn: 'Logistics & Distribution Operations', labelBn: 'লজিস্টিকস ও বিতরণ কার্যক্রম', keywordsEn: ['logistics officer', 'distribution manager', 'dispatch'], keywordsBn: ['লজিস্টিকস কর্মকর্তা', 'বিতরণ'] },
      { id: 'warehouse_inventory', labelEn: 'Warehouse & Inventory Management', labelBn: 'গুদাম ও ইনভেন্টরি ব্যবস্থাপনা', keywordsEn: ['warehouse manager', 'store officer', 'inventory executive'], keywordsBn: ['গুদাম কর্মকর্তা', 'স্টোর ইনচার্জ'] },
      { id: 'aviation_airline', labelEn: 'Aviation, Flight & Ground Operations', labelBn: 'বিমান ও এয়ারলাইন্স অপারেশন', keywordsEn: ['cabin crew', 'pilot', 'ground staff', 'biman bangladesh', 'air traffic'], keywordsBn: ['কেবিন ক্রু', 'পাইলট', 'বিমান বাংলাদেশ'] },
      { id: 'shipping_port', labelEn: 'Shipping, Freight & Port Operations', labelBn: 'নৌপরিবহন ও বন্দর কার্যক্রম', keywordsEn: ['c&f agent', 'customs clearing', 'port authority', 'chittagong port'], keywordsBn: ['সিঅ্যান্ডএফ', 'বন্দর কর্তৃপক্ষ', 'চট্টগ্রাম বন্দর'] },
      { id: 'driver_fleet', labelEn: 'Professional Driver & Fleet Operator', labelBn: 'পেশাদার চালক ও ফ্লিট অপারেটর', keywordsEn: ['driver', 'heavy driver', 'chauffeur', 'fleet manager'], keywordsBn: ['চালক', 'ড্রাইভার', 'গাড়ি চালক'] },
    ],
  },
  {
    id: 'hospitality_tourism',
    letter: 'M',
    labelEn: 'Hospitality & Tourism',
    labelBn: 'হোটেল, পর্যটন ও রেস্টুরেন্ট',
    industry: 'Hospitality, Food Service & Tourism',
    defaultEmployerType: 'Private',
    keywordsEn: ['hotel', 'tourism', 'restaurant', 'chef', 'cooking', 'travel', 'food', 'waiter'],
    keywordsBn: ['হোটেল', 'পর্যটন', 'রেস্টুরেন্ট', 'শেফ', 'বাবুর্চি', 'ভ্রমণ'],
    subcategories: [
      { id: 'hotel_management', labelEn: 'Hotel Front Office & Management', labelBn: 'হোটেল ফ্রন্ট অফিস ও ব্যবস্থাপনা', keywordsEn: ['hotel manager', 'front desk officer', 'concierge'], keywordsBn: ['হোটেল ম্যানেজার', 'ফ্রন্ট ডেস্ক'] },
      { id: 'chef_culinary', labelEn: 'Chef, Baker & Culinary Arts', labelBn: 'শেফ, বাবুর্চি ও রন্ধনশিল্প', keywordsEn: ['chef', 'cook', 'baker', 'sous chef'], keywordsBn: ['শেফ', 'বাবুর্চি', 'কুক'] },
      { id: 'travel_tourism', labelEn: 'Travel Agency & Tour Guide', labelBn: 'ট্রাভেল এজেন্সি ও ট্যুর গাইড', keywordsEn: ['travel consultant', 'tour guide', 'ticketing officer', 'iata'], keywordsBn: ['ট্রাভেল কনসালট্যান্ট', 'ট্যুর গাইড', 'টিকেটিং'] },
      { id: 'food_beverage', labelEn: 'Food & Beverage Service', labelBn: 'খাদ্য ও পানীয় পরিবেশন', keywordsEn: ['f&b manager', 'waiter', 'steward', 'barista'], keywordsBn: ['ওয়েটার', 'স্টুয়ার্ড', 'ক্যাটারিং'] },
    ],
  },
  {
    id: 'media_creative',
    letter: 'N',
    labelEn: 'Media & Creative',
    labelBn: 'গণমাধ্যম, লেখালেখি ও ক্রিয়েটিভ ডিজাইন',
    industry: 'Media, Journalism & Creative Arts',
    defaultEmployerType: 'Private',
    keywordsEn: ['media', 'journalism', 'news', 'reporter', 'content', 'graphics', 'video', 'design', 'copywriter'],
    keywordsBn: ['গণমাধ্যম', 'সাংবাদিকতা', 'সংবাদ', 'গ্রাফিক্স', 'ভিডিও', 'কন্টেন্ট', 'অনুবাদ'],
    subcategories: [
      { id: 'journalism_reporting', labelEn: 'Journalism, Reporting & Newsroom', labelBn: 'সাংবাদিকতা ও বার্তা বিভাগ', keywordsEn: ['journalist', 'reporter', 'news editor', 'sub editor'], keywordsBn: ['সাংবাদিক', 'প্রতিবেদক', 'সহ-সম্পাদক'] },
      { id: 'content_copywriting', labelEn: 'Content Writing & Copywriting', labelBn: 'কন্টেন্ট রাইটিং ও কপিরাইটিং', keywordsEn: ['content writer', 'copywriter', 'blog writer', 'script writer'], keywordsBn: ['কন্টেন্ট লেখক', 'কপিরাইটার'] },
      { id: 'translation', labelEn: 'Translation & Language Services', labelBn: 'অনুবাদ ও ভাষা রূপান্তর', keywordsEn: ['translator', 'interpreter', 'proofreader'], keywordsBn: ['অনুবাদক', 'দোভাষী'] },
      { id: 'graphic_design', labelEn: 'Graphic Design & Illustration', labelBn: 'গ্রাফিক ডিজাইন ও ইলাস্ট্রেশন', keywordsEn: ['graphic designer', 'illustrator', 'visual designer', 'photoshop'], keywordsBn: ['গ্রাফিক ডিজাইনার', 'ডিজাইনার'] },
      { id: 'video_photography', labelEn: 'Video Editing, Animation & Photography', labelBn: 'ভিডিও এডিটিং, অ্যানিমেশন ও ফটোগ্রাফি', keywordsEn: ['video editor', 'motion graphics', 'photographer', 'cinematographer'], keywordsBn: ['ভিডিও এডিটর', 'ফটোগ্রাফার'] },
      { id: 'public_relations', labelEn: 'Public Relations (PR) & Communications', labelBn: 'জনসংযোগ ও যোগাযোগ কর্মকর্তা', keywordsEn: ['pr officer', 'communication specialist', 'spokesperson'], keywordsBn: ['জনসংযোগ কর্মকর্তা', 'পিআরও'] },
    ],
  },
  {
    id: 'retail_ecommerce',
    letter: 'O',
    labelEn: 'Retail & E-commerce',
    labelBn: 'খুচরা বিক্রয় ও ই-কমার্স',
    industry: 'Retail Merchandising & Digital Commerce',
    defaultEmployerType: 'Private',
    keywordsEn: ['retail', 'ecommerce', 'e-commerce', 'shop', 'outlet', 'daraz', 'shwapno', 'aarong'],
    keywordsBn: ['খুচরা বিক্রয়', 'ই-কমার্স', 'দোকান', 'আউটলেট', 'শপ'],
    subcategories: [
      { id: 'ecommerce_operations', labelEn: 'E-commerce Management & Catalog', labelBn: 'ই-কমার্স অপারেশন ও ক্যাটালগ', keywordsEn: ['ecommerce manager', 'catalog manager', 'marketplace specialist'], keywordsBn: ['ই-কমার্স ম্যানেজার'] },
      { id: 'retail_store_mgmt', labelEn: 'Retail Store & Outlet Management', labelBn: 'রিটেইল শোরুম ও আউটলেট ইনচার্জ', keywordsEn: ['store manager', 'outlet incharge', 'retail supervisor'], keywordsBn: ['শোরুম ম্যানেজার', 'আউটলেট ইনচার্জ'] },
      { id: 'cashier_salesperson', labelEn: 'Cashier & Sales Staff', labelBn: 'ক্যাশিয়ার ও বিক্রয়কর্মী', keywordsEn: ['cashier', 'salesperson', 'shop assistant'], keywordsBn: ['ক্যাশিয়ার', 'বিক্রয়কর্মী'] },
    ],
  },
  {
    id: 'skilled_technical',
    letter: 'P',
    labelEn: 'Skilled & Technical Trades',
    labelBn: 'কারিগরি ও দক্ষ শ্রমিক',
    industry: 'Technical Trades & Vocational Services',
    defaultEmployerType: 'Private',
    keywordsEn: ['electrician', 'plumber', 'mechanic', 'technician', 'welder', 'carpenter', 'ac', 'operator', 'vocational'],
    keywordsBn: ['ইলেকট্রিশিয়ান', 'প্লাম্বার', 'মেকানিক', 'টেকনিশিয়ান', 'ওয়েল্ডার', 'মিস্ত্রি', 'অপারেটর'],
    subcategories: [
      { id: 'electrician_trade', labelEn: 'Electrician & Wiring Technician', labelBn: 'ইলেকট্রিশিয়ান ও ওয়্যারিং টেকনিশিয়ান', keywordsEn: ['electrician', 'wireman', 'lineman'], keywordsBn: ['ইলেকট্রিশিয়ান', 'বিদ্যুৎ মিস্ত্রি'] },
      { id: 'plumbing_trade', labelEn: 'Plumber & Pipefitter', labelBn: 'প্লাম্বার ও পাইপফিটার', keywordsEn: ['plumber', 'pipefitter', 'sanitary technician'], keywordsBn: ['প্লাম্বার', 'স্যানিটারি মিস্ত্রি'] },
      { id: 'mechanic_auto', labelEn: 'Auto Mechanic & Heavy Vehicle Specialist', labelBn: 'অটোমোবাইল মেকানিক ও গ্যারেজ মিস্ত্রি', keywordsEn: ['mechanic', 'auto mechanic', 'motorcycle mechanic'], keywordsBn: ['মেকানিক', 'গাড়ি মিস্ত্রি'] },
      { id: 'welder_fabricator', labelEn: 'Welder & Steel Fabricator', labelBn: 'ওয়েল্ডার ও স্টিল ফেব্রিকেটর', keywordsEn: ['welder', 'arc welder', 'fabricator'], keywordsBn: ['ওয়েল্ডার', 'ঝালাইকর্মী'] },
      { id: 'ac_refrigeration', labelEn: 'AC & Refrigeration Technician', labelBn: 'এসি ও রেফ্রিজারেশন টেকনিশিয়ান', keywordsEn: ['ac technician', 'refrigeration mechanic', 'chiller operator'], keywordsBn: ['এসি টেকনিশিয়ান', 'ফ্রিজ মিস্ত্রি'] },
      { id: 'machine_operator', labelEn: 'Industrial Machine Operator', labelBn: 'মেশিন অপারেটর ও কারিগরি সহকারী', keywordsEn: ['machine operator', 'cnc operator', 'lathe operator'], keywordsBn: ['মেশিন অপারেটর'] },
    ],
  },
  {
    id: 'legal_security',
    letter: 'Q',
    labelEn: 'Legal & Security Services',
    labelBn: 'আইন, কমপ্লায়েন্স ও নিরাপত্তা সেবা',
    industry: 'Legal Advisory, Corporate Compliance & Security',
    defaultEmployerType: 'Private',
    keywordsEn: ['lawyer', 'legal', 'advocate', 'security guard', 'compliance', 'safety', 'guard'],
    keywordsBn: ['আইনজীবী', 'আইন', 'অ্যাডভোকেট', 'নিরাপত্তা প্রহরী', 'কমপ্লায়েন্স', 'গার্ড'],
    subcategories: [
      { id: 'corporate_lawyer', labelEn: 'Corporate Lawyer & Legal Counsel', labelBn: 'কর্পোরেট আইনজীবী ও লিগ্যাল অফিসার', keywordsEn: ['lawyer', 'legal officer', 'barrister', 'advocate'], keywordsBn: ['আইনজীবী', 'লিগ্যাল অফিসার', 'অ্যাডভোকেট'] },
      { id: 'compliance_audit', labelEn: 'Corporate Compliance & Labour Law', labelBn: 'কমপ্লায়েন্স ও শ্রম আইন বিশেষজ্ঞ', keywordsEn: ['compliance officer', 'labour law specialist', 'social compliance'], keywordsBn: ['কমপ্লায়েন্স কর্মকর্তা', 'শ্রম আইন'] },
      { id: 'security_guard', labelEn: 'Security Officer & Security Guard', labelBn: 'নিরাপত্তা কর্মকর্তা ও সিকিউরিটি গার্ড', keywordsEn: ['security guard', 'security supervisor', 'cso'], keywordsBn: ['সিকিউরিটি গার্ড', 'নিরাপত্তা প্রহরী'] },
      { id: 'health_safety', labelEn: 'Occupational Health & Safety (OHS)', labelBn: 'পেশাগত স্বাস্থ্য ও কর্মপরিবেশ সুরক্ষা (OHS)', keywordsEn: ['safety officer', 'ohs specialist', 'hse engineer'], keywordsBn: ['নিরাপত্তা কর্মকর্তা', 'স্বাস্থ্য সুরক্ষা'] },
    ],
  },
  {
    id: 'science_research',
    letter: 'R',
    labelEn: 'Science & Professional Research',
    labelBn: 'বিজ্ঞান, পরিসংখ্যান ও পেশাদার গবেষণা',
    industry: 'Scientific & Socio-Economic Research',
    defaultEmployerType: 'Autonomous',
    keywordsEn: ['scientist', 'statistician', 'economist', 'researcher', 'bcsir', 'bids', 'icddrb'],
    keywordsBn: ['বিজ্ঞানী', 'পরিসংখ্যানবিদ', 'অর্থনীতিবিদ', 'গবেষক', 'বিসিএসআইআর'],
    subcategories: [
      { id: 'statistician', labelEn: 'Statistician & Data Analyst', labelBn: 'পরিসংখ্যানবিদ ও ডাটা বিশ্লেষক', keywordsEn: ['statistician', 'statistical officer', 'bbs'], keywordsBn: ['পরিসংখ্যানবিদ', 'পরিসংখ্যান কর্মকর্তা'] },
      { id: 'economist_policy', labelEn: 'Economist & Policy Analyst', labelBn: 'অর্থনীতিবিদ ও পরিকল্পনা কর্মকর্তা', keywordsEn: ['economist', 'policy researcher', 'planning commission'], keywordsBn: ['অর্থনীতিবিদ', 'পরিকল্পনা কর্মকর্তা'] },
      { id: 'scientific_officer', labelEn: 'Scientific Officer & Chemist/Physicist', labelBn: 'বৈজ্ঞানিক কর্মকর্তা ও ল্যাব গবেষক', keywordsEn: ['scientific officer', 'bcsir', 'atomic energy', 'baec'], keywordsBn: ['বৈজ্ঞানিক কর্মকর্তা', 'পরমাণু শক্তি'] },
    ],
  },
  {
    id: 'real_estate',
    letter: 'S',
    labelEn: 'Real Estate & Property',
    labelBn: 'রিয়েল এস্টেট ও আবাসন',
    industry: 'Real Estate, Property & Facility Management',
    defaultEmployerType: 'Private',
    keywordsEn: ['real estate', 'property', 'facility', 'developer', 'housing', 'sheltech', 'shanta'],
    keywordsBn: ['রিয়েল এস্টেট', 'আবাসন', 'প্রপার্টি', 'বিল্ডিং'],
    subcategories: [
      { id: 'real_estate_sales', labelEn: 'Real Estate Sales & Marketing', labelBn: 'ফ্ল্যাট ও প্লট বিক্রয় কর্মকর্তা', keywordsEn: ['property consultant', 'real estate sales'], keywordsBn: ['আবাসন বিক্রয় কর্মকর্তা'] },
      { id: 'facility_property_mgmt', labelEn: 'Facility & Property Management', labelBn: 'বিল্ডিং ও ফ্যাসিলিটি ম্যানেজমেন্ট', keywordsEn: ['facility manager', 'property manager', 'building engineer'], keywordsBn: ['ফ্যাসিলিটি ম্যানেজার'] },
    ],
  },
  {
    id: 'other_unclassified',
    letter: 'T',
    labelEn: 'Other / Unclassified',
    labelBn: 'অন্যান্য / সাধারণ ক্যাটাগরি',
    industry: 'General & Newly Discovered Vocations',
    defaultEmployerType: 'Other',
    keywordsEn: ['other', 'general', 'miscellaneous', 'unclassified', 'trainee'],
    keywordsBn: ['অন্যান্য', 'সাধারণ', 'বিবিধ'],
    subcategories: [
      { id: 'general_unclassified', labelEn: 'General Unclassified', labelBn: 'সাধারণ অনির্দিষ্ট', keywordsEn: ['general', 'any'], keywordsBn: ['সাধারণ'] },
      { id: 'intern_trainee', labelEn: 'Intern & Management Trainee', labelBn: 'ইন্টার্ন ও ট্রেইনি', keywordsEn: ['intern', 'mto', 'trainee'], keywordsBn: ['ইন্টার্ন', 'ম্যানেজমেন্ট ট্রেইনি'] },
    ],
  },
];

export class JobTaxonomyRegistry {
  private static categories: MainCategoryDefinition[] = UNIVERSAL_JOB_TAXONOMY.map((c) => ({
    ...c,
    code: c.code || c.letter,
  }));

  public static getAll(): MainCategoryDefinition[] {
    return this.categories;
  }

  public static getById(id: string): MainCategoryDefinition | undefined {
    return this.categories.find((c) => c.id.toLowerCase() === id.toLowerCase());
  }

  public static getSubcategories(mainId: string): SubcategoryDefinition[] {
    const main = this.getById(mainId);
    return main ? main.subcategories : [];
  }

  public static getSubcategoryById(mainId: string, subId: string): SubcategoryDefinition | undefined {
    const main = this.getById(mainId);
    return main?.subcategories.find((s) => s.id.toLowerCase() === subId.toLowerCase());
  }

  /**
   * Extensible: Allows registering new job categories dynamically at runtime
   */
  public static registerCustomCategory(cat: MainCategoryDefinition): void {
    const enriched = { ...cat, code: cat.code || cat.letter };
    const existing = this.categories.findIndex((c) => c.id === cat.id);
    if (existing >= 0) {
      this.categories[existing] = enriched;
    } else {
      this.categories.push(enriched);
    }
  }
}
