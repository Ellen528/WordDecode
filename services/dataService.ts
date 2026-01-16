import { supabase } from './supabaseClient';
import { SavedAnalysis, SavedVocabularyItem, SourceType, Note, AnalysisFolder, VocabularyReview, ReviewStats, VocabularyItem, DetailedExample, VocabularyCategory } from '../types';
import { calculateNextReview, simpleToSM2Quality, createNewReview } from './sm2Algorithm';
import type { ReviewQuality, SimpleQuality } from '../types';

// Database row types (matching Supabase schema)
interface DbSavedAnalysis {
  id: string;
  user_id: string;
  date: number;
  source_type: string;
  input_text: string;
  analysis_result: object;
  file_name: string | null;
  title: string | null;
  notes: object | null;
  folder_id: string | null;
  flashcard_passed: boolean | null;
  created_at: string;
}

interface DbUserVisit {
  id: string;
  user_id: string;
  visited_at: string;
}

interface DbSavedVocabulary {
  id: string;
  user_id: string;
  term: string;
  definition: string;
  category: string;
  source_context: string | null;
  imagery_etymology: string | null;
  examples: object | null;
  nuance: string | null;
  date_added: number;
  created_at: string;
}

interface DbAnalysisFolder {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  created_at: string;
}

interface DbVocabularyReview {
  id: string;
  user_id: string;
  term: string;
  definition: string;
  source_analysis_id: string | null;
  ease_factor: number;
  interval: number;
  repetitions: number;
  next_review_date: string;
  last_review_date: string | null;
  is_suspended: boolean;
  is_mastered: boolean;
  correct_count: number;
  incorrect_count: number;
  category: string | null;
  source_context: string | null;
  examples: object | null;
  imagery_etymology: string | null;
  difficulty_level: string | null;
  created_at: string;
  updated_at: string;
}

// Transform database row to app type
const dbToAnalysis = (row: DbSavedAnalysis): SavedAnalysis => ({
  id: row.id,
  date: row.date,
  sourceType: row.source_type as SourceType,
  inputText: row.input_text,
  analysisResult: row.analysis_result as SavedAnalysis['analysisResult'],
  fileName: row.file_name,
  title: row.title,
  notes: (row.notes as Note[]) || [],
  folderId: row.folder_id || null,
  flashcardPassed: row.flashcard_passed || false,
});

const dbToFolder = (row: DbAnalysisFolder): AnalysisFolder => ({
  id: row.id,
  name: row.name,
  createdAt: new Date(row.created_at).getTime(),
  color: row.color || undefined,
});

const dbToVocabulary = (row: DbSavedVocabulary): SavedVocabularyItem => ({
  id: row.id,
  term: row.term,
  definition: row.definition,
  category: row.category as SavedVocabularyItem['category'],
  source_context: row.source_context ?? undefined,
  imagery_etymology: row.imagery_etymology ?? undefined,
  examples: (row.examples as SavedVocabularyItem['examples']) ?? [],
  nuance: row.nuance ?? undefined,
  dateAdded: row.date_added,
});

const dbToVocabularyReview = (row: DbVocabularyReview): VocabularyReview => ({
  id: row.id,
  term: row.term,
  definition: row.definition,
  sourceAnalysisId: row.source_analysis_id ?? undefined,
  easeFactor: row.ease_factor,
  interval: row.interval,
  repetitions: row.repetitions,
  nextReviewDate: new Date(row.next_review_date),
  lastReviewDate: row.last_review_date ? new Date(row.last_review_date) : undefined,
  isSuspended: row.is_suspended,
  isMastered: row.is_mastered,
  correctCount: row.correct_count,
  incorrectCount: row.incorrect_count,
  createdAt: new Date(row.created_at),
  category: row.category as VocabularyCategory | undefined,
  sourceContext: row.source_context ?? undefined,
  examples: (row.examples as DetailedExample[]) ?? undefined,
  imageryEtymology: row.imagery_etymology ?? undefined,
  difficultyLevel: row.difficulty_level ?? undefined,
});

