// JobFill BD - Career Path Planner, Personal Career Goals & Skills Gap Analyzer
// Strictly distinguishes advisory suggestions from verified circular requirements.
// Never invents mandatory circular skills or promises employment.

import { IndexedDBManager, STORES } from '../database/indexeddb';
import type { UserProfile, CareerGoalItem } from '../types/profile';
import type { NormalizedJobCircular } from '../jobs/types/job.types';

const GOALS_FALLBACK_KEY = 'jobfill_career_goals_v1';

export interface CareerTrackSuggestion {
  trackId: string;
  titleEn: string;
  titleBn: string;
  matchedSignals: string[];
  commonSkills: string[];
  recommendedLearningAreas: string[];
  nextMilestones: string[];
  isAdvisorySuggestionOnly: true;
  disclaimer: string;
}

export interface CareerExplorationResult {
  hasSufficientProfileData: boolean;
  paths: CareerTrackSuggestion[];
  guidanceNotice: string;
}

export interface SkillsGapReport {
  jobId: string;
  jobTitle: string;
  organization: string;
  explicitlyExtractedSkills: string[];
  existingMatchedSkills: string[];
  missingSkills: string[];
  noExplicitSkillsListed: boolean;
  disclaimer: string;
}

const KNOWN_SKILL_MATCHERS: Array<{ canonical: string; patterns: RegExp[] }> = [
  { canonical: 'MS Excel / Spreadsheets', patterns: [/\bexcel\b/i, /spreadsheet/i, /এক্সেল/i] },
  { canonical: 'MS Office / Computer Literacy', patterns: [/\bms\s*office\b/i, /computer\s*literacy/i, /ms\s*word/i, /কম্পিউটার\s*(?:দক্ষতা|জ্ঞান|চালনা)/i] },
  { canonical: 'Bangla & English Typing', patterns: [/\btyping\b/i, /bijoy/i, /avro/i, /টাইপিং/i] },
  { canonical: 'English Communication', patterns: [/\benglish\b.*(?:communication|writing|spoken|fluency|proficiency)/i, /communication\s*skill/i] },
  { canonical: 'Python', patterns: [/\bpython\b/i] },
  { canonical: 'JavaScript / TypeScript', patterns: [/\bjavascript\b/i, /\btypescript\b/i, /\breact\b/i, /\bnode\.?js\b/i] },
  { canonical: 'SQL / Databases', patterns: [/\bsql\b/i, /\bmysql\b/i, /\bpostgres/i, /\boracle\b/i, /\bdatabase\b/i] },
  { canonical: 'Java / Spring', patterns: [/\bjava\b/i, /\bspring\b/i] },
  { canonical: 'AutoCAD / CAD Drafting', patterns: [/\bautocad\b/i, /\bcad\b/i] },
  { canonical: 'Networking / CCNA', patterns: [/\bnetworking\b/i, /\bccna\b/i, /\bmikrotik\b/i, /\btcp\/ip\b/i] },
  { canonical: 'Accounting / Tally / ERP', patterns: [/\btally\b/i, /\berp\b/i, /\baccounting\b/i, /\bfinancial\s*reporting\b/i] },
  { canonical: 'GIS / Mapping', patterns: [/\bgis\b/i, /\barcgis\b/i, /\bqgis\b/i] },
  { canonical: 'Data Analysis / Statistics', patterns: [/\bdata\s*analysis\b/i, /\bspss\b/i, /\bstata\b/i, /\bpower\s*bi\b/i] },
  { canonical: 'Project Management', patterns: [/\bproject\s*management\b/i, /\bpmp\b/i, /\bscrum\b/i] },
];

