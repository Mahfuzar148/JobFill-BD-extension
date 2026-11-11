// JobFill BD - Universal Field Status Definitions
// Simple, transparent 8-state model replacing confidence scores.

export type FieldStatus =
  | 'Matched'
  | 'Filled'
  | 'Already Correct'
  | 'Missing Profile Information'
  | 'Ambiguous Field'
  | 'Existing Value Conflict'
  | 'Unsupported Field'
  | 'User Confirmation Required'
  | 'Fill Failed';

export type DiagnosticFieldStatus =
  | 'Successfully Filled'
  | 'Already Correct'
  | 'Profile Information Missing'
  | 'Mapping Not Found'
  | 'Unsupported Control'
  | 'User Confirmation Required'
  | 'Fill Failed';

export interface FieldCompletenessEntry {
  fieldLabel: string;
  selector: string;
  canonicalId: string;
  status: DiagnosticFieldStatus;
  rawStatus: FieldStatus | 'PENDING' | 'SUCCESS' | 'REVERTED' | 'FAILED' | 'SKIPPED';
  proposedValue: string;
  insertedValue: string;
  reason: string;
}

export interface FieldStatusSummary {
  totalDetected: number;
  matchedCount: number;
  readyToFillCount: number;
  successfullyFilledCount: number;
  alreadyCorrectCount: number;
  missingInfoCount: number;
  ambiguousCount: number;
  conflictsCount: number;
  failedCount: number;
  unsupportedCount: number;
}

export type DocumentUploadStatus =
  | 'Ready'
  | 'Uploaded'
  | 'Validation Failed'
  | 'Manual Upload Required'
  | 'Upload Failed'
  | 'Skipped'
  | 'Missing Document';
