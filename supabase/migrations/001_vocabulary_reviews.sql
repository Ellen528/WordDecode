-- Migration: Create vocabulary_reviews table for SM-2 spaced repetition
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS vocabulary_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  term TEXT NOT NULL,
  definition TEXT NOT NULL,
  source_analysis_id UUID REFERENCES saved_analyses(id) ON DELETE SET NULL,
  -- SM-2 algorithm parameters
  ease_factor REAL DEFAULT 2.5,
  interval INTEGER DEFAULT 0,  -- days until next review
  repetitions INTEGER DEFAULT 0,
  next_review_date TIMESTAMPTZ DEFAULT NOW(),
  last_review_date TIMESTAMPTZ,
  -- User actions
  is_suspended BOOLEAN DEFAULT FALSE,  -- "don't show again"
  is_mastered BOOLEAN DEFAULT FALSE,   -- achieved mastery threshold
  -- Statistics
  correct_count INTEGER DEFAULT 0,
  incorrect_count INTEGER DEFAULT 0,
  -- Vocabulary metadata (copied from source for standalone display)
  category TEXT,
  source_context TEXT,
  examples JSONB,
  imagery_etymology TEXT,
  difficulty_level TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure unique term per user
  UNIQUE(user_id, term)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_vocabulary_reviews_user_id ON vocabulary_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_vocabulary_reviews_next_review ON vocabulary_reviews(user_id, next_review_date);
CREATE INDEX IF NOT EXISTS idx_vocabulary_reviews_not_suspended ON vocabulary_reviews(user_id, is_suspended) WHERE is_suspended = FALSE;

-- Enable Row Level Security
ALTER TABLE vocabulary_reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own reviews
CREATE POLICY "Users can view own vocabulary reviews"
  ON vocabulary_reviews FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vocabulary reviews"
  ON vocabulary_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vocabulary reviews"
  ON vocabulary_reviews FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own vocabulary reviews"
  ON vocabulary_reviews FOR DELETE
  USING (auth.uid() = user_id);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_vocabulary_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER vocabulary_reviews_updated_at
  BEFORE UPDATE ON vocabulary_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_vocabulary_reviews_updated_at();
