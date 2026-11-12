// JobFill BD - Local-First Multi-Version CV Builder Repository
// Uses IndexedDB STORES.CV_DOCUMENTS (v9) with non-destructive localStorage envelope fallback.
// Never fabricates qualifications or transmits CV contents externally.

import { IndexedDBManager, STORES } from '../database/indexeddb';
import type { UserProfile } from '../types/profile';

const CV_LOCAL_FALLBACK_KEY = 'jobfill_cv_documents_v1';

export type CvTemplateId = 'ats_classic' | 'academic_bd' | 'modern_compact';
export type CvLanguage = 'en' | 'bn';

export interface CvSectionVisibility {
  photo: boolean;
  familyInfo: boolean;
  careerObjective: boolean;
  education: boolean;
  experience: boolean;
  skills: boolean;
  training: boolean;
  certifications: boolean;
  languages: boolean;
  projects: boolean;
  references: boolean;
}

export interface CvEducationItem {
  level: string;
  institution: string;
  subject: string;
  year: string;
  result: string;
}

export interface CvExperienceItem {
  organization: string;
  designation: string;
  duration: string;
  details: string;
}

export interface CvProjectItem {
  name: string;
  role: string;
  details: string;
}

export interface CvReferenceItem {
  name: string;
  designation: string;
  organization: string;
  contact: string;
}

