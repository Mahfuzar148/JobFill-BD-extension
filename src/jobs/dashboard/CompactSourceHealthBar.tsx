// JobFill BD - Compact Source Health Summary & Expandable Details Panel
// Replaces bulky technical sync panels with a clean 1-line summary bar while keeping
// full per-source status, retry actions, and sync history one click away under "View Details".

import React from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  History,
  Plus,
  RefreshCw,
  ShieldAlert,
  X,
} from 'lucide-react';
import { JobSourceAdapter } from '../types/source.types';
import { NormalizedJobCircular, SyncHistoryRecord } from '../types/job.types';
import { verifyJobUrl } from '../services/source-verifier';
import {
  SourceHealthItem,
  SourceHealthSummary,
  computeSourceHealthSummary,
  formatFailedSourcesLabel,
  formatManualVerificationSourcesLabel,
  formatNotTestedSourcesLabel,
  formatPartialSourcesLabel,
  formatRetryAvailabilityNote,
  formatSourceHealthHeadline,
  formatSourceStatusLabel,
  formatTemporarilyUnavailableSourcesLabel,
  formatWaitingSourcesLabel,
  toBanglaDigits,
} from '../services/source-health-state';

export interface LiveSourceProgressSnapshot {
  completed: number;
  total: number;
  activeSourceName: string;
}

interface CompactSourceHealthBarProps {
  adapters: JobSourceAdapter[];
  outcomes: any[];
  lastSuccessfulSyncAt: number | null;
  syncing: boolean;
  progress?: LiveSourceProgressSnapshot | null;
  syncHistory?: SyncHistoryRecord[];
  healthSummary?: SourceHealthSummary;
  jobs?: NormalizedJobCircular[];
  expanded: boolean;
  onToggleExpanded: () => void;
  onRetryFailed: (failedSourceIds: string[]) => void;
  onRetrySingleSource?: (sourceId: string) => void;
  onOpenManualAdd?: (item: SourceHealthItem) => void;
  onSyncFromOpenTab?: (item: SourceHealthItem) => void;
  onViewBankJobs?: () => void;
  panelHeading?: string;
  panelRef?: React.Ref<HTMLDivElement>;
  footerContent?: React.ReactNode;
  bn: boolean;
}

