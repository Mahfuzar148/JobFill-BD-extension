import React from 'react';
import {
  LayoutDashboard,
  User,
  Users,
  Home,
  GraduationCap,
  Award,
  Briefcase,
  FileText,
  Sliders,
  ShieldCheck,
  CheckCircle,
  Sparkles,
  Bookmark,
  History,
  Settings,
  HelpCircle,
  Megaphone,
  Bell,
  ClipboardList,
  Search,
  Building2,
  Globe,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export type DashboardTab =
  | 'overview'
  | 'search'
  | 'circulars'
  | 'govt_orgs'
  | 'portals'
  | 'notifications'
  | 'tracker'
  | 'personal'
  | 'family'
  | 'address'
  | 'education'
  | 'additional'
  | 'experience'
  | 'documents'
  | 'autofill'
  | 'mappings'
  | 'history'
  | 'preferences'
  | 'security'
  | 'settings'
  | 'help';

interface SidebarProps {
  activeTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
  completionScore: number;
  unreadNotificationsCount?: number;
  closingSoonCount?: number;
}

interface NavItem {
  id: DashboardTab;
  labelEn: string;
  labelBn: string;
  icon: any;
  badge?: string;
}

interface NavGroup {
  groupEn: string;
  groupBn: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  completionScore,
  unreadNotificationsCount = 0,
  closingSoonCount = 0,
}) => {
  const { language } = useApp();

  const navGroups: NavGroup[] = [
    {
      groupEn: 'OVERVIEW',
      groupBn: 'সারসংক্ষেপ',
      items: [
        { id: 'overview', labelEn: 'Dashboard', labelBn: 'ড্যাশবোর্ড', icon: LayoutDashboard },
      ],
    },
    {
      groupEn: 'JOB CIRCULAR HUB',
      groupBn: 'জব সার্কুলার হাব',
      items: [
        {
          id: 'search',
          labelEn: 'Job Search',
          labelBn: 'জব সার্চ',
          icon: Search,
        },
        {
          id: 'circulars',
          labelEn: 'Job Circulars',
          labelBn: 'জব সার্কুলার',
          icon: Megaphone,
          badge: closingSoonCount > 0 ? `${closingSoonCount} Soon` : 'New',
        },
        {
          id: 'govt_orgs',
          labelEn: 'Govt Organizations',
          labelBn: 'সরকারি প্রতিষ্ঠান',
          icon: Building2,
        },
        {
          id: 'portals',
          labelEn: '🌐 Official Job Portals',
          labelBn: '🌐 Official Job Portals',
          icon: Globe,
        },
        {
          id: 'notifications',
          labelEn: 'Notification Center',
          labelBn: 'নোটিফিকেশন সেন্টার',
          icon: Bell,
          badge: unreadNotificationsCount > 0 ? String(unreadNotificationsCount) : undefined,
        },
        {
          id: 'tracker',
          labelEn: 'Application Tracker',
          labelBn: 'আবেদন ট্র্যাকার',
          icon: ClipboardList,
        },
      ],
    },
    {
      groupEn: 'PROFILE DATABASE',
      groupBn: 'প্রোফাইল তথ্যভাণ্ডার',
      items: [
        { id: 'personal', labelEn: 'Personal Info', labelBn: 'ব্যক্তিগত তথ্য', icon: User },
        { id: 'family', labelEn: 'Family Info', labelBn: 'পারিবারিক তথ্য', icon: Users },
        { id: 'address', labelEn: 'Address Details', labelBn: 'ঠিকানার বিবরণ', icon: Home },
        { id: 'education', labelEn: 'Education Records', labelBn: 'শিক্ষাগত যোগ্যতা', icon: GraduationCap },
        { id: 'additional', labelEn: 'Skills & Training', labelBn: 'দক্ষতা ও প্রশিক্ষণ', icon: Award },
        { id: 'experience', labelEn: 'Job Experience', labelBn: 'চাকরির অভিজ্ঞতা', icon: Briefcase },
        { id: 'documents', labelEn: 'Documents & Photos', labelBn: 'ছবি ও সনদপত্র', icon: FileText },
      ],
    },
    {
      groupEn: 'AUTOMATION ENGINE',
      groupBn: 'অটোমেশন ইঞ্জিন',
      items: [
        { id: 'autofill', labelEn: 'Smart Auto Fill', labelBn: 'স্মার্ট অটো-ফিল', icon: Sparkles, badge: '5-Layer' },
        { id: 'mappings', labelEn: 'Saved Mappings', labelBn: 'সংরক্ষিত ম্যাপিং', icon: Bookmark },
        { id: 'history', labelEn: 'Application History', labelBn: 'আবেদনের হিস্ট্রি', icon: History },
      ],
    },
    {
      groupEn: 'PREFERENCES & SYSTEM',
      groupBn: 'পছন্দ ও সেটিংস',
      items: [
        { id: 'preferences', labelEn: 'Special & Preferences', labelBn: 'পছন্দক্রম ও কোটা', icon: Sliders },
        { id: 'security', labelEn: 'Security & Vault', labelBn: 'নিরাপত্তা ও ভল্ট', icon: ShieldCheck },
        { id: 'settings', labelEn: 'Settings', labelBn: 'সেটিংস', icon: Settings },
        { id: 'help', labelEn: 'Help & User Guide', labelBn: 'সাহায্য ও গাইড', icon: HelpCircle },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-navy-950 text-slate-100 flex flex-col border-r border-slate-800 select-none shrink-0">
      {/* Brand Logo & Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center gap-3 bg-gradient-to-r from-navy-950 to-navy-900">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-petro-600 to-emerald-500 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-petro-900/40 shrink-0">
          JB
        </div>
        <div className="min-w-0">
          <h1 className="font-extrabold text-sm tracking-wide text-white flex items-center gap-1.5 truncate">
            JobFill BD
            <span className="text-[9.5px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-mono font-bold">
              v2.0
            </span>
          </h1>
          <p className="text-[10px] text-slate-400 leading-tight truncate">
            Smart Bangladesh Job Assistant
          </p>
        </div>
      </div>

      {/* Profile Completion Meter */}
      <div className="p-3 mx-3 my-2.5 bg-slate-900/80 rounded-xl border border-slate-800">
        <div className="flex justify-between items-center text-xs mb-1.5">
          <span className="text-slate-300 font-semibold text-[11px]">
            {language === 'bn' ? 'প্রোফাইল প্রস্তুতি' : 'Profile Readiness'}
          </span>
          <span className="font-bold text-petro-400 font-mono text-xs">{completionScore}%</span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-petro-500 to-emerald-400 h-2 rounded-full transition-all duration-500"
            style={{ width: `${completionScore}%` }}
          />
        </div>
        <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
          <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
          <span className="truncate">
            {completionScore >= 80
              ? language === 'bn'
                ? 'আবেদনের জন্য প্রস্তুত'
                : 'Ready to auto-fill forms'
              : language === 'bn'
              ? 'সকল ফিল্ড পূরণ করুন'
              : 'Complete remaining fields'}
          </span>
        </p>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-1 space-y-4 overflow-y-auto custom-scrollbar">
        {navGroups.map((group, gIdx) => (
          <div key={gIdx} className="space-y-1">
            <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
              {language === 'bn' ? group.groupBn : group.groupEn}
            </div>

            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs font-semibold transition-all duration-150 group ${
                    isActive
                      ? 'bg-petro-600 text-white shadow-md shadow-petro-950/50'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-petro-400'
                    }`}
                  />
                  <div className="flex-1 min-w-0 truncate">
                    <div className="truncate leading-tight">
                      {language === 'bn' ? item.labelBn : item.labelEn}
                    </div>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-petro-900/60 text-petro-300 border border-petro-700/50'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer Local-First Notice */}
      <div
        className="p-2.5 text-center border-t border-slate-800/80 text-[10px] text-slate-400 bg-navy-950/90"
        title="Profile & documents stay local and encrypted; public job circular retrieval requires Internet access."
      >
        🔒 Local-First &amp; Locally Encrypted
      </div>
    </aside>
  );
};
