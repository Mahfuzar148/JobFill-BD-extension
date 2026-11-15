// JobFill BD - Dedicated Government Jobs Overview Section for Main Dashboard
// Displays live real-time statistics from IndexedDB, recruitment updates, and quick access to government source categories.
// Follows user's exact specification:
// - All Government Jobs (includes all saved records, even expired)
// - New Circulars, Closing Soon, Exam Updates
// - 8 Government Source Categories
// - Direct "Explore All Government Jobs" navigation

import React, { useState, useEffect } from 'react';
import {
  Landmark,
  Building2,
  Calendar,
  Clock,
  Award,
  Shield,
  ArrowRight,
  Sparkles,
  FileText,
  AlertCircle,
  GraduationCap,
  HeartPulse,
  Banknote,
  MapPin,
  ExternalLink,
} from 'lucide-react';
import { JobRepository } from '../../jobs/database/job-repository';
import { NormalizedJobCircular } from '../../jobs/types/job.types';
import { DAY_MS, isTimestampInCurrentDhakaWeek } from '../../jobs/services/deadline-parser';
import { GovernmentSourceRegistry } from '../../jobs/sources/government-registry/government-source-registry';
import { GovernmentSourceGroup } from '../../jobs/types/government.types';

interface GovernmentJobsOverviewSectionProps {
  language?: 'bn' | 'en';
  onNavigateTab: (tab: string, filterOptions?: any) => void;
}

interface GovtStats {
  allGovtJobsCount: number;
  newCircularsCount: number;
  closingSoonCount: number;
  examUpdatesCount: number;
}

