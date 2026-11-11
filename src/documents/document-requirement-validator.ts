// JobFill BD - Dynamic Document Requirement Validator & Adaptive Copy Generator
// Validates saved documents against actual detected website rules (MIME, magic bytes, file size, width/height, aspect ratio)
// and creates separate processed copies when resizing or format conversion is needed—never altering originals.

import { DocumentMetadata } from '../types/profile';
import { WebsiteDocumentRequirements } from './document-field-detector';
import { ImageProcessor } from '../services/image-processor';

const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text',
  rtf: 'application/rtf',
  txt: 'text/plain',
  md: 'text/markdown',
};

/**
 * Infers a reliable MIME type from a file's raw MIME and extension fallback.
 */
export function inferDocumentMimeType(fileName: string, rawMimeType?: string): string {
  const normalizedRaw = (rawMimeType || '').trim().toLowerCase();
  if (normalizedRaw && normalizedRaw !== 'application/octet-stream') {
    return normalizedRaw;
  }
  const ext = (fileName.split('.').pop() || '').trim().toLowerCase();
  return EXTENSION_TO_MIME[ext] || normalizedRaw || 'application/octet-stream';
}

export interface DocumentRequirementValidationResult {
  isValid: boolean;
  needsProcessing: boolean;
  canAutoProcess: boolean;
  detectedMagicMime: string | null;
  errors: string[];
  errorsBn: string[];
  warnings: string[];
}

export interface PreparedDocumentCopy {
  fileName: string;
  mimeType: string;
  fileSize: number;
  width: number;
  height: number;
  dataUrl: string;
  isProcessedCopy: boolean;
}

