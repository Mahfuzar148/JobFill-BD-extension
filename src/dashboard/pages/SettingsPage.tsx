import React, { useState, useEffect } from 'react';
import {
  Settings,
  Languages,
  Moon,
  Sun,
  ShieldAlert,
  Download,
  Upload,
  CheckCircle,
  Database,
  Sliders,
  Sparkles,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  getGeneralSettings,
  saveGeneralSettings,
  exportProfileData,
  importProfileData,
  purgeAllData,
  DEFAULT_GENERAL_SETTINGS,
} from '../../services/storage';
import { MappingRepository } from '../../database/mapping-repository';
import { AppGeneralSettings } from '../../types/profile';
import { JobPreferencesSection } from '../../jobs/dashboard/JobPreferencesSection';

interface SettingsPageProps {
  showToast: (msg: string) => void;
  onDataReset?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ showToast, onDataReset }) => {
  const { language, setLanguage, theme, toggleTheme } = useApp();
  const [settings, setSettings] = useState<AppGeneralSettings>(DEFAULT_GENERAL_SETTINGS);
  const [isExporting, setIsExporting] = useState(false);
  const [exportPassword, setExportPassword] = useState('');
  const [encryptExport, setEncryptExport] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const s = await getGeneralSettings();
    setSettings(s);
  };

  const handleUpdateSetting = async <K extends keyof AppGeneralSettings>(key: K, value: AppGeneralSettings[K]) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    await saveGeneralSettings({ [key]: value });
    showToast(language === 'bn' ? '⚙️ সেটিংস সংরক্ষিত হয়েছে!' : '⚙️ Setting updated!');
  };

  const handleExportJSON = async () => {
    setIsExporting(true);
    try {
      const dataStr = await exportProfileData(encryptExport, exportPassword || undefined);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `JobFill_BD_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setShowExportModal(false);
      showToast(language === 'bn' ? '📥 ব্যাকআপ ফাইল ডাউনলোড সম্পন্ন হয়েছে!' : '📥 Backup file downloaded!');
    } catch (e: any) {
      alert('Export failed: ' + e.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      try {
        let password = '';
        if (content.includes('"isEncrypted":true')) {
          password = prompt(
            language === 'bn'
              ? 'এই ব্যাকআপ ফাইলটি এনক্রিপ্টেড। আনলক পাসওয়ার্ড দিন:'
              : 'This backup is password encrypted. Enter password:'
          ) || '';
          if (!password) return;
        }

        const count = await importProfileData(content, password);
        showToast(
          language === 'bn'
            ? `✅ সফলভাবে ${count}টি প্রোফাইল ইমপোর্ট করা হয়েছে!`
            : `✅ Successfully imported ${count} profile(s)!`
        );
        if (onDataReset) onDataReset();
      } catch (err: any) {
        alert(language === 'bn' ? 'ইমপোর্টে সমস্যা: ' + err.message : 'Import error: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleClearLearnedMappings = () => {
    if (
      window.confirm(
        language === 'bn'
          ? 'আপনি কি নিশ্চিত যে সকল সংরক্ষিত ফিল্ড ম্যাপিং মুছে ফেলতে চান?'
          : 'Are you sure you want to delete all saved adaptive field mappings?'
      )
    ) {
      MappingRepository.clear();
      showToast(language === 'bn' ? '🧹 সংরক্ষিত ম্যাপিং মুছে ফেলা হয়েছে!' : '🧹 Learned mappings cleared!');
    }
  };

  const handleFactoryReset = async () => {
    const confirm1 = window.confirm(
      language === 'bn'
        ? '⚠️ সতর্কতা: এটি আপনার সকল প্রোফাইল, সেটিংস এবং ভল্ট ডাটা মুছে দেবে! আপনি কি নিশ্চিত?'
        : '⚠️ CAUTION: This will permanently wipe all profiles, settings, and vault data! Proceed?'
    );
    if (!confirm1) return;

    const confirm2 = window.prompt(
      language === 'bn' ? 'নিশ্চিত করতে "RESET" শব্দটি লিখুন:' : 'Type "RESET" to confirm permanent purge:'
    );
    if (confirm2 !== 'RESET') return;

    await purgeAllData();
    MappingRepository.clear();
    showToast(language === 'bn' ? '🗑️ এক্সটেনশনের সকল তথ্য সম্পূর্ণ মুছে ফেলা হয়েছে।' : '🗑️ All extension data purged.');
    if (onDataReset) onDataReset();
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Settings className="w-5 h-5 text-petro-600" />
          <span>{language === 'bn' ? 'সেটিংস ও কনফিগারেশন (Settings)' : 'Settings & Preferences'}</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          {language === 'bn'
            ? 'ভাষাগত পছন্দ, অটো-ফিল আচরণ, থিম এবং ব্যাকআপ নিয়ন্ত্রণ করুন।'
            : 'Configure language, autofill behavior, theme, confidence thresholds, and backups.'}
        </p>
      </div>

      {/* General & Appearance */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="text-xs font-bold text-petro-700 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-2">
          <Languages className="w-4 h-4 text-petro-600" />
          <span>{language === 'bn' ? 'ভাষা ও থিম (Language & Appearance)' : 'Language & Appearance'}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Language Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {language === 'bn' ? 'ইন্টারফেস ভাষা (Interface Language)' : 'Interface Language'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLanguage('bn')}
                className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  language === 'bn'
                    ? 'border-petro-600 bg-petro-50 text-petro-800 ring-1 ring-petro-600'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                🇧🇩 বাংলা (Bengali)
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  language === 'en'
                    ? 'border-petro-600 bg-petro-50 text-petro-800 ring-1 ring-petro-600'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                🇬🇧 English
              </button>
            </div>
          </div>

          {/* Theme Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {language === 'bn' ? 'থিম মুড (Visual Theme)' : 'Visual Theme'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => toggleTheme()}
                className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  theme === 'light'
                    ? 'border-petro-600 bg-petro-50 text-petro-800 ring-1 ring-petro-600'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Sun className="w-4 h-4 text-amber-500" /> Light Mode
              </button>
              <button
                type="button"
                onClick={() => toggleTheme()}
                className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  theme === 'dark'
                    ? 'border-petro-600 bg-petro-50 text-petro-800 ring-1 ring-petro-600'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Moon className="w-4 h-4 text-indigo-500" /> Dark Mode
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Autofill Engine Rules */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="text-xs font-bold text-petro-700 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-petro-600" />
          <span>{language === 'bn' ? 'অটো-ফিল আচরণ ও নির্ভুলতা (Autofill Behavior & Precision)' : 'Autofill Behavior & Precision'}</span>
        </div>

        <div className="space-y-4">
          {/* Confirmation Mode */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div>
              <div className="text-xs font-bold text-slate-800">
                {language === 'bn' ? 'ফর্ম পূরণের পূর্বে প্রিভিউ নিশ্চিতকরণ' : 'Preview Modal Before Fill'}
              </div>
              <div className="text-[11px] text-slate-500">
                {language === 'bn'
                  ? 'ফিল করার আগে শনাক্তকৃত প্রতিটি ফিল্ডের তালিকা ও মান দেখার সুযোগ দেয়।'
                  : 'Displays the 2-stage review modal with match explanation and edit inputs.'}
              </div>
            </div>
            <select
              value={settings.fillMode}
              onChange={(e) => handleUpdateSetting('fillMode', e.target.value as any)}
              className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-white font-semibold cursor-pointer"
            >
              <option value="review_first">
                {language === 'bn' ? 'প্রিভিউ মোড (প্রস্তাবিত)' : 'Preview First (Recommended)'}
              </option>
              <option value="instant_fill">
                {language === 'bn' ? 'তাত্ক্ষণিক ফিল (১-ক্লিক)' : 'Instant 1-Click Fill'}
              </option>
            </select>
          </div>

          {/* Overwrite Protection */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div>
              <div className="text-xs font-bold text-slate-800">
                {language === 'bn' ? 'বিদ্যমান তথ্যের নিরাপত্তা (Overwrite Protection)' : 'Overwrite Protection'}
              </div>
              <div className="text-[11px] text-slate-500">
                {language === 'bn'
                  ? 'ফর্ম ফিল্ডে আগে থেকেই কোনো মান থাকলে তা কীভাবে পরিচালনা করবেন।'
                  : 'How to handle fields that already have user or server pre-filled text.'}
              </div>
            </div>
            <select
              value={settings.overwriteProtection}
              onChange={(e) => handleUpdateSetting('overwriteProtection', e.target.value as any)}
              className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-white font-semibold cursor-pointer"
            >
              <option value="warn">
                {language === 'bn' ? 'সতর্কতা দেখান (Warn on Conflict)' : 'Warn on Conflict'}
              </option>
              <option value="never">
                {language === 'bn' ? 'কখনও ওভাররাইট করবেন না (Never Overwrite)' : 'Never Overwrite'}
              </option>
              <option value="always">
                {language === 'bn' ? 'সরাসরি প্রতিস্থাপন করুন (Always Overwrite)' : 'Always Overwrite'}
              </option>
            </select>
          </div>

          {/* Minimum Confidence Level */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div>
              <div className="text-xs font-bold text-slate-800">
                {language === 'bn' ? 'ন্যূনতম কনফিডেন্স স্কোর (Match Confidence Tier)' : 'Minimum Confidence Threshold'}
              </div>
              <div className="text-[11px] text-slate-500">
                {language === 'bn'
                  ? 'শুধুমাত্র উচ্চ বিশ্বস্ত ফিল্ড নাকি মাঝারি বিশ্বস্ত ফিল্ডও স্বয়ংক্রিয় সিলেক্ট থাকবে।'
                  : 'Defines threshold for pre-checking fields in the approval list.'}
              </div>
            </div>
            <select
              value={settings.minimumConfidenceThreshold}
              onChange={(e) => handleUpdateSetting('minimumConfidenceThreshold', Number(e.target.value))}
              className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-white font-semibold cursor-pointer"
            >
              <option value={85}>
                {language === 'bn' ? 'উচ্চ বিশ্বস্ততা (High Only ≥ 85%)' : 'High Confidence Only (≥ 85%)'}
              </option>
              <option value={65}>
                {language === 'bn' ? 'ভারসাম্যপূর্ণ (Balanced ≥ 65%)' : 'Balanced (≥ 65%)'}
              </option>
              <option value={50}>
                {language === 'bn' ? 'উন্মুক্ত (Broad ≥ 50%)' : 'Broad Match (≥ 50%)'}
              </option>
            </select>
          </div>

          {/* Number Conversion Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div>
              <div className="text-xs font-bold text-slate-800">
                {language === 'bn' ? 'স্বয়ংক্রিয় বাংলা সংখ্যা রূপান্তর' : 'Automatic Bengali Numerals Normalization'}
              </div>
              <div className="text-[11px] text-slate-500">
                {language === 'bn'
                  ? 'এনআইডি, মোবাইল, রোল ও জিপিএ ক্ষেত্রে বাংলা সংখ্যাকে (০-৯) ইংরেজিতে রূপান্তর।'
                  : 'Normalizes Bengali numbers (০-৯) to English (0-9) for standard form inputs.'}
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enableBengaliConversion}
                onChange={(e) => handleUpdateSetting('enableBengaliConversion', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-petro-600"></div>
            </label>
          </div>

          {/* Highlight Fields */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div>
              <div className="text-xs font-bold text-slate-800">
                {language === 'bn' ? 'পূরণকৃত ফিল্ড হাইলাইট করুন' : 'Highlight Filled Fields'}
              </div>
              <div className="text-[11px] text-slate-500">
                {language === 'bn'
                  ? 'সফলভাবে পূরণকৃত ফিল্ডগুলোর চারপাশে হালকা সবুজ বর্ডার প্রদর্শন করে।'
                  : 'Renders soft green outline around populated inputs for effortless visual checking.'}
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.highlightFilledFields}
                onChange={(e) => handleUpdateSetting('highlightFilledFields', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-petro-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Job Filter & Notification Preferences */}
      <JobPreferencesSection showToast={showToast} />

      {/* Data Management & Backups */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="text-xs font-bold text-petro-700 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-2">
          <Database className="w-4 h-4 text-petro-600" />
          <span>{language === 'bn' ? 'তথ্য ব্যাকআপ ও রক্ষণাবেক্ষণ (Data & Backups)' : 'Data & Backups'}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Export JSON */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
              <Download className="w-4 h-4 text-petro-600" />
              <span>{language === 'bn' ? 'ব্যাকআপ ডাউনলোড (Export Profile)' : 'Export Profile Backup'}</span>
            </div>
            <p className="text-[11px] text-slate-500">
              {language === 'bn'
                ? 'আপনার সকল প্রোফাইলের তথ্য JSON ফাইলে সেভ করে অন্য পিসিতে নিতে পারেন।'
                : 'Save complete profile database to a secure JSON file.'}
            </p>
            <button
              onClick={() => setShowExportModal(true)}
              className="w-full py-2 bg-petro-600 hover:bg-petro-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              {language === 'bn' ? 'প্রোফাইল এক্সপোর্ট করুন' : 'Export Profile JSON'}
            </button>
          </div>

          {/* Import JSON */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
              <Upload className="w-4 h-4 text-petro-600" />
              <span>{language === 'bn' ? 'ব্যাকআপ ইমপোর্ট (Import Profile)' : 'Import Profile Backup'}</span>
            </div>
            <p className="text-[11px] text-slate-500">
              {language === 'bn'
                ? 'আগে এক্সপোর্ট করা JobFill BD ব্যাকআপ JSON ফাইল রিস্টোর করুন।'
                : 'Restore existing JobFill BD JSON backups into your vault.'}
            </p>
            <label className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer text-center">
              <Upload className="w-3.5 h-3.5" />
              <span>{language === 'bn' ? 'ব্যাকআপ ফাইল সিলেক্ট করুন' : 'Select Backup JSON File'}</span>
              <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
            </label>
          </div>
        </div>

        {/* Maintenance Actions */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            onClick={handleClearLearnedMappings}
            className="text-xs font-semibold text-slate-600 hover:text-slate-800 flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-slate-200 hover:bg-slate-50"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            {language === 'bn' ? 'অভিযোজিত ম্যাপিং মেমরি রিসেট' : 'Reset Learned Field Mappings'}
          </button>

          <button
            onClick={handleFactoryReset}
            className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {language === 'bn' ? 'ফ্যাক্টরি রিসেট (সকল তথ্য মুছুন)' : 'Factory Reset (Purge All)'}
          </button>
        </div>
      </div>

      {/* Export Options Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <Download className="w-5 h-5 text-petro-600" />
              <span>{language === 'bn' ? 'প্রোফাইল ব্যাকআপ এক্সপোর্ট' : 'Export Profile Backup'}</span>
            </h3>

            <p className="text-xs text-slate-500">
              {language === 'bn'
                ? 'আপনি ব্যাকআপ ফাইলটি সাধারণ JSON অথবা পাসওয়ার্ড দিয়ে এনক্রিপ্ট করে সেভ করতে পারেন।'
                : 'Choose whether to encrypt the backup file with AES-256-GCM encryption.'}
            </p>

            <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={encryptExport}
                  onChange={(e) => setEncryptExport(e.target.checked)}
                  className="rounded text-petro-600 focus:ring-petro-500 w-4 h-4"
                />
                <span>পাসওয়ার্ড দিয়ে ফাইলটি এনক্রিপ্ট করুন (AES-256-GCM)</span>
              </label>

              {encryptExport && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    এক্সপোর্ট পাসওয়ার্ড (Export Password)
                  </label>
                  <input
                    type="password"
                    value={exportPassword}
                    onChange={(e) => setExportPassword(e.target.value)}
                    placeholder="Enter encryption password"
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:outline-none focus:border-petro-600"
                  />
                  <div className="text-[10px] text-amber-700 mt-1 font-medium">
                    ⚠️ মনে রাখবেন: পাসওয়ার্ড ভুলে গেলে এই ব্যাকআপ ফাইল রিস্টোর করা সম্ভব হবে না।
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                বাতিল (Cancel)
              </button>
              <button
                type="button"
                onClick={handleExportJSON}
                disabled={isExporting || (encryptExport && !exportPassword)}
                className="px-4 py-2 text-xs font-bold bg-petro-600 hover:bg-petro-700 text-white rounded-lg shadow-sm disabled:opacity-50"
              >
                {isExporting ? 'তৈরি হচ্ছে...' : 'ডাউনলোড করুন (Download)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
