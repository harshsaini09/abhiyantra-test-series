import { Router, Request, Response } from 'express';
import { prisma, isDbConfigured } from './db.js';
import { requireAuth, requireTeacherOrAdmin, AuthenticatedRequest } from './auth.js';

const router = Router();

// Helper to sanitize test data payload
function sanitizeTestData(input: any, defaultTitle = 'GATE Test Paper') {
  let questions: any[] = [];
  let title = defaultTitle;
  let description = 'Official GATE Mock Test Series Paper';
  let duration = 180;

  if (Array.isArray(input)) {
    questions = input;
  } else if (input && Array.isArray(input.questions)) {
    questions = input.questions;
    title = input.title || title;
    description = input.description || description;
    duration = input.duration || duration;
  } else if (input && Array.isArray(input.test?.questions)) {
    questions = input.test.questions;
    title = input.test.title || title;
    description = input.test.description || description;
    duration = input.test.duration || duration;
  } else if (input && Array.isArray(input.data?.questions)) {
    questions = input.data.questions;
    title = input.data.title || title;
    description = input.data.description || description;
    duration = input.data.duration || duration;
  }

  // Calculate total marks
  const totalMarks = questions.reduce((sum: number, q: any) => sum + (Number(q.marks) || 1), 0);
  const totalQuestions = questions.length;

  return {
    title,
    description,
    duration,
    totalQuestions,
    totalMarks,
    questions,
  };
}

// ─── 1. Get Official Teacher-Made Test Series (Public / Student View) ───
router.get('/official', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isDbConfigured || !prisma) {
      res.json({ tests: [] });
      return;
    }

    const { examCategory } = req.query;
    const whereClause: any = { isOfficial: true };
    if (examCategory && (examCategory === 'GATE' || examCategory === 'JEE_MAINS')) {
      whereClause.examCategory = examCategory;
    }

    const tests = await prisma.publishedTest.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        examCategory: true,
        subject: true,
        totalQuestions: true,
        totalMarks: true,
        durationMinutes: true,
        creatorRole: true,
        isOfficial: true,
        createdAt: true,
        creator: {
          select: {
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    res.json({ tests });
  } catch (err: any) {
    console.error('Error fetching official test series:', err);
    res.status(500).json({ error: 'Failed to fetch official test series.' });
  }
});

// ─── 2. Get Single Official Test Details (With full questions for CBT) ───
router.get('/official/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isDbConfigured || !prisma) {
      res.status(404).json({ error: 'Database not connected.' });
      return;
    }

    const test = await prisma.publishedTest.findFirst({
      where: { id, isOfficial: true },
      include: {
        creator: {
          select: { name: true, email: true },
        },
      },
    });

    if (!test) {
      res.status(404).json({ error: 'Test paper not found.' });
      return;
    }

    const parsedQuestions = JSON.parse(test.questionsJson);
    res.json({
      test: {
        id: test.id,
        title: test.title,
        description: test.description,
        duration: test.durationMinutes,
        totalQuestions: test.totalQuestions,
        totalMarks: test.totalMarks,
        category: test.category,
        examCategory: test.examCategory,
        questions: parsedQuestions,
        creator: test.creator,
      },
    });
  } catch (err: any) {
    console.error('Error fetching official test item:', err);
    res.status(500).json({ error: 'Failed to load test paper.' });
  }
});

