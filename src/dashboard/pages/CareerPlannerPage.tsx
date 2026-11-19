import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Compass,
  Target,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Info,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { CareerGoalItem, UserProfile } from '../../types/profile';
import type { NormalizedJobCircular } from '../../jobs/types/job.types';
import { JobRepository } from '../../jobs/database/job-repository';
import {
  CareerGoalRepository,
  analyzeSkillsGap,
  exploreCareerPaths,
} from '../../career/career-planner';

interface CareerPlannerPageProps {
  profile: UserProfile;
  onNavigateTab: (tab: any) => void;
  showToast: (msg: string) => void;
}

export const CareerPlannerPage: React.FC<CareerPlannerPageProps> = ({
  profile,
  onNavigateTab,
  showToast,
}) => {
  const { language } = useApp();
  const bn = language === 'bn';

  const [jobs, setJobs] = useState<NormalizedJobCircular[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [goals, setGoals] = useState<CareerGoalItem[]>([]);

  const [goalTitle, setGoalTitle] = useState('');
  const [goalArea, setGoalArea] = useState('');
  const [goalDate, setGoalDate] = useState('');

  const loadData = useCallback(async () => {
    const [jobList, savedGoals] = await Promise.all([
      JobRepository.getAllJobs().catch(() => []),
      CareerGoalRepository.getAll().catch(() => []),
    ]);
    const active = jobList.filter((j) => j.status !== 'expired');
    setJobs(active);
    if (active.length > 0 && !selectedJobId) setSelectedJobId(active[0].id);
    setGoals(savedGoals);
  }, [selectedJobId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const exploration = useMemo(() => exploreCareerPaths(profile), [profile]);
  const selectedJob = useMemo(
    () => jobs.find((j) => j.id === selectedJobId) || null,
    [jobs, selectedJobId]
  );
  const gapReport = useMemo(
    () => (selectedJob ? analyzeSkillsGap(profile, selectedJob) : null),
    [profile, selectedJob]
  );

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle.trim()) return;
    await CareerGoalRepository.save({
      id: `goal_${Date.now().toString(36)}`,
      title: goalTitle.trim(),
      targetArea: goalArea.trim() || 'Skill & Exam Prep',
      targetDate: goalDate || undefined,
      progressPercent: 0,
      completed: false,
    });
    setGoalTitle('');
    setGoalArea('');
    setGoalDate('');
    await loadData();
    showToast('✅ Career goal added');
  };

  const handleCreateGoalFromSkill = async (skill: string) => {
    await CareerGoalRepository.save({
      id: `goal_${Date.now().toString(36)}`,
      title: `Practice / Master: ${skill}`,
      targetArea: 'Skills Gap Closure',
      progressPercent: 10,
      completed: false,
    });
    await loadData();
    showToast(`✅ Added "${skill}" to Personal Career Goals`);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Compass className="w-5 h-5 text-petro-600" />
            <span>{bn ? 'ক্যারিয়ার প্ল্যানার ও স্কিলস গ্যাপ অ্যানালাইজার' : 'Career Path Planner & Skills Gap Analyzer'}</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Explore advisory career pathways, compare required circular skills vs your profile, and track personal learning goals.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigateTab('additional')}
          className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer"
        >
          Edit Skills &amp; Career Profile →
        </button>
      </div>

      {/* Section 1: Skills Gap Analyzer */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 text-xs shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="font-extrabold text-sm text-slate-800 dark:text-white flex items-center gap-2">
            <Target className="w-4 h-4 text-indigo-600" />
            <span>Skills Gap Analyzer (Circular vs Profile)</span>
          </div>
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 bg-slate-50 dark:bg-slate-800 font-semibold max-w-sm"
          >
            {jobs.length === 0 ? (
              <option value="">No circulars loaded yet</option>
            ) : (
              jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.organization} — {j.jobTitle}
                </option>
              ))
            )}
          </select>
        </div>

        {!gapReport ? (
          <div className="text-slate-500 py-4">
            Load circulars in Job Circulars Hub to compare circular requirements against your skills.
          </div>
        ) : gapReport.noExplicitSkillsListed ? (
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
            No specific technical/office skill keywords were extracted from this circular summary. Unlisted skills are never invented as mandatory.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 space-y-2">
              <div className="font-bold text-emerald-800 dark:text-emerald-300">
                Matched Skills ({gapReport.existingMatchedSkills.length})
              </div>
              {gapReport.existingMatchedSkills.length === 0 ? (
                <div className="text-slate-500">None matched yet in Skills &amp; Training profile.</div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {gapReport.existingMatchedSkills.map((sk) => (
                    <span key={sk} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white border border-emerald-300 text-emerald-800 font-semibold">
                      <CheckCircle2 className="w-3 h-3" /> {sk}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 space-y-2">
              <div className="font-bold text-amber-900 dark:text-amber-300">
                Skills Mentioned in Circular Not Listed in Your Profile ({gapReport.missingSkills.length})
              </div>
              {gapReport.missingSkills.length === 0 ? (
                <div className="text-emerald-700 font-semibold">All extracted circular skills appear in your profile.</div>
              ) : (
                <div className="space-y-1.5">
                  {gapReport.missingSkills.map((sk) => (
                    <div key={sk} className="flex items-center justify-between bg-white px-2.5 py-1 rounded border border-amber-200">
                      <span className="font-semibold text-slate-800">{sk}</span>
                      <button
                        type="button"
                        onClick={() => void handleCreateGoalFromSkill(sk)}
                        className="text-[10.5px] font-bold text-petro-700 hover:underline cursor-pointer"
                      >
                        + Add Learning Goal
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        {gapReport && (
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>{gapReport.disclaimer}</span>
          </div>
        )}
      </div>

      {/* Section 2: Career Path Explorer */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 text-xs shadow-xs">
        <div className="font-extrabold text-sm text-slate-800 dark:text-white">
          Advisory Career Path Suggestions
        </div>

        {!exploration.hasSufficientProfileData ? (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Profile Inputs Needed for Advisory Matching</div>
              <p className="mt-0.5">{exploration.guidanceNotice}</p>
            </div>
          </div>
        ) : exploration.paths.length === 0 ? (
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600">
            {exploration.guidanceNotice}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {exploration.paths.map((p) => (
              <div key={p.trackId} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Advisory Suggestion Only
                  </span>
                </div>
                <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">
                  {bn ? p.titleBn : p.titleEn}
                </h3>
                <div className="text-[11px] text-slate-500">
                  Matched Inputs: <strong>{p.matchedSignals.join(', ')}</strong>
                </div>
                <div>
                  <div className="font-bold text-slate-700 dark:text-slate-200 mb-1">Recommended Focus Areas:</div>
                  <ul className="list-disc list-inside text-slate-600 dark:text-slate-300 space-y-0.5">
                    {p.recommendedLearningAreas.map((area) => (
                      <li key={area}>{area}</li>
                    ))}
                  </ul>
                </div>
                <div className="text-[10.5px] text-slate-400 pt-1 border-t border-slate-100">{p.disclaimer}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 3: Personal Career Goals CRUD */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 text-xs shadow-xs">
        <div className="font-extrabold text-sm text-slate-800 dark:text-white">
          Personal Career Milestones &amp; Progress Tracker ({goals.length})
        </div>

        <form onSubmit={handleAddGoal} className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
          <input
            type="text"
            required
            value={goalTitle}
            onChange={(e) => setGoalTitle(e.target.value)}
            placeholder="Goal (e.g. Complete 500 Bangla MCQs)"
            className="sm:col-span-2 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 bg-white dark:bg-slate-800"
          />
          <input
            type="text"
            value={goalArea}
            onChange={(e) => setGoalArea(e.target.value)}
            placeholder="Category (e.g. BCS Prep / Excel)"
            className="border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 bg-white dark:bg-slate-800"
          />
          <div className="flex gap-1.5">
            <input
              type="date"
              value={goalDate}
              onChange={(e) => setGoalDate(e.target.value)}
              className="flex-1 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-2 bg-white dark:bg-slate-800"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-petro-600 text-white font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
        </form>

        {goals.length > 0 && (
          <div className="space-y-2">
            {goals.map((g) => (
              <div key={g.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className={`font-bold ${g.completed ? 'line-through text-slate-400' : 'text-slate-800 dark:text-white'}`}>
                    {g.title}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {g.targetArea} {g.targetDate ? `• Target: ${g.targetDate}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={10}
                    value={g.progressPercent}
                    onChange={async (e) => {
                      const pct = Number(e.target.value);
                      await CareerGoalRepository.save({
                        ...g,
                        progressPercent: pct,
                        completed: pct === 100,
                      });
                      await loadData();
                    }}
                    className="w-24 accent-petro-600"
                  />
                  <span className="font-mono font-bold w-9 text-right">{g.progressPercent}%</span>
                  <button
                    type="button"
                    onClick={async () => {
                      await CareerGoalRepository.remove(g.id);
                      await loadData();
                    }}
                    className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                    title="Delete Goal"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
