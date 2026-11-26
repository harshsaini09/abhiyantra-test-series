import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import {
  fetchHierarchy,
  fetchQuestions,
  fetchStats,
  archiveQuestion,
  createQuestion,
  getExportUrl,
  fetchBookmarksApi,
  toggleBookmarkApi,
  computeQuestionHash,
  clearPlatformDataApi,
  getLocalStats,
  getLocalHierarchy,
  getLocalQuestions,
  removeDiagramApi,
} from '../utils/api';
import type {
  SubjectWithTopics,
  QuestionBankItem,
  QuestionBankStats,
  QuestionType,
  MarkValue,
  Question,
} from '../types';
import {
  Database,
  Search,
  Download,
  Plus,
  ChevronRight,
  ChevronDown,
  CheckCircle,
  Archive,
  RefreshCw,
  FolderOpen,
  Tag,
  BookOpen,
  Sparkles,
  Layers,
  FileQuestion,
  X,
  AlertCircle,
  Bookmark,
  Trash2,
  Lock,
  Image as ImageIcon,
} from 'lucide-react';
import RichContent from '../components/RichContent';
import { QuestionImage } from '../components/ImageLightbox';
import { DiagramUploader } from '../components/DiagramUploader';

export default function QuestionBankPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const isMasterAdmin = Boolean(
    user?.email &&
      (user.email.toLowerCase().trim() === 'harshsaini0912@gmail.com' ||
        user.email.toLowerCase().trim() === 'harshsaini0912@gmail' ||
        user.email.toLowerCase().startsWith('harshsaini0912@') ||
        user?.role === 'ADMIN')
  );
  const isTeacherOrAdmin = isMasterAdmin || user?.role === 'TEACHER';

  // Instant Stale-While-Revalidate initialization (0ms initial render!)
  const [stats, setStats] = useState<QuestionBankStats | null>(() => getLocalStats());
  const [hierarchy, setHierarchy] = useState<SubjectWithTopics[]>(() => getLocalHierarchy());
  const [questions, setQuestions] = useState<QuestionBankItem[]>(() => getLocalQuestions());
  const [loading, setLoading] = useState<boolean>(() => getLocalQuestions().length === 0);

  // Filters
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | undefined>(undefined);
  const [selectedTopicId, setSelectedTopicId] = useState<number | undefined>(undefined);
  const [selectedType, setSelectedType] = useState<QuestionType | ''>('');
  const [selectedMarks, setSelectedMarks] = useState<MarkValue | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);

  // Hierarchy tree accordion state
  const [expandedSubjects, setExpandedSubjects] = useState<Set<number>>(new Set());
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  // Solution toggle state
  const [expandedSolutions, setExpandedSolutions] = useState<Set<number>>(new Set());

  // Bookmarks state
  const [bookmarkedHashes, setBookmarkedHashes] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchBookmarksApi()
      .then((items) => {
        setBookmarkedHashes(new Set(items.map((b) => b.questionHash)));
      })
      .catch(() => {});
  }, []);

  const toQuestionObj = (q: QuestionBankItem): Question => ({
    id: q.id,
    type: q.type,
    question: q.questionText,
    options: q.options || undefined,
    answer: q.answer,
    solution: q.solution || (q as any).explanation || '',
    marks: q.marks,
    subject: q.subject.name,
    topic: q.topic.name,
    imageUrl: q.imageUrl,
    contentHash: q.contentHash,
  });

  const handleToggleBookmark = async (q: QuestionBankItem) => {
    const qObj = toQuestionObj(q);
    const qHash = computeQuestionHash(qObj);
    const newSet = new Set(bookmarkedHashes);
    if (newSet.has(qHash)) {
      newSet.delete(qHash);
    } else {
      newSet.add(qHash);
    }
    setBookmarkedHashes(newSet);
    await toggleBookmarkApi(qObj).catch(() => {});
  };

  // Add Question Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // Form fields for Add Question
  const [formSubject, setFormSubject] = useState('');
  const [formTopic, setFormTopic] = useState('');
  const [formType, setFormType] = useState<QuestionType>('MCQ');
  const [formMarks, setFormMarks] = useState<MarkValue>(1);
  const [formQuestion, setFormQuestion] = useState('');
  const [formOptions, setFormOptions] = useState<string[]>(['', '', '', '']);
  const [formMcqAnswer, setFormMcqAnswer] = useState(0);
  const [formMsqAnswers, setFormMsqAnswers] = useState<number[]>([0]);
  const [formNatAnswer, setFormNatAnswer] = useState('');
  const [formNatMin, setFormNatMin] = useState('');
  const [formNatMax, setFormNatMax] = useState('');
  const [formNatIsRange, setFormNatIsRange] = useState(false);
  const [formSolution, setFormSolution] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formSolutionImageUrl, setFormSolutionImageUrl] = useState('');

  // Inline Card Diagram Editor state (Teacher / Admin)
  const [openDiagramEditorId, setOpenDiagramEditorId] = useState<number | null>(null);

  const handleCardDiagramUpdate = (questionId: number, url: string, isSolution: boolean) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id === questionId) {
          return {
            ...q,
            ...(isSolution ? { solutionImageUrl: url } : { imageUrl: url }),
          };
        }
        return q;
      })
    );
  };

  const handleCardDiagramRemove = async (questionId: number, isSolution: boolean) => {
    try {
      await removeDiagramApi({ questionId, isSolution });
      setQuestions((prev) =>
        prev.map((q) => {
          if (q.id === questionId) {
            return {
              ...q,
              ...(isSolution ? { solutionImageUrl: undefined } : { imageUrl: undefined }),
            };
          }
          return q;
        })
      );
    } catch (err) {
      console.warn('Failed to remove diagram:', err);
    }
  };

  // Load initial data with background revalidation
  const loadData = useCallback(async () => {
    try {
      if (questions.length === 0) {
        setLoading(true);
      }
      const [statsData, hierarchyData, questionsData] = await Promise.all([
        fetchStats(),
        fetchHierarchy(),
        fetchQuestions({
          subjectId: selectedSubjectId,
          topicId: selectedTopicId,
          type: selectedType ? selectedType : undefined,
          marks: selectedMarks ? (Number(selectedMarks) as MarkValue) : undefined,
          search: searchQuery,
          includeArchived,
        }),
      ]);
      setStats(statsData);
      setHierarchy(hierarchyData);
      setQuestions(questionsData);
      // Auto-expand all subjects on first load
      setExpandedSubjects(new Set(hierarchyData.map((s) => s.id)));
    } catch (err) {
      console.error('Failed to load Question Bank data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedSubjectId, selectedTopicId, selectedType, selectedMarks, searchQuery, includeArchived, questions.length]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Toggle subject accordion in hierarchy tree
  const toggleSubject = (id: number) => {
    setExpandedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSolution = (id: number) => {
    setExpandedSolutions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Archive / Restore Question (Soft-Delete)
  const handleArchiveToggle = async (question: QuestionBankItem) => {
    try {
      await archiveQuestion(question.id, !question.isArchived);
      loadData();
    } catch (err) {
      console.error('Failed to archive/restore:', err);
    }
  };

  // State and Handler to Clear Entire Question Bank
  const [isClearing, setIsClearing] = useState(false);
  const handleClearBank = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to clear the entire Question Bank to 0 questions? All questions in the cloud database and local cache will be permanently deleted.'
    );
    if (!confirmed) return;

    try {
      setIsClearing(true);
      await clearPlatformDataApi('questions');
      await loadData();
    } catch (err) {
      console.error('Failed to clear bank:', err);
    } finally {
      setIsClearing(false);
    }
  };

  // Handle Add Question Submit
  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');

    if (!formSubject.trim()) return setModalError('Subject is required.');
    if (!formTopic.trim()) return setModalError('Topic is required.');
    if (!formQuestion.trim()) return setModalError('Question text is required.');
    if (!formSolution.trim()) return setModalError('Solution is required.');

    let answerPayload: unknown;
    let optionsPayload: string[] | undefined = undefined;

    if (formType === 'MCQ') {
      optionsPayload = formOptions.map((o) => o.trim());
      if (optionsPayload.some((o) => o.length === 0)) {
        return setModalError('All 4 option fields must be filled for MCQ.');
      }
      answerPayload = formMcqAnswer;
    } else if (formType === 'MSQ') {
      optionsPayload = formOptions.map((o) => o.trim());
      if (optionsPayload.some((o) => o.length === 0)) {
        return setModalError('All 4 option fields must be filled for MSQ.');
      }
      if (formMsqAnswers.length === 0) {
        return setModalError('Select at least one correct option for MSQ.');
      }
      answerPayload = formMsqAnswers;
    } else if (formType === 'NAT') {
      if (formNatIsRange) {
        const min = parseFloat(formNatMin);
        const max = parseFloat(formNatMax);
        if (isNaN(min) || isNaN(max)) return setModalError('Valid numeric min and max are required.');
        if (min > max) return setModalError('Min value must be less than or equal to Max value.');
        answerPayload = { min, max };
      } else {
        const val = parseFloat(formNatAnswer);
        if (isNaN(val)) return setModalError('A valid numeric answer is required for NAT.');
        answerPayload = val;
      }
    }

    try {
      setSubmitting(true);
      await createQuestion({
        subject: formSubject.trim(),
        topic: formTopic.trim(),
        type: formType,
        marks: formMarks,
        question: formQuestion.trim(),
        options: optionsPayload,
        answer: answerPayload,
        solution: formSolution.trim(),
        imageUrl: formImageUrl.trim() || undefined,
        solutionImageUrl: formSolutionImageUrl.trim() || undefined,
      });
      setShowAddModal(false);
      // Reset form
      setFormQuestion('');
      setFormOptions(['', '', '', '']);
      setFormSolution('');
      setFormNatAnswer('');
      setFormImageUrl('');
      setFormSolutionImageUrl('');
      loadData();
    } catch (err: unknown) {
      setModalError((err as Error).message || 'Failed to create question.');
    } finally {
      setSubmitting(false);
    }
  };

  // Find active subject and topic names
  const activeSubjectName = hierarchy.find((s) => s.id === selectedSubjectId)?.name;
  const activeTopicName = activeSubjectName
    ? hierarchy
        .find((s) => s.id === selectedSubjectId)
        ?.topics.find((t) => t.id === selectedTopicId)?.name
    : undefined;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!isTeacherOrAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Faculty & Admin Access Only</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              The Question Bank repository is restricted to verified Instructors, Faculty, and Platform Administrators. Students can practice authentic full-length tests directly from the examination portal.
            </p>
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
              className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition border border-indigo-200 cursor-pointer"
            >
              🔑 Continue as Platform Admin (harshsaini0912@gmail.com)
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition border border-slate-200 cursor-pointer"
            >
              Explore GATE Mock Tests
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      {/* ─── Hero / Header ─── */}
      <header className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white py-8 px-4 sm:px-6 lg:px-8 border-b border-indigo-900/50 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src="/logo.avif"
              alt="Abhiyantra Logo"
              className="w-12 h-12 object-contain rounded-xl bg-white/10 p-1.5 border border-white/20 shadow-sm shrink-0"
            />
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold mb-1 border border-indigo-400/30">
                <Database className="w-3.5 h-3.5" />
                <span className="capitalize">abhiyantra</span> • PostgreSQL + Prisma Repository
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Abhiyantra Question Bank</h1>
              <p className="mt-0.5 text-xs text-slate-400 max-w-2xl">
                Persistent two-level hierarchy (<span className="text-indigo-300 font-medium">Subject → Topic</span>) with content-hash deduplication and soft-delete protection.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {isMasterAdmin && (
              <button
                onClick={handleClearBank}
                disabled={isClearing || !stats || stats.totalQuestions === 0}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 hover:text-rose-200 text-xs sm:text-sm font-semibold border border-rose-500/30 transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
                title="Clear question bank to zero questions (Admin Only)"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>{isClearing ? 'Clearing...' : 'Clear Bank'}</span>
              </button>
            )}

            <a
              href={getExportUrl(selectedSubjectId, selectedTopicId)}
              download
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold border border-white/20 backdrop-blur-xs transition-all shadow-xs"
            >
              <Download className="w-4 h-4 text-indigo-300" />
              Export Full Bank (.json)
            </a>

            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Question
            </button>
          </div>
        </div>

        {/* ─── Stats Ribbon ─── */}
        {stats && (
          <div className="max-w-7xl mx-auto mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <span className="text-xs text-slate-400 block font-medium">Total Questions</span>
              <span className="text-2xl font-bold text-white">{stats.totalQuestions}</span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <span className="text-xs text-slate-400 block font-medium">Subjects</span>
              <span className="text-2xl font-bold text-indigo-300">{stats.totalSubjects}</span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <span className="text-xs text-slate-400 block font-medium">Topics</span>
              <span className="text-2xl font-bold text-blue-300">{stats.totalTopics}</span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <span className="text-xs text-slate-400 block font-medium">MCQs</span>
              <span className="text-2xl font-bold text-blue-400">{stats.byType.MCQ}</span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <span className="text-xs text-slate-400 block font-medium">MSQs</span>
              <span className="text-2xl font-bold text-purple-400">{stats.byType.MSQ}</span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <span className="text-xs text-slate-400 block font-medium">NATs</span>
              <span className="text-2xl font-bold text-emerald-400">{stats.byType.NAT}</span>
            </div>
          </div>
        )}
      </header>

      {/* ─── Main Content Layout ─── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 w-full flex-1 flex flex-col md:flex-row gap-6">
        {/* Mobile Hierarchy Toggle Button */}
        <button
          type="button"
          onClick={() => setShowMobileSidebar(!showMobileSidebar)}
          className="md:hidden w-full flex items-center justify-between p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs font-bold text-xs text-slate-800"
        >
          <span className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            {activeSubjectName
              ? `${activeSubjectName} ${activeTopicName ? `→ ${activeTopicName}` : ''}`
              : 'Browse Subjects & Topics Hierarchy'}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform ${showMobileSidebar ? 'rotate-180' : ''}`}
          />
        </button>

        {/* ─── LEFT: Two-Level Hierarchy Tree Sidebar ─── */}
        <aside className={`w-full md:w-80 shrink-0 space-y-4 ${showMobileSidebar ? 'block' : 'hidden md:block'}`}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                Two-Level Hierarchy
              </h2>
              <button
                onClick={() => {
                  setSelectedSubjectId(undefined);
                  setSelectedTopicId(undefined);
                }}
                className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-colors ${
                  selectedSubjectId === undefined && selectedTopicId === undefined
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                All
              </button>
            </div>

            <div className="mt-3 space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
              {hierarchy.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No subjects found.</p>
              ) : (
                hierarchy.map((subj) => {
                  const isExpanded = expandedSubjects.has(subj.id);
                  const isSubjectSelected = selectedSubjectId === subj.id && selectedTopicId === undefined;

                  return (
                    <div key={subj.id} className="rounded-xl overflow-hidden border border-slate-100">
                      {/* Level 1: Subject Header */}
                      <div
                        className={`flex items-center justify-between p-2.5 cursor-pointer text-sm font-semibold transition-colors ${
                          isSubjectSelected
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'hover:bg-slate-50 text-slate-800'
                        }`}
                        onClick={() => {
                          setSelectedSubjectId(subj.id);
                          setSelectedTopicId(undefined);
                        }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSubject(subj.id);
                            }}
                            className="p-1 hover:bg-slate-200/60 rounded text-slate-400"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                          <FolderOpen className="w-4 h-4 text-indigo-500 shrink-0" />
                          <span className="truncate">{subj.name}</span>
                        </div>
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold shrink-0">
                          {subj._count?.questions ?? 0}
                        </span>
                      </div>

                      {/* Level 2: Nested Topics */}
                      {isExpanded && subj.topics.length > 0 && (
                        <div className="bg-slate-50/70 border-t border-slate-100 py-1 pl-6 pr-2 space-y-0.5">
                          {subj.topics.map((topic) => {
                            const isTopicSelected = selectedTopicId === topic.id;
                            return (
                              <div
                                key={topic.id}
                                onClick={() => {
                                  setSelectedSubjectId(subj.id);
                                  setSelectedTopicId(topic.id);
                                }}
                                className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                                  isTopicSelected
                                    ? 'bg-indigo-600 text-white font-semibold'
                                    : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'
                                }`}
                              >
                                <span className="truncate flex items-center gap-1.5">
                                  <Tag className="w-3 h-3 opacity-70" />
                                  {topic.name}
                                </span>
                                <span
                                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                                    isTopicSelected ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-600'
                                  }`}
                                >
                                  {topic._count?.questions ?? 0}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>

        {/* ─── RIGHT: Question List & Filter Toolbar ─── */}
        <main className="flex-1 min-w-0 space-y-4">
          {/* Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search questions or solutions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              {/* Type Filter */}
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as QuestionType | '')}
                className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="">All Types (MCQ, MSQ, NAT)</option>
                <option value="MCQ">MCQ Only</option>
                <option value="MSQ">MSQ Only</option>
                <option value="NAT">NAT Only</option>
              </select>

              {/* Marks Filter */}
              <select
                value={selectedMarks}
                onChange={(e) => setSelectedMarks(e.target.value ? (Number(e.target.value) as MarkValue) : '')}
                className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="">All Marks (1 &amp; 2)</option>
                <option value="1">1-Mark Questions</option>
                <option value="2">2-Mark Questions</option>
              </select>

              {/* Include Archived Checkbox */}
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer ml-auto">
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(e) => setIncludeArchived(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Show Archived
              </label>
            </div>

            {/* Active Hierarchy Breadcrumb */}
            {(activeSubjectName || activeTopicName) && (
              <div className="flex items-center gap-2 text-xs text-indigo-800 bg-indigo-50/70 border border-indigo-100 rounded-lg px-3 py-1.5 font-medium">
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                <span>Active Scope:</span>
                <span className="font-bold">{activeSubjectName}</span>
                {activeTopicName && (
                  <>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-bold">{activeTopicName}</span>
                  </>
                )}
                <button
                  onClick={() => {
                    setSelectedSubjectId(undefined);
                    setSelectedTopicId(undefined);
                  }}
                  className="ml-auto text-indigo-600 hover:text-indigo-800 font-bold"
                >
                  Clear Scope ✕
                </button>
              </div>
            )}
          </div>

          {/* Question List */}
          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-500" />
              <p className="text-sm font-medium">Loading questions from SQLite repository...</p>
            </div>
          ) : questions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              <FileQuestion className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-700">No questions found</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                No questions match your current scope or search criteria. Try clearing filters or adding questions.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-xs font-semibold text-slate-500 px-1 flex items-center justify-between">
                <span>Showing {questions.length} questions</span>
              </div>

              {questions.map((q, idx) => {
                const isExpanded = expandedSolutions.has(q.id);

                return (
                  <div
                    key={q.id}
                    className={`bg-white rounded-2xl border transition-all shadow-xs ${
                      q.isArchived ? 'border-amber-200 bg-amber-50/20 opacity-80' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Header */}
                    <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-800">Q#{idx + 1}</span>
                        {/* Type badge */}
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            q.type === 'MCQ'
                              ? 'bg-blue-100 text-blue-800'
                              : q.type === 'MSQ'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {q.type}
                        </span>
                        {/* Marks badge */}
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                          {q.marks} Mark{q.marks > 1 ? 's' : ''}
                        </span>
                        {/* Subject Badge */}
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {q.subject.name}
                        </span>
                        {/* Topic Badge */}
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                          {q.topic.name}
                        </span>
                        {q.isArchived && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 flex items-center gap-1">
                            <Archive className="w-3 h-3" /> Archived
                          </span>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5">
                        {isTeacherOrAdmin && (
                          <button
                            type="button"
                            onClick={() =>
                              setOpenDiagramEditorId(openDiagramEditorId === q.id ? null : q.id)
                            }
                            title="Attach or replace question/solution diagram"
                            className={`p-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                              openDiagramEditorId === q.id
                                ? 'text-indigo-700 bg-indigo-100 ring-1 ring-indigo-400'
                                : q.imageUrl || q.solutionImageUrl
                                ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
                                : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100'
                            }`}
                          >
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span className="text-[11px] font-bold">
                              {q.imageUrl || q.solutionImageUrl ? 'Diagram' : '+ Diagram'}
                            </span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleToggleBookmark(q)}
                          title={bookmarkedHashes.has(computeQuestionHash(toQuestionObj(q))) ? 'Remove Bookmark' : 'Bookmark Question'}
                          className={`p-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            bookmarkedHashes.has(computeQuestionHash(toQuestionObj(q)))
                              ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                              : 'text-slate-400 hover:text-amber-600 hover:bg-slate-100'
                          }`}
                        >
                          <Bookmark
                            className="w-4 h-4"
                            fill={bookmarkedHashes.has(computeQuestionHash(toQuestionObj(q))) ? 'currentColor' : 'none'}
                          />
                        </button>
                        <button
                          onClick={() => handleArchiveToggle(q)}
                          title={q.isArchived ? 'Restore question' : 'Archive (soft-delete)'}
                          className={`p-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            q.isArchived
                              ? 'text-emerald-700 hover:bg-emerald-50'
                              : 'text-slate-400 hover:text-amber-600 hover:bg-slate-100'
                          }`}
                        >
                          {q.isArchived ? <RefreshCw className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Inline Diagram Editor for Faculty */}
                    {openDiagramEditorId === q.id && (
                      <div className="p-4 bg-slate-50 border-b border-slate-200/80 space-y-3 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                            Manage Diagram &amp; Figures (Question #{idx + 1})
                          </span>
                          <button
                            type="button"
                            onClick={() => setOpenDiagramEditorId(null)}
                            className="text-xs font-bold text-slate-500 hover:text-slate-700 px-2 py-0.5 rounded-md hover:bg-slate-200 transition"
                          >
                            Close ✕
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[11px] font-bold text-slate-700 block mb-1">
                              Question Diagram
                            </label>
                            <DiagramUploader
                              questionId={q.id}
                              currentUrl={q.imageUrl}
                              onUploadSuccess={(url) => handleCardDiagramUpdate(q.id, url, false)}
                              onRemove={() => handleCardDiagramRemove(q.id, false)}
                              compact
                              label="Drop Question Diagram or Ctrl+V"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-slate-700 block mb-1">
                              Solution Diagram / Figure
                            </label>
                            <DiagramUploader
                              questionId={q.id}
                              isSolution
                              currentUrl={q.solutionImageUrl}
                              onUploadSuccess={(url) => handleCardDiagramUpdate(q.id, url, true)}
                              onRemove={() => handleCardDiagramRemove(q.id, true)}
                              compact
                              label="Drop Solution Diagram or Ctrl+V"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Question Text */}
                    <div className="p-4 sm:p-5 space-y-4">
                      {q.imageUrl && (
                        <div className="max-w-md">
                          <QuestionImage src={q.imageUrl} alt="Question Visual" />
                        </div>
                      )}

                      <div className="text-base text-slate-800 font-medium leading-relaxed">
                        <RichContent content={q.questionText} />
                      </div>

                      {/* Options (for MCQ & MSQ) */}
                      {q.options && q.options.length > 0 && (
                        <div className="grid sm:grid-cols-2 gap-2 pt-1">
                          {q.options.map((opt, optIdx) => {
                            const letter = String.fromCharCode(65 + optIdx);
                            let isCorrect = false;
                            if (q.type === 'MCQ') {
                              isCorrect = q.answer === optIdx;
                            } else if (q.type === 'MSQ') {
                              isCorrect = Array.isArray(q.answer) && q.answer.includes(optIdx);
                            }

                            return (
                              <div
                                key={optIdx}
                                className={`flex items-start gap-2.5 p-3 rounded-xl border text-sm transition-all ${
                                  isCorrect
                                    ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900 font-medium'
                                    : 'bg-slate-50/80 border-slate-200 text-slate-700'
                                }`}
                              >
                                <span className="font-bold shrink-0">{letter})</span>
                                <div className="flex-1">
                                  <RichContent content={opt} />
                                </div>
                                {isCorrect && <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* NAT Answer Display */}
                      {q.type === 'NAT' && (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 flex items-center gap-2">
                          <span className="font-semibold text-slate-500">Correct Answer:</span>
                          <span className="font-mono font-bold text-emerald-700">
                            {typeof q.answer === 'number'
                              ? q.answer
                              : `${(q.answer as { min: number; max: number }).min} to ${(q.answer as { min: number; max: number }).max}`}
                          </span>
                        </div>
                      )}

                      {/* Solution Accordion Toggle */}
                      <div className="pt-2">
                        <button
                          onClick={() => toggleSolution(q.id)}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 transition-colors"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          {isExpanded ? 'Hide Solution' : 'View Solution'}
                        </button>

                        {isExpanded && (
                          <div className="mt-3 p-4 bg-indigo-50/60 border border-indigo-100 rounded-xl text-sm text-indigo-950 space-y-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 block">
                              Detailed Solution
                            </span>
                            {q.solutionImageUrl && (
                              <div className="max-w-md">
                                <QuestionImage src={q.solutionImageUrl} alt="Solution Visual" />
                              </div>
                            )}
                            <div className="leading-relaxed">
                              <RichContent content={q.solution || (q as any).explanation || ''} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* ─── ADD QUESTION MODAL ─── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                Add Question to Question Bank
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateQuestion} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {modalError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {modalError}
                </div>
              )}

              {/* Two-Level Hierarchy Inputs */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Subject (Level 1) *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Data Structures"
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Topic (Level 2) *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Stacks & Queues"
                    value={formTopic}
                    onChange={(e) => setFormTopic(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Type and Marks */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Question Type *</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as QuestionType)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                  >
                    <option value="MCQ">MCQ (Multiple Choice — Single Correct)</option>
                    <option value="MSQ">MSQ (Multiple Select — One or More)</option>
                    <option value="NAT">NAT (Numerical Answer Type)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Marks *</label>
                  <select
                    value={formMarks}
                    onChange={(e) => setFormMarks(Number(e.target.value) as MarkValue)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                  >
                    <option value="1">1 Mark</option>
                    <option value="2">2 Marks</option>
                  </select>
                </div>
              </div>

              {/* Question Text */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Question Text *</label>
                <textarea
                  rows={3}
                  placeholder="Enter the full question text..."
                  value={formQuestion}
                  onChange={(e) => setFormQuestion(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                />
              </div>

              {/* MCQ & MSQ Options */}
              {(formType === 'MCQ' || formType === 'MSQ') && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Options &amp; Correct Answer * ({formType === 'MCQ' ? 'Select radio for correct answer' : 'Check boxes for correct answers'})
                  </label>
                  {formOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      {formType === 'MCQ' ? (
                        <input
                          type="radio"
                          name="mcqCorrect"
                          checked={formMcqAnswer === i}
                          onChange={() => setFormMcqAnswer(i)}
                          className="accent-indigo-600"
                        />
                      ) : (
                        <input
                          type="checkbox"
                          checked={formMsqAnswers.includes(i)}
                          onChange={(e) => {
                            if (e.target.checked) setFormMsqAnswers([...formMsqAnswers, i]);
                            else setFormMsqAnswers(formMsqAnswers.filter((idx) => idx !== i));
                          }}
                          className="accent-indigo-600"
                        />
                      )}
                      <span className="font-bold text-xs text-slate-500 w-4">{String.fromCharCode(65 + i)}</span>
                      <input
                        type="text"
                        placeholder={`Option ${String.fromCharCode(65 + i)} text`}
                        value={opt}
                        onChange={(e) => {
                          const copy = [...formOptions];
                          copy[i] = e.target.value;
                          setFormOptions(copy);
                        }}
                        required
                        className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* NAT Answer */}
              {formType === 'NAT' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-4">
                    <label className="text-xs font-bold text-slate-700">Answer Format:</label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="radio"
                        checked={!formNatIsRange}
                        onChange={() => setFormNatIsRange(false)}
                        className="accent-indigo-600"
                      />
                      Exact Value
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="radio"
                        checked={formNatIsRange}
                        onChange={() => setFormNatIsRange(true)}
                        className="accent-indigo-600"
                      />
                      Range [min, max]
                    </label>
                  </div>

                  {!formNatIsRange ? (
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 3.75"
                      value={formNatAnswer}
                      onChange={(e) => setFormNatAnswer(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                    />
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        step="any"
                        placeholder="Min value (e.g. 3.70)"
                        value={formNatMin}
                        onChange={(e) => setFormNatMin(e.target.value)}
                        required
                        className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                      />
                      <input
                        type="number"
                        step="any"
                        placeholder="Max value (e.g. 3.80)"
                        value={formNatMax}
                        onChange={(e) => setFormNatMax(e.target.value)}
                        required
                        className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Solution */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Solution / Explanation *</label>
                <textarea
                  rows={2}
                  placeholder="Detailed explanation..."
                  value={formSolution}
                  onChange={(e) => setFormSolution(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                />
              </div>

              {/* Diagrams for New Question */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Question Diagram (Optional)
                  </label>
                  <DiagramUploader
                    currentUrl={formImageUrl}
                    onUploadSuccess={(url) => setFormImageUrl(url)}
                    onRemove={() => setFormImageUrl('')}
                    compact
                    label="Drop Question Diagram or Ctrl+V"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Solution Diagram (Optional)
                  </label>
                  <DiagramUploader
                    isSolution
                    currentUrl={formSolutionImageUrl}
                    onUploadSuccess={(url) => setFormSolutionImageUrl(url)}
                    onRemove={() => setFormSolutionImageUrl('')}
                    compact
                    label="Drop Solution Diagram or Ctrl+V"
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save to Question Bank'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
