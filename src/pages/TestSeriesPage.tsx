import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { PaymentModal } from '../components/PaymentModal';
import { useAuth } from '../context/AuthContext';
import {
  fetchOfficialTestSeriesApi,
  fetchOfficialTestByIdApi,
  uploadOfficialTestSeriesApi,
  deleteTestSeriesApi,
  fetchPricingPlansApi,
} from '../utils/api';
import type { PricingPlan } from '../types';
import {
  Layers,
  Sparkles,
  Clock,
  ShieldCheck,
  Award,
  Upload,
  Play,
  Trash2,
  Lock,
  FileJson,
  AlertCircle,
  Loader2,
  X,
  Search,
  CheckCircle,
  GraduationCap,
  Atom,
  Calculator,
  Copy,
  Check,
  Image as ImageIcon,
} from 'lucide-react';
import { AI_SYSTEM_PROMPT } from '../utils/sampleData';
import { AttachDiagramsModal } from '../components/AttachDiagramsModal';

interface OfficialTestItem {
  id: string;
  title: string;
  description: string | null;
  category: string;
  examCategory?: string;
  subject: string | null;
  totalQuestions: number;
  totalMarks: number;
  durationMinutes: number;
  creatorRole: string;
  isOfficial?: boolean;
  createdAt: string;
  creator?: {
    name: string;
    email: string;
    avatarUrl?: string | null;
  };
}

