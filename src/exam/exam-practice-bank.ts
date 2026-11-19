// JobFill BD - Exam Practice Center Repository, Verified Practice Questions & Analytics
// All questions are explicitly labeled as curated practice material (never misrepresented as official past papers).

import { IndexedDBManager, STORES } from '../database/indexeddb';

const ATTEMPTS_FALLBACK_KEY = 'jobfill_exam_attempts_v1';
const BOOKMARKS_FALLBACK_KEY = 'jobfill_exam_bookmarks_v1';

export type ExamSubject =
  | 'Bangla'
  | 'English'
  | 'Mathematics'
  | 'General Knowledge'
  | 'Bangladesh Affairs'
  | 'International Affairs'
  | 'ICT'
  | 'General Science';

export const ALL_EXAM_SUBJECTS: ExamSubject[] = [
  'Bangla',
  'English',
  'Mathematics',
  'General Knowledge',
  'Bangladesh Affairs',
  'International Affairs',
  'ICT',
  'General Science',
];

export interface PracticeMcqQuestion {
  id: string;
  subject: ExamSubject;
  topic: string;
  questionText: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
  isOfficialPastPaper: false;
  contentSource: string;
}

export interface ExamAttemptRecord {
  id: string;
  subject: ExamSubject | 'Mixed Mock';
  mode: 'topic_practice' | 'timed_mock';
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  accuracyPercent: number;
  durationSeconds: number;
  weakTopics: string[];
  completedAt: string;
}

export interface SubjectPerformanceStats {
  subject: string;
  attempts: number;
  totalQuestions: number;
  correctCount: number;
  accuracyPercent: number;
  isWeakSubject: boolean;
}

const SOURCE_LABEL = 'JobFill BD Curated Study Practice Bank (Practice Material Only — Not Official Past Paper)';

