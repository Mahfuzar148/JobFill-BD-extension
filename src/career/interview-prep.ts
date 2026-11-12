// JobFill BD - Interview Preparation Center Service
// Stores personal answer notes and self-introduction drafts locally in IndexedDB STORES.STUDY_NOTES.
// Explicitly labels guide questions as sample preparation suggestions only.

import { IndexedDBManager, STORES } from '../database/indexeddb';

const INTERVIEW_FALLBACK_KEY = 'jobfill_interview_notes_v1';

export interface InterviewQuestionGuide {
  id: string;
  category: 'Common Viva' | 'Self Introduction' | 'Bangladesh Govt / BCS' | 'Subject-Specific (Technical)';
  question: string;
  sampleGuide: string;
  isSampleSuggestionOnly: true;
  disclaimer: string;
}

export interface InterviewNoteRecord {
  id: string; // matches questionId or 'self_intro'
  kind: 'interview_note';
  questionTitle: string;
  userDraftAnswer: string;
  updatedAt: string;
}

const GUIDE_DISCLAIMER = 'Sample preparation guide only — never guaranteed to be asked in a live interview or viva.';

export const INTERVIEW_QUESTION_GUIDES: InterviewQuestionGuide[] = [
  {
    id: 'iv_intro',
    category: 'Self Introduction',
    question: 'Tell us about yourself (নিজের সম্পর্কে বলুন).',
    sampleGuide:
      'Suggested structure: Name & home district -> Highest relevant degree & institution -> Key practical skills or work/project experience -> Why this organization role fits your career goals (keep under 90 seconds).',
    isSampleSuggestionOnly: true,
    disclaimer: GUIDE_DISCLAIMER,
  },
  {
    id: 'iv_why_org',
    category: 'Common Viva',
    question: 'Why do you want to join this organization / public service?',
    sampleGuide:
      'Suggested points: Mention the organization’s real public mandate or projects accurately, connect your academic skills to their department duties, and focus on long-term professional contribution.',
    isSampleSuggestionOnly: true,
    disclaimer: GUIDE_DISCLAIMER,
  },
  {
    id: 'iv_strength',
    category: 'Common Viva',
    question: 'What are your key strengths and one area you are improving?',
    sampleGuide:
      'Suggested points: Cite 2 concrete verified skills (e.g., data analysis, teamwork) backed by a real example, and describe an area you actively practice responsibly.',
    isSampleSuggestionOnly: true,
    disclaimer: GUIDE_DISCLAIMER,
  },
  {
    id: 'iv_bd_current',
    category: 'Bangladesh Govt / BCS',
    question: 'Discuss a recent national infrastructure or digital governance initiative in Bangladesh.',
    sampleGuide:
      'Suggested structure: Objective summary -> Key public benefits -> Implementation challenge -> Balanced, factual conclusion (cite only verified figures).',
    isSampleSuggestionOnly: true,
    disclaimer: GUIDE_DISCLAIMER,
  },
  {
    id: 'iv_tech_project',
    category: 'Subject-Specific (Technical)',
    question: 'Describe your final-year thesis/project and how you handled a difficult technical constraint.',
    sampleGuide:
      'Suggested structure: Context -> Specific problem -> Action you personally took -> Measurable or observed result.',
    isSampleSuggestionOnly: true,
    disclaimer: GUIDE_DISCLAIMER,
  },
];

export class InterviewPrepRepository {
  public static async getNotes(): Promise<Record<string, InterviewNoteRecord>> {
    if (typeof indexedDB !== 'undefined') {
      try {
        const list = await IndexedDBManager.executeTransaction<any[]>(
          STORES.STUDY_NOTES,
          'readonly',
          (store) =>
            new Promise((resolve, reject) => {
              const req = store.getAll();
              req.onsuccess = () => resolve(req.result || []);
              req.onerror = () => reject(req.error);
            })
        );
        const map: Record<string, InterviewNoteRecord> = {};
        for (const r of list) {
          if (r?.kind === 'interview_note' && r.id) {
            map[r.id] = r;
          }
        }
        return map;
      } catch {
        // Fallback below
      }
    }
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(INTERVIEW_FALLBACK_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    }
    return {};
  }

  public static async saveNote(
    questionId: string,
    questionTitle: string,
    userDraftAnswer: string
  ): Promise<InterviewNoteRecord> {
    const id = `iv_note_${questionId}`;
    const record: InterviewNoteRecord = {
      id,
      kind: 'interview_note',
      questionTitle,
      userDraftAnswer,
      updatedAt: new Date().toISOString(),
    };

    if (typeof indexedDB !== 'undefined') {
      try {
        await IndexedDBManager.executeTransaction(STORES.STUDY_NOTES, 'readwrite', (store) =>
          new Promise<void>((resolve, reject) => {
            const req = store.put(record);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
          })
        );
        return record;
      } catch {
        // Fallback
      }
    }
    if (typeof localStorage !== 'undefined') {
      const existing = await this.getNotes();
      existing[id] = record;
      localStorage.setItem(INTERVIEW_FALLBACK_KEY, JSON.stringify(existing));
    }
    return record;
  }
}
