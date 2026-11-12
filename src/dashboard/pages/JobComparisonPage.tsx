import React, { useEffect, useMemo, useState } from 'react';
import {
  Scale,
  Calculator,
  Layers,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { NormalizedJobCircular } from '../../jobs/types/job.types';
import { JobRepository } from '../../jobs/database/job-repository';
import {
  buildJobComparisonMatrix,
  computeUserAssumedNetSalary,
} from '../../jobs/services/job-comparison';
import { findDuplicateOrClusteredCirculars } from '../../jobs/services/job-deduplicator';

interface JobComparisonPageProps {
  onOpenJobCircular: (jobId: string) => void;
}

export const JobComparisonPage: React.FC<JobComparisonPageProps> = ({ onOpenJobCircular }) => {
  const { language } = useApp();
  const bn = language === 'bn';

  const [jobs, setJobs] = useState<NormalizedJobCircular[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [grossInput, setGrossInput] = useState('');
  const [deductionInput, setDeductionInput] = useState('10');

  useEffect(() => {
    JobRepository.getAllJobs()
      .then((list) => {
        const active = list.filter((j) => j.status !== 'expired');
        setJobs(active);
        if (active.length >= 2) {
          setSelectedIds(active.slice(0, 2).map((j) => j.id));
        } else if (active.length === 1) {
          setSelectedIds([active[0].id]);
        }
      })
      .catch(() => setJobs([]));
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return [...prev.slice(1), id];
      return [...prev, id];
    });
  };

  const selectedJobs = useMemo(
    () => selectedIds.map((id) => jobs.find((j) => j.id === id)).filter(Boolean) as NormalizedJobCircular[],
    [jobs, selectedIds]
  );

  const columns = useMemo(() => buildJobComparisonMatrix(selectedJobs), [selectedJobs]);
  const duplicateClusters = useMemo(() => findDuplicateOrClusteredCirculars(jobs), [jobs]);

  const userCalc = useMemo(() => {
    const gross = Number(grossInput);
    const pct = Number(deductionInput);
    if (!grossInput.trim() || !Number.isFinite(gross) || gross <= 0) return null;
    return computeUserAssumedNetSalary(gross, Number.isFinite(pct) ? pct : 0);
  }, [grossInput, deductionInput]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
          <Scale className="w-5 h-5 text-petro-600" />
          <span>{bn ? 'চাকরি ও বেতন তুলনা (Job Comparison Tool)' : 'Job, Salary & Source Comparison'}</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {bn
            ? 'সর্বোচ্চ ৪টি চাকরির বেতন, গ্রেড, বয়স, যোগ্যতা ও শেষ তারিখ পাশাপাশি তুলনা করুন। অপ্রকাশিত তথ্য কখনো অনুমান করা হয় না।'
            : 'Compare up to 4 circulars side-by-side. Undisclosed salaries, vacancies, or terms always display as Not Available / Salary not disclosed.'}
        </p>
      </div>

      {jobs.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-xs text-slate-500">
          No loaded circulars found yet. Fetch or add circulars in Job Circulars Hub to compare them side by side.
        </div>
      ) : (
        <>
          {/* Circular Selector Chips */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 text-xs">
            <div className="font-bold text-slate-700 dark:text-slate-200">
              Select 2–4 Circulars to Compare ({selectedIds.length} selected):
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
              {jobs.map((j) => {
                const active = selectedIds.includes(j.id);
                return (
                  <button
                    key={j.id}
                    type="button"
                    onClick={() => toggleSelect(j.id)}
                    className={`px-2.5 py-1.5 rounded-lg border font-semibold cursor-pointer text-left ${
                      active
                        ? 'bg-petro-600 text-white border-petro-700'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {j.organization} — {j.jobTitle}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Comparison Table */}
          {columns.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto shadow-xs">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    <th className="p-3 font-extrabold text-slate-600 dark:text-slate-300 min-w-[140px]">Criterion</th>
                    {columns.map((c) => (
                      <th key={c.jobId} className="p-3 font-extrabold text-slate-900 dark:text-white min-w-[200px]">
                        <button
                          type="button"
                          onClick={() => onOpenJobCircular(c.jobId)}
                          className="text-left hover:text-petro-600 underline cursor-pointer"
                        >
                          {c.jobTitle}
                        </button>
                        <div className="text-[11px] font-semibold text-petro-700 dark:text-petro-400 mt-0.5">
                          {c.organization}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  <tr>
                    <td className="p-3 font-bold text-slate-600">Source Tier</td>
                    {columns.map((c) => (
                      <td key={c.jobId} className="p-3">
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300">
                          <ShieldCheck className="w-3.5 h-3.5" /> {c.verificationTier}
                        </span>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-slate-600">Published Salary</td>
                    {columns.map((c) => (
                      <td key={c.jobId} className="p-3 font-semibold">{c.salaryBreakdown.publishedText}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-slate-600">Pay Grade</td>
                    {columns.map((c) => (
                      <td key={c.jobId} className="p-3">{c.salaryBreakdown.grade}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-slate-600">Allowances / Benefits</td>
                    {columns.map((c) => (
                      <td key={c.jobId} className="p-3">{c.salaryBreakdown.allowancesNote}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-slate-600">Qualification</td>
                    {columns.map((c) => (
                      <td key={c.jobId} className="p-3">{c.qualification}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-slate-600">Age Limit</td>
                    {columns.map((c) => (
                      <td key={c.jobId} className="p-3">{c.ageLimit}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-slate-600">Experience</td>
                    {columns.map((c) => (
                      <td key={c.jobId} className="p-3">{c.experience}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-slate-600">Vacancies</td>
                    {columns.map((c) => (
                      <td key={c.jobId} className="p-3">{c.vacanciesDisplay}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-slate-600">Location</td>
                    {columns.map((c) => (
                      <td key={c.jobId} className="p-3">{c.location}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-slate-600">Deadline</td>
                    {columns.map((c) => (
                      <td key={c.jobId} className="p-3">
                        <span className="font-mono font-bold">{c.deadlineDisplay}</span>{' '}
                        {!c.deadlineVerified && (
                          <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">Unverified</span>
                        )}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-slate-600">Application Fee</td>
                    {columns.map((c) => (
                      <td key={c.jobId} className="p-3">{c.applicationFee}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Optional User-Entered Assumption Estimator */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-xs space-y-3">
            <div className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Calculator className="w-4 h-4 text-petro-600" />
              <span>Optional Salary Estimation Scratchpad (User-Entered Assumptions Only)</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="number"
                min={0}
                value={grossInput}
                onChange={(e) => setGrossInput(e.target.value)}
                placeholder="Enter gross BDT amount (e.g. 38000)"
                className="border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800"
              />
              <div className="flex items-center gap-1.5">
                <span>Assumed deduction %:</span>
                <input
                  type="number"
                  min={0}
                  max={80}
                  value={deductionInput}
                  onChange={(e) => setDeductionInput(e.target.value)}
                  className="w-20 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800"
                />
              </div>
              {userCalc && (
                <div className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-semibold">
                  User Assumption Only: ~BDT {userCalc.estimatedNetMonthly.toLocaleString()}/month (not official pay rules)
                </div>
              )}
            </div>
          </div>

          {/* Duplicate Circular Inspector */}
          {duplicateClusters.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-xs space-y-2.5">
              <div className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>Cross-Source Duplicate Groups &amp; Attribution ({duplicateClusters.length})</span>
              </div>
              <div className="space-y-2">
                {duplicateClusters.map((cl) => (
                  <div key={cl.primaryJob.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                    <div className="font-bold">{cl.primaryJob.organization} — {cl.primaryJob.jobTitle}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Primary source: {cl.primaryJob.sourceName} • Linked alternate sources: {cl.alternateSourcesCount}
                      {cl.relatedJobs.length > 0 && (
                        <span className="ml-2 text-amber-700 inline-flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> {cl.relatedJobs.length} possible duplicate notice(s) kept separate for manual review
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
