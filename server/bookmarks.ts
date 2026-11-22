import { Router, Response } from 'express';
import { prisma, isDbConfigured } from './db';
import { requireAuth, AuthenticatedRequest } from './auth';

const router = Router();
router.use(requireAuth);

// ─── 1. Get All Bookmarks for Current User (GET /api/bookmarks) ───
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    if (!isDbConfigured || !prisma) {
      res.json([]);
      return;
    }

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      select: { id: true },
    });

    if (!dbUser) {
      res.json([]);
      return;
    }

    const bookmarks = await prisma.bookmark.findMany({
      where: { userId: dbUser.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json(bookmarks);
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
    res.status(500).json({ error: 'Failed to fetch bookmarks.' });
  }
});

// ─── 2. Toggle Bookmark (POST /api/bookmarks/toggle) ───
router.post('/toggle', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { questionHash, questionSnapshot, subject, topic, note } = req.body;

    if (!questionHash || !questionSnapshot) {
      res.status(400).json({ error: 'Missing questionHash or questionSnapshot.' });
      return;
    }

    if (!isDbConfigured || !prisma) {
      res.json({ success: true, bookmarked: true });
      return;
    }

    // Ensure User exists
    let dbUserId = user.id;
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

    const existingBookmark = await prisma.bookmark.findUnique({
      where: {
        userId_questionHash: {
          userId: dbUserId,
          questionHash,
        },
      },
    });

    if (existingBookmark) {
      await prisma.bookmark.delete({
        where: { id: existingBookmark.id },
      });
      res.json({ success: true, bookmarked: false, message: 'Bookmark removed.' });
      return;
    }

    const newBookmark = await prisma.bookmark.create({
      data: {
        userId: dbUserId,
        questionHash,
        questionSnapshotJson: typeof questionSnapshot === 'string' ? JSON.parse(questionSnapshot) : questionSnapshot,
        subject: subject || 'General / Unassigned',
        topic: topic || 'General',
        note: note || null,
      },
    });

    res.status(201).json({ success: true, bookmarked: true, bookmark: newBookmark, message: 'Question bookmarked.' });
  } catch (error) {
    console.error('Error toggling bookmark:', error);
    res.status(500).json({ error: 'Failed to toggle bookmark.' });
  }
});

// ─── 3. Update Bookmark Revision Note (PATCH /api/bookmarks/:id) ───
router.patch('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const id = req.params.id;
    const { note } = req.body;

    if (!isDbConfigured || !prisma) {
      res.json({ success: true, message: 'Updated locally.' });
      return;
    }

    const bookmark = await prisma.bookmark.findUnique({
      where: { id },
      include: { user: { select: { email: true } } },
    });

    if (!bookmark || bookmark.user.email !== user.email) {
      res.status(404).json({ error: 'Bookmark not found or unauthorized.' });
      return;
    }

    const updated = await prisma.bookmark.update({
      where: { id },
      data: { note: typeof note === 'string' ? note.trim() : null },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating bookmark note:', error);
    res.status(500).json({ error: 'Failed to update note.' });
  }
});

export default router;
