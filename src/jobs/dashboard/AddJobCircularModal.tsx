// JobFill BD - Manual Job Circular Addition & Public URL Import Modal
// Never fabricates missing information; shows editable review when importing a URL.

import React, { useState } from 'react';
import { X, Link as LinkIcon, Loader2, AlertTriangle, Plus } from 'lucide-react';
import {
  JobCategory,
  JobEmploymentType,
  JobLocation,
  NormalizedJobCircular,
} from '../types/job.types';
import { inspectPublicCircularUrl } from '../sources/official-website.adapter';
import { normalizeJobRecord } from '../services/job-normalizer';
import { validateJobCircular } from '../services/job-validator';
import { verifyJobUrl } from '../services/source-verifier';
import { SourceHealthItem } from '../services/source-health-state';
import { JOB_CATEGORIES, EMPLOYMENT_TYPES, JOB_LOCATIONS } from './JobFilters';

export interface ManualJobCircularPrefill {
  organization?: string;
  organizationUrl?: string;
  category?: JobCategory;
  notes?: string;
  importUrl?: string;
  sourceName?: string;
}

export function buildPrefillFromSourceHealthItem(item: SourceHealthItem): ManualJobCircularPrefill {
  const categoryBySourceId: Record<string, JobCategory> = {
    bangladesh_bank: 'Bank',
    teletalk: 'Government',
    bpsc: 'Government',
    ntrca: 'Government',
    dpe: 'Government',
    official_website: 'Government',
    reliefweb_bd: 'NGO',
    remotive_remote: 'Remote Jobs',
    remoteok_remote: 'Remote Jobs',
    arbeitnow_remote: 'Remote Jobs',
    himalayas_remote: 'Remote Jobs',
    bdjobs: 'Private',
    google_news_discovery: 'Other',
  };

  const orgBySourceId: Record<string, string> = {
    bangladesh_bank: 'Bangladesh Bank',
    teletalk: 'Teletalk All Jobs',
    bpsc: 'Bangladesh Public Service Commission (BPSC)',
    ntrca: 'NTRCA',
    dpe: 'Directorate of Primary Education (DPE)',
  };

  return {
    organization: orgBySourceId[item.sourceId] || item.sourceName,
    organizationUrl: item.directPortalUrl,
    category: categoryBySourceId[item.sourceId] || 'Other',
    notes: item.blockedByCaptcha
      ? `Manually verified entry from official portal (${item.directPortalUrl}) while automated extraction is paused due to CAPTCHA.`
      : undefined,
    sourceName: item.sourceName,
  };
}

interface AddJobCircularModalProps {
  language?: 'bn' | 'en';
  prefill?: ManualJobCircularPrefill | null;
  onClose: () => void;
  onSave: (job: NormalizedJobCircular) => Promise<void>;
}