export class DocumentRequirementValidator {
  /**
   * Inspects leading magic bytes of file content to determine true binary format
   */
  public static detectMagicMime(bytes: Uint8Array): string | null {
    if (!bytes || bytes.length < 4) return null;

    // JPEG: FF D8 FF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return 'image/jpeg';
    }
    // PNG: 89 50 4E 47
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
      return 'image/png';
    }
    // PDF: %PDF (25 50 44 46)
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
      return 'application/pdf';
    }
    // GIF: GIF8
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
      return 'image/gif';
    }
    // RIFF....WEBP
    if (
      bytes.length >= 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    ) {
      return 'image/webp';
    }
    // DOCX / ODT (PK ZIP container: 50 4B 03 04)
    if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
      return 'application/zip';
    }
    // Legacy DOC (OLE2 Compound File: D0 CF 11 E0)
    if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
      return 'application/msword';
    }
    // RTF ({\rtf)
    if (bytes[0] === 0x7b && bytes[1] === 0x5c && bytes[2] === 0x72 && bytes[3] === 0x74) {
      return 'application/rtf';
    }

    return null;
  }

  /**
   * Validates saved document metadata (+ optional binary bytes) against website requirements.
   */
  public static validateAgainstRequirements(
    meta: DocumentMetadata,
    reqs: WebsiteDocumentRequirements,
    rawBytes?: Uint8Array
  ): DocumentRequirementValidationResult {
    const errors: string[] = [];
    const errorsBn: string[] = [];
    const warnings: string[] = [];

    const declaredMime = (meta.mimeType || '').toLowerCase();
    const ext = (meta.fileName.split('.').pop() || '').toLowerCase();
    const isPlainTextDoc = ['txt', 'md', 'rtf'].includes(ext) || declaredMime.startsWith('text/');

    let detectedMagicMime: string | null = null;
    if (rawBytes && rawBytes.length >= 4) {
      detectedMagicMime = this.detectMagicMime(rawBytes);
      if (!detectedMagicMime && !isPlainTextDoc) {
        errors.push('File binary header is unrecognized or corrupted.');
        errorsBn.push('ফাইলের অভ্যন্তরীণ ফরম্যাট সঠিক নয় বা ফাইলটি ক্ষতিগ্রস্ত।');
      }
    }

    // Resolve ZIP-based Office formats (.docx/.odt) cleanly
    let effectiveMime = (detectedMagicMime || declaredMime).toLowerCase();
    if (detectedMagicMime === 'application/zip') {
      if (ext === 'docx') {
        effectiveMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      } else if (ext === 'odt') {
        effectiveMime = 'application/vnd.oasis.opendocument.text';
      }
    }

    // Verify if binary signature conflicts sharply with claimed MIME type
    if (detectedMagicMime && declaredMime) {
      const normalizedDecl = declaredMime === 'image/jpg' ? 'image/jpeg' : declaredMime;
      const isExpectedZipDoc = detectedMagicMime === 'application/zip' && (ext === 'docx' || ext === 'odt');
      if (!isExpectedZipDoc && detectedMagicMime !== normalizedDecl) {
        errors.push(`File content format (${detectedMagicMime}) does not match declared MIME type (${declaredMime}).`);
        errorsBn.push(`ফাইলের আসল ফরম্যাট (${detectedMagicMime}) এবং নামের ধরন (${declaredMime}) মিলছে না।`);
      }
    }

    // 1. Validate format / accept rules
    const normalizedEffMime = effectiveMime === 'image/jpg' ? 'image/jpeg' : effectiveMime;
    const isImageFile = normalizedEffMime.startsWith('image/');

    if (reqs.acceptedMimeTypes.length > 0 || reqs.acceptedExtensions.length > 0) {
      const acceptsAnyImage = reqs.acceptedMimeTypes.includes('image/*') && isImageFile;
      const mimeMatches =
        acceptsAnyImage ||
        reqs.acceptedMimeTypes.some((m) => {
          const clean = m === 'image/jpg' ? 'image/jpeg' : m;
          return clean === normalizedEffMime;
        });

      const extMatches = reqs.acceptedExtensions.some((allowedExt) => {
        if (allowedExt === 'jpg' || allowedExt === 'jpeg') {
          return ext === 'jpg' || ext === 'jpeg' || normalizedEffMime === 'image/jpeg';
        }
        return ext === allowedExt || normalizedEffMime.endsWith(`/${allowedExt}`);
      });

      if (!mimeMatches && !extMatches) {
        const expectedDesc = reqs.acceptedExtensions.join('/').toUpperCase() || reqs.acceptedMimeTypes.join(', ');
        errors.push(`Unsupported format (${meta.mimeType || ext}). Website accepts: ${expectedDesc}.`);
        errorsBn.push(`অসমর্থিত ফরম্যাট (${meta.mimeType || ext})। ওয়েবসাইটে প্রয়োজন: ${expectedDesc}।`);
      }
    }

    // 2. Validate file size (exact bytes)
    let sizeIssueOnly = false;
    if (reqs.maxSizeBytes !== null && meta.fileSize > reqs.maxSizeBytes) {
      const maxKb = (reqs.maxSizeBytes / 1024).toFixed(0);
      const curKb = (meta.fileSize / 1024).toFixed(1);
      errors.push(`File size (${curKb} KB) exceeds website maximum limit (${maxKb} KB).`);
      errorsBn.push(`ফাইল সাইজ (${curKb} KB) ওয়েবসাইটের সর্বোচ্চ সীমা (${maxKb} KB) অতিক্রম করেছে।`);
      sizeIssueOnly = true;
    }
    if (reqs.minSizeBytes !== null && meta.fileSize < reqs.minSizeBytes) {
      const minKb = (reqs.minSizeBytes / 1024).toFixed(0);
      const curKb = (meta.fileSize / 1024).toFixed(1);
      errors.push(`File size (${curKb} KB) is below website minimum limit (${minKb} KB).`);
      errorsBn.push(`ফাইল সাইজ (${curKb} KB) সর্বনিম্ন সীমা (${minKb} KB) থেকে কম।`);
    }

    // 3. Validate width & height
    let dimIssueOnly = false;
    if (reqs.requiredWidth !== null && reqs.requiredHeight !== null) {
      if (meta.width !== reqs.requiredWidth || meta.height !== reqs.requiredHeight) {
        errors.push(
          `Image dimensions must be ${reqs.requiredWidth} × ${reqs.requiredHeight} px (current: ${meta.width} × ${meta.height} px).`
        );
        errorsBn.push(
          `ছবির মাপ অবশ্যই ${reqs.requiredWidth} × ${reqs.requiredHeight} পিক্সেল হতে হবে (বর্তমান: ${meta.width} × ${meta.height})।`
        );
        dimIssueOnly = true;
      }
    } else {
      if (reqs.minWidth !== null && meta.width < reqs.minWidth) {
        errors.push(`Image width (${meta.width}px) is less than required ${reqs.minWidth}px.`);
        errorsBn.push(`ছবির প্রস্থ (${meta.width}px) ন্যূনতম ${reqs.minWidth}px হতে হবে।`);
        dimIssueOnly = true;
      }
      if (reqs.maxWidth !== null && meta.width > reqs.maxWidth) {
        errors.push(`Image width (${meta.width}px) exceeds ${reqs.maxWidth}px.`);
        errorsBn.push(`ছবির প্রস্থ (${meta.width}px) সর্বোচ্চ ${reqs.maxWidth}px-এর বেশি।`);
        dimIssueOnly = true;
      }
      if (reqs.minHeight !== null && meta.height < reqs.minHeight) {
        errors.push(`Image height (${meta.height}px) is less than required ${reqs.minHeight}px.`);
        errorsBn.push(`ছবির উচ্চতা (${meta.height}px) ন্যূনতম ${reqs.minHeight}px হতে হবে।`);
        dimIssueOnly = true;
      }
      if (reqs.maxHeight !== null && meta.height > reqs.maxHeight) {
        errors.push(`Image height (${meta.height}px) exceeds ${reqs.maxHeight}px.`);
        errorsBn.push(`ছবির উচ্চতা (${meta.height}px) সর্বোচ্চ ${reqs.maxHeight}px-এর বেশি।`);
        dimIssueOnly = true;
      }
    }

    // 4. Validate aspect ratio when dimensions are constrained
    if (reqs.requiredAspectRatio !== null && meta.width > 0 && meta.height > 0) {
      const actualRatio = meta.width / meta.height;
      if (Math.abs(actualRatio - reqs.requiredAspectRatio) > 0.03) {
        if (!dimIssueOnly) {
          errors.push(`Image aspect ratio does not match website requirement (${reqs.requiredWidth}:${reqs.requiredHeight}).`);
          errorsBn.push(`ছবির অনুপাত (aspect ratio) ওয়েবসাইটের শর্তের সাথে মিলছে না।`);
          dimIssueOnly = true;
        }
      }
    }

    if (reqs.requiresManualReview && reqs.manualReviewReason) {
      warnings.push(reqs.manualReviewReason);
    }

    // Can auto-process only when it's a decodable raster image (JPEG/PNG/WEBP/GIF) with format/size/dimension issues
    const isConvertibleImage =
      isImageFile &&
      (!rawBytes || rawBytes.length < 4 || detectedMagicMime !== null) &&
      ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(normalizedEffMime);

    const needsProcessing = errors.length > 0;
    const canAutoProcess = needsProcessing && isConvertibleImage && (sizeIssueOnly || dimIssueOnly || errors.length > 0);

    return {
      isValid: errors.length === 0,
      needsProcessing,
      canAutoProcess,
      detectedMagicMime,
      errors,
      errorsBn,
      warnings,
    };
  }

  /**
   * Generates a separate resized/converted copy tailored to website requirements.
   * Never modifies the original stored document.
   */
  public static async createProcessedCopy(
    originalDataUrl: string,
    originalMeta: DocumentMetadata,
    reqs: WebsiteDocumentRequirements
  ): Promise<PreparedDocumentCopy> {
    const targetW = reqs.requiredWidth || originalMeta.width || 300;
    const targetH = reqs.requiredHeight || originalMeta.height || (originalMeta.documentType === 'signature' ? 80 : 300);
    const maxKb = reqs.maxSizeBytes ? Math.max(10, Math.floor(reqs.maxSizeBytes / 1024)) : 100;

    // Prefer JPEG for maximum website compatibility unless website specifically restricts to PNG only
    const pngOnly =
      reqs.acceptedMimeTypes.includes('image/png') &&
      !reqs.acceptedMimeTypes.includes('image/jpeg') &&
      !reqs.acceptedMimeTypes.includes('image/jpg') &&
      !reqs.acceptedMimeTypes.includes('image/*');
    const outputFormat: 'image/jpeg' | 'image/png' = pngOnly ? 'image/png' : 'image/jpeg';

    const processed = await ImageProcessor.processAndFit(originalDataUrl, targetW, targetH, maxKb, outputFormat);
    const baseName = originalMeta.fileName.replace(/\.[^.]+$/, '');
    const ext = outputFormat === 'image/png' ? 'png' : 'jpg';

    return {
      fileName: `${baseName}_${targetW}x${targetH}.${ext}`,
      mimeType: processed.format,
      fileSize: processed.fileSize,
      width: processed.width,
      height: processed.height,
      dataUrl: processed.dataUrl,
      isProcessedCopy: true,
    };
  }
}
