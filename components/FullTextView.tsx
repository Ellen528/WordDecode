import React, { useState, useMemo } from 'react';
import { VocabularyItem, UserProficiency, KnownWord, EnglishTestType } from '../types';
import { BookOpen, Target, TrendingUp, CheckCircle, HelpCircle, Loader2 } from 'lucide-react';
import WordPopup from './WordPopup';

interface Props {
    originalText: string;
    vocabulary: VocabularyItem[];
    proficiency: UserProficiency | null;
    knownWords: Record<string, KnownWord>;
    onMarkWord: (term: string, isKnown: boolean, difficulty_level?: string) => void;
    isLoading?: boolean;
}

// Extract numeric score from difficulty level string
const extractDifficultyScore = (level: string): number | null => {
    if (!level) return null;
    // Match first number in the string (e.g., "IELTS 6-7" -> 6, "TOEFL 80+" -> 80)
    const match = level.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : null;
};

// Get highlight color based on difficulty and known status
const getHighlightClass = (
    item: VocabularyItem,
    isKnown: boolean | null,
    proficiency: UserProficiency | null
): string => {
    // If marked as known, show green
    if (isKnown === true) {
        return 'bg-emerald-300 hover:bg-emerald-400 text-emerald-900 ring-1 ring-emerald-400';
    }
    
    // If marked as unknown, show with red emphasis
    if (isKnown === false) {
        return 'bg-rose-300 hover:bg-rose-400 text-rose-900 font-medium ring-1 ring-rose-400';
    }

    // Not marked yet - color by difficulty level
    const diffLevel = item.difficulty_level;
    
    // If no proficiency set, use a simple heuristic based on difficulty string
    if (!proficiency) {
        // Color based on the number in difficulty level
        const score = extractDifficultyScore(diffLevel || '');
        if (score === null) return 'bg-amber-200 hover:bg-amber-300 text-amber-900';
        // Assume IELTS-like scale for default
        if (score <= 5) return 'bg-sky-200 hover:bg-sky-300 text-sky-900'; // Easy
        if (score <= 6.5) return 'bg-amber-200 hover:bg-amber-300 text-amber-900'; // Medium
        if (score <= 7.5) return 'bg-orange-300 hover:bg-orange-400 text-orange-900'; // Hard
        return 'bg-rose-200 hover:bg-rose-300 text-rose-900'; // Very hard
    }

    if (!diffLevel) {
        return 'bg-amber-200 hover:bg-amber-300 text-amber-900';
    }

    const vocabScore = extractDifficultyScore(diffLevel);
    const userScore = proficiency.score;

    if (vocabScore === null) {
        return 'bg-amber-200 hover:bg-amber-300 text-amber-900';
    }

    // Compare scores based on test type
    if (proficiency.testType === EnglishTestType.IELTS) {
        const diff = vocabScore - userScore;
        if (diff <= 0) return 'bg-sky-200 hover:bg-sky-300 text-sky-900'; // Below level (easy)
        if (diff <= 0.5) return 'bg-teal-200 hover:bg-teal-300 text-teal-900'; // At level
        if (diff <= 1) return 'bg-amber-300 hover:bg-amber-400 text-amber-900'; // Slightly above
        if (diff <= 1.5) return 'bg-orange-300 hover:bg-orange-400 text-orange-900'; // Above
        return 'bg-rose-300 hover:bg-rose-400 text-rose-900'; // Advanced
    } else if (proficiency.testType === EnglishTestType.TOEFL) {
        const diff = vocabScore - userScore;
        if (diff <= 0) return 'bg-sky-200 hover:bg-sky-300 text-sky-900';
        if (diff <= 5) return 'bg-teal-200 hover:bg-teal-300 text-teal-900';
        if (diff <= 15) return 'bg-amber-300 hover:bg-amber-400 text-amber-900';
        if (diff <= 25) return 'bg-orange-300 hover:bg-orange-400 text-orange-900';
        return 'bg-rose-300 hover:bg-rose-400 text-rose-900';
    } else {
        // CET
        const diff = vocabScore - userScore;
        if (diff <= 0) return 'bg-sky-200 hover:bg-sky-300 text-sky-900';
        if (diff <= 25) return 'bg-teal-200 hover:bg-teal-300 text-teal-900';
        if (diff <= 50) return 'bg-amber-300 hover:bg-amber-400 text-amber-900';
        if (diff <= 100) return 'bg-orange-300 hover:bg-orange-400 text-orange-900';
        return 'bg-rose-300 hover:bg-rose-400 text-rose-900';
    }
};

