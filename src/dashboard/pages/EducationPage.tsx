import React from 'react';
import { UserProfile, SecondaryEducation, HigherEducation } from '../../types/profile';

interface EducationPageProps {
  profile: UserProfile;
  onChangeSSC: (updated: Partial<SecondaryEducation>) => void;
  onChangeHSC: (updated: Partial<SecondaryEducation>) => void;
  onChangeGrad: (updated: Partial<HigherEducation>) => void;
  onChangeMasters: (updated: Partial<HigherEducation>) => void;
  onToggleGraduation: (has: boolean) => void;
  onToggleMasters: (has: boolean) => void;
}

export const EducationPage: React.FC<EducationPageProps> = ({
  profile,
  onChangeSSC,
  onChangeHSC,
  onChangeGrad,
  onChangeMasters,
  onToggleGraduation,
  onToggleMasters,
}) => {
  const ssc = profile.ssc;
  const hsc = profile.hsc;
  const grad = profile.graduation;
  const mas = profile.masters;

  const BOARDS = [
    'Dhaka',
    'Chittagong',
    'Rajshahi',
    'Khulna',
    'Barisal',
    'Sylhet',
    'Comilla',
    'Jessore',
    'Dinajpur',
    'Mymensingh',
    'Madrasah',
    'Technical',
    'BTEB',
  ];

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <span>🎓</span>
          <span>Educational Qualifications (শিক্ষাগত যোগ্যতা)</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          এসএসসি থেকে মাস্টার্স পর্যন্ত প্রতিটি শিক্ষাগত যোগ্যতার তথ্য নির্ভুলভাবে দিন।
        </p>
      </div>

      {/* SSC / EQUIVALENT CARD */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-petro-100 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-base">📚</span>
            <h3 className="text-sm font-bold text-petro-800">
              SSC / Equivalent Level (মাধ্যমিক বা সমমান)
            </h3>
          </div>
          <span className="text-[11px] font-bold text-petro-700 bg-petro-50 border border-petro-200 px-2 py-0.5 rounded">
            Mandatory
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Examination <span className="text-red-500">*</span>
            </label>
            <select
              value={ssc.examination}
              onChange={(e) => onChangeSSC({ examination: e.target.value })}
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
            >
              <option value="SSC">SSC (এসএসসি)</option>
              <option value="Dakhil">Dakhil (দাখিল)</option>
              <option value="O Level">O Level</option>
              <option value="Vocational">Vocational</option>
              <option value="Equivalent">Equivalent (সমমান)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Board (শিক্ষা বোর্ড) <span className="text-red-500">*</span>
            </label>
            <select
              value={ssc.board}
              onChange={(e) => onChangeSSC({ board: e.target.value })}
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
            >
              {BOARDS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Group / Subject (শাখা) <span className="text-red-500">*</span>
            </label>
            <select
              value={ssc.groupSubject}
              onChange={(e) => onChangeSSC({ groupSubject: e.target.value })}
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
            >
              <option value="Science">Science (বিজ্ঞান)</option>
              <option value="Humanities">Humanities (মানবিক)</option>
              <option value="Commerce">Commerce / Business Studies (ব্যবসায় শিক্ষা)</option>
              <option value="General">General (সাধারণ)</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Roll No. (রোল নম্বর) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={ssc.rollNumber}
              onChange={(e) => onChangeSSC({ rollNumber: e.target.value })}
              placeholder="e.g. 142857"
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Registration No. (রেজিস্ট্রেশন নম্বর)
            </label>
            <input
              type="text"
              value={ssc.registrationNumber}
              onChange={(e) => onChangeSSC({ registrationNumber: e.target.value })}
              placeholder="e.g. 1115243890"
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Passing Year (পাসের বছর) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={ssc.passingYear}
              onChange={(e) => onChangeSSC({ passingYear: e.target.value })}
              placeholder="2014"
              maxLength={4}
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Result Type <span className="text-red-500">*</span>
            </label>
            <select
              value={ssc.resultType}
              onChange={(e) => onChangeSSC({ resultType: e.target.value as any })}
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
            >
              <option value="GPA (out of 5)">GPA (out of 5)</option>
              <option value="First Division">First Division</option>
              <option value="Second Division">Second Division</option>
              <option value="Third Division">Third Division</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              GPA / Result <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={ssc.gpa}
              onChange={(e) => onChangeSSC({ gpa: e.target.value })}
              placeholder="5.00"
              maxLength={4}
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              School / Institution Name
            </label>
            <input
              type="text"
              value={ssc.institution}
              onChange={(e) => onChangeSSC({ institution: e.target.value })}
              placeholder="School Name"
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
            />
          </div>
        </div>
      </div>

      {/* HSC / EQUIVALENT / DIPLOMA CARD */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-petro-100 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-base">📗</span>
            <h3 className="text-sm font-bold text-petro-800">
              HSC / Equivalent Level / Diploma-in-Engineering
            </h3>
          </div>
          <span className="text-[11px] font-bold text-petro-700 bg-petro-50 border border-petro-200 px-2 py-0.5 rounded">
            Mandatory
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Examination <span className="text-red-500">*</span>
            </label>
            <select
              value={hsc.examination}
              onChange={(e) => onChangeHSC({ examination: e.target.value })}
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
            >
              <option value="HSC">HSC (এইচএসসি)</option>
              <option value="Alim">Alim (আলিম)</option>
              <option value="A Level">A Level</option>
              <option value="Diploma in Engineering">Diploma-in-Engineering (ডিপ্লোমা ইন ইঞ্জিনিয়ারিং)</option>
              <option value="Equivalent">Equivalent (সমমান)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Board (শিক্ষা বোর্ড) <span className="text-red-500">*</span>
            </label>
            <select
              value={hsc.board}
              onChange={(e) => onChangeHSC({ board: e.target.value })}
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
            >
              {BOARDS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Group / Subject (শাখা / টেকনোলজি) <span className="text-red-500">*</span>
            </label>
            <select
              value={hsc.groupSubject}
              onChange={(e) => onChangeHSC({ groupSubject: e.target.value })}
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
            >
              <option value="Science">Science (বিজ্ঞান)</option>
              <option value="Humanities">Humanities (মানবিক)</option>
              <option value="Commerce">Commerce / Business Studies</option>
              <option value="Engineering / Technology">Engineering / Technology</option>
              <option value="General">General</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Roll No. (রোল নম্বর) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={hsc.rollNumber}
              onChange={(e) => onChangeHSC({ rollNumber: e.target.value })}
              placeholder="e.g. 321654"
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Registration No. (রেজিস্ট্রেশন নম্বর)
            </label>
            <input
              type="text"
              value={hsc.registrationNumber}
              onChange={(e) => onChangeHSC({ registrationNumber: e.target.value })}
              placeholder="e.g. 1115243890"
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Passing Year (পাসের বছর) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={hsc.passingYear}
              onChange={(e) => onChangeHSC({ passingYear: e.target.value })}
              placeholder="2016"
              maxLength={4}
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Result Type <span className="text-red-500">*</span>
            </label>
            <select
              value={hsc.resultType}
              onChange={(e) => onChangeHSC({ resultType: e.target.value as any })}
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
            >
              <option value="GPA (out of 5)">GPA (out of 5)</option>
              <option value="First Division">First Division</option>
              <option value="Second Division">Second Division</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              GPA / Result <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={hsc.gpa}
              onChange={(e) => onChangeHSC({ gpa: e.target.value })}
              placeholder="5.00"
              maxLength={4}
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              College / Institution Name
            </label>
            <input
              type="text"
              value={hsc.institution}
              onChange={(e) => onChangeHSC({ institution: e.target.value })}
              placeholder="College Name"
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
            />
          </div>
        </div>
      </div>

      {/* GRADUATION / EQUIVALENT CARD */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-petro-100 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-base">🎓</span>
            <h3 className="text-sm font-bold text-petro-800">
              Graduation / Equivalent Level (স্নাতক বা সমমান)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="chk_grad_applicable"
              checked={profile.hasGraduation}
              onChange={(e) => onToggleGraduation(e.target.checked)}
              className="w-4 h-4 text-petro-600 rounded cursor-pointer accent-petro-600"
            />
            <label htmlFor="chk_grad_applicable" className="text-xs font-bold text-slate-700 cursor-pointer">
              If Applicable (প্রযোজ্য ক্ষেত্রে)
            </label>
          </div>
        </div>

        {profile.hasGraduation && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Examination / Degree <span className="text-red-500">*</span>
              </label>
              <select
                value={grad.examination}
                onChange={(e) => onChangeGrad({ examination: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
              >
                <option value="B.Sc Engineering">B.Sc Engineering (বিএসসি ইঞ্জিনিয়ারিং)</option>
                <option value="B.Sc (Hons)">B.Sc (Hons)</option>
                <option value="B.A (Hons)">B.A (Hons)</option>
                <option value="B.B.A (Hons)">B.B.A (Hons)</option>
                <option value="B.S.S (Hons)">B.S.S (Hons)</option>
                <option value="Honours">Honours (অনার্স)</option>
                <option value="Degree Pass">Degree Pass (ডিগ্রি পাস)</option>
                <option value="MBBS">MBBS</option>
                <option value="Equivalent">Equivalent (সমমান)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Subject / Degree (বিষয় / বিভাগ) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={grad.subjectDegree}
                onChange={(e) => onChangeGrad({ subjectDegree: e.target.value })}
                placeholder="e.g. Computer Science and Engineering"
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                University / Institute <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={grad.universityInstitute}
                onChange={(e) => onChangeGrad({ universityInstitute: e.target.value })}
                placeholder="e.g. University of Dhaka"
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Result Type <span className="text-red-500">*</span>
              </label>
              <select
                value={grad.resultType}
                onChange={(e) => onChangeGrad({ resultType: e.target.value as any })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
              >
                <option value="CGPA (out of 4)">CGPA (out of 4.00)</option>
                <option value="First Class">First Class (১ম শ্রেণি)</option>
                <option value="Second Class">Second Class (২য় শ্রেণি)</option>
                <option value="Appeared">Appeared (ফলাফল প্রত্যাশী)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                CGPA / Result
              </label>
              <input
                type="text"
                value={grad.gpa}
                onChange={(e) => onChangeGrad({ gpa: e.target.value })}
                placeholder="3.82"
                maxLength={4}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Passing Year <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={grad.passingYear}
                onChange={(e) => onChangeGrad({ passingYear: e.target.value })}
                placeholder="2021"
                maxLength={4}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Course Duration (কোর্সের মেয়াদ)
              </label>
              <select
                value={grad.courseDuration}
                onChange={(e) => onChangeGrad({ courseDuration: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
              >
                <option value="4 Years">4 Years (৪ বছর)</option>
                <option value="3 Years">3 Years (৩ বছর)</option>
                <option value="5 Years">5 Years (৫ বছর)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Roll Number
              </label>
              <input
                type="text"
                value={grad.rollNumber}
                onChange={(e) => onChangeGrad({ rollNumber: e.target.value })}
                placeholder="Graduation Roll No"
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Registration No / Session
              </label>
              <input
                type="text"
                value={grad.registrationNumber}
                onChange={(e) => onChangeGrad({ registrationNumber: e.target.value })}
                placeholder="Reg No or Session"
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600 font-mono"
              />
            </div>
          </div>
        )}
      </div>

      {/* MASTERS / EQUIVALENT CARD */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-petro-100 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-base">📜</span>
            <h3 className="text-sm font-bold text-petro-800">
              Masters / Equivalent Level (স্নাতকোত্তর বা সমমান)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="chk_mas_applicable"
              checked={profile.hasMasters}
              onChange={(e) => onToggleMasters(e.target.checked)}
              className="w-4 h-4 text-petro-600 rounded cursor-pointer accent-petro-600"
            />
            <label htmlFor="chk_mas_applicable" className="text-xs font-bold text-slate-700 cursor-pointer">
              If Applicable (প্রযোজ্য ক্ষেত্রে)
            </label>
          </div>
        </div>

        {profile.hasMasters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Examination / Degree
              </label>
              <select
                value={mas.examination}
                onChange={(e) => onChangeMasters({ examination: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
              >
                <option value="M.Sc">M.Sc (এমএসসি)</option>
                <option value="M.Sc Engineering">M.Sc Engineering</option>
                <option value="M.A">M.A (এমএ)</option>
                <option value="M.B.A">M.B.A (এমবিএ)</option>
                <option value="M.S.S">M.S.S (এমএসএস)</option>
                <option value="Masters">Masters</option>
                <option value="Equivalent">Equivalent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Subject / Degree
              </label>
              <input
                type="text"
                value={mas.subjectDegree}
                onChange={(e) => onChangeMasters({ subjectDegree: e.target.value })}
                placeholder="e.g. Computer Science"
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                University / Institute
              </label>
              <input
                type="text"
                value={mas.universityInstitute}
                onChange={(e) => onChangeMasters({ universityInstitute: e.target.value })}
                placeholder="University Name"
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Result Type
              </label>
              <select
                value={mas.resultType}
                onChange={(e) => onChangeMasters({ resultType: e.target.value as any })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:border-petro-600 focus:ring-1 focus:ring-petro-600"
              >
                <option value="CGPA (out of 4)">CGPA (out of 4.00)</option>
                <option value="First Class">First Class</option>
                <option value="Second Class">Second Class</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                CGPA / Result
              </label>
              <input
                type="text"
                value={mas.gpa}
                onChange={(e) => onChangeMasters({ gpa: e.target.value })}
                placeholder="3.80"
                maxLength={4}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Passing Year
              </label>
              <input
                type="text"
                value={mas.passingYear}
                onChange={(e) => onChangeMasters({ passingYear: e.target.value })}
                placeholder="2023"
                maxLength={4}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-petro-600 focus:ring-1 focus:ring-petro-600 font-mono"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
