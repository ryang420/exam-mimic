import React, { useState, useContext } from 'react';
import { FileImporter } from '@/components/FileImporter';
import { QuestionCard } from '@/components/QuestionCard';
import { Question } from '@/types';
import { toast } from 'sonner';
import { useTheme } from '@/hooks/useTheme';
import { Link } from 'react-router-dom';
import { AuthContext } from '@/contexts/authContext';

export default function Import() {
  const { theme, toggleTheme } = useTheme();
  const { currentUser } = useContext(AuthContext);
  const [importedQuestions, setImportedQuestions] = useState<Question[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  
  // 从localStorage加载已保存的题目
  React.useEffect(() => {
    const userId = currentUser?.id || 'default';
    const savedQuestions = localStorage.getItem(`questions_${userId}`);
    
    // 如果用户有自己的题目，加载用户自己的题目
    if (savedQuestions) {
      try {
        setImportedQuestions(JSON.parse(savedQuestions));
      } catch (error) {
        console.error('加载题目失败:', error);
      }
    } 
    // 否则，如果是管理员，加载全局题目
    else if (currentUser?.isAdmin) {
      const globalQuestions = localStorage.getItem('questions_global');
      if (globalQuestions) {
        try {
          setImportedQuestions(JSON.parse(globalQuestions));
        } catch (error) {
          console.error('加载全局题目失败:', error);
        }
      }
    }
  }, [currentUser]);
  
  // 处理文件导入
  const handleImport = (questions: Question[]) => {
    if (questions.length === 0) {
      toast.warning('未解析到有效题目，请检查文件格式');
      return;
    }
    
    // 合并现有题目和新导入的题目
    const existingNumbers = new Set(importedQuestions.map(q => q.number));
    let maxNumber = Math.max(0, ...importedQuestions.map(q => q.number));
    
    // 确保每个题目都有唯一的编号
    const newQuestions = questions.map(q => {
      if (existingNumbers.has(q.number)) {
        maxNumber++;
        return { ...q, number: maxNumber };
      }
      existingNumbers.add(q.number);
      if (q.number > maxNumber) {
        maxNumber = q.number;
      }
      return q;
    });
    
    // 更新题目列表
    const updatedQuestions = [...importedQuestions, ...newQuestions];
    
    // 按编号排序
    updatedQuestions.sort((a, b) => a.number - b.number);
    
    // 保存到localStorage（按用户隔离）
    const userId = currentUser?.id || 'default';
    localStorage.setItem(`questions_${userId}`, JSON.stringify(updatedQuestions));
    
    // 如果是管理员，也保存到全局题库
    if (currentUser?.isAdmin) {
      localStorage.setItem('questions_global', JSON.stringify(updatedQuestions));
    }
    
    // 更新状态
    setImportedQuestions(updatedQuestions);
    
    // 显示预览
    setShowPreview(true);
  };
  
  // 清除所有题目
  const handleClearAll = () => {
    if (window.confirm('确定要删除所有题目吗？此操作不可恢复。')) {
      const userId = currentUser?.id || 'default';
      localStorage.removeItem(`questions_${userId}`);
      
      // 如果是管理员，也清除全局题目
      if (currentUser?.isAdmin) {
        localStorage.removeItem('questions_global');
      }
      
      setImportedQuestions([]);
      setShowPreview(false);
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
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold mb-2">导入题库</h2>
              <p className="text-gray-600 dark:text-gray-400">上传包含考题的文本文件，系统将自动解析并添加到您的题库</p>
            </div>
            <Link
              to="/"
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              <i className="fa-solid fa-arrow-left mr-1"></i> 返回首页
            </Link>
          </div>
          
          {/* 文件导入区域 */}
          <div className="mb-12">
            <FileImporter onImport={handleImport} />
          </div>
          
          {/* 已导入题目统计 */}
          {importedQuestions.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-6 mb-8">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">已导入题目</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={handleClearAll}
                    className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                  >
                    <i className="fa-solid fa-trash-can mr-1"></i> 清空
                  </button>
                   <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                  >
                    {showPreview ? (
                      <>
                        <i className="fa-solid fa-eye-slash mr-1"></i> 隐藏预览
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-eye mr-1"></i> 查看预览
                      </>
                    )}
                  </button>
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
              <div className="text-center py-4">
                <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                  {importedQuestions.length}
                </div>
                <div className="text-gray-600 dark:text-gray-400">
                  总共导入了 {importedQuestions.length} 道题目
                </div>
              </div>
            </div>
          )}
          
          {/* 题目预览 */}
          {showPreview && importedQuestions.length > 0 && (
            <div>
              <h3 className="text-xl font-bold mb-4">题目预览</h3>
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {importedQuestions.slice(0, 3).map(question => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    isEditable={true}
                    onDelete={() => {
                      const updatedQuestions = importedQuestions.filter(q => q.id !== question.id);
                      localStorage.setItem('questions', JSON.stringify(updatedQuestions));
                      setImportedQuestions(updatedQuestions);
                      toast.success(`已删除第 ${question.number} 题`);
                    }}
                  />
                ))}
                
                {importedQuestions.length > 3 && (
                  <div className="text-center py-4 text-gray-600 dark:text-gray-400">
                    ... 还有 {importedQuestions.length - 3} 道题目未显示 ...
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* 操作提示 */}
          {importedQuestions.length > 0 && (
            <div className="mt-8 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
              <h4 className="font-semibold text-yellow-800 dark:text-yellow-400 mb-2 flex items-center">
                <i className="fa-solid fa-circle-info mr-2"></i>
                操作提示
              </h4>
              <ul className="text-yellow-700 dark:text-yellow-300 space-y-2">
                <li className="flex items-start">
                  <i className="fa-solid fa-check-circle mt-1 mr-2"></i>
                  <span>题目已自动保存到本地存储，刷新页面不会丢失</span>
                </li>
                <li className="flex items-start">
                  <i className="fa-solid fa-check-circle mt-1 mr-2"></i>
                  <span>点击"开始考试"按钮立即进行模拟测试</span>
                </li>
                <li className="flex items-start">
                  <i className="fa-solid fa-check-circle mt-1 mr-2"></i>
                  <span>您可以随时再次导入新的题目文件</span>
                </li>
              </ul>
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