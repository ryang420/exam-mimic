import React, { useState, useContext } from 'react';
import { FileImporter } from '@/components/FileImporter';
import { QuestionCard } from '@/components/QuestionCard';
import { Question } from '@/types';
import { toast } from 'sonner';
import { useTheme } from '@/hooks/useTheme';
import { Link } from 'react-router-dom';
import { AuthContext } from '@/contexts/authContext';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function Import() {
  const { theme, toggleTheme } = useTheme();
  const { currentUser } = useContext(AuthContext);
  const { t } = useTranslation();
  const [importedQuestions, setImportedQuestions] = useState<Question[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const mapQuestionRow = (row: any): Question => ({
    id: row.id,
    number: row.number,
    question: row.question,
    options: row.options || {},
    correctAnswer: row.correct_answer || [],
    explanation: row.explanation || '',
    isMultipleChoice: row.is_multiple_choice ?? (row.correct_answer?.length > 1),
    createdAt: row.created_at,
    createdBy: row.created_by
  });
  
  // 从Supabase加载已保存的题目
  React.useEffect(() => {
    if (!currentUser?.id) return;

    const loadQuestions = async () => {
      const { data: userQuestions, error } = await supabase
        .from('questions')
        .select('*')
        .eq('owner_id', currentUser.id)
        .order('number', { ascending: true });

      if (error) {
        console.error('加载题目失败:', error);
        return;
      }

      if (userQuestions && userQuestions.length > 0) {
        setImportedQuestions(userQuestions.map(mapQuestionRow));
        return;
      }

      if (currentUser.isAdmin) {
        const { data: globalQuestions } = await supabase
          .from('questions')
          .select('*')
          .eq('is_global', true)
          .order('number', { ascending: true });

        if (globalQuestions) {
          setImportedQuestions(globalQuestions.map(mapQuestionRow));
        }
      }
    };

    loadQuestions();
  }, [currentUser]);
  
  // 处理文件导入
  const handleImport = async (questions: Question[]) => {
    if (questions.length === 0) {
      toast.warning(t('import.toast.empty'));
      return;
    }
    
    // 合并现有题目和新导入的题目
    const existingNumbers = new Set(importedQuestions.map(q => q.number));
    let maxNumber = Math.max(0, ...importedQuestions.map(q => q.number));
    
    // 确保每个题目都有唯一的编号
    const newQuestions = questions.map(q => {
      if (existingNumbers.has(q.number)) {
        maxNumber++;
        return { ...q, number: maxNumber };
      }
      existingNumbers.add(q.number);
      if (q.number > maxNumber) {
        maxNumber = q.number;
      }
      return q;
    });
    
    // 更新题目列表
    const updatedQuestions = [...importedQuestions, ...newQuestions];
    
    // 按编号排序
    updatedQuestions.sort((a, b) => a.number - b.number);
    
    if (!currentUser?.id) {
      toast.error(t('import.toast.loginFirst'));
      return;
    }

    const questionRows = newQuestions.map((question) => ({
      id: question.id,
      owner_id: currentUser.id,
      number: question.number,
      question: question.question,
      options: question.options,
      correct_answer: question.correctAnswer,
      explanation: question.explanation,
      is_multiple_choice: question.isMultipleChoice ?? question.correctAnswer.length > 1,
      created_by: currentUser.username,
      is_global: currentUser.isAdmin ? true : false
    }));

    const { error } = await supabase.from('questions').insert(questionRows);
    if (error) {
      console.error('保存题目失败:', error);
      toast.error(t('import.toast.saveFail'));
      return;
    }

    setImportedQuestions(updatedQuestions);
    setShowPreview(true);
  };
  
  // 清除所有题目
  const handleClearAll = () => {
    if (window.confirm(t('questions.confirmDeleteAll'))) {
      if (!currentUser?.id) return;

      const clearQuestions = async () => {
        await supabase.from('questions').delete().eq('owner_id', currentUser.id);

        if (currentUser.isAdmin) {
          await supabase.from('questions').delete().eq('is_global', true);
        }

        setImportedQuestions([]);
        setShowPreview(false);
        toast.success(t('questions.toastCleared'));
      };

      clearQuestions();
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!currentUser?.id) return;
    const { error } = await supabase.from('questions').delete().eq('id', id);
    if (error) {
      toast.error(t('import.toast.deleteFail'));
      return;
    }
    const updatedQuestions = importedQuestions.filter(q => q.id !== id);
    setImportedQuestions(updatedQuestions);
    toast.success(t('import.toast.deleted'));
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
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold mb-2">{t('import.title')}</h2>
              <p className="text-gray-600 dark:text-gray-400">{t('import.subtitle')}</p>
            </div>
            <Link
              to="/"
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              <i className="fa-solid fa-arrow-left mr-1"></i> {t('common.backHome')}
            </Link>
          </div>
          
          {/* 文件导入区域 */}
          <div className="mb-12">
            <FileImporter onImport={handleImport} />
          </div>
          
          {/* 已导入题目统计 */}
          {importedQuestions.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-6 mb-8">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">{t('import.importedTitle')}</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={handleClearAll}
                    className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                  >
                    <i className="fa-solid fa-trash-can mr-1"></i> {t('import.buttons.clear')}
                  </button>
                   <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                  >
                    {showPreview ? (
                      <>
                        <i className="fa-solid fa-eye-slash mr-1"></i> {t('import.buttons.hidePreview')}
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-eye mr-1"></i> {t('import.buttons.showPreview')}
                      </>
                    )}
                  </button>
                  <Link
                    to="/create-question"
                    className="px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                  >
                    <i className="fa-solid fa-plus mr-1"></i> {t('import.buttons.create')}
                  </Link>
                  <Link
                    to="/exam"
                    className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                  >
                    <i className="fa-solid fa-pen-to-square mr-1"></i> {t('import.buttons.startExam')}
                  </Link>
                </div>
              </div>
              <div className="text-center py-4">
                <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                  {importedQuestions.length}
                </div>
                <div className="text-gray-600 dark:text-gray-400">
                  {t('import.totalImported', { count: importedQuestions.length })}
                </div>
              </div>
            </div>
          )}
          
          {/* 题目预览 */}
          {showPreview && importedQuestions.length > 0 && (
            <div>
              <h3 className="text-xl font-bold mb-4">{t('import.previewTitle')}</h3>
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {importedQuestions.slice(0, 3).map(question => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    isEditable={true}
                    onDelete={() => handleDeleteQuestion(question.id)}
                  />
                ))}
                
                {importedQuestions.length > 3 && (
                  <div className="text-center py-4 text-gray-600 dark:text-gray-400">
                    {t('import.previewMore', { count: importedQuestions.length - 3 })}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* 操作提示 */}
          {importedQuestions.length > 0 && (
            <div className="mt-8 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
              <h4 className="font-semibold text-yellow-800 dark:text-yellow-400 mb-2 flex items-center">
                <i className="fa-solid fa-circle-info mr-2"></i>
                {t('import.tipsTitle')}
              </h4>
              <ul className="text-yellow-700 dark:text-yellow-300 space-y-2">
                <li className="flex items-start">
                  <i className="fa-solid fa-check-circle mt-1 mr-2"></i>
                  <span>{t('import.tips.saved')}</span>
                </li>
                <li className="flex items-start">
                  <i className="fa-solid fa-check-circle mt-1 mr-2"></i>
                  <span>{t('import.tips.startExam')}</span>
                </li>
                <li className="flex items-start">
                  <i className="fa-solid fa-check-circle mt-1 mr-2"></i>
                  <span>{t('import.tips.importMore')}</span>
                </li>
              </ul>
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