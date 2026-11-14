// JobFill BD - Deterministic & Rules-Based Job Taxonomy Classifier
// Classifies circulars into the 20 Universal Categories (A-T), subcategories,
// employer type, work mode, and experience level using Bengali and English stem matching.
// Never hallucinates; assigns 'other_unclassified' with isUnclassified: true if confidence is low.

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

export interface TaxonomyClassificationResult {
  taxonomyCategoryId: string;
  taxonomyCategoryNameEn: string;
  taxonomyCategoryNameBn: string;
  taxonomySubcategoryId: string | null;
  taxonomySubcategoryNameEn: string | null;
  taxonomySubcategoryNameBn: string | null;
  industry: string;
  employerType: EmployerType;
  workMode: WorkMode;
  experienceLevel: ExperienceLevel;
  classificationConfidence: number; // 0 to 100
  classificationMethod: 'RULE_BASED' | 'ORGANIZATION_MAPPING' | 'SOURCE_DEFAULT' | 'UNCLASSIFIED';
  isUnclassified: boolean;
}

export class JobTaxonomyClassifier {
  /**
   * Classifies a job by its metadata.
   */
  public static classify(job: {
    jobTitle?: string;
    title?: string;
    position?: string;
    organization?: string;
    description?: string;
    category?: string;
    sourceId?: string;
    location?: string;
    employmentType?: string;
    experience?: string;
  }): TaxonomyClassificationResult {
    const title = (job.jobTitle || job.title || job.position || '').trim();
    const position = (job.position || title).trim();
    const org = (job.organization || '').trim();
    const desc = (job.description || '').slice(0, 1000).trim();
    const catHint = (job.category || '').toLowerCase();
    const sourceId = (job.sourceId || '').toLowerCase();
    const loc = (job.location || '').toLowerCase();
    const exp = (job.experience || '').toLowerCase();

    const fullText = `${title} ${position} ${org} ${desc}`.toLowerCase();

    // 1. Work Mode Detection
    let workMode: WorkMode = 'On-Site';
    if (/\bremote\b|work from home|wfh|রিমোট/i.test(fullText) || loc.includes('remote') || sourceId.includes('remote')) {
      workMode = 'Remote';
    } else if (/\bhybrid\b|হাইব্রিড/i.test(fullText)) {
      workMode = 'Hybrid';
    } else if (/\bfield\b|মাঠ\s*পর্যায়ে|community based/i.test(fullText)) {
      workMode = 'Field-Based';
    }

    // 2. Experience Level Detection
    let experienceLevel: ExperienceLevel = 'Entry-Level';
    if (/no experience|fresh graduate|নতুনদের|অভিজ্ঞতার\s*প্রয়োজন\s*নেই|entry level/i.test(fullText) || exp.includes('no experience')) {
      experienceLevel = 'Fresh Graduate';
    } else if (/(\b[1-3]\b|\b১-৩\b)\s*(years?|বৎস?র)/i.test(fullText) || exp.includes('1') || exp.includes('2')) {
      experienceLevel = '1–3 Years';
    } else if (/(\b[3-5]\b|\b৩-৫\b)\s*(years?|বৎস?র)/i.test(fullText) || exp.includes('3') || exp.includes('4')) {
      experienceLevel = '3–5 Years';
    } else if (/(\b[5-9]\b|1[0-9]|\b৫\b|\b[৬-৯]\b)\s*(years?|বৎস?র|\+|প্লাস)/i.test(fullText) || /senior|managerial|প্রধান|নির্বাহী|পরিচালক/i.test(title)) {
      experienceLevel = /manager|head|director|পরিচালক|ব্যবস্থাপক/i.test(title) ? 'Managerial' : '5+ Years';
    }

    // 3. Organization Mapping (High Confidence Rules)
    // Government Ministries, BPSC & Public Commissions:
    if (/bpsc|public service commission|কর্ম কমিশন|ministry|মন্ত্রণালয়|secretariat|সচিবালয়|directorate|অধিদপ্তর|board|পরিদপ্তর|বিসিএস|bcs/i.test(org) || /bcs|বিসিএস|ক্যাডার/i.test(title)) {
      const isBCS = /bcs|বিসিএস|ক্যাডার/i.test(title) || /bpsc|কর্ম কমিশন/i.test(org);
      const isMinistry = /ministry|মন্ত্রণালয়|সচিবালয়/i.test(org);
      const subCat = isBCS ? 'bcs_civil' : isMinistry ? 'ministry' : 'directorate';
      const main = JobTaxonomyRegistry.getById('gov_public')!;
      const sub = JobTaxonomyRegistry.getSubcategoryById('gov_public', subCat);
      return {
        taxonomyCategoryId: main.id,
        taxonomyCategoryNameEn: main.labelEn,
        taxonomyCategoryNameBn: main.labelBn,
        taxonomySubcategoryId: sub?.id || null,
        taxonomySubcategoryNameEn: sub?.labelEn || null,
        taxonomySubcategoryNameBn: sub?.labelBn || null,
        industry: main.industry,
        employerType: 'Government',
        workMode,
        experienceLevel,
        classificationConfidence: 96,
        classificationMethod: 'ORGANIZATION_MAPPING',
        isUnclassified: false,
      };
    }

    // Banking:
    if (/bangladesh bank|sonali bank|janata bank|agrani bank|rupali bank|brac bank|city bank|ebl|eastern bank|bankers selection/i.test(org)) {
      const isCentral = /bangladesh bank|বাংলাদেশ ব্যাংক/i.test(org);
      const isGovtBank = /sonali|janata|agrani|rupali|krishi|বাংলাদেশ কৃষি ব্যাংক/i.test(org);
      const subCat = isCentral ? 'central_bank' : isGovtBank ? 'govt_banks' : 'private_banks';
      const main = JobTaxonomyRegistry.getById('bank_finance')!;
      const sub = JobTaxonomyRegistry.getSubcategoryById('bank_finance', subCat);
      return {
        taxonomyCategoryId: main.id,
        taxonomyCategoryNameEn: main.labelEn,
        taxonomyCategoryNameBn: main.labelBn,
        taxonomySubcategoryId: sub?.id || null,
        taxonomySubcategoryNameEn: sub?.labelEn || null,
        taxonomySubcategoryNameBn: sub?.labelBn || null,
        industry: main.industry,
        employerType: 'Bank',
        workMode,
        experienceLevel,
        classificationConfidence: 95,
        classificationMethod: 'ORGANIZATION_MAPPING',
        isUnclassified: false,
      };
    }

    // Hospitals & Healthcare:
    if (/hospital|clinic|dghs|স্বাস্থ্য অধিদপ্তর|স্বাস্থ্য|pharmaceutical|square pharma|beximco pharma|incepta|medical college|dental college|nursing/i.test(org)) {
      const isNurse = /nurse|নার্স|সেবিকা/i.test(title);
      const isDoctor = /doctor|medical officer|চিকিৎসক/i.test(title);
      const isPharma = /pharma|medical representative|mpo/i.test(title);
      const subCat = isNurse ? 'nurse_midwife' : isDoctor ? 'doctor_specialist' : isPharma ? 'pharma_representative' : 'hospital_admin';
      const main = JobTaxonomyRegistry.getById('medical_healthcare')!;
      const sub = JobTaxonomyRegistry.getSubcategoryById('medical_healthcare', subCat);
      return {
        taxonomyCategoryId: main.id,
        taxonomyCategoryNameEn: main.labelEn,
        taxonomyCategoryNameBn: main.labelBn,
        taxonomySubcategoryId: sub?.id || null,
        taxonomySubcategoryNameEn: sub?.labelEn || null,
        taxonomySubcategoryNameBn: sub?.labelBn || null,
        industry: main.industry,
        employerType: /square|beximco|incepta|renata/i.test(org) ? 'Private' : 'Government',
        workMode,
        experienceLevel,
        classificationConfidence: 92,
        classificationMethod: 'ORGANIZATION_MAPPING',
        isUnclassified: false,
      };
    }

    // Education Institutions & Statutory Bodies:
    if (!/medical college|dental college|nursing college|veterinary college/i.test(org) && /ntrca|dpe|dshe|university|বিশ্ববিদ্যালয়|college|কলেজ|school|মাদ্রাসা|primary education/i.test(org)) {
      const isPrimary = /primary|dpe|প্রাথমিক/i.test(org) || /primary|সহকারী শিক্ষক/i.test(title);
      const isUni = /university|বিশ্ববিদ্যালয়/i.test(org);
      const subCat = isPrimary ? 'primary_teaching' : isUni ? 'university_faculty' : 'school_teaching';
      const main = JobTaxonomyRegistry.getById('education_research')!;
      const sub = JobTaxonomyRegistry.getSubcategoryById('education_research', subCat);
      return {
        taxonomyCategoryId: main.id,
        taxonomyCategoryNameEn: main.labelEn,
        taxonomyCategoryNameBn: main.labelBn,
        taxonomySubcategoryId: sub?.id || null,
        taxonomySubcategoryNameEn: sub?.labelEn || null,
        taxonomySubcategoryNameBn: sub?.labelBn || null,
        industry: main.industry,
        employerType: 'Autonomous',
        workMode,
        experienceLevel,
        classificationConfidence: 92,
        classificationMethod: 'ORGANIZATION_MAPPING',
        isUnclassified: false,
      };
    }

    // NGOs & International Development:
    if (/brac|icddr|undp|unicef|unhcr|care bangladesh|oxfam|save the children|usaid|world vision|actionaid/i.test(org) || sourceId.includes('reliefweb')) {
      const main = JobTaxonomyRegistry.getById('ngo_development')!;
      const isME = /monitoring|evaluation|m&e/i.test(title);
      const subCat = isME ? 'm_and_e' : 'project_officer_ngo';
      const sub = JobTaxonomyRegistry.getSubcategoryById('ngo_development', subCat);
      return {
        taxonomyCategoryId: main.id,
        taxonomyCategoryNameEn: main.labelEn,
        taxonomyCategoryNameBn: main.labelBn,
        taxonomySubcategoryId: sub?.id || null,
        taxonomySubcategoryNameEn: sub?.labelEn || null,
        taxonomySubcategoryNameBn: sub?.labelBn || null,
        industry: main.industry,
        employerType: 'NGO',
        workMode,
        experienceLevel,
        classificationConfidence: 94,
        classificationMethod: 'ORGANIZATION_MAPPING',
        isUnclassified: false,
      };
    }

    // 4. Keyword Scoring Across Universal Taxonomy (Title + Position + Description)
    let bestMain: MainCategoryDefinition | null = null;
    let bestSub: SubcategoryDefinition | null = null;
    let highestScore = 0;

    for (const main of UNIVERSAL_JOB_TAXONOMY) {
      if (main.id === 'other_unclassified') continue;
      let score = 0;

      // Match Main Category Keywords
      for (const kw of main.keywordsEn) {
        if (fullText.includes(kw.toLowerCase())) {
          score += 15;
          if (title.toLowerCase().includes(kw.toLowerCase())) score += 25; // Title weight
        }
      }
      for (const kw of main.keywordsBn) {
        if (fullText.includes(kw)) {
          score += 18;
          if (title.includes(kw)) score += 30;
        }
      }

      // Match Subcategories
      for (const sub of main.subcategories) {
        let subScore = 0;
        for (const skw of sub.keywordsEn) {
          if (fullText.includes(skw.toLowerCase())) {
            subScore += 20;
            if (title.toLowerCase().includes(skw.toLowerCase())) subScore += 35;
          }
        }
        for (const skw of sub.keywordsBn) {
          if (fullText.includes(skw)) {
            subScore += 22;
            if (title.includes(skw)) subScore += 40;
          }
        }

        if (subScore > 0 && subScore + score > highestScore) {
          highestScore = subScore + score;
          bestMain = main;
          bestSub = sub;
        }
      }

      if (score > highestScore && !bestSub) {
        highestScore = score;
        bestMain = main;
      }
    }

    // If source or category hint exists and aligns
    if (!bestMain && catHint) {
      if (catHint.includes('govt') || catHint.includes('government')) {
        bestMain = JobTaxonomyRegistry.getById('gov_public') || null;
      } else if (catHint.includes('bank')) {
        bestMain = JobTaxonomyRegistry.getById('bank_finance') || null;
      } else if (catHint.includes('teach') || catHint.includes('education')) {
        bestMain = JobTaxonomyRegistry.getById('education_research') || null;
      } else if (catHint.includes('it') || catHint.includes('technology') || catHint.includes('software')) {
        bestMain = JobTaxonomyRegistry.getById('it_digital') || null;
      } else if (catHint.includes('health') || catHint.includes('medical')) {
        bestMain = JobTaxonomyRegistry.getById('medical_healthcare') || null;
      } else if (catHint.includes('ngo')) {
        bestMain = JobTaxonomyRegistry.getById('ngo_development') || null;
      }
      if (bestMain) highestScore = 50;
    }

    if (bestMain && highestScore >= 25) {
      const confidence = Math.min(95, Math.max(50, highestScore));
      const sub = bestSub as SubcategoryDefinition | null;
      return {
        taxonomyCategoryId: bestMain.id,
        taxonomyCategoryNameEn: bestMain.labelEn,
        taxonomyCategoryNameBn: bestMain.labelBn,
        taxonomySubcategoryId: sub ? sub.id : null,
        taxonomySubcategoryNameEn: sub ? sub.labelEn : null,
        taxonomySubcategoryNameBn: sub ? sub.labelBn : null,
        industry: bestMain.industry,
        employerType: bestMain.defaultEmployerType,
        workMode,
        experienceLevel,
        classificationConfidence: confidence,
        classificationMethod: 'RULE_BASED',
        isUnclassified: false,
      };
    }

    // 5. Default Fallback: Other / Unclassified (never misclassify or discard)
    const otherCat = JobTaxonomyRegistry.getById('other_unclassified')!;
    return {
      taxonomyCategoryId: otherCat.id,
      taxonomyCategoryNameEn: otherCat.labelEn,
      taxonomyCategoryNameBn: otherCat.labelBn,
      taxonomySubcategoryId: null,
      taxonomySubcategoryNameEn: null,
      taxonomySubcategoryNameBn: null,
      industry: otherCat.industry,
      employerType: 'Other',
      workMode,
      experienceLevel,
      classificationConfidence: 20,
      classificationMethod: 'UNCLASSIFIED',
      isUnclassified: true,
    };
  }

