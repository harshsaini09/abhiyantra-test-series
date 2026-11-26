// ============================================================
// Report Card & Solution Review Page
// ============================================================
import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  Trophy,
  Target,
  CheckCircle,
  XCircle,
  MinusCircle,
  TrendingUp,
  Clock,
  Printer,
  RotateCcw,
  PlusCircle,
  ChevronDown,
  ChevronUp,
  Database,
  Wrench,
  Award,
  Bookmark,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatDurationHuman } from '../utils/scoring';
import type { TestResults, QuestionResult, Question } from '../types';
import { toggleBookmarkApi, fetchBookmarksApi, computeQuestionHash } from '../utils/api';
import RichContent from '../components/RichContent';
import { QuestionImage } from '../components/ImageLightbox';
import Navbar from '../components/Navbar';

type FilterTab = 'all' | 'correct' | 'incorrect' | 'unattempted';

export default function ReportPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const results = (location.state as { results?: TestResults } | null)?.results;

  const { user, stagePendingResults } = useAuth();
  const isTeacherOrAdmin = user?.role === 'TEACHER' || user?.role === 'ADMIN' || ['brainiacssolutions9@gmail.com', 'harshsaini0912@gmail.com', 'harshsaini0912@gmail'].includes(user?.email?.toLowerCase() || '');
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'idle'>('idle');

  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());
  const [bookmarkedHashes, setBookmarkedHashes] = useState<Set<string>>(new Set());

  // Load existing bookmarks
  useEffect(() => {
    fetchBookmarksApi()
      .then((items) => {
        setBookmarkedHashes(new Set(items.map((b) => b.questionHash)));
      })
      .catch(() => {});
  }, []);

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

  // Check save status from initial submission
  useEffect(() => {
    if (results) {
      setSaveStatus('saved');
      if (!user) {
        stagePendingResults(results);
      }
    }
  }, [user, results, stagePendingResults]);

  // ---- No results guard ----
  if (!results) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center space-y-4">
            <Trophy className="w-16 h-16 text-slate-300 mx-auto" />
            <h2 className="text-2xl font-semibold text-slate-700">No test results found</h2>
            <p className="text-slate-500">
              It looks like you haven't taken a test yet or the results have expired.
            </p>
            <Link
              to="/"
              className="inline-block mt-4 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              Go to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ---- Helpers ----
  const toggleQuestion = (id: number) => {
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredQuestions: QuestionResult[] = results.questionResults.filter((qr) => {
    if (activeFilter === 'correct') return qr.isCorrect;
    if (activeFilter === 'incorrect') return qr.isAttempted && !qr.isCorrect;
    if (activeFilter === 'unattempted') return !qr.isAttempted;
    return true;
  });

  const counts = {
    all: results.questionResults.length,
    correct: results.totalCorrect,
    incorrect: results.totalIncorrect,
    unattempted: results.totalUnattempted,
  };

  // ---- Score badge color ----
  const percentColor =
    results.percentage >= 60
      ? 'text-green-600'
      : results.percentage >= 33
        ? 'text-yellow-600'
        : 'text-red-600';

  // ---- Breakdown rows ----
  const breakdownRows = [
    ...Object.entries(results.byType).map(([label, data]) => ({ category: 'Question Type', label, ...data })),
    ...Object.entries(results.byMarks).map(([label, data]) => ({ category: 'Mark Value', label, ...data })),
    ...(results.bySubject
      ? Object.entries(results.bySubject).map(([label, data]) => ({ category: 'Subject', label, ...data }))
      : []),
  ];

  // ─── Time Analysis Metrics ───
  let timeCorrect = 0, countCorrect = 0;
  let timeIncorrect = 0, countIncorrect = 0;
  let timeUnattempted = 0, countUnattempted = 0;

  results.questionResults.forEach((qr) => {
    const t = qr.timeSpentSeconds || 0;
    if (qr.isAttempted && qr.isCorrect) {
      timeCorrect += t;
      countCorrect += 1;
    } else if (qr.isAttempted && !qr.isCorrect) {
      timeIncorrect += t;
      countIncorrect += 1;
    } else {
      timeUnattempted += t;
      countUnattempted += 1;
    }
  });

  const avgTimeCorrect = countCorrect > 0 ? Math.round(timeCorrect / countCorrect) : 0;
  const avgTimeIncorrect = countIncorrect > 0 ? Math.round(timeIncorrect / countIncorrect) : 0;
  const avgTimeUnattempted = countUnattempted > 0 ? Math.round(timeUnattempted / countUnattempted) : 0;

  const timeSinkQuestions = results.questionResults
    .filter((qr) => (!qr.isCorrect || !qr.isAttempted) && (qr.timeSpentSeconds || 0) >= 90)
    .sort((a, b) => (b.timeSpentSeconds || 0) - (a.timeSpentSeconds || 0))
    .slice(0, 4);

  // ================================================================
  // Render
  // ================================================================
  return (
    <div className="min-h-screen bg-slate-50 print:bg-white flex flex-col w-full max-w-full overflow-x-hidden">
      <div className="print:hidden">
        <Navbar />
      </div>
      {/* ---- Header ---- */}
      <header className="bg-gradient-to-r from-indigo-800 via-indigo-700 to-blue-700 text-white py-6 sm:py-8 px-3 sm:px-4 print:py-4 print:bg-white print:text-slate-900 border-b print:border-slate-300 w-full max-w-full overflow-hidden">
        <div className="max-w-6xl mx-auto text-center space-y-2 sm:space-y-3">
          {/* Official Abhiyantra Brand Logo */}
          <div className="flex items-center justify-center gap-2.5 sm:gap-3">
            <img
              src="/logo.avif"
              alt="Abhiyantra Logo"
              className="w-10 h-10 sm:w-12 sm:h-12 object-contain rounded-xl bg-white/10 print:bg-slate-100 p-1.5 shadow-md border border-white/20 print:border-slate-300 shrink-0"
            />
            <div className="text-left min-w-0">
              <span className="text-[10px] sm:text-xs uppercase font-extrabold tracking-wider text-indigo-200 print:text-indigo-700 block">
                abhiyantra educational institute
              </span>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-white print:text-slate-900 truncate">
                GATE Examination Report Card
              </h1>
            </div>
          </div>
          <p className="text-indigo-100 print:text-slate-600 text-sm sm:text-base font-medium truncate">{results.testData.title}</p>
          {(results.testData.subject || results.testData.topic) && (
            <p className="text-indigo-200 print:text-slate-500 text-xs font-semibold truncate">
              {[results.testData.subject, results.testData.topic].filter(Boolean).join(' • ')}
            </p>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-6 sm:space-y-10 w-full max-w-full overflow-hidden min-w-0">
        {/* ================================================================
            0. Cloud Sync & Google Auth Callout Banner
            ================================================================ */}
        {user ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 shadow-xs print:hidden w-full max-w-full">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-bold text-emerald-950 truncate">
                  {saveStatus === 'saving' ? 'Saving report card to your account...' : '✓ Saved to your Report Cards'}
                </p>
                <p className="text-[11px] sm:text-xs text-emerald-700 truncate">
                  Permanently stored in PostgreSQL and linked to {user.email}.
                </p>
              </div>
            </div>
            <Link
              to="/report-cards"
              className="px-3.5 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs w-full sm:w-auto text-center shrink-0"
            >
              View in All Report Cards →
            </Link>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-3.5 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 shadow-xs print:hidden w-full max-w-full">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-bold text-amber-950">
                  Sign in with Google to save this report card
                </p>
                <p className="text-[11px] sm:text-xs text-amber-800">
                  Signing in automatically preserves this attempt and unlocks your permanent history.
                </p>
              </div>
            </div>
            <div className="shrink-0 w-full sm:w-auto">
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
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-4 sm:px-5 py-2 rounded-full border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold shadow-xs transition hover:shadow cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                Sign in with Google
              </button>
            </div>
          </div>
        )}

        {/* ================================================================
            1. Score Summary Cards
            ================================================================ */}
        <section>
          <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            Score Summary
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Total Score */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 col-span-1 sm:col-span-2 lg:col-span-1 flex flex-col items-center justify-center">
              <Trophy className="w-10 h-10 text-indigo-500 mb-2" />
              <p className="text-sm text-slate-500 font-medium">Total Score</p>
              <p className="text-4xl font-bold text-indigo-700">
                {results.totalScore} <span className="text-xl text-slate-400">/ {results.maxMarks}</span>
              </p>
            </div>

            {/* Percentage */}
            <SummaryCard
              icon={<Target className="w-6 h-6 text-indigo-500" />}
              label="Percentage"
              value={`${results.percentage.toFixed(2)}%`}
              valueClass={percentColor}
            />

            {/* Accuracy */}
            <SummaryCard
              icon={<Target className="w-6 h-6 text-blue-500" />}
              label="Accuracy"
              value={`${results.accuracy.toFixed(2)}%`}
              valueClass="text-blue-600"
            />

            {/* Correct */}
            <SummaryCard
              icon={<CheckCircle className="w-6 h-6 text-green-500" />}
              label="Correct"
              value={String(results.totalCorrect)}
              valueClass="text-green-600"
            />

            {/* Incorrect */}
            <SummaryCard
              icon={<XCircle className="w-6 h-6 text-red-500" />}
              label="Incorrect"
              value={String(results.totalIncorrect)}
              valueClass="text-red-600"
            />

            {/* Unattempted */}
            <SummaryCard
              icon={<MinusCircle className="w-6 h-6 text-slate-400" />}
              label="Unattempted"
              value={String(results.totalUnattempted)}
              valueClass="text-slate-500"
            />

            {/* Positive Marks */}
            <SummaryCard
              icon={<PlusCircle className="w-6 h-6 text-green-500" />}
              label="Positive Marks"
              value={`+${results.positiveMarks}`}
              valueClass="text-green-600"
            />

            {/* Negative Marks */}
            <SummaryCard
              icon={<MinusCircle className="w-6 h-6 text-red-500" />}
              label="Negative Marks"
              value={String(results.negativeMarks)}
              valueClass="text-red-600"
            />

            {/* Time Taken */}
            <SummaryCard
              icon={<Clock className="w-6 h-6 text-blue-500" />}
              label="Time Taken"
              value={formatDurationHuman(results.timeTaken)}
              valueClass="text-blue-600"
            />
          </div>
        </section>

        {/* ================================================================
            Time Analysis & Time-Sink Alerts
            ================================================================ */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Per-Question Time Insights
            </h2>
            <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full font-medium">
              GATE Benchmark: ~2.7 min / question
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
              <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">Avg Time on Correct</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">
                {Math.floor(avgTimeCorrect / 60)}m {avgTimeCorrect % 60}s
              </p>
              <p className="text-[11px] text-emerald-600 mt-1">Across {countCorrect} correct questions</p>
            </div>

            <div className="p-4 rounded-xl bg-red-50 border border-red-100">
              <p className="text-xs font-semibold text-red-800 uppercase tracking-wide">Avg Time on Incorrect</p>
              <p className="text-2xl font-bold text-red-700 mt-1">
                {Math.floor(avgTimeIncorrect / 60)}m {avgTimeIncorrect % 60}s
              </p>
              <p className="text-[11px] text-red-600 mt-1">Across {countIncorrect} incorrect attempts</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Avg Time on Unattempted</p>
              <p className="text-2xl font-bold text-slate-700 mt-1">
                {Math.floor(avgTimeUnattempted / 60)}m {avgTimeUnattempted % 60}s
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Across {countUnattempted} skipped questions</p>
            </div>
          </div>

          {/* Time-Sink Alert */}
          {timeSinkQuestions.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
              <div className="flex items-center gap-2 font-bold text-amber-900 text-sm mb-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <span>Time-Sink Alert: High-Time Questions Without Marks</span>
              </div>
              <p className="text-xs text-amber-800 mb-3 leading-relaxed">
                You spent 1.5+ minutes on these questions but missed positive marks. In actual GATE exams, recognizing stuck questions early and skipping them frees up crucial minutes for easy scoring opportunities.
              </p>
              <div className="flex flex-wrap gap-2">
                {timeSinkQuestions.map((ts) => (
                  <div
                    key={ts.questionId}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-xs font-semibold text-slate-800 shadow-xs"
                  >
                    <span>Q{ts.questionId}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 font-bold">
                      ⏱ {Math.floor((ts.timeSpentSeconds || 0) / 60)}m {(ts.timeSpentSeconds || 0) % 60}s
                    </span>
                    <span className={`text-[10px] font-bold ${ts.isAttempted ? 'text-red-600' : 'text-slate-500'}`}>
                      {ts.isAttempted ? 'Wrong' : 'Skipped'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ================================================================
            2. Performance Breakdown Table
            ================================================================ */}
        <section>
          <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-600" />
            Performance Breakdown
          </h2>

          <div className="overflow-x-auto w-full max-w-full bg-white rounded-xl shadow-sm border border-slate-200">
            <table className="w-full min-w-[540px] text-sm text-left">
              <thead>
                <tr className="bg-slate-100 text-slate-600 uppercase text-xs tracking-wider">
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-center">Total</th>
                  <th className="px-4 py-3 text-center">Correct</th>
                  <th className="px-4 py-3 text-center">Incorrect</th>
                  <th className="px-4 py-3 text-center">Unattempted</th>
                  <th className="px-4 py-3 text-center">Marks Obtained</th>
                  <th className="px-4 py-3 text-center">Max Marks</th>
                </tr>
              </thead>
              <tbody>
                {breakdownRows.map((row, idx) => (
                  <tr
                    key={row.label}
                    className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
                  >
                    <td className="px-4 py-3 font-medium text-slate-700">
                      <span>{row.label}</span>
                      <span className="ml-2 text-xs text-slate-400 font-normal">({row.category})</span>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600">{row.total}</td>
                    <td className="px-4 py-3 text-center text-green-600 font-medium">{row.correct}</td>
                    <td className="px-4 py-3 text-center text-red-600 font-medium">{row.incorrect}</td>
                    <td className="px-4 py-3 text-center text-slate-400">{row.unattempted}</td>
                    <td className="px-4 py-3 text-center font-semibold text-slate-700">{row.marksObtained}</td>
                    <td className="px-4 py-3 text-center text-slate-500">{row.maxMarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ================================================================
            3. Question-by-Question Review
            ================================================================ */}
        <section>
          <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-indigo-600" />
            Question-by-Question Review
          </h2>

          {/* Filter Tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            {([
              { key: 'all' as FilterTab, label: 'All', color: 'bg-indigo-100 text-indigo-700 border-indigo-300', active: 'bg-indigo-600 text-white' },
              { key: 'correct' as FilterTab, label: 'Correct', color: 'bg-green-100 text-green-700 border-green-300', active: 'bg-green-600 text-white' },
              { key: 'incorrect' as FilterTab, label: 'Incorrect', color: 'bg-red-100 text-red-700 border-red-300', active: 'bg-red-600 text-white' },
              { key: 'unattempted' as FilterTab, label: 'Unattempted', color: 'bg-slate-100 text-slate-600 border-slate-300', active: 'bg-slate-600 text-white' },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                  activeFilter === tab.key ? tab.active : tab.color
                }`}
              >
                {tab.label} ({counts[tab.key]})
              </button>
            ))}
          </div>

          {/* Question Cards */}
          <div className="space-y-4">
            {filteredQuestions.length === 0 && (
              <p className="text-center text-slate-400 py-8">No questions in this category.</p>
            )}

            {filteredQuestions.map((qr) => {
              const isExpanded = expandedQuestions.has(qr.questionId);

              // Status badge
              let statusBadge: React.ReactNode;
              if (qr.isCorrect) {
                statusBadge = (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                    <CheckCircle className="w-3.5 h-3.5" /> Correct ✓
                  </span>
                );
              } else if (qr.isAttempted) {
                statusBadge = (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                    <XCircle className="w-3.5 h-3.5" /> Incorrect ✗
                  </span>
                );
              } else {
                statusBadge = (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">
                    <MinusCircle className="w-3.5 h-3.5" /> Unattempted
                  </span>
                );
              }

              // Type badge color
              const typeBadgeClass =
                qr.question.type === 'MCQ'
                  ? 'bg-blue-100 text-blue-700'
                  : qr.question.type === 'MSQ'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-emerald-100 text-emerald-700';

              // Marks badge
              const marksBadgeClass =
                qr.marksAwarded > 0
                  ? 'bg-green-100 text-green-700'
                  : qr.marksAwarded < 0
                    ? 'bg-red-100 text-red-700'
                    : 'bg-slate-100 text-slate-500';

              return (
                <div
                  key={qr.questionId}
                  className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
                >
                  {/* Collapsible header */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleQuestion(qr.questionId)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleQuestion(qr.questionId);
                      }
                    }}
                    className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50 transition-colors text-left cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-semibold text-slate-700">Q{qr.questionId}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${typeBadgeClass}`}>
                        {qr.question.type}
                      </span>
                      {statusBadge}
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${marksBadgeClass}`}>
                        {qr.marksAwarded > 0 ? '+' : ''}{qr.marksAwarded} marks
                      </span>
                      {qr.timeSpentSeconds !== undefined && qr.timeSpentSeconds > 0 && (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {Math.floor(qr.timeSpentSeconds / 60)}m {qr.timeSpentSeconds % 60}s
                        </span>
                      )}
                      {qr.question.subject && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {qr.question.subject}
                        </span>
                      )}
                      {qr.question.topic && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          {qr.question.topic}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleBookmark(qr.question);
                        }}
                        className={`p-1.5 rounded-lg border transition cursor-pointer ${
                          bookmarkedHashes.has(computeQuestionHash(qr.question))
                            ? 'bg-amber-50 text-amber-600 border-amber-300'
                            : 'bg-slate-50 text-slate-400 hover:text-slate-600 border-slate-200'
                        }`}
                        title={bookmarkedHashes.has(computeQuestionHash(qr.question)) ? 'Bookmarked' : 'Bookmark this question'}
                      >
                        <Bookmark
                          className="w-4 h-4"
                          fill={bookmarkedHashes.has(computeQuestionHash(qr.question)) ? 'currentColor' : 'none'}
                        />
                      </button>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4">
                      {/* Question Visuals: Image */}
                      {qr.question.imageUrl && (
                        <div className="max-w-md">
                          <QuestionImage src={qr.question.imageUrl} alt={`Question ${qr.question.id} Diagram`} />
                        </div>
                      )}

                      {/* Question text with LaTeX Math & Code syntax highlighting */}
                      <div className="text-slate-800 leading-relaxed font-medium">
                        <RichContent content={qr.question.question} />
                      </div>

                      {/* Options list (for MCQ / MSQ) */}
                      {qr.question.options && (
                        <div className="space-y-2">
                          {qr.question.options.map((opt, idx) => {
                            const letter = String.fromCharCode(65 + idx);
                            // Determine if this option was selected by user
                            const isSelected = qr.userResponse.selectedOptions?.includes(idx) ?? false;
                            // Determine if this option is part of the correct answer
                            let isCorrectOption = false;
                            if (qr.question.type === 'MCQ') {
                              isCorrectOption = idx === (qr.question.answer as number);
                            } else if (qr.question.type === 'MSQ') {
                              isCorrectOption = (qr.question.answer as number[]).includes(idx);
                            }

                            let optClass = 'bg-slate-50 text-slate-700 border-slate-200';
                            if (isCorrectOption) {
                              optClass = 'bg-emerald-50 text-emerald-900 border-emerald-300 font-medium';
                            }
                            if (isSelected && !qr.isCorrect) {
                              optClass = isCorrectOption
                                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                                : 'bg-red-50 text-red-900 border-red-300 font-medium';
                            }
                            if (isSelected && qr.isCorrect) {
                              optClass = 'bg-emerald-50 text-emerald-900 border-emerald-300 font-medium';
                            }

                            return (
                              <div
                                key={idx}
                                className={`flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border ${optClass}`}
                              >
                                <span className="font-bold shrink-0">{letter})</span>
                                <div className="flex-1">
                                  <RichContent content={opt} />
                                </div>
                                {isCorrectOption && (
                                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 ml-auto mt-0.5" />
                                )}
                                {isSelected && !isCorrectOption && (
                                  <XCircle className="w-4 h-4 text-red-500 shrink-0 ml-auto mt-0.5" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* NAT answer display */}
                      {qr.question.type === 'NAT' && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-500">Your Answer:</span>
                            <span
                              className={`font-semibold ${
                                qr.isCorrect ? 'text-green-600' : qr.isAttempted ? 'text-red-600' : 'text-slate-400'
                              }`}
                            >
                              {qr.userAnswer}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-500">Correct Answer:</span>
                            <span className="font-semibold text-green-600">{qr.correctAnswer}</span>
                          </div>
                        </div>
                      )}

                      {/* For MCQ/MSQ — user and correct answer summary (non-option view) */}
                      {qr.question.type !== 'NAT' && (
                        <div className="space-y-1 text-sm">
                          <p>
                            <span className="font-medium text-slate-500">Your Answer: </span>
                            <span
                              className={`font-semibold ${
                                qr.isCorrect ? 'text-green-600' : qr.isAttempted ? 'text-red-600' : 'text-slate-400'
                              }`}
                            >
                              {qr.userAnswer}
                            </span>
                          </p>
                          <p>
                            <span className="font-medium text-slate-500">Correct Answer: </span>
                            <span className="font-semibold text-green-600">{qr.correctAnswer}</span>
                          </p>
                        </div>
                      )}

                      {/* Solution / Explanation */}
                      {(qr.question.solution || qr.question.explanation || (qr.question as any).detailedSolution) && (
                        <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-4.5 space-y-2.5">
                          <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">Official Solution &amp; Explanation</p>
                          {qr.question.solutionImageUrl && (
                            <div className="max-w-md">
                              <QuestionImage src={qr.question.solutionImageUrl} alt="Solution Diagram" />
                            </div>
                          )}
                          <div className="text-sm text-slate-800 leading-relaxed">
                            <RichContent content={qr.question.solution || qr.question.explanation || (qr.question as any).detailedSolution || ''} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ================================================================
            4. Action Buttons
            ================================================================ */}
        <section className="flex flex-col sm:flex-row flex-wrap gap-2.5 sm:gap-4 justify-center pt-4 pb-8 print:hidden">
          <button
            onClick={() =>
              navigate('/test', {
                state: { testData: results.testData, mode: results.mode },
              })
            }
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-semibold shadow-xs text-xs sm:text-sm"
          >
            <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
            Retake Test
          </button>

          <button
            onClick={() => window.print()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-white text-slate-700 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors font-medium shadow-xs text-xs sm:text-sm"
          >
            <Printer className="w-4 h-4 sm:w-5 sm:h-5" />
            Print Report Card
          </button>

          <button
            onClick={() => navigate('/report-cards')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors font-semibold shadow-xs text-xs sm:text-sm"
          >
            <Award className="w-4 h-4 sm:w-5 sm:h-5" />
            My Report Cards
          </button>

          {isTeacherOrAdmin && (
            <>
              <button
                onClick={() => navigate('/question-bank')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-white text-slate-700 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors font-medium shadow-xs text-xs sm:text-sm"
              >
                <Database className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
                Question Bank
              </button>

              <button
                onClick={() => navigate('/custom-builder')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-white text-slate-700 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors font-medium shadow-xs text-xs sm:text-sm"
              >
                <Wrench className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
                Custom Test Builder
              </button>
            </>
          )}

          <button
            onClick={() => navigate('/')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-white text-slate-700 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors font-medium shadow-xs text-xs sm:text-sm"
          >
            <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            Upload Another Test
          </button>
        </section>
      </main>
    </div>
  );
}

// ---- Small reusable card component ----
function SummaryCard({
  icon,
  label,
  value,
  valueClass = 'text-slate-800',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center gap-4">
      <div className="shrink-0">{icon}</div>
      <div>
        <p className="text-sm text-slate-500 font-medium">{label}</p>
        <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
      </div>
    </div>
  );
}