export const AddJobCircularModal: React.FC<AddJobCircularModalProps> = ({
  language = 'en',
  prefill = null,
  onClose,
  onSave,
}) => {
  const bn = language === 'bn';

  const [importUrl, setImportUrl] = useState(prefill?.importUrl || '');
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState('');

  const [organization, setOrganization] = useState(prefill?.organization || '');
  const [position, setPosition] = useState('');
  const [circularNumber, setCircularNumber] = useState('');
  const [category, setCategory] = useState<JobCategory>(prefill?.category || 'Government');
  const [employmentType, setEmploymentType] = useState<JobEmploymentType>('Full Time');
  const [location, setLocation] = useState<JobLocation>('All Bangladesh');
  const [circularUrl, setCircularUrl] = useState('');
  const [organizationUrl, setOrganizationUrl] = useState(prefill?.organizationUrl || '');
  const [applicationUrl, setApplicationUrl] = useState('');
  const [publishedDate, setPublishedDate] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [qualification, setQualification] = useState('Bachelor');
  const [vacancies, setVacancies] = useState('');
  const [salary, setSalary] = useState('');
  const [notes, setNotes] = useState(prefill?.notes || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleImportPublicUrl = async () => {
    if (!importUrl.trim()) return;
    setImporting(true);
    setImportMessage('');
    setError('');
    try {
      const res = await inspectPublicCircularUrl(importUrl.trim());
      if (res.extracted.organization && !organization) setOrganization(res.extracted.organization);
      if (res.extracted.position && !position) setPosition(res.extracted.position);
      if (res.extracted.circularUrl) setCircularUrl(res.extracted.circularUrl);
      if (res.extracted.organizationUrl && !organizationUrl) setOrganizationUrl(res.extracted.organizationUrl);
      if (res.extracted.applicationUrl && !applicationUrl) setApplicationUrl(res.extracted.applicationUrl);
      if (res.extracted.deadlineText && !deadlineDate) setDeadlineDate(res.extracted.deadlineText);
      if (res.extracted.description && !notes) setNotes(res.extracted.description);
      setImportMessage(res.message);
    } finally {
      setImporting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!organization.trim() || !position.trim()) {
      setError(bn ? 'প্রতিষ্ঠানের নাম ও পদের নাম আবশ্যক।' : 'Organization and Position are required.');
      return;
    }

    const cleanAppUrl = applicationUrl.trim() || null;
    const cleanCircUrl = circularUrl.trim() || undefined;
    const cleanOrgUrl = organizationUrl.trim() || undefined;
    if (!cleanAppUrl && !cleanCircUrl) {
      setError(bn ? 'অন্তত একটি বৈধ আবেদন বা বিজ্ঞপ্তি URL দিন।' : 'Provide at least a valid Application URL or Circular PDF URL.');
      return;
    }

    for (const [label, candidateUrl] of [
      ['Application URL', cleanAppUrl],
      ['Circular URL', cleanCircUrl],
      ['Organization URL', cleanOrgUrl],
    ] as const) {
      if (candidateUrl && !verifyJobUrl(candidateUrl).isSafeToOpen) {
        setError(
          bn
            ? `অবৈধ ${label} দেওয়া হয়েছে (শুধু বৈধ http/https URL অনুমোদিত)।`
            : `Invalid ${label}: only valid public http/https URLs are accepted.`
        );
        return;
      }
    }

    const parsedVacancies = vacancies ? parseInt(vacancies, 10) : null;

    const normalized = normalizeJobRecord(
      {
        externalId: `manual_${Date.now()}`,
        organization: organization.trim(),
        jobTitle: position.trim(),
        position: position.trim(),
        circularNumber: circularNumber.trim() || undefined,
        category,
        employmentType,
        vacancies: Number.isFinite(parsedVacancies) && (parsedVacancies ?? 0) > 0 ? parsedVacancies : null,
        salary: salary.trim() || undefined,
        qualification: qualification.trim() || 'Any Qualification',
        location,
        publishedDateText: publishedDate.trim() || undefined,
        deadlineText: deadlineDate.trim() || undefined,
        circularUrl: cleanCircUrl,
        organizationUrl: cleanOrgUrl,
        sourceUrl: cleanOrgUrl || cleanCircUrl || cleanAppUrl || undefined,
        applicationUrl: cleanAppUrl,
        description: notes.trim() || `${position.trim()} at ${organization.trim()}`,
      },
      {
        sourceId: 'manual',
        sourceName: 'Manual Entry',
        verificationLevel: 'user_submitted',
        isManual: true,
      }
    );

    const validation = validateJobCircular(normalized);
    if (!validation.isValid) {
      setError(validation.errors.join(' | '));
      return;
    }

    setSaving(true);
    try {
      await onSave(normalized);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save circular');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
          <h2 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-petro-600" />
            <span>{bn ? 'নতুন জব সার্কুলার যুক্ত করুন' : 'Add Job Circular'}</span>
          </h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Honest Verification Status Notice */}
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-[11px] flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              {bn
                ? 'ম্যানুয়াল এন্ট্রিগুলো স্বতন্ত্রভাবে যাচাই না হওয়া পর্যন্ত "Manually Added — Official Source Pending Verification" হিসেবে সংরক্ষিত থাকে এবং মূল সূত্রের URL অপরিবর্তিত রাখা হয়।'
                : 'Manual entries are marked "Manually Added — Official Source Pending Verification" until independently verified, with your original source URL and verification log preserved.'}
            </span>
          </div>

          {/* Public URL Importer */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
            <label className="block font-bold text-slate-700 dark:text-slate-200">
              {bn ? 'পাবলিক সার্কুলার লিংক থেকে ইমপোর্ট করুন (ঐচ্ছিক)' : 'Import Public Circular URL (Optional Editable Review)'}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <LinkIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="url"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder="https://bpsc.gov.bd/... or official notice link"
                  className="w-full pl-8 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                />
              </div>
              <button
                type="button"
                disabled={importing || !importUrl.trim()}
                onClick={handleImportPublicUrl}
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
              >
                {importing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{bn ? 'তথ্য আনুন' : 'Fetch & Review'}</span>
              </button>
            </div>
            {importMessage && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{importMessage}</span>
              </p>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-semibold">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Organization *</label>
              <input
                type="text"
                required
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="e.g. PetroBangla / BPSC"
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Position / Title *</label>
              <input
                type="text"
                required
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="e.g. Assistant Programmer"
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as JobCategory)} className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white">
                {JOB_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Employment Type</label>
              <select value={employmentType} onChange={(e) => setEmploymentType(e.target.value as JobEmploymentType)} className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white">
                {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Qualification</label>
              <input
                type="text"
                value={qualification}
                onChange={(e) => setQualification(e.target.value)}
                placeholder="e.g. Bachelor / Masters / HSC"
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Location</label>
              <select value={location} onChange={(e) => setLocation(e.target.value as JobLocation)} className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white">
                {JOB_LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Application URL *</label>
              <input
                type="url"
                value={applicationUrl}
                onChange={(e) => setApplicationUrl(e.target.value)}
                placeholder="https://bogmc.teletalk.com.bd/"
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Circular URL / PDF</label>
              <input
                type="url"
                value={circularUrl}
                onChange={(e) => setCircularUrl(e.target.value)}
                placeholder="https://..."
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Published Date</label>
              <input
                type="date"
                value={publishedDate}
                onChange={(e) => setPublishedDate(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Verified Deadline (Leave blank if unknown)
              </label>
              <input
                type="date"
                value={deadlineDate}
                onChange={(e) => setDeadlineDate(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Circular Number</label>
              <input
                type="text"
                value={circularNumber}
                onChange={(e) => setCircularNumber(e.target.value)}
                placeholder="Optional memo/circular no."
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Vacancies &amp; Salary</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min="1"
                  value={vacancies}
                  onChange={(e) => setVacancies(e.target.value)}
                  placeholder="Posts"
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                />
                <input
                  type="text"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  placeholder="Grade / Salary"
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Notes / Summary</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Eligibility notes, fee details, age limit..."
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold cursor-pointer">
              {bn ? 'বাতিল' : 'Cancel'}
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg bg-petro-600 hover:bg-petro-700 text-white font-bold cursor-pointer disabled:opacity-50">
              {saving ? 'Saving...' : bn ? 'সংরক্ষণ করুন' : 'Save Job Circular'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
