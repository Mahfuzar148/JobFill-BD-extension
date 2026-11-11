// JobFill BD - Job Notification Center Page
// Tabs: All, New Jobs, Deadline Reminders, Urgent, Applied, Expired
// Supports Snooze, Disable Reminder, Mark Read, Clear Read, Open Details, and Settings shortcut.

import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Trash2,
  Clock,
  Settings,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { JobNotificationRecord, NormalizedJobCircular, ApplicationTrackerRecord } from '../types/job.types';
import { JobNotificationRepository } from '../database/notification-repository';
import { JobRepository } from '../database/job-repository';
import { ApplicationRepository } from '../database/application-repository';
import { BookmarkRepository } from '../database/bookmark-repository';
import { NotificationScheduler } from '../notifications/notification-scheduler';
import { calculateRemainingTime } from '../services/deadline-parser';

type NotifTab =
  | 'all'
  | 'new_jobs'
  | 'matching'
  | 'deadline_reminders'
  | 'deadline_changed'
  | 'urgent'
  | 'bookmarked'
  | 'applied'
  | 'expired';

interface NotificationCenterPageProps {
  language?: 'bn' | 'en';
  onOpenJobDetails: (jobId: string) => void;
  onOpenSettings?: () => void;
  onNotificationsChanged?: () => void;
  showToast?: (msg: string) => void;
}

