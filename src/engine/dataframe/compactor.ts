import { DataFrame, Field, FieldType } from '@grafana/data';
import { CompactedTelemetry, LogSummary, MetricSummary } from '../types';

/**
 * Motor central de compactação de DataFrames do Grafana para LLMs.
 * Transforma milhares de pontos de time-series e linhas de log em resumos
 * estatísticos enxutos para evitar estourar limites de tokens e evitar alucinações.
 */
export class DataFrameCompactor {
  /**
   * Compacta uma lista de DataFrames do Grafana em um payload sintético estruturado.
   */
  public static compact(
    frames: DataFrame[],
    timeRange?: { from: string; to: string }
  ): CompactedTelemetry {
    const metrics: MetricSummary[] = [];
    const logs: LogSummary[] = [];
    let totalPointsProcessed = 0;

    for (const frame of frames) {
      if (!frame.fields || frame.fields.length === 0) {
        continue;
      }

      const timeField = frame.fields.find((f) => f.type === FieldType.time);
      const numberFields = frame.fields.filter((f) => f.type === FieldType.number);
      const stringFields = frame.fields.filter((f) => f.type === FieldType.string);

      // Se temos campos numéricos e tempo, tratamos como Time-Series (Métricas Zabbix / Prometheus)
      if (numberFields.length > 0 && timeField) {
        for (const numField of numberFields) {
          const summary = this.processTimeSeries(frame, timeField, numField);
          if (summary) {
            metrics.push(summary);
            totalPointsProcessed += numField.values.length;
          }
        }
      } 
      // Se temos campos numéricos mas NÃO temos campo de tempo (Instant Vectors / Tabelas de Métricas / Stat)
      else if (numberFields.length > 0) {
        const summaries = this.processTabularOrInstantMetrics(frame, numberFields, stringFields);
        for (const s of summaries) {
          metrics.push(s);
          totalPointsProcessed += 1;
        }
      }
      // Se predominam strings (mensagens de log, ex: Graylog / Elasticsearch)
      else if (stringFields.length > 0) {
        const logSummary = this.processLogs(frame, stringFields);
        if (logSummary) {
          logs.push(logSummary);
          totalPointsProcessed += frame.length;
        }
      }
    }

    const durationMinutes = this.calculateDurationMinutes(timeRange);

    return {
      timeRange: {
        from: timeRange?.from || 'now-1h',
        to: timeRange?.to || 'now',
        durationMinutes,
      },
      metrics,
      logs,
      rawFrameCount: frames.length,
      totalPointsProcessed,
    };
  }

