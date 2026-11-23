import { Router, Response } from 'express';
import { prisma, isDbConfigured } from './db.js';
import { requireAuth, AuthenticatedRequest } from './auth.js';

const router = Router();
router.use(requireAuth);

// ─── Get Aggregated Analytics Summary (GET /api/analytics/summary) ───
router.get('/summary', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    if (!isDbConfigured || !prisma) {
      res.json({
        totalTests: 0,
        avgAccuracy: 0,
        avgScorePercent: 0,
        totalTimeSpentSeconds: 0,
        trends: [],
        subjectMastery: [],
        weakTopics: [],
      });
      return;
    }

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      select: { id: true },
    });

    if (!dbUser) {
      res.json({
        totalTests: 0,
        avgAccuracy: 0,
        avgScorePercent: 0,
        totalTimeSpentSeconds: 0,
        trends: [],
        subjectMastery: [],
        weakTopics: [],
      });
      return;
    }

    const reportCards = await prisma.reportCard.findMany({
      where: { userId: dbUser.id },
      orderBy: { submittedAt: 'asc' },
    });

    if (reportCards.length === 0) {
      res.json({
        totalTests: 0,
        avgAccuracy: 0,
        avgScorePercent: 0,
        totalTimeSpentSeconds: 0,
        trends: [],
        subjectMastery: [],
        weakTopics: [],
      });
      return;
    }

    // Chronological trends
    const trends = reportCards.map((rc) => ({
      date: rc.submittedAt.toISOString(),
      testTitle: rc.testTitle,
      scorePercent: rc.maxMarks > 0 ? (rc.score / rc.maxMarks) * 100 : 0,
      accuracy: rc.accuracy,
      score: rc.score,
      maxMarks: rc.maxMarks,
    }));

    // Aggregate subject and topic stats across detailedReviewJson
    const subjectMap = new Map<string, {
      total: number;
      attempted: number;
      correct: number;
      incorrect: number;
      unattempted: number;
      timeSpent: number;
      topicMap: Map<string, {
        total: number;
        attempted: number;
        correct: number;
        incorrect: number;
        unattempted: number;
        timeSpent: number;
      }>;
    }>();

    let totalSeconds = 0;
    let sumAccuracy = 0;
    let sumScorePct = 0;

    reportCards.forEach((rc) => {
      totalSeconds += rc.timeTakenSeconds || 0;
      sumAccuracy += rc.accuracy || 0;
      if (rc.maxMarks > 0) {
        sumScorePct += (rc.score / rc.maxMarks) * 100;
      }

      const reviews = (rc.detailedReviewJson as any[]) || [];
      reviews.forEach((qr) => {
        const subName = qr.question?.subject || 'General / Unassigned';
        const topName = qr.question?.topic || 'General';
        const isAttempted = qr.isAttempted;
        const isCorrect = qr.isCorrect;
        const timeSpent = Number(qr.timeSpentSeconds) || 0;

        if (!subjectMap.has(subName)) {
          subjectMap.set(subName, {
            total: 0,
            attempted: 0,
            correct: 0,
            incorrect: 0,
            unattempted: 0,
            timeSpent: 0,
            topicMap: new Map(),
          });
        }
        const sEntry = subjectMap.get(subName)!;
        sEntry.total++;
        sEntry.timeSpent += timeSpent;
        if (isAttempted) {
          sEntry.attempted++;
          if (isCorrect) sEntry.correct++;
          else sEntry.incorrect++;
        } else {
          sEntry.unattempted++;
        }

        if (!sEntry.topicMap.has(topName)) {
          sEntry.topicMap.set(topName, {
            total: 0,
            attempted: 0,
            correct: 0,
            incorrect: 0,
            unattempted: 0,
            timeSpent: 0,
          });
        }
        const tEntry = sEntry.topicMap.get(topName)!;
        tEntry.total++;
        tEntry.timeSpent += timeSpent;
        if (isAttempted) {
          tEntry.attempted++;
          if (isCorrect) tEntry.correct++;
          else tEntry.incorrect++;
        } else {
          tEntry.unattempted++;
        }
      });
    });

    const subjectMastery: any[] = [];
    const weakTopics: any[] = [];

    subjectMap.forEach((sVal, sName) => {
      const sAcc = sVal.attempted > 0 ? (sVal.correct / sVal.attempted) * 100 : 0;
      const sScorePct = sVal.total > 0 ? (sVal.correct / sVal.total) * 100 : 0;
      const sAvgTime = sVal.total > 0 ? Math.round(sVal.timeSpent / sVal.total) : 0;
      const sStatus = sAcc >= 75 ? 'STRONG' : sAcc >= 50 ? 'MODERATE' : 'WEAK';

      const topics: any[] = [];
      sVal.topicMap.forEach((tVal, tName) => {
        const tAcc = tVal.attempted > 0 ? (tVal.correct / tVal.attempted) * 100 : 0;
        const tAvgTime = tVal.total > 0 ? Math.round(tVal.timeSpent / tVal.total) : 0;
        const tStatus = tAcc >= 75 ? 'STRONG' : tAcc >= 50 ? 'MODERATE' : 'WEAK';

        const topicObj = {
          topic: tName,
          subject: sName,
          totalQuestions: tVal.total,
          attempted: tVal.attempted,
          correct: tVal.correct,
          incorrect: tVal.incorrect,
          unattempted: tVal.unattempted,
          accuracy: Number(tAcc.toFixed(1)),
          avgTimeSeconds: tAvgTime,
          status: tStatus,
        };
        topics.push(topicObj);

        if (tStatus === 'WEAK' && tVal.attempted >= 1) {
          weakTopics.push(topicObj);
        }
      });

      subjectMastery.push({
        subject: sName,
        totalQuestions: sVal.total,
        attempted: sVal.attempted,
        correct: sVal.correct,
        incorrect: sVal.incorrect,
        unattempted: sVal.unattempted,
        accuracy: Number(sAcc.toFixed(1)),
        scorePercent: Number(sScorePct.toFixed(1)),
        avgTimeSeconds: sAvgTime,
        status: sStatus,
        topics,
      });
    });

    // Sort subjects by accuracy ascending (weakest first)
    subjectMastery.sort((a, b) => a.accuracy - b.accuracy);
    // Sort weak topics by lowest accuracy and highest question count
    weakTopics.sort((a, b) => a.accuracy - b.accuracy || b.totalQuestions - a.totalQuestions);

    res.json({
      totalTests: reportCards.length,
      avgAccuracy: Number((sumAccuracy / reportCards.length).toFixed(1)),
      avgScorePercent: Number((sumScorePct / reportCards.length).toFixed(1)),
      totalTimeSpentSeconds: totalSeconds,
      trends,
      subjectMastery,
      weakTopics,
    });
  } catch (error) {
    console.error('Analytics summary error:', error);
    res.status(500).json({ error: 'Failed to generate analytics summary.' });
  }
});

export default router;
