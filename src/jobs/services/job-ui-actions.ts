// JobFill BD - Shared Job Hub UI Actions
// Centralizes Apply Now (with URL security verification & autofill context),
// Bookmark toggling, Mark Applied sync, Clipboard Sharing, and Manual Deadline Verification.

import { NormalizedJobCircular, ApplicationTrackerRecord } from '../types/job.types';
import { JobRepository } from '../database/job-repository';
import { BookmarkRepository } from '../database/bookmark-repository';
import { ApplicationRepository } from '../database/application-repository';
import { NotificationScheduler } from '../notifications/notification-scheduler';
import { verifyJobUrl } from './source-verifier';
import { parseDeadlineDate } from './deadline-parser';
import { refreshJobStatus } from './job-validator';
import { classifyApplicationDestination } from './application-link-detector';

export async function openSafeExternalTab(url: string): Promise<boolean> {
  const check = verifyJobUrl(url);
  if (!check.isValid || !check.isSafeToOpen) return false;
  if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
    await chrome.tabs.create({ url: check.normalizedUrl });
  } else {
    window.open(check.normalizedUrl, '_blank', 'noopener,noreferrer');
  }
  return true;
}

export async function openJobApplicationWithContext(
  job: NormalizedJobCircular,
  showToast: (msg: string) => void,
  bn: boolean,
  onMissingApplicationUrl?: (job: NormalizedJobCircular) => void
): Promise<{ opened: boolean; reason?: 'missing_application_url' | 'unsafe_url' | 'cancelled' }> {
  const rawAppUrl = (job.applicationUrl || '').trim();
  const classification = classifyApplicationDestination(rawAppUrl);

  // Never open circular PDFs or notice-only pages in place of an actual online application form
  if (!rawAppUrl || classification.isCircularDocument || classification.isNoticePage) {
    showToast(
      bn
        ? '⚠️ সরাসরি অনলাইন আবেদন লিংক পাওয়া যায়নি।'
        : '⚠️ সরাসরি অনলাইন আবেদন লিংক পাওয়া যায়নি। (Direct online application link unavailable)'
    );
    onMissingApplicationUrl?.(job);
    return { opened: false, reason: 'missing_application_url' };
  }

  const check = verifyJobUrl(rawAppUrl);
  if (!check.isValid || !check.isSafeToOpen) {
    showToast(
      bn
        ? `⚠️ অনিরাপদ বা অবৈধ আবেদন লিংক ব্লক করা হয়েছে: ${check.warnings[0] || ''}`
        : `⚠️ Blocked unsafe application URL: ${check.warnings[0] || 'Invalid link'}`
    );
    return { opened: false, reason: 'unsafe_url' };
  }

  if (check.warnings.length > 0) {
    const proceed = window.confirm(
      `${bn ? 'সতর্কতা:' : 'Security Warning:'}\n${check.warnings.join('\n')}\n\n${
        bn ? 'আপনি কি অফিশিয়াল আবেদন পেজটি খুলতে চান?' : 'Open this official application page?'
      }`
    );
    if (!proceed) return { opened: false, reason: 'cancelled' };
  }

  // Save local application context so Autofill knows which circular the user opened (never auto-marks Applied)
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    chrome.storage.local.set({
      jobfill_active_application_context: {
        jobId: job.id,
        organization: job.organization,
        position: job.position,
        applicationUrl: check.normalizedUrl,
        requiresLogin: classification.isLoginRequired,
        openedAt: Date.now(),
      },
    });
  }

  await openSafeExternalTab(check.normalizedUrl);
  return { opened: true };
}

export async function toggleJobBookmarkAndSync(
  jobId: string,
  jobs: NormalizedJobCircular[],
  existingApp: ApplicationTrackerRecord | undefined,
  showToast: (msg: string) => void,
  bn: boolean
): Promise<{ bookmarkedIds: Set<string>; applications: ApplicationTrackerRecord[] }> {
  const nowSaved = await BookmarkRepository.toggleBookmark(jobId);
  if (nowSaved && !existingApp) {
    const job = jobs.find((j) => j.id === jobId);
    if (job) {
      await ApplicationRepository.setStatus(job, 'Bookmarked');
    }
  }
  const [bookmarkedIds, applications] = await Promise.all([
    BookmarkRepository.getBookmarkedJobIds(),
    ApplicationRepository.getAll(),
  ]);
  showToast(
    nowSaved
      ? bn ? '🔖 চাকরি বুকমার্ক করা হয়েছে' : '🔖 Job bookmarked'
      : bn ? 'বুকমার্ক সরানো হয়েছে' : 'Bookmark removed'
  );
  return { bookmarkedIds, applications };
}

export async function markJobAppliedAndSync(
  job: NormalizedJobCircular,
  existingApp: ApplicationTrackerRecord | undefined,
  showToast: (msg: string) => void,
  bn: boolean
): Promise<ApplicationTrackerRecord[]> {
  const nextStatus = existingApp?.status === 'Applied' ? 'Ready to Apply' : 'Applied';
  await ApplicationRepository.setStatus(job, nextStatus);
  await NotificationScheduler.markJobAsApplied(job.id, nextStatus === 'Applied');
  await NotificationScheduler.runCycle();
  const applications = await ApplicationRepository.getAll();
  showToast(
    nextStatus === 'Applied'
      ? bn ? '✅ আবেদন সম্পন্ন হিসেবে চিহ্নিত (রিমাইন্ডার বন্ধ)' : '✅ Marked as Applied (reminders paused)'
      : bn ? 'অবস্থা আপডেট করা হয়েছে' : 'Status updated'
  );
  return applications;
}

export async function verifyJobManualDeadline(
  target: NormalizedJobCircular,
  newDeadlineText: string,
  showToast: (msg: string) => void,
  bn: boolean
): Promise<NormalizedJobCircular | null> {
  const parsed = parseDeadlineDate(newDeadlineText);
  if (!parsed.isVerified) return null;

  const updated = refreshJobStatus({
    ...target,
    deadlineAt: parsed.timestamp,
    deadlineText: newDeadlineText,
    deadlineVerified: true,
    deadlineNeedsRevalidation: false,
    lastUpdatedAt: Date.now(),
  });

  await JobRepository.saveJob(updated);
  await NotificationScheduler.runCycle();
  showToast(
    bn
      ? '✅ যাচাইকৃত শেষ তারিখ সংরক্ষিত হয়েছে ও রিমাইন্ডার চালু হয়েছে'
      : '✅ Verified deadline saved and reminders scheduled'
  );
  return updated;
}

export async function shareJobCircular(
  job: NormalizedJobCircular,
  showToast: (msg: string) => void,
  bn: boolean
): Promise<void> {
  const targetUrl = job.applicationUrl || job.circularUrl || job.sourceUrl || job.organizationUrl || '';
  const text = `${job.position} — ${job.organization}${targetUrl ? `\nLink: ${targetUrl}` : ''}`;
  try {
    await navigator.clipboard.writeText(text);
    showToast(bn ? '📋 সার্কুলার লিংক কপি হয়েছে' : '📋 Circular summary copied to clipboard');
  } catch {
    showToast(targetUrl || job.organization);
  }
}
