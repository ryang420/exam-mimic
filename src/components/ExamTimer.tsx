import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ExamTimerProps {
  durationInMinutes: number;
  onTimeUp: () => void;
  isRunning: boolean;
}

export const ExamTimer: React.FC<ExamTimerProps> = ({ 
  durationInMinutes, 
  onTimeUp,
  isRunning
}) => {
  const { t } = useTranslation();
  const [timeRemaining, setTimeRemaining] = useState(durationInMinutes * 60);
  
  useEffect(() => {
    if (!isRunning) return;
    
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [isRunning, onTimeUp]);
  
  // 重置计时器
  useEffect(() => {
    setTimeRemaining(durationInMinutes * 60);
  }, [durationInMinutes]);
  
  // 格式化时间
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // 确定时间剩余的状态颜色
  const getTimeStatusColor = (): string => {
    const totalSeconds = durationInMinutes * 60;
    const remainingPercentage = (timeRemaining / totalSeconds) * 100;
    
    if (remainingPercentage < 10) return 'text-red-500';
    if (remainingPercentage < 25) return 'text-yellow-500';
    return 'text-green-500';
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 p-4 flex items-center">
      <div className={`text-2xl font-mono font-bold ${getTimeStatusColor()} mr-4`}>
        {formatTime(timeRemaining)}
      </div>
      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-1000 ease-in-out ${getTimeStatusColor().replace('text-', 'bg-')}`}
          style={{ 
            width: `${(timeRemaining / (durationInMinutes * 60)) * 100}%` 
          }}
        ></div>
      </div>
      <div className="ml-4 text-sm text-gray-600 dark:text-gray-400">
        {t('examTimer.remaining')}
      </div>
    </div>
  );
};