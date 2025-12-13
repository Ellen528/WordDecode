import React from 'react';
import { X, Volume2, Check, HelpCircle, BarChart3 } from 'lucide-react';
import { VocabularyItem, UserProficiency, EnglishTestType } from '../types';
import { generateSpeech } from '../services/geminiService';

interface Props {
    item: VocabularyItem;
    position: { x: number; y: number };
    isKnown: boolean | null; // null = not marked yet
    onClose: () => void;
    onMarkKnown: (term: string, isKnown: boolean) => void;
    proficiency?: UserProficiency | null;
}

// Get color based on difficulty relative to user's level
const getDifficultyStyle = (difficultyLevel: string | undefined, proficiency: UserProficiency | null | undefined): { bg: string; text: string } => {
    if (!difficultyLevel) {
        return { bg: 'bg-slate-100', text: 'text-slate-600' };
    }

    if (!proficiency) {
        return { bg: 'bg-indigo-100', text: 'text-indigo-700' };
    }

    // Extract numeric value from difficulty level
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

    const vocabScore = extractScore(difficultyLevel, proficiency.testType);
    const userScore = proficiency.score;

    if (vocabScore === null) {
        return { bg: 'bg-indigo-100', text: 'text-indigo-700' };
    }

    let diff: number;
    if (proficiency.testType === EnglishTestType.IELTS) {
        diff = vocabScore - userScore;
        if (diff <= 0.5) return { bg: 'bg-emerald-100', text: 'text-emerald-700' };
        if (diff <= 1.5) return { bg: 'bg-amber-100', text: 'text-amber-700' };
        return { bg: 'bg-red-100', text: 'text-red-700' };
    } else if (proficiency.testType === EnglishTestType.TOEFL) {
        diff = vocabScore - userScore;
        if (diff <= 10) return { bg: 'bg-emerald-100', text: 'text-emerald-700' };
        if (diff <= 25) return { bg: 'bg-amber-100', text: 'text-amber-700' };
        return { bg: 'bg-red-100', text: 'text-red-700' };
    } else {
        diff = vocabScore - userScore;
        if (diff <= 50) return { bg: 'bg-emerald-100', text: 'text-emerald-700' };
        if (diff <= 100) return { bg: 'bg-amber-100', text: 'text-amber-700' };
        return { bg: 'bg-red-100', text: 'text-red-700' };
    }
};

const WordPopup: React.FC<Props> = ({ item, position, isKnown, onClose, onMarkKnown, proficiency }) => {
    const [isPlaying, setIsPlaying] = React.useState(false);

    const handlePlayAudio = async () => {
        if (isPlaying) return;
        setIsPlaying(true);
        try {
            await generateSpeech(item.term);
        } finally {
            setIsPlaying(false);
        }
    };

    const diffStyle = getDifficultyStyle(item.difficulty_level, proficiency);

    // Calculate popup position to keep it on screen
    const popupStyle: React.CSSProperties = {
        position: 'fixed',
        left: Math.min(position.x - 150, window.innerWidth - 320),
        top: Math.min(position.y + 10, window.innerHeight - 350),
        zIndex: 100,
    };

    return (
        <>
            {/* Backdrop */}
            <div 
                className="fixed inset-0 z-50" 
                onClick={onClose}
            />
            
            {/* Popup */}
            <div 
                style={popupStyle}
                className="z-50 w-[300px] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-slate-900 text-white p-4">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-xl font-serif font-bold">{item.term}</h3>
                                <button
                                    onClick={handlePlayAudio}
                                    className={`p-1.5 rounded-full hover:bg-slate-700 transition-colors ${isPlaying ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`}
                                >
                                    <Volume2 className="w-4 h-4" />
                                </button>
                            </div>
                            {item.difficulty_level && (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${diffStyle.bg} ${diffStyle.text}`}>
                                    <BarChart3 className="w-3 h-3" />
                                    {item.difficulty_level}
                                </span>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1 text-slate-400 hover:text-white transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Definition */}
                <div className="p-4 border-b border-slate-100">
                    <p className="text-slate-700 leading-relaxed">{item.definition}</p>
                </div>

                {/* Context */}
                {item.source_context && (
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">In context</p>
                        <p className="text-sm text-slate-600 italic">"{item.source_context}"</p>
                    </div>
                )}

                {/* Mark Known/Unknown Buttons */}
                <div className="p-3 flex gap-2">
                    <button
                        onClick={() => onMarkKnown(item.term, true)}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg font-medium text-sm transition-all ${
                            isKnown === true
                                ? 'bg-emerald-600 text-white'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                        }`}
                    >
                        <Check className="w-4 h-4" />
                        I know this
                    </button>
                    <button
                        onClick={() => onMarkKnown(item.term, false)}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg font-medium text-sm transition-all ${
                            isKnown === false
                                ? 'bg-red-600 text-white'
                                : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                        }`}
                    >
                        <HelpCircle className="w-4 h-4" />
                        New to me
                    </button>
                </div>
            </div>
        </>
    );
};

export default WordPopup;

