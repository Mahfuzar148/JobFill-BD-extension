import React, { useMemo, useState } from 'react';
import {
  Save,
  Plus,
  ExternalLink,
  Shield,
  Lock,
  Search,
  Sun,
  Moon,
  Languages,
  Check,
  ArrowRight,
} from 'lucide-react';
import { UserProfile } from '../../types/profile';
import { useApp } from '../context/AppContext';
import { DashboardTab } from './Sidebar';
import { ProfileFieldSearchEntry, searchProfileFields } from '../data/field-search-index';

interface HeaderProps {
  activeTab: DashboardTab;
  onNavigateTab?: (tab: DashboardTab) => void;
  currentProfile: UserProfile;
  allProfiles: UserProfile[];
  onSelectProfile: (id: string) => void;
  onCreateProfile: () => void;
  onSave: () => void;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  isLocked: boolean;
  isVaultProtected?: boolean;
  onLockVault?: () => void;
}

const TAB_BREADCRUMBS: Record<DashboardTab, { en: string; bn: string }> = {
  overview: { en: 'Overview / Dashboard', bn: 'সারসংক্ষেপ / ড্যাশবোর্ড' },
  search: { en: 'Job Hub / Job Search Engine', bn: 'জব হাব / জব সার্চ ইঞ্জিন' },
  circulars: { en: 'Job Hub / Job Circulars', bn: 'জব হাব / চাকরির বিজ্ঞপ্তি' },
  govt_orgs: { en: 'Job Hub / Government Organizations', bn: 'জব হাব / সরকারি প্রতিষ্ঠান ডিরেক্টরি' },
  portals: { en: 'Job Hub / Official Job Portals', bn: 'জব হাব / অফিশিয়াল জব পোর্টাল' },
  notifications: { en: 'Job Hub / Notification Center', bn: 'জব হাব / নোটিফিকেশন সেন্টার' },
  tracker: { en: 'Job Hub / Application Tracker', bn: 'জব হাব / আবেদন ট্র্যাকার' },
  personal: { en: 'Profile / Personal Information', bn: 'প্রোফাইল / ব্যক্তিগত তথ্য' },
  family: { en: 'Profile / Family Information', bn: 'প্রোফাইল / পারিবারিক তথ্য' },
  address: { en: 'Profile / Address Details', bn: 'ঠিকানা / বর্তমান ও স্থায়ী ঠিকানা' },
  education: { en: 'Profile / Educational Qualifications', bn: 'প্রোফাইল / শিক্ষাগত যোগ্যতা' },
  additional: { en: 'Profile / Skills & Training', bn: 'প্রোফাইল / দক্ষতা ও প্রশিক্ষণ' },
  experience: { en: 'Profile / Job Experience', bn: 'প্রোফাইল / চাকরির অভিজ্ঞতা' },
  documents: { en: 'Profile / Documents & Photos', bn: 'প্রোফাইল / ছবি ও সনদপত্র' },
  autofill: { en: 'Automation / Smart Auto Fill Engine', bn: 'অটোমেশন / স্মার্ট অটো-ফিল ইঞ্জিন' },
  mappings: { en: 'Automation / Saved Field Mappings', bn: 'অটোমেশন / সংরক্ষিত ম্যাপিং' },
  history: { en: 'Automation / Application History', bn: 'অটোমেশন / আবেদনের হিস্ট্রি' },
  preferences: { en: 'Preferences / Special & Cadre Choices', bn: 'পছন্দ / বিশেষ তথ্য ও পছন্দক্রম' },
  security: { en: 'System / Security & Encrypted Vault', bn: 'সিস্টেম / নিরাপত্তা ও এনক্রিপ্টেড ভল্ট' },
  settings: { en: 'System / Settings & Configuration', bn: 'সিস্টেম / সেটিংস ও কনফিগারেশন' },
  help: { en: 'System / Help & User Guide', bn: 'সিস্টেম / সাহায্য ও ব্যবহার সহায়িকা' },
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onNavigateTab,
  currentProfile,
  allProfiles,
  onSelectProfile,
  onCreateProfile,
  onSave,
  hasUnsavedChanges,
  isSaving,
  isLocked,
  isVaultProtected = false,
  onLockVault,
}) => {
  const { language, setLanguage, theme, toggleTheme, searchQuery, setSearchQuery } = useApp();
  const [searchFocused, setSearchFocused] = useState(false);

  const searchResults = useMemo(() => searchProfileFields(searchQuery, 8), [searchQuery]);

  const handleSelectSearchEntry = (entry: ProfileFieldSearchEntry) => {
    onNavigateTab?.(entry.tab);
    setSearchQuery('');
    setSearchFocused(false);

    // Highlight matching form control on target tab once mounted
    window.setTimeout(() => {
      const mainEl = document.querySelector('main');
      if (!mainEl) return;
      const hint = entry.matchHint.toLowerCase();
      const candidates = Array.from(
        mainEl.querySelectorAll<HTMLElement>('label, h2, h3, input, select, textarea')
      );
      const target = candidates.find((el) => {
        const txt = (el.textContent || '').toLowerCase();
        const ph = (el.getAttribute('placeholder') || '').toLowerCase();
        const nm = (el.getAttribute('name') || '').toLowerCase();
        return txt.includes(hint) || ph.includes(hint) || nm.includes(hint);
      });
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const focusEl =
          target.tagName === 'LABEL'
            ? (target.parentElement?.querySelector<HTMLElement>('input, select, textarea') ?? target)
            : target;
        focusEl.classList.add('ring-2', 'ring-petro-500');
        if (typeof (focusEl as any).focus === 'function' && /INPUT|SELECT|TEXTAREA/.test(focusEl.tagName)) {
          focusEl.focus();
        }
        window.setTimeout(() => focusEl.classList.remove('ring-2', 'ring-petro-500'), 1800);
      }
    }, 90);
  };

  const breadcrumb = TAB_BREADCRUMBS[activeTab] || { en: 'Dashboard', bn: 'ড্যাশবোর্ড' };

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between shadow-xs sticky top-0 z-20 transition-colors">
      {/* Left: Breadcrumbs & Active Profile Selector */}
      <div className="flex items-center gap-4">
        {/* Breadcrumb path */}
        <div className="hidden lg:flex flex-col">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            JobFill BD Navigation
          </span>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
            {language === 'bn' ? breadcrumb.bn : breadcrumb.en}
          </span>
        </div>

        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden lg:block" />

        {/* Profile Switcher */}
        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {language === 'bn' ? 'সক্রিয় প্রার্থী' : 'Active Applicant'}
            </span>
            <div className="flex items-center gap-1.5">
              <select
                value={currentProfile.id}
                onChange={(e) => onSelectProfile(e.target.value)}
                className="font-bold text-slate-800 dark:text-slate-100 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 focus:outline-none focus:border-petro-600 focus:ring-1 focus:ring-petro-600 cursor-pointer max-w-[170px] truncate"
              >
                {allProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.personal.applicantNameEn || p.profileName}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={onCreateProfile}
                title={language === 'bn' ? 'নতুন প্রোফাইল যোগ করুন' : 'Add New Profile'}
                className="p-1 rounded-lg text-slate-500 hover:text-petro-700 hover:bg-petro-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {hasUnsavedChanges && (
            <span className="text-[10.5px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
              ● {language === 'bn' ? 'অসংরক্ষিত' : 'Unsaved'}
            </span>
          )}
        </div>
      </div>

      {/* Middle: Live Profile Field Quick-Jump Search */}
      <div className="hidden md:flex items-center relative max-w-xs w-full mx-4">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => window.setTimeout(() => setSearchFocused(false), 160)}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setSearchFocused(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && searchResults.length > 0) {
              e.preventDefault();
              handleSelectSearchEntry(searchResults[0]);
            } else if (e.key === 'Escape') {
              setSearchQuery('');
              setSearchFocused(false);
            }
          }}
          placeholder={language === 'bn' ? 'ফিল্ড খুঁজুন (নাম, এনআইডি, কোটা...)' : 'Quick jump: NID, Photo, Address...'}
          aria-label={language === 'bn' ? 'প্রোফাইল ফিল্ড অনুসন্ধান' : 'Search profile fields'}
          className="w-full text-xs pl-8 pr-7 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-petro-600 focus:bg-white dark:focus:bg-slate-900 transition-colors"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
          >
            ✕
          </button>
        )}

        {searchFocused && searchQuery.trim().length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden max-h-80 overflow-y-auto">
            {searchResults.length === 0 ? (
              <div className="px-3.5 py-3 text-xs text-slate-500 dark:text-slate-400">
                {language === 'bn' ? 'কোনো মিল পাওয়া যায়নি' : 'No matching field or section found'}
              </div>
            ) : (
              searchResults.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectSearchEntry(item);
                  }}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-petro-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 last:border-b-0 flex items-center justify-between gap-2 transition-colors cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                      {language === 'bn' ? item.labelBn : item.labelEn}
                    </div>
                    <div className="text-[10.5px] text-slate-500 dark:text-slate-400">
                      {language === 'bn' ? item.sectionBn : item.sectionEn}
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-petro-600 shrink-0" />
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Language Switcher */}
        <button
          type="button"
          onClick={() => setLanguage(language === 'bn' ? 'en' : 'bn')}
          title="Toggle Language (বাংলা / English)"
          className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Languages className="w-3.5 h-3.5 text-petro-600" />
          <span>{language === 'bn' ? 'BN' : 'EN'}</span>
        </button>

        {/* Theme Switcher */}
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600" />
          )}
        </button>

        {/* Test pages quick link (dev/testing builds only) */}
        {!(typeof __JOBFILL_STORE_CLEAN__ !== 'undefined' && __JOBFILL_STORE_CLEAN__) && (
        <a
          href="test-pages/petrobangla-form.html"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden xl:flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-petro-700 dark:hover:text-emerald-400 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Mock Forms</span>
        </a>
        )}

        {/* Vault status & Manual Lock */}
        {isVaultProtected && !isLocked && onLockVault ? (
          <button
            type="button"
            onClick={onLockVault}
            title={language === 'bn' ? 'এখনই ভল্ট লক করুন' : 'Lock Vault Now'}
            className="flex items-center gap-1 text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-950/60 px-2.5 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800 transition-colors cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{language === 'bn' ? 'লক করুন' : 'Lock Vault'}</span>
          </button>
        ) : (
          <div className="hidden sm:flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 px-2 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <Shield className="w-3.5 h-3.5 text-petro-600" />
            <span>{isLocked ? 'Locked' : 'Vault'}</span>
          </div>
        )}

        {/* Save Button */}
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving || isLocked}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all shadow-sm ${
            hasUnsavedChanges
              ? 'bg-petro-600 text-white hover:bg-petro-700 shadow-petro-600/30 ring-2 ring-petro-500/50'
              : 'bg-petro-700 text-white hover:bg-petro-800'
          }`}
        >
          <Save className="w-3.5 h-3.5" />
          <span>
            {isSaving
              ? language === 'bn'
                ? 'সংরক্ষণ হচ্ছে...'
                : 'Saving...'
              : language === 'bn'
              ? 'সেভ প্রোফাইল'
              : 'Save Profile'}
          </span>
        </button>
      </div>
    </header>
  );
};
