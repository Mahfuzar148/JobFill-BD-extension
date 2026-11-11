// JobFill BD - Official Job Portals Quick Access Registry
// Holds strictly verified, predefined HTTPS job portal URLs and safe tab-opening helpers.
// Never sends user profile data automatically and never navigates away from existing extension tabs.

import { verifyJobUrl } from '../services/source-verifier';

export type OfficialPortalCategory =
  | 'Government'
  | 'Bank'
  | 'Education'
  | 'Private'
  | 'International'
  | 'Remote';

export type PortalFilterCategory = 'All' | OfficialPortalCategory;

export interface OfficialJobPortalEntry {
  id: string;
  name: string;
  nameBn: string;
  shortName: string;
  category: OfficialPortalCategory;
  categoryBn: string;
  url: string;
  domain: string;
  description: string;
  descriptionBn: string;
  monogram: string;
  badgeColorClass: string;
  accentGradientClass: string;
  logoUrl?: string;
  searchTags: string[];
  isBangladeshOfficial: boolean;
}

export const OFFICIAL_PORTAL_CATEGORIES: OfficialPortalCategory[] = [
  'Government',
  'Bank',
  'Education',
  'Private',
  'International',
  'Remote',
];

export const OFFICIAL_PORTAL_CATEGORY_LABELS: Record<
  PortalFilterCategory,
  { en: string; bn: string }
> = {
  All: { en: 'All', bn: 'সব পোর্টাল' },
  Government: { en: 'Government', bn: 'সরকারি চাকরি' },
  Bank: { en: 'Bank', bn: 'ব্যাংক চাকরি' },
  Education: { en: 'Education', bn: 'শিক্ষা ও শিক্ষক' },
  Private: { en: 'Private', bn: 'বেসরকারি ও সাধারণ' },
  International: { en: 'International', bn: 'আন্তর্জাতিক' },
  Remote: { en: 'Remote', bn: 'রিমোট চাকরি' },
};

