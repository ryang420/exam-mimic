import React, { useState, useEffect, useContext } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { Link } from 'react-router-dom';
import { AuthContext } from '@/contexts/authContext';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { UserStats } from '@/types';

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const { currentUser, logout, getAllUsers } = useContext(AuthContext);
  const [showGlobalStats, setShowGlobalStats] = useState(false);
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
  const [chartData, setChartData] = useState<any[]>([]);
  const [globalChartData, setGlobalChartData] = useState<any[]>([]);
  
  // 加载用户统计数据
  useEffect(() => {
    if (currentUser) {
      loadUserStats();
      if (currentUser.isAdmin) {
        loadGlobalStats();
      }
    }
  }, [currentUser, showGlobalStats]);
  
  // 加载用户统计数据
  const loadUserStats = () => {
    if (!currentUser) return;
    
    const userId = currentUser.id;
    const userExamHistory = JSON.parse(localStorage.getItem(`examHistory_${userId}`) || '[]');
    
    if (userExamHistory.length > 0) {
      const scores = userExamHistory.map((exam: any) => exam.score);
      const totalScore = scores.reduce((sum: number, score: number) => sum + score, 0);
      
      setUserStats({
        totalExams: userExamHistory.length,
        averageScore: Math.round(totalScore / scores.length),
        highestScore: Math.max(...scores),
        lowestScore: Math.min(...scores)
      });
      
      // 准备图表数据
      const chartData = userExamHistory.slice(-5).map((exam: any, index: number) => ({
        name: `考试 ${index + 1}`,
        分数: exam.score,
      }));
      setChartData(chartData);
    }
  };
  
  // 加载全局统计数据
  const loadGlobalStats = () => {
    const allUsers = getAllUsers();
    const globalExamHistory = JSON.parse(localStorage.getItem('examHistory_global') || '[]');
    
    // 计算总题目数
    const currentUserId = localStorage.getItem('currentUserId');
    const userId = currentUserId || 'default';
    const savedQuestions = localStorage.getItem(`questions_${userId}`) || localStorage.getItem('questions_global');
    const totalQuestions = savedQuestions ? JSON.parse(savedQuestions).length : 0;
    
    // 计算每个用户的统计数据
    const usersStats: UserStats[] = [];
    allUsers.forEach((user: any) => {
      const userExams = globalExamHistory.filter((exam: any) => exam.userId === user.id);
      if (userExams.length > 0) {
        const scores = userExams.map((exam: any) => exam.score);
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
    
    // 计算整体平均分
    let globalAverageScore = 0;
    if (globalExamHistory.length > 0) {
      const totalGlobalScore = globalExamHistory.reduce((sum: number, exam: any) => sum + (exam.score || 0), 0);
      globalAverageScore = Math.round(totalGlobalScore / globalExamHistory.length);
    }
    
    setGlobalStats({
      totalUsers: allUsers.length,
      totalQuestions,
      totalExams: globalExamHistory.length,
      averageScore: globalAverageScore,
      usersStats
    });
    
    // 准备全局图表数据
    const chartData = usersStats.slice(0, 8).map((user) => ({
      name: user.username.length > 6 ? `${user.username.substring(0, 6)}...` : user.username,
      平均分: user.averageScore,
    }));
    setGlobalChartData(chartData);
  };
  
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#a4de6c'];
  
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
            <h2 className="text-3xl font-bold mb-4">欢迎使用模拟考试系统</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              请先登录或注册账号以开始使用
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link
                to="/login"
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
              >
                <i className="fa-solid fa-sign-in-alt mr-2"></i>
                登录
              </Link>
              <Link
                to="/register"
                className="px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium rounded-xl transition-colors"
              >
                <i className="fa-solid fa-user-plus mr-2"></i>
                注册
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
            模拟考试系统
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
                {showGlobalStats ? '显示个人统计' : '显示全局统计'}
              </button>
            )}
            <div className="relative">
              <button
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <i className="fa-solid fa-user"></i>
                <span>{currentUser.username}</span>
                {currentUser.isAdmin && (
                  <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
                    管理员
                  </span>
                )}
              </button>
            </div>
            <button
              onClick={logout}
              className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              aria-label="退出登录"
            >
              <i className="fa-solid fa-right-from-bracket"></i>
            </button>
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
      </nav>
      
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
                  {showGlobalStats && currentUser.isAdmin ? '全局统计' : '欢迎回来，'}{currentUser.username}
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  {showGlobalStats && currentUser.isAdmin 
                    ? '查看所有用户的考试统计和表现' 
                    : '这是您的模拟考试数据概览'}
                </p>
              </motion.div>
            </div>
            <div className="mt-4 md:mt-0">
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/import"
                  className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                >
                  <i className="fa-solid fa-file-import mr-1"></i> 导入题库
                </Link>
                <Link
                  to="/create-question"
                  className="px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                >
                  <i className="fa-solid fa-plus mr-1"></i> 创建题目
                </Link>
                <Link
                  to="/exam"
                  className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                >
                  <i className="fa-solid fa-pen-to-square mr-1"></i> 开始考试
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
                  <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300">用户总数</h3>
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400">
                    <i className="fa-solid fa-users"></i>
                  </div>
                </div>
                <div className="text-4xl font-bold text-gray-900 dark:text-white">
                  {globalStats.totalUsers}
                </div>
                <div className="mt-2 text-sm text-green-600 dark:text-green-400 flex items-center">
                  <i className="fa-solid fa-arrow-up mr-1"></i>
                  <span>已注册所有用户</span>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300">题目总数</h3>
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-full text-purple-600 dark:text-purple-400">
                    <i className="fa-solid fa-file-lines"></i>
                  </div>
                </div>
                <div className="text-4xl font-bold text-gray-900 dark:text-white">
                  {globalStats.totalQuestions}
                </div>
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  全局题库题目数量
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300">考试总数</h3>
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full text-green-600 dark:text-green-400">
                    <i className="fa-solid fa-pen-to-square"></i>
                  </div>
                </div>
                <div className="text-4xl font-bold text-gray-900 dark:text-white">
                  {globalStats.totalExams}
                </div>
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  所有用户的考试次数
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300">平均分数</h3>
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-full text-orange-600 dark:text-orange-400">
                    <i className="fa-solid fa-star"></i>
                  </div>
                </div>
                <div className="text-4xl font-bold text-gray-900 dark:text-white">
                  {globalStats.averageScore}%
                </div>
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  所有考试的平均正确率
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
                  <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300">考试次数</h3>
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400">
                    <i className="fa-solid fa-pen-to-square"></i>
                  </div>
                </div>
                <div className="text-4xl font-bold text-gray-900 dark:text-white">
                  {userStats.totalExams}
                </div>
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  您参加的考试总数
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300">平均分数</h3>
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full text-green-600 dark:text-green-400">
                    <i className="fa-solid fa-star"></i>
                  </div>
                </div>
                <div className="text-4xl font-bold text-gray-900 dark:text-white">
                  {userStats.averageScore}%
                </div>
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  所有考试的平均正确率
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300">最高分数</h3>
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-full text-purple-600 dark:text-purple-400">
                    <i className="fa-solid fa-trophy"></i>
                  </div>
                </div>
                <div className="text-4xl font-bold text-gray-900 dark:text-white">
                  {userStats.highestScore}%
                </div>
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  您取得的最好成绩
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300">最低分数</h3>
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-full text-orange-600 dark:text-orange-400">
                    <i className="fa-solid fa-chart-line"></i>
                  </div>
                </div>
                <div className="text-4xl font-bold text-gray-900 dark:text-white">
                  {userStats.lowestScore}%
                </div>
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  您取得的最低成绩
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
              <h3 className="text-xl font-bold mb-6">用户平均分统计</h3>
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
                    <Bar dataKey="平均分">
                      {globalChartData.map((entry, index) => (
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
              <h3 className="text-xl font-bold mb-6">考试成绩趋势</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
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
                      dataKey="分数" 
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
            <Link
              to="/import"
              className="block bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-2xl shadow-md border border-blue-200 dark:border-blue-800 p-6 hover:shadow-lg transition-shadow"
            >
              <div className="text-3xl text-blue-600 dark:text-blue-400 mb-4">
                <i className="fa-solid fa-file-import"></i>
              </div>
              <h3 className="text-xl font-bold mb-2">导入题库</h3>
              <p className="text-gray-600 dark:text-gray-400">
                上传包含考题的文本文件，快速添加题目到您的题库
              </p>
            </Link>
            
            <Link
              to="/questions"
              className="block bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-2xl shadow-md border border-purple-200 dark:border-purple-800 p-6 hover:shadow-lg transition-shadow"
            >
              <div className="text-3xl text-purple-600 dark:text-purple-400 mb-4">
                <i className="fa-solid fa-book"></i>
              </div>
              <h3 className="text-xl font-bold mb-2">我的题库</h3>
              <p className="text-gray-600 dark:text-gray-400">
                查看和管理您的所有题目，进行编辑或删除操作
              </p>
            </Link>
            
            <Link
              to="/exam"
              className="block bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-2xl shadow-md border border-green-200 dark:border-green-800 p-6 hover:shadow-lg transition-shadow"
            >
              <div className="text-3xl text-green-600 dark:text-green-400 mb-4">
                <i className="fa-solid fa-pen-to-square"></i>
              </div>
              <h3 className="text-xl font-bold mb-2">开始考试</h3>
              <p className="text-gray-600 dark:text-gray-400">
                进行模拟考试，测试您的知识掌握程度
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
                  <h3 className="text-xl font-bold mb-2">管理员功能</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    作为管理员，您可以查看所有用户的统计数据
                  </p>
                  <button
                    onClick={() => setShowGlobalStats(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    <i className="fa-solid fa-chart-pie mr-2"></i>
                    查看全局统计
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
          <p>© 2026 模拟考试系统 | 设计与开发</p>
        </div>
      </footer>
    </div>
  );
}