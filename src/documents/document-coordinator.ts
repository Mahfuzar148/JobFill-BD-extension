// JobFill BD - Smart Document Upload Approval & Execution Coordinator
// Orchestrates detection, validation, non-destructive processed previews,
// explicit user approval gating, and verified DataTransfer upload execution.

import { DocumentCategory, DocumentMetadata } from '../types/profile';
import { DocumentUploadStatus } from '../types/field-status';
import {
  DocumentFieldDetector,
  DetectedDocumentField,
  WebsiteDocumentRequirements,
} from './document-field-detector';
import {
  DocumentRequirementValidator,
  DocumentRequirementValidationResult,
  PreparedDocumentCopy,
} from './document-requirement-validator';
import {
  DocumentUploader,
  ApprovedDocumentTransferPayload,
  DocumentUploadExecutionResult,
} from './document-uploader';
import { ImageProcessor } from '../services/image-processor';

export interface DecryptedDocumentSource {
  metadata: DocumentMetadata;
  dataUrl: string;
}

export interface DocumentApprovalItem {
  id: string;
  field: DetectedDocumentField;
  documentType: DocumentCategory | 'unknown';
  title: string;
  websiteRequirements: WebsiteDocumentRequirements;
  savedOriginal: DecryptedDocumentSource | null;
  validation: DocumentRequirementValidationResult | null;
  processedCopy: PreparedDocumentCopy | null;
  processedValidation: DocumentRequirementValidationResult | null;
  useProcessedCopy: boolean;
  isApproved: boolean; // Must require explicit user approval before upload; defaults false when invalid/missing/ambiguous
  status: DocumentUploadStatus;
  statusMessage: string;
}

export class DocumentUploadCoordinator {
  /**
   * Builds an interactive Approval Plan comparing website file inputs against saved profile documents.
   * NEVER uploads automatically!
   */
  public static async buildApprovalPlan(
    doc: Document,
    fetchDocumentFn: (type: DocumentCategory) => Promise<DecryptedDocumentSource | null>
  ): Promise<DocumentApprovalItem[]> {
    const detectedFields = DocumentFieldDetector.scanDocumentFields(doc);
    const planItems: DocumentApprovalItem[] = [];

    for (const field of detectedFields) {
      if (field.documentType === 'unknown') {
        planItems.push({
          id: field.id,
          field,
          documentType: 'unknown',
          title: field.label || 'Unknown File Input',
          websiteRequirements: field.requirements,
          savedOriginal: null,
          validation: null,
          processedCopy: null,
          processedValidation: null,
          useProcessedCopy: false,
          isApproved: false,
          status: 'Manual Upload Required',
          statusMessage: field.ambiguityReason || 'Could not determine document type cleanly.',
        });
        continue;
      }

      let saved: DecryptedDocumentSource | null = null;
      try {
        saved = await fetchDocumentFn(field.documentType);
      } catch (err: any) {
        const msg = String(err?.message || err || '');
        const isLocked = msg.includes('VAULT_LOCKED');
        planItems.push({
          id: field.id,
          field,
          documentType: field.documentType,
          title: field.label || field.documentType,
          websiteRequirements: field.requirements,
          savedOriginal: null,
          validation: null,
          processedCopy: null,
          processedValidation: null,
          useProcessedCopy: false,
          isApproved: false,
          status: isLocked ? 'Manual Upload Required' : 'Upload Failed',
          statusMessage: isLocked
            ? '🔒 Vault Locked — Open JobFill BD Dashboard and unlock with your master password, then retry.'
            : msg || `Could not read saved "${field.documentType}" document.`,
        });
        continue;
      }

      if (!saved) {
        planItems.push({
          id: field.id,
          field,
          documentType: field.documentType,
          title: field.label || field.documentType,
          websiteRequirements: field.requirements,
          savedOriginal: null,
          validation: null,
          processedCopy: null,
          processedValidation: null,
          useProcessedCopy: false,
          isApproved: false,
          status: 'Missing Document',
          statusMessage: `No saved "${field.documentType}" document found in your JobFill BD profile.`,
        });
        continue;
      }

      let rawBytes: Uint8Array | undefined;
      try {
        rawBytes = ImageProcessor.dataUrlToUint8Array(saved.dataUrl);
      } catch {
        rawBytes = undefined;
      }

      const validation = DocumentRequirementValidator.validateAgainstRequirements(
        saved.metadata,
        field.requirements,
        rawBytes
      );

      let processedCopy: PreparedDocumentCopy | null = null;
      let processedValidation: DocumentRequirementValidationResult | null = null;
      let useProcessedCopy = false;

      // If original doesn't match site specs (dimensions, size, format) but is an auto-convertible image,
      // generate a SEPARATE processed copy for user preview/approval while preserving original untouched.
      if (!validation.isValid && validation.canAutoProcess) {
        try {
          processedCopy = await DocumentRequirementValidator.createProcessedCopy(
            saved.dataUrl,
            saved.metadata,
            field.requirements
          );
          const procBytes = ImageProcessor.dataUrlToUint8Array(processedCopy.dataUrl);
          processedValidation = DocumentRequirementValidator.validateAgainstRequirements(
            {
              documentId: `${saved.metadata.documentId}_preview`,
              documentType: saved.metadata.documentType,
              fileName: processedCopy.fileName,
              mimeType: processedCopy.mimeType,
              fileSize: processedCopy.fileSize,
              width: processedCopy.width,
              height: processedCopy.height,
              createdAt: new Date().toISOString(),
              isProcessedVariant: true,
              parentDocumentId: saved.metadata.documentId,
            },
            field.requirements,
            procBytes
          );
          if (processedValidation.isValid) {
            useProcessedCopy = true;
          }
        } catch {
          processedCopy = null;
        }
      }

      const effectiveValid = useProcessedCopy ? Boolean(processedValidation?.isValid) : validation.isValid;
      const canApproveDefault = effectiveValid && !field.isAmbiguous && !field.isDuplicate;

      let status: DocumentUploadStatus = 'Ready';
      let statusMessage = 'Validated and ready for upload after your approval.';

      if (!effectiveValid) {
        status = 'Validation Failed';
        statusMessage = validation.errors[0] || 'Saved file does not meet website requirements.';
      } else if (useProcessedCopy) {
        status = 'Ready';
        statusMessage = `Processed copy prepared (${processedCopy!.width}×${processedCopy!.height} px, ${(processedCopy!.fileSize / 1024).toFixed(1)} KB) — original file preserved intact.`;
      } else if (field.isAmbiguous || field.isDuplicate) {
        status = 'Ready';
        statusMessage = field.ambiguityReason || 'Duplicate or uncertain file field — inspect carefully before approving.';
      } else if (field.requirements.requiresManualReview && field.requirements.manualReviewReason) {
        statusMessage = field.requirements.manualReviewReason;
      }

      planItems.push({
        id: field.id,
        field,
        documentType: field.documentType,
        title: field.label || field.documentType,
        websiteRequirements: field.requirements,
        savedOriginal: saved,
        validation,
        processedCopy,
        processedValidation,
        useProcessedCopy,
        isApproved: canApproveDefault,
        status,
        statusMessage,
      });
    }

    return planItems;
  }

