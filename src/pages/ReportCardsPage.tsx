import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Award,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Bookmark,
  AlertTriangle,
  BarChart3,
  Play,
  Flame,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import ReportCardTestReview from '../components/ReportCardTestReview';
import { useAuth } from '../context/AuthContext';
import {
  fetchReportCardsApi,
  fetchReportCardDetailApi,
  fetchMistakesApi,
  updateMistakeStatusApi,
  fetchBookmarksApi,
  toggleBookmarkApi,
  updateBookmarkNoteApi,
  fetchAnalyticsSummaryApi,
  computeQuestionHash,
  syncLocalReportCardsToCloud,
  clearPlatformDataApi,
} from '../utils/api';
import type {
  SavedReportCard,
  MistakeEntry,
  BookmarkItem,
  AnalyticsSummary,
  Question,
  TestData,
} from '../types';
import { formatDurationHuman } from '../utils/scoring';
import RichContent from '../components/RichContent';
import { QuestionImage } from '../components/ImageLightbox';

type TabView = 'history' | 'analytics' | 'mistakes' | 'bookmarks';
type FilterMode = 'ALL' | 'EXAM' | 'PRACTICE';
type SortOption = 'newest' | 'oldest' | 'highest_score' | 'highest_accuracy';
type MistakeFilter = 'ALL' | 'NEEDS_REVIEW' | 'MASTERED' | 'MOST_MISSED';