export const GovernmentJobsOverviewSection: React.FC<GovernmentJobsOverviewSectionProps> = ({
  language = 'en',
  onNavigateTab,
}) => {
  const isBn = language === 'bn';

  const [stats, setStats] = useState<GovtStats>({
    allGovtJobsCount: 0,
    newCircularsCount: 0,
    closingSoonCount: 0,
    examUpdatesCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeSourcesCount, setActiveSourcesCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function loadGovtData() {
      try {
        const allJobs = await JobRepository.getAllJobs();
        const now = Date.now();

        // Filter government jobs (category === 'Government' or government source/taxonomy)
        const govtJobs = allJobs.filter(
          (j) =>
            j.category === 'Government' ||
            j.taxonomyCategoryId === 'govt_public' ||
            ['bpsc', 'teletalk', 'national-portal', 'dpe', 'ntrca'].includes(j.sourceId) ||
            j.employerType === 'Government Ministry' ||
            j.employerType === 'Directorate / Department'
        );

        // 1. All Government Jobs: includes ALL saved records regardless of whether expired or active (User Rule 3)
        const allGovtJobsCount = govtJobs.length;

        // 2. New Circulars: discovered in current week
        const newCircularsCount = govtJobs.filter((j) =>
          isTimestampInCurrentDhakaWeek(j.publishedAt, now) || (now - j.firstDiscoveredAt <= 7 * DAY_MS)
        ).length;

        // 3. Closing Soon: active and deadline within 7 days
        const closingSoonCount = govtJobs.filter(
          (j) =>
            j.deadlineVerified &&
            typeof j.deadlineAt === 'number' &&
            j.deadlineAt > now &&
            j.deadlineAt - now <= 7 * DAY_MS
        ).length;

        // 4. Exam Updates: notices linked or exam/result updates
        const examUpdatesCount = govtJobs.filter(
          (j) =>
            /পরীক্ষা|ফলাফল|এডমিট|admit|result|exam/i.test(j.jobTitle || '') ||
            (j.requirements && j.requirements.some((r) => /পরীক্ষা|admit/i.test(r)))
        ).length;

        if (mounted) {
          setStats({
            allGovtJobsCount,
            newCircularsCount,
            closingSoonCount,
            examUpdatesCount,
          });
          setActiveSourcesCount(GovernmentSourceRegistry.getActiveSources().length);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to compute government overview stats:', err);
        if (mounted) setLoading(false);
      }
    }

    loadGovtData();
    return () => {
      mounted = false;
    };
  }, []);

  const SOURCE_CATEGORIES: Array<{
    id: GovernmentSourceGroup;
    labelEn: string;
    labelBn: string;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
  }> = [
    {
      id: 'central_aggregators',
      labelEn: 'Central Government',
      labelBn: 'কেন্দ্রীয় সরকার',
      icon: Landmark,
      accentColor: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800',
    },
    {
      id: 'ministries_divisions',
      labelEn: 'Ministry & Directorate',
      labelBn: 'মন্ত্রণালয় ও অধিদপ্তর',
      icon: Building2,
      accentColor: 'text-teal-600 bg-teal-50 dark:bg-teal-950/50 border-teal-200 dark:border-teal-800',
    },
    {
      id: 'public_service_commissions',
      labelEn: 'BCS & PSC',
      labelBn: 'বিসিএস ও কর্ম কমিশন',
      icon: Award,
      accentColor: 'text-amber-600 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800',
    },
    {
      id: 'defence_uniformed',
      labelEn: 'Defence & Forces',
      labelBn: 'প্রতিরক্ষা ও পুলিশ বাহিনী',
      icon: Shield,
      accentColor: 'text-rose-600 bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800',
    },
    {
      id: 'government_financial',
      labelEn: 'Government Banks',
      labelBn: 'বাংলাদেশ ব্যাংক ও সরকারি ব্যাংক',
      icon: Banknote,
      accentColor: 'text-sky-600 bg-sky-50 dark:bg-sky-950/50 border-sky-200 dark:border-sky-800',
    },
    {
      id: 'public_education',
      labelEn: 'Education & Research',
      labelBn: 'শিক্ষা ও বিশ্ববিদ্যালয়',
      icon: GraduationCap,
      accentColor: 'text-violet-600 bg-violet-50 dark:bg-violet-950/50 border-violet-200 dark:border-violet-800',
    },
    {
      id: 'public_healthcare',
      labelEn: 'Healthcare & Hospitals',
      labelBn: 'স্বাস্থ্য ও মেডিকেল কলেজ',
      icon: HeartPulse,
      accentColor: 'text-red-600 bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800',
    },
    {
      id: 'district_local_govt',
      labelEn: 'District Offices',
      labelBn: 'জেলা প্রশাসন ও স্থানীয় সরকার',
      icon: MapPin,
      accentColor: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800',
    },
  ];

  return (
    <div
      data-testid="government-jobs-overview-section"
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-5 transition-colors"
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shrink-0">
            <Landmark className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-800 dark:text-white">
                {isBn ? 'সরকারি চাকরির সার্কুলার হাব' : 'Government Job Circulars'}
              </h2>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                {isBn ? 'ডেডিকেটেড সরকারি বিভাগ' : 'Dedicated Section'}
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {isBn ? `${activeSourcesCount}টি সক্রিয় সোর্স` : `${activeSourcesCount} Active Sources`}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isBn
                ? 'মন্ত্রণালয়, অধিদপ্তর, বিপিএসসি, ব্যাংক ও সশস্ত্র বাহিনীর অনুমোদিত সার্কুলার ও পরীক্ষার আপডেট।'
                : 'Aggregated recruitment circulars, examination schedules and results from verified public portals.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigateTab('circulars', { sourceGroup: 'government_portals', statusTab: 'all' })}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs cursor-pointer transition-colors self-start sm:self-auto"
        >
          <span>{isBn ? 'সব সরকারি চাকরি দেখুন' : 'Explore All Government Jobs'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 4 Core Real-time Metric Cards (Computed from Source Database) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: All Government Jobs (Includes expired & active) */}
        <div
          onClick={() => onNavigateTab('circulars', { sourceGroup: 'government_portals', statusTab: 'all' })}
          className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 hover:border-emerald-400 dark:hover:border-emerald-600 cursor-pointer transition-all space-y-1"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold">
            <span>{isBn ? 'সব সরকারি চাকরি' : 'All Government Jobs'}</span>
            <FileText className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {loading ? '—' : stats.allGovtJobsCount}
          </div>
          <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
            {isBn ? 'সংরক্ষিত সকল বৈধ সার্কুলার' : 'All verified saved circulars'}
          </p>
        </div>

        {/* Card 2: New Circulars */}
        <div
          onClick={() => onNavigateTab('circulars', { sourceGroup: 'government_portals', statusTab: 'newly_discovered' })}
          className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/70 hover:border-emerald-500 cursor-pointer transition-all space-y-1"
        >
          <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
            <span>{isBn ? 'নতুন সার্কুলার' : 'New Circulars'}</span>
            <Sparkles className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
            {loading ? '—' : stats.newCircularsCount}
          </div>
          <p className="text-[10.5px] text-emerald-600 dark:text-emerald-400">
            {isBn ? 'চলতি সপ্তাহে প্রকাশিত' : 'Discovered this week'}
          </p>
        </div>

        {/* Card 3: Closing Soon */}
        <div
          onClick={() => onNavigateTab('circulars', { sourceGroup: 'government_portals', statusTab: 'closing_soon' })}
          className="p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 hover:border-amber-500 cursor-pointer transition-all space-y-1"
        >
          <div className="flex items-center justify-between text-amber-800 dark:text-amber-300 text-xs font-semibold">
            <span>{isBn ? 'শীঘ্রই শেষ' : 'Closing Soon'}</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-700 dark:text-amber-300">
            {loading ? '—' : stats.closingSoonCount}
          </div>
          <p className="text-[10.5px] text-amber-600 dark:text-amber-400">
            {isBn ? '৭ দিনের মধ্যে মেয়াদ শেষ' : 'Deadline within 7 days'}
          </p>
        </div>

        {/* Card 4: Exam Updates */}
        <div
          onClick={() => onNavigateTab('circulars', { sourceGroup: 'government_portals', query: 'পরীক্ষা' })}
          className="p-3.5 rounded-xl bg-sky-50/60 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/70 hover:border-sky-500 cursor-pointer transition-all space-y-1"
        >
          <div className="flex items-center justify-between text-sky-800 dark:text-sky-300 text-xs font-semibold">
            <span>{isBn ? 'পরীক্ষা ও ফলাফল' : 'Exam Updates'}</span>
            <Calendar className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-black text-sky-700 dark:text-sky-300">
            {loading ? '—' : stats.examUpdatesCount}
          </div>
          <p className="text-[10.5px] text-sky-600 dark:text-sky-400">
            {isBn ? 'এডমিট, পরীক্ষার সূচি ও ফল' : 'Admit card, exam & viva dates'}
          </p>
        </div>
      </div>

      {/* Source Categories Grid (8 Government Groups) */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
          {isBn ? 'সরকারি নিয়োগ সোর্স ক্যাটাগরি' : 'Source Categories'}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SOURCE_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onNavigateTab('circulars', { sourceGroup: 'government_portals', governmentGroup: cat.id })}
                className={`p-2.5 rounded-xl border flex items-center gap-2 text-left text-xs font-semibold hover:shadow-xs transition-all cursor-pointer ${cat.accentColor}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{isBn ? cat.labelBn : cat.labelEn}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
