
import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Assistant from './components/Assistant';
import RichTextEditor from './components/RichTextEditor';
import UserSelector from './components/UserSelector';
import Onboarding from './components/Onboarding';
import { AIConfig, ChatMessage, KnowledgeBaseItem, UploadedFile, AIResponse } from './types';
import { generateGeminiResponse, generateGeminiImage, generateVLLMResponse, rewriteText, generateDeterministicChart, generateDeterministicTable, translateText } from './services/aiService';
import { userStorage, hasCompletedOnboarding, markOnboardingComplete, resetOnboarding } from './services/userService';
import { DEFAULT_GEMINI_MODELS } from './constants';
import { Menu, X, Download, FileText, FileType, File, FilePlus, FolderOpen, Save, ChevronRight } from 'lucide-react';

// Declare global variables for CDN libraries
declare global {
  interface Window {
    html2pdf: any;
    htmlDocx: any;
    saveAs: any;
    mammoth: any;
  }
}

const INITIAL_CONFIG: AIConfig = {
  provider: 'gemini',
  textModel: DEFAULT_GEMINI_MODELS.TEXT,
  imageModel: DEFAULT_GEMINI_MODELS.IMAGE_GEN,
  visionModel: DEFAULT_GEMINI_MODELS.VISION,
  vllm: {
    baseUrl: 'http://localhost:8000',
    apiKey: ''
  }
};

