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
} from 'lucide-react';

interface OfficialTestItem {
  id: string;
  title: string;
  description: string | null;
  category: string;
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
  const { user } = useAuth();

  const isMasterAdmin = user?.role === 'ADMIN' || user?.email?.toLowerCase() === 'harshsaini0912@gmail.com';
  const isTeacher = user?.role === 'TEACHER';
  const isTeacherOrAdmin = isMasterAdmin || isTeacher;
  const hasAccess = isTeacherOrAdmin || !!(user && user.isSubscribed);

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
  const [uploadCategory, setUploadCategory] = useState<'FULL_MOCK' | 'SUBJECT_PACK' | 'TOPIC_TEST'>('FULL_MOCK');
  const [uploadSubject, setUploadSubject] = useState('');
  const [uploadDuration, setUploadDuration] = useState<number>(180);
  const [parsedQuestions, setParsedQuestions] = useState<any[] | null>(null);
  const [fileName, setFileName] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch official tests & pricing plans on mount
  const loadOfficialTests = async () => {
    try {
      setLoading(true);
      const res = await fetchOfficialTestSeriesApi();
      setTests(res.tests || []);
    } catch (err) {
      console.warn('Failed to load official test series:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOfficialTests();

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

  // Handle JSON file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setUploadError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawContent = event.target?.result as string;
        const parsed = JSON.parse(rawContent);

        let questions: any[] = [];
        let title = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        let description = 'Official GATE Mock Test Series Paper';
        let duration = 180;
        let subject = '';

        if (Array.isArray(parsed)) {
          questions = parsed;
        } else if (parsed && Array.isArray(parsed.questions)) {
          questions = parsed.questions;
          if (parsed.title) title = parsed.title;
          if (parsed.description) description = parsed.description;
          if (parsed.duration || parsed.durationMinutes) duration = parsed.duration || parsed.durationMinutes;
          if (parsed.subject) subject = parsed.subject;
        } else if (parsed && Array.isArray(parsed.test?.questions)) {
          questions = parsed.test.questions;
          if (parsed.test.title) title = parsed.test.title;
          if (parsed.test.description) description = parsed.test.description;
          if (parsed.test.duration) duration = parsed.test.duration;
          if (parsed.test.subject) subject = parsed.test.subject;
        }

        if (questions.length === 0) {
          setUploadError('Invalid JSON file: No questions array found.');
          setParsedQuestions(null);
          return;
        }

        setParsedQuestions(questions);
        setUploadTitle(title);
        setUploadDescription(description);
        setUploadDuration(duration);
        if (subject) setUploadSubject(subject);
        if (questions.length >= 50) {
          setUploadCategory('FULL_MOCK');
        } else {
          setUploadCategory('SUBJECT_PACK');
        }
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
        title: uploadTitle.trim() || 'Official GATE Test Paper',
        description: uploadDescription.trim(),
        category: uploadCategory,
        subject: uploadSubject.trim() || undefined,
        testData: {
          title: uploadTitle.trim(),
          description: uploadDescription.trim(),
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
              <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
              Teacher-Curated GATE 2026/2027 Papers
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
              Official GATE Test Series
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Full-length 65-question mocks and sectional subject packs crafted strictly by IIT & GATE faculty. Experience the identical TCS-iON CBT screen, official marking scheme, and real-time percentile analysis.
            </p>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2 text-xs text-slate-300 font-medium">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Authentic GATE IIT Pattern
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" />
                180-Minute Full Timer
              </span>
              <span className="flex items-center gap-1.5">
                <Award className="w-4 h-4 text-indigo-400" />
                Included in ₹29 & ₹59 Passes
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
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {[
              { id: 'ALL', label: 'All Test Series' },
              { id: 'FULL_MOCK', label: 'Full 65-Q Mocks' },
              { id: 'SUBJECT_PACK', label: 'Subject Packs' },
              { id: 'TOPIC_TEST', label: 'Topic Tests' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
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
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-200">
                        {test.category === 'FULL_MOCK'
                          ? 'Full 65-Q Mock'
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
                      <button
                        onClick={() => handleDeleteTest(test.id, test.title)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                        title="Delete Official Test"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setParsedQuestions(null);
                  setFileName('');
                  setUploadError(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
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
                    Supports full mock JSON with title, questions array, marks, solutions.
                  </p>
                </div>
              </div>

              {/* Parsing Feedback Chip */}
              {parsedQuestions && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center justify-between">
                  <span className="font-semibold">
                    ✓ Loaded {parsedQuestions.length} Questions
                  </span>
                  <span className="text-[11px] text-emerald-700">
                    {parsedQuestions.reduce((sum, q) => sum + (Number(q.marks) || 1), 0)} Marks Total
                  </span>
                </div>
              )}

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
                  placeholder="e.g. GATE CS 2026 All India Full Mock #1"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
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
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="FULL_MOCK">Full 65-Q Mock</option>
                    <option value="SUBJECT_PACK">Subject Pack</option>
                    <option value="TOPIC_TEST">Topic Test</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Subject (Optional)
                  </label>
                  <input
                    type="text"
                    value={uploadSubject}
                    onChange={(e) => setUploadSubject(e.target.value)}
                    placeholder="e.g. Algorithms"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Duration (Minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  value={uploadDuration}
                  onChange={(e) => setUploadDuration(Number(e.target.value))}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
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
                  onClick={() => setIsUploadModalOpen(false)}
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
    </div>
  );
};

export default TestSeriesPage;
