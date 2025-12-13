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

// Get highlight color based on difficulty and known status
const getHighlightClass = (
    item: VocabularyItem,
    isKnown: boolean | null,
    proficiency: UserProficiency | null
): string => {
    // If marked as known, show green
    if (isKnown === true) {
        return 'bg-emerald-200 hover:bg-emerald-300 text-emerald-900';
    }
    
    // If marked as unknown, show with emphasis
    if (isKnown === false) {
        return 'bg-red-200 hover:bg-red-300 text-red-900 font-medium';
    }

    // Not marked yet - color by difficulty level
    if (!item.difficulty_level || !proficiency) {
        return 'bg-amber-200 hover:bg-amber-300 text-amber-900';
    }

    // Extract score from difficulty level
    const extractScore = (level: string, testType: EnglishTestType): number | null => {
        const normalized = level.toUpperCase();
        
        if (testType === EnglishTestType.IELTS || normalized.includes('IELTS')) {
            const match = normalized.match(/(\d+(?:\.\d+)?)/);
            if (match) return parseFloat(match[1]);
        }
        
        if (testType === EnglishTestType.TOEFL || normalized.includes('TOEFL')) {
            const match = normalized.match(/(\d+)/);
            if (match) return parseInt(match[1]);
        }
        
        if (testType === EnglishTestType.CET4 || testType === EnglishTestType.CET6 || normalized.includes('CET')) {
            const match = normalized.match(/(\d{3,})/);
            if (match) return parseInt(match[1]);
        }

        return null;
    };

    const vocabScore = extractScore(item.difficulty_level, proficiency.testType);
    const userScore = proficiency.score;

    if (vocabScore === null) {
        return 'bg-amber-200 hover:bg-amber-300 text-amber-900';
    }

    // Compare scores
    let diff: number;
    if (proficiency.testType === EnglishTestType.IELTS) {
        diff = vocabScore - userScore;
        if (diff <= 0.5) return 'bg-yellow-200 hover:bg-yellow-300 text-yellow-900'; // At level
        if (diff <= 1.5) return 'bg-orange-200 hover:bg-orange-300 text-orange-900'; // Slightly above
        return 'bg-red-200 hover:bg-red-300 text-red-900'; // Advanced
    } else if (proficiency.testType === EnglishTestType.TOEFL) {
        diff = vocabScore - userScore;
        if (diff <= 10) return 'bg-yellow-200 hover:bg-yellow-300 text-yellow-900';
        if (diff <= 25) return 'bg-orange-200 hover:bg-orange-300 text-orange-900';
        return 'bg-red-200 hover:bg-red-300 text-red-900';
    } else {
        diff = vocabScore - userScore;
        if (diff <= 50) return 'bg-yellow-200 hover:bg-yellow-300 text-yellow-900';
        if (diff <= 100) return 'bg-orange-200 hover:bg-orange-300 text-orange-900';
        return 'bg-red-200 hover:bg-red-300 text-red-900';
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
            <div className="flex flex-wrap items-center gap-4 text-xs">
                <span className="text-slate-500">Click highlighted words:</span>
                <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-yellow-300"></span>
                    At your level
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-orange-300"></span>
                    Slightly above
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-red-300"></span>
                    Advanced
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-emerald-300"></span>
                    Marked known
                </span>
            </div>

            {/* Full Text with Highlights */}
            <div 
                className="bg-white rounded-xl p-6 shadow-sm border border-slate-200"
                onClick={() => setSelectedWord(null)}
            >
                <p className="text-lg leading-relaxed text-slate-800 font-serif whitespace-pre-wrap">
                    {highlightedText.map((part, idx) => {
                        if (part.type === 'text') {
                            return <span key={idx}>{part.content}</span>;
                        }

                        const item = part.item!;
                        const knownStatus = knownWords[item.term.toLowerCase()];
                        const isKnown = knownStatus?.isKnown ?? null;
                        const highlightClass = getHighlightClass(item, isKnown, proficiency);

                        return (
                            <span
                                key={idx}
                                onClick={(e) => handleWordClick(item, e)}
                                className={`cursor-pointer rounded px-0.5 transition-colors ${highlightClass}`}
                            >
                                {part.content}
                            </span>
                        );
                    })}
                </p>
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

