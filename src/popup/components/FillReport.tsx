import React from 'react';
import { CheckCircle2, RotateCcw, RotateCw, ExternalLink, ShieldCheck, AlertCircle } from 'lucide-react';
import { FieldCompletenessEntry } from '../../types/field-status';

export interface FillReportData {
  successfullyFilled: number;
  alreadyCorrect: number;
  missingInfo: number;
  ambiguous: number;
  conflicts: number;
  confirmationRequired?: number;
  failed: number;
  completenessReport?: FieldCompletenessEntry[];
}

interface FillReportProps {
  report: FillReportData;
  onUndo: () => void;
  onScanAgain: () => void;
  onOpenDashboard: () => void;
  isUndoing?: boolean;
}

export const FillReport: React.FC<FillReportProps> = ({
  report,
  onUndo,
  onScanAgain,
  onOpenDashboard,
  isUndoing = false,
}) => {
  return (
    <div className="bg-white border border-emerald-200 rounded-xl p-4 shadow-sm space-y-3.5">
      <div className="flex items-center gap-2 text-emerald-800 border-b border-emerald-100 pb-2.5">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
        <div>
          <h3 className="font-bold text-sm leading-tight text-slate-800">Auto Fill Completed</h3>
          <p className="text-[11px] text-emerald-700 font-medium">Fields verified and populated safely</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-emerald-50/80 border border-emerald-100 rounded-lg p-2">
          <div className="text-emerald-800 font-extrabold text-base">{report.successfullyFilled}</div>
          <div className="text-[10.5px] font-semibold text-emerald-700">Successfully Filled</div>
        </div>

        <div className="bg-sky-50/80 border border-sky-100 rounded-lg p-2">
          <div className="text-sky-800 font-extrabold text-base">{report.alreadyCorrect}</div>
          <div className="text-[10.5px] font-semibold text-sky-700">Already Correct</div>
        </div>

        <div className="bg-amber-50/80 border border-amber-100 rounded-lg p-2">
          <div className="text-amber-800 font-extrabold text-base">{report.missingInfo}</div>
          <div className="text-[10.5px] font-semibold text-amber-700">Missing Information</div>
        </div>

        <div className="bg-rose-50/80 border border-rose-100 rounded-lg p-2">
          <div className="text-rose-800 font-extrabold text-base">{report.conflicts}</div>
          <div className="text-[10.5px] font-semibold text-rose-700">Value Conflicts</div>
        </div>
      </div>

      {(report.ambiguous > 0 || report.failed > 0 || (report.confirmationRequired || 0) > 0) && (
        <div className="flex flex-wrap gap-2">
          {(report.confirmationRequired || 0) > 0 && (
            <div className="flex-1 bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-800 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Confirm Req: {report.confirmationRequired}</span>
            </div>
          )}
          {report.ambiguous > 0 && (
            <div className="flex-1 bg-purple-50 border border-purple-200 rounded-lg p-2 text-xs text-purple-800 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span>Ambiguous: {report.ambiguous}</span>
            </div>
          )}
          {report.failed > 0 && (
            <div className="flex-1 bg-rose-50 border border-rose-200 rounded-lg p-2 text-xs text-rose-800 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>Failed: {report.failed}</span>
            </div>
          )}
        </div>
      )}

      {report.completenessReport &&
        report.completenessReport.some((c) => c.status !== 'Successfully Filled' && c.status !== 'Already Correct') && (
          <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-900 space-y-1 max-h-28 overflow-y-auto">
            <div className="font-bold">Completeness Report (Attention Needed):</div>
            {report.completenessReport
              .filter((c) => c.status !== 'Successfully Filled' && c.status !== 'Already Correct')
              .slice(0, 6)
              .map((entry, idx) => (
                <div key={idx} className="truncate">
                  <span className="font-semibold">{entry.fieldLabel.split(' (')[0]}</span>: {entry.status}
                </div>
              ))}
          </div>
        )}

      <div className="bg-slate-50 rounded-lg p-2 text-[11px] text-slate-600 flex items-start gap-1.5 leading-relaxed">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
        <span>
          <strong>Safety Note:</strong> JobFill BD never clicks Final Submit or CAPTCHA. Please inspect the inputs before submitting.
        </span>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onUndo}
          disabled={isUndoing}
          className="flex-1 py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isUndoing ? 'animate-spin' : ''}`} />
          <span>Undo Fill</span>
        </button>

        <button
          onClick={onScanAgain}
          className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg font-semibold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
          title="Scan active page again"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onOpenDashboard}
          className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg font-semibold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
          title="Open full dashboard"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
