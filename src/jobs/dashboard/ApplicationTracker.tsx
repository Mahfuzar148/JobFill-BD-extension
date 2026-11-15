// JobFill BD - Local Application Tracker Component
// Tracks user application statuses without ever auto-marking Applied or auto-submitting.

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  AlertTriangle,
  Wrench,
  Globe,
  KeyRound,
  Lock,
  Unlock,
  Link2,
  Undo2,
  ShieldCheck,
  ShieldAlert,
  Eye,
  FileText,
  Send,
  ArrowUpRight,
} from 'lucide-react';
import {
  ApplicationTrackerRecord,
  ApplicationStatus,
  FeePaymentStatus,
  AdmitCardStatus,
  VisitedTrackerItem,
  JobVisitRecord,
} from '../types/job.types';
import { ApplicationRepository, APPLIED_STATUS_SET } from '../database/application-repository';
import { JobVisitRepository } from '../database/job-visit-repository';
import { verifyJobUrl } from '../services/source-verifier';
import { openApplicationPortalLoginTab } from '../services/job-ui-actions';
import {
  CredentialVaultRepository,
  CredentialPortalSummary,
} from '../../credentials/credential-repository';

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

export function toBnDigits(num: number | string): string {
  const digits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num).replace(/\d/g, (d) => digits[Number(d)]);
}

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'Interested',
  'Bookmarked',
  'Saved',
  'Ready to Apply',
  'Visited',
  'Application Started',
  'Submission Pending Verification',
  'Applied',
  'Submission Failed',
  'Needs Manual Confirmation',
  'Cancelled',
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
  visits?: JobVisitRecord[];
  initialTab?: 'visited' | 'applied';
}

