export interface App {
  id: string;
  title: string;
  description: string;
  prompt: string;
  html: string;
  thumbnail: string | null;
  tags: string[];
  version: number;
  createdAt: number;
  updatedAt: number;
  shareId: string | null;
  forkedFrom: string | null;
}

export interface AppVersion {
  version: number;
  html: string;
  prompt: string;
  timestamp: number;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ProviderConfig {
  provider: 'deepseek' | 'openai' | 'anthropic' | 'ollama' | 'webllm' | 'custom';
  apiKey: string;
  model: string;
  baseUrl: string;
}

export interface GenerationResult {
  html: string;
  title: string;
  description: string;
  tags: string[];
}
