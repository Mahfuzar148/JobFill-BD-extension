import { describe, it, expect, vi } from 'vitest';
import {
  UNIVERSAL_JOB_TAXONOMY,
  JobTaxonomyRegistry,
  LEGACY_CATEGORY_ID_MAP,
  MainCategoryDefinition,
} from '../../src/jobs/taxonomy/job-taxonomy';
import {
  JobTaxonomyClassifier,
  TaxonomyClassificationResult,
} from '../../src/jobs/services/taxonomy-classifier';
import {
  filterAndSortJobs,
  DEFAULT_JOB_FILTERS,
} from '../../src/jobs/dashboard/JobFilters';
import {
  FederatedSearchOrchestrator,
  SourceCoverageItem,
} from '../../src/jobs/services/federated-search-orchestrator';
import { NormalizedJobCircular, JobSearchFilters } from '../../src/jobs/types/job.types';

function createMockJob(overrides: Partial<NormalizedJobCircular> = {}): NormalizedJobCircular {
  const base: NormalizedJobCircular = {
    id: `test-circ-${Math.random().toString(36).slice(2, 9)}`,
    sourceId: 'official-adapter',
    sourceName: 'Official Portal',
    sourceType: 'GOVERNMENT',
    jobTitle: 'Assistant Officer',
    position: 'Assistant Officer',
    organization: 'Standard Organization',
    organizationBn: null,
    category: 'Government',
    employmentType: 'Full Time',
    location: 'Dhaka',
    publishedAt: Date.now() - 3600000,
    deadlineAt: Date.now() + 864000000,
    deadlineVerified: true,
    firstDiscoveredAt: Date.now() - 3600000,
    lastUpdatedAt: Date.now() - 3600000,
    status: 'active',
    deadlineTimezone: 'Asia/Dhaka',
    description: 'Detailed job description text.',
    requirements: ['Graduate degree'],
    applicationUrl: 'https://example.gov.bd/apply',
    sourceVerification: 'official_verified',
    sourceLastCheckedAt: Date.now(),
    ...overrides,
  };
  return JobTaxonomyClassifier.enrichJobWithTaxonomy(base);
}

describe('Master Taxonomy Inventory: 27 Standard Primary Categories', () => {
  it('should contain exactly 27 standardized primary categories with stable codes', () => {
    const all = JobTaxonomyRegistry.getAll();
    expect(all.length).toBe(27);

    // Verify all 27 category codes exist in sequence 01 to 27
    const codes = all.map((c) => c.code);
    const expectedCodes = Array.from({ length: 27 }, (_, i) => String(i + 1).padStart(2, '0'));
    expect(codes).toEqual(expectedCodes);

    // Verify each category has stable ID, English name, Bengali name, and icon
    all.forEach((cat) => {
      expect(cat.id).toBeTruthy();
      expect(cat.labelEn).toBeTruthy();
      expect(cat.labelBn).toBeTruthy();
      expect(cat.iconName).toBeTruthy();
      expect(cat.keywordsEn.length).toBeGreaterThan(0);
      expect(cat.keywordsBn.length).toBeGreaterThan(0);
    });
  });

  it('should verify presence of all 27 distinct categories by their canonical IDs', () => {
    const expectedIds = [
      'govt_public',
      'banking_finance',
      'education_research',
      'medical_healthcare',
      'engineering_architecture',
      'it_software',
      'business_management',
      'sales_marketing',
      'ngo_development',
      'agriculture_fisheries',
      'environment_energy',
      'garments_manufacturing',
      'transport_logistics',
      'hospitality_tourism',
      'media_creative',
      'retail_ecommerce',
      'skilled_trades',
      'legal_compliance',
      'defence_security',
      'science_statistics',
      'telecom_communication',
      'real_estate',
      'social_services',
      'automotive_mechanical',
      'aviation_aerospace',
      'other_professional',
      'other_unclassified',
    ];

    expectedIds.forEach((id) => {
      const found = JobTaxonomyRegistry.getById(id);
      expect(found, `Category "${id}" should exist in taxonomy`).toBeDefined();
    });
  });

  it('should resolve legacy aliases backward-compatibly to canonical IDs', () => {
    expect(JobTaxonomyRegistry.resolveCategoryId('gov_public')).toBe('govt_public');
    expect(JobTaxonomyRegistry.resolveCategoryId('bank_finance')).toBe('banking_finance');
    expect(JobTaxonomyRegistry.resolveCategoryId('engineering')).toBe('engineering_architecture');
    expect(JobTaxonomyRegistry.resolveCategoryId('it_digital')).toBe('it_software');
    expect(JobTaxonomyRegistry.resolveCategoryId('business_admin')).toBe('business_management');
    expect(JobTaxonomyRegistry.resolveCategoryId('agri_environment')).toBe('agriculture_fisheries');
    expect(JobTaxonomyRegistry.resolveCategoryId('legal_security')).toBe('legal_compliance');
    expect(JobTaxonomyRegistry.resolveCategoryId('skilled_technical')).toBe('skilled_trades');
    expect(JobTaxonomyRegistry.resolveCategoryId('science_research')).toBe('science_statistics');
  });
});

