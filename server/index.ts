import express from 'express';
import cors from 'cors';
import { prisma } from './db';
import { ingestQuestions, IngestTestInput } from './ingest';
import { computeContentHash } from './contentHash';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ─── 1. Health Check ───
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ─── 2. Ingest Questions ───
app.post('/api/ingest', async (req, res) => {
  try {
    const data = req.body as IngestTestInput;
    if (!data || !Array.isArray(data.questions) || data.questions.length === 0) {
      res.status(400).json({ error: 'Body must include a "questions" array with at least one question.' });
      return;
    }

    const result = await ingestQuestions(data);
    res.json({
      success: true,
      stats: result,
      message: `Processed ${result.totalProcessed} questions: ${result.newInserted} new inserted, ${result.duplicatesSkipped} duplicates skipped.`,
    });
  } catch (error) {
    console.error('Ingest error:', error);
    res.status(500).json({ error: 'Failed to ingest questions.' });
  }
});

// ─── 3. Overview Statistics ───
app.get('/api/stats', async (_req, res) => {
  try {
    const [
      totalQuestions,
      totalSubjects,
      totalTopics,
      mcqCount,
      msqCount,
      natCount,
      oneMarkCount,
      twoMarkCount,
      archivedCount,
    ] = await Promise.all([
      prisma.question.count({ where: { isArchived: false } }),
      prisma.subject.count(),
      prisma.topic.count(),
      prisma.question.count({ where: { isArchived: false, type: 'MCQ' } }),
      prisma.question.count({ where: { isArchived: false, type: 'MSQ' } }),
      prisma.question.count({ where: { isArchived: false, type: 'NAT' } }),
      prisma.question.count({ where: { isArchived: false, marks: 1 } }),
      prisma.question.count({ where: { isArchived: false, marks: 2 } }),
      prisma.question.count({ where: { isArchived: true } }),
    ]);

    res.json({
      totalQuestions,
      totalSubjects,
      totalTopics,
      byType: { MCQ: mcqCount, MSQ: msqCount, NAT: natCount },
      byMarks: { '1-Mark': oneMarkCount, '2-Mark': twoMarkCount },
      archivedCount,
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to load statistics.' });
  }
});

// ─── 4. Two-Level Hierarchy (Subject -> Topic with counts) ───
app.get('/api/hierarchy', async (_req, res) => {
  try {
    const subjects = await prisma.subject.findMany({
      orderBy: { name: 'asc' },
      include: {
        topics: {
          orderBy: { name: 'asc' },
          include: {
            _count: {
              select: { questions: { where: { isArchived: false } } },
            },
          },
        },
        _count: {
          select: { questions: { where: { isArchived: false } } },
        },
      },
    });

    res.json(subjects);
  } catch (error) {
    console.error('Hierarchy error:', error);
    res.status(500).json({ error: 'Failed to fetch hierarchy.' });
  }
});

// ─── 5. Questions List with Filters ───
app.get('/api/questions', async (req, res) => {
  try {
    const { subjectId, topicId, type, marks, search, includeArchived } = req.query;

    const where: Record<string, unknown> = {};

    if (includeArchived !== 'true') {
      where.isArchived = false;
    }

    if (subjectId) {
      where.subjectId = Number(subjectId);
    }

    if (topicId) {
      where.topicId = Number(topicId);
    }

    if (type && typeof type === 'string') {
      where.type = type.toUpperCase();
    }

    if (marks) {
      where.marks = Number(marks);
    }

    if (search && typeof search === 'string' && search.trim()) {
      where.OR = [
        { questionText: { contains: search.trim() } },
        { solution: { contains: search.trim() } },
      ];
    }

    const questions = await prisma.question.findMany({
      where,
      orderBy: [{ subject: { name: 'asc' } }, { topic: { name: 'asc' } }, { id: 'asc' }],
      include: {
        subject: { select: { id: true, name: true } },
        topic: { select: { id: true, name: true } },
      },
    });

    const parsed = questions.map((q) => ({
      ...q,
      options: q.optionsJson ? JSON.parse(q.optionsJson) : undefined,
      answer: JSON.parse(q.answerJson),
    }));

    res.json(parsed);
  } catch (error) {
    console.error('Questions fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch questions.' });
  }
});

// ─── 6. Single Question by ID ───
app.get('/api/questions/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const question = await prisma.question.findUnique({
      where: { id },
      include: {
        subject: { select: { id: true, name: true } },
        topic: { select: { id: true, name: true } },
      },
    });

    if (!question) {
      res.status(404).json({ error: 'Question not found.' });
      return;
    }

    res.json({
      ...question,
      options: question.optionsJson ? JSON.parse(question.optionsJson) : undefined,
      answer: JSON.parse(question.answerJson),
    });
  } catch (error) {
    console.error('Question get error:', error);
    res.status(500).json({ error: 'Failed to retrieve question.' });
  }
});

