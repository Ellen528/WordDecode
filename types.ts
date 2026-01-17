
export enum SourceType {
  NEWS = 'News Article',
  TV_TRANSCRIPT = 'TV Show Transcript',
  BOOK = 'Book Chapter',
  EMAIL = 'Professional Email'
}

export enum AppMode {
  ANALYZE_TEXT = 'analyze_text',
  FLASHCARD_REVIEW = 'flashcard_review',
  HISTORY = 'history',
  BOOK_READER = 'book_reader'
}

// English proficiency test types
export enum EnglishTestType {
  IELTS = 'IELTS',
  TOEFL = 'TOEFL',
  CET4 = 'CET-4',
  CET6 = 'CET-6'
}

// User's English proficiency level
export interface UserProficiency {
  testType: EnglishTestType;
  score: number;
}

// Score ranges for each test type
export const TEST_SCORE_RANGES: Record<EnglishTestType, { min: number; max: number; step: number }> = {
  [EnglishTestType.IELTS]: { min: 0, max: 9, step: 0.5 },
  [EnglishTestType.TOEFL]: { min: 0, max: 120, step: 1 },
  [EnglishTestType.CET4]: { min: 0, max: 710, step: 1 },
  [EnglishTestType.CET6]: { min: 0, max: 710, step: 1 },
};

export type VocabularyCategory =
  | 'idioms_fixed'       // "get into a jam"
  | 'phrasal_verbs'      // "circle back", "huddle up"
  | 'nuance_sarcasm'     // "glorified", "lousy"
  | 'chunks_structures'  // "Riddle me this", "Factor in"
  | 'topic_specific';    // Domain specific terms

export interface DetailedExample {
  context_label: string; // e.g. "In Business", "Literal", "In Sports"
  sentence: string;
  explanation?: string;
}

export interface VocabularyItem {
  term: string;
  definition: string;
  category: VocabularyCategory;
  source_context?: string; // How it was used in the original text
  imagery_etymology?: string; // The "bee" explanation for "drone", or "bird" for "swoop"
  examples: DetailedExample[];
  nuance?: string; // Kept for backward compatibility/fallback
  example_usage?: string; // Kept for backward compatibility
  difficulty_level?: string; // e.g., "IELTS 6-7", "TOEFL 80+", "CET-4 550+"
}

export interface StructurePoint {
  section: string;
  purpose: string;
  native_pattern: string;
}

export interface AnalysisResult {
  summary: string;
  tone: string;
  structure_analysis?: StructurePoint[];
  vocabulary: VocabularyItem[];
}

export interface GeneratedPractice {
  scenario: string;
  sentences: {
    original_concept: string;
    native_version: string;
    explanation: string;
  }[];
}

export interface SavedVocabularyItem extends VocabularyItem {
  id: string;
  dateAdded: number;
}

export interface Note {
  id: string;
  word: string;
  definition: string;
  context: string;
  timestamp: number;
}

export interface SavedAnalysis {
  id: string;
  date: number;
  sourceType: SourceType;
  inputText: string;
  analysisResult: AnalysisResult;
  fileName?: string | null;
  title?: string | null;  // Custom user-defined title for the analysis
  notes?: Note[];
  folderId?: string | null;
  flashcardPassed?: boolean;
}

export interface AnalysisFolder {
  id: string;
  name: string;
  createdAt: number;
  color?: string;
}

// For tracking known/unknown words in Full Text View
export interface KnownWord {
  term: string;
  isKnown: boolean;
  difficulty_level?: string;
  markedAt: number;
}

// ==================== SPACED REPETITION (SM-2) ====================

// SM-2 Review Quality Rating (0-5 scale)
// 0: Complete blackout, no recall
// 1: Wrong answer, but recognized correct one
// 2: Wrong answer, correct seemed easy to recall
// 3: Correct with difficulty
// 4: Correct with hesitation
// 5: Perfect recall
export type ReviewQuality = 0 | 1 | 2 | 3 | 4 | 5;

// Simplified quality for UI (maps to SM-2 qualities)
export type SimpleQuality = 'again' | 'hard' | 'good' | 'easy';

export interface VocabularyReview {
  id: string;
  term: string;
  definition: string;
  sourceAnalysisId?: string;
  // SM-2 algorithm parameters
  easeFactor: number;      // >= 1.3, starts at 2.5
  interval: number;        // days until next review
  repetitions: number;     // successful reviews in a row
  nextReviewDate: Date;
  lastReviewDate?: Date;
  // User actions
  isSuspended: boolean;    // "don't show again"
  isMastered: boolean;     // achieved mastery (e.g., interval > 21 days)
  // Statistics
  correctCount: number;
  incorrectCount: number;
  createdAt: Date;
  // Vocabulary metadata (for display)
  category?: VocabularyCategory;
  sourceContext?: string;
  examples?: DetailedExample[];
  imageryEtymology?: string;
  difficultyLevel?: string;
}

export interface ReviewStats {
  totalWords: number;       // All words in the system
  masteredWords: number;    // Words with interval > 21 days
  learningWords: number;    // Words being actively learned
  newWords: number;         // Words never reviewed
  dueToday: number;         // Words due for review today
  suspendedWords: number;   // Words marked "don't show"
  masteryPercentage: number; // (mastered / total) * 100
}

export interface ReviewSessionConfig {
  totalCards: number;       // How many cards to review
  newCardsLimit: number;    // Max new cards to include
  includeNew: boolean;      // Include new/unreviewed words
  includeDue: boolean;      // Include due reviews
}

export interface ReviewSessionResult {
  cardsReviewed: number;
  correctCount: number;
  incorrectCount: number;
  newCardsLearned: number;
  averageQuality: number;
}

// ==================== EBOOK LIBRARY ====================

// Hierarchical chapter structure for books
export interface BookChapter {
  id: string;
  title: string;
  level: number;           // 1 = category/part, 2 = chapter/unit, 3 = sub-section
  pageStart?: number;      // Starting page in PDF
  pageEnd?: number;        // Ending page in PDF
  content?: string;        // Extracted text for this chapter (lazy loaded)
  vocabulary?: VocabularyItem[]; // Extracted vocabulary (lazy loaded)
  isStudied?: boolean;     // User has studied this chapter
  children?: BookChapter[]; // Nested chapters/units
}

// Progress tracking for a book chapter
export interface ChapterProgress {
  chapterId: string;
  isStudied: boolean;
  vocabularyExtracted: boolean;
  lastOpenedAt?: number;
}

// Saved book with structure and metadata
export interface SavedBook {
  id: string;
  userId: string;
  title: string;
  author?: string;
  bookSubject?: string;         // What the book teaches (e.g., "phrasal verbs", "idioms")
  fileName: string;
  pageCount: number;
  structure: BookChapter[];     // Hierarchical TOC
  rawText: string;              // Full PDF text (for extraction)
  progress?: ChapterProgress[]; // Per-chapter progress
  createdAt: number;
  lastOpenedAt?: number;
}
