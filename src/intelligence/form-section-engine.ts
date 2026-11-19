// JobFill BD - Form Section Detection Engine
// Recognizes parent form sections (Personal Info, Present/Permanent Address,
// SSC/HSC/Graduation/Masters, Bangla Info, Quotas, Declarations) via 8 signals:
// Fieldset/Legend, Headings, Nearby Headings, Containers, ARIA Groups, Tables,
// Repeating Education Blocks, and Form Groups.

export type FormSectionType =
  | 'personal_info'
  | 'identity_citizenship'
  | 'contact_info'
  | 'contact_quota'
  | 'present_address'
  | 'permanent_address'
  | 'academic_qualifications'
  | 'ssc_level'
  | 'hsc_level'
  | 'graduation_level'
  | 'masters_level'
  | 'bangla_info'
  | 'employment_info'
  | 'exam_centre'
  | 'applicant_declaration'
  | 'unknown';

export interface FormSectionContext {
  sectionType: FormSectionType;
  canonicalSectionName: string;
  sourceSignal: 'legend' | 'heading' | 'nearby_heading' | 'aria_group' | 'table_header' | 'container_id_class' | 'repeating_block' | 'default';
  hierarchyTrail: string;
  confidence: number;
}

export class FormSectionEngine {
  /**
   * Discovers the section context for a given form element
   */
  public static detectSection(el: HTMLElement): FormSectionContext {
    // 0. Element-level exact prefix signals (e.g. ssc_*, hsc_*, grad_*, p_*, perm_*, board1, board2)
    const nameId = `${el.getAttribute('name') || ''} ${el.id || ''}`.toLowerCase();
    const isSscIndexed = /\b(exam1|board1|ins1|roll1|group1|subject1|result1|year1|pass1)\b|^(exam1|board1|ins1|roll1|group1|year1)$/i.test(nameId);
    if (nameId.includes('ssc_') || nameId.startsWith('ssc') || nameId.includes('_ssc') || isSscIndexed) {
      return {
        sectionType: 'ssc_level',
        canonicalSectionName: 'SSC or Equivalent Level',
        sourceSignal: 'container_id_class',
        hierarchyTrail: 'Academic > SSC (Field Signal)',
        confidence: 95,
      };
    }
    const isHscIndexed = /\b(exam2|board2|ins2|roll2|group2|subject2|result2|year2|pass2)\b|^(exam2|board2|ins2|roll2|group2|year2)$/i.test(nameId);
    if (nameId.includes('hsc_') || nameId.startsWith('hsc') || nameId.includes('_hsc') || isHscIndexed) {
      return {
        sectionType: 'hsc_level',
        canonicalSectionName: 'HSC or Equivalent Level',
        sourceSignal: 'container_id_class',
        hierarchyTrail: 'Academic > HSC (Field Signal)',
        confidence: 95,
      };
    }
    if (nameId.includes('grad_') || nameId.startsWith('grad') || nameId.includes('gra_') || nameId.includes('_grad')) {
      return {
        sectionType: 'graduation_level',
        canonicalSectionName: "Graduation Level / Bachelor's Degree",
        sourceSignal: 'container_id_class',
        hierarchyTrail: 'Academic > Graduation (Field Signal)',
        confidence: 95,
      };
    }
    if (nameId.includes('mast_') || nameId.startsWith('mast') || nameId.includes('mas_') || nameId.includes('_mast')) {
      return {
        sectionType: 'masters_level',
        canonicalSectionName: 'Masters Degree',
        sourceSignal: 'container_id_class',
        hierarchyTrail: 'Academic > Masters (Field Signal)',
        confidence: 95,
      };
    }
    if (nameId.includes('p_') && (nameId.includes('district') || nameId.includes('upazila') || nameId.includes('thana') || nameId.includes('village') || nameId.includes('care_of'))) {
      return {
        sectionType: 'present_address',
        canonicalSectionName: 'Present Address',
        sourceSignal: 'container_id_class',
        hierarchyTrail: 'Address > Present Address (Field Signal)',
        confidence: 95,
      };
    }
    if ((nameId.includes('perm_') || nameId.includes('permanent_')) && (nameId.includes('district') || nameId.includes('upazila') || nameId.includes('thana') || nameId.includes('village') || nameId.includes('care_of'))) {
      return {
        sectionType: 'permanent_address',
        canonicalSectionName: 'Permanent Address',
        sourceSignal: 'container_id_class',
        hierarchyTrail: 'Address > Permanent Address (Field Signal)',
        confidence: 95,
      };
    }

    // 1. Ascend the DOM tree looking for enclosing section signifiers
    let current: HTMLElement | null = el.parentElement;
    let depth = 0;
    while (current && current !== document.body && depth < 12) {
      depth++;

      // Check Fieldset Legend
      if (current.tagName.toLowerCase() === 'fieldset') {
        const legend = current.querySelector('legend');
        if (legend && legend.textContent) {
          const matched = this.classifyText(legend.textContent);
          if (matched !== 'unknown') {
            return {
              sectionType: matched,
              canonicalSectionName: this.getSectionDisplayName(matched),
              sourceSignal: 'legend',
              hierarchyTrail: `Fieldset > ${legend.textContent.trim()}`,
              confidence: 90,
            };
          }
        }
      }

      // Check ARIA Group with label
      const role = current.getAttribute('role');
      if (role === 'group' || role === 'region') {
        const ariaLabel = current.getAttribute('aria-label') || '';
        const labelledBy = current.getAttribute('aria-labelledby');
        let ariaTitle = ariaLabel;
        if (!ariaTitle && labelledBy) {
          const labelEl = document.getElementById(labelledBy);
          if (labelEl) ariaTitle = labelEl.textContent || '';
        }
        if (ariaTitle) {
          const matched = this.classifyText(ariaTitle);
          if (matched !== 'unknown') {
            return {
              sectionType: matched,
              canonicalSectionName: this.getSectionDisplayName(matched),
              sourceSignal: 'aria_group',
              hierarchyTrail: `ARIA Group > ${ariaTitle.trim()}`,
              confidence: 88,
            };
          }
        }
      }

      // Check Table Row / Column Headers
      if (current.tagName.toLowerCase() === 'table') {
        const headers = Array.from(current.querySelectorAll('th, caption, .table-header'));
        for (const th of headers) {
          if (th.textContent) {
            const matched = this.classifyText(th.textContent);
            if (matched !== 'unknown') {
              return {
                sectionType: matched,
                canonicalSectionName: this.getSectionDisplayName(matched),
                sourceSignal: 'table_header',
                hierarchyTrail: `Table > ${th.textContent.trim()}`,
                confidence: 85,
              };
            }
          }
        }
      }

      // Check Headings inside immediate container
      const headings = Array.from(
        current.querySelectorAll('h1, h2, h3, h4, h5, .section-header, .panel-heading, .card-header, .box-title, .title')
      );
      for (const h of headings) {
        if (h.textContent && !h.contains(el)) {
          const matched = this.classifyText(h.textContent);
          if (matched !== 'unknown') {
            return {
              sectionType: matched,
              canonicalSectionName: this.getSectionDisplayName(matched),
              sourceSignal: 'heading',
              hierarchyTrail: `Heading > ${h.textContent.trim()}`,
              confidence: 85,
            };
          }
        }
      }

      // Check Container IDs and Classes
      const idClass = `${current.id} ${current.className}`.toLowerCase();
      const idMatch = this.classifyText(idClass);
      if (idMatch !== 'unknown') {
        return {
          sectionType: idMatch,
          canonicalSectionName: this.getSectionDisplayName(idMatch),
          sourceSignal: 'container_id_class',
          hierarchyTrail: `Container > #${current.id || current.className}`,
          confidence: 80,
        };
      }

      // Check Repeating Education Blocks (e.g. table rows or repeating cards)
      const repeatingAcademic = this.detectRepeatingBlockContext(current, el);
      if (repeatingAcademic !== 'unknown') {
        return {
          sectionType: repeatingAcademic,
          canonicalSectionName: this.getSectionDisplayName(repeatingAcademic),
          sourceSignal: 'repeating_block',
          hierarchyTrail: `Repeating Academic Block > ${repeatingAcademic}`,
          confidence: 82,
        };
      }

      current = current.parentElement;
    }

    // 2. Nearby preceding sibling heading check
    const nearbyHeading = this.findNearbyPrecedingHeading(el);
    if (nearbyHeading) {
      const matched = this.classifyText(nearbyHeading);
      if (matched !== 'unknown') {
        return {
          sectionType: matched,
          canonicalSectionName: this.getSectionDisplayName(matched),
          sourceSignal: 'nearby_heading',
          hierarchyTrail: `Preceding Heading > ${nearbyHeading}`,
          confidence: 75,
        };
      }
    }

    return {
      sectionType: 'unknown',
      canonicalSectionName: 'Unknown Section',
      sourceSignal: 'default',
      hierarchyTrail: 'Root',
      confidence: 30,
    };
  }