export const CompactSourceHealthBar: React.FC<CompactSourceHealthBarProps> = ({
  adapters,
  outcomes,
  lastSuccessfulSyncAt,
  syncing,
  progress,
  syncHistory = [],
  healthSummary,
  jobs = [],
  expanded,
  onToggleExpanded,
  onRetryFailed,
  onRetrySingleSource,
  onOpenManualAdd,
  onSyncFromOpenTab,
  onViewBankJobs,
  panelHeading,
  panelRef,
  footerContent,
  bn,
}) => {
  const summary =
    healthSummary || computeSourceHealthSummary(adapters, outcomes, lastSuccessfulSyncAt);

  const retryableIds = summary.retryableSourceIds;
  const lastUpdatedTs = summary.lastCheckedAt ?? summary.lastSuccessfulSyncAt;

  const progressPct =
    syncing && progress && progress.total > 0
      ? Math.min(100, Math.round((progress.completed / progress.total) * 100))
      : 0;

  return (
    <section
      data-testid="compact-source-health"
      data-total-sources={summary.totalSources}
      data-attempted-sources={summary.attemptedSources}
      data-successful-sources={summary.successfulSources}
      data-partial-sources={summary.partiallySuccessfulSources}
      data-failed-sources={summary.failedSources}
      data-manual-verification-sources={summary.manualVerificationSources}
      data-temporarily-unavailable-sources={summary.temporarilyUnavailableSources}
      data-waiting-sources={summary.waitingSources}
      data-not-tested-sources={summary.notTestedSources}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden"
    >
      {/* Compact Single-Row Health Summary */}
      <div className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-100">
            <Activity className={`w-3.5 h-3.5 ${syncing ? 'text-emerald-600 animate-pulse' : 'text-emerald-600'}`} />
            <span>{bn ? 'লাইভ সোর্স:' : 'Live Sources:'}</span>
            <span className="text-slate-900 dark:text-white font-bold">
              {formatSourceHealthHeadline(summary, bn)}
            </span>
          </span>

          {summary.successfulSources > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800">
              <CheckCircle2 className="w-3 h-3" />
              <span>
                {bn
                  ? `সফল: ${toBanglaDigits(summary.successfulSources)}`
                  : `Successful: ${summary.successfulSources}`}
              </span>
            </span>
          )}

          {summary.partiallySuccessfulSources > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800">
              <span>{formatPartialSourcesLabel(summary.partiallySuccessfulSources, bn)}</span>
            </span>
          )}

          {summary.manualVerificationSources > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800">
              <ShieldAlert className="w-3 h-3" />
              <span>{formatManualVerificationSourcesLabel(summary.manualVerificationSources, bn)}</span>
            </span>
          )}

          {summary.temporarilyUnavailableSources > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-50 text-orange-800 border border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800">
              <AlertTriangle className="w-3 h-3" />
              <span>{formatTemporarilyUnavailableSourcesLabel(summary.temporarilyUnavailableSources, bn)}</span>
            </span>
          )}

          {summary.failedSources > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800">
              <AlertTriangle className="w-3 h-3" />
              <span>{formatFailedSourcesLabel(summary.failedSources, bn)}</span>
            </span>
          )}

          {summary.waitingSources > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800">
              <span>{formatWaitingSourcesLabel(summary.waitingSources, bn)}</span>
            </span>
          )}

          {summary.notTestedSources > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
              <span>{formatNotTestedSourcesLabel(summary.notTestedSources, bn)}</span>
            </span>
          )}

          <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {syncing && progress?.activeSourceName
              ? `${bn ? 'যাচাই হচ্ছে:' : 'Checking:'} ${progress.activeSourceName} (${progress.completed}/${progress.total})`
              : `${bn ? 'সর্বশেষ আপডেট:' : 'Last Updated:'} ${
                  lastUpdatedTs ? new Date(lastUpdatedTs).toLocaleString() : bn ? 'এখনো হয়নি' : 'Not synced'
                }`}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {retryableIds.length > 0 && (
            <button
              type="button"
              onClick={() => onRetryFailed(retryableIds)}
              disabled={syncing}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-semibold bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 cursor-pointer transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
              <span>{bn ? 'ব্যর্থ সোর্স পুনরায় চেষ্টা করুন' : 'Retry Failed Sources'}</span>
            </button>
          )}

          <button
            type="button"
            data-testid="source-health-details-toggle"
            onClick={onToggleExpanded}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-semibold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors"
          >
            <History className="w-3 h-3 text-emerald-600" />
            <span>{bn ? 'বিস্তারিত দেখুন' : 'Sources & Sync Log'}</span>
          </button>
        </div>
      </div>

      {/* Compact 3px Live Progress Strip */}
      {syncing && (
        <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 overflow-hidden" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
          <div
            className="h-full bg-emerald-600 transition-all duration-300"
            style={{ width: `${Math.max(12, progressPct)}%` }}
          />
        </div>
      )}

      {/* Expandable Full Source Technical Panel (Hidden by Default) */}
      {expanded && (
        <div
          ref={panelRef}
          role="region"
          aria-label={panelHeading || (bn ? 'সোর্স স্ট্যাটাস বিস্তারিত' : 'Configured Sources & Recent Sync History')}
          className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-4 space-y-4"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h2 className="text-xs font-semibold tracking-wide text-slate-800 dark:text-slate-100">
                {panelHeading || (bn ? 'কনফিগারকৃত সূত্রের অবস্থা ও সিঙ্ক ইতিহাস' : 'Configured Sources & Recent Sync History')}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {bn ? 'শুধুমাত্র পাবলিক GET রিকোয়েস্ট • কোনো প্রোফাইল তথ্য পাঠানো হয় না' : 'Read-only public GET access • Zero user profile data transmitted'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {retryableIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => onRetryFailed(retryableIds)}
                  disabled={syncing}
                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-semibold bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
                  <span>{bn ? 'ব্যর্থ সূত্র পুনরায় চেষ্টা' : 'Retry Failed Only'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={onToggleExpanded}
                aria-label={bn ? 'বিস্তারিত বন্ধ করুন' : 'Close Sources Details'}
                className="p-1 rounded-lg text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {summary.sources.map((item) => {
              const isCaptchaCard =
                item.centralizedStatus === 'MANUAL_VERIFICATION_REQUIRED' || item.blockedByCaptcha;
              const cachedSourceCount = jobs.filter((j) => j.sourceId === item.sourceId).length;
              const relatedBankCount =
                item.sourceId === 'bangladesh_bank'
                  ? jobs.filter((j) => j.category === 'Bank').length
                  : 0;
              const badgeClass =
                item.centralizedStatus === 'SUCCESS'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                  : item.centralizedStatus === 'PARTIAL_SUCCESS' || isCaptchaCard
                    ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                    : item.centralizedStatus === 'TEMPORARILY_UNAVAILABLE'
                      ? 'bg-orange-50 text-orange-800 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800'
                      : item.centralizedStatus === 'FAILED'
                        ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                        : item.centralizedStatus === 'WAITING'
                          ? 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800'
                          : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
              const targetPortalUrl = item.openPortalUrl || item.directPortalUrl;
              const safePortalUrl = verifyJobUrl(targetPortalUrl).isSafeToOpen
                ? targetPortalUrl
                : '#';
              const cardStatusLabel = formatSourceStatusLabel(item.status, bn);
              const displayedError = item.sanitizedError || item.error;
              const hasBreakdownCounts =
                item.insertedCount > 0 ||
                item.updatedCount > 0 ||
                item.duplicateCount > 0 ||
                item.rejectedCount > 0 ||
                item.totalIndexedCount > 0;

              return (
                <div
                  key={item.sourceId}
                  data-source-id={item.sourceId}
                  data-source-status={item.status}
                  data-centralized-status={item.centralizedStatus}
                  data-blocked-by-captcha={isCaptchaCard ? 'true' : 'false'}
                  className={`p-3 rounded-xl bg-white dark:bg-slate-900 border text-xs space-y-1.5 ${
                    isCaptchaCard
                      ? 'border-amber-200 dark:border-amber-800/80'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-800 dark:text-white truncate">{item.sourceName}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${badgeClass}`}>
                      {cardStatusLabel}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap text-[10.5px] text-slate-500">
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-medium text-slate-700 dark:text-slate-300">
                      {item.accessMethodType}
                    </span>
                    <span>•</span>
                    <span>{item.publisherType}</span>
                    {item.cacheOnly && (
                      <span className="px-1.5 py-0.5 rounded bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 font-medium text-[10px]">
                        {bn ? 'ক্যাশ' : 'Cached'}
                      </span>
                    )}
                    {item.httpStatus !== null && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px] text-slate-600 dark:text-slate-300">
                        HTTP {item.httpStatus}
                      </span>
                    )}
                  </div>

                  {isCaptchaCard && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[10.5px] font-semibold text-amber-800 dark:text-amber-300">
                      <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                      <span>
                        {bn
                          ? 'স্বয়ংক্রিয় সংগ্রহ: ক্যাপচা দ্বারা সীমাবদ্ধ'
                          : 'Automatic Fetch: Halted (CAPTCHA/Anti-Bot)'}
                      </span>
                    </div>
                  )}

                  {isCaptchaCard ? (
                    <div className="space-y-1">
                      <p className="text-[11px] text-slate-600 dark:text-slate-300">
                        {bn
                          ? 'অফিশিয়াল পোর্টালটি খুলুন; ব্রাউজার ট্যাবে সার্কুলার তালিকা লোড হলে "খোলা ট্যাব থেকে সিঙ্ক" বা ম্যানুয়াল যোগ ব্যবহার করুন।'
                          : 'Open Official Portal in your browser; once notices load in your tab, click "Sync from Open Tab" or add manually.'}
                      </p>
                      {displayedError && (
                        <p className="text-[10.5px] text-amber-700 dark:text-amber-400">
                          Error: {displayedError}
                        </p>
                      )}
                      {(cachedSourceCount > 0 || relatedBankCount > 0) && (
                        <div className="flex flex-wrap items-center gap-2 text-[10.5px] text-emerald-700 dark:text-emerald-300">
                          <span>
                            {bn
                              ? `হাব-এ ব্যাংক সার্কুলার: ${toBanglaDigits(relatedBankCount)}টি${cachedSourceCount > 0 ? ` (BB ক্যাশ: ${toBanglaDigits(cachedSourceCount)}টি)` : ''}`
                              : `Bank circulars in Hub: ${relatedBankCount}${cachedSourceCount > 0 ? ` (${cachedSourceCount} cached BB)` : ''}`}
                          </span>
                          {relatedBankCount > 0 && onViewBankJobs && (
                            <button
                              type="button"
                              onClick={onViewBankJobs}
                              className="underline font-semibold hover:text-emerald-900 dark:hover:text-emerald-200 cursor-pointer"
                            >
                              {bn ? 'ব্যাংক চাকরি দেখুন' : 'View Bank Jobs'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {displayedError && (
                        <p className="text-[11px] text-rose-600 dark:text-rose-400">
                          Error: {displayedError}
                        </p>
                      )}
                      {item.dataCoverageNote && (
                        <p className="text-[10.5px] text-amber-800 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/70 rounded-md px-2 py-1">
                          {item.dataCoverageNote}
                        </p>
                      )}
                      {item.deadlineVerificationNote && (
                        <p className="text-[10.5px] font-medium text-slate-600 dark:text-slate-300">
                          {item.deadlineVerificationNote}
                        </p>
                      )}
                      {!displayedError && !item.dataCoverageNote && item.accessNotes && (
                        <p className="text-[11px] line-clamp-2 text-slate-500 dark:text-slate-400">
                          {item.accessNotes}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-1 text-[10.5px] text-slate-500 dark:text-slate-400 pt-0.5">
                    <span>
                      {bn ? 'প্রাপ্ত রেকর্ড:' : 'Records Retrieved:'}{' '}
                      <strong className="text-slate-700 dark:text-slate-200">{item.retrievedCount}</strong>
                    </span>
                    <span>
                      {bn ? 'সংরক্ষিত রেকর্ড:' : 'Records Saved:'}{' '}
                      <strong className="text-slate-700 dark:text-slate-200">{item.savedCount}</strong>
                    </span>
                    {hasBreakdownCounts && (
                      <span className="col-span-2 text-[10px] text-slate-500 dark:text-slate-400">
                        {bn
                          ? `নতুন: ${toBanglaDigits(item.insertedCount)} • আপডেট: ${toBanglaDigits(item.updatedCount)} • ডুপ্লিকেট: ${toBanglaDigits(item.duplicateCount)} • মোট ইনডেক্স: ${toBanglaDigits(item.totalIndexedCount)}${item.rejectedCount > 0 ? ` • বাতিল: ${toBanglaDigits(item.rejectedCount)}` : ''}`
                          : `New: ${item.insertedCount} • Updated: ${item.updatedCount} • Duplicates: ${item.duplicateCount} • Indexed: ${item.totalIndexedCount}${item.rejectedCount > 0 ? ` • Rejected: ${item.rejectedCount}` : ''}`}
                      </span>
                    )}
                    <span className="col-span-2 truncate">
                      {bn ? 'সর্বশেষ চেষ্টা:' : 'Last Attempted:'}{' '}
                      {item.lastCheckedAt
                        ? new Date(item.lastCheckedAt).toLocaleString()
                        : bn ? 'পরীক্ষিত নয়' : 'Not Tested'}
                    </span>
                    <span className="col-span-2 truncate">
                      {bn ? 'সর্বশেষ সফল:' : 'Last Successful:'}{' '}
                      {item.lastSuccessfulFetchAt
                        ? new Date(item.lastSuccessfulFetchAt).toLocaleString()
                        : bn ? 'এখনো সফল হয়নি' : 'Never'}
                    </span>
                    <span className="col-span-2 truncate text-[10px] text-slate-400 dark:text-slate-500">
                      {bn ? 'পুনঃচেষ্টা:' : 'Retry Availability:'} {formatRetryAvailabilityNote(item, bn)}
                    </span>
                  </div>

                  {isCaptchaCard ? (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                      <a
                        href={safePortalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                      >
                        <span>{bn ? 'অফিশিয়াল পোর্টাল খুলুন' : 'Open Official Portal'}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      {item.sourceId === 'bangladesh_bank' && onSyncFromOpenTab && (
                        <button
                          type="button"
                          onClick={() => onSyncFromOpenTab(item)}
                          disabled={syncing}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10.5px] font-semibold bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>{bn ? 'খোলা ট্যাব থেকে সিঙ্ক' : 'Sync from Open Tab'}</span>
                        </button>
                      )}
                      {onOpenManualAdd && (
                        <button
                          type="button"
                          onClick={() => onOpenManualAdd(item)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10.5px] font-semibold bg-petro-600 hover:bg-petro-700 text-white cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>{bn ? 'ম্যানুয়াল সার্কুলার যোগ করুন' : 'Add Circular Manually'}</span>
                        </button>
                      )}
                      {onRetrySingleSource && (
                        <button
                          type="button"
                          onClick={() => onRetrySingleSource(item.sourceId)}
                          disabled={syncing || !item.retryAvailable}
                          title={formatRetryAvailabilityNote(item, bn)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10.5px] font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                        >
                          <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
                          <span>{bn ? 'আবার যাচাই করুন' : 'Check Again'}</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                      <a
                        href={safePortalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold hover:underline inline-flex items-center gap-1"
                      >
                        <span>{item.officialDomain}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      {onRetrySingleSource && (
                        <button
                          type="button"
                          onClick={() => onRetrySingleSource(item.sourceId)}
                          disabled={syncing || !item.retryAvailable}
                          title={formatRetryAvailabilityNote(item, bn)}
                          className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                        >
                          {bn ? 'পুনরায় চেষ্টা' : 'Retry'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {syncHistory.length > 0 && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {bn ? 'সাম্প্রতিক সিঙ্ক লগ' : 'Sync History Log'}
              </div>
              <div className="space-y-1 max-h-36 overflow-y-auto text-[11px]">
                {syncHistory.map((h) => (
                  <div
                    key={h.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300"
                  >
                    <span className="font-medium">{new Date(h.syncedAt).toLocaleString()}</span>
                    <span>
                      Retrieved: <strong>{h.totalRetrieved}</strong> • New: <strong>{h.newJobsCount}</strong> • Updated:{' '}
                      <strong>{h.updatedJobsCount}</strong> • Deduplicated: <strong>{h.duplicatesRemoved}</strong>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {footerContent && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              {footerContent}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
