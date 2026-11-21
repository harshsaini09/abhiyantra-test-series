import type {
  QuestionBankStats,
  SubjectWithTopics,
  QuestionBankItem,
  TestData,
  QuestionType,
  MarkValue,
} from '../types';

const API_BASE = '/api';

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

export async function fetchStats(): Promise<QuestionBankStats> {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error('Failed to load stats');
  return res.json();
}

export async function fetchHierarchy(): Promise<SubjectWithTopics[]> {
  const res = await fetch(`${API_BASE}/hierarchy`);
  if (!res.ok) throw new Error('Failed to load hierarchy');
  return res.json();
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
  const params = new URLSearchParams();
  if (filters.subjectId) params.append('subjectId', String(filters.subjectId));
  if (filters.topicId) params.append('topicId', String(filters.topicId));
  if (filters.type) params.append('type', filters.type);
  if (filters.marks) params.append('marks', String(filters.marks));
  if (filters.search) params.append('search', filters.search);
  if (filters.includeArchived) params.append('includeArchived', 'true');

  const res = await fetch(`${API_BASE}/questions?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to load questions');
  return res.json();
}

export async function ingestTestData(testData: TestData): Promise<IngestResponse> {
  const res = await fetch(`${API_BASE}/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testData),
  });
  if (!res.ok) throw new Error('Failed to ingest questions');
  return res.json();
}

export async function archiveQuestion(id: number, isArchived: boolean): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/questions/${id}/archive`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isArchived }),
  });
  if (!res.ok) throw new Error('Failed to update archive status');
  return res.json();
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
  const res = await fetch(`${API_BASE}/questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to create question' }));
    throw new Error(err.error || 'Failed to create question');
  }
  return res.json();
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
  const res = await fetch(`${API_BASE}/custom-test/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to generate custom test' }));
    throw new Error(err.error || 'Failed to generate custom test');
  }
  return res.json();
}

export function getExportUrl(subjectId?: number, topicId?: number): string {
  const params = new URLSearchParams();
  if (subjectId) params.append('subjectId', String(subjectId));
  if (topicId) params.append('topicId', String(topicId));
  return `${API_BASE}/export?${params.toString()}`;
}
