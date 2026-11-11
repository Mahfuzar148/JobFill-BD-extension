import React from 'react';
import { UserProfile, SpecialInfo, ReferencePerson } from '../../types/profile';

interface PreferencesPageProps {
  profile: UserProfile;
  onChangeSpecial: (updated: Partial<SpecialInfo>) => void;
  onChangeReferences: (refs: ReferencePerson[]) => void;
}

export const PreferencesPage: React.FC<PreferencesPageProps> = ({
  profile,
  onChangeSpecial,
  onChangeReferences,
}) => {
  const s = profile.special;
  const refs = profile.references || [];

  const handleRefChange = (index: number, field: keyof ReferencePerson, value: string) => {
    const newRefs = [...refs];
    newRefs[index] = { ...newRefs[index], [field]: value };
    onChangeReferences(newRefs);
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <span>🎯</span>
          <span>Preferences &amp; Special Info (পছন্দক্রম ও বিশেষ তথ্য)</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          বিসিএস ও পেট্রোবাংলার বিশেষ ফিল্ড (উচ্চতা, ওজন, ক্যাডার পছন্দক্রম ও রেফারেন্সসমূহ)।
        </p>
      </div>

      {/* Physical Measurements & Center */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="text-xs font-bold text-petro-700 uppercase tracking-wider border-b border-slate-100 pb-2">
          শারীরিক তথ্য ও পরীক্ষার কেন্দ্র (Physical Details &amp; Centre)
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Height (উচ্চতা — সেমি)
            </label>
            <input
              type="text"
              value={s.heightCm}
              onChange={(e) => onChangeSpecial({ heightCm: e.target.value })}
              placeholder="e.g. 172.5"
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Weight (ওজন — কেজি)
            </label>
            <input
              type="text"
              value={s.weightKg}
              onChange={(e) => onChangeSpecial({ weightKg: e.target.value })}
              placeholder="e.g. 68"
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Chest (বুকের মাপ — সেমি)
            </label>
            <input
              type="text"
              value={s.chestCm}
              onChange={(e) => onChangeSpecial({ chestCm: e.target.value })}
              placeholder="e.g. 84"
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Blood Group (রক্তের গ্রুপ)
            </label>
            <select
              value={s.bloodGroup}
              onChange={(e) => onChangeSpecial({ bloodGroup: e.target.value })}
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
            >
              <option value="">Select Blood Group</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Exam Centre (পরীক্ষা কেন্দ্র)
            </label>
            <select
              value={s.examCentre}
              onChange={(e) => onChangeSpecial({ examCentre: e.target.value })}
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
            >
              <option value="Dhaka">Dhaka (ঢাকা)</option>
              <option value="Chittagong">Chittagong (চট্টগ্রাম)</option>
              <option value="Rajshahi">Rajshahi (রাজশাহী)</option>
              <option value="Khulna">Khulna (খুলনা)</option>
              <option value="Barisal">Barisal (বরিশাল)</option>
              <option value="Sylhet">Sylhet (সিলেট)</option>
              <option value="Rangpur">Rangpur (রংপুর)</option>
              <option value="Mymensingh">Mymensingh (ময়মনসিংহ)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Question Version (প্রশ্নপত্র ভার্সন)
            </label>
            <select
              value={s.questionVersion}
              onChange={(e) => onChangeSpecial({ questionVersion: e.target.value as any })}
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
            >
              <option value="Bangla">Bangla (বাংলা ভার্সন)</option>
              <option value="English">English (ইংরেজি ভার্সন)</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Post Related Subject Code (বিষয় কোড)
            </label>
            <input
              type="text"
              value={s.postRelatedSubjectCode}
              onChange={(e) => onChangeSpecial({ postRelatedSubjectCode: e.target.value })}
              placeholder="e.g. CSE-301 / 401"
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
            />
          </div>
        </div>
      </div>

      {/* PetroBangla Organization Choice */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="text-xs font-bold text-petro-700 uppercase tracking-wider border-b border-slate-100 pb-2">
          পেট্রোবাংলা প্রতিষ্ঠান পছন্দক্রম (PetroBangla Organization Choice)
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Organization Preference (1st Choice)
            </label>
            <input
              type="text"
              value={s.orgChoice1}
              onChange={(e) => onChangeSpecial({ orgChoice1: e.target.value })}
              placeholder="e.g. Petrobangla HQ / Titas Gas T&D Co."
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Organization Preference (2nd Choice)
            </label>
            <input
              type="text"
              value={s.orgChoice2}
              onChange={(e) => onChangeSpecial({ orgChoice2: e.target.value })}
              placeholder="e.g. BGFCL / RPGCL"
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
            />
          </div>
        </div>
      </div>

      {/* References Section */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="text-xs font-bold text-petro-700 uppercase tracking-wider border-b border-slate-100 pb-2">
          রেফারেন্সকারী ব্যক্তিবর্গের তথ্য (Two References)
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {refs.slice(0, 2).map((ref, idx) => (
            <div key={ref.id || idx} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="text-xs font-bold text-slate-800 border-b border-slate-200 pb-1">
                Reference #{idx + 1}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Referee Full Name</label>
                <input
                  type="text"
                  value={ref.name}
                  onChange={(e) => handleRefChange(idx, 'name', e.target.value)}
                  placeholder="Prof. / Engr. Full Name"
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:border-petro-600 focus:ring-1 focus:ring-petro-600 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Designation &amp; Organization</label>
                <input
                  type="text"
                  value={ref.designation}
                  onChange={(e) => handleRefChange(idx, 'designation', e.target.value)}
                  placeholder="Designation, Organization Name"
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:border-petro-600 focus:ring-1 focus:ring-petro-600 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Mobile No</label>
                  <input
                    type="tel"
                    value={ref.mobile}
                    onChange={(e) => handleRefChange(idx, 'mobile', e.target.value)}
                    placeholder="01XXXXXXXXX"
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:border-petro-600 focus:ring-1 focus:ring-petro-600 bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={ref.email}
                    onChange={(e) => handleRefChange(idx, 'email', e.target.value)}
                    placeholder="email@univ.bd"
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:border-petro-600 focus:ring-1 focus:ring-petro-600 bg-white"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