// ─── 3. Upload & Publish Official Test Series (Teachers & Admins Only) ───
router.post('/upload', requireTeacherOrAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.id) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const { title, description, category = 'FULL_MOCK', examCategory = 'GATE', subject, testData } = req.body;
    const rawData = testData || req.body;
    const sanitized = sanitizeTestData(rawData, title || 'Official GATE Test Series');

    if (!sanitized.questions || sanitized.questions.length === 0) {
      res.status(400).json({ error: 'Test file must contain at least 1 valid question in a "questions" array.' });
      return;
    }

    if (!isDbConfigured || !prisma) {
      res.status(500).json({ error: 'Database not connected.' });
      return;
    }

    const created = await prisma.publishedTest.create({
      data: {
        title: title || sanitized.title,
        description: description || sanitized.description,
        category: category || (sanitized.totalQuestions >= 50 ? 'FULL_MOCK' : 'SUBJECT_PACK'),
        examCategory: examCategory === 'JEE_MAINS' ? 'JEE_MAINS' : 'GATE',
        subject: subject || (sanitized.questions[0]?.subject || null),
        totalQuestions: sanitized.totalQuestions,
        totalMarks: sanitized.totalMarks,
        durationMinutes: sanitized.duration || (sanitized.totalQuestions >= 50 ? 180 : Math.ceil(sanitized.totalQuestions * 2.5)),
        questionsJson: JSON.stringify(sanitized.questions),
        creatorId: user.id,
        creatorRole: user.role || 'TEACHER',
        isOfficial: true,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Official Test Series published successfully.',
      test: {
        id: created.id,
        title: created.title,
        totalQuestions: created.totalQuestions,
        totalMarks: created.totalMarks,
        category: created.category,
      },
    });
  } catch (err: any) {
    console.error('Error uploading official test series:', err);
    res.status(500).json({ error: err?.message || 'Failed to publish official test series.' });
  }
});

// ─── 4. Get Student's "My Personal Test Series" (Authenticated Student / Creator) ───
router.get('/my-personal', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.id) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    if (!isDbConfigured || !prisma) {
      res.json({ tests: [] });
      return;
    }

    const { examCategory } = req.query;
    const whereClause: any = {
      creatorId: user.id,
      isOfficial: false,
    };
    if (examCategory && (examCategory === 'GATE' || examCategory === 'JEE_MAINS')) {
      whereClause.examCategory = examCategory;
    }

    const tests = await prisma.publishedTest.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        examCategory: true,
        subject: true,
        totalQuestions: true,
        totalMarks: true,
        durationMinutes: true,
        createdAt: true,
      },
    });

    res.json({ tests });
  } catch (err: any) {
    console.error('Error fetching personal test series:', err);
    res.status(500).json({ error: 'Failed to fetch personal test series.' });
  }
});

// ─── 5. Get Single Personal Test Details for CBT Exam ───
router.get('/my-personal/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const { id } = req.params;

    if (!user || !user.id) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    if (!isDbConfigured || !prisma) {
      res.status(404).json({ error: 'Database not connected.' });
      return;
    }

    const test = await prisma.publishedTest.findFirst({
      where: {
        id,
        creatorId: user.id,
      },
    });

    if (!test) {
      res.status(404).json({ error: 'Personal test paper not found.' });
      return;
    }

    const parsedQuestions = JSON.parse(test.questionsJson);
    res.json({
      test: {
        id: test.id,
        title: test.title,
        description: test.description,
        duration: test.durationMinutes,
        totalQuestions: test.totalQuestions,
        totalMarks: test.totalMarks,
        category: test.category,
        examCategory: test.examCategory,
        questions: parsedQuestions,
      },
    });
  } catch (err: any) {
    console.error('Error loading personal test:', err);
    res.status(500).json({ error: 'Failed to load personal test paper.' });
  }
});

