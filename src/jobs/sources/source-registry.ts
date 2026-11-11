// JobFill BD - Job Source Adapter Registry
// Central registry of all official and discovery job circular adapters.

import { JobSourceAdapter } from '../types/source.types';
import { TeletalkAdapter } from './teletalk';
import { BpscAdapter } from './bpsc';
import { BangladeshBankAdapter } from './bangladesh-bank';
import { NtrcaAdapter } from './ntrca';
import { DpeAdapter } from './dpe';
import { BdjobsAdapter } from './bdjobs';
import { OfficialWebsiteAdapter } from './national-portal';
import { GoogleNewsDiscoveryAdapter } from './google-news-discovery.adapter';
import { RemotiveAdapter } from './remotive.adapter';
import { RemoteOkAdapter } from './remoteok.adapter';
import { HimalayasAdapter } from './himalayas.adapter';
import { ArbeitnowAdapter } from './arbeitnow.adapter';
import { ReliefWebAdapter } from './reliefweb.adapter';

export const JOB_SOURCE_ADAPTERS: JobSourceAdapter[] = [
  TeletalkAdapter,
  OfficialWebsiteAdapter,
  BpscAdapter,
  BangladeshBankAdapter,
  NtrcaAdapter,
  DpeAdapter,
  BdjobsAdapter,
  GoogleNewsDiscoveryAdapter,
  RemotiveAdapter,
  RemoteOkAdapter,
  HimalayasAdapter,
  ArbeitnowAdapter,
  ReliefWebAdapter,
];

export class JobSourceRegistry {
  private static adapters = new Map<string, JobSourceAdapter>(
    JOB_SOURCE_ADAPTERS.map((a) => [a.sourceId, a])
  );

  public static getAll(): JobSourceAdapter[] {
    return Array.from(this.adapters.values());
  }

  public static getById(sourceId: string): JobSourceAdapter | undefined {
    return this.adapters.get(sourceId);
  }

  public static getOfficialAdapters(): JobSourceAdapter[] {
    return this.getAll().filter((a) => a.sourceType !== 'discovery_rss');
  }

  public static getDiscoveryAdapters(): JobSourceAdapter[] {
    return this.getAll().filter((a) => a.sourceType === 'discovery_rss');
  }

  public static registerCustomAdapter(adapter: JobSourceAdapter): void {
    this.adapters.set(adapter.sourceId, adapter);
  }
}
