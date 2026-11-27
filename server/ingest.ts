import { prisma } from './db.js';
import { computeContentHash } from './contentHash.js';

export interface IngestQuestionInput {
  id?: number;
  type?: 'MCQ' | 'MSQ' | 'NAT' | string;
  marks?: 1 | 2 | number;
  subject?: string;
  topic?: string;
  question?: string;
  questionText?: string;
  text?: string;
  options?: string[];
  answer?: unknown;
  solution?: string;
  explanation?: string;
  imageUrl?: string | null;
  solutionImageUrl?: string | null;
}

export interface IngestTestInput {
  title?: string;
  examCategory?: string;
  subject?: string;
  topic?: string;
  defaultSubject?: string;
  defaultTopic?: string;
  questions: IngestQuestionInput[];
}

export interface IngestResult {
  totalProcessed: number;
  newInserted: number;
  duplicatesSkipped: number;
  insertedIds: number[];
}

function inferSubjectFromTitle(title?: string, examCategory?: string): string {
  if (!title) return examCategory === 'JEE_MAINS' ? 'Mathematics' : 'Core Engineering';
  const lower = title.toLowerCase();
  if (lower.includes('mathematics') || lower.includes('maths') || lower.includes('math')) return 'Mathematics';
  if (lower.includes('physics')) return 'Physics';
  if (lower.includes('chemistry')) return 'Chemistry';
  if (lower.includes('artificial intelligence') || lower.includes('ai mock') || lower.includes('search —') || lower.includes('da:')) return 'Artificial Intelligence (AI)';
  if (lower.includes('data structures') || lower.includes('algorithms')) return 'Data Structures & Algorithms';
  if (lower.includes('database') || lower.includes('dbms')) return 'Database Management Systems (DBMS)';
  if (lower.includes('operating system') || lower.includes('os ')) return 'Operating Systems';
  if (lower.includes('computer network') || lower.includes('cn ')) return 'Computer Networks';
  if (lower.includes('theory of computation') || lower.includes('toc')) return 'Theory of Computation';
  if (lower.includes('compiler')) return 'Compiler Design';
  if (lower.includes('digital logic')) return 'Digital Logic';
  if (lower.includes('general aptitude') || lower.includes('aptitude')) return 'General Aptitude';
  if (lower.includes('machine learning') || lower.includes('ml ')) return 'Machine Learning';
  return examCategory === 'JEE_MAINS' ? 'Mathematics' : 'Technical Subject';
}