// ─── 6. Save Test to "My Personal Test Series" (Pro Pass ₹59 or Teacher/Admin) ───
router.post('/save-personal', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.id) {
      res.status(401).json({ error: 'Please sign in to save tests to your personal series.' });
      return;
    }

    // Must have ₹59 Pro Pass or be Teacher/Admin
    const isTeacherOrAdmin = user.role === 'ADMIN' || user.role === 'TEACHER' || user.email.toLowerCase() === 'harshsaini0912@gmail.com';
    const isProPassHolder = user.isSubscribed && user.subscriptionTier !== 'gate-booster-pass';

    if (!isTeacherOrAdmin && !isProPassHolder) {
      res.status(403).json({
        error: 'Creating personal test series requires the ₹59 Complete Pro Pass. Please upgrade your pass to unlock this feature.',
      });
      return;
    }

    const { title, description, category = 'PERSONAL', examCategory = 'GATE', subject, testData } = req.body;
    const rawData = testData || req.body;
    const sanitized = sanitizeTestData(rawData, title || 'My Custom Test Paper');

    if (!sanitized.questions || sanitized.questions.length === 0) {
      res.status(400).json({ error: 'Cannot save empty test. Please select at least 1 question.' });
      return;
    }

    if (!isDbConfigured || !prisma) {
      res.status(500).json({ error: 'Database not connected.' });
      return;
    }

    const created = await prisma.publishedTest.create({
      data: {
        title: title || sanitized.title,
        description: description || sanitized.description,
        category,
        examCategory: examCategory === 'JEE_MAINS' ? 'JEE_MAINS' : 'GATE',
        subject: subject || (sanitized.questions[0]?.subject || 'Custom Mix'),
        totalQuestions: sanitized.totalQuestions,
        totalMarks: sanitized.totalMarks,
        durationMinutes: sanitized.duration || Math.ceil(sanitized.totalQuestions * 2.5),
        questionsJson: JSON.stringify(sanitized.questions),
        creatorId: user.id,
        creatorRole: user.role || 'STUDENT',
        isOfficial: false,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Test saved to "My Personal Test Series".',
      test: {
        id: created.id,
        title: created.title,
        totalQuestions: created.totalQuestions,
        totalMarks: created.totalMarks,
      },
    });
  } catch (err: any) {
    console.error('Error saving personal test:', err);
    res.status(500).json({ error: err?.message || 'Failed to save personal test.' });
  }
});

// ─── 7. Delete Test Paper (Creator or Admin) ───
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const { id } = req.params;

    if (!user || !user.id) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    if (!isDbConfigured || !prisma) {
      res.status(500).json({ error: 'Database not connected.' });
      return;
    }

    const isMasterAdmin = user.role === 'ADMIN' || user.email.toLowerCase() === 'harshsaini0912@gmail.com';

    const test = await prisma.publishedTest.findUnique({
      where: { id },
    });

    if (!test) {
      res.status(404).json({ error: 'Test not found.' });
      return;
    }

    // Only creator or master admin can delete
    if (test.creatorId !== user.id && !isMasterAdmin) {
      res.status(403).json({ error: 'Access denied. You can only delete your own tests.' });
      return;
    }

    await prisma.publishedTest.delete({
      where: { id },
    });

    res.json({ success: true, message: 'Test deleted successfully.' });
  } catch (err: any) {
    console.error('Error deleting test:', err);
    res.status(500).json({ error: 'Failed to delete test.' });
  }
});

// ─── 8. Update Test Details and Questions (Teachers & Admins) ───
router.put('/:id', requireTeacherOrAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { title, description, questions, duration } = req.body;

    if (!user || !user.id) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    if (!isDbConfigured || !prisma) {
      res.status(500).json({ error: 'Database not connected.' });
      return;
    }

    const test = await prisma.publishedTest.findUnique({ where: { id } });
    if (!test) {
      res.status(404).json({ error: 'Test not found.' });
      return;
    }

    const isMasterAdmin = user.role === 'ADMIN' || user.email.toLowerCase() === 'harshsaini0912@gmail.com';
    if (test.creatorId !== user.id && !isMasterAdmin && user.role !== 'TEACHER') {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    const updateData: any = {};
    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (duration && Number(duration) > 0) updateData.durationMinutes = Number(duration);
    if (Array.isArray(questions)) {
      updateData.questionsJson = JSON.stringify(questions);
      updateData.totalQuestions = questions.length;
      updateData.totalMarks = questions.reduce((sum: number, q: any) => sum + (Number(q.marks) || 1), 0);
    }

    const updated = await prisma.publishedTest.update({
      where: { id },
      data: updateData,
    });

    res.json({ success: true, message: 'Test updated successfully.', test: updated });
  } catch (err: any) {
    console.error('Error updating test:', err);
    res.status(500).json({ error: err.message || 'Failed to update test.' });
  }
});

export default router;
