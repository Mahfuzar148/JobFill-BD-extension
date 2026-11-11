import React, { useState, useEffect } from 'react';
import {
  Shield,
  Lock,
  Unlock,
  Download,
  Upload,
  Trash2,
  Key,
  AlertTriangle,
  CheckCircle,
  Cloud,
  CloudOff,
  HardDrive,
  RefreshCw,
  Info,
  ExternalLink,
} from 'lucide-react';
import {
  getSecuritySettings,
  saveSecuritySettings,
  enableVaultEncryption,
  changeVaultPassword,
  disableVaultEncryption,
  exportProfileData,
  importProfileData,
  deleteLocalUserData,
  purgeAllData,
  getVaultDashboardMetrics,
} from '../../services/storage';
import { MappingRepository } from '../../database/mapping-repository';
import { MigrationManager, MigrationReport } from '../../database/migration-manager';
import {
  CloudSyncConfig,
  DEFAULT_CLOUD_CONFIG,
  getCloudConfig,
  saveCloudConfig,
  isCloudBackendConfigured,
  isCloudSyncFeatureEnabled,
} from '../../cloud/supabase-config';
import {
  getActiveCloudSession,
  signInCloudAccount,
  signUpCloudAccount,
  signOutCloudAccount,
} from '../../cloud/supabase-auth';
import {
  CloudSyncMergeStrategy,
  CloudSyncPreviewResult,
  uploadEncryptedVaultToCloud,
  previewCloudVaultPull,
  pullAndDecryptVaultFromCloud,
  deleteAllPrivateCloudData,
} from '../../cloud/encrypted-sync-service';

interface SecurityPageProps {
  showToast: (msg: string) => void;
  onDataReset: () => void;
  onLockVault?: () => void;
  onProtectionChanged?: (isProtectedNow: boolean) => void;
}

