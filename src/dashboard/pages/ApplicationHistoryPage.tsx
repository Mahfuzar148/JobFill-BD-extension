import React, { useState, useEffect } from 'react';
import {
  History,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Search,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileCheck,
  Building,
  Clock,
  Shield,
} from 'lucide-react';
import { AutofillHistoryRecord } from '../../types/profile';
import { getAutofillHistory, clearAutofillHistory } from '../../services/storage';

interface ApplicationHistoryPageProps {
  showToast: (msg: string) => void;
}

export const ApplicationHistoryPage: React.FC<ApplicationHistoryPageProps> = ({ showToast }) => {
  const [history, setHistory] = useState<AutofillHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const records = await getAutofillHistory();
      setHistory(records);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (window.confirm('আপনি কি নিশ্চিত যে সকল আবেদনের হিস্ট্রি মুছে ফেলতে চান? এটি প্রোফাইলের তথ্যে প্রভাব ফেলবে না।')) {
      await clearAutofillHistory();
      setHistory([]);
      showToast('🗑️ আবেদনের হিস্ট্রি সফলভাবে মুছে ফেলা হয়েছে!');
    }
  };

  const filteredHistory = history.filter((item) => {
    const matchesSearch =
      item.domain.toLowerCase().includes(searchFilter.toLowerCase()) ||
      item.pageTitle.toLowerCase().includes(searchFilter.toLowerCase()) ||
      item.profileName.toLowerCase().includes(searchFilter.toLowerCase());

    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalFilledFields = history.reduce((sum, h) => sum + h.totalFilled, 0);
  const totalDetectedFields = history.reduce((sum, h) => sum + h.totalDetected, 0);
  const successPercentage = totalDetectedFields > 0 ? Math.round((totalFilledFields / totalDetectedFields) * 100) : 100;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <History className="w-5 h-5 text-petro-600" />
            <span>Application Autofill History (আবেদনের হিস্ট্রি)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            আপনার পূরণকৃত সরকারি চাকরির আবেদন ও ফর্ম সেশনসমূহের সম্পূর্ণ অডিট লগ।
          </p>
        </div>

        {history.length > 0 && (
          <button
            onClick={handleClearHistory}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors self-start sm:self-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear History
          </button>
        )}
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-semibold mb-1">মোট সেশন (Sessions)</div>
          <div className="text-2xl font-black text-slate-800">{history.length}</div>
          <div className="text-[10.5px] text-slate-400 mt-0.5">Recorded form fills</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-semibold mb-1">ফিল্ড পূরণ (Filled Fields)</div>
          <div className="text-2xl font-black text-petro-600">{totalFilledFields}</div>
          <div className="text-[10.5px] text-slate-400 mt-0.5">Total fields automated</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-semibold mb-1">সফলতার হার (Success)</div>
          <div className="text-2xl font-black text-emerald-600">{successPercentage}%</div>
          <div className="text-[10.5px] text-slate-400 mt-0.5">Precision verification</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-semibold mb-1">নিরাপত্তা (Security)</div>
          <div className="text-2xl font-black text-navy-800 flex items-center gap-1">
            <Shield className="w-5 h-5 text-petro-600" />
            100%
          </div>
          <div className="text-[10.5px] text-slate-400 mt-0.5">Locally Stored Autofill History</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search domain, title, profile..."
            className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-petro-600"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-500 font-semibold whitespace-nowrap">Filter Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 focus:outline-none focus:border-petro-600 cursor-pointer"
          >
            <option value="all">All Statuses ({history.length})</option>
            <option value="completed">Completed</option>
            <option value="partial">Partial</option>
            <option value="reverted">Reverted</option>
          </select>
        </div>
      </div>

      {/* History Items List */}
      {loading ? (
        <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 text-sm">
          হিস্ট্রি লোড হচ্ছে...
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3">
          <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto text-2xl">
            📋
          </div>
          <h3 className="font-bold text-slate-700 text-sm">এখনও কোনো আবেদন ফর্ম পূরণ করা হয়নি</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            যেকোনো সরকারি চাকরির পোর্টালে (যেমন পেট্রোবাংলা বা টেলিটক) আবেদন ফর্মে গেলে এক্সটেনশন নিজে থেকে ফর্ম ফিল্ডগুলো শনাক্ত করে পূরণ করে দেবে এবং এখানে হিস্ট্রি যুক্ত হবে।
          </p>
          {!(typeof __JOBFILL_STORE_CLEAN__ !== 'undefined' && __JOBFILL_STORE_CLEAN__) && (
          <div className="pt-2 flex justify-center gap-3">
            <a
              href="test-pages/petrobangla-form.html"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-petro-600 hover:bg-petro-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              টেস্ট পেট্রোবাংলা ফর্ম খুলুন
            </a>
          </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredHistory.map((item) => {
            const isExpanded = expandedId === item.id;
            const dateStr = new Date(item.timestamp).toLocaleString('bn-BD', {
              dateStyle: 'medium',
              timeStyle: 'short',
            });

            return (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:border-slate-300"
              >
                {/* Header row */}
                <div
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-petro-50 border border-petro-100 text-petro-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Building className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800 text-xs sm:text-sm">
                          {item.domain}
                        </span>
                        <span
                          className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${
                            item.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.status === 'reverted'
                              ? 'bg-slate-100 text-slate-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span className="truncate max-w-xs">{item.pageTitle}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {dateStr}
                        </span>
                        <span>•</span>
                        <span className="text-slate-600 font-medium">Profile: {item.profileName}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:self-center self-end">
                    <div className="text-right">
                      <div className="text-xs font-bold text-petro-700">
                        {item.totalFilled} / {item.totalDetected} fields
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {item.totalFailed > 0 ? `${item.totalFailed} failed` : 'All verified'}
                      </div>
                    </div>

                    <button className="p-1 rounded text-slate-400 hover:text-slate-600">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50 p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700">পূরণকৃত ফিল্ডের বিবরণ (Filled Fields Audit):</span>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-petro-700 hover:underline inline-flex items-center gap-1 text-[11px] font-semibold"
                        >
                          Visit Page <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    {item.filledFields && item.filledFields.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                        {item.filledFields.map((field, fIdx) => (
                          <div
                            key={fIdx}
                            className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs flex justify-between items-center"
                          >
                            <div className="truncate mr-2">
                              <div className="font-semibold text-slate-800 truncate">{field.fieldLabel}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{field.canonicalKey}</div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[11px] max-w-[130px] truncate inline-block">
                                {field.value || '(Selected)'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 italic">
                        ফিল্ডের বিস্তারিত লগ সংরক্ষিত নেই।
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
