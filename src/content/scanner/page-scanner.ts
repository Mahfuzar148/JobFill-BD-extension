// JobFill BD - Universal Page Scanner Coordinator
// Connects existing 5-layer PageScanner with site adapters and platform detection.

import { PageScanner, PageScanResult, toCanonicalProfile } from '../page-scanner';
import { resolveSiteAdapter } from '../../adapters/adapter-registry';
import { UserProfile } from '../../types/profile';

export interface UniversalScanSummary extends PageScanResult {
  organization: string;
  platform: string;
  totalFieldsCount: number;
}

export class UniversalPageScanner {
  public static async scanPage(profile: UserProfile, doc: Document = document): Promise<UniversalScanSummary> {
    const adapter = resolveSiteAdapter(window.location.href, doc);

    // Apply pre-scan hooks (e.g. revealing progressive disclosure sections)
    if (adapter.preProcessForm) {
      adapter.preProcessForm(doc);
    }

    const baseScan = await PageScanner.scanPage(profile);

    let organization = 'Generic Government Form';
    let platform = 'Generic Web Form';

    if (adapter.id === 'petrobangla') {
      organization = 'Bangladesh Oil, Gas and Mineral Corporation (Petrobangla)';
      platform = 'Teletalk Bangladesh';
    } else if (adapter.id === 'teletalk') {
      organization = 'Teletalk Alljobs Recruitment Portal';
      platform = 'Teletalk Bangladesh';
    } else if (adapter.id === 'bpsc') {
      organization = 'Bangladesh Public Service Commission (BPSC)';
      platform = 'BPSC Recruitment Engine';
    }

    return {
      ...baseScan,
      organization,
      platform,
      totalFieldsCount: baseScan.totalVisibleInputs,
    };
  }
}

export { PageScanner, type PageScanResult, toCanonicalProfile };
