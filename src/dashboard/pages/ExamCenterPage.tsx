import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Clock,
  CheckCircle2,
  XCircle,
  Bookmark,
  BarChart3,
  Languages,
  Mic,
  Plus,
  Info,
  Calendar,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  ALL_EXAM_SUBJECTS,
  CURATED_PRACTICE_QUESTIONS,
  ExamAttemptRecord,
  ExamRepository,
  ExamSubject,
  computeExamAnalytics,
} from '../../exam/exam-practice-bank';
import {
  VocabularyRepository,
  VocabularyWordRecord,
  getDueRevisionWords,
} from '../../exam/vocabulary-service';
import {
  INTERVIEW_QUESTION_GUIDES,
  InterviewNoteRecord,
  InterviewPrepRepository,
} from '../../career/interview-prep';
import { CalendarRepository, getDhakaTodayDateString } from '../../calendar/career-calendar';

interface ExamCenterPageProps {
  showToast: (msg: string) => void;
}

type StudyTab = 'mcq' | 'analytics' | 'vocabulary' | 'interview';

export const ExamCenterPage: React.FC<ExamCenterPageProps> = ({ showToast }) => {
  const { language } = useApp();
  const bn = language === 'bn';

  const [subTab, setSubTab] = useState<StudyTab>('mcq');

  // --- MCQ & Mock Exam State ---
  const [selectedSubject, setSelectedSubject] = useState<ExamSubject | 'All' | 'Bookmarked'>('Bangla');
  const [examMode, setExamMode] = useState<'topic_practice' | 'timed_mock'>('topic_practice');
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [submittedExam, setSubmittedExam] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [attempts, setAttempts] = useState<ExamAttemptRecord[]>([]);
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);

  // --- Vocabulary State ---
  const [words, setWords] = useState<VocabularyWordRecord[]>([]);
  const [vocabSearch, setVocabSearch] = useState('');
  const [vocabMode, setVocabMode] = useState<'browse' | 'due_review' | 'quiz'>('browse');
  const [newWord, setNewWord] = useState('');
  const [newMeaningBn, setNewMeaningBn] = useState('');
  const [newDefEn, setNewDefEn] = useState('');
  const [newExample, setNewExample] = useState('');
  const [quizAnswerMap, setQuizAnswerMap] = useState<Record<string, string>>({});

  // --- Interview Prep State ---
  const [ivNotes, setIvNotes] = useState<Record<string, InterviewNoteRecord>>({});
  const [ivDrafts, setIvDrafts] = useState<Record<string, string>>({});
  const [ivTimerSec, setIvTimerSec] = useState(0);
  const [ivTimerRunning, setIvTimerRunning] = useState(false);
  const [ivReminderDate, setIvReminderDate] = useState(getDhakaTodayDateString());
  const [ivReminderTitle, setIvReminderTitle] = useState('Mock Viva / Interview Session');

  const loadAllStudyData = useCallback(async () => {
    const [attList, bmIds, vocabList, noteMap] = await Promise.all([
      ExamRepository.getAttempts().catch(() => [] as ExamAttemptRecord[]),
      ExamRepository.getBookmarkedQuestionIds().catch(() => [] as string[]),
      VocabularyRepository.getAll().catch(() => [] as VocabularyWordRecord[]),
      InterviewPrepRepository.getNotes().catch((): Record<string, InterviewNoteRecord> => ({})),
    ]);
    setAttempts(attList);
    setBookmarkedIds(bmIds);
    setWords(vocabList);
    setIvNotes(noteMap);
    const initialDrafts: Record<string, string> = {};
    for (const g of INTERVIEW_QUESTION_GUIDES) {
      initialDrafts[g.id] = noteMap[`iv_note_${g.id}`]?.userDraftAnswer || '';
    }
    setIvDrafts(initialDrafts);
  }, []);

  useEffect(() => {
    void loadAllStudyData();
  }, [loadAllStudyData]);

  // Timed Mock timer
  useEffect(() => {
    if (subTab !== 'mcq' || examMode !== 'timed_mock' || submittedExam) return;
    const t = window.setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [subTab, examMode, submittedExam]);

  // Interview 90s mock timer
  useEffect(() => {
    if (!ivTimerRunning) return;
    const t = window.setInterval(() => setIvTimerSec((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [ivTimerRunning]);

  const activeQuestions = useMemo(() => {
    if (selectedSubject === 'All') return CURATED_PRACTICE_QUESTIONS;
    if (selectedSubject === 'Bookmarked') {
      return CURATED_PRACTICE_QUESTIONS.filter((q) => bookmarkedIds.includes(q.id));
    }
    return CURATED_PRACTICE_QUESTIONS.filter((q) => q.subject === selectedSubject);
  }, [selectedSubject, bookmarkedIds]);

  const analytics = useMemo(() => computeExamAnalytics(attempts), [attempts]);
  const dueWords = useMemo(() => getDueRevisionWords(words), [words]);

  const filteredWords = useMemo(() => {
    const base = vocabMode === 'due_review' ? dueWords : words;
    const q = vocabSearch.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (w) =>
        w.word.toLowerCase().includes(q) ||
        w.meaningBn.toLowerCase().includes(q) ||
        w.definitionEn.toLowerCase().includes(q)
    );
  }, [words, dueWords, vocabMode, vocabSearch]);

  const handleSubmitExam = async () => {
    if (activeQuestions.length === 0) return;
    let correct = 0;
    const weakTopicSet = new Set<string>();
    for (const q of activeQuestions) {
      if (selectedAnswers[q.id] === q.correctIndex) {
        correct += 1;
      } else {
        weakTopicSet.add(q.topic);
      }
    }
    const total = activeQuestions.length;
    const acc = Math.round((correct / total) * 100);
    await ExamRepository.saveAttempt({
      id: `att_${Date.now().toString(36)}`,
      subject: selectedSubject === 'All' || selectedSubject === 'Bookmarked' ? 'Mixed Mock' : selectedSubject,
      mode: examMode,
      totalQuestions: total,
      correctCount: correct,
      incorrectCount: total - correct,
      accuracyPercent: acc,
      durationSeconds: elapsedSeconds,
      weakTopics: Array.from(weakTopicSet),
      completedAt: new Date().toISOString(),
    });
    setSubmittedExam(true);
    await loadAllStudyData();
    showToast(`✅ Scored ${correct}/${total} (${acc}%)`);
  };

  const handleResetQuiz = () => {
    setSelectedAnswers({});
    setSubmittedExam(false);
    setElapsedSeconds(0);
  };

  const handleAddVocab = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await VocabularyRepository.saveWord({
        id: `voc_u_${Date.now().toString(36)}`,
        word: newWord,
        meaningBn: newMeaningBn,
        definitionEn: newDefEn,
        synonyms: [],
        antonyms: [],
        exampleSentence: newExample,
        saved: true,
        reviewCount: 0,
        intervalDays: 1,
        nextReviewAt: 0,
        isCustomUserWord: true,
      });
      setNewWord('');
      setNewMeaningBn('');
      setNewDefEn('');
      setNewExample('');
      await loadAllStudyData();
      showToast('✅ Vocabulary word added');
    } catch (err: any) {
      showToast(`⚠️ ${err?.message || 'Error saving word'}`);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-petro-600" />
            <span>{bn ? 'পরীক্ষা প্রস্তুতি ও শব্দভাণ্ডার কেন্দ্র' : 'Exam Practice, Vocabulary & Viva Center'}</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            MCQ &amp; Timed Mock Practice across 8 BD job subjects, Performance Analytics, Spaced Repetition Vocabulary &amp; Viva Prep.
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <button
            type="button"
            onClick={() => setSubTab('mcq')}
            className={`px-3 py-1.5 rounded-xl font-bold border cursor-pointer ${
              subTab === 'mcq' ? 'bg-petro-600 text-white border-petro-700' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
            }`}
          >
            MCQ &amp; Mock Exam
          </button>
          <button
            type="button"
            onClick={() => setSubTab('analytics')}
            className={`px-3 py-1.5 rounded-xl font-bold border cursor-pointer inline-flex items-center gap-1 ${
              subTab === 'analytics' ? 'bg-petro-600 text-white border-petro-700' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" /> Analytics ({attempts.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('vocabulary')}
            className={`px-3 py-1.5 rounded-xl font-bold border cursor-pointer inline-flex items-center gap-1 ${
              subTab === 'vocabulary' ? 'bg-petro-600 text-white border-petro-700' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
            }`}
          >
            <Languages className="w-3.5 h-3.5" /> Vocabulary ({dueWords.length} due)
          </button>
          <button
            type="button"
            onClick={() => setSubTab('interview')}
            className={`px-3 py-1.5 rounded-xl font-bold border cursor-pointer inline-flex items-center gap-1 ${
              subTab === 'interview' ? 'bg-petro-600 text-white border-petro-700' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
            }`}
          >
            <Mic className="w-3.5 h-3.5" /> Interview Prep
          </button>
        </div>
      </div>

      {/* TAB 1: MCQ & TIMED MOCK */}
      {subTab === 'mcq' && (
        <div className="space-y-4 text-xs">
          <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-xl p-3 text-sky-900 dark:text-sky-200 flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0 text-sky-600" />
            <span>
              <strong>Content Source Transparency:</strong> Questions below belong to JobFill BD’s Curated Study Practice Bank — explicitly authored practice material, not official BPSC or University previous-year papers.
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedSubject}
                onChange={(e) => {
                  setSelectedSubject(e.target.value as any);
                  handleResetQuiz();
                }}
                className="border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 font-bold bg-slate-50 dark:bg-slate-800"
              >
                {ALL_EXAM_SUBJECTS.map((subj) => (
                  <option key={subj} value={subj}>{subj}</option>
                ))}
                <option value="All">All 8 Subjects (Mixed Mock)</option>
                <option value="Bookmarked">Bookmarked Questions ({bookmarkedIds.length})</option>
              </select>

              <button
                type="button"
                onClick={() => {
                  setExamMode(examMode === 'topic_practice' ? 'timed_mock' : 'topic_practice');
                  handleResetQuiz();
                }}
                className={`px-3 py-1.5 rounded-xl font-bold border cursor-pointer ${
                  examMode === 'timed_mock' ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-white border-slate-300 text-slate-700'
                }`}
              >
                {examMode === 'timed_mock' ? 'Mode: Timed Mock Exam' : 'Mode: Topic Practice'}
              </button>
            </div>

            <div className="flex items-center gap-2">
              {examMode === 'timed_mock' && (
                <span className="font-mono font-bold px-2.5 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> {Math.floor(elapsedSeconds / 60)}m {elapsedSeconds % 60}s
                </span>
              )}
              {submittedExam ? (
                <button
                  type="button"
                  onClick={handleResetQuiz}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-white font-bold cursor-pointer"
                >
                  Retry Practice
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleSubmitExam()}
                  disabled={activeQuestions.length === 0}
                  className="px-4 py-1.5 rounded-xl bg-petro-600 hover:bg-petro-700 text-white font-bold cursor-pointer disabled:opacity-50"
                >
                  Submit &amp; Check Answers ({activeQuestions.length})
                </button>
              )}
            </div>
          </div>

          {activeQuestions.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-dashed text-center text-slate-500">
              No questions in this filter (bookmark questions first to practice bookmarked items).
            </div>
          ) : (
            <div className="space-y-3">
              {activeQuestions.map((q, idx) => {
                const chosen = selectedAnswers[q.id];
                const isBm = bookmarkedIds.includes(q.id);
                return (
                  <div key={q.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-petro-700">{q.subject}</span>
                        <span className="text-slate-400">• {q.topic}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">Practice Bank</span>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const next = await ExamRepository.toggleBookmarkQuestion(q.id);
                          setBookmarkedIds(next);
                        }}
                        title="Bookmark Question"
                        className={`p-1 rounded cursor-pointer ${isBm ? 'text-amber-500' : 'text-slate-400'}`}
                      >
                        <Bookmark className="w-4 h-4" fill={isBm ? 'currentColor' : 'none'} />
                      </button>
                    </div>

                    <div className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {idx + 1}. {q.questionText}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.options.map((opt, optIdx) => {
                        const selected = chosen === optIdx;
                        const isCorrect = optIdx === q.correctIndex;
                        let cls = 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800';
                        if (submittedExam) {
                          if (isCorrect) cls = 'border-emerald-400 bg-emerald-50 text-emerald-900 font-bold';
                          else if (selected && !isCorrect) cls = 'border-rose-400 bg-rose-50 text-rose-900';
                        } else if (selected) {
                          cls = 'border-petro-600 bg-petro-50 text-petro-900 font-bold';
                        }
                        return (
                          <button
                            key={optIdx}
                            type="button"
                            disabled={submittedExam}
                            onClick={() => setSelectedAnswers((prev) => ({ ...prev, [q.id]: optIdx }))}
                            className={`text-left px-3 py-2 rounded-xl border cursor-pointer flex items-center justify-between ${cls}`}
                          >
                            <span>{String.fromCharCode(65 + optIdx)}. {opt}</span>
                            {submittedExam && isCorrect && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                            {submittedExam && selected && !isCorrect && <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>

                    {submittedExam && (
                      <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                        <strong>Explanation:</strong> {q.explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ANALYTICS */}
      {subTab === 'analytics' && (
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="text-slate-500 font-semibold">Total Practice Attempts</div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{analytics.totalAttempts}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="text-slate-500 font-semibold">Overall Accuracy</div>
              <div className="text-2xl font-black text-petro-600 mt-1">{analytics.overallAccuracyPercent}%</div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="text-slate-500 font-semibold">Subjects Below 65%</div>
              <div className="text-2xl font-black text-amber-600 mt-1">{analytics.weakSubjects.length}</div>
            </div>
          </div>

          {analytics.bySubject.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-dashed text-center text-slate-500">
              Complete at least one MCQ quiz to see real subject-wise performance analytics.
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="font-bold text-sm">Subject-wise Accuracy Breakdown</div>
              {analytics.bySubject.map((s) => (
                <div key={s.subject} className="space-y-1">
                  <div className="flex justify-between font-semibold">
                    <span>{s.subject} ({s.correctCount}/{s.totalQuestions} correct)</span>
                    <span className={s.isWeakSubject ? 'text-amber-600' : 'text-emerald-600'}>
                      {s.accuracyPercent}% {s.isWeakSubject ? '• Needs Revision' : ''}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-petro-600" style={{ width: `${s.accuracyPercent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: VOCABULARY & SPACED REPETITION */}
      {subTab === 'vocabulary' && (
        <div className="space-y-4 text-xs">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setVocabMode('browse')}
                className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${vocabMode === 'browse' ? 'bg-petro-600 text-white' : 'bg-slate-100 text-slate-700'}`}
              >
                All Words ({words.length})
              </button>
              <button
                type="button"
                onClick={() => setVocabMode('due_review')}
                className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${vocabMode === 'due_review' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700'}`}
              >
                Daily Due Revision ({dueWords.length})
              </button>
              <button
                type="button"
                onClick={() => setVocabMode('quiz')}
                className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${vocabMode === 'quiz' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}
              >
                Meaning Quiz
              </button>
            </div>
            <input
              type="text"
              value={vocabSearch}
              onChange={(e) => setVocabSearch(e.target.value)}
              placeholder="Search English or Bengali word..."
              className="border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 bg-slate-50 dark:bg-slate-800 min-w-[210px]"
            />
          </div>

          <form onSubmit={handleAddVocab} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-5 gap-2">
            <input type="text" required value={newWord} onChange={(e) => setNewWord(e.target.value)} placeholder="English Word *" className="border rounded-lg px-2.5 py-1.5" />
            <input type="text" required value={newMeaningBn} onChange={(e) => setNewMeaningBn(e.target.value)} placeholder="বাংলা অর্থ *" className="border rounded-lg px-2.5 py-1.5" />
            <input type="text" value={newDefEn} onChange={(e) => setNewDefEn(e.target.value)} placeholder="English definition" className="border rounded-lg px-2.5 py-1.5" />
            <input type="text" value={newExample} onChange={(e) => setNewExample(e.target.value)} placeholder="Example sentence" className="border rounded-lg px-2.5 py-1.5" />
            <button type="submit" className="inline-flex items-center justify-center gap-1 rounded-lg bg-petro-600 text-white font-bold px-3 py-1.5 cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> Add Word
            </button>
          </form>

          {vocabMode === 'quiz' ? (
            <div className="space-y-3">
              {words.slice(0, 5).map((w) => {
                const chosen = quizAnswerMap[w.id];
                const distractors = words.filter((o) => o.id !== w.id).slice(0, 2).map((o) => o.meaningBn);
                const opts = [w.meaningBn, ...distractors];
                return (
                  <div key={w.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border space-y-2">
                    <div className="font-extrabold text-sm">What is the Bengali meaning of "{w.word}"?</div>
                    <div className="flex flex-wrap gap-2">
                      {opts.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setQuizAnswerMap((prev) => ({ ...prev, [w.id]: opt }))}
                          className={`px-3 py-1.5 rounded-lg border cursor-pointer font-semibold ${
                            chosen === opt
                              ? opt === w.meaningBn
                                ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                                : 'bg-rose-50 border-rose-400 text-rose-800'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredWords.map((w) => (
                <div key={w.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-base font-black text-slate-900 dark:text-white">{w.word}</div>
                    <span className="font-bold text-petro-700 bg-petro-50 px-2 py-0.5 rounded-full">{w.meaningBn}</span>
                  </div>
                  <div className="text-slate-600 dark:text-slate-300">{w.definitionEn}</div>
                  {w.synonyms.length > 0 && <div className="text-[11px] text-slate-500"><strong>Synonyms:</strong> {w.synonyms.join(', ')} | <strong>Antonyms:</strong> {w.antonyms.join(', ')}</div>}
                  {w.exampleSentence && <div className="text-[11px] italic text-slate-500">"{w.exampleSentence}"</div>}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[10.5px] text-slate-400">Interval: {w.intervalDays}d • Reviews: {w.reviewCount}</span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={async () => {
                          await VocabularyRepository.recordReview(w.id, false);
                          await loadAllStudyData();
                        }}
                        className="px-2 py-1 rounded bg-amber-50 text-amber-800 font-semibold cursor-pointer"
                      >
                        Review Again (1d)
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await VocabularyRepository.recordReview(w.id, true);
                          await loadAllStudyData();
                        }}
                        className="px-2 py-1 rounded bg-emerald-50 text-emerald-800 font-semibold cursor-pointer"
                      >
                        Remembered ✓
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: INTERVIEW PREP */}
      {subTab === 'interview' && (
        <div className="space-y-4 text-xs">
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-amber-900 dark:text-amber-200 flex items-center justify-between flex-wrap gap-2">
            <span>
              <strong>Sample Guide Notice:</strong> Prompts &amp; suggested answer outlines below are preparation examples only — never guaranteed live viva questions.
            </span>
            <div className="flex items-center gap-2 font-mono font-bold">
              <span>Mock Timer: {Math.floor(ivTimerSec / 60)}m {ivTimerSec % 60}s</span>
              <button
                type="button"
                onClick={() => setIvTimerRunning(!ivTimerRunning)}
                className="px-2.5 py-1 rounded bg-amber-600 text-white cursor-pointer"
              >
                {ivTimerRunning ? 'Pause' : 'Start Practice'}
              </button>
              <button
                type="button"
                onClick={() => { setIvTimerRunning(false); setIvTimerSec(0); }}
                className="px-2 py-1 rounded bg-white border border-amber-300 text-amber-900 cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2">
            <Calendar className="w-4 h-4 text-petro-600" />
            <span className="font-bold">Add Interview Date to Career Calendar:</span>
            <input type="text" value={ivReminderTitle} onChange={(e) => setIvReminderTitle(e.target.value)} className="border rounded-lg px-2.5 py-1.5 flex-1 min-w-[180px]" />
            <input type="date" value={ivReminderDate} onChange={(e) => setIvReminderDate(e.target.value)} className="border rounded-lg px-2.5 py-1.5" />
            <button
              type="button"
              onClick={async () => {
                await CalendarRepository.save({
                  title: ivReminderTitle,
                  date: ivReminderDate,
                  kind: 'interview',
                  verifiedDate: true,
                });
                showToast('📅 Interview reminder added to Career Calendar');
              }}
              className="px-3 py-1.5 rounded-lg bg-petro-600 text-white font-bold cursor-pointer"
            >
              Add to Calendar
            </button>
          </div>

          <div className="space-y-3">
            {INTERVIEW_QUESTION_GUIDES.map((g) => (
              <div key={g.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">{g.category}</span>
                  <span className="text-[10px] text-slate-400">Sample Guide • Save Your Personal Notes Below</span>
                </div>
                <div className="font-extrabold text-sm text-slate-900 dark:text-white">{g.question}</div>
                <div className="text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg">
                  <strong>Suggested Outline:</strong> {g.sampleGuide}
                </div>
                <textarea
                  rows={2}
                  value={ivDrafts[g.id] ?? ''}
                  onChange={(e) => setIvDrafts((prev) => ({ ...prev, [g.id]: e.target.value }))}
                  placeholder="Write your personalized answer draft or bullet points here..."
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">
                    {ivNotes[`iv_note_${g.id}`] ? `Saved: ${new Date(ivNotes[`iv_note_${g.id}`].updatedAt).toLocaleString()}` : 'Not saved yet'}
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      await InterviewPrepRepository.saveNote(g.id, g.question, ivDrafts[g.id] || '');
                      await loadAllStudyData();
                      showToast('✅ Answer note saved locally');
                    }}
                    className="px-3 py-1 rounded-lg bg-slate-800 text-white font-bold cursor-pointer"
                  >
                    Save Answer Note
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
