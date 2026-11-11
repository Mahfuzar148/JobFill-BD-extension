// JobFill BD - Honest Missing Application URL Modal
// Shown when Apply Now is clicked on a circular that only has a PDF/notice link
// and no verified direct online application URL (never auto-redirects to circular PDF).

import React from 'react';
import {
  AlertTriangle,
  ExternalLink,
  FileText,
  Globe,
  Search,
  X,
} from 'lucide-react';
import { NormalizedJobCircular } from '../types/job.types';
import { verifyJobUrl } from '../services/source-verifier';
import {
  buildApplicationSearchUrl,
  isCircularDocumentUrl,
} from '../services/application-link-detector';
import { openSafeExternalTab } from '../services/job-ui-actions';

interface MissingApplicationUrlModalProps {
  job: NormalizedJobCircular | null;
  language?: 'bn' | 'en';
  onClose: () => void;
}

export function resolveSafeCircularTarget(job: NormalizedJobCircular): string | null {
  if (job.circularUrl) {
    const c = verifyJobUrl(job.circularUrl);
    if (c.isValid && c.isSafeToOpen) return c.normalizedUrl;
  }
  if (job.sourceUrl) {
    const s = verifyJobUrl(job.sourceUrl);
    if (s.isValid && s.isSafeToOpen) return s.normalizedUrl;
  }
  return null;
}

export function resolveSafeOrganizationTarget(job: NormalizedJobCircular): string | null {
  if (job.organizationUrl) {
    const o = verifyJobUrl(job.organizationUrl);
    if (o.isValid && o.isSafeToOpen) return o.normalizedUrl;
  }
  // Safely derive root homepage only from verified official portals (never Google News RSS)
  for (const candidate of [job.circularUrl, job.sourceUrl]) {
    if (!candidate) continue;
    const chk = verifyJobUrl(candidate);
    if (
      chk.isValid &&
      chk.isSafeToOpen &&
      chk.isOfficialDomain &&
      !chk.hostname.includes('oraclecloud')
    ) {
      try {
        return new URL(chk.normalizedUrl).origin;
      } catch {
        // ignore
      }
    }
  }
  return null;
}

export const MissingApplicationUrlModal: React.FC<MissingApplicationUrlModalProps> = ({
  job,
  language = 'en',
  onClose,
}) => {
  if (!job) return null;

  const bn = language === 'bn';
  const circularTarget = resolveSafeCircularTarget(job);
  const organizationTarget = resolveSafeOrganizationTarget(job);
  const searchTarget = buildApplicationSearchUrl(job);
  const circularIsPdf = Boolean(circularTarget && isCircularDocumentUrl(circularTarget));

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="missing-app-url-title"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2
                id="missing-app-url-title"
                className="text-sm font-bold text-slate-900 dark:text-white leading-snug"
              >
                সরাসরি অনলাইন আবেদন লিংক পাওয়া যায়নি।
              </h2>
              {!bn && (
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-0.5">
                  Direct online application link is not available for this notice.
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={bn ? 'বন্ধ করুন' : 'Close'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
            <div className="font-semibold text-slate-900 dark:text-white line-clamp-2">
              {job.position || job.jobTitle}
            </div>
            <div className="text-emerald-700 dark:text-emerald-400 font-medium">
              {job.organization}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 leading-relaxed">
              {bn
                ? 'বিজ্ঞপ্তির PDF বা নোটিশ পেজে অনলাইন আবেদন ফর্মের লিংক উল্লেখ না থাকায় স্বয়ংক্রিয়ভাবে কোনো PDF খোলা হয়নি। নিচের বিকল্পগুলো থেকে যাচাই করুন:'
                : 'To avoid redirecting you to a circular PDF instead of an application form, no file was opened automatically. Choose one of the verified options below:'}
            </p>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              disabled={!circularTarget}
              onClick={() => {
                if (circularTarget) openSafeExternalTab(circularTarget);
              }}
              className="w-full flex items-center justify-between gap-2 h-10 px-3.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 disabled:opacity-45 cursor-pointer transition-colors"
            >
              <span className="inline-flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  {bn
                    ? circularIsPdf
                      ? 'অফিশিয়াল বিজ্ঞপ্তি দেখুন (PDF)'
                      : 'অফিশিয়াল বিজ্ঞপ্তি দেখুন'
                    : circularIsPdf
                      ? 'অফিশিয়াল বিজ্ঞপ্তি দেখুন (View Official Circular PDF)'
                      : 'অফিশিয়াল বিজ্ঞপ্তি দেখুন (View Official Circular)'}
                </span>
              </span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            <button
              type="button"
              disabled={!organizationTarget}
              onClick={() => {
                if (organizationTarget) openSafeExternalTab(organizationTarget);
              }}
              className="w-full flex items-center justify-between gap-2 h-10 px-3.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 disabled:opacity-45 cursor-pointer transition-colors"
            >
              <span className="inline-flex items-center gap-2">
                <Globe className="w-4 h-4 text-sky-600 shrink-0" />
                <span>
                  {bn
                    ? 'প্রতিষ্ঠানের ওয়েবসাইট দেখুন'
                    : 'প্রতিষ্ঠানের ওয়েবসাইট দেখুন (Organization Website)'}
                </span>
              </span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => openSafeExternalTab(searchTarget)}
              className="w-full flex items-center justify-between gap-2 h-10 px-3.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition-colors"
            >
              <span className="inline-flex items-center gap-2">
                <Search className="w-4 h-4 shrink-0" />
                <span>
                  {bn
                    ? 'আবেদন লিংক খুঁজুন'
                    : 'আবেদন লিংক খুঁজুন (Find Application Link)'}
                </span>
              </span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
