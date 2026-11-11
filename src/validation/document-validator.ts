// JobFill BD - Document & Image Specification Validator
// Validates compliance with Bangladesh Government (PetroBangla, Teletalk, BPSC)
// official photograph and signature upload standards.

export interface DocumentValidationReport {
  isCompliant: boolean;
  type: 'photo' | 'signature' | 'certificate';
  width: number;
  height: number;
  fileSizeKb: number;
  format: string;
  errors: string[];
  errorsBn: string[];
}

export class DocumentValidator {
  /**
   * Validates Applicant Photograph against 300x300 px, max 100 KB standard
   */
  public static validatePhoto(width: number, height: number, fileSizeKb: number, mimeType: string): DocumentValidationReport {
    const errors: string[] = [];
    const errorsBn: string[] = [];

    // 1. Dimensions check: exactly 300x300
    if (width !== 300 || height !== 300) {
      errors.push(`Photo dimensions must be exactly 300 × 300 pixels (uploaded: ${width} × ${height})`);
      errorsBn.push(`ছবির মাপ অবশ্যই ঠিক ৩০০ × ৩০০ পিক্সেল হতে হবে (বর্তমান: ${width} × ${height})`);
    }

    // 2. File size check: <= 100 KB
    if (fileSizeKb > 100) {
      errors.push(`Photo file size exceeds maximum limit of 100 KB (current size: ${fileSizeKb.toFixed(1)} KB)`);
      errorsBn.push(`ছবির ফাইল সাইজ সর্বোচ্চ ১০০ KB এর মধ্যে হতে হবে (বর্তমান: ${fileSizeKb.toFixed(1)} KB)`);
    }

    // 3. Format check: JPEG/JPG/PNG
    const cleanMime = mimeType.toLowerCase();
    if (!cleanMime.includes('jpeg') && !cleanMime.includes('jpg') && !cleanMime.includes('png')) {
      errors.push('Photo must be in JPG or PNG format');
      errorsBn.push('ছবিটি অবশ্যই JPG বা PNG ফরম্যাটে হতে হবে');
    }

    return {
      isCompliant: errors.length === 0,
      type: 'photo',
      width,
      height,
      fileSizeKb,
      format: mimeType,
      errors,
      errorsBn,
    };
  }

  /**
   * Validates Applicant Signature against 300x80 px, max 60 KB standard
   */
  public static validateSignature(width: number, height: number, fileSizeKb: number, mimeType: string): DocumentValidationReport {
    const errors: string[] = [];
    const errorsBn: string[] = [];

    // 1. Dimensions check: exactly 300x80
    if (width !== 300 || height !== 80) {
      errors.push(`Signature dimensions must be exactly 300 × 80 pixels (uploaded: ${width} × ${height})`);
      errorsBn.push(`স্বাক্ষরের মাপ অবশ্যই ঠিক ৩০০ × ৮০ পিক্সেল হতে হবে (বর্তমান: ${width} × ${height})`);
    }

    // 2. File size check: <= 60 KB
    if (fileSizeKb > 60) {
      errors.push(`Signature file size exceeds maximum limit of 60 KB (current size: ${fileSizeKb.toFixed(1)} KB)`);
      errorsBn.push(`স্বাক্ষরের ফাইল সাইজ সর্বোচ্চ ৬০ KB এর মধ্যে হতে হবে (বর্তমান: ${fileSizeKb.toFixed(1)} KB)`);
    }

    // 3. Format check: JPEG/JPG/PNG
    const cleanMime = mimeType.toLowerCase();
    if (!cleanMime.includes('jpeg') && !cleanMime.includes('jpg') && !cleanMime.includes('png')) {
      errors.push('Signature must be in JPG or PNG format');
      errorsBn.push('স্বাক্ষরটি অবশ্যই JPG বা PNG ফরম্যাটে হতে হবে');
    }

    return {
      isCompliant: errors.length === 0,
      type: 'signature',
      width,
      height,
      fileSizeKb,
      format: mimeType,
      errors,
      errorsBn,
    };
  }
}
