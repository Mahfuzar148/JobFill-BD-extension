// JobFill BD - Form Section Detector
// Detects and segments multi-section forms (Basic Info, Address, Education, Experience, Quotas).

export interface DetectedSection {
  title: string;
  category: 'personal' | 'address' | 'education' | 'experience' | 'choice' | 'other';
  container: HTMLElement;
  fieldCount: number;
}

export class SectionDetector {
  public static detectSections(root: ParentNode = document): DetectedSection[] {
    const sections: DetectedSection[] = [];

    // Scan for section headers: .form-header-bar, .form-section-title, legend, h2-h4
    const headerElements = root.querySelectorAll<HTMLElement>(
      '.form-header-bar, .form-section-title, legend, h2, h3, fieldset'
    );

    headerElements.forEach((header) => {
      const text = header.textContent?.trim() || '';
      if (!text) return;

      const lower = text.toLowerCase();
      let category: DetectedSection['category'] = 'other';

      if (lower.includes('basic') || lower.includes('personal') || lower.includes('applicant')) {
        category = 'personal';
      } else if (lower.includes('address') || lower.includes('ঠিকানা')) {
        category = 'address';
      } else if (lower.includes('education') || lower.includes('qualification') || lower.includes('পরীক্ষা')) {
        category = 'education';
      } else if (lower.includes('experience') || lower.includes('employment') || lower.includes('অভিজ্ঞতা')) {
        category = 'experience';
      } else if (lower.includes('choice') || lower.includes('organization') || lower.includes('পছন্দ')) {
        category = 'choice';
      }

      const container = header.closest('table, fieldset, .form-container, div') as HTMLElement || header;
      const fieldCount = container.querySelectorAll('input, select, textarea').length;

      sections.push({
        title: text,
        category,
        container,
        fieldCount,
      });
    });

    return sections;
  }
}