  /**
   * Searches for a preceding sibling heading in DOM document order
   */
  public static findNearbyPrecedingHeading(el: HTMLElement): string | null {
    let prev: Element | null = el.previousElementSibling;
    let lookback = 0;
    while (prev && lookback < 5) {
      lookback++;
      if (/^H[1-6]$/i.test(prev.tagName) || prev.matches('.section-header, .panel-heading, .card-title, legend')) {
        return prev.textContent?.trim() || null;
      }
      // Check children of previous sibling
      const heading = prev.querySelector('h1, h2, h3, h4, h5, .section-header, .panel-heading, .card-title, legend');
      if (heading) {
        return heading.textContent?.trim() || null;
      }
      prev = prev.previousElementSibling;
    }
    return null;
  }

  /**
   * Detects repeating education blocks (e.g., Row 1 = SSC, Row 2 = HSC, Row 3 = Graduation, Row 4 = Masters)
   */
  public static detectRepeatingBlockContext(container: HTMLElement, el: HTMLElement): FormSectionType {
    if (container.tagName.toLowerCase() === 'tbody' || container.tagName.toLowerCase() === 'table') {
      const rows = Array.from(container.querySelectorAll('tr'));
      const rowIndex = rows.findIndex((r) => r.contains(el));
      if (rowIndex >= 0) {
        const rowText = (rows[rowIndex].textContent || '').toLowerCase();
        if (rowText.includes('ssc') || rowText.includes('dakhil') || rowText.includes('secondary')) return 'ssc_level';
        if (rowText.includes('hsc') || rowText.includes('alim') || rowText.includes('higher secondary')) return 'hsc_level';
        if (rowText.includes('grad') || rowText.includes('bachelor') || rowText.includes('degree')) return 'graduation_level';
        if (rowText.includes('master') || rowText.includes('post graduate')) return 'masters_level';
      }
    }
    return 'unknown';
  }

