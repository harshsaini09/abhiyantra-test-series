import type {
  QuestionBankStats,
  SubjectWithTopics,
  QuestionBankItem,
  TestData,
  QuestionType,
  MarkValue,
  UserProfile,
  SavedReportCard,
  TestResults,
} from '../types';

const API_BASE = '/api';
const LOCAL_STORAGE_KEY = 'abhiyantra-local-question-bank';

export interface IngestResponse {
  success: boolean;
  stats: {
    totalProcessed: number;
    newInserted: number;
    duplicatesSkipped: number;
    insertedIds: number[];
  };
  message: string;
}

// ─── Local Fallback Helper (Guarantees Vercel/Client-Side Stability) ───
function getLocalQuestions(): QuestionBankItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw !== null) return JSON.parse(raw);
  } catch {
    // ignore
  }

  return [];
}

function saveLocalQuestions(items: QuestionBankItem[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

// ─── API Functions with Graceful Offline Fallback ───

export async function fetchStats(): Promise<QuestionBankStats> {
  try {
    const res = await fetch(`${API_BASE}/stats`);
    if (res.ok) {
      const data = await res.json();
      if (!data.fallback && data.totalQuestions > 0) return data;
    }
  } catch {
    // fallback
  }

  const qs = getLocalQuestions().filter((q) => !q.isArchived);
  const subjects = new Set(qs.map((q) => q.subject.name));
  const topics = new Set(qs.map((q) => `${q.subject.name}::${q.topic.name}`));
  return {
    totalQuestions: qs.length,
    totalSubjects: subjects.size,
    totalTopics: topics.size,
    byType: {
      MCQ: qs.filter((q) => q.type === 'MCQ').length,
      MSQ: qs.filter((q) => q.type === 'MSQ').length,
      NAT: qs.filter((q) => q.type === 'NAT').length,
    },
    byMarks: {
      '1-Mark': qs.filter((q) => q.marks === 1).length,
      '2-Mark': qs.filter((q) => q.marks === 2).length,
    },
    archivedCount: getLocalQuestions().filter((q) => q.isArchived).length,
  };
}

export async function fetchHierarchy(): Promise<SubjectWithTopics[]> {
  try {
    const res = await fetch(`${API_BASE}/hierarchy`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch {
    // fallback
  }

  const qs = getLocalQuestions().filter((q) => !q.isArchived);
  const subjectMap = new Map<string, { id: number; topics: Map<string, { id: number; count: number }> }>();

  let subCounter = 1;
  let topCounter = 1;

  qs.forEach((q) => {
    const sName = q.subject.name;
    const tName = q.topic.name;

    if (!subjectMap.has(sName)) {
      subjectMap.set(sName, { id: subCounter++, topics: new Map() });
    }
    const s = subjectMap.get(sName)!;
    if (!s.topics.has(tName)) {
      s.topics.set(tName, { id: topCounter++, count: 0 });
    }
    s.topics.get(tName)!.count++;
  });

  const hierarchy: SubjectWithTopics[] = [];
  subjectMap.forEach((val, sName) => {
    const topics: Array<{ id: number; name: string; subjectId: number; _count?: { questions: number } }> = [];
    let sQuestionCount = 0;
    val.topics.forEach((tVal, tName) => {
      topics.push({
        id: tVal.id,
        name: tName,
        subjectId: val.id,
        _count: { questions: tVal.count },
      });
      sQuestionCount += tVal.count;
    });

    hierarchy.push({
      id: val.id,
      name: sName,
      topics,
      _count: { questions: sQuestionCount },
    });
  });

  return hierarchy;
}

export interface QuestionFilters {
  subjectId?: number;
  topicId?: number;
  type?: QuestionType;
  marks?: MarkValue;
  search?: string;
  includeArchived?: boolean;
}

export async function fetchQuestions(filters: QuestionFilters = {}): Promise<QuestionBankItem[]> {
  try {
    const params = new URLSearchParams();
    if (filters.subjectId) params.append('subjectId', String(filters.subjectId));
    if (filters.topicId) params.append('topicId', String(filters.topicId));
    if (filters.type) params.append('type', filters.type);
    if (filters.marks) params.append('marks', String(filters.marks));
    if (filters.search) params.append('search', filters.search);
    if (filters.includeArchived) params.append('includeArchived', 'true');

    const res = await fetch(`${API_BASE}/questions?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch {
    // fallback
  }

  let qs = getLocalQuestions();
  if (!filters.includeArchived) {
    qs = qs.filter((q) => !q.isArchived);
  }
  if (filters.type) {
    qs = qs.filter((q) => q.type === filters.type);
  }
  if (filters.marks) {
    qs = qs.filter((q) => q.marks === filters.marks);
  }
  if (filters.search && filters.search.trim()) {
    const s = filters.search.toLowerCase();
    qs = qs.filter((q) => q.questionText.toLowerCase().includes(s) || q.solution.toLowerCase().includes(s));
  }
  return qs;
}

export async function ingestTestData(testData: TestData): Promise<IngestResponse> {
  try {
    const res = await fetch(`${API_BASE}/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData),
    });
    if (res.ok) return await res.json();
  } catch {
    // fallback
  }

  // Local ingest
  const existing = getLocalQuestions();
  let newInserted = 0;
  let duplicatesSkipped = 0;
  const insertedIds: number[] = [];

  const defaultSub = testData.defaultSubject || testData.subject || 'General / Unassigned';
  const defaultTop = testData.defaultTopic || testData.topic || 'General';

  testData.questions.forEach((q, idx) => {
    const qText = q.question.trim().toLowerCase();
    const isDup = existing.some((e) => e.questionText.trim().toLowerCase() === qText);

    if (isDup) {
      duplicatesSkipped++;
    } else {
      const newItem: QuestionBankItem = {
        id: existing.length + 1,
        contentHash: `local-${Date.now()}-${idx}`,
        subjectId: existing.length + 1,
        subject: { id: existing.length + 1, name: q.subject || defaultSub },
        topicId: existing.length + 1,
        topic: { id: existing.length + 1, name: q.topic || defaultTop },
        type: q.type,
        marks: q.marks,
        questionText: q.question,
        options: q.options,
        answer: q.answer,
        solution: q.solution,
        sourceTestTitle: testData.title,
        isArchived: false,
        createdAt: new Date().toISOString(),
      };
      existing.push(newItem);
      newInserted++;
      insertedIds.push(newItem.id);
    }
  });

  saveLocalQuestions(existing);

  return {
    success: true,
    stats: {
      totalProcessed: testData.questions.length,
      newInserted,
      duplicatesSkipped,
      insertedIds,
    },
    message: `Processed ${testData.questions.length} questions: ${newInserted} new saved, ${duplicatesSkipped} duplicates skipped.`,
  };
}

export async function archiveQuestion(id: number, isArchived: boolean): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${API_BASE}/questions/${id}/archive`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isArchived }),
    });
    if (res.ok) return await res.json();
  } catch {
    // fallback
  }

  const existing = getLocalQuestions();
  const found = existing.find((q) => q.id === id);
  if (found) {
    found.isArchived = isArchived;
    saveLocalQuestions(existing);
  }
  return { success: true, message: isArchived ? 'Archived locally' : 'Restored locally' };
}

export interface CreateQuestionPayload {
  subject: string;
  topic: string;
  type: QuestionType;
  marks: MarkValue;
  question: string;
  options?: string[];
  answer: unknown;
  solution: string;
}

export async function createQuestion(payload: CreateQuestionPayload): Promise<QuestionBankItem> {
  try {
    const res = await fetch(`${API_BASE}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) return await res.json();
  } catch {
    // fallback
  }

  const existing = getLocalQuestions();
  const newItem: QuestionBankItem = {
    id: existing.length + 1,
    contentHash: `local-${Date.now()}`,
    subjectId: existing.length + 1,
    subject: { id: existing.length + 1, name: payload.subject },
    topicId: existing.length + 1,
    topic: { id: existing.length + 1, name: payload.topic },
    type: payload.type,
    marks: payload.marks,
    questionText: payload.question,
    options: payload.options,
    answer: payload.answer as any,
    solution: payload.solution,
    sourceTestTitle: 'Manual Entry',
    isArchived: false,
    createdAt: new Date().toISOString(),
  };
  existing.push(newItem);
  saveLocalQuestions(existing);
  return newItem;
}