// Calculate estimated level based on known/unknown responses
const calculateEstimatedLevel = (
    vocabulary: VocabularyItem[],
    knownWords: Record<string, KnownWord>,
    proficiency: UserProficiency | null
): { level: string; accuracy: number } | null => {
    const markedItems = vocabulary.filter(v => knownWords[v.term.toLowerCase()]);
    if (markedItems.length < 5) return null; // Need at least 5 responses

    // Extract numeric levels from difficulty_level strings
    const extractLevel = (level: string | undefined): number | null => {
        if (!level) return null;
        const match = level.match(/(\d+(?:\.\d+)?)/);
        return match ? parseFloat(match[1]) : null;
    };

    // Find the highest level they know and lowest they don't
    let knownLevels: number[] = [];
    let unknownLevels: number[] = [];

    markedItems.forEach(item => {
        const level = extractLevel(item.difficulty_level);
        if (level === null) return;
        
        const known = knownWords[item.term.toLowerCase()];
        if (known?.isKnown) {
            knownLevels.push(level);
        } else {
            unknownLevels.push(level);
        }
    });

    if (knownLevels.length === 0 && unknownLevels.length === 0) return null;

    // Estimate level as between highest known and lowest unknown
    const maxKnown = knownLevels.length > 0 ? Math.max(...knownLevels) : 0;
    const minUnknown = unknownLevels.length > 0 ? Math.min(...unknownLevels) : 10;
    const estimatedScore = (maxKnown + minUnknown) / 2;

    const testType = proficiency?.testType || EnglishTestType.IELTS;
    const accuracy = Math.round((markedItems.length / vocabulary.length) * 100);

    return {
        level: `${testType} ${estimatedScore.toFixed(1)}`,
        accuracy
    };
};

