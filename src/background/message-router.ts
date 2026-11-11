// JobFill BD - Background Message Router
// Typed dispatcher for communication between Content Scripts, Popup, and Dashboard.
// Security: Verifies sender authorization, rejects restricted browser URLs, and never logs document data.

import { TabManager } from './tab-manager';
import { PermissionManager } from './permission-manager';
import { isTabToolbarDismissed, setTabToolbarDismissed } from './toolbar-state';
import { isExcludedSiteUrl } from '../security/site-policy';
import { getExtensionDiagnostics, recordExtensionDiagnostic } from '../security/diagnostics';
import { DocumentRepository } from '../database/document-repository';
import { DocumentCategory } from '../types/profile';
import { JobCheckService } from '../jobs/background/job-check-service';
import { JobAlarmManager } from '../jobs/background/alarm-manager';
import {
  getActiveProfile,
  getAllProfiles,
  getSecuritySettings,
  saveActiveProfile,
  applyCanonicalProfileFieldUpdate,
  unlockVault,
  lockVault,
} from '../services/storage';

export interface ExtensionMessage {
  action:
    | 'openDashboard'
    | 'openJobSearch'
    | 'openJobCirculars'
    | 'openGovtOrgs'
    | 'openOfficialPortals'
    | 'openJobNotifications'
    | 'scanCurrentTab'
    | 'checkTabStatus'
    | 'vaultStatus'
    | 'GET_ACTIVE_PROFILE_STATE'
    | 'UPDATE_ACTIVE_PROFILE_FIELD'
    | 'GET_PROFILE_DOCUMENT_PREVIEWS'
    | 'GET_APPROVED_DOCUMENT_PAYLOAD'
    | 'SAVE_PROFILE_DOCUMENT'
    | 'CHECK_JOB_SOURCES_NOW'
    | 'RUN_DEADLINE_SCHEDULER_TICK'
    | 'RESCHEDULE_JOB_ALARMS'
    | 'SYNC_VAULT_UNLOCK'
    | 'SYNC_VAULT_LOCK'
    | 'GET_EXTENSION_DIAGNOSTICS'
    | 'GET_TAB_TOOLBAR_STATE'
    | 'SET_TAB_TOOLBAR_DISMISSED';
  payload?: any;
}

function isAuthorizedDocumentTabUrl(url?: string): boolean {
  if (!url) return false;
  if (isExcludedSiteUrl(url)) {
    recordExtensionDiagnostic('excluded_site_detected', {
      url,
      source: 'MessageRouter.isAuthorizedDocumentTabUrl',
    });
    return false;
  }
  return true;
}

