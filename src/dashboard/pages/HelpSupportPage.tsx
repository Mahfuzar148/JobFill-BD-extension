import React, { useState } from 'react';
import {
  HelpCircle,
  BookOpen,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Sparkles,
  FileCheck2,
  AlertCircle,
  Building,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { isCloudSyncFeatureEnabled } from '../../cloud/supabase-config';

interface HelpSupportPageProps {
  showToast: (msg: string) => void;
}

export const HelpSupportPage: React.FC<HelpSupportPageProps> = ({ showToast }) => {
  const { language, setShowOnboarding } = useApp();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const cloudSyncSupported = isCloudSyncFeatureEnabled();

  const faqs = [
    {
      qEn: 'Is my personal data sent to any online server or cloud?',
      qBn: 'আমার ব্যক্তিগত তথ্য কি কোনো সার্ভার বা ইন্টারনেটে পাঠানো হয়?',
      aEn: cloudSyncSupported
        ? 'No by default. JobFill BD is local-first: personal profiles, education/employment records, photos, and documents stay inside local browser IndexedDB encrypted with AES-256-GCM. Public job circular retrieval requires Internet access via unauthenticated read-only GET requests with zero personal data. Optional Cloud Sync is off by default.'
        : 'No. In this first public release (v2.0.0), Cloud Sync and online accounts are disabled: all personal profiles, education/employment records, photos, documents, bookmarks, and autofill history stay strictly inside your local browser encrypted with AES-256-GCM. Note that public job circular retrieval requires Internet access via unauthenticated read-only GET requests without sending any personal data.',
      aBn: cloudSyncSupported
        ? 'ডিফল্টভাবে পাঠানো হয় না। JobFill BD লোকাল-ফার্স্ট: আপনার ব্যক্তিগত তথ্য, ছবি ও সনদ লোকাল IndexedDB-তে AES-256-GCM এনক্রিপশনে থাকে। পাবলিক জব সার্কুলার আনতে ইন্টারনেট সংযোগ প্রয়োজন (শুধু পঠনযোগ্য GET, কোনো ব্যক্তিগত তথ্য ছাড়া)। ঐচ্ছিক ক্লাউড সিঙ্ক ডিফল্টভাবে বন্ধ থাকে।'
        : 'না। এই প্রথম পাবলিক রিলিজে (v2.0.0) ক্লাউড সিঙ্ক ও অনলাইন অ্যাকাউন্ট সম্পূর্ণ নিষ্ক্রিয় রাখা হয়েছে; আপনার সকল প্রোফাইল, ছবি, স্বাক্ষর, সনদ ও আবেদন তথ্য কেবল আপনার নিজস্ব ব্রাউজারে AES-256-GCM এনক্রিপশনে সুরক্ষিত থাকে। তবে পাবলিক জব সার্কুলার আপডেট পেতে ইন্টারনেট সংযোগ প্রয়োজন (কোনো ব্যক্তিগত তথ্য ছাড়া শুধু পঠনযোগ্য GET রিকোয়েস্ট)।',
    },
    {
      qEn: 'Why does JobFill BD not auto-click "Final Submit" or "Pay Now"?',
      qBn: 'JobFill BD কেন "Final Submit" বা "Pay Now" বাটনে নিজে থেকে ক্লিক করে না?',
      aEn: 'By strict safety design philosophy, JobFill BD never automates final submission or payment. Government job application forms are high-stakes; you must personally inspect every filled field, enter the anti-bot CAPTCHA, and click Submit yourself.',
      aBn: 'কঠোর নিরাপত্তা নীতির কারণে JobFill BD কখনোই ফাইনাল সাবমিট বা পেমেন্ট বাটনে স্বয়ংক্রিয় ক্লিক করে না। সরকারি চাকরির আবেদন অত্যন্ত গুরুত্বপূর্ণ; তাই তথ্যগুলো আপনি নিজে শেষবার যাচাই করবেন, ক্যাপচা কোড দেবেন এবং নিজ দায়িত্বে সাবমিট করবেন।',
    },
    {
      qEn: 'How does the extension handle dependent dropdowns like District & Upazila?',
      qBn: 'জেলা ও উপজেলার মতো নির্ভরশীল ড্রপডাউনগুলো কীভাবে কাজ করে?',
      aEn: 'JobFill BD uses Dynamic Form Intelligence (Layer 4) with MutationObserver. It selects the Division first, waits for the website server to load dependent Districts, selects District, and then cascades down to Upazila automatically.',
      aBn: 'JobFill BD-এর ডায়নামিক ফর্ম ইন্টেলিজেন্স (Layer 4) মিউটেশন অবজার্ভার ব্যবহার করে। এটি প্রথমে বিভাগ নির্বাচন করে, ওয়েবসাইট যখন সার্ভার থেকে জেলা লোড করে তখন জেলা নির্বাচন করে এবং সবশেষে স্বয়ংক্রিয়ভাবে উপজেলা সিলেক্ট করে।',
    },
    {
      qEn: 'Can I use this extension for multiple job applicants?',
      qBn: 'আমি কি একাধিক চাকরিপ্রার্থীর জন্য এই এক্সটেনশন ব্যবহার করতে পারব?',
      aEn: 'Yes! You can create multiple applicant profiles (e.g. for siblings, friends, or different career tracks) from the top profile dropdown and switch between them anytime before filling.',
      aBn: 'হ্যাঁ! আপনি ওপরের প্রোফাইল ড্রপডাউন থেকে একাধিক প্রার্থীর প্রোফাইল তৈরি করতে পারেন এবং আবেদন করার সময় এক ক্লিকেই প্রয়োজনীয় প্রার্থীর প্রোফাইল নির্বাচন করে ফর্ম পূরণ করতে পারবেন।',
    },
    {
      qEn: 'What are the required photo and signature sizes for Bangladesh government forms?',
      qBn: 'বাংলাদেশ সরকারি চাকরির ফর্মে ছবি ও স্বাক্ষরের সঠিক মাপ কী?',
      aEn: 'Standard government requirement: Applicant Photo must be exactly 300 × 300 pixels (max 100 KB), and Signature must be exactly 300 × 80 pixels (max 60 KB) in JPG/JPEG or PNG format.',
      aBn: 'সরকারি নিয়মানুযায়ী: আবেদনকারীর ছবি হতে হবে ঠিক ৩০০ × ৩০০ পিক্সেল (সর্বোচ্চ ১০০ কেবি) এবং স্বাক্ষর হতে হবে ঠিক ৩০০ × ৮০ পিক্সেল (সর্বোচ্চ ৬০ কেবি) JPG/JPEG বা PNG ফরম্যাটে।',
    },
  ];

  const portalGuides = [
    {
      titleEn: 'PetroBangla & Subordinate Gas/Oil Companies',
      titleBn: 'পেট্রোবাংলা ও অধীনস্থ গ্যাস/তেল কোম্পানি',
      descEn: 'Petrobangla HQ, BGFCL, RPGCL, Titas Gas, SGFL, BAPEX, etc.',
      descBn: 'পেট্রোবাংলা সদর দপ্তর, তিতাস গ্যাস, বাখরাবাদ গ্যাস, আরপিজিসিএল ইত্যাদি।',
      tips: [
        'PetroBangla requires selecting 1st and 2nd Organization Choice.',
        'Supports SSC, HSC, Graduation, Masters, and 300-character Job Experience briefs.',
        'Includes 2 professional references (Referee Name, Designation, Mobile, Email).',
      ],
    },
    {
      titleEn: 'Teletalk Alljobs Recruitment Portals',
      titleBn: 'টেলিটক অলজবস রিক্রুটমেন্ট পোর্টালসমূহ',
      descEn: 'alljobs.teletalk.com.bd and ministry-specific subdomains.',
      descBn: 'টেলিটকের সকল সরকারি মন্ত্রণালয়, অধিদপ্তর ও স্বায়ত্তশাসিত প্রতিষ্ঠানের আবেদন ফর্ম।',
      tips: [
        'Auto-detects Premium Member Alljobs ID if available.',
        'Handles conditional sections (revealing Graduation/Masters on Yes selection).',
        'Populates Quota, Marital Status, and Home District automatically.',
      ],
    },
    {
      titleEn: 'BPSC (Bangladesh Public Service Commission)',
      titleBn: 'বিপিএসসি (বাংলাদেশ সরকারি কর্ম কমিশন)',
      descEn: 'bpsc.teletalk.com.bd & BCS / Non-Cadre applications.',
      descBn: 'বিসিএস ও নন-ক্যাডার চাকরির বহুমুখী আবেদন ফর্ম।',
      tips: [
        'Cadre choice preferences and post-related subject codes.',
        'Physical measurement fields: Height (cm), Weight (kg), Chest (cm).',
        'Exam centre selection across 8 divisions.',
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-petro-600" />
            <span>{language === 'bn' ? 'সাহায্য ও ব্যবহার সহায়িকা (Help & Support)' : 'Help & User Guide'}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'bn'
              ? 'JobFill BD ব্যবহারের নিয়মাবলী, পোর্টাল নির্দেশিকা এবং সাধারণ প্রশ্নোত্তর।'
              : 'User guides, recruitment portal guidelines, and frequently asked questions.'}
          </p>
        </div>

        <button
          onClick={() => {
            setShowOnboarding(true);
            showToast(language === 'bn' ? '🚀 অনবোর্ডিং গাইড চালু করা হয়েছে!' : '🚀 Onboarding tour launched!');
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-petro-700 bg-petro-50 hover:bg-petro-100 border border-petro-200 rounded-lg transition-colors self-start sm:self-auto"
        >
          <Sparkles className="w-3.5 h-3.5 text-petro-600" />
          {language === 'bn' ? 'অনবোর্ডিং ট্যুর পুনরায় দেখুন' : 'Replay Onboarding Tour'}
        </button>
      </div>

      {/* 3-Step Quick Start */}
      <div className="bg-gradient-to-r from-petro-800 to-navy-900 rounded-2xl p-6 text-white shadow-md">
        <h3 className="text-sm font-bold uppercase tracking-wider text-petro-300 mb-4 flex items-center gap-2">
          <BookOpen className="w-4 h-4" />
          <span>{language === 'bn' ? 'মাত্র ৩ ধাপে সহজে আবেদন করুন' : '3-Step Easy Workflow'}</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/10 backdrop-blur-xs p-4 rounded-xl border border-white/10">
            <div className="w-7 h-7 rounded-lg bg-petro-500 text-white font-black flex items-center justify-center text-xs mb-2">
              1
            </div>
            <h4 className="font-bold text-sm text-white mb-1">
              {language === 'bn' ? 'একবার প্রোফাইল সাজান' : 'Setup Profile Once'}
            </h4>
            <p className="text-xs text-petro-100 leading-relaxed">
              {language === 'bn'
                ? 'ব্যক্তিগত তথ্য, শিক্ষাগত সনদ, চাকরির অভিজ্ঞতা ও ছবি-স্বাক্ষর একবার নির্ভুলভাবে পূরণ করুন।'
                : 'Fill your personal, educational, experience, and address details once in this dashboard.'}
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-xs p-4 rounded-xl border border-white/10">
            <div className="w-7 h-7 rounded-lg bg-petro-500 text-white font-black flex items-center justify-center text-xs mb-2">
              2
            </div>
            <h4 className="font-bold text-sm text-white mb-1">
              {language === 'bn' ? 'আবেদন পেজে যান' : 'Open Recruitment Form'}
            </h4>
            <p className="text-xs text-petro-100 leading-relaxed">
              {language === 'bn'
                ? 'পেট্রোবাংলা, টেলিটক অলজবস কিংবা যেকোনো সরকারি চাকরির আবেদন ফর্মের লিংকে প্রবেশ করুন।'
                : 'Navigate to any Bangladesh government recruitment portal application webpage.'}
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-xs p-4 rounded-xl border border-white/10">
            <div className="w-7 h-7 rounded-lg bg-petro-500 text-white font-black flex items-center justify-center text-xs mb-2">
              3
            </div>
            <h4 className="font-bold text-sm text-white mb-1">
              {language === 'bn' ? 'উইজেটে ১-ক্লিক করুন' : 'Auto-Fill & Review'}
            </h4>
            <p className="text-xs text-petro-100 leading-relaxed">
              {language === 'bn'
                ? 'পেজের নিচে থাকা JobFill BD বাটনে ক্লিক করে তথ্য প্রিভিউ দেখুন এবং ফর্ম পূরণ সম্পন্ন করুন।'
                : 'Click the floating assistant trigger, review the high-confidence matches, and fill!'}
            </p>
          </div>
        </div>
      </div>

      {/* Recruitment Portal Guides */}
      <div className="space-y-4">
        <div className="text-xs font-bold text-petro-700 uppercase tracking-wider">
          {language === 'bn' ? 'পোর্টাল ভিত্তিক নির্দেশিকা (Recruitment Portals)' : 'Portal-Specific Guides'}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {portalGuides.map((guide, idx) => (
            <div key={idx} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Building className="w-4 h-4 text-petro-600" />
                  <h4 className="font-bold text-xs text-slate-800">
                    {language === 'bn' ? guide.titleBn : guide.titleEn}
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500 mb-3">
                  {language === 'bn' ? guide.descBn : guide.descEn}
                </p>

                <ul className="space-y-1.5 text-[11px] text-slate-600">
                  {guide.tips.map((t, tIdx) => (
                    <li key={tIdx} className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-petro-600 shrink-0 mt-0.5" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Offline Test Launchers */}
      {/* Offline Test Form Sandbox (hidden in clean Store release builds) */}
      {!(typeof __JOBFILL_STORE_CLEAN__ !== 'undefined' && __JOBFILL_STORE_CLEAN__) && (
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-petro-600" />
            <span className="text-xs font-bold text-slate-800">
              {language === 'bn' ? 'অফলাইন টেস্ট ফর্ম পোর্টাল (Offline Test Forms)' : 'Offline Test Form Sandbox'}
            </span>
          </div>
          <span className="text-[10.5px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-semibold border border-emerald-200">
            Local Form Sandbox
          </span>
        </div>

        <p className="text-xs text-slate-500">
          ইন্টারনেট সংযোগ ছাড়াই এক্সটেনশনের নির্ভুলতা ও গতি পরীক্ষা করার জন্য নিচের টেস্ট ফর্মগুলো ব্যবহার করতে পারেন:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
          <a
            href="test-pages/petrobangla-form.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 p-3 bg-slate-50 hover:bg-petro-50 border border-slate-200 hover:border-petro-300 rounded-xl text-xs font-bold text-slate-700 hover:text-petro-800 transition-all text-center"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            PetroBangla Mock Form
          </a>

          <a
            href="test-pages/teletalk-form.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 p-3 bg-slate-50 hover:bg-petro-50 border border-slate-200 hover:border-petro-300 rounded-xl text-xs font-bold text-slate-700 hover:text-petro-800 transition-all text-center"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Teletalk Alljobs Form
          </a>

          <a
            href="test-pages/bpsc-bcs-form.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 p-3 bg-slate-50 hover:bg-petro-50 border border-slate-200 hover:border-petro-300 rounded-xl text-xs font-bold text-slate-700 hover:text-petro-800 transition-all text-center"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            BPSC / BCS Mock Form
          </a>

          <a
            href="test-pages/dependent-dropdown.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 p-3 bg-slate-50 hover:bg-petro-50 border border-slate-200 hover:border-petro-300 rounded-xl text-xs font-bold text-slate-700 hover:text-petro-800 transition-all text-center"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Cascading Dropdown
          </a>
        </div>
      </div>
      )}

      {/* Privacy Policy Link Card */}
      <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <div className="text-xs font-bold text-emerald-900">
              {language === 'bn' ? 'গোপনীয়তা নীতি ও তথ্য সুরক্ষা (Privacy Policy — MR Software Studio)' : 'Privacy Policy & Data Protection Disclosure (MR Software Studio)'}
            </div>
            <div className="text-[11px] text-emerald-800">
              {language === 'bn'
                ? 'লোকাল AES-256-GCM ভল্ট, অনুমতি, পাবলিক সার্কুলার ইন্টারনেট রিকোয়েস্ট এবং সাপোর্ট (mahfuzar148@gmail.com) সম্পর্কে বিস্তারিত পড়ুন।'
                : 'Read the full disclosure covering Local-First AES-256-GCM storage, permissions, public job circular GET requests, and support (mahfuzar148@gmail.com).'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <a
            href={typeof chrome !== 'undefined' && chrome.runtime?.getURL ? chrome.runtime.getURL('privacy.html') : 'privacy.html'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {language === 'bn' ? 'প্রাইভেসি পলিসি দেখুন' : 'Open Privacy Policy'}
          </a>
          <a
            href="https://mahfuzar148.github.io/jobfill-bd-privacy/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {language === 'bn' ? 'অনলাইন সংস্করণ' : 'Public HTTPS Policy'}
          </a>
        </div>
      </div>

      {/* Frequently Asked Questions */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="text-xs font-bold text-petro-700 uppercase tracking-wider mb-2">
          {language === 'bn' ? 'সাধারণ প্রশ্নোত্তর (Frequently Asked Questions)' : 'Frequently Asked Questions'}
        </div>

        <div className="space-y-2">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="border border-slate-200 rounded-xl overflow-hidden transition-all"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full p-3.5 text-left bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-800 transition-colors"
                >
                  <span>{language === 'bn' ? faq.qBn : faq.qEn}</span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />}
                </button>

                {isOpen && (
                  <div className="p-3.5 bg-white text-xs text-slate-600 leading-relaxed border-t border-slate-100">
                    {language === 'bn' ? faq.aBn : faq.aEn}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
