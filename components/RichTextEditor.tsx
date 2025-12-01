import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  Bold, Italic, Underline, Strikethrough, 
  List, ListOrdered, 
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Indent, Outdent,
  Undo, Redo, 
  Heading1, Heading2, Heading3,
  Palette, Highlighter, Eraser,
  Subscript, Superscript,
  Sparkles,
  ArrowRight,
  Table as TableIcon,
  PieChart,
  Network,
  BarChart,
  LineChart,
  PaintRoller,
  Languages,
  ChevronDown,
  Grid3x3,
  Box,
  PaintBucket,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown as ArrowDownIcon,
  ArrowLeft,
  ArrowRight as ArrowRightIcon,
  Layout,
  Minimize2,
  Maximize2
} from 'lucide-react';
import ParagraphDialog from './ParagraphDialog';

interface RichTextEditorProps {
  initialContent: string;
  onChange: (html: string) => void;
  className?: string;
  triggerReplace?: { content: string; timestamp: number } | null;
  triggerInsertHtml?: { html: string; timestamp: number } | null;
  onSmartEdit?: (text: string, instruction: string) => Promise<string>;
  onGenerateImage?: (text: string, type: 'chart' | 'diagram' | 'chart-bar' | 'chart-line' | 'chart-pie') => Promise<string | null>;
  onTranslate?: (text: string, language: string) => Promise<string>;
}

// --- Types ---
interface Margins {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

// --- Constants ---
const PAGE_WIDTH_MM = 210; // A4 Width
const PAGE_HEIGHT_MM = 297; // A4 Height

const SUPPORTED_LANGUAGES = [
    { code: 'Russian', label: 'Русский' },
    { code: 'English', label: 'Английский' },
    { code: 'German', label: 'Немецкий' },
    { code: 'French', label: 'Французский' },
    { code: 'Spanish', label: 'Испанский' },
    { code: 'Chinese', label: 'Китайский' },
    { code: 'Japanese', label: 'Японский' },
];

// --- Sub-Components ---

// Reusable Toolbar Components for Consistency
const ToolbarButton = ({ 
    onClick, 
    isActive = false, 
    children, 
    title,
    className = ""
}: { 
    onClick: () => void, 
    isActive?: boolean, 
    children?: React.ReactNode, 
    title?: string, 
    className?: string
}) => (
    <button 
        onMouseDown={(e) => e.preventDefault()} // Prevent focus loss from editor
        onClick={onClick}
        className={`
            p-1.5 sm:p-2 rounded-lg transition-all duration-200 flex items-center justify-center shrink-0
            ${isActive 
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' 
                : 'hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-600 dark:text-gray-400'}
            ${className}
        `}
        title={title}
    >
        {children}
    </button>
);

const ToolbarDivider = () => (
    <div className="w-px h-5 sm:h-6 bg-gray-300 dark:bg-zinc-700 mx-1 shrink-0 self-center" />
);


// --- Main Component ---

const RichTextEditor: React.FC<RichTextEditorProps> = ({ initialContent, onChange, className, triggerReplace, triggerInsertHtml, onSmartEdit, onGenerateImage, onTranslate }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [margins, setMargins] = useState<Margins>({ left: 25, right: 25, top: 25, bottom: 25 });
  const [isParagraphDialogOpen, setIsParagraphDialogOpen] = useState(false);
  
  // Smart Edit State
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  const [smartEditInput, setSmartEditInput] = useState('');
  const [isSmartEditOpen, setIsSmartEditOpen] = useState(false);
  const [isSmartEditLoading, setIsSmartEditLoading] = useState(false);
  const [savedRange, setSavedRange] = useState<Range | null>(null);

  // Translation State
  const [isTranslateOpen, setIsTranslateOpen] = useState(false);

  // Format Painter State
  const [isPainterActive, setIsPainterActive] = useState(false);
  const [painterStyles, setPainterStyles] = useState<any>(null);

  // Table Insertion State
  const [showTableGrid, setShowTableGrid] = useState(false);
  const [tableGridHover, setTableGridHover] = useState<{rows: number, cols: number} | null>(null);
  const [savedTableSelection, setSavedTableSelection] = useState<Range | null>(null);

  // Image Resize State
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);
  const [imgOverlayRect, setImgOverlayRect] = useState<DOMRect | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  
  // Keep track of cursor for insertions when editor is blurred
  const [lastCursorRange, setLastCursorRange] = useState<Range | null>(null);
  
  // Сохраняем выделение для применения размера шрифта
  const [savedFontSizeRange, setSavedFontSizeRange] = useState<Range | null>(null);
  
  // Responsive State - Initialize with current window width
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  // Toolbar State
  const [currentFormat, setCurrentFormat] = useState<{
      bold: boolean;
      italic: boolean;
      underline: boolean;
      strike: boolean;
      align: string;
      isInTable: boolean;
      fontSize: number;
  }>({ bold: false, italic: false, underline: false, strike: false, align: 'left', isInTable: false, fontSize: 14 });
  
  // Локальное состояние для поля размера шрифта (для редактирования)
  const [fontSizeInputValue, setFontSizeInputValue] = useState<string>('14');
  const [isFontSizeEditing, setIsFontSizeEditing] = useState(false);
  
  // Инициализируем значение поля при изменении currentFormat.fontSize (когда не редактируется)
  useEffect(() => {
      if (!isFontSizeEditing) {
          setFontSizeInputValue((currentFormat.fontSize || 14).toString());
      }
  }, [currentFormat.fontSize, isFontSizeEditing]);

  // Detect mobile resize
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Sync initial content
  useEffect(() => {
      if (editorRef.current && initialContent && !editorRef.current.innerHTML) {
          editorRef.current.innerHTML = initialContent;
      }
  }, []);

  // Handle Full Content Replace
  useEffect(() => {
    if (triggerReplace && editorRef.current) {
      editorRef.current.innerHTML = triggerReplace.content;
      onChange(triggerReplace.content);
    }
  }, [triggerReplace]);

  // Handle Insert HTML at Cursor (Append or Insert)
  useEffect(() => {
    if (triggerInsertHtml && editorRef.current) {
        // Regain focus
        editorRef.current.focus();
        
        // Restore last known range if valid, otherwise append to end
        const selection = window.getSelection();
        if (lastCursorRange) {
             selection?.removeAllRanges();
             selection?.addRange(lastCursorRange);
        } else {
             // Move to end if no range saved or we are empty
             selection?.selectAllChildren(editorRef.current);
             selection?.collapseToEnd();
        }

        // Execute Insert
        document.execCommand('insertHTML', false, triggerInsertHtml.html);
        
        // Update content
        onChange(editorRef.current.innerHTML);
        
        // Scroll to bottom if appended (likely at end)
        editorRef.current.scrollTop = editorRef.current.scrollHeight;
    }
  }, [triggerInsertHtml]);

  // Handle Image Overlay Update Loop
  const updateOverlay = useCallback(() => {
      if (selectedImage && containerRef.current) {
          const imgRect = selectedImage.getBoundingClientRect();
          const containerRect = containerRef.current.getBoundingClientRect();
          
          // Calculate position relative to the container (Paper)
          // The overlay is absolute inside the container, so we just subtract container's visual rect from image's visual rect.
          setImgOverlayRect({
              top: imgRect.top - containerRect.top,
              left: imgRect.left - containerRect.left,
              width: imgRect.width,
              height: imgRect.height,
          } as DOMRect);
      } else {
          setImgOverlayRect(null);
      }
  }, [selectedImage]);

