// JobFill BD - Centralized Bangladesh Government Recruitment Source Registry
// Pre-seeded with official aggregators, ministries, commissions, directorates, defence, banks, universities & local offices.
// Supports status tracking, group categorization, independent health monitoring, and dynamic source discovery.

import {
  GovernmentSourceRecord,
  GovernmentSourceGroup,
  GovernmentSourceStatus,
} from '../../types/government.types';

export const SEED_GOVERNMENT_SOURCES: GovernmentSourceRecord[] = [
  // =========================================================================
  // A. CENTRAL AGGREGATORS
  // =========================================================================
  {
    sourceId: 'natportal_jobs',
    sourceName: 'National Portal Jobs',
    sourceNameBn: 'জাতীয় তথ্য বাতায়ন (চাকরি ঘোষণা)',
    organizationName: 'Bangladesh National Government Portal',
    organizationNameBn: 'বাংলাদেশ জাতীয় তথ্য বাতায়ন',
    organizationType: 'Commission',
    sourceGroup: 'central_aggregators',
    officialDomain: 'bangladesh.gov.bd',
    recruitmentPageUrl: 'https://bangladesh.gov.bd/pages/job-tender-announcements',
    noticePageUrl: 'https://bangladesh.gov.bd/views/mixed/',
    applicationPortalUrl: 'https://bangladesh.gov.bd',
    sourceAccessMethod: 'HTML_RECRUITMENT_TABLE',
    paginationMethod: 'PAGE_NUMBER',
    maxPagesToScan: 5,
    supportedCategories: ['All', 'govt_public'],
    termsReviewStatus: 'REVIEWED_PUBLIC',
    sourceHealth: 'ACTIVE',
    enabled: true,
    verificationStatus: 'ACTIVE',
    notes: 'Central government recruitment announcements filtered to exclude tenders.',
    notesBn: 'কেন্দ্রীয় সরকারি চাকরি ও নিয়োগ বিজ্ঞপ্তি (দরপত্র ব্যতিরেকে)।',
  },
  {
    sourceId: 'teletalk_alljobs_govt',
    sourceName: 'Alljobs Teletalk Government',
    sourceNameBn: 'অলজবস টেলিটক সরকারি চাকরি',
    organizationName: 'Teletalk Bangladesh Limited',
    organizationNameBn: 'টেলিটক বাংলাদেশ লিমিটেড',
    organizationType: 'Public Corporation',
    sourceGroup: 'central_aggregators',
    officialDomain: 'alljobs.teletalk.com.bd',
    recruitmentPageUrl: 'https://alljobs.teletalk.com.bd/jobs/government',
    noticePageUrl: 'https://alljobs.teletalk.com.bd/jobs/government',
    applicationPortalUrl: 'http://alljobs.teletalk.com.bd',
    sourceAccessMethod: 'API',
    paginationMethod: 'PAGE_NUMBER',
    maxPagesToScan: 10,
    supportedCategories: ['All', 'govt_public', 'banking_finance', 'education_research'],
    termsReviewStatus: 'REVIEWED_PUBLIC',
    sourceHealth: 'ACTIVE',
    enabled: true,
    verificationStatus: 'ACTIVE',
    notes: 'Centralized Teletalk portal for active government ministries & departments.',
    notesBn: 'টেলিটকের কেন্দ্রীয় সরকারি চাকরির আবেদন ও পরীক্ষার নোটিশ পোর্টাল।',
  },

  // =========================================================================
  // B. PUBLIC SERVICE COMMISSION (BPSC)
  // =========================================================================
  {
    sourceId: 'bpsc_main',
    sourceName: 'BPSC Notifications & Notices',
    sourceNameBn: 'বাংলাদেশ সরকারি কর্ম কমিশন (বিপিএসসি)',
    organizationName: 'Bangladesh Public Service Commission',
    organizationNameBn: 'বাংলাদেশ সরকারি কর্ম কমিশন',
    organizationType: 'Constitutional Institution',
    sourceGroup: 'public_service_commissions',
    officialDomain: 'bpsc.gov.bd',
    recruitmentPageUrl: 'https://bpsc.gov.bd/pages/notification-circulars',
    noticePageUrl: 'https://bpsc.gov.bd/pages/notices/',
    applicationPortalUrl: 'http://bpsc.teletalk.com.bd',
    sourceAccessMethod: 'HTML_NOTICE_BOARD',
    paginationMethod: 'PAGE_NUMBER',
    maxPagesToScan: 5,
    supportedCategories: ['govt_public', 'bcs_civil', 'education_research', 'medical_healthcare'],
    termsReviewStatus: 'REVIEWED_PUBLIC',
    sourceHealth: 'ACTIVE',
    enabled: true,
    verificationStatus: 'ACTIVE',
    notes: 'BCS Cadre & Non-Cadre official notifications, results & exam schedules.',
    notesBn: 'বিসিএস ক্যাডার ও নন-ক্যাডার সরকারি নিয়োগ বিজ্ঞপ্তি, পরীক্ষার সময়সূচি ও ফলাফল।',
  },
  {
    sourceId: 'bpsc_non_cadre',
    sourceName: 'BPSC Non-Cadre Ongoing',
    sourceNameBn: 'বিপিএসসি নন-ক্যাডার চলমান বিজ্ঞপ্তি',
    organizationName: 'Bangladesh Public Service Commission',
    organizationNameBn: 'বাংলাদেশ সরকারি কর্ম কমিশন',
    organizationType: 'Constitutional Institution',
    sourceGroup: 'public_service_commissions',
    officialDomain: 'bpsc.gov.bd',
    recruitmentPageUrl: 'https://bpsc.gov.bd/pages/static-pages/6ad5e44f3c97e6c4ab675017',
    noticePageUrl: 'https://bpsc.gov.bd/pages/notices/',
    applicationPortalUrl: 'http://bpsc.teletalk.com.bd',
    sourceAccessMethod: 'HTML_NOTICE_BOARD',
    paginationMethod: 'NONE',
    supportedCategories: ['govt_public', 'engineering_architecture', 'medical_healthcare'],
    termsReviewStatus: 'REVIEWED_PUBLIC',
    sourceHealth: 'ACTIVE',
    enabled: true,
    verificationStatus: 'ACTIVE',
    notes: 'BPSC 9th through 12th grade non-cadre special and ongoing recruitment notices.',
    notesBn: 'বিপিএসসি ৯ম-১২তম গ্রেড নন-ক্যাডার সরাসরি নিয়োগ বিজ্ঞপ্তি।',
  },

  // =========================================================================
  // C. MINISTRIES & DIVISIONS
  // =========================================================================
  {
    sourceId: 'mopa_govt',
    sourceName: 'Ministry of Public Administration (MOPA)',
    sourceNameBn: 'জনপ্রশাসন মন্ত্রণালয়',
    organizationName: 'Ministry of Public Administration',
    organizationNameBn: 'জনপ্রশাসন মন্ত্রণালয়',
    organizationType: 'Ministry',
    sourceGroup: 'ministries_divisions',
    officialDomain: 'mopa.gov.bd',
    recruitmentPageUrl: 'https://mopa.gov.bd/pages/notices',
    noticePageUrl: 'https://mopa.gov.bd/pages/notices',
    applicationPortalUrl: 'http://mopa.teletalk.com.bd',
    sourceAccessMethod: 'HTML_NOTICE_BOARD',
    paginationMethod: 'PAGE_NUMBER',
    maxPagesToScan: 3,
    supportedCategories: ['govt_public', 'legal_compliance'],
    termsReviewStatus: 'REVIEWED_PUBLIC',
    sourceHealth: 'ACTIVE',
    enabled: true,
    verificationStatus: 'ACTIVE',
    notes: 'Civil service administration orders and direct ministry recruitments.',
    notesBn: 'জনপ্রশাসন মন্ত্রণালয়ের নিয়োগ বিজ্ঞপ্তি ও আদেশ।',
  },
  {
    sourceId: 'mof_finance',
    sourceName: 'Finance Division (MOF)',
    sourceNameBn: 'অর্থ বিভাগ, অর্থ মন্ত্রণালয়',
    organizationName: 'Finance Division, Ministry of Finance',
    organizationNameBn: 'অর্থ বিভাগ, অর্থ মন্ত্রণালয়',
    organizationType: 'Division',
    sourceGroup: 'ministries_divisions',
    parentMinistry: 'Ministry of Finance',
    parentMinistryBn: 'অর্থ মন্ত্রণালয়',
    officialDomain: 'mof.gov.bd',
    recruitmentPageUrl: 'https://mof.gov.bd/pages/notices',
    noticePageUrl: 'https://mof.gov.bd/pages/notices',
    sourceAccessMethod: 'HTML_NOTICE_BOARD',
    paginationMethod: 'PAGE_NUMBER',
    supportedCategories: ['banking_finance', 'govt_public'],
    termsReviewStatus: 'REVIEWED_PUBLIC',
    sourceHealth: 'ACTIVE',
    enabled: true,
    verificationStatus: 'ACTIVE',
  },
  {
    sourceId: 'mod_defence_ministry',
    sourceName: 'Ministry of Defence (MOD)',
    sourceNameBn: 'প্রতিরক্ষা মন্ত্রণালয়',
    organizationName: 'Ministry of Defence',
    organizationNameBn: 'প্রতিরক্ষা মন্ত্রণালয়',
    organizationType: 'Ministry',
    sourceGroup: 'ministries_divisions',
    officialDomain: 'mod.gov.bd',
    recruitmentPageUrl: 'https://mod.gov.bd/pages/notices/',
    noticePageUrl: 'https://mod.gov.bd/pages/notices/',
    applicationPortalUrl: 'http://mod.teletalk.com.bd',
    sourceAccessMethod: 'HTML_NOTICE_BOARD',
    paginationMethod: 'PAGE_NUMBER',
    supportedCategories: ['defence_security', 'govt_public'],
    termsReviewStatus: 'REVIEWED_PUBLIC',
    sourceHealth: 'ACTIVE',
    enabled: true,
    verificationStatus: 'ACTIVE',
    notes: 'Ministry of Defence civilian and staff circulars.',
  },
  {
    sourceId: 'minland_govt',
    sourceName: 'Ministry of Land',
    sourceNameBn: 'ভূমি মন্ত্রণালয়',
    organizationName: 'Ministry of Land',
    organizationNameBn: 'ভূমি মন্ত্রণালয়',
    organizationType: 'Ministry',
    sourceGroup: 'ministries_divisions',
    officialDomain: 'minland.gov.bd',
    recruitmentPageUrl: 'https://minland.gov.bd/pages/notices',
    noticePageUrl: 'https://minland.gov.bd/pages/notices',
    applicationPortalUrl: 'http://minland.teletalk.com.bd',
    sourceAccessMethod: 'HTML_NOTICE_BOARD',
    paginationMethod: 'PAGE_NUMBER',
    supportedCategories: ['govt_public', 'survey_mapping'],
    termsReviewStatus: 'REVIEWED_PUBLIC',
    sourceHealth: 'ACTIVE',
    enabled: true,
    verificationStatus: 'ACTIVE',
  },

  // =========================================================================
  // D. DIRECTORATES & DEPARTMENTS
  // =========================================================================
  {
    sourceId: 'dpe_primary',
    sourceName: 'Directorate of Primary Education (DPE)',
    sourceNameBn: 'প্রাথমিক শিক্ষা অধিদপ্তর',
    organizationName: 'Directorate of Primary Education',
    organizationNameBn: 'প্রাথমিক শিক্ষা অধিদপ্তর',
    organizationType: 'Directorate',
    sourceGroup: 'directorates_departments',
    parentMinistry: 'Ministry of Primary and Mass Education',
    officialDomain: 'dpe.gov.bd',
    recruitmentPageUrl: 'https://dpe.gov.bd/pages/notices/',
    noticePageUrl: 'https://dpe.gov.bd/pages/notices/',
    applicationPortalUrl: 'http://dpe.teletalk.com.bd',
    sourceAccessMethod: 'HTML_NOTICE_BOARD',
    paginationMethod: 'PAGE_NUMBER',
    maxPagesToScan: 5,
    supportedCategories: ['education_research', 'primary_teacher', 'govt_public'],
    termsReviewStatus: 'REVIEWED_PUBLIC',
    sourceHealth: 'ACTIVE',
    enabled: true,
    verificationStatus: 'ACTIVE',
    notes: 'Assistant Primary School Teacher circulars and admit card schedules.',
  },
  {
    sourceId: 'dshe_secondary',
    sourceName: 'Directorate of Secondary & Higher Education (DSHE)',
    sourceNameBn: 'মাধ্যমিক ও উচ্চশিক্ষা অধিদপ্তর (মাউশি)',
    organizationName: 'Directorate of Secondary and Higher Education',
    organizationNameBn: 'মাধ্যমিক ও উচ্চশিক্ষা অধিদপ্তর',
    organizationType: 'Directorate',
    sourceGroup: 'directorates_departments',
    parentMinistry: 'Ministry of Education',
    officialDomain: 'dshe.gov.bd',
    recruitmentPageUrl: 'https://dshe.gov.bd/pages/notices',
    noticePageUrl: 'https://dshe.gov.bd/pages/notices',
    applicationPortalUrl: 'http://dshe.teletalk.com.bd',
    sourceAccessMethod: 'HTML_NOTICE_BOARD',
    paginationMethod: 'PAGE_NUMBER',
    supportedCategories: ['education_research', 'govt_public'],
    termsReviewStatus: 'REVIEWED_PUBLIC',
    sourceHealth: 'ACTIVE',
    enabled: true,
    verificationStatus: 'ACTIVE',
  },
  {
    sourceId: 'dghs_health',
    sourceName: 'Directorate General of Health Services (DGHS)',
    sourceNameBn: 'স্বাস্থ্য অধিদপ্তর (ডিজিএইচএস)',
    organizationName: 'Directorate General of Health Services',
    organizationNameBn: 'স্বাস্থ্য অধিদপ্তর',
    organizationType: 'Government Hospital or Medical Institution',
    sourceGroup: 'public_healthcare',
    parentMinistry: 'Health Services Division',
    officialDomain: 'dghs.gov.bd',
    recruitmentPageUrl: 'https://dghs.gov.bd/pages/notices',
    noticePageUrl: 'https://dghs.gov.bd/pages/notices',
    applicationPortalUrl: 'http://dghs.teletalk.com.bd',
    sourceAccessMethod: 'HTML_NOTICE_BOARD',
    paginationMethod: 'PAGE_NUMBER',
    supportedCategories: ['medical_healthcare', 'doctor', 'nurse', 'govt_public'],
    termsReviewStatus: 'REVIEWED_PUBLIC',
    sourceHealth: 'ACTIVE',
    enabled: true,
    verificationStatus: 'ACTIVE',
    notes: 'Medical officer, nurse, technician and healthcare staff appointments.',
  },
  {
    sourceId: 'bsmmu_medical',
    sourceName: 'Bangabandhu Sheikh Mujib Medical University (BSMMU)',
    sourceNameBn: 'বঙ্গবন্ধু শেখ মুজিব মেডিকেল বিশ্ববিদ্যালয়',
    organizationName: 'BSMMU',
    organizationNameBn: 'বঙ্গবন্ধু শেখ মুজিব মেডিকেল বিশ্ববিদ্যালয়',
    organizationType: 'Government Hospital or Medical Institution',
    sourceGroup: 'public_healthcare',
    officialDomain: 'bsmmu.ac.bd',
    recruitmentPageUrl: 'https://bsmmu.ac.bd/notice-board',
    noticePageUrl: 'https://bsmmu.ac.bd/notice-board',
    sourceAccessMethod: 'HTML_NOTICE_BOARD',
    paginationMethod: 'PAGE_NUMBER',
    maxPagesToScan: 3,
    supportedCategories: ['medical_healthcare', 'doctor', 'nurse', 'govt_public'],
    termsReviewStatus: 'REVIEWED_PUBLIC',
    sourceHealth: 'ACTIVE',
    enabled: true,
    verificationStatus: 'ACTIVE',
    notes: 'Medical faculty, registrar, doctor and clinical staff recruitment notices.',
  },
  {
    sourceId: 'ntrca_teacher',
    sourceName: 'NTRCA Teacher Registration',
    sourceNameBn: 'বেসরকারি শিক্ষক নিবন্ধন ও প্রত্যয়ন কর্তৃপক্ষ (এনটিআরসিএ)',
    organizationName: 'Non-Government Teachers Registration & Certification Authority',
    organizationNameBn: 'বেসরকারি শিক্ষক নিবন্ধন ও প্রত্যয়ন কর্তৃপক্ষ',
    organizationType: 'Statutory Body',
    sourceGroup: 'directorates_departments',
    officialDomain: 'ntrca.gov.bd',
    recruitmentPageUrl: 'https://ntrca.gov.bd/pages/notices',
    noticePageUrl: 'https://ntrca.gov.bd/pages/notices',
    applicationPortalUrl: 'http://ntrcar.teletalk.com.bd',
    sourceAccessMethod: 'HTML_NOTICE_BOARD',
    paginationMethod: 'PAGE_NUMBER',
    supportedCategories: ['education_research', 'govt_public'],
    termsReviewStatus: 'REVIEWED_PUBLIC',
    sourceHealth: 'ACTIVE',
    enabled: true,
    verificationStatus: 'ACTIVE',
  },
  {
    sourceId: 'doict_tech',
    sourceName: 'Department of ICT (DoICT)',
    sourceNameBn: 'তথ্য ও যোগাযোগ প্রযুক্তি অধিদপ্তর',
    organizationName: 'Department of Information and Communication Technology',
    organizationNameBn: 'তথ্য ও যোগাযোগ প্রযুক্তি অধিদপ্তর',
    organizationType: 'Department',
    sourceGroup: 'directorates_departments',
    officialDomain: 'doict.gov.bd',
    recruitmentPageUrl: 'https://doict.gov.bd/pages/notices',
    noticePageUrl: 'https://doict.gov.bd/pages/notices',
    applicationPortalUrl: 'http://doict.teletalk.com.bd',
    sourceAccessMethod: 'HTML_NOTICE_BOARD',
    paginationMethod: 'PAGE_NUMBER',
    supportedCategories: ['it_software', 'govt_public'],
    termsReviewStatus: 'REVIEWED_PUBLIC',
    sourceHealth: 'ACTIVE',
    enabled: true,
    verificationStatus: 'ACTIVE',
  },
  {
    sourceId: 'dor_registration',
    sourceName: 'Directorate of Registration',
    sourceNameBn: 'নিবন্ধন অধিদপ্তর (সাব-রেজিস্ট্রার)',
    organizationName: 'Directorate of Registration',
    organizationNameBn: 'নিবন্ধন অধিদপ্তর',
    organizationType: 'Directorate',
    sourceGroup: 'directorates_departments',
    officialDomain: 'dor.gov.bd',
    recruitmentPageUrl: 'http://dor.gov.bd/site/view/notices',
    noticePageUrl: 'http://dor.gov.bd/site/view/notices',
    sourceAccessMethod: 'HTML_NOTICE_BOARD',
    paginationMethod: 'PAGE_NUMBER',
    supportedCategories: ['legal_compliance', 'govt_public'],
    termsReviewStatus: 'REVIEWED_PUBLIC',
    sourceHealth: 'ACTIVE',
    enabled: true,
    verificationStatus: 'ACTIVE',
  },

  // =========================================================================
  // E. DEFENCE & UNIFORMED SERVICES
  // =========================================================================
  {
    sourceId: 'army_recruitment',
    sourceName: 'Bangladesh Army Official Recruitment',
    sourceNameBn: 'বাংলাদেশ সেনাবাহিনী নিয়োগ',
    organizationName: 'Bangladesh Army',
    organizationNameBn: 'বাংলাদেশ সেনাবাহিনী',
    organizationType: 'Defence Force',
    sourceGroup: 'defence_uniformed',
    officialDomain: 'joinarmy.army.mil.bd',
    recruitmentPageUrl: 'https://www.join.army.mil.bd/',
    noticePageUrl: 'https://www.join.army.mil.bd/',
    applicationPortalUrl: 'https://joinarmy.army.mil.bd',
    sourceAccessMethod: 'STRUCTURED_PAGINATED',
    paginationMethod: 'NONE',
    supportedCategories: ['defence_security', 'govt_public'],
    termsReviewStatus: 'REVIEWED_PUBLIC',
    sourceHealth: 'ACTIVE',
    enabled: true,
    verificationStatus: 'ACTIVE',
    notes: 'Officer Cadet, Soldier & Civilian recruitment circulars for Bangladesh Army.',
  },
  {
    sourceId: 'navy_recruitment',
    sourceName: 'Bangladesh Navy Official Recruitment',
    sourceNameBn: 'বাংলাদেশ নৌবাহিনী নিয়োগ',
    organizationName: 'Bangladesh Navy',
    organizationNameBn: 'বাংলাদেশ নৌবাহিনী',
    organizationType: 'Defence Force',
    sourceGroup: 'defence_uniformed',
    officialDomain: 'joinnavy.navy.mil.bd',
    recruitmentPageUrl: 'https://joinnavy.navy.mil.bd/',
    noticePageUrl: 'https://joinnavy.navy.mil.bd/',
    applicationPortalUrl: 'https://joinnavy.navy.mil.bd',
    sourceAccessMethod: 'STRUCTURED_PAGINATED',
    paginationMethod: 'NONE',
    supportedCategories: ['defence_security', 'govt_public'],
    termsReviewStatus: 'REVIEWED_PUBLIC',
    sourceHealth: 'ACTIVE',
    enabled: true,
    verificationStatus: 'ACTIVE',
  },
  {
    sourceId: 'airforce_recruitment',
    sourceName: 'Bangladesh Air Force Official Recruitment',
    sourceNameBn: 'বাংলাদেশ বিমান বাহিনী নিয়োগ',
    organizationName: 'Bangladesh Air Force',
    organizationNameBn: 'বাংলাদেশ বিমান বাহিনী',
    organizationType: 'Defence Force',
    sourceGroup: 'defence_uniformed',
    officialDomain: 'joinairforce.baf.mil.bd',
    recruitmentPageUrl: 'https://joinairforce.baf.mil.bd/',
    noticePageUrl: 'https://joinairforce.baf.mil.bd/',
    applicationPortalUrl: 'https://joinairforce.baf.mil.bd',
    sourceAccessMethod: 'STRUCTURED_PAGINATED',
    paginationMethod: 'NONE',
    supportedCategories: ['defence_security', 'aviation_aerospace', 'govt_public'],
    termsReviewStatus: 'REVIEWED_PUBLIC',
    sourceHealth: 'ACTIVE',
    enabled: true,
    verificationStatus: 'ACTIVE',
  },
  {
    sourceId: 'police_recruitment',
    sourceName: 'Bangladesh Police Recruitment',
    sourceNameBn: 'বাংলাদেশ পুলিশ নিয়োগ',
    organizationName: 'Bangladesh Police',
    organizationNameBn: 'বাংলাদেশ পুলিশ',
    organizationType: 'Law Enforcement Agency',
    sourceGroup: 'defence_uniformed',
    officialDomain: 'police.gov.bd',
    recruitmentPageUrl: 'https://www.police.gov.bd/en/recruitment_information',
    noticePageUrl: 'https://www.police.gov.bd/en/recruitment_information',
    applicationPortalUrl: 'http://police.teletalk.com.bd',
    sourceAccessMethod: 'HTML_RECRUITMENT_TABLE',
    paginationMethod: 'NONE',
    supportedCategories: ['defence_security', 'govt_public'],
    termsReviewStatus: 'REVIEWED_PUBLIC',
    sourceHealth: 'ACTIVE',
    enabled: true,
    verificationStatus: 'ACTIVE',
    notes: 'Sub-Inspector (SI), Sergeant & Constable recruitment notices.',
  },
  {
    sourceId: 'ansar_recruitment',
    sourceName: 'Bangladesh Ansar & VDP Recruitment',
    sourceNameBn: 'বাংলাদেশ আনসার ও গ্রাম প্রতিরক্ষা বাহিনী',
    organizationName: 'Bangladesh Ansar and VDP',
    organizationNameBn: 'বাংলাদেশ আনসার ও ভিডিপি',
    organizationType: 'Defence Force',
    sourceGroup: 'defence_uniformed',
    officialDomain: 'ansarvdp.gov.bd',
    recruitmentPageUrl: 'https://ansarvdp.gov.bd/pages/static-pages/6922dfab933eb65569e235d9',
    noticePageUrl: 'https://ansarvdp.gov.bd/pages/notices',
    applicationPortalUrl: 'http://ansar.teletalk.com.bd',
    sourceAccessMethod: 'HTML_NOTICE_BOARD',
    paginationMethod: 'NONE',
    supportedCategories: ['defence_security', 'govt_public'],
    termsReviewStatus: 'REVIEWED_PUBLIC',
    sourceHealth: 'ACTIVE',
    enabled: true,
    verificationStatus: 'ACTIVE',
  },
  {
    sourceId: 'coastguard_recruitment',
    sourceName: 'Bangladesh Coast Guard Recruitment',
    sourceNameBn: 'বাংলাদেশ কোস্ট গার্ড নিয়োগ',
    organizationName: 'Bangladesh Coast Guard',
    organizationNameBn: 'বাংলাদেশ কোস্ট গার্ড',
    organizationType: 'Defence Force',
    sourceGroup: 'defence_uniformed',
    officialDomain: 'coastguard.gov.bd',
    recruitmentPageUrl: 'https://jobs.coastguard.gov.bd/job-posts',
    noticePageUrl: 'https://coastguard.gov.bd/pages/notices',
    applicationPortalUrl: 'https://jobs.coastguard.gov.bd',
    sourceAccessMethod: 'STRUCTURED_PAGINATED',
    paginationMethod: 'NONE',
    supportedCategories: ['defence_security', 'govt_public'],
    termsReviewStatus: 'REVIEWED_PUBLIC',
    sourceHealth: 'ACTIVE',
    enabled: true,
    verificationStatus: 'ACTIVE',
  },

  // =========================================================================
  // F. GOVERNMENT FINANCIAL INSTITUTIONS
  // =========================================================================
  {
    sourceId: 'bangladesh_bank_erecruitment',
    sourceName: 'Bangladesh Bank eRecruitment',
    sourceNameBn: 'বাংলাদেশ ব্যাংক ই-রিক্রুটমেন্ট (কেন্দ্রীয় ব্যাংক ও ৮ ব্যাংক)',
    organizationName: 'Bangladesh Bank',
    organizationNameBn: 'বাংলাদেশ ব্যাংক',
    organizationType: 'Government Bank',
    sourceGroup: 'government_financial',
    officialDomain: 'erecruitment.bb.org.bd',
    recruitmentPageUrl: 'https://erecruitment.bb.org.bd/career/jobopportunity.php',
    noticePageUrl: 'https://www.bb.org.bd/en/index.php/mediaroom/noticeboard',
    applicationPortalUrl: 'https://erecruitment.bb.org.bd',
    sourceAccessMethod: 'HTML_RECRUITMENT_TABLE',
    paginationMethod: 'NONE',
    supportedCategories: ['banking_finance', 'central_bank', 'govt_public'],
    termsReviewStatus: 'REVIEWED_PUBLIC',
    sourceHealth: 'ACTIVE',
    enabled: true,
    verificationStatus: 'ACTIVE',
    notes: 'Assistant Director (AD), Officer (General/Cash) & Combined 8 Banks recruitment.',
  },
  {
    sourceId: 'sonali_bank_career',
    sourceName: 'Sonali Bank PLC Career',
    sourceNameBn: 'সোনালী ব্যাংক পিএলসি',
    organizationName: 'Sonali Bank PLC',
    organizationNameBn: 'সোনালী ব্যাংক পিএলসি',
    organizationType: 'Government Bank',
    sourceGroup: 'government_financial',
    officialDomain: 'sonalibank.com.bd',
    recruitmentPageUrl: 'https://www.sonalibank.com.bd/career.php',
    noticePageUrl: 'https://www.sonalibank.com.bd/career.php',
    applicationPortalUrl: 'https://erecruitment.bb.org.bd',
    sourceAccessMethod: 'HTML_NOTICE_BOARD',
    paginationMethod: 'NONE',
    supportedCategories: ['banking_finance', 'govt_public'],
    termsReviewStatus: 'REVIEWED_PUBLIC',
    sourceHealth: 'ACTIVE',
    enabled: true,
    verificationStatus: 'ACTIVE',
    notes: 'Combined bank appointments & direct contractual recruitments.',
  },
  {
    sourceId: 'krishi_bank_career',
    sourceName: 'Bangladesh Krishi Bank',
    sourceNameBn: 'বাংলাদেশ কৃষি ব্যাংক',
    organizationName: 'Bangladesh Krishi Bank',
    organizationNameBn: 'বাংলাদেশ কৃষি ব্যাংক',
    organizationType: 'Government Bank',
    sourceGroup: 'government_financial',
    officialDomain: 'krishibank.org.bd',
    recruitmentPageUrl: 'https://www.krishibank.org.bd/career',
    noticePageUrl: 'https://www.krishibank.org.bd/career',
    applicationPortalUrl: 'https://erecruitment.bb.org.bd',
    sourceAccessMethod: 'HTML_NOTICE_BOARD',
    paginationMethod: 'NONE',
    supportedCategories: ['banking_finance', 'agriculture_fisheries', 'govt_public'],
    termsReviewStatus: 'REVIEWED_PUBLIC',
    sourceHealth: 'ACTIVE',
    enabled: true,
    verificationStatus: 'ACTIVE',
  },

  // =========================================================================
  // G. PUBLIC EDUCATION & UNIVERSITIES
  // =========================================================================
  {
    sourceId: 'du_university',
    sourceName: 'University of Dhaka Official Recruitment',
    sourceNameBn: 'ঢাকা বিশ্ববিদ্যালয় নিয়োগ বিজ্ঞপ্তি',
    organizationName: 'University of Dhaka',
    organizationNameBn: 'ঢাকা বিশ্ববিদ্যালয়',
    organizationType: 'Public University',
    sourceGroup: 'public_education',
    officialDomain: 'du.ac.bd',
    recruitmentPageUrl: 'https://www.du.ac.bd/notice',
    noticePageUrl: 'https://www.du.ac.bd/notice',
    sourceAccessMethod: 'HTML_NOTICE_BOARD',
    paginationMethod: 'PAGE_NUMBER',
    maxPagesToScan: 3,
    supportedCategories: ['education_research', 'govt_public'],
    termsReviewStatus: 'REVIEWED_PUBLIC',
    sourceHealth: 'ACTIVE',
    enabled: true,
    verificationStatus: 'ACTIVE',
    notes: 'Faculty professor, lecturer and officer appointments at DU.',
  },
  {
    sourceId: 'buet_university',
    sourceName: 'BUET Recruitment Portal',
    sourceNameBn: 'বাংলাদেশ প্রকৌশল বিশ্ববিদ্যালয় (বুয়েট)',
    organizationName: 'Bangladesh University of Engineering & Technology',
    organizationNameBn: 'বাংলাদেশ প্রকৌশল বিশ্ববিদ্যালয়',
    organizationType: 'Public University',
    sourceGroup: 'public_education',
    officialDomain: 'buet.ac.bd',
    recruitmentPageUrl: 'https://www.buet.ac.bd/notice',
    noticePageUrl: 'https://www.buet.ac.bd/notice',
    sourceAccessMethod: 'HTML_NOTICE_BOARD',
    paginationMethod: 'NONE',
    supportedCategories: ['education_research', 'engineering_architecture', 'govt_public'],
    termsReviewStatus: 'REVIEWED_PUBLIC',
    sourceHealth: 'ACTIVE',
    enabled: true,
    verificationStatus: 'ACTIVE',
  },

  // =========================================================================
  // H. PUBLIC TRANSPORT & CORPORATIONS
  // =========================================================================
  {
    sourceId: 'railway_govt',
    sourceName: 'Bangladesh Railway Official Recruitment',
    sourceNameBn: 'বাংলাদেশ রেলওয়ে নিয়োগ ও পরীক্ষার নোটিশ',
    organizationName: 'Bangladesh Railway',
    organizationNameBn: 'বাংলাদেশ রেলওয়ে',
    organizationType: 'Public Corporation',
    sourceGroup: 'public_corporations',
    officialDomain: 'railway.gov.bd',
    recruitmentPageUrl: 'https://railway.gov.bd/pages/notices/',
    noticePageUrl: 'https://railway.gov.bd/pages/notices/',
    applicationPortalUrl: 'http://br.teletalk.com.bd',
    sourceAccessMethod: 'HTML_NOTICE_BOARD',
    paginationMethod: 'PAGE_NUMBER',
    maxPagesToScan: 5,
    supportedCategories: ['transport_logistics', 'engineering_architecture', 'govt_public'],
    termsReviewStatus: 'REVIEWED_PUBLIC',
    sourceHealth: 'ACTIVE',
    enabled: true,
    verificationStatus: 'ACTIVE',
    notes: 'Assistant Station Master, Pointsman, Gateman & Railway staff appointments.',
  },
  {
    sourceId: 'bwdb_water',
    sourceName: 'Bangladesh Water Development Board (BWDB)',
    sourceNameBn: 'বাংলাদেশ পানি উন্নয়ন বোর্ড (বাপাউবো)',
    organizationName: 'Bangladesh Water Development Board',
    organizationNameBn: 'বাংলাদেশ পানি উন্নয়ন বোর্ড',
    organizationType: 'Autonomous Organization',
    sourceGroup: 'public_corporations',
    officialDomain: 'bwdb.gov.bd',
    recruitmentPageUrl: 'https://bwdb.gov.bd/pages/notices/',
    noticePageUrl: 'https://bwdb.gov.bd/pages/notices/',
    applicationPortalUrl: 'http://bwdb.teletalk.com.bd',
    sourceAccessMethod: 'HTML_NOTICE_BOARD',
    paginationMethod: 'PAGE_NUMBER',
    supportedCategories: ['engineering_architecture', 'govt_public'],
    termsReviewStatus: 'REVIEWED_PUBLIC',
    sourceHealth: 'ACTIVE',
    enabled: true,
    verificationStatus: 'ACTIVE',
  },
  {
    sourceId: 'petrobangla_energy',
    sourceName: 'PetroBangla (BOGMC)',
    sourceNameBn: 'বাংলাদেশ তৈল, গ্যাস ও খনিজ সম্পদ কর্পোরেশন (পেট্রোবাংলা)',
    organizationName: 'PetroBangla',
    organizationNameBn: 'পেট্রোবাংলা',
    organizationType: 'Autonomous Organization',
    sourceGroup: 'public_corporations',
    officialDomain: 'petrobangla.org.bd',
    recruitmentPageUrl: 'https://petrobangla.org.bd/',
    noticePageUrl: 'https://petrobangla.org.bd/',
    applicationPortalUrl: 'http://bogmc.teletalk.com.bd',
    sourceAccessMethod: 'HTML_NOTICE_BOARD',
    paginationMethod: 'NONE',
    supportedCategories: ['environment_energy', 'engineering_architecture', 'govt_public'],
    termsReviewStatus: 'REVIEWED_PUBLIC',
    sourceHealth: 'ACTIVE',
    enabled: true,
    verificationStatus: 'ACTIVE',
  },

  // =========================================================================
  // J. DISTRICT ADMINISTRATION & LOCAL GOVT
  // =========================================================================
  {
    sourceId: 'dc_dhaka',
    sourceName: 'DC Office Dhaka (District Administration)',
    sourceNameBn: 'জেলা প্রশাসকের কার্যালয়, ঢাকা',
    organizationName: 'Office of Deputy Commissioner Dhaka',
    organizationNameBn: 'জেলা প্রশাসকের কার্যালয়, ঢাকা',
    organizationType: 'District Administration',
    sourceGroup: 'district_local_govt',
    officialDomain: 'dhaka.gov.bd',
    recruitmentPageUrl: 'http://dhaka.gov.bd/site/view/notices',
    noticePageUrl: 'http://dhaka.gov.bd/site/view/notices',
    applicationPortalUrl: 'http://dcdhaka.teletalk.com.bd',
    sourceAccessMethod: 'HTML_NOTICE_BOARD',
    paginationMethod: 'PAGE_NUMBER',
    supportedCategories: ['govt_public'],
    termsReviewStatus: 'REVIEWED_PUBLIC',
    sourceHealth: 'ACTIVE',
    enabled: true,
    verificationStatus: 'ACTIVE',
  },
  {
    sourceId: 'dc_chattogram',
    sourceName: 'DC Office Chattogram',
    sourceNameBn: 'জেলা প্রশাসকের কার্যালয়, চট্টগ্রাম',
    organizationName: 'Office of Deputy Commissioner Chattogram',
    organizationNameBn: 'জেলা প্রশাসকের কার্যালয়, চট্টগ্রাম',
    organizationType: 'District Administration',
    sourceGroup: 'district_local_govt',
    officialDomain: 'chittagong.gov.bd',
    recruitmentPageUrl: 'http://chittagong.gov.bd/site/view/notices',
    noticePageUrl: 'http://chittagong.gov.bd/site/view/notices',
    applicationPortalUrl: 'http://dcctg.teletalk.com.bd',
    sourceAccessMethod: 'HTML_NOTICE_BOARD',
    paginationMethod: 'PAGE_NUMBER',
    supportedCategories: ['govt_public'],
    termsReviewStatus: 'REVIEWED_PUBLIC',
    sourceHealth: 'ACTIVE',
    enabled: true,
    verificationStatus: 'ACTIVE',
  },
];

