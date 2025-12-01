import React, { useState, useEffect } from 'react';
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  FileText, 
  Settings, 
  Book,
  Type,
  Image as ImageIcon,
  Download,
  Zap
} from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
  onSkip: () => void;
}

interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  highlight?: string; // Селектор элемента для подсветки
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete, onSkip }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps: OnboardingStep[] = [
    {
      id: 0,
      title: 'Добро пожаловать в AI Word Editor!',
      description: 'Умный редактор документов с AI-ассистентом. Создавайте, редактируйте и форматируйте документы с помощью искусственного интеллекта.',
      icon: <Sparkles className="w-12 h-12 text-blue-500" />,
      position: 'center'
    },
    {
      id: 1,
      title: 'AI Помощник',
      description: 'Справа находится AI-ассистент. Задавайте вопросы, просите написать текст, отредактировать документ или сгенерировать изображение.',
      icon: <Sparkles className="w-8 h-8 text-blue-500" />,
      highlight: '[data-onboarding="assistant"]',
      position: 'left'
    },
    {
      id: 2,
      title: 'Богатый текстовый редактор',
      description: 'В центре находится редактор с полным форматированием: жирный, курсив, заголовки, списки, таблицы и многое другое.',
      icon: <Type className="w-8 h-8 text-blue-500" />,
      highlight: '[data-onboarding="editor"]',
      position: 'top'
    },
    {
      id: 3,
      title: 'Боковая панель',
      description: 'Слева находится боковая панель с настройками, базой знаний и статистикой документа. Откройте её, нажав на меню вверху.',
      icon: <Settings className="w-8 h-8 text-blue-500" />,
      highlight: '[data-onboarding="sidebar"]',
      position: 'right'
    },
    {
      id: 4,
      title: 'База знаний',
      description: 'Загружайте документы в базу знаний, чтобы AI использовал их как справочную информацию при ответах на ваши вопросы.',
      icon: <Book className="w-8 h-8 text-blue-500" />,
      position: 'center'
    },
    {
      id: 5,
      title: 'Экспорт документов',
      description: 'Экспортируйте ваши документы в различных форматах: HTML, Word (.docx), PDF. Используйте меню "Файл" в верхней панели.',
      icon: <Download className="w-8 h-8 text-blue-500" />,
      highlight: '[data-onboarding="file-menu"]',
      position: 'bottom'
    },
    {
      id: 6,
      title: 'Готовы начать!',
      description: 'Теперь вы знаете основы. Начните создавать документы с помощью AI-ассистента. Удачи!',
      icon: <Zap className="w-12 h-12 text-blue-500" />,
      position: 'center'
    }
  ];

  const currentStepData = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  };

  // Эффект для подсветки элементов
  useEffect(() => {
    if (currentStepData.highlight && currentStepData.position !== 'center') {
      const element = document.querySelector(currentStepData.highlight);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentStep, currentStepData]);

  const getTooltipPosition = (element?: Element) => {
    if (currentStepData.position === 'center') {
      return {
        position: 'fixed' as const,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    if (!element) return {};

    const rect = element.getBoundingClientRect();
    const gap = 16;

    switch (currentStepData.position) {
      case 'top':
        return {
          position: 'fixed' as const,
          left: rect.left + rect.width / 2,
          bottom: window.innerHeight - rect.top + gap,
          transform: 'translateX(-50%)',
        };
      case 'bottom':
        return {
          position: 'fixed' as const,
          left: rect.left + rect.width / 2,
          top: rect.bottom + gap,
          transform: 'translateX(-50%)',
        };
      case 'left':
        return {
          position: 'fixed' as const,
          right: window.innerWidth - rect.left + gap,
          top: rect.top + rect.height / 2,
          transform: 'translateY(-50%)',
        };
      case 'right':
        return {
          position: 'fixed' as const,
          left: rect.right + gap,
          top: rect.top + rect.height / 2,
          transform: 'translateY(-50%)',
        };
      default:
        return {};
    }
  };

  const tooltipContent = (
    <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-2xl border border-gray-200 dark:border-zinc-700 p-6 max-w-md w-full mx-4 relative z-[101]">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {currentStepData.icon}
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {currentStepData.title}
          </h3>
        </div>
        <button
          onClick={onSkip}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Description */}
      <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
        {currentStepData.description}
      </p>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex gap-1 mb-2">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-1 flex-1 rounded-full transition-colors ${
                index <= currentStep
                  ? 'bg-blue-500'
                  : 'bg-gray-200 dark:bg-zinc-700'
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Шаг {currentStep + 1} из {steps.length}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={handlePrev}
          disabled={isFirstStep}
          className={`
            px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2
            ${isFirstStep
              ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700'
            }
          `}
        >
          <ChevronLeft size={16} />
          Назад
        </button>

        <div className="flex gap-2">
          {!isLastStep && (
            <button
              onClick={onSkip}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              Пропустить
            </button>
          )}
          <button
            onClick={handleNext}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            {isLastStep ? 'Начать' : 'Далее'}
            {!isLastStep && <ChevronRight size={16} />}
          </button>
        </div>
      </div>
    </div>
  );

  // Получаем элемент для подсветки
  const highlightElement = currentStepData.highlight 
    ? document.querySelector(currentStepData.highlight)
    : null;

  const tooltipStyle = getTooltipPosition(highlightElement || undefined);

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 z-[99]" 
        onClick={onSkip}
      />
      
      {/* Highlight для элементов */}
      {highlightElement && currentStepData.position !== 'center' && (
        <div
          className="fixed z-[100] pointer-events-none"
          style={{
            left: highlightElement.getBoundingClientRect().left - 4,
            top: highlightElement.getBoundingClientRect().top - 4,
            width: highlightElement.getBoundingClientRect().width + 8,
            height: highlightElement.getBoundingClientRect().height + 8,
            border: '3px solid #3b82f6',
            borderRadius: '8px',
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
          }}
        />
      )}

      {/* Tooltip */}
      <div style={tooltipStyle}>
        {tooltipContent}
      </div>
    </>
  );
};

export default Onboarding;

