import { CopilotMessage, VOCPilotConfig } from '../../engine/types';
import { LLMProvider, LLMStreamOptions, TokenUsage } from '../types';

export class MockLLMProvider implements LLMProvider {
  async streamChat(
    messages: CopilotMessage[],
    systemPrompt: string,
    _config: VOCPilotConfig,
    _apiKey?: string,
    options?: LLMStreamOptions
  ): Promise<string> {
    const lastUserMessage = messages
      .filter((m) => m.role === 'user')
      .pop()?.content || '';

    let anomalyContext = 'Latência elevada de API e picos de CPU detectados no cluster SRE.';
    if (lastUserMessage.toLowerCase().includes('database') || lastUserMessage.toLowerCase().includes('sql') || lastUserMessage.toLowerCase().includes('banco de dados')) {
      anomalyContext = 'Pool de conexões de banco de dados esgotado e slow queries no PostgreSQL.';
    } else if (lastUserMessage.toLowerCase().includes('network') || lastUserMessage.toLowerCase().includes('packet') || lastUserMessage.toLowerCase().includes('rede')) {
      anomalyContext = 'Perda de pacotes e latência em link BGP de borda (AS28592).';
    } else if (lastUserMessage.toLowerCase().includes('memory') || lastUserMessage.toLowerCase().includes('oom') || lastUserMessage.toLowerCase().includes('memória')) {
      anomalyContext = 'Pressão de memória heap em container backend com risco de OOM Killer.';
    }

    const responseText = `### [ESTADO DOS INDICADORES]
- Sistema Operacional: Operacional com degradação pontual em subcomponentes.
- Contexto Analisado: ${anomalyContext}

### [EVIDÊNCIAS & DADOS]
- Amostragem de Telemetria: Processada via Motor AnalizAI (Modo Mock / SRE Offline).
- Correlação de Anomalias: Padrão sazonal compatível com pico de requisições ou contenção de recursos locais.

### [PARECER / AÇÃO]
1. Executive Summary: Identificada anomalia de performance em telemetria sem impacto sistêmico total, porém exigindo mitigação preventiva.
2. Detected Metrics/Anomalies: Variação de latência acima do limiar p95 (+45% sobre a média histórica).
3. Recommended Next Steps:
   - Inspecionar logs de container/serviço afetado.
   - Validar limites de alocação de recursos (CPU/Memory/Connections).
   - Aplicar rollback ou scale-out preventivo se a tendência persistir.

### [CRITÉRIO DE SAÍDA]
- Estabilização dos indicadores métricos abaixo do limiar de alerta por janela de 15 minutos.`;

    const chunks = responseText.match(/.{1,25}/g) || [responseText];
    let fullText = '';

    for (const chunk of chunks) {
      if (options?.signal?.aborted) {
        throw new Error('Aborted');
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
      fullText += chunk;
      options?.onChunk(chunk);
    }

    const promptChars = systemPrompt.length + messages.reduce((acc, m) => acc + m.content.length, 0);
    const estPromptTokens = Math.max(1, Math.round(promptChars / 4));
    const estCompletionTokens = Math.max(1, Math.round(fullText.length / 4));

    const usage: TokenUsage = {
      promptTokens: estPromptTokens,
      completionTokens: estCompletionTokens,
      totalTokens: estPromptTokens + estCompletionTokens,
    };

    options?.onUsage?.(usage);
    options?.onFinish?.(fullText);

    return fullText;
  }
}
