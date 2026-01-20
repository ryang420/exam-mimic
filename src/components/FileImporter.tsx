import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Question } from '@/types';

interface FileImporterProps {
  onImport: (questions: Question[]) => void;
}

export const FileImporter: React.FC<FileImporterProps> = ({ onImport }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // 解析文件内容（仅支持 CSV）
  const parseFileContent = (content: string): Question[] => {
    const questions: Question[] = [];

    const parseCsv = (text: string): string[][] => {
      const rows: string[][] = [];
      let row: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        const next = text[i + 1];

        if (char === '"') {
          if (inQuotes && next === '"') {
            current += '"';
            i += 1;
          } else {
            inQuotes = !inQuotes;
          }
          continue;
        }

        if (char === ',' && !inQuotes) {
          row.push(current);
          current = '';
          continue;
        }

        if (char === '\n' && !inQuotes) {
          row.push(current);
          rows.push(row);
          row = [];
          current = '';
          continue;
        }

        if (char !== '\r') {
          current += char;
        }
      }

      if (current.length > 0 || row.length > 0) {
        row.push(current);
        rows.push(row);
      }

      return rows;
    };

    try {
      const normalizedContent = content.replace(/\r\n/g, '\n');
      const rows = parseCsv(normalizedContent);
      if (rows.length <= 1) {
        return [];
      }

      const headers = rows[0].map((header) => header.trim());
      const indexMap = new Map(headers.map((header, index) => [header, index]));

      const questionIndex = indexMap.get('Question');
      const questionTextIndex = indexMap.get('Question Text');
      const optionsIndex = indexMap.get('Options');
      const correctAnswerIndex = indexMap.get('Correct Answer');
      const explanationIndex = indexMap.get('Explanation');

      if (
        questionIndex === undefined ||
        questionTextIndex === undefined ||
        optionsIndex === undefined ||
        correctAnswerIndex === undefined ||
        explanationIndex === undefined
      ) {
        toast.error('CSV 表头不符合要求');
        return [];
      }

      rows.slice(1).forEach((row, index) => {
        const questionNumber = row[questionIndex]?.trim();
        const questionText = row[questionTextIndex]?.trim();
        const optionsRaw = row[optionsIndex]?.trim();
        const correctRaw = row[correctAnswerIndex]?.trim();
        const explanation = row[explanationIndex]?.trim() || '';

        if (!questionNumber && !questionText && !optionsRaw && !correctRaw && !explanation) {
          return;
        }

        let options: Record<string, string> = {};
        try {
          options = optionsRaw ? JSON.parse(optionsRaw) : {};
        } catch (error) {
          console.warn(`题目 ${questionNumber || index + 1} 选项解析失败`, error);
        }

        let correctAnswers: string[] = [];
        if (correctRaw) {
          const normalizedAnswers = correctRaw
            .replace(/\s*(and|&)\s*/gi, ',')
            .replace(/\s+/g, ' ')
            .trim();
          correctAnswers = normalizedAnswers
            .split(/[,/]+/)
            .map(ans => ans.trim())
            .filter(ans => ans !== '');
        }

        const number = Number.parseInt(questionNumber || `${index + 1}`, 10);

        if (questionText && Object.keys(options).length > 0 && correctAnswers.length > 0) {
          questions.push({
            id: `q-${Date.now()}-${index}`,
            number: Number.isNaN(number) ? index + 1 : number,
            question: questionText,
            options,
            correctAnswer: correctAnswers,
            explanation,
            isMultipleChoice: correctAnswers.length > 1
          });
        } else {
          console.warn(`题目 ${questionNumber || index + 1} 缺少必要字段，跳过导入`);
        }
      });
    } catch (error) {
      console.error('文件解析过程中发生错误:', error);
      toast.error('文件解析过程中发生错误');
    }

    return questions;
  };

  // 处理文件上传
  const handleFileUpload = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('请上传 CSV 文件 (.csv)');
      return;
    }
    
    setIsLoading(true);
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const questions = parseFileContent(content);
        
        if (questions.length > 0) {
          onImport(questions);
          toast.success(`成功导入 ${questions.length} 道题目`);
        } else {
          toast.warning('未解析到有效题目，请检查文件格式');
        }
      } catch (error) {
        toast.error('文件解析失败');
        console.error('文件解析错误:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    reader.onerror = () => {
      toast.error('文件读取失败');
      setIsLoading(false);
    };
    
    reader.readAsText(file);
  };

  // 处理拖拽事件
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  // 触发文件选择
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
      type="file"
      accept=".csv"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <div
        onClick={triggerFileInput}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          w-full h-64 rounded-2xl border-2 border-dashed
          flex flex-col items-center justify-center cursor-pointer
          transition-all duration-300 ease-in-out
          ${isDragOver 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
            : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 hover:border-blue-400 dark:hover:border-blue-500'}
        `}
      >
        {isLoading ? (
          <>
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p className="text-gray-700 dark:text-gray-300 font-medium">正在解析文件...</p>
          </>
        ) : (
          <>
            <div className="text-5xl text-blue-500 mb-4">
              <i className="fa-solid fa-cloud-arrow-up"></i>
            </div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">
              拖放文件到此处或点击上传
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
              支持 .csv 格式文件，表头需包含 Question / Question Text / Options / Correct Answer / Explanation
            </p>
          </>
        )}
      </div>
      
      <div className="mt-6 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
        <h4 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">
          <i className="fa-solid fa-circle-info text-blue-500 mr-2"></i>
          文件格式要求
        </h4>
        <ul className="text-gray-600 dark:text-gray-400 space-y-2">
          <li className="flex items-start">
            <i className="fa-solid fa-check-circle text-green-500 mt-1 mr-2"></i>
            <span>文件必须为 CSV 格式</span>
          </li>
          <li className="flex items-start">
            <i className="fa-solid fa-check-circle text-green-500 mt-1 mr-2"></i>
            <span>表头包含 Question / Question Text / Options / Correct Answer / Explanation</span>
          </li>
          <li className="flex items-start">
            <i className="fa-solid fa-check-circle text-green-500 mt-1 mr-2"></i>
            <span>Options 字段是 JSON 字符串，如 {'{"A":"选项A","B":"选项B"}'}</span>
          </li>
          <li className="flex items-start">
            <i className="fa-solid fa-check-circle text-green-500 mt-1 mr-2"></i>
            <span>Correct Answer 支持单个或多个，如 "D" 或 "A, C"</span>
          </li>
          <li className="flex items-start">
            <i className="fa-solid fa-check-circle text-green-500 mt-1 mr-2"></i>
            <span>Explanation 为题目解析文本</span>
          </li>
          <li className="flex items-start">
            <i className="fa-solid fa-check-circle text-green-500 mt-1 mr-2"></i>
            <span>空行将被忽略</span>
          </li>
        </ul>
      </div>
    </div>
  );
};