export class MessageRouter {
  public static handleMessage(
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): boolean {
    switch (message.action) {
      case 'openDashboard':
        TabManager.openOrFocusDashboard(message.payload?.tab, message.payload?.jobId)
          .then(() => sendResponse({ status: 'ok' }))
          .catch((err) => sendResponse({ status: 'error', error: err.message }));
        return true;

      case 'openJobSearch':
        TabManager.openOrFocusDashboard('search', message.payload?.jobId)
          .then(() => sendResponse({ status: 'ok' }))
          .catch((err) => sendResponse({ status: 'error', error: err.message }));
        return true;

      case 'openJobCirculars':
        TabManager.openOrFocusDashboard('circulars', message.payload?.jobId)
          .then(() => sendResponse({ status: 'ok' }))
          .catch((err) => sendResponse({ status: 'error', error: err.message }));
        return true;

      case 'openGovtOrgs':
        TabManager.openOrFocusDashboard('govt_orgs', message.payload?.jobId)
          .then(() => sendResponse({ status: 'ok' }))
          .catch((err) => sendResponse({ status: 'error', error: err.message }));
        return true;

      case 'openOfficialPortals':
        TabManager.openOrFocusDashboard('portals')
          .then(() => sendResponse({ status: 'ok' }))
          .catch((err) => sendResponse({ status: 'error', error: err.message }));
        return true;

      case 'openJobNotifications':
        TabManager.openOrFocusDashboard('notifications')
          .then(() => sendResponse({ status: 'ok' }))
          .catch((err) => sendResponse({ status: 'error', error: err.message }));
        return true;

      case 'CHECK_JOB_SOURCES_NOW':
        JobCheckService.runFullCheck({
          forceDigest: Boolean(message.payload?.forceDigest),
          respectCooldowns: Boolean(message.payload?.respectCooldowns),
          sourceIds: Array.isArray(message.payload?.sourceIds) ? message.payload.sourceIds : undefined,
        })
          .then((report) => sendResponse({ status: 'ok', ...report }))
          .catch((err) => sendResponse({ status: 'error', error: err.message }));
        return true;

      case 'RUN_DEADLINE_SCHEDULER_TICK':
        JobCheckService.runDeadlineTickOnly()
          .then(() => sendResponse({ status: 'ok' }))
          .catch((err) => sendResponse({ status: 'error', error: err.message }));
        return true;

      case 'RESCHEDULE_JOB_ALARMS':
        JobAlarmManager.rescheduleDailyAlarmFromPreferences()
          .then(() => JobCheckService.runDeadlineTickOnly())
          .then(() => sendResponse({ status: 'ok' }))
          .catch((err) => sendResponse({ status: 'error', error: err.message }));
        return true;

      case 'GET_ACTIVE_PROFILE_STATE': {
        (async () => {
          const originUrl = sender.tab?.url || sender.url;
          const isExtensionPage = Boolean(originUrl && originUrl.startsWith('chrome-extension://'));
          if (sender.tab && !isExtensionPage && !isAuthorizedDocumentTabUrl(originUrl)) {
            sendResponse({ status: 'denied', error: 'Unauthorized origin for profile retrieval.' });
            return;
          }

          try {
            const sec = await getSecuritySettings();
            const activeProfile = await getActiveProfile();
            const allProfiles = isExtensionPage || !sender.tab ? await getAllProfiles() : undefined;
            sendResponse({
              status: 'ok',
              isPasswordProtected: sec.isPasswordProtected,
              activeProfile,
              profiles: allProfiles,
            });
          } catch (err: any) {
            if (err?.message === 'VAULT_LOCKED') {
              sendResponse({ status: 'locked', isPasswordProtected: true, activeProfile: null, profiles: [] });
            } else {
              sendResponse({ status: 'error', error: err?.message || 'Could not resolve active profile.' });
            }
          }
        })();
        return true;
      }

      case 'UPDATE_ACTIVE_PROFILE_FIELD': {
        (async () => {
          const originUrl = sender.tab?.url || sender.url;
          const isExtensionPage = Boolean(originUrl && originUrl.startsWith('chrome-extension://'));
          if (sender.tab && !isExtensionPage && !isAuthorizedDocumentTabUrl(originUrl)) {
            sendResponse({ status: 'denied', error: 'Unauthorized origin for profile update.' });
            return;
          }
          try {
            const sec = await getSecuritySettings();
            if (sec.isPasswordProtected) {
              sendResponse({ status: 'locked', error: 'Cannot mutate password-protected vault from page script.' });
              return;
            }
            const canonicalKey = String(message.payload?.canonicalKey || '');
            const newValue = String(message.payload?.newValue || '');
            const active = await getActiveProfile();
            if (!applyCanonicalProfileFieldUpdate(active, canonicalKey, newValue)) {
              sendResponse({ status: 'error', error: 'Unknown canonical profile key.' });
              return;
            }
            await saveActiveProfile(active);
            sendResponse({ status: 'ok', activeProfile: active });
          } catch (err: any) {
            sendResponse({ status: 'error', error: err?.message || 'Could not update active profile.' });
          }
        })();
        return true;
      }

      case 'scanCurrentTab':
        TabManager.getActiveTab().then(async (tab) => {
          if (!tab || !tab.url) {
            sendResponse({ status: 'error', error: 'No active tab found' });
            return;
          }
          if (PermissionManager.isRestrictedUrl(tab.url)) {
            sendResponse({ status: 'restricted', message: 'Restricted browser page' });
            return;
          }
          try {
            const res = await TabManager.sendMessageToActiveTab({ action: 'scanAndFill' });
            sendResponse({ status: 'ok', data: res });
          } catch (e: any) {
            sendResponse({ status: 'error', error: e.message });
          }
        });
        return true;

      case 'checkTabStatus':
        TabManager.getActiveTab().then((tab) => {
          if (!tab || !tab.url) {
            sendResponse({ isRestricted: false, url: '' });
            return;
          }
          sendResponse({
            isRestricted: PermissionManager.isRestrictedUrl(tab.url),
            url: tab.url,
            title: tab.title || '',
          });
        });
        return true;

      case 'GET_PROFILE_DOCUMENT_PREVIEWS': {
        (async () => {
          const originUrl = sender.tab?.url || sender.url || message.payload?.url;
          if (!isAuthorizedDocumentTabUrl(originUrl)) {
            sendResponse({ status: 'denied', error: 'Unauthorized origin for document retrieval.' });
            return;
          }

          const profileId: string = message.payload?.profileId;
          const requestedTypes: DocumentCategory[] = message.payload?.requestedTypes || ['photo', 'signature'];
          if (!profileId) {
            sendResponse({ status: 'error', error: 'Missing active profileId.' });
            return;
          }

          try {
            const documents: Record<string, any> = {};
            for (const docType of requestedTypes) {
              const found = await DocumentRepository.getByCategory(profileId, docType, false);
              if (found) {
                documents[docType] = {
                  metadata: found.metadata,
                  dataUrl: found.dataUrl,
                };
              }
            }
            sendResponse({ status: 'ok', documents });
          } catch (err: any) {
            sendResponse({ status: 'error', error: err?.message || 'Document vault access failed.' });
          }
        })();
        return true;
      }

      case 'SAVE_PROFILE_DOCUMENT': {
        (async () => {
          const originUrl = sender.tab?.url || sender.url || message.payload?.url;
          if (!isAuthorizedDocumentTabUrl(originUrl)) {
            sendResponse({ status: 'denied', error: 'Unauthorized origin for document storage.' });
            return;
          }

          const payload = message.payload || {};
          const profileId: string = payload.profileId;
          const documentType: DocumentCategory = payload.documentType || 'other';
          const allowedTypes: DocumentCategory[] = [
            'photo',
            'signature',
            'nid',
            'birth_certificate',
            'educational_certificate',
            'other',
          ];
          const dataUrl: string = payload.dataUrl;

          if (!profileId || !allowedTypes.includes(documentType)) {
            sendResponse({ status: 'error', error: 'Invalid profileId or documentType.' });
            return;
          }
          if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:') || dataUrl.length > 15 * 1024 * 1024) {
            sendResponse({ status: 'error', error: 'Invalid or oversized document payload.' });
            return;
          }

          try {
            const prefix =
              documentType === 'photo' ? 'photo' : documentType === 'signature' ? 'sig' : documentType;
            const docId =
              documentType === 'photo' || documentType === 'signature'
                ? `${prefix}_${profileId}_original`
                : `${prefix}_${profileId}_${Date.now()}`;
            const title =
              documentType === 'photo'
                ? 'Applicant Photograph (Original)'
                : documentType === 'signature'
                  ? 'Applicant Signature (Original)'
                  : payload.fileName || documentType;

            const metadata = await DocumentRepository.saveDocument({
              id: docId,
              documentId: docId,
              profileId,
              type: documentType,
              documentType,
              title,
              fileName: String(payload.fileName || `${documentType}.jpg`),
              mimeType: String(payload.mimeType || 'image/jpeg'),
              fileSize: Number(payload.fileSize || 0),
              width: Number(payload.width || 0),
              height: Number(payload.height || 0),
              dataUrl,
            });
            sendResponse({ status: 'ok', metadata });
          } catch (err: any) {
            sendResponse({ status: 'error', error: err?.message || 'Could not save document.' });
          }
        })();
        return true;
      }

      case 'GET_APPROVED_DOCUMENT_PAYLOAD': {
        (async () => {
          const originUrl = sender.tab?.url || sender.url || message.payload?.url;
          if (!isAuthorizedDocumentTabUrl(originUrl)) {
            sendResponse({ status: 'denied', error: 'Unauthorized tab URL for approved file transfer.' });
            return;
          }

          const profileId: string = message.payload?.profileId;
          const approvedTypes: DocumentCategory[] = message.payload?.approvedTypes || [];
          const preferProcessed: boolean = Boolean(message.payload?.preferProcessed);

          if (!profileId || approvedTypes.length === 0) {
            sendResponse({ status: 'error', error: 'Explicit approval and profileId required.' });
            return;
          }

          try {
            const documents: Record<string, any> = {};
            for (const docType of approvedTypes) {
              const found = await DocumentRepository.getByCategory(profileId, docType, preferProcessed);
              if (found) {
                documents[docType] = {
                  metadata: found.metadata,
                  dataUrl: found.dataUrl,
                };
              }
            }
            sendResponse({ status: 'ok', documents });
          } catch (err: any) {
            sendResponse({ status: 'error', error: err?.message || 'Could not transfer approved document.' });
          }
        })();
        return true;
      }

      case 'SYNC_VAULT_UNLOCK': {
        (async () => {
          const originUrl = sender.tab?.url || sender.url || '';
          if (sender.tab && !originUrl.startsWith('chrome-extension://')) {
            sendResponse({ status: 'denied', error: 'Vault unlock permitted only from extension UI.' });
            return;
          }
          const ok = await unlockVault(String(message.payload?.password || ''), true);
          sendResponse({ status: ok ? 'ok' : 'error' });
        })();
        return true;
      }

      case 'SYNC_VAULT_LOCK': {
        (async () => {
          const originUrl = sender.tab?.url || sender.url || '';
          if (sender.tab && !originUrl.startsWith('chrome-extension://')) {
            sendResponse({ status: 'denied', error: 'Unauthorized origin for lock broadcast.' });
            return;
          }
          lockVault(true);
          if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
            try {
              const allTabs = await chrome.tabs.query({});
              for (const tab of allTabs) {
                if (tab.id && tab.url && !isExcludedSiteUrl(tab.url) && !tab.url.startsWith('chrome')) {
                  chrome.tabs.sendMessage(tab.id, { action: 'VAULT_LOCKED' }, () => void chrome.runtime?.lastError);
                }
              }
            } catch {
              // ignore tab broadcast errors
            }
          }
          sendResponse({ status: 'ok' });
        })();
        return true;
      }

