import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Plus,
  Save,
  Trash2,
  Printer,
  Download,
  ShieldCheck,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { UserProfile } from '../../types/profile';
import { getDocumentsByProfile, StoredDocument } from '../../services/indexedDB';
import {
  CvDocumentRecord,
  CvRepository,
  CvSectionVisibility,
  CvTemplateId,
  createCvDraftFromProfile,
} from '../../cv/cv-repository';
import { buildAtsCvHtml } from '../../cv/cv-renderer';

interface CvBuilderPageProps {
  profile: UserProfile;
  showToast: (msg: string) => void;
}

const SECTION_KEYS: Array<{ key: keyof CvSectionVisibility; en: string; bn: string }> = [
  { key: 'photo', en: 'Photo', bn: 'ছবি' },
  { key: 'careerObjective', en: 'Objective', bn: 'লক্ষ্য' },
  { key: 'education', en: 'Education', bn: 'শিক্ষা' },
  { key: 'experience', en: 'Experience', bn: 'অভিজ্ঞতা' },
  { key: 'skills', en: 'Skills', bn: 'দক্ষতা' },
  { key: 'training', en: 'Training', bn: 'প্রশিক্ষণ' },
  { key: 'certifications', en: 'Certifications', bn: 'সার্টিফিকেট' },
  { key: 'languages', en: 'Languages', bn: 'ভাষা' },
  { key: 'projects', en: 'Projects', bn: 'প্রজেক্ট' },
  { key: 'familyInfo', en: 'Family/Personal', bn: 'ব্যক্তিগত তথ্য' },
  { key: 'references', en: 'References', bn: 'রেফারেন্স' },
];

