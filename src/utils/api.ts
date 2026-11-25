import type {
  QuestionBankStats,
  SubjectWithTopics,
  QuestionBankItem,
  TestData,
  Question,
  QuestionType,
  MarkValue,
  UserProfile,
  SavedReportCard,
  TestResults,
  QuestionResult,
  MistakeEntry,
  BookmarkItem,
  AnalyticsSummary,
  SubjectMastery,
  TopicMastery,
} from '../types';

const API_BASE = '/api';
const LOCAL_STORAGE_KEY = 'abhiyantra-local-question-bank';
const HIERARCHY_CACHE_KEY = 'abhiyantra_cached_hierarchy';
const STATS_CACHE_KEY = 'abhiyantra_cached_stats';
const SAVED_REPORTS_KEY = 'abhiyantra_saved_report_cards';
const SAVED_MISTAKES_KEY = 'abhiyantra_saved_mistakes';
const SAVED_BOOKMARKS_KEY = 'abhiyantra_saved_bookmarks';
const AUTH_TOKEN_KEY = 'abhiyantra_auth_token';

export function getStoredAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredAuthToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch {
    // ignore
  }
}

export function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const token = getStoredAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  try {
    const raw = localStorage.getItem('abhiyantra_user_profile');
    if (raw) {
      const u = JSON.parse(raw);
      if (u && u.email) {
        headers['x-user-email'] = u.email;
        if (u.name) headers['x-user-name'] = u.name;
      }
    }
  } catch {
    // ignore
  }
  return headers;
}

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

// ─── Local Fallback & Fast Cache Helpers (Sub-Millisecond UI Boot) ───
export function getLocalQuestions(): QuestionBankItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw !== null) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

