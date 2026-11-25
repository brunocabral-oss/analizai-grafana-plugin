import { VOCPilotConfig } from '../engine/types';
import { LLMProvider } from './types';
import { OllamaProvider } from './providers/ollamaProvider';
import { OpenAICompatibleProvider } from './providers/openaiCompatibleProvider';
import { MockLLMProvider } from './providers/mockProvider';

export class LLMClientFactory {
  public static getProvider(config: VOCPilotConfig): LLMProvider {
    switch (config.provider) {
      case 'mock':
        return new MockLLMProvider();
      case 'ollama':
        return new OllamaProvider();
      case 'openai':
      case 'groq':
      case 'vllm':
      default:
        return new OpenAICompatibleProvider();
    }
  }
}
