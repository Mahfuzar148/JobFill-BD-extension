// JobFill BD - Desktop & In-App Notification Manager
// Dispatches Chrome MV3 Notifications and persists records in Notification Center.
// Maps each desktop notification ID to its target Job Detail route.

import { JobNotificationRecord, NotificationCategoryType } from '../types/job.types';
import { JobNotificationRepository } from '../database/notification-repository';
import { JobRepository } from '../database/job-repository';

export interface DispatchNotificationInput {
  type: NotificationCategoryType;
  title: string;
  message: string;
  jobId?: string;
  jobTitle?: string;
  organization?: string;
  deadlineAt?: number | null;
  remainingText?: string;
  circularUrl?: string;
  applicationUrl?: string | null;
  isUrgent?: boolean;
  actionButtonTitle?: string;
  routeTab?: 'circulars' | 'search' | 'govt_orgs' | 'notifications';
  createdAt?: number;
}

function getExtensionIconUrl(): string {
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    return chrome.runtime.getURL('icons/icon128.png');
  }
  return 'icons/icon128.png';
}

export class NotificationManager {
  public static async dispatch(input: DispatchNotificationInput): Promise<JobNotificationRecord> {
    const now = input.createdAt ?? Date.now();
    const record: JobNotificationRecord = {
      id: `notif_${now}_${Math.random().toString(36).slice(2, 8)}`,
      type: input.type,
      title: input.title,
      message: input.message,
      jobId: input.jobId,
      jobTitle: input.jobTitle,
      organization: input.organization,
      deadlineAt: input.deadlineAt ?? null,
      remainingText: input.remainingText,
      circularUrl: input.circularUrl,
      applicationUrl: input.applicationUrl,
      isUrgent: Boolean(input.isUrgent),
      isRead: false,
      createdAt: now,
    };

    await JobNotificationRepository.add(record);

    if (typeof chrome !== 'undefined' && chrome.notifications?.create) {
      try {
        const options: chrome.notifications.NotificationOptions<true> = {
          type: 'basic',
          iconUrl: getExtensionIconUrl(),
          title: input.title,
          message: input.message,
          priority: input.isUrgent ? 2 : 1,
          requireInteraction: Boolean(input.isUrgent),
        };

        if (input.actionButtonTitle) {
          options.buttons = [{ title: input.actionButtonTitle }];
        }

        const createdId = await new Promise<string>((resolve) => {
          chrome.notifications.create(record.id, options, (id) => {
            if (chrome.runtime?.lastError) {
              console.warn('JobFill BD: Notification delivery blocked:', chrome.runtime.lastError.message);
              resolve(record.id);
              return;
            }
            resolve(id || record.id);
          });
        });

        await JobRepository.saveNotificationRoute(createdId, {
          tab: input.routeTab || 'circulars',
          jobId: input.jobId,
        });
      } catch (err) {
        console.warn('JobFill BD: Desktop notification creation skipped:', err);
      }
    } else {
      await JobRepository.saveNotificationRoute(record.id, {
        tab: input.routeTab || 'circulars',
        jobId: input.jobId,
      });
    }

    return record;
  }
}
