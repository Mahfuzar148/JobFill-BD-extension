// JobFill BD - Final Intelligence Add-on 8: Quality Calibration Engine
// Evaluates mapping precision, recall, and reliability without storing sensitive applicant data.
// Tracks true positives, false positives, ambiguous matches, and user corrections.

export interface BenchmarkMetrics {
  totalFieldsTested: number;
  truePositives: number;
  falsePositives: number;
  ambiguousMatches: number;
  unmatchedFields: number;
  userCorrectionCount: number;
  precisionRate: number; // TP / (TP + FP)
  recallRate: number; // TP / Total relevant
  accuracyScore: number;
}

export class QualityCalibrationEngine {
  private static truePositives = 0;
  private static falsePositives = 0;
  private static ambiguousCount = 0;
  private static unmatchedCount = 0;
  private static userCorrections = 0;

  // Records mapping outcome for calibration
  public static recordMatchOutcome(
    wasCorrect: boolean,
    isAmbiguous: boolean,
    wasUnmatched: boolean,
    wasUserCorrected: boolean
  ): void {
    if (wasCorrect) this.truePositives++;
    else if (!wasUnmatched) this.falsePositives++;

    if (isAmbiguous) this.ambiguousCount++;
    if (wasUnmatched) this.unmatchedCount++;
    if (wasUserCorrected) this.userCorrections++;
  }

  // Calculates quality benchmark scores
  public static getMetrics(): BenchmarkMetrics {
    const total = this.truePositives + this.falsePositives + this.unmatchedCount;
    const precision =
      this.truePositives + this.falsePositives > 0
        ? (this.truePositives / (this.truePositives + this.falsePositives)) * 100
        : 100;

    const recall = total > 0 ? (this.truePositives / total) * 100 : 100;
    const accuracy = total > 0 ? (this.truePositives / total) * 100 : 100;

    return {
      totalFieldsTested: total,
      truePositives: this.truePositives,
      falsePositives: this.falsePositives,
      ambiguousMatches: this.ambiguousCount,
      unmatchedFields: this.unmatchedCount,
      userCorrectionCount: this.userCorrections,
      precisionRate: Math.round(precision * 10) / 10,
      recallRate: Math.round(recall * 10) / 10,
      accuracyScore: Math.round(accuracy * 10) / 10,
    };
  }

  // Resets calibration state
  public static resetMetrics(): void {
    this.truePositives = 0;
    this.falsePositives = 0;
    this.ambiguousCount = 0;
    this.unmatchedCount = 0;
    this.userCorrections = 0;
  }
}