export class GovernmentSourceRegistry {
  private static sourcesMap = new Map<string, GovernmentSourceRecord>(
    SEED_GOVERNMENT_SOURCES.map((s) => [s.sourceId, { ...s }])
  );

  public static getAllSources(): GovernmentSourceRecord[] {
    return Array.from(this.sourcesMap.values());
  }

  public static getSourceById(sourceId: string): GovernmentSourceRecord | undefined {
    return this.sourcesMap.get(sourceId);
  }

  public static getSourcesByGroup(group: GovernmentSourceGroup): GovernmentSourceRecord[] {
    return this.getAllSources().filter((s) => s.sourceGroup === group);
  }

  public static getActiveSources(): GovernmentSourceRecord[] {
    return this.getAllSources().filter((s) => s.enabled && s.verificationStatus === 'ACTIVE');
  }

  public static getCandidateSources(): GovernmentSourceRecord[] {
    return this.getAllSources().filter((s) => s.verificationStatus === 'CANDIDATE');
  }

  public static enableSource(sourceId: string): boolean {
    const s = this.sourcesMap.get(sourceId);
    if (!s) return false;
    s.enabled = true;
    s.verificationStatus = 'ACTIVE';
    return true;
  }

  public static disableSource(sourceId: string): boolean {
    const s = this.sourcesMap.get(sourceId);
    if (!s) return false;
    s.enabled = false;
    s.verificationStatus = 'DISABLED';
    return true;
  }

