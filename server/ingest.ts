import { prisma } from './db';
import { computeContentHash } from './contentHash';

export interface IngestQuestionInput {
  id?: number;
  type: 'MCQ' | 'MSQ' | 'NAT';
  marks: 1 | 2;
  subject?: string;
  topic?: string;
  question: string;
  options?: string[];
  answer: unknown;
  solution: string;
  imageUrl?: string;
  tikzCode?: string;
  solutionImageUrl?: string;
  solutionTikzCode?: string;
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
    const subjectName = q.subject?.trim() || defaultSub;
    const topicName = q.topic?.trim() || defaultTop;

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
    const contentHash = computeContentHash(q.question, q.type, q.options);

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
          type: q.type,
          marks: q.marks,
          questionText: q.question.trim(),
          optionsJson: q.options ? JSON.stringify(q.options) : null,
          answerJson: JSON.stringify(q.answer),
          solution: q.solution.trim(),
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
