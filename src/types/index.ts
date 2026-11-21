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
}

/** The root test JSON schema */
export interface TestData {
  title: string;
  description?: string;
  subject?: string;
  topic?: string;
  defaultSubject?: string;
  defaultTopic?: string;
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
