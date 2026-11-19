// JobFill BD - CAPTCHA-Aware Extraction Status & Human Verification Panel
// Displays live extraction lifecycle state across 11 distinct phases:
// 1. Connecting, 2. Checking Source, 3. Extracting, 4. Validating, 5. Saving,
// 6. Completed, 7. CAPTCHA Required, 8. Access Restricted, 9. Rate Limited,
// 10. Failed, 11. Paused.
// Provides ethical human-in-the-loop controls without automating or bypassing anti-bot challenges.

import React from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Clock,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Plus,
  Play,
  Pause,
  X,
  ShieldCheck,
} from 'lucide-react';

export type ExtractionLifecycleState =
  | 'connecting'
  | 'checking_source'
  | 'extracting'
  | 'validating'
  | 'saving'
  | 'completed'
  | 'captcha_required'
  | 'access_restricted'
  | 'rate_limited'
  | 'failed'
  | 'paused';

interface CaptchaExtractionPanelProps {
  state: ExtractionLifecycleState;
  activeSourceName?: string;
  retrievedCount: number;
  savedCount: number;
  errorMessage?: string | null;
  retryAfterMs?: number | null;
  portalUrl?: string;
  canResume?: boolean;
  onResume?: () => void;
  onOpenPortal?: () => void;
  onOpenManualAdd?: () => void;
  onDismiss?: () => void;
  bn?: boolean;
}

