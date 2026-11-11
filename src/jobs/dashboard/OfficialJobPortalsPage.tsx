// JobFill BD - Official Job Portals Quick Access Directory & Page
// Displays the curated 14 verified HTTPS Bangladesh & global job portals with search,
// category filtering, and safe one-click new-tab navigation without auto-sending user data.

import React, { useMemo, useState } from 'react';
import {
  Globe,
  ExternalLink,
  Search,
  ShieldCheck,
  X,
  Lock,
  Building2,
  Landmark,
  GraduationCap,
  Briefcase,
  Laptop,
  Plane,
} from 'lucide-react';
import { useApp } from '../../dashboard/context/AppContext';
import {
  OFFICIAL_JOB_PORTALS,
  OFFICIAL_PORTAL_CATEGORIES,
  OFFICIAL_PORTAL_CATEGORY_LABELS,
  OfficialJobPortalEntry,
  OfficialPortalCategory,
  PortalFilterCategory,
  filterOfficialPortals,
  openOfficialPortalInNewTab,
} from '../data/official-portals';

function getCategoryIcon(category: OfficialPortalCategory | 'All'): React.ReactNode {
  switch (category) {
    case 'Government':
      return <Building2 className="w-3.5 h-3.5" />;
    case 'Bank':
      return <Landmark className="w-3.5 h-3.5" />;
    case 'Education':
      return <GraduationCap className="w-3.5 h-3.5" />;
    case 'Private':
      return <Briefcase className="w-3.5 h-3.5" />;
    case 'International':
      return <Plane className="w-3.5 h-3.5" />;
    case 'Remote':
      return <Laptop className="w-3.5 h-3.5" />;
    default:
      return <Globe className="w-3.5 h-3.5" />;
  }
}

interface PortalCardProps {
  portal: OfficialJobPortalEntry;
  bn: boolean;
  onVisit: (portal: OfficialJobPortalEntry) => void;
}

