/**
 * Representa um resumo estatístico compacto de uma série temporal
 * projetado especificamente para não estourar a janela de contexto de LLMs.
 */
export interface MetricSummary {
  name: string;
  unit?: string;
  labels: Record<string, string>;
  min: number;
  max: number;
  avg: number;
  p95: number;
  latest: number;
  humanValue?: string;
  category?: 'Conectividade' | 'Hardware' | 'Tráfego' | 'VPN/Segurança' | 'APIs/Aplicações' | 'Outros';
  trend: 'stable' | 'increasing' | 'decreasing' | 'volatile';
  spikesCount: number;
  peakAnomaly?: {
    timestamp: number;
    formattedTime: string;
    value: number;
    deviationFactor: number;
    humanValue?: string;
  };
}

/**
 * Representa a agregação de logs compactados do Graylog / Elasticsearch
 */
export interface LogSummary {
  streamOrSource: string;
  totalLogsAnalyzed: number;
  errorCount: number;
  warnCount: number;
  topPatterns: Array<{
    pattern: string;
    occurrences: number;
    sample: string;
    severity: 'critical' | 'error' | 'warning' | 'info';
  }>;
}

/**
 * Payload estruturado resultante da compactação do DataFrame do Grafana
 */
export interface CompactedTelemetry {
  dashboardTitle?: string;
  timeRange: {
    from: string;
    to: string;
    durationMinutes: number;
  };
  metrics: MetricSummary[];
  logs: LogSummary[];
  rawFrameCount: number;
  totalPointsProcessed: number;
}

/**
 * Configuração dos provedores de IA suportados pelo AnalizAI / NOCPilot / VOCPilot
 */
export type AIProviderType = 'ollama' | 'openai' | 'gemini' | 'groq' | 'vllm' | 'mock';

export interface AnalizAIConfig {
  provider: AIProviderType;
  endpointUrl: string; // Ex: http://localhost:11434 (Ollama) ou https://api.openai.com/v1
  modelName: string;   // Ex: llama3:8b, gpt-4o-mini, gemini-1.5-flash
  systemPromptPreset?: string;
  temperature?: number;
  maxTokens?: number;
}

export type NOCPilotConfig = AnalizAIConfig;
export type VOCPilotConfig = AnalizAIConfig;

/**
 * Mensagem do Chat do Copiloto
 */
export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  telemetryContext?: Partial<CompactedTelemetry>;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  suggestedActions?: Array<{
    label: string;
    actionType: 'query_ds' | 'navigate_panel' | 'view_logs';
    payload: any;
  }>;
}
