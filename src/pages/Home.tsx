import { useState, useEffect, useContext } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { Link } from 'react-router-dom';
import { AuthContext, type User } from '@/contexts/authContext';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { UserStats } from '@/types';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const { currentUser, logout, getAllUsers } = useContext(AuthContext);
  const { t } = useTranslation();
  const [showGlobalStats, setShowGlobalStats] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [userManagementUsers, setUserManagementUsers] = useState<User[]>([]);
  const [userManagementQuery, setUserManagementQuery] = useState('');
  const [userManagementLoading, setUserManagementLoading] = useState(false);
  const [userManagementEdits, setUserManagementEdits] = useState<
    Record<string, { firstName: string; lastName: string; isSaving: boolean; isEditing: boolean }>
  >({});
  const [userStats, setUserStats] = useState({
    totalExams: 0,
    averageScore: 0,
    highestScore: 0,
    lowestScore: 0
  });
  const [globalStats, setGlobalStats] = useState({
    totalUsers: 0,
    totalQuestions: 0,
    totalExams: 0,
    averageScore: 0,
    usersStats: [] as UserStats[]
  });
  const [chartData, setChartData] = useState<Array<{ index: number; score: number }>>([]);
  const normalizedUserQuery = userManagementQuery.trim().toLowerCase();
  const filteredUsers = userManagementUsers.filter((user) => {
    if (!normalizedUserQuery) return true;
    return (
      user.username?.toLowerCase().includes(normalizedUserQuery) ||
      user.firstName?.toLowerCase().includes(normalizedUserQuery) ||
      user.lastName?.toLowerCase().includes(normalizedUserQuery) ||
      user.id.toLowerCase().includes(normalizedUserQuery)
    );
  });
  
  // 加载用户统计数据
  useEffect(() => {
    const loadStats = async () => {
      if (currentUser) {
        loadUserStats();
        if (currentUser.isAdmin) {
          await loadGlobalStats();
        }
      }
    };

    loadStats();
  }, [currentUser, showGlobalStats]);

  useEffect(() => {
    if (!isUserManagementOpen || !currentUser?.isAdmin) return;

    let isMounted = true;
    setUserManagementLoading(true);

    getAllUsers()
      .then((users) => {
        if (isMounted) {
          setUserManagementUsers(users);
        }
      })
      .finally(() => {
        if (isMounted) {
          setUserManagementLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [currentUser?.isAdmin, getAllUsers, isUserManagementOpen]);

  useEffect(() => {
    if (!isUserManagementOpen) return;

    const nextEdits: Record<string, { firstName: string; lastName: string; isSaving: boolean; isEditing: boolean }> = {};
    userManagementUsers.forEach((user) => {
      nextEdits[user.id] = {
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        isSaving: false,
        isEditing: false
      };
    });
    setUserManagementEdits(nextEdits);
  }, [isUserManagementOpen, userManagementUsers]);

  const handleUserEditStart = (userId: string) => {
    const user = userManagementUsers.find((item) => item.id === userId);
    if (!user) return;
    setUserManagementEdits((prev) => ({
      ...prev,
      [userId]: {
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        isSaving: prev[userId]?.isSaving ?? false,
        isEditing: true
      }
    }));
  };

  const handleUserEditCancel = (userId: string) => {
    const user = userManagementUsers.find((item) => item.id === userId);
    if (!user) return;
    setUserManagementEdits((prev) => ({
      ...prev,
      [userId]: {
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        isSaving: false,
        isEditing: false
      }
    }));
  };

  const handleUserEditChange = (userId: string, field: 'firstName' | 'lastName', value: string) => {
    setUserManagementEdits((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [field]: value
      }
    }));
  };

  const handleUserManagementSave = async (userId: string) => {
    const edit = userManagementEdits[userId];
    if (!edit) return;

    const trimmedFirstName = edit.firstName.trim();
    const trimmedLastName = edit.lastName.trim();

    if (!trimmedFirstName || !trimmedLastName) {
      toast.error(t('home.userManagement.nameRequired'));
      return;
    }

    setUserManagementEdits((prev) => ({
      ...prev,
      [userId]: { ...edit, isSaving: true }
    }));

    const { error } = await supabase
      .from('profiles')
      .update({ first_name: trimmedFirstName, last_name: trimmedLastName })
      .eq('id', userId);

    if (error) {
      setUserManagementEdits((prev) => ({
        ...prev,
        [userId]: { ...edit, isSaving: false }
      }));
      toast.error(t('home.userManagement.updateFail'));
      return;
    }

    setUserManagementUsers((prev) =>
      prev.map((user) =>
        user.id === userId
          ? { ...user, firstName: trimmedFirstName, lastName: trimmedLastName }
          : user
      )
    );
    setUserManagementEdits((prev) => ({
      ...prev,
      [userId]: { ...edit, isSaving: false, isEditing: false }
    }));
    toast.success(t('home.userManagement.updateSuccess'));
  };

  const closeUserManagement = () => {
    setIsUserManagementOpen(false);
  };

  const formatUserDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleDateString();
  };
  
  // 加载用户统计数据
  const loadUserStats = () => {
    if (!currentUser) return;

    const load = async () => {
      const { data, error } = await supabase
        .from('exam_sessions')
        .select('score, created_at')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: true });

      if (error || !data) {
        return;
      }

      if (data.length > 0) {
        const scores = data.map((exam: any) => exam.score ?? 0);
        const totalScore = scores.reduce((sum: number, score: number) => sum + score, 0);

        setUserStats({
          totalExams: data.length,
          averageScore: Math.round(totalScore / scores.length),
          highestScore: Math.max(...scores),
          lowestScore: Math.min(...scores)
        });

        const chartData = data.slice(-5).map((exam: any, index: number) => ({
          index: index + 1,
          score: exam.score ?? 0
        }));
        setChartData(chartData);
      }
    };

    load();
  };
  
  // 加载全局统计数据
  const loadGlobalStats = async () => {
    const allUsers = await getAllUsers();

    let totalQuestions = 0;
    if (currentUser?.id) {
      const { count: userQuestionCount } = await supabase
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', currentUser.id);

      if (userQuestionCount && userQuestionCount > 0) {
        totalQuestions = userQuestionCount;
      } else {
        const { count: globalQuestionCount } = await supabase
          .from('questions')
          .select('id', { count: 'exact', head: true })
          .eq('is_global', true);
        totalQuestions = globalQuestionCount ?? 0;
      }
    }

    const { data: globalExamHistory } = await supabase
      .from('exam_sessions')
      .select('user_id, score');

    const allExams = globalExamHistory ?? [];

    const usersStats: UserStats[] = [];
    allUsers.forEach((user: any) => {
      const userExams = allExams.filter((exam: any) => exam.user_id === user.id);
      if (userExams.length > 0) {
        const scores = userExams.map((exam: any) => exam.score ?? 0);
        const totalScore = scores.reduce((sum: number, score: number) => sum + score, 0);

        usersStats.push({
          userId: user.id,
          username: user.username,
          totalExams: userExams.length,
          averageScore: Math.round(totalScore / scores.length),
          highestScore: Math.max(...scores),
          lowestScore: Math.min(...scores)
        });
      }
    });

    let globalAverageScore = 0;
    if (allExams.length > 0) {
      const totalGlobalScore = allExams.reduce((sum: number, exam: any) => sum + (exam.score || 0), 0);
      globalAverageScore = Math.round(totalGlobalScore / allExams.length);
    }

    setGlobalStats({
      totalUsers: allUsers.length,
      totalQuestions,
      totalExams: allExams.length,
      averageScore: globalAverageScore,
      usersStats
    });

  };
  
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#a4de6c'];
  const scoreLabel = t('home.charts.scoreLabel');
  const averageLabel = t('home.charts.averageLabel');
  const chartDataWithLabels = chartData.map((item) => ({
    ...item,
    name: t('home.charts.examLabel', { index: item.index })
  }));
  const globalChartData = globalStats.usersStats.slice(0, 8).map((user) => ({
    name: user.username.length > 6 ? `${user.username.substring(0, 6)}...` : user.username,
    average: user.averageScore
  }));
  
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-6xl text-blue-500 mb-6">
              <i className="fa-solid fa-graduation-cap"></i>
            </div>
            <h2 className="text-3xl font-bold mb-4">{t('home.guestTitle')}</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              {t('home.guestDesc')}
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link
                to="/login"
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
              >
                <i className="fa-solid fa-sign-in-alt mr-2"></i>
                {t('auth.login.submit')}
              </Link>
              <Link
                to="/register"
                className="px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium rounded-xl transition-colors"
              >
                <i className="fa-solid fa-user-plus mr-2"></i>
                {t('auth.register.submit')}
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }
  
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
            {/* 管理员才显示全局统计切换 */}
            {currentUser.isAdmin && (
              <button
                onClick={() => setShowGlobalStats(!showGlobalStats)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  showGlobalStats
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                {showGlobalStats ? t('home.showPersonal') : t('home.showGlobal')}
              </button>
            )}
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen((open) => !open)}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                aria-haspopup="menu"
                aria-expanded={isUserMenuOpen}
              >
                <i className="fa-solid fa-user"></i>
                <span>{currentUser.firstName} {currentUser.lastName}</span>
                {currentUser.isAdmin && (
                  <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
                    {t('common.admin')}
                  </span>
                )}
              </button>
              {isUserMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg overflow-hidden z-50"
                  role="menu"
                >
                  {currentUser.isAdmin && (
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setIsUserManagementOpen(true);
                      }}
                      className="w-full flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      role="menuitem"
                    >
                      <i className="fa-solid fa-users mr-2"></i>
                      {t('common.userManagement')}
                    </button>
                  )}
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
            <LanguageSwitcher className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 transition-colors text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600" />
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

      {isUserManagementOpen && currentUser.isAdmin && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onClick={closeUserManagement}
          role="dialog"
          aria-modal="true"
          aria-label={t('common.userManagement')}
        >
          <div
            className="w-full max-w-4xl rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">{t('home.userManagement.title')}</h2>
              <button
                onClick={closeUserManagement}
                className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                aria-label={t('common.close')}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="relative w-full sm:max-w-sm">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                <input
                  value={userManagementQuery}
                  onChange={(event) => setUserManagementQuery(event.target.value)}
                  placeholder={t('home.userManagement.searchPlaceholder')}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {t('home.userManagement.totalUsers')}: {filteredUsers.length}
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-12 bg-gray-50 dark:bg-gray-800 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <div className="col-span-3 px-4 py-2">{t('home.userManagement.firstName')}</div>
                <div className="col-span-3 px-4 py-2">{t('home.userManagement.lastName')}</div>
                <div className="col-span-2 px-4 py-2">{t('home.userManagement.username')}</div>
                <div className="col-span-2 px-4 py-2">{t('home.userManagement.role')}</div>
                <div className="col-span-2 px-4 py-2">{t('home.userManagement.actions')}</div>
              </div>
              <div className="max-h-80 overflow-y-auto bg-white dark:bg-gray-900">
                {userManagementLoading ? (
                  <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
                    {t('common.loading')}
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
                    {t('home.userManagement.empty')}
                  </div>
                ) : (
                  filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="grid grid-cols-12 items-center px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-sm"
                    >
                      <div className="col-span-3">
                        {userManagementEdits[user.id]?.isEditing ? (
                          <input
                            value={userManagementEdits[user.id]?.firstName ?? user.firstName ?? ''}
                            onChange={(event) => handleUserEditChange(user.id, 'firstName', event.target.value)}
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleUserEditStart(user.id)}
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {(user.firstName || '').trim() || '-'}
                          </button>
                        )}
                      </div>
                      <div className="col-span-3">
                        {userManagementEdits[user.id]?.isEditing ? (
                          <input
                            value={userManagementEdits[user.id]?.lastName ?? user.lastName ?? ''}
                            onChange={(event) => handleUserEditChange(user.id, 'lastName', event.target.value)}
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleUserEditStart(user.id)}
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {(user.lastName || '').trim() || '-'}
                          </button>
                        )}
                      </div>
                      <div className="col-span-2">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {user.username || user.id}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
                            user.isAdmin
                              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                          }`}
                        >
                          {user.isAdmin ? t('common.admin') : t('common.user')}
                        </span>
                      </div>
                      <div className="col-span-2 flex flex-col items-start gap-1 text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-2">
                          {userManagementEdits[user.id]?.isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleUserManagementSave(user.id)}
                                className="inline-flex items-center justify-center rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={
                                  userManagementEdits[user.id]?.isSaving ||
                                  ((userManagementEdits[user.id]?.firstName ?? user.firstName ?? '').trim() ===
                                    (user.firstName ?? '').trim() &&
                                    (userManagementEdits[user.id]?.lastName ?? user.lastName ?? '').trim() ===
                                      (user.lastName ?? '').trim())
                                }
                              >
                                {userManagementEdits[user.id]?.isSaving
                                  ? t('home.userManagement.saving')
                                  : t('home.userManagement.save')}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUserEditCancel(user.id)}
                                className="inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              >
                                {t('home.userManagement.cancel')}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleUserEditStart(user.id)}
                              className="inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              aria-label={t('home.userManagement.edit')}
                            >
                              <i className="fa-solid fa-pen"></i>
                            </button>
                          )}
                        </div>
                        <span className="text-xs">{formatUserDate(user.createdAt)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 主要内容 */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          {/* 欢迎信息 */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
            <div>
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <h2 className="text-3xl font-bold mb-2">
                  {showGlobalStats && currentUser.isAdmin
                    ? t('home.globalStatsTitle')
                    : <>
                        {t('home.welcomeBack')}
                        {currentUser.firstName} {currentUser.lastName}
                      </>
                  }
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  {showGlobalStats && currentUser.isAdmin 
                    ? t('home.globalStatsDesc') 
                    : t('home.personalStatsDesc')}
                </p>
              </motion.div>
            </div>
            <div className="mt-4 md:mt-0">
              <div className="flex flex-wrap gap-3">
                {currentUser.isAdmin && (
                  <>
                    <Link
                      to="/import"
                      className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                    >
                      <i className="fa-solid fa-file-import mr-1"></i> {t('home.actions.import')}
                    </Link>
                    <Link
                      to="/create-question"
                      className="px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                    >
                      <i className="fa-solid fa-plus mr-1"></i> {t('home.actions.create')}
                    </Link>
                  </>
                )}
                <Link
                  to="/courses"
                  className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                >
                  <i className="fa-solid fa-pen-to-square mr-1"></i> {t('home.actions.startExam')}
                </Link>
              </div>
            </div>
          </div>
          
          {showGlobalStats && currentUser.isAdmin ? (
            // 全局统计视图
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300">{t('home.stats.totalUsers')}</h3>
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400">
                    <i className="fa-solid fa-users"></i>
                  </div>
                </div>
                <div className="text-4xl font-bold text-gray-900 dark:text-white">
                  {globalStats.totalUsers}
                </div>
                <div className="mt-2 text-sm text-green-600 dark:text-green-400 flex items-center">
                  <i className="fa-solid fa-arrow-up mr-1"></i>
                  <span>{t('home.stats.totalUsersDesc')}</span>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300">{t('home.stats.totalQuestions')}</h3>
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-full text-purple-600 dark:text-purple-400">
                    <i className="fa-solid fa-file-lines"></i>
                  </div>
                </div>
                <div className="text-4xl font-bold text-gray-900 dark:text-white">
                  {globalStats.totalQuestions}
                </div>
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {t('home.stats.totalQuestionsDesc')}
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300">{t('home.stats.totalExams')}</h3>
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full text-green-600 dark:text-green-400">
                    <i className="fa-solid fa-pen-to-square"></i>
                  </div>
                </div>
                <div className="text-4xl font-bold text-gray-900 dark:text-white">
                  {globalStats.totalExams}
                </div>
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {t('home.stats.totalExamsDesc')}
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300">{t('home.stats.averageScore')}</h3>
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-full text-orange-600 dark:text-orange-400">
                    <i className="fa-solid fa-star"></i>
                  </div>
                </div>
                <div className="text-4xl font-bold text-gray-900 dark:text-white">
                  {globalStats.averageScore}%
                </div>
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {t('home.stats.averageScoreDesc')}
                </div>
              </motion.div>
            </div>
          ) : (
            // 个人统计视图
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300">{t('home.stats.userExams')}</h3>
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400">
                    <i className="fa-solid fa-pen-to-square"></i>
                  </div>
                </div>
                <div className="text-4xl font-bold text-gray-900 dark:text-white">
                  {userStats.totalExams}
                </div>
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {t('home.stats.userExamsDesc')}
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300">{t('home.stats.userAverage')}</h3>
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full text-green-600 dark:text-green-400">
                    <i className="fa-solid fa-star"></i>
                  </div>
                </div>
                <div className="text-4xl font-bold text-gray-900 dark:text-white">
                  {userStats.averageScore}%
                </div>
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {t('home.stats.userAverageDesc')}
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300">{t('home.stats.userHighest')}</h3>
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-full text-purple-600 dark:text-purple-400">
                    <i className="fa-solid fa-trophy"></i>
                  </div>
                </div>
                <div className="text-4xl font-bold text-gray-900 dark:text-white">
                  {userStats.highestScore}%
                </div>
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {t('home.stats.userHighestDesc')}
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300">{t('home.stats.userLowest')}</h3>
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-full text-orange-600 dark:text-orange-400">
                    <i className="fa-solid fa-chart-line"></i>
                  </div>
                </div>
                <div className="text-4xl font-bold text-gray-900 dark:text-white">
                  {userStats.lowestScore}%
                </div>
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {t('home.stats.userLowestDesc')}
                </div>
              </motion.div>
            </div>
          )}
          
          {/* 统计图表 */}
          {showGlobalStats && currentUser.isAdmin ? (
            // 全局统计图表
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-6 mb-8"
            >
              <h3 className="text-xl font-bold mb-6">{t('home.charts.globalUsersAvg')}</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={globalChartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: theme === 'dark' ? '#1f2937' : 'white',
                        borderColor: theme === 'dark' ? '#374151' : '#e5e7eb',
                        color: theme === 'dark' ? 'white' : 'black'
                      }} 
                    />
                    <Bar dataKey="average" name={averageLabel}>
                      {globalChartData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          ) : (
            // 个人统计图表
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-6 mb-8"
            >
              <h3 className="text-xl font-bold mb-6">{t('home.charts.personalTrend')}</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartDataWithLabels}
                    margin={{ top: 20, right: 30, left: 20, bottom: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: theme === 'dark' ? '#1f2937' : 'white',
                        borderColor: theme === 'dark' ? '#374151' : '#e5e7eb',
                        color: theme === 'dark' ? 'white' : 'black'
                      }} 
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      name={scoreLabel}
                      stroke="#3b82f6"
                      strokeWidth={3}
                      dot={{ r: 6 }}
                      activeDot={{ r: 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}
          
          {/* 快速操作卡片 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
          >
            {currentUser.isAdmin && (
              <>
                <Link
                  to="/import"
                  className="block bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-2xl shadow-md border border-blue-200 dark:border-blue-800 p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="text-3xl text-blue-600 dark:text-blue-400 mb-4">
                    <i className="fa-solid fa-file-import"></i>
                  </div>
                  <h3 className="text-xl font-bold mb-2">{t('home.quick.importTitle')}</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {t('home.quick.importDesc')}
                  </p>
                </Link>

                <Link
                  to="/questions"
                  className="block bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-2xl shadow-md border border-purple-200 dark:border-purple-800 p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="text-3xl text-purple-600 dark:text-purple-400 mb-4">
                    <i className="fa-solid fa-book"></i>
                  </div>
                  <h3 className="text-xl font-bold mb-2">{t('home.quick.myQuestionsTitle')}</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {t('home.quick.myQuestionsDesc')}
                  </p>
                </Link>
              </>
            )}

            <Link
              to="/courses"
              className="block bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-2xl shadow-md border border-green-200 dark:border-green-800 p-6 hover:shadow-lg transition-shadow"
            >
              <div className="text-3xl text-green-600 dark:text-green-400 mb-4">
                <i className="fa-solid fa-pen-to-square"></i>
              </div>
              <h3 className="text-xl font-bold mb-2">{t('home.quick.startExamTitle')}</h3>
              <p className="text-gray-600 dark:text-gray-400">
                {t('home.quick.startExamDesc')}
              </p>
            </Link>
          </motion.div>
          
          {/* 管理员统计卡片 */}
          {currentUser.isAdmin && !showGlobalStats && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-700/50 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 p-6"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold mb-2">{t('home.adminCard.title')}</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {t('home.adminCard.desc')}
                  </p>
                  <button
                    onClick={() => setShowGlobalStats(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    <i className="fa-solid fa-chart-pie mr-2"></i>
                    {t('home.adminCard.action')}
                  </button>
                </div>
                <div className="text-5xl text-gray-400">
                  <i className="fa-solid fa-user-shield"></i>
                </div>
              </div>
            </motion.div>
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