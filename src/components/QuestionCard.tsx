import React from 'react';
import { Question } from '@/types';
import { motion } from 'framer-motion';

interface QuestionCardProps {
  question: Question;
  onDelete?: () => void;
  showExplanation?: boolean;
  isEditable?: boolean;
  userAnswer?: string | string[] | null;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  onDelete,
  showExplanation = false,
  isEditable = false,
  userAnswer = null
}) => {
  // 判断用户答案是否正确
  const isCorrect = userAnswer !== null && 
    Array.isArray(question.correctAnswer) &&
    Array.isArray(userAnswer) &&
    question.correctAnswer.length === userAnswer.length &&
    question.correctAnswer.every(answer => userAnswer.includes(answer));
  
  // 检查单个选项是否是正确答案
  const isOptionCorrect = (optionKey: string) => {
    return Array.isArray(question.correctAnswer) && 
      question.correctAnswer.includes(optionKey);
  };
  
  // 检查单个选项是否是用户选择的答案
  const isOptionSelectedByUser = (optionKey: string) => {
    return Array.isArray(userAnswer) && userAnswer.includes(optionKey);
  };
  
  // 获取正确答案的显示文本
  const getCorrectAnswersText = () => {
    if (Array.isArray(question.correctAnswer)) {
      return question.correctAnswer.sort().join(', ');
    }
    return String(question.correctAnswer);
  };
  
  // 获取用户答案的显示文本
  const getUserAnswersText = () => {
    if (Array.isArray(userAnswer)) {
      return userAnswer.sort().join(', ');
    }
    return String(userAnswer);
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden mb-6"
    >
      {/* 题目头部 */}
      <div className="bg-gray-50 dark:bg-gray-750 px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
        <div className="flex items-center">
          <span className="inline-block w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold mr-3">
            {question.number}
          </span>
          <h3 className="font-semibold text-gray-800 dark:text-gray-200">
            问题 #{question.number}
            {question.isMultipleChoice && (
              <span className="ml-2 text-sm bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">
                多选题
              </span>
            )}
          </h3>
        </div>
        {onDelete && isEditable && (
          <button
            onClick={onDelete}className="text-gray-500 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="删除题目"
          >
            <i className="fa-solid fa-trash"></i>
          </button>
        )}
      </div>
      
      {/* 题目内容 */}
      <div className="p-6">
        <div className="text-gray-800 dark:text-gray-200 mb-6 whitespace-pre-line">
          {question.question}
        </div>
        
        {/* 选项列表 */}
        <div className="space-y-3 mb-6">
          {Object.entries(question.options).map(([key, value]) => {
            // 确定选项样式
            let optionClass = 'p-3 rounded-xl border transition-all';
            let textColor = 'text-gray-800 dark:text-gray-200';
            let borderColor = 'border-gray-200 dark:border-gray-700';
            
            // 如果显示用户答案
            if (userAnswer !== null) {
              // 正确答案
              if (isOptionCorrect(key)) {
                borderColor = 'border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/20';
                textColor = 'text-green-700 dark:text-green-400';
              } 
              // 用户答错的答案
              else if (isOptionSelectedByUser(key)) {
                borderColor = 'border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-900/20';
                textColor = 'text-red-700 dark:text-red-400';
              }
            }
            
            return (
              <div 
                key={key}
                className={`${optionClass} ${borderColor}`}
              >
                <div className="flex items-start">
                  <span className={`font-bold mr-3 ${textColor}`}>
                    {key}
                  </span>
                  <span className={`${textColor}`}>
                    {value}
                  </span>
                </div>
                
                {/* 显示正确/错误标记 */}
                {userAnswer !== null && isOptionCorrect(key) && (
                  <div className="flex justify-end mt-2">
                    <span className="inline-flex items-center text-green-600 dark:text-green-400 text-sm">
                      <i className="fa-solid fa-check-circle mr-1"></i> 正确答案
                    </span>
                  </div>
                )}
                
                {userAnswer !== null && isOptionSelectedByUser(key) && !isOptionCorrect(key) && (
                  <div className="flex justify-end mt-2">
                    <span className="inline-flex items-center text-red-600 dark:text-red-400 text-sm">
                      <i className="fa-solid fa-x-circle mr-1"></i> 您的答案
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* 答案汇总信息 */}
        {userAnswer !== null && Array.isArray(question.correctAnswer) && question.correctAnswer.length > 1 && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
              <div className="mb-2 sm:mb-0">
                <span className="font-medium text-gray-700 dark:text-gray-300">正确答案：</span>
                <span className="text-green-600 dark:text-green-400 font-medium">{getCorrectAnswersText()}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">您的答案：</span>
                <span className={`font-medium ${isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {getUserAnswersText()}
                </span>
              </div>
            </div>
          </div>
        )}
        
        {/* 解析部分 */}
        {showExplanation && question.explanation && (
          <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
            <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center">
              <i className="fa-solid fa-lightbulb text-yellow-500 mr-2"></i>
              解析
            </h4>
            <div className="text-gray-600 dark:text-gray-400 whitespace-pre-line">
              {question.explanation}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};