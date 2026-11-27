import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Clock,
  ChevronLeft,
  Flag,
  Save,
  Send,
  X,
  Menu,
  RotateCcw,
  Calculator,
  Ban,
  ShieldAlert,
  ShieldCheck,
  Maximize2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

import GateCalculator from '../components/GateCalculator';
import RichContent from '../components/RichContent';
import { QuestionImage } from '../components/ImageLightbox';

import type {
  TestData,
  TestMode,
  UserResponse,
  QuestionStatus,
  Question,
} from '../types';
import { useTimer } from '../hooks/useTimer';
import {
  formatTime,
  gradeQuestion,
  gradeTest,
  calculateDuration,
  getNegativeMarkingDisplay,
} from '../utils/scoring';
import { saveTestState, loadTestState, clearTestState } from '../utils/storage';
import { saveReportCardApi } from '../utils/api';

// ───────────────────── helpers ─────────────────────

function initResponses(questions: Question[]): UserResponse[] {
  return questions.map((q) => ({
    questionId: q.id,
    selectedOptions: undefined,
    natInput: undefined,
    status: 'not-visited' as QuestionStatus,
  }));
}

const typeBadgeColors: Record<string, string> = {
  MCQ: 'bg-blue-100 text-blue-800',
  MSQ: 'bg-purple-100 text-purple-800',
  NAT: 'bg-green-100 text-green-800',
};

// ───────────────────── Component ─────────────────────

