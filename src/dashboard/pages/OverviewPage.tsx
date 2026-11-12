import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  FileText,
  Briefcase,
  GraduationCap,
  ExternalLink,
  Shield,
  Zap,
  Printer,
  KeyRound,
  CheckSquare,
  Bell,
  Bookmark,
  Clock,
  ClipboardList,
} from 'lucide-react';
import { UserProfile } from '../../types/profile';
import { calculateProfileScore } from '../../services/storage';
import { BioDataPrintModal } from '../components/BioDataPrintModal';
import { useApp } from '../context/AppContext';
import { JobRepository } from '../../jobs/database/job-repository';
import { BookmarkRepository } from '../../jobs/database/bookmark-repository';
import { ApplicationRepository } from '../../jobs/database/application-repository';
import { computeRealDashboardStats, DashboardRealStats } from '../services/dashboard-stats';

interface OverviewPageProps {
  profile: UserProfile;
  onNavigateTab: (tab: any) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({ profile, onNavigateTab }) => {
  const { language, userMode, setUserMode } = useApp();
  const [showBioPrint, setShowBioPrint] = useState(false);
  const [realStats, setRealStats] = useState<DashboardRealStats | null>(null);
  const score = calculateProfileScore(profile);

  useEffect(() => {
    let active = true;
    Promise.all([
      JobRepository.getAllJobs().catch(() => []),
      BookmarkRepository.getAll().catch(() => []),
      ApplicationRepository.getAll().catch(() => []),
    ]).then(([jobs, bookmarks, apps]) => {
      if (!active) return;
      setRealStats(computeRealDashboardStats(profile, jobs, bookmarks, apps));
    });
    return () => {
      active = false;
    };
  }, [profile]);

  return (
    <div className="space-y-6">
      {/* Hero Welcome Card */}
      <div className="bg-gradient-to-r from-petro-800 via-petro-700 to-navy-900 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 bg-white/10 text-petro-200 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm mb-3">
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            JobFill BD Assistant 2.0
          </div>
          <h2 className="text-2xl font-black tracking-tight mb-2">
            স্বাগতম, {profile.personal.applicantNameEn || 'চাকরিপ্রার্থী'}!
          </h2>
          <p className="text-sm text-petro-100 leading-relaxed">
            আপনার তথ্যগুলো এখানে একবার নির্ভুলভাবে পূরণ করুন। এরপর পেট্রোবাংলা, টেলিটক অলজবস, বিপিএসসি কিংবা যেকোনো সরকারি চাকরির আবেদন ফর্মে যান—সহকারী উইজেট নিমিষেই আপনার ফর্ম পূরণ করে দেবে।
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => setShowBioPrint(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-petro-800 hover:bg-petro-50 font-bold text-xs shadow-sm transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>
                {language === 'bn'
                  ? 'বায়ো-ডাটা / সিভি প্রিন্ট বা PDF'
                  : 'Print / Export Bio-Data PDF'}
              </span>
            </button>
          </div>
        </div>
        <div className="absolute right-6 -bottom-8 opacity-10 pointer-events-none text-9xl">
          📋
        </div>
      </div>

      {/* Completion & Readiness Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Progress Box */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm col-span-1">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Profile Readiness
            </span>
            <span className="text-xl font-black text-petro-600">{score.percentage}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5 mb-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-petro-500 to-emerald-500 h-2.5 rounded-full transition-all duration-700"
              style={{ width: `${score.percentage}%` }}
            />
          </div>
          <p className="text-xs text-slate-600 mb-4">
            {score.filledFields} of {score.totalFields} core fields completed.
          </p>

          {score.missingKeyFields.length > 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-900">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                বাকি থাকা গুরুত্বপূর্ণ ফিল্ডসমূহ:
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800">
                {score.missingKeyFields.slice(0, 4).map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>আপনার সব প্রাথমিক তথ্য প্রস্তুত! আপনি যেকোনো ফর্মে আবেদন করতে পারেন।</span>
            </div>
          )}
        </div>

        {/* Quick Stats Grid */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm col-span-2 grid grid-cols-3 gap-4">
          <div
            onClick={() => onNavigateTab('education')}
            className="p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-petro-500 hover:bg-petro-50/50 cursor-pointer transition-all"
          >
            <div className="w-8 h-8 rounded-lg bg-petro-100 text-petro-700 flex items-center justify-center mb-2">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div className="text-lg font-bold text-slate-800">
              {profile.hasGraduation ? (profile.hasMasters ? '4 Degrees' : '3 Degrees') : '2 Degrees'}
            </div>
            <div className="text-xs text-slate-500">SSC, HSC {profile.hasGraduation && '+ Higher'}</div>
          </div>

          <div
            onClick={() => onNavigateTab('experience')}
            className="p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-petro-500 hover:bg-petro-50/50 cursor-pointer transition-all"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center mb-2">
              <Briefcase className="w-4 h-4" />
            </div>
            <div className="text-lg font-bold text-slate-800">
              {profile.jobExperiences.length} Jobs
            </div>
            <div className="text-xs text-slate-500">Employment Records</div>
          </div>

          <div
            onClick={() => onNavigateTab('documents')}
            className="p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-petro-500 hover:bg-petro-50/50 cursor-pointer transition-all"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center mb-2">
              <FileText className="w-4 h-4" />
            </div>
            <div className="text-lg font-bold text-slate-800">Photo &amp; Sign</div>
            <div className="text-xs text-slate-500">300×300 / 300×80 px</div>
          </div>
        </div>
      </div>

      {/* Integrated Student & Job Seeker Real-Data Workspace Panel */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
              <span>{userMode === 'student' ? '🎓' : '💼'}</span>
              <span>
                {userMode === 'student'
                  ? language === 'bn'
                    ? 'স্টুডেন্ট ও ফ্রেশ গ্র্যাজুয়েট মোড (Student Focus)'
                    : 'Student & Fresh Graduate Workspace'
                  : language === 'bn'
                    ? 'চাকরিপ্রার্থী মোড (Job Seeker Focus)'
                    : 'Job Seeker Career Workspace'}
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">
              {userMode === 'student'
                ? 'Focused on academic records (SSC/HSC/University), internships, fresh grad jobs, eligibility check & ATS CV Builder.'
                : 'Focused on Govt, Bank, Teaching, NGO, Experience Profile, Application Tracker & Local Credential Vault.'}
            </p>
          </div>
          <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-[11px] font-bold shrink-0">
            <button
              type="button"
              onClick={() => setUserMode('student')}
              className={`px-3 py-1 rounded-lg cursor-pointer ${
                userMode === 'student' ? 'bg-petro-600 text-white' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              🎓 Student
            </button>
            <button
              type="button"
              onClick={() => setUserMode('job_seeker')}
              className={`px-3 py-1 rounded-lg cursor-pointer ${
                userMode === 'job_seeker' ? 'bg-petro-600 text-white' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              💼 Job Seeker
            </button>
          </div>
        </div>

        {/* 6 Real IndexedDB Counters (Never Fabricated) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <button
            type="button"
            onClick={() => onNavigateTab('circulars')}
            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-left hover:border-petro-500 cursor-pointer"
          >
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span>Total Jobs</span>
              <Briefcase className="w-3.5 h-3.5 text-petro-600" />
            </div>
            <div className="text-lg font-black text-slate-800 dark:text-white">
              {realStats ? realStats.totalActiveJobs : '—'}
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('eligibility')}
            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-left hover:border-petro-500 cursor-pointer"
          >
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span>Eligible</span>
              <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-lg font-black text-emerald-700 dark:text-emerald-400">
              {realStats ? realStats.matchingJobsCount : '—'}
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('circulars')}
            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-left hover:border-petro-500 cursor-pointer"
          >
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span>Bookmarked</span>
              <Bookmark className="w-3.5 h-3.5 text-sky-600" />
            </div>
            <div className="text-lg font-black text-slate-800 dark:text-white">
              {realStats ? realStats.bookmarkedJobsCount : '—'}
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('tracker')}
            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-left hover:border-petro-500 cursor-pointer"
          >
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span>Submitted</span>
              <ClipboardList className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <div className="text-lg font-black text-slate-800 dark:text-white">
              {realStats ? realStats.applicationsSubmittedCount : '—'}
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('circulars')}
            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-left hover:border-petro-500 cursor-pointer"
          >
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span>Closing ≤7d</span>
              <Clock className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div className="text-lg font-black text-amber-700 dark:text-amber-400">
              {realStats ? realStats.upcomingDeadlinesCount : '—'}
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('notifications')}
            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-left hover:border-petro-500 cursor-pointer"
          >
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span>Upcoming Exams</span>
              <Bell className="w-3.5 h-3.5 text-rose-600" />
            </div>
            <div className="text-lg font-black text-rose-700 dark:text-rose-400">
              {realStats ? realStats.upcomingExamsCount : '—'}
            </div>
          </button>
        </div>

        {/* Mode-Contextual Quick Shortcuts (all features remain accessible in both modes) */}
        <div className="flex flex-wrap gap-2 pt-1 text-xs">
          <button
            type="button"
            onClick={() => onNavigateTab(userMode === 'student' ? 'education' : 'credentials')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-petro-50 text-petro-800 border border-petro-200 font-bold hover:bg-petro-100 cursor-pointer"
          >
            {userMode === 'student' ? <GraduationCap className="w-3.5 h-3.5" /> : <KeyRound className="w-3.5 h-3.5" />}
            <span>{userMode === 'student' ? 'Academic Profile (SSC/HSC/Uni)' : 'Local Credential Vault'}</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('eligibility')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold hover:bg-slate-200 cursor-pointer"
          >
            <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
            <span>Check Job Eligibility</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('cv_builder')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold hover:bg-slate-200 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-indigo-600" />
            <span>ATS CV Builder (EN / বাংলা)</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab(userMode === 'student' ? 'exam_center' : 'readiness')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold hover:bg-slate-200 cursor-pointer"
          >
            <span>{userMode === 'student' ? '📚 Exam & Vocabulary Prep' : '✅ Application Readiness'}</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab(userMode === 'student' ? 'opportunities' : 'calendar')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold hover:bg-slate-200 cursor-pointer"
          >
            <span>{userMode === 'student' ? '🎓 Scholarships & Internships' : '📅 Career & Exam Calendar'}</span>
          </button>
        </div>
      </div>

      {/* Local Test Pages Sandbox (dev/testing builds only) */}
      {!(typeof __JOBFILL_STORE_CLEAN__ !== 'undefined' && __JOBFILL_STORE_CLEAN__) && (
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span>🧪</span>
              <span>লোকাল টেস্ট পেজসমূহ (Offline Test Forms)</span>
            </h3>
            <p className="text-xs text-slate-500">
              রিয়েল সাইটে যাওয়ার আগেই লোকাল টেস্ট ফর্মে এক্সটেনশনের কার্যকারিতা পরীক্ষা করে নিন।
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a
            href="test-pages/petrobangla-form.html"
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 rounded-xl border border-petro-200 bg-petro-50/50 hover:bg-petro-100/60 transition-all flex items-start justify-between group"
          >
            <div>
              <div className="font-bold text-sm text-petro-900 group-hover:text-petro-700 flex items-center gap-1.5">
                PetroBangla / BOGMC Form Replica
                <ExternalLink className="w-3.5 h-3.5 opacity-60" />
              </div>
              <p className="text-xs text-slate-600 mt-1">
                হুবহু ৪টি স্ক্রিনশটের মতো ফিল্ড: Basic Information, Address, SSC/HSC/Graduation/Masters, Job Experience ও Organization Choice।
              </p>
            </div>
          </a>

          <a
            href="test-pages/teletalk-form.html"
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-all flex items-start justify-between group"
          >
            <div>
              <div className="font-bold text-sm text-slate-800 group-hover:text-petro-700 flex items-center gap-1.5">
                Standard Teletalk Alljobs Form
                <ExternalLink className="w-3.5 h-3.5 opacity-60" />
              </div>
              <p className="text-xs text-slate-600 mt-1">
                টেলিটক অলজবস সিভি ফরম্যাট এবং বিভিন্ন মন্ত্রণালয় ও অধিদপ্তরের স্ট্যান্ডার্ড রিক্রুটমেন্ট ফর্ম টেস্ট।
              </p>
            </div>
          </a>

          <a
            href="test-pages/bpsc-bcs-form.html"
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-all flex items-start justify-between group"
          >
            <div>
              <div className="font-bold text-sm text-slate-800 group-hover:text-petro-700 flex items-center gap-1.5">
                BPSC (47th BCS Form-1 Simulation)
                <ExternalLink className="w-3.5 h-3.5 opacity-60" />
              </div>
              <p className="text-xs text-slate-600 mt-1">
                উচ্চতা, ওজন, বুকের মাপ, ক্যাডার পছন্দক্রম ও বিশেষ বিসিএস ফিল্ড টেস্ট।
              </p>
            </div>
          </a>

          <a
            href="test-pages/dependent-dropdown.html"
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-all flex items-start justify-between group"
          >
            <div>
              <div className="font-bold text-sm text-slate-800 group-hover:text-petro-700 flex items-center gap-1.5">
                Cascading Dependent Dropdown Test
                <ExternalLink className="w-3.5 h-3.5 opacity-60" />
              </div>
              <p className="text-xs text-slate-600 mt-1">
                বিভাগ ➔ জেলা ➔ উপজেলা রিয়েল-টাইম ক্যাসকেডিং নির্বাচন প্রক্রিয়া টেস্ট।
              </p>
            </div>
          </a>
        </div>
      </div>
      )}

      {/* Privacy Guarantee Note */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-3 text-xs text-slate-600">
        <Shield className="w-5 h-5 text-petro-600 shrink-0" />
        <div>
          <strong>গোপনীয়তা নিশ্চয়তা (Zero Remote Transmission):</strong> JobFill BD সম্পূর্ণ অফলাইন প্রযুক্তিতে চলে। আপনার কোনো সংবেদনশীল তথ্য (NID, মোবাইল, জন্মতারিখ) কোনো বহিরাগত সার্ভারে পাঠানো হয় না।
        </div>
      </div>

      {showBioPrint && (
        <BioDataPrintModal
          profile={profile}
          language={language}
          onClose={() => setShowBioPrint(false)}
        />
      )}
    </div>
  );
};
