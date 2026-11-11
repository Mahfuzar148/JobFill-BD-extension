import React, { useState, useEffect } from 'react';
import { Sidebar, DashboardTab } from './components/Sidebar';
import { Header } from './components/Header';
import { OnboardingModal } from './components/OnboardingModal';
import { AppProvider, useApp } from './context/AppContext';

// Profile Pages
import { OverviewPage } from './pages/OverviewPage';
import { PersonalInfoPage } from './pages/PersonalInfoPage';
import { FamilyInfoPage } from './pages/FamilyInfoPage';
import { AddressPage } from './pages/AddressPage';
import { EducationPage } from './pages/EducationPage';
import { AdditionalQualPage } from './pages/AdditionalQualPage';
import { ExperiencePage } from './pages/ExperiencePage';
import { DocumentsPage } from './pages/DocumentsPage';

// Automation Pages
import { SmartAutoFillPage } from './pages/SmartAutoFillPage';
import { SavedMappingsPage } from './pages/SavedMappingsPage';
import { ApplicationHistoryPage } from './pages/ApplicationHistoryPage';

// Preferences & System Pages
import { PreferencesPage } from './pages/PreferencesPage';
import { SecurityPage } from './pages/SecurityPage';
import { SettingsPage } from './pages/SettingsPage';
import { HelpSupportPage } from './pages/HelpSupportPage';

// Job Circular Hub Pages
import { JobCircularPage } from '../jobs/dashboard/JobCircularPage';
import { JobSearchPage } from '../jobs/dashboard/JobSearchPage';
import { GovtOrganizationsPage } from '../jobs/dashboard/GovtOrganizationsPage';
import { OfficialJobPortalsPage } from '../jobs/dashboard/OfficialJobPortalsPage';
import { NotificationCenterPage } from '../jobs/dashboard/NotificationCenterPage';
import { ApplicationTracker } from '../jobs/dashboard/ApplicationTracker';
import { JobRepository } from '../jobs/database/job-repository';
import { JobNotificationRepository } from '../jobs/database/notification-repository';
import { ApplicationRepository } from '../jobs/database/application-repository';
import { NotificationScheduler } from '../jobs/notifications/notification-scheduler';
import { JobAlarmManager } from '../jobs/background/alarm-manager';
import { ApplicationTrackerRecord } from '../jobs/types/job.types';
import { DAY_MS } from '../jobs/services/deadline-parser';

import { UserProfile } from '../types/profile';
import { createEmptyProfile, sampleDemoProfile } from '../types/defaults';
import {
  getAllProfiles,
  getActiveProfile,
  setActiveProfileId,
  saveActiveProfile,
  saveAllProfiles,
  calculateProfileScore,
  getSecuritySettings,
  unlockVault,
  lockVault,
  recordActivity,
  checkAutoLock,
} from '../services/storage';
import { KeyManager } from '../security/key-manager';
import { MigrationManager } from '../database/migration-manager';

const VALID_TABS: DashboardTab[] = [
  'overview',
  'search',
  'circulars',
  'govt_orgs',
  'portals',
  'notifications',
  'tracker',
  'personal',
  'family',
  'address',
  'education',
  'additional',
  'experience',
  'documents',
  'autofill',
  'mappings',
  'history',
  'preferences',
  'security',
  'settings',
  'help',
];

function parseInitialDashboardRoute(): { tab: DashboardTab; jobId: string | null } {
  try {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tab') as DashboardTab | null;
    const j = params.get('jobId');
    return {
      tab: t && VALID_TABS.includes(t) ? t : 'overview',
      jobId: j || null,
    };
  } catch {
    return { tab: 'overview', jobId: null };
  }
}