describe('Deterministic Classification for Representative Professions (English & Bengali)', () => {
  const professionTestCases: Array<{
    name: string;
    input: { jobTitle: string; organization: string; organizationBn?: string; description?: string };
    expectedCatId: string;
    expectedSubId?: string;
  }> = [
    // 01. Government Job
    {
      name: 'Government BCS Cadre Officer',
      input: { jobTitle: '৪৭তম বিসিএস সহকারী কমিশনার প্রশাসন', organization: 'বাংলাদেশ সরকারি কর্ম কমিশন (BPSC)' },
      expectedCatId: 'govt_public',
      expectedSubId: 'bcs_civil',
    },
    // 02. Bank Officer
    {
      name: 'Central Bank Assistant Director',
      input: { jobTitle: 'Assistant Director (General)', organization: 'Bangladesh Bank' },
      expectedCatId: 'banking_finance',
      expectedSubId: 'central_bank',
    },
    // 03. Teacher
    {
      name: 'Primary School Teacher',
      input: { jobTitle: 'সহকারী শিক্ষক নিয়োগ পরীক্ষা', organization: 'প্রাথমিক শিক্ষা অধিদপ্তর (DPE)' },
      expectedCatId: 'education_research',
      expectedSubId: 'primary_teacher',
    },
    // 04. Doctor & Nurse
    {
      name: 'Specialist Medical Officer',
      input: { jobTitle: 'Medical Officer (MBBS)', organization: 'Dhaka Medical College Hospital' },
      expectedCatId: 'medical_healthcare',
      expectedSubId: 'doctor',
    },
    {
      name: 'Senior Staff Nurse',
      input: { jobTitle: 'সিনিয়র স্টাফ নার্স (১০ম গ্রেড)', organization: 'স্বাস্থ্য ও পরিবার কল্যাণ মন্ত্রণালয়' },
      expectedCatId: 'medical_healthcare',
      expectedSubId: 'nurse',
    },
    // 05. Engineer
    {
      name: 'Sub-Assistant Civil Engineer',
      input: { jobTitle: 'উপ-সহকারী প্রকৌশলী (সিভিল)', organization: 'গণপূর্ত অধিদপ্তর (PWD)' },
      expectedCatId: 'engineering_architecture',
      expectedSubId: 'civil',
    },
    // 06. Software Developer & IT Support
    {
      name: 'Software Engineer',
      input: { jobTitle: 'Full Stack Software Engineer (Node.js & React)', organization: 'Tech Innovations Ltd' },
      expectedCatId: 'it_software',
      expectedSubId: 'software',
    },
    {
      name: 'IT Support & Computer Operator',
      input: { jobTitle: 'কম্পিউটার অপারেটর ও ডাটা এন্ট্রি', organization: 'ডিজিটাল আইটি সার্ভিসেস' },
      expectedCatId: 'it_software',
      expectedSubId: 'it_support',
    },
    // 07. Business & Management
    {
      name: 'HR Manager',
      input: { jobTitle: 'Human Resources (HR) Manager', organization: 'Standard Corporate Group' },
      expectedCatId: 'business_management',
      expectedSubId: 'hr',
    },
    // 08. Sales & Marketing
    {
      name: 'Digital Marketing Executive',
      input: { jobTitle: 'Digital Marketing & SEO Specialist', organization: 'Growth Media Agency' },
      expectedCatId: 'sales_marketing',
      expectedSubId: 'digital_marketing',
    },
    // 09. NGO Officer
    {
      name: 'NGO Project Officer',
      input: { jobTitle: 'Project Officer (Humanitarian Relief)', organization: 'BRAC Humanitarian Aid' },
      expectedCatId: 'ngo_development',
      expectedSubId: 'project_officer',
    },
    // 10. Agriculture Officer
    {
      name: 'Agriculture Officer',
      input: { jobTitle: 'উপসহকারী কৃষি কর্মকর্তা', organization: 'কৃষি সম্প্রসারণ অধিদপ্তর (DAE)' },
      expectedCatId: 'agriculture_fisheries',
      expectedSubId: 'agriculture',
    },
    // 11. Environment & Energy
    {
      name: 'Power Plant Engineer',
      input: { jobTitle: 'Assistant Engineer (Electrical)', organization: 'Bangladesh Power Development Board (BPDB)' },
      expectedCatId: 'environment_energy',
      expectedSubId: 'power_electricity',
    },
    // 12. Garments & Manufacturing
    {
      name: 'Garment Merchandiser',
      input: { jobTitle: 'Apparel Merchandiser (Woven & Knit)', organization: 'Apex Textiles RMG' },
      expectedCatId: 'garments_manufacturing',
      expectedSubId: 'merchandising',
    },
    // 13. Transport & Logistics
    {
      name: 'Heavy Vehicle Driver',
      input: { jobTitle: 'পেশাদার ভারী গাড়ি চালক (ড্রাইভার)', organization: 'বাংলাদেশ সড়ক পরিবহন কর্পোরেশন' },
      expectedCatId: 'transport_logistics',
      expectedSubId: 'driving',
    },
    // 14. Hospitality & Tourism
    {
      name: 'Executive Chef',
      input: { jobTitle: 'Executive Chef & Kitchen Supervisor', organization: 'Grand Hotel & Resort' },
      expectedCatId: 'hospitality_tourism',
      expectedSubId: 'chef',
    },
    // 15. Media & Creative
    {
      name: 'Journalist Staff Reporter',
      input: { jobTitle: 'স্টাফ রিপোর্টার ও বার্তা সম্পাদক', organization: 'দৈনিক প্রথম সংবাদ' },
      expectedCatId: 'media_creative',
      expectedSubId: 'journalism',
    },
    // 16. Retail & E-commerce
    {
      name: 'Retail Store Manager',
      input: { jobTitle: 'Retail Outlet Store Manager', organization: 'Shwapno Superstore' },
      expectedCatId: 'retail_ecommerce',
      expectedSubId: 'retail',
    },
    // 17. Skilled Trades
    {
      name: 'Certified Electrician',
      input: { jobTitle: 'ইলেকট্রিশিয়ান ও ওয়্যারিং টেকনিশিয়ান', organization: 'পাওয়ার ভিশন ইঞ্জিনিয়ারিং' },
      expectedCatId: 'skilled_trades',
      expectedSubId: 'electrician',
    },
    // 18. Legal & Compliance
    {
      name: 'Corporate Advocate',
      input: { jobTitle: 'কর্পোরেট আইনজীবী ও লিগ্যাল অফিসার', organization: 'লিগ্যাল পার্টনার্স বাংলাদেশ' },
      expectedCatId: 'legal_compliance',
      expectedSubId: 'lawyer',
    },
    // 19. Defence & Security
    {
      name: 'Police Sub Inspector',
      input: { jobTitle: 'সাব-ইন্সপেক্টর (নিরস্ত্র) নিয়োগ', organization: 'বাংলাদেশ পুলিশ' },
      expectedCatId: 'defence_security',
      expectedSubId: 'police',
    },
    // 20. Science & Statistics
    {
      name: 'BCSIR Scientific Officer',
      input: { jobTitle: 'বৈজ্ঞানিক কর্মকর্তা (রসায়ন)', organization: 'বাংলাদেশ বিজ্ঞান ও শিল্প গবেষণা পরিষদ (BCSIR)' },
      expectedCatId: 'science_statistics',
    },
    // 21. Telecom
    {
      name: 'Telecom BTS Specialist',
      input: { jobTitle: 'BTS & RF Telecom Engineer', organization: 'Grameenphone Ltd' },
      expectedCatId: 'telecom_communication',
      expectedSubId: 'telecom_ops',
    },
    // 22. Real Estate
    {
      name: 'Property Sales Consultant',
      input: { jobTitle: 'ফ্ল্যাট ও রিয়েল এস্টেট বিক্রয় কর্মকর্তা', organization: 'ডেল্টা হাউজিং প্রোপার্টিজ' },
      expectedCatId: 'real_estate',
      expectedSubId: 'real_estate_sales',
    },
    // 23. Social Services
    {
      name: 'Social Service Officer',
      input: { jobTitle: 'উপজেলা সমাজসেবা কর্মকর্তা', organization: 'সমাজসেবা অধিদপ্তর (DSS)' },
      expectedCatId: 'social_services',
      expectedSubId: 'social_welfare',
    },
    // 24. Automotive Services
    {
      name: 'Auto Electrical Technician',
      input: { jobTitle: 'অটোমোবাইল মেকানিক ও গ্যারেজ মিস্ত্রি', organization: 'মডার্ন মোটর ওয়ার্কশপ' },
      expectedCatId: 'automotive_mechanical',
      expectedSubId: 'vehicle_maintenance',
    },
    // 25. Aviation
    {
      name: 'Flight Pilot / Cabin Crew',
      input: { jobTitle: 'First Officer Commercial Pilot', organization: 'Biman Bangladesh Airlines' },
      expectedCatId: 'aviation_aerospace',
      expectedSubId: 'pilot_flight',
    },
    // 26. Other Professional Services
    {
      name: 'Independent Consultant',
      input: { jobTitle: 'Senior Technical Advisor & Consultant', organization: 'Global Strategy Advisory' },
      expectedCatId: 'other_professional',
      expectedSubId: 'consultant',
    },
    // 27. Other / Unclassified
    {
      name: 'Unclassified Job with Novel Title',
      input: { jobTitle: 'Unknown Enigma Operator', organization: 'Generic Novel Enterprise Inc', description: 'Confidential duties.' },
      expectedCatId: 'other_unclassified',
    },
  ];

  professionTestCases.forEach((tc) => {
    it(`should correctly classify ${tc.name} into category "${tc.expectedCatId}"`, () => {
      const res = JobTaxonomyClassifier.classify(tc.input);
      expect(res.taxonomyCategoryId).toBe(tc.expectedCatId);
      if (tc.expectedSubId) {
        expect(res.taxonomySubcategoryId).toBe(tc.expectedSubId);
      }
      expect(res.classificationConfidence).toBeGreaterThan(0);
      if (tc.expectedCatId === 'other_unclassified') {
        expect(res.isUnclassified).toBe(true);
      } else {
        expect(res.isUnclassified).toBe(false);
      }
    });
  });
});

