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

const VERDICT_BADGE: Record<EligibilityVerdict, { en: string; bn: string; cls: string }> = {
  ELIGIBLE: {
    en: 'ELIGIBLE',
    bn: 'যোগ্য (ELIGIBLE)',
    cls: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
  },
  NOT_ELIGIBLE: {
    en: 'NOT ELIGIBLE',
    bn: 'যোগ্য নন (NOT ELIGIBLE)',
    cls: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
  },
  NEEDS_MANUAL_VERIFICATION: {
    en: 'NEEDS MANUAL VERIFICATION',
    bn: 'ম্যানুয়াল যাচাই প্রয়োজন',
    cls: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
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
  const [verdictFilter, setVerdictFilter] = useState<EligibilityVerdict | 'ALL'>('ALL');
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

  const evaluatedList = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return jobs
      .filter((j) => {
        if (!q) return true;
        return (
          j.jobTitle.toLowerCase().includes(q) ||
          j.organization.toLowerCase().includes(q) ||
          j.qualification.toLowerCase().includes(q)
        );
      })
      .map((job) => ({
        job,
        report: evaluateProfileEligibility(profile, job, overridesByJob[job.id]),
      }))
      .filter(({ report }) => verdictFilter === 'ALL' || report.overallStatus === verdictFilter);
  }, [jobs, profile, overridesByJob, searchText, verdictFilter]);

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
    return <HelpCircle className="w-4 h-4 text-slate-500 shrink-0" />;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-petro-600" />
            <span>{bn ? 'যোগ্যতা যাচাইকারী (Job Eligibility Checker)' : 'Job Eligibility Checker'}</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {bn
              ? 'আপনার সেভ করা প্রোফাইল (জন্ম তারিখ, শিক্ষাগত যোগ্যতা, জিপিএ, অভিজ্ঞতা, জেলা) বিজ্ঞপ্তির শর্তের সাথে তুলনা করে—অনুপস্থিত বা অনিশ্চিত শর্ত কখনো আন্দাজে পাস দেখায় না।'
              : 'Compares your profile against circular conditions accurately. Unspecified criteria or quota clauses always surface as Needs Manual Verification.'}
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={bn ? 'পদের নাম বা প্রতিষ্ঠান লিখুন...' : 'Filter circulars by title, organization, degree...'}
            className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white"
          />
        </div>

        <select
          value={verdictFilter}
          onChange={(e) => setVerdictFilter(e.target.value as any)}
          className="text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
        >
          <option value="ALL">{bn ? `সব ফলাফল (${jobs.length})` : `All Circulars (${jobs.length})`}</option>
          <option value="ELIGIBLE">{bn ? 'যোগ্য (Eligible)' : 'Eligible'}</option>
          <option value="NEEDS_MANUAL_VERIFICATION">{bn ? 'ম্যানুয়াল যাচাই প্রয়োজন' : 'Needs Manual Verification'}</option>
          <option value="NOT_ELIGIBLE">{bn ? 'যোগ্য নন (Not Eligible)' : 'Not Eligible'}</option>
        </select>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500">
          {bn ? 'বিজ্ঞপ্তি ও যোগ্যতা বিশ্লেষণ চলছে...' : 'Analyzing stored circulars against profile...'}
        </div>
      ) : evaluatedList.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center text-xs text-slate-500">
          {bn
            ? 'তুলনা করার মতো কোনো সক্রিয় জব সার্কুলার পাওয়া যায়নি। জব সার্কুলার হাব থেকে বিজ্ঞপ্তি রিফ্রেশ করুন।'
            : 'No active job circulars matched. Open Job Circulars to sync active postings.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Circular List */}
          <div className="lg:col-span-5 space-y-2.5 max-h-[620px] overflow-y-auto pr-1">
            {evaluatedList.map(({ job, report }) => {
              const badge = VERDICT_BADGE[report.overallStatus];
              const isSelected = selectedEntry?.job.id === job.id;
              return (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => setSelectedJobId(job.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition cursor-pointer ${
                    isSelected
                      ? 'bg-petro-50 dark:bg-petro-950/30 border-petro-500 shadow-xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.cls}`}>
                      {bn ? badge.bn : badge.en}
                    </span>
                    <span className="text-[10.5px] text-slate-400">
                      {report.matchedCount}✓ / {report.failedCount}✕
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

          {/* Breakdown & Manual Requirement Override */}
          <div className="lg:col-span-7">
            {selectedEntry && (() => {
              const { job, report } = selectedEntry;
              const badge = VERDICT_BADGE[report.overallStatus];
              const reqs = report.parsedRequirements;

              return (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                      <span className={`inline-block text-[10.5px] font-bold px-2.5 py-0.5 rounded-full border mb-1.5 ${badge.cls}`}>
                        {bn ? badge.bn : badge.en}
                      </span>
                      <h2 className="text-base font-extrabold text-slate-800 dark:text-white">
                        {job.position || job.jobTitle}
                      </h2>
                      <p className="text-xs font-semibold text-petro-700 dark:text-petro-400">
                        {job.organization}
                      </p>
                      {report.lastVerifiedAt && (
                        <p className="text-[10.5px] text-slate-400 mt-0.5">
                          Last verified: {new Date(report.lastVerifiedAt).toLocaleDateString()}
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
                        <span>{bn ? 'শর্ত সংশোধন' : 'Adjust Requirements'}</span>
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
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
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
                          <option value="">Not Specified</option>
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

                  {/* Per-criterion breakdown */}
                  <div className="space-y-2.5">
                    {report.criteria.map((c) => (
                      <div
                        key={c.key}
                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-start gap-2.5 text-xs"
                      >
                        <div className="mt-0.5">{renderStatusIcon(c.status)}</div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="font-bold text-slate-800 dark:text-white">
                              {bn ? c.labelBn : c.labelEn}
                            </span>
                            <span className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                              {c.status}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-300">
                            <strong>{bn ? 'শর্ত:' : 'Circular:'}</strong> {c.requirementText} •{' '}
                            <strong>{bn ? 'আপনার তথ্য:' : 'Profile:'}</strong> {c.profileValueText}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {bn ? c.reasonBn : c.reasonEn}
                          </div>
                        </div>
                      </div>
                    ))}
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
