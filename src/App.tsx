import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
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
    .select('id, username, is_admin, created_at')
    .eq('id', userId)
    .single();

  if (error) {
    return null;
  }

  return data as ProfileRow;
};

function App() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  // 认证状态
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // 初始化应用
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        const profile = await fetchProfile(data.session.user.id);
        if (isMounted) {
          setIsAuthenticated(true);
          setCurrentUser(buildUser(data.session.user, profile));
        }
      }
    };

    initAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        setIsAuthenticated(true);
        setCurrentUser(buildUser(session.user, profile));
      } else {
        setIsAuthenticated(false);
        setCurrentUser(null);
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);
  
  // 登录函数
  const login = async (email: string, password: string): Promise<boolean> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error || !data.user) {
      return false;
    }

    const profile = await fetchProfile(data.user.id);
    setIsAuthenticated(true);
    setCurrentUser(buildUser(data.user, profile));
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
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* 受保护路由 */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Home />} />
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