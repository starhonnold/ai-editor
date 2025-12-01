import React, { useState } from 'react';
import { Settings, Book, FileText, Upload, Trash2, RefreshCw, Sun, Moon, AlertCircle, ChevronDown, ChevronRight, GraduationCap } from 'lucide-react';
import { AIConfig, KnowledgeBaseItem, ModelProvider } from '../types';
import { fetchVLLMModels } from '../services/aiService';
import { DEFAULT_GEMINI_MODELS } from '../constants';

interface SidebarProps {
  config: AIConfig;
  onConfigChange: (newConfig: AIConfig) => void;
  kbItems: KnowledgeBaseItem[];
  onAddKB: (item: KnowledgeBaseItem) => void;
  onRemoveKB: (id: string) => void;
  isDark: boolean;
  toggleTheme: () => void;
  stats: {
    wordCount: number;
    charCount: number;
    lastSaved: Date | null;
  };
  onRestartOnboarding?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ config, onConfigChange, kbItems, onAddKB, onRemoveKB, isDark, toggleTheme, stats, onRestartOnboarding }) => {
  const [activeTab, setActiveTab] = useState<'settings' | 'knowledge'>('knowledge');
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [availableVLLMModels, setAvailableVLLMModels] = useState<string[]>([]);
  
  // Section Collapse State
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    reference: true,
    knowledge: true,
    appearance: true,
    provider: true,
    vllm: true,
    gemini: true
  });

  const toggleSection = (key: string) => {
    setExpanded(prev => ({...prev, [key]: !prev[key]}));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'reference' | 'knowledge') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        onAddKB({
          id: Date.now().toString(),
          title: file.name,
          content: text,
          type: type
        });
      };
      reader.readAsText(file);
    }
  };

  const handleFetchModels = async () => {
    if (!config.vllm.baseUrl) return;
    setLoadingModels(true);
    setModelError(null);
    try {
      const models = await fetchVLLMModels(config.vllm.baseUrl);
      setAvailableVLLMModels(models);
    } catch (e: any) {
      setModelError(e.message);
      setAvailableVLLMModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  // Helper for Section Headers
  const SectionHeader = ({ title, id }: { title: string, id: string }) => (
    <button 
        onClick={() => toggleSection(id)}
        className="flex items-center w-full text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none"
    >
        {expanded[id] ? <ChevronDown size={14} className="mr-1"/> : <ChevronRight size={14} className="mr-1"/>}
        {title}
    </button>
  );

  return (
    <div className="h-full bg-gray-50 dark:bg-zinc-900 flex flex-col w-80 transition-colors">
      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-zinc-700 shrink-0">
        <button
          onClick={() => setActiveTab('knowledge')}
          className={`flex-1 p-3 text-sm font-medium flex items-center justify-center gap-2 ${activeTab === 'knowledge' ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}
        >
          <Book size={16} /> База
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 p-3 text-sm font-medium flex items-center justify-center gap-2 ${activeTab === 'settings' ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}
        >
          <Settings size={16} /> Настройки
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 min-w-0">
        {activeTab === 'knowledge' && (
          <div className="space-y-6">
            
            {/* Template/Reference Section */}
            <div>
              <SectionHeader title="Эталон (Стиль)" id="reference" />
              {expanded.reference && (
                  <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="bg-white dark:bg-zinc-800 p-3 rounded-lg border border-gray-200 dark:border-zinc-700">
                        {kbItems.find(k => k.type === 'reference') ? (
                        <div className="flex items-center justify-between">
                            <span className="text-sm truncate w-40">{kbItems.find(k => k.type === 'reference')?.title}</span>
                            <button onClick={() => onRemoveKB(kbItems.find(k => k.type === 'reference')!.id)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                            <Trash2 size={14}/>
                            </button>
                        </div>
                        ) : (
                        <label className="flex flex-col items-center justify-center h-20 border-2 border-dashed border-gray-300 dark:border-zinc-600 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-700">
                            <FileText size={20} className="text-gray-400 mb-1" />
                            <span className="text-xs text-gray-500">Загрузить пример</span>
                            <input type="file" className="hidden" accept=".txt,.md" onChange={(e) => handleFileUpload(e, 'reference')} />
                        </label>
                        )}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">Загрузите документ, чей стиль вы хотите скопировать.</p>
                  </div>
              )}
            </div>

            {/* Knowledge Base Section */}
            <div>
              <SectionHeader title="База знаний (Факты)" id="knowledge" />
              {expanded.knowledge && (
                  <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                    <label className="flex items-center justify-center w-full p-2 mb-3 bg-blue-50 text-blue-600 rounded border border-blue-200 cursor-pointer hover:bg-blue-100 dark:bg-zinc-800 dark:text-blue-400 dark:border-zinc-700">
                        <Upload size={16} className="mr-2"/>
                        <span className="text-sm">Добавить документ</span>
                        <input type="file" className="hidden" accept=".txt,.md" onChange={(e) => handleFileUpload(e, 'knowledge')} />
                    </label>

                    <div className="space-y-2">
                        {kbItems.filter(k => k.type === 'knowledge').map(item => (
                        <div key={item.id} className="flex items-center justify-between bg-white dark:bg-zinc-800 p-2 rounded border border-gray-200 dark:border-zinc-700">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <FileText size={14} className="text-gray-400 shrink-0"/>
                                <span className="text-sm truncate">{item.title}</span>
                            </div>
                            <button onClick={() => onRemoveKB(item.id)} className="text-gray-400 hover:text-red-500">
                                <Trash2 size={14}/>
                            </button>
                        </div>
                        ))}
                        {kbItems.filter(k => k.type === 'knowledge').length === 0 && (
                        <p className="text-xs text-gray-400 text-center">Нет документов</p>
                        )}
                    </div>
                  </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            
            {/* Appearance */}
             <div>
               <SectionHeader title="Внешний вид" id="appearance" />
               {expanded.appearance && (
                   <div className="animate-in fade-in slide-in-from-top-1 duration-200 space-y-2">
                        <button 
                            onClick={toggleTheme}
                            className="w-full flex items-center justify-between p-2 bg-white dark:bg-zinc-800 rounded border border-gray-200 dark:border-zinc-700"
                        >
                            <span className="text-sm">Тема</span>
                            {isDark ? <Moon size={16}/> : <Sun size={16}/>}
                        </button>
                        {onRestartOnboarding && (
                          <button 
                            onClick={onRestartOnboarding}
                            className="w-full flex items-center justify-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                          >
                            <GraduationCap size={16} />
                            <span className="text-sm">Повторить туториал</span>
                          </button>
                        )}
                   </div>
               )}
             </div>

            {/* Provider Selection */}
            <div>
              <SectionHeader title="Провайдер AI" id="provider" />
              {expanded.provider && (
                  <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="flex bg-gray-200 dark:bg-zinc-800 rounded p-1">
                        <button 
                        onClick={() => onConfigChange({...config, provider: 'gemini'})}
                        className={`flex-1 text-xs py-1.5 rounded ${config.provider === 'gemini' ? 'bg-white shadow text-black' : 'text-gray-500'}`}
                        >
                        Gemini
                        </button>
                        <button 
                        onClick={() => onConfigChange({...config, provider: 'vllm'})}
                        className={`flex-1 text-xs py-1.5 rounded ${config.provider === 'vllm' ? 'bg-white shadow text-black' : 'text-gray-500'}`}
                        >
                        vLLM (Local)
                        </button>
                    </div>
                  </div>
              )}
            </div>

            {/* vLLM Specific Settings */}
            {config.provider === 'vllm' && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                 <div className="space-y-3 p-3 bg-gray-100 dark:bg-zinc-800 rounded border border-gray-200 dark:border-zinc-700">
                    <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Base URL</label>
                    <input 
                        type="text" 
                        value={config.vllm.baseUrl}
                        onChange={(e) => onConfigChange({...config, vllm: {...config.vllm, baseUrl: e.target.value}})}
                        placeholder="http://localhost:8000"
                        className="w-full text-xs p-2 rounded border dark:bg-zinc-900 dark:border-zinc-600"
                    />
                    </div>
                    <button 
                    onClick={handleFetchModels}
                    disabled={loadingModels || !config.vllm.baseUrl}
                    className="w-full flex items-center justify-center gap-2 bg-black text-white dark:bg-white dark:text-black py-1.5 rounded text-xs hover:opacity-80 disabled:opacity-50"
                    >
                    {loadingModels ? <RefreshCw className="animate-spin" size={12}/> : "Подключить модели (up)"}
                    </button>

                    {modelError && (
                        <div className="flex items-start gap-2 text-xs text-red-500 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-900/50">
                            <AlertCircle size={14} className="mt-0.5 shrink-0"/>
                            <span>{modelError}. Проверьте CORS и адрес сервера.</span>
                        </div>
                    )}
                    
                    {availableVLLMModels.length > 0 && (
                    <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Текстовая модель</label>
                        <select 
                        value={config.textModel}
                        onChange={(e) => onConfigChange({...config, textModel: e.target.value})}
                        className="w-full text-xs p-2 rounded border dark:bg-zinc-900 dark:border-zinc-600"
                        >
                        {availableVLLMModels.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                    )}
                 </div>
              </div>
            )}

            {/* Gemini Specific Settings (Read Only mostly, or model selection) */}
            {config.provider === 'gemini' && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="space-y-3 p-3 bg-blue-50 dark:bg-zinc-800/50 rounded border border-blue-100 dark:border-blue-900/30">
                    <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Текстовая модель</label>
                    <select 
                        value={config.textModel}
                        onChange={(e) => onConfigChange({...config, textModel: e.target.value})}
                        className="w-full text-xs p-2 rounded border dark:bg-zinc-900 dark:border-zinc-600"
                    >
                        <option value={DEFAULT_GEMINI_MODELS.TEXT}>Flash 2.5 (Быстрая, бесплатный тариф)</option>
                        <option value={DEFAULT_GEMINI_MODELS.COMPLEX}>Flash 1.5 (Альтернативная, бесплатный тариф)</option>
                    </select>
                    <p className="text-[10px] text-gray-400 mt-1">Обе модели доступны в бесплатном тарифе</p>
                    </div>
                    <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Vision модель</label>
                        <div className="text-xs text-gray-500 bg-white dark:bg-zinc-900 p-2 rounded border dark:border-zinc-600">
                        {DEFAULT_GEMINI_MODELS.VISION}
                        </div>
                    </div>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
      
      {/* Footer Stats */}
      <div className="p-4 border-t border-gray-200 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800 text-xs text-gray-500 dark:text-gray-400 shrink-0">
        <div className="flex justify-between mb-1">
          <span>Слов:</span>
          <span className="font-medium">{stats.wordCount}</span>
        </div>
        <div className="flex justify-between mb-1">
          <span>Знаков:</span>
          <span className="font-medium">{stats.charCount}</span>
        </div>
        <div className="mt-2 text-[10px] text-right">
           {stats.lastSaved ? `Сохранено: ${stats.lastSaved.toLocaleTimeString()}` : 'Не сохранено'}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;