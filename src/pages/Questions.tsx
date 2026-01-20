import React, { useState, useEffect } from 'react';
import { QuestionCard } from '@/components/QuestionCard';
import { Question } from '@/types';
import { toast } from 'sonner';
import { useTheme } from '@/hooks/useTheme';
import { Link } from 'react-router-dom';

export default function Questions() {
  const { theme, toggleTheme } = useTheme();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([]);
  
  // 从localStorage加载题目
  useEffect(() => {
    const currentUserId = localStorage.getItem('currentUserId');
    const userId = currentUserId || 'default';
    const savedQuestions = localStorage.getItem(`questions_${userId}`);
    
    // 如果用户有自己的题目，加载用户自己的题目
    if (savedQuestions) {
      try {
        const parsedQuestions = JSON.parse(savedQuestions);
        setQuestions(parsedQuestions);
        setFilteredQuestions(parsedQuestions);
      } catch (error) {
        console.error('加载题目失败:', error);
        toast.error('加载题目失败');
      }
    } 
    // 否则，如果是管理员，加载全局题目
    else if (currentUserId) {
      const currentUser = JSON.parse(localStorage.getItem('users') || '[]').find((user: any) => user.id === currentUserId);
      if (currentUser?.isAdmin) {
        const globalQuestions = localStorage.getItem('questions_global');
        if (globalQuestions) {
          try {
            const parsedQuestions = JSON.parse(globalQuestions);
            setQuestions(parsedQuestions);
            setFilteredQuestions(parsedQuestions);
          } catch (error) {
            console.error('加载全局题目失败:', error);
            toast.error('加载题目失败');
          }
        }
      }
    }
  }, []);
  
  // 过滤题目
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredQuestions(questions);
      return;
    }
    
    const lowercasedTerm = searchTerm.toLowerCase();
    const filtered = questions.filter(q => 
      q.question.toLowerCase().includes(lowercasedTerm) ||
      q.number.toString().includes(searchTerm) ||
      Object.values(q.options).some(option => 
        option.toLowerCase().includes(lowercasedTerm)
      ) ||
      q.explanation.toLowerCase().includes(lowercasedTerm)
    );
    
    setFilteredQuestions(filtered);
  }, [searchTerm, questions]);
  
  // 删除题目
  const handleDeleteQuestion = (id: string) => {
    if (window.confirm('确定要删除这道题目吗？')) {
      const updatedQuestions = questions.filter(q => q.id !== id);
      const currentUserId = localStorage.getItem('currentUserId');
      const userId = currentUserId || 'default';
      localStorage.setItem(`questions_${userId}`, JSON.stringify(updatedQuestions));
      
      // 如果是管理员，也更新全局题目
      if (currentUserId) {
        const currentUser = JSON.parse(localStorage.getItem('users') || '[]').find((user: any) => user.id === currentUserId);
        if (currentUser?.isAdmin) {
          const globalQuestions = JSON.parse(localStorage.getItem('questions_global') || '[]');
          const updatedGlobalQuestions = globalQuestions.filter((q: any) => q.id !== id);
          localStorage.setItem('questions_global', JSON.stringify(updatedGlobalQuestions));
        }
      }
      
      setQuestions(updatedQuestions);
      toast.success('题目已删除');
    }
  };
  
  // 清空所有题目
  const handleClearAll = () => {
    if (window.confirm('确定要删除所有题目吗？此操作不可恢复。')) {
      const currentUserId = localStorage.getItem('currentUserId');
      const userId = currentUserId || 'default';
      localStorage.removeItem(`questions_${userId}`);
      
      // 如果是管理员，也清除全局题目
      if (currentUserId) {
        const currentUser = JSON.parse(localStorage.getItem('users') || '[]').find((user: any) => user.id === currentUserId);
        if (currentUser?.isAdmin) {
          localStorage.removeItem('questions_global');
        }
      }
      
      setQuestions([]);
      setFilteredQuestions([]);
      toast.success('所有题目已删除');
    }
  };
  
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
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold mb-2">我的题库</h2>
              <p className="text-gray-600 dark:text-gray-400">管理和预览您导入的所有题目</p>
            </div>
              <div className="mt-4 md:mt-0 flex flex-wrap gap-3">
                <Link
                  to="/import"
                  className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                >
                  <i className="fa-solid fa-file-import mr-1"></i> 导入题目
                </Link>
                <Link
                  to="/create-question"
                  className="px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                >
                  <i className="fa-solid fa-plus mr-1"></i> 创建题目
                </Link>
                {questions.length > 0 && (
                  <Link
                    to="/exam"
                    className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                  >
                    <i className="fa-solid fa-pen-to-square mr-1"></i> 开始考试
                  </Link>
                )}
                <Link
                  to="/"
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  <i className="fa-solid fa-arrow-left mr-1"></i> 返回首页
                </Link>
              </div>
          </div>
          
          {/* 搜索和统计区域 */}
          {questions.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-6 mb-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold mb-1">题目列表</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    总共 {questions.length} 道题目，当前显示 {filteredQuestions.length} 道
                  </p>
                </div>
                <div className="mt-4 md:mt-0 flex space-x-2">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="搜索题目..."
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
                    <i className="fa-solid fa-trash-can mr-1"></i> 清空
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* 题目列表 */}
          {filteredQuestions.length > 0 ? (
            <div className="space-y-6">
              {filteredQuestions.map(question => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  showExplanation={true}
                  isEditable={true}
                  onDelete={() => handleDeleteQuestion(question.id)}
                />
              ))}
            </div>
          ) : questions.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-12 text-center">
              <div className="text-6xl text-gray-300 dark:text-gray-600 mb-4">
                <i className="fa-solid fa-book-open"></i>
              </div>
              <h3 className="text-xl font-bold mb-2">还没有导入题目</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                点击上方的"导入题目"按钮开始添加题目到您的题库
              </p>
              <Link
                to="/import"
                className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                <i className="fa-solid fa-file-import mr-2"></i>
                导入题目
              </Link>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-12 text-center">
              <div className="text-6xl text-gray-300 dark:text-gray-600 mb-4">
                <i className="fa-solid fa-search"></i>
              </div>
              <h3 className="text-xl font-bold mb-2">没有找到匹配的题目</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                请尝试使用不同的搜索关键词
              </p>
              <button
                onClick={() => setSearchTerm('')}
                className="inline-flex items-center px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium rounded-lg transition-colors"
              >
                <i className="fa-solid fa-rotate-left mr-2"></i>
                清除搜索
              </button>
            </div>
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