  /**
   * Applies taxonomy classification to a NormalizedJobCircular in-place.
   */
  public static enrichJobWithTaxonomy(job: NormalizedJobCircular): NormalizedJobCircular {
    const res = this.classify({
      jobTitle: job.jobTitle,
      position: job.position,
      organization: job.organization,
      description: job.description,
      category: job.category,
      sourceId: job.sourceId,
      location: typeof job.location === 'string' ? job.location : '',
      employmentType: typeof job.employmentType === 'string' ? job.employmentType : '',
      experience: job.experience,
    });

    job.taxonomyCategoryId = res.taxonomyCategoryId;
    job.taxonomyCategoryNameEn = res.taxonomyCategoryNameEn;
    job.taxonomyCategoryNameBn = res.taxonomyCategoryNameBn;
    job.taxonomySubcategoryId = res.taxonomySubcategoryId || undefined;
    job.taxonomySubcategoryNameEn = res.taxonomySubcategoryNameEn || undefined;
    job.taxonomySubcategoryNameBn = res.taxonomySubcategoryNameBn || undefined;
    job.industry = res.industry;
    job.employerType = res.employerType;
    job.workMode = res.workMode;
    job.experienceLevel = res.experienceLevel;
    job.classificationConfidence = res.classificationConfidence;
    job.classificationMethod = res.classificationMethod;
    job.isUnclassified = res.isUnclassified;

    return job;
  }

  public static classifyJob = JobTaxonomyClassifier.classify;
}
