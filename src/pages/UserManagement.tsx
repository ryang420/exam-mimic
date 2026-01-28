import { useState, useEffect, useContext } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { Link } from 'react-router-dom';
import { AuthContext, type User, type UserRole } from '@/contexts/authContext';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Breadcrumbs } from '@/components/Breadcrumbs';

export default function UserManagement() {
  const { theme, toggleTheme } = useTheme();
  const { currentUser, logout, getAllUsers } = useContext(AuthContext);
  const { t } = useTranslation();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [edits, setEdits] = useState<
    Record<string, { firstName: string; lastName: string; role: UserRole; isSaving: boolean; isEditing: boolean }>
  >({});

  const PAGE_SIZE = 20;
  const normalizedQuery = query.trim().toLowerCase();
  const filteredUsers = users.filter((user) => {
    if (!normalizedQuery) return true;
    return (
      user.username?.toLowerCase().includes(normalizedQuery) ||
      user.firstName?.toLowerCase().includes(normalizedQuery) ||
      user.lastName?.toLowerCase().includes(normalizedQuery) ||
      user.id.toLowerCase().includes(normalizedQuery)
    );
  });

  const totalFiltered = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageUsers = filteredUsers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const from = totalFiltered === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const to = Math.min(safePage * PAGE_SIZE, totalFiltered);

  const getRoleLabel = (user: User) =>
    user.isAdmin ? t('common.admin') : user.isAuthor ? t('common.author') : t('common.user');
  const getRoleBadgeClasses = (user: User) =>
    user.isAdmin
      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300'
      : user.isAuthor
        ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300'
        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300';

  useEffect(() => {
    if (!currentUser?.isAdmin) return;

    let isMounted = true;
    setLoading(true);

    getAllUsers()
      .then((list) => {
        if (isMounted) setUsers(list);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentUser?.isAdmin, getAllUsers]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    if (page > totalPages && totalPages >= 1) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    const nextEdits: Record<string, { firstName: string; lastName: string; role: UserRole; isSaving: boolean; isEditing: boolean }> = {};
    users.forEach((user) => {
      nextEdits[user.id] = {
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        role: user.role,
        isSaving: false,
        isEditing: false
      };
    });
    setEdits(nextEdits);
  }, [users]);

  const handleEditStart = (userId: string) => {
    const user = users.find((item) => item.id === userId);
    if (!user) return;
    setEdits((prev) => ({
      ...prev,
      [userId]: {
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        role: user.role,
        isSaving: prev[userId]?.isSaving ?? false,
        isEditing: true
      }
    }));
  };

  const handleEditCancel = (userId: string) => {
    const user = users.find((item) => item.id === userId);
    if (!user) return;
    setEdits((prev) => ({
      ...prev,
      [userId]: {
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        role: user.role,
        isSaving: false,
        isEditing: false
      }
    }));
  };

  const handleEditChange = (userId: string, field: 'firstName' | 'lastName', value: string) => {
    setEdits((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [field]: value
      }
    }));
  };

  const handleRoleChange = (userId: string, role: UserRole) => {
    setEdits((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        role
      }
    }));
  };

  const handleSave = async (userId: string) => {
    const edit = edits[userId];
    if (!edit) return;
    const user = users.find((item) => item.id === userId);
    if (!user) return;

    const trimmedFirstName = edit.firstName.trim();
    const trimmedLastName = edit.lastName.trim();
    const nextRole = user.isAdmin ? user.role : (edit.role === 'author' ? 'author' : 'user');

    if (!trimmedFirstName || !trimmedLastName) {
      toast.error(t('home.userManagement.nameRequired'));
      return;
    }

    setEdits((prev) => ({
      ...prev,
      [userId]: { ...edit, isSaving: true }
    }));

    const updatePayload: { first_name: string; last_name: string; role?: UserRole } = {
      first_name: trimmedFirstName,
      last_name: trimmedLastName
    };
    if (!user.isAdmin && nextRole !== user.role) {
      updatePayload.role = nextRole;
    }

    const { error } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', userId);

    if (error) {
      setEdits((prev) => ({
        ...prev,
        [userId]: { ...edit, isSaving: false }
      }));
      toast.error(t('home.userManagement.updateFail'));
      return;
    }

    setUsers((prev) =>
      prev.map((item) =>
        item.id === userId
          ? {
              ...item,
              firstName: trimmedFirstName,
              lastName: trimmedLastName,
              role: item.isAdmin ? item.role : nextRole,
              isAuthor: !item.isAdmin && nextRole === 'author'
            }
          : item
      )
    );
    setEdits((prev) => ({
      ...prev,
      [userId]: { ...edit, role: nextRole, isSaving: false, isEditing: false }
    }));
    toast.success(t('home.userManagement.updateSuccess'));
  };

  const formatUserDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString();
  };

  if (!currentUser?.isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300">
      <nav className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            <i className="fa-solid fa-graduation-cap mr-2"></i>
            {t('common.appName')}
          </Link>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen((open) => !open)}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                aria-haspopup="menu"
                aria-expanded={isUserMenuOpen}
              >
                <i className="fa-solid fa-user"></i>
                <span>{currentUser.firstName} {currentUser.lastName}</span>
                <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
                  {t('common.admin')}
                </span>
              </button>
              {isUserMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg overflow-hidden z-50"
                  role="menu"
                >
                  <Link
                    to="/users"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="block w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    role="menuitem"
                  >
                    <i className="fa-solid fa-users mr-2"></i>
                    {t('common.userManagement')}
                  </Link>
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

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto">
          <Breadcrumbs
            items={[
              { label: t('common.home'), to: '/' },
              { label: t('common.userManagement') }
            ]}
          />
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">{t('home.userManagement.title')}</h2>
            <p className="text-gray-600 dark:text-gray-400">
              {t('home.userManagement.subtitle')}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div className="relative w-full sm:max-w-sm">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('home.userManagement.searchPlaceholder')}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {totalPages > 1
                ? t('home.userManagement.showingRange', { from, to, total: totalFiltered })
                : t('home.userManagement.totalUsers') + ': ' + totalFiltered}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="grid grid-cols-12 bg-gray-50 dark:bg-gray-800 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <div className="col-span-2 px-4 py-2">{t('home.userManagement.firstName')}</div>
              <div className="col-span-2 px-4 py-2">{t('home.userManagement.lastName')}</div>
              <div className="col-span-3 px-4 py-2">{t('home.userManagement.username')}</div>
              <div className="col-span-2 px-4 py-2">{t('home.userManagement.role')}</div>
              <div className="col-span-1 px-4 py-2">{t('home.userManagement.createdAt')}</div>
              <div className="col-span-2 px-4 py-2">{t('home.userManagement.actions')}</div>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {loading ? (
                <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
                  {t('common.loading')}
                </div>
              ) : pageUsers.length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
                  {t('home.userManagement.empty')}
                </div>
              ) : (
                pageUsers.map((user) => {
                  const edit = edits[user.id];
                  const isEditing = edit?.isEditing;
                  const firstNameValue = (edit?.firstName ?? user.firstName ?? '').trim();
                  const lastNameValue = (edit?.lastName ?? user.lastName ?? '').trim();
                  const roleValue = edit?.role ?? user.role;
                  const hasNameChange =
                    firstNameValue !== (user.firstName ?? '').trim() ||
                    lastNameValue !== (user.lastName ?? '').trim();
                  const hasRoleChange = !user.isAdmin && roleValue !== user.role;
                  const saveDisabled = edit?.isSaving || (!hasNameChange && !hasRoleChange);

                  return (
                    <div
                      key={user.id}
                      className="grid grid-cols-12 items-center px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-sm"
                    >
                      <div className="col-span-2">
                        {isEditing ? (
                          <input
                            value={edit?.firstName ?? user.firstName ?? ''}
                            onChange={(e) => handleEditChange(user.id, 'firstName', e.target.value)}
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleEditStart(user.id)}
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {(user.firstName || '').trim() || '-'}
                          </button>
                        )}
                      </div>
                      <div className="col-span-2">
                        {isEditing ? (
                          <input
                            value={edit?.lastName ?? user.lastName ?? ''}
                            onChange={(e) => handleEditChange(user.id, 'lastName', e.target.value)}
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleEditStart(user.id)}
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {(user.lastName || '').trim() || '-'}
                          </button>
                        )}
                      </div>
                      <div className="col-span-3">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {user.username || user.id}
                        </div>
                      </div>
                      <div className="col-span-2">
                        {isEditing && !user.isAdmin ? (
                          <select
                            value={roleValue === 'author' ? 'author' : 'user'}
                            onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="user">{t('common.user')}</option>
                            <option value="author">{t('common.author')}</option>
                          </select>
                        ) : (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${getRoleBadgeClasses(user)}`}>
                            {getRoleLabel(user)}
                          </span>
                        )}
                      </div>
                      <div className="col-span-1 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {formatUserDate(user.createdAt)}
                      </div>
                      <div className="col-span-2 flex flex-col items-center gap-1 text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-2">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSave(user.id)}
                                className="inline-flex items-center justify-center rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={saveDisabled}
                              >
                                {edit?.isSaving
                                  ? t('home.userManagement.saving')
                                  : t('home.userManagement.save')}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditCancel(user.id)}
                                className="inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              >
                                {t('home.userManagement.cancel')}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleEditStart(user.id)}
                              className="inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              aria-label={t('home.userManagement.edit')}
                            >
                              <i className="fa-solid fa-pen"></i>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {!loading && totalFiltered > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('home.userManagement.listStats', {
                  total: totalFiltered,
                  page: safePage,
                  totalPages,
                  showing: pageUsers.length
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
                  {t('home.userManagement.paginationPrev')}
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
                  {t('home.userManagement.paginationNext')}
                  <i className="fa-solid fa-chevron-right ml-1"></i>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
