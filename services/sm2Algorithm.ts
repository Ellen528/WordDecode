/**
 * SM-2 Spaced Repetition Algorithm Implementation
 * 
 * Based on the SuperMemo SM-2 algorithm by Piotr Wozniak
 * https://www.supermemo.com/en/archives1990-2015/english/ol/sm2
 * 
 * Quality ratings:
 * 0 - Complete blackout, no recall at all
 * 1 - Incorrect response, but upon seeing the correct answer, it felt familiar
 * 2 - Incorrect response, but the correct answer seemed easy to recall
 * 3 - Correct response with serious difficulty
 * 4 - Correct response after hesitation
 * 5 - Perfect response with no hesitation
 */

import { ReviewQuality, SimpleQuality, VocabularyReview } from '../types';

// Constants
const MIN_EASE_FACTOR = 1.3;
const DEFAULT_EASE_FACTOR = 2.5;
const MASTERY_INTERVAL_THRESHOLD = 21; // Days - word is "mastered" after this interval

/**
 * Maps simple UI quality to SM-2 quality rating
 */
export function simpleToSM2Quality(simple: SimpleQuality): ReviewQuality {
  switch (simple) {
    case 'again': return 1;  // Incorrect
    case 'hard': return 3;   // Correct with difficulty
    case 'good': return 4;   // Correct with hesitation
    case 'easy': return 5;   // Perfect
  }
}

/**
 * Calculate the new ease factor based on quality rating
 * EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
 */
export function calculateNewEaseFactor(currentEF: number, quality: ReviewQuality): number {
  const newEF = currentEF + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  return Math.max(MIN_EASE_FACTOR, newEF);
}

/**
 * Calculate the next review interval based on SM-2 algorithm
 */
export function calculateNextInterval(
  currentInterval: number,
  repetitions: number,
  easeFactor: number,
  quality: ReviewQuality
): number {
  // If quality < 3 (incorrect), reset to beginning
  if (quality < 3) {
    return 1; // Review again in 1 day
  }

  // First successful review
  if (repetitions === 0) {
    return 1;
  }
  
  // Second successful review
  if (repetitions === 1) {
    return 6;
  }
  
  // Subsequent reviews: interval * easeFactor
  return Math.round(currentInterval * easeFactor);
}

/**
 * Calculate the next review date
 */
