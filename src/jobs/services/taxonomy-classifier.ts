// JobFill BD - Deterministic & Rules-Based Universal Job Taxonomy Classifier (27 Categories)
// Supports multi-label classification, bilingual stem matching (English & Bengali),
// organization mapping, evidence recording, and verification states.
// Never discards or hallucinates; assigns 'other_unclassified' with isUnclassified: true if confidence is low.

import {
  UNIVERSAL_JOB_TAXONOMY,
  JobTaxonomyRegistry,
  EmployerType,
  WorkMode,
  ExperienceLevel,
  MainCategoryDefinition,
  SubcategoryDefinition,
} from '../taxonomy/job-taxonomy';
import { NormalizedJobCircular } from '../types/job.types';

export type ClassificationVerificationState =
  | 'VERIFIED'
  | 'HIGH_CONFIDENCE_UNVERIFIED'
  | 'AMBIGUOUS'
  | 'UNCLASSIFIED'
  | 'NOT_APPLICABLE';

export interface TaxonomyClassificationResult {
  taxonomyCategoryId: string; // Primary category
  taxonomyCategoryNameEn: string;
  taxonomyCategoryNameBn: string;
  taxonomyCategoryIds: string[]; // Multi-label: all matching category IDs
  primaryCategoryId: string;
  secondaryCategoryIds: string[];
  taxonomySubcategoryId: string | null;
  taxonomySubcategoryNameEn: string | null;
  taxonomySubcategoryNameBn: string | null;
  industry: string;
  employerType: EmployerType;
  workMode: WorkMode;
  experienceLevel: ExperienceLevel;
  classificationConfidence: number; // 0 to 100
  classificationMethod: 'ORGANIZATION_MAPPING' | 'RULE_BASED' | 'MULTI_LABEL' | 'SOURCE_DEFAULT' | 'UNCLASSIFIED';
  classificationEvidence: string[];
  verificationState: ClassificationVerificationState;
  isUnclassified: boolean;
}

