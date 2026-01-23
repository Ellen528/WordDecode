
import { AnalysisResult, GeneratedPractice, SourceType, VocabularyItem, UserProficiency, BookChapter } from "../types";

// Get Supabase URL from environment
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Helper to call Edge Functions
const callEdgeFunction = async (functionName: string, body: object) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase not configured');
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to call ${functionName}`);
  }

  return response.json();
};

// --- Text Analysis (Deep Vocab Focus) ---

export const analyzeText = async (
  text: string, 
  sourceType: SourceType, 
  proficiency?: UserProficiency | null,
  comprehensive?: boolean  // When true, extracts ALL vocabulary for full text mode
): Promise<AnalysisResult> => {
  console.log('Calling analyze-text Edge Function...', { comprehensive });
  
  const result = await callEdgeFunction('analyze-text', { 
    text, 
    sourceType,
    proficiency: proficiency || null,
    comprehensive: comprehensive || false
  });
  
  console.log('Analysis complete!', { vocabCount: result.vocabulary?.length });
  return result as AnalysisResult;
};

// --- Practice Generation ---

export const generatePractice = async (vocabulary: VocabularyItem[]): Promise<GeneratedPractice> => {
  console.log('Calling generate-practice Edge Function...');
  
  const result = await callEdgeFunction('generate-practice', { vocabulary });
  
  console.log('Practice generation complete!');
  return result as GeneratedPractice;
};

// --- Text to Speech (Browser-based fallback) ---

export const generateSpeech = async (text: string): Promise<void> => {
  // Use browser's built-in speech synthesis as a fallback
  // This avoids needing the TTS API key on the client
  return new Promise((resolve) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      speechSynthesis.speak(utterance);
    } else {
      console.warn('Speech synthesis not supported');
      resolve();
    }
  });
};

// --- Word Lookup ---

export const lookupWord = async (word: string, context: string): Promise<{ definition: string; pronunciation: string }> => {
  console.log('Calling lookup-word Edge Function...');
  
  const result = await callEdgeFunction('lookup-word', { word, context });
  
  console.log('Word lookup complete!');
  return result as { definition: string; pronunciation: string };
};

// --- Book Structure Extraction ---

export interface BookStructureResult {
  title: string;
  author?: string;
  bookSubject?: string;  // What the book teaches (e.g., "phrasal verbs", "idioms")
  structure: BookChapter[];
}

export const extractBookStructure = async (
  text: string,
  pageCount: number
): Promise<BookStructureResult> => {
  console.log('Calling extract-book-structure Edge Function...');
  
  const result = await callEdgeFunction('extract-book-structure', { 
    text, 
    pageCount 
  });
  
  console.log('Book structure extraction complete!', { 
    title: result.title,
    chapters: result.structure?.length 
  });
  
  return result as BookStructureResult;
};

// --- Chapter Vocabulary Extraction ---

export const extractChapterVocabulary = async (
  chapterContent: string,
  bookTitle: string,
  chapterTitle: string,
  bookSubject?: string,  // What the book teaches - extraction should focus on this
  proficiency?: UserProficiency | null
): Promise<VocabularyItem[]> => {
  console.log('=== extractChapterVocabulary called ===');
  console.log('Book title:', bookTitle);
  console.log('Chapter title:', chapterTitle);
  console.log('Book subject:', bookSubject);
  console.log('Content length:', chapterContent?.length);
  
  // Use specialized extraction for phrasal verb books
  const isPhrasalVerbBook = bookSubject?.toLowerCase().includes('phrasal verb') || 
                            bookTitle?.toLowerCase().includes('phrasal verb');
  
  console.log('Is phrasal verb book?', isPhrasalVerbBook);
  console.log('  - bookSubject check:', bookSubject?.toLowerCase().includes('phrasal verb'));
  console.log('  - bookTitle check:', bookTitle?.toLowerCase().includes('phrasal verb'));
  
  if (isPhrasalVerbBook) {
    console.log('>>> Using specialized phrasal verb extraction...');
    try {
      const result = await callEdgeFunction('extract-phrasal-verbs', { 
        text: chapterContent,
        chapterTitle
      });
      
      console.log('Phrasal verb extraction complete!', { 
        vocabCount: result.vocabulary?.length,
        firstItem: result.vocabulary?.[0]
      });
      
      return result.vocabulary as VocabularyItem[];
    } catch (error) {
      console.error('!!! Phrasal verb extraction FAILED:', error);
      console.warn('Falling back to generic extraction...');
      // Fall through to generic extraction
    }
  } else {
    console.log('>>> NOT a phrasal verb book, using generic extraction');
  }
  
  // Generic extraction using analyze-text
  const result = await callEdgeFunction('analyze-text', { 
    text: chapterContent,
    sourceType: SourceType.ARTICLE,
    proficiency: proficiency || null,
    comprehensive: true,
    bookContext: {
      bookTitle,
      chapterTitle,
      bookSubject
    }
  });
  
  console.log('Chapter vocabulary extraction complete!', { 
    vocabCount: result.vocabulary?.length 
  });
  
  return result.vocabulary as VocabularyItem[];
};

// --- Generate Vocabulary from Manual Terms ---

export const generateVocabularyFromTerms = async (
  terms: string[],
  category: string = 'phrasal_verbs'
): Promise<VocabularyItem[]> => {
  console.log('Generating vocabulary for terms:', terms);
  
  const result = await callEdgeFunction('generate-vocabulary', { 
    terms,
    category
  });
  
  console.log('Vocabulary generation complete!', { 
    vocabCount: result.vocabulary?.length 
  });
  
  return result.vocabulary as VocabularyItem[];
};
