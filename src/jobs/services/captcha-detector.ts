// JobFill BD - Pure Anti-Bot & CAPTCHA Challenge Detector
// Zero external imports so both background/hub and content scripts share one single source of truth
// without bundling unrelated repository or network code.

export interface AccessRestrictionDetection {
  blockedReason?: string;
  blockedByCaptcha: boolean;
}

export function detectAccessRestrictionWithReason(
  htmlOrText: string,
  status: number
): AccessRestrictionDetection {
  if (status === 401 || status === 403) {
    return {
      blockedReason: `Access restricted by portal (HTTP ${status})`,
      blockedByCaptcha: false,
    };
  }

  const sample = htmlOrText.slice(0, 12000).toLowerCase();
  if (
    sample.includes('captcha') ||
    sample.includes('g-recaptcha') ||
    sample.includes('h-captcha') ||
    sample.includes('cf-turnstile') ||
    sample.includes('cf-chl-bypass') ||
    sample.includes('challenge-platform') ||
    sample.includes('verify you are human') ||
    (sample.includes('/tspd/') && (sample.includes('bobcmn') || sample.includes('tspd_')))
  ) {
    return {
      blockedReason:
        'Portal returned an anti-bot/CAPTCHA challenge page — automatic extraction halted per policy.',
      blockedByCaptcha: true,
    };
  }

  return { blockedReason: undefined, blockedByCaptcha: false };
}

export function detectAccessRestriction(htmlOrText: string, status: number): string | undefined {
  return detectAccessRestrictionWithReason(htmlOrText, status).blockedReason;
}
