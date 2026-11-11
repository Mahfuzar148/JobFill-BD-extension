// JobFill BD - Manifest V3 Service Worker Entry
// Orchestrates extension lifecycle, toolbar icon actions, message routing,
// and Chrome Alarms / Notifications for Job Circular Hub.

import { MessageRouter } from './message-router';
import { TabManager } from './tab-manager';
import { clearAllTabToolbarDismissals, clearTabToolbarDismissal } from './toolbar-state';
import { JobAlarmManager } from '../jobs/background/alarm-manager';
import { JobCheckService } from '../jobs/background/job-check-service';
import { JobRepository } from '../jobs/database/job-repository';
import { isExcludedSiteUrl } from '../security/site-policy';

async function openDashboardForNotification(notificationId: string): Promise<void> {
  const routes = await JobRepository.getNotificationRouteMap();
  const route = routes[notificationId];
  if (route) {
    await TabManager.openOrFocusDashboard(route.tab || 'circulars', route.jobId);
  } else {
    await TabManager.openOrFocusDashboard('circulars');
  }
}

export function initServiceWorker() {
  if (typeof chrome === 'undefined' || !chrome.runtime) return;

  chrome.runtime.onInstalled.addListener((details) => {
    console.log('JobFill BD Extension initialized:', details.reason);
    JobAlarmManager.ensureAlarms()
      .then(() => {
        if (details.reason === 'install' || details.reason === 'update') {
          return JobCheckService.runFullCheck({ skipFetch: false });
        }
        return undefined;
      })
      .catch((err) => console.warn('Alarm / initial job check error:', err));
  });

  if (chrome.runtime.onStartup) {
    chrome.runtime.onStartup.addListener(() => {
      clearAllTabToolbarDismissals().catch(() => {});
      JobAlarmManager.ensureAlarms()
        .then(() => JobCheckService.runFullCheck({ skipFetch: false, respectCooldowns: true }))
        .catch((err) => console.warn('Startup job check error:', err));
    });
  }

  // Clear per-tab floating toolbar dismissal state when a tab closes
  if (chrome.tabs && chrome.tabs.onRemoved) {
    chrome.tabs.onRemoved.addListener((tabId) => {
      clearTabToolbarDismissal(tabId).catch(() => {});
    });
  }

  // Ensure alarms exist whenever MV3 Service Worker wakes up
  JobAlarmManager.ensureAlarms().catch(() => {});

  // Chrome Alarms listener (Daily Job Digest + Single Deadline Scheduler)
  if (chrome.alarms && chrome.alarms.onAlarm) {
    chrome.alarms.onAlarm.addListener((alarm) => {
      JobCheckService.handleAlarmEvent(alarm.name).catch((err) =>
        console.warn('JobFill BD alarm handler error:', err)
      );
    });
  }

  // Clicking desktop notification or its action button opens the exact job detail page
  if (chrome.notifications) {
    chrome.notifications.onClicked?.addListener((notificationId) => {
      openDashboardForNotification(notificationId).catch(() => {});
      chrome.notifications.clear?.(notificationId);
    });

    chrome.notifications.onButtonClicked?.addListener((notificationId) => {
      openDashboardForNotification(notificationId).catch(() => {});
      chrome.notifications.clear?.(notificationId);
    });
  }

  // Clicking extension action icon in toolbar opens full dashboard tab
  if (chrome.action && chrome.action.onClicked) {
    chrome.action.onClicked.addListener((_tab) => {
      TabManager.openOrFocusDashboard();
    });
  }

  // Register central message router
  if (chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      return MessageRouter.handleMessage(message, sender, sendResponse);
    });
  }

  // Keyboard shortcuts (MV3 commands: Alt+Shift+F / Alt+Shift+R)
  if (chrome.commands && chrome.commands.onCommand) {
    chrome.commands.onCommand.addListener((command) => {
      const action =
        command === 'quick-autofill'
          ? 'AUTO_FILL_NOW'
          : command === 'open-review-modal'
            ? 'OPEN_REVIEW_MODAL'
            : null;
      if (!action || !chrome.tabs?.query) return;

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs?.[0];
        if (!tab?.id || !tab.url || isExcludedSiteUrl(tab.url)) return;
        chrome.tabs.sendMessage(tab.id, { action }).catch(() => {});
      });
    });
  }
}

// Auto-execute when loaded as service worker
initServiceWorker();
