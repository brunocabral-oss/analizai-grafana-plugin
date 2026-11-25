import { CompactedTelemetry, MetricSummary } from '../types';

export class PromptTemplates {
  /**
   * Constrói o System Prompt no padrão ASD-STE100 Híbrido (Governança de Projetos Go/No-Go + SRE)
   * Foco em assertividade técnica, decisões baseadas em dados e economia de tokens.
   */
  public static getSystemPrompt(): string {
    return `IDENTIDADE: AnalizAI, motor de Análise de Indicadores, Governança de Projetos (Go/No-Go) e Observabilidade SRE para Grafana.
ESTILO OBRIGATÓRIO: ASD-STE100 / Português Técnico Telegráfico. PROIBIDO usar saudações, preâmbulos, desculpas, adjetivos qualitativos ou encerramentos vazios. Inicie imediatamente no bloco [ESTADO DOS INDICADORES].

REGRAS DE PRECISÃO:
1. Baseie-se estritamente nos dados fornecidos. Nunca invente métricas, metas ou hosts. Se faltar dado essencial para aprovar ou diagnosticar, declare a lacuna em 1 linha e forneça a query PromQL/Zabbix/Graylog necessária.
2. Traduza métricas para termos operacionais e de negócio (latência ms, perda %, throughput req/s, taxa de sucesso %, erros HTTP 4xx/5xx, uso CPU/RAM %).
3. Perguntas de projeto ("aprovar?", "Go/No-Go", "pronto para produção?"): avalie estabilidade, taxa de erros, picos (>2.5 sigma) e folga de capacidade antes de emitir o veredito.
4. Perguntas de ranking ("piores APIs", "mais requisições", "maiores erros"): entregue o ranking ordenado com valores exatos primeiro.

ESTRUTURA OBRIGATÓRIA DA RESPOSTA:
1. **[ESTADO DOS INDICADORES]**: Semáforo (🟢 APROVADO / SAUDÁVEL | 🟡 RESSALVAS / ATENÇÃO | 🔴 REPROVADO / CRÍTICO) + síntese numérica de impacto no projeto/SLA.
2. **[EVIDÊNCIAS & DADOS]**: Fatos mensuráveis extraídos do dashboard (taxas, picos com horário e valor, correlação com logs ou lacunas de telemetria).
3. **[PARECER / AÇÃO]**: Decisão objetiva (**GO**, **GO COM RESSALVAS** ou **NO-GO**) para o time de projeto, ou até 2 comandos CLI cirúrgicos em bloco de código para troubleshooting SRE.
4. **[CRITÉRIO DE SAÍDA]**: Condição mensurável para liberação/aprovação do projeto ou comportamento esperado na telemetria pós-ajuste.`;
  }

