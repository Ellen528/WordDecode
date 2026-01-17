-- Migration: Create saved_books table for eBook library
-- Run this in your Supabase SQL Editor

-- Drop existing tables if they exist (for clean re-run)
DROP TABLE IF EXISTS book_chapter_vocabulary CASCADE;
DROP TABLE IF EXISTS saved_books CASCADE;

CREATE TABLE saved_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  book_subject TEXT,  -- What the book teaches (e.g., "phrasal verbs", "idioms")
  file_name TEXT NOT NULL,
  page_count INTEGER NOT NULL,
  -- Book structure stored as JSONB (hierarchical chapters)
  structure JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Full text stored for chapter content extraction
  raw_text TEXT NOT NULL,
  -- Per-page text stored as JSONB array for efficient page-range extraction
  page_texts JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Progress tracking (array of chapter IDs that have been studied)
  progress JSONB DEFAULT '[]'::jsonb,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_opened_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_saved_books_user_id ON saved_books(user_id);
CREATE INDEX idx_saved_books_last_opened ON saved_books(user_id, last_opened_at DESC);

-- Enable Row Level Security
ALTER TABLE saved_books ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own books
CREATE POLICY "Users can view own saved books"
  ON saved_books FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved books"
  ON saved_books FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own saved books"
  ON saved_books FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved books"
  ON saved_books FOR DELETE
  USING (auth.uid() = user_id);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_saved_books_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER saved_books_updated_at
  BEFORE UPDATE ON saved_books
  FOR EACH ROW
  EXECUTE FUNCTION update_saved_books_updated_at();

-- Create table for book chapter vocabulary (extracted vocab per chapter)
CREATE TABLE book_chapter_vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  book_id UUID REFERENCES saved_books(id) ON DELETE CASCADE NOT NULL,
  chapter_id TEXT NOT NULL,  -- Matches the id in structure JSONB
  -- Vocabulary data stored as JSONB array
  vocabulary JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure unique chapter per book per user
  UNIQUE(user_id, book_id, chapter_id)
);

-- Create indexes
CREATE INDEX idx_book_chapter_vocab_book ON book_chapter_vocabulary(book_id);
CREATE INDEX idx_book_chapter_vocab_user ON book_chapter_vocabulary(user_id);

-- Enable RLS
ALTER TABLE book_chapter_vocabulary ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own book chapter vocabulary"
  ON book_chapter_vocabulary FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own book chapter vocabulary"
  ON book_chapter_vocabulary FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own book chapter vocabulary"
  ON book_chapter_vocabulary FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own book chapter vocabulary"
  ON book_chapter_vocabulary FOR DELETE
  USING (auth.uid() = user_id);
