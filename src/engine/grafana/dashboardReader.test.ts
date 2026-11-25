import { DashboardReader } from './dashboardReader';

describe('DashboardReader (Dynamic Discovery & Universal Extraction)', () => {
  test('extracts targets from top-level, nested row panels, and string datasources', () => {
    const dynamicDashboard = {
      title: 'Dynamic Future Dashboard',
      templating: {
        list: [{ name: 'host', current: { value: 'srv-01' } }],
      },
      panels: [
        {
          id: 1,
          title: 'CPU Usage',
          type: 'timeseries',
          datasource: 'prometheus-uid',
          targets: [{ expr: 'cpu_usage{host="$host"}[$__range]', refId: 'A' }],
        },
        {
          id: 2,
          title: 'Collapsed Row',
          type: 'row',
          panels: [
            {
              id: 3,
              title: 'Nested Memory',
              type: 'stat',
              datasource: { uid: 'prom-2', type: 'prometheus' },
              targets: [{ expr: 'mem_used{host="$host"}', refId: 'A' }],
            },
          ],
        },
        {
          id: 4,
          title: 'Internal Grafana',
          type: 'text',
          datasource: { uid: '-- Grafana --' },
          targets: [{ refId: 'A' }],
        },
      ],
    };

    const targets = DashboardReader.extractTargetsFromDashboard(dynamicDashboard, { from: 'now-6h', to: 'now' });
    expect(targets).toHaveLength(2);
    expect(targets[0].datasourceUid).toBe('prometheus-uid');
    expect(targets[0].queryPayload.expr).toBe('cpu_usage{host="srv-01"}[6h]');
    expect(targets[1].panelTitle).toBe('Nested Memory');
    expect(targets[1].queryPayload.expr).toBe('mem_used{host="srv-01"}');
  });
});