const CAREER_TRACK_TEMPLATES: Array<{
  trackId: string;
  titleEn: string;
  titleBn: string;
  keywords: RegExp[];
  commonSkills: string[];
  recommendedLearningAreas: string[];
  nextMilestones: string[];
}> = [
  {
    trackId: 'track_govt_bcs',
    titleEn: 'Government Cadre & PSC Recruitment (BCS / Ministries)',
    titleBn: 'সরকারি ক্যাডার ও পিএসসি নিয়োগ (বিসিএস / মন্ত্রণালয়)',
    keywords: [/bcs/i, /govt/i, /government/i, /public\s*service/i, /admin/i, /bangla/i, /history/i, /economics/i, /general/i],
    commonSkills: ['Bangla & English Essay Writing', 'Bangladesh & International Affairs', 'Analytical Math & Mental Ability', 'Basic ICT'],
    recommendedLearningAreas: ['Official BPSC syllabus subjects', 'Timed MCQ & Written practice', 'Document readiness (NID, SSC/HSC certs)'],
    nextMilestones: ['Complete Application Profile & Certificates', 'Review Eligibility across Govt Circulars', 'Schedule Daily MCQ & Revision on Calendar'],
  },
  {
    trackId: 'track_bank_fin',
    titleEn: 'Bangladesh Bank & Combined Govt/Private Banking',
    titleBn: 'বাংলাদেশ ব্যাংক ও ব্যাংকিং সেক্টর',
    keywords: [/bank/i, /finance/i, /accounting/i, /bba/i, /mba/i, /economics/i, /commerce/i],
    commonSkills: ['MS Excel / Spreadsheets', 'Quantitative Aptitude', 'English Comprehension & Focus Writing', 'Banking General Knowledge'],
    recommendedLearningAreas: ['Combined Bank MCQ & Written Focus Writing', 'Financial & Data Interpretation', 'Teletalk / BB e-Recruitment portal readiness'],
    nextMilestones: ['Check Combined Bank Senior Officer Eligibility', 'Prepare 300×300 Photo & 300×80 Signature', 'Track Deadlines in Career Calendar'],
  },
  {
    trackId: 'track_it_swe',
    titleEn: 'Software Engineering, ICT Officer & Tech Roles',
    titleBn: 'সফটওয়্যার ইঞ্জিনিয়ারিং ও আইসিটি অফিসার',
    keywords: [/cse/i, /it\b/i, /software/i, /computer/i, /ict/i, /data/i, /typescript/i, /python/i, /developer/i, /network/i],
    commonSkills: ['JavaScript / TypeScript or Python', 'SQL / Databases', 'Git & System Design', 'ICT Subject Preparation'],
    recommendedLearningAreas: ['Core DSA & SQL querying', 'Govt Assistant Programmer syllabus topics', 'Project portfolio documentation in CV Builder'],
    nextMilestones: ['Add Projects & Tech Skills to Unified Profile', 'Create Tech-Focused CV Version', 'Monitor ICT Ministry & Bank IT Circulars'],
  },
  {
    trackId: 'track_engg_utilities',
    titleEn: 'Engineering & Energy Utilities (Petrobangla / BPDB / PGCB)',
    titleBn: 'প্রকৌশল ও জ্বালানি/বিদ্যুৎ সংস্থা (পেট্রোবাংলা / বিপিডিবি)',
    keywords: [/eee/i, /civil/i, /mechanical/i, /engineer/i, /diploma/i, /autocad/i, /power/i, /gas/i],
    commonSkills: ['Department Core Engineering Concepts', 'AutoCAD / CAD Drafting', 'Technical Analytical MCQ & Written'],
    recommendedLearningAreas: ['BUET/PGCB/BPDB pattern departmental practice', 'Departmental Subject codes review', 'Quota & departmental status documentation'],
    nextMilestones: ['Fill Engineering Degree & Department Details', 'Use Teletalk/Petrobangla Smart Autofill', 'Track Exam & Viva Schedule'],
  },
];

export function collectUserSkillStrings(profile: UserProfile): string[] {
  const raw: string[] = [
    ...(profile.careerProfile?.skills || []),
    ...(profile.careerProfile?.careerInterests || []),
    ...(profile.additionalQualifications || []).flatMap((aq) => [aq.title, aq.details].filter(Boolean)),
  ];
  return Array.from(new Set(raw.map((s) => s.trim()).filter(Boolean)));
}

export function exploreCareerPaths(profile: UserProfile): CareerExplorationResult {
  const cp = profile.careerProfile;
  const userSignals: string[] = [
    cp?.departmentOrSubject || '',
    cp?.educationLevel || '',
    profile.graduation?.subjectDegree || '',
    profile.masters?.subjectDegree || '',
    ...(cp?.skills || []),
    ...(cp?.careerInterests || []),
    ...(cp?.preferredJobCategories || []),
  ]
    .map((s) => s.trim())
    .filter(Boolean);

  if (userSignals.length === 0) {
    return {
      hasSufficientProfileData: false,
      paths: [],
      guidanceNotice:
        'No subject, skill, or career interest entered yet. Fill any optional fields in Skills & Career Profile to view matching career pathways — JobFill BD never guesses suitability from empty profiles.',
    };
  }

  const haystack = userSignals.join(' | ');
  const paths: CareerTrackSuggestion[] = [];

  for (const tpl of CAREER_TRACK_TEMPLATES) {
    const matchedSignals = userSignals.filter((sig) =>
      tpl.keywords.some((re) => re.test(sig) || re.test(haystack))
    );
    if (matchedSignals.length > 0) {
      paths.push({
        trackId: tpl.trackId,
        titleEn: tpl.titleEn,
        titleBn: tpl.titleBn,
        matchedSignals: Array.from(new Set(matchedSignals)).slice(0, 6),
        commonSkills: tpl.commonSkills,
        recommendedLearningAreas: tpl.recommendedLearningAreas,
        nextMilestones: tpl.nextMilestones,
        isAdvisorySuggestionOnly: true,
        disclaimer:
          'Advisory exploration based on your entered interests/skills — not a guarantee of suitability or employment. Verify individual official job circulars.',
      });
    }
  }

  return {
    hasSufficientProfileData: true,
    paths,
    guidanceNotice:
      paths.length > 0
        ? `Showing ${paths.length} advisory pathway(s) aligned with your saved profile inputs.`
        : 'Your current keywords did not match preset tracks; you can create custom Personal Career Goals below.',
  };
}

