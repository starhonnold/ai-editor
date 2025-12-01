import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, Loader2, Sparkles, User, Bot, X, FilePenLine, Copy, CheckCircle2 } from 'lucide-react';
import { ChatMessage, UploadedFile } from '../types';

interface AssistantProps {
  messages: ChatMessage[];
  isThinking: boolean;
  onSendMessage: (text: string, files: UploadedFile[]) => void;
  onInsertText: (text: string) => void;
  onInsertImage: (base64: string) => void;
  onReplaceContent: (text: string) => void;
  onClose?: () => void;
}

const Assistant: React.FC<AssistantProps> = ({ messages, isThinking, onSendMessage, onInsertText, onInsertImage, onReplaceContent, onClose }) => {
  const [input, setInput] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  const handleSend = () => {
    if (!input.trim() && attachedFiles.length === 0) return;
    onSendMessage(input, attachedFiles);
    setInput('');
    setAttachedFiles([]);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string;
        setAttachedFiles(prev => [...prev, {
          id: Date.now().toString(),
          name: file.name,
          type: file.type.startsWith('image') ? 'image' : 'text',
          content: base64,
          mimeType: file.type
        }]);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-800 border-l border-gray-200 dark:border-zinc-700 w-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-zinc-700 flex items-center justify-between shrink-0">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <Sparkles className="text-blue-500 w-5 h-5" />
          AI Помощник
        </h2>
        {onClose && (
          <button 
            onClick={onClose} 
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-700 md:hidden"
          >
            <X size={20} className="text-gray-500" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-10 text-sm">
            <p>Задайте вопрос, попросите сгенерировать текст или картинку.</p>
            <p className="mt-2 text-xs">Я вижу ваш документ и могу помочь отредактировать его.</p>
          </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] rounded-2xl p-3 shadow-sm ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 dark:bg-zinc-700 dark:text-gray-100'
            }`}>
              {/* Attachments */}
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {msg.attachments.map(file => (
                    file.type === 'image' && (
                      <div key={file.id} className="relative">
                          <img src={file.content} alt="attached" className="max-w-full h-auto rounded bg-black/10" style={{maxHeight: '200px'}} />
                      </div>
                    )
                  ))}
                </div>
              )}

              <div className="whitespace-pre-wrap text-sm leading-relaxed overflow-x-auto break-all">
                  {msg.content}
              </div>
              
              {/* Actions for Model Messages */}
              {msg.role === 'model' && !msg.isError && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-black/10 dark:border-white/10 pt-2">
                  {msg.isAction ? (
                      <div className="flex items-center gap-1 text-green-600 dark:text-green-400 text-xs">
                          <CheckCircle2 size={12} />
                          <span>Выполнено автоматически</span>
                      </div>
                  ) : (
                    <>
                      <button 
                        onClick={() => { onInsertText(msg.content); if(window.innerWidth < 768 && onClose) onClose(); }}
                        className="text-xs px-2 py-1 rounded bg-white dark:bg-zinc-600 border border-gray-200 dark:border-zinc-500 hover:bg-gray-50 dark:hover:bg-zinc-500 flex items-center gap-1 transition-colors"
                      >
                        <Copy size={12}/> Вставить
                      </button>
                      
                      {/* Only show 'Картинку' if it looks like a base64 string in text (legacy fallback) */}
                      {msg.content.startsWith('data:image') && !msg.attachments && (
                        <button 
                        onClick={() => { onInsertImage(msg.content); if(window.innerWidth < 768 && onClose) onClose(); }}
                        className="text-xs px-2 py-1 rounded bg-white dark:bg-zinc-600 border border-gray-200 dark:border-zinc-500 hover:bg-gray-50 dark:hover:bg-zinc-500 flex items-center gap-1 transition-colors"
                      >
                        <ImageIcon size={12}/> Картинку
                      </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="flex justify-start">
             <div className="bg-gray-100 dark:bg-zinc-700 p-3 rounded-2xl">
               <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 shrink-0">
        {attachedFiles.length > 0 && (
          <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
            {attachedFiles.map(file => (
               <div key={file.id} className="relative group shrink-0">
                  <img src={file.content} className="w-16 h-16 object-cover rounded border dark:border-zinc-600" />
                  <button 
                    onClick={() => setAttachedFiles(prev => prev.filter(f => f.id !== file.id))}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-md"
                  >
                    <X size={12} />
                  </button>
               </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-500 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-lg transition-colors shrink-0"
            title="Прикрепить изображение"
          >
            <ImageIcon size={20} />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleFileSelect}
          />
          
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Спросите..."
            className="flex-1 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none max-h-32 min-h-[42px]"
            rows={1}
          />
          
          <button 
            onClick={handleSend}
            disabled={(!input.trim() && attachedFiles.length === 0) || isThinking}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-end shrink-0"
          >
            {isThinking ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Assistant;