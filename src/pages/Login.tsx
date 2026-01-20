import React, { useState, useContext } from 'react';
import { AuthContext } from '@/contexts/authContext';
import { toast } from 'sonner';
import { useTheme } from '@/hooks/useTheme';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Login() {
  const { theme, toggleTheme } = useTheme();
  const { login, setIsAuthenticated, setCurrentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      toast.error('请输入用户名和密码');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // 模拟登录过程延迟
      setTimeout(() => {
        const success = login(username, password);
        
        if (success) {
          toast.success('登录成功！');
          setIsAuthenticated(true);
          
          // 获取当前用户信息
          const users = JSON.parse(localStorage.getItem('users') || '[]');
          const currentUser = users.find((user: any) => user.username === username);
          setCurrentUser(currentUser);
          
          // 登录成功后跳转到首页
          navigate('/');
        } else {
          toast.error('用户名或密码错误');
        }
        setIsLoading(false);
      }, 500);
    } catch (error) {
      toast.error('登录失败，请重试');
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100 transition-colors duration-300 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400">
            <i className="fa-solid fa-graduation-cap mr-2"></i>
            模拟考试系统
          </h1>
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-8"
        >
          <h2 className="text-2xl font-bold text-center mb-6">用户登录</h2>
          
          <form onSubmit={handleLogin}>
            <div className="mb-6">
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                用户名
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <i className="fa-solid fa-user text-gray-400"></i>
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="请输入用户名"
                  required
                />
              </div>
            </div>
            
            <div className="mb-8">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                密码
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <i className="fa-solid fa-lock text-gray-400"></i>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="请输入密码"
                  required
                />
              </div>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  登录中...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-sign-in-alt mr-2"></i>
                  登录
                </>
              )}
            </motion.button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              还没有账号？ <Link to="/register" className="text-blue-600 dark:text-blue-400 hover:underline">立即注册</Link>
            </p>
          </div>
          
        </motion.div>
        
        <div className="mt-8 flex justify-center">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 transition-colors"
            aria-label={theme === 'light' ? '切换到暗色模式' : '切换到亮色模式'}
          >
            {theme === 'light' ? (
              <i className="fa-solid fa-moon"></i>
            ) : (
              <i className="fa-solid fa-sun"></i>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}