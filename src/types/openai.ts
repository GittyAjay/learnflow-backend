import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

// Request types
export interface ChatCompletionRequest {
  messages: ChatCompletionMessageParam[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

export interface TextCompletionRequest {
  prompt: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

export interface EmbeddingRequest {
  input: string | string[];
  model?: string;
}

// Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string;
  usage?: any;
}

export interface ChatCompletionResponse extends ApiResponse {
  data?: {
    role: string;
    content: string;
  };
}

export interface TextCompletionResponse extends ApiResponse {
  data?: string;
}

export interface EmbeddingResponse extends ApiResponse {
  data?: Array<{
    object: string;
    embedding: number[];
    index: number;
  }>;
}

export interface ModelsResponse extends ApiResponse {
  data?: Array<{
    id: string;
    object: string;
    created: number;
    owned_by: string;
  }>;
} 