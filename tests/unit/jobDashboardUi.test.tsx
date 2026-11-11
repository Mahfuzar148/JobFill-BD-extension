// JobFill BD - Job Circular Dashboard, Popup, Sidebar & Notification Center UI Integration Tests

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AppProvider } from '../../src/dashboard/context/AppContext';
import { Sidebar } from '../../src/dashboard/components/Sidebar';
import { App as PopupApp } from '../../src/popup/App';
import { JobCircularPage } from '../../src/jobs/dashboard/JobCircularPage';
import { NotificationCenterPage } from '../../src/jobs/dashboard/NotificationCenterPage';
import { ApplicationTracker } from '../../src/jobs/dashboard/ApplicationTracker';
import { JobRepository } from '../../src/jobs/database/job-repository';
import { JobNotificationRepository } from '../../src/jobs/database/notification-repository';
import { ApplicationRepository } from '../../src/jobs/database/application-repository';
import { BookmarkRepository } from '../../src/jobs/database/bookmark-repository';
import { normalizeJobRecord } from '../../src/jobs/services/job-normalizer';
import { DAY_MS } from '../../src/jobs/services/deadline-parser';

async function flushUi() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
}

describe('JobFill BD - UI Integration (Popup, Sidebar, Job Circular Dashboard, Notifications, Tracker)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    localStorage.setItem('jobfill_language', 'en');
    await JobRepository.clearAll();
    await JobNotificationRepository.clearAll();
    await ApplicationRepository.clearAll();
    await BookmarkRepository.clearAll();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('Popup includes prominent Job Circulars button alongside existing Autofill UI', async () => {
    await act(async () => {
      root.render(<PopupApp />);
    });
    await flushUi();

    expect(container.textContent).toContain('Auto Fill Now');
    expect(container.textContent).toContain('Job Circulars');
    expect(container.textContent).toContain('Full Dashboard');
  });

  it('Sidebar preserves all existing items and adds Job Circulars, Notification Center & Application Tracker', async () => {
    await act(async () => {
      root.render(
        <AppProvider>
          <Sidebar
            activeTab="circulars"
            onSelectTab={() => {}}
            completionScore={90}
            unreadNotificationsCount={3}
            closingSoonCount={2}
          />
        </AppProvider>
      );
    });
    await flushUi();

    expect(container.textContent).toContain('Job Circulars');
    expect(container.textContent).toContain('Notification Center');
    expect(container.textContent).toContain('Application Tracker');
    expect(container.textContent).toContain('2 Soon');
    expect(container.textContent).toContain('3');
    // Existing items preserved
    expect(container.textContent).toContain('Personal Info');
    expect(container.textContent).toContain('Smart Auto Fill');
    expect(container.textContent).toContain('Security & Vault');
  });

  it('JobCircularPage renders 6 summary cards, verified deadlines, unverified deadline notice, and search', async () => {
    const now = Date.now();
    const verifiedJob = normalizeJobRecord(
      {
        externalId: 'ui_job_1',
        organization: 'Bangladesh Bank',
        jobTitle: 'Assistant Director',
        position: 'Assistant Director',
        category: 'Bank',
        qualification: 'Masters',
        location: 'Dhaka',
        deadlineText: new Date(now + 4 * DAY_MS).toISOString(),
        applicationUrl: 'https://erecruitment.bb.org.bd/onlineapp/joblist.php',
      },
      {
        sourceId: 'bangladesh_bank',
        sourceName: 'Bangladesh Bank Recruitment',
        verificationLevel: 'official_verified',
        checkedAt: now,
        defaultApplicationUrl: 'https://erecruitment.bb.org.bd/',
      }
    );

    const unverifiedJob = normalizeJobRecord(
      {
        externalId: 'ui_job_2',
        organization: 'BPSC',
        jobTitle: '48th BCS Notice',
        position: '48th BCS Notice',
        category: 'Government',
        applicationUrl: 'https://bpsc.teletalk.com.bd/',
      },
      {
        sourceId: 'bpsc',
        sourceName: 'BPSC',
        verificationLevel: 'official_verified',
        checkedAt: now,
        defaultApplicationUrl: 'https://bpsc.teletalk.com.bd/',
      }
    );

    await JobRepository.saveJobs([verifiedJob, unverifiedJob]);

    await act(async () => {
      root.render(
        <AppProvider>
          <JobCircularPage />
        </AppProvider>
      );
    });
    await flushUi();

    const text = container.textContent || '';
    expect(text).toContain('Total Job Circulars');
    expect(text).toContain('New This Week');
    expect(text).toContain('Closing Soon');
    expect(text).toContain('Deadline Passed');
    expect(text).toContain('Bookmarked Jobs');
    expect(text).toContain('Application In Progress');

    expect(text).toContain('Assistant Director');
    expect(text).toContain('48th BCS Notice');
    expect(text).toContain('Deadline Not Verified');
  });

  it('NotificationCenterPage & ApplicationTracker render all required tabs and statuses', async () => {
    await JobNotificationRepository.add({
      id: 'ui_notif_1',
      type: 'urgent_deadline',
      title: 'URGENT: Assistant Programmer',
      message: 'URGENT: Only 48 hours left to apply!',
      jobId: 'j1',
      jobTitle: 'Assistant Programmer',
      organization: 'Example Dept',
      isUrgent: true,
      isRead: false,
      createdAt: Date.now(),
    });

    await act(async () => {
      root.render(
        <NotificationCenterPage
          language="en"
          onOpenJobDetails={() => {}}
        />
      );
    });
    await flushUi();

    const nText = container.textContent || '';
    expect(nText).toContain('Notification Center');
    expect(nText).toContain('New Jobs');
    expect(nText).toContain('Deadline Reminders');
    expect(nText).toContain('Urgent');
    expect(nText).toContain('Applied');
    expect(nText).toContain('Expired');
    expect(nText).toContain('URGENT: Only 48 hours left to apply!');

    await act(async () => {
      root.render(
        <ApplicationTracker
          language="en"
          records={[
            {
              jobId: 'j1',
              jobTitle: 'Assistant Programmer',
              organization: 'Example Dept',
              deadlineAt: null,
              status: 'Applied',
              applicationDate: '2026-11-10',
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          ]}
          onUpdateRecord={async () => {}}
          onDeleteRecord={async () => {}}
        />
      );
    });
    await flushUi();

    const tText = container.textContent || '';
    expect(tText).toContain('Application Tracker');
    expect(tText).toContain('Assistant Programmer');
    expect(tText).toContain('Exam Scheduled');
    expect(tText).toContain('Result Published');
  });
});