export const TestSeriesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, targetExam } = useAuth();

  const isMasterAdmin = user?.role === 'ADMIN' || user?.email?.toLowerCase() === 'harshsaini0912@gmail.com';
  const isTeacher = user?.role === 'TEACHER';
  const isTeacherOrAdmin = isMasterAdmin || isTeacher;
  const hasAccess = isTeacherOrAdmin || !!(user && user.isSubscribed);

  // Exam category filter (defaults to user active targetExam)
  const [examFilter, setExamFilter] = useState<'GATE' | 'JEE_MAINS'>(targetExam);

  useEffect(() => {
    setExamFilter(targetExam);
  }, [targetExam]);

  // Tests & loading states
  const [tests, setTests] = useState<OfficialTestItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [launchingId, setLaunchingId] = useState<string | null>(null);

  // Filters & search
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Payment modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [boosterPlan, setBoosterPlan] = useState<PricingPlan | null>(null);

  // Upload modal state (Teachers / Admins)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Upload form fields
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadExamCategory, setUploadExamCategory] = useState<'GATE' | 'JEE_MAINS'>(targetExam);
  const [uploadCategory, setUploadCategory] = useState<'FULL_MOCK' | 'SUBJECT_PACK' | 'TOPIC_TEST'>('FULL_MOCK');
  const [uploadSubject, setUploadSubject] = useState('');
  const [uploadDuration, setUploadDuration] = useState<number>(180);
  const [perQuestionMinutes, setPerQuestionMinutes] = useState<number>(2.77);
  const [totalMarks, setTotalMarks] = useState<number>(0);
  const [parsedQuestions, setParsedQuestions] = useState<any[] | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Diagram Manager Modal state
  const [diagramModalOpen, setDiagramModalOpen] = useState(false);
  const [diagramModalTestId, setDiagramModalTestId] = useState<string | undefined>(undefined);
  const [diagramModalTitle, setDiagramModalTitle] = useState<string>('');
  const [diagramModalQuestions, setDiagramModalQuestions] = useState<any[]>([]);
  const [loadingDiagramQuestions, setLoadingDiagramQuestions] = useState(false);

  const handleOpenDiagramManagerForTest = async (testId: string, title: string) => {
    try {
      setLoadingDiagramQuestions(true);
      const res = await fetchOfficialTestByIdApi(testId);
      if (res && res.test && Array.isArray(res.test.questions)) {
        setDiagramModalTestId(testId);
        setDiagramModalTitle(title);
        setDiagramModalQuestions(res.test.questions);
        setDiagramModalOpen(true);
      } else {
        alert('Could not find questions for this test.');
      }
    } catch (err: any) {
      alert(`Failed to load test questions: ${err?.message || 'Error'}`);
    } finally {
      setLoadingDiagramQuestions(false);
    }
  };

  const handleOpenDiagramManagerForUpload = () => {
    if (!parsedQuestions || parsedQuestions.length === 0) return;
    setDiagramModalTestId(undefined);
    setDiagramModalTitle(uploadTitle || 'Uploaded Test Paper');
    setDiagramModalQuestions(parsedQuestions);
    setDiagramModalOpen(true);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(AI_SYSTEM_PROMPT);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch {
      // ignore
    }
  };

  const resetUploadForm = () => {
    setIsUploadModalOpen(false);
    setParsedQuestions(null);
    setFileName('');
    setUploadError(null);
    setUploadSuccess(null);
    setUploadTitle('');
    setUploadDescription('');
    setUploadSubject('');
    setUploadDuration(180);
    setPerQuestionMinutes(2.77);
    setTotalMarks(0);
  };

  // Fetch official tests & pricing plans on mount
  const loadOfficialTests = async () => {
    try {
      setLoading(true);
      const res = await fetchOfficialTestSeriesApi(examFilter);
      setTests(res.tests || []);
    } catch (err) {
      console.warn('Failed to load official test series:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOfficialTests();
  }, [examFilter]);

  useEffect(() => {
    fetchPricingPlansApi()
      .then((data) => {
        const plan29 = (data.plans || []).find(
          (p: any) => p.id === 'gate-booster-pass' || p.price === 29
        );
        if (plan29) {
          setBoosterPlan(plan29);
        } else if (data.plans && data.plans.length > 0) {
          setBoosterPlan(data.plans[0]);
        }
      })
      .catch(() => {});
  }, []);

  // Sync Duration when Per-Question Time is modified
  const handlePerQuestionMinutesChange = (minutesPerQ: number) => {
    const validMinutes = Math.max(0.1, Number(minutesPerQ) || 0.1);
    setPerQuestionMinutes(validMinutes);
    if (parsedQuestions && parsedQuestions.length > 0) {
      setUploadDuration(Math.max(1, Math.round(validMinutes * parsedQuestions.length)));
    }
  };

  // Sync Per-Question Time when Duration is modified
  const handleDurationChange = (totalMinutes: number) => {
    const validTotal = Math.max(1, Number(totalMinutes) || 1);
    setUploadDuration(validTotal);
    if (parsedQuestions && parsedQuestions.length > 0) {
      setPerQuestionMinutes(Number((validTotal / parsedQuestions.length).toFixed(2)));
    }
  };

  const applyPacingPreset = (minutesPerQ: number) => {
    handlePerQuestionMinutesChange(minutesPerQ);
  };

  const handleExamCategoryChange = (newExam: 'GATE' | 'JEE_MAINS') => {
    setUploadExamCategory(newExam);
    if (parsedQuestions && parsedQuestions.length > 0) {
      // Recalculate marks and standard pacing if appropriate
      const newMarks = parsedQuestions.reduce((sum, q) => {
        const m = Number(q.marks) || Number(q.mark) || Number(q.weightage);
        if (m && !isNaN(m) && m > 0) return sum + m;
        return sum + (newExam === 'JEE_MAINS' ? 4 : 1);
      }, 0);
      setTotalMarks(newMarks);
    }
  };

  // Handle JSON file selection with auto-fetch and auto-fill
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setUploadError(null);
    setUploadSuccess(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawContent = event.target?.result as string;
        const parsed = JSON.parse(rawContent);

        // 1. Extract Questions array
        let questions: any[] = [];
        if (Array.isArray(parsed)) {
          questions = parsed;
        } else if (parsed && Array.isArray(parsed.questions)) {
          questions = parsed.questions;
        } else if (parsed && Array.isArray(parsed.test?.questions)) {
          questions = parsed.test.questions;
        } else if (parsed && Array.isArray(parsed.testData?.questions)) {
          questions = parsed.testData.questions;
        } else if (parsed && Array.isArray(parsed.data?.questions)) {
          questions = parsed.data.questions;
        } else if (parsed && Array.isArray(parsed.items)) {
          questions = parsed.items;
        } else if (parsed && typeof parsed.questions === 'object' && parsed.questions !== null) {
          questions = Object.values(parsed.questions);
        }

        if (questions.length === 0) {
          setUploadError('Invalid JSON file: No questions array found in this paper.');
          setParsedQuestions(null);
          return;
        }

        const count = questions.length;

        // 2. Auto-detect Target Examination (GATE vs JEE Mains)
        const textToAnalyze = `${file.name} ${parsed.title || ''} ${parsed.description || ''} ${parsed.subject || ''} ${parsed.test?.title || ''}`.toLowerCase();
        let detectedExam: 'GATE' | 'JEE_MAINS' = 'GATE';
        if (
          parsed.examCategory === 'JEE_MAINS' ||
          parsed.targetExam === 'JEE_MAINS' ||
          parsed.test?.examCategory === 'JEE_MAINS' ||
          parsed.testData?.examCategory === 'JEE_MAINS'
        ) {
          detectedExam = 'JEE_MAINS';
        } else if (
          parsed.examCategory === 'GATE' ||
          parsed.targetExam === 'GATE' ||
          parsed.test?.examCategory === 'GATE' ||
          parsed.testData?.examCategory === 'GATE'
        ) {
          detectedExam = 'GATE';
        } else if (/jee|mains|iit-jee|jee-main|pcm/i.test(textToAnalyze)) {
          detectedExam = 'JEE_MAINS';
        } else if (/gate|gate-cs|gate-da|gate-me|gate-ee|gate-ec/i.test(textToAnalyze)) {
          detectedExam = 'GATE';
        } else if (count === 75) {
          detectedExam = 'JEE_MAINS';
        } else if (count === 65) {
          detectedExam = 'GATE';
        } else {
          detectedExam = examFilter || targetExam || 'GATE';
        }

        // 3. Auto-calculate Total Marks
        const computedMarks = questions.reduce((sum, q) => {
          const m = Number(q.marks) || Number(q.mark) || Number(q.weightage);
          if (m && !isNaN(m) && m > 0) return sum + m;
          return sum + (detectedExam === 'JEE_MAINS' ? 4 : 1);
        }, 0);

        // 4. Auto-detect Subject
        let detectedSubject = parsed.subject || parsed.test?.subject || parsed.testData?.subject || '';
        if (!detectedSubject) {
          const subjectCounts = new Map<string, number>();
          for (const q of questions) {
            const sub = typeof q.subject === 'string' ? q.subject.trim() : (q.subject?.name ? String(q.subject.name).trim() : null);
            if (sub && !sub.toLowerCase().includes('general aptitude')) {
              subjectCounts.set(sub, (subjectCounts.get(sub) || 0) + 1);
            }
          }
          if (subjectCounts.size === 1) {
            detectedSubject = Array.from(subjectCounts.keys())[0];
          } else if (subjectCounts.size > 1) {
            const sorted = Array.from(subjectCounts.entries()).sort((a, b) => b[1] - a[1]);
            if (sorted[0][1] >= count * 0.6) {
              detectedSubject = sorted[0][0];
            } else if (detectedExam === 'JEE_MAINS') {
              detectedSubject = 'Physics, Chemistry & Math';
            } else {
              detectedSubject = 'Full Syllabus Mix';
            }
          }
        }

        // 5. Auto-fetch or calculate Per-Question Time and Total Duration
        let calculatedDuration = 180;
        let calculatedPerQMin = detectedExam === 'JEE_MAINS' ? 2.4 : 2.77;

        const rawDuration =
          parsed.duration ||
          parsed.durationMinutes ||
          parsed.totalDuration ||
          parsed.time ||
          parsed.test?.duration ||
          parsed.test?.durationMinutes ||
          parsed.testData?.duration;

        const rawPerQSec =
          parsed.perQuestionTime ||
          parsed.timePerQuestion ||
          parsed.secondsPerQuestion ||
          parsed.perQuestionSeconds ||
          parsed.test?.perQuestionTime ||
          parsed.test?.timePerQuestion;

        const rawPerQMin = parsed.minutesPerQuestion || parsed.perQuestionMinutes || parsed.test?.perQuestionMinutes;

        const individualQuestionTimes = questions
          .map((q) => Number(q.timeInSeconds || q.timeLimit || q.durationSeconds || q.allottedSeconds || (q.durationMinutes ? q.durationMinutes * 60 : 0)))
          .filter((t) => t > 0);

        if (rawDuration && Number(rawDuration) > 0) {
          calculatedDuration = Math.round(Number(rawDuration));
          calculatedPerQMin = Number((calculatedDuration / count).toFixed(2));
        } else if (rawPerQSec && Number(rawPerQSec) > 0) {
          calculatedPerQMin = Number((Number(rawPerQSec) / 60).toFixed(2));
          calculatedDuration = Math.max(5, Math.round(calculatedPerQMin * count));
        } else if (rawPerQMin && Number(rawPerQMin) > 0) {
          calculatedPerQMin = Number(Number(rawPerQMin).toFixed(2));
          calculatedDuration = Math.max(5, Math.round(calculatedPerQMin * count));
        } else if (individualQuestionTimes.length === count) {
          const sumSec = individualQuestionTimes.reduce((a, b) => a + b, 0);
          calculatedDuration = Math.max(5, Math.round(sumSec / 60));
          calculatedPerQMin = Number((calculatedDuration / count).toFixed(2));
        } else {
          // Standard Examination Formulas
          if (count === 65 && detectedExam === 'GATE') {
            calculatedDuration = 180;
            calculatedPerQMin = 2.77;
          } else if (count === 75 && detectedExam === 'JEE_MAINS') {
            calculatedDuration = 180;
            calculatedPerQMin = 2.4;
          } else if (detectedExam === 'JEE_MAINS') {
            calculatedPerQMin = 2.4;
            calculatedDuration = Math.max(5, Math.round(count * 2.4));
          } else {
            calculatedPerQMin = 2.77;
            calculatedDuration = Math.max(5, Math.round(count * (180 / 65)));
          }
        }

        // 6. Infer Category
        let detectedCategory: 'FULL_MOCK' | 'SUBJECT_PACK' | 'TOPIC_TEST' = 'FULL_MOCK';
        if (parsed.category === 'SUBJECT_PACK' || parsed.category === 'TOPIC_TEST' || parsed.category === 'FULL_MOCK') {
          detectedCategory = parsed.category;
        } else if (count >= 50 || (detectedExam === 'GATE' && count >= 60) || (detectedExam === 'JEE_MAINS' && count >= 70)) {
          detectedCategory = 'FULL_MOCK';
        } else if (count >= 15) {
          detectedCategory = 'SUBJECT_PACK';
        } else {
          detectedCategory = 'TOPIC_TEST';
        }

        // 7. Format clean Title
        let cleanTitle = parsed.title || parsed.test?.title || parsed.testData?.title || parsed.name || '';
        if (!cleanTitle) {
          const baseName = file.name
            .replace(/\.[^/.]+$/, '')
            .replace(/[-_]+/g, ' ')
            .trim();
          cleanTitle = baseName
            .split(' ')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
        }

        // 8. Format clean Description
        let cleanDesc = parsed.description || parsed.test?.description || parsed.testData?.description || '';
        if (!cleanDesc) {
          cleanDesc = `Official ${detectedExam === 'JEE_MAINS' ? 'JEE Mains (NTA Pattern)' : 'GATE (IIT Pattern)'} ${
            detectedCategory === 'FULL_MOCK' ? 'Full Mock Test' : detectedSubject ? `${detectedSubject} Test` : 'Mock Test'
          } containing ${count} questions (${computedMarks} Marks). Allocated test duration: ${calculatedDuration} minutes (~${calculatedPerQMin} min/question).`;
        }

        // 9. Normalize questions to ensure solution, explanation, questionText and id are populated
        const normalizedQuestions = questions.map((q: any, idx: number) => {
          const sol = (q.solution || q.explanation || q.detailedSolution || q.solutionText || q.rationale || '').toString().trim();
          const qText = (q.question || q.questionText || q.text || q.statement || '').toString().trim();
          return {
            ...q,
            id: q.id !== undefined ? q.id : idx + 1,
            question: qText,
            questionText: qText,
            solution: sol,
            explanation: sol,
          };
        });

        setParsedQuestions(normalizedQuestions);
        setUploadExamCategory(detectedExam);
        setTotalMarks(computedMarks);
        setUploadTitle(cleanTitle);
        setUploadDescription(cleanDesc);
        setUploadSubject(detectedSubject);
        setUploadCategory(detectedCategory);
        setUploadDuration(calculatedDuration);
        setPerQuestionMinutes(calculatedPerQMin);
      } catch (err: any) {
        setUploadError(`Failed to parse JSON file: ${err.message}`);
        setParsedQuestions(null);
      }
    };
    reader.onerror = () => {
      setUploadError('Failed to read the selected file.');
    };
    reader.readAsText(file);
  };

  // Submit official test upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedQuestions || parsedQuestions.length === 0) {
      setUploadError('Please select a valid JSON test paper file.');
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);

      await uploadOfficialTestSeriesApi({
        title: uploadTitle.trim() || (uploadExamCategory === 'JEE_MAINS' ? 'Official JEE Mains Test Paper' : 'Official GATE Test Paper'),
        description: uploadDescription.trim(),
        category: uploadCategory,
        examCategory: uploadExamCategory,
        subject: uploadSubject.trim() || undefined,
        testData: {
          title: uploadTitle.trim(),
          description: uploadDescription.trim(),
          examCategory: uploadExamCategory,
          duration: Number(uploadDuration) || 180,
          questions: parsedQuestions,
        },
      });

      setUploadSuccess('Test paper published successfully to GATE Test Series!');
      setTimeout(() => {
        setIsUploadModalOpen(false);
        setUploadSuccess(null);
        setParsedQuestions(null);
        setFileName('');
        loadOfficialTests();
      }, 1200);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload test series.');
    } finally {
      setUploading(false);
    }
  };

  // Launch official test paper in CBT Exam
  const handleLaunchOfficialTest = async (testId: string, mode: 'exam' | 'practice') => {
    try {
      setLaunchingId(testId);
      const res = await fetchOfficialTestByIdApi(testId);
      if (res && res.test) {
        navigate('/test', { state: { testData: res.test, mode } });
      } else {
        alert('Could not load test paper details.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to start test.');
    } finally {
      setLaunchingId(null);
    }
  };

  // Delete official test paper (Teachers / Admins only)
  const handleDeleteTest = async (testId: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete official test "${title}"?`)) {
      return;
    }
    try {
      await deleteTestSeriesApi(testId);
      setTests((prev) => prev.filter((t) => t.id !== testId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete test.');
    }
  };

  // Filtered test items
  const filteredTests = tests.filter((t) => {
    const matchesCat = selectedCategory === 'ALL' || t.category === selectedCategory;
    const matchesQuery =
      searchQuery.trim() === '' ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.subject && t.subject.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesQuery;
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      {/* Hero Header */}
      <section className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white py-12 sm:py-16 px-4 sm:px-6 lg:px-8 border-b border-indigo-900/50 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.2),transparent_60%)] pointer-events-none" />

        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
          <div className="space-y-4 text-center md:text-left max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
              {examFilter === 'JEE_MAINS' ? (
                <>
                  <Atom className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Teacher-Curated JEE Mains 2026/2027 Papers</span>
                </>
              ) : (
                <>
                  <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Teacher-Curated GATE 2026/2027 Papers</span>
                </>
              )}
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
              {examFilter === 'JEE_MAINS' ? 'Official JEE Mains Test Series' : 'Official GATE Test Series'}
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              {examFilter === 'JEE_MAINS'
                ? 'Full 75-question mock simulations and subject packs (Physics, Chemistry, Mathematics). Modeled strictly after the NTA CBT interface with +4 / -1 marking and section-wise analysis.'
                : 'Full-length 65-question mocks and sectional subject packs crafted strictly by IIT & GATE faculty. Experience the identical TCS-iON CBT screen, official marking scheme, and real-time percentile analysis.'}
            </p>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2 text-xs text-slate-300 font-medium">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                {examFilter === 'JEE_MAINS' ? 'Authentic NTA JEE Pattern' : 'Authentic GATE IIT Pattern'}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" />
                180-Minute Full Timer
              </span>
              <span className="flex items-center gap-1.5">
                <Award className="w-4 h-4 text-indigo-400" />
                {examFilter === 'JEE_MAINS' ? 'Physics · Chemistry · Maths' : 'CS / IT / Aptitude / Math'}
              </span>
            </div>
          </div>

          {/* Action CTAs on Hero */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-3 w-full sm:w-auto shrink-0">
            {isTeacherOrAdmin && (
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Test Series (.json)</span>
              </button>
            )}

            {!isTeacherOrAdmin && (
              <button
                onClick={() => {
                  const adminProfile = {
                    id: 'admin_harshsaini0912',
                    email: 'harshsaini0912@gmail.com',
                    name: 'Harsh Saini (Admin)',
                    role: 'ADMIN' as const,
                    isSubscribed: true,
                    targetExam: 'GATE' as const,
                  };
                  localStorage.setItem('abhiyantra_user_profile', JSON.stringify(adminProfile));
                  window.location.reload();
                }}
                className="px-4 py-2.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 font-bold rounded-xl text-xs border border-indigo-400/40 transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>🔑 Switch to Faculty/Admin View</span>
              </button>
            )}

            {!hasAccess ? (
              <button
                onClick={() => setIsPaymentModalOpen(true)}
                className="px-6 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <Sparkles className="w-4 h-4" />
                <span>Unlock All Papers (₹29)</span>
              </button>
            ) : (
              <div className="px-4 py-3 bg-emerald-950/60 border border-emerald-500/30 rounded-2xl text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>All Official Series Unlocked</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        {/* Banner for Free Users */}
        {!hasAccess && (
          <div className="bg-gradient-to-r from-indigo-50 via-white to-amber-50 border border-indigo-200/80 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0">
                <Lock className="w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <h3 className="font-bold text-sm sm:text-base text-slate-900">
                  Unlock Full Access to All Teacher-Made Test Series
                </h3>
                <p className="text-xs text-slate-600">
                  Get instant unlimited access for just <strong className="text-indigo-700">₹29</strong> (Subject & Topic Booster) or <strong className="text-indigo-700">₹59</strong> (Complete Pro Pass with Personal Test Builder).
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsPaymentModalOpen(true)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all shrink-0 cursor-pointer"
            >
              Unlock Now for ₹29 &rarr;
            </button>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Exam Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setExamFilter('GATE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  examFilter === 'GATE' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>GATE</span>
              </button>
              <button
                onClick={() => setExamFilter('JEE_MAINS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  examFilter === 'JEE_MAINS' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Atom className="w-3.5 h-3.5" />
                <span>JEE Mains</span>
              </button>
            </div>

            {/* Category Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'ALL', label: 'All Series' },
                { id: 'FULL_MOCK', label: examFilter === 'JEE_MAINS' ? 'Full Mocks (75 Qs)' : 'Full Mocks (65 Qs)' },
                { id: 'SUBJECT_PACK', label: 'Subject Packs' },
                { id: 'TOPIC_TEST', label: 'Chapter Tests' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedCategory === cat.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by test name or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white"
            />
          </div>
        </div>

        {/* Test Cards Grid */}
        {loading ? (
          <div className="bg-white rounded-3xl p-16 border border-slate-200/80 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-xs font-bold text-slate-600">Loading official teacher-made test series...</p>
          </div>
        ) : filteredTests.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-10 sm:p-14 text-center shadow-xs space-y-6">
            <div className="w-20 h-20 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-100 shadow-inner">
              <Layers className="w-10 h-10" />
            </div>

            <div className="space-y-2 max-w-md mx-auto">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                {tests.length === 0 ? 'Official Test Series Under Preparation' : 'No Matching Tests Found'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                {tests.length === 0
                  ? 'Faculty mock tests and national level papers are being curated. Check back soon or upload new papers if you are an instructor.'
                  : 'Try adjusting your search query or switching categories.'}
              </p>
            </div>

            {isTeacherOrAdmin && (
              <div className="pt-2">
                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload First Test Series (.json)</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTests.map((test) => (
              <div
                key={test.id}
                className={`bg-white rounded-3xl border p-6 shadow-xs hover:shadow-lg transition-all flex flex-col justify-between space-y-5 relative overflow-hidden ${
                  hasAccess
                    ? 'border-slate-200/80 hover:border-indigo-400'
                    : 'border-slate-200 bg-slate-50/50'
                }`}
              >
                <div className="space-y-3.5">
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold tracking-wider border ${
                        test.examCategory === 'JEE_MAINS'
                          ? 'bg-amber-100 text-amber-800 border-amber-200'
                          : 'bg-indigo-100 text-indigo-800 border-indigo-200'
                      }`}>
                        {test.examCategory === 'JEE_MAINS' ? '⚛️ JEE Mains' : '🎓 GATE'}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                        {test.category === 'FULL_MOCK'
                          ? (test.examCategory === 'JEE_MAINS' ? 'Full 75-Q Mock' : 'Full 65-Q Mock')
                          : test.category === 'SUBJECT_PACK'
                          ? 'Subject Pack'
                          : 'Topic Test'}
                      </span>
                      {test.subject && (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {test.subject}
                        </span>
                      )}
                    </div>

                    {isTeacherOrAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenDiagramManagerForTest(test.id, test.title)}
                          disabled={loadingDiagramQuestions}
                          className="px-2 py-1 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 rounded-lg transition cursor-pointer flex items-center gap-1 text-[11px] font-bold shadow-2xs"
                          title="Attach or Manage Diagrams for this Paper"
                        >
                          <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Diagrams</span>
                        </button>
                        <button
                          onClick={() => handleDeleteTest(test.id, test.title)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                          title="Delete Official Test"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="font-bold text-base text-slate-900 tracking-tight line-clamp-2">
                      {test.title}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                      {test.description || 'Teacher-prepared official mock paper for All-India GATE preparation.'}
                    </p>
                  </div>

                  {/* Teacher Info */}
                  <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-600">
                    <GraduationCap className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Faculty Paper</span>
                    {test.creator?.name && (
                      <span className="text-slate-400">· {test.creator.name}</span>
                    )}
                  </div>

                  {/* Test Metrics Grid */}
                  <div className="grid grid-cols-3 gap-2 py-2.5 px-3 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                    <div>
                      <span className="block text-[10px] text-slate-400 font-semibold uppercase">Questions</span>
                      <span className="font-bold text-xs sm:text-sm text-slate-800">{test.totalQuestions}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 font-semibold uppercase">Total Marks</span>
                      <span className="font-bold text-xs sm:text-sm text-slate-800">{test.totalMarks}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 font-semibold uppercase">Duration</span>
                      <span className="font-bold text-xs sm:text-sm text-slate-800">{test.durationMinutes}m</span>
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-2">
                  {hasAccess ? (
                    <div className="flex items-center gap-2">
                      <button
                        disabled={launchingId === test.id}
                        onClick={() => handleLaunchOfficialTest(test.id, 'exam')}
                        className="flex-1 py-3 px-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 transition cursor-pointer disabled:opacity-50"
                      >
                        {launchingId === test.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Play className="w-3.5 h-3.5" />
                        )}
                        <span>Start CBT Exam</span>
                      </button>
                      <button
                        disabled={launchingId === test.id}
                        onClick={() => handleLaunchOfficialTest(test.id, 'practice')}
                        className="py-3 px-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold text-xs transition cursor-pointer disabled:opacity-50"
                      >
                        Practice
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 py-1.5 rounded-xl border border-amber-200/60">
                        <Lock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Included in ₹29 Booster Pass</span>
                      </div>
                      <button
                        onClick={() => setIsPaymentModalOpen(true)}
                        className="w-full py-2.5 px-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 transition cursor-pointer active:scale-98"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Unlock for ₹29</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Upload JSON Modal for Teachers & Admins */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Upload Official Test Series</h3>
                  <p className="text-[11px] text-slate-500">Publish faculty test paper from JSON file</p>
                </div>
              </div>
              <button
                onClick={resetUploadForm}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {/* File Dropzone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Select Test JSON File
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json,application/json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-indigo-200 hover:border-indigo-500 bg-indigo-50/30 hover:bg-indigo-50/60 rounded-2xl p-6 text-center cursor-pointer transition space-y-2"
                >
                  <FileJson className="w-8 h-8 text-indigo-500 mx-auto" />
                  <div className="text-xs font-semibold text-slate-700">
                    {fileName ? (
                      <span className="text-indigo-700 font-bold">{fileName}</span>
                    ) : (
                      <span>Click to select or drop .json file</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Auto-detects questions, per-question pacing, examination type, and calculates duration.
                  </p>
                </div>

                {/* AI Prompt Generator Banner for Faculty */}
                <div className="mt-2.5 flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/90 text-xs">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span className="text-slate-600 text-[11px] font-medium">Using ChatGPT / Claude to convert paper?</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyPrompt}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 rounded-lg text-[11px] shadow-2xs transition cursor-pointer"
                  >
                    {copiedPrompt ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-700">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-indigo-600" />
                        <span>Copy AI Prompt</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Auto-Fetched Test Specifications & Blueprint Card */}
              {parsedQuestions && (
                <div className="bg-gradient-to-br from-indigo-50/90 via-white to-blue-50/70 border border-indigo-200 rounded-2xl p-4 space-y-3 shadow-xs animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-xs">
                        <Calculator className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">Auto-Fetched Paper Blueprint</h4>
                        <p className="text-[10px] text-slate-500">Auto-calculated from uploaded question paper</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                      ✓ Auto-Calculated
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                      <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Questions</span>
                      <span className="font-extrabold text-sm sm:text-base text-slate-900">{parsedQuestions.length} Qs</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                      <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Marks</span>
                      <span className="font-extrabold text-sm sm:text-base text-indigo-700">{totalMarks} M</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                      <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Per-Q Time</span>
                      <span className="font-extrabold text-sm sm:text-base text-amber-700">{perQuestionMinutes} min</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                      <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Duration</span>
                      <span className="font-extrabold text-sm sm:text-base text-emerald-700">{uploadDuration} min</span>
                    </div>
                  </div>

                  {/* Diagram Management Action Trigger */}
                  <div className="pt-2 border-t border-indigo-100 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                      <ImageIcon className="w-4 h-4 text-indigo-600" />
                      <span>
                        Diagrams:{' '}
                        <strong className="text-indigo-700">
                          {parsedQuestions.filter((q) => Boolean(q.imageUrl || q.solutionImageUrl)).length}
                        </strong>{' '}
                        / {parsedQuestions.length} attached
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenDiagramManagerForUpload}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Attach / Review Diagrams</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Target Examination */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Target Examination *
                </label>
                <select
                  value={uploadExamCategory}
                  onChange={(e: any) => handleExamCategoryChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800"
                >
                  <option value="GATE">🎓 GATE Examination (IIT Pattern)</option>
                  <option value="JEE_MAINS">⚛️ JEE Mains Examination (NTA Pattern)</option>
                </select>
              </div>

              {/* Test Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Test Series Title *
                </label>
                <input
                  type="text"
                  required
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder={uploadExamCategory === 'JEE_MAINS' ? 'e.g. JEE Mains 2026 All India Full Mock #1' : 'e.g. GATE CS 2026 All India Full Mock #1'}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description / Instructions
                </label>
                <textarea
                  rows={2}
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="Brief note or guidelines for students..."
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-medium text-slate-700"
                />
              </div>

              {/* Category & Subject Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    value={uploadCategory}
                    onChange={(e: any) => setUploadCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  >
                    <option value="FULL_MOCK">
                      {uploadExamCategory === 'JEE_MAINS' ? 'Full 75-Q Mock' : 'Full 65-Q Mock'}
                    </option>
                    <option value="SUBJECT_PACK">Subject Pack</option>
                    <option value="TOPIC_TEST">Topic Test</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={uploadSubject}
                    onChange={(e) => setUploadSubject(e.target.value)}
                    placeholder="e.g. Algorithms"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>
              </div>

              {/* Auto-Calculated Timing & Pacing Controls */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/90 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    Pacing & Duration Calculator
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    Auto-syncs per question time & total duration
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        Per-Question Time (Minutes)
                      </label>
                      <span className="text-[10px] text-amber-700 font-bold">
                        ~{Math.round(perQuestionMinutes * 60)}s / Q
                      </span>
                    </div>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      value={perQuestionMinutes}
                      onChange={(e) => handlePerQuestionMinutesChange(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs font-bold text-slate-800 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        Total Duration (Minutes)
                      </label>
                      <span className="text-[10px] text-emerald-700 font-bold">
                        {Math.floor(uploadDuration / 60)}h {uploadDuration % 60}m
                      </span>
                    </div>
                    <input
                      type="number"
                      min="1"
                      value={uploadDuration}
                      onChange={(e) => handleDurationChange(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs font-bold text-slate-800 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-200/70">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-1">Presets:</span>
                  <button
                    type="button"
                    onClick={() => applyPacingPreset(uploadExamCategory === 'JEE_MAINS' ? 2.4 : 2.77)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 border border-slate-200 transition cursor-pointer"
                  >
                    Exam Standard ({uploadExamCategory === 'JEE_MAINS' ? '2.4 min' : '2.77 min'})
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPacingPreset(2.0)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 border border-slate-200 transition cursor-pointer"
                  >
                    2.0 min/Q
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPacingPreset(2.5)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 border border-slate-200 transition cursor-pointer"
                  >
                    2.5 min/Q
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPacingPreset(3.0)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 border border-slate-200 transition cursor-pointer"
                  >
                    3.0 min/Q
                  </button>
                </div>
              </div>

              {/* Errors & Success Alerts */}
              {uploadError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{uploadError}</span>
                </div>
              )}
              {uploadSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{uploadSuccess}</span>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={resetUploadForm}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !parsedQuestions}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Publishing...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Publish Test Series</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal for ₹29 Booster Pass */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        selectedPlan={boosterPlan}
        onSuccess={() => {
          setIsPaymentModalOpen(false);
          loadOfficialTests();
        }}
      />

      {/* Attach & Manage Diagrams Modal */}
      <AttachDiagramsModal
        isOpen={diagramModalOpen}
        onClose={() => setDiagramModalOpen(false)}
        testTitle={diagramModalTitle}
        questions={diagramModalQuestions}
        testId={diagramModalTestId}
        onSave={(updatedQuestions) => {
          if (!diagramModalTestId) {
            // Updated in-memory questions before publishing
            setParsedQuestions(updatedQuestions);
          } else {
            // Updated already-published test in DB
            loadOfficialTests();
          }
        }}
      />
    </div>
  );
};

export default TestSeriesPage;
