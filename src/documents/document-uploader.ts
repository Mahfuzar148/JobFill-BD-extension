// JobFill BD - Secure Programmatic File Uploader & Website State Verifier
// Reconstructs File from approved local bytes, assigns via DataTransfer,
// dispatches reactive events, verifies file attachment, observes website preview/errors,
// and falls back honestly to "Manual Upload Required" if blocked.

import { DocumentUploadStatus } from '../types/field-status';
import { DocumentCategory } from '../types/profile';
import { DetectedDocumentField } from './document-field-detector';
import { ImageProcessor } from '../services/image-processor';

export interface ApprovedDocumentTransferPayload {
  documentId: string;
  documentType: DocumentCategory;
  selector: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  width: number;
  height: number;
  dataUrl: string; // Transferred in-memory only for approved active tab; never logged
}

export interface DocumentUploadExecutionResult {
  documentType: DocumentCategory | 'unknown';
  selector: string;
  label: string;
  fileName: string;
  status: DocumentUploadStatus;
  fileAttached: boolean;
  previewObserved: boolean;
  websiteValidationError?: string;
  message: string;
  requiresManualFallback: boolean;
}

export class DocumentUploader {
  /**
   * Reconstructs a File instance from a Data URL payload without touching external networks or logging contents
   */
  public static buildFileFromDataUrl(dataUrl: string, fileName: string, mimeType: string): {
    file: File;
    byteLength: number;
  } {
    const bytes = ImageProcessor.dataUrlToUint8Array(dataUrl);
    // Pass underlying ArrayBuffer slice cleanly for BlobPart compatibility
    const bufferCopy = new Uint8Array(bytes.byteLength);
    bufferCopy.set(bytes);
    const file = new File([bufferCopy], fileName, {
      type: mimeType,
      lastModified: Date.now(),
    });
    return { file, byteLength: bytes.byteLength };
  }

  /**
   * Checks visible website preview images & error indicators adjacent to the file input
   */
  private static inspectWebsiteState(field: DetectedDocumentField): {
    previewObserved: boolean;
    errorMessage?: string;
  } {
    let previewObserved = false;
    let errorMessage: string | undefined;

    for (const sel of field.previewSelectors) {
      try {
        const img = document.querySelector<HTMLImageElement>(sel);
        if (img && img.src && (img.src.startsWith('blob:') || img.src.startsWith('data:image/'))) {
          const style = window.getComputedStyle(img);
          if (style.display !== 'none' && style.visibility !== 'hidden') {
            previewObserved = true;
            break;
          }
        }
      } catch {
        // Ignore invalid selectors
      }
    }

    for (const errSel of field.errorSelectors) {
      try {
        const errEl = document.querySelector<HTMLElement>(errSel);
        if (errEl) {
          const style = window.getComputedStyle(errEl);
          if (style.display === 'none' || style.visibility === 'hidden') continue;
          const text = (errEl.textContent || '').trim();
          const lower = text.toLowerCase();
          if (
            text &&
            (lower.includes('error') ||
              lower.includes('invalid') ||
              lower.includes('exceed') ||
              lower.includes('must be') ||
              lower.includes('required') ||
              lower.includes('failed') ||
              lower.includes('not allowed') ||
              lower.includes('rejected') ||
              lower.includes('সঠিক') ||
              lower.includes('ব্যর্থ') ||
              lower.includes('বেশি'))
          ) {
            errorMessage = text;
            break;
          }
        }
      } catch {
        // Ignore invalid selectors
      }
    }

    return { previewObserved, errorMessage };
  }