function formatStorageBytes(bytes: number | null): string {
  if (bytes === null || Number.isNaN(bytes)) return 'Local IndexedDB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const SecurityPage: React.FC<SecurityPageProps> = ({
  showToast,
  onDataReset,
  onLockVault,
  onProtectionChanged,
}) => {
  const [isProtected, setIsProtected] = useState(false);
  const [autoLockMinutes, setAutoLockMinutes] = useState(15);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');

  // Change Password
  const [changeOldPassword, setChangeOldPassword] = useState('');
  const [changeNewPassword, setChangeNewPassword] = useState('');
  const [changeConfirmPassword, setChangeConfirmPassword] = useState('');

  // Backup / Restore
  const [exportPassword, setExportPassword] = useState('');
  const [exportEncrypted, setExportEncrypted] = useState(false);
  const [importPassword, setImportPassword] = useState('');

  // Vault Dashboard Metrics & Migration Report
  const [metrics, setMetrics] = useState<{
    isPasswordProtected: boolean;
    isLocked: boolean;
    encryptionAlgorithm: string;
    lastBackupAt: number | null;
    storageUsageBytes: number | null;
  }>({
    isPasswordProtected: false,
    isLocked: false,
    encryptionAlgorithm: 'AES-256-GCM (Non-Extractable Device Key)',
    lastBackupAt: null,
    storageUsageBytes: null,
  });
  const [migrationReport, setMigrationReport] = useState<MigrationReport | null>(null);

  // Optional Cloud Sync State (Disabled / Local-Only by default)
  const [cloudCfg, setCloudCfg] = useState<CloudSyncConfig>(DEFAULT_CLOUD_CONFIG);
  const [cloudEmail, setCloudEmail] = useState('');
  const [cloudAuthPassword, setCloudAuthPassword] = useState('');
  const [syncPassphrase, setSyncPassphrase] = useState('');
  const [cloudBusy, setCloudBusy] = useState(false);
  const [isCloudLoggedIn, setIsCloudLoggedIn] = useState(false);
  const [cloudRestorePreview, setCloudRestorePreview] = useState<CloudSyncPreviewResult | null>(null);

  useEffect(() => {
    void loadSettings();
  }, []);

  const loadSettings = async () => {
    const cloudEnabled =
      !(typeof __JOBFILL_CLOUD_SYNC_DISABLED__ !== 'undefined' && __JOBFILL_CLOUD_SYNC_DISABLED__) &&
      isCloudSyncFeatureEnabled();
    const [s, m, mig, cfg] = await Promise.all([
      getSecuritySettings(),
      getVaultDashboardMetrics(),
      MigrationManager.getLatestReport(),
      cloudEnabled ? getCloudConfig() : Promise.resolve(DEFAULT_CLOUD_CONFIG),
    ]);
    setIsProtected(s.isPasswordProtected);
    setAutoLockMinutes(s.autoLockMinutes || 15);
    setMetrics(m);
    setMigrationReport(mig);
    setCloudCfg(cfg);
    setCloudEmail(cloudEnabled ? cfg.authenticatedEmail || '' : '');
    setIsCloudLoggedIn(cloudEnabled ? Boolean(getActiveCloudSession()) : false);
  };

  const handleEnablePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      alert('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে!');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('পাসওয়ার্ড কনফার্মেশন মিলেনি!');
      return;
    }

    try {
      await enableVaultEncryption(newPassword);
      setIsProtected(true);
      onProtectionChanged?.(true);
      setNewPassword('');
      setConfirmPassword('');
      await loadSettings();
      showToast('🔒 মাস্টার পাসওয়ার্ড সফলভাবে সেট হয়েছে!');
    } catch (e: any) {
      alert('পাসওয়ার্ড সেট করতে ত্রুটি: ' + e.message);
    }
  };

  const handleChangePassword = async () => {
    if (!changeOldPassword) {
      alert('বর্তমান পাসওয়ার্ড দিন!');
      return;
    }
    if (!changeNewPassword || changeNewPassword.length < 6) {
      alert('নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে!');
      return;
    }
    if (changeNewPassword !== changeConfirmPassword) {
      alert('নতুন পাসওয়ার্ড কনফার্মেশন মিলেনি!');
      return;
    }

    try {
      await changeVaultPassword(changeOldPassword, changeNewPassword);
      setChangeOldPassword('');
      setChangeNewPassword('');
      setChangeConfirmPassword('');
      await loadSettings();
      showToast('🔑 ভল্ট পাসওয়ার্ড সফলভাবে পরিবর্তন ও পুনঃ-এনক্রিপ্ট হয়েছে!');
    } catch (e: any) {
      alert('পাসওয়ার্ড পরিবর্তন ব্যর্থ হয়েছে: ' + e.message);
    }
  };

  const handleDisablePassword = async () => {
    if (!currentPassword) {
      alert('বর্তমান পাসওয়ার্ড দিন!');
      return;
    }
    try {
      await disableVaultEncryption(currentPassword);
      setIsProtected(false);
      onProtectionChanged?.(false);
      setCurrentPassword('');
      await loadSettings();
      showToast('🔓 পাসওয়ার্ড সুরক্ষা বন্ধ করা হয়েছে!');
    } catch (e: any) {
      alert('পাসওয়ার্ড ভুল হয়েছে: ' + e.message);
    }
  };

  const handleAutoLockChange = async (minutes: number) => {
    setAutoLockMinutes(minutes);
    const s = await getSecuritySettings();
    s.autoLockMinutes = minutes;
    await saveSecuritySettings(s);
    showToast(`অটো-লক সময় ${minutes} মিনিটে সেট হয়েছে!`);
  };

  const handleExport = async () => {
    try {
      const dataStr = await exportProfileData(exportEncrypted, exportPassword);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `JobFill_BD_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      await loadSettings();
      showToast('📥 ব্যাকআপ ফাইল ডাউনলোড হয়েছে!');
    } catch (e: any) {
      alert('এক্সপোর্ট করতে ত্রুটি: ' + e.message);
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const content = evt.target?.result as string;
        const count = await importProfileData(content, importPassword);
        showToast(`✅ ${count}টি প্রোফাইল সফলভাবে ইমপোর্ট হয়েছে!`);
        onDataReset();
        await loadSettings();
      } catch (err: any) {
        if (err.message === 'PASSWORD_REQUIRED') {
          alert('এই ফাইলটি এনক্রিপ্ট করা! নিচের ইনপুটে পাসওয়ার্ড দিয়ে আবার চেষ্টা করুন।');
        } else {
          alert('ইমপোর্ট ব্যর্থ হয়েছে: ' + err.message);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleToggleCloudSync = async (enable: boolean) => {
    if ((typeof __JOBFILL_CLOUD_SYNC_DISABLED__ !== 'undefined' && __JOBFILL_CLOUD_SYNC_DISABLED__) || !isCloudSyncFeatureEnabled()) return;
    try {
      const next = await saveCloudConfig({
        cloudSyncEnabled: enable,
        supabaseUrl: cloudCfg.supabaseUrl,
        supabaseAnonKey: cloudCfg.supabaseAnonKey,
        usePublicCloudJobsFeed: cloudCfg.usePublicCloudJobsFeed,
      });
      setCloudCfg(next);
      showToast(enable ? '☁️ Optional Encrypted Cloud Sync enabled' : '🔒 Switched to Local-Only mode');
    } catch (err: any) {
      alert(err?.message || 'Could not update Cloud Sync setting.');
    }
  };

  const handleSaveCloudBackend = async () => {
    if ((typeof __JOBFILL_CLOUD_SYNC_DISABLED__ !== 'undefined' && __JOBFILL_CLOUD_SYNC_DISABLED__) || !isCloudSyncFeatureEnabled()) return;
    try {
      const next = await saveCloudConfig({
        supabaseUrl: cloudCfg.supabaseUrl,
        supabaseAnonKey: cloudCfg.supabaseAnonKey,
        usePublicCloudJobsFeed: cloudCfg.usePublicCloudJobsFeed,
      });
      setCloudCfg(next);
      showToast('✅ Cloud endpoint settings saved locally (public anon key only).');
    } catch (err: any) {
      alert(err?.message || 'Invalid Supabase configuration');
    }
  };

  const handleCloudAuth = async (mode: 'signin' | 'signup') => {
    if ((typeof __JOBFILL_CLOUD_SYNC_DISABLED__ !== 'undefined' && __JOBFILL_CLOUD_SYNC_DISABLED__) || !isCloudSyncFeatureEnabled()) return;
    if (!cloudEmail || !cloudAuthPassword) {
      alert('Enter Cloud account email and password.');
      return;
    }
    setCloudBusy(true);
    try {
      if (mode === 'signup') {
        await signUpCloudAccount(cloudEmail, cloudAuthPassword);
      } else {
        await signInCloudAccount(cloudEmail, cloudAuthPassword);
      }
      setCloudAuthPassword('');
      setIsCloudLoggedIn(true);
      await loadSettings();
      showToast('✅ Signed in to Cloud Sync account.');
    } catch (err: any) {
      alert(err?.message || 'Authentication failed');
    } finally {
      setCloudBusy(false);
    }
  };

  const handleCloudLogout = async () => {
    setCloudBusy(true);
    try {
      await signOutCloudAccount(true);
      setIsCloudLoggedIn(false);
      await loadSettings();
      onDataReset();
      showToast('🔓 Logged out & local vault session cleared.');
    } finally {
      setCloudBusy(false);
    }
  };

  const handleCloudPush = async () => {
    if ((typeof __JOBFILL_CLOUD_SYNC_DISABLED__ !== 'undefined' && __JOBFILL_CLOUD_SYNC_DISABLED__) || !isCloudSyncFeatureEnabled()) return;
    setCloudBusy(true);
    try {
      await uploadEncryptedVaultToCloud(syncPassphrase);
      await loadSettings();
      showToast('☁️ Encrypted E2EE vault uploaded cleanly.');
    } catch (err: any) {
      alert(err?.message || 'Cloud upload failed');
    } finally {
      setCloudBusy(false);
    }
  };

  const applyCloudPullWithStrategy = async (strategy: CloudSyncMergeStrategy) => {
    setCloudBusy(true);
    try {
      const res = await pullAndDecryptVaultFromCloud(syncPassphrase, { strategy });
      setCloudRestorePreview(null);
      await loadSettings();
      onDataReset();
      showToast(
        `☁️ Decrypted & restored ${res.profilesRestored} profile(s) (${strategy === 'replace' ? 'Replaced local' : 'Merged with local'})!`
      );
    } catch (err: any) {
      alert(err?.message || 'Cloud restore failed');
    } finally {
      setCloudBusy(false);
    }
  };

  const handleCloudPull = async () => {
    if ((typeof __JOBFILL_CLOUD_SYNC_DISABLED__ !== 'undefined' && __JOBFILL_CLOUD_SYNC_DISABLED__) || !isCloudSyncFeatureEnabled()) return;
    setCloudBusy(true);
    try {
      const preview = await previewCloudVaultPull(syncPassphrase);
      if (preview.hasLocalConflicts) {
        setCloudRestorePreview(preview);
        setCloudBusy(false);
        return;
      }
      await applyCloudPullWithStrategy('merge');
    } catch (err: any) {
      alert(err?.message || 'Cloud restore failed');
      setCloudBusy(false);
    }
  };

  const handleDeleteCloudData = async () => {
    if ((typeof __JOBFILL_CLOUD_SYNC_DISABLED__ !== 'undefined' && __JOBFILL_CLOUD_SYNC_DISABLED__) || !isCloudSyncFeatureEnabled()) return;
    const ok = confirm('⚠️ Permanently delete all your encrypted vault data from Cloud storage?');
    if (!ok) return;
    setCloudBusy(true);
    try {
      await deleteAllPrivateCloudData();
      setIsCloudLoggedIn(false);
      await loadSettings();
      showToast('🗑 Private cloud vault data permanently deleted.');
    } catch (err: any) {
      alert(err?.message || 'Could not delete cloud data');
    } finally {
      setCloudBusy(false);
    }
  };

  const handleDeleteLocalPrivateOnly = async () => {
    const ok = confirm(
      '⚠️ আপনার স্থানীয় সমস্ত প্রোফাইল, ডকুমেন্ট, বুকমার্ক ও আবেদন ট্র্যাকার মুছে ফেলা হবে (পাবলিক চাকরির তালিকা থাকবে)। নিশ্চিত?'
    );
    if (!ok) return;
    await deleteLocalUserData();
    await MappingRepository.clear();
    await loadSettings();
    onDataReset();
    showToast('🗑 লোকাল প্রাইভেট ভল্ট ডাটা মুছে ফেলা হয়েছে।');
  };

  const handlePurge = async () => {
    const ok1 = confirm('⚠️ আপনি কি নিশ্চিত যে সমস্ত সেভ করা প্রোফাইল ও ডকুমেন্টের তথ্য মুছে ফেলতে চান?');
    if (!ok1) return;
    const ok2 = confirm('🔴 এই সিদ্ধান্ত অপরিবর্তনীয়! নিশ্চিত করতে OK চাপুন।');
    if (!ok2) return;

    await purgeAllData();
    await MappingRepository.clear();
    showToast('🗑 সমস্ত তথ্য মুছে ফেলা হয়েছে!');
    onDataReset();
  };

  const cloudSyncSupported =
    !(typeof __JOBFILL_CLOUD_SYNC_DISABLED__ !== 'undefined' && __JOBFILL_CLOUD_SYNC_DISABLED__) &&
    isCloudSyncFeatureEnabled();
  const cloudConfigured = cloudSyncSupported && isCloudBackendConfigured(cloudCfg);

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <span>🔒</span>
          <span>Privacy, Encrypted Vault &amp; {cloudSyncSupported ? 'Sync' : 'Backup'} (গোপনীয়তা, ভল্ট ও ব্যাকআপ)</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {cloudSyncSupported
            ? 'Web Crypto AES-256-GCM লোকাল এনক্রিপ্টেড ভল্ট, এনক্রিপ্টেড ব্যাকআপ এবং ঐচ্ছিক ক্লাউড সিঙ্ক।'
            : 'Web Crypto AES-256-GCM লোকাল এনক্রিপ্টেড ভল্ট এবং লোকাল JSON ব্যাকআপ (ক্লাউড সিঙ্ক এই রিলিজে নিষ্ক্রিয়)।'}
        </p>
      </div>

      {/* Vault Dashboard Overview Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[10px] font-bold uppercase text-slate-400">Vault Status</div>
          <div className="text-xs font-extrabold text-slate-800 dark:text-slate-100 mt-1 flex items-center gap-1.5">
            {metrics.isLocked ? <Lock className="w-3.5 h-3.5 text-amber-600" /> : <Unlock className="w-3.5 h-3.5 text-emerald-600" />}
            <span>{metrics.isLocked ? 'Locked' : isProtected ? 'Unlocked (Protected)' : 'Unlocked (Device Vault)'}</span>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[10px] font-bold uppercase text-slate-400">Local Storage</div>
          <div className="text-xs font-extrabold text-slate-800 dark:text-slate-100 mt-1 flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-petro-600" />
            <span>{formatStorageBytes(metrics.storageUsageBytes)}</span>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[10px] font-bold uppercase text-slate-400">Last Backup</div>
          <div className="text-xs font-extrabold text-slate-800 dark:text-slate-100 mt-1 truncate">
            {metrics.lastBackupAt ? new Date(metrics.lastBackupAt).toLocaleDateString() : 'Never'}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[10px] font-bold uppercase text-slate-400">Encryption</div>
          <div className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-400 mt-1 truncate">
            {metrics.encryptionAlgorithm}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[10px] font-bold uppercase text-slate-400">
            {cloudSyncSupported ? 'Cloud Sync' : 'Storage Mode'}
          </div>
          <div className="text-xs font-extrabold text-slate-800 dark:text-slate-100 mt-1 flex items-center gap-1.5">
            {cloudSyncSupported && cloudCfg.cloudSyncEnabled ? (
              <Cloud className="w-3.5 h-3.5 text-blue-600" />
            ) : (
              <CloudOff className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>
              {!cloudSyncSupported
                ? 'Local-First (Cloud Disabled)'
                : cloudCfg.cloudSyncEnabled
                  ? 'Enabled (E2EE)'
                  : 'Local Only (Off)'}
            </span>
          </div>
        </div>
      </div>

      {/* Honest Security & Recovery Notice */}
      <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4 text-xs text-emerald-900 dark:text-emerald-200 flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3 flex-1 min-w-[260px]">
          <Shield className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold">লোকাল-ফার্স্ট ও জিরো-নলেজ নীতি (Privacy &amp; Recovery Notice):</div>
            <p className="leading-relaxed">
              ডিফল্ট অবস্থায় আপনার সমস্ত প্রোফাইল, NID, ছবি এবং আবেদন তথ্য শুধু এই ডিভাইসের লোকাল IndexedDB-তে AES-256-GCM দিয়ে এনক্রিপ্ট করা থাকে। মাস্টার পাসওয়ার্ড ও ব্যাকআপ ফাইল দুটোই হারিয়ে ফেললে কোনো সার্ভার আপনার পাসওয়ার্ড রিকভার করে দিতে পারবে না।
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <a
            href={typeof chrome !== 'undefined' && chrome.runtime?.getURL ? chrome.runtime.getURL('privacy.html') : 'privacy.html'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-white dark:bg-slate-900 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Privacy Policy
          </a>
          <a
            href="https://mahfuzar148.github.io/jobfill-bd-privacy/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Public HTTPS Policy
          </a>
        </div>
      </div>

      {/* Master Password Vault Protection */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-petro-600" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Master Password Vault (পাসওয়ার্ড সুরক্ষা ও পরিবর্তন)
            </h3>
          </div>
          <span
            className={`text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
              isProtected
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {isProtected ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
            {isProtected ? 'Password Protected' : 'Device-Key Encrypted'}
          </span>
        </div>

        {!isProtected ? (
          <div className="space-y-3 max-w-md">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              একটি মাস্টার পাসওয়ার্ড দিলে আপনার সমস্ত প্রোফাইল ও ডকুমেন্ট PBKDF2 + AES-256-GCM দিয়ে এনক্রিপ্ট ও লক হবে।
            </p>
            <div className="space-y-2">
              <input
                type="password"
                placeholder="নতুন মাস্টার পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full text-xs border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
              />
              <input
                type="password"
                placeholder="পাসওয়ার্ড নিশ্চিত করুন"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full text-xs border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
              />
              <button
                onClick={handleEnablePassword}
                className="bg-petro-600 hover:bg-petro-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors shadow-sm"
              >
                🔒 পাসওয়ার্ড সুরক্ষা চালু করুন
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 text-xs text-emerald-700 font-semibold bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>আপনার ভল্ট PBKDF2 + AES-GCM-256 দিয়ে সুরক্ষিত।</span>
                </div>
                {onLockVault && (
                  <button
                    type="button"
                    onClick={onLockVault}
                    className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors shadow-xs shrink-0 flex items-center gap-1 cursor-pointer"
                  >
                    <Lock className="w-3 h-3" />
                    <span>এখনই লক করুন</span>
                  </button>
                )}
              </div>

              <div className="space-y-2 pt-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  পাসওয়ার্ড সুরক্ষা বন্ধ করতে বর্তমান পাসওয়ার্ড দিন:
                </label>
                <input
                  type="password"
                  placeholder="বর্তমান পাসওয়ার্ড"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                />
                <button
                  onClick={handleDisablePassword}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors shadow-sm"
                >
                  🔓 পাসওয়ার্ড সুরক্ষা বন্ধ করুন
                </button>
              </div>
            </div>

            {/* Change Vault Password */}
            <div className="space-y-2.5 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                Change Vault Password (পাসওয়ার্ড পরিবর্তন করুন)
              </div>
              <input
                type="password"
                placeholder="বর্তমান ভল্ট পাসওয়ার্ড"
                value={changeOldPassword}
                onChange={(e) => setChangeOldPassword(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white"
              />
              <input
                type="password"
                placeholder="নতুন ভল্ট পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)"
                value={changeNewPassword}
                onChange={(e) => setChangeNewPassword(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white"
              />
              <input
                type="password"
                placeholder="নতুন পাসওয়ার্ড নিশ্চিত করুন"
                value={changeConfirmPassword}
                onChange={(e) => setChangeConfirmPassword(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white"
              />
              <button
                type="button"
                onClick={handleChangePassword}
                className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors shadow-sm"
              >
                🔑 Update &amp; Re-Encrypt Vault
              </button>
            </div>
          </div>
        )}

        {/* Auto Lock Timeout */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">Automatic Inactivity Lock</div>
            <div className="text-[11px] text-slate-500">ব্রাউজার নিষ্ক্রিয় থাকলে নির্দিষ্ট সময় পর ভল্ট অটো-লক হবে।</div>
          </div>
          <select
            value={autoLockMinutes}
            onChange={(e) => handleAutoLockChange(Number(e.target.value))}
            className="text-xs border border-slate-300 rounded-lg p-2 bg-white focus:border-petro-600 font-semibold"
          >
            <option value={5}>5 Minutes</option>
            <option value={15}>15 Minutes (Default)</option>
            <option value={30}>30 Minutes</option>
            <option value={60}>1 Hour</option>
          </select>
        </div>
      </div>

      {/* Backup Export & Restore */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="text-xs font-bold text-petro-700 uppercase tracking-wider border-b border-slate-100 pb-2">
          ব্যাকআপ ও রিস্টোর (Export &amp; Import Profile)
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Download className="w-4 h-4 text-petro-600" />
              Export Backup File (.json)
            </div>
            <p className="text-[11px] text-slate-500">
              আপনার সমস্ত প্রোফাইলের একটি কপি ডাউনলোড করে সুরক্ষিত রাখুন।
            </p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-slate-700 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportEncrypted}
                  onChange={(e) => setExportEncrypted(e.target.checked)}
                  className="rounded accent-petro-600"
                />
                পাসওয়ার্ড দিয়ে এনক্রিপ্ট করে এক্সপোর্ট করুন
              </label>
              {exportEncrypted && (
                <input
                  type="password"
                  placeholder="এক্সপোর্ট এনক্রিপশন পাসওয়ার্ড"
                  value={exportPassword}
                  onChange={(e) => setExportPassword(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white"
                />
              )}
              <button
                onClick={handleExport}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                Download JSON Backup
              </button>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Upload className="w-4 h-4 text-blue-600" />
              Restore / Import Profile
            </div>
            <p className="text-[11px] text-slate-500">
              পূর্বের ডাউনলোড করা JobFill BD ব্যাকআপ JSON ফাইল সিলেক্ট করে তথ্য রিস্টোর করুন।
            </p>
            <div className="space-y-2">
              <input
                type="password"
                placeholder="যদি ব্যাকআপ ফাইলটি পাসওয়ার্ড প্রটেক্টেড হয়"
                value={importPassword}
                onChange={(e) => setImportPassword(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white"
              />
              <label className="w-full bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-sm">
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                Select Backup JSON File
                <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Optional Cloud Sync & Public Job DB Controls (isolated/disabled in Edge Store release) */}
      {cloudSyncSupported ? (
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Optional Client-Side Encrypted Cloud Sync (ঐচ্ছিক ক্লাউড সিঙ্ক)
            </h3>
          </div>
          <button
            type="button"
            onClick={() => handleToggleCloudSync(!cloudCfg.cloudSyncEnabled)}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
              cloudCfg.cloudSyncEnabled
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {cloudCfg.cloudSyncEnabled ? 'Disable Cloud Sync' : 'Enable Cloud Sync'}
          </button>
        </div>

        {/* Cloud Sync Disclosure Box */}
        <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl p-3.5 text-[11px] text-blue-950 dark:text-blue-200 space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-600" />
            <span>Cloud Sync Privacy &amp; Key Separation Notice</span>
          </div>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Default mode is <strong>Local Only</strong> — no account or cloud upload is ever required.</li>
            <li>When enabled, ONLY AES-256-GCM ciphertext envelopes of your profile &amp; activity leave your browser. Public job feeds stay separate and anonymous.</li>
            <li>Your Vault / Sync passphrase never leaves this device. You can disable sync or permanently delete your cloud vault anytime below.</li>
          </ul>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            type="url"
            placeholder="Supabase Project URL (https://your-project.supabase.co)"
            value={cloudCfg.supabaseUrl}
            onChange={(e) => setCloudCfg({ ...cloudCfg, supabaseUrl: e.target.value })}
            className="text-xs border border-slate-300 rounded-lg p-2 bg-white"
          />
          <input
            type="password"
            placeholder="Supabase Public Anon Key (never service_role)"
            value={cloudCfg.supabaseAnonKey}
            onChange={(e) => setCloudCfg({ ...cloudCfg, supabaseAnonKey: e.target.value })}
            className="text-xs border border-slate-300 rounded-lg p-2 bg-white"
          />
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <label className="flex items-center gap-2 text-xs text-slate-700 font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={cloudCfg.usePublicCloudJobsFeed}
              onChange={(e) => setCloudCfg({ ...cloudCfg, usePublicCloudJobsFeed: e.target.checked })}
              className="rounded accent-petro-600"
            />
            Read verified circulars from Shared Public Job Database when configured
          </label>
          <button
            type="button"
            onClick={handleSaveCloudBackend}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold"
          >
            Save Cloud Endpoint
          </button>
        </div>

        {cloudCfg.cloudSyncEnabled && cloudConfigured && (
          <div className="border-t border-slate-100 pt-4 space-y-3">
            {!isCloudLoggedIn ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="email"
                  placeholder="Account email"
                  value={cloudEmail}
                  onChange={(e) => setCloudEmail(e.target.value)}
                  className="text-xs border border-slate-300 rounded-lg p-2"
                />
                <input
                  type="password"
                  placeholder="Account password"
                  value={cloudAuthPassword}
                  onChange={(e) => setCloudAuthPassword(e.target.value)}
                  className="text-xs border border-slate-300 rounded-lg p-2"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={cloudBusy}
                    onClick={() => handleCloudAuth('signin')}
                    className="flex-1 bg-petro-600 hover:bg-petro-700 text-white text-xs font-bold py-2 rounded-lg"
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    disabled={cloudBusy}
                    onClick={() => handleCloudAuth('signup')}
                    className="flex-1 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold py-2 rounded-lg"
                  >
                    Sign Up
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">
                    Signed in as: {cloudCfg.authenticatedEmail || 'Authenticated User'}
                  </span>
                  <button
                    type="button"
                    disabled={cloudBusy}
                    onClick={handleCloudLogout}
                    className="text-xs font-bold text-amber-700 hover:underline"
                  >
                    Sign Out &amp; Lock Session
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="password"
                    placeholder="Client-side E2EE Sync Passphrase (never sent to server)"
                    value={syncPassphrase}
                    onChange={(e) => setSyncPassphrase(e.target.value)}
                    className="flex-1 text-xs border border-slate-300 rounded-lg p-2 bg-white"
                  />
                  <button
                    type="button"
                    disabled={cloudBusy}
                    onClick={handleCloudPush}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Encrypt &amp; Upload
                  </button>
                  <button
                    type="button"
                    disabled={cloudBusy}
                    onClick={handleCloudPull}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg"
                  >
                    Download &amp; Decrypt
                  </button>
                  <button
                    type="button"
                    disabled={cloudBusy}
                    onClick={handleDeleteCloudData}
                    className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg"
                  >
                    Delete Cloud Data
                  </button>
                </div>
                {cloudRestorePreview && (
                  <div
                    data-testid="cloud-restore-conflict-box"
                    className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-xs text-amber-950 space-y-2"
                  >
                    <div className="font-bold">
                      ⚠️ Cloud Restore Conflict Detected ({cloudRestorePreview.localProfilesCount} local vs{' '}
                      {cloudRestorePreview.remoteProfilesCount} cloud profile(s))
                    </div>
                    <p className="text-[11px]">
                      Choose whether to merge cloud records with existing local profiles (keeps newer updates without overwriting local-only profiles) or replace your local profiles completely.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={cloudBusy}
                        onClick={() => void applyCloudPullWithStrategy('merge')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer"
                      >
                        Merge with Local
                      </button>
                      <button
                        type="button"
                        disabled={cloudBusy}
                        onClick={() => void applyCloudPullWithStrategy('replace')}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] cursor-pointer"
                      >
                        Replace Local Profiles
                      </button>
                      <button
                        type="button"
                        disabled={cloudBusy}
                        onClick={() => setCloudRestorePreview(null)}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold text-[11px] cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  <strong>Local-Only Scope:</strong> Uploaded photos, signatures, and certificates (<code>documents_bundle</code>) remain local in IndexedDB and are excluded from cloud sync in v2.0.0. <strong>Delete Cloud Data</strong> removes your encrypted vault blobs and sync device metadata; full Auth account deletion is handled via the optional <code>delete-account</code> Edge Function.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      ) : (
      <div
        data-testid="edge-local-only-sync-notice"
        className="bg-slate-50 dark:bg-slate-900/70 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 space-y-1.5"
      >
        <div className="font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
          <CloudOff className="w-4 h-4 text-emerald-600" />
          <span>Local-Only Mode Active (First Public Release v2.0.0 — Cloud Sync Disabled)</span>
        </div>
        <p className="text-[11.5px] leading-relaxed">
          All profiles, education/employment history, uploaded documents, bookmarks, application tracking, and autofill history stay strictly inside your browser encrypted with Web Crypto AES-256-GCM. Cloud Sync and online accounts are disabled in this first public release. Public job circular retrieval uses Internet access via unauthenticated read-only GET requests with zero personal data.
        </p>
      </div>
      )}

      {/* Latest Migration Report Status */}
      {migrationReport && (
        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-1">
          <div className="font-bold text-slate-800 dark:text-slate-200">
            Schema v{migrationReport.schemaFrom} → v{migrationReport.schemaTo} Migration Report
          </div>
          <div className="text-slate-600 dark:text-slate-400">
            Detected: {migrationReport.recordsDetected.profiles} profiles, {migrationReport.recordsDetected.documents} docs, {migrationReport.recordsDetected.bookmarks} bookmarks • Migrated: {migrationReport.recordsMigrated} • Skipped: {migrationReport.recordsSkipped} • Decrypt Verified: {migrationReport.decryptVerified ? 'Yes' : 'Pending/Review'} • Errors: {migrationReport.errors.length}
          </div>
        </div>
      )}

      {/* Danger Zone: Delete Local Data / Purge All Data */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-5 shadow-sm space-y-3">
        <div className="text-xs font-bold text-red-800 uppercase tracking-wider flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          Danger Zone — সমস্ত তথ্য মুছে ফেলুন (Delete Data)
        </div>
        <p className="text-xs text-red-700">
          আপনার ব্রাউজার থেকে সমস্ত সংরক্ষিত প্রোফাইল, ফটো, স্বাক্ষর এবং ডকুমেন্ট স্থায়ীভাবে মুছে ফেলতে চাইলে নিচের বাটনে চাপ দিন।
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleDeleteLocalPrivateOnly}
            className="bg-white hover:bg-red-100 text-red-700 border border-red-300 text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete Local Private Vault Data
          </button>
          <button
            onClick={handlePurge}
            className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Trash2 className="w-4 h-4" />
            Purge All Profiles &amp; Data
          </button>
        </div>
      </div>
    </div>
  );
};
