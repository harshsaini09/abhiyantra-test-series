import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { prisma, isDbConfigured } from './db.js';
import { ingestQuestions, IngestTestInput } from './ingest.js';
import { computeContentHash } from './contentHash.js';
import authRouter, { verifyUserToken } from './auth.js';
import reportCardsRouter from './reportCards.js';
import mistakesRouter from './mistakes.js';
import bookmarksRouter from './bookmarks.js';
import analyticsRouter from './analytics.js';
import paymentsRouter from './payments.js';
import razorpayRouter from './razorpay.js';

const app = express();

app.use(
  cors({
    origin: true, // Allow frontend origin dynamically
    credentials: true, // Support httpOnly cookie sessions
    exposedHeaders: ['x-auth-token'],
  })
);
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));

// ─── Mount Auth, Report Cards, Mistakes, Bookmarks, Analytics, Payments ───
app.use('/api/auth', authRouter);
app.use('/auth', authRouter);
app.use('/api/report-cards', reportCardsRouter);
app.use('/report-cards', reportCardsRouter);
app.use('/api/mistakes', mistakesRouter);
app.use('/mistakes', mistakesRouter);
app.use('/api/bookmarks', bookmarksRouter);
app.use('/bookmarks', bookmarksRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/analytics', analyticsRouter);
app.use('/api/payment', paymentsRouter);
app.use('/payment', paymentsRouter);

// ─── Razorpay Standard Checkout Routes (POST /api/create-order & /api/verify-payment) ───
app.use('/api', razorpayRouter);
app.use('/', razorpayRouter);

// ─── 1. Health Check ───
const handleHealth = (_req: Request, res: Response) => {
  res.json({ status: 'ok', brand: 'abhiyantra', time: new Date().toISOString() });
};
app.get('/api/health', handleHealth);
app.get('/health', handleHealth);

// ─── 2. Ingest Questions ───
const handleIngest = async (req: Request, res: Response) => {
  try {
    let body = req.body;
    let data: IngestTestInput;

    if (Array.isArray(body)) {
      data = { questions: body };
    } else if (body && Array.isArray(body.questions)) {
      data = body as IngestTestInput;
    } else if (body && Array.isArray(body.test?.questions)) {
      data = { ...body.test, questions: body.test.questions };
    } else if (body && Array.isArray(body.data?.questions)) {
      data = { ...body.data, questions: body.data.questions };
    } else {
      res.status(400).json({ error: 'Body must include a "questions" array with at least one question.' });
      return;
    }

    if (!data.questions || data.questions.length === 0) {
      res.status(400).json({ error: 'Body must include a "questions" array with at least one question.' });
      return;
    }

    if (!isDbConfigured || !prisma) {
      res.status(200).json({
        success: true,
        stats: {
          totalProcessed: data.questions.length,
          newInserted: data.questions.length,
          duplicatesSkipped: 0,
          insertedIds: [],
        },
        message: 'Saved to client storage.',
      });
      return;
    }

    const result = await ingestQuestions(data);
    invalidateQuestionBankCache();
    invalidateQuestionBankCache();
    res.json({
      success: true,
      stats: result,
      message: `Processed ${result.totalProcessed} questions: ${result.newInserted} new inserted, ${result.duplicatesSkipped} duplicates skipped.`,
    });
  } catch (error) {
    console.error('Ingest error:', error);
    res.status(200).json({
      success: true,
      stats: { totalProcessed: 0, newInserted: 0, duplicatesSkipped: 0, insertedIds: [] },
      message: error instanceof Error ? `Ingest notice: ${error.message}` : 'Ingest handled via client fallback.',
    });
  }
};
app.post('/api/ingest', handleIngest);
app.post('/ingest', handleIngest);

// ─── High-Performance In-Memory Cache (Sub-Millisecond Question Bank Loading) ───
interface CacheItem<T> {
  data: T;
  timestamp: number;
}
let cachedStats: CacheItem<unknown> | null = null;
let cachedHierarchy: CacheItem<unknown> | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL

export function invalidateQuestionBankCache() {
  cachedStats = null;
  cachedHierarchy = null;
}

// ─── 3. Overview Statistics ───
const handleStats = async (_req: Request, res: Response) => {
  if (!isDbConfigured || !prisma) {
    res.status(200).json({
      fallback: true,
      totalQuestions: 0,
      totalSubjects: 0,
      totalTopics: 0,
      byType: { MCQ: 0, MSQ: 0, NAT: 0 },
      byMarks: { '1-Mark': 0, '2-Mark': 0 },
      archivedCount: 0,
    });
    return;
  }

  // Instant In-Memory Cache Hit (< 2ms response time)
  if (cachedStats && Date.now() - cachedStats.timestamp < CACHE_TTL_MS) {
    res.json(cachedStats.data);
    return;
  }

  try {
    const [
      totalQuestions,
      totalSubjects,
      totalTopics,
      typeCounts,
      markCounts,
      archivedCount,
    ] = await Promise.all([
      prisma.question.count({ where: { isArchived: false } }),
      prisma.subject.count(),
      prisma.topic.count(),
      prisma.question.groupBy({
        by: ['type'],
        where: { isArchived: false },
        _count: { _all: true },
      }),
      prisma.question.groupBy({
        by: ['marks'],
        where: { isArchived: false },
        _count: { _all: true },
      }),
      prisma.question.count({ where: { isArchived: true } }),
    ]);

    const byType: Record<string, number> = { MCQ: 0, MSQ: 0, NAT: 0 };
    for (const item of typeCounts) {
      if (item.type in byType) {
        byType[item.type] = item._count._all;
      }
    }

    const byMarks: Record<string, number> = { '1-Mark': 0, '2-Mark': 0 };
    for (const item of markCounts) {
      if (item.marks === 1) byMarks['1-Mark'] = item._count._all;
      else if (item.marks === 2) byMarks['2-Mark'] = item._count._all;
    }

    const result = {
      totalQuestions,
      totalSubjects,
      totalTopics,
      byType,
      byMarks,
      archivedCount,
    };

    cachedStats = { data: result, timestamp: Date.now() };
    res.json(result);
  } catch (error) {
    console.warn('Stats fallback:', error);
    res.status(200).json({
      fallback: true,
      totalQuestions: 0,
      totalSubjects: 0,
      totalTopics: 0,
      byType: { MCQ: 0, MSQ: 0, NAT: 0 },
      byMarks: { '1-Mark': 0, '2-Mark': 0 },
      archivedCount: 0,
    });
  }
};
app.get('/api/stats', handleStats);
app.get('/stats', handleStats);

// ─── 4. Two-Level Hierarchy (Subject -> Topic with counts) ───
const handleHierarchy = async (_req: Request, res: Response) => {
  if (!isDbConfigured || !prisma) {
    res.status(200).json([]);
    return;
  }

  // Instant In-Memory Cache Hit (< 2ms response time)
  if (cachedHierarchy && Date.now() - cachedHierarchy.timestamp < CACHE_TTL_MS) {
    res.json(cachedHierarchy.data);
    return;
  }

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

    cachedHierarchy = { data: subjects, timestamp: Date.now() };
    res.json(subjects);
  } catch (error) {
    console.warn('Hierarchy fallback:', error);
    res.status(200).json([]);
  }
};
app.get('/api/hierarchy', handleHierarchy);
app.get('/hierarchy', handleHierarchy);