export const CURATED_PRACTICE_QUESTIONS: PracticeMcqQuestion[] = [
  // Bangla
  {
    id: 'q_bn_1',
    subject: 'Bangla',
    topic: 'Bangla Grammar (Sandhi)',
    questionText: "'স্বাগত' শব্দের সঠিক সন্ধি-বিচ্ছেদ কোনটি?",
    options: ['সু + আগত', 'স্ব + আগত', 'স + আগত', 'সু + গত'],
    correctIndex: 0,
    explanation: 'উ-কারের পর অ/আ ভিন্ন স্বর থাকলে উ-স্থানে ব-ফলা হয়; তাই সু + আগত = স্বাগত।',
    isOfficialPastPaper: false,
    contentSource: SOURCE_LABEL,
  },
  {
    id: 'q_bn_2',
    subject: 'Bangla',
    topic: 'Bangla Literature',
    questionText: "'সঞ্চিতা' কোন কবির কাব্য সংকলন?",
    options: ['রবীন্দ্রনাথ ঠাকুর', 'কাজী নজরুল ইসলাম', 'জসীমউদ্‌দীন', 'জীবনানন্দ দাশ'],
    correctIndex: 1,
    explanation: "'সঞ্চিতা' কাজী নজরুল ইসলামের কাব্য সংকলন (রবীন্দ্রনাথের সংকলন হলো 'সঞ্চয়িতা')।",
    isOfficialPastPaper: false,
    contentSource: SOURCE_LABEL,
  },
  {
    id: 'q_bn_3',
    subject: 'Bangla',
    topic: 'Bangla Spelling',
    questionText: 'কোন বানানটি শুদ্ধ?',
    options: ['মুমুর্ষু', 'মুমূর্ষু', 'মূমূর্ষু', 'মুমূর্ষ'],
    correctIndex: 1,
    explanation: "শুদ্ধ বানান হলো 'মুমূর্ষু' (প্রথমটি হ্রস্ব-উ, মাঝেরটি দীর্ঘ-ঊ, শেষটি হ্রস্ব-উ)।",
    isOfficialPastPaper: false,
    contentSource: SOURCE_LABEL,
  },

  // English
  {
    id: 'q_en_1',
    subject: 'English',
    topic: 'Prepositions & Grammar',
    questionText: 'Choose the correct sentence:',
    options: [
      'She prefers coffee than tea.',
      'She prefers coffee to tea.',
      'She prefers coffee over tea more.',
      'She prefer coffee to tea.',
    ],
    correctIndex: 1,
    explanation: "The verb 'prefer' takes the preposition 'to' when comparing two nouns.",
    isOfficialPastPaper: false,
    contentSource: SOURCE_LABEL,
  },
  {
    id: 'q_en_2',
    subject: 'English',
    topic: 'Subject-Verb Agreement',
    questionText: 'Neither the manager nor the employees ___ present at the briefing.',
    options: ['was', 'is', 'were', 'has'],
    correctIndex: 2,
    explanation: "With 'neither...nor', the verb agrees with the nearer subject ('employees', which is plural -> 'were').",
    isOfficialPastPaper: false,
    contentSource: SOURCE_LABEL,
  },
  {
    id: 'q_en_3',
    subject: 'English',
    topic: 'Idioms',
    questionText: "What does the idiom 'once in a blue moon' mean?",
    options: ['Every week', 'Very rarely', 'At midnight', 'Without warning'],
    correctIndex: 1,
    explanation: "'Once in a blue moon' means something that happens very rarely.",
    isOfficialPastPaper: false,
    contentSource: SOURCE_LABEL,
  },

  // Mathematics
  {
    id: 'q_math_1',
    subject: 'Mathematics',
    topic: 'Percentage',
    questionText: 'If the price of a book increases from 200 BDT to 250 BDT, what is the percentage increase?',
    options: ['20%', '25%', '30%', '50%'],
    correctIndex: 1,
    explanation: 'Increase = 50 BDT. Percentage increase = (50 / 200) × 100 = 25%.',
    isOfficialPastPaper: false,
    contentSource: SOURCE_LABEL,
  },
  {
    id: 'q_math_2',
    subject: 'Mathematics',
    topic: 'Ratio & Average',
    questionText: 'The average of five consecutive odd numbers starting with 3 is:',
    options: ['5', '7', '9', '11'],
    correctIndex: 1,
    explanation: 'The numbers are 3, 5, 7, 9, 11. Their sum is 35, and 35 / 5 = 7.',
    isOfficialPastPaper: false,
    contentSource: SOURCE_LABEL,
  },
  {
    id: 'q_math_3',
    subject: 'Mathematics',
    topic: 'Geometry',
    questionText: 'What is the sum of the interior angles of a regular pentagon?',
    options: ['360°', '450°', '540°', '720°'],
    correctIndex: 2,
    explanation: 'Sum of interior angles of an n-sided polygon = (n - 2) × 180°. For n = 5, 3 × 180° = 540°.',
    isOfficialPastPaper: false,
    contentSource: SOURCE_LABEL,
  },

  // General Knowledge
  {
    id: 'q_gk_1',
    subject: 'General Knowledge',
    topic: 'Units & Measurements',
    questionText: 'Which SI unit is used to measure electrical resistance?',
    options: ['Watt', 'Volt', 'Ohm', 'Ampere'],
    correctIndex: 2,
    explanation: 'Electrical resistance is measured in Ohms (Ω).',
    isOfficialPastPaper: false,
    contentSource: SOURCE_LABEL,
  },
  {
    id: 'q_gk_2',
    subject: 'General Knowledge',
    topic: 'Geography',
    questionText: 'Which ocean is the largest and deepest on Earth?',
    options: ['Atlantic Ocean', 'Indian Ocean', 'Pacific Ocean', 'Arctic Ocean'],
    correctIndex: 2,
    explanation: 'The Pacific Ocean covers roughly 30% of Earth surface and is the largest and deepest ocean.',
    isOfficialPastPaper: false,
    contentSource: SOURCE_LABEL,
  },

  // Bangladesh Affairs
  {
    id: 'q_bd_1',
    subject: 'Bangladesh Affairs',
    topic: 'Constitution & State',
    questionText: 'When was the Constitution of Bangladesh adopted by the Constituent Assembly?',
    options: ['26 March 1971', '16 December 1971', '4 November 1972', '16 December 1972'],
    correctIndex: 2,
    explanation: 'The Constitution was adopted on 4 November 1972 and came into force on 16 December 1972.',
    isOfficialPastPaper: false,
    contentSource: SOURCE_LABEL,
  },
  {
    id: 'q_bd_2',
    subject: 'Bangladesh Affairs',
    topic: 'Geography of Bangladesh',
    questionText: 'Which river enters Bangladesh through Nawabganj (Chapainawabganj) and is the main branch of the Ganges?',
    options: ['Padma', 'Meghna', 'Jamuna', 'Teesta'],
    correctIndex: 0,
    explanation: 'The Ganges flows into Bangladesh through Chapainawabganj district as the Padma river.',
    isOfficialPastPaper: false,
    contentSource: SOURCE_LABEL,
  },

  // International Affairs
  {
    id: 'q_intl_1',
    subject: 'International Affairs',
    topic: 'International Organizations',
    questionText: 'Where is the headquarters of UNESCO located?',
    options: ['Geneva', 'New York', 'Paris', 'Vienna'],
    correctIndex: 2,
    explanation: 'UNESCO (United Nations Educational, Scientific and Cultural Organization) is headquartered in Paris, France.',
    isOfficialPastPaper: false,
    contentSource: SOURCE_LABEL,
  },
  {
    id: 'q_intl_2',
    subject: 'International Affairs',
    topic: 'International Organizations',
    questionText: 'When was SAARC officially established?',
    options: ['1975', '1985', '1991', '1995'],
    correctIndex: 1,
    explanation: 'SAARC was established on 8 December 1985 in Dhaka.',
    isOfficialPastPaper: false,
    contentSource: SOURCE_LABEL,
  },

  // ICT
  {
    id: 'q_ict_1',
    subject: 'ICT',
    topic: 'Binary & Data Representation',
    questionText: 'How many bits make 1 Byte?',
    options: ['4 bits', '8 bits', '16 bits', '32 bits'],
    correctIndex: 1,
    explanation: '1 Byte equals 8 bits (1 nibble = 4 bits).',
    isOfficialPastPaper: false,
    contentSource: SOURCE_LABEL,
  },
  {
    id: 'q_ict_2',
    subject: 'ICT',
    topic: 'Networking & Security',
    questionText: 'What does HTTPS use to encrypt communication between a browser and a web server?',
    options: ['FTP', 'TLS / SSL', 'ICMP', 'ARP'],
    correctIndex: 1,
    explanation: 'HTTPS secures HTTP communication using Transport Layer Security (TLS, formerly SSL).',
    isOfficialPastPaper: false,
    contentSource: SOURCE_LABEL,
  },

  // General Science
  {
    id: 'q_sci_1',
    subject: 'General Science',
    topic: 'Biology',
    questionText: 'Which blood cells are primarily responsible for carrying oxygen via hemoglobin?',
    options: ['Platelets', 'White blood cells', 'Red blood cells', 'Plasma cells'],
    correctIndex: 2,
    explanation: 'Red blood cells (erythrocytes) contain hemoglobin, which binds and transports oxygen.',
    isOfficialPastPaper: false,
    contentSource: SOURCE_LABEL,
  },
  {
    id: 'q_sci_2',
    subject: 'General Science',
    topic: 'Chemistry',
    questionText: 'What is the approximate pH of pure neutral water at 25°C?',
    options: ['0', '5', '7', '14'],
    correctIndex: 2,
    explanation: 'Pure neutral water at 25°C has a pH of 7.0.',
    isOfficialPastPaper: false,
    contentSource: SOURCE_LABEL,
  },
];

