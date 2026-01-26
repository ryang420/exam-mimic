// 题目类型定义
export type QuestionType = 'single' | 'multiple' | 'order' | 'matching';

export interface Question {
  id: string;
  number: number;
  question: string;
  options: Record<string, string>;
  correctAnswer: string[];
  explanation: string;
  isMultipleChoice?: boolean;
  questionType?: QuestionType;
  subQuestions?: string[];
  createdAt?: string;
  createdBy?: string;
  courseId?: string;
}

// 课程类型定义
export interface Course {
  id: string;
  title: string;
  description?: string;
  durationMinutes: number;
  createdAt?: string;
  createdBy?: string;
}

// 考试会话类型定义
export interface ExamSession {
  id: string;
  startTime: string | Date;
  endTime?: string | Date;
  questions: {
    questionId: string;
    userAnswer: string[] | null;
    isCorrect: boolean | null;
  }[];
  score: number | null;
  userId?: string;
  username?: string;
  courseId?: string;
}

// 全局统计数据类型
export interface GlobalStats {
  totalUsers: number;
  totalQuestions: number;
  totalExams: number;
  averageScore: number;
  usersStats: UserStats[];
}

// 用户统计数据类型
export interface UserStats {
  userId: string;
  username: string;
  totalExams: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
}