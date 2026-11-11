// JobFill BD - Form Detector (Phase 8)
// Identifies government application forms on the active page while filtering out
// login, search, newsletter, or navigation forms.

export interface DetectedFormInfo {
  formElement: HTMLElement;
  isGovernmentApplication: boolean;
  totalFieldsCount: number;
  detectedKeywords: string[];
  formName: string;
}

export class FormDetector {
  private static APP_KEYWORDS = [
    'applicant',
    'father',
    'mother',
    'ssc',
    'hsc',
    'graduation',
    'education',
    'present address',
    'permanent address',
    'national id',
    'nid',
    'birth registration',
    'date of birth',
    'religion',
    'marital status',
    'petrobangla',
    'bogmc',
    'teletalk',
    'bpsc',
    'bcs',
    'আবেদনকারী',
    'পিতা',
    'মাতা',
    'ঠিকানা',
    'যোগ্যতা',
  ];

  /**
   * Scans document for candidate recruitment forms
   */
  public static detectApplicationForms(doc: Document = document): DetectedFormInfo[] {
    const candidates: HTMLElement[] = [];

    // 1. Gather all <form> tags
    const forms = Array.from(doc.querySelectorAll<HTMLElement>('form'));
    candidates.push(...forms);

    // 2. If no <form> tags exist, inspect main/body container
    if (candidates.length === 0) {
      const main = doc.querySelector<HTMLElement>('main, #content, .content, .container, body');
      if (main) candidates.push(main);
    }

    const results: DetectedFormInfo[] = [];

    for (const form of candidates) {
      const text = (form.innerText || form.textContent || '').toLowerCase();
      const matchedKeywords = this.APP_KEYWORDS.filter((kw) => text.includes(kw));

      const inputs = form.querySelectorAll('input:not([type="hidden"]), select, textarea');
      const totalFieldsCount = inputs.length;

      // An application form typically matches at least 2 keywords and has at least 3 editable fields
      const isGovernmentApplication = matchedKeywords.length >= 2 && totalFieldsCount >= 3;

      results.push({
        formElement: form,
        isGovernmentApplication,
        totalFieldsCount,
        detectedKeywords: matchedKeywords,
        formName: form.getAttribute('name') || form.id || 'Job Application Form',
      });
    }

    return results;
  }
}