const DashboardContent: React.FC = () => {
  const { showOnboarding, setShowOnboarding, toast, showToast, language } = useApp();
  const initialRoute = parseInitialDashboardRoute();
  const [activeTab, setActiveTab] = useState<DashboardTab>(initialRoute.tab);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(initialRoute.jobId);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [closingSoonCount, setClosingSoonCount] = useState(0);
  const [trackerRecords, setTrackerRecords] = useState<ApplicationTrackerRecord[]>([]);
  const initialDefaultProfiles: UserProfile[] = (typeof __JOBFILL_STORE_CLEAN__ !== 'undefined' && __JOBFILL_STORE_CLEAN__)
    ? [createEmptyProfile('My Job Profile')]
    : [sampleDemoProfile];
  const [profiles, setProfiles] = useState<UserProfile[]>(initialDefaultProfiles);
  const [currentProfile, setCurrentProfile] = useState<UserProfile>(initialDefaultProfiles[0]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Security Lock
  const [isLocked, setIsLocked] = useState(false);
  const [isVaultProtected, setIsVaultProtected] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');

  const refreshJobHubStats = async () => {
    try {
      const [unread, jobs, apps] = await Promise.all([
        JobNotificationRepository.getUnreadCount(),
        JobRepository.getAllJobs(),
        ApplicationRepository.getAll(),
      ]);
      const now = Date.now();
      const soon = jobs.filter(
        (j) =>
          j.deadlineVerified &&
          typeof j.deadlineAt === 'number' &&
          j.deadlineAt > now &&
          j.deadlineAt - now <= 7 * DAY_MS
      ).length;
      setUnreadNotifCount(unread);
      setClosingSoonCount(soon);
      setTrackerRecords(apps);
    } catch {
      // safe fallback
    }
  };

  useEffect(() => {
    initApp();
    refreshJobHubStats();

    // Listen for navigation messages from desktop notifications or popup
    const msgListener = (msg: any) => {
      if (msg?.action === 'NAVIGATE_DASHBOARD_TAB' && msg?.payload?.tab) {
        if (VALID_TABS.includes(msg.payload.tab)) {
          setActiveTab(msg.payload.tab);
        }
        if (msg.payload.jobId) {
          setSelectedJobId(msg.payload.jobId);
        }
      }
    };
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(msgListener);
    }

    // Inactivity check every minute + instant check on tab focus/visibility return + throttled user activity tracking
    const engageLockState = () => {
      setIsLocked(true);
      const lockedProfile = createEmptyProfile('Vault Locked');
      setProfiles([lockedProfile]);
      setCurrentProfile(lockedProfile);
    };
    const checkLockNow = async () => {
      const locked = await checkAutoLock();
      if (locked) engageLockState();
    };
    const interval = setInterval(checkLockNow, 60000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void checkLockNow();
      }
    };
    let lastActivityRecordedAt = 0;
    const onUserActivity = () => {
      const now = Date.now();
      if (now - lastActivityRecordedAt >= 15000) {
        lastActivityRecordedAt = now;
        recordActivity();
      }
    };
    window.addEventListener('focus', checkLockNow);
    window.addEventListener('pointerdown', onUserActivity, { passive: true });
    window.addEventListener('keydown', onUserActivity, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', checkLockNow);
      window.removeEventListener('pointerdown', onUserActivity);
      window.removeEventListener('keydown', onUserActivity);
      document.removeEventListener('visibilitychange', onVisibility);
      if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.removeListener(msgListener);
      }
    };
  }, []);

  const initApp = async () => {
    try {
      const sec = await getSecuritySettings();
      setIsVaultProtected(Boolean(sec.isPasswordProtected));
      if (sec.isPasswordProtected) {
        if (!KeyManager.isKeyActive()) {
          setIsLocked(true);
          return;
        }
      }
      const existingMig = await MigrationManager.getLatestReport();
      if (!existingMig) {
        await MigrationManager.runSafeMigration();
      }
      await refreshData();
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg === 'VAULT_LOCKED' || msg.startsWith('VAULT_LOCKED:')) {
        setIsLocked(true);
      } else if (msg.startsWith('VAULT_')) {
        showToast(
          language === 'bn'
            ? '⚠️ এনক্রিপ্টেড ভল্টে সমস্যা হয়েছে। Security ট্যাব থেকে ব্যাকআপ পুনরুদ্ধার করুন।'
            : `⚠️ Encrypted Vault Error: ${msg}`
        );
      }
    }
  };

  const handleManualLock = () => {
    lockVault();
    const lockedProfile = createEmptyProfile('Vault Locked');
    setProfiles([lockedProfile]);
    setCurrentProfile(lockedProfile);
    setHasUnsavedChanges(false);
    setUnlockPassword('');
    setUnlockError('');
    setIsLocked(true);
    showToast(language === 'bn' ? '🔒 ভল্ট নিরাপদভাবে লক করা হয়েছে!' : '🔒 Vault locked securely!');
  };

  const refreshData = async () => {
    const all = await getAllProfiles();
    setProfiles(all);
    const active = await getActiveProfile();
    setCurrentProfile(active);
    setHasUnsavedChanges(false);
  };

  const handleUnlock = async () => {
    setUnlockError('');
    const ok = await unlockVault(unlockPassword);
    if (ok) {
      setIsLocked(false);
      setUnlockPassword('');
      await refreshData();
      showToast(language === 'bn' ? '🔓 ভল্ট সফলভাবে আনলক হয়েছে!' : '🔓 Vault unlocked successfully!');
    } else {
      setUnlockError(language === 'bn' ? 'পাসওয়ার্ড ভুল হয়েছে! আবার চেষ্টা করুন।' : 'Incorrect password! Try again.');
    }
  };

  const handleSelectProfile = async (id: string) => {
    if (hasUnsavedChanges) {
      const ok = confirm(
        language === 'bn'
          ? 'আপনার সাম্প্রতিক পরিবর্তনগুলো সেভ করা হয়নি। প্রোফাইল পরিবর্তন করবেন?'
          : 'You have unsaved changes. Discard and switch profile?'
      );
      if (!ok) return;
    }
    const found = profiles.find((p) => p.id === id);
    if (found) {
      await setActiveProfileId(found.id);
      setCurrentProfile(found);
      setHasUnsavedChanges(false);
    }
  };

  const handleCreateProfile = async () => {
    const name = prompt(
      language === 'bn' ? 'নতুন প্রার্থীর প্রোফাইলের নাম লিখুন:' : 'Enter new profile name:',
      'Candidate Profile'
    );
    if (!name) return;

    const newProf = createEmptyProfile(name);
    const updated = [...profiles, newProf];
    await saveAllProfiles(updated);
    await setActiveProfileId(newProf.id);
    setProfiles(updated);
    setCurrentProfile(newProf);
    setHasUnsavedChanges(false);
    showToast(language === 'bn' ? `✅ "${name}" প্রোফাইল তৈরি হয়েছে!` : `✅ "${name}" profile created!`);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveActiveProfile(currentProfile);
      setHasUnsavedChanges(false);
      const idx = profiles.findIndex((p) => p.id === currentProfile.id);
      if (idx >= 0) {
        profiles[idx] = currentProfile;
        setProfiles([...profiles]);
      }
      showToast(language === 'bn' ? '💾 সমস্ত তথ্য সফলভাবে সংরক্ষিত হয়েছে!' : '💾 All profile data saved securely!');
    } catch (err: any) {
      alert('Error saving data: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Updaters for profile sections
  const updatePersonal = (updated: any) => {
    setCurrentProfile((prev) => ({
      ...prev,
      personal: { ...prev.personal, ...updated },
    }));
    setHasUnsavedChanges(true);
  };

  const updateAddress = (updated: any) => {
    setCurrentProfile((prev) => ({
      ...prev,
      address: { ...prev.address, ...updated },
    }));
    setHasUnsavedChanges(true);
  };

  const updateSSC = (updated: any) => {
    setCurrentProfile((prev) => ({
      ...prev,
      ssc: { ...prev.ssc, ...updated },
    }));
    setHasUnsavedChanges(true);
  };

  const updateHSC = (updated: any) => {
    setCurrentProfile((prev) => ({
      ...prev,
      hsc: { ...prev.hsc, ...updated },
    }));
    setHasUnsavedChanges(true);
  };

  const updateGrad = (updated: any) => {
    setCurrentProfile((prev) => ({
      ...prev,
      graduation: { ...prev.graduation, ...updated },
    }));
    setHasUnsavedChanges(true);
  };

  const updateMasters = (updated: any) => {
    setCurrentProfile((prev) => ({
      ...prev,
      masters: { ...prev.masters, ...updated },
    }));
    setHasUnsavedChanges(true);
  };

  const score = calculateProfileScore(currentProfile);

  if (isLocked) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 text-center space-y-4">
          <div className="w-16 h-16 bg-petro-100 dark:bg-petro-950 text-petro-700 dark:text-petro-400 rounded-full flex items-center justify-center mx-auto text-2xl shadow-sm">
            🔒
          </div>
          <h2 className="text-xl font-black text-slate-800 dark:text-white">JobFill BD Vault Locked</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {language === 'bn'
              ? 'আপনার সংবেদনশীল তথ্য লোকাল এনক্রিপশনে সুরক্ষিত। প্রোফাইল আনলক করতে মাস্টার পাসওয়ার্ড দিন।'
              : 'Your sensitive data is locally encrypted. Enter your master password to unlock.'}
          </p>

          <div className="space-y-3 pt-2">
            <input
              type="password"
              placeholder="Enter Master Password"
              value={unlockPassword}
              onChange={(e) => setUnlockPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
              className="w-full text-center text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl p-3 focus:border-petro-600 focus:ring-2 focus:ring-petro-500/30"
              autoFocus
            />

            {unlockError && <div className="text-xs text-rose-600 font-semibold">{unlockError}</div>}

            <button
              onClick={handleUnlock}
              className="w-full bg-petro-600 hover:bg-petro-700 text-white font-bold py-3 rounded-xl transition-all shadow-md shadow-petro-600/30 text-sm cursor-pointer"
            >
              {language === 'bn' ? 'ভল্ট আনলক করুন' : 'Unlock Profile Vault'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab !== 'circulars' && tab !== 'search') setSelectedJobId(null);
          refreshJobHubStats();
        }}
        completionScore={score.percentage}
        unreadNotificationsCount={unreadNotifCount}
        closingSoonCount={closingSoonCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          activeTab={activeTab}
          onNavigateTab={(tab) => {
            setActiveTab(tab);
            if (tab !== 'circulars' && tab !== 'search') setSelectedJobId(null);
            refreshJobHubStats();
          }}
          currentProfile={currentProfile}
          allProfiles={profiles}
          onSelectProfile={handleSelectProfile}
          onCreateProfile={handleCreateProfile}
          onSave={handleSave}
          hasUnsavedChanges={hasUnsavedChanges}
          isSaving={isSaving}
          isLocked={isLocked}
          isVaultProtected={isVaultProtected}
          onLockVault={handleManualLock}
        />

        <main className="flex-1 overflow-y-auto p-6 max-w-5xl w-full mx-auto">
          {/* Overview */}
          {activeTab === 'overview' && (
            <OverviewPage profile={currentProfile} onNavigateTab={setActiveTab} />
          )}

          {/* Job Circular Hub */}
          {activeTab === 'search' && (
            <JobSearchPage
              initialSelectedJobId={selectedJobId}
              onDataChanged={refreshJobHubStats}
            />
          )}
          {activeTab === 'circulars' && (
            <JobCircularPage
              initialSelectedJobId={selectedJobId}
              onNavigateNotifications={() => setActiveTab('notifications')}
              onNavigateTracker={() => setActiveTab('tracker')}
              onNavigateSettings={() => setActiveTab('settings')}
              onNavigatePortals={() => setActiveTab('portals')}
              onDataChanged={refreshJobHubStats}
            />
          )}
          {activeTab === 'govt_orgs' && (
            <GovtOrganizationsPage onDataChanged={refreshJobHubStats} />
          )}
          {activeTab === 'portals' && <OfficialJobPortalsPage />}
          {activeTab === 'notifications' && (
            <NotificationCenterPage
              language={language}
              onOpenJobDetails={(jobId) => {
                setSelectedJobId(jobId);
                setActiveTab('circulars');
              }}
              onOpenSettings={() => setActiveTab('settings')}
              onNotificationsChanged={refreshJobHubStats}
              showToast={showToast}
            />
          )}
          {activeTab === 'tracker' && (
            <ApplicationTracker
              records={trackerRecords}
              language={language}
              onUpdateRecord={async (rec) => {
                await ApplicationRepository.upsert(rec);
                await JobAlarmManager.scheduleFeePaymentReminder(rec);
                if (['Applied', 'Exam Scheduled', 'Result Published', 'Rejected', 'Selected'].includes(rec.status)) {
                  await NotificationScheduler.markJobAsApplied(rec.jobId, true);
                  await NotificationScheduler.runCycle();
                }
                await refreshJobHubStats();
                showToast(language === 'bn' ? '✅ আবেদন স্ট্যাটাস আপডেট হয়েছে' : '✅ Application tracker updated');
              }}
              onDeleteRecord={async (jobId) => {
                await ApplicationRepository.remove(jobId);
                await JobAlarmManager.clearFeePaymentReminder(jobId);
                await refreshJobHubStats();
                showToast(language === 'bn' ? 'ট্র্যাকার রেকর্ড সরানো হয়েছে' : 'Tracker record removed');
              }}
              onOpenJob={(jobId) => {
                setSelectedJobId(jobId);
                setActiveTab('circulars');
              }}
            />
          )}

          {/* Profile Details */}
          {activeTab === 'personal' && (
            <PersonalInfoPage profile={currentProfile} onChange={updatePersonal} />
          )}
          {activeTab === 'family' && (
            <FamilyInfoPage profile={currentProfile} onChange={updatePersonal} />
          )}
          {activeTab === 'address' && (
            <AddressPage profile={currentProfile} onChange={updateAddress} />
          )}
          {activeTab === 'education' && (
            <EducationPage
              profile={currentProfile}
              onChangeSSC={updateSSC}
              onChangeHSC={updateHSC}
              onChangeGrad={updateGrad}
              onChangeMasters={updateMasters}
              onToggleGraduation={(has) => {
                setCurrentProfile((p) => ({ ...p, hasGraduation: has }));
                setHasUnsavedChanges(true);
              }}
              onToggleMasters={(has) => {
                setCurrentProfile((p) => ({ ...p, hasMasters: has }));
                setHasUnsavedChanges(true);
              }}
            />
          )}
          {activeTab === 'additional' && (
            <AdditionalQualPage
              profile={currentProfile}
              onChange={(quals) => {
                setCurrentProfile((p) => ({ ...p, additionalQualifications: quals }));
                setHasUnsavedChanges(true);
              }}
            />
          )}
          {activeTab === 'experience' && (
            <ExperiencePage
              profile={currentProfile}
              onChange={(jobs) => {
                setCurrentProfile((p) => ({ ...p, jobExperiences: jobs }));
                setHasUnsavedChanges(true);
              }}
              onToggleHasExperience={(has) => {
                setCurrentProfile((p) => ({ ...p, hasJobExperience: has }));
                setHasUnsavedChanges(true);
              }}
            />
          )}
          {activeTab === 'documents' && (
            <DocumentsPage
              profile={currentProfile}
              onChangeProfile={(p) => {
                setCurrentProfile(p);
                setHasUnsavedChanges(true);
              }}
              showToast={showToast}
            />
          )}

          {/* Automation Engine */}
          {activeTab === 'autofill' && <SmartAutoFillPage />}
          {activeTab === 'mappings' && <SavedMappingsPage />}
          {activeTab === 'history' && (
            <ApplicationHistoryPage showToast={showToast} />
          )}

          {/* Preferences & System */}
          {activeTab === 'preferences' && (
            <PreferencesPage
              profile={currentProfile}
              onChangeSpecial={(s) => {
                setCurrentProfile((p) => ({ ...p, special: { ...p.special, ...s } }));
                setHasUnsavedChanges(true);
              }}
              onChangeReferences={(r) => {
                setCurrentProfile((p) => ({ ...p, references: r }));
                setHasUnsavedChanges(true);
              }}
            />
          )}
          {activeTab === 'security' && (
            <SecurityPage
              showToast={showToast}
              onDataReset={refreshData}
              onLockVault={handleManualLock}
              onProtectionChanged={setIsVaultProtected}
            />
          )}
          {activeTab === 'settings' && (
            <SettingsPage showToast={showToast} onDataReset={refreshData} />
          )}
          {activeTab === 'help' && (
            <HelpSupportPage showToast={showToast} />
          )}
        </main>
      </div>

      {/* Onboarding Wizard Modal */}
      {showOnboarding && <OnboardingModal />}

      {/* Floating Global Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-bold border border-slate-700 animate-bounce">
          <span>🔔</span>
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
};

export const DashboardApp: React.FC = () => {
  return (
    <AppProvider>
      <DashboardContent />
    </AppProvider>
  );
};
