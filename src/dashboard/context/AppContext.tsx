// JobFill BD - App Context & Localization System
// Manages global language ('bn' | 'en'), theme ('light' | 'dark'),
// active profiles, search query, and toast notifications.

import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '../../types/profile';
import { createEmptyProfile, sampleDemoProfile } from '../../types/defaults';
import {
  getAllProfiles,
  getActiveProfile,
  saveActiveProfile,
} from '../../services/storage';

export type Language = 'bn' | 'en';
export type Theme = 'light' | 'dark';

export interface AppContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  profiles: UserProfile[];
  activeProfile: UserProfile;
  setActiveProfile: (p: UserProfile) => void;
  refreshProfiles: () => Promise<void>;
  saveCurrentProfile: (p?: UserProfile) => Promise<void>;
  isVaultLocked: boolean;
  setIsVaultLocked: (locked: boolean) => void;
  showOnboarding: boolean;
  setShowOnboarding: (show: boolean) => void;
  toast: string | null;
  showToast: (msg: string) => void;
  t: (key: string) => string;
}

const TRANSLATIONS: Record<string, { en: string; bn: string }> = {
  // Navigation
  'nav.overview': { en: 'Dashboard', bn: 'ড্যাশবোর্ড' },
  'nav.profile': { en: 'PROFILE', bn: 'প্রোফাইল' },
  'nav.personal': { en: 'Personal Information', bn: 'ব্যক্তিগত তথ্য' },
  'nav.family': { en: 'Family Information', bn: 'পারিবারিক তথ্য' },
  'nav.address': { en: 'Address Details', bn: 'ঠিকানা' },
  'nav.education': { en: 'Educational Qualifications', bn: 'শিক্ষাগত যোগ্যতা' },
  'nav.experience': { en: 'Job Experience', bn: 'চাকরির অভিজ্ঞতা' },
  'nav.additional': { en: 'Additional Qualifications', bn: 'অতিরিক্ত যোগ্যতা' },
  'nav.documents': { en: 'Documents & Photos', bn: 'ডকুমেন্টস ও ছবি' },
  'nav.automation': { en: 'AUTOMATION', bn: 'অটোমেশন' },
  'nav.autofill': { en: 'Smart Auto Fill', bn: 'স্মার্ট অটো-ফিল' },
  'nav.mappings': { en: 'Saved Mappings', bn: 'সংরক্ষিত ম্যাপিং' },
  'nav.history': { en: 'Application History', bn: 'আবেদনের হিস্ট্রি' },
  'nav.preferences': { en: 'PREFERENCES', bn: 'পছন্দ ও সেটিংস' },
  'nav.security': { en: 'Security & Privacy', bn: 'নিরাপত্তা ও ভল্ট' },
  'nav.settings': { en: 'Settings', bn: 'সেটিংস' },
  'nav.help': { en: 'Help & Support', bn: 'সাহায্য ও গাইড' },

  // Header & Controls
  'header.search': { en: 'Search profile fields...', bn: 'প্রোফাইল ফিল্ড খুঁজুন...' },
  'header.save': { en: 'Save Profile', bn: 'প্রোফাইল সংরক্ষণ' },
  'header.saving': { en: 'Saving...', bn: 'সংরক্ষণ হচ্ছে...' },
  'header.vaultLocked': { en: 'Vault Locked', bn: 'ভল্ট লক করা' },
  'header.vaultUnlocked': { en: 'Vault Unlocked', bn: 'ভল্ট খোলা' },
  'header.switchProfile': { en: 'Switch Profile', bn: 'প্রোফাইল পরিবর্তন' },

  // Overview Page
  'overview.welcome': { en: 'Welcome to JobFill BD', bn: 'JobFill BD-তে স্বাগতম' },
  'overview.tagline': { en: 'Smart Bangladesh Government Job Application Assistant', bn: 'স্মার্ট বাংলাদেশ সরকারি চাকরি আবেদন সহকারী' },
  'overview.readiness': { en: 'Profile Readiness', bn: 'প্রোফাইল প্রস্তুতি' },
  'overview.quickScan': { en: 'Scan Current Form', bn: 'বর্তমান ফর্ম স্ক্যান করুন' },
  'overview.editProfile': { en: 'Edit Profile', bn: 'প্রোফাইল এডিট' },
  'overview.manageDocs': { en: 'Manage Documents', bn: 'ডকুমেন্টস পরিচালনা' },
  'overview.appHistory': { en: 'View History', bn: 'হিস্ট্রি দেখুন' },
  'overview.compatibility': { en: 'Recruitment Portal Compatibility', bn: 'চাকরির পোর্টাল সামঞ্জস্য' },
  'overview.recentActivity': { en: 'Recent Autofill Activity', bn: 'সাম্প্রতিক অটোফিল কার্যক্রম' },
};

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('jobfill_language') as Language) || 'bn';
  });

  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem('jobfill_theme') as Theme) || 'light';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const initialContextProfile: UserProfile = (typeof __JOBFILL_STORE_CLEAN__ !== 'undefined' && __JOBFILL_STORE_CLEAN__)
    ? createEmptyProfile('My Job Profile')
    : sampleDemoProfile;
  const [profiles, setProfiles] = useState<UserProfile[]>([initialContextProfile]);
  const [activeProfile, setActiveProfileState] = useState<UserProfile>(initialContextProfile);
  const [isVaultLocked, setIsVaultLocked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('jobfill_onboarded');
  });
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    // Apply theme to document
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('jobfill_theme', theme);
  }, [theme]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('jobfill_language', lang);
  };

  const setTheme = (t: Theme) => {
    setThemeState(t);
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  const refreshProfiles = async () => {
    try {
      const all = await getAllProfiles();
      if (all && all.length > 0) {
        setProfiles(all);
        const active = await getActiveProfile();
        setActiveProfileState(active);
      }
    } catch (e: any) {
      if (e.message === 'VAULT_LOCKED') {
        setIsVaultLocked(true);
      }
    }
  };

  const saveCurrentProfile = async (p?: UserProfile) => {
    const toSave = p || activeProfile;
    await saveActiveProfile(toSave);
    setActiveProfileState(toSave);
    showToast(language === 'bn' ? '✅ প্রোফাইল সফলভাবে সংরক্ষিত হয়েছে!' : '✅ Profile saved successfully!');
    await refreshProfiles();
  };

  const t = (key: string): string => {
    const entry = TRANSLATIONS[key];
    if (!entry) return key;
    return entry[language] || entry.en || key;
  };

  useEffect(() => {
    refreshProfiles();
  }, []);

  return (
    <AppContext.Provider
      value={{
        language,
        setLanguage,
        theme,
        setTheme,
        toggleTheme,
        searchQuery,
        setSearchQuery,
        profiles,
        activeProfile,
        setActiveProfile: setActiveProfileState,
        refreshProfiles,
        saveCurrentProfile,
        isVaultLocked,
        setIsVaultLocked,
        showOnboarding,
        setShowOnboarding,
        toast,
        showToast,
        t,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