// ─── 7. Manual Question Creation ───
app.post('/api/questions', async (req, res) => {
  try {
    const { subject, topic, type, marks, question, options, answer, solution } = req.body;

    if (!subject || !topic || !type || !marks || !question || answer === undefined || !solution) {
      res.status(400).json({ error: 'Missing required question fields.' });
      return;
    }

    const subjectRecord = await prisma.subject.upsert({
      where: { name: subject.trim() },
      create: { name: subject.trim() },
      update: {},
    });

    const topicRecord = await prisma.topic.upsert({
      where: {
        subjectId_name: {
          subjectId: subjectRecord.id,
          name: topic.trim(),
        },
      },
      create: {
        subjectId: subjectRecord.id,
        name: topic.trim(),
      },
      update: {},
    });

    const contentHash = computeContentHash(question, type, options);

    const created = await prisma.question.create({
      data: {
        contentHash,
        subjectId: subjectRecord.id,
        topicId: topicRecord.id,
        type,
        marks: Number(marks),
        questionText: question.trim(),
        optionsJson: options ? JSON.stringify(options) : null,
        answerJson: JSON.stringify(answer),
        solution: solution.trim(),
        sourceTestTitle: 'Manual Entry',
      },
      include: {
        subject: { select: { id: true, name: true } },
        topic: { select: { id: true, name: true } },
      },
    });

    res.status(201).json({
      ...created,
      options: created.optionsJson ? JSON.parse(created.optionsJson) : undefined,
      answer: JSON.parse(created.answerJson),
    });
  } catch (error: unknown) {
    console.error('Question create error:', error);
    if ((error as { code?: string }).code === 'P2002') {
      res.status(409).json({ error: 'A question with this exact content and type already exists.' });
      return;
    }
    res.status(500).json({ error: 'Failed to create question.' });
  }
});

// ─── 8. Soft-Delete (Archive / Unarchive) ───
app.patch('/api/questions/:id/archive', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { isArchived } = req.body;

    const updated = await prisma.question.update({
      where: { id },
      data: { isArchived: isArchived !== undefined ? Boolean(isArchived) : true },
    });

    res.json({
      success: true,
      id: updated.id,
      isArchived: updated.isArchived,
      message: updated.isArchived ? 'Question archived (soft-deleted).' : 'Question restored.',
    });
  } catch (error) {
    console.error('Archive error:', error);
    res.status(500).json({ error: 'Failed to update archive status.' });
  }
});

// ─── 9. Backup / Export Full Question Bank (.json) ───
app.get('/api/export', async (req, res) => {
  try {
    const { subjectId, topicId } = req.query;
    const where: Record<string, unknown> = { isArchived: false };
    if (subjectId) where.subjectId = Number(subjectId);
    if (topicId) where.topicId = Number(topicId);

    const questions = await prisma.question.findMany({
      where,
      orderBy: [{ subject: { name: 'asc' } }, { topic: { name: 'asc' } }, { id: 'asc' }],
      include: {
        subject: { select: { name: true } },
        topic: { select: { name: true } },
      },
    });

    const exportData = {
      title: 'GATE Question Bank Export',
      description: `Complete export containing ${questions.length} questions, generated on ${new Date().toLocaleDateString()}.`,
      exportedAt: new Date().toISOString(),
      questions: questions.map((q, idx) => ({
        id: idx + 1,
        subject: q.subject.name,
        topic: q.topic.name,
        type: q.type,
        marks: q.marks,
        question: q.questionText,
        options: q.optionsJson ? JSON.parse(q.optionsJson) : undefined,
        answer: JSON.parse(q.answerJson),
        solution: q.solution,
      })),
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="gate-question-bank-export-${Date.now()}.json"`);
    res.json(exportData);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export questions.' });
  }
});

// ─── 10. Custom Test Paper Generation ───
app.post('/api/custom-test/generate', async (req, res) => {
  try {
    const { title, description, questionIds, rules } = req.body;

    let selectedQuestions: unknown[] = [];

    if (Array.isArray(questionIds) && questionIds.length > 0) {
      // Direct question ID selection
      const questions = await prisma.question.findMany({
        where: { id: { in: questionIds.map(Number) }, isArchived: false },
        include: {
          subject: { select: { name: true } },
          topic: { select: { name: true } },
        },
      });

      // Maintain order requested if possible
      const map = new Map(questions.map((q) => [q.id, q]));
      selectedQuestions = questionIds
        .map((id) => map.get(Number(id)))
        .filter(Boolean) as unknown[];
    } else if (Array.isArray(rules) && rules.length > 0) {
      // Rule-based selection (e.g. 5 questions from Data Structures, 3 from OS)
      for (const rule of rules) {
        const where: Record<string, unknown> = { isArchived: false };
        if (rule.subjectId) where.subjectId = Number(rule.subjectId);
        if (rule.topicId) where.topicId = Number(rule.topicId);
        if (rule.type) where.type = rule.type;
        if (rule.marks) where.marks = Number(rule.marks);

        const pool = await prisma.question.findMany({
          where,
          include: {
            subject: { select: { name: true } },
            topic: { select: { name: true } },
          },
        });

        // Shuffle pool
        const shuffled = pool.sort(() => 0.5 - Math.random());
        const count = Math.min(rule.count || 5, shuffled.length);
        selectedQuestions.push(...shuffled.slice(0, count));
      }
    }

    if (selectedQuestions.length === 0) {
      res.status(400).json({ error: 'No questions matched the selection criteria.' });
      return;
    }

    // Format as standard TestData schema
    const testData = {
      title: title?.trim() || 'Custom Built GATE Mock Test',
      description: description?.trim() || `Custom paper with ${selectedQuestions.length} questions selected from Question Bank.`,
      questions: (selectedQuestions as Array<{
        id: number;
        subject: { name: string };
        topic: { name: string };
        type: string;
        marks: number;
        questionText: string;
        optionsJson: string | null;
        answerJson: string;
        solution: string;
      }>).map((q, idx) => ({
        id: idx + 1,
        subject: q.subject.name,
        topic: q.topic.name,
        type: q.type as 'MCQ' | 'MSQ' | 'NAT',
        marks: q.marks as 1 | 2,
        question: q.questionText,
        options: q.optionsJson ? JSON.parse(q.optionsJson) : undefined,
        answer: JSON.parse(q.answerJson),
        solution: q.solution,
      })),
    };

    res.json(testData);
  } catch (error) {
    console.error('Custom test generation error:', error);
    res.status(500).json({ error: 'Failed to generate custom test.' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend API running on http://localhost:${PORT}`);
});
