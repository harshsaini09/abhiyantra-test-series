// ============================================================
// GATE Mock Test Series Platform — Type Definitions
// ============================================================

/** Supported question types in GATE pattern */
export type QuestionType = 'MCQ' | 'MSQ' | 'NAT';

/** Mark value for a question */
export type MarkValue = 1 | 2;

/** NAT answer can be an exact number or a range */
export interface NATAnswer {
  min: number;
  max: number;
}

/** A single question in the test JSON */
export interface Question {
  id: number;
  type: QuestionType;
  marks: MarkValue;
  subject?: string;
  topic?: string;
  question: string;
  options?: string[];
  answer: number | number[] | NATAnswer;
  solution: string;
  imageUrl?: string | null;
  tikzCode?: string | null;
  solutionImageUrl?: string | null;
  solutionTikzCode?: string | null;
  section?: 'GA' | 'SUBJECT' | string;
  contentHash?: string;
}

/** The root test JSON schema */
export interface TestData {
  title: string;
  description?: string;
  promptingTip?: string;
  subject?: string;
  topic?: string;
  defaultSubject?: string;
  defaultTopic?: string;
  duration?: number;
  sections?: Array<{
    id: string;
    name: string;
    questionIds?: number[];
    questionCount?: number;
    marks?: number;
  }>;
  questions: Question[];
}

/** Subject with nested Topics in the 2-level hierarchy */
export interface TopicItem {
  id: number;
  name: string;
  subjectId: number;
  _count?: {
    questions: number;
  };
}

export interface SubjectWithTopics {
  id: number;
  name: string;
  topics: TopicItem[];
  _count?: {
    questions: number;
  };
}

/** Question item returned from Question Bank API */
export interface QuestionBankItem {
  id: number;
  contentHash: string;
  subjectId: number;
  subject: {
    id: number;
    name: string;
  };
  topicId: number;
  topic: {
    id: number;
    name: string;
  };
  type: QuestionType;
  marks: MarkValue;
  questionText: string;
  options?: string[];
  answer: number | number[] | NATAnswer;
  solution: string;
  imageUrl?: string | null;
  tikzCode?: string | null;
  solutionImageUrl?: string | null;
  solutionTikzCode?: string | null;
  section?: 'GA' | 'SUBJECT' | string;
  sourceTestTitle?: string | null;
  isArchived: boolean;
  createdAt: string;
}

/** Question Bank statistics */
export interface QuestionBankStats {
  totalQuestions: number;
  totalSubjects: number;
  totalTopics: number;
  byType: Record<QuestionType, number>;
  byMarks: Record<string, number>;
  archivedCount: number;
}

/** Status of a question during the test */
export type QuestionStatus =
  | 'not-visited'
  | 'not-answered'
  | 'answered'
  | 'marked-for-review'
  | 'answered-and-marked';

/** User response for a single question */
export interface UserResponse {
  questionId: number;
  /** For MCQ: selected option index; for MSQ: array of selected indices; for NAT: entered number string */
  selectedOptions?: number[];
  natInput?: string;
  status: QuestionStatus;
  /** Practice mode: has this been checked? */
  practiceChecked?: boolean;
  /** Practice mode: was it correct when checked? */
  practiceResult?: 'correct' | 'incorrect' | null;
}

/** Test mode */
export type TestMode = 'exam' | 'practice';

/** Complete test state persisted to localStorage */
export interface TestState {
  testData: TestData;
  mode: TestMode;
  responses: UserResponse[];
  currentQuestionIndex: number;
  startTime: number; // timestamp ms
  totalDurationSeconds: number;
  remainingSeconds: number;
  isSubmitted: boolean;
}

/** Result for a single question after grading */
export interface QuestionResult {
  questionId: number;
  question: Question;
  userResponse: UserResponse;
  isCorrect: boolean;
  isAttempted: boolean;
  marksAwarded: number;
  correctAnswer: string;
  userAnswer: string;
  timeSpentSeconds?: number;
}

