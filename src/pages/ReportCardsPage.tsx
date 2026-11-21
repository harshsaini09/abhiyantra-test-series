import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  GraduationCap,
  MinusCircle,
  Printer,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  XCircle,
  ArrowLeft,
  BookOpen,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { fetchReportCardsApi, fetchReportCardDetailApi } from '../utils/api';
import type { SavedReportCard, QuestionResult } from '../types';
import { formatDurationHuman } from '../utils/scoring';
import RichContent from '../components/RichContent';
import { QuestionImage } from '../components/ImageLightbox';
import TikzDiagram from '../components/TikzDiagram';

type FilterMode = 'ALL' | 'EXAM' | 'PRACTICE';
type SortOption = 'newest' | 'oldest' | 'highest_score' | 'highest_accuracy';
type FilterTab = 'all' | 'correct' | 'incorrect' | 'unattempted';

export default function ReportCardsPage() {
  const { user } = useAuth();
  const [reportCards, setReportCards] = useState<SavedReportCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMode, setSelectedMode] = useState<FilterMode>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // Detail View State
  const [selectedCard, setSelectedCard] = useState<SavedReportCard | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());

  // Load report cards when user is available or changed
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchReportCardsApi()
      .then((data) => {
        if (mounted) {
          setReportCards(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Error loading report cards:', err);
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [user]);

  // Handle open full report card detail
  const handleOpenDetail = async (rc: SavedReportCard) => {
    setDetailLoading(true);
    // If detailedReviewJson is already present on card, use it; otherwise fetch by ID
    if (rc.detailedReviewJson && rc.detailedReviewJson.length > 0) {
      setSelectedCard(rc);
      setDetailLoading(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      try {
        const fullDetail = await fetchReportCardDetailApi(rc.id);
        setSelectedCard(fullDetail || rc);
      } catch {
        setSelectedCard(rc);
      } finally {
        setDetailLoading(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const toggleQuestion = (id: number) => {
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filtered and sorted report cards
  const filteredReportCards = useMemo(() => {
    let list = [...reportCards];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((rc) => rc.testTitle.toLowerCase().includes(q));
    }

    if (selectedMode !== 'ALL') {
      list = list.filter((rc) => rc.mode === selectedMode);
    }

    list.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
      }
      if (sortBy === 'highest_score') {
        return b.score - a.score;
      }
      if (sortBy === 'highest_accuracy') {
        return b.accuracy - a.accuracy;
      }
      return 0;
    });

    return list;
  }, [reportCards, searchQuery, selectedMode, sortBy]);

  // Overall Performance Statistics
  const overallStats = useMemo(() => {
    if (reportCards.length === 0) return null;
    const totalTests = reportCards.length;
    const avgScorePercent =
      reportCards.reduce((acc, curr) => acc + (curr.maxMarks > 0 ? (curr.score / curr.maxMarks) * 100 : 0), 0) /
      totalTests;
    const avgAccuracy = reportCards.reduce((acc, curr) => acc + curr.accuracy, 0) / totalTests;
    const highestScore = Math.max(...reportCards.map((r) => r.score));
    const totalTimeSeconds = reportCards.reduce((acc, curr) => acc + (curr.timeTakenSeconds || 0), 0);

    return {
      totalTests,
      avgScorePercent: Math.max(0, avgScorePercent).toFixed(1),
      avgAccuracy: Math.max(0, avgAccuracy).toFixed(1),
      highestScore: highestScore.toFixed(2),
      totalTimeSeconds,
    };
  }, [reportCards]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      {/* ─────────────────────────────────────────────────────────────
          SIGNED OUT STATE: Clean Call-to-Action with Google Sign-In
          ───────────────────────────────────────────────────────────── */}
      {!user ? (
        <main className="flex-1 max-w-5xl mx-auto px-4 py-12 w-full flex flex-col items-center justify-center">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl p-8 sm:p-12 text-center max-w-2xl w-full">
            <div className="w-20 h-20 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-6 text-indigo-600 shadow-inner">
              <Trophy className="w-10 h-10" />
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              Abhiyantra Cloud Student Hub
            </div>

            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-3">
              Sign In to Access Your Report Cards
            </h1>

            <p className="text-slate-600 text-sm leading-relaxed mb-8 max-w-lg mx-auto">
              Save your completed GATE mock tests permanently, track your score progression over time, review in-depth
              solutions, and sync your results securely across all your devices.
            </p>

            {/* Google Sign In Button */}
            <div className="flex justify-center mb-8">
              <button
                type="button"
                onClick={() => {
                  const navBtn = document.querySelector('header div[role="button"], header iframe') as HTMLElement;
                  if (navBtn) {
                    navBtn.click();
                  } else {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
                className="inline-flex items-center gap-3 px-6 py-2.5 rounded-full border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold shadow-xs transition hover:shadow cursor-pointer"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                Continue with Google
              </button>
            </div>

            {/* Feature highlights grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left border-t border-slate-100 pt-8">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Permanent Cloud History</h4>
                  <p className="text-[11px] text-slate-500">PostgreSQL database stores every test attempt and answer.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <Target className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Accuracy & Time Analytics</h4>
                  <p className="text-[11px] text-slate-500">Track negative marking impact and time per question.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <BookOpen className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Full Question Solutions</h4>
                  <p className="text-[11px] text-slate-500">Never lose access to detailed solutions and answer keys.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <GraduationCap className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-slate-800">GATE Standard Scoring</h4>
                  <p className="text-[11px] text-slate-500">1/3 negative marking for 1-mark & 2/3 for 2-mark MCQs.</p>
                </div>
              </div>
            </div>
          </div>
        </main>
      ) : selectedCard ? (
        /* ─────────────────────────────────────────────────────────────
            FULL REPORT CARD DETAIL VIEW (When an attempt is clicked)
            ───────────────────────────────────────────────────────────── */
        <main className="flex-1 max-w-6xl mx-auto px-4 py-8 w-full space-y-8">
          {/* Detail View Navigation & Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs print:hidden">
            <button
              onClick={() => setSelectedCard(null)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-sm font-semibold transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to All Report Cards
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-sm font-semibold transition"
              >
                <Printer className="w-4 h-4" />
                Print Report Card
              </button>
            </div>
          </div>

          {/* Test Header */}
          <div className="bg-gradient-to-r from-indigo-800 via-indigo-700 to-blue-700 text-white rounded-3xl p-6 sm:p-8 shadow-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-xs font-bold tracking-wide uppercase">
                    {selectedCard.mode} MODE
                  </span>
                  <span className="text-indigo-200 text-xs font-medium">
                    {new Date(selectedCard.submittedAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{selectedCard.testTitle}</h1>
                <p className="text-indigo-100 text-xs mt-1">Student: {user.name} ({user.email})</p>
              </div>

              <div className="text-right sm:border-l sm:border-white/20 sm:pl-6">
                <span className="text-xs uppercase font-bold text-indigo-200 block">Total Score</span>
                <span className="text-3xl sm:text-4xl font-extrabold text-white">
                  {selectedCard.score.toFixed(2)}
                  <span className="text-lg font-medium text-indigo-200"> / {selectedCard.maxMarks}</span>
                </span>
              </div>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <p className="text-xs text-slate-500 font-medium">Accuracy</p>
              <p className="text-xl font-bold text-indigo-600 mt-1">{selectedCard.accuracy.toFixed(1)}%</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <p className="text-xs text-slate-500 font-medium">Correct</p>
              <p className="text-xl font-bold text-emerald-600 mt-1">{selectedCard.correctCount}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <p className="text-xs text-slate-500 font-medium">Incorrect</p>
              <p className="text-xl font-bold text-red-600 mt-1">{selectedCard.incorrectCount}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <p className="text-xs text-slate-500 font-medium">Unattempted</p>
              <p className="text-xl font-bold text-slate-600 mt-1">{selectedCard.unattemptedCount}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <p className="text-xs text-slate-500 font-medium">Negative Marks</p>
              <p className="text-xl font-bold text-rose-600 mt-1">-{selectedCard.negativeMarks.toFixed(2)}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <p className="text-xs text-slate-500 font-medium">Time Taken</p>
              <p className="text-xl font-bold text-slate-800 mt-1">{formatDurationHuman(selectedCard.timeTakenSeconds)}</p>
            </div>
          </div>

          {/* Solutions & Detailed Review */}
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                  Solutions & Question Review
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Complete snapshot of every question, your response, and detailed GATE explanations.
                </p>
              </div>

              {/* Filter Tabs */}
              {selectedCard.detailedReviewJson && (
                <div className="flex rounded-lg bg-slate-200/80 p-1 text-xs font-semibold">
                  {(['all', 'correct', 'incorrect', 'unattempted'] as FilterTab[]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveFilter(tab)}
                      className={`px-3 py-1.5 rounded-md capitalize transition ${
                        activeFilter === tab
                          ? 'bg-white text-indigo-700 shadow-xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedCard.detailedReviewJson && selectedCard.detailedReviewJson.length > 0 ? (
              <div className="space-y-4">
                {selectedCard.detailedReviewJson
                  .filter((qr: QuestionResult) => {
                    if (activeFilter === 'correct') return qr.isCorrect;
                    if (activeFilter === 'incorrect') return qr.isAttempted && !qr.isCorrect;
                    if (activeFilter === 'unattempted') return !qr.isAttempted;
                    return true;
                  })
                  .map((qr: QuestionResult, idx: number) => {
                    const isExpanded = expandedQuestions.has(qr.questionId);
                    return (
                      <div
                        key={qr.questionId || idx}
                        className={`bg-white rounded-2xl border transition-all ${
                          qr.isCorrect
                            ? 'border-emerald-200 shadow-xs'
                            : qr.isAttempted
                              ? 'border-red-200 shadow-xs'
                              : 'border-slate-200'
                        }`}
                      >
                        {/* Header */}
                        <div
                          onClick={() => toggleQuestion(qr.questionId)}
                          className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50/50 rounded-2xl transition"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-700">
                              Q{qr.question?.id || idx + 1}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                qr.question?.type === 'MCQ'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : qr.question?.type === 'MSQ'
                                    ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {qr.question?.type || 'MCQ'} ({qr.question?.marks || 1}M)
                            </span>
                            {(qr.question?.subject || qr.question?.topic) && (
                              <span className="hidden sm:inline-block text-xs text-slate-500 font-medium">
                                {[qr.question?.subject, qr.question?.topic].filter(Boolean).join(' • ')}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            {qr.isCorrect ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                                <CheckCircle className="w-3.5 h-3.5" />
                                +{qr.marksAwarded} Marks
                              </span>
                            ) : qr.isAttempted ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
                                <XCircle className="w-3.5 h-3.5" />
                                {qr.marksAwarded} Marks
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                                <MinusCircle className="w-3.5 h-3.5" />
                                Unattempted (0)
                              </span>
                            )}
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                          </div>
                        </div>

                        {/* Collapsible Content */}
                        {isExpanded && (
                          <div className="p-5 border-t border-slate-100 bg-slate-50/30 space-y-4">
                            {qr.question?.imageUrl && (
                              <div className="max-w-md">
                                <QuestionImage src={qr.question.imageUrl} alt="Question Visual" />
                              </div>
                            )}

                            {qr.question?.tikzCode && (
                              <div className="max-w-md">
                                <TikzDiagram code={qr.question.tikzCode} caption="Question Diagram" />
                              </div>
                            )}

                            <div className="text-sm font-semibold text-slate-800 leading-relaxed">
                              <RichContent content={qr.question?.question || ''} />
                            </div>

                            {/* Options if MCQ/MSQ */}
                            {qr.question?.options && (
                              <div className="grid grid-cols-1 gap-2 pt-1">
                                {qr.question.options.map((opt: string, optIdx: number) => {
                                  const optLetter = String.fromCharCode(65 + optIdx);
                                  const isUserAnswer =
                                    qr.userResponse?.selectedOptions?.includes(optIdx) ||
                                    qr.userAnswer?.includes(optLetter);
                                  const isCorrectOption =
                                    Array.isArray(qr.question.answer)
                                      ? qr.question.answer.includes(optIdx)
                                      : qr.question.answer === optIdx;

                                  let optStyle = 'border-slate-200 bg-white text-slate-700';
                                  if (isCorrectOption) {
                                    optStyle = 'border-emerald-300 bg-emerald-50 text-emerald-900 font-semibold';
                                  } else if (isUserAnswer && !isCorrectOption) {
                                    optStyle = 'border-red-300 bg-red-50 text-red-900 font-medium';
                                  }

                                  return (
                                    <div
                                      key={optIdx}
                                      className={`flex items-center justify-between p-3 rounded-xl border text-xs ${optStyle}`}
                                    >
                                      <div className="flex items-start gap-2.5 flex-1">
                                        <span className="font-bold shrink-0">{optLetter}.</span>
                                        <div className="flex-1">
                                          <RichContent content={opt} />
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1.5 font-bold text-[11px] shrink-0 ml-2">
                                        {isUserAnswer && (
                                          <span className="text-slate-500 font-medium">(Your Choice)</span>
                                        )}
                                        {isCorrectOption && (
                                          <span className="text-emerald-700">✓ Correct</span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* NAT Answer details */}
                            {qr.question?.type === 'NAT' && (
                              <div className="flex flex-wrap gap-4 p-3 bg-white rounded-xl border border-slate-200 text-xs">
                                <div>
                                  <span className="text-slate-500 block">Your Answer:</span>
                                  <span className="font-bold text-slate-800">{qr.userAnswer || 'None'}</span>
                                </div>
                                <div className="border-l border-slate-200 pl-4">
                                  <span className="text-slate-500 block">Correct Range:</span>
                                  <span className="font-bold text-emerald-700">{qr.correctAnswer}</span>
                                </div>
                              </div>
                            )}

                            {/* Solution Box */}
                            <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 space-y-2">
                              <h5 className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                Official Abhiyantra Solution:
                              </h5>
                              {qr.question?.solutionImageUrl && (
                                <div className="max-w-md">
                                  <QuestionImage src={qr.question.solutionImageUrl} alt="Solution Visual" />
                                </div>
                              )}
                              {qr.question?.solutionTikzCode && (
                                <div className="max-w-md">
                                  <TikzDiagram code={qr.question.solutionTikzCode} caption="Solution Diagram" />
                                </div>
                              )}
                              <div className="text-xs text-indigo-950 leading-relaxed">
                                <RichContent content={qr.question?.solution || 'Solution provided during assessment.'} />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
                <p className="text-xs text-slate-500">Summary preserved. Question-by-question review snapshot was not attached.</p>
              </div>
            )}
          </section>
        </main>
      ) : (
        /* ─────────────────────────────────────────────────────────────
            SIGNED IN MAIN VIEW: Overall Stats & History Table
            ───────────────────────────────────────────────────────────── */
        <main className="flex-1 max-w-6xl mx-auto px-4 py-8 w-full space-y-8">
          {/* Welcome & Overview Header */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-2">
                  <Award className="w-3.5 h-3.5 text-indigo-400" />
                  Official Student Portal
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  Welcome back, {user.name}
                </h1>
                <p className="text-slate-300 text-xs sm:text-sm mt-1">
                  All your past GATE mock tests, scores, solutions, and analytics are synced in real-time with PostgreSQL.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  to="/"
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition"
                >
                  Take Another Test
                </Link>
                <Link
                  to="/question-bank"
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold transition"
                >
                  Question Bank
                </Link>
              </div>
            </div>
          </div>

          {/* Overall Stats Banner */}
          {overallStats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
              <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-5 shadow-xs flex items-center gap-2.5 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold shrink-0">
                  <Trophy className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] sm:text-xs font-medium text-slate-500 truncate">Total Tests</p>
                  <p className="text-lg sm:text-2xl font-extrabold text-slate-900">{overallStats.totalTests}</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-5 shadow-xs flex items-center gap-2.5 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                  <Target className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] sm:text-xs font-medium text-slate-500 truncate">Avg Accuracy</p>
                  <p className="text-lg sm:text-2xl font-extrabold text-emerald-600">{overallStats.avgAccuracy}%</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-5 shadow-xs flex items-center gap-2.5 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center font-bold shrink-0">
                  <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] sm:text-xs font-medium text-slate-500 truncate">Avg Score %</p>
                  <p className="text-lg sm:text-2xl font-extrabold text-purple-600">{overallStats.avgScorePercent}%</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-5 shadow-xs flex items-center gap-2.5 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center font-bold shrink-0">
                  <Award className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] sm:text-xs font-medium text-slate-500 truncate">Highest Score</p>
                  <p className="text-lg sm:text-2xl font-extrabold text-amber-600">{overallStats.highestScore}</p>
                </div>
              </div>
            </div>
          )}

          {/* Search, Filter & History Section */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search past tests by title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Mode Filter */}
                <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
                  {(['ALL', 'EXAM', 'PRACTICE'] as FilterMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setSelectedMode(mode)}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        selectedMode === mode
                          ? 'bg-white text-indigo-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                {/* Sort Option */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium rounded-xl px-3 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="highest_score">Highest Score</option>
                  <option value="highest_accuracy">Highest Accuracy</option>
                </select>
              </div>
            </div>

            {/* List of Report Cards */}
            {loading || detailLoading ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs font-medium text-slate-500">Loading your report card history...</p>
              </div>
            ) : filteredReportCards.length === 0 ? (
              <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl p-6">
                <Trophy className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800">No report cards found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
                  {searchQuery || selectedMode !== 'ALL'
                    ? 'No past test attempts match the selected filters.'
                    : 'You haven’t completed any GATE tests yet. Take a sample or custom test to see your report cards here!'}
                </p>
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition"
                >
                  Take Your First Mock Test
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredReportCards.map((rc) => {
                  const percent = rc.maxMarks > 0 ? (rc.score / rc.maxMarks) * 100 : 0;
                  return (
                    <div
                      key={rc.id}
                      className="py-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-slate-50/60 p-3 rounded-2xl transition"
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide ${
                              rc.mode === 'EXAM'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : 'bg-purple-50 text-purple-700 border border-purple-200'
                            }`}
                          >
                            {rc.mode}
                          </span>
                          <span className="text-xs text-slate-400 flex items-center gap-1 font-medium">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(rc.submittedAt).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            {formatDurationHuman(rc.timeTakenSeconds)}
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-slate-900 truncate">
                          {rc.testTitle}
                        </h3>

                        {/* Breakdown Pills */}
                        <div className="flex items-center gap-3 text-xs font-medium pt-1">
                          <span className="text-emerald-700 font-bold">{rc.correctCount} Correct</span>
                          <span className="text-slate-300">/</span>
                          <span className="text-red-600 font-bold">{rc.incorrectCount} Incorrect</span>
                          <span className="text-slate-300">/</span>
                          <span className="text-slate-500">{rc.unattemptedCount} Unattempted</span>
                        </div>
                      </div>

                      {/* Score & Action Button */}
                      <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                        <div className="text-right">
                          <span className="text-xl font-extrabold text-slate-900 block">
                            {rc.score.toFixed(2)}
                            <span className="text-xs font-semibold text-slate-400"> / {rc.maxMarks}</span>
                          </span>
                          <span
                            className={`text-xs font-bold ${
                              percent >= 60 ? 'text-emerald-600' : percent >= 35 ? 'text-amber-600' : 'text-red-500'
                            }`}
                          >
                            {percent.toFixed(1)}% Score • {rc.accuracy.toFixed(0)}% Acc
                          </span>
                        </div>

                        <button
                          onClick={() => handleOpenDetail(rc)}
                          className="px-4 py-2 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-xl text-xs font-bold transition shadow-xs"
                        >
                          View Report & Solutions →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      )}
    </div>
  );
}
