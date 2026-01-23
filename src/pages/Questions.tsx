import React, { useState, useEffect, useContext } from 'react';
import { QuestionCard } from '@/components/QuestionCard';
import { Question } from '@/types';
import { resolveQuestionTypeFromRow } from '@/lib/questionType';
import { toast } from 'sonner';
import { useTheme } from '@/hooks/useTheme';
import { Link } from 'react-router-dom';
import { AuthContext } from '@/contexts/authContext';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function Questions() {
  const { theme, toggleTheme } = useTheme();
  const { currentUser } = useContext(AuthContext);
  const { t } = useTranslation();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([]);

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
  
  // 从Supabase加载题目
  useEffect(() => {
    if (!currentUser?.id) return;

    const loadQuestions = async () => {
      const { data: userQuestions, error } = await supabase
        .from('questions')
        .select('*')
        .eq('owner_id', currentUser.id)
        .order('number', { ascending: true });

      if (error) {
        console.error('加载题目失败:', error);
        toast.error(t('questions.toastLoadFail'));
        return;
      }

      if (userQuestions && userQuestions.length > 0) {
        const parsedQuestions = userQuestions.map(mapQuestionRow);
        setQuestions(parsedQuestions);
        setFilteredQuestions(parsedQuestions);
        return;
      }

      const { data: globalQuestions } = await supabase
        .from('questions')
        .select('*')
        .eq('is_global', true)
        .order('number', { ascending: true });

      if (globalQuestions) {
        const parsedQuestions = globalQuestions.map(mapQuestionRow);
        setQuestions(parsedQuestions);
        setFilteredQuestions(parsedQuestions);
      }
    };

    loadQuestions();
  }, [currentUser]);
  
  // 过滤题目
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredQuestions(questions);
      return;
    }
    
    const lowercasedTerm = searchTerm.toLowerCase();
    const filtered = questions.filter(q => 
      q.question.toLowerCase().includes(lowercasedTerm) ||
      q.number.toString().includes(searchTerm) ||
      Object.values(q.options).some(option => 
        option.toLowerCase().includes(lowercasedTerm)
      ) ||
      q.explanation.toLowerCase().includes(lowercasedTerm)
    );
    
    setFilteredQuestions(filtered);
  }, [searchTerm, questions]);
  
  // 删除题目
  const handleDeleteQuestion = (id: string) => {
    if (window.confirm(t('questions.confirmDeleteOne'))) {
      const deleteQuestion = async () => {
        const { error } = await supabase.from('questions').delete().eq('id', id);
        if (error) {
          toast.error(t('questions.toastDeleteFail'));
          return;
        }

        const updatedQuestions = questions.filter(q => q.id !== id);
        setQuestions(updatedQuestions);
        setFilteredQuestions(updatedQuestions);
        toast.success(t('questions.toastDeleted'));
      };

      deleteQuestion();
    }
  };
  
  // 清空所有题目
  const handleClearAll = () => {
    if (window.confirm(t('questions.confirmDeleteAll'))) {
      const clearQuestions = async () => {
        if (!currentUser?.id) return;

        await supabase.from('questions').delete().eq('owner_id', currentUser.id);

        if (currentUser.isAdmin) {
          await supabase.from('questions').delete().eq('is_global', true);
        }

        setQuestions([]);
        setFilteredQuestions([]);
        toast.success(t('questions.toastCleared'));
      };

      clearQuestions();
    }
  };
  
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
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold mb-2">{t('questions.title')}</h2>
              <p className="text-gray-600 dark:text-gray-400">{t('questions.subtitle')}</p>
            </div>
              <div className="mt-4 md:mt-0 flex flex-wrap gap-3">
                <Link
                  to="/import"
                  className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                >
                  <i className="fa-solid fa-file-import mr-1"></i> {t('questions.importButton')}
                </Link>
                <Link
                  to="/create-question"
                  className="px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                >
                  <i className="fa-solid fa-plus mr-1"></i> {t('questions.createButton')}
                </Link>
                {questions.length > 0 && (
                  <Link
                    to="/exam"
                    className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                  >
                    <i className="fa-solid fa-pen-to-square mr-1"></i> {t('questions.startExamButton')}
                  </Link>
                )}
                <Link
                  to="/"
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  <i className="fa-solid fa-arrow-left mr-1"></i> {t('common.backHome')}
                </Link>
              </div>
          </div>
          
          {/* 搜索和统计区域 */}
          {questions.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-6 mb-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold mb-1">{t('questions.listTitle')}</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {t('questions.listStats', { total: questions.length, filtered: filteredQuestions.length })}
                  </p>
                </div>
                <div className="mt-4 md:mt-0 flex space-x-2">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={t('questions.searchPlaceholder')}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <i className="fa-solid fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                  </div>
                  <button
                    onClick={handleClearAll}
                    className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                  >
                    <i className="fa-solid fa-trash-can mr-1"></i> {t('questions.clearAll')}
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* 题目列表 */}
          {filteredQuestions.length > 0 ? (
            <div className="space-y-6">
              {filteredQuestions.map(question => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  showExplanation={true}
                  isEditable={true}
                  onDelete={() => handleDeleteQuestion(question.id)}
                />
              ))}
            </div>
          ) : questions.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-12 text-center">
              <div className="text-6xl text-gray-300 dark:text-gray-600 mb-4">
                <i className="fa-solid fa-book-open"></i>
              </div>
              <h3 className="text-xl font-bold mb-2">{t('questions.noQuestionsTitle')}</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {t('questions.noQuestionsDesc')}
              </p>
              <Link
                to="/import"
                className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                <i className="fa-solid fa-file-import mr-2"></i>
                {t('questions.importButton')}
              </Link>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-12 text-center">
              <div className="text-6xl text-gray-300 dark:text-gray-600 mb-4">
                <i className="fa-solid fa-search"></i>
              </div>
              <h3 className="text-xl font-bold mb-2">{t('questions.noResultsTitle')}</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {t('questions.noResultsDesc')}
              </p>
              <button
                onClick={() => setSearchTerm('')}
                className="inline-flex items-center px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium rounded-lg transition-colors"
              >
                <i className="fa-solid fa-rotate-left mr-2"></i>
                {t('questions.clearSearch')}
              </button>
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