/** Aggregated test results */
export interface TestResults {
  testData: TestData;
  mode: TestMode;
  questionResults: QuestionResult[];
  totalScore: number;
  maxMarks: number;
  percentage: number;
  accuracy: number;
  totalCorrect: number;
  totalIncorrect: number;
  totalUnattempted: number;
  positiveMarks: number;
  negativeMarks: number;
  timeTaken: number; // seconds
  // Breakdown by type
  byType: Record<QuestionType, TypeBreakdown>;
  // Breakdown by marks
  byMarks: Record<string, TypeBreakdown>;
  // Breakdown by subject
  bySubject?: Record<string, TypeBreakdown>;
}

export interface TypeBreakdown {
  total: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  marksObtained: number;
  maxMarks: number;
}

/** Validation error from JSON parser */
export interface ValidationError {
  field: string;
  message: string;
  questionIndex?: number;
}


// ─── Authentication & Report Card Types ───
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  role?: 'STUDENT' | 'TEACHER' | 'ADMIN';
  isSubscribed?: boolean;
  subscriptionTier?: string | null;
  subscriptionUntil?: string | null;
}

export interface PlatformUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  role: 'STUDENT' | 'TEACHER' | 'ADMIN';
  isSubscribed?: boolean;
  subscriptionTier?: string | null;
  subscriptionUntil?: string | null;
  createdAt: string;
  _count?: {
    reportCards: number;
    mistakes: number;
    bookmarks: number;
    payments: number;
  };
}

export interface PaymentRecord {
  id: string;
  userId: string;
  planId: string;
  planName: string;
  amount: number;
  utrNumber: string;
  upiIdUsed?: string | null;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  adminNote?: string | null;
  createdAt: string;
  verifiedAt?: string | null;
  user?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    isSubscribed?: boolean;
    subscriptionUntil?: string | null;
  };
}

export interface PricingPlan {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  discountBadge: string;
  durationDays: number;
  popular?: boolean;
  features: string[];
}

export interface SavedReportCard {
  id: string;
  userId?: string;
  testTitle: string;
  mode: 'EXAM' | 'PRACTICE';
  totalQuestions: number;
  maxMarks: number;
  score: number;
  accuracy: number;
  correctCount: number;
  incorrectCount: number;
  unattemptedCount: number;
  positiveMarks: number;
  negativeMarks: number;
  timeTakenSeconds: number;
  allocatedSeconds: number;
  breakdownJson?: Record<string, unknown>;
  detailedReviewJson?: QuestionResult[];
  submittedAt: string;
}

// ─── Mistake Notebook Types ───
export interface MistakeEntry {
  id: string;
  userId: string;
  questionHash: string;
  questionSnapshotJson: Question;
  subject: string;
  topic: string;
  wrongCount: number;
  status: 'NEEDS_REVIEW' | 'MASTERED';
  lastWrongAt: string;
  masteredAt?: string | null;
}

// ─── Bookmark Types ───
export interface BookmarkItem {
  id: string;
  userId: string;
  questionHash: string;
  questionSnapshotJson: Question;
  subject: string;
  topic: string;
  note?: string | null;
  createdAt: string;
}

// ─── Performance & Weakness Analytics Summary Types ───
export interface SubjectMastery {
  subject: string;
  totalQuestions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  accuracy: number;
  scorePercent: number;
  avgTimeSeconds: number;
  status: 'STRONG' | 'MODERATE' | 'WEAK';
  topics: TopicMastery[];
}

export interface TopicMastery {
  topic: string;
  subject: string;
  totalQuestions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  accuracy: number;
  avgTimeSeconds: number;
  status: 'STRONG' | 'MODERATE' | 'WEAK';
}

export interface AttemptTrendPoint {
  date: string;
  testTitle: string;
  scorePercent: number;
  accuracy: number;
  score: number;
  maxMarks: number;
}

export interface AnalyticsSummary {
  totalTests: number;
  avgAccuracy: number;
  avgScorePercent: number;
  totalTimeSpentSeconds: number;
  trends: AttemptTrendPoint[];
  subjectMastery: SubjectMastery[];
  weakTopics: TopicMastery[];
}
