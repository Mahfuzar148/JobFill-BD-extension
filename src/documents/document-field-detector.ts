// JobFill BD - Document Field & Website Requirement Detector
// Identifies input[type="file"] elements semantically (English + Bangla + Site Adapters),
// extracts actual DOM/instruction constraints without inventing missing specs,
// and detects preview & error containers for post-upload verification.

import { DocumentCategory } from '../types/profile';
import { resolveSiteAdapter } from '../adapters/adapter-registry';
import { DocumentFieldMappingRule } from '../adapters/types';
import { safeEscape } from '../utils/dom';

export interface WebsiteDocumentRequirements {
  acceptAttribute: string;
  acceptedMimeTypes: string[];
  acceptedExtensions: string[];
  requiredWidth: number | null;
  requiredHeight: number | null;
  minWidth: number | null;
  maxWidth: number | null;
  minHeight: number | null;
  maxHeight: number | null;
  maxSizeBytes: number | null;
  minSizeBytes: number | null;
  requiredAspectRatio: number | null;
  instructionText: string;
  websiteValidationMessages: string[];
  requirementsDetected: boolean;
  requiresManualReview: boolean;
  manualReviewReason?: string;
}

export interface DetectedDocumentField {
  id: string;
  element: HTMLInputElement;
  selector: string;
  documentType: DocumentCategory | 'unknown';
  canonicalKey: string; // e.g. 'profile.documents.photo' | 'profile.documents.signature'
  label: string;
  sectionHeading: string;
  accept: string;
  isAmbiguous: boolean;
  ambiguityReason?: string;
  isDuplicate: boolean;
  requirements: WebsiteDocumentRequirements;
  previewSelectors: string[];
  errorSelectors: string[];
  matchedSignals: string[];
}

export const DOCUMENT_SEMANTIC_RULES: DocumentFieldMappingRule[] = [
  {
    canonicalKey: 'profile.documents.photo',
    documentType: 'photo',
    fieldNames: ['photo', 'photo_file', 'applicant_photo', 'candidate_photo', 'picture', 'image', 'photograph', 'avatar', 'file_photo', 'upload_photo'],
    fieldIds: ['photo', 'photo_file', 'applicant_photo', 'candidate_photo', 'file_photo', 'img_photo', 'upload_photo', 'txt_photo'],
    labelKeywords: [
      'photograph',
      'photo',
      'applicant photo',
      'applicant photograph',
      'recent photograph',
      'passport size photo',
      'passport photo',
      'candidate photo',
      'ছবি',
      'প্রার্থীর ছবি',
      'পাসপোর্ট সাইজের ছবি',
      'সদ্য তোলা ছবি',
      'আবেদনকারীর ছবি',
    ],
  },
  {
    canonicalKey: 'profile.documents.signature',
    documentType: 'signature',
    fieldNames: ['signature', 'sign', 'sig', 'sign_file', 'sig_file', 'applicant_signature', 'candidate_signature', 'file_sign', 'upload_signature'],
    fieldIds: ['signature', 'sign', 'sig', 'sign_file', 'sig_file', 'applicant_signature', 'candidate_signature', 'file_sign', 'upload_signature', 'txt_sig'],
    labelKeywords: [
      'signature',
      'applicant signature',
      'candidate signature',
      'specimen signature',
      'sign',
      'স্বাক্ষর',
      'প্রার্থীর স্বাক্ষর',
      'আবেদনকারীর স্বাক্ষর',
      'দস্তখত',
    ],
  },
  {
    canonicalKey: 'profile.documents.nid',
    documentType: 'nid',
    fieldNames: ['nid', 'nid_file', 'nid_doc', 'national_id_file', 'nid_copy', 'smart_card'],
    fieldIds: ['nid', 'nid_file', 'nid_doc', 'national_id_file', 'nid_copy'],
    labelKeywords: ['nid', 'national id', 'smart card', 'nid copy', 'জাতীয় পরিচয়পত্র', 'এনআইডি'],
  },
  {
    canonicalKey: 'profile.documents.birthCertificate',
    documentType: 'birth_certificate',
    fieldNames: ['birth_cert', 'birth_certificate', 'breg_file', 'birth_doc'],
    fieldIds: ['birth_cert', 'birth_certificate', 'breg_file', 'birth_doc'],
    labelKeywords: ['birth certificate', 'birth registration', 'জন্ম নিবন্ধন', 'জন্ম সনদ'],
  },
  {
    canonicalKey: 'profile.documents.educationalCertificate',
    documentType: 'educational_certificate',
    fieldNames: ['certificate', 'edu_cert', 'transcript', 'marksheet', 'ssc_cert', 'hsc_cert', 'grad_cert'],
    fieldIds: ['certificate', 'edu_cert', 'transcript', 'marksheet', 'ssc_cert', 'hsc_cert', 'grad_cert'],
    labelKeywords: ['educational certificate', 'certificate', 'transcript', 'marksheet', 'সনদ', 'মার্কশিট'],
  },
  {
    canonicalKey: 'profile.documents.cv',
    documentType: 'cv',
    fieldNames: ['cv', 'resume', 'cv_file', 'resume_file', 'curriculum_vitae', 'cover_letter', 'biodata', 'file_cv'],
    fieldIds: ['cv', 'resume', 'cv_file', 'resume_file', 'curriculum_vitae', 'cover_letter', 'biodata', 'file_cv'],
    labelKeywords: [
      'cv / resume',
      'cv/resume',
      'resume',
      'curriculum vitae',
      'cv',
      'bio-data',
      'biodata',
      'cover letter',
      'জীবনবৃত্তান্ত',
      'সিভি',
    ],
  },
  {
    canonicalKey: 'profile.documents.other',
    documentType: 'other',
    fieldNames: ['other_doc', 'attachment', 'supporting_doc', 'document'],
    fieldIds: ['other_doc', 'attachment', 'supporting_doc'],
    labelKeywords: ['other document', 'supporting document', 'attachment', 'অন্যান্য কাগজপত্র', 'সংযুক্তি'],
  },
];

