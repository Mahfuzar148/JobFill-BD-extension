// JobFill BD - Smart CAPTCHA & Anti-Bot Challenge Detector
// Zero external network calls; safe, conservative classification.
// Detects Google reCAPTCHA, hCaptcha, Cloudflare Turnstile, Cloudflare Interstitial Challenge,
// F5 Big-IP WAF (/tspd/), AWS WAF, and visible human verification prompts.
// NEVER bypasses, solves, inspects cross-origin iframes, or manipulates tokens.

export type ChallengeClassification =
  | 'NO_CHALLENGE_DETECTED'
  | 'CAPTCHA_REQUIRED'
  | 'HUMAN_VERIFICATION_REQUIRED'
  | 'ACCESS_DENIED'
  | 'RATE_LIMITED'
  | 'AUTHENTICATION_REQUIRED'
  | 'UNKNOWN_CHALLENGE';

export type ChallengeProvider =
  | 'recaptcha'
  | 'hcaptcha'
  | 'turnstile'
  | 'cloudflare_interstitial'
  | 'f5_tspd'
  | 'aws_waf'
  | 'perimeterx'
  | 'generic';

export interface ChallengeDetectionResult {
  classification: ChallengeClassification;
  challengeProvider?: ChallengeProvider;
  isBlocked: boolean;
  requiresHumanVerification: boolean;
  reason?: string;
  retryAfterMs?: number | null;
  httpStatus?: number;
}

export interface AccessRestrictionDetection {
  blockedReason?: string;
  blockedByCaptcha: boolean;
  classification?: ChallengeClassification;
}

/**
 * Inspects raw response text, HTTP status, and headers to identify rate limiting,
 * authentication walls, or active anti-bot challenges without loading or executing scripts.
 */
