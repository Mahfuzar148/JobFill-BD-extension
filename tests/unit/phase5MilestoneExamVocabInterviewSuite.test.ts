import { describe, it, expect, beforeEach } from 'vitest';
import {
  ALL_EXAM_SUBJECTS,
  CURATED_PRACTICE_QUESTIONS,
  ExamRepository,
  computeExamAnalytics,
} from '../../src/exam/exam-practice-bank';
import {
  VocabularyRepository,
  getDueRevisionWords,
} from '../../src/exam/vocabulary-service';
import {
  INTERVIEW_QUESTION_GUIDES,
  InterviewPrepRepository,
} from '../../src/career/interview-prep';

describe('JobFill BD - Milestone 5: Exam Practice Center, Vocabulary Builder & Interview Prep', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('covers all 8 subjects with valid answer keys, explanations, and honest non-official-past-paper provenance', async () => {
    for (const subj of ALL_EXAM_SUBJECTS) {
      const qs = CURATED_PRACTICE_QUESTIONS.filter((q) => q.subject === subj);
      expect(qs.length).toBeGreaterThanOrEqual(2);
      for (const q of qs) {
        expect(q.options).toHaveLength(4);
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
        expect(q.correctIndex).toBeLessThanOrEqual(3);
        expect(q.explanation.length).toBeGreaterThan(10);
        expect(q.isOfficialPastPaper).toBe(false);
        expect(q.contentSource).toContain('Practice Material Only');
      }
    }

    await ExamRepository.saveAttempt({
      id: 'att_1',
      subject: 'English',
      mode: 'timed_mock',
      totalQuestions: 3,
      correctCount: 1,
      incorrectCount: 2,
      accuracyPercent: 33,
      durationSeconds: 45,
      weakTopics: ['Idioms'],
      completedAt: new Date().toISOString(),
    });
    const analytics = computeExamAnalytics(await ExamRepository.getAttempts());
    expect(analytics.totalAttempts).toBe(1);
    expect(analytics.overallAccuracyPercent).toBe(33);
    expect(analytics.weakSubjects).toHaveLength(1);
    expect(analytics.weakSubjects[0].subject).toBe('English');

    const bm1 = await ExamRepository.toggleBookmarkQuestion('q_en_1');
    expect(bm1).toContain('q_en_1');
    const bm2 = await ExamRepository.toggleBookmarkQuestion('q_en_1');
    expect(bm2).not.toContain('q_en_1');
  });

  it('supports bilingual Vocabulary CRUD and spaced repetition review scheduling', async () => {
    const initial = await VocabularyRepository.getAll();
    expect(initial.length).toBeGreaterThanOrEqual(6);

    const added = await VocabularyRepository.saveWord({
      id: 'voc_custom_1',
      word: 'Exemplary',
      meaningBn: 'অনুকরণীয় / দৃষ্টান্তমূলক',
      definitionEn: 'Serving as a desirable model.',
      synonyms: ['Admirable'],
      antonyms: ['Deplorable'],
      exampleSentence: 'Her accuracy was exemplary.',
      saved: true,
      reviewCount: 0,
      intervalDays: 1,
      nextReviewAt: 0,
      isCustomUserWord: true,
    });
    expect(added.word).toBe('Exemplary');

    const now = 1_700_000_000_000;
    const reviewed = await VocabularyRepository.recordReview('voc_custom_1', true, now);
    expect(reviewed?.intervalDays).toBe(3);
    expect(reviewed?.reviewCount).toBe(1);
    expect(reviewed?.nextReviewAt).toBe(now + 3 * 86400_000);

    const dueNow = getDueRevisionWords(await VocabularyRepository.getAll(), now + 1000);
    expect(dueNow.some((w) => w.id === 'voc_custom_1')).toBe(false);

    const forgotten = await VocabularyRepository.recordReview('voc_custom_1', false, now + 4 * 86400_000);
    expect(forgotten?.intervalDays).toBe(1);
  });

  it('labels interview preparation guides as sample suggestions only and saves personal notes', async () => {
    expect(INTERVIEW_QUESTION_GUIDES.length).toBeGreaterThanOrEqual(4);
    for (const guide of INTERVIEW_QUESTION_GUIDES) {
      expect(guide.isSampleSuggestionOnly).toBe(true);
      expect(guide.disclaimer).toContain('never guaranteed');
    }

    const note = await InterviewPrepRepository.saveNote(
      'iv_intro',
      'Tell us about yourself',
      'BSc in CSE from DU with project work in automated form validation.'
    );
    expect(note.userDraftAnswer).toContain('BSc in CSE');
    const allNotes = await InterviewPrepRepository.getNotes();
    expect(allNotes['iv_note_iv_intro']?.userDraftAnswer).toContain('BSc in CSE');
  });
});