export const NotificationCenterPage: React.FC<NotificationCenterPageProps> = ({
  language = 'en',
  onOpenJobDetails,
  onOpenSettings,
  onNotificationsChanged,
  showToast,
}) => {
  const bn = language === 'bn';
  const [activeTab, setActiveTab] = useState<NotifTab>('all');
  const [notifications, setNotifications] = useState<JobNotificationRecord[]>([]);
  const [jobsById, setJobsById] = useState<Map<string, NormalizedJobCircular>>(new Map());
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [notifPermission, setNotifPermission] = useState<string>('granted');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
      if (typeof chrome !== 'undefined' && chrome.notifications?.getPermissionLevel) {
        chrome.notifications.getPermissionLevel((level) => {
          if (!chrome.runtime?.lastError && level) {
            setNotifPermission(level);
          }
        });
      }
      const [notifs, jobs, apps, bms] = await Promise.race([
        Promise.all([
          JobNotificationRepository.getAll(),
          JobRepository.getAllJobs(),
          ApplicationRepository.getAll(),
          BookmarkRepository.getBookmarkedJobIds(),
        ]),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Notification loading timed out')), 8000);
        }),
      ]);
      setNotifications(notifs);
      setJobsById(new Map(jobs.map((j) => [j.id, j])));
      setBookmarkedIds(bms);
      setAppliedIds(
        new Set(
          apps
            .filter((a: ApplicationTrackerRecord) =>
              ['Applied', 'Exam Scheduled', 'Result Published', 'Rejected', 'Selected'].includes(a.status)
            )
            .map((a) => a.jobId)
        )
      );
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load notifications');
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = notifications.filter((n) => {
    const job = n.jobId ? jobsById.get(n.jobId) : undefined;
    const isApplied = n.jobId ? appliedIds.has(n.jobId) : false;
    const isBookmarked = n.jobId ? bookmarkedIds.has(n.jobId) : false;
    const isExpired =
      n.type === 'expired_job' ||
      job?.status === 'expired' ||
      (typeof n.deadlineAt === 'number' && n.deadlineAt <= Date.now());

    switch (activeTab) {
      case 'new_jobs':
        return n.type === 'new_job' || n.type === 'daily_digest' || n.type === 'matching_job';
      case 'matching':
        return n.type === 'matching_job';
      case 'deadline_reminders':
        return n.type === 'deadline_reminder' || n.type === 'urgent_deadline' || n.type === 'deadline_changed';
      case 'deadline_changed':
        return n.type === 'deadline_changed';
      case 'urgent':
        return n.isUrgent || n.type === 'urgent_deadline';
      case 'bookmarked':
        return isBookmarked;
      case 'applied':
        return isApplied;
      case 'expired':
        return isExpired;
      default:
        return true;
    }
  });

  const handleMarkRead = async (id: string) => {
    await JobNotificationRepository.markAsRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    onNotificationsChanged?.();
  };

  const handleMarkAllRead = async () => {
    await JobNotificationRepository.markAllAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    onNotificationsChanged?.();
    showToast?.(bn ? '✅ সব নোটিফিকেশন পঠিত হিসেবে চিহ্নিত হয়েছে' : '✅ All notifications marked as read');
  };

  const handleClearRead = async () => {
    await JobNotificationRepository.clearRead();
    await loadData();
    onNotificationsChanged?.();
    showToast?.(bn ? '🧹 পঠিত নোটিফিকেশন মুছে ফেলা হয়েছে' : '🧹 Cleared read notifications');
  };

  const handleSnooze = async (n: JobNotificationRecord) => {
    if (!n.jobId) return;
    await NotificationScheduler.snoozeJobReminder(n.jobId, 4 * 60 * 60 * 1000);
    await handleMarkRead(n.id);
    showToast?.(bn ? '⏰ ৪ ঘণ্টার জন্য স্নুজ করা হয়েছে' : '⏰ Reminder snoozed for 4 hours');
  };

  const handleDisableReminder = async (n: JobNotificationRecord) => {
    if (!n.jobId) return;
    await NotificationScheduler.dismissJobReminder(n.jobId);
    await handleMarkRead(n.id);
    showToast?.(bn ? '🔕 এই চাকরির রিমাইন্ডার বন্ধ করা হয়েছে' : '🔕 Reminder disabled for this job');
  };

  const tabs: { id: NotifTab; labelEn: string; labelBn: string }[] = [
    { id: 'all', labelEn: 'All', labelBn: 'সব' },
    { id: 'new_jobs', labelEn: 'New Jobs', labelBn: 'নতুন চাকরি' },
    { id: 'matching', labelEn: 'Matching Jobs', labelBn: 'পছন্দসই চাকরি' },
    { id: 'deadline_reminders', labelEn: 'Deadline Reminders', labelBn: 'সময়সীমা সতর্কতা' },
    { id: 'deadline_changed', labelEn: 'Deadline Changed', labelBn: 'সময়সীমা পরিবর্তন' },
    { id: 'urgent', labelEn: 'Urgent', labelBn: 'জরুরি' },
    { id: 'bookmarked', labelEn: 'Bookmarked', labelBn: 'বুকমার্ককৃত' },
    { id: 'applied', labelEn: 'Applied', labelBn: 'আবেদনকৃত' },
    { id: 'expired', labelEn: 'Expired', labelBn: 'মেয়াদোত্তীর্ণ' },
  ];

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-petro-600" />
            <span>{bn ? 'নোটিফিকেশন সেন্টার' : 'Notification Center'}</span>
            {unreadCount > 0 && (
              <span className="text-xs font-bold bg-rose-600 text-white px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {bn
              ? 'দৈনিক জব আপডেট ও ৪৮/২৪ ঘণ্টার জরুরি ডেডলাইন রিমাইন্ডার'
              : 'Daily job digests and smart 48h/24h/2h deadline reminders'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={loadData}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5 text-petro-600" />
              <span>{bn ? 'সব পঠিত করুন' : 'Mark All as Read'}</span>
            </button>
          )}

          {notifications.some((n) => n.isRead) && (
            <button
              type="button"
              onClick={handleClearRead}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{bn ? 'পঠিতগুলো মুছুন' : 'Clear Read Notifications'}</span>
            </button>
          )}

          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-petro-600 hover:bg-petro-700 text-white cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>{bn ? 'নোটিফিকেশন সেটিংস' : 'Notification Settings'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Permission Denied Warning */}
      {notifPermission === 'denied' && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl p-3.5 text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>
            {bn
              ? 'ব্রাউজার বা অপারেটিং সিস্টেমে ডেস্কটপ নোটিফিকেশন পারমিশন বন্ধ আছে। তবে ইন-অ্যাপ নোটিফিকেশন সেন্টার কাজ করবে।'
              : 'Desktop notification permission is currently denied in Chrome/OS settings. Alerts will still be logged here in Notification Center.'}
          </span>
        </div>
      )}

      {/* MV3 Scheduling Note */}
      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-2">
        <Clock className="w-3.5 h-3.5 text-petro-600 shrink-0" />
        <span>
          {bn
            ? 'সিডিউলড নোটিফিকেশন Chrome MV3 Alarms ব্যবহার করে। নির্ধারিত সময়ে ব্রাউজার বন্ধ বা ডিভাইস স্লিপে থাকলে পুনরায় চালু হওয়ার পর অ্যালার্ট প্রদর্শিত হবে।'
            : 'Scheduled notifications rely on Chrome MV3 Alarms (chrome.alarms). If Chrome is closed or your device is sleeping, queued reminders deliver when Chrome next starts.'}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === tab.id
                ? 'bg-petro-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
          >
            {bn ? tab.labelBn : tab.labelEn}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center text-xs text-slate-400">
          {bn ? 'লোড হচ্ছে...' : 'Loading notifications...'}
        </div>
      ) : loadError ? (
        <div className="bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-900 p-8 text-center space-y-3">
          <div className="text-sm font-bold text-rose-800 dark:text-rose-200">{loadError}</div>
          <button
            type="button"
            onClick={loadData}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
          >
            {bn ? 'আবার চেষ্টা করুন' : 'Retry'}
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-2">
          <BellOff className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            {bn ? 'এই বিভাগে কোনো নোটিফিকেশন নেই' : 'No notifications in this tab'}
          </p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {bn
              ? 'নতুন চাকরির বিজ্ঞপ্তি বা যাচাইকৃত সময়সীমার রিমাইন্ডার এখানে তালিকাভুক্ত হবে।'
              : 'New job alerts and verified deadline reminders will appear here automatically.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((n) => {
            const job = n.jobId ? jobsById.get(n.jobId) : undefined;
            const rem = job
              ? calculateRemainingTime(job.deadlineAt, job.deadlineVerified)
              : n.deadlineAt
                ? calculateRemainingTime(n.deadlineAt, true)
                : null;

            return (
              <div
                key={n.id}
                className={`bg-white dark:bg-slate-900 rounded-2xl border p-4 transition-all ${
                  n.isUrgent
                    ? 'border-l-4 border-l-rose-600 border-rose-200 dark:border-rose-900'
                    : 'border-slate-200 dark:border-slate-800'
                } ${n.isRead ? 'opacity-75' : 'shadow-sm'}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {n.isUrgent && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-600 text-white">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          URGENT
                        </span>
                      )}
                      {!n.isRead && <span className="w-2 h-2 rounded-full bg-petro-600 shrink-0" />}
                      <span className="text-xs font-extrabold text-slate-800 dark:text-white">{n.title}</span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300">{n.message}</p>

                    <div className="flex items-center gap-3 flex-wrap text-[11px] text-slate-400 pt-1">
                      {n.organization && <strong className="text-petro-700 dark:text-petro-400">{n.organization}</strong>}
                      {n.jobTitle && <span>{n.jobTitle}</span>}
                      {rem && rem.isVerified && (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                          <Clock className="w-3 h-3" />
                          {rem.labelEn}
                        </span>
                      )}
                      <span>{new Date(n.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                    {n.jobId && (
                      <button
                        type="button"
                        onClick={() => onOpenJobDetails(n.jobId!)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-petro-600 hover:bg-petro-700 text-white cursor-pointer"
                      >
                        <span>{bn ? 'বিস্তারিত' : 'Open Details'}</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}

                    {!n.isRead && (
                      <button
                        type="button"
                        onClick={() => handleMarkRead(n.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                        <span>{bn ? 'পঠিত' : 'Mark as Read'}</span>
                      </button>
                    )}

                    {n.jobId && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleSnooze(n)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 cursor-pointer"
                        >
                          <Clock className="w-3 h-3" />
                          <span>{bn ? 'স্নুজ' : 'Snooze'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDisableReminder(n)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 cursor-pointer"
                        >
                          <BellOff className="w-3 h-3" />
                          <span>{bn ? 'রিমাইন্ডার বন্ধ' : 'Disable Reminder'}</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Honest Manifest V3 Limitations Banner */}
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-[11.5px] text-slate-600 dark:text-slate-400 space-y-1">
        <div className="font-bold text-slate-700 dark:text-slate-300">
          {bn ? 'ℹ️ ব্রাউজার নোটিফিকেশন সীমাবদ্ধতা (Manifest V3 Alarms)' : 'ℹ️ Desktop Notification Timing Limitations (Manifest V3)'}
        </div>
        <p>
          {bn
            ? 'Chrome বন্ধ থাকলে বা কম্পিউটার Sleep মোডে থাকলে ব্রাউজার অ্যালার্ম চালু হয় না। Chrome পুনরায় চালু হলে মিস হওয়া রিমাইন্ডারগুলো যাচাই করে একত্রে একটি আপডেট পাঠানো হয়।'
            : 'Chrome Alarms cannot wake a sleeping computer and do not run while Chrome is completely closed. Missed alarms catch up cleanly once Chrome reopens without sending duplicate floods.'}
        </p>
      </div>
    </div>
  );
};
