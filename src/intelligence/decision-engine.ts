// JobFill BD - Layer 3: Decision Engine & Ambiguity Detector
// Implements Part G of Master Engineering Specification:
// Classifies candidates into HIGH, MEDIUM, LOW, and AMBIGUOUS tiers.
// Emits MatchExplanation with full audit trail of evidence and alternatives.

import { FieldEvidence } from '../content/field-extractor';
import { FieldMatcher, CandidateMatchScore } from './field-matcher';
import { ContextAnalyzer } from './context-analyzer';

export type DecisionTier = 'HIGH_CONFIDENCE' | 'MEDIUM_CONFIDENCE' | 'LOW_CONFIDENCE' | 'AMBIGUOUS';

export interface MatchExplanation {
  detectedLabel: string;
  elementSelector: string;
  selectedCanonicalId: string | null;
  matchScore: number;
  decisionTier: DecisionTier;
  confidencePercent: number;
  hierarchyContext: string;
  supportingEvidence: string[];
  penalties: Array<{ reason: string; deduction: number }>;
  alternativeCandidates: Array<{ canonicalId: string; score: number }>;
  isSafeToAutofill: boolean;
  requiresUserConfirmation: boolean;
  rejectionReason?: string;
}

export class DecisionEngine {
  private static readonly HIGH_THRESHOLD = 60;
  private static readonly MEDIUM_THRESHOLD = 40;
  private static readonly MIN_SAFE_MARGIN = 15; // If top - second < 15, mark as ambiguous

  public static decide(evidence: FieldEvidence): MatchExplanation {
    const candidates = FieldMatcher.matchField(evidence);
    const context = ContextAnalyzer.analyze(evidence);

    if (candidates.length === 0) {
      return {
        detectedLabel: evidence.label || evidence.name || evidence.id,
        elementSelector: evidence.selector,
        selectedCanonicalId: null,
        matchScore: 0,
        decisionTier: 'LOW_CONFIDENCE',
        confidencePercent: 0,
        hierarchyContext: context.hierarchyPath,
        supportingEvidence: [],
        penalties: [],
        alternativeCandidates: [],
        isSafeToAutofill: false,
        requiresUserConfirmation: true,
        rejectionReason: 'No matching canonical field identified in knowledge base.',
      };
    }

    const topCandidate = candidates[0];
    const secondCandidate = candidates.length > 1 ? candidates[1] : null;

    // Check for Ambiguity: if second best candidate is close in score
    let isAmbiguous = false;
    if (secondCandidate && topCandidate.totalScore >= this.MEDIUM_THRESHOLD) {
      const scoreDiff = topCandidate.totalScore - secondCandidate.totalScore;
      if (scoreDiff < this.MIN_SAFE_MARGIN) {
        isAmbiguous = true;
      }
    }

    let tier: DecisionTier = 'LOW_CONFIDENCE';
    let isSafe = false;
    let requiresConfirm = true;

    // If unambiguous candidate exists, select it
    if (isAmbiguous) {
      tier = 'AMBIGUOUS';
      isSafe = false;
      requiresConfirm = true;
    } else if (topCandidate.totalScore > 0) {
      tier = 'HIGH_CONFIDENCE';
      isSafe = true;
      requiresConfirm = false;
    } else {
      tier = 'LOW_CONFIDENCE';
      isSafe = false;
      requiresConfirm = true;
    }

    const alternatives = candidates.slice(1, 4).map((c) => ({
      canonicalId: c.definition.canonicalId,
      score: c.totalScore,
    }));

    return {
      detectedLabel: evidence.label || evidence.name || evidence.id,
      elementSelector: evidence.selector,
      selectedCanonicalId: !isAmbiguous && topCandidate.totalScore > 0 ? topCandidate.definition.canonicalId : null,
      matchScore: topCandidate.totalScore,
      decisionTier: tier,
      confidencePercent: topCandidate.totalScore,
      hierarchyContext: context.hierarchyPath,
      supportingEvidence: topCandidate.supportingEvidence,
      penalties: topCandidate.penalties,
      alternativeCandidates: alternatives,
      isSafeToAutofill: isSafe,
      requiresUserConfirmation: requiresConfirm,
      rejectionReason:
        tier === 'LOW_CONFIDENCE'
          ? 'Score below threshold (<65). Safe filling prohibited.'
          : tier === 'AMBIGUOUS'
          ? `Ambiguous between ${topCandidate.definition.canonicalId} and ${secondCandidate?.definition.canonicalId}. Requires manual selection.`
          : undefined,
    };
  }
}