describe('Multi-Label Classification & Cross-Category Association', () => {
  it('should assign multiple relevant categories to a Software Engineer at a Government Bank', () => {
    const res = JobTaxonomyClassifier.classify({
      jobTitle: 'Senior Software Engineer (৯ম গ্রেড)',
      position: 'Software Engineer',
      organization: 'Sonali Bank PLC (Government Commercial Bank)',
      description: 'Developing core banking backend systems for government payments.',
    });

    // Primary should be IT or Banking
    expect(['it_software', 'banking_finance']).toContain(res.primaryCategoryId);

    // Multi-label categoryIds should include IT, Banking, and Government
    expect(res.taxonomyCategoryIds).toContain('it_software');
    expect(res.taxonomyCategoryIds).toContain('banking_finance');
    expect(res.classificationMethod).toBe('MULTI_LABEL');
    expect(res.secondaryCategoryIds.length).toBeGreaterThan(0);
  });

  it('should appear in IT, Banking, and Government views, but appear ONCE in All Categories (no duplication)', () => {
    const multiJob = createMockJob({
      id: 'job-multi-sonali-dev',
      jobTitle: 'Senior Software Engineer (৯ম গ্রেড)',
      organization: 'Sonali Bank PLC',
      category: 'Bank',
    });

    // Verify it was classified with multi-label
    expect(multiJob.taxonomyCategoryIds).toContain('it_software');
    expect(multiJob.taxonomyCategoryIds).toContain('banking_finance');

    const jobCollection = [
      multiJob,
      createMockJob({ id: 'job-pure-govt', jobTitle: 'Magistrate', organization: 'Judiciary' }),
      createMockJob({ id: 'job-pure-bank', jobTitle: 'Cashier', organization: 'City Bank' }),
    ];

    // Filter by IT
    const itResults = filterAndSortJobs(jobCollection, {
      ...DEFAULT_JOB_FILTERS,
      taxonomyCategory: 'it_software',
    }, new Set());
    expect(itResults.map((j) => j.id)).toContain('job-multi-sonali-dev');

    // Filter by Banking
    const bankResults = filterAndSortJobs(jobCollection, {
      ...DEFAULT_JOB_FILTERS,
      taxonomyCategory: 'banking_finance',
    }, new Set());
    expect(bankResults.map((j) => j.id)).toContain('job-multi-sonali-dev');

    // Filter by All Categories: exact deduplication
    const allResults = filterAndSortJobs(jobCollection, {
      ...DEFAULT_JOB_FILTERS,
      taxonomyCategory: 'All',
    }, new Set());
    const multiOccurrences = allResults.filter((j) => j.id === 'job-multi-sonali-dev');
    expect(multiOccurrences.length).toBe(1);
    expect(allResults.length).toBe(3);
  });
});