export interface CvDocumentRecord {
  id: string;
  profileId: string;
  versionTitle: string;
  language: CvLanguage;
  template: CvTemplateId;
  personal: {
    fullName: string;
    fullNameBn: string;
    fatherName: string;
    motherName: string;
    dob: string;
    nationality: string;
    mobile: string;
    email: string;
    presentAddress: string;
    permanentAddress: string;
  };
  careerObjective: string;
  education: CvEducationItem[];
  experiences: CvExperienceItem[];
  skills: string[];
  training: string[];
  certifications: string[];
  languages: string[];
  projects: CvProjectItem[];
  references: CvReferenceItem[];
  visibleSections: CvSectionVisibility;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_CV_VISIBILITY: CvSectionVisibility = {
  photo: true,
  familyInfo: true,
  careerObjective: true,
  education: true,
  experience: true,
  skills: true,
  training: true,
  certifications: true,
  languages: true,
  projects: true,
  references: true,
};

function formatAddr(a?: UserProfile['address']['present']): string {
  if (!a) return '';
  return [
    a.house,
    a.road,
    a.village,
    a.postOffice,
    a.postCode ? `-${a.postCode}` : '',
    a.upazila,
    a.district,
    a.division,
  ]
    .map((x) => (x || '').trim())
    .filter(Boolean)
    .join(', ');
}

/**
 * Creates a clean CV draft from an active profile strictly copying saved entries (never inventing missing data).
 */
export function createCvDraftFromProfile(
  profile: UserProfile,
  options: { versionTitle?: string; language?: CvLanguage; template?: CvTemplateId } = {}
): CvDocumentRecord {
  const now = new Date().toISOString();
  const lang: CvLanguage = options.language || 'en';
  const education: CvEducationItem[] = [];

  if (profile.hasMasters && (profile.masters?.universityInstitute || profile.masters?.gpa || profile.masters?.subjectDegree)) {
    education.push({
      level: profile.masters.examination || 'Masters',
      institution: profile.masters.universityInstitute || profile.masters.college || '',
      subject: profile.masters.subjectDegree || '',
      year: profile.masters.passingYear || '',
      result: profile.masters.gpa ? `CGPA ${profile.masters.gpa}` : profile.masters.resultType || '',
    });
  }
  if (profile.hasGraduation && (profile.graduation?.universityInstitute || profile.graduation?.gpa || profile.graduation?.subjectDegree)) {
    education.push({
      level: profile.graduation.examination || 'Graduation',
      institution: profile.graduation.universityInstitute || profile.graduation.college || '',
      subject: profile.graduation.subjectDegree || '',
      year: profile.graduation.passingYear || '',
      result: profile.graduation.gpa ? `CGPA ${profile.graduation.gpa}` : profile.graduation.resultType || '',
    });
  }
  if (profile.hsc?.gpa || profile.hsc?.rollNumber || profile.hsc?.passingYear || profile.hsc?.institution) {
    education.push({
      level: profile.hsc.examination || 'HSC',
      institution: profile.hsc.institution || profile.hsc.board || '',
      subject: profile.hsc.groupSubject || '',
      year: profile.hsc.passingYear || '',
      result: profile.hsc.gpa ? `GPA ${profile.hsc.gpa}` : profile.hsc.resultType || '',
    });
  }
  if (profile.ssc?.gpa || profile.ssc?.rollNumber || profile.ssc?.passingYear || profile.ssc?.institution) {
    education.push({
      level: profile.ssc.examination || 'SSC',
      institution: profile.ssc.institution || profile.ssc.board || '',
      subject: profile.ssc.groupSubject || '',
      year: profile.ssc.passingYear || '',
      result: profile.ssc.gpa ? `GPA ${profile.ssc.gpa}` : profile.ssc.resultType || '',
    });
  }

  const experiences: CvExperienceItem[] = (profile.jobExperiences || []).map((ex) => ({
    organization: ex.organization || '',
    designation: ex.designation || '',
    duration: [ex.startDate, ex.currentlyWorking ? 'Present' : ex.endDate].filter(Boolean).join(' - '),
    details: ex.jobDescription || '',
  }));

  const cp = profile.careerProfile;
  const skills: string[] = [...(cp?.skills || [])];
  const training: string[] = [];
  const certifications: string[] = [];
  const languages: string[] = (cp?.languages || []).map((l) =>
    l.proficiency ? `${l.language} (${l.proficiency})` : l.language
  );
  const projects: CvProjectItem[] = (cp?.projects || []).map((p) => ({
    name: p.title || '',
    role: p.role || '',
    details: [p.techOrFocus, p.summary].filter(Boolean).join(' — '),
  }));

  for (const aq of profile.additionalQualifications || []) {
    const label = [aq.title, aq.institution ? `(${aq.institution})` : '', aq.year || ''].filter(Boolean).join(' ');
    if (!label) continue;
    if (aq.type === 'Training') training.push(label);
    else if (aq.type === 'Language Skills' && !languages.includes(label)) languages.push(label);
    else if (aq.type === 'Diploma' || aq.type === 'Professional Degree') certifications.push(label);
    else if (!skills.includes(label)) skills.push(label);
  }
  for (const ach of cp?.achievements || []) {
    if (ach && !certifications.includes(ach)) certifications.push(ach);
  }

  const references: CvReferenceItem[] = (profile.references || []).map((r) => ({
    name: r.name || '',
    designation: r.designation || '',
    organization: r.organization || '',
    contact: [r.mobile, r.email].filter(Boolean).join(' / '),
  }));

  const permAddr = profile.address?.sameAsPresent
    ? formatAddr(profile.address.present)
    : formatAddr(profile.address?.permanent);

  return {
    id: `cv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    profileId: profile.id,
    versionTitle:
      options.versionTitle ||
      (lang === 'bn' ? 'স্ট্যান্ডার্ড সিভি / বায়ো-ডাটা' : 'Standard Professional CV'),
    language: lang,
    template: options.template || 'ats_classic',
    personal: {
      fullName: profile.personal?.applicantNameEn || '',
      fullNameBn: profile.personal?.applicantNameBn || '',
      fatherName: profile.personal?.fatherNameEn || profile.personal?.fatherNameBn || '',
      motherName: profile.personal?.motherNameEn || profile.personal?.motherNameBn || '',
      dob: profile.personal?.dob || '',
      nationality: profile.personal?.nationality || 'Bangladeshi',
      mobile: profile.personal?.mobile || '',
      email: profile.personal?.email || '',
      presentAddress: formatAddr(profile.address?.present),
      permanentAddress: permAddr,
    },
    careerObjective: '',
    education,
    experiences,
    skills,
    training,
    certifications,
    languages,
    projects,
    references,
    visibleSections: { ...DEFAULT_CV_VISIBILITY },
    createdAt: now,
    updatedAt: now,
  };
}

async function readAllRaw(): Promise<CvDocumentRecord[]> {
  if (typeof indexedDB !== 'undefined') {
    try {
      return await IndexedDBManager.executeTransaction<CvDocumentRecord[]>(
        STORES.CV_DOCUMENTS,
        'readonly',
        (store) =>
          new Promise((resolve, reject) => {
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
          })
      );
    } catch {
      // Fallback
    }
  }
  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(CV_LOCAL_FALLBACK_KEY);
    return raw ? JSON.parse(raw) : [];
  }
  return [];
}

export class CvRepository {
  public static async getAll(profileId?: string): Promise<CvDocumentRecord[]> {
    const all = await readAllRaw();
    const filtered = profileId ? all.filter((c) => c.profileId === profileId) : all;
    return filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  public static async save(doc: CvDocumentRecord): Promise<CvDocumentRecord> {
    const updated: CvDocumentRecord = {
      ...doc,
      updatedAt: new Date().toISOString(),
    };
    if (typeof indexedDB !== 'undefined') {
      try {
        await IndexedDBManager.executeTransaction<void>(
          STORES.CV_DOCUMENTS,
          'readwrite',
          (store) =>
            new Promise((resolve, reject) => {
              const req = store.put(updated);
              req.onsuccess = () => resolve();
              req.onerror = () => reject(req.error);
            })
        );
        return updated;
      } catch {
        // Fallback
      }
    }
    if (typeof localStorage !== 'undefined') {
      const list = await readAllRaw();
      const idx = list.findIndex((c) => c.id === updated.id);
      if (idx >= 0) list[idx] = updated;
      else list.push(updated);
      localStorage.setItem(CV_LOCAL_FALLBACK_KEY, JSON.stringify(list));
    }
    return updated;
  }

  public static async delete(id: string): Promise<void> {
    if (typeof indexedDB !== 'undefined') {
      try {
        await IndexedDBManager.executeTransaction<void>(
          STORES.CV_DOCUMENTS,
          'readwrite',
          (store) =>
            new Promise((resolve, reject) => {
              const req = store.delete(id);
              req.onsuccess = () => resolve();
              req.onerror = () => reject(req.error);
            })
        );
        return;
      } catch {
        // Fallback
      }
    }
    if (typeof localStorage !== 'undefined') {
      const list = await readAllRaw();
      localStorage.setItem(CV_LOCAL_FALLBACK_KEY, JSON.stringify(list.filter((c) => c.id !== id)));
    }
  }

  public static async clearAll(): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(CV_LOCAL_FALLBACK_KEY);
    }
    if (typeof indexedDB !== 'undefined') {
      try {
        await IndexedDBManager.executeTransaction<void>(
          STORES.CV_DOCUMENTS,
          'readwrite',
          (store) =>
            new Promise((resolve, reject) => {
              const req = store.clear();
              req.onsuccess = () => resolve();
              req.onerror = () => reject(req.error);
            })
        );
      } catch {
        // ignore
      }
    }
  }
}
