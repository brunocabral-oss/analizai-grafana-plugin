import { MockLLMProvider } from './mockProvider';
import { CopilotMessage, VOCPilotConfig } from '../../engine/types';

describe('MockLLMProvider', () => {
  test('streamChat returns expected sober SRE analysis string', async () => {
    const provider = new MockLLMProvider();
    const messages: CopilotMessage[] = [
      { id: '1', role: 'user', content: 'Analisar picos de latência na API.', timestamp: Date.now() }
    ];
    const systemPrompt = 'System prompt test';
    const config: VOCPilotConfig = {
      provider: 'mock',
      modelName: 'mock-sre',
      endpointUrl: '',
      temperature: 0.2,
      maxTokens: 500
    };

    const result = await provider.streamChat(messages, systemPrompt, config);
    expect(result).toContain('Executive Summary');
    expect(result).toContain('Detected Metrics');
    expect(result).toContain('Recommended Next Steps');
  });

  test('streamChat triggers onChunk, onUsage, and onFinish callbacks', async () => {
    const provider = new MockLLMProvider();
    const messages: CopilotMessage[] = [
      { id: '2', role: 'user', content: 'banco de dados com lentidão no pool', timestamp: Date.now() }
    ];
    const systemPrompt = 'System prompt test';
    const config: VOCPilotConfig = {
      provider: 'mock',
      modelName: 'mock-sre',
      endpointUrl: '',
      temperature: 0.2,
      maxTokens: 500
    };

    let chunksCount = 0;
    let finishedText = '';
    let usageReported = false;

    const options = {
      onChunk: (chunk: string) => {
        chunksCount++;
        expect(typeof chunk).toBe('string');
      },
      onUsage: (usage: any) => {
        expect(usage.promptTokens).toBeGreaterThan(0);
        expect(usage.completionTokens).toBeGreaterThan(0);
        expect(usage.totalTokens).toBe(usage.promptTokens + usage.completionTokens);
        usageReported = true;
      },
      onFinish: (fullText: string) => {
        finishedText = fullText;
      }
    };

    const result = await provider.streamChat(messages, systemPrompt, config, undefined, options);
    expect(chunksCount).toBeGreaterThan(0);
    expect(finishedText).toBe(result);
    expect(usageReported).toBe(true);
    expect(result).toContain('banco de dados');
  });
});
