// JobFill BD - Verified Deadline Countdown Component
// Displays exact remaining time for verified deadlines in Asia/Dhaka,
// or "Deadline Not Verified" without ever inventing a countdown.

import React from 'react';
import { Clock, AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';
import { calculateRemainingTime } from '../services/deadline-parser';

interface DeadlineCountdownProps {
  deadlineAt: number | null;
  deadlineVerified: boolean;
  language?: 'bn' | 'en';
  compact?: boolean;
}

export const DeadlineCountdown: React.FC<DeadlineCountdownProps> = ({
  deadlineAt,
  deadlineVerified,
  language = 'en',
  compact = false,
}) => {
  const info = calculateRemainingTime(deadlineAt, deadlineVerified);
  const bn = language === 'bn';

  if (!info.isVerified) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full font-semibold border bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 ${
          compact ? 'text-[10.5px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
        }`}
      >
        <HelpCircle className="w-3 h-3 shrink-0" />
        <span>{bn ? 'শেষ তারিখ যাচাইকৃত নয়' : 'Deadline Not Verified'}</span>
      </span>
    );
  }

  if (info.isExpired) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full font-bold border bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 ${
          compact ? 'text-[10.5px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
        }`}
      >
        <AlertTriangle className="w-3 h-3 shrink-0" />
        <span>{bn ? 'সময় শেষ (Expired)' : 'Expired (Deadline Passed)'}</span>
      </span>
    );
  }

  if (info.urgencyTier === 'critical_lt_2h' || info.urgencyTier === 'urgent_24h') {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full font-bold border bg-rose-600 text-white border-rose-700 shadow-sm ${
          compact ? 'text-[10.5px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
        }`}
      >
        <AlertTriangle className="w-3 h-3 shrink-0 animate-pulse" />
        <span>URGENT: {bn ? info.labelBn : info.labelEn}</span>
      </span>
    );
  }

  if (info.urgencyTier === 'urgent_48h') {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full font-bold border bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 ${
          compact ? 'text-[10.5px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
        }`}
      >
        <Clock className="w-3 h-3 shrink-0" />
        <span>{bn ? `জরুরি: ${info.labelBn}` : `Closing Soon: ${info.labelEn}`}</span>
      </span>
    );
  }

  if (info.urgencyTier === 'closing_soon_7d') {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full font-semibold border bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-800 ${
          compact ? 'text-[10.5px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
        }`}
      >
        <Clock className="w-3 h-3 shrink-0" />
        <span>{bn ? info.labelBn : info.labelEn}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold border bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 ${
        compact ? 'text-[10.5px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
      }`}
    >
      <CheckCircle2 className="w-3 h-3 shrink-0" />
      <span>{bn ? info.labelBn : info.labelEn}</span>
    </span>
  );
};