export const CaptchaExtractionPanel: React.FC<CaptchaExtractionPanelProps> = ({
  state,
  activeSourceName,
  retrievedCount,
  savedCount,
  errorMessage,
  retryAfterMs,
  portalUrl,
  canResume = false,
  onResume,
  onOpenPortal,
  onOpenManualAdd,
  onDismiss,
  bn = false,
}) => {
  // Label and styling based on 11 lifecycle states
  const getStateConfig = () => {
    switch (state) {
      case 'connecting':
        return {
          label: bn ? 'সংযোগ স্থাপন হচ্ছে...' : 'Connecting...',
          bg: 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800',
          textColor: 'text-slate-800 dark:text-slate-200',
          icon: <RefreshCw className="w-4 h-4 animate-spin text-petro-600" />,
        };
      case 'checking_source':
        return {
          label: bn ? 'উৎস যাচাই হচ্ছে...' : 'Checking Source...',
          bg: 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800',
          textColor: 'text-slate-800 dark:text-slate-200',
          icon: <RefreshCw className="w-4 h-4 animate-spin text-petro-600" />,
        };
      case 'extracting':
        return {
          label: bn ? 'তথ্য সংগ্রহ চলছে...' : 'Extracting Job Data...',
          bg: 'bg-petro-50/60 dark:bg-petro-950/30 border-petro-200 dark:border-petro-800',
          textColor: 'text-petro-900 dark:text-petro-200',
          icon: <RefreshCw className="w-4 h-4 animate-spin text-petro-600" />,
        };
      case 'validating':
        return {
          label: bn ? 'বিজ্ঞপ্তি ও সময়সীমা যাচাই...' : 'Validating Deadlines...',
          bg: 'bg-petro-50/60 dark:bg-petro-950/30 border-petro-200 dark:border-petro-800',
          textColor: 'text-petro-900 dark:text-petro-200',
          icon: <ShieldCheck className="w-4 h-4 text-petro-600" />,
        };
      case 'saving':
        return {
          label: bn ? 'ডাটাবেজে সংরক্ষণ হচ্ছে...' : 'Saving to Database...',
          bg: 'bg-petro-50/60 dark:bg-petro-950/30 border-petro-200 dark:border-petro-800',
          textColor: 'text-petro-900 dark:text-petro-200',
          icon: <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />,
        };
      case 'completed':
        return {
          label: bn ? 'সংগ্রহ সম্পন্ন' : 'Extraction Completed',
          bg: 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
          textColor: 'text-emerald-900 dark:text-emerald-200',
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
        };
      case 'captcha_required':
        return {
          label: bn ? 'ক্যাপচা যাচাই প্রয়োজন' : 'Human Verification Required',
          bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800',
          textColor: 'text-amber-900 dark:text-amber-200',
          icon: <ShieldAlert className="w-4 h-4 text-amber-600" />,
        };
      case 'access_restricted':
        return {
          label: bn ? 'অ্যাক্সেস সংরক্ষিত / সীমাবদ্ধ' : 'Access Restricted',
          bg: 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900',
          textColor: 'text-rose-900 dark:text-rose-200',
          icon: <AlertTriangle className="w-4 h-4 text-rose-600" />,
        };
      case 'rate_limited':
        return {
          label: bn ? 'রিকোয়েস্ট সীমা অতিক্রম (429)' : 'Rate Limited (HTTP 429)',
          bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900',
          textColor: 'text-amber-900 dark:text-amber-200',
          icon: <Clock className="w-4 h-4 text-amber-600" />,
        };
      case 'paused':
        return {
          label: bn ? 'সাময়িক বিরতি' : 'Extraction Paused',
          bg: 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700',
          textColor: 'text-slate-800 dark:text-slate-200',
          icon: <Pause className="w-4 h-4 text-slate-600" />,
        };
      case 'failed':
      default:
        return {
          label: bn ? 'সংগ্রহ ব্যর্থ' : 'Extraction Failed',
          bg: 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900',
          textColor: 'text-rose-900 dark:text-rose-200',
          icon: <AlertTriangle className="w-4 h-4 text-rose-600" />,
        };
    }
  };

  const config = getStateConfig();

  return (
    <div
      role="region"
      aria-label={bn ? 'ডাটা সংগ্রহ ও নিরাপত্তা অবস্থা' : 'Extraction and security status'}
      className={`rounded-2xl border p-4 transition-all shadow-xs space-y-3 ${config.bg}`}
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {config.icon}
          <span className={`text-xs font-bold uppercase tracking-wide ${config.textColor}`}>
            {config.label}
          </span>
          {activeSourceName && (
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
              — {activeSourceName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <span>
            {bn ? `সংগৃহীত: ${retrievedCount}` : `Retrieved: ${retrievedCount}`}
          </span>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span className="text-emerald-700 dark:text-emerald-400 font-bold">
            {bn ? `সংরক্ষিত: ${savedCount}` : `Saved: ${savedCount}`}
          </span>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss panel"
              className="p-1 hover:text-slate-900 dark:hover:text-white rounded-md cursor-pointer ml-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Human Verification Guidance Alert */}
      {state === 'captcha_required' && (
        <div className="bg-white/90 dark:bg-slate-900/90 rounded-xl p-3.5 border border-amber-300 dark:border-amber-700 text-xs text-amber-950 dark:text-amber-100 space-y-2">
          <p className="font-medium leading-relaxed">
            {bn
              ? 'ওয়েবসাইটটিতে নিরাপত্তা যাচাই (ক্যাপচা) সক্রিয় রয়েছে। অনুগ্রহ করে অফিসিয়াল ব্রাউজার ট্যাবে সরাসরি যাচাই সম্পন্ন করুন। JobFill BD স্বয়ংক্রিয়ভাবে কোনো ক্যাপচা বাইপাস বা সলভ করে না। যাচাই শেষ হলে নিচে "Resume Extraction" ক্লিক করুন।'
              : 'Human verification required. Please complete the verification directly on the website. JobFill BD will not solve or bypass the challenge. After completing it, return and select Resume Extraction.'}
          </p>

          <div className="flex items-center gap-2 pt-1 flex-wrap">
            {portalUrl && onOpenPortal && (
              <button
                type="button"
                onClick={onOpenPortal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{bn ? 'অফিশিয়াল পোর্টাল খুলুন' : 'Open Portal in Browser'}</span>
              </button>
            )}

            {onResume && (
              <button
                type="button"
                onClick={onResume}
                disabled={!canResume}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                  canResume
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                }`}
              >
                <Play className="w-3.5 h-3.5" />
                <span>{bn ? 'পুনরায় শুরু (Resume)' : 'Resume Extraction'}</span>
              </button>
            )}

            {onOpenManualAdd && (
              <button
                type="button"
                onClick={onOpenManualAdd}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{bn ? 'ম্যানুয়ালি বিজ্ঞপ্তি যোগ করুন' : 'Add Manually'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Rate Limit Alert */}
      {state === 'rate_limited' && (
        <div className="text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between gap-2">
          <span>
            {errorMessage ||
              (bn
                ? 'সার্ভারে অতিরিক্ত রিকোয়েস্ট সীমা পৌঁছেছে। স্বয়ংক্রিয় কুলডাউন বিরতি চলছে।'
                : 'Server rate limit reached. Waiting for Retry-After interval.')}
          </span>
          {retryAfterMs && (
            <span className="font-bold text-[11px] bg-amber-200/80 dark:bg-amber-900/60 px-2 py-0.5 rounded-md">
              {Math.ceil(retryAfterMs / 1000)}s
            </span>
          )}
        </div>
      )}

      {/* General Error Alert */}
      {(state === 'failed' || state === 'access_restricted') && errorMessage && (
        <div className="text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2">
          <span>{errorMessage}</span>
          {onOpenManualAdd && (
            <button
              type="button"
              onClick={onOpenManualAdd}
              className="font-bold underline hover:text-rose-900 dark:hover:text-rose-100 shrink-0 cursor-pointer"
            >
              {bn ? 'ম্যানুয়ালি যোগ করুন' : 'Add Job Manually'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
