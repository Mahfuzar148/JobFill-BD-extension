// JobFill BD - Form Scanner & Form Filling Engine
// Scans active webpage, matches fields against Profile Database & Adaptive Mapping Memory,
// and fills approved fields safely with native event dispatching.
// NEVER triggers submit or irreversible actions.

import { UserProfile, FieldMatchResult, FormScanReport } from '../types/profile';
import { FIELD_DICTIONARY, FieldDefinition } from './fieldDictionary';
import { detectSectionContext } from './contextDetector';
import { scoreFieldMatch } from './scorer';
import { setSelectValue } from './dropdownMatcher';
import { extractElementFingerprint } from '../intelligence/mapping-memory';
import { MappingRepository } from '../database/mapping-repository';
import { DynamicFormHandler } from './dynamicFormHandler';
import { safeEscape } from '../utils/dom';

// Unique CSS selector generator
export function getElementSelector(el: HTMLElement): string {
  if (el.id) return `#${safeEscape(el.id)}`;
  if (el.getAttribute('name')) return `[name="${safeEscape(el.getAttribute('name')!)}"]`;

  let path = el.tagName.toLowerCase();
  let parent = el.parentElement;
  while (parent && parent !== document.body) {
    if (parent.id) {
      path = `#${safeEscape(parent.id)} > ${path}`;
      break;
    }
    const idx = Array.from(parent.children).indexOf(el) + 1;
    path = `${parent.tagName.toLowerCase()} > ${path}:nth-child(${idx})`;
    parent = parent.parentElement;
  }
  return path;
}

// Scans active DOM and produces FormScanReport
export async function scanActiveForm(profile: UserProfile): Promise<FormScanReport> {
  // Pre-activate conditional sections if applicant has matching qualifications
  DynamicFormHandler.prepareConditionalSections(document, profile);

  // Load adaptive mapping memory
  const learnedMemory = await MappingRepository.load();

  const elements = Array.from(
    document.querySelectorAll<HTMLElement>(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), select, textarea'
    )
  ).filter((el) => {
    // Only inspect visible elements
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  });

  const matches: FieldMatchResult[] = [];
  const unmatchedElements: Array<{ selector: string; label: string; placeholder: string; name: string }> = [];

  for (const el of elements) {
    const section = detectSectionContext(el);
    const fp = extractElementFingerprint(el, section);

    let bestDef: FieldDefinition | null = null;
    let highestScore = 0;
    let bestReasons: string[] = [];
    let bestConfidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';

    // Step 1: Check Adaptive Mapping Memory for confirmed match
    const learned = await MappingRepository.findMapping(fp);
    if (learned) {
      const foundDef = FIELD_DICTIONARY.find((d) => d.key === learned.canonicalKey);
      if (foundDef) {
        bestDef = foundDef;
        highestScore = learned.accuracyScore || 100;
        bestConfidence = 'HIGH';
        bestReasons = [`Learned from ${learned.confirmationCount} previous confirmation(s)`];
      }
    }

    // Step 2: Fall back to Multi-Signal Weighted Heuristic Scoring
    if (!bestDef) {
      for (const def of FIELD_DICTIONARY) {
        const { totalScore, confidence, reasons } = scoreFieldMatch(el, def, section);
        if (totalScore > highestScore) {
          highestScore = totalScore;
          bestDef = def;
          bestReasons = reasons;
          bestConfidence = confidence;
        }
      }
    }

    const currentValue = (el as HTMLInputElement).value || '';
    const selector = getElementSelector(el);

    if (bestDef && highestScore >= 65) {
      const proposedValue = bestDef.valueExtractor(profile) || '';

      matches.push({
        element: el,
        selector,
        fieldKey: bestDef.key,
        fieldLabel: `${bestDef.labelEn} (${bestDef.labelBn})`,
        sectionContext: section,
        proposedValue,
        currentValue,
        confidence: bestConfidence,
        score: highestScore,
        matchReason: bestReasons.join(' | '),
        isApproved: bestConfidence === 'HIGH' && !!proposedValue,
        isFilled: false,
        requiresConfirmation: bestConfidence === 'MEDIUM' || (!!currentValue && currentValue !== proposedValue),
      });
    } else {
      unmatchedElements.push({
        selector,
        label: el.getAttribute('aria-label') || '',
        placeholder: el.getAttribute('placeholder') || '',
        name: el.getAttribute('name') || el.id || '',
      });
    }
  }

  return {
    timestamp: new Date().toISOString(),
    url: window.location.href,
    siteAdapter: 'generic',
    totalFieldsFound: elements.length,
    highConfidenceCount: matches.filter((m) => m.confidence === 'HIGH').length,
    mediumConfidenceCount: matches.filter((m) => m.confidence === 'MEDIUM').length,
    lowConfidenceCount: matches.filter((m) => m.confidence === 'LOW').length,
    unmatchedCount: unmatchedElements.length,
    matches,
    unmatchedElements,
  };
}