function inferTopicFromQuestion(qText: string, defaultTopic: string = 'General'): string {
  const text = (qText || '').toLowerCase();
  if (
    text.includes('relation') ||
    text.includes('bijective') ||
    text.includes('onto') ||
    text.includes('injective') ||
    text.includes('domain of the function') ||
    text.includes('invertible function')
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
  return defaultTopic;
}

export async function ingestQuestions(data: IngestTestInput): Promise<IngestResult> {
  let newInserted = 0;
  let duplicatesSkipped = 0;
  const insertedIds: number[] = [];

  const testTitle = data.title?.trim() || 'Imported Test';
  const defaultSub = data.defaultSubject?.trim() || data.subject?.trim() || inferSubjectFromTitle(data.title, data.examCategory);
  const defaultTop = data.defaultTopic?.trim() || data.topic?.trim() || 'General';
  const examCat = data.examCategory === 'JEE_MAINS' ? 'JEE_MAINS' : 'GATE';

  // In-memory caches to eliminate redundant roundtrips across the network
  const subjectCache = new Map<string, number>();
  const topicCache = new Map<string, number>();

  // Helper to resolve Subject ID quickly
  async function getSubjectId(name: string): Promise<number> {
    if (subjectCache.has(name)) return subjectCache.get(name)!;
    const subj = await prisma.subject.upsert({
      where: { name },
      create: { name, examCategory: examCat },
      update: { examCategory: examCat },
      select: { id: true },
    });
    subjectCache.set(name, subj.id);
    return subj.id;
  }

  // Helper to resolve Topic ID quickly
  async function getTopicId(subjectId: number, name: string): Promise<number> {
    const key = `${subjectId}:::${name}`;
    if (topicCache.has(key)) return topicCache.get(key)!;
    const top = await prisma.topic.upsert({
      where: {
        subjectId_name: {
          subjectId,
          name,
        },
      },
      create: {
        subjectId,
        name,
      },
      update: {},
      select: { id: true },
    });
    topicCache.set(key, top.id);
    return top.id;
  }

  // Step 1: Pre-process questions and compute hashes in memory
  interface PreparedQuestion {
    rawQuestionText: string;
    subjectName: string;
    topicName: string;
    qType: 'MCQ' | 'MSQ' | 'NAT';
    qMarks: 1 | 2;
    solutionText: string;
    contentHash: string;
    optionsJson: string | null;
    answerJson: string;
    imageUrl: string | null;
    solutionImageUrl: string | null;
  }

  const prepared: PreparedQuestion[] = [];
  const hashes: string[] = [];

  for (const q of data.questions) {
    const rawQuestionText = (q.question || q.questionText || q.text || '').trim();
    if (!rawQuestionText) continue;

    const subjectName = q.subject?.trim() || defaultSub;
    const topicName = q.topic?.trim() || inferTopicFromQuestion(rawQuestionText, defaultTop);
    const rawType = (q.type || 'MCQ').toString().trim().toUpperCase();
    const qType = (['MCQ', 'MSQ', 'NAT'].includes(rawType) ? rawType : 'MCQ') as 'MCQ' | 'MSQ' | 'NAT';
    const qMarks = (q.marks === 2 ? 2 : 1) as 1 | 2;
    const solutionText = (q.solution || q.explanation || '').trim();
    const contentHash = computeContentHash(rawQuestionText, qType, q.options);

    hashes.push(contentHash);
    prepared.push({
      rawQuestionText,
      subjectName,
      topicName,
      qType,
      qMarks,
      solutionText,
      contentHash,
      optionsJson: q.options ? JSON.stringify(q.options) : null,
      answerJson: q.answer !== undefined ? JSON.stringify(q.answer) : '0',
      imageUrl: q.imageUrl || null,
      solutionImageUrl: q.solutionImageUrl || null,
    });
  }

  if (prepared.length === 0) {
    return { totalProcessed: 0, newInserted: 0, duplicatesSkipped: 0, insertedIds: [] };
  }

  // Step 2: Batch fetch all existing questions by hash in a SINGLE database query
  const existingQuestions = await prisma.question.findMany({
    where: { contentHash: { in: hashes } },
    select: { id: true, contentHash: true, isArchived: true },
  });
  const existingMap = new Map(existingQuestions.map((eq) => [eq.contentHash, eq]));

  // Step 3: Insert or update questions using cached subject & topic IDs
  const unarchiveIds: number[] = [];

  for (const p of prepared) {
    const existing = existingMap.get(p.contentHash);

    if (existing) {
      duplicatesSkipped++;
      if (existing.isArchived) {
        unarchiveIds.push(existing.id);
      }
      insertedIds.push(existing.id);
    } else {
      const subjectId = await getSubjectId(p.subjectName);
      const topicId = await getTopicId(subjectId, p.topicName);

      const created = await prisma.question.create({
        data: {
          contentHash: p.contentHash,
          subjectId,
          topicId,
          type: p.qType,
          marks: p.qMarks,
          questionText: p.rawQuestionText,
          optionsJson: p.optionsJson,
          answerJson: p.answerJson,
          solution: p.solutionText,
          imageUrl: p.imageUrl,
          solutionImageUrl: p.solutionImageUrl,
          sourceTestTitle: testTitle,
          isArchived: false,
        },
        select: { id: true },
      });

      newInserted++;
      insertedIds.push(created.id);
      // Mark as existing in current batch to prevent intra-batch duplicates
      existingMap.set(p.contentHash, { id: created.id, contentHash: p.contentHash, isArchived: false });
    }
  }

  // Batch unarchive if any were found
  if (unarchiveIds.length > 0) {
    await prisma.question.updateMany({
      where: { id: { in: unarchiveIds } },
      data: { isArchived: false },
    });
  }

  return {
    totalProcessed: data.questions.length,
    newInserted,
    duplicatesSkipped,
    insertedIds,
  };
}
