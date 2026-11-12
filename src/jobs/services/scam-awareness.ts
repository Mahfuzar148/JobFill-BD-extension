// JobFill BD - Official Source Classification & Rule-Based Job Scam Awareness
// Never accuses any organization or individual of fraud definitively;
// surfaces objective URL/text indicators and evidence so applicants verify via official portals.

import type { NormalizedJobCircular } from '../types/job.types';
import { verifyJobUrl, isOfficialBangladeshDomain } from './source-verifier';

export type OfficialVerificationTier =
  | 'Official Organization Website'
  | 'Official Recruitment Portal'
  | 'Official Circular Document'
  | 'Secondary Discovery Source'
  | 'Unverified Discovery';

export interface SourceProvenanceSummary {
  tier: OfficialVerificationTier;
  sourceUrl: string;
  verificationTimestamp: number | null;
  verificationMethod: string;
  lastCheckedDate: number;
  statusLabel: string;
}

export type ScamWarningLevel = 'None Observed' | 'Low' | 'Moderate' | 'High Attention';

export interface ScamAwarenessReport {
  warningLevel: ScamWarningLevel;
  reasons: Array<{ code: string; title: string; evidence: string }>;
  cautionNotice: string;
}

const KNOWN_RECRUITMENT_PORTALS = [
  '.teletalk.com.bd',
  'erecruitment.bb.org.bd',
  'bpsc.gov.bd',
  'bdjobs.com',
];

export function classifyOfficialSourceTier(job: NormalizedJobCircular): SourceProvenanceSummary {
  const targetUrl = job.applicationUrl || job.circularUrl || job.sourceUrl || '';
  const urlCheck = verifyJobUrl(targetUrl);
  const host = urlCheck.hostname.toLowerCase();

  let tier: OfficialVerificationTier = 'Unverified Discovery';
  let method = 'automated_feed_discovery';

  const isKnownPortal = KNOWN_RECRUITMENT_PORTALS.some(
    (p) => host === p.replace(/^\./, '') || host.endsWith(p)
  );
  const hasCircularPdf = Boolean(job.circularUrl && /\.pdf(\?|$)/i.test(job.circularUrl));
  const circCheck = verifyJobUrl(job.circularUrl);

  if (job.sourceVerification === 'official_verified' && isKnownPortal) {
    tier = 'Official Recruitment Portal';
    method = 'official_portal_adapter_and_https_domain';
  } else if (
    (job.sourceVerification === 'official_verified' || job.sourceVerification === 'official_partial') &&
    (urlCheck.isOfficialDomain || circCheck.isOfficialDomain)
  ) {
    tier = hasCircularPdf && !isKnownPortal ? 'Official Circular Document' : 'Official Organization Website';
    method = 'official_gov_ac_org_bd_domain_match';
  } else if (job.sourceVerification === 'user_submitted') {
    const manualVerified = Boolean(job.verificationHistory?.some((v) => v.action === 'independently_verified'));
    tier = manualVerified
      ? isKnownPortal
        ? 'Official Recruitment Portal'
        : 'Official Organization Website'
      : 'Unverified Discovery';
    method = manualVerified ? 'user_confirmed_with_domain_check' : 'user_manual_entry_unverified';
  } else if (job.sourceVerification === 'discovery_only') {
    tier = 'Secondary Discovery Source';
    method = 'secondary_aggregator_feed';
  }

  return {
    tier,
    sourceUrl: targetUrl,
    verificationTimestamp: job.sourceLastVerifiedAt ?? null,
    verificationMethod: method,
    lastCheckedDate: job.sourceLastCheckedAt || job.lastUpdatedAt || Date.now(),
    statusLabel:
      tier === 'Official Organization Website' || tier === 'Official Recruitment Portal' || tier === 'Official Circular Document'
        ? 'Verified Official Tier'
        : tier === 'Secondary Discovery Source'
          ? 'Secondary Source — Check Official Site'
          : 'Unverified Discovery — Verify Independently',
  };
}

