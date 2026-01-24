-- Migration: Add source_type column to vocabulary_reviews for separating text analysis vs book library vocabulary

-- Add source_type column (defaults to 'text_analysis' for existing records)
ALTER TABLE vocabulary_reviews 
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'text_analysis';

-- Create index for filtering by source_type
CREATE INDEX IF NOT EXISTS idx_vocabulary_reviews_source_type 
ON vocabulary_reviews(user_id, source_type);

-- Update existing records to have 'text_analysis' as source_type (if null)
UPDATE vocabulary_reviews 
SET source_type = 'text_analysis' 
WHERE source_type IS NULL;

-- Drop the old unique constraint (user_id, term)
ALTER TABLE vocabulary_reviews 
DROP CONSTRAINT IF EXISTS vocabulary_reviews_user_id_term_key;

-- Add new unique constraint that includes source_type
-- This allows the same term to exist in both text_analysis and book_library
ALTER TABLE vocabulary_reviews 
ADD CONSTRAINT vocabulary_reviews_user_id_term_source_type_key 
UNIQUE (user_id, term, source_type);
