import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckSquare,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { DocumentMetadata, UserProfile } from '../../types/profile';
import type { NormalizedJobCircular } from '../../jobs/types/job.types';
import { JobRepository } from '../../jobs/database/job-repository';
import { getDocumentMetadataByProfile } from '../../services/indexedDB';
import {
  ManualReadinessState,
  evaluateApplicationReadiness,
  loadManualReadiness,
  saveManualReadiness,
} from '../../readiness/readiness-checker';
import { verifyJobUrl } from '../../jobs/services/source-verifier';

interface ApplicationReadinessPageProps {
  profile: UserProfile;
  onNavigateTab: (tab: any) => void;
}

export const ApplicationReadinessPage: React.FC<ApplicationReadinessPageProps> = ({
  profile,
  onNavigateTab,
}) => {
  const { language } = useApp();
  const bn = language === 'bn';

  const [jobs, setJobs] = useState<NormalizedJobCircular[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('general');
  const [docs, setDocs] = useState<DocumentMetadata[]>([]);
  const [manual, setManual] = useState<ManualReadinessState>(() => loadManualReadiness('general'));

  useEffect(() => {
    JobRepository.getAllJobs()
      .then((list) => setJobs(list.filter((j) => j.status !== 'expired')))
      .catch(() => setJobs([]));
    getDocumentMetadataByProfile(profile.id)
      .then(setDocs)
      .catch(() => setDocs([]));
  }, [profile.id]);

  useEffect(() => {
    setManual(loadManualReadiness(selectedJobId));
  }, [selectedJobId]);

  const selectedJob = useMemo(
    () => (selectedJobId === 'general' ? null : jobs.find((j) => j.id === selectedJobId) || null),
    [jobs, selectedJobId]
  );

  const result = useMemo(
    () => evaluateApplicationReadiness(profile, docs, selectedJob, manual),
    [profile, docs, selectedJob, manual]
  );

  const toggleManualField = (field: keyof ManualReadinessState) => {
    const next = { ...manual, [field]: !manual[field] };
    setManual(next);
    saveManualReadiness(selectedJobId, next);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-petro-600" />
            <span>{bn ? 'আবেদন প্রস্তুতি যাচাই (Application Readiness)' : 'Application Readiness Checker'}</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {bn
              ? 'আবেদন করার আগে আপনার প্রোফাইল, ছবি, স্বাক্ষর, সনদ ও নিজ হাতে যাচাইকৃত ডিক্লারেশন তালিকা দেখে নিন।'
              : 'Verify your profile, 300×300 photo, 300×80 signature, certificates & personal declarations before applying.'}
          </p>
        </div>

        <div className="text-xs font-extrabold px-3.5 py-2 rounded-xl bg-petro-50 text-petro-800 border border-petro-200">
          {result.overallReadyCount} / {result.totalChecks} Ready
        </div>
      </div>

      {/* Explicit Safety Policy Banner */}
      <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3.5 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2.5">
        <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
        <span>
          <strong>Applicant Safety Control:</strong> JobFill BD never submits applications automatically and never accepts legal declarations or quota selections without your explicit review.
        </span>
      </div>

      {/* Scope Selector */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1">
          <label className="font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
            Target Application:
          </label>
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="flex-1 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-800 font-semibold"
          >
            <option value="general">General Bangladesh Job Readiness (All Portals)</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.organization} — {j.jobTitle}
              </option>
            ))}
          </select>
        </div>

        {selectedJob?.applicationUrl && verifyJobUrl(selectedJob.applicationUrl).isSafeToOpen && (
          <a
            href={selectedJob.applicationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-petro-600 hover:bg-petro-700 text-white font-bold shrink-0"
          >
            <span>Open Portal</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {/* Checklist */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
        {result.items.map((item) => {
          const isManual = Boolean(item.isManualConfirmation);
          const manualKey: keyof ManualReadinessState | null =
            item.key === 'manual_form_review'
              ? 'formFieldsReviewed'
              : item.key === 'manual_fee_review'
                ? 'feeInfoReviewed'
                : item.key === 'manual_declaration_review'
                  ? 'declarationsReviewed'
                  : null;

          return (
            <div key={item.key} className="p-4 flex items-center justify-between gap-4 text-xs">
              <div className="flex items-start gap-3">
                {isManual && manualKey ? (
                  <input
                    type="checkbox"
                    checked={manual[manualKey]}
                    onChange={() => toggleManualField(manualKey)}
                    className="mt-1 w-4 h-4 accent-petro-600 cursor-pointer"
                  />
                ) : item.status === 'Ready' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : item.status === 'Missing' ? (
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                )}

                <div>
                  <div className="font-bold text-slate-800 dark:text-white">
                    {bn ? item.titleBn : item.titleEn}
                  </div>
                  <div className="text-slate-500 mt-0.5">{item.detailEn}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`px-2.5 py-0.5 rounded-full font-bold text-[10.5px] border ${
                    item.status === 'Ready'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : item.status === 'Missing'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  {item.status}
                </span>
                {!isManual && item.status !== 'Ready' && (
                  <button
                    type="button"
                    onClick={() =>
                      onNavigateTab(
                        item.key === 'personal_profile'
                          ? 'personal'
                          : item.key === 'education_details'
                            ? 'education'
                            : item.key === 'eligibility_review'
                              ? 'eligibility'
                              : 'documents'
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                  >
                    Fix
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