export interface CustomTestPayload {
  title?: string;
  description?: string;
  questionIds?: number[];
  rules?: Array<{
    subjectId?: number;
    topicId?: number;
    type?: QuestionType;
    marks?: MarkValue;
    count: number;
  }>;
}

export async function generateCustomTest(payload: CustomTestPayload): Promise<TestData> {
  try {
    const res = await fetch(`${API_BASE}/custom-test/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) return await res.json();
  } catch {
    // fallback
  }

  const existing = getLocalQuestions().filter((q) => !q.isArchived);
  let selected: QuestionBankItem[] = [];

  if (payload.questionIds && payload.questionIds.length > 0) {
    const set = new Set(payload.questionIds);
    selected = existing.filter((q) => set.has(q.id));
  } else if (payload.rules && payload.rules.length > 0) {
    payload.rules.forEach((rule) => {
      let pool = existing;
      if (rule.type) pool = pool.filter((q) => q.type === rule.type);
      if (rule.marks) pool = pool.filter((q) => q.marks === rule.marks);
      const shuffled = [...pool].sort(() => 0.5 - Math.random());
      selected.push(...shuffled.slice(0, rule.count || 5));
    });
  }

  if (selected.length === 0) selected = existing.slice(0, 5);

  return {
    title: payload.title || 'Abhiyantra Custom GATE Mock Test',
    description: payload.description || 'Custom mock test synthesized by Abhiyantra Question Bank.',
    questions: selected.map((q, idx) => ({
      id: idx + 1,
      subject: q.subject.name,
      topic: q.topic.name,
      type: q.type,
      marks: q.marks,
      question: q.questionText,
      options: q.options,
      answer: q.answer,
      solution: q.solution,
    })),
  };
}

export function getExportUrl(subjectId?: number, topicId?: number): string {
  const params = new URLSearchParams();
  if (subjectId) params.append('subjectId', String(subjectId));
  if (topicId) params.append('topicId', String(topicId));
  return `${API_BASE}/export?${params.toString()}`;
}


// ─── Authentication API Functions ───

const SAVED_REPORTS_KEY = 'abhiyantra_saved_report_cards';

export async function fetchCurrentUser(): Promise<UserProfile | null> {
  // 1. First check local storage so authenticated session persists instantly on refresh
  let localUser: UserProfile | null = null;
  try {
    const raw = localStorage.getItem('abhiyantra_user_profile');
    if (raw) localUser = JSON.parse(raw);
  } catch {
    // ignore
  }

  // 2. Query server session to sync
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.user) {
        localStorage.setItem('abhiyantra_user_profile', JSON.stringify(data.user));
        return data.user;
      }
    }
  } catch {
    // fallback
  }

  return localUser;
}

export async function loginWithGoogleApi(credential: string): Promise<UserProfile | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ credential }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.user) {
        localStorage.setItem('abhiyantra_user_profile', JSON.stringify(data.user));
        return data.user;
      }
    }
  } catch {
    // fallback
  }

  // Fallback JWT client decode if backend is offline
  try {
    const base64Url = credential.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(jsonPayload);
    const fallbackUser: UserProfile = {
      id: parsed.sub || `local_${Date.now()}`,
      email: parsed.email || '',
      name: parsed.name || (parsed.email ? parsed.email.split('@')[0] : 'Student'),
      avatarUrl: parsed.picture || null,
    };
    localStorage.setItem('abhiyantra_user_profile', JSON.stringify(fallbackUser));
    return fallbackUser;
  } catch {
    return null;
  }
}

export async function logoutUserApi(): Promise<void> {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // ignore
  }
  localStorage.removeItem('abhiyantra_user_profile');
}

// ─── Report Cards API Functions ───

function getLocalReportCards(): SavedReportCard[] {
  try {
    const raw = localStorage.getItem(SAVED_REPORTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function saveLocalReportCard(rc: SavedReportCard): void {
  try {
    const list = getLocalReportCards();
    const updated = [rc, ...list.filter((item) => item.id !== rc.id)];
    localStorage.setItem(SAVED_REPORTS_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

export async function saveReportCardApi(results: TestResults): Promise<SavedReportCard | null> {
  const payload = {
    testTitle: results.testData.title || 'GATE Mock Test',
    mode: (results.mode || 'EXAM').toUpperCase(),
    totalQuestions: results.questionResults.length,
    maxMarks: results.maxMarks,
    score: results.totalScore,
    accuracy: results.accuracy,
    correctCount: results.totalCorrect,
    incorrectCount: results.totalIncorrect,
    unattemptedCount: results.totalUnattempted,
    positiveMarks: results.positiveMarks,
    negativeMarks: results.negativeMarks,
    timeTakenSeconds: results.timeTaken,
    allocatedSeconds: (results.testData.questions.length <= 15 ? 1800 : results.testData.questions.length <= 35 ? 5400 : 10800),
    breakdownJson: {
      byType: results.byType,
      byMarks: results.byMarks,
      bySubject: results.bySubject || {},
    },
    detailedReviewJson: results.questionResults,
  };

  // 1. Immediately guarantee local persistence
  const localRc: SavedReportCard = {
    id: `local_rc_${Date.now()}`,
    ...payload,
    mode: payload.mode as 'EXAM' | 'PRACTICE',
    submittedAt: new Date().toISOString(),
  };
  saveLocalReportCard(localRc);

  // 2. Synchronize with remote server/PostgreSQL if available
  try {
    const res = await fetch(`${API_BASE}/report-cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.reportCard) {
        saveLocalReportCard(data.reportCard);
        return data.reportCard;
      }
    }
  } catch {
    // fallback cleanly to local
  }

  return localRc;
}

