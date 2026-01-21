import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { AuthContext, User } from './contexts/authContext';
import { supabase } from './lib/supabase';

// 页面组件
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Import from './pages/Import';
import Questions from './pages/Questions';
import CreateQuestion from './pages/CreateQuestion';
import Exam from './pages/Exam';
import Results from './pages/Results';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useTheme } from './hooks/useTheme';

type ProfileRow = {
  id: string;
  username: string | null;
  is_admin: boolean | null;
  created_at: string | null;
  theme?: string | null;
  migration_completed?: boolean | null;
};

const buildUser = (authUser: any, profile?: ProfileRow | null): User => {
  const email = authUser?.email ?? '';
  const usernameFromEmail = email.includes('@') ? email.split('@')[0] : email;
  return {
    id: authUser?.id ?? '',
    email,
    username: profile?.username?.trim() || authUser?.user_metadata?.username || usernameFromEmail || '用户',
    isAdmin: profile?.is_admin ?? false,
    createdAt: profile?.created_at ?? authUser?.created_at ?? new Date().toISOString()
  };
};

const fetchProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, is_admin, created_at, theme, migration_completed')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data as ProfileRow | null;
};

const ensureProfile = async (authUser: any) => {
  if (!authUser?.id) {
    return null;
  }

  let profile = await fetchProfile(authUser.id);
  if (profile) {
    return profile;
  }

  const email = authUser?.email ?? '';
  const username = email.includes('@') ? email.split('@')[0] : email;

  await supabase.from('profiles').upsert(
    {
      id: authUser.id,
      username,
      is_admin: false
    },
    { onConflict: 'id' }
  );

  profile = await fetchProfile(authUser.id);
  return profile;
};

