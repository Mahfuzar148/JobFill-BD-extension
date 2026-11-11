// JobFill BD - Adaptive Mapping Memory Types & Fingerprinting
// Implements Part L of the Master Software Engineering Specification
// Learns from user-confirmed field mappings without ever storing personal values.

import { safeEscape } from '../utils/dom';

export interface FieldFingerprint {
  domain: string;
  tagName: string;
  inputType: string;
  normalizedName: string;
  normalizedId: string;
  normalizedLabel: string;
  normalizedPlaceholder: string;
  sectionContext: string;
}

export interface LearnedMappingRecord {
  fingerprintHash: string;
  domain: string;
  canonicalKey: string;
  confirmationCount: number;
  lastConfirmedAt: string;
  accuracyScore: number;
}

// Generates a normalized structural fingerprint from an HTML element
export function extractElementFingerprint(el: HTMLElement, sectionContext: string): FieldFingerprint {
  const domain = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : 'local';
  const tagName = el.tagName.toLowerCase();
  const inputType = (el.getAttribute('type') || (tagName === 'select' ? 'select' : tagName === 'textarea' ? 'textarea' : 'text')).toLowerCase();

  const rawName = el.getAttribute('name') || '';
  const rawId = el.id || '';
  const rawPlaceholder = el.getAttribute('placeholder') || '';

  // Extract nearby or associated label text
  let rawLabel = '';
  if (rawId) {
    const labelEl = document.querySelector(`label[for="${safeEscape(rawId)}"]`);
    if (labelEl) rawLabel = labelEl.textContent || '';
  }
  if (!rawLabel) {
    const parentLabel = el.closest('label');
    if (parentLabel) rawLabel = parentLabel.textContent || '';
  }
  if (!rawLabel) {
    const parentRow = el.closest('tr');
    if (parentRow) {
      const prevTd = el.closest('td')?.previousElementSibling;
      if (prevTd) rawLabel = prevTd.textContent || '';
    }
  }

  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  return {
    domain,
    tagName,
    inputType,
    normalizedName: normalize(rawName),
    normalizedId: normalize(rawId),
    normalizedLabel: normalize(rawLabel),
    normalizedPlaceholder: normalize(rawPlaceholder),
    sectionContext: sectionContext.toLowerCase().trim(),
  };
}

// Creates a deterministic string key from fingerprint for quick lookup
export function computeFingerprintKey(fp: FieldFingerprint): string {
  // Primary identifier: domain + section + tag + (name or id or label)
  const primaryKey = fp.normalizedName || fp.normalizedId || fp.normalizedLabel || fp.normalizedPlaceholder;
  return `${fp.domain}::${fp.sectionContext}::${fp.tagName}:${fp.inputType}::${primaryKey}`;
}