export function saveLocalQuestions(items: QuestionBankItem[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

export function getLocalHierarchy(): SubjectWithTopics[] {
  try {
    const raw = localStorage.getItem(HIERARCHY_CACHE_KEY);
    if (raw !== null) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

export function getLocalStats(): QuestionBankStats | null {
  try {
    const raw = localStorage.getItem(STATS_CACHE_KEY);
    if (raw !== null) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return null;
}

// ─── API Functions with Graceful Offline Fallback & Fast Cache ───

export async function fetchStats(): Promise<QuestionBankStats> {
  try {
    const res = await fetch(`${API_BASE}/stats`);
    if (res.ok) {
      const data = await res.json();
      if (!data.fallback && typeof data.totalQuestions === 'number') {
        try {
          localStorage.setItem(STATS_CACHE_KEY, JSON.stringify(data));
        } catch {}
        return data;
      }
    }
  } catch {
    // fallback
  }

  const cached = getLocalStats();
  if (cached) return cached;

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
      if (Array.isArray(data) && data.length > 0) {
        try {
          localStorage.setItem(HIERARCHY_CACHE_KEY, JSON.stringify(data));
        } catch {}
        return data;
      }
    }
  } catch {
    // fallback
  }

  const cached = getLocalHierarchy();
  if (cached && cached.length > 0) return cached;

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
      if (Array.isArray(data)) {
        if (!filters.subjectId && !filters.topicId && !filters.type && !filters.marks && !filters.search) {
          saveLocalQuestions(data);
        }
        return data;
      }
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

export async function fetchCurrentUser(): Promise<UserProfile | null> {
  // 1. First check local storage so authenticated session persists instantly on refresh
  let localUser: UserProfile | null = null;
  try {
    const raw = localStorage.getItem('abhiyantra_user_profile');
    if (raw) localUser = JSON.parse(raw);
  } catch {
    // ignore
  }

  // 2. Query server session to sync with Bearer token & cookies
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders(),
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
      if (data.token) {
        setStoredAuthToken(data.token);
      }
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
      headers: getAuthHeaders(),
      credentials: 'include',
    });
  } catch {
    // ignore
  }
  setStoredAuthToken(null);
  localStorage.removeItem('abhiyantra_user_profile');
}

// ─── Report Cards API Functions ───

// ─── Question Hashing Helper ───
export function computeQuestionHash(q: Question): string {
  if (q.contentHash) return q.contentHash;
  const normText = (q.question || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const normType = (q.type || '').trim().toUpperCase();
  const normOpts = (q.options || [])
    .map((o) => o.trim().toLowerCase().replace(/\s+/g, ' '))
    .sort()
    .join('|||');
  let hash = 0;
  const str = `${normText}:::${normType}:::${normOpts}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return `qhash_${Math.abs(hash).toString(16)}`;
}

// ─── Report Cards API Functions ───

export function getLocalReportCards(): SavedReportCard[] {
  try {
    const raw = localStorage.getItem(SAVED_REPORTS_KEY);
    if (!raw) return [];
    const list: SavedReportCard[] = JSON.parse(raw);
    if (!Array.isArray(list)) return [];

    // Deduplicate: Keep one record per test attempt
    const seen = new Map<string, SavedReportCard>();
    for (const card of list) {
      const timeBucket = Math.round(new Date(card.submittedAt).getTime() / 120000);
      const key = `${card.testTitle}_${card.totalQuestions}_${card.score}_${timeBucket}`;
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, card);
      } else {
        // If current card is a remote ID and existing is local, prefer remote ID
        if (!String(card.id).startsWith('local_') && String(existing.id).startsWith('local_')) {
          seen.set(key, card);
        }
      }
    }
    return Array.from(seen.values()).sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
  } catch {
    return [];
  }
}

function saveLocalReportCard(rc: SavedReportCard, replaceLocalId?: string): void {
  try {
    let list = getLocalReportCards();
    if (replaceLocalId) {
      list = list.filter((item) => item.id !== replaceLocalId);
    }
    // Remove if identical test attempt already exists
    list = list.filter((item) => {
      if (item.id === rc.id) return false;
      const sameTitle = item.testTitle === rc.testTitle;
      const sameTotal = item.totalQuestions === rc.totalQuestions;
      const sameScore = Math.abs(item.score - rc.score) < 0.01;
      const timeDiff = Math.abs(new Date(item.submittedAt).getTime() - new Date(rc.submittedAt).getTime());
      if (sameTitle && sameTotal && sameScore && timeDiff < 120000) {
        return false;
      }
      return true;
    });

    const updated = [rc, ...list];
    localStorage.setItem(SAVED_REPORTS_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

export async function saveReportCardApi(results: TestResults): Promise<SavedReportCard | null> {
  const payload = {
    testTitle: results.testData.title || 'Mock Test',
    examCategory: results.testData.examCategory || results.examCategory || 'GATE',
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
  const localId = `local_rc_${Date.now()}`;
  const localRc: SavedReportCard = {
    id: localId,
    ...payload,
    mode: payload.mode as 'EXAM' | 'PRACTICE',
    submittedAt: new Date().toISOString(),
  };
  saveLocalReportCard(localRc);

  // Auto-sync into local mistake notebook
  syncLocalMistakesFromResults(results);

  // 2. Synchronize with remote server/PostgreSQL if available
  try {
    const userProfileRaw = localStorage.getItem('abhiyantra_user_profile');
    let userEmail: string | undefined = undefined;
    let userName: string | undefined = undefined;
    if (userProfileRaw) {
      try {
        const u = JSON.parse(userProfileRaw);
        userEmail = u?.email;
        userName = u?.name;
      } catch {}
    }

    const res = await fetch(`${API_BASE}/report-cards`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ ...payload, userEmail, userName }),
    });

    if (res.ok) {
      const authHeader = res.headers.get('x-auth-token');
      if (authHeader) setStoredAuthToken(authHeader);

      const data = await res.json();
      if (data && data.reportCard) {
        // Replace temporary local ID with remote reportCard ID
        saveLocalReportCard(data.reportCard, localId);
        return data.reportCard;
      }
    }
  } catch {
    // fallback cleanly to local
  }

  return localRc;
}

export async function syncLocalReportCardsToCloud(): Promise<void> {
  const token = getStoredAuthToken();
  let userEmail: string | undefined = undefined;
  let userName: string | undefined = undefined;
  try {
    const raw = localStorage.getItem('abhiyantra_user_profile');
    if (raw) {
      const u = JSON.parse(raw);
      userEmail = u?.email;
      userName = u?.name;
    }
  } catch {}

  // If neither token nor userEmail exists, user is truly not logged in
  if (!token && !userEmail) return;

  const localCards = getLocalReportCards();
  const unsynced = localCards.filter((c) => String(c.id).startsWith('local_'));
  if (unsynced.length === 0) return;

  try {
    const res = await fetch(`${API_BASE}/report-cards/sync`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ reportCards: unsynced, userEmail, userName }),
    });

    if (res.ok) {
      const authHeader = res.headers.get('x-auth-token');
      if (authHeader) setStoredAuthToken(authHeader);

      // Re-fetch cloud report cards to sync local storage completely
      const remoteRes = await fetch(`${API_BASE}/report-cards`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (remoteRes.ok) {
        const cloudCards = await remoteRes.json();
        if (Array.isArray(cloudCards) && cloudCards.length > 0) {
          localStorage.setItem(SAVED_REPORTS_KEY, JSON.stringify(cloudCards));
        }
      }
    }
  } catch {
    // ignore
  }
}

export async function fetchReportCardsApi(): Promise<SavedReportCard[]> {
  try {
    const res = await fetch(`${API_BASE}/report-cards`, {
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    if (res.ok) {
      const authHeader = res.headers.get('x-auth-token');
      if (authHeader) setStoredAuthToken(authHeader);

      const data = await res.json();
      if (Array.isArray(data)) {
        // Deduplicate any duplicates within 2 minutes
        const deduped: SavedReportCard[] = [];
        for (const item of data) {
          const isDupe = deduped.some((d) => {
            if (d.testTitle !== item.testTitle) return false;
            if (d.mode !== item.mode) return false;
            if (Math.abs(d.score - item.score) > 0.01) return false;
            const diff = Math.abs(new Date(d.submittedAt).getTime() - new Date(item.submittedAt).getTime());
            return diff < 120000;
          });
          if (!isDupe) deduped.push(item);
        }

        // Cloud is authoritative for authenticated session: sync local cache with cloud state
        localStorage.setItem(SAVED_REPORTS_KEY, JSON.stringify(deduped));
        return deduped;
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
      headers: getAuthHeaders(),
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

// ─── Mistake Notebook Functions ───

export function getLocalMistakes(): MistakeEntry[] {
  try {
    const raw = localStorage.getItem(SAVED_MISTAKES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalMistakes(mistakes: MistakeEntry[]): void {
  try {
    localStorage.setItem(SAVED_MISTAKES_KEY, JSON.stringify(mistakes));
  } catch {
    // ignore
  }
}

export function syncLocalMistakesFromResults(results: TestResults): void {
  const currentMistakes = getLocalMistakes();
  const mistakeMap = new Map<string, MistakeEntry>();
  currentMistakes.forEach((m) => mistakeMap.set(m.questionHash, m));

  for (const qr of results.questionResults) {
    if (!qr || !qr.question) continue;
    const q = qr.question;
    const qHash = computeQuestionHash(q);
    const subject = q.subject || results.testData.subject || 'General / Unassigned';
    const topic = q.topic || results.testData.topic || 'General';

    if (qr.isAttempted && !qr.isCorrect) {
      const existing = mistakeMap.get(qHash);
      if (existing) {
        existing.wrongCount += 1;
        existing.status = 'NEEDS_REVIEW';
        existing.lastWrongAt = new Date().toISOString();
        existing.questionSnapshotJson = q;
        existing.subject = subject;
        existing.topic = topic;
      } else {
        mistakeMap.set(qHash, {
          id: `mistake_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          userId: 'student',
          questionHash: qHash,
          questionSnapshotJson: q,
          subject,
          topic,
          wrongCount: 1,
          status: 'NEEDS_REVIEW',
          lastWrongAt: new Date().toISOString(),
          masteredAt: null,
        });
      }
    } else if (qr.isCorrect) {
      const existing = mistakeMap.get(qHash);
      if (existing) {
        existing.status = 'MASTERED';
        existing.masteredAt = new Date().toISOString();
      }
    }
  }

  saveLocalMistakes(Array.from(mistakeMap.values()));
}

