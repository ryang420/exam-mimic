import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AuthContext } from '@/contexts/authContext';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/useTheme';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Breadcrumbs } from '@/components/Breadcrumbs';

type HistoryRow = {
  id: string;
  score: number | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string | null;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const formatDuration = (start?: string | null, end?: string | null) => {
  if (!start || !end) return '--';
  const startDate = new Date(start);
  const endDate = new Date(end);
  const durationMs = endDate.getTime() - startDate.getTime();
  if (Number.isNaN(durationMs) || durationMs < 0) return '--';
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export default function TestHistory() {
  const { theme, toggleTheme } = useTheme();
  const { currentUser, logout } = useContext(AuthContext);
  const { t } = useTranslation();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  useEffect(() => {
    setPage(1);
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) {
      setHistoryRows([]);
      setTotalCount(0);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const loadHistory = async () => {
      setIsLoading(true);
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data, error, count } = await supabase
        .from('exam_sessions')
        .select('id, score, started_at, ended_at, created_at', { count: 'exact' })
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (!isMounted) return;

      if (error) {
        console.error(t('history.toastLoadFail'), error);
        toast.error(t('history.toastLoadFail'));
        setHistoryRows([]);
        setTotalCount(0);
        setIsLoading(false);
        return;
      }

      const nextTotal = count ?? 0;
      const nextTotalPages = Math.max(1, Math.ceil(nextTotal / pageSize));
      if (page > nextTotalPages && nextTotalPages > 0) {
        setTotalCount(nextTotal);
        setPage(nextTotalPages);
        return;
      }

      const mapped = (data ?? []).map((row) => ({
        id: row.id,
        score: row.score ?? null,
        startedAt: row.started_at ?? null,
        endedAt: row.ended_at ?? null,
        createdAt: row.created_at ?? null
      }));

      setHistoryRows(mapped);
      setTotalCount(nextTotal);
      setIsLoading(false);
    };

    loadHistory();

    return () => {
      isMounted = false;
    };
  }, [currentUser?.id, page, t]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300">
      <nav className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            <i className="fa-solid fa-graduation-cap mr-2"></i>
            {t('common.appName')}
          </h1>
          <div className="flex items-center space-x-4">
            <LanguageSwitcher />
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

      <main className="container mx-auto px-4 py-12">
        <Breadcrumbs
          items={[
            { label: t('common.home'), to: '/' },
            { label: t('history.title') }
          ]}
        />
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold mb-2">{t('history.title')}</h2>
            <p className="text-gray-600 dark:text-gray-400">{t('history.subtitle')}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : historyRows.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-10 text-center">
            <h3 className="text-xl font-semibold mb-2">{t('history.emptyTitle')}</h3>
            <p className="text-gray-600 dark:text-gray-400">{t('history.emptyDesc')}</p>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {historyRows.map((row, index) => (
                <motion.div
                  key={row.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{t('history.grid.id')}</p>
                      <Link
                        to="/results"
                        state={{ sessionId: row.id }}
                        className="text-lg font-semibold text-blue-600 dark:text-blue-400 hover:underline break-all"
                        aria-label={`${t('history.grid.openResults')}: ${row.id}`}
                      >
                        {row.id}
                      </Link>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500 dark:text-gray-400">{t('history.grid.score')}</p>
                      <p className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">
                        {row.score ?? '--'}%
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-300">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t('history.grid.started')}</p>
                      <p className="font-medium">{formatDateTime(row.startedAt || row.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t('history.grid.ended')}</p>
                      <p className="font-medium">{formatDateTime(row.endedAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t('history.grid.duration')}</p>
                      <p className="font-medium">{formatDuration(row.startedAt, row.endedAt)}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="flex items-center justify-center mt-10 gap-4">
              <button
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="px-4 py-2 rounded-full border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={page <= 1 || isLoading}
              >
                {t('history.pagination.prev')}
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t('history.pagination.page', { page, total: totalPages })}
              </span>
              <button
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                className="px-4 py-2 rounded-full border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={page >= totalPages || isLoading}
              >
                {t('history.pagination.next')}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
