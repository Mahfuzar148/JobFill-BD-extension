// JobFill BD - Context Detector
// Disambiguates fields with identical or generic names (e.g., "Name", "Roll", "Result", "Board", "Passing Year")
// by inspecting surrounding section headings, table headers, fieldsets, and ancestor containers.

export type SectionType =
  | 'personal'
  | 'present_address'
  | 'permanent_address'
  | 'ssc'
  | 'hsc'
  | 'graduation'
  | 'masters'
  | 'experience'
  | 'special'
  | 'reference'
  | 'unknown';

export function detectSectionContext(element: HTMLElement): SectionType {
  // 1. Check closest fieldset legend
  const fieldset = element.closest('fieldset');
  if (fieldset) {
    const legend = fieldset.querySelector('legend');
    if (legend) {
      const type = classifySectionText(legend.textContent || '');
      if (type !== 'unknown') return type;
    }
  }

  // 2. Check closest card or container with a heading / title
  let parent: HTMLElement | null = element.parentElement;
  for (let i = 0; i < 6 && parent; i++) {
    // Look for headings (h1, h2, h3, h4, h5, h6, or elements with title/heading classes)
    const headings = parent.querySelectorAll('h1, h2, h3, h4, h5, h6, .card-title, .section-title, .legend, th');
    for (const h of Array.from(headings)) {
      const text = h.textContent || '';
      const type = classifySectionText(text);
      if (type !== 'unknown') return type;
    }

    // Check table headers if inside a table
    const table = parent.closest('table');
    if (table) {
      const ths = table.querySelectorAll('th, caption');
      for (const th of Array.from(ths)) {
        const type = classifySectionText(th.textContent || '');
        if (type !== 'unknown') return type;
      }
    }

    parent = parent.parentElement;
  }

  return 'unknown';
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[\s\-_.\/]+/g, ' ').trim();
}

export function classifySectionText(text: string): SectionType {
  const norm = normalizeText(text);

  // HSC / Diploma (Checked before SSC to prevent 'উচ্চ মাধ্যমিক' from matching 'মাধ্যমিক')
  if (
    norm.includes('hsc') ||
    norm.includes('alim') ||
    norm.includes('a level') ||
    norm.includes('diploma in engineering') ||
    norm.includes('diploma') ||
    norm.includes('higher secondary') ||
    norm.includes('উচ্চ মাধ্যমিক') ||
    norm.includes('এইচএসসি')
  ) {
    return 'hsc';
  }

  // SSC / Equivalent
  if (
    norm.includes('ssc') ||
    norm.includes('dakhil') ||
    norm.includes('o level') ||
    norm.includes('secondary school') ||
    norm.includes('মাধ্যমিক') ||
    norm.includes('এসএসসি')
  ) {
    return 'ssc';
  }

  // Masters / Equivalent
  if (
    norm.includes('master') ||
    norm.includes('m.sc') ||
    norm.includes('m.a') ||
    norm.includes('m.b.a') ||
    norm.includes('post graduate') ||
    norm.includes('post-graduate') ||
    norm.includes('স্নাতকোত্তর') ||
    norm.includes('মাস্টার্স')
  ) {
    return 'masters';
  }

  // Graduation / Honours / Bachelor
  if (
    norm.includes('graduation') ||
    norm.includes('honours') ||
    norm.includes('bachelor') ||
    norm.includes('b.sc') ||
    norm.includes('b.a') ||
    norm.includes('b.b.a') ||
    norm.includes('degree pass') ||
    norm.includes('undergraduate') ||
    norm.includes('স্নাতক')
  ) {
    return 'graduation';
  }

  // Permanent Address
  if (
    norm.includes('permanent address') ||
    norm.includes('permanent') ||
    norm.includes('স্থায়ী ঠিকানা') ||
    norm.includes('স্থায়ী')
  ) {
    return 'permanent_address';
  }

  // Present Address
  if (
    norm.includes('present address') ||
    norm.includes('present') ||
    norm.includes('mailing address') ||
    norm.includes('current address') ||
    norm.includes('বর্তমান ঠিকানা') ||
    norm.includes('যোগাযোগের ঠিকানা')
  ) {
    return 'present_address';
  }

  // Job Experience
  if (
    norm.includes('experience') ||
    norm.includes('employment') ||
    norm.includes('job') ||
    norm.includes('service') ||
    norm.includes('অভিজ্ঞতা') ||
    norm.includes('চাকরি') ||
    norm.includes('কর্মসংস্থান')
  ) {
    return 'experience';
  }

  // References
  if (
    norm.includes('reference') ||
    norm.includes('referee') ||
    norm.includes('রেফারেন্স')
  ) {
    return 'reference';
  }

  // Organization / Cadre / Unit Choice
  if (
    norm.includes('organization choice') ||
    norm.includes('choice') ||
    norm.includes('preference') ||
    norm.includes('ক্যাডার পছন্দ') ||
    norm.includes('প্রতিষ্ঠানের পছন্দ')
  ) {
    return 'special';
  }

  // Basic / Personal Information
  if (
    norm.includes('basic information') ||
    norm.includes('personal') ||
    norm.includes('applicant') ||
    norm.includes('candidate') ||
    norm.includes('ব্যক্তিগত তথ্য') ||
    norm.includes('প্রার্থীর তথ্য')
  ) {
    return 'personal';
  }

  return 'unknown';
}