  /**
   * Classifies arbitrary heading / legend / class text into a canonical FormSectionType
   */
  public static classifyText(rawText: string): FormSectionType {
    const t = rawText.toLowerCase().replace(/['’_]/g, ' ');

    // 1. Declarations & CAPTCHA (Top priority exclusion)
    if (t.includes('declaration') || t.includes('ঘোষণা') || t.includes('অঙ্গীকার') || t.includes('terms') || t.includes('শর্তাবলী') || t.includes('verification code') || t.includes('captcha')) {
      return 'applicant_declaration';
    }

    // 2. Exam Centre
    if (t.includes('exam centre') || t.includes('exam center') || t.includes('examination centre') || t.includes('পরীক্ষা কেন্দ্র') || t.includes('কেন্দ্র পছন্দ')) {
      return 'exam_centre';
    }

    // 3. Addresses: MUST separate Present from Permanent
    if (t.includes('permanent') || t.includes('স্থায়ী') || t.includes('home address') || t.includes('perm address') || t.includes('permanent address') || t.includes('নিজ ঠিকানা')) {
      return 'permanent_address';
    }
    if (t.includes('present') || t.includes('বর্তমান') || t.includes('mailing') || t.includes('current address') || t.includes('present address') || t.includes('যোগাযোগের ঠিকানা')) {
      return 'present_address';
    }

    // 4. Academic Education Levels
    // Masters first to prevent substring collision with general education
    if (t.includes('masters') || t.includes('মাস্টার্স') || t.includes('post graduate') || t.includes('স্নাতকোত্তর') || t.includes('m.sc') || t.includes('m.a') || t.includes('m.com') || t.includes('mba')) {
      return 'masters_level';
    }
    // Graduation / Bachelor
    if (t.includes('graduation') || t.includes('bachelor') || t.includes('honours') || t.includes('degree') || t.includes('স্নাতক') || t.includes('undergraduate') || t.includes('b.sc') || t.includes('b.a') || t.includes('bba')) {
      return 'graduation_level';
    }
    // HSC / Alim
    if (t.includes('hsc') || t.includes('alim') || t.includes('এইচএসসি') || t.includes('আলিম') || t.includes('higher secondary') || t.includes('উচ্চ মাধ্যমিক') || t.includes('diploma') || t.includes('ডিপ্লোমা')) {
      return 'hsc_level';
    }
    // SSC / Dakhil
    if (t.includes('ssc') || t.includes('dakhil') || t.includes('এসএসসি') || t.includes('দাখিল') || t.includes('secondary') || t.includes('মাধ্যমিক')) {
      return 'ssc_level';
    }
    if (t.includes('academic') || t.includes('education') || t.includes('qualification') || t.includes('শিক্ষাগত যোগ্যতা')) {
      return 'academic_qualifications';
    }

    // 5. Bengali Additional Information
    if (t.includes('bangla') || t.includes('বাংলা') || t.includes('additional information in bangla') || t.includes('বাংলায় তথ্য')) {
      return 'bangla_info';
    }

    // 6. Identity & Citizenship
    if (t.includes('identity') || t.includes('citizenship') || t.includes('national id') || t.includes('nid') || t.includes('পরিচয়পত্র') || t.includes('নাগরিকত্ব')) {
      return 'identity_citizenship';
    }

    // 7. Contact & Quota
    if (t.includes('quota') || t.includes('কোটা') || t.includes('freedom fighter') || t.includes('মুক্তিযোদ্ধা') || t.includes('tribal') || t.includes('প্রতিবন্ধী')) {
      return 'contact_quota';
    }
    if (t.includes('contact') || t.includes('communication') || t.includes('যোগাযোগ')) {
      return 'contact_info';
    }

    // 8. Employment
    if (t.includes('employment') || t.includes('experience') || t.includes('অভিজ্ঞতা') || t.includes('চাকরি') || t.includes('departmental') || t.includes('বিভাগীয়')) {
      return 'employment_info';
    }

    // 9. Personal Information / Applicant Details
    if (t.includes('personal') || t.includes('applicant') || t.includes('candidate') || t.includes('ব্যক্তিগত') || t.includes('প্রার্থীর তথ্য') || t.includes('আবেদনকারীর তথ্য')) {
      return 'personal_info';
    }

    return 'unknown';
  }

  public static getSectionDisplayName(type: FormSectionType): string {
    switch (type) {
      case 'personal_info':
        return 'Personal Information';
      case 'identity_citizenship':
        return 'Identity & Citizenship';
      case 'contact_info':
        return 'Contact Information';
      case 'contact_quota':
        return 'Contact & Quota';
      case 'present_address':
        return 'Present Address';
      case 'permanent_address':
        return 'Permanent Address';
      case 'academic_qualifications':
        return 'Academic Qualifications';
      case 'ssc_level':
        return 'SSC or Equivalent Level';
      case 'hsc_level':
        return 'HSC or Equivalent Level';
      case 'graduation_level':
        return "Graduation Level / Bachelor's Degree";
      case 'masters_level':
        return 'Masters Degree';
      case 'bangla_info':
        return 'Additional Information in Bangla';
      case 'employment_info':
        return 'Employment Information';
      case 'exam_centre':
        return 'Exam Centre';
      case 'applicant_declaration':
        return 'Applicant Declaration';
      default:
        return 'Unknown Section';
    }
  }
}