export default function App() {
  // Загружаем данные из изолированного хранилища пользователя
  const [config, setConfig] = useState<AIConfig>(() => {
    try {
      const savedConfig = userStorage.getItem('config');
      return savedConfig ? { ...INITIAL_CONFIG, ...JSON.parse(savedConfig) } : INITIAL_CONFIG;
    } catch (e) {
      return INITIAL_CONFIG;
    }
  });
  
  const [kbItems, setKbItems] = useState<KnowledgeBaseItem[]>(() => {
    try {
      const savedKB = userStorage.getItem('kb_items');
      return savedKB ? JSON.parse(savedKB) : [];
    } catch (e) {
      return [];
    }
  });
  
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    try {
      const savedMessages = userStorage.getItem('chat_messages');
      return savedMessages ? JSON.parse(savedMessages) : [];
    } catch (e) {
      return [];
    }
  });
  
  const [isThinking, setIsThinking] = useState(false);
  
  // Миграция старых данных из localStorage (для обратной совместимости)
  useEffect(() => {
    try {
      // Проверяем, есть ли старые данные без префикса пользователя
      const oldContent = localStorage.getItem('ai_editor_content');
      const oldTitle = localStorage.getItem('ai_document_title');
      
      // Если есть старые данные и их еще нет в userStorage, переносим их
      const currentContent = userStorage.getItem('editor_content');
      if (oldContent && !currentContent) {
        userStorage.setItem('editor_content', oldContent);
        setEditorContent(oldContent);
        // Удаляем старые данные
        localStorage.removeItem('ai_editor_content');
      }
      
      if (oldTitle && !userStorage.getItem('document_title')) {
        userStorage.setItem('document_title', oldTitle);
        setDocumentTitle(oldTitle);
        localStorage.removeItem('ai_document_title');
      }
    } catch (e) {
      console.error("Failed to migrate old data", e);
    }
  }, []);
  
  // Editor State with User Storage init
  const [editorContent, setEditorContent] = useState(() => {
    try {
      return userStorage.getItem('editor_content') || '';
    } catch (e) {
      return '';
    }
  });

  const [documentTitle, setDocumentTitle] = useState(() => {
    try {
      return userStorage.getItem('document_title') || 'Untitled Document';
    } catch (e) {
      return 'Untitled Document';
    }
  });
  
  const [isDark, setIsDark] = useState(() => {
    try {
      const savedTheme = userStorage.getItem('theme');
      return savedTheme === 'dark';
    } catch (e) {
      return false;
    }
  });

  // Key to force re-mounting of editor when loading new files
  const [editorKey, setEditorKey] = useState(0);
  
  // Trigger for AI automatic updates
  const [triggerReplace, setTriggerReplace] = useState<{ content: string; timestamp: number } | null>(null);
  const [triggerInsertHtml, setTriggerInsertHtml] = useState<{ html: string; timestamp: number } | null>(null);
  
  // Stats & Persistence
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [stats, setStats] = useState({ words: 0, chars: 0 });

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isAssistantOpen, setAssistantOpen] = useState(true); // AI помощник открыт по умолчанию
  const [showFileMenu, setShowFileMenu] = useState(false);
  
  // Онбординг
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !hasCompletedOnboarding();
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOnboardingComplete = () => {
    markOnboardingComplete();
    setShowOnboarding(false);
  };

  const handleOnboardingSkip = () => {
    markOnboardingComplete();
    setShowOnboarding(false);
  };

  const handleRestartOnboarding = () => {
    resetOnboarding();
    setShowOnboarding(true);
  };

  // Боковая панель скрыта по умолчанию
  // AI помощник открыт по умолчанию
  // Пользователь может открыть/закрыть их вручную

  // Theme Handling
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    // Сохраняем тему
    userStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);
  
  // Сохранение конфигурации
  useEffect(() => {
    userStorage.setItem('config', JSON.stringify(config));
  }, [config]);
  
  // Сохранение базы знаний
  useEffect(() => {
    userStorage.setItem('kb_items', JSON.stringify(kbItems));
  }, [kbItems]);
  
  // Сохранение сообщений чата
  useEffect(() => {
    userStorage.setItem('chat_messages', JSON.stringify(chatMessages));
  }, [chatMessages]);

  // Autosave & Stats Calculation
  useEffect(() => {
    // Calculate stats
    const plainText = editorContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    setStats({
      words: plainText.length > 0 ? plainText.split(' ').length : 0,
      chars: plainText.length
    });

    // Debounced Save
    const timer = setTimeout(() => {
      try {
        userStorage.setItem('editor_content', editorContent);
        userStorage.setItem('document_title', documentTitle);
        setLastSaved(new Date());
      } catch (e) {
        console.error("Failed to save to user storage", e);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [editorContent, documentTitle]);

  const handleSendMessage = async (text: string, files: UploadedFile[]) => {
    // Add user message
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      attachments: files,
      timestamp: Date.now()
    };
    setChatMessages(prev => [...prev, userMsg]);
    setIsThinking(true);

    try {
      let aiResult: AIResponse = { text: "" };
      let generatedAttachments: UploadedFile[] = [];

      // Check for image generation request using basic heuristic
      const lowerText = text.toLowerCase();
      const isImageRequest = (lowerText.includes('сгенерируй') || lowerText.includes('создай') || lowerText.includes('нарисуй')) && 
                             (lowerText.includes('картинку') || lowerText.includes('изображение') || lowerText.includes('график') || lowerText.includes('диаграм') || lowerText.includes('схем') || lowerText.includes('инфографик'));

      if (isImageRequest && config.provider === 'gemini') {
          // Image Gen Flow (Only supported on Gemini in this app)
          try {
              const base64Image = await generateGeminiImage(text);
              if (base64Image) {
                  // Instead of setting text to base64, we describe it and attach it
                  aiResult = { text: "Изображение сгенерировано и автоматически вставлено в документ." };
                  
                  // Insert directly into editor using state trigger
                  const imgHtml = `<img src="${base64Image}" style="max-width: 100%; height: auto;" />`;
                  setTriggerInsertHtml({ html: imgHtml, timestamp: Date.now() });

                  // Add to chat attachments for history view
                  generatedAttachments.push({
                      id: Date.now().toString(),
                      name: 'generated_image.png',
                      type: 'image',
                      content: base64Image,
                      mimeType: 'image/png'
                  });
              } else {
                  aiResult = { text: "Не удалось сгенерировать изображение. Модель не вернула данных." };
              }
          } catch (imgError: any) {
              console.error("Image Gen Error:", imgError);
              // Используем сообщение об ошибке из функции generateGeminiImage
              // Оно уже содержит подробную информацию о проблеме и решениях
              aiResult = { text: imgError.message || `Ошибка при генерации изображения: ${imgError.toString()}` };
          }
      } else {
          // Text/Vision Flow
          const referenceDoc = kbItems.find(k => k.type === 'reference') || null;
          
          if (config.provider === 'gemini') {
            aiResult = await generateGeminiResponse(
              text, 
              files, 
              config, 
              kbItems, 
              referenceDoc,
              [], // History
              editorContent // Pass current document content for context
            );
          } else {
            // vLLM Flow
            aiResult = await generateVLLMResponse(
                text,
                config,
                kbItems,
                referenceDoc,
                editorContent
            );
          }
      }

      // Handle AI Actions (Direct Edits)
      const isAction = !!(aiResult.action && aiResult.action.type === 'replace');
      
      if (isAction && aiResult.action) {
          setTriggerReplace({ 
              content: aiResult.action.content, 
              timestamp: Date.now() 
          });
      }

      // Create Model Message
      const modelMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: aiResult.text,
        timestamp: Date.now(),
        isAction: isAction,
        attachments: generatedAttachments.length > 0 ? generatedAttachments : undefined
      };
      
      setChatMessages(prev => [...prev, modelMsg]);

    } catch (e: any) {
      console.error(e);
       const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: `Произошла ошибка при обработке запроса: ${e.message}`,
        timestamp: Date.now(),
        isError: true
      };
      setChatMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleInsertText = (text: string) => {
      // Convert newlines to breaks to ensure they appear in HTML, 
      // otherwise insertHTML might collapse them.
      const formatted = text.replace(/\n/g, '<br/>');
      setTriggerInsertHtml({ html: formatted, timestamp: Date.now() });
  };

  const handleReplaceContent = (text: string) => {
      if (window.confirm("Вы уверены, что хотите полностью заменить содержимое документа ответом нейросети?")) {
        setTriggerReplace({ content: text, timestamp: Date.now() });
      }
  };

  const handleInsertImage = (base64: string) => {
      const imgHtml = `<img src="${base64}" style="max-width: 100%; height: auto;" />`;
      setTriggerInsertHtml({ html: imgHtml, timestamp: Date.now() });
  }
  
  // Handler for Inline Smart Edit
  const handleSmartEdit = async (text: string, instruction: string): Promise<string> => {
      // Check if this is a table generation request (heuristically)
      if (instruction.includes('HTML таблицу')) {
          return generateDeterministicTable(text);
      }
      return await rewriteText(text, instruction, config);
  };

  // Handler for Inline Visual Generation (Now Deterministic/Algorithmic)
  const handleGenerateInlineImage = async (text: string, type: 'chart' | 'diagram' | 'chart-bar' | 'chart-line' | 'chart-pie'): Promise<string | null> => {
      // Use deterministic generation instead of AI
      return generateDeterministicChart(text, type);
  };

  const handleTranslateInline = async (text: string, language: string): Promise<string> => {
      return await translateText(text, language, config);
  };

  // --- File Menu Handlers ---

  const handleNewDocument = () => {
    if (confirm("Вы уверены? Несохраненные изменения будут потеряны. Текущий документ будет очищен.")) {
      setEditorContent('');
      setDocumentTitle('Untitled Document');
      userStorage.removeItem('editor_content');
      userStorage.setItem('document_title', 'Untitled Document');
      setEditorKey(prev => prev + 1); // Force re-render
      setShowFileMenu(false);
    }
  };

  const handleOpenClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Reset so onChange triggers even for same file
      fileInputRef.current.click();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const filename = file.name.toLowerCase();

      // DOCX Handler
      if (filename.endsWith('.docx')) {
         const reader = new FileReader();
         reader.onload = (ev) => {
            const arrayBuffer = ev.target?.result as ArrayBuffer;
            if (window.mammoth) {
                window.mammoth.convertToHtml({ arrayBuffer: arrayBuffer })
                    .then((result: any) => {
                        setEditorContent(result.value);
                        setDocumentTitle(file.name.replace(/\.docx$/i, ''));
                        setEditorKey(prev => prev + 1); // Force re-render
                        setShowFileMenu(false);
                        // Очищаем input после обработки
                        if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                        }
                    })
                    .catch((err: any) => {
                        console.error(err);
                        alert("Ошибка при чтении файла Word.");
                        // Очищаем input даже при ошибке
                        if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                        }
                    });
            } else {
                alert("Библиотека Mammoth не загружена.");
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            }
         };
         reader.readAsArrayBuffer(file);
         return;
      }

      // HTML/TXT/DOC (Text-based) Handler
      const reader = new FileReader();
      reader.onload = (ev) => {
        let content = ev.target?.result as string;

        // Basic check for binary data to prevent loading garbage
        if (content.includes('\0')) {
             alert("Формат .doc (бинарный) не поддерживается в браузере. Пожалуйста, используйте .docx или текстовые файлы.");
             // Очищаем input при ошибке
             if (fileInputRef.current) {
                 fileInputRef.current.value = '';
             }
             return;
        }
        
        // Extract body if it's a full HTML document (e.g. from our own Export)
        const bodyMatch = content.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        if (bodyMatch && bodyMatch[1]) {
            content = bodyMatch[1];
        }

        setEditorContent(content);
        setDocumentTitle(file.name.replace(/\.(html|txt|doc|docx)$/i, ''));
        setEditorKey(prev => prev + 1); // Force re-render
        setShowFileMenu(false);
        // Очищаем input после обработки
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
      };
      reader.readAsText(file);
    }
  };

  const handleSaveHTML = () => {
     // Open HTML in new tab instead of downloading
     const fullHTML = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${documentTitle}</title></head><body>${editorContent}</body></html>`;
     const blob = new Blob([fullHTML], { type: "text/html;charset=utf-8" });
     const url = URL.createObjectURL(blob);
     const newWindow = window.open(url, '_blank');
     // Освобождаем URL после открытия (с небольшой задержкой для надежности)
     setTimeout(() => {
         if (newWindow) {
             newWindow.onload = () => URL.revokeObjectURL(url);
         } else {
             URL.revokeObjectURL(url);
         }
     }, 1000);
     setShowFileMenu(false);
  };

  const handleExport = (format: 'pdf' | 'doc' | 'docx') => {
    setShowFileMenu(false);
    const filename = documentTitle.trim() || 'document';
    
    if (format === 'pdf') {
        const element = document.querySelector('.editor-content');
        const opt = {
          margin: [25, 25, 25, 25], // mm to roughly match margins
          filename: `${filename}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        if (window.html2pdf) {
            // Используем output для получения blob вместо прямого сохранения
            window.html2pdf().set(opt).from(element).output('blob').then((pdfBlob: Blob) => {
                const url = URL.createObjectURL(pdfBlob);
                const newWindow = window.open(url, '_blank');
                // Освобождаем URL после открытия
                setTimeout(() => {
                    if (newWindow) {
                        newWindow.onload = () => URL.revokeObjectURL(url);
                    } else {
                        URL.revokeObjectURL(url);
                    }
                }, 1000);
            }).catch((err: any) => {
                console.error('PDF generation error:', err);
                // Fallback к обычному сохранению при ошибке
                window.html2pdf().set(opt).from(element).save();
            });
        } else {
            alert('Библиотека PDF не загружена.');
        }
    } else if (format === 'doc') {
        // Open in new tab instead of downloading
        const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' "+
            "xmlns:w='urn:schemas-microsoft-com:office:word' "+
            "xmlns='http://www.w3.org/TR/REC-html40'>"+
            "<head><meta charset='utf-8'><title>Export HTML to Word Document with JavaScript</title></head><body>";
        const footer = "</body></html>";
        const sourceHTML = header + editorContent + footer;
        
        const blob = new Blob([sourceHTML], { type: "application/msword" });
        const url = URL.createObjectURL(blob);
        const newWindow = window.open(url, '_blank');
        // Освобождаем URL после открытия
        setTimeout(() => {
            if (newWindow) {
                newWindow.onload = () => URL.revokeObjectURL(url);
            } else {
                URL.revokeObjectURL(url);
            }
        }, 1000);

    } else if (format === 'docx') {
        // Use html-docx-js to generate a real docx
        if (window.htmlDocx) {
             const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${editorContent}</body></html>`;
             const converted = window.htmlDocx.asBlob(html);
             // Открываем в новой вкладке вместо скачивания
             const url = URL.createObjectURL(converted);
             const newWindow = window.open(url, '_blank');
             // Освобождаем URL после открытия
             setTimeout(() => {
                 if (newWindow) {
                     newWindow.onload = () => URL.revokeObjectURL(url);
                 } else {
                     URL.revokeObjectURL(url);
                 }
             }, 1000);
        } else {
             alert('Библиотека DOCX не загружена.');
        }
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100 dark:bg-black text-slate-900 dark:text-slate-100 font-sans">
      {/* Onboarding Overlay */}
      {showOnboarding && (
        <Onboarding 
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
        />
      )}
      
      {/* Sidebar - Slide out on Mobile, Collapsible on Desktop */}
      <div className={`
        fixed inset-y-0 left-0 z-50 transform 
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
        transition-all duration-300 ease-in-out
        md:relative md:transform-none
        ${isSidebarOpen ? 'md:w-80' : 'md:w-0 md:border-none'}
        md:overflow-hidden
        bg-gray-50 dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-700
      `}
      data-onboarding="sidebar"
      >
         <Sidebar 
           config={config} 
           onConfigChange={setConfig} 
           kbItems={kbItems}
           onAddKB={(item) => setKbItems(prev => [...prev, item])}
           onRemoveKB={(id) => setKbItems(prev => prev.filter(k => k.id !== id))}
           isDark={isDark}
           toggleTheme={() => setIsDark(!isDark)}
           stats={{
             wordCount: stats.words,
             charCount: stats.chars,
             lastSaved: lastSaved
           }}
           onRestartOnboarding={handleRestartOnboarding}
         />
         <button 
            onClick={() => setSidebarOpen(false)} 
            className="md:hidden absolute top-2 right-2 p-2 bg-white dark:bg-zinc-800 rounded-full shadow border border-gray-200 dark:border-zinc-700 text-gray-500"
         >
             <X size={16}/>
         </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <header className="h-14 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700 flex items-center px-4 justify-between shrink-0 relative z-50">
          <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
             <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 text-gray-500 shrink-0"><Menu size={20}/></button>
             
             {/* File Menu */}
             <div className="relative">
                 <button 
                     onClick={() => setShowFileMenu(!showFileMenu)}
                     className="flex items-center gap-1 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-md text-sm font-medium transition-colors"
                     data-onboarding="file-menu"
                 >
                     <span className="font-semibold text-blue-600 dark:text-blue-400">Файл</span>
                 </button>

                 {showFileMenu && (
                     <div className="absolute left-0 top-full mt-1 w-56 bg-white dark:bg-zinc-800 rounded-md shadow-lg border border-gray-200 dark:border-zinc-700 z-50 py-1">
                         <button onClick={handleNewDocument} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-zinc-700 flex items-center gap-3">
                             <FilePlus size={16} className="text-gray-500 dark:text-gray-400"/> Создать
                         </button>
                         <button onClick={handleOpenClick} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-zinc-700 flex items-center gap-3">
                             <FolderOpen size={16} className="text-gray-500 dark:text-gray-400"/> Открыть...
                         </button>
                         <button onClick={handleSaveHTML} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-zinc-700 flex items-center gap-3">
                             <Save size={16} className="text-gray-500 dark:text-gray-400"/> Сохранить (.html)
                         </button>
                         
                         <div className="border-t border-gray-200 dark:border-zinc-700 my-1"></div>
                         
                         <div className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Экспорт</div>
                         
                         <button onClick={() => handleExport('docx')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-zinc-700 flex items-center gap-3">
                            <FileText size={16} className="text-blue-600"/> Word (.docx)
                         </button>
                         <button onClick={() => handleExport('doc')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-zinc-700 flex items-center gap-3">
                            <File size={16} className="text-blue-500"/> Word 97-2003
                         </button>
                         <button onClick={() => handleExport('pdf')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-zinc-700 flex items-center gap-3">
                            <FileType size={16} className="text-red-500"/> PDF Document
                         </button>
                     </div>
                 )}
                 {/* Hidden File Input for Open */}
                 <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".html,.txt,.docx,.doc" />
             </div>

             <div className="h-6 w-px bg-gray-300 dark:bg-zinc-700 mx-1 hidden sm:block"></div>

             <input 
               type="text" 
               value={documentTitle}
               onChange={(e) => setDocumentTitle(e.target.value)}
               className="text-base sm:text-lg font-serif font-bold text-gray-800 dark:text-gray-100 bg-transparent border-none focus:ring-0 focus:outline-none placeholder-gray-400 w-full min-w-[100px] truncate"
               placeholder="Untitled Document"
             />
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <UserSelector />
            <button 
                onClick={() => setAssistantOpen(!isAssistantOpen)} 
                className={`p-2 rounded-md transition-colors ${isAssistantOpen ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' : 'text-gray-500'}`}
            >
                {isAssistantOpen ? (window.innerWidth < 768 ? 'AI' : 'Скрыть') : 'AI'}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-hidden relative">
           {/* Overlay for File Menu click outside */}
           {showFileMenu && <div className="fixed inset-0 z-40" onClick={() => setShowFileMenu(false)}></div>}
           
           <div data-onboarding="editor" className="h-full w-full">
             <RichTextEditor 
               key={editorKey}
               initialContent={editorContent} 
               onChange={setEditorContent} 
               className="h-full w-full"
               triggerReplace={triggerReplace}
               triggerInsertHtml={triggerInsertHtml}
               onSmartEdit={handleSmartEdit}
               onGenerateImage={handleGenerateInlineImage}
               onTranslate={handleTranslateInline}
             />
           </div>
        </main>
      </div>

      {/* Assistant Panel - Full overlay on mobile, Sidebar on Desktop */}
      {isAssistantOpen && (
        <div className={`
          fixed inset-0 z-50 bg-white dark:bg-zinc-800 
          md:relative md:inset-auto md:w-96 md:shrink-0 md:border-l md:border-gray-200 md:dark:border-zinc-700 md:z-40
          shadow-xl flex flex-col
        `}
        data-onboarding="assistant"
        >
           <Assistant 
             messages={chatMessages}
             isThinking={isThinking}
             onSendMessage={handleSendMessage}
             onInsertText={handleInsertText}
             onInsertImage={handleInsertImage}
             onReplaceContent={handleReplaceContent}
             onClose={() => setAssistantOpen(false)}
             onClearChat={() => {
               setChatMessages([]);
               userStorage.setItem('chat_messages', JSON.stringify([]));
             }}
           />
        </div>
      )}
    </div>
  );
}
