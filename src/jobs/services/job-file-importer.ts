// JobFill BD - Authorized CSV & JSON Job Circular File Importer
// Allows users to manually import public job circulars from authorized local files.
// Strictly validates every imported record, flags errors, and never imports private or account data.

import { NormalizedJobCircular, JobCategory } from '../types/job.types';
import { RawSourceJobItem } from '../types/source.types';
import { normalizeJobRecord } from './job-normalizer';
import { validateJobCircular } from './job-validator';

export interface FileImportOutcome {
  success: boolean;
  importedJobs: NormalizedJobCircular[];
  errors: string[];
  totalParsed: number;
}

export function parseJobCircularsJson(jsonString: string): FileImportOutcome {
  const errors: string[] = [];
  const importedJobs: NormalizedJobCircular[] = [];
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonString);
  } catch (err: any) {
    return {
      success: false,
      importedJobs: [],
      errors: [`Invalid JSON format: ${err?.message || 'Syntax error'}`],
      totalParsed: 0,
    };
  }

  const items = Array.isArray(parsed) ? parsed : [parsed];
  const now = Date.now();

  for (let i = 0; i < items.length; i++) {
    const raw = items[i];
    if (!raw || typeof raw !== 'object') {
      errors.push(`Row ${i + 1}: Not a valid JSON object.`);
      continue;
    }

    const org = String(raw.organization || raw.company || raw.orgName || '').trim();
    const title = String(raw.jobTitle || raw.position || raw.title || '').trim();

    if (!org || !title) {
      errors.push(`Row ${i + 1}: Missing required organization or job title.`);
      continue;
    }

    const rawItem: RawSourceJobItem = {
      externalId: `user_import_${Date.now()}_${i}`,
      organization: org,
      jobTitle: title,
      position: title,
      category: (raw.category as JobCategory) || 'Other',
      employmentType: raw.employmentType || 'Full Time',
      vacancies: Number.isFinite(Number(raw.vacancies)) ? Number(raw.vacancies) : null,
      salary: raw.salary ? String(raw.salary) : undefined,
      location: raw.location ? String(raw.location) : 'All Bangladesh',
      publishedDateText: raw.publishedDate || raw.publishedDateText,
      deadlineText: raw.deadline || raw.deadlineText,
      circularUrl: raw.circularUrl || raw.url || undefined,
      applicationUrl: raw.applicationUrl || null,
      sourceUrl: raw.sourceUrl || null,
      description: raw.description ? String(raw.description).slice(0, 1000) : undefined,
      qualification: raw.qualification || raw.education,
    };

    const normalized = normalizeJobRecord(rawItem, {
      sourceId: 'user_submitted',
      sourceName: 'User File Import',
      verificationLevel: 'user_submitted',
      checkedAt: now,
    });

    const val = validateJobCircular(normalized);
    if (!val.isValid) {
      errors.push(`Row ${i + 1} (${title}): ${val.errors.join('; ')}`);
      continue;
    }

    importedJobs.push(normalized);
  }

  return {
    success: importedJobs.length > 0,
    importedJobs,
    errors,
    totalParsed: items.length,
  };
}

export function parseJobCircularsCsv(csvText: string): FileImportOutcome {
  const errors: string[] = [];
  const importedJobs: NormalizedJobCircular[] = [];
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  if (lines.length < 2) {
    return {
      success: false,
      importedJobs: [],
      errors: ['CSV file must contain a header row and at least one data row.'],
      totalParsed: 0,
    };
  }

  const headers = lines[0].split(',').map((h) => h.replace(/^["']|["']$/g, '').trim().toLowerCase());
  const orgIdx = headers.findIndex((h) => h.includes('org') || h.includes('company'));
  const titleIdx = headers.findIndex((h) => h.includes('title') || h.includes('position') || h.includes('job'));
  const deadlineIdx = headers.findIndex((h) => h.includes('deadline') || h.includes('close'));
  const urlIdx = headers.findIndex((h) => h.includes('url') || h.includes('link') || h.includes('circular'));
  const appUrlIdx = headers.findIndex((h) => h.includes('apply') || h.includes('application'));
  const catIdx = headers.findIndex((h) => h.includes('category') || h.includes('type'));
  const locIdx = headers.findIndex((h) => h.includes('location') || h.includes('district'));

  if (orgIdx === -1 || titleIdx === -1) {
    return {
      success: false,
      importedJobs: [],
      errors: ['CSV must have columns for Organization (or Company) and Job Title (or Position).'],
      totalParsed: 0,
    };
  }

  const now = Date.now();
  for (let i = 1; i < lines.length; i++) {
    // Simple CSV parser supporting quotes
    const row = lines[i];
    const cells: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        cells.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());

    const org = cells[orgIdx]?.replace(/^["']|["']$/g, '').trim();
    const title = cells[titleIdx]?.replace(/^["']|["']$/g, '').trim();

    if (!org || !title) {
      errors.push(`Row ${i + 1}: Missing Organization or Title.`);
      continue;
    }

    const rawItem: RawSourceJobItem = {
      externalId: `user_csv_${Date.now()}_${i}`,
      organization: org,
      jobTitle: title,
      position: title,
      deadlineText: deadlineIdx !== -1 ? cells[deadlineIdx]?.replace(/^["']|["']$/g, '').trim() : undefined,
      circularUrl: urlIdx !== -1 ? cells[urlIdx]?.replace(/^["']|["']$/g, '').trim() : undefined,
      applicationUrl: appUrlIdx !== -1 ? cells[appUrlIdx]?.replace(/^["']|["']$/g, '').trim() : null,
      category: catIdx !== -1 ? (cells[catIdx] as JobCategory) : 'Other',
      location: locIdx !== -1 ? cells[locIdx] : 'All Bangladesh',
    };

    const normalized = normalizeJobRecord(rawItem, {
      sourceId: 'user_submitted',
      sourceName: 'User CSV Import',
      verificationLevel: 'user_submitted',
      checkedAt: now,
    });

    const val = validateJobCircular(normalized);
    if (!val.isValid) {
      errors.push(`Row ${i + 1} (${title}): ${val.errors.join('; ')}`);
      continue;
    }

    importedJobs.push(normalized);
  }

  return {
    success: importedJobs.length > 0,
    importedJobs,
    errors,
    totalParsed: lines.length - 1,
  };
}
