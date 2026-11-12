// JobFill BD - Local Application Tracker Component
// Tracks user application statuses without ever auto-marking Applied or auto-submitting.

import React, { useMemo, useRef, useState } from 'react';
import {
  Briefcase,
  Calendar,
  ExternalLink,
  Save,
  Trash2,
  CheckCircle2,
  Copy,
  Check,
  Download,
  Upload,
  Clock,
  CreditCard,
  Plus,
  Search,
  X,
} from 'lucide-react';
import {
  ApplicationTrackerRecord,
  ApplicationStatus,
  FeePaymentStatus,
  AdmitCardStatus,
} from '../types/job.types';
import { ApplicationRepository } from '../database/application-repository';
import { verifyJobUrl } from '../services/source-verifier';

function toLocalDatetimeInputValue(ts?: number | null): string {
  if (!ts || !Number.isFinite(ts)) return '';
  const dt = new Date(ts);
  const offsetMs = dt.getTimezoneOffset() * 60_000;
  return new Date(ts - offsetMs).toISOString().slice(0, 16);
}

function escapeCsvCell(value: unknown): string {
  const s = String(value ?? '').replace(/"/g, '""');
  return `"${s}"`;
}

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'Interested',
  'Bookmarked',
  'Saved',
  'Ready to Apply',
  'Applied',
  'Payment Pending',
  'Payment Completed',
  'Admit Card Available',
  'Exam Scheduled',
  'Result Published',
  'Selected',
  'Rejected',
  'Expired',
];

type DeadlineFilterMode = 'All' | 'closing_7d' | 'expired' | 'none';
type TrackerSortMode = 'updated_desc' | 'app_date_desc' | 'exam_date_asc' | 'deadline_asc';

interface ApplicationTrackerProps {
  records: ApplicationTrackerRecord[];
  language?: 'bn' | 'en';
  onUpdateRecord: (record: ApplicationTrackerRecord) => Promise<void>;
  onDeleteRecord: (jobId: string) => Promise<void>;
  onOpenJob?: (jobId: string) => void;
  onRefreshRecords?: () => Promise<void>;
}

