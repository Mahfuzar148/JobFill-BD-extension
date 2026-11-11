// JobFill BD - Final Intelligence Add-on 7: Site Validation Error Intelligence
// Scans target webpage for active client-side validation errors rendered by the recruitment portal,
// associates each error with its affected input field, and produces clear, actionable explanations.

import { safeEscape } from '../utils/dom';

export interface SiteValidationError {
  elementSelector: string;
  fieldLabel: string;
  rawErrorMessage: string;
  probableCauseEn: string;
  probableCauseBn: string;
  recommendedActionEn: string;
  recommendedActionBn: string;
}

export class SiteErrorAnalyzer {
  public static scanPageErrors(document: Document): SiteValidationError[] {
    const detectedErrors: SiteValidationError[] = [];

    // Query standard error message elements (.error, .invalid-feedback, .text-danger, [aria-invalid="true"])
    const errorContainers = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.error, .error-message, .invalid-feedback, .text-danger, .field-validation-error, span[id*="error" i], div[id*="err" i], [aria-invalid="true"]'
      )
    ).filter((el) => {
      const style = window.getComputedStyle(el);
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        (el.textContent || '').trim().length > 2
      );
    });

    for (const ec of errorContainers) {
      const errorText = (ec.textContent || '').trim();

      // Find associated input
      let targetInput: HTMLElement | null = null;
      if (ec.tagName.toLowerCase() === 'input' || ec.tagName.toLowerCase() === 'select') {
        targetInput = ec;
      } else {
        // Look in siblings or parent
        targetInput =
          ec.parentElement?.querySelector('input, select, textarea') ||
          ec.previousElementSibling as HTMLElement;
      }

      const rawLabel = targetInput ? targetInput.getAttribute('name') || targetInput.id || 'Field' : 'Form Field';
      const normErr = errorText.toLowerCase();

      let causeEn = 'The website rejected the value submitted for this field.';
      let causeBn = 'ওয়েবসাইটটি এই ফিল্ডে প্রদত্ত মান গ্রহণ করেনি।';
      let actionEn = 'Please review the input format required by the website.';
      let actionBn = 'ওয়েবসাইটের নির্দেশিকা অনুযায়ী সঠিক ফরম্যাটে তথ্য প্রদান করুন।';

      if (normErr.includes('date') || normErr.includes('তারিখ')) {
        causeEn = 'Date format discrepancy (e.g. requires DD-MM-YYYY or DD/MM/YYYY).';
        causeBn = 'তারিখের ফরম্যাটে অমিল (যেমন: DD-MM-YYYY প্রয়োজন)।';
        actionEn = 'Reformat date according to website placeholder.';
        actionBn = 'প্লেসহোল্ডারের নির্দেশনা অনুযায়ী তারিখ লিখুন।';
      } else if (normErr.includes('required') || normErr.includes('বাধ্যতামূলক') || normErr.includes('fill')) {
        causeEn = 'This field is mandatory and cannot be left empty.';
        causeBn = 'এই ফিল্ডটি পূরণ করা বাধ্যতামূলক।';
        actionEn = 'Enter the required information in your profile.';
        actionBn = 'প্রোফাইলে প্রয়োজনীয় তথ্যটি পূরণ করে নিন।';
      } else if (normErr.includes('mobile') || normErr.includes('phone') || normErr.includes('মোবাইল')) {
        causeEn = 'Mobile number must be an 11-digit Bangladesh operator number (01...).';
        causeBn = 'মোবাইল নম্বরটি ১১ ডিজিটের সঠিক বাংলাদেশি নম্বর হতে হবে।';
        actionEn = 'Verify mobile number has no spaces or country code.';
        actionBn = 'মোবাইল নম্বরে কোনো স্পেস বা অতিরিক্ত কোড ছাড়া ১১ ডিজিট দিন।';
      } else if (normErr.includes('size') || normErr.includes('dimension') || normErr.includes('pixel') || normErr.includes('পিক্সেল')) {
        causeEn = 'Photo or signature dimensions or file size exceed circular limits.';
        causeBn = 'ছবি বা স্বাক্ষরের সাইজ বা পিক্সেল মাপ নিয়োগের সীমা অতিক্রম করেছে।';
        actionEn = 'Ensure Photo is 300x300 px (max 100KB) and Signature is 300x80 px (max 60KB).';
        actionBn = 'ছবি ৩০০x৩০০ পিক্সেল এবং স্বাক্ষর ৩০০x৮০ পিক্সেল নিশ্চিত করুন।';
      }

      detectedErrors.push({
        elementSelector: targetInput ? `#${safeEscape(targetInput.id || targetInput.getAttribute('name') || '')}` : '',
        fieldLabel: rawLabel,
        rawErrorMessage: errorText,
        probableCauseEn: causeEn,
        probableCauseBn: causeBn,
        recommendedActionEn: actionEn,
        recommendedActionBn: actionBn,
      });
    }

    return detectedErrors;
  }
}
