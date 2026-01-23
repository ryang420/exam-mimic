import React from 'react';
import { Question } from '@/types';
import { resolveQuestionType } from '@/lib/questionType';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const questionType = resolveQuestionType(question);
  const isOrderQuestion = questionType === 'order';
  const isMultipleChoice = questionType === 'multiple';
  const isMatchingQuestion = questionType === 'matching';
  const userAnswerList = Array.isArray(userAnswer)
    ? userAnswer
    : (userAnswer ? [String(userAnswer)] : []);
  const subQuestions = Array.isArray(question.subQuestions) ? question.subQuestions : [];

  // 判断用户答案是否正确
  const isCorrect = userAnswer !== null && 
    question.correctAnswer.length > 0 &&
    question.correctAnswer.length === userAnswerList.length &&
    (isOrderQuestion || isMatchingQuestion
      ? question.correctAnswer.every((answer, index) => userAnswerList[index] === answer)
      : question.correctAnswer.every(answer => userAnswerList.includes(answer)));
  
  // 检查单个选项是否是正确答案
  const isOptionCorrect = (optionKey: string) => {
    return Array.isArray(question.correctAnswer) && 
      question.correctAnswer.includes(optionKey);
  };
  
  // 检查单个选项是否是用户选择的答案
  const isOptionSelectedByUser = (optionKey: string) => {
    return userAnswerList.includes(optionKey);
  };
  
  // 获取正确答案的显示文本
  const formatAnswersText = (answers: string[], ordered: boolean) => {
    const normalizedAnswers = ordered ? answers : [...answers].sort();
    return normalizedAnswers.join(ordered ? ' -> ' : ', ');
  };

  const getCorrectAnswersText = () => formatAnswersText(question.correctAnswer, isOrderQuestion);
  
  // 获取用户答案的显示文本
  const getUserAnswersText = () => formatAnswersText(userAnswerList, isOrderQuestion);
  
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
            {t('questionCard.questionLabel')} #{question.number}
            {isMultipleChoice && (
              <span className="ml-2 text-sm bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">
                {t('questionCard.multipleChoice')}
              </span>
            )}
            {isOrderQuestion && (
              <span className="ml-2 text-sm bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded">
                {t('questionCard.orderChoice')}
              </span>
            )}
            {isMatchingQuestion && (
              <span className="ml-2 text-sm bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded">
                {t('questionCard.matchingChoice')}
              </span>
            )}
          </h3>
        </div>
        {onDelete && isEditable && (
          <button
            onClick={onDelete}
            className="text-gray-500 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label={t('questionCard.deleteQuestion')}
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
        
        {isMatchingQuestion ? (
          <div className="space-y-4 mb-6">
            {subQuestions.map((subQuestion, index) => {
              const correctKey = question.correctAnswer[index];
              const userKey = userAnswerList[index];
              const correctLabel = correctKey ? `${correctKey}. ${question.options[correctKey] ?? ''}` : t('questionCard.notSelected');
              const userLabel = userKey ? `${userKey}. ${question.options[userKey] ?? ''}` : t('questionCard.notSelected');
              const isRowCorrect = Boolean(userKey) && userKey === correctKey;

              return (
                <div key={`${question.id}-match-${index}`} className="p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    {t('questionCard.matchingRequirement', { index: index + 1 })} {subQuestion}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className={`p-3 rounded-lg border ${isRowCorrect ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'}`}>
                      <div className="text-gray-500 dark:text-gray-400 mb-1">{t('questionCard.matchingYourChoice')}</div>
                      <div className={isRowCorrect ? 'text-green-700 dark:text-green-300 font-medium' : 'text-gray-700 dark:text-gray-200'}>
                        {userLabel}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <div className="text-gray-500 dark:text-gray-400 mb-1">{t('questionCard.matchingCorrectChoice')}</div>
                      <div className="text-gray-700 dark:text-gray-200 font-medium">
                        {correctLabel}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {subQuestions.length === 0 && (
              <div className="text-sm text-red-500 dark:text-red-400">
                {t('questionCard.matchingMissing')}
              </div>
            )}
          </div>
        ) : (
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
                  <div className="flex items-start justify-between">
                    <div className="flex items-start">
                      <span className={`font-bold mr-3 ${textColor}`}>
                        {key}
                      </span>
                      <span className={`${textColor}`}>
                        {value}
                      </span>
                    </div>
                    {userAnswer !== null && isOrderQuestion && (
                      <div className="flex items-center gap-2 text-xs">
                        {isOptionSelectedByUser(key) && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                            {t('questionCard.yourOrder', { order: userAnswerList.indexOf(key) + 1 })}
                          </span>
                        )}
                        {isOptionCorrect(key) && (
                          <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                            {t('questionCard.correctOrder', { order: question.correctAnswer.indexOf(key) + 1 })}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* 显示正确/错误标记 */}
                  {userAnswer !== null && isOptionCorrect(key) && (
                    <div className="flex justify-end mt-2">
                      <span className="inline-flex items-center text-green-600 dark:text-green-400 text-sm">
                        <i className="fa-solid fa-check-circle mr-1"></i> {t('questionCard.correctTag')}
                      </span>
                    </div>
                  )}
                  
                  {userAnswer !== null && isOptionSelectedByUser(key) && !isOptionCorrect(key) && (
                    <div className="flex justify-end mt-2">
                      <span className="inline-flex items-center text-red-600 dark:text-red-400 text-sm">
                        <i className="fa-solid fa-x-circle mr-1"></i> {t('questionCard.yourTag')}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        
        {/* 答案汇总信息 */}
        {userAnswer !== null && !isMatchingQuestion && question.correctAnswer.length > 0 && (isOrderQuestion || question.correctAnswer.length > 1) && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
              <div className="mb-2 sm:mb-0">
                <span className="font-medium text-gray-700 dark:text-gray-300">{t('questionCard.correctAnswer')}：</span>
                <span className="text-green-600 dark:text-green-400 font-medium">{getCorrectAnswersText()}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">{t('questionCard.yourAnswer')}：</span>
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
              {t('questionCard.analysis')}
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