  /**
   * Processa uma série temporal numérica e extrai min, max, avg, p95 e anomalias
   */
  private static processTimeSeries(
    frame: DataFrame,
    timeField: Field,
    numField: Field
  ): MetricSummary | null {
    const values: number[] = [];
    const times: number[] = [];

    const rawValues = numField.values;
    const rawTimes = timeField.values;

    for (let i = 0; i < rawValues.length; i++) {
      const v = rawValues[i];
      if (typeof v === 'number' && !isNaN(v) && isFinite(v)) {
        values.push(v);
        times.push(rawTimes[i]);
      }
    }

    if (values.length === 0) {
      return null;
    }

    // Ordenação para cálculo de percentil
    const sorted = [...values].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const sum = values.reduce((acc, curr) => acc + curr, 0);
    const avg = sum / values.length;

    // Percentil 95
    const p95Index = Math.min(Math.floor(sorted.length * 0.95), sorted.length - 1);
    const p95 = sorted[p95Index];
    const latest = values[values.length - 1];

    // Desvio padrão (sigma)
    const variance = values.reduce((acc, curr) => acc + Math.pow(curr - avg, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Detecção de picos / anomalias (> 2.5 sigma)
    const threshold = avg + 2.5 * stdDev;
    let spikesCount = 0;
    let maxSpikeValue = -Infinity;
    let maxSpikeIndex = -1;

    if (stdDev > 0) {
      for (let i = 0; i < values.length; i++) {
        if (values[i] > threshold) {
          spikesCount++;
          if (values[i] > maxSpikeValue) {
            maxSpikeValue = values[i];
            maxSpikeIndex = i;
          }
        }
      }
    }

    // Tendência (compara primeiros 10% com últimos 10%)
    const sampleSize = Math.max(1, Math.floor(values.length * 0.1));
    const firstChunkAvg = values.slice(0, sampleSize).reduce((a, b) => a + b, 0) / sampleSize;
    const lastChunkAvg = values.slice(-sampleSize).reduce((a, b) => a + b, 0) / sampleSize;
    const delta = lastChunkAvg - firstChunkAvg;

    let trend: MetricSummary['trend'] = 'stable';
    if (stdDev > avg * 0.5) {
      trend = 'volatile';
    } else if (delta > avg * 0.15) {
      trend = 'increasing';
    } else if (delta < -avg * 0.15) {
      trend = 'decreasing';
    }

    // Blacklist de campos internos do Graylog / Elasticsearch que são números mas não métricas de infraestrutura
    const NOISE_FIELDS = new Set([
      'facility_num', 'sequence_number', 'gl2_remote_port', 'remote_port',
      'port', '_id', 'level', 'facility', 'timestamp', 'gl2_source_input',
      'version', 'gl2_remote_ip', 'gl2_source_node'
    ]);

    if (numField.name && NOISE_FIELDS.has(numField.name.toLowerCase())) {
      return null;
    }

    const rawName = (numField.name || '').trim();
    const isGeneric = !rawName || ['value', 'val', 'metric', 'serie', 'series'].includes(rawName.toLowerCase()) || rawName.length <= 2;
    const labels = (numField.labels as Record<string, string>) || {};

    // Extrai contexto rico dos rótulos (labels) para identificar a entidade (API, microsserviço, código HTTP, interface ou host)
    const labelParts: string[] = [];
    if (labels.api) {labelParts.push(labels.api);}
    if (labels.service && labels.service !== labels.api) {labelParts.push(labels.service);}
    if (labels.endpoint) {labelParts.push(labels.endpoint);}
    if (labels.response_code) {labelParts.push(`HTTP ${labels.response_code}`);}
    else if (labels.response_class) {labelParts.push(`Classe ${labels.response_class}`);}
    if (labels.method) {labelParts.push(labels.method);}
    if (labels.item) {labelParts.push(labels.item);}
    if (labels.host) {labelParts.push(labels.host);}
    if (labels.device && labels.device !== labels.host) {labelParts.push(labels.device);}
    if (labels.instance && !labels.host) {labelParts.push(labels.instance);}

    const labelContext = labelParts.join(' | ');

    let metricName = '';
    if (frame.name && isGeneric) {
      metricName = labelContext ? `${frame.name} (${labelContext})` : frame.name;
    } else if (frame.name && !isGeneric) {
      metricName = labelContext ? `${frame.name} - ${rawName} (${labelContext})` : `${frame.name} - ${rawName}`;
    } else {
      metricName = labelContext ? `${rawName || 'Métrica'} (${labelContext})` : (rawName || 'Métrica');
    }

    const unit = numField.config?.unit || undefined;
    const humanValue = this.formatHumanValue(latest, unit, metricName);

    let peakAnomaly: MetricSummary['peakAnomaly'] = undefined;
    if (maxSpikeIndex !== -1) {
      const peakTime = times[maxSpikeIndex];
      peakAnomaly = {
        timestamp: peakTime,
        formattedTime: new Date(peakTime).toLocaleTimeString(),
        value: Number(maxSpikeValue.toFixed(2)),
        deviationFactor: Number(((maxSpikeValue - avg) / (stdDev || 1)).toFixed(2)),
        humanValue: this.formatHumanValue(maxSpikeValue, unit, metricName),
      };
    }

    const category = this.categorizeMetric(metricName);

    return {
      name: metricName,
      unit,
      labels,
      min: Number(min.toFixed(2)),
      max: Number(max.toFixed(2)),
      avg: Number(avg.toFixed(2)),
      p95: Number(p95.toFixed(2)),
      latest: Number(latest.toFixed(2)),
      humanValue,
      category,
      trend,
      spikesCount,
      peakAnomaly,
    };
  }

  /**
   * Processa métricas tabulares ou vetores instantâneos (ex: Stat, BarGauge, TopK e Tabelas sem eixo temporal longo)
   */
  private static processTabularOrInstantMetrics(
    frame: DataFrame,
    numberFields: Field[],
    stringFields: Field[]
  ): MetricSummary[] {
    const results: MetricSummary[] = [];
    const rowCount = frame.length;
    const entityField = stringFields[0];

    for (const numField of numberFields) {
      const rawName = (numField.name || '').trim();
      const unit = numField.config?.unit || undefined;

      // Se temos múltiplas linhas com campo textual identificador (ex: Tabela de APIs com várias linhas)
      if (entityField && rowCount > 1) {
        for (let i = 0; i < rowCount; i++) {
          const entityVal = String(entityField.values[i] || '').trim();
          const val = Number(numField.values[i]);
          if (isNaN(val) || !isFinite(val)) {
            continue;
          }

          const labels: Record<string, string> = {
            ...((numField.labels as Record<string, string>) || {}),
            [entityField.name || 'entity']: entityVal,
          };

          const frameTitle = frame.name || 'Tabela';
          const colTitle = rawName && rawName.toLowerCase() !== 'value' ? ` - ${rawName}` : '';
          const metricName = `${frameTitle}${colTitle} [${entityVal}]`;
          const humanValue = this.formatHumanValue(val, unit, metricName);
          const category = this.categorizeMetric(metricName);

          results.push({
            name: metricName,
            unit,
            labels,
            min: Number(val.toFixed(2)),
            max: Number(val.toFixed(2)),
            avg: Number(val.toFixed(2)),
            p95: Number(val.toFixed(2)),
            latest: Number(val.toFixed(2)),
            humanValue,
            category,
            trend: 'stable',
            spikesCount: 0,
          });
        }
      } else {
        // Métrica instantânea de valor único ou linha individual
        const val = Number(numField.values[numField.values.length - 1]);
        if (isNaN(val) || !isFinite(val)) {
          continue;
        }

        const labels = (numField.labels as Record<string, string>) || {};
        const labelParts: string[] = [];
        if (labels.api) {
          labelParts.push(labels.api);
        }
        if (labels.service && labels.service !== labels.api) {
          labelParts.push(labels.service);
        }
        if (labels.response_code) {
          labelParts.push(`HTTP ${labels.response_code}`);
        } else if (labels.response_class) {
          labelParts.push(`Classe ${labels.response_class}`);
        }
        if (labels.item) {
          labelParts.push(labels.item);
        }
        if (labels.host) {
          labelParts.push(labels.host);
        }
        const labelContext = labelParts.join(' | ');

        let metricName = frame.name || rawName || 'Métrica Instantânea';
        if (labelContext) {
          metricName += ` (${labelContext})`;
        }

        const humanValue = this.formatHumanValue(val, unit, metricName);
        const category = this.categorizeMetric(metricName);

        results.push({
          name: metricName,
          unit,
          labels,
          min: Number(val.toFixed(2)),
          max: Number(val.toFixed(2)),
          avg: Number(val.toFixed(2)),
          p95: Number(val.toFixed(2)),
          latest: Number(val.toFixed(2)),
          humanValue,
          category,
          trend: 'stable',
          spikesCount: 0,
        });
      }
    }

    return results;
  }

  /**
   * Atribui uma categoria funcional de TI/Telecom à métrica
   */
  private static categorizeMetric(name: string): MetricSummary['category'] {
    const n = name.toLowerCase();
    if (/api|http|request|requisiç|endpoint|status_code|response_code|2xx|3xx|4xx|5xx|probe|taxa_sucesso|taxa de sucesso|tempo_resposta|istio|microservice|service|rest|grpc/i.test(n)) {
      return 'APIs/Aplicações';
    }
    if (/icmp|ping|loss|latency|latência|response time|disponibilidade|status|snmp/.test(n)) {
      return 'Conectividade';
    }
    if (/cpu|mem|memory|swap|load|ram|temp|temperatura|sess|disk|disco/.test(n)) {
      return 'Hardware';
    }
    if (/traffic|tráfego|banda|bandwidth|bps|bytes|bits|packets|in|out|octets|interface/.test(n)) {
      return 'Tráfego';
    }
    if (/vpn|ipsec|tunnel|túnel|drop|deny|bloqueio|firewall|sec/.test(n)) {
      return 'VPN/Segurança';
    }
    return 'Outros';
  }

  /**
   * Converte números brutos em valores amigáveis para operadores de NOC (Mbps, ms, %, req/s, etc.)
   */
  private static formatHumanValue(val: number, unit?: string, metricName?: string): string {
    const name = (metricName || '').toLowerCase();
    const u = (unit || '').toLowerCase();

    // Status booleano / ICMP ping / SNMP / Probes de SLA
    if (/icmp ping|snmp.*avail|tunnel status|probe_success/i.test(name)) {
      if (val === 1) {return 'UP (100% / OK)';}
      if (val === 0) {return 'DOWN (0% / Falha)';}
    }

    // RPS / Throughput de APIs
    if (/rps|req\/s|reqs\/s|throughput/i.test(name) || u === 'rps' || u === 'reqps') {
      return `${val.toFixed(2)} req/s`;
    }

    // Perda de Pacotes / Percentual / Taxa de Sucesso / Erros %
    if (/loss|perda|percent|utilization|taxa|sucesso|pct|4xx|5xx/i.test(name) || u === 'percent' || u === '%') {
      return `${val.toFixed(1)}%`;
    }

    // Tráfego de Rede (Bits / Bytes)
    if (u.includes('bps') || u.includes('bits') || /traffic|tráfego|bytes|bits|bps/i.test(name)) {
      if (val >= 1e9) {return `${(val / 1e9).toFixed(2)} Gbps`;}
      if (val >= 1e6) {return `${(val / 1e6).toFixed(1)} Mbps`;}
      if (val >= 1e3) {return `${(val / 1e3).toFixed(1)} Kbps`;}
      return `${val.toFixed(0)} bps`;
    }

    // Latência e Tempos
    if (u === 's' || /response time|latência|latency/i.test(name)) {
      if (val < 1 && (u === 's' || val > 0)) {return `${(val * 1000).toFixed(1)} ms`;}
      if (val < 1000) {return `${val.toFixed(1)} ms`;}
      return `${(val / 1000).toFixed(2)} s`;
    }

    // Contagem simples (ex: requisições, erros, sessões)
    if (/reqs|erros|total|count|volume/i.test(name) || val >= 1000) {
      return val.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    }

    return `${val.toFixed(1)} ${unit || ''}`.trim();
  }

  /**
   * Processa tabelas de logs (Graylog/Elasticsearch) agrupando mensagens semelhantes
   */
  private static processLogs(frame: DataFrame, stringFields: Field[]): LogSummary | null {
    const messageField =
      stringFields.find((f) => ['message', 'msg', 'log', 'line'].includes(f.name.toLowerCase())) ||
      stringFields[0];

    const levelField = stringFields.find((f) =>
      ['level', 'severity', 'priority'].includes(f.name.toLowerCase())
    );

    const messages = messageField.values;
    const patternMap = new Map<string, { count: number; sample: string; severity: 'critical' | 'error' | 'warning' | 'info' }>();

    let errorCount = 0;
    let warnCount = 0;

    for (let i = 0; i < messages.length; i++) {
      const msg = String(messages[i] || '').trim();
      if (!msg) {
        continue;
      }

      const level = levelField ? String(levelField.values[i] || '').toLowerCase() : '';
      const isCriticalOrError =
        level.includes('err') ||
        level.includes('crit') ||
        /error|fail|deny|drop|timeout|oom|exception|fatal/i.test(msg);
      const isWarn = level.includes('warn') || /warn/i.test(msg);

      if (isCriticalOrError) {
        errorCount++;
      } else if (isWarn) {
        warnCount++;
      }

      // Normaliza a mensagem mascarando números e hashes para agrupar padrões
      const pattern = msg
        .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]')
        .replace(/\b[0-9a-f]{8,}\b/gi, '[HASH]')
        .replace(/\b\d+\b/g, '[NUM]')
        .slice(0, 120);

      const existing = patternMap.get(pattern);
      const severity = isCriticalOrError ? 'error' : isWarn ? 'warning' : 'info';

      if (existing) {
        existing.count++;
      } else {
        patternMap.set(pattern, {
          count: 1,
          sample: msg.slice(0, 180),
          severity,
        });
      }
    }

    // Top 8 padrões mais frequentes
    const topPatterns = Array.from(patternMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([pattern, data]) => ({
        pattern,
        occurrences: data.count,
        sample: data.sample,
        severity: data.severity,
      }));

    return {
      streamOrSource: frame.name || 'Graylog-Logs',
      totalLogsAnalyzed: messages.length,
      errorCount,
      warnCount,
      topPatterns,
    };
  }

  private static calculateDurationMinutes(timeRange?: { from: string; to: string }): number {
    if (!timeRange) {
      return 60;
    }
    // Heurística básica de intervalo
    if (timeRange.from.includes('h')) {
      const hours = parseInt(timeRange.from.replace(/\D/g, ''), 10) || 1;
      return hours * 60;
    }
    if (timeRange.from.includes('d')) {
      const days = parseInt(timeRange.from.replace(/\D/g, ''), 10) || 1;
      return days * 24 * 60;
    }
    return 60;
  }
}
