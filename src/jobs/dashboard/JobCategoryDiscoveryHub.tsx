// JobFill BD - Universal Job Category Coverage & Complete Category-Wise Job Discovery Engine
// Implements:
// 1. All Categories (সব পেশার চাকরি - deduplicated view across all 27 categories)
// 2. Browse by Category (পেশা অনুযায়ী খুঁজুন - 27 primary category cards, zero-count visible, subcategories, online search)
// 3. Unclassified Jobs (যেসব চাকরির Category এখনো নিশ্চিত নয় - never discarded)
// 4. "Why is this job not appearing in my category?" diagnostic modal
// 5. "Suggest a New Category" proposal modal with duplicate checking

import React, { useState, useMemo } from 'react';
import {
  Building2,
  Landmark,
  GraduationCap,
  Stethoscope,
  Wrench,
  Code,
  Briefcase,
  TrendingUp,
  HeartHandshake,
  Wheat,
  Leaf,
  Shirt,
  Truck,
  Utensils,
  Camera,
  ShoppingBag,
  Hammer,
  Scale,
  Shield,
  FlaskConical,
  Radio,
  Home,
  Users,
  Car,
  Plane,
  Layers,
  HelpCircle,
  Search,
  ChevronDown,
  ChevronUp,
  Globe,
  RotateCcw,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
  PlusCircle,
  ExternalLink,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  UNIVERSAL_JOB_TAXONOMY,
  JobTaxonomyRegistry,
  MainCategoryDefinition,
  SubcategoryDefinition,
  ProposedCategory,
} from '../taxonomy/job-taxonomy';
import {
  NormalizedJobCircular,
  JobSearchFilters,
} from '../types/job.types';
import { JobCard } from './JobCard';
import { DAY_MS, isTimestampInCurrentDhakaWeek } from '../services/deadline-parser';
import { FederatedSearchOrchestrator } from '../services/federated-search-orchestrator';

// Map icon string names to Lucide Icon components
const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Building2,
  Landmark,
  GraduationCap,
  Stethoscope,
  Wrench,
  Code,
  Briefcase,
  TrendingUp,
  HeartHandshake,
  Wheat,
  Leaf,
  Shirt,
  Truck,
  Utensils,
  Camera,
  ShoppingBag,
  Hammer,
  Scale,
  Shield,
  FlaskConical,
  Radio,
  Home,
  Users,
  Car,
  Plane,
  Layers,
  HelpCircle,
};

export type CategoryHubView = 'all_categories' | 'browse_categories' | 'unclassified';

export interface JobCategoryDiscoveryHubProps {
  jobs: NormalizedJobCircular[];
  language: 'en' | 'bn';
  onSelectJob: (job: NormalizedJobCircular) => void;
  onApplyJob: (job: NormalizedJobCircular) => void;
  onBookmarkJob: (job: NormalizedJobCircular) => void;
  bookmarkedIds: Set<string>;
  onRunOnlineSearch: (categoryId?: string, subcategoryId?: string) => Promise<void>;
  isSearchingOnline?: boolean;
}