  useEffect(() => {
      if (selectedImage) {
          window.addEventListener('scroll', updateOverlay, true);
          window.addEventListener('resize', updateOverlay);
          // Initial Update
          updateOverlay();
          // Polling for layout shifts
          const interval = setInterval(updateOverlay, 50);
          return () => {
              window.removeEventListener('scroll', updateOverlay, true);
              window.removeEventListener('resize', updateOverlay);
              clearInterval(interval);
          };
      }
  }, [selectedImage, updateOverlay]);

  // Handle Selection Change to update Toolbar state & Smart Edit Menu
  const handleSelectionChange = useCallback(() => {
      // Save last cursor position for external insertions
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
          // Verify selection is inside editor
          let node = selection.anchorNode;
          let inside = false;
          while (node) {
              if (node === editorRef.current) {
                  inside = true;
                  break;
              }
              node = node.parentNode;
          }
          if (inside) {
              setLastCursorRange(selection.getRangeAt(0).cloneRange());
          }
      }

      // 1. Toolbar State
      if (document.queryCommandState) {
        // Check Table
        let node = window.getSelection()?.anchorNode;
        let foundTable = false;
        while (node && node !== editorRef.current) {
            if (node.nodeName === 'TD' || node.nodeName === 'TH') {
                foundTable = true;
                break;
            }
            node = node.parentNode;
        }

        // Получаем текущий размер шрифта в пикселях
        let currentFontSize = 14; // по умолчанию
        const selection = window.getSelection();
        
        if (selection && selection.rangeCount > 0 && editorRef.current) {
            const range = selection.getRangeAt(0);
            
            // Функция для поиска размера шрифта в элементе
            const getFontSizeFromElement = (element: HTMLElement): number | null => {
                // Сначала проверяем inline стиль (самый приоритетный)
                if (element.style.fontSize) {
                    const fontSizeStr = element.style.fontSize;
                    const fontSize = parseFloat(fontSizeStr);
                    if (!isNaN(fontSize) && fontSize > 0) {
                        return Math.round(fontSize);
                    }
                }
                
                // Проверяем computed style только если нет inline стиля
                const computedStyle = window.getComputedStyle(element);
                const fontSizeStr = computedStyle.fontSize;
                if (fontSizeStr && fontSizeStr !== 'inherit' && fontSizeStr !== 'normal') {
                    const fontSize = parseFloat(fontSizeStr);
                    if (!isNaN(fontSize) && fontSize > 0) {
                        // Проверяем, что это не унаследованный размер от редактора
                        const editorStyle = window.getComputedStyle(editorRef.current);
                        const editorFontSize = parseFloat(editorStyle.fontSize);
                        if (!isNaN(editorFontSize) && Math.abs(fontSize - editorFontSize) > 0.1) {
                            return Math.round(fontSize);
                        }
                    }
                }
                
                return null;
            };
            
            // Если есть выделение, проверяем размер шрифта в выделенном тексте
            if (!selection.isCollapsed) {
                // Начинаем с контейнера начала выделения
                let node: Node | null = range.startContainer;
                
                // Ищем ближайший элемент с явным размером шрифта (от ближайшего к дальнему)
                // Сначала проверяем сам контейнер
                if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
                    node = node.parentElement;
                }
                
                // Обходим DOM дерево от ближайшего элемента к дальнему
                const checkedElements: HTMLElement[] = [];
                let currentNode: Node | null = node;
                
                while (currentNode && currentNode !== editorRef.current) {
                    if (currentNode.nodeType === Node.ELEMENT_NODE) {
                        const element = currentNode as HTMLElement;
                        checkedElements.push(element);
                    }
                    currentNode = currentNode.parentNode;
                }
                
                // Проверяем элементы от ближайшего к дальнему
                for (const element of checkedElements) {
                    const fontSize = getFontSizeFromElement(element);
                    if (fontSize !== null) {
                        currentFontSize = fontSize;
                        break; // Останавливаемся на первом найденном inline стиле
                    }
                }
                
                // Если не нашли inline стиль, проверяем computed style последнего элемента
                if (checkedElements.length > 0 && currentFontSize === 14) {
                    const lastElement = checkedElements[0];
                    const computedStyle = window.getComputedStyle(lastElement);
                    const fontSizeStr = computedStyle.fontSize;
                    if (fontSizeStr) {
                        const fontSize = parseFloat(fontSizeStr);
                        if (!isNaN(fontSize) && fontSize > 0) {
                            currentFontSize = Math.round(fontSize);
                        }
                    }
                }
            } else {
                // Нет выделения - определяем размер в позиции курсора
                let node: Node | null = range.startContainer;
                
                if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
                    node = node.parentElement;
                }
                
                while (node && node !== editorRef.current) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const element = node as HTMLElement;
                        const fontSize = getFontSizeFromElement(element);
                        if (fontSize !== null) {
                            currentFontSize = fontSize;
                            break;
                        }
                    }
                    node = node.parentNode;
                }
            }
        }
        
        // Если не нашли конкретный размер, используем размер редактора
        if (currentFontSize === 14 && editorRef.current) {
            const computedStyle = window.getComputedStyle(editorRef.current);
            const fontSize = computedStyle.fontSize;
            if (fontSize) {
                const parsedSize = parseFloat(fontSize);
                if (!isNaN(parsedSize) && parsedSize > 0) {
                    currentFontSize = Math.round(parsedSize);
                }
            }
        }

        setCurrentFormat({
            bold: document.queryCommandState('bold'),
            italic: document.queryCommandState('italic'),
            underline: document.queryCommandState('underline'),
            strike: document.queryCommandState('strikethrough'),
            align: document.queryCommandState('justifyCenter') ? 'center' : 
                   document.queryCommandState('justifyRight') ? 'right' : 
                   document.queryCommandState('justifyFull') ? 'justify' : 'left',
            isInTable: foundTable,
            fontSize: currentFontSize
        });
      }

      // 2. Smart Edit Menu Position
      // If we have an image selected, use its rect
      if (selectedImage && !isResizing) {
          const rect = selectedImage.getBoundingClientRect();
          setSelectionRect(rect);
          return;
      }

      if (selection && !selection.isCollapsed && editorRef.current?.contains(selection.anchorNode)) {
          // If we are already editing (typing prompt) or menu is open, don't move the box
          if (isSmartEditOpen || isTranslateOpen) return;
          
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          // Ensure it's not a zero-width selection
          if (rect.width > 0) {
              setSelectionRect(rect);
              setSavedRange(range.cloneRange());
              setSelectedImage(null); // Deselect image if text is selected
          } else {
              setSelectionRect(null);
          }
      } else {
          if (!isSmartEditOpen && !isTranslateOpen && !selectedImage) {
             setSelectionRect(null);
          }
      }
  }, [isSmartEditOpen, isTranslateOpen, selectedImage, isResizing]);

  useEffect(() => {
      document.addEventListener('selectionchange', handleSelectionChange);
      // Also listen to mouseup/keyup in case selectionchange misses or we want instant feedback
      return () => {
          document.removeEventListener('selectionchange', handleSelectionChange);
      };
  }, [handleSelectionChange]);

  const exec = (command: string, value: string = '') => {
      document.execCommand(command, false, value);
      editorRef.current?.focus();
      handleSelectionChange();
  };

  // Функция для сохранения выделения перед изменением размера шрифта
  const saveSelectionForFontSize = () => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && editorRef.current) {
          // Проверяем, что выделение внутри редактора
          let node = selection.anchorNode;
          let inside = false;
          while (node) {
              if (node === editorRef.current) {
                  inside = true;
                  break;
              }
              node = node.parentNode;
          }
          
          if (inside) {
              const range = selection.getRangeAt(0).cloneRange();
              setSavedFontSizeRange(range);
          }
      }
  };

  // Функция для установки размера шрифта в пикселях
  const setFontSize = (size: number) => {
      if (size < 1 || size > 500) return; // Ограничения размера
      
      if (!editorRef.current) return;

      editorRef.current.focus();
      
      // Небольшая задержка, чтобы убедиться, что редактор получил фокус
      setTimeout(() => {
          try {
              const selection = window.getSelection();
              
              // Пытаемся восстановить сохраненное выделение
              if (savedFontSizeRange) {
                  try {
                      // Проверяем, что выделение все еще валидно
                      if (editorRef.current && 
                          editorRef.current.contains(savedFontSizeRange.startContainer) &&
                          editorRef.current.contains(savedFontSizeRange.endContainer)) {
                          selection?.removeAllRanges();
                          selection?.addRange(savedFontSizeRange.cloneRange());
                      }
                  } catch (e) {
                      // Выделение больше не валидно
                      console.log('Saved selection is invalid, trying current selection');
                  }
              }
              
              // Если нет выделения, выходим
              if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
                  console.log('No text selected');
                  setSavedFontSizeRange(null);
                  return;
              }

              let range = selection.getRangeAt(0);
              const selectedText = range.toString();
              
              if (!selectedText || !selectedText.trim()) {
                  setSavedFontSizeRange(null);
                  return;
              }

              // Включаем использование CSS стилей
              document.execCommand('styleWithCSS', false, 'true');
              
              // Сначала принудительно удаляем старые стили fontSize из выделенных элементов
              // Находим все элементы в выделении с fontSize
              const walker = document.createTreeWalker(
                  editorRef.current,
                  NodeFilter.SHOW_ELEMENT,
                  null
              );
              
              const elementsInRange: HTMLElement[] = [];
              let node: Node | null;
              while (node = walker.nextNode()) {
                  const element = node as HTMLElement;
                  if (range.intersectsNode(element)) {
                      if (element.style.fontSize || element.getAttribute('style')?.includes('font-size')) {
                          elementsInRange.push(element);
                      }
                  }
              }
              
              // Удаляем fontSize из найденных элементов
              elementsInRange.forEach(el => {
                  if (el.style.fontSize) {
                      el.style.fontSize = '';
                  }
                  const style = el.getAttribute('style') || '';
                  if (style) {
                      const cleaned = style.split(';')
                          .map(p => p.trim())
                          .filter(p => !p.toLowerCase().includes('font-size'))
                          .join(';')
                          .trim();
                      if (cleaned) {
                          el.setAttribute('style', cleaned);
                      } else {
                          el.removeAttribute('style');
                      }
                  }
              });
              
              // Обновляем range после изменений
              if (selection.rangeCount > 0) {
                  range = selection.getRangeAt(0);
              }
              
              // Получаем HTML содержимое выделения и очищаем старые стили размера шрифта
              const tempDiv = document.createElement('div');
              const clonedContents = range.cloneContents();
              tempDiv.appendChild(clonedContents);
              
              // Рекурсивно очищаем все стили fontSize из элементов и разворачиваем span'ы
              const cleanAndUnwrap = (container: Element) => {
                  // Сначала удаляем все fontSize стили
                  const allElements = container.querySelectorAll('*');
                  allElements.forEach((el: Element) => {
                      const htmlEl = el as HTMLElement;
                      
                      // Удаляем fontSize из inline стилей
                      if (htmlEl.style.fontSize) {
                          htmlEl.style.fontSize = '';
                      }
                      
                      // Очищаем fontSize из атрибута style
                      if (htmlEl.hasAttribute('style')) {
                          const styleAttr = htmlEl.getAttribute('style') || '';
                          const cleanedStyle = styleAttr
                              .split(';')
                              .map(prop => prop.trim())
                              .filter(prop => {
                                  if (!prop) return false;
                                  const lowerProp = prop.toLowerCase().trim();
                                  return !lowerProp.startsWith('font-size') && 
                                         !lowerProp.includes(':') || !lowerProp.startsWith('font-size');
                              })
                              .join(';')
                              .trim();
                          
                          if (cleanedStyle) {
                              htmlEl.setAttribute('style', cleanedStyle);
                          } else {
                              htmlEl.removeAttribute('style');
                          }
                      }
                  });
                  
                  // Затем разворачиваем span'ы с fontSize (до 5 уровней вложенности)
                  for (let level = 0; level < 5; level++) {
                      const fontSizeSpans = container.querySelectorAll('span[style*="font-size"], span[style*="fontSize"]');
                      if (fontSizeSpans.length === 0) break;
                      
                      fontSizeSpans.forEach((span: Element) => {
                          const htmlSpan = span as HTMLElement;
                          const style = htmlSpan.getAttribute('style') || '';
                          const styleProps = style.split(';').map(p => p.trim()).filter(p => p);
                          const hasOnlyFontSize = styleProps.every(prop => 
                              prop.toLowerCase().includes('font-size') || prop.toLowerCase().includes('fontsize')
                          );
                          
                          if (hasOnlyFontSize || styleProps.length === 0) {
                              const parent = htmlSpan.parentNode;
                              if (parent && parent !== container) {
                                  while (htmlSpan.firstChild) {
                                      parent.insertBefore(htmlSpan.firstChild, htmlSpan);
                                  }
                                  parent.removeChild(htmlSpan);
                              }
                          }
                      });
                  }
              };
              
              cleanAndUnwrap(tempDiv);
              
              // Получаем очищенное HTML содержимое
              let htmlContent = tempDiv.innerHTML.trim();
              
              // Если содержимое пустое, используем текстовое содержимое
              if (!htmlContent || htmlContent === '') {
                  htmlContent = selectedText
                      .replace(/&/g, '&amp;')
                      .replace(/</g, '&lt;')
                      .replace(/>/g, '&gt;');
              }
              
              const html = `<span style="font-size: ${size}px;">${htmlContent}</span>`;
              
              // Удаляем старое содержимое и вставляем новое
              range.deleteContents();
              document.execCommand('insertHTML', false, html);
              
              // Очищаем сохраненное выделение
              setSavedFontSizeRange(null);
              
              handleSelectionChange();
              handleInput();
          } catch (error) {
              console.error('Error setting font size:', error);
              setSavedFontSizeRange(null);
          }
      }, 50); // Небольшая задержка для восстановления фокуса
  };

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
      // If typing happens, check image overlay
      if (selectedImage) updateOverlay();
    }
  };

  // Explicitly save state on blur to help with button interactions
  const handleBlur = () => {
      handleSelectionChange();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      // Tab handling for indentation
      if (e.key === 'Tab') {
          e.preventDefault();
          exec(e.shiftKey ? 'outdent' : 'indent');
      }

      // Delete selected image
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedImage) {
          e.preventDefault();
          selectedImage.remove();
          setSelectedImage(null);
          setSelectionRect(null);
          handleInput();
      }
  };

  // --- Image Handling ---

  const handleEditorClick = (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG') {
          e.preventDefault();
          setSelectedImage(target as HTMLImageElement);
      } else {
          // Only deselect if we aren't clicking the overlay or resize handles
          // But since overlay is outside editor-content div usually, this might just work.
          // However, we are in the editor-content click handler.
          setSelectedImage(null);
      }
  };

  const handleResizeStart = (e: React.MouseEvent, direction: string) => {
      e.preventDefault();
      e.stopPropagation();
      if (!selectedImage) return;

      setIsResizing(true);
      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = selectedImage.offsetWidth;
      const startHeight = selectedImage.offsetHeight;
      const aspectRatio = startWidth / startHeight;

      const onMouseMove = (ev: MouseEvent) => {
          const deltaX = ev.clientX - startX;
          const deltaY = ev.clientY - startY;

          let newWidth = startWidth;
          let newHeight = startHeight;

          if (direction.includes('e')) newWidth = startWidth + deltaX;
          if (direction.includes('w')) newWidth = startWidth - deltaX;
          if (direction.includes('s')) newHeight = startHeight + deltaY;
          if (direction.includes('n')) newHeight = startHeight - deltaY;

          // Constraints
          if (newWidth < 20) newWidth = 20;
          if (newHeight < 20) newHeight = 20;

          // Lock aspect ratio for corner drags
          if (direction.length === 2) {
              if (Math.abs(deltaX) > Math.abs(deltaY)) {
                   newHeight = newWidth / aspectRatio;
              } else {
                   newWidth = newHeight * aspectRatio;
              }
          }

          selectedImage.style.width = `${newWidth}px`;
          selectedImage.style.height = `${newHeight}px`;
          updateOverlay();
      };

      const onMouseUp = () => {
          setIsResizing(false);
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
          handleInput(); // Save changes
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
  };

  const handleImageAlignment = (align: 'left' | 'center' | 'right') => {
      if (selectedImage) {
          // To align image in contentEditable, usually wrap in div or set style
          // Simple style approach:
          selectedImage.style.display = 'block';
          selectedImage.style.marginLeft = align === 'left' ? '0' : align === 'center' ? 'auto' : 'auto';
          selectedImage.style.marginRight = align === 'right' ? '0' : align === 'center' ? 'auto' : 'auto';
          handleInput();
          setSelectedImage(null); // Deselect after action
      }
  };

  // --- Table Operations ---
  
  const toggleTableGrid = () => {
      if (!showTableGrid) {
          // Save selection before opening grid, but ONLY if inside editor
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
              let isInEditor = false;
              let node = selection.anchorNode;
              while(node) {
                  if (node === editorRef.current) {
                      isInEditor = true;
                      break;
                  }
                  node = node.parentNode;
              }

              if (isInEditor) {
                  const range = selection.getRangeAt(0).cloneRange();
                  setSavedTableSelection(range);
              } else {
                  setSavedTableSelection(null);
              }
          }
      } else {
          setSavedTableSelection(null);
      }
      setShowTableGrid(!showTableGrid);
  };

  const insertTable = (rows: number, cols: number) => {
    if (!editorRef.current) return;
    
    // Фокусируем редактор
    editorRef.current.focus();
    
    // Небольшая задержка для гарантии фокуса
    setTimeout(() => {
      const selection = window.getSelection();
      let range: Range | null = null;
      
      // Пытаемся восстановить сохраненное выделение
      if (savedTableSelection) {
        try {
          // Проверяем, что выделение все еще валидно
          if (editorRef.current && 
              editorRef.current.contains(savedTableSelection.startContainer) &&
              editorRef.current.contains(savedTableSelection.endContainer)) {
            range = savedTableSelection.cloneRange();
          }
        } catch (e) {
          // Выделение больше не валидно, создаем новое
        }
      }
      
      // Если нет валидного выделения, создаем новое в позиции курсора
      if (!range) {
        range = document.createRange();
        if (selection && selection.rangeCount > 0) {
          range = selection.getRangeAt(0).cloneRange();
        } else {
          // Если нет выделения, вставляем в конец
          range.selectNodeContents(editorRef.current);
          range.collapse(false);
        }
      }
      
      // Устанавливаем выделение
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
      
      // Создаем HTML таблицы
      let tableHTML = '<table style="width: 100%; border-collapse: collapse; margin: 10px 0;"><tbody>';
      for (let i = 0; i < rows; i++) {
        tableHTML += '<tr>';
        for (let j = 0; j < cols; j++) {
          tableHTML += `<td style="border: 1px solid #d1d5db; padding: 8px; min-width: 20px;">&nbsp;</td>`;
        }
        tableHTML += '</tr>';
      }
      tableHTML += '</tbody></table>';
      
      // Пытаемся использовать insertHTML, если не работает - используем прямое вставление
      try {
        const success = document.execCommand('insertHTML', false, tableHTML);
        if (!success) {
          // Альтернативный метод: создаем элемент и вставляем
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = tableHTML;
          const table = tempDiv.firstElementChild as HTMLTableElement;
          
          if (range) {
            range.deleteContents();
            range.insertNode(table);
            
            // Перемещаем курсор после таблицы
            const newRange = document.createRange();
            newRange.setStartAfter(table);
            newRange.collapse(true);
            selection?.removeAllRanges();
            selection?.addRange(newRange);
          }
        }
      } catch (e) {
        // Если execCommand не работает, используем прямое вставление
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = tableHTML;
        const table = tempDiv.firstElementChild as HTMLTableElement;
        
        if (range) {
          range.deleteContents();
          range.insertNode(table);
          
          // Перемещаем курсор после таблицы
          const newRange = document.createRange();
          newRange.setStartAfter(table);
          newRange.collapse(true);
          selection?.removeAllRanges();
          selection?.addRange(newRange);
        }
      }
      
      setShowTableGrid(false);
      setSavedTableSelection(null);
      handleInput();
      handleSelectionChange();
    }, 10);
  };

  const modifyTable = (action: 'addRowAbove' | 'addRowBelow' | 'addColLeft' | 'addColRight' | 'deleteRow' | 'deleteCol' | 'deleteTable') => {
      const selection = window.getSelection();
      if (!selection?.anchorNode) return;
      
      let node = selection.anchorNode as HTMLElement | null;
      while (node && node.nodeName !== 'TD' && node.nodeName !== 'TH') {
          node = node.parentNode as HTMLElement;
      }
      
      if (!node) return;
      
      const cell = node as HTMLTableCellElement;
      const row = cell.parentNode as HTMLTableRowElement;
      const table = row.parentNode?.parentNode as HTMLTableElement; // tbody -> table
      
      if (!table) return;

      const rowIndex = row.rowIndex;
      const cellIndex = cell.cellIndex;

      switch (action) {
          case 'addRowAbove':
              const newRow = table.insertRow(rowIndex);
              for (let i = 0; i < row.cells.length; i++) newRow.insertCell(i).innerHTML = '&nbsp;';
              break;
          case 'addRowBelow':
              const newRowBelow = table.insertRow(rowIndex + 1);
              for (let i = 0; i < row.cells.length; i++) newRowBelow.insertCell(i).innerHTML = '&nbsp;';
              break;
          case 'addColLeft':
              for (let i = 0; i < table.rows.length; i++) table.rows[i].insertCell(cellIndex).innerHTML = '&nbsp;';
              break;
          case 'addColRight':
              for (let i = 0; i < table.rows.length; i++) table.rows[i].insertCell(cellIndex + 1).innerHTML = '&nbsp;';
              break;
          case 'deleteRow':
              table.deleteRow(rowIndex);
              break;
          case 'deleteCol':
              for (let i = 0; i < table.rows.length; i++) table.rows[i].deleteCell(cellIndex);
              break;
          case 'deleteTable':
              table.remove();
              break;
      }
      handleInput();
  };
  
  const formatTable = (action: 'border' | 'padding' | 'color', value?: any) => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      
      const range = selection.getRangeAt(0);
      const startNode = range.startContainer;
      
      const getCell = (n: Node | null) => {
          while (n && n.nodeName !== 'TD' && n.nodeName !== 'TH') {
              n = n.parentNode;
          }
          return n as HTMLTableCellElement | null;
      };
      
      const startCell = getCell(startNode);
      if (!startCell) return;

      const applyToCell = (cell: HTMLTableCellElement) => {
          if (action === 'color') {
              cell.style.backgroundColor = value;
          } else if (action === 'padding') {
              cell.style.padding = value === 'small' ? '4px' : value === 'large' ? '16px' : '8px';
          }
      };

      if (action === 'border') {
          // Toggle table borders
          const table = startCell.closest('table');
          if (table) {
             const cells = table.querySelectorAll('td, th');
             cells.forEach((c: any) => {
                 c.style.border = value === 'none' ? '1px dashed #e5e7eb' : '1px solid #000';
             });
          }
      } else {
          // Apply to cell(s)
          // Try to apply to all selected cells if selection spans multiple
          const table = startCell.closest('table');
          if (table) {
              const cells = table.querySelectorAll('td, th');
              let applied = false;
              cells.forEach((cell) => {
                  if (selection.containsNode(cell, true) || cell === startCell) {
                      applyToCell(cell as HTMLTableCellElement);
                      applied = true;
                  }
              });
              if (!applied) applyToCell(startCell);
          } else {
              applyToCell(startCell);
          }
      }
      handleInput();
  };

  // --- Format Painter ---

  const handleFormatPainterClick = () => {
      if (!isPainterActive) {
          // Capture current styles
          const styles = {
              bold: document.queryCommandState('bold'),
              italic: document.queryCommandState('italic'),
              underline: document.queryCommandState('underline'),
              foreColor: document.queryCommandValue('foreColor'),
              backColor: document.queryCommandValue('backColor'),
              fontName: document.queryCommandValue('fontName'),
              fontSize: document.queryCommandValue('fontSize'),
          };
          setPainterStyles(styles);
          setIsPainterActive(true);
      } else {
          setIsPainterActive(false);
          setPainterStyles(null);
      }
  };

  const handleEditorMouseUp = () => {
      if (isPainterActive && painterStyles) {
          const selection = window.getSelection();
          if (selection && !selection.isCollapsed) {
              if (painterStyles.bold) document.execCommand('bold');
              if (painterStyles.italic) document.execCommand('italic');
              if (painterStyles.underline) document.execCommand('underline');
              if (painterStyles.foreColor) document.execCommand('foreColor', false, painterStyles.foreColor);
              if (painterStyles.backColor) document.execCommand('backColor', false, painterStyles.backColor);
              if (painterStyles.fontName) document.execCommand('fontName', false, painterStyles.fontName);
              if (painterStyles.fontSize) document.execCommand('fontSize', false, painterStyles.fontSize);
              
              setIsPainterActive(false);
              setPainterStyles(null);
          }
      }
      handleSelectionChange();
  };

  // --- Smart Actions ---

  const handleQuickAction = (type: 'table' | 'chart' | 'diagram' | 'chart-bar' | 'chart-line' | 'chart-pie' | 'translate') => {
      if (!savedRange || !onSmartEdit || !onGenerateImage) return;

      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(savedRange);
      
      const text = savedRange.toString();

      if (type === 'translate') {
          setIsTranslateOpen(true);
          return;
      }

      if (type === 'table') {
          handleSmartEditSubmit(text, "Convert this text into an HTML table.");
          return;
      }
      
      // Image Gen Types
      setIsSmartEditLoading(true);
      onGenerateImage(text, type).then(url => {
          if (url) {
              exec('insertHTML', `<img src="${url}" style="max-width: 100%;" />`);
          } else {
              alert('Could not generate visual.');
          }
          setIsSmartEditLoading(false);
          setSelectionRect(null);
      });
  };

  const handleSmartEditSubmit = async (text: string, prompt: string) => {
      if (!onSmartEdit || !savedRange) return;
      setIsSmartEditLoading(true);
      
      const newText = await onSmartEdit(text, prompt);
      
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(savedRange);
      
      exec('insertHTML', newText);
      
      setIsSmartEditLoading(false);
      setSelectionRect(null);
      setSmartEditInput('');
      setIsSmartEditOpen(false);
  };

  // Получить текущие настройки абзаца из выделения
  const getCurrentParagraphSettings = () => {
    if (!editorRef.current) return undefined;
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return undefined;
    
    const range = selection.getRangeAt(0);
    let element: HTMLElement | null = null;
    
    // Находим элемент абзаца
    if (range.startContainer.nodeType === Node.TEXT_NODE) {
      element = range.startContainer.parentElement;
    } else {
      element = range.startContainer as HTMLElement;
    }
    
    while (element && element !== editorRef.current) {
      if (element.tagName === 'P' || element.tagName === 'DIV' || element.tagName === 'H1' || element.tagName === 'H2' || element.tagName === 'H3') {
        break;
      }
      element = element.parentElement;
    }
    
    if (!element) return undefined;
    
    const style = window.getComputedStyle(element);
    const inlineStyle = element.style;
    
    // Парсим настройки из стилей
    const alignment = inlineStyle.textAlign || style.textAlign || 'left';
    const marginLeft = parseFloat(inlineStyle.marginLeft || style.marginLeft || '0');
    const marginRight = parseFloat(inlineStyle.marginRight || style.marginRight || '0');
    const paddingLeft = parseFloat(inlineStyle.paddingLeft || style.paddingLeft || '0');
    const textIndent = parseFloat(inlineStyle.textIndent || style.textIndent || '0');
    const marginTop = parseFloat(inlineStyle.marginTop || style.marginTop || '0');
    const marginBottom = parseFloat(inlineStyle.marginBottom || style.marginBottom || '0');
    const lineHeight = inlineStyle.lineHeight || style.lineHeight || '1.15';
    
    // Конвертация px в см (примерно 1см = 37.8px)
    const pxToCm = (px: number) => px / 37.8;
    // Конвертация px в пт (примерно 1пт = 1.33px)
    const pxToPt = (px: number) => px / 1.33;
    
    let firstLineIndent = 0;
    if (textIndent > 0) {
      firstLineIndent = pxToCm(textIndent);
    } else if (paddingLeft > 0) {
      firstLineIndent = pxToCm(paddingLeft);
    }
    
    let lineSpacing: 'single' | '1.5' | 'double' | 'multiple' | 'atLeast' | 'exactly' = 'multiple';
    let lineSpacingValue = 1.15;
    
    if (lineHeight === '1' || lineHeight === 'normal') {
      lineSpacing = 'single';
      lineSpacingValue = 1;
    } else if (lineHeight === '1.5') {
      lineSpacing = '1.5';
      lineSpacingValue = 1.5;
    } else if (lineHeight === '2') {
      lineSpacing = 'double';
      lineSpacingValue = 2;
    } else {
      const numValue = parseFloat(lineHeight);
      if (!isNaN(numValue)) {
        if (lineHeight.includes('px')) {
          lineSpacing = 'atLeast';
          lineSpacingValue = pxToPt(numValue);
        } else {
          lineSpacing = 'multiple';
          lineSpacingValue = numValue;
        }
      }
    }
    
    return {
      alignment: (alignment === 'center' ? 'center' : alignment === 'right' ? 'right' : alignment === 'justify' ? 'justify' : 'left') as any,
      indentLeft: pxToCm(marginLeft),
      indentRight: pxToCm(marginRight),
      firstLineIndent: firstLineIndent,
      mirrorIndents: false,
      spacingBefore: pxToPt(marginTop),
      spacingAfter: pxToPt(marginBottom),
      lineSpacing: lineSpacing,
      lineSpacingValue: lineSpacingValue,
      noSpaceBetweenSameStyle: false
    };
  };

  // Применить настройки абзаца
  const handleParagraphSettingsApply = (settings: any) => {
    if (!editorRef.current) return;
    
    editorRef.current.focus();
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      // Если нет выделения, применяем к текущему абзацу
      const range = document.createRange();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    
    const range = selection.getRangeAt(0);
    
    // Находим все элементы абзацев в выделении
    const walker = document.createTreeWalker(
      editorRef.current,
      NodeFilter.SHOW_ELEMENT,
      null
    );
    
    const paragraphs: HTMLElement[] = [];
    let node: Node | null;
    
    while (node = walker.nextNode()) {
      const element = node as HTMLElement;
      if (range.intersectsNode(element)) {
        if (element.tagName === 'P' || element.tagName === 'DIV' || 
            element.tagName === 'H1' || element.tagName === 'H2' || element.tagName === 'H3') {
          paragraphs.push(element);
        }
      }
    }
    
    // Если не нашли абзацы, создаем обертку
    if (paragraphs.length === 0) {
      const p = document.createElement('p');
      try {
        range.surroundContents(p);
        paragraphs.push(p);
      } catch (e) {
        // Если не удалось обернуть, применяем к родительскому элементу
        let parent = range.commonAncestorContainer;
        if (parent.nodeType === Node.TEXT_NODE) {
          parent = parent.parentElement!;
        }
        if (parent && parent !== editorRef.current) {
          paragraphs.push(parent as HTMLElement);
        }
      }
    }
    
    // Конвертация см в пиксели
    const cmToPx = (cm: number) => cm * 37.8;
    // Конвертация пт в пиксели
    const ptToPx = (pt: number) => pt * 1.33;
    
    paragraphs.forEach(p => {
      // Выравнивание
      p.style.textAlign = settings.alignment;
      
      // Отступы
      p.style.marginLeft = `${cmToPx(settings.indentLeft)}px`;
      p.style.marginRight = `${cmToPx(settings.indentRight)}px`;
      
      // Первая строка
      if (settings.firstLineIndent > 0) {
        // Отступ первой строки (красная строка) - положительный text-indent
        p.style.textIndent = `${cmToPx(settings.firstLineIndent)}px`;
        p.style.paddingLeft = '0';
      } else if (settings.firstLineIndent < 0) {
        // Выступ первой строки (висячий отступ) - отрицательный text-indent + padding-left
        const indentValue = Math.abs(settings.firstLineIndent);
        p.style.textIndent = `-${cmToPx(indentValue)}px`;
        p.style.paddingLeft = `${cmToPx(indentValue)}px`;
      } else {
        // Нет отступа первой строки
        p.style.textIndent = '0';
        p.style.paddingLeft = '0';
      }
      
      // Интервалы
      p.style.marginTop = `${ptToPx(settings.spacingBefore)}px`;
      p.style.marginBottom = `${ptToPx(settings.spacingAfter)}px`;
      
      // Междустрочный интервал
      if (settings.lineSpacing === 'single') {
        p.style.lineHeight = '1';
      } else if (settings.lineSpacing === '1.5') {
        p.style.lineHeight = '1.5';
      } else if (settings.lineSpacing === 'double') {
        p.style.lineHeight = '2';
      } else if (settings.lineSpacing === 'multiple') {
        p.style.lineHeight = settings.lineSpacingValue.toString();
      } else if (settings.lineSpacing === 'atLeast' || settings.lineSpacing === 'exactly') {
        p.style.lineHeight = `${ptToPx(settings.lineSpacingValue)}px`;
      }
    });
    
    handleInput();
    handleSelectionChange();
  };

  const handleTranslateSubmit = async (lang: string) => {
      if (!onTranslate || !savedRange) return;
      setIsSmartEditLoading(true);
      const text = savedRange.toString();
      
      const newText = await onTranslate(text, lang);
      
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(savedRange);
      
      exec('insertHTML', newText);
      
      setIsSmartEditLoading(false);
      setSelectionRect(null);
      setIsTranslateOpen(false);
  };

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-zinc-950 ${className}`}>
      
      {/* Toolbar */}
      <div className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700 p-2 flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar shrink-0 shadow-sm z-20">
        
        {/* History */}
        <div className="flex gap-0.5">
            <ToolbarButton onClick={() => exec('undo')} title="Undo">
              <Undo size={18} />
            </ToolbarButton>
            <ToolbarButton onClick={() => exec('redo')} title="Redo">
              <Redo size={18} />
            </ToolbarButton>
            <ToolbarButton onClick={handleFormatPainterClick} isActive={isPainterActive} title="Format Painter">
              <PaintRoller size={18} />
            </ToolbarButton>
        </div>
        
        <ToolbarDivider />

        {/* Fonts */}
        <div className="flex gap-1 items-center">
             <div className="relative group">
                 <select 
                   onChange={(e) => exec('fontName', e.target.value)} 
                   className="w-24 sm:w-32 h-8 sm:h-9 text-xs sm:text-sm border border-gray-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 px-2 appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                   onMouseDown={(e) => e.stopPropagation()} // Allow interaction
                 >
                    <option value="Inter">Inter</option>
                    <option value="Arial">Arial</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Courier New">Courier New</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Verdana">Verdana</option>
                 </select>
                 <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500"/>
             </div>
             <div className="relative group flex items-center">
                 <input 
                   type="number"
                   min="1"
                   max="500"
                   value={isFontSizeEditing ? fontSizeInputValue : (currentFormat.fontSize || 14).toString()}
                   onFocus={(e) => {
                       // Сохраняем выделение перед началом редактирования
                       saveSelectionForFontSize();
                       setIsFontSizeEditing(true);
                       setFontSizeInputValue((currentFormat.fontSize || 14).toString());
                       e.target.select(); // Выделяем весь текст для удобства редактирования
                   }}
                   onKeyDown={(e) => {
                       if (e.key === 'Enter') {
                           e.preventDefault();
                           const size = parseInt(fontSizeInputValue) || 14;
                           let finalSize = size;
                           
                           if (size < 1) {
                               finalSize = 14;
                           } else if (size > 500) {
                               finalSize = 500;
                           }
                           
                           if (finalSize >= 1 && finalSize <= 500) {
                               setFontSize(finalSize);
                           }
                           
                           setIsFontSizeEditing(false);
                           (e.target as HTMLInputElement).blur();
                       } else if (e.key === 'Escape') {
                           setIsFontSizeEditing(false);
                           setFontSizeInputValue((currentFormat.fontSize || 14).toString());
                           (e.target as HTMLInputElement).blur();
                       }
                   }}
                   onChange={(e) => {
                       // Обновляем локальное значение при вводе
                       setFontSizeInputValue(e.target.value);
                   }}
                   onBlur={(e) => {
                       const size = parseInt(fontSizeInputValue) || 14;
                       let finalSize = size;
                       
                       if (size < 1) {
                           finalSize = 14;
                           setFontSizeInputValue('14');
                       } else if (size > 500) {
                           finalSize = 500;
                           setFontSizeInputValue('500');
                       }
                       
                       setIsFontSizeEditing(false);
                       
                       // Применяем размер при потере фокуса
                       if (finalSize >= 1 && finalSize <= 500) {
                           setFontSize(finalSize);
                       }
                   }}
                   className="w-16 sm:w-20 h-8 sm:h-9 text-xs sm:text-sm border border-gray-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 px-2 text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                   onMouseDown={(e) => {
                       e.stopPropagation();
                       // Сохраняем выделение при клике
                       saveSelectionForFontSize();
                   }}
                   placeholder="14"
                 />
                 <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">px</span>
             </div>
        </div>

        <ToolbarDivider />

        {/* Text Style */}
        <div className="flex gap-0.5">
            <ToolbarButton onClick={() => exec('bold')} isActive={currentFormat.bold} title="Bold">
              <Bold size={18} />
            </ToolbarButton>
            <ToolbarButton onClick={() => exec('italic')} isActive={currentFormat.italic} title="Italic">
              <Italic size={18} />
            </ToolbarButton>
            <ToolbarButton onClick={() => exec('underline')} isActive={currentFormat.underline} title="Underline">
              <Underline size={18} />
            </ToolbarButton>
            <ToolbarButton onClick={() => exec('strikethrough')} isActive={currentFormat.strike} title="Strikethrough">
              <Strikethrough size={18} />
            </ToolbarButton>
            <ToolbarButton onClick={() => exec('subscript')} title="Subscript">
              <Subscript size={18} />
            </ToolbarButton>
             <ToolbarButton onClick={() => exec('superscript')} title="Superscript">
              <Superscript size={18} />
            </ToolbarButton>
        </div>

        <ToolbarDivider />

        {/* Colors */}
        <div className="flex gap-1 items-center">
           <div className="relative flex items-center">
             <Palette size={18} className="text-gray-500 dark:text-gray-400 absolute left-2 pointer-events-none"/>
             <input 
               type="color" 
               onChange={(e) => exec('foreColor', e.target.value)}
               className="w-8 h-8 opacity-0 cursor-pointer absolute inset-0" 
               title="Text Color"
             />
             <div className="w-8 h-8"/> {/* Spacer for layout */}
           </div>
           <div className="relative flex items-center">
             <Highlighter size={18} className="text-gray-500 dark:text-gray-400 absolute left-2 pointer-events-none"/>
             <input 
               type="color" 
               onChange={(e) => exec('hiliteColor', e.target.value)}
               className="w-8 h-8 opacity-0 cursor-pointer absolute inset-0" 
               title="Highlight Color"
             />
             <div className="w-8 h-8"/> 
           </div>
           <ToolbarButton onClick={() => exec('removeFormat')} title="Clear Formatting">
               <Eraser size={18} />
           </ToolbarButton>
        </div>

        <ToolbarDivider />

        {/* Paragraph */}
        <div className="flex gap-0.5">
            <ToolbarButton onClick={() => exec('justifyLeft')} isActive={currentFormat.align === 'left'} title="Align Left">
              <AlignLeft size={18} />
            </ToolbarButton>
            <ToolbarButton onClick={() => exec('justifyCenter')} isActive={currentFormat.align === 'center'} title="Align Center">
              <AlignCenter size={18} />
            </ToolbarButton>
            <ToolbarButton onClick={() => exec('justifyRight')} isActive={currentFormat.align === 'right'} title="Align Right">
              <AlignRight size={18} />
            </ToolbarButton>
             <ToolbarButton onClick={() => exec('justifyFull')} isActive={currentFormat.align === 'justify'} title="Justify">
              <AlignJustify size={18} />
            </ToolbarButton>
            <ToolbarButton onClick={() => exec('insertUnorderedList')} title="Bullet List">
              <List size={18} />
            </ToolbarButton>
            <ToolbarButton onClick={() => exec('insertOrderedList')} title="Numbered List">
              <ListOrdered size={18} />
            </ToolbarButton>
        </div>
        
        <ToolbarDivider />

        {/* Indent */}
         <div className="flex gap-0.5">
            <ToolbarButton onClick={() => exec('indent')} title="Indent">
              <Indent size={18} />
            </ToolbarButton>
            <ToolbarButton onClick={() => exec('outdent')} title="Outdent">
              <Outdent size={18} />
            </ToolbarButton>
        </div>

        <ToolbarDivider />

        {/* Insert / Tools */}
        <div className="flex gap-0.5 relative">
             {/* Table Selector Dropdown */}
            <div className="relative group">
                <ToolbarButton onClick={toggleTableGrid} isActive={showTableGrid} title="Insert Table">
                    <TableIcon size={18} />
                </ToolbarButton>
                {showTableGrid && (
                    <div className="absolute top-full left-0 mt-1 bg-white dark:bg-zinc-800 shadow-xl border border-gray-200 dark:border-zinc-700 rounded p-2 z-50">
                        <div className="mb-2 text-xs text-center font-medium text-gray-500">
                           {tableGridHover ? `${tableGridHover.rows} x ${tableGridHover.cols}` : 'Insert Table'}
                        </div>
                        <div 
                          className="grid grid-cols-10 gap-0.5" 
                          onMouseLeave={() => setTableGridHover(null)}
                        >
                            {Array.from({ length: 100 }).map((_, i) => {
                                const row = Math.floor(i / 10) + 1;
                                const col = (i % 10) + 1;
                                const isSelected = tableGridHover && row <= tableGridHover.rows && col <= tableGridHover.cols;
                                return (
                                    <div 
                                        key={i}
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => insertTable(row, col)}
                                        onMouseEnter={() => setTableGridHover({rows: row, cols: col})}
                                        className={`w-4 h-4 border cursor-pointer ${isSelected ? 'bg-blue-200 border-blue-400' : 'bg-gray-50 border-gray-200'}`}
                                    />
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
            
            <ToolbarButton onClick={() => exec('formatBlock', 'H1')} title="Heading 1">
              <Heading1 size={18} />
            </ToolbarButton>
            <ToolbarButton onClick={() => exec('formatBlock', 'H2')} title="Heading 2">
              <Heading2 size={18} />
            </ToolbarButton>
            
            <ToolbarDivider />
            
            <ToolbarButton onClick={() => setIsParagraphDialogOpen(true)} title="Настройки абзаца">
              <AlignJustify size={18} />
            </ToolbarButton>
        </div>

        {/* Table Specific Tools (Show only if inside table) */}
        {currentFormat.isInTable && (
            <>
                <ToolbarDivider />
                <div className="flex gap-0.5 items-center bg-blue-50 dark:bg-blue-900/20 p-0.5 rounded border border-blue-100 dark:border-blue-900/30">
                     <ToolbarButton onClick={() => modifyTable('addRowAbove')} title="Add Row Above"><ArrowUp size={16}/></ToolbarButton>
                     <ToolbarButton onClick={() => modifyTable('addRowBelow')} title="Add Row Below"><ArrowDownIcon size={16}/></ToolbarButton>
                     <ToolbarButton onClick={() => modifyTable('addColLeft')} title="Add Col Left"><ArrowLeft size={16}/></ToolbarButton>
                     <ToolbarButton onClick={() => modifyTable('addColRight')} title="Add Col Right"><ArrowRightIcon size={16}/></ToolbarButton>
                     <div className="w-px h-4 bg-blue-200 mx-1"></div>
                     <ToolbarButton onClick={() => modifyTable('deleteRow')} title="Delete Row" className="hover:text-red-500"><Layout size={16}/></ToolbarButton>
                     <ToolbarButton onClick={() => modifyTable('deleteTable')} title="Delete Table" className="hover:text-red-500"><Trash2 size={16}/></ToolbarButton>
                     <div className="w-px h-4 bg-blue-200 mx-1"></div>
                     <ToolbarButton onClick={() => formatTable('border', 'all')} title="Borders All"><Grid3x3 size={16}/></ToolbarButton>
                     <ToolbarButton onClick={() => formatTable('border', 'none')} title="No Borders"><Box size={16}/></ToolbarButton>
                     
                     <div className="w-px h-4 bg-blue-200 mx-1"></div>
                     
                     <ToolbarButton onClick={() => formatTable('padding', 'small')} title="Padding Small"><Minimize2 size={16}/></ToolbarButton>
                     <ToolbarButton onClick={() => formatTable('padding', 'normal')} title="Padding Normal"><Box size={12} className="stroke-[3]"/></ToolbarButton>
                     <ToolbarButton onClick={() => formatTable('padding', 'large')} title="Padding Large"><Maximize2 size={16}/></ToolbarButton>
                     
                     <div className="relative flex items-center ml-1">
                        <PaintBucket size={16} className="text-gray-500 pointer-events-none absolute left-1"/>
                        <input type="color" onChange={(e) => formatTable('color', e.target.value)} className="w-6 h-6 opacity-0 cursor-pointer"/>
                     </div>
                </div>
            </>
        )}
      </div>

      {/* Editor Area */}
      <div className="flex-1 overflow-auto bg-white dark:bg-black/20 flex flex-col items-center relative">
        <div className="flex w-full justify-center min-h-[calc(100vh-120px)] relative">
             {/* Paper Container */}
            <div 
                ref={containerRef}
                className="bg-white dark:bg-zinc-900 transition-all duration-300 relative shrink-0"
                style={{
                    width: isMobile ? '100%' : `${PAGE_WIDTH_MM}mm`,
                    minHeight: isMobile ? '80vh' : `${PAGE_HEIGHT_MM}mm`,
                    paddingTop: isMobile ? '16px' : `${margins.top}mm`,
                    paddingBottom: isMobile ? '16px' : `${margins.bottom}mm`,
                    paddingLeft: isMobile ? '16px' : `${margins.left}mm`,
                    paddingRight: isMobile ? '16px' : `${margins.right}mm`,
                }}
            >
                {/* Content Editable */}
                <div
                    ref={editorRef}
                    className="editor-content w-full min-h-full outline-none"
                    contentEditable
                    onInput={handleInput}
                    onMouseUp={handleEditorMouseUp}
                    onBlur={handleBlur} // Save selection on blur
                    onClick={handleEditorClick}
                    onKeyUp={handleSelectionChange}
                    onKeyDown={handleKeyDown}
                    suppressContentEditableWarning
                    data-placeholder="Начните писать или вставьте текст..."
                />

                {/* Image Resizer Overlay */}
                {imgOverlayRect && selectedImage && (
                    <div 
                        className="absolute border-2 border-blue-500 z-50 pointer-events-none"
                        style={{
                            top: `${imgOverlayRect.top}px`,
                            left: `${imgOverlayRect.left}px`,
                            width: `${imgOverlayRect.width}px`,
                            height: `${imgOverlayRect.height}px`
                        }}
                    >
                        {/* Handles - Pointer Events enabled for handles */}
                        {['nw', 'ne', 'sw', 'se'].map(dir => (
                            <div 
                                key={dir}
                                onMouseDown={(e) => handleResizeStart(e, dir)}
                                className="absolute w-3 h-3 bg-blue-500 border border-white rounded-full pointer-events-auto"
                                style={{
                                    top: dir.includes('n') ? '-5px' : 'auto',
                                    bottom: dir.includes('s') ? '-5px' : 'auto',
                                    left: dir.includes('w') ? '-5px' : 'auto',
                                    right: dir.includes('e') ? '-5px' : 'auto',
                                    cursor: `${dir}-resize`
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* Floating Smart Edit Menu */}
      {selectionRect && (
        <div 
            className="fixed z-50 bg-white dark:bg-zinc-800 shadow-xl rounded-xl border border-gray-200 dark:border-zinc-700 flex flex-col animate-in fade-in zoom-in-95 duration-150"
            style={{
                top: `${selectionRect.top - 60}px`,
                left: `${selectionRect.left}px`
            }}
        >
            {selectedImage ? (
                // Image Toolbar
                 <div className="flex p-1 gap-1">
                    <button onClick={() => handleImageAlignment('left')} className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded text-gray-600 dark:text-gray-300" title="Align Left">
                        <AlignLeft size={16} />
                    </button>
                    <button onClick={() => handleImageAlignment('center')} className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded text-gray-600 dark:text-gray-300" title="Align Center">
                        <AlignCenter size={16} />
                    </button>
                    <button onClick={() => handleImageAlignment('right')} className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded text-gray-600 dark:text-gray-300" title="Align Right">
                        <AlignRight size={16} />
                    </button>
                    <div className="w-px bg-gray-200 dark:bg-zinc-700 mx-1"></div>
                    <button 
                        onClick={() => {
                            selectedImage.remove();
                            setSelectedImage(null);
                            setSelectionRect(null);
                            handleInput();
                        }} 
                        className="p-1.5 hover:bg-red-50 text-red-500 rounded" 
                        title="Delete Image"
                    >
                        <Trash2 size={16} />
                    </button>
                 </div>
            ) : (
                // Text Toolbar
                <>
                {!isSmartEditOpen && !isTranslateOpen && (
                    <div className="flex p-1 gap-1">
                        <button 
                            onClick={() => setIsSmartEditOpen(true)}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
                        >
                            <Sparkles size={14} /> AI Edit
                        </button>
                        <div className="w-px bg-gray-200 dark:bg-zinc-700 mx-1"></div>
                        <button onClick={() => handleQuickAction('translate')} className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded text-gray-600 dark:text-gray-300" title="Translate">
                            <Languages size={16} />
                        </button>
                        <button onClick={() => handleQuickAction('table')} className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded text-gray-600 dark:text-gray-300" title="Convert to Table">
                            <TableIcon size={16} />
                        </button>
                        <button onClick={() => handleQuickAction('chart-bar')} className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded text-gray-600 dark:text-gray-300" title="Create Bar Chart">
                            <BarChart size={16} />
                        </button>
                        <button onClick={() => handleQuickAction('chart-line')} className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded text-gray-600 dark:text-gray-300" title="Create Line Chart">
                            <LineChart size={16} />
                        </button>
                        <button onClick={() => handleQuickAction('chart-pie')} className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded text-gray-600 dark:text-gray-300" title="Create Pie Chart">
                            <PieChart size={16} />
                        </button>
                        <button onClick={() => handleQuickAction('diagram')} className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded text-gray-600 dark:text-gray-300" title="Create Diagram">
                            <Network size={16} />
                        </button>
                    </div>
                )}

                {isSmartEditOpen && (
                    <div className="flex items-center p-2 gap-2 min-w-[300px]">
                        <Sparkles size={16} className="text-blue-500 animate-pulse" />
                        <input 
                            autoFocus
                            value={smartEditInput}
                            onChange={(e) => setSmartEditInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSmartEditSubmit(savedRange?.toString() || '', smartEditInput);
                                if (e.key === 'Escape') setIsSmartEditOpen(false);
                            }}
                            placeholder="Как изменить этот текст?"
                            className="flex-1 text-sm bg-transparent border-none focus:ring-0 focus:outline-none dark:text-white"
                        />
                        <button 
                            onClick={() => handleSmartEditSubmit(savedRange?.toString() || '', smartEditInput)}
                            className="p-1 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200"
                        >
                            <ArrowRight size={14} />
                        </button>
                    </div>
                )}
                
                {isTranslateOpen && (
                    <div className="flex flex-col p-2 gap-2 min-w-[200px]">
                        <div className="text-xs font-semibold text-gray-500 uppercase">Translate to:</div>
                        <div className="grid grid-cols-2 gap-1">
                            {SUPPORTED_LANGUAGES.map(lang => (
                                <button 
                                    key={lang.code}
                                    onClick={() => handleTranslateSubmit(lang.code)}
                                    className="text-left text-xs px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-700"
                                >
                                    {lang.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                </>
            )}

            {isSmartEditLoading && (
                <div className="absolute inset-0 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm flex items-center justify-center rounded-xl">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
                </div>
            )}
        </div>
      )}

      {/* Paragraph Dialog */}
      {isParagraphDialogOpen && (
        <ParagraphDialog
          isOpen={isParagraphDialogOpen}
          onClose={() => setIsParagraphDialogOpen(false)}
          onApply={handleParagraphSettingsApply}
          currentSettings={getCurrentParagraphSettings()}
        />
      )}
    </div>
  );
};

export default RichTextEditor;