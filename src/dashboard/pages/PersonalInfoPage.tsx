import React from 'react';
import { UserProfile, PersonalInfo } from '../../types/profile';

interface PersonalInfoPageProps {
  profile: UserProfile;
  onChange: (updated: Partial<PersonalInfo>) => void;
}

export const PersonalInfoPage: React.FC<PersonalInfoPageProps> = ({ profile, onChange }) => {
  const p = profile.personal;

  const handleChange = (field: keyof PersonalInfo, value: any) => {
    onChange({ [field]: value });
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <span>👤</span>
          <span>Personal Information (ব্যক্তিগত তথ্য)</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          সার্টিফিকেট ও জাতীয় পরিচয়পত্র অনুযায়ী আপনার ব্যক্তিগত তথ্যগুলো নির্ভুলভাবে লিখুন।
        </p>
      </div>

      {/* Names Section */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="text-xs font-bold text-petro-700 uppercase tracking-wider border-b border-slate-100 pb-2">
          নাম ও পারিবারিক পরিচয় (Names &amp; Parents)
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Applicant's Name (English) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={p.applicantNameEn}
              onChange={(e) => handleChange('applicantNameEn', e.target.value)}
              placeholder="MD. FIRSTNAME LASTNAME"
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
            />
            <span className="text-[10.5px] text-slate-400">এসএসসি সনদ অনুযায়ী ক্যাপিটাল লেটারে লিখুন</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              আবেদনকারীর নাম (বাংলায়) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={p.applicantNameBn}
              onChange={(e) => handleChange('applicantNameBn', e.target.value)}
              placeholder="মোঃ ফার্স্টনেম লাস্টনেম"
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Father's Name (English) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={p.fatherNameEn}
              onChange={(e) => handleChange('fatherNameEn', e.target.value)}
              placeholder="MD. FATHER NAME"
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              পিতার নাম (বাংলায়)
            </label>
            <input
              type="text"
              value={p.fatherNameBn}
              onChange={(e) => handleChange('fatherNameBn', e.target.value)}
              placeholder="মোঃ পিতার নাম"
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mother's Name (English) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={p.motherNameEn}
              onChange={(e) => handleChange('motherNameEn', e.target.value)}
              placeholder="MST. MOTHER NAME"
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              মাতার নাম (বাংলায়)
            </label>
            <input
              type="text"
              value={p.motherNameBn}
              onChange={(e) => handleChange('motherNameBn', e.target.value)}
              placeholder="মোছাঃ মাতার নাম"
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
            />
          </div>
        </div>

        {/* Marital & Spouse */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Marital Status (বৈবাহিক অবস্থা) <span className="text-red-500">*</span>
            </label>
            <select
              value={p.maritalStatus}
              onChange={(e) => handleChange('maritalStatus', e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
            >
              <option value="">-- বৈবাহিক অবস্থা নির্বাচন করুন --</option>
              <option value="Single">Single (অবিবাহিত)</option>
              <option value="Married">Married (বিবাহিত)</option>
              <option value="Divorced">Divorced (তালাকপ্রাপ্ত)</option>
              <option value="Widowed">Widowed (বিধবা / বিপত্নীক)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Spouse's Name (English)
            </label>
            <input
              type="text"
              value={p.spouseNameEn}
              onChange={(e) => handleChange('spouseNameEn', e.target.value)}
              placeholder="Spouse Name in English"
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              স্বামী/স্ত্রীর নাম (বাংলায়)
            </label>
            <input
              type="text"
              value={p.spouseNameBn}
              onChange={(e) => handleChange('spouseNameBn', e.target.value)}
              placeholder="স্বামী বা স্ত্রীর নাম"
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
            />
          </div>
        </div>
      </div>

      {/* Identity & Demographics */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="text-xs font-bold text-petro-700 uppercase tracking-wider border-b border-slate-100 pb-2">
          পরিচয়পত্র ও নাগরিকত্ব (Identity &amp; Citizenship)
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Date of Birth (জন্ম তারিখ) <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={p.dob}
              onChange={(e) => handleChange('dob', e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
            />
            <span className="text-[10px] text-slate-400">YYYY-MM-DD ফরম্যাটে সংরক্ষণ হয়</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Gender (লিঙ্গ) <span className="text-red-500">*</span>
            </label>
            <select
              value={p.gender}
              onChange={(e) => handleChange('gender', e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
            >
              <option value="">Select Gender</option>
              <option value="Male">Male (পুরুষ)</option>
              <option value="Female">Female (মহিলা)</option>
              <option value="Other">Other (অন্যান্য)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Religion (ধর্ম) <span className="text-red-500">*</span>
            </label>
            <select
              value={p.religion}
              onChange={(e) => handleChange('religion', e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
            >
              <option value="Islam">Islam (ইসলাম)</option>
              <option value="Hinduism">Hinduism (হিন্দুধর্ম)</option>
              <option value="Christianity">Christianity (খ্রিস্টধর্ম)</option>
              <option value="Buddhism">Buddhism (বৌদ্ধধর্ম)</option>
              <option value="Other">Other (অন্যান্য)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              National ID (এনআইডি নম্বর) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={p.nid}
              onChange={(e) => handleChange('nid', e.target.value)}
              placeholder="10, 13 or 17 digit NID"
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
              <span>Birth Registration No. (জন্ম নিবন্ধন)</span>
              {!p.birthReg.trim() && (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">Missing</span>
              )}
            </label>
            <input
              type="text"
              value={p.birthReg}
              onChange={(e) => handleChange('birthReg', e.target.value)}
              placeholder="17 digit BRN (Leave empty if not available)"
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
              <span>Passport Number (পাসপোর্ট নম্বর)</span>
              {!p.passport.trim() && (
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">Optional</span>
              )}
            </label>
            <input
              type="text"
              value={p.passport}
              onChange={(e) => handleChange('passport', e.target.value)}
              placeholder="Passport No."
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600 uppercase"
            />
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="text-xs font-bold text-petro-700 uppercase tracking-wider border-b border-slate-100 pb-2">
          যোগাযোগ ও কোটা (Contact &amp; Quota)
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mobile Number (মোবাইল নম্বর) <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={p.mobile}
              onChange={(e) => {
                handleChange('mobile', e.target.value);
                if (!p.confirmMobile) handleChange('confirmMobile', e.target.value);
              }}
              placeholder="01XXXXXXXXX"
              maxLength={11}
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600 font-mono font-bold"
            />
            <span className="text-[10px] text-slate-400">টেলিটক নম্বর হলে ফি পেমেন্টে সুবিধা হয়</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Confirm Mobile Number <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={p.confirmMobile}
              onChange={(e) => handleChange('confirmMobile', e.target.value)}
              placeholder="01XXXXXXXXX"
              maxLength={11}
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600 font-mono font-bold"
            />
            {p.mobile && p.confirmMobile && p.mobile !== p.confirmMobile && (
              <span className="text-[10px] text-rose-600 font-semibold">
                ⚠️ Confirm Mobile ({p.confirmMobile}) differs from Mobile ({p.mobile}); autofill will use primary Mobile.
              </span>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email Address (ইমেইল ঠিকানা) <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={p.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="applicant@gmail.com"
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
              <span>
                Quota Category (কোটা) <span className="text-red-500">*</span>
              </span>
              {!p.quota && (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">Not Set</span>
              )}
            </label>
            <select
              value={p.quota}
              onChange={(e) => handleChange('quota', e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
            >
              <option value="">-- নির্বাচন করুন (Not Set / Ask Before Filling) --</option>
              <option value="General">General (Non-Quota / সাধারণ)</option>
              <option value="Freedom Fighter">Freedom Fighter (মুক্তিযোদ্ধা)</option>
              <option value="Child of Freedom Fighter">Child of Freedom Fighter (মুক্তিযোদ্ধার সন্তান)</option>
              <option value="Grandchild of Freedom Fighter">Grandchild of Freedom Fighter (মুক্তিযোদ্ধার নাতি-নাতনি)</option>
              <option value="District">District Quota (জেলা কোটা)</option>
              <option value="Women">Women Quota (মহিলা কোটা)</option>
              <option value="Tribal">Tribal / Ethnic Minority (ক্ষুদ্র নৃ-গোষ্ঠী)</option>
              <option value="Disabled">Disability Quota (শারীরিক প্রতিবন্ধী)</option>
              <option value="Ansar VDP">Ansar VDP (আনসার ও ভিডিপি)</option>
              <option value="Orphan">Orphan (এতিম)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Departmental Status (বিভাগীয় প্রার্থী)
            </label>
            <select
              value={p.departmentalStatus}
              onChange={(e) => handleChange('departmentalStatus', e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
            >
              <option value="No">No (না)</option>
              <option value="Yes">Yes (বিভাগীয় প্রার্থী)</option>
              <option value="Government Employee">Government Employee (সরকারি কর্মচারী)</option>
              <option value="Semi-Government Employee">Semi-Government Employee</option>
              <option value="Autonomous Body">Autonomous Body (স্বায়ত্বশাসিত প্রতিষ্ঠান)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Employment Status (বর্তমান কাজের ধরন)
            </label>
            <select
              value={p.employmentStatus}
              onChange={(e) => handleChange('employmentStatus', e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
            >
              <option value="Unemployed">Unemployed (বেকার)</option>
              <option value="Private">Private Company Employee</option>
              <option value="Government">Government Service</option>
              <option value="Autonomous">Autonomous / State-Owned</option>
              <option value="Self-Employed">Self-Employed (স্বনির্ভর)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
