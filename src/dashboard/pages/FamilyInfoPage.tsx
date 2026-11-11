// JobFill BD - Family Information Page
// Dedicated UI for Father, Mother, and Spouse details in English & Bangla.

import React from 'react';
import { UserProfile, PersonalInfo } from '../../types/profile';
import { Users, Heart } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface FamilyInfoPageProps {
  profile: UserProfile;
  onChange: (updated: Partial<PersonalInfo>) => void;
}

export const FamilyInfoPage: React.FC<FamilyInfoPageProps> = ({ profile, onChange }) => {
  const { language } = useApp();
  const p = profile.personal;

  const updatePersonal = (patch: Partial<PersonalInfo>) => {
    onChange(patch);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
          <Users className="text-emerald-600" size={24} />
          {language === 'bn' ? 'পারিবারিক তথ্য (Family Information)' : 'Family Information'}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {language === 'bn'
            ? 'পিতা, মাতা ও বৈবাহিক অবস্থার বিবরণ উভয় ভাষায় সংরক্ষণ করুন।'
            : "Father's, mother's, and spouse information in both English and Bangla."}
        </p>
      </div>

      {/* Father Details */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2">
          {language === 'bn' ? "পিতার বিবরণ (Father's Information)" : "Father's Information"}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Father's Name (English) *
            </label>
            <input
              type="text"
              value={p.fatherNameEn}
              onChange={(e) => updatePersonal({ fatherNameEn: e.target.value.toUpperCase() })}
              placeholder="e.g. MD. ABDUR RAHIM"
              className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              পিতার নাম (বাংলায়)
            </label>
            <input
              type="text"
              value={p.fatherNameBn}
              onChange={(e) => updatePersonal({ fatherNameBn: e.target.value })}
              placeholder="যেমন: মোঃ আব্দুর রহিম"
              className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Mother Details */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2">
          {language === 'bn' ? "মাতার বিবরণ (Mother's Information)" : "Mother's Information"}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Mother's Name (English) *
            </label>
            <input
              type="text"
              value={p.motherNameEn}
              onChange={(e) => updatePersonal({ motherNameEn: e.target.value.toUpperCase() })}
              placeholder="e.g. MST. FATEMA BEGUM"
              className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              মাতার নাম (বাংলায়)
            </label>
            <input
              type="text"
              value={p.motherNameBn}
              onChange={(e) => updatePersonal({ motherNameBn: e.target.value })}
              placeholder="যেমন: মোছাঃ ফাতেমা বেগম"
              className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Spouse Details (Always Editable) */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
          <div className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <Heart size={14} className="text-rose-500" />
            {language === 'bn' ? 'স্বামী/স্ত্রীর বিবরণ (Spouse Details)' : 'Spouse Details'}
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
            Marital Status: {p.maritalStatus || 'Not Set'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Marital Status (বৈবাহিক অবস্থা)
            </label>
            <select
              value={p.maritalStatus}
              onChange={(e) => updatePersonal({ maritalStatus: e.target.value as PersonalInfo['maritalStatus'] })}
              className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">-- নির্বাচন করুন (Select) --</option>
              <option value="Single">Single (অবিবাহিত)</option>
              <option value="Married">Married (বিবাহিত)</option>
              <option value="Divorced">Divorced (তালাকপ্রাপ্ত)</option>
              <option value="Widowed">Widowed (বিধবা / বিপত্নীক)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Spouse Name (English)
            </label>
            <input
              type="text"
              value={p.spouseNameEn}
              onChange={(e) => updatePersonal({ spouseNameEn: e.target.value.toUpperCase() })}
              placeholder="e.g. NUSRAT JAHAN"
              className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              স্বামী/স্ত্রীর নাম (বাংলায়)
            </label>
            <input
              type="text"
              value={p.spouseNameBn}
              onChange={(e) => updatePersonal({ spouseNameBn: e.target.value })}
              placeholder="যেমন: নুসরাত জাহান"
              className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {p.maritalStatus !== 'Married' && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {language === 'bn'
              ? 'টিপস: আপনি চাইলে যেকোনো সময় এখানে স্বামী/স্ত্রীর নাম সংরক্ষণ করতে পারেন। বিবাহিত (Married) সিলেক্ট থাকলে আবেদন ফর্মে এটি প্রযোজ্য হবে।'
              : 'Tip: You can edit and save Spouse details at any time; they apply on forms when Marital Status is Married.'}
          </p>
        )}
      </div>
    </div>
  );
};
