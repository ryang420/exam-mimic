// 题目类型定义
export interface Question {
  id: string;
  number: number;
  question: string;
  options: Record<string, string>;
  correctAnswer: string[];
  explanation: string;
  isMultipleChoice?: boolean;
  createdAt?: string;
  createdBy?: string;
}

// 考试会话类型定义
export interface ExamSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  questions: {
    questionId: string;
    userAnswer: string | null;
    isCorrect: boolean | null;
  }[];
  score: number | null;
  userId: string;
  username: string;
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