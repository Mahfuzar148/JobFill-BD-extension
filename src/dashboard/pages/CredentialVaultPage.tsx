import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyRound,
  Lock,
  Unlock,
  Plus,
  Search,
  Eye,
  EyeOff,
  Copy,
  Check,
  Trash2,
  Edit3,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Download,
  Upload,
  AlertTriangle,
  Globe,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  CredentialVaultRepository,
  CredentialVaultStatus,
  DecryptedCredentialEntry,
  EncryptedCredentialBackupBundle,
} from '../../credentials/credential-repository';
import {
  generateStrongPassword,
  evaluatePasswordStrength,
} from '../../credentials/password-generator';
import { normalizeStrictOrigin } from '../../credentials/origin-matcher';

interface CredentialVaultPageProps {
  showToast: (msg: string) => void;
}

interface CredentialFormState {
  id?: string;
  portalName: string;
  portalUrl: string;
  username: string;
  userId: string;
  applicantId: string;
  password: string;
  notes: string;
}

const EMPTY_FORM: CredentialFormState = {
  portalName: '',
  portalUrl: '',
  username: '',
  userId: '',
  applicantId: '',
  password: '',
  notes: '',
};

export const CredentialVaultPage: React.FC<CredentialVaultPageProps> = ({ showToast }) => {
  const { language } = useApp();
  const bn = language === 'bn';

  const [status, setStatus] = useState<CredentialVaultStatus>({
    initialized: false,
    unlocked: false,
    autoLockMinutes: 10,
    recordCount: 0,
    expiresAt: null,
  });
  const [entries, setEntries] = useState<DecryptedCredentialEntry[]>([]);
  const [masterPassInput, setMasterPassInput] = useState('');
  const [masterPassConfirm, setMasterPassConfirm] = useState('');
  const [initLossAck, setInitLossAck] = useState(false);
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [portalFilter, setPortalFilter] = useState('All');
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formState, setFormState] = useState<CredentialFormState>(EMPTY_FORM);
  const [formShowPassword, setFormShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<DecryptedCredentialEntry | null>(null);
  const [backupModalMode, setBackupModalMode] = useState<'export' | 'restore' | null>(null);
  const [backupPassphrase, setBackupPassphrase] = useState('');
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [backupError, setBackupError] = useState('');
  const restoreInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingRestoreBundle, setPendingRestoreBundle] =
    useState<EncryptedCredentialBackupBundle | null>(null);

  const clearInMemorySecrets = useCallback(() => {
    setEntries([]);
    setRevealedIds({});
    setFormState(EMPTY_FORM);
    setFormOpen(false);
    setDeleteTarget(null);
  }, []);

  const refreshVaultState = useCallback(async () => {
    setLoading(true);
    try {
      const st = await CredentialVaultRepository.getStatus();
      setStatus(st);
      if (st.unlocked) {
        const list = await CredentialVaultRepository.listDecryptedCredentials();
        setEntries(list);
      } else {
        clearInMemorySecrets();
      }
    } finally {
      setLoading(false);
    }
  }, [clearInMemorySecrets]);

  useEffect(() => {
    void refreshVaultState();
  }, [refreshVaultState]);

  // Periodically check session timeout so decrypted secrets never linger in UI state
  useEffect(() => {
    if (!status.unlocked) return;
    const timer = window.setInterval(async () => {
      const st = await CredentialVaultRepository.getStatus();
      if (!st.unlocked) {
        setStatus(st);
        clearInMemorySecrets();
        showToast(bn ? '🔒 নিষ্ক্রিয়তার কারণে ক্রেডেনশিয়াল ভল্ট স্বয়ংক্রিয়ভাবে লক হয়েছে' : '🔒 Credential Vault auto-locked due to inactivity.');
      }
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [status.unlocked, bn, clearInMemorySecrets, showToast]);

  const handleInitializeVault = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!initLossAck) {
      setAuthError(
        bn
          ? 'অনুগ্রহ করে মাস্টার পাসওয়ার্ড পুনরুদ্ধার সীমাবদ্ধতা স্বীকার করুন।'
          : 'Please acknowledge that a lost Master Password cannot be recovered automatically.'
      );
      return;
    }
    if (masterPassInput.length < 8) {
      setAuthError(
        bn ? 'মাস্টার পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।' : 'Master password must be at least 8 characters.'
      );
      return;
    }
    if (masterPassInput !== masterPassConfirm) {
      setAuthError(bn ? 'পাসওয়ার্ড দুটি মিলছে না।' : 'Passwords do not match.');
      return;
    }
    try {
      await CredentialVaultRepository.initializeVault(masterPassInput, 10);
      setMasterPassInput('');
      setMasterPassConfirm('');
      await refreshVaultState();
      showToast(bn ? '🔐 ক্রেডেনশিয়াল ভল্ট এনক্রিপশন চালু হয়েছে' : '🔐 Credential Vault initialized locally');
    } catch (err: any) {
      setAuthError(err?.message || 'Vault initialization failed.');
    }
  };

  const handleUnlockVault = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const ok = await CredentialVaultRepository.unlockVault(masterPassInput);
    setMasterPassInput('');
    if (!ok) {
      setAuthError(bn ? 'ভুল মাস্টার পাসওয়ার্ড অথবা ভল্ট যাচাই ব্যর্থ হয়েছে।' : 'Incorrect master password or corrupted vault verifier.');
      return;
    }
    await refreshVaultState();
    showToast(bn ? '🔓 ক্রেডেনশিয়াল ভল্ট আনলক হয়েছে' : '🔓 Credential Vault unlocked');
  };

  const handleLockNow = async () => {
    CredentialVaultRepository.lockVault();
    clearInMemorySecrets();
    const st = await CredentialVaultRepository.getStatus();
    setStatus(st);
    showToast(bn ? '🔒 ক্রেডেনশিয়াল ভল্ট লক করা হয়েছে' : '🔒 Credential Vault locked and in-memory secrets cleared');
  };

  const handleCopy = async (keyId: string, value: string, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard?.writeText(value);
      setCopiedKey(keyId);
      CredentialVaultRepository.touchSession();
      showToast(bn ? `📋 ${label} কপি হয়েছে` : `📋 ${label} copied to clipboard`);
      window.setTimeout(() => setCopiedKey((prev) => (prev === keyId ? null : prev)), 2000);
    } catch {
      showToast(bn ? 'ক্লিপবোর্ডে কপি করা যায়নি' : 'Clipboard copy unavailable');
    }
  };

  const handleOpenAdd = () => {
    setFormState(EMPTY_FORM);
    setFormShowPassword(false);
    setFormError('');
    setFormOpen(true);
  };

  const handleOpenEdit = (entry: DecryptedCredentialEntry) => {
    setFormState({
      id: entry.id,
      portalName: entry.portalName,
      portalUrl: entry.portalUrl,
      username: entry.username,
      userId: entry.userId,
      applicantId: entry.applicantId,
      password: entry.password,
      notes: entry.notes,
    });
    setFormShowPassword(false);
    setFormError('');
    setFormOpen(true);
  };

  const handleSaveCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await CredentialVaultRepository.saveCredential(formState);
      setFormOpen(false);
      setFormState(EMPTY_FORM);
      await refreshVaultState();
      showToast(bn ? '✅ লগইন তথ্য এনক্রিপ্ট করে সংরক্ষিত হয়েছে' : '✅ Credential saved inside AES-256-GCM Vault');
    } catch (err: any) {
      setFormError(err?.message || 'Could not save credential.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    await CredentialVaultRepository.deleteCredential(deleteTarget.id);
    setDeleteTarget(null);
    await refreshVaultState();
    showToast(bn ? '🗑️ লগইন তথ্য ভল্ট থেকে মুছে ফেলা হয়েছে' : '🗑️ Credential deleted cleanly');
  };

  const handleExportBackup = async () => {
    setBackupError('');
    try {
      const bundle = await CredentialVaultRepository.exportEncryptedBackup(backupPassphrase, backupConfirmed);
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jobfill-credential-vault-encrypted-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupModalMode(null);
      setBackupPassphrase('');
      setBackupConfirmed(false);
      showToast(bn ? '🔐 এনক্রিপ্টেড ব্যাকআপ ডাউনলোড হয়েছে' : '🔐 Encrypted credential backup downloaded');
    } catch (err: any) {
      setBackupError(err?.message || 'Backup failed.');
    }
  };

  const handleSelectRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as EncryptedCredentialBackupBundle;
      setPendingRestoreBundle(parsed);
      setBackupPassphrase('');
      setBackupError('');
      setBackupModalMode('restore');
    } catch {
      showToast(bn ? '⚠️ ব্যাকআপ JSON ফাইল পড়া যায়নি' : '⚠️ Invalid encrypted backup file');
    }
  };

  const handleConfirmRestore = async () => {
    if (!pendingRestoreBundle) return;
    setBackupError('');
    try {
      const count = await CredentialVaultRepository.restoreEncryptedBackup(pendingRestoreBundle, backupPassphrase);
      setBackupModalMode(null);
      setPendingRestoreBundle(null);
      setBackupPassphrase('');
      await refreshVaultState();
      showToast(bn ? `✅ ${count}টি এনক্রিপ্টেড ক্রেডেনশিয়াল পুনরুদ্ধার হয়েছে` : `✅ Restored ${count} encrypted credentials`);
    } catch (err: any) {
      setBackupError(err?.message || 'Incorrect backup passphrase or corrupted bundle.');
    }
  };

  const portalNames = useMemo(
    () => Array.from(new Set(entries.map((e) => e.portalName))).sort(),
    [entries]
  );

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return entries.filter((item) => {
      if (portalFilter !== 'All' && item.portalName !== portalFilter) return false;
      if (!q) return true;
      return (
        item.portalName.toLowerCase().includes(q) ||
        item.origin.toLowerCase().includes(q) ||
        item.username.toLowerCase().includes(q) ||
        item.userId.toLowerCase().includes(q) ||
        item.applicantId.toLowerCase().includes(q)
      );
    });
  }, [entries, portalFilter, searchQuery]);

  const strength = useMemo(() => evaluatePasswordStrength(formState.password), [formState.password]);
  const derivedOriginPreview = useMemo(() => normalizeStrictOrigin(formState.portalUrl), [formState.portalUrl]);

  if (loading && !status.initialized && entries.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        {bn ? 'ক্রেডেনশিয়াল ভল্ট পরীক্ষা করা হচ্ছে...' : 'Checking Local Credential Vault...'}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-petro-600" />
            <span>{bn ? 'লোকাল ক্রেডেনশিয়াল ভল্ট (Credential Vault)' : 'Local Credential Vault'}</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {bn
              ? 'চাকরির পোর্টালের ইউজারনেম, User ID ও পাসওয়ার্ড কেবল আপনার ডিভাইসে AES-256-GCM এনক্রিপশনে নিরাপদ থাকে — কখনো Cloud Sync-এ পাঠানো হয় না।'
              : 'Save portal logins locally encrypted with Web Crypto AES-256-GCM & PBKDF2-SHA256. Strictly Local-Only — never synced to Cloud Sync.'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <ShieldCheck className="w-3.5 h-3.5" />
            Local-Only • Exact HTTPS Origin
          </span>
          {status.unlocked && (
            <button
              type="button"
              onClick={handleLockNow}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{bn ? 'ভল্ট লক' : 'Lock Vault'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Vault Setup State */}
      {!status.initialized && (
        <form
          onSubmit={handleInitializeVault}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-xl mx-auto space-y-4 shadow-sm"
        >
          <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-xs text-amber-900 dark:text-amber-200">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold">
                {bn ? 'মাস্টার পাসওয়ার্ড সতর্কতা (অত্যন্ত গুরুত্বপূর্ণ)' : 'Important Master Password Recovery Notice'}
              </div>
              <p className="leading-relaxed opacity-90">
                {bn
                  ? 'আপনার মাস্টার পাসওয়ার্ড কোনো সার্ভারে সংরক্ষিত থাকে না। পাসওয়ার্ড ভুলে গেলে সংরক্ষিত পাসওয়ার্ডগুলো স্বয়ংক্রিয়ভাবে পুনরুদ্ধার করা সম্ভব হবে না।'
                  : 'Your Master Password is never stored on disk or sent to any server. If forgotten, saved credentials cannot be recovered automatically — always keep encrypted backups safely.'}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {bn ? 'ক্রেডেনশিয়াল ভল্ট মাস্টার পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)' : 'Master Password (min 8 characters)'}
            </label>
            <input
              type="password"
              value={masterPassInput}
              onChange={(e) => setMasterPassInput(e.target.value)}
              placeholder="••••••••••••"
              className="w-full text-sm border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {bn ? 'পাসওয়ার্ড নিশ্চিত করুন' : 'Confirm Master Password'}
            </label>
            <input
              type="password"
              value={masterPassConfirm}
              onChange={(e) => setMasterPassConfirm(e.target.value)}
              placeholder="••••••••••••"
              className="w-full text-sm border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <label className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={initLossAck}
              onChange={(e) => setInitLossAck(e.target.checked)}
              className="mt-0.5 accent-petro-600"
            />
            <span>
              {bn
                ? 'আমি বুঝেছি যে মাস্টার পাসওয়ার্ড হারালে ভল্টের তথ্য পুনরুদ্ধার করা যাবে না এবং আমি পাসওয়ার্ডটি নিরাপদে সংরক্ষণ করব।'
                : 'I understand a lost Master Password cannot be recovered and I am responsible for keeping it safe.'}
            </span>
          </label>

          {authError && <div className="text-xs font-semibold text-rose-600">{authError}</div>}

          <button
            type="submit"
            className="w-full bg-petro-600 hover:bg-petro-700 text-white font-bold py-2.5 rounded-xl text-xs shadow cursor-pointer"
          >
            {bn ? '🔐 লোকাল ক্রেডেনশিয়াল ভল্ট তৈরি করুন' : '🔐 Initialize Local Credential Vault'}
          </button>
        </form>
      )}

      {/* Vault Locked Screen */}
      {status.initialized && !status.unlocked && (
        <form
          onSubmit={handleUnlockVault}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-md mx-auto text-center space-y-4 shadow-sm"
        >
          <div className="w-12 h-12 rounded-full bg-petro-100 dark:bg-petro-950 text-petro-700 dark:text-petro-300 mx-auto flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-800 dark:text-white">
              {bn ? 'ক্রেডেনশিয়াল ভল্ট লক করা আছে' : 'Credential Vault Locked'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {bn
                ? `${status.recordCount}টি পোর্টাল লগইন এনক্রিপ্টেড অবস্থায় সংরক্ষিত আছে। আনলক করতে মাস্টার পাসওয়ার্ড দিন।`
                : `${status.recordCount} portal credential(s) locally encrypted. Enter Master Password to unlock.`}
            </p>
          </div>
          <input
            type="password"
            value={masterPassInput}
            onChange={(e) => setMasterPassInput(e.target.value)}
            placeholder={bn ? 'মাস্টার পাসওয়ার্ড লিখুন' : 'Enter Master Password'}
            className="w-full text-center text-sm border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            autoFocus
          />
          {authError && <div className="text-xs font-semibold text-rose-600">{authError}</div>}
          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-1.5 bg-petro-600 hover:bg-petro-700 text-white font-bold py-2.5 rounded-xl text-xs shadow cursor-pointer"
          >
            <Unlock className="w-3.5 h-3.5" />
            <span>{bn ? 'ভল্ট আনলক করুন' : 'Unlock Credential Vault'}</span>
          </button>
        </form>
      )}

      {/* Unlocked Workspace */}
      {status.initialized && status.unlocked && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex flex-1 items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={bn ? 'পোর্টাল, ইউজারনেম বা User ID খুঁজুন...' : 'Search portals, username, user ID...'}
                  className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white"
                />
              </div>

              <select
                value={portalFilter}
                onChange={(e) => setPortalFilter(e.target.value)}
                className="text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                <option value="All">{bn ? `সব পোর্টাল (${entries.length})` : `All Portals (${entries.length})`}</option>
                {portalNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>

              <select
                value={status.autoLockMinutes}
                onChange={async (e) => {
                  const mins = Number(e.target.value);
                  await CredentialVaultRepository.setAutoLockMinutes(mins);
                  await refreshVaultState();
                  showToast(bn ? `⏱️ অটো-লক ${mins} মিনিটে সেট হয়েছে` : `⏱️ Auto-lock set to ${mins} min`);
                }}
                title="Auto-Lock Timeout"
                className="text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                <option value={5}>Auto-Lock: 5m</option>
                <option value={10}>Auto-Lock: 10m</option>
                <option value={15}>Auto-Lock: 15m</option>
                <option value={30}>Auto-Lock: 30m</option>
              </select>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <input
                ref={restoreInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleSelectRestoreFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => {
                  setBackupError('');
                  setBackupPassphrase('');
                  setBackupConfirmed(false);
                  setBackupModalMode('export');
                }}
                disabled={entries.length === 0}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{bn ? 'ব্যাকআপ' : 'Encrypted Backup'}</span>
              </button>
              <button
                type="button"
                onClick={() => restoreInputRef.current?.click()}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{bn ? 'রিস্টোর' : 'Restore'}</span>
              </button>
              <button
                type="button"
                onClick={handleOpenAdd}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-petro-600 hover:bg-petro-700 text-white shadow cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{bn ? 'নতুন লগইন যোগ' : 'Add Credential'}</span>
              </button>
            </div>
          </div>

          {/* Empty State or Cards */}
          {filteredEntries.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center space-y-2">
              <KeyRound className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {bn ? 'কোনো পোর্টাল ক্রেডেনশিয়াল সংরক্ষিত নেই' : 'No saved portal credentials yet'}
              </div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {bn
                  ? '"Add Credential" ব্যবহার করে আপনার টেলিটক, বিপিএসসি বা ব্যাংক পোর্টালের লগইন তথ্য লোকাল ভল্টে যোগ করুন।'
                  : 'Use "Add Credential" to save your Teletalk, BPSC, or bank portal logins in local encrypted storage.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredEntries.map((item) => {
                const isRevealed = Boolean(revealedIds[item.id]);
                const identifier = item.username || item.userId || item.applicantId;
                return (
                  <div
                    key={item.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-extrabold text-slate-800 dark:text-white truncate">
                          {item.portalName}
                        </h3>
                        <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono flex items-center gap-1 truncate mt-0.5">
                          <Globe className="w-3 h-3 shrink-0" />
                          <span className="truncate">{item.origin}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          title={bn ? 'সম্পাদনা' : 'Edit'}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(item)}
                          title={bn ? 'মুছুন' : 'Delete'}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500">{bn ? 'ইউজারনেম / আইডি:' : 'Username / ID:'}</span>
                        <div className="flex items-center gap-1.5 font-mono font-bold text-slate-800 dark:text-slate-100 truncate">
                          <span className="truncate">{identifier}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(`u_${item.id}`, identifier, 'Username/ID')}
                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                            title="Copy Username"
                          >
                            {copiedKey === `u_${item.id}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                          </button>
                        </div>
                      </div>

                      {item.userId && item.userId !== identifier && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-500">User ID:</span>
                          <span className="font-mono text-slate-700 dark:text-slate-200">{item.userId}</span>
                        </div>
                      )}

                      {item.applicantId && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-500">Applicant ID:</span>
                          <span className="font-mono text-slate-700 dark:text-slate-200">{item.applicantId}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/70 dark:border-slate-700/70">
                        <span className="text-slate-500">{bn ? 'পাসওয়ার্ড:' : 'Password:'}</span>
                        <div className="flex items-center gap-1 font-mono">
                          <span className="font-bold text-slate-800 dark:text-slate-100">
                            {isRevealed ? item.password : '••••••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              CredentialVaultRepository.touchSession();
                              setRevealedIds((prev) => ({ ...prev, [item.id]: !prev[item.id] }));
                            }}
                            title={isRevealed ? 'Hide Password' : 'Show Password'}
                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                          >
                            {isRevealed ? <EyeOff className="w-3.5 h-3.5 text-amber-600" /> : <Eye className="w-3.5 h-3.5 text-slate-500" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopy(`p_${item.id}`, item.password, 'Password')}
                            title="Copy Password"
                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                          >
                            {copiedKey === `p_${item.id}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {item.notes && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        📝 {item.notes}
                      </div>
                    )}

                    <div className="text-[10px] text-slate-400 flex justify-between">
                      <span>Created: {new Date(item.createdAt).toLocaleDateString()}</span>
                      <span>Updated: {new Date(item.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Modal */}
      {formOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveCredential}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg shadow-2xl overflow-hidden text-xs"
          >
            <div className="px-5 py-3.5 bg-petro-700 text-white flex items-center justify-between">
              <span className="font-bold text-sm">
                {formState.id
                  ? bn ? 'ক্রেডেনশিয়াল সম্পাদনা করুন' : 'Edit Portal Credential'
                  : bn ? 'নতুন পোর্টাল ক্রেডেনশিয়াল' : 'Add Portal Credential'}
              </span>
              <button type="button" onClick={() => setFormOpen(false)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Portal Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BPSC / Teletalk Alljobs"
                    value={formState.portalName}
                    onChange={(e) => setFormState({ ...formState, portalName: e.target.value })}
                    className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Portal HTTPS Website *</label>
                  <input
                    type="text"
                    required
                    placeholder="https://bpsc.teletalk.com.bd"
                    value={formState.portalUrl}
                    onChange={(e) => setFormState({ ...formState, portalUrl: e.target.value })}
                    className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="text-[11px] bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                Strict Bound Origin:{' '}
                {derivedOriginPreview ? (
                  <strong className="font-mono text-emerald-700 dark:text-emerald-400">{derivedOriginPreview}</strong>
                ) : (
                  <span className="text-rose-600 font-semibold">Requires valid HTTPS origin (HTTP blocked)</span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Username / Email</label>
                  <input
                    type="text"
                    value={formState.username}
                    onChange={(e) => setFormState({ ...formState, username: e.target.value })}
                    className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">User ID</label>
                  <input
                    type="text"
                    value={formState.userId}
                    onChange={(e) => setFormState({ ...formState, userId: e.target.value })}
                    className="w-full font-mono border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Applicant ID</label>
                  <input
                    type="text"
                    value={formState.applicantId}
                    onChange={(e) => setFormState({ ...formState, applicantId: e.target.value })}
                    className="w-full font-mono border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold">Password *</label>
                  <button
                    type="button"
                    onClick={() => {
                      const pwd = generateStrongPassword({ length: 16 });
                      setFormState({ ...formState, password: pwd });
                      setFormShowPassword(true);
                    }}
                    className="inline-flex items-center gap-1 font-bold text-petro-600 hover:underline cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Generate Strong Password
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={formShowPassword ? 'text' : 'password'}
                    required
                    value={formState.password}
                    onChange={(e) => setFormState({ ...formState, password: e.target.value })}
                    className="w-full font-mono border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 pr-9 bg-white dark:bg-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => setFormShowPassword((v) => !v)}
                    className="absolute right-2.5 top-2 text-slate-400 cursor-pointer"
                  >
                    {formShowPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {formState.password && (
                  <div className="mt-1.5 flex items-center justify-between text-[10.5px]">
                    <span className="font-bold text-slate-600 dark:text-slate-300">
                      Strength: {bn ? strength.labelBn : strength.label} ({strength.entropyBits} bits)
                    </span>
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map((step) => (
                        <span
                          key={step}
                          className={`w-6 h-1.5 rounded-full ${
                            step < strength.score
                              ? strength.score >= 3
                                ? 'bg-emerald-500'
                                : 'bg-amber-500'
                              : 'bg-slate-200 dark:bg-slate-700'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold mb-1">Optional Notes</label>
                <textarea
                  rows={2}
                  value={formState.notes}
                  onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
                  placeholder="Security question hint, recovery note..."
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800"
                />
              </div>

              {formError && (
                <div className="text-rose-600 font-semibold flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}
            </div>

            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 rounded-lg bg-petro-600 hover:bg-petro-700 text-white font-bold cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Encrypting...' : 'Save Encrypted'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Explicit Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 max-w-sm w-full space-y-4 text-xs shadow-2xl">
            <h3 className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>{bn ? 'ক্রেডেনশিয়াল মুছে ফেলবেন?' : 'Delete Credential?'}</span>
            </h3>
            <p className="text-slate-600 dark:text-slate-300">
              Permanently delete credentials for <strong>{deleteTarget.portalName}</strong> ({deleteTarget.origin})?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Encrypted Backup Export / Restore Modal */}
      {backupModalMode && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 max-w-md w-full space-y-3 text-xs shadow-2xl">
            <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">
              {backupModalMode === 'export'
                ? 'Export AES-256-GCM Encrypted Credential Backup'
                : 'Restore Encrypted Credential Backup'}
            </h3>
            <p className="text-slate-500">
              {backupModalMode === 'export'
                ? 'Backups are always encrypted with a random salt + IV using your chosen backup passphrase. Plaintext exports are never permitted.'
                : 'Enter the backup passphrase used when generating this backup bundle.'}
            </p>
            <input
              type="password"
              value={backupPassphrase}
              onChange={(e) => setBackupPassphrase(e.target.value)}
              placeholder="Backup Passphrase (min 8 chars)"
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800"
            />
            {backupModalMode === 'export' && (
              <label className="flex items-start gap-2 cursor-pointer text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={backupConfirmed}
                  onChange={(e) => setBackupConfirmed(e.target.checked)}
                  className="mt-0.5 accent-petro-600"
                />
                <span>I confirm exporting an encrypted backup file to my local device.</span>
              </label>
            )}
            {backupError && <div className="text-rose-600 font-semibold">{backupError}</div>}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setBackupModalMode(null);
                  setPendingRestoreBundle(null);
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={backupModalMode === 'export' ? handleExportBackup : handleConfirmRestore}
                className="px-4 py-1.5 rounded-lg bg-petro-600 hover:bg-petro-700 text-white font-bold cursor-pointer"
              >
                {backupModalMode === 'export' ? 'Export Encrypted File' : 'Decrypt & Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
