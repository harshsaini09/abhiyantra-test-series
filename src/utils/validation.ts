// ============================================================
// JSON Validation Utility
// ============================================================
import type { TestData, Question, ValidationError, QuestionType, MarkValue } from '../types';

const VALID_TYPES: QuestionType[] = ['MCQ', 'MSQ', 'NAT'];
const VALID_MARKS: MarkValue[] = [1, 2];

export function validateTestJSON(data: unknown): { valid: boolean; errors: ValidationError[]; testData?: TestData } {
  const errors: ValidationError[] = [];

  if (!data || typeof data !== 'object') {
    errors.push({ field: 'root', message: 'JSON must be an object with "title" and "questions" fields.' });
    return { valid: false, errors };
  }

  const obj = data as Record<string, unknown>;

  // Title
  if (!obj.title || typeof obj.title !== 'string' || obj.title.trim().length === 0) {
    errors.push({ field: 'title', message: '"title" is required and must be a non-empty string.' });
  }

  // Description (optional)
  if (obj.description !== undefined && typeof obj.description !== 'string') {
    errors.push({ field: 'description', message: '"description" must be a string if provided.' });
  }

  // Subject (optional at test level)
  if (obj.subject !== undefined && typeof obj.subject !== 'string') {
    errors.push({ field: 'subject', message: '"subject" must be a string if provided.' });
  }

  // Topic (optional at test level)
  if (obj.topic !== undefined && typeof obj.topic !== 'string') {
    errors.push({ field: 'topic', message: '"topic" must be a string if provided.' });
  }

  // Default Subject (optional at test level)
  if (obj.defaultSubject !== undefined && typeof obj.defaultSubject !== 'string') {
    errors.push({ field: 'defaultSubject', message: '"defaultSubject" must be a string if provided.' });
  }

  // Default Topic (optional at test level)
  if (obj.defaultTopic !== undefined && typeof obj.defaultTopic !== 'string') {
    errors.push({ field: 'defaultTopic', message: '"defaultTopic" must be a string if provided.' });
  }

  // Questions
  if (!Array.isArray(obj.questions)) {
    errors.push({ field: 'questions', message: '"questions" is required and must be an array.' });
    return { valid: false, errors };
  }

  if (obj.questions.length === 0) {
    errors.push({ field: 'questions', message: '"questions" array must contain at least one question.' });
    return { valid: false, errors };
  }

  const seenIds = new Set<number>();

  (obj.questions as unknown[]).forEach((q, idx) => {
    const prefix = `questions[${idx}]`;

    if (!q || typeof q !== 'object') {
      errors.push({ field: prefix, message: `Question at index ${idx} must be an object.`, questionIndex: idx });
      return;
    }

    const question = q as Record<string, unknown>;

    // id
    if (question.id === undefined || typeof question.id !== 'number') {
      errors.push({ field: `${prefix}.id`, message: `Question ${idx + 1}: "id" is required and must be a number.`, questionIndex: idx });
    } else if (seenIds.has(question.id as number)) {
      errors.push({ field: `${prefix}.id`, message: `Question ${idx + 1}: Duplicate "id" value ${question.id}.`, questionIndex: idx });
    } else {
      seenIds.add(question.id as number);
    }

    // type
    if (!question.type || !VALID_TYPES.includes(question.type as QuestionType)) {
      errors.push({
        field: `${prefix}.type`,
        message: `Question ${idx + 1}: "type" must be one of: ${VALID_TYPES.join(', ')}.`,
        questionIndex: idx,
      });
    }

    // marks
    if (question.marks === undefined || !VALID_MARKS.includes(question.marks as MarkValue)) {
      errors.push({
        field: `${prefix}.marks`,
        message: `Question ${idx + 1}: "marks" must be 1 or 2.`,
        questionIndex: idx,
      });
    }

    // subject (optional at question level)
    if (question.subject !== undefined && typeof question.subject !== 'string') {
      errors.push({
        field: `${prefix}.subject`,
        message: `Question ${idx + 1}: "subject" must be a string if provided.`,
        questionIndex: idx,
      });
    }

    // topic (optional at question level)
    if (question.topic !== undefined && typeof question.topic !== 'string') {
      errors.push({
        field: `${prefix}.topic`,
        message: `Question ${idx + 1}: "topic" must be a string if provided.`,
        questionIndex: idx,
      });
    }

    // question text
    if (!question.question || typeof question.question !== 'string' || (question.question as string).trim().length === 0) {
      errors.push({
        field: `${prefix}.question`,
        message: `Question ${idx + 1}: "question" text is required.`,
        questionIndex: idx,
      });
    }

    const type = question.type as QuestionType;

    // options (required for MCQ and MSQ)
    if (type === 'MCQ' || type === 'MSQ') {
      if (!Array.isArray(question.options)) {
        errors.push({
          field: `${prefix}.options`,
          message: `Question ${idx + 1}: "options" array is required for ${type}.`,
          questionIndex: idx,
        });
      } else if (question.options.length < 2) {
        errors.push({
          field: `${prefix}.options`,
          message: `Question ${idx + 1}: "options" must have at least 2 choices.`,
          questionIndex: idx,
        });
      } else {
        (question.options as unknown[]).forEach((opt, optIdx) => {
          if (typeof opt !== 'string' || (opt as string).trim().length === 0) {
            errors.push({
              field: `${prefix}.options[${optIdx}]`,
              message: `Question ${idx + 1}, Option ${optIdx + 1}: must be a non-empty string.`,
              questionIndex: idx,
            });
          }
        });
      }
    }

    // answer
    if (question.answer === undefined || question.answer === null) {
      errors.push({
        field: `${prefix}.answer`,
        message: `Question ${idx + 1}: "answer" is required.`,
        questionIndex: idx,
      });
    } else {
      if (type === 'MCQ') {
        if (typeof question.answer !== 'number' || !Number.isInteger(question.answer)) {
          errors.push({
            field: `${prefix}.answer`,
            message: `Question ${idx + 1}: MCQ "answer" must be an integer (0-based index).`,
            questionIndex: idx,
          });
        } else if (Array.isArray(question.options) && ((question.answer as number) < 0 || (question.answer as number) >= question.options.length)) {
          errors.push({
            field: `${prefix}.answer`,
            message: `Question ${idx + 1}: MCQ "answer" index ${question.answer} is out of range.`,
            questionIndex: idx,
          });
        }
      } else if (type === 'MSQ') {
        if (!Array.isArray(question.answer)) {
          errors.push({
            field: `${prefix}.answer`,
            message: `Question ${idx + 1}: MSQ "answer" must be an array of indices.`,
            questionIndex: idx,
          });
        } else {
          (question.answer as unknown[]).forEach((a, aIdx) => {
            if (typeof a !== 'number' || !Number.isInteger(a)) {
              errors.push({
                field: `${prefix}.answer[${aIdx}]`,
                message: `Question ${idx + 1}: MSQ answer index ${aIdx} must be an integer.`,
                questionIndex: idx,
              });
            }
          });
        }
      } else if (type === 'NAT') {
        if (typeof question.answer === 'number') {
          // exact NAT answer - valid
        } else if (typeof question.answer === 'object' && question.answer !== null && !Array.isArray(question.answer)) {
          const natAns = question.answer as Record<string, unknown>;
          if (typeof natAns.min !== 'number' || typeof natAns.max !== 'number') {
            errors.push({
              field: `${prefix}.answer`,
              message: `Question ${idx + 1}: NAT range answer must have numeric "min" and "max".`,
              questionIndex: idx,
            });
          } else if (natAns.min > natAns.max) {
            errors.push({
              field: `${prefix}.answer`,
              message: `Question ${idx + 1}: NAT "min" must be ≤ "max".`,
              questionIndex: idx,
            });
          }
        } else {
          errors.push({
            field: `${prefix}.answer`,
            message: `Question ${idx + 1}: NAT "answer" must be a number or {min, max} object.`,
            questionIndex: idx,
          });
        }
      }
    }

    // solution
    if (!question.solution || typeof question.solution !== 'string') {
      errors.push({
        field: `${prefix}.solution`,
        message: `Question ${idx + 1}: "solution" is required and must be a string.`,
        questionIndex: idx,
      });
    }
  });

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    testData: {
      title: (obj.title as string).trim(),
      description: obj.description ? (obj.description as string).trim() : undefined,
      subject: obj.subject ? (obj.subject as string).trim() : undefined,
      topic: obj.topic ? (obj.topic as string).trim() : undefined,
      defaultSubject: obj.defaultSubject ? (obj.defaultSubject as string).trim() : undefined,
      defaultTopic: obj.defaultTopic ? (obj.defaultTopic as string).trim() : undefined,
      sections: Array.isArray(obj.sections) ? (obj.sections as any) : undefined,
      questions: obj.questions as Question[],
    },
  };
}

/** Parse JSON string with friendly error messages */
export function parseJSON(jsonString: string): { data?: unknown; error?: string } {
  try {
    const data = JSON.parse(jsonString);
    return { data };
  } catch (e) {
    const err = e as SyntaxError;
    return { error: `Invalid JSON syntax: ${err.message}` };
  }
}
