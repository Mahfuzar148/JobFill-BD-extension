// JobFill BD - Compliant User-Initiated Open Portal Sync Helper
// Never bypasses CAPTCHAs or runs background tab scraping.
// Only inspects an already-open Bangladesh Bank portal tab when the user
// explicitly clicks "Sync from Open Tab" after viewing/verifying the page.

import {
  BangladeshBankAdapter,
  parseBangladeshBankCareerHtml,
  parseBangladeshBankOnlineAppHtml,
} from '../sources/bangladesh-bank/bangladesh-bank.adapter';
import { JobRepository } from '../database/job-repository';
import { deduplicateAndMergeJobs } from './job-deduplicator';
import { detectAccessRestrictionWithReason } from './captcha-detector';
import { deriveSourceConnectionStatus, SourceFetchOutcome } from '../types/source.types';

export interface OpenTabSyncResult {
  status: 'imported' | 'opened_portal' | 'captcha_present' | 'no_jobs_found' | 'unsupported';
  importedCount: number;
  newCount: number;
  updatedCount: number;
  tabUrl?: string;
}

export async function runOpenTabPortalSyncWithFeedback(options: {
  portalUrl?: string;
  bn: boolean;
  showToast: (msg: string) => void;
  onImported?: () => Promise<void> | void;
}): Promise<OpenTabSyncResult> {
  const { portalUrl, bn, showToast, onImported } = options;
  const res = await syncBangladeshBankFromOpenTab(portalUrl);
  if (res.status === 'imported') {
    await onImported?.();
    showToast(
      bn
        ? `✅ খোলা পোর্টাল ট্যাব থেকে ${res.importedCount}টি অফিশিয়াল BB সার্কুলার সিঙ্ক হয়েছে (${res.newCount}টি নতুন)`
        : `✅ Imported ${res.importedCount} verified Bangladesh Bank notice(s) from open portal tab (${res.newCount} new)`
    );
  } else if (res.status === 'opened_portal') {
    showToast(
      bn
        ? '🌐 Bangladesh Bank পোর্টাল খোলা হয়েছে। পেজটি সম্পূর্ণ লোড হলে আবার "খোলা ট্যাব থেকে সিঙ্ক" বাটনে ক্লিক করুন।'
        : '🌐 Opened official Bangladesh Bank portal. Once the circular table loads in your browser, click "Sync from Open Tab".'
    );
  } else if (res.status === 'captcha_present') {
    showToast(
      bn
        ? '🛡️ খোলা ট্যাবে এখনো ক্যাপচা যাচাই সক্রিয় আছে — ব্রাউজারে যাচাই শেষ হওয়ার পর আবার চেষ্টা করুন।'
        : '🛡️ CAPTCHA verification is still active in that tab — complete verification in the browser first, then click "Sync from Open Tab".'
    );
  } else if (res.status === 'no_jobs_found') {
    showToast(
      bn
        ? 'ℹ️ খোলা BB পোর্টাল ট্যাবে কোনো বিজ্ঞপ্তির সারণী পাওয়া যায়নি; প্রয়োজনে ম্যানুয়াল যোগ করুন।'
        : 'ℹ️ No recruitment table rows found in the open portal tab; you may add circulars manually if listed in PDF.'
    );
  }
  return res;
}

const BB_DEFAULT_PORTAL_URL = 'https://erecruitment.bb.org.bd/career/jobopportunity.php';

