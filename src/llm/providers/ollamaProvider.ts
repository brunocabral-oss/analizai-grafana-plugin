import { CopilotMessage, VOCPilotConfig } from '../../engine/types';
import { LLMProvider, LLMStreamOptions, TokenUsage } from '../types';

export class OllamaProvider implements LLMProvider {
  async streamChat(
    messages: CopilotMessage[],
    systemPrompt: string,
    config: VOCPilotConfig,
    _apiKey?: string,
    options?: LLMStreamOptions
  ): Promise<string> {
    const endpoint = (config.endpointUrl || 'http://localhost:11434').replace(/\/$/, '');
    const url = `${endpoint}/api/chat`;

    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.modelName || 'llama3:8b',
        messages: formattedMessages,
        stream: true,
        options: {
          temperature: config.temperature ?? 0.2,
          num_predict: config.maxTokens ?? 450,
        },
      }),
      signal: options?.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Falha no Ollama (${response.status}): ${errText || response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Ollama response body is empty');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '';
    let buffer = '';
    let reportedUsage: TokenUsage | null = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) {
            continue;
          }
          try {
            const parsed = JSON.parse(line);

            // No Ollama, a contagem de tokens vem no último chunk quando done === true
            if (parsed.done && (parsed.prompt_eval_count || parsed.eval_count)) {
              reportedUsage = {
                promptTokens: parsed.prompt_eval_count || 0,
                completionTokens: parsed.eval_count || 0,
                totalTokens: (parsed.prompt_eval_count || 0) + (parsed.eval_count || 0),
              };
              options?.onUsage?.(reportedUsage);
            }

            const chunk = parsed.message?.content || '';
            if (chunk) {
              fullText += chunk;
              options?.onChunk(chunk);
            }
          } catch {
            // Linha parcial ignorada
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Fallback heurístico se o servidor não enviou métricas
    if (!reportedUsage) {
      const promptChars = systemPrompt.length + messages.reduce((acc, m) => acc + m.content.length, 0);
      const estPromptTokens = Math.max(1, Math.round(promptChars / 4));
      const estCompletionTokens = Math.max(1, Math.round(fullText.length / 4));
      reportedUsage = {
        promptTokens: estPromptTokens,
        completionTokens: estCompletionTokens,
        totalTokens: estPromptTokens + estCompletionTokens,
      };
      options?.onUsage?.(reportedUsage);
    }

    options?.onFinish?.(fullText);
    return fullText;
  }
}
