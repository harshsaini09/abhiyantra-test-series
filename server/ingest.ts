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
  tikzCode?: string | null;
  solutionImageUrl?: string | null;
  solutionTikzCode?: string | null;
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

export async function ingestQuestions(data: IngestTestInput): Promise<IngestResult> {
  let newInserted = 0;
  let duplicatesSkipped = 0;
  const insertedIds: number[] = [];

  const testTitle = data.title?.trim() || 'Imported Test';
  const defaultSub = data.defaultSubject?.trim() || data.subject?.trim() || 'General / Unassigned';
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
    tikzCode: string | null;
    solutionImageUrl: string | null;
    solutionTikzCode: string | null;
  }

  const prepared: PreparedQuestion[] = [];
  const hashes: string[] = [];

  for (const q of data.questions) {
    const rawQuestionText = (q.question || q.questionText || q.text || '').trim();
    if (!rawQuestionText) continue;

    const subjectName = q.subject?.trim() || defaultSub;
    const topicName = q.topic?.trim() || defaultTop;
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
      tikzCode: q.tikzCode || null,
      solutionImageUrl: q.solutionImageUrl || null,
      solutionTikzCode: q.solutionTikzCode || null,
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
          tikzCode: p.tikzCode,
          solutionImageUrl: p.solutionImageUrl,
          solutionTikzCode: p.solutionTikzCode,
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