  public static updateSourceHealth(
    sourceId: string,
    status: GovernmentSourceStatus,
    error?: string
  ): void {
    const s = this.sourcesMap.get(sourceId);
    if (!s) return;
    s.sourceHealth = status;
    s.lastError = error;
    s.lastCheckedAt = Date.now();
    if (status === 'ACTIVE' || status === 'PARTIAL') {
      s.lastSuccessfulAt = Date.now();
    }
  }

  public static registerCandidateSource(
    sourceOrName: GovernmentSourceRecord | string,
    nameBn?: string,
    portalUrl?: string,
    noticeUrl?: string
  ): GovernmentSourceRecord {
    if (typeof sourceOrName === 'object') {
      if (!this.sourcesMap.has(sourceOrName.sourceId)) {
        this.sourcesMap.set(sourceOrName.sourceId, { ...sourceOrName });
      }
      return sourceOrName;
    }

    const nameEn = sourceOrName;
    const url = portalUrl || '';
    const isGovt =
      url.includes('.gov.bd') ||
      url.includes('.mil.bd') ||
      url.includes('.edu.bd') ||
      url.includes('.ac.bd') ||
      url.includes('alljobs.teletalk.com.bd');

    if (!isGovt) {
      throw new Error(`Unofficial domain rejected: ${url}`);
    }

    let domain = 'govt';
    try {
      domain = new URL(url).hostname.replace(/[^a-zA-Z0-9]/g, '_');
    } catch {
      domain = 'custom';
    }

    const sourceId = `govt_candidate_${domain}`;
    const record: GovernmentSourceRecord = {
      sourceId,
      sourceName: nameEn,
      sourceNameBn: nameBn || nameEn,
      organizationName: nameEn,
      organizationNameBn: nameBn || nameEn,
      organizationType: 'Ministry',
      sourceGroup: 'ministries_divisions',
      officialDomain: domain,
      officialPortalUrl: url,
      recruitmentPageUrl: noticeUrl || url,
      noticePageUrl: noticeUrl || url,
      sourceAccessMethod: 'HTML_NOTICE_BOARD',
      paginationMethod: 'PAGE_NUMBER',
      supportedCategories: ['govt_public'],
      termsReviewStatus: 'REVIEWED_PUBLIC',
      sourceHealth: 'ACTIVE',
      enabled: true,
      verificationStatus: 'OFFICIAL_DOMAIN_VERIFIED',
    };

    this.sourcesMap.set(sourceId, record);
    return record;
  }
}