export async function fetchMistakesApi(): Promise<MistakeEntry[]> {
  try {
    const res = await fetch(`${API_BASE}/mistakes`, {
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        saveLocalMistakes(data);
        return data;
      }
    }
  } catch {
    // fallback
  }
  return getLocalMistakes();
}

export async function updateMistakeStatusApi(
  id: string,
  status: 'NEEDS_REVIEW' | 'MASTERED'
): Promise<boolean> {
  const list = getLocalMistakes();
  const item = list.find((m) => m.id === id);
  if (item) {
    item.status = status;
    item.masteredAt = status === 'MASTERED' ? new Date().toISOString() : null;
    saveLocalMistakes(list);
  }

  try {
    const res = await fetch(`${API_BASE}/mistakes/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    return res.ok;
  } catch {
    return true;
  }
}

// ─── Bookmark Functions ───

export function getLocalBookmarks(): BookmarkItem[] {
  try {
    const raw = localStorage.getItem(SAVED_BOOKMARKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalBookmarks(bookmarks: BookmarkItem[]): void {
  try {
    localStorage.setItem(SAVED_BOOKMARKS_KEY, JSON.stringify(bookmarks));
  } catch {
    // ignore
  }
}

export async function fetchBookmarksApi(): Promise<BookmarkItem[]> {
  try {
    const res = await fetch(`${API_BASE}/bookmarks`, {
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        saveLocalBookmarks(data);
        return data;
      }
    }
  } catch {
    // fallback
  }
  return getLocalBookmarks();
}

export async function toggleBookmarkApi(
  question: Question,
  note?: string
): Promise<{ bookmarked: boolean; item?: BookmarkItem }> {
  const qHash = computeQuestionHash(question);
  const list = getLocalBookmarks();
  const existingIdx = list.findIndex((b) => b.questionHash === qHash);

  let isBookmarked = false;
  let bookmarkedItem: BookmarkItem | undefined = undefined;

  if (existingIdx >= 0) {
    list.splice(existingIdx, 1);
    isBookmarked = false;
  } else {
    bookmarkedItem = {
      id: `bm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId: 'student',
      questionHash: qHash,
      questionSnapshotJson: question,
      subject: question.subject || 'General / Unassigned',
      topic: question.topic || 'General',
      note: note || '',
      createdAt: new Date().toISOString(),
    };
    list.unshift(bookmarkedItem);
    isBookmarked = true;
  }
  saveLocalBookmarks(list);

  try {
    const res = await fetch(`${API_BASE}/bookmarks/toggle`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ question, note }),
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch {
    // fallback
  }

  return { bookmarked: isBookmarked, item: bookmarkedItem };
}

