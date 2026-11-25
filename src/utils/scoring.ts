// ============================================================
// Scoring / Grading Utility — Official GATE Marking Scheme
// ============================================================
import type {
  Question, UserResponse, QuestionResult, TestResults, TestData,
  TestMode, TypeBreakdown, QuestionType, NATAnswer
} from '../types';

/** Calculate negative marks for MCQ based on mark value */
function getNegativeMarks(marks: number): number {
  if (marks === 1) return -1 / 3;   // -0.3333
  if (marks === 2) return -2 / 3;   // -0.6667
  return 0;
}

/** Check if an MCQ answer is correct */
function checkMCQ(question: Question, response: UserResponse): { isCorrect: boolean; isAttempted: boolean } {
  const isAttempted = !!response.selectedOptions && response.selectedOptions.length === 1;
  if (!isAttempted) return { isCorrect: false, isAttempted: false };
  const isCorrect = response.selectedOptions![0] === (question.answer as number);
  return { isCorrect, isAttempted: true };
}

/** Check if an MSQ answer is correct — exact match required */
function checkMSQ(question: Question, response: UserResponse): { isCorrect: boolean; isAttempted: boolean } {
  const isAttempted = !!response.selectedOptions && response.selectedOptions.length > 0;
  if (!isAttempted) return { isCorrect: false, isAttempted: false };

  const correctSet = new Set(question.answer as number[]);
  const userSet = new Set(response.selectedOptions!);

  if (correctSet.size !== userSet.size) return { isCorrect: false, isAttempted: true };
  for (const val of correctSet) {
    if (!userSet.has(val)) return { isCorrect: false, isAttempted: true };
  }
  return { isCorrect: true, isAttempted: true };
}

/** Check if a NAT answer is correct — exact or within range */
function checkNAT(question: Question, response: UserResponse): { isCorrect: boolean; isAttempted: boolean } {
  if (!response.natInput || response.natInput.trim() === '') {
    return { isCorrect: false, isAttempted: false };
  }
  const userValue = parseFloat(response.natInput);
  if (isNaN(userValue)) return { isCorrect: false, isAttempted: true };

  const answer = question.answer;
  if (typeof answer === 'number') {
    // Exact match (with floating point tolerance)
    const isCorrect = Math.abs(userValue - answer) < 0.01;
    return { isCorrect, isAttempted: true };
  } else {
    // Range
    const range = answer as NATAnswer;
    const isCorrect = userValue >= range.min && userValue <= range.max;
    return { isCorrect, isAttempted: true };
  }
}

/** Grade a single question */
export function gradeQuestion(
  question: Question,
  response: UserResponse,
  timeSpentSeconds: number = 0,
  examCategory?: string
): QuestionResult {
  let checkResult: { isCorrect: boolean; isAttempted: boolean };

  switch (question.type) {
    case 'MCQ':
      checkResult = checkMCQ(question, response);
      break;
    case 'MSQ':
      checkResult = checkMSQ(question, response);
      break;
    case 'NAT':
      checkResult = checkNAT(question, response);
      break;
    default:
      checkResult = { isCorrect: false, isAttempted: false };
  }

  let marksAwarded = 0;
  if (checkResult.isAttempted) {
    if (checkResult.isCorrect) {
      marksAwarded = examCategory === 'JEE_MAINS' ? 4 : question.marks;
    } else {
      if (examCategory === 'JEE_MAINS') {
        marksAwarded = -1; // -1 for both MCQ and Numerical in JEE Mains
      } else if (question.type === 'MCQ') {
        marksAwarded = getNegativeMarks(question.marks);
      }
    }
  }

  // Format correct answer string
  let correctAnswer: string;
  if (question.type === 'MCQ') {
    const idx = question.answer as number;
    correctAnswer = question.options ? `${String.fromCharCode(65 + idx)}) ${question.options[idx]}` : String(idx);
  } else if (question.type === 'MSQ') {
    const indices = question.answer as number[];
    correctAnswer = indices.map(i => question.options ? `${String.fromCharCode(65 + i)}) ${question.options[i]}` : String(i)).join(', ');
  } else {
    const ans = question.answer as NATAnswer | number;
    if (typeof ans === 'number') {
      correctAnswer = String(ans);
    } else {
      correctAnswer = `${ans.min} to ${ans.max}`;
    }
  }

  // Format user answer string
  let userAnswer: string;
  if (!checkResult.isAttempted) {
    userAnswer = 'Not Attempted';
  } else if (question.type === 'NAT') {
    userAnswer = response.natInput || '';
  } else {
    const indices = response.selectedOptions || [];
    userAnswer = indices.map(i => question.options ? `${String.fromCharCode(65 + i)}) ${question.options[i]}` : String(i)).join(', ');
  }

  return {
    questionId: question.id,
    question,
    userResponse: response,
    isCorrect: checkResult.isCorrect,
    isAttempted: checkResult.isAttempted,
    marksAwarded,
    correctAnswer,
    userAnswer,
    timeSpentSeconds,
  };
}