export const OFFICIAL_JOB_PORTALS: OfficialJobPortalEntry[] = [
  {
    id: 'teletalk-alljobs',
    name: 'Teletalk Alljobs',
    nameBn: 'টেলিটক অলজবস',
    shortName: 'Alljobs',
    category: 'Government',
    categoryBn: 'সরকারি চাকরি',
    url: 'https://alljobs.teletalk.com.bd/jobs/government',
    domain: 'alljobs.teletalk.com.bd',
    description:
      'Central Teletalk government recruitment portal listing active ministry, directorate, and autonomous job circulars.',
    descriptionBn:
      'টেলিটকের কেন্দ্রীয় সরকারি চাকরি পোর্টাল—মন্ত্রণালয়, অধিদপ্তর ও স্বায়ত্তশাসিত প্রতিষ্ঠানের চলমান বিজ্ঞপ্তি।',
    monogram: 'TA',
    badgeColorClass:
      'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    accentGradientClass: 'from-emerald-600 to-teal-700',
    searchTags: ['govt', 'teletalk', 'alljobs', 'ministry', 'application'],
    isBangladeshOfficial: true,
  },
  {
    id: 'bpsc-official',
    name: 'BPSC',
    nameBn: 'বাংলাদেশ সরকারি কর্ম কমিশন (BPSC)',
    shortName: 'BPSC',
    category: 'Government',
    categoryBn: 'সরকারি চাকরি',
    url: 'https://bpsc.gov.bd/',
    domain: 'bpsc.gov.bd',
    description:
      'Official website of Bangladesh Public Service Commission for BCS, cadre, and non-cadre recruitment notices.',
    descriptionBn:
      'বাংলাদেশ সরকারি কর্ম কমিশনের অফিশিয়াল ওয়েবসাইট—বিসিএস, ক্যাডার ও নন-ক্যাডার নিয়োগ বিজ্ঞপ্তি ও ফলাফল।',
    monogram: 'BP',
    badgeColorClass:
      'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    accentGradientClass: 'from-teal-700 to-emerald-800',
    searchTags: ['bcs', 'cadre', 'non-cadre', 'govt', 'commission'],
    isBangladeshOfficial: true,
  },
  {
    id: 'bpsc-teletalk',
    name: 'BPSC Teletalk',
    nameBn: 'বিপিএসসি টেলিটক আবেদন পোর্টাল',
    shortName: 'BPSC Apply',
    category: 'Government',
    categoryBn: 'সরকারি চাকরি',
    url: 'https://bpscs.teletalk.com.bd/',
    domain: 'bpscs.teletalk.com.bd',
    description:
      'Official BPSC online application and admit card portal powered by Teletalk Bangladesh.',
    descriptionBn:
      'টেলিটক পরিচালিত বিপিএসসির অনলাইন আবেদনপত্র পূরণ ও প্রবেশপত্র ডাউনলোড পোর্টাল।',
    monogram: 'BT',
    badgeColorClass:
      'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    accentGradientClass: 'from-emerald-700 to-cyan-700',
    searchTags: ['bcs', 'bpsc', 'teletalk', 'admit card', 'online apply'],
    isBangladeshOfficial: true,
  },
  {
    id: 'bangladesh-national-portal',
    name: 'Bangladesh National Portal',
    nameBn: 'বাংলাদেশ জাতীয় তথ্য বাতায়ন',
    shortName: 'National Portal',
    category: 'Government',
    categoryBn: 'সরকারি চাকরি',
    url: 'https://bangladesh.gov.bd/pages/job-tender-announcements',
    domain: 'bangladesh.gov.bd',
    description:
      'Official national portal directory publishing government ministry and department job announcements.',
    descriptionBn:
      'সরকারি মন্ত্রণালয় ও দপ্তরের নিয়োগ বিজ্ঞপ্তি প্রকাশিত হওয়া বাংলাদেশের জাতীয় তথ্য বাতায়ন পোর্টাল।',
    monogram: 'BD',
    badgeColorClass:
      'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    accentGradientClass: 'from-green-700 to-emerald-800',
    searchTags: ['bangladesh.gov.bd', 'national', 'ministry', 'notice', 'govt'],
    isBangladeshOfficial: true,
  },
  {
    id: 'bangladesh-bank-erecruitment',
    name: 'Bangladesh Bank eRecruitment',
    nameBn: 'বাংলাদেশ ব্যাংক ই-রিক্রুটমেন্ট',
    shortName: 'BB eRecruitment',
    category: 'Bank',
    categoryBn: 'ব্যাংক চাকরি',
    url: 'https://erecruitment.bb.org.bd/',
    domain: 'erecruitment.bb.org.bd',
    description:
      'Bankers Selection Committee (BSC) portal for Bangladesh Bank and state-owned commercial bank recruitment.',
    descriptionBn:
      'ব্যাংকার্স সিলেকশন কমিটি ও সরকারি ব্যাংকগুলোর অনলাইন নিয়োগ আবেদন ও প্রবেশপত্র পোর্টাল।',
    monogram: 'BE',
    badgeColorClass:
      'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
    accentGradientClass: 'from-sky-600 to-blue-700',
    searchTags: ['bank', 'bsc', 'combined bank', 'senior officer', 'erecruitment'],
    isBangladeshOfficial: true,
  },
  {
    id: 'bangladesh-bank-official',
    name: 'Bangladesh Bank',
    nameBn: 'বাংলাদেশ ব্যাংক (মূল ওয়েবসাইট)',
    shortName: 'BB',
    category: 'Bank',
    categoryBn: 'ব্যাংক চাকরি',
    url: 'https://www.bb.org.bd/',
    domain: 'www.bb.org.bd',
    description:
      'Official central bank website for Bangladesh Bank policy announcements, career circulars, and exam updates.',
    descriptionBn:
      'বাংলাদেশের কেন্দ্রীয় ব্যাংকের অফিশিয়াল ওয়েবসাইট—চাকরির বিজ্ঞপ্তি, নোটিশ ও পরীক্ষার তথ্য।',
    monogram: 'BB',
    badgeColorClass:
      'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
    accentGradientClass: 'from-blue-700 to-indigo-700',
    searchTags: ['central bank', 'bb.org.bd', 'bank job', 'notice'],
    isBangladeshOfficial: true,
  },
  {
    id: 'ntrca-official',
    name: 'NTRCA',
    nameBn: 'এনটিআরসিএ (NTRCA)',
    shortName: 'NTRCA',
    category: 'Education',
    categoryBn: 'শিক্ষা ও শিক্ষক',
    url: 'https://ntrca.gov.bd/',
    domain: 'ntrca.gov.bd',
    description:
      'Non-Government Teachers Registration and Certification Authority portal for teacher recruitment circulars.',
    descriptionBn:
      'বেসরকারি শিক্ষক নিবন্ধন ও প্রত্যয়ন কর্তৃপক্ষের অফিশিয়াল ওয়েবসাইট—নিয়োগ বিজ্ঞপ্তি ও গণবিজ্ঞপ্তি।',
    monogram: 'NT',
    badgeColorClass:
      'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800',
    accentGradientClass: 'from-violet-600 to-purple-700',
    searchTags: ['teacher', 'school', 'college', 'madrasah', 'teaching'],
    isBangladeshOfficial: true,
  },
  {
    id: 'ntrca-teletalk',
    name: 'NTRCA Teletalk',
    nameBn: 'এনটিআরসিএ টেলিটক আবেদন',
    shortName: 'NTRCA Apply',
    category: 'Education',
    categoryBn: 'শিক্ষা ও শিক্ষক',
    url: 'https://ntrcar.teletalk.com.bd/',
    domain: 'ntrcar.teletalk.com.bd',
    description:
      'Official Teletalk application and merit verification portal for NTRCA teacher registration exams.',
    descriptionBn:
      'শিক্ষক নিবন্ধন পরীক্ষা ও আবেদনপত্র পূরণের অফিশিয়াল টেলিটক পোর্টাল।',
    monogram: 'NR',
    badgeColorClass:
      'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800',
    accentGradientClass: 'from-purple-600 to-indigo-700',
    searchTags: ['ntrca', 'teletalk', 'teacher registration', 'exam', 'teaching'],
    isBangladeshOfficial: true,
  },
  {
    id: 'dpe-official',
    name: 'Directorate of Primary Education',
    nameBn: 'প্রাথমিক শিক্ষা অধিদপ্তর (DPE)',
    shortName: 'DPE',
    category: 'Education',
    categoryBn: 'শিক্ষা ও শিক্ষক',
    url: 'https://dpe.gov.bd/',
    domain: 'dpe.gov.bd',
    description:
      'Official Directorate of Primary Education website for assistant primary teacher circulars and exam schedules.',
    descriptionBn:
      'প্রাথমিক বিদ্যালয়ের সহকারী শিক্ষক নিয়োগ বিজ্ঞপ্তি, পরীক্ষার সময়সূচি ও ফলাফলের অফিশিয়াল সাইট।',
    monogram: 'DP',
    badgeColorClass:
      'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800',
    accentGradientClass: 'from-fuchsia-600 to-violet-700',
    searchTags: ['primary teacher', 'dpe', 'school', 'teaching', 'govt teacher'],
    isBangladeshOfficial: true,
  },
  {
    id: 'bdjobs-official',
    name: 'Bdjobs',
    nameBn: 'বিডিজবস (Bdjobs)',
    shortName: 'Bdjobs',
    category: 'Private',
    categoryBn: 'বেসরকারি ও সাধারণ',
    url: 'https://www.bdjobs.com/',
    domain: 'www.bdjobs.com',
    description:
      'Bangladesh private sector, corporate, NGO, IT, and general job portal with daily employer postings.',
    descriptionBn:
      'বাংলাদেশের বৃহত্তম বেসরকারি, কর্পোরেট, এনজিও ও আইটি চাকরির পোর্টাল।',
    monogram: 'BJ',
    badgeColorClass:
      'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    accentGradientClass: 'from-amber-600 to-orange-600',
    searchTags: ['private', 'corporate', 'ngo', 'it', 'dhaka', 'general'],
    isBangladeshOfficial: true,
  },
  {
    id: 'himalayas-jobs',
    name: 'Himalayas',
    nameBn: 'হিমালয়াস (Himalayas)',
    shortName: 'Himalayas',
    category: 'International',
    categoryBn: 'আন্তর্জাতিক',
    url: 'https://himalayas.app/jobs',
    domain: 'himalayas.app',
    description:
      'Curated global and remote-friendly job board featuring international tech, product, and engineering roles.',
    descriptionBn:
      'আন্তর্জাতিক টেক, প্রোডাক্ট ও রিমোট-ফ্রেন্ডলি চাকরির সুবিন্যস্ত গ্লোবাল পোর্টাল।',
    monogram: 'HM',
    badgeColorClass:
      'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
    accentGradientClass: 'from-indigo-600 to-blue-700',
    searchTags: ['international', 'global', 'remote', 'tech', 'worldwide'],
    isBangladeshOfficial: false,
  },
  {
    id: 'remoteok-jobs',
    name: 'RemoteOK',
    nameBn: 'রিমোটওকে (RemoteOK)',
    shortName: 'RemoteOK',
    category: 'Remote',
    categoryBn: 'রিমোট চাকরি',
    url: 'https://remoteok.com/',
    domain: 'remoteok.com',
    description:
      'Popular worldwide remote job board listing software engineering, design, support, and async roles.',
    descriptionBn:
      'সফটওয়্যার ইঞ্জিনিয়ারিং, ডিজাইন ও অ্যাসিঙ্ক রিমোট চাকরির জনপ্রিয় আন্তর্জাতিক পোর্টাল।',
    monogram: 'RO',
    badgeColorClass:
      'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800',
    accentGradientClass: 'from-teal-600 to-emerald-700',
    searchTags: ['remote', 'work from home', 'developer', 'international', 'async'],
    isBangladeshOfficial: false,
  },
  {
    id: 'remotive-jobs',
    name: 'Remotive',
    nameBn: 'রিমোটিভ (Remotive)',
    shortName: 'Remotive',
    category: 'Remote',
    categoryBn: 'রিমোট চাকরি',
    url: 'https://remotive.com/',
    domain: 'remotive.com',
    description:
      'Verified remote career directory covering engineering, marketing, operations, and customer success teams.',
    descriptionBn:
      'ইঞ্জিনিয়ারিং, মার্কেটিং ও অপারেশনস ভিত্তিক যাচাইকৃত রিমোট চাকরির পোর্টাল।',
    monogram: 'RM',
    badgeColorClass:
      'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800',
    accentGradientClass: 'from-cyan-600 to-teal-700',
    searchTags: ['remote', 'software', 'marketing', 'international', 'work anywhere'],
    isBangladeshOfficial: false,
  },
  {
    id: 'arbeitnow-jobs',
    name: 'Arbeitnow',
    nameBn: 'আরবাইটনাউ (Arbeitnow)',
    shortName: 'Arbeitnow',
    category: 'International',
    categoryBn: 'আন্তর্জাতিক',
    url: 'https://www.arbeitnow.com/',
    domain: 'www.arbeitnow.com',
    description:
      'European and international career portal featuring visa-sponsored, English-speaking, and remote positions.',
    descriptionBn:
      'ভিসা স্পনসরশিপ, ইংরেজি-ভাষাভিত্তিক ও ইউরোপীয়/আন্তর্জাতিক রিমোট চাকরির পোর্টাল।',
    monogram: 'AN',
    badgeColorClass:
      'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
    accentGradientClass: 'from-slate-700 to-indigo-700',
    searchTags: ['international', 'europe', 'visa sponsorship', 'remote', 'english'],
    isBangladeshOfficial: false,
  },
];