export function detectResponseChallenge(
  htmlOrText: string,
  status: number,
  headers?: Record<string, string | null | undefined>
): ChallengeDetectionResult {
  // 1. HTTP 429: Rate Limited
  if (status === 429) {
    let retryAfterMs: number | null = null;
    const retryHeader = headers?.['retry-after'];
    if (retryHeader) {
      const parsedSecs = Number(retryHeader);
      if (Number.isFinite(parsedSecs) && parsedSecs > 0) {
        retryAfterMs = parsedSecs * 1000;
      }
    }
    return {
      classification: 'RATE_LIMITED',
      isBlocked: true,
      requiresHumanVerification: false,
      reason: retryAfterMs
        ? `HTTP 429 Too Many Requests (Retry-After ${Math.ceil(retryAfterMs / 1000)}s)`
        : 'HTTP 429 Too Many Requests',
      retryAfterMs,
      httpStatus: status,
    };
  }

  // 2. HTTP 401: Authentication Required
  if (status === 401) {
    return {
      classification: 'AUTHENTICATION_REQUIRED',
      isBlocked: true,
      requiresHumanVerification: false,
      reason: 'HTTP 401 Unauthorized — Portal requires login or credentials.',
      httpStatus: status,
    };
  }

  const sample = (htmlOrText || '').slice(0, 30000).toLowerCase();

  // 3. Cloudflare Turnstile Widget
  if (sample.includes('cf-turnstile') || sample.includes('turnstile/v0/api.js') || sample.includes('challenges.cloudflare.com/turnstile')) {
    return {
      classification: 'CAPTCHA_REQUIRED',
      challengeProvider: 'turnstile',
      isBlocked: true,
      requiresHumanVerification: true,
      reason: 'Cloudflare Turnstile challenge detected.',
      httpStatus: status,
    };
  }

  // 4. Cloudflare Interstitial Challenge Page
  const hasCloudflareChallenge =
    sample.includes('cf-chl-bypass') ||
    sample.includes('challenge-platform') ||
    sample.includes('challenges.cloudflare.com') ||
    (sample.includes('ray id') && (sample.includes('cloudflare') || sample.includes('just a moment'))) ||
    sample.includes('attention required! | cloudflare');

  if (hasCloudflareChallenge) {
    return {
      classification: 'HUMAN_VERIFICATION_REQUIRED',
      challengeProvider: 'cloudflare_interstitial',
      isBlocked: true,
      requiresHumanVerification: true,
      reason: 'Cloudflare security challenge page detected.',
      httpStatus: status,
    };
  }

  // 5. Google reCAPTCHA
  if (
    sample.includes('g-recaptcha') ||
    sample.includes('recaptcha/api.js') ||
    sample.includes('google.com/recaptcha') ||
    sample.includes('recaptcha-anchor')
  ) {
    return {
      classification: 'CAPTCHA_REQUIRED',
      challengeProvider: 'recaptcha',
      isBlocked: true,
      requiresHumanVerification: true,
      reason: 'Google reCAPTCHA verification detected.',
      httpStatus: status,
    };
  }

  // 6. hCaptcha
  if (sample.includes('h-captcha') || sample.includes('hcaptcha.com') || sample.includes('hcaptcha.com/1/api.js')) {
    return {
      classification: 'CAPTCHA_REQUIRED',
      challengeProvider: 'hcaptcha',
      isBlocked: true,
      requiresHumanVerification: true,
      reason: 'hCaptcha verification detected.',
      httpStatus: status,
    };
  }

  // 7. F5 Big-IP TSPD WAF (/tspd/)
  if (sample.includes('/tspd/') && (sample.includes('bobcmn') || sample.includes('tspd_'))) {
    return {
      classification: 'HUMAN_VERIFICATION_REQUIRED',
      challengeProvider: 'f5_tspd',
      isBlocked: true,
      requiresHumanVerification: true,
      reason:
        'Portal returned an anti-bot/CAPTCHA challenge page — automatic extraction halted per policy (F5 Big-IP TSPD).',
      httpStatus: status,
    };
  }

  // 8. AWS WAF / PerimeterX
  if (
    sample.includes('aws-waf-token') ||
    sample.includes('px-captcha') ||
    sample.includes('perimeterx') ||
    sample.includes('_px3')
  ) {
    return {
      classification: 'HUMAN_VERIFICATION_REQUIRED',
      challengeProvider: sample.includes('aws-waf') ? 'aws_waf' : 'perimeterx',
      isBlocked: true,
      requiresHumanVerification: true,
      reason: 'Enterprise WAF / anti-bot verification challenge detected.',
      httpStatus: status,
    };
  }

  // 9. Generic Human Verification Phrasing or CAPTCHA in HTML / Text
  const hasGenericHumanPrompt =
    sample.includes('verify you are human') ||
    sample.includes('verify that you are human') ||
    sample.includes('confirm you are not a robot') ||
    sample.includes('i am not a robot') ||
    sample.includes('checking if the site connection is secure') ||
    sample.includes('security check to access') ||
    sample.includes('নিরাপত্তা যাচাই') ||
    sample.includes('captcha');

  if (hasGenericHumanPrompt) {
    const statusNote = status ? ` (HTTP ${status})` : '';
    return {
      classification: 'HUMAN_VERIFICATION_REQUIRED',
      challengeProvider: 'generic',
      isBlocked: true,
      requiresHumanVerification: true,
      reason: `Portal returned an anti-bot/CAPTCHA challenge page${statusNote} — automatic extraction halted per policy.`,
      httpStatus: status,
    };
  }

  // 10. HTTP 403: Access Denied (without explicit CAPTCHA)
  if (status === 403) {
    return {
      classification: 'ACCESS_DENIED',
      isBlocked: true,
      requiresHumanVerification: false,
      reason: 'HTTP 403 Forbidden — Access restricted by server or firewall.',
      httpStatus: status,
    };
  }

  // 11. Clean response: No Challenge
  return {
    classification: 'NO_CHALLENGE_DETECTED',
    isBlocked: false,
    requiresHumanVerification: false,
    httpStatus: status,
  };
}

/**
 * Safe page-level DOM challenge inspection.
 * Inspects public DOM elements, public iframe attributes (src), script tags,
 * and visible challenge containers without inspecting cross-origin iframe internals.
 */