export function calculateNextReviewDate(intervalDays: number): Date {
  const now = new Date();
  const nextDate = new Date(now);
  nextDate.setDate(nextDate.getDate() + intervalDays);
  // Set to start of day for consistent comparison
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

/**
 * Main function: Calculate all SM-2 parameters after a review
 */
export function calculateNextReview(
  currentReview: Pick<VocabularyReview, 'easeFactor' | 'interval' | 'repetitions'>,
  quality: ReviewQuality
): {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewDate: Date;
  isMastered: boolean;
} {
  let newRepetitions: number;
  let newInterval: number;
  let newEaseFactor: number;

  // If quality < 3 (incorrect answer), reset repetitions
  if (quality < 3) {
    newRepetitions = 0;
    newInterval = 1; // Review tomorrow
    // Still update ease factor (will decrease)
    newEaseFactor = calculateNewEaseFactor(currentReview.easeFactor, quality);
  } else {
    // Correct answer
    newRepetitions = currentReview.repetitions + 1;
    newEaseFactor = calculateNewEaseFactor(currentReview.easeFactor, quality);
    newInterval = calculateNextInterval(
      currentReview.interval,
      currentReview.repetitions,
      newEaseFactor,
      quality
    );
  }

  const nextReviewDate = calculateNextReviewDate(newInterval);
  const isMastered = newInterval >= MASTERY_INTERVAL_THRESHOLD;

  return {
    easeFactor: newEaseFactor,
    interval: newInterval,
    repetitions: newRepetitions,
    nextReviewDate,
    isMastered,
  };
}

/**
 * Create a new review record with default SM-2 values
 */
export function createNewReview(
  term: string,
  definition: string,
  metadata?: {
    sourceAnalysisId?: string;
    category?: VocabularyReview['category'];
    sourceContext?: string;
    examples?: VocabularyReview['examples'];
    imageryEtymology?: string;
    difficultyLevel?: string;
  }
): Omit<VocabularyReview, 'id'> {
  const now = new Date();
  return {
    term,
    definition,
    sourceAnalysisId: metadata?.sourceAnalysisId,
    easeFactor: DEFAULT_EASE_FACTOR,
    interval: 0,
    repetitions: 0,
    nextReviewDate: now, // Due immediately (new card)
    lastReviewDate: undefined,
    isSuspended: false,
    isMastered: false,
    correctCount: 0,
    incorrectCount: 0,
    createdAt: now,
    category: metadata?.category,
    sourceContext: metadata?.sourceContext,
    examples: metadata?.examples,
    imageryEtymology: metadata?.imageryEtymology,
    difficultyLevel: metadata?.difficultyLevel,
  };
}

/**
 * Check if a review is due for today
 */
export function isDueForReview(review: VocabularyReview): boolean {
  if (review.isSuspended) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const reviewDate = new Date(review.nextReviewDate);
  reviewDate.setHours(0, 0, 0, 0);
  return reviewDate <= now;
}

/**
 * Check if a review is a new card (never reviewed)
 */
export function isNewCard(review: VocabularyReview): boolean {
  return review.repetitions === 0 && !review.lastReviewDate;
}

/**
 * Sort reviews by priority for a study session
 * Priority: Due overdue > Due today > New cards
 * Within each category: lower ease factor first (harder cards)
 */
export function sortByReviewPriority(reviews: VocabularyReview[]): VocabularyReview[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  return [...reviews].sort((a, b) => {
    const aDate = new Date(a.nextReviewDate);
    const bDate = new Date(b.nextReviewDate);
    aDate.setHours(0, 0, 0, 0);
    bDate.setHours(0, 0, 0, 0);

    const aIsNew = isNewCard(a);
    const bIsNew = isNewCard(b);

    // New cards come last
    if (aIsNew && !bIsNew) return 1;
    if (!aIsNew && bIsNew) return -1;

    // Sort by due date (overdue first)
    const dateDiff = aDate.getTime() - bDate.getTime();
    if (dateDiff !== 0) return dateDiff;

    // Same due date: sort by ease factor (harder cards first)
    return a.easeFactor - b.easeFactor;
  });
}

/**
 * Get human-readable interval description
 */
export function getIntervalDescription(intervalDays: number): string {
  if (intervalDays === 0) return 'New';
  if (intervalDays === 1) return '1 day';
  if (intervalDays < 7) return `${intervalDays} days`;
  if (intervalDays < 30) {
    const weeks = Math.round(intervalDays / 7);
    return weeks === 1 ? '1 week' : `${weeks} weeks`;
  }
  if (intervalDays < 365) {
    const months = Math.round(intervalDays / 30);
    return months === 1 ? '1 month' : `${months} months`;
  }
  const years = Math.round(intervalDays / 365);
  return years === 1 ? '1 year' : `${years} years`;
}

/**
 * Preview what intervals would result from each quality choice
 */
export function previewIntervals(
  currentReview: Pick<VocabularyReview, 'easeFactor' | 'interval' | 'repetitions'>
): Record<SimpleQuality, string> {
  const qualities: SimpleQuality[] = ['again', 'hard', 'good', 'easy'];
  const result: Record<SimpleQuality, string> = {} as Record<SimpleQuality, string>;

  for (const simple of qualities) {
    const sm2Quality = simpleToSM2Quality(simple);
    const { interval } = calculateNextReview(currentReview, sm2Quality);
    result[simple] = getIntervalDescription(interval);
  }

  return result;
}
