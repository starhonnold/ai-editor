export type ModelProvider = 'gemini' | 'vllm';

export interface VLLMConfig {
  baseUrl: string;
  apiKey: string; // Optional for some local setups
}

export interface AIConfig {
  provider: ModelProvider;
  textModel: string;
  imageModel: string;
  visionModel: string;
  vllm: VLLMConfig;
}

export interface UploadedFile {
  id: string;
  name: string;
  type: 'image' | 'text' | 'pdf';
  content: string; // Base64 or Text content
  mimeType: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  attachments?: UploadedFile[];
  timestamp: number;
  isError?: boolean;
  isAction?: boolean; // Indicates if this message involved an automatic action
}

export interface KnowledgeBaseItem {
  id: string;
  title: string;
  content: string;
  type: 'reference' | 'knowledge'; // reference = copy style, knowledge = RAG
}

export interface AIAction {
  type: 'replace' | 'append';
  content: string;
}

export interface AIResponse {
  text: string;
  action?: AIAction;
}