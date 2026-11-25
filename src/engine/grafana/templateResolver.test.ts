import { TemplateResolver } from './templateResolver';

describe('TemplateResolver', () => {
  test('calculates duration from relative range string', () => {
    expect(TemplateResolver.calculateRangeDuration('now-1h', 'now')).toBe('1h');
    expect(TemplateResolver.calculateRangeDuration('now-6h', 'now')).toBe('6h');
    expect(TemplateResolver.calculateRangeDuration('now-15m', 'now')).toBe('15m');
    expect(TemplateResolver.calculateRangeDuration('now-7d', 'now')).toBe('7d');
  });

  test('builds variable map with Grafana built-ins and custom variables', () => {
    const vars = [
      {
        name: 'api',
        allValue: '.*',
        current: { value: '$__all' },
      },
      {
        name: 'status',
        current: { value: ['200', '201'] },
      },
    ];

    const map = TemplateResolver.buildVariableMap(vars as any, { from: 'now-1h', to: 'now' });
    expect(map.get('__range')).toBe('1h');
    expect(map.get('__rate_interval')).toBe('1m');
    expect(map.get('api')).toBe('.*');
    expect(map.get('status')).toBe('200|201');
  });

  test('resolves query string containing $api and $__range', () => {
    const varMap = new Map<string, string>([
      ['__range', '1h'],
      ['api', '.*'],
      ['rate_interval', '1m'],
    ]);

    const expr = 'sum(rate(istio_api_requests_total{api=~"$api"}[$__range]))';
    const resolved = TemplateResolver.resolveString(expr, varMap);
    expect(resolved).toBe('sum(rate(istio_api_requests_total{api=~".*"}[1h]))');
  });

  test('resolves deep query payload with nested objects and arrays', () => {
    const varMap = new Map<string, string>([
      ['host', 'ASR-LAB-VD'],
      ['item', 'CPU Utilization'],
    ]);

    const payload = {
      datasource: { uid: 'zabbix' },
      host: { filter: '$host' },
      items: [{ filter: '$item' }],
    };

    const resolved = TemplateResolver.resolveQueryPayload(payload, varMap);
    expect(resolved.host.filter).toBe('ASR-LAB-VD');
    expect(resolved.items[0].filter).toBe('CPU Utilization');
  });
});
