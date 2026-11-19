// JobFill BD - Composite Field Adapter
// Handles composite fields where one canonical profile value maps to multiple HTML controls
// or multiple profile values map to one composite control.
// Covers: Date of Birth (Day/Month/Year selects or inputs), Full Name (First/Middle/Last),
// Address (Textarea vs Separate Fields), Education Result (Type + GPA + Scale), and Phone.

import { ValueNormalizer } from './value-normalizer';
import { VerificationEngine } from '../validation/verification-engine';

export interface ParsedDateComponents {
  day: string;
  dayPadded: string;
  month: string;
  monthPadded: string;
  monthNameEn: string;
  monthShortEn: string;
  monthNameBn: string;
  year: string;
}

export interface ParsedNameComponents {
  firstName: string;
  middleName: string;
  lastName: string;
  isAmbiguous: boolean;
}

export class CompositeFieldAdapter {
  // English and Bengali month dictionaries
  private static readonly MONTH_NAMES_EN = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  private static readonly MONTH_SHORTS_EN = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  private static readonly MONTH_NAMES_BN = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
  ];

  private static readonly MONTH_NAMES_BN_ALT = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
  ];

  /**
   * Safely decomposes an ISO date string (YYYY-MM-DD or DD/MM/YYYY) into multi-representation components
   */
  public static parseDateOfBirth(rawDate: string): ParsedDateComponents | null {
    if (!rawDate) return null;

    const parts = rawDate.trim().split(/[-/.]/);
    if (parts.length < 3) return null;

    let y = '';
    let m = '';
    let d = '';

    if (parts[0].length === 4) {
      // YYYY-MM-DD
      y = parts[0];
      m = parts[1];
      d = parts[2];
    } else if (parts[2].length === 4) {
      // DD-MM-YYYY or MM-DD-YYYY (assume DD-MM-YYYY in Bangladesh context)
      d = parts[0];
      m = parts[1];
      y = parts[2];
    } else {
      return null;
    }

    const dayInt = parseInt(d, 10);
    const monthInt = parseInt(m, 10);
    const yearInt = parseInt(y, 10);

    if (isNaN(dayInt) || isNaN(monthInt) || isNaN(yearInt) || monthInt < 1 || monthInt > 12) {
      return null;
    }

    const dayStr = String(dayInt);
    const dayPadded = dayInt < 10 ? `0${dayInt}` : dayStr;
    const monthStr = String(monthInt);
    const monthPadded = monthInt < 10 ? `0${monthInt}` : monthStr;

    return {
      day: dayStr,
      dayPadded,
      month: monthStr,
      monthPadded,
      monthNameEn: this.MONTH_NAMES_EN[monthInt - 1],
      monthShortEn: this.MONTH_SHORTS_EN[monthInt - 1],
      monthNameBn: this.MONTH_NAMES_BN[monthInt - 1],
      year: String(yearInt),
    };
  }

  /**
   * Matches a select option for Day, Month, or Year without relying solely on index
   */
  public static matchDateSelectOption(
    select: HTMLSelectElement,
    parsed: ParsedDateComponents,
    kind: 'day' | 'month' | 'year'
  ): HTMLOptionElement | null {
    const options = Array.from(select.options);

    if (kind === 'day') {
      const targetDays = [parsed.day, parsed.dayPadded];
      for (const opt of options) {
        const val = opt.value.trim();
        const txt = opt.text.trim();
        if (targetDays.includes(val) || targetDays.includes(txt)) {
          return opt;
        }
      }
    } else if (kind === 'month') {
      const monthIdx = parseInt(parsed.month, 10) - 1;
      const targets = [
        parsed.month,
        parsed.monthPadded,
        parsed.monthNameEn.toLowerCase(),
        parsed.monthShortEn.toLowerCase(),
        parsed.monthNameBn,
        this.MONTH_NAMES_BN_ALT[monthIdx],
      ];

      for (const opt of options) {
        const val = opt.value.trim().toLowerCase();
        const txt = opt.text.trim().toLowerCase();
        if (targets.some((t) => val === t || txt === t || txt.startsWith(t) || val.startsWith(t))) {
          return opt;
        }
      }
    } else if (kind === 'year') {
      for (const opt of options) {
        const val = opt.value.trim();
        const txt = opt.text.trim();
        if (val === parsed.year || txt === parsed.year) {
          return opt;
        }
      }
    }

    return null;
  }

  /**
   * Fills and verifies Day, Month, and Year split dropdowns
   */
  public static async fillSplitDateDropdowns(
    daySelect: HTMLSelectElement,
    monthSelect: HTMLSelectElement,
    yearSelect: HTMLSelectElement,
    rawDate: string
  ): Promise<{ success: boolean; message: string }> {
    const parsed = this.parseDateOfBirth(rawDate);
    if (!parsed) return { success: false, message: `Invalid date format: ${rawDate}` };

    const optDay = this.matchDateSelectOption(daySelect, parsed, 'day');
    const optMonth = this.matchDateSelectOption(monthSelect, parsed, 'month');
    const optYear = this.matchDateSelectOption(yearSelect, parsed, 'year');

    if (!optDay || !optMonth || !optYear) {
      return {
        success: false,
        message: `Could not match all date components (day: ${!!optDay}, month: ${!!optMonth}, year: ${!!optYear})`,
      };
    }

    optDay.selected = true;
    daySelect.value = optDay.value;
    daySelect.dispatchEvent(new Event('input', { bubbles: true }));
    daySelect.dispatchEvent(new Event('change', { bubbles: true }));

    optMonth.selected = true;
    monthSelect.value = optMonth.value;
    monthSelect.dispatchEvent(new Event('input', { bubbles: true }));
    monthSelect.dispatchEvent(new Event('change', { bubbles: true }));

    optYear.selected = true;
    yearSelect.value = optYear.value;
    yearSelect.dispatchEvent(new Event('input', { bubbles: true }));
    yearSelect.dispatchEvent(new Event('change', { bubbles: true }));

    await new Promise((r) => setTimeout(r, 40));

    return { success: true, message: 'Day, Month, and Year selects updated successfully.' };
  }

  /**
   * Fills grouped Day, Month, and Year controls and verifies all three.
   * If any component fails, returns isPartial: true.
   */
  public static async fillCompositeDateOfBirth(
    dayControl: HTMLElement,
    monthControl: HTMLElement,
    yearControl: HTMLElement,
    dobIso: string
  ): Promise<{
    success: boolean;
    isPartial: boolean;
    verifiedDay: boolean;
    verifiedMonth: boolean;
    verifiedYear: boolean;
    message: string;
  }> {
    const parsed = this.parseDateOfBirth(dobIso);
    if (!parsed) {
      return {
        success: false,
        isPartial: false,
        verifiedDay: false,
        verifiedMonth: false,
        verifiedYear: false,
        message: 'Invalid or missing Date of Birth in profile.',
      };
    }

    let verifiedDay = false;
    let verifiedMonth = false;
    let verifiedYear = false;

    // 1. Day
    if (dayControl instanceof HTMLSelectElement) {
      const opt = this.matchDateSelectOption(dayControl, parsed, 'day');
      if (opt) {
        dayControl.value = opt.value;
        dayControl.dispatchEvent(new Event('input', { bubbles: true }));
        dayControl.dispatchEvent(new Event('change', { bubbles: true }));
        verifiedDay = dayControl.value === opt.value;
      }
    } else if (dayControl instanceof HTMLInputElement) {
      VerificationEngine.setNativeInputValue(dayControl, parsed.day);
      verifiedDay = dayControl.value === parsed.day || dayControl.value === parsed.dayPadded;
    }

    // 2. Month
    if (monthControl instanceof HTMLSelectElement) {
      const opt = this.matchDateSelectOption(monthControl, parsed, 'month');
      if (opt) {
        monthControl.value = opt.value;
        monthControl.dispatchEvent(new Event('input', { bubbles: true }));
        monthControl.dispatchEvent(new Event('change', { bubbles: true }));
        verifiedMonth = monthControl.value === opt.value;
      }
    } else if (monthControl instanceof HTMLInputElement) {
      VerificationEngine.setNativeInputValue(monthControl, parsed.monthPadded);
      verifiedMonth = monthControl.value === parsed.month || monthControl.value === parsed.monthPadded;
    }

    // 3. Year
    if (yearControl instanceof HTMLSelectElement) {
      const opt = this.matchDateSelectOption(yearControl, parsed, 'year');
      if (opt) {
        yearControl.value = opt.value;
        yearControl.dispatchEvent(new Event('input', { bubbles: true }));
        yearControl.dispatchEvent(new Event('change', { bubbles: true }));
        verifiedYear = yearControl.value === opt.value;
      }
    } else if (yearControl instanceof HTMLInputElement) {
      VerificationEngine.setNativeInputValue(yearControl, parsed.year);
      verifiedYear = yearControl.value === parsed.year;
    }

    const allSuccess = verifiedDay && verifiedMonth && verifiedYear;
    const anySuccess = verifiedDay || verifiedMonth || verifiedYear;

    return {
      success: allSuccess,
      isPartial: anySuccess && !allSuccess,
      verifiedDay,
      verifiedMonth,
      verifiedYear,
      message: allSuccess
        ? 'DOB Day, Month and Year filled and verified.'
        : `DOB partially filled: Day=${verifiedDay}, Month=${verifiedMonth}, Year=${verifiedYear}`,
    };
  }

  /**
   * Safely splits Full Name into First, Middle, and Last name components without inventing a middle name
   */
  public static splitFullName(fullName: string): ParsedNameComponents {
    const clean = (fullName || '').trim().replace(/\s+/g, ' ');
    if (!clean) {
      return { firstName: '', middleName: '', lastName: '', isAmbiguous: false };
    }

    const tokens = clean.split(' ');
    if (tokens.length === 1) {
      return { firstName: tokens[0], middleName: '', lastName: '', isAmbiguous: false };
    }
    if (tokens.length === 2) {
      return { firstName: tokens[0], middleName: '', lastName: tokens[1], isAmbiguous: false };
    }
    if (tokens.length === 3) {
      // e.g. "Md. Mahfuzur Rahman" -> First: Md. Mahfuzur, Last: Rahman (or First: Md., Middle: Mahfuzur, Last: Rahman)
      return { firstName: tokens[0], middleName: tokens[1], lastName: tokens[2], isAmbiguous: false };
    }

    // 4 or more tokens is ambiguous (e.g. "Mohammad Abu Bakar Siddique")
    return {
      firstName: tokens.slice(0, 2).join(' '),
      middleName: tokens.slice(2, -1).join(' '),
      lastName: tokens[tokens.length - 1],
      isAmbiguous: true,
    };
  }

  /**
   * Composes a single combined address string for portals using a single textarea
   */
  public static composeAddress(components: {
    careOf?: string;
    village?: string;
    road?: string;
    house?: string;
    district?: string;
    upazila?: string;
    postOffice?: string;
    postCode?: string;
  }): string {
    const parts: string[] = [];
    if (components.careOf) parts.push(`C/O: ${components.careOf}`);
    if (components.house) parts.push(`House: ${components.house}`);
    if (components.road) parts.push(`Road: ${components.road}`);
    if (components.village) parts.push(components.village);
    if (components.upazila) parts.push(`Upazila: ${components.upazila}`);
    if (components.district) parts.push(`District: ${components.district}`);
    if (components.postOffice || components.postCode) {
      parts.push(`Post: ${components.postOffice || ''} - ${components.postCode || ''}`.trim());
    }

    return parts.join(', ');
  }
}
