// JobFill BD - CSPRNG Password Generator & Strength Evaluator
// Uses crypto.getRandomValues exclusively with rejection sampling (no modulo bias, never Math.random).

export interface PasswordStrengthResult {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Very Weak' | 'Weak' | 'Fair' | 'Strong' | 'Very Strong';
  labelBn: string;
  entropyBits: number;
  checks: {
    length12Plus: boolean;
    hasLower: boolean;
    hasUpper: boolean;
    hasDigit: boolean;
    hasSymbol: boolean;
  };
}

export interface PasswordGeneratorOptions {
  length?: number;
  includeUpper?: boolean;
  includeLower?: boolean;
  includeDigits?: boolean;
  includeSymbols?: boolean;
}

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%^&*()-_=+[]{}';

function secureRandomIndex(maxExclusive: number): number {
  const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
  const buf = new Uint32Array(1);
  let val = 0;
  do {
    crypto.getRandomValues(buf);
    val = buf[0];
  } while (val >= limit);
  return val % maxExclusive;
}

export function generateStrongPassword(options: PasswordGeneratorOptions = {}): string {
  const length = Math.max(8, Math.min(64, options.length ?? 16));
  const useUpper = options.includeUpper !== false;
  const useLower = options.includeLower !== false;
  const useDigits = options.includeDigits !== false;
  const useSymbols = options.includeSymbols !== false;

  const charsets: string[] = [];
  if (useUpper) charsets.push(UPPER);
  if (useLower) charsets.push(LOWER);
  if (useDigits) charsets.push(DIGITS);
  if (useSymbols) charsets.push(SYMBOLS);
  if (charsets.length === 0) {
    charsets.push(UPPER, LOWER, DIGITS);
  }

  const combined = charsets.join('');
  const chars: string[] = [];

  // Guarantee at least one character from each enabled set
  for (const set of charsets) {
    if (chars.length < length) {
      chars.push(set[secureRandomIndex(set.length)]);
    }
  }

  while (chars.length < length) {
    chars.push(combined[secureRandomIndex(combined.length)]);
  }

  // Fisher-Yates unbiased shuffle with CSPRNG
  for (let i = chars.length - 1; i > 0; i--) {
    const j = secureRandomIndex(i + 1);
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }

  return chars.join('');
}

export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const pwd = password || '';
  const checks = {
    length12Plus: pwd.length >= 12,
    hasLower: /[a-z]/.test(pwd),
    hasUpper: /[A-Z]/.test(pwd),
    hasDigit: /\d/.test(pwd),
    hasSymbol: /[^A-Za-z0-9]/.test(pwd),
  };

  let pool = 0;
  if (checks.hasLower) pool += 26;
  if (checks.hasUpper) pool += 26;
  if (checks.hasDigit) pool += 10;
  if (checks.hasSymbol) pool += 32;
  const entropyBits = pwd.length > 0 && pool > 0 ? Math.round(pwd.length * Math.log2(pool)) : 0;

  let points = 0;
  if (pwd.length >= 8) points += 1;
  if (checks.length12Plus) points += 1;
  if (checks.hasLower && checks.hasUpper) points += 1;
  if (checks.hasDigit) points += 1;
  if (checks.hasSymbol) points += 1;
  if (pwd.length < 6) points = 0;

  const score = Math.min(4, Math.max(0, points > 4 ? 4 : points)) as 0 | 1 | 2 | 3 | 4;
  const map: Record<0 | 1 | 2 | 3 | 4, { label: PasswordStrengthResult['label']; labelBn: string }> = {
    0: { label: 'Very Weak', labelBn: 'খুবই দুর্বল' },
    1: { label: 'Weak', labelBn: 'দুর্বল' },
    2: { label: 'Fair', labelBn: 'মোটামুটি' },
    3: { label: 'Strong', labelBn: 'শক্তিশালী' },
    4: { label: 'Very Strong', labelBn: 'অত্যন্ত শক্তিশালী' },
  };

  return {
    score,
    label: map[score].label,
    labelBn: map[score].labelBn,
    entropyBits,
    checks,
  };
}
