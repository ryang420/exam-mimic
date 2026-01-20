import React, { useState, useEffect } from 'react';
import { QuestionCard } from '@/components/QuestionCard';
import { ExamTimer } from '@/components/ExamTimer';
import { Question, ExamSession } from '@/types';
import { toast } from 'sonner';
import { useTheme } from '@/hooks/useTheme';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Exam() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string[]>>({});
  const [isExamStarted, setIsExamStarted] = useState(false);
  const [examDuration] = useState(30); // 考试时长（分钟）
  const [examSession, setExamSession] = useState<ExamSession | null>(null);
  
  // 从localStorage加载题目
  useEffect(() => {
    const currentUserId = localStorage.getItem('currentUserId');
    const userId = currentUserId || 'default';
    let savedQuestions = localStorage.getItem(`questions_${userId}`);
    
    // 如果用户没有自己的题目，尝试加载全局题目
    if (!savedQuestions) {
      savedQuestions = localStorage.getItem('questions_global');
    }
    
    if (savedQuestions) {
      try {
        const parsedQuestions = JSON.parse(savedQuestions);
        // 打乱题目顺序
        const shuffledQuestions = [...parsedQuestions].sort(() => Math.random() - 0.5);
        setQuestions(shuffledQuestions);
      } catch (error) {
        console.error('加载题目失败:', error);
        toast.error('加载题目失败');
      }
    }
  }, []);
  
  // 开始考试
  const startExam = () => {
    if (questions.length === 0) {
      toast.error('没有可用的题目，请先导入题目');
      return;
    }
    
    // 创建考试会话
    const newSession: ExamSession = {
      id: `exam-${Date.now()}`,
      startTime: new Date(),
      questions: questions.map(q => ({
        questionId: q.id,
        userAnswer: null,
        isCorrect: null
      })),
      score: null
    };
    
    setExamSession(newSession);
    setIsExamStarted(true);
    setCurrentQuestionIndex(0);
    setUserAnswers({});
  };
  
  // 切换答案选择状态
  const toggleAnswer = (answer: string) => {
    const questionId = questions[currentQuestionIndex].id;
    const currentAnswers = userAnswers[questionId] || [];
    
    setUserAnswers(prev => {
      if (currentAnswers.includes(answer)) {
        // 取消选择
        return {
          ...prev,
          [questionId]: currentAnswers.filter(a => a !== answer)
        };
      } else {
        // 添加选择
        return {
          ...prev,
          [questionId]: [...currentAnswers, answer]
        };
      }
    });
  };
  
  // 下一题
  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };
  
  // 上一题
  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };
  
  // 跳转到指定题目
  const goToQuestion = (index: number) => {
    setCurrentQuestionIndex(index);
  };
  
  // 交卷
  const submitExam = () => {
    if (!examSession) return;
    
    // 计算得分
    let totalScore = 0;
    
    // 检查每道题的答案是否正确
    const updatedQuestions = examSession.questions.map(q => {
      const userAnswer = userAnswers[q.questionId] || [];
      const question = questions.find(question => question.id === q.questionId);
      
      if (!question) {
        return {
          ...q,
          userAnswer,
          isCorrect: null
        };
      }
      
      // 对于多选题，所有答案都必须正确才算正确
      const isCorrect = question.correctAnswer.length > 0 && 
        question.correctAnswer.length === userAnswer.length &&
        question.correctAnswer.every(answer => userAnswer.includes(answer));
      
      if (isCorrect) {
        totalScore += 1;
      }
      
      return {
        ...q,
        userAnswer,
        isCorrect
      };
    });
    
    const score = questions.length > 0 ? Math.round((totalScore / questions.length) * 100) : 0;
    
    // 更新考试会话
    const updatedSession: ExamSession = {
      ...examSession,
      endTime: new Date(),
      score,
      questions: updatedQuestions
    };
    
    // 获取当前用户信息
    const currentUserId = localStorage.getItem('currentUserId');
    const currentUser = JSON.parse(localStorage.getItem('users') || '[]').find((user: any) => user.id === currentUserId);
    
    // 更新考试会话，添加用户信息
    const userExamSession = {
      ...updatedSession,
      userId: currentUserId || 'anonymous',
      username: currentUser?.username || '匿名用户'
    };
    
    // 保存考试结果到用户的考试历史
    const userId = currentUserId || 'anonymous';
    const userExamHistory = JSON.parse(localStorage.getItem(`examHistory_${userId}`) || '[]');
    userExamHistory.push(userExamSession);
    localStorage.setItem(`examHistory_${userId}`, JSON.stringify(userExamHistory));
    
    // 保存到全局考试历史（用于统计）
    const globalExamHistory = JSON.parse(localStorage.getItem('examHistory_global') || '[]');
    globalExamHistory.push(userExamSession);
    localStorage.setItem('examHistory_global', JSON.stringify(globalExamHistory));
    
    // 保存当前考试会话以便结果页面使用
    localStorage.setItem('currentExamResult', JSON.stringify(updatedSession));
    
    // 跳转到结果页面
    navigate('/results');
  };
  
  // 时间到处理
  const handleTimeUp = () => {
    toast.warning('考试时间已结束，自动提交试卷');
    submitExam();
  };
  
  // 获取题目状态（已答/未答）
  const getQuestionStatus = (index: number): 'unanswered' | 'answered' | 'current' => {
    if (index === currentQuestionIndex) return 'current';
    const questionId = questions[index].id;
    return (userAnswers[questionId] && userAnswers[questionId].length > 0) ? 'answered' : 'unanswered';
  };
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300">
      {/* 顶部导航栏 */}
      <nav className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            <i className="fa-solid fa-graduation-cap mr-2"></i>
            模拟考试系统
          </h1>
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 transition-colors"
              aria-label={theme === 'light' ? '切换到暗色模式' : '切换到亮色模式'}
            >
              {theme === 'light' ? (
                <i className="fa-solid fa-moon"></i>
              ) : (
                <i className="fa-solid fa-sun"></i>
              )}
            </button>
          </div>
        </div>
      </nav>
      
      {/* 主要内容 */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          {!isExamStarted ? (
            // 考试开始前
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-8 text-center">
              <div className="text-6xl text-blue-500 mb-6">
                <i className="fa-solid fa-file-lines"></i>
              </div>
              <h2 className="text-3xl font-bold mb-4">准备开始模拟考试</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                本次考试共有 <span className="font-bold text-blue-600 dark:text-blue-400">{questions.length}</span> 道题目，考试时长为 <span className="font-bold text-blue-600 dark:text-blue-400">{examDuration}</span> 分钟
              </p>
              
              {questions.length === 0 ? (
                <div className="mb-8">
                  <p className="text-red-500 dark:text-red-400 mb-4">没有可用的题目</p>
                  <Link
                    to="/import"
                    className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                  >
                    <i className="fa-solid fa-file-import mr-2"></i>
                    去导入题目
                  </Link>
                </div>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={startExam}
                  className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg rounded-lg shadow-lg transition-all"
                >
                  <i className="fa-solid fa-play mr-2"></i>
                  开始考试
                </motion.button>
              )}
              
              <div className="mt-8 text-gray-600 dark:text-gray-400 text-left">
                <h3 className="font-semibold mb-2">考试规则：</h3>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <i className="fa-solid fa-circle-check text-green-500 mt-1 mr-2"></i>
                    <span>考试开始后将开始计时，时间结束后自动提交</span>
                  </li>
                  <li className="flex items-start">
                    <i className="fa-solid fa-circle-check text-green-500 mt-1 mr-2"></i>
                    <span>您可以随时切换题目，系统会自动保存您的答案</span>
                  </li>
                  <li className="flex items-start">
                    <i className="fa-solid fa-circle-check text-green-500 mt-1 mr-2"></i>
                    <span>提交后将立即显示您的考试成绩和详细解析</span>
                  </li>
                  <li className="flex items-start">
                    <i className="fa-solid fa-circle-check text-green-500 mt-1 mr-2"></i>
                    <span>部分题目支持多选，请选择所有正确答案</span>
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            // 考试进行中
            <div className="space-y-6">
              {/* 计时器 */}
              <ExamTimer 
                durationInMinutes={examDuration}
                onTimeUp={handleTimeUp}
                isRunning={isExamStarted}
              />
              
              {/* 题目导航 */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 p-4 overflow-x-auto">
                <div className="flex items-center mb-3">
                  <h3 className="font-semibold mr-3">题目导航：</h3>
                  <div className="flex space-x-2 text-sm">
                    <span className="flex items-center">
                      <span className="w-3 h-3 bg-blue-500 rounded-full mr-1"></span> 当前
                    </span>
                    <span className="flex items-center">
                      <span className="w-3 h-3 bg-green-500 rounded-full mr-1"></span> 已答
                    </span>
                    <span className="flex items-center">
                      <span className="w-3 h-3 bg-gray-300 dark:bg-gray-600 rounded-full mr-1"></span> 未答
                    </span>
                  </div>
                </div>
                <div className="flex space-x-2">
                  {questions.map((_, index) => {
                    const status = getQuestionStatus(index);
                    let bgColor = 'bg-gray-300 dark:bg-gray-600'; // 未答
                    let textColor = 'text-gray-800 dark:text-gray-200';
                    
                    if (status === 'answered') {
                      bgColor = 'bg-green-500';
                    } else if (status === 'current') {
                      bgColor = 'bg-blue-500';
                      textColor = 'text-white';
                    }
                    
                    return (
                      <button
                        key={index}
                        onClick={() => goToQuestion(index)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-medium transition-all ${bgColor} ${textColor}`}
                      >
                        {index + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* 当前题目 */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold">
                    题目 {currentQuestionIndex + 1}/{questions.length}
                  </h3>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    剩余 {questions.length - Object.values(userAnswers).filter(answers => answers.length > 0).length} 道题未答
                  </span>
                </div>
                
                {questions[currentQuestionIndex] && (
                  <div className="mb-6">
                    <div className="text-gray-800 dark:text-gray-200 mb-6 whitespace-pre-line">
                      {questions[currentQuestionIndex].question}
                    </div>
                    
                    {/* 显示是否为多选题 */}
                    {questions[currentQuestionIndex].isMultipleChoice && (
                      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <span className="text-blue-600 dark:text-blue-400 text-sm font-medium">
                          <i className="fa-solid fa-info-circle mr-1"></i> 多选题，请选择所有正确答案
                        </span>
                      </div>
                    )}
                    
                    <div className="space-y-3 mb-6">
                      {Object.entries(questions[currentQuestionIndex].options).map(([key, value]) => {
                        const currentAnswers = userAnswers[questions[currentQuestionIndex].id] || [];
                        const isSelected = currentAnswers.includes(key);
                        
                        return (
                          <motion.div
                            key={key}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => toggleAnswer(key)}
                            className={`p-4 rounded-xl border cursor-pointer transition-all ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
                            }`}
                          >
                            <div className="flex items-start">
                              <span className={`font-bold mr-3 ${isSelected ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                {key}
                              </span>
                              <span>{value}</span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* 操作按钮 */}
                <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-gray-700">
                  <button
                    onClick={prevQuestion}
                    disabled={currentQuestionIndex === 0}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      currentQuestionIndex === 0
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200'
                    }`}
                  >
                    <i className="fa-solid fa-arrow-left mr-1"></i> 上一题
                  </button>
                  
                  <button
                    onClick={submitExam}
                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                  >
                    <i className="fa-solid fa-paper-plane mr-1"></i> 交卷
                  </button>
                  
                  <button
                    onClick={nextQuestion}
                    disabled={currentQuestionIndex === questions.length - 1}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      currentQuestionIndex === questions.length - 1
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200'
                    }`}
                  >
                    下一题 <i className="fa-solid fa-arrow-right ml-1"></i>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      
      {/* 页脚 */}
      <footer className="bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-8 mt-16">
        <div className="container mx-auto px-4 text-center text-gray-600 dark:text-gray-400">
          <p>© 2026 模拟考试系统 | 设计与开发</p>
        </div>
      </footer>
    </div>
  );
}