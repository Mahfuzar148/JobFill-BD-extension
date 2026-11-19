import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  ExternalLink,
  SlidersHorizontal,
  ShieldCheck,
  Search,
  UserCheck,
  GraduationCap,
  MapPin,
  Calendar,
  Briefcase,
  Info,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { UserProfile } from '../../types/profile';
import { NormalizedJobCircular } from '../../jobs/types/job.types';
import { JobRepository } from '../../jobs/database/job-repository';
import {
  evaluateProfileEligibility,
  EligibilityVerdict,
  ParsedJobRequirements,
  FullEligibilityReport,
} from '../../jobs/services/eligibility-helper';
import { openSafeExternalTab } from '../../jobs/services/job-ui-actions';

interface EligibilityCheckerPageProps {
  profile: UserProfile;
  onOpenJobCircular?: (jobId: string) => void;
}

type VerdictFilterType = 'ALL' | 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'MANUAL_REVIEW_REQUIRED' | 'INSUFFICIENT_PROFILE_DATA';

const VERDICT_CONFIG: Record<
  string,
  { en: string; bn: string; cls: string; borderCls: string; textCls: string; dotCls: string }
> = {
  ELIGIBLE: {
    en: 'ELIGIBLE',
    bn: 'যোগ্য (ELIGIBLE)',
    cls: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
    borderCls: 'border-emerald-500',
    textCls: 'text-emerald-700 dark:text-emerald-400',
    dotCls: 'bg-emerald-500',
  },
  NOT_ELIGIBLE: {
    en: 'NOT ELIGIBLE',
    bn: 'যোগ্য নন (NOT ELIGIBLE)',
    cls: 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800',
    borderCls: 'border-rose-500',
    textCls: 'text-rose-700 dark:text-rose-400',
    dotCls: 'bg-rose-500',
  },
  MANUAL_REVIEW_REQUIRED: {
    en: 'MANUAL REVIEW REQUIRED',
    bn: 'ম্যানুয়াল যাচাই প্রয়োজন',
    cls: 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
    borderCls: 'border-amber-500',
    textCls: 'text-amber-700 dark:text-amber-400',
    dotCls: 'bg-amber-500',
  },
  NEEDS_MANUAL_VERIFICATION: {
    en: 'MANUAL REVIEW REQUIRED',
    bn: 'ম্যানুয়াল যাচাই প্রয়োজন',
    cls: 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
    borderCls: 'border-amber-500',
    textCls: 'text-amber-700 dark:text-amber-400',
    dotCls: 'bg-amber-500',
  },
  INSUFFICIENT_PROFILE_DATA: {
    en: 'INSUFFICIENT PROFILE DATA',
    bn: 'প্রোফাইল তথ্য অসম্পূর্ণ',
    cls: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800',
    borderCls: 'border-indigo-500',
    textCls: 'text-indigo-700 dark:text-indigo-400',
    dotCls: 'bg-indigo-500',
  },
};

