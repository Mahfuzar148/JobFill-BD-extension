import React from 'react';
import { Zap, RotateCw, ExternalLink, SlidersHorizontal } from 'lucide-react';

interface AutoFillButtonProps {
  onAutoFill: () => void;
  onScanAgain: () => void;
  onReviewFields: () => void;
  onOpenDashboard: () => void;
  disabled?: boolean;
  isLoading?: boolean;
}

export const AutoFillButton: React.FC<AutoFillButtonProps> = ({
  onAutoFill,
  onScanAgain,
  onReviewFields,
  onOpenDashboard,
  disabled = false,
  isLoading = false,
}) => {
  return (
    <div className="space-y-2.5 pt-1">
      <button
        onClick={onAutoFill}
        disabled={disabled || isLoading}
        className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98] ${
          disabled || isLoading
            ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
            : 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-emerald-600/25 hover:shadow-emerald-600/35 cursor-pointer'
        }`}
      >
        {isLoading ? (
          <>
            <RotateCw className="w-4 h-4 animate-spin text-white" />
            <span>Scanning & Populating Form...</span>
          </>
        ) : (
          <>
            <Zap className="w-4 h-4 fill-current text-emerald-200" />
            <span>Auto Fill Now</span>
          </>
        )}
      </button>

      <div className="grid grid-cols-3 gap-1.5 text-xs">
        <button
          onClick={onScanAgain}
          disabled={isLoading}
          className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium flex items-center justify-center gap-1 transition-colors border border-slate-200/80 cursor-pointer text-[11px]"
        >
          <RotateCw className="w-3 h-3 text-slate-500" />
          <span>Scan Again</span>
        </button>

        <button
          onClick={onReviewFields}
          disabled={disabled || isLoading}
          className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium flex items-center justify-center gap-1 transition-colors border border-slate-200/80 cursor-pointer text-[11px] disabled:opacity-50"
        >
          <SlidersHorizontal className="w-3 h-3 text-slate-500" />
          <span>Review</span>
        </button>

        <button
          onClick={onOpenDashboard}
          className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium flex items-center justify-center gap-1 transition-colors border border-slate-200/80 cursor-pointer text-[11px]"
        >
          <ExternalLink className="w-3 h-3 text-slate-500" />
          <span>Dashboard</span>
        </button>
      </div>
    </div>
  );
};