/** Grade all questions and produce full results */
export function gradeTest(
  testData: TestData,
  responses: UserResponse[],
  mode: TestMode,
  timeTaken: number,
  timeSpentPerQuestion?: Record<number, number>
): TestResults {
  const responseMap = new Map(responses.map(r => [r.questionId, r]));

  const questionResults: QuestionResult[] = testData.questions.map(q => {
    const response = responseMap.get(q.id) || {
      questionId: q.id,
      status: 'not-visited' as const,
    };
    const spent = timeSpentPerQuestion ? (timeSpentPerQuestion[q.id] || 0) : 0;
    return gradeQuestion(q, response, spent, testData.examCategory);
  });

  const totalScore = questionResults.reduce((sum, r) => sum + r.marksAwarded, 0);
  const maxMarks = testData.questions.reduce((sum, q) => sum + (testData.examCategory === 'JEE_MAINS' ? 4 : q.marks), 0);
  const totalCorrect = questionResults.filter(r => r.isCorrect).length;
  const totalIncorrect = questionResults.filter(r => r.isAttempted && !r.isCorrect).length;
  const totalUnattempted = questionResults.filter(r => !r.isAttempted).length;
  const positiveMarks = questionResults.filter(r => r.marksAwarded > 0).reduce((sum, r) => sum + r.marksAwarded, 0);
  const negativeMarks = questionResults.filter(r => r.marksAwarded < 0).reduce((sum, r) => sum + r.marksAwarded, 0);
  const attempted = totalCorrect + totalIncorrect;
  const accuracy = attempted > 0 ? (totalCorrect / attempted) * 100 : 0;
  const percentage = maxMarks > 0 ? (totalScore / maxMarks) * 100 : 0;

  // Breakdown by type
  const byType: Record<QuestionType, TypeBreakdown> = {
    MCQ: createBreakdown(questionResults.filter(r => r.question.type === 'MCQ')),
    MSQ: createBreakdown(questionResults.filter(r => r.question.type === 'MSQ')),
    NAT: createBreakdown(questionResults.filter(r => r.question.type === 'NAT')),
  };

  // Breakdown by marks
  const byMarks: Record<string, TypeBreakdown> = {
    '1-Mark': createBreakdown(questionResults.filter(r => r.question.marks === 1)),
    '2-Mark': createBreakdown(questionResults.filter(r => r.question.marks === 2)),
  };

  // Breakdown by subject (if any question has a subject specified)
  const hasSubjects = questionResults.some(r => !!r.question.subject);
  let bySubject: Record<string, TypeBreakdown> | undefined = undefined;
  if (hasSubjects) {
    bySubject = {};
    const subjectMap = new Map<string, QuestionResult[]>();
    questionResults.forEach(r => {
      const subj = r.question.subject || 'General / Other';
      if (!subjectMap.has(subj)) subjectMap.set(subj, []);
      subjectMap.get(subj)!.push(r);
    });
    subjectMap.forEach((qList, subj) => {
      bySubject![subj] = createBreakdown(qList);
    });
  }

  return {
    testData,
    mode,
    questionResults,
    totalScore: Math.round(totalScore * 100) / 100,
    maxMarks,
    percentage: Math.round(percentage * 100) / 100,
    accuracy: Math.round(accuracy * 100) / 100,
    totalCorrect,
    totalIncorrect,
    totalUnattempted,
    positiveMarks: Math.round(positiveMarks * 100) / 100,
    negativeMarks: Math.round(negativeMarks * 100) / 100,
    timeTaken,
    byType,
    byMarks,
    bySubject,
  };
}

function createBreakdown(results: QuestionResult[]): TypeBreakdown {
  return {
    total: results.length,
    correct: results.filter(r => r.isCorrect).length,
    incorrect: results.filter(r => r.isAttempted && !r.isCorrect).length,
    unattempted: results.filter(r => !r.isAttempted).length,
    marksObtained: Math.round(results.reduce((s, r) => s + r.marksAwarded, 0) * 100) / 100,
    maxMarks: results.reduce((s, r) => s + r.question.marks, 0),
  };
}

/** Get negative marking info string for display */
export function getNegativeMarkingDisplay(type: QuestionType, marks: number, examCategory?: string): string {
  if (examCategory === 'JEE_MAINS') {
    return '−1.00';
  }
  if (type === 'MCQ') {
    const neg = marks === 1 ? '−⅓' : '−⅔';
    return neg;
  }
  return 'No Negative';
}

/** Compute total test duration from question count (GATE formula) */
export function calculateDuration(questionCount: number): number {
  return Math.round(questionCount * (10800 / 65));
}

/** Format seconds as HH:MM:SS */
export function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Format seconds as human-readable duration string */
export function formatDurationHuman(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);
  return parts.join(' ');
}