export const EligibilityCheckerPage: React.FC<EligibilityCheckerPageProps> = ({
  profile,
  onOpenJobCircular,
}) => {
  const { language } = useApp();
  const bn = language === 'bn';

  const [jobs, setJobs] = useState<NormalizedJobCircular[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [verdictFilter, setVerdictFilter] = useState<VerdictFilterType>('ALL');
  const [searchText, setSearchText] = useState('');
  const [overridesByJob, setOverridesByJob] = useState<Record<string, Partial<ParsedJobRequirements>>>({});
  const [showOverridePanel, setShowOverridePanel] = useState(false);

  useEffect(() => {
    let active = true;
    JobRepository.getAllJobs()
      .then((list) => {
        if (!active) return;
        const activeJobs = list.filter((j) => j.status !== 'expired');
        setJobs(activeJobs);
        if (activeJobs.length > 0 && !selectedJobId) {
          setSelectedJobId(activeJobs[0].id);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Compute all reports reactively when profile or jobs change
  const allEvaluations = useMemo(() => {
    return jobs.map((job) => ({
      job,
      report: evaluateProfileEligibility(profile, job, overridesByJob[job.id]),
    }));
  }, [jobs, profile, overridesByJob]);

  // Aggregate verdict metrics
  const stats = useMemo(() => {
    const total = allEvaluations.length;
    const eligible = allEvaluations.filter((e) => e.report.overallStatus === 'ELIGIBLE').length;
    const notEligible = allEvaluations.filter((e) => e.report.overallStatus === 'NOT_ELIGIBLE').length;
    const manualReview = allEvaluations.filter(
      (e) => e.report.overallStatus === 'MANUAL_REVIEW_REQUIRED' || e.report.overallStatus === 'NEEDS_MANUAL_VERIFICATION'
    ).length;
    const insufficient = allEvaluations.filter((e) => e.report.overallStatus === 'INSUFFICIENT_PROFILE_DATA').length;
    return { total, eligible, notEligible, manualReview, insufficient };
  }, [allEvaluations]);

  // Filtered list according to search query and selected verdict tab
  const evaluatedList = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return allEvaluations
      .filter(({ job }) => {
        if (!q) return true;
        return (
          job.jobTitle.toLowerCase().includes(q) ||
          job.position?.toLowerCase().includes(q) ||
          job.organization.toLowerCase().includes(q) ||
          String(job.qualification || '').toLowerCase().includes(q)
        );
      })
      .filter(({ report }) => {
        if (verdictFilter === 'ALL') return true;
        if (verdictFilter === 'MANUAL_REVIEW_REQUIRED') {
          return report.overallStatus === 'MANUAL_REVIEW_REQUIRED' || report.overallStatus === 'NEEDS_MANUAL_VERIFICATION';
        }
        return report.overallStatus === verdictFilter;
      });
  }, [allEvaluations, searchText, verdictFilter]);

  const selectedEntry = useMemo(
    () =>
      evaluatedList.find((e) => e.job.id === selectedJobId) ||
      evaluatedList[0] ||
      null,
    [evaluatedList, selectedJobId]
  );

  const renderStatusIcon = (status: FullEligibilityReport['criteria'][number]['status']) => {
    if (status === 'Matched') return <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />;
    if (status === 'Failed') return <XCircle className="w-4 h-4 text-rose-600 shrink-0" />;
    if (status === 'Missing Profile Data') return <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />;
    return <HelpCircle className="w-4 h-4 text-slate-400 shrink-0" />;
  };

  const getStatusBadge = (status: FullEligibilityReport['criteria'][number]['status']) => {
    switch (status) {
      case 'Matched':
        return {
          label: bn ? 'মিলেছে' : 'Matched',
          cls: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300',
        };
      case 'Failed':
        return {
          label: bn ? 'মেলেনি' : 'Failed',
          cls: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300',
        };
      case 'Missing Profile Data':
        return {
          label: bn ? 'তথ্য প্রয়োজন' : 'Missing Data',
          cls: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300',
        };
      case 'Needs Verification':
        return {
          label: bn ? 'যাচাই প্রয়োজন' : 'Needs Review',
          cls: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-950/60 dark:text-yellow-300',
        };
      default:
        return {
          label: bn ? 'উন্মুক্ত / সাধারণ' : 'Open / General',
          cls: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300',
        };
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-petro-600 shrink-0" />
            <span>{bn ? 'স্মার্ট যোগ্যতা যাচাইকারী (Intelligent Job Eligibility Engine)' : 'Job Eligibility Checker'}</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-3xl">
            {bn
              ? 'আপনার বর্তমান প্রোফাইলের শিক্ষাগত স্তর (SSC, HSC, স্নাতক, স্নাতকোত্তর), বিষয়, জিপিএ/সিজিপিএ, বয়স ও জেলা কোটার সাথে প্রতিটি বিজ্ঞপ্তির শর্ত নির্ভরযোগ্যভাবে তুলনা করা হয়।'
              : 'Verifies your profile academic levels, disciplines, GPA, cutoff age, and district quotas against circular conditions with zero fabricated decisions.'}
          </p>
        </div>
      </div>

      {/* Candidate Profile Snapshot Card */}
      {selectedEntry && (
        <div className="bg-linear-to-r from-petro-50 via-slate-50 to-indigo-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 rounded-2xl border border-petro-200 dark:border-slate-700 p-4 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-bold text-petro-800 dark:text-petro-300 mb-2.5">
            <UserCheck className="w-4 h-4 text-petro-600" />
            <span>{bn ? 'সক্রিয় আবেদনকারী প্রোফাইল স্ন্যাপশট' : 'Active Applicant Profile Snapshot'}</span>
            <span className="font-semibold text-slate-500 ml-1">({profile.profileName || 'Default'})</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700">
              <span className="text-[11px] font-semibold text-slate-500 block mb-0.5">
                {bn ? 'সর্বোচ্চ শিক্ষাগত স্তর' : 'Highest Education'}
              </span>
              <span className="font-extrabold text-slate-800 dark:text-white flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5 text-petro-600 shrink-0" />
                <span className="truncate">{selectedEntry.report.candidateOverview.highestDegreeTitle}</span>
              </span>
            </div>

            <div className="bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700">
              <span className="text-[11px] font-semibold text-slate-500 block mb-0.5">
                {bn ? 'মাধ্যমিক ও উচ্চ মাধ্যমিক' : 'SSC & HSC'}
              </span>
              <span className="font-bold text-slate-700 dark:text-slate-200 truncate block">
                {selectedEntry.report.candidateOverview.sscText.split('(')[0].trim()} • {selectedEntry.report.candidateOverview.hscText.split('(')[0].trim()}
              </span>
            </div>

            <div className="bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700">
              <span className="text-[11px] font-semibold text-slate-500 block mb-0.5">
                {bn ? 'স্থায়ী জেলা (কোটা ক্ষেত্র)' : 'Permanent District'}
              </span>
              <span className="font-extrabold text-slate-800 dark:text-white flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span>{selectedEntry.report.candidateOverview.permanentDistrict || (bn ? 'দেওয়া হয়নি' : 'Not set')}</span>
              </span>
            </div>

            <div className="bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700">
              <span className="text-[11px] font-semibold text-slate-500 block mb-0.5">
                {bn ? 'জন্ম তারিখ ও কোটা' : 'DOB & Quota'}
              </span>
              <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span>{profile.personal?.dob || 'N/A'} ({profile.personal?.quota || 'General'})</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
        {/* Quick Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setVerdictFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
              verdictFilter === 'ALL'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {bn ? 'সব সার্কুলার' : 'All Circulars'} ({stats.total})
          </button>

          <button
            type="button"
            onClick={() => setVerdictFilter('ELIGIBLE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              verdictFilter === 'ELIGIBLE'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{bn ? 'যোগ্য' : 'Eligible'}</span>
            <span className="text-[11px] opacity-80">({stats.eligible})</span>
          </button>

          <button
            type="button"
            onClick={() => setVerdictFilter('MANUAL_REVIEW_REQUIRED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              verdictFilter === 'MANUAL_REVIEW_REQUIRED'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{bn ? 'ম্যানুয়াল যাচাই' : 'Manual Review'}</span>
            <span className="text-[11px] opacity-80">({stats.manualReview})</span>
          </button>

          <button
            type="button"
            onClick={() => setVerdictFilter('NOT_ELIGIBLE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              verdictFilter === 'NOT_ELIGIBLE'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>{bn ? 'যোগ্য নন' : 'Not Eligible'}</span>
            <span className="text-[11px] opacity-80">({stats.notEligible})</span>
          </button>

          <button
            type="button"
            onClick={() => setVerdictFilter('INSUFFICIENT_PROFILE_DATA')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              verdictFilter === 'INSUFFICIENT_PROFILE_DATA'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>{bn ? 'তথ্য অসম্পূর্ণ' : 'Insufficient Data'}</span>
            <span className="text-[11px] opacity-80">({stats.insufficient})</span>
          </button>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={bn ? 'পদের নাম, প্রতিষ্ঠান বা ডিগ্রি লিখে ফিল্টার করুন...' : 'Filter circulars by title, organization, degree...'}
            className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white"
          />
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500 font-semibold">
          {bn ? 'সার্কুলার ও প্রোফাইলের যোগ্যতা বিশ্লেষণ চলছে...' : 'Analyzing stored circulars against applicant profile...'}
        </div>
      ) : evaluatedList.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-xs text-slate-500">
          {bn
            ? 'এই ফিল্টারে কোনো জব সার্কুলার পাওয়া যায়নি।'
            : 'No active job circulars match the selected filter.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Circular Left List */}
          <div className="lg:col-span-5 space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
            {evaluatedList.map(({ job, report }) => {
              const cfg = VERDICT_CONFIG[report.overallStatus] || VERDICT_CONFIG.MANUAL_REVIEW_REQUIRED;
              const isSelected = selectedEntry?.job.id === job.id;
              return (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => setSelectedJobId(job.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition cursor-pointer ${
                    isSelected
                      ? 'bg-petro-50/70 dark:bg-petro-950/40 border-petro-500 shadow-sm'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotCls}`} />
                      {bn ? cfg.bn : cfg.en}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      {report.failedCount > 0
                        ? bn ? `${report.failedCount}টি অমিল` : `${report.failedCount} Failed`
                        : report.missingProfileCount > 0
                          ? bn ? `${report.missingProfileCount}টি তথ্য প্রয়োজন` : `${report.missingProfileCount} Missing`
                          : bn ? `${report.matchedCount}টি শর্ত মিলেছে` : `${report.matchedCount} Matched`}
                    </span>
                  </div>
                  <div className="text-xs font-extrabold text-slate-800 dark:text-white truncate">
                    {job.position || job.jobTitle}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {job.organization}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Detail Pane */}
          <div className="lg:col-span-7">
            {selectedEntry && (() => {
              const { job, report } = selectedEntry;
              const cfg = VERDICT_CONFIG[report.overallStatus] || VERDICT_CONFIG.MANUAL_REVIEW_REQUIRED;
              const reqs = report.parsedRequirements;

              return (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
                  {/* Job Header & Action Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`inline-flex items-center gap-1.5 text-[10.5px] font-bold px-2.5 py-0.5 rounded-full border ${cfg.cls}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotCls}`} />
                          {bn ? cfg.bn : cfg.en}
                        </span>
                        {job.category && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {job.category}
                          </span>
                        )}
                      </div>
                      <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                        {job.position || job.jobTitle}
                      </h2>
                      <p className="text-xs font-semibold text-petro-700 dark:text-petro-400 mt-0.5">
                        {job.organization}
                      </p>
                      {report.lastVerifiedAt && (
                        <p className="text-[10.5px] text-slate-400 mt-0.5">
                          Verified: {new Date(report.lastVerifiedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowOverridePanel((v) => !v)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span>{bn ? 'শর্ত সংশোধন' : 'Adjust'}</span>
                      </button>

                      {job.circularUrl && (
                        <button
                          type="button"
                          onClick={() => openSafeExternalTab(job.circularUrl!)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-petro-50 text-petro-700 border border-petro-200 hover:bg-petro-100 cursor-pointer"
                        >
                          <span>{bn ? 'মূল বিজ্ঞপ্তি' : 'Official Circular'}</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}

                      {onOpenJobCircular && (
                        <button
                          type="button"
                          onClick={() => onOpenJobCircular(job.id)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 cursor-pointer"
                        >
                          {bn ? 'বিস্তারিত' : 'Open Detail'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Manual Requirement Correction Helper */}
                  {showOverridePanel && (
                    <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                      <div>
                        <label className="block font-semibold text-slate-500 mb-1">Min Education</label>
                        <select
                          value={reqs.minEducationLevel || ''}
                          onChange={(e) =>
                            setOverridesByJob((prev) => ({
                              ...prev,
                              [job.id]: {
                                ...prev[job.id],
                                minEducationLevel: (e.target.value || null) as any,
                                hasExtractedAnyRequirement: true,
                              },
                            }))
                          }
                          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-900"
                        >
                          <option value="">Any / Not Specified</option>
                          <option value="SSC">SSC</option>
                          <option value="HSC">HSC</option>
                          <option value="Diploma">Diploma</option>
                          <option value="Bachelor">Bachelor / Honours</option>
                          <option value="Masters">Masters</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-500 mb-1">Max Age</label>
                        <input
                          type="number"
                          value={reqs.maxAgeYears ?? ''}
                          placeholder="e.g. 30 or 32"
                          onChange={(e) =>
                            setOverridesByJob((prev) => ({
                              ...prev,
                              [job.id]: {
                                ...prev[job.id],
                                maxAgeYears: e.target.value ? Number(e.target.value) : null,
                                hasExtractedAnyRequirement: true,
                              },
                            }))
                          }
                          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-500 mb-1">Min GPA / CGPA</label>
                        <input
                          type="number"
                          step="0.05"
                          value={reqs.minGpa ?? ''}
                          placeholder="e.g. 3.00"
                          onChange={(e) =>
                            setOverridesByJob((prev) => ({
                              ...prev,
                              [job.id]: {
                                ...prev[job.id],
                                minGpa: e.target.value ? Number(e.target.value) : null,
                                hasExtractedAnyRequirement: true,
                              },
                            }))
                          }
                          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-900"
                        />
                      </div>
                    </div>
                  )}

                  {/* Per-criterion breakdown cards */}
                  <div className="space-y-2.5">
                    {report.criteria.map((c) => {
                      const badge = getStatusBadge(c.status);
                      return (
                        <div
                          key={c.key}
                          className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-start gap-3 text-xs"
                        >
                          <div className="mt-0.5">{renderStatusIcon(c.status)}</div>
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="font-extrabold text-slate-800 dark:text-white">
                                {bn ? c.labelBn : c.labelEn}
                              </span>
                              <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md border ${badge.cls}`}>
                                {badge.label}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800">
                              <div>
                                <span className="font-bold text-slate-500 block text-[10px] uppercase">
                                  {bn ? 'বিজ্ঞপ্তির শর্ত' : 'Circular Requirement'}
                                </span>
                                <span className="text-slate-800 dark:text-slate-200 font-semibold">
                                  {c.requirementText}
                                </span>
                              </div>
                              <div>
                                <span className="font-bold text-slate-500 block text-[10px] uppercase">
                                  {bn ? 'আপনার প্রোফাইলের তথ্য' : 'Applicant Profile Value'}
                                </span>
                                <span className="text-petro-800 dark:text-petro-300 font-semibold">
                                  {c.profileValueText}
                                </span>
                              </div>
                            </div>

                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {bn ? c.reasonBn : c.reasonEn}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