export function detectPageChallenge(doc: Document, status: number = 200): ChallengeDetectionResult {
  if (!doc) {
    return {
      classification: 'NO_CHALLENGE_DETECTED',
      isBlocked: false,
      requiresHumanVerification: false,
    };
  }

  // 1. Check title for Cloudflare or generic interstitial challenge titles
  const title = (doc.title || '').trim().toLowerCase();
  if (
    title.includes('just a moment') ||
    title.includes('attention required!') ||
    title.includes('security challenge') ||
    title.includes('human verification')
  ) {
    return {
      classification: 'HUMAN_VERIFICATION_REQUIRED',
      challengeProvider: 'cloudflare_interstitial',
      isBlocked: true,
      requiresHumanVerification: true,
      reason: `Challenge page detected from page title: "${doc.title}"`,
      httpStatus: status,
    };
  }

  // 2. Check recognized widget containers and public iframe metadata
  // A. hCaptcha (checked with specific h-captcha container or hcaptcha iframe)
  if (
    doc.querySelector('.h-captcha, [data-hcaptcha-widget-id], [data-sitekey].h-captcha') ||
    doc.querySelector('iframe[src*="hcaptcha.com"]')
  ) {
    return {
      classification: 'CAPTCHA_REQUIRED',
      challengeProvider: 'hcaptcha',
      isBlocked: true,
      requiresHumanVerification: true,
      reason: 'hCaptcha widget container detected in DOM.',
      httpStatus: status,
    };
  }

  // B. Cloudflare Turnstile
  if (
    doc.querySelector('.cf-turnstile, [data-turnstile-sitekey], #turnstile-wrapper, [data-sitekey].cf-turnstile') ||
    doc.querySelector('iframe[src*="challenges.cloudflare.com"]')
  ) {
    return {
      classification: 'CAPTCHA_REQUIRED',
      challengeProvider: 'turnstile',
      isBlocked: true,
      requiresHumanVerification: true,
      reason: 'Cloudflare Turnstile widget container detected in DOM.',
      httpStatus: status,
    };
  }

  // C. reCAPTCHA
  if (
    doc.querySelector('.g-recaptcha, #g-recaptcha, #recaptcha, [data-sitekey].g-recaptcha, form[action*="recaptcha"]') ||
    doc.querySelector('iframe[src*="google.com/recaptcha"], iframe[src*="recaptcha.net"]')
  ) {
    return {
      classification: 'CAPTCHA_REQUIRED',
      challengeProvider: 'recaptcha',
      isBlocked: true,
      requiresHumanVerification: true,
      reason: 'Google reCAPTCHA widget container detected in DOM.',
      httpStatus: status,
    };
  }

  // 3. Check public script elements for recognized challenge SDKs
  const scripts = Array.from(doc.querySelectorAll<HTMLScriptElement>('script[src]'));
  for (const script of scripts) {
    const src = (script.src || '').toLowerCase();
    if (src.includes('recaptcha/api.js') || src.includes('google.com/recaptcha')) {
      return {
        classification: 'CAPTCHA_REQUIRED',
        challengeProvider: 'recaptcha',
        isBlocked: true,
        requiresHumanVerification: true,
        reason: 'Google reCAPTCHA script detected in page.',
        httpStatus: status,
      };
    }
    if (src.includes('hcaptcha.com/1/api.js') || src.includes('hcaptcha.com')) {
      return {
        classification: 'CAPTCHA_REQUIRED',
        challengeProvider: 'hcaptcha',
        isBlocked: true,
        requiresHumanVerification: true,
        reason: 'hCaptcha SDK script detected in page.',
        httpStatus: status,
      };
    }
    if (src.includes('turnstile/v0/api.js') || src.includes('challenges.cloudflare.com/turnstile')) {
      return {
        classification: 'CAPTCHA_REQUIRED',
        challengeProvider: 'turnstile',
        isBlocked: true,
        requiresHumanVerification: true,
        reason: 'Cloudflare Turnstile SDK script detected in page.',
        httpStatus: status,
      };
    }
  }

  // 4. Check visible body text
  const bodyText = (doc.body ? (doc.body.innerText || doc.body.textContent || '') : '').toLowerCase();
  if (
    bodyText.includes('verify you are human') ||
    bodyText.includes('verify that you are human') ||
    bodyText.includes('please enable javascript and cookies to continue') ||
    bodyText.includes('security check to access') ||
    bodyText.includes('checking if the site connection is secure')
  ) {
    return {
      classification: 'HUMAN_VERIFICATION_REQUIRED',
      challengeProvider: 'generic',
      isBlocked: true,
      requiresHumanVerification: true,
      reason: 'Visible human verification challenge text detected on page.',
      httpStatus: status,
    };
  }

  // 5. Fallback check for F5 TSPD in page HTML
  if (bodyText.includes('/tspd/') || (doc.head && (doc.head.innerHTML || '').includes('/tspd/'))) {
    return {
      classification: 'HUMAN_VERIFICATION_REQUIRED',
      challengeProvider: 'f5_tspd',
      isBlocked: true,
      requiresHumanVerification: true,
      reason: 'F5 Big-IP TSPD anti-bot challenge active in page.',
      httpStatus: status,
    };
  }

  return {
    classification: 'NO_CHALLENGE_DETECTED',
    isBlocked: false,
    requiresHumanVerification: false,
    httpStatus: status,
  };
}

/**
 * Backward-compatible helper preserving existing call signatures in job-fetcher.ts
 * and content scripts.
 */
export function detectAccessRestrictionWithReason(
  htmlOrText: string,
  status: number
): AccessRestrictionDetection {
  const result = detectResponseChallenge(htmlOrText, status);
  if (result.isBlocked) {
    return {
      blockedReason: result.reason || 'Access restricted by portal.',
      blockedByCaptcha: result.requiresHumanVerification,
      classification: result.classification,
    };
  }
  return {
    blockedReason: undefined,
    blockedByCaptcha: false,
    classification: 'NO_CHALLENGE_DETECTED',
  };
}

export function detectAccessRestriction(htmlOrText: string, status: number): string | undefined {
  return detectAccessRestrictionWithReason(htmlOrText, status).blockedReason;
}
