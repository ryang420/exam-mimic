import { useState, useEffect, useContext } from 'react';
import { ExamTimer } from '@/components/ExamTimer';
import { Course, ExamSession, Question } from '@/types';
import { resolveQuestionType, resolveQuestionTypeFromRow } from '@/lib/questionType';
import { toast } from 'sonner';
import { useTheme } from '@/hooks/useTheme';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AuthContext } from '@/contexts/authContext';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function Exam() {
  const { theme, toggleTheme } = useTheme();
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get('courseId');
  const examQuestionLimit = 65;
  const [course, setCourse] = useState<Course | null>(null);
  const [isLoadingCourse, setIsLoadingCourse] = useState(true);
  const [questionPool, setQuestionPool] = useState<Question[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string[]>>({});
  const [isExamStarted, setIsExamStarted] = useState(false);
  const [examDuration, setExamDuration] = useState(180);
  const [examSession, setExamSession] = useState<ExamSession | null>(null);

  const mapQuestionRow = (row: any): Question => {
    const questionType = resolveQuestionTypeFromRow(row);
    return {
      id: row.id,
      number: row.number,
      question: row.question,
      options: row.options || {},
      correctAnswer: row.correct_answer || [],
      explanation: row.explanation || '',
      isMultipleChoice: questionType === 'multiple',
      questionType,
      subQuestions: row.sub_questions || [],
      createdAt: row.created_at,
      createdBy: row.created_by,
      courseId: row.course_id ?? undefined
    };
  };

  useEffect(() => {
    const loadCourse = async () => {
      if (!courseId) {
        setCourse(null);
        setIsLoadingCourse(false);
        return;
      }

      setIsLoadingCourse(true);
      const { data, error } = await supabase
        .from('courses')
        .select('id, title, description, duration_minutes, created_at, created_by')
        .eq('id', courseId)
        .maybeSingle();

      if (error || !data) {
        console.error('加载课程失败:', error);
        toast.error(t('exam.courseLoadFail'));
        setCourse(null);
        setIsLoadingCourse(false);
        return;
      }

      const mappedCourse: Course = {
        id: data.id,
        title: data.title,
        description: data.description ?? '',
        durationMinutes: data.duration_minutes ?? 60,
        createdAt: data.created_at ?? undefined,
        createdBy: data.created_by ?? undefined
      };

      setCourse(mappedCourse);
      setExamDuration(mappedCourse.durationMinutes);
      setIsLoadingCourse(false);
    };

    loadCourse();
  }, [courseId, t]);

  // 从Supabase加载题目
  useEffect(() => {
    if (!currentUser?.id || !courseId) {
      setQuestions([]);
      setQuestionPool([]);
      setIsLoadingQuestions(false);
      return;
    }

    const loadQuestions = async () => {
      setIsLoadingQuestions(true);
      const { data: questionRows, error } = await supabase.rpc('get_random_questions', {
        course_id_input: courseId,
        limit_count: examQuestionLimit
      });

      if (error) {
        console.error(t('exam.loadFail'), error);
        setIsLoadingQuestions(false);
        return;
      }

      const parsedQuestions = (questionRows ?? []).map(mapQuestionRow);
      setQuestionPool(parsedQuestions);
      setIsLoadingQuestions(false);
    };

    loadQuestions();
  }, [currentUser, courseId]);
  
  // 开始考试
  const startExam = () => {
    if (!courseId) {
      toast.error(t('exam.courseRequired'));
      return;
    }

    if (isLoadingQuestions) {
      return;
    }

    if (questionPool.length === 0) {
      toast.error(t('exam.noQuestions'));
      return;
    }

    const selectedQuestions = [...questionPool].sort(() => Math.random() - 0.5);
    
    // 创建考试会话
    const newSession: ExamSession = {
      id: `exam-${Date.now()}`,
      startTime: new Date(),
      questions: selectedQuestions.map(q => ({
        questionId: q.id,
        userAnswer: null,
        isCorrect: null
      })),
      score: null,
      courseId: courseId ?? undefined
    };
    
    setQuestions(selectedQuestions);
    setExamSession(newSession);
    setIsExamStarted(true);
    setCurrentQuestionIndex(0);
    setUserAnswers({});
  };
  
  // 切换答案选择状态
  const toggleAnswer = (answer: string) => {
    const currentQuestion = questions[currentQuestionIndex];
    const questionId = currentQuestion.id;
    const currentAnswers = userAnswers[questionId] || [];
    const questionType = resolveQuestionType(currentQuestion);
    
    setUserAnswers(prev => {
      if (questionType === 'single') {
        return {
          ...prev,
          [questionId]: [answer]
        };
      }

      if (currentAnswers.includes(answer)) {
        // 取消选择
        return {
          ...prev,
          [questionId]: currentAnswers.filter(a => a !== answer)
        };
      }

      // 多选和顺序题：追加选择（顺序题保持点击顺序）
      return {
        ...prev,
        [questionId]: [...currentAnswers, answer]
      };
    });
  };

  const updateMatchingAnswer = (index: number, answer: string) => {
    const currentQuestion = questions[currentQuestionIndex];
    const questionId = currentQuestion.id;
    const requiredCount = currentQuestion.subQuestions?.length ?? 0;

    setUserAnswers(prev => {
      const existing = prev[questionId] ? [...prev[questionId]] : Array(requiredCount).fill('');
      while (existing.length < requiredCount) {
        existing.push('');
      }
      existing[index] = answer;
      return {
        ...prev,
        [questionId]: existing
      };
    });
  };

  const clearAnswerOrder = () => {
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return;
    setUserAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: []
    }));
  };
  
  // 下一题
  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };
  
  // 上一题
  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };
  
  // 跳转到指定题目
  const goToQuestion = (index: number) => {
    setCurrentQuestionIndex(index);
  };
  
  // 交卷
  const submitExam = async () => {
    if (!examSession) return;
    
    // 计算得分
    let totalScore = 0;
    
    // 检查每道题的答案是否正确
    const updatedQuestions = examSession.questions.map(q => {
      const userAnswer = userAnswers[q.questionId] || [];
      const question = questions.find(question => question.id === q.questionId);
      
      if (!question) {
        return {
          ...q,
          userAnswer,
          isCorrect: null
        };
      }
      
      const questionType = resolveQuestionType(question);
      const isCorrect = question.correctAnswer.length > 0 && 
        question.correctAnswer.length === userAnswer.length && (
          questionType === 'order' || questionType === 'matching'
            ? question.correctAnswer.every((answer, index) => userAnswer[index] === answer)
            : question.correctAnswer.every(answer => userAnswer.includes(answer))
        );
      
      if (isCorrect) {
        totalScore += 1;
      }
      
      return {
        ...q,
        userAnswer,
        isCorrect
      };
    });
    
    const score = questions.length > 0 ? Math.round((totalScore / questions.length) * 100) : 0;
    
    // 更新考试会话
    const updatedSession: ExamSession = {
      ...examSession,
      endTime: new Date(),
      score,
      questions: updatedQuestions,
      courseId: courseId ?? undefined
    };
    
    if (!currentUser?.id) {
      toast.error(t('exam.loginFirst'));
      return;
    }

    const sessionRow = {
      id: updatedSession.id,
      user_id: currentUser.id,
      score,
      started_at: new Date(updatedSession.startTime).toISOString(),
      ended_at: updatedSession.endTime ? new Date(updatedSession.endTime).toISOString() : null,
      course_id: courseId ?? null
    };

    const { error: sessionError } = await supabase
      .from('exam_sessions')
      .insert(sessionRow);

    if (sessionError) {
      console.error('保存考试结果失败:', sessionError);
      toast.error(t('exam.saveResultFail'));
      return;
    }

    const answerRows = updatedQuestions.map((question, index) => ({
      id: `answer-${updatedSession.id}-${index}`,
      session_id: updatedSession.id,
      question_id: question.questionId,
      question_order: index,
      user_answer: question.userAnswer ?? [],
      is_correct: question.isCorrect
    }));

    const { error: answersError } = await supabase
      .from('exam_answers')
      .insert(answerRows);

    if (answersError) {
      console.error('保存答题记录失败:', answersError);
      toast.error(t('exam.saveAnswersFail'));
      return;
    }

    navigate('/results', { state: { sessionId: updatedSession.id, courseId: courseId ?? null } });
  };
  
  // 时间到处理
  const handleTimeUp = () => {
    toast.warning(t('exam.timeUp'));
    submitExam();
  };
  
  // 获取题目状态（已答/未答）
  const getQuestionStatus = (index: number): 'unanswered' | 'answered' | 'current' => {
    if (index === currentQuestionIndex) return 'current';
    const question = questions[index];
    const questionId = question.id;
    const answers = userAnswers[questionId] || [];
    const questionType = resolveQuestionType(question);

    if (questionType === 'matching') {
      const requiredCount = question.subQuestions?.length ?? 0;
      const hasAllAnswers = requiredCount > 0
        && answers.length === requiredCount
        && answers.every(answer => Boolean(answer));
      return hasAllAnswers ? 'answered' : 'unanswered';
    }

    return answers.length > 0 ? 'answered' : 'unanswered';
  };

  const currentQuestion = questions[currentQuestionIndex];
  const currentQuestionType = currentQuestion ? resolveQuestionType(currentQuestion) : 'single';
  const isOrderQuestion = currentQuestionType === 'order';
  const isMultipleChoice = currentQuestionType === 'multiple';
  const isMatchingQuestion = currentQuestionType === 'matching';
  const currentAnswers = currentQuestion ? (userAnswers[currentQuestion.id] || []) : [];
  const matchingAnswers = isMatchingQuestion && currentQuestion
    ? (userAnswers[currentQuestion.id] || Array(currentQuestion.subQuestions?.length ?? 0).fill(''))
    : [];
  const answeredCount = questions.reduce((total, _question, index) => (
    getQuestionStatus(index) === 'answered' ? total + 1 : total
  ), 0);
  const isCourseReady = Boolean(courseId && course);
  const availableQuestionCount = Math.min(questionPool.length, examQuestionLimit);
  
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
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          {!isExamStarted ? (
            // 考试开始前
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-8 text-center">
              <div className="text-6xl text-blue-500 mb-6">
                <i className="fa-solid fa-file-lines"></i>
              </div>
              <h2 className="text-3xl font-bold mb-4">
                {course ? t('exam.preStartTitleWithCourse', { course: course.title }) : t('exam.preStartTitle')}
              </h2>
              {course && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  {t('exam.courseLabel', { title: course.title })}
                </p>
              )}
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {t('exam.preStartDesc', { count: availableQuestionCount, duration: examDuration })}
              </p>
              {course?.description && (
                <p className="text-gray-500 dark:text-gray-400 mb-8 whitespace-pre-line">
                  {course.description}
                </p>
              )}

              {isLoadingCourse ? (
                <div className="mb-8 text-gray-500 dark:text-gray-400">{t('exam.loadingCourse')}</div>
              ) : !isCourseReady ? (
                <div className="mb-8">
                  <p className="text-red-500 dark:text-red-400 mb-4">
                    {t('exam.noCourseSelected')}
                  </p>
                  <Link
                    to="/courses"
                    className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                  >
                    <i className="fa-solid fa-list mr-2"></i>
                    {t('exam.goSelectCourse')}
                  </Link>
                </div>
              ) : isLoadingQuestions ? (
                <div className="mb-8 text-gray-500 dark:text-gray-400">{t('common.loading')}</div>
              ) : questionPool.length === 0 ? (
                <div className="mb-8">
                  <p className="text-red-500 dark:text-red-400 mb-4">
                    {currentUser?.isAdmin ? t('exam.noQuestionsAdmin') : t('exam.noQuestionsUser')}
                  </p>
                  {currentUser?.isAdmin ? (
                    <Link
                      to={courseId ? `/import?courseId=${courseId}` : '/import'}
                      className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                    >
                      <i className="fa-solid fa-file-import mr-2"></i>
                      {t('exam.goImport')}
                    </Link>
                  ) : (
                    <Link
                      to="/courses"
                      className="inline-flex items-center px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium rounded-lg transition-colors"
                    >
                      <i className="fa-solid fa-arrow-left mr-2"></i>
                      {t('exam.backToCourses')}
                    </Link>
                  )}
                </div>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={startExam}
                  className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg rounded-lg shadow-lg transition-all"
                >
                  <i className="fa-solid fa-play mr-2"></i>
                  {t('exam.start')}
                </motion.button>
              )}
              
              <div className="mt-8 text-gray-600 dark:text-gray-400 text-left">
                <h3 className="font-semibold mb-2">{t('exam.rules.title')}</h3>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <i className="fa-solid fa-circle-check text-green-500 mt-1 mr-2"></i>
                    <span>{t('exam.rules.timing')}</span>
                  </li>
                  <li className="flex items-start">
                    <i className="fa-solid fa-circle-check text-green-500 mt-1 mr-2"></i>
                    <span>{t('exam.rules.autoSave')}</span>
                  </li>
                  <li className="flex items-start">
                    <i className="fa-solid fa-circle-check text-green-500 mt-1 mr-2"></i>
                    <span>{t('exam.rules.showResults')}</span>
                  </li>
                  <li className="flex items-start">
                    <i className="fa-solid fa-circle-check text-green-500 mt-1 mr-2"></i>
                    <span>{t('exam.rules.multiChoice')}</span>
                  </li>
                  <li className="flex items-start">
                    <i className="fa-solid fa-circle-check text-green-500 mt-1 mr-2"></i>
                    <span>{t('exam.rules.orderChoice')}</span>
                  </li>
                  <li className="flex items-start">
                    <i className="fa-solid fa-circle-check text-green-500 mt-1 mr-2"></i>
                    <span>{t('exam.rules.matchingChoice')}</span>
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            // 考试进行中
            <div className="space-y-6">
              {/* 计时器 */}
              <ExamTimer 
                durationInMinutes={examDuration}
                onTimeUp={handleTimeUp}
                isRunning={isExamStarted}
              />
              
              {/* 题目导航 */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 p-4 overflow-x-auto">
                <div className="flex items-center mb-3">
                  <h3 className="font-semibold mr-3">{t('exam.navigation.title')}</h3>
                  <div className="flex space-x-2 text-sm">
                    <span className="flex items-center">
                      <span className="w-3 h-3 bg-blue-500 rounded-full mr-1"></span> {t('exam.navigation.current')}
                    </span>
                    <span className="flex items-center">
                      <span className="w-3 h-3 bg-green-500 rounded-full mr-1"></span> {t('exam.navigation.answered')}
                    </span>
                    <span className="flex items-center">
                      <span className="w-3 h-3 bg-gray-300 dark:bg-gray-600 rounded-full mr-1"></span> {t('exam.navigation.unanswered')}
                    </span>
                  </div>
                </div>
                <div className="flex space-x-2">
                  {questions.map((_, index) => {
                    const status = getQuestionStatus(index);
                    let bgColor = 'bg-gray-300 dark:bg-gray-600'; // 未答
                    let textColor = 'text-gray-800 dark:text-gray-200';
                    
                    if (status === 'answered') {
                      bgColor = 'bg-green-500';
                    } else if (status === 'current') {
                      bgColor = 'bg-blue-500';
                      textColor = 'text-white';
                    }
                    
                    return (
                      <button
                        key={index}
                        onClick={() => goToQuestion(index)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-medium transition-all ${bgColor} ${textColor}`}
                      >
                        {index + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* 当前题目 */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold">
                    {t('exam.currentQuestion', {
                      current: currentQuestionIndex + 1,
                      total: questions.length
                    })}
                  </h3>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {t('exam.remainingQuestions', {
                      count: questions.length - answeredCount
                    })}
                  </span>
                </div>
                
                {currentQuestion && (
                  <div className="mb-6">
                    <div className="text-gray-800 dark:text-gray-200 mb-6 whitespace-pre-line">
                      {currentQuestion.question}
                    </div>
                    
                    {/* 显示是否为多选题 */}
                    {isMultipleChoice && (
                      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <span className="text-blue-600 dark:text-blue-400 text-sm font-medium">
                          <i className="fa-solid fa-info-circle mr-1"></i> {t('exam.multiChoiceHint')}
                        </span>
                      </div>
                    )}

                    {isOrderQuestion && (
                      <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                        <span className="text-purple-600 dark:text-purple-400 text-sm font-medium">
                          <i className="fa-solid fa-info-circle mr-1"></i> {t('exam.orderChoiceHint')}
                        </span>
                      </div>
                    )}

                    {isMatchingQuestion && (
                      <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <span className="text-amber-700 dark:text-amber-300 text-sm font-medium">
                          <i className="fa-solid fa-info-circle mr-1"></i> {t('exam.matchingChoiceHint')}
                        </span>
                      </div>
                    )}
                    
                    {isMatchingQuestion ? (
                      <div className="space-y-4 mb-6">
                        {(currentQuestion.subQuestions || []).map((subQuestion, index) => {
                          const selected = matchingAnswers[index] ?? '';
                          const usedKeys = matchingAnswers.filter((answer, answerIndex) => answer && answerIndex !== index);
                          return (
                            <div key={`${currentQuestion.id}-match-${index}`} className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                              <div className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                                {t('exam.matchingRequirement', { index: index + 1 })} {subQuestion}
                              </div>
                              <select
                                value={selected}
                                onChange={(event) => updateMatchingAnswer(index, event.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              >
                                <option value="">{t('exam.matchingSelectPlaceholder')}</option>
                                {Object.entries(currentQuestion.options).map(([key, value]) => {
                                  const isUsed = usedKeys.includes(key);
                                  return (
                                    <option key={key} value={key} disabled={isUsed}>
                                      {key}. {value}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          );
                        })}
                        {(currentQuestion.subQuestions || []).length === 0 && (
                          <div className="text-sm text-red-500 dark:text-red-400">
                            {t('exam.matchingMissing')}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3 mb-6">
                        {Object.entries(currentQuestion.options).map(([key, value]) => {
                          const isSelected = currentAnswers.includes(key);
                          const orderIndex = isOrderQuestion ? currentAnswers.indexOf(key) : -1;
                          
                          return (
                            <motion.div
                              key={key}
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                              onClick={() => toggleAnswer(key)}
                              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                                isSelected
                                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                  : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-start">
                                  <span className={`font-bold mr-3 ${isSelected ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                    {key}
                                  </span>
                                  <span>{value}</span>
                                </div>
                                {isOrderQuestion && orderIndex >= 0 && (
                                  <span className="ml-3 text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                                    {t('exam.orderBadge', { order: orderIndex + 1 })}
                                  </span>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}

                    {isOrderQuestion && (
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {t('exam.selectedOrder', {
                            order: currentAnswers.length > 0 ? currentAnswers.join(' -> ') : t('exam.noneSelected')
                          })}
                        </div>
                        {currentAnswers.length > 0 && (
                          <button
                            onClick={clearAnswerOrder}
                            className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                          >
                            {t('exam.clearOrder')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {/* 操作按钮 */}
                <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-gray-700">
                  <button
                    onClick={prevQuestion}
                    disabled={currentQuestionIndex === 0}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      currentQuestionIndex === 0
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200'
                    }`}
                  >
                    <i className="fa-solid fa-arrow-left mr-1"></i> {t('exam.prev')}
                  </button>
                  
                  <button
                    onClick={submitExam}
                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                  >
                    <i className="fa-solid fa-paper-plane mr-1"></i> {t('exam.submit')}
                  </button>
                  
                  <button
                    onClick={nextQuestion}
                    disabled={currentQuestionIndex === questions.length - 1}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      currentQuestionIndex === questions.length - 1
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200'
                    }`}
                  >
                    {t('exam.next')} <i className="fa-solid fa-arrow-right ml-1"></i>
                  </button>
                </div>
              </div>
            </div>
          )}
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