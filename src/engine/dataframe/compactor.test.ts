import { FieldType, toDataFrame } from '@grafana/data';
import { DataFrameCompactor } from './compactor';

describe('DataFrameCompactor', () => {
  it('deve extrair min, max, p95 e detectar anomalia em série temporal numérica', () => {
    const timestamps = [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000];
    // Linha de base em torno de 10-15 com um spike massivo de 95 no tempo 8000
    const cpuValues = [10, 12, 11, 13, 10, 14, 12, 95, 12, 11];

    const frame = toDataFrame({
      name: 'CPU utilization KVM01',
      fields: [
        { name: 'time', type: FieldType.time, values: timestamps },
        { name: 'value', type: FieldType.number, values: cpuValues },
      ],
    });

    const result = DataFrameCompactor.compact([frame]);

    expect(result.metrics.length).toBe(1);
    const cpu = result.metrics[0];

    expect(cpu.min).toBe(10);
    expect(cpu.max).toBe(95);
    expect(cpu.spikesCount).toBeGreaterThanOrEqual(1);
    expect(cpu.peakAnomaly).toBeDefined();
    expect(cpu.peakAnomaly?.value).toBe(95);
    expect(cpu.peakAnomaly?.timestamp).toBe(8000);
  });

  it('deve agrupar padrões de log e contar erros/bloqueios do Graylog', () => {
    const logMessages = [
      'FortiGate: Deny packet from 192.0.2.100 to 198.51.100.5 port 443',
      'FortiGate: Deny packet from 192.0.2.101 to 198.51.100.5 port 443',
      'FortiGate: Deny packet from 192.0.2.102 to 198.51.100.5 port 443',
      'SSH: Successful login for user admin',
      'Kernel: Out of memory (OOM killer killed process 451)',
    ];

    const frame = toDataFrame({
      name: 'sec-fortigate-graylog',
      fields: [
        { name: 'message', type: FieldType.string, values: logMessages },
      ],
    });

    const result = DataFrameCompactor.compact([frame]);

    expect(result.logs.length).toBe(1);
    const log = result.logs[0];
    expect(log.totalLogsAnalyzed).toBe(5);
    expect(log.errorCount).toBeGreaterThanOrEqual(4); // Deny (3x) + OOM (1x)
    expect(log.topPatterns.length).toBeGreaterThanOrEqual(2);
  });
});