export async function updateBookmarkNoteApi(id: string, note: string): Promise<boolean> {
  const list = getLocalBookmarks();
  const item = list.find((b) => b.id === id);
  if (item) {
    item.note = note;
    saveLocalBookmarks(list);
  }

  try {
    const res = await fetch(`${API_BASE}/bookmarks/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ note }),
    });
    return res.ok;
  } catch {
    return true;
  }
}

// ─── Analytics Summary Functions ───

export function computeLocalAnalyticsSummary(reportCards: SavedReportCard[]): AnalyticsSummary {
  if (reportCards.length === 0) {
    return {
      totalTests: 0,
      avgAccuracy: 0,
      avgScorePercent: 0,
      totalTimeSpentSeconds: 0,
      trends: [],
      subjectMastery: [],
      weakTopics: [],
    };
  }

  let totalScoreSum = 0;
  let totalMaxMarksSum = 0;
  let totalAccuracySum = 0;
  let totalTime = 0;

  const sorted = [...reportCards].sort(
    (a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
  );

  const trends = sorted.map((rc) => {
    const maxM = rc.maxMarks || (rc.totalQuestions ? rc.totalQuestions * 2 : 100);
    const scorePct = maxM > 0 ? (rc.score / maxM) * 100 : 0;
    totalScoreSum += rc.score;
    totalMaxMarksSum += maxM;
    totalAccuracySum += rc.accuracy || 0;
    totalTime += rc.timeTakenSeconds || 0;

    return {
      date: new Date(rc.submittedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      testTitle: rc.testTitle,
      scorePercent: Math.round(scorePct * 10) / 10,
      accuracy: Math.round((rc.accuracy || 0) * 10) / 10,
      score: rc.score,
      maxMarks: maxM,
    };
  });

  type Agg = {
    totalQuestions: number;
    attempted: number;
    correct: number;
    incorrect: number;
    unattempted: number;
    timeSpent: number;
  };

  const subjectMap = new Map<string, { agg: Agg; topics: Map<string, Agg> }>();

  reportCards.forEach((rc) => {
    const reviews: QuestionResult[] = rc.detailedReviewJson || [];
    reviews.forEach((qr) => {
      const q = qr.question;
      const sub = (q && q.subject) || 'General / Unassigned';
      const top = (q && q.topic) || 'General';

      if (!subjectMap.has(sub)) {
        subjectMap.set(sub, {
          agg: { totalQuestions: 0, attempted: 0, correct: 0, incorrect: 0, unattempted: 0, timeSpent: 0 },
          topics: new Map(),
        });
      }
      const sEntry = subjectMap.get(sub)!;
      if (!sEntry.topics.has(top)) {
        sEntry.topics.set(top, { totalQuestions: 0, attempted: 0, correct: 0, incorrect: 0, unattempted: 0, timeSpent: 0 });
      }
      const tEntry = sEntry.topics.get(top)!;

      [sEntry.agg, tEntry].forEach((target) => {
        target.totalQuestions += 1;
        target.timeSpent += qr.timeSpentSeconds || 0;
        if (qr.isAttempted) {
          target.attempted += 1;
          if (qr.isCorrect) target.correct += 1;
          else target.incorrect += 1;
        } else {
          target.unattempted += 1;
        }
      });
    });
  });

  const getStatus = (accuracy: number): 'STRONG' | 'MODERATE' | 'WEAK' => {
    if (accuracy >= 75) return 'STRONG';
    if (accuracy >= 50) return 'MODERATE';
    return 'WEAK';
  };

  const subjectMastery: SubjectMastery[] = [];
  const weakTopics: TopicMastery[] = [];

  subjectMap.forEach((val, subName) => {
    const sAcc = val.agg.attempted > 0 ? (val.agg.correct / val.agg.attempted) * 100 : 0;
    const sAvgTime = val.agg.attempted > 0 ? Math.round(val.agg.timeSpent / val.agg.attempted) : 0;

    const topicList: TopicMastery[] = [];
    val.topics.forEach((tAgg, topName) => {
      const tAcc = tAgg.attempted > 0 ? (tAgg.correct / tAgg.attempted) * 100 : 0;
      const tAvgTime = tAgg.attempted > 0 ? Math.round(tAgg.timeSpent / tAgg.attempted) : 0;
      const status = getStatus(tAcc);

      const topicItem: TopicMastery = {
        topic: topName,
        subject: subName,
        totalQuestions: tAgg.totalQuestions,
        attempted: tAgg.attempted,
        correct: tAgg.correct,
        incorrect: tAgg.incorrect,
        unattempted: tAgg.unattempted,
        accuracy: Math.round(tAcc * 10) / 10,
        avgTimeSeconds: tAvgTime,
        status,
      };
      topicList.push(topicItem);
      if (status === 'WEAK' && tAgg.attempted > 0) {
        weakTopics.push(topicItem);
      }
    });

    subjectMastery.push({
      subject: subName,
      totalQuestions: val.agg.totalQuestions,
      attempted: val.agg.attempted,
      correct: val.agg.correct,
      incorrect: val.agg.incorrect,
      unattempted: val.agg.unattempted,
      accuracy: Math.round(sAcc * 10) / 10,
      scorePercent: Math.round(sAcc * 10) / 10,
      avgTimeSeconds: sAvgTime,
      status: getStatus(sAcc),
      topics: topicList,
    });
  });

  return {
    totalTests: reportCards.length,
    avgAccuracy: Math.round((totalAccuracySum / reportCards.length) * 10) / 10,
    avgScorePercent: totalMaxMarksSum > 0 ? Math.round((totalScoreSum / totalMaxMarksSum) * 1000) / 10 : 0,
    totalTimeSpentSeconds: totalTime,
    trends,
    subjectMastery,
    weakTopics,
  };
}

export async function fetchAnalyticsSummaryApi(): Promise<AnalyticsSummary> {
  try {
    const res = await fetch(`${API_BASE}/analytics/summary`, {
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.totalTests === 'number') {
        return data;
      }
    }
  } catch {
    // fallback
  }
  const cards = getLocalReportCards();
  return computeLocalAnalyticsSummary(cards);
}

// ─── Reset / Clear Database Function ───
export async function clearPlatformDataApi(target: 'all' | 'questions' | 'report-cards' = 'all'): Promise<boolean> {
  if (target === 'all' || target === 'questions') {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([]));
  }
  if (target === 'all' || target === 'report-cards') {
    localStorage.removeItem(SAVED_REPORTS_KEY);
    localStorage.setItem(SAVED_REPORTS_KEY, JSON.stringify([]));
    localStorage.removeItem(SAVED_MISTAKES_KEY);
    localStorage.setItem(SAVED_MISTAKES_KEY, JSON.stringify([]));
    localStorage.removeItem(SAVED_BOOKMARKS_KEY);
    localStorage.setItem(SAVED_BOOKMARKS_KEY, JSON.stringify([]));
  }

  try {
    const res = await fetch(`${API_BASE}/admin/clear-data`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ target }),
    });
    return res.ok;
  } catch {
    return true;
  }
}

// ─── Payment & Subscription APIs ───

export async function fetchPricingPlansApi(): Promise<{ plans: any[]; upi: { payeeId: string; payeeName: string; qrImageUrl?: string } }> {
  try {
    const res = await fetch(`${API_BASE}/payment/plans`, {
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch {
    // fallback
  }
  return {
    plans: [
      {
        id: 'gate-complete-pass',
        name: 'GATE Complete Mock Test Series (2026/2027)',
        price: 59,
        originalPrice: 499,
        discountBadge: '88% OFF - Limited Special',
        durationDays: 365,
        popular: true,
        features: [
          'Full 65-Question Authentic GATE CBT Mock Tests',
          'GATE Authentic Marking Scheme (+1, -1/3 & +2, -2/3)',
          'Step-by-Step Solutions with Mathematical Formulations',
          'Mistake Notebook & 1-Click Retest on Missed Questions',
          'AI-Powered Weak Topic Diagnosis & Ranking Insights',
          'Unlimited Retakes on all Mock & Subject Papers',
          'Valid for 1 Full Year (Through GATE 2027)',
        ],
      },
      {
        id: 'gate-booster-pass',
        name: 'Subject & Topic-Wise Booster Pass',
        price: 29,
        originalPrice: 199,
        discountBadge: 'Special Offer',
        durationDays: 180,
        popular: false,
        features: [
          'All Chapter-Wise & Subject-Wise Practice Papers',
          'Custom Test Builder with 100+ Question Pool',
          'Detailed Explanations & Virtual Calculator Practice',
          'Personal Question Bookmarks & Error Notes',
          'Valid for 6 Months',
        ],
      },
    ],
    upi: {
      payeeId: 'harshsaini0912@okhdfcbank',
      payeeName: 'Abhiyantra Test Series',
      qrImageUrl: '/payment-qr.jpg',
    },
  };
}

export async function createPaymentIntentApi(planId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/payment/create-intent`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ planId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create payment intent');
  }
  return await res.json();
}

export async function submitUtrPaymentApi(planId: string, utrNumber: string, orderId?: string): Promise<any> {
  const res = await fetch(`${API_BASE}/payment/submit-utr`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ planId, utrNumber, orderId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to submit UTR verification.');
  }

  // Update local user profile state so frontend unlocks instantly
  try {
    const raw = localStorage.getItem('abhiyantra_user_profile');
    if (raw) {
      const u = JSON.parse(raw);
      u.isSubscribed = true;
      u.subscriptionTier = data.tier || planId;
      u.subscriptionUntil = data.subscriptionUntil;
      localStorage.setItem('abhiyantra_user_profile', JSON.stringify(u));
    }
  } catch {
    // ignore
  }

  return data;
}

export async function fetchSubscriptionStatusApi(): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/payment/status`, {
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // ignore
  }
  return { isSubscribed: false, payments: [] };
}

export async function fetchAdminPaymentsApi(): Promise<any> {
  const res = await fetch(`${API_BASE}/payment/admin/all`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch admin payments.');
  }
  return await res.json();
}

export async function verifyAdminPaymentApi(
  paymentId: string,
  status: 'VERIFIED' | 'REJECTED' | 'PENDING',
  adminNote?: string
): Promise<any> {
  const res = await fetch(`${API_BASE}/payment/admin/verify`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ paymentId, status, adminNote }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update payment status.');
  }
  return await res.json();
}

// ─── Admin User & Role Management APIs ───

export async function fetchAdminUsersApi(): Promise<any> {
  const res = await fetch(`${API_BASE}/auth/admin/users`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch platform users.');
  }
  return await res.json();
}

export async function updateUserRoleApi(userId: string, role: 'STUDENT' | 'TEACHER' | 'ADMIN'): Promise<any> {
  const res = await fetch(`${API_BASE}/auth/admin/users/${userId}/role`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update user role.');
  }
  return await res.json();
}

// ─── Razorpay Standard Checkout APIs ───

export async function createRazorpayOrderApi(amountInPaise: number, receipt?: string, notes?: Record<string, any>): Promise<{
  order_id: string;
  amount: number;
  currency: string;
  key_id?: string;
}> {
  const res = await fetch(`${API_BASE}/create-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    credentials: 'include',
    body: JSON.stringify({
      amount: amountInPaise,
      currency: 'INR',
      receipt,
      notes,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to create Razorpay order.');
  }
  return data;
}

export async function verifyRazorpayPaymentApi(payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  planId?: string;
  planName?: string;
  amount?: number;
  userEmail?: string;
  userName?: string;
}): Promise<{ success: boolean; message: string; payment_id?: string; order_id?: string }> {
  const res = await fetch(`${API_BASE}/verify-payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Razorpay payment verification failed.');
  }

  // Update local profile state so UI updates immediately
  try {
    const raw = localStorage.getItem('abhiyantra_user_profile');
    if (raw) {
      const u = JSON.parse(raw);
      u.isSubscribed = true;
      u.subscriptionTier = payload.planId || 'gate-complete-pass';
      localStorage.setItem('abhiyantra_user_profile', JSON.stringify(u));
    }
  } catch {
    // ignore
  }

  return data;
}

export async function syncRazorpayPaymentsApi(): Promise<{
  success: boolean;
  message: string;
  syncedCount: number;
  totalChecked: number;
  syncedPayments: string[];
}> {
  const res = await fetch(`${API_BASE}/razorpay/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to sync Razorpay payments.');
  }
  return data;
}