export function analyzeSkillsGap(profile: UserProfile, job: NormalizedJobCircular): SkillsGapReport {
  const circularText = [
    job.jobTitle,
    job.qualification,
    job.description,
    ...(job.requirements || []),
  ]
    .filter(Boolean)
    .join('\n');

  const extracted: string[] = [];
  for (const matcher of KNOWN_SKILL_MATCHERS) {
    if (matcher.patterns.some((re) => re.test(circularText))) {
      extracted.push(matcher.canonical);
    }
  }

  const userSkills = collectUserSkillStrings(profile).map((s) => s.toLowerCase());
  const existingMatchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const reqSkill of extracted) {
    const tokens = reqSkill
      .toLowerCase()
      .split(/[\/\s]+/)
      .filter((t) => t.length >= 2 && !['and', 'or'].includes(t));
    const matched = userSkills.some(
      (us) => us.includes(reqSkill.toLowerCase()) || tokens.some((tk) => us.includes(tk))
    );
    if (matched) existingMatchedSkills.push(reqSkill);
    else missingSkills.push(reqSkill);
  }

  return {
    jobId: job.id,
    jobTitle: job.jobTitle,
    organization: job.organization,
    explicitlyExtractedSkills: extracted,
    existingMatchedSkills,
    missingSkills,
    noExplicitSkillsListed: extracted.length === 0,
    disclaimer:
      'Compares only skills explicitly found in the circular text against your saved profile. Unlisted skills are never marked mandatory.',
  };
}

interface StoredGoalDoc {
  id: string;
  kind: 'career_goal';
  updatedAt: string;
  goal: CareerGoalItem;
}

export class CareerGoalRepository {
  public static async getAll(): Promise<CareerGoalItem[]> {
    if (typeof indexedDB !== 'undefined') {
      try {
        const docs = await IndexedDBManager.executeTransaction<StoredGoalDoc[]>(
          STORES.STUDY_NOTES,
          'readonly',
          (store) =>
            new Promise((resolve, reject) => {
              const req = store.getAll();
              req.onsuccess = () => resolve((req.result || []).filter((r: any) => r?.kind === 'career_goal'));
              req.onerror = () => reject(req.error);
            })
        );
        return docs.map((d) => d.goal);
      } catch {
        // Fallback below
      }
    }
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(GOALS_FALLBACK_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  public static async save(goal: CareerGoalItem): Promise<CareerGoalItem> {
    if (!goal.title.trim()) throw new Error('Goal title is required.');
    const clean: CareerGoalItem = {
      ...goal,
      id: goal.id || `goal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      title: goal.title.trim(),
      progressPercent: Math.min(100, Math.max(0, Math.round(goal.progressPercent || 0))),
    };

    const doc: StoredGoalDoc = {
      id: clean.id,
      kind: 'career_goal',
      updatedAt: new Date().toISOString(),
      goal: clean,
    };

    if (typeof indexedDB !== 'undefined') {
      try {
        await IndexedDBManager.executeTransaction(STORES.STUDY_NOTES, 'readwrite', (store) =>
          new Promise<void>((resolve, reject) => {
            const req = store.put(doc);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
          })
        );
        return clean;
      } catch {
        // Fallback below
      }
    }
    if (typeof localStorage !== 'undefined') {
      const prev = await this.getAll();
      const next = prev.filter((g) => g.id !== clean.id).concat(clean);
      localStorage.setItem(GOALS_FALLBACK_KEY, JSON.stringify(next));
    }
    return clean;
  }

  public static async remove(id: string): Promise<void> {
    if (typeof indexedDB !== 'undefined') {
      try {
        await IndexedDBManager.executeTransaction(STORES.STUDY_NOTES, 'readwrite', (store) =>
          new Promise<void>((resolve, reject) => {
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
          })
        );
        return;
      } catch {
        // Fallback
      }
    }
    if (typeof localStorage !== 'undefined') {
      const prev = await this.getAll();
      localStorage.setItem(GOALS_FALLBACK_KEY, JSON.stringify(prev.filter((g) => g.id !== id)));
    }
  }
}