  /**
   * Serializa a telemetria agrupada por subsistemas com unidades humanas
   * Otimizado para economia de tokens: métricas 100% estáveis são condensadas em uma única linha.
   */
  public static formatTelemetryForPrompt(telemetry: CompactedTelemetry): string {
    const dashName = telemetry.dashboardTitle ? ` "${telemetry.dashboardTitle}"` : '';
    let output = `### Dados do Dashboard${dashName}
- **Janela:** ${telemetry.timeRange.from} até ${telemetry.timeRange.to} (~${telemetry.timeRange.durationMinutes} min) | ${telemetry.rawFrameCount} painéis / ${telemetry.totalPointsProcessed} pontos.

`;

    if (telemetry.metrics.length > 0) {
      // Agrupa métricas por categoria
      const groups: Record<string, MetricSummary[]> = {
        '🚀 APIs, Microsserviços & HTTP (RED / Taxa de Sucesso, Erros, Throughput)': [],
        '🌐 Conectividade & Enlaces': [],
        '💻 Recursos de Hardware & Sistema': [],
        '📈 Tráfego de Rede & Interfaces': [],
        '🔒 VPN, Segurança & Túneis': [],
        '⚙️ Outros Indicadores': [],
      };

      for (const m of telemetry.metrics) {
        if (m.category === 'APIs/Aplicações') {groups['🚀 APIs, Microsserviços & HTTP (RED / Taxa de Sucesso, Erros, Throughput)'].push(m);}
        else if (m.category === 'Conectividade') {groups['🌐 Conectividade & Enlaces'].push(m);}
        else if (m.category === 'Hardware') {groups['💻 Recursos de Hardware & Sistema'].push(m);}
        else if (m.category === 'Tráfego') {groups['📈 Tráfego de Rede & Interfaces'].push(m);}
        else if (m.category === 'VPN/Segurança') {groups['🔒 VPN, Segurança & Túneis'].push(m);}
        else {groups['⚙️ Outros Indicadores'].push(m);}
      }

      for (const [groupTitle, items] of Object.entries(groups)) {
        if (items.length === 0) {continue;}

        // Separa métricas com variação real daquelas 100% estáveis
        const varyingMetrics: MetricSummary[] = [];
        const stableMetrics: MetricSummary[] = [];

        for (const m of items) {
          const isFlat = m.spikesCount === 0 && (m.min === m.max || m.trend === 'stable');
          if (isFlat) {
            stableMetrics.push(m);
          } else {
            varyingMetrics.push(m);
          }
        }

        // Pruning de Subsistemas 100% Estáveis (economiza tokens sem perder valores de referência)
        if (varyingMetrics.length === 0 && stableMetrics.length > 0) {
          const sampleList = stableMetrics
            .slice(0, 6)
            .map((s) => `${s.name} (${s.humanValue || `${s.latest} ${s.unit || ''}`.trim()})`)
            .join(', ');
          const extraCount = stableMetrics.length > 6 ? ` (+${stableMetrics.length - 6} estáveis)` : '';
          output += `- ✅ **${groupTitle}** [Estável]: ${sampleList}${extraCount}\n\n`;
          continue;
        }

        output += `#### ${groupTitle}:\n`;

        // Métricas ativas com detalhes estatísticos
        for (const m of varyingMetrics) {
          const valStr = m.humanValue || `${m.latest} ${m.unit || ''}`;
          output += `- **${m.name}**: Atual = **${valStr}** (Média: ${m.avg}, P95: ${m.p95}, Máx: ${m.max})`;
          if (m.peakAnomaly) {
            const peakStr = m.peakAnomaly.humanValue || String(m.peakAnomaly.value);
            output += ` | ⚠️ *Pico: ${peakStr} às ${m.peakAnomaly.formattedTime}*`;
          }
          output += `\n`;
        }

        // Métricas estáveis condensadas em uma única linha (economiza ~50% dos tokens do bloco)
        if (stableMetrics.length > 0) {
          const stableList = stableMetrics
            .map((s) => `${s.name} (${s.humanValue || `${s.latest} ${s.unit || ''}`.trim()})`)
            .join(', ');
          output += `- ✅ *Estáveis:* ${stableList}\n`;
        }

        output += `\n`;
      }
    }

    if (telemetry.logs.length > 0) {
      output += `#### 📜 Auditoria de Logs (Graylog / Firewall):\n`;
      for (const log of telemetry.logs) {
        output += `- **Fonte:** ${log.streamOrSource} (${log.totalLogsAnalyzed} logs | ${log.errorCount} erros/drops | ${log.warnCount} avisos)\n`;
        if (log.topPatterns.length > 0) {
          for (const p of log.topPatterns) {
            // Trunca amostras longas de syslog em 90 caracteres para economizar tokens
            const sample = p.sample.length > 90 ? p.sample.substring(0, 87) + '...' : p.sample;
            output += `  - [${p.severity.toUpperCase()}] (${p.occurrences}x): "${sample}"\n`;
          }
        }
      }
      output += `\n`;
    }

    return output;
  }
}