// ─── Test Series APIs (Official Teacher Series & Personal Series) ───

export async function updateTargetExamApi(targetExam: 'GATE' | 'JEE_MAINS'): Promise<{ success: boolean; targetExam: string }> {
  const res = await fetch(`${API_BASE}/auth/target-exam`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    credentials: 'include',
    body: JSON.stringify({ targetExam }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update target examination.');
  }
  return data;
}

export async function fetchOfficialTestSeriesApi(examCategory?: string): Promise<{
  tests: Array<{
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
    createdAt: string;
    creator?: { name: string; email: string };
  }>;
}> {
  const url = examCategory
    ? `${API_BASE}/test-series/official?examCategory=${encodeURIComponent(examCategory)}`
    : `${API_BASE}/test-series/official`;
  const res = await fetch(url, {
    headers: { ...getAuthHeaders() },
    credentials: 'include',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch official test series.');
  }
  return await res.json();
}

export async function fetchOfficialTestByIdApi(id: string): Promise<{ test: any }> {
  const res = await fetch(`${API_BASE}/test-series/official/${id}`, {
    headers: { ...getAuthHeaders() },
    credentials: 'include',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to load official test paper.');
  }
  return await res.json();
}

export async function uploadOfficialTestSeriesApi(payload: {
  title?: string;
  description?: string;
  category?: string;
  examCategory?: 'GATE' | 'JEE_MAINS';
  subject?: string;
  testData: any;
}): Promise<{ success: boolean; message: string; test: any }> {
  const res = await fetch(`${API_BASE}/test-series/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to upload official test series.');
  }
  return data;
}

export async function fetchPersonalTestSeriesApi(examCategory?: string): Promise<{
  tests: Array<{
    id: string;
    title: string;
    description: string | null;
    category: string;
    examCategory?: string;
    subject: string | null;
    totalQuestions: number;
    totalMarks: number;
    durationMinutes: number;
    createdAt: string;
  }>;
}> {
  const url = examCategory
    ? `${API_BASE}/test-series/my-personal?examCategory=${encodeURIComponent(examCategory)}`
    : `${API_BASE}/test-series/my-personal`;
  const res = await fetch(url, {
    headers: { ...getAuthHeaders() },
    credentials: 'include',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch personal test series.');
  }
  return await res.json();
}

export async function fetchPersonalTestByIdApi(id: string): Promise<{ test: any }> {
  const res = await fetch(`${API_BASE}/test-series/my-personal/${id}`, {
    headers: { ...getAuthHeaders() },
    credentials: 'include',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to load personal test.');
  }
  return await res.json();
}

export async function savePersonalTestSeriesApi(payload: {
  title: string;
  description?: string;
  category?: string;
  examCategory?: 'GATE' | 'JEE_MAINS';
  subject?: string;
  testData: any;
}): Promise<{ success: boolean; message: string; test: any }> {
  const res = await fetch(`${API_BASE}/test-series/save-personal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save personal test series.');
  }
  return data;
}

export async function deleteTestSeriesApi(id: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/test-series/${id}`, {
    method: 'DELETE',
    headers: { ...getAuthHeaders() },
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to delete test series.');
  }
  return data;
}


