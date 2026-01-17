import React, { useState } from 'react';
import { BookChapter, VocabularyItem, VocabularyCategory } from '../types';
import { generateSpeech, generateVocabularyFromTerms } from '../services/geminiService';
import { 
  CheckCircle2, 
  Circle, 
  Loader2, 
  Sparkles, 
  Volume2, 
  BookOpen,
  GraduationCap,
  X,
  Quote,
  ArrowRightCircle,
  MessageCircle,
  Layout,
  BarChart3,
  Edit3,
  Wand2
} from 'lucide-react';

interface ChapterViewProps {
  chapter: BookChapter;
  vocabulary: VocabularyItem[];
  isStudied: boolean;
  onMarkStudied: () => void;
  onVocabularyGenerated: (vocab: VocabularyItem[]) => void;
  onVocabularyUpdated: (vocab: VocabularyItem[]) => void;  // For add/delete operations
  bookSubject?: string;
}

// Category configuration for styling
const CATEGORY_CONFIG: Record<VocabularyCategory, { label: string; color: string; icon: React.ReactNode }> = {
  'idioms_fixed': {
    label: 'Idioms & Fixed Expressions',
    color: 'text-purple-700 bg-purple-50 border-purple-100',
    icon: <Sparkles className="w-5 h-5" />
  },
  'phrasal_verbs': {
    label: 'Phrasal Verbs',
    color: 'text-blue-700 bg-blue-50 border-blue-100',
    icon: <ArrowRightCircle className="w-5 h-5" />
  },
  'nuance_sarcasm': {
    label: 'Nuance & Sarcasm',
    color: 'text-pink-700 bg-pink-50 border-pink-100',
    icon: <MessageCircle className="w-5 h-5" />
  },
  'chunks_structures': {
    label: 'Structures & "Chunks"',
    color: 'text-indigo-700 bg-indigo-50 border-indigo-100',
    icon: <Layout className="w-5 h-5" />
  },
  'topic_specific': {
    label: 'Topic Specific Jargon',
    color: 'text-orange-700 bg-orange-50 border-orange-100',
    icon: <BookOpen className="w-5 h-5" />
  }
};