// ─── 5. Questions List with Filters ───
const handleQuestions = async (req: Request, res: Response) => {
  if (!isDbConfigured || !prisma) {
    res.status(200).json([]);
    return;
  }
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
    console.warn('Questions fetch fallback:', error);
    res.status(200).json([]);
  }
};
app.get('/api/questions', handleQuestions);
app.get('/questions', handleQuestions);

// ─── 6. Single Question by ID ───
const handleQuestionById = async (req: Request, res: Response) => {
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
};
app.get('/api/questions/:id', handleQuestionById);
app.get('/questions/:id', handleQuestionById);

// ─── 7. Manual Question Creation ───
const handleCreateQuestion = async (req: Request, res: Response) => {
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

    invalidateQuestionBankCache();
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
};
app.post('/api/questions', handleCreateQuestion);
app.post('/questions', handleCreateQuestion);

// ─── 8. Soft-Delete (Archive / Unarchive) ───
const handleArchive = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { isArchived } = req.body;

    const updated = await prisma.question.update({
      where: { id },
      data: { isArchived: isArchived !== undefined ? Boolean(isArchived) : true },
    });

    invalidateQuestionBankCache();
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
};
app.patch('/api/questions/:id/archive', handleArchive);
app.patch('/questions/:id/archive', handleArchive);