  /**
   * Executes programmatic File attachment via DataTransfer and verifies the actual DOM & website result.
   * Never falsely reports Uploaded if attachment failed or was reverted.
   */
  public static async attachApprovedDocument(
    field: DetectedDocumentField,
    payload: ApprovedDocumentTransferPayload
  ): Promise<DocumentUploadExecutionResult> {
    const fileInput = field.element;

    if (!fileInput || !document.body.contains(fileInput)) {
      return {
        documentType: field.documentType,
        selector: field.selector,
        label: field.label,
        fileName: payload.fileName,
        status: 'Upload Failed',
        fileAttached: false,
        previewObserved: false,
        message: 'Target file input element is no longer connected to the page.',
        requiresManualFallback: true,
      };
    }

    if (fileInput.disabled) {
      return {
        documentType: field.documentType,
        selector: field.selector,
        label: field.label,
        fileName: payload.fileName,
        status: 'Manual Upload Required',
        fileAttached: false,
        previewObserved: false,
        message: 'File input is currently disabled by website.',
        requiresManualFallback: true,
      };
    }

    // Ensure DataTransfer API exists and supports FileList assignment
    if (typeof DataTransfer === 'undefined') {
      return {
        documentType: field.documentType,
        selector: field.selector,
        label: field.label,
        fileName: payload.fileName,
        status: 'Manual Upload Required',
        fileAttached: false,
        previewObserved: false,
        message: 'Browser environment does not support programmatic DataTransfer file attachment.',
        requiresManualFallback: true,
      };
    }

    let fileObj: File;
    let expectedByteLength = payload.fileSize;
    try {
      const built = this.buildFileFromDataUrl(payload.dataUrl, payload.fileName, payload.mimeType);
      fileObj = built.file;
      expectedByteLength = built.byteLength;
    } catch (err: any) {
      return {
        documentType: field.documentType,
        selector: field.selector,
        label: field.label,
        fileName: payload.fileName,
        status: 'Upload Failed',
        fileAttached: false,
        previewObserved: false,
        message: `Could not construct File object: ${err?.message || 'Unknown error'}`,
        requiresManualFallback: true,
      };
    }

    try {
      const dt = new DataTransfer();
      dt.items.add(fileObj);

      // Assign FileList cleanly (trying direct assignment first, then native prototype descriptor)
      let assigned = false;
      try {
        fileInput.files = dt.files;
        assigned = Boolean(fileInput.files && fileInput.files.length > 0);
      } catch {
        // Fallback descriptor for strict wrappers
        const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files');
        if (desc && desc.set) {
          desc.set.call(fileInput, dt.files);
          assigned = Boolean(fileInput.files && fileInput.files.length > 0);
        }
      }

      if (!assigned) {
        return {
          documentType: field.documentType,
          selector: field.selector,
          label: field.label,
          fileName: payload.fileName,
          status: 'Manual Upload Required',
          fileAttached: false,
          previewObserved: false,
          message: 'Browser or website script blocked programmatic file assignment. Please select the file manually.',
          requiresManualFallback: true,
        };
      }

      // Reset React 16+ internal _valueTracker so React processes synthetic change event
      const tracker = (fileInput as any)._valueTracker;
      if (tracker && typeof tracker.setValue === 'function') {
        tracker.setValue('');
      }

      fileInput.dispatchEvent(new Event('input', { bubbles: true }));
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));

      // Allow host scripts/FileReader/React handlers time to validate and render preview
      await new Promise((r) => setTimeout(r, 150));

      // Verify FileList still holds the exact file we attached
      const attachedFile = fileInput.files && fileInput.files.length > 0 ? fileInput.files[0] : null;
      const isAttachedVerified =
        attachedFile !== null &&
        attachedFile.name === payload.fileName &&
        attachedFile.size === expectedByteLength;

      if (!isAttachedVerified) {
        return {
          documentType: field.documentType,
          selector: field.selector,
          label: field.label,
          fileName: payload.fileName,
          status: 'Manual Upload Required',
          fileAttached: false,
          previewObserved: false,
          message: 'Selected file was cleared or rejected by website script. Please select the file manually.',
          requiresManualFallback: true,
        };
      }

      // Observe website preview image & validation error containers
      const { previewObserved, errorMessage } = this.inspectWebsiteState(field);
      if (errorMessage) {
        return {
          documentType: field.documentType,
          selector: field.selector,
          label: field.label,
          fileName: payload.fileName,
          status: 'Validation Failed',
          fileAttached: true,
          previewObserved,
          websiteValidationError: errorMessage,
          message: `Website validation error: "${errorMessage}"`,
          requiresManualFallback: true,
        };
      }

      return {
        documentType: field.documentType,
        selector: field.selector,
        label: field.label,
        fileName: payload.fileName,
        status: 'Uploaded',
        fileAttached: true,
        previewObserved,
        message: previewObserved
          ? `File "${payload.fileName}" attached and website preview confirmed. Verify manually before submit.`
          : `File "${payload.fileName}" attached to form input. Verify upload preview before submit.`,
        requiresManualFallback: false,
      };
    } catch (err: any) {
      return {
        documentType: field.documentType,
        selector: field.selector,
        label: field.label,
        fileName: payload.fileName,
        status: 'Manual Upload Required',
        fileAttached: false,
        previewObserved: false,
        message: `Programmatic upload restricted (${err?.message || 'Security restriction'}). Please select file manually.`,
        requiresManualFallback: true,
      };
    }
  }
}