// Native event simulation for reactive inputs
function setInputValueNative(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const isInput = input.tagName.toLowerCase() === 'input';
  const prototype = isInput ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

  if (descriptor && descriptor.set) {
    descriptor.set.call(input, value);
  } else {
    input.value = value;
  }

  // Dispatch events
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dispatchEvent(new Event('blur', { bubbles: true }));
}

// Converts date from profile (YYYY-MM-DD) to input format (DD-MM-YYYY or YYYY-MM-DD)
function formatBirthDate(rawDate: string, inputType: string, placeholder: string): string {
  if (!rawDate) return '';
  if (inputType === 'date') return rawDate; // Standard HTML5 date takes YYYY-MM-DD

  const parts = rawDate.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    if (placeholder.toLowerCase().includes('dd') || placeholder.includes('-')) {
      return `${d}-${m}-${y}`;
    }
  }
  return rawDate;
}

// Highlights element on webpage
function highlightElement(el: HTMLElement): void {
  const originalTransition = el.style.transition;
  const originalBg = el.style.backgroundColor;
  const originalOutline = el.style.outline;

  el.style.transition = 'all 0.4s ease';
  el.style.backgroundColor = '#dcfce7'; // Light Emerald Green
  el.style.outline = '2px solid #16a34a';

  setTimeout(() => {
    el.style.backgroundColor = originalBg;
    el.style.outline = originalOutline;
    el.style.transition = originalTransition;
  }, 2500);
}

// Fills all approved fields safely and trains adaptive mapping memory
export async function fillApprovedFields(matches: FieldMatchResult[]): Promise<{
  successCount: number;
  failedCount: number;
}> {
  let successCount = 0;
  let failedCount = 0;

  for (const match of matches) {
    if (!match.isApproved || !match.proposedValue) continue;

    const el = match.element;
    const tag = el.tagName.toLowerCase();
    let success = false;

    try {
      if (tag === 'select') {
        success = setSelectValue(el as HTMLSelectElement, match.proposedValue);
      } else if (tag === 'input' || tag === 'textarea') {
        const input = el as HTMLInputElement | HTMLTextAreaElement;
        const inputType = (input.getAttribute('type') || 'text').toLowerCase();

        let valToSet = match.proposedValue;
        if (match.fieldKey === 'personal.dob') {
          valToSet = formatBirthDate(valToSet, inputType, input.getAttribute('placeholder') || '');
        }

        setInputValueNative(input, valToSet);
        success = true;
      }

      if (success) {
        match.isFilled = true;
        successCount++;
        highlightElement(el);

        // Train Adaptive Mapping Memory with user-confirmed approval
        try {
          const fp = extractElementFingerprint(el, match.sectionContext);
          MappingRepository.recordConfirmation(fp, match.fieldKey);
        } catch (memErr) {
          console.warn('JobFill BD: Could not record mapping confirmation', memErr);
        }
      } else {
        failedCount++;
      }
    } catch (e) {
      console.error('JobFill BD: Failed to fill field', match.fieldKey, e);
      failedCount++;
    }
  }

  // Handle "Same as Present Address" checkbox on target page
  handleSameAddressCheckbox();

  return { successCount, failedCount };
}

function handleSameAddressCheckbox() {
  const sameChk = document.querySelector<HTMLInputElement>(
    'input[type="checkbox"][id*="same" i], input[type="checkbox"][name*="same" i]'
  );
  if (sameChk && !sameChk.checked) {
    // We let user see it, or click it if permitted
  }
}
