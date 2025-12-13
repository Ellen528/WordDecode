
export enum SourceType {
  NEWS = 'News Article',
  TV_TRANSCRIPT = 'TV Show Transcript',
  BOOK = 'Book Chapter',
  EMAIL = 'Professional Email'
}

export enum AppMode {
  ANALYZE_TEXT = 'analyze_text',
  TOPIC_STRATEGY = 'topic_strategy',
  HISTORY = 'history'
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
