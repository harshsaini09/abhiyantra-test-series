import { Router, Response } from 'express';
import { prisma, isDbConfigured } from './db.js';
import { requireAuth, AuthenticatedRequest } from './auth.js';

const router = Router();
router.use(requireAuth);

// ─── 1. Get Mistake Notebook Items (GET /api/mistakes) ───
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    if (!isDbConfigured || !prisma) {
      res.json([]);
      return;
    }

    // Find actual dbUserId
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      select: { id: true },
    });

    if (!dbUser) {
      res.json([]);
      return;
    }

    const mistakes = await prisma.mistakeEntry.findMany({
      where: { userId: dbUser.id },
      orderBy: [{ status: 'asc' }, { wrongCount: 'desc' }, { lastWrongAt: 'desc' }],
    });

    res.json(mistakes);
  } catch (error) {
    console.error('Error fetching mistakes:', error);
    res.status(500).json({ error: 'Failed to fetch mistake notebook entries.' });
  }
});

// ─── 2. Update Status / Mark Mastered (PATCH /api/mistakes/:id) ───
router.patch('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const id = req.params.id;
    const { status } = req.body;

    if (!isDbConfigured || !prisma) {
      res.json({ success: true, message: 'Updated in local session' });
      return;
    }

    const mistake = await prisma.mistakeEntry.findUnique({
      where: { id },
      include: { user: { select: { email: true } } },
    });

    if (!mistake || mistake.user.email !== user.email) {
      res.status(404).json({ error: 'Mistake entry not found or unauthorized.' });
      return;
    }

    const updated = await prisma.mistakeEntry.update({
      where: { id },
      data: {
        status: status === 'MASTERED' ? 'MASTERED' : 'NEEDS_REVIEW',
        masteredAt: status === 'MASTERED' ? new Date() : null,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating mistake:', error);
    res.status(500).json({ error: 'Failed to update mistake status.' });
  }
});

export default router;
