import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  GraduationCap,
  Plus,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Calendar,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { NormalizedJobCircular } from '../../jobs/types/job.types';
import { JobRepository } from '../../jobs/database/job-repository';
import {
  StudentOpportunityCategory,
  extractStudentOpportunities,
} from '../../opportunities/opportunities-service';
import { verifyJobUrl } from '../../jobs/services/source-verifier';

interface OpportunitiesPageProps {
  onOpenJobCircular: (jobId: string) => void;
  showToast: (msg: string) => void;
}

const OPPORTUNITY_TABS: Array<StudentOpportunityCategory | 'All'> = [
  'All',
  'Scholarship',
  'Internship',
  'Fresh Graduate Job',
  'Part-Time Job',
  'Training Program',
  'Graduate Development Program',
];

export const OpportunitiesPage: React.FC<OpportunitiesPageProps> = ({
  onOpenJobCircular,
  showToast,
}) => {
  const { language } = useApp();
  const bn = language === 'bn';

  const [jobs, setJobs] = useState<NormalizedJobCircular[]>([]);
  const [selectedCat, setSelectedCat] = useState<StudentOpportunityCategory | 'All'>('All');
  const [addOpen, setAddOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [org, setOrg] = useState('');
  const [catType, setCatType] = useState<StudentOpportunityCategory>('Internship');
  const [sourceUrl, setSourceUrl] = useState('');
  const [deadline, setDeadline] = useState('');

  const loadJobs = useCallback(async () => {
    const all = await JobRepository.getAllJobs().catch(() => []);
    setJobs(all);
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const opportunities = useMemo(
    () => extractStudentOpportunities(jobs, selectedCat),
    [jobs, selectedCat]
  );

  const handleSaveManualOpportunity = async (e: React.FormEvent) => {
    e.preventDefault();
    const urlCheck = verifyJobUrl(sourceUrl);
    if (!urlCheck.isSafeToOpen || !sourceUrl.startsWith('https://')) {
      showToast('⚠️ Provide a valid official HTTPS source link.');
      return;
    }
    const deadlineMs = deadline ? Date.parse(`${deadline}T23:59:59+06:00`) : null;
    await JobRepository.saveJob({
      id: `opp_${Date.now().toString(36)}`,
      sourceId: 'user_submitted',
      sourceName: `${catType} (User Verified Entry)`,
      organization: org.trim(),
      jobTitle: `[${catType}] ${title.trim()}`,
      position: title.trim(),
      category: 'Private',
      employmentType: catType === 'Internship' ? 'Internship' : catType === 'Part-Time Job' ? 'Part Time' : 'Full Time',
      qualification: 'Graduate',
      location: 'Bangladesh',
      publishedAt: Date.now(),
      applicationStartAt: null,
      deadlineAt: deadlineMs && !Number.isNaN(deadlineMs) ? deadlineMs : null,
      deadlineText: deadline || 'Not Specified',
      deadlineTimezone: 'Asia/Dhaka',
      deadlineVerified: Boolean(deadlineMs && !Number.isNaN(deadlineMs)),
      circularUrl: sourceUrl.trim(),
      applicationUrl: sourceUrl.trim(),
      sourceUrl: sourceUrl.trim(),
      description: `Student Opportunity Category: ${catType}. Added manually with verified HTTPS source link.`,
      requirements: [],
      sourceVerification: 'user_submitted',
      sourceLastCheckedAt: Date.now(),
      firstDiscoveredAt: Date.now(),
      lastUpdatedAt: Date.now(),
      status: 'active',
      isManual: true,
    });
    setAddOpen(false);
    setTitle('');
    setOrg('');
    setSourceUrl('');
    setDeadline('');
    await loadJobs();
    showToast('✅ Opportunity saved with source attribution');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-petro-600" />
            <span>{bn ? 'বৃত্তি, ইন্টার্নশিপ ও নবীন সুযোগ' : 'Scholarships, Internships & Student Hub'}</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {bn
              ? 'উৎস যাচাইকৃত ইন্টার্নশিপ, বৃত্তি, পার্ট-টাইম ও নবীন গ্র্যাজুয়েট সুযোগ। কোনো ভুয়া বা কাল্পনিক লিংক দেখানো হয় না।'
              : 'Source-attributed scholarships, internships, training & fresh graduate roles. Links and deadlines are never invented.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-petro-600 hover:bg-petro-700 text-white shadow cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Verified Opportunity</span>
        </button>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap gap-1.5 text-xs">
        {OPPORTUNITY_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setSelectedCat(tab)}
            className={`px-3 py-1.5 rounded-xl font-bold border cursor-pointer ${
              selectedCat === tab
                ? 'bg-petro-600 text-white border-petro-700'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {opportunities.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center space-y-2 text-xs">
          <GraduationCap className="w-10 h-10 text-slate-300 mx-auto" />
          <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
            No {selectedCat === 'All' ? 'Student Opportunities' : selectedCat} Loaded Yet
          </div>
          <p className="text-slate-500 max-w-md mx-auto">
            JobFill BD never fabricates scholarship or internship links. Fetch real circulars in Job Circulars Hub or add a verified official link above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {opportunities.map(({ job, opportunityCategory, sourceTier, hasVerifiedApplicationLink, hasVerifiedDeadline }) => (
            <div
              key={job.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-2.5 shadow-xs text-xs"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                  {opportunityCategory}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold border ${
                    sourceTier === 'Unverified Discovery'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  {sourceTier === 'Unverified Discovery' ? <AlertTriangle className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                  {sourceTier}
                </span>
              </div>

              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">{job.jobTitle}</h3>
              <div className="text-petro-700 dark:text-petro-400 font-semibold">{job.organization}</div>

              <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {hasVerifiedDeadline && job.deadlineAt
                    ? new Date(job.deadlineAt).toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka' })
                    : job.deadlineText || 'Deadline Unverified'}
                </span>
                <span>• Source: {job.sourceName}</span>
                {hasVerifiedApplicationLink && <span className="text-emerald-700 font-semibold">• Link Checked</span>}
              </div>

              <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => onOpenJobCircular(job.id)}
                  className="text-petro-700 font-bold hover:underline cursor-pointer"
                >
                  Inspect Full Circular →
                </button>
                {job.applicationUrl && verifyJobUrl(job.applicationUrl).isSafeToOpen && (
                  <a
                    href={job.applicationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-700"
                  >
                    <span>Official Link</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {addOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveManualOpportunity}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md shadow-2xl overflow-hidden text-xs"
          >
            <div className="px-5 py-3.5 bg-petro-700 text-white font-bold text-sm flex items-center justify-between">
              <span>Add Verified Scholarship / Internship</span>
              <button type="button" onClick={() => setAddOpen(false)} className="cursor-pointer">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block font-semibold mb-1">Category *</label>
                <select
                  value={catType}
                  onChange={(e) => setCatType(e.target.value as StudentOpportunityCategory)}
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 bg-white dark:bg-slate-800"
                >
                  <option value="Internship">Internship</option>
                  <option value="Scholarship">Scholarship</option>
                  <option value="Fresh Graduate Job">Fresh Graduate Job</option>
                  <option value="Training Program">Training Program</option>
                  <option value="Part-Time Job">Part-Time Job</option>
                  <option value="Graduate Development Program">Graduate Development Program</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Graduate Software Engineering Intern"
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Organization / University *</label>
                <input
                  type="text"
                  required
                  value={org}
                  onChange={(e) => setOrg(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Official HTTPS Source URL *</label>
                <input
                  type="url"
                  required
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Verified Deadline (Optional)</label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 bg-white dark:bg-slate-800"
                />
              </div>
            </div>
            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800 flex justify-end gap-2">
              <button type="button" onClick={() => setAddOpen(false)} className="px-3 py-1.5 rounded-lg border border-slate-300">Cancel</button>
              <button type="submit" className="px-4 py-1.5 rounded-lg bg-petro-600 text-white font-bold cursor-pointer">Save Opportunity</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
