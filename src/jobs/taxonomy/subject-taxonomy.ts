/**
 * Academic Subject & Department Taxonomy
 *
 * Categorized into 5 primary disciplines:
 * 1. Engineering & Technology
 * 2. Business & Finance
 * 3. Law & Social Science
 * 4. Science & General
 * 5. Arts & Humanities
 *
 * Distinct academic departments are strictly separated to prevent false-positive
 * eligibility matching (e.g. ICT is not CSE, Banking is not Finance, HRM is not Management,
 * Biochemistry is not Chemistry, Social Work is not Sociology).
 */

export interface SubjectItem {
  id: string; // Canonical subject ID (lowercase snake_case)
  nameEn: string;
  nameBn: string;
  discipline: 'engineering' | 'business' | 'law_social' | 'science' | 'humanities';
  aliases: RegExp[];
  degreeLevelPrefixes?: string[]; // e.g. 'B.Sc. in', 'Honours in'
}

export interface DisciplineGroup {
  id: string;
  nameEn: string;
  nameBn: string;
  subjects: SubjectItem[];
}

export const ACADEMIC_DISCIPLINES: DisciplineGroup[] = [
  {
    id: 'engineering',
    nameEn: 'Engineering & Technology',
    nameBn: 'প্রকৌশল ও কারিগরি',
    subjects: [
      {
        id: 'cse',
        nameEn: 'Computer Science & Engineering (CSE)',
        nameBn: 'কম্পিউটার সায়েন্স অ্যান্ড ইঞ্জিনিয়ারিং (সিএসই)',
        discipline: 'engineering',
        aliases: [
          /\b(?:computer\s*science(?:\s*(?:and|&)\s*engineering)?|cse)\b/i,
          /কম্পিউটার\s*বিজ্ঞান(?:\s*ও\s*প্রকৌশল)?/i,
        ],
      },
      {
        id: 'ict',
        nameEn: 'Information & Communication Technology (ICT)',
        nameBn: 'তথ্য ও যোগাযোগ প্রযুক্তি (আইসিটি)',
        discipline: 'engineering',
        aliases: [
          /\b(?:information\s*(?:and|&)\s*communication\s*technology|ict)\b/i,
          /তথ্য\s*ও\s*যোগাযোগ\s*প্রযুক্তি/i,
        ],
      },
      {
        id: 'eee',
        nameEn: 'Electrical & Electronic Engineering (EEE)',
        nameBn: 'তড়িৎ ও ইলেকট্রনিক কৌশল (ইইই)',
        discipline: 'engineering',
        aliases: [
          /\b(?:electrical\s*(?:and|&)\s*electronic\s*engineering|eee|electrical\s*engineering)\b/i,
          /তড়িৎ\s*(?:ও\s*ইলেকট্রনিক)?\s*কৌশল/i,
        ],
      },
      {
        id: 'mse',
        nameEn: 'Materials Science & Engineering (MSE)',
        nameBn: 'বস্তু ও ধাতু কৌশল (এমএসই)',
        discipline: 'engineering',
        aliases: [
          /\b(?:materials?\s*science(?:\s*(?:and|&)\s*engineering)?|mse|metallurgical\s*engineering)\b/i,
          /বস্তু\s*(?:ও\s*ধাতু)?\s*(?:বিজ্ঞান|কৌশল)/i,
        ],
      },
      {
        id: 'acce',
        nameEn: 'Applied Chemistry & Chemical Engineering (ACCE)',
        nameBn: 'ফলিত রসায়ন ও রাসায়নিক কৌশল (এসিসিই)',
        discipline: 'engineering',
        aliases: [
          /\b(?:applied\s*chemistry\s*(?:and|&)\s*chemical\s*engineering|acce)\b/i,
          /ফলিত\s*রসায়ন\s*ও\s*রাসায়নিক\s*কৌশল/i,
        ],
      },
      {
        id: 'civil',
        nameEn: 'Civil Engineering (CE)',
        nameBn: 'পুরকৌশল / সিভিল ইঞ্জিনিয়ারিং',
        discipline: 'engineering',
        aliases: [/\b(?:civil\s*engineering|ce)\b/i, /পুরকৌশল|সিভিল\s*ইঞ্জিনিয়ারিং/i],
      },
      {
        id: 'mechanical',
        nameEn: 'Mechanical Engineering (ME)',
        nameBn: 'যন্ত্রকৌশল / মেকানিক্যাল ইঞ্জিনিয়ারিং',
        discipline: 'engineering',
        aliases: [/\b(?:mechanical\s*engineering|me)\b/i, /যন্ত্রকৌশল|মেকানিক্যাল\s*ইঞ্জিনিয়ারিং/i],
      },
      {
        id: 'ipe',
        nameEn: 'Industrial & Production Engineering (IPE)',
        nameBn: 'শিল্প ও উৎপাদন কৌশল (আইপিই)',
        discipline: 'engineering',
        aliases: [
          /\b(?:industrial\s*(?:and|&)\s*production\s*engineering|ipe)\b/i,
          /শিল্প\s*ও\s*উৎপাদন\s*কৌশল/i,
        ],
      },
      {
        id: 'chemical',
        nameEn: 'Chemical Engineering',
        nameBn: 'রাসায়নিক কৌশল',
        discipline: 'engineering',
        aliases: [/\bchemical\s*engineering\b/i, /রাসায়নিক\s*কৌশল/i],
      },
      {
        id: 'architecture',
        nameEn: 'Architecture',
        nameBn: 'স্থাপত্যকলা',
        discipline: 'engineering',
        aliases: [/\barchitecture\b/i, /স্থাপত্য|স্থাপত্যকলা/i],
      },
    ],
  },
  {
    id: 'business',
    nameEn: 'Business & Finance',
    nameBn: 'ব্যবসায় ও বাণিজ্য',
    subjects: [
      {
        id: 'accounting',
        nameEn: 'Accounting & Information Systems',
        nameBn: 'হিসাববিজ্ঞান',
        discipline: 'business',
        aliases: [/\b(?:accounting|ais|accountancy)\b/i, /হিসাববিজ্ঞান/i],
      },
      {
        id: 'finance',
        nameEn: 'Finance',
        nameBn: 'ফিন্যান্স',
        discipline: 'business',
        aliases: [/\bfinance\b/i, /ফিন্যান্স|অর্থায়ন/i],
      },
      {
        id: 'banking',
        nameEn: 'Banking & Insurance',
        nameBn: 'ব্যাংকিং ও ইন্স্যুরেন্স',
        discipline: 'business',
        aliases: [/\b(?:banking(?:\s*(?:and|&)\s*insurance)?)\b/i, /ব্যাংকিং(?:\s*ও\s*বীমা)?/i],
      },
      {
        id: 'hrm',
        nameEn: 'Human Resource Management (HRM)',
        nameBn: 'মানবসম্পদ ব্যবস্থাপনা (এইচআরএম)',
        discipline: 'business',
        aliases: [/\b(?:human\s*resource(?:\s*management)?|hrm)\b/i, /মানবসম্পদ\s*ব্যবস্থাপনা/i],
      },
      {
        id: 'management',
        nameEn: 'Management',
        nameBn: 'ব্যবস্থাপনা',
        discipline: 'business',
        aliases: [/(?<!human\s*resource\s*)\bmanagement\b/i, /(?<!মানবসম্পদ\s*)ব্যবস্থাপনা/i],
      },
      {
        id: 'marketing',
        nameEn: 'Marketing',
        nameBn: 'মার্কেটিং',
        discipline: 'business',
        aliases: [/\bmarketing\b/i, /মার্কেটিং|বিপণন/i],
      },
      {
        id: 'economics',
        nameEn: 'Economics',
        nameBn: 'অর্থনীতি',
        discipline: 'business',
        aliases: [/\beconomics\b/i, /অর্থনীতি/i],
      },
    ],
  },
  {
    id: 'law_social',
    nameEn: 'Law & Social Science',
    nameBn: 'আইন ও সমাজবিজ্ঞান',
    subjects: [
      {
        id: 'law',
        nameEn: 'Law (LLB / LLM)',
        nameBn: 'আইন',
        discipline: 'law_social',
        aliases: [/\b(?:law|ll\.?b|ll\.?m|jurisprudence)\b/i, /আইন\s*(?:বিভাগ)?/i],
      },
      {
        id: 'political_science',
        nameEn: 'Political Science',
        nameBn: 'রাষ্ট্রবিজ্ঞান',
        discipline: 'law_social',
        aliases: [/\bpolitical\s*science\b/i, /রাষ্ট্রবিজ্ঞান/i],
      },
      {
        id: 'sociology',
        nameEn: 'Sociology',
        nameBn: 'সমাজবিজ্ঞান',
        discipline: 'law_social',
        aliases: [/\bsociology\b/i, /সমাজবিজ্ঞান/i],
      },
      {
        id: 'social_work',
        nameEn: 'Social Work / Social Welfare',
        nameBn: 'সমাজকর্ম ও সমাজকল্যাণ',
        discipline: 'law_social',
        aliases: [/\b(?:social\s*work|social\s*welfare)\b/i, /সমাজকর্ম|সমাজকল্যাণ/i],
      },
      {
        id: 'public_administration',
        nameEn: 'Public Administration',
        nameBn: 'লোকপ্রশাসন',
        discipline: 'law_social',
        aliases: [/\bpublic\s*administration\b/i, /লোকপ্রশাসন/i],
      },
      {
        id: 'international_relations',
        nameEn: 'International Relations (IR)',
        nameBn: 'আন্তর্জাতিক সম্পর্ক',
        discipline: 'law_social',
        aliases: [/\b(?:international\s*relations|ir)\b/i, /আন্তর্জাতিক\s*সম্পর্ক/i],
      },
    ],
  },
  {
    id: 'science',
    nameEn: 'Science & Mathematics',
    nameBn: 'বিজ্ঞান ও গণিত',
    subjects: [
      {
        id: 'physics',
        nameEn: 'Physics',
        nameBn: 'পদার্থবিজ্ঞান',
        discipline: 'science',
        aliases: [/\bphysics\b/i, /পদার্থবিজ্ঞান/i],
      },
      {
        id: 'biochemistry',
        nameEn: 'Biochemistry & Molecular Biology',
        nameBn: 'প্রাণরসায়ন ও অণুপ্রাণবিজ্ঞান',
        discipline: 'science',
        aliases: [/\b(?:biochemistry(?:\s*(?:and|&)\s*molecular\s*biology)?)\b/i, /প্রাণরসায়ন/i],
      },
      {
        id: 'chemistry',
        nameEn: 'Chemistry',
        nameBn: 'রসায়ন',
        discipline: 'science',
        aliases: [/(?<!applied\s*|bio)\bchemistry\b/i, /(?<!ফলিত\s*|প্রাণ)রসায়ন\b/i],
      },
      {
        id: 'mathematics',
        nameEn: 'Mathematics',
        nameBn: 'গণিত',
        discipline: 'science',
        aliases: [/\b(?:mathematics|applied\s*mathematics|math)\b/i, /গণিত|ফলিত\s*গণিত/i],
      },
      {
        id: 'statistics',
        nameEn: 'Statistics',
        nameBn: 'পরিসংখ্যান',
        discipline: 'science',
        aliases: [/\b(?:statistics|applied\s*statistics)\b/i, /পরিসংখ্যান|ফলিত\s*পরিসংখ্যান/i],
      },
      {
        id: 'botany',
        nameEn: 'Botany / Plant Science',
        nameBn: 'উদ্ভিদবিজ্ঞান',
        discipline: 'science',
        aliases: [/\b(?:botany|plant\s*science)\b/i, /উদ্ভিদবিজ্ঞান/i],
      },
      {
        id: 'zoology',
        nameEn: 'Zoology',
        nameBn: 'প্রাণিবিজ্ঞান',
        discipline: 'science',
        aliases: [/\bzoology\b/i, /প্রাণিবিজ্ঞান/i],
      },
      {
        id: 'microbiology',
        nameEn: 'Microbiology',
        nameBn: 'অণুজীববিজ্ঞান',
        discipline: 'science',
        aliases: [/\bmicrobiology\b/i, /অণুজীববিজ্ঞান/i],
      },
      {
        id: 'biotechnology',
        nameEn: 'Biotechnology & Genetic Engineering',
        nameBn: 'বায়োটেকনোলজি ও জেনেটিক ইঞ্জিনিয়ারিং',
        discipline: 'science',
        aliases: [/\b(?:biotechnology|genetic\s*engineering)\b/i, /বায়োটেকনোলজি|জেনেটিক\s*ইঞ্জিনিয়ারিং/i],
      },
      {
        id: 'geography',
        nameEn: 'Geography & Environment',
        nameBn: 'ভূগোল ও পরিবেশ',
        discipline: 'science',
        aliases: [/\b(?:geography(?:\s*(?:and|&)\s*environmental?\s*studies)?)\b/i, /ভূগোল(?:\s*ও\s*পরিবেশ)?/i],
      },
    ],
  },
  {
    id: 'humanities',
    nameEn: 'Arts & Humanities',
    nameBn: 'কলা ও মানবিক',
    subjects: [
      {
        id: 'bangla',
        nameEn: 'Bangla Literature & Linguistics',
        nameBn: 'বাংলা ভাষা ও সাহিত্য',
        discipline: 'humanities',
        aliases: [/\b(?:bangla|bengali)\b/i, /বাংলা(?:\s*ভাষা\s*ও\s*সাহিত্য)?/i],
      },
      {
        id: 'english',
        nameEn: 'English Language & Literature',
        nameBn: 'ইংরেজি ভাষা ও সাহিত্য',
        discipline: 'humanities',
        aliases: [/\benglish\b/i, /ইংরেজি(?:\s*ভাষা\s*ও\s*সাহিত্য)?/i],
      },
      {
        id: 'history',
        nameEn: 'History / Islamic History',
        nameBn: 'ইতিহাস ও ইসলামের ইতিহাস',
        discipline: 'humanities',
        aliases: [/\b(?:history|islamic\s*history)\b/i, /ইতিহাস|ইসলামের\s*ইতিহাস/i],
      },
      {
        id: 'philosophy',
        nameEn: 'Philosophy',
        nameBn: 'দর্শন',
        discipline: 'humanities',
        aliases: [/\bphilosophy\b/i, /দর্শন/i],
      },
      {
        id: 'islamic_studies',
        nameEn: 'Islamic Studies / Arabic',
        nameBn: 'ইসলামিক স্টাডিজ ও আরবি',
        discipline: 'humanities',
        aliases: [/\b(?:islamic\s*studies|arabic)\b/i, /ইসলামিক\s*স্টাডিজ|আরবি/i],
      },
      {
        id: 'education',
        nameEn: 'Education (B.Ed / M.Ed)',
        nameBn: 'শিক্ষা ও শিক্ষাতত্ত্ব (বিএড / এমএড)',
        discipline: 'humanities',
        aliases: [/\b(?:education|b\.?ed|m\.?ed)\b/i, /শিক্ষা\s*বিজ্ঞান|বিএড|এমএড/i],
      },
    ],
  },
];

export const ALL_CANONICAL_SUBJECTS: SubjectItem[] = ACADEMIC_DISCIPLINES.flatMap((d) => d.subjects);

const SUBJECT_BY_ID = new Map<string, SubjectItem>(ALL_CANONICAL_SUBJECTS.map((s) => [s.id, s]));

export function getSubjectById(id: string): SubjectItem | undefined {
  return SUBJECT_BY_ID.get(id.toLowerCase().trim());
}

/**
 * Matches raw input text (e.g. from circular or profile) to a canonical SubjectItem.
 */
export function matchSubjectFromText(text: string): SubjectItem | null {
  if (!text) return null;
  const clean = text.trim();
  for (const item of ALL_CANONICAL_SUBJECTS) {
    if (item.id === clean.toLowerCase()) return item;
    for (const alias of item.aliases) {
      if (alias.test(clean)) {
        return item;
      }
    }
  }
  return null;
}
