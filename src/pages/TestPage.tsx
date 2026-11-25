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
} from 'lucide-react';

import GateCalculator from '../components/GateCalculator';
import RichContent from '../components/RichContent';
import { QuestionImage } from '../components/ImageLightbox';
import TikzDiagram from '../components/TikzDiagram';

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

  const savedOnMount = useMemo(() => loadTestState(), []);
  const stateData = (location.state ?? {}) as {
    testData?: TestData;
    mode?: TestMode;
  };

  const testData = stateData.testData || (savedOnMount && !savedOnMount.isSubmitted ? savedOnMount.testData : undefined);
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

  // ─── state initialisation ───
  const totalDuration = calculateDuration(testData.questions.length);

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
  const submitTest = useCallback(() => {
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
    // Guarantee instant background save so the report card exists immediately
    saveReportCardApi(results).catch(() => {});
    navigate('/report', { state: { results } });
  }, [totalDuration, testData, mode, navigate, flushCurrentQuestionTime, timeSpentMap]);

  // ─── timer ───
  const handleExpire = useCallback(() => {
    submitTest();
  }, [submitTest]);

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
      solution: question.solution,
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
    <div className="flex h-screen flex-col bg-slate-50">
      {/* ═══ TOP BAR ═══ */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-3 sm:px-4 py-2 sm:py-2.5 shadow-sm">
        <div className="flex items-center gap-2 sm:gap-3 max-w-[44%] sm:max-w-[50%]">
          <img
            src="/logo.avif"
            alt="Abhiyantra"
            className="w-7 h-7 sm:w-9 sm:h-9 object-contain rounded-lg border border-slate-200 p-0.5 shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="text-[10px] sm:text-[11px] font-extrabold text-indigo-700 uppercase tracking-wider shrink-0">
                abhiyantra CBT
              </span>
              <span className="text-slate-300 hidden sm:inline">•</span>
              <h1 className="truncate text-xs sm:text-base font-bold text-slate-800">
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

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {testData.examCategory !== 'JEE_MAINS' && (
            <button
              onClick={() => setShowCalculator((prev) => !prev)}
              className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/90 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 transition shrink-0 shadow-xs active:scale-95"
              title="Open GATE On-Screen Scientific Calculator"
            >
              <Calculator className="w-4 h-4 text-indigo-600" />
              <span className="hidden sm:inline">Calculator</span>
            </button>
          )}

          <div
            className={`flex items-center gap-1.5 sm:gap-2 font-mono text-sm sm:text-lg font-semibold shrink-0 ${
              isWarning ? 'animate-pulse text-red-600' : 'text-slate-700'
            }`}
          >
            <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
            {formatTime(remainingSeconds)}
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1 sm:gap-1.5 rounded-xl bg-red-600 px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white transition hover:bg-red-700 shrink-0 shadow-xs"
          >
            <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Submit Test</span>
            <span className="sm:hidden">Submit</span>
          </button>
        </div>
      </header>

      {/* ═══ SECTION TABS (Official GATE CBT Split) ═══ */}
      {sections.length > 0 && (
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/90 px-3 sm:px-6 py-2 overflow-x-auto shrink-0">
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
      <div className="flex flex-1 overflow-hidden">
        {/* ─── Question Panel ─── */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-8 pb-28 md:pb-8">
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

          {/* Question Visuals: Image & TikZ Diagram */}
          {question.imageUrl && (
            <div className="mb-5 max-w-xl">
              <QuestionImage src={question.imageUrl} alt={`Question ${currentIdx + 1} Diagram`} />
            </div>
          )}

          {question.tikzCode && (
            <div className="mb-5 max-w-xl">
              <TikzDiagram code={question.tikzCode} caption={`Figure for Question ${currentIdx + 1}`} />
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
                {question.solutionTikzCode && (
                  <div className="mb-3 max-w-lg">
                    <TikzDiagram code={question.solutionTikzCode} caption="Solution Figure" />
                  </div>
                )}
                <div className="text-sm leading-relaxed text-slate-700">
                  <RichContent content={practiceResult.solution} />
                </div>
              </div>
            </div>
          )}

          {/* ─── Bottom navigation ─── */}
          <div className="mt-8 flex flex-wrap items-center gap-2 sm:gap-3 border-t border-slate-200 pt-4">
            <button
              onClick={goPrev}
              disabled={currentIdx === 0}
              className="flex items-center justify-center gap-1 rounded-xl border border-slate-300 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={16} />
              <span className="hidden sm:inline">Previous</span>
              <span className="sm:hidden">Prev</span>
            </button>

            <button
              onClick={clearResponse}
              className="flex items-center justify-center gap-1 rounded-xl border border-slate-300 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              <RotateCcw size={16} />
              <span className="hidden sm:inline">Clear Response</span>
              <span className="sm:hidden">Clear</span>
            </button>

            {mode === 'practice' && (
              <button
                onClick={checkAnswer}
                className="flex items-center justify-center gap-1 rounded-xl bg-amber-500 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white transition hover:bg-amber-600"
              >
                Check Answer
              </button>
            )}

            <button
              onClick={markForReview}
              className="flex items-center justify-center gap-1 rounded-xl bg-purple-600 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white transition hover:bg-purple-700"
            >
              <Flag size={16} />
              <span className="hidden sm:inline">Mark for Review &amp; Next</span>
              <span className="sm:hidden">Review &amp; Next</span>
            </button>

            <button
              onClick={saveAndNext}
              className="flex items-center justify-center gap-1 rounded-xl bg-indigo-600 px-4 sm:px-5 py-2 text-xs sm:text-sm font-semibold text-white transition hover:bg-indigo-700 shadow-xs"
            >
              <Save size={16} />
              Save &amp; Next
            </button>
          </div>
        </main>

        {/* ─── Palette Sidebar (desktop) ─── */}
        <aside className="hidden w-72 flex-col border-l border-slate-200 bg-white md:flex lg:w-80">
          <PaletteContent
            responses={responses}
            currentIdx={currentIdx}
            statusCounts={statusCounts}
            onJump={jumpTo}
          />
        </aside>
      </div>

      {/* ─── Floating palette toggle (mobile) ─── */}
      <button
        onClick={() => setShowPalette(!showPalette)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg md:hidden"
      >
        {showPalette ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* ─── Mobile palette overlay ─── */}
      {showPalette && (
        <div className="fixed inset-0 z-30 flex md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowPalette(false)}
          />
          <aside className="relative ml-auto flex h-full w-80 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-3">
              <span className="font-semibold text-slate-700">
                Question Palette
              </span>
              <button onClick={() => setShowPalette(false)}>
                <X size={20} />
              </button>
            </div>
            <PaletteContent
              responses={responses}
              currentIdx={currentIdx}
              statusCounts={statusCounts}
              onJump={jumpTo}
            />
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
                onClick={submitTest}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Confirm Submit
              </button>
            </div>
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
