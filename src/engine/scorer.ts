// JobFill BD - Weighted Matching Scorer
// Implements the precision scoring model:
// - Exact HTML name match: 100
// - Exact ID match: 100
// - Exact label match: 95
// - Known Bengali/English alias: 95
// - Placeholder match: 85
// - ARIA label match: 85
// - Parent section context: 75
// - Nearby text match: 65

import { FieldDefinition } from './fieldDictionary';
import { SectionType } from './contextDetector';
import { ConfidenceLevel } from '../types/profile';
import { safeEscape } from '../utils/dom';

export interface ScoreDetails {
  totalScore: number;
  confidence: ConfidenceLevel;
  reasons: string[];
  sectionMatched: boolean;
}

function cleanStr(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[_\-.\s\/\\():,]+/g, ' ')
    .trim();
}

export function scoreFieldMatch(
  element: HTMLElement,
  def: FieldDefinition,
  detectedSection: SectionType
): ScoreDetails {
  let score = 0;
  const reasons: string[] = [];

  const nameAttr = cleanStr(element.getAttribute('name') || '');
  const idAttr = cleanStr(element.getAttribute('id') || '');
  const placeholderAttr = cleanStr(element.getAttribute('placeholder') || '');
  const ariaAttr = cleanStr(
    element.getAttribute('aria-label') || element.getAttribute('title') || ''
  );

  // Associated label text
  let labelText = '';
  if (element.id) {
    const lbl = document.querySelector(`label[for="${safeEscape(element.id)}"]`);
    if (lbl) labelText = cleanStr(lbl.textContent || '');
  }
  if (!labelText) {
    const parentLabel = element.closest('label');
    if (parentLabel) labelText = cleanStr(parentLabel.textContent || '');
  }

  // 1. Exact HTML name match (100)
  if (nameAttr && def.exactNames.some((en) => cleanStr(en) === nameAttr)) {
    score = Math.max(score, 100);
    reasons.push(`Exact HTML name match: "${nameAttr}" (100 pts)`);
  }

  // 2. Exact HTML ID match (100)
  if (idAttr && def.exactIds.some((ei) => cleanStr(ei) === idAttr)) {
    score = Math.max(score, 100);
    reasons.push(`Exact HTML ID match: "${idAttr}" (100 pts)`);
  }

  // 3. Exact / Alias Label Match (95)
  if (labelText) {
    for (const alias of def.aliases) {
      const cAlias = cleanStr(alias);
      if (labelText === cAlias) {
        score = Math.max(score, 95);
        reasons.push(`Exact label match: "${labelText}" (95 pts)`);
        break;
      } else if (labelText.includes(cAlias) || cAlias.includes(labelText)) {
        score = Math.max(score, 90);
        reasons.push(`Partial label alias match: "${alias}" (90 pts)`);
        break;
      }
    }
  }

  // 4. Placeholder Match (85)
  if (placeholderAttr) {
    for (const alias of def.aliases) {
      const cAlias = cleanStr(alias);
      if (placeholderAttr === cAlias || placeholderAttr.includes(cAlias)) {
        score = Math.max(score, 85);
        reasons.push(`Placeholder alias match: "${placeholderAttr}" (85 pts)`);
        break;
      }
    }
  }

  // 5. ARIA Label / Title Match (85)
  if (ariaAttr) {
    for (const alias of def.aliases) {
      const cAlias = cleanStr(alias);
      if (ariaAttr === cAlias || ariaAttr.includes(cAlias)) {
        score = Math.max(score, 85);
        reasons.push(`ARIA label match: "${ariaAttr}" (85 pts)`);
        break;
      }
    }
  }

  // 6. Section Context Verification & Filtering
  let sectionMatched = false;
  if (def.sectionHint) {
    if (
      (def.sectionHint === 'personal' && detectedSection === 'personal') ||
      (def.sectionHint === 'present' && detectedSection === 'present_address') ||
      (def.sectionHint === 'permanent' && detectedSection === 'permanent_address') ||
      (def.sectionHint === 'ssc' && detectedSection === 'ssc') ||
      (def.sectionHint === 'hsc' && detectedSection === 'hsc') ||
      (def.sectionHint === 'graduation' && detectedSection === 'graduation') ||
      (def.sectionHint === 'masters' && detectedSection === 'masters') ||
      (def.sectionHint === 'experience' && detectedSection === 'experience')
    ) {
      sectionMatched = true;
      score += 15; // Context bonus
      reasons.push(`Section context confirmed: "${detectedSection}" (+15 pts)`);
    } else if (detectedSection !== 'unknown') {
      // Direct section conflict penalty (e.g. SSC field found inside HSC section!)
      score -= 50;
      reasons.push(`Section mismatch penalty: Expected "${def.sectionHint}" but detected "${detectedSection}" (-50 pts)`);
    }
  }

  // Cap score to 100 max, 0 min
  const finalScore = Math.min(100, Math.max(0, score));

  // Determine Confidence Tier
  let confidence: ConfidenceLevel = 'LOW';
  if (finalScore >= 85 && (def.sectionHint ? sectionMatched : true)) {
    confidence = 'HIGH';
  } else if (finalScore >= 65) {
    confidence = 'MEDIUM';
  }

  return {
    totalScore: finalScore,
    confidence,
    reasons,
    sectionMatched,
  };
}
