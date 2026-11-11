// JobFill BD - Field-Level Validator
// Validates individual profile fields according to Bangladesh government recruitment specifications.

export interface FieldValidationResult {
  isValid: boolean;
  error?: string;
  errorBn?: string;
}

export class FieldValidator {
  /**
   * Validates Bangladeshi mobile phone number (11 digits starting with 013-019)
   */
  public static validateMobile(mobile: string): FieldValidationResult {
    if (!mobile || !mobile.trim()) {
      return { isValid: false, error: 'Mobile number is required', errorBn: 'মোবাইল নম্বর আবশ্যক' };
    }
    const clean = mobile.replace(/[\s-]/g, '');
    const mobileRegex = /^(?:\+?88)?01[3-9]\d{8}$/;
    if (!mobileRegex.test(clean)) {
      return {
        isValid: false,
        error: 'Invalid Bangladeshi mobile number (must be 11 digits e.g. 017XXXXXXXX)',
        errorBn: 'সঠিক বাংলাদেশি মোবাইল নম্বর দিন (১১ ডিজিট, যেমন: ০১৭XXXXXXXX)',
      };
    }
    return { isValid: true };
  }

  /**
   * Validates National ID (10 digit smart NID, 13 digit old NID, or 17 digit with birth year)
   */
  public static validateNID(nid: string): FieldValidationResult {
    if (!nid || !nid.trim()) return { isValid: true }; // Optional if birth registration is used
    const clean = nid.replace(/[\s-]/g, '');
    if (!/^\d{10}$|^\d{13}$|^\d{17}$/.test(clean)) {
      return {
        isValid: false,
        error: 'National ID must be 10, 13, or 17 digits',
        errorBn: 'জাতীয় পরিচয়পত্র ১০, ১৩ অথবা ১৭ ডিজিটের হতে হবে',
      };
    }
    return { isValid: true };
  }

  /**
   * Validates 17-digit digital birth registration number
   */
  public static validateBirthRegistration(reg: string): FieldValidationResult {
    if (!reg || !reg.trim()) return { isValid: true };
    const clean = reg.replace(/[\s-]/g, '');
    if (!/^\d{17}$/.test(clean)) {
      return {
        isValid: false,
        error: 'Digital Birth Registration must be exactly 17 digits',
        errorBn: 'ডিজিটাল জন্ম নিবন্ধন নম্বর ঠিক ১৭ ডিজিটের হতে হবে',
      };
    }
    return { isValid: true };
  }

  /**
   * Validates Date of Birth and age eligibility (standard 18 - 45 years for government jobs)
   */
  public static validateDOB(dob: string, minAge = 18, maxAge = 45): FieldValidationResult {
    if (!dob || !dob.trim()) {
      return { isValid: false, error: 'Date of birth is required', errorBn: 'জন্ম তারিখ আবশ্যক' };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      return {
        isValid: false,
        error: 'Date of birth must be in YYYY-MM-DD format',
        errorBn: 'জন্ম তারিখ YYYY-MM-DD ফরম্যাটে হতে হবে',
      };
    }

    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) {
      return { isValid: false, error: 'Invalid calendar date', errorBn: 'অকার্যকর তারিখ' };
    }

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < minAge) {
      return {
        isValid: false,
        error: `Applicant must be at least ${minAge} years old (current age: ${age})`,
        errorBn: `আবেদনকারীর বয়স কমপক্ষে ${minAge} বছর হতে হবে (বর্তমান বয়স: ${age})`,
      };
    }
    if (age > maxAge) {
      return {
        isValid: false,
        error: `Applicant age exceeds upper limit of ${maxAge} years (current age: ${age})`,
        errorBn: `আবেদনকারীর বয়স সর্বোচ্চ সীমা ${maxAge} বছর অতিক্রম করেছে (বর্তমান বয়স: ${age})`,
      };
    }

    return { isValid: true };
  }

  /**
   * Validates standard email address
   */
  public static validateEmail(email: string): FieldValidationResult {
    if (!email || !email.trim()) return { isValid: true }; // optional on some forms
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return { isValid: false, error: 'Invalid email address format', errorBn: 'সঠিক ইমেইল ঠিকানা দিন' };
    }
    return { isValid: true };
  }

  /**
   * Validates GPA score against scale (out of 5.00 for SSC/HSC or out of 4.00 for Graduation/Masters)
   */
  public static validateGPA(gpa: string, scale: '4' | '5' = '5'): FieldValidationResult {
    if (!gpa || !gpa.trim()) return { isValid: true };
    const num = parseFloat(gpa);
    const max = scale === '4' ? 4.0 : 5.0;
    if (isNaN(num) || num < 1.0 || num > max) {
      return {
        isValid: false,
        error: `GPA must be between 1.00 and ${max.toFixed(2)}`,
        errorBn: `জিপিএ ১.০০ থেকে ${max.toFixed(2)}-এর মধ্যে হতে হবে`,
      };
    }
    return { isValid: true };
  }

  /**
   * Validates 4-digit passing year
   */
  public static validatePassingYear(year: string): FieldValidationResult {
    if (!year || !year.trim()) return { isValid: true };
    const num = parseInt(year, 10);
    const currentYear = new Date().getFullYear();
    if (isNaN(num) || num < 1970 || num > currentYear) {
      return {
        isValid: false,
        error: `Passing year must be between 1970 and ${currentYear}`,
        errorBn: `পাসের বছর ১৯৭০ থেকে ${currentYear}-এর মধ্যে হতে হবে`,
      };
    }
    return { isValid: true };
  }

  /**
   * Validates 4-digit postal code while strictly preserving leading zero
   */
  public static validatePostalCode(code: string): FieldValidationResult {
    if (!code || !code.trim()) return { isValid: true };
    if (!/^\d{4}$/.test(code.trim())) {
      return {
        isValid: false,
        error: 'Postal code must be exactly 4 digits (e.g. 1209 or 0212)',
        errorBn: 'পোস্ট কোড ঠিক ৪ ডিজিটের হতে হবে (যেমন: ১২০৯)',
      };
    }
    return { isValid: true };
  }
}
