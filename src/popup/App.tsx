import React, { useState, useEffect } from 'react';
import { WebsiteDetectionCard, DetectionState } from './components/WebsiteDetectionCard';
import { ScanSummary } from './components/ScanSummary';
import { AutoFillButton } from './components/AutoFillButton';
import { FillProgress } from './components/FillProgress';
import { FillReport, FillReportData } from './components/FillReport';
import { UserProfile } from '../types/profile';
import { createEmptyProfile } from '../types/defaults';
import { Shield, Lock, ExternalLink, Camera, Megaphone, Bell, Search, Building2, Globe } from 'lucide-react';
import { JobNotificationRepository } from '../jobs/database/notification-repository';
import { JobRepository } from '../jobs/database/job-repository';
import { DAY_MS } from '../jobs/services/deadline-parser';
import { canRequestCustomPortalPermission, isExcludedSiteUrl } from '../security/site-policy';
import { recordExtensionDiagnostic } from '../security/diagnostics';
import { PermissionManager } from '../background/permission-manager';

export const App: React.FC = () => {
  const [detection, setDetection] = useState<DetectionState>({ status: 'loading' });
  const [activeProfile, setActiveProfile] = useState<UserProfile>(() => createEmptyProfile('My Job Profile'));
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]);
  const [isVaultLocked, setIsVaultLocked] = useState(false);
  const [totalDetected, setTotalDetected] = useState(0);
  const [matchedCount, setMatchedCount] = useState(0);
  const [readyToFillCount, setReadyToFillCount] = useState(0);
  const [alreadyCorrectCount, setAlreadyCorrectCount] = useState(0);
  const [missingInfoCount, setMissingInfoCount] = useState(0);
  const [conflictsCount, setConflictsCount] = useState(0);
  const [ambiguousCount, setAmbiguousCount] = useState(0);
  const [documentFieldCount, setDocumentFieldCount] = useState(0);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [activeTabUrl, setActiveTabUrl] = useState<string>('');
  const [needsHostPermission, setNeedsHostPermission] = useState(false);
  const [isGrantingPermission, setIsGrantingPermission] = useState(false);

  const [isFilling, setIsFilling] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [isToolbarDismissed, setIsToolbarDismissed] = useState(false);
  const [isTogglingToolbar, setIsTogglingToolbar] = useState(false);
  const [fillReport, setFillReport] = useState<FillReportData | null>(null);
  const [unreadAlertsCount, setUnreadAlertsCount] = useState(0);
  const [closingSoonCount, setClosingSoonCount] = useState(0);

  useEffect(() => {
    loadProfiles();
    scanActiveTab();
    loadJobHubSummary();
  }, []);

  const loadJobHubSummary = async () => {
    try {
      const [unread, jobs] = await Promise.all([
        JobNotificationRepository.getUnreadCount(),
        JobRepository.getAllJobs(),
      ]);
      const now = Date.now();
      const soon = jobs.filter(
        (j) =>
          j.deadlineVerified &&
          typeof j.deadlineAt === 'number' &&
          j.deadlineAt > now &&
          j.deadlineAt - now <= 7 * DAY_MS
      ).length;
      setUnreadAlertsCount(unread);
      setClosingSoonCount(soon);
    } catch {
      // safe fallback
    }
  };

  const loadProfiles = () => {
    const readLocalFallback = () => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(
          ['jobfill_profiles', 'jobfill_active_profile_id', 'jobfill_security_settings'],
          (res) => {
            const sec = res.jobfill_security_settings;
            if (sec?.isPasswordProtected) {
              setIsVaultLocked(true);
              setAllProfiles([]);
              setActiveProfile(createEmptyProfile('Vault Locked'));
              return;
            }
            setIsVaultLocked(false);
            const profiles: UserProfile[] = res.jobfill_profiles || [];
            setAllProfiles(profiles);
            const activeId = res.jobfill_active_profile_id;
            const found = profiles.find((p) => p.id === activeId);
            if (found) {
              setActiveProfile(found);
            } else if (profiles.length > 0) {
              setActiveProfile(profiles[0]);
            }
          }
        );
      }
    };

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage && chrome.runtime?.id) {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          readLocalFallback();
        }
      }, 250);
      try {
        chrome.runtime.sendMessage({ action: 'GET_ACTIVE_PROFILE_STATE' }, (stateRes) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (!chrome.runtime.lastError && stateRes) {
            if (stateRes.status === 'ok' && stateRes.activeProfile) {
              setIsVaultLocked(false);
              setAllProfiles(stateRes.profiles || [stateRes.activeProfile]);
              setActiveProfile(stateRes.activeProfile);
              return;
            }
            if (stateRes.status === 'locked') {
              setIsVaultLocked(true);
              setAllProfiles([]);
              setActiveProfile(createEmptyProfile('Vault Locked'));
              return;
            }
          }
          readLocalFallback();
        });
        return;
      } catch {
        settled = true;
        clearTimeout(timer);
      }
    }

    readLocalFallback();
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = allProfiles.find((p) => p.id === e.target.value);
    if (selected) {
      setActiveProfile(selected);
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ jobfill_active_profile_id: selected.id }, () => {
          scanActiveTab();
        });
      }
    }
  };

  const scanActiveTab = async () => {
    setFillReport(null);
    setDetection({ status: 'loading' });

    if (typeof chrome === 'undefined' || !chrome.tabs) {
      // Dev preview fallback
      setDetection({
        status: 'supported',
        organization: 'Bangladesh Oil, Gas and Mineral Corporation (Petrobangla)',
        platform: 'Teletalk Bangladesh',
        pageType: 'Application Form',
        urlHost: 'bogmc.teletalk.com.bd',
      });
      setTotalDetected(27);
      setMatchedCount(25);
      setReadyToFillCount(21);
      setAlreadyCorrectCount(2);
      setMissingInfoCount(1);
      setConflictsCount(0);
      setAmbiguousCount(0);
      return;
    }

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id || !tab.url) {
        setDetection({ status: 'not_detected', message: 'No active tab found' });
        return;
      }

      setActiveTabId(tab.id);
      setActiveTabUrl(tab.url);
      setNeedsHostPermission(false);

      let urlObj: URL | null = null;
      try {
        urlObj = new URL(tab.url);
      } catch {
        // file or invalid url
      }

      // Check restricted and excluded media/conferencing URLs (e.g., Google Meet, Zoom, YouTube, chrome://)
      if (isExcludedSiteUrl(tab.url)) {
        recordExtensionDiagnostic('excluded_site_detected', {
          url: tab.url,
          source: 'popup.scanActiveTab',
        });
        recordExtensionDiagnostic('script_injection_blocked', {
          url: tab.url,
          source: 'popup.scanActiveTab',
        });
        setDetection({
          status: 'restricted',
          urlHost: urlObj?.hostname || 'restricted',
          message: 'JobFill BD stays disabled on Google Meet, Zoom, media sites, and internal browser pages.',
        });
        return;
      }

      // Communicate with content script (injected dynamically ONLY on explicit Popup trigger via activeTab)
      let response: any = null;
      try {
        response = await chrome.tabs.sendMessage(tab.id, { action: 'DETECT_FORM' });
      } catch (e) {
        // Content script might not be injected yet on custom/non-listed career sites -> inject on explicit user action
        if (!isExcludedSiteUrl(tab.url) && chrome.scripting) {
          try {
            recordExtensionDiagnostic('script_injection_allowed', {
              url: tab.url,
              source: 'popup.executeScript',
            });
            await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['content.css'] });
            await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
            await new Promise((r) => setTimeout(r, 200));
            response = await chrome.tabs.sendMessage(tab.id, { action: 'DETECT_FORM' });
          } catch (scriptErr) {
            console.warn('Script injection skipped:', scriptErr);
          }
        }
      }

      if (!response && canRequestCustomPortalPermission(tab.url)) {
        const hasPerm = await PermissionManager.hasHostPermission(tab.url);
        setNeedsHostPermission(!hasPerm);
      }

      if (response && response.status === 'ok') {
        setIsToolbarDismissed(Boolean(response.toolbarDismissed));
        if (response.hasJobForm) {
          setDetection({
            status: 'supported',
            organization: response.organization || 'Bangladesh Government Organization',
            platform: response.platform || 'Teletalk',
            pageType: response.pageTitle || 'Application Form',
            urlHost: urlObj?.hostname || 'Web Form',
          });
          setTotalDetected(response.totalDetected || 0);
          setMatchedCount(response.matchedCount || response.totalMatchable || 0);
          setReadyToFillCount(response.readyToFillCount || response.totalMatchable || 0);
          setAlreadyCorrectCount(response.alreadyCorrectCount || 0);
          setMissingInfoCount(response.missingInfoCount || 0);
          setConflictsCount(response.conflictsCount || 0);
          setAmbiguousCount(response.ambiguousCount || 0);
          setDocumentFieldCount(response.documentFieldCount || 0);
        } else {
          setDetection({
            status: 'not_detected',
            urlHost: urlObj?.hostname,
            message: 'No supported job application form detected on this page.',
          });
        }
      } else {
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage && tab.id) {
          chrome.runtime.sendMessage(
            { action: 'GET_TAB_TOOLBAR_STATE', payload: { tabId: tab.id } },
            (tbRes) => {
              if (!chrome.runtime?.lastError && tbRes?.status === 'ok') {
                setIsToolbarDismissed(Boolean(tbRes.dismissed));
              }
            }
          );
        }
        const host = urlObj?.hostname || '';
        if (host.includes('bogmc.teletalk.com.bd') || host.includes('teletalk.com.bd')) {
          setDetection({
            status: 'adapter_required',
            organization: 'Bangladesh Oil, Gas and Mineral Corporation (Petrobangla)',
            platform: 'Teletalk',
            urlHost: host,
          });
        } else {
          setDetection({
            status: 'not_detected',
            urlHost: host,
          });
        }
      }
    } catch (err: any) {
      console.error('Scan error:', err);
      setDetection({ status: 'not_detected', message: err.message });
    }
  };

  const handleAutoFill = async () => {
    if (detection.status === 'restricted') return;
    if (!activeTabId && typeof chrome !== 'undefined') return;
    setIsFilling(true);

    if (typeof chrome === 'undefined' || !chrome.tabs) {
      setTimeout(() => {
        setIsFilling(false);
        setFillReport({
          successfullyFilled: 21,
          alreadyCorrect: 2,
          missingInfo: 1,
          ambiguous: 0,
          conflicts: 0,
          failed: 0,
        });
      }, 800);
      return;
    }

    try {
      const res = await chrome.tabs.sendMessage(activeTabId!, { action: 'AUTO_FILL_NOW' });
      setIsFilling(false);
      if (res && res.status === 'ok' && res.report) {
        setFillReport(res.report);
      } else {
        alert('Could not complete autofill: ' + (res?.error || 'Unknown error'));
      }
    } catch (e: any) {
      setIsFilling(false);
      alert('Error communicating with page: ' + e.message);
    }
  };

  const handleUndo = async () => {
    if (detection.status === 'restricted' || !activeTabId || typeof chrome === 'undefined') return;
    setIsUndoing(true);
    try {
      await chrome.tabs.sendMessage(activeTabId, { action: 'UNDO_LAST_FILL' });
      setIsUndoing(false);
      setFillReport(null);
      scanActiveTab();
    } catch (e) {
      setIsUndoing(false);
    }
  };

  const handleReviewFields = async () => {
    if (detection.status === 'restricted' || !activeTabId || typeof chrome === 'undefined') return;
    try {
      await chrome.tabs.sendMessage(activeTabId, { action: 'OPEN_REVIEW_MODAL' });
      window.close();
    } catch {
      window.close();
    }
  };

  const handleOpenDocumentApproval = async () => {
    if (detection.status === 'restricted' || !activeTabId || typeof chrome === 'undefined') return;
    try {
      await chrome.tabs.sendMessage(activeTabId, { action: 'OPEN_DOCUMENT_APPROVAL' });
      window.close();
    } catch {
      window.close();
    }
  };

  const handleOpenDashboard = (tab?: string) => {
    const suffix = tab ? `?tab=${encodeURIComponent(tab)}` : '';
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url: chrome.runtime.getURL(`dashboard.html${suffix}`) });
    } else {
      window.open(`dashboard.html${suffix}`, '_blank');
    }
  };

  const handleToggleFloatingToolbar = async (show: boolean) => {
    if (detection.status === 'restricted' || !activeTabId || typeof chrome === 'undefined') return;
    setIsTogglingToolbar(true);
    try {
      await new Promise<void>((resolve) => {
        chrome.runtime.sendMessage(
          { action: 'SET_TAB_TOOLBAR_DISMISSED', payload: { tabId: activeTabId, dismissed: !show } },
          () => {
            void chrome.runtime?.lastError;
            resolve();
          }
        );
      });

      const msgAction = show ? 'SHOW_FLOATING_TOOLBAR' : 'HIDE_FLOATING_TOOLBAR';
      try {
        await chrome.tabs.sendMessage(activeTabId, { action: msgAction });
      } catch {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id && tab.url && !isExcludedSiteUrl(tab.url) && chrome.scripting && show) {
          await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['content.css'] });
          await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
          await new Promise((r) => setTimeout(r, 150));
          await chrome.tabs.sendMessage(tab.id, { action: 'SHOW_FLOATING_TOOLBAR' });
        }
      }
      setIsToolbarDismissed(!show);
    } catch {
      // Safe no-op if active tab became restricted or closed
    } finally {
      setIsTogglingToolbar(false);
    }
  };

  const isFormSupported = detection.status === 'supported';

  return (
    <div className="w-[380px] bg-slate-50 text-slate-800 flex flex-col font-sans select-none antialiased">
      {/* 1. Header */}
      <header className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center font-black text-slate-950 text-xs shadow-md shadow-emerald-500/20">
            JB
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-tight leading-none flex items-center gap-1.5">
              <span>JobFill BD</span>
              <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/30">
                v2.0
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 mt-0.5">Smart Government Job Assistant</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleOpenDashboard()}
            className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border cursor-pointer ${
              isVaultLocked
                ? 'bg-amber-950/70 text-amber-300 border-amber-700'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            <Lock className={`w-3 h-3 ${isVaultLocked ? 'text-amber-400' : 'text-emerald-400'}`} />
            <span>{isVaultLocked ? 'Locked' : 'Vault'}</span>
          </button>
        </div>
      </header>

      {/* 2. Main Content */}
      <main className="p-3.5 space-y-3">
        {isVaultLocked && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs text-amber-900">
            <span>🔒 Vault is locked. Unlock Dashboard to autofill.</span>
            <button
              type="button"
              onClick={() => handleOpenDashboard()}
              className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] shrink-0 cursor-pointer"
            >
              Unlock
            </button>
          </div>
        )}
        {/* Profile Selector if multiple */}
        {allProfiles.length > 1 && (
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
            <span className="text-slate-500 font-medium whitespace-nowrap">Profile:</span>
            <select
              value={activeProfile.id}
              onChange={handleProfileChange}
              className="bg-transparent font-bold text-slate-800 outline-none w-full cursor-pointer truncate"
            >
              {allProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.personal.applicantNameEn || p.profileName}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Website Detection Card */}
        <WebsiteDetectionCard detection={detection} />

        {/* Explicit Per-Origin Permission Consent for Custom Portals */}
        {needsHostPermission && canRequestCustomPortalPermission(activeTabUrl) && (
          <div
            data-testid="popup-host-permission-prompt"
            className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs text-emerald-950"
          >
            <div className="leading-snug">
              <div className="font-bold">Portal Permission Needed</div>
              <div className="text-[10.5px] text-emerald-800">
                Allow JobFill BD only on this portal origin to scan form fields.
              </div>
            </div>
            <button
              type="button"
              disabled={isGrantingPermission}
              onClick={async () => {
                if (!canRequestCustomPortalPermission(activeTabUrl)) return;
                setIsGrantingPermission(true);
                try {
                  const granted = await PermissionManager.requestHostPermission(activeTabUrl);
                  if (granted) {
                    setNeedsHostPermission(false);
                    await scanActiveTab();
                  }
                } finally {
                  setIsGrantingPermission(false);
                }
              }}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-[11px] shrink-0 cursor-pointer"
            >
              {isGrantingPermission ? 'Allowing...' : 'Allow Site'}
            </button>
          </div>
        )}

        {/* Per-Tab Floating Toolbar Restore Notice */}
        {detection.status !== 'restricted' && detection.status !== 'loading' && isToolbarDismissed && (
          <div
            data-testid="popup-toolbar-control"
            className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-xs text-amber-900"
          >
            <span className="font-medium leading-tight">Floating toolbar is hidden on this tab</span>
            <button
              type="button"
              data-testid="popup-restore-toolbar-btn"
              disabled={isTogglingToolbar}
              onClick={() => void handleToggleFloatingToolbar(true)}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-[11px] shrink-0 cursor-pointer transition-colors"
            >
              {isTogglingToolbar ? 'Showing...' : 'Show Toolbar'}
            </button>
          </div>
        )}

        {/* Filling Progress */}
        {isFilling && <FillProgress />}

        {/* Completed Report */}
        {fillReport && !isFilling && (
          <FillReport
            report={fillReport}
            onUndo={handleUndo}
            onScanAgain={scanActiveTab}
            onOpenDashboard={() => handleOpenDashboard()}
            isUndoing={isUndoing}
          />
        )}

        {/* Scan Summary & Primary AutoFill Button */}
        {!isFilling && !fillReport && (
          <>
            {isFormSupported && (
              <ScanSummary
                activeProfileName={activeProfile.personal.applicantNameEn || activeProfile.profileName}
                totalDetected={totalDetected}
                matchedCount={matchedCount}
                readyToFillCount={readyToFillCount}
                alreadyCorrectCount={alreadyCorrectCount}
                missingInfoCount={missingInfoCount}
                conflictsCount={conflictsCount}
                ambiguousCount={ambiguousCount}
              />
            )}

            <AutoFillButton
              onAutoFill={handleAutoFill}
              onScanAgain={scanActiveTab}
              onReviewFields={handleReviewFields}
              onOpenDashboard={() => handleOpenDashboard()}
              disabled={!isFormSupported || isVaultLocked}
              isLoading={isFilling}
            />

            {isFormSupported && documentFieldCount > 0 && (
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-sky-900">
                  <Camera className="w-4 h-4 text-sky-600 shrink-0" />
                  <div>
                    <div className="font-bold leading-tight">{documentFieldCount} Document Upload Field(s)</div>
                    <div className="text-[10px] text-sky-700">Photo &amp; Signature require approval</div>
                  </div>
                </div>
                <button
                  onClick={handleOpenDocumentApproval}
                  className="bg-sky-600 hover:bg-sky-700 text-white font-bold px-2.5 py-1.5 rounded-lg text-[11px] shrink-0 cursor-pointer transition-colors"
                >
                  Review Docs
                </button>
              </div>
            )}
          </>
        )}

        {fillReport && !isFilling && documentFieldCount > 0 && (
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-sky-900">
              <Camera className="w-4 h-4 text-sky-600 shrink-0" />
              <div>
                <div className="font-bold leading-tight">Photo &amp; Signature Ready</div>
                <div className="text-[10px] text-sky-700">Approve before attaching files</div>
              </div>
            </div>
            <button
              onClick={handleOpenDocumentApproval}
              className="bg-sky-600 hover:bg-sky-700 text-white font-bold px-2.5 py-1.5 rounded-lg text-[11px] shrink-0 cursor-pointer"
            >
              Approve Upload
            </button>
          </div>
        )}

        {/* Job Circulars Hub Quick Access */}
        <div className="bg-white border border-emerald-200 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-xs">
          <button
            onClick={() => handleOpenDashboard('circulars')}
            className="flex-1 flex items-center gap-2.5 text-left cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:bg-emerald-700 transition-colors">
              <Megaphone className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-extrabold text-slate-800 group-hover:text-emerald-700 flex items-center gap-1.5">
                <span>Job Circulars</span>
                {closingSoonCount > 0 && (
                  <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                    {closingSoonCount} Closing Soon
                  </span>
                )}
              </div>
              <div className="text-[10.5px] text-slate-500 truncate">
                Discover BD jobs, deadlines &amp; alerts
              </div>
            </div>
          </button>

          <button
            onClick={() => handleOpenDashboard('govt_orgs')}
            title="Government Organizations"
            className="px-2 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors shrink-0"
          >
            <Building2 className="w-3.5 h-3.5 text-petro-600" />
            <span>Govt</span>
          </button>

          <button
            onClick={() => handleOpenDashboard('search')}
            title="Search Jobs"
            className="px-2.5 py-2 rounded-lg bg-petro-50 hover:bg-petro-100 text-petro-700 border border-petro-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors shrink-0"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search</span>
          </button>

          <button
            onClick={() => handleOpenDashboard('notifications')}
            title="Job Notification Center"
            className="relative p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer transition-colors"
          >
            <Bell className="w-4 h-4" />
            {unreadAlertsCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[9px] font-black px-1 rounded-full min-w-[16px] text-center">
                {unreadAlertsCount}
              </span>
            )}
          </button>
        </div>

        {/* Official Job Portals Quick Access */}
        <button
          type="button"
          data-testid="popup-official-portals-btn"
          onClick={() => handleOpenDashboard('portals')}
          className="w-full bg-white hover:bg-emerald-50/70 border border-slate-200 hover:border-emerald-300 rounded-xl px-3 py-2 flex items-center justify-between gap-2 shadow-xs transition-colors cursor-pointer group"
        >
          <div className="flex items-center gap-2 text-left">
            <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Globe className="w-3.5 h-3.5" />
            </span>
            <div>
              <span className="text-xs font-extrabold text-slate-800 group-hover:text-emerald-700 block leading-tight">
                🌐 Official Job Portals
              </span>
              <span className="text-[10px] text-slate-500 block">
                Teletalk, BPSC, BB, NTRCA, Bdjobs & Remote
              </span>
            </div>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 shrink-0" />
        </button>
      </main>

      {/* 3. Footer */}
      <footer className="px-4 py-2 bg-white border-t border-slate-200 text-[10.5px] text-slate-400 flex items-center justify-between">
        <span
          className="flex items-center gap-1"
          title="Personal vault & documents stay local and encrypted; public job circular retrieval requires Internet access."
        >
          <Shield className="w-3 h-3 text-emerald-600" />
          <span>Local-First Profile Vault</span>
        </span>
        <button
          onClick={() => handleOpenDashboard()}
          className="text-emerald-700 hover:text-emerald-800 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
        >
          <span>Full Dashboard</span>
          <ExternalLink className="w-2.5 h-2.5" />
        </button>
      </footer>
    </div>
  );
};
