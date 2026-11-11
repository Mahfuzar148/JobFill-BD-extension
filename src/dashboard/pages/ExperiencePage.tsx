import React from 'react';
import { Plus, Trash2, Briefcase } from 'lucide-react';
import { UserProfile, JobExperience } from '../../types/profile';

interface ExperiencePageProps {
  profile: UserProfile;
  onChange: (jobs: JobExperience[]) => void;
  onToggleHasExperience: (has: boolean) => void;
}

export const ExperiencePage: React.FC<ExperiencePageProps> = ({
  profile,
  onChange,
  onToggleHasExperience,
}) => {
  const jobs = profile.jobExperiences || [];

  const handleAddJob = () => {
    const newJob: JobExperience = {
      id: 'job_' + Date.now().toString(36),
      employedOn: 'Private',
      organization: '',
      designation: '',
      address: '',
      startDate: '',
      endDate: '',
      currentlyWorking: true,
      salary: '',
      jobDescription: '',
    };
    onChange([...jobs, newJob]);
    if (!profile.hasJobExperience) onToggleHasExperience(true);
  };

  const handleUpdate = (id: string, field: keyof JobExperience, value: any) => {
    const updated = jobs.map((j) => (j.id === id ? { ...j, [field]: value } : j));
    onChange(updated);
  };

  const handleDelete = (id: string) => {
    if (confirm('আপনি কি এই চাকরির অভিজ্ঞতা রেকর্ডটি মুছে ফেলতে চান?')) {
      const filtered = jobs.filter((j) => j.id !== id);
      onChange(filtered);
      if (filtered.length === 0) onToggleHasExperience(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <span>💼</span>
            <span>Job Experience (পেশাগত ও চাকরির অভিজ্ঞতা)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            পেট্রোবাংলা এবং সরকারি নিয়োগ বিজ্ঞপ্তির Job Experiences সেকশনের অনুরূপ একাধিক চাকরির তথ্য সংরক্ষণ করুন।
          </p>
        </div>
        <button
          onClick={handleAddJob}
          className="flex items-center gap-1.5 bg-petro-600 hover:bg-petro-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Experience
        </button>
      </div>

      {jobs.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
          <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700">কোনো চাকরির অভিজ্ঞতা যোগ করা নেই</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            আপনি ফ্রেশ গ্র্যাজুয়েট হলে এই অংশটি খালি রাখতে পারেন। পূর্ব অভিজ্ঞতা থাকলে নিচের বাটনে চাপ দিন।
          </p>
          <button
            onClick={handleAddJob}
            className="mt-4 inline-flex items-center gap-1.5 bg-slate-100 hover:bg-petro-50 text-petro-700 border border-slate-300 text-xs font-bold px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            প্রথম অভিজ্ঞতা যোগ করুন
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job, idx) => (
            <div
              key={job.id}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 relative"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-petro-100 text-petro-700 font-bold text-xs flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-bold text-petro-800">
                    {job.organization ? job.organization : `Employment Record #${idx + 1}`}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(job.id)}
                  title="Remove Job"
                  className="text-slate-400 hover:text-red-500 p-1 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Employed On (নিয়োগের ধরন) <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={job.employedOn}
                    onChange={(e) => handleUpdate(job.id, 'employedOn', e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
                  >
                    <option value="Government">Government (সরকারি)</option>
                    <option value="Semi-Government">Semi-Government (আধা-সরকারি)</option>
                    <option value="Autonomous">Autonomous (স্বায়ত্বশাসিত)</option>
                    <option value="Private">Private (বেসরকারি)</option>
                    <option value="NGO">NGO / Development Organization</option>
                    <option value="Contractual">Contractual / Project-based</option>
                    <option value="Self-Employed">Self-Employed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Organization Name (প্রতিষ্ঠানের নাম) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={job.organization}
                    onChange={(e) => handleUpdate(job.id, 'organization', e.target.value)}
                    placeholder="e.g. Petrobangla / Tech Company Ltd."
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Designation / Post (পদবী) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={job.designation}
                    onChange={(e) => handleUpdate(job.id, 'designation', e.target.value)}
                    placeholder="e.g. Assistant Engineer / Officer"
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Organization Address (প্রতিষ্ঠানের ঠিকানা)
                  </label>
                  <input
                    type="text"
                    value={job.address}
                    onChange={(e) => handleUpdate(job.id, 'address', e.target.value)}
                    placeholder="e.g. Kawran Bazar, Dhaka"
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Length of Service: From (শুরুর তারিখ)
                  </label>
                  <input
                    type="date"
                    value={job.startDate}
                    onChange={(e) => handleUpdate(job.id, 'startDate', e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Length of Service: To (শেষের তারিখ)
                    </label>
                    <label className="text-[11px] font-semibold text-petro-700 flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={job.currentlyWorking}
                        onChange={(e) => {
                          handleUpdate(job.id, 'currentlyWorking', e.target.checked);
                          if (e.target.checked) handleUpdate(job.id, 'endDate', '');
                        }}
                        className="rounded accent-petro-600"
                      />
                      Currently Working
                    </label>
                  </div>
                  <input
                    type="date"
                    disabled={job.currentlyWorking}
                    value={job.endDate}
                    onChange={(e) => handleUpdate(job.id, 'endDate', e.target.value)}
                    className={`w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600 ${
                      job.currentlyWorking ? 'bg-slate-100 text-slate-400' : ''
                    }`}
                  />
                </div>

                <div className="md:col-span-2">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Job Description (কাজের বিবরণ — সর্বোচ্চ ৩০০ অক্ষর)
                    </label>
                    <span
                      className={`text-[10.5px] font-mono ${
                        job.jobDescription.length > 300 ? 'text-red-500 font-bold' : 'text-slate-400'
                      }`}
                    >
                      {job.jobDescription.length} / 300
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    maxLength={300}
                    value={job.jobDescription}
                    onChange={(e) => handleUpdate(job.id, 'jobDescription', e.target.value)}
                    placeholder="Briefly describe your key responsibilities and duties..."
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