export const dataService = {
  // ==================== ANALYSES ====================

  /**
   * Fetch all analyses for the current user
   */
  async fetchAnalyses(userId: string): Promise<SavedAnalysis[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('saved_analyses')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching analyses:', error);
      return [];
    }

    return (data || []).map(dbToAnalysis);
  },

  /**
   * Save a new analysis or update existing one
   */
  async saveAnalysis(userId: string, analysis: SavedAnalysis): Promise<SavedAnalysis | null> {
    if (!supabase) {
      console.warn('Supabase not configured, skipping cloud save');
      return null;
    }

    console.log('Saving analysis to Supabase...', { userId, analysisId: analysis.id });

    const { data, error } = await supabase
      .from('saved_analyses')
      .insert({
        id: analysis.id,
        user_id: userId,
        date: analysis.date,
        source_type: analysis.sourceType,
        input_text: analysis.inputText,
        analysis_result: analysis.analysisResult,
        file_name: analysis.fileName || null,
        title: analysis.title || null,
        notes: analysis.notes || [],
        folder_id: analysis.folderId || null,
        flashcard_passed: analysis.flashcardPassed || false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving analysis to Supabase:', error);
      return null;
    }

    console.log('Analysis saved successfully to Supabase!', data);
    return dbToAnalysis(data);
  },

  /**
   * Update an existing analysis
   */
  async updateAnalysis(userId: string, analysis: SavedAnalysis): Promise<SavedAnalysis | null> {
    if (!supabase) {
      console.warn('Supabase not configured, skipping cloud update');
      return null;
    }

    console.log('Updating analysis in Supabase...', { userId, analysisId: analysis.id });

    const { data, error } = await supabase
      .from('saved_analyses')
      .update({
        date: analysis.date,
        source_type: analysis.sourceType,
        input_text: analysis.inputText,
        analysis_result: analysis.analysisResult,
        file_name: analysis.fileName || null,
        title: analysis.title || null,
        notes: analysis.notes || [],
        folder_id: analysis.folderId || null,
        flashcard_passed: analysis.flashcardPassed || false,
      })
      .eq('id', analysis.id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating analysis in Supabase:', error);
      return null;
    }

    console.log('Analysis updated successfully in Supabase!', data);
    return dbToAnalysis(data);
  },

  /**
   * Delete an analysis
   */
  async deleteAnalysis(userId: string, analysisId: string): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase
      .from('saved_analyses')
      .delete()
      .eq('id', analysisId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting analysis:', error);
      return false;
    }

    return true;
  },

  /**
   * Sync multiple analyses (used when user logs in to upload local data)
   */
  async syncAnalyses(userId: string, analyses: SavedAnalysis[]): Promise<void> {
    if (!supabase || analyses.length === 0) return;

    // Get existing IDs to avoid duplicates
    const { data: existing } = await supabase
      .from('saved_analyses')
      .select('id')
      .eq('user_id', userId);

    const existingIds = new Set((existing || []).map(e => e.id));

    // Filter out analyses that already exist
    const newAnalyses = analyses.filter(a => !existingIds.has(a.id));

    if (newAnalyses.length === 0) return;

    const { error } = await supabase
      .from('saved_analyses')
      .insert(newAnalyses.map(analysis => ({
        id: analysis.id,
        user_id: userId,
        date: analysis.date,
        source_type: analysis.sourceType,
        input_text: analysis.inputText,
        analysis_result: analysis.analysisResult,
        file_name: analysis.fileName || null,
        folder_id: analysis.folderId || null,
      })));

    if (error) {
      console.error('Error syncing analyses:', error);
    }
  },

  // ==================== VOCABULARY ====================

  /**
   * Fetch all vocabulary items for the current user
   */
  async fetchVocabulary(userId: string): Promise<SavedVocabularyItem[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('saved_vocabulary')
      .select('*')
      .eq('user_id', userId)
      .order('date_added', { ascending: false });

    if (error) {
      console.error('Error fetching vocabulary:', error);
      return [];
    }

    return (data || []).map(dbToVocabulary);
  },

  /**
   * Save vocabulary items
   */
  async saveVocabularyItems(userId: string, items: SavedVocabularyItem[]): Promise<void> {
    if (!supabase || items.length === 0) return;

    const { error } = await supabase
      .from('saved_vocabulary')
      .insert(items.map(item => ({
        id: item.id,
        user_id: userId,
        term: item.term,
        definition: item.definition,
        category: item.category,
        source_context: item.source_context || null,
        imagery_etymology: item.imagery_etymology || null,
        examples: item.examples || [],
        nuance: item.nuance || null,
        date_added: item.dateAdded,
      })));

    if (error) {
      console.error('Error saving vocabulary:', error);
    }
  },

  /**
   * Delete a vocabulary item
   */
  async deleteVocabularyItem(userId: string, itemId: string): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase
      .from('saved_vocabulary')
      .delete()
      .eq('id', itemId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting vocabulary:', error);
      return false;
    }

    return true;
  },

  /**
   * Sync vocabulary items (used when user logs in)
   */
  async syncVocabulary(userId: string, items: SavedVocabularyItem[]): Promise<void> {
    if (!supabase || items.length === 0) return;

    // Get existing IDs
    const { data: existing } = await supabase
      .from('saved_vocabulary')
      .select('id')
      .eq('user_id', userId);

    const existingIds = new Set((existing || []).map(e => e.id));

    // Filter out items that already exist
    const newItems = items.filter(item => !existingIds.has(item.id));

    if (newItems.length === 0) return;

    await this.saveVocabularyItems(userId, newItems);
  },

  // ==================== FOLDERS ====================

  /**
   * Fetch all folders for the current user
   */
  async fetchFolders(userId: string): Promise<AnalysisFolder[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('analysis_folders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching folders:', error);
      return [];
    }

    return (data || []).map(dbToFolder);
  },

  /**
   * Create a new folder
   */
  async createFolder(userId: string, folder: AnalysisFolder): Promise<AnalysisFolder | null> {
    if (!supabase) {
      console.warn('Supabase not configured, skipping cloud save');
      return null;
    }

    const { data, error } = await supabase
      .from('analysis_folders')
      .insert({
        id: folder.id,
        user_id: userId,
        name: folder.name,
        color: folder.color || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating folder:', error);
      return null;
    }

    return dbToFolder(data);
  },

  /**
   * Update a folder
   */
  async updateFolder(userId: string, folder: AnalysisFolder): Promise<AnalysisFolder | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('analysis_folders')
      .update({
        name: folder.name,
        color: folder.color || null,
      })
      .eq('id', folder.id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating folder:', error);
      return null;
    }

    return dbToFolder(data);
  },

  /**
   * Delete a folder
   */
  async deleteFolder(userId: string, folderId: string): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase
      .from('analysis_folders')
      .delete()
      .eq('id', folderId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting folder:', error);
      return false;
    }

    return true;
  },

  /**
   * Update analysis folder assignment
   */
  async updateAnalysisFolder(userId: string, analysisId: string, folderId: string | null): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase
      .from('saved_analyses')
      .update({ folder_id: folderId })
      .eq('id', analysisId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating analysis folder:', error);
      return false;
    }

    return true;
  },

  /**
   * Update flashcard passed status for an analysis
   */
  async updateFlashcardPassed(userId: string, analysisId: string, passed: boolean): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase
      .from('saved_analyses')
      .update({ flashcard_passed: passed })
      .eq('id', analysisId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating flashcard passed status:', error);
      return false;
    }

    return true;
  },

  /**
   * Update analysis title
   */
  async updateAnalysisTitle(userId: string, analysisId: string, title: string | null): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase
      .from('saved_analyses')
      .update({ title })
      .eq('id', analysisId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating analysis title:', error);
      return false;
    }

    return true;
  },

  /**
   * Sync folders (used when user logs in)
   */
  async syncFolders(userId: string, folders: AnalysisFolder[]): Promise<void> {
    if (!supabase || folders.length === 0) return;

    const { data: existing } = await supabase
      .from('analysis_folders')
      .select('id')
      .eq('user_id', userId);

    const existingIds = new Set((existing || []).map(e => e.id));
    const newFolders = folders.filter(f => !existingIds.has(f.id));

    if (newFolders.length === 0) return;

    const { error } = await supabase
      .from('analysis_folders')
      .insert(newFolders.map(folder => ({
        id: folder.id,
        user_id: userId,
        name: folder.name,
        color: folder.color || null,
      })));

    if (error) {
      console.error('Error syncing folders:', error);
    }
  },

  // ==================== EXPORT ====================

  /**
   * Export all data as JSON and trigger download
   */
  exportToJson(analyses: SavedAnalysis[], vocabulary: SavedVocabularyItem[]): void {
    const exportData = {
      exportDate: new Date().toISOString(),
      appName: 'WordDecode',
      version: '1.0',
      data: {
        analyses,
        vocabulary,
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `nativenuance-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  // ==================== USER VISITS ====================

  /**
   * Record a user visit
   */
  async recordVisit(userId: string): Promise<void> {
    if (!supabase) return;

    const { error } = await supabase
      .from('user_visits')
      .insert({
        id: crypto.randomUUID(),
        user_id: userId,
        visited_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error recording visit:', error);
    }
  },

  /**
   * Fetch user visits for a given month
   */
  async fetchVisits(userId: string, year: number, month: number): Promise<{ date: string; count: number }[]> {
    if (!supabase) return [];

    // Get start and end of the month
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const { data, error } = await supabase
      .from('user_visits')
      .select('visited_at')
      .eq('user_id', userId)
      .gte('visited_at', startDate.toISOString())
      .lte('visited_at', endDate.toISOString());

    if (error) {
      console.error('Error fetching visits:', error);
      return [];
    }

    // Aggregate visits by date
    const visitCounts: Record<string, number> = {};
    (data || []).forEach((row: { visited_at: string }) => {
      const date = row.visited_at.split('T')[0]; // YYYY-MM-DD
      visitCounts[date] = (visitCounts[date] || 0) + 1;
    });

    return Object.entries(visitCounts).map(([date, count]) => ({ date, count }));
  },

  // ==================== VOCABULARY REVIEWS (SRS) ====================

  /**
   * Fetch all vocabulary reviews for the current user
   */
  async fetchVocabularyReviews(userId: string): Promise<VocabularyReview[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('vocabulary_reviews')
      .select('*')
      .eq('user_id', userId)
      .order('next_review_date', { ascending: true });

    if (error) {
      console.error('Error fetching vocabulary reviews:', error);
      return [];
    }

    return (data || []).map(dbToVocabularyReview);
  },

  /**
   * Fetch reviews that are due for review (not suspended, next_review_date <= today)
   */
  async fetchDueReviews(userId: string, limit?: number): Promise<VocabularyReview[]> {
    if (!supabase) return [];

    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today

    let query = supabase
      .from('vocabulary_reviews')
      .select('*')
      .eq('user_id', userId)
      .eq('is_suspended', false)
      .lte('next_review_date', today.toISOString())
      .gt('repetitions', 0) // Has been reviewed at least once
      .order('next_review_date', { ascending: true });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching due reviews:', error);
      return [];
    }

    return (data || []).map(dbToVocabularyReview);
  },

  /**
   * Fetch new words (never reviewed) for review
   */
  async fetchNewWordsForReview(userId: string, limit?: number): Promise<VocabularyReview[]> {
    if (!supabase) return [];

    let query = supabase
      .from('vocabulary_reviews')
      .select('*')
      .eq('user_id', userId)
      .eq('is_suspended', false)
      .eq('repetitions', 0) // Never reviewed
      .order('created_at', { ascending: true });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching new words for review:', error);
      return [];
    }

    return (data || []).map(dbToVocabularyReview);
  },

  /**
   * Get review statistics for the dashboard
   */
  async getReviewStats(userId: string): Promise<ReviewStats> {
    if (!supabase) {
      return {
        totalWords: 0,
        masteredWords: 0,
        learningWords: 0,
        newWords: 0,
        dueToday: 0,
        suspendedWords: 0,
        masteryPercentage: 0,
      };
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // Fetch all reviews for the user
    const { data, error } = await supabase
      .from('vocabulary_reviews')
      .select('is_suspended, is_mastered, repetitions, next_review_date')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching review stats:', error);
      return {
        totalWords: 0,
        masteredWords: 0,
        learningWords: 0,
        newWords: 0,
        dueToday: 0,
        suspendedWords: 0,
        masteryPercentage: 0,
      };
    }

    const reviews = data || [];
    const totalWords = reviews.length;
    const suspendedWords = reviews.filter(r => r.is_suspended).length;
    const masteredWords = reviews.filter(r => r.is_mastered && !r.is_suspended).length;
    const newWords = reviews.filter(r => r.repetitions === 0 && !r.is_suspended).length;
    const learningWords = reviews.filter(r => r.repetitions > 0 && !r.is_mastered && !r.is_suspended).length;
    const dueToday = reviews.filter(r => {
      if (r.is_suspended) return false;
      const reviewDate = new Date(r.next_review_date);
      return reviewDate <= today;
    }).length;

    const activeWords = totalWords - suspendedWords;
    const masteryPercentage = activeWords > 0 ? (masteredWords / activeWords) * 100 : 0;

    return {
      totalWords,
      masteredWords,
      learningWords,
      newWords,
      dueToday,
      suspendedWords,
      masteryPercentage,
    };
  },

  /**
   * Create or update a vocabulary review (upsert by term)
   */
  async upsertVocabularyReview(userId: string, review: Omit<VocabularyReview, 'id' | 'createdAt'>): Promise<VocabularyReview | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('vocabulary_reviews')
      .upsert({
        user_id: userId,
        term: review.term,
        definition: review.definition,
        source_analysis_id: review.sourceAnalysisId || null,
        ease_factor: review.easeFactor,
        interval: review.interval,
        repetitions: review.repetitions,
        next_review_date: review.nextReviewDate.toISOString(),
        last_review_date: review.lastReviewDate?.toISOString() || null,
        is_suspended: review.isSuspended,
        is_mastered: review.isMastered,
        correct_count: review.correctCount,
        incorrect_count: review.incorrectCount,
        category: review.category || null,
        source_context: review.sourceContext || null,
        examples: review.examples || null,
        imagery_etymology: review.imageryEtymology || null,
        difficulty_level: review.difficultyLevel || null,
      }, {
        onConflict: 'user_id,term',
      })
      .select()
      .single();

    if (error) {
      console.error('Error upserting vocabulary review:', error);
      return null;
    }

    return dbToVocabularyReview(data);
  },

  /**
   * Update a review after the user answers (applies SM-2 algorithm)
   */
  async updateReviewAfterAnswer(
    userId: string,
    reviewId: string,
    quality: SimpleQuality
  ): Promise<VocabularyReview | null> {
    if (!supabase) return null;

    // First fetch the current review
    const { data: currentData, error: fetchError } = await supabase
      .from('vocabulary_reviews')
      .select('*')
      .eq('id', reviewId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !currentData) {
      console.error('Error fetching review for update:', fetchError);
      return null;
    }

    const currentReview = dbToVocabularyReview(currentData);
    const sm2Quality = simpleToSM2Quality(quality);
    
    // Calculate new SM-2 values
    const { easeFactor, interval, repetitions, nextReviewDate, isMastered } = calculateNextReview(
      currentReview,
      sm2Quality
    );

    // Update stats
    const isCorrect = sm2Quality >= 3;
    const newCorrectCount = isCorrect ? currentReview.correctCount + 1 : currentReview.correctCount;
    const newIncorrectCount = !isCorrect ? currentReview.incorrectCount + 1 : currentReview.incorrectCount;

    // Update the review
    const { data, error } = await supabase
      .from('vocabulary_reviews')
      .update({
        ease_factor: easeFactor,
        interval: interval,
        repetitions: repetitions,
        next_review_date: nextReviewDate.toISOString(),
        last_review_date: new Date().toISOString(),
        is_mastered: isMastered,
        correct_count: newCorrectCount,
        incorrect_count: newIncorrectCount,
      })
      .eq('id', reviewId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating review after answer:', error);
      return null;
    }

    return dbToVocabularyReview(data);
  },

  /**
   * Suspend a word (mark as "don't show again")
   */
  async suspendWord(userId: string, reviewId: string, suspended: boolean = true): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase
      .from('vocabulary_reviews')
      .update({ is_suspended: suspended })
      .eq('id', reviewId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error suspending word:', error);
      return false;
    }

    return true;
  },

  /**
   * Sync vocabulary from saved analyses to the review system
   * Creates new review records for any vocabulary not already in the system
   */
  async syncVocabFromAnalyses(userId: string, analyses: SavedAnalysis[]): Promise<number> {
    if (!supabase || analyses.length === 0) {
      console.log('syncVocabFromAnalyses: No supabase or empty analyses');
      return 0;
    }

    console.log(`syncVocabFromAnalyses: Processing ${analyses.length} analyses for user ${userId}`);

    // Count total vocabulary items in all analyses
    let totalVocabInAnalyses = 0;
    for (const analysis of analyses) {
      const vocabCount = analysis.analysisResult?.vocabulary?.length || 0;
      totalVocabInAnalyses += vocabCount;
    }
    console.log(`syncVocabFromAnalyses: Total vocabulary items in analyses: ${totalVocabInAnalyses}`);

    if (totalVocabInAnalyses === 0) {
      console.log('syncVocabFromAnalyses: No vocabulary found in any analysis');
      return 0;
    }

    // Get existing terms
    const { data: existingData, error: fetchError } = await supabase
      .from('vocabulary_reviews')
      .select('term')
      .eq('user_id', userId);

    if (fetchError) {
      console.error('syncVocabFromAnalyses: Error fetching existing terms:', fetchError);
      throw fetchError;
    }

    const existingTerms = new Set((existingData || []).map(r => r.term.toLowerCase()));
    console.log(`syncVocabFromAnalyses: Found ${existingTerms.size} existing terms`);

    // Collect all new vocabulary items - WITHOUT source_analysis_id foreign key constraint
    const newReviews: Array<{
      user_id: string;
      term: string;
      definition: string;
      ease_factor: number;
      interval: number;
      repetitions: number;
      next_review_date: string;
      created_at: string;
      is_suspended: boolean;
      is_mastered: boolean;
      correct_count: number;
      incorrect_count: number;
      category: string | null;
      source_context: string | null;
      examples: object | null;
      imagery_etymology: string | null;
      difficulty_level: string | null;
    }> = [];

    // Sort analyses by date ascending (oldest first) so older vocab gets earlier created_at
    const sortedAnalyses = [...analyses].sort((a, b) => a.date - b.date);

    for (const analysis of sortedAnalyses) {
      if (!analysis.analysisResult?.vocabulary) continue;
      
      // Use the analysis date for created_at so older analyses' vocab appears first
      const analysisDate = new Date(analysis.date);
      
      for (const vocab of analysis.analysisResult.vocabulary) {
        if (!vocab.term || !vocab.definition) continue;
        
        // Skip if already exists (case-insensitive)
        if (existingTerms.has(vocab.term.toLowerCase())) continue;

        // Mark as added to avoid duplicates in this batch
        existingTerms.add(vocab.term.toLowerCase());

        newReviews.push({
          user_id: userId,
          term: vocab.term,
          definition: vocab.definition,
          ease_factor: 2.5,
          interval: 0,
          repetitions: 0,
          next_review_date: analysisDate.toISOString(),
          created_at: analysisDate.toISOString(),
          is_suspended: false,
          is_mastered: false,
          correct_count: 0,
          incorrect_count: 0,
          category: vocab.category || null,
          source_context: vocab.source_context || null,
          examples: vocab.examples || null,
          imagery_etymology: vocab.imagery_etymology || null,
          difficulty_level: vocab.difficulty_level || null,
        });
      }
    }

    console.log(`syncVocabFromAnalyses: ${newReviews.length} new terms to insert`);

    if (newReviews.length === 0) return 0;

    // Insert in batches of 100
    const batchSize = 100;
    let insertedCount = 0;

    for (let i = 0; i < newReviews.length; i += batchSize) {
      const batch = newReviews.slice(i, i + batchSize);
      console.log(`syncVocabFromAnalyses: Inserting batch ${i / batchSize + 1}, size: ${batch.length}`);
      
      const { data, error } = await supabase
        .from('vocabulary_reviews')
        .insert(batch)
        .select();

      if (error) {
        console.error('Error syncing vocabulary batch:', error);
        console.error('First item in failed batch:', JSON.stringify(batch[0], null, 2));
        throw new Error(`Failed to sync vocabulary: ${error.message}`);
      } else {
        console.log(`syncVocabFromAnalyses: Successfully inserted ${data?.length || batch.length} items`);
        insertedCount += data?.length || batch.length;
      }
    }

    console.log(`Synced ${insertedCount} new vocabulary items to review system`);
    return insertedCount;
  },

  /**
   * Delete a vocabulary review
   */
  async deleteVocabularyReview(userId: string, reviewId: string): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase
      .from('vocabulary_reviews')
      .delete()
      .eq('id', reviewId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting vocabulary review:', error);
      return false;
    }

    return true;
  },
};