describe('Source-Category Capability Mapping & Federated Search', () => {
  it('should accurately report capability support for specialized sources', () => {
    // BPSC supports Government
    expect(FederatedSearchOrchestrator.isSourceSupportingCategory('bpsc', 'govt_public')).toBe(true);
    // DPE only supports Education, not Aviation
    expect(FederatedSearchOrchestrator.isSourceSupportingCategory('dpe', 'aviation_aerospace')).toBe(false);
    // BDJobs is universal (supports all)
    expect(FederatedSearchOrchestrator.isSourceSupportingCategory('bdjobs', 'aviation_aerospace')).toBe(true);
    expect(FederatedSearchOrchestrator.isSourceSupportingCategory('bdjobs', 'skilled_trades')).toBe(true);
  });

  it('should record NOT_SUPPORTED instead of fake failure when searching a category not covered by a source', async () => {
    const report = await FederatedSearchOrchestrator.executeFederatedSearch({
      filters: {
        ...DEFAULT_JOB_FILTERS,
        taxonomyCategory: 'aviation_aerospace',
      },
    });

    expect(report.configuredSourcesCount).toBeGreaterThan(5);

    // Sources like DPE and NTRCA should be marked NOT_SUPPORTED
    const dpeOutcome = report.sourceOutcomes.find((s) => s.sourceId === 'dpe');
    if (dpeOutcome) {
      expect(dpeOutcome.status).toBe('NOT_SUPPORTED');
      expect(dpeOutcome.coverageState).toBe('NOT_SUPPORTED');
      expect(dpeOutcome.reason).toContain('does not index');
    }

    // notSupportedSourcesCount should be properly tallied without being counted in failedSourcesCount
    expect(report.notSupportedSourcesCount).toBeGreaterThan(0);
  });
});

