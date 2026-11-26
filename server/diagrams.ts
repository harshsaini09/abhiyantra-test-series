import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { prisma, isDbConfigured } from './db.js';

const router = Router();

// Ensure local public/diagrams directory exists (safely catch read-only fs on serverless / Vercel)
const DIAGRAMS_DIR = path.join(process.cwd(), 'public', 'diagrams');
let isLocalFsWritable = false;
try {
  if (!fs.existsSync(DIAGRAMS_DIR)) {
    fs.mkdirSync(DIAGRAMS_DIR, { recursive: true });
  }
  isLocalFsWritable = true;
} catch {
  // Read-only filesystem on Vercel Serverless / AWS Lambda
  isLocalFsWritable = false;
}

interface UploadDiagramRequest {
  imageBase64: string;
  filename?: string;
  questionId?: number | string;
  isSolution?: boolean;
}

/**
 * Upload diagram endpoint
 * Supports:
 * 1. Commits directly to GitHub repository via GitHub REST API (if GITHUB_TOKEN is set)
 * 2. Saves to local public/diagrams/ directory if filesystem is writable
 * 3. Returns lightning-fast jsDelivr CDN URL or local URL (with base64 data-URL fallback on serverless)
 * 4. Updates Question.imageUrl or Question.solutionImageUrl in database if questionId is provided
 */
router.post('/upload', async (req: Request, res: Response): Promise<void> => {
  try {
    const { imageBase64, filename: customFilename, questionId, isSolution } = req.body as UploadDiagramRequest;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      res.status(400).json({ error: 'imageBase64 is required (data URL or raw base64 string).' });
      return;
    }

    // 1. Parse base64 header and extract extension
    let mimeType = 'image/png';
    let rawBase64 = imageBase64;
    let ext = 'png';

    const match = imageBase64.match(/^data:image\/([a-zA-Z0-9\+\-]+);base64,(.+)$/);
    if (match) {
      ext = match[1].toLowerCase().replace('jpeg', 'jpg');
      mimeType = `image/${match[1]}`;
      rawBase64 = match[2];
    }

    // Validate allowed extensions
    const allowed = ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'];
    if (!allowed.includes(ext)) {
      ext = 'png';
    }

    const cleanFilename = customFilename
      ? customFilename.replace(/[^a-zA-Z0-9_.-]/g, '_')
      : `diag_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const buffer = Buffer.from(rawBase64, 'base64');

    // 2. Save locally if filesystem is writable
    let localUrl = `/diagrams/${cleanFilename}`;
    if (isLocalFsWritable) {
      try {
        const localFilePath = path.join(DIAGRAMS_DIR, cleanFilename);
        fs.writeFileSync(localFilePath, buffer);
      } catch {
        isLocalFsWritable = false;
      }
    }

    // 3. GitHub repository upload (if GITHUB_TOKEN is present)
    const githubToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    const githubOwner = process.env.GITHUB_OWNER || 'harshsaini09';
    const githubRepo = process.env.GITHUB_REPO || 'abhiyantra-test-series';
    const branch = process.env.GITHUB_BRANCH || 'main';

    let cdnUrl: string | null = null;
    let githubUrl: string | null = null;
    let uploadMethod: 'github_cdn' | 'local_public' | 'data_url' = isLocalFsWritable ? 'local_public' : 'data_url';

    if (githubToken) {
      try {
        const ghApiUrl = `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/public/diagrams/${cleanFilename}`;
        const ghResponse = await fetch(ghApiUrl, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${githubToken}`,
            'User-Agent': 'Abhiyantra-CBT-Portal',
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: `feat(diagram): upload question diagram ${cleanFilename}`,
            content: rawBase64,
            branch,
          }),
        });

        if (ghResponse.ok) {
          uploadMethod = 'github_cdn';
          cdnUrl = `https://cdn.jsdelivr.net/gh/${githubOwner}/${githubRepo}@${branch}/public/diagrams/${cleanFilename}`;
          githubUrl = `https://raw.githubusercontent.com/${githubOwner}/${githubRepo}/${branch}/public/diagrams/${cleanFilename}`;
        } else {
          const errText = await ghResponse.text();
          console.warn(`[GitHub Upload Warning] ${ghResponse.status}: ${errText}`);
        }
      } catch (ghErr) {
        console.warn('[GitHub Upload Error]:', ghErr);
      }
    }

    // Determine final public URL
    let finalUrl = cdnUrl;
    if (!finalUrl) {
      if (isLocalFsWritable) {
        finalUrl = localUrl;
      } else {
        // Safe serverless fallback: data URL renders instantly everywhere
        finalUrl = imageBase64.startsWith('data:') ? imageBase64 : `data:${mimeType};base64,${rawBase64}`;
        uploadMethod = 'data_url';
      }
    }

    // 4. Update database question if questionId is provided
    if (questionId && isDbConfigured && prisma) {
      const qIdNum = Number(questionId);
      if (!isNaN(qIdNum) && qIdNum > 0) {
        try {
          if (isSolution) {
            await prisma.question.update({
              where: { id: qIdNum },
              data: { solutionImageUrl: finalUrl },
            });
          } else {
            await prisma.question.update({
              where: { id: qIdNum },
              data: { imageUrl: finalUrl },
            });
          }
        } catch (dbErr) {
          console.warn('[Prisma Question Update Warning]:', dbErr);
        }
      }
    }

    res.json({
      success: true,
      url: finalUrl,
      cdnUrl,
      localUrl: isLocalFsWritable ? localUrl : finalUrl,
      githubUrl,
      filename: cleanFilename,
      storage: uploadMethod,
      sizeBytes: buffer.length,
    });
  } catch (err: any) {
    console.error('[Upload Diagram Error]:', err);
    res.status(500).json({ error: err.message || 'Failed to upload diagram.' });
  }
});

/**
 * Remove diagram endpoint
 * Clears imageUrl or solutionImageUrl in DB if questionId is provided
 */
router.post('/remove', async (req: Request, res: Response): Promise<void> => {
  try {
    const { questionId, isSolution } = req.body;
    if (questionId && isDbConfigured && prisma) {
      const qId = Number(questionId);
      if (!isNaN(qId) && qId > 0) {
        if (isSolution) {
          await prisma.question.update({
            where: { id: qId },
            data: { solutionImageUrl: null },
          });
        } else {
          await prisma.question.update({
            where: { id: qId },
            data: { imageUrl: null },
          });
        }
      }
    }
    res.json({ success: true, message: 'Diagram reference cleared successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to remove diagram.' });
  }
});

export default router;
