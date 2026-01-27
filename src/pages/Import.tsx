import { useState, useContext, useEffect } from 'react';
import { FileImporter } from '@/components/FileImporter';
import { QuestionCard } from '@/components/QuestionCard';
import { Course, Question } from '@/types';
import { resolveQuestionTypeFromRow } from '@/lib/questionType';
import { toast } from 'sonner';
import { useTheme } from '@/hooks/useTheme';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthContext } from '@/contexts/authContext';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Breadcrumbs } from '@/components/Breadcrumbs';

export default function Import() {
  const { theme, toggleTheme } = useTheme();
  const { currentUser, logout } = useContext(AuthContext);
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [importedQuestions, setImportedQuestions] = useState<Question[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const canManageQuestions = currentUser?.isAdmin || currentUser?.isAuthor;

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
      createdBy: row.created_by,
      courseId: row.course_id ?? undefined
    };
  };

  useEffect(() => {
    const loadCourses = async () => {
      setIsLoadingCourses(true);
      const { data, error } = await supabase
        .from('courses')
        .select('id, title, description, duration_minutes, created_at, created_by')
        .order('created_at', { ascending: false });

      if (error) {
        console.error(t('courses.toastLoadFail'), error);
        setIsLoadingCourses(false);
        return;
      }

      const mapped = (data ?? []).map((course) => ({
        id: course.id,
        title: course.title,
        description: course.description ?? '',
        durationMinutes: course.duration_minutes ?? 60,
        createdAt: course.created_at ?? undefined,
        createdBy: course.created_by ?? undefined
      })) as Course[];

      setCourses(mapped);
      setIsLoadingCourses(false);
    };

    loadCourses();
  }, [t]);

  useEffect(() => {
    if (courses.length === 0) return;
    const paramCourseId = searchParams.get('courseId');
    if (paramCourseId && courses.some((course) => course.id === paramCourseId)) {
      setSelectedCourseId(paramCourseId);
      return;
    }
    if (!selectedCourseId) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, searchParams, selectedCourseId]);
  
  // 从Supabase加载已保存的题目
  useEffect(() => {
    if (!currentUser?.id || !selectedCourseId) {
      setImportedQuestions([]);
      setShowPreview(false);
      return;
    }

    const loadQuestions = async () => {
      const pageSize = 1000;
      const fetchPagedQuestions = async (filters: {
        ownerId?: string;
        isGlobal?: boolean;
      }) => {
        let from = 0;
        const allRows: any[] = [];

        while (true) {
          let query = supabase
            .from('questions')
            .select('*')
            .eq('course_id', selectedCourseId)
            .order('number', { ascending: true });

          if (filters.ownerId) {
            query = query.eq('owner_id', filters.ownerId);
          }

          if (filters.isGlobal) {
            query = query.eq('is_global', true);
          }

          const { data, error } = await query.range(from, from + pageSize - 1);
          if (error) {
            throw error;
          }

          const chunk = data ?? [];
          allRows.push(...chunk);
          if (chunk.length < pageSize) {
            break;
          }
          from += pageSize;
        }

        return allRows;
      };

      let userQuestions: any[] = [];
      try {
        userQuestions = await fetchPagedQuestions({ ownerId: currentUser.id });
      } catch (error) {
        console.error(t('import.loadFail'), error);
        return;
      }

      if (userQuestions && userQuestions.length > 0) {
        setImportedQuestions(userQuestions.map(mapQuestionRow));
        return;
      }

      if (currentUser.isAdmin) {
        let globalQuestions: any[] = [];
        try {
          globalQuestions = await fetchPagedQuestions({ isGlobal: true });
        } catch (error) {
          console.error(t('import.loadFail'), error);
          return;
        }

        if (globalQuestions.length > 0) {
          setImportedQuestions(globalQuestions.map(mapQuestionRow));
        }
      }
    };

    loadQuestions();
  }, [currentUser, selectedCourseId]);
  
  // 处理文件导入
  const handleImport = async (questions: Question[]) => {
    if (questions.length === 0) {
      toast.warning(t('import.toast.empty'));
      return;
    }

    if (!selectedCourseId) {
      toast.error(t('import.toast.courseRequired'));
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

    const questionRows = newQuestions.map((question) => {
      const questionType = question.questionType
        ?? (Array.isArray(question.subQuestions) && question.subQuestions.length > 0 ? 'matching' : null)
        ?? (question.isMultipleChoice ? 'multiple' : (question.correctAnswer.length > 1 ? 'multiple' : 'single'));

      return {
        id: question.id,
        owner_id: currentUser.id,
        number: question.number,
        question: question.question,
        options: question.options,
        correct_answer: question.correctAnswer,
        explanation: question.explanation,
        is_multiple_choice: questionType === 'multiple',
        question_type: questionType,
        sub_questions: Array.isArray(question.subQuestions) ? question.subQuestions : [],
        created_by: currentUser.username,
        is_global: canManageQuestions ? true : false,
        course_id: selectedCourseId
      };
    });

    const { error } = await supabase.from('questions').insert(questionRows);
    if (error) {
      console.error(t('import.saveFail'), error);
      return;
    }

    setImportedQuestions(updatedQuestions);
    setShowPreview(true);
  };
  
  // 清除所有题目
  const handleClearAll = () => {
    if (window.confirm(t('questions.confirmDeleteAll'))) {
      if (!currentUser?.id) return;
      if (!selectedCourseId) return;

      const clearQuestions = async () => {
        await supabase
          .from('questions')
          .delete()
          .eq('owner_id', currentUser.id)
          .eq('course_id', selectedCourseId);

        if (currentUser.isAdmin) {
          await supabase
            .from('questions')
            .delete()
            .eq('is_global', true)
            .eq('course_id', selectedCourseId);
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
              { label: t('import.title') }
            ]}
          />
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold mb-2">{t('import.title')}</h2>
              <p className="text-gray-600 dark:text-gray-400">{t('import.subtitle')}</p>
            </div>
          </div>

          {/* 课程选择 */}
          <div className="mb-8">
            <label htmlFor="course" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('import.courseLabel')}
            </label>
            {isLoadingCourses ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</div>
            ) : courses.length === 0 ? (
              <div className="text-sm text-red-500 dark:text-red-400">
                {t('import.noCourses')}{' '}
                <Link to="/courses" className="underline text-blue-600 dark:text-blue-400">
                  {t('import.goCreateCourse')}
                </Link>
              </div>
            ) : (
              <select
                id="course"
                value={selectedCourseId}
                onChange={(event) => setSelectedCourseId(event.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            )}
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
                    to={selectedCourseId ? `/create-question?courseId=${selectedCourseId}` : '/create-question'}
                    className="px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                  >
                    <i className="fa-solid fa-plus mr-1"></i> {t('import.buttons.create')}
                  </Link>
                  <Link
                    to={selectedCourseId ? `/exam?courseId=${selectedCourseId}` : '/courses'}
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