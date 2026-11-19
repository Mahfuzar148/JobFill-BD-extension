// JobFill BD - Missing Job Circular Diagnostic Modal
// Lets users diagnose why a circular is not showing up and takes instant corrective action.

import React, { useState } from 'react';
import {
  HelpCircle,
  X,
  Search,
  AlertCircle,
  CheckCircle2,
  Clock,
  Filter,
  ExternalLink,
  Plus,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import {
  CircularDiagnosticEngine,
  CircularDiagnosticReport,
} from '../services/circular-diagnostic';
import { NormalizedJobCircular, JobSearchFilters } from '../types/job.types';

interface MissingCircularDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  allJobs: NormalizedJobCircular[];
  activeFilters: JobSearchFilters;
  language?: 'bn' | 'en';
  onClearFiltersAndView: (job: NormalizedJobCircular) => void;
  onSwitchTabExpired: (job: NormalizedJobCircular) => void;
  onFetchLatest: () => Promise<void>;
  onOpenAddManualModal: (prefillUrl?: string) => void;
}

export const MissingCircularDiagnosticModal: React.FC<MissingCircularDiagnosticModalProps> = ({
  isOpen,
  onClose,
  allJobs,
  activeFilters,
  language = 'en',
  onClearFiltersAndView,
  onSwitchTabExpired,
  onFetchLatest,
  onOpenAddManualModal,
}) => {
  const bn = language === 'bn';
  const [queryInput, setQueryInput] = useState('');
  const [report, setReport] = useState<CircularDiagnosticReport | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);

  if (!isOpen) return null;

  const handleRunDiagnosis = () => {
    if (!queryInput.trim()) return;
    setIsDiagnosing(true);
    try {
      const res = CircularDiagnosticEngine.diagnoseMissingCircular({
        queryUrlOrText: queryInput,
        allStoredJobs: allJobs,
        activeFilters,
      });
      setReport(res);
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRunDiagnosis();
    }
  };

  const handleFetchClick = async () => {
    setFetchLoading(true);
    try {
      await onFetchLatest();
      // Re-run diagnosis after fetch completes
      if (queryInput.trim()) {
        const res = CircularDiagnosticEngine.diagnoseMissingCircular({
          queryUrlOrText: queryInput,
          allStoredJobs: allJobs,
          activeFilters,
        });
        setReport(res);
      }
    } finally {
      setFetchLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-amber-50/50 dark:bg-amber-950/20">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-white">
                {bn ? 'কোনো বিজ্ঞপ্তি খুঁজে পাচ্ছেন না?' : "Can't Find a Job Circular?"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {bn
                  ? 'সার্কুলারের লিঙ্ক বা নাম লিখে তাৎক্ষণিক কারণ বিশ্লেষণ করুন'
                  : 'Enter a circular URL or position title to diagnose why it is not showing'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Query Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {bn ? 'বিজ্ঞপ্তির লিঙ্ক বা নাম লিখুন:' : 'Circular URL or Keywords:'}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    bn
                      ? 'যেমন: bpsc.gov.bd, alljobs.teletalk.com.bd, বা পদের নাম...'
                      : 'e.g. bpsc.gov.bd, alljobs.teletalk.com.bd/bogmc, or position title...'
                  }
                  className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:border-petro-600"
                />
              </div>
              <button
                type="button"
                onClick={handleRunDiagnosis}
                disabled={!queryInput.trim() || isDiagnosing}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs disabled:opacity-50 cursor-pointer transition-colors"
              >
                {bn ? 'বিশ্লেষণ করুন' : 'Diagnose'}
              </button>
            </div>
          </div>

          {/* Diagnostic Result Card */}
          {report && (
            <div
              className={`rounded-xl border p-4 space-y-3 animate-fadeIn ${
                report.resultType === 'FOUND_IN_DATABASE_VISIBLE'
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                  : report.resultType === 'FOUND_IN_DATABASE_HIDDEN_BY_FILTER'
                    ? 'bg-blue-50/70 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
                    : report.resultType === 'FOUND_IN_DATABASE_EXPIRED'
                      ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800'
                      : report.resultType === 'SOURCE_SUPPORTED_NOT_YET_FETCHED'
                        ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {report.resultType === 'FOUND_IN_DATABASE_VISIBLE' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : report.resultType === 'FOUND_IN_DATABASE_HIDDEN_BY_FILTER' ? (
                  <Filter className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                ) : report.resultType === 'FOUND_IN_DATABASE_EXPIRED' ? (
                  <Clock className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    {bn ? report.titleBn : report.titleEn}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {bn ? report.explanationBn : report.explanationEn}
                  </p>
                </div>
              </div>

              {/* Matched Job Preview if exists */}
              {report.matchedJob && (
                <div className="bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60 text-xs space-y-1">
                  <div className="font-bold text-slate-800 dark:text-slate-100">
                    {report.matchedJob.jobTitle}
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    {report.matchedJob.organization} • {report.matchedJob.category}
                  </div>
                  {report.matchedJob.deadlineText && (
                    <div className="text-[11px] text-slate-600 dark:text-slate-400">
                      {bn ? 'শেষ তারিখ:' : 'Deadline:'} <strong>{report.matchedJob.deadlineText}</strong>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-1 flex items-center gap-2 flex-wrap">
                {report.recommendedAction === 'CLEAR_FILTERS' && report.matchedJob && (
                  <button
                    type="button"
                    onClick={() => {
                      onClearFiltersAndView(report.matchedJob!);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                  >
                    <span>{bn ? 'ফিল্টার রিসেট করে চাকরিটি দেখুন' : 'Reset Filters & View Job'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {report.recommendedAction === 'SWITCH_TAB_EXPIRED' && report.matchedJob && (
                  <button
                    type="button"
                    onClick={() => {
                      onSwitchTabExpired(report.matchedJob!);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
                  >
                    <span>{bn ? 'মেয়াদোত্তীর্ণ ট্যাবে দেখুন' : 'View in Expired Jobs Tab'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {report.recommendedAction === 'VIEW_JOB' && report.matchedJob && (
                  <button
                    type="button"
                    onClick={() => {
                      onClearFiltersAndView(report.matchedJob!);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                  >
                    <span>{bn ? 'সার্কুলারটি দেখুন' : 'View Circular Details'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {report.recommendedAction === 'FETCH_LATEST' && (
                  <button
                    type="button"
                    onClick={handleFetchClick}
                    disabled={fetchLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${fetchLoading ? 'animate-spin' : ''}`} />
                    <span>{fetchLoading ? (bn ? 'সিঙ্ক হচ্ছে...' : 'Fetching...') : bn ? 'এখনই আপডেট চেক করুন' : 'Fetch Latest Now'}</span>
                  </button>
                )}

                {report.recommendedAction === 'ADD_MANUALLY' && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAddManualModal(queryInput);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-petro-600 hover:bg-petro-700 text-white cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{bn ? 'বিজ্ঞপ্তিটি ম্যানুয়ালি যোগ করুন' : 'Add Circular Manually'}</span>
                  </button>
                )}

                {report.actionUrl && (
                  <a
                    href={report.actionUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{bn ? 'অফিসিয়াল লিঙ্ক খুলুন' : 'Open Link'}</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Quick Guidance Info Box */}
          <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-400 space-y-1">
            <div className="font-bold text-slate-700 dark:text-slate-300">
              💡 {bn ? 'সার্কুলার না পাওয়ার সাধারণ কারণসমূহ:' : 'Common Reasons Circulars Are Missed:'}
            </div>
            <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
              <li>{bn ? 'সক্রিয় ফিল্টার (ক্যাটাগরি/গ্রেড/সময়সীমা) দ্বারা লুকানো রয়েছে।' : 'Hidden by an active filter (Category, Grade, Location, or Deadline).'}</li>
              <li>{bn ? 'আবেদনের শেষ তারিখ পেরিয়ে গেছে (মেয়াদোত্তীর্ণ সার্কুলার)।' : 'Official application deadline has passed.'}</li>
              <li>{bn ? 'বিজ্ঞপ্তিটি অন্য কোনো পেজে রয়েছে যা এখনও সিঙ্ক হয়নি।' : 'Published on a source page not yet fetched.'}</li>
              <li>{bn ? 'ওয়েবসাইটটিতে CAPTCHA বা প্রাইভেট লগইন সুরক্ষা রয়েছে।' : 'Source portal is protected by CAPTCHA or private login.'}</li>
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
          >
            {bn ? 'বন্ধ করুন' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