export default function TestPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, targetExam } = useAuth();

  const savedOnMount = useMemo(() => loadTestState(), []);
  const stateData = (location.state ?? {}) as {
    testData?: TestData;
    mode?: TestMode;
  };

  const rawTestData = stateData.testData || (savedOnMount && !savedOnMount.isSubmitted ? savedOnMount.testData : undefined);
  const testData = useMemo(() => {
    if (!rawTestData) return undefined;
    return {
      ...rawTestData,
      questions: rawTestData.questions.map((q, idx) => {
        const sol = (q.solution || (q as any).explanation || (q as any).detailedSolution || (q as any).solutionText || (q as any).rationale || '').toString().trim();
        const qText = (q.question || (q as any).questionText || (q as any).text || (q as any).statement || '').toString().trim();
        return {
          ...q,
          id: q.id !== undefined ? q.id : idx + 1,
          question: qText || q.question,
          solution: sol,
          explanation: sol,
        };
      }),
    };
  }, [rawTestData]);
  const mode = stateData.mode || (savedOnMount && !savedOnMount.isSubmitted ? savedOnMount.mode : 'exam');

  // ─── guard: no data ───
  if (!testData) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-lg text-slate-500">
          No test data found.{' '}
          <button
            className="text-indigo-600 underline font-semibold hover:text-indigo-800"
            onClick={() => navigate('/')}
          >
            Go Home
          </button>
        </p>
      </div>
    );
  }

  // ─── guard: enrolled track isolation for students ───
  if (user?.role === 'STUDENT' && testData?.examCategory && targetExam && testData.examCategory !== targetExam) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-slate-900 text-white text-center">
        <div className="max-w-md w-full bg-slate-800 p-8 rounded-3xl border border-slate-700 space-y-5 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-red-500/20 text-red-400 mx-auto flex items-center justify-center">
            <Ban className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold">Track Access Restricted</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Your student account is enrolled in the{' '}
              <strong className="text-white font-bold">{targetExam === 'JEE_MAINS' ? 'JEE Mains' : 'GATE'}</strong> track.
              You cannot access or attempt {testData.examCategory === 'JEE_MAINS' ? 'JEE Mains' : 'GATE'} mock papers.
            </p>
          </div>
          <button
            onClick={() => navigate('/test-series')}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
          >
            Return to My {targetExam === 'JEE_MAINS' ? 'JEE Mains' : 'GATE'} Test Series
          </button>
        </div>
      </div>
    );
  }

  // ─── state initialisation ───
  const configuredDurationMinutes = Number(testData.duration || (testData as any).durationMinutes);
  const totalDuration = configuredDurationMinutes > 0
    ? Math.round(configuredDurationMinutes * 60)
    : calculateDuration(testData.questions.length);

  const [responses, setResponses] = useState<UserResponse[]>(() => {
    if (
      savedOnMount &&
      !savedOnMount.isSubmitted &&
      savedOnMount.testData.title === testData.title
    ) {
      return savedOnMount.responses;
    }
    return initResponses(testData.questions);
  });

  const [currentIdx, setCurrentIdx] = useState(() => {
    if (
      savedOnMount &&
      !savedOnMount.isSubmitted &&
      savedOnMount.testData.title === testData.title
    ) {
      return savedOnMount.currentQuestionIndex;
    }
    return 0;
  });

  const [initialRemaining] = useState(() => {
    if (
      savedOnMount &&
      !savedOnMount.isSubmitted &&
      savedOnMount.testData.title === testData.title
    ) {
      return savedOnMount.remainingSeconds;
    }
    return totalDuration;
  });

  const [startTime] = useState(() => {
    if (
      savedOnMount &&
      !savedOnMount.isSubmitted &&
      savedOnMount.testData.title === testData.title
    ) {
      return savedOnMount.startTime;
    }
    return Date.now();
  });

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);

  // ─── proctoring & full-screen security state ───
  const [isFullscreen, setIsFullscreen] = useState(() => {
    const doc = typeof document !== 'undefined' ? (document as any) : null;
    return !!(doc?.fullscreenElement || doc?.webkitFullscreenElement || doc?.mozFullScreenElement || doc?.msFullscreenElement);
  });
  const [showFullscreenModal, setShowFullscreenModal] = useState(mode === 'exam');
  const [strikeCount, setStrikeCount] = useState(0);
  const strikeCountRef = useRef(0);
  strikeCountRef.current = strikeCount;
  const [showStrike1Modal, setShowStrike1Modal] = useState(false);

  // Fullscreen helper
  const requestFullscreen = useCallback(() => {
    try {
      const elem = document.documentElement as any;
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {});
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
      }
    } catch {
      // Ignore fullscreen request rejection
    }
  }, []);

  // Monitor fullscreen changes
  useEffect(() => {
    const checkFs = () => {
      const doc = document as any;
      const isFs = !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement);
      setIsFullscreen(isFs);
      if (mode === 'exam' && !isSubmittedRef.current && !isFs) {
        setShowFullscreenModal(true);
      } else if (isFs) {
        setShowFullscreenModal(false);
      }
    };

    document.addEventListener('fullscreenchange', checkFs);
    document.addEventListener('webkitfullscreenchange', checkFs);
    return () => {
      document.removeEventListener('fullscreenchange', checkFs);
      document.removeEventListener('webkitfullscreenchange', checkFs);
    };
  }, [mode]);

  // Section groups (General Aptitude vs Core Subject)
  const sections = useMemo(() => {
    const hasExplicitSections = testData.questions.some(
      (q) => q.section || q.subject?.toLowerCase().includes('general aptitude')
    );
    if (!hasExplicitSections) return [];

    const map = new Map<string, { id: string; name: string; count: number; firstIndex: number }>();
    testData.questions.forEach((q, idx) => {
      const isGA = q.section === 'GA' || q.subject?.toLowerCase().includes('general aptitude');
      const secId = isGA ? 'GA' : 'SUBJECT';
      const secName = isGA ? 'Section 1: General Aptitude' : `Section 2: ${testData.subject || 'Core Subject'}`;
      if (!map.has(secId)) {
        map.set(secId, { id: secId, name: secName, count: 0, firstIndex: idx });
      }
      map.get(secId)!.count++;
    });
    return Array.from(map.values());
  }, [testData]);

  // ─── per-question time tracking state ───
  // Map of questionId -> accumulated seconds spent
  const [timeSpentMap, setTimeSpentMap] = useState<Record<number, number>>({});
  const lastActiveTimestampRef = useRef<number>(Date.now());
  const activeQuestionIdRef = useRef<number>(testData.questions[currentIdx]?.id);
  activeQuestionIdRef.current = testData.questions[currentIdx]?.id;

  // Flush active seconds on question change or interval
  const flushCurrentQuestionTime = useCallback(() => {
    const qId = activeQuestionIdRef.current;
    if (!qId || isSubmittedRef.current) return;
    const now = Date.now();
    const elapsedSec = Math.max(0, Math.round((now - lastActiveTimestampRef.current) / 1000));
    lastActiveTimestampRef.current = now;
    if (elapsedSec > 0) {
      setTimeSpentMap((prev) => ({
        ...prev,
        [qId]: (prev[qId] || 0) + elapsedSec,
      }));
    }
  }, []);

  // Update time tracker whenever active question changes
  useEffect(() => {
    flushCurrentQuestionTime();
    lastActiveTimestampRef.current = Date.now();
  }, [currentIdx, flushCurrentQuestionTime]);

  // Periodic heartbeat timer (every 1s) to record active seconds smoothly
  useEffect(() => {
    if (isSubmitted) return;
    const interval = setInterval(() => {
      flushCurrentQuestionTime();
    }, 1000);
    return () => clearInterval(interval);
  }, [isSubmitted, flushCurrentQuestionTime]);

  // Practice-mode feedback
  const [practiceResult, setPracticeResult] = useState<{
    isCorrect: boolean;
    marks: number;
    solution: string;
  } | null>(null);

  // Refs to avoid stale state in timer callbacks
  const responsesRef = useRef(responses);
  responsesRef.current = responses;
  const isSubmittedRef = useRef(isSubmitted);
  isSubmittedRef.current = isSubmitted;

  // ─── submit function ───
  const submitTest = useCallback((autoReason?: string) => {
    if (isSubmittedRef.current) return;
    flushCurrentQuestionTime();
    setIsSubmitted(true);
    isSubmittedRef.current = true;
    clearTestState();
    const timeTaken = totalDuration - remainingSecondsRef.current;
    
    // Compute current accumulated times
    const currentQId = activeQuestionIdRef.current;
    const finalElapsed = Math.max(0, Math.round((Date.now() - lastActiveTimestampRef.current) / 1000));
    const finalMap = { ...timeSpentMap };
    if (currentQId && finalElapsed > 0) {
      finalMap[currentQId] = (finalMap[currentQId] || 0) + finalElapsed;
    }

    const results = gradeTest(testData, responsesRef.current, mode, timeTaken, finalMap);
    (results as any).allocatedSeconds = totalDuration;
    if (autoReason) {
      (results as any).autoSubmittedReason = autoReason;
      (results as any).strikes = autoReason === 'SECURITY_STRIKE_LIMIT_EXCEEDED' ? 2 : 0;
    }
    // Guarantee instant background save so the report card exists immediately
    saveReportCardApi(results).catch(() => {});
    navigate('/report', { state: { results } });
  }, [totalDuration, testData, mode, navigate, flushCurrentQuestionTime, timeSpentMap]);

  // ─── timer ───
  const handleExpire = useCallback(() => {
    submitTest('TIME_EXPIRED');
  }, [submitTest]);

  // ─── back button navigation trap (prevent leaving exam) ───
  useEffect(() => {
    if (mode !== 'exam' || isSubmitted) return;
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
      alert("Browser navigation is locked during the CBT exam. Please use the 'Submit Test' button when finished.");
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [mode, isSubmitted]);

  // ─── accidental tab close / reload protection ───
  useEffect(() => {
    if (isSubmitted) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isSubmitted]);

  // ─── strict app-switch / tab-switch strike engine ───
  useEffect(() => {
    if (mode !== 'exam' || isSubmitted) return;
    let lastViolationTime = 0;

    const handleViolation = () => {
      if (isSubmittedRef.current) return;
      const now = Date.now();
      // Debounce rapid duplicate events (within 1.5s)
      if (now - lastViolationTime < 1500) return;
      lastViolationTime = now;

      const currentStrikes = strikeCountRef.current;
      if (currentStrikes === 0) {
        strikeCountRef.current = 1;
        setStrikeCount(1);
        setShowStrike1Modal(true);
      } else if (currentStrikes >= 1) {
        // Strike 2: Auto-submit immediately
        submitTest('SECURITY_STRIKE_LIMIT_EXCEEDED');
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleViolation();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [mode, isSubmitted, submitTest]);

  const { remainingSeconds, isWarning } = useTimer(
    initialRemaining,
    handleExpire,
    !isSubmitted
  );

  const remainingSecondsRef = useRef(remainingSeconds);
  remainingSecondsRef.current = remainingSeconds;

  // ─── derived ───
  const question = testData.questions[currentIdx];
  const response = responses[currentIdx];

  const statusCounts = useMemo(() => {
    const counts: Record<QuestionStatus, number> = {
      'not-visited': 0,
      'not-answered': 0,
      answered: 0,
      'marked-for-review': 0,
      'answered-and-marked': 0,
    };
    responses.forEach((r) => counts[r.status]++);
    return counts;
  }, [responses]);

  // ─── persistence ───
  useEffect(() => {
    if (isSubmitted) return;
    const state = {
      testData,
      mode,
      responses,
      currentQuestionIndex: currentIdx,
      startTime,
      totalDurationSeconds: totalDuration,
      remainingSeconds,
      isSubmitted,
    };
    saveTestState(state);
  }, [responses, currentIdx, remainingSeconds, isSubmitted]);

  // Mark current question as visited on mount or navigation
  useEffect(() => {
    setResponses((prev) => {
      const copy = [...prev];
      if (copy[currentIdx].status === 'not-visited') {
        copy[currentIdx] = { ...copy[currentIdx], status: 'not-answered' };
      }
      return copy;
    });
    setPracticeResult(null);
  }, [currentIdx]);

  // ─── actions ───

  function updateResponse(
    patch: Partial<UserResponse>,
    idx: number = currentIdx
  ) {
    setResponses((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...patch };
      return copy;
    });
  }

  function handleMCQSelect(optIdx: number) {
    updateResponse({ selectedOptions: [optIdx], status: 'answered' });
  }

  function handleMSQToggle(optIdx: number) {
    const current = response.selectedOptions ?? [];
    let next: number[];
    if (current.includes(optIdx)) {
      next = current.filter((i) => i !== optIdx);
    } else {
      next = [...current, optIdx];
    }
    updateResponse({
      selectedOptions: next.length ? next : undefined,
      status: next.length ? 'answered' : 'not-answered',
    });
  }

  function handleNATInput(value: string) {
    updateResponse({
      natInput: value,
      status: value.trim() ? 'answered' : 'not-answered',
    });
  }

  function handleKeypad(key: string) {
    const current = response.natInput ?? '';
    if (key === 'C') {
      handleNATInput('');
    } else if (key === '←') {
      handleNATInput(current.slice(0, -1));
    } else if (key === '-') {
      if (!current.includes('-')) handleNATInput('-' + current);
      else handleNATInput(current.replace('-', ''));
    } else if (key === '.') {
      if (!current.includes('.')) handleNATInput(current + '.');
    } else {
      handleNATInput(current + key);
    }
  }

  function clearResponse() {
    updateResponse({
      selectedOptions: undefined,
      natInput: undefined,
      status: 'not-answered',
      practiceChecked: false,
      practiceResult: null,
    });
    setPracticeResult(null);
  }

  function markForReview() {
    const hasAnswer =
      (response.selectedOptions && response.selectedOptions.length > 0) ||
      (response.natInput && response.natInput.trim() !== '');
    updateResponse({
      status: hasAnswer ? 'answered-and-marked' : 'marked-for-review',
    });
    goNext();
  }

  function saveAndNext() {
    const hasAnswer =
      (response.selectedOptions && response.selectedOptions.length > 0) ||
      (response.natInput && response.natInput.trim() !== '');
    if (hasAnswer && response.status !== 'answered-and-marked') {
      updateResponse({ status: 'answered' });
    }
    goNext();
  }

  function goNext() {
    if (currentIdx < testData!.questions.length - 1) setCurrentIdx(currentIdx + 1);
  }

  function goPrev() {
    if (currentIdx > 0) setCurrentIdx(currentIdx - 1);
  }

  function jumpTo(idx: number) {
    setCurrentIdx(idx);
    setShowPalette(false);
  }

  function checkAnswer() {
    const result = gradeQuestion(question, response);
    setPracticeResult({
      isCorrect: result.isCorrect,
      marks: result.marksAwarded,
      solution: question.solution || (question as any).explanation || '',
    });
    updateResponse({ practiceChecked: true, practiceResult: result.isCorrect ? 'correct' : 'incorrect' });
  }

  // ─── marks display ───
  function marksLabel(q: Question) {
    const isJee = testData?.examCategory === 'JEE_MAINS';
    const pos = isJee ? 4 : q.marks;
    const neg = getNegativeMarkingDisplay(q.type, q.marks, testData?.examCategory);
    return `+${pos} | ${neg}`;
  }

  // ────────────────────────────────────────────────────
  //  Render
  // ────────────────────────────────────────────────────

  return (
    <div
      className="flex h-screen max-h-screen w-full max-w-full flex-col bg-slate-50 overflow-hidden select-none"
      onContextMenu={(e) => {
        if (mode === 'exam') e.preventDefault();
      }}
    >
      {/* ═══ TOP BAR ═══ */}
      <header className="w-full max-w-full overflow-hidden border-b border-slate-200 bg-white px-2 sm:px-4 py-2 sm:py-2.5 shadow-sm shrink-0">
        <div className="flex items-center justify-between gap-1.5 sm:gap-4 w-full max-w-full">
          {/* Left: Brand logo & Title */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
            <img
              src="/logo.avif"
              alt="Abhiyantra"
              className="w-7 h-7 sm:w-8 sm:h-8 object-contain rounded-md border border-slate-200 p-0.5 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 sm:gap-2">
                <span className="hidden sm:inline-block text-[10px] sm:text-[11px] font-extrabold text-indigo-700 uppercase tracking-wider shrink-0">
                  abhiyantra CBT
                </span>
                <span className="text-slate-300 hidden sm:inline">•</span>
                <h1 className="truncate text-xs sm:text-sm md:text-base font-bold text-slate-800">
                  {testData.title}
                </h1>
              </div>
              {(testData.subject || testData.topic) && (
                <p className="truncate text-[10px] sm:text-xs text-slate-500 font-medium">
                  {[testData.subject, testData.topic].filter(Boolean).join(' • ')}
                </p>
              )}
            </div>
          </div>

          {/* Right: Controls (Proctoring status, Fullscreen, Calculator, Palette, Timer, Submit) */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Live Proctoring Strike Badge (Exam mode only) */}
            {mode === 'exam' && (
              <div
                className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1 rounded-lg text-[10px] sm:text-xs font-bold border transition ${
                  strikeCount === 0
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-red-50 text-red-700 border-red-300 animate-pulse'
                }`}
                title={
                  strikeCount === 0
                    ? 'Security Proctor Active: No violations detected'
                    : 'Strike 1 of 2 logged! Next app switch will terminate the test.'
                }
              >
                {strikeCount === 0 ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <ShieldAlert className="w-3.5 h-3.5 text-red-600 shrink-0" />
                )}
                <span className="hidden md:inline">Strikes:</span>
                <span>{strikeCount}/2</span>
              </div>
            )}

            {/* Full Screen Toggle Button */}
            <button
              onClick={requestFullscreen}
              className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition ${
                isFullscreen
                  ? 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  : 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 animate-pulse'
              }`}
              title={isFullscreen ? 'Full Screen Active' : 'Enter Full Screen'}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">{isFullscreen ? 'Full Screen' : 'Full Screen'}</span>
            </button>

            {testData.examCategory !== 'JEE_MAINS' && (
              <button
                onClick={() => setShowCalculator((prev) => !prev)}
                className="flex items-center justify-center gap-1 rounded-lg sm:rounded-xl border border-indigo-200 bg-indigo-50/90 p-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-semibold text-indigo-700 hover:bg-indigo-100 transition shadow-xs active:scale-95"
                title="Open GATE On-Screen Scientific Calculator"
              >
                <Calculator className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" />
                <span className="hidden sm:inline">Calculator</span>
              </button>
            )}

            {/* Mobile Question Palette Toggle in Header */}
            <button
              onClick={() => setShowPalette((prev) => !prev)}
              className="flex md:hidden items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition shadow-xs active:scale-95"
              title="Open Question Palette"
            >
              <Menu className="w-3.5 h-3.5 text-slate-700" />
              <span className="text-[11px] font-mono font-bold">
                {currentIdx + 1}/{testData.questions.length}
              </span>
            </button>

            {/* Timer */}
            <div
              className={`flex items-center gap-1 sm:gap-1.5 font-mono text-xs sm:text-base font-bold px-1.5 sm:px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 shrink-0 ${
                isWarning ? 'animate-pulse text-red-600 border-red-300 bg-red-50' : 'text-slate-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-slate-500" />
              <span>{formatTime(remainingSeconds)}</span>
            </div>

            {/* Submit Button */}
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1 rounded-lg sm:rounded-xl bg-red-600 px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold text-white transition hover:bg-red-700 shrink-0 shadow-xs active:scale-95 cursor-pointer"
            >
              <Send className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Submit Test</span>
              <span className="sm:hidden">Submit</span>
            </button>
          </div>
        </div>
      </header>

      {/* ═══ SECTION TABS (Official GATE CBT Split) ═══ */}
      {sections.length > 0 && (
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/90 px-3 sm:px-6 py-2 overflow-x-auto no-scrollbar w-full max-w-full shrink-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1 shrink-0">
            Sections:
          </span>
          {sections.map((sec) => {
            const isCurrentInSec =
              (sec.id === 'GA' && (question.section === 'GA' || question.subject?.toLowerCase().includes('general aptitude'))) ||
              (sec.id === 'SUBJECT' && !(question.section === 'GA' || question.subject?.toLowerCase().includes('general aptitude')));

            return (
              <button
                key={sec.id}
                onClick={() => setCurrentIdx(sec.firstIndex)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isCurrentInSec
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>{sec.name}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isCurrentInSec ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {sec.count} Qs
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ═══ MAIN BODY ═══ */}
      <div className="flex flex-1 overflow-hidden w-full max-w-full min-w-0">
        {/* ─── Question Panel ─── */}
        <main className="flex-1 min-w-0 w-full max-w-full overflow-y-auto overflow-x-hidden p-3 sm:p-6 md:p-8 pb-8">
          {/* question header */}
          <div className="mb-4 flex flex-wrap items-center gap-2.5">
            <span className="text-xl font-bold text-slate-800">
              Q.{currentIdx + 1}
            </span>
            <span
              className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
                typeBadgeColors[question.type]
              }`}
            >
              {question.type}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs font-medium text-slate-600">
              {marksLabel(question)}
            </span>
            {question.subject && (
              <span className="rounded-full bg-indigo-50 border border-indigo-200 px-3 py-0.5 text-xs font-medium text-indigo-700">
                {question.subject}
              </span>
            )}
            {question.topic && (
              <span className="rounded-full bg-slate-100 border border-slate-200 px-3 py-0.5 text-xs font-medium text-slate-600">
                {question.topic}
              </span>
            )}
          </div>

          {/* Question Visuals: Image */}
          {question.imageUrl && (
            <div className="mb-5 max-w-xl">
              <QuestionImage src={question.imageUrl} alt={`Question ${currentIdx + 1} Diagram`} />
            </div>
          )}

          {/* question text with LaTeX Math & Code syntax highlighting */}
          <div className="mb-6 text-base sm:text-lg leading-relaxed text-slate-800">
            <RichContent content={question.question} />
          </div>

          {/* ─── MCQ ─── */}
          {question.type === 'MCQ' && question.options && (
            <div className="space-y-3">
              {question.options.map((opt, i) => (
                <label
                  key={i}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all ${
                    response.selectedOptions?.[0] === i
                      ? 'border-indigo-500 bg-indigo-50/80 shadow-xs ring-1 ring-indigo-300'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name={`mcq-${question.id}`}
                    checked={response.selectedOptions?.[0] === i}
                    onChange={() => handleMCQSelect(i)}
                    className="accent-indigo-600 mt-1"
                  />
                  <span className="font-bold text-slate-500 shrink-0">
                    {String.fromCharCode(65 + i)}.
                  </span>
                  <div className="text-slate-800 flex-1 leading-relaxed">
                    <RichContent content={opt} />
                  </div>
                </label>
              ))}
            </div>
          )}

          {/* ─── MSQ ─── */}
          {question.type === 'MSQ' && question.options && (
            <div className="space-y-3">
              {question.options.map((opt, i) => (
                <label
                  key={i}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all ${
                    response.selectedOptions?.includes(i)
                      ? 'border-purple-500 bg-purple-50/80 shadow-xs ring-1 ring-purple-300'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={response.selectedOptions?.includes(i) ?? false}
                    onChange={() => handleMSQToggle(i)}
                    className="accent-purple-600 mt-1"
                  />
                  <span className="font-bold text-slate-500 shrink-0">
                    {String.fromCharCode(65 + i)}.
                  </span>
                  <div className="text-slate-800 flex-1 leading-relaxed">
                    <RichContent content={opt} />
                  </div>
                </label>
              ))}
            </div>
          )}

          {/* ─── NAT ─── */}
          {question.type === 'NAT' && (
            <div className="space-y-4">
              <input
                type="text"
                inputMode="decimal"
                value={response.natInput ?? ''}
                onChange={(e) => handleNATInput(e.target.value)}
                placeholder="Enter your answer"
                className="w-full max-w-xs rounded-lg border border-slate-300 px-4 py-3 text-lg font-mono focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
              />
              {/* Virtual keypad */}
              <div className="grid max-w-xs grid-cols-4 gap-2">
                {['7', '8', '9', '←', '4', '5', '6', 'C', '1', '2', '3', '-', '0', '.'].map(
                  (key) => (
                    <button
                      key={key}
                      onClick={() => handleKeypad(key)}
                      className={`rounded-lg border border-slate-300 py-3 text-center text-lg font-semibold transition hover:bg-slate-100 active:bg-slate-200 ${
                        key === '←' || key === 'C'
                          ? 'bg-amber-50 text-amber-700'
                          : key === '-'
                          ? 'bg-slate-100 text-slate-700'
                          : 'bg-white text-slate-800'
                      }`}
                    >
                      {key}
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          {/* ─── Practice-mode result card ─── */}
          {practiceResult && (
            <div
              className={`mt-6 rounded-lg border p-4 ${
                practiceResult.isCorrect
                  ? 'border-green-300 bg-green-50'
                  : 'border-red-300 bg-red-50'
              }`}
            >
              <p
                className={`text-lg font-bold ${
                  practiceResult.isCorrect ? 'text-green-700' : 'text-red-700'
                }`}
              >
                {practiceResult.isCorrect ? '✓ Correct!' : '✗ Incorrect'}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Marks awarded:{' '}
                <span className="font-semibold">
                  {practiceResult.marks > 0
                    ? `+${practiceResult.marks}`
                    : practiceResult.marks}
                </span>
              </p>
              <div className="mt-3 border-t border-slate-200 pt-3">
                <p className="text-sm font-semibold text-slate-700 mb-2">Solution</p>
                {question.solutionImageUrl && (
                  <div className="mb-3 max-w-lg">
                    <QuestionImage src={question.solutionImageUrl} alt="Solution Diagram" />
                  </div>
                )}
                <div className="text-sm leading-relaxed text-slate-700">
                  <RichContent content={practiceResult.solution || question.solution || (question as any).explanation || ''} />
                </div>
              </div>
            </div>
          )}

        </main>

        {/* ─── Palette Sidebar (desktop) ─── */}
        <aside className="hidden w-72 flex-col border-l border-slate-200 bg-white md:flex lg:w-80 shrink-0">
          <PaletteContent
            responses={responses}
            currentIdx={currentIdx}
            statusCounts={statusCounts}
            onJump={jumpTo}
          />
        </aside>
      </div>

      {/* ─── Bottom Navigation Bar (Sticky CBT Action Dock) ─── */}
      <footer className="sticky bottom-0 z-20 w-full max-w-full bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 sm:px-6 py-2 sm:py-2.5 shadow-lg shrink-0">
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-1.5 sm:gap-3 max-w-7xl mx-auto w-full">
          {/* Left secondary actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={goPrev}
              disabled={currentIdx === 0}
              className="flex items-center justify-center gap-1 rounded-xl border border-slate-300 px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 active:scale-95 cursor-pointer"
            >
              <ChevronLeft size={16} />
              <span className="hidden sm:inline">Previous</span>
              <span className="sm:hidden">Prev</span>
            </button>

            <button
              onClick={clearResponse}
              className="flex items-center justify-center gap-1 rounded-xl border border-slate-300 px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-slate-700 transition hover:bg-slate-100 active:scale-95 cursor-pointer"
            >
              <RotateCcw size={15} />
              <span className="hidden sm:inline">Clear Response</span>
              <span className="sm:hidden">Clear</span>
            </button>

            {mode === 'practice' && (
              <button
                onClick={checkAnswer}
                className="flex items-center justify-center gap-1 rounded-xl bg-amber-500 px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold text-white transition hover:bg-amber-600 active:scale-95 cursor-pointer shadow-xs"
              >
                Check
              </button>
            )}
          </div>

          {/* Right primary actions: Mark for Review & Save & Next */}
          <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
            <button
              onClick={markForReview}
              className="flex items-center justify-center gap-1 rounded-xl bg-purple-600 px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold text-white transition hover:bg-purple-700 active:scale-95 cursor-pointer shadow-xs"
            >
              <Flag size={15} />
              <span className="hidden sm:inline">Mark for Review &amp; Next</span>
              <span className="sm:hidden">Review &amp; Next</span>
            </button>

            <button
              onClick={saveAndNext}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-extrabold text-white transition hover:bg-indigo-700 active:scale-95 shadow-sm cursor-pointer"
            >
              <Save size={15} />
              <span>Save &amp; Next</span>
            </button>
          </div>
        </div>
      </footer>

      {/* ─── Mobile palette overlay ─── */}
      {showPalette && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => setShowPalette(false)}
          />
          <aside className="relative ml-auto flex h-full w-full max-w-[310px] sm:max-w-xs flex-col bg-white shadow-2xl z-10 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-slate-200 p-3 bg-slate-50">
              <span className="font-bold text-sm text-slate-800">
                Question Palette ({responses.length} Questions)
              </span>
              <button
                onClick={() => setShowPalette(false)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <PaletteContent
                responses={responses}
                currentIdx={currentIdx}
                statusCounts={statusCounts}
                onJump={jumpTo}
              />
            </div>
          </aside>
        </div>
      )}

      {/* ═══ SUBMIT MODAL ═══ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-slate-800">Submit Test?</h2>
            <p className="mt-2 text-sm text-slate-500">
              Please review before submitting:
            </p>

            <div className="mt-4 space-y-2 rounded-lg bg-slate-50 p-4 text-sm">
              <Row
                label="Attempted"
                value={
                  statusCounts.answered + statusCounts['answered-and-marked']
                }
                color="text-green-700"
              />
              <Row
                label="Unattempted"
                value={
                  statusCounts['not-visited'] + statusCounts['not-answered']
                }
                color="text-red-700"
              />
              <Row
                label="Marked for Review"
                value={
                  statusCounts['marked-for-review'] +
                  statusCounts['answered-and-marked']
                }
                color="text-purple-700"
              />
              <Row
                label="Total Questions"
                value={testData!.questions.length}
                color="text-slate-700"
              />
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Go Back
              </button>
              <button
                onClick={() => submitTest()}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Confirm Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Strike 1 Warning Modal ═══ */}
      {showStrike1Modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border-2 border-red-500 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-7 h-7 text-red-600 animate-bounce" />
              </div>
              <div>
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-red-100 text-red-700 border border-red-200 mb-1">
                  Security Violation: Strike 1 of 2
                </span>
                <h3 className="text-lg font-bold text-slate-900 leading-tight">
                  App Switch / Tab Change Detected
                </h3>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed bg-red-50/60 border border-red-100 p-4 rounded-xl">
              <p className="font-semibold text-red-900">
                You navigated away from the exam window or minimized the browser.
              </p>
              <p>
                Abhiyantra CBT exams operate under strict anti-cheating regulations. You are not allowed to switch tabs, open other applications, or access notifications.
              </p>
              <div className="p-2.5 bg-red-100 rounded-lg border border-red-200 text-red-950 font-bold">
                ⚠️ FINAL WARNING: If you leave or switch apps once more (Strike 2), your exam will be IMMEDIATELY AUTO-SUBMITTED.
              </div>
            </div>

            <button
              onClick={() => {
                setShowStrike1Modal(false);
                requestFullscreen();
              }}
              className="mt-5 w-full py-3 bg-red-600 hover:bg-red-700 active:scale-98 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              I Understand &amp; Resume Exam
            </button>
          </div>
        </div>
      )}

      {/* ═══ Full Screen Required Modal ═══ */}
      {showFullscreenModal && !showStrike1Modal && mode === 'exam' && !isSubmitted && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-indigo-200 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 mx-auto flex items-center justify-center">
              <Maximize2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Full Screen Mode Required</h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                To prevent distractions and maintain exam integrity, this CBT exam must be completed in Full Screen mode.
              </p>
            </div>
            <button
              onClick={() => {
                requestFullscreen();
                setShowFullscreenModal(false);
              }}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              <Maximize2 className="w-4 h-4" />
              Enter Full Screen Exam Mode
            </button>
          </div>
        </div>
      )}

      {/* GATE On-Screen Scientific Calculator Modal */}
      <GateCalculator isOpen={showCalculator} onClose={() => setShowCalculator(false)} />
    </div>
  );
}

// ───────────────────── Sub-components ─────────────────────

function Row({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-600">{label}</span>
      <span className={`font-semibold ${color}`}>{value}</span>
    </div>
  );
}

function PaletteContent({
  responses,
  currentIdx,
  statusCounts,
  onJump,
}: {
  responses: UserResponse[];
  currentIdx: number;
  statusCounts: Record<QuestionStatus, number>;
  onJump: (idx: number) => void;
}) {
  const statusColor: Record<QuestionStatus, string> = {
    'not-visited': 'bg-slate-200 text-slate-700',
    'not-answered': 'bg-red-500 text-white',
    answered: 'bg-green-500 text-white',
    'marked-for-review': 'bg-purple-500 text-white',
    'answered-and-marked': 'bg-purple-500 ring-2 ring-green-400 text-white',
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* counts */}
      <div className="grid grid-cols-2 gap-2 border-b border-slate-100 p-3 text-xs">
        <span className="text-green-700 font-medium">
          ✓ Answered: {statusCounts.answered}
        </span>
        <span className="text-red-700 font-medium">
          ○ Not Answered: {statusCounts['not-answered']}
        </span>
        <span className="text-slate-500 font-medium">
          — Not Visited: {statusCounts['not-visited']}
        </span>
        <span className="text-purple-700 font-medium">
          ⚑ Marked: {statusCounts['marked-for-review']}
        </span>
        <span className="text-purple-700 font-medium col-span-2">
          ⚑✓ Answered &amp; Marked: {statusCounts['answered-and-marked']}
        </span>
      </div>

      {/* grid */}
      <div className="grid grid-cols-5 gap-2 p-3">
        {responses.map((r, i) => (
          <button
            key={r.questionId}
            onClick={() => onJump(i)}
            className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-semibold transition ${
              statusColor[r.status]
            } ${
              i === currentIdx ? 'ring-2 ring-indigo-500 ring-offset-1' : ''
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* legend */}
      <div className="mt-auto border-t border-slate-100 p-3 text-xs text-slate-500 space-y-1.5">
        <p className="font-semibold text-slate-600 mb-1">Legend</p>
        <LegendItem color="bg-slate-200" label="Not Visited" />
        <LegendItem color="bg-red-500" label="Not Answered" textWhite />
        <LegendItem color="bg-green-500" label="Answered" textWhite />
        <LegendItem color="bg-purple-500" label="Marked for Review" textWhite />
        <LegendItem
          color="bg-purple-500 ring-2 ring-green-400"
          label="Answered & Marked"
          textWhite
        />
      </div>
    </div>
  );
}

function LegendItem({
  color,
  label,
  textWhite,
}: {
  color: string;
  label: string;
  textWhite?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-block h-4 w-4 rounded ${color} ${
          textWhite ? '' : ''
        }`}
      />
      <span>{label}</span>
    </div>
  );
}
