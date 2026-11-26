import React, { useState, useMemo } from 'react';
import {
  X,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Search,
  Sparkles,
  Save,
  Loader2,
} from 'lucide-react';
import { DiagramUploader } from './DiagramUploader';
import RichContent from './RichContent';
import { updateTestSeriesApi } from '../utils/api';

interface QuestionItem {
  id?: number | string;
  question?: string;
  questionText?: string;
  type?: string;
  marks?: number;
  subject?: string | { name: string };
  topic?: string | { name: string };
  options?: string[];
  answer?: any;
  solution?: string;
  imageUrl?: string | null;
  solutionImageUrl?: string | null;
  [key: string]: any;
}

interface AttachDiagramsModalProps {
  isOpen: boolean;
  onClose: () => void;
  testTitle: string;
  questions: QuestionItem[];
  testId?: string; // If provided, persists updates directly via updateTestSeriesApi
  onSave: (updatedQuestions: QuestionItem[]) => void;
}

export const AttachDiagramsModal: React.FC<AttachDiagramsModalProps> = ({
  isOpen,
  onClose,
  testTitle,
  questions: initialQuestions,
  testId,
  onSave,
}) => {
  const [questions, setQuestions] = useState<QuestionItem[]>(() => [...initialQuestions]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [filterMode, setFilterMode] = useState<'ALL' | 'HAS_DIAGRAM' | 'NEEDS_DIAGRAM'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Sync state if questions change
  React.useEffect(() => {
    setQuestions([...initialQuestions]);
    setCurrentIndex(0);
  }, [initialQuestions]);

  if (!isOpen) return null;

  const currentQ = questions[currentIndex] || questions[0];

  // Helper to get text
  const getQText = (q: QuestionItem) => q.question || q.questionText || '';
  const getSubText = (q: QuestionItem) =>
    typeof q.subject === 'string' ? q.subject : q.subject?.name || '';
  const getTopText = (q: QuestionItem) =>
    typeof q.topic === 'string' ? q.topic : q.topic?.name || '';

  // Stats
  const questionsWithDiagrams = questions.filter((q) => Boolean(q.imageUrl || q.solutionImageUrl)).length;

  // Filtered indices
  const filteredIndices = useMemo(() => {
    return questions
      .map((q, idx) => ({ q, idx }))
      .filter(({ q, idx }) => {
        const hasDiag = Boolean(q.imageUrl || q.solutionImageUrl);
        if (filterMode === 'HAS_DIAGRAM' && !hasDiag) return false;
        if (filterMode === 'NEEDS_DIAGRAM' && hasDiag) return false;
        if (searchQuery.trim()) {
          const qNum = String(idx + 1);
          const qText = getQText(q).toLowerCase();
          const query = searchQuery.trim().toLowerCase();
          return qNum === query || qText.includes(query);
        }
        return true;
      })
      .map(({ idx }) => idx);
  }, [questions, filterMode, searchQuery]);

  // Update image for current question
  const handleUpdateQuestionImage = (url: string | null, isSolution = false) => {
    setQuestions((prev) => {
      const copy = [...prev];
      if (!copy[currentIndex]) return prev;
      copy[currentIndex] = {
        ...copy[currentIndex],
        ...(isSolution ? { solutionImageUrl: url } : { imageUrl: url }),
      };
      return copy;
    });
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  // Save all changes
  const handleSaveAll = async () => {
    try {
      setSaving(true);
      setSaveStatus(null);

      if (testId) {
        await updateTestSeriesApi(testId, { questions });
      }

      onSave(questions);
      setSaveStatus('All diagrams successfully saved and linked!');
      setTimeout(() => {
        setSaveStatus(null);
        onClose();
      }, 900);
    } catch (err: any) {
      setSaveStatus(`Save warning: ${err.message || 'Saved locally.'}`);
      onSave(questions);
      setTimeout(() => onClose(), 1200);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-4 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between gap-4 border-b border-indigo-900/50">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold mb-1.5 border border-indigo-400/30">
              <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
              <span>Diagram &amp; Figure Manager</span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-white line-clamp-1">
              {testTitle || 'Official Test Series Paper'}
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Attach high-resolution question figures or solution diagrams via file selection or direct{' '}
              <kbd className="px-1.5 py-0.5 bg-white/20 rounded font-mono text-[11px] text-white">Ctrl+V</kbd> paste.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-[11px] font-bold text-indigo-200 uppercase tracking-wider">
                Diagrams Attached
              </span>
              <span className="text-base font-extrabold text-white">
                {questionsWithDiagrams} <span className="text-slate-400 text-xs">/ {questions.length}</span>
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar: Filters & Quick Question Navigation */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 space-y-3 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setFilterMode('ALL')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  filterMode === 'ALL'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                All ({questions.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('HAS_DIAGRAM')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  filterMode === 'HAS_DIAGRAM'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Has Diagram ({questionsWithDiagrams})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('NEEDS_DIAGRAM')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  filterMode === 'NEEDS_DIAGRAM'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Needs Diagram ({questions.length - questionsWithDiagrams})
              </button>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-48">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Q# or text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>

          {/* Question Grid Strip */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {filteredIndices.map((idx) => {
              const q = questions[idx];
              const isSelected = idx === currentIndex;
              const hasDiag = Boolean(q.imageUrl || q.solutionImageUrl);

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`min-w-8 h-8 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center relative ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400/50'
                      : hasDiag
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                  title={`Question #${idx + 1}${hasDiag ? ' (Diagram Attached)' : ''}`}
                >
                  <span>{idx + 1}</span>
                  {hasDiag && (
                    <span
                      className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${
                        isSelected ? 'bg-amber-400' : 'bg-emerald-500'
                      } border border-white`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Body: Active Question Details & Uploaders */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {currentQ ? (
            <div className="space-y-6">
              {/* Question Header Meta */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-700 font-extrabold text-sm rounded-xl border border-indigo-100">
                    Question #{currentIndex + 1}
                  </span>
                  {currentQ.type && (
                    <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg uppercase">
                      {currentQ.type}
                    </span>
                  )}
                  {currentQ.marks && (
                    <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg">
                      {currentQ.marks} Mark{Number(currentQ.marks) > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-500 font-medium">
                  {getSubText(currentQ) && (
                    <span className="text-indigo-600 font-semibold">{getSubText(currentQ)}</span>
                  )}
                  {getTopText(currentQ) && <span> • {getTopText(currentQ)}</span>}
                </div>
              </div>

              {/* Question Text Preview */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Question Statement
                </span>
                <div className="text-sm font-medium text-slate-800 leading-relaxed">
                  <RichContent content={getQText(currentQ)} />
                </div>
              </div>

              {/* Dual Diagram Uploaders Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* 1. Primary Question Diagram */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                      Question Diagram / Figure
                    </label>
                    {currentQ.imageUrl && (
                      <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Attached
                      </span>
                    )}
                  </div>
                  <DiagramUploader
                    currentUrl={currentQ.imageUrl}
                    onUploadSuccess={(url) => handleUpdateQuestionImage(url, false)}
                    onRemove={() => handleUpdateQuestionImage(null, false)}
                    questionId={currentQ.id}
                    label="Drop Question Diagram or Ctrl+V Screenshot"
                  />
                </div>

                {/* 2. Solution Diagram / Figure */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                      Solution Diagram / Explanation Figure
                    </label>
                    {currentQ.solutionImageUrl && (
                      <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Attached
                      </span>
                    )}
                  </div>
                  <DiagramUploader
                    currentUrl={currentQ.solutionImageUrl}
                    isSolution
                    onUploadSuccess={(url) => handleUpdateQuestionImage(url, true)}
                    onRemove={() => handleUpdateQuestionImage(null, true)}
                    questionId={currentQ.id}
                    label="Drop Solution Diagram or Ctrl+V Screenshot"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">No question selected.</p>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous Q</span>
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={currentIndex >= questions.length - 1}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition"
            >
              <span>Next Q</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {saveStatus && (
            <div className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>{saveStatus}</span>
            </div>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/25 transition disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Diagrams &amp; Finish</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttachDiagramsModal;
