// JobFill BD - Visible Login Form Detector & Safe Explicit Autofill Helper
// Enforces exact HTTPS origin verification, visibility/anti-deception checks,
// explicit user-triggered fills only, and non-interference with browser password managers.

import { isStrictOriginMatch } from './origin-matcher';
import { VerificationEngine } from '../validation/verification-engine';

export interface DetectedLoginForm {
  hasLoginForm: boolean;
  hasPasswordField: boolean;
  hasUsernameField: boolean;
  usernameInputSelector: string | null;
  passwordInputSelector: string | null;
  currentUsernameValue: string;
}

export interface CredentialFillRequest {
  expectedOrigin: string;
  username?: string;
  userId?: string;
  applicantId?: string;
  password?: string;
  fillMode: 'username_only' | 'password_only' | 'both';
  explicitUserInitiated: boolean;
}

export interface CredentialFillResult {
  ok: boolean;
  filledUsername: boolean;
  filledPassword: boolean;
  reason: string;
}

function buildStableSelector(el: HTMLInputElement, fallbackIndex: number): string {
  if (el.id) return `#${CSS?.escape ? CSS.escape(el.id) : el.id}`;
  if (el.name) return `input[name="${el.name.replace(/"/g, '\\"')}"]`;
  return `input[data-jobfill-login-idx="${fallbackIndex}"]`;
}

/**
 * Rejects hidden, offscreen, collapsed, zero-opacity, or honeypot-like deceptive inputs.
 */
export function isLoginInputVisibleAndSafe(el: HTMLElement | null): el is HTMLInputElement {
  if (!el || el.tagName.toLowerCase() !== 'input') return false;
  const input = el as HTMLInputElement;
  if (input.disabled || input.readOnly) return false;
  if ((input.type || '').toLowerCase() === 'hidden') return false;
  if (input.closest('[hidden], [aria-hidden="true"]')) return false;

  const style = typeof window !== 'undefined' && window.getComputedStyle
    ? window.getComputedStyle(input)
    : input.style;

  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }

  // Catch classic honeypot / tiny offscreen trap styles
  const left = parseFloat(style.left || '');
  const top = parseFloat(style.top || '');
  if ((Number.isFinite(left) && left <= -500) || (Number.isFinite(top) && top <= -500)) {
    return false;
  }
  const inlineW = parseFloat(input.style.width || '');
  const inlineH = parseFloat(input.style.height || '');
  if ((Number.isFinite(inlineW) && inlineW <= 2) || (Number.isFinite(inlineH) && inlineH <= 2)) {
    return false;
  }

  return true;
}

function isLikelyUsernameInput(input: HTMLInputElement): boolean {
  const type = (input.type || 'text').toLowerCase();
  if (!['text', 'email', 'tel', 'number'].includes(type)) return false;
  const sig = `${input.name} ${input.id} ${input.placeholder} ${input.autocomplete} ${input.getAttribute('aria-label') || ''}`.toLowerCase();
  if (sig.includes('search') || sig.includes('captcha') || sig.includes('otp')) return false;
  return (
    type === 'email' ||
    sig.includes('user') ||
    sig.includes('login') ||
    sig.includes('email') ||
    sig.includes('applicant') ||
    sig.includes('id') ||
    sig.includes('phone') ||
    sig.includes('mobile') ||
    sig.includes('roll')
  );
}

export class LoginFormDetector {
  public static scan(doc: Document): DetectedLoginForm {
    const allInputs = Array.from(doc.querySelectorAll<HTMLInputElement>('input'));
    const passwordInput = allInputs.find(
      (el) => (el.type || '').toLowerCase() === 'password' && isLoginInputVisibleAndSafe(el)
    ) || null;

    let usernameInput: HTMLInputElement | null = null;
    if (passwordInput) {
      const container = passwordInput.form || passwordInput.closest('section, main, div') || doc.body;
      const scopeInputs = Array.from(container.querySelectorAll<HTMLInputElement>('input')).filter((el) =>
        isLoginInputVisibleAndSafe(el)
      );
      usernameInput =
        scopeInputs.find((el) => el !== passwordInput && isLikelyUsernameInput(el)) ||
        scopeInputs.find((el) => el !== passwordInput && ['text', 'email', 'tel'].includes((el.type || 'text').toLowerCase())) ||
        null;
    } else {
      usernameInput =
        allInputs.find((el) => isLoginInputVisibleAndSafe(el) && isLikelyUsernameInput(el)) || null;
    }

    if (usernameInput && !usernameInput.id && !usernameInput.name) {
      usernameInput.setAttribute('data-jobfill-login-idx', '0');
    }
    if (passwordInput && !passwordInput.id && !passwordInput.name) {
      passwordInput.setAttribute('data-jobfill-login-idx', '1');
    }

    return {
      hasLoginForm: Boolean(passwordInput && usernameInput),
      hasPasswordField: Boolean(passwordInput),
      hasUsernameField: Boolean(usernameInput),
      usernameInputSelector: usernameInput ? buildStableSelector(usernameInput, 0) : null,
      passwordInputSelector: passwordInput ? buildStableSelector(passwordInput, 1) : null,
      currentUsernameValue: usernameInput?.value?.trim() || '',
    };
  }

  public static executeExplicitFill(
    doc: Document,
    pageUrl: string,
    request: CredentialFillRequest
  ): CredentialFillResult {
    if (!request.explicitUserInitiated) {
      return {
        ok: false,
        filledUsername: false,
        filledPassword: false,
        reason: 'Credential autofill requires explicit user confirmation.',
      };
    }

    const originCheck = isStrictOriginMatch(request.expectedOrigin, pageUrl);
    if (!originCheck.matched) {
      return {
        ok: false,
        filledUsername: false,
        filledPassword: false,
        reason: originCheck.reason,
      };
    }

    const detected = this.scan(doc);
    let filledUsername = false;
    let filledPassword = false;

    const identifierValue =
      (request.username || '').trim() ||
      (request.userId || '').trim() ||
      (request.applicantId || '').trim();

    if (
      (request.fillMode === 'username_only' || request.fillMode === 'both') &&
      detected.usernameInputSelector &&
      identifierValue
    ) {
      const uEl = doc.querySelector<HTMLInputElement>(detected.usernameInputSelector);
      if (isLoginInputVisibleAndSafe(uEl)) {
        VerificationEngine.setNativeInputValue(uEl, identifierValue);
        filledUsername = uEl.value === identifierValue;
      }
    }

    if (
      (request.fillMode === 'password_only' || request.fillMode === 'both') &&
      detected.passwordInputSelector &&
      request.password
    ) {
      const pEl = doc.querySelector<HTMLInputElement>(detected.passwordInputSelector);
      if (isLoginInputVisibleAndSafe(pEl)) {
        VerificationEngine.setNativeInputValue(pEl, request.password);
        filledPassword = pEl.value === request.password;
      }
    }

    if (!filledUsername && !filledPassword) {
      return {
        ok: false,
        filledUsername: false,
        filledPassword: false,
        reason: 'No visible login inputs found on this HTTPS page.',
      };
    }

    return {
      ok: true,
      filledUsername,
      filledPassword,
      reason: 'Credential filled upon explicit user action.',
    };
  }
}
