import { CopilotMessage, VOCPilotConfig } from '../../engine/types';
import { LLMProvider, LLMStreamOptions, TokenUsage } from '../types';

export class OpenAICompatibleProvider implements LLMProvider {
  async streamChat(
    messages: CopilotMessage[],
    systemPrompt: string,
    config: VOCPilotConfig,
    apiKey?: string,
    options?: LLMStreamOptions
  ): Promise<string> {
    const endpoint = (config.endpointUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
    const url = `${endpoint}/chat/completions`;

    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const isGrafanaProxy = endpoint.startsWith('/api/plugin-proxy/');
    if (apiKey && !isGrafanaProxy) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.modelName || 'gpt-4o-mini',
        messages: formattedMessages,
        stream: true,
        stream_options: { include_usage: true },
        temperature: config.temperature ?? 0.2,
        max_tokens: config.maxTokens ?? 450,
      }),
      signal: options?.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Falha no Provedor OpenAI-compatible (${response.status}): ${errText || response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is empty');
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
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') {
            continue;
          }

          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6));

              // Extrai contagem nativa de tokens se o endpoint enviar
              if (data.usage) {
                reportedUsage = {
                  promptTokens: data.usage.prompt_tokens || 0,
                  completionTokens: data.usage.completion_tokens || 0,
                  totalTokens: data.usage.total_tokens || 0,
                };
                options?.onUsage?.(reportedUsage);
              }

              const chunk = data.choices?.[0]?.delta?.content || '';
              if (chunk) {
                fullText += chunk;
                options?.onChunk(chunk);
              }
            } catch {
              // Fragmento JSON incompleto no buffer
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Se o modelo não enviou objeto de usage nativo, calcula estimativa heurística (~4 caracteres por token)
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
