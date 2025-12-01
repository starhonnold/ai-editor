import { GoogleGenAI, GenerateContentResponse, FunctionDeclaration, Type } from "@google/genai";
import { AIConfig, UploadedFile, KnowledgeBaseItem, AIResponse } from '../types';
import { DEFAULT_GEMINI_MODELS, INITIAL_SYSTEM_PROMPT, VLLM_EDIT_INSTRUCTION } from '../constants';

// --- Helpers ---

const fileToGeminiPart = (file: UploadedFile) => {
  return {
    inlineData: {
      data: file.content.split(',')[1], // Remove data URL prefix
      mimeType: file.mimeType
    }
  };
};

const cleanAIResponse = (text: string): string => {
    // 1. Check for wrapped markdown code blocks ```html ... ``` or ``` ... ```
    const codeBlockMatch = text.match(/```(?:html)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch && codeBlockMatch[1]) {
        return codeBlockMatch[1].trim();
    }
    // 2. Fallback: remove simple markdown wrappers if start/end match, but heuristic primarily
    return text.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
};

const buildContextPrompt = (kb: KnowledgeBaseItem[], reference: KnowledgeBaseItem | null, currentDoc: string) => {
  let context = "";
  
  // Truncate document content to prevent token limit exceeded errors (e.g., if base64 is accidentally pasted as text)
  // Limit to approx 100k chars (roughly 25k tokens), leaving plenty of room for instruction and output.
  const SAFE_DOC_LIMIT = 100000;
  let safeDoc = currentDoc || "";
  if (safeDoc.length > SAFE_DOC_LIMIT) {
      safeDoc = safeDoc.substring(0, SAFE_DOC_LIMIT) + "\n\n[...Document Truncated for AI Context...]";
  }

  if (safeDoc.trim().length > 0) {
      context += "\n\n=== ТЕКУЩЕЕ СОДЕРЖИМОЕ ДОКУМЕНТА ===\n";
      context += "Ниже приведен полный текст документа, который пользователь сейчас редактирует. Используй этот контекст, если пользователь просит изменить, проверить или дополнить текст.\n";
      context += `START_DOCUMENT\n${safeDoc}\nEND_DOCUMENT\n`;
  }

  const knowledgeItems = kb.filter(k => k.type === 'knowledge');
  if (knowledgeItems.length > 0) {
    context += "\n\n=== БАЗА ЗНАНИЙ (ФАКТЫ) ===\n";
    knowledgeItems.forEach(item => {
      context += `--- ${item.title} ---\n${item.content.substring(0, 5000)}\n...\n`;
    });
  }

  if (reference) {
    context += "\n\n=== ЭТАЛОН (СТИЛЬ И ФОРМАТ) ===\n";
    context += `Постарайся скопировать стиль письма из этого документа:\n${reference.content.substring(0, 5000)}\n...\n`;
  }

  return context;
};

// --- Deterministic Generators (No-AI) ---

export const generateDeterministicChart = (text: string, type: 'chart' | 'diagram' | 'chart-bar' | 'chart-line' | 'chart-pie'): string | null => {
  const lines = text.trim().split('\n').filter(l => l.trim());
  
  if (type === 'diagram') {
    // GraphViz logic for Diagrams
    // Detect relations: A -> B, A => B
    let dot = 'digraph G { rankdir=LR; node [style="filled", fillcolor="#e0f2fe", color="#0284c7", fontname="Arial"]; edge [color="#64748b"]; bgcolor="transparent"; ';
    let valid = false;
    lines.forEach(line => {
      // Split by arrow patterns
      const parts = line.split(/->|=>|-->/);
      if (parts.length >= 2) {
         const from = parts[0].trim();
         const to = parts[1].trim();
         // Sanitize labels
         dot += `"${from.replace(/"/g, '')}" -> "${to.replace(/"/g, '')}"; `;
         valid = true;
      }
    });
    dot += '}';
    
    if (!valid) return null;
    return `https://quickchart.io/graphviz?graph=${encodeURIComponent(dot)}`;
  } 
  
  // Chart logic (Bar, Line, Pie)
  // 1. Determine Chart Type
  let chartType = 'bar';
  if (type === 'chart-line') chartType = 'line';
  if (type === 'chart-pie') chartType = 'pie';
  
  // Check text for override. E.g. "Type: Pie"
  const typeMatch = text.match(/Type:\s*(pie|bar|line|doughnut|radar)/i);
  if (typeMatch) {
      chartType = typeMatch[1].toLowerCase();
  }

  // 2. Parse Title
  let title = 'График';
  const titleMatch = text.match(/Title:\s*(.+)/i);
  if (titleMatch) {
      title = titleMatch[1].trim();
  }
  
  // 3. Parse Data: "Label, Value, [Color]"
  const labels: string[] = [];
  const data: number[] = [];
  const colors: string[] = [];
  
  lines.forEach(line => {
    if (line.match(/^(Type|Title):/i)) return; // Skip metadata lines

    // Regex matches: Label followed by separator, Value, optional separator, optional Color
    // e.g. "Apple, 10, red" or "Apple 10 #ff0000"
    const match = line.match(/^(.+?)[\s,:\t]+(\d+(\.\d+)?)[\s,:\t]*(#\w{3,6}|[a-z]+)?$/i);
    if (match) {
       labels.push(match[1].trim());
       data.push(parseFloat(match[2]));
       if (match[4]) {
           colors.push(match[4]);
       }
    }
  });

  if (labels.length === 0) return null;

  // 4. Default Colors if not provided
  const defaultColors = [
      'rgba(59, 130, 246, 0.7)', // Blue
      'rgba(239, 68, 68, 0.7)', // Red
      'rgba(16, 185, 129, 0.7)', // Green
      'rgba(245, 158, 11, 0.7)', // Yellow
      'rgba(139, 92, 246, 0.7)', // Purple
  ];

  let backgroundColors: string | string[];
  let borderColors: string | string[];
  
  if (colors.length === data.length) {
      // Use user provided colors
      backgroundColors = colors;
      borderColors = colors;
  } else if (chartType === 'pie' || chartType === 'doughnut') {
      // Pie charts need different colors for each slice
      backgroundColors = labels.map((_, i) => defaultColors[i % defaultColors.length]);
      borderColors = 'white';
  } else {
      // Bar/Line usually single color unless specified
      backgroundColors = 'rgba(59, 130, 246, 0.6)';
      borderColors = 'rgba(59, 130, 246, 1)';
  }

  const chartConfig = {
    type: chartType,
    data: {
      labels: labels,
      datasets: [{
        label: 'Значения',
        data: data,
        backgroundColor: backgroundColors,
        borderColor: borderColors,
        borderWidth: 1,
        fill: chartType === 'line' ? false : true
      }]
    },
    options: {
       plugins: {
         title: { display: true, text: title },
         legend: { display: (chartType === 'pie' || chartType === 'doughnut') },
         datalabels: { 
             display: true, 
             anchor: chartType === 'pie' ? 'center' : 'end', 
             align: chartType === 'pie' ? 'center' : 'top',
             color: chartType === 'pie' ? 'white' : 'black'
         }
       },
       scales: (chartType === 'pie' || chartType === 'doughnut') ? undefined : {
         y: { beginAtZero: true }
       }
    }
  };
  
  return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&width=500&height=300&bkg=white`;
};

export const generateDeterministicTable = (text: string): string => {
   const lines = text.trim().split('\n').filter(l => l.trim());
   if (lines.length === 0) return text;

   let html = '<table style="border-collapse: collapse; width: 100%; margin: 10px 0; border: 1px solid #e5e7eb;">';
   lines.forEach((line, i) => {
       const isHeader = i === 0;
       const tag = isHeader ? 'th' : 'td';
       const bg = isHeader ? 'background-color: #f9fafb;' : '';
       const weight = isHeader ? 'font-weight: 600;' : '';
       
       // Split by comma, tab, pipe, or double space
       const cells = line.split(/,|\t|\|| {2,}/);
       
       html += '<tr>';
       cells.forEach(cell => {
           html += `<${tag} style="border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; ${bg} ${weight} color: #1f2937;">${cell.trim()}</${tag}>`;
       });
       html += '</tr>';
   });
   html += '</table>';
   return html;
};

// --- Gemini Implementation ---

const getGeminiClient = () => {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Tool Definition for Gemini
const updateDocumentTool: FunctionDeclaration = {
  name: 'update_document',
  description: 'Обновляет или заменяет содержимое редактора документа. Используйте это, когда пользователь просит написать, отредактировать или отформатировать документ прямо в редакторе.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      content: {
        type: Type.STRING,
        description: 'Полное новое содержимое документа (в формате HTML или Markdown).',
      },
    },
    required: ['content'],
  },
};

export const generateGeminiResponse = async (
  prompt: string,
  images: UploadedFile[],
  config: AIConfig,
  kb: KnowledgeBaseItem[],
  reference: KnowledgeBaseItem | null,
  history: { role: string, parts: any[] }[],
  currentDocumentContent: string = ""
): Promise<AIResponse> => {
  try {
    const ai = getGeminiClient();
    const modelName = images.length > 0 ? (config.visionModel || DEFAULT_GEMINI_MODELS.VISION) : (config.textModel || DEFAULT_GEMINI_MODELS.TEXT);
    
    const context = buildContextPrompt(kb, reference, currentDocumentContent);
    const systemInstruction = INITIAL_SYSTEM_PROMPT + context;

    const currentParts: any[] = [{ text: prompt }];
    images.forEach(img => {
      currentParts.push(fileToGeminiPart(img));
    });

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: modelName,
      contents: {
        role: 'user',
        parts: currentParts
      },
      config: {
        systemInstruction: systemInstruction,
        tools: [{ functionDeclarations: [updateDocumentTool] }],
      }
    });

    const functionCalls = response.functionCalls;
    if (functionCalls && functionCalls.length > 0) {
      const toolCall = functionCalls[0];
      if (toolCall.name === 'update_document') {
        const contentArgs = toolCall.args as any;
        // Clean markdown from tool args
        const cleanContent = cleanAIResponse(contentArgs.content);
        return {
          text: response.text || "Документ обновлен автоматически.",
          action: {
            type: 'replace',
            content: cleanContent
          }
        };
      }
    }

    // Clean markdown from standard text response if it's meant to be inserted
    return { text: response.text || "Нет ответа от модели." };
  } catch (error: any) {
    console.error("Gemini Error:", error);
    
    // Улучшенная обработка ошибок квоты и доступа
    let errorMessage = error.message || error.toString() || "Неизвестная ошибка";
    
    // Попытка парсинга JSON ошибки, если ошибка в формате строки
    try {
      if (typeof errorMessage === 'string' && errorMessage.trim().startsWith('{')) {
        const parsedError = JSON.parse(errorMessage);
        if (parsedError.error && parsedError.error.message) {
          errorMessage = parsedError.error.message;
        } else if (parsedError.message) {
          errorMessage = parsedError.message;
        }
      }
    } catch (e) {
      // Если не JSON, продолжаем с оригинальным сообщением
    }
    
    // Проверка на ошибку квоты (429 или RESOURCE_EXHAUSTED)
    const isQuotaError = error.status === 429 || error.statusCode === 429 || 
        errorMessage.includes("quota") || errorMessage.includes("RESOURCE_EXHAUSTED") ||
        errorMessage.includes("429") || errorMessage.includes("exceeded") ||
        errorMessage.includes("Quota exceeded") || errorMessage.includes("free_tier");
    
    if (isQuotaError) {
      // Проверка, используется ли недоступная модель
      const usingUnavailableModel = errorMessage.includes("gemini-3-pro") || 
                                     errorMessage.includes("gemini-1.5-pro") ||
                                     errorMessage.includes("free_tier_requests");
      
      errorMessage = "Превышен лимит запросов к API.\n\n" +
        "Возможные причины:\n" +
        "• Используется модель, недоступная в бесплатном тарифе (gemini-3-pro, gemini-1.5-pro)\n" +
        "• Превышен дневной/минутный лимит запросов\n\n" +
        "Решение:\n" +
        "• Переключитесь на gemini-2.5-flash или gemini-1.5-flash в настройках (вкладка 'Настройки' → 'Провайдер AI' → 'Gemini')\n" +
        "• Подождите несколько минут перед следующим запросом\n" +
        "• Проверьте лимиты на https://ai.dev/usage?tab=rate-limit";
    }
    
    // Проверка на ошибку доступа
    if (errorMessage.includes("403") || errorMessage.includes("PERMISSION_DENIED")) {
      errorMessage = "Ошибка доступа к API. Проверьте ваш API ключ и настройки доступа.";
    }
    
    // Проверка на отсутствие API ключа
    if (errorMessage.includes("API_KEY") || errorMessage.includes("api key") || 
        errorMessage.includes("API key")) {
      errorMessage = "API ключ не настроен. Установите GEMINI_API_KEY в переменных окружения.";
    }
    
    return { text: `Ошибка Gemini: ${errorMessage}` };
  }
};

export const generateGeminiImage = async (prompt: string): Promise<string> => {
    try {
        const ai = getGeminiClient();
        const model = DEFAULT_GEMINI_MODELS.IMAGE_GEN;
        
        // Imagen 3 Models use generateImages
        if (model.includes('imagen')) {
             const response = await ai.models.generateImages({
                model: model,
                prompt: prompt,
                config: {
                    numberOfImages: 1,
                    aspectRatio: '1:1',
                    outputMimeType: 'image/png'
                }
            });
            if (response.generatedImages && response.generatedImages.length > 0) {
                 const base64 = response.generatedImages[0].image.imageBytes;
                 return `data:image/png;base64,${base64}`;
            }
        } else {
             // Gemini Models (Flash/Pro) use generateContent
             const response = await ai.models.generateContent({
                model: model,
                contents: { parts: [{ text: prompt }] },
            });
    
            const parts = response.candidates?.[0]?.content?.parts;
            if (parts) {
                for (const part of parts) {
                    if (part.inlineData && part.inlineData.data) {
                        return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
                    }
                }
            }
             // If no image, maybe refusal text
            if (response.text) {
                throw new Error(`Модель вернула текст вместо изображения: ${response.text}`);
            }
        }

        return "";
    } catch (e: any) {
        console.error("Image Gen Error:", e);
        let errorMessage = e.message || e.toString() || "Неизвестная ошибка";
        
        // Попытка парсинга JSON ошибки
        try {
            if (typeof errorMessage === 'string' && errorMessage.trim().startsWith('{')) {
                const parsedError = JSON.parse(errorMessage);
                if (parsedError.error && parsedError.error.message) {
                    errorMessage = parsedError.error.message;
                } else if (parsedError.message) {
                    errorMessage = parsedError.message;
                }
            }
        } catch (parseError) {
            // Если не JSON, продолжаем с оригинальным сообщением
        }
        
        // Улучшенная обработка ошибок для генерации изображений
        const isQuotaError = e.status === 429 || e.statusCode === 429 || 
            errorMessage.includes("quota") || errorMessage.includes("429") || 
            errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("exceeded") ||
            errorMessage.includes("free_tier");
        
        if (isQuotaError) {
            errorMessage = "Генерация изображений недоступна в бесплатном тарифе Gemini API.\n\n" +
                "Альтернативные решения:\n" +
                "• Используйте детерминированную генерацию графиков (встроено в редактор)\n" +
                "• Вставьте изображение вручную через контекстное меню редактора\n" +
                "• Используйте сторонние сервисы для генерации изображений\n\n" +
                "Для генерации графиков используйте формат:\n" +
                "'Создай график: Название, Значение1, Значение2, ...'";
        }
        
        // Проверка на ошибку доступа
        if (errorMessage.includes("403") || errorMessage.includes("PERMISSION_DENIED") ||
            errorMessage.includes("not found") || errorMessage.includes("does not exist")) {
            errorMessage = "Модель генерации изображений недоступна или не поддерживается.\n\n" +
                "Генерация изображений через Gemini API может быть недоступна в бесплатном тарифе.\n" +
                "Используйте альтернативные методы (графики, загрузка изображений).";
        }
        
        throw new Error(errorMessage);
    }
}

// --- vLLM Implementation ---

export const fetchVLLMModels = async (baseUrl: string): Promise<string[]> => {
    try {
        const cleanUrl = baseUrl.replace(/\/$/, '');
        const response = await fetch(`${cleanUrl}/v1/models`);
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        const data = await response.json();
        return data.data.map((m: any) => m.id);
    } catch (error: any) {
        console.error("vLLM Models Error:", error);
        throw new Error(error.message || "Connection failed");
    }
};

export const generateVLLMResponse = async (
    prompt: string,
    config: AIConfig,
    kb: KnowledgeBaseItem[],
    reference: KnowledgeBaseItem | null,
    currentDocumentContent: string = ""
): Promise<AIResponse> => {
    try {
        const cleanUrl = config.vllm.baseUrl.replace(/\/$/, '');
        const context = buildContextPrompt(kb, reference, currentDocumentContent);
        
        const systemPrompt = INITIAL_SYSTEM_PROMPT + VLLM_EDIT_INSTRUCTION + context;

        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
        ];

        const response = await fetch(`${cleanUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(config.vllm.apiKey ? { 'Authorization': `Bearer ${config.vllm.apiKey}` } : {})
            },
            body: JSON.stringify({
                model: config.textModel,
                messages: messages,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`vLLM Error: ${err}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "Пустой ответ от vLLM.";

        const updateRegex = /<<<UPDATE_DOCUMENT>>>([\s\S]*?)<<<END_UPDATE_DOCUMENT>>>/;
        const match = content.match(updateRegex);

        if (match && match[1]) {
            const cleanContent = content.replace(updateRegex, '').trim();
            const newDocContent = cleanAIResponse(match[1].trim());
            return {
                text: cleanContent || "Документ обновлен (vLLM).",
                action: {
                    type: 'replace',
                    content: newDocContent
                }
            };
        }

        return { text: content };

    } catch (error: any) {
        return { text: `Ошибка vLLM: ${error.message}` };
    }
};

// --- Smart Rewrite (Inline Edit) ---

export const rewriteText = async (
    textToRewrite: string,
    instruction: string,
    config: AIConfig
): Promise<string> => {
    const prompt = `
    INSTRUCTION: ${instruction}
    
    ORIGINAL TEXT:
    ${textToRewrite}
    
    TASK: Rewrite the ORIGINAL TEXT according to the INSTRUCTION. Return ONLY the rewritten text without any markdown code blocks or explanations. The output must be HTML fragment ready to be inserted into a contentEditable div.
    `;

    try {
        let responseText = "";
        if (config.provider === 'gemini') {
            const ai = getGeminiClient();
            const response = await ai.models.generateContent({
                model: config.textModel || DEFAULT_GEMINI_MODELS.TEXT,
                contents: { parts: [{ text: prompt }] },
            });
            responseText = response.text || textToRewrite;
        } else {
            const cleanUrl = config.vllm.baseUrl.replace(/\/$/, '');
            const response = await fetch(`${cleanUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(config.vllm.apiKey ? { 'Authorization': `Bearer ${config.vllm.apiKey}` } : {})
                },
                body: JSON.stringify({
                    model: config.textModel,
                    messages: [
                         { role: "system", content: "You are a specialized text editor assistant. Output only the rewritten text in HTML format." },
                         { role: "user", content: prompt }
                    ],
                    temperature: 0.5
                })
            });
            const data = await response.json();
            responseText = data.choices?.[0]?.message?.content || textToRewrite;
        }
        return cleanAIResponse(responseText);
    } catch (e) {
        console.error("Rewrite Error:", e);
        return textToRewrite;
    }
};

