import React, { useState, useContext } from 'react';
import { Question, QuestionType } from '@/types';
import { toast } from 'sonner';
import { useTheme } from '@/hooks/useTheme';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AuthContext } from '@/contexts/authContext';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

// 生成下一个选项字母（A, B, C, ..., Z, AA, AB, ...）
const getNextOptionKey = (currentKeys: string[]): string => {
  if (currentKeys.length === 0) return 'A';
  
  // 提取最后一个键并生成下一个
  const lastKey = currentKeys[currentKeys.length - 1];
  
  // 处理单字母键
  if (lastKey.length === 1) {
    if (lastKey === 'Z') {
      return 'AA';
    }
    return String.fromCharCode(lastKey.charCodeAt(0) + 1);
  }
  
  // 处理多字母键 (AA, AB, etc.)
  let chars = lastKey.split('');
  let i = chars.length - 1;
  
  while (i >= 0) {
    if (chars[i] === 'Z') {
      chars[i] = 'A';
      i--;
    } else {
      chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1);
      break;
    }
  }
  
  if (i < 0) {
    chars.unshift('A');
  }
  
  return chars.join('');
};

export default function CreateQuestion() {
  const { theme, toggleTheme } = useTheme();
  const { currentUser } = useContext(AuthContext);
  const { t } = useTranslation();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<Record<string, string>>({
    A: '',
    B: '',
    C: '',
    D: ''
  });
  const [questionType, setQuestionType] = useState<QuestionType>('single');
  const [subQuestions, setSubQuestions] = useState<string[]>([]);
  const [correctAnswers, setCorrectAnswers] = useState<string[]>([]);
  const [explanation, setExplanation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 处理选项变化
  const handleOptionChange = (key: string, value: string) => {
    setOptions(prev => ({
      ...prev,
      [key]: value
    }));
  };
  
  // 添加新选项
  const addOption = () => {
    const currentKeys = Object.keys(options);
    const nextKey = getNextOptionKey(currentKeys);
    
    setOptions(prev => ({
      ...prev,
      [nextKey]: ''
    }));
  };
  
  // 删除选项
  const deleteOption = (key: string) => {
    // 不能删除所有选项
    if (Object.keys(options).length <= 1) {
      toast.error(t('createQuestion.toast.needOption'));
      return;
    }
    
    // 创建新的选项对象，不包含要删除的选项
    const newOptions: Record<string, string> = {};
    Object.entries(options).forEach(([k, v]) => {
      if (k !== key) {
        newOptions[k] = v;
      }
    });
    
    setOptions(newOptions);
    
    // 从正确答案中移除被删除的选项
    setCorrectAnswers(prev => (
      questionType === 'matching'
        ? prev.map(answer => (answer === key ? '' : answer))
        : prev.filter(answer => answer !== key)
    ));
  };

  const handleQuestionTypeChange = (type: QuestionType) => {
    setQuestionType(type);
    if (type === 'single') {
      setCorrectAnswers(prev => (prev.length > 0 ? [prev[0]] : []));
    }
    if (type === 'matching') {
      setSubQuestions(prev => (prev.length > 0 ? prev : ['']));
      setCorrectAnswers(prev => {
        const requiredCount = subQuestions.length > 0 ? subQuestions.length : 1;
        return Array(requiredCount).fill('');
      });
    }
  };

  const updateSubQuestion = (index: number, value: string) => {
    setSubQuestions(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const addSubQuestion = () => {
    setSubQuestions(prev => [...prev, '']);
    setCorrectAnswers(prev => [...prev, '']);
  };

  const deleteSubQuestion = (index: number) => {
    if (subQuestions.length <= 1) {
      toast.error(t('createQuestion.toast.needRequirement'));
      return;
    }
    setSubQuestions(prev => prev.filter((_, idx) => idx !== index));
    setCorrectAnswers(prev => prev.filter((_, idx) => idx !== index));
  };

  const updateMatchingCorrectAnswer = (index: number, key: string) => {
    setCorrectAnswers(prev => {
      const next = [...prev];
      next[index] = key;
      return next;
    });
  };
  
  // 切换正确答案
  const toggleCorrectAnswer = (key: string) => {
    setCorrectAnswers(prev => {
      if (questionType === 'single') {
        return [key];
      }

      if (prev.includes(key)) {
        return prev.filter(answer => answer !== key);
      }

      // 多选与顺序题保持选择顺序
      return [...prev, key];
    });
  };
  
  // 验证表单
  const validateForm = (): boolean => {
    if (!question.trim()) {
      toast.error(t('createQuestion.toast.missingQuestion'));
      return false;
    }
    
    const hasValidOptions = Object.values(options).some(option => option.trim() !== '');
    if (!hasValidOptions) {
      toast.error(t('createQuestion.toast.missingOption'));
      return false;
    }
    
    if (correctAnswers.length === 0) {
      toast.error(t('createQuestion.toast.missingCorrect'));
      return false;
    }

    if (questionType === 'single' && correctAnswers.length !== 1) {
      toast.error(t('createQuestion.toast.missingCorrect'));
      return false;
    }

    if (questionType === 'order' && correctAnswers.length < 2) {
      toast.error(t('createQuestion.toast.missingOrder'));
      return false;
    }

    if (questionType === 'matching') {
      if (subQuestions.length === 0 || subQuestions.some(item => !item.trim())) {
        toast.error(t('createQuestion.toast.missingRequirements'));
        return false;
      }
      const availableOptionCount = Object.values(options).filter(option => option.trim() !== '').length;
      if (subQuestions.length > availableOptionCount) {
        toast.error(t('createQuestion.toast.matchingOptionLimit'));
        return false;
      }
      if (correctAnswers.length !== subQuestions.length || correctAnswers.some(answer => !answer)) {
        toast.error(t('createQuestion.toast.missingMatching'));
        return false;
      }
      const usedAnswers = correctAnswers.filter(Boolean);
      if (new Set(usedAnswers).size !== usedAnswers.length) {
        toast.error(t('createQuestion.toast.duplicateMatching'));
        return false;
      }
    }
    
    // 检查所有正确答案是否都有对应的非空选项
    for (const answer of correctAnswers) {
      if (!options[answer]?.trim()) {
        toast.error(t('createQuestion.toast.correctEmpty'));
        return false;
      }
    }
    
    return true;
  };
  
  // 保存题目
  const saveQuestion = async () => {
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      if (!currentUser?.id) {
        toast.error(t('createQuestion.toast.loginFirst'));
        return;
      }

      const numberScopeColumn = currentUser.isAdmin ? 'is_global' : 'owner_id';
      const numberScopeValue = currentUser.isAdmin ? true : currentUser.id;
      const { data: maxRows, error: maxError } = await supabase
        .from('questions')
        .select('number')
        .eq(numberScopeColumn, numberScopeValue)
        .order('number', { ascending: false })
        .limit(1);

      if (maxError) {
        console.warn('获取题目编号失败:', maxError);
      }

      const maxNumber = maxRows && maxRows.length > 0 ? (maxRows[0].number ?? 0) : 0;
      
      // 创建新题目
      const newQuestion: Question = {
        id: `q-${Date.now()}`,
        number: maxNumber + 1,
        question: question.trim(),
        options: Object.fromEntries(
          Object.entries(options).filter(([_, value]) => value.trim() !== '')
        ),
        correctAnswer: correctAnswers,
        explanation: explanation.trim(),
        isMultipleChoice: questionType === 'multiple',
        questionType,
        subQuestions: questionType === 'matching'
          ? subQuestions.map(item => item.trim())
          : [],
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.username || 'system'
      };

      const questionRow = {
        id: newQuestion.id,
        owner_id: currentUser.id,
        number: newQuestion.number,
        question: newQuestion.question,
        options: newQuestion.options,
        correct_answer: newQuestion.correctAnswer,
        explanation: newQuestion.explanation,
        is_multiple_choice: newQuestion.isMultipleChoice ?? newQuestion.correctAnswer.length > 1,
        question_type: newQuestion.questionType,
        sub_questions: Array.isArray(newQuestion.subQuestions) ? newQuestion.subQuestions : [],
        created_at: newQuestion.createdAt,
        created_by: newQuestion.createdBy,
        is_global: currentUser.isAdmin ? true : false
      };

      const { error } = await supabase.from('questions').insert(questionRow);
      if (error) {
        console.error('保存题目失败:', error);
      toast.error(t('createQuestion.toast.saveFail'));
        return;
      }
      
      // 显示成功消息
      toast.success(t('createQuestion.toast.created', { number: newQuestion.number }));
      
      // 重置表单
      resetForm();
      
    } catch (error) {
      console.error('保存题目失败:', error);
      toast.error(t('createQuestion.toast.saveFail'));
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // 重置表单
  const resetForm = () => {
    setQuestion('');
    setOptions({
      A: '',
      B: '',
      C: '',
      D: ''
    });
    setQuestionType('single');
    setSubQuestions([]);
    setCorrectAnswers([]);
    setExplanation('');
  };
  
  // 创建另一个题目
  const createAnotherQuestion = () => {
    saveQuestion();
  };
  
  // 完成创建并返回题库
  const completeAndReturn = () => {
    saveQuestion();
    // 使用setTimeout确保toast有时间显示
    setTimeout(() => {
      window.location.href = '/questions';
    }, 1000);
  };

  const correctHint = questionType === 'order'
    ? t('createQuestion.correctHintOrder')
    : (questionType === 'matching'
      ? t('createQuestion.correctHintMatching')
      : (questionType === 'multiple' ? t('createQuestion.correctHintMultiple') : t('createQuestion.correctHintSingle')));

  const selectedAnswersText = questionType === 'order'
    ? correctAnswers.join(' -> ')
    : (questionType === 'matching' ? '' : [...correctAnswers].sort().join(', '));
  
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
      
      {/* 主要内容 */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold mb-2">{t('createQuestion.title')}</h2>
              <p className="text-gray-600 dark:text-gray-400">{t('createQuestion.subtitle')}</p>
            </div>
            <Link
              to="/questions"
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              <i className="fa-solid fa-arrow-left mr-1"></i> {t('common.backQuestionBank')}
            </Link>
          </div>
          
          {/* 创建题目表单 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-8"
          >
            <form onSubmit={(e) => { e.preventDefault(); saveQuestion(); }}>
              {/* 题目内容 */}
              <div className="mb-6">
                <label htmlFor="question" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('createQuestion.questionLabel')}
                </label>
                <textarea
                  id="question"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={t('createQuestion.questionPlaceholder')}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent h-32 resize-y"
                  required
                ></textarea>
              </div>

              {/* 题型选择 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  {t('createQuestion.questionTypeLabel')}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <button
                    type="button"
                    onClick={() => handleQuestionTypeChange('single')}
                    className={`py-3 rounded-xl font-medium transition-all border ${
                      questionType === 'single'
                        ? 'bg-blue-600 text-white border-transparent'
                        : 'bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    {t('createQuestion.questionTypeSingle')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuestionTypeChange('multiple')}
                    className={`py-3 rounded-xl font-medium transition-all border ${
                      questionType === 'multiple'
                        ? 'bg-blue-600 text-white border-transparent'
                        : 'bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    {t('createQuestion.questionTypeMultiple')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuestionTypeChange('order')}
                    className={`py-3 rounded-xl font-medium transition-all border ${
                      questionType === 'order'
                        ? 'bg-blue-600 text-white border-transparent'
                        : 'bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    {t('createQuestion.questionTypeOrder')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuestionTypeChange('matching')}
                    className={`py-3 rounded-xl font-medium transition-all border ${
                      questionType === 'matching'
                        ? 'bg-blue-600 text-white border-transparent'
                        : 'bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    {t('createQuestion.questionTypeMatching')}
                  </button>
                </div>
              </div>
              
              {/* 选项 */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('createQuestion.optionsLabel')}
                  </label>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={addOption}
                    className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors text-sm flex items-center"
                  >
                    <i className="fa-solid fa-plus mr-1"></i> {t('createQuestion.addOption')}
                  </motion.button>
                </div>
                
                {Object.entries(options).map(([key, value]) => (
                  <div key={key} className="mb-3 relative">
                    <div className="flex items-center space-x-2">
                      <span className="inline-block w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 flex items-center justify-center font-bold">
                        {key}
                      </span>
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => handleOptionChange(key, e.target.value)}
                        placeholder={t('createQuestion.optionPlaceholder', { key })}
                        className="flex-1 px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      {Object.keys(options).length > 1 && (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          type="button"
                          onClick={() => deleteOption(key)}
                          className="p-2 text-gray-500 hover:text-red-500 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                          aria-label={t('createQuestion.deleteOption', { key })}
                        >
                          <i className="fa-solid fa-trash"></i>
                        </motion.button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* 正确答案 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  {t('createQuestion.correctLabel')}{' '}
                  <span className="text-blue-500 dark:text-blue-400 text-xs">({correctHint})</span>
                </label>
                {questionType === 'matching' ? (
                  <div className="space-y-4">
                    {subQuestions.map((subQuestion, index) => {
                      const usedKeys = correctAnswers.filter((answer, answerIndex) => answer && answerIndex !== index);
                      return (
                        <div key={`matching-${index}`} className="p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                {t('createQuestion.matchingRequirementLabel', { index: index + 1 })}
                              </label>
                              <input
                                type="text"
                                value={subQuestion}
                                onChange={(event) => updateSubQuestion(index, event.target.value)}
                                placeholder={t('createQuestion.matchingRequirementPlaceholder')}
                                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                            <div className="sm:w-64 mt-3 sm:mt-0">
                              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                {t('createQuestion.matchingAnswerLabel')}
                              </label>
                              <select
                                value={correctAnswers[index] || ''}
                                onChange={(event) => updateMatchingCorrectAnswer(index, event.target.value)}
                                className="w-full px-3 py-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              >
                                <option value="">{t('createQuestion.matchingSelectPlaceholder')}</option>
                                {Object.entries(options).map(([key, value]) => {
                                  const isUsed = usedKeys.includes(key);
                                  const isEmpty = !value.trim();
                                  return (
                                    <option key={key} value={key} disabled={isUsed || isEmpty}>
                                      {key}. {value || t('createQuestion.matchingEmptyOption')}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                            <div className="mt-3 sm:mt-0">
                              <button
                                type="button"
                                onClick={() => deleteSubQuestion(index)}
                                className="p-2 text-gray-500 hover:text-red-500 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                                aria-label={t('createQuestion.matchingDeleteRequirement', { index: index + 1 })}
                              >
                                <i className="fa-solid fa-trash"></i>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      onClick={addSubQuestion}
                      className="px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors text-sm flex items-center"
                    >
                      <i className="fa-solid fa-plus mr-1"></i> {t('createQuestion.matchingAddRequirement')}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {Object.keys(options).map((key) => {
                        const orderIndex = questionType === 'order' ? correctAnswers.indexOf(key) : -1;
                        return (
                        <motion.div
                          key={key}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <button
                            type="button"
                            onClick={() => toggleCorrectAnswer(key)}
                            className={`w-full py-3 rounded-xl font-medium transition-all ${
                              correctAnswers.includes(key)
                                ? 'bg-blue-600 text-white border-transparent'
                                : 'bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600'
                            }`}
                          >
                            <span className="flex items-center justify-center">
                              {t('createQuestion.correctOption', { key })}
                              {questionType === 'order' && orderIndex >= 0 && (
                                <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-white/30 text-white">
                                  #{orderIndex + 1}
                                </span>
                              )}
                            </span>
                          </button>
                        </motion.div>
                      );
                      })}
                    </div>
                    {correctAnswers.length > 0 && (
                      <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                        {t('createQuestion.selected', { answers: selectedAnswersText })}
                      </div>
                    )}
                  </>
                )}
              </div>
              
              {/* 解析 */}
              <div className="mb-8">
                <label htmlFor="explanation" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('createQuestion.explanationLabel')}
                </label>
                <textarea
                  id="explanation"
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder={t('createQuestion.explanationPlaceholder')}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent h-32 resize-y"
                ></textarea>
              </div>
              
              {/* 操作按钮 */}
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={createAnotherQuestion}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      {t('createQuestion.saving')}
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-plus mr-2"></i>
                      {t('createQuestion.saveAndAdd')}
                    </>
                  )}
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={completeAndReturn}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      {t('createQuestion.saving')}
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-check mr-2"></i>
                      {t('createQuestion.saveAndFinish')}
                    </>
                  )}
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={resetForm}
                  className="py-3 px-4 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium rounded-xl transition-colors"
                  disabled={isSubmitting}
                >
                  <i className="fa-solid fa-rotate-left"></i>
                </motion.button>
              </div>
            </form>
          </motion.div>
          
          {/* 提示信息 */}
          <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <h4 className="font-semibold text-blue-800 dark:text-blue-400 mb-2 flex items-center">
              <i className="fa-solid fa-circle-info mr-2"></i>
              {t('createQuestion.tipsTitle')}
            </h4>
            <ul className="text-blue-700 dark:text-blue-300 space-y-2">
              <li className="flex items-start">
                <i className="fa-solid fa-check-circle mt-1 mr-2"></i>
                <span>{t('createQuestion.tips.saved')}</span>
              </li>
              <li className="flex items-start">
                <i className="fa-solid fa-check-circle mt-1 mr-2"></i>
                <span>{t('createQuestion.tips.multiOptions')}</span>
              </li>
              <li className="flex items-start">
                <i className="fa-solid fa-check-circle mt-1 mr-2"></i>
                <span>{t('createQuestion.tips.explanation')}</span>
              </li>
            </ul>
          </div>
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