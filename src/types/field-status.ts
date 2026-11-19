// JobFill BD - Universal Field Status Definitions
// 13-state Universal Status model for granular field-level diagnostics.

export type UniversalFieldStatus =
  | 'FILLED_VERIFIED'
  | 'ALREADY_CORRECT'
  | 'PARTIALLY_FILLED'
  | 'PROFILE_DATA_MISSING'
  | 'FIELD_NOT_FOUND'
  | 'AMBIGUOUS_MAPPING'
  | 'OPTION_NOT_FOUND'
  | 'OPTIONS_NOT_LOADED'
  | 'DEPENDENCY_TIMEOUT'
  | 'VALIDATION_REJECTED'
  | 'FRAMEWORK_UPDATE_FAILED'
  | 'MANUAL_SELECTION_REQUIRED'
  | 'SKIPPED_BY_USER'
  | 'UNSUPPORTED_CONTROL';

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
