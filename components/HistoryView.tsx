import React, { useState, useRef, useCallback, useEffect } from 'react';
import { SavedAnalysis, AnalysisFolder, VocabularyItem } from '../types';
import { Volume2, Trash2, ChevronLeft, ChevronRight, BookOpen, Calendar, ArrowRight, FolderPlus, Folder, FolderOpen, ChevronDown, ChevronUp, MoreHorizontal, Edit2, X, Check, GripVertical, CheckCircle, XCircle, GraduationCap, Trophy, RotateCcw, Award } from 'lucide-react';
import { generateSpeech } from '../services/geminiService';

interface Props {
  savedAnalyses: SavedAnalysis[];
  onLoadAnalysis: (analysis: SavedAnalysis) => void;
  onRemoveAnalysis: (id: string) => void;
  folders: AnalysisFolder[];
  onCreateFolder: (name: string, color?: string) => void;
  onUpdateFolder: (folder: AnalysisFolder) => void;
  onDeleteFolder: (folderId: string) => void;
  onMoveAnalysisToFolder: (analysisId: string, folderId: string | null) => void;
  onUpdateFlashcardPassed: (analysisId: string, passed: boolean) => void;
}

const FOLDER_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f43f5e', // rose
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
];

const HistoryView: React.FC<Props> = ({
  savedAnalyses,
  onLoadAnalysis,
  onRemoveAnalysis,
  folders,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
  onMoveAnalysisToFolder,
  onUpdateFlashcardPassed,
}) => {
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Flashcard practice state
  const [practiceAnalysis, setPracticeAnalysis] = useState<SavedAnalysis | null>(null);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [answerResult, setAnswerResult] = useState<'correct' | 'incorrect' | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Score tracking state
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [showResults, setShowResults] = useState(false);

  // Folder state
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0]);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [folderMenuOpen, setFolderMenuOpen] = useState<string | null>(null);

  // Drag and drop state
  const [draggingAnalysisId, setDraggingAnalysisId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [dragOverUncategorized, setDragOverUncategorized] = useState(false);

  const newFolderInputRef = useRef<HTMLInputElement>(null);

  // Helper function to mask the vocabulary term in text
  const maskTerm = useCallback((text: string, term: string): string => {
    if (!text || !term) return text;
    
    let maskedText = text;
    const cleanTerm = term.replace(/[.,!?;:'"]+$/, '').trim();
    const subPhrases = cleanTerm.split(/[,;]|\s+and\s+/i)
      .map(s => s.trim())
      .filter(s => s.length > 2);
    
    const allTermsToMask = [cleanTerm, ...subPhrases];
    const uniqueTerms = [...new Set(allTermsToMask)];
    uniqueTerms.sort((a, b) => b.length - a.length);
    
    for (const phrase of uniqueTerms) {
      if (phrase.length < 3) continue;
      const escapedTerm = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedTerm}\\b`, 'gi');
      maskedText = maskedText.replace(regex, '_____');
    }
    
    return maskedText;
  }, []);

  const handlePlayAudio = async (e: React.MouseEvent, text: string, id: string) => {
    e.stopPropagation();
    if (playingId) return;
    setPlayingId(id);
    try {
      await generateSpeech(text);
    } finally {
      setPlayingId(null);
    }
  };

  // Flashcard practice functions
  const openPractice = (analysis: SavedAnalysis) => {
    setPracticeAnalysis(analysis);
    setFlashcardIndex(0);
    setUserAnswer('');
    setAnswerResult(null);
    setShowAnswer(false);
    setCorrectCount(0);
    setIncorrectCount(0);
    setShowResults(false);
  };

  const closePractice = () => {
    setPracticeAnalysis(null);
    setUserAnswer('');
    setAnswerResult(null);
    setShowAnswer(false);
    setCorrectCount(0);
    setIncorrectCount(0);
    setShowResults(false);
  };

  const retryPractice = () => {
    setFlashcardIndex(0);
    setUserAnswer('');
    setAnswerResult(null);
    setShowAnswer(false);
    setCorrectCount(0);
    setIncorrectCount(0);
    setShowResults(false);
  };

  // Smart answer matching that handles variations like:
  // "overstepped her bound" ≈ "overstep the bound" ≈ "overstep bound"
  
  // Simple stemming: remove common verb endings to match tenses
  const stemWord = useCallback((word: string): string => {
    if (word.length < 4) return word;
    // Handle common verb endings: -ed, -ing, -s, -es
    if (word.endsWith('ied')) return word.slice(0, -3) + 'y'; // carried → carry
    if (word.endsWith('ed') && word.length > 4) return word.slice(0, -2); // overstepped → overstep, but not "red"
    if (word.endsWith('ing') && word.length > 5) return word.slice(0, -3); // running → runn → will match run
    if (word.endsWith('es') && word.length > 4) return word.slice(0, -2); // watches → watch
    if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1); // runs → run
    return word;
  }, []);

  const normalizeForComparison = useCallback((text: string): string => {
    return text
      .toLowerCase()
      .trim()
      // Remove common placeholder patterns
      .replace(/\(something\)/gi, '')
      .replace(/\(sth\)/gi, '')
      .replace(/\(someone\)/gi, '')
      .replace(/\(sb\)/gi, '')
      .replace(/\(somebody\)/gi, '')
      .replace(/\(one\)/gi, '')
      .replace(/\(one's\)/gi, '')
      .replace(/\(somewhere\)/gi, '')
      .replace(/\(somehow\)/gi, '')
      .replace(/\([^)]*\)/g, '') // Remove any remaining parenthetical content
      // Normalize common variations
      .replace(/\bsth\b/gi, '')
      .replace(/\bsb\b/gi, '')
      .replace(/\bsmth\b/gi, '')
      // Remove articles
      .replace(/\b(a|an|the)\b/gi, '')
      // Remove pronouns (her, his, their, my, your, its, our, one's)
      .replace(/\b(her|his|their|my|your|its|our|one's)\b/gi, '')
      // Remove common filler words
      .replace(/\b(it|to|of|in|on|at|for|with|by)\b/gi, '')
      // Clean up whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }, []);

  // Check if two words match (considering stems)
  const wordsMatch = useCallback((word1: string, word2: string): boolean => {
    if (word1 === word2) return true;
    const stem1 = stemWord(word1);
    const stem2 = stemWord(word2);
    // Check stem match
    if (stem1 === stem2) return true;
    // Check if one contains the other (for partial matches)
    if (stem1.length >= 3 && stem2.length >= 3) {
      if (stem1.includes(stem2) || stem2.includes(stem1)) return true;
    }
    return false;
  }, [stemWord]);

  const checkAnswerMatch = useCallback((userInput: string, correctTerm: string): boolean => {
    const normalizedUser = normalizeForComparison(userInput);
    const normalizedTerm = normalizeForComparison(correctTerm);
    
    // Exact match after normalization
    if (normalizedUser === normalizedTerm) return true;
    
    // Get core words (ignore very short words)
    const termWords = normalizedTerm.split(' ').filter(w => w.length > 2);
    const userWords = normalizedUser.split(' ').filter(w => w.length > 2);
    
    // If no significant words to compare, check similarity
    if (termWords.length === 0 || userWords.length === 0) {
      return calculateSimilarity(normalizedUser, normalizedTerm) >= 0.7;
    }
    
    // Check if user answer contains all key words from the term (using stem matching)
    const allTermWordsPresent = termWords.every(tw => 
      userWords.some(uw => wordsMatch(tw, uw))
    );
    
    // If all core words match, it's correct
    if (allTermWordsPresent) return true;
    
    // Fuzzy match: allow for minor typos using similarity
    const similarity = calculateSimilarity(normalizedUser, normalizedTerm);
    if (similarity >= 0.75) return true;
    
    return false;
  }, [normalizeForComparison, wordsMatch]);

  // Simple similarity calculation (0 to 1)
  const calculateSimilarity = (str1: string, str2: string): number => {
    if (str1 === str2) return 1;
    if (!str1 || !str2) return 0;
    
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1;
    
    // Simple Levenshtein distance
    const matrix: number[][] = [];
    for (let i = 0; i <= shorter.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= longer.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= shorter.length; i++) {
      for (let j = 1; j <= longer.length; j++) {
        if (shorter[i-1] === longer[j-1]) {
          matrix[i][j] = matrix[i-1][j-1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i-1][j-1] + 1,
            matrix[i][j-1] + 1,
            matrix[i-1][j] + 1
          );
        }
      }
    }
    
    const distance = matrix[shorter.length][longer.length];
    return (longer.length - distance) / longer.length;
  };

  const handleCheckAnswer = async () => {
    if (!userAnswer.trim() || !practiceAnalysis) return;
    
    const currentItem = practiceAnalysis.analysisResult.vocabulary[flashcardIndex];
    const isCorrect = checkAnswerMatch(userAnswer, currentItem.term);
    
    setAnswerResult(isCorrect ? 'correct' : 'incorrect');
    setShowAnswer(true);
    
    // Track score
    if (isCorrect) {
      setCorrectCount(prev => prev + 1);
    } else {
      setIncorrectCount(prev => prev + 1);
    }
    
    try {
      await generateSpeech(currentItem.term);
    } catch (error) {
      console.error('Failed to pronounce:', error);
    }
  };

  const handleSkip = async () => {
    if (!practiceAnalysis) return;
    const currentItem = practiceAnalysis.analysisResult.vocabulary[flashcardIndex];
    setShowAnswer(true);
    setAnswerResult('incorrect');
    setIncorrectCount(prev => prev + 1);
    try {
      await generateSpeech(currentItem.term);
    } catch (error) {
      console.error('Failed to pronounce:', error);
    }
  };

  const nextCard = () => {
    if (!practiceAnalysis) return;
    const totalCards = practiceAnalysis.analysisResult.vocabulary.length;
    const isLastCard = flashcardIndex === totalCards - 1;
    
    if (isLastCard) {
      // Show results (pass check happens in useEffect below)
      setShowResults(true);
    } else {
      setFlashcardIndex(prev => prev + 1);
      setUserAnswer('');
      setAnswerResult(null);
      setShowAnswer(false);
    }
  };

  // Check and update passed status when results are shown
  useEffect(() => {
    if (showResults && practiceAnalysis) {
      const totalCards = practiceAnalysis.analysisResult.vocabulary.length;
      const totalAnswered = correctCount + incorrectCount;
      const percentage = totalAnswered > 0 ? (correctCount / totalAnswered) * 100 : 0;
      
      // Update passed status if 90%+ and completed all cards
      if (percentage >= 90 && totalAnswered === totalCards && !practiceAnalysis.flashcardPassed) {
        onUpdateFlashcardPassed(practiceAnalysis.id, true);
      }
    }
  }, [showResults, correctCount, incorrectCount, practiceAnalysis, onUpdateFlashcardPassed]);

  const prevCard = () => {
    if (flashcardIndex > 0) {
      setFlashcardIndex(prev => prev - 1);
      setUserAnswer('');
      setAnswerResult(null);
      setShowAnswer(false);
    }
  };

  // Folder functions
  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
  }
      return next;
    });
  };

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim(), newFolderColor);
      setNewFolderName('');
      setNewFolderColor(FOLDER_COLORS[0]);
      setIsCreatingFolder(false);
    }
  };

  const handleStartEditFolder = (folder: AnalysisFolder) => {
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name);
    setFolderMenuOpen(null);
  };

  const handleSaveEditFolder = (folder: AnalysisFolder) => {
    if (editingFolderName.trim()) {
      onUpdateFolder({ ...folder, name: editingFolderName.trim() });
    }
    setEditingFolderId(null);
    setEditingFolderName('');
  };

  const handleDeleteFolder = (folderId: string) => {
    onDeleteFolder(folderId);
    setFolderMenuOpen(null);
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, analysisId: string) => {
    setDraggingAnalysisId(analysisId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', analysisId);
    setTimeout(() => {
      const element = document.getElementById(`analysis-${analysisId}`);
      if (element) element.style.opacity = '0.5';
    }, 0);
  };

  const handleDragEnd = () => {
    if (draggingAnalysisId) {
      const element = document.getElementById(`analysis-${draggingAnalysisId}`);
      if (element) element.style.opacity = '1';
    }
    setDraggingAnalysisId(null);
    setDragOverFolderId(null);
    setDragOverUncategorized(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleFolderDragEnter = (folderId: string) => {
    setDragOverFolderId(folderId);
    setDragOverUncategorized(false);
  };

  const handleFolderDragLeave = () => {
    setDragOverFolderId(null);
  };

  const handleFolderDrop = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    if (draggingAnalysisId) {
      onMoveAnalysisToFolder(draggingAnalysisId, folderId);
      setExpandedFolders((prev) => new Set([...prev, folderId]));
    }
    handleDragEnd();
  };

  const handleUncategorizedDragEnter = () => {
    setDragOverUncategorized(true);
    setDragOverFolderId(null);
  };

  const handleUncategorizedDragLeave = () => {
    setDragOverUncategorized(false);
  };

  const handleUncategorizedDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggingAnalysisId) {
      onMoveAnalysisToFolder(draggingAnalysisId, null);
    }
    handleDragEnd();
  };

  // Group analyses by folder
  const uncategorizedAnalyses = savedAnalyses.filter((a) => !a.folderId);
  const getAnalysesInFolder = (folderId: string) =>
    savedAnalyses.filter((a) => a.folderId === folderId);

  const renderAnalysisCard = (analysis: SavedAnalysis, inFolder = false) => (
    <div
      key={analysis.id}
      id={`analysis-${analysis.id}`}
      draggable
      onDragStart={(e) => handleDragStart(e, analysis.id)}
      onDragEnd={handleDragEnd}
      className={`bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group cursor-grab active:cursor-grabbing ${
        draggingAnalysisId === analysis.id ? 'ring-2 ring-indigo-400' : ''
      } ${inFolder ? 'ml-4' : ''}`}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <div className="text-slate-300 group-hover:text-slate-400 transition-colors">
            <GripVertical className="w-4 h-4" />
                  </div>
          <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider">
                      {analysis.sourceType}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Calendar className="w-3 h-3" />
                      {new Date(analysis.date).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    onClick={() => onRemoveAnalysis(analysis.id)}
          className="text-slate-300 hover:text-red-500 transition-colors p-1.5 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100"
                    title="Remove analysis"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-lg font-serif font-bold text-slate-900 line-clamp-1 flex-1">
          {analysis.fileName || 'Text Analysis'}
        </h3>
        {analysis.flashcardPassed && (
          <span className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-bold" title="Flashcard test passed!">
            <Trophy className="w-3 h-3" />
            Passed
          </span>
        )}
      </div>

      <p className="text-slate-600 text-sm mb-4 line-clamp-2">
                  {analysis.analysisResult.summary}
                </p>

      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="flex gap-3 text-sm text-slate-500">
                    <span className="flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" />
                      {analysis.analysisResult.vocabulary.length} words
                    </span>
                  </div>

        <div className="flex gap-2">
          {analysis.analysisResult.vocabulary.length > 0 && (
            <button
              onClick={() => openPractice(analysis)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors"
            >
              <GraduationCap className="w-3 h-3" /> Practice
            </button>
          )}
                  <button
                    onClick={() => onLoadAnalysis(analysis)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors"
          >
            Load <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );

  if (savedAnalyses.length === 0) {
    return (
      <div className="text-center py-20">
        <BookOpen className="w-16 h-16 text-slate-200 mx-auto mb-4" />
        <h3 className="text-xl font-serif text-slate-600">No saved analyses yet.</h3>
        <p className="text-slate-400">Analyze text and save results to see them here.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-serif font-bold text-slate-900">Saved Analyses</h2>
        <div className="text-sm text-slate-500">{savedAnalyses.length} analyses</div>
      </div>

      {/* Folder Management */}
      <div className="space-y-4">
        {/* Create Folder Button */}
        <div className="flex gap-2">
          {isCreatingFolder ? (
            <div className="flex-1 flex gap-2 items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
              <input
                ref={newFolderInputRef}
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                placeholder="Folder name..."
                className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
              <div className="flex gap-1">
                {FOLDER_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewFolderColor(color)}
                    className={`w-5 h-5 rounded-full transition-all ${
                      newFolderColor === color ? 'ring-2 ring-offset-1 ring-slate-400' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <button
                onClick={handleCreateFolder}
                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setIsCreatingFolder(false);
                  setNewFolderName('');
                }}
                className="p-1.5 text-slate-400 hover:bg-slate-50 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsCreatingFolder(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
            >
              <FolderPlus className="w-4 h-4" />
              New Folder
            </button>
          )}
        </div>

        {/* Folders */}
        {folders.map((folder) => {
          const folderAnalyses = getAnalysesInFolder(folder.id);
          const isExpanded = expandedFolders.has(folder.id);
          const isEditing = editingFolderId === folder.id;

          return (
            <div
              key={folder.id}
              onDragOver={handleDragOver}
              onDragEnter={() => handleFolderDragEnter(folder.id)}
              onDragLeave={handleFolderDragLeave}
              onDrop={(e) => handleFolderDrop(e, folder.id)}
              className={`transition-all rounded-xl ${
                dragOverFolderId === folder.id
                  ? 'ring-2 ring-indigo-400 bg-indigo-50'
                  : ''
              }`}
            >
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => toggleFolder(folder.id)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: folder.color || FOLDER_COLORS[0] + '20' }}
                    >
                      {isExpanded ? (
                        <FolderOpen
                          className="w-4 h-4"
                          style={{ color: folder.color || FOLDER_COLORS[0] }}
                        />
                      ) : (
                        <Folder
                          className="w-4 h-4"
                          style={{ color: folder.color || FOLDER_COLORS[0] }}
                        />
                      )}
                    </div>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingFolderName}
                        onChange={(e) => setEditingFolderName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEditFolder(folder);
                          if (e.key === 'Escape') {
                            setEditingFolderId(null);
                            setEditingFolderName('');
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="px-2 py-1 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        autoFocus
                      />
                    ) : (
                      <span className="font-medium text-slate-800">{folder.name}</span>
                    )}
                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      {folderAnalyses.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveEditFolder(folder);
                          }}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingFolderId(null);
                            setEditingFolderName('');
                          }}
                          className="p-1.5 text-slate-400 hover:bg-slate-50 rounded-lg"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setFolderMenuOpen(folderMenuOpen === folder.id ? null : folder.id);
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          {folderMenuOpen === folder.id && (
                            <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-10 min-w-[120px]">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartEditFolder(folder);
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                              >
                                <Edit2 className="w-3.5 h-3.5" /> Rename
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteFolder(folder.id);
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </>
                    )}
                  </div>
                </div>

                {isExpanded && folderAnalyses.length > 0 && (
                  <div className="p-4 pt-0 space-y-3 border-t border-slate-100">
                    {folderAnalyses.map((analysis) => renderAnalysisCard(analysis, true))}
                  </div>
                )}

                {isExpanded && folderAnalyses.length === 0 && (
                  <div className="p-4 pt-0 text-center text-slate-400 text-sm italic border-t border-slate-100">
                    Drag analyses here to organize
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Uncategorized Analyses */}
        {uncategorizedAnalyses.length > 0 && (
          <div
            onDragOver={handleDragOver}
            onDragEnter={handleUncategorizedDragEnter}
            onDragLeave={handleUncategorizedDragLeave}
            onDrop={handleUncategorizedDrop}
            className={`space-y-3 p-4 rounded-xl transition-all ${
              dragOverUncategorized
                ? 'ring-2 ring-slate-400 bg-slate-50'
                : ''
            }`}
          >
            {folders.length > 0 && (
              <h3 className="text-sm font-medium text-slate-500 mb-3">Uncategorized</h3>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {uncategorizedAnalyses.map((analysis) => renderAnalysisCard(analysis))}
            </div>
          </div>
        )}
      </div>

      {/* Flashcard Practice Modal */}
      {practiceAnalysis && practiceAnalysis.analysisResult.vocabulary.length > 0 && (
        <div className="fixed inset-0 bg-slate-900/95 z-50 flex flex-col items-center justify-center p-4">
          {/* Close Button */}
          <button
            onClick={closePractice}
            className="absolute top-6 right-6 p-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Source Name */}
          <div className="absolute top-6 left-6 text-slate-300 text-sm font-medium">
            {practiceAnalysis.fileName || 'Text Analysis'}
          </div>

          {/* Results Screen */}
          {showResults ? (
            <div className="w-full max-w-md text-center">
              {(() => {
                const totalCards = practiceAnalysis.analysisResult.vocabulary.length;
                const percentage = totalCards > 0 ? Math.round((correctCount / totalCards) * 100) : 0;
                const passed = percentage >= 90;

                return (
                  <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-6">
                    {/* Result Icon */}
                    <div className={`mx-auto w-24 h-24 rounded-full flex items-center justify-center ${
                      passed 
                        ? 'bg-gradient-to-br from-yellow-400 to-amber-500' 
                        : 'bg-gradient-to-br from-slate-400 to-slate-500'
                    }`}>
                      {passed ? (
                        <Trophy className="w-12 h-12 text-white animate-bounce" />
                      ) : (
                        <Award className="w-12 h-12 text-white" />
                      )}
                    </div>

                    {/* Message */}
                    <div>
                      <h2 className={`text-3xl font-bold mb-2 ${
                        passed ? 'text-amber-600' : 'text-slate-700'
                      }`}>
                        {passed ? 'Excellent!' : 'Keep Practicing!'}
                      </h2>
                      <p className="text-slate-500">
                        {passed 
                          ? 'You\'ve mastered this material!' 
                          : 'You\'re making progress. Try again to reach 90%!'}
                      </p>
                      {passed && (
                        <p className="text-emerald-600 text-sm font-medium mt-2 flex items-center justify-center gap-1">
                          <CheckCircle className="w-4 h-4" /> Progress saved!
                        </p>
                      )}
                    </div>

                    {/* Score */}
                    <div className="py-4">
                      <div className="text-5xl font-bold text-slate-800 mb-2">
                        {percentage}%
                      </div>
                      <div className="text-slate-500">
                        {correctCount} of {totalCards} correct
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          passed 
                            ? 'bg-gradient-to-r from-amber-400 to-amber-500' 
                            : 'bg-gradient-to-r from-indigo-400 to-indigo-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>

                    {/* 90% threshold indicator */}
                    {!passed && (
                      <div className="text-sm text-slate-400">
                        Need {Math.ceil(totalCards * 0.9) - correctCount} more correct answers to pass (90%)
                      </div>
                    )}

                    {/* Buttons */}
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={retryPractice}
                        className="flex-1 py-3 px-4 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                      >
                        <RotateCcw className="w-5 h-5" />
                        Try Again
                      </button>
                      <button
                        onClick={closePractice}
                        className={`flex-1 py-3 px-4 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 ${
                          passed 
                            ? 'bg-amber-500 text-white hover:bg-amber-600' 
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        }`}
                      >
                        <Check className="w-5 h-5" />
                        Done
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
          /* Card */
          <div className="w-full max-w-xl">
            {(() => {
              const currentItem = practiceAnalysis.analysisResult.vocabulary[flashcardIndex];
              const example = currentItem.examples && currentItem.examples.length > 0 
                ? currentItem.examples[0].sentence 
                : null;

              return (
                <div className="bg-white rounded-2xl shadow-2xl p-6 min-h-[400px] flex flex-col">
                  {/* Category Badge */}
                  <div className="flex justify-center mb-4">
                    <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700 rounded-full">
                      {currentItem.category.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {/* Definition Card */}
                  <div className="p-5 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl mb-5">
                    <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3">Definition</p>
                    <p className="text-xl text-white font-serif leading-relaxed">
                      {maskTerm(currentItem.definition, currentItem.term)}
                    </p>
                  </div>

                  {/* Example Hint */}
                  {example && (
                    <div className="mb-5 p-4 bg-amber-50 rounded-xl border border-amber-200">
                      <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2">💡 Hint (Example)</p>
                      <p className="text-slate-700 italic text-sm leading-relaxed">"{maskTerm(example, currentItem.term)}"</p>
                    </div>
                  )}

                  {/* Answer Section */}
                  <div className="flex-1 flex flex-col justify-end">
                    {!showAnswer ? (
                      <div className="space-y-4">
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase mb-2">What's the term?</p>
                          <div className="flex gap-2">
                            <input
                              ref={inputRef}
                              type="text"
                              value={userAnswer}
                              onChange={(e) => setUserAnswer(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleCheckAnswer()}
                              placeholder="Type your answer..."
                              className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-lg font-serif"
                              autoFocus
                            />
                            <button
                              onClick={handleCheckAnswer}
                              disabled={!userAnswer.trim()}
                              className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                              <Check className="w-5 h-5" />
                              Check
                            </button>
                          </div>
                        </div>
                        <button
                          onClick={handleSkip}
                          className="w-full py-2 text-slate-400 hover:text-slate-600 text-sm font-medium transition-colors"
                        >
                          Skip & Show Answer
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Result */}
                        <div className={`p-4 rounded-xl flex items-center gap-3 ${
                          answerResult === 'correct' 
                            ? 'bg-emerald-50 border border-emerald-200' 
                            : 'bg-red-50 border border-red-200'
                        }`}>
                          {answerResult === 'correct' ? (
                            <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                          ) : (
                            <XCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
                          )}
                          <div className="flex-1">
                            <p className={`font-bold ${answerResult === 'correct' ? 'text-emerald-700' : 'text-red-700'}`}>
                              {answerResult === 'correct' ? 'Correct!' : 'Not quite...'}
                            </p>
                            {answerResult === 'incorrect' && userAnswer && (
                              <p className="text-sm text-red-600">Your answer: "{userAnswer}"</p>
                            )}
                          </div>
                        </div>

                        {/* Correct Answer */}
                        <div className="p-4 bg-slate-900 rounded-xl">
                          <p className="text-xs font-bold text-slate-400 uppercase mb-2">Answer</p>
                          <div className="flex items-center justify-between">
                            <h3 className="text-2xl font-serif font-bold text-white">
                              {currentItem.term}
                            </h3>
                            <button
                              onClick={(e) => handlePlayAudio(e, currentItem.term, `practice-${flashcardIndex}`)}
                              className={`p-3 rounded-full bg-slate-800 hover:bg-slate-700 transition-colors ${
                                playingId === `practice-${flashcardIndex}` ? 'text-emerald-400 animate-pulse' : 'text-slate-400'
                              }`}
                            >
                              <Volume2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

                        {/* Next Button */}
                        <button
                          onClick={nextCard}
                          className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                        >
                          {flashcardIndex < practiceAnalysis.analysisResult.vocabulary.length - 1 ? (
                            <>Next Card <ChevronRight className="w-5 h-5" /></>
                          ) : (
                            <>See Results <ChevronRight className="w-5 h-5" /></>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
          )}

          {/* Navigation - only show when not viewing results */}
          {!showResults && (
            <div className="flex items-center gap-8 mt-8">
              <button
                onClick={prevCard}
                disabled={flashcardIndex === 0}
                className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <span className="text-sm font-medium text-slate-400">
                {flashcardIndex + 1} / {practiceAnalysis.analysisResult.vocabulary.length}
              </span>
              <button
                onClick={nextCard}
                disabled={flashcardIndex >= practiceAnalysis.analysisResult.vocabulary.length - 1}
                className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HistoryView;