export class JobTaxonomyClassifier {
  /**
   * Matches keyword token accurately avoiding substring false positives (e.g. 'coo' in 'coordinator')
   */
  public static matchesToken(text: string, kw: string): boolean {
    if (!text || !kw) return false;
    const lowerText = text.toLowerCase();
    const lowerKw = kw.toLowerCase().trim();
    if (!lowerKw) return false;

    // Short tokens (<= 4 chars) require boundary matching to avoid partial substring hits
    if (lowerKw.length <= 4) {
      const escaped = lowerKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|[^a-zA-Z0-9\u0980-\u09FF])${escaped}([^a-zA-Z0-9\u0980-\u09FF]|$)`, 'i');
      return regex.test(text);
    }
    return lowerText.includes(lowerKw);
  }

  /**
   * Normalizes Bengali and English text and numerals
   */
  private static normalizeText(text: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)))
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Classifies a job by its metadata using multi-label deterministic rules.
   */
  public static classify(job: {
    jobTitle?: string;
    title?: string;
    position?: string;
    organization?: string;
    organizationBn?: string | null;
    description?: string;
    category?: string;
    sourceId?: string;
    location?: string;
    employmentType?: string;
    experience?: string;
    department?: string;
    industry?: string;
  }): TaxonomyClassificationResult {
    const rawTitle = (job.jobTitle || job.title || job.position || '').trim();
    const rawPos = (job.position || rawTitle).trim();
    const rawOrg = (job.organization || '').trim();
    const rawOrgBn = (job.organizationBn || '').trim();
    const rawDesc = (job.description || '').slice(0, 1500).trim();
    const catHint = (job.category || '').toLowerCase();
    const sourceId = (job.sourceId || '').toLowerCase();
    const loc = (job.location || '').toLowerCase();
    const exp = (job.experience || '').toLowerCase();

    const titleNorm = this.normalizeText(rawTitle);
    const posNorm = this.normalizeText(rawPos);
    const orgNorm = this.normalizeText(`${rawOrg} ${rawOrgBn}`);
    const fullText = this.normalizeText(`${rawTitle} ${rawPos} ${rawOrg} ${rawOrgBn} ${rawDesc}`);

    const evidence: string[] = [];
    const matchedCategoryIds = new Set<string>();
    interface CategoryScoreEntry {
      score: number;
      bestSub: SubcategoryDefinition | null;
      bestSubWeight: number;
      evidenceNotes: string[];
    }
    const categoryScores = new Map<string, CategoryScoreEntry>();

    // 1. Work Mode Detection
    let workMode: WorkMode = 'On-Site';
    if (/\bremote\b|work from home|wfh|রিমোট|হোম\s*বেজড/i.test(fullText) || loc.includes('remote') || sourceId.includes('remote')) {
      workMode = 'Remote';
    } else if (/\bhybrid\b|হাইব্রিড/i.test(fullText)) {
      workMode = 'Hybrid';
    } else if (/\bfield\b|মাঠ\s*পর্যায়ে|community based|field based/i.test(fullText)) {
      workMode = 'Field-Based';
    }

    // 2. Experience Level Detection
    let experienceLevel: ExperienceLevel = 'Entry-Level';
    if (/no experience|fresh graduate|নতুনদের|অভিজ্ঞতার\s*প্রয়োজন\s*নেই|entry level|শিক্ষানবিস/i.test(fullText) || exp.includes('no experience')) {
      experienceLevel = 'Fresh Graduate';
    } else if (/(\b[1-3]\b)\s*(years?|বৎস?র)/i.test(fullText) || exp.includes('1') || exp.includes('2')) {
      experienceLevel = '1–3 Years';
    } else if (/(\b[3-5]\b)\s*(years?|বৎস?r)/i.test(fullText) || exp.includes('3') || exp.includes('4')) {
      experienceLevel = '3–5 Years';
    } else if (/(\b[5-9]\b|1[0-9])\s*(years?|বৎস?র|\+|প্লাস)/i.test(fullText) || /senior|managerial|প্রধান|নির্বাহী|পরিচালক/i.test(rawTitle)) {
      experienceLevel = /manager|head|director|পরিচালক|ব্যবস্থাপক/i.test(rawTitle) ? 'Managerial' : '5+ Years';
    }

    // Helper to add score to a category
    const addScore = (catId: string, pts: number, note: string, sub?: SubcategoryDefinition | null, subWeight = 0) => {
      const canonical = JobTaxonomyRegistry.resolveCategoryId(catId);
      const current: CategoryScoreEntry = categoryScores.get(canonical) || { score: 0, bestSub: null, bestSubWeight: 0, evidenceNotes: [] };
      current.score += pts;
      current.evidenceNotes.push(note);
      const effectiveWeight = subWeight || pts;
      if (sub && (!current.bestSub || effectiveWeight > current.bestSubWeight)) {
        current.bestSub = sub;
        current.bestSubWeight = effectiveWeight;
      }
      categoryScores.set(canonical, current);
    };

    // 3. Organization & Source Mapping (High-Confidence Deterministic Rules)

    // A. Government Commissions & Ministries:
    if (/bpsc|public service commission|কর্ম কমিশন|ministry|মন্ত্রণালয়|secretariat|সচিবালয়|directorate|পরিদপ্তর|বিসিএস|bcs|national portal/i.test(orgNorm) || /bcs|বিসিএস|ক্যাডার/i.test(titleNorm)) {
      const isBCS = /bcs|বিসিএস|ক্যাডার/i.test(titleNorm) || /bpsc|কর্ম কমিশন/i.test(orgNorm);
      const isMinistry = /ministry|মন্ত্রণালয়|সচিবালয়/i.test(orgNorm);
      const subCat = isBCS ? 'bcs_civil' : isMinistry ? 'ministry' : 'directorate';
      const sub = JobTaxonomyRegistry.getSubcategoryById('govt_public', subCat);
      addScore('govt_public', 90, `Org match: ${rawOrg} (${subCat})`, sub);
      evidence.push(`Government mapping: ${rawOrg}`);
    }

    // B. Banking Institutions:
    if (/bangladesh bank|sonali bank|janata bank|agrani bank|rupali bank|brac bank|city bank|ebl|eastern bank|bankers selection|krishi bank|nbfi|idlc|ipdc/i.test(orgNorm) || /bank|banking|ব্যাংক/i.test(rawOrg)) {
      const isCentral = /bangladesh bank|বাংলাদেশ ব্যাংক/i.test(orgNorm);
      const isGovtBank = /sonali|janata|agrani|rupali|krishi|বাংলাদেশ কৃষি ব্যাংক/i.test(orgNorm);
      const subCat = isCentral ? 'central_bank' : isGovtBank ? 'public_bank' : 'private_bank';
      const sub = JobTaxonomyRegistry.getSubcategoryById('banking_finance', subCat);
      addScore('banking_finance', 90, `Org match: ${rawOrg} (${subCat})`, sub);
      if (isGovtBank || isCentral) {
        // Multi-label: Govt Bank is also Government & Public Sector when government or cadre is indicated
        const hasGovtHint = /govt|government|সরকারি|ক্যাডার|বিসিএস|৯ম|১০ম|grade/i.test(`${rawTitle} ${rawOrg}`);
        if (hasGovtHint) {
          addScore('govt_public', 50, `Government Bank role: ${rawOrg}`);
        }
      }
      evidence.push(`Banking mapping: ${rawOrg}`);
    }

    // C. Healthcare & Hospitals:
    if (/hospital|clinic|dghs|স্বাস্থ্য অধিদপ্তর|স্বাস্থ্য|pharmaceutical|square pharma|beximco pharma|incepta|medical college|dental college|nursing/i.test(orgNorm)) {
      const isNurse = /nurse|নার্স|সেবিকা/i.test(titleNorm);
      const isDoctor = /doctor|medical officer|চিকিৎসক|mbbs/i.test(titleNorm);
      const isPharma = /pharma|medical representative|mpo/i.test(titleNorm);
      const subCat = isNurse ? 'nurse' : isDoctor ? 'doctor' : isPharma ? 'pharmaceutical' : 'hospital_admin';
      const sub = JobTaxonomyRegistry.getSubcategoryById('medical_healthcare', subCat);
      addScore('medical_healthcare', 88, `Org match: ${rawOrg} (${subCat})`, sub);
      evidence.push(`Healthcare mapping: ${rawOrg}`);
    }

    // D. Educational Institutions:
    if (!/medical college|dental college|nursing college/i.test(orgNorm) && /ntrca|dpe|dshe|university|বিশ্ববিদ্যালয়|college|কলেজ|school|মাদ্রাসা|primary education/i.test(orgNorm)) {
      const isPrimary = /primary|dpe|প্রাথমিক/i.test(orgNorm) || /primary|সহকারী শিক্ষক/i.test(titleNorm);
      const isUni = /university|বিশ্ববিদ্যালয়/i.test(orgNorm);
      const subCat = isPrimary ? 'primary_teacher' : isUni ? 'university_faculty' : 'school_teacher';
      const sub = JobTaxonomyRegistry.getSubcategoryById('education_research', subCat);
      addScore('education_research', 88, `Org match: ${rawOrg} (${subCat})`, sub);
      evidence.push(`Education mapping: ${rawOrg}`);
    }

    // E. NGOs & Development:
    if (/brac|icddr|undp|unicef|unhcr|care bangladesh|oxfam|save the children|usaid|world vision|actionaid/i.test(orgNorm) || sourceId.includes('reliefweb')) {
      const isME = /monitoring|evaluation|m&e/i.test(titleNorm);
      const subCat = isME ? 'm_and_e' : 'project_officer';
      const sub = JobTaxonomyRegistry.getSubcategoryById('ngo_development', subCat);
      addScore('ngo_development', 88, `Org match: ${rawOrg}`, sub);
      evidence.push(`NGO mapping: ${rawOrg}`);
    }

    // F. Defence, Police & Security:
    if (/police|পুলিশ|army|সেনাবাহিনী|navy|নৌবাহিনী|air force|বিমানবাহিনী|ansar|আনসার|bgb|বিজিবি|fire service|ফায়ার সার্ভিস|rab|র‌্যাব/i.test(orgNorm) || /constable|sub inspector|সিপাহী|কনস্টেবল/i.test(titleNorm)) {
      const subCat = /police|পুলিশ/i.test(orgNorm) ? 'police' : /army/i.test(orgNorm) ? 'army' : /navy/i.test(orgNorm) ? 'navy' : 'security_guard';
      const sub = JobTaxonomyRegistry.getSubcategoryById('defence_security', subCat);
      addScore('defence_security', 90, `Defence/Police match: ${rawOrg}`, sub);
      addScore('govt_public', 50, `Public Defence force: ${rawOrg}`);
      evidence.push(`Defence/Security mapping: ${rawOrg}`);
    }

    // G. Telecom:
    if (/grameenphone|robi|banglalink|teletalk|btcl|btrc|টেলিকম|টেলিযোগাযোগ/i.test(orgNorm)) {
      const isOps = /bts|rf|telecom engineer|transmission|সুইচিং|ট্রান্সমিশন/i.test(titleNorm);
      const isNoc = /noc|switching|নেটওয়ার্ক অপারেশন/i.test(titleNorm);
      const subCat = isOps ? 'telecom_ops' : isNoc ? 'network_ops' : 'mobile_network';
      const sub = JobTaxonomyRegistry.getSubcategoryById('telecom_communication', subCat);
      addScore('telecom_communication', 90, `Telecom match: ${rawOrg} (${subCat})`, sub, 95);
      evidence.push(`Telecom mapping: ${rawOrg}`);
    }

    // H. Power, Energy & Environment:
    if (/bpdb|desco|dpdc|pgcb|petrobangla|bpc|titas|বিদ্যুৎ|নেসকো|ডেসকো/i.test(orgNorm)) {
      const sub = JobTaxonomyRegistry.getSubcategoryById('environment_energy', 'power_electricity');
      addScore('environment_energy', 88, `Power/Energy match: ${rawOrg}`, sub);
      addScore('govt_public', 55, `Public Utility/Corp: ${rawOrg}`);
      evidence.push(`Energy/Power mapping: ${rawOrg}`);
    }

    // I. Aviation:
    if (/biman bangladesh|বিমান বাংলাদেশ|caab|বেবিচক|us-bangla|novoair|air traffic/i.test(orgNorm)) {
      const isPilot = /pilot|পাইলট|captain|first officer/i.test(titleNorm);
      const isCabinCrew = /cabin crew|কেবিন ক্রু|flight attendant|এয়ার হোস্টেস/i.test(titleNorm);
      const isATC = /air traffic|atc|এটিসি/i.test(titleNorm);
      const subCat = isPilot ? 'pilot_flight' : isCabinCrew ? 'cabin_crew' : isATC ? 'air_traffic' : 'airport_ops';
      const sub = JobTaxonomyRegistry.getSubcategoryById('aviation_aerospace', subCat);
      addScore('aviation_aerospace', 90, `Aviation match: ${rawOrg} (${subCat})`, sub, 95);
      evidence.push(`Aviation mapping: ${rawOrg}`);
    }

    // Real Estate:
    if (/real estate|housing|sheltech|shanta|হাউজিং|প্রোপার্টিজ|আবাসন|ডেল্টা হাউজিং/i.test(orgNorm) || /ফ্ল্যাট|প্লট|রিয়েল এস্টেট|অ্যাপার্টমেন্ট/i.test(titleNorm)) {
      const isSales = /sales|বিক্রয়|consultant|marketing/i.test(titleNorm);
      const subCat = isSales ? 'real_estate_sales' : 'facility_mgmt';
      const sub = JobTaxonomyRegistry.getSubcategoryById('real_estate', subCat);
      addScore('real_estate', 90, `Real estate match: ${rawOrg || rawTitle} (${subCat})`, sub, 95);
      evidence.push(`Real Estate mapping: ${rawOrg || rawTitle}`);
    }

    // J. Agriculture, Fisheries, Livestock:
    if (/dae|bari|brri|dls|dof|কৃষি সম্প্রসারণ|মৎস্য অধিদপ্তর|প্রাণিসম্পদ অধিদপ্তর|কৃষি গবেষণা/i.test(orgNorm)) {
      const isFish = /fisheries|মৎস্য/i.test(orgNorm);
      const isLive = /livestock|প্রাণিসম্পদ/i.test(orgNorm);
      const subCat = isFish ? 'fisheries' : isLive ? 'livestock' : 'agriculture';
      const sub = JobTaxonomyRegistry.getSubcategoryById('agriculture_fisheries', subCat);
      addScore('agriculture_fisheries', 88, `Agriculture/Fisheries match: ${rawOrg}`, sub);
      addScore('govt_public', 55, `Govt agri directorate: ${rawOrg}`);
      evidence.push(`Agriculture mapping: ${rawOrg}`);
    }

    // K. Science & Statistics:
    if (/bcsir|baec|bbs|বাংলাদেশ পরিসংখ্যান ব্যুরো|পরমাণু শক্তি|বিজ্ঞান ও প্রযুক্তি/i.test(orgNorm)) {
      const isStat = /statistics|bbs|পরিসংখ্যান/i.test(orgNorm);
      const subCat = isStat ? 'statistics' : 'laboratory';
      const sub = JobTaxonomyRegistry.getSubcategoryById('science_statistics', subCat);
      addScore('science_statistics', 88, `Science/Statistics match: ${rawOrg}`, sub);
      addScore('govt_public', 55, `Autonomous science body: ${rawOrg}`);
      evidence.push(`Science mapping: ${rawOrg}`);
    }

    // 4. Keyword Scoring Across all 27 Categories & Subcategories
    for (const cat of UNIVERSAL_JOB_TAXONOMY) {
      if (cat.id === 'other_unclassified') continue;

      let catPoints = 0;
      let matchedNotes: string[] = [];
      let bestSubForCat: SubcategoryDefinition | null = null;

      // Check category keywords in title and fullText
      for (const kw of cat.keywordsEn) {
        if (JobTaxonomyClassifier.matchesToken(titleNorm, kw)) {
          catPoints += 30;
          matchedNotes.push(`Title keyword [EN]: "${kw}"`);
        } else if (JobTaxonomyClassifier.matchesToken(fullText, kw)) {
          catPoints += 12;
          matchedNotes.push(`Body keyword [EN]: "${kw}"`);
        }
      }

      for (const kw of cat.keywordsBn) {
        if (JobTaxonomyClassifier.matchesToken(titleNorm, kw)) {
          catPoints += 35;
          matchedNotes.push(`Title keyword [BN]: "${kw}"`);
        } else if (JobTaxonomyClassifier.matchesToken(fullText, kw)) {
          catPoints += 15;
          matchedNotes.push(`Body keyword [BN]: "${kw}"`);
        }
      }

      // Check subcategories
      let maxSubPoints = 0;
      for (const sub of cat.subcategories) {
        let subPoints = 0;
        for (const skw of sub.keywordsEn) {
          if (JobTaxonomyClassifier.matchesToken(titleNorm, skw)) {
            subPoints += 40;
            matchedNotes.push(`Subcategory title [EN]: "${skw}" -> ${sub.labelEn}`);
          } else if (JobTaxonomyClassifier.matchesToken(fullText, skw)) {
            subPoints += 18;
          }
        }
        for (const skw of sub.keywordsBn) {
          if (JobTaxonomyClassifier.matchesToken(titleNorm, skw)) {
            subPoints += 45;
            matchedNotes.push(`Subcategory title [BN]: "${skw}" -> ${sub.labelBn}`);
          } else if (JobTaxonomyClassifier.matchesToken(fullText, skw)) {
            subPoints += 20;
          }
        }

        if (subPoints > 0) {
          catPoints += subPoints;
          if (subPoints > maxSubPoints) {
            maxSubPoints = subPoints;
            bestSubForCat = sub;
          }
        }
      }

      if (catPoints > 0) {
        addScore(cat.id, catPoints, matchedNotes.join('; '), bestSubForCat, maxSubPoints);
      }
    }

    // 5. Special Multi-Label Cross-Domain Rules
    // e.g. IT Officer at Sonali Bank: title contains IT keywords, org is Bank
    const hasITKeywords = /software|developer|programmer|web|it officer|computer operator|ডাটা এন্ট্রি|আইটি|ডেভেলপার|network engineer/i.test(titleNorm);
    if (hasITKeywords) {
      addScore('it_software', 50, 'Job title is technical IT');
      evidence.push('IT functional role');
    }

    const hasEngineerKeywords = /engineer|engineering|ইঞ্জিনিয়ার|প্রকৌশলী|পুরকৌশল|তড়িৎ/i.test(titleNorm) && !/software engineer/i.test(titleNorm);
    if (hasEngineerKeywords) {
      addScore('engineering_architecture', 45, 'Job title is Engineering');
      evidence.push('Engineering functional role');
    }

    const hasDoctorKeywords = /doctor|medical officer|চিকিৎসক|নার্স|nurse/i.test(titleNorm);
    if (hasDoctorKeywords) {
      addScore('medical_healthcare', 50, 'Job title is Medical/Doctor');
      evidence.push('Healthcare functional role');
    }

    const hasTeacherKeywords = /teacher|lecturer|professor|প্রভাষক|শিক্ষক|অধ্যাপক/i.test(titleNorm);
    if (hasTeacherKeywords) {
      addScore('education_research', 50, 'Job title is Teacher/Lecturer');
      evidence.push('Teaching functional role');
    }

    const hasLawyerKeywords = /lawyer|advocate|legal officer|আইনজীবী|অ্যাডভোকেট/i.test(titleNorm);
    if (hasLawyerKeywords) {
      addScore('legal_compliance', 50, 'Job title is Lawyer/Legal');
      evidence.push('Legal functional role');
    }

    const hasDriverKeywords = /driver|চালক|ড্রাইভার/i.test(titleNorm);
    if (hasDriverKeywords) {
      addScore('transport_logistics', 50, 'Job title is Driver/Transport');
      evidence.push('Driver role');
    }

    const hasElectricianKeywords = /electrician|ইলেকট্রিশিয়ান|প্লাম্বার|plumber|ওয়েল্ডার|welder/i.test(titleNorm);
    if (hasElectricianKeywords) {
      addScore('skilled_trades', 50, 'Job title is Skilled Trade');
      evidence.push('Skilled Trade role');
    }

    // 6. Rank and Aggregate Categories
    const scoredCategories = Array.from(categoryScores.entries())
      .map(([catId, data]) => ({
        catId,
        score: data.score,
        bestSub: data.bestSub,
        notes: data.evidenceNotes,
        def: JobTaxonomyRegistry.getById(catId)!,
      }))
      .filter((item) => item.def && item.score >= 25)
      .sort((a, b) => b.score - a.score);

    // Multi-label category determination
    if (scoredCategories.length > 0) {
      const primary = scoredCategories[0];
      const multiThreshold = Math.max(30, primary.score * 0.45);
      const multiCategories = scoredCategories.filter((c) => c.score >= multiThreshold);

      multiCategories.forEach((c) => matchedCategoryIds.add(c.catId));
      if (!matchedCategoryIds.has(primary.catId)) {
        matchedCategoryIds.add(primary.catId);
      }

      const secondaryIds = Array.from(matchedCategoryIds).filter((id) => id !== primary.catId);
      const confidence = Math.min(98, Math.max(50, primary.score));
      const isMulti = secondaryIds.length > 0;
      const verificationState: ClassificationVerificationState =
        confidence >= 80 ? 'VERIFIED' : confidence >= 50 ? 'HIGH_CONFIDENCE_UNVERIFIED' : 'AMBIGUOUS';

      return {
        taxonomyCategoryId: primary.catId,
        taxonomyCategoryNameEn: primary.def.labelEn,
        taxonomyCategoryNameBn: primary.def.labelBn,
        taxonomyCategoryIds: Array.from(matchedCategoryIds),
        primaryCategoryId: primary.catId,
        secondaryCategoryIds: secondaryIds,
        taxonomySubcategoryId: primary.bestSub ? primary.bestSub.id : null,
        taxonomySubcategoryNameEn: primary.bestSub ? primary.bestSub.labelEn : null,
        taxonomySubcategoryNameBn: primary.bestSub ? primary.bestSub.labelBn : null,
        industry: primary.def.industry,
        employerType: primary.def.defaultEmployerType,
        workMode,
        experienceLevel,
        classificationConfidence: confidence,
        classificationMethod: isMulti ? 'MULTI_LABEL' : (primary.score >= 80 ? 'ORGANIZATION_MAPPING' : 'RULE_BASED'),
        classificationEvidence: [...evidence, ...primary.notes.slice(0, 5)],
        verificationState,
        isUnclassified: false,
      };
    }

    // 7. Fallback: Other / Unclassified (never discard or silently drop)
    const otherCat = JobTaxonomyRegistry.getById('other_unclassified')!;
    return {
      taxonomyCategoryId: otherCat.id,
      taxonomyCategoryNameEn: otherCat.labelEn,
      taxonomyCategoryNameBn: otherCat.labelBn,
      taxonomyCategoryIds: [otherCat.id],
      primaryCategoryId: otherCat.id,
      secondaryCategoryIds: [],
      taxonomySubcategoryId: null,
      taxonomySubcategoryNameEn: null,
      taxonomySubcategoryNameBn: null,
      industry: otherCat.industry,
      employerType: 'Other',
      workMode,
      experienceLevel,
      classificationConfidence: 20,
      classificationMethod: 'UNCLASSIFIED',
      classificationEvidence: ['No confident category rules matched; retained as Unclassified'],
      verificationState: 'UNCLASSIFIED',
      isUnclassified: true,
    };
  }

  /**
   * Applies taxonomy classification to a NormalizedJobCircular in-place.
   */
  public static enrichJobWithTaxonomy(job: NormalizedJobCircular): NormalizedJobCircular {
    const res = this.classify({
      jobTitle: job.jobTitle,
      title: (job as any).title,
      position: job.position,
      organization: job.organization,
      organizationBn: job.organizationBn,
      description: job.description,
      category: job.category,
      sourceId: job.sourceId,
      location: typeof job.location === 'string' ? job.location : '',
      employmentType: typeof job.employmentType === 'string' ? job.employmentType : '',
      experience: job.experience,
      department: (job as any).department,
      industry: job.industry,
    });

    job.taxonomyCategoryId = res.taxonomyCategoryId;
    job.taxonomyCategoryNameEn = res.taxonomyCategoryNameEn;
    job.taxonomyCategoryNameBn = res.taxonomyCategoryNameBn;
    job.taxonomyCategoryIds = res.taxonomyCategoryIds;
    job.primaryCategoryId = res.primaryCategoryId;
    job.secondaryCategoryIds = res.secondaryCategoryIds;
    job.taxonomySubcategoryId = res.taxonomySubcategoryId || undefined;
    job.taxonomySubcategoryNameEn = res.taxonomySubcategoryNameEn || undefined;
    job.taxonomySubcategoryNameBn = res.taxonomySubcategoryNameBn || undefined;
    job.industry = res.industry;
    job.employerType = res.employerType;
    job.workMode = res.workMode;
    job.experienceLevel = res.experienceLevel;
    job.classificationConfidence = res.classificationConfidence;
    job.classificationMethod = res.classificationMethod;
    job.classificationEvidence = res.classificationEvidence;
    job.verificationState = res.verificationState;
    job.isUnclassified = res.isUnclassified;

    return job;
  }

  public static classifyJob = JobTaxonomyClassifier.classify;
}
