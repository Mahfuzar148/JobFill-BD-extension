// JobFill BD - Universal Site Adapter Registry
import { SiteAdapter } from './types';
import { PetroBanglaAdapter } from './petrobangla';
import { TeletalkAdapter } from './teletalk';
import { BPSCAdapter } from './bpsc';
import { BangladeshBankAdapter } from './bb-adapter';
import { AtsPortalAdapter } from './ats-adapter';
import { GenericAdapter } from './generic-adapter';

export const ALL_SITE_ADAPTERS: SiteAdapter[] = [
  PetroBanglaAdapter,
  BPSCAdapter,
  BangladeshBankAdapter,
  TeletalkAdapter,
  AtsPortalAdapter,
  GenericAdapter,
];

export function resolveSiteAdapter(url: string, doc: Document): SiteAdapter {
  for (const adapter of ALL_SITE_ADAPTERS) {
    if (adapter.id !== 'generic' && (adapter.matchesUrl(url) || adapter.detectSite(doc))) {
      return adapter;
    }
  }
  return GenericAdapter;
}

export {
  PetroBanglaAdapter,
  TeletalkAdapter,
  BPSCAdapter,
  BangladeshBankAdapter,
  AtsPortalAdapter,
  GenericAdapter,
};
