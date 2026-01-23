import type { Question, QuestionType } from '@/types';

const QUESTION_TYPE_ALIASES: Record<string, QuestionType> = {
  single: 'single',
  'single choice': 'single',
  'single-choice': 'single',
  singlechoice: 'single',
  multiple: 'multiple',
  multi: 'multiple',
  'multiple choice': 'multiple',
  'multiple-choice': 'multiple',
  multiplechoice: 'multiple',
  order: 'order',
  ordered: 'order',
  ordering: 'order',
  sequence: 'order',
  sequencing: 'order',
  match: 'matching',
  matching: 'matching',
  mapping: 'matching',
  'match-up': 'matching'
};

export const normalizeQuestionType = (value?: string | null): QuestionType | null => {
  if (!value) return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
  return QUESTION_TYPE_ALIASES[normalized] ?? null;
};

export const resolveQuestionTypeFromRow = (row: {
  question_type?: string | null;
  is_multiple_choice?: boolean | null;
  correct_answer?: unknown;
  sub_questions?: unknown;
}): QuestionType => {
  const normalizedType = normalizeQuestionType(row.question_type);
  if (normalizedType) return normalizedType;
  if (Array.isArray(row.sub_questions) && row.sub_questions.length > 0) return 'matching';
  if (row.is_multiple_choice) return 'multiple';
  if (Array.isArray(row.correct_answer) && row.correct_answer.length > 1) return 'multiple';
  return 'single';
};

export const resolveQuestionType = (
  question: Pick<Question, 'questionType' | 'isMultipleChoice' | 'correctAnswer' | 'subQuestions'>
): QuestionType => {
  const normalizedType = normalizeQuestionType(question.questionType);
  if (normalizedType) return normalizedType;
  if (Array.isArray(question.subQuestions) && question.subQuestions.length > 0) return 'matching';
  if (question.isMultipleChoice) return 'multiple';
  if (Array.isArray(question.correctAnswer) && question.correctAnswer.length > 1) return 'multiple';
  return 'single';
};

export const isOrderQuestion = (question: Pick<Question, 'questionType' | 'isMultipleChoice' | 'correctAnswer'>): boolean =>
  resolveQuestionType(question) === 'order';
