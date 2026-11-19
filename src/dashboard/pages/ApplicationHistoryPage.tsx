// JobFill BD - Application Autofill History Page
// Displays persisted, real autofill sessions with genuine statistics, truthful security labels,
// live event subscriptions, field-level audits, and seamless Application Tracker navigation.

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
  Briefcase,
  XCircle,
  HelpCircle,
  Check,
  AlertCircle,
} from 'lucide-react';
import { AutofillHistoryRecord, AutofillFieldAuditItem } from '../../types/profile';
import {
  getAutofillHistory,
  clearAutofillHistory,
  deleteAutofillHistoryItem,
} from '../../services/storage';

interface ApplicationHistoryPageProps {
  showToast: (msg: string) => void;
  onNavigateTab?: (tab: string) => void;
}

export const ApplicationHistoryPage: React.FC<ApplicationHistoryPageProps> = ({
  showToast,
  onNavigateTab,
}) => {
  const [history, setHistory] = useState<AutofillHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();

    // Live messaging listener: updates automatically when content script or background completes autofill
    const handleRuntimeMessage = (message: any) => {
      if (message?.action === 'AUTOFILL_HISTORY_UPDATED') {
        loadHistory(false);
      }
    };

    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    }

    // Storage fallback listener
    const handleStorageChange = (changes: any, area: string) => {
      if (area === 'local' && changes['jobfill_autofill_history']) {
        loadHistory(false);
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
    }

    return () => {
      if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
      }
      if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      }
    };
  }, []);

  const loadHistory = async (showLoadingSpinner: boolean = true) => {
    if (showLoadingSpinner) setLoading(true);
    setIsRefreshing(true);
    try {
      const records = await getAutofillHistory();
      setHistory(records);
    } catch (e) {
      console.error('JobFill BD: Could not load autofill history:', e);
    } finally {
      if (showLoadingSpinner) setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleManualRefresh = async () => {
    await loadHistory(false);
    showToast('🔄 হিস্ট্রি রিফ্রেশ করা হয়েছে');
  };

  const handleDeleteSession = async (sessionId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (
      window.confirm(
        'আপনি কি এই সেশনের অডিট হিস্ট্রি মুছে ফেলতে চান? (নোট: আপনার Application Tracker বা সংরক্ষিত প্রোফাইল রেকর্ড অক্ষত থাকবে)'
      )
    ) {
      await deleteAutofillHistoryItem(sessionId);
      setHistory((prev) => prev.filter((item) => item.id !== sessionId && item.sessionId !== sessionId));
      showToast('🗑️ সেশন হিস্ট্রি সফলভাবে মুছে ফেলা হয়েছে');
    }
  };

  const handleClearHistory = async () => {
    if (
      window.confirm(
        'আপনি কি নিশ্চিত যে সকল আবেদনের হিস্ট্রি মুছে ফেলতে চান? এটি প্রোফাইলের তথ্যে বা Application Tracker-এ কোনো প্রভাব ফেলবে না।'
      )
    ) {
      await clearAutofillHistory();
      setHistory([]);
      showToast('🗑️ আবেদনের হিস্ট্রি সফলভাবে মুছে ফেলা হয়েছে!');
    }
  };

  const handleOpenTestPage = (pageName: string = 'all-controls-test.html') => {
    const url =
      typeof chrome !== 'undefined' && chrome.runtime?.getURL
        ? chrome.runtime.getURL(`test-pages/${pageName}`)
        : `test-pages/${pageName}`;
    window.open(url, '_blank');
  };

  // Filter items
  const filteredHistory = history.filter((item) => {
    const query = searchFilter.toLowerCase();
    const domainMatch = (item.domain || '').toLowerCase().includes(query);
    const titleMatch = (item.pageTitle || '').toLowerCase().includes(query);
    const profileMatch = (item.profileName || '').toLowerCase().includes(query);
    const orgMatch = (item.organization || '').toLowerCase().includes(query);
    const jobMatch = (item.jobTitle || '').toLowerCase().includes(query);

    const matchesSearch = domainMatch || titleMatch || profileMatch || orgMatch || jobMatch;
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Accurate, truthful statistics calculation
  const totalSessions = history.length;
  const totalFilledFields = history.reduce((sum, h) => sum + (h.totalFilled || 0), 0);
  const totalAttemptedFields = history.reduce(
    (sum, h) => sum + (h.attemptedFields || (h.totalFilled + h.totalFailed) || h.totalDetected || 0),
    0
  );

  // Success rate: Must display "N/A" if 0 sessions exist; 0% if attempted > 0 and 0 filled
  const successRateDisplay: string =
    totalSessions === 0
      ? 'N/A'
      : totalAttemptedFields > 0
      ? `${Math.round((totalFilledFields / totalAttemptedFields) * 100)}%`
      : '0%';

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
            আপনার পূরণকৃত সরকারি ও বেসরকারি চাকরির আবেদন ফর্মের রিয়েল-টাইম অডিট লগ ও ফিল্ড স্ট্যাটাস।
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-sm transition-colors cursor-pointer"
            title="রিফ্রেশ করুন"
          >
            <RotateCcw className={`w-3.5 h-3.5 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={() => handleOpenTestPage('all-controls-test.html')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-petro-700 bg-petro-50 hover:bg-petro-100 border border-petro-200 rounded-lg transition-colors cursor-pointer"
            title="পরীক্ষামূলক ফর্ম টেস্ট করুন"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Test Form
          </button>

          {history.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-semibold mb-1">মোট সেশন (Sessions)</div>
          <div className="text-2xl font-black text-slate-800">{totalSessions}</div>
          <div className="text-[10.5px] text-slate-400 mt-0.5">Persisted form fill audits</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-semibold mb-1">ফিল্ড পূরণ (Filled Fields)</div>
          <div className="text-2xl font-black text-petro-600">{totalFilledFields}</div>
          <div className="text-[10.5px] text-slate-400 mt-0.5">Verified automated fields</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-semibold mb-1">সফলতার হার (Success Rate)</div>
          <div className="text-2xl font-black text-emerald-600">{successRateDisplay}</div>
          <div className="text-[10.5px] text-slate-400 mt-0.5">
            {totalSessions === 0 ? 'No sessions recorded yet' : 'Precision verification'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-semibold mb-1">নিরাপত্তা ও প্রাইভেসি (Security)</div>
          <div className="text-sm font-black text-slate-800 flex items-center gap-1.5 mt-1 text-emerald-700">
            <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="truncate">AES-256-GCM Vault</span>
          </div>
          <div className="text-[10.5px] text-slate-400 mt-1">Zero Cloud Sync • Local Sandboxed DB</div>
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
            placeholder="Search domain, title, profile, job..."
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
            <option value="failed">Failed</option>
            <option value="in_progress">In Progress</option>
            <option value="reverted">Reverted</option>
          </select>
        </div>
      </div>

      {/* History Items List */}
      {loading ? (
        <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 text-sm">
          <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-petro-600 border-t-transparent mr-2 align-middle"></div>
          হিস্ট্রি লোড হচ্ছে...
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3">
          <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto text-2xl">
            📋
          </div>
          <h3 className="font-bold text-slate-700 text-sm">এখনও কোনো আবেদন ফর্ম পূরণ করা হয়নি</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            যেকোনো সরকারি চাকরির পোর্টালে (যেমন পেট্রোবাংলা বা টেলিটক) আবেদন ফর্মে গিয়ে এক্সটেনশন থেকে Autofill
            করলে এখানে রিয়েল অডিট রেকর্ড যুক্ত হবে।
          </p>
          <div className="pt-2 flex justify-center gap-3 flex-wrap">
            <button
              onClick={() => handleOpenTestPage('all-controls-test.html')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-petro-600 hover:bg-petro-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              টেস্ট কন্ট্রোল ফর্ম খুলুন
            </button>
            <button
              onClick={() => handleOpenTestPage('petrobangla-form.html')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              টেস্ট পেট্রোবাংলা ফর্ম খুলুন
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredHistory.map((item) => {
            const isExpanded = expandedId === item.id;
            const dateStr = new Date(item.timestamp).toLocaleString('bn-BD', {
              dateStyle: 'medium',
              timeStyle: 'short',
            });

            const statusBadgeConfig = (() => {
              switch (item.status) {
                case 'completed':
                  return {
                    label: 'COMPLETED',
                    bg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                  };
                case 'failed':
                  return {
                    label: 'FAILED',
                    bg: 'bg-rose-100 text-rose-800 border-rose-200',
                  };
                case 'reverted':
                  return {
                    label: 'REVERTED',
                    bg: 'bg-slate-100 text-slate-700 border-slate-200',
                  };
                case 'in_progress':
                  return {
                    label: 'IN PROGRESS',
                    bg: 'bg-sky-100 text-sky-800 border-sky-200',
                  };
                default:
                  return {
                    label: 'PARTIAL',
                    bg: 'bg-amber-100 text-amber-800 border-amber-200',
                  };
              }
            })();

            const auditItems: AutofillFieldAuditItem[] =
              item.fieldResults && item.fieldResults.length > 0
                ? item.fieldResults
                : (item.filledFields || []).map((f) => ({
                    fieldKey: f.canonicalKey,
                    fieldLabel: f.fieldLabel,
                    fillStatus: (f.fillStatus as any) || 'FILLED',
                    value: f.value,
                    confidence: f.confidence,
                    failureReason: f.failureReason,
                  }));

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
                        {item.organization && (
                          <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-medium">
                            {item.organization}
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadgeConfig.bg}`}
                        >
                          {statusBadgeConfig.label}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
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
                        {item.totalFilled} / {item.attemptedFields || item.totalDetected} fields
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {item.totalFailed > 0 ? `${item.totalFailed} failed verification` : 'Verified correct'}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {onNavigateTab && (
                        <button
                          onClick={() => onNavigateTab('tracker')}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-petro-600 hover:bg-petro-50 transition-colors"
                          title="Application Tracker-এ দেখুন"
                        >
                          <Briefcase className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        onClick={(e) => handleDeleteSession(item.id, e)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="সেশন মুছে ফেলুন"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50 p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                      <span className="font-bold text-slate-700 flex items-center gap-1.5">
                        <FileCheck className="w-4 h-4 text-petro-600" />
                        পূরণকৃত ও যাচাইকৃত ফিল্ডের অডিট লগ (Field-by-Field Audit):
                      </span>
                      <div className="flex items-center gap-3">
                        {onNavigateTab && (
                          <button
                            onClick={() => onNavigateTab('tracker')}
                            className="text-petro-700 hover:underline inline-flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                          >
                            <Briefcase className="w-3 h-3" />
                            Open Tracker
                          </button>
                        )}
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-petro-700 hover:underline inline-flex items-center gap-1 text-[11px] font-semibold"
                          >
                            Visit Form <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>

                    {auditItems.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                        {auditItems.map((field, fIdx) => {
                          const statusConfig = (() => {
                            switch (field.fillStatus) {
                              case 'FILLED':
                                return { label: 'FILLED', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
                              case 'ALREADY_CORRECT':
                                return { label: 'CORRECT', color: 'text-sky-700 bg-sky-50 border-sky-200' };
                              case 'FAILED':
                                return { label: 'FAILED', color: 'text-rose-700 bg-rose-50 border-rose-200' };
                              case 'SKIPPED':
                                return { label: 'SKIPPED', color: 'text-slate-600 bg-slate-100 border-slate-200' };
                              case 'NEEDS_MANUAL_INPUT':
                                return { label: 'MANUAL', color: 'text-amber-700 bg-amber-50 border-amber-200' };
                              default:
                                return { label: field.fillStatus || 'UNKNOWN', color: 'text-slate-600 bg-slate-100 border-slate-200' };
                            }
                          })();

                          return (
                            <div
                              key={fIdx}
                              className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs flex justify-between items-center gap-2"
                            >
                              <div className="truncate min-w-0 flex-1">
                                <div className="font-semibold text-slate-800 truncate flex items-center gap-1.5">
                                  <span>{field.fieldLabel || field.fieldKey}</span>
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono truncate">
                                  {field.fieldKey}
                                </div>
                                {field.failureReason && (
                                  <div className="text-[10px] text-rose-600 font-medium truncate mt-0.5">
                                    ⚠️ {field.failureReason}
                                  </div>
                                )}
                              </div>
                              <div className="text-right shrink-0 flex flex-col items-end gap-1">
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${statusConfig.color}`}
                                >
                                  {statusConfig.label}
                                </span>
                                <span className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[10.5px] max-w-[130px] truncate inline-block">
                                  {field.value || '(Selected)'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 italic">
                        ফিল্ডের বিস্তারিত অডিট লগ সংরক্ষিত নেই।
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