/**
 * Evaluates objective warning signals in job text/URLs without ever making defamatory fraud claims.
 */
export function assessCircularScamSignals(job: NormalizedJobCircular): ScamAwarenessReport {
  const reasons: Array<{ code: string; title: string; evidence: string }> = [];
  const combinedText = `${job.jobTitle} ${job.description} ${job.applicationProcedure || ''} ${job.applicationFee || ''} ${job.salary || ''}`.toLowerCase();

  const appCheck = job.applicationUrl ? verifyJobUrl(job.applicationUrl) : null;
  if (appCheck && appCheck.isValid && appCheck.normalizedUrl.startsWith('http://')) {
    reasons.push({
      code: 'HTTP_APPLICATION_LINK',
      title: 'Unencrypted HTTP application URL',
      evidence: `Application URL uses http:// instead of HTTPS (${appCheck.hostname}).`,
    });
  }

  if (appCheck && appCheck.hasSuspiciousRedirect) {
    reasons.push({
      code: 'REDIRECT_URL',
      title: 'Redirect parameter detected in link',
      evidence: appCheck.warnings.join('; ') || appCheck.normalizedUrl,
    });
  }

  if (/(personal\s+(?:bkash|nagad|rocket)|send\s+money\s+to\s+01\d|বিকাশ\s*পার্সোনাল|পার্সোনাল\s*নম্বরে\s*(?:টাকা|ফি))/i.test(combinedText)) {
    reasons.push({
      code: 'PERSONAL_MFS_FEE_REQUEST',
      title: 'Possible personal mobile-wallet payment mention',
      evidence: 'Mentions sending money to a personal bKash/Nagad/Rocket number; legitimate govt circulars use Teletalk SMS, merchant pay, or official bank challan.',
    });
  }

  if (/(100%\s*job\s*guarantee|no\s*exam\s*direct\s*joining\s*fee|pay\s*for\s*appointment\s*letter|ঘুষ|টাকা\s*দিলে\s*চাকরি)/i.test(combinedText)) {
    reasons.push({
      code: 'UNREALISTIC_PROMISE',
      title: 'Unusual employment or guaranteed appointment claim',
      evidence: 'Text matches common irregular hiring claim patterns.',
    });
  }

  if (
    job.sourceVerification === 'discovery_only' &&
    appCheck?.hostname &&
    !isOfficialBangladeshDomain(appCheck.hostname) &&
    !job.circularNumber
  ) {
    reasons.push({
      code: 'UNVERIFIED_EXTERNAL_WITHOUT_REF',
      title: 'Unofficial domain without circular reference number',
      evidence: `External host (${appCheck.hostname}) lacks an official .gov.bd/.teletalk domain and circular number.`,
    });
  }

  if (job.sourceVerification === 'official_verified' && appCheck && !isOfficialBangladeshDomain(appCheck.hostname)) {
    reasons.push({
      code: 'SOURCE_DOMAIN_MISMATCH',
      title: 'Metadata vs domain mismatch',
      evidence: `Marked verified but link points to non-official host (${appCheck.hostname}).`,
    });
  }

  let warningLevel: ScamWarningLevel = 'None Observed';
  if (reasons.length >= 2 || reasons.some((r) => r.code === 'PERSONAL_MFS_FEE_REQUEST' || r.code === 'UNREALISTIC_PROMISE')) {
    warningLevel = 'High Attention';
  } else if (reasons.some((r) => r.code === 'HTTP_APPLICATION_LINK' || r.code === 'REDIRECT_URL' || r.code === 'SOURCE_DOMAIN_MISMATCH')) {
    warningLevel = 'Moderate';
  } else if (reasons.length === 1) {
    warningLevel = 'Low';
  }

  return {
    warningLevel,
    reasons,
    cautionNotice:
      'Automated warning indicators highlight items to double-check; they do not prove fraud or substitute for checking the official organization notice.',
  };
}