export const CvBuilderPage: React.FC<CvBuilderPageProps> = ({ profile, showToast }) => {
  const { language } = useApp();
  const bn = language === 'bn';

  const [versions, setVersions] = useState<CvDocumentRecord[]>([]);
  const [activeCv, setActiveCv] = useState<CvDocumentRecord>(() =>
    createCvDraftFromProfile(profile, { language: 'en' })
  );
  const [photoUrl, setPhotoUrl] = useState('');
  const [sigUrl, setSigUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const loadVersions = useCallback(async () => {
    const list = await CvRepository.getAll(profile.id);
    setVersions(list);
    if (list.length > 0) {
      setActiveCv(list[0]);
    } else {
      setActiveCv(createCvDraftFromProfile(profile, { language: bn ? 'bn' : 'en' }));
    }
  }, [profile, bn]);

  useEffect(() => {
    void loadVersions();
    getDocumentsByProfile(profile.id)
      .then((docs: StoredDocument[]) => {
        const photo =
          docs.find((d) => (d.documentType || d.type) === 'photo' && d.isProcessedVariant) ||
          docs.find((d) => (d.documentType || d.type) === 'photo');
        const sig =
          docs.find((d) => (d.documentType || d.type) === 'signature' && d.isProcessedVariant) ||
          docs.find((d) => (d.documentType || d.type) === 'signature');
        setPhotoUrl(photo?.dataUrl || '');
        setSigUrl(sig?.dataUrl || '');
      })
      .catch(() => {});
  }, [profile.id]);

  const previewHtml = useMemo(
    () => buildAtsCvHtml(activeCv, photoUrl, sigUrl),
    [activeCv, photoUrl, sigUrl]
  );

  const handleCreateNewVersion = async (langChoice: 'en' | 'bn') => {
    const draft = createCvDraftFromProfile(profile, {
      language: langChoice,
      versionTitle:
        langChoice === 'bn'
          ? `বাংলা সিভি (${versions.length + 1})`
          : `English CV Version ${versions.length + 1}`,
    });
    const saved = await CvRepository.save(draft);
    const nextList = await CvRepository.getAll(profile.id);
    setVersions(nextList);
    setActiveCv(saved);
    showToast(bn ? '📄 প্রোফাইল থেকে নতুন সিভি ভার্সন তৈরি হয়েছে' : '📄 Created new CV draft from saved profile');
  };

  const handleSaveActive = async () => {
    setSaving(true);
    try {
      const saved = await CvRepository.save(activeCv);
      const nextList = await CvRepository.getAll(profile.id);
      setVersions(nextList);
      setActiveCv(saved);
      showToast(bn ? '✅ সিভি ভার্সন লোকাল স্টোরেজে সংরক্ষিত হয়েছে' : '✅ CV version saved locally');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVersion = async (id: string) => {
    await CvRepository.delete(id);
    await loadVersions();
    showToast(bn ? '🗑️ সিভি ভার্সন মুছে ফেলা হয়েছে' : '🗑️ CV version deleted');
  };

  const handlePrintPdf = () => {
    const win = window.open('', '_blank', 'width=940,height=760');
    if (!win) {
      window.print();
      return;
    }
    win.document.open();
    win.document.write(previewHtml);
    win.document.close();
    win.focus();
    window.setTimeout(() => win.print(), 250);
  };

  const handleDownloadHtml = () => {
    const blob = new Blob([previewHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(activeCv.versionTitle || 'JobFill_CV').replace(/[^a-z0-9_-]+/gi, '_')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSection = (key: keyof CvSectionVisibility) => {
    setActiveCv((prev) => ({
      ...prev,
      visibleSections: { ...prev.visibleSections, [key]: !prev.visibleSections[key] },
    }));
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-petro-600" />
            <span>{bn ? 'লোকাল-ফার্স্ট সিভি বিল্ডার (ATS CV Builder)' : 'Local-First ATS CV Builder'}</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {bn
              ? 'সংরক্ষিত প্রোফাইল থেকে বাংলা ও ইংরেজি একাধিক ভার্সনের ATS-বান্ধব A4 সিভি তৈরি ও PDF এক্সপোর্ট করুন — কোনো তথ্য সার্ভারে পাঠানো হয় না।'
              : 'Build multiple ATS-friendly English & Bengali A4 CVs directly from your local Vault profile and print/export as PDF.'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => handleCreateNewVersion('en')}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-petro-600" />
            <span>New English CV</span>
          </button>
          <button
            type="button"
            onClick={() => handleCreateNewVersion('bn')}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-600" />
            <span>নতুন বাংলা সিভি</span>
          </button>
          <button
            type="button"
            onClick={handleSaveActive}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-petro-600 hover:bg-petro-700 text-white cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : bn ? 'ভার্সন সেভ' : 'Save Version'}</span>
          </button>
        </div>
      </div>

      {/* Privacy & Saved Versions Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-slate-600 dark:text-slate-300">
            {bn ? 'সংরক্ষিত সিভি:' : 'Saved Versions:'}
          </span>
          {versions.length === 0 ? (
            <span className="text-slate-400 italic">Working on unsaved profile draft</span>
          ) : (
            versions.map((v) => (
              <div key={v.id} className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveCv(v)}
                  className={`px-2.5 py-1 rounded-lg font-semibold border cursor-pointer ${
                    activeCv.id === v.id
                      ? 'bg-petro-600 text-white border-petro-700'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {v.versionTitle} ({v.language.toUpperCase()})
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteVersion(v.id)}
                  title="Delete CV Version"
                  className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold text-[11px]">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>Local-Only Processing • Never Sent Externally</span>
        </div>
      </div>

      {/* Editor + Live A4 Preview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Editor */}
        <div className="lg:col-span-5 space-y-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs max-h-[760px] overflow-y-auto">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="col-span-2">
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">CV Version Name</label>
              <input
                type="text"
                value={activeCv.versionTitle}
                onChange={(e) => setActiveCv({ ...activeCv, versionTitle: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Language</label>
              <select
                value={activeCv.language}
                onChange={(e) => setActiveCv({ ...activeCv, language: e.target.value as 'en' | 'bn' })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800"
              >
                <option value="en">English CV</option>
                <option value="bn">বাংলা সিভি (Bengali)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">ATS Template</label>
              <select
                value={activeCv.template}
                onChange={(e) => setActiveCv({ ...activeCv, template: e.target.value as CvTemplateId })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800"
              >
                <option value="ats_classic">ATS Classic (Slate)</option>
                <option value="academic_bd">BD Standard (Teal)</option>
                <option value="modern_compact">Compact Corporate (Blue)</option>
              </select>
            </div>
          </div>

          {/* Section Visibility Toggles */}
          <div>
            <div className="font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {bn ? 'সেকশন দেখান / লুকান:' : 'Show / Hide Sections:'}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SECTION_KEYS.map((sec) => {
                const visible = activeCv.visibleSections[sec.key];
                return (
                  <button
                    key={sec.key}
                    type="button"
                    onClick={() => toggleSection(sec.key)}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10.5px] font-semibold border cursor-pointer ${
                      visible
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:border-slate-700'
                    }`}
                  >
                    {visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    <span>{bn ? sec.bn : sec.en}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Personal Header Fields */}
          <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="block font-semibold mb-1">Full Name (EN)</label>
              <input
                type="text"
                value={activeCv.personal.fullName}
                onChange={(e) =>
                  setActiveCv({ ...activeCv, personal: { ...activeCv.personal, fullName: e.target.value } })
                }
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">নাম (বাংলায়)</label>
              <input
                type="text"
                value={activeCv.personal.fullNameBn}
                onChange={(e) =>
                  setActiveCv({ ...activeCv, personal: { ...activeCv.personal, fullNameBn: e.target.value } })
                }
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Mobile</label>
              <input
                type="text"
                value={activeCv.personal.mobile}
                onChange={(e) =>
                  setActiveCv({ ...activeCv, personal: { ...activeCv.personal, mobile: e.target.value } })
                }
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Email</label>
              <input
                type="email"
                value={activeCv.personal.email}
                onChange={(e) =>
                  setActiveCv({ ...activeCv, personal: { ...activeCv.personal, email: e.target.value } })
                }
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1">Career Objective</label>
            <textarea
              rows={2}
              value={activeCv.careerObjective}
              placeholder="Write your real career summary / objective..."
              onChange={(e) => setActiveCv({ ...activeCv, careerObjective: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800"
            />
          </div>

          {/* Skills / Training / Certifications / Languages */}
          <div className="grid grid-cols-1 gap-2.5">
            <div>
              <label className="block font-semibold mb-1">Skills (one per line)</label>
              <textarea
                rows={2}
                value={activeCv.skills.join('\n')}
                onChange={(e) => setActiveCv({ ...activeCv, skills: e.target.value.split('\n') })}
                placeholder="e.g. MS Office, TypeScript, Financial Analysis"
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Training &amp; Certifications (one per line)</label>
              <textarea
                rows={2}
                value={activeCv.certifications.join('\n')}
                onChange={(e) => setActiveCv({ ...activeCv, certifications: e.target.value.split('\n') })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Languages (one per line)</label>
              <textarea
                rows={2}
                value={activeCv.languages.join('\n')}
                onChange={(e) => setActiveCv({ ...activeCv, languages: e.target.value.split('\n') })}
                placeholder="e.g. Bengali (Native), English (Fluent)"
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          {/* Projects */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold">Projects</span>
              <button
                type="button"
                onClick={() =>
                  setActiveCv({
                    ...activeCv,
                    projects: [...activeCv.projects, { name: '', role: '', details: '' }],
                  })
                }
                className="text-petro-600 font-bold hover:underline cursor-pointer"
              >
                + Add Project
              </button>
            </div>
            {activeCv.projects.map((p, idx) => (
              <div key={idx} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 space-y-1.5">
                <input
                  type="text"
                  placeholder="Project Title"
                  value={p.name}
                  onChange={(e) => {
                    const next = [...activeCv.projects];
                    next[idx] = { ...p, name: e.target.value };
                    setActiveCv({ ...activeCv, projects: next });
                  }}
                  className="w-full border border-slate-300 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-900"
                />
                <input
                  type="text"
                  placeholder="Summary / Outcome"
                  value={p.details}
                  onChange={(e) => {
                    const next = [...activeCv.projects];
                    next[idx] = { ...p, details: e.target.value };
                    setActiveCv({ ...activeCv, projects: next });
                  }}
                  className="w-full border border-slate-300 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-900"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Right A4 Live Preview & PDF Export */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-200">
              {bn ? 'লাইভ A4 প্রিন্ট প্রিভিউ' : 'Live A4 Print & PDF Preview'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadHtml}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>HTML</span>
              </button>
              <button
                type="button"
                onClick={handlePrintPdf}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-petro-600 hover:bg-petro-700 text-white font-bold shadow cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{bn ? 'প্রিন্ট / A4 PDF ডাউনলোড' : 'Print / Save A4 PDF'}</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <iframe
              title="ATS CV A4 Preview"
              srcDoc={previewHtml}
              className="w-full h-[690px] border-0 bg-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
