// JobFill BD - Form Field Context Analyzer
// Determines exact hierarchical context to avoid cross-field ambiguity (e.g. SSC vs HSC, Present vs Permanent).

export type FormSectionContext =
  | 'personal'
  | 'family_father'
  | 'family_mother'
  | 'address_present'
  | 'address_permanent'
  | 'education_ssc'
  | 'education_hsc'
  | 'education_graduation'
  | 'education_masters'
  | 'experience'
  | 'choice'
  | 'unknown';

export class FieldContext {
  /**
   * Evaluates ancestor DOM nodes, fieldset legends, table headers, and nearby headings
   * to determine the exact contextual section for an element.
   */
  public static resolveContext(element: HTMLElement): FormSectionContext {
    let curr: HTMLElement | null = element;
    let accumulatedText = '';

    // Ascend up to 6 parent levels to inspect containers
    for (let depth = 0; depth < 6 && curr && curr !== document.body; depth++) {
      // 1. Inspect Fieldset Legend
      if (curr.tagName.toLowerCase() === 'fieldset') {
        const legend = curr.querySelector('legend');
        if (legend?.textContent) {
          accumulatedText += ' ' + legend.textContent;
        }
      }

      // 2. Inspect Preceding section header bars (.form-header-bar, .form-section-title, h1-h4)
      const prevSibling = curr.previousElementSibling;
      if (prevSibling && prevSibling instanceof HTMLElement) {
        if (
          prevSibling.classList.contains('form-header-bar') ||
          prevSibling.classList.contains('form-section-title') ||
          /^h[1-6]$/i.test(prevSibling.tagName)
        ) {
          accumulatedText += ' ' + prevSibling.textContent;
        }
      }

      // 3. Inspect Table headings or captions
      const table = curr.closest('table');
      if (table) {
        const caption = table.querySelector('caption');
        if (caption?.textContent) accumulatedText += ' ' + caption.textContent;
        const thFirst = table.querySelector('th');
        if (thFirst?.textContent) accumulatedText += ' ' + thFirst.textContent;
      }

      // 4. Inspect container ID or class
      const idOrClass = `${curr.id} ${curr.className}`.toLowerCase();
      accumulatedText += ' ' + idOrClass;

      curr = curr.parentElement;
    }

    const t = accumulatedText.toLowerCase();

    // Context determination with strict priority
    if (t.includes('present address') || t.includes('বর্তমান ঠিকানা') || t.includes('present_addr')) {
      return 'address_present';
    }
    if (t.includes('permanent address') || t.includes('স্থায়ী ঠিকানা') || t.includes('permanent_addr')) {
      return 'address_permanent';
    }

    if (t.includes('s.s.c') || t.includes('ssc') || t.includes('dakhil') || t.includes('দাখিল')) {
      return 'education_ssc';
    }
    if (t.includes('h.s.c') || t.includes('hsc') || t.includes('alim') || t.includes('আলিম')) {
      return 'education_hsc';
    }
    if (t.includes('masters') || t.includes('m.a') || t.includes('m.sc') || t.includes('মাস্টার্স')) {
      return 'education_masters';
    }
    if (
      t.includes('graduation') ||
      t.includes('honours') ||
      t.includes('degree') ||
      t.includes('bachelor') ||
      t.includes('স্নাতক')
    ) {
      return 'education_graduation';
    }

    if (t.includes('father') || t.includes('পিতা')) {
      return 'family_father';
    }
    if (t.includes('mother') || t.includes('মাতা')) {
      return 'family_mother';
    }

    if (t.includes('experience') || t.includes('employment') || t.includes('অভিজ্ঞতা')) {
      return 'experience';
    }

    if (t.includes('choice') || t.includes('organization choice') || t.includes('পছন্দ')) {
      return 'choice';
    }

    if (t.includes('basic') || t.includes('personal') || t.includes('applicant')) {
      return 'personal';
    }

    return 'unknown';
  }
}
