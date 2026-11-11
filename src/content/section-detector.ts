// JobFill BD - Section & Container Context Detector (Phase 10)
// Identifies enclosing section contexts to disambiguate identical field labels
// (e.g. separating SSC Roll from HSC Roll, Present CareOf from Permanent CareOf).

import { SectionCategory } from '../intelligence/context-analyzer';

export class SectionDetector {
  /**
   * Discovers the section context for a given form element
   */
  public static detectElementSection(el: HTMLElement): SectionCategory {
    let current: HTMLElement | null = el.parentElement;

    while (current && current !== document.body) {
      // 1. Check Fieldset Legend
      if (current.tagName.toLowerCase() === 'fieldset') {
        const legend = current.querySelector('legend');
        if (legend && legend.textContent) {
          const match = this.matchSectionKeyword(legend.textContent);
          if (match !== 'unknown') return match;
        }
      }

      // 2. Check Table Row / Column Headers
      if (current.tagName.toLowerCase() === 'table') {
        const headers = Array.from(current.querySelectorAll('th, caption, .table-header'));
        for (const th of headers) {
          if (th.textContent) {
            const match = this.matchSectionKeyword(th.textContent);
            if (match !== 'unknown') return match;
          }
        }
      }

      // 3. Check Headings / Section Pills within immediate parent
      const headings = Array.from(
        current.querySelectorAll('h1, h2, h3, h4, .section-header, .panel-heading, .card-header, .box-title')
      );
      for (const h of headings) {
        if (h.textContent) {
          const match = this.matchSectionKeyword(h.textContent);
          if (match !== 'unknown') return match;
        }
      }

      // 4. Check Container IDs and Classes
      const idClass = `${current.id} ${current.className}`.toLowerCase();
      const idMatch = this.matchSectionKeyword(idClass);
      if (idMatch !== 'unknown') return idMatch;

      current = current.parentElement;
    }

    return 'unknown';
  }

  private static matchSectionKeyword(text: string): SectionCategory {
    const t = text.toLowerCase();

    // Secondary Education
    if (t.includes('ssc') || t.includes('dakhil') || t.includes('secondary')) return 'ssc';
    if (t.includes('hsc') || t.includes('alim') || t.includes('higher secondary') || t.includes('diploma')) return 'hsc';

    // Higher Education
    if (t.includes('graduation') || t.includes('degree') || t.includes('bachelor') || t.includes('honours')) return 'graduation';
    if (t.includes('masters') || t.includes('post graduate') || t.includes('m.sc') || t.includes('m.a')) return 'masters';

    // Addresses
    if (t.includes('present') || t.includes('বর্তমান') || t.includes('mailing') || t.includes('current')) return 'present_address';
    if (t.includes('permanent') || t.includes('স্থায়ী') || t.includes('home')) return 'permanent_address';

    // Family
    if (t.includes('father') || t.includes('পিতা') || t.includes('বাবা')) return 'father';
    if (t.includes('mother') || t.includes('মাতা') || t.includes('মা')) return 'mother';
    if (t.includes('spouse') || t.includes('স্বামী') || t.includes('স্ত্রী')) return 'spouse';

    // Experience
    if (t.includes('experience') || t.includes('employment') || t.includes('অভিজ্ঞতা') || t.includes('চাকরি')) return 'experience';

    // Preferences & Cadre
    if (t.includes('cadre') || t.includes('choice') || t.includes('quota') || t.includes('কোটা') || t.includes('পছন্দ')) return 'special';

    return 'unknown';
  }
}