const PortalCard: React.FC<PortalCardProps> = ({ portal, bn, onVisit }) => {
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <article
      data-testid={`portal-card-${portal.id}`}
      data-portal-category={portal.category}
      className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs hover:shadow-md hover:border-petro-300 dark:hover:border-petro-700 transition-all flex flex-col justify-between gap-4"
    >
      <div className="space-y-3">
        {/* Top Row: Brand Monogram / Logo + Category Pill */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {portal.logoUrl && !logoFailed ? (
              <img
                src={portal.logoUrl}
                alt={`${portal.name} logo`}
                onError={() => setLogoFailed(true)}
                className="w-11 h-11 rounded-xl object-contain bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1.5 shrink-0"
              />
            ) : (
              <div
                aria-hidden="true"
                className={`w-11 h-11 rounded-xl bg-gradient-to-br ${portal.accentGradientClass} text-white font-black text-sm flex items-center justify-center shadow-xs shrink-0 tracking-tight`}
              >
                {portal.monogram}
              </div>
            )}

            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white leading-snug break-words">
                {portal.name}
              </h3>
              {bn && (
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {portal.nameBn}
                </p>
              )}
              <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                <Lock className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">{portal.domain}</span>
              </div>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border shrink-0 ${portal.badgeColorClass}`}
          >
            {getCategoryIcon(portal.category)}
            <span>{bn ? portal.categoryBn : portal.category}</span>
          </span>
        </div>

        {/* Short Description */}
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          {bn ? portal.descriptionBn : portal.description}
        </p>
      </div>

      {/* Bottom Action Bar */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
          <span>{bn ? 'যাচাইকৃত HTTPS' : 'Verified HTTPS'}</span>
        </span>

        <button
          type="button"
          data-testid={`visit-portal-${portal.id}`}
          data-portal-url={portal.url}
          aria-label={`Visit Website: ${portal.name}`}
          onClick={() => onVisit(portal)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-petro-600 hover:bg-petro-700 text-white shadow-xs transition-colors cursor-pointer shrink-0"
        >
          <span>{bn ? 'ওয়েবসাইট ভিজিট করুন' : 'Visit Website'}</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>
    </article>
  );
};

export interface OfficialJobPortalsDirectoryProps {
  compact?: boolean;
  onPortalOpened?: (portal: OfficialJobPortalEntry) => void;
  languageOverride?: 'en' | 'bn';
}

const PORTALS_SESSION_KEY = 'jobfill_portals_ui_state_v1';

function readPersistedPortalsUiState(): { category: PortalFilterCategory; query: string } {
  if (typeof sessionStorage !== 'undefined') {
    try {
      const raw = sessionStorage.getItem(PORTALS_SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return {
            category: parsed.category || 'All',
            query: typeof parsed.query === 'string' ? parsed.query : '',
          };
        }
      }
    } catch {
      // ignore storage errors
    }
  }
  return { category: 'All', query: '' };
}

export const OfficialJobPortalsDirectory: React.FC<OfficialJobPortalsDirectoryProps> = ({
  compact = false,
  onPortalOpened,
  languageOverride,
}) => {
  const { language, showToast } = useApp();
  const bn = (languageOverride ?? language) === 'bn';

  const initialUi = useMemo(() => (compact ? { category: 'All' as PortalFilterCategory, query: '' } : readPersistedPortalsUiState()), [compact]);
  const [selectedCategory, setSelectedCategory] = useState<PortalFilterCategory>(initialUi.category);
  const [searchQuery, setSearchQuery] = useState(initialUi.query);
  const [lastVisitedNotice, setLastVisitedNotice] = useState<string | null>(null);

  React.useEffect(() => {
    if (compact || typeof sessionStorage === 'undefined') return;
    try {
      sessionStorage.setItem(
        PORTALS_SESSION_KEY,
        JSON.stringify({ category: selectedCategory, query: searchQuery })
      );
    } catch {
      // ignore storage errors
    }
  }, [compact, selectedCategory, searchQuery]);

  const categoryCounts = useMemo(() => {
    const counts: Record<PortalFilterCategory, number> = {
      All: OFFICIAL_JOB_PORTALS.length,
      Government: 0,
      Bank: 0,
      Education: 0,
      Private: 0,
      International: 0,
      Remote: 0,
    };
    for (const portal of OFFICIAL_JOB_PORTALS) {
      counts[portal.category] += 1;
    }
    return counts;
  }, []);

  const filteredPortals = useMemo(
    () => filterOfficialPortals(OFFICIAL_JOB_PORTALS, selectedCategory, searchQuery),
    [selectedCategory, searchQuery]
  );

  const handleVisitWebsite = async (portal: OfficialJobPortalEntry) => {
    const result = await openOfficialPortalInNewTab(portal.url);
    if (result.opened) {
      const msg = bn
        ? `নতুন ট্যাবে খোলা হয়েছে: ${portal.name}`
        : `Opened in new tab: ${portal.name}`;
      setLastVisitedNotice(msg);
      showToast?.(msg);
      onPortalOpened?.(portal);
    } else {
      const errMsg = bn
        ? 'অনুমোদিত নয় এমন পোর্টাল লিংক ব্লক করা হয়েছে।'
        : result.error || 'Unable to open portal URL.';
      setLastVisitedNotice(errMsg);
      showToast?.(errMsg);
    }
  };

  const allCategoryOptions: PortalFilterCategory[] = ['All', ...OFFICIAL_PORTAL_CATEGORIES];

  return (
    <div className={compact ? 'space-y-4' : 'space-y-5'} data-testid="official-portals-directory">
      {/* Privacy & Safe Navigation Banner */}
      <div className="bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-900 dark:text-emerald-200">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>
            {bn
              ? 'সবগুলো লিংক পূর্বনির্ধারিত HTTPS পোর্টাল। কোনো ব্যক্তিগত প্রোফাইল তথ্য স্বয়ংক্রিয়ভাবে পাঠানো হয় না এবং সব ওয়েবসাইট নতুন ট্যাবে খোলে।'
              : 'All links use verified HTTPS official portals. Zero profile data is auto-sent, and every website opens safely in a new tab.'}
          </span>
        </div>
        {lastVisitedNotice && (
          <span
            role="status"
            className="text-[11px] font-bold bg-white/80 dark:bg-slate-900/80 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800"
          >
            {lastVisitedNotice}
          </span>
        )}
      </div>

      {/* Search & Category Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              data-testid="portal-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                bn
                  ? 'পোর্টালের নাম, বিভাগ বা ডোমেইন দিয়ে খুঁজুন (যেমন: BPSC, Bank, NTRCA, Remote)...'
                  : 'Search portals by name, domain, or category (e.g. BPSC, Bank, NTRCA, Remote)...'
              }
              aria-label={bn ? 'অফিশিয়াল জব পোর্টাল খুঁজুন' : 'Search Official Job Portals'}
              className="w-full pl-10 pr-9 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-petro-500/30 focus:border-petro-500"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear portal search"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0 px-1">
            {bn
              ? `মোট ${filteredPortals.length}টি পোর্টাল প্রদর্শিত`
              : `Showing ${filteredPortals.length} of ${OFFICIAL_JOB_PORTALS.length} portals`}
          </div>
        </div>

        {/* Category Filter Buttons */}
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Portal Categories"
        >
          {allCategoryOptions.map((category) => {
            const active = selectedCategory === category;
            const label = bn
              ? OFFICIAL_PORTAL_CATEGORY_LABELS[category].bn
              : OFFICIAL_PORTAL_CATEGORY_LABELS[category].en;
            return (
              <button
                key={category}
                type="button"
                data-testid={`portal-category-${category}`}
                aria-pressed={active}
                onClick={() => setSelectedCategory(category)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  active
                    ? 'bg-petro-600 text-white border-petro-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {getCategoryIcon(category)}
                <span>{label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    active
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {categoryCounts[category]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Portal Grid or Empty State */}
      {filteredPortals.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 text-center space-y-3">
          <Globe className="w-8 h-8 text-slate-400 mx-auto" />
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {bn ? 'কোনো পোর্টাল পাওয়া যায়নি' : 'No matching job portals found'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {bn
                ? 'অন্য কোনো কীওয়ার্ড ব্যবহার করুন অথবা সব ক্যাটাগরি নির্বাচন করুন।'
                : 'Try adjusting your search query or reset filters to browse all 14 official portals.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('All');
              setSearchQuery('');
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-petro-600 hover:bg-petro-700 text-white cursor-pointer"
          >
            <span>{bn ? 'ফিল্টার রিসেট করুন' : 'Reset Filters'}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredPortals.map((portal) => (
            <PortalCard
              key={portal.id}
              portal={portal}
              bn={bn}
              onVisit={handleVisitWebsite}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const OfficialJobPortalsPage: React.FC = () => {
  const { language } = useApp();
  const bn = language === 'bn';

  return (
    <div className="space-y-5" data-testid="official-portals-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2.5">
            <span aria-hidden="true">🌐</span>
            <span>{bn ? 'অফিশিয়াল জব পোর্টালসমূহ' : 'Official Job Portals'}</span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-petro-100 dark:bg-petro-950/60 text-petro-700 dark:text-petro-300 border border-petro-200 dark:border-petro-800">
              {OFFICIAL_JOB_PORTALS.length} {bn ? 'টি সাইট' : 'Portals'}
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {bn
              ? 'বাংলাদেশ সরকারি, ব্যাংক, শিক্ষা, বেসরকারি এবং আন্তর্জাতিক রিমোট চাকরির নির্ভরযোগ্য পোর্টাল ডিরেক্টরি'
              : 'Direct quick-access directory of verified Bangladesh Government, Bank, Education, Private, and Global Remote recruitment websites'}
          </p>
        </div>
      </div>

      <OfficialJobPortalsDirectory />
    </div>
  );
};
