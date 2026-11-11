// JobFill BD - Final Intelligence Add-on 6: Website Schema Change Detector
// Compares live DOM fields against previously recorded structural fingerprints in Adaptive Memory.
// If the website modified labels, input types, or section hierarchy, suspends outdated mappings
// and requests fresh confirmation rather than blindly filling wrong fields.

import { FieldEvidence } from '../content/field-extractor';
import { LearnedMappingRecord, computeFingerprintKey, extractElementFingerprint } from './mapping-memory';

export interface SchemaChangeReport {
  isCompatible: boolean;
  hasStructuralDrift: boolean;
  divergenceReasons: string[];
  recommendedAction: 'REUSE' | 'RE_VERIFY' | 'INVALIDATE';
}

export class SchemaChangeDetector {
  public static verifyMappingFreshness(
    liveEvidence: FieldEvidence,
    savedRecord: LearnedMappingRecord
  ): SchemaChangeReport {
    const reasons: string[] = [];
    const currentFp = extractElementFingerprint(liveEvidence.element, liveEvidence.parentContextText);
    const currentKey = computeFingerprintKey(currentFp);

    // 1. Exact Fingerprint Hash Match
    if (currentKey === savedRecord.fingerprintHash) {
      return {
        isCompatible: true,
        hasStructuralDrift: false,
        divergenceReasons: [],
        recommendedAction: 'REUSE',
      };
    }

    // 2. Structural Drift Detection
    // Input type changed (e.g. was text, now select or date)
    if (liveEvidence.inputType !== currentFp.inputType) {
      reasons.push(`Input element type changed from ${currentFp.inputType} to ${liveEvidence.inputType}`);
    }

    // Section context changed
    if (!savedRecord.fingerprintHash.includes(currentFp.sectionContext)) {
      reasons.push(`Section context shifted (Expected: ${currentFp.sectionContext})`);
    }

    // Label text drifted
    if (liveEvidence.label && !savedRecord.fingerprintHash.includes(currentFp.normalizedLabel)) {
      reasons.push(`Field label changed on website to "${liveEvidence.label}"`);
    }

    const hasDrift = reasons.length > 0;
    const isFatal = reasons.some((r) => r.includes('type changed') || r.includes('Section context shifted'));

    return {
      isCompatible: !isFatal,
      hasStructuralDrift: hasDrift,
      divergenceReasons: reasons,
      recommendedAction: isFatal ? 'INVALIDATE' : hasDrift ? 'RE_VERIFY' : 'REUSE',
    };
  }
}