const migrateLocalStorageData = async (user: User, profile?: ProfileRow | null) => {
  if (!user.id) {
    return;
  }

  if (profile?.migration_completed) {
    return;
  }

  const userId = user.id;
  const username = user.username || (user.email ? user.email.split('@')[0] : '用户');

  const theme = localStorage.getItem('theme');
  if (theme && theme !== profile?.theme) {
    await supabase.from('profiles').update({ theme }).eq('id', userId);
  }

  const savedQuestions = localStorage.getItem(`questions_${userId}`);
  if (savedQuestions) {
    try {
      const parsedQuestions = JSON.parse(savedQuestions);
      if (Array.isArray(parsedQuestions) && parsedQuestions.length > 0) {
        const questionRows = parsedQuestions.map((question: any) => ({
          id: question.id,
          owner_id: userId,
          number: question.number,
          question: question.question,
          options: question.options,
          correct_answer: question.correctAnswer,
          explanation: question.explanation,
          is_multiple_choice: question.isMultipleChoice ?? question.correctAnswer?.length > 1,
          created_at: question.createdAt,
          created_by: question.createdBy ?? username,
          is_global: user.isAdmin ? true : false
        }));

        await supabase.from('questions').upsert(questionRows, { onConflict: 'id' });
      }
    } catch (error) {
      console.warn('Failed to migrate user questions', error);
    }
  }

  if (user.isAdmin) {
    const globalQuestions = localStorage.getItem('questions_global');
    if (globalQuestions) {
      try {
        const parsedQuestions = JSON.parse(globalQuestions);
        if (Array.isArray(parsedQuestions) && parsedQuestions.length > 0) {
          const questionRows = parsedQuestions.map((question: any) => ({
            id: question.id,
            owner_id: userId,
            number: question.number,
            question: question.question,
            options: question.options,
            correct_answer: question.correctAnswer,
            explanation: question.explanation,
            is_multiple_choice: question.isMultipleChoice ?? question.correctAnswer?.length > 1,
            created_at: question.createdAt,
            created_by: question.createdBy ?? username,
            is_global: true
          }));

          await supabase.from('questions').upsert(questionRows, { onConflict: 'id' });
        }
      } catch (error) {
        console.warn('Failed to migrate global questions', error);
      }
    }
  }

  const savedHistory = localStorage.getItem(`examHistory_${userId}`);
  if (savedHistory) {
    try {
      const parsedHistory = JSON.parse(savedHistory);
      if (Array.isArray(parsedHistory) && parsedHistory.length > 0) {
        for (const session of parsedHistory) {
          const sessionRow = {
            id: session.id,
            user_id: userId,
            score: session.score ?? null,
            started_at: session.startTime ? new Date(session.startTime).toISOString() : null,
            ended_at: session.endTime ? new Date(session.endTime).toISOString() : null
          };

          await supabase.from('exam_sessions').upsert(sessionRow, { onConflict: 'id' });

          if (Array.isArray(session.questions)) {
            const answerRows = session.questions.map((question: any, index: number) => ({
              id: `answer-${session.id}-${index}`,
              session_id: session.id,
              question_id: question.questionId,
              question_order: index,
              user_answer: Array.isArray(question.userAnswer) ? question.userAnswer : [],
              is_correct: question.isCorrect
            }));

            if (answerRows.length > 0) {
              await supabase.from('exam_answers').upsert(answerRows, { onConflict: 'id' });
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to migrate exam history', error);
    }
  }

  await supabase.from('profiles').update({ migration_completed: true }).eq('id', userId);

  localStorage.removeItem(`questions_${userId}`);
  localStorage.removeItem(`examHistory_${userId}`);
  localStorage.removeItem('questions_global');
  localStorage.removeItem('examHistory_global');
  localStorage.removeItem('currentExamResult');
  localStorage.removeItem('questions');
  localStorage.removeItem('theme');
};

function App() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  
  // 认证状态
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  
  // 初始化应用
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        const profile = await ensureProfile(data.session.user);
        if (isMounted) {
          setIsAuthenticated(true);
          setCurrentUser(buildUser(data.session.user, profile));
          migrateLocalStorageData(buildUser(data.session.user, profile), profile);
        }
        if (isMounted) {
          setAuthReady(true);
        }
        return;
      }

      if (isMounted) {
        setAuthReady(true);
      }
    };

    initAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      if (session?.user) {
        const profile = await ensureProfile(session.user);
        setIsAuthenticated(true);
        setCurrentUser(buildUser(session.user, profile));
        migrateLocalStorageData(buildUser(session.user, profile), profile);
      } else {
        setIsAuthenticated(false);
        setCurrentUser(null);
      }
      setAuthReady(true);
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = t('common.appName');
    }
  }, [t, i18n.language]);
  
  // 登录函数
  const login = async (email: string, password: string): Promise<boolean> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error || !data.user) {
      return false;
    }

    // Do not block login on profile hydration to avoid spinner stalls.
    setIsAuthenticated(true);
    setCurrentUser(buildUser(data.user, null));
    void ensureProfile(data.user);
    return true;
  };
  
  // 注册函数
  const register = async (email: string, password: string): Promise<boolean> => {
    const username = email.includes('@') ? email.split('@')[0] : email;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username }
      }
    });

    if (error || !data.user) {
      return false;
    }

    await supabase.from('profiles').upsert(
      {
        id: data.user.id,
        username,
        is_admin: false
      },
      { onConflict: 'id' }
    );

    return true;
  };
  
  // 登出函数
  const logout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setCurrentUser(null);
    navigate('/login');
  };
  
  // 获取所有用户
  const getAllUsers = async (): Promise<User[]> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, is_admin, created_at');

    if (error || !data) {
      return [];
    }

    return data.map((profile) =>
      buildUser({ id: profile.id, email: '', created_at: profile.created_at }, profile as ProfileRow)
    );
  };
  
  // 认证上下文值
  const authContextValue = {
    isAuthenticated,
    currentUser,
    authReady,
    setIsAuthenticated,
    setCurrentUser,
    login,
    register,
    logout,
    getAllUsers
  };
  
  return (
    <AuthContext.Provider value={authContextValue}>
      <div className={`min-h-screen ${theme === 'dark' ? 'dark' : ''}`}>
        <Routes>
          {/* 公开路由 */}
          <Route
            path="/"
            element={
              authReady
                ? (isAuthenticated ? <Home /> : <Navigate to="/login" replace />)
                : <Login />
            }
          />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* 受保护路由 */}
          <Route element={<ProtectedRoute />}>
            <Route path="/import" element={<Import />} />
            <Route path="/questions" element={<Questions />} />
            <Route path="/create-question" element={<CreateQuestion />} />
            <Route path="/exam" element={<Exam />} />
            <Route path="/results" element={<Results />} />
          </Route>
        </Routes>
      </div>
    </AuthContext.Provider>
  );
}

export default App;