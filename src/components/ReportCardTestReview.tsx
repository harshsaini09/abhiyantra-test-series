import { useState, useMemo } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Clock,
  RotateCcw,
  Printer,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  BookOpen,
  FastForward,
} from 'lucide-react';
import RichContent from './RichContent';
import { QuestionImage } from './ImageLightbox';
import type {
  SavedReportCard,
  QuestionResult,
  Question,
  NATAnswer,
  UserProfile,
  BookmarkItem,
} from '../types';

interface ReportCardTestReviewProps {
  reportCard: SavedReportCard;
  user?: UserProfile | null;
  onBack: () => void;
  onRetest: (rc: SavedReportCard) => void;
  bookmarks?: BookmarkItem[];
  onToggleBookmark?: (question: Question) => void;
}

type PaletteFilter = 'ALL' | 'CORRECT' | 'INCORRECT' | 'UNATTEMPTED';

export default function ReportCardTestReview({
  reportCard,
  user,
  onBack,
  onRetest,
  bookmarks = [],
  onToggleBookmark,
}: ReportCardTestReviewProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [paletteFilter, setPaletteFilter] = useState<PaletteFilter>('ALL');
  const [showMobilePalette, setShowMobilePalette] = useState(false);

  const reviews: QuestionResult[] = useMemo(() => {
    let raw: any = reportCard.detailedReviewJson;
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = [];
      }
    }
    if (Array.isArray(raw)) {
      return raw.map((qr: any) => {
        if (!qr || !qr.question) return qr;
        const q = qr.question;
        const sol = (q.solution || q.explanation || q.detailedSolution || q.solutionText || q.rationale || '').toString().trim();
        const qText = (q.question || q.questionText || q.text || q.statement || '').toString().trim();
        return {
          ...qr,
          question: {
            ...q,
            question: qText || q.question,
            solution: sol || q.solution || '',
            explanation: sol || q.explanation || '',
          },
        };
      });
    }
    return [];
  }, [reportCard]);

  const totalQuestions = reviews.length;
  const currentQr = reviews[currentIdx];

  // Helper for checking if current question is bookmarked
  const isBookmarked = useMemo(() => {
    if (!currentQr?.question) return false;
    const qHash = currentQr.question.contentHash;
    return bookmarks.some((b) => (qHash ? b.questionHash === qHash : b.questionSnapshotJson?.id === currentQr.question.id));
  }, [bookmarks, currentQr]);

  // Overall counts
  const counts = useMemo(() => {
    let correct = 0;
    let incorrect = 0;
    let unattempted = 0;
    reviews.forEach((r) => {
      if (r.isCorrect) correct++;
      else if (r.isAttempted) incorrect++;
      else unattempted++;
    });
    return {
      total: reviews.length,
      correct,
      incorrect,
      unattempted,
    };
  }, [reviews]);

  // Filtered indices for palette
  const filteredIndices = useMemo(() => {
    return reviews
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => {
        if (paletteFilter === 'CORRECT') return r.isCorrect;
        if (paletteFilter === 'INCORRECT') return r.isAttempted && !r.isCorrect;
        if (paletteFilter === 'UNATTEMPTED') return !r.isAttempted;
        return true;
      })
      .map(({ i }) => i);
  }, [reviews, paletteFilter]);

  // Jump to Next Incorrect Question
  const handleJumpNextIncorrect = () => {
    if (reviews.length === 0) return;
    for (let step = 1; step <= reviews.length; step++) {
      const targetIdx = (currentIdx + step) % reviews.length;
      const target = reviews[targetIdx];
      if (target.isAttempted && !target.isCorrect) {
        setCurrentIdx(targetIdx);
        return;
      }
    }
  };

  // Helper to format marking scheme text
  const getMarkingScheme = (q: Question) => {
    if (q.type === 'MCQ') {
      const neg = q.marks === 1 ? '−⅓' : '−⅔';
      return { positive: `+${q.marks}`, negative: neg };
    }
    return { positive: `+${q.marks}`, negative: '0' };
  };

  // Helper to format NAT answer
  const formatNatCorrect = (ans: number | number[] | NATAnswer) => {
    if (typeof ans === 'number') return String(ans);
    if (typeof ans === 'object' && ans !== null && 'min' in ans && 'max' in ans) {
      if (ans.min === ans.max) return String(ans.min);
      return `${ans.min} to ${ans.max} (Accepted Range)`;
    }
    return String(ans);
  };

  if (!reviews || reviews.length === 0) {
    return (
      <main className="flex-1 max-w-4xl mx-auto px-4 py-12 text-center">
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-4">
          <BookOpen className="w-12 h-12 text-indigo-500 mx-auto" />
          <h2 className="text-xl font-bold text-slate-800">No Detailed Question Review Available</h2>
          <p className="text-sm text-slate-500">
            This report card summary is preserved, but detailed question-by-question responses were not recorded for this attempt.
          </p>
          <button
            onClick={onBack}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition"
          >
            Back to Report Cards
          </button>
        </div>
      </main>
    );
  }

  const q = currentQr.question;
  const marking = getMarkingScheme(q);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-800">
      {/* ═══ TOP NAVBAR & TEST HEADER BAR ═══ */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          {/* Left: Back & Test Identity */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold transition cursor-pointer shrink-0"
              title="Return to Report Cards"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide bg-indigo-100 text-indigo-800 shrink-0">
                  {reportCard.mode} MODE
                </span>
                <span className="text-xs text-slate-400 hidden sm:inline">
                  {new Date(reportCard.submittedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                {user?.name && (
                  <span className="text-xs font-semibold text-slate-600 hidden md:inline">
                    • {user.name}
                  </span>
                )}
              </div>
              <h1 className="text-sm sm:text-base font-extrabold text-slate-900 truncate max-w-xs sm:max-w-md md:max-w-xl">
                {reportCard.testTitle}
              </h1>
            </div>
          </div>

          {/* Right: Key Score Metrics & Actions */}
          <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
            <div className="text-right hidden md:block">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Score</span>
              <span className="text-base font-extrabold text-indigo-700">
                {reportCard.score.toFixed(2)}
                <span className="text-xs text-slate-400 font-normal"> / {reportCard.maxMarks}</span>
              </span>
            </div>

            <div className="text-right hidden sm:block">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Accuracy</span>
              <span className="text-base font-extrabold text-emerald-600">
                {reportCard.accuracy.toFixed(1)}%
              </span>
            </div>

            <div className="h-7 w-px bg-slate-200 hidden sm:block" />

            <button
              onClick={() => onRetest(reportCard)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retest</span>
            </button>

            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold transition cursor-pointer hidden sm:inline-flex"
              title="Print or Save PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
          </div>
        </div>
      </header>

      {/* ═══ MAIN SPLIT WORKSPACE: QUESTION VIEW (LEFT) + PALETTE (RIGHT) ═══ */}
      <div className="flex-1 flex max-w-7xl mx-auto w-full relative">
        {/* ─── LEFT: MAIN QUESTION & SOLUTION CONTAINER ─── */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-8 pb-32 md:pb-24 overflow-y-auto">
          {/* Question Header Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 mb-5 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              {/* Left: Question Number, Type, Subject & Topic */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                  Question {currentIdx + 1}
                </span>
                <span className="text-xs text-slate-400 font-medium">of {totalQuestions}</span>

                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase tracking-wide ${
                    q.type === 'MCQ'
                      ? 'bg-blue-100 text-blue-800 border border-blue-200'
                      : q.type === 'MSQ'
                      ? 'bg-purple-100 text-purple-800 border border-purple-200'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  {q.type}
                </span>

                {q.subject && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {q.subject}
                  </span>
                )}
                {q.topic && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                    {q.topic}
                  </span>
                )}
              </div>

              {/* Rightmost Side: Marking Scheme (+1, -1/3) & Student Marks Awarded */}
              <div className="flex items-center gap-2 flex-wrap sm:ml-auto">
                {/* Marking Scheme Badge: e.g. +1, -1/3 */}
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200"
                  title="Marking Scheme for this question"
                >
                  <span className="text-slate-500 font-medium">Marks:</span>
                  <span className="text-emerald-700 font-extrabold">{marking.positive}</span>
                  <span className="text-slate-400">/</span>
                  <span className="text-rose-700 font-extrabold">{marking.negative}</span>
                </div>

                {/* Question Result Outcome Pill */}
                {currentQr.isCorrect ? (
                  <div className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>+{currentQr.marksAwarded.toFixed(2).replace(/\.00$/, '')} Marks Scored</span>
                  </div>
                ) : currentQr.isAttempted ? (
                  <div className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-extrabold bg-rose-100 text-rose-800 border border-rose-300 shadow-xs">
                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                    <span>
                      {currentQr.marksAwarded < 0
                        ? `${currentQr.marksAwarded.toFixed(2)} Marks`
                        : `-${currentQr.marksAwarded} Marks`}
                    </span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                    <MinusCircle className="w-3.5 h-3.5 text-slate-400" />
                    <span>0.00 (Unattempted)</span>
                  </div>
                )}

                {/* Time spent on this question */}
                {currentQr.timeSpentSeconds !== undefined && currentQr.timeSpentSeconds > 0 && (
                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                    <Clock className="w-3 h-3" />
                    <span>
                      {Math.floor(currentQr.timeSpentSeconds / 60)}m {currentQr.timeSpentSeconds % 60}s
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Question Text with KaTeX Math Rendering */}
            <div className="py-2 text-base sm:text-lg leading-relaxed text-slate-900 font-normal">
              <RichContent content={q.question} />
            </div>

            {/* Question Figures / Diagrams */}
            {q.imageUrl && (
              <div className="my-4 max-w-xl">
                <QuestionImage src={q.imageUrl} alt={`Question ${currentIdx + 1} Diagram`} />
              </div>
            )}
          </div>

          {/* ─── OPTIONS & STUDENT'S MARKED ANSWER DISPLAY ─── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 mb-5 space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Answer &amp; Options Breakdown
            </h3>

            {/* Unattempted Notice Banner */}
            {!currentQr.isAttempted && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs sm:text-sm font-semibold">
                <MinusCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>You did not attempt this question. Correct answer is highlighted below.</span>
              </div>
            )}

            {/* ─── MCQ OPTIONS ─── */}
            {q.type === 'MCQ' && q.options && (
              <div className="space-y-3">
                {q.options.map((opt, optIdx) => {
                  const correctIdx = Number(q.answer);
                  const isCorrect = optIdx === correctIdx;
                  const isSelected =
                    currentQr.userResponse?.selectedOptions?.[0] === optIdx ||
                    (currentQr.isAttempted && currentQr.userAnswer.trim().startsWith(String.fromCharCode(65 + optIdx)));

                  let containerStyle = 'border-slate-200 bg-white hover:bg-slate-50/60';
                  let badge = null;
                  let letterStyle = 'bg-slate-100 text-slate-700';

                  if (isSelected && isCorrect) {
                    containerStyle = 'border-2 border-emerald-500 bg-emerald-50/80 shadow-xs ring-1 ring-emerald-200';
                    letterStyle = 'bg-emerald-600 text-white font-extrabold';
                    badge = (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-extrabold bg-emerald-600 text-white shadow-xs shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Your Answer &amp; Correct Answer</span>
                      </span>
                    );
                  } else if (isSelected && !isCorrect) {
                    containerStyle = 'border-2 border-rose-500 bg-rose-50/80 shadow-xs ring-1 ring-rose-200';
                    letterStyle = 'bg-rose-600 text-white font-extrabold';
                    badge = (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-extrabold bg-rose-600 text-white shadow-xs shrink-0">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Your Marked Answer (Incorrect)</span>
                      </span>
                    );
                  } else if (isCorrect) {
                    containerStyle = 'border-2 border-emerald-500/80 bg-emerald-50/40';
                    letterStyle = 'bg-emerald-600 text-white font-extrabold';
                    badge = (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Correct Answer</span>
                      </span>
                    );
                  }

                  return (
                    <div
                      key={optIdx}
                      className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition-all ${containerStyle}`}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${letterStyle}`}
                        >
                          {String.fromCharCode(65 + optIdx)}
                        </span>
                        <div className="text-slate-800 leading-relaxed text-sm sm:text-base flex-1">
                          <RichContent content={opt} />
                        </div>
                      </div>
                      {badge}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ─── MSQ OPTIONS ─── */}
            {q.type === 'MSQ' && q.options && (
              <div className="space-y-3">
                {q.options.map((opt, optIdx) => {
                  const correctArr: number[] = Array.isArray(q.answer) ? q.answer : [];
                  const isCorrect = correctArr.includes(optIdx);
                  const isSelected =
                    currentQr.userResponse?.selectedOptions?.includes(optIdx) ||
                    (currentQr.isAttempted && currentQr.userAnswer.includes(String.fromCharCode(65 + optIdx)));

                  let containerStyle = 'border-slate-200 bg-white';
                  let letterStyle = 'bg-slate-100 text-slate-700';
                  let badge = null;

                  if (isSelected && isCorrect) {
                    containerStyle = 'border-2 border-emerald-500 bg-emerald-50/80 shadow-xs';
                    letterStyle = 'bg-emerald-600 text-white font-extrabold';
                    badge = (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-emerald-600 text-white shadow-xs shrink-0">
                        ✓ Correct &amp; Selected
                      </span>
                    );
                  } else if (isSelected && !isCorrect) {
                    containerStyle = 'border-2 border-rose-500 bg-rose-50/80 shadow-xs';
                    letterStyle = 'bg-rose-600 text-white font-extrabold';
                    badge = (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-rose-600 text-white shadow-xs shrink-0">
                        ✗ Wrongly Selected
                      </span>
                    );
                  } else if (isCorrect) {
                    containerStyle = 'border-2 border-emerald-500/80 bg-emerald-50/40';
                    letterStyle = 'bg-emerald-600 text-white font-extrabold';
                    badge = (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                        ✓ Correct Option (Missed)
                      </span>
                    );
                  }

                  return (
                    <div
                      key={optIdx}
                      className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition-all ${containerStyle}`}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${letterStyle}`}
                        >
                          {String.fromCharCode(65 + optIdx)}
                        </span>
                        <div className="text-slate-800 leading-relaxed text-sm sm:text-base flex-1">
                          <RichContent content={opt} />
                        </div>
                      </div>
                      {badge}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ─── NAT (NUMERICAL ANSWER TYPE) ─── */}
            {q.type === 'NAT' && (
              <div className="space-y-4 max-w-xl">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                    Your Numerical Response in Blank Box:
                  </span>

                  {/* Mock Input Box simulating the exam keypad textbox */}
                  <div
                    className={`w-full max-w-sm px-4 py-3 rounded-xl border-2 font-mono text-lg font-bold flex items-center justify-between ${
                      currentQr.isCorrect
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-950 shadow-xs'
                        : currentQr.isAttempted
                        ? 'border-rose-500 bg-rose-50 text-rose-950 shadow-xs'
                        : 'border-slate-300 bg-white text-slate-400'
                    }`}
                  >
                    <span>
                      {currentQr.userResponse?.natInput ||
                        (currentQr.isAttempted ? currentQr.userAnswer : '— (No Input Entered)')}
                    </span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                        currentQr.isCorrect
                          ? 'bg-emerald-600 text-white'
                          : currentQr.isAttempted
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {currentQr.isCorrect
                        ? '✓ Correct'
                        : currentQr.isAttempted
                        ? '✗ Incorrect'
                        : 'Unattempted'}
                    </span>
                  </div>

                  {/* Comparison Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                    <div className="p-3 rounded-lg bg-white border border-slate-200">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        Your Entered Value
                      </span>
                      <span
                        className={`text-base font-mono font-bold ${
                          currentQr.isCorrect
                            ? 'text-emerald-700'
                            : currentQr.isAttempted
                            ? 'text-rose-700'
                            : 'text-slate-500'
                        }`}
                      >
                        {currentQr.userResponse?.natInput ||
                          (currentQr.isAttempted ? currentQr.userAnswer : 'Not Attempted')}
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200">
                      <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
                        Official Correct Value / Range
                      </span>
                      <span className="text-base font-mono font-bold text-emerald-800">
                        {formatNatCorrect(q.answer)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ─── DETAILED SOLUTION CARD (AT THE BOTTOM AS REQUESTED) ─── */}
          <div className="rounded-2xl border border-indigo-200 bg-gradient-to-b from-indigo-50/40 via-white to-white shadow-xs p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-xs">
                  💡
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm sm:text-base tracking-tight">
                    Detailed Solution &amp; Step-by-Step Explanation
                  </h3>
                  <span className="text-xs text-indigo-600 font-semibold">
                    Official {reportCard.examCategory === 'JEE_MAINS' ? 'JEE Mains' : 'GATE'} Assessment Solution
                  </span>
                </div>
              </div>

              {/* Bookmark Toggle in Solution */}
              {onToggleBookmark && (
                <button
                  onClick={() => onToggleBookmark(q)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border shadow-xs ${
                    isBookmarked
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                  title="Bookmark this question for revision"
                >
                  <Bookmark
                    className={`w-3.5 h-3.5 ${
                      isBookmarked ? 'fill-amber-500 text-amber-600' : 'text-slate-400'
                    }`}
                  />
                  <span>{isBookmarked ? 'Bookmarked' : 'Bookmark Question'}</span>
                </button>
              )}
            </div>

            {/* Solution Figures / Diagrams */}
            {q.solutionImageUrl && (
              <div className="my-3 max-w-xl">
                <QuestionImage src={q.solutionImageUrl} alt="Solution Diagram" />
              </div>
            )}

            {/* Solution Text with Math Rendering */}
            <div className="text-slate-800 text-sm sm:text-base leading-relaxed space-y-3">
              <RichContent content={q.solution || q.explanation || (q as any).detailedSolution || (q as any).solutionText || (q as any).rationale || 'Detailed step-by-step solution provided in test paper.'} />
            </div>
          </div>
        </main>

        {/* ─── RIGHT: QUESTION PALETTE NAVIGATION BAR (DESKTOP) ─── */}
        <aside className="hidden lg:flex w-80 flex-col border-l border-slate-200 bg-white sticky top-[61px] h-[calc(100vh-61px)] overflow-y-auto">
          <PaletteContent
            reviews={reviews}
            currentIdx={currentIdx}
            counts={counts}
            paletteFilter={paletteFilter}
            onSelectFilter={setPaletteFilter}
            onSelectIdx={(idx) => setCurrentIdx(idx)}
            filteredIndices={filteredIndices}
          />
        </aside>
      </div>

      {/* ─── BOTTOM STICKY CONTROLS BAR ─── */}
      <footer className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-slate-200 shadow-md py-3 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Previous Question Button */}
          <button
            onClick={() => setCurrentIdx((prev) => Math.max(0, prev - 1))}
            disabled={currentIdx === 0}
            className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm font-bold text-slate-700 transition cursor-pointer shadow-xs"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Previous Question</span>
            <span className="sm:hidden">Prev</span>
          </button>

          {/* Quick Mistakes Jump & Active Indicator */}
          <div className="flex items-center gap-2">
            {counts.incorrect > 0 && (
              <button
                onClick={handleJumpNextIncorrect}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition cursor-pointer"
                title="Jump directly to next incorrect question"
              >
                <FastForward className="w-3.5 h-3.5 text-rose-600" />
                <span className="hidden sm:inline">Next Incorrect</span>
                <span className="sm:hidden">Mistake</span>
              </button>
            )}

            <span className="text-xs font-bold text-slate-500 hidden md:inline">
              Q{currentIdx + 1} of {totalQuestions}
            </span>
          </div>

          {/* Next Question Button */}
          <button
            onClick={() => setCurrentIdx((prev) => Math.min(totalQuestions - 1, prev + 1))}
            disabled={currentIdx === totalQuestions - 1}
            className="inline-flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm font-bold text-white transition cursor-pointer shadow-xs"
          >
            <span className="hidden sm:inline">Next Question</span>
            <span className="sm:hidden">Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </footer>

      {/* ─── FLOATING TOGGLE BUTTON FOR MOBILE PALETTE ─── */}
      <button
        onClick={() => setShowMobilePalette(true)}
        className="fixed bottom-16 right-4 z-30 lg:hidden flex items-center gap-2 px-4 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-lg transition cursor-pointer"
      >
        <Menu className="w-4 h-4" />
        <span>Palette ({currentIdx + 1}/{totalQuestions})</span>
      </button>

      {/* ─── MOBILE PALETTE OVERLAY / DRAWER ─── */}
      {showMobilePalette && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setShowMobilePalette(false)}
          />
          <aside className="relative ml-auto w-80 max-w-[85%] h-full bg-white shadow-2xl flex flex-col z-50">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <span className="font-extrabold text-sm text-slate-800">Question Palette</span>
              <button
                onClick={() => setShowMobilePalette(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <PaletteContent
              reviews={reviews}
              currentIdx={currentIdx}
              counts={counts}
              paletteFilter={paletteFilter}
              onSelectFilter={setPaletteFilter}
              onSelectIdx={(idx) => {
                setCurrentIdx(idx);
                setShowMobilePalette(false);
              }}
              filteredIndices={filteredIndices}
            />
          </aside>
        </div>
      )}
    </div>
  );
}

// ───────────────────── Question Palette Subcomponent ─────────────────────

interface PaletteContentProps {
  reviews: QuestionResult[];
  currentIdx: number;
  counts: {
    total: number;
    correct: number;
    incorrect: number;
    unattempted: number;
  };
  paletteFilter: PaletteFilter;
  onSelectFilter: (f: PaletteFilter) => void;
  onSelectIdx: (idx: number) => void;
  filteredIndices: number[];
}

function PaletteContent({
  reviews,
  currentIdx,
  counts,
  paletteFilter,
  onSelectFilter,
  onSelectIdx,
  filteredIndices,
}: PaletteContentProps) {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Overview Status Counts */}
      <div className="p-3 border-b border-slate-200 bg-slate-50/70">
        <div className="grid grid-cols-3 gap-1.5 text-center">
          <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
            <span className="text-[10px] font-bold text-emerald-700 uppercase block">Correct</span>
            <span className="text-base font-extrabold text-emerald-800">{counts.correct}</span>
          </div>
          <div className="p-2 rounded-xl bg-rose-50 border border-rose-200">
            <span className="text-[10px] font-bold text-rose-700 uppercase block">Incorrect</span>
            <span className="text-base font-extrabold text-rose-800">{counts.incorrect}</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-100 border border-slate-200">
            <span className="text-[10px] font-bold text-slate-600 uppercase block">Left</span>
            <span className="text-base font-extrabold text-slate-700">{counts.unattempted}</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="p-3 border-b border-slate-100 flex items-center gap-1 overflow-x-auto text-xs font-semibold">
        <button
          onClick={() => onSelectFilter('ALL')}
          className={`px-2.5 py-1 rounded-lg transition cursor-pointer whitespace-nowrap ${
            paletteFilter === 'ALL'
              ? 'bg-slate-900 text-white font-bold'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All ({counts.total})
        </button>
        <button
          onClick={() => onSelectFilter('CORRECT')}
          className={`px-2.5 py-1 rounded-lg transition cursor-pointer whitespace-nowrap ${
            paletteFilter === 'CORRECT'
              ? 'bg-emerald-600 text-white font-bold'
              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
          }`}
        >
          ✓ Correct ({counts.correct})
        </button>
        <button
          onClick={() => onSelectFilter('INCORRECT')}
          className={`px-2.5 py-1 rounded-lg transition cursor-pointer whitespace-nowrap ${
            paletteFilter === 'INCORRECT'
              ? 'bg-rose-600 text-white font-bold'
              : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
          }`}
        >
          ✗ Incorrect ({counts.incorrect})
        </button>
        <button
          onClick={() => onSelectFilter('UNATTEMPTED')}
          className={`px-2.5 py-1 rounded-lg transition cursor-pointer whitespace-nowrap ${
            paletteFilter === 'UNATTEMPTED'
              ? 'bg-slate-600 text-white font-bold'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          ○ Left ({counts.unattempted})
        </button>
      </div>

      {/* Question 1 2 3 Number Grid */}
      <div className="p-3 flex-1 overflow-y-auto">
        <div className="grid grid-cols-5 gap-2">
          {reviews.map((r, i) => {
            const isVisible = filteredIndices.includes(i);
            const isSelected = i === currentIdx;

            let colorStyle = 'bg-slate-200 text-slate-700 hover:bg-slate-300';
            if (r.isCorrect) {
              colorStyle = 'bg-emerald-500 text-white font-extrabold hover:bg-emerald-600';
            } else if (r.isAttempted) {
              colorStyle = 'bg-rose-500 text-white font-extrabold hover:bg-rose-600';
            }

            return (
              <button
                key={r.questionId || i}
                onClick={() => onSelectIdx(i)}
                className={`relative flex h-10 w-full items-center justify-center rounded-xl text-xs font-bold transition-all cursor-pointer ${colorStyle} ${
                  isSelected
                    ? 'ring-4 ring-indigo-600 ring-offset-2 scale-105 z-10 shadow-md'
                    : ''
                } ${!isVisible ? 'opacity-20 hover:opacity-100' : ''}`}
                title={`Question ${i + 1}: ${
                  r.isCorrect ? 'Correct' : r.isAttempted ? 'Incorrect' : 'Unattempted'
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend Footer */}
      <div className="p-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-600 space-y-1.5">
        <span className="font-extrabold text-[11px] text-slate-500 uppercase tracking-wider block mb-1">
          Review Legend
        </span>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-md bg-emerald-500 shrink-0" />
          <span>Correct Question</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-md bg-rose-500 shrink-0" />
          <span>Incorrect Question</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-md bg-slate-200 shrink-0" />
          <span>Unattempted Question</span>
        </div>
      </div>
    </div>
  );
}
