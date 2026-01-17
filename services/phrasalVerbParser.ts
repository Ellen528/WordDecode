// Simple pattern-based phrasal verb extraction
// No AI needed - just regex matching the book's format

import { VocabularyItem } from "../types";

/**
 * Extract phrasal verbs from textbook content using pattern matching.
 * 
 * The book format is:
 * Line 1: "Example sentence with the phrasal verb conjugated."
 * Line 2: phrasal verb (base form, possibly with parentheses like "fit in (with)")
 * Line 3: simple definition (lowercase, no period at end)
 */
export function extractPhrasalVerbsFromText(text: string): VocabularyItem[] {
  const results: VocabularyItem[] = [];
  
  // Split into lines and clean up
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
  
  console.log('=== PATTERN-BASED EXTRACTION ===');
  console.log('Total lines to scan:', lines.length);
  console.log('=== FULL RAW TEXT ===');
  console.log(text);
  console.log('=== END RAW TEXT ===');
  
  // Check if key phrasal verbs are present
  const expectedVerbs = ['pack into', 'fit in', 'gang up', 'ask after', 'look down on'];
  console.log('=== CHECKING FOR EXPECTED PHRASAL VERBS ===');
  expectedVerbs.forEach(verb => {
    const found = text.toLowerCase().includes(verb);
    console.log(`  "${verb}": ${found ? 'FOUND' : 'NOT FOUND'}`);
  });
  
  console.log('=== ALL LINES ===');
  lines.forEach((line, i) => {
    console.log(`  [${i}] "${line}"`)
  });
  console.log('=== END LINES ===');
  
  // Pattern for phrasal verb: 2-4 lowercase words, may have parentheses
  // Examples: "pack into", "fit in (with)", "gang up (on)", "ask after"
  // More flexible: allows some punctuation and variations
  const phrasalVerbPattern = /^[a-z]+\s+[a-z]+(\s*\([a-z]+\))?(\s+[a-z]+)?$/i;
  
  // Check if a line looks like a phrasal verb (2-4 words, mostly lowercase)
  const looksLikePhrasalVerb = (line: string): boolean => {
    const words = line.split(/\s+/);
    if (words.length < 2 || words.length > 5) return false;
    // Should be mostly lowercase and short
    if (line.length > 30) return false;
    // First word should be a verb (lowercase)
    if (!/^[a-z]/.test(line)) return false;
    return true;
  };
  
  // Check if line looks like an example sentence
  const looksLikeSentence = (line: string): boolean => {
    // Starts with quote or capital, ends with punctuation, reasonably long
    return line.length > 20 && /[.!?][""]?$/.test(line);
  };
  
  // Check if line looks like a definition (lowercase, no period, explains meaning)
  const looksLikeDefinition = (line: string): boolean => {
    // Starts lowercase, doesn't end with period, moderate length
    if (line.length < 5 || line.length > 150) return false;
    // Usually starts lowercase (definitions in this book)
    if (/^[A-Z]/.test(line) && line.endsWith('.')) return false; // This is a sentence
    return true;
  };
  
  console.log('\n--- Scanning for patterns ---');
  
  for (let i = 0; i < lines.length - 2; i++) {
    const line1 = lines[i];     // Potential example sentence
    const line2 = lines[i + 1]; // Potential phrasal verb
    const line3 = lines[i + 2]; // Potential definition
    
    // Check if line2 looks like a phrasal verb
    if (looksLikePhrasalVerb(line2)) {
      console.log(`\n  Potential phrasal verb at line ${i+1}: "${line2}"`);
      console.log(`    Line before: "${line1.substring(0, 60)}..."`);
      console.log(`    Line after: "${line3.substring(0, 60)}..."`);
      
      // Check if line1 looks like an example sentence
      if (looksLikeSentence(line1)) {
        // Check if line3 looks like a definition
        if (looksLikeDefinition(line3) && !looksLikePhrasalVerb(line3)) {
          
          // Found a match!
          const term = line2;
          const example = line1.replace(/^[""]|[""]$/g, ''); // Remove quotes
          const definition = line3;
          
          console.log(`  ✓ MATCH: "${term}" - "${definition}"`);
          
          results.push({
            term,
            definition,
            category: 'phrasal_verbs',
            source_context: example,
            difficulty_level: 'intermediate',
            examples: [{
              sentence: example,
              context_label: 'From textbook',
              explanation: ''
            }]
          });
          
          // Skip the lines we've processed
          i += 2;
        } else {
          console.log(`  ✗ Line3 not a definition`);
        }
      } else {
        console.log(`  ✗ Line1 not a sentence`);
      }
    }
  }
  
  console.log(`\n=== Extracted ${results.length} phrasal verbs ===`);
  return results;
}
