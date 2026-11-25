import { PromptTemplates } from './templates';
import { CompactedTelemetry } from '../types';

describe('PromptTemplates (ASD-STE100 & Token Optimization)', () => {
  test('getSystemPrompt enforces AnalizAI ASD-STE100 Go/No-Go & SRE 4-block structure', () => {
    const sys = PromptTemplates.getSystemPrompt();
    expect(sys).toContain('AnalizAI');
    expect(sys).toContain('ASD-STE100');
    expect(sys).toContain('[ESTADO DOS INDICADORES]');
    expect(sys).toContain('[EVIDÊNCIAS & DADOS]');
    expect(sys).toContain('[PARECER / AÇÃO]');
    expect(sys).toContain('[CRITÉRIO DE SAÍDA]');
  });

  test('formatTelemetryForPrompt prunes 100% stable subsystems into single line', () => {
    const telemetry: CompactedTelemetry = {
      dashboardTitle: 'Novo Dashboard Teste',
      timeRange: { from: 'now-1h', to: 'now', durationMinutes: 60 },
      rawFrameCount: 2,
      totalPointsProcessed: 100,
      metrics: [
        {
          name: 'Ping Loss',
          unit: '%',
          labels: {},
          min: 0,
          max: 0,
          avg: 0,
          p95: 0,
          latest: 0,
          humanValue: '0 %',
          category: 'Conectividade',
          trend: 'stable',
          spikesCount: 0,
        },
        {
          name: 'API Latency',
          unit: 'ms',
          labels: { api: 'auth' },
          min: 10,
          max: 500,
          avg: 45,
          p95: 320,
          latest: 420,
          humanValue: '420 ms',
          category: 'APIs/Aplicações',
          trend: 'increasing',
          spikesCount: 2,
        },
      ],
      logs: [],
    };

    const prompt = PromptTemplates.formatTelemetryForPrompt(telemetry);
    expect(prompt).toContain('✅ **🌐 Conectividade & Enlaces** [Estável]');
    expect(prompt).toContain('API Latency');
    expect(prompt).toContain('P95: 320');
  });
});
