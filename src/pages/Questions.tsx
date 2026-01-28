import { useState, useEffect, useContext } from 'react';
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

export default function Questions() {
  const { theme, toggleTheme } = useTheme();
  const { currentUser, logout } = useContext(AuthContext);
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [pageQuestions, setPageQuestions] = useState<Question[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const PAGE_SIZE = 20;

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
        console.error('加载课程失败:', error);
        toast.error(t('courses.toastLoadFail'));
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
  
  // 从 Supabase 按页加载题目，并取总条数（服务端分页 + 服务端搜索）
  useEffect(() => {
    if (!currentUser?.id || !selectedCourseId) {
      setPageQuestions([]);
      setTotalCount(0);
      return;
    }

    let cancelled = false;

    const loadPage = async () => {
      setIsLoadingQuestions(true);
      // Avoid requesting page > 1 when we have no totalCount yet (prevents 416 from range past end)
      if (totalCount === 0 && page > 1) {
        setPage(1);
        setIsLoadingQuestions(false);
        return;
      }
      // Clamp page to a valid range so we never request past the end
      const maxPage = totalCount > 0 ? Math.max(1, Math.ceil(totalCount / PAGE_SIZE)) : null;
      const effectivePage = maxPage != null ? Math.min(page, maxPage) : page;
      const offset = (effectivePage - 1) * PAGE_SIZE;

      const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');

      const runQuery = () => {
        let query = supabase
          .from('questions')
          .select('*', { count: 'exact' })
          .eq('course_id', selectedCourseId)
          .order('number', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);
        const term = searchTerm.trim();
        if (!term) return query;
        const num = parseInt(term, 10);
        if (Number.isNaN(num)) {
          return query.or(`question.ilike.%${esc(term)}%,explanation.ilike.%${esc(term)}%`);
        }
        return query.or(`question.ilike.%${esc(term)}%,explanation.ilike.%${esc(term)}%,number.eq.${num}`);
      };

      const { data: userRows, count: userCount, error: userErr } = await runQuery();

      if (userErr) {
        if (!cancelled) {
          const is416 =
            (userErr as { code?: string; status?: number }).code === '416' ||
            (userErr as { code?: string; status?: number }).status === 416 ||
            String((userErr as { message?: string }).message ?? '').includes('416') ||
            String((userErr as { message?: string }).message ?? '')
              .toLowerCase()
              .includes('range not satisfiable');
          if (is416) {
            // PostgREST returns 416 when the Range start is past the result set; treat as "last page"
            setPage(Math.max(1, page - 1));
            setPageQuestions([]);
            setTotalCount(Math.max(0, (page - 1) * PAGE_SIZE));
            setIsLoadingQuestions(false);
            return;
          }
          console.error('加载题目失败:', userErr);
          toast.error(t('questions.toastLoadFail'));
          setIsLoadingQuestions(false);
        }
        return;
      }

      const total = userCount ?? 0;
      let rows = userRows ?? [];

      if (total === 0 && (!rows || rows.length === 0)) {
        const { data: globalRows, count: globalCount, error: globalErr } = await runQuery();
        if (!cancelled && !globalErr) {
          setPageQuestions((globalRows ?? []).map(mapQuestionRow));
          setTotalCount(globalCount ?? 0);
          if (effectivePage !== page) setPage(effectivePage);
        } else if (!cancelled && globalErr) {
          const is416 =
            (globalErr as { code?: string; status?: number }).code === '416' ||
            (globalErr as { code?: string; status?: number }).status === 416 ||
            String((globalErr as { message?: string }).message ?? '').includes('416') ||
            String((globalErr as { message?: string }).message ?? '')
              .toLowerCase()
              .includes('range not satisfiable');
          if (is416) {
            setPage(Math.max(1, page - 1));
            setPageQuestions([]);
            setTotalCount(Math.max(0, (page - 1) * PAGE_SIZE));
          } else {
            toast.error(t('questions.toastLoadFail'));
          }
        }
      } else if (!cancelled) {
        setPageQuestions(rows.map(mapQuestionRow));
        setTotalCount(total);
        if (effectivePage !== page) setPage(effectivePage);
      }

      if (!cancelled) setIsLoadingQuestions(false);
    };

    loadPage();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, selectedCourseId, page, searchTerm, refreshKey]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [selectedCourseId]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const showingCount = pageQuestions.length;

  const handleDeleteQuestion = (id: string) => {
    if (window.confirm(t('questions.confirmDeleteOne'))) {
      const deleteQuestion = async () => {
        const { error } = await supabase.from('questions').delete().eq('id', id);
        if (error) {
          toast.error(t('questions.toastDeleteFail'));
          return;
        }
        setTotalCount((c) => Math.max(0, c - 1));
        setPageQuestions((prev) => prev.filter((q) => q.id !== id));
        toast.success(t('questions.toastDeleted'));
        setRefreshKey((k) => k + 1);
      };
      deleteQuestion();
    }
  };

  useEffect(() => {
    if (page > totalPages && totalPages >= 1) setPage(totalPages);
  }, [page, totalPages]);

  const handleClearAll = () => {
    if (window.confirm(t('questions.confirmDeleteAll'))) {
      const clearQuestions = async () => {
        if (!currentUser?.id || !selectedCourseId) return;

        await supabase
          .from('questions')
          .delete()
          .eq('is_global', true)
          .eq('course_id', selectedCourseId);

        if (currentUser.isAdmin) {
          await supabase
            .from('questions')
            .delete()
            .eq('is_global', true)
            .eq('course_id', selectedCourseId);
        }

        setPageQuestions([]);
        setTotalCount(0);
        setPage(1);
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
        <div className="max-w-5xl mx-auto">
          <Breadcrumbs
            items={[
              { label: t('common.home'), to: '/' },
              { label: t('courses.title'), to: '/courses' },
              { label: t('questions.title') }
            ]}
          />
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold mb-2">{t('questions.title')}</h2>
              <p className="text-gray-600 dark:text-gray-400">{t('questions.subtitle')}</p>
            </div>
              <div className="mt-4 md:mt-0 flex flex-wrap gap-3">
                <Link
                  to={selectedCourseId ? `/import?courseId=${selectedCourseId}` : '/import'}
                  className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                >
                  <i className="fa-solid fa-file-import mr-1"></i> {t('questions.importButton')}
                </Link>
                <Link
                  to={selectedCourseId ? `/create-question?courseId=${selectedCourseId}` : '/create-question'}
                  className="px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                >
                  <i className="fa-solid fa-plus mr-1"></i> {t('questions.createButton')}
                </Link>
                {totalCount > 0 && (
                  <Link
                    to={selectedCourseId ? `/exam?courseId=${selectedCourseId}` : '/courses'}
                    className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                  >
                    <i className="fa-solid fa-pen-to-square mr-1"></i> {t('questions.startExamButton')}
                  </Link>
                )}
              </div>
          </div>

          {/* 课程选择 */}
          <div className="mb-8">
            <label htmlFor="course" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('questions.courseLabel')}
            </label>
            {isLoadingCourses ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</div>
            ) : courses.length === 0 ? (
              <div className="text-sm text-red-500 dark:text-red-400">
                {t('questions.noCourses')}{' '}
                <Link to="/courses" className="underline text-blue-600 dark:text-blue-400">
                  {t('questions.goCreateCourse')}
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
          
          {/* 搜索和统计区域：有课程时显示，便于搜索与查看总数 */}
          {courses.length > 0 && selectedCourseId && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-6 mb-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold mb-1">{t('questions.listTitle')}</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {t('questions.listStats', {
                      total: totalCount,
                      page: safePage,
                      totalPages,
                      showing: showingCount
                    })}
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
          {courses.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-12 text-center">
              <div className="text-6xl text-gray-300 dark:text-gray-600 mb-4">
                <i className="fa-solid fa-book-open"></i>
              </div>
              <h3 className="text-xl font-bold mb-2">{t('questions.noCoursesTitle')}</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {t('questions.noCoursesDesc')}
              </p>
              <Link
                to="/courses"
                className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                <i className="fa-solid fa-plus mr-2"></i>
                {t('questions.goCreateCourse')}
              </Link>
            </div>
          ) : totalCount > 0 || pageQuestions.length > 0 || isLoadingQuestions ? (
            <div className="space-y-6">
              {isLoadingQuestions ? (
                <div className="flex justify-center py-12">
                  <span className="text-gray-500 dark:text-gray-400">{t('common.loading')}</span>
                </div>
              ) : (
                <>
              {pageQuestions.map(question => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  showExplanation={true}
                  isEditable={true}
                  onDelete={() => handleDeleteQuestion(question.id)}
                />
              ))}
              {/* 分页控件 */}
              {totalPages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('questions.listStats', {
                      total: totalCount,
                      page: safePage,
                      totalPages,
                      showing: showingCount
                    })}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={safePage <= 1}
                      className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <i className="fa-solid fa-chevron-left mr-1"></i>
                      {t('questions.paginationPrev')}
                    </button>
                    <span className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                      {safePage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safePage >= totalPages}
                      className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {t('questions.paginationNext')}
                      <i className="fa-solid fa-chevron-right ml-1"></i>
                    </button>
                  </div>
                </div>
              )}
                </>
              )}
            </div>
          ) : !isLoadingQuestions && totalCount === 0 && !searchTerm.trim() ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-12 text-center">
              <div className="text-6xl text-gray-300 dark:text-gray-600 mb-4">
                <i className="fa-solid fa-book-open"></i>
              </div>
              <h3 className="text-xl font-bold mb-2">{t('questions.noQuestionsTitle')}</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {t('questions.noQuestionsDesc')}
              </p>
              <Link
                to={selectedCourseId ? `/import?courseId=${selectedCourseId}` : '/import'}
                className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                <i className="fa-solid fa-file-import mr-2"></i>
                {t('questions.importButton')}
              </Link>
            </div>
          ) : !isLoadingQuestions && totalCount === 0 && searchTerm.trim() ? (
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
          ) : null}
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