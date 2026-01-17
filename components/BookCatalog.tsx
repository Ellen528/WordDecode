import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { SavedBook, BookChapter, VocabularyItem, UserProficiency, ChapterProgress } from '../types';
import { dataService } from '../services/dataService';
import { 
  ChevronRight, 
  ChevronDown, 
  Book, 
  ArrowLeft, 
  CheckCircle2, 
  Circle,
  BookOpen,
  Sparkles
} from 'lucide-react';
import ChapterView from './ChapterView';

// Helper: Check if a title starts with a number (unit) or not (category)
const isNumberedUnit = (title: string): boolean => {
  // Match titles like "01 People", "1 Get up", "Unit 2:", etc.
  return /^(\d+\.?\s|Unit\s*\d+|Chapter\s*\d+)/i.test(title.trim());
};

// Helper: Fix flat structure by grouping numbered units under non-numbered categories
const fixFlatStructure = (chapters: BookChapter[]): BookChapter[] => {
  // Check if structure is already hierarchical (categories have children)
  const hasProperHierarchy = chapters.some(c => c.children && c.children.length > 0);
  if (hasProperHierarchy) {
    return chapters; // Already hierarchical
  }

  // Structure is flat - need to group units under categories
  const result: BookChapter[] = [];
  let currentCategory: BookChapter | null = null;

  for (const chapter of chapters) {
    if (isNumberedUnit(chapter.title)) {
      // This is a unit - add to current category
      if (currentCategory) {
        if (!currentCategory.children) {
          currentCategory.children = [];
        }
        currentCategory.children.push({ ...chapter, level: 2 });
      } else {
        // No category yet - add as standalone (shouldn't happen with good data)
        result.push(chapter);
      }
    } else {
      // This is a category header
      currentCategory = { ...chapter, level: 1, children: [] };
      result.push(currentCategory);
    }
  }

  return result;
};

interface BookCatalogProps {
  book: SavedBook;
  userId: string;
  proficiency?: UserProficiency | null;
  onBack: () => void;
  onBookUpdate: (book: SavedBook) => void;
}