const OFFICIAL_PORTALS_BY_URL = new Map<string, OfficialJobPortalEntry>(
  OFFICIAL_JOB_PORTALS.map((portal) => [portal.url, portal])
);

/**
 * Validates strictly against the predefined HTTPS official portal allowlist and URL security verifier.
 */
export function isTrustedOfficialPortalUrl(rawUrl?: string | null): boolean {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed || !trimmed.startsWith('https://')) {
    return false;
  }
  const canonicalEntry = OFFICIAL_PORTALS_BY_URL.get(trimmed);
  if (!canonicalEntry) {
    return false;
  }
  const securityCheck = verifyJobUrl(canonicalEntry.url);
  return securityCheck.isValid && securityCheck.isSafeToOpen;
}

export interface PortalOpenResult {
  opened: boolean;
  url: string;
  method: 'chrome.tabs.create' | 'window.open' | 'blocked';
  error?: string;
}

/**
 * Opens an official portal exclusively in a new Chrome tab via `chrome.tabs.create`.
 * Never opens inside popup, never replaces the active Dashboard tab, and never accepts non-allowlisted URLs.
 */
export async function openOfficialPortalInNewTab(rawUrl?: string | null): Promise<PortalOpenResult> {
  const trimmed = (rawUrl || '').trim();
  const canonicalEntry = OFFICIAL_PORTALS_BY_URL.get(trimmed);
  if (!canonicalEntry || !isTrustedOfficialPortalUrl(trimmed)) {
    return {
      opened: false,
      url: '',
      method: 'blocked',
      error: 'Blocked untrusted or non-HTTPS portal URL.',
    };
  }

  const safeUrl = canonicalEntry.url;

  if (typeof chrome !== 'undefined' && chrome.tabs && typeof chrome.tabs.create === 'function') {
    try {
      const maybePromise = chrome.tabs.create({ url: safeUrl, active: true }) as unknown;
      if (maybePromise && typeof (maybePromise as Promise<unknown>).then === 'function') {
        await (maybePromise as Promise<unknown>);
      }
      return { opened: true, url: safeUrl, method: 'chrome.tabs.create' };
    } catch (err: any) {
      return {
        opened: false,
        url: '',
        method: 'blocked',
        error: err?.message || 'Failed to open browser tab.',
      };
    }
  }

  if (typeof window !== 'undefined' && typeof window.open === 'function') {
    window.open(safeUrl, '_blank', 'noopener,noreferrer');
    return { opened: true, url: safeUrl, method: 'window.open' };
  }

  return {
    opened: false,
    url: '',
    method: 'blocked',
    error: 'Browser tab API unavailable.',
  };
}

/**
 * Filters the official portal directory cleanly by category pill and search query.
 */
export function filterOfficialPortals(
  portals: OfficialJobPortalEntry[],
  category: PortalFilterCategory,
  searchQuery: string
): OfficialJobPortalEntry[] {
  const q = searchQuery.trim().toLowerCase();

  return portals.filter((portal) => {
    if (category !== 'All' && portal.category !== category) {
      return false;
    }
    if (!q) return true;

    const haystack = [
      portal.name,
      portal.nameBn,
      portal.shortName,
      portal.category,
      portal.categoryBn,
      portal.domain,
      portal.url,
      portal.description,
      portal.descriptionBn,
      ...portal.searchTags,
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(q);
  });
}