  /**
   * Executes uploads ONLY for explicitly user-approved items and validates every attached file & DOM state.
   */
  public static async executeApprovedUploads(
    approvedItems: DocumentApprovalItem[]
  ): Promise<DocumentUploadExecutionResult[]> {
    const results: DocumentUploadExecutionResult[] = [];

    for (const item of approvedItems) {
      // Never upload unapproved or skipped items!
      if (!item.isApproved) {
        results.push({
          documentType: item.documentType,
          selector: item.field.selector,
          label: item.title,
          fileName: item.savedOriginal?.metadata.fileName || '',
          status: 'Skipped',
          fileAttached: false,
          previewObserved: false,
          message: 'Skipped by user.',
          requiresManualFallback: false,
        });
        continue;
      }

      if (item.documentType === 'unknown' || !item.savedOriginal) {
        results.push({
          documentType: item.documentType,
          selector: item.field.selector,
          label: item.title,
          fileName: '',
          status: 'Manual Upload Required',
          fileAttached: false,
          previewObserved: false,
          message: 'No matching saved document available in active profile.',
          requiresManualFallback: true,
        });
        continue;
      }

      const activeValidation = item.useProcessedCopy ? item.processedValidation : item.validation;
      if (activeValidation && !activeValidation.isValid) {
        results.push({
          documentType: item.documentType,
          selector: item.field.selector,
          label: item.title,
          fileName: item.useProcessedCopy && item.processedCopy ? item.processedCopy.fileName : item.savedOriginal.metadata.fileName,
          status: 'Validation Failed',
          fileAttached: false,
          previewObserved: false,
          message: activeValidation.errors.join(' '),
          requiresManualFallback: true,
        });
        continue;
      }

      const payload: ApprovedDocumentTransferPayload =
        item.useProcessedCopy && item.processedCopy
          ? {
              documentId: `${item.savedOriginal.metadata.documentId}_processed`,
              documentType: item.documentType,
              selector: item.field.selector,
              fileName: item.processedCopy.fileName,
              mimeType: item.processedCopy.mimeType,
              fileSize: item.processedCopy.fileSize,
              width: item.processedCopy.width,
              height: item.processedCopy.height,
              dataUrl: item.processedCopy.dataUrl,
            }
          : {
              documentId: item.savedOriginal.metadata.documentId,
              documentType: item.documentType,
              selector: item.field.selector,
              fileName: item.savedOriginal.metadata.fileName,
              mimeType: item.savedOriginal.metadata.mimeType,
              fileSize: item.savedOriginal.metadata.fileSize,
              width: item.savedOriginal.metadata.width,
              height: item.savedOriginal.metadata.height,
              dataUrl: item.savedOriginal.dataUrl,
            };

      const res = await DocumentUploader.attachApprovedDocument(item.field, payload);
      item.status = res.status;
      item.statusMessage = res.message;
      results.push(res);
    }

    return results;
  }
}
