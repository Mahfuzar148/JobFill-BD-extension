import React from 'react';
import { CheckCircle2, AlertTriangle, HelpCircle, Building2, Globe2, FileText } from 'lucide-react';

export interface DetectionState {
  status: 'supported' | 'adapter_required' | 'not_detected' | 'restricted' | 'loading';
  organization?: string;
  platform?: string;
  pageType?: string;
  urlHost?: string;
  message?: string;
}

interface WebsiteDetectionCardProps {
  detection: DetectionState;
}

export const WebsiteDetectionCard: React.FC<WebsiteDetectionCardProps> = ({ detection }) => {
  if (detection.status === 'loading') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-1/2 mb-3"></div>
        <div className="h-3 bg-slate-100 rounded w-3/4 mb-2"></div>
        <div className="h-3 bg-slate-100 rounded w-1/3"></div>
      </div>
    );
  }

  if (detection.status === 'restricted') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 shadow-sm">
        <div className="flex items-center gap-2 font-bold mb-1 text-amber-800">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <span>Restricted Browser Page</span>
        </div>
        <p className="text-amber-700 leading-relaxed">
          JobFill BD cannot scan Chrome internal pages (chrome://, extensions, new tab). Please open a government job portal.
        </p>
      </div>
    );
  }

  if (detection.status === 'not_detected') {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700 shadow-sm">
        <div className="flex items-center gap-2 font-bold text-slate-700 mb-1">
          <HelpCircle className="w-4 h-4 text-slate-400" />
          <span>No Supported Job Form Detected</span>
        </div>
        <p className="text-slate-500 leading-relaxed">
          Open a government job application form in this Chrome tab and click <strong>Scan Again</strong>.
        </p>
        {detection.urlHost && (
          <div className="mt-2 text-[11px] text-slate-400 font-mono truncate">
            Active Host: {detection.urlHost}
          </div>
        )}
      </div>
    );
  }

  if (detection.status === 'adapter_required') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs shadow-sm">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 mb-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          <span>Form Detected – Adapter Required</span>
        </div>
        <p className="text-amber-800 leading-relaxed">
          We detected a possible job application form, but this form has not been fully verified yet.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-100 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none"></div>

      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 mb-2.5">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        <span>Supported Form Detected</span>
      </div>

      <div className="space-y-1.5 text-xs">
        <div className="flex items-start gap-2 text-slate-800">
          <Building2 className="w-3.5 h-3.5 text-emerald-700 mt-0.5 shrink-0" />
          <span className="font-semibold leading-tight">{detection.organization || 'Government Job Portal'}</span>
        </div>

        <div className="flex items-center gap-2 text-slate-600 text-[11.5px]">
          <Globe2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>Platform: <strong>{detection.platform || 'Teletalk'}</strong></span>
        </div>

        <div className="flex items-center gap-2 text-slate-600 text-[11.5px]">
          <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>Page: <strong>{detection.pageType || 'Application Form'}</strong></span>
        </div>
      </div>
    </div>
  );
};