// --- Translation Service ---

export const translateText = async (
    textToTranslate: string,
    targetLanguage: string,
    config: AIConfig
): Promise<string> => {
    const prompt = `
    You are a professional translator. 
    Translate the following text into ${targetLanguage}. 
    
    IMPORTANT:
    1. Preserve all HTML formatting (like <b>, <i>, <ul>, etc.) exactly as is.
    2. Do NOT translate technical attributes inside HTML tags.
    3. Output ONLY the translated text in HTML format, no explanations.
    
    TEXT TO TRANSLATE:
    ${textToTranslate}
    `;

    try {
        let responseText = "";
        if (config.provider === 'gemini') {
            const ai = getGeminiClient();
            const response = await ai.models.generateContent({
                model: config.textModel || DEFAULT_GEMINI_MODELS.TEXT,
                contents: { parts: [{ text: prompt }] },
            });
            responseText = response.text || textToTranslate;
        } else {
            const cleanUrl = config.vllm.baseUrl.replace(/\/$/, '');
            const response = await fetch(`${cleanUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(config.vllm.apiKey ? { 'Authorization': `Bearer ${config.vllm.apiKey}` } : {})
                },
                body: JSON.stringify({
                    model: config.textModel,
                    messages: [
                         { role: "system", content: "You are a professional translator. Output only translated HTML." },
                         { role: "user", content: prompt }
                    ],
                    temperature: 0.3
                })
            });
            const data = await response.json();
            responseText = data.choices?.[0]?.message?.content || textToTranslate;
        }
        return cleanAIResponse(responseText);
    } catch (e) {
        console.error("Translate Error:", e);
        return textToTranslate;
    }
};