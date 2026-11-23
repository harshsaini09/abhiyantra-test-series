import { Router, Response } from 'express';
import { prisma, isDbConfigured } from './db.js';
import { requireAuth, AuthenticatedRequest } from './auth.js';
import { computeContentHash } from './contentHash.js';

const router = Router();

// Apply requireAuth to all report card routes
router.use(requireAuth);

// ─── 1. Save Completed Report Card (POST /api/report-cards) ───
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const {
      testTitle,
      mode,
      totalQuestions,
      maxMarks,
      score,
      accuracy,
      correctCount,
      incorrectCount,
      unattemptedCount,
      positiveMarks,
      negativeMarks,
      timeTakenSeconds,
      allocatedSeconds,
      breakdownJson,
      detailedReviewJson,
    } = req.body;

    if (!testTitle || score === undefined || totalQuestions === undefined) {
      res.status(400).json({ error: 'Missing required report card fields.' });
      return;
    }

    // Ensure User exists in DB before linking ReportCard
    let dbUserId = user.id;
    try {
      const existingUser = await prisma.user.findUnique({
        where: { email: user.email },
      });
      if (!existingUser) {
        const createdUser = await prisma.user.create({
          data: {
            googleId: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
          },
        });
        dbUserId = createdUser.id;
      } else {
        dbUserId = existingUser.id;
      }
    } catch (userErr) {
      console.warn('Could not ensure user in DB:', userErr);
    }

    const reviewsArray = typeof detailedReviewJson === 'string' ? JSON.parse(detailedReviewJson) : (detailedReviewJson || []);

    const reportCard = await prisma.reportCard.create({
      data: {
        userId: dbUserId,
        testTitle: String(testTitle).trim(),
        mode: String(mode || 'EXAM').toUpperCase(),
        totalQuestions: Number(totalQuestions),
        maxMarks: Number(maxMarks || 0),
        score: Number(score),
        accuracy: Number(accuracy || 0),
        correctCount: Number(correctCount || 0),
        incorrectCount: Number(incorrectCount || 0),
        unattemptedCount: Number(unattemptedCount || 0),
        positiveMarks: Number(positiveMarks || 0),
        negativeMarks: Number(negativeMarks || 0),
        timeTakenSeconds: Number(timeTakenSeconds || 0),
        allocatedSeconds: Number(allocatedSeconds || 0),
        breakdownJson: typeof breakdownJson === 'string' ? JSON.parse(breakdownJson) : (breakdownJson || {}),
        detailedReviewJson: reviewsArray,
      },
    });

    // ─── Automatic Mistake Notebook Capture & Mastery Update ───
    try {
      for (const item of reviewsArray) {
        if (!item || !item.question) continue;
        const q = item.question;
        const qHash = q.contentHash || computeContentHash(q.question, q.type, q.options);
        const subject = q.subject || 'General / Unassigned';
        const topic = q.topic || 'General';

        if (item.isAttempted && !item.isCorrect) {
          // Upsert mistake -> status: NEEDS_REVIEW, increment wrongCount
          const existing = await prisma.mistakeEntry.findUnique({
            where: { userId_questionHash: { userId: dbUserId, questionHash: qHash } },
          });

          if (existing) {
            await prisma.mistakeEntry.update({
              where: { id: existing.id },
              data: {
                wrongCount: existing.wrongCount + 1,
                status: 'NEEDS_REVIEW',
                lastWrongAt: new Date(),
                questionSnapshotJson: q,
              },
            });
          } else {
            await prisma.mistakeEntry.create({
              data: {
                userId: dbUserId,
                questionHash: qHash,
                questionSnapshotJson: q,
                subject,
                topic,
                wrongCount: 1,
                status: 'NEEDS_REVIEW',
                lastWrongAt: new Date(),
              },
            });
          }
        } else if (item.isCorrect) {
          // If previously missed and now answered correctly -> Auto-mark MASTERED!
          const existing = await prisma.mistakeEntry.findUnique({
            where: { userId_questionHash: { userId: dbUserId, questionHash: qHash } },
          });
          if (existing && existing.status !== 'MASTERED') {
            await prisma.mistakeEntry.update({
              where: { id: existing.id },
              data: {
                status: 'MASTERED',
                masteredAt: new Date(),
              },
            });
          }
        }
      }
    } catch (mistakeErr) {
      console.warn('Could not auto-process mistakes for report card:', mistakeErr);
    }

    res.status(201).json({
      success: true,
      reportCard,
      message: 'Report card saved successfully to your account.',
    });
  } catch (error) {
    console.error('Error saving report card:', error);
    res.status(500).json({ error: 'Failed to save report card.' });
  }
});

// ─── 2. List Past Report Cards (GET /api/report-cards) ───
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!isDbConfigured || !prisma) {
    res.status(200).json([]);
    return;
  }
  try {
    const user = req.user!;

    // Find all report cards for user by email matching or user ID
    const reportCards = await prisma.reportCard.findMany({
      where: {
        user: {
          email: user.email,
        },
      },
      orderBy: {
        submittedAt: 'desc',
      },
      select: {
        id: true,
        testTitle: true,
        mode: true,
        totalQuestions: true,
        maxMarks: true,
        score: true,
        accuracy: true,
        correctCount: true,
        incorrectCount: true,
        unattemptedCount: true,
        positiveMarks: true,
        negativeMarks: true,
        timeTakenSeconds: true,
        allocatedSeconds: true,
        submittedAt: true,
      },
    });

    res.json(reportCards);
  } catch (error) {
    console.warn('Error fetching report cards (returning empty list):', error);
    res.status(200).json([]);
  }
});

// ─── 3. Get Single Report Card with Full Detail (GET /api/report-cards/:id) ───
router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const id = req.params.id;

    const reportCard = await prisma.reportCard.findUnique({
      where: { id },
      include: {
        user: {
          select: { email: true, name: true },
        },
      },
    });

    if (!reportCard) {
      res.status(404).json({ error: 'Report card not found.' });
      return;
    }

    // Verify ownership
    if (reportCard.user.email !== user.email) {
      res.status(403).json({ error: 'Unauthorized to view this report card.' });
      return;
    }

    res.json(reportCard);
  } catch (error) {
    console.error('Error retrieving report card detail:', error);
    res.status(500).json({ error: 'Failed to load report card details.' });
  }
});

export default router;
