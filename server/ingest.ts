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

  for (const q of data.questions) {
    const rawQuestionText = (q.question || q.questionText || q.text || '').trim();
    if (!rawQuestionText) continue;

    const subjectName = q.subject?.trim() || defaultSub;
    const topicName = q.topic?.trim() || defaultTop;
    const rawType = (q.type || 'MCQ').toString().trim().toUpperCase();
    const qType = (['MCQ', 'MSQ', 'NAT'].includes(rawType) ? rawType : 'MCQ') as 'MCQ' | 'MSQ' | 'NAT';
    const qMarks = (q.marks === 2 ? 2 : 1) as 1 | 2;
    const solutionText = (q.solution || q.explanation || '').trim();

    // 1. Upsert Subject
    const subject = await prisma.subject.upsert({
      where: { name: subjectName },
      create: { name: subjectName },
      update: {},
    });

    // 2. Upsert Topic under this Subject
    const topic = await prisma.topic.upsert({
      where: {
        subjectId_name: {
          subjectId: subject.id,
          name: topicName,
        },
      },
      create: {
        subjectId: subject.id,
        name: topicName,
      },
      update: {},
    });

    // 3. Compute Content Hash
    const contentHash = computeContentHash(rawQuestionText, qType, q.options);

    // 4. Check if question already exists
    const existing = await prisma.question.findUnique({
      where: { contentHash },
    });

    if (existing) {
      duplicatesSkipped++;
      // If it was soft-deleted, unarchive it
      if (existing.isArchived) {
        await prisma.question.update({
          where: { id: existing.id },
          data: { isArchived: false },
        });
      }
      insertedIds.push(existing.id);
    } else {
      const created = await prisma.question.create({
        data: {
          contentHash,
          subjectId: subject.id,
          topicId: topic.id,
          type: qType,
          marks: qMarks,
          questionText: rawQuestionText,
          optionsJson: q.options ? JSON.stringify(q.options) : null,
          answerJson: q.answer !== undefined ? JSON.stringify(q.answer) : '0',
          solution: solutionText,
          imageUrl: q.imageUrl || null,
          tikzCode: q.tikzCode || null,
          solutionImageUrl: q.solutionImageUrl || null,
          solutionTikzCode: q.solutionTikzCode || null,
          sourceTestTitle: testTitle,
          isArchived: false,
        },
      });
      newInserted++;
      insertedIds.push(created.id);
    }
  }

  return {
    totalProcessed: data.questions.length,
    newInserted,
    duplicatesSkipped,
    insertedIds,
  };
}
