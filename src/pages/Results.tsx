import React, { useState, useEffect, useContext } from 'react';
import { QuestionCard } from '@/components/QuestionCard';
import { ExamSession, Question } from '@/types';
import { resolveQuestionTypeFromRow } from '@/lib/questionType';
import { useTheme } from '@/hooks/useTheme';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { AuthContext } from '@/contexts/authContext';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Breadcrumbs } from '@/components/Breadcrumbs';

export default function Results() {
  const { theme, toggleTheme } = useTheme();
  const { currentUser, logout } = useContext(AuthContext);
  const location = useLocation();
  const { t } = useTranslation();
  const [examResult, setExamResult] = useState<ExamSession | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showIncorrectOnly, setShowIncorrectOnly] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const retakeCourseId = (location.state as { courseId?: string } | null)?.courseId;
  const retakeLink = retakeCourseId ? `/exam?courseId=${retakeCourseId}` : '/courses';

  const mapQuestionRow = (row: any): Question => {
    const questionType = resolveQuestionTypeFromRow(row);
    return {
      id: row.id,
      number: row.number,
      question: row.question,
      options: row.options || {},
      correctAnswer: row.correct_answer || [],
      explanation: row.explanation || '',
      isMultipleChoice: questionType === 'multiple',
      questionType,
      subQuestions: row.sub_questions || [],
      createdAt: row.created_at,
      createdBy: row.created_by
    };
  };

  // 从Supabase加载考试结果和题目
  useEffect(() => {
    if (!currentUser?.id) return;

    const loadResults = async () => {
      const sessionIdFromState = (location.state as { sessionId?: string } | null)?.sessionId;
      let sessionId = sessionIdFromState;

      let sessionRow: any = null;
      if (sessionId) {
        const { data, error } = await supabase
          .from('exam_sessions')
          .select('id, score, started_at, ended_at')
          .eq('id', sessionId)
          .single();
        if (!error) {
          sessionRow = data;
        }
      } else {
        const { data, error } = await supabase
          .from('exam_sessions')
          .select('id, score, started_at, ended_at')
          .eq('user_id', currentUser.id)
          .order('ended_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!error) {
          sessionRow = data;
          sessionId = data?.id;
        }
      }

      if (!sessionRow || !sessionId) {
        setExamResult(null);
        setQuestions([]);
        return;
      }

      const { data: answers, error: answersError } = await supabase
        .from('exam_answers')
        .select('question_id, question_order, user_answer, is_correct')
        .eq('session_id', sessionId)
        .order('question_order', { ascending: true });

      if (answersError || !answers) {
        console.error('加载答题记录失败:', answersError);
        return;
      }

      const questionIds = answers.map(answer => answer.question_id).filter(Boolean);
      const { data: questionRows, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .in('id', questionIds);

      if (questionsError || !questionRows) {
        console.error('加载题目失败:', questionsError);
        return;
      }

      const questionMap = new Map(questionRows.map(row => [row.id, mapQuestionRow(row)]));
      const orderedQuestions = answers
        .map(answer => questionMap.get(answer.question_id))
        .filter(Boolean) as Question[];

      const parsedResult: ExamSession = {
        id: sessionRow.id,
        startTime: sessionRow.started_at ?? sessionRow.ended_at ?? new Date().toISOString(),
        endTime: sessionRow.ended_at ?? sessionRow.started_at ?? new Date().toISOString(),
        score: sessionRow.score ?? 0,
        questions: answers.map(answer => ({
          questionId: answer.question_id,
          userAnswer: answer.user_answer ?? [],
          isCorrect: answer.is_correct
        }))
      };

      setExamResult(parsedResult);
      setQuestions(orderedQuestions);
    };

    loadResults();
  }, [currentUser, location.state]);
  
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
      { name: t('results.pie.correct'), value: stats.correct },
      { name: t('results.pie.incorrect'), value: stats.incorrect }
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
            {t('common.appName')}
          </h1>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen((open) => !open)}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                aria-haspopup="menu"
                aria-expanded={isUserMenuOpen}
              >
                <i className="fa-solid fa-user"></i>
                <span>{currentUser?.firstName} {currentUser?.lastName}</span>
                {currentUser?.isAdmin && (
                  <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
                    {t('common.admin')}
                  </span>
                )}
                {!currentUser?.isAdmin && currentUser?.isAuthor && (
                  <span className="text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 px-2 py-0.5 rounded-full">
                    {t('common.author')}
                  </span>
                )}
              </button>
              {isUserMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg overflow-hidden z-50"
                  role="menu"
                >
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    role="menuitem"
                  >
                    <i className="fa-solid fa-right-from-bracket mr-2"></i>
                    {t('common.logout')}
                  </button>
                </div>
              )}
            </div>
            <LanguageSwitcher className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 transition-colors" />
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 transition-colors"
              aria-label={theme === 'light' ? t('common.switchToDark') : t('common.switchToLight')}
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
          <Breadcrumbs
            items={[
              { label: t('common.home'), to: '/' },
              { label: t('results.title') }
            ]}
          />
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold mb-2">{t('results.title')}</h2>
              <p className="text-gray-600 dark:text-gray-400">{t('results.subtitle')}</p>
            </div>
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
                    <h3 className="text-2xl font-bold mb-2">{t('results.overviewTitle')}</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      {t('results.completedAt', {
                        time: new Date(examResult.endTime || examResult.startTime).toLocaleString()
                      })}
                    </p>
                    <div className="flex items-center space-x-6">
                      <div>
                        <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                          {stats.accuracy}%
                        </div>
                        <div className="text-gray-600 dark:text-gray-400">{t('results.accuracy')}</div>
                      </div>
                      <div>
                        <div className="text-4xl font-bold text-green-600 dark:text-green-400 mb-1">
                          {stats.correct}/{stats.total}
                        </div>
                        <div className="text-gray-600 dark:text-gray-400">{t('results.correctCount')}</div>
                      </div>
                      <div>
                        <div className="text-4xl font-bold text-purple-600 dark:text-purple-400 mb-1">
                          {formatExamDuration()}
                        </div>
                        <div className="text-gray-600 dark:text-gray-400">{t('results.duration')}</div>
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
                    to={retakeLink}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                  >
                    <i className="fa-solid fa-repeat mr-2"></i>
                    {t('results.retake')}
                  </Link>
                  {currentUser?.isAdmin && (
                    <Link
                      to="/questions"
                      className="px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium rounded-lg transition-colors"
                    >
                      <i className="fa-solid fa-book mr-2"></i>
                      {t('results.viewBank')}
                    </Link>
                  )}
                </div>
              </motion.div>
              
              {/* 题目解析 */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold">{t('results.analysisTitle')}</h3>
                  <button
                    onClick={() => setShowIncorrectOnly(!showIncorrectOnly)}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    {showIncorrectOnly ? (
                      <>
                        <i className="fa-solid fa-eye mr-1"></i> {t('results.showAll')}
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-filter mr-1"></i> {t('results.showIncorrect')}
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
                    <h3 className="text-xl font-bold mb-2">{t('results.perfectTitle')}</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      {t('results.perfectDesc')}
                    </p>
                    <button
                      onClick={() => setShowIncorrectOnly(false)}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                    >
                      <i className="fa-solid fa-eye mr-2"></i>
                      {t('results.viewAllAnalysis')}
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
              <h3 className="text-xl font-bold mb-2">{t('results.noResultTitle')}</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {t('results.noResultDesc')}
              </p>
              <Link
                to="/exam"
                className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                <i className="fa-solid fa-play mr-2"></i>
                {t('results.startExam')}
              </Link>
            </div>
          )}
        </div>
      </main>
      
      {/* 页脚 */}
      <footer className="bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-8 mt-16">
        <div className="container mx-auto px-4 text-center text-gray-600 dark:text-gray-400">
          <p>{t('footer.copyright')}</p>
        </div>
      </footer>
    </div>
  );
}