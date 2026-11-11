// JobFill BD - Final Intelligence Add-on 4: Multi-Pass Detection Pipeline
// Executes form analysis in 7 structured, decoupled passes:
// Pass 1: Element Discovery
// Pass 2: 12-Evidence Extraction
// Pass 3: Section & Graph Contextualization
// Pass 4: Semantic Knowledge Base Matching
// Pass 5: Competing Candidate & Ambiguity Resolution
// Pass 6: Data Type & Value Compatibility Validation
// Pass 7: Final Fill Plan & Audit Report Generation

import { FieldExtractor, FieldEvidence } from '../content/field-extractor';
import { ContextAnalyzer, ContextAnalysisResult } from './context-analyzer';
import { FieldRelationshipGraph } from './relationship-graph';
import { FieldMatcher, CandidateMatchScore } from './field-matcher';
import { DecisionEngine, MatchExplanation } from './decision-engine';
import { UserProfile } from '../types/profile';
import { toCanonicalProfile } from '../content/page-scanner';
import { resolveCanonicalValue, MasterCanonicalProfile } from '../shared/types/canonical-schema';
import { FillPlanItem } from '../validation/verification-engine';

export interface MultiPassResult {
  timestamp: string;
  pass1DiscoveredCount: number;
  pass2ExtractedEvidence: FieldEvidence[];
  pass3ContextResults: ContextAnalysisResult[];
  pass4CandidateMatches: Map<string, CandidateMatchScore[]>;
  pass5Decisions: Map<string, MatchExplanation>;
  pass6ValidatedPlan: FillPlanItem[];
  pass7FinalReport: {
    totalFields: number;
    approvedCount: number;
    reviewCount: number;
    ambiguousCount: number;
    conflictCount: number;
    missingCount: number;
  };
}

export class MultiPassScanner {
  public static async execute7PassDetection(
    document: Document,
    profile: UserProfile
  ): Promise<MultiPassResult> {
    const canonicalProfile: MasterCanonicalProfile = toCanonicalProfile(profile);

    // ==========================================
    // PASS 1: Discover all visible form elements
    // ==========================================
    const allInputs = Array.from(
      document.querySelectorAll<HTMLElement>(
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), select, textarea'
      )
    ).filter((el) => FieldExtractor.isSafeEditableField(el));

    // ==========================================
    // PASS 2: Extract 12 evidences per element
    // ==========================================
    const evidences: FieldEvidence[] = allInputs.map((el) => FieldExtractor.extractEvidence(el));

    // ==========================================
    // PASS 3: Section & Relationship Graph Context
    // ==========================================
    const contextResults: ContextAnalysisResult[] = evidences.map((ev) => ContextAnalyzer.analyze(ev));

    // ==========================================
    // PASS 4: Generate Semantic Candidate Matches
    // ==========================================
    const candidatesMap = new Map<string, CandidateMatchScore[]>();
    evidences.forEach((ev) => {
      const candidates = FieldMatcher.matchField(ev);
      // Filter out graph-incompatible candidates
      const context = ContextAnalyzer.analyze(ev);
      const filtered = candidates.filter((c) =>
        FieldRelationshipGraph.isContextCompatible(c.definition.canonicalId, context.sectionCategory)
      );
      candidatesMap.set(ev.selector, filtered);
    });

    // ==========================================
    // PASS 5: Competing Candidates & Ambiguity Resolution
    // ==========================================
    const decisionsMap = new Map<string, MatchExplanation>();
    evidences.forEach((ev) => {
      const decision = DecisionEngine.decide(ev);
      decisionsMap.set(ev.selector, decision);
    });

    // ==========================================
    // PASS 6: Data Type & Value Compatibility Validation
    // ==========================================
    const planItems: FillPlanItem[] = [];
    let conflictCount = 0;
    let missingCount = 0;

    evidences.forEach((ev, idx) => {
      const decision = decisionsMap.get(ev.selector);
      if (!decision || !decision.selectedCanonicalId) return;

      const proposedVal = resolveCanonicalValue(canonicalProfile, decision.selectedCanonicalId);
      if (!proposedVal) {
        missingCount++;
      }

      const hasConflict = !!ev.currentValue && ev.currentValue !== proposedVal;
      if (hasConflict) conflictCount++;

      planItems.push({
        id: `plan_${idx}`,
        element: ev.element,
        selector: ev.selector,
        canonicalId: decision.selectedCanonicalId,
        fieldLabel: `${ev.label || ev.name} (${decision.selectedCanonicalId})`,
        proposedValue: proposedVal,
        originalValue: ev.currentValue,
        hasConflict,
        isApproved: decision.decisionTier === 'HIGH_CONFIDENCE' && !hasConflict && !!proposedVal,
        status: 'PENDING',
      });
    });

    // ==========================================
    // PASS 7: Final Mapping Report Generation
    // ==========================================
    const approvedCount = planItems.filter((p) => p.isApproved).length;
    const reviewCount = planItems.filter((p) => !p.isApproved && !p.hasConflict).length;
    const ambiguousCount = Array.from(decisionsMap.values()).filter(
      (d) => d.decisionTier === 'AMBIGUOUS'
    ).length;

    return {
      timestamp: new Date().toISOString(),
      pass1DiscoveredCount: allInputs.length,
      pass2ExtractedEvidence: evidences,
      pass3ContextResults: contextResults,
      pass4CandidateMatches: candidatesMap,
      pass5Decisions: decisionsMap,
      pass6ValidatedPlan: planItems,
      pass7FinalReport: {
        totalFields: allInputs.length,
        approvedCount,
        reviewCount,
        ambiguousCount,
        conflictCount,
        missingCount,
      },
    };
  }
}
