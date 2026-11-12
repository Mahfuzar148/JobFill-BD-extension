import React, { useState } from 'react';
import { Plus, Trash2, Award, Compass, Code, Globe } from 'lucide-react';
import {
  UserProfile,
  AdditionalQualification,
  StudentCareerProfile,
} from '../../types/profile';

interface AdditionalQualPageProps {
  profile: UserProfile;
  onChange: (quals: AdditionalQualification[]) => void;
  onChangeCareerProfile?: (cp: StudentCareerProfile) => void;
}

const DEFAULT_CAREER_PROFILE: StudentCareerProfile = {
  educationLevel: '',
  departmentOrSubject: '',
  passingYear: '',
  gpaOrCgpa: '',
  skills: [],
  languages: [],
  projects: [],
  achievements: [],
  careerInterests: [],
  preferredJobCategories: [],
  preferredLocations: [],
  internshipPreference: false,
  expectedSalaryNote: '',
  careerGoals: [],
};

export const AdditionalQualPage: React.FC<AdditionalQualPageProps> = ({
  profile,
  onChange,
  onChangeCareerProfile,
}) => {
  const quals = profile.additionalQualifications || [];
  const cp: StudentCareerProfile = {
    ...DEFAULT_CAREER_PROFILE,
    ...(profile.careerProfile || {}),
  };

  const [skillInput, setSkillInput] = useState('');
  const [interestInput, setInterestInput] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [langName, setLangName] = useState('');
  const [langLevel, setLangLevel] = useState('Fluent');
  const [projTitle, setProjTitle] = useState('');
  const [projRole, setProjRole] = useState('');
  const [projTech, setProjTech] = useState('');
  const [projSummary, setProjSummary] = useState('');

  const updateCareer = (partial: Partial<StudentCareerProfile>) => {
    onChangeCareerProfile?.({ ...cp, ...partial });
  };

  const addTagItem = (key: 'skills' | 'careerInterests' | 'preferredJobCategories' | 'preferredLocations' | 'achievements', raw: string, clearFn: (v: string) => void) => {
    const clean = raw.trim();
    if (!clean) return;
    const current = cp[key] || [];
    if (!current.some((v) => v.toLowerCase() === clean.toLowerCase())) {
      updateCareer({ [key]: [...current, clean] } as Partial<StudentCareerProfile>);
    }
    clearFn('');
  };

  const removeTagItem = (key: 'skills' | 'careerInterests' | 'preferredJobCategories' | 'preferredLocations' | 'achievements', idx: number) => {
    const current = [...(cp[key] || [])];
    current.splice(idx, 1);
    updateCareer({ [key]: current } as Partial<StudentCareerProfile>);
  };

  const handleAdd = () => {
    const newItem: AdditionalQualification = {
      id: 'qual_' + Date.now().toString(36),
      type: 'Computer Skills',
      title: '',
      institution: '',
      duration: '',
      year: new Date().getFullYear().toString(),
      result: '',
      details: '',
    };
    onChange([...quals, newItem]);
  };

  const handleUpdate = (id: string, field: keyof AdditionalQualification, value: string) => {
    const updated = quals.map((q) => (q.id === id ? { ...q, [field]: value } : q));
    onChange(updated);
  };

  const handleDelete = (id: string) => {
    if (confirm('আপনি কি এই দক্ষতা বা প্রশিক্ষণ রেকর্ডটি মুছে ফেলতে চান?')) {
      onChange(quals.filter((q) => q.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <span>💡</span>
            <span>Additional Qualifications &amp; Skills (অতিরিক্ত যোগ্যতা ও দক্ষতা)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            কম্পিউটার স্কিল, ডিপ্লোমা, পেশাগত কোর্স, আইইএলটিএস ও অন্যান্য প্রশিক্ষণ যোগ করুন।
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-1.5 bg-petro-600 hover:bg-petro-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Qualification
        </button>
      </div>

      {quals.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
          <Award className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700">কোনো অতিরিক্ত যোগ্যতা যোগ করা হয়নি</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            চাকরির বিজ্ঞপ্তিতে কম্পিউটার দক্ষতা বা বিশেষ প্রশিক্ষণ চাওয়া হলে তা যোগ করতে উপরের বাটনে চাপুন।
          </p>
          <button
            onClick={handleAdd}
            className="mt-4 inline-flex items-center gap-1.5 bg-slate-100 hover:bg-petro-50 text-petro-700 border border-slate-300 text-xs font-bold px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            প্রথম যোগ্যতা যোগ করুন
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {quals.map((q, idx) => (
            <div
              key={q.id}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3 relative group"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-petro-700">Qualification #{idx + 1}</span>
                <button
                  onClick={() => handleDelete(q.id)}
                  title="Delete Entry"
                  className="text-slate-400 hover:text-red-500 p-1 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Type (ক্যাটাগরি)</label>
                  <select
                    value={q.type}
                    onChange={(e) => handleUpdate(q.id, 'type', e.target.value as any)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
                  >
                    <option value="Computer Skills">Computer Skills (কম্পিউটার দক্ষতা)</option>
                    <option value="Language Skills">Language Skills (ভাষা দক্ষতা)</option>
                    <option value="Professional Degree">Professional Certification (পেশাগত সনদ)</option>
                    <option value="Diploma">Diploma (ডিপ্লোমা)</option>
                    <option value="Training">Training (প্রশিক্ষণ)</option>
                    <option value="Other">Other (অন্যান্য)</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Title / Course Name (কোর্সের নাম) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={q.title}
                    onChange={(e) => handleUpdate(q.id, 'title', e.target.value)}
                    placeholder="e.g. MS Office & Internet Applications / IELTS Band 7.5"
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Institution (প্রতিষ্ঠান)</label>
                  <input
                    type="text"
                    value={q.institution}
                    onChange={(e) => handleUpdate(q.id, 'institution', e.target.value)}
                    placeholder="e.g. Bangladesh Computer Council (BCC)"
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Duration (মেয়াদ)</label>
                  <input
                    type="text"
                    value={q.duration}
                    onChange={(e) => handleUpdate(q.id, 'duration', e.target.value)}
                    placeholder="e.g. 6 Months"
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Year / Result</label>
                  <input
                    type="text"
                    value={q.result}
                    onChange={(e) => handleUpdate(q.id, 'result', e.target.value)}
                    placeholder="e.g. Grade A+ / Distinction (2022)"
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Key Topics / Details</label>
                  <textarea
                    rows={2}
                    value={q.details}
                    onChange={(e) => handleUpdate(q.id, 'details', e.target.value)}
                    placeholder="Relevant technologies, skills or training details..."
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Unified Student & Career Profile (All Fields Optional) */}
      {onChangeCareerProfile && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-5 shadow-sm">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                <Compass className="w-4 h-4 text-petro-600" />
                <span>Student &amp; Job Seeker Career Profile (Optional)</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                All fields below are optional. Shared across CV Builder, Skills Gap Analyzer &amp; Career Planner — missing fields never trigger fake recommendations.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={cp.internshipPreference}
                onChange={(e) => updateCareer({ internshipPreference: e.target.checked })}
                className="accent-petro-600"
              />
              <span>Open to Internships / Fresh Graduate Roles</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Current Education Level</label>
              <select
                value={cp.educationLevel || ''}
                onChange={(e) => updateCareer({ educationLevel: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 bg-white dark:bg-slate-800"
              >
                <option value="">-- Optional --</option>
                <option value="SSC">SSC / Equivalent</option>
                <option value="HSC">HSC / Equivalent</option>
                <option value="Diploma">Diploma</option>
                <option value="Honours / Bachelor">Honours / Bachelor</option>
                <option value="Masters">Masters</option>
                <option value="PhD">PhD</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Subject / Department</label>
              <input
                type="text"
                value={cp.departmentOrSubject || ''}
                onChange={(e) => updateCareer({ departmentOrSubject: e.target.value })}
                placeholder="e.g. CSE / Economics"
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Passing Year</label>
              <input
                type="text"
                value={cp.passingYear || ''}
                onChange={(e) => updateCareer({ passingYear: e.target.value })}
                placeholder="e.g. 2026"
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">Expected Salary (Optional)</label>
              <input
                type="text"
                value={cp.expectedSalaryNote || ''}
                onChange={(e) => updateCareer({ expectedSalaryNote: e.target.value })}
                placeholder="e.g. Govt Grade 9 / 35k BDT"
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          {/* Skills & Career Interests Tag Editors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-2 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
              <div className="font-bold flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                <Code className="w-3.5 h-3.5 text-petro-600" />
                <span>Technical &amp; Soft Skills</span>
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  placeholder="Add skill (e.g. MS Excel, TypeScript, AutoCAD)"
                  className="flex-1 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800"
                />
                <button
                  type="button"
                  onClick={() => addTagItem('skills', skillInput, setSkillInput)}
                  className="px-3 py-1.5 rounded-lg bg-petro-600 text-white font-bold cursor-pointer"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {cp.skills.map((sk, idx) => (
                  <span key={`${sk}_${idx}`} className="inline-flex items-center gap-1 bg-petro-50 text-petro-800 border border-petro-200 px-2 py-0.5 rounded-full">
                    {sk}
                    <button type="button" onClick={() => removeTagItem('skills', idx)} className="text-rose-500 font-bold cursor-pointer">×</button>
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-2 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
              <div className="font-bold flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                <Compass className="w-3.5 h-3.5 text-indigo-600" />
                <span>Career Interests &amp; Target Roles</span>
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={interestInput}
                  onChange={(e) => setInterestInput(e.target.value)}
                  placeholder="e.g. BCS Admin, Bank Officer, Full-Stack Dev"
                  className="flex-1 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800"
                />
                <button
                  type="button"
                  onClick={() => addTagItem('careerInterests', interestInput, setInterestInput)}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-bold cursor-pointer"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {cp.careerInterests.map((item, idx) => (
                  <span key={`${item}_${idx}`} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-full">
                    {item}
                    <button type="button" onClick={() => removeTagItem('careerInterests', idx)} className="text-rose-500 font-bold cursor-pointer">×</button>
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-2 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
              <div className="font-bold text-slate-700 dark:text-slate-200">Preferred Job Categories</div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={categoryInput}
                  onChange={(e) => setCategoryInput(e.target.value)}
                  placeholder="e.g. Government, Bank, Engineering, NGO"
                  className="flex-1 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800"
                />
                <button
                  type="button"
                  onClick={() => addTagItem('preferredJobCategories', categoryInput, setCategoryInput)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-white font-bold cursor-pointer"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {cp.preferredJobCategories.map((cat, idx) => (
                  <span key={`${cat}_${idx}`} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                    {cat}
                    <button type="button" onClick={() => removeTagItem('preferredJobCategories', idx)} className="text-rose-500 font-bold cursor-pointer">×</button>
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-2 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
              <div className="font-bold text-slate-700 dark:text-slate-200">Preferred Work Locations / Districts</div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  placeholder="e.g. Dhaka, Rajshahi, Chattogram, Remote"
                  className="flex-1 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800"
                />
                <button
                  type="button"
                  onClick={() => addTagItem('preferredLocations', locationInput, setLocationInput)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-white font-bold cursor-pointer"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {cp.preferredLocations.map((loc, idx) => (
                  <span key={`${loc}_${idx}`} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                    {loc}
                    <button type="button" onClick={() => removeTagItem('preferredLocations', idx)} className="text-rose-500 font-bold cursor-pointer">×</button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Language Proficiency & Portfolio Projects */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-2 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
              <div className="font-bold flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                <Globe className="w-3.5 h-3.5 text-emerald-600" />
                <span>Languages</span>
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={langName}
                  onChange={(e) => setLangName(e.target.value)}
                  placeholder="e.g. Bengali, English"
                  className="flex-1 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800"
                />
                <select
                  value={langLevel}
                  onChange={(e) => setLangLevel(e.target.value)}
                  className="border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800"
                >
                  <option value="Native">Native</option>
                  <option value="Fluent">Fluent</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Basic">Basic</option>
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (!langName.trim()) return;
                    updateCareer({
                      languages: [...cp.languages, { language: langName.trim(), proficiency: langLevel }],
                    });
                    setLangName('');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold cursor-pointer"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {cp.languages.map((l, idx) => (
                  <span key={`${l.language}_${idx}`} className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
                    {l.language} ({l.proficiency})
                    <button
                      type="button"
                      onClick={() => {
                        const next = [...cp.languages];
                        next.splice(idx, 1);
                        updateCareer({ languages: next });
                      }}
                      className="text-rose-500 font-bold cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-2 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
              <div className="font-bold text-slate-700 dark:text-slate-200">Projects / Thesis / Research</div>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="text"
                  value={projTitle}
                  onChange={(e) => setProjTitle(e.target.value)}
                  placeholder="Project / Thesis Title"
                  className="border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800"
                />
                <input
                  type="text"
                  value={projRole}
                  onChange={(e) => setProjRole(e.target.value)}
                  placeholder="Role (e.g. Lead)"
                  className="border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800"
                />
                <input
                  type="text"
                  value={projTech}
                  onChange={(e) => setProjTech(e.target.value)}
                  placeholder="Tools / Area"
                  className="border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!projTitle.trim()) return;
                    updateCareer({
                      projects: [
                        ...cp.projects,
                        {
                          id: 'proj_' + Date.now().toString(36),
                          title: projTitle.trim(),
                          role: projRole.trim(),
                          techOrFocus: projTech.trim(),
                          summary: projSummary.trim(),
                        },
                      ],
                    });
                    setProjTitle('');
                    setProjRole('');
                    setProjTech('');
                    setProjSummary('');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-petro-600 text-white font-bold cursor-pointer"
                >
                  Add Project
                </button>
              </div>
              <input
                type="text"
                value={projSummary}
                onChange={(e) => setProjSummary(e.target.value)}
                placeholder="Brief 1-line summary (optional)"
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800"
              />
              {cp.projects.length > 0 && (
                <div className="space-y-1">
                  {cp.projects.map((p, idx) => (
                    <div key={p.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded">
                      <span>
                        <strong>{p.title}</strong> {p.role ? `• ${p.role}` : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...cp.projects];
                          next.splice(idx, 1);
                          updateCareer({ projects: next });
                        }}
                        className="text-rose-500 font-bold cursor-pointer"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
