// JobFill BD - Universal Form Detector
// Inspects active document to verify presence of a genuine Bangladesh recruitment application form.

import { isExcludedSiteUrl, isSupportedJobPortalUrl } from '../../security/site-policy';

export interface FormDetectionSummary {
  hasJobForm: boolean;
  formTitle: string;
  totalFieldsCount: number;
  detectedSectionsCount: number;
  isSupportedPlatform: boolean;
  platformName: string;
}

export class FormDetector {
  private static RECRUITMENT_KEYWORDS = [
    'applicant',
    'father',
    'mother',
    'ssc',
    'hsc',
    'graduation',
    'present address',
    'permanent address',
    'national id',
    'nid',
    'petrobangla',
    'bogmc',
    'teletalk',
    'bpsc',
    'bcs',
    'roll',
    'board',
    'gpa',
    'dob',
    'date of birth',
    'mobile',
    'religion',
    'gender',
    'marital',
    'jobfill',
    'district',
    'upazila',
  ];

  public static analyze(doc: Document = document): FormDetectionSummary {
    const currentUrl = typeof window !== 'undefined' ? window.location?.href || '' : '';
    const hostname = typeof window !== 'undefined' ? (window.location?.hostname || '').toLowerCase() : '';
    if (isExcludedSiteUrl(currentUrl)) {
      return {
        hasJobForm: false,
        formTitle: doc.title || '',
        totalFieldsCount: 0,
        detectedSectionsCount: 0,
        isSupportedPlatform: false,
        platformName: 'Excluded Origin',
      };
    }

    const text = (doc.body?.textContent || '').toLowerCase();
    const inputs = doc.querySelectorAll(
      'input:not([type="hidden"]):not([type="search"]), select, textarea'
    );
    const totalFieldsCount = inputs.length;

    let matchedKeywords = 0;
    for (const kw of this.RECRUITMENT_KEYWORDS) {
      if (text.includes(kw)) matchedKeywords++;
    }

    const isTeletalk =
      hostname.includes('teletalk.com.bd') ||
      text.includes('teletalk') ||
      text.includes('alljobs');

    const hasJobForm = totalFieldsCount >= 4 && matchedKeywords >= 3;

    return {
      hasJobForm,
      formTitle: doc.title || 'Government Job Application Form',
      totalFieldsCount,
      detectedSectionsCount: doc.querySelectorAll('.form-header-bar, fieldset, legend').length,
      isSupportedPlatform: isTeletalk || hostname.includes('gov.bd') || isSupportedJobPortalUrl(currentUrl),
      platformName: isTeletalk ? 'Teletalk Bangladesh' : 'Bangladesh Government Portal',
    };
  }
}
