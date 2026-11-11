import React from 'react';
import { User, CheckCircle, AlertCircle, HelpCircle, AlertTriangle, CheckCheck } from 'lucide-react';

interface ScanSummaryProps {
  activeProfileName: string;
  totalDetected: number;
  matchedCount: number;
  readyToFillCount: number;
  missingInfoCount: number;
  conflictsCount: number;
  ambiguousCount?: number;
  alreadyCorrectCount?: number;
}

export const ScanSummary: React.FC<ScanSummaryProps> = ({
  activeProfileName,
  totalDetected,
  matchedCount,
  readyToFillCount,
  missingInfoCount,
  conflictsCount,
  ambiguousCount = 0,
  alreadyCorrectCount = 0,
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm space-y-3">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-xs">
        <span className="text-slate-500 flex items-center gap-1.5 font-medium">
          <User className="w-3.5 h-3.5 text-slate-400" />
          Active Profile
        </span>
        <span className="font-bold text-slate-800 truncate max-w-[190px]">
          {activeProfileName || 'Default Applicant'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2">
          <div className="text-emerald-700 font-extrabold text-base leading-tight">
            {readyToFillCount}
          </div>
          <div className="text-[10px] font-semibold text-emerald-800 flex items-center justify-center gap-0.5 mt-0.5">
            <CheckCircle className="w-2.5 h-2.5" />
            Ready to Fill
          </div>
        </div>

        <div className="bg-sky-50 border border-sky-100 rounded-lg p-2">
          <div className="text-sky-700 font-extrabold text-base leading-tight">
            {matchedCount}
          </div>
          <div className="text-[10px] font-semibold text-sky-800 flex items-center justify-center gap-0.5 mt-0.5">
            <CheckCheck className="w-2.5 h-2.5" />
            Matched Fields
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-lg p-2">
          <div className="text-slate-600 font-extrabold text-base leading-tight">
            {totalDetected}
          </div>
          <div className="text-[10px] font-semibold text-slate-500 flex items-center justify-center gap-0.5 mt-0.5">
            <HelpCircle className="w-2.5 h-2.5" />
            Total Inputs
          </div>
        </div>
      </div>

      {(missingInfoCount > 0 || conflictsCount > 0 || ambiguousCount > 0 || alreadyCorrectCount > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-slate-100 text-[10.5px]">
          {alreadyCorrectCount > 0 && (
            <span className="bg-sky-50 text-sky-700 px-2 py-0.5 rounded font-medium">
              Already Correct: {alreadyCorrectCount}
            </span>
          )}
          {missingInfoCount > 0 && (
            <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Missing Info: {missingInfoCount}
            </span>
          )}
          {conflictsCount > 0 && (
            <span className="bg-rose-50 text-rose-700 px-2 py-0.5 rounded font-medium flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Conflicts: {conflictsCount}
            </span>
          )}
          {ambiguousCount > 0 && (
            <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-medium">
              Ambiguous: {ambiguousCount}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
