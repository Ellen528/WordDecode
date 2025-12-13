import React, { useState, useEffect } from 'react';
import { X, Settings, GraduationCap } from 'lucide-react';
import { EnglishTestType, UserProficiency, TEST_SCORE_RANGES } from '../types';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    proficiency: UserProficiency | null;
    onSaveProficiency: (proficiency: UserProficiency) => void;
}

const SettingsModal: React.FC<Props> = ({ isOpen, onClose, proficiency, onSaveProficiency }) => {
    const [testType, setTestType] = useState<EnglishTestType>(EnglishTestType.IELTS);
    const [score, setScore] = useState<number>(6);

    // Initialize from saved proficiency
    useEffect(() => {
        if (proficiency) {
            setTestType(proficiency.testType);
            setScore(proficiency.score);
        }
    }, [proficiency, isOpen]);

    if (!isOpen) return null;

    const currentRange = TEST_SCORE_RANGES[testType];

    const handleTestTypeChange = (newType: EnglishTestType) => {
        setTestType(newType);
        // Set a sensible default score for each test type
        const defaults: Record<EnglishTestType, number> = {
            [EnglishTestType.IELTS]: 6,
            [EnglishTestType.TOEFL]: 80,
            [EnglishTestType.CET4]: 500,
            [EnglishTestType.CET6]: 500,
        };
        setScore(defaults[newType]);
    };

    const handleSave = () => {
        onSaveProficiency({ testType, score });
        onClose();
    };

    const getScoreLabel = () => {
        if (testType === EnglishTestType.IELTS) {
            if (score <= 4) return 'Basic';
            if (score <= 5.5) return 'Intermediate (B1)';
            if (score <= 6.5) return 'Upper-Intermediate (B2)';
            if (score <= 7.5) return 'Advanced (C1)';
            return 'Expert (C2)';
        }
        if (testType === EnglishTestType.TOEFL) {
            if (score < 42) return 'Basic';
            if (score < 72) return 'Intermediate (B1)';
            if (score < 95) return 'Upper-Intermediate (B2)';
            if (score < 114) return 'Advanced (C1)';
            return 'Expert (C2)';
        }
        if (testType === EnglishTestType.CET4 || testType === EnglishTestType.CET6) {
            if (score < 425) return 'Below Pass';
            if (score < 500) return 'Pass';
            if (score < 550) return 'Good';
            if (score < 600) return 'Very Good';
            return 'Excellent';
        }
        return '';
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-white">
                        <Settings className="w-5 h-5" />
                        <h2 className="text-lg font-bold">Settings</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Proficiency Section */}
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <GraduationCap className="w-5 h-5 text-indigo-600" />
                            <h3 className="font-semibold text-slate-800">English Proficiency Level</h3>
                        </div>
                        <p className="text-sm text-slate-500 mb-4">
                            Set your current English level to get vocabulary difficulty labels tailored to you.
                        </p>

                        {/* Test Type Selection */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Test Type
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.values(EnglishTestType).map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => handleTestTypeChange(type)}
                                        className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                                            testType === type
                                                ? 'bg-indigo-600 text-white shadow-lg'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Score Input */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Your Score
                            </label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="range"
                                    min={currentRange.min}
                                    max={currentRange.max}
                                    step={currentRange.step}
                                    value={score}
                                    onChange={(e) => setScore(parseFloat(e.target.value))}
                                    className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                />
                                <div className="w-16 text-center">
                                    <span className="text-2xl font-bold text-indigo-600">{score}</span>
                                </div>
                            </div>
                            <div className="mt-2 flex justify-between text-xs text-slate-400">
                                <span>{currentRange.min}</span>
                                <span className="text-indigo-600 font-medium">{getScoreLabel()}</span>
                                <span>{currentRange.max}</span>
                            </div>
                        </div>

                        {/* Info Box */}
                        <div className="bg-indigo-50 rounded-lg p-3 text-sm text-indigo-700">
                            <strong>How it works:</strong> Vocabulary items will be labeled with their difficulty level 
                            (e.g., "IELTS 7" or "CET-6 550+"). Items at or below your level show in green, 
                            slightly above in yellow, and advanced in red.
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-lg"
                    >
                        Save Settings
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;

