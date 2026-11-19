import { describe, it, expect } from 'vitest';
import { computeRealDashboardStats } from '../../src/dashboard/services/dashboard-stats';
import { sampleDemoProfile } from '../../src/types/defaults';
import { NormalizedJobCircular, ApplicationTrackerRecord, BookmarkRecord } from '../../src/jobs/types/job.types';

describe('Phase 6 — Real Dashboard Counters & Student/Job-Seeker Unified Stats Suite', () => {
  it('computes real zero counters when databases are empty (never fabricates counters)', () => {
    const profile = structuredClone(sampleDemoProfile);
    const stats = computeRealDashboardStats(profile, [], [], []);
    expect(stats).toEqual({
      totalActiveJobs: 0,
      matchingJobsCount: 0,
      bookmarkedJobsCount: 0,
      applicationsSubmittedCount: 0,
      upcomingDeadlinesCount: 0,
      upcomingExamsCount: 0,
    });
  });

  it('computes accurate active, eligible, bookmarked, submitted, closing-soon, and upcoming exam counts', () => {
    const now = Date.parse('2026-11-12T06:00:00Z');
    const profile = structuredClone(sampleDemoProfile);
    profile.personal.dob = '1999-05-10';
    profile.hasGraduation = true;
    profile.graduation.subjectDegree = 'Computer Science';
    profile.graduation.gpa = '3.75';
    profile.graduation.gpaScale = '4';

    const jobs: NormalizedJobCircular[] = [
      {
        id: 'j1',
        jobTitle: 'Assistant Programmer',
        position: 'Assistant Programmer',
        organization: 'BPSC',
        sourceId: 'bpsc',
        sourceName: 'BPSC',
        sourceUrl: 'https://bpsc.gov.bd',
        circularUrl: 'https://bpsc.gov.bd/c1.pdf',
        applicationUrl: 'https://bpsc.teletalk.com.bd',
        sourceVerification: 'official_verified',
        deadlineVerified: true,
        deadlineAt: now + 3 * 86_400_000,
        location: 'All Bangladesh',
        category: 'Government',
        qualification: 'Bachelor',
        experience: 'No experience required',
        ageRequirement: '18-30 years as on 2026-11-15',
        requirements: ['Bachelor in Computer Science with minimum CGPA 3.00'],
        description: 'All districts eligible',
        status: 'active',
        publishedAt: now - 86_400_000,
        lastUpdatedAt: now,
      },
      {
        id: 'j2',
        jobTitle: 'Expired Officer',
        position: 'Officer',
        organization: 'Other',
        sourceId: 'bb',
        sourceName: 'BB',
        sourceUrl: 'https://bb.org.bd',
        circularUrl: 'https://bb.org.bd/c2.pdf',
        applicationUrl: null,
        sourceVerification: 'official_partial',
        deadlineVerified: false,
        deadlineAt: null,
        location: 'All Bangladesh',
        category: 'Bank',
        qualification: 'Masters',
        requirements: [],
        description: '',
        status: 'expired',
        publishedAt: null,
        lastUpdatedAt: now,
      },
    ];

    const bookmarks: BookmarkRecord[] = [{ jobId: 'j1', savedAt: now }];
    const apps: ApplicationTrackerRecord[] = [
      {
        jobId: 'j1',
        jobTitle: 'Assistant Programmer',
        organization: 'BPSC',
        status: 'Exam Scheduled',
        deadlineAt: now + 3 * 86_400_000,
        examDate: '2026-11-20',
        createdAt: now,
        updatedAt: now,
      },
      {
        jobId: 'j_past',
        jobTitle: 'Old Role',
        organization: 'Org',
        status: 'Interested',
        deadlineAt: null,
        examDate: '2026-10-01', // past exam -> must NOT count as upcoming exam
        createdAt: now,
        updatedAt: now,
      },
    ];

    const stats = computeRealDashboardStats(profile, jobs, bookmarks, apps, now);
    expect(stats.totalActiveJobs).toBe(1);
    expect(stats.matchingJobsCount).toBe(1);
    expect(stats.bookmarkedJobsCount).toBe(1);
    expect(stats.applicationsSubmittedCount).toBe(1);
    expect(stats.upcomingDeadlinesCount).toBe(1);
    expect(stats.upcomingExamsCount).toBe(1);
  });
});
