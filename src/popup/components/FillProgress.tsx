import React from 'react';
import { Loader2 } from 'lucide-react';

export const FillProgress: React.FC = () => {
  return (
    <div className="bg-white border border-emerald-200 rounded-xl p-5 shadow-sm text-center space-y-3">
      <div className="relative inline-flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-emerald-100 border-t-emerald-600 animate-spin"></div>
        <Loader2 className="w-5 h-5 text-emerald-600 absolute" />
      </div>

      <div>
        <h3 className="font-bold text-slate-800 text-sm">Executing 5-Layer Auto Fill</h3>
        <p className="text-[11.5px] text-slate-500 mt-0.5">
          Dispatching framework-safe events and validating form inputs...
        </p>
      </div>

      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
        <div className="bg-emerald-600 h-1.5 rounded-full w-2/3 animate-pulse"></div>
      </div>
    </div>
  );
};
