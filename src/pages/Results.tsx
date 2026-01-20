import React, { useState, useEffect } from 'react';
import { QuestionCard } from '@/components/QuestionCard';
import { ExamSession, Question } from '@/types';
import { useTheme } from '@/hooks/useTheme';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export default function Results() {
  const { theme, toggleTheme } = useTheme();
  const [examResult, setExamResult] = useState<ExamSession | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showIncorrectOnly, setShowIncorrectOnly] = useState(false);
  
  // 从localStorage加载考试结果和题目
  useEffect(() => {
    const savedResult = localStorage.getItem('currentExamResult');
    const currentUserId = localStorage.getItem('currentUserId');
    const userId = currentUserId || 'anonymous';
    
    // 尝试加载用户自己的题目，如果没有则加载全局题目
    let savedQuestions = localStorage.getItem(`questions_${userId}`);
    if (!savedQuestions) {
      savedQuestions = localStorage.getItem('questions_global');
    }
    
    if (savedResult && savedQuestions) {
      try {
        const parsedResult = JSON.parse(savedResult);
        const parsedQuestions = JSON.parse(savedQuestions);
        
        setExamResult(parsedResult);
        
        // 过滤出本次考试使用的题目
        const examQuestionIds = parsedResult.questions.map(q => q.questionId);
        const examQuestions = parsedQuestions.filter(q => 
          examQuestionIds.includes(q.id)
        );
        
        // 根据考试结果中的顺序重新排序题目
        const orderedQuestions = parsedResult.questions.map(q => 
          examQuestions.find(question => question.id === q.questionId)
        ).filter(Boolean) as Question[];
        
        setQuestions(orderedQuestions);
      } catch (error) {
        console.error('加载考试结果失败:', error);
      }
    }
  }, []);
  
  // 计算统计数据
  const getStats = () => {
    if (!examResult) return { total: 0, correct: 0, incorrect: 0 };
    
    const correct = examResult.questions.filter(q => q.isCorrect).length;
    const incorrect = examResult.questions.filter(q => q.isCorrect === false).length;
    
    return {
      total: examResult.questions.length,
      correct,
      incorrect,
      accuracy: examResult.score || 0
    };
  };
  
  // 获取饼图数据
  const getPieData = () => {
    const stats = getStats();
    return [
      { name: '正确', value: stats.correct },
      { name: '错误', value: stats.incorrect }
    ];
  };
  
  // 过滤显示的题目
  const getDisplayQuestions = () => {
    if (!showIncorrectOnly) return questions;
    
    return questions.filter((question, index) => {
      if (!examResult) return false;
      return examResult.questions[index].isCorrect === false;
    });
  };
  
  // 格式化考试时长
  const formatExamDuration = () => {
    if (!examResult?.startTime || !examResult?.endTime) return '00:00';
    
    const startTime = new Date(examResult.startTime);
    const endTime = new Date(examResult.endTime);
    const durationInSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
    
    const minutes = Math.floor(durationInSeconds / 60);
    const seconds = durationInSeconds % 60;
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  const stats = getStats();
  const COLORS = ['#10B981', '#EF4444']; // 绿色和红色
  
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
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold mb-2">考试结果</h2>
              <p className="text-gray-600 dark:text-gray-400">查看您的考试成绩和详细解析</p>
            </div>
            <Link
              to="/"
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              <i className="fa-solid fa-arrow-left mr-1"></i> 返回首页
            </Link>
          </div>
          
          {examResult && questions.length > 0 ? (
            <>
              {/* 成绩概览卡片 */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-8 mb-8"
              >
                <div className="flex flex-col md:flex-row items-center justify-between">
                  <div className="text-center md:text-left mb-6 md:mb-0">
                    <h3 className="text-2xl font-bold mb-2">恭喜完成考试！</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      您于 {new Date(examResult.endTime || examResult.startTime).toLocaleString()} 完成了考试
                    </p>
                    <div className="flex items-center space-x-6">
                      <div>
                        <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                          {stats.accuracy}%
                        </div>
                        <div className="text-gray-600 dark:text-gray-400">正确率</div>
                      </div>
                      <div>
                        <div className="text-4xl font-bold text-green-600 dark:text-green-400 mb-1">
                          {stats.correct}/{stats.total}
                        </div>
                        <div className="text-gray-600 dark:text-gray-400">正确题数</div>
                      </div>
                      <div>
                        <div className="text-4xl font-bold text-purple-600 dark:text-purple-400 mb-1">
                          {formatExamDuration()}
                        </div>
                        <div className="text-gray-600 dark:text-gray-400">用时</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="w-48 h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={getPieData()}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={70}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {getPieData().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                <div className="mt-8 flex justify-center space-x-4">
                  <Link
                    to="/exam"
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                  >
                    <i className="fa-solid fa-repeat mr-2"></i>
                    再次考试
                  </Link>
                  <Link
                    to="/questions"
                    className="px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium rounded-lg transition-colors"
                  >
                    <i className="fa-solid fa-book mr-2"></i>
                    查看题库
                  </Link>
                </div>
              </motion.div>
              
              {/* 题目解析 */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold">题目解析</h3>
                  <button
                    onClick={() => setShowIncorrectOnly(!showIncorrectOnly)}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    {showIncorrectOnly ? (
                      <>
                        <i className="fa-solid fa-eye mr-1"></i> 显示所有题目
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-filter mr-1"></i> 只看错题
                      </>
                    )}
                  </button>
                </div>
                
                <div className="space-y-6">
                  {getDisplayQuestions().map((question, index) => {
                    // 找到对应的考试记录
                    const examQuestion = examResult.questions.find(
                      q => q.questionId === question.id
                    );
                    
                    return (
                      <QuestionCard
                        key={question.id}
                        question={question}
                        showExplanation={true}
                        userAnswer={examQuestion?.userAnswer || null}
                      />
                    );
                  })}
                </div>
                
                {getDisplayQuestions().length === 0 && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-8 text-center">
                    <div className="text-6xl text-green-500 mb-4">
                      <i className="fa-solid fa-trophy"></i>
                    </div>
                    <h3 className="text-xl font-bold mb-2">恭喜！您没有答错的题目</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      您的表现非常出色，继续保持！
                    </p>
                    <button
                      onClick={() => setShowIncorrectOnly(false)}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                    >
                      <i className="fa-solid fa-eye mr-2"></i>
                      查看所有题目解析
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-12 text-center">
              <div className="text-6xl text-gray-300 dark:text-gray-600 mb-4">
                <i className="fa-solid fa-file-circle-exclamation"></i>
              </div>
              <h3 className="text-xl font-bold mb-2">没有找到考试结果</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                请先完成一次模拟考试
              </p>
              <Link
                to="/exam"
                className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                <i className="fa-solid fa-play mr-2"></i>
                开始考试
              </Link>
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