export const JobCategoryDiscoveryHub: React.FC<JobCategoryDiscoveryHubProps> = ({
  jobs,
  language,
  onSelectJob,
  onApplyJob,
  onBookmarkJob,
  bookmarkedIds,
  onRunOnlineSearch,
  isSearchingOnline = false,
}) => {
  const bn = language === 'bn';

  // 3 Primary Views
  const [currentView, setCurrentView] = useState<CategoryHubView>('browse_categories');

  // Selected filter states
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('All');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>('All');
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);

  // Modals
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);
  const [diagnosticQuery, setDiagnosticQuery] = useState('');
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [suggestTitleEn, setSuggestTitleEn] = useState('');
  const [suggestTitleBn, setSuggestTitleBn] = useState('');
  const [suggestParentId, setSuggestParentId] = useState('');
  const [suggestJustification, setSuggestJustification] = useState('');
  const [suggestFeedback, setSuggestFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Compute category statistics from actual loaded jobs (Never fabricated!)
  const categoryStats = useMemo(() => {
    const counts = new Map<string, { total: number; newJobs: number }>();
    const now = Date.now();

    // Initialize every category with 0 jobs (never hide categories with 0 jobs)
    for (const cat of UNIVERSAL_JOB_TAXONOMY) {
      counts.set(cat.id, { total: 0, newJobs: 0 });
    }

    for (const job of jobs) {
      const isNew = isTimestampInCurrentDhakaWeek(job.publishedAt, now) || now - job.firstDiscoveredAt <= 7 * DAY_MS;

      // Primary category
      const primaryCat = JobTaxonomyRegistry.resolveCategoryId(job.taxonomyCategoryId || 'other_unclassified');
      const stats = counts.get(primaryCat) || { total: 0, newJobs: 0 };
      stats.total += 1;
      if (isNew) stats.newJobs += 1;
      counts.set(primaryCat, stats);

      // Multi-label secondary categories
      if (job.taxonomyCategoryIds && Array.isArray(job.taxonomyCategoryIds)) {
        for (const sec of job.taxonomyCategoryIds) {
          const canonicalSec = JobTaxonomyRegistry.resolveCategoryId(sec);
          if (canonicalSec !== primaryCat) {
            const secStats = counts.get(canonicalSec) || { total: 0, newJobs: 0 };
            secStats.total += 1;
            if (isNew) secStats.newJobs += 1;
            counts.set(canonicalSec, secStats);
          }
        }
      }
    }

    return counts;
  }, [jobs]);

  // Total unique unclassified jobs
  const unclassifiedJobs = useMemo(() => {
    return jobs.filter((j) => {
      const cat = JobTaxonomyRegistry.resolveCategoryId(j.taxonomyCategoryId || '');
      return j.isUnclassified || cat === 'other_unclassified';
    });
  }, [jobs]);

  // Categories matching category search bar
  const filteredCategories = useMemo(() => {
    return JobTaxonomyRegistry.searchCategories(categorySearchQuery, language);
  }, [categorySearchQuery, language]);

  // Jobs matching selected category & subcategory (with deduplication)
  const categoryFilteredJobs = useMemo(() => {
    if (currentView === 'unclassified') {
      return unclassifiedJobs;
    }

    if (selectedCategoryId === 'All' || currentView === 'all_categories') {
      return jobs; // All categories view: every job appears exactly once
    }

    const canonicalSelected = JobTaxonomyRegistry.resolveCategoryId(selectedCategoryId);

    return jobs.filter((j) => {
      const primary = JobTaxonomyRegistry.resolveCategoryId(j.taxonomyCategoryId || 'other_unclassified');
      const inMulti = j.taxonomyCategoryIds && j.taxonomyCategoryIds.map((id) => JobTaxonomyRegistry.resolveCategoryId(id)).includes(canonicalSelected);

      const matchesCat = primary === canonicalSelected || Boolean(inMulti);
      if (!matchesCat) return false;

      if (selectedSubcategoryId !== 'All' && j.taxonomySubcategoryId) {
        return j.taxonomySubcategoryId.toLowerCase() === selectedSubcategoryId.toLowerCase();
      }

      return true;
    });
  }, [currentView, selectedCategoryId, selectedSubcategoryId, jobs, unclassifiedJobs]);

  // Submit Category Proposal
  const handleProposeCategory = (e: React.FormEvent) => {
    e.preventDefault();
    setSuggestFeedback(null);

    const res = JobTaxonomyRegistry.proposeCategory({
      proposedTitleEn: suggestTitleEn,
      proposedTitleBn: suggestTitleBn,
      parentCategoryId: suggestParentId || undefined,
      justification: suggestJustification,
    });

    if (res.success) {
      setSuggestFeedback({
        success: true,
        message: bn
          ? 'ধন্যবাদ! নতুন ক্যাটাগরির প্রস্তাব সফলভাবে রেকর্ড করা হয়েছে। অ্যাডমিন পর্যালোচনার পর এটি ট্যাক্সোনোমিতে অন্তর্ভুক্ত হবে।'
          : 'Thank you! The category proposal was recorded for taxonomy review.',
      });
      setSuggestTitleEn('');
      setSuggestTitleBn('');
      setSuggestJustification('');
    } else {
      setSuggestFeedback({
        success: false,
        message: res.reason || 'Failed to submit proposal',
      });
    }
  };

  // Convert number to Bengali digits
  const toBn = (num: number) => {
    if (!bn) return String(num);
    const digits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(num).replace(/\d/g, (d) => digits[parseInt(d, 10)]);
  };

  return (
    <div className="space-y-6" data-testid="job-category-discovery-hub">
      {/* 3 Main Views Segmented Navigation */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-1.5 flex-1">
          {/* View 1: All Categories */}
          <button
            type="button"
            role="tab"
            aria-selected={currentView === 'all_categories'}
            onClick={() => {
              setCurrentView('all_categories');
              setSelectedCategoryId('All');
              setSelectedSubcategoryId('All');
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
              currentView === 'all_categories'
                ? 'bg-white dark:bg-slate-900 text-petro-700 dark:text-petro-300 shadow-xs border border-petro-300 dark:border-petro-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <div>{bn ? '১. সব পেশার চাকরি' : '1. All Categories'}</div>
            <div className="text-[10px] font-normal opacity-80">
              {bn ? `মোট ${toBn(jobs.length)}টি সার্কুলার` : `${jobs.length} Unique Jobs`}
            </div>
          </button>

          {/* View 2: Browse by Category */}
          <button
            type="button"
            role="tab"
            aria-selected={currentView === 'browse_categories'}
            onClick={() => setCurrentView('browse_categories')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
              currentView === 'browse_categories'
                ? 'bg-white dark:bg-slate-900 text-petro-700 dark:text-petro-300 shadow-xs border border-petro-300 dark:border-petro-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <div>{bn ? '২. পেশা অনুযায়ী ব্রাউজ' : '2. Browse by Category'}</div>
            <div className="text-[10px] font-normal opacity-80">
              {bn ? '২৭টি প্রধান পেশা ও সাব-ক্যাটাগরি' : '27 Primary Categories'}
            </div>
          </button>

          {/* View 3: Unclassified Jobs */}
          <button
            type="button"
            role="tab"
            aria-selected={currentView === 'unclassified'}
            onClick={() => {
              setCurrentView('unclassified');
              setSelectedCategoryId('other_unclassified');
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
              currentView === 'unclassified'
                ? 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 shadow-xs border border-amber-300 dark:border-amber-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <div>{bn ? '৩. অনির্ধারিত সার্কুলার' : '3. Unclassified Jobs'}</div>
            <div className="text-[10px] font-normal opacity-80">
              {bn ? `${toBn(unclassifiedJobs.length)}টি পর্যালোচনাধীন` : `${unclassifiedJobs.length} Needs Review`}
            </div>
          </button>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-1.5 px-2">
          <button
            type="button"
            onClick={() => setShowDiagnosticModal(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 cursor-pointer"
            title={bn ? 'আমার ক্যাটাগরিতে চাকরিটি কেন নেই?' : 'Why is this job not in my category?'}
          >
            <Info className="w-3.5 h-3.5 text-petro-600" />
            <span className="hidden md:inline">{bn ? 'ক্যাটাগরি ডায়াগনস্টিক' : 'Diagnostics'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSuggestModal(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{bn ? 'নতুন ক্যাটাগরির প্রস্তাব' : 'Suggest Category'}</span>
          </button>
        </div>
      </div>

      {/* VIEW 2: BROWSE BY CATEGORY (Card Grid) */}
      {currentView === 'browse_categories' && (
        <div className="space-y-4">
          {/* Category Search & Filter Header */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={categorySearchQuery}
                onChange={(e) => setCategorySearchQuery(e.target.value)}
                placeholder={bn ? 'ক্যাটাগরি বা সাব-ক্যাটাগরি খুঁজুন (বাংলা / English)...' : 'Search 27 categories & subcategories...'}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-petro-500"
              />
              {categorySearchQuery && (
                <button
                  type="button"
                  onClick={() => setCategorySearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {selectedCategoryId !== 'All' && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategoryId('All');
                  setSelectedSubcategoryId('All');
                }}
                className="inline-flex items-center gap-1 text-xs text-petro-600 hover:underline cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{bn ? 'সব ক্যাটাগরি দেখান' : 'Show All Categories'}</span>
              </button>
            )}
          </div>

          {/* 27 Categories Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredCategories.map((cat) => {
              const stats = categoryStats.get(cat.id) || { total: 0, newJobs: 0 };
              const IconComp = ICON_MAP[cat.iconName] || Briefcase;
              const isSelected = selectedCategoryId === cat.id;
              const isExpanded = expandedCategoryId === cat.id;

              return (
                <div
                  key={cat.id}
                  className={`rounded-2xl border transition-all p-3.5 flex flex-col justify-between ${
                    isSelected
                      ? 'border-petro-500 bg-petro-50/40 dark:bg-petro-950/20 shadow-xs ring-1 ring-petro-500'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div>
                    {/* Top Row: Icon + Code + Badges */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-petro-100 dark:bg-petro-900/50 text-petro-700 dark:text-petro-300">
                          <IconComp className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-mono font-bold text-slate-400">
                          #{cat.code}
                        </span>
                      </div>

                      {/* Job Count Badge (Always visible even if 0 Jobs) */}
                      <div className="flex items-center gap-1">
                        {stats.newJobs > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9.5px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            +{toBn(stats.newJobs)} {bn ? 'নতুন' : 'New'}
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold ${
                            stats.total > 0
                              ? 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                              : 'bg-slate-50 text-slate-400 dark:bg-slate-800/40 dark:text-slate-500'
                          }`}
                        >
                          {toBn(stats.total)} {bn ? 'টি চাকরি' : 'Jobs'}
                        </span>
                      </div>
                    </div>

                    {/* Titles */}
                    <div className="mt-2.5">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                        {bn ? cat.labelBn : cat.labelEn}
                      </h4>
                      <p className="text-[10.5px] text-slate-500 dark:text-slate-400 line-clamp-1">
                        {bn ? cat.labelEn : cat.labelBn}
                      </p>
                    </div>

                    {/* Subcategories Expand Area */}
                    {cat.subcategories.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                        <button
                          type="button"
                          onClick={() => setExpandedCategoryId(isExpanded ? null : cat.id)}
                          className="w-full flex items-center justify-between text-[10.5px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                        >
                          <span>
                            {cat.subcategories.length} {bn ? 'টি সাব-ক্যাটাগরি' : 'Subcategories'}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="mt-2 space-y-1 max-h-36 overflow-y-auto pr-1 animate-fadeIn">
                            {cat.subcategories.map((sub) => (
                              <button
                                key={sub.id}
                                type="button"
                                onClick={() => {
                                  setSelectedCategoryId(cat.id);
                                  setSelectedSubcategoryId(sub.id);
                                }}
                                className={`w-full text-left text-[10px] px-2 py-1 rounded-md transition-colors cursor-pointer truncate ${
                                  selectedCategoryId === cat.id && selectedSubcategoryId === sub.id
                                    ? 'bg-petro-600 text-white font-semibold'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                              >
                                {bn ? sub.labelBn : sub.labelEn}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategoryId(cat.id);
                        setSelectedSubcategoryId('All');
                      }}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-petro-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-petro-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {isSelected ? (bn ? 'নির্বাচিত' : 'Selected') : (bn ? 'সার্কুলার দেখুন' : 'View Jobs')}
                    </button>

                    <button
                      type="button"
                      disabled={isSearchingOnline}
                      onClick={() => onRunOnlineSearch(cat.id)}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-50 cursor-pointer"
                      title={bn ? 'এই ক্যাটাগরিতে লাইভ অনলাইন সার্চ চালান' : 'Live Online Search for this Category'}
                    >
                      <Globe className="w-3.5 h-3.5 text-petro-600" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 3: UNCLASSIFIED JOBS BANNER */}
      {currentView === 'unclassified' && (
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 dark:text-amber-200">
            <h5 className="font-bold">
              {bn ? 'অনির্ধারিত / পর্যালোচনায় থাকা সার্কুলার' : 'Unclassified Jobs Under Review'}
            </h5>
            <p className="mt-0.5 opacity-90">
              {bn
                ? 'এই সার্কুলারগুলোতে সুনির্দিষ্ট ক্যাটাগরি তথ্য না থাকায় কোনো সার্কুলার বাদ না দিয়ে সাময়িকভাবে এখানে রাখা হয়েছে। আপনি চাইলে এগুলোর জন্য নতুন ক্যাটাগরি প্রস্তাব করতে পারেন।'
                : 'These job circulars had insufficient category metadata and have been safely retained here without exclusion. You can propose new categories for them.'}
            </p>
          </div>
        </div>
      )}

      {/* Selected Category Header (when viewing circulars) */}
      {(currentView === 'all_categories' || selectedCategoryId !== 'All' || currentView === 'unclassified') && (
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>
                {currentView === 'unclassified'
                  ? bn
                    ? 'অনির্ধারিত সার্কুলারসমূহ'
                    : 'Unclassified Job Circulars'
                  : currentView === 'all_categories'
                    ? bn
                      ? 'সব পেশার চাকরি (একত্রিত)'
                      : 'All Categories (Unified)'
                    : bn
                      ? `${JobTaxonomyRegistry.getById(selectedCategoryId)?.labelBn} এর সার্কুলার`
                      : `${JobTaxonomyRegistry.getById(selectedCategoryId)?.labelEn} Jobs`}
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-petro-100 text-petro-800 dark:bg-petro-950/60 dark:text-petro-300">
                {toBn(categoryFilteredJobs.length)} {bn ? 'টি' : 'found'}
              </span>
            </h3>
            {selectedSubcategoryId !== 'All' && (
              <p className="text-xs text-slate-500">
                {bn ? 'সাব-ক্যাটাগরি ফিল্টার:' : 'Subcategory:'}{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {bn
                    ? JobTaxonomyRegistry.getSubcategoryById(selectedCategoryId, selectedSubcategoryId)?.labelBn
                    : JobTaxonomyRegistry.getSubcategoryById(selectedCategoryId, selectedSubcategoryId)?.labelEn}
                </span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSearchingOnline}
              onClick={() => onRunOnlineSearch(selectedCategoryId === 'All' ? undefined : selectedCategoryId, selectedSubcategoryId === 'All' ? undefined : selectedSubcategoryId)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-petro-600 hover:bg-petro-700 text-white shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{isSearchingOnline ? (bn ? 'অনুসন্ধান চলছে...' : 'Searching Online...') : (bn ? 'লাইভ অনলাইন সার্চ' : 'Search Online')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Circular Cards List */}
      <div className="space-y-3">
        {categoryFilteredJobs.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl">
            <Briefcase className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {bn ? 'এই ক্যাটাগরিতে কোনো স্থানীয় চাকরি সংরক্ষিত নেই' : 'No stored jobs found for this category'}
            </h4>
            <p className="text-[11px] text-slate-500 max-w-md mx-auto mt-1">
              {bn
                ? 'অনলাইন সোর্সগুলো থেকে নতুন বিজ্ঞপ্তি খুঁজতে উপরের "লাইভ অনলাইন সার্চ" বাটনে ক্লিক করুন।'
                : 'Click "Search Online" above to retrieve live circulars across authorized sources.'}
            </p>
          </div>
        ) : (
          categoryFilteredJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              language={language}
              isBookmarked={bookmarkedIds.has(job.id)}
              onToggleBookmark={() => onBookmarkJob(job)}
              onApplyNow={() => onApplyJob(job)}
              onViewDetails={() => onSelectJob(job)}
            />
          ))
        )}
      </div>

      {/* DIAGNOSTIC MODAL: "Why is this job not in my category?" */}
      {showDiagnosticModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-petro-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {bn ? 'ক্যাটাগরি ডায়াগনস্টিক অ্যাসিস্ট্যান্ট' : 'Category Diagnostic Assistant'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDiagnosticModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-400">
              <p>
                {bn
                  ? 'কোনো চাকরি আপনার প্রত্যাশিত ক্যাটাগরিতে প্রদর্শিত না হলে তার পেছনে নিচের কারণগুলো থাকতে পারে:'
                  : 'If a circular is missing from your expected category, the following evidence-based factors apply:'}
              </p>

              <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-[11.5px]">
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200">১. Source Specialization:</span>{' '}
                  {bn ? 'সংশ্লিষ্ট সোর্সটি এই ক্যাটাগরি সমর্থন করে না (যেমন: DPE কেবল প্রাথমিক শিক্ষা কভার করে)।' : 'Source does not index this category (e.g. DPE covers Primary Education only).'}
                </div>
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200">২. Online Search Not Run:</span>{' '}
                  {bn ? 'অনলাইন সার্চ না চালানো পর্যন্ত কেবল লোকাল IndexedDB-তে সংরক্ষিত চাকরি দেখা যায়।' : 'Live search has not been executed; only locally indexed records are displayed.'}
                </div>
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200">৩. Multi-Label Classification:</span>{' '}
                  {bn ? 'চাকরিটি একাধিক ক্যাটাগরিতে থাকলে যেকোনো একটি সংশ্লিষ্ট ক্যাটাগরিতে দেখা যাবে।' : 'Job matches multiple categories and appears under each applicable category.'}
                </div>
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200">৪. Active Filters:</span>{' '}
                  {bn ? 'গ্রেড, শিক্ষাগত যোগ্যতা বা ডেডলাইন ফিল্টার থাকলে ফলাফল বাদ পড়তে পারে।' : 'Active grade, education, or deadline filters may filter out the record.'}
                </div>
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200">৫. Unclassified State:</span>{' '}
                  {bn ? 'পর্যাপ্ত তথ্য না থাকায় চাকরিটি "অনির্ধারিত সার্কুলার" ট্যাবে রাখা হয়েছে।' : 'Insufficient text context placed the circular in the Unclassified tab.'}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowDiagnosticModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                {bn ? 'বুঝেছি' : 'Got it'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROPOSAL MODAL: "Suggest a New Category" */}
      {showSuggestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {bn ? 'নতুন পেশা বা ক্যাটাগরির প্রস্তাব দিন' : 'Suggest a New Job Category'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowSuggestModal(false);
                  setSuggestFeedback(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {suggestFeedback && (
              <div
                className={`p-3 rounded-xl text-xs border ${
                  suggestFeedback.success
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800'
                    : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800'
                }`}
              >
                {suggestFeedback.message}
              </div>
            )}

            <form onSubmit={handleProposeCategory} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {bn ? 'ক্যাটাগরির নাম (English)*' : 'Category Name (English)*'}
                </label>
                <input
                  type="text"
                  required
                  value={suggestTitleEn}
                  onChange={(e) => setSuggestTitleEn(e.target.value)}
                  placeholder="e.g. Drone & Robotics Operations"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {bn ? 'ক্যাটাগরির নাম (বাংলা)*' : 'Category Name (Bengali)*'}
                </label>
                <input
                  type="text"
                  required
                  value={suggestTitleBn}
                  onChange={(e) => setSuggestTitleBn(e.target.value)}
                  placeholder="যেমন: ড্রোন ও রোবটিক্স পরিচালনা"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {bn ? 'প্রধান ক্যাটাগরি (ঐচ্ছিক)' : 'Parent Category (Optional)'}
                </label>
                <select
                  value={suggestParentId}
                  onChange={(e) => setSuggestParentId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">{bn ? '-- কোনোটি নয় (প্রধান ক্যাটাগরি হিসেবে) --' : '-- None (As Primary Category) --'}</option>
                  {UNIVERSAL_JOB_TAXONOMY.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code}. {bn ? c.labelBn : c.labelEn}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {bn ? 'যৌক্তিকতা ও নমুনাসমূহ*' : 'Justification & Examples*'}
                </label>
                <textarea
                  required
                  rows={3}
                  value={suggestJustification}
                  onChange={(e) => setSuggestJustification(e.target.value)}
                  placeholder={bn ? 'কেন এই নতুন ক্যাটাগরি প্রয়োজন এবং কোন ধরনের সার্কুলার এতে পড়বে...' : 'Why is this category needed and what kind of circulars belong here...'}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowSuggestModal(false);
                    setSuggestFeedback(null);
                  }}
                  className="px-3.5 py-2 rounded-xl font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  {bn ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
                >
                  {bn ? 'প্রস্তাব জমা দিন' : 'Submit Proposal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
