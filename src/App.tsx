import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { AuthContext } from './contexts/authContext';
import { User } from './contexts/authContext';

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

// 创建默认管理员用户（如果不存在）
const createDefaultAdmin = () => {
  const users = JSON.parse(localStorage.getItem('users') || '[]');
  const adminExists = users.some((user: User) => user.isAdmin);
  
  if (!adminExists) {
    const adminUser: User = {
      id: 'admin-' + Date.now(),
      username: 'admin',
      password: 'admin123', // 简单密码用于演示
      isAdmin: true,
      createdAt: new Date().toISOString()
    };
    users.push(adminUser);
    localStorage.setItem('users', JSON.stringify(users));
    return adminUser;
  }
  return null;
};

function App() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  // 认证状态
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // 初始化应用
  useEffect(() => {
    // 创建默认管理员（如果需要）
    createDefaultAdmin();
    
    // 检查用户是否已登录
    const savedUserId = localStorage.getItem('currentUserId');
    if (savedUserId) {
      const users = JSON.parse(localStorage.getItem('users') || '[]');
      const user = users.find((u: User) => u.id === savedUserId);
      
      if (user) {
        setIsAuthenticated(true);
        setCurrentUser(user);
      }
    }
  }, []);
  
  // 登录函数
  const login = (username: string, password: string): boolean => {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find((u: User) => u.username === username && u.password === password);
    
    if (user) {
      localStorage.setItem('currentUserId', user.id);
      setIsAuthenticated(true);
      setCurrentUser(user);
      return true;
    }
    
    return false;
  };
  
  // 注册函数
  const register = (username: string, password: string, isAdmin: boolean = false): boolean => {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    
    // 检查用户名是否已存在
    if (users.some((u: User) => u.username === username)) {
      return false;
    }
    
    // 创建新用户
    const newUser: User = {
      id: 'user-' + Date.now(),
      username,
      password,
      isAdmin,
      createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));
    return true;
  };
  
  // 登出函数
  const logout = () => {
    localStorage.removeItem('currentUserId');
    setIsAuthenticated(false);
    setCurrentUser(null);
    navigate('/login');
  };
  
  // 获取所有用户
  const getAllUsers = (): User[] => {
    return JSON.parse(localStorage.getItem('users') || '[]');
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