      case 'GET_EXTENSION_DIAGNOSTICS': {
        sendResponse({ status: 'ok', diagnostics: getExtensionDiagnostics() });
        return false;
      }

      case 'GET_TAB_TOOLBAR_STATE': {
        (async () => {
          const originUrl = sender.tab?.url || sender.url;
          const isExtensionPage = Boolean(originUrl && originUrl.startsWith('chrome-extension://'));
          if (sender.tab && !isExtensionPage && !isAuthorizedDocumentTabUrl(originUrl)) {
            sendResponse({ status: 'denied', dismissed: false });
            return;
          }
          const rawTabId =
            typeof message.payload?.tabId === 'number' ? message.payload.tabId : sender.tab?.id;
          if (typeof rawTabId !== 'number') {
            sendResponse({ status: 'ok', dismissed: false });
            return;
          }
          const dismissed = await isTabToolbarDismissed(rawTabId);
          sendResponse({ status: 'ok', tabId: rawTabId, dismissed });
        })();
        return true;
      }

      case 'SET_TAB_TOOLBAR_DISMISSED': {
        (async () => {
          const originUrl = sender.tab?.url || sender.url;
          const isExtensionPage = Boolean(originUrl && originUrl.startsWith('chrome-extension://'));
          if (sender.tab && !isExtensionPage && !isAuthorizedDocumentTabUrl(originUrl)) {
            sendResponse({ status: 'denied', error: 'Unauthorized origin for toolbar state update.' });
            return;
          }
          const rawTabId =
            typeof message.payload?.tabId === 'number' ? message.payload.tabId : sender.tab?.id;
          if (typeof rawTabId !== 'number') {
            sendResponse({ status: 'error', error: 'Missing target tabId.' });
            return;
          }
          const dismissed = Boolean(message.payload?.dismissed);
          await setTabToolbarDismissed(rawTabId, dismissed);
          sendResponse({ status: 'ok', tabId: rawTabId, dismissed });
        })();
        return true;
      }

      default:
        return false;
    }
  }
}