export async function fetchReportCardsApi(): Promise<SavedReportCard[]> {
  try {
    const res = await fetch(`${API_BASE}/report-cards`, {
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        // Sync local cache with remote
        data.forEach((rc) => saveLocalReportCard(rc));
        return data;
      }
    }
  } catch {
    // fallback
  }

  return getLocalReportCards();
}

export async function fetchReportCardDetailApi(id: string): Promise<SavedReportCard | null> {
  try {
    const res = await fetch(`${API_BASE}/report-cards/${id}`, {
      credentials: 'include',
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // fallback
  }

  const list = getLocalReportCards();
  return list.find((rc) => rc.id === id) || null;
}

// ─── Reset / Clear Database Function ───
export async function clearPlatformDataApi(target: 'all' | 'questions' | 'report-cards' = 'all'): Promise<boolean> {
  // Clear local storage targets (preserving user profile!)
  if (target === 'all' || target === 'questions') {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([]));
  }
  if (target === 'all' || target === 'report-cards') {
    localStorage.removeItem(SAVED_REPORTS_KEY);
    localStorage.setItem(SAVED_REPORTS_KEY, JSON.stringify([]));
  }

  // Clear server/PostgreSQL database if connected
  try {
    const res = await fetch(`${API_BASE}/admin/clear-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ target }),
    });
    return res.ok;
  } catch {
    return true;
  }
}