export const ApplicationTracker: React.FC<ApplicationTrackerProps> = ({
  records,
  language = 'en',
  onUpdateRecord,
  onDeleteRecord,
  onOpenJob,
  onRefreshRecords,
  visits,
  initialTab = 'visited',
}) => {
  const bn = language === 'bn';
  const [primaryTab, setPrimaryTab] = useState<'visited' | 'applied'>(initialTab);
  const [visitRecords, setVisitRecords] = useState<JobVisitRecord[]>(visits || []);
  const [manualConfirmTarget, setManualConfirmTarget] = useState<VisitedTrackerItem | null>(null);
  const [confirmUserId, setConfirmUserId] = useState('');
  const [confirmTxnId, setConfirmTxnId] = useState('');
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
  const [portalModalRecord, setPortalModalRecord] = useState<ApplicationTrackerRecord | null>(null);
  const [vaultCredentials, setVaultCredentials] = useState<CredentialPortalSummary[]>([]);

  const loadVaultCredentials = async () => {
    try {
      const list = await CredentialVaultRepository.listPortalSummaries();
      setVaultCredentials(list);
    } catch {
      // safe fallback in unit or restricted context
    }
  };

  const loadVisits = async () => {
    try {
      const list = await JobVisitRepository.getAllVisits();
      setVisitRecords(list);
    } catch {
      // safe fallback in unit tests
    }
  };

  useEffect(() => {
    void loadVaultCredentials();
  }, []);

  useEffect(() => {
    if (visits) {
      setVisitRecords(visits);
    } else {
      void loadVisits();
    }
  }, [visits, records]);

  const getPortalDomain = (url?: string | null): string => {
    if (!url) return '';
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  };

  const getMatchingCredentialsForRecord = (
    rec: ApplicationTrackerRecord
  ): CredentialPortalSummary[] => {
    if (rec.credentialId) {
      const direct = vaultCredentials.find((c) => c.id === rec.credentialId);
      if (direct) return [direct];
    }
    const targetUrl = rec.loginUrl || rec.applicationUrl;
    if (!targetUrl) return [];
    const domain = getPortalDomain(targetUrl);
    if (!domain) return [];
    return vaultCredentials.filter((c) => {
      const credDomain = getPortalDomain(c.origin || c.portalUrl);
      return credDomain && (credDomain === domain || credDomain.endsWith(`.${domain}`) || domain.endsWith(`.${credDomain}`));
    });
  };

  const handleLoginToPortal = async (rec: ApplicationTrackerRecord) => {
    await openApplicationPortalLoginTab(
      rec,
      (msg) => setBackupNotice(msg),
      bn,
      (missingApp) => setPortalModalRecord(missingApp)
    );
  };

  // Derive VISITED and APPLIED collections with strict mutual exclusivity
  const { visited, applied, visitedCount, appliedCount } = useMemo(() => {
    const appliedList = records
      .filter((r) => APPLIED_STATUS_SET.has(r.status))
      .sort((a, b) => (b.submissionConfirmedAt || b.updatedAt) - (a.submissionConfirmedAt || a.updatedAt));

    const appliedIds = new Set(appliedList.map((a) => a.jobId).filter(Boolean));
    const appliedUrls = new Set(
      appliedList
        .flatMap((a) => [a.circularUrl, a.applicationUrl])
        .filter(Boolean)
        .map((u) => JobVisitRepository.canonicalizeJobUrl(u!))
    );

    const visitedMap = new Map<string, VisitedTrackerItem>();

    // 1. Non-applied application records (e.g. Visited, Application Started, etc.)
    for (const r of records) {
      if (APPLIED_STATUS_SET.has(r.status)) continue;
      if (r.jobId && appliedIds.has(r.jobId)) continue;
      const cUrl = r.circularUrl ? JobVisitRepository.canonicalizeJobUrl(r.circularUrl) : '';
      const aUrl = r.applicationUrl ? JobVisitRepository.canonicalizeJobUrl(r.applicationUrl) : '';
      if (cUrl && appliedUrls.has(cUrl)) continue;
      if (aUrl && appliedUrls.has(aUrl)) continue;

      const key = r.jobId || cUrl || aUrl || `rec_${r.createdAt}`;
      visitedMap.set(key, {
        id: r.jobId,
        jobId: r.jobId,
        visitId: null,
        jobTitle: r.jobTitle,
        organization: r.organization,
        circularId: r.circularId,
        circularUrl: r.circularUrl,
        applicationUrl: r.applicationUrl,
        loginUrl: r.loginUrl,
        deadlineAt: r.deadlineAt,
        firstVisitedAt: r.createdAt,
        lastVisitedAt: r.updatedAt,
        visitCount: 1,
        subStatus: r.status,
        needsReview: r.needsReview,
        reviewReason: r.reviewReason,
        verificationStatus: 'verified',
        applicationRecord: r,
        visitRecord: null,
      });
    }

    // 2. Job visits from repository
    for (const v of visitRecords) {
      if (v.jobId && appliedIds.has(v.jobId)) continue;
      if (v.canonicalUrl && appliedUrls.has(v.canonicalUrl)) continue;
      const vCanon = v.circularUrl ? JobVisitRepository.canonicalizeJobUrl(v.circularUrl) : '';
      if (vCanon && appliedUrls.has(vCanon)) continue;

      let matchKey: string | null = null;
      if (v.jobId && visitedMap.has(v.jobId)) {
        matchKey = v.jobId;
      } else if (v.canonicalUrl && visitedMap.has(v.canonicalUrl)) {
        matchKey = v.canonicalUrl;
      } else if (vCanon && visitedMap.has(vCanon)) {
        matchKey = vCanon;
      } else {
        for (const [k, item] of visitedMap.entries()) {
          const iC = item.circularUrl ? JobVisitRepository.canonicalizeJobUrl(item.circularUrl) : '';
          const iA = item.applicationUrl ? JobVisitRepository.canonicalizeJobUrl(item.applicationUrl) : '';
          if (
            (v.jobId && item.jobId === v.jobId) ||
            (v.canonicalUrl && (iC === v.canonicalUrl || iA === v.canonicalUrl)) ||
            (vCanon && (iC === vCanon || iA === vCanon))
          ) {
            matchKey = k;
            break;
          }
        }
      }

      if (matchKey && visitedMap.has(matchKey)) {
        const existing = visitedMap.get(matchKey)!;
        existing.visitId = v.visitId;
        existing.visitRecord = v;
        existing.visitCount = Math.max(existing.visitCount, v.visitCount || 1);
        existing.lastVisitedAt = Math.max(existing.lastVisitedAt, v.lastVisitedAt);
        existing.firstVisitedAt = Math.min(existing.firstVisitedAt, v.firstVisitedAt);
        if (!existing.circularUrl && v.circularUrl) existing.circularUrl = v.circularUrl;
        if (!existing.applicationUrl && v.applicationUrl) existing.applicationUrl = v.applicationUrl;
        if (!existing.circularId && v.circularId) existing.circularId = v.circularId;
        if (!existing.deadlineAt && v.deadlineAt) existing.deadlineAt = v.deadlineAt;
      } else {
        const key = v.jobId || v.canonicalUrl || v.visitId;
        visitedMap.set(key, {
          id: v.visitId,
          jobId: v.jobId || null,
          visitId: v.visitId,
          jobTitle: v.jobTitle,
          organization: v.organization,
          circularId: v.circularId,
          circularUrl: v.circularUrl,
          applicationUrl: v.applicationUrl || null,
          loginUrl: null,
          deadlineAt: v.deadlineAt ?? null,
          firstVisitedAt: v.firstVisitedAt,
          lastVisitedAt: v.lastVisitedAt,
          visitCount: v.visitCount || 1,
          subStatus: (v.subStatus as any) || 'Visited',
          needsReview: false,
          verificationStatus: v.verificationStatus,
          applicationRecord: null,
          visitRecord: v,
        });
      }
    }

    const visitedList = Array.from(visitedMap.values())
      .filter((v) => {
        if (v.jobId && appliedIds.has(v.jobId)) return false;
        const c = v.circularUrl ? JobVisitRepository.canonicalizeJobUrl(v.circularUrl) : '';
        if (c && appliedUrls.has(c)) return false;
        return true;
      })
      .sort((a, b) => b.lastVisitedAt - a.lastVisitedAt);

    return {
      visited: visitedList,
      applied: appliedList,
      visitedCount: visitedList.length,
      appliedCount: appliedList.length,
    };
  }, [records, visitRecords]);

  const organizations = useMemo(() => {
    const set = new Set<string>();
    for (const a of applied) if (a.organization) set.add(a.organization);
    for (const v of visited) if (v.organization) set.add(v.organization);
    return Array.from(set).sort();
  }, [applied, visited]);

  const filteredVisited = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const now = Date.now();
    const sevenDaysMs = 7 * 86_400_000;

    const list = visited.filter((v) => {
      if (orgFilter !== 'All' && v.organization !== orgFilter) return false;
      if (deadlineFilter === 'closing_7d') {
        if (!v.deadlineAt || v.deadlineAt <= now || v.deadlineAt - now > sevenDaysMs) return false;
      } else if (deadlineFilter === 'expired') {
        if (!v.deadlineAt || v.deadlineAt > now) return false;
      } else if (deadlineFilter === 'none') {
        if (v.deadlineAt) return false;
      }
      if (!q) return true;
      return (
        v.jobTitle.toLowerCase().includes(q) ||
        v.organization.toLowerCase().includes(q) ||
        (v.circularId || '').toLowerCase().includes(q)
      );
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'deadline_asc') {
        const ad = a.deadlineAt ?? Number.MAX_SAFE_INTEGER;
        const bd = b.deadlineAt ?? Number.MAX_SAFE_INTEGER;
        return ad - bd;
      }
      return b.lastVisitedAt - a.lastVisitedAt;
    });
  }, [visited, orgFilter, deadlineFilter, sortBy, searchQuery]);

  const filteredApplied = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const now = Date.now();
    const sevenDaysMs = 7 * 86_400_000;

    const list = applied.filter((r) => {
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
      return (b.submissionConfirmedAt || b.updatedAt) - (a.submissionConfirmedAt || a.updatedAt);
    });
  }, [applied, statusFilter, orgFilter, deadlineFilter, sortBy, searchQuery]);

  const handleMoveToApplied = async (
    targetId: string,
    evidence?: {
      teletalkUserId?: string;
      applicantId?: string;
      transactionId?: string;
      notes?: string;
    }
  ) => {
    try {
      const updated = await ApplicationRepository.moveJobToApplied(targetId, {
        teletalkUserId: evidence?.teletalkUserId,
        applicantId: evidence?.applicantId,
        transactionId: evidence?.transactionId,
        notes: evidence?.notes,
        confirmedAt: Date.now(),
      });
      await onUpdateRecord(updated);
      await loadVisits();
      if (onRefreshRecords) {
        await onRefreshRecords();
      }
      setManualConfirmTarget(null);
      setConfirmUserId('');
      setConfirmTxnId('');
      setBackupNotice(
        bn
          ? '✅ আবেদনটি সফলভাবে "আবেদন সম্পন্ন (Applied)" ট্যাবে স্থানান্তরিত হয়েছে।'
          : '✅ Application successfully moved to "APPLIED" tab.'
      );
    } catch (err: any) {
      setBackupNotice(`Error moving to applied: ${err?.message || 'Failed'}`);
    }
  };

  const handleRemoveFromVisited = async (id: string) => {
    try {
      await ApplicationRepository.removeFromVisited(id);
      await loadVisits();
      if (onRefreshRecords) {
        await onRefreshRecords();
      }
      setBackupNotice(
        bn
          ? 'সার্কুলারটি "দেখা হয়েছে" তালিকা থেকে সরানো হয়েছে।'
          : 'Job removed from Visited list.'
      );
    } catch (err: any) {
      setBackupNotice(`Error removing from visited: ${err?.message || 'Failed'}`);
    }
  };

  const handleStartApplication = async (item: VisitedTrackerItem) => {
    const targetUrl = item.applicationUrl || item.circularUrl;
    if (targetUrl) {
      try {
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      } catch {
        // safe fallback
      }
    }
    const targetJobId = item.jobId || item.id;
    const rec: ApplicationTrackerRecord = item.applicationRecord || {
      jobId: targetJobId,
      jobTitle: item.jobTitle,
      organization: item.organization,
      circularId: item.circularId,
      circularUrl: item.circularUrl,
      applicationUrl: item.applicationUrl,
      loginUrl: item.loginUrl,
      deadlineAt: item.deadlineAt,
      status: 'Application Started',
      createdAt: item.firstVisitedAt || Date.now(),
      updatedAt: Date.now(),
    };
    rec.status = 'Application Started';
    rec.updatedAt = Date.now();
    await onUpdateRecord(rec);
    await loadVisits();
    if (onRefreshRecords) {
      await onRefreshRecords();
    }
  };

  const openPortalModalForVisited = (item: VisitedTrackerItem) => {
    const rec: ApplicationTrackerRecord = item.applicationRecord || {
      jobId: item.jobId || item.id,
      jobTitle: item.jobTitle,
      organization: item.organization,
      circularId: item.circularId,
      circularUrl: item.circularUrl,
      applicationUrl: item.applicationUrl,
      loginUrl: item.loginUrl,
      deadlineAt: item.deadlineAt,
      status: (item.subStatus as ApplicationStatus) || 'Visited',
      createdAt: item.firstVisitedAt,
      updatedAt: item.lastVisitedAt,
    };
    setPortalModalRecord(rec);
  };

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

  const reviewNeededRecords = useMemo(
    () => records.filter((r) => r.needsReview || r.status === 'Needs Manual Confirmation'),
    [records]
  );

  const handleConfirmAllAsApplied = async () => {
    for (const rec of reviewNeededRecords) {
      await onUpdateRecord({
        ...rec,
        status: 'Applied',
        needsReview: false,
        reviewReason: undefined,
        submissionConfirmedAt: Date.now(),
      });
    }
    setBackupNotice(
      bn
        ? `✅ ${reviewNeededRecords.length}টি আবেদন সফলভাবে Applied হিসেবে নিশ্চিত করা হয়েছে।`
        : `✅ Confirmed ${reviewNeededRecords.length} application(s) as Applied.`
    );
  };

  const handleKeepAllAsVisitedOnly = async () => {
    for (const rec of reviewNeededRecords) {
      await JobVisitRepository.recordVisit({
        jobId: rec.jobId,
        jobTitle: rec.jobTitle,
        organization: rec.organization,
        circularUrl: rec.circularUrl || rec.applicationUrl || '',
        deadlineAt: rec.deadlineAt,
        verificationStatus: 'verified',
      });
      await onDeleteRecord(rec.jobId);
    }
    setBackupNotice(
      bn
        ? `ℹ️ ${reviewNeededRecords.length}টি রেকর্ড ভিজিট হিস্ট্রিতে স্থানান্তরিত হয়েছে এবং ট্র্যাকার থেকে সরানো হয়েছে।`
        : `ℹ️ Preserved ${reviewNeededRecords.length} record(s) in Visited History and cleared from tracker.`
    );
  };

  const handleRunAuditAndRepair = async () => {
    try {
      const res = await ApplicationRepository.repairMisclassifiedRecords();
      if (onRefreshRecords) {
        await onRefreshRecords();
      }
      if (res.repaired > 0) {
        setBackupNotice(
          bn
            ? `⚠️ ${res.repaired}টি আবেদন রেকর্ডে প্রমাণ না থাকায় পর্যালোচনার জন্য চিহ্নিত করা হয়েছে।`
            : `⚠️ ${res.repaired} unverified application(s) flagged for your review.`
        );
      } else {
        setBackupNotice(
          bn
            ? '✅ সব আবেদন রেকর্ড ইতিমধ্যে যাচাইকৃত ও সঠিক।'
            : '✅ All application records have verified submission evidence.'
        );
      }
    } catch (err: any) {
      setBackupNotice(`Audit error: ${err?.message || 'Failed'}`);
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
      case 'Visited':
        return 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300';
      case 'Application Started':
        return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300';
      case 'Submission Pending Verification':
        return 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200';
      case 'Submission Failed':
        return 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200';
      case 'Needs Manual Confirmation':
        return 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200';
      case 'Cancelled':
        return 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300';
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
          <button
            type="button"
            onClick={handleRunAuditAndRepair}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 rounded-xl px-3 py-2 text-amber-800 dark:text-amber-200 cursor-pointer"
            title={bn ? 'অপ্রমাণিত Applied রেকর্ড স্বয়ংক্রিয়ভাবে শনাক্ত ও মেরামত করুন' : 'Audit and repair misclassified Applied records'}
          >
            <Wrench className="w-3.5 h-3.5 text-amber-600" />
            <span>{bn ? 'অডিট ও মেরামত' : 'Audit & Repair'}</span>
          </button>
        </div>
      </div>

      {backupNotice && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
          {backupNotice}
        </div>
      )}

      {reviewNeededRecords.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                {bn
                  ? `${reviewNeededRecords.length}টি আবেদনের অবস্থা পর্যালোচনা প্রয়োজন (কোনো সাবমিশন প্রমাণ নেই)`
                  : `${reviewNeededRecords.length} application(s) need confirmation (no verified submission proof)`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleConfirmAllAsApplied}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs"
              >
                {bn ? 'সবগুলো আবেদনকৃত নিশ্চিত করুন' : 'Confirm All as Applied'}
              </button>
              <button
                type="button"
                onClick={handleKeepAllAsVisitedOnly}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-300 cursor-pointer"
              >
                {bn ? 'শুধু ভিজিট হিসেবে রাখুন' : 'Keep as Visited Only'}
              </button>
            </div>
          </div>
          <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
            {bn
              ? 'এই রেকর্ডগুলি পূর্বে স্বয়ংক্রিয়ভাবে Applied হিসেবে চিহ্নিত হয়েছিল কিন্তু কোনো প্রাপ্তিস্বীকার বা ইউজার আইডি পাওয়া যায়নি। আপনি নিশ্চিত করলে Applied থাকবে, অথবা ভিজিট হিস্ট্রিতে রাখতে পারবেন।'
              : 'These records were previously tracked as Applied without confirmation receipts or candidate IDs. You can either confirm them or preserve them in Visited History.'}
          </p>
        </div>
      )}

      {/* Primary Two-Tab Selector: VISITED vs APPLIED */}
      <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/60">
        <button
          type="button"
          onClick={() => setPrimaryTab('visited')}
          className={`flex items-center justify-between p-3.5 rounded-xl transition-all cursor-pointer text-left ${
            primaryTab === 'visited'
              ? 'bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-700 ring-2 ring-blue-500/30'
              : 'hover:bg-white/60 dark:hover:bg-slate-900/40 text-slate-600 dark:text-slate-400'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                primaryTab === 'visited'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm tracking-wide text-slate-800 dark:text-white uppercase">
                  {bn ? 'দেখা হয়েছে (Visited)' : 'VISITED'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  # {visitedCount}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {bn ? 'দেখা হয়েছে, আবেদন সম্পন্ন হয়নি' : 'Circulars viewed, application pending'}
              </p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setPrimaryTab('applied')}
          className={`flex items-center justify-between p-3.5 rounded-xl transition-all cursor-pointer text-left ${
            primaryTab === 'applied'
              ? 'bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-700 ring-2 ring-emerald-500/30'
              : 'hover:bg-white/60 dark:hover:bg-slate-900/40 text-slate-600 dark:text-slate-400'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                primaryTab === 'applied'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm tracking-wide text-slate-800 dark:text-white uppercase">
                  {bn ? 'আবেদন সম্পন্ন (Applied)' : 'APPLIED'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  # {appliedCount}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {bn ? 'আবেদন সফলভাবে সম্পন্ন' : 'Confirmed submitted applications'}
              </p>
            </div>
          </div>
        </button>
      </div>

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

      {/* VISITED Tab View: Circulars opened / viewed but not applied */}
      <div className={primaryTab === 'visited' ? 'space-y-3' : 'hidden space-y-3'}>
        {filteredVisited.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-2">
            <Eye className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              {bn ? 'কোনো দেখা চাকরি (Visited) নেই' : 'No visited job circulars yet'}
            </p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {bn
                ? 'যেকোনো চাকরির সার্কুলার খুলে দেখলে তা স্বয়ংক্রিয়ভাবে এখানে তালিকাভুক্ত হবে। আবেদন সম্পন্ন হলে তা Applied ট্যাবে চলে যাবে।'
                : 'Any job circular you inspect appears here automatically until its application is completed.'}
            </p>
          </div>
        ) : (
          filteredVisited.map((item) => {
            const portalDomain = getPortalDomain(item.loginUrl || item.applicationUrl);
            return (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-xs transition-all hover:border-slate-300 dark:hover:border-slate-700"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10.5px] font-bold px-2.5 py-0.5 rounded-full border ${statusColor(item.subStatus as ApplicationStatus)}`}>
                        {item.subStatus === 'Visited' ? (bn ? 'দেখা হয়েছে' : 'Visited') : item.subStatus}
                      </span>
                      <span className="text-xs font-bold text-petro-700 dark:text-petro-400">
                        {item.organization}
                      </span>
                    </div>
                    <h3 className="text-sm font-extrabold text-slate-800 dark:text-white mt-1">
                      {item.jobTitle}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Primary Action Button: আবেদন করুন */}
                    {(item.applicationUrl || item.circularUrl) && (
                      <button
                        type="button"
                        onClick={() => handleStartApplication(item)}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-petro-600 hover:bg-petro-700 text-white flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                        title={bn ? 'আবেদন শুরু করুন' : 'Open application and start autofill'}
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        <span>{bn ? 'আবেদন করুন' : 'Apply Now'}</span>
                      </button>
                    )}

                    {/* Transition to Applied Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setManualConfirmTarget(item);
                        setConfirmUserId(item.applicationRecord?.teletalkUserId || '');
                        setConfirmTxnId(item.applicationRecord?.transactionId || '');
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 flex items-center gap-1.5 cursor-pointer"
                      title={bn ? 'আবেদন সম্পন্ন হয়েছে নিশ্চিত করুন' : 'Mark as Applied and move to Applied tab'}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{bn ? 'আবেদন সম্পন্ন চিহ্নিত করুন' : 'Mark as Applied'}</span>
                    </button>

                    {/* Details modal */}
                    <button
                      type="button"
                      onClick={() => openPortalModalForVisited(item)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 cursor-pointer flex items-center gap-1"
                    >
                      {bn ? 'বিস্তারিত' : 'Details'}
                    </button>

                    {/* Remove from visited */}
                    <button
                      type="button"
                      onClick={() => handleRemoveFromVisited(item.id)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                      title={bn ? 'দেখা হয়েছে তালিকা থেকে মুছুন' : 'Remove from Visited'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Portal Domain & Portal Link Row */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
                  {portalDomain ? (
                    <div className="inline-flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                      <Globe className="w-3.5 h-3.5 text-petro-600 dark:text-petro-400" />
                      <span className="text-[11px] font-medium text-slate-500">{bn ? 'পোর্টাল:' : 'Portal:'}</span>
                      <strong className="font-mono text-slate-800 dark:text-slate-200">{portalDomain}</strong>
                    </div>
                  ) : null}

                  {item.loginUrl ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (item.applicationRecord) {
                          handleLoginToPortal(item.applicationRecord);
                        } else {
                          openPortalModalForVisited(item);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>{bn ? 'পোর্টালে লগইন করুন' : 'Login to Portal'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openPortalModalForVisited(item)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 text-xs font-bold cursor-pointer"
                    >
                      <Link2 className="w-3.5 h-3.5 text-sky-600" />
                      <span>{bn ? 'পোর্টাল লিংক যোগ করুন' : 'Add Portal Link'}</span>
                    </button>
                  )}
                </div>

                {/* Metadata summary */}
                <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {item.circularId && (
                    <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                      Circular: <strong className="font-mono text-slate-700 dark:text-slate-200">{item.circularId}</strong>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                    <Eye className="w-3 h-3 text-blue-500" />
                    <span>{bn ? `ভিজিট: ${toBnDigits(item.visitCount)} বার` : `Visits: ${item.visitCount}`}</span>
                  </span>
                  {item.lastVisitedAt && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{bn ? 'সর্বশেষ: ' : 'Last: '}</span>
                      <strong className="text-slate-700 dark:text-slate-200">
                        {new Date(item.lastVisitedAt).toLocaleDateString(bn ? 'bn-BD' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </strong>
                    </span>
                  )}
                  {item.circularUrl && (
                    <a
                      href={item.circularUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-petro-600 hover:underline inline-flex items-center gap-1 font-semibold"
                    >
                      <FileText className="w-3 h-3" />
                      <span>{bn ? 'সার্কুলার দেখুন' : 'View Circular'}</span>
                    </a>
                  )}
                  {item.applicationUrl && (
                    <a
                      href={item.applicationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline inline-flex items-center gap-1 font-semibold"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>{bn ? 'আবেদন লিংক' : 'Application Link'}</span>
                    </a>
                  )}
                  {item.deadlineAt && (
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                      <Clock className="w-3 h-3" />
                      <span>Deadline: {new Date(item.deadlineAt).toLocaleDateString(bn ? 'bn-BD' : 'en-US')}</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* APPLIED Tab View: Confirmed submitted applications */}
      <div className={primaryTab === 'applied' ? 'space-y-3' : 'hidden space-y-3'}>
        {filteredApplied.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              {bn ? 'কোনো আবেদন সম্পন্ন চাকরি নেই' : 'No confirmed applied jobs yet'}
            </p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {bn
                ? 'কোনো চাকরিতে আবেদন সম্পন্ন হলে অথবা ফর্ম সাবমিট নিশ্চিত হলে তা এখানে সংরক্ষিত থাকবে।'
                : 'Jobs with confirmed application submission will be tracked here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredApplied.map((rec) => {
            const isEditing = editingId === rec.jobId && draft;
            const portalDomain = getPortalDomain(rec.loginUrl || rec.applicationUrl);
            const matchingCreds = getMatchingCredentialsForRecord(rec);
            const hasCredential = Boolean(rec.credentialId || matchingCreds.length > 0);

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
                    {/* Primary Action Button: পোর্টালে লগইন করুন */}
                    {rec.loginUrl ? (
                      <button
                        type="button"
                        onClick={() => handleLoginToPortal(rec)}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                        title={bn ? 'সংরক্ষিত পোর্টালে লগইন করুন' : 'Open portal login page and autofill'}
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>{bn ? 'পোর্টালে লগইন করুন' : 'Login to Portal'}</span>
                        <ExternalLink className="w-3 h-3 opacity-80" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPortalModalRecord(rec)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 hover:bg-sky-100 dark:hover:bg-sky-900/40 flex items-center gap-1.5 cursor-pointer"
                        title={bn ? 'অফিশিয়াল পোর্টাল লগইন লিংক যোগ করুন' : 'Add official portal login link'}
                      >
                        <Link2 className="w-3.5 h-3.5 text-sky-600" />
                        <span>{bn ? 'পোর্টাল লিংক যোগ করুন' : 'Add Portal Link'}</span>
                      </button>
                    )}

                    <select
                      value={rec.status}
                      onChange={(e) => onUpdateRecord({ ...rec, status: e.target.value as ApplicationStatus })}
                      className="text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg px-2.5 py-1.5"
                    >
                      {APPLICATION_STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => setPortalModalRecord(rec)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 cursor-pointer flex items-center gap-1"
                    >
                      {bn ? 'বিস্তারিত' : 'Details'}
                    </button>

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

                {/* Portal Domain & Credential Vault Row */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
                  {portalDomain ? (
                    <div className="inline-flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                      <Globe className="w-3.5 h-3.5 text-petro-600 dark:text-petro-400" />
                      <span className="text-[11px] font-medium text-slate-500">{bn ? 'পোর্টাল:' : 'Portal:'}</span>
                      <strong className="font-mono text-slate-800 dark:text-slate-200">{portalDomain}</strong>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPortalModalRecord(rec)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-sky-600 cursor-pointer"
                    >
                      <Globe className="w-3 h-3" />
                      <span>{bn ? 'পোর্টাল ডোমেন নেই (যোগ করুন)' : 'No portal domain (click to add)'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setPortalModalRecord(rec)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border cursor-pointer text-xs transition-colors ${
                      hasCredential
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 hover:bg-emerald-100'
                        : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                    title={bn ? 'ক্রেডেনশিয়াল ভল্ট সংযোগ পরিচালনা করুন' : 'Manage linked vault credential'}
                  >
                    <Lock className={`w-3.5 h-3.5 ${hasCredential ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span className="font-semibold">
                      {hasCredential
                        ? (bn ? 'Credential Vault · এনক্রিপ্টেড' : 'Credential Vault · Encrypted')
                        : (bn ? 'লগইন তথ্য যোগ করুন' : 'Link Login Credential')}
                    </span>
                  </button>
                </div>

                {Boolean(rec.needsReview || rec.status === 'Needs Manual Confirmation') && (
                  <div className="flex items-center justify-between flex-wrap gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs">
                    <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-200 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>
                        {rec.reviewReason ||
                          (bn
                            ? 'যাচাই প্রয়োজন: প্রাপ্তিস্বীকার বা ইউজার আইডি ছাড়াই Applied হিসেবে ছিল।'
                            : 'Review required: Marked Applied without receipt evidence.')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateRecord({
                            ...rec,
                            status: 'Applied',
                            needsReview: false,
                            reviewReason: undefined,
                            submissionConfirmedAt: Date.now(),
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer"
                      >
                        {bn ? 'আবেদনকৃত নিশ্চিত করুন' : 'Confirm Applied'}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await JobVisitRepository.recordVisit({
                            jobId: rec.jobId,
                            jobTitle: rec.jobTitle,
                            organization: rec.organization,
                            circularUrl: rec.circularUrl || rec.applicationUrl || '',
                            deadlineAt: rec.deadlineAt,
                            verificationStatus: 'verified',
                          });
                          await onDeleteRecord(rec.jobId);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 font-bold text-[11px] cursor-pointer"
                      >
                        {bn ? 'শুধু ভিজিট রাখুন' : 'Keep as Visited'}
                      </button>
                    </div>
                  </div>
                )}

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
      </div>

      {/* Manual Confirm Modal for moving from Visited to Applied */}
      {manualConfirmTarget && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md shadow-2xl overflow-hidden text-xs space-y-4 p-5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{bn ? 'আবেদন সম্পন্ন নিশ্চিত করুন' : 'Confirm Application Submission'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setManualConfirmTarget(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <p className="font-extrabold text-sm text-slate-800 dark:text-slate-100">{manualConfirmTarget.jobTitle}</p>
              <p className="text-xs font-semibold text-petro-700 dark:text-petro-400">{manualConfirmTarget.organization}</p>
            </div>

            <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
              {bn
                ? 'এই চাকরিটি "দেখা হয়েছে" থেকে "আবেদন সম্পন্ন" ট্যাবে স্থানান্তরিত হবে। ইউজার আইডি জানা থাকলে প্রবেশ করাতে পারেন।'
                : 'This job will move from "VISITED" to "APPLIED". Enter your applicant/user ID if available.'}
            </p>

            <div className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {bn ? 'Teletalk User ID / Applicant ID (ঐচ্ছিক)' : 'User ID / Applicant ID (Optional)'}
                </label>
                <input
                  type="text"
                  value={confirmUserId}
                  onChange={(e) => setConfirmUserId(e.target.value)}
                  placeholder="e.g. NIZJARPKQP"
                  className="w-full font-mono border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {bn ? 'Transaction ID / Ref (ঐচ্ছিক)' : 'Transaction ID / Ref (Optional)'}
                </label>
                <input
                  type="text"
                  value={confirmTxnId}
                  onChange={(e) => setConfirmTxnId(e.target.value)}
                  placeholder="e.g. TXN987654321"
                  className="w-full font-mono border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-800"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setManualConfirmTarget(null)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
              >
                {bn ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() =>
                  handleMoveToApplied(manualConfirmTarget.id, {
                    teletalkUserId: confirmUserId.trim() || undefined,
                    transactionId: confirmTxnId.trim() || undefined,
                  })
                }
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                {bn ? 'আবেদন সম্পন্ন চিহ্নিত করুন' : 'Confirm as Applied'}
              </button>
            </div>
          </div>
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

      {/* Application Portal & Credential Vault Management Modal */}
      {portalModalRecord && (
        <ApplicationPortalModal
          record={portalModalRecord}
          language={language}
          vaultCredentials={vaultCredentials}
          onClose={() => setPortalModalRecord(null)}
          onSave={async (updated) => {
            await onUpdateRecord(updated);
            setBackupNotice(
              bn
                ? `✅ "${updated.organization}"-এর পোর্টাল ও লগইন তথ্য সংরক্ষিত হয়েছে।`
                : `✅ Portal and login settings saved for "${updated.organization}".`
            );
          }}
          onRefreshCredentials={loadVaultCredentials}
        />
      )}
    </div>
  );
};

interface ApplicationPortalModalProps {
  record: ApplicationTrackerRecord;
  language: 'bn' | 'en';
  onClose: () => void;
  onSave: (updated: ApplicationTrackerRecord) => Promise<void>;
  vaultCredentials: CredentialPortalSummary[];
  onRefreshCredentials?: () => Promise<void>;
}

export const ApplicationPortalModal: React.FC<ApplicationPortalModalProps> = ({
  record,
  language,
  onClose,
  onSave,
  vaultCredentials,
  onRefreshCredentials,
}) => {
  const bn = language === 'bn';
  const [loginUrl, setLoginUrl] = useState(record.loginUrl || '');
  const [applicationUrl, setApplicationUrl] = useState(record.applicationUrl || '');
  const [circularUrl, setCircularUrl] = useState(record.circularUrl || '');
  const [organizationUrl, setOrganizationUrl] = useState(record.organizationUrl || '');
  const [selectedCredId, setSelectedCredId] = useState(record.credentialId || '');
  const [isAddingNewCred, setIsAddingNewCred] = useState(false);
  const [newUserId, setNewUserId] = useState(record.teletalkUserId || record.applicantId || '');
  const [newPassword, setNewPassword] = useState('');
  const [newAccountType, setNewAccountType] = useState('Job-Specific Account');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Derive domain from loginUrl or applicationUrl
  const portalDomain = useMemo(() => {
    const raw = loginUrl || applicationUrl;
    if (!raw) return '';
    try {
      const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
      return u.hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }, [loginUrl, applicationUrl]);

  // Matching credentials for this portal
  const matchingCreds = useMemo(() => {
    if (!portalDomain) return vaultCredentials;
    return vaultCredentials.filter((c) => {
      try {
        const u = new URL(c.origin || c.portalUrl);
        const d = u.hostname.replace(/^www\./, '');
        return d === portalDomain || d.endsWith(`.${portalDomain}`) || portalDomain.endsWith(`.${d}`);
      } catch {
        return false;
      }
    });
  }, [portalDomain, vaultCredentials]);

  const linkedCredentialSummary = useMemo(() => {
    if (!selectedCredId) return null;
    return vaultCredentials.find((c) => c.id === selectedCredId) || null;
  }, [selectedCredId, vaultCredentials]);

  const handleTestOpen = (url: string) => {
    if (!url.trim()) return;
    const check = ApplicationRepository.sanitizeAndValidateUrl(url);
    if (!check.isValid) {
      setErrorMessage(check.reason || 'Invalid URL');
      return;
    }
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url: check.normalizedUrl });
    } else {
      window.open(check.normalizedUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleUndoLoginUrl = () => {
    if (record.previousLoginUrl !== undefined) {
      setLoginUrl(record.previousLoginUrl || '');
      setErrorMessage('');
      setSuccessMessage(bn ? 'পূর্বাবস্থায় ফেরত আনা হয়েছে।' : 'Reverted to previous URL.');
    }
  };

  const handleCreateAndLinkCredential = async () => {
    setErrorMessage('');
    if (!newUserId.trim() || !newPassword) {
      setErrorMessage(bn ? 'ইউজার আইডি এবং পাসওয়ার্ড উভয়ই প্রদান করুন।' : 'Provide both User ID and password.');
      return;
    }
    const targetUrl = loginUrl.trim() || applicationUrl.trim();
    if (!targetUrl) {
      setErrorMessage(bn ? 'প্রথমে একটি পোর্টাল লগইন লিংক প্রদান করুন।' : 'Enter a portal login URL first.');
      return;
    }
    const check = ApplicationRepository.sanitizeAndValidateUrl(targetUrl);
    if (!check.isValid || check.isPdfCircular) {
      setErrorMessage(check.reason || 'Invalid portal URL');
      return;
    }

    try {
      const newCred = await CredentialVaultRepository.saveCredential({
        portalName: record.organization,
        portalUrl: check.normalizedUrl,
        organization: record.organization,
        jobTitle: record.jobTitle,
        username: newUserId.trim(),
        userId: newUserId.trim(),
        applicantId: newUserId.trim(),
        password: newPassword,
        accountType: newAccountType as any,
        linkedApplicationIds: [record.jobId],
        notes: `Created from tracker for ${record.jobTitle}`,
      });
      setSelectedCredId(newCred.id);
      setIsAddingNewCred(false);
      setNewPassword('');
      if (onRefreshCredentials) {
        await onRefreshCredentials();
      }
      setSuccessMessage(bn ? '✅ ক্রেডেনশিয়াল ভল্টে সংরক্ষিত ও সংযুক্ত করা হয়েছে।' : '✅ Credential saved into vault and linked.');
    } catch (err: any) {
      setErrorMessage(`Vault error: ${err?.message || 'Failed'}`);
    }
  };

  const handleSaveModal = async () => {
    setErrorMessage('');
    setIsSaving(true);
    try {
      let cleanLogin: string | null = null;
      let loginVerified = record.loginUrlVerified || false;
      let provenance = record.loginUrlProvenance || 'manual';

      if (loginUrl.trim()) {
        const check = ApplicationRepository.sanitizeAndValidateUrl(loginUrl.trim());
        if (check.isPdfCircular) {
          setErrorMessage(
            bn
              ? '⚠️ সার্কুলার পিডিএফ ফাইল কখনো লগইন পেজ হতে পারে না। অনুগ্রহ করে প্রকৃত প্রার্থীর লগইন লিংক প্রদান করুন।'
              : '⚠️ Circular PDF cannot be used as a Login URL. Please enter the actual candidate login portal.'
          );
          setIsSaving(false);
          return;
        }
        if (!check.isValid) {
          setErrorMessage(check.reason || (bn ? 'অবৈধ পোর্টাল লগইন লিংক' : 'Invalid portal URL'));
          setIsSaving(false);
          return;
        }
        cleanLogin = check.normalizedUrl;
        loginVerified = check.isHttps;
        provenance = 'manual';
      }

      const updatedRecord: ApplicationTrackerRecord = {
        ...record,
        loginUrl: cleanLogin,
        previousLoginUrl: cleanLogin !== record.loginUrl ? (record.loginUrl ?? null) : (record.previousLoginUrl ?? null),
        loginUrlVerified: loginVerified,
        loginUrlProvenance: provenance,
        applicationUrl: applicationUrl.trim() || null,
        circularUrl: circularUrl.trim() || undefined,
        organizationUrl: organizationUrl.trim() || null,
        credentialId: selectedCredId || null,
        credentialLinkedAt: selectedCredId ? (record.credentialLinkedAt || Date.now()) : undefined,
        updatedAt: Date.now(),
      };

      await ApplicationRepository.upsert(updatedRecord);
      await onSave(updatedRecord);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl shadow-2xl overflow-hidden text-xs flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-petro-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-emerald-300" />
            <div>
              <h3 className="font-bold text-sm">
                {bn ? 'পোর্টাল লিংক ও ক্রেডেনশিয়াল ব্যবস্থাপনা' : 'Portal Links & Credential Management'}
              </h3>
              <p className="text-[11px] text-petro-200">
                {record.organization} — {record.jobTitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Section 1: Distinct URL Architecture */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-1.5">
              <Globe className="w-3.5 h-3.5 text-petro-600" />
              <span>{bn ? '১. আলাদা ইউআরএল রেফারেন্স (Distinct URLs)' : '1. Distinct Job Portal URLs'}</span>
            </h4>

            {/* Login URL */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  {bn ? 'পোর্টালে লগইন লিংক (Login URL) *' : 'Portal Login URL *'}
                </label>
                <div className="flex items-center gap-2">
                  {record.previousLoginUrl !== undefined && record.previousLoginUrl !== null && (
                    <button
                      type="button"
                      onClick={handleUndoLoginUrl}
                      className="text-[11px] font-bold text-petro-600 dark:text-petro-400 hover:underline flex items-center gap-1 cursor-pointer"
                      title={bn ? 'পূর্বে সংরক্ষিত লিংকে ফিরে যান' : 'Revert to previous login URL'}
                    >
                      <Undo2 className="w-3 h-3" />
                      <span>{bn ? 'পূর্বাবস্থায় ফেরত' : 'Undo Edit'}</span>
                    </button>
                  )}
                  {loginUrl && (
                    <button
                      type="button"
                      onClick={() => handleTestOpen(loginUrl)}
                      className="text-[11px] font-bold text-petro-600 dark:text-petro-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>{bn ? 'খুলুন' : 'Open'}</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
              <input
                type="url"
                value={loginUrl}
                onChange={(e) => {
                  setLoginUrl(e.target.value);
                  setErrorMessage('');
                }}
                placeholder="https://bpsc.teletalk.com.bd/login or portal login URL..."
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 font-mono text-slate-800 dark:text-white"
              />
              <p className="text-[10.5px] text-slate-400">
                {bn
                  ? 'নিরাপত্তা নিশ্চিতকরণ: কখনো সার্কুলার পিডিএফ ফাইল বা অস্থায়ী সেশন লিংক এখানে রাখবেন না।'
                  : 'Notice: Never use PDF circular notices as login URLs. Only enter the candidate login page.'}
              </p>
            </div>

            {/* Application URL */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  {bn ? 'সরাসরি আবেদন পেজ (Application URL)' : 'Direct Application URL'}
                </label>
                {applicationUrl && (
                  <button
                    type="button"
                    onClick={() => handleTestOpen(applicationUrl)}
                    className="text-[11px] font-bold text-petro-600 dark:text-petro-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>{bn ? 'খুলুন' : 'Open'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
              <input
                type="url"
                value={applicationUrl}
                onChange={(e) => setApplicationUrl(e.target.value)}
                placeholder="https://..."
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 font-mono text-slate-800 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Circular URL */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    {bn ? 'সার্কুলার নোটিশ / PDF (Circular URL)' : 'Circular Notice / PDF'}
                  </label>
                  {circularUrl && (
                    <button
                      type="button"
                      onClick={() => handleTestOpen(circularUrl)}
                      className="text-[11px] font-bold text-petro-600 dark:text-petro-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>{bn ? 'খুলুন' : 'Open'}</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <input
                  type="url"
                  value={circularUrl}
                  onChange={(e) => setCircularUrl(e.target.value)}
                  placeholder="https://...circular.pdf"
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 font-mono text-slate-800 dark:text-white"
                />
              </div>

              {/* Organization URL */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    {bn ? 'প্রতিষ্ঠানের ওয়েবসাইট (Organization URL)' : 'Organization Website URL'}
                  </label>
                  {organizationUrl && (
                    <button
                      type="button"
                      onClick={() => handleTestOpen(organizationUrl)}
                      className="text-[11px] font-bold text-petro-600 dark:text-petro-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>{bn ? 'খুলুন' : 'Open'}</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <input
                  type="url"
                  value={organizationUrl}
                  onChange={(e) => setOrganizationUrl(e.target.value)}
                  placeholder="https://bpsc.gov.bd"
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 font-mono text-slate-800 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Credential Vault Linking */}
          <div className="space-y-3 pt-2">
            <h4 className="font-bold text-slate-800 dark:text-white flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                <span>{bn ? '২. ক্রেডেনশিয়াল ভল্ট সংযোগ (Credential Vault)' : '2. Credential Vault Link'}</span>
              </div>
              <span className="text-[11px] text-slate-400 font-normal">
                {bn ? 'AES-256-GCM এনক্রিপ্টেড' : 'AES-256-GCM Encrypted'}
              </span>
            </h4>

            {/* Currently Linked Account */}
            {selectedCredId && linkedCredentialSummary ? (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-emerald-900 dark:text-emerald-200">
                      {bn ? 'সংযুক্ত অ্যাকাউন্ট:' : 'Linked Account:'}
                    </span>
                    <span className="font-mono font-semibold text-emerald-800 dark:text-emerald-300">
                      {linkedCredentialSummary.portalName}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400 mt-0.5">
                    {linkedCredentialSummary.accountType || 'General Account'} • Origin: {linkedCredentialSummary.origin}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCredId('')}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-800 cursor-pointer"
                >
                  {bn ? 'সংযোগ বিচ্ছিন্ন করুন' : 'Unlink'}
                </button>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <p className="text-xs">
                  {bn
                    ? 'এই চাকরির জন্য নির্দিষ্ট কোনো ক্রেডেনশিয়াল যুক্ত নেই। নিচের তালিকা থেকে নির্বাচন করুন অথবা নতুন যোগ করুন।'
                    : 'No specific login credential is linked to this job yet. Select an existing account or create a new one.'}
                </p>
              </div>
            )}

            {/* Select existing matching credential */}
            {matchingCreds.length > 0 && (
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  {bn ? 'ভল্ট থেকে অ্যাকাউন্ট নির্বাচন করুন:' : 'Select account from Credential Vault:'}
                </label>
                <select
                  value={selectedCredId}
                  onChange={(e) => setSelectedCredId(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                >
                  <option value="">{bn ? '-- কোনো অ্যাকাউন্ট সংযুক্ত নয় --' : '-- No Account Linked --'}</option>
                  {matchingCreds.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.portalName} — {c.organization || c.jobTitle || c.origin} ({c.accountType || 'Account'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Toggle Add New Credential */}
            {!isAddingNewCred ? (
              <button
                type="button"
                onClick={() => setIsAddingNewCred(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-petro-300 dark:border-petro-700 text-petro-700 dark:text-petro-300 hover:bg-petro-50 dark:hover:bg-petro-950/40 font-bold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{bn ? 'নতুন ক্রেডেনশিয়াল ভল্টে যোগ করুন' : 'Add New Account to Vault'}</span>
              </button>
            ) : (
              <div className="p-3.5 rounded-xl border border-petro-200 dark:border-petro-800 bg-petro-50/50 dark:bg-petro-950/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-petro-900 dark:text-petro-200">
                    {bn ? 'নতুন ভল্ট অ্যাকাউন্ট তৈরি করুন' : 'Create New Vault Account'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddingNewCred(false)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-semibold mb-1">
                      {bn ? 'ইউজার আইডি / Applicant ID *' : 'User ID / Applicant ID *'}
                    </label>
                    <input
                      type="text"
                      value={newUserId}
                      onChange={(e) => setNewUserId(e.target.value)}
                      placeholder="e.g. NIZJARPKQP"
                      className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">
                      {bn ? 'পাসওয়ার্ড *' : 'Password *'}
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter portal password..."
                      className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-semibold mb-1">
                    {bn ? 'অ্যাকাউন্টের ধরন' : 'Account Type'}
                  </label>
                  <select
                    value={newAccountType}
                    onChange={(e) => setNewAccountType(e.target.value)}
                    className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800"
                  >
                    <option value="Job-Specific Account">Job-Specific Account (নির্দিষ্ট চাকরির অ্যাকাউন্ট)</option>
                    <option value="Organization Account">Organization Account (প্রতিষ্ঠানের সাধারণ অ্যাকাউন্ট)</option>
                    <option value="General Portal Account">General Portal Account (সাধারণ পোর্টাল)</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingNewCred(false)}
                    className="px-3 py-1 rounded-lg border border-slate-300 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateAndLinkCredential}
                    className="px-3.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                  >
                    {bn ? 'ভল্টে সংরক্ষণ ও সংযুক্ত' : 'Save & Link to Vault'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            {bn ? '🔒 পাসওয়ার্ড সবসময় এনক্রিপ্ট থাকবে, কখনোই কার্ড বা ইউআরএলে দেখা যাবে না।' : '🔒 Passwords remain encrypted and are never exposed.'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 font-semibold cursor-pointer text-slate-700 dark:text-slate-300"
            >
              {bn ? 'বন্ধ' : 'Close'}
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveModal}
              className="px-4 py-1.5 rounded-lg bg-petro-600 hover:bg-petro-700 text-white font-bold cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (bn ? 'সংরক্ষণ হচ্ছে...' : 'Saving...') : (bn ? 'পরিবর্তন সংরক্ষণ' : 'Save Changes')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
