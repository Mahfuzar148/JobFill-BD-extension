import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Edit3,
  Download,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Bell,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { UserProfile } from '../../types/profile';
import { JobRepository } from '../../jobs/database/job-repository';
import { ApplicationRepository } from '../../jobs/database/application-repository';
import { getDocumentMetadataByProfile } from '../../services/indexedDB';
import {
  CalendarEventKind,
  CalendarEventRecord,
  CalendarRepository,
  DHAKA_TIMEZONE,
  buildUnifiedCalendarEvents,
  exportCalendarAsIcs,
  getDhakaTodayDateString,
} from '../../calendar/career-calendar';

interface CareerCalendarPageProps {
  profile: UserProfile;
  showToast: (msg: string) => void;
}

const KIND_LABELS: Record<CalendarEventKind, { en: string; bn: string; badgeClass: string }> = {
  deadline: { en: 'Deadline', bn: 'শেষ তারিখ', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' },
  exam: { en: 'Exam Date', bn: 'পরীক্ষার তারিখ', badgeClass: 'bg-amber-50 text-amber-800 border-amber-200' },
  interview: { en: 'Interview', bn: 'ভাইভা / সাক্ষাৎকার', badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
  admit_card: { en: 'Admit Card', bn: 'প্রবেশপত্র', badgeClass: 'bg-cyan-50 text-cyan-800 border-cyan-200' },
  result: { en: 'Result', bn: 'ফলাফল', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  fee_deadline: { en: 'Fee Due', bn: 'ফি পরিশোধ', badgeClass: 'bg-orange-50 text-orange-800 border-orange-200' },
  document_expiry: { en: 'Doc Expiry', bn: 'সনদ মেয়াদ', badgeClass: 'bg-purple-50 text-purple-800 border-purple-200' },
  study_plan: { en: 'Study Plan', bn: 'পড়াশোনার রুটিন', badgeClass: 'bg-sky-50 text-sky-700 border-sky-200' },
  custom_reminder: { en: 'Reminder', bn: 'কাস্টম রিমাইন্ডার', badgeClass: 'bg-slate-100 text-slate-700 border-slate-300' },
};

export const CareerCalendarPage: React.FC<CareerCalendarPageProps> = ({ profile, showToast }) => {
  const { language } = useApp();
  const bn = language === 'bn';

  const [events, setEvents] = useState<CalendarEventRecord[]>([]);
  const [filterKind, setFilterKind] = useState<CalendarEventKind | 'ALL'>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getDhakaTodayDateString().slice(0, 7));

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(getDhakaTodayDateString());
  const [time, setTime] = useState('');
  const [kind, setKind] = useState<CalendarEventKind>('study_plan');
  const [org, setOrg] = useState('');
  const [notes, setNotes] = useState('');
  const [verifiedDate, setVerifiedDate] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  const loadCalendar = useCallback(async () => {
    const [custom, jobs, apps, docs] = await Promise.all([
      CalendarRepository.getAll().catch(() => []),
      JobRepository.getAllJobs().catch(() => []),
      ApplicationRepository.getAll().catch(() => []),
      getDocumentMetadataByProfile(profile.id).catch(() => []),
    ]);
    setEvents(buildUnifiedCalendarEvents(custom, jobs, apps, docs));
  }, [profile.id]);

  useEffect(() => {
    void loadCalendar();
  }, [loadCalendar]);

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (filterKind !== 'ALL' && ev.kind !== filterKind) return false;
      if (selectedMonth && !ev.date.startsWith(selectedMonth)) return false;
      return true;
    });
  }, [events, filterKind, selectedMonth]);

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const saved = await CalendarRepository.save({
        id: editingId || undefined,
        title,
        date,
        time,
        kind,
        organization: org,
        verifiedDate,
        notes,
      });
      if (typeof chrome !== 'undefined' && chrome.alarms?.create && saved.date >= getDhakaTodayDateString()) {
        const triggerMs = new Date(`${saved.date}T${saved.time || '09:00'}:00+06:00`).getTime() - 24 * 3600_000;
        if (triggerMs > Date.now()) {
          chrome.alarms.create(`cal_rem_${saved.id}`, { when: triggerMs });
        }
      }
      setFormOpen(false);
      setEditingId(null);
      setTitle('');
      setNotes('');
      setOrg('');
      await loadCalendar();
      showToast(bn ? '📅 ক্যালেন্ডার ইভেন্ট সংরক্ষিত হয়েছে' : '📅 Calendar event saved (Asia/Dhaka)');
    } catch (err: any) {
      showToast(`⚠️ ${err?.message || 'Could not save event'}`);
    }
  };

  const handleDeleteEvent = async (ev: CalendarEventRecord) => {
    if (ev.isAutoDerived) return;
    await CalendarRepository.remove(ev.id);
    if (typeof chrome !== 'undefined' && chrome.alarms?.clear) {
      chrome.alarms.clear(`cal_rem_${ev.id}`);
    }
    await loadCalendar();
    showToast(bn ? '🗑️ ইভেন্ট মুছে ফেলা হয়েছে' : '🗑️ Event deleted');
  };

  const handleExportIcs = () => {
    const ics = exportCalendarAsIcs(filteredEvents);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jobfill-career-calendar-${selectedMonth}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📅 Exported ICS calendar');
  };

  const todayDhaka = getDhakaTodayDateString();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-petro-600" />
            <span>{bn ? 'ক্যারিয়ার ও পরীক্ষা ক্যালেন্ডার' : 'Career & Exam Calendar'}</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {bn
              ? `আবেদনের শেষ তারিখ, পরীক্ষা, ভাইভা, সনদ মেয়াদ ও পড়াশোনার রুটিন (${DHAKA_TIMEZONE} সময়)।`
              : `Unified deadlines, exams, interviews, document expiries & study plans (${DHAKA_TIMEZONE} timezone).`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleExportIcs}
            disabled={filteredEvents.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export .ICS</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setTitle('');
              setDate(todayDhaka);
              setKind('study_plan');
              setVerifiedDate(true);
              setFormOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-petro-600 hover:bg-petro-700 text-white shadow cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{bn ? 'নতুন ইভেন্ট / রিমাইন্ডার' : 'Add Study / Reminder'}</span>
          </button>
        </div>
      </div>

      {/* Filters & Browser Alarm Caveat */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <label className="font-semibold text-slate-600 dark:text-slate-300">Month:</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800"
          />
          <button
            type="button"
            onClick={() => setSelectedMonth('')}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold cursor-pointer"
          >
            All Months
          </button>

          <select
            value={filterKind}
            onChange={(e) => setFilterKind(e.target.value as CalendarEventKind | 'ALL')}
            className="border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 font-semibold"
          >
            <option value="ALL">All Types ({events.length})</option>
            {(Object.keys(KIND_LABELS) as CalendarEventKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k].en}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300">
          <Bell className="w-3.5 h-3.5 shrink-0" />
          <span>Browser alarms may delay if Chrome/Edge is closed or device sleeps.</span>
        </div>
      </div>

      {/* Event List */}
      {filteredEvents.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center space-y-2">
          <CalendarIcon className="w-10 h-10 text-slate-300 mx-auto" />
          <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
            {bn ? 'এই সময়ে কোনো ইভেন্ট নেই' : 'No events in selected view'}
          </div>
          <p className="text-xs text-slate-500">
            Circular deadlines, exam dates from Application Tracker, and your custom study plans appear automatically here without duplicates.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredEvents.map((ev) => {
            const meta = KIND_LABELS[ev.kind];
            const isPast = ev.date < todayDhaka;
            return (
              <div
                key={ev.id}
                className={`bg-white dark:bg-slate-900 rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isPast ? 'border-slate-200 opacity-75' : 'border-slate-200 dark:border-slate-800 shadow-xs'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10.5px] font-bold px-2.5 py-0.5 rounded-full border ${meta.badgeClass}`}>
                      {bn ? meta.bn : meta.en}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-100">
                      {ev.date} {ev.time ? `• ${ev.time} (BD)` : ''}
                    </span>
                    {ev.verifiedDate ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                        <CheckCircle2 className="w-3 h-3" /> Confirmed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                        <AlertTriangle className="w-3 h-3" /> Unverified Date
                      </span>
                    )}
                    {ev.isAutoDerived && (
                      <span className="text-[10px] text-slate-400">Auto-linked</span>
                    )}
                  </div>
                  <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">{ev.title}</h3>
                  {(ev.organization || ev.notes) && (
                    <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                      {ev.organization && <span>🏢 {ev.organization}</span>}
                      {ev.notes && <span>📝 {ev.notes}</span>}
                    </div>
                  )}
                </div>

                {!ev.isAutoDerived && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(ev.id);
                        setTitle(ev.title);
                        setDate(ev.date);
                        setTime(ev.time || '');
                        setKind(ev.kind);
                        setOrg(ev.organization || '');
                        setNotes(ev.notes || '');
                        setVerifiedDate(ev.verifiedDate);
                        setFormOpen(true);
                      }}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                      title="Edit Event"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteEvent(ev)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 cursor-pointer"
                      title="Delete Event"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEvent}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md shadow-2xl overflow-hidden text-xs"
          >
            <div className="px-5 py-3.5 bg-petro-700 text-white font-bold text-sm flex items-center justify-between">
              <span>{editingId ? 'Edit Calendar Event' : 'Add Career / Study Event'}</span>
              <button type="button" onClick={() => setFormOpen(false)} className="cursor-pointer">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block font-semibold mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. BCS Bangla Revision / BPDB Viva"
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 bg-white dark:bg-slate-800"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold mb-1">Date (Asia/Dhaka) *</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Time (Optional)</label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold mb-1">Event Type</label>
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value as CalendarEventKind)}
                    className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 bg-white dark:bg-slate-800"
                  >
                    <option value="study_plan">Study Plan</option>
                    <option value="exam">Exam Date</option>
                    <option value="interview">Interview / Viva</option>
                    <option value="admit_card">Admit Card</option>
                    <option value="result">Result</option>
                    <option value="deadline">Deadline</option>
                    <option value="custom_reminder">Custom Reminder</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Organization (Optional)</label>
                  <input
                    type="text"
                    value={org}
                    onChange={(e) => setOrg(e.target.value)}
                    className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={verifiedDate}
                  onChange={(e) => setVerifiedDate(e.target.checked)}
                  className="accent-petro-600"
                />
                <span>Official / verified date (uncheck for tentative date)</span>
              </label>
              <div>
                <label className="block font-semibold mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 bg-white dark:bg-slate-800"
                />
              </div>
            </div>
            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800 flex justify-end gap-2">
              <button type="button" onClick={() => setFormOpen(false)} className="px-3 py-1.5 rounded-lg border border-slate-300">Cancel</button>
              <button type="submit" className="px-4 py-1.5 rounded-lg bg-petro-600 text-white font-bold cursor-pointer flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Save Event
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
