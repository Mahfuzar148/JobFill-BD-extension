// JobFill BD - Final Intelligence Add-on 3: Full Form Schema Intelligence
// Scans the active document before filling to build a comprehensive structural blueprint:
// Sections, subsections, required vs optional fields, repeating groups, and dependencies.

export interface SectionDescriptor {
  id: string;
  title: string;
  category: 'basic' | 'address' | 'education' | 'experience' | 'choices' | 'declaration' | 'unknown';
  elementCount: number;
  requiredFieldCount: number;
  isConditional: boolean;
  conditionalTriggerSelector?: string;
}

export interface InternalFormSchema {
  timestamp: string;
  url: string;
  pageTitle: string;
  hasMultiStep: boolean;
  sections: SectionDescriptor[];
  totalFieldsCount: number;
  requiredFieldsCount: number;
  optionalFieldsCount: number;
  repeatingSectionsCount: number;
  conditionalSectionsCount: number;
}

export class FormSchemaEngine {
  public static analyzeDocument(doc: Document): InternalFormSchema {
    const sections: SectionDescriptor[] = [];
    const elements = Array.from(
      doc.querySelectorAll<HTMLElement>(
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), select, textarea'
      )
    ).filter((el) => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });

    // Detect Section Containers: fieldsets, tables, cards, form blocks
    const sectionContainers = Array.from(
      doc.querySelectorAll<HTMLElement>(
        '.form-header-bar, .form-section-title, .edu-header, .address-col-title, fieldset, legend'
      )
    );

    let secIdx = 1;
    for (const sc of sectionContainers) {
      const title = (sc.textContent || '').trim();
      if (!title || title.length < 3) continue;

      const norm = title.toLowerCase();
      let category: SectionDescriptor['category'] = 'unknown';

      if (norm.includes('basic') || norm.includes('personal') || norm.includes('ব্যক্তিগত')) {
        category = 'basic';
      } else if (norm.includes('address') || norm.includes('ঠিকানা')) {
        category = 'address';
      } else if (norm.includes('ssc') || norm.includes('hsc') || norm.includes('grad') || norm.includes('masters') || norm.includes('শিক্ষা')) {
        category = 'education';
      } else if (norm.includes('experience') || norm.includes('employment') || norm.includes('অভিজ্ঞতা')) {
        category = 'experience';
      } else if (norm.includes('choice') || norm.includes('preference') || norm.includes('পছন্দ')) {
        category = 'choices';
      }

      // Check if section has conditional toggle ("If Applicable")
      const parent = sc.closest('.edu-block') || sc.parentElement;
      const chk = parent?.parentElement?.querySelector('input[type="checkbox"][id*="chk" i], input[type="checkbox"][name*="applicable" i]');

      sections.push({
        id: `sec_${secIdx++}`,
        title,
        category,
        elementCount: parent ? parent.querySelectorAll('input, select, textarea').length : 0,
        requiredFieldCount: parent ? parent.querySelectorAll('[required]').length : 0,
        isConditional: !!chk,
        conditionalTriggerSelector: chk ? `#${chk.id}` : undefined,
      });
    }

    // Check Multi-step indicator
    const hasMultiStep = !!doc.querySelector('.step, .wizard, .pagination, [class*="step-indicator"]');

    const requiredCount = elements.filter((el) => el.hasAttribute('required') || el.getAttribute('aria-required') === 'true').length;

    return {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      pageTitle: doc.title,
      hasMultiStep,
      sections,
      totalFieldsCount: elements.length,
      requiredFieldsCount: requiredCount,
      optionalFieldsCount: elements.length - requiredCount,
      repeatingSectionsCount: doc.querySelectorAll('.exp-box, .repeater, [class*="dynamic-row"]').length,
      conditionalSectionsCount: sections.filter((s) => s.isConditional).length,
    };
  }
}
