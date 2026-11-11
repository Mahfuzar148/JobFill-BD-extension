// JobFill BD - PetroBangla / BOGMC Website Detector
// Accurately recognizes BOGMC (bogmc.teletalk.com.bd) and affiliated PetroBangla energy company forms.

export interface DetectionResult {
  isSupported: boolean;
  organization: string;
  platform: string;
  pageType: 'application_form' | 'preliminary_page' | 'payment_page' | 'unknown';
  postCode?: string;
  confidence: number;
}

export class PetroBanglaDetector {
  private static readonly SUPPORTED_HOSTS = [
    'bogmc.teletalk.com.bd',
    'petrobangla.org.bd',
    'titasgas.teletalk.com.bd',
    'bgfcl.teletalk.com.bd',
    'sgfl.teletalk.com.bd',
    'rpgcl.teletalk.com.bd',
    'jgtdsl.teletalk.com.bd',
    'bgdsl.teletalk.com.bd',
    'bapex.teletalk.com.bd',
    'mgmcl.teletalk.com.bd',
    'bcmcl.teletalk.com.bd',
  ];

  /**
   * Evaluates URL and DOM structure to determine if active page is a BOGMC / PetroBangla application form.
   * NOTE: Opaque query string values are treated as sensitive and NEVER logged.
   */
  public static detect(url: string, doc?: Document): DetectionResult {
    let hostname = '';
    let pathname = '';

    try {
      const parsed = new URL(url);
      hostname = parsed.hostname.toLowerCase();
      pathname = parsed.pathname.toLowerCase();
    } catch {
      // Fallback for relative or file URLs
      hostname = url.toLowerCase();
      pathname = url.toLowerCase();
    }

    const isSupportedHost =
      this.SUPPORTED_HOSTS.some((host) => hostname === host || hostname.endsWith('.' + host)) ||
      url.includes('petrobangla-form.html');

    const isApplicationPath =
      pathname.includes('/application.php') ||
      pathname.includes('/bogmc_2026/') ||
      pathname.includes('application') ||
      pathname.includes('petrobangla');

    // DOM Content inspection
    let hasBogmcDomMarkers = false;
    let hasFormElements = false;

    if (doc && doc.body) {
      const text = doc.body.textContent || '';
      const hasBasicInfo = text.includes('Basic Information');
      const hasAddress = text.includes('Present Address') || text.includes('Permanent Address');
      const hasEducation = text.includes('Educational Qualification') || text.includes('S.S.C');
      const hasOrgChoice = text.includes('Organization Choice') || text.includes('Choice');
      const hasPetroKeyword =
        text.includes('BOGMC') ||
        text.includes('Petrobangla') ||
        text.includes('Bangladesh Oil, Gas and Mineral Corporation') ||
        doc.title.includes('Petrobangla') ||
        doc.title.includes('BOGMC');

      hasBogmcDomMarkers = (hasBasicInfo && hasAddress) || hasPetroKeyword || hasOrgChoice;
      hasFormElements = !!doc.querySelector('input, select, textarea');
    }

    if (isSupportedHost && (isApplicationPath || (hasBogmcDomMarkers && hasFormElements))) {
      return {
        isSupported: true,
        organization: 'Bangladesh Oil, Gas and Mineral Corporation (Petrobangla)',
        platform: 'Teletalk Bangladesh',
        pageType: 'application_form',
        confidence: 0.98,
      };
    }

    if (isSupportedHost && !isApplicationPath && !hasFormElements) {
      return {
        isSupported: true,
        organization: 'Bangladesh Oil, Gas and Mineral Corporation (Petrobangla)',
        platform: 'Teletalk Bangladesh',
        pageType: 'preliminary_page',
        confidence: 0.75,
      };
    }

    if (hasBogmcDomMarkers && hasFormElements) {
      return {
        isSupported: true,
        organization: 'Petrobangla / BOGMC Form Replica',
        platform: 'Teletalk Form Engine',
        pageType: 'application_form',
        confidence: 0.9,
      };
    }

    return {
      isSupported: false,
      organization: 'Unknown Organization',
      platform: 'Generic Web Form',
      pageType: 'unknown',
      confidence: 0,
    };
  }
}