const BookCatalog: React.FC<BookCatalogProps> = ({ 
  book, 
  userId, 
  proficiency,
  onBack,
  onBookUpdate 
}) => {
  const [selectedChapter, setSelectedChapter] = useState<BookChapter | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [chapterVocabulary, setChapterVocabulary] = useState<VocabularyItem[]>([]);

  // Update last opened when component mounts
  useEffect(() => {
    dataService.updateBookLastOpened(userId, book.id);
  }, [userId, book.id]);

  // Fix flat structure if needed (group units under categories)
  const fixedStructure = useMemo(() => fixFlatStructure(book.structure), [book.structure]);

  // Auto-expand all categories on mount so users see units
  useEffect(() => {
    const categoryIds = new Set<string>();
    const findCategories = (chapters: BookChapter[]) => {
      for (const chapter of chapters) {
        if (chapter.children && chapter.children.length > 0) {
          categoryIds.add(chapter.id);
          findCategories(chapter.children);
        }
      }
    };
    findCategories(fixedStructure);
    setExpandedChapters(categoryIds);
  }, [fixedStructure]);

  // Check if a chapter is studied
  const isChapterStudied = useCallback((chapterId: string): boolean => {
    return book.progress?.some(p => p.chapterId === chapterId && p.isStudied) || false;
  }, [book.progress]);

  // Toggle chapter expansion
  const toggleChapter = (chapterId: string) => {
    const newExpanded = new Set(expandedChapters);
    if (newExpanded.has(chapterId)) {
      newExpanded.delete(chapterId);
    } else {
      newExpanded.add(chapterId);
    }
    setExpandedChapters(newExpanded);
  };

  // Flatten all chapters for content extraction (use fixed structure)

  // Select a chapter and load saved vocabulary
  const handleSelectChapter = async (chapter: BookChapter) => {
    setSelectedChapter(chapter);
    setChapterVocabulary([]);

    try {
      // Load saved vocabulary if any
      const savedVocab = await dataService.fetchChapterVocabulary(userId, book.id, chapter.id);
      if (savedVocab.length > 0) {
        setChapterVocabulary(savedVocab);
      }
    } catch (error) {
      console.error('Error loading chapter vocabulary:', error);
    }
  };

  // Mark chapter as studied
  const handleMarkStudied = async () => {
    if (!selectedChapter) return;

    const newStudied = !isChapterStudied(selectedChapter.id);
    await dataService.markChapterStudied(userId, book.id, selectedChapter.id, newStudied);

    // Update local state
    const newProgress: ChapterProgress[] = [...(book.progress || [])];
    const existingIdx = newProgress.findIndex(p => p.chapterId === selectedChapter.id);
    if (existingIdx >= 0) {
      newProgress[existingIdx].isStudied = newStudied;
    } else {
      newProgress.push({
        chapterId: selectedChapter.id,
        isStudied: newStudied,
        vocabularyExtracted: chapterVocabulary.length > 0,
        lastOpenedAt: Date.now(),
      });
    }

    const updatedBook = { ...book, progress: newProgress };
    onBookUpdate(updatedBook);
  };

  // Handle vocabulary generated from manual entry
  const handleVocabularyGenerated = async (vocabulary: VocabularyItem[]) => {
    if (!selectedChapter) return;
    
    console.log('Generated vocabulary:', vocabulary.length, 'items');
    setChapterVocabulary(vocabulary);
    
    // Save to database
    if (vocabulary.length > 0) {
      await dataService.saveChapterVocabulary(userId, book.id, selectedChapter.id, vocabulary);
    }
  };

  // Handle vocabulary updates (add more / delete items)
  const handleVocabularyUpdated = async (vocabulary: VocabularyItem[]) => {
    if (!selectedChapter) return;
    
    console.log('Updated vocabulary:', vocabulary.length, 'items');
    setChapterVocabulary(vocabulary);
    
    // Save to database
    await dataService.saveChapterVocabulary(userId, book.id, selectedChapter.id, vocabulary);
  };

  // Check if chapter is a category (has children) vs a unit (leaf node)
  const isCategory = (chapter: BookChapter): boolean => {
    return chapter.children !== undefined && chapter.children.length > 0;
  };

  // Render chapter tree recursively
  const renderChapterTree = (chapters: BookChapter[], depth: number = 0) => {
    return chapters.map((chapter) => {
      const isExpanded = expandedChapters.has(chapter.id);
      const isSelected = selectedChapter?.id === chapter.id;
      const isStudied = isChapterStudied(chapter.id);
      const isCategoryItem = isCategory(chapter);

      // Categories are just section headers (expandable but don't load content)
      if (isCategoryItem) {
        return (
          <div key={chapter.id}>
            {/* Category Header */}
            <div
              className="flex items-center gap-2 py-2 px-3 mt-2 cursor-pointer hover:bg-slate-100 rounded-lg"
              style={{ paddingLeft: `${12 + depth * 16}px` }}
              onClick={() => toggleChapter(chapter.id)}
            >
              <button className="p-0.5 hover:bg-slate-200 rounded">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                )}
              </button>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide truncate">
                {chapter.title}
              </span>
            </div>

            {/* Children (units) */}
            {isExpanded && (
              <div>{renderChapterTree(chapter.children!, depth + 1)}</div>
            )}
          </div>
        );
      }

      // Units are clickable items that load content
      return (
        <div key={chapter.id}>
          <div
            className={`flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-colors ${
              isSelected 
                ? 'bg-emerald-100 text-emerald-800' 
                : 'hover:bg-slate-100 text-slate-700'
            }`}
            style={{ paddingLeft: `${12 + depth * 16}px` }}
            onClick={() => handleSelectChapter(chapter)}
          >
            {/* Study status indicator */}
            {isStudied ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            ) : (
              <Circle className="w-4 h-4 text-slate-300 flex-shrink-0" />
            )}
            
            <span className="text-sm truncate">
              {chapter.title}
            </span>
            
            {chapter.pageStart && (
              <span className="ml-auto text-xs text-slate-400">
                p.{chapter.pageStart}
              </span>
            )}
          </div>
        </div>
      );
    });
  };

  // Calculate overall progress (only count units, not categories)
  const calculateProgress = () => {
    const countUnits = (chapters: BookChapter[]): number => {
      let count = 0;
      for (const chapter of chapters) {
        if (chapter.children && chapter.children.length > 0) {
          // This is a category, only count its children
          count += countUnits(chapter.children);
        } else {
          // This is a unit (leaf node), count it
          count++;
        }
      }
      return count;
    };

    const totalUnits = countUnits(fixedStructure);
    const studiedUnits = book.progress?.filter(p => p.isStudied).length || 0;

    return {
      total: totalUnits,
      studied: studiedUnits,
      percentage: totalUnits > 0 ? Math.round((studiedUnits / totalUnits) * 100) : 0
    };
  };

  const progress = calculateProgress();

  return (
    <div className="flex h-full bg-white">
      {/* Sidebar - Table of Contents */}
      <div className="w-80 border-r border-slate-200 flex flex-col bg-slate-50">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 bg-white">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Library</span>
          </button>
          
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Book className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-slate-800 truncate">{book.title}</h2>
              {book.author && (
                <p className="text-sm text-slate-500 truncate">{book.author}</p>
              )}
              {book.bookSubject && (
                <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  {book.bookSubject}
                </p>
              )}
            </div>
          </div>

          {/* Progress */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-500">
                {progress.studied} of {progress.total} chapters
              </span>
              <span className="font-medium text-emerald-600">{progress.percentage}%</span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Chapter List */}
        <div className="flex-1 overflow-y-auto p-2">
          {fixedStructure.length > 0 ? (
            renderChapterTree(fixedStructure)
          ) : (
            <div className="text-center py-8 text-slate-400">
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No chapters found</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedChapter ? (
          <ChapterView
            chapter={selectedChapter}
            vocabulary={chapterVocabulary}
            isStudied={isChapterStudied(selectedChapter.id)}
            onMarkStudied={handleMarkStudied}
            onVocabularyGenerated={handleVocabularyGenerated}
            onVocabularyUpdated={handleVocabularyUpdated}
            bookSubject={book.bookSubject}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-slate-50">
            <div className="text-center">
              <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-600 mb-2">
                Select a Chapter
              </h3>
              <p className="text-slate-400 max-w-sm">
                Choose a chapter from the table of contents to start reading and learning vocabulary
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookCatalog;