export default function ReportCardsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Navigation State
  const [activeTab, setActiveTab] = useState<TabView>('history');

  // Test History State
  const [reportCards, setReportCards] = useState<SavedReportCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMode, setSelectedMode] = useState<FilterMode>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // Detail View State
  const [selectedCard, setSelectedCard] = useState<SavedReportCard | null>(null);

  // Analytics State
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);

  // Mistakes State
  const [mistakes, setMistakes] = useState<MistakeEntry[]>([]);
  const [mistakeFilter, setMistakeFilter] = useState<MistakeFilter>('NEEDS_REVIEW');
  const [selectedMistakeSubject, setSelectedMistakeSubject] = useState<string>('ALL');
  const [expandedMistakes, setExpandedMistakes] = useState<Set<string>>(new Set());

  // Bookmarks State
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [selectedBookmarkSubject, setSelectedBookmarkSubject] = useState<string>('ALL');
  const [expandedBookmarks, setExpandedBookmarks] = useState<Set<string>>(new Set());
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>('');

  // Admin Action State
  const isMasterAdmin =
    user?.email?.toLowerCase().trim() === 'harshsaini0912@gmail.com' ||
    user?.email?.toLowerCase().trim() === 'harshsaini0912@gmail' ||
    user?.email?.toLowerCase().startsWith('harshsaini0912@');

  const [isClearing, setIsClearing] = useState(false);
  const handleClearReportCards = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to empty all report cards to zero? This will permanently wipe all test history, mistake entries, and analytics across all your devices.'
    );
    if (!confirmed) return;

    try {
      setIsClearing(true);
      await clearPlatformDataApi('report-cards');
      setReportCards([]);
      setMistakes([]);
      setBookmarks([]);
      setAnalytics({
        totalTests: 0,
        avgAccuracy: 0,
        avgScorePercent: 0,
        totalTimeSpentSeconds: 0,
        trends: [],
        subjectMastery: [],
        weakTopics: [],
      });
    } catch (err) {
      console.error('Failed to clear report cards:', err);
    } finally {
      setIsClearing(false);
    }
  };

  // Initial Data Fetch
  useEffect(() => {
    let mounted = true;
    setLoading(true);

    // If user is authenticated, sync any device-local tests up to cloud Neon DB
    const loadStudentData = async () => {
      try {
        if (user) {
          await syncLocalReportCardsToCloud().catch(() => {});
        }
        const [cards, mList, bList, aSummary] = await Promise.all([
          fetchReportCardsApi(),
          fetchMistakesApi(),
          fetchBookmarksApi(),
          fetchAnalyticsSummaryApi(),
        ]);
        if (mounted) {
          setReportCards(cards);
          setMistakes(mList);
          setBookmarks(bList);
          setAnalytics(aSummary);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading student data:', err);
        if (mounted) setLoading(false);
      }
    };

    loadStudentData();

    return () => {
      mounted = false;
    };
  }, [user]);

  // Handle open full report card detail
  const handleOpenDetail = async (rc: SavedReportCard) => {
    if (rc.detailedReviewJson && rc.detailedReviewJson.length > 0) {
      setSelectedCard(rc);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      try {
        const fullDetail = await fetchReportCardDetailApi(rc.id);
        setSelectedCard(fullDetail || rc);
      } catch {
        setSelectedCard(rc);
      } finally {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const toggleMistakeExpand = (id: string) => {
    setExpandedMistakes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleBookmarkExpand = (id: string) => {
    setExpandedBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Toggle Mistake Status (Needs Review <-> Mastered)
  const handleToggleMistakeStatus = async (m: MistakeEntry) => {
    const newStatus = m.status === 'MASTERED' ? 'NEEDS_REVIEW' : 'MASTERED';
    setMistakes((prev) =>
      prev.map((item) => (item.id === m.id ? { ...item, status: newStatus } : item))
    );
    await updateMistakeStatusApi(m.id, newStatus);
  };

  // Retest Mistakes
  const handleRetestMistakes = (mistakesToTest: MistakeEntry[]) => {
    if (mistakesToTest.length === 0) return;
    const questions: Question[] = mistakesToTest.map((m, idx) => ({
      ...m.questionSnapshotJson,
      id: idx + 1,
    }));

    const testData: TestData = {
      title: `Mistake Retest (${questions.length} Questions)`,
      subject: mistakesToTest[0]?.subject || 'Mistake Retest',
      topic: 'Adaptive Revision',
      duration: Math.max(600, questions.length * 162), // ~2.7 min per question proportional GATE timing
      questions,
    };

    navigate('/test', { state: { testData, mode: 'EXAM' } });
  };

  // Retest Full Test from Report Card
  const handleRetestFullTest = async (rc: SavedReportCard) => {
    let questions: Question[] = [];

    if (rc.detailedReviewJson && rc.detailedReviewJson.length > 0) {
      questions = rc.detailedReviewJson
        .map((qr, idx) => ({
          ...qr.question,
          id: idx + 1,
        }))
        .filter((q) => q && q.question);
    }

    if (questions.length === 0) {
      try {
        const fullDetail = await fetchReportCardDetailApi(rc.id);
        if (fullDetail?.detailedReviewJson && fullDetail.detailedReviewJson.length > 0) {
          questions = fullDetail.detailedReviewJson
            .map((qr, idx) => ({
              ...qr.question,
              id: idx + 1,
            }))
            .filter((q) => q && q.question);
        }
      } catch {
        // ignore
      }
    }

    if (questions.length === 0) {
      alert('Could not retrieve questions for this test attempt.');
      return;
    }

    const testData: TestData = {
      title: rc.testTitle,
      subject: questions[0]?.subject || 'GATE Test',
      topic: questions[0]?.topic || 'Retest',
      duration: rc.allocatedSeconds || Math.max(600, questions.length * 162),
      questions,
    };

    navigate('/test', { state: { testData, mode: rc.mode || 'EXAM' } });
  };

  // Practice Bookmarks
  const handlePracticeBookmarks = (bookmarksToTest: BookmarkItem[]) => {
    if (bookmarksToTest.length === 0) return;
    const questions: Question[] = bookmarksToTest.map((b, idx) => ({
      ...b.questionSnapshotJson,
      id: idx + 1,
    }));

    const testData: TestData = {
      title: `Bookmarked Questions Practice (${questions.length} Qs)`,
      subject: bookmarksToTest[0]?.subject || 'Bookmarks',
      topic: 'Saved Review',
      duration: Math.max(600, questions.length * 162),
      questions,
    };

    navigate('/test', { state: { testData, mode: 'PRACTICE' } });
  };

  // Practice a specific topic
  const handlePracticeTopic = (subjectName: string, topicName: string) => {
    // Gather matching questions from past reviews or mistakes
    const matchingQuestions: Question[] = [];
    const seenHashes = new Set<string>();

    reportCards.forEach((rc) => {
      (rc.detailedReviewJson || []).forEach((qr) => {
        const q = qr.question;
        if (q && q.subject === subjectName && q.topic === topicName) {
          const hash = computeQuestionHash(q);
          if (!seenHashes.has(hash)) {
            seenHashes.add(hash);
            matchingQuestions.push({ ...q, id: matchingQuestions.length + 1 });
          }
        }
      });
    });

    if (matchingQuestions.length === 0) {
      alert(`No saved questions found in local bank for "${topicName}". Try custom test builder or question bank!`);
      return;
    }

    const testData: TestData = {
      title: `Targeted Practice: ${topicName}`,
      subject: subjectName,
      topic: topicName,
      duration: Math.max(600, matchingQuestions.length * 162),
      questions: matchingQuestions,
    };

    navigate('/test', { state: { testData, mode: 'PRACTICE' } });
  };

  // Deduplicate identical submissions within 2 minutes
  const uniqueReportCards = useMemo(() => {
    const deduped: SavedReportCard[] = [];
    for (const item of reportCards) {
      const isDupe = deduped.some((d) => {
        if (d.testTitle !== item.testTitle) return false;
        if (d.mode !== item.mode) return false;
        if (Math.abs(d.score - item.score) > 0.01) return false;
        const diff = Math.abs(new Date(d.submittedAt).getTime() - new Date(item.submittedAt).getTime());
        return diff < 120000;
      });
      if (!isDupe) deduped.push(item);
    }
    return deduped;
  }, [reportCards]);

  // Filtered and sorted report cards
  const filteredReportCards = useMemo(() => {
    let list = [...uniqueReportCards];

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

  // Filtered Mistakes
  const filteredMistakes = useMemo(() => {
    return mistakes.filter((m) => {
      if (mistakeFilter === 'NEEDS_REVIEW' && m.status !== 'NEEDS_REVIEW') return false;
      if (mistakeFilter === 'MASTERED' && m.status !== 'MASTERED') return false;
      if (mistakeFilter === 'MOST_MISSED' && m.wrongCount < 2) return false;
      if (selectedMistakeSubject !== 'ALL' && m.subject !== selectedMistakeSubject) return false;
      return true;
    });
  }, [mistakes, mistakeFilter, selectedMistakeSubject]);

  const mistakeSubjects = useMemo(() => {
    const set = new Set<string>();
    mistakes.forEach((m) => {
      if (m.subject) set.add(m.subject);
    });
    return Array.from(set);
  }, [mistakes]);

  // Filtered Bookmarks
  const filteredBookmarks = useMemo(() => {
    return bookmarks.filter((b) => {
      if (selectedBookmarkSubject !== 'ALL' && b.subject !== selectedBookmarkSubject) return false;
      return true;
    });
  }, [bookmarks, selectedBookmarkSubject]);

  const bookmarkSubjects = useMemo(() => {
    const set = new Set<string>();
    bookmarks.forEach((b) => {
      if (b.subject) set.add(b.subject);
    });
    return Array.from(set);
  }, [bookmarks]);

  if (selectedCard) {
    return (
      <ReportCardTestReview
        reportCard={selectedCard}
        user={user}
        onBack={() => setSelectedCard(null)}
        onRetest={handleRetestFullTest}
        bookmarks={bookmarks}
        onToggleBookmark={async (question) => {
          try {
            const res = await toggleBookmarkApi(question);
            if (res.bookmarked && res.item) {
              setBookmarks((prev) => [res.item!, ...prev]);
            } else {
              const qHash = computeQuestionHash(question);
              setBookmarks((prev) => prev.filter((b) => b.questionHash !== qHash));
            }
          } catch (err) {
            console.error('Failed to toggle bookmark:', err);
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      {/* ─────────────────────────────────────────────────────────────
          SIGNED OUT ZERO STATE
          ───────────────────────────────────────────────────────────── */}
      {!user && reportCards.length === 0 ? (
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
                  <h4 className="text-xs font-bold text-slate-800">Smart Weakness Analytics</h4>
                  <p className="text-[11px] text-slate-500">Auto-identifies weak topics and tracks score progression.</p>
                </div>
              </div>
            </div>
          </div>
        </main>
      ) : (
        /* ─────────────────────────────────────────────────────────────
            SIGNED IN MAIN VIEW: 4 Tabs Suite
            ───────────────────────────────────────────────────────────── */
        <main className="flex-1 max-w-6xl mx-auto px-4 py-8 w-full space-y-8">
          {/* Welcome Header */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-2">
                  <Award className="w-3.5 h-3.5 text-indigo-400" />
                  Official Student Portal
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  {user ? `Welcome back, ${user.name}` : 'Student Revision & Analytics'}
                </h1>
                <p className="text-slate-300 text-xs sm:text-sm mt-1">
                  Track your tests, revise past mistakes with one-click retests, and target your weak topics.
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {isMasterAdmin && (
                  <button
                    onClick={handleClearReportCards}
                    disabled={isClearing || (reportCards.length === 0 && mistakes.length === 0)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 hover:text-rose-200 text-xs font-semibold border border-rose-500/30 transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title="Empty all test history and report cards (harshsaini0912@gmail only)"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>{isClearing ? 'Clearing...' : 'Clear History'}</span>
                  </button>
                )}
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

          {/* Tab Navigation Bar */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'history'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              <Trophy className="w-4 h-4" />
              <span>Test History ({uniqueReportCards.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'analytics'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Weakness & Analytics</span>
            </button>

            <button
              onClick={() => setActiveTab('mistakes')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'mistakes'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              <Flame className="w-4 h-4 text-amber-400" />
              <span>Mistake Notebook ({mistakes.filter((m) => m.status === 'NEEDS_REVIEW').length})</span>
            </button>

            <button
              onClick={() => setActiveTab('bookmarks')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'bookmarks'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              <Bookmark className="w-4 h-4" />
              <span>Bookmarks ({bookmarks.length})</span>
            </button>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              TAB 1: TEST HISTORY
              ───────────────────────────────────────────────────────────── */}
          {activeTab === 'history' && (
            <div className="space-y-6">
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

              {/* Search & List */}
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
                    <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
                      {(['ALL', 'EXAM', 'PRACTICE'] as FilterMode[]).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setSelectedMode(mode)}
                          className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                            selectedMode === mode
                              ? 'bg-white text-indigo-700 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>

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

                {loading ? (
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
                      const avgQTime =
                        rc.totalQuestions > 0 ? Math.round(rc.timeTakenSeconds / rc.totalQuestions) : 0;

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
                              {avgQTime > 0 && (
                                <>
                                  <span className="text-slate-300">•</span>
                                  <span className="text-xs text-blue-600 font-medium">
                                    ⏱ ~{Math.floor(avgQTime / 60)}m {avgQTime % 60}s / Q
                                  </span>
                                </>
                              )}
                            </div>

                            <h3 className="text-base font-bold text-slate-900 truncate">
                              {rc.testTitle}
                            </h3>

                            <div className="flex items-center gap-3 text-xs font-medium pt-1">
                              <span className="text-emerald-700 font-bold">{rc.correctCount} Correct</span>
                              <span className="text-slate-300">/</span>
                              <span className="text-red-600 font-bold">{rc.incorrectCount} Incorrect</span>
                              <span className="text-slate-300">/</span>
                              <span className="text-slate-500">{rc.unattemptedCount} Unattempted</span>
                            </div>
                          </div>

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

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleOpenDetail(rc)}
                                className="px-3.5 py-2 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                              >
                                View Report & Solutions →
                              </button>

                              <button
                                onClick={() => handleRetestFullTest(rc)}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Retest</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB 2: WEAKNESS & ANALYTICS
              ───────────────────────────────────────────────────────────── */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              {/* Trend Chart Section */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-indigo-600" />
                      Score & Accuracy Progression Trend
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Track your performance improvement across consecutive test attempts.
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-semibold">
                    <span className="flex items-center gap-1.5 text-indigo-600">
                      <span className="w-3 h-3 rounded-full bg-indigo-600" /> Score %
                    </span>
                    <span className="flex items-center gap-1.5 text-emerald-600">
                      <span className="w-3 h-3 rounded-full bg-emerald-500" /> Accuracy %
                    </span>
                  </div>
                </div>

                {analytics && analytics.trends.length > 0 ? (
                  <div className="mt-4">
                    <div className="h-48 w-full relative flex items-end gap-3 pt-6 pb-2 border-b border-slate-200">
                      {analytics.trends.map((pt, idx) => {
                        const scoreHeight = Math.max(8, Math.min(100, pt.scorePercent));
                        const accHeight = Math.max(8, Math.min(100, pt.accuracy));
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                            {/* Hover Tooltip */}
                            <div className="absolute -top-12 bg-slate-900 text-white text-[10px] rounded-lg p-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-20 shadow-lg">
                              <p className="font-bold">{pt.testTitle}</p>
                              <p>Score: {pt.scorePercent}% • Acc: {pt.accuracy}%</p>
                            </div>

                            <div className="w-full flex items-end justify-center gap-1 h-full">
                              <div
                                style={{ height: `${scoreHeight}%` }}
                                className="w-3 sm:w-5 bg-indigo-600 rounded-t-md transition-all group-hover:bg-indigo-500"
                              />
                              <div
                                style={{ height: `${accHeight}%` }}
                                className="w-3 sm:w-5 bg-emerald-500 rounded-t-md transition-all group-hover:bg-emerald-400"
                              />
                            </div>
                            <span className="text-[10px] text-slate-400 mt-2 truncate w-full text-center">
                              {pt.date}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center text-xs text-slate-400">
                    Complete at least one test to visualize your score progression.
                  </div>
                )}
              </div>

              {/* Priority Revision Topics Callout */}
              {analytics && analytics.weakTopics.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 text-amber-900 space-y-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    <h3 className="font-bold text-sm sm:text-base">
                      Priority Revision Required ({analytics.weakTopics.length} Weak Topics &lt; 50% Accuracy)
                    </h3>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Based on your test attempts, you are dropping marks frequently in these topics. Launch a targeted practice session right now to build mastery:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {analytics.weakTopics.map((wt, i) => (
                      <div
                        key={i}
                        className="p-3.5 bg-white rounded-2xl border border-amber-200 shadow-xs flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block truncate">
                            {wt.subject}
                          </span>
                          <h4 className="text-xs font-bold text-slate-900 truncate">{wt.topic}</h4>
                          <span className="text-[11px] font-bold text-red-600">
                            {wt.accuracy}% Accuracy ({wt.correct}/{wt.attempted} correct)
                          </span>
                        </div>
                        <button
                          onClick={() => handlePracticeTopic(wt.subject, wt.topic)}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition shrink-0 flex items-center gap-1 cursor-pointer"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          Practice
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Subject & Topic Mastery Table */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Target className="w-5 h-5 text-indigo-600" />
                  Subject & Topic Mastery Breakdown
                </h2>

                {analytics && analytics.subjectMastery.length > 0 ? (
                  <div className="space-y-4">
                    {analytics.subjectMastery.map((sub) => (
                      <div key={sub.subject} className="border border-slate-200 rounded-2xl overflow-hidden">
                        <div className="bg-slate-50 p-4 flex items-center justify-between flex-wrap gap-3 border-b border-slate-200">
                          <div>
                            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Subject</span>
                            <h3 className="text-base font-bold text-slate-900">{sub.subject}</h3>
                          </div>
                          <div className="flex items-center gap-3">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-bold ${
                                sub.status === 'STRONG'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : sub.status === 'MODERATE'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {sub.status}: {sub.accuracy}% Accuracy
                            </span>
                          </div>
                        </div>

                        <div className="divide-y divide-slate-100">
                          {sub.topics.map((top) => (
                            <div
                              key={top.topic}
                              className="p-3.5 sm:px-5 flex items-center justify-between flex-wrap gap-3 hover:bg-slate-50/50"
                            >
                              <div className="min-w-0 flex-1">
                                <h4 className="text-xs font-bold text-slate-800">{top.topic}</h4>
                                <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                                  <span>{top.attempted} attempted</span>
                                  <span>•</span>
                                  <span className="text-emerald-700 font-semibold">{top.correct} correct</span>
                                  <span>•</span>
                                  <span className="text-red-600 font-semibold">{top.incorrect} wrong</span>
                                  {top.avgTimeSeconds > 0 && (
                                    <>
                                      <span>•</span>
                                      <span className="text-blue-600 font-medium">⏱ ~{top.avgTimeSeconds}s / Q</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <span
                                  className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                                    top.status === 'STRONG'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : top.status === 'MODERATE'
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                      : 'bg-red-50 text-red-700 border border-red-200'
                                  }`}
                                >
                                  {top.accuracy}%
                                </span>
                                <button
                                  onClick={() => handlePracticeTopic(sub.subject, top.topic)}
                                  className="px-3 py-1 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                >
                                  <Play className="w-3 h-3 fill-current" />
                                  Practice
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 text-center py-8">
                    Take tests to see subject & topic mastery analysis.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB 3: MISTAKE NOTEBOOK
              ───────────────────────────────────────────────────────────── */}
          {activeTab === 'mistakes' && (
            <div className="space-y-6">
              {/* Action & Filter Header */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Flame className="w-5 h-5 text-amber-500" />
                    Automatic Mistake Notebook
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Questions answered incorrectly in tests are captured here. Retest and master them to cement your concepts.
                  </p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                  <button
                    onClick={() => handleRetestMistakes(filteredMistakes.filter((m) => m.status === 'NEEDS_REVIEW'))}
                    disabled={filteredMistakes.filter((m) => m.status === 'NEEDS_REVIEW').length === 0}
                    className="w-full md:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-md cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Retest My Mistakes ({filteredMistakes.filter((m) => m.status === 'NEEDS_REVIEW').length})</span>
                  </button>
                </div>
              </div>

              {/* Filters row */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2 flex-wrap">
                  {(['ALL', 'NEEDS_REVIEW', 'MASTERED', 'MOST_MISSED'] as MistakeFilter[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setMistakeFilter(f)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        mistakeFilter === f
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {f === 'ALL'
                        ? 'All Mistakes'
                        : f === 'NEEDS_REVIEW'
                        ? 'Needs Review'
                        : f === 'MASTERED'
                        ? 'Mastered'
                        : 'Most Missed (2+)'}
                    </button>
                  ))}
                </div>

                {mistakeSubjects.length > 0 && (
                  <select
                    value={selectedMistakeSubject}
                    onChange={(e) => setSelectedMistakeSubject(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium rounded-xl px-3 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="ALL">All Subjects</option>
                    {mistakeSubjects.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Mistakes List */}
              {filteredMistakes.length === 0 ? (
                <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-white p-6">
                  <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-slate-800">No mistakes in this filter!</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    {mistakeFilter === 'NEEDS_REVIEW'
                      ? 'Awesome work! You have no pending mistakes needing review.'
                      : 'No questions match the current filter.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredMistakes.map((m) => {
                    const isExpanded = expandedMistakes.has(m.id);
                    const q = m.questionSnapshotJson;

                    return (
                      <div
                        key={m.id}
                        className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
                      >
                        <div className="p-4 sm:p-5 flex items-start justify-between gap-4">
                          <div className="space-y-2 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  m.status === 'MASTERED'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-red-100 text-red-800 border border-red-200'
                                }`}
                              >
                                {m.status === 'MASTERED' ? '✓ Mastered' : 'Needs Review'}
                              </span>

                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                                <RotateCcw className="w-3 h-3" />
                                Missed {m.wrongCount} time{m.wrongCount > 1 ? 's' : ''}
                              </span>

                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                {m.subject}
                              </span>

                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                                {m.topic}
                              </span>
                            </div>

                            <div className="text-sm font-medium text-slate-800 leading-relaxed pt-1">
                              <RichContent content={q.question} />
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleToggleMistakeStatus(m)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                m.status === 'MASTERED'
                                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              }`}
                            >
                              {m.status === 'MASTERED' ? 'Mark Needs Review' : '✓ Mark Mastered'}
                            </button>

                            <button
                              onClick={() => toggleMistakeExpand(m.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {/* Collapsible Solution Box */}
                        {isExpanded && (
                          <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 space-y-4">
                            {/* Visuals */}
                            {q.imageUrl && (
                              <div className="max-w-md">
                                <QuestionImage src={q.imageUrl} alt="Diagram" />
                              </div>
                            )}

                            {q.options && q.options.length > 0 && (
                              <div className="space-y-1.5">
                                <span className="text-xs font-bold text-slate-500 block">Options:</span>
                                {q.options.map((opt, idx) => (
                                  <div
                                    key={idx}
                                    className="p-2 rounded-lg bg-white border border-slate-200 text-xs flex items-start gap-2"
                                  >
                                    <span className="font-bold">{String.fromCharCode(65 + idx)}.</span>
                                    <RichContent content={opt} />
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100 space-y-1.5 text-xs text-indigo-950">
                              <span className="font-bold text-indigo-900 block">Official Solution:</span>
                              <RichContent content={q.solution || 'No detailed solution stored.'} />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB 4: BOOKMARKS
              ───────────────────────────────────────────────────────────── */}
          {activeTab === 'bookmarks' && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Bookmark className="w-5 h-5 text-indigo-600" />
                    Bookmarked Revision Bank
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Questions you pinned for quick revision from test reviews or the question bank.
                  </p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                  <button
                    onClick={() => handlePracticeBookmarks(filteredBookmarks)}
                    disabled={filteredBookmarks.length === 0}
                    className="w-full md:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-md cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Practice Bookmarked Questions ({filteredBookmarks.length})</span>
                  </button>
                </div>
              </div>

              {bookmarkSubjects.length > 0 && (
                <div className="flex items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-700">Filter by Subject:</span>
                  <select
                    value={selectedBookmarkSubject}
                    onChange={(e) => setSelectedBookmarkSubject(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium rounded-xl px-3 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="ALL">All Subjects</option>
                    {bookmarkSubjects.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              )}

              {bookmarks.length === 0 ? (
                <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-white p-6">
                  <Bookmark className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-slate-800">No bookmarked questions yet</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                    Click the bookmark icon on any question in the Question Bank or after completing a test to save it here for fast revision.
                  </p>
                  <Link
                    to="/question-bank"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition"
                  >
                    Browse Question Bank
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredBookmarks.map((b) => {
                    const isExpanded = expandedBookmarks.has(b.id);
                    const q = b.questionSnapshotJson;

                    return (
                      <div
                        key={b.id}
                        className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
                      >
                        <div className="p-4 sm:p-5 flex items-start justify-between gap-4">
                          <div className="space-y-2 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                {b.subject}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                                {b.topic}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                Saved {new Date(b.createdAt).toLocaleDateString()}
                              </span>
                            </div>

                            <div className="text-sm font-medium text-slate-800 leading-relaxed pt-1">
                              <RichContent content={q.question} />
                            </div>

                            {/* Note snippet or editor */}
                            {editingNoteId === b.id ? (
                              <div className="flex items-center gap-2 mt-2">
                                <input
                                  type="text"
                                  value={noteDraft}
                                  onChange={(e) => setNoteDraft(e.target.value)}
                                  placeholder="Add a short personal note..."
                                  className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg flex-1"
                                />
                                <button
                                  onClick={async () => {
                                    await updateBookmarkNoteApi(b.id, noteDraft);
                                    setBookmarks((prev) =>
                                      prev.map((item) => (item.id === b.id ? { ...item, note: noteDraft } : item))
                                    );
                                    setEditingNoteId(null);
                                  }}
                                  className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg cursor-pointer"
                                >
                                  Save Note
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-xs text-slate-600 mt-2">
                                <span className="italic">
                                  {b.note ? `Note: "${b.note}"` : 'No note attached.'}
                                </span>
                                <button
                                  onClick={() => {
                                    setEditingNoteId(b.id);
                                    setNoteDraft(b.note || '');
                                  }}
                                  className="text-indigo-600 hover:underline text-[11px] font-bold cursor-pointer"
                                >
                                  {b.note ? 'Edit Note' : '+ Add Note'}
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={async () => {
                                await toggleBookmarkApi(q);
                                setBookmarks((prev) => prev.filter((item) => item.id !== b.id));
                              }}
                              className="p-1.5 rounded-lg text-amber-600 hover:text-red-600 hover:bg-slate-100 transition cursor-pointer"
                              title="Remove Bookmark"
                            >
                              <Bookmark className="w-4 h-4 fill-current" />
                            </button>

                            <button
                              onClick={() => toggleBookmarkExpand(b.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {/* Collapsible Solution */}
                        {isExpanded && (
                          <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 space-y-3 text-xs">
                            {q.options && (
                              <div className="space-y-1">
                                <span className="font-bold text-slate-500">Options:</span>
                                {q.options.map((opt, idx) => (
                                  <div key={idx} className="p-2 bg-white rounded border border-slate-200">
                                    <span className="font-bold mr-1">{String.fromCharCode(65 + idx)}.</span>
                                    <RichContent content={opt} />
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-950 space-y-1">
                              <span className="font-bold text-indigo-900 block">Solution:</span>
                              <RichContent content={q.solution || 'No detailed solution stored.'} />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      )}
    </div>
  );
}