const FullTextView: React.FC<Props> = ({
    originalText,
    vocabulary,
    proficiency,
    knownWords,
    onMarkWord,
    isLoading = false
}) => {
    const [selectedWord, setSelectedWord] = useState<{ item: VocabularyItem; position: { x: number; y: number } } | null>(null);

    // Build a map of terms to vocabulary items for quick lookup
    const vocabMap = useMemo(() => {
        const map = new Map<string, VocabularyItem>();
        vocabulary.forEach(item => {
            // Store with lowercase key for case-insensitive matching
            map.set(item.term.toLowerCase(), item);
        });
        return map;
    }, [vocabulary]);

    // Parse text and highlight vocabulary
    const highlightedText = useMemo(() => {
        if (!originalText || vocabulary.length === 0) {
            return [{ type: 'text' as const, content: originalText }];
        }

        // Sort vocabulary by term length (longest first) to avoid partial matches
        const sortedTerms = [...vocabulary]
            .sort((a, b) => b.term.length - a.term.length)
            .map(v => v.term);

        // Build regex pattern for all terms
        const escapedTerms = sortedTerms.map(term => 
            term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        );
        const pattern = new RegExp(`\\b(${escapedTerms.join('|')})\\b`, 'gi');

        // Split text by matches
        const parts: Array<{ type: 'text' | 'highlight'; content: string; item?: VocabularyItem }> = [];
        let lastIndex = 0;
        let match;

        while ((match = pattern.exec(originalText)) !== null) {
            // Add text before match
            if (match.index > lastIndex) {
                parts.push({
                    type: 'text',
                    content: originalText.slice(lastIndex, match.index)
                });
            }

            // Add highlighted term
            const matchedTerm = match[0];
            const item = vocabMap.get(matchedTerm.toLowerCase());
            if (item) {
                parts.push({
                    type: 'highlight',
                    content: matchedTerm,
                    item
                });
            } else {
                parts.push({
                    type: 'text',
                    content: matchedTerm
                });
            }

            lastIndex = pattern.lastIndex;
        }

        // Add remaining text
        if (lastIndex < originalText.length) {
            parts.push({
                type: 'text',
                content: originalText.slice(lastIndex)
            });
        }

        return parts;
    }, [originalText, vocabulary, vocabMap]);

    // Calculate stats
    const stats = useMemo(() => {
        const total = vocabulary.length;
        const marked = vocabulary.filter(v => knownWords[v.term.toLowerCase()]).length;
        const known = vocabulary.filter(v => knownWords[v.term.toLowerCase()]?.isKnown).length;
        const unknown = vocabulary.filter(v => knownWords[v.term.toLowerCase()]?.isKnown === false).length;
        return { total, marked, known, unknown };
    }, [vocabulary, knownWords]);

    const estimatedLevel = useMemo(() => 
        calculateEstimatedLevel(vocabulary, knownWords, proficiency),
        [vocabulary, knownWords, proficiency]
    );

    const handleWordClick = (item: VocabularyItem, event: React.MouseEvent) => {
        event.stopPropagation();
        setSelectedWord({
            item,
            position: { x: event.clientX, y: event.clientY }
        });
    };

    const handleMarkWord = (term: string, isKnown: boolean) => {
        const item = vocabMap.get(term.toLowerCase());
        onMarkWord(term, isKnown, item?.difficulty_level);
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                <p className="text-lg text-slate-600">Analyzing text for vocabulary...</p>
                <p className="text-sm text-slate-400 mt-2">Extracting all words you might not know</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Stats Bar */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    {/* Progress */}
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-slate-400" />
                            <span className="text-sm text-slate-600">
                                <strong className="text-slate-900">{vocabulary.length}</strong> vocabulary items
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Target className="w-5 h-5 text-indigo-500" />
                            <span className="text-sm text-slate-600">
                                <strong className="text-indigo-600">{stats.marked}</strong> / {stats.total} marked
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1 text-sm">
                                <CheckCircle className="w-4 h-4 text-emerald-500" />
                                <strong className="text-emerald-600">{stats.known}</strong> known
                            </span>
                            <span className="flex items-center gap-1 text-sm">
                                <HelpCircle className="w-4 h-4 text-red-500" />
                                <strong className="text-red-600">{stats.unknown}</strong> new
                            </span>
                        </div>
                    </div>

                    {/* Estimated Level */}
                    {estimatedLevel && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-lg">
                            <TrendingUp className="w-4 h-4 text-indigo-600" />
                            <span className="text-sm text-indigo-700">
                                Estimated level: <strong>{estimatedLevel.level}</strong>
                            </span>
                            <span className="text-xs text-indigo-500">
                                ({estimatedLevel.accuracy}% marked)
                            </span>
                        </div>
                    )}
                </div>

                {/* Progress Bar */}
                <div className="mt-3">
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full flex">
                            <div 
                                className="bg-emerald-500 transition-all duration-300"
                                style={{ width: `${stats.total > 0 ? (stats.known / stats.total) * 100 : 0}%` }}
                            />
                            <div 
                                className="bg-red-400 transition-all duration-300"
                                style={{ width: `${stats.total > 0 ? (stats.unknown / stats.total) * 100 : 0}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Color Legend */}
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span className="text-slate-600 font-medium">Difficulty levels:</span>
                    <span className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-full border">
                        <span className="w-3 h-3 rounded-full bg-sky-300"></span>
                        Easy
                    </span>
                    <span className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-full border">
                        <span className="w-3 h-3 rounded-full bg-teal-300"></span>
                        At level
                    </span>
                    <span className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-full border">
                        <span className="w-3 h-3 rounded-full bg-amber-300"></span>
                        Learning zone
                    </span>
                    <span className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-full border">
                        <span className="w-3 h-3 rounded-full bg-orange-400"></span>
                        Challenging
                    </span>
                    <span className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-full border">
                        <span className="w-3 h-3 rounded-full bg-rose-400"></span>
                        Advanced
                    </span>
                    <span className="ml-2 border-l pl-3 flex items-center gap-1.5 px-2 py-1 bg-white rounded-full border">
                        <span className="w-3 h-3 rounded-full bg-emerald-400"></span>
                        Known ✓
                    </span>
                </div>
            </div>

            {/* Full Text with Highlights */}
            <div 
                className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
                onClick={() => setSelectedWord(null)}
            >
                {/* Render text with proper paragraph formatting */}
                <div className="p-6 md:p-8">
                    {(() => {
                        // First, reconstruct the full text with markers for highlights
                        let fullText = '';
                        const highlightPositions: Array<{ start: number; end: number; item: VocabularyItem; originalText: string }> = [];
                        
                        highlightedText.forEach(part => {
                            if (part.type === 'text') {
                                fullText += part.content;
                            } else if (part.item) {
                                const start = fullText.length;
                                fullText += part.content;
                                highlightPositions.push({
                                    start,
                                    end: fullText.length,
                                    item: part.item,
                                    originalText: part.content
                                });
                            }
                        });

                        // Detect title and separator pattern (e.g., "S05E01\n-----\nContent")
                        // Look for a line of dashes (3 or more) that acts as separator
                        const separatorPattern = /^(.+?)\n[-─—=]{3,}\n/s;
                        const separatorMatch = fullText.match(separatorPattern);
                        
                        let titleText: string | null = null;
                        let contentText = fullText;
                        
                        if (separatorMatch) {
                            titleText = separatorMatch[1].trim();
                            contentText = fullText.slice(separatorMatch[0].length);
                        }

                        // Clean the content text: remove bullets, join lines
                        let cleanedText = contentText;
                        // Remove leading dashes, bullets, asterisks from lines (but not separator lines)
                        cleanedText = cleanedText.replace(/^[\s]*[-•*]\s+/gm, '');
                        cleanedText = cleanedText.replace(/^[\s]*\d+[.)]\s*/gm, '');
                        // Remove any remaining separator lines
                        cleanedText = cleanedText.replace(/^[-─—=]{3,}$/gm, '');
                        // Replace newlines with spaces
                        cleanedText = cleanedText.replace(/\n+/g, ' ');
                        // Collapse multiple spaces
                        cleanedText = cleanedText.replace(/  +/g, ' ').trim();

                        // Split into sentences (approximately)
                        const sentencePattern = /([^.!?]+[.!?]+\s*)/g;
                        const sentences: string[] = [];
                        let match;
                        let lastIndex = 0;
                        
                        while ((match = sentencePattern.exec(cleanedText)) !== null) {
                            sentences.push(match[1]);
                            lastIndex = sentencePattern.lastIndex;
                        }
                        // Add any remaining text
                        if (lastIndex < cleanedText.length) {
                            const remaining = cleanedText.slice(lastIndex).trim();
                            if (remaining) sentences.push(remaining);
                        }

                        // Group sentences into paragraphs (4-6 sentences each)
                        const SENTENCES_PER_PARAGRAPH = 5;
                        const paragraphs: string[] = [];
                        
                        for (let i = 0; i < sentences.length; i += SENTENCES_PER_PARAGRAPH) {
                            const chunk = sentences.slice(i, i + SENTENCES_PER_PARAGRAPH);
                            paragraphs.push(chunk.join('').trim());
                        }

                        // Now render each paragraph with highlights
                        const renderParagraphWithHighlights = (paragraphText: string, pIdx: number) => {
                            // Find position of this paragraph in cleaned text
                            let searchStart = 0;
                            for (let i = 0; i < pIdx; i++) {
                                searchStart += paragraphs[i].length + 1; // +1 for space between paragraphs
                            }

                            // Build elements for this paragraph
                            const elements: React.ReactNode[] = [];
                            let currentPos = 0;
                            
                            // Sort vocab by term length (longest first) for this paragraph
                            const sortedVocab = [...vocabulary].sort((a, b) => b.term.length - a.term.length);
                            
                            // Find all matches in this paragraph
                            const matches: Array<{ start: number; end: number; item: VocabularyItem; text: string }> = [];
                            
                            sortedVocab.forEach(item => {
                                const regex = new RegExp(`\\b${item.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
                                let m;
                                while ((m = regex.exec(paragraphText)) !== null) {
                                    // Check if this position overlaps with existing match
                                    const overlaps = matches.some(existing => 
                                        !(m.index >= existing.end || m.index + m[0].length <= existing.start)
                                    );
                                    if (!overlaps) {
                                        matches.push({
                                            start: m.index,
                                            end: m.index + m[0].length,
                                            item,
                                            text: m[0]
                                        });
                                    }
                                }
                            });

                            // Sort matches by position
                            matches.sort((a, b) => a.start - b.start);

                            // Build paragraph content
                            matches.forEach((match, mIdx) => {
                                // Add text before this match
                                if (match.start > currentPos) {
                                    elements.push(
                                        <span key={`t-${pIdx}-${mIdx}`}>{paragraphText.slice(currentPos, match.start)}</span>
                                    );
                                }

                                // Add highlighted word
                                const knownStatus = knownWords[match.item.term.toLowerCase()];
                                const isKnown = knownStatus?.isKnown ?? null;
                                const highlightClass = getHighlightClass(match.item, isKnown, proficiency);

                                elements.push(
                                    <span
                                        key={`h-${pIdx}-${mIdx}`}
                                        onClick={(e) => handleWordClick(match.item, e)}
                                        className={`cursor-pointer rounded px-1 py-0.5 transition-all hover:scale-105 ${highlightClass}`}
                                        title={match.item.difficulty_level || 'Click for definition'}
                                    >
                                        {match.text}
                                    </span>
                                );

                                currentPos = match.end;
                            });

                            // Add remaining text
                            if (currentPos < paragraphText.length) {
                                elements.push(
                                    <span key={`t-${pIdx}-end`}>{paragraphText.slice(currentPos)}</span>
                                );
                            }

                            return elements;
                        };

                        return (
                            <article className="prose prose-lg max-w-none font-serif">
                                {/* Title and separator if detected */}
                                {titleText && (
                                    <div className="mb-6">
                                        <h2 className="text-2xl font-bold text-slate-900 mb-3">{titleText}</h2>
                                        <hr className="border-t-2 border-slate-300" />
                                    </div>
                                )}
                                
                                {/* Paragraphs */}
                                <div className="space-y-6">
                                    {paragraphs.map((para, pIdx) => (
                                        <p 
                                            key={`p-${pIdx}`} 
                                            className="text-lg leading-relaxed text-slate-800 text-justify"
                                        >
                                            {renderParagraphWithHighlights(para, pIdx)}
                                        </p>
                                    ))}
                                </div>
                            </article>
                        );
                    })()}
                </div>

                {/* Vocabulary count footer */}
                <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 text-sm text-slate-500">
                    <strong className="text-slate-700">{vocabulary.length}</strong> vocabulary items highlighted • 
                    Click any highlighted word to see its definition
                </div>
            </div>

            {/* Word Popup */}
            {selectedWord && (
                <WordPopup
                    item={selectedWord.item}
                    position={selectedWord.position}
                    isKnown={knownWords[selectedWord.item.term.toLowerCase()]?.isKnown ?? null}
                    onClose={() => setSelectedWord(null)}
                    onMarkKnown={handleMarkWord}
                    proficiency={proficiency}
                />
            )}
        </div>
    );
};

export default FullTextView;

