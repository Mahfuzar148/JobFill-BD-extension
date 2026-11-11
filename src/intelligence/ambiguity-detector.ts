// JobFill BD - Ambiguity Detector (Phase 12)
// Identifies when score margin between top candidate and runner-up is less than 15 points.

export interface ScoredCandidateItem {
  totalScore: number;
  [key: string]: any;
}

export class AmbiguityDetector {
  public static isAmbiguous(candidates: ScoredCandidateItem[], marginThreshold = 15): boolean {
    if (candidates.length < 2) return false;
    const sorted = [...candidates].sort((a, b) => b.totalScore - a.totalScore);
    const topScore = sorted[0].totalScore;
    const runnerUpScore = sorted[1].totalScore;

    return topScore - runnerUpScore < marginThreshold && topScore >= 65;
  }
}