describe('Category Proposal & Zero-Count Visibility', () => {
  it('should allow proposing a new category and prevent duplicates against existing taxonomy', () => {
    // Proposing an existing category should be safely rejected with explanatory reason
    const duplicateRes = JobTaxonomyRegistry.proposeCategory({
      proposedTitleEn: 'IT & Software',
      proposedTitleBn: 'তথ্যপ্রযুক্তি ও সফটওয়্যার',
      justification: 'Duplicate test',
    });
    expect(duplicateRes.success).toBe(false);
    expect(duplicateRes.reason).toContain('equivalent category already exists');

    // Proposing a novel category should succeed
    const newRes = JobTaxonomyRegistry.proposeCategory({
      proposedTitleEn: 'Biomedical Nanotechnology',
      proposedTitleBn: 'বায়োমেডিকেল ন্যানোটেকনোলজি',
      parentCategoryId: 'medical_healthcare',
      justification: 'Emerging discipline in advanced medical devices',
    });
    expect(newRes.success).toBe(true);
    expect(newRes.categoryId).toBeTruthy();

    const proposals = JobTaxonomyRegistry.getProposedCategories();
    expect(proposals.some((p) => p.proposedTitleEn === 'Biomedical Nanotechnology')).toBe(true);
  });

  it('should search categories by Bengali and English terms', () => {
    const searchEng = JobTaxonomyRegistry.searchCategories('Software', 'en');
    expect(searchEng.some((c) => c.id === 'it_software')).toBe(true);

    const searchBn = JobTaxonomyRegistry.searchCategories('স্বাস্থ্য', 'bn');
    expect(searchBn.some((c) => c.id === 'medical_healthcare')).toBe(true);
  });
});
