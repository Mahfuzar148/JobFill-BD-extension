import React from 'react';
import { Plus, Trash2, Award } from 'lucide-react';
import { UserProfile, AdditionalQualification } from '../../types/profile';

interface AdditionalQualPageProps {
  profile: UserProfile;
  onChange: (quals: AdditionalQualification[]) => void;
}

export const AdditionalQualPage: React.FC<AdditionalQualPageProps> = ({ profile, onChange }) => {
  const quals = profile.additionalQualifications || [];

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
    </div>
  );
};
