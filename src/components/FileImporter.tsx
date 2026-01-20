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

  // 解析文件内容
  const parseFileContent = (content: string): Question[] => {
    const questions: Question[] = [];
    
    try {
      // 预处理内容，确保换行符统一
      const normalizedContent = content.replace(/\r\n/g, '\n');
      
      // 使用正则表达式分割题目块，考虑到题目之间用"---"分隔的情况
      // 匹配以"## Question X"开头的块，直到下一个"## Question X"或文件结束
      const questionMatches = normalizedContent.match(/## Question \d+[\s\S]*?(?=## Question \d+|$)/g) || [];
      
      console.log(`找到 ${questionMatches.length} 个题目块`);
      
      questionMatches.forEach((block, index) => {
        try {
          const trimmedBlock = block.trim();
          
          // 提取题目编号
          const numberMatch = trimmedBlock.match(/## Question (\d+)/);
          const number = numberMatch ? parseInt(numberMatch[1], 10) : (index + 1);
          
          // 提取题干 - 改进的正则表达式，适应可能的格式变化
          const questionMatch = trimmedBlock.match(/\*\*Question\*\*\s*([\s\S]*?)(?=\*\*Options\*\*|\*\*Correct Answer\*\*|\*\*Explanation\*\*|\-\-\-|$)/i);
          const questionText = questionMatch ? questionMatch[1].trim() : '';
          
          // 提取选项 - 改进的正则表达式
          const options: Record<string, string> = {};
          const optionsMatch = trimmedBlock.match(/\*\*Options\*\*\s*([\s\S]*?)(?=\*\*Correct Answer\*\*|\*\*Explanation\*\*|\-\-\-|$)/i);
          
          if (optionsMatch) {
            const optionsText = optionsMatch[1].trim();
            // 匹配选项行 (A. 选项内容)，改进以处理可能的空格变化
            const optionLines = optionsText.match(/^[A-Z]\.\s+.+$/gm) || [];
            
            console.log(`题目 ${number} 找到 ${optionLines.length} 个选项`);
            
            optionLines.forEach(line => {
              const keyMatch = line.match(/^([A-Z])\./);
              if (keyMatch) {
                const key = keyMatch[1];
                const value = line.substring(key.length + 1).trim();
                options[key] = value;
              }
            });
          }
          
          // 提取正确答案 - 改进的正则表达式
          const answerMatch = trimmedBlock.match(/\*\*Correct Answer\*\*\s*([\s\S]*?)(?=\*\*Explanation\*\*|\-\-\-|$)/i);
          let correctAnswers: string[] = [];
          
          if (answerMatch) {
            const answerText = answerMatch[1].trim();
            // 检查是否有多个答案（用逗号、空格或"and"分隔）
            if (answerText.includes(',') || answerText.includes(' and ')) {
              // 处理逗号分隔或"and"分隔的多个答案
              correctAnswers = answerText
                .replace(/\s*and\s*/gi, ',') // 将"and"替换为逗号
                .split(',')
                .map(ans => ans.trim())
                .filter(ans => ans !== '');
            } else {
              // 单个答案
              correctAnswers = [answerText.trim()];
            }
          }
          
          // 提取解析 - 改进的正则表达式
          const explanationMatch = trimmedBlock.match(/\*\*Explanation\*\*\s*([\s\S]*?)(?=\-\-\-|$)/i);
          const explanation = explanationMatch ? explanationMatch[1].trim() : '';
          
          console.log(`题目 ${number} 解析结果: 题干=${!!questionText}, 选项数=${Object.keys(options).length}, 正确答案数=${correctAnswers.length}`);
          
          // 只有当所有必要字段都存在时才添加题目
          if (questionText && Object.keys(options).length > 0 && correctAnswers.length > 0) {
            questions.push({
              id: `q-${Date.now()}-${index}`,
              number,
              question: questionText,
              options,
              correctAnswer: correctAnswers,
              explanation,
              isMultipleChoice: correctAnswers.length > 1
            });
          } else {
            console.warn(`题目 ${number} 缺少必要字段，跳过导入`);
          }
        } catch (error) {
          console.error(`解析题目 ${index + 1} 时出错:`, error);
        }
      });
      
      console.log(`成功解析 ${questions.length} 道题目`);
    } catch (error) {
      console.error('文件解析过程中发生错误:', error);
      toast.error('文件解析过程中发生错误');
    }
    
    return questions;
  };

  // 处理文件上传
  const handleFileUpload = (file: File) => {
    if (!file.name.endsWith('.txt') && !file.name.endsWith('.md')) {
      toast.error('请上传文本文件 (.txt) 或 Markdown 文件 (.md)');
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
      accept=".txt,.md"
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
              支持 .txt 或 .md 格式文件，每道题以 "## Question 序号" 分隔
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
            <span>每道题以 "## Question 序号" 开始</span>
          </li>
          <li className="flex items-start">
            <i className="fa-solid fa-check-circle text-green-500 mt-1 mr-2"></i>
            <span>题目内容以 "**Question**" 标记开始</span>
          </li>
          <li className="flex items-start">
            <i className="fa-solid fa-check-circle text-green-500 mt-1 mr-2"></i>
            <span>选项以 "**Options**" 标记开始，每个选项格式为 "A. 选项内容"</span>
          </li>
          <li className="flex items-start">
            <i className="fa-solid fa-check-circle text-green-500 mt-1 mr-2"></i>
            <span>正确答案以 "**Correct Answer**" 标记开始</span>
          </li>
          <li className="flex items-start">
            <i className="fa-solid fa-check-circle text-green-500 mt-1 mr-2"></i>
            <span>解析以 "**Explanation**" 标记开始</span>
          </li>
          <li className="flex items-start">
            <i className="fa-solid fa-check-circle text-green-500 mt-1 mr-2"></i>
            <span>题目之间用 "---" 分隔</span>
          </li>
        </ul>
      </div>
    </div>
  );
};