export async function syncBangladeshBankFromOpenTab(
  portalUrl: string = BB_DEFAULT_PORTAL_URL
): Promise<OpenTabSyncResult> {
  if (typeof chrome === 'undefined' || !chrome.tabs?.query) {
    if (typeof window !== 'undefined' && typeof window.open === 'function') {
      window.open(portalUrl, '_blank', 'noopener,noreferrer');
      return { status: 'opened_portal', importedCount: 0, newCount: 0, updatedCount: 0, tabUrl: portalUrl };
    }
    return { status: 'unsupported', importedCount: 0, newCount: 0, updatedCount: 0 };
  }

  const tabs = await chrome.tabs.query({
    url: ['https://erecruitment.bb.org.bd/*', 'https://*.bb.org.bd/*'],
  });

  const targetTab =
    tabs.find((t) => Boolean(t.id) && (t.url || '').includes('/career/jobopportunity')) ||
    tabs.find((t) => Boolean(t.id) && (t.url || '').includes('/onlineapp/joblist')) ||
    tabs.find((t) => Boolean(t.id));

  if (!targetTab?.id) {
    await chrome.tabs.create({ url: portalUrl, active: true });
    return {
      status: 'opened_portal',
      importedCount: 0,
      newCount: 0,
      updatedCount: 0,
      tabUrl: portalUrl,
    };
  }

  let response: any = null;
  try {
    response = await chrome.tabs.sendMessage(targetTab.id, {
      action: 'EXTRACT_OPEN_PORTAL_NOTICES',
    });
  } catch {
    // Content script might not have finished injecting if user just opened/reloaded tab
    await chrome.tabs.update(targetTab.id, { active: true });
    return {
      status: 'opened_portal',
      importedCount: 0,
      newCount: 0,
      updatedCount: 0,
      tabUrl: targetTab.url || portalUrl,
    };
  }

  if (response?.status === 'captcha_present') {
    await chrome.tabs.update(targetTab.id, { active: true });
    return {
      status: 'captcha_present',
      importedCount: 0,
      newCount: 0,
      updatedCount: 0,
      tabUrl: targetTab.url || portalUrl,
    };
  }

  const html = typeof response?.html === 'string' ? response.html : '';
  const tabUrl = typeof response?.url === 'string' ? response.url : targetTab.url || portalUrl;
  if (!html) {
    return { status: 'no_jobs_found', importedCount: 0, newCount: 0, updatedCount: 0, tabUrl };
  }

  const restriction = detectAccessRestrictionWithReason(html, 200);
  if (restriction.blockedByCaptcha || restriction.blockedReason) {
    await chrome.tabs.update(targetTab.id, { active: true });
    return {
      status: 'captcha_present',
      importedCount: 0,
      newCount: 0,
      updatedCount: 0,
      tabUrl,
    };
  }

  const now = Date.now();
  const rawItems = tabUrl.includes('onlineapp/joblist')
    ? parseBangladeshBankOnlineAppHtml(html)
    : parseBangladeshBankCareerHtml(html);

  const parsedJobs = rawItems
    .map((raw) => BangladeshBankAdapter.parseJob(raw, now))
    .filter((j) => BangladeshBankAdapter.validateJob(j).isValid);

  if (parsedJobs.length === 0) {
    return { status: 'no_jobs_found', importedCount: 0, newCount: 0, updatedCount: 0, tabUrl };
  }

  const existingJobs = await JobRepository.getAllJobs(now);
  const mergeRes = deduplicateAndMergeJobs(existingJobs, parsedJobs, now);
  await JobRepository.saveJobs(mergeRes.mergedJobs);
  await JobRepository.rebuildSearchIndex(mergeRes.mergedJobs);

  const prevOutcomes = await JobRepository.getSourceOutcomes();
  const storedBbCount = mergeRes.mergedJobs.filter((j) => j.sourceId === 'bangladesh_bank').length;
  const updatedBbOutcome: SourceFetchOutcome = {
    sourceId: BangladeshBankAdapter.sourceId,
    sourceName: BangladeshBankAdapter.sourceName,
    compatibilityStatus: 'supported',
    connectionStatus: 'Working',
    accessMethodType: 'HTML',
    publisherType: 'Official',
    success: true,
    jobs: parsedJobs,
    jobCount: parsedJobs.length,
    savedCount: storedBbCount,
    checkedAt: now,
    lastSuccessfulFetchAt: now,
    httpStatus: 200,
    blockedByCaptcha: false,
    retryAfterMs: null,
    skippedByCooldown: false,
    accessNotes: `Imported ${parsedJobs.length} verified Bangladesh Bank entry/entries from user-opened official portal tab.`,
    directPortalUrl: tabUrl,
  };
  updatedBbOutcome.connectionStatus = deriveSourceConnectionStatus(updatedBbOutcome);

  const filteredOthers = prevOutcomes.filter((o: any) => o?.sourceId !== 'bangladesh_bank');
  await JobRepository.saveSourceOutcomes([...filteredOthers, updatedBbOutcome]);

  return {
    status: 'imported',
    importedCount: parsedJobs.length,
    newCount: mergeRes.newJobs.length,
    updatedCount: mergeRes.updatedJobs.length,
    tabUrl,
  };
}