export function computeExamAnalytics(attempts: ExamAttemptRecord[]): {
  totalAttempts: number;
  overallAccuracyPercent: number;
  bySubject: SubjectPerformanceStats[];
  weakSubjects: SubjectPerformanceStats[];
} {
  const map = new Map<string, { attempts: number; totalQ: number; correctQ: number }>();
  let grandTotal = 0;
  let grandCorrect = 0;

  for (const a of attempts) {
    grandTotal += a.totalQuestions;
    grandCorrect += a.correctCount;
    const prev = map.get(a.subject) || { attempts: 0, totalQ: 0, correctQ: 0 };
    prev.attempts += 1;
    prev.totalQ += a.totalQuestions;
    prev.correctQ += a.correctCount;
    map.set(a.subject, prev);
  }

  const bySubject: SubjectPerformanceStats[] = Array.from(map.entries()).map(([subject, s]) => {
    const acc = s.totalQ > 0 ? Math.round((s.correctQ / s.totalQ) * 100) : 0;
    return {
      subject,
      attempts: s.attempts,
      totalQuestions: s.totalQ,
      correctCount: s.correctQ,
      accuracyPercent: acc,
      isWeakSubject: s.totalQ > 0 && acc < 65,
    };
  });

  return {
    totalAttempts: attempts.length,
    overallAccuracyPercent: grandTotal > 0 ? Math.round((grandCorrect / grandTotal) * 100) : 0,
    bySubject,
    weakSubjects: bySubject.filter((s) => s.isWeakSubject),
  };
}