const ChapterView: React.FC<ChapterViewProps> = ({
  chapter,
  vocabulary,
  isStudied,
  onMarkStudied,
  onVocabularyGenerated,
  onVocabularyUpdated,
  bookSubject,
}) => {
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [playingText, setPlayingText] = useState<string | null>(null);
  
  // Manual entry state
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualTerms, setManualTerms] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAddMode, setIsAddMode] = useState(false); // true = add to existing, false = replace

  // Handle manual vocabulary generation
  const handleGenerateFromTerms = async () => {
    const terms = manualTerms
      .split(/[\n,]/)
      .map(t => t.trim())
      .filter(t => t.length > 0);
    
    if (terms.length === 0) {
      alert('Please enter at least one term');
      return;
    }
    
    setIsGenerating(true);
    try {
      const category = bookSubject?.toLowerCase().includes('phrasal') ? 'phrasal_verbs' : 'topic_specific';
      const generatedVocab = await generateVocabularyFromTerms(terms, category);
      
      if (isAddMode && vocabulary.length > 0) {
        // Add to existing vocabulary
        const combinedVocab = [...vocabulary, ...generatedVocab];
        onVocabularyUpdated(combinedVocab);
      } else {
        // Replace vocabulary
        onVocabularyGenerated(generatedVocab);
      }
      
      setShowManualEntry(false);
      setManualTerms('');
      setIsAddMode(false);
    } catch (error) {
      console.error('Error generating vocabulary:', error);
      alert('Failed to generate vocabulary. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Delete a vocabulary item
  const handleDeleteItem = (indexToDelete: number) => {
    if (confirm('Remove this vocabulary item?')) {
      const updatedVocab = vocabulary.filter((_, idx) => idx !== indexToDelete);
      onVocabularyUpdated(updatedVocab);
    }
  };

  // Open add mode
  const handleAddMore = () => {
    setIsAddMode(true);
    setShowManualEntry(true);
  };

  // Play pronunciation
  const handlePlayAudio = async (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    if (playingText) return;
    
    setPlayingText(text);
    try {
      await generateSpeech(text);
    } finally {
      setPlayingText(null);
    }
  };

  // Flashcard navigation
  const nextCard = () => {
    setShowAnswer(false);
    if (currentCardIndex < vocabulary.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
    }
  };

  const prevCard = () => {
    setShowAnswer(false);
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1);
    }
  };

  // Reset flashcards
  const resetFlashcards = () => {
    setCurrentCardIndex(0);
    setShowAnswer(false);
  };

  const currentCard = vocabulary[currentCardIndex];

  // Get category config with fallback
  const getCategoryConfig = (category: VocabularyCategory) => {
    return CATEGORY_CONFIG[category] || CATEGORY_CONFIG['topic_specific'];
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Chapter Header */}
      <div className="flex-shrink-0 p-6 border-b border-slate-200 bg-white">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{chapter.title}</h1>
            {bookSubject && (
              <p className="text-sm text-emerald-600 mt-1 flex items-center gap-1">
                <BookOpen className="w-4 h-4" />
                Learning: {bookSubject}
              </p>
            )}
            {chapter.pageStart && (
              <p className="text-sm text-slate-400 mt-1">
                Pages {chapter.pageStart}
                {chapter.pageEnd && chapter.pageEnd !== chapter.pageStart && ` - ${chapter.pageEnd}`}
              </p>
            )}
          </div>
          
          <button
            onClick={onMarkStudied}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              isStudied
                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {isStudied ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm font-medium">Studied</span>
              </>
            ) : (
              <>
                <Circle className="w-4 h-4" />
                <span className="text-sm font-medium">Mark as Studied</span>
              </>
            )}
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-4 flex-wrap">
          {/* Manual Entry Button */}
          <button
            onClick={() => setShowManualEntry(!showManualEntry)}
            disabled={isGenerating}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              showManualEntry
                ? 'bg-blue-600 text-white'
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            Manual Entry
          </button>

          {vocabulary.length > 0 && (
            <button
              onClick={() => {
                resetFlashcards();
                setShowFlashcards(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <GraduationCap className="w-4 h-4" />
              Practice Flashcards ({vocabulary.length})
            </button>
          )}
        </div>
        
        {/* Manual Entry Panel */}
        {showManualEntry && (
          <div className={`mt-4 p-4 rounded-lg ${isAddMode ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200'}`}>
            <h4 className={`text-sm font-medium mb-2 ${isAddMode ? 'text-green-800' : 'text-blue-800'}`}>
              {isAddMode ? 'Add More Terms' : 'Enter Phrasal Verbs / Terms'}
            </h4>
            <p className={`text-xs mb-3 ${isAddMode ? 'text-green-600' : 'text-blue-600'}`}>
              {isAddMode 
                ? `Adding to existing ${vocabulary.length} terms. Enter one term per line, or separate with commas.`
                : 'Enter one term per line, or separate with commas. AI will generate definitions and example sentences.'
              }
            </p>
            <textarea
              value={manualTerms}
              onChange={(e) => setManualTerms(e.target.value)}
              placeholder="pack into&#10;fit in (with)&#10;gang up (on)&#10;ask after&#10;look down on"
              className="w-full h-32 p-3 text-sm border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleGenerateFromTerms}
                disabled={isGenerating || !manualTerms.trim()}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isGenerating || !manualTerms.trim()
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : isAddMode 
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    {isAddMode ? 'Add Terms' : 'Generate Vocabulary'}
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowManualEntry(false);
                  setManualTerms('');
                  setIsAddMode(false);
                }}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Vocabulary Cards - Full Width */}
      <div className="flex-1 overflow-y-auto p-6">
        {vocabulary.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Sparkles className="w-16 h-16 mb-4 opacity-30" />
            <h3 className="text-lg font-medium text-slate-600 mb-2">No vocabulary extracted yet</h3>
            <p className="text-sm text-center max-w-md">
              Click "Extract {bookSubject || 'Vocabulary'}" above to identify key terms from this chapter
              {bookSubject && ` that relate to ${bookSubject}`}.
            </p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Stats Bar */}
            <div className="bg-white rounded-lg p-4 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-600">
                  <span className="font-bold text-slate-800">{vocabulary.length}</span> terms extracted
                </span>
                {bookSubject && (
                  <span className="text-sm bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                    {bookSubject}
                  </span>
                )}
              </div>
              <button
                onClick={handleAddMore}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Edit3 className="w-4 h-4" />
                Add More
              </button>
            </div>

            {/* Vocabulary Cards - AnalysisView Style */}
            {vocabulary.map((item, idx) => {
              const config = getCategoryConfig(item.category);
              
              return (
                <div
                  key={idx}
                  className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-lg transition-all overflow-hidden group"
                >
                  <div className="p-6 pb-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-2xl font-serif font-bold text-slate-900">{item.term}</h3>
                        <button
                          onClick={(e) => handlePlayAudio(e, item.term)}
                          className={`p-2 rounded-full hover:bg-slate-100 transition-colors ${
                            playingText === item.term ? 'text-emerald-500 animate-pulse' : 'text-slate-400'
                          }`}
                        >
                          <Volume2 className="w-5 h-5" />
                        </button>
                        {/* Category Badge */}
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${config.color}`}>
                          {config.icon}
                          {config.label}
                        </span>
                        {/* Difficulty Badge */}
                        {item.difficulty_level && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                            <BarChart3 className="w-3 h-3" />
                            {item.difficulty_level}
                          </span>
                        )}
                      </div>
                      {/* Delete Button - shows on hover */}
                      <button
                        onClick={() => handleDeleteItem(idx)}
                        className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="Remove this item"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <p className="text-slate-600 text-lg mb-4">{item.definition}</p>
                    
                    {/* Example sentence - show prominently for phrasal verbs */}
                    {item.source_context && (
                      <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100 mb-4">
                        <p className="text-xs font-bold text-emerald-600 uppercase mb-2 flex items-center gap-1">
                          <Quote className="w-3 h-3" /> Example
                        </p>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-slate-800 text-base italic">"{item.source_context}"</p>
                          <button
                            onClick={(e) => handlePlayAudio(e, item.source_context)}
                            className="p-1 text-emerald-500 hover:text-emerald-700"
                          >
                            <Volume2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {/* Etymology/memory tip if available */}
                    {item.imagery_etymology && (
                      <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
                        <p className="text-xs font-bold text-amber-600 uppercase mb-1 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Memory Tip
                        </p>
                        <p className="text-slate-800 text-sm">{item.imagery_etymology}</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Additional examples if any */}
                  {item.examples && item.examples.length > 0 && item.examples[0].sentence !== item.source_context && (
                    <div className="bg-slate-50/80 p-6 border-t border-slate-100">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">More Examples</p>
                      <div className="space-y-3">
                        {item.examples.filter(ex => ex.sentence !== item.source_context).map((ex, exIdx) => (
                          <div key={exIdx} className="flex gap-3 group">
                            <div className="flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-slate-800 font-medium leading-relaxed">"{ex.sentence}"</p>
                                <button
                                  onClick={(e) => handlePlayAudio(e, ex.sentence)}
                                  className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-emerald-600 ${
                                    playingText === ex.sentence ? 'opacity-100 text-emerald-600' : ''
                                  }`}
                                >
                                  <Volume2 className="w-4 h-4" />
                                </button>
                              </div>
                              {ex.explanation && <p className="text-slate-500 text-sm mt-1 italic">({ex.explanation})</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Flashcard Modal */}
      {showFlashcards && vocabulary.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-slate-800">Flashcard Practice</h3>
                <p className="text-sm text-slate-500">
                  Card {currentCardIndex + 1} of {vocabulary.length}
                  {bookSubject && ` • ${bookSubject}`}
                </p>
              </div>
              <button
                onClick={() => setShowFlashcards(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Card Content */}
            <div className="p-8">
              {currentCard && (
                <div className="text-center">
                  {/* Term */}
                  <div className="mb-6">
                    <div className="flex items-center justify-center gap-3">
                      <h2 className="text-3xl font-bold text-slate-800">
                        {currentCard.term}
                      </h2>
                      <button
                        onClick={(e) => handlePlayAudio(e, currentCard.term)}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                      >
                        <Volume2 className="w-5 h-5 text-emerald-600" />
                      </button>
                    </div>
                    {currentCard.category && (
                      <span className={`inline-block mt-2 text-xs px-2 py-1 rounded-full ${getCategoryConfig(currentCard.category).color}`}>
                        {getCategoryConfig(currentCard.category).label}
                      </span>
                    )}
                  </div>

                  {/* Show/Hide Answer */}
                  {showAnswer ? (
                    <div className="bg-slate-50 rounded-xl p-6 text-left">
                      <p className="text-lg text-slate-700 mb-4">
                        {currentCard.definition}
                      </p>
                      {currentCard.source_context && (
                        <p className="text-sm text-slate-500 italic mb-4">
                          "{currentCard.source_context}"
                        </p>
                      )}
                      {currentCard.imagery_etymology && (
                        <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 mb-4">
                          <p className="text-xs font-bold text-amber-600 uppercase mb-1">Memory Tip</p>
                          <p className="text-sm text-slate-700">{currentCard.imagery_etymology}</p>
                        </div>
                      )}
                      {currentCard.examples && currentCard.examples[0] && (
                        <p className="text-sm text-slate-600">
                          <span className="font-medium text-emerald-600">
                            Example:
                          </span>{' '}
                          {currentCard.examples[0].sentence}
                        </p>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAnswer(true)}
                      className="w-full py-4 bg-emerald-100 text-emerald-700 rounded-xl font-medium hover:bg-emerald-200 transition-colors"
                    >
                      Show Answer
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200">
              <button
                onClick={prevCard}
                disabled={currentCardIndex === 0}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentCardIndex === 0
                    ? 'text-slate-300 cursor-not-allowed'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                Previous
              </button>

              {/* Progress dots */}
              <div className="flex gap-1.5">
                {vocabulary.slice(0, Math.min(vocabulary.length, 10)).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setCurrentCardIndex(idx);
                      setShowAnswer(false);
                    }}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      idx === currentCardIndex ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  />
                ))}
                {vocabulary.length > 10 && (
                  <span className="text-xs text-slate-400 ml-1">
                    +{vocabulary.length - 10}
                  </span>
                )}
              </div>

              <button
                onClick={nextCard}
                disabled={currentCardIndex === vocabulary.length - 1}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentCardIndex === vocabulary.length - 1
                    ? 'text-slate-300 cursor-not-allowed'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChapterView;