export class DocumentFieldDetector {
  /**
   * Computes a unique CSS selector for a file input element
   */
  public static computeSelector(el: HTMLInputElement, indexFallback: number): string {
    if (el.id) return `#${safeEscape(el.id)}`;
    const name = el.getAttribute('name');
    if (name) return `input[type="file"][name="${safeEscape(name)}"]`;
    return `input[type="file"]:nth-of-type(${indexFallback + 1})`;
  }

  /**
   * Checks if element is visible or interactive
   */
  private static isAccessibleFileInput(el: HTMLInputElement): boolean {
    if (el.disabled) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') {
      // Allow label-wrapped custom inputs if an enclosing label/dropzone is visible
      const labelFor = el.id ? document.querySelector(`label[for="${safeEscape(el.id)}"]`) : null;
      const parentLabel = el.closest('label');
      const proxy = labelFor || parentLabel;
      if (!proxy) return false;
      const proxyStyle = window.getComputedStyle(proxy);
      if (proxyStyle.display === 'none' || proxyStyle.visibility === 'hidden') return false;
    }
    return true;
  }

  /**
   * Extracts label, heading, nearby instruction text, and validation messages around a file input
   */
  public static extractContext(el: HTMLInputElement): {
    label: string;
    sectionHeading: string;
    instructionText: string;
    validationMessages: string[];
    container: HTMLElement | null;
  } {
    let label = '';
    if (el.id) {
      const lbl = document.querySelector(`label[for="${safeEscape(el.id)}"]`);
      if (lbl) label = (lbl.textContent || '').trim();
    }
    if (!label) {
      const parentLbl = el.closest('label');
      if (parentLbl) label = (parentLbl.textContent || '').trim();
    }
    const ariaLabel = (el.getAttribute('aria-label') || '').trim();
    const title = (el.getAttribute('title') || '').trim();

    // Check table row or form-group container
    const td = el.closest('td');
    if (td && !label) {
      let prev = td.previousElementSibling;
      while (prev && !/[a-zA-Z0-9\u0980-\u09FF]/.test(prev.textContent || '')) {
        prev = prev.previousElementSibling;
      }
      if (prev) label = (prev.textContent || '').trim();
    }

    const rowContainer = el.closest('tr, .form-group, .upload-box, .doc-row, .field-row, fieldset, .card') as HTMLElement | null;
    if (!label && rowContainer) {
      const lblCandidate = rowContainer.querySelector('label, .label, .field-label, strong, th');
      if (lblCandidate) label = (lblCandidate.textContent || '').trim();
    }
    if (!label) label = ariaLabel || title;

    // Walk up for section heading
    let sectionHeading = '';
    let curr: HTMLElement | null = el.parentElement;
    for (let d = 0; d < 7 && curr && curr !== document.body; d++) {
      const prevSib = curr.previousElementSibling;
      if (prevSib && prevSib.matches('legend, .edu-header, .form-header-bar, .section-title, h1, h2, h3, h4, h5')) {
        sectionHeading = (prevSib.textContent || '').trim();
        break;
      }
      const sub = curr.querySelectorAll('.upload-box, .doc-row, tr');
      if (sub.length <= 2) {
        const hd = curr.querySelector('legend, .edu-header, .form-header-bar, .section-title, .card-title, h1, h2, h3, h4, h5');
        if (hd) {
          sectionHeading = (hd.textContent || '').trim();
          break;
        }
      }
      curr = curr.parentElement;
    }

    // Gather nearby instruction text strictly from this control's immediate cell/container (plus adjacent non-input sibling cell)
    const container = (td || rowContainer || el.parentElement) as HTMLElement | null;
    let instructionText = '';
    const validationMessages: string[] = [];

    if (container) {
      let combined = (container.textContent || '').replace(/\s+/g, ' ').trim();
      if (td && td.nextElementSibling && !td.nextElementSibling.querySelector('input[type="file"]')) {
        combined = `${combined} ${(td.nextElementSibling.textContent || '').replace(/\s+/g, ' ').trim()}`.trim();
      }
      instructionText = [combined, title, el.getAttribute('data-hint') || ''].filter(Boolean).join(' ').trim();

      const msgScope = rowContainer || container;
      const errEls = msgScope.querySelectorAll('.error, .invalid-feedback, .text-danger, .validation-msg, [id*="error" i]');
      errEls.forEach((errEl) => {
        if (!errEl.querySelector('input[type="file"]') && (container.contains(errEl) || !td)) {
          const t = (errEl.textContent || '').trim();
          if (t) validationMessages.push(t);
        }
      });
    } else if (title) {
      instructionText = title;
    }

    return {
      label: label.replace(/\s+/g, ' ').trim(),
      sectionHeading,
      instructionText,
      validationMessages,
      container,
    };
  }

  /**
   * Parses actual website image/document constraints strictly from accept attribute & nearby text.
   * Never invents missing requirements.
   */
  public static extractRequirements(
    el: HTMLInputElement,
    instructionText: string,
    validationMessages: string[]
  ): WebsiteDocumentRequirements {
    const acceptAttr = (el.getAttribute('accept') || '').trim();
    const acceptedMimeTypes: string[] = [];
    const acceptedExtensions: string[] = [];

    const addExt = (ext: string) => {
      const clean = ext.trim().toLowerCase().replace(/^\./, '');
      if (clean && !acceptedExtensions.includes(clean)) {
        acceptedExtensions.push(clean);
      }
    };
    const addMime = (mime: string) => {
      const clean = mime.trim().toLowerCase();
      if (clean && !acceptedMimeTypes.includes(clean)) {
        acceptedMimeTypes.push(clean);
      }
    };

    if (acceptAttr) {
      acceptAttr
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
        .forEach((token) => {
          if (token.startsWith('.')) {
            addExt(token);
          } else if (token.includes('/')) {
            addMime(token);
            if (token === 'image/jpeg' || token === 'image/jpg') {
              addExt('jpg');
              addExt('jpeg');
            } else if (token === 'image/png') {
              addExt('png');
            } else if (token === 'application/pdf') {
              addExt('pdf');
            } else if (token === 'application/msword') {
              addExt('doc');
            } else if (token === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
              addExt('docx');
            } else if (token === 'application/vnd.oasis.opendocument.text') {
              addExt('odt');
            } else if (token === 'application/rtf' || token === 'text/rtf') {
              addExt('rtf');
            } else if (token === 'text/plain') {
              addExt('txt');
            }
          }
        });
    }

    const textLower = (instructionText || '').toLowerCase();

    // Parse format mentions from nearby instruction text if present
    const formatPatterns: Array<{ regex: RegExp; mime: string; ext: string }> = [
      { regex: /\bjpg\b|\bjpeg\b/i, mime: 'image/jpeg', ext: 'jpg' },
      { regex: /\bpng\b/i, mime: 'image/png', ext: 'png' },
      { regex: /\bpdf\b/i, mime: 'application/pdf', ext: 'pdf' },
    ];
    for (const fp of formatPatterns) {
      if (fp.regex.test(instructionText)) {
        if (!acceptedMimeTypes.includes(fp.mime) && !acceptAttr) {
          acceptedMimeTypes.push(fp.mime);
        }
        if (!acceptedExtensions.includes(fp.ext) && !acceptAttr) {
          acceptedExtensions.push(fp.ext);
        }
      }
    }

    // Parse explicit dimensions e.g. "300 x 300", "300×80 pixel", "width 300 height 300"
    let requiredWidth: number | null = null;
    let requiredHeight: number | null = null;
    let minWidth: number | null = null;
    let maxWidth: number | null = null;
    let minHeight: number | null = null;
    let maxHeight: number | null = null;

    const dimMatch = instructionText.match(/(\d{2,4})\s*[x×*]\s*(\d{2,4})\s*(?:px|pixel|pixels)?/i);
    if (dimMatch) {
      requiredWidth = parseInt(dimMatch[1], 10);
      requiredHeight = parseInt(dimMatch[2], 10);
    } else {
      const wMatch = instructionText.match(/width\s*[:=-]?\s*(\d{2,4})\s*(?:px|pixel)?/i);
      const hMatch = instructionText.match(/height\s*[:=-]?\s*(\d{2,4})\s*(?:px|pixel)?/i);
      if (wMatch) requiredWidth = parseInt(wMatch[1], 10);
      if (hMatch) requiredHeight = parseInt(hMatch[1], 10);
    }

    const minDimAttrW = el.getAttribute('data-min-width');
    const maxDimAttrW = el.getAttribute('data-max-width');
    const minDimAttrH = el.getAttribute('data-min-height');
    const maxDimAttrH = el.getAttribute('data-max-height');
    if (minDimAttrW) minWidth = parseInt(minDimAttrW, 10);
    if (maxDimAttrW) maxWidth = parseInt(maxDimAttrW, 10);
    if (minDimAttrH) minHeight = parseInt(minDimAttrH, 10);
    if (maxDimAttrH) maxHeight = parseInt(maxDimAttrH, 10);

    // Parse maximum file size (KB or MB)
    let maxSizeBytes: number | null = null;
    let minSizeBytes: number | null = null;

    const dataMaxKb = el.getAttribute('data-max-kb') || el.getAttribute('data-max-size-kb');
    if (dataMaxKb) {
      maxSizeBytes = Math.round(parseFloat(dataMaxKb) * 1024);
    } else {
      const maxMatch = textLower.match(
        /(?:max(?:imum)?(?:\s+file)?(?:\s+size)?|not\s+more\s+than|up\s*to|<=|within|সর্বোচ্চ|অনধিক)\s*[:=-]?\s*(\d+(?:\.\d+)?)\s*(kb|mb|kilobytes?|megabytes?|কিলোবাইট|মেগাবাইট)/i
      ) || textLower.match(/(\d+(?:\.\d+)?)\s*(kb|mb)\s*(?:max|maximum|limit|or\s+less)/i);

      if (maxMatch) {
        const num = parseFloat(maxMatch[1]);
        const unit = maxMatch[2].toLowerCase();
        if (unit.startsWith('m') || unit.includes('মেগা')) {
          maxSizeBytes = Math.round(num * 1024 * 1024);
        } else {
          maxSizeBytes = Math.round(num * 1024);
        }
      }
    }

    const minMatch = textLower.match(
      /(?:min(?:imum)?(?:\s+file)?(?:\s+size)?|at\s*least|>=)\s*[:=-]?\s*(\d+(?:\.\d+)?)\s*(kb|mb)/i
    );
    if (minMatch) {
      const num = parseFloat(minMatch[1]);
      const unit = minMatch[2].toLowerCase();
      minSizeBytes = unit.startsWith('m') ? Math.round(num * 1024 * 1024) : Math.round(num * 1024);
    }

    const requiredAspectRatio =
      requiredWidth && requiredHeight && requiredHeight > 0
        ? Number((requiredWidth / requiredHeight).toFixed(4))
        : null;

    const hasFormatReq = acceptedMimeTypes.length > 0 || acceptedExtensions.length > 0;
    const hasDimReq = requiredWidth !== null || requiredHeight !== null || minWidth !== null || maxWidth !== null;
    const hasSizeReq = maxSizeBytes !== null || minSizeBytes !== null;

    const requirementsDetected = hasFormatReq || hasDimReq || hasSizeReq;
    const requiresManualReview = !hasDimReq || !hasSizeReq;

    let manualReviewReason: string | undefined;
    if (!requirementsDetected) {
      manualReviewReason = 'Website upload requirements are not specified in HTML. Please verify manually before uploading.';
    } else if (requiresManualReview) {
      const missingParts: string[] = [];
      if (!hasDimReq) missingParts.push('image dimensions');
      if (!hasSizeReq) missingParts.push('maximum file size');
      manualReviewReason = `Website did not specify ${missingParts.join(' or ')}; review carefully before approving upload.`;
    }

    return {
      acceptAttribute: acceptAttr,
      acceptedMimeTypes,
      acceptedExtensions,
      requiredWidth,
      requiredHeight,
      minWidth,
      maxWidth,
      minHeight,
      maxHeight,
      maxSizeBytes,
      minSizeBytes,
      requiredAspectRatio,
      instructionText,
      websiteValidationMessages: validationMessages,
      requirementsDetected,
      requiresManualReview,
      manualReviewReason,
    };
  }

  /**
   * Resolves preview image containers and validation message elements associated with a file input
   */
  private static findAssociatedUiSelectors(el: HTMLInputElement, docType: DocumentCategory | 'unknown', container: HTMLElement | null): {
    previewSelectors: string[];
    errorSelectors: string[];
  } {
    const previewSelectors: string[] = [];
    const errorSelectors: string[] = [];

    if (container) {
      container.querySelectorAll('img').forEach((img) => {
        if (img.id) previewSelectors.push(`#${safeEscape(img.id)}`);
      });
      container.querySelectorAll('.error, .invalid-feedback, .text-danger, [id*="error" i], [id*="status" i], .upload-status').forEach((errEl) => {
        if (errEl.id) errorSelectors.push(`#${safeEscape(errEl.id)}`);
      });
    }

    if (docType === 'photo') {
      previewSelectors.push('#photo_preview', 'img[id*="photo" i]', '.photo-preview img');
      errorSelectors.push('#photo_error', '#photo_status');
    } else if (docType === 'signature') {
      previewSelectors.push('#sig_preview', '#signature_preview', 'img[id*="sig" i]', '.signature-preview img');
      errorSelectors.push('#sig_error', '#signature_error', '#sig_status');
    }

    return {
      previewSelectors: Array.from(new Set(previewSelectors)),
      errorSelectors: Array.from(new Set(errorSelectors)),
    };
  }

  /**
   * Scans the current document for all accessible input[type="file"] elements and classifies them semantically.
   * Never classifies by DOM position alone.
   */
  public static scanDocumentFields(doc: Document = document): DetectedDocumentField[] {
    const fileInputs = Array.from(doc.querySelectorAll<HTMLInputElement>('input[type="file"]')).filter((el) =>
      this.isAccessibleFileInput(el)
    );

    const adapter = resolveSiteAdapter(typeof window !== 'undefined' ? window.location.href : '', doc);
    const allRules: DocumentFieldMappingRule[] = [
      ...(adapter.documentMappings || []),
      ...DOCUMENT_SEMANTIC_RULES,
    ];

    const results: DetectedDocumentField[] = [];
    const seenTypes = new Map<string, number>();

    fileInputs.forEach((el, idx) => {
      const selector = this.computeSelector(el, idx);
      const { label, sectionHeading, instructionText, validationMessages, container } = this.extractContext(el);
      const requirements = this.extractRequirements(el, instructionText, validationMessages);

      const nameLower = (el.getAttribute('name') || '').toLowerCase();
      const idLower = (el.id || '').toLowerCase();
      const labelLower = label.toLowerCase();
      const headingLower = sectionHeading.toLowerCase();
      const instrLower = instructionText.toLowerCase();

      // Score each document rule using semantic signals (NEVER index/order)
      const scored = new Map<DocumentCategory, { rule: DocumentFieldMappingRule; score: number; signals: string[] }>();

      for (const rule of allRules) {
        let score = 0;
        const signals: string[] = [];

        if (rule.fieldNames.some((n) => nameLower === n.toLowerCase())) {
          score += 50;
          signals.push(`Exact name match: "${nameLower}"`);
        } else if (rule.fieldNames.some((n) => nameLower.includes(n.toLowerCase()))) {
          score += 25;
          signals.push(`Partial name match: "${nameLower}"`);
        }

        if (rule.fieldIds.some((i) => idLower === i.toLowerCase())) {
          score += 50;
          signals.push(`Exact id match: "${idLower}"`);
        } else if (rule.fieldIds.some((i) => idLower.includes(i.toLowerCase()))) {
          score += 25;
          signals.push(`Partial id match: "${idLower}"`);
        }

        for (const kw of rule.labelKeywords) {
          const kwLower = kw.toLowerCase();
          if (labelLower === kwLower) {
            score += 60;
            signals.push(`Exact label match: "${kw}"`);
            break;
          } else if (labelLower.includes(kwLower)) {
            score += 40;
            signals.push(`Label includes: "${kw}"`);
            break;
          } else if (headingLower.includes(kwLower)) {
            score += 25;
            signals.push(`Heading includes: "${kw}"`);
            break;
          } else if (instrLower.includes(kwLower)) {
            score += 20;
            signals.push(`Instruction includes: "${kw}"`);
            break;
          }
        }

        if (score > 0) {
          const prev = scored.get(rule.documentType);
          if (!prev || score > prev.score) {
            scored.set(rule.documentType, { rule, score, signals });
          }
        }
      }

      const ranked = Array.from(scored.values()).sort((a, b) => b.score - a.score);

      let documentType: DocumentCategory | 'unknown' = 'unknown';
      let canonicalKey = 'unknown';
      let isAmbiguous = false;
      let ambiguityReason: string | undefined;
      let matchedSignals: string[] = [];

      if (ranked.length === 0) {
        isAmbiguous = true;
        ambiguityReason = 'Could not determine document purpose from label, name, id, or instructions.';
      } else if (ranked.length > 1 && ranked[0].score - ranked[1].score < 15) {
        isAmbiguous = true;
        documentType = ranked[0].rule.documentType;
        canonicalKey = ranked[0].rule.canonicalKey;
        matchedSignals = ranked[0].signals;
        ambiguityReason = `Multiple competing document types matched (${ranked[0].rule.documentType} vs ${ranked[1].rule.documentType}).`;
      } else {
        documentType = ranked[0].rule.documentType;
        canonicalKey = ranked[0].rule.canonicalKey;
        matchedSignals = ranked[0].signals;
      }

      if (documentType !== 'unknown') {
        seenTypes.set(documentType, (seenTypes.get(documentType) || 0) + 1);
      }

      const { previewSelectors, errorSelectors } = this.findAssociatedUiSelectors(el, documentType, container);

      results.push({
        id: `docfield_${idx}`,
        element: el,
        selector,
        documentType,
        canonicalKey,
        label: label || el.name || el.id || `File Upload Field ${idx + 1}`,
        sectionHeading,
        accept: requirements.acceptAttribute,
        isAmbiguous,
        ambiguityReason,
        isDuplicate: false,
        requirements,
        previewSelectors,
        errorSelectors,
        matchedSignals,
      });
    });

    // Mark duplicate fields targeting the same document type so the user explicitly reviews them
    for (const item of results) {
      if (item.documentType !== 'unknown' && (seenTypes.get(item.documentType) || 0) > 1) {
        item.isDuplicate = true;
        item.isAmbiguous = true;
        item.ambiguityReason = `Multiple upload fields matched "${item.documentType}". Review carefully before approving upload.`;
      }
    }

    return results;
  }
}
