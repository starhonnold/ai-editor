import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface ParagraphSettings {
  alignment: 'left' | 'center' | 'right' | 'justify';
  indentLeft: number; // в см
  indentRight: number; // в см
  firstLineIndent: number; // в см (0 = нет, положительное = отступ, отрицательное = выступ)
  mirrorIndents: boolean;
  spacingBefore: number; // в пт
  spacingAfter: number; // в пт
  lineSpacing: 'single' | '1.5' | 'double' | 'multiple' | 'atLeast' | 'exactly';
  lineSpacingValue: number; // для multiple, atLeast, exactly
  noSpaceBetweenSameStyle: boolean;
}

interface ParagraphDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (settings: ParagraphSettings) => void;
  currentSettings?: Partial<ParagraphSettings>;
}

const ParagraphDialog: React.FC<ParagraphDialogProps> = ({ isOpen, onClose, onApply, currentSettings }) => {
  const [activeTab, setActiveTab] = useState<'indents' | 'page'>('indents');
  
  const [settings, setSettings] = useState<ParagraphSettings>({
    alignment: 'left',
    indentLeft: 0,
    indentRight: 0,
    firstLineIndent: 0,
    mirrorIndents: false,
    spacingBefore: 0,
    spacingAfter: 10,
    lineSpacing: 'multiple',
    lineSpacingValue: 1.15,
    noSpaceBetweenSameStyle: false,
    ...currentSettings
  });

  useEffect(() => {
    if (currentSettings) {
      setSettings(prev => ({ ...prev, ...currentSettings }));
    }
  }, [currentSettings]);

  if (!isOpen) return null;

  const handleApply = () => {
    onApply(settings);
    onClose();
  };

  const handleCancel = () => {
    if (currentSettings) {
      setSettings(prev => ({ ...prev, ...currentSettings }));
    }
    onClose();
  };

  // Конвертация см в пиксели для предпросмотра (примерно 1см = 37.8px)
  const cmToPx = (cm: number) => cm * 37.8;
  const ptToPx = (pt: number) => pt * 1.33;

  const previewStyle: React.CSSProperties = {
    textAlign: settings.alignment,
    marginLeft: `${cmToPx(settings.indentLeft)}px`,
    marginRight: `${cmToPx(settings.indentRight)}px`,
    paddingLeft: settings.firstLineIndent > 0 ? `${cmToPx(settings.firstLineIndent)}px` : '0',
    textIndent: settings.firstLineIndent < 0 ? `${cmToPx(Math.abs(settings.firstLineIndent))}px` : '0',
    marginTop: `${ptToPx(settings.spacingBefore)}px`,
    marginBottom: `${ptToPx(settings.spacingAfter)}px`,
    lineHeight: settings.lineSpacing === 'single' ? '1' :
                settings.lineSpacing === '1.5' ? '1.5' :
                settings.lineSpacing === 'double' ? '2' :
                settings.lineSpacing === 'multiple' ? settings.lineSpacingValue.toString() :
                settings.lineSpacing === 'atLeast' ? `${ptToPx(settings.lineSpacingValue)}px` :
                `${ptToPx(settings.lineSpacingValue)}px`,
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={handleCancel}>
      <div 
        className="bg-white dark:bg-zinc-800 rounded-lg shadow-2xl w-[90%] max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Абзац</h2>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-zinc-700">
          <button
            onClick={() => setActiveTab('indents')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'indents'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Отступы и интервалы
          </button>
          <button
            onClick={() => setActiveTab('page')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'page'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Положение на странице
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'indents' && (
            <div className="space-y-6">
              {/* Общие */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Общие</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Выравнивание</label>
                    <select
                      value={settings.alignment}
                      onChange={(e) => setSettings(prev => ({ ...prev, alignment: e.target.value as any }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-sm"
                    >
                      <option value="left">По левому краю</option>
                      <option value="center">По центру</option>
                      <option value="right">По правому краю</option>
                      <option value="justify">По ширине</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Уровень</label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-sm"
                      defaultValue="body"
                    >
                      <option value="body">Основной текст</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Отступ */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Отступ</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Слева</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={settings.indentLeft}
                          onChange={(e) => setSettings(prev => ({ ...prev, indentLeft: parseFloat(e.target.value) || 0 }))}
                          step="0.1"
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-sm"
                        />
                        <span className="text-xs text-gray-500">см</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Справа</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={settings.indentRight}
                          onChange={(e) => setSettings(prev => ({ ...prev, indentRight: parseFloat(e.target.value) || 0 }))}
                          step="0.1"
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-sm"
                        />
                        <span className="text-xs text-gray-500">см</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Первая строка</label>
                    <select
                      value={settings.firstLineIndent === 0 ? 'none' : settings.firstLineIndent > 0 ? 'indent' : 'outdent'}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSettings(prev => ({
                          ...prev,
                          firstLineIndent: val === 'none' ? 0 : val === 'indent' ? 1.25 : -1.25
                        }));
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-sm"
                    >
                      <option value="none">(нет)</option>
                      <option value="indent">Отступ</option>
                      <option value="outdent">Выступ</option>
                    </select>
                  </div>
                  {settings.firstLineIndent !== 0 && (
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">на:</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={Math.abs(settings.firstLineIndent)}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setSettings(prev => ({
                              ...prev,
                              firstLineIndent: prev.firstLineIndent < 0 ? -val : val
                            }));
                          }}
                          step="0.1"
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-sm"
                        />
                        <span className="text-xs text-gray-500">см</span>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.mirrorIndents}
                      onChange={(e) => setSettings(prev => ({ ...prev, mirrorIndents: e.target.checked }))}
                      className="w-4 h-4"
                    />
                    <label className="text-xs text-gray-600 dark:text-gray-400">Зеркальные отступы</label>
                  </div>
                </div>
              </div>

              {/* Интервал */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Интервал</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Перед</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={settings.spacingBefore}
                          onChange={(e) => setSettings(prev => ({ ...prev, spacingBefore: parseFloat(e.target.value) || 0 }))}
                          step="0.1"
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-sm"
                        />
                        <span className="text-xs text-gray-500">пт</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">После</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={settings.spacingAfter}
                          onChange={(e) => setSettings(prev => ({ ...prev, spacingAfter: parseFloat(e.target.value) || 0 }))}
                          step="0.1"
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-sm"
                        />
                        <span className="text-xs text-gray-500">пт</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Междустрочный</label>
                    <select
                      value={settings.lineSpacing}
                      onChange={(e) => setSettings(prev => ({ ...prev, lineSpacing: e.target.value as any }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-sm"
                    >
                      <option value="single">Одинарный</option>
                      <option value="1.5">1,5 строки</option>
                      <option value="double">Двойной</option>
                      <option value="multiple">Множитель</option>
                      <option value="atLeast">Минимум</option>
                      <option value="exactly">Точно</option>
                    </select>
                  </div>
                  {(settings.lineSpacing === 'multiple' || settings.lineSpacing === 'atLeast' || settings.lineSpacing === 'exactly') && (
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">значение:</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={settings.lineSpacingValue}
                          onChange={(e) => setSettings(prev => ({ ...prev, lineSpacingValue: parseFloat(e.target.value) || 1 }))}
                          step="0.01"
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-sm"
                        />
                        <span className="text-xs text-gray-500">
                          {settings.lineSpacing === 'multiple' ? '' : 'пт'}
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.noSpaceBetweenSameStyle}
                      onChange={(e) => setSettings(prev => ({ ...prev, noSpaceBetweenSameStyle: e.target.checked }))}
                      className="w-4 h-4"
                    />
                    <label className="text-xs text-gray-600 dark:text-gray-400">
                      Не добавлять интервал между абзацами одного стиля
                    </label>
                  </div>
                </div>
              </div>

              {/* Образец */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Образец</h3>
                <div className="border border-gray-300 dark:border-zinc-600 rounded-md p-4 bg-gray-50 dark:bg-zinc-900/50 min-h-[120px]">
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Предыдущий абзац</p>
                  <p style={previewStyle} className="text-sm text-gray-900 dark:text-gray-100">
                    Образец текста
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Следующий абзац</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'page' && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>Настройки положения на странице будут добавлены в будущих версиях</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-zinc-700">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Отмена
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleApply}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParagraphDialog;

