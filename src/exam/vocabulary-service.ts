// JobFill BD - Vocabulary & Daily Learning Repository with Spaced Repetition
// Accurate bilingual definitions without fabricated etymologies.

import { IndexedDBManager, STORES } from '../database/indexeddb';

const VOCAB_FALLBACK_KEY = 'jobfill_vocabulary_items_v1';
const DAY_MS = 86400_000;

export interface VocabularyWordRecord {
  id: string;
  word: string;
  meaningBn: string;
  definitionEn: string;
  synonyms: string[];
  antonyms: string[];
  exampleSentence: string;
  saved: boolean;
  reviewCount: number;
  intervalDays: number;
  nextReviewAt: number;
  isCustomUserWord?: boolean;
}

export const STARTER_VOCABULARY_WORDS: VocabularyWordRecord[] = [
  {
    id: 'voc_prudent',
    word: 'Prudent',
    meaningBn: 'বিচক্ষণ / সতর্ক',
    definitionEn: 'Acting with or showing care and thought for the future.',
    synonyms: ['Wise', 'Cautious', 'Judicious'],
    antonyms: ['Reckless', 'Careless'],
    exampleSentence: 'It is prudent to review all official eligibility rules before submitting.',
    saved: true,
    reviewCount: 0,
    intervalDays: 1,
    nextReviewAt: 0,
  },
  {
    id: 'voc_diligent',
    word: 'Diligent',
    meaningBn: 'পরিশ্রমী / অধ্যবসায়ী',
    definitionEn: 'Having or showing care and conscientiousness in one’s work or duties.',
    synonyms: ['Industrious', 'Assiduous', 'Persistent'],
    antonyms: ['Negligent', 'Lazy'],
    exampleSentence: 'Diligent preparation over several months improves accuracy in MCQ exams.',
    saved: true,
    reviewCount: 0,
    intervalDays: 1,
    nextReviewAt: 0,
  },
  {
    id: 'voc_mitigate',
    word: 'Mitigate',
    meaningBn: 'প্রশমিত করা / তীব্রতা কমানো',
    definitionEn: 'To make something less severe, harmful, or painful.',
    synonyms: ['Alleviate', 'Reduce', 'Lessen'],
    antonyms: ['Aggravate', 'Worsen'],
    exampleSentence: 'Early document verification helps mitigate last-minute submission errors.',
    saved: false,
    reviewCount: 0,
    intervalDays: 1,
    nextReviewAt: 0,
  },
  {
    id: 'voc_candid',
    word: 'Candid',
    meaningBn: 'স্পষ্টভাষী / অকপট',
    definitionEn: 'Truthful and straightforward; frank.',
    synonyms: ['Frank', 'Honest', 'Direct'],
    antonyms: ['Evasive', 'Guarded'],
    exampleSentence: 'Give a candid and clear answer during the viva board interview.',
    saved: false,
    reviewCount: 0,
    intervalDays: 1,
    nextReviewAt: 0,
  },
  {
    id: 'voc_concise',
    word: 'Concise',
    meaningBn: 'সংক্ষিপ্ত ও স্পষ্ট',
    definitionEn: 'Giving a lot of information clearly and in a few words.',
    synonyms: ['Brief', 'Succinct', 'Compact'],
    antonyms: ['Verbose', 'Wordy'],
    exampleSentence: 'Keep your CV career objective concise and focused on verifiable skills.',
    saved: false,
    reviewCount: 0,
    intervalDays: 1,
    nextReviewAt: 0,
  },
  {
    id: 'voc_feasible',
    word: 'Feasible',
    meaningBn: 'বাস্তবায়নযোগ্য / সম্ভবপর',
    definitionEn: 'Possible to do easily or conveniently.',
    synonyms: ['Practical', 'Viable', 'Workable'],
    antonyms: ['Impractical', 'Impossible'],
    exampleSentence: 'Setting a daily 30-minute revision plan is feasible for most students.',
    saved: false,
    reviewCount: 0,
    intervalDays: 1,
    nextReviewAt: 0,
  },
];

export class VocabularyRepository {
  public static async getAll(): Promise<VocabularyWordRecord[]> {
    let stored: VocabularyWordRecord[] = [];
    if (typeof indexedDB !== 'undefined') {
      try {
        stored = await IndexedDBManager.executeTransaction<VocabularyWordRecord[]>(
          STORES.VOCABULARY_ITEMS,
          'readonly',
          (store) =>
            new Promise((resolve, reject) => {
              const req = store.getAll();
              req.onsuccess = () => resolve(req.result || []);
              req.onerror = () => reject(req.error);
            })
        );
      } catch {
        // Fallback below
      }
    }
    if (stored.length === 0 && typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(VOCAB_FALLBACK_KEY);
        stored = raw ? JSON.parse(raw) : [];
      } catch {
        stored = [];
      }
    }

    const byId = new Map<string, VocabularyWordRecord>();
    for (const w of STARTER_VOCABULARY_WORDS) byId.set(w.id, w);
    for (const w of stored) byId.set(w.id, w);
    return Array.from(byId.values());
  }

  public static async saveWord(record: VocabularyWordRecord): Promise<VocabularyWordRecord> {
    if (!record.word.trim() || !record.meaningBn.trim()) {
      throw new Error('Word and Bengali meaning are required.');
    }
    const clean: VocabularyWordRecord = {
      ...record,
      id: record.id || `voc_u_${Date.now().toString(36)}`,
      word: record.word.trim(),
      meaningBn: record.meaningBn.trim(),
      definitionEn: record.definitionEn.trim() || 'User added vocabulary entry.',
    };

    if (typeof indexedDB !== 'undefined') {
      try {
        await IndexedDBManager.executeTransaction(STORES.VOCABULARY_ITEMS, 'readwrite', (store) =>
          new Promise<void>((resolve, reject) => {
            const req = store.put(clean);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
          })
        );
        return clean;
      } catch {
        // Fallback
      }
    }
    if (typeof localStorage !== 'undefined') {
      const existing = await this.getAll();
      const next = existing.filter((w) => w.id !== clean.id).concat(clean);
      localStorage.setItem(VOCAB_FALLBACK_KEY, JSON.stringify(next));
    }
    return clean;
  }

  /**
   * Advances spaced repetition schedule when remembered, or resets to 1 day when forgotten.
   */
  public static async recordReview(
    wordId: string,
    remembered: boolean,
    nowMs: number = Date.now()
  ): Promise<VocabularyWordRecord | null> {
    const all = await this.getAll();
    const target = all.find((w) => w.id === wordId);
    if (!target) return null;

    const nextInterval = remembered
      ? target.intervalDays <= 1
        ? 3
        : target.intervalDays <= 3
          ? 7
          : target.intervalDays <= 7
            ? 14
            : 30
      : 1;

    const updated: VocabularyWordRecord = {
      ...target,
      saved: true,
      reviewCount: target.reviewCount + 1,
      intervalDays: nextInterval,
      nextReviewAt: nowMs + nextInterval * DAY_MS,
    };
    return this.saveWord(updated);
  }
}

export function getDueRevisionWords(
  words: VocabularyWordRecord[],
  nowMs: number = Date.now()
): VocabularyWordRecord[] {
  return words.filter((w) => w.nextReviewAt <= nowMs);
}
