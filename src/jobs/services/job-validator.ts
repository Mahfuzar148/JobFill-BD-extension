// JobFill BD - Job Circular Validator
// Enforces schema safety, valid URLs, verified deadline consistency, and update detection.

import { NormalizedJobCircular } from '../types/job.types';
import { JobValidationResult } from '../types/source.types';
import { verifyJobUrl } from './source-verifier';
import { isCircularDocumentUrl } from './application-link-detector';

export function validateJobCircular(job: NormalizedJobCircular, now: number = Date.now()): JobValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!job.id || !job.id.trim()) errors.push('Missing job id');
  if (!job.organization || !job.organization.trim()) errors.push('Missing organization');
  if (!job.jobTitle && !job.position) errors.push('Missing jobTitle or position');

  if (job.applicationUrl) {
    const appUrlCheck = verifyJobUrl(job.applicationUrl);
    if (!appUrlCheck.isValid) {
      errors.push(`Invalid application URL: ${appUrlCheck.warnings.join(', ')}`);
    } else if (!appUrlCheck.isSafeToOpen) {
      errors.push(`Unsafe application URL: ${appUrlCheck.warnings.join(', ')}`);
    } else if (isCircularDocumentUrl(appUrlCheck.normalizedUrl)) {
      errors.push('Circular PDF/document URL cannot be used as online application URL');
    } else if (appUrlCheck.warnings.length > 0) {
      warnings.push(...appUrlCheck.warnings);
    }
  } else {
    // applicationUrl may be null when a valid circularUrl, organizationUrl, or sourceUrl exists
    const fallbackRefs = [job.circularUrl, job.sourceUrl, job.organizationUrl].filter(Boolean);
    const hasSafeRef = fallbackRefs.some((u) => {
      const res = verifyJobUrl(u);
      return res.isValid && res.isSafeToOpen;
    });
    if (!hasSafeRef) {
      errors.push('Missing valid URL (applicationUrl, circularUrl, or sourceUrl required)');
    }
  }

  if (job.circularUrl) {
    const circCheck = verifyJobUrl(job.circularUrl);
    if (!circCheck.isValid || !circCheck.isSafeToOpen) {
      warnings.push(`Circular URL flagged: ${circCheck.warnings.join(', ')}`);
    }
  }

  let hasVerifiedDeadline = Boolean(job.deadlineVerified && typeof job.deadlineAt === 'number' && Number.isFinite(job.deadlineAt));
  if (job.deadlineText && !hasVerifiedDeadline) {
    warnings.push('Deadline text present but could not be verified as a valid calendar date.');
  }
  if (job.deadlineVerified && (!job.deadlineAt || !Number.isFinite(job.deadlineAt))) {
    errors.push('Inconsistent verified deadline flag without numeric timestamp');
    hasVerifiedDeadline = false;
  }

  if (hasVerifiedDeadline && job.deadlineAt && job.deadlineAt <= now && job.status !== 'expired') {
    warnings.push('Verified deadline has passed; status should transition to expired.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    hasVerifiedDeadline,
  };
}

export function refreshJobStatus(job: NormalizedJobCircular, now: number = Date.now()): NormalizedJobCircular {
  if (!job.deadlineVerified || !job.deadlineAt) {
    return { ...job, status: 'active' };
  }
  const remaining = job.deadlineAt - now;
  if (remaining <= 0) {
    return { ...job, status: 'expired' };
  }
  if (remaining <= 7 * 24 * 60 * 60 * 1000) {
    return { ...job, status: 'closing_soon' };
  }
  return { ...job, status: 'active' };
}

export function isMeaningfulJobUpdate(existing: NormalizedJobCircular, incoming: NormalizedJobCircular): {
  meaningful: boolean;
  deadlineChanged: boolean;
} {
  const deadlineChanged = existing.deadlineAt !== incoming.deadlineAt || existing.deadlineVerified !== incoming.deadlineVerified;
  const meaningful =
    deadlineChanged ||
    existing.jobTitle !== incoming.jobTitle ||
    existing.vacancies !== incoming.vacancies ||
    existing.circularUrl !== incoming.circularUrl ||
    existing.applicationUrl !== incoming.applicationUrl ||
    existing.description !== incoming.description;

  return { meaningful, deadlineChanged };
}