export const ApplicationTracker: React.FC<ApplicationTrackerProps> = ({
  records,
  language = 'en',
  onUpdateRecord,
  onDeleteRecord,
  onOpenJob,
  onRefreshRecords,
}) => {
  const bn = language === 'bn';
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'All'>('All');
  const [orgFilter, setOrgFilter] = useState<string>('All');
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilterMode>('All');
  const [sortBy, setSortBy] = useState<TrackerSortMode>('updated_desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ApplicationTrackerRecord | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newOrg, setNewOrg] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newCircularId, setNewCircularId] = useState('');
  const [newCircularUrl, setNewCircularUrl] = useState('');
  const [newAppUrl, setNewAppUrl] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [newStatus, setNewStatus] = useState<ApplicationStatus>('Interested');
  const restoreInputRef = useRef<HTMLInputElement | null>(null);
  const [backupNotice, setBackupNotice] = useState('');

  const organizations = useMemo(
    () => Array.from(new Set(records.map((r) => r.organization).filter(Boolean))).sort(),
    [records]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const now = Date.now();
    const sevenDaysMs = 7 * 86_400_000;

    const list = records.filter((r) => {
      if (statusFilter !== 'All' && r.status !== statusFilter) return false;
      if (orgFilter !== 'All' && r.organization !== orgFilter) return false;
      if (deadlineFilter === 'closing_7d') {
        if (!r.deadlineAt || r.deadlineAt <= now || r.deadlineAt - now > sevenDaysMs) return false;
      } else if (deadlineFilter === 'expired') {
        if (!r.deadlineAt || r.deadlineAt > now) return false;
      } else if (deadlineFilter === 'none') {
        if (r.deadlineAt) return false;
      }
      if (!q) return true;
      return (
        r.jobTitle.toLowerCase().includes(q) ||
        r.organization.toLowerCase().includes(q) ||
        (r.circularId || '').toLowerCase().includes(q) ||
        (r.teletalkUserId || '').toLowerCase().includes(q) ||
        (r.transactionId || '').toLowerCase().includes(q) ||
        (r.notes || '').toLowerCase().includes(q)
      );
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'app_date_desc') {
        return (b.applicationDate || '').localeCompare(a.applicationDate || '');
      }
      if (sortBy === 'exam_date_asc') {
        const ae = a.examDate || '9999-99-99';
        const be = b.examDate || '9999-99-99';
        return ae.localeCompare(be);
      }
      if (sortBy === 'deadline_asc') {
        const ad = a.deadlineAt ?? Number.MAX_SAFE_INTEGER;
        const bd = b.deadlineAt ?? Number.MAX_SAFE_INTEGER;
        return ad - bd;
      }
      return b.updatedAt - a.updatedAt;
    });
  }, [records, statusFilter, orgFilter, deadlineFilter, sortBy, searchQuery]);

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrg.trim() || !newTitle.trim()) return;
    const now = Date.now();
    const deadlineTs = newDeadline ? Date.parse(`${newDeadline}T18:00:00+06:00`) : null;
    await onUpdateRecord({
      jobId: `manual_${now.toString(36)}`,
      jobTitle: newTitle.trim(),
      organization: newOrg.trim(),
      circularId: newCircularId.trim() || undefined,
      circularUrl: newCircularUrl.trim() || undefined,
      applicationUrl: newAppUrl.trim() || undefined,
      deadlineAt: deadlineTs && Number.isFinite(deadlineTs) ? deadlineTs : null,
      status: newStatus,
      createdAt: now,
      updatedAt: now,
    });
    setAddModalOpen(false);
    setNewOrg('');
    setNewTitle('');
    setNewCircularId('');
    setNewCircularUrl('');
    setNewAppUrl('');
    setNewDeadline('');
    setNewStatus('Interested');
  };

  const handleExportBackupJson = async () => {
    const bundle = await ApplicationRepository.exportBackup();
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jobfill-applications-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackupJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const list = Array.isArray(parsed) ? parsed : parsed?.records;
      const count = await ApplicationRepository.restoreBackupMerge(list);
      if (onRefreshRecords) {
        await onRefreshRecords();
      }
      setBackupNotice(`Restored/merged ${count} application record(s) without erasing existing entries.`);
    } catch (err: any) {
      setBackupNotice(`Backup restore failed: ${err?.message || 'Invalid JSON'}`);
    }
  };

  const handleCopyUserId = async (jobId: string, userId: string) => {
    try {
      await navigator.clipboard?.writeText(userId);
      setCopiedId(jobId);
      window.setTimeout(() => setCopiedId((prev) => (prev === jobId ? null : prev)), 2000);
    } catch {
      // safe no-op in headless/restricted context
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'Organization',
      'Job Title',
      'Circular ID',
      'Status',
      'Teletalk User ID',
      'Application Ref ID',
      'Fee Status',
      'Transaction ID',
      'Fee Deadline',
      'Application Date',
      'Admit Card Status',
      'Exam Date',
      'Exam Roll',
      'Exam Venue',
      'Result Summary',
      'Notes',
    ];
    const rows = records.map((r) =>
      [
        r.organization,
        r.jobTitle,
        r.circularId || '',
        r.status,
        r.teletalkUserId || '',
        r.applicationRefId || '',
        r.feePaymentStatus || '',
        r.transactionId || '',
        r.feeDeadlineAt ? new Date(r.feeDeadlineAt).toISOString() : '',
        r.applicationDate || '',
        r.admitCardStatus || '',
        r.examDate || '',
        r.examRoll || '',
        r.examVenue || '',
        r.resultSummary || '',
        r.notes || '',
      ]
        .map(escapeCsvCell)
        .join(',')
    );
    const csv = [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jobfill-applications-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatFeeCountdown = (rec: ApplicationTrackerRecord): { label: string; urgent: boolean } | null => {
    if (!rec.feePaymentStatus) return null;
    if (rec.feePaymentStatus === 'paid') {
      return { label: bn ? 'ফি পরিশোধিত' : 'Fee Paid', urgent: false };
    }
    if (rec.feePaymentStatus === 'exempt') {
      return { label: bn ? 'ফি প্রযোজ্য নয়' : 'Fee Exempt', urgent: false };
    }
    if (rec.feePaymentStatus === 'expired') {
      return { label: bn ? 'ফি সময়সীমা শেষ' : 'Fee Expired', urgent: true };
    }
    if (typeof rec.feeDeadlineAt === 'number' && rec.feeDeadlineAt > 0) {
      const diffMs = rec.feeDeadlineAt - Date.now();
      if (diffMs <= 0) {
        return { label: bn ? 'ফি মেয়াদোত্তীর্ণ' : 'Fee Window Expired', urgent: true };
      }
      const hours = Math.floor(diffMs / 3_600_000);
      const mins = Math.floor((diffMs % 3_600_000) / 60_000);
      return {
        label: bn ? `ফি বাকি (${hours}ঘ ${mins}মি)` : `Fee Due (${hours}h ${mins}m left)`,
        urgent: hours < 24,
      };
    }
    return { label: bn ? 'ফি বকেয়া (Unpaid)' : 'Fee Unpaid', urgent: true };
  };

  const startEdit = (rec: ApplicationTrackerRecord) => {
    setEditingId(rec.jobId);
    setDraft({ ...rec });
  };

  const handleSave = async () => {
    if (!draft) return;
    await onUpdateRecord(draft);
    setEditingId(null);
    setDraft(null);
  };

  const statusColor = (status: ApplicationStatus): string => {
    switch (status) {
      case 'Bookmarked':
        return 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300';
      case 'Applied':
      case 'Payment Completed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300';
      case 'Payment Pending':
        return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300';
      case 'Admit Card Available':
        return 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300';
      case 'Exam Scheduled':
        return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300';
      case 'Selected':
        return 'bg-petro-600 text-white border-petro-700';
      case 'Expired':
        return 'bg-stone-200 text-stone-700 border-stone-300 dark:bg-stone-800 dark:text-stone-300';
      case 'Rejected':
        return 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300';
      case 'Result Published':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-petro-600" />
            <span>{bn ? 'আবেদন ট্র্যাকার (Application Tracker)' : 'Application Tracker'}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {bn
              ? 'আপনার প্রতিটি চাকরির আবেদনের অবস্থা, পরীক্ষার তারিখ, প্রবেশপত্র ও ফলাফল লোকালভাবে ট্র্যাক করুন।'
              : 'Track your job applications, exam schedules, admit cards, and results locally.'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <input
            ref={restoreInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportBackupJson}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-bold bg-petro-600 hover:bg-petro-700 text-white rounded-xl px-3 py-2 shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{bn ? 'নতুন আবেদন যোগ' : 'Add Application'}</span>
          </button>
          {records.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-petro-600" />
                <span>{bn ? 'CSV এক্সপোর্ট' : 'Export CSV'}</span>
              </button>
              <button
                type="button"
                onClick={handleExportBackupJson}
                className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-indigo-600" />
                <span>{bn ? 'ব্যাকআপ JSON' : 'Backup JSON'}</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => restoreInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{bn ? 'রিস্টোর' : 'Restore Backup'}</span>
          </button>
        </div>
      </div>

      {backupNotice && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
          {backupNotice}
        </div>
      )}

      {/* Search, Multi-Filter & Sort Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
        <div className="relative lg:col-span-2">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={bn ? 'প্রতিষ্ঠান, পদ, User ID, TXN খুঁজুন...' : 'Search org, title, Circular ID, TXN ID...'}
            className="w-full pl-8 pr-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-700 dark:text-slate-200"
        >
          <option value="All">{bn ? `সব অবস্থা (${records.length})` : `All Statuses (${records.length})`}</option>
          {APPLICATION_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={orgFilter}
          onChange={(e) => setOrgFilter(e.target.value)}
          className="font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-700 dark:text-slate-200"
        >
          <option value="All">{bn ? 'সব প্রতিষ্ঠান' : 'All Organizations'}</option>
          {organizations.map((org) => (
            <option key={org} value={org}>{org}</option>
          ))}
        </select>
        <div className="flex gap-1.5">
          <select
            value={deadlineFilter}
            onChange={(e) => setDeadlineFilter(e.target.value as DeadlineFilterMode)}
            className="flex-1 font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1.5 text-slate-700 dark:text-slate-200"
          >
            <option value="All">{bn ? 'সব সময়সীমা' : 'Any Deadline'}</option>
            <option value="closing_7d">{bn ? '৭ দিনের মধ্যে' : 'Closing <= 7d'}</option>
            <option value="expired">{bn ? 'মেয়াদোত্তীর্ণ' : 'Expired'}</option>
            <option value="none">{bn ? 'তারিখহীন' : 'No Deadline'}</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as TrackerSortMode)}
            className="flex-1 font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1.5 text-slate-700 dark:text-slate-200"
          >
            <option value="updated_desc">{bn ? 'সাম্প্রতিক' : 'Recent'}</option>
            <option value="app_date_desc">{bn ? 'আবেদনের তারিখ' : 'App Date'}</option>
            <option value="exam_date_asc">{bn ? 'পরীক্ষার তারিখ' : 'Exam Date'}</option>
            <option value="deadline_asc">{bn ? 'শেষ তারিখ' : 'Deadline'}</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-2">
          <CheckCircle2 className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            {bn ? 'এখনও কোনো আবেদন ট্র্যাক করা হয়নি' : 'No tracked applications yet'}
          </p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {bn
              ? 'যেকোনো জব সার্কুলার খুলে "Mark as Applied" অথবা স্ট্যাটাস আপডেট করলে তা এখানে সংরক্ষিত হবে।'
              : 'Open any job circular and mark your progress (Interested, Ready to Apply, Applied, etc.) to track it here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((rec) => {
            const isEditing = editingId === rec.jobId && draft;
            return (
              <div
                key={rec.jobId}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10.5px] font-bold px-2.5 py-0.5 rounded-full border ${statusColor(rec.status)}`}>
                        {rec.status}
                      </span>
                      <span className="text-xs font-bold text-petro-700 dark:text-petro-400">
                        {rec.organization}
                      </span>
                    </div>
                    <h3 className="text-sm font-extrabold text-slate-800 dark:text-white mt-1">
                      {rec.jobTitle}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={rec.status}
                      onChange={(e) => onUpdateRecord({ ...rec, status: e.target.value as ApplicationStatus })}
                      className="text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg px-2.5 py-1.5"
                    >
                      {APPLICATION_STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>

                    {onOpenJob && (
                      <button
                        type="button"
                        onClick={() => onOpenJob(rec.jobId)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 cursor-pointer"
                      >
                        {bn ? 'বিস্তারিত' : 'Details'}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => (isEditing ? setEditingId(null) : startEdit(rec))}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-petro-50 dark:bg-petro-950/40 text-petro-700 dark:text-petro-300 border border-petro-200 dark:border-petro-800 cursor-pointer"
                    >
                      {isEditing ? (bn ? 'বন্ধ' : 'Close') : (bn ? 'তথ্য যোগ' : 'Edit Notes')}
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteRecord(rec.jobId)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                      title={bn ? 'মুছুন' : 'Remove'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                  {/* Metadata summary */}
                <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {rec.circularId && (
                    <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                      Circular: <strong className="font-mono text-slate-700 dark:text-slate-200">{rec.circularId}</strong>
                    </span>
                  )}
                  {rec.teletalkUserId && (
                    <span className="inline-flex items-center gap-1.5 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 px-2 py-0.5 rounded-md font-semibold">
                      <span>User ID: <strong className="font-mono">{rec.teletalkUserId}</strong></span>
                      <button
                        type="button"
                        onClick={() => handleCopyUserId(rec.jobId, rec.teletalkUserId!)}
                        title={bn ? 'User ID কপি করুন' : 'Copy Teletalk User ID'}
                        className="hover:text-sky-600 cursor-pointer"
                      >
                        {copiedId === rec.jobId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </span>
                  )}
                  {rec.applicationRefId && (
                    <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                      Ref: <strong className="font-mono text-slate-700 dark:text-slate-200">{rec.applicationRefId}</strong>
                    </span>
                  )}
                  {rec.transactionId && (
                    <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                      TXN: <strong className="font-mono text-slate-700 dark:text-slate-200">{rec.transactionId}</strong>
                    </span>
                  )}
                  {rec.admitCardStatus && (
                    <span className="inline-flex items-center gap-1 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-800 dark:text-cyan-300 px-2 py-0.5 rounded-md">
                      Admit: <strong>{rec.admitCardStatus}</strong>
                    </span>
                  )}
                  {rec.resultSummary && (
                    <span className="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 px-2 py-0.5 rounded-md">
                      Result: <strong>{rec.resultSummary}</strong>
                    </span>
                  )}
                  {(() => {
                    const feeBadge = formatFeeCountdown(rec);
                    if (!feeBadge) return null;
                    return (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold border ${
                          rec.feePaymentStatus === 'paid' || rec.feePaymentStatus === 'exempt'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                            : feeBadge.urgent
                              ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                              : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                        }`}
                      >
                        {rec.feePaymentStatus === 'unpaid' ? <Clock className="w-3 h-3" /> : <CreditCard className="w-3 h-3" />}
                        <span>{feeBadge.label}</span>
                      </span>
                    );
                  })()}
                  {rec.applicationDate && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Applied: <strong className="text-slate-700 dark:text-slate-200">{rec.applicationDate}</strong>
                    </span>
                  )}
                  {rec.examDate && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-amber-500" /> Exam: <strong className="text-slate-700 dark:text-slate-200">{rec.examDate}</strong>
                    </span>
                  )}
                  {rec.examRoll && (
                    <span className="inline-flex items-center gap-1">
                      Roll: <strong className="font-mono text-slate-700 dark:text-slate-200">{rec.examRoll}</strong>
                    </span>
                  )}
                  {rec.examVenue && (
                    <span className="inline-flex items-center gap-1">
                      Center: <strong className="text-slate-700 dark:text-slate-200">{rec.examVenue}</strong>
                    </span>
                  )}
                  {rec.admitCardUrl && verifyJobUrl(rec.admitCardUrl).isSafeToOpen && (
                    <a href={rec.admitCardUrl} target="_blank" rel="noopener noreferrer" className="text-petro-600 hover:underline inline-flex items-center gap-1 font-semibold">
                      Admit Card <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {rec.resultUrl && verifyJobUrl(rec.resultUrl).isSafeToOpen && (
                    <a href={rec.resultUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline inline-flex items-center gap-1 font-semibold">
                      Result <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {rec.notes && !isEditing && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2.5">
                    {rec.notes}
                  </p>
                )}

                {isEditing && draft && (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        {bn ? 'Teletalk User ID / আবেদনকারীর আইডি' : 'Teletalk User ID'}
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. ABCD1234"
                        value={draft.teletalkUserId || ''}
                        onChange={(e) => setDraft({ ...draft, teletalkUserId: e.target.value })}
                        className="w-full font-mono border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        {bn ? 'আবেদন রেফারেন্স / ট্র্যাকিং নম্বর' : 'Application Ref / Tracking ID'}
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. TXN-90211"
                        value={draft.applicationRefId || ''}
                        onChange={(e) => setDraft({ ...draft, applicationRefId: e.target.value })}
                        className="w-full font-mono border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        {bn ? 'আবেদন ফি পেমেন্ট অবস্থা' : 'Fee Payment Status'}
                      </label>
                      <select
                        value={draft.feePaymentStatus || ''}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            feePaymentStatus: (e.target.value || undefined) as FeePaymentStatus | undefined,
                          })
                        }
                        className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                      >
                        <option value="">{bn ? '-- নির্বাচন করুন --' : '-- Not Set --'}</option>
                        <option value="unpaid">{bn ? 'Unpaid (৭২ ঘণ্টা বকেয়া)' : 'Unpaid (72h Window Active)'}</option>
                        <option value="paid">{bn ? 'Paid (পরিশোধিত)' : 'Paid'}</option>
                        <option value="exempt">{bn ? 'Fee Exempt (প্রযোজ্য নয়)' : 'Fee Exempt'}</option>
                        <option value="expired">{bn ? 'Expired (মেয়াদ শেষ)' : 'Expired'}</option>
                      </select>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-semibold text-slate-600 dark:text-slate-400">
                          {bn ? 'ফি জমা দেওয়ার শেষ সময়' : 'Fee Payment Deadline'}
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              feePaymentStatus: draft.feePaymentStatus || 'unpaid',
                              feeDeadlineAt: Date.now() + 72 * 3_600_000,
                            })
                          }
                          className="text-[10.5px] font-bold text-petro-600 hover:underline cursor-pointer"
                        >
                          +72h Teletalk Window
                        </button>
                      </div>
                      <input
                        type="datetime-local"
                        value={toLocalDatetimeInputValue(draft.feeDeadlineAt)}
                        onChange={(e) => {
                          const ts = e.target.value ? new Date(e.target.value).getTime() : null;
                          setDraft({
                            ...draft,
                            feeDeadlineAt: Number.isFinite(ts) ? ts : null,
                          });
                        }}
                        className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Application Date</label>
                      <input
                        type="date"
                        value={draft.applicationDate || ''}
                        onChange={(e) => setDraft({ ...draft, applicationDate: e.target.value })}
                        className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Exam Date</label>
                      <input
                        type="date"
                        value={draft.examDate || ''}
                        onChange={(e) => setDraft({ ...draft, examDate: e.target.value })}
                        className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        {bn ? 'পরীক্ষার রোল নম্বর' : 'Exam Roll Number'}
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 4401285"
                        value={draft.examRoll || ''}
                        onChange={(e) => setDraft({ ...draft, examRoll: e.target.value })}
                        className="w-full font-mono border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        {bn ? 'পরীক্ষার কেন্দ্র (Venue)' : 'Exam Center / Venue'}
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Dhaka College"
                        value={draft.examVenue || ''}
                        onChange={(e) => setDraft({ ...draft, examVenue: e.target.value })}
                        className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Circular ID / Memo</label>
                      <input
                        type="text"
                        placeholder="e.g. BPSC-47-2026"
                        value={draft.circularId || ''}
                        onChange={(e) => setDraft({ ...draft, circularId: e.target.value })}
                        className="w-full font-mono border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Transaction ID (TXN)</label>
                      <input
                        type="text"
                        placeholder="Enter confirmed payment TXN ID..."
                        value={draft.transactionId || ''}
                        onChange={(e) => setDraft({ ...draft, transactionId: e.target.value })}
                        className="w-full font-mono border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Application Fee (BDT / Status)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. BDT 223 (Teletalk SMS)"
                        value={draft.applicationFeeAmount || ''}
                        onChange={(e) => setDraft({ ...draft, applicationFeeAmount: e.target.value })}
                        className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Payment Date (Do not enter PIN/OTP/Password)
                      </label>
                      <input
                        type="date"
                        value={draft.paymentDate || ''}
                        onChange={(e) => setDraft({ ...draft, paymentDate: e.target.value })}
                        className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Admit Card Status</label>
                      <select
                        value={draft.admitCardStatus || ''}
                        onChange={(e) =>
                          setDraft({ ...draft, admitCardStatus: (e.target.value || undefined) as AdmitCardStatus | undefined })
                        }
                        className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                      >
                        <option value="">-- Not Set --</option>
                        <option value="Not Published">Not Published</option>
                        <option value="Available">Available</option>
                        <option value="Downloaded">Downloaded</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Result Summary</label>
                      <input
                        type="text"
                        placeholder="e.g. Written Passed / Viva Qualified"
                        value={draft.resultSummary || ''}
                        onChange={(e) => setDraft({ ...draft, resultSummary: e.target.value })}
                        className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Admit Card URL</label>
                      <input
                        type="url"
                        placeholder="https://..."
                        value={draft.admitCardUrl || ''}
                        onChange={(e) => setDraft({ ...draft, admitCardUrl: e.target.value })}
                        className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Result Link</label>
                      <input
                        type="url"
                        placeholder="https://..."
                        value={draft.resultUrl || ''}
                        onChange={(e) => setDraft({ ...draft, resultUrl: e.target.value })}
                        className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Tracking Notes</label>
                      <textarea
                        rows={2}
                        value={draft.notes || ''}
                        onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                        placeholder="Password hint, SMS payment serial, seat room..."
                        className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                      />
                    </div>
                    <div className="sm:col-span-2 flex justify-end">
                      <button
                        type="button"
                        onClick={handleSave}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-petro-600 hover:bg-petro-700 text-white font-bold cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{bn ? 'আপডেট সংরক্ষণ' : 'Save Tracker'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Manual Add Application Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleManualAdd}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md shadow-2xl overflow-hidden text-xs"
          >
            <div className="px-5 py-3.5 bg-petro-700 text-white flex items-center justify-between">
              <span className="font-bold text-sm">{bn ? 'ম্যানুয়ালি আবেদন যোগ করুন' : 'Add Application Manually'}</span>
              <button type="button" onClick={() => setAddModalOpen(false)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block font-semibold mb-1">Organization *</label>
                <input
                  type="text"
                  required
                  value={newOrg}
                  onChange={(e) => setNewOrg(e.target.value)}
                  placeholder="e.g. Bangladesh Bank"
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Job Title *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Assistant Director"
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold mb-1">Circular ID</label>
                  <input
                    type="text"
                    value={newCircularId}
                    onChange={(e) => setNewCircularId(e.target.value)}
                    className="w-full font-mono border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as ApplicationStatus)}
                    className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800"
                  >
                    {APPLICATION_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Application Deadline</label>
                <input
                  type="date"
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Circular URL</label>
                <input
                  type="url"
                  value={newCircularUrl}
                  onChange={(e) => setNewCircularUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Application Portal URL</label>
                <input
                  type="url"
                  value={newAppUrl}
                  onChange={(e) => setNewAppUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800"
                />
              </div>
            </div>
            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-petro-600 hover:bg-petro-700 text-white font-bold cursor-pointer"
              >
                Save Application
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
