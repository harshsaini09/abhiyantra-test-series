import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  Copy,
  Download,
  Play,
  FileJson,
  Clock,
  CheckCircle,
  AlertCircle,
  BookOpen,
  GraduationCap,
  ClipboardPaste,
  RotateCcw,
  ChevronRight,
  Sparkles,
  Shield,
  Timer,
  Hash,
  List,
  Calculator,
  Database,
  Users,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import StudentCarousel from '../components/StudentCarousel';
import type { TestData, TestMode, ValidationError } from '../types';
import { sampleTestData, sampleJSONString, AI_SYSTEM_PROMPT } from '../utils/sampleData';
import { parseJSON, validateTestJSON } from '../utils/validation';
import { calculateDuration, formatDurationHuman } from '../utils/scoring';
import { hasInProgressTest } from '../utils/storage';
import { ingestTestData } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { PaymentModal } from '../components/PaymentModal';

type InputTab = 'paste' | 'upload';

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Resume banner
  const [showResumeBanner, setShowResumeBanner] = useState(false);

  // Ingest status
  const [ingestStatus, setIngestStatus] = useState<string | null>(null);

  // JSON input
  const [activeTab, setActiveTab] = useState<InputTab>('paste');
  const [jsonText, setJsonText] = useState('');
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validation
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [syntaxError, setSyntaxError] = useState('');
  const [validatedData, setValidatedData] = useState<TestData | null>(null);

  // Mode
  const [mode, setMode] = useState<TestMode>('exam');

  // Copy feedback
  const [copied, setCopied] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Check in-progress test on mount
  useEffect(() => {
    setShowResumeBanner(hasInProgressTest());
  }, []);

  // Validate whenever jsonText changes
  const validate = useCallback((text: string) => {
    if (!text.trim()) {
      setValidationErrors([]);
      setSyntaxError('');
      setValidatedData(null);
      return;
    }

    const parsed = parseJSON(text);
    if (parsed.error) {
      setSyntaxError(parsed.error);
      setValidationErrors([]);
      setValidatedData(null);
      return;
    }

    setSyntaxError('');
    const result = validateTestJSON(parsed.data);
    if (!result.valid) {
      setValidationErrors(result.errors);
      setValidatedData(null);
    } else {
      setValidationErrors([]);
      setValidatedData(result.testData!);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => validate(jsonText), 300);
    return () => clearTimeout(timer);
  }, [jsonText, validate]);

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setJsonText(text);
    };
    reader.readAsText(file);
  };

  // Copy sample JSON
  const handleCopy = async () => {
    await navigator.clipboard.writeText(sampleJSONString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Copy AI System Prompt
  const handleCopyPrompt = async () => {
    await navigator.clipboard.writeText(AI_SYSTEM_PROMPT);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  // Download sample JSON
  const handleDownload = () => {
    const blob = new Blob([sampleJSONString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gate-sample-test.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Automatically ingest questions into database whenever a valid JSON is parsed
  useEffect(() => {
    if (validatedData) {
      ingestTestData(validatedData)
        .then((res) => {
          setIngestStatus(res.message);
        })
        .catch(() => {
          // If backend is unavailable, client-side testing still works seamlessly
        });
    } else {
      setIngestStatus(null);
    }
  }, [validatedData]);

  // Try sample test
  const handleTrySample = () => {
    ingestTestData(sampleTestData).catch(() => {});
    navigate('/test-instructions', { state: { testData: sampleTestData, mode } });
  };

  // Start test
  const handleStartTest = () => {
    if (!validatedData) return;

    // Freemium Gatekeeper: full mock tests (> 15 questions) require active pass
    if (validatedData.questions.length > 15 && !user?.isSubscribed) {
      setShowPaymentModal(true);
      return;
    }

    ingestTestData(validatedData).catch(() => {});
    navigate('/test-instructions', { state: { testData: validatedData, mode } });
  };

  // Preview summary helpers
  const getQuestionTypeCounts = (data: TestData) => {
    const counts: Record<string, number> = { MCQ: 0, MSQ: 0, NAT: 0, DESCRIPTIVE: 0 };
    data.questions.forEach((q) => {
      counts[q.type] = (counts[q.type] || 0) + 1;
    });
    return counts;
  };

  const getTotalMarks = (data: TestData) =>
    data.questions.reduce((sum, q) => sum + q.marks, 0);

  const hasErrors = syntaxError || validationErrors.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col">
      <Navbar />

      {/* ═══════════ Resume Banner ═══════════ */}
      {showResumeBanner && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-amber-800">
              <RotateCcw className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">
                You have a test in progress. Would you like to continue?
              </span>
            </div>
            <button
              onClick={() => navigate('/test')}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors cursor-pointer"
            >
              Resume Test
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ═══════════ Official Abhiyantra Brand & Student Carousel Strip ═══════════ */}
      <section className="bg-white border-b border-slate-200/80 pt-6 pb-4 sm:pt-8 sm:pb-6">
        <div className="max-w-6xl mx-auto px-4 flex flex-col items-center text-center">
          {/* Centered Large Abhiyantra Brand Logo */}
          <div className="hover:scale-102 transition-transform duration-300 py-1 mb-2">
            <img
              src="/abhiyantra-logo.png"
              alt="Abhiyantra Logo"
              className="h-16 sm:h-24 md:h-32 w-auto object-contain drop-shadow-xs"
            />
          </div>

          <p className="text-xs sm:text-sm font-semibold text-emerald-800 tracking-wide max-w-lg mb-1">
            Empowering Aspirants Across India for GATE &amp; JEE Mains
          </p>

          {/* Student Avatar Carousel with Teal Rings and Navigation Arrows */}
          <div className="w-full mt-2">
            <StudentCarousel />
          </div>
        </div>
      </section>

      {/* ═══════════ Dual CBT Exam Portals & Hero Section ═══════════ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white py-12 md:py-16">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-10 left-1/4 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-full px-4 py-1.5 text-xs font-bold tracking-wide text-emerald-300 border border-emerald-400/30 mb-4 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Official Abhiyantra Computer-Based Examination Portals</span>
          </div>

          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight text-white max-w-3xl">
            The Engine of Engineering Excellence
          </h1>
          <p className="mt-3 text-xs sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Real exam simulation environment for <strong className="text-white font-bold">GATE</strong> &amp; <strong className="text-white font-bold">JEE Mains</strong> with official marking blueprints, TCS-iON / NTA user interfaces, virtual calculator, and deep performance analytics.
          </p>

          {/* Quick Action CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row flex-wrap justify-center gap-3 w-full sm:w-auto max-w-md sm:max-w-none">
            {user?.isSubscribed ? (
              <div className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-sm font-bold rounded-xl shadow-xs cursor-default">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Pro Pass Active</span>
              </div>
            ) : (
              <button
                onClick={() => setShowPaymentModal(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-slate-950 text-sm font-black rounded-xl shadow-lg hover:shadow-amber-500/25 transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-slate-950 fill-current" />
                Get Full Pass (₹59)
              </button>
            )}
            <button
              onClick={() => navigate('/test-series')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-md transition-all cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              Browse Test Series
            </button>
            <button
              onClick={() => navigate('/custom-builder')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-xl border border-slate-600 transition-all cursor-pointer"
            >
              <Database className="w-4 h-4 text-indigo-400" />
              Test Builder
            </button>
            <button
              onClick={handleTrySample}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold rounded-xl border border-white/20 transition-all cursor-pointer"
            >
              <Play className="w-4 h-4" />
              Try Free Sample
            </button>
          </div>
        </div>
      </section>

      {/* ═══════════ Founding Faculty & Mentors Section ═══════════ */}
      <section className="w-full bg-slate-50 border-b border-slate-200/80 py-12 sm:py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-200 mb-2">
              <Users className="w-3.5 h-3.5 text-teal-600" />
              Meet Your Mentors
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Guided by India's Top Educators &amp; Researchers
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
              Curated exam content, question papers, and authentic simulation designed by educators with decades of combined teaching and research experience.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Deepika Sheel */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs hover:shadow-md transition-shadow flex flex-col">
              <div className="flex items-center gap-4 mb-4">
                <img
                  src="/mentors/Deepika.avif"
                  alt="Deepika Sheel"
                  className="w-18 h-18 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-teal-500 shadow-xs"
                />
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Deepika Sheel</h3>
                  <p className="text-xs font-bold text-teal-700 uppercase tracking-wide">
                    Educator — Physics &amp; Civil Engineering
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed flex-1">
                5+ years of dedicated teaching experience. Mentored numerous students securing top ranks in GATE, JEE Mains, and NEET examinations.
              </p>
              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5 text-[11px] font-semibold text-slate-600">
                <span className="bg-slate-100 px-2 py-0.5 rounded-md">IIT Kanpur</span>
                <span className="bg-slate-100 px-2 py-0.5 rounded-md">DEI</span>
                <span className="bg-slate-100 px-2 py-0.5 rounded-md">ex-TCS</span>
              </div>
            </div>

            {/* Aman Sheel */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs hover:shadow-md transition-shadow flex flex-col">
              <div className="flex items-center gap-4 mb-4">
                <img
                  src="/mentors/Aman.avif"
                  alt="Aman Sheel"
                  className="w-18 h-18 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-amber-500 shadow-xs"
                />
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Aman Sheel</h3>
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">
                    Educator — Chemistry &amp; Civil Engineering
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed flex-1">
                10+ years of teaching experience. Mentored rank holders in GATE, JEE Mains, JEE Advanced, and NEET across India.
              </p>
              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5 text-[11px] font-semibold text-slate-600">
                <span className="bg-slate-100 px-2 py-0.5 rounded-md">DEI</span>
                <span className="bg-slate-100 px-2 py-0.5 rounded-md">MIT Boston</span>
                <span className="bg-slate-100 px-2 py-0.5 rounded-md">IIT-BHU</span>
              </div>
            </div>

            {/* Anmol Twickley */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs hover:shadow-md transition-shadow flex flex-col">
              <div className="flex items-center gap-4 mb-4">
                <img
                  src="/mentors/Anmol.avif"
                  alt="Anmol Twickley"
                  className="w-18 h-18 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-indigo-500 shadow-xs"
                />
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Anmol Twickley</h3>
                  <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide">
                    Educator — Mathematics &amp; Data Science
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed flex-1">
                Specialized in higher engineering mathematics, calculus, probability, and foundational data science &amp; artificial intelligence for GATE aspirants.
              </p>
              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5 text-[11px] font-semibold text-slate-600">
                <span className="bg-slate-100 px-2 py-0.5 rounded-md">IIT Madras</span>
                <span className="bg-slate-100 px-2 py-0.5 rounded-md">Data Science</span>
                <span className="bg-slate-100 px-2 py-0.5 rounded-md">AI / ML</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ How It Works & JSON Format Guide ═══════════ */}
      <section className="w-full max-w-5xl mx-auto px-4 py-12 sm:py-16 overflow-hidden">
        <div className="w-full max-w-xl mx-auto text-center mb-8 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">How It Works</h2>
          <p className="mt-2 text-slate-500 text-xs sm:text-sm md:text-base leading-relaxed px-2 break-words">
            Prepare your questions in a simple JSON format, load it here, and start
            practising — it&rsquo;s that easy.
          </p>
        </div>

        {/* Step cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-10 sm:mb-12">
          {[
            {
              icon: <FileJson className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-600" />,
              title: '1. Write JSON',
              desc: 'Create a JSON file with your test title and an array of questions.',
            },
            {
              icon: <Upload className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-600" />,
              title: '2. Load & Validate',
              desc: 'Paste or upload the file. We validate every field in real time.',
            },
            {
              icon: <Play className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-600" />,
              title: '3. Take the Test',
              desc: 'Choose Exam or Practice mode and start. Results & analytics appear instantly.',
            },
          ].map((step) => (
            <div
              key={step.title}
              className="bg-white rounded-2xl p-5 sm:p-6 shadow-xs border border-slate-200/80 hover:shadow-md transition-shadow"
            >
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-indigo-50 flex items-center justify-center mb-3 sm:mb-4">
                {step.icon}
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800">{step.title}</h3>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>

        {/* JSON format guide */}
        <div className="w-full bg-white rounded-2xl shadow-xs border border-slate-200/80 p-4 sm:p-6 md:p-8 overflow-hidden">
          <h3 className="flex items-center gap-2 text-lg sm:text-xl font-bold text-slate-800 mb-3 sm:mb-4">
            <BookOpen className="w-5 h-5 text-indigo-600 shrink-0" />
            JSON Format Guide
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mb-4 leading-relaxed break-words">
            Each question object in the <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-700 text-xs font-mono break-all">questions</code> array
            supports the following fields:
          </p>

          <div className="w-full overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-[520px] w-full text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-600">
                  <th className="px-3.5 py-2.5 font-semibold">Field</th>
                  <th className="px-3.5 py-2.5 font-semibold">Type</th>
                  <th className="px-3.5 py-2.5 font-semibold">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                <tr>
                  <td className="px-3.5 py-2.5 font-mono text-indigo-700 text-xs font-bold">title</td>
                  <td className="px-3.5 py-2.5">string</td>
                  <td className="px-3.5 py-2.5">Test title (e.g. "GATE CS Practice Set 1" or "JEE Mains Full Mock 1")</td>
                </tr>
                <tr>
                  <td className="px-3.5 py-2.5 font-mono text-indigo-700 text-xs font-bold">defaultSubject</td>
                  <td className="px-3.5 py-2.5">string (optional)</td>
                  <td className="px-3.5 py-2.5">Test-level default subject applied if question lacks one</td>
                </tr>
                <tr>
                  <td className="px-3.5 py-2.5 font-mono text-indigo-700 text-xs font-bold">defaultTopic</td>
                  <td className="px-3.5 py-2.5">string (optional)</td>
                  <td className="px-3.5 py-2.5">Test-level default topic applied if question lacks one</td>
                </tr>
                <tr>
                  <td className="px-3.5 py-2.5 font-mono text-indigo-700 text-xs font-bold">id</td>
                  <td className="px-3.5 py-2.5">number</td>
                  <td className="px-3.5 py-2.5">Unique question identifier</td>
                </tr>
                <tr>
                  <td className="px-3.5 py-2.5 font-mono text-indigo-700 text-xs font-bold">type</td>
                  <td className="px-3.5 py-2.5">"MCQ" | "MSQ" | "NAT"</td>
                  <td className="px-3.5 py-2.5">
                    <strong>MCQ</strong> = single-correct, <strong>MSQ</strong> = multi-select, <strong>NAT</strong> = numerical answer
                  </td>
                </tr>
                <tr>
                  <td className="px-3.5 py-2.5 font-mono text-indigo-700 text-xs font-bold">marks</td>
                  <td className="px-3.5 py-2.5">1 | 2 (GATE) or 4 (JEE)</td>
                  <td className="px-3.5 py-2.5">Mark value matching GATE / JEE Mains blueprint</td>
                </tr>
                <tr>
                  <td className="px-3.5 py-2.5 font-mono text-indigo-700 text-xs font-bold">subject</td>
                  <td className="px-3.5 py-2.5">string (optional)</td>
                  <td className="px-3.5 py-2.5">Subject name (e.g. "Data Structures", "Operating Systems")</td>
                </tr>
                <tr>
                  <td className="px-3.5 py-2.5 font-mono text-indigo-700 text-xs font-bold">topic</td>
                  <td className="px-3.5 py-2.5">string (optional)</td>
                  <td className="px-3.5 py-2.5">Topic name (e.g. "Stacks &amp; Queues", "Virtual Memory")</td>
                </tr>
                <tr>
                  <td className="px-3.5 py-2.5 font-mono text-indigo-700 text-xs font-bold">question</td>
                  <td className="px-3.5 py-2.5">string</td>
                  <td className="px-3.5 py-2.5">The question text</td>
                </tr>
                <tr>
                  <td className="px-3.5 py-2.5 font-mono text-indigo-700 text-xs font-bold">options</td>
                  <td className="px-3.5 py-2.5">string[]</td>
                  <td className="px-3.5 py-2.5">Required for MCQ &amp; MSQ (min 2 items). Omit for NAT.</td>
                </tr>
                <tr>
                  <td className="px-3.5 py-2.5 font-mono text-indigo-700 text-xs font-bold">answer</td>
                  <td className="px-3.5 py-2.5">number | number[] | &#123;min, max&#125;</td>
                  <td className="px-3.5 py-2.5">
                    MCQ → 0-based index; MSQ → array of indices; NAT → number or range
                  </td>
                </tr>
                <tr>
                  <td className="px-3.5 py-2.5 font-mono text-indigo-700 text-xs font-bold">solution</td>
                  <td className="px-3.5 py-2.5">string</td>
                  <td className="px-3.5 py-2.5">Explanation shown after the test (supports KaTeX $math$ and code blocks)</td>
                </tr>
                <tr>
                  <td className="px-3.5 py-2.5 font-mono text-indigo-700 text-xs font-bold">imageUrl</td>
                  <td className="px-3.5 py-2.5">string (optional)</td>
                  <td className="px-3.5 py-2.5">Question diagram image URL (CDN, GitHub, or local asset) with click-to-zoom Lightbox</td>
                </tr>
                <tr>
                  <td className="px-3.5 py-2.5 font-mono text-indigo-700 text-xs font-bold">solutionImageUrl</td>
                  <td className="px-3.5 py-2.5">string (optional)</td>
                  <td className="px-3.5 py-2.5">Detailed solution figure image URL with click-to-zoom Lightbox</td>
                </tr>
                <tr>
                  <td className="px-3.5 py-2.5 font-mono text-indigo-700 text-xs font-bold">section</td>
                  <td className="px-3.5 py-2.5">"GA" | "SUBJECT"</td>
                  <td className="px-3.5 py-2.5">Optional section tag for official GATE / JEE Mains sectional switching</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* GATE marking rules summary */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-xs sm:text-sm">
            <div className="rounded-xl bg-indigo-50/60 p-3.5 sm:p-4 border border-indigo-100">
              <h4 className="font-bold text-indigo-700 flex items-center gap-1.5 mb-1 text-xs sm:text-sm">
                <Shield className="w-4 h-4 shrink-0" /> Marking Scheme
              </h4>
              <ul className="space-y-0.5 text-slate-600 list-disc list-inside text-xs sm:text-sm">
                <li>MCQ wrong → −⅓ (1-mark) / −⅔ (2-mark)</li>
                <li>MSQ &amp; NAT → no negative marking</li>
              </ul>
            </div>
            <div className="rounded-xl bg-blue-50/60 p-3.5 sm:p-4 border border-blue-100">
              <h4 className="font-bold text-blue-700 flex items-center gap-1.5 mb-1 text-xs sm:text-sm">
                <Timer className="w-4 h-4 shrink-0" /> Auto Timer
              </h4>
              <p className="text-slate-600 text-xs sm:text-sm break-words">
                Duration is auto-calculated: <code className="bg-white px-1 py-0.5 rounded text-[11px] font-mono break-all inline">questions × (180 min / 65)</code> ≈ 2.77 min per question.
              </p>
            </div>
            <div className="rounded-xl bg-emerald-50/60 p-3.5 sm:p-4 border border-emerald-100">
              <h4 className="font-bold text-emerald-700 flex items-center gap-1.5 mb-1 text-xs sm:text-sm">
                <Sparkles className="w-4 h-4 shrink-0" /> MSQ Scoring
              </h4>
              <p className="text-slate-600 text-xs sm:text-sm">
                Full marks only on exact match. Partial answers score 0 (no penalty).
              </p>
            </div>
          </div>

          {/* Master AI Prompting Guide for Generating Error-Free JSON */}
          <div className="mt-8 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 border border-slate-700 p-5 sm:p-7 text-white shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-base sm:text-lg text-white">
                    Master AI Prompt for Converting Papers to JSON
                  </h4>
                  <p className="text-xs text-slate-400">
                    Feed this prompt to ChatGPT, Claude, Gemini, or DeepSeek for 100% error-free question conversion
                  </p>
                </div>
              </div>
              <button
                onClick={handleCopyPrompt}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer shrink-0"
              >
                {copiedPrompt ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-emerald-300" />
                    <span>Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Complete AI Prompt</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick Syntax Rules Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 mb-5 text-[11px]">
              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
                <span className="font-bold text-indigo-300 block mb-1">1. MCQ</span>
                <span className="text-slate-400">answer: <code className="text-emerald-400 font-mono">0..3</code> (0-indexed int)</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
                <span className="font-bold text-indigo-300 block mb-1">2. MSQ</span>
                <span className="text-slate-400">answer: <code className="text-emerald-400 font-mono">[0, 2]</code> (int array)</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
                <span className="font-bold text-indigo-300 block mb-1">3. NAT</span>
                <span className="text-slate-400">answer: <code className="text-emerald-400 font-mono">10</code> or <code className="text-emerald-400 font-mono">{"{min, max}"}</code></span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
                <span className="font-bold text-indigo-300 block mb-1">4. LaTeX Math</span>
                <span className="text-slate-400"><code className="text-emerald-400 font-mono">$...$</code> with <code className="text-amber-300 font-mono">\\escapes</code></span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
                <span className="font-bold text-indigo-300 block mb-1">5. Tables</span>
                <span className="text-slate-400">Markdown <code className="text-emerald-400 font-mono">| col | col |</code></span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
                <span className="font-bold text-indigo-300 block mb-1">6. Fill Blank</span>
                <span className="text-slate-400">Six underscores <code className="text-emerald-400 font-mono">______</code></span>
              </div>
            </div>

            {/* Prompt Codebox */}
            <div className="relative rounded-xl bg-slate-950 border border-slate-800 p-3.5 text-xs font-mono text-emerald-300 leading-relaxed overflow-x-auto max-h-56 overflow-y-auto select-all">
              <pre className="whitespace-pre-wrap">{AI_SYSTEM_PROMPT}</pre>
            </div>
            <p className="text-[11px] text-slate-400 mt-2.5 flex items-center gap-1.5">
              <span>✦</span> <strong>Pro-Tip:</strong> Attach your PDF or photo of questions in ChatGPT / Claude alongside this prompt to receive instant, validated JSON with all matrices, equations, and tables properly structured.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════ Interactive Example JSON ═══════════ */}
      <section className="bg-slate-800 text-white w-full overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 py-12 sm:py-16">
          <h2 className="text-2xl sm:text-3xl font-bold mb-2">Example JSON</h2>
          <p className="text-slate-400 mb-6 text-xs sm:text-sm">
            Copy this sample, tweak it with your own questions, and load it below.
          </p>

          <div className="relative rounded-xl bg-slate-900/80 border border-slate-700 overflow-hidden w-full max-w-full">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 border-b border-slate-700 text-xs text-slate-400">
              <FileJson className="w-4 h-4" />
              gate-sample-test.json
            </div>
            <pre className="w-full max-w-full overflow-x-auto p-3 sm:p-4 text-xs sm:text-sm leading-relaxed max-h-96 overflow-y-auto">
              <code className="text-emerald-300">{sampleJSONString}</code>
            </pre>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy Example JSON
                </>
              )}
            </button>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Download Example JSON
            </button>
            <button
              onClick={handleTrySample}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            >
              <Play className="w-4 h-4" />
              Try Sample Test
            </button>
          </div>
        </div>
      </section>

      {/* ═══════════ JSON Loader & Validator ═══════════ */}
      <section id="loader" className="max-w-5xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-slate-800">Load Your Test</h2>
          <p className="mt-2 text-slate-500 max-w-lg mx-auto">
            Paste JSON or upload a <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">.json</code> file.
            We validate it in real time.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-slate-100">
            <button
              onClick={() => setActiveTab('paste')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'paste'
                  ? 'text-indigo-700 border-b-2 border-indigo-600 bg-indigo-50/40'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <ClipboardPaste className="w-4 h-4" />
              Paste JSON
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'upload'
                  ? 'text-indigo-700 border-b-2 border-indigo-600 bg-indigo-50/40'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Upload className="w-4 h-4" />
              Upload File
            </button>
          </div>

          <div className="p-6">
            {activeTab === 'paste' ? (
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder='{\n  "title": "My GATE Test",\n  "questions": [ ... ]\n}'
                className="w-full h-56 font-mono text-sm bg-slate-50 border border-slate-200 rounded-xl p-4 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-shadow placeholder:text-slate-400"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-56 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl">
                <Upload className="w-8 h-8 text-slate-400 mb-2" />
                <p className="text-sm text-slate-500 mb-3">
                  {fileName ? (
                    <>
                      Loaded: <span className="font-medium text-slate-700">{fileName}</span>
                    </>
                  ) : (
                    'Select a .json file'
                  )}
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  Choose File
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            )}

            {/* Validation feedback */}
            {syntaxError && (
              <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{syntaxError}</span>
              </div>
            )}

            {validationErrors.length > 0 && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 text-sm">
                <div className="flex items-center gap-2 text-red-700 font-semibold mb-2">
                  <AlertCircle className="w-5 h-5" />
                  Validation Errors ({validationErrors.length})
                </div>
                <ul className="space-y-1 text-red-600 list-disc list-inside">
                  {validationErrors.map((err, i) => (
                    <li key={i}>{err.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {validatedData && (
              <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm">
                <div className="flex items-center gap-2 text-emerald-700 font-semibold mb-3">
                  <CheckCircle className="w-5 h-5" />
                  Valid — Ready to Start
                </div>

                {ingestStatus && (
                  <div className="mb-3 p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-700 flex items-center gap-2">
                    <Database className="w-4 h-4 shrink-0" />
                    <span>{ingestStatus}</span>
                  </div>
                )}

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <SummaryCard
                    icon={<BookOpen className="w-4 h-4" />}
                    label="Test Title"
                    value={validatedData.title}
                  />
                  {validatedData.subject && (
                    <SummaryCard
                      icon={<BookOpen className="w-4 h-4" />}
                      label="Subject"
                      value={validatedData.subject}
                    />
                  )}
                  {validatedData.topic && (
                    <SummaryCard
                      icon={<List className="w-4 h-4" />}
                      label="Topic"
                      value={validatedData.topic}
                    />
                  )}
                  <SummaryCard
                    icon={<Hash className="w-4 h-4" />}
                    label="Total Questions"
                    value={String(validatedData.questions.length)}
                  />
                  <SummaryCard
                    icon={<Calculator className="w-4 h-4" />}
                    label="Total Marks"
                    value={String(getTotalMarks(validatedData))}
                  />
                  {(['MCQ', 'MSQ', 'NAT'] as const).map((type) => {
                    const count = getQuestionTypeCounts(validatedData)[type];
                    if (count === 0) return null;
                    return (
                      <SummaryCard
                        key={type}
                        icon={<List className="w-4 h-4" />}
                        label={type}
                        value={`${count} question${count > 1 ? 's' : ''}`}
                      />
                    );
                  })}
                  <SummaryCard
                    icon={<Clock className="w-4 h-4" />}
                    label="Duration"
                    value={formatDurationHuman(
                      Number(validatedData.duration || (validatedData as any).durationMinutes) > 0
                        ? Math.round(Number(validatedData.duration || (validatedData as any).durationMinutes) * 60)
                        : calculateDuration(validatedData.questions.length)
                    )}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════ Mode Selection ═══════════ */}
      <section className="max-w-5xl mx-auto px-4 pb-8">
        <h2 className="text-2xl font-bold text-slate-800 text-center mb-6">Select Mode</h2>

        <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
          <ModeCard
            active={mode === 'exam'}
            onClick={() => setMode('exam')}
            icon={<GraduationCap className="w-6 h-6" />}
            title="Exam Mode"
            description="Official CBT exam experience with timer, navigation panel, official marking blueprints, and instant performance analysis."
            badge="Default"
          />
          <ModeCard
            active={mode === 'practice'}
            onClick={() => setMode('practice')}
            icon={<BookOpen className="w-6 h-6" />}
            title="Practice Mode"
            description="Check your answer instantly after each question. Great for learning — no time pressure."
          />
        </div>
      </section>

      {/* ═══════════ Start Test Button ═══════════ */}
      <section className="max-w-5xl mx-auto px-4 pb-20 text-center">
        <button
          disabled={!validatedData}
          onClick={handleStartTest}
          className={`inline-flex items-center gap-2.5 px-8 py-4 text-lg font-bold rounded-2xl shadow-lg transition-all cursor-pointer ${
            validatedData
              ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-xl active:scale-[0.98]'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
          }`}
        >
          <Play className="w-5 h-5" />
          Start Test
        </button>
        {!validatedData && !hasErrors && (
          <p className="mt-3 text-sm text-slate-400">Load a valid JSON above to enable this button.</p>
        )}
        {hasErrors && (
          <p className="mt-3 text-sm text-red-500">Fix the errors above before starting.</p>
        )}
      </section>

      {/* ═══════════ Footer ═══════════ */}
      <footer className="border-t border-slate-200 py-8 bg-white text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/logo.avif" alt="Abhiyantra Logo" className="w-8 h-8 object-contain rounded-lg" />
            <span className="font-bold text-slate-800 text-sm">abhiyantra</span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-500">Competitive Examination Portal (GATE &amp; JEE Mains)</span>
          </div>
          <p className="text-slate-400">
            &copy; {new Date().getFullYear()} abhiyantra. All rights reserved.
          </p>
        </div>
      </footer>

      {/* 0% Fee UPI Paywall Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={() => {
          setShowPaymentModal(false);
          handleStartTest();
        }}
      />
    </div>
  );
}

/* ────────── Sub-components ────────── */

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-emerald-100">
      <div className="text-emerald-600">{icon}</div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-emerald-500 font-semibold">
          {label}
        </div>
        <div className="text-slate-800 font-medium truncate">{value}</div>
      </div>
    </div>
  );
}

function ModeCard({
  active,
  onClick,
  icon,
  title,
  description,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative text-left p-5 rounded-2xl border-2 transition-all cursor-pointer ${
        active
          ? 'border-indigo-600 bg-indigo-50 shadow-md'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      {badge && (
        <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
          active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
        }`}
      >
        {icon}
      </div>
      <h3 className={`text-base font-semibold ${active ? 'text-indigo-700' : 'text-slate-800'}`}>
        {title}
      </h3>
      <p className="mt-1 text-sm text-slate-500 leading-relaxed">{description}</p>
    </button>
  );
}
