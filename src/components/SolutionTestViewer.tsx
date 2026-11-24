import { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Printer,
  Bookmark,
  Check,
  X,
  Menu,
  Clock,
  Award,
  Sparkles,
} from 'lucide-react';
import RichContent from './RichContent';
import { QuestionImage } from './ImageLightbox';
import TikzDiagram from './TikzDiagram';
import type { SavedReportCard, QuestionResult, Question, NATAnswer } from '../types';
import { computeQuestionHash, toggleBookmarkApi, fetchBookmarksApi } from '../utils/api';

interface SolutionTestViewerProps {
  reportCard: SavedReportCard;
  onBack: () => void;
  onRetest?: (reportCard: SavedReportCard) => void;
  onRetestMistakes?: (reportCard: SavedReportCard) => void;
}

type PaletteFilter = 'ALL' | 'CORRECT' | 'INCORRECT' | 'UNATTEMPTED';

export default function SolutionTestViewer({
  reportCard,
  onBack,
  onRetest,
  onRetestMistakes,
}: SolutionTestViewerProps) {
  const questionResults: QuestionResult[] = useMemo(() => {
    return reportCard.detailedReviewJson || [];
  }, [reportCard.detailedReviewJson]);

  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [filter, setFilter] = useState<PaletteFilter>('ALL');
  const [showMobilePalette, setShowMobilePalette] = useState<boolean>(false);
  const [bookmarkedHashes, setBookmarkedHashes] = useState<Set<string>>(new Set());

  // Load existing bookmarks
  useEffect(() => {
    fetchBookmarksApi()
      .then((items) => {
        setBookmarkedHashes(new Set(items.map((b) => b.questionHash)));
      })
      .catch(() => {});
  }, []);

  const totalQuestions = questionResults.length;
  const currentQr: QuestionResult | undefined = questionResults[currentIdx];

  // Counts
  const counts = useMemo(() => {
    let correct = 0;
    let incorrect = 0;
    let unattempted = 0;
    questionResults.forEach((qr) => {
      if (qr.isCorrect) correct++;
      else if (qr.isAttempted) incorrect++;
      else unattempted++;
    });
    return {
      total: questionResults.length,
      correct,
      incorrect,
      unattempted,
    };
  }, [questionResults]);

  // Handle bookmark toggle
  const handleToggleBookmark = async (q: Question) => {
    const qHash = computeQuestionHash(q);
    const newSet = new Set(bookmarkedHashes);
    if (newSet.has(qHash)) {
      newSet.delete(qHash);
    } else {
      newSet.add(qHash);
    }
    setBookmarkedHashes(newSet);
    await toggleBookmarkApi(q).catch(() => {});
  };

  // Safe navigation
  const goPrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goNext = () => {
    if (currentIdx < totalQuestions - 1) {
      setCurrentIdx(currentIdx + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Keyboard navigation (Arrow keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIdx, totalQuestions]);

  if (!currentQr || totalQuestions === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 min-h-[60vh] text-center">
        <p className="text-slate-600 font-semibold mb-4 text-base">
          No detailed question solutions are available for this report card.
        </p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Report Cards
        </button>
      </div>
    );
  }

  const q = currentQr.question;
  const userResp = currentQr.userResponse;
  const isCorrect = currentQr.isCorrect;
  const isAttempted = currentQr.isAttempted;
  const isIncorrect = isAttempted && !isCorrect;
  const marksAwarded = currentQr.marksAwarded;
  const isBookmarked = bookmarkedHashes.has(computeQuestionHash(q));

  // Marking Scheme Label
  const getMarkingBadge = () => {
    if (q.type === 'MCQ') {
      const neg = q.marks === 1 ? '−⅓' : '−⅔';
      return `+${q.marks} | ${neg}`;
    }
    return `+${q.marks} | 0`;
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-slate-100/70">
      {/* ─── Top Solutions Header Bar ─── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs print:hidden">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold transition cursor-pointer"
              title="Return to Report Cards list"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Reports</span>
              <span className="sm:hidden">Back</span>
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700">
                  {reportCard.mode} SOLUTIONS
                </span>
                <span className="text-xs text-slate-500 font-medium hidden md:inline">
                  {new Date(reportCard.submittedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate max-w-xs sm:max-w-md md:max-w-lg">
                {reportCard.testTitle}
              </h1>
            </div>
          </div>

          {/* Test Performance Pills & Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700">
              <Award className="w-3.5 h-3.5 text-indigo-600" />
              <span>Score:</span>
              <span className="font-black text-indigo-700">
                {reportCard.score.toFixed(2)} / {reportCard.maxMarks}
              </span>
              <span className="text-slate-300">|</span>
              <span>Accuracy:</span>
              <span className="font-bold text-emerald-600">{reportCard.accuracy.toFixed(1)}%</span>
            </div>

            {onRetestMistakes && counts.incorrect > 0 && (
              <button
                onClick={() => onRetestMistakes(reportCard)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
                title="Retest only questions answered incorrectly"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retest Mistakes ({counts.incorrect})</span>
              </button>
            )}

            {onRetest && (
              <button
                onClick={() => onRetest(reportCard)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                title="Take this full test again"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Retest Full Test</span>
                <span className="sm:hidden">Retest</span>
              </button>
            )}

            <button
              onClick={() => window.print()}
              className="p-1.5 sm:px-2.5 sm:py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              title="Print Solutions"
            >
              <Printer className="w-4 h-4" />
            </button>

            {/* Mobile palette toggle */}
            <button
              onClick={() => setShowMobilePalette(!showMobilePalette)}
              className="md:hidden p-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition cursor-pointer"
              title="Toggle Question Palette"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ─── Main Content Body (Question Canvas + Right Palette) ─── */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto p-3 sm:p-5 gap-5 overflow-hidden">
        {/* Left Column: Question Details & Solution */}
        <main className="flex-1 bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs p-4 sm:p-7 overflow-y-auto flex flex-col justify-between">
          <div>
            {/* Question Header Row: Q.Number, Type, Subject, Topic on Left, Marks on Rightmost */}
            <div className="flex items-center justify-between gap-3 flex-wrap mb-5 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Q.{currentIdx + 1}
                </span>

                <span
                  className={`px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider ${
                    q.type === 'MCQ'
                      ? 'bg-blue-100 text-blue-700'
                      : q.type === 'MSQ'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {q.type}
                </span>

                {q.subject && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 border border-indigo-200/80 text-indigo-700">
                    {q.subject}
                  </span>
                )}

                {q.topic && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 border border-slate-200 text-slate-700">
                    {q.topic}
                  </span>
                )}
              </div>

              {/* Rightmost side: Marking Scheme badge + Bookmark */}
              <div className="flex items-center gap-2 ml-auto">
                <span
                  className="px-3 py-1 rounded-lg text-xs font-extrabold tracking-wide bg-slate-100 border border-slate-200 text-slate-700 shadow-2xs"
                  title="Marks for correct | penalty for incorrect"
                >
                  {getMarkingBadge()}
                </span>

                <button
                  onClick={() => handleToggleBookmark(q)}
                  className={`p-1.5 rounded-lg border transition cursor-pointer ${
                    isBookmarked
                      ? 'bg-amber-50 border-amber-300 text-amber-600'
                      : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600'
                  }`}
                  title={isBookmarked ? 'Bookmarked in Revision Notebook' : 'Bookmark this question'}
                >
                  <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-amber-500' : ''}`} />
                </button>
              </div>
            </div>

            {/* Question Visuals: Diagram / Image / TikZ */}
            {q.imageUrl && (
              <div className="mb-5 max-w-xl">
                <QuestionImage src={q.imageUrl} alt={`Question ${currentIdx + 1} Diagram`} />
              </div>
            )}
            {q.tikzCode && (
              <div className="mb-5 max-w-xl">
                <TikzDiagram code={q.tikzCode} caption={`Figure for Question ${currentIdx + 1}`} />
              </div>
            )}

            {/* Question Statement with LaTeX Math */}
            <div className="mb-6 text-base sm:text-lg leading-relaxed text-slate-900 font-normal">
              <RichContent content={q.question} />
            </div>

            {/* ─── Options Display (MCQ / MSQ / NAT) ─── */}
            <div className="space-y-3 mb-6">
              {/* MCQ Options */}
              {q.type === 'MCQ' && q.options && (
                <div className="space-y-3">
                  {q.options.map((opt, i) => {
                    const isUserChoice =
                      userResp?.selectedOptions?.includes(i) ||
                      (currentQr.userAnswer && currentQr.userAnswer.startsWith(String.fromCharCode(65 + i)));
                    const isCorrectOption = Number(q.answer) === i;

                    let cardClass = 'border-slate-200 bg-white hover:bg-slate-50/60';
                    let radioClass = 'border-slate-300 text-slate-400';
                    let badge = null;

                    if (isUserChoice && isCorrectOption) {
                      cardClass = 'border-emerald-500 bg-emerald-50/80 ring-1 ring-emerald-400';
                      radioClass = 'border-emerald-600 bg-emerald-600 text-white';
                      badge = (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-2xs">
                          <Check className="w-3 h-3 stroke-[3]" />
                          Your Answer (Correct)
                        </span>
                      );
                    } else if (isUserChoice && !isCorrectOption) {
                      cardClass = 'border-rose-500 bg-rose-50/80 ring-1 ring-rose-400';
                      radioClass = 'border-rose-600 bg-rose-600 text-white';
                      badge = (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-600 text-white shadow-2xs">
                          <X className="w-3 h-3 stroke-[3]" />
                          Your Answer (Incorrect)
                        </span>
                      );
                    } else if (!isUserChoice && isCorrectOption) {
                      cardClass = 'border-emerald-500 bg-emerald-50/40 border-dashed sm:border-solid';
                      radioClass = 'border-emerald-500 text-emerald-600';
                      badge = (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <Check className="w-3 h-3 stroke-[3]" />
                          Correct Answer
                        </span>
                      );
                    }

                    return (
                      <div
                        key={i}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl border transition-all ${cardClass}`}
                      >
                        <div className="flex items-start gap-3 flex-1">
                          <div
                            className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold ${radioClass}`}
                          >
                            {isUserChoice && <span className="w-2 h-2 rounded-full bg-current" />}
                          </div>
                          <span className="font-extrabold text-slate-600 shrink-0">
                            {String.fromCharCode(65 + i)}.
                          </span>
                          <div className="text-slate-800 leading-relaxed flex-1">
                            <RichContent content={opt} />
                          </div>
                        </div>

                        {badge && <div className="self-end sm:self-center shrink-0">{badge}</div>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* MSQ Options */}
              {q.type === 'MSQ' && q.options && (
                <div className="space-y-3">
                  {q.options.map((opt, i) => {
                    const isUserChoice =
                      userResp?.selectedOptions?.includes(i) ||
                      (currentQr.userAnswer && currentQr.userAnswer.includes(String.fromCharCode(65 + i)));
                    const isCorrectOption = Array.isArray(q.answer) && q.answer.map(Number).includes(i);

                    let cardClass = 'border-slate-200 bg-white hover:bg-slate-50/60';
                    let badge = null;

                    if (isUserChoice && isCorrectOption) {
                      cardClass = 'border-emerald-500 bg-emerald-50/80 ring-1 ring-emerald-400';
                      badge = (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-2xs">
                          <Check className="w-3 h-3 stroke-[3]" />
                          Your Selection (Correct)
                        </span>
                      );
                    } else if (isUserChoice && !isCorrectOption) {
                      cardClass = 'border-rose-500 bg-rose-50/80 ring-1 ring-rose-400';
                      badge = (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-600 text-white shadow-2xs">
                          <X className="w-3 h-3 stroke-[3]" />
                          Your Selection (Incorrect)
                        </span>
                      );
                    } else if (!isUserChoice && isCorrectOption) {
                      cardClass = 'border-emerald-500 bg-emerald-50/40 border-dashed sm:border-solid';
                      badge = (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <Check className="w-3 h-3 stroke-[3]" />
                          Correct Answer (Missed)
                        </span>
                      );
                    }

                    return (
                      <div
                        key={i}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl border transition-all ${cardClass}`}
                      >
                        <div className="flex items-start gap-3 flex-1">
                          <div
                            className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 text-xs ${
                              isUserChoice ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'
                            }`}
                          >
                            {isUserChoice && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                          <span className="font-extrabold text-slate-600 shrink-0">
                            {String.fromCharCode(65 + i)}.
                          </span>
                          <div className="text-slate-800 leading-relaxed flex-1">
                            <RichContent content={opt} />
                          </div>
                        </div>

                        {badge && <div className="self-end sm:self-center shrink-0">{badge}</div>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* NAT Numerical Answer Box */}
              {q.type === 'NAT' && (
                <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* User's Input */}
                    <div className="p-4 rounded-xl border bg-white shadow-2xs">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                        Your Entered Answer
                      </span>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-lg sm:text-xl font-mono font-black ${
                            isCorrect
                              ? 'text-emerald-700'
                              : isAttempted
                              ? 'text-rose-700'
                              : 'text-slate-400 italic'
                          }`}
                        >
                          {userResp?.natInput || currentQr.userAnswer || 'Not Attempted'}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isCorrect
                              ? 'bg-emerald-100 text-emerald-800'
                              : isAttempted
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {isCorrect ? '✓ Correct' : isAttempted ? '✗ Incorrect' : '○ Unattempted'}
                        </span>
                      </div>
                    </div>

                    {/* Official Correct Value */}
                    <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/50 shadow-2xs">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 block mb-1">
                        Official Correct Answer Range
                      </span>
                      <span className="text-lg sm:text-xl font-mono font-black text-emerald-900 block">
                        {typeof q.answer === 'number'
                          ? q.answer
                          : (q.answer as NATAnswer)?.min !== undefined
                          ? (q.answer as NATAnswer).min === (q.answer as NATAnswer).max
                            ? (q.answer as NATAnswer).min
                            : `${(q.answer as NATAnswer).min} to ${(q.answer as NATAnswer).max}`
                          : currentQr.correctAnswer}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ─── Solution Card at Bottom (Matching the UI in the uploaded screenshot) ─── */}
            <div
              className={`rounded-2xl border p-5 sm:p-6 transition-all ${
                isIncorrect
                  ? 'border-rose-300 bg-rose-50/20'
                  : isCorrect
                  ? 'border-emerald-300 bg-emerald-50/20'
                  : 'border-slate-300 bg-slate-50/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                <div
                  className={`text-lg sm:text-xl font-bold flex items-center gap-1.5 ${
                    isIncorrect
                      ? 'text-rose-600'
                      : isCorrect
                      ? 'text-emerald-600'
                      : 'text-slate-600'
                  }`}
                >
                  {isIncorrect ? '✗ Incorrect' : isCorrect ? '✓ Correct' : '○ Unattempted'}
                </div>

                <div className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                  {currentQr.timeSpentSeconds !== undefined && currentQr.timeSpentSeconds > 0 && (
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {Math.floor(currentQr.timeSpentSeconds / 60)}m {currentQr.timeSpentSeconds % 60}s
                    </span>
                  )}
                </div>
              </div>

              <div className="text-xs sm:text-sm text-slate-600 font-medium">
                Marks awarded:{' '}
                <span
                  className={`font-black ${
                    marksAwarded > 0
                      ? 'text-emerald-700'
                      : marksAwarded < 0
                      ? 'text-rose-700'
                      : 'text-slate-700'
                  }`}
                >
                  {marksAwarded > 0 ? `+${marksAwarded}` : marksAwarded}
                </span>
              </div>

              <div className="border-t border-slate-200/80 my-3.5" />

              <div className="space-y-3">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  Solution
                </h3>

                {q.solutionImageUrl && (
                  <div className="max-w-lg mb-3">
                    <QuestionImage src={q.solutionImageUrl} alt="Solution Visual" />
                  </div>
                )}

                {q.solutionTikzCode && (
                  <div className="max-w-lg mb-3">
                    <TikzDiagram code={q.solutionTikzCode} caption="Solution Figure" />
                  </div>
                )}

                <div className="text-sm leading-relaxed text-slate-800 font-normal">
                  <RichContent content={q.solution || 'Detailed step-by-step solution provided in assessment key.'} />
                </div>
              </div>
            </div>
          </div>

          {/* ─── Bottom Navigation Buttons ─── */}
          <div className="mt-8 pt-4 border-t border-slate-200 flex items-center justify-between gap-3 flex-wrap">
            <button
              onClick={goPrev}
              disabled={currentIdx === 0}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <span className="text-xs font-bold text-slate-500">
              Question {currentIdx + 1} of {totalQuestions}
            </span>

            <button
              onClick={goNext}
              disabled={currentIdx === totalQuestions - 1}
              className="inline-flex items-center gap-1 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-xs transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </main>

        {/* ─── Right Column: Question Palette Sidebar (Desktop) ─── */}
        <aside className="hidden md:flex w-72 lg:w-80 flex-col bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs p-4 overflow-hidden shrink-0">
          <PaletteComponent
            questionResults={questionResults}
            currentIdx={currentIdx}
            counts={counts}
            filter={filter}
            setFilter={setFilter}
            onSelect={(idx) => {
              setCurrentIdx(idx);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </aside>
      </div>

      {/* ─── Mobile Palette Drawer / Modal ─── */}
      {showMobilePalette && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setShowMobilePalette(false)}
          />
          <div className="relative ml-auto w-4/5 max-w-sm h-full bg-white shadow-2xl p-4 flex flex-col z-50">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Question Palette</h2>
              <button
                onClick={() => setShowMobilePalette(false)}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <PaletteComponent
                questionResults={questionResults}
                currentIdx={currentIdx}
                counts={counts}
                filter={filter}
                setFilter={setFilter}
                onSelect={(idx) => {
                  setCurrentIdx(idx);
                  setShowMobilePalette(false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────── Palette Subcomponent ─────────────────────

function PaletteComponent({
  questionResults,
  currentIdx,
  counts,
  filter,
  setFilter,
  onSelect,
}: {
  questionResults: QuestionResult[];
  currentIdx: number;
  counts: { total: number; correct: number; incorrect: number; unattempted: number };
  filter: PaletteFilter;
  setFilter: (f: PaletteFilter) => void;
  onSelect: (idx: number) => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Status Summary Banner */}
      <div className="grid grid-cols-2 gap-2 pb-4 border-b border-slate-100 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-emerald-700">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
          <span>✓ Correct: {counts.correct}</span>
        </div>
        <div className="flex items-center gap-1.5 font-bold text-rose-700">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
          <span>✗ Incorrect: {counts.incorrect}</span>
        </div>
        <div className="flex items-center gap-1.5 font-medium text-slate-500 col-span-2">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-300 shrink-0" />
          <span>○ Unattempted: {counts.unattempted}</span>
        </div>
      </div>

      {/* Filter Tabs (All / Correct / Incorrect / Unattempted) */}
      <div className="flex items-center gap-1 my-3 bg-slate-100 p-1 rounded-xl">
        <button
          onClick={() => setFilter('ALL')}
          className={`flex-1 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
            filter === 'ALL' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('INCORRECT')}
          className={`flex-1 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
            filter === 'INCORRECT' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Wrong ({counts.incorrect})
        </button>
        <button
          onClick={() => setFilter('CORRECT')}
          className={`flex-1 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
            filter === 'CORRECT' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Right ({counts.correct})
        </button>
      </div>

      {/* Number Buttons Grid */}
      <div className="flex-1 overflow-y-auto pr-1">
        <div className="grid grid-cols-5 gap-2 pt-1 pb-4">
          {questionResults.map((qr, i) => {
            const isMatchFilter =
              filter === 'ALL' ||
              (filter === 'CORRECT' && qr.isCorrect) ||
              (filter === 'INCORRECT' && qr.isAttempted && !qr.isCorrect) ||
              (filter === 'UNATTEMPTED' && !qr.isAttempted);

            const isCurrent = i === currentIdx;

            // Palette colors based on test outcome
            let btnBg = 'bg-slate-200 text-slate-700 hover:bg-slate-300';
            if (qr.isCorrect) {
              btnBg = 'bg-emerald-500 hover:bg-emerald-600 text-white';
            } else if (qr.isAttempted) {
              btnBg = 'bg-rose-500 hover:bg-rose-600 text-white';
            }

            return (
              <button
                key={qr.questionId || i}
                onClick={() => onSelect(i)}
                className={`flex h-10 w-full items-center justify-center rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${btnBg} ${
                  isCurrent ? 'ring-2 ring-indigo-600 ring-offset-2 scale-105 shadow-md z-10' : ''
                } ${!isMatchFilter ? 'opacity-25' : 'opacity-100'}`}
                title={`Q${i + 1}: ${qr.isCorrect ? 'Correct' : qr.isAttempted ? 'Incorrect' : 'Unattempted'}`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend at bottom */}
      <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 space-y-1 mt-auto">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-emerald-500 shrink-0" />
          <span>Correct Response (+Marks)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-rose-500 shrink-0" />
          <span>Incorrect Response (-Negative)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-slate-200 shrink-0" />
          <span>Unattempted Question (0 Marks)</span>
        </div>
      </div>
    </div>
  );
}
