// JobFill BD - Smart Auto Fill Guided Page
// Inspects and controls the real active recruitment form tab via Chrome Extension Messaging
// (DETECT_FORM, AUTO_FILL_NOW, UNDO_LAST_FILL, OPEN_REVIEW_MODAL). Never uses fake demo fills.

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { isExcludedSiteUrl } from '../../security/site-policy';
import { recordExtensionDiagnostic } from '../../security/diagnostics';
import { Play, CheckCircle, AlertTriangle, RotateCcw, ExternalLink, ShieldCheck, Sparkles, SlidersHorizontal } from 'lucide-react';

interface RealScanFieldItem {
  label: string;
  value: string;
  status: string;
  approved: boolean;
  hasConflict: boolean;
}

interface RealTabScanState {
  tabId: number;
  tabUrl: string;
  organization: string;
  platform: string;
  pageTitle: string;
  totalDetected: number;
  matchedCount: number;
  readyToFillCount: number;
  alreadyCorrectCount: number;
  missingInfoCount: number;
  conflictsCount: number;
  ambiguousCount: number;
  confirmationRequiredCount: number;
  documentFieldCount: number;
  activeProfileName: string;
  isVaultLocked?: boolean;
  planSummary: RealScanFieldItem[];
}

export const SmartAutoFillPage: React.FC = () => {
  const { language, showToast } = useApp();
  const bn = language === 'bn';
  const [isScanning, setIsScanning] = useState(false);
  const [isFilling, setIsFilling] = useState(false);
  const [scanState, setScanState] = useState<RealTabScanState | null>(null);
  const [scanError, setScanError] = useState('');
  const [fillReport, setFillReport] = useState<{
    successfullyFilled: number;
    alreadyCorrect: number;
    missingInfo: number;
    failed: number;
  } | null>(null);

  const findTargetRecruitmentTab = async (): Promise<chrome.tabs.Tab | null> => {
    if (typeof chrome === 'undefined' || !chrome.tabs?.query) return null;
    const allTabs = await chrome.tabs.query({});
    const candidates = allTabs.filter((t) => {
      if (!t.id || !t.url) return false;
      if (isExcludedSiteUrl(t.url)) return false;
      if (t.url.includes('dashboard.html')) return false;
      return true;
    });
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
    return candidates[0];
  };

  const handleScanForm = async () => {
    setIsScanning(true);
    setScanError('');
    setFillReport(null);

    try {
      const targetTab = await findTargetRecruitmentTab();
      if (!targetTab || !targetTab.id || !targetTab.url || isExcludedSiteUrl(targetTab.url)) {
        if (targetTab?.url && isExcludedSiteUrl(targetTab.url)) {
          recordExtensionDiagnostic('excluded_site_detected', {
            url: targetTab.url,
            source: 'SmartAutoFillPage.handleScanForm',
          });
          recordExtensionDiagnostic('script_injection_blocked', {
            url: targetTab.url,
            source: 'SmartAutoFillPage.handleScanForm',
          });
        }
        setScanState(null);
        setScanError(
          bn
            ? 'কোনো সক্রিয় ওয়েব আবেদন ট্যাব পাওয়া যায়নি। নিচের যেকোনো টেস্ট ফর্ম বা চাকরির আবেদন পেজ খুলুন।'
            : 'No active recruitment web tab found. Open a job application portal or one of the offline test forms below.'
        );
        return;
      }

      let response: any = null;
      try {
        response = await chrome.tabs.sendMessage(targetTab.id, { action: 'DETECT_FORM' });
      } catch {
        if (!isExcludedSiteUrl(targetTab.url) && chrome.scripting) {
          recordExtensionDiagnostic('script_injection_allowed', {
            url: targetTab.url,
            source: 'SmartAutoFillPage.executeScript',
          });
          await chrome.scripting.insertCSS({ target: { tabId: targetTab.id }, files: ['content.css'] });
          await chrome.scripting.executeScript({ target: { tabId: targetTab.id }, files: ['content.js'] });
          await new Promise((r) => setTimeout(r, 200));
          response = await chrome.tabs.sendMessage(targetTab.id, { action: 'DETECT_FORM' });
        }
      }

      if (!response || response.status !== 'ok') {
        setScanState(null);
        setScanError(bn ? 'ট্যাবটি স্ক্যান করা যায়নি।' : 'Could not scan the selected tab.');
        return;
      }

      if (!response.hasJobForm) {
        setScanState(null);
        setScanError(
          bn
            ? `"${targetTab.title || targetTab.url}" ট্যাবে কোনো আবেদন ফর্ম শনাক্ত হয়নি।`
            : `No supported job application form detected on "${targetTab.title || targetTab.url}".`
        );
        return;
      }

      setScanState({
        tabId: targetTab.id,
        tabUrl: targetTab.url,
        organization: response.organization || 'Recruitment Portal',
        platform: response.platform || 'Web Form',
        pageTitle: response.pageTitle || targetTab.title || 'Application Form',
        totalDetected: response.totalDetected || 0,
        matchedCount: response.matchedCount || 0,
        readyToFillCount: response.readyToFillCount || 0,
        alreadyCorrectCount: response.alreadyCorrectCount || 0,
        missingInfoCount: response.missingInfoCount || 0,
        conflictsCount: response.conflictsCount || 0,
        ambiguousCount: response.ambiguousCount || 0,
        confirmationRequiredCount: response.confirmationRequiredCount || 0,
        documentFieldCount: response.documentFieldCount || 0,
        activeProfileName: response.activeProfileName || 'Active Profile',
        isVaultLocked: Boolean(response.isVaultLocked),
        planSummary: response.planSummary || [],
      });

      showToast(
        bn
          ? `✅ স্ক্যান সম্পন্ন! ${response.totalDetected || 0}টি ইনপুট ফিল্ড শনাক্ত হয়েছে।`
          : `✅ Real tab scan complete! ${response.totalDetected || 0} inputs detected.`
      );
    } catch (err: any) {
      setScanState(null);
      setScanError(err?.message || 'Tab scan failed');
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.tabs && typeof chrome.tabs.query === 'function') {
      handleScanForm().catch(() => {});
    }
  }, []);

  const handleExecuteRealFill = async () => {
    if (!scanState || isExcludedSiteUrl(scanState.tabUrl)) return;
    setIsFilling(true);
    try {
      const res = await chrome.tabs.sendMessage(scanState.tabId, { action: 'AUTO_FILL_NOW' });
      if (res?.status === 'ok' && res.report) {
        setFillReport(res.report);
        showToast(
          bn
            ? `⚡ ${res.report.successfullyFilled}টি ফিল্ড সফলভাবে পূরণ ও যাচাই হয়েছে!`
            : `⚡ ${res.report.successfullyFilled} fields filled and verified on tab!`
        );
      } else {
        setScanError(res?.error || 'Could not execute autofill.');
      }
    } catch (err: any) {
      setScanError(err?.message || 'Autofill communication failed.');
    } finally {
      setIsFilling(false);
    }
  };

  const handleOpenInPageReview = async () => {
    if (!scanState || isExcludedSiteUrl(scanState.tabUrl)) return;
    try {
      await chrome.tabs.update(scanState.tabId, { active: true });
      await chrome.tabs.sendMessage(scanState.tabId, { action: 'OPEN_REVIEW_MODAL' });
    } catch (err: any) {
      setScanError(err?.message || 'Could not open review modal on target tab.');
    }
  };

  const handleUndoReal = async () => {
    if (!scanState || isExcludedSiteUrl(scanState.tabUrl)) return;
    try {
      const res = await chrome.tabs.sendMessage(scanState.tabId, { action: 'UNDO_LAST_FILL' });
      setFillReport(null);
      showToast(
        bn
          ? `↩️ ${res?.restoredCount ?? 0}টি ফিল্ড আগের অবস্থায় ফিরিয়ে আনা হয়েছে।`
          : `↩️ Restored ${res?.restoredCount ?? 0} field(s) on target tab.`
      );
      await handleScanForm();
    } catch (err: any) {
      setScanError(err?.message || 'Undo failed.');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
          <Sparkles className="text-emerald-600" size={24} />
          {bn ? 'স্মার্ট অটো-ফিল অ্যাসিস্ট্যান্ট (Smart Auto Fill)' : 'Smart Auto Fill Assistant'}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {bn
            ? 'খোলা চাকরির আবেদন ট্যাব স্ক্যান করে রিয়েল-টাইম ফিল্ড ম্যাচিং, রিভিউ ও অটো-ফিল পরিচালনা করুন।'
            : 'Inspect and execute verified autofill directly on your open recruitment form tab.'}
        </p>
      </div>

      {/* Scan Trigger Card */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1.5 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-400">
            <ShieldCheck size={16} />
            <span>
              {scanState ? `${scanState.organization} (${scanState.platform})` : bn ? 'অ্যাক্টিভ ট্যাব স্ক্যানার' : 'Live Tab Scanner'}
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {scanState ? scanState.pageTitle : bn ? 'রিক্রুটমেন্ট ফর্ম স্ক্যান করুন' : 'Scan Open Recruitment Form Tab'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg truncate">
            {scanState
              ? scanState.tabUrl
              : bn
                ? 'কোনো চাকরির ফর্ম ট্যাব খুলে স্ক্যান বাটনে ক্লিক করুন।'
                : 'Open a job form tab (or test page below) and click Scan Open Tab.'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleScanForm}
          disabled={isScanning}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition disabled:opacity-50 shrink-0 cursor-pointer"
        >
          <Play size={15} fill="currentColor" />
          {isScanning
            ? bn ? 'স্ক্যান হচ্ছে...' : 'Scanning...'
            : bn ? 'ওপেন ট্যাব স্ক্যান করুন' : 'Scan Open Tab'}
        </button>
      </div>

      {/* Offline Test Forms Launcher Bar (dev/testing builds only) */}
      {!(typeof __JOBFILL_STORE_CLEAN__ !== 'undefined' && __JOBFILL_STORE_CLEAN__) && (
      <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-emerald-900 dark:text-emerald-200">
          🧪 {bn ? 'অফলাইন টেস্ট পেজ দিয়ে পরীক্ষা করুন:' : 'Test with local simulation pages:'}
        </span>
        <div className="flex flex-wrap gap-2">
          <a href="test-pages/petrobangla-form.html" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold hover:bg-emerald-100">
            PetroBangla Replica <ExternalLink size={12} />
          </a>
          <a href="test-pages/teletalk-form.html" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold hover:bg-emerald-100">
            Teletalk Alljobs <ExternalLink size={12} />
          </a>
          <a href="test-pages/bpsc-bcs-form.html" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold hover:bg-emerald-100">
            BPSC BCS Form-1 <ExternalLink size={12} />
          </a>
        </div>
      </div>
      )}

      {scanError && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>{scanError}</span>
        </div>
      )}

      {scanState && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-xl font-black text-slate-800 dark:text-white">{scanState.totalDetected}</div>
              <div className="text-[11px] font-semibold text-slate-500 mt-0.5">{bn ? 'মোট ফিল্ড' : 'Inputs Detected'}</div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-xl font-black text-emerald-700 dark:text-emerald-400">{scanState.readyToFillCount}</div>
              <div className="text-[11px] font-semibold text-slate-500 mt-0.5">{bn ? 'পূরণের জন্য প্রস্তুত' : 'Ready to Fill'}</div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-xl font-black text-amber-600">{scanState.confirmationRequiredCount + scanState.conflictsCount}</div>
              <div className="text-[11px] font-semibold text-slate-500 mt-0.5">{bn ? 'রিভিউ প্রয়োজন' : 'Needs Review'}</div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-xl font-black text-slate-500">{scanState.missingInfoCount}</div>
              <div className="text-[11px] font-semibold text-slate-500 mt-0.5">{bn ? 'তথ্য অনুপস্থিত' : 'Missing Info'}</div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                {bn ? 'লাইভ ট্যাব ফিল্ড সারাংশ' : 'Live Tab Field Plan'} ({scanState.activeProfileName})
              </span>
              <span className="text-slate-400">{scanState.planSummary.length} item(s)</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
              {scanState.planSummary.map((item, idx) => (
                <div key={idx} className="p-3 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-800 dark:text-slate-200 truncate">{item.label}</div>
                    <div className="text-[11px] text-slate-500 truncate">{item.value || '(Empty)'}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                    {item.status}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleUndoReal}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold cursor-pointer"
                >
                  <RotateCcw size={13} />
                  {bn ? 'আনডু (Undo)' : 'Undo Last Fill'}
                </button>
                <button
                  type="button"
                  onClick={handleOpenInPageReview}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
                >
                  <SlidersHorizontal size={13} />
                  {bn ? 'ইন-পেজ রিভিউ খুলুন' : 'Open In-Page Review'}
                </button>
              </div>

              <button
                type="button"
                disabled={isFilling || scanState.isVaultLocked}
                onClick={handleExecuteRealFill}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle size={15} />
                {isFilling ? (bn ? 'পূরণ হচ্ছে...' : 'Filling...') : bn ? 'ট্যাবে Auto Fill Now চালান' : 'Execute Auto Fill Now on Tab'}
              </button>
            </div>
          </div>
        </>
      )}

      {fillReport && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center gap-3">
          <CheckCircle size={24} className="text-emerald-600 shrink-0" />
          <div className="text-xs text-slate-700 dark:text-slate-300">
            <strong className="text-emerald-900 dark:text-emerald-200">
              {bn ? 'অটো-ফিল সম্পন্ন হয়েছে!' : 'Autofill Verified on Tab!'}
            </strong>{' '}
            {fillReport.successfullyFilled} filled • {fillReport.alreadyCorrect} already correct • {fillReport.missingInfo} missing • {fillReport.failed} failed.
          </div>
        </div>
      )}
    </div>
  );
};