export class ExamRepository {
  public static async getAttempts(): Promise<ExamAttemptRecord[]> {
    if (typeof indexedDB !== 'undefined') {
      try {
        const list = await IndexedDBManager.executeTransaction<ExamAttemptRecord[]>(
          STORES.EXAM_ATTEMPTS,
          'readonly',
          (store) =>
            new Promise((resolve, reject) => {
              const req = store.getAll();
              req.onsuccess = () => resolve(req.result || []);
              req.onerror = () => reject(req.error);
            })
        );
        return list.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
      } catch {
        // Fallback
      }
    }
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(ATTEMPTS_FALLBACK_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  public static async saveAttempt(attempt: ExamAttemptRecord): Promise<void> {
    if (typeof indexedDB !== 'undefined') {
      try {
        await IndexedDBManager.executeTransaction(STORES.EXAM_ATTEMPTS, 'readwrite', (store) =>
          new Promise<void>((resolve, reject) => {
            const req = store.put(attempt);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
          })
        );
        return;
      } catch {
        // Fallback
      }
    }
    if (typeof localStorage !== 'undefined') {
      const prev = await this.getAttempts();
      localStorage.setItem(ATTEMPTS_FALLBACK_KEY, JSON.stringify([attempt, ...prev]));
    }
  }

  public static async getBookmarkedQuestionIds(): Promise<string[]> {
    if (typeof indexedDB !== 'undefined') {
      try {
        const rows = await IndexedDBManager.executeTransaction<any[]>(
          STORES.STUDY_NOTES,
          'readonly',
          (store) =>
            new Promise((resolve, reject) => {
              const req = store.getAll();
              req.onsuccess = () => resolve(req.result || []);
              req.onerror = () => reject(req.error);
            })
        );
        return rows.filter((r) => r?.kind === 'exam_bookmark').map((r) => String(r.questionId));
      } catch {
        // Fallback
      }
    }
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(BOOKMARKS_FALLBACK_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  public static async toggleBookmarkQuestion(questionId: string): Promise<string[]> {
    const existing = await this.getBookmarkedQuestionIds();
    const isBookmarked = existing.includes(questionId);
    const id = `ex_bm_${questionId}`;

    if (typeof indexedDB !== 'undefined') {
      try {
        await IndexedDBManager.executeTransaction(STORES.STUDY_NOTES, 'readwrite', (store) =>
          new Promise<void>((resolve, reject) => {
            const req = isBookmarked
              ? store.delete(id)
              : store.put({ id, kind: 'exam_bookmark', questionId, updatedAt: new Date().toISOString() });
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
          })
        );
        return isBookmarked
          ? existing.filter((x) => x !== questionId)
          : [...existing, questionId];
      } catch {
        // Fallback
      }
    }
    const next = isBookmarked ? existing.filter((x) => x !== questionId) : [...existing, questionId];
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(BOOKMARKS_FALLBACK_KEY, JSON.stringify(next));
    }
    return next;
  }
}
