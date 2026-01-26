import { useContext, useEffect, useState } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { Link } from 'react-router-dom';
import { AuthContext } from '@/contexts/authContext';
import { supabase } from '@/lib/supabase';
import { Course } from '@/types';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function Courses() {
  const { theme, toggleTheme } = useTheme();
  const { currentUser } = useContext(AuthContext);
  const { t } = useTranslation();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadCourses = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('courses')
      .select('id, title, description, duration_minutes, created_at, created_by')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('加载课程失败:', error);
      toast.error(t('courses.toastLoadFail'));
      setIsLoading(false);
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
    setIsLoading(false);
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setDurationMinutes(60);
  };

  const handleCreateCourse = async () => {
    if (!currentUser?.id) {
      toast.error(t('courses.toastLoginFirst'));
      return;
    }

    if (!title.trim()) {
      toast.error(t('courses.toastMissingTitle'));
      return;
    }

    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      toast.error(t('courses.toastInvalidDuration'));
      return;
    }

    setIsSubmitting(true);

    const newCourse = {
      id: `course-${Date.now()}`,
      title: title.trim(),
      description: description.trim() || null,
      duration_minutes: durationMinutes,
      created_by: currentUser.id
    };

    const { error } = await supabase.from('courses').insert(newCourse);
    if (error) {
      console.error('创建课程失败:', error);
      toast.error(t('courses.toastCreateFail'));
      setIsSubmitting(false);
      return;
    }

    toast.success(t('courses.toastCreated'));
    resetForm();
    loadCourses();
    setIsSubmitting(false);
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
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold mb-2">{t('courses.title')}</h2>
              <p className="text-gray-600 dark:text-gray-400">{t('courses.subtitle')}</p>
            </div>
            <div className="mt-4 md:mt-0 flex flex-wrap gap-3">
              {currentUser?.isAdmin && (
                <Link
                  to="/questions"
                  className="px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                >
                  <i className="fa-solid fa-book mr-1"></i> {t('courses.manageQuestions')}
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

          {currentUser?.isAdmin && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-6 mb-8"
            >
              <h3 className="text-xl font-bold mb-4">{t('courses.createTitle')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('courses.form.title')}
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder={t('courses.form.titlePlaceholder')}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('courses.form.duration')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={durationMinutes}
                    onChange={(event) => setDurationMinutes(Number(event.target.value))}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('courses.form.description')}
                </label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={t('courses.form.descriptionPlaceholder')}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent h-28 resize-y"
                ></textarea>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleCreateCourse}
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
                >
                  {isSubmitting ? t('courses.form.saving') : t('courses.form.create')}
                </button>
              </div>
            </motion.div>
          )}

          {isLoading ? (
            <div className="text-center text-gray-500 dark:text-gray-400">{t('common.loading')}</div>
          ) : courses.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-12 text-center">
              <div className="text-6xl text-gray-300 dark:text-gray-600 mb-4">
                <i className="fa-solid fa-book-open"></i>
              </div>
              <h3 className="text-xl font-bold mb-2">{t('courses.emptyTitle')}</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {currentUser?.isAdmin ? t('courses.emptyAdminDesc') : t('courses.emptyUserDesc')}
              </p>
              {currentUser?.isAdmin && (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {t('courses.emptyAdminHint')}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {courses.map((course) => (
                <motion.div
                  key={course.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-6 flex flex-col"
                >
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-2">{course.title}</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4 whitespace-pre-line">
                      {course.description || t('courses.noDescription')}
                    </p>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      <i className="fa-solid fa-clock mr-2"></i>
                      {t('courses.duration', { minutes: course.durationMinutes })}
                    </div>
                  </div>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link
                      to={`/exam?courseId=${course.id}`}
                      className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                    >
                      <i className="fa-solid fa-pen-to-square mr-1"></i> {t('courses.startExam')}
                    </Link>
                    {currentUser?.isAdmin && (
                      <Link
                        to={`/create-question?courseId=${course.id}`}
                        className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                      >
                        <i className="fa-solid fa-plus mr-1"></i> {t('courses.addQuestion')}
                      </Link>
                    )}
                  </div>
                </motion.div>
              ))}
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
