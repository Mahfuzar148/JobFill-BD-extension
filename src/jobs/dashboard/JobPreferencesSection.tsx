// JobFill BD - Job Filter & Notification Preferences Section (Settings Integration)
// Configures daily digest, notification time (Asia/Dhaka), category/education/location/type filters,
// minimum salary, experience level, and applied reminder rules.

import React, { useState, useEffect } from 'react';
import { Bell, SlidersHorizontal, Save } from 'lucide-react';
import { useApp } from '../../dashboard/context/AppContext';
import {
  JobPreferences,
  DEFAULT_JOB_PREFERENCES,
  JobCategory,
  EducationRequirement,
  JobLocation,
  JobEmploymentType,
  ExperienceLevelPreference,
  WorkModePreference,
} from '../types/job.types';
import { JobRepository } from '../database/job-repository';
import { JOB_CATEGORIES, EDUCATION_LEVELS, EMPLOYMENT_TYPES, JOB_LOCATIONS } from './JobFilters';

interface JobPreferencesSectionProps {
  showToast: (msg: string) => void;
}

export const JobPreferencesSection: React.FC<JobPreferencesSectionProps> = ({ showToast }) => {
  const { language } = useApp();
  const bn = language === 'bn';
  const [prefs, setPrefs] = useState<JobPreferences>(DEFAULT_JOB_PREFERENCES);
  const [loaded, setLoaded] = useState(false);
  const [reliefwebInput, setReliefwebInput] = useState('');
  const [orgInput, setOrgInput] = useState('');
  const [includeKwInput, setIncludeKwInput] = useState('');
  const [excludeKwInput, setExcludeKwInput] = useState('');

  useEffect(() => {
    JobRepository.getPreferences().then((p) => {
      setPrefs(p);
      setReliefwebInput(p.reliefwebAppName || '');
      setOrgInput((p.preferredOrganizations || []).join(', '));
      setIncludeKwInput((p.includeKeywords || []).join(', '));
      setExcludeKwInput((p.excludeKeywords || []).join(', '));
      setLoaded(true);
    });
  }, []);

  const parseCsvList = (raw: string): string[] =>
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  const persist = async (next: JobPreferences) => {
    setPrefs(next);
    await JobRepository.savePreferences(next);
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      Promise.resolve(chrome.runtime.sendMessage({ action: 'RESCHEDULE_JOB_ALARMS' })).catch(() => {});
    }
    showToast(bn ? '🔔 জব ও নোটিফিকেশন পছন্দ সংরক্ষিত হয়েছে!' : '🔔 Job & notification preferences saved!');
  };

  const toggleItem = <T extends string>(list: T[], item: T): T[] => {
    return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
  };

  if (!loaded) return null;

  const timeValue = `${String(prefs.notificationHour).padStart(2, '0')}:${String(prefs.notificationMinute).padStart(2, '0')}`;

  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
      <div className="text-xs font-bold text-petro-700 dark:text-petro-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2">
        <Bell className="w-4 h-4 text-petro-600" />
        <span>
          {bn
            ? 'জব সার্কুলার ও স্মার্ট নোটিফিকেশন পছন্দসমূহ (Job & Notification Preferences)'
            : 'Job Circular & Smart Notification Preferences'}
        </span>
      </div>

      {/* Toggles & Schedule Time */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
          <div>
            <div className="text-xs font-bold text-slate-800 dark:text-white">
              {bn ? 'দৈনিক নতুন চাকরির আপডেট' : 'Daily Job Digest Notification'}
            </div>
            <div className="text-[11px] text-slate-500">
              {bn ? 'নতুন সার্কুলার ও আসন্ন সময়সীমার দৈনিক সারাংশ' : 'Daily summary of matching circulars & deadlines'}
            </div>
          </div>
          <input
            type="checkbox"
            checked={prefs.dailyDigestEnabled}
            onChange={(e) => persist({ ...prefs, dailyDigestEnabled: e.target.checked })}
            className="w-4 h-4 rounded text-petro-600"
          />
        </label>

        <label className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
          <div>
            <div className="text-xs font-bold text-slate-800 dark:text-white">
              {bn ? 'স্মার্ট ডেডলাইন রিমাইন্ডার' : 'Smart Deadline Reminders (48h / 24h / 2h)'}
            </div>
            <div className="text-[11px] text-slate-500">
              {bn ? 'শেষ ৪৮ ঘণ্টায় প্রতি ২ ঘণ্টা পরপর সতর্কতা' : 'Daily >48h; every 2 hours when <=48h remain'}
            </div>
          </div>
          <input
            type="checkbox"
            checked={prefs.deadlineRemindersEnabled}
            onChange={(e) => persist({ ...prefs, deadlineRemindersEnabled: e.target.checked })}
            className="w-4 h-4 rounded text-petro-600"
          />
        </label>

        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
          <div>
            <div className="text-xs font-bold text-slate-800 dark:text-white">
              {bn ? 'দৈনিক নোটিফিকেশনের সময় (Asia/Dhaka)' : 'Daily Notification Time (Asia/Dhaka)'}
            </div>
            <div className="text-[11px] text-slate-500">
              {bn ? 'ডিফল্ট সকাল ৯:০০ টা বাংলাদেশ সময়' : 'Default 9:00 AM Bangladesh Standard Time'}
            </div>
          </div>
          <input
            type="time"
            value={timeValue}
            onChange={(e) => {
              const [hStr, mStr] = e.target.value.split(':');
              const h = Number(hStr);
              const m = Number(mStr);
              if (Number.isInteger(h) && Number.isInteger(m)) {
                persist({ ...prefs, notificationHour: h, notificationMinute: m });
              }
            }}
            className="text-xs font-bold border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
          />
        </div>

        <label className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
          <div>
            <div className="text-xs font-bold text-slate-800 dark:text-white">
              {bn ? 'আবেদন সম্পন্ন হলে রিমাইন্ডার বন্ধ' : 'Stop Reminders When Marked Applied'}
            </div>
            <div className="text-[11px] text-slate-500">
              {bn ? '"Applied" হিসেবে চিহ্নিত চাকরিতে আর সতর্কতা পাঠাবে না' : 'Automatically suppresses deadline alerts once Applied'}
            </div>
          </div>
          <input
            type="checkbox"
            checked={prefs.stopRemindersWhenApplied}
            onChange={(e) => persist({ ...prefs, stopRemindersWhenApplied: e.target.checked })}
            className="w-4 h-4 rounded text-petro-600"
          />
        </label>
      </div>

      {/* Preferred Categories */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
          <SlidersHorizontal className="w-3.5 h-3.5 text-petro-600" />
          <span>{bn ? 'পছন্দের চাকরির ধরন (সবগুলোর জন্য খালি রাখুন)' : 'Preferred Job Categories (leave empty for all)'}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {JOB_CATEGORIES.map((cat) => {
            const active = prefs.preferredCategories.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() =>
                  persist({
                    ...prefs,
                    preferredCategories: toggleItem<JobCategory>(prefs.preferredCategories, cat),
                  })
                }
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                  active
                    ? 'bg-petro-600 text-white border-petro-700'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Preferred Education */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
          {bn ? 'শিক্ষাগত যোগ্যতা অনুযায়ী অগ্রাধিকার' : 'Preferred Education Levels'}
        </div>
        <div className="flex flex-wrap gap-2">
          {EDUCATION_LEVELS.map((ed) => {
            const active = prefs.preferredEducation.includes(ed);
            return (
              <button
                key={ed}
                type="button"
                onClick={() =>
                  persist({
                    ...prefs,
                    preferredEducation: toggleItem<EducationRequirement>(prefs.preferredEducation, ed),
                  })
                }
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                  active
                    ? 'bg-petro-600 text-white border-petro-700'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                {ed}
              </button>
            );
          })}
        </div>
      </div>

      {/* Preferred Locations & Employment Types */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
            {bn ? 'পছন্দের স্থান (Locations)' : 'Preferred Locations'}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {JOB_LOCATIONS.map((loc) => {
              const active = prefs.preferredLocations.includes(loc);
              return (
                <button
                  key={loc}
                  type="button"
                  onClick={() =>
                    persist({
                      ...prefs,
                      preferredLocations: toggleItem<JobLocation>(prefs.preferredLocations, loc),
                    })
                  }
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold border cursor-pointer ${
                    active
                      ? 'bg-petro-600 text-white border-petro-700'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {loc}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
            {bn ? 'চাকরির ধরন (Employment Type)' : 'Preferred Employment Types'}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {EMPLOYMENT_TYPES.map((t) => {
              const active = prefs.preferredEmploymentTypes.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() =>
                    persist({
                      ...prefs,
                      preferredEmploymentTypes: toggleItem<JobEmploymentType>(prefs.preferredEmploymentTypes, t),
                    })
                  }
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold border cursor-pointer ${
                    active
                      ? 'bg-petro-600 text-white border-petro-700'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Optional Minimum Salary, Experience & Work Mode */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
            {bn ? 'ন্যূনতম বেতন (ঐচ্ছিক, BDT)' : 'Minimum Salary (Optional, BDT)'}
          </label>
          <input
            type="number"
            min="0"
            value={prefs.minimumSalary ?? ''}
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : undefined;
              persist({ ...prefs, minimumSalary: val });
            }}
            placeholder="e.g. 22000"
            className="w-full text-xs border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
            {bn ? 'অভিজ্ঞতার স্তর (Experience Level)' : 'Experience Level'}
          </label>
          <select
            value={prefs.experienceLevel}
            onChange={(e) => persist({ ...prefs, experienceLevel: e.target.value as ExperienceLevelPreference })}
            className="w-full text-xs border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
          >
            <option value="Any">Any Experience</option>
            <option value="Fresh Graduate">Fresh Graduate</option>
            <option value="1-3 Years">1-3 Years</option>
            <option value="3+ Years">3+ Years</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
            {bn ? 'কাজের ধরন (Work Mode)' : 'Work Mode Preference'}
          </label>
          <select
            aria-label="Work Mode Preference"
            value={prefs.workModePreference || 'Any'}
            onChange={(e) => persist({ ...prefs, workModePreference: e.target.value as WorkModePreference })}
            className="w-full text-xs border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
          >
            <option value="Any">{bn ? 'যেকোনো (Any)' : 'Any (On-Site & Remote)'}</option>
            <option value="Remote">{bn ? 'শুধু রিমোট (Remote)' : 'Remote Only'}</option>
            <option value="On-Site">{bn ? 'অফিস / অন-সাইট (On-Site)' : 'On-Site Only'}</option>
          </select>
        </div>
      </div>

      {/* Organization & Keyword Alert Rules */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
        <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
          {bn ? 'প্রতিষ্ঠান ও কীওয়ার্ড অ্যালার্ট (Organizations & Keywords)' : 'Preferred Organizations & Keyword Filters'}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
              {bn ? 'পছন্দের প্রতিষ্ঠান (কমা দিয়ে)' : 'Preferred Organizations (comma-separated)'}
            </label>
            <input
              type="text"
              value={orgInput}
              onChange={(e) => setOrgInput(e.target.value)}
              placeholder="e.g. PetroBangla, Bangladesh Bank, BPSC"
              className="w-full text-xs border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
              {bn ? 'Include Keywords (কমা দিয়ে)' : 'Include Keywords (comma-separated)'}
            </label>
            <input
              type="text"
              value={includeKwInput}
              onChange={(e) => setIncludeKwInput(e.target.value)}
              placeholder="e.g. Assistant Engineer, Computer, BCS"
              className="w-full text-xs border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
              {bn ? 'Exclude Keywords (কমা দিয়ে)' : 'Exclude Keywords (comma-separated)'}
            </label>
            <input
              type="text"
              value={excludeKwInput}
              onChange={(e) => setExcludeKwInput(e.target.value)}
              placeholder="e.g. Intern, Part Time"
              className="w-full text-xs border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            persist({
              ...prefs,
              preferredOrganizations: parseCsvList(orgInput),
              includeKeywords: parseCsvList(includeKwInput),
              excludeKeywords: parseCsvList(excludeKwInput),
            })
          }
          className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-petro-600 hover:bg-petro-700 text-white cursor-pointer"
        >
          {bn ? 'প্রতিষ্ঠান ও কীওয়ার্ড সংরক্ষণ' : 'Save Organization & Keyword Rules'}
        </button>
      </div>

      {/* Optional REST APIs (Remotive, Remote OK, Himalayas & ReliefWeb v2) */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
        <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
          {bn ? 'ঐচ্ছিক REST API সোর্স (Optional API Sources)' : 'Optional Job REST API Sources'}
        </div>

        <label className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
          <div>
            <div className="text-xs font-bold text-slate-800 dark:text-white">
              {bn ? 'Remotive রিমোট/আইটি জব API (ফ্রি, কী ছাড়া)' : 'Remotive Remote & Tech Jobs API (Free, No Key)'}
            </div>
            <div className="text-[11px] text-slate-500">
              {bn ? 'গ্লোবাল রিমোট টেক/সফটওয়্যার জব ফিড সক্রিয় রাখুন' : 'Fetch remote software, IT & tech jobs via public REST API'}
            </div>
          </div>
          <input
            type="checkbox"
            checked={prefs.enableRemotiveSource !== false}
            onChange={(e) => persist({ ...prefs, enableRemotiveSource: e.target.checked })}
            className="w-4 h-4 rounded text-petro-600"
          />
        </label>

        <label className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
          <div>
            <div className="text-xs font-bold text-slate-800 dark:text-white">
              {bn ? 'Remote OK রিমোট জব API (ফ্রি, কী ছাড়া)' : 'Remote OK Public API (Free, Attribution Linkback)'}
            </div>
            <div className="text-[11px] text-slate-500">
              {bn ? 'বিশ্বব্যাপী রিমোট টেক ও ডিজাইন জব ফিড সক্রিয় রাখুন' : 'Fetch worldwide remote openings via remoteok.com public feed'}
            </div>
          </div>
          <input
            type="checkbox"
            checked={prefs.enableRemoteOkSource !== false}
            onChange={(e) => persist({ ...prefs, enableRemoteOkSource: e.target.checked })}
            className="w-4 h-4 rounded text-petro-600"
          />
        </label>

        <label className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
          <div>
            <div className="text-xs font-bold text-slate-800 dark:text-white">
              {bn ? 'Himalayas রিমোট জব API (বাংলাদেশ / Worldwide ফিল্টারসহ)' : 'Himalayas Remote Public API (Worldwide / Bangladesh Eligible)'}
            </div>
            <div className="text-[11px] text-slate-500">
              {bn ? 'কেবল Worldwide বা বাংলাদেশে প্রযোজ্য ইন্টারন্যাশনাল রিমোট পদ দেখুন' : 'Filters specifically to Worldwide or Bangladesh-eligible international roles'}
            </div>
          </div>
          <input
            type="checkbox"
            checked={prefs.enableHimalayasSource !== false}
            onChange={(e) => persist({ ...prefs, enableHimalayasSource: e.target.checked })}
            className="w-4 h-4 rounded text-petro-600"
          />
        </label>

        <label className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
          <div>
            <div className="text-xs font-bold text-slate-800 dark:text-white">
              {bn ? 'Arbeitnow রিমোট/ইন্টারন্যাশনাল জব API (ফ্রি, কী ছাড়া)' : 'Arbeitnow International Remote API (Free, No Key)'}
            </div>
            <div className="text-[11px] text-slate-500">
              {bn ? 'ইউরোপ ও বিশ্বব্যাপী রিমোট চাকরির ফ্রি REST API সক্রিয় রাখুন' : 'Fetches remote=true international openings via arbeitnow.com public feed'}
            </div>
          </div>
          <input
            type="checkbox"
            checked={prefs.enableArbeitnowSource !== false}
            onChange={(e) => persist({ ...prefs, enableArbeitnowSource: e.target.checked })}
            className="w-4 h-4 rounded text-petro-600"
          />
        </label>

        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
          <div>
            <div className="text-xs font-bold text-slate-800 dark:text-white">
              {bn ? 'ReliefWeb API v2 Appname (UN / NGO চাকরি — বাংলাদেশ)' : 'ReliefWeb API v2 Appname (Optional — UN / NGO Jobs in Bangladesh)'}
            </div>
            <div className="text-[11px] text-slate-500">
              {bn
                ? 'apidoc.reliefweb.int থেকে ফ্রি অনুমোদিত appname নিয়ে এখানে লিখুন ও সংরক্ষণ করুন।'
                : 'Request a free approved appname at apidoc.reliefweb.int/parameters#appname and paste it here.'}
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={reliefwebInput}
              onChange={(e) => setReliefwebInput(e.target.value)}
              placeholder="e.g. my-approved-jobfill-appname"
              className="flex-1 text-xs border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
            />
            <button
              type="button"
              onClick={() => persist({ ...prefs, reliefwebAppName: reliefwebInput.trim() })}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-petro-600 hover:bg-petro-700 text-white cursor-pointer"
            >
              {bn ? 'সংরক্ষণ' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <div className="text-[11px] text-slate-500 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Save className="w-3.5 h-3.5 text-petro-600 shrink-0" />
          <span>
            {bn
              ? 'এই পছন্দসমূহ নোটিফিকেশন অগ্রাধিকারের জন্য ব্যবহৃত হয়; ড্যাশবোর্ডে অন্যান্য চাকরি লুকানো হয় না।'
              : 'Preferences filter and prioritize notifications. Other circulars remain visible in the main dashboard unless you activate "Filter by My Job Preferences".'}
          </span>
        </div>
        <div className="text-[11px] text-amber-700 dark:text-amber-300">
          {bn
            ? 'সীমাবদ্ধতা: Chrome বন্ধ থাকলে বা ডিভাইস স্লিপ মোডে থাকলে MV3 অ্যালার্ম ব্রাউজার পুনরায় চালু হওয়ার পর ফায়ার হয়।'
            : 'Limitation: If Chrome is closed or your computer is asleep at a scheduled time, MV3 Alarms trigger notifications once Chrome reopens.'}
        </div>
      </div>
    </div>
  );
};
