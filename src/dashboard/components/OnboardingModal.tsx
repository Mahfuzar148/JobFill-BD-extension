// JobFill BD - First-Time User Onboarding Wizard
// Implements Part 7 of UI/UX Master Specification:
// Friendly, step-by-step introduction to setup language, profile, and security.

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { CheckCircle, Shield, Globe, User, BookOpen, ArrowRight, ArrowLeft, Sparkles, X } from 'lucide-react';

export const OnboardingModal: React.FC = () => {
  const { showOnboarding, setShowOnboarding, language, setLanguage, activeProfile, saveCurrentProfile, showToast } = useApp();
  const [step, setStep] = useState(1);
  const totalSteps = 4;

  const [applicantNameEn, setApplicantNameEn] = useState(activeProfile.personal.applicantNameEn || '');
  const [applicantNameBn, setApplicantNameBn] = useState(activeProfile.personal.applicantNameBn || '');
  const [mobileNumber, setMobileNumber] = useState(activeProfile.personal.mobile || '');

  if (!showOnboarding) return null;

  const handleFinish = async () => {
    const updated = {
      ...activeProfile,
      personal: {
        ...activeProfile.personal,
        applicantNameEn: applicantNameEn || activeProfile.personal.applicantNameEn,
        applicantNameBn: applicantNameBn || activeProfile.personal.applicantNameBn,
        mobile: mobileNumber || activeProfile.personal.mobile,
      },
    };
    await saveCurrentProfile(updated);
    localStorage.setItem('jobfill_onboarded', 'true');
    setShowOnboarding(false);
    showToast(language === 'bn' ? '🎉 সেটআপ সম্পন্ন হয়েছে! JobFill BD-তে স্বাগতম।' : '🎉 Setup complete! Welcome to JobFill BD.');
  };

  const handleSkip = () => {
    localStorage.setItem('jobfill_onboarded', 'true');
    setShowOnboarding(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden transition-all">
        {/* Header bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 font-bold text-sm">
              JB
            </span>
            <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
              JobFill BD Setup Wizard
            </span>
          </div>
          <button
            onClick={handleSkip}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md"
            title="Skip Onboarding"
          >
            <X size={18} />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5">
          <div
            className="bg-emerald-600 h-1.5 transition-all duration-300"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>

        {/* Step Body */}
        <div className="p-6">
          {step === 1 && (
            <div className="text-center py-4 space-y-4">
              <div className="inline-flex p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 mb-2">
                <Sparkles size={36} />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {language === 'bn' ? 'JobFill BD-তে স্বাগতম!' : 'Welcome to JobFill BD!'}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 max-w-sm mx-auto leading-relaxed">
                {language === 'bn'
                  ? 'স্মার্ট সরকারি চাকরি আবেদন সহকারী। একবার তথ্য সেভ করুন, আর PetroBangla, Teletalk বা BPSC ফর্মে স্বয়ংক্রিয়ভাবে পূরণ করুন।'
                  : 'Smart Bangladesh Government Job Application Assistant. Save your profile once, and autofill across PetroBangla, Teletalk & BPSC forms.'}
              </p>
              <div className="pt-4 flex justify-center gap-4">
                <button
                  type="button"
                  onClick={() => setLanguage('bn')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
                    language === 'bn'
                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-600'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  🇧🇩 বাংলা (Bangla)
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
                    language === 'en'
                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-600'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  🇬🇧 English
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <User className="text-emerald-600" size={20} />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  {language === 'bn' ? 'মৌলিক তথ্য (Basic Info)' : 'Basic Applicant Info'}
                </h3>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Applicant Full Name (English) *
                </label>
                <input
                  type="text"
                  value={applicantNameEn}
                  onChange={(e) => setApplicantNameEn(e.target.value)}
                  placeholder="e.g. MD. HASAN MAHMUD"
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  আবেদনকারীর নাম (বাংলায়)
                </label>
                <input
                  type="text"
                  value={applicantNameBn}
                  onChange={(e) => setApplicantNameBn(e.target.value)}
                  placeholder="যেমন: মোঃ হাসান মাহমুদ"
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mobile Number (মোবাইল নম্বর) *
                </label>
                <input
                  type="tel"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  placeholder="017XXXXXXXX"
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="text-emerald-600" size={20} />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  {language === 'bn' ? 'গোপনীয়তা ও নিরাপত্তা (Privacy Guarantee)' : 'Privacy & Security Guarantee'}
                </h3>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 space-y-2.5 leading-relaxed">
                <div className="flex items-start gap-2">
                  <CheckCircle size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Local-First Profile Vault:</strong> আপনার ব্যক্তিগত প্রোফাইল, শিক্ষাগত তথ্য ও ডকুমেন্ট কেবল আপনার নিজস্ব ব্রাউজারে AES-256-GCM এনক্রিপশনে সংরক্ষিত থাকে। পাবলিক জব সার্কুলার আপডেট পেতে ইন্টারনেট সংযোগ প্রয়োজন (শুধু পঠনযোগ্য GET রিকোয়েস্ট, কোনো ব্যক্তিগত তথ্য ছাড়া)।</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>No Auto-Submit:</strong> এক্সটেনশন কোনো ফর্মে নিজে থেকে সাবমিট করবে না, নিয়ন্ত্রণ সর্বদা আপনার হাতে থাকবে।</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Local Encryption:</strong> চাইলে সেটিংস পেজে মাস্টার পাসওয়ার্ড দিয়ে ভল্ট লক করতে পারবেন (AES-256-GCM)।</span>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="text-center py-4 space-y-4">
              <div className="inline-flex p-3 rounded-full bg-emerald-100 text-emerald-700 mb-1">
                <CheckCircle size={36} />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {language === 'bn' ? 'আপনি প্রস্তুত!' : "You're All Set!"}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 max-w-sm mx-auto leading-relaxed">
                {language === 'bn'
                  ? 'ড্যাশবোর্ডে গিয়ে আপনার শিক্ষাগত যোগ্যতা ও ঠিকানার তথ্য পূর্ণ করুন। এরপর যেকোনো চাকরির ফর্ম ওপেন করলেই জবফিল অ্যাসিস্ট্যান্ট হাজির হবে!'
                  : 'Open the dashboard to fill your education and address details. JobFill BD assistant will automatically appear on recruitment portals!'}
              </p>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition"
            >
              <ArrowLeft size={14} /> Back
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSkip}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-medium"
            >
              Skip Setup
            </button>
          )}

          {step < totalSteps ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition"
            >
              Next <ArrowRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition"
            >
              Get Started <Sparkles size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
