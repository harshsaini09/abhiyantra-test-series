import React, { useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { TestData, TestMode } from '../types';
import {
  BookOpen,
  Award,
  AlertTriangle,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  GraduationCap,
  Atom,
  ShieldAlert,
  FileText,
  User,
  CheckSquare,
  Square,
} from 'lucide-react';

function resolveSubject(testData: TestData, qSubject?: string): string {
  if (qSubject && qSubject.trim() && qSubject.trim() !== 'General PCM' && qSubject.trim() !== 'Core Engineering') {
    return qSubject.trim();
  }
  if (testData.subject && testData.subject.trim() && testData.subject.trim() !== 'General PCM') {
    return testData.subject.trim();
  }
  const title = (testData.title || '').toLowerCase();
  if (title.includes('mathematics') || title.includes('maths') || title.includes('math')) return 'Mathematics';
  if (title.includes('physics')) return 'Physics';
  if (title.includes('chemistry')) return 'Chemistry';
  if (title.includes('artificial intelligence') || title.includes('ai mock') || title.includes('search —') || title.includes('da:')) return 'Artificial Intelligence (AI)';
  if (title.includes('data structures') || title.includes('algorithms')) return 'Data Structures & Algorithms';
  if (title.includes('database') || title.includes('dbms')) return 'Database Management Systems (DBMS)';
  if (title.includes('operating system') || title.includes('os ')) return 'Operating Systems';
  if (title.includes('computer network') || title.includes('cn ')) return 'Computer Networks';
  if (title.includes('theory of computation') || title.includes('toc')) return 'Theory of Computation';
  if (title.includes('compiler')) return 'Compiler Design';
  if (title.includes('digital logic')) return 'Digital Logic';
  if (title.includes('general aptitude') || title.includes('aptitude')) return 'General Aptitude';
  if (title.includes('machine learning') || title.includes('ml ')) return 'Machine Learning';
  return testData.examCategory === 'JEE_MAINS' ? 'Mathematics, Physics & Chemistry' : 'Core Technical Subject';
}

function resolveTopic(qText?: string, qTopic?: string, testTopic?: string, subject?: string): string {
  if (qTopic && qTopic.trim() && qTopic.trim() !== 'General Topic') {
    return qTopic.trim();
  }
  if (testTopic && testTopic.trim() && testTopic.trim() !== 'General Topic') {
    return testTopic.trim();
  }
  const text = (qText || '').toLowerCase();
  if (
    text.includes('equivalence relation') ||
    text.includes('bijective') ||
    text.includes('onto') ||
    text.includes('injective') ||
    text.includes('domain of the function') ||
    text.includes('invertible function') ||
    text.includes('relation r')
  ) {
    return 'Relations & Functions';
  }
  if (
    text.includes('sin^{-1}') ||
    text.includes('cos^{-1}') ||
    text.includes('tan^{-1}') ||
    text.includes('cot^{-1}') ||
    text.includes('sec^{-1}') ||
    text.includes('csc^{-1}')
  ) {
    return 'Inverse Trigonometric Functions';
  }
  if (
    text.includes('matrix') ||
    text.includes('matrices') ||
    text.includes('determinant') ||
    text.includes('adjoint') ||
    text.includes('linear equations') ||
    text.includes('symmetric')
  ) {
    return 'Matrices & Determinants';
  }
  if (
    text.includes('derivative') ||
    text.includes('integral') ||
    text.includes('limit') ||
    text.includes('continuity') ||
    text.includes('differentiab')
  ) {
    return 'Calculus';
  }
  if (
    text.includes('vector') ||
    text.includes('plane') ||
    text.includes('line in space') ||
    text.includes('direction cosine')
  ) {
    return 'Vectors & 3D Geometry';
  }
  if (
    text.includes('probability') ||
    text.includes('bayes') ||
    text.includes('random variable') ||
    text.includes('distribution')
  ) {
    return 'Probability';
  }
  if (
    text.includes('search') ||
    text.includes('bfs') ||
    text.includes('dfs') ||
    text.includes('heuristic') ||
    text.includes('a*') ||
    text.includes('uninformed') ||
    text.includes('informed')
  ) {
    return 'Search Algorithms (Informed & Uninformed)';
  }
  if (
    text.includes('propositional') ||
    text.includes('first-order') ||
    text.includes('predicate') ||
    text.includes('logic')
  ) {
    return 'Logic & Reasoning';
  }
  return subject ? `${subject} Core Concepts` : 'Core Curriculum Topics';
}

export const TestInstructionsPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, targetExam } = useAuth();

  const stateData = (location.state ?? {}) as {
    testData?: TestData;
    mode?: TestMode;
  };

  const testData = stateData.testData;
  const mode = stateData.mode || 'exam';

  const [acknowledged, setAcknowledged] = useState(false);
  const [activeTab, setActiveTab] = useState<'instructions' | 'syllabus'>('instructions');

  // Guard: if no testData passed, navigate back to test series
  if (!testData) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 p-8 rounded-3xl border border-slate-700 text-center space-y-4 shadow-2xl">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
          <h2 className="text-xl font-bold text-white">No Test Paper Selected</h2>
          <p className="text-xs text-slate-300">
            Please select an official or custom mock test paper from the Test Series portal before starting.
          </p>
          <button
            onClick={() => navigate('/test-series')}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
          >
            Go to Test Series
          </button>
        </div>
      </div>
    );
  }

  const isJEE = testData.examCategory === 'JEE_MAINS' || targetExam === 'JEE_MAINS';
  const examName = isJEE ? 'JEE Mains (NTA Pattern)' : 'GATE (IIT Pattern)';
  const examDuration = testData.duration || (testData.questions.length >= 50 ? 180 : Math.ceil(testData.questions.length * 2.5));

  // Analyze Questions Breakdown
  const analysis = useMemo(() => {
    const questions = testData.questions || [];
    let mcqCount = 0;
    let msqCount = 0;
    let natCount = 0;
    let totalMarks = 0;

    const subjectsMap = new Map<string, { count: number; marks: number; topics: Set<string> }>();

    questions.forEach((q) => {
      const marks = Number(q.marks) || (isJEE ? 4 : 1);
      totalMarks += marks;

      if (q.type === 'MSQ') msqCount++;
      else if (q.type === 'NAT') natCount++;
      else mcqCount++;

      const subj = resolveSubject(testData, q.subject);
      const topic = resolveTopic(q.question || q.questionText, q.topic, testData.topic, subj);

      if (!subjectsMap.has(subj)) {
        subjectsMap.set(subj, { count: 0, marks: 0, topics: new Set() });
      }
      const entry = subjectsMap.get(subj)!;
      entry.count++;
      entry.marks += marks;
      if (topic) entry.topics.add(topic);
    });

    return {
      totalQuestions: questions.length,
      totalMarks,
      mcqCount,
      msqCount,
      natCount,
      subjects: Array.from(subjectsMap.entries()).map(([name, data]) => ({
        name,
        count: data.count,
        marks: data.marks,
        topics: Array.from(data.topics),
      })),
    };
  }, [testData, isJEE]);

  const handleStartExam = () => {
    if (!acknowledged) return;
    navigate('/test', { state: { testData, mode } });
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-800">
      {/* Top Official CBT Banner Header */}
      <header className="bg-slate-900 text-white border-b border-indigo-950 px-4 sm:px-8 py-3.5 shadow-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
              {isJEE ? <Atom className="w-5 h-5 text-cyan-400" /> : <GraduationCap className="w-5 h-5 text-indigo-400" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  {isJEE ? 'NTA CBT Interface' : 'TCS-iON CBT Interface'}
                </span>
                <span className="text-xs text-slate-400">· Computer Based Test</span>
              </div>
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight truncate max-w-xl">
                {testData.title}
              </h1>
            </div>
          </div>

          {/* Candidate Info Pill */}
          <div className="flex items-center gap-3 bg-slate-800/80 border border-slate-700/80 px-3.5 py-1.5 rounded-2xl shrink-0 text-xs">
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shadow-xs">
              {user?.name ? user.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
            </div>
            <div className="text-left leading-tight">
              <span className="block font-bold text-white truncate max-w-[140px] sm:max-w-[180px]">
                {user?.name || 'Candidate'}
              </span>
              <span className="text-[10px] text-slate-400">Roll: {user?.id?.slice(-8).toUpperCase() || 'ONLINE-CBT'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Test Summary Card */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold tracking-wider uppercase bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                  {examName}
                </span>
                <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold tracking-wider uppercase bg-slate-100 text-slate-700">
                  {mode === 'practice' ? 'Practice Mode' : 'Authentic CBT Examination'}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {testData.title}
              </h2>
              {testData.description && (
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed pt-1">
                  {testData.description}
                </p>
              )}
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200/70 shrink-0 text-center min-w-[280px]">
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-400">Total Questions</span>
                <span className="font-extrabold text-sm sm:text-base text-slate-900">{analysis.totalQuestions} Qs</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-400">Total Marks</span>
                <span className="font-extrabold text-sm sm:text-base text-indigo-700">{analysis.totalMarks} Marks</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-400">Duration</span>
                <span className="font-extrabold text-sm sm:text-base text-emerald-700">{examDuration} Mins</span>
              </div>
            </div>
          </div>

          {/* Navigation Sub-Tabs */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => setActiveTab('instructions')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'instructions'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>General Instructions & Marking Scheme</span>
            </button>
            <button
              onClick={() => setActiveTab('syllabus')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'syllabus'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Syllabus & Topics Breakdown ({analysis.subjects.length} Subjects)</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Detailed Instructions & Marking Scheme */}
        {activeTab === 'instructions' && (
          <div className="space-y-6">
            {/* 1. Official Marking Scheme Card */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Award className="w-5 h-5 text-indigo-600" />
                <h3 className="font-black text-base text-slate-900">
                  Official Marking Scheme ({examName})
                </h3>
              </div>

              {!isJEE ? (
                /* GATE Pattern Marking Scheme */
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-blue-900 text-xs">MCQ (Multiple Choice)</span>
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-blue-200 text-blue-900">
                          {analysis.mcqCount} Qs
                        </span>
                      </div>
                      <p className="text-slate-600 leading-relaxed text-[11px]">
                        Only 1 out of 4 choices is correct.
                      </p>
                      <ul className="space-y-1 pt-1 font-semibold text-[11px]">
                        <li className="text-emerald-700">✓ 1-Mark Qs: <strong>+1 mark</strong> for correct</li>
                        <li className="text-red-600">✗ 1-Mark Qs: <strong>-1/3 (-0.33) mark</strong> for wrong</li>
                        <li className="text-emerald-700">✓ 2-Mark Qs: <strong>+2 marks</strong> for correct</li>
                        <li className="text-red-600">✗ 2-Mark Qs: <strong>-2/3 (-0.67) mark</strong> for wrong</li>
                      </ul>
                    </div>

                    <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-2xl space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-purple-900 text-xs">MSQ (Multiple Select)</span>
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-purple-200 text-purple-900">
                          {analysis.msqCount} Qs
                        </span>
                      </div>
                      <p className="text-slate-600 leading-relaxed text-[11px]">
                        One or more than one choice can be correct.
                      </p>
                      <ul className="space-y-1 pt-1 font-semibold text-[11px]">
                        <li className="text-emerald-700">✓ Full Marks: Only if <strong>ALL</strong> correct options are chosen</li>
                        <li className="text-slate-600">✗ No partial credit given for incomplete choices</li>
                        <li className="text-emerald-800 font-bold">✓ Negative Marking: <strong>ZERO (0) — NO negative marks</strong></li>
                      </ul>
                    </div>

                    <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-900 text-xs">NAT (Numerical Answer Type)</span>
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-900">
                          {analysis.natCount} Qs
                        </span>
                      </div>
                      <p className="text-slate-600 leading-relaxed text-[11px]">
                        Answer is a real number entered via on-screen virtual keypad.
                      </p>
                      <ul className="space-y-1 pt-1 font-semibold text-[11px]">
                        <li className="text-emerald-700">✓ Correct Range: <strong>+1 or +2 marks</strong> awarded</li>
                        <li className="text-emerald-800 font-bold">✓ Negative Marking: <strong>ZERO (0) — NO negative marks</strong></li>
                        <li className="text-slate-600">Unattempted: 0 marks</li>
                      </ul>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-700 space-y-1">
                    <strong>Section Structure for GATE Full Mocks:</strong>
                    <p className="text-slate-600">
                      • <strong>Section 1 (General Aptitude):</strong> 10 Questions total (5 questions of 1 mark each + 5 questions of 2 marks each = 15 Marks).<br />
                      • <strong>Section 2 (Technical Core Subject):</strong> 55 Questions total (25 questions of 1 mark each + 30 questions of 2 marks each = 85 Marks).
                    </p>
                  </div>
                </div>
              ) : (
                /* JEE Mains Pattern Marking Scheme */
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-4 bg-cyan-50/70 border border-cyan-200 rounded-2xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-cyan-900 text-xs sm:text-sm">Section A: Objective MCQs</span>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-cyan-200 text-cyan-900">
                          +4 / -1 Marking
                        </span>
                      </div>
                      <p className="text-slate-600 text-[11px]">
                        Single choice questions covering Physics, Chemistry, and Mathematics.
                      </p>
                      <ul className="space-y-1 font-semibold text-[11px] pt-1">
                        <li className="text-emerald-700">✓ Correct Answer: <strong>+4 Marks</strong></li>
                        <li className="text-red-600">✗ Incorrect Answer: <strong>-1 Mark</strong></li>
                        <li className="text-slate-500">○ Unanswered / Marked for Review: <strong>0 Marks</strong></li>
                      </ul>
                    </div>

                    <div className="p-4 bg-teal-50/70 border border-teal-200 rounded-2xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-teal-900 text-xs sm:text-sm">Section B: Numerical Value Questions</span>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-teal-200 text-teal-900">
                          +4 / -1 Marking
                        </span>
                      </div>
                      <p className="text-slate-600 text-[11px]">
                        Integer or decimal value entered using the virtual on-screen keypad.
                      </p>
                      <ul className="space-y-1 font-semibold text-[11px] pt-1">
                        <li className="text-emerald-700">✓ Correct Answer: <strong>+4 Marks</strong></li>
                        <li className="text-red-600">✗ Incorrect Answer: <strong>-1 Mark</strong> (NTA standard)</li>
                        <li className="text-slate-500">○ Unanswered: <strong>0 Marks</strong></li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Standard Navigational & CBT Interface Instructions */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <HelpCircle className="w-5 h-5 text-indigo-600" />
                <h3 className="font-black text-base text-slate-900">
                  Question Palette Legend & Navigation Rules
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
                <div className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="w-6 h-6 rounded-md bg-slate-200 text-slate-700 font-extrabold text-[11px] flex items-center justify-center shrink-0 border border-slate-300">
                    1
                  </span>
                  <span className="text-[11px] font-medium text-slate-700">You have not visited the question yet.</span>
                </div>

                <div className="flex items-center gap-2.5 p-2.5 rounded-xl border border-red-200 bg-red-50/60">
                  <span className="w-6 h-6 rounded-md bg-red-500 text-white font-extrabold text-[11px] flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span className="text-[11px] font-medium text-slate-700">You have not answered the question.</span>
                </div>

                <div className="flex items-center gap-2.5 p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60">
                  <span className="w-6 h-6 rounded-md bg-emerald-600 text-white font-extrabold text-[11px] flex items-center justify-center shrink-0">
                    3
                  </span>
                  <span className="text-[11px] font-medium text-slate-700">You have answered the question.</span>
                </div>

                <div className="flex items-center gap-2.5 p-2.5 rounded-xl border border-purple-200 bg-purple-50/60">
                  <span className="w-6 h-6 rounded-md bg-purple-600 text-white font-extrabold text-[11px] flex items-center justify-center shrink-0">
                    4
                  </span>
                  <span className="text-[11px] font-medium text-slate-700">Marked for review without answering.</span>
                </div>

                <div className="flex items-center gap-2.5 p-2.5 rounded-xl border border-purple-200 bg-purple-50/60 sm:col-span-2">
                  <span className="relative w-6 h-6 rounded-md bg-purple-600 text-white font-extrabold text-[11px] flex items-center justify-center shrink-0">
                    5
                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-white" />
                  </span>
                  <span className="text-[11px] font-medium text-slate-700">
                    Answered and Marked for Review (will be evaluated in final score).
                  </span>
                </div>
              </div>

              {/* Crucial CBT Rules List */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-2">
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  Crucial Rules During the Examination:
                </h4>
                <ul className="list-disc pl-5 space-y-1.5 text-[11px] text-slate-600 leading-relaxed">
                  <li>
                    <strong>Countdown Timer:</strong> The clock at the top right of the CBT screen displays remaining time. When the timer reaches zero, the test will submit automatically.
                  </li>
                  <li>
                    <strong>Saving Answers:</strong> To save your response, you MUST click <strong>Save & Next</strong>. Merely clicking a radio option or entering text without saving will not record your response.
                  </li>
                  <li>
                    <strong>Official Virtual Calculator:</strong> {isJEE ? 'Calculators are strictly prohibited in JEE Mains examination.' : 'An authentic official GATE virtual scientific calculator is provided on the top bar of your CBT screen. Physical calculators or external tools are prohibited.'}
                  </li>
                  <li>
                    <strong>Changing Answers:</strong> You can click <strong>Clear Response</strong> to deselect an option or re-click another option at any time before final submission.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Detailed Syllabus Breakdown */}
        {activeTab === 'syllabus' && (
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                <span>Test Syllabus & Subject-Wise Weightage</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Detailed breakdown of curriculum chapters, topics, and marks included in this test paper.
              </p>
            </div>

            <div className="space-y-4">
              {analysis.subjects.map((subj, idx) => (
                <div key={idx} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <h4 className="font-bold text-sm text-slate-900">
                        {subj.name}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      <span className="px-2.5 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 border border-indigo-200 text-[11px]">
                        {subj.count} Questions
                      </span>
                      <span className="px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px]">
                        {subj.marks} Total Marks
                      </span>
                    </div>
                  </div>

                  {subj.topics.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Covered Topics & Chapters:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {subj.topics.map((t, tIdx) => (
                          <span
                            key={tIdx}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white text-slate-700 border border-slate-200 shadow-2xs"
                          >
                            • {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Declaration & Proceed CTA Bar */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div
            onClick={() => setAcknowledged(!acknowledged)}
            className="flex items-start gap-3 p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-200/70 cursor-pointer select-none transition hover:bg-indigo-50"
          >
            <div className="pt-0.5 shrink-0">
              {acknowledged ? (
                <CheckSquare className="w-5 h-5 text-indigo-600" />
              ) : (
                <Square className="w-5 h-5 text-slate-400" />
              )}
            </div>
            <p className="text-xs text-slate-700 leading-relaxed font-medium">
              <strong>Candidate Undertaking:</strong> I have read and understood all the official instructions and the detailed syllabus for the <strong>{testData.title}</strong> examination. I confirm that all computer hardware and screen components are functioning properly. I am ready to begin the test under authentic exam regulations.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <button
              onClick={() => navigate('/test-series')}
              className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Test Series</span>
            </button>

            <button
              disabled={!acknowledged}
              onClick={handleStartExam}
              className={`w-full sm:w-auto px-8 py-3.5 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
                acknowledged
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white shadow-indigo-600/30 scale-100 active:scale-98'
                  : 'bg-slate-200 text-slate-400 shadow-none cursor-not-allowed'
              }`}
            >
              <span>I am Ready to Begin / Start Exam</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TestInstructionsPage;