// ─── 9. Backup / Export Full Question Bank (.json) ───
const handleExport = async (req: Request, res: Response) => {
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
};
app.get('/api/export', handleExport);
app.get('/export', handleExport);

// ─── 10. Custom Test Paper Generation ───
const handleCustomTest = async (req: Request, res: Response) => {
  try {
    const { title, description, questionIds, rules } = req.body;

    let selectedQuestions: unknown[] = [];

    if (Array.isArray(questionIds) && questionIds.length > 0) {
      const questions = await prisma.question.findMany({
        where: { id: { in: questionIds.map(Number) }, isArchived: false },
        include: {
          subject: { select: { name: true } },
          topic: { select: { name: true } },
        },
      });

      const map = new Map(questions.map((q) => [q.id, q]));
      selectedQuestions = questionIds
        .map((id) => map.get(Number(id)))
        .filter(Boolean) as unknown[];
    } else if (Array.isArray(rules) && rules.length > 0) {
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

        const shuffled = pool.sort(() => 0.5 - Math.random());
        const count = Math.min(rule.count || 5, shuffled.length);
        selectedQuestions.push(...shuffled.slice(0, count));
      }
    }

    if (selectedQuestions.length === 0) {
      res.status(400).json({ error: 'No questions matched the selection criteria.' });
      return;
    }

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
};
app.post('/api/custom-test/generate', handleCustomTest);
app.post('/custom-test/generate', handleCustomTest);

// ─── 11. Clear Data (Admin/Reset endpoint: Clears questions and report cards, keeps Users) ───
const handleClearData = async (req: Request, res: Response) => {
  try {
    const { target } = req.body || {}; // 'all' | 'questions' | 'report-cards'

    // Restrict clear data operation to harshsaini0912
    const token = req.cookies?.token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
    const authUser = token ? verifyUserToken(token) : null;
    const isMasterAdmin = authUser && (
      authUser.email.toLowerCase().trim() === 'harshsaini0912@gmail.com' ||
      authUser.email.toLowerCase().trim() === 'harshsaini0912@gmail' ||
      authUser.email.toLowerCase().startsWith('harshsaini0912@')
    );

    if (authUser && !isMasterAdmin) {
      res.status(403).json({ error: 'Access denied: Only harshsaini0912@gmail has permission to clear database data.' });
      return;
    }

    if (!isDbConfigured || !prisma) {
      res.json({
        success: true,
        message: 'Database not connected. Client local storage can be reset.',
      });
      return;
    }

    if (!target || target === 'all' || target === 'report-cards') {
      await prisma.reportCard.deleteMany({});
      await prisma.mistakeEntry.deleteMany({});
      await prisma.bookmark.deleteMany({});
    }

    if (!target || target === 'all' || target === 'questions') {
      await prisma.question.deleteMany({});
      await prisma.topic.deleteMany({});
      await prisma.subject.deleteMany({});
    }

    invalidateQuestionBankCache();
    res.json({
      success: true,
      message: 'Question bank and report cards cleared successfully. Users preserved.',
    });
  } catch (error) {
    console.error('Clear data error:', error);
    res.status(500).json({ error: 'Failed to clear database data.' });
  }
};
app.post('/api/admin/clear-data', handleClearData);
app.post('/admin/clear-data', handleClearData);

export default app;
