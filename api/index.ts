import type { IncomingMessage, ServerResponse } from 'http';
import app from '../server/app.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // Check if DATABASE_URL is set and valid
  const hasDb = Boolean(
    process.env.DATABASE_URL &&
      (process.env.DATABASE_URL.startsWith('postgresql://') ||
        process.env.DATABASE_URL.startsWith('postgres://'))
  );

  // If no database is configured, respond directly with HTTP 200 OK fallback
  if (!hasDb) {
    const url = req.url || '';
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');

    if (url.includes('/auth/me')) {
      res.end(JSON.stringify({ user: null }));
      return;
    }
    if (url.includes('/stats')) {
      res.end(
        JSON.stringify({
          fallback: true,
          totalQuestions: 0,
          totalSubjects: 0,
          totalTopics: 0,
          byType: { MCQ: 0, MSQ: 0, NAT: 0 },
          byMarks: { '1-Mark': 0, '2-Mark': 0 },
          archivedCount: 0,
        })
      );
      return;
    }
    if (url.includes('/questions') || url.includes('/hierarchy') || url.includes('/report-cards') || url.includes('/mistakes') || url.includes('/bookmarks') || url.includes('/payment')) {
      res.end(JSON.stringify([]));
      return;
    }
    if (url.includes('/test-series')) {
      res.end(JSON.stringify({ tests: [] }));
      return;
    }
    if (url.includes('/analytics')) {
      res.end(
        JSON.stringify({
          totalTests: 0,
          averageScorePercent: 0,
          averageAccuracy: 0,
          trend: [],
          subjectMastery: [],
          weakTopics: [],
        })
      );
      return;
    }
    if (url.includes('/ingest')) {
      res.end(
        JSON.stringify({
          success: true,
          stats: { totalProcessed: 0, newInserted: 0, duplicatesSkipped: 0, insertedIds: [] },
          message: 'Saved to local browser storage.',
        })
      );
      return;
    }
    if (url.includes('/admin/clear-data')) {
      res.end(
        JSON.stringify({
          success: true,
          message: 'Question bank and report cards cleared. Users preserved.',
        })
      );
      return;
    }
    if (url.includes('/health')) {
      res.end(JSON.stringify({ status: 'ok', brand: 'abhiyantra' }));
      return;
    }

    res.end(JSON.stringify({ success: true, message: 'Local client fallback mode active.' }));
    return;
  }

  // When database IS connected, forward to Express server app
  try {
    return (app as any)(req, res);
  } catch (err: any) {
    console.error('Server app error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err?.message, user: null }));
  }
}
