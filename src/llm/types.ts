import { CopilotMessage, VOCPilotConfig } from '../engine/types';

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMStreamOptions {
  onChunk: (chunk: string) => void;
  onError?: (error: Error) => void;
  onFinish?: (fullText: string) => void;
  onUsage?: (usage: TokenUsage) => void;
  signal?: AbortSignal;
}

export interface LLMProvider {
  streamChat(
    messages: CopilotMessage[],
    systemPrompt: string,
    config: VOCPilotConfig,
    apiKey?: string,
    options?: LLMStreamOptions
  ): Promise